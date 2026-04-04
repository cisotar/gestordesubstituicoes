import { toast } from './toast.js';
import { state, saveState }    from './state.js';
import { uid, findTurma }      from './helpers.js';
import { updateNav, navigate } from './nav.js';
import { renderSettings }      from './render.js';
import { COLOR_PALETTE }       from './constants.js';
import { defaultCfg }          from './periods.js';

// ─── Segmentos ────────────────────────────────────────────────────────────────

export function addSegment(name, turno = 'manha') {
  if (!name?.trim()) return;
  const seg = { id: uid(), name: name.trim(), turno, grades: [] };
  state.segments.push(seg);
  if (!state.periodConfigs) state.periodConfigs = {};
  state.periodConfigs[seg.id] = { [turno]: defaultCfg(turno) };
  saveState(`Segmento '${seg.name}' criado`); renderSettings();
}

/** Define o turno de um segmento e migra as classes automaticamente */
export function setSegmentTurno(segId, turno) {
  const seg = state.segments.find(s => s.id === segId);
  if (!seg) return;
  seg.turno = turno;
  seg.grades.forEach(g => g.classes.forEach(c => { c.turno = turno; }));
  if (!state.periodConfigs)        state.periodConfigs = {};
  if (!state.periodConfigs[segId]) state.periodConfigs[segId] = {};
  if (!state.periodConfigs[segId][turno]) state.periodConfigs[segId][turno] = defaultCfg(turno);
  saveState(`Turno de '${seg.name}' alterado para ${turno}`); renderSettings();
}

export function removeSegment(id) {
  if (!confirm('Remover este segmento e todas as suas séries/turmas?')) return;
  const segName = state.segments.find(s => s.id === id)?.name ?? '';
  state.segments = state.segments.filter(s => s.id !== id);
  if (state.periodConfigs) delete state.periodConfigs[id];
  saveState(`Segmento '${segName}' removido`); renderSettings();
}

export function addGrade(segId, gradeName) {
  if (!gradeName?.trim()) return;
  const seg = state.segments.find(s => s.id === segId);
  if (!seg || seg.grades.find(g => g.name === gradeName.trim())) return;
  seg.grades.push({ name: gradeName.trim(), classes: [] });
  saveState(`Série '${gradeName.trim()}' adicionada`); renderSettings();
}

export function removeGrade(segId, gradeName) {
  const seg = state.segments.find(s => s.id === segId);
  if (!seg) return;
  seg.grades = seg.grades.filter(g => g.name !== gradeName);
  saveState(`Série '${gradeName}' removida`); renderSettings();
}

/** Adiciona uma letra de turma a uma série — turno herdado do segmento */
export function addClassToGrade(segId, gradeName, letter) {
  const seg   = state.segments.find(s => s.id === segId);
  const grade = seg?.grades.find(g => g.name === gradeName);
  if (!grade || !letter?.trim()) return;
  const up    = letter.trim().toUpperCase();
  if (grade.classes.find(c => c.letter === up)) return;
  const turno = seg.turno ?? 'manha';
  grade.classes.push({ letter: up, turno });
  grade.classes.sort((a, b) => a.letter.localeCompare(b.letter));
  saveState(`Turma ${up} adicionada`); renderSettings();
}

export function removeClassFromGrade(segId, gradeName, letter) {
  const seg   = state.segments.find(s => s.id === segId);
  const grade = seg?.grades.find(g => g.name === gradeName);
  if (!grade) return;
  grade.classes = grade.classes.filter(c => c.letter !== letter);
  saveState(`Turma ${letter} removida`); renderSettings();
}

/** Atualiza o turno de uma turma específica */
export function setClassTurno(segId, gradeName, letter, turno) {
  const seg   = state.segments.find(s => s.id === segId);
  const grade = seg?.grades.find(g => g.name === gradeName);
  const cls   = grade?.classes.find(c => c.letter === letter);
  if (!cls) return;
  cls.turno = turno;
  saveState('Alterações salvas'); renderSettings();
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
  saveState('Alterações salvas'); renderSettings();
}

export function removeIntervalo(segId, turno, idx) {
  const cfg = state.periodConfigs?.[segId]?.[turno];
  if (!cfg?.intervalos) return;
  cfg.intervalos.splice(idx, 1);
  saveState('Alterações salvas'); renderSettings();
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
  saveState('Alterações salvas'); renderSettings();
  return added;
}

export function removeArea(id) {
  const linked = state.subjects.filter(s => s.areaId === id).length;
  if (linked > 0 && !confirm(`Esta área tem ${linked} matéria(s). Remover mesmo assim?`)) return;
  const removedIds = new Set(state.subjects.filter(s => s.areaId === id).map(s => s.id));
  state.areas    = state.areas.filter(a => a.id !== id);
  state.subjects = state.subjects.filter(s => s.areaId !== id);
  state.teachers.forEach(t => { t.subjectIds = t.subjectIds.filter(sid => !removedIds.has(sid)); });
  saveState('Alterações salvas'); renderSettings();
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
  saveState('Alterações salvas'); renderSettings();
  return added;
}

export function removeSubject(id) {
  state.subjects = state.subjects.filter(s => s.id !== id);
  state.teachers.forEach(t => { t.subjectIds = t.subjectIds.filter(sid => sid !== id); });
  saveState('Alterações salvas'); renderSettings();
}

// ─── Professores ─────────────────────────────────────────────────────────────

export function addTeachersBulk(rawText) {
  const names = rawText.split('\n').map(s => s.trim()).filter(Boolean);
  let added = 0;
  names.forEach(name => {
    if (state.teachers.find(t => t.name.toLowerCase() === name.toLowerCase())) return;
    state.teachers.push({ id: uid(), name, subjectIds: [], email: '', whatsapp: '', celular: '' });
    added++;
  });
  saveState(`${added} professor${added !== 1 ? 'es' : ''} adicionado${added !== 1 ? 's' : ''}`); updateNav(); renderSettings();
  return added;
}

export function addTeacher() {
  const el   = document.getElementById('t-name');
  const name = el?.value?.trim();
  if (!name) { el?.focus(); return; }
  if (state.teachers.find(t => t.name.toLowerCase() === name.toLowerCase())) {
    alert('Professor já cadastrado.'); return;
  }
  state.teachers.push({ id: uid(), name, subjectIds: [], email: '', whatsapp: '', celular: '' });
  saveState(`Professor '${name}' cadastrado`); updateNav(); renderSettings();
  setTimeout(() => el?.focus(), 30);
}

export function removeTeacher(id) {
  const t = state.teachers.find(x => x.id === id);
  if (!t || !confirm(`Remover "${t.name}"?`)) return;
  const tName = t.name;
  state.teachers  = state.teachers.filter(x => x.id !== id);
  state.schedules = state.schedules.filter(s => s.teacherId !== id);
  Object.keys(state.subs).forEach(k => {
    if (k.startsWith(id + '||') || state.subs[k] === id) delete state.subs[k];
  });
  saveState(`Professor '${tName}' removido`); updateNav(); renderSettings();
}

export function saveTeacherSubjects(teacherId, subjectIds) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;
  const removedIds = (teacher.subjectIds ?? []).filter(id => !subjectIds.includes(id));
  teacher.subjectIds = subjectIds;
  // Atualiza horários cujo subjectId foi removido
  if (removedIds.length) {
    const newSingle = subjectIds.length === 1 ? subjectIds[0] : null;
    state.schedules.forEach(s => {
      if (s.teacherId === teacherId && removedIds.includes(s.subjectId)) {
        s.subjectId = newSingle;
      }
    });
  }
  saveState('Alterações salvas'); renderSettings();
}

/** Salva os dados de contato de um professor */
export function saveTeacherContacts(teacherId, { email, whatsapp, celular }) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;
  teacher.email    = email    ?? teacher.email    ?? '';
  teacher.whatsapp = whatsapp ?? teacher.whatsapp ?? '';
  teacher.celular  = celular  ?? teacher.celular  ?? '';
  saveState('Alterações salvas'); renderSettings();
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

// ─── Disciplinas (áreas + matérias unificadas) ────────────────────────────────

/**
 * Adiciona uma nova área vazia.
 * Chamado pelo botão na aba Disciplinas.
 */
export function addAreaDisc(name) {
  if (!name?.trim()) return;
  if (state.areas.find(a => a.name.toLowerCase() === name.trim().toLowerCase())) {
    toast('Área já existe.', 'warn'); return;
  }
  const colorIdx = state.areas.length % 9;
  state.areas.push({ id: uid(), name: name.trim(), colorIdx });
  saveState(`Área '${name.trim()}' criada`);
  import('./render.js').then(({ renderSettings }) => renderSettings());
}

/**
 * Salva o nome e as matérias de uma área a partir do bloco da UI.
 * Lê o input de nome e o textarea de matérias diretamente do DOM.
 */
export function saveAreaBlock(areaId, auto = false) {
  const area = state.areas.find(a => a.id === areaId);
  if (!area) return;

  const nameEl = document.getElementById(`disc-name-${areaId}`);
  const txtEl  = document.getElementById(`disc-txt-${areaId}`);
  if (!nameEl || !txtEl) return;

  const newName = nameEl.value.trim();
  if (!newName) { nameEl.focus(); toast('O nome da área não pode ser vazio.', 'warn'); return; }

  // Atualiza nome
  area.name = newName;

  // Processa as matérias do textarea (uma por linha, ignora vazias e duplicatas)
  const lines = txtEl.value.split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  // Remove matérias antigas desta área que não estão mais na lista
  const toRemove = state.subjects.filter(
    s => s.areaId === areaId && !lines.includes(s.name)
  );
  toRemove.forEach(s => {
    state.subjects = state.subjects.filter(x => x.id !== s.id);
    // Remove dos professores também
    state.teachers.forEach(t => {
      t.subjectIds = (t.subjectIds ?? []).filter(id => id !== s.id);
    });
  });

  // Adiciona matérias novas
  lines.forEach(name => {
    if (!state.subjects.find(s => s.areaId === areaId && s.name === name)) {
      state.subjects.push({ id: uid(), name, areaId });
    }
  });

  saveState(auto ? 'Disciplinas salvas automaticamente' : 'Disciplinas salvas');

  // Atualiza o contador no header do bloco sem re-renderizar tudo
  const block = document.getElementById(`disc-block-${areaId}`);
  if (block) {
    const ct = state.subjects.filter(s => s.areaId === areaId).length;
    const span = block.querySelector('.ti-dot + input + div span, .disc-block-hdr span');
    // Atualiza o span de contagem
    const spans = block.querySelectorAll('span');
    spans.forEach(sp => {
      if (sp.textContent.match(/\d+ disciplina/)) {
        sp.textContent = `${ct} disciplina${ct !== 1 ? 's' : ''}`;
      }
    });
  }

  // toast já é emitido pelo saveState
}

/**
 * Remove uma área e todas as suas matérias.
 */
export function removeAreaDisc(areaId) {
  const area = state.areas.find(a => a.id === areaId);
  if (!area) return;
  if (!confirm(`Remover a área "${area.name}" e todas as suas disciplinas?`)) return;

  // Remove matérias
  const subIds = state.subjects.filter(s => s.areaId === areaId).map(s => s.id);
  state.subjects = state.subjects.filter(s => s.areaId !== areaId);
  state.teachers.forEach(t => {
    t.subjectIds = (t.subjectIds ?? []).filter(id => !subIds.includes(id));
  });

  const aName = state.areas.find(a => a.id === areaId)?.name ?? '';
  state.areas = state.areas.filter(a => a.id !== areaId);
  saveState(`Área '${aName}' removida`);

  document.getElementById(`disc-block-${areaId}`)?.remove();
}

// ─── Toast ────────────────────────────────────────────────────────────────────

