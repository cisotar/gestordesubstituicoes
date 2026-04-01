/**
 * auth.js — Autenticação via Google e controle de acesso admin.
 *
 * Estado de autenticação:
 *   authState.user    → objeto do Firebase Auth (ou null)
 *   authState.isAdmin → true se o e-mail está na coleção /admins
 *
 * A UI reage ao estado via renderAuthBar() e updateAdminUI().
 */

import { auth, provider }                from './firebase.js';
import { signInWithPopup, signOut,
         onAuthStateChanged }            from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { isAdmin, addAdmin, listAdmins,
         removeAdmin }                   from './db.js';
import { h }                             from './helpers.js';

// ─── Estado global de autenticação ───────────────────────────────────────────

export const authState = {
  user:    null,
  isAdmin: false,
  loading: true,
};

// ─── Inicialização ────────────────────────────────────────────────────────────

/**
 * Inicia o listener de autenticação.
 * Resolve a Promise quando o estado inicial é conhecido.
 */
export function initAuth() {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      authState.user    = user;
      authState.isAdmin = user ? await isAdmin(user.email) : false;
      authState.loading = false;
      renderAuthBar();
      updateAdminUI();
      resolve();
    });
  });
}

// ─── Login / Logout ───────────────────────────────────────────────────────────

export async function login() {
  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged cuida do resto
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      alert('Erro ao fazer login: ' + e.message);
    }
  }
}

export async function logout() {
  await signOut(auth);
}

// ─── Verificação de permissão ─────────────────────────────────────────────────

/**
 * Garante que o usuário tem permissão admin antes de executar uma ação.
 * Uso: if (!requireAdmin()) return;
 */
export function requireAdmin() {
  if (authState.isAdmin) return true;
  alert('Acesso restrito. Faça login como administrador.');
  return false;
}

// ─── Renderização da barra de autenticação ────────────────────────────────────

export function renderAuthBar() {
  const bar = document.getElementById('auth-bar');
  if (!bar) return;

  if (authState.loading) {
    bar.innerHTML = `<span style="font-size:12px;color:rgba(255,255,255,.4)">⏳ Carregando…</span>`;
    return;
  }

  if (!authState.user) {
    bar.innerHTML = `
      <button class="auth-btn" id="btn-login">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Entrar como administrador
      </button>`;
    document.getElementById('btn-login')?.addEventListener('click', login);
    return;
  }

  const adminBadge = authState.isAdmin
    ? `<span class="auth-admin-badge">● Admin</span>`
    : `<span style="font-size:11px;color:#FCA5A5">Sem permissão admin</span>`;

  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      ${authState.user.photoURL
        ? `<img src="${authState.user.photoURL}" alt="" style="width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.2)">`
        : ''}
      <div style="line-height:1.3">
        <div style="font-size:12px;font-weight:600;color:#fff">${h(authState.user.displayName ?? authState.user.email)}</div>
        ${adminBadge}
      </div>
      <button class="auth-btn auth-btn-sm" id="btn-logout">Sair</button>
      ${authState.isAdmin ? `<button class="auth-btn auth-btn-sm" id="btn-admins" title="Gerenciar admins">⚙</button>` : ''}
    </div>`;

  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('btn-admins')?.addEventListener('click', openAdminManager);
}

/**
 * Mostra/oculta elementos com data-admin-only e data-hide-if-admin
 * conforme o estado de autenticação.
 */
export function updateAdminUI() {
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.style.display = authState.isAdmin ? '' : 'none';
  });
  document.querySelectorAll('[data-hide-if-admin]').forEach(el => {
    el.style.display = authState.isAdmin ? 'none' : '';
  });
}

// ─── Gerenciador de admins ────────────────────────────────────────────────────

async function openAdminManager() {
  const overlay = document.getElementById('overlay');
  const body    = document.getElementById('modal-body');
  if (!overlay || !body) return;

  body.innerHTML = `<div style="padding:20px 0;text-align:center;color:var(--t2)">⏳ Carregando…</div>`;
  overlay.classList.add('on');

  const admins = await listAdmins();

  const rows = admins.map(a => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr)">
      <div style="flex:1;font-size:14px">${h(a.name || a.email)}</div>
      <div style="font-size:12px;color:var(--t2)">${h(a.email)}</div>
      ${a.email !== authState.user?.email ? `
        <button class="btn-del" data-admin-email="${h(a.email)}" id="rm-admin-${h(a.email).replace(/\W/g,'_')}">✕</button>
      ` : `<span style="font-size:11px;color:var(--t3)">você</span>`}
    </div>`).join('');

  body.innerHTML = `
    <div class="m-hdr">
      <h3 style="font-size:17px">Gerenciar Administradores</h3>
      <button class="m-close" onclick="document.getElementById('overlay').classList.remove('on')">×</button>
    </div>

    <div style="margin-bottom:20px">
      ${rows || '<p style="color:var(--t3);font-size:13px">Nenhum admin cadastrado.</p>'}
    </div>

    <div class="fld" style="margin-bottom:12px">
      <label class="lbl">Adicionar administrador (e-mail Google)</label>
      <input class="inp" id="new-admin-email" placeholder="professor@escola.edu.br" type="email">
    </div>
    <div class="fld" style="margin-bottom:20px">
      <label class="lbl">Nome (opcional)</label>
      <input class="inp" id="new-admin-name" placeholder="Nome completo">
    </div>
    <button class="btn btn-dark" style="width:100%" id="btn-add-admin">Adicionar</button>`;

  // Handlers inline
  body.querySelectorAll('[data-admin-email]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.adminEmail;
      if (!confirm(`Remover ${email} como administrador?`)) return;
      await removeAdmin(email);
      openAdminManager(); // recarrega
    });
  });

  document.getElementById('btn-add-admin')?.addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email')?.value?.trim();
    const name  = document.getElementById('new-admin-name')?.value?.trim();
    if (!email) { alert('Informe o e-mail.'); return; }
    await addAdmin(email, name);
    openAdminManager(); // recarrega
  });
}
