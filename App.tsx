
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Ticket, Priority, TicketStatus, AppModule, User } from './types';
import ReceptionModule from './components/ReceptionModule';
import SeparationModule from './components/SeparationModule';
import CustomerDashboard from './components/CustomerDashboard';
import ReportsModule from './components/ReportsModule';
import UserManagement from './components/UserManagement';
import WelcomeScreen from './components/WelcomeScreen';
import LoginScreen from './components/LoginScreen';
import DataService from './services/dataService';
import { LOGO_URL } from './constants';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [activeModule, setActiveModule] = useState<AppModule | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncIntervalRef = useRef<number | null>(null);

  // Efeito para garantir que o áudio seja desbloqueado na primeira interação (Nativo)
  useEffect(() => {
    const unlockAudio = () => {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      // Remove o listener após a primeira interação bem sucedida
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      console.log("Sistema de áudio inicializado nativamente.");
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Carregar sessão de usuário
  useEffect(() => {
    const logged = sessionStorage.getItem('normatel_logged_user');
    if (logged) {
      try {
        setCurrentUser(JSON.parse(logged));
      } catch (e) {
        sessionStorage.removeItem('normatel_logged_user');
      }
    }
  }, []);

  // Função principal de carregamento de dados (Sincronismo)
  const fetchData = useCallback(async (showLoader = false) => {
    if (!sessionDate || !currentUser) return;
    if (showLoader) setIsSyncing(true);
    
    try {
      const remoteTickets = await DataService.getTickets(sessionDate);
      // Apenas atualiza o estado se houver mudanças para evitar re-renders desnecessários
      if (JSON.stringify(remoteTickets) !== JSON.stringify(tickets)) {
        setTickets(remoteTickets);
      }
    } catch (error) {
      console.error("Falha na sincronização:", error);
    } finally {
      if (showLoader) setIsSyncing(false);
    }
  }, [sessionDate, currentUser, tickets]);

  // Efeito para Polling (Sincronização Periódica entre dispositivos)
  useEffect(() => {
    if (currentUser && sessionDate && activeModule !== 'reports') {
      fetchData(true); // Carga inicial
      
      // Configura polling a cada 10 segundos
      syncIntervalRef.current = window.setInterval(() => {
        fetchData(false); 
      }, 10000);
    } else {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    }

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [currentUser, sessionDate, activeModule, fetchData]);

  const addTicket = useCallback(async (ticketData: Omit<Ticket, 'id' | 'password' | 'arrivalTime' | 'status'>) => {
    setIsSyncing(true);
    const newTicket: Ticket = {
      ...ticketData,
      id: Math.random().toString(36).substr(2, 9),
      password: `${ticketData.priority === Priority.PRIORITY ? 'P' : 'N'}-${(tickets.length + 1).toString().padStart(3, '0')}`,
      arrivalTime: new Date(),
      status: TicketStatus.WAITING_SEPARATION,
    };
    
    await DataService.addTicket(sessionDate, newTicket);
    await fetchData();
    setIsSyncing(false);
  }, [tickets, sessionDate, fetchData]);

  const updateTicketStatus = useCallback(async (id: string, newStatus: TicketStatus) => {
    setIsSyncing(true);
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    const update: Partial<Ticket> = { status: newStatus };
    if (newStatus === TicketStatus.IN_SEPARATION) update.separationStartTime = new Date();
    if (newStatus === TicketStatus.READY) update.separationEndTime = new Date();
    if (newStatus === TicketStatus.CALLED) update.callTime = new Date();
    if (newStatus === TicketStatus.FINISHED) update.finishTime = new Date();

    const updatedTicket = { ...ticket, ...update };
    await DataService.updateTicket(sessionDate, updatedTicket);
    await fetchData();
    setIsSyncing(false);
  }, [tickets, sessionDate, fetchData]);

  const removeTicket = useCallback(async (id: string) => {
    setIsSyncing(true);
    await DataService.deleteTicket(sessionDate, id);
    await fetchData();
    setIsSyncing(false);
  }, [sessionDate, fetchData]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem('normatel_logged_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveModule(null);
    sessionStorage.removeItem('normatel_logged_user');
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (!activeModule) {
    return (
      <WelcomeScreen 
        onSelect={(module, date) => {
          setSessionDate(date);
          setActiveModule(module);
        }} 
        initialDate={sessionDate}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfc]">
      <header className="bg-[#1a1a1a] text-white shadow-xl sticky top-0 z-50 border-b-4 border-[#e67324]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center gap-6 cursor-pointer" onClick={() => setActiveModule(null)}>
              <div className="bg-white p-1 rounded-lg flex items-center justify-center h-6 shadow-inner border border-[#e67324]">
                <img src={LOGO_URL} alt="Normatel Logo" className="h-full w-auto object-contain" />
              </div>
              <div className="hidden sm:block border-l border-white/10 pl-4">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight leading-none uppercase">GESTOR</h1>
                  {isSyncing && <i className="fas fa-sync fa-spin text-[10px] text-[#e67324]"></i>}
                </div>
                <p className="text-[10px] text-[#e67324] font-bold uppercase tracking-widest mt-1">Painel Operacional</p>
              </div>
            </div>
            
            <nav className="hidden lg:flex items-center space-x-2">
              <div className="flex bg-[#2a2a2a] rounded-lg p-1 mr-4 border border-[#3a3a3a]">
                <button onClick={() => setActiveModule('reception')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'reception' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>RECEPÇÃO</button>
                <button onClick={() => setActiveModule('separation')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'separation' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>OPERACIONAL</button>
                <button onClick={() => setActiveModule('dashboard')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'dashboard' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>PAINEL TV</button>
                <button onClick={() => setActiveModule('reports')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'reports' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>RELATÓRIOS</button>
                {currentUser.role === 'admin' && (
                  <button onClick={() => setActiveModule('users')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeModule === 'users' ? 'bg-[#e67324] text-white' : 'text-gray-400 hover:text-white'}`}>USUÁRIOS</button>
                )}
              </div>
              <button onClick={handleLogout} className="text-red-400 hover:text-red-300 text-xs font-black uppercase tracking-widest px-4 transition-colors">Sair</button>
            </nav>

            <button onClick={() => setActiveModule(null)} className="lg:hidden text-[#e67324] text-xl">
              <i className="fas fa-bars"></i>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {activeModule === 'reception' && <ReceptionModule onAddTicket={addTicket} tickets={tickets} />}
        {activeModule === 'separation' && <SeparationModule tickets={tickets} onUpdateStatus={updateTicketStatus} onRemove={removeTicket} />}
        {activeModule === 'dashboard' && <CustomerDashboard tickets={tickets} />}
        {activeModule === 'reports' && <ReportsModule />}
        {activeModule === 'users' && currentUser.role === 'admin' && <UserManagement />}
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 px-6 flex justify-between items-center text-gray-400 text-[9px] uppercase font-bold tracking-widest">
        <span>Normatel Home Center • Sessão: {sessionDate} • Usuário: {currentUser.name}</span>
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-[#e67324] animate-pulse' : 'bg-emerald-500'}`}></div>
           <span>{isSyncing ? 'Sincronizando Nuvem...' : 'Conectado'}</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
