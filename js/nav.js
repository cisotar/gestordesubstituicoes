import { state }                       from './state.js';
import { renderAbsencePage, renderAbsenceList, resetAbsenceUI } from './absence-view.js';
import { renderPage, renderSettings }  from './render.js';
import { renderDashboard }             from './dashboard.js';
import { getOverloadedTeachers }       from './history.js';

/** Atualiza os contadores e alertas da navbar */
export function updateNav() {
  const subCount    = Object.keys(state.subs).length;
  const overloaded  = getOverloadedTeachers();

  const statsEl = document.getElementById('nav-stats');
  if (statsEl) statsEl.textContent =
    `${state.teachers.length} prof · ${state.schedules.length} aulas`;

  const warn = document.getElementById('nav-warn');
  if (subCount > 0 || overloaded.length > 0) {
    const parts = [];
    if (subCount   > 0) parts.push(`⚠ ${subCount} sub${subCount > 1 ? 's' : ''}`);
    if (overloaded.length > 0) parts.push(`🔴 ${overloaded.length} sobrecarregado${overloaded.length > 1 ? 's' : ''}`);
    warn.style.display = '';
    warn.textContent   = parts.join(' · ');
  } else {
    warn.style.display = 'none';
  }
}

/**
 * Navega para uma página da aplicação.
 * @param {string} page  - 'calendar' | 'teacher' | 'dashboard' | 'settings'
 * @param {string|null} tid - ID do professor (apenas para page='teacher')
 */
export function navigate(page, tid = null) {
  state.page = page;
  if (tid) state.focusTid = tid;

  document.querySelectorAll('.pg').forEach(p => p.classList.remove('on'));
  document.getElementById('pg-' + page)?.classList.add('on');

  const mainPage = page === 'teacher' ? 'calendar' : page;
  document.querySelectorAll('.ntab').forEach(t => t.classList.remove('on'));
  document.querySelector(`.ntab[data-page="${mainPage}"]`)?.classList.add('on');

  const bc = document.getElementById('nav-bc');
  if (page === 'teacher' && state.focusTid) {
    const teacher = state.teachers.find(t => t.id === state.focusTid);
    bc.classList.add('vis');
    document.getElementById('nav-bc-name').textContent = teacher?.name ?? '';
  } else {
    bc.classList.remove('vis');
  }

  updateNav();

  if (page === 'dashboard')    renderDashboard();
  else if (page === 'absences') {
    const el = document.getElementById('pg-absences');
    if (el && el.innerHTML === '') renderAbsenceList();
    else renderAbsenceList();
  }
  else if (page === 'my-schedule') {
    import('./my-schedule.js').then(({ renderMySchedule }) => renderMySchedule());
  }
  else renderPage();
}

/**
 * Troca a aba ativa no painel de Configurações.
 * @param {string} tab - 'teachers' | 'schedules' | 'timeslots'
 */
export function setSettingsTab(tab) {
  state.stab = tab;
  document.querySelectorAll('.stab').forEach(t => t.classList.remove('on'));
  document.querySelector(`.stab[data-tab="${tab}"]`)?.classList.add('on');
  renderSettings();
}
