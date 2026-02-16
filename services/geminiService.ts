
import { GoogleGenAI, Modality } from "@google/genai";

// Variável de controle para fila de reprodução de áudio
let nextStartTime = 0;
let globalAudioContext: AudioContext | null = null;

// Função de fallback para voz nativa do navegador (Web Speech API)
const speakNative = (text: string) => {
  if (!('speechSynthesis' in window)) {
    console.warn("Navegador não suporta síntese de voz nativa.");
    return;
  }
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  
  // Tentar encontrar uma voz masculina/feminina de qualidade em PT-BR
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.lang.includes('pt-BR') && v.name.includes('Google')) || 
                        voices.find(v => v.lang.includes('pt-BR'));
  
  if (preferredVoice) utterance.voice = preferredVoice;
  
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

export const announceCustomerCall = async (customerName: string) => {
  const promptText = `Atenção: ${customerName}, seu pedido está pronto. Favor comparecer ao Atendimento externo. Repetindo: ${customerName}, ao Atendimento externo por favor.`;

  // Se não houver chave de API, usa voz nativa imediatamente
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined') {
    console.log("Usando voz nativa (Sem API Key).");
    speakNative(promptText);
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

      const currentTime = globalAudioContext.currentTime;
      nextStartTime = Math.max(nextStartTime, currentTime);

      const source = globalAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(globalAudioContext.destination);
      source.start(nextStartTime);
      nextStartTime += audioBuffer.duration;
      
      console.log(`Anúncio agendado via Gemini: ${customerName}`);
    } else {
      throw new Error("Sem dados de áudio na resposta");
    }
  } catch (error) {
    console.error("Erro no Gemini TTS, tentando voz nativa:", error);
    speakNative(promptText);
  }
};
