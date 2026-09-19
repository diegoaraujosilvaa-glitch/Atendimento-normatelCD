
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Priority, ClientType, VehicleType, Ticket, TicketStatus } from '../types';
import { ICONS } from '../constants';

interface ReceptionModuleProps {
  onAddTicket: (ticket: Omit<Ticket, 'id' | 'password' | 'arrivalTime' | 'status'>) => void;
  tickets: Ticket[];
}

const ReceptionModule: React.FC<ReceptionModuleProps> = ({ onAddTicket, tickets }) => {
  const [formData, setFormData] = useState(() => {
    try {
      const saved = sessionStorage.getItem('normatel_reception_draft');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return {
      customerName: '',
      collectorName: '',
      priority: Priority.NORMAL,
      clientType: ClientType.CLIENT,
      vehicleType: VehicleType.PASSENGER,
      orderNumber: '',
    };
  });

  // Limite configurável de alerta na Recepção (Padrão: 25 minutos)
  const [alertThresholdMinutes, setAlertThresholdMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('normatel_reception_alert_threshold');
      if (saved) return Number(saved) || 25;
    } catch (e) {}
    return 25;
  });

  // Som suave de notificação de alerta (restrito à recepção)
  const [soundAlertEnabled, setSoundAlertEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('normatel_reception_alert_sound') !== 'false';
    } catch (e) {}
    return true;
  });

  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [showAlertModal, setShowAlertModal] = useState<boolean>(false);
  const warnedTicketsRef = useRef<Set<string>>(new Set());

  // Atualiza relógio local a cada 5 segundos para calcular tempo de espera sem onerar Firebase
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Salva preferências no localStorage e notifica outros módulos
  const handleThresholdChange = (mins: number) => {
    setAlertThresholdMinutes(mins);
    try {
      localStorage.setItem('normatel_reception_alert_threshold', mins.toString());
      window.dispatchEvent(new Event('normatel_threshold_updated'));
    } catch (e) {}
  };

  const handleSoundToggle = (enabled: boolean) => {
    setSoundAlertEnabled(enabled);
    try {
      localStorage.setItem('normatel_reception_alert_sound', enabled.toString());
    } catch (e) {}
  };

  // Toca um chime discreto e agradável para a recepção
  const playAlertChime = () => {
    if (!soundAlertEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Nota 1 (G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, now);
      gain1.gain.setValueAtTime(0.08, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Nota 2 (C6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, now + 0.15);
      gain2.gain.setValueAtTime(0.08, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.warn("Audio Context alerta recepção não pôde ser iniciado:", e);
    }
  };

  useEffect(() => {
    try {
      sessionStorage.setItem('normatel_reception_draft', JSON.stringify(formData));
    } catch (e) {}
  }, [formData]);

  const [isLoading, setIsLoading] = useState(false);

  // Determinar se o nome de quem coleta é obrigatório
  const isCollectorRequired = formData.clientType === ClientType.REPRESENTATIVE || formData.clientType === ClientType.FREIGHT;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.orderNumber) return;
    
    if (isCollectorRequired && !formData.collectorName.trim()) {
      alert("Por favor, preencha o Nome de quem está coletando.");
      return;
    }
    
    setIsLoading(true);
    try {
      await onAddTicket({
        customerName: formData.customerName,
        collectorName: isCollectorRequired ? formData.collectorName.trim() : '',
        priority: formData.priority,
        clientType: formData.clientType,
        vehicleType: formData.vehicleType,
        orderNumber: formData.orderNumber,
      });
      const emptyForm = {
        customerName: '',
        collectorName: '',
        priority: Priority.NORMAL,
        clientType: ClientType.CLIENT,
        vehicleType: VehicleType.PASSENGER,
        orderNumber: '',
      };
      setFormData(emptyForm);
      try {
        sessionStorage.removeItem('normatel_reception_draft');
      } catch (e) {}
    } finally {
      setIsLoading(false);
    }
  };

  // Helper ultra seguro para extrair milissegundos de qualquer formato de data (Date, Timestamp Firestore, string ISO, etc)
  const getArrivalMs = (arrivalTime: any): number => {
    if (!arrivalTime) return 0;
    if (typeof arrivalTime === 'object') {
      if (typeof arrivalTime.toMillis === 'function') return arrivalTime.toMillis();
      if (typeof arrivalTime.toDate === 'function') return arrivalTime.toDate().getTime();
      if (typeof arrivalTime.seconds === 'number') return arrivalTime.seconds * 1000;
    }
    const ms = new Date(arrivalTime).getTime();
    return isNaN(ms) ? 0 : ms;
  };

  // Clientes na fila ativa (Aguardando ou em Separação) que já ultrapassaram o tempo limite de espera configurado
  const overdueTickets = useMemo(() => {
    return tickets
      .filter(t => {
        // Considera clientes aguardando ou em separação que ainda não foram concluídos/cancelados/chamados
        const isPending = t.status === TicketStatus.WAITING_SEPARATION || t.status === TicketStatus.IN_SEPARATION;
        if (!isPending) return false;

        const arrivalMs = getArrivalMs(t.arrivalTime);
        if (arrivalMs <= 0) return false;

        const waitMinutes = Math.floor((currentTime - arrivalMs) / 60000);
        return waitMinutes >= alertThresholdMinutes;
      })
      .map(t => {
        const arrivalMs = getArrivalMs(t.arrivalTime);
        const waitMinutes = Math.floor((currentTime - arrivalMs) / 60000);
        return {
          ...t,
          waitMinutes
        };
      })
      .sort((a, b) => b.waitMinutes - a.waitMinutes);
  }, [tickets, currentTime, alertThresholdMinutes]);

  // Efeito para tocar chime quando novos clientes entrarem na lista de espera excessiva
  useEffect(() => {
    if (overdueTickets.length === 0) return;

    let hasNewOverdue = false;
    overdueTickets.forEach(t => {
      if (!warnedTicketsRef.current.has(t.id)) {
        hasNewOverdue = true;
        warnedTicketsRef.current.add(t.id);
      }
    });

    if (hasNewOverdue) {
      playAlertChime();
    }
  }, [overdueTickets]);

  const recentTickets = useMemo(() => {
    return [...tickets]
      .sort((a, b) => {
        const dateA = getArrivalMs(a.arrivalTime);
        const dateB = getArrivalMs(b.arrivalTime);
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [tickets]);

  // Tempo de espera do cliente aguardando há mais tempo
  const longestWaitingInfo = useMemo(() => {
    const pending = tickets.filter(t => t.status === TicketStatus.WAITING_SEPARATION || t.status === TicketStatus.IN_SEPARATION);
    if (pending.length === 0) return { count: 0, maxMinutes: 0 };

    let maxMinutes = 0;
    pending.forEach(t => {
      const ms = getArrivalMs(t.arrivalTime);
      if (ms > 0) {
        const mins = Math.floor((currentTime - ms) / 60000);
        if (mins > maxMinutes) maxMinutes = mins;
      }
    });

    return { count: pending.length, maxMinutes };
  }, [tickets, currentTime]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* BANNER DE ALERTA OPERACIONAL DE ESPERA EXCESSIVA (APENAS NA RECEPÇÃO - NUNCA NA TV) */}
      {overdueTickets.length > 0 && (
        <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-4 sm:p-5 rounded-2xl shadow-xl border border-red-400 flex flex-wrap items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 text-white flex items-center justify-center text-2xl shrink-0 shadow-inner">
              <i className="fas fa-triangle-exclamation"></i>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white text-red-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Atenção Recepção
                </span>
                <span className="text-xs font-bold text-red-100">
                  Limite de {alertThresholdMinutes} min ultrapassado
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
                {overdueTickets.length === 1 
                  ? `1 cliente aguardando atendimento há mais de ${alertThresholdMinutes} minutos!`
                  : `${overdueTickets.length} clientes aguardando atendimento há mais de ${alertThresholdMinutes} minutos!`}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAlertModal(true)}
              className="bg-white hover:bg-red-50 text-red-700 font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow uppercase tracking-wider flex items-center gap-2"
            >
              <i className="fas fa-list-ul"></i> Ver Detalhes ({overdueTickets.length})
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DOS CLIENTES EM ESPERA EXCESSIVA */}
      {showAlertModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 animate-fadeIn">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center text-lg font-black">
                  <i className="fas fa-clock"></i>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-gray-900">
                    Fila com Espera Excessiva ({'>'} {alertThresholdMinutes} min)
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">
                    Alerta exclusivo da Recepção • Não exibido na TV
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAlertModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {overdueTickets.map(t => (
                <div key={t.id} className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-gray-900 text-sm uppercase">{t.customerName}</span>
                      {t.priority === Priority.PRIORITY && (
                        <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded">PRIO</span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-[#e67324] mt-0.5">
                      Senha: <span className="font-black text-gray-800">{t.password}</span> • Pedido #{t.orderNumber}
                    </p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                      {t.clientType} • {t.vehicleType}
                      {t.collectorName ? ` • Coletador: ${t.collectorName}` : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-xl shadow-xs">
                      {t.waitMinutes} min
                    </span>
                    <p className="text-[9px] font-bold text-red-600 uppercase mt-1">
                      +{t.waitMinutes - alertThresholdMinutes}m acima
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t flex justify-end">
              <button
                onClick={() => setShowAlertModal(false)}
                className="bg-[#1a1a1a] hover:bg-[#e67324] text-white font-black text-xs px-5 py-2.5 rounded-xl uppercase tracking-wider transition-all"
              >
                Entendido / Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GRID PRINCIPAL DE CADASTRO E RESUMO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="bg-orange-50 text-[#e67324] p-4 rounded-2xl">
                {ICONS.RECEPTION}
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">CADASTRAR ATENDIMENTO</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Painel de Recepção • Atendimento Home Center</p>
              </div>
            </div>

            {/* BARRA DE CONFIGURAÇÃO RÁPIDA DE ALERTA DA RECEPÇÃO */}
            <div className="flex flex-wrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-2 shadow-xs">
              <div className="flex items-center gap-1.5 px-2 text-[10px] font-black uppercase text-gray-500" title="Tempo de espera para alertar a recepção">
                <i className={`fas fa-bell ${overdueTickets.length > 0 ? 'text-red-500 animate-bounce' : 'text-[#e67324]'}`}></i>
                <span className="hidden sm:inline">Alerta Espera:</span>
              </div>
              <select
                value={alertThresholdMinutes}
                onChange={e => handleThresholdChange(Number(e.target.value))}
                className="bg-white border border-gray-300 text-gray-800 text-xs font-black rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-[#e67324] transition-colors"
                title="Alterar minutos para alerta de espera excessiva"
              >
                <option value={5}>5 min (Teste)</option>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
                <option value={25}>25 min (Padrão)</option>
                <option value={30}>30 min</option>
                <option value={40}>40 min</option>
              </select>

              <button
                type="button"
                onClick={() => handleSoundToggle(!soundAlertEnabled)}
                className={`p-1.5 rounded-lg text-xs font-black transition-colors ${
                  soundAlertEnabled ? 'bg-orange-100 text-[#e67324]' : 'bg-gray-200 text-gray-400'
                }`}
                title={soundAlertEnabled ? 'Som de alerta ligado' : 'Som de alerta desativado'}
              >
                <i className={`fas ${soundAlertEnabled ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
              </button>

              {longestWaitingInfo.count > 0 && (
                <div 
                  className={`text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0 ${
                    longestWaitingInfo.maxMinutes >= alertThresholdMinutes 
                      ? 'bg-red-100 text-red-700 animate-pulse' 
                      : 'bg-gray-200/70 text-gray-600'
                  }`}
                  title="Tempo do cliente aguardando há mais tempo na fila hoje"
                >
                  <i className="fas fa-hourglass-half"></i>
                  <span>Fila: máx {longestWaitingInfo.maxMinutes} min</span>
                </div>
              )}
            </div>
          </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Nome do Cliente</label>
              <input required type="text" placeholder="Nome Completo" className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#e67324] rounded-xl outline-none transition-all font-bold uppercase" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Número do Pedido</label>
              <input required type="text" placeholder="Ex: 12345" className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#e67324] rounded-xl outline-none transition-all font-bold uppercase" value={formData.orderNumber} onChange={e => setFormData({...formData, orderNumber: e.target.value.toUpperCase()})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Prioridade</label>
              <select className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#e67324] rounded-xl outline-none font-bold cursor-pointer" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as Priority})}>
                <option value={Priority.NORMAL}>Normal</option>
                <option value={Priority.PRIORITY}>Prioritário</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Tipo de Cliente</label>
              <select className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#e67324] rounded-xl outline-none font-bold cursor-pointer" value={formData.clientType} onChange={e => setFormData({...formData, clientType: e.target.value as ClientType})}>
                {Object.values(ClientType).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Veículo</label>
              <select className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#e67324] rounded-xl outline-none font-bold cursor-pointer" value={formData.vehicleType} onChange={e => setFormData({...formData, vehicleType: e.target.value as VehicleType})}>
                {Object.values(VehicleType).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {isCollectorRequired && (
            <div className="space-y-1 p-4 bg-orange-50 border border-orange-200 rounded-2xl animate-fadeIn">
              <label className="text-[10px] font-black uppercase text-[#e67324] ml-1 flex items-center gap-1">
                <i className="fas fa-id-card"></i> Nome de quem está coletando <span className="text-red-500">*</span>
              </label>
              <input 
                required 
                type="text" 
                placeholder="NOME DO COLETADOR / MOTORISTA / REPRESENTANTE" 
                className="w-full p-4 bg-white border-2 border-transparent focus:border-[#e67324] rounded-xl outline-none transition-all font-bold uppercase shadow-sm" 
                value={formData.collectorName} 
                onChange={e => setFormData({...formData, collectorName: e.target.value.toUpperCase()})} 
              />
            </div>
          )}

          <button disabled={isLoading} type="submit" className="w-full bg-[#e67324] hover:bg-[#1a1a1a] text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest text-sm flex items-center justify-center gap-3 disabled:opacity-50">
            {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-ticket"></i>}
            GERAR SENHA EM NUVEM
          </button>
        </form>
      </div>

      <div className="space-y-6">
        <div className="bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl text-white">
          <div className="flex justify-between items-start mb-6">
            <p className="text-[#e67324] text-[10px] font-black uppercase tracking-widest">Ativos Agora na Fila</p>
            <i className="fas fa-cloud text-white/10 text-3xl"></i>
          </div>
          <p className="text-6xl font-black tracking-tighter">
            {tickets.filter(t => t.status !== TicketStatus.FINISHED && t.status !== TicketStatus.CANCELLED).length}
          </p>
          <div className="flex justify-between items-center text-xs text-gray-500 mt-2 font-bold uppercase tracking-widest">
            <span>Aguardando ou em atendimento</span>
            <span className="text-gray-400">Total dia: {tickets.length}</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Atendimentos Recentes</h3>
          <div className="space-y-4">
            {recentTickets.map(ticket => {
              const isCancelled = ticket.status === TicketStatus.CANCELLED;
              const isFinished = ticket.status === TicketStatus.FINISHED;
              const isPending = ticket.status === TicketStatus.WAITING_SEPARATION || ticket.status === TicketStatus.IN_SEPARATION;
              const arrivalMs = getArrivalMs(ticket.arrivalTime);
              const waitMinutes = (isPending && arrivalMs > 0) ? Math.floor((currentTime - arrivalMs) / 60000) : 0;
              const isOverdue = isPending && waitMinutes >= alertThresholdMinutes;

              return (
                <div key={ticket.id} className={`flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 p-2 rounded-xl transition-all ${
                  isOverdue ? 'bg-red-50/80 border-red-200' : ''
                }`}>
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className={`font-black leading-none uppercase text-xs truncate ${isCancelled ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                        {ticket.customerName}
                      </p>
                      {isOverdue && (
                        <span className="text-[8px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded animate-pulse shrink-0">
                          {waitMinutes}m de espera!
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-[#e67324] mt-0.5">
                      {ticket.password} • #{ticket.orderNumber}
                      {ticket.collectorName ? ` • COLETADOR: ${ticket.collectorName}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ticket.priority === Priority.PRIORITY && (
                      <span className="bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded">PRIO</span>
                    )}
                    {isCancelled && (
                      <span className="bg-red-100 text-red-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Cancelado</span>
                    )}
                    {isFinished && (
                      <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded uppercase">Concluído</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ReceptionModule;
