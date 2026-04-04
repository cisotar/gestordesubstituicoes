import { toast } from './toast.js';
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

  const dow        = new Date().getDay();
  const todayLabel = (dow >= 1 && dow <= 5) ? DAYS[dow - 1] : null;

  const frames   = state.segments.map(seg => _renderSegFrame(seg, todayLabel)).join('');
  const weekGrid = homeUI.teacherId
    ? _renderWeekGrid(homeUI.teacherId, state.segments.find(s => s.id === homeUI.segmentId))
    : '';

  el.innerHTML = `
    <div class="home-hero">
      <div class="home-hero-title"><span>Gestão</span>Escolar</div>
      <div class="home-hero-sub">Selecione um professor para ver e gerir os horários da semana.</div>
    </div>

    <div class="home-seg-frames">${frames}</div>
    <div id="home-week-grid">${weekGrid}</div>`;
}

// ─── Lista de professores ─────────────────────────────────────────────────────

function _renderTeacherList(seg) {
  if (!seg) return '';

  const segTurmas = new Set(
    seg.grades.flatMap(g => g.classes.map(c => `${g.name} ${c.letter}`))
  );

  // Mostra só professores com aulas neste segmento
  // (professores sem aulas no segmento são omitidos)
  const teachers = state.teachers
    .map(t => {
      const inSeg = state.schedules.filter(s => s.teacherId === t.id && segTurmas.has(s.turma));
      return { teacher: t, inSeg };
    })
    .filter(({ inSeg }) => inSeg.length > 0)
    .sort((a, b) => a.teacher.name.localeCompare(b.teacher.name));

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
    <div class="home-main-grid">
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

      // Para o botão ✕ de remoção directa, precisamos do absenceId/slotId
      let absId = null, sltId = null;
      if (isAbs) {
        const absEntry = (state.absences ?? []).find(a =>
          a.teacherId === teacherId &&
          a.slots.some(s => s.date === date && s.timeSlot === p.slot)
        );
        if (absEntry) {
          const sl = absEntry.slots.find(s => s.date === date && s.timeSlot === p.slot);
          absId = absEntry.id;
          sltId = sl?.id ?? null;
        }
      }

      return `
        <div class="home-aula-row ${isAbs ? 'home-aula-absent' : ''}"
          style="cursor:pointer;position:relative"
          ${!isAbs ? `data-home-action="openDay" data-date="${date}" data-tid="${teacherId}"` : ''}>
          <span class="home-aula-n">${p.aulaIdx}ª</span>
          <div style="flex:1;min-width:0" data-home-action="openDay"
            data-date="${date}" data-tid="${teacherId}">
            <div style="font-weight:700;font-size:12px;
              color:${isAbs ? '#991B1B' : 'var(--t1)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${h(sched.turma)}
            </div>
            <div style="font-size:11px;margin-top:1px;
              color:${isAbs ? '#B91C1C' : 'var(--t1)'};
              white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${h(subj?.name ?? '—')}
            </div>
            ${isAbs ? `<div style="font-size:10px;margin-top:2px;
              color:${subT ? '#065F46' : 'var(--err)'};font-weight:600">
              ${subT ? `↳ ${h(subT.name)}` : '⚠ sem sub.'}
            </div>` : ''}
          </div>
          ${isAbs && isAdminRole() && absId && sltId ? `
            <button class="home-abs-del-btn"
              data-home-action="clearAbsFromGrid"
              data-abs="${absId}" data-slt="${sltId}"
              data-date="${date}" data-tid="${teacherId}"
              title="Remover falta">✕</button>` : ''}
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
            <div style="font-weight:700;font-size:12px;color:${isAbs ? '#991B1B' : 'var(--t1)'}">
              ${h(sched.turma)}</div>
            <div style="font-size:11px;margin-top:1px;color:${isAbs ? '#B91C1C' : 'var(--t1)'}">
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

// ─── Helpers de candidatos ────────────────────────────────────────────────────

/**
 * Retorna top 3 candidatos ranqueados para um slot.
 * Exibe carga detalhada: aulas cadastradas + subs assumidas.
 */
function _top3(teacherId, date, slot, subjectId) {
  return rankCandidates(teacherId, date, slot, subjectId).slice(0, 3);
}

function _renderCandCard(c, absenceId, slotId, date, teacherId, compact = false) {
  const tc     = colorOfTeacher(c.teacher);
  const isCur  = c.teacher.id === (() => {
    const ab = state.absences?.find(a => a.id === absenceId);
    return ab?.slots.find(s => s.id === slotId)?.substituteId;
  })();
  const icon   = c.match === 'subject' ? '⭐ mesma matéria' : c.match === 'area' ? '🔵 mesma área' : '⚪ outra área';
  const loadTxt = `${c.load} aula${c.load !== 1 ? 's' : ''}/mês`;

  if (compact) {
    return `
      <button class="cand-compact ${isCur ? 'sel' : ''}"
        data-pick-abs="${absenceId}" data-pick-slt="${slotId}"
        data-pick-tid="${c.teacher.id}"
        data-pick-date="${date}" data-pick-teacher="${teacherId}">
        <span class="cand-dot" style="background:${tc.dt};flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${h(c.teacher.name)}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:1px">
            ${icon} · <strong>${loadTxt}</strong></div>
        </div>
        ${isCur
          ? '<span style="font-size:11px;color:var(--ok);font-weight:700;flex-shrink:0">✓</span>'
          : '<span style="color:var(--t3);font-size:16px;flex-shrink:0">›</span>'}
      </button>`;
  }

  return `
    <button class="cand ${isCur ? 'sel' : ''}"
      data-pick-abs="${absenceId}" data-pick-slt="${slotId}"
      data-pick-tid="${c.teacher.id}"
      data-pick-date="${date}" data-pick-teacher="${teacherId}">
      <span class="cand-dot" style="background:${tc.dt}"></span>
      <div style="flex:1">
        <div class="cand-name">${h(c.teacher.name)}</div>
        <div class="cand-area">${icon}
          <span style="margin-left:8px;font-size:11px;color:var(--t1);font-weight:700">
            ${loadTxt}
          </span>
        </div>
      </div>
      ${isCur ? '<span class="cand-cur">atual ✓</span>' : ''}
      <span style="color:var(--t3);font-size:18px">›</span>
    </button>`;
}

// ─── Modal do dia ─────────────────────────────────────────────────────────────

export function openDayModal(date, teacherId) {
  const teacher  = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;

  const dayLabel = dateToDayLabel(date);
  const mine     = state.schedules.filter(
    s => s.teacherId === teacherId && s.day === dayLabel
  ).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

  const seg = state.segments.find(s =>
    mine.some(m => m.timeSlot.startsWith(s.id))
  ) ?? state.segments[0];

  const segTurno   = seg?.turno ?? 'manha';
  const allPeriodos = seg
    ? getPeriodos(seg.id, segTurno)
        .filter(p => !p.isIntervalo)
        .map(p => ({ ...p, turno: segTurno, slot: `${seg.id}|${segTurno}|${p.aulaIdx}` }))
    : [];

  // Ausências já registradas
  const absenceMap = {};
  (state.absences ?? []).forEach(ab => {
    if (ab.teacherId !== teacherId) return;
    ab.slots.filter(sl => sl.date === date).forEach(sl => {
      absenceMap[sl.timeSlot] = { absenceId: ab.id, slotId: sl.id, substituteId: sl.substituteId };
    });
  });

  const rows = allPeriodos.map(p => {
    const sched = mine.find(s => s.timeSlot === p.slot);
    const abs   = sched ? absenceMap[p.slot] : null;
    const subT  = abs?.substituteId ? state.teachers.find(t => t.id === abs.substituteId) : null;
    const isAbs = !!abs;
    const subj  = state.subjects.find(x => x.id === sched?.subjectId);

    if (!sched) return `
      <div class="day-modal-row" style="opacity:.45">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="flex-shrink:0;min-width:64px;text-align:center">
            <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--t3)">${h(p.label)}</div>
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--t3)">${h(p.inicio)}–${h(p.fim)}</div>
          </div>
          <div style="font-size:13px;color:var(--t3);font-style:italic">Hora de estudo</div>
        </div>
      </div>`;

    // Sugestões para esta aula (se já está ausente e sem sub)
    const top3 = (isAbs && !subT && isAdminRole())
      ? _top3(teacherId, date, p.slot, sched.subjectId)
      : [];

    return `
      <div class="day-modal-row ${isAbs ? 'day-modal-absent' : ''}">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="flex-shrink:0;min-width:64px;text-align:center">
            <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--t2)">${h(p.label)}</div>
            <div style="font-family:'DM Mono',monospace;font-size:10px;color:var(--t3)">${h(p.inicio)}–${h(p.fim)}</div>
          </div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:15px;color:var(--t1)">${h(sched.turma)}</div>
            <div style="font-size:13px;color:var(--t2);margin-top:2px">${h(subj?.name ?? '—')}</div>
            ${isAbs ? `
              <div style="margin-top:8px">
                ${subT ? `
                  <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;
                    border-radius:var(--r);background:var(--ok-l);border:1px solid var(--ok-b)">
                    <span style="font-size:12px;color:var(--ok);font-weight:700">✓ Substituto</span>
                    <span style="font-size:14px;font-weight:700;color:#065F46">${h(subT.name)}</span>
                    ${isAdminRole() ? `
                      <button class="btn btn-ghost btn-xs" style="margin-left:auto"
                        data-day-action="pickSub"
                        data-tid="${teacherId}" data-date="${date}"
                        data-slot="${p.slot}" data-abs="${abs.absenceId}" data-slt="${abs.slotId}">
                        ↺ Trocar
                      </button>` : ''}
                  </div>` : `
                  <div style="font-size:12px;color:var(--err);font-weight:600;margin-bottom:6px">
                    ⚠ Sem substituto
                  </div>
                  ${top3.length > 0 ? `
                    <div style="display:flex;flex-direction:column;gap:4px">
                      ${top3.map(c => _renderCandCard(c, abs.absenceId, abs.slotId, date, teacherId, true)).join('')}
                    </div>` : `
                    <div style="font-size:12px;color:var(--t3)">Nenhum professor disponível.</div>`}`}
              </div>` : ''}
          </div>
          ${isAdminRole() ? `
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0">
              ${isAbs ? `
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

  const allAbsent   = mine.length > 0 && mine.every(s => absenceMap[s.timeSlot]);
  const anyAbsent   = mine.some(s => absenceMap[s.timeSlot]);
  const allHasSub   = mine.every(s => absenceMap[s.timeSlot]?.substituteId);
  const anySub      = mine.some(s => absenceMap[s.timeSlot]?.substituteId);

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

    ${isAdminRole() && mine.length > 0 ? `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;padding:10px 12px;
        background:var(--surf2);border-radius:var(--r)">
        ${!allAbsent ? `
          <button class="btn btn-dark btn-sm" data-day-action="markDayAll"
            data-tid="${teacherId}" data-date="${date}">
            Marcar dia inteiro
          </button>` : ''}
        ${anyAbsent && !allHasSub ? `
          <button class="btn btn-ghost btn-sm" data-day-action="acceptAllSuggestions"
            data-tid="${teacherId}" data-date="${date}">
            ✓ Aceitar todas as sugestões
          </button>` : ''}
        ${anySub ? `
          <button class="btn btn-ghost btn-sm" style="color:var(--err)"
            data-day-action="clearAllSubs"
            data-tid="${teacherId}" data-date="${date}">
            ↺ Limpar substituições
          </button>` : ''}
        <button class="btn btn-ghost btn-sm" style="color:var(--err)"
          data-day-action="clearAllAbsences"
          data-tid="${teacherId}" data-date="${date}">
          🗑 Remover todas as faltas
        </button>
        ${allHasSub ? `
          <button class="btn btn-dark btn-sm" data-day-action="downloadPDF"
            data-tid="${teacherId}" data-date="${date}">
            ⬇ Baixar PDF
          </button>` : ''}
      </div>` : ''}

    <div style="display:flex;flex-direction:column;gap:0">
      ${rows || '<p style="color:var(--t3);text-align:center;padding:24px 0">Nenhuma aula neste dia.</p>'}
    </div>`;

  overlay.classList.add('on');

  // Handlers
  body.querySelectorAll('[data-day-action="markAbsent"]').forEach(btn => {
    btn.addEventListener('click', () => {
      _markAbsentAndSuggest(btn, date, teacherId);
    });
  });
  body.querySelectorAll('[data-day-action="markDayAll"]').forEach(btn => {
    btn.addEventListener('click', () => _markDayAll(date, teacherId));
  });
  body.querySelectorAll('[data-day-action="clearAbs"]').forEach(btn => {
    btn.addEventListener('click', () => _clearAbsent(btn.dataset.abs, btn.dataset.slt, date, teacherId));
  });
  body.querySelectorAll('[data-day-action="clearAllSubs"]').forEach(btn => {
    btn.addEventListener('click', () => _clearAllSubs(date, teacherId));
  });
  body.querySelectorAll('[data-day-action="clearAllAbsences"]').forEach(btn => {
    btn.addEventListener('click', () => _clearAllAbsences(date, teacherId));
  });
  body.querySelectorAll('[data-day-action="pickSub"]').forEach(btn => {
    btn.addEventListener('click', () => _openSubPickerFull(btn, date, teacherId));
  });
  body.querySelectorAll('[data-pick-tid]').forEach(btn => {
    btn.addEventListener('click', () => {
      assignSubstitute(btn.dataset.pickAbs, btn.dataset.pickSlt, btn.dataset.pickTid);
      const subName = state.teachers.find(t => t.id === btn.dataset.pickTid)?.name ?? '';
      saveState(`Substituto: ${subName}`);
      updateNav();
      openDayModal(btn.dataset.pickDate, btn.dataset.pickTeacher);
      _refreshWeekGrid(btn.dataset.pickTeacher);
    });
  });
  body.querySelectorAll('[data-day-action="acceptAllSuggestions"]').forEach(btn => {
    btn.addEventListener('click', () => _acceptAllSuggestions(date, teacherId));
  });
  body.querySelectorAll('[data-day-action="downloadPDF"]').forEach(btn => {
    btn.addEventListener('click', () => _downloadDayPDF(date, teacherId));
  });
}

// ─── Marcar falta ─────────────────────────────────────────────────────────────

function _markAbsentAndSuggest(btn, date, teacherId) {
  const { slot, schedId, subj, turma } = btn.dataset;
  const absenceId = createAbsence(teacherId, [{
    date, timeSlot: slot, scheduleId: schedId, subjectId: subj || null, turma,
  }]);
  saveState('Falta registrada');
  updateNav();
  openDayModal(date, teacherId);
  _refreshWeekGrid(teacherId);
}

function _markAbsent(btn, date, teacherId) {
  _markAbsentAndSuggest(btn, date, teacherId);
}

function _markDayAll(date, teacherId) {
  const dayLabel = dateToDayLabel(date);
  const mine = state.schedules.filter(s => s.teacherId === teacherId && s.day === dayLabel);
  const alreadyAbsent = new Set(
    (state.absences ?? []).flatMap(ab =>
      ab.teacherId === teacherId
        ? ab.slots.filter(sl => sl.date === date).map(sl => sl.timeSlot)
        : []
    )
  );
  const rawSlots = mine
    .filter(s => !alreadyAbsent.has(s.timeSlot))
    .map(s => ({ date, timeSlot: s.timeSlot, scheduleId: s.id, subjectId: s.subjectId ?? null, turma: s.turma }));
  if (!rawSlots.length) return;
  createAbsence(teacherId, rawSlots);
  saveState(`${rawSlots.length} falta${rawSlots.length !== 1 ? 's' : ''} registrada${rawSlots.length !== 1 ? 's' : ''} no dia`);
  updateNav();
  openDayModal(date, teacherId);
  _refreshWeekGrid(teacherId);
}

function _clearAllSubs(date, teacherId) {
  if (!confirm('Remover todos os substitutos deste dia? As faltas continuam registradas.')) return;
  (state.absences ?? []).forEach(ab => {
    if (ab.teacherId !== teacherId) return;
    ab.slots.filter(sl => sl.date === date && sl.substituteId).forEach(sl => {
      sl.substituteId = null;
    });
    const covered = ab.slots.filter(s => s.substituteId).length;
    const total   = ab.slots.length;
    ab.status = covered === 0 ? 'open' : covered < total ? 'partial' : 'covered';
  });
  saveState('Substituições removidas');
  updateNav();
  openDayModal(date, teacherId);
  _refreshWeekGrid(teacherId);
}

function _clearAllAbsences(date, teacherId) {
  if (!confirm('Remover todas as faltas e substituições deste dia?')) return;
  state.absences = (state.absences ?? []).map(ab => {
    if (ab.teacherId !== teacherId) return ab;
    ab.slots = ab.slots.filter(sl => sl.date !== date);
    return ab;
  }).filter(ab => ab.slots.length > 0);
  saveState('Todas as faltas do dia removidas');
  updateNav();
  document.getElementById('overlay')?.classList.remove('on');
  _refreshWeekGrid(teacherId);
}

function _acceptAllSuggestions(date, teacherId) {
  const dayLabel = dateToDayLabel(date);
  const mine = state.schedules.filter(s => s.teacherId === teacherId && s.day === dayLabel);

  (state.absences ?? []).forEach(ab => {
    if (ab.teacherId !== teacherId) return;
    ab.slots.filter(sl => sl.date === date && !sl.substituteId).forEach(sl => {
      const top = rankCandidates(teacherId, date, sl.timeSlot, sl.subjectId)[0];
      if (top) assignSubstitute(ab.id, sl.id, top.teacher.id);
    });
  });

  saveState('Substituições confirmadas');
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
    const mine     = state.schedules.filter(s => s.teacherId === teacherId && s.day === dayLabel);
    const alreadyAbsent = new Set(
      (state.absences ?? []).flatMap(ab =>
        ab.teacherId === teacherId
          ? ab.slots.filter(sl => sl.date === date).map(sl => sl.timeSlot)
          : []
      )
    );
    const rawSlots = mine
      .filter(s => !alreadyAbsent.has(s.timeSlot))
      .map(s => ({ date, timeSlot: s.timeSlot, scheduleId: s.id, subjectId: s.subjectId ?? null, turma: s.turma }));
    if (rawSlots.length) { createAbsence(teacherId, rawSlots); total += rawSlots.length; }
  });

  saveState(); updateNav();
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

// ─── Selecionar substituto (lista completa) ───────────────────────────────────

function _openSubPickerFull(btn, date, teacherId) {
  const { abs, slt, slot } = btn.dataset;
  const ab      = state.absences?.find(a => a.id === abs);
  const sl      = ab?.slots.find(s => s.id === slt);
  const all     = rankCandidates(teacherId, date, slot, sl?.subjectId);
  const curSub  = sl?.substituteId ? state.teachers.find(t => t.id === sl.substituteId) : null;

  const body = document.getElementById('modal-body');
  if (!body) return;

  const candRows = all.map(c => _renderCandCard(c, abs, slt, date, teacherId, false)).join('');

  body.innerHTML = `
    <div class="m-hdr">
      <h3 style="font-size:17px">Selecionar Substituto</h3>
      <button class="m-close" id="btn-back-sub">←</button>
    </div>
    ${curSub ? `
      <div class="sub-box" style="margin-bottom:12px">
        <div class="sub-box-l">✓ Atual</div>
        <div class="sub-box-n">${h(curSub.name)}</div>
      </div>` : ''}
    <div style="font-size:11px;color:var(--t3);margin-bottom:8px">
      Ordenados por menor carga semanal · ${all.length} disponível${all.length !== 1 ? 'is' : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;max-height:60vh;overflow-y:auto">
      ${candRows || '<p style="color:var(--t3);text-align:center;padding:20px 0">Nenhum professor disponível neste horário.</p>'}
    </div>
    <button class="btn btn-ghost" style="width:100%;margin-top:12px" id="btn-cancel-sub">
      Cancelar
    </button>`;

  body.querySelectorAll('[data-pick-tid]').forEach(b => {
    b.addEventListener('click', () => {
      assignSubstitute(b.dataset.pickAbs, b.dataset.pickSlt, b.dataset.pickTid);
      saveState(); updateNav();
      openDayModal(b.dataset.pickDate, b.dataset.pickTeacher);
      _refreshWeekGrid(b.dataset.pickTeacher);
    });
  });

  document.getElementById('btn-back-sub')?.addEventListener('click', () => openDayModal(date, teacherId));
  document.getElementById('btn-cancel-sub')?.addEventListener('click', () => openDayModal(date, teacherId));
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

function _downloadDayPDF(date, teacherId) {
  const teacher  = state.teachers.find(t => t.id === teacherId);
  const dayLabel = dateToDayLabel(date);
  const mine     = state.schedules.filter(s => s.teacherId === teacherId && s.day === dayLabel)
                     .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

  const absenceMap = {};
  (state.absences ?? []).forEach(ab => {
    if (ab.teacherId !== teacherId) return;
    ab.slots.filter(sl => sl.date === date).forEach(sl => {
      absenceMap[sl.timeSlot] = sl;
    });
  });

  const rows = mine.map(s => {
    const abs  = absenceMap[s.timeSlot];
    const subj = state.subjects.find(x => x.id === s.subjectId);
    const subT = abs?.substituteId ? state.teachers.find(t => t.id === abs.substituteId) : null;
    const parts = s.timeSlot.split('|');
    const aula  = getAulas(parts[0], parts[1]).find(p => p.aulaIdx === Number(parts[2]));
    return `<tr>
      <td>${h(aula?.label ?? s.timeSlot)}</td>
      <td>${h(aula ? `${aula.inicio}–${aula.fim}` : '—')}</td>
      <td>${h(subj?.name ?? '—')}</td>
      <td>${h(s.turma)}</td>
      <td style="font-weight:700;color:${subT ? '#065F46' : '#C8290A'}">${h(subT?.name ?? '—')}</td>
    </tr>`;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Substituição — ${teacher?.name} — ${formatBR(date)}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',sans-serif;font-size:13px;color:#1a1814;padding:32px}
      h1{font-size:20px;font-weight:800;margin-bottom:4px}
      .sub{font-size:12px;color:#6b6760;margin-bottom:24px}
      table{width:100%;border-collapse:collapse}
      th{background:#1a1814;color:#fff;padding:10px 14px;text-align:left;font-size:11px;
         text-transform:uppercase;letter-spacing:.05em}
      td{padding:10px 14px;border-bottom:1px solid #e0ddd6;font-size:13px}
      tr:nth-child(even) td{background:#f4f2ee}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>${h(teacher?.name ?? '—')}</h1>
    <div class="sub">
      Relatório de substituição · ${dayLabel}, ${formatBR(date)} ·
      Gerado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}
    </div>
    <table>
      <thead><tr><th>Aula</th><th>Horário</th><th>Matéria</th><th>Turma</th><th>Substituto</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
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

    case 'clearAbsFromGrid': {
      const { abs: absenceId, slt: slotId, date, tid } = el.dataset;
      if (!confirm('Remover esta falta?')) return;
      import('./absences.js').then(({ deleteAbsenceSlot }) => {
        deleteAbsenceSlot(absenceId, slotId);
        updateNav();
        _refreshWeekGrid(tid);
      });
      break;
    }
  }
}
