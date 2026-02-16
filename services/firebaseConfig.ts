// Standard Firebase v9 modular imports
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAUGH515dj40sGUUHe2iK327fb1yP-_UG8",
  authDomain: "atedimento-normatel.firebaseapp.com",
  projectId: "atedimento-normatel",
  storageBucket: "atedimento-normatel.firebasestorage.app",
  messagingSenderId: "284942469214",
  appId: "1:284942469214:web:cfa8879fcedf309b888ccf",
  measurementId: "G-WCS1347YC1"
};

// Initializing Firebase App using the modular SDK v9
const app = initializeApp(firebaseConfig);
// Initializing Firestore instance
export const db = getFirestore(app);