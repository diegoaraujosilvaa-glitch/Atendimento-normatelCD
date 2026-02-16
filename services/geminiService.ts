
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

// Estado global para controle de chamadas
let isGlobalSpeaking = false;
let currentTicketId = "";
const callLockMap = new Map<string, number>();
let globalAudioContext: AudioContext | null = null;

/**
 * Busca rigorosa por uma voz feminina em português (pt-BR).
 */
const getPortugueseFemaleVoice = (): SpeechSynthesisVoice | null => {
  if (!('speechSynthesis' in window)) return null;
  
  const voices = window.speechSynthesis.getVoices();
  const ptBRVoices = voices.filter(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
  
  if (ptBRVoices.length === 0) return null;

  // 1. Prioridade para nomes de vozes femininas conhecidas
  const priorityNames = ['Maria', 'Heloisa', 'Luciana', 'Francisca', 'Vitoria', 'Yara'];
  const femaleByPriority = ptBRVoices.find(v => 
    priorityNames.some(name => v.name.toLowerCase().includes(name.toLowerCase()))
  );
  if (femaleByPriority) return femaleByPriority;

  // 2. Filtro por exclusão de termos masculinos
  const femaleByExclusion = ptBRVoices.filter(v => 
    !v.name.toLowerCase().includes('masculino') && 
    !v.name.toLowerCase().includes('male') &&
    !v.name.toLowerCase().includes('daniel') &&
    !v.name.toLowerCase().includes('felipe') &&
    !v.name.toLowerCase().includes('google português do brasil') // Geralmente é Daniel
  );

  return femaleByExclusion.length > 0 ? femaleByExclusion[0] : ptBRVoices[0];
};

/**
 * Fala um texto usando a API nativa do navegador e retorna uma Promise.
 */
const speakNativeUtterance = (text: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getPortugueseFemaleVoice();
    
    if (voice) utterance.voice = voice;
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9; 
    utterance.pitch = 1.0;

    utterance.onend = () => {
      window.speechSynthesis.cancel(); // Limpeza rigorosa
      resolve();
    };
    utterance.onerror = () => {
      window.speechSynthesis.cancel();
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
};

/**
 * Executa a sequência de 2 repetições nativas solicitada.
 */
const speakNativeSequence = async (customerName: string) => {
  window.speechSynthesis.cancel(); // Garante silêncio inicial
  
  // Primeira chamada
  await speakNativeUtterance(`Atenção: ${customerName}.`);
  
  // Intervalo de 1 segundo entre repetições
  await new Promise(r => setTimeout(r, 1000));
  
  // Segunda chamada com instrução de destino
  await speakNativeUtterance(`${customerName}. Por favor, comparecer ao Atendimento Externo. Seu pedido está pronto.`);
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Anuncia a chamada do cliente no Painel TV.
 */
export const announceCustomerCall = async (customerName: string, ticketId: string) => {
  const now = Date.now();
  const lastCallTime = callLockMap.get(ticketId) || 0;

  // Lock de 10 segundos para evitar re-anúncios frenéticos
  if (now - lastCallTime < 10000) return;
  if (isGlobalSpeaking && currentTicketId === ticketId) return;

  callLockMap.set(ticketId, now);
  isGlobalSpeaking = true;
  currentTicketId = ticketId;

  // Fallback imediato se não houver API Key
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined' || process.env.API_KEY === '') {
    await speakNativeSequence(customerName);
    isGlobalSpeaking = false;
    currentTicketId = "";
    return;
  }

  // Tenta usar Gemini com timeout de 2 segundos
  const geminiPromise = (async () => {
    // Inicialização conforme as diretrizes do SDK @google/genai
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fullText = `Atenção: ${customerName}. ${customerName}. Por favor, comparecer ao Atendimento Externo. Seu pedido está pronto.`;
    
    // Uso explícito do tipo GenerateContentResponse para conformidade com as diretrizes
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: fullText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data");

    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (globalAudioContext.state === 'suspended') await globalAudioContext.resume();

    // Decodificação de áudio PCM bruto conforme exemplo da API
    const audioBuffer = await decodeAudioData(decode(base64Audio), globalAudioContext, 24000, 1);
    const source = globalAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(globalAudioContext.destination);
    
    return new Promise<void>((resolve) => {
      source.onended = () => resolve();
      window.speechSynthesis.cancel(); // Silencia o nativo se o digital começar
      source.start(0);
    });
  })();

  const timeoutPromise = new Promise<void>((_, reject) => 
    setTimeout(() => reject(new Error("Timeout Gemini")), 2000)
  );

  try {
    await Promise.race([geminiPromise, timeoutPromise]);
  } catch (error) {
    console.warn("Fallback para Voz Nativa acionado:", error instanceof Error ? error.message : 'Erro desconhecido');
    await speakNativeSequence(customerName);
  } finally {
    isGlobalSpeaking = false;
    currentTicketId = "";
  }
};
