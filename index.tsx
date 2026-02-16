import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Função de inicialização segura para garantir que o DOM está pronto
const initApp = () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } else {
    console.error("Erro fatal: Elemento #root não encontrado no DOM.");
  }
};

// Verifica se o DOM já está carregado ou aguarda o evento
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
