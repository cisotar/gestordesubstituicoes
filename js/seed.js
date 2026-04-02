/**
 * seed.js — Dados de teste para desenvolvimento.
 *
 * Como usar no console do browser (F12):
 *   (async () => { const { runSeed } = await import('/js/seed.js'); await runSeed(); })();
 */

import { state, saveState } from './state.js';
import { saveToFirestore }  from './db.js';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function runSeed() {
  console.log('[seed] Iniciando...');

  // ── Segmento Ensino Médio ─────────────────────────────────────────────────
  let segMed = state.segments.find(s => s.id === 'seg-med');
  if (!segMed) {
    segMed = { id: 'seg-med', name: 'Ensino Médio', grades: [] };
    state.segments.push(segMed);
  }

  // Séries 1ª, 2ª, 3ª com turmas A, B, C no turno tarde
  ['1ª Série', '2ª Série', '3ª Série'].forEach(gradeName => {
    let grade = segMed.grades.find(g => g.name === gradeName);
    if (!grade) { grade = { name: gradeName, classes: [] }; segMed.grades.push(grade); }
    ['A','B','C'].forEach(letter => {
      if (!grade.classes.find(c => c.letter === letter))
        grade.classes.push({ letter, turno: 'tarde' });
    });
  });

  // ── Períodos tarde para Ensino Médio ──────────────────────────────────────
  if (!state.periodConfigs) state.periodConfigs = {};
  if (!state.periodConfigs['seg-med']) state.periodConfigs['seg-med'] = {};
  state.periodConfigs['seg-med'].tarde = {
    inicio: '13:00', duracao: 50, qtd: 6,
    intervalos: [{ apos: 3, duracao: 20 }],
  };

  // ── Áreas ────────────────────────────────────────────────────────────────
  const ensureArea = (name, colorIdx) => {
    let a = state.areas.find(x => x.name === name);
    if (!a) { a = { id: uid(), name, colorIdx }; state.areas.push(a); }
    return a;
  };
  const areaHumanas    = ensureArea('Ciências Humanas', 3);
  const areaMatematica = ensureArea('Matemática', 1);

  // ── Matérias ─────────────────────────────────────────────────────────────
  const ensureSubject = (name, areaId) => {
    let s = state.subjects.find(x => x.name === name && x.areaId === areaId);
    if (!s) { s = { id: uid(), name, areaId }; state.subjects.push(s); }
    return s;
  };
  const subjGeo    = ensureSubject('Geografia',  areaHumanas.id);
  const subjSocio  = ensureSubject('Sociologia', areaHumanas.id);
  const subjMat    = ensureSubject('Matemática', areaMatematica.id);
  const subjFisica = ensureSubject('Física',     areaMatematica.id);

  // ── Professores ──────────────────────────────────────────────────────────
  const ensureTeacher = (name, subjectIds) => {
    let t = state.teachers.find(x => x.name === name);
    if (!t) {
      t = { id: uid(), name, subjectIds, email:'', whatsapp:'', celular:'', status:'approved' };
      state.teachers.push(t);
    } else {
      subjectIds.forEach(sid => { if (!t.subjectIds.includes(sid)) t.subjectIds.push(sid); });
    }
    return t;
  };

  const profAna    = ensureTeacher('Ana Lima',       [subjGeo.id]);
  const profCarlos = ensureTeacher('Carlos Souza',   [subjSocio.id]);
  const profMaria  = ensureTeacher('Maria Oliveira', [subjMat.id]);
  const profPedro  = ensureTeacher('Pedro Santos',   [subjFisica.id]);

  // ── Horários ─────────────────────────────────────────────────────────────
  // Remove horários antigos dos 4 professores para evitar duplicatas
  const profIds = new Set([profAna.id, profCarlos.id, profMaria.id, profPedro.id]);
  state.schedules = state.schedules.filter(s => !profIds.has(s.teacherId));

  const addSched = (teacherId, subjectId, turma, day, aulaIdx) => {
    state.schedules.push({
      id: uid(), teacherId, subjectId, turma, day,
      timeSlot: `seg-med|tarde|${aulaIdx}`,
    });
  };

  /**
   * Ana Lima — Geografia — 30 aulas/semana
   * 3 séries × 3 turmas = 9 turmas. 2 aulas por turma = 18 aulas (turmas próprias).
   * Mais 12 aulas extras para chegar em 30 (outras turmas, outros dias).
   *
   * Distribuição:
   *   1ª A, 1ª B, 1ª C — 2 aulas cada
   *   2ª A, 2ª B, 2ª C — 2 aulas cada
   *   3ª A, 3ª B, 3ª C — 2 aulas cada
   *   = 18 aulas em 9 turmas × 5 dias
   *
   * Para chegar a 30: mais 12 aulas distribuídas entre as mesmas turmas
   * (3ª aula em algumas turmas em dias diferentes).
   */

  // 1ª Série A — seg aula 1, ter aula 3
  addSched(profAna.id, subjGeo.id, '1ª Série A', 'Segunda', 1);
  addSched(profAna.id, subjGeo.id, '1ª Série A', 'Terça',   3);
  // 1ª Série A — mais 1 extra
  addSched(profAna.id, subjGeo.id, '1ª Série A', 'Quinta',  2);

  // 1ª Série B — qua aula 2, sex aula 4
  addSched(profAna.id, subjGeo.id, '1ª Série B', 'Quarta',  2);
  addSched(profAna.id, subjGeo.id, '1ª Série B', 'Sexta',   4);
  // 1ª Série B — extra
  addSched(profAna.id, subjGeo.id, '1ª Série B', 'Segunda', 5);

  // 1ª Série C — seg aula 3, qui aula 1
  addSched(profAna.id, subjGeo.id, '1ª Série C', 'Segunda', 3);
  addSched(profAna.id, subjGeo.id, '1ª Série C', 'Quinta',  1);
  // extra
  addSched(profAna.id, subjGeo.id, '1ª Série C', 'Sexta',   2);

  // 2ª Série A — ter aula 1, qui aula 4
  addSched(profAna.id, subjGeo.id, '2ª Série A', 'Terça',   1);
  addSched(profAna.id, subjGeo.id, '2ª Série A', 'Quinta',  4);
  // extra
  addSched(profAna.id, subjGeo.id, '2ª Série A', 'Quarta',  3);

  // 2ª Série B — qua aula 1, sex aula 3
  addSched(profAna.id, subjGeo.id, '2ª Série B', 'Quarta',  1);
  addSched(profAna.id, subjGeo.id, '2ª Série B', 'Sexta',   3);
  // extra
  addSched(profAna.id, subjGeo.id, '2ª Série B', 'Terça',   4);

  // 2ª Série C — seg aula 4, ter aula 2
  addSched(profAna.id, subjGeo.id, '2ª Série C', 'Segunda', 4);
  addSched(profAna.id, subjGeo.id, '2ª Série C', 'Terça',   2);
  // extra
  addSched(profAna.id, subjGeo.id, '2ª Série C', 'Quinta',  3);

  // 3ª Série A — qua aula 4, sex aula 1
  addSched(profAna.id, subjGeo.id, '3ª Série A', 'Quarta',  4);
  addSched(profAna.id, subjGeo.id, '3ª Série A', 'Sexta',   1);
  // extra
  addSched(profAna.id, subjGeo.id, '3ª Série A', 'Segunda', 2);

  // 3ª Série B — ter aula 5, qui aula 2
  addSched(profAna.id, subjGeo.id, '3ª Série B', 'Terça',   5);
  addSched(profAna.id, subjGeo.id, '3ª Série B', 'Quinta',  2);
  // extra
  addSched(profAna.id, subjGeo.id, '3ª Série B', 'Sexta',   5);

  // 3ª Série C — qua aula 5, sex aula 6
  addSched(profAna.id, subjGeo.id, '3ª Série C', 'Quarta',  5);
  addSched(profAna.id, subjGeo.id, '3ª Série C', 'Sexta',   6);
  // extra
  addSched(profAna.id, subjGeo.id, '3ª Série C', 'Terça',   6);

  const anaTotal = state.schedules.filter(s => s.teacherId === profAna.id).length;
  console.log(`[seed] Ana Lima: ${anaTotal} aulas`);

  // ── Carlos Souza — Sociologia ─────────────────────────────────────────────
  addSched(profCarlos.id, subjSocio.id, '1ª Série A', 'Terça',   2);
  addSched(profCarlos.id, subjSocio.id, '1ª Série B', 'Segunda', 1);
  addSched(profCarlos.id, subjSocio.id, '1ª Série C', 'Quarta',  3);
  addSched(profCarlos.id, subjSocio.id, '2ª Série A', 'Quinta',  5);
  addSched(profCarlos.id, subjSocio.id, '2ª Série B', 'Sexta',   2);
  addSched(profCarlos.id, subjSocio.id, '2ª Série C', 'Terça',   4);
  addSched(profCarlos.id, subjSocio.id, '3ª Série A', 'Quinta',  3);
  addSched(profCarlos.id, subjSocio.id, '3ª Série B', 'Segunda', 5);
  addSched(profCarlos.id, subjSocio.id, '3ª Série C', 'Sexta',   4);
  console.log(`[seed] Carlos Souza: ${state.schedules.filter(s=>s.teacherId===profCarlos.id).length} aulas`);

  // ── Maria Oliveira — Matemática ───────────────────────────────────────────
  addSched(profMaria.id, subjMat.id, '1ª Série A', 'Quarta',  1);
  addSched(profMaria.id, subjMat.id, '1ª Série B', 'Quinta',  3);
  addSched(profMaria.id, subjMat.id, '1ª Série C', 'Terça',   5);
  addSched(profMaria.id, subjMat.id, '2ª Série A', 'Segunda', 2);
  addSched(profMaria.id, subjMat.id, '2ª Série B', 'Sexta',   1);
  addSched(profMaria.id, subjMat.id, '2ª Série C', 'Quinta',  6);
  addSched(profMaria.id, subjMat.id, '3ª Série A', 'Terça',   3);
  addSched(profMaria.id, subjMat.id, '3ª Série B', 'Quarta',  6);
  addSched(profMaria.id, subjMat.id, '3ª Série C', 'Segunda', 6);
  console.log(`[seed] Maria Oliveira: ${state.schedules.filter(s=>s.teacherId===profMaria.id).length} aulas`);

  // ── Pedro Santos — Física ─────────────────────────────────────────────────
  addSched(profPedro.id, subjFisica.id, '1ª Série A', 'Sexta',   5);
  addSched(profPedro.id, subjFisica.id, '1ª Série B', 'Quarta',  6);
  addSched(profPedro.id, subjFisica.id, '1ª Série C', 'Segunda', 4);
  addSched(profPedro.id, subjFisica.id, '2ª Série A', 'Terça',   6);
  addSched(profPedro.id, subjFisica.id, '2ª Série B', 'Quinta',  4);
  addSched(profPedro.id, subjFisica.id, '2ª Série C', 'Sexta',   6);
  addSched(profPedro.id, subjFisica.id, '3ª Série A', 'Segunda', 5);
  addSched(profPedro.id, subjFisica.id, '3ª Série B', 'Terça',   4);
  addSched(profPedro.id, subjFisica.id, '3ª Série C', 'Quinta',  5);
  console.log(`[seed] Pedro Santos: ${state.schedules.filter(s=>s.teacherId===profPedro.id).length} aulas`);

  // ── Persiste ─────────────────────────────────────────────────────────────
  console.log('[seed] Salvando no Firestore...');
  await saveToFirestore();
  console.log('[seed] ✅ Concluído! Recarregue a página.');
}
