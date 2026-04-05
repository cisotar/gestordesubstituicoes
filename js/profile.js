/**
 * profile.js — Modal de edição do perfil do professor logado.
 * Permite ao professor editar celular e matérias que leciona.
 */

import { state }     from './state.js';
import { authState } from './auth.js';
import { h }         from './helpers.js';

export function renderProfileModal(teacher) {
  const overlay = document.getElementById('overlay');
  const body    = document.getElementById('modal-body');
  if (!overlay || !body || !teacher) return;

  const subjChecks = state.subjects.map(s => `
    <label style="display:flex;align-items:center;gap:6px;font-size:13px;
      cursor:pointer;padding:4px 0;user-select:none">
      <input type="checkbox" name="prof-subj" value="${s.id}"
        ${(teacher.subjectIds ?? []).includes(s.id) ? 'checked' : ''}>
      ${h(s.name)}
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
    <div class="fld" style="margin-bottom:24px">
      <label class="lbl">Matérias que leciono</label>
      <div style="margin-top:6px;max-height:200px;overflow-y:auto">
        ${subjChecks || '<p style="font-size:12px;color:var(--t3)">Nenhuma matéria cadastrada.</p>'}
      </div>
    </div>

    <button class="btn btn-dark" style="width:100%" id="btn-prof-save">Salvar</button>`;

  overlay.classList.add('on');

  document.getElementById('btn-prof-save')?.addEventListener('click', async () => {
    const celular    = document.getElementById('prof-celular')?.value?.trim() ?? '';
    const subjectIds = [...document.querySelectorAll('[name="prof-subj"]:checked')]
      .map(el => el.value);

    const { saveTeacherContacts } = await import('./actions.js');
    saveTeacherContacts(teacher.id, { celular, subjectIds });

    // Mantém authState.teacher sincronizado
    authState.teacher.celular    = celular;
    authState.teacher.subjectIds = subjectIds;

    overlay.classList.remove('on');
  });
}
