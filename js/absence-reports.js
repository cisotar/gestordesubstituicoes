/**
 * absence-reports.js — Geração de PDFs e mensagens WhatsApp de ausências.
 *
 * Exporta:
 *   generateDayHTML(date, teacherIdFilter?)
 *   generateTeacherHTML(teacherId)
 *   generateWeekHTML(monISO)
 *   generateMonthHTML(year, month)
 *   generateFullHTML()
 *   openPDF(html)
 *   buildWppTextDay(date)
 *   buildWppTextTeacher(teacherId)
 *   buildWppTextWeek(monISO)
 *   buildWppTextMonth(year, month)
 *   openWhatsApp(text, number)
 */

import { state }      from './state.js';
import { h }          from './helpers.js';
import { formatBR, dateToDayLabel, weekStart, formatISO, parseDate } from './absences.js';
import { getAulas }   from './periods.js';

const MONTH_NAMES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ─── Utilitários ──────────────────────────────────────────────────────────────

/** Abrevia nome de disciplina: "Matemática" → "Mat." */
function abbrSubj(name) {
  if (!name) return '—';
  return name.length > 5 ? name.slice(0, 4) + '.' : name;
}

/** Objeto de aula (label, inicio, fim, aulaIdx) a partir do timeSlot */
function aulaFromSlot(timeSlot) {
  const [segId, turno, idx] = timeSlot.split('|');
  return getAulas(segId, turno).find(p => p.aulaIdx === Number(idx)) ?? null;
}

/** Todos os slots enriquecidos (teacherId + absenceId injetados) */
function allSlots() {
  return (state.absences ?? []).flatMap(ab =>
    ab.slots.map(sl => ({ ...sl, teacherId: ab.teacherId, absenceId: ab.id }))
  );
}

// ─── CSS do PDF (modelo aprovado) ────────────────────────────────────────────

function _css() {
  return `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#1a1814;
      background:#f0ede6;padding:32px 24px}
    .page{max-width:720px;margin:0 auto;background:#fff;border-radius:8px;
      overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.10)}
    /* ── Cabeçalho do documento ── */
    .doc-hdr{background:#1a1814;color:#fff;padding:24px 32px 20px}
    .doc-lbl{font-size:10px;font-weight:700;letter-spacing:.12em;
      text-transform:uppercase;color:#6b6358;margin-bottom:4px}
    .doc-ttl{font-size:21px;font-weight:800;letter-spacing:-.01em;margin-bottom:18px}
    .doc-meta{display:flex;gap:28px;flex-wrap:wrap;align-items:flex-end}
    .m-blk{display:flex;flex-direction:column;gap:2px}
    .m-lbl{font-size:10px;font-weight:600;letter-spacing:.08em;
      text-transform:uppercase;color:#6b6358}
    .m-val{font-size:15px;font-weight:700;color:#fff}
    .m-day{font-size:28px;font-weight:800;line-height:1}
    /* ── Bloco de professor ── */
    .t-sec{border-top:1px solid #e8e4dc}
    .t-sec:first-child{border-top:none}
    .t-hdr{display:flex;align-items:center;gap:14px;
      padding:16px 32px 12px;background:#faf9f6;border-bottom:1px solid #e8e4dc}
    .t-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;
      justify-content:center;font-size:15px;font-weight:800;flex-shrink:0;
      background:#e2e8f0;color:#334155}
    .t-name{font-size:15px;font-weight:800;color:#1a1814}
    .t-subj{font-size:12px;color:#7a7470;margin-top:2px}
    .t-body{padding:14px 32px 22px}
    /* ── Bloco de data (relatórios multi-dia) ── */
    .d-hdr{padding:12px 32px 10px;background:#f4f2ee;border-bottom:1px solid #e8e4dc;
      border-top:3px solid #d0ccc4}
    .d-name{font-size:14px;font-weight:800;color:#1a1814}
    .d-date{font-size:11px;color:#7a7470;font-family:'Courier New',monospace;margin-top:2px}
    /* ── Tabela ── */
    .sec-lbl{font-size:10px;font-weight:700;letter-spacing:.10em;
      text-transform:uppercase;color:#9a9490;margin-bottom:10px}
    table{width:100%;border-collapse:collapse}
    thead th{background:#f4f2ee;padding:8px 12px;text-align:left;font-size:10px;
      font-weight:700;letter-spacing:.07em;text-transform:uppercase;
      color:#6b6358;border-bottom:2px solid #e0ddd6}
    tbody td{padding:9px 12px;border-bottom:1px solid #ece9e2;
      font-size:13px;vertical-align:middle}
    tbody tr:last-child td{border-bottom:none}
    .td-a{font-family:'Courier New',monospace;font-size:11px;
      font-weight:700;color:#4a4540;white-space:nowrap}
    .td-h{font-size:11px;color:#7a7470;white-space:nowrap}
    .td-tm{font-weight:700}
    .td-ok{font-weight:700;color:#065F46}
    .td-no{font-weight:600;color:#B91C1C}
    /* ── Rodapé ── */
    .doc-ftr{padding:11px 32px;border-top:1px solid #ece9e2;font-size:10px;
      color:#9a9490;display:flex;justify-content:space-between}
    @media print{body{background:#fff;padding:0}
      .page{box-shadow:none;border-radius:0}}
  `;
}

// ─── Blocos HTML internos ──────────────────────────────────────────────────────

function _slotRow(sl) {
  const subj = state.subjects.find(s => s.id === sl.subjectId);
  const subT = sl.substituteId ? state.teachers.find(t => t.id === sl.substituteId) : null;
  const aula = aulaFromSlot(sl.timeSlot);
  return `
    <tr>
      <td class="td-a">${h(aula?.label ?? sl.timeSlot)}</td>
      <td class="td-h">${h(aula ? `${aula.inicio}–${aula.fim}` : '—')}</td>
      <td>${h(subj?.name ?? '—')}</td>
      <td class="td-tm">${h(sl.turma)}</td>
      <td class="${subT ? 'td-ok' : 'td-no'}">${h(subT?.name ?? '— sem substituto')}</td>
    </tr>`;
}

const _TABLE_HEAD = `
  <table><thead><tr>
    <th>Aula</th><th>Horário</th><th>Disciplina</th><th>Turma</th><th>Substituto</th>
  </tr></thead><tbody>`;

/** Bloco de um professor com sua tabela de aulas */
function _teacherSection(teacher, slots) {
  const sorted = slots.slice().sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  const subjNames = [...new Set(
    slots.map(sl => state.subjects.find(s => s.id === sl.subjectId)?.name).filter(Boolean)
  )].join(' · ');
  return `
    <div class="t-sec">
      <div class="t-hdr">
        <div class="t-av">${h(teacher.name.charAt(0))}</div>
        <div>
          <div class="t-name">${h(teacher.name)}</div>
          ${subjNames ? `<div class="t-subj">${h(subjNames)}</div>` : ''}
        </div>
      </div>
      <div class="t-body">
        <div class="sec-lbl">Aulas a substituir</div>
        ${_TABLE_HEAD}${sorted.map(_slotRow).join('')}</tbody></table>
      </div>
    </div>`;
}

/** Bloco de data + slots (para relatórios de semana/mês/geral/professor) */
function _dateSection(date, slots, { withTeacher = false } = {}) {
  const dayLabel = dateToDayLabel(date);
  const dateHdr = `
    <div class="d-hdr">
      <div class="d-name">${dayLabel ?? '—'}</div>
      <div class="d-date">${formatBR(date)}</div>
    </div>`;

  if (withTeacher) {
    // Group by teacher
    const byTid = {};
    slots.forEach(sl => { (byTid[sl.teacherId] ??= []).push(sl); });
    const blocks = Object.keys(byTid).map(tid => {
      const t = state.teachers.find(x => x.id === tid);
      return t ? _teacherSection(t, byTid[tid]) : '';
    }).join('');
    return `<div>${dateHdr}${blocks}</div>`;
  }

  const sorted = slots.slice().sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  return `
    <div>${dateHdr}
      <div style="padding:14px 32px 20px">
        ${_TABLE_HEAD}${sorted.map(_slotRow).join('')}</tbody></table>
      </div>
    </div>`;
}

/** Envoltório HTML completo */
function _wrap(title, metaHTML, bodyHTML) {
  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  return `<!DOCTYPE html><html lang="pt-BR"><head>
    <meta charset="UTF-8"><title>${title}</title>
    <style>${_css()}</style>
  </head><body><div class="page">
    <div class="doc-hdr">
      <div class="doc-lbl">GestãoEscolar</div>
      <div class="doc-ttl">Relatório de Substituições</div>
      <div class="doc-meta">${metaHTML}</div>
    </div>
    ${bodyHTML}
    <div class="doc-ftr">
      <span>Gerado em ${today}</span>
      <span>GestãoEscolar</span>
    </div>
  </div></body></html>`;
}

const _EMPTY = '<div style="padding:32px;text-align:center;color:#9a9490">Sem ausências registradas.</div>';

// ─── Geração de HTML por escopo ───────────────────────────────────────────────

/**
 * Relatório de um dia.
 * Se teacherIdFilter for passado, exibe apenas aquele professor (PDF individual do modal).
 */
export function generateDayHTML(date, teacherIdFilter = null) {
  const slots = allSlots().filter(sl =>
    sl.date === date && (!teacherIdFilter || sl.teacherId === teacherIdFilter)
  );
  const [, m, d] = date.split('-');
  const dayLabel = dateToDayLabel(date);

  // Group by teacher
  const byTid = {};
  slots.forEach(sl => { (byTid[sl.teacherId] ??= []).push(sl); });
  const tids = Object.keys(byTid);

  const metaHTML = `
    <div class="m-blk">
      <span class="m-lbl">Data</span>
      <span class="m-day">${d}</span>
      <span class="m-val" style="font-size:13px;color:#c8c2b8">${MONTH_NAMES[Number(m)-1]}</span>
    </div>
    <div class="m-blk">
      <span class="m-lbl">Dia da semana</span>
      <span class="m-val">${dayLabel ?? '—'}</span>
    </div>
    <div class="m-blk" style="margin-left:auto;text-align:right">
      <span class="m-lbl">Ausências</span>
      <span class="m-val">${tids.length} prof · ${slots.length} aula${slots.length !== 1 ? 's' : ''}</span>
    </div>`;

  const bodyHTML = tids.length
    ? tids.map(tid => {
        const t = state.teachers.find(x => x.id === tid);
        return t ? _teacherSection(t, byTid[tid]) : '';
      }).join('')
    : _EMPTY;

  return _wrap(`Substituições — ${dayLabel ?? ''}, ${formatBR(date)}`, metaHTML, bodyHTML);
}

/** Todas as ausências de um professor, agrupadas por data */
export function generateTeacherHTML(teacherId) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return '';

  const slots = allSlots().filter(sl => sl.teacherId === teacherId);
  const subjNames = [...new Set(
    slots.map(sl => state.subjects.find(s => s.id === sl.subjectId)?.name).filter(Boolean)
  )].join(' · ');

  const byDate = {};
  slots.forEach(sl => { (byDate[sl.date] ??= []).push(sl); });
  const dates = Object.keys(byDate);

  const metaHTML = `
    <div class="m-blk" style="flex:1">
      <span class="m-lbl">Professor ausente</span>
      <span class="m-val" style="font-size:18px">${h(teacher.name)}</span>
      ${subjNames ? `<span class="m-val" style="font-size:13px;color:#c8c2b8">${h(subjNames)}</span>` : ''}
    </div>
    <div class="m-blk" style="text-align:right">
      <span class="m-lbl">Ausências</span>
      <span class="m-val">${slots.length} aula${slots.length !== 1 ? 's' : ''} · ${dates.length} dia${dates.length !== 1 ? 's' : ''}</span>
    </div>`;

  const bodyHTML = dates.length
    ? dates.sort().map(date => _dateSection(date, byDate[date])).join('')
    : _EMPTY;

  return _wrap(`Ausências — ${teacher.name}`, metaHTML, bodyHTML);
}

/** Ausências de uma semana (Segunda → Sexta a partir de monISO) */
export function generateWeekHTML(monISO) {
  const monDate = parseDate(monISO);
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monDate); d.setDate(monDate.getDate() + i); return formatISO(d);
  });
  const friISO = days[4];
  const slots = allSlots().filter(sl => days.includes(sl.date));

  const metaHTML = `
    <div class="m-blk">
      <span class="m-lbl">Semana</span>
      <span class="m-val">${formatBR(monISO)} – ${formatBR(friISO)}</span>
    </div>
    <div class="m-blk" style="margin-left:auto;text-align:right">
      <span class="m-lbl">Ausências</span>
      <span class="m-val">${slots.length} aula${slots.length !== 1 ? 's' : ''}</span>
    </div>`;

  const byDate = {};
  slots.forEach(sl => { (byDate[sl.date] ??= []).push(sl); });
  const bodyHTML = days.filter(d => byDate[d])
    .map(date => _dateSection(date, byDate[date], { withTeacher: true })).join('') || _EMPTY;

  return _wrap(`Substituições — Semana ${formatBR(monISO)} a ${formatBR(friISO)}`, metaHTML, bodyHTML);
}

/** Ausências de um mês inteiro */
export function generateMonthHTML(year, month) {
  const slots = allSlots().filter(sl => {
    const d = parseDate(sl.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const monthName = MONTH_NAMES[month];

  const metaHTML = `
    <div class="m-blk">
      <span class="m-lbl">Mês</span>
      <span class="m-val" style="font-size:18px">${monthName} ${year}</span>
    </div>
    <div class="m-blk" style="margin-left:auto;text-align:right">
      <span class="m-lbl">Ausências</span>
      <span class="m-val">${slots.length} aula${slots.length !== 1 ? 's' : ''}</span>
    </div>`;

  const byDate = {};
  slots.forEach(sl => { (byDate[sl.date] ??= []).push(sl); });
  const bodyHTML = Object.keys(byDate).sort()
    .map(date => _dateSection(date, byDate[date], { withTeacher: true })).join('') || _EMPTY;

  return _wrap(`Substituições — ${monthName} ${year}`, metaHTML, bodyHTML);
}

/** Todos os registros desde o primeiro */
export function generateFullHTML() {
  const slots = allSlots();
  if (!slots.length) return _wrap('Relatório Geral', '', _EMPTY);

  const dates = [...new Set(slots.map(sl => sl.date))].sort();
  const metaHTML = `
    <div class="m-blk">
      <span class="m-lbl">Período</span>
      <span class="m-val">${formatBR(dates[0])} – ${formatBR(dates[dates.length-1])}</span>
    </div>
    <div class="m-blk" style="margin-left:auto;text-align:right">
      <span class="m-lbl">Ausências</span>
      <span class="m-val">${slots.length} aula${slots.length !== 1 ? 's' : ''} · ${dates.length} dia${dates.length !== 1 ? 's' : ''}</span>
    </div>`;

  const byDate = {};
  slots.forEach(sl => { (byDate[sl.date] ??= []).push(sl); });
  const bodyHTML = dates.map(date =>
    _dateSection(date, byDate[date], { withTeacher: true })
  ).join('');

  return _wrap('Relatório Geral de Substituições', metaHTML, bodyHTML);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export function openPDF(html) {
  const win = window.open('', '_blank');
  if (!win) { alert('Permita popups para abrir o relatório.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

const SEP = '━━━━━━━━━━━━━━━━━';

/** Linha de slot no formato compacto (para view por dia, por professor) */
function _slotLine(sl) {
  const aula = aulaFromSlot(sl.timeSlot);
  const subj = state.subjects.find(s => s.id === sl.subjectId);
  const subT = sl.substituteId ? state.teachers.find(t => t.id === sl.substituteId) : null;
  const n    = aula ? `${aula.aulaIdx}ª` : '—';
  const t    = aula?.inicio ?? '—';
  return `• ${n} (${t}) ${abbrSubj(subj?.name)} | ${sl.turma} → ${subT ? `✅ ${subT.name}` : '⚠️ sem sub.'}`;
}

/** Linha de slot com nome do professor (para view por semana/mês) */
function _slotLineWithTeacher(sl) {
  const aula    = aulaFromSlot(sl.timeSlot);
  const subj    = state.subjects.find(s => s.id === sl.subjectId);
  const subT    = sl.substituteId ? state.teachers.find(t => t.id === sl.substituteId) : null;
  const teacher = state.teachers.find(t => t.id === sl.teacherId);
  const label   = aula ? `${aula.aulaIdx}ª (${aula.inicio})` : sl.timeSlot;
  return `👤 *${teacher?.name ?? '—'}* — ${label} ${abbrSubj(subj?.name)} | ${sl.turma} → ${subT ? `✅ ${subT.name}` : '⚠️ sem sub.'}`;
}

/** Texto WA para um dia (todos os professores) */
export function buildWppTextDay(date) {
  const dayLabel = dateToDayLabel(date);
  const slots = allSlots().filter(sl => sl.date === date);
  if (!slots.length) return '';

  const byTid = {};
  slots.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
       .forEach(sl => { (byTid[sl.teacherId] ??= []).push(sl); });

  const blocks = Object.entries(byTid).map(([tid, tSlots]) => {
    const teacher = state.teachers.find(t => t.id === tid);
    const subjNames = [...new Set(
      tSlots.map(sl => state.subjects.find(s => s.id === sl.subjectId)?.name).filter(Boolean)
    )].join(' · ');
    return `${SEP}\n👤 *${teacher?.name ?? '—'}*\n_${subjNames}_\n\n${tSlots.map(_slotLine).join('\n')}`;
  }).join('\n\n');

  return `📋 *Substituições — ${dayLabel ?? ''}, ${formatBR(date)}*\n\n${blocks}\n${SEP}\n_GestãoEscolar_`;
}

/** Texto WA para um professor (todas as datas) */
export function buildWppTextTeacher(teacherId) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return '';
  const slots = allSlots().filter(sl => sl.teacherId === teacherId);
  if (!slots.length) return '';

  const byDate = {};
  slots.forEach(sl => { (byDate[sl.date] ??= []).push(sl); });

  const blocks = Object.keys(byDate).sort().map(date => {
    const dayLabel = dateToDayLabel(date);
    const lines = byDate[date].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map(_slotLine).join('\n');
    return `${SEP}\n📅 *${dayLabel ?? ''}, ${formatBR(date)}*\n${lines}`;
  }).join('\n\n');

  return `📋 *Ausências — ${teacher.name}*\n\n${blocks}\n${SEP}\n_GestãoEscolar_`;
}

/** Texto WA para uma semana */
export function buildWppTextWeek(monISO) {
  const monDate = parseDate(monISO);
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monDate); d.setDate(monDate.getDate() + i); return formatISO(d);
  });
  const friISO = days[4];
  const slots = allSlots().filter(sl => days.includes(sl.date));
  if (!slots.length) return '';

  const byDate = {};
  slots.forEach(sl => { (byDate[sl.date] ??= []).push(sl); });

  const blocks = days.filter(d => byDate[d]).map(date => {
    const dayLabel = dateToDayLabel(date);
    const lines = byDate[date].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map(_slotLineWithTeacher).join('\n');
    return `${SEP}\n📅 *${dayLabel ?? ''}, ${formatBR(date)}*\n${lines}`;
  }).join('\n\n');

  return `📋 *Substituições — Semana ${formatBR(monISO)} a ${formatBR(friISO)}*\n\n${blocks}\n${SEP}\n_GestãoEscolar_`;
}

/** Texto WA para um mês */
export function buildWppTextMonth(year, month) {
  const slots = allSlots().filter(sl => {
    const d = parseDate(sl.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  if (!slots.length) return '';

  const byDate = {};
  slots.forEach(sl => { (byDate[sl.date] ??= []).push(sl); });

  const blocks = Object.keys(byDate).sort().map(date => {
    const dayLabel = dateToDayLabel(date);
    const lines = byDate[date].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map(_slotLineWithTeacher).join('\n');
    return `${SEP}\n📅 *${dayLabel ?? ''}, ${formatBR(date)}*\n${lines}`;
  }).join('\n\n');

  return `📋 *Substituições — ${MONTH_NAMES[month]} ${year}*\n\n${blocks}\n${SEP}\n_GestãoEscolar_`;
}

/** Abre link wa.me com o número e texto codificado */
export function openWhatsApp(text, number) {
  if (!text) { alert('Sem ausências para este período.'); return; }
  const clean = (number ?? '').replace(/\D/g, '');
  if (!clean) { alert('Informe o número de WhatsApp no campo acima.'); return; }
  window.open(`https://wa.me/55${clean}?text=${encodeURIComponent(text)}`, '_blank');
}
