/**
 * seed.js — Dados de teste para desenvolvimento.
 *
 * Como usar:
 *   1. Abra http://localhost:3000 com o dev mode ADMIN ativo
 *   2. Abra o console do browser (F12)
 *   3. Cole e execute:
 *        const { runSeed } = await import('/js/seed.js');
 *        await runSeed();
 *   4. Recarregue a página
 */

import { state, saveState } from './state.js';
import { saveToFirestore }  from './db.js';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function runSeed() {
  console.log('[seed] Iniciando...');

  // ── 1. Garante que o segmento Ensino Médio existe ─────────────────────────
  let segMed = state.segments.find(s => s.id === 'seg-med');
  if (!segMed) {
    segMed = {
      id: 'seg-med',
      name: 'Ensino Médio',
      grades: [],
    };
    state.segments.push(segMed);
  }

  // Garante que 1ª Série com turmas A, B, C existe
  let grade1 = segMed.grades.find(g => g.name === '1ª Série');
  if (!grade1) {
    grade1 = { name: '1ª Série', classes: [] };
    segMed.grades.push(grade1);
  }
  ['A', 'B', 'C'].forEach(letter => {
    if (!grade1.classes.find(c => c.letter === letter)) {
      grade1.classes.push({ letter, turno: 'tarde' });
    }
  });

  // ── 2. Garante config de período tarde para seg-med ───────────────────────
  if (!state.periodConfigs) state.periodConfigs = {};
  if (!state.periodConfigs['seg-med']) state.periodConfigs['seg-med'] = {};
  if (!state.periodConfigs['seg-med'].tarde) {
    state.periodConfigs['seg-med'].tarde = {
      inicio:     '13:00',
      duracao:    50,
      qtd:        5,
      intervalos: [{ apos: 3, duracao: 20 }],
    };
    console.log('[seed] Período tarde criado para Ensino Médio');
  }

  // ── 3. Áreas do conhecimento ──────────────────────────────────────────────
  let areaHumanas = state.areas.find(a => a.name === 'Ciências Humanas');
  if (!areaHumanas) {
    areaHumanas = { id: uid(), name: 'Ciências Humanas', colorIdx: 3 };
    state.areas.push(areaHumanas);
    console.log('[seed] Área criada: Ciências Humanas');
  }

  let areaMatematica = state.areas.find(a => a.name === 'Matemática');
  if (!areaMatematica) {
    areaMatematica = { id: uid(), name: 'Matemática', colorIdx: 1 };
    state.areas.push(areaMatematica);
    console.log('[seed] Área criada: Matemática');
  }

  // ── 4. Matérias ───────────────────────────────────────────────────────────
  const ensureSubject = (name, areaId) => {
    let s = state.subjects.find(x => x.name === name && x.areaId === areaId);
    if (!s) {
      s = { id: uid(), name, areaId };
      state.subjects.push(s);
      console.log(`[seed] Matéria criada: ${name}`);
    }
    return s;
  };

  const subjGeo      = ensureSubject('Geografia',   areaHumanas.id);
  const subjSocio    = ensureSubject('Sociologia',   areaHumanas.id);
  const subjMat      = ensureSubject('Matemática',   areaMatematica.id);
  const subjFisica   = ensureSubject('Física',       areaMatematica.id);

  // ── 5. Professores ────────────────────────────────────────────────────────
  const ensureTeacher = (name, subjectIds) => {
    let t = state.teachers.find(x => x.name === name);
    if (!t) {
      t = { id: uid(), name, subjectIds, email: '', whatsapp: '', celular: '', status: 'approved' };
      state.teachers.push(t);
      console.log(`[seed] Professor criado: ${name}`);
    } else {
      // Atualiza matérias se necessário
      subjectIds.forEach(sid => {
        if (!t.subjectIds.includes(sid)) t.subjectIds.push(sid);
      });
    }
    return t;
  };

  const profAna    = ensureTeacher('Ana Lima',      [subjGeo.id]);
  const profCarlos = ensureTeacher('Carlos Souza',  [subjSocio.id]);
  const profMaria  = ensureTeacher('Maria Oliveira',[subjMat.id]);
  const profPedro  = ensureTeacher('Pedro Santos',  [subjFisica.id]);

  // ── 6. Horários de aula ───────────────────────────────────────────────────
  // seg-med | tarde | aulas 1 a 5
  // Segunda e Terça
  // Turmas: 1ª Série A, B (cada professor pega uma turma por dia)

  const ensureSchedule = (teacherId, subjectId, turma, day, aulaIdx) => {
    const timeSlot = `seg-med|tarde|${aulaIdx}`;
    const exists   = state.schedules.find(
      s => s.teacherId === teacherId && s.day === day && s.timeSlot === timeSlot
    );
    if (!exists) {
      state.schedules.push({
        id: uid(), teacherId, subjectId, turma, day, timeSlot,
      });
      console.log(`[seed] Horário: ${state.teachers.find(t=>t.id===teacherId)?.name} | ${turma} | ${day} | Aula ${aulaIdx}`);
    }
  };

  // Ana Lima — Geografia — Segunda e Terça
  ensureSchedule(profAna.id,    subjGeo.id,   '1ª Série A', 'Segunda', 1);
  ensureSchedule(profAna.id,    subjGeo.id,   '1ª Série B', 'Terça',   2);

  // Carlos Souza — Sociologia — Segunda e Terça
  ensureSchedule(profCarlos.id, subjSocio.id, '1ª Série B', 'Segunda', 2);
  ensureSchedule(profCarlos.id, subjSocio.id, '1ª Série C', 'Terça',   3);

  // Maria Oliveira — Matemática — Segunda e Terça
  ensureSchedule(profMaria.id,  subjMat.id,   '1ª Série A', 'Segunda', 3);
  ensureSchedule(profMaria.id,  subjMat.id,   '1ª Série C', 'Terça',   1);

  // Pedro Santos — Física — Segunda e Terça
  ensureSchedule(profPedro.id,  subjFisica.id,'1ª Série C', 'Segunda', 4);
  ensureSchedule(profPedro.id,  subjFisica.id,'1ª Série A', 'Terça',   4);

  // ── 7. Persiste tudo ──────────────────────────────────────────────────────
  console.log('[seed] Salvando no Firestore...');
  await saveToFirestore();
  console.log('[seed] ✅ Concluído! Recarregue a página.');
}
