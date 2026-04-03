import { navigate, setSettingsTab }   from './nav.js';
import {
  openModal, closeModal,
  assignSubstitute, clearSubstitute,
  openTeacherSubjects, saveTeacherSubjectsFromModal,
  openEditTeacher, saveEditTeacher,
  openEditSchedule, saveEditSchedule,
} from './modal.js';
import {
  addTeacher, addTeachersBulk, removeTeacher,
  addAreasBulk, removeArea,
  addSubjectsBulk, removeSubject,
  addSegment, removeSegment, addGrade, removeGrade,
  addClassToGrade, removeClassFromGrade, setSegmentTurno,
  addSchedule, removeSchedule,
  savePeriodCfg, addIntervalo, removeIntervalo, saveTeacherSubjects,
  addAreaDisc, saveAreaBlock, removeAreaDisc, showToast,
} from './actions.js';
import { deleteHistoryEntry }   from './history.js';
import { renderDashboard }      from './dashboard.js';
import { renderSettings, schedUI } from './render.js';
import { printReport, exportPDF } from './report.js';
import { state }                from './state.js';
import { handleAbsenceAction }  from './absence-view.js';
import { getCfg, gerarPeriodos, makeSlot, slotsForTurma } from './periods.js';
import { h, findTurma }         from './helpers.js';

const v = id => document.getElementById(id)?.value ?? '';

// ─── Cascades ────────────────────────────────────────────────────────────────

/** Ao mudar professor → atualiza select de matérias */
function updateSubjectSelect(teacherId) {
  const el = document.getElementById('s-sub');
  if (!el) return;
  const teacher = state.teachers.find(t => t.id === teacherId);
  const subs = (teacher?.subjectIds ?? [])
    .map(sid => state.subjects.find(s => s.id === sid)).filter(Boolean);
  el.innerHTML = `<option value="">— sem matéria —</option>` +
    subs.map(s => `<option value="${s.id}">${h(s.name)}</option>`).join('');
}

/** Ao mudar turma → atualiza select de aulas (períodos gerados) */
function updateSlotSelect(turmaLabel) {
  const el = document.getElementById('s-slot');
  if (!el) return;
  const turmaObj = findTurma(turmaLabel);
  if (!turmaObj) { el.innerHTML = `<option value="">— selecione turma primeiro —</option>`; return; }
  const slots = slotsForTurma(turmaObj.segmentId, turmaObj.turno);
  const cfg   = getCfg(turmaObj.segmentId, turmaObj.turno);
  const aulas = gerarPeriodos(cfg).filter(p => !p.isIntervalo);
  el.innerHTML = `<option value="">Selecione…</option>` +
    slots.map((slot, i) => {
      const p = aulas[i];
      return `<option value="${h(slot)}">${h(p.label)} (${h(p.inicio)}–${h(p.fim)})</option>`;
    }).join('');
}

/** Live preview de configuração de período */
function updatePeriodPreview(segId, turno) {
  const el = document.getElementById(`preview-${segId}-${turno}`);
  if (!el) return;
  const cfg      = getCfg(segId, turno);
  const periodos = gerarPeriodos(cfg);
  el.innerHTML = periodos.map(p => p.isIntervalo
    ? `<div class="per-preview-iv">☕ Intervalo ${h(p.inicio)}–${h(p.fim)} (${p.duracao}min)</div>`
    : `<div class="per-preview-item"><strong>${h(p.label)}</strong> ${h(p.inicio)}–${h(p.fim)}</div>`
  ).join('');
}

/** Handler genérico para mudanças em inputs de config de período */
function handlePeriodoCfgChange(el) {
  const { seg, turno, campo } = el.dataset;
  if (!seg || !turno || !campo) return;
  const cfg = getCfg(seg, turno);
  if (!state.periodConfigs[seg]) state.periodConfigs[seg] = {};
  if (!state.periodConfigs[seg][turno]) state.periodConfigs[seg][turno] = { ...cfg };
  const target = state.periodConfigs[seg][turno];
  target[campo] = campo === 'inicio' ? el.value : Number(el.value);
  updatePeriodPreview(seg, turno);
  // Salva automaticamente (debounce trivial — sem timeout para clareza)
  import('./state.js').then(({ saveState }) => saveState());
}

function handleIvChange(el, campo) {
  const { seg, turno, idx } = el.dataset;
  if (!seg || !turno || idx === undefined) return;
  const cfg = getCfg(seg, turno);
  if (!state.periodConfigs[seg]) state.periodConfigs[seg] = {};
  if (!state.periodConfigs[seg][turno]) state.periodConfigs[seg][turno] = { ...cfg };
  const iv = state.periodConfigs[seg][turno].intervalos?.[Number(idx)];
  if (!iv) return;
  iv[campo] = campo === 'inicio' ? el.value : Number(el.value);
  updatePeriodPreview(seg, turno);
  import('./state.js').then(({ saveState }) => saveState());
}

// ─── Action map ──────────────────────────────────────────────────────────────

const ACTION_MAP = {
  // Navegação
  nav:                 el => navigate(el.dataset.page, el.dataset.tid ?? null),
  stab:                el => setSettingsTab(el.dataset.tab),

  // Segmentos
  addSegment:          ()  => addSegment(v('new-seg-name'), document.getElementById('new-seg-turno')?.value ?? 'manha'),
  removeSegment:       el  => removeSegment(el.dataset.id),
  addGrade:            el  => { addGrade(el.dataset.seg, v(`grade-inp-${el.dataset.seg}`)); },
  removeGrade:         el  => removeGrade(el.dataset.seg, el.dataset.val),
  addClassToGrade:     el  => {
    const key   = `${el.dataset.seg}-${el.dataset.grade.replace(/\W/g,'_')}`;
    const letter = v(`cls-inp-${key}`);
    const turno  = v(`cls-turno-${key}`);
    addClassToGrade(el.dataset.seg, el.dataset.grade, letter, turno);
    const inp = document.getElementById(`cls-inp-${key}`);
    if (inp) { inp.value = ''; inp.focus(); }
  },
  removeClassFromGrade: el => removeClassFromGrade(el.dataset.seg, el.dataset.grade, el.dataset.val),
  setSegmentTurno:      el => setSegmentTurno(el.dataset.seg, el.value),

  // Períodos — campos inline (disparam no `change`)
  editPeriodoCfg:  el => handlePeriodoCfgChange(el),
  editIvApos:      el => handleIvChange(el, 'apos'),
  editIvInicio:    el => handleIvChange(el, 'inicio'),
  editIvDuracao:   el => handleIvChange(el, 'duracao'),
  addIntervalo:    el => addIntervalo(el.dataset.seg, el.dataset.turno),
  removeIntervalo: el => removeIntervalo(el.dataset.seg, el.dataset.turno, Number(el.dataset.idx)),

  // Áreas
  addAreasBulk:    () => { const n = addAreasBulk(v('areas-bulk')); if (n) { const el = document.getElementById('areas-bulk'); if (el) el.value = ''; } },
  removeArea:      el => removeArea(el.dataset.id),

  // Matérias
  addSubjectsBulk: () => { const n = addSubjectsBulk(v('subj-area'), v('subjs-bulk')); if (n) { const el = document.getElementById('subjs-bulk'); if (el) el.value = ''; } },
  removeSubject:   el => removeSubject(el.dataset.id),

  // Professores
  addTeacher:          ()  => addTeacher(),
  addTeachersBulk:     ()  => { const n = addTeachersBulk(v('teachers-bulk')); if (n) { const el = document.getElementById('teachers-bulk'); if (el) el.value = ''; } },
  removeTeacher:       el  => removeTeacher(el.dataset.id),
  editTeacherSubjects: el  => openTeacherSubjects(el.dataset.id),
  saveTeacherSubjects: el  => saveTeacherSubjectsFromModal(el.dataset.id),
  editTeacher:         el  => openEditTeacher(el.dataset.id),
  saveEditTeacher:     el  => saveEditTeacher(el.dataset.id),

  // Horários — grid por professor
  schedSelectTeacher:       el  => { schedUI.teacherId = el.value || null; schedUI.segmentId = null; renderSettings(); },
  schedSelectSegment:       el  => { schedUI.segmentId = el.dataset.seg || null; renderSettings(); },
  openScheduleModal:        el  => openScheduleModal(el.dataset.seg, el.dataset.turno, Number(el.dataset.aula), el.dataset.day, el.dataset.teacher),
  saveScheduleModal:        el  => saveScheduleModal(el.dataset.seg, el.dataset.turno, Number(el.dataset.aula), el.dataset.day, el.dataset.teacher),
  removeScheduleImmediate:  el  => removeScheduleImmediate(el.dataset.id, el.dataset.seg, el.dataset.turno, Number(el.dataset.aula), el.dataset.day, el.dataset.teacher),
  removeSchedule:           el  => removeSchedule(el.dataset.id),
  editSchedule:             el  => openEditSchedule(el.dataset.id),
  saveEditSchedule:         el  => saveEditSchedule(el.dataset.id),

  // Substituições
  openModal:    el => openModal(el.dataset.tid, el.dataset.day, el.dataset.slot),
  closeModal:   ()  => closeModal(),
  assignSub:    el  => assignSubstitute(el.dataset.tid, el.dataset.day, el.dataset.slot, el.dataset.sub),
  clearSub:     el  => clearSubstitute(el.dataset.tid, el.dataset.day, el.dataset.slot),

  // Histórico / relatório
  deleteHistory: el => { deleteHistoryEntry(el.dataset.id); renderDashboard(); },
  printReport:   ()  => printReport(),
  exportPDF:     ()  => exportPDF(),
};

// ─── Registro ────────────────────────────────────────────────────────────────

export function registerEvents() {
  // Clicks
  document.addEventListener('click', e => {
    // Home page actions
    const homeEl = e.target.closest('[data-home-action]');
    if (homeEl) {
      import('./home.js').then(({ handleHomeAction }) => {
        handleHomeAction(homeEl.dataset.homeAction, homeEl);
      });
      return;
    }

    // Absence page actions
    const abEl = e.target.closest('[data-ab-action]');
    if (abEl) { handleAbsenceAction(abEl.dataset.abAction, abEl); return; }

    // My Schedule actions
    const mysEl = e.target.closest('[data-mys-action]');
    if (mysEl) {
      const a = mysEl.dataset.mysAction;
      import('./my-schedule.js').then(({ openMyScheduleModal, removeMySchedule, onMysGradeChange }) => {
        if (a === 'openAdd') {
          // Não abre se o clique foi no botão de remover interno
          if (e.target.closest('[data-mys-action="remove"]')) return;
          openMyScheduleModal(mysEl.dataset.seg, mysEl.dataset.turno,
            Number(mysEl.dataset.aula), mysEl.dataset.day, mysEl.dataset.teacher);
        } else if (a === 'remove') {
          removeMySchedule(mysEl.dataset.id, mysEl.dataset.seg, mysEl.dataset.turno,
            Number(mysEl.dataset.aula), mysEl.dataset.day, mysEl.dataset.teacher);
        } else if (a === 'selectSeg') {
          import('./my-schedule.js').then(({ mySchedUI, renderMySchedule }) => {
            mySchedUI.segmentId = mysEl.dataset.seg;
            renderMySchedule();
          });
        }
      });
      return;
    }

    // Schedule modal actions
    const msEl = e.target.closest('[data-ms-action]');
    if (msEl) {
      const a = msEl.dataset.msAction;
      if (a === 'close') { closeScheduleModal(); return; }
      if (a === 'save')  {
        saveScheduleModal(msEl.dataset.seg, msEl.dataset.turno,
          Number(msEl.dataset.aula), msEl.dataset.day, msEl.dataset.teacher);
        return;
      }
    }

    // Disciplines tab actions
    const discEl = e.target.closest('[data-disc-action]');
    if (discEl) {
      const a = discEl.dataset.discAction;
      if (a === 'addArea')    { addAreaDisc(document.getElementById('new-area-name')?.value?.trim()); document.getElementById('new-area-name').value = ''; return; }
      if (a === 'saveArea')   { saveAreaBlock(discEl.dataset.id); return; }
      if (a === 'removeArea') { removeAreaDisc(discEl.dataset.id); return; }
    }

    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.tagName === 'SELECT' && e.type === 'click') return; // handled by change
    const handler = ACTION_MAP[el.dataset.action];
    if (handler) handler(el);
  });

  // Auto-save para aba Disciplinas (debounce 800ms)
  let _discTimer = null;
  document.addEventListener('input', e => {
    const isDiscName = e.target.matches('.disc-area-name');
    const isDiscTxt  = e.target.matches('.disc-textarea');
    if (!isDiscName && !isDiscTxt) return;
    const areaId = e.target.id.replace('disc-name-','').replace('disc-txt-','');
    if (!areaId) return;
    clearTimeout(_discTimer);
    _discTimer = setTimeout(() => {
      saveAreaBlock(areaId, true);
    }, 800);
  });

  // Change (selects e inputs de período)
  document.addEventListener('change', e => {
    // Absence page selects
    const abEl = e.target.closest('[data-ab-action]');
    if (abEl) { handleAbsenceAction(abEl.dataset.abAction, abEl); return; }

    // Schedule modal grade change
    const msEl = e.target.closest('[data-ms-action]');
    if (msEl?.dataset.msAction === 'gradeChange') {
      onGradeChange(msEl.dataset.seg, msEl.value);
      return;
    }

    const el = e.target.closest('[data-action]');
    if (!el) return;
    const handler = ACTION_MAP[el.dataset.action];
    if (handler) handler(el);
  });

  // Enter em inputs
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;

    // grade name inputs
    if (e.target.dataset?.actionEnter === 'addGrade') {
      addGrade(e.target.dataset.seg, e.target.value);
      e.target.value = '';
      return;
    }
    // class letter inputs
    if (e.target.classList.contains('grade-class-inp')) {
      const row = e.target.closest('.grade-row-actions');
      const btn = row?.querySelector('[data-action="addClassToGrade"]');
      if (!btn) return;
      const key    = `${btn.dataset.seg}-${btn.dataset.grade.replace(/\W/g,'_')}`;
      const turno  = v(`cls-turno-${key}`);
      addClassToGrade(btn.dataset.seg, btn.dataset.grade, e.target.value, turno);
      e.target.value = '';
      e.target.focus();
      return;
    }
    // outros
    const action = e.target.dataset?.enter;
    const handler = ACTION_MAP[action];
    if (handler) handler(e.target);
  });

  // Esc fecha modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Click fora do modal
  document.getElementById('overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
}
