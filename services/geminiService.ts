
import { GoogleGenAI, Modality } from "@google/genai";

// Estado global para controle de voz
let isGlobalSpeaking = false;
let lastAnnouncedTicketId = "";
const callLockMap = new Map<string, number>();

/**
 * Decodificação de áudio PCM (16-bit) conforme diretrizes do SDK.
 */
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
 * Fallback para voz nativa do navegador (Voz feminina PT-BR).
 */
const speakNative = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();
  const ptVoice = voices.find(v => v.lang.includes('pt-BR')) || voices[0];
  
  if (ptVoice) utterance.voice = ptVoice;
  utterance.lang = 'pt-BR';
  utterance.rate = 0.9;
  
  utterance.onstart = () => { isGlobalSpeaking = true; };
  utterance.onend = () => { isGlobalSpeaking = false; };
  
  window.speechSynthesis.speak(utterance);
};

/**
 * Anuncia a chamada do cliente usando Gemini TTS com fallback nativo.
 */
export const announceCustomerCall = async (customerName: string, ticketId: string) => {
  const now = Date.now();
  const lastCallTime = callLockMap.get(ticketId) || 0;

  // Bloqueio de 10 segundos para o mesmo ticket para evitar repetições por sync do Firestore
  if (now - lastCallTime < 10000) return;
  
  // Evita sobreposição de falas
  if (isGlobalSpeaking) return;

  callLockMap.set(ticketId, now);
  lastAnnouncedTicketId = ticketId;

  const promptText = `Atenção: ${customerName}. ${customerName}. Por favor, comparecer ao Atendimento Externo. Seu pedido está pronto.`;

  // Tenta usar Gemini 2.5 Flash TTS
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key ausente");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      
      source.onstart = () => { isGlobalSpeaking = true; };
      source.onended = () => { isGlobalSpeaking = false; };
      
      source.start(0);
      console.log(`[VOZ] Chamando: ${customerName}`);
    } else {
      speakNative(promptText);
    }
  } catch (error) {
    console.warn("[VOZ] Usando fallback nativo devido a erro no Gemini API.");
    speakNative(promptText);
  }
};
