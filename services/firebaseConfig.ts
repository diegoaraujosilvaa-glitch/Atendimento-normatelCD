
// Importação modular do Firebase conforme v9+
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuração oficial do Firebase - Normatel Home Center
const firebaseConfig = {
  apiKey: "AIzaSyAUGH515dj40sGUUHe2iK327fb1yP-_UG8",
  authDomain: "atedimento-normatel.firebaseapp.com",
  projectId: "atedimento-normatel",
  storageBucket: "atedimento-normatel.firebasestorage.app",
  messagingSenderId: "284942469214",
  appId: "1:284942469214:web:cfa8879fcedf309b888ccf",
  measurementId: "G-WCS1347YC1"
};

// Inicialização única do app para evitar erros de "duplicate app" e garantir compatibilidade modular
// Correção para o erro de membro não exportado garantindo o uso correto do SDK modular v9
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
