/**
 * devmode.js — Modo de desenvolvimento para testes locais.
 *
 * Ativo apenas quando o app roda em localhost / 127.0.0.1.
 * Injeta um painel flutuante que permite:
 *   - Habilitar / desabilitar o dev mode
 *   - Simular login como Admin ou como Professor (visualização pública)
 *
 * Em produção (Firebase Hosting) este módulo não faz nada.
 */

import { authState }   from './auth.js';
import { renderAuthBar, updateAdminUI } from './auth.js';
import { updateNav }   from './nav.js';
import { renderPage }  from './render.js';

// ─── Detecção de ambiente ─────────────────────────────────────────────────────

export const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

const DEV_KEY = 'gestao_devmode';

export const dev = {
  get active() { return IS_LOCAL && localStorage.getItem(DEV_KEY) === '1'; },
  get role()   { return localStorage.getItem(DEV_KEY + '_role') || 'admin'; },

  enable()  { localStorage.setItem(DEV_KEY, '1'); },
  disable() { localStorage.removeItem(DEV_KEY); localStorage.removeItem(DEV_KEY + '_role'); },
  setRole(r){ localStorage.setItem(DEV_KEY + '_role', r); },
};

// ─── Aplicação do estado simulado ─────────────────────────────────────────────

/**
 * Se dev mode estiver ativo, sobrescreve authState com dados simulados
 * e retorna true (para o app.js pular o Firebase Auth).
 */
export function applyDevAuth() {
  if (!dev.active) return false;

  const isAdmin = dev.role === 'admin';
  authState.user = {
    displayName: isAdmin ? 'Dev Admin' : 'Dev Professor',
    email:       isAdmin ? 'dev@admin.local' : 'dev@professor.local',
    photoURL:    null,
  };
  authState.isAdmin = isAdmin;
  authState.loading = false;
  return true;
}

// ─── Painel flutuante ─────────────────────────────────────────────────────────

export function mountDevPanel() {
  if (!IS_LOCAL) return;

  // Remove painel anterior se existir
  document.getElementById('dev-panel')?.remove();

  const panel = document.createElement('div');
  panel.id = 'dev-panel';
  panel.innerHTML = devPanelHTML();
  document.body.appendChild(panel);

  // Eventos do painel
  panel.querySelector('#dev-toggle')?.addEventListener('click', () => {
    if (dev.active) dev.disable(); else dev.enable();
    _refresh();
  });

  panel.querySelector('#dev-role-admin')?.addEventListener('click', () => {
    dev.setRole('admin');
    _refresh();
  });

  panel.querySelector('#dev-role-prof')?.addEventListener('click', () => {
    dev.setRole('professor');
    _refresh();
  });

  // Minimizar / expandir
  panel.querySelector('#dev-minimize')?.addEventListener('click', () => {
    const body = panel.querySelector('#dev-body');
    const btn  = panel.querySelector('#dev-minimize');
    if (body.style.display === 'none') {
      body.style.display = '';
      btn.textContent = '−';
    } else {
      body.style.display = 'none';
      btn.textContent = '+';
    }
  });
}

function devPanelHTML() {
  const active  = dev.active;
  const role    = dev.role;

  return `
    <div id="dev-header">
      <span style="font-size:11px;font-weight:700;letter-spacing:.05em">🛠 DEV MODE</span>
      <button id="dev-minimize" title="Minimizar">−</button>
    </div>
    <div id="dev-body">
      <div class="dev-row">
        <span class="dev-lbl">Status</span>
        <button id="dev-toggle" class="dev-btn ${active ? 'dev-on' : 'dev-off'}">
          ${active ? '● Ativo' : '○ Inativo'}
        </button>
      </div>

      ${active ? `
        <div class="dev-row" style="margin-top:8px">
          <span class="dev-lbl">Papel</span>
          <div style="display:flex;gap:4px">
            <button id="dev-role-admin"
              class="dev-btn dev-role ${role === 'admin' ? 'dev-role-on' : ''}">
              Admin
            </button>
            <button id="dev-role-prof"
              class="dev-btn dev-role ${role === 'professor' ? 'dev-role-on' : ''}">
              Professor
            </button>
          </div>
        </div>

        <div class="dev-info">
          Logado como: <strong>${role === 'admin' ? 'Dev Admin' : 'Dev Professor'}</strong><br>
          ${role === 'admin'
            ? '✅ Vê Configurações, edita ausências'
            : '👁 Só visualização, sem edição'}
        </div>
      ` : `
        <div class="dev-info">
          Dev mode desativado.<br>Usa Firebase Auth real.
        </div>
      `}
    </div>`;
}

function _refresh() {
  // Reaplica o estado simulado
  applyDevAuth();
  // Atualiza a UI
  renderAuthBar();
  updateAdminUI();
  updateNav();
  renderPage();
  // Remonta o painel com o novo estado
  mountDevPanel();
}
