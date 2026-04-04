/**
 * absence-view.js — Página de Ausências com múltiplas visualizações.
 *
 * Visualizações:
 *   - Por professor: lista de professores → clica → faltas por dia
 *   - Por dia: data selecionada → professores ausentes e aulas faltadas
 *   - Por semana: semana atual (Seg–Sex) com seletor de semana
 *   - Por mês: mês atual com seletor de mês
 */

import { state }            from './state.js';
import { DAYS }             from './constants.js';
import { h, colorOfTeacher,
         teacherSubjectNames } from './helpers.js';
import { formatBR,
         dateToDayLabel,
         weekStart,
         formatISO,
         parseDate,
         deleteAbsenceSlot } from './absences.js';
import {
  generateDayHTML, generateTeacherHTML, generateWeekHTML,
  generateMonthHTML, generateFullHTML, openPDF,
  buildWppTextDay, buildWppTextTeacher, buildWppTextWeek,
  buildWppTextMonth, openWhatsApp,
} from './absence-reports.js';
import { getAulas,
         slotLabel }        from './periods.js';
import { isAdminRole }      from './auth.js';
import { toast }            from './toast.js';
import { saveState }        from './state.js';
import { updateNav }        from './nav.js';

// ─── UI state ─────────────────────────────────────────────────────────────────

export const absView = {
  mode:            'teacher', // 'teacher' | 'day' | 'week' | 'month'
  teacherId:       null,
  date:            null,
  weekDate:        null,  // reference date for week view (defaults to today)
  monthDate:       null,  // reference date for month view (defaults to today)
  whatsappNumber:  localStorage.getItem('wpp_number') ?? '',
};

export function resetAbsenceUI() {
  absView.teacherId = null;
  absView.date      = null;
  absView.weekDate  = null;
  absView.monthDate = null;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderAbsencePage() {
  const el = document.getElementById('pg-absences');
  if (!el) return;

  const modeTabs = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--t3)">📱</span>
      <input id="wpp-number" class="inp" type="tel"
        placeholder="DDD + número" data-ab-action="saveWppNumber"
        style="width:160px;padding:5px 10px;font-size:12px"
        value="${h(absView.whatsappNumber)}">
      <span style="font-size:11px;color:var(--t3)">número WhatsApp para disparo</span>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
      <button class="view-tab ${absView.mode === 'teacher' ? 'on' : ''}"
        data-ab-action="setMode" data-mode="teacher">👤 Por Professor</button>
      <button class="view-tab ${absView.mode === 'day' ? 'on' : ''}"
        data-ab-action="setMode" data-mode="day">📅 Por Dia</button>
      <button class="view-tab ${absView.mode === 'week' ? 'on' : ''}"
        data-ab-action="setMode" data-mode="week">🗓 Por Semana</button>
      <button class="view-tab ${absView.mode === 'month' ? 'on' : ''}"
        data-ab-action="setMode" data-mode="month">📆 Por Mês</button>
      <button class="btn btn-ghost btn-sm" style="margin-left:auto"
        data-ab-action="downloadFullPDF">📄 Relatório Geral</button>
    </div>`;

  let content = '';
  if (absView.mode === 'teacher') content = _viewByTeacher();
  else if (absView.mode === 'day') content = _viewByDay();
  else if (absView.mode === 'week') content = _viewByWeek();
  else if (absView.mode === 'month') content = _viewByMonth();

  el.innerHTML = `
    <div class="ph" style="margin-bottom:16px">
      <h2>Relatório de Ausências</h2>
    </div>
    ${modeTabs}
    ${_removeSelectedBar()}
    ${content}`;

  _bindCheckboxes();
}

export function renderAbsenceList() {
  renderAbsencePage();
}

// ─── Floating "Remover selecionadas" bar ──────────────────────────────────────

function _removeSelectedBar() {
  if (!isAdminRole()) return '';
  return `
    <div id="abs-bulk-bar" style="display:none;position:sticky;top:64px;z-index:50;
      background:var(--navy);color:#fff;padding:10px 16px;border-radius:var(--r);
      margin-bottom:12px;align-items:center;justify-content:space-between;gap:12px">
      <span id="abs-bulk-count" style="font-size:13px;font-weight:700"></span>
      <button class="btn" data-ab-action="deleteSelected"
        style="background:#fff;color:var(--navy);font-weight:700;font-size:13px;padding:6px 16px;border-radius:var(--r)">
        🗑 Remover selecionadas
      </button>
    </div>`;
}

// ─── Shared slot row builder ───────────────────────────────────────────────────

function _slotRow(sl, { showTeacher = false } = {}) {
  const subj  = state.subjects.find(s => s.id === sl.subjectId);
  const sub   = sl.substituteId ? state.teachers.find(t => t.id === sl.substituteId) : null;
  const parts = sl.timeSlot.split('|');
  const aula  = getAulas(parts[0], parts[1]).find(p => p.aulaIdx === Number(parts[2]));
  const teacher = showTeacher ? state.teachers.find(t => t.id === sl.teacherId) : null;

  const checkbox = isAdminRole() ? `
    <input type="checkbox" class="abs-slot-check"
      data-absence="${sl.absenceId}" data-slot="${sl.id}"
      style="width:16px;height:16px;cursor:pointer;flex-shrink:0;accent-color:var(--navy)">` : '';

  const deleteBtn = isAdminRole() ? `
    <button class="btn-del" data-ab-action="deleteSlot"
      data-absence="${sl.absenceId}" data-slot="${sl.id}">✕</button>` : '';

  const teacherInfo = teacher ? `
    <div style="font-size:11px;color:var(--t2);margin-top:1px">
      ${h(teacher.name)}
    </div>` : '';

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;
      border-bottom:1px solid var(--bdr)">
      ${checkbox}
      <div style="min-width:70px;font-family:'DM Mono',monospace;font-size:11px;color:var(--t1)">
        ${h(aula?.label ?? slotLabel(sl.timeSlot))}<br>
        <span style="font-size:10px;color:var(--t2)">${h(aula?.inicio ?? '')}–${h(aula?.fim ?? '')}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:var(--t1)">${h(sl.turma)}</div>
        <div style="font-size:12px;color:var(--t2)">${h(subj?.name ?? '—')}</div>
        ${teacherInfo}
      </div>
      <div style="text-align:right;min-width:120px">
        ${sub
          ? `<div style="font-size:12px;color:var(--ok);font-weight:700">✓ ${h(sub.name)}</div>`
          : `<div style="font-size:12px;color:var(--err);font-weight:600">⚠ Sem sub.</div>`}
      </div>
      ${deleteBtn}
    </div>`;
}

// ─── Select-all button for a group ────────────────────────────────────────────

function _selectAllBtn(groupKey) {
  if (!isAdminRole()) return '';
  return `
    <button class="btn btn-ghost btn-xs" data-ab-action="toggleSelectAll"
      data-group="${h(groupKey)}"
      style="font-size:11px;padding:2px 10px">
      Selecionar todas
    </button>`;
}

// ═══ VISUALIZAÇÃO POR PROFESSOR ══════════════════════════════════════════════

function _viewByTeacher() {
  // Apenas professores com ausências registadas
  const teachersWithAbs = state.teachers
    .filter(t => (state.absences ?? []).some(ab => ab.teacherId === t.id && ab.slots.length > 0))
    .sort((a, b) => a.name.localeCompare(b.name));

  const teacherBtns = teachersWithAbs.map(t => {
    const cv      = colorOfTeacher(t);
    const absCount = (state.absences ?? [])
      .filter(ab => ab.teacherId === t.id)
      .reduce((acc, ab) => acc + ab.slots.length, 0);
    const isSel = t.id === absView.teacherId;

    return `
      <button class="home-teacher-card ${isSel ? 'selected' : ''}"
        data-ab-action="selectTeacher" data-tid="${t.id}"
        style="${isSel ? `border-color:var(--navy)` : `border-color:${cv.bd}`}">
        <div class="home-teacher-av" style="background:${cv.tg};color:${cv.tx}">
          ${h(t.name.charAt(0))}
        </div>
        <div style="flex:1;min-width:0;text-align:left">
          <div style="font-weight:700;font-size:14px;color:var(--t1);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${h(t.name)}
          </div>
          <div style="font-size:11px;color:var(--t2);margin-top:2px">
            ${absCount} aula${absCount !== 1 ? 's' : ''} ausente${absCount !== 1 ? 's' : ''}
          </div>
        </div>
        <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;
          background:${cv.tg};color:${cv.tx};flex-shrink:0">
          ${absCount}
        </span>
      </button>`;
  }).join('');

  const detail = absView.teacherId ? _teacherAbsDetail(absView.teacherId) : `
    <div class="empty" style="max-width:400px">
      <div class="empty-ico">👤</div>
      <div class="empty-ttl">Selecione um professor</div>
      <div class="empty-dsc">Veja as faltas e substituições por professor.</div>
    </div>`;

  return `
    <div class="home-main-grid">
      <!-- Lista de professores com ausências -->
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--t2);
          text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
          ${teachersWithAbs.length} professor${teachersWithAbs.length !== 1 ? 'es' : ''} com ausências
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;
          max-height:70vh;overflow-y:auto;padding-right:4px">
          ${teacherBtns || '<div class="empty"><div class="empty-ico">✅</div><div class="empty-ttl">Sem ausências registadas</div><div class="empty-dsc">Nenhuma falta no sistema.</div></div>'}
        </div>
      </div>
      <!-- Detalhe -->
      <div id="abs-detail">${detail}</div>
    </div>`;
}

function _teacherAbsDetail(teacherId) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return '';
  const cv = colorOfTeacher(teacher);

  const absences = (state.absences ?? [])
    .filter(ab => ab.teacherId === teacherId);

  if (absences.length === 0) {
    return `<div class="empty" style="max-width:360px">
      <div class="empty-ico">✅</div>
      <div class="empty-ttl">Sem faltas registradas</div>
      <div class="empty-dsc">${h(teacher.name)} não tem ausências no sistema.</div>
    </div>`;
  }

  // Agrupa slots por data
  const byDate = {};
  absences.forEach(ab => {
    ab.slots.forEach(sl => {
      if (!byDate[sl.date]) byDate[sl.date] = [];
      byDate[sl.date].push({ ...sl, absenceId: ab.id, teacherId: ab.teacherId });
    });
  });

  const dateBlocks = Object.keys(byDate).sort().map(date => {
    const slots    = byDate[date];
    const dayLabel = dateToDayLabel(date);
    const covered  = slots.filter(s => s.substituteId).length;
    const statusColor = covered === slots.length ? 'var(--ok)' : covered > 0 ? '#D97706' : 'var(--err)';
    const statusLabel = covered === slots.length ? '✓ Coberta'
      : covered > 0 ? `⚠ Parcial (${covered}/${slots.length})` : '✕ Sem substituto';

    const groupKey = `teacher-${teacherId}-${date}`;
    const slotRows = slots.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
      .map(sl => _slotRow(sl)).join('');

    return `
      <div class="card card-b" style="margin-bottom:12px" data-group="${h(groupKey)}">
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bdr)">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--t1)">${dayLabel}</div>
            <div style="font-size:12px;color:var(--t2);font-family:'DM Mono',monospace">
              ${formatBR(date)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;text-align:right">
            ${_selectAllBtn(groupKey)}
            <div>
              <div style="font-size:13px;font-weight:700;color:${statusColor}">${statusLabel}</div>
              <div style="font-size:11px;color:var(--t2)">${slots.length} aula${slots.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
        ${slotRows}
      </div>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;
      border-radius:var(--rl);background:${cv.bg};border:2px solid ${cv.bd};
      margin-bottom:20px;flex-wrap:wrap">
      <div class="th-av" style="background:${cv.tg};color:${cv.tx};
        width:44px;height:44px;font-size:20px;font-weight:800;flex-shrink:0">
        ${h(teacher.name.charAt(0))}
      </div>
      <div style="flex:1;min-width:120px">
        <div style="font-weight:700;font-size:16px;color:${cv.tx}">${h(teacher.name)}</div>
        <div style="font-size:12px;color:${cv.tx};opacity:.7">
          ${h(teacherSubjectNames(teacher) || '—')}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" data-ab-action="downloadTeacherPDF"
          data-tid="${teacher.id}">📄 PDF</button>
        <button class="btn btn-ghost btn-sm" data-ab-action="shareWppTeacher"
          data-tid="${teacher.id}">📱 WhatsApp</button>
      </div>
    </div>
    ${dateBlocks}`;
}

// ═══ VISUALIZAÇÃO POR DIA ═════════════════════════════════════════════════════

function _viewByDay() {
  const today = formatISO(new Date());
  const date  = absView.date ?? today;

  // Todas as datas com ausências registradas
  const datesWithAbs = [...new Set(
    (state.absences ?? []).flatMap(ab => ab.slots.map(s => s.date))
  )].sort().reverse();

  // Ausências na data selecionada
  const slotsOnDate = (state.absences ?? []).flatMap(ab =>
    ab.slots
      .filter(sl => sl.date === date)
      .map(sl => ({ ...sl, teacherId: ab.teacherId, absenceId: ab.id }))
  );

  const teachersOnDate = [...new Set(slotsOnDate.map(s => s.teacherId))]
    .map(tid => state.teachers.find(t => t.id === tid))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  const dayLabel = dateToDayLabel(date);

  const dateSelect = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div class="fld" style="margin:0">
        <label class="lbl" style="margin-bottom:4px;display:block">Data</label>
        <input type="date" class="inp" id="abs-day-picker"
          value="${date}" style="width:180px;padding:6px 10px">
      </div>
      ${datesWithAbs.length > 0 ? `
        <div>
          <div class="lbl" style="margin-bottom:4px;color:var(--t2)">Datas com ausências</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;max-width:500px">
            ${datesWithAbs.slice(0, 10).map(d => `
              <button class="btn ${d === date ? 'btn-dark' : 'btn-ghost'} btn-xs"
                data-ab-action="selectDay" data-date="${d}">
                ${formatBR(d)}
              </button>`).join('')}
          </div>
        </div>` : ''}
    </div>`;

  if (teachersOnDate.length === 0) {
    return `${dateSelect}
      <div class="empty" style="max-width:400px">
        <div class="empty-ico">✅</div>
        <div class="empty-ttl">Sem ausências neste dia</div>
        <div class="empty-dsc">Nenhuma falta registrada para ${formatBR(date)}.</div>
      </div>`;
  }

  const teacherBlocks = teachersOnDate.map(teacher => {
    const cv       = colorOfTeacher(teacher);
    const mySlots  = slotsOnDate.filter(s => s.teacherId === teacher.id)
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    const covered  = mySlots.filter(s => s.substituteId).length;
    const statusColor = covered === mySlots.length ? 'var(--ok)' : covered > 0 ? '#D97706' : 'var(--err)';

    const groupKey = `day-${date}-${teacher.id}`;
    const slotRows = mySlots.map(sl => _slotRow(sl)).join('');

    return `
      <div class="card card-b" style="margin-bottom:12px" data-group="${h(groupKey)}">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;
          padding-bottom:10px;border-bottom:1px solid var(--bdr)">
          <div class="th-av" style="background:${cv.tg};color:${cv.tx};
            width:36px;height:36px;font-size:16px;font-weight:800;flex-shrink:0">
            ${h(teacher.name.charAt(0))}
          </div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px;color:var(--t1)">${h(teacher.name)}</div>
            <div style="font-size:12px;color:var(--t2)">${h(teacherSubjectNames(teacher) || '—')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            ${_selectAllBtn(groupKey)}
            <div style="font-size:13px;font-weight:700;color:${statusColor}">
              ${covered}/${mySlots.length} coberta${covered !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        ${slotRows}
      </div>`;
  }).join('');

  const total   = slotsOnDate.length;
  const covered = slotsOnDate.filter(s => s.substituteId).length;

  return `${dateSelect}
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;
      padding:12px 16px;border-radius:var(--r);background:var(--surf2);flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div style="font-weight:700;font-size:15px;color:var(--t1)">${dayLabel ?? '—'}, ${formatBR(date)}</div>
        <div style="font-size:12px;color:var(--t2)">
          ${teachersOnDate.length} professor${teachersOnDate.length !== 1 ? 'es' : ''} ausente${teachersOnDate.length !== 1 ? 's' : ''} ·
          ${total} aula${total !== 1 ? 's' : ''} ·
          ${covered} substituição${covered !== 1 ? 'ões' : ''} definida${covered !== 1 ? 's' : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" data-ab-action="downloadDayPDF" data-date="${date}">📄 PDF</button>
        <button class="btn btn-ghost btn-sm" data-ab-action="shareWppDay" data-date="${date}">📱 WhatsApp</button>
      </div>
    </div>
    ${teacherBlocks}`;
}

// ═══ VISUALIZAÇÃO POR SEMANA ══════════════════════════════════════════════════

function _viewByWeek() {
  const today    = new Date();
  const refDate  = absView.weekDate ? parseDate(absView.weekDate) : today;
  const monISO   = weekStart(formatISO(refDate));   // returns ISO string
  const monDate  = parseDate(monISO);              // convert to Date for arithmetic

  // Build labels for the week picker
  const friDate  = new Date(monDate);
  friDate.setDate(monDate.getDate() + 4);
  const friISO   = formatISO(friDate);
  const weekLabel = `${formatBR(monISO)} – ${formatBR(friISO)}`;

  const weekPicker = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">
      <button class="btn btn-ghost" data-ab-action="changeWeek" data-dir="-1" style="font-size:18px;padding:4px 12px">‹</button>
      <div style="font-weight:700;font-size:14px;min-width:200px;text-align:center;color:var(--t1)">
        ${weekLabel}
      </div>
      <button class="btn btn-ghost" data-ab-action="changeWeek" data-dir="1" style="font-size:18px;padding:4px 12px">›</button>
      <button class="btn btn-ghost btn-xs" data-ab-action="changeWeek" data-dir="0" style="font-size:11px">Hoje</button>
    </div>`;

  // Collect slots for each of the 5 days Mon–Fri
  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monDate);
    d.setDate(monDate.getDate() + i);
    days.push(formatISO(d));
  }

  const allSlots = (state.absences ?? []).flatMap(ab =>
    ab.slots.map(sl => ({ ...sl, teacherId: ab.teacherId, absenceId: ab.id }))
  );

  let hasAny = false;
  const dayBlocks = days.map(date => {
    const slots = allSlots.filter(sl => sl.date === date)
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    if (slots.length === 0) return '';

    hasAny = true;
    const dayLabel = dateToDayLabel(date);
    const covered  = slots.filter(s => s.substituteId).length;
    const statusColor = covered === slots.length ? 'var(--ok)' : covered > 0 ? '#D97706' : 'var(--err)';

    const groupKey = `week-${date}`;
    const slotRows = slots.map(sl => _slotRow(sl, { showTeacher: true })).join('');

    return `
      <div class="card card-b" style="margin-bottom:12px" data-group="${h(groupKey)}">
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bdr)">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--t1)">${dayLabel}</div>
            <div style="font-size:12px;color:var(--t2);font-family:'DM Mono',monospace">${formatBR(date)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            ${_selectAllBtn(groupKey)}
            <div style="text-align:right">
              <div style="font-size:13px;font-weight:700;color:${statusColor}">
                ${covered}/${slots.length} coberta${covered !== 1 ? 's' : ''}
              </div>
              <div style="font-size:11px;color:var(--t2)">${slots.length} aula${slots.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
        ${slotRows}
      </div>`;
  }).filter(Boolean).join('');

  if (!hasAny) {
    return `${weekPicker}
      <div class="empty" style="max-width:400px">
        <div class="empty-ico">✅</div>
        <div class="empty-ttl">Sem ausências nesta semana</div>
        <div class="empty-dsc">Nenhuma falta registrada de ${formatBR(monISO)} a ${formatBR(friISO)}.</div>
      </div>`;
  }

  const totalSlots  = days.flatMap(d => allSlots.filter(sl => sl.date === d));
  const totalCount  = totalSlots.length;
  const coveredCount = totalSlots.filter(s => s.substituteId).length;

  return `${weekPicker}
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;
      padding:12px 16px;border-radius:var(--r);background:var(--surf2);flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div style="font-weight:700;font-size:14px;color:var(--t1)">Semana de ${weekLabel}</div>
        <div style="font-size:12px;color:var(--t2)">
          ${totalCount} aula${totalCount !== 1 ? 's' : ''} ausente${totalCount !== 1 ? 's' : ''} ·
          ${coveredCount} substituída${coveredCount !== 1 ? 's' : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" data-ab-action="downloadWeekPDF" data-mon="${monISO}">📄 PDF</button>
        <button class="btn btn-ghost btn-sm" data-ab-action="shareWppWeek" data-mon="${monISO}">📱 WhatsApp</button>
      </div>
    </div>
    ${dayBlocks}`;
}

// ═══ VISUALIZAÇÃO POR MÊS ═════════════════════════════════════════════════════

const _MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

function _viewByMonth() {
  const today    = new Date();
  const refDate  = absView.monthDate ? parseDate(absView.monthDate) : today;
  const year     = refDate.getFullYear();
  const month    = refDate.getMonth(); // 0-based
  const monthLabel = `${_MONTH_NAMES[month]} ${year}`;

  // Datas com ausências para destaque nos balões
  const datesWithAbs = new Set(
    (state.absences ?? []).flatMap(ab => ab.slots.map(s => {
      const d = parseDate(s.date);
      return `${d.getFullYear()}-${d.getMonth()}`;
    }))
  );

  const monthBalloons = _MONTH_NAMES.map((name, idx) => {
    const isSel  = idx === month && year === refDate.getFullYear();
    const hasAbs = datesWithAbs.has(`${year}-${idx}`);
    const targetISO = formatISO(new Date(year, idx, 1));
    return `
      <button class="month-balloon ${isSel ? 'on' : ''} ${hasAbs ? 'has-abs' : ''}"
        data-ab-action="selectMonth" data-date="${targetISO}">
        ${name.slice(0, 3)}
      </button>`;
  }).join('');

  const monthPicker = `
    <div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <button class="btn btn-ghost btn-xs" data-ab-action="changeMonth" data-dir="-1" style="font-size:16px;padding:2px 10px">‹</button>
        <span style="font-weight:700;font-size:14px;color:var(--t1);min-width:40px;text-align:center">${year}</span>
        <button class="btn btn-ghost btn-xs" data-ab-action="changeMonth" data-dir="1" style="font-size:16px;padding:2px 10px">›</button>
        <button class="btn btn-ghost btn-xs" data-ab-action="changeMonth" data-dir="0" style="font-size:11px;margin-left:4px">Hoje</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${monthBalloons}</div>
    </div>`;

  const allSlots = (state.absences ?? []).flatMap(ab =>
    ab.slots.map(sl => ({ ...sl, teacherId: ab.teacherId, absenceId: ab.id }))
  );

  // Filter slots in the selected month
  const monthSlots = allSlots.filter(sl => {
    const d = parseDate(sl.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  if (monthSlots.length === 0) {
    return `${monthPicker}
      <div class="empty" style="max-width:400px">
        <div class="empty-ico">✅</div>
        <div class="empty-ttl">Sem ausências neste mês</div>
        <div class="empty-dsc">Nenhuma falta registrada em ${monthLabel}.</div>
      </div>`;
  }

  // Group by date
  const byDate = {};
  monthSlots.forEach(sl => {
    if (!byDate[sl.date]) byDate[sl.date] = [];
    byDate[sl.date].push(sl);
  });

  const dayBlocks = Object.keys(byDate).sort().map(date => {
    const slots   = byDate[date].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
    const dayLabel = dateToDayLabel(date);
    const covered  = slots.filter(s => s.substituteId).length;
    const statusColor = covered === slots.length ? 'var(--ok)' : covered > 0 ? '#D97706' : 'var(--err)';

    const groupKey = `month-${date}`;
    const slotRows = slots.map(sl => _slotRow(sl, { showTeacher: true })).join('');

    return `
      <div class="card card-b" style="margin-bottom:12px" data-group="${h(groupKey)}">
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bdr)">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--t1)">${dayLabel}</div>
            <div style="font-size:12px;color:var(--t2);font-family:'DM Mono',monospace">${formatBR(date)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            ${_selectAllBtn(groupKey)}
            <div style="text-align:right">
              <div style="font-size:13px;font-weight:700;color:${statusColor}">
                ${covered}/${slots.length} coberta${covered !== 1 ? 's' : ''}
              </div>
              <div style="font-size:11px;color:var(--t2)">${slots.length} aula${slots.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
        ${slotRows}
      </div>`;
  }).join('');

  const totalCount   = monthSlots.length;
  const coveredCount = monthSlots.filter(s => s.substituteId).length;

  return `${monthPicker}
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;
      padding:12px 16px;border-radius:var(--r);background:var(--surf2);flex-wrap:wrap">
      <div style="flex:1;min-width:200px">
        <div style="font-weight:700;font-size:14px;color:var(--t1)">${monthLabel}</div>
        <div style="font-size:12px;color:var(--t2)">
          ${totalCount} aula${totalCount !== 1 ? 's' : ''} ausente${totalCount !== 1 ? 's' : ''} ·
          ${coveredCount} substituída${coveredCount !== 1 ? 's' : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn btn-ghost btn-sm" data-ab-action="downloadMonthPDF"
          data-year="${year}" data-month="${month}">📄 PDF</button>
        <button class="btn btn-ghost btn-sm" data-ab-action="shareWppMonth"
          data-year="${year}" data-month="${month}">📱 WhatsApp</button>
      </div>
    </div>
    ${dayBlocks}`;
}

// ─── Checkbox binding ─────────────────────────────────────────────────────────

function _updateBulkBar() {
  const bar   = document.getElementById('abs-bulk-bar');
  const count = document.querySelectorAll('.abs-slot-check:checked').length;
  if (!bar) return;
  if (count > 0) {
    bar.style.display = 'flex';
    const countEl = document.getElementById('abs-bulk-count');
    if (countEl) countEl.textContent = `${count} selecionada${count !== 1 ? 's' : ''}`;
  } else {
    bar.style.display = 'none';
  }
}

function _bindCheckboxes() {
  document.querySelectorAll('.abs-slot-check').forEach(cb => {
    cb.addEventListener('change', _updateBulkBar);
  });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export function handleAbsenceAction(action, el) {
  switch (action) {

    case 'setMode': {
      absView.mode = el.dataset.mode;
      absView.teacherId = null;
      absView.date = null;
      renderAbsencePage();
      break;
    }

    case 'selectTeacher': {
      absView.teacherId = el.dataset.tid;
      const detail = document.getElementById('abs-detail');
      if (detail) {
        detail.innerHTML = _teacherAbsDetail(absView.teacherId);
        _bindCheckboxes();
      } else {
        renderAbsencePage();
      }
      // Atualiza seleção visual
      document.querySelectorAll('[data-ab-action="selectTeacher"]').forEach(b => {
        b.classList.toggle('selected', b.dataset.tid === absView.teacherId);
      });
      break;
    }

    case 'selectDay': {
      absView.date = el.dataset.date;
      renderAbsencePage();
      break;
    }

    case 'changeDay': {
      const val = document.getElementById('abs-day-picker')?.value;
      if (val) { absView.date = val; renderAbsencePage(); }
      break;
    }

    case 'deleteSlot': {
      if (!confirm('Remover este registro de falta?')) return;
      const { absence: absenceId, slot: slotId } = el.dataset;
      deleteAbsenceSlot(absenceId, slotId);
      updateNav();
      toast('Falta removida', 'ok');
      renderAbsencePage();
      break;
    }

    case 'deleteSelected': {
      const checked = document.querySelectorAll('.abs-slot-check:checked');
      if (checked.length === 0) return;
      if (!confirm(`Remover ${checked.length} falta${checked.length !== 1 ? 's' : ''} selecionada${checked.length !== 1 ? 's' : ''}?`)) return;
      checked.forEach(cb => {
        deleteAbsenceSlot(cb.dataset.absence, cb.dataset.slot);
      });
      updateNav();
      toast(`${checked.length} falta${checked.length !== 1 ? 's' : ''} removida${checked.length !== 1 ? 's' : ''}`, 'ok');
      renderAbsencePage();
      break;
    }

    case 'toggleSelectAll': {
      const groupKey = el.dataset.group;
      const container = document.querySelector(`[data-group="${groupKey}"]`);
      if (!container) return;
      const boxes = container.querySelectorAll('.abs-slot-check');
      const allChecked = [...boxes].every(cb => cb.checked);
      boxes.forEach(cb => { cb.checked = !allChecked; });
      el.textContent = allChecked ? 'Selecionar todas' : 'Desselecionar todas';
      _updateBulkBar();
      break;
    }

    case 'changeWeek': {
      const dir = Number(el.dataset.dir);
      if (dir === 0) {
        absView.weekDate = null;
      } else {
        const refDate = absView.weekDate ? parseDate(absView.weekDate) : new Date();
        const monISO  = weekStart(formatISO(refDate));
        const mon     = parseDate(monISO);
        mon.setDate(mon.getDate() + dir * 7);
        absView.weekDate = formatISO(mon);
      }
      renderAbsencePage();
      break;
    }

    case 'saveWppNumber': {
      absView.whatsappNumber = el.value;
      localStorage.setItem('wpp_number', el.value);
      break;
    }

    case 'downloadDayPDF': {
      const date = el.dataset.date ?? absView.date;
      if (date) openPDF(generateDayHTML(date));
      break;
    }

    case 'downloadTeacherPDF': {
      const tid = el.dataset.tid ?? absView.teacherId;
      if (tid) openPDF(generateTeacherHTML(tid));
      break;
    }

    case 'downloadWeekPDF': {
      if (el.dataset.mon) openPDF(generateWeekHTML(el.dataset.mon));
      break;
    }

    case 'downloadMonthPDF': {
      openPDF(generateMonthHTML(Number(el.dataset.year), Number(el.dataset.month)));
      break;
    }

    case 'downloadFullPDF': {
      openPDF(generateFullHTML());
      break;
    }

    case 'shareWppDay': {
      const date = el.dataset.date ?? absView.date;
      if (date) openWhatsApp(buildWppTextDay(date), absView.whatsappNumber);
      break;
    }

    case 'shareWppTeacher': {
      const tid = el.dataset.tid ?? absView.teacherId;
      if (tid) openWhatsApp(buildWppTextTeacher(tid), absView.whatsappNumber);
      break;
    }

    case 'shareWppWeek': {
      if (el.dataset.mon) openWhatsApp(buildWppTextWeek(el.dataset.mon), absView.whatsappNumber);
      break;
    }

    case 'shareWppMonth': {
      openWhatsApp(buildWppTextMonth(Number(el.dataset.year), Number(el.dataset.month)), absView.whatsappNumber);
      break;
    }

    case 'selectMonth': {
      absView.monthDate = el.dataset.date;
      renderAbsencePage();
      break;
    }

    case 'changeMonth': {
      const dir = Number(el.dataset.dir);
      if (dir === 0) {
        absView.monthDate = null;
      } else {
        const refDate = absView.monthDate ? parseDate(absView.monthDate) : new Date();
        // dir ±1 aqui navega por ANO (os balões já fazem a seleção de mês)
        const newDate = new Date(refDate.getFullYear() + dir, refDate.getMonth(), 1);
        absView.monthDate = formatISO(newDate);
      }
      renderAbsencePage();
      break;
    }
  }
}
