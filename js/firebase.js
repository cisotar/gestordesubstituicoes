/**
 * firebase.js — Inicialização do Firebase.
 * Exporta as instâncias de app, auth e db para uso nos demais módulos.
 */

import { initializeApp }           from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'AIzaSyDN7ivev6Dgse8uZOi_2j6KqyAngVvuM7o',
  authDomain:        'gestordesubstituicoes.firebaseapp.com',
  projectId:         'gestordesubstituicoes',
  storageBucket:     'gestordesubstituicoes.firebasestorage.app',
  messagingSenderId: '51263219079',
  appId:             '1:51263219079:web:ac4781dbefcd6d94d5df22',
};

export const app      = initializeApp(firebaseConfig);
export const db       = getFirestore(app);
export const auth     = getAuth(app);
export const provider = new GoogleAuthProvider();
