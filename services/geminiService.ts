
/**
 * SERVIÇO DE VOZ NATIVO (REPLACING GEMINI TTS)
 * Focado em estabilidade, voz feminina e eliminação de conflitos de áudio.
 */

// Estado global para controle de chamadas
let isGlobalSpeaking = false;
let currentTicketId = "";
const callLockMap = new Map<string, number>();

/**
 * Busca rigorosa por uma voz feminina em português (pt-BR) no navegador.
 * Filtra nomes masculinos e prioriza nomes femininos comuns.
 */
const getPortugueseFemaleVoice = (): SpeechSynthesisVoice | null => {
  if (!('speechSynthesis' in window)) return null;
  
  const voices = window.speechSynthesis.getVoices();
  const ptBRVoices = voices.filter(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR'));
  
  if (ptBRVoices.length === 0) return null;

  // 1. Prioridade para nomes de vozes reconhecidamente femininas
  const femaleNames = ['Maria', 'Heloisa', 'Luciana', 'Francisca', 'Vitoria', 'Yara', 'Zira', 'Helena', 'Joana'];
  const femaleByPriority = ptBRVoices.find(v => 
    femaleNames.some(name => v.name.toLowerCase().includes(name.toLowerCase()))
  );
  if (femaleByPriority) return femaleByPriority;

  // 2. Filtro por exclusão de termos masculinos conhecidos
  const femaleByExclusion = ptBRVoices.filter(v => 
    !v.name.toLowerCase().includes('masculino') && 
    !v.name.toLowerCase().includes('male') &&
    !v.name.toLowerCase().includes('daniel') &&
    !v.name.toLowerCase().includes('felipe') &&
    !v.name.toLowerCase().includes('google português do brasil')
  );

  return femaleByExclusion.length > 0 ? femaleByExclusion[0] : ptBRVoices[0];
};

/**
 * Cria e configura uma instância de SpeechSynthesisUtterance.
 */
const createUtterance = (text: string, onEnd: () => void): SpeechSynthesisUtterance => {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = getPortugueseFemaleVoice();
  
  if (voice) utterance.voice = voice;
  utterance.lang = 'pt-BR';
  utterance.rate = 0.85; // Velocidade levemente reduzida para clareza
  utterance.pitch = 1.0;

  utterance.onend = () => {
    onEnd();
  };
  
  utterance.onerror = () => {
    onEnd();
  };

  return utterance;
};

/**
 * Anuncia a chamada do cliente no Painel TV usando síntese nativa.
 * Realiza 2 chamadas do nome com intervalo de 500ms.
 */
export const announceCustomerCall = async (customerName: string, ticketId: string) => {
  if (!('speechSynthesis' in window)) {
    console.error("Navegador não suporta síntese de voz.");
    return;
  }

  const now = Date.now();
  const lastCallTime = callLockMap.get(ticketId) || 0;

  // Prevenção de chamadas duplicadas (lock de 10 segundos)
  if (now - lastCallTime < 10000) return;
  if (isGlobalSpeaking && currentTicketId === ticketId) return;

  // Cancela qualquer áudio pendente imediatamente
  window.speechSynthesis.cancel();

  callLockMap.set(ticketId, now);
  isGlobalSpeaking = true;
  currentTicketId = ticketId;

  const cleanUp = () => {
    isGlobalSpeaking = false;
    currentTicketId = "";
  };

  // Primeira Chamada (Apenas o nome)
  const firstUtterance = createUtterance(`Atenção: ${customerName}.`, () => {
    // Intervalo de 500ms entre as chamadas conforme solicitado
    setTimeout(() => {
      // Segunda Chamada (Nome + Instrução)
      const secondUtterance = createUtterance(`${customerName}. Por favor, comparecer ao Atendimento Externo. Seu pedido está pronto.`, () => {
        cleanUp();
        // Limpeza final de segurança
        window.speechSynthesis.cancel();
      });
      
      window.speechSynthesis.speak(secondUtterance);
    }, 500);
  });

  window.speechSynthesis.speak(firstUtterance);
  console.log(`[VOZ NATIVA] Chamando cliente: ${customerName}`);
};
