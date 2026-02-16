
// Importação do Firebase App usando namespace para evitar erro de resolução de membros em ambientes TypeScript específicos
import * as firebase from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase para o projeto Normatel Home Center
const firebaseConfig = {
  apiKey: "AIzaSyAUGH515dj40sGUUHe2iK327fb1yP-_UG8",
  authDomain: "atedimento-normatel.firebaseapp.com",
  projectId: "atedimento-normatel",
  storageBucket: "atedimento-normatel.firebasestorage.app",
  messagingSenderId: "284942469214",
  appId: "1:284942469214:web:cfa8879fcedf309b888ccf",
  measurementId: "G-WCS1347YC1"
};

// Inicialização do Firebase App e exportação da instância do Firestore (Modular SDK v9+)
const app = firebase.initializeApp(firebaseConfig);
export const db = getFirestore(app);
