
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Ticket, TicketStatus, Priority } from '../types';
import { announceCustomerCall } from '../services/geminiService';

interface CustomerDashboardProps {
  tickets: Ticket[];
}

const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ tickets = [] }) => {
  const [lastCalled, setLastCalled] = useState<Ticket | null>(null);
  const [blink, setBlink] = useState(false);
  
  // Referência para rastrear quais eventos de chamada (ID + Timestamp) já foram processados
  // Isso evita que o sistema re-anuncie o mesmo ticket se a lista de tickets atualizar por outros motivos.
  const processedEventsRef = useRef<Set<string>>(new Set());
  
  // Fila de anúncios para garantir que, se vários forem chamados ao mesmo tempo, todos sejam falados em ordem
  const [announcementQueue, setAnnouncementQueue] = useState<Ticket[]>([]);
  const isAnnouncingRef = useRef(false);

  useEffect(() => {
    if (!tickets || tickets.length === 0) return;

    // 1. Identifica tickets em status CALLED
    const currentlyCalled = tickets.filter(t => t.status === TicketStatus.CALLED && t.callTime);
    
    const newAnnouncements: Ticket[] = [];

    currentlyCalled.forEach(ticket => {
      const eventId = `${ticket.id}-${new Date(ticket.callTime!).getTime()}`;
      
      // Se este evento específico (Ticket + Hora da Chamada) ainda não foi processado
      if (!processedEventsRef.current.has(eventId)) {
        processedEventsRef.current.add(eventId);
        newAnnouncements.push(ticket);
      }
    });

    if (newAnnouncements.length > 0) {
      // Ordena os novos acionamentos pelo tempo de chamada
      newAnnouncements.sort((a, b) => new Date(a.callTime!).getTime() - new Date(b.callTime!).getTime());
      setAnnouncementQueue(prev => [...prev, ...newAnnouncements]);
    }
  }, [tickets]);

  // Processador da fila de anúncios
  useEffect(() => {
    const processQueue = async () => {
      if (announcementQueue.length === 0 || isAnnouncingRef.current) return;

      isAnnouncingRef.current = true;
      const nextTicket = announcementQueue[0];

      // Atualiza o visual
      setLastCalled(nextTicket);
      setBlink(true);

      // Dispara a voz (que faz as 2 chamadas internamente)
      await announceCustomerCall(nextTicket.customerName, nextTicket.password, nextTicket.id);

      // Mantém o blink por mais alguns segundos após a voz terminar
      setTimeout(() => {
        setBlink(false);
        setAnnouncementQueue(prev => prev.slice(1));
        isAnnouncingRef.current = false;
      }, 3000);
    };

    processQueue();
  }, [announcementQueue]);

  const ready = useMemo(() => tickets.filter(t => t.status === TicketStatus.READY), [tickets]);
  const inSeparation = useMemo(() => tickets.filter(t => t.status === TicketStatus.IN_SEPARATION), [tickets]);
  const waiting = useMemo(() => tickets.filter(t => t.status === TicketStatus.WAITING_SEPARATION), [tickets]);

  const avgWaitTime = useMemo(() => {
    const finishedTickets = tickets.filter(t => t.status === TicketStatus.FINISHED && t.arrivalTime && t.finishTime);
    if (finishedTickets.length === 0) return 0;
    
    const totalMs = finishedTickets.reduce((acc, t) => {
      return acc + (new Date(t.finishTime!).getTime() - new Date(t.arrivalTime).getTime());
    }, 0);
    
    return Math.round(totalMs / finishedTickets.length / 1000 / 60);
  }, [tickets]);

  return (
    <div className="flex flex-col gap-8 min-h-[80vh] animate-fadeIn relative">
      
      {/* Última Chamada - Destaque Principal */}
      <div className={`transition-all duration-700 rounded-[2.5rem] p-12 text-center shadow-2xl relative overflow-hidden border-[12px] ${blink ? 'bg-[#e67324] border-white scale-[1.01]' : 'bg-[#1a1a1a] border-[#e67324]'}`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full -ml-48 -mb-48 pointer-events-none"></div>
        
        <div className="flex flex-col items-center justify-center relative z-10">
          <h2 className={`text-2xl font-black uppercase tracking-[0.4em] mb-8 transition-colors ${blink ? 'text-white' : 'text-[#e67324]'}`}>
            {blink ? '🔔 CHAMANDO AGORA' : 'ÚLTIMA CHAMADA'}
          </h2>
          
          {lastCalled ? (
            <div className="space-y-6">
              <p className={`text-7xl md:text-9xl font-black text-white tracking-tighter uppercase transition-all duration-300 ${blink ? 'scale-110' : 'scale-100'}`}>
                {lastCalled.customerName}
              </p>
              <div className="inline-flex items-center gap-4 bg-white text-[#1a1a1a] px-12 py-5 rounded-3xl text-4xl font-black shadow-2xl border-b-8 border-gray-200">
                <span className="text-gray-400 text-sm uppercase tracking-widest mr-2">SENHA</span>
                <span className="text-[#e67324]">{lastCalled.password}</span>
              </div>
              {blink && (
                <div className="mt-8 flex items-center justify-center gap-4">
                   <div className="h-1.5 w-12 bg-white/50 rounded-full animate-pulse"></div>
                   <p className="text-white font-black animate-pulse text-2xl uppercase tracking-widest">Favor dirigir-se ao Atendimento</p>
                   <div className="h-1.5 w-12 bg-white/50 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16">
              <p className="text-4xl font-medium text-white/20 italic tracking-[0.2em] uppercase">Aguardando novo atendimento...</p>
            </div>
          )}
        </div>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-[#e67324] flex items-center gap-6">
              <div className="text-[#e67324] text-4xl opacity-30"><i className="fas fa-clock"></i></div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tempo Médio</p>
                  <p className="text-3xl font-black text-[#1a1a1a] leading-none mt-1">{avgWaitTime} <span className="text-sm font-bold text-gray-400">min</span></p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-amber-500 flex items-center gap-6">
              <div className="text-amber-500 text-4xl opacity-30"><i className="fas fa-hourglass-half"></i></div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Em Espera</p>
                  <p className="text-3xl font-black text-[#1a1a1a] leading-none mt-1">{waiting.length + inSeparation.length}</p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border-l-8 border-emerald-500 flex items-center gap-6">
              <div className="text-emerald-500 text-4xl opacity-30"><i className="fas fa-check-circle"></i></div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prontos</p>
                  <p className="text-3xl font-black text-[#1a1a1a] leading-none mt-1">{ready.length}</p>
              </div>
          </div>
          <div className="bg-[#1a1a1a] p-6 rounded-3xl shadow-sm border-l-8 border-[#e67324] flex items-center gap-6 text-white">
              <div className="text-[#e67324] text-4xl opacity-30"><i className="fas fa-user-check"></i></div>
              <div>
                  <p className="text-[10px] font-black text-[#e67324] uppercase tracking-widest">Concluídos</p>
                  <p className="text-3xl font-black leading-none mt-1">{tickets.filter(t => t.status === TicketStatus.FINISHED).length}</p>
              </div>
          </div>
      </div>

      {/* Listas de Acompanhamento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white rounded-[2rem] shadow-xl p-8 border-b-[12px] border-emerald-500 flex flex-col h-[550px]">
          <h3 className="text-xl font-black text-emerald-600 mb-8 border-b-2 border-emerald-50 pb-4 flex justify-between items-center">
            <span className="tracking-tighter">RETIRADA DISPONÍVEL</span>
            <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full">{ready.length}</span>
          </h3>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {ready.map(t => (
              <div key={t.id} className="bg-emerald-50 p-6 rounded-[1.5rem] flex justify-between items-center animate-slideUp border border-emerald-100 shadow-sm hover:scale-[1.02] transition-transform">
                <div className="flex-1">
                  <p className="font-black text-2xl text-emerald-900 tracking-tighter leading-none mb-2 uppercase">{t.customerName}</p>
                  <p className="text-sm font-bold text-emerald-600 uppercase tracking-[0.2em]">{t.password}</p>
                </div>
                <div className="bg-white w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-500 shadow-inner">
                  <i className="fas fa-box-check text-xl"></i>
                </div>
              </div>
            ))}
            {ready.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50">
                <i className="fas fa-boxes-packing text-6xl mb-4"></i>
                <p className="font-bold italic uppercase tracking-widest text-center">Nenhum pedido pronto para retirada</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl p-8 border-b-[12px] border-amber-500 flex flex-col h-[550px]">
          <h3 className="text-xl font-black text-amber-600 mb-8 border-b-2 border-amber-50 pb-4 flex justify-between items-center">
            <span className="tracking-tighter">PEDIDO EM SEPARAÇÃO</span>
            <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full">{inSeparation.length}</span>
          </h3>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {inSeparation.map(t => (
              <div key={t.id} className="bg-amber-50 p-6 rounded-[1.5rem] flex justify-between items-center border border-amber-100 hover:scale-[1.02] transition-transform">
                <div className="flex-1">
                  <p className="font-black text-xl text-amber-900 tracking-tighter leading-none mb-2 uppercase">{t.customerName}</p>
                  <p className="text-sm font-bold text-amber-600 uppercase tracking-[0.2em]">{t.password}</p>
                </div>
                <i className="fas fa-spinner-third fa-spin text-amber-300 text-2xl"></i>
              </div>
            ))}
            {inSeparation.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50">
                <i className="fas fa-conveyor-belt text-6xl mb-4"></i>
                <p className="font-bold italic uppercase tracking-widest text-center">Nenhuma separação ativa no momento</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-[2rem] shadow-xl p-8 border-b-[12px] border-[#e67324] flex flex-col h-[550px]">
          <h3 className="text-xl font-black text-[#e67324] mb-8 border-b-2 border-white/5 pb-4 flex justify-between items-center">
            <span className="tracking-tighter">AGUARDANDO LOGÍSTICA</span>
            <span className="bg-[#e67324]/20 text-[#e67324] text-xs px-3 py-1 rounded-full">{waiting.length}</span>
          </h3>
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {waiting.map(t => (
              <div key={t.id} className="bg-white/5 p-6 rounded-[1.5rem] flex justify-between items-center border border-white/5 hover:bg-white/10 transition-colors">
                <div className="flex-1">
                  <p className="font-black text-xl text-white tracking-tighter leading-none mb-2 uppercase">{t.customerName}</p>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-[0.2em]">{t.password}</p>
                </div>
                {t.priority === Priority.PRIORITY && (
                  <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </div>
                )}
              </div>
            ))}
            {waiting.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-700">
                <i className="fas fa-clock text-6xl mb-4 opacity-10"></i>
                <p className="font-bold italic uppercase tracking-widest text-center opacity-40">A fila de espera está vazia</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
