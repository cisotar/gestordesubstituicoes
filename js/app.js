/**
 * app.js — Ponto de entrada da aplicação.
 *
 * Ordem de inicialização:
 *   1. Mostra tela de loading
 *   2. Carrega dados do Firestore → state
 *   3. Inicia autenticação (Firebase Auth)
 *   4. Registra eventos
 *   5. Renderiza a primeira página
 */

import { loadFromFirestore }  from './db.js';
import { initAuth }           from './auth.js';
import { registerEvents }     from './events.js';
import { updateNav }          from './nav.js';
import { renderCalendar }     from './render.js';

// Mostra loading imediatamente
setLoadingVisible(true);

try {
  // Carrega dados e autentica em paralelo
  await Promise.all([
    loadFromFirestore(),
    initAuth(),
  ]);
} catch (e) {
  console.error('Falha na inicialização:', e);
}

registerEvents();
updateNav();
renderCalendar();
setLoadingVisible(false);

function setLoadingVisible(visible) {
  const el = document.getElementById('app-loading');
  if (el) el.style.display = visible ? 'flex' : 'none';
  const wrap = document.querySelector('.wrap');
  if (wrap) wrap.style.display = visible ? 'none' : '';
}
