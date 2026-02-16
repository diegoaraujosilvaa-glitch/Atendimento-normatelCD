
import { GoogleGenAI, Modality } from "@google/genai";

// Controle de execução e estado global
let isGlobalSpeaking = false;
let currentTicketId = "";
const callLockMap = new Map<string, number>(); // ID -> Timestamp da última chamada
// Fix: Declare globalAudioContext to maintain state across calls
let globalAudioContext: AudioContext | null = null;

/**
 * Seleciona rigorosamente uma voz masculina em português.
 * Se não encontrar uma voz masculina confirmada, retorna null para evitar vozes femininas indesejadas.
 */
const getStrictMaleVoice = (): SpeechSynthesisVoice | null => {
  const voices = window.speechSynthesis.getVoices();
  const ptBRVoices = voices.filter(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
  
  if (ptBRVoices.length === 0) return null;

  // Lista de prioridade de vozes masculinas conhecidas
  const maleKeywords = ['masculino', 'male', 'daniel', 'felipe', 'google português do brasil'];
  
  const foundVoice = ptBRVoices.find(v => 
    maleKeywords.some(keyword => v.name.toLowerCase().includes(keyword))
  );

  // Se não encontrar uma voz que contenha keywords masculinas, 
  // não retorna a voz padrão (que costuma ser feminina no Windows/Chrome)
  return foundVoice || null;
};

/**
 * Função de síntese nativa com bloqueio de gênero e trava de segurança.
 */
const speakNativeStrict = (text: string, ticketId: string) => {
  if (!('speechSynthesis' in window)) return;

  // 3. Interrupção de Fila: Limpa tudo antes de começar
  window.speechSynthesis.cancel();

  // 1. Bloqueio Total de Voz Feminina: Se não houver voz masculina, aborta.
  const maleVoice = getStrictMaleVoice();
  if (!maleVoice) {
    console.warn("Voz masculina não detectada. Abortando chamada nativa para evitar voz feminina.");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = maleVoice;
  utterance.lang = 'pt-BR';
  utterance.rate = 0.85;
  utterance.pitch = 1.0;

  // Evitar acúmulo de listeners limpando referências anteriores
  utterance.onstart = () => {
    isGlobalSpeaking = true;
    currentTicketId = ticketId;
  };

  const cleanUp = () => {
    isGlobalSpeaking = false;
    currentTicketId = "";
  };

  utterance.onend = cleanUp;
  utterance.onerror = cleanUp;

  window.speechSynthesis.speak(utterance);
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
 * Anuncia a chamada do cliente.
 * 1. Limite de 2 nomes.
 * 2. Trava de 10 segundos por cliente.
 * 3. Voz masculina obrigatória.
 */
export const announceCustomerCall = async (customerName: string, ticketId: string) => {
  const now = Date.now();
  const lastCallTime = callLockMap.get(ticketId) || 0;

  // 4. Verificação de ID de Chamada: Trava de 10 segundos
  if (now - lastCallTime < 10000) {
    console.log(`Lock ativo para ${customerName}. Aguarde 10s entre chamadas.`);
    return;
  }

  // Trava global de execução
  if (isGlobalSpeaking && currentTicketId === ticketId) return;

  // Atualiza o timestamp da última chamada bem-sucedida (ou tentativa iniciada)
  callLockMap.set(ticketId, now);

  // 1. Contador Rígido de 2 Chamadas: Texto repetindo o nome exatamente 2 vezes
  const promptText = `Atenção: ${customerName}. ${customerName}. Favor comparecer ao Atendimento Externo. Seu pedido está pronto.`;

  // Se não houver API KEY, usa o modo nativo rigoroso
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined' || process.env.API_KEY === '') {
    speakNativeStrict(promptText, ticketId);
    return;
  }

  try {
    // Cancela vozes nativas se o Gemini for assumir
    window.speechSynthesis.cancel();

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore é a voz masculina estável do Gemini
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      // Fix: Initialize globalAudioContext if it doesn't exist
      if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      // Fix: Ensure the context is running
      if (globalAudioContext.state === 'suspended') {
        await globalAudioContext.resume();
      }

      // Fix: Use globalAudioContext for decoding
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        globalAudioContext,
        24000,
        1
      );

      // Fix: Use globalAudioContext to create buffer source
      const source = globalAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      // Fix: Connect to globalAudioContext destination
      source.connect(globalAudioContext.destination);
      
      source.onended = () => {
        isGlobalSpeaking = false;
        currentTicketId = "";
      };

      isGlobalSpeaking = true;
      currentTicketId = ticketId;
      source.start(0);
      
    } else {
      throw new Error("Erro no TTS Gemini");
    }
  } catch (error) {
    console.error("Erro no Gemini TTS, tentando fallback nativo masculino.", error);
    speakNativeStrict(promptText, ticketId);
  }
};
