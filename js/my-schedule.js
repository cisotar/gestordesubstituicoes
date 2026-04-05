/**
 * my-schedule.js — Página "Meu Horário" para o professor logado.
 *
 * O professor:
 *   1. Seleciona o nível (EF ou EM)
 *   2. Vê a grade com seus horários já cadastrados
 *   3. Clica numa célula para adicionar/remover aulas
 *   4. Conflitos (mesmo horário do professor ou da turma) são bloqueados
 *
 * Admin também pode acessar esta página para gerenciar qualquer professor
 * (redireciona para a aba Horários em Configurações).
 */

import { state }                  from './state.js';
import { DAYS }                   from './constants.js';
import { h, colorOfTeacher,
         teacherSubjectNames,
         allTurmaObjects }        from './helpers.js';
import { getPeriodos, getAulas,
         slotLabel }              from './periods.js';
import { authState,
         isAdminRole,
         isTeacherRole }          from './auth.js';
import { saveDoc }                from './db.js';
import { saveState }              from './state.js';
import { updateNav }              from './nav.js';

// ─── UI state ─────────────────────────────────────────────────────────────────

export const mySchedUI = { segmentId: null };

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderMySchedule() {
  const el = document.getElementById('pg-my-schedule');
  if (!el) return;

  // Determina o professor: logado (teacher) ou admin visualizando
  const teacher = _currentTeacher();

  if (!teacher) {
    el.innerHTML = _noTeacherMessage();
    return;
  }

  const cv    = colorOfTeacher(teacher);
  const total = state.schedules.filter(s => s.teacherId === teacher.id).length;

  // Tabs de segmento
  const segTabs = state.segments.map(seg => `
    <button class="stab ${seg.id === mySchedUI.segmentId ? 'on' : ''}"
      data-mys-action="selectSeg" data-seg="${seg.id}">
      ${h(seg.name)}
    </button>`).join('');

  const grid = mySchedUI.segmentId
    ? _buildGrid(state.segments.find(s => s.id === mySchedUI.segmentId), teacher)
    : `<div class="empty" style="max-width:440px;margin-top:16px">
        <div class="empty-ico">🏫</div>
        <div class="empty-ttl">Selecione o nível de ensino</div>
        <div class="empty-dsc">Escolha Ensino Fundamental ou Médio para ver e editar seus horários.</div>
       </div>`;

  el.innerHTML = `
    <div class="ph" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h2>Meu Horário</h2>
        <p>Clique em uma célula para adicionar ou remover aulas.</p>
      </div>
    </div>

    <!-- Cabeçalho do professor -->
    <div class="card card-b" style="margin-bottom:20px;background:${cv.bg};border-color:${cv.bd}">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div class="th-av" style="background:${cv.tg};color:${cv.tx};width:44px;height:44px;font-size:20px;font-weight:800">
          ${h(teacher.name.charAt(0))}
        </div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:16px;color:${cv.tx}">${h(teacher.name)}</div>
          <div style="font-size:12px;color:${cv.tx};opacity:.75;margin-top:2px">
            ${h(teacherSubjectNames(teacher) || '—')}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:24px;font-weight:800;color:${cv.tx}">${total}</div>
          <div style="font-size:11px;color:${cv.tx};opacity:.65">aula${total !== 1 ? 's' : ''}/sem.</div>
        </div>
      </div>
    </div>

    <!-- Tabs de segmento -->
    <div class="s-tabs" style="margin-bottom:16px">${segTabs}</div>

    <!-- Grade -->
    <div id="mys-grid">${grid}</div>`;
}

// ─── Grade ────────────────────────────────────────────────────────────────────

function _buildGrid(seg, teacher) {
  if (!seg) return '';

  // Apenas turnos configurados explicitamente para este segmento
  const configuredTurnos = Object.keys(state.periodConfigs?.[seg.id] ?? {});
  const turnosToUse = configuredTurnos.length > 0 ? configuredTurnos : [seg.turno ?? 'manha'];

  const seen = new Set();
  const periodos = turnosToUse
    .flatMap(turno =>
      getPeriodos(seg.id, turno).map(p => ({ ...p, turno, slot: `${seg.id}|${turno}|${p.aulaIdx}` }))
    )
    .filter(p => {
      if (p.isIntervalo) return true;
      const key = `${p.inicio}|${p.aulaIdx}|${p.turno}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  if (!periodos.filter(p => !p.isIntervalo).length) {
    return `<div class="card card-b" style="padding:24px;color:var(--t2);text-align:center">
      Configure os períodos deste segmento em ⚙️ Configurações → ⏰ Períodos.
    </div>`;
  }

  const headers = DAYS.map(d =>
    `<th style="text-align:center;min-width:130px;padding:10px 8px">${d}</th>`
  ).join('');

  const rows = periodos.map(p => {
    if (p.isIntervalo) return `
      <tr>
        <td style="padding:5px 12px;background:var(--accent-l)">
          <div style="font-size:11px;font-weight:700;color:var(--accent)">☕ Intervalo</div>
          <div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">${h(p.inicio)}–${h(p.fim)}</div>
        </td>
        ${DAYS.map(() => `<td style="background:var(--accent-l)"></td>`).join('')}
      </tr>`;

    const cells = DAYS.map(day => _buildCell(seg.id, p, teacher, day)).join('');
    return `
      <tr>
        <td class="sl">
          <div class="sl-n">${h(p.label)}</div>
          <div class="sl-t">${h(p.inicio)}–${h(p.fim)}</div>
        </td>
        ${cells}
      </tr>`;
  }).join('');

  return `
    <div class="cal-wrap">
      <table class="ctbl" style="table-layout:fixed;width:100%">
        <thead><tr>
          <th style="text-align:left;width:115px">Aula</th>
          ${headers}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function _buildCell(segId, periodo, teacher, day) {
  const slot  = periodo.slot ?? `${segId}|${periodo.turno}|${periodo.aulaIdx}`;
  const minhas = state.schedules.filter(
    s => s.teacherId === teacher.id && s.timeSlot === slot && s.day === day
  );

  const cards = minhas.map(s => {
    const subj = state.subjects.find(x => x.id === s.subjectId);
    return `
      <div class="sched-cell-card sched-mine">
        <div class="sched-card-name">${h(subj?.name ?? '—')}</div>
        <div class="sched-card-info">${h(s.turma)}</div>
        <button class="sched-card-del"
          data-mys-action="remove"
          data-id="${s.id}"
          data-seg="${segId}"
          data-aula="${periodo.aulaIdx}"
          data-turno="${periodo.turno}"
          data-day="${h(day)}"
          data-teacher="${teacher.id}"
          title="Remover aula">✕</button>
      </div>`;
  }).join('');

  const cellId = `mys-cell-${segId}-${periodo.turno}-${periodo.aulaIdx}-${day.replace(/[^a-z]/gi,'')}`;

  return `
    <td class="sched-cell" id="${cellId}"
      data-mys-action="openAdd"
      data-seg="${segId}"
      data-turno="${periodo.turno}"
      data-aula="${periodo.aulaIdx}"
      data-day="${h(day)}"
      data-teacher="${teacher.id}">
      ${cards}
      <div class="sched-add-hint">＋ adicionar</div>
    </td>`;
}

// ─── Modal de adição ──────────────────────────────────────────────────────────

export function openMyScheduleModal(segId, turno, aulaIdx, day, teacherId) {
  const seg     = state.segments.find(s => s.id === segId);
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!seg || !teacher) return;

  const slot = `${segId}|${turno}|${aulaIdx}`;

  // Matérias do professor filtradas pelo segmento atual
  const mySubjects = (teacher.subjectIds ?? [])
    .map(sid => state.subjects.find(s => s.id === sid))
    .filter(s => {
      if (!s) return false;
      const area = state.areas.find(a => a.id === s.areaId);
      const sIds = area?.segmentIds ?? [];
      return sIds.length === 0 || sIds.includes(segId);
    });

  const subjOpts = mySubjects.length > 0
    ? `<option value="">Selecione a matéria…</option>` +
      mySubjects.map(s => `<option value="${s.id}">${h(s.name)}</option>`).join('')
    : `<option value="">— sem matérias associadas —</option>`;

  // Anos/séries do segmento
  const gradeOpts = `<option value="">Selecione o ano/série…</option>` +
    seg.grades.map(g => `<option value="${h(g.name)}">${h(g.name)}</option>`).join('');

  const overlay  = document.getElementById('overlay');
  const modalBody = document.getElementById('modal-body');
  if (!overlay || !modalBody) return;

  modalBody.innerHTML = `
    <div class="m-hdr">
      <div>
        <h3 style="font-size:16px;margin-bottom:4px">Adicionar aula</h3>
        <div class="m-pills">
          <span class="m-pill">${h(day)}</span>
          <span class="m-pill">${h(seg.name)}</span>
          <span class="m-pill">${aulaIdx}ª Aula (${turno === 'tarde' ? '🌇' : '🌅'})</span>
        </div>
      </div>
      <button class="m-close" onclick="document.getElementById('overlay').classList.remove('on')">×</button>
    </div>

    ${mySubjects.length === 0 ? `
      <div style="padding:12px;border-radius:var(--r);background:var(--err-l);
        border:1px solid var(--err-b);color:#7F1A06;font-size:13px;margin-bottom:16px">
        ⚠ Você não tem matérias associadas. Peça ao administrador para configurar.
      </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px">
      <div class="fld">
        <label class="lbl">Matéria</label>
        <select class="inp" id="mys-subj">${subjOpts}</select>
      </div>
      <div class="fld">
        <label class="lbl">Ano / Série</label>
        <select class="inp" id="mys-grade">${gradeOpts}</select>
      </div>
      <div class="fld">
        <label class="lbl">Turma</label>
        <select class="inp" id="mys-turma">
          <option value="">— selecione o ano/série primeiro —</option>
        </select>
      </div>
    </div>

    <div style="display:flex;gap:8px">
      <button class="btn btn-dark" style="flex:1" id="mys-save-btn"
        ${mySubjects.length === 0 ? 'disabled style="opacity:.5"' : ''}>
        Adicionar aula
      </button>
      <button class="btn btn-ghost"
        onclick="document.getElementById('overlay').classList.remove('on')">
        Cancelar
      </button>
    </div>`;

  overlay.classList.add('on');

  document.getElementById('mys-grade')?.addEventListener('change', e => {
    onMysGradeChange(segId, e.target.value);
  });
  document.getElementById('mys-save-btn')?.addEventListener('click', () => {
    saveMySchedule(segId, turno, aulaIdx, day, teacherId);
  });
}

export function onMysGradeChange(segId, gradeName) {
  const el    = document.getElementById('mys-turma');
  if (!el) return;
  const seg   = state.segments.find(s => s.id === segId);
  const grade = seg?.grades.find(g => g.name === gradeName);
  if (!grade) { el.innerHTML = '<option value="">— selecione o ano/série primeiro —</option>'; return; }
  el.innerHTML = `<option value="">Selecione a turma…</option>` +
    grade.classes.map(c =>
      `<option value="${h(`${grade.name} ${c.letter}`)}">${h(grade.name)} ${h(c.letter)}</option>`
    ).join('');
}

function saveMySchedule(segId, turno, aulaIdx, day, teacherId) {
  const subjId = document.getElementById('mys-subj')?.value;
  const turma  = document.getElementById('mys-turma')?.value;

  if (!turma) { alert('Selecione a turma.'); return; }

  const slot = `${segId}|${turno}|${aulaIdx}`;

  // Conflito 1: mesmo professor, mesmo horário
  if (state.schedules.find(s => s.teacherId === teacherId && s.day === day && s.timeSlot === slot)) {
    _showConflict('Você já tem uma aula neste horário.');
    return;
  }

  // Conflito 2: mesma turma, mesmo horário, qualquer professor
  const conflict = state.schedules.find(
    s => s.turma === turma && s.day === day && s.timeSlot === slot
  );
  if (conflict) {
    const prof = state.teachers.find(t => t.id === conflict.teacherId);
    const subj = state.subjects.find(s => s.id === conflict.subjectId);
    _showConflict(
      `Esta turma já tem aula neste horário.<br>
       <strong>${h(prof?.name ?? '?')}</strong> leciona
       <strong>${h(subj?.name ?? '—')}</strong>.`
    );
    return;
  }

  // Insere
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const entry = { id, teacherId, subjectId: subjId || null, turma, day, timeSlot: slot };
  state.schedules.push(entry);
  saveState();
  saveDoc('schedules', entry);
  updateNav();

  document.getElementById('overlay').classList.remove('on');
  _refreshCell(segId, turno, aulaIdx, day, teacherId);
  _refreshHeader(teacherId);
}

function _showConflict(msg) {
  const body = document.getElementById('modal-body');
  if (!body) return;
  body.innerHTML = `
    <div style="text-align:center;padding:12px 0">
      <div style="font-size:40px;margin-bottom:14px">⚠️</div>
      <h3 style="font-size:17px;margin-bottom:10px;color:var(--err)">Horário já ocupado</h3>
      <p style="font-size:14px;color:var(--t2);line-height:1.6;margin-bottom:24px">${msg}</p>
      <button class="btn btn-dark" style="width:100%"
        onclick="document.getElementById('overlay').classList.remove('on')">Entendido</button>
    </div>`;
}

// ─── Remoção imediata ─────────────────────────────────────────────────────────

export function removeMySchedule(id, segId, turno, aulaIdx, day, teacherId) {
  state.schedules = state.schedules.filter(s => s.id !== id);
  saveState();

  // Remove do Firestore
  import('./db.js').then(({ deleteDocById }) => deleteDocById('schedules', id));

  updateNav();
  _refreshCell(segId, turno, aulaIdx, day, teacherId);
  _refreshHeader(teacherId);
}

// ─── Helpers de DOM ───────────────────────────────────────────────────────────

function _refreshCell(segId, turno, aulaIdx, day, teacherId) {
  const cellId = `mys-cell-${segId}-${turno}-${aulaIdx}-${day.replace(/[^a-z]/gi, '')}`;
  const cell   = document.getElementById(cellId);
  if (!cell) return;

  const slot   = `${segId}|${turno}|${aulaIdx}`;
  const periodo = getAulas(segId, turno).find(p => p.aulaIdx === Number(aulaIdx));
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher || !periodo) return;

  // Reconstrói apenas o innerHTML
  const minhas = state.schedules.filter(
    s => s.teacherId === teacherId && s.timeSlot === slot && s.day === day
  );
  const cards = minhas.map(s => {
    const subj = state.subjects.find(x => x.id === s.subjectId);
    return `
      <div class="sched-cell-card sched-mine">
        <div class="sched-card-name">${h(subj?.name ?? '—')}</div>
        <div class="sched-card-info">${h(s.turma)}</div>
        <button class="sched-card-del"
          data-mys-action="remove"
          data-id="${s.id}" data-seg="${segId}"
          data-aula="${aulaIdx}" data-turno="${turno}"
          data-day="${h(day)}" data-teacher="${teacherId}"
          title="Remover aula">✕</button>
      </div>`;
  }).join('');

  cell.innerHTML = cards + '<div class="sched-add-hint">＋ adicionar</div>';
}

function _refreshHeader(teacherId) {
  const total = state.schedules.filter(s => s.teacherId === teacherId).length;
  const el    = document.querySelector('#pg-my-schedule .th-stat-n');
  if (el) el.textContent = total;
}

function _currentTeacher() {
  if (isTeacherRole()) return authState.teacher
    ?? state.teachers.find(t => t.email?.toLowerCase() === authState.user?.email?.toLowerCase())
    ?? null;
  // Admin não tem um "professor próprio" nesta página
  return null;
}

function _noTeacherMessage() {
  if (!authState.user) {
    return `<div class="empty">
      <div class="empty-ico">🔒</div>
      <div class="empty-ttl">Acesso restrito</div>
      <div class="empty-dsc">Faça login para acessar seus horários.</div>
    </div>`;
  }
  if (authState.role === 'pending') {
    return `<div class="empty">
      <div class="empty-ico">⏳</div>
      <div class="empty-ttl">Aguardando aprovação</div>
      <div class="empty-dsc">Seu cadastro está sendo analisado pelo administrador.<br>
        Assim que aprovado, você poderá gerenciar seus horários aqui.</div>
    </div>`;
  }
  return `<div class="empty">
    <div class="empty-ico">👤</div>
    <div class="empty-ttl">Perfil não encontrado</div>
    <div class="empty-dsc">Seu e-mail de login não está associado a nenhum professor cadastrado.<br>
      Entre em contato com o administrador.</div>
  </div>`;
}
