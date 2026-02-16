
import React, { useState, useMemo } from 'react';
import { Priority, ClientType, VehicleType, Ticket } from '../types';
import { ICONS } from '../constants';

interface ReceptionModuleProps {
  onAddTicket: (ticket: Omit<Ticket, 'id' | 'password' | 'arrivalTime' | 'status'>) => void;
  tickets: Ticket[];
}

const ReceptionModule: React.FC<ReceptionModuleProps> = ({ onAddTicket, tickets }) => {
  const [formData, setFormData] = useState({
    customerName: '',
    priority: Priority.NORMAL,
    clientType: ClientType.CLIENT,
    vehicleType: VehicleType.PASSENGER,
    orderNumber: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.orderNumber) return;
    onAddTicket(formData);
    setFormData({
      customerName: '',
      priority: Priority.NORMAL,
      clientType: ClientType.CLIENT,
      vehicleType: VehicleType.PASSENGER,
      orderNumber: '',
    });
  };

  // Organiza do mais recente para o mais antigo (Decrescente por arrivalTime)
  const recentTickets = useMemo(() => {
    return [...tickets]
      .sort((a, b) => {
        const dateA = a.arrivalTime instanceof Date ? a.arrivalTime.getTime() : new Date(a.arrivalTime).getTime();
        const dateB = b.arrivalTime instanceof Date ? b.arrivalTime.getTime() : new Date(b.arrivalTime).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [tickets]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-orange-50 text-[#e67324] p-4 rounded-2xl">
            {ICONS.RECEPTION}
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">CADASTRAR ATENDIMENTO</h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Recepção de Loja</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Nome do Cliente</label>
              <input required type="text" placeholder="Nome Completo" className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#e67324] rounded-xl outline-none transition-all font-bold" value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Número do Pedido</label>
              <input required type="text" placeholder="Ex: 12345" className="w-full p-4 bg-gray-50 border-2 border-transparent focus:border-[#e67324] rounded-xl outline-none transition-all font-bold" value={formData.orderNumber} onChange={e => setFormData({...formData, orderNumber: e.target.value})} />
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

          <button type="submit" className="w-full bg-[#e67324] hover:bg-[#1a1a1a] text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] uppercase tracking-widest text-sm flex items-center justify-center gap-3">
            <i className="fas fa-ticket"></i> GERAR SENHA DE ATENDIMENTO
          </button>
        </form>
      </div>

      <div className="space-y-6">
        <div className="bg-[#1a1a1a] p-8 rounded-2xl shadow-2xl text-white">
          <div className="flex justify-between items-start mb-6">
            <p className="text-[#e67324] text-[10px] font-black uppercase tracking-widest">Senhas Geradas</p>
            <i className="fas fa-users text-white/10 text-3xl"></i>
          </div>
          <p className="text-6xl font-black tracking-tighter">{tickets.length}</p>
          <p className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-widest">Total na data selecionada</p>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Últimos Lançamentos</h3>
          <div className="space-y-4">
            {recentTickets.map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div>
                  <p className="font-black text-gray-900 leading-none mb-1">{ticket.customerName}</p>
                  <p className="text-[10px] font-bold text-[#e67324]">{ticket.password} • #{ticket.orderNumber}</p>
                </div>
                {ticket.priority === Priority.PRIORITY && (
                  <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-1 rounded">PRIO</span>
                )}
              </div>
            ))}
            {recentTickets.length === 0 && <p className="text-center text-gray-400 italic text-sm py-4">Fila vazia</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceptionModule;
