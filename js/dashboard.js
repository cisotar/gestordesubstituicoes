import { state }                      from './state.js';
import { h, colorOfTeacher }          from './helpers.js';
import { slotLabel }                  from './periods.js';
import {
  getHistory, getTeacherStats,
  getOverloadedTeachers, formatDate, deleteHistoryEntry,
} from './history.js';

// ─── Render principal ────────────────────────────────────────────────────────

export function renderDashboard() {
  const el = document.getElementById('pg-dashboard');
  if (!el) return;

  const totalSubs    = state.history.length;
  const activeSubs   = Object.keys(state.subs).length;
  const overloaded   = getOverloadedTeachers();
  const history      = getHistory();

  el.innerHTML = `
    <div class="ph" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <h2>Dashboard</h2>
        <p>Visão geral da escola, cargas horárias e histórico de substituições.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" data-action="printReport">🖨 Imprimir</button>
        <button class="btn btn-dark  btn-sm" data-action="exportPDF">⬇ Exportar PDF</button>
      </div>
    </div>

    ${overloaded.length > 0 ? renderAlerts(overloaded) : ''}

    <div class="stat-grid">
      ${statCard('👩‍🏫', 'Professores',       state.teachers.length,  '',        'navToTeachers')}
      ${statCard('📚', 'Aulas / semana',     state.schedules.length, '',        'navToSchedules')}
      ${statCard('📋', 'Subs. no histórico', totalSubs,              '',        'nav'           , 'absences')}
      ${statCard('⚠️', 'Subs. ativas',       activeSubs,             activeSubs > 0 ? 'warn' : '', 'nav', 'absences')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
      <div class="card card-b" style="padding:0;overflow:hidden">
        ${renderWorkloadTable()}
      </div>
      <div class="card card-b" style="padding:0;overflow:hidden">
        ${renderHistoryPanel(history)}
      </div>
    </div>`;
}

// ─── Helpers de renderização ──────────────────────────────────────────────────

function statCard(icon, label, value, variant, action = '', page = '') {
  const bg    = variant === 'warn' ? 'var(--err-l)' : 'var(--surf)';
  const color = variant === 'warn' ? '#7F1A06'      : 'var(--t1)';
  const dataAttrs = action
    ? `data-action="${action}"${page ? ` data-page="${page}"` : ''}`
    : '';
  return `
    <button class="card card-b stat-card" style="background:${bg};cursor:pointer;
      text-align:center;font-family:'Figtree',sans-serif;border:none;width:100%"
      ${dataAttrs}>
      <div class="stat-icon">${icon}</div>
      <div class="stat-value" style="color:${color}">${value}</div>
      <div class="stat-label" style="color:${variant === 'warn' ? '#7F1A06' : 'var(--t2)'}">${label}</div>
    </button>`;
}

function renderAlerts(overloaded) {
  const items = overloaded.map(({ teacher, schedules, level }) => {
    const cv = colorOfTeacher(teacher);
    const bg = level === 'danger' ? '#FFF1EE' : '#FFFBEB';
    const bd = level === 'danger' ? '#FDB8A8' : '#FCD34D';
    const tx = level === 'danger' ? '#7F1A06' : '#78350F';
    const icon = level === 'danger' ? '🔴' : '🟡';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;
        border-radius:var(--r);background:${bg};border:1px solid ${bd};margin-bottom:6px">
        <span style="font-size:16px">${icon}</span>
        <div style="flex:1">
          <span style="font-weight:700;color:${tx};font-size:14px">${h(teacher.name)}</span>
          <span style="font-size:12px;color:${tx};opacity:.7;margin-left:8px">${h(teacher.area)}</span>
        </div>
        <span style="font-size:13px;font-weight:700;color:${tx}">
          ${schedules} aulas/sem.
        </span>
      </div>`;
  }).join('');

  return `
    <div style="margin-bottom:20px">
      <div class="sec-lbl" style="margin-top:0">⚠️ Professores sobrecarregados</div>
      ${items}
    </div>`;
}

function renderWorkloadTable() {
  if (state.teachers.length === 0) {
    return `<div style="padding:32px;text-align:center;color:var(--t3)">
      <p>Nenhum professor cadastrado.</p></div>`;
  }

  const maxLoad = state.workloadDanger || 26;
  const rows = state.teachers
    .map(t => ({ t, ...getTeacherStats(t.id) }))
    .sort((a, b) => b.schedules - a.schedules)
    .map(({ t, schedules, absences, subsGiven, workloadRatio }) => {
      const cv      = colorOfTeacher(t);
      const pct     = Math.round(workloadRatio * 100);
      const barColor = pct >= 100 ? '#C8290A' : pct >= 77 ? '#D97706' : '#16A34A';
      return `
        <tr>
          <td style="padding:10px 14px">
            <div style="font-weight:600;font-size:13px">${h(t.name)}</div>
            <div style="font-size:11px;color:var(--t3)">${h(t.area)}</div>
          </td>
          <td style="padding:10px 8px;text-align:center">
            <div style="font-weight:700;font-size:15px">${schedules}</div>
            <div class="wl-bar-wrap"><div class="wl-bar" style="width:${pct}%;background:${barColor}"></div></div>
          </td>
          <td style="padding:10px 8px;text-align:center;font-size:13px;color:#C8290A;font-weight:600">
            ${absences || '—'}
          </td>
          <td style="padding:10px 14px;text-align:center;font-size:13px;color:#047857;font-weight:600">
            ${subsGiven || '—'}
          </td>
        </tr>`;
    }).join('');

  return `
    <div style="padding:16px 16px 8px;border-bottom:1px solid var(--bdr)">
      <div style="font-weight:700;font-size:14px">Carga Horária</div>
      <div style="font-size:12px;color:var(--t3)">Aulas / semana · limite: ${maxLoad}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:var(--surf2)">
          <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Professor</th>
          <th style="padding:8px 8px;text-align:center;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Aulas</th>
          <th style="padding:8px 8px;text-align:center;font-size:10px;font-weight:700;color:#C8290A;text-transform:uppercase;letter-spacing:.05em">Faltas</th>
          <th style="padding:8px 14px;text-align:center;font-size:10px;font-weight:700;color:#047857;text-transform:uppercase;letter-spacing:.05em">Subs</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderHistoryPanel(history) {
  const header = `
    <div style="padding:16px 16px 8px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-weight:700;font-size:14px">Histórico de Substituições</div>
        <div style="font-size:12px;color:var(--t3)">${history.length} registro${history.length !== 1 ? 's' : ''}</div>
      </div>
    </div>`;

  if (history.length === 0) {
    return header + `<div style="padding:32px;text-align:center;color:var(--t3)">
      <p>Nenhuma substituição registrada ainda.</p></div>`;
  }

  const rows = history.slice(0, 40).map(entry => `
    <tr>
      <td style="padding:9px 14px;font-family:'DM Mono',monospace;font-size:11px;color:var(--t2);white-space:nowrap">
        ${formatDate(entry.date)}
      </td>
      <td style="padding:9px 8px">
        <div style="font-size:12px;font-weight:600">${h(entry.teacherName)}</div>
        <div style="font-size:11px;color:var(--t3)">${h(entry.slotLabel)} · ${h(entry.day)}</div>
      </td>
      <td style="padding:9px 8px">
        <div style="font-size:12px;font-weight:600;color:#047857">${h(entry.subName)}</div>
        <div style="font-size:11px;color:var(--t3)">${h(entry.subArea)}</div>
      </td>
      <td style="padding:9px 14px">
        <button class="btn-del" style="font-size:13px" data-action="deleteHistory" data-id="${entry.id}" title="Remover do histórico">✕</button>
      </td>
    </tr>`).join('');

  return header + `
    <div style="overflow-y:auto;max-height:440px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--surf2)">
            <th style="padding:8px 14px;text-align:left;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap">Data</th>
            <th style="padding:8px 8px;text-align:left;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Ausente</th>
            <th style="padding:8px 8px;text-align:left;font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Substituto</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}
