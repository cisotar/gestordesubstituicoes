/**
 * db.js — Camada de acesso ao Firestore.
 *
 * Estrutura das coleções:
 *   /meta/config          → segments, periodConfigs, areas, subjects, workloadWarn, workloadDanger
 *   /teachers/{id}        → { id, name, subjectIds, email?, whatsapp? }
 *   /schedules/{id}       → { id, teacherId, subjectId, turma, day, timeSlot }
 *   /absences/{id}        → { id, teacherId, createdAt, status, slots }
 *   /history/{id}         → entradas do histórico
 *   /admins/{emailHash}   → { email, name, addedAt }
 */

import { db }           from './firebase.js';
import { state }        from './state.js';
import {
  doc, getDoc, getDocs, setDoc, deleteDoc,
  collection, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ─── Carregamento inicial ─────────────────────────────────────────────────────

/**
 * Carrega todos os dados do Firestore para o state.
 * Chamado uma vez na inicialização do app.
 */
export async function loadFromFirestore() {
  try {
    await Promise.all([
      _loadConfig(),
      _loadCollection('teachers'),
      _loadCollection('schedules'),
      _loadCollection('absences'),
      _loadCollection('history'),
    ]);
    _migrateLegacyLocalStorage();
  } catch (e) {
    console.warn('[db] Falha ao carregar do Firestore, usando cache local:', e);
    _loadFromLocalStorage();
  }
}

async function _loadConfig() {
  const snap = await getDoc(doc(db, 'meta', 'config'));
  if (!snap.exists()) return;
  const data = snap.data();
  const keys = ['segments', 'periodConfigs', 'areas', 'subjects',
                 'workloadWarn', 'workloadDanger'];
  keys.forEach(k => { if (data[k] !== undefined) state[k] = data[k]; });
}

async function _loadCollection(name) {
  const snap = await getDocs(collection(db, name));
  if (snap.empty) return;
  state[name] = snap.docs.map(d => d.data());
}

// ─── Persistência ─────────────────────────────────────────────────────────────

/**
 * Persiste o estado atual no Firestore.
 * Usa batch writes para atomicidade.
 */
export async function saveToFirestore() {
  // Salva localmente também (fallback offline)
  _saveToLocalStorage();

  try {
    const batch = writeBatch(db);

    // /meta/config — dados de configuração
    batch.set(doc(db, 'meta', 'config'), {
      segments:       state.segments,
      periodConfigs:  state.periodConfigs,
      areas:          state.areas,
      subjects:       state.subjects,
      workloadWarn:   state.workloadWarn,
      workloadDanger: state.workloadDanger,
      updatedAt:      serverTimestamp(),
    });

    await batch.commit();

    // Teachers, schedules, absences, history em paralelo
    await Promise.all([
      _syncCollection('teachers',  state.teachers),
      _syncCollection('schedules', state.schedules),
      _syncCollection('absences',  state.absences  ?? []),
      _syncCollection('history',   state.history   ?? []),
    ]);

  } catch (e) {
    console.error('[db] Falha ao salvar no Firestore:', e);
    throw e;
  }
}

/**
 * Sincroniza um array de objetos com uma coleção do Firestore.
 * Faz upsert de todos os itens existentes.
 * Não remove itens deletados (feito por deleteFromFirestore).
 */
async function _syncCollection(name, items) {
  if (!items?.length) return;
  const CHUNK = 400; // limite do batch é 500
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db);
    items.slice(i, i + CHUNK).forEach(item => {
      batch.set(doc(db, name, item.id), item);
    });
    await batch.commit();
  }
}

// ─── Operações granulares (para atualizações imediatas) ───────────────────────

/** Salva um único documento numa coleção */
export async function saveDoc(collectionName, item) {
  _saveToLocalStorage();
  try {
    await setDoc(doc(db, collectionName, item.id), item);
  } catch (e) {
    console.error(`[db] Falha ao salvar ${collectionName}/${item.id}:`, e);
  }
}

/** Remove um único documento de uma coleção */
export async function deleteDocById(collectionName, id) {
  _saveToLocalStorage();
  try {
    await deleteDoc(doc(db, collectionName, id));
  } catch (e) {
    console.error(`[db] Falha ao remover ${collectionName}/${id}:`, e);
  }
}

/** Salva apenas /meta/config (para mudanças de configuração) */
export async function saveConfig() {
  _saveToLocalStorage();
  try {
    await setDoc(doc(db, 'meta', 'config'), {
      segments:       state.segments,
      periodConfigs:  state.periodConfigs,
      areas:          state.areas,
      subjects:       state.subjects,
      workloadWarn:   state.workloadWarn,
      workloadDanger: state.workloadDanger,
      updatedAt:      serverTimestamp(),
    });
  } catch (e) {
    console.error('[db] Falha ao salvar config:', e);
  }
}

// ─── Admins ───────────────────────────────────────────────────────────────────

/** E-mails com permissão de admin permanente (sem precisar estar no Firestore) */
const HARDCODED_ADMINS = [
  'contato.tarciso@gmail.com',
];

/** Verifica se um e-mail é administrador */
export async function isAdmin(email) {
  if (!email) return false;
  if (HARDCODED_ADMINS.includes(email.toLowerCase())) return true;
  try {
    const snap = await getDoc(doc(db, 'admins', _emailKey(email)));
    return snap.exists();
  } catch (e) {
    console.warn('[db] Falha ao verificar admin:', e);
    return false;
  }
}

/** Adiciona um e-mail como administrador */
export async function addAdmin(email, name = '') {
  await setDoc(doc(db, 'admins', _emailKey(email)), {
    email, name, addedAt: serverTimestamp(),
  });
}

/** Lista todos os administradores */
export async function listAdmins() {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map(d => d.data());
}

/** Remove um administrador */
export async function removeAdmin(email) {
  await deleteDoc(doc(db, 'admins', _emailKey(email)));
}

// ─── Professores (por e-mail) ─────────────────────────────────────────────────

/**
 * Retorna o professor aprovado com aquele e-mail, ou null.
 * Busca tanto no state (já carregado) quanto no Firestore.
 */
export async function getTeacherByEmail(email) {
  if (!email) return null;
  // Busca no state primeiro (evita round-trip)
  const { state } = await import('./state.js');
  const local = state.teachers.find(
    t => t.email?.toLowerCase() === email.toLowerCase()
  );
  if (local) return local;
  // Fallback: consulta Firestore
  try {
    const { getDocs: _getDocs, query: _q, where: _w } =
      await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await _getDocs(
      _q(collection(db, 'teachers'), _w('email', '==', email.toLowerCase()))
    );
    return snap.empty ? null : snap.docs[0].data();
  } catch (e) {
    return null;
  }
}

// ─── Professores pendentes ────────────────────────────────────────────────────

/**
 * Registra um professor pendente de aprovação.
 * Se já existe entrada para esse e-mail, não duplica.
 */
export async function requestTeacherAccess(user) {
  const key = _emailKey(user.email);
  const ref  = doc(db, 'pending_teachers', key);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // já registrado
  await setDoc(ref, {
    id:          key,
    email:       user.email.toLowerCase(),
    name:        user.displayName ?? '',
    photoURL:    user.photoURL    ?? '',
    requestedAt: serverTimestamp(),
    status:      'pending',
  });
}

/** Lista todos os professores pendentes */
export async function listPendingTeachers() {
  const snap = await getDocs(collection(db, 'pending_teachers'));
  return snap.docs.map(d => d.data()).filter(d => d.status === 'pending');
}

/**
 * Aprova um professor pendente:
 *  1. Remove de /pending_teachers
 *  2. Cria/atualiza entrada em /teachers (no state e no Firestore)
 */
export async function approveTeacher(pendingId) {
  const ref  = doc(db, 'pending_teachers', pendingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const { state } = await import('./state.js');
  const { uid }   = await import('./helpers.js');

  // Verifica se já existe no state pelo e-mail
  let teacher = state.teachers.find(
    t => t.email?.toLowerCase() === data.email
  );

  if (!teacher) {
    // Cria novo professor aprovado
    teacher = {
      id:          uid(),
      name:        data.name,
      email:       data.email,
      whatsapp:    '',
      celular:     '',
      subjectIds:  [],
      status:      'approved',
    };
    state.teachers.push(teacher);
  } else {
    teacher.status = 'approved';
    teacher.name   = teacher.name || data.name;
  }

  // Persiste no Firestore
  await setDoc(doc(db, 'teachers', teacher.id), teacher);
  await deleteDoc(ref);

  const { saveState } = await import('./state.js');
  saveState();
}

/** Rejeita e remove um professor pendente */
export async function rejectTeacher(pendingId) {
  await deleteDoc(doc(db, 'pending_teachers', pendingId));
}

// ─── Fallback localStorage ─────────────────────────────────────────────────────

const LS_KEY = 'gestao_v7_cache';

function _saveToLocalStorage() {
  try {
    const { segments, periodConfigs, areas, subjects, teachers,
            schedules, subs, absences, history,
            workloadWarn, workloadDanger } = state;
    localStorage.setItem(LS_KEY, JSON.stringify({
      segments, periodConfigs, areas, subjects, teachers,
      schedules, subs, absences, history, workloadWarn, workloadDanger,
    }));
  } catch (e) { /* storage full */ }
}

function _loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    const keys = ['segments','periodConfigs','areas','subjects','teachers',
                  'schedules','subs','absences','history','workloadWarn','workloadDanger'];
    keys.forEach(k => { if (p[k] !== undefined) state[k] = p[k]; });
  } catch (e) { /* parse error */ }
}

/**
 * Se havia dados no localStorage antigo (gestao_v3 ~ v7),
 * migra para o Firestore na primeira vez.
 */
async function _migrateLegacyLocalStorage() {
  const OLD_KEYS = ['gestao_v7','gestao_v6','gestao_v5','gestao_v4','gestao_v3'];
  for (const key of OLD_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const p = JSON.parse(raw);
      // Só migra se o Firestore estiver vazio
      if (state.teachers.length > 0) break;
      const keys = ['segments','periodConfigs','areas','subjects','teachers',
                    'schedules','subs','absences','history','workloadWarn','workloadDanger'];
      keys.forEach(k => { if (p[k] !== undefined) state[k] = p[k]; });
      await saveToFirestore();
      console.info(`[db] Dados migrados de ${key} para o Firestore.`);
      localStorage.removeItem(key);
    } catch (e) { /* ignore */ }
    break;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converte e-mail em chave segura para document ID */
const _emailKey = (email) => email.toLowerCase().replace(/[.#$/[\]]/g, '_');
