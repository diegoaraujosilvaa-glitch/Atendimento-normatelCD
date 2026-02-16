
import { GoogleGenAI, Modality } from "@google/genai";

// Controle de execução singleton
let isSpeaking = false;
let currentCustomerCalling = "";
let globalAudioContext: AudioContext | null = null;

/**
 * Seleciona rigorosamente uma voz masculina em português
 */
const getPreferredMaleVoice = (): SpeechSynthesisVoice | null => {
  const voices = window.speechSynthesis.getVoices();
  const ptBRVoices = voices.filter(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
  
  if (ptBRVoices.length === 0) return null;

  // Busca por nomes conhecidos de vozes masculinas ou tags específicas
  return ptBRVoices.find(v => 
    v.name.toLowerCase().includes('masculino') || 
    v.name.toLowerCase().includes('male') || 
    v.name.toLowerCase().includes('daniel') || 
    v.name.toLowerCase().includes('felipe') ||
    v.name.toLowerCase().includes('google português do brasil')
  ) || ptBRVoices[0];
};

/**
 * Função de fallback nativa com trava de singleton e cancelamento total
 */
const speakNative = (text: string, customerId: string) => {
  if (!('speechSynthesis' in window)) return;

  // 3. Limpeza de Fila (Reset Total)
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.85; // Cadência mais pausada e profissional
  utterance.pitch = 1.0;

  const maleVoice = getPreferredMaleVoice();
  if (maleVoice) {
    utterance.voice = maleVoice;
  }

  utterance.onstart = () => {
    isSpeaking = true;
    currentCustomerCalling = customerId;
  };

  utterance.onend = () => {
    isSpeaking = false;
    currentCustomerCalling = "";
  };

  utterance.onerror = () => {
    isSpeaking = false;
    currentCustomerCalling = "";
  };

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
 * Requisitos: Limite de 2 nomes, singleton por cliente, cancelamento de fila.
 */
export const announceCustomerCall = async (customerName: string, ticketId: string) => {
  // 2. Trava de Execução (Singleton): Ignora se já estiver chamando este mesmo cliente
  if (isSpeaking && currentCustomerCalling === ticketId) {
    console.log(`Chamada já em curso para: ${customerName}. Ignorando duplicata.`);
    return;
  }

  // 1. Limite Estrito de 2 Vezes: Texto configurado para falar o nome exatamente 2 vezes
  const promptText = `Atenção: ${customerName}. ${customerName}. Por favor, comparecer ao atendimento externo. Seu pedido está pronto.`;

  // Fallback imediato se não houver API KEY ou se for fallback nativo forçado
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined' || process.env.API_KEY === '') {
    speakNative(promptText, ticketId);
    return;
  }

  try {
    // Interrompe qualquer áudio Gemini anterior antes de gerar novo
    if (globalAudioContext && globalAudioContext.state !== 'closed') {
      window.speechSynthesis.cancel(); // Limpa nativo também por segurança
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore é masculina e estável
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
        isSpeaking = false;
        currentCustomerCalling = "";
      };

      isSpeaking = true;
      currentCustomerCalling = ticketId;
      source.start(0);
      
    } else {
      throw new Error("Voz Gemini indisponível");
    }
  } catch (error) {
    speakNative(promptText, ticketId);
  }
};
