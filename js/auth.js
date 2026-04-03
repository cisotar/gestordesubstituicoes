/**
 * auth.js — Autenticação via Google com três papéis:
 *
 *   'admin'    → acesso total
 *   'teacher'  → vê calendário, edita próprios dados e horários
 *   'pending'  → aguardando aprovação do admin (vê só calendário público)
 *   null       → não logado (visitante)
 */

import { auth, provider }         from './firebase.js';
import { signInWithPopup, signOut,
         onAuthStateChanged }     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { isAdmin, addAdmin, listAdmins, removeAdmin,
         getTeacherByEmail, requestTeacherAccess,
         listPendingTeachers }    from './db.js';
import { h }                      from './helpers.js';

// ─── Estado global ────────────────────────────────────────────────────────────

export const authState = {
  user:       null,       // Firebase Auth user
  role:       null,       // 'admin' | 'teacher' | 'pending' | null
  teacher:    null,       // objeto teacher do state (se role === 'teacher')
  loading:    true,
  pendingCt:  0,          // qtd de professores aguardando aprovação
};

// Aliases de conveniência
export const isAdminRole   = () => authState.role === 'admin';
export const isTeacherRole = () => authState.role === 'teacher';
export const isPending     = () => authState.role === 'pending';

// ─── Inicialização ────────────────────────────────────────────────────────────

export function initAuth() {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      authState.user    = user;
      authState.role    = null;
      authState.teacher = null;

      if (user) {
        await _resolveRole(user);
      }

      authState.loading = false;
      renderAuthBar();
      updateAdminUI();
      _updatePendingBadge();
      resolve();
    });
  });
}

async function _resolveRole(user) {
  // 1. Admin?
  if (await isAdmin(user.email)) {
    authState.role = 'admin';
    try {
      authState.pendingCt = (await listPendingTeachers()).length;
    } catch (e) {
      authState.pendingCt = 0;
    }
    return;
  }

  // 2. Professor aprovado?
  try {
    const teacher = await getTeacherByEmail(user.email);
    if (teacher && teacher.status === 'approved') {
      authState.role    = 'teacher';
      authState.teacher = teacher;
      return;
    }
  } catch (e) {
    console.warn('[auth] Falha ao buscar professor:', e);
  }

  // 3. Pendente ou novo → registra solicitação
  authState.role = 'pending';
  try {
    await requestTeacherAccess(user);
  } catch (e) {
    console.warn('[auth] Falha ao registrar acesso pendente:', e);
  }
}

// ─── Login / Logout ───────────────────────────────────────────────────────────

export async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      alert('Erro ao fazer login: ' + e.message);
    }
  }
}

export async function logout() {
  await signOut(auth);
}

// ─── Guards ───────────────────────────────────────────────────────────────────

export function requireAdmin() {
  if (isAdminRole()) return true;
  alert('Acesso restrito a administradores.');
  return false;
}

export function requireTeacherOrAdmin() {
  if (isAdminRole() || isTeacherRole()) return true;
  alert('Acesso restrito. Faça login como professor ou administrador.');
  return false;
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

export function renderAuthBar() {
  const bar = document.getElementById('auth-bar');
  if (!bar) return;

  if (authState.loading) {
    bar.innerHTML = `<span style="font-size:12px;color:rgba(255,255,255,.4)">⏳</span>`;
    return;
  }

  if (!authState.user) {
    bar.innerHTML = `
      <button class="auth-btn" id="btn-login-teacher">
        ${_googleIcon()}
        Entrar
      </button>`;
    document.getElementById('btn-login-teacher')?.addEventListener('click', login);
    return;
  }

  const roleBadge = {
    admin:   `<span class="auth-admin-badge">● Admin</span>`,
    teacher: `<span style="font-size:11px;color:#86EFAC;font-weight:700">● Professor</span>`,
    pending: `<span style="font-size:11px;color:#FCD34D;font-weight:700">⏳ Aguardando aprovação</span>`,
  }[authState.role] ?? `<span style="font-size:11px;color:#FCA5A5">Sem acesso</span>`;

  const pendingBadge = authState.pendingCt > 0
    ? `<span class="pending-badge">${authState.pendingCt}</span>` : '';

  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px">
      ${authState.user.photoURL
        ? `<img src="${authState.user.photoURL}" alt=""
            style="width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.2)">`
        : ''}
      <div style="line-height:1.3">
        <div style="font-size:12px;font-weight:600;color:#fff">
          ${h(authState.user.displayName ?? authState.user.email)}
        </div>
        ${roleBadge}
      </div>
      ${isAdminRole() ? `
        <button class="auth-btn auth-btn-sm" id="btn-pending" title="Aprovar professores">
          👩‍🏫${pendingBadge}
        </button>
        <button class="auth-btn auth-btn-sm" id="btn-admins" title="Gerenciar admins">⚙</button>
      ` : ''}
      ${isTeacherRole() ? `
        <button class="auth-btn auth-btn-sm" id="btn-profile" title="Meu perfil">👤</button>
      ` : ''}
      <button class="auth-btn auth-btn-sm" id="btn-logout">Sair</button>
    </div>`;

  document.getElementById('btn-logout')  ?.addEventListener('click', logout);
  document.getElementById('btn-admins')  ?.addEventListener('click', openAdminManager);
  document.getElementById('btn-pending') ?.addEventListener('click', openPendingManager);
  document.getElementById('btn-profile') ?.addEventListener('click', openOwnProfile);
}

export function updateAdminUI() {
  document.querySelectorAll('[data-admin-only]').forEach(el => {
    el.style.display = isAdminRole() ? '' : 'none';
  });
  document.querySelectorAll('[data-teacher-or-admin]').forEach(el => {
    el.style.display = (isAdminRole() || isTeacherRole()) ? '' : 'none';
  });
  document.querySelectorAll('[data-hide-if-admin]').forEach(el => {
    el.style.display = isAdminRole() ? 'none' : '';
  });
}

function _updatePendingBadge() {
  const badge = document.getElementById('pending-count');
  if (badge) badge.textContent = authState.pendingCt || '';
  if (badge) badge.style.display = authState.pendingCt > 0 ? '' : 'none';
}

// ─── Modal: Aprovação de professores ─────────────────────────────────────────

export async function openPendingManager() {
  const overlay = document.getElementById('overlay');
  const body    = document.getElementById('modal-body');
  if (!overlay || !body) return;

  body.innerHTML = `<div style="padding:20px;text-align:center;color:var(--t2)">⏳ Carregando…</div>`;
  overlay.classList.add('on');

  const pending = await listPendingTeachers().catch(() => []);
  authState.pendingCt = pending.length;
  _updatePendingBadge();

  const rows = pending.map(p => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--bdr)">
      ${p.photoURL
        ? `<img src="${p.photoURL}" style="width:36px;height:36px;border-radius:50%">`
        : `<div style="width:36px;height:36px;border-radius:50%;background:var(--surf2);display:flex;align-items:center;justify-content:center;font-weight:700">${p.name.charAt(0)}</div>`}
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px">${h(p.name)}</div>
        <div style="font-size:12px;color:var(--t2)">${h(p.email)}</div>
      </div>
      <button class="btn btn-dark btn-sm" data-approve="${p.id}">✓ Aprovar</button>
      <button class="btn-del" data-reject="${p.id}">✕</button>
    </div>`).join('');

  body.innerHTML = `
    <div class="m-hdr">
      <h3 style="font-size:17px">Professores Aguardando Aprovação</h3>
      <button class="m-close" onclick="document.getElementById('overlay').classList.remove('on')">×</button>
    </div>
    <div style="min-height:60px">
      ${pending.length === 0
        ? '<p style="color:var(--t3);text-align:center;padding:20px 0">Nenhum professor aguardando aprovação.</p>'
        : rows}
    </div>`;

  body.querySelectorAll('[data-approve]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { approveTeacher } = await import('./db.js');
      await approveTeacher(btn.dataset.approve);
      openPendingManager();
    });
  });

  body.querySelectorAll('[data-reject]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Rejeitar este professor?')) return;
      const { rejectTeacher } = await import('./db.js');
      await rejectTeacher(btn.dataset.reject);
      openPendingManager();
    });
  });
}

// ─── Modal: Perfil do professor logado ────────────────────────────────────────

async function openOwnProfile() {
  const { renderProfileModal } = await import('./profile.js');
  renderProfileModal(authState.teacher);
}

// ─── Modal: Gerenciar admins ──────────────────────────────────────────────────

async function openAdminManager() {
  const overlay = document.getElementById('overlay');
  const body    = document.getElementById('modal-body');
  if (!overlay || !body) return;

  body.innerHTML = `<div style="padding:20px;text-align:center;color:var(--t2)">⏳ Carregando…</div>`;
  overlay.classList.add('on');

  const admins = await listAdmins();

  const rows = admins.map(a => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr)">
      <div style="flex:1;font-size:14px">${h(a.name || a.email)}</div>
      <div style="font-size:12px;color:var(--t2)">${h(a.email)}</div>
      ${a.email !== authState.user?.email
        ? `<button class="btn-del" data-admin-email="${h(a.email)}">✕</button>`
        : `<span style="font-size:11px;color:var(--t3)">você</span>`}
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

  body.querySelectorAll('[data-admin-email]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Remover ${btn.dataset.adminEmail} como administrador?`)) return;
      await removeAdmin(btn.dataset.adminEmail);
      openAdminManager();
    });
  });

  document.getElementById('btn-add-admin')?.addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email')?.value?.trim();
    const name  = document.getElementById('new-admin-name')?.value?.trim();
    if (!email) { alert('Informe o e-mail.'); return; }
    await addAdmin(email, name);
    openAdminManager();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _googleIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" style="flex-shrink:0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>`;
}
