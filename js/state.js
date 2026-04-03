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
 * saveState — persiste no Firestore em background (fire-and-forget).
 * Não bloqueia a UI. Erros são logados silenciosamente.
 */
export function saveState() {
  import('./db.js').then(({ saveToFirestore }) => {
    saveToFirestore().catch(e => console.warn('[state] Falha ao salvar:', e));
  });
}

export function loadState() {
  // No-op: loading is handled by db.js loadFromFirestore() in app.js
}
