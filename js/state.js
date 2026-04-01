export const state = {
  /* ── Estrutura escolar ─────────────────────────────────────────────── */
  segments: [
    {
      id: 'seg-fund',
      name: 'Ensino Fundamental',
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
      grades: [
        { name: '1ª Série', classes: [{ letter:'A', turno:'manha' }, { letter:'B', turno:'manha' }, { letter:'C', turno:'manha' }] },
        { name: '2ª Série', classes: [{ letter:'A', turno:'manha' }, { letter:'B', turno:'manha' }, { letter:'C', turno:'manha' }] },
        { name: '3ª Série', classes: [{ letter:'A', turno:'manha' }, { letter:'B', turno:'manha' }, { letter:'C', turno:'manha' }] },
      ],
    },
  ],

  /* ── Configuração de períodos (por segmento × turno) ───────────────── */
  periodConfigs: {
    'seg-fund': {
      manha: { inicio:'07:00', duracao:50, qtd:5, intervalos:[{ apos:3, duracao:20 }] },
      tarde: { inicio:'13:00', duracao:50, qtd:5, intervalos:[{ apos:3, duracao:20 }] },
    },
    'seg-med': {
      manha: { inicio:'07:00', duracao:50, qtd:5, intervalos:[{ apos:3, duracao:20 }] },
      tarde: { inicio:'13:00', duracao:50, qtd:5, intervalos:[{ apos:3, duracao:20 }] },
    },
  },

  /* ── Currículo ─────────────────────────────────────────────────────── */
  areas:    [], // { id, name, colorIdx }
  subjects: [], // { id, name, areaId }

  /* ── Corpo docente ─────────────────────────────────────────────────── */
  teachers: [], // { id, name, subjectIds:[] }

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
 * saveState e loadState são mantidos como aliases para compatibilidade
 * com o restante do código. A persistência real é feita via db.js.
 */
export async function saveState() {
  const { saveToFirestore } = await import('./db.js');
  await saveToFirestore();
}

export function loadState() {
  // No-op: loading is handled by db.js loadFromFirestore() in app.js
}
