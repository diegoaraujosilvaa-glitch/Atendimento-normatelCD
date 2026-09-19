
import React, { useState } from 'react';
import { Ticket, TicketStatus, Priority } from '../types';

interface SeparationModuleProps {
  tickets: Ticket[];
  onUpdateStatus: (id: string, status: TicketStatus, reason?: string) => void;
  onRemove: (id: string) => void;
}

const CANCELLATION_REASONS = [
  'Desistência por demora no atendimento',
  'Cliente não pôde aguardar mais tempo',
  'Cliente foi embora sem retirar mercadoria',
  'Erro de cadastro / duplicidade de senha',
  'Outro motivo'
];

const SeparationModule: React.FC<SeparationModuleProps> = ({ tickets, onUpdateStatus, onRemove }) => {
  const [cancellingTicket, setCancellingTicket] = useState<Ticket | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [tableFilter, setTableFilter] = useState<'active' | 'cancelled' | 'finished' | 'all'>('active');

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
  const cancelledTickets = tickets.filter(t => t.status === TicketStatus.CANCELLED);
  const finishedTickets = tickets.filter(t => t.status === TicketStatus.FINISHED);

  const handleCall = (ticket: Ticket) => {
    // Apenas atualiza o status. O Painel TV (CustomerDashboard) detectará a mudança e falará.
    onUpdateStatus(ticket.id, TicketStatus.CALLED);
  };

  const handleFinish = (id: string) => {
    onUpdateStatus(id, TicketStatus.FINISHED);
  };

  const openCancelModal = (ticket: Ticket) => {
    setCancellingTicket(ticket);
    setSelectedReason(CANCELLATION_REASONS[0]);
    setCustomReason('');
  };

  const confirmCancellation = () => {
    if (!cancellingTicket) return;
    const finalReason = selectedReason === 'Outro motivo' 
      ? (customReason.trim() || 'Desistência do cliente (motivo não especificado)')
      : selectedReason;

    onUpdateStatus(cancellingTicket.id, TicketStatus.CANCELLED, finalReason);
    setCancellingTicket(null);
  };

  // Filtragem da tabela inferior
  const filteredTableTickets = tickets.filter(t => {
    if (tableFilter === 'active') return t.status !== TicketStatus.FINISHED && t.status !== TicketStatus.CANCELLED;
    if (tableFilter === 'cancelled') return t.status === TicketStatus.CANCELLED;
    if (tableFilter === 'finished') return t.status === TicketStatus.FINISHED;
    return true; // 'all'
  });

  return (
    <div className="space-y-8 animate-fadeIn relative">
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
                  {ticket.collectorName && (
                    <div className="mt-1 bg-[#e67324]/10 text-[#e67324] px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 w-max animate-pulse">
                      <i className="fas fa-id-card"></i> COLETADOR: {ticket.collectorName}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onUpdateStatus(ticket.id, TicketStatus.READY)} className="flex-1 bg-[#1a1a1a] hover:bg-[#e67324] text-white py-3 rounded-xl font-black transition-all uppercase text-[10px] tracking-widest shadow-md">
                    CONCLUIR SEPARAÇÃO
                  </button>
                  <button 
                    onClick={() => openCancelModal(ticket)} 
                    title="Cancelar fluxo por desistência"
                    className="px-3 bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-xl transition-all flex items-center justify-center"
                  >
                    <i className="fas fa-ban text-xs"></i>
                  </button>
                </div>
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
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {ticket.password} • #{ticket.orderNumber}
                  </p>
                  <p className="text-[9px] font-black text-[#e67324] uppercase tracking-wider mt-1">
                    <i className="fas fa-user-tag mr-1"></i> {ticket.clientType} • <i className="fas fa-truck mr-1"></i> {ticket.vehicleType}
                  </p>
                  {ticket.collectorName && (
                    <div className="mt-2 bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 w-max">
                      <i className="fas fa-id-card"></i> COLETADOR: {ticket.collectorName}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onUpdateStatus(ticket.id, TicketStatus.IN_SEPARATION)} className="flex-1 border-2 border-[#1a1a1a] text-[#1a1a1a] group-hover:bg-[#1a1a1a] group-hover:text-white py-2 rounded-xl font-black transition-all uppercase text-[9px] tracking-widest">
                    INICIAR SEPARAÇÃO
                  </button>
                  <button 
                    onClick={() => openCancelModal(ticket)} 
                    title="Cancelar fluxo por desistência"
                    className="px-3 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-xl transition-all flex items-center justify-center"
                  >
                    <i className="fas fa-ban text-xs"></i>
                  </button>
                </div>
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
                    <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded uppercase">
                      {ticket.clientType}
                    </span>
                    <span className="bg-gray-100 text-gray-600 text-[8px] font-black px-2 py-0.5 rounded uppercase"><i className="fas fa-truck mr-1"></i> {ticket.vehicleType}</span>
                  </div>
                  {ticket.collectorName && (
                    <div className="mt-2 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 w-max">
                      <i className="fas fa-id-card text-amber-600"></i> COLETADOR: {ticket.collectorName}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleCall(ticket)} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-xl font-black shadow-lg transition-all flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest">
                    <i className="fas fa-bullhorn"></i> CHAMAR AGORA
                  </button>
                  <button 
                    onClick={() => openCancelModal(ticket)} 
                    title="Cancelar fluxo por desistência"
                    className="px-3 bg-amber-50 hover:bg-red-50 text-amber-700 hover:text-red-600 border border-amber-200 hover:border-red-200 rounded-xl transition-all flex items-center justify-center"
                  >
                    <i className="fas fa-ban text-xs"></i>
                  </button>
                </div>
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
                      {ticket.password} • #{ticket.orderNumber} • Chamado às {ticket.callTime ? new Date(ticket.callTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 mb-2">
                      <span className="text-[9px] font-black text-emerald-700 uppercase">
                        {ticket.clientType}
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="text-[9px] font-black text-gray-500 uppercase"><i className="fas fa-truck mr-1"></i> {ticket.vehicleType}</span>
                    </div>
                    {ticket.collectorName && (
                      <div className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 w-max">
                        <i className="fas fa-id-card text-emerald-700"></i> COLETADOR: {ticket.collectorName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                   <button onClick={() => handleCall(ticket)} className="bg-white text-emerald-600 border border-emerald-200 py-2 rounded-lg font-bold text-[9px] uppercase hover:bg-emerald-100 transition-all">
                      RECHAMAR
                   </button>
                   <button onClick={() => handleFinish(ticket.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-black shadow-md transition-all uppercase text-[9px] tracking-widest">
                      FINALIZAR
                   </button>
                   <button onClick={() => openCancelModal(ticket)} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2 rounded-lg font-bold text-[9px] uppercase transition-all flex items-center justify-center gap-1" title="Cliente desistiu">
                      <i className="fas fa-ban"></i> CANCELAR
                   </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Histórico Geral de Hoje (Resumo com Abas de Filtragem) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 p-4 border-b flex flex-wrap justify-between items-center gap-4">
           <div>
             <h3 className="font-black text-xs text-gray-700 uppercase tracking-wider flex items-center gap-2">
               <i className="fas fa-clipboard-list text-[#e67324]"></i> GERENCIAMENTO DE ATENDIMENTOS DO DIA
             </h3>
             <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Visão consolidada da operação</p>
           </div>
           
           {/* Abas de filtro */}
           <div className="flex bg-gray-200/80 p-1 rounded-xl text-[10px] font-bold">
             <button
               onClick={() => setTableFilter('active')}
               className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'active' ? 'bg-white text-gray-900 shadow-sm font-black' : 'text-gray-500 hover:text-gray-900'}`}
             >
               EM FILA ({waiting.length + inProgress.length + ready.length + called.length})
             </button>
             <button
               onClick={() => setTableFilter('cancelled')}
               className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'cancelled' ? 'bg-red-500 text-white shadow-sm font-black' : 'text-gray-500 hover:text-red-600'}`}
             >
               CANCELADOS / DESISTÊNCIAS ({cancelledTickets.length})
             </button>
             <button
               onClick={() => setTableFilter('finished')}
               className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'finished' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-gray-500 hover:text-emerald-700'}`}
             >
               CONCLUÍDOS ({finishedTickets.length})
             </button>
             <button
               onClick={() => setTableFilter('all')}
               className={`px-3 py-1.5 rounded-lg transition-all ${tableFilter === 'all' ? 'bg-gray-900 text-white shadow-sm font-black' : 'text-gray-500 hover:text-gray-900'}`}
             >
               TODOS ({tickets.length})
             </button>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-white border-b text-gray-400 font-black uppercase">
              <tr>
                <th className="px-6 py-4">Senha</th>
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">Tipo / Veículo</th>
                <th className="px-6 py-4">Status & Detalhes</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTableTickets.length > 0 ? (
                filteredTableTickets.map(t => {
                  const isCancelled = t.status === TicketStatus.CANCELLED;
                  const isFinished = t.status === TicketStatus.FINISHED;
                  return (
                    <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${isCancelled ? 'bg-red-50/30' : ''}`}>
                      <td className="px-6 py-4 font-black">
                        <span className={isCancelled ? 'text-red-700 line-through' : 'text-gray-900'}>{t.password}</span>
                        <div className="text-[10px] text-gray-400 font-bold mt-0.5">#{t.orderNumber}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`font-extrabold uppercase ${isCancelled ? 'text-red-800' : 'text-gray-900'}`}>{t.customerName}</div>
                        {t.collectorName && (
                          <div className="text-[10px] text-[#e67324] font-black mt-1 uppercase flex items-center gap-1">
                            <i className="fas fa-id-card"></i> Coletor: {t.collectorName}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-orange-50 text-[#e67324] text-[9px] font-black px-2 py-0.5 rounded border border-orange-100 uppercase inline-block mb-1">
                          {t.clientType}
                        </span>
                        <p className="text-[9px] text-gray-400 uppercase font-bold"><i className="fas fa-truck mr-1"></i> {t.vehicleType}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                            isCancelled 
                              ? 'bg-red-100 text-red-700 border border-red-200' 
                              : isFinished 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {t.status}
                          </span>
                          {isCancelled && t.cancelReason && (
                            <p className="text-[9px] text-red-600 font-bold mt-1 flex items-center gap-1">
                              <i className="fas fa-info-circle"></i> {t.cancelReason}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {!isCancelled && !isFinished && (
                          <button 
                            onClick={() => openCancelModal(t)} 
                            className="text-red-600 hover:text-red-800 font-bold text-[10px] px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors uppercase inline-flex items-center gap-1"
                            title="Registrar desistência/cancelamento"
                          >
                            <i className="fas fa-ban"></i> Cancelar
                          </button>
                        )}
                        <button 
                          onClick={() => { if(confirm("Atenção: Excluir apagará o registro completamente do banco de dados. Para clientes que desistiram, prefira usar 'Cancelar'. Deseja realmente excluir definitivamente?")) onRemove(t.id) }} 
                          className="text-gray-300 hover:text-red-500 transition-colors p-1"
                          title="Excluir definitivamente do banco"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold text-xs uppercase tracking-wider">
                    Nenhum atendimento nesta visualização.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cancelamento / Registro de Desistência */}
      {cancellingTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-lg font-black">
                <i className="fas fa-ban"></i>
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-900">Cancelar Atendimento</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Registrar desistência no relatório</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4 border border-gray-100">
              <div className="flex justify-between items-center mb-1">
                <span className="font-black text-sm text-gray-900">{cancellingTicket.customerName}</span>
                <span className="text-xs font-black text-[#e67324]">{cancellingTicket.password}</span>
              </div>
              <p className="text-[11px] text-gray-500 font-bold">Pedido #{cancellingTicket.orderNumber} • Chegada às {new Date(cancellingTicket.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            <div className="space-y-3 mb-6">
              <label className="text-[11px] font-black uppercase text-gray-700 block">
                Motivo da Desistência / Cancelamento:
              </label>
              <div className="space-y-2">
                {CANCELLATION_REASONS.map(reason => (
                  <label 
                    key={reason} 
                    className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      selectedReason === reason 
                        ? 'border-red-500 bg-red-50/50 text-red-900 font-black' 
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="cancel_reason" 
                      checked={selectedReason === reason} 
                      onChange={() => setSelectedReason(reason)}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {selectedReason === 'Outro motivo' && (
                <input 
                  type="text"
                  placeholder="Especifique o motivo do cancelamento..."
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  className="w-full p-3 border-2 border-red-300 rounded-xl outline-none text-xs font-bold focus:border-red-500 uppercase mt-2"
                />
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-[10px] text-amber-800 font-bold flex items-start gap-2">
              <i className="fas fa-info-circle text-amber-600 mt-0.5"></i>
              <span>O cliente será removido do painel da TV e da fila de separação, mas o histórico e o motivo ficarão registrados nos relatórios.</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setCancellingTicket(null)}
                className="py-3 px-4 rounded-xl border-2 border-gray-200 text-gray-700 hover:bg-gray-100 font-black uppercase text-xs transition-all"
              >
                Voltar
              </button>
              <button 
                onClick={confirmCancellation}
                className="py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <i className="fas fa-ban"></i> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SeparationModule;
