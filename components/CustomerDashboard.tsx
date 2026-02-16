
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Ticket, TicketStatus, Priority } from '../types';
import { announceCustomerCall } from '../services/geminiService';

interface CustomerDashboardProps {
  tickets: Ticket[];
}

const CustomerDashboard: React.FC<CustomerDashboardProps> = ({ tickets = [] }) => {
  const [lastCalled, setLastCalled] = useState<Ticket | null>(null);
  const [blink, setBlink] = useState(false);
  // 4. Estabilidade do React: Armazena a última data de chamada anunciada para cada ticket ID para evitar re-disparos no re-render
  const announcedTimestampsRef = useRef<Map<string, number>>(new Map());
  
  // Efeito para detectar novos chamados e anunciar via voz
  useEffect(() => {
    if (!tickets || tickets.length === 0) return;

    // Filtra e ordena tickets chamados pelo horário mais recente
    const calledTickets = tickets
      .filter(t => t.status === TicketStatus.CALLED && t.callTime)
      .sort((a, b) => {
        const timeA = new Date(a.callTime!).getTime();
        const timeB = new Date(b.callTime!).getTime();
        return timeB - timeA;
      });
    
    if (calledTickets.length > 0) {
      const mostRecent = calledTickets[0];
      const mostRecentTime = new Date(mostRecent.callTime!).getTime();
      
      // Verifica se é uma chamada nova ou uma rechamada (horário diferente)
      const lastAnnouncedTime = announcedTimestampsRef.current.get(mostRecent.id) || 0;

      // Só dispara se o timestamp de chamada no banco de dados for superior ao último que falamos localmente
      if (mostRecentTime > lastAnnouncedTime) {
        setLastCalled(mostRecent);
        setBlink(true);
        
        // Disparar voz (Fila e cancelamento tratados no serviço)
        announceCustomerCall(mostRecent.customerName);
        
        // Atualiza o ref imediatamente para evitar re-disparo em re-renders paralelos
        announcedTimestampsRef.current.set(mostRecent.id, mostRecentTime);

        const timer = setTimeout(() => setBlink(false), 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [tickets]);

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
      <div className={`transition-all duration-500 rounded-3xl p-12 text-center shadow-2xl relative overflow-hidden border-8 ${blink ? 'bg-[#e67324] border-white scale-[1.02]' : 'bg-[#1a1a1a] border-[#e67324]'}`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full -ml-48 -mb-48 pointer-events-none"></div>
        
        <h2 className="text-2xl font-black text-[#e67324] uppercase tracking-[0.3em] mb-6">ÚLTIMA CHAMADA</h2>
        {lastCalled ? (
          <div className="space-y-4">
            <p className={`text-7xl md:text-9xl font-black text-white tracking-tighter uppercase ${blink ? 'animate-bounce' : ''}`}>
              {lastCalled.customerName}
            </p>
            <div className="inline-block bg-white text-[#1a1a1a] px-10 py-4 rounded-2xl text-3xl font-black shadow-lg">
              SENHA: <span className="text-[#e67324]">{lastCalled.password}</span>
            </div>
            {blink && <div className="text-white font-bold animate-pulse text-xl mt-4 uppercase">POR FAVOR, COMPAREÇA AO ATENDIMENTO</div>}
          </div>
        ) : (
          <p className="text-4xl font-medium text-white/30 italic py-10 tracking-widest">AGUARDANDO CHAMADA...</p>
        )}
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-[#e67324] flex items-center gap-4">
              <div className="text-[#e67324] text-3xl opacity-20"><i className="fas fa-clock"></i></div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Tempo Médio</p>
                  <p className="text-2xl font-black text-[#1a1a1a]">{avgWaitTime} <span className="text-sm">min</span></p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-amber-500 flex items-center gap-4">
              <div className="text-amber-500 text-3xl opacity-20"><i className="fas fa-hourglass-half"></i></div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Em Espera</p>
                  <p className="text-2xl font-black text-[#1a1a1a]">{waiting.length + inSeparation.length}</p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-emerald-500 flex items-center gap-4">
              <div className="text-emerald-500 text-3xl opacity-20"><i className="fas fa-check-circle"></i></div>
              <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase">Prontos</p>
                  <p className="text-2xl font-black text-[#1a1a1a]">{ready.length}</p>
              </div>
          </div>
          <div className="bg-[#1a1a1a] p-6 rounded-2xl shadow-sm border-l-4 border-[#e67324] flex items-center gap-4 text-white">
              <div className="text-[#e67324] text-3xl opacity-20"><i className="fas fa-user-check"></i></div>
              <div>
                  <p className="text-[10px] font-black text-[#e67324] uppercase">Finalizados</p>
                  <p className="text-2xl font-black">{tickets.filter(t => t.status === TicketStatus.FINISHED).length}</p>
              </div>
          </div>
      </div>

      {/* Listas de Acompanhamento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white rounded-3xl shadow-xl p-8 border-b-8 border-emerald-500">
          <h3 className="text-xl font-black text-emerald-600 mb-8 border-b-2 border-emerald-50 pb-4 flex justify-between items-center">
            <span>PRONTOS</span>
            <i className="fas fa-check-double text-emerald-100 text-3xl"></i>
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {ready.map(t => (
              <div key={t.id} className="bg-emerald-50 p-6 rounded-2xl flex justify-between items-center animate-slideUp border border-emerald-100">
                <div className="flex-1">
                  <p className="font-black text-2xl text-emerald-900 tracking-tight leading-none mb-1 uppercase">{t.customerName}</p>
                  <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest">{t.password}</p>
                </div>
                <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center text-emerald-500 shadow-sm">
                  <i className="fas fa-arrow-right"></i>
                </div>
              </div>
            ))}
            {ready.length === 0 && <p className="text-gray-300 text-center py-10 font-bold italic uppercase tracking-widest">Sem pedidos prontos</p>}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8 border-b-8 border-amber-500">
          <h3 className="text-xl font-black text-amber-600 mb-8 border-b-2 border-amber-50 pb-4 flex justify-between items-center">
            <span>EM SEPARAÇÃO</span>
            <i className="fas fa-spinner text-amber-100 text-3xl"></i>
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {inSeparation.map(t => (
              <div key={t.id} className="bg-amber-50 p-6 rounded-2xl flex justify-between items-center border border-amber-100">
                <div className="flex-1">
                  <p className="font-black text-xl text-amber-900 tracking-tight leading-none mb-1 uppercase">{t.customerName}</p>
                  <p className="text-sm font-bold text-amber-600 uppercase tracking-widest">{t.password}</p>
                </div>
                <i className="fas fa-box-open text-amber-200 animate-pulse text-2xl"></i>
              </div>
            ))}
            {inSeparation.length === 0 && <p className="text-gray-300 text-center py-10 font-bold italic uppercase tracking-widest">Sem separações ativas</p>}
          </div>
        </div>

        <div className="bg-[#1a1a1a] rounded-3xl shadow-xl p-8 border-b-8 border-[#e67324]">
          <h3 className="text-xl font-black text-[#e67324] mb-8 border-b-2 border-white/5 pb-4 flex justify-between items-center">
            <span>AGUARDANDO</span>
            <i className="fas fa-clock text-white/5 text-3xl"></i>
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {waiting.map(t => (
              <div key={t.id} className="bg-white/5 p-6 rounded-2xl flex justify-between items-center border border-white/5">
                <div className="flex-1">
                  <p className="font-black text-xl text-white tracking-tight leading-none mb-1 uppercase">{t.customerName}</p>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{t.password}</p>
                </div>
                {t.priority === Priority.PRIORITY && (
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                )}
              </div>
            ))}
            {waiting.length === 0 && <p className="text-gray-600 text-center py-10 font-bold italic uppercase tracking-widest">Fila vazia</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
