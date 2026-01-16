'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCj77-aRSmM-m34vqwZ1r5rFkEYkmu6Vb4",
  authDomain: "moon-traders-2.firebaseapp.com",
  projectId: "moon-traders-2",
  storageBucket: "moon-traders-2.firebasestorage.app",
  messagingSenderId: "955347658272",
  appId: "1:955347658272:web:98898f0cef1cf6f104fe45"
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

if (typeof window !== 'undefined') {
  // Only initialize on client side
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db };















