
import React, { useState, useMemo } from 'react';
import { Ticket, TicketStatus } from '../types';

const ReportsModule: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const allTickets = useMemo(() => {
    const start = new Date(dateRange.start + "T00:00:00");
    const end = new Date(dateRange.end + "T23:59:59");
    const tickets: (Ticket & { sessionDate: string })[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('normatel_tickets_')) {
        const dateStr = key.replace('normatel_tickets_', '');
        const currentDate = new Date(dateStr + "T00:00:00");
        
        if (currentDate >= start && currentDate <= end) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            data.forEach((t: any) => tickets.push({ ...t, sessionDate: dateStr }));
          } catch (e) {}
        }
      }
    }
    
    // Organiza do mais recente para o mais antigo (Decrescente por arrivalTime)
    return tickets.sort((a, b) => {
      const timeA = new Date(a.arrivalTime).getTime();
      const timeB = new Date(b.arrivalTime).getTime();
      return timeB - timeA;
    });
  }, [dateRange]);

  const stats = useMemo(() => {
    const total = allTickets.length;
    const finished = allTickets.filter(t => t.status === TicketStatus.FINISHED).length;
    
    const totalWaitTime = allTickets.reduce((acc, t) => {
      if (t.arrivalTime && t.finishTime) {
        return acc + (new Date(t.finishTime).getTime() - new Date(t.arrivalTime).getTime());
      }
      return acc;
    }, 0);

    const avgWait = finished > 0 ? Math.round(totalWaitTime / finished / 1000 / 60) : 0;

    return { total, finished, avgWait };
  }, [allTickets]);

  const formatTime = (date?: Date | string) => {
    if (!date) return "--:--";
    const d = new Date(date);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const calculateDuration = (start: Date | string, end?: Date | string) => {
    if (!start || !end) return "-";
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const diffMs = e - s;
    const diffMins = Math.floor(diffMs / 1000 / 60);
    return `${diffMins} min`;
  };

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-black mb-6 flex items-center gap-2">
          <i className="fas fa-chart-pie text-[#e67324]"></i> RELATÓRIOS E HISTÓRICO
        </h2>
        
        <div className="flex flex-wrap gap-4 items-end mb-8 bg-gray-50 p-4 rounded-xl">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-gray-500">Início do Período</label>
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#e67324] font-bold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-gray-500">Fim do Período</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#e67324] font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1a1a1a] text-white p-6 rounded-2xl flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black uppercase text-[#e67324]">Total Atendimentos</p>
              <p className="text-3xl font-black">{stats.total}</p>
            </div>
            <i className="fas fa-users text-white/10 text-4xl"></i>
          </div>
          <div className="bg-white border p-6 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">Tempo Médio Total</p>
              <p className="text-3xl font-black text-[#e67324]">{stats.avgWait} min</p>
            </div>
            <i className="fas fa-stopwatch text-gray-100 text-4xl"></i>
          </div>
          <div className="bg-white border p-6 rounded-2xl flex justify-between items-center shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400">Atendimentos Concluídos</p>
              <p className="text-3xl font-black text-emerald-600">{stats.finished}</p>
            </div>
            <i className="fas fa-check-double text-emerald-100 text-4xl"></i>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1a1a1a] text-white font-bold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 border-r border-white/10">Data</th>
                <th className="px-4 py-3">Senha</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Início</th>
                <th className="px-4 py-3">Término</th>
                <th className="px-4 py-3">Duração</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allTickets.map((t, idx) => (
                <tr key={idx} className={`hover:bg-orange-50 transition-colors ${t.status === TicketStatus.FINISHED ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                  <td className="px-4 py-4 font-mono text-[11px] border-r">{t.sessionDate}</td>
                  <td className="px-4 py-4 font-black">{t.password}</td>
                  <td className="px-4 py-4 font-medium uppercase text-[12px]">{t.customerName}</td>
                  <td className="px-4 py-4 text-[11px] font-bold text-gray-500 uppercase">{t.clientType}</td>
                  <td className="px-4 py-4 font-mono text-[12px]">{formatTime(t.arrivalTime)}</td>
                  <td className="px-4 py-4 font-mono text-[12px]">{formatTime(t.finishTime)}</td>
                  <td className="px-4 py-4 font-black text-[#e67324]">{calculateDuration(t.arrivalTime, t.finishTime)}</td>
                  <td className="px-4 py-4">
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${
                        t.status === TicketStatus.FINISHED ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                        {t.status}
                    </span>
                  </td>
                </tr>
              ))}
              {allTickets.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest bg-gray-50">Nenhum dado encontrado no período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportsModule;
