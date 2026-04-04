/**
 * modal-schedule.js — Modal de adição de aula na célula do grid.
 *
 * Fluxo:
 *   1. Adm clica na célula (segId + turno + aulaIdx + day + teacherId pré-definidos)
 *   2. Modal: matéria → série/ano → turma
 *   3. Ao salvar:
 *      a. Verifica conflito de professor (mesmo prof, mesmo slot/dia)
 *      b. Verifica conflito de turma (mesma turma, mesmo slot/dia, qualquer prof)
 *      c. Se conflito → modal de alerta com detalhes
 *      d. Se ok → insere, fecha modal, atualiza célula imediatamente
 *   4. Remoção imediata via botão ✕
 */

import { state, saveState } from './state.js';
import { h, colorOfTeacher, findTurma } from './helpers.js';
import { renderSchedCell, schedUI }     from './render.js';
import { updateNav }                    from './nav.js';
import { uid }                          from './helpers.js';

// ─── Utilitários ──────────────────────────────────────────────────────────────

function show(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('overlay').classList.add('on');
}

export function closeScheduleModal() {
  document.getElementById('overlay').classList.remove('on');
}

function refreshCell(segId, turno, aulaIdx, day, teacherId) {
  const cellId = `sched-cell-${segId}-${turno}-${aulaIdx}-${day.replace(/[^a-z]/gi, '')}`;
  const cell   = document.getElementById(cellId);
  if (!cell) return;
  const periodo = { turno, aulaIdx, slot: `${segId}|${turno}|${aulaIdx}`,
    label: `${aulaIdx}ª Aula`, inicio: '', fim: '' };
  cell.outerHTML = renderSchedCell(segId, periodo, teacherId, day);
}

// ─── Modal de adição ──────────────────────────────────────────────────────────

export function openScheduleModal(segId, turno, aulaIdx, day, teacherId) {
  const seg     = state.segments.find(s => s.id === segId);
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!seg || !teacher) return;

  const slot = `${segId}|${turno}|${aulaIdx}`;

  // Matérias do professor
  const mySubjects = (teacher.subjectIds ?? [])
    .map(sid => state.subjects.find(s => s.id === sid)).filter(Boolean);

  if (mySubjects.length === 0) {
    show(`
      <div class="m-hdr">
        <h3 style="font-size:16px">Sem matérias associadas</h3>
        <button class="m-close" data-ms-action="close">×</button>
      </div>
      <p style="color:var(--t2);font-size:14px;margin-bottom:20px">
        ${h(teacher.name)} não tem matérias associadas.<br>
        Vá em <strong>👩‍🏫 Professores → 📚 Matérias</strong> para configurar.
      </p>
      <button class="btn btn-ghost" style="width:100%" data-ms-action="close">Fechar</button>`);
    return;
  }

  const subjOpts = `<option value="">Selecione a matéria…</option>` +
    mySubjects.map(s => `<option value="${s.id}">${h(s.name)}</option>`).join('');

  // Anos/séries do segmento
  const gradeOpts = `<option value="">Selecione o ano/série…</option>` +
    seg.grades.map(g => `<option value="${h(g.name)}">${h(g.name)}</option>`).join('');

  show(`
    <div class="m-hdr">
      <div>
        <h3 style="font-size:16px;margin-bottom:4px">Adicionar aula</h3>
        <div class="m-pills">
          <span class="m-pill">${h(day)}</span>
          <span class="m-pill">${h(seg.name)}</span>
          <span class="m-pill">${aulaIdx}ª Aula (${turno === 'tarde' ? '🌇' : '🌅'})</span>
        </div>
      </div>
      <button class="m-close" data-ms-action="close">×</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px">
      <div class="fld">
        <label class="lbl">Matéria</label>
        <select class="inp" id="ms-subj">${subjOpts}</select>
      </div>
      <div class="fld">
        <label class="lbl">Ano / Série</label>
        <select class="inp" id="ms-grade" data-ms-action="gradeChange"
          data-seg="${segId}">${gradeOpts}</select>
      </div>
      <div class="fld">
        <label class="lbl">Turma</label>
        <select class="inp" id="ms-turma">
          <option value="">— selecione o ano/série primeiro —</option>
        </select>
      </div>
    </div>

    <div style="display:flex;gap:8px">
      <button class="btn btn-dark" style="flex:1"
        data-ms-action="save"
        data-seg="${segId}" data-turno="${turno}"
        data-aula="${aulaIdx}" data-day="${h(day)}"
        data-teacher="${teacherId}">
        Adicionar aula
      </button>
      <button class="btn btn-ghost" data-ms-action="close">Cancelar</button>
    </div>`);
}

/** Quando o adm escolhe um ano/série, popula as turmas disponíveis */
export function onGradeChange(segId, gradeName) {
  const el  = document.getElementById('ms-turma');
  if (!el) return;
  const seg   = state.segments.find(s => s.id === segId);
  const grade = seg?.grades.find(g => g.name === gradeName);
  if (!grade) { el.innerHTML = '<option value="">— selecione o ano/série primeiro —</option>'; return; }
  el.innerHTML = `<option value="">Selecione a turma…</option>` +
    grade.classes.map(c =>
      `<option value="${h(`${grade.name} ${c.letter}`)}">${h(grade.name)} ${h(c.letter)}</option>`
    ).join('');
}

/** Tenta salvar — verifica conflitos antes */
export function saveScheduleModal(segId, turno, aulaIdx, day, teacherId) {
  const subjId  = document.getElementById('ms-subj')?.value;
  const turma   = document.getElementById('ms-turma')?.value;

  if (!turma)  { alert('Selecione a turma.'); return; }

  const slot = `${segId}|${turno}|${aulaIdx}`;

  // ── Conflito 1: mesmo professor, mesmo horário ────────────────────────────
  const profConflict = state.schedules.find(
    s => s.teacherId === teacherId && s.day === day && s.timeSlot === slot
  );
  if (profConflict) {
    const subj = state.subjects.find(s => s.id === profConflict.subjectId);
    showConflictAlert(
      'Este professor já tem aula neste horário',
      `<strong>${h(state.teachers.find(t => t.id === teacherId)?.name)}</strong>` +
      ` já leciona <strong>${h(subj?.name ?? '—')}</strong> para <strong>${h(profConflict.turma)}</strong>.`
    );
    return;
  }

  // ── Conflito 2: mesma turma, mesmo horário, qualquer professor ────────────
  const turmaConflict = state.schedules.find(
    s => s.turma === turma && s.day === day && s.timeSlot === slot
  );
  if (turmaConflict) {
    const profOcupa = state.teachers.find(t => t.id === turmaConflict.teacherId);
    const subjOcupa = state.subjects.find(s => s.id === turmaConflict.subjectId);
    showConflictAlert(
      `Horário já ocupado para ${h(turma)}`,
      `<strong>${h(profOcupa?.name ?? '?')}</strong>` +
      ` já ocupa este horário com <strong>${h(subjOcupa?.name ?? '—')}</strong>.`
    );
    return;
  }

  // ── Tudo ok: insere ───────────────────────────────────────────────────────
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  state.schedules.push({
    id, teacherId, subjectId: subjId || null, turma, day, timeSlot: slot,
  });
  saveState();
  updateNav();

  closeScheduleModal();
  refreshCellById(segId, turno, aulaIdx, day, teacherId);
  updateTeacherHeader(teacherId);
}

function showConflictAlert(title, detail) {
  show(`
    <div style="text-align:center;padding:12px 0 0">
      <div style="font-size:40px;margin-bottom:14px">⚠️</div>
      <h3 style="font-size:17px;margin-bottom:10px;color:var(--err)">${title}</h3>
      <p style="font-size:14px;color:var(--t2);line-height:1.6;margin-bottom:24px">${detail}</p>
      <button class="btn btn-dark" style="width:100%" data-ms-action="close">Entendido</button>
    </div>`);
}

// ─── Remoção imediata ─────────────────────────────────────────────────────────

export function removeScheduleImmediate(id, segId, turno, aulaIdx, day, teacherId) {
  state.schedules = state.schedules.filter(s => s.id !== id);
  saveState();
  import('./db.js').then(({ deleteDocById }) => deleteDocById('schedules', id));
  updateNav();
  refreshCellById(segId, turno, aulaIdx, day, teacherId);
  updateTeacherHeader(teacherId);
}

// ─── Helpers de DOM ──────────────────────────────────────────────────────────

function refreshCellById(segId, turno, aulaIdx, day, teacherId) {
  const cellId = `sched-cell-${segId}-${turno}-${aulaIdx}-${day.replace(/[^a-z]/gi, '')}`;
  const cell   = document.getElementById(cellId);
  if (!cell) return;

  // Reconstrói apenas o innerHTML da célula
  const slot   = `${segId}|${turno}|${aulaIdx}`;
  const minhas = state.schedules.filter(
    s => s.teacherId === teacherId && s.timeSlot === slot && s.day === day
  );

  const cards = minhas.map(s => {
    const subj = state.subjects.find(x => x.id === s.subjectId);
    return `
      <div class="sched-cell-card sched-mine">
        <div class="sched-card-name">${h(s.turma)}</div>
        <div class="sched-card-info">${h(subj?.name ?? '—')}</div>
        <button class="sched-card-edit"
          data-action="editSchedule"
          data-id="${s.id}"
          title="Editar aula">✏</button>
        <button class="sched-card-del"
          data-action="removeScheduleImmediate"
          data-id="${s.id}"
          data-seg="${segId}"
          data-aula="${aulaIdx}"
          data-turno="${turno}"
          data-day="${h(day)}"
          data-teacher="${teacherId}"
          title="Remover aula">✕</button>
      </div>`;
  }).join('');

  cell.innerHTML = cards + '<div class="sched-add-hint">＋ adicionar</div>';
}

function updateTeacherHeader(teacherId) {
  const total = state.schedules.filter(s => s.teacherId === teacherId).length;
  const el    = document.getElementById('sched-teacher-total');
  if (el) el.textContent = `${total} aula${total !== 1 ? 's' : ''} cadastrada${total !== 1 ? 's' : ''}`;
}
