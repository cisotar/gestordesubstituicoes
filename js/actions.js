import { state, saveState }    from './state.js';
import { uid, findTurma }      from './helpers.js';
import { updateNav, navigate } from './nav.js';
import { renderSettings }      from './render.js';
import { COLOR_PALETTE }       from './constants.js';
import { defaultCfg }          from './periods.js';

// ─── Segmentos ────────────────────────────────────────────────────────────────

export function addSegment(name) {
  if (!name?.trim()) return;
  state.segments.push({ id: uid(), name: name.trim(), grades: [] });
  // Inicializa config de períodos para o novo segmento
  if (!state.periodConfigs) state.periodConfigs = {};
  const segId = state.segments[state.segments.length - 1].id;
  state.periodConfigs[segId] = {
    manha: defaultCfg('manha'),
    tarde: defaultCfg('tarde'),
  };
  saveState(); renderSettings();
}

export function removeSegment(id) {
  if (!confirm('Remover este segmento e todas as suas séries/turmas?')) return;
  state.segments = state.segments.filter(s => s.id !== id);
  if (state.periodConfigs) delete state.periodConfigs[id];
  saveState(); renderSettings();
}

export function addGrade(segId, gradeName) {
  if (!gradeName?.trim()) return;
  const seg = state.segments.find(s => s.id === segId);
  if (!seg || seg.grades.find(g => g.name === gradeName.trim())) return;
  seg.grades.push({ name: gradeName.trim(), classes: [] });
  saveState(); renderSettings();
}

export function removeGrade(segId, gradeName) {
  const seg = state.segments.find(s => s.id === segId);
  if (!seg) return;
  seg.grades = seg.grades.filter(g => g.name !== gradeName);
  saveState(); renderSettings();
}

/** Adiciona uma letra de turma a uma série, com turno */
export function addClassToGrade(segId, gradeName, letter, turno = 'manha') {
  const seg   = state.segments.find(s => s.id === segId);
  const grade = seg?.grades.find(g => g.name === gradeName);
  if (!grade || !letter?.trim()) return;
  const up = letter.trim().toUpperCase();
  if (grade.classes.find(c => c.letter === up)) return;
  grade.classes.push({ letter: up, turno });
  grade.classes.sort((a, b) => a.letter.localeCompare(b.letter));
  saveState(); renderSettings();
}

export function removeClassFromGrade(segId, gradeName, letter) {
  const seg   = state.segments.find(s => s.id === segId);
  const grade = seg?.grades.find(g => g.name === gradeName);
  if (!grade) return;
  grade.classes = grade.classes.filter(c => c.letter !== letter);
  saveState(); renderSettings();
}

/** Atualiza o turno de uma turma específica */
export function setClassTurno(segId, gradeName, letter, turno) {
  const seg   = state.segments.find(s => s.id === segId);
  const grade = seg?.grades.find(g => g.name === gradeName);
  const cls   = grade?.classes.find(c => c.letter === letter);
  if (!cls) return;
  cls.turno = turno;
  saveState(); renderSettings();
}

// ─── Configuração de Períodos ────────────────────────────────────────────────

export function savePeriodCfg(segId, turno, cfg) {
  if (!state.periodConfigs)         state.periodConfigs = {};
  if (!state.periodConfigs[segId])  state.periodConfigs[segId] = {};
  state.periodConfigs[segId][turno] = cfg;
  saveState();
}

export function addIntervalo(segId, turno) {
  const cfg = state.periodConfigs?.[segId]?.[turno];
  if (!cfg) return;
  if (!cfg.intervalos) cfg.intervalos = [];
  const ultimo = cfg.intervalos.slice(-1)[0];
  cfg.intervalos.push({ apos: ultimo ? Math.min(ultimo.apos + 1, cfg.qtd) : 3, duracao: 20 });
  saveState(); renderSettings();
}

export function removeIntervalo(segId, turno, idx) {
  const cfg = state.periodConfigs?.[segId]?.[turno];
  if (!cfg?.intervalos) return;
  cfg.intervalos.splice(idx, 1);
  saveState(); renderSettings();
}

// ─── Áreas ────────────────────────────────────────────────────────────────────

export function addAreasBulk(rawText) {
  const names = rawText.split('\n').map(s => s.trim()).filter(Boolean);
  let added = 0;
  names.forEach(name => {
    if (state.areas.find(a => a.name.toLowerCase() === name.toLowerCase())) return;
    state.areas.push({ id: uid(), name, colorIdx: state.areas.length });
    added++;
  });
  saveState(); renderSettings();
  return added;
}

export function removeArea(id) {
  const linked = state.subjects.filter(s => s.areaId === id).length;
  if (linked > 0 && !confirm(`Esta área tem ${linked} matéria(s). Remover mesmo assim?`)) return;
  const removedIds = new Set(state.subjects.filter(s => s.areaId === id).map(s => s.id));
  state.areas    = state.areas.filter(a => a.id !== id);
  state.subjects = state.subjects.filter(s => s.areaId !== id);
  state.teachers.forEach(t => { t.subjectIds = t.subjectIds.filter(sid => !removedIds.has(sid)); });
  saveState(); renderSettings();
}

// ─── Matérias ─────────────────────────────────────────────────────────────────

export function addSubjectsBulk(areaId, rawText) {
  const area = state.areas.find(a => a.id === areaId);
  if (!area) return 0;
  const names = rawText.split('\n').map(s => s.trim()).filter(Boolean);
  let added = 0;
  names.forEach(name => {
    if (state.subjects.find(s => s.areaId === areaId && s.name.toLowerCase() === name.toLowerCase())) return;
    state.subjects.push({ id: uid(), name, areaId });
    added++;
  });
  saveState(); renderSettings();
  return added;
}

export function removeSubject(id) {
  state.subjects = state.subjects.filter(s => s.id !== id);
  state.teachers.forEach(t => { t.subjectIds = t.subjectIds.filter(sid => sid !== id); });
  saveState(); renderSettings();
}

// ─── Professores ─────────────────────────────────────────────────────────────

export function addTeachersBulk(rawText) {
  const names = rawText.split('\n').map(s => s.trim()).filter(Boolean);
  let added = 0;
  names.forEach(name => {
    if (state.teachers.find(t => t.name.toLowerCase() === name.toLowerCase())) return;
    state.teachers.push({ id: uid(), name, subjectIds: [] });
    added++;
  });
  saveState(); updateNav(); renderSettings();
  return added;
}

export function addTeacher() {
  const el   = document.getElementById('t-name');
  const name = el?.value?.trim();
  if (!name) { el?.focus(); return; }
  if (state.teachers.find(t => t.name.toLowerCase() === name.toLowerCase())) {
    alert('Professor já cadastrado.'); return;
  }
  state.teachers.push({ id: uid(), name, subjectIds: [] });
  saveState(); updateNav(); renderSettings();
  setTimeout(() => el?.focus(), 30);
}

export function removeTeacher(id) {
  const t = state.teachers.find(x => x.id === id);
  if (!t || !confirm(`Remover "${t.name}"?`)) return;
  state.teachers  = state.teachers.filter(x => x.id !== id);
  state.schedules = state.schedules.filter(s => s.teacherId !== id);
  Object.keys(state.subs).forEach(k => {
    if (k.startsWith(id + '||') || state.subs[k] === id) delete state.subs[k];
  });
  saveState(); updateNav(); renderSettings();
}

export function saveTeacherSubjects(teacherId, subjectIds) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;
  teacher.subjectIds = subjectIds;
  saveState(); renderSettings();
}

// ─── Horários ─────────────────────────────────────────────────────────────────

export function addSchedule() {
  const tid      = document.getElementById('s-t')?.value;
  const sid      = document.getElementById('s-sub')?.value;
  const turmaLbl = document.getElementById('s-trm')?.value;
  const day      = document.getElementById('s-day')?.value;
  const timeSlot = document.getElementById('s-slot')?.value;

  if (!tid || !turmaLbl || !timeSlot) { alert('Preencha todos os campos.'); return; }
  if (state.schedules.find(s => s.teacherId === tid && s.day === day && s.timeSlot === timeSlot)) {
    alert('Conflito: este professor já tem aula neste horário!'); return;
  }

  state.schedules.push({
    id: uid(), teacherId: tid, subjectId: sid || null,
    turma: turmaLbl, day, timeSlot,
  });
  saveState(); updateNav(); renderSettings();
}

export function removeSchedule(id) {
  state.schedules = state.schedules.filter(s => s.id !== id);
  saveState(); updateNav(); renderSettings();
}
