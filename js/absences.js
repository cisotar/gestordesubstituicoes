/**
 * absences.js — Gestão de faltas e substituições com datas reais.
 *
 * Ranking de candidatos:
 *   1. Filtra disponíveis no horário (sem aula + sem sub já atribuída naquela data/slot)
 *   2. Ordena por carga semanal ASC (aulas cadastradas + subs assumidas na semana)
 *   3. Desempate: mesma matéria (0) < mesma área (1) < outros (2)
 */

import { state, saveState } from './state.js';
import { uid }              from './helpers.js';
import { DAYS }             from './constants.js';

// ─── Helpers de data ──────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' → Date (UTC noon para evitar timezone issues) */
export const parseDate = (s) => new Date(s + 'T12:00:00');

/** Date → 'YYYY-MM-DD' */
export const formatISO = (d) => d.toISOString().split('T')[0];

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
export const formatBR = (s) => {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

/** Date → índice do dia da semana (0=Dom … 6=Sáb) */
const dayIdx = (d) => d.getDay();

/** 'YYYY-MM-DD' → label do dia ('Segunda', 'Terça'…) ou null se fim de semana */
export const dateToDayLabel = (s) => {
  const idx = parseDate(s).getDay(); // 0=Dom, 1=Seg…
  return idx >= 1 && idx <= 5 ? DAYS[idx - 1] : null;
};

/** Retorna a segunda-feira da semana de uma data */
export const weekStart = (s) => {
  const d = parseDate(s);
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return formatISO(d);
};

/** Gera array de datas ['YYYY-MM-DD', …] entre from e to (inclusive, apenas dias úteis) */
export function businessDaysBetween(from, to) {
  const result = [];
  const cur = parseDate(from);
  const end = parseDate(to);
  while (cur <= end) {
    const idx = cur.getDay();
    if (idx >= 1 && idx <= 5) result.push(formatISO(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

// ─── Carga horária ────────────────────────────────────────────────────────────

/**
 * Carga mensal de um professor do início do mês até a data de referência (inclusive).
 * = aulas cadastradas × semanas do período + substituições assumidas no período.
 *
 * Na prática conta:
 *   - Cada aula recorrente do professor que cai nos dias úteis já transcorridos do mês
 *   - Substituições assumidas no mesmo período (incluindo as do próprio dia)
 */
export function monthlyLoad(teacherId, referenceDate) {
  // Início do mês da data de referência
  const ref      = parseDate(referenceDate);
  const monthStart = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2,'0')}-01`;

  // Conta aulas recorrentes nos dias úteis do período (monthStart → referenceDate)
  const days = businessDaysBetween(monthStart, referenceDate);
  const scheduledLoad = days.reduce((acc, d) => {
    const dayLabel = dateToDayLabel(d);
    if (!dayLabel) return acc;
    return acc + state.schedules.filter(
      s => s.teacherId === teacherId && s.day === dayLabel
    ).length;
  }, 0);

  // Conta substituições assumidas no período (inclui as do próprio dia)
  const subsLoad = (state.absences || []).reduce((acc, ab) => {
    return acc + ab.slots.filter(sl =>
      sl.substituteId === teacherId &&
      sl.date >= monthStart &&
      sl.date <= referenceDate
    ).length;
  }, 0);

  return scheduledLoad + subsLoad;
}

// mantém weeklyLoad para compatibilidade com outros módulos
export function weeklyLoad(teacherId, referenceDate) {
  const ws = weekStart(referenceDate);
  const we = (() => {
    const d = parseDate(ws);
    d.setDate(d.getDate() + 4);
    return formatISO(d);
  })();
  const scheduled = state.schedules.filter(s => s.teacherId === teacherId).length;
  const subs = (state.absences || []).reduce((acc, ab) => {
    return acc + ab.slots.filter(sl =>
      sl.substituteId === teacherId &&
      sl.date >= ws && sl.date <= we
    ).length;
  }, 0);
  return scheduled + subs;
}

// ─── Disponibilidade ─────────────────────────────────────────────────────────

/**
 * Verifica se um professor está ocupado num dado date+timeSlot.
 * Ocupado = tem aula cadastrada naquele dia da semana + slot,
 *           OU já foi designado substituto naquela data + slot.
 */
export function isBusy(teacherId, date, timeSlot) {
  const dayLabel = dateToDayLabel(date);
  if (!dayLabel) return true;

  const hasClass = state.schedules.some(
    s => s.teacherId === teacherId && s.day === dayLabel && s.timeSlot === timeSlot
  );
  if (hasClass) return true;

  return (state.absences || []).some(ab =>
    ab.slots.some(sl =>
      sl.substituteId === teacherId &&
      sl.date === date &&
      sl.timeSlot === timeSlot
    )
  );
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Retorna lista ranqueada de candidatos para cobrir uma aula.
 *
 * Regras (em ordem de prioridade):
 *   1. ⭐ Mesma matéria  → ordenados por menor carga mensal ASC
 *   2. 🔵 Mesma área     → ordenados por menor carga mensal ASC
 *   3. ⚪ Outros         → ordenados por menor carga mensal ASC
 *
 * Dentro de cada grupo, desempate por carga mensal (início do mês até o dia da sub).
 * "Ao aceitar sugestão" = seleciona o 1º da lista (menor carga do grupo mais próximo).
 *
 * @param {string} absentTeacherId
 * @param {string} date          'YYYY-MM-DD'
 * @param {string} timeSlot      'seg-fund|manha|3'
 * @param {string|null} subjectId  matéria da aula ausente
 * @returns {Array<{ teacher, load, match: 'subject'|'area'|'other' }>}
 */
export function rankCandidates(absentTeacherId, date, timeSlot, subjectId = null) {
  const absentAreaId = subjectId
    ? state.subjects.find(s => s.id === subjectId)?.areaId ?? null
    : null;

  const sameSubject = (t) => subjectId ? (t.subjectIds ?? []).includes(subjectId) : false;
  const sameArea    = (t) => absentAreaId
    ? (t.subjectIds ?? []).some(sid => state.subjects.find(s => s.id === sid)?.areaId === absentAreaId)
    : false;

  const matchScore  = (t) => sameSubject(t) ? 0 : sameArea(t) ? 1 : 2;

  // Candidatos disponíveis com carga mensal calculada
  const candidates = state.teachers
    .filter(t => t.id !== absentTeacherId && !isBusy(t.id, date, timeSlot))
    .map(t => ({
      teacher: t,
      load:    monthlyLoad(t.id, date),
      match:   sameSubject(t) ? 'subject' : sameArea(t) ? 'area' : 'other',
    }));

  // Ordena: grupo (match) primeiro, desempate por carga mensal ASC
  return candidates.sort((a, b) => {
    const ga = matchScore(a.teacher);
    const gb = matchScore(b.teacher);
    if (ga !== gb) return ga - gb;
    return a.load - b.load;
  });
}

// ─── CRUD de ausências ────────────────────────────────────────────────────────

/**
 * Cria uma nova ausência com os slots selecionados.
 * @param {string} teacherId
 * @param {Array<{ date, timeSlot, scheduleId, subjectId, turma }>} rawSlots
 * @returns {string} id da ausência criada
 */
export function createAbsence(teacherId, rawSlots) {
  const absence = {
    id:        uid(),
    teacherId,
    createdAt: new Date().toISOString(),
    status:    'open',
    slots: rawSlots.map(s => ({
      id:           uid(),
      date:         s.date,
      day:          dateToDayLabel(s.date),
      timeSlot:     s.timeSlot,
      scheduleId:   s.scheduleId ?? null,
      subjectId:    s.subjectId  ?? null,
      turma:        s.turma      ?? '',
      substituteId: null,
    })),
  };

  if (!state.absences) state.absences = [];
  state.absences.push(absence);
  _syncSubs();
  saveState();
  return absence.id;
}

/** Atribui substituto a um slot de ausência */
export function assignSubstitute(absenceId, slotId, substituteId) {
  const slot = _findSlot(absenceId, slotId);
  if (!slot) return;
  slot.substituteId = substituteId || null;
  _updateStatus(absenceId);
  _syncSubs();
  saveState();
}

/** Remove uma ausência inteira */
export function deleteAbsence(id) {
  state.absences = (state.absences || []).filter(a => a.id !== id);
  import('./db.js').then(({ deleteDocById }) => deleteDocById('absences', id));
  _syncSubs();
  saveState();
}

/** Remove um slot de ausência */
export function deleteAbsenceSlot(absenceId, slotId) {
  const ab = state.absences?.find(a => a.id === absenceId);
  if (!ab) return;
  ab.slots = ab.slots.filter(s => s.id !== slotId);
  if (ab.slots.length === 0) {
    state.absences = state.absences.filter(a => a.id !== absenceId);
    import('./db.js').then(({ deleteDocById }) => deleteDocById('absences', absenceId));
  } else {
    _updateStatus(absenceId);
    import('./db.js').then(({ saveDoc }) => saveDoc('absences', ab));
  }
  _syncSubs();
  saveState();
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

function _findSlot(absenceId, slotId) {
  return state.absences?.find(a => a.id === absenceId)
    ?.slots.find(s => s.id === slotId) ?? null;
}

function _updateStatus(absenceId) {
  const ab = state.absences?.find(a => a.id === absenceId);
  if (!ab) return;
  const total   = ab.slots.length;
  const covered = ab.slots.filter(s => s.substituteId).length;
  ab.status = covered === 0 ? 'open'
    : covered < total ? 'partial'
    : 'covered';
}

/**
 * Mantém `state.subs` sincronizado com as ausências,
 * para que o calendário semanal continue funcionando.
 * Usa a semana atual como referência.
 */
function _syncSubs() {
  // Reconstrói subs apenas para ausências com substituto
  const newSubs = {};
  (state.absences || []).forEach(ab => {
    ab.slots.forEach(sl => {
      if (!sl.substituteId) return;
      const key = `${ab.teacherId}||${sl.day}||${sl.timeSlot}`;
      newSubs[key] = sl.substituteId;
    });
  });
  state.subs = newSubs;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Ausências de um professor, ordenadas por data mais recente */
export function absencesOf(teacherId) {
  return (state.absences || [])
    .filter(a => a.teacherId === teacherId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Todos os slots de ausência de uma semana (para o calendário) */
export function absenceSlotsInWeek(weekStartDate) {
  const ws = weekStartDate;
  const we = (() => {
    const d = parseDate(ws);
    d.setDate(d.getDate() + 4);
    return formatISO(d);
  })();
  return (state.absences || []).flatMap(ab =>
    ab.slots
      .filter(sl => sl.date >= ws && sl.date <= we)
      .map(sl => ({ ...sl, teacherId: ab.teacherId, absenceId: ab.id }))
  );
}

/**
 * Para um professor e dia da semana (label), retorna todas as aulas
 * cadastradas no schedule, enriquecidas com a data real (se fornecida).
 */
export function teacherDaySchedule(teacherId, dayLabel) {
  return state.schedules.filter(
    s => s.teacherId === teacherId && s.day === dayLabel
  );
}
