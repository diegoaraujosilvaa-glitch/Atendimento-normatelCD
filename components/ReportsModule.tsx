
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { Ticket, TicketStatus } from '../types';

const ReportsModule: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FINISHED' | 'CANCELLED' | 'PENDING'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Busca dados do Firebase sempre que o período mudar
  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const ticketsRef = collection(db, "tickets");
        
        // Consulta baseada no range de datas (strings YYYY-MM-DD)
        const q = query(
          ticketsRef,
          where("sessionDate", ">=", dateRange.start),
          where("sessionDate", "<=", dateRange.end)
        );

        const querySnapshot = await getDocs(q);
        const results: Ticket[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          
          // Helper para converter Timestamps do Firestore para Date do JS
          const parsedData = { ...data };
          Object.keys(parsedData).forEach(key => {
            if (parsedData[key] instanceof Timestamp) {
              parsedData[key] = parsedData[key].toDate();
            }
          });

          results.push({
            ...parsedData,
            id: doc.id
          } as Ticket);
        });

        // Ordenação client-side para garantir ordem cronológica reversa
        const sortedResults = results.sort((a, b) => {
          const timeA = new Date(a.arrivalTime).getTime();
          const timeB = new Date(b.arrivalTime).getTime();
          return timeB - timeA;
        });

        setAllTickets(sortedResults);
      } catch (error) {
        console.error("Erro ao buscar histórico no Firebase:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [dateRange]);

  const stats = useMemo(() => {
    const total = allTickets.length;
    const finishedTickets = allTickets.filter(t => t.status === TicketStatus.FINISHED);
    const cancelledTickets = allTickets.filter(t => t.status === TicketStatus.CANCELLED);
    
    const finished = finishedTickets.length;
    const cancelled = cancelledTickets.length;
    
    // Tempo médio de espera dos concluídos
    const totalWaitTime = finishedTickets.reduce((acc, t) => {
      if (t.arrivalTime && t.finishTime) {
        return acc + (new Date(t.finishTime).getTime() - new Date(t.arrivalTime).getTime());
      }
      return acc;
    }, 0);
    const avgWait = finished > 0 ? Math.round(totalWaitTime / finished / 1000 / 60) : 0;

    // Tempo médio até o cliente desistir / cancelar
    const totalCancelWaitTime = cancelledTickets.reduce((acc, t) => {
      const endTime = t.cancelTime || t.finishTime;
      if (t.arrivalTime && endTime) {
        return acc + (new Date(endTime).getTime() - new Date(t.arrivalTime).getTime());
      }
      return acc;
    }, 0);
    const avgCancelWait = cancelled > 0 ? Math.round(totalCancelWaitTime / cancelled / 1000 / 60) : 0;

    const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    return { total, finished, cancelled, avgWait, avgCancelWait, cancellationRate };
  }, [allTickets]);

  const formatTime = (date?: Date | string) => {
    if (!date) return "--:--";
    const d = new Date(date);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = (start: Date | string, end?: Date | string) => {
    if (!start || !end) return "-";
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diffMs = e - s;
    const diffMins = Math.floor(diffMs / 1000 / 60);
    return `${diffMins} min`;
  };

  const filteredTickets = useMemo(() => {
    return allTickets.filter(t => {
      // Filtro de status
      if (statusFilter === 'FINISHED' && t.status !== TicketStatus.FINISHED) return false;
      if (statusFilter === 'CANCELLED' && t.status !== TicketStatus.CANCELLED) return false;
      if (statusFilter === 'PENDING' && (t.status === TicketStatus.FINISHED || t.status === TicketStatus.CANCELLED)) return false;

      // Filtro de busca por nome ou número do pedido ou senha
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = t.customerName?.toLowerCase().includes(term);
        const matchOrder = t.orderNumber?.toLowerCase().includes(term);
        const matchPass = t.password?.toLowerCase().includes(term);
        const matchCollector = t.collectorName?.toLowerCase().includes(term);
        if (!matchName && !matchOrder && !matchPass && !matchCollector) return false;
      }

      return true;
    });
  }, [allTickets, statusFilter, searchTerm]);

  // Exportar relatório em CSV com suporte ao Excel
  const exportToCSV = () => {
    if (filteredTickets.length === 0) {
      alert("Nenhum registro para exportar.");
      return;
    }

    const headers = [
      "Data",
      "Senha",
      "Pedido",
      "Cliente",
      "Coletador",
      "Tipo Cliente",
      "Veiculo",
      "Entrada",
      "Termino/Cancelamento",
      "Duracao (min)",
      "Status",
      "Motivo Cancelamento"
    ];

    const rows = filteredTickets.map(t => {
      const endTime = t.status === TicketStatus.CANCELLED ? (t.cancelTime || t.finishTime) : t.finishTime;
      const duration = t.arrivalTime && endTime 
        ? Math.floor((new Date(endTime).getTime() - new Date(t.arrivalTime).getTime()) / 60000) 
        : "";

      return [
        `"${(t as any).sessionDate || ''}"`,
        `"${t.password}"`,
        `"${t.orderNumber}"`,
        `"${t.customerName?.replace(/"/g, '""') || ''}"`,
        `"${t.collectorName?.replace(/"/g, '""') || ''}"`,
        `"${t.clientType || ''}"`,
        `"${t.vehicleType || ''}"`,
        `"${formatTime(t.arrivalTime)}"`,
        `"${formatTime(endTime)}"`,
        `"${duration}"`,
        `"${t.status}"`,
        `"${(t.cancelReason || '').replace(/"/g, '""')}"`
      ].join(";");
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_atendimentos_${dateRange.start}_a_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 text-gray-900">
              <i className="fas fa-chart-pie text-[#e67324]"></i> RELATÓRIOS E HISTÓRICO GERENCIAL
            </h2>
            <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5">
              Acompanhamento de atendimentos, desistências e produtividade
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isLoading && (
              <div className="flex items-center gap-2 text-[#e67324] font-bold text-xs uppercase animate-pulse">
                <i className="fas fa-circle-notch fa-spin"></i> Sincronizando Nuvem...
              </div>
            )}
            <button
              onClick={exportToCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow transition-all flex items-center gap-2 uppercase tracking-wider"
              title="Baixar planilha CSV compatível com Excel"
            >
              <i className="fas fa-file-csv text-sm"></i> Exportar CSV
            </button>
          </div>
        </div>
        
        {/* Controles de Período e Pesquisa */}
        <div className="flex flex-wrap gap-4 items-end mb-8 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-gray-500">Início do Período</label>
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#e67324] font-bold text-sm bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-gray-500">Fim do Período</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#e67324] font-bold text-sm bg-white"
            />
          </div>
          <div className="flex-1 min-w-[200px] flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-gray-500">Buscar por Cliente / Pedido / Senha</label>
            <div className="relative">
              <input 
                type="text"
                placeholder="Ex: João, 12345, N-001..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 pl-8 border rounded-lg outline-none focus:ring-2 focus:ring-[#e67324] font-bold text-sm bg-white"
              />
              <i className="fas fa-search text-gray-400 absolute left-2.5 top-3 text-xs"></i>
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
                  <i className="fas fa-times-circle text-xs"></i>
                </button>
              )}
            </div>
          </div>
          <button 
            onClick={() => setDateRange({...dateRange})} // Força refresh se necessário
            className="bg-[#1a1a1a] text-white px-4 py-2.5 rounded-lg text-[10px] font-black uppercase hover:bg-[#e67324] transition-all flex items-center gap-1.5"
          >
            <i className="fas fa-rotate"></i> Atualizar
          </button>
        </div>

        {/* 4 Cards de Métricas Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card Total */}
          <div className="bg-[#1a1a1a] text-white p-6 rounded-2xl flex justify-between items-center shadow-lg border-b-4 border-[#e67324]">
            <div>
              <p className="text-[10px] font-black uppercase text-[#e67324]">Total Atendimentos</p>
              <p className="text-3xl font-black tracking-tight">{stats.total}</p>
              <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Cadastrados no período</p>
            </div>
            <i className="fas fa-users text-white/10 text-4xl"></i>
          </div>

          {/* Card Concluídos */}
          <div className="bg-white border p-6 rounded-2xl flex justify-between items-center shadow-sm border-b-4 border-emerald-500">
            <div>
              <p className="text-[10px] font-black uppercase text-emerald-600">Atendimentos Concluídos</p>
              <p className="text-3xl font-black text-emerald-600 tracking-tight">{stats.finished}</p>
              <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">
                {stats.total > 0 ? `${Math.round((stats.finished / stats.total) * 100)}% de taxa de conclusão` : 'Sem dados'}
              </p>
            </div>
            <i className="fas fa-check-double text-emerald-100 text-4xl"></i>
          </div>

          {/* Card Cancelados / Desistências */}
          <div className="bg-white border p-6 rounded-2xl flex justify-between items-center shadow-sm border-b-4 border-red-500">
            <div>
              <p className="text-[10px] font-black uppercase text-red-600">Cancelamentos / Desistências</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black text-red-600 tracking-tight">{stats.cancelled}</p>
                {stats.total > 0 && (
                  <span className="text-xs font-black text-red-500">({stats.cancellationRate}%)</span>
                )}
              </div>
              <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">
                {stats.cancelled > 0 ? `Espera média até desistir: ${stats.avgCancelWait} min` : 'Nenhuma desistência'}
              </p>
            </div>
            <i className="fas fa-user-slash text-red-100 text-4xl"></i>
          </div>

          {/* Card Tempo Médio Concluídos */}
          <div className="bg-white border p-6 rounded-2xl flex justify-between items-center shadow-sm border-b-4 border-amber-500">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">Tempo Médio Atendimento</p>
              <p className="text-3xl font-black text-[#e67324] tracking-tight">{stats.avgWait} min</p>
              <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Média dos concluídos</p>
            </div>
            <i className="fas fa-stopwatch text-amber-100 text-4xl"></i>
          </div>
        </div>

        {/* Abas de Filtragem da Lista */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex bg-gray-100 p-1 rounded-xl text-[10px] font-black">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'ALL' ? 'bg-white text-gray-900 shadow font-black' : 'text-gray-500 hover:text-gray-900'}`}
            >
              TODOS OS REGISTROS ({allTickets.length})
            </button>
            <button
              onClick={() => setStatusFilter('FINISHED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'FINISHED' ? 'bg-emerald-600 text-white shadow font-black' : 'text-gray-500 hover:text-emerald-700'}`}
            >
              CONCLUÍDOS ({stats.finished})
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'CANCELLED' ? 'bg-red-600 text-white shadow font-black' : 'text-gray-500 hover:text-red-700'}`}
            >
              CANCELADOS / DESISTÊNCIAS ({stats.cancelled})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'PENDING' ? 'bg-amber-600 text-white shadow font-black' : 'text-gray-500 hover:text-amber-700'}`}
            >
              EM ABERTO / FILA ({allTickets.length - stats.finished - stats.cancelled})
            </button>
          </div>

          <span className="text-[11px] font-bold text-gray-400">
            Exibindo {filteredTickets.length} de {allTickets.length} registros
          </span>
        </div>

        {/* Tabela de Histórico */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1a1a1a] text-white font-black uppercase text-[10px]">
              <tr>
                <th className="px-4 py-4 border-r border-white/10">Data</th>
                <th className="px-4 py-4">Senha</th>
                <th className="px-4 py-4">Pedido</th>
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Tipo / Veículo</th>
                <th className="px-4 py-4">Entrada</th>
                <th className="px-4 py-4">Término / Saída</th>
                <th className="px-4 py-4">Duração</th>
                <th className="px-4 py-4">Status & Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-[#e67324] mb-4"></i>
                    <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">Consultando Nuvem...</p>
                  </td>
                </tr>
              ) : filteredTickets.length > 0 ? (
                filteredTickets.map((t, idx) => {
                  const isCancelled = t.status === TicketStatus.CANCELLED;
                  const isFinished = t.status === TicketStatus.FINISHED;
                  const endTime = isCancelled ? (t.cancelTime || t.finishTime) : t.finishTime;

                  return (
                    <tr 
                      key={idx} 
                      className={`hover:bg-orange-50/40 transition-colors ${
                        isCancelled ? 'bg-red-50/30' : isFinished ? 'text-gray-800' : 'text-gray-500 italic'
                      }`}
                    >
                      <td className="px-4 py-4 font-mono text-[11px] border-r font-bold text-gray-700">
                        {(t as any).sessionDate}
                      </td>
                      <td className="px-4 py-4 font-black">
                        <span className={isCancelled ? 'text-red-700 line-through' : 'text-gray-900'}>
                          {t.password}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-bold text-gray-600">#{t.orderNumber}</td>
                      <td className="px-4 py-4 font-bold uppercase text-[12px]">
                        <span className={isCancelled ? 'text-red-900' : 'text-gray-900'}>{t.customerName}</span>
                        {t.collectorName && (
                          <div className="text-[10px] text-[#e67324] font-black mt-0.5 uppercase flex items-center gap-1">
                            <i className="fas fa-id-card"></i> Coletor: {t.collectorName}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-[11px] font-bold text-gray-500 uppercase">
                        <span className="bg-orange-50 text-[#e67324] text-[9px] font-black px-1.5 py-0.5 rounded border border-orange-100 inline-block mb-1">
                          {t.clientType}
                        </span>
                        <div className="text-[9px] text-gray-400 uppercase font-bold">
                          <i className="fas fa-truck mr-1"></i> {t.vehicleType}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-[12px]">{formatTime(t.arrivalTime)}</td>
                      <td className="px-4 py-4 font-mono text-[12px]">{formatTime(endTime)}</td>
                      <td className="px-4 py-4 font-black">
                        <span className={isCancelled ? 'text-red-600' : 'text-[#e67324]'}>
                          {calculateDuration(t.arrivalTime, endTime)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded inline-block ${
                            isCancelled 
                              ? 'bg-red-100 text-red-700 border border-red-200' 
                              : isFinished 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {t.status}
                          </span>
                          {isCancelled && t.cancelReason && (
                            <div className="text-[10px] text-red-600 font-bold mt-1 flex items-start gap-1 max-w-[220px]">
                              <i className="fas fa-ban mt-0.5 text-xs text-red-500"></i>
                              <span>{t.cancelReason}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest bg-gray-50">
                    Nenhum dado encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsModule;
