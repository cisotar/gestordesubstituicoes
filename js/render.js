import { DAYS, COLOR_PALETTE }  from './constants.js';
import { state }                from './state.js';
import {
  h, colorOfTeacher, getSubstitute,
  teacherSubjectNames, allTurmaObjects, findTurma,
} from './helpers.js';
import {
  getPeriodos, getAulas, slotLabel, slotTimeRange,
  slotFullLabel, allUsedSlots, slotsForTurma,
  getCfg, gerarPeriodos,
} from './periods.js';

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export function renderPage() {
  switch (state.page) {
    case 'calendar': renderCalendar(); break;
    case 'teacher':  renderTeacher();  break;
    case 'settings': renderSettings(); break;
  }
}

// ─── Calendário Geral ─────────────────────────────────────────────────────────

export function renderCalendar() {
  const el = document.getElementById('cal-out');
  if (!el) return;

  if (state.schedules.length === 0) {
    el.innerHTML = `
      <div class="empty">
        <div class="empty-ico">📅</div>
        <div class="empty-ttl">Nenhuma aula cadastrada</div>
        <div class="empty-dsc">Configure segmentos, professores e horários de aula para visualizar o calendário.</div>
        <button class="btn btn-dark" data-action="nav" data-page="settings">Ir para Configurações</button>
      </div>`;
    return;
  }

  const subCount = Object.keys(state.subs).length;
  let html = subCount > 0
    ? `<div class="banner">⚠️ ${subCount} substituição${subCount > 1 ? 'ões' : ''} registrada${subCount > 1 ? 's' : ''} esta semana</div>`
    : '';

  // Agrupa por segmento
  state.segments.forEach(seg => {
    const segSchedules = state.schedules.filter(s => {
      const turmaObj = findTurma(s.turma);
      return turmaObj?.segmentId === seg.id;
    });
    if (segSchedules.length === 0) return;

    // Slots usados neste segmento, ordenados por horário
    const usedSlots = [...new Set(segSchedules.map(s => s.timeSlot))].sort((a, b) => {
      const pa = state.schedules.find(s => s.timeSlot === a);
      const pb = state.schedules.find(s => s.timeSlot === b);
      const ra = getAulas(seg.id, a.split('|')[1] || 'manha').find(p => p.aulaIdx === Number(a.split('|')[2]));
      const rb = getAulas(seg.id, b.split('|')[1] || 'manha').find(p => p.aulaIdx === Number(b.split('|')[2]));
      return (ra?.inicio || '').localeCompare(rb?.inicio || '');
    });

    html += `
      <div style="margin-bottom:28px">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--t2);
          text-transform:uppercase;letter-spacing:.06em">${h(seg.name)}</h3>
        <div class="cal-wrap"><table class="ctbl">
          <thead><tr>
            <th style="text-align:left">Aula</th>
            ${DAYS.map(d => `<th>${d}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${usedSlots.map(slot => renderCalRow(slot, segSchedules)).join('')}
          </tbody>
        </table></div>
      </div>`;
  });

  el.innerHTML = html;
}

function renderCalRow(slot, schedules) {
  const period = (() => {
    const parsed = slot.split('|');
    if (parsed.length < 3) return null;
    const aulas = getAulas(parsed[0], parsed[1]);
    return aulas.find(p => p.aulaIdx === Number(parsed[2]));
  })();

  const timePart = period ? `<div class="sl-t">${h(period.inicio)}–${h(period.fim)}</div>` : '';
  const cells = DAYS.map(day => {
    const classes = schedules.filter(s => s.day === day && s.timeSlot === slot);
    const cards = classes.map(cls => {
      const t   = state.teachers.find(x => x.id === cls.teacherId);
      if (!t) return '';
      const cv  = colorOfTeacher(t);
      const sub = getSubstitute(t.id, day, slot);
      const subj = state.subjects.find(s => s.id === cls.subjectId);
      return `
        <button class="lc"
          style="background:${sub ? '#FFF1EE' : cv.bg};border-color:${sub ? '#FDB8A8' : cv.bd};color:${sub ? '#7F1A06' : cv.tx}"
          data-action="nav" data-page="teacher" data-tid="${t.id}">
          <div class="lc-name">${h(t.name)}</div>
          <div class="lc-disc">${h(subj?.name ?? '—')} · ${h(cls.turma)}</div>
          ${sub ? `<span class="lc-sub">↳ Sub: ${h(sub.name)}</span>` : ''}
        </button>`;
    }).join('');
    return `<td>${cards}</td>`;
  }).join('');

  return `<tr>
    <td class="sl">
      <div class="sl-n">${h(slotLabel(slot))}</div>
      ${timePart}
    </td>
    ${cells}
  </tr>`;
}

// ─── Calendário do Professor ──────────────────────────────────────────────────

export function renderTeacher() {
  const el = document.getElementById('teacher-out');
  if (!el) return;

  const teacher = state.teachers.find(t => t.id === state.focusTid);
  if (!teacher) { el.innerHTML = '<p>Professor não encontrado.</p>'; return; }

  const cv      = colorOfTeacher(teacher);
  const mine    = state.schedules.filter(s => s.teacherId === teacher.id);
  const faltas  = mine.filter(s => getSubstitute(teacher.id, s.day, s.timeSlot)).length;
  const subjLabel = teacherSubjectNames(teacher) || '—';

  // Slots do professor, agrupados por segmento
  const rows = state.segments.flatMap(seg => {
    const segSlots = [...new Set(
      mine.filter(s => findTurma(s.turma)?.segmentId === seg.id).map(s => s.timeSlot)
    )].sort((a, b) => {
      const pa = a.split('|'), pb = b.split('|');
      const ra = getAulas(pa[0], pa[1]).find(p => p.aulaIdx === Number(pa[2]));
      const rb = getAulas(pb[0], pb[1]).find(p => p.aulaIdx === Number(pb[2]));
      return (ra?.inicio || '').localeCompare(rb?.inicio || '');
    });
    if (segSlots.length === 0) return [];

    return [
      `<tr><td colspan="${DAYS.length + 1}" style="padding:12px 14px;background:var(--surf2);
        font-size:11px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em">
        ${h(seg.name)}
      </td></tr>`,
      ...segSlots.map(slot => {
        const period = (() => {
          const p = slot.split('|');
          return getAulas(p[0], p[1]).find(x => x.aulaIdx === Number(p[2]));
        })();
        const timePart = period ? `<div class="sl-t">${h(period.inicio)}–${h(period.fim)}</div>` : '';
        const cells = DAYS.map(day => {
          const cls = mine.find(s => s.day === day && s.timeSlot === slot);
          if (!cls) return '<td></td>';
          const sub  = getSubstitute(teacher.id, day, slot);
          const subj = state.subjects.find(s => s.id === cls.subjectId);
          const bg   = sub ? '#FFF1EE' : cv.bg;
          const bd   = sub ? '#FDB8A8' : cv.bd;
          const tx   = sub ? '#7F1A06' : cv.tx;
          const tip  = sub ? '⚠ Falta registrada · clique para alterar' : 'Clique para registrar falta';
          const subBox = sub ? `
            <div class="sub-box">
              <div class="sub-box-l">✓ Substituição</div>
              <div class="sub-box-n">${h(sub.name)}</div>
              <div class="sub-box-a">${h(teacherSubjectNames(sub) || sub.name)}</div>
              <button class="sub-rm" data-action="clearSub"
                data-tid="${teacher.id}" data-day="${h(day)}" data-slot="${h(slot)}">
                ✕ Remover substituição</button>
            </div>` : '';
          return `<td>
            <button class="tlc" style="background:${bg};border-color:${bd}"
              data-action="openModal"
              data-tid="${teacher.id}" data-day="${h(day)}" data-slot="${h(slot)}">
              <div class="tlc-sub" style="color:${tx}">${h(subj?.name ?? cls.turma)}</div>
              <div class="tlc-trm" style="color:${tx}">${h(cls.turma)}</div>
              <div class="tlc-tip" style="color:${tx}">${tip}</div>
            </button>
            ${subBox}
          </td>`;
        }).join('');
        return `<tr>
          <td class="sl">
            <div class="sl-n">${h(slotLabel(slot))}</div>
            ${timePart}
          </td>
          ${cells}
        </tr>`;
      }),
    ];
  });

  el.innerHTML = `
    <button class="btn btn-ghost btn-sm" style="margin-bottom:20px"
      data-action="nav" data-page="calendar">← Calendário Geral</button>

    <div class="th-hdr" style="background:${cv.bg};border-color:${cv.bd}">
      <div class="th-av" style="background:${cv.tg};color:${cv.tx}">${h(teacher.name.charAt(0))}</div>
      <div>
        <h2 style="color:${cv.tx};font-size:20px;letter-spacing:-.02em">${h(teacher.name)}</h2>
        <div style="font-size:12px;color:${cv.tx};opacity:.7;margin-top:3px">${h(subjLabel)}</div>
      </div>
      <div class="th-stat">
        <div class="th-stat-n" style="color:${cv.tx}">${mine.length}</div>
        <div class="th-stat-l" style="color:${cv.tx}">aula${mine.length !== 1 ? 's' : ''}/sem.</div>
      </div>
      ${faltas > 0 ? `
        <div class="th-stat" style="margin-left:16px">
          <div class="th-stat-n" style="color:#C8290A">${faltas}</div>
          <div class="th-stat-l" style="color:#C8290A">falta${faltas !== 1 ? 's' : ''}</div>
        </div>` : ''}
    </div>

    <p style="font-size:13.5px;color:var(--t2);margin-bottom:16px">
      Clique em uma aula para registrar falta e selecionar substituto.
    </p>

    <div class="cal-wrap"><table class="ctbl">
      <thead><tr><th>Aula</th>${DAYS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table></div>`;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function renderSettings() {
  const el = document.getElementById('settings-out');
  if (!el) return;
  switch (state.stab) {
    case 'segments':  el.innerHTML = tabSegments();  break;
    case 'periods':   el.innerHTML = tabPeriods();   break;
    case 'disciplines': el.innerHTML = tabDisciplines(); break;
    case 'teachers':  el.innerHTML = tabTeachers();  break;
    case 'schedules': el.innerHTML = tabSchedules(); break;
  }
}

// ── Tab: Segmentos ────────────────────────────────────────────────────────────

function tabSegments() {
  const segCards = state.segments.map(seg => {
    const totalTurmas = seg.grades.reduce((acc, g) => acc + g.classes.length, 0);
    const segTurno    = seg.turno ?? 'manha';

    const gradeRows = seg.grades.map(grade => {
      const classPills = grade.classes.map(cls => `
        <div class="class-pill-wrap">
          <span class="tag-pill">
            ${h(grade.name)} ${h(cls.letter)}
            <button class="tag-rm" data-action="removeClassFromGrade"
              data-seg="${seg.id}" data-grade="${h(grade.name)}" data-val="${h(cls.letter)}">×</button>
          </span>
        </div>`).join('');

      return `
        <div class="grade-row">
          <div class="grade-row-hdr">
            <span class="grade-name">${h(grade.name)}</span>
            <div class="grade-row-actions">
              <input class="inp grade-class-inp"
                id="cls-inp-${seg.id}-${h(grade.name).replace(/\W/g,'_')}"
                placeholder="Letra (A, B…)" maxlength="3">
              <button class="btn btn-dark btn-xs" data-action="addClassToGrade"
                data-seg="${seg.id}" data-grade="${h(grade.name)}">+</button>
              <button class="btn-del" data-action="removeGrade"
                data-seg="${seg.id}" data-val="${h(grade.name)}">✕</button>
            </div>
          </div>
          <div class="grade-classes">
            ${classPills || '<span class="no-classes">Nenhuma turma. Adicione as letras →</span>'}
          </div>
        </div>`;
    }).join('');

    return `
      <div class="card card-b seg-card">
        <div class="seg-card-hdr">
          <div>
            <h3 class="seg-title">${h(seg.name)}</h3>
            <div class="seg-meta">${seg.grades.length} série${seg.grades.length !== 1 ? 's' : ''} · ${totalTurmas} turma${totalTurmas !== 1 ? 's' : ''}</div>
          </div>
          <button class="btn-del" data-action="removeSegment" data-id="${seg.id}">✕</button>
        </div>
        <div class="add-grade-row">
          <div class="lbl" style="margin-bottom:8px">Adicionar série / ano</div>
          <div style="display:flex;gap:8px">
            <input class="inp" id="grade-inp-${seg.id}" placeholder="Ex: 5º Ano, 4ª Série…" style="flex:1">
            <button class="btn btn-dark" data-action="addGrade" data-seg="${seg.id}">Adicionar</button>
          </div>
        </div>
        <div class="grade-list">${gradeRows || '<p class="no-grades">Nenhuma série cadastrada.</p>'}</div>
        ${totalTurmas > 0 ? `
          <div class="turmas-preview">
            <div class="lbl" style="margin-bottom:6px">Turmas cadastradas (${totalTurmas})</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${seg.grades.flatMap(g => g.classes.map(c =>
                `<span class="turma-chip">${h(g.name)} ${h(c.letter)}</span>`
              )).join('')}
            </div>
          </div>` : ''}
      </div>`;
  }).join('');

  return `
    <div>
      <div class="card card-b" style="background:var(--surf2);margin-bottom:20px">
        <h3 style="margin-bottom:12px;font-size:14px">Novo Segmento</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="inp" id="new-seg-name" placeholder="Ex: Educação Infantil" style="flex:1">
          <button class="btn btn-dark" data-action="addSegment">Adicionar</button>
        </div>
      </div>
      <div class="seg-cards-grid">${segCards}</div>
    </div>`;
}


function tabPeriods() {
  if (state.segments.length === 0) {
    return `<div class="card card-b" style="max-width:520px;text-align:center;padding:40px">
      <p style="color:var(--t2);margin-bottom:16px">Cadastre segmentos antes de configurar os períodos.</p>
      <button class="btn btn-dark" data-action="stab" data-tab="segments">Cadastrar Segmentos</button>
    </div>`;
  }

  const segBlocks = state.segments.map(seg => {
    const turno      = seg.turno ?? 'manha';
    const turnoLabel = turno === 'tarde' ? '🌇 Tarde' : '🌅 Manhã';
    const cfg        = getCfg(seg.id, turno);
    const periodos   = gerarPeriodos(cfg);

    const ivRows = (cfg.intervalos || []).map((iv, ii) => `
      <div class="iv-row">
        <span class="iv-lbl">após aula nº</span>
        <input class="inp iv-inp" type="number" min="1" max="${cfg.qtd}" value="${iv.apos}"
          data-action="editIvApos" data-seg="${seg.id}" data-turno="${turno}" data-idx="${ii}">
        <span class="iv-lbl">início (opcional)</span>
        <input class="inp iv-inp" type="time" value="${iv.inicio || ''}"
          data-action="editIvInicio" data-seg="${seg.id}" data-turno="${turno}" data-idx="${ii}">
        <span class="iv-lbl">duração (min)</span>
        <input class="inp iv-inp" type="number" min="1" max="120" value="${iv.duracao || 20}"
          data-action="editIvDuracao" data-seg="${seg.id}" data-turno="${turno}" data-idx="${ii}">
        <button class="btn-del" data-action="removeIntervalo"
          data-seg="${seg.id}" data-turno="${turno}" data-idx="${ii}">✕</button>
      </div>`).join('');

    const preview = periodos.map(p => p.isIntervalo
      ? `<div class="per-preview-iv">☕ Intervalo ${h(p.inicio)}–${h(p.fim)} (${p.duracao}min)</div>`
      : `<div class="per-preview-item"><strong>${h(p.label)}</strong> ${h(p.inicio)}–${h(p.fim)}</div>`
    ).join('');

    return `
      <div class="card card-b">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;flex-wrap:wrap">
          <h3>${h(seg.name)}</h3>
          <div class="fld" style="margin:0;flex-direction:row;align-items:center;gap:8px">
            <label class="lbl" style="margin:0;white-space:nowrap;font-size:12px">Turno:</label>
            <select class="inp" style="width:120px;padding:5px 8px;font-size:13px"
              data-action="setSegmentTurno" data-seg="${seg.id}">
              <option value="manha" ${turno === 'manha' ? 'selected' : ''}>🌅 Manhã</option>
              <option value="tarde" ${turno === 'tarde' ? 'selected' : ''}>🌇 Tarde</option>
            </select>
          </div>
        </div>
        <div class="periodo-cfg-grid">
          <div class="fld">
            <label class="lbl">Horário de início</label>
            <input class="inp" type="time" value="${cfg.inicio}"
              data-action="editPeriodoCfg" data-seg="${seg.id}" data-turno="${turno}" data-campo="inicio">
          </div>
          <div class="fld">
            <label class="lbl">Duração por aula (min)</label>
            <input class="inp" type="number" min="30" max="120" value="${cfg.duracao}"
              data-action="editPeriodoCfg" data-seg="${seg.id}" data-turno="${turno}" data-campo="duracao">
          </div>
          <div class="fld">
            <label class="lbl">Número de aulas</label>
            <input class="inp" type="number" min="1" max="12" value="${cfg.qtd}"
              data-action="editPeriodoCfg" data-seg="${seg.id}" data-turno="${turno}" data-campo="qtd">
          </div>
        </div>
        <div style="margin:14px 0 8px">
          <div style="font-size:12px;font-weight:700;color:var(--t2);margin-bottom:8px">Intervalos</div>
          <div id="ivs-${seg.id}-${turno}">
            ${ivRows || '<p style="font-size:13px;color:var(--t3);margin:0">Nenhum intervalo.</p>'}
          </div>
          <button class="btn btn-ghost btn-xs" style="margin-top:6px"
            data-action="addIntervalo" data-seg="${seg.id}" data-turno="${turno}">+ Intervalo</button>
        </div>
        <div class="per-preview" id="preview-${seg.id}-${turno}">${preview}</div>
      </div>`;
  }).join('');

  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px">${segBlocks}</div>`;
}


// ── Tab: Disciplinas (Áreas + Matérias unificadas) ────────────────────────────

function tabDisciplines() {
  const blocks = state.areas.map(area => {
    const cv   = COLOR_PALETTE[area.colorIdx % COLOR_PALETTE.length];
    const subs = state.subjects.filter(s => s.areaId === area.id);
    const txt  = subs.map(s => s.name).join('\n');
    return `
      <div class="disc-block" id="disc-block-${area.id}"
        style="border-left:4px solid ${cv.dt}">
        <div class="disc-block-hdr">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <span class="ti-dot" style="background:${cv.dt};flex-shrink:0"></span>
            <input class="disc-area-name" id="disc-name-${area.id}"
              value="${h(area.name)}"
              style="font-weight:700;font-size:15px;border:none;background:none;
                     color:var(--t1);outline:none;width:100%;font-family:'Figtree',sans-serif"
              data-disc-action="renameArea" data-id="${area.id}">
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            <span style="font-size:12px;color:var(--t3)">${subs.length} disciplina${subs.length !== 1 ? 's' : ''}</span>
            <button class="btn btn-dark btn-xs"
              data-disc-action="saveArea" data-id="${area.id}">
              Salvar
            </button>
            <button class="btn-del"
              data-disc-action="removeArea" data-id="${area.id}">✕</button>
          </div>
        </div>
        <div class="disc-block-body">
          <label class="lbl" style="margin-bottom:6px;display:block">
            Disciplinas — uma por linha
          </label>
          <textarea class="inp disc-textarea" id="disc-txt-${area.id}"
            rows="4" placeholder="Ex:\nGeografia\nHistória\nSociologia"
            style="font-family:'DM Mono',monospace;font-size:13px;resize:vertical"
            >${h(txt)}</textarea>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="tab-full-width">
      <!-- Nova área -->
      <div class="card card-b" style="margin-bottom:20px">
        <h3 style="margin-bottom:10px;font-size:14px">Nova área do conhecimento</h3>
        <div style="display:flex;gap:8px">
          <input class="inp" id="new-area-name" placeholder="Ex: Ciências Humanas" style="flex:1"
            data-enter="addAreaDisc">
          <button class="btn btn-dark" data-disc-action="addArea">Adicionar</button>
        </div>
      </div>

      <!-- Blocos de áreas -->
      <div id="disc-list" class="disc-list-grid disc-list-full">
        ${blocks || '<div class="empty"><div class="empty-ico">📚</div><div class="empty-ttl">Nenhuma área cadastrada</div><div class="empty-dsc">Adicione uma área acima para começar.</div></div>'}
      </div>
    </div>`;
}

// ── Tab: Professores ──────────────────────────────────────────────────────────

function tabTeachers() {
  const list = state.teachers.length === 0
    ? `<p style="color:var(--t3);font-size:13px;padding:12px 0">Nenhum professor cadastrado.</p>`
    : state.teachers.map(t => {
        const cv   = colorOfTeacher(t);
        const ct   = state.schedules.filter(s => s.teacherId === t.id).length;
        const subs = teacherSubjectNames(t);
        return `
          <div class="ti" style="flex-wrap:wrap;gap:8px">
            <span class="ti-dot" style="background:${cv.dt}"></span>
            <div style="flex:1;min-width:140px">
              <div class="ti-name">${h(t.name)}</div>
              ${subs ? `<div style="font-size:12px;color:var(--t2);font-weight:600;margin-top:2px">${h(subs)}</div>` : ''}
              <div style="display:flex;gap:10px;margin-top:4px;flex-wrap:wrap">
                ${t.celular  ? `<span class="contact-chip">📱 ${h(t.celular)}</span>`  : ''}
                ${t.email    ? `<span class="contact-chip">✉ ${h(t.email)}</span>`    : ''}
              </div>
            </div>
            <span class="ti-cnt">${ct} aula${ct !== 1 ? 's' : ''}</span>
            <button class="btn btn-ghost btn-xs" data-action="openTeacherSchedule" data-id="${t.id}" title="Editar horário">📅</button>
            <button class="btn btn-ghost btn-xs" data-action="editTeacherSubjects" data-id="${t.id}">📚 Matérias</button>
            <button class="btn btn-ghost btn-xs" data-action="editTeacher" data-id="${t.id}">✏️</button>
            <button class="btn-del" data-action="removeTeacher" data-id="${t.id}">✕</button>
          </div>`;
      }).join('');

  // Group teachers by segment
  const teachersBySegment = state.segments.map(seg => {
    const segTurmas = new Set(seg.grades.flatMap(g => g.classes.map(c => `${g.name} ${c.letter}`)));
    const segTeachers = state.teachers.filter(t =>
      state.schedules.some(s => s.teacherId === t.id && segTurmas.has(s.turma))
    ).sort((a, b) => a.name.localeCompare(b.name));
    return { seg, teachers: segTeachers };
  });

  const teacherCols = teachersBySegment.map(({ seg, teachers: segTs }) => {
    const segList = segTs.length === 0
      ? `<p style="color:var(--t3);font-size:13px;padding:12px 0">Nenhum professor com aulas neste nível.</p>`
      : segTs.map(t => {
          const cv   = colorOfTeacher(t);
          const ct   = state.schedules.filter(s => s.teacherId === t.id).length;
          const subs = teacherSubjectNames(t);
          return `
            <div class="ti" style="flex-wrap:wrap;gap:8px">
              <span class="ti-dot" style="background:${cv.dt}"></span>
              <div style="flex:1;min-width:100px">
                <div class="ti-name">${h(t.name)}</div>
                ${subs ? `<div style="font-size:12px;color:var(--t2);font-weight:600;margin-top:2px">${h(subs)}</div>` : ''}
                <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
                  ${t.celular ? `<span class="contact-chip">📱 ${h(t.celular)}</span>` : ''}
                  ${t.email   ? `<span class="contact-chip">✉ ${h(t.email)}</span>`   : ''}
                </div>
              </div>
              <span class="ti-cnt">${ct} aula${ct !== 1 ? 's' : ''}</span>
              <button class="btn btn-ghost btn-xs" data-action="openTeacherSchedule" data-id="${t.id}" title="Editar horário">📅</button>
              <button class="btn btn-ghost btn-xs" data-action="editTeacherSubjects" data-id="${t.id}">📚</button>
              <button class="btn btn-ghost btn-xs" data-action="editTeacher" data-id="${t.id}">✏️</button>
              <button class="btn-del" data-action="removeTeacher" data-id="${t.id}">✕</button>
            </div>`;
        }).join('');

    return `
      <div class="card card-b">
        <div style="font-weight:700;font-size:14px;margin-bottom:14px;
          padding-bottom:10px;border-bottom:1px solid var(--bdr)">
          ${h(seg.name)}
          <span style="font-size:12px;font-weight:400;color:var(--t3);margin-left:8px">
            ${segTs.length} professor${segTs.length !== 1 ? 'es' : ''}
          </span>
        </div>
        <div style="max-height:420px;overflow-y:auto">${segList}</div>
      </div>`;
  }).join('');

  // Teachers without any schedule
  const withSched = new Set(state.schedules.map(s => s.teacherId));
  const unassigned = state.teachers.filter(t => !withSched.has(t.id))
    .sort((a,b) => a.name.localeCompare(b.name));
  const unassignedBlock = unassigned.length > 0 ? `
    <div class="card card-b" style="margin-top:20px">
      <div style="font-weight:700;font-size:14px;margin-bottom:12px;color:var(--t2)">
        Sem horários cadastrados (${unassigned.length})
      </div>
      ${unassigned.map(t => {
        const cv   = colorOfTeacher(t);
        const subs = teacherSubjectNames(t);
        return `
          <div class="ti" style="flex-wrap:wrap;gap:8px">
            <span class="ti-dot" style="background:${cv.dt}"></span>
            <div style="flex:1;min-width:100px">
              <div class="ti-name">${h(t.name)}</div>
              ${subs ? `<div style="font-size:12px;color:var(--t2);font-weight:600;margin-top:2px">${h(subs)}</div>` : ''}
              <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
                ${t.celular ? `<span class="contact-chip">📱 ${h(t.celular)}</span>` : ''}
                ${t.email   ? `<span class="contact-chip">✉ ${h(t.email)}</span>`   : ''}
              </div>
            </div>
            <button class="btn btn-ghost btn-xs" data-action="openTeacherSchedule" data-id="${t.id}" title="Editar horário">📅</button>
            <button class="btn btn-ghost btn-xs" data-action="editTeacherSubjects" data-id="${t.id}">📚</button>
            <button class="btn btn-ghost btn-xs" data-action="editTeacher" data-id="${t.id}">✏️</button>
            <button class="btn-del" data-action="removeTeacher" data-id="${t.id}">✕</button>
          </div>`;
      }).join('')}
    </div>` : '';

  return `
    <div class="tab-full-width">
      <!-- Botões de cadastro -->
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button class="btn btn-dark" data-action="openAddTeacher">+ Adicionar Professor</button>
        <button class="btn btn-ghost" data-action="openAddTeachersBulk">Adicionar em Bloco</button>
      </div>
      <!-- Dois blocos por segmento -->
      <div class="seg-cards-grid">${teacherCols}</div>
      ${unassignedBlock}
    </div>`;
}

// ── Tab: Horários ─────────────────────────────────────────────────────────────

// ── Tab: Horários ─────────────────────────────────────────────────────────────

export const schedUI = { teacherId: null };

function tabSchedules() {
  if (state.segments.length === 0)
    return emptyTabGuard('Cadastre segmentos primeiro.', 'segments', '🏫 Segmentos');
  if (state.teachers.length === 0)
    return emptyTabGuard('Cadastre professores antes de adicionar horários.', 'teachers', '👩‍🏫 Professores');

  // ── Dois frames: EF e EM, cada um com seus professores como botões ──────
  const frames = state.segments.map(seg => {
    const segTurmas = new Set(
      seg.grades.flatMap(g => g.classes.map(c => `${g.name} ${c.letter}`))
    );
    // Mostra TODOS os professores — incluindo os sem horário cadastrado ainda
    const profsSeg = state.teachers.slice().sort((a, b) => a.name.localeCompare(b.name));

    const profBtns = profsSeg.map(t => {
      const cv    = colorOfTeacher(t);
      const isSel = t.id === schedUI.teacherId;
      const ct    = state.schedules.filter(s => s.teacherId === t.id &&
        [...segTurmas].some(tr => state.schedules.find(x => x.id === s.id && x.turma === tr)) ||
        state.schedules.filter(s => s.teacherId === t.id && segTurmas.has(s.turma)).length
      );
      const nAulas = state.schedules.filter(s => s.teacherId === t.id && segTurmas.has(s.turma)).length;
      return `
        <button class="sched-prof-btn ${isSel ? 'on' : ''}"
          data-action="schedSelectTeacher" data-tid="${t.id}"
          style="${isSel
            ? `background:${cv.tg};border-color:${cv.bd};color:${cv.tx}`
            : ''}">
          <span class="sched-prof-dot" style="background:${cv.dt}"></span>
          <span class="sched-prof-name">${h(t.name)}</span>
          <span class="sched-prof-ct">${nAulas}</span>
        </button>`;
    }).join('');

    return `
      <div class="sched-seg-frame">
        <div class="sched-seg-hdr">
          <span style="font-weight:700;font-size:14px">${h(seg.name)}</span>
          <span style="font-size:11px;color:var(--t3)">${profsSeg.length} professor${profsSeg.length !== 1 ? 'es' : ''}</span>
        </div>
        <div class="sched-prof-list">
          ${profBtns || '<p style="font-size:12px;color:var(--t3);padding:8px 0">Nenhum professor com aulas neste nível.</p>'}
        </div>
      </div>`;
  }).join('');

  // ── Grade(s) do professor selecionado ────────────────────────────────────
  let grids = '';
  if (schedUI.teacherId) {
    const teacher = state.teachers.find(t => t.id === schedUI.teacherId);
    const cv      = colorOfTeacher(teacher);
    const total   = state.schedules.filter(s => s.teacherId === schedUI.teacherId).length;

    // Quais segmentos este professor tem aulas
    const teacherSegs = state.segments.filter(seg => {
      const segTurmas = new Set(seg.grades.flatMap(g => g.classes.map(c => `${g.name} ${c.letter}`)));
      return state.schedules.some(s => s.teacherId === schedUI.teacherId && segTurmas.has(s.turma));
    });

    const gridBlocks = state.segments.map(seg => {
      const segTurmas = new Set(seg.grades.flatMap(g => g.classes.map(c => `${g.name} ${c.letter}`)));
      // Mostra grade para todos os segmentos (professor pode adicionar aulas em qualquer nível)
      const grid = buildScheduleGrid(seg, schedUI.teacherId);
      const hasAulas = state.schedules.some(s => s.teacherId === schedUI.teacherId && segTurmas.has(s.turma));
      return `
        <div style="margin-bottom:28px">
          <div style="font-size:12px;font-weight:700;color:var(--t2);
            text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
            ${h(seg.name)}
            ${hasAulas ? `<span style="font-weight:400;color:var(--t3);text-transform:none;
              letter-spacing:0;margin-left:8px">
              ${state.schedules.filter(s => s.teacherId === schedUI.teacherId && segTurmas.has(s.turma)).length} aulas
            </span>` : ''}
          </div>
          ${grid}
        </div>`;
    }).join('');

    grids = `
      <div style="margin-top:20px;padding-top:20px;border-top:1.5px solid var(--bdr)">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap">
          <div class="th-av" style="background:${cv.tg};color:${cv.tx};
            width:40px;height:40px;font-size:18px;font-weight:800;flex-shrink:0">
            ${h(teacher.name.charAt(0))}
          </div>
          <div>
            <div style="font-weight:700;font-size:16px">${h(teacher.name)}</div>
            <div style="font-size:12px;color:var(--t2)">
              ${h(teacherSubjectNames(teacher) || '—')} ·
              <strong>${total}</strong> aula${total !== 1 ? 's' : ''} cadastrada${total !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        ${gridBlocks}
      </div>`;
  }

  return `
    <!-- Dois frames lado a lado: EF e EM -->
    <div class="sched-frames">${frames}</div>
    ${grids}`;
}

function tabAdmin() {
  return `
    <div class="tab-full-width">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px">
        <div class="card card-b">
          <h3 style="margin-bottom:8px">👩‍🏫 Aprovar Professores</h3>
          <p style="font-size:13px;color:var(--t2);margin-bottom:16px">
            Professores que solicitaram acesso ao sistema aguardando aprovação.
          </p>
          <button class="btn btn-dark" id="settings-btn-pending">
            Gerenciar solicitações
            <span id="settings-pending-badge" style="display:none;margin-left:6px;
              background:#EF4444;color:#fff;border-radius:10px;padding:1px 7px;font-size:11px">
            </span>
          </button>
        </div>
        <div class="card card-b">
          <h3 style="margin-bottom:8px">⚙️ Gerenciar Administradores</h3>
          <p style="font-size:13px;color:var(--t2);margin-bottom:16px">
            Adicione ou remova administradores do sistema.
          </p>
          <button class="btn btn-dark" id="settings-btn-admins">
            Gerenciar administradores
          </button>
        </div>
      </div>
    </div>`;
}

function emptyTabGuard(msg, tab, label) {
  return `<div class="card card-b" style="text-align:center;padding:40px;max-width:500px">
    <p style="color:var(--t2);margin-bottom:16px">${msg}</p>
    <button class="btn btn-dark" data-action="stab" data-tab="${tab}">${label}</button>
  </div>`;
}

function buildScheduleGrid(seg, teacherId) {
  if (!seg) return '';

  const segTurno = seg.turno ?? 'manha';
  const periodos = getPeriodos(seg.id, segTurno)
    .map(p => ({ ...p, turno: segTurno, slot: `${seg.id}|${segTurno}|${p.aulaIdx}` }));

  if (periodos.filter(p => !p.isIntervalo).length === 0) {
    return `<div class="card card-b" style="padding:20px;color:var(--t2);text-align:center;font-size:13px">
      Configure os períodos deste segmento em ⏰ Períodos.
    </div>`;
  }

  const headers = DAYS.map(d =>
    `<th style="text-align:center;min-width:130px;padding:8px 6px">${d}</th>`
  ).join('');

  const rows = periodos.map(periodo => {
    if (periodo.isIntervalo) return `
      <tr>
        <td style="padding:4px 10px;background:var(--accent-l);border-bottom:1px solid #F6C9A8">
          <div style="font-size:10px;font-weight:700;color:var(--accent)">☕ Intervalo</div>
          <div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">
            ${h(periodo.inicio)}–${h(periodo.fim)}</div>
        </td>
        ${DAYS.map(() => `<td style="background:var(--accent-l)"></td>`).join('')}
      </tr>`;

    const cells = DAYS.map(day => renderSchedCell(seg.id, periodo, teacherId, day)).join('');
    return `
      <tr>
        <td class="sl">
          <div class="sl-n">${h(periodo.label)}</div>
          <div class="sl-t">${h(periodo.inicio)}–${h(periodo.fim)}</div>
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

export function renderSchedCell(segId, periodo, teacherId, day) {
  const slot   = periodo.slot ?? `${segId}|${periodo.turno}|${periodo.aulaIdx}`;
  const minhas = state.schedules.filter(
    s => s.teacherId === teacherId && s.timeSlot === slot && s.day === day
  );

  const cards = minhas.map(s => {
    const subj = state.subjects.find(x => x.id === s.subjectId);
    return `
      <div class="sched-cell-card sched-mine">
        <div class="sched-card-name" style="color:var(--t1)">${h(s.turma)}</div>
        <div class="sched-card-info" style="color:var(--t1)">${h(subj?.name ?? '—')}</div>
        <button class="sched-card-edit"
          data-action="editSchedule"
          data-id="${s.id}"
          title="Editar aula">✏</button>
        <button class="sched-card-del"
          data-action="removeScheduleImmediate"
          data-id="${s.id}" data-seg="${segId}"
          data-aula="${periodo.aulaIdx}" data-turno="${periodo.turno}"
          data-day="${h(day)}" data-teacher="${teacherId}"
          title="Remover aula">✕</button>
      </div>`;
  }).join('');

  return `
    <td class="sched-cell"
      id="sched-cell-${segId}-${periodo.turno}-${periodo.aulaIdx}-${day.replace(/[^a-z]/gi,'')}"
      data-action="openScheduleModal"
      data-seg="${segId}" data-turno="${periodo.turno}"
      data-aula="${periodo.aulaIdx}" data-day="${h(day)}"
      data-teacher="${teacherId}">
      ${cards}
      <div class="sched-add-hint">＋ adicionar</div>
    </td>`;
}

