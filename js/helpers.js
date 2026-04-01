import { state }                        from './state.js';
import { COLOR_PALETTE, COLOR_NEUTRAL }  from './constants.js';

/** Gera ID único */
export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Escapa HTML */
export const h = (s) =>
  String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                 .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/** Chave composta para substituições */
export const subKey = (teacherId, day, slot) => `${teacherId}||${day}||${slot}`;

/** Retorna o substituto, ou undefined */
export function getSubstitute(teacherId, day, slot) {
  const subId = state.subs[subKey(teacherId, day, slot)];
  return subId ? state.teachers.find(t => t.id === subId) : undefined;
}

// ─── Cores ───────────────────────────────────────────────────────────────────

export function colorOfAreaId(areaId) {
  const area = state.areas.find(a => a.id === areaId);
  return area ? COLOR_PALETTE[area.colorIdx % COLOR_PALETTE.length] : COLOR_NEUTRAL;
}

export function colorOfArea(area) {
  if (!area) return COLOR_NEUTRAL;
  return COLOR_PALETTE[area.colorIdx % COLOR_PALETTE.length];
}

export function colorOfTeacher(teacher) {
  if (!teacher?.subjectIds?.length) return COLOR_NEUTRAL;
  const subject = state.subjects.find(s => teacher.subjectIds.includes(s.id));
  return subject ? colorOfAreaId(subject.areaId) : COLOR_NEUTRAL;
}

// ─── Turmas ──────────────────────────────────────────────────────────────────

/**
 * Retorna todas as turmas como objetos com metadados completos.
 * @returns {Array<{ label, segmentId, segmentName, gradeName, letter, turno }>}
 */
export function allTurmaObjects() {
  return state.segments.flatMap(seg =>
    seg.grades.flatMap(grade =>
      (grade.classes ?? []).map(cls => ({
        label:       `${grade.name} ${cls.letter}`,
        segmentId:   seg.id,
        segmentName: seg.name,
        gradeName:   grade.name,
        letter:      cls.letter,
        turno:       cls.turno ?? 'manha',
      }))
    )
  );
}

/** Retorna apenas os labels das turmas (retro-compat) */
export function allTurmas() {
  return allTurmaObjects().map(t => t.label);
}

/** Encontra o objeto turma pelo label */
export function findTurma(label) {
  return allTurmaObjects().find(t => t.label === label) ?? null;
}

// ─── Nomes de matérias ───────────────────────────────────────────────────────

export function teacherSubjectNames(teacher) {
  return (teacher?.subjectIds ?? [])
    .map(sid => state.subjects.find(s => s.id === sid)?.name)
    .filter(Boolean)
    .join(', ');
}
