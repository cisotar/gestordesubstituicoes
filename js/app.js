/**
 * app.js — Ponto de entrada da aplicação.
 *
 * Ordem de inicialização:
 *   1. Mostra tela de loading
 *   2. Se localhost → verifica dev mode (pula Firebase Auth se ativo)
 *   3. Se produção  → carrega Firestore + Firebase Auth
 *   4. Registra eventos, renderiza, monta painel dev (se local)
 */

import { loadFromFirestore }         from './db.js';
import { initAuth }                  from './auth.js';
import { registerEvents }            from './events.js';
import { updateNav }                 from './nav.js';
import { renderHome }                from './home.js';
import { IS_LOCAL, dev, applyDevAuth, mountDevPanel } from './devmode.js';

setLoadingVisible(true);

try {
  if (IS_LOCAL && dev.active) {
    // ── Dev mode: pula Auth, carrega Firestore normalmente ──────────────────
    applyDevAuth();
    await loadFromFirestore();
  } else if (IS_LOCAL) {
    // ── Local sem dev mode: carrega tudo normalmente ─────────────────────────
    await Promise.all([loadFromFirestore(), initAuth()]);
  } else {
    // ── Produção: comportamento normal ───────────────────────────────────────
    await Promise.all([loadFromFirestore(), initAuth()]);
  }
} catch (e) {
  console.error('Falha na inicialização:', e);
}

registerEvents();
updateNav();
renderHome();
setLoadingVisible(false);

// Painel dev só aparece em localhost
if (IS_LOCAL) mountDevPanel();

function setLoadingVisible(visible) {
  const el   = document.getElementById('app-loading');
  const wrap = document.querySelector('.wrap');
  const nav  = document.getElementById('main-nav');
  if (el)   el.style.display   = visible ? 'flex' : 'none';
  if (wrap) wrap.style.display = visible ? 'none' : '';
  if (nav)  nav.style.display  = visible ? 'none' : '';
}
