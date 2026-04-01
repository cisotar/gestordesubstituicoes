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
    case 'areas':     el.innerHTML = tabAreas();     break;
    case 'subjects':  el.innerHTML = tabSubjects();  break;
    case 'teachers':  el.innerHTML = tabTeachers();  break;
    case 'schedules': el.innerHTML = tabSchedules(); break;
  }
}

// ── Tab: Segmentos ────────────────────────────────────────────────────────────

function tabSegments() {
  const segCards = state.segments.map(seg => {
    const totalTurmas = seg.grades.reduce((acc, g) => acc + g.classes.length, 0);

    const gradeRows = seg.grades.map(grade => {
      const classPills = grade.classes.map(cls => `
        <div class="class-pill-wrap">
          <span class="tag-pill">
            ${h(grade.name)} ${h(cls.letter)}
            <select class="turno-sel" data-action="setClassTurno"
              data-seg="${seg.id}" data-grade="${h(grade.name)}" data-letter="${h(cls.letter)}">
              <option value="manha" ${cls.turno === 'manha' ? 'selected' : ''}>🌅 Manhã</option>
              <option value="tarde" ${cls.turno === 'tarde' ? 'selected' : ''}>🌇 Tarde</option>
            </select>
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
              <select class="inp" style="width:90px;padding:5px 6px;font-size:12px"
                id="cls-turno-${seg.id}-${h(grade.name).replace(/\W/g,'_')}">
                <option value="manha">🌅 Manhã</option>
                <option value="tarde">🌇 Tarde</option>
              </select>
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
        <div class="grade-list">${gradeRows || '<p class="no-grades">Nenhuma série. Adicione abaixo.</p>'}</div>
        <div class="add-grade-row">
          <div class="lbl" style="margin-bottom:6px">Adicionar série / ano</div>
          <div style="display:flex;gap:8px">
            <input class="inp" id="grade-inp-${seg.id}" placeholder="Ex: 5º Ano, 4ª Série…" style="flex:1">
            <button class="btn btn-dark" data-action="addGrade" data-seg="${seg.id}">Adicionar</button>
          </div>
        </div>
        ${totalTurmas > 0 ? `
          <div class="turmas-preview">
            <div class="lbl" style="margin-bottom:6px">Turmas cadastradas (${totalTurmas})</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px">
              ${seg.grades.flatMap(g => g.classes.map(c =>
                `<span class="turma-chip" title="${c.turno === 'tarde' ? 'Tarde' : 'Manhã'}">
                  ${h(g.name)} ${h(c.letter)} ${c.turno === 'tarde' ? '🌇' : '🌅'}
                </span>`
              )).join('')}
            </div>
          </div>` : ''}
      </div>`;
  }).join('');

  return `
    <div style="max-width:780px">
      ${segCards}
      <div class="card card-b" style="background:var(--surf2)">
        <h3 style="margin-bottom:12px;font-size:14px">Novo Segmento</h3>
        <div style="display:flex;gap:8px">
          <input class="inp" id="new-seg-name" placeholder="Ex: Educação Infantil" style="flex:1">
          <button class="btn btn-dark" data-action="addSegment">Adicionar</button>
        </div>
      </div>
    </div>`;
}

// ── Tab: Períodos ─────────────────────────────────────────────────────────────

function tabPeriods() {
  if (state.segments.length === 0) {
    return `<div class="card card-b" style="max-width:520px;text-align:center;padding:40px">
      <p style="color:var(--t2);margin-bottom:16px">Cadastre segmentos antes de configurar os períodos.</p>
      <button class="btn btn-dark" data-action="stab" data-tab="segments">Cadastrar Segmentos</button>
    </div>`;
  }

  const turnos = [
    { id: 'manha', label: '🌅 Manhã' },
    { id: 'tarde', label: '🌇 Tarde' },
  ];

  const segBlocks = state.segments.map(seg => {
    const turnoBlocks = turnos.map(({ id: turno, label: turnoLabel }) => {
      const cfg      = getCfg(seg.id, turno);
      const periodos = gerarPeriodos(cfg);
      const ivRows   = (cfg.intervalos || []).map((iv, ii) => `
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
        <div class="periodo-turno-block">
          <div class="periodo-turno-hdr">${turnoLabel}</div>
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

    return `
      <div class="card card-b" style="margin-bottom:20px">
        <h3 style="margin-bottom:18px">${h(seg.name)}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          ${turnoBlocks}
        </div>
      </div>`;
  }).join('');

  return `<div style="max-width:900px">${segBlocks}</div>`;
}

// ── Tab: Áreas ────────────────────────────────────────────────────────────────

function tabAreas() {
  const list = state.areas.map(area => {
    const cv  = COLOR_PALETTE[area.colorIdx % COLOR_PALETTE.length];
    const ct  = state.subjects.filter(s => s.areaId === area.id).length;
    return `
      <div class="ti">
        <span class="ti-dot" style="background:${cv.dt}"></span>
        <span class="ti-name">${h(area.name)}</span>
        <span class="ti-area" style="background:${cv.tg};color:${cv.tx}">${ct} matéria${ct !== 1 ? 's' : ''}</span>
        <button class="btn-del" data-action="removeArea" data-id="${area.id}">✕</button>
      </div>`;
  }).join('') || '<p style="color:var(--t3);font-size:13px;padding:12px 0">Nenhuma área cadastrada.</p>';

  return `
    <div style="max-width:580px">
      <div class="card card-b" style="margin-bottom:16px">
        <h3 style="margin-bottom:6px">Cadastrar Áreas em Bloco</h3>
        <p style="font-size:13px;color:var(--t2);margin-bottom:12px">Uma área por linha.</p>
        <textarea class="inp" id="areas-bulk" rows="5"
          placeholder="Linguagens e Códigos&#10;Matemática&#10;Ciências da Natureza"
          style="resize:vertical;font-family:'DM Mono',monospace;font-size:13px"></textarea>
        <div style="margin-top:10px;display:flex;justify-content:flex-end">
          <button class="btn btn-dark" data-action="addAreasBulk">Adicionar todas</button>
        </div>
      </div>
      <div class="card card-b">
        <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px">
          ${state.areas.length} área${state.areas.length !== 1 ? 's' : ''}
        </div>
        <div style="max-height:380px;overflow-y:auto">${list}</div>
      </div>
    </div>`;
}

// ── Tab: Matérias ─────────────────────────────────────────────────────────────

function tabSubjects() {
  if (state.areas.length === 0) {
    return `<div class="card card-b" style="text-align:center;padding:40px;max-width:480px">
      <p style="color:var(--t2);margin-bottom:16px">Cadastre áreas antes de adicionar matérias.</p>
      <button class="btn btn-dark" data-action="stab" data-tab="areas">Cadastrar Áreas</button>
    </div>`;
  }

  const areaOpts = state.areas.map(a =>
    `<option value="${a.id}">${h(a.name)}</option>`).join('');

  const grouped = state.areas.map(area => {
    const subs = state.subjects.filter(s => s.areaId === area.id);
    const cv   = COLOR_PALETTE[area.colorIdx % COLOR_PALETTE.length];
    if (!subs.length) return '';
    return `
      <tr>
        <td colspan="2" style="padding:8px 12px;background:${cv.tg}">
          <span style="font-size:11px;font-weight:700;color:${cv.tx};text-transform:uppercase;letter-spacing:.05em">${h(area.name)}</span>
        </td>
      </tr>
      ${subs.map(s => `
        <tr>
          <td style="padding:9px 12px 9px 20px;font-size:13.5px">${h(s.name)}</td>
          <td style="padding:9px 12px;text-align:right">
            <button class="btn-del" data-action="removeSubject" data-id="${s.id}">✕</button>
          </td>
        </tr>`).join('')}`;
  }).join('');

  return `
    <div style="max-width:580px">
      <div class="card card-b">
        <h3 style="margin-bottom:6px">Cadastrar Matérias em Bloco</h3>
        <p style="font-size:13px;color:var(--t2);margin-bottom:12px">Selecione a área e liste as matérias, uma por linha.</p>
        <div class="fld" style="margin-bottom:12px">
          <label class="lbl">Área</label>
          <select class="inp" id="subj-area">${areaOpts}</select>
        </div>
        <textarea class="inp" id="subjs-bulk" rows="5"
          placeholder="Língua Portuguesa&#10;Literatura&#10;Redação"
          style="resize:vertical;font-family:'DM Mono',monospace;font-size:13px"></textarea>
        <div style="margin-top:10px;display:flex;justify-content:flex-end">
          <button class="btn btn-dark" data-action="addSubjectsBulk">Adicionar todas</button>
        </div>
      </div>
      ${state.subjects.length > 0 ? `
        <div class="card" style="margin-top:16px;overflow:hidden">
          <table class="dtbl"><tbody>${grouped}</tbody></table>
        </div>` : ''}
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
              ${subs ? `<div style="font-size:11px;color:var(--t3);margin-top:2px">${h(subs)}</div>` : ''}
            </div>
            <span class="ti-cnt">${ct} aula${ct !== 1 ? 's' : ''}</span>
            <button class="btn btn-ghost btn-xs" data-action="editTeacherSubjects" data-id="${t.id}">📚 Matérias</button>
            <button class="btn btn-ghost btn-xs" data-action="editTeacher" data-id="${t.id}">✏️</button>
            <button class="btn-del" data-action="removeTeacher" data-id="${t.id}">✕</button>
          </div>`;
      }).join('');

  return `
    <div style="max-width:640px">
      <div class="card card-b" style="margin-bottom:16px">
        <h3 style="margin-bottom:6px">Cadastrar em Bloco</h3>
        <p style="font-size:13px;color:var(--t2);margin-bottom:12px">
          Um nome por linha. Depois use <strong>📚 Matérias</strong> para associar disciplinas.
        </p>
        <textarea class="inp" id="teachers-bulk" rows="5"
          placeholder="Maria Silva&#10;João Pereira&#10;Ana Rodrigues"
          style="resize:vertical;font-family:'DM Mono',monospace;font-size:13px"></textarea>
        <div style="margin-top:10px;display:flex;justify-content:flex-end">
          <button class="btn btn-dark" data-action="addTeachersBulk">Adicionar todos</button>
        </div>
      </div>
      <div class="card card-b">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">
            ${state.teachers.length} professor${state.teachers.length !== 1 ? 'es' : ''}
          </div>
          <div style="display:flex;gap:6px">
            <input class="inp" id="t-name" placeholder="Adicionar individualmente"
              style="width:220px" data-enter="addTeacher">
            <button class="btn btn-dark btn-sm" data-action="addTeacher">+</button>
          </div>
        </div>
        <div style="max-height:440px;overflow-y:auto">${list}</div>
      </div>
    </div>`;
}

// ── Tab: Horários ─────────────────────────────────────────────────────────────

// UI state for the schedules tab (module-level, reset on stab change)
export const schedUI = { teacherId: null, segmentId: null };

function tabSchedules() {
  if (state.segments.length === 0)
    return emptyTabGuard('Cadastre segmentos primeiro.', 'segments', '🏫 Segmentos');
  if (state.teachers.length === 0)
    return emptyTabGuard('Cadastre professores antes de adicionar horários.', 'teachers', '👩‍🏫 Professores');

  const tOpts = `<option value="">— Selecione o professor —</option>` +
    state.teachers.map(t => {
      const ct = state.schedules.filter(s => s.teacherId === t.id).length;
      return `<option value="${t.id}" ${t.id === schedUI.teacherId ? 'selected' : ''}>
        ${h(t.name)}${ct ? ` (${ct} aula${ct > 1 ? 's' : ''})` : ''}
      </option>`;
    }).join('');

  // Nenhum professor selecionado ainda
  if (!schedUI.teacherId) {
    return `
      <div class="card card-b" style="max-width:460px;margin-bottom:24px">
        <div class="lbl" style="margin-bottom:8px">Professor</div>
        <select class="inp" data-action="schedSelectTeacher" style="font-size:15px">
          ${tOpts}
        </select>
      </div>
      <div class="empty" style="max-width:500px">
        <div class="empty-ico">📋</div>
        <div class="empty-ttl">Selecione um professor</div>
        <div class="empty-dsc">Os horários de aula são gerenciados individualmente por professor.</div>
      </div>`;
  }

  const teacher = state.teachers.find(t => t.id === schedUI.teacherId);
  const cv = colorOfTeacher(teacher);

  // Tabs de segmento
  const segTabs = state.segments.map(seg => `
    <button class="stab ${seg.id === schedUI.segmentId ? 'on' : ''}"
      data-action="schedSelectSegment" data-seg="${seg.id}"
      style="font-size:13px">
      ${h(seg.name)}
    </button>`).join('');

  const grid = schedUI.segmentId
    ? buildScheduleGrid(
        state.segments.find(s => s.id === schedUI.segmentId),
        schedUI.teacherId
      )
    : `<div class="empty" style="max-width:440px;margin-top:16px">
        <div class="empty-ico">🏫</div>
        <div class="empty-ttl">Selecione o nível de ensino</div>
        <div class="empty-dsc">Escolha Ensino Fundamental ou Ensino Médio para ver o horário.</div>
       </div>`;

  const total = state.schedules.filter(s => s.teacherId === schedUI.teacherId).length;

  return `
    <!-- Seletor de professor -->
    <div class="card card-b" style="max-width:100%;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:220px">
          <div class="lbl">Professor</div>
          <select class="inp" data-action="schedSelectTeacher" style="font-size:14px">
            ${tOpts}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="th-av" style="background:${cv.tg};color:${cv.tx};width:40px;height:40px;font-size:18px">
            ${h(teacher.name.charAt(0))}
          </div>
          <div>
            <div style="font-weight:700;font-size:15px">${h(teacher.name)}</div>
            <div style="font-size:12px;color:var(--t2)">
              ${h(teacherSubjectNames(teacher) || '—')} ·
              <strong>${total}</strong> aula${total !== 1 ? 's' : ''} cadastrada${total !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Abas de segmento -->
    <div class="s-tabs" style="margin-bottom:16px">${segTabs}</div>

    <!-- Grade horária -->
    <div id="sched-grid-container">${grid}</div>`;
}

function emptyTabGuard(msg, tab, label) {
  return `<div class="card card-b" style="text-align:center;padding:40px;max-width:500px">
    <p style="color:var(--t2);margin-bottom:16px">${msg}</p>
    <button class="btn btn-dark" data-action="stab" data-tab="${tab}">${label}</button>
  </div>`;
}

/**
 * Constrói o grid unificado de um segmento para um professor.
 * Linhas = todos os períodos do segmento (manhã + tarde, ordenados por horário).
 * Células mostram apenas as aulas DO professor selecionado.
 */
function buildScheduleGrid(seg, teacherId) {
  if (!seg) return '';

  // Coleta todos os períodos únicos do segmento (ambos turnos), ordenados por início
  const allPeriodos = ['manha', 'tarde'].flatMap(turno => {
    const aulas = getPeriodos(seg.id, turno);
    return aulas.map(p => ({ ...p, turno, slot: `${seg.id}|${turno}|${p.aulaIdx}` }));
  }).sort((a, b) => {
    if (a.isIntervalo && b.isIntervalo) return a.inicio.localeCompare(b.inicio);
    if (a.isIntervalo) return 0; // keep relative position handled below
    if (b.isIntervalo) return 0;
    return a.inicio.localeCompare(b.inicio);
  });

  // Remove períodos duplicados (mesmo inicio+fim) e intercala intervalos na posição certa
  const seen = new Set();
  const periodos = [];
  for (const p of allPeriodos) {
    const key = p.isIntervalo ? `iv:${p.inicio}` : `au:${p.inicio}`;
    if (seen.has(key)) continue;
    seen.add(key);
    periodos.push(p);
  }

  if (periodos.filter(p => !p.isIntervalo).length === 0) {
    return `<div class="card card-b" style="padding:24px;color:var(--t2);text-align:center">
      Configure os períodos deste segmento antes de cadastrar horários.
    </div>`;
  }

  const headers = DAYS.map(d =>
    `<th style="text-align:center;min-width:140px;padding:10px 8px">${d}</th>`
  ).join('');

  const rows = periodos.map(periodo => {
    if (periodo.isIntervalo) {
      return `
        <tr>
          <td style="padding:5px 12px;background:var(--accent-l);border-bottom:1px solid #F6C9A8">
            <div style="font-size:11px;font-weight:700;color:var(--accent)">☕ Intervalo</div>
            <div style="font-size:10px;color:var(--accent);font-family:'DM Mono',monospace">
              ${h(periodo.inicio)}–${h(periodo.fim)}
            </div>
          </td>
          ${DAYS.map(() =>
            `<td style="background:var(--accent-l);border-bottom:1px solid #F6C9A8"></td>`
          ).join('')}
        </tr>`;
    }

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
        <thead>
          <tr>
            <th style="text-align:left;width:115px">Aula</th>
            ${headers}
          </tr>
        </thead>
        <tbody id="sched-tbody-${seg.id}">${rows}</tbody>
      </table>
    </div>`;
}

/**
 * Renderiza uma única célula do grid — chamada também para atualização imediata.
 */
export function renderSchedCell(segId, periodo, teacherId, day) {
  const slot  = periodo.slot ?? `${segId}|${periodo.turno}|${periodo.aulaIdx}`;

  // Apenas aulas DO professor neste slot/dia
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
          data-action="removeScheduleImmediate"
          data-id="${s.id}"
          data-seg="${segId}"
          data-aula="${periodo.aulaIdx}"
          data-turno="${periodo.turno}"
          data-day="${h(day)}"
          data-teacher="${teacherId}"
          title="Remover aula">✕</button>
      </div>`;
  }).join('');

  return `
    <td class="sched-cell"
      id="sched-cell-${segId}-${periodo.turno}-${periodo.aulaIdx}-${day.replace(/[^a-z]/gi,'')}"
      data-action="openScheduleModal"
      data-seg="${segId}"
      data-turno="${periodo.turno}"
      data-aula="${periodo.aulaIdx}"
      data-day="${h(day)}"
      data-teacher="${teacherId}">
      ${cards}
      <div class="sched-add-hint">＋ adicionar</div>
    </td>`;
}

