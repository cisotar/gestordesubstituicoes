/**
 * absence-view.js — Página de Ausências com múltiplas visualizações.
 *
 * Visualizações:
 *   - Por professor: lista de professores → clica → faltas por dia
 *   - Por dia: data selecionada → professores ausentes e aulas faltadas
 */

import { state }            from './state.js';
import { DAYS }             from './constants.js';
import { h, colorOfTeacher,
         teacherSubjectNames } from './helpers.js';
import { formatBR,
         dateToDayLabel }   from './absences.js';
import { getAulas,
         slotLabel }        from './periods.js';
import { isAdminRole }      from './auth.js';
import { toast }            from './toast.js';
import { saveState }        from './state.js';
import { updateNav }        from './nav.js';

// ─── UI state ─────────────────────────────────────────────────────────────────

export const absView = {
  mode:       'teacher', // 'teacher' | 'day'
  teacherId:  null,
  date:       null,
};

export function resetAbsenceUI() {
  absView.teacherId = null;
  absView.date      = null;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export function renderAbsencePage() {
  const el = document.getElementById('pg-absences');
  if (!el) return;

  const modeTabs = `
    <div style="display:flex;gap:6px;margin-bottom:20px">
      <button class="home-seg-tab ${absView.mode === 'teacher' ? 'on' : ''}"
        data-ab-action="setMode" data-mode="teacher">👤 Por Professor</button>
      <button class="home-seg-tab ${absView.mode === 'day' ? 'on' : ''}"
        data-ab-action="setMode" data-mode="day">📅 Por Dia</button>
    </div>`;

  const content = absView.mode === 'teacher'
    ? _viewByTeacher()
    : _viewByDay();

  el.innerHTML = `
    <div class="ph" style="margin-bottom:16px">
      <h2>Ausências e Substituições</h2>
    </div>
    ${modeTabs}
    ${content}`;
}

export function renderAbsenceList() {
  renderAbsencePage();
}

// ═══ VISUALIZAÇÃO POR PROFESSOR ══════════════════════════════════════════════

function _viewByTeacher() {
  // Professores que têm ausências registradas
  const teachersWithAbs = state.teachers.filter(t =>
    (state.absences ?? []).some(ab => ab.teacherId === t.id)
  ).sort((a, b) => a.name.localeCompare(b.name));

  const allTeachers = state.teachers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  const teacherBtns = allTeachers.map(t => {
    const cv      = colorOfTeacher(t);
    const absCount = (state.absences ?? [])
      .filter(ab => ab.teacherId === t.id)
      .reduce((acc, ab) => acc + ab.slots.length, 0);
    const isSel   = t.id === absView.teacherId;
    const hasAbs  = absCount > 0;

    return `
      <button class="home-teacher-card ${isSel ? 'selected' : ''} ${!hasAbs ? 'home-teacher-empty' : ''}"
        data-ab-action="selectTeacher" data-tid="${t.id}"
        style="${isSel ? `border-color:var(--navy)` : hasAbs ? `border-color:${cv.bd}` : ''}">
        <div class="home-teacher-av"
          style="background:${hasAbs ? cv.tg : 'var(--surf2)'};
                 color:${hasAbs ? cv.tx : 'var(--t3)'}">
          ${h(t.name.charAt(0))}
        </div>
        <div style="flex:1;min-width:0;text-align:left">
          <div style="font-weight:700;font-size:14px;
            color:${hasAbs ? 'var(--t1)' : 'var(--t3)'};
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${h(t.name)}
          </div>
          <div style="font-size:11px;color:var(--t3);margin-top:2px">
            ${hasAbs ? `${absCount} aula${absCount !== 1 ? 's' : ''} ausente${absCount !== 1 ? 's' : ''}` : 'Sem faltas registradas'}
          </div>
        </div>
        ${hasAbs ? `
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;
            background:${cv.tg};color:${cv.tx};flex-shrink:0">
            ${absCount}
          </span>` : ''}
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
      <!-- Lista de professores -->
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--t3);
          text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">
          ${allTeachers.length} professor${allTeachers.length !== 1 ? 'es' : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;
          max-height:70vh;overflow-y:auto;padding-right:4px">
          ${teacherBtns || '<p style="color:var(--t3);font-size:13px">Nenhum professor cadastrado.</p>'}
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
      byDate[sl.date].push({ ...sl, absenceId: ab.id });
    });
  });

  const dateBlocks = Object.keys(byDate).sort().map(date => {
    const slots   = byDate[date];
    const dayLabel = dateToDayLabel(date);
    const covered  = slots.filter(s => s.substituteId).length;
    const statusColor = covered === slots.length ? 'var(--ok)' : covered > 0 ? '#D97706' : 'var(--err)';
    const statusLabel = covered === slots.length ? '✓ Coberta'
      : covered > 0 ? `⚠ Parcial (${covered}/${slots.length})` : '✕ Sem substituto';

    const slotRows = slots.sort((a,b) => a.timeSlot.localeCompare(b.timeSlot)).map(sl => {
      const subj = state.subjects.find(s => s.id === sl.subjectId);
      const sub  = sl.substituteId ? state.teachers.find(t => t.id === sl.substituteId) : null;
      const parts = sl.timeSlot.split('|');
      const aula  = getAulas(parts[0], parts[1]).find(p => p.aulaIdx === Number(parts[2]));

      return `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;
          border-bottom:1px solid var(--bdr)">
          <div style="min-width:70px;font-family:'DM Mono',monospace;font-size:11px;color:var(--t1)">
            ${h(aula?.label ?? slotLabel(sl.timeSlot))}<br>
            <span style="font-size:10px;color:var(--t2)">${h(aula?.inicio ?? '')}–${h(aula?.fim ?? '')}</span>
          </div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px">${h(sl.turma)}</div>
            <div style="font-size:12px;color:var(--t2)">${h(subj?.name ?? '—')}</div>
          </div>
          <div style="text-align:right">
            ${sub
              ? `<div style="font-size:12px;color:var(--ok);font-weight:700">✓ ${h(sub.name)}</div>`
              : `<div style="font-size:12px;color:var(--err)">⚠ Sem sub.</div>`}
          </div>
          ${isAdminRole() ? `
            <button class="btn-del" data-ab-action="deleteSlot"
              data-absence="${sl.absenceId}" data-slot="${sl.id}">✕</button>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="card card-b" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;
          margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bdr)">
          <div>
            <div style="font-weight:700;font-size:15px">${dayLabel}</div>
            <div style="font-size:12px;color:var(--t2);font-family:'DM Mono',monospace">
              ${formatBR(date)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;font-weight:700;color:${statusColor}">${statusLabel}</div>
            <div style="font-size:11px;color:var(--t3)">${slots.length} aula${slots.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        ${slotRows}
      </div>`;
  }).join('');

  return `
    <div style="display:flex;align-items:center;gap:14px;padding:14px 18px;
      border-radius:var(--rl);background:${cv.bg};border:2px solid ${cv.bd};margin-bottom:20px">
      <div class="th-av" style="background:${cv.tg};color:${cv.tx};
        width:44px;height:44px;font-size:20px;font-weight:800;flex-shrink:0">
        ${h(teacher.name.charAt(0))}
      </div>
      <div>
        <div style="font-weight:700;font-size:16px;color:${cv.tx}">${h(teacher.name)}</div>
        <div style="font-size:12px;color:${cv.tx};opacity:.7">
          ${h(teacherSubjectNames(teacher) || '—')}
        </div>
      </div>
    </div>
    ${dateBlocks}`;
}

// ═══ VISUALIZAÇÃO POR DIA ═════════════════════════════════════════════════════

function _viewByDay() {
  const today = new Date().toISOString().split('T')[0];
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
          <div class="lbl" style="margin-bottom:4px">Datas com ausências</div>
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

    const slotRows = mySlots.map(sl => {
      const subj = state.subjects.find(s => s.id === sl.subjectId);
      const sub  = sl.substituteId ? state.teachers.find(t => t.id === sl.substituteId) : null;
      const parts = sl.timeSlot.split('|');
      const aula  = getAulas(parts[0], parts[1]).find(p => p.aulaIdx === Number(parts[2]));

      return `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;
          border-bottom:1px solid var(--bdr)">
          <div style="min-width:70px;font-family:'DM Mono',monospace;font-size:11px;color:var(--t1)">
            ${h(aula?.label ?? slotLabel(sl.timeSlot))}<br>
            <span style="font-size:10px;color:var(--t2)">${h(aula?.inicio ?? '')}–${h(aula?.fim ?? '')}</span>
          </div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px">${h(sl.turma)}</div>
            <div style="font-size:12px;color:var(--t2)">${h(subj?.name ?? '—')}</div>
          </div>
          <div style="text-align:right;min-width:120px">
            ${sub
              ? `<div style="font-size:12px;font-weight:700;color:var(--ok)">✓ ${h(sub.name)}</div>`
              : `<div style="font-size:12px;color:var(--err);font-weight:600">⚠ Sem substituto</div>`}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="card card-b" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;
          padding-bottom:10px;border-bottom:1px solid var(--bdr)">
          <div class="th-av" style="background:${cv.tg};color:${cv.tx};
            width:36px;height:36px;font-size:16px;font-weight:800;flex-shrink:0">
            ${h(teacher.name.charAt(0))}
          </div>
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">${h(teacher.name)}</div>
            <div style="font-size:12px;color:var(--t2)">${h(teacherSubjectNames(teacher) || '—')}</div>
          </div>
          <div style="font-size:13px;font-weight:700;color:${statusColor}">
            ${covered}/${mySlots.length} coberta${covered !== 1 ? 's' : ''}
          </div>
        </div>
        ${slotRows}
      </div>`;
  }).join('');

  const total    = slotsOnDate.length;
  const covered  = slotsOnDate.filter(s => s.substituteId).length;

  return `${dateSelect}
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;
      padding:12px 16px;border-radius:var(--r);background:var(--surf2)">
      <div>
        <div style="font-weight:700;font-size:15px">${dayLabel ?? '—'}, ${formatBR(date)}</div>
        <div style="font-size:12px;color:var(--t2)">
          ${teachersOnDate.length} professor${teachersOnDate.length !== 1 ? 'es' : ''} ausente${teachersOnDate.length !== 1 ? 's' : ''} ·
          ${total} aula${total !== 1 ? 's' : ''} ·
          ${covered} substituição${covered !== 1 ? 'ões' : ''} definida${covered !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
    ${teacherBlocks}`;
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
        _bindDetail();
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

    case 'deleteSlot': {
      if (!confirm('Remover este registro de falta?')) return;
      const { absence: absenceId, slot: slotId } = el.dataset;
      import('./absences.js').then(({ deleteAbsenceSlot }) => {
        deleteAbsenceSlot(absenceId, slotId);
        updateNav();
        toast('Falta removida', 'ok');
        renderAbsencePage();
      });
      break;
    }

    case 'changeDay': {
      const val = document.getElementById('abs-day-picker')?.value;
      if (val) { absView.date = val; renderAbsencePage(); }
      break;
    }
  }
}

function _bindDetail() {
  document.querySelectorAll('[data-ab-action="deleteSlot"]').forEach(btn => {
    btn.addEventListener('click', () => handleAbsenceAction('deleteSlot', btn));
  });
}
