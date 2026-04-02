/**
 * home.js — Página inicial redesenhada.
 */

import { state }              from './state.js';
import { DAYS }               from './constants.js';
import { h, colorOfTeacher,
         teacherSubjectNames } from './helpers.js';
import { getAulas, getPeriodos, slotLabel } from './periods.js';
import { authState, isAdminRole } from './auth.js';
import { rankCandidates, createAbsence,
         assignSubstitute, formatBR,
         businessDaysBetween,
         dateToDayLabel }      from './absences.js';
import { saveState }           from './state.js';
import { updateNav }           from './nav.js';

// ─── UI state ─────────────────────────────────────────────────────────────────

export const homeUI = {
  segmentId:  null,
  teacherId:  null,
  weekOffset: 0,
  gridView:   'c', // 'c' = cards por dia | 'b' = tabela por período
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
  const fmt   = d => { const [,m,day] = d.split('-'); return `${day}/${m}`; };
  return `${fmt(dates[0])} – ${fmt(dates[4])}`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderHome() {
  const el = document.getElementById('pg-calendar');
  if (!el) return;

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
        <div class="empty-dsc">Escolha entre Ensino Fundamental e Ensino Médio para ver os professores e horários.</div>
       </div>`;

  el.innerHTML = `
    <div class="ph" style="margin-bottom:16px">
      <h2>Calendário Semanal</h2>
      <p>Selecione um nível e depois um professor para ver os horários da semana.</p>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap">${segTabs}</div>
    ${content}`;
}

// ─── Lista de professores ─────────────────────────────────────────────────────

function _renderTeacherList(seg) {
  if (!seg) return '';

  const segTurmas = new Set(
    seg.grades.flatMap(g => g.classes.map(c => `${g.name} ${c.letter}`))
  );

  const teachers = state.teachers.map(t => {
    const inSeg = state.schedules.filter(s => s.teacherId === t.id && segTurmas.has(s.turma));
    return { teacher: t, inSeg };
  }).sort((a, b) => {
    if (a.inSeg.length > 0 && b.inSeg.length === 0) return -1;
    if (a.inSeg.length === 0 && b.inSeg.length > 0) return  1;
    return a.teacher.name.localeCompare(b.teacher.name);
  });

  const cards = teachers.map(({ teacher: t, inSeg }) => {
    const cv      = colorOfTeacher(t);
    const isEmpty = inSeg.length === 0;
    const subs    = teacherSubjectNames(t);
    const isSel   = t.id === homeUI.teacherId;

    return `
      <button class="home-teacher-card ${isEmpty ? 'home-teacher-empty' : ''} ${isSel ? 'selected' : ''}"
        data-home-action="selectTeacher" data-tid="${t.id}"
        style="${!isEmpty ? `border-color:${isSel ? 'var(--navy)' : cv.bd}` : ''}">
        <div class="home-teacher-av"
          style="background:${isEmpty ? 'var(--surf2)' : cv.tg};color:${isEmpty ? 'var(--t3)' : cv.tx}">
          ${h(t.name.charAt(0))}
        </div>
        <div style="flex:1;min-width:0;text-align:left">
          <div style="font-weight:700;font-size:14px;color:${isEmpty ? 'var(--t3)' : 'var(--t1)'};
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(t.name)}</div>
          <div style="font-size:11px;color:var(--t3);margin-top:2px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${isEmpty ? '— sem aulas neste nível —' : h(subs || '—')}
          </div>
        </div>
        ${!isEmpty
          ? `<span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;
              background:${cv.tg};color:${cv.tx};flex-shrink:0">
              ${inSeg.length} aula${inSeg.length !== 1 ? 's' : ''}
            </span>`
          : `<span style="font-size:11px;color:var(--t3);flex-shrink:0">Vazio</span>`}
      </button>`;
  }).join('');

  const weekGrid = homeUI.teacherId ? _renderWeekGrid(homeUI.teacherId, seg) : '';

  return `
    <div style="display:grid;grid-template-columns:280px 1fr;gap:24px;align-items:start">
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--t3);
          text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
          ${teachers.length} professor${teachers.length !== 1 ? 'es' : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:70vh;overflow-y:auto;padding-right:4px">
          ${cards}
        </div>
      </div>
      <div id="home-week-grid">${weekGrid}</div>
    </div>`;
}

// ─── Grade semanal ────────────────────────────────────────────────────────────

function _renderWeekGrid(teacherId, seg) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return '';

  const cv    = colorOfTeacher(teacher);
  const dates = weekDates();
  const mine  = state.schedules.filter(s => s.teacherId === teacherId);

  // Períodos do segmento — usa o turno definido no segmento
  const segTurno = seg.turno ?? 'manha';
  const periodos = getPeriodos(seg.id, segTurno)
    .filter(p => !p.isIntervalo)
    .map(p => ({ ...p, turno: segTurno, slot: `${seg.id}|${segTurno}|${p.aulaIdx}` }));

  // Ausências registradas na semana
  const absenceSlots = new Set(
    (state.absences ?? []).flatMap(ab =>
      ab.teacherId === teacherId
        ? ab.slots.map(sl => `${sl.date}|${sl.timeSlot}`)
        : []
    )
  );

  // Mapa substitutos
  const subMap = {};
  (state.absences ?? []).forEach(ab => {
    if (ab.teacherId !== teacherId) return;
    ab.slots.forEach(sl => {
      if (sl.substituteId) subMap[`${sl.date}|${sl.timeSlot}`] = sl.substituteId;
    });
  });

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  const header = `
    <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;
      border-radius:var(--rl);background:${cv.bg};border:2px solid ${cv.bd};margin-bottom:16px">
      <div class="th-av" style="background:${cv.tg};color:${cv.tx};
        width:44px;height:44px;font-size:20px;font-weight:800;flex-shrink:0">
        ${h(teacher.name.charAt(0))}
      </div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:16px;color:${cv.tx}">${h(teacher.name)}</div>
        <div style="font-size:12px;color:${cv.tx};opacity:.7">${h(teacherSubjectNames(teacher) || '—')}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <!-- Toggle de visualização -->
        <div style="display:flex;border:1.5px solid var(--bdr);border-radius:var(--r);overflow:hidden">
          <button class="view-toggle ${homeUI.gridView === 'c' ? 'on' : ''}"
            data-home-action="setGridView" data-view="c" title="Cards por dia">📅</button>
          <button class="view-toggle ${homeUI.gridView === 'b' ? 'on' : ''}"
            data-home-action="setGridView" data-view="b" title="Tabela de períodos">📋</button>
        </div>
        <!-- Navegação de semana -->
        <button class="btn btn-ghost btn-xs" data-home-action="prevWeek">←</button>
        <span style="font-size:12px;font-weight:600;color:var(--t2);
          font-family:'DM Mono',monospace;white-space:nowrap">${weekLabel()}</span>
        <button class="btn btn-ghost btn-xs" data-home-action="nextWeek">→</button>
        ${homeUI.weekOffset !== 0
          ? `<button class="btn btn-ghost btn-xs" data-home-action="thisWeek"
              style="color:var(--accent)">hoje</button>` : ''}
      </div>
    </div>`;

  const body = homeUI.gridView === 'b'
    ? _gridViewB(dates, mine, periodos, absenceSlots, subMap, teacherId, cv)
    : _gridViewC(dates, mine, periodos, absenceSlots, subMap, teacherId, cv);

  // Botão de marcar por período (só admin)
  const markRange = isAdminRole() ? `
    <div style="margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
      padding:12px 14px;border-radius:var(--r);background:var(--surf2);border:1px solid var(--bdr)">
      <span style="font-size:12px;font-weight:600;color:var(--t2)">Marcar ausência por período:</span>
      <input type="date" id="abs-from" class="inp"
        style="width:140px;padding:5px 8px;font-size:12px" value="${weekDates()[0]}">
      <span style="font-size:12px;color:var(--t2)">até</span>
      <input type="date" id="abs-to" class="inp"
        style="width:140px;padding:5px 8px;font-size:12px" value="${weekDates()[4]}">
      <button class="btn btn-dark btn-sm"
        data-home-action="markRangeAbsent" data-tid="${teacherId}">
        Marcar período
      </button>
    </div>` : '';

  return header + body + markRange;
}

// ── Versão C: cards por dia com aulas enumeradas ──────────────────────────────

function _gridViewC(dates, mine, periodos, absenceSlots, subMap, teacherId, cv) {
  const cols = dates.map((date, i) => {
    const dayLabel = DAYS[i];
    const isToday  = date === new Date().toISOString().split('T')[0];

    const aulaRows = periodos.map(p => {
      const sched = mine.find(s => s.day === dayLabel && s.timeSlot === p.slot);
      const isAbs = sched && absenceSlots.has(`${date}|${p.slot}`);
      const subId = subMap[`${date}|${p.slot}`];
      const subT  = subId ? state.teachers.find(t => t.id === subId) : null;
      const subj  = state.subjects.find(x => x.id === sched?.subjectId);

      if (!sched) return `
        <div class="home-aula-row">
          <span class="home-aula-n">${p.aulaIdx}ª</span>
          <div class="home-aula-estudo">hora de estudo</div>
        </div>`;

      return `
        <div class="home-aula-row ${isAbs ? 'home-aula-absent' : ''}"
          data-home-action="openDay" data-date="${date}" data-tid="${teacherId}"
          style="cursor:pointer">
          <span class="home-aula-n">${p.aulaIdx}ª</span>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:12px;
              color:${isAbs ? '#991B1B' : 'var(--t1)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${h(sched.turma)}
            </div>
            <div style="font-size:11px;margin-top:1px;
              color:${isAbs ? '#B91C1C' : 'var(--t2)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${h(subj?.name ?? '—')}
            </div>
            ${isAbs ? `<div style="font-size:10px;margin-top:2px;
              color:${subT ? '#065F46' : 'var(--err)'};font-weight:600">
              ${subT ? `↳ ${h(subT.name)}` : '⚠ sem sub.'}
            </div>` : ''}
          </div>
        </div>`;
    }).join('');

    const hasAbs  = periodos.some(p => {
      const s = mine.find(x => x.day === dayLabel && x.timeSlot === p.slot);
      return s && absenceSlots.has(`${date}|${p.slot}`);
    });

    return `
      <div class="home-day-col ${isToday ? 'home-day-today-col' : ''} ${hasAbs ? 'home-day-absent-col' : ''}">
        <div class="home-day-col-hdr">
          <span style="font-weight:700;font-size:13px">${dayLabel}</span>
          <span style="font-size:10px;color:var(--t3);font-family:'DM Mono',monospace">${formatBR(date)}</span>
        </div>
        ${isAdminRole() ? `
          <button class="btn btn-ghost btn-xs" style="width:100%;margin-bottom:6px;font-size:10px"
            data-home-action="markDayAbsent" data-date="${date}" data-tid="${teacherId}">
            + marcar dia
          </button>` : ''}
        ${aulaRows}
      </div>`;
  }).join('');

  return `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">${cols}</div>`;
}

// ── Versão B: tabela de períodos ──────────────────────────────────────────────

function _gridViewB(dates, mine, periodos, absenceSlots, subMap, teacherId, cv) {
  const headers = dates.map((date, i) => {
    const dayLabel = DAYS[i];
    const isToday  = date === new Date().toISOString().split('T')[0];
    return `
      <th style="text-align:center;min-width:120px;padding:8px 6px;
        ${isToday ? 'background:var(--accent-l)' : ''}">
        <div style="font-weight:700;font-size:13px;
          ${isToday ? 'color:var(--accent)' : ''}">${dayLabel}</div>
        <div style="font-size:10px;color:var(--t3);font-family:'DM Mono',monospace;margin-top:2px">
          ${formatBR(date)}</div>
        ${isAdminRole() ? `
          <button class="btn btn-ghost btn-xs" style="margin-top:4px;font-size:10px"
            data-home-action="markDayAbsent"
            data-date="${date}" data-tid="${teacherId}">
            + marcar dia
          </button>` : ''}
      </th>`;
  }).join('');

  const rows = periodos.map(p => {
    const cells = dates.map((date, i) => {
      const dayLabel = DAYS[i];
      const sched    = mine.find(s => s.day === dayLabel && s.timeSlot === p.slot);
      const isAbs    = sched && absenceSlots.has(`${date}|${p.slot}`);
      const subId    = subMap[`${date}|${p.slot}`];
      const subT     = subId ? state.teachers.find(t => t.id === subId) : null;
      const subj     = state.subjects.find(x => x.id === sched?.subjectId);

      if (!sched) return `
        <td style="padding:4px">
          <div style="font-size:10px;color:var(--t3);font-style:italic;text-align:center;
            padding:8px 4px;background:var(--surf2);border-radius:var(--r)">
            hora de estudo
          </div>
        </td>`;

      return `
        <td style="padding:4px">
          <button style="width:100%;text-align:left;padding:7px 9px;border-radius:var(--r);
            border:1.5px solid ${isAbs ? '#F7C1C1' : cv.bd};
            background:${isAbs ? '#FCEBEB' : cv.bg};
            cursor:pointer;font-family:'Figtree',sans-serif;transition:all .12s"
            data-home-action="openDay" data-date="${date}" data-tid="${teacherId}">
            <div style="font-weight:700;font-size:12px;color:${isAbs ? '#991B1B' : cv.tx}">
              ${h(sched.turma)}</div>
            <div style="font-size:11px;margin-top:1px;color:${isAbs ? '#B91C1C' : cv.tx};opacity:.8">
              ${h(subj?.name ?? '—')}</div>
            ${isAbs ? `<div style="font-size:10px;margin-top:3px;
              color:${subT ? '#065F46' : 'var(--err)'};font-weight:600">
              ${subT ? `↳ ${h(subT.name)}` : '⚠ sem sub.'}
            </div>` : ''}
          </button>
        </td>`;
    }).join('');

    return `
      <tr>
        <td class="sl" style="white-space:nowrap">
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
          <th style="text-align:left;width:110px">Aula</th>
          ${headers}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── Modal do dia ─────────────────────────────────────────────────────────────

export function openDayModal(date, teacherId) {
  const teacher  = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;

  const dayLabel = dateToDayLabel(date);
  const cv       = colorOfTeacher(teacher);

  // Pega o segmento e todos os períodos deste professor neste dia
  const mine = state.schedules.filter(
    s => s.teacherId === teacherId && s.day === dayLabel
  ).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

  // Todos os slots do segmento neste dia (para mostrar hora de estudo)
  const seg = state.segments.find(s =>
    mine.some(m => m.timeSlot.startsWith(s.id))
  ) ?? state.segments[0];

  const allPeriodos = seg ? ['manha','tarde'].flatMap(turno => {
    const seen = new Set();
    return getPeriodos(seg.id, turno)
      .filter(p => !p.isIntervalo)
      .filter(p => {
        const k = `${turno}|${p.aulaIdx}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      })
      .map(p => ({ ...p, turno, slot: `${seg.id}|${turno}|${p.aulaIdx}` }));
  }).sort((a, b) => a.inicio.localeCompare(b.inicio)) : [];

  // Ausências já registradas
  const absenceMap = {};
  (state.absences ?? []).forEach(ab => {
    if (ab.teacherId !== teacherId) return;
    ab.slots.filter(sl => sl.date === date).forEach(sl => {
      absenceMap[sl.timeSlot] = { absenceId: ab.id, slotId: sl.id, substituteId: sl.substituteId };
    });
  });

  const rows = allPeriodos.map(p => {
    const sched  = mine.find(s => s.timeSlot === p.slot);
    const abs    = sched ? absenceMap[p.slot] : null;
    const subT   = abs?.substituteId
      ? state.teachers.find(t => t.id === abs.substituteId) : null;
    const isAbs  = !!abs;
    const subj   = state.subjects.find(x => x.id === sched?.subjectId);

    if (!sched) {
      // Hora de estudo
      return `
        <div class="day-modal-row" style="opacity:.5">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="flex-shrink:0;text-align:center;min-width:60px">
              <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--t3)">
                ${h(p.label)}</div>
              <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--t3)">
                ${h(p.inicio)}–${h(p.fim)}</div>
            </div>
            <div style="font-size:13px;color:var(--t3);font-style:italic">Hora de estudo</div>
          </div>
        </div>`;
    }

    return `
      <div class="day-modal-row ${isAbs ? 'day-modal-absent' : ''}">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <!-- Horário -->
          <div style="flex-shrink:0;text-align:center;min-width:60px">
            <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--t2)">
              ${h(p.label)}</div>
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--t3)">
              ${h(p.inicio)}–${h(p.fim)}</div>
          </div>
          <!-- Aula: turma em negrito, matéria abaixo -->
          <div style="flex:1">
            <div style="font-weight:700;font-size:15px;color:var(--t1)">${h(sched.turma)}</div>
            <div style="font-size:13px;color:var(--t2);margin-top:2px">${h(subj?.name ?? '—')}</div>
            ${isAbs ? `
              <div style="margin-top:6px;padding:6px 10px;border-radius:6px;
                background:${subT ? 'var(--ok-l)' : 'var(--err-l)'};
                border:1px solid ${subT ? 'var(--ok-b)' : 'var(--err-b)'}">
                ${subT
                  ? `<div style="font-size:11px;font-weight:700;color:var(--ok)">✓ Substituto</div>
                     <div style="font-size:13px;font-weight:700;color:#065F46">${h(subT.name)}</div>`
                  : `<div style="font-size:12px;color:var(--err);font-weight:600">⚠ Sem substituto definido</div>`}
              </div>` : ''}
          </div>
          <!-- Ações (só admin) -->
          ${isAdminRole() ? `
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
              ${isAbs ? `
                <button class="btn btn-ghost btn-xs"
                  data-day-action="pickSub"
                  data-tid="${teacherId}" data-date="${date}"
                  data-slot="${p.slot}" data-abs="${abs.absenceId}" data-slt="${abs.slotId}">
                  ${subT ? '↺ Trocar' : '+ Substituto'}
                </button>
                <button class="btn btn-ghost btn-xs" style="color:var(--err)"
                  data-day-action="clearAbs"
                  data-abs="${abs.absenceId}" data-slt="${abs.slotId}">
                  Desfazer
                </button>` : `
                <button class="btn btn-dark btn-xs"
                  data-day-action="markAbsent"
                  data-tid="${teacherId}" data-date="${date}"
                  data-slot="${p.slot}" data-sched="${sched.id}"
                  data-subj="${sched.subjectId ?? ''}"
                  data-turma="${h(sched.turma)}">
                  Marcar falta
                </button>`}
            </div>` : ''}
        </div>
      </div>`;
  }).join('');

  const body    = document.getElementById('modal-body');
  const overlay = document.getElementById('overlay');
  if (!body || !overlay) return;

  const allAbsent = mine.every(s => absenceMap[s.timeSlot]);

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
      <button class="m-close"
        onclick="document.getElementById('overlay').classList.remove('on')">×</button>
    </div>
    ${isAdminRole() && mine.length > 0 && !allAbsent ? `
      <div style="margin-bottom:12px;padding:10px 12px;border-radius:var(--r);
        background:var(--surf2);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:13px;color:var(--t2)">Marcar todas as aulas como falta:</span>
        <button class="btn btn-dark btn-sm" data-day-action="markDayAll"
          data-tid="${teacherId}" data-date="${date}">
          Marcar dia inteiro
        </button>
      </div>` : ''}
    <div style="display:flex;flex-direction:column;gap:0">
      ${rows || '<p style="color:var(--t3);text-align:center;padding:24px 0">Nenhuma aula neste dia.</p>'}
    </div>`;

  overlay.classList.add('on');

  body.querySelectorAll('[data-day-action="markAbsent"]').forEach(btn => {
    btn.addEventListener('click', () => _markAbsent(btn, date, teacherId));
  });
  body.querySelectorAll('[data-day-action="markDayAll"]').forEach(btn => {
    btn.addEventListener('click', () => _markDayAll(date, teacherId));
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
    date, timeSlot: slot, scheduleId: schedId, subjectId: subj || null, turma,
  }]);
  saveState();
  _openSubPickerForNew(absenceId, date, teacherId, slot);
}

function _markDayAll(date, teacherId) {
  const dayLabel = dateToDayLabel(date);
  const mine = state.schedules.filter(
    s => s.teacherId === teacherId && s.day === dayLabel
  );
  // Filtra os que ainda não têm falta registrada
  const absenceSlots = new Set(
    (state.absences ?? []).flatMap(ab =>
      ab.teacherId === teacherId
        ? ab.slots.filter(sl => sl.date === date).map(sl => sl.timeSlot)
        : []
    )
  );
  const rawSlots = mine
    .filter(s => !absenceSlots.has(s.timeSlot))
    .map(s => ({
      date, timeSlot: s.timeSlot, scheduleId: s.id,
      subjectId: s.subjectId ?? null, turma: s.turma,
    }));
  if (!rawSlots.length) return;
  const absenceId = createAbsence(teacherId, rawSlots);
  saveState();
  updateNav();
  openDayModal(date, teacherId);
  _refreshWeekGrid(teacherId);
}

function _markRangeAbsent(teacherId, fromDate, toDate) {
  const dates = businessDaysBetween(fromDate, toDate);
  if (!dates.length) { alert('Nenhum dia útil no período selecionado.'); return; }

  let total = 0;
  dates.forEach(date => {
    const dayLabel = dateToDayLabel(date);
    const mine     = state.schedules.filter(
      s => s.teacherId === teacherId && s.day === dayLabel
    );
    const alreadyAbsent = new Set(
      (state.absences ?? []).flatMap(ab =>
        ab.teacherId === teacherId
          ? ab.slots.filter(sl => sl.date === date).map(sl => sl.timeSlot)
          : []
      )
    );
    const rawSlots = mine
      .filter(s => !alreadyAbsent.has(s.timeSlot))
      .map(s => ({
        date, timeSlot: s.timeSlot, scheduleId: s.id,
        subjectId: s.subjectId ?? null, turma: s.turma,
      }));
    if (rawSlots.length) {
      createAbsence(teacherId, rawSlots);
      total += rawSlots.length;
    }
  });

  saveState();
  updateNav();
  alert(`✓ ${total} aula${total !== 1 ? 's' : ''} marcada${total !== 1 ? 's' : ''} como falta em ${dates.length} dia${dates.length !== 1 ? 's' : ''}.`);
  _refreshWeekGrid(teacherId);
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
  const ab  = state.absences?.find(a => a.id === absenceId);
  const sl  = ab?.slots.find(s => s.id === slotId);
  const curSub = sl?.substituteId
    ? state.teachers.find(t => t.id === sl.substituteId) : null;

  const sameArea  = candidates.filter(c => c.match !== 'other');
  const otherArea = candidates.filter(c => c.match === 'other');

  const renderCand = c => {
    const tc    = colorOfTeacher(c.teacher);
    const isCur = c.teacher.id === sl?.substituteId;
    const icon  = c.match === 'subject' ? '⭐' : c.match === 'area' ? '🔵' : '⚪';
    return `
      <button class="cand ${isCur ? 'sel' : ''}" data-sub-tid="${c.teacher.id}">
        <span class="cand-dot" style="background:${tc.dt}"></span>
        <div style="flex:1">
          <div class="cand-name">${h(c.teacher.name)}</div>
          <div class="cand-area">${icon}
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
    ${curSub ? `<div class="sub-box" style="margin-bottom:16px">
      <div class="sub-box-l">✓ Atual</div>
      <div class="sub-box-n">${h(curSub.name)}</div>
    </div>` : ''}
    ${sameArea.length > 0 ? `<div class="sec-lbl">⭐ Mesma área</div>${sameArea.map(renderCand).join('')}` : ''}
    ${sameArea.length > 0 && otherArea.length > 0 ? '<div class="divider"></div>' : ''}
    ${otherArea.length > 0 ? `<div class="sec-lbl">Outras áreas</div>${otherArea.map(renderCand).join('')}` : ''}
    ${candidates.length === 0 ? `<div style="text-align:center;padding:24px 0;color:var(--t3)">
      <div style="font-size:36px;margin-bottom:8px">😕</div>
      <p>Nenhum professor disponível neste horário.</p>
    </div>` : ''}
    <button class="btn btn-ghost" style="width:100%;margin-top:12px"
      data-back-day="${date}" data-back-tid="${teacherId}">Cancelar</button>`;

  body.querySelectorAll('[data-sub-tid]').forEach(btn => {
    btn.addEventListener('click', () => {
      assignSubstitute(absenceId, slotId, btn.dataset.subTid);
      saveState();
      updateNav();
      openDayModal(date, teacherId);
      _refreshWeekGrid(teacherId);
    });
  });

  body.querySelectorAll('[data-back-day]').forEach(btn => {
    btn.addEventListener('click', () => openDayModal(btn.dataset.backDay, btn.dataset.backTid));
  });
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

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

    case 'setGridView': {
      homeUI.gridView = el.dataset.view;
      _refreshWeekGrid(homeUI.teacherId);
      break;
    }

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
        // Atualiza seleção visual
        document.querySelectorAll('.home-teacher-card').forEach(c => {
          c.classList.toggle('selected', c.dataset.tid === el.dataset.tid);
        });
      } else {
        renderHome();
      }
      break;
    }

    case 'openDay': {
      openDayModal(el.dataset.date, el.dataset.tid);
      break;
    }

    case 'markDayAbsent': {
      _markDayAll(el.dataset.date, el.dataset.tid);
      break;
    }

    case 'markRangeAbsent': {
      const from = document.getElementById('abs-from')?.value;
      const to   = document.getElementById('abs-to')?.value;
      if (!from || !to || from > to) {
        alert('Selecione um intervalo de datas válido.');
        return;
      }
      _markRangeAbsent(el.dataset.tid, from, to);
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
