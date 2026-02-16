
import { GoogleGenAI, Modality } from "@google/genai";

// Controle de execução e estado global
let isGlobalSpeaking = false;
let currentTicketId = "";
const callLockMap = new Map<string, number>(); // ID -> Timestamp da última chamada
let globalAudioContext: AudioContext | null = null;

/**
 * Seleciona a primeira voz em português disponível (geralmente feminina/padrão).
 * Removido o bloqueio restrito de voz masculina para garantir compatibilidade em todos os dispositivos.
 */
const getPortugueseVoice = (): SpeechSynthesisVoice | null => {
  const voices = window.speechSynthesis.getVoices();
  const ptBRVoices = voices.filter(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
  
  if (ptBRVoices.length === 0) return null;

  // Prioriza a voz padrão do sistema/navegador que costuma ser feminina e estável
  return ptBRVoices.find(v => v.default) || ptBRVoices[0];
};

/**
 * Função de síntese nativa simplificada para usar voz feminina padrão.
 */
const speakNative = (text: string, ticketId: string, customerName: string) => {
  if (!('speechSynthesis' in window)) return;

  // Estabilidade e Limpeza: Limpa fila antes de iniciar
  window.speechSynthesis.cancel();

  // Prioridade para Voz Feminina: Pega a primeira voz PT-BR disponível
  const voice = getPortugueseVoice();
  
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) {
    utterance.voice = voice;
  }
  utterance.lang = 'pt-BR';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;

  // Feedback no Console
  console.log("Chamando cliente (Voz Feminina Nativa):", customerName);

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

// Implementação manual de decode base64 seguindo as diretrizes
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Implementação manual de decodeAudioData seguindo as diretrizes
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
 * 1. Limite rigoroso de 2 repetições via texto.
 * 2. Trava de 10 segundos por cliente.
 * 3. Voz Gemini 2.5 Flash TTS com fallback nativo.
 */
export const announceCustomerCall = async (customerName: string, ticketId: string) => {
  const now = Date.now();
  const lastCallTime = callLockMap.get(ticketId) || 0;

  // Trava de segurança (lock) de 10 segundos
  if (now - lastCallTime < 10000) {
    console.log(`Bloqueio de repetição: ${customerName} chamado recentemente.`);
    return;
  }

  // Se já estiver falando o mesmo ticket, ignora
  if (isGlobalSpeaking && currentTicketId === ticketId) return;

  // Atualiza timestamp
  callLockMap.set(ticketId, now);

  const promptText = `Atenção: ${customerName}. ${customerName}. Por favor, comparecer ao Atendimento Externo. Seu pedido está pronto.`;

  // Se não houver API KEY, vai direto para a voz nativa
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined' || process.env.API_KEY === '') {
    speakNative(promptText, ticketId, customerName);
    return;
  }

  try {
    // Limpeza de fila nativa antes de tentar Gemini
    window.speechSynthesis.cancel();

    // Criar instância logo antes da chamada para garantir chave atualizada conforme diretrizes
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        // Desabilitar thinking para menor latência em tarefas de voz em tempo real
        thinkingConfig: { thinkingBudget: 0 },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      if (globalAudioContext.state === 'suspended') {
        await globalAudioContext.resume();
      }

      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        globalAudioContext,
        24000,
        1
      );

      const source = globalAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(globalAudioContext.destination);
      
      source.onended = () => {
        isGlobalSpeaking = false;
        currentTicketId = "";
      };

      isGlobalSpeaking = true;
      currentTicketId = ticketId;
      source.start(0);
      console.log("Chamando cliente (Voz Gemini):", customerName);
      
    } else {
      throw new Error("Dados de áudio ausentes na resposta do Gemini");
    }
  } catch (error) {
    console.warn("Gemini TTS falhou, usando fallback nativo:", error);
    speakNative(promptText, ticketId, customerName);
  }
};