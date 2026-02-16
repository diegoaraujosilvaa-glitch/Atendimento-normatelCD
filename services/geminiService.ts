
import { GoogleGenAI, Modality } from "@google/genai";

/**
 * SERVIÇO DE ÁUDIO EXCLUSIVO GEMINI TTS (VOZ MASCULINA)
 * Substitui completamente o speechSynthesis do navegador para evitar duplicidade.
 */

let currentAudioSource: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;
let isGlobalSpeaking = false;
const callLockMap = new Map<string, number>();

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
 * Interrompe qualquer áudio que esteja sendo reproduzido no momento.
 */
export const stopAllAudio = () => {
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
      currentAudioSource.disconnect();
    } catch (e) {
      // Ignora se já estiver parado
    }
    currentAudioSource = null;
  }
  isGlobalSpeaking = false;
};

/**
 * Anuncia a chamada do cliente usando Gemini TTS com Voz Masculina (Puck).
 */
export const announceCustomerCall = async (customerName: string, ticketId: string) => {
  const now = Date.now();
  const lastCallTime = callLockMap.get(ticketId) || 0;

  // Bloqueio de 5 segundos para o mesmo ticket (conforme solicitado para o botão)
  if (now - lastCallTime < 5000) return;
  
  // Interrompe áudio anterior antes de começar o novo
  stopAllAudio();

  isGlobalSpeaking = true;
  callLockMap.set(ticketId, now);

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Prompt configurado para 2 repetições na mesma trilha de áudio
    const promptText = `Atenção: ${customerName}. ${customerName}. Por favor, comparecer ao Atendimento Externo. Seu pedido está pronto.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' }, // Puck é uma voz masculina robusta e clara
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        audioContext,
        24000,
        1,
      );

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      source.onended = () => {
        isGlobalSpeaking = false;
        if (currentAudioSource === source) currentAudioSource = null;
      };

      currentAudioSource = source;
      source.start();
      console.log(`[GEMINI MALE VOICE] Chamando: ${customerName}`);
    } else {
      isGlobalSpeaking = false;
    }
  } catch (error) {
    console.error("Erro no Gemini TTS:", error);
    isGlobalSpeaking = false;
  }
};
