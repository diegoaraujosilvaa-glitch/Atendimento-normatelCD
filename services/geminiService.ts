import { GoogleGenAI, Modality } from "@google/genai";

/**
 * SERVIÇO DE ÁUDIO CENTRALIZADO COM GEMINI TTS
 * Utiliza o modelo gemini-2.5-flash-preview-tts para locução profissional.
 */

// Estado global de travamento para evitar chamadas sobrepostas ou disparos múltiplos
let isGlobalSpeaking = false;
const callLockMap = new Map<string, number>();

// Funções de decodificação de áudio (PCM raw do Gemini)
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
 * Anuncia a chamada do cliente usando Gemini TTS.
 * REQUISITOS: 
 * 1. Voz profissional do Gemini.
 * 2. Lock global para evitar duplicidade.
 */
export const announceCustomerCall = async (customerName: string, ticketId: string) => {
  const now = Date.now();
  const lastCallTime = callLockMap.get(ticketId) || 0;

  // Trava de segurança: impede que o mesmo ticket seja chamado em menos de 10 segundos
  if (now - lastCallTime < 10000) return;
  if (isGlobalSpeaking) return;

  isGlobalSpeaking = true;
  callLockMap.set(ticketId, now);

  try {
    // Instancia o Gemini API
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Constrói o texto da chamada com pausa estratégica
    const prompt = `Diga de forma clara e profissional: ${customerName}. [pausa de 1 segundo] ${customerName}, por favor, comparecer ao Atendimento Externo.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore fornece uma voz feminina nítida e profissional
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        outputAudioContext,
        24000,
        1,
      );

      const source = outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(outputAudioContext.destination);
      
      source.onended = () => {
        isGlobalSpeaking = false;
      };

      console.log(`[GEMINI TTS] Chamando: ${customerName}`);
      source.start();
    } else {
      isGlobalSpeaking = false;
    }
  } catch (error) {
    console.error("Erro ao chamar Gemini TTS:", error);
    isGlobalSpeaking = false;
  }
};