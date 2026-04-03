export const state = {
  /* ── Estrutura escolar ─────────────────────────────────────────────── */
  segments: [
    {
      id: 'seg-fund',
      name: 'Ensino Fundamental',
      turno: 'manha',
      grades: [
        { name: '6º Ano', classes: [{ letter:'A', turno:'manha' }, { letter:'B', turno:'manha' }, { letter:'C', turno:'manha' }] },
        { name: '7º Ano', classes: [{ letter:'A', turno:'manha' }, { letter:'B', turno:'manha' }, { letter:'C', turno:'manha' }] },
        { name: '8º Ano', classes: [{ letter:'A', turno:'manha' }, { letter:'B', turno:'manha' }, { letter:'C', turno:'manha' }] },
        { name: '9º Ano', classes: [{ letter:'A', turno:'manha' }, { letter:'B', turno:'manha' }, { letter:'C', turno:'manha' }] },
      ],
    },
    {
      id: 'seg-med',
      name: 'Ensino Médio',
      turno: 'tarde',
      grades: [
        { name: '1ª Série', classes: [{ letter:'A', turno:'tarde' }, { letter:'B', turno:'tarde' }, { letter:'C', turno:'tarde' }] },
        { name: '2ª Série', classes: [{ letter:'A', turno:'tarde' }, { letter:'B', turno:'tarde' }, { letter:'C', turno:'tarde' }] },
        { name: '3ª Série', classes: [{ letter:'A', turno:'tarde' }, { letter:'B', turno:'tarde' }, { letter:'C', turno:'tarde' }] },
      ],
    },
  ],

  /* ── Configuração de períodos (por segmento × turno) ───────────────── */
  periodConfigs: {
    'seg-fund': {
      manha: { inicio:'07:00', duracao:50, qtd:7, intervalos:[{ apos:2, duracao:10 }, { apos:5, duracao:60 }] },
    },
    'seg-med': {
      tarde: { inicio:'12:30', duracao:50, qtd:7, intervalos:[{ apos:2, duracao:10 }, { apos:5, duracao:60 }] },
    },
  },

  /* ── Currículo ─────────────────────────────────────────────────────── */
  areas:    [], // { id, name, colorIdx }
  subjects: [], // { id, name, areaId }

  /* ── Corpo docente ─────────────────────────────────────────────────── */
  teachers: [], // { id, name, subjectIds:[], email:'', whatsapp:'', celular:'' }

  /* ── Agenda ─────────────────────────────────────────────────────────── */
  // timeSlot = "segId|turno|aulaIdx"  ex: "seg-fund|manha|3"
  schedules: [], // { id, teacherId, subjectId, turma, day, timeSlot }

  /* ── Substituições ─────────────────────────────────────────────────── */
  subs:    {}, // `${teacherId}||${day}||${timeSlot}` → subTeacherId
  history: [],

  /* ── Configurações ─────────────────────────────────────────────────── */
  workloadWarn:   20,
  workloadDanger: 26,

  /* ── UI (não persistido) ───────────────────────────────────────────── */
  page:     'calendar',
  focusTid: null,
  stab:     'segments',
};

/**
 * saveState — salva localmente via localStorage e persiste no Firestore em background.
 * Emite toasts para cada etapa: salvo localmente, sincronizado, ou erro.
 */
export function saveState(msg = null) {
  // Salva no localStorage imediatamente (síncrono)
  _saveLocal();

  // Toast de "salvo localmente"
  _toast(msg ? `💾 ${msg}` : '💾 Salvo localmente', 'local');

  // Persiste no Firestore em background
  import('./db.js').then(({ saveToFirestore }) => {
    saveToFirestore()
      .then(() => _toast('☁ Sincronizado com o servidor', 'ok'))
      .catch(e => {
        console.warn('[state] Falha ao sincronizar:', e);
        _toast('⚠ Erro ao sincronizar. Dado salvo localmente.', 'warn');
      });
  });
}

function _saveLocal() {
  try {
    const { segments, periodConfigs, areas, subjects, teachers,
            schedules, subs, absences, history,
            workloadWarn, workloadDanger } = state;
    localStorage.setItem('gestao_v7_cache', JSON.stringify({
      segments, periodConfigs, areas, subjects, teachers,
      schedules, subs: subs ?? {}, absences: absences ?? [],
      history: history ?? [], workloadWarn, workloadDanger,
    }));
  } catch (e) { /* storage full */ }
}

let _toastTimer = null;

function _toast(msg, type = 'ok') {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast-${type} toast-show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('toast-show'), 3000);
}

export function loadState() {
  // No-op: loading is handled by db.js loadFromFirestore() in app.js
}
