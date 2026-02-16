
import { GoogleGenAI, Modality } from "@google/genai";

// Controle de execução e estado global para evitar chamadas sobrepostas ou infinitas
let isGlobalSpeaking = false;
let currentTicketId = "";
const callLockMap = new Map<string, number>(); // ID do Ticket -> Timestamp da última chamada realizada
let globalAudioContext: AudioContext | null = null;

/**
 * Seleciona rigorosamente uma voz feminina em português disponível no navegador.
 */
const getPortugueseFemaleVoice = (): SpeechSynthesisVoice | null => {
  if (!('speechSynthesis' in window)) return null;
  
  const voices = window.speechSynthesis.getVoices();
  const ptBRVoices = voices.filter(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
  
  if (ptBRVoices.length === 0) return null;

  // Tenta encontrar uma voz feminina filtrando palavras-chave masculinas conhecidas
  const femaleVoices = ptBRVoices.filter(v => 
    !v.name.toLowerCase().includes('masculino') && 
    !v.name.toLowerCase().includes('male') &&
    !v.name.toLowerCase().includes('daniel') &&
    !v.name.toLowerCase().includes('felipe') &&
    !v.name.toLowerCase().includes('google português do brasil') // Geralmente é Daniel/Masculino
  );

  // Retorna a primeira voz feminina ou a primeira PT-BR disponível (Maria, Heloísa, etc)
  return femaleVoices.length > 0 ? femaleVoices[0] : ptBRVoices[0];
};

/**
 * Função de síntese nativa simplificada para usar voz feminina padrão do navegador.
 */
const speakNative = (text: string, ticketId: string, customerName: string) => {
  if (!('speechSynthesis' in window)) return;

  // Interrompe qualquer fala anterior pendente para garantir a clareza
  window.speechSynthesis.cancel();

  const voice = getPortugueseFemaleVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  
  if (voice) {
    utterance.voice = voice;
  }
  
  utterance.lang = 'pt-BR';
  utterance.rate = 0.95; // Velocidade natural e profissional para atendimento
  utterance.pitch = 1.0;

  console.log("Chamando cliente no Painel TV (Voz Feminina):", customerName);

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
 * Anuncia a chamada do cliente no Painel TV.
 * Requisitos: Voz feminina e exatamente 2 repetições do nome.
 */
export const announceCustomerCall = async (customerName: string, ticketId: string) => {
  const now = Date.now();
  const lastCallTime = callLockMap.get(ticketId) || 0;

  // Trava de 10 segundos para evitar disparos em loop por re-render do componente
  if (now - lastCallTime < 10000) {
    return;
  }

  // Singleton: se já estiver chamando este ticket, ignora o comando duplicado
  if (isGlobalSpeaking && currentTicketId === ticketId) return;

  callLockMap.set(ticketId, now);

  // Texto com exatamente 2 repetições do nome do cliente conforme solicitado
  const promptText = `Atenção: ${customerName}. ${customerName}. Por favor, comparecer ao Atendimento Externo. Seu pedido está pronto.`;

  // Se não houver chave de API, usa voz nativa feminina do navegador (Prioridade de conformidade)
  if (!process.env.API_KEY || process.env.API_KEY === 'undefined' || process.env.API_KEY === '') {
    speakNative(promptText, ticketId, customerName);
    return;
  }

  try {
    // Interrompe sínteses nativas antes de disparar Gemini para não sobrepor áudios
    window.speechSynthesis.cancel();

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            // Zephyr é utilizada para tentar manter um perfil mais feminino/neutro no Gemini TTS
            prebuiltVoiceConfig: { voiceName: 'Zephyr' }, 
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (base64Audio) {
      if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || (window as