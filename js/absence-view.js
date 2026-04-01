/**
 * absence-view.js — Página de gestão de ausências.
 *
 * Fluxo:
 *   1. Seleciona professor e intervalo de datas
 *   2. Grade semanal do professor com as datas reais
 *   3. Admin seleciona slots (avulso / dia inteiro / semana)
 *   4. Para cada slot: lista ranqueada de candidatos
 *   5. Confirma → cria ausência → exibe relatório
 */

import { state }         from './state.js';
import { DAYS }          from './constants.js';
import {
  h, colorOfTeacher, teacherSubjectNames,
} from './helpers.js';
import {
  slotLabel, slotFullLabel, getAulas, getPeriodos,
} from './periods.js';
import {
  rankCandidates, createAbsence, assignSubstitute,
  deleteAbsence, deleteAbsenceSlot,
  businessDaysBetween, dateToDayLabel,
  formatBR, weekStart, absencesOf,
} from './absences.js';
import { saveState } from './state.js';

// ─── Estado local da UI ───────────────────────────────────────────────────────

let ui = {
  teacherId:   null,
  dateFrom:    null,
  dateTo:      null,
  selected:    new Set(), // "date|timeSlot"
  assignments: {},        // "date|timeSlot" → substituteId
  step:        'select',  // 'select' | 'assign' | 'report'
  absenceId:   null,      // após confirmação
};

export function resetAbsenceUI() {
  ui = {
    teacherId: null, dateFrom: null, dateTo: null,
    selected: new Set(), assignments: {},
    step: 'select', absenceId: null,
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderAbsencePage() {
  const el = document.getElementById('pg-absences');
  if (!el) return;

  switch (ui.step) {
    case 'select': el.innerHTML = stepSelect(); break;
    case 'assign': el.innerHTML = stepAssign(); break;
    case 'report': el.innerHTML = stepReport(); break;
  }
}

// ═══ STEP 1 — Seleção de professor e slots ════════════════════════════════════

function stepSelect() {
  const tOpts = `<option value="">Selecione…</option>` +
    state.teachers.map(t =>
      `<option value="${t.id}" ${t.id === ui.teacherId ? 'selected' : ''}>${h(t.name)}</option>`
    ).join('');

  const today = new Date().toISOString().split('T')[0];
  const from  = ui.dateFrom || today;
  const to    = ui.dateTo   || today;

  const grid = ui.teacherId ? buildGrid(from, to) : '';
  const selectedCount = ui.selected.size;

  return `
    <div class="ph" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h2>Registro de Ausência</h2>
        <p>Selecione o professor, o período de ausência e as aulas a substituir.</p>
      </div>
      <button class="btn btn-ghost btn-sm" data-ab-action="viewAll">
        📋 Ver todas as ausências
      </button>
    </div>

    <!-- Filtros -->
    <div class="card card-b" style="max-width:700px;margin-bottom:20px">
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;align-items:flex-end">
        <div class="fld">
          <label class="lbl">Professor ausente</label>
          <select class="inp" id="ab-teacher" data-ab-action="changeTeacher">${tOpts}</select>
        </div>
        <div class="fld">
          <label class="lbl">Data inicial</label>
          <input class="inp" type="date" id="ab-from" value="${h(from)}" data-ab-action="changeDates">
        </div>
        <div class="fld">
          <label class="lbl">Data final</label>
          <input class="inp" type="date" id="ab-to" value="${h(to)}" data-ab-action="changeDates">
        </div>
      </div>
    </div>

    ${ui.teacherId ? `
      <!-- Atalhos de seleção -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.05em">Selecionar:</span>
        <button class="btn btn-ghost btn-xs" data-ab-action="selectAll">Todas as aulas</button>
        <button class="btn btn-ghost btn-xs" data-ab-action="clearSel">Limpar seleção</button>
        <span style="margin-left:auto;font-size:13px;color:var(--t2)">
          ${selectedCount > 0 ? `<strong style="color:var(--t1)">${selectedCount}</strong> aula${selectedCount !== 1 ? 's' : ''} selecionada${selectedCount !== 1 ? 's' : ''}` : 'Nenhuma aula selecionada'}
        </span>
        ${selectedCount > 0 ? `
          <button class="btn btn-dark btn-sm" data-ab-action="goAssign">
            Atribuir substitutos →
          </button>` : ''}
      </div>

      ${grid}
    ` : `
      <div class="empty" style="max-width:500px">
        <div class="empty-ico">👤</div>
        <div class="empty-ttl">Selecione um professor</div>
        <div class="empty-dsc">Escolha o professor ausente para visualizar o horário de aulas.</div>
      </div>
    `}`;
}

function buildGrid(from, to) {
  const teacher = state.teachers.find(t => t.id === ui.teacherId);
  if (!teacher) return '';
  const cv = colorOfTeacher(teacher);

  // Datas úteis no intervalo
  const dates = businessDaysBetween(from, to);
  if (dates.length === 0) {
    return `<div class="card card-b" style="color:var(--t2);padding:24px;text-align:center">
      Nenhum dia útil no período selecionado.</div>`;
  }

  // Aulas do professor por dia
  const mine = state.schedules.filter(s => s.teacherId === ui.teacherId);

  // Coleta todos os timeSlots únicos do professor nesse período
  const dayLabels = [...new Set(dates.map(d => dateToDayLabel(d)).filter(Boolean))];
  const allSlots  = [...new Set(
    mine.filter(s => dayLabels.includes(s.day)).map(s => s.timeSlot)
  )].sort((a, b) => {
    const pa = a.split('|'), pb = b.split('|');
    const ra = getAulas(pa[0], pa[1]).find(p => p.aulaIdx === Number(pa[2]));
    const rb = getAulas(pb[0], pb[1]).find(p => p.aulaIdx === Number(pb[2]));
    return (ra?.inicio || '').localeCompare(rb?.inicio || '');
  });

  if (allSlots.length === 0) {
    return `<div class="card card-b" style="color:var(--t2);padding:24px;text-align:center">
      Este professor não tem aulas nos dias selecionados.</div>`;
  }

  // Cabeçalho: datas
  const headers = dates.map(date => {
    const label = dateToDayLabel(date);
    const hasSel = allSlots.some(slot => ui.selected.has(`${date}|${slot}`));
    return `
      <th style="min-width:110px;text-align:center">
        <div style="font-weight:700">${label}</div>
        <div style="font-size:10px;font-weight:400;opacity:.7;font-family:'DM Mono',monospace">${formatBR(date)}</div>
        <button class="btn-day-sel" data-ab-action="toggleDay" data-date="${date}"
          style="font-size:10px;margin-top:3px;${hasSel ? 'color:var(--accent)' : ''}">
          ${hasSel ? '✓ dia marcado' : '+ marcar dia'}
        </button>
      </th>`;
  }).join('');

  // Linhas: slots × datas
  const rows = allSlots.map(slot => {
    const period = (() => {
      const p = slot.split('|');
      return getAulas(p[0], p[1]).find(x => x.aulaIdx === Number(p[2]));
    })();

    const cells = dates.map(date => {
      const dayLabel = dateToDayLabel(date);
      const cls      = mine.find(s => s.day === dayLabel && s.timeSlot === slot);
      if (!cls) return `<td style="background:var(--bg)"></td>`;

      const key     = `${date}|${slot}`;
      const isSel   = ui.selected.has(key);
      const subj    = state.subjects.find(s => s.id === cls.subjectId);
      const bg      = isSel ? '#EFF6FF' : cv.bg;
      const border  = isSel ? '2px solid #2563EB' : `1px solid ${cv.bd}`;

      return `
        <td style="padding:5px">
          <button class="ab-slot-btn"
            data-ab-action="toggleSlot" data-key="${key}"
            style="background:${bg};border:${border};color:${cv.tx}">
            <div style="font-weight:700;font-size:12px">${h(subj?.name ?? '—')}</div>
            <div style="font-size:11px;opacity:.75">${h(cls.turma)}</div>
            ${isSel ? '<div style="font-size:10px;margin-top:3px;color:#2563EB;font-weight:700">✓ selecionada</div>' : ''}
          </button>
        </td>`;
    }).join('');

    return `
      <tr>
        <td class="sl" style="white-space:nowrap">
          <div class="sl-n">${h(period?.label ?? slotLabel(slot))}</div>
          ${period ? `<div class="sl-t">${h(period.inicio)}–${h(period.fim)}</div>` : ''}
        </td>
        ${cells}
      </tr>`;
  }).join('');

  return `
    <div class="cal-wrap">
      <table class="ctbl">
        <thead>
          <tr>
            <th style="text-align:left;min-width:120px">Aula</th>
            ${headers}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ═══ STEP 2 — Atribuição de substitutos ══════════════════════════════════════

function stepAssign() {
  const teacher = state.teachers.find(t => t.id === ui.teacherId);
  if (!teacher) return '';
  const cv = colorOfTeacher(teacher);

  // Ordena slots selecionados por data → horário
  const sortedKeys = [...ui.selected].sort();

  const blocks = sortedKeys.map(key => {
    const [date, timeSlot] = key.split('|');
    const dayLabel = dateToDayLabel(date);
    const cls      = state.schedules.find(
      s => s.teacherId === ui.teacherId && s.day === dayLabel && s.timeSlot === timeSlot
    );
    const subj     = state.subjects.find(s => s.id === cls?.subjectId);
    const period   = (() => {
      const p = timeSlot.split('|');
      return getAulas(p[0], p[1]).find(x => x.aulaIdx === Number(p[2]));
    })();

    const assigned = ui.assignments[key];
    const assigT   = assigned ? state.teachers.find(t => t.id === assigned) : null;
    const candidates = rankCandidates(ui.teacherId, date, timeSlot, cls?.subjectId);

    const candRows = candidates.slice(0, 8).map((c, i) => {
      const tc      = colorOfTeacher(c.teacher);
      const isAssig = c.teacher.id === assigned;
      const matchLbl = c.match === 'subject' ? '⭐ mesma matéria'
        : c.match === 'area' ? '🔵 mesma área' : '⚪ outra área';
      return `
        <button class="cand${isAssig ? ' sel' : ''}"
          data-ab-action="pickSub" data-key="${key}" data-sub="${c.teacher.id}">
          <span class="cand-dot" style="background:${tc.dt}"></span>
          <div style="flex:1">
            <div class="cand-name">${h(c.teacher.name)}</div>
            <div class="cand-area">
              <span style="font-size:10px">${matchLbl}</span>
              <span style="margin-left:8px;font-size:10px;color:var(--t3)">${c.load} aulas/sem.</span>
            </div>
          </div>
          ${isAssig ? '<span class="cand-cur">✓ selecionado</span>' : ''}
          <span style="color:var(--t3);font-size:18px">›</span>
        </button>`;
    }).join('');

    const noCandidates = candidates.length === 0
      ? `<div style="padding:16px;text-align:center;color:var(--t3);font-size:13px">
          Nenhum professor disponível neste horário.</div>` : '';

    return `
      <div class="ab-slot-card ${assigT ? 'ab-slot-covered' : 'ab-slot-open'}">
        <div class="ab-slot-hdr">
          <div>
            <div style="font-weight:700;font-size:14px">${h(dayLabel)}, ${formatBR(date)}</div>
            <div style="font-size:12px;color:var(--t2);margin-top:2px">
              ${h(period?.label ?? slotLabel(timeSlot))}
              ${period ? ` · ${h(period.inicio)}–${h(period.fim)}` : ''}
              ${subj ? ` · ${h(subj.name)}` : ''}
              ${cls?.turma ? ` · ${h(cls.turma)}` : ''}
            </div>
          </div>
          <div style="text-align:right">
            ${assigT ? `
              <div style="font-size:12px;color:var(--ok);font-weight:700">✓ ${h(assigT.name)}</div>
              <button style="font-size:11px;color:var(--err);background:none;border:none;cursor:pointer;font-family:'Figtree',sans-serif"
                data-ab-action="clearSub" data-key="${key}">remover</button>
            ` : `<div style="font-size:12px;color:var(--t3)">Sem substituto</div>`}
          </div>
        </div>
        <div style="margin-top:10px">
          ${noCandidates}
          ${candRows}
          ${candidates.length > 8 ? `<div style="font-size:12px;color:var(--t3);padding:6px 0">
            +${candidates.length - 8} outros disponíveis — atribua manualmente clicando acima</div>` : ''}
        </div>
      </div>`;
  }).join('');

  const allAssigned = sortedKeys.every(k => ui.assignments[k]);
  const assignedCount = Object.keys(ui.assignments).length;

  return `
    <button class="btn btn-ghost btn-sm" style="margin-bottom:16px" data-ab-action="goSelect">
      ← Voltar à seleção
    </button>

    <div class="ph">
      <h2>Atribuir Substitutos</h2>
      <p>
        Ausência de <strong>${h(teacher.name)}</strong> ·
        ${sortedKeys.length} aula${sortedKeys.length !== 1 ? 's' : ''} ·
        ${assignedCount} atribuída${assignedCount !== 1 ? 's' : ''}
      </p>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap">
      ${allAssigned ? `
        <button class="btn btn-dark" data-ab-action="confirmAbsence">
          ✓ Confirmar e gerar relatório
        </button>` : `
        <button class="btn btn-dark" data-ab-action="confirmAbsence"
          ${assignedCount === 0 ? 'disabled style="opacity:.5"' : ''}>
          Confirmar parcialmente (${assignedCount}/${sortedKeys.length})
        </button>`}
    </div>

    <div style="display:flex;flex-direction:column;gap:12px">
      ${blocks}
    </div>`;
}

// ═══ STEP 3 — Relatório de substituição ══════════════════════════════════════

function stepReport() {
  const ab = state.absences?.find(a => a.id === ui.absenceId);
  if (!ab) return '';
  const teacher = state.teachers.find(t => t.id === ab.teacherId);
  const cv      = colorOfTeacher(teacher);

  const covered = ab.slots.filter(s => s.substituteId).length;
  const total   = ab.slots.length;
  const statusColor = covered === total ? 'var(--ok)' : covered > 0 ? '#D97706' : 'var(--err)';
  const statusLabel = covered === total ? '✓ Totalmente coberta'
    : covered > 0 ? `⚠ Parcialmente coberta (${covered}/${total})`
    : '✕ Sem substitutos';

  // Ordena slots por data → horário
  const sorted = [...ab.slots].sort((a, b) =>
    a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)
  );

  const rows = sorted.map(sl => {
    const sub  = sl.substituteId ? state.teachers.find(t => t.id === sl.substituteId) : null;
    const subj = state.subjects.find(s => s.id === sl.subjectId);
    const period = (() => {
      const p = sl.timeSlot.split('|');
      return getAulas(p[0], p[1]).find(x => x.aulaIdx === Number(p[2]));
    })();

    return `
      <tr>
        <td style="padding:10px 14px;font-family:'DM Mono',monospace;font-size:12px;white-space:nowrap">
          ${h(sl.day)}, ${formatBR(sl.date)}
        </td>
        <td style="padding:10px 8px;font-size:13px">
          ${h(period?.label ?? slotLabel(sl.timeSlot))}
          ${period ? `<div style="font-size:11px;color:var(--t3)">${h(period.inicio)}–${h(period.fim)}</div>` : ''}
        </td>
        <td style="padding:10px 8px;font-size:13px">${h(subj?.name ?? '—')}</td>
        <td style="padding:10px 8px;font-size:13px">${h(sl.turma)}</td>
        <td style="padding:10px 14px">
          ${sub ? `
            <div style="font-weight:700;font-size:13px;color:var(--ok)">${h(sub.name)}</div>
            <div style="font-size:11px;color:var(--t3)">${h(teacherSubjectNames(sub) || '—')}</div>
          ` : `<span style="color:var(--err);font-size:13px">Sem substituto</span>`}
        </td>
        <td style="padding:10px 14px">
          <button class="btn-del" data-ab-action="deleteSlot"
            data-absence="${ab.id}" data-slot="${sl.id}">✕</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-ghost btn-sm" data-ab-action="newAbsence">← Nova ausência</button>
      <button class="btn btn-ghost btn-sm" data-ab-action="viewAll">📋 Ver todas</button>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" data-ab-action="printReport">🖨 Imprimir</button>
      </div>
    </div>

    <!-- Header do relatório -->
    <div class="card card-b" style="margin-bottom:20px;background:${cv.bg};border-color:${cv.bd}">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div class="th-av" style="background:${cv.tg};color:${cv.tx}">${h(teacher?.name.charAt(0) ?? '?')}</div>
        <div>
          <h3 style="color:${cv.tx};font-size:18px">${h(teacher?.name ?? '—')}</h3>
          <div style="font-size:12px;color:${cv.tx};opacity:.7">${h(teacherSubjectNames(teacher) || '—')}</div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-size:14px;font-weight:700;color:${statusColor}">${statusLabel}</div>
          <div style="font-size:12px;color:var(--t2);margin-top:2px">${total} aula${total !== 1 ? 's' : ''} ausente${total !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>

    <!-- Tabela de substituições -->
    <div class="cal-wrap">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--navy2)">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Data</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.06em">Aula</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.06em">Matéria</th>
            <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.06em">Turma</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.06em">Substituto</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div style="margin-top:12px;text-align:right">
      <button class="btn btn-ghost btn-xs" style="color:var(--err)"
        data-ab-action="deleteAbsence" data-absence="${ab.id}">
        🗑 Excluir esta ausência
      </button>
    </div>`;
}

// ═══ Lista de todas as ausências ══════════════════════════════════════════════

export function renderAbsenceList() {
  const el = document.getElementById('pg-absences');
  if (!el) return;

  const absences = [...(state.absences || [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const statusBadge = (ab) => {
    const c = ab.slots.filter(s => s.substituteId).length;
    const t = ab.slots.length;
    if (c === t) return `<span style="color:var(--ok);font-size:12px;font-weight:700">✓ Coberta</span>`;
    if (c > 0)   return `<span style="color:#D97706;font-size:12px;font-weight:700">⚠ Parcial ${c}/${t}</span>`;
    return `<span style="color:var(--err);font-size:12px;font-weight:700">✕ Aberta</span>`;
  };

  const list = absences.length === 0
    ? `<div class="empty">
        <div class="empty-ico">📋</div>
        <div class="empty-ttl">Nenhuma ausência registrada</div>
        <div class="empty-dsc">Registre a ausência de um professor para começar.</div>
      </div>`
    : absences.map(ab => {
        const t  = state.teachers.find(x => x.id === ab.teacherId);
        const cv = colorOfTeacher(t);
        const dates = [...new Set(ab.slots.map(s => s.date))].sort();
        const dateRange = dates.length === 1
          ? formatBR(dates[0])
          : `${formatBR(dates[0])} – ${formatBR(dates[dates.length - 1])}`;
        return `
          <div class="ti" style="cursor:pointer;flex-wrap:wrap;gap:8px"
            data-ab-action="openAbsence" data-absence="${ab.id}">
            <span class="ti-dot" style="background:${cv.dt}"></span>
            <div style="flex:1;min-width:120px">
              <div class="ti-name">${h(t?.name ?? '—')}</div>
              <div style="font-size:12px;color:var(--t3)">${dateRange} · ${ab.slots.length} aula${ab.slots.length !== 1 ? 's' : ''}</div>
            </div>
            ${statusBadge(ab)}
            <button class="btn-del" data-ab-action="deleteAbsence" data-absence="${ab.id}">✕</button>
          </div>`;
      }).join('');

  el.innerHTML = `
    <div class="ph" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h2>Ausências Registradas</h2>
        <p>${absences.length} registro${absences.length !== 1 ? 's' : ''}</p>
      </div>
      <button class="btn btn-dark" data-ab-action="newAbsence">+ Nova ausência</button>
    </div>
    <div style="max-width:700px">${list}</div>`;
}

// ═══ Handlers de ação ════════════════════════════════════════════════════════

export function handleAbsenceAction(action, el) {
  switch (action) {

    case 'changeTeacher': {
      ui.teacherId = el.value || null;
      ui.selected.clear();
      ui.assignments = {};
      renderAbsencePage();
      break;
    }

    case 'changeDates': {
      const from = document.getElementById('ab-from')?.value;
      const to   = document.getElementById('ab-to')?.value;
      if (from && to && from <= to) {
        ui.dateFrom = from;
        ui.dateTo   = to;
        ui.selected.clear();
        ui.assignments = {};
        renderAbsencePage();
      }
      break;
    }

    case 'toggleSlot': {
      const key = el.dataset.key;
      if (ui.selected.has(key)) ui.selected.delete(key);
      else ui.selected.add(key);
      renderAbsencePage();
      break;
    }

    case 'toggleDay': {
      const date  = el.dataset.date;
      const mine  = state.schedules.filter(s => s.teacherId === ui.teacherId);
      const label = dateToDayLabel(date);
      const daySlots = mine
        .filter(s => s.day === label)
        .map(s => `${date}|${s.timeSlot}`);
      const allSel = daySlots.every(k => ui.selected.has(k));
      daySlots.forEach(k => allSel ? ui.selected.delete(k) : ui.selected.add(k));
      renderAbsencePage();
      break;
    }

    case 'selectAll': {
      const mine = state.schedules.filter(s => s.teacherId === ui.teacherId);
      const dates = businessDaysBetween(ui.dateFrom, ui.dateTo);
      dates.forEach(date => {
        const label = dateToDayLabel(date);
        mine.filter(s => s.day === label).forEach(s => {
          ui.selected.add(`${date}|${s.timeSlot}`);
        });
      });
      renderAbsencePage();
      break;
    }

    case 'clearSel': {
      ui.selected.clear();
      renderAbsencePage();
      break;
    }

    case 'goAssign': {
      if (ui.selected.size === 0) return;
      ui.step = 'assign';
      renderAbsencePage();
      break;
    }

    case 'goSelect': {
      ui.step = 'select';
      renderAbsencePage();
      break;
    }

    case 'pickSub': {
      const key = el.dataset.key;
      const sub = el.dataset.sub;
      ui.assignments[key] = ui.assignments[key] === sub ? undefined : sub;
      if (!ui.assignments[key]) delete ui.assignments[key];
      renderAbsencePage();
      break;
    }

    case 'clearSub': {
      delete ui.assignments[el.dataset.key];
      renderAbsencePage();
      break;
    }

    case 'confirmAbsence': {
      if (Object.keys(ui.assignments).length === 0) return;

      const teacher = state.teachers.find(t => t.id === ui.teacherId);
      const rawSlots = [...ui.selected].map(key => {
        const [date, timeSlot] = key.split('|');
        const dayLabel = dateToDayLabel(date);
        const cls = state.schedules.find(
          s => s.teacherId === ui.teacherId && s.day === dayLabel && s.timeSlot === timeSlot
        );
        return {
          date, timeSlot,
          scheduleId: cls?.id ?? null,
          subjectId:  cls?.subjectId ?? null,
          turma:      cls?.turma ?? '',
        };
      });

      const absenceId = createAbsence(ui.teacherId, rawSlots);

      // Atribui os substitutos já selecionados
      const ab = state.absences.find(a => a.id === absenceId);
      ab?.slots.forEach(sl => {
        const key = `${sl.date}|${sl.timeSlot}`;
        if (ui.assignments[key]) {
          assignSubstitute(absenceId, sl.id, ui.assignments[key]);
        }
      });

      ui.absenceId = absenceId;
      ui.step = 'report';
      renderAbsencePage();
      break;
    }

    case 'openAbsence': {
      ui.absenceId = el.dataset.absence;
      ui.step = 'report';
      renderAbsencePage();
      break;
    }

    case 'deleteAbsence': {
      if (!confirm('Excluir esta ausência?')) return;
      deleteAbsence(el.dataset.absence);
      if (ui.absenceId === el.dataset.absence) {
        ui.step = 'select';
        ui.absenceId = null;
      }
      renderAbsenceList();
      break;
    }

    case 'deleteSlot': {
      if (!confirm('Remover este horário da ausência?')) return;
      deleteAbsenceSlot(el.dataset.absence, el.dataset.slot);
      renderAbsencePage();
      break;
    }

    case 'newAbsence': {
      resetAbsenceUI();
      ui.step = 'select';
      renderAbsencePage();
      break;
    }

    case 'viewAll': {
      renderAbsenceList();
      break;
    }

    case 'printReport': {
      _printAbsence(ui.absenceId);
      break;
    }
  }
}

// ─── Impressão ────────────────────────────────────────────────────────────────

function _printAbsence(absenceId) {
  const ab = state.absences?.find(a => a.id === absenceId);
  if (!ab) return;
  const teacher = state.teachers.find(t => t.id === ab.teacherId);
  const sorted  = [...ab.slots].sort((a, b) =>
    a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot)
  );

  const rows = sorted.map(sl => {
    const sub  = sl.substituteId ? state.teachers.find(t => t.id === sl.substituteId) : null;
    const subj = state.subjects.find(s => s.id === sl.subjectId);
    const p    = sl.timeSlot.split('|');
    const aula = getAulas(p[0], p[1]).find(x => x.aulaIdx === Number(p[2]));
    return `<tr>
      <td>${sl.day}, ${formatBR(sl.date)}</td>
      <td>${aula ? `${aula.label} (${aula.inicio}–${aula.fim})` : slotLabel(sl.timeSlot)}</td>
      <td>${subj?.name ?? '—'}</td>
      <td>${sl.turma}</td>
      <td style="font-weight:700;color:${sub ? '#047857' : '#C8290A'}">${sub?.name ?? '—'}</td>
    </tr>`;
  }).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Substituição — ${teacher?.name}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',sans-serif;font-size:13px;color:#1a1814;padding:24px}
      h1{font-size:18px;font-weight:800;margin-bottom:4px}
      .sub{font-size:12px;color:#6b6760;margin-bottom:20px}
      table{width:100%;border-collapse:collapse}
      th{background:#1a1814;color:#fff;padding:8px 12px;text-align:left;font-size:11px}
      td{padding:8px 12px;border-bottom:1px solid #e0ddd6;font-size:12px}
      tr:nth-child(even) td{background:#f4f2ee}
      @media print{body{padding:0}}
    </style></head><body>
    <h1>Substituição — ${teacher?.name ?? '—'}</h1>
    <div class="sub">Gerado em ${new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'})}</div>
    <table>
      <thead><tr><th>Data</th><th>Aula</th><th>Matéria</th><th>Turma</th><th>Substituto</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
