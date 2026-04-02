/**
 * home.js — Página inicial redesenhada.
 *
 * Fluxo:
 *   1. Seleciona segmento (EF ou EM)
 *   2. Lista de professores do segmento
 *   3. Clica no professor → dias da semana com aulas (datas reais)
 *   4. Clica no dia → modal com aulas do dia
 *   5. Admin pode marcar falta e escolher substituto direto no modal
 */

import { state }              from './state.js';
import { DAYS }               from './constants.js';
import { h, colorOfTeacher,
         teacherSubjectNames } from './helpers.js';
import { getAulas, slotLabel } from './periods.js';
import { authState,
         isAdminRole }         from './auth.js';
import { rankCandidates,
         createAbsence,
         assignSubstitute,
         formatBR,
         weekStart,
         businessDaysBetween,
         dateToDayLabel }      from './absences.js';
import { saveState }           from './state.js';
import { saveDoc }             from './db.js';
import { updateNav }           from './nav.js';

// ─── UI state ─────────────────────────────────────────────────────────────────

export const homeUI = {
  segmentId:   null,
  teacherId:   null,
  weekOffset:  0,   // 0 = semana atual, -1 = semana anterior, +1 = próxima
};

// ─── Helpers de data ──────────────────────────────────────────────────────────

function currentWeekStart() {
  const today = new Date();
  const diff  = today.getDay() === 0 ? -6 : 1 - today.getDay();
  today.setDate(today.getDate() + diff + homeUI.weekOffset * 7);
  return today.toISOString().split('T')[0];
}

function weekDates() {
  const ws = currentWeekStart();
  return DAYS.map((_, i) => {
    const d = new Date(ws + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

function weekLabel() {
  const dates = weekDates();
  const fmt   = d => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  };
  return `${fmt(dates[0])} – ${fmt(dates[4])}`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderHome() {
  const el = document.getElementById('pg-calendar');
  if (!el) return;

  // Tabs de segmento
  const segTabs = state.segments.map(seg => `
    <button class="home-seg-tab ${seg.id === homeUI.segmentId ? 'on' : ''}"
      data-home-action="selectSeg" data-seg="${seg.id}">
      ${h(seg.name)}
    </button>`).join('');

  const content = homeUI.segmentId
    ? _renderTeacherList(state.segments.find(s => s.id === homeUI.segmentId))
    : `<div class="empty" style="max-width:480px">
        <div class="empty-ico">🏫</div>
        <div class="empty-ttl">Selecione o nível de ensino</div>
        <div class="empty-dsc">Escolha entre Ensino Fundamental e Ensino Médio para ver os professores e os horários da semana.</div>
       </div>`;

  el.innerHTML = `
    <div class="ph" style="margin-bottom:16px">
      <h2>Calendário Semanal</h2>
      <p>Selecione um nível, depois um professor para ver os horários da semana.</p>
    </div>

    <!-- Seleção de segmento -->
    <div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap">
      ${segTabs}
    </div>

    ${content}`;
}

// ─── Lista de professores ─────────────────────────────────────────────────────

function _renderTeacherList(seg) {
  if (!seg) return '';

  // Professores que têm turmas neste segmento (via schedules ou todos)
  const segTurmas = new Set(
    seg.grades.flatMap(g => g.classes.map(c => `${g.name} ${c.letter}`))
  );

  const teachers = state.teachers.map(t => {
    const mySchedules = state.schedules.filter(s => s.teacherId === t.id);
    const inSeg = mySchedules.filter(s => segTurmas.has(s.turma));
    return { teacher: t, schedules: mySchedules, inSeg };
  }).sort((a, b) => {
    // Com aulas no segmento primeiro, depois por nome
    if (a.inSeg.length > 0 && b.inSeg.length === 0) return -1;
    if (a.inSeg.length === 0 && b.inSeg.length > 0) return  1;
    return a.teacher.name.localeCompare(b.teacher.name);
  });

  if (teachers.length === 0) {
    return `<div class="empty" style="max-width:400px">
      <div class="empty-ico">👤</div>
      <div class="empty-ttl">Nenhum professor cadastrado</div>
      <div class="empty-dsc">Cadastre professores em ⚙️ Configurações.</div>
    </div>`;
  }

  const cards = teachers.map(({ teacher: t, inSeg }) => {
    const cv      = colorOfTeacher(t);
    const isEmpty = inSeg.length === 0;
    const subs    = teacherSubjectNames(t);

    return `
      <button class="home-teacher-card ${isEmpty ? 'home-teacher-empty' : ''}"
        data-home-action="selectTeacher" data-tid="${t.id}"
        style="${!isEmpty ? `border-color:${cv.bd}` : ''}">
        <div class="home-teacher-av"
          style="background:${isEmpty ? 'var(--surf2)' : cv.tg};
                 color:${isEmpty ? 'var(--t3)' : cv.tx}">
          ${h(t.name.charAt(0))}
        </div>
        <div style="flex:1;min-width:0;text-align:left">
          <div style="font-weight:700;font-size:14px;
            color:${isEmpty ? 'var(--t3)' : 'var(--t1)'};
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${h(t.name)}
          </div>
          <div style="font-size:11px;color:var(--t3);margin-top:2px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${isEmpty
              ? '— sem aulas cadastradas neste nível —'
              : h(subs || '—')}
          </div>
        </div>
        ${!isEmpty ? `
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;
            background:${cv.tg};color:${cv.tx};white-space:nowrap;flex-shrink:0">
            ${inSeg.length} aula${inSeg.length !== 1 ? 's' : ''}
          </span>` : `
          <span style="font-size:11px;color:var(--t3);flex-shrink:0">Vazio</span>`}
      </button>`;
  }).join('');

  // Se tem professor selecionado, mostra a grade de dias
  const weekGrid = homeUI.teacherId
    ? _renderWeekGrid(homeUI.teacherId, seg)
    : '';

  return `
    <div style="display:grid;grid-template-columns:280px 1fr;gap:24px;align-items:start">
      <!-- Lista de professores -->
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--t3);
          text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
          ${teachers.length} professor${teachers.length !== 1 ? 'es' : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;
          max-height:70vh;overflow-y:auto;padding-right:4px">
          ${cards}
        </div>
      </div>

      <!-- Grade semanal do professor -->
      <div id="home-week-grid">${weekGrid}</div>
    </div>`;
}

// ─── Grade semanal ────────────────────────────────────────────────────────────

function _renderWeekGrid(teacherId, seg) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return '';

  const cv      = colorOfTeacher(teacher);
  const dates   = weekDates();
  const mine    = state.schedules.filter(s => s.teacherId === teacherId);

  // Verifica ausências registradas nesta semana
  const absenceSlots = new Set(
    (state.absences ?? []).flatMap(ab =>
      ab.teacherId === teacherId
        ? ab.slots.map(sl => `${sl.date}|${sl.timeSlot}`)
        : []
    )
  );

  const dayColumns = dates.map((date, i) => {
    const dayLabel  = DAYS[i];
    const dayScheds = mine.filter(s => s.day === dayLabel);
    const hasAulas  = dayScheds.length > 0;
    const isToday   = date === new Date().toISOString().split('T')[0];

    return `
      <button class="home-day-card ${!hasAulas ? 'home-day-empty' : ''} ${isToday ? 'home-day-today' : ''}"
        ${hasAulas ? `data-home-action="openDay" data-date="${date}" data-tid="${teacherId}"` : ''}
        ${!hasAulas ? 'disabled' : ''}>
        <div class="home-day-name">${dayLabel}</div>
        <div class="home-day-date">${formatBR(date)}</div>
        ${hasAulas ? `
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:3px">
            ${dayScheds.map(s => {
              const subj    = state.subjects.find(x => x.id === s.subjectId);
              const isAbs   = absenceSlots.has(`${date}|${s.timeSlot}`);
              const sub     = state.subs[`${teacherId}||${dayLabel}||${s.timeSlot}`];
              const subT    = sub ? state.teachers.find(t => t.id === sub) : null;
              return `
                <div style="font-size:10px;padding:3px 6px;border-radius:4px;text-align:left;
                  background:${isAbs ? '#FEE2E2' : cv.tg};
                  color:${isAbs ? '#991B1B' : cv.tx}">
                  ${isAbs ? '⚠ ' : ''}${h(subj?.name ?? '—')} · ${h(s.turma)}
                  ${subT ? `<br><span style="font-size:9px">↳ ${h(subT.name)}</span>` : ''}
                </div>`;
            }).join('')}
          </div>` : `
          <div style="font-size:11px;color:var(--t3);margin-top:8px">Sem aulas</div>`}
      </button>`;
  }).join('');

  return `
    <!-- Cabeçalho do professor -->
    <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;
      border-radius:var(--rl);background:${cv.bg};border:2px solid ${cv.bd};margin-bottom:16px">
      <div class="th-av" style="background:${cv.tg};color:${cv.tx};
        width:44px;height:44px;font-size:20px;font-weight:800;flex-shrink:0">
        ${h(teacher.name.charAt(0))}
      </div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px;color:${cv.tx}">${h(teacher.name)}</div>
        <div style="font-size:12px;color:${cv.tx};opacity:.7">
          ${h(teacherSubjectNames(teacher) || '—')}
        </div>
      </div>
      <!-- Navegação de semana -->
      <div style="display:flex;align-items:center;gap:8px">
        <button class="btn btn-ghost btn-xs" data-home-action="prevWeek">←</button>
        <span style="font-size:12px;font-weight:600;color:var(--t2);
          font-family:'DM Mono',monospace;white-space:nowrap">
          ${weekLabel()}
        </span>
        <button class="btn btn-ghost btn-xs" data-home-action="nextWeek">→</button>
        ${homeUI.weekOffset !== 0 ? `
          <button class="btn btn-ghost btn-xs" data-home-action="thisWeek"
            style="color:var(--accent)">hoje</button>` : ''}
      </div>
    </div>

    <!-- Dias da semana -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
      ${dayColumns}
    </div>`;
}

// ─── Modal do dia ─────────────────────────────────────────────────────────────

export function openDayModal(date, teacherId) {
  const teacher  = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;

  const dayLabel = dateToDayLabel(date);
  const cv       = colorOfTeacher(teacher);
  const mine     = state.schedules.filter(
    s => s.teacherId === teacherId && s.day === dayLabel
  ).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

  // Ausências já registradas neste dia
  const absenceMap = {};
  (state.absences ?? []).forEach(ab => {
    if (ab.teacherId !== teacherId) return;
    ab.slots.filter(sl => sl.date === date).forEach(sl => {
      absenceMap[sl.timeSlot] = { absenceId: ab.id, slotId: sl.id, substituteId: sl.substituteId };
    });
  });

  const rows = mine.map(s => {
    const subj   = state.subjects.find(x => x.id === s.subjectId);
    const parts  = s.timeSlot.split('|');
    const aula   = getAulas(parts[0], parts[1]).find(p => p.aulaIdx === Number(parts[2]));
    const abs    = absenceMap[s.timeSlot];
    const subT   = abs?.substituteId
      ? state.teachers.find(t => t.id === abs.substituteId)
      : null;
    const isAbs  = !!abs;

    return `
      <div class="day-modal-row ${isAbs ? 'day-modal-absent' : ''}">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <!-- Horário -->
          <div style="flex-shrink:0;text-align:center;min-width:60px">
            <div style="font-family:'DM Mono',monospace;font-size:11px;
              font-weight:700;color:var(--t2)">${h(aula?.label ?? slotLabel(s.timeSlot))}</div>
            ${aula ? `<div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--t3)">
              ${h(aula.inicio)}–${h(aula.fim)}</div>` : ''}
          </div>
          <!-- Aula -->
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${h(subj?.name ?? '—')}</div>
            <div style="font-size:12px;color:var(--t2)">${h(s.turma)}</div>
            ${isAbs ? `
              <div style="margin-top:6px;padding:6px 10px;border-radius:6px;
                background:${subT ? 'var(--ok-l)' : 'var(--err-l)'};
                border:1px solid ${subT ? 'var(--ok-b)' : 'var(--err-b)'}">
                ${subT ? `
                  <div style="font-size:11px;font-weight:700;color:var(--ok)">✓ Substituto</div>
                  <div style="font-size:13px;font-weight:700;color:#065F46">${h(subT.name)}</div>
                ` : `
                  <div style="font-size:12px;color:var(--err);font-weight:600">⚠ Sem substituto</div>
                `}
              </div>` : ''}
          </div>
          <!-- Ações (só admin) -->
          ${isAdminRole() ? `
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
              ${isAbs ? `
                <button class="btn btn-ghost btn-xs"
                  data-day-action="pickSub"
                  data-tid="${teacherId}" data-date="${date}"
                  data-slot="${s.timeSlot}"
                  data-abs="${abs.absenceId}" data-slt="${abs.slotId}">
                  ${subT ? '↺ Trocar' : '+ Substituto'}
                </button>
                <button class="btn btn-ghost btn-xs" style="color:var(--err)"
                  data-day-action="clearAbs"
                  data-abs="${abs.absenceId}" data-slt="${abs.slotId}">
                  Desfazer falta
                </button>
              ` : `
                <button class="btn btn-dark btn-xs"
                  data-day-action="markAbsent"
                  data-tid="${teacherId}" data-date="${date}"
                  data-slot="${s.timeSlot}"
                  data-sched="${s.id}"
                  data-subj="${s.subjectId ?? ''}"
                  data-turma="${h(s.turma)}">
                  Marcar falta
                </button>
              `}
            </div>` : ''}
        </div>
      </div>`;
  }).join('');

  const body = document.getElementById('modal-body');
  const overlay = document.getElementById('overlay');
  if (!body || !overlay) return;

  body.innerHTML = `
    <div class="m-hdr">
      <div>
        <h3 style="font-size:17px;margin-bottom:4px">${h(teacher.name)}</h3>
        <div class="m-pills">
          <span class="m-pill">${dayLabel}</span>
          <span class="m-pill" style="font-family:'DM Mono',monospace">${formatBR(date)}</span>
          <span class="m-pill">${mine.length} aula${mine.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <button class="m-close" onclick="document.getElementById('overlay').classList.remove('on')">×</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:0">
      ${rows || '<p style="color:var(--t3);text-align:center;padding:24px 0">Nenhuma aula neste dia.</p>'}
    </div>`;

  overlay.classList.add('on');

  // Registra handlers
  body.querySelectorAll('[data-day-action="markAbsent"]').forEach(btn => {
    btn.addEventListener('click', () => _markAbsent(btn, date, teacherId));
  });
  body.querySelectorAll('[data-day-action="clearAbs"]').forEach(btn => {
    btn.addEventListener('click', () => _clearAbsent(btn.dataset.abs, btn.dataset.slt, date, teacherId));
  });
  body.querySelectorAll('[data-day-action="pickSub"]').forEach(btn => {
    btn.addEventListener('click', () => _openSubPicker(btn, date, teacherId));
  });
}

// ─── Marcar falta ─────────────────────────────────────────────────────────────

function _markAbsent(btn, date, teacherId) {
  const { slot, schedId, subj, turma } = btn.dataset;
  const absenceId = createAbsence(teacherId, [{
    date, timeSlot: slot,
    scheduleId: schedId,
    subjectId:  subj || null,
    turma,
  }]);
  saveState();
  _openSubPickerForNew(absenceId, date, teacherId, slot);
}

function _clearAbsent(absenceId, slotId, date, teacherId) {
  import('./absences.js').then(({ deleteAbsenceSlot }) => {
    deleteAbsenceSlot(absenceId, slotId);
    updateNav();
    openDayModal(date, teacherId);
    _refreshWeekGrid(teacherId);
  });
}

function _openSubPickerForNew(absenceId, date, teacherId, slot) {
  const ab = state.absences?.find(a => a.id === absenceId);
  if (!ab) return;
  const sl = ab.slots[0];
  _openSubPickerModal(absenceId, sl.id, date, teacherId, slot, sl.subjectId);
}

function _openSubPicker(btn, date, teacherId) {
  const { abs, slt, slot } = btn.dataset;
  const ab = state.absences?.find(a => a.id === abs);
  const sl = ab?.slots.find(s => s.id === slt);
  _openSubPickerModal(abs, slt, date, teacherId, slot, sl?.subjectId);
}

function _openSubPickerModal(absenceId, slotId, date, teacherId, slot, subjectId) {
  const candidates = rankCandidates(teacherId, date, slot, subjectId);
  const ab = state.absences?.find(a => a.id === absenceId);
  const sl = ab?.slots.find(s => s.id === slotId);
  const curSub = sl?.substituteId
    ? state.teachers.find(t => t.id === sl.substituteId) : null;

  const sameArea  = candidates.filter(c => c.match !== 'other');
  const otherArea = candidates.filter(c => c.match === 'other');

  const renderCand = (c) => {
    const tc    = colorOfTeacher(c.teacher);
    const isCur = c.teacher.id === sl?.substituteId;
    const matchIcon = c.match === 'subject' ? '⭐' : c.match === 'area' ? '🔵' : '⚪';
    return `
      <button class="cand ${isCur ? 'sel' : ''}" data-sub-tid="${c.teacher.id}">
        <span class="cand-dot" style="background:${tc.dt}"></span>
        <div style="flex:1">
          <div class="cand-name">${h(c.teacher.name)}</div>
          <div class="cand-area">
            ${matchIcon}
            <span style="font-size:10px;margin-left:4px;color:var(--t3)">${c.load} aulas/sem.</span>
          </div>
        </div>
        ${isCur ? '<span class="cand-cur">atual ✓</span>' : ''}
        <span style="color:var(--t3);font-size:18px">›</span>
      </button>`;
  };

  const body = document.getElementById('modal-body');
  if (!body) return;

  body.innerHTML = `
    <div class="m-hdr">
      <h3 style="font-size:17px">Selecionar Substituto</h3>
      <button class="m-close" data-back-day="${date}" data-back-tid="${teacherId}"
        id="btn-back-day">←</button>
    </div>
    ${curSub ? `
      <div class="sub-box" style="margin-bottom:16px">
        <div class="sub-box-l">✓ Atual</div>
        <div class="sub-box-n">${h(curSub.name)}</div>
      </div>` : ''}
    ${sameArea.length > 0 ? `
      <div class="sec-lbl">⭐ Mesma área</div>
      ${sameArea.map(renderCand).join('')}` : ''}
    ${sameArea.length > 0 && otherArea.length > 0 ? '<div class="divider"></div>' : ''}
    ${otherArea.length > 0 ? `
      <div class="sec-lbl">Outras áreas</div>
      ${otherArea.map(renderCand).join('')}` : ''}
    ${candidates.length === 0 ? `
      <div style="text-align:center;padding:24px 0;color:var(--t3)">
        <div style="font-size:36px;margin-bottom:8px">😕</div>
        <p>Nenhum professor disponível neste horário.</p>
      </div>` : ''}
    <button class="btn btn-ghost" style="width:100%;margin-top:12px"
      data-back-day="${date}" data-back-tid="${teacherId}" id="btn-cancel-sub">
      Cancelar
    </button>`;

  // Seleciona substituto
  body.querySelectorAll('[data-sub-tid]').forEach(btn => {
    btn.addEventListener('click', () => {
      assignSubstitute(absenceId, slotId, btn.dataset.subTid);
      saveState();
      updateNav();
      openDayModal(date, teacherId);
      _refreshWeekGrid(teacherId);
    });
  });

  // Volta para o modal do dia
  body.querySelectorAll('[data-back-day]').forEach(btn => {
    btn.addEventListener('click', () => openDayModal(btn.dataset.backDay, btn.dataset.backTid));
  });
}

// ─── Atualização parcial do DOM ───────────────────────────────────────────────

function _refreshWeekGrid(teacherId) {
  const gridEl = document.getElementById('home-week-grid');
  if (!gridEl) return;
  const seg = state.segments.find(s => s.id === homeUI.segmentId);
  if (!seg) return;
  gridEl.innerHTML = _renderWeekGrid(teacherId, seg);
}

// ─── Handlers de ação ─────────────────────────────────────────────────────────

export function handleHomeAction(action, el) {
  switch (action) {

    case 'selectSeg': {
      homeUI.segmentId = el.dataset.seg;
      homeUI.teacherId = null;
      renderHome();
      break;
    }

    case 'selectTeacher': {
      homeUI.teacherId  = el.dataset.tid;
      homeUI.weekOffset = 0;
      const gridEl = document.getElementById('home-week-grid');
      if (gridEl) {
        const seg = state.segments.find(s => s.id === homeUI.segmentId);
        gridEl.innerHTML = _renderWeekGrid(homeUI.teacherId, seg);
      } else {
        renderHome();
      }
      // Atualiza seleção visual
      document.querySelectorAll('.home-teacher-card').forEach(c => c.classList.remove('selected'));
      el.classList.add('selected');
      break;
    }

    case 'openDay': {
      openDayModal(el.dataset.date, el.dataset.tid);
      break;
    }

    case 'prevWeek': {
      homeUI.weekOffset--;
      _refreshWeekGrid(homeUI.teacherId);
      break;
    }

    case 'nextWeek': {
      homeUI.weekOffset++;
      _refreshWeekGrid(homeUI.teacherId);
      break;
    }

    case 'thisWeek': {
      homeUI.weekOffset = 0;
      _refreshWeekGrid(homeUI.teacherId);
      break;
    }
  }
}
