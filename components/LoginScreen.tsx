
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { LOGO_URL } from '../constants';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const usersRaw = localStorage.getItem('normatel_users');
    let users: User[] = [];
    
    if (usersRaw) {
      users = JSON.parse(usersRaw);
    }
    
    const masterAdminExists = users.find(u => u.username === 'DIEGO.SILVA');
    
    if (!masterAdminExists) {
      const masterAdmin: User = { 
        id: 'master-admin-01', 
        username: 'DIEGO.SILVA', 
        password: '05171888302', 
        role: 'admin', 
        name: 'DIEGO SILVA (ADMIN)' 
      };
      users.push(masterAdmin);
      localStorage.setItem('normatel_users', JSON.stringify(users));
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const usersRaw = localStorage.getItem('normatel_users');
    if (!usersRaw) return;
    
    const users: User[] = JSON.parse(usersRaw);
    const user = users.find(u => u.username.toUpperCase() === username.toUpperCase() && u.password === password);
    
    if (user) {
      onLogin(user);
    } else {
      setError('Usuário ou senha inválidos. Verifique as credenciais.');
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-[#2a2a2a] rounded-3xl p-8 border border-[#3a3a3a] shadow-2xl animate-fadeIn">
        <div className="text-center mb-10">
          <div className="inline-block bg-white p-3 rounded-2xl mb-6 shadow-xl border-2 border-[#e67324]">
            <img src={LOGO_URL} alt="Normatel Logo" className="max-w-[100px] h-auto object-contain" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase leading-none">
            SISTEMA DE GESTÃO <br/><span className="text-[#e67324] text-lg uppercase tracking-widest font-bold">Logística e Vendas</span>
          </h1>
          <div className="h-1 w-12 bg-[#e67324] mx-auto mt-4 rounded-full"></div>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[#e67324] text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Usuário</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#e67324] transition-colors">
                <i className="fas fa-user-circle"></i>
              </span>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#3a3a3a] text-white p-4 pl-12 rounded-xl focus:ring-2 focus:ring-[#e67324] focus:border-transparent outline-none font-bold uppercase transition-all"
                placeholder="USUÁRIO"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#e67324] text-[10px] font-black uppercase tracking-widest mb-2 ml-1">Senha</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#e67324] transition-colors">
                <i className="fas fa-lock"></i>
              </span>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#3a3a3a] text-white p-4 pl-12 rounded-xl focus:ring-2 focus:ring-[#e67324] focus:border-transparent outline-none font-bold transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-400 text-xs font-bold text-center animate-bounce">
              <i className="fas fa-exclamation-triangle mr-2"></i> {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-[#e67324] hover:bg-orange-500 text-white font-black py-5 rounded-xl shadow-2xl transition-all active:scale-[0.97] uppercase tracking-widest text-sm border-b-4 border-orange-700"
          >
            ENTRAR NO SISTEMA
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-[#3a3a3a] text-center">
            <p className="text-gray-500 text-[9px] uppercase font-black tracking-widest">
              Acesso restrito a colaboradores autorizados
            </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
