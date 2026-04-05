import { colorOfTeacher, colorOfAreaId, h, subKey, uid } from './helpers.js';
import { slotLabel as slotName, slotTimeRange as slotTime } from './periods.js';
import { DAYS, COLOR_PALETTE }     from './constants.js';
import { state, saveState }        from './state.js';
import { renderTeacher, renderSettings } from './render.js';
import { updateNav }               from './nav.js';
import { recordSubstitution }      from './history.js';
import { saveTeacherSubjects }     from './actions.js';

// ─── Utilitário ──────────────────────────────────────────────────────────────

function show(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('overlay').classList.add('on');
}
export function closeModal() {
  document.getElementById('overlay').classList.remove('on');
}

// ─── Modal de Substituição ────────────────────────────────────────────────────

export function openModal(teacherId, day, slot) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;

  const cv    = colorOfTeacher(teacher);
  const busy  = new Set(
    state.schedules.filter(s => s.day === day && s.timeSlot === slot).map(s => s.teacherId)
  );
  const avail     = state.teachers.filter(t => t.id !== teacherId && !busy.has(t.id));
  const curSubId  = state.subs[subKey(teacherId, day, slot)];
  const curSub    = curSubId ? state.teachers.find(t => t.id === curSubId) : null;
  const today     = new Date().toISOString().split('T')[0];

  // Área do professor = áreas das suas matérias
  const teacherAreaIds = new Set(
    (teacher.subjectIds ?? [])
      .map(sid => state.subjects.find(s => s.id === sid)?.areaId)
      .filter(Boolean)
  );

  const sameArea   = avail.filter(t =>
    (t.subjectIds ?? []).some(sid => teacherAreaIds.has(state.subjects.find(s => s.id === sid)?.areaId))
  );
  const otherAreas = avail.filter(t => !sameArea.includes(t));

  const renderCand = (t) => {
    const tc    = colorOfTeacher(t);
    const isCur = t.id === curSubId;
    return `
      <button class="cand${isCur ? ' sel' : ''}"
        data-action="assignSub"
        data-tid="${teacherId}" data-day="${h(day)}" data-slot="${h(slot)}" data-sub="${t.id}">
        <span class="cand-dot" style="background:${tc.dt}"></span>
        <div style="flex:1">
          <div class="cand-name">${h(t.name)}</div>
          <div class="cand-area" style="font-size:11px;color:var(--t2)">
            ${h((t.subjectIds ?? []).map(sid => state.subjects.find(s => s.id === sid)?.name).filter(Boolean).slice(0,3).join(', ') || '—')}
          </div>
        </div>
        ${isCur ? '<span class="cand-cur">atual ✓</span>' : ''}
        <span style="color:var(--t3);font-size:18px">›</span>
      </button>`;
  };

  show(`
    <div class="m-hdr">
      <div>
        <h3 style="font-size:17px;margin-bottom:6px">Registrar Substituição</h3>
        <div style="font-size:13px;color:var(--t2)">
          Ausência de <strong style="color:${cv.tx}">${h(teacher.name)}</strong>
        </div>
        <div class="m-pills" style="margin-top:8px">
          <span class="m-pill">${h(day)}</span>
          <span class="m-pill">${h(slotName(slot))}${slotTime(slot) ? ' · ' + h(slotTime(slot)) : ''}</span>
        </div>
      </div>
      <button class="m-close" data-action="closeModal">×</button>
    </div>

    <div class="fld" style="margin-bottom:16px">
      <label class="lbl">Data da ausência</label>
      <input class="inp" type="date" id="sub-date" value="${today}">
    </div>

    ${curSub ? `<div class="sub-box" style="margin-bottom:16px">
      <div class="sub-box-l">✓ Substituto atual</div>
      <div class="sub-box-n">${h(curSub.name)}</div>
    </div>` : ''}

    ${sameArea.length > 0 ? `<div class="sec-lbl">⭐ Mesma área de atuação</div>${sameArea.map(renderCand).join('')}` : ''}
    ${sameArea.length > 0 && otherAreas.length > 0 ? '<div class="divider"></div>' : ''}
    ${otherAreas.length > 0 ? `<div class="sec-lbl">Outras áreas</div>${otherAreas.map(renderCand).join('')}` : ''}
    ${avail.length === 0 ? `<div style="text-align:center;padding:28px 0;color:var(--t3)">
      <div style="font-size:40px;margin-bottom:10px">😕</div>
      <p>Nenhum professor disponível neste horário.</p>
    </div>` : ''}

    <button class="btn btn-ghost" style="width:100%;margin-top:12px" data-action="closeModal">Cancelar</button>`);
}

export function assignSubstitute(teacherId, day, slot, subId) {
  const date = document.getElementById('sub-date')?.value || new Date().toISOString().split('T')[0];
  state.subs[subKey(teacherId, day, slot)] = subId;
  saveState();
  recordSubstitution(teacherId, day, slot, subId, date);
  closeModal(); updateNav(); renderTeacher();
}

export function clearSubstitute(teacherId, day, slot) {
  delete state.subs[subKey(teacherId, day, slot)];
  saveState(); updateNav(); renderTeacher();
}

// ─── Modal: Adicionar Professor ──────────────────────────────────────────────

function _subjectCheckboxes(inputName, checkedIds = null) {
  function areaBlock(area) {
    const subs = state.subjects.filter(s => s.areaId === area.id);
    if (!subs.length) return '';
    const cv = COLOR_PALETTE[area.colorIdx % COLOR_PALETTE.length];
    return `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;
          background:${cv.tg};color:${cv.tx};display:inline-block;margin-bottom:6px">
          ${h(area.name)}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${subs.map(s => {
            const isChecked = checkedIds ? checkedIds.has(s.id) : false;
            return `<label style="display:flex;align-items:center;gap:6px;padding:5px 10px;
              border-radius:6px;border:1.5px solid var(--bdr);cursor:pointer;font-size:13px;
              color:var(--t1)">
              <input type="checkbox" name="${inputName}" value="${s.id}"
                ${isChecked ? 'checked' : ''}
                style="accent-color:${cv.dt};width:14px;height:14px">
              ${h(s.name)}
            </label>`;
          }).join('')}
        </div>
      </div>`;
  }

  let html = '';

  // Seções por segmento
  state.segments.forEach(seg => {
    const segAreas = state.areas.filter(a => (a.segmentIds ?? []).includes(seg.id));
    if (!segAreas.some(a => state.subjects.some(s => s.areaId === a.id))) return;
    html += `<div style="font-size:11px;font-weight:700;color:var(--accent);
      text-transform:uppercase;letter-spacing:.05em;padding:4px 0;margin:8px 0 6px;
      border-bottom:1px solid var(--bdr)">${h(seg.name)}</div>`;
    html += segAreas.map(areaBlock).join('');
  });

  // Áreas legado (sem segmentIds)
  const legacy = state.areas.filter(a => !(a.segmentIds?.length > 0));
  html += legacy.map(areaBlock).join('');

  return html;
}

export function openAddTeacherModal() {
  const subjSection = state.subjects.length > 0 ? `
    <div class="fld">
      <label class="lbl">Matérias</label>
      <div style="max-height:200px;overflow-y:auto;padding:4px 0;border:1px solid var(--bdr);
        border-radius:var(--r);padding:10px">
        ${_subjectCheckboxes('new-t-subj')}
      </div>
    </div>` : '';

  show(`
    <div class="m-hdr">
      <h3 style="font-size:17px">Novo Professor</h3>
      <button class="m-close" data-action="closeModal">×</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
      <div class="fld">
        <label class="lbl">Nome *</label>
        <input class="inp" id="new-t-name" placeholder="Nome completo">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="fld">
          <label class="lbl">Celular</label>
          <input class="inp" id="new-t-celular" type="tel" placeholder="(11) 99999-9999">
        </div>
        <div class="fld">
          <label class="lbl">E-mail</label>
          <input class="inp" id="new-t-email" type="email" placeholder="prof@escola.edu.br">
        </div>
      </div>
      ${subjSection}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-dark" style="flex:1" data-action="saveAddTeacher">Adicionar</button>
      <button class="btn btn-ghost" data-action="closeModal">Cancelar</button>
    </div>`);
  document.getElementById('new-t-name')?.focus();
}

export function saveAddTeacherModal() {
  const name       = document.getElementById('new-t-name')?.value?.trim();
  const celular    = document.getElementById('new-t-celular')?.value?.trim() ?? '';
  const email      = document.getElementById('new-t-email')?.value?.trim()   ?? '';
  const subjectIds = [...document.querySelectorAll('#modal-body input[name="new-t-subj"]:checked')]
    .map(el => el.value);
  if (!name) { document.getElementById('new-t-name')?.focus(); return; }
  if (state.teachers.find(t => t.name.toLowerCase() === name.toLowerCase())) {
    alert('Professor já cadastrado.'); return;
  }
  state.teachers.push({ id: uid(), name, subjectIds, email, whatsapp: '', celular });
  saveState(`Professor '${name}' cadastrado`);
  updateNav();
  closeModal();
  renderSettings();
}

// ─── Modal: Adicionar em Bloco ────────────────────────────────────────────────

export function openAddTeachersBulkModal() {
  show(`
    <div class="m-hdr">
      <h3 style="font-size:17px">Adicionar em Bloco</h3>
      <button class="m-close" data-action="closeModal">×</button>
    </div>
    <p style="font-size:13px;color:var(--t1);margin-bottom:12px">
      Um professor por linha. Campos separados por ponto e vírgula:<br>
      <code style="font-family:'DM Mono',monospace;background:var(--surf2);
        padding:2px 6px;border-radius:4px;font-size:12px">
        nome ; celular ; email ; matéria1, matéria2
      </code>
    </p>
    <textarea class="inp" id="bulk-t-text" rows="8"
      placeholder="Ana Silva;(11)99999-0001;ana@escola.edu.br;Português,Literatura&#10;João Lima;(11)99999-0002;joao@escola.edu.br;Matemática&#10;Maria Costa"
      style="resize:vertical;font-family:'DM Mono',monospace;font-size:12px;margin-bottom:16px"></textarea>
    <div style="display:flex;gap:8px">
      <button class="btn btn-dark" style="flex:1" data-action="saveAddTeachersBulk">Adicionar todos</button>
      <button class="btn btn-ghost" data-action="closeModal">Cancelar</button>
    </div>`);
  document.getElementById('bulk-t-text')?.focus();
}

export function saveAddTeachersBulkModal() {
  const text = document.getElementById('bulk-t-text')?.value ?? '';
  import('./actions.js').then(({ addTeachersBulk }) => {
    const n = addTeachersBulk(text);
    closeModal();
    if (n > 0) import('./toast.js').then(({ toast }) => toast(`${n} professor${n !== 1 ? 'es' : ''} adicionado${n !== 1 ? 's' : ''}`, 'ok'));
  });
}

// ─── Modal: Associar Matérias ao Professor ────────────────────────────────────

export function openTeacherSubjects(teacherId) {
  const teacher = state.teachers.find(t => t.id === teacherId);
  if (!teacher) return;

  const checkedIds = new Set(teacher.subjectIds ?? []);
  const subjHtml = state.subjects.length > 0
    ? _subjectCheckboxes('ts-subj', checkedIds)
    : `<p style="color:var(--t3);padding:24px 0;text-align:center">Cadastre matérias antes de associar.</p>`;

  show(`
    <div class="m-hdr">
      <div>
        <h3 style="font-size:17px;margin-bottom:4px">Matérias de ${h(teacher.name)}</h3>
        <p style="font-size:13px;color:var(--t2)">Selecione todas as matérias que este professor leciona.</p>
      </div>
      <button class="m-close" data-action="closeModal">×</button>
    </div>
    <div style="max-height:55vh;overflow-y:auto;margin-bottom:16px">
      ${subjHtml}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-dark" style="flex:1"
        data-action="saveTeacherSubjects" data-id="${teacherId}">Salvar</button>
      <button class="btn btn-ghost" data-action="closeModal">Cancelar</button>
    </div>`);
}

export function saveTeacherSubjectsFromModal(teacherId) {
  const checked = [...document.querySelectorAll('#modal-body input[type=checkbox]:checked')]
    .map(el => el.value);
  saveTeacherSubjects(teacherId, checked);
  closeModal();
}

// ─── Modal: Editar Nome do Professor ─────────────────────────────────────────

export function openEditTeacher(id) {
  const teacher = state.teachers.find(t => t.id === id);
  if (!teacher) return;

  show(`
    <div class="m-hdr">
      <h3 style="font-size:17px">Editar Professor</h3>
      <button class="m-close" data-action="closeModal">×</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px">
      <div class="fld">
        <label class="lbl">Nome</label>
        <input class="inp" id="edit-t-name" value="${h(teacher.name)}" placeholder="Nome completo">
      </div>

      <div class="divider"></div>
      <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em">
        Contato
      </div>

      <div class="fld">
        <label class="lbl">Telefone</label>
        <input class="inp" id="edit-t-celular" type="tel"
          value="${h(teacher.celular ?? teacher.whatsapp ?? '')}"
          placeholder="(11) 99999-9999">
      </div>
      <div class="fld">
        <label class="lbl">E-mail</label>
        <input class="inp" id="edit-t-email" type="email"
          value="${h(teacher.email ?? '')}"
          placeholder="professor@escola.edu.br">
      </div>
    </div>

    <div style="display:flex;gap:8px">
      <button class="btn btn-dark" style="flex:1"
        data-action="saveEditTeacher" data-id="${id}">Salvar</button>
      <button class="btn btn-ghost" data-action="closeModal">Cancelar</button>
    </div>`);

  document.getElementById('edit-t-name')?.focus();
}

export function saveEditTeacher(id) {
  const name    = document.getElementById('edit-t-name')?.value?.trim();
  const email   = document.getElementById('edit-t-email')?.value?.trim()   ?? '';
  const celular = document.getElementById('edit-t-celular')?.value?.trim() ?? '';

  if (!name) { document.getElementById('edit-t-name')?.focus(); return; }

  const teacher = state.teachers.find(t => t.id === id);
  if (teacher) {
    teacher.name     = name;
    teacher.email    = email;
    teacher.celular  = celular;
    teacher.whatsapp = celular; // mantém compatibilidade com campo legado
  }

  // Atualiza snapshots no histórico
  state.history.forEach(e => {
    if (e.teacherId === id) e.teacherName = name;
    if (e.subId     === id) e.subName     = name;
  });

  saveState(); closeModal(); renderSettings(); updateNav();
}

// ─── Modal: Editar Horário ────────────────────────────────────────────────────

export function openEditSchedule(id) {
  const sched = state.schedules.find(s => s.id === id);
  if (!sched) return;

  // Parse do slot para exibir contexto
  const slotParts = sched.timeSlot?.split('|') ?? [];
  const seg   = state.segments.find(s => s.id === slotParts[0]);
  const turno = slotParts[1] ?? 'manha';
  const aula  = Number(slotParts[2] ?? 0);

  // Turmas do mesmo segmento+turno
  const turmaObjs = seg?.grades.flatMap(g =>
    g.classes
      .filter(c => (c.turno ?? 'manha') === turno)
      .map(c => `${g.name} ${c.letter}`)
  ) ?? [sched.turma];

  const tOpts  = state.teachers.map(t =>
    `<option value="${t.id}" ${t.id === sched.teacherId ? 'selected' : ''}>${h(t.name)}</option>`
  ).join('');

  const teacher = state.teachers.find(t => t.id === sched.teacherId);
  const mySubjIds = teacher?.subjectIds ?? [];
  // Inclui sempre a matéria actual do horário, mesmo que já não esteja no perfil do professor
  const subjIdSet = new Set([...mySubjIds, ...(sched.subjectId ? [sched.subjectId] : [])]);
  const mySubjs = [...subjIdSet]
    .map(sid => state.subjects.find(s => s.id === sid)).filter(Boolean);
  const sOpts = `<option value="">— sem matéria —</option>` +
    mySubjs.map(s =>
      `<option value="${s.id}" ${s.id === sched.subjectId ? 'selected' : ''}>${h(s.name)}</option>`
    ).join('');

  const trmOpts = turmaObjs.map(tr =>
    `<option value="${h(tr)}" ${tr === sched.turma ? 'selected' : ''}>${h(tr)}</option>`
  ).join('') || `<option value="${h(sched.turma)}" selected>${h(sched.turma)}</option>`;

  const dOpts = DAYS.map(d =>
    `<option value="${h(d)}" ${d === sched.day ? 'selected' : ''}>${d}</option>`
  ).join('');

  show(`
    <div class="m-hdr">
      <h3 style="font-size:17px">Editar Horário</h3>
      <button class="m-close" data-action="closeModal">×</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
      <div class="fld">
        <label class="lbl">Professor</label>
        <select class="inp" id="edit-s-t">${tOpts}</select>
      </div>
      <div class="fld">
        <label class="lbl">Matéria</label>
        <select class="inp" id="edit-s-sub">${sOpts}</select>
      </div>
      <div class="fld">
        <label class="lbl">Turma</label>
        <select class="inp" id="edit-s-trm">${trmOpts}</select>
      </div>
      <div class="fld">
        <label class="lbl">Dia</label>
        <select class="inp" id="edit-s-day">${dOpts}</select>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-dark" style="flex:1"
        data-action="saveEditSchedule" data-id="${id}">Salvar</button>
      <button class="btn btn-ghost" data-action="closeModal">Cancelar</button>
    </div>`);
}

export function saveEditSchedule(id) {
  const tid   = document.getElementById('edit-s-t')?.value;
  const sid   = document.getElementById('edit-s-sub')?.value;
  const turma = document.getElementById('edit-s-trm')?.value;
  const day   = document.getElementById('edit-s-day')?.value;

  if (!tid || !turma) { alert('Preencha todos os campos.'); return; }

  const sched = state.schedules.find(s => s.id === id);
  if (!sched) return;

  const conflict = state.schedules.find(
    s => s.id !== id && s.teacherId === tid && s.day === day && s.timeSlot === sched.timeSlot
  );
  if (conflict) { alert('Conflito: este professor já tem aula neste horário!'); return; }

  Object.assign(sched, { teacherId: tid, subjectId: sid || null, turma, day });
  import('./db.js').then(({ saveDoc }) => saveDoc('schedules', sched));
  saveState(); closeModal(); renderSettings();
}
