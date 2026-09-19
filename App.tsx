
import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Ticket, Priority, TicketStatus, AppModule, User } from './types';
import ReceptionModule from './components/ReceptionModule';
import SeparationModule from './components/SeparationModule';
import CustomerDashboard from './components/CustomerDashboard';
import ReportsModule from './components/ReportsModule';
import UserManagement from './components/UserManagement';
import PrismaModule from './components/PrismaModule';
import WelcomeScreen from './components/WelcomeScreen';
import LoginScreen from './components/LoginScreen';
import DataService from './services/dataService';
import { LOGO_URL } from './constants';

interface LayoutProps {
  currentUser: User | null;
  sessionDate: string;
  activeModule: AppModule | null;
  setActiveModule: (module: AppModule | null) => void;
  isSyncing: boolean;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  currentUser,
  sessionDate,
  activeModule,
  setActiveModule,
  isSyncing,
  onLogout,
  children
}) => (
  <div className="min-h-screen flex flex-col bg-[#fcfcfc]">
    <header className="bg-[#1a1a1a] text-white shadow-xl sticky top-0 z-50 border-b-4 border-[#e67324]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 sm:h-20 items-center">
          <div className="flex items-center gap-3 sm:gap-6 cursor-pointer" onClick={() => setActiveModule(null)}>
            <div className="bg-white p-1 rounded-lg flex items-center justify-center h-7 sm:h-8 shadow-inner border border-[#e67324]">
              <img src={LOGO_URL} alt="Normatel Logo" className="h-full w-auto object-contain" />
            </div>
            <div className="hidden sm:block border-l border-white/10 pl-4">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight leading-none uppercase">GESTOR</h1>
                {isSyncing && <i className="fas fa-sync fa-spin text-[10px] text-[#e67324]"></i>}
              </div>
              <p className="text-[10px] text-[#e67324] font-bold uppercase tracking-widest mt-1">Nuvem Ativa</p>
            </div>
          </div>
          {/* Mobile switcher */}
          <div className="flex lg:hidden items-center gap-1.5 sm:gap-2">
            <select
              value={activeModule || ''}
              onChange={(e) => setActiveModule((e.target.value as AppModule) || null)}
              className="bg-[#2a2a2a] text-white text-[11px] sm:text-xs font-black py-1.5 px-2.5 rounded-lg border border-[#3a3a3a] outline-none shadow-xs"
            >
              <option value="reception">RECEPÇÃO</option>
              <option value="separation">OPERACIONAL</option>
              <option value="prisma">PRISMA (PORTARIA)</option>
              <option value="dashboard">PAINEL TV</option>
              <option value="reports">RELATÓRIOS</option>
              {currentUser?.role === 'admin' && <option value="users">USUÁRIOS</option>}
            </select>
            <button
              onClick={onLogout}
              className="text-red-400 hover:text-red-300 p-1.5 sm:p-2 text-xs font-bold uppercase transition-colors"
              title="Sair do sistema"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>

          <nav className="hidden lg:flex items-center space-x-2">
            <div className="flex bg-[#2a2a2a] rounded-lg p-1 mr-4 border border-[#3a3a3a]">
              <button onClick={() => setActiveModule('reception')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'reception' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>RECEPÇÃO</button>
              <button onClick={() => setActiveModule('separation')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'separation' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>OPERACIONAL</button>
              <button onClick={() => setActiveModule('prisma')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'prisma' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>PRISMA</button>
              <button onClick={() => setActiveModule('dashboard')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'dashboard' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>PAINEL TV</button>
              <button onClick={() => setActiveModule('reports')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'reports' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>RELATÓRIOS</button>
              {currentUser?.role === 'admin' && (
                <button onClick={() => setActiveModule('users')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'users' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>USUÁRIOS</button>
              )}
            </div>
            <button onClick={onLogout} className="text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-widest px-4 transition-colors">Sair</button>
          </nav>
        </div>
      </div>
    </header>
    <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
      {children}
    </main>
    <footer className="bg-white border-t border-gray-200 py-4 px-6 flex justify-between items-center text-gray-400 text-[9px] uppercase font-bold tracking-widest">
      <span>Sessão: {sessionDate} • Usuário: {currentUser?.name}</span>
      <div className="flex items-center gap-2">
         <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
         <span>{isSyncing ? 'Atualizando...' : 'Sincronizado'}</span>
      </div>
    </footer>
  </div>
);

const App: React.FC = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeModule, setActiveModule] = useState<AppModule | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Desbloqueio de Áudio
  useEffect(() => {
    const unlockAudio = () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    return () => window.removeEventListener('click', unlockAudio);
  }, []);

  // Carregar Sessão
  useEffect(() => {
    const logged = sessionStorage.getItem('normatel_logged_user');
    if (logged) {
      try { setCurrentUser(JSON.parse(logged)); } catch (e) { sessionStorage.removeItem('normatel_logged_user'); }
    }
  }, []);

  // SINCRONIZAÇÃO EM TEMPO REAL (MÁGICA DO ON-SNAPSHOT)
  useEffect(() => {
    // Só sincroniza se houver usuário e data, e se não estiver na tela de relatórios (que é histórica)
    if (currentUser && sessionDate && activeModule !== 'reports') {
      setIsSyncing(true);
      
      const unsubscribe = DataService.subscribeTickets(sessionDate, (updatedTickets) => {
        setTickets(updatedTickets);
        setIsSyncing(false);
      });

      // Cleanup: Cancela a escuta quando o componente desmonta ou muda a data
      return () => unsubscribe();
    }
  }, [currentUser, sessionDate, activeModule]);

  const addTicket = useCallback(async (ticketData: Omit<Ticket, 'id' | 'password' | 'arrivalTime' | 'status'>) => {
    await DataService.createSequentialTicket(sessionDate, ticketData, tickets);
  }, [tickets, sessionDate]);

  const updateTicketStatus = useCallback(async (id: string, newStatus: TicketStatus, cancelReason?: string) => {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;
    
    const update: any = { status: newStatus };
    if (newStatus === TicketStatus.IN_SEPARATION) update.separationStartTime = new Date();
    if (newStatus === TicketStatus.READY) update.separationEndTime = new Date();
    if (newStatus === TicketStatus.CALLED) update.callTime = new Date();
    if (newStatus === TicketStatus.FINISHED) update.finishTime = new Date();
    if (newStatus === TicketStatus.CANCELLED) {
      update.cancelTime = new Date();
      update.cancelReason = cancelReason || 'Desistência por demora';
    }
    
    await DataService.updateTicket(sessionDate, { ...ticket, ...update });
  }, [tickets, sessionDate]);

  const removeTicket = useCallback(async (id: string) => {
    await DataService.deleteTicket(sessionDate, id);
  }, [sessionDate]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('normatel_logged_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveModule(null);
    sessionStorage.removeItem('normatel_logged_user');
    navigate('/');
  };

  return (
    <Routes>
      <Route path="/" element={
        !currentUser ? <LoginScreen onLogin={handleLogin} /> : 
        !activeModule ? (
          <WelcomeScreen 
            onSelect={(module, date) => {
              setSessionDate(date);
              setActiveModule(module);
            }} 
            initialDate={sessionDate}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        ) : (
          <Layout
            currentUser={currentUser}
            sessionDate={sessionDate}
            activeModule={activeModule}
            setActiveModule={setActiveModule}
            isSyncing={isSyncing}
            onLogout={handleLogout}
          >
            {activeModule === 'reception' && <ReceptionModule onAddTicket={addTicket} tickets={tickets} />}
            {activeModule === 'separation' && <SeparationModule tickets={tickets} onUpdateStatus={updateTicketStatus} onRemove={removeTicket} />}
            {activeModule === 'prisma' && <PrismaModule sessionDate={sessionDate} currentUser={currentUser} tickets={tickets} />}
            {activeModule === 'dashboard' && <CustomerDashboard tickets={tickets} />}
            {activeModule === 'reports' && <ReportsModule />}
            {activeModule === 'users' && currentUser.role === 'admin' && <UserManagement />}
          </Layout>
        )
      } />
      <Route path="*" element={<div className="p-20 text-center font-bold">Página não encontrada. <button onClick={() => navigate('/')}>Voltar</button></div>} />
    </Routes>
  );
};

export default App;
