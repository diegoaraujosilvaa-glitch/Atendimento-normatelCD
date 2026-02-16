
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../services/firebaseConfig';
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { Ticket, TicketStatus } from '../types';

const ReportsModule: React.FC = () => {
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black flex items-center gap-2">
            <i className="fas fa-chart-pie text-[#e67324]"></i> RELATÓRIOS E HISTÓRICO
          </h2>
          {isLoading && (
            <div className="flex items-center gap-2 text-[#e67324] font-bold text-xs uppercase animate-pulse">
              <i className="fas fa-circle-notch fa-spin"></i> Sincronizando Cloud...
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap gap-4 items-end mb-8 bg-gray-50 p-4 rounded-xl">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-gray-500">Início do Período</label>
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#e67324] font-bold text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-gray-500">Fim do Período</label>
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="p-2 border rounded-lg outline-none focus:ring-2 focus:ring-[#e67324] font-bold text-sm"
            />
          </div>
          <button 
            onClick={() => setDateRange({...dateRange})} // Força refresh se necessário
            className="bg-[#1a1a1a] text-white px-4 py-2.5 rounded-lg text-[10px] font-black uppercase hover:bg-[#e67324] transition-all"
          >
            Atualizar Dados
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-[#1a1a1a] text-white p-6 rounded-2xl flex justify-between items-center shadow-lg">
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

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#1a1a1a] text-white font-bold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-4 border-r border-white/10">Data</th>
                <th className="px-4 py-4">Senha</th>
                <th className="px-4 py-4">Cliente</th>
                <th className="px-4 py-4">Tipo</th>
                <th className="px-4 py-4">Início</th>
                <th className="px-4 py-4">Término</th>
                <th className="px-4 py-4">Duração</th>
                <th className="px-4 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-[#e67324] mb-4"></i>
                    <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest">Consultando Nuvem...</p>
                  </td>
                </tr>
              ) : allTickets.length > 0 ? (
                allTickets.map((t, idx) => (
                  <tr key={idx} className={`hover:bg-orange-50/50 transition-colors ${t.status === TicketStatus.FINISHED ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                    <td className="px-4 py-4 font-mono text-[11px] border-r font-bold">{(t as any).sessionDate}</td>
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
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest bg-gray-50">
                    Nenhum dado encontrado no período selecionado.
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
