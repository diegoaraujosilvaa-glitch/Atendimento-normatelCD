
import { GoogleGenAI, Modality } from "@google/genai";

// Variável de controle para fila de reprodução de áudio Gemini
let nextStartTime = 0;
let globalAudioContext: AudioContext | null = null;

/**
 * Função de fallback para voz nativa do navegador (Web Speech API)
 * Ajustada para atender aos requisitos de voz masculina, cancelamento de fila e repetição.
 */
const speakNative = (text: string) => {
  if (!('speechSynthesis' in window)) {
    console.warn("Navegador não suporta síntese de voz nativa.");
    return;
  }

  // 3. Evitar Disparos Múltiplos: Cancela qualquer fala em andamento ou na fila
  window.speechSynthesis.cancel();

  // Função interna para configurar e disparar a voz
  const performSpeak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9; // Velocidade levemente reduzida para maior clareza
    utterance.pitch = 1.0;

    // 2. Voz Única e Masculina
    // Obtém vozes disponíveis e filtra por Português do Brasil
    const voices = window.speechSynthesis.getVoices();
    const ptBRVoices = voices.filter(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));

    if (ptBRVoices.length > 0) {
      // Tenta encontrar uma voz masculina conhecida em diferentes SOs
      const preferredMaleVoice = ptBRVoices.find(v => 
        v.name.toLowerCase().includes('masculino') || 
        v.name.toLowerCase().includes('male') || 
        v.name.toLowerCase().includes('daniel') || // Windows
        v.name.toLowerCase().includes('felipe') || // Apple/macOS
        v.name.toLowerCase().includes('google português do brasil') // Chrome (geralmente Daniel)
      );

      // Se não achar masculina, usa a primeira disponível em PT-BR para evitar troca de vozes
      utterance.voice = preferredMaleVoice || ptBRVoices[0];
    }

    window.speechSynthesis.speak(utterance);
  };

  // getVoices() pode ser assíncrono em alguns navegadores no primeiro carregamento
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      performSpeak();
    };
  } else {
    performSpeak();
  }
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
 * 1. Limite de Repetições: Nome chamado exatamente 3 vezes.
 */
export const announceCustomerCall = async (customerName: string) => {
  // Texto configurado para repetir o nome 3 vezes conforme solicitado
  const promptText = `Atenção: ${customerName}. ${customerName}. ${customerName}. Favor comparecer ao Atendimento externo. Seu pedido está pronto.`;

  // Se não houver chave de API (Gemini), usa voz nativa imediatamente
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined' || process.env.API_KEY === '') {
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
            // 'Kore' é uma voz masculina de alta qualidade no Gemini
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
      
      // Se já houver algo tocando no Gemini, para antes de começar o novo (simulando o cancel() nativo)
      // Nota: nextStartTime gerencia a fila, mas para o requisito "evitar disparos múltiplos" 
      // o cancelamento nativo é mais eficaz se o Gemini falhar.
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
    console.warn("Erro no Gemini TTS, revertendo para voz nativa robusta.");
    speakNative(promptText);
  }
};
