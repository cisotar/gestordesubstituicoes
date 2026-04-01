import { state, saveState } from './state.js';
import { uid }    from './helpers.js';

/**
 * Registra uma substituição no histórico permanente.
 * @param {string} teacherId  - ID do professor ausente
 * @param {string} day        - Dia da semana ('Segunda', etc.)
 * @param {string} slot       - Chave do tempo de aula
 * @param {string} subId      - ID do professor substituto
 * @param {string} date       - Data no formato 'YYYY-MM-DD'
 */
export function recordSubstitution(teacherId, day, slot, subId, date) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  const sub     = state.teachers.find(t => t.id === subId);

  state.history.push({
    id:          uid(),
    teacherId,
    teacherName: teacher?.name  ?? 'Professor removido',
    teacherArea: teacher?.area  ?? '',
    subId,
    subName:     sub?.name      ?? 'Professor removido',
    subArea:     sub?.area      ?? '',
    day,
    slot,
    slotLabel: slot,
    date,
    registeredAt: new Date().toISOString(),
  });

  saveState();
}

/**
 * Retorna entradas do histórico com filtros opcionais,
 * ordenadas da mais recente para a mais antiga.
 * @param {{ teacherId?, subId?, from?, to? }} filters
 */
export function getHistory({ teacherId, subId, from, to } = {}) {
  return state.history
    .filter(h => !teacherId || h.teacherId === teacherId || h.subId === teacherId)
    .filter(h => !subId     || h.subId === subId)
    .filter(h => !from      || h.date >= from)
    .filter(h => !to        || h.date <= to)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.registeredAt.localeCompare(a.registeredAt));
}

/** Remove uma entrada do histórico pelo ID */
export function deleteHistoryEntry(id) {
  state.history = state.history.filter(h => h.id !== id);
  saveState();
}

/**
 * Estatísticas consolidadas de um professor.
 * @returns {{ schedules, absences, subsGiven, workloadRatio }}
 */
export function getTeacherStats(teacherId) {
  const schedules  = state.schedules.filter(s => s.teacherId === teacherId).length;
  const absences   = state.history.filter(h => h.teacherId === teacherId).length;
  const subsGiven  = state.history.filter(h => h.subId     === teacherId).length;
  const maxLoad    = state.workloadDanger || 26;
  const workloadRatio = Math.min(schedules / maxLoad, 1);
  return { schedules, absences, subsGiven, workloadRatio };
}

/**
 * Lista todos os professores com alertas de sobrecarga.
 * @returns {Array<{ teacher, schedules, level }>}
 */
export function getOverloadedTeachers() {
  const warn   = state.workloadWarn   || 20;
  const danger = state.workloadDanger || 26;
  return state.teachers
    .map(t => {
      const count = state.schedules.filter(s => s.teacherId === t.id).length;
      return { teacher: t, schedules: count };
    })
    .filter(({ schedules }) => schedules >= warn)
    .map(item => ({
      ...item,
      level: item.schedules >= danger ? 'danger' : 'warn',
    }))
    .sort((a, b) => b.schedules - a.schedules);
}

/** Formata 'YYYY-MM-DD' como 'DD/MM/YYYY' */
export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
