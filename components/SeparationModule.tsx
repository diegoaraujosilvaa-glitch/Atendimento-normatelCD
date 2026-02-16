
import React from 'react';
import { Ticket, TicketStatus, Priority } from '../types';

interface SeparationModuleProps {
  tickets: Ticket[];
  onUpdateStatus: (id: string, status: TicketStatus) => void;
  onRemove: (id: string) => void;
}

const SeparationModule: React.FC<SeparationModuleProps> = ({ tickets, onUpdateStatus, onRemove }) => {
  const sortTickets = (list: Ticket[]) => {
    return [...list].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === Priority.PRIORITY ? -1 : 1;
      return new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime();
    });
  };

  const waiting = sortTickets(tickets.filter(t => t.status === TicketStatus.WAITING_SEPARATION));
  const inProgress = sortTickets(tickets.filter(t => t.status === TicketStatus.IN_SEPARATION));
  const ready = sortTickets(tickets.filter(t => t.status === TicketStatus.READY));
  const called = sortTickets(tickets.filter(t => t.status === TicketStatus.CALLED));

  const handleCall = (ticket: Ticket) => {
    // Apenas atualiza o status. O Painel TV (CustomerDashboard) detectará a mudança e falará.
    onUpdateStatus(ticket.id, TicketStatus.CALLED);
  };

  const handleFinish = (id: string) => {
    onUpdateStatus(id, TicketStatus.FINISHED);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ETAPA 1: SEPARAÇÃO */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[700px]">
          <div className="bg-[#1a1a1a] p-4 flex justify-between items-center border-b-4 border-[#e67324]">
            <h3 className="font-black text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-boxes-packing text-[#e67324]"></i> 1. SEPARAÇÃO
            </h3>
            <span className="bg-[#e67324] text-white text-[10px] px-3 py-1 rounded-full font-black">
              {waiting.length + inProgress.length}
            </span>
          </div>
          
          <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-gray-50/30">
            {inProgress.map(ticket => (
              <div key={ticket.id} className="bg-orange-50 border-2 border-[#e67324] rounded-2xl p-4 relative shadow-sm">
                <div className="flex justify-between items-start mb-2">
                   <h4 className="font-black text-lg text-gray-900 tracking-tighter uppercase truncate pr-16">{ticket.customerName}</h4>
                   <span className="absolute top-4 right-4 text-[8px] bg-[#e67324] text-white px-2 py-1 rounded font-black">EM ANDAMENTO</span>
                </div>
                <div className="space-y-1 mb-4">
                  <p className="text-[10px] font-bold text-gray-400">{ticket.password} • #{ticket.orderNumber}</p>
                  <p className="text-[9px] font-black text-[#e67324] uppercase tracking-wider">
                    <i className="fas fa-user-tag mr-1"></i> {ticket.clientType} • <i className="fas fa-truck mr-1"></i> {ticket.vehicleType}
                  </p>
                </div>
                <button onClick={() => onUpdateStatus(ticket.id, TicketStatus.READY)} className="w-full bg-[#1a1a1a] hover:bg-[#e67324] text-white py-3 rounded-xl font-black transition-all uppercase text-[10px] tracking-widest">
                  CONCLUIR SEPARAÇÃO
                </button>
              </div>
            ))}

            {waiting.map(ticket => (
              <div key={ticket.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-[#e67324] transition-all group shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-black text-base text-gray-800 tracking-tighter uppercase">{ticket.customerName}</h4>
                  {ticket.priority === Priority.PRIORITY && (
                    <span className="text-[8px] bg-red-600 text-white px-2 py-0.5 rounded font-black">PRIO</span>
                  )}
                </div>
                <div className="mb-3">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{ticket.password} • {ticket.clientType}</p>
                  <p className="text-[8px] font-black text-gray-500 uppercase mt-0.5"><i className="fas fa-truck-pickup mr-1"></i> {ticket.vehicleType}</p>
                </div>
                <button onClick={() => onUpdateStatus(ticket.id, TicketStatus.IN_SEPARATION)} className="w-full border-2 border-[#1a1a1a] text-[#1a1a1a] group-hover:bg-[#1a1a1a] group-hover:text-white py-2 rounded-xl font-black transition-all uppercase text-[9px] tracking-widest">
                  INICIAR SEPARAÇÃO
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ETAPA 2: CHAMADA */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[700px]">
          <div className="bg-[#1a1a1a] p-4 flex justify-between items-center border-b-4 border-amber-500">
            <h3 className="font-black text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-microphone text-amber-500"></i> 2. CHAMADA
            </h3>
            <span className="bg-amber-500 text-white text-[10px] px-3 py-1 rounded-full font-black">
              {ready.length}
            </span>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-amber-50/10">
            {ready.map(ticket => (
              <div key={ticket.id} className="bg-white border-2 border-amber-200 rounded-2xl p-4 shadow-sm">
                <div className="mb-4">
                  <h4 className="font-black text-lg text-amber-900 tracking-tighter uppercase leading-none mb-1">{ticket.customerName}</h4>
                  <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">{ticket.password} • #{ticket.orderNumber}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded uppercase">{ticket.clientType}</span>
                    <span className="bg-gray-100 text-gray-600 text-[8px] font-black px-2 py-0.5 rounded uppercase"><i className="fas fa-truck mr-1"></i> {ticket.vehicleType}</span>
                  </div>
                </div>
                <button onClick={() => handleCall(ticket)} className="w-full bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-black shadow-lg transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest">
                  <i className="fas fa-bullhorn"></i> CHAMAR AGORA
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ETAPA 3: ATENDIMENTO / FINALIZAR */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[700px]">
          <div className="bg-[#1a1a1a] p-4 flex justify-between items-center border-b-4 border-emerald-500">
            <h3 className="font-black text-white text-[10px] uppercase tracking-widest flex items-center gap-2">
              <i className="fas fa-user-check text-emerald-500"></i> 3. ATENDIMENTO
            </h3>
            <span className="bg-emerald-500 text-white text-[10px] px-3 py-1 rounded-full font-black">
              {called.length}
            </span>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-emerald-50/10">
            {called.map(ticket => (
              <div key={ticket.id} className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 shadow-sm animate-pulse">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-black text-lg text-emerald-900 tracking-tighter uppercase leading-none mb-1">{ticket.customerName}</h4>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">
                      {ticket.password} • Chamado às {ticket.callTime ? new Date(ticket.callTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-black text-emerald-700 uppercase">{ticket.clientType}</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-[9px] font-black text-gray-500 uppercase"><i className="fas fa-truck mr-1"></i> {ticket.vehicleType}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={() => handleCall(ticket)} className="bg-white text-emerald-600 border border-emerald-200 py-2 rounded-lg font-bold text-[9px] uppercase hover:bg-emerald-100 transition-all">
                      RECHAMAR
                   </button>
                   <button onClick={() => handleFinish(ticket.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-black shadow-md transition-all uppercase text-[9px] tracking-widest">
                      FINALIZAR
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Histórico Geral de Hoje (Resumo) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b">
           <h3 className="font-black text-[10px] text-gray-500 uppercase tracking-widest">GERENCIAMENTO TOTAL DA DATA</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-white border-b text-gray-400 font-black uppercase">
              <tr>
                <th className="px-6 py-4">Senha</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Tipo / Veículo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.filter(t => t.status !== TicketStatus.FINISHED).map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-black text-gray-900">{t.password}</td>
                  <td className="px-6 py-4 font-medium uppercase">{t.customerName}</td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-500">{t.clientType}</p>
                    <p className="text-[9px] text-gray-400 uppercase">{t.vehicleType}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-500">{t.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => { if(confirm("Remover atendimento?")) onRemove(t.id) }} className="text-gray-300 hover:text-red-500 transition-colors">
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SeparationModule;
