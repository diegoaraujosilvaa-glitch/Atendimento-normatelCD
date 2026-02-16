
import { GoogleGenAI, Modality } from "@google/genai";

/**
 * SERVIÇO DE VOZ GEMINI 2.5 FLASH TTS
 * Sistema profissional de síntese de voz com qualidade de estúdio.
 */

let audioContext: AudioContext | null = null;
let isGlobalSpeaking = false;
const callLockMap = new Map<string, number>();

/**
 * Implementação manual de decodificação Base64 conforme diretrizes do SDK.
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodificação de áudio PCM (16-bit, Little Endian) para o AudioContext.
 * Segue rigorosamente o exemplo de decodificação de áudio PCM das diretrizes do SDK.
 */
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
 * Realiza uma única síntese de voz via API Gemini.
 */
const speakWithGemini = async (text: string): Promise<void> => {
  try {
    // A chave de API deve ser obtida exclusivamente de process.env.API_KEY conforme as diretrizes.
    // Inicializamos uma nova instância de GoogleGenAI imediatamente antes da chamada.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Chamada ao modelo gemini-2.5-flash-preview-tts seguindo as diretrizes de geração de áudio.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, 
          },
        },
      },
    });

    // Extração do áudio base64 diretamente da parte inlineData conforme as diretrizes do SDK.
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("Nenhum dado de áudio retornado pelo Gemini.");
    }

    const bytes = decode(base64Audio);
    const audioBuffer = await decodeAudioData(bytes, audioContext, 24000, 1);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    
    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start();
    });

  } catch (error) {
    console.error("[GEMINI-TTS] Falha na síntese de voz:", error);
  }
};

/**
 * Anuncia a chamada do cliente.
 */
export const announceCustomerCall = async (customerName: string, password: string, ticketId: string) => {
  const now = Date.now();
  const lastCallTime = callLockMap.get(ticketId) || 0;

  if (isGlobalSpeaking || (now - lastCallTime < 4000)) {
    return;
  }

  isGlobalSpeaking = true;
  callLockMap.set(ticketId, now);

  try {
    const passwordForVoice = password.split('').join(' ');
    const fullName = customerName.toUpperCase();

    // Sequência de anúncios para garantir que o cliente ouça a senha.
    await speakWithGemini(`Atenção: Senha ${passwordForVoice}. ${fullName}.`);
    await new Promise(r => setTimeout(r, 1500));
    await speakWithGemini(`Repetindo: Senha ${passwordForVoice}. ${fullName}. Favor comparecer ao atendimento externo.`);

  } catch (error) {
    console.error("[VOZ] Erro na sequência de anúncios:", error);
  } finally {
    isGlobalSpeaking = false;
  }
};
