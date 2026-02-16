
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'staff' as UserRole
  });

  useEffect(() => {
    const saved = localStorage.getItem('normatel_users');
    if (saved) setUsers(JSON.parse(saved));
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) return;

    const formattedUsername = formData.username.toUpperCase().trim();

    if (users.find(u => u.username.toUpperCase() === formattedUsername)) {
      alert('Este nome de usuário já está em uso no sistema.');
      return;
    }

    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.name.trim(),
      username: formattedUsername,
      password: formData.password,
      role: formData.role
    };

    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem('normatel_users', JSON.stringify(updated));
    setFormData({ name: '', username: '', password: '', role: 'staff' });
    alert('Usuário cadastrado com sucesso!');
  };

  const removeUser = (id: string, username: string) => {
    if (username === 'DIEGO.SILVA') {
      alert('ERRO: O Administrador Master não pode ser removido do sistema.');
      return;
    }
    
    if (confirm(`ATENÇÃO: Deseja realmente revogar o acesso de ${username}? Esta ação não pode ser desfeita.`)) {
      const updated = users.filter(u => u.id !== id);
      setUsers(updated);
      localStorage.setItem('normatel_users', JSON.stringify(updated));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
      {/* Formulário de Cadastro */}
      <div className="lg:col-span-1 bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-orange-50 text-[#e67324] p-3 rounded-xl">
             <i className="fas fa-user-plus text-xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight leading-none">NOVO ACESSO</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Cadastrar Colaborador</p>
          </div>
        </div>

        <form onSubmit={handleAdd} className="space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nome Completo</label>
            <input 
              required
              placeholder="Ex: João Ferreira"
              className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-[#e67324] font-bold transition-all"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Usuário de Login</label>
            <input 
              required
              placeholder="USUARIO.NOME"
              className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-[#e67324] font-bold uppercase transition-all"
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Senha Temporária</label>
            <input 
              required
              type="password"
              placeholder="••••••••"
              className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-[#e67324] font-bold transition-all"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Perfil do Usuário</label>
            <select 
              className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-[#e67324] font-bold cursor-pointer transition-all"
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
            >
              <option value="staff">OPERADOR (PADRÃO)</option>
              <option value="admin">ADMINISTRADOR (TOTAL)</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-[#1a1a1a] hover:bg-[#e67324] text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest mt-4 transition-all shadow-lg active:scale-95">
            CADASTRAR ACESSO
          </button>
        </form>
      </div>

      {/* Lista de Usuários */}
      <div className="lg:col-span-2 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-8 border-b bg-gray-50/50">
          <h2 className="text-xl font-black uppercase tracking-tighter">Colaboradores com Acesso</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Lista de permissões ativas no sistema</p>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#1a1a1a] text-[10px] font-black uppercase text-white">
                <th className="px-8 py-5">Nome</th>
                <th className="px-8 py-5">Usuário</th>
                <th className="px-8 py-5 text-center">Perfil</th>
                <th className="px-8 py-5 text-right">Controle</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-orange-50/30 transition-colors group">
                  <td className="px-8 py-5 font-bold text-gray-800">
                    <div className="flex items-center gap-3">
                       <div className={`w-2 h-2 rounded-full ${u.role === 'admin' ? 'bg-[#e67324]' : 'bg-gray-300'}`}></div>
                       {u.name}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-gray-500 font-mono text-xs">{u.username}</td>
                  <td className="px-8 py-5 text-center">
                    <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase ${u.role === 'admin' ? 'bg-[#1a1a1a] text-[#e67324] border border-[#e67324]' : 'bg-gray-100 text-gray-500'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    {u.username !== 'DIEGO.SILVA' ? (
                      <button 
                        onClick={() => removeUser(u.id, u.username)} 
                        className="w-10 h-10 rounded-xl bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center justify-center ml-auto"
                        title="Remover Acesso"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    ) : (
                      <div className="flex items-center justify-end gap-2 text-[#e67324] font-black text-[9px] uppercase tracking-widest px-2">
                        <i className="fas fa-crown"></i> ADMIN MESTRE
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-gray-300 italic font-bold uppercase tracking-widest">
                    <i className="fas fa-spinner fa-spin mb-4 text-3xl block"></i>
                    Sincronizando banco de dados...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-gray-50 text-[9px] font-bold text-gray-400 uppercase text-center border-t">
          Normatel Logística • Segurança de Dados Ativa
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
