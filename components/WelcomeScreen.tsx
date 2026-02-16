
import React, { useState } from 'react';
import { AppModule, User } from '../types';
import { ICONS, LOGO_URL } from '../constants';

interface WelcomeScreenProps {
  onSelect: (module: AppModule, date: string) => void;
  initialDate: string;
  currentUser: User | null;
  onLogout: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelect, initialDate, currentUser, onLogout }) => {
  const [date, setDate] = useState(initialDate);

  const modules: { id: AppModule; label: string; icon: any; desc: string; adminOnly?: boolean }[] = [
    { id: 'reception', label: 'RECEPÇÃO', icon: ICONS.RECEPTION, desc: 'Cadastro e triagem de clientes.' },
    { id: 'separation', label: 'OPERACIONAL', icon: ICONS.SEPARATION, desc: 'Separação de pedidos e chamadas.' },
    { id: 'dashboard', label: 'PAINEL TV', icon: ICONS.DASHBOARD, desc: 'Visualização para clientes na loja.' },
    { id: 'reports', label: 'RELATÓRIOS', icon: ICONS.REPORTS, desc: 'Análise de dados e histórico.' },
    { id: 'users', label: 'USUÁRIOS', icon: <i className="fas fa-users-cog"></i>, desc: 'Gerenciar acessos ao sistema.', adminOnly: true },
  ];

  const visibleModules = modules.filter(m => !m.adminOnly || currentUser?.role === 'admin');

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#e67324]/5 rounded-full -mr-48 -mt-48 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#e67324]/5 rounded-full -ml-48 -mb-48 blur-3xl"></div>

      {/* User Header */}
      <div className="absolute top-8 right-8 flex items-center gap-4 bg-[#2a2a2a] p-3 px-5 rounded-2xl border border-[#3a3a3a] shadow-xl">
         <div className="text-right">
           <p className="text-[9px] font-black text-[#e67324] uppercase">Logado como</p>
           <p className="text-xs text-white font-bold">{currentUser?.name}</p>
         </div>
         <button onClick={onLogout} className="w-10 h-10 bg-red-900/30 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
            <i className="fas fa-sign-out-alt"></i>
         </button>
      </div>

      <div className="max-w-4xl w-full z-10">
        <div className="text-center mb-12">
          <div className="inline-block bg-white p-3 rounded-3xl mb-8 shadow-2xl border-4 border-[#e67324] animate-bounce">
            <img src={LOGO_URL} alt="Normatel Logo" className="max-w-[140px] h-auto object-contain" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2 uppercase">
            NORMATEL <span className="text-[#e67324]">HOME CENTER</span>
          </h1>
          <p className="text-gray-400 font-medium text-lg uppercase tracking-widest text-[11px]">Sistema Inteligente de Gestão de Atendimento</p>
        </div>

        <div className="bg-[#2a2a2a] rounded-3xl p-8 border border-[#3a3a3a] shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6 mb-10 pb-10 border-b border-[#3a3a3a]">
            <div className="flex-1 w-full">
              <label className="block text-[#e67324] text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Data de Atendimento</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#3a3a3a] text-white p-4 rounded-xl focus:ring-2 focus:ring-[#e67324] outline-none font-black text-center text-lg"
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wide leading-relaxed">
                Os registros serão vinculados à data selecionada. Certifique-se de usar a data correta para garantir a integridade dos relatórios e métricas de desempenho.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleModules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => onSelect(mod.id, date)}
                className="group bg-[#333] hover:bg-[#e67324] p-6 rounded-2xl border border-[#444] hover:border-[#e67324] transition-all text-center flex flex-col items-center gap-4 shadow-lg hover:shadow-orange-500/20 active:scale-95"
              >
                <div className="text-3xl text-[#e67324] group-hover:text-white transition-colors">
                  {mod.icon}
                </div>
                <div>
                  <h3 className="font-black text-white group-hover:text-white mb-1 uppercase tracking-tight text-sm">{mod.label}</h3>
                  <p className="text-[9px] font-bold text-gray-500 group-hover:text-orange-100 uppercase tracking-widest">{mod.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center text-gray-600 text-[10px] font-black uppercase tracking-widest">
          Normatel Home Center • Logística & Distribuição © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
