/**
 * profile.js — Modal de edição do perfil do professor logado.
 * Permite ao professor editar celular e matérias que leciona,
 * com seleção de segmento (EF/EM) antes de exibir as matérias.
 */

import { state }     from './state.js';
import { authState } from './auth.js';
import { h }         from './helpers.js';

export function renderProfileModal(teacher) {
  const overlay = document.getElementById('overlay');
  const body    = document.getElementById('modal-body');
  if (!overlay || !body || !teacher) return;

  const segChecks = state.segments.map(seg => `
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;
      cursor:pointer;padding:4px 0;user-select:none">
      <input type="checkbox" name="prof-seg" value="${seg.id}">
      ${h(seg.name)}
    </label>`).join('');

  body.innerHTML = `
    <div class="m-hdr">
      <h3 style="font-size:17px">Meu Perfil</h3>
      <button class="m-close"
        onclick="document.getElementById('overlay').classList.remove('on')">×</button>
    </div>

    <div class="fld">
      <label class="lbl">Nome</label>
      <div style="padding:8px 12px;background:var(--surf2);border-radius:var(--r);
        font-size:14px;color:var(--t2)">${h(teacher.name)}</div>
    </div>
    <div class="fld">
      <label class="lbl">E-mail</label>
      <div style="padding:8px 12px;background:var(--surf2);border-radius:var(--r);
        font-size:14px;color:var(--t2)">${h(teacher.email ?? '')}</div>
    </div>
    <div class="fld">
      <label class="lbl">Celular / WhatsApp</label>
      <input class="inp" id="prof-celular" type="tel"
        value="${h(teacher.celular ?? '')}" placeholder="(11) 99999-9999">
    </div>
    <div class="fld">
      <label class="lbl">Em qual nível você leciona?</label>
      <div style="margin-top:4px">${segChecks}</div>
    </div>
    <div class="fld" id="prof-subj-wrap" style="display:none;margin-bottom:24px">
      <label class="lbl">Matérias que leciono</label>
      <div id="prof-subj-list"
        style="margin-top:6px;max-height:220px;overflow-y:auto"></div>
    </div>

    <button class="btn btn-dark" style="width:100%" id="btn-prof-save">Salvar</button>`;

  overlay.classList.add('on');

  // Inicializa conjunto de matérias já associadas ao professor
  const selSubjIds = new Set(teacher.subjectIds ?? []);

  function refreshSubjList() {
    const selectedSegs = [...document.querySelectorAll('[name="prof-seg"]:checked')]
      .map(cb => cb.value);
    const wrap = document.getElementById('prof-subj-wrap');
    const list = document.getElementById('prof-subj-list');
    if (!wrap || !list) return;

    if (!selectedSegs.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';

    // Salva estado antes de re-renderizar
    document.querySelectorAll('[name="prof-subj"]').forEach(cb => {
      if (cb.checked) selSubjIds.add(cb.value);
      else            selSubjIds.delete(cb.value);
    });

    let html = '';
    selectedSegs.forEach(segId => {
      const seg      = state.segments.find(s => s.id === segId);
      const segAreas = (state.areas ?? []).filter(a => {
        const sIds = a.segmentIds ?? [];
        return sIds.length === 0 || sIds.includes(segId);
      });
      const subjsForSeg = segAreas.flatMap(a =>
        (state.subjects ?? []).filter(s => s.areaId === a.id)
      );
      if (!subjsForSeg.length) {
        html += `<div style="font-size:12px;color:var(--t3);margin:8px 0">
          ${h(seg?.name)}: nenhuma matéria cadastrada.</div>`;
        return;
      }
      html += `<div style="font-size:11px;font-weight:700;color:var(--accent);
        text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px">
        ${h(seg?.name ?? segId)}</div>`;
      segAreas.forEach(area => {
        const aSubjs = (state.subjects ?? []).filter(s => s.areaId === area.id);
        if (!aSubjs.length) return;
        html += `<div style="font-size:11px;font-weight:600;color:var(--t2);
          margin:6px 0 2px;padding-left:4px">${h(area.name)}</div>`;
        aSubjs.forEach(s => {
          html += `<label style="display:flex;align-items:center;gap:6px;font-size:13px;
            cursor:pointer;padding:3px 0 3px 12px;user-select:none">
            <input type="checkbox" name="prof-subj" value="${s.id}"
              ${selSubjIds.has(s.id) ? 'checked' : ''}>
            ${h(s.name)}
          </label>`;
        });
      });
    });

    list.innerHTML = html || `<p style="font-size:12px;color:var(--t3)">
      Nenhuma matéria cadastrada para os níveis selecionados.</p>`;
  }

  document.querySelectorAll('[name="prof-seg"]').forEach(cb => {
    cb.addEventListener('change', refreshSubjList);
  });

  document.getElementById('btn-prof-save')?.addEventListener('click', async () => {
    const celular = document.getElementById('prof-celular')?.value?.trim() ?? '';

    // Captura estado final
    document.querySelectorAll('[name="prof-subj"]').forEach(cb => {
      if (cb.checked) selSubjIds.add(cb.value);
      else            selSubjIds.delete(cb.value);
    });
    const subjectIds = [...selSubjIds];

    const { saveTeacherContacts } = await import('./actions.js');
    saveTeacherContacts(teacher.id, { celular, subjectIds });

    authState.teacher.celular    = celular;
    authState.teacher.subjectIds = subjectIds;

    overlay.classList.remove('on');
  });
}
