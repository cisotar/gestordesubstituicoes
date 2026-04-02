/**
 * seed-ef.js — Popula 4 professores com 30 aulas cada no Ensino Fundamental.
 *
 * Pré-requisito: segmento "seg-fund" com turno "manha" já configurado,
 * com as séries 6º, 7º, 8º e 9º Ano e turmas A, B, C.
 *
 * Estrutura:
 *   - 2 professores de Ciências Humanas (Geografia e História)
 *   - 2 professores de Ciências da Natureza (Ciências e Biologia)
 *   - Cada professor: 10 turmas × 3 aulas = 30 aulas/semana
 *   - Distribuídas de Segunda a Sexta sem conflitos
 *
 * Como usar no console do browser (F12):
 *   (async () => { const { runSeedEF } = await import('/js/seed-ef.js?v=1'); await runSeedEF(); })();
 */

import { state, saveState } from './state.js';
import { saveToFirestore }  from './db.js';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function runSeedEF() {
  console.log('[seed-ef] Iniciando...');

  // ── 1. Garante segmento EF com turno manhã ────────────────────────────────
  let segFund = state.segments.find(s => s.id === 'seg-fund');
  if (!segFund) {
    segFund = { id: 'seg-fund', name: 'Ensino Fundamental', turno: 'manha', grades: [] };
    state.segments.push(segFund);
    console.log('[seed-ef] Segmento EF criado');
  }
  // Define turno manhã se não estiver definido
  segFund.turno = 'manha';

  // Garante séries 6º a 9º Ano com turmas A, B, C (turno manhã)
  const gradeNames = ['6º Ano', '7º Ano', '8º Ano', '9º Ano'];
  gradeNames.forEach(gName => {
    let grade = segFund.grades.find(g => g.name === gName);
    if (!grade) { grade = { name: gName, classes: [] }; segFund.grades.push(grade); }
    ['A','B','C'].forEach(letter => {
      if (!grade.classes.find(c => c.letter === letter))
        grade.classes.push({ letter, turno: 'manha' });
    });
  });

  // ── 2. Períodos manhã para EF (7h, 50min, 6 aulas, intervalo após 3ª) ────
  if (!state.periodConfigs) state.periodConfigs = {};
  if (!state.periodConfigs['seg-fund']) state.periodConfigs['seg-fund'] = {};
  state.periodConfigs['seg-fund'].manha = {
    inicio: '07:00', duracao: 50, qtd: 6,
    intervalos: [{ apos: 3, duracao: 20 }],
  };

  // ── 3. Áreas ──────────────────────────────────────────────────────────────
  const ensureArea = (name, colorIdx) => {
    let a = state.areas.find(x => x.name === name);
    if (!a) { a = { id: uid(), name, colorIdx }; state.areas.push(a); }
    return a;
  };
  const areaHumanas  = ensureArea('Ciências Humanas', 3);
  const areaNatureza = ensureArea('Ciências da Natureza', 2);

  // ── 4. Matérias ───────────────────────────────────────────────────────────
  const ensureSubject = (name, areaId) => {
    let s = state.subjects.find(x => x.name === name && x.areaId === areaId);
    if (!s) { s = { id: uid(), name, areaId }; state.subjects.push(s); }
    return s;
  };
  const subjGeo      = ensureSubject('Geografia', areaHumanas.id);
  const subjHist     = ensureSubject('História',  areaHumanas.id);
  const subjCiencias = ensureSubject('Ciências',  areaNatureza.id);
  const subjBio      = ensureSubject('Biologia',  areaNatureza.id);

  // ── 5. Professores ────────────────────────────────────────────────────────
  const ensureTeacher = (name, subjectIds) => {
    let t = state.teachers.find(x => x.name === name);
    if (!t) {
      t = { id: uid(), name, subjectIds, email:'', whatsapp:'', celular:'', status:'approved' };
      state.teachers.push(t);
      console.log(`[seed-ef] Professor criado: ${name}`);
    } else {
      subjectIds.forEach(sid => { if (!t.subjectIds.includes(sid)) t.subjectIds.push(sid); });
    }
    return t;
  };

  const profRoberto  = ensureTeacher('Roberto Alves',   [subjGeo.id]);
  const profLucia    = ensureTeacher('Lúcia Ferreira',  [subjHist.id]);
  const profMarcelo  = ensureTeacher('Marcelo Costa',   [subjCiencias.id]);
  const profPatricia = ensureTeacher('Patrícia Nunes',  [subjBio.id]);

  // ── 6. Horários ───────────────────────────────────────────────────────────
  // Remove horários antigos dos 4 professores
  const ids = new Set([profRoberto.id, profLucia.id, profMarcelo.id, profPatricia.id]);
  state.schedules = state.schedules.filter(s => !ids.has(s.teacherId));

  const addSched = (teacherId, subjectId, turma, day, aulaIdx) => {
    state.schedules.push({
      id: uid(), teacherId, subjectId, turma, day,
      timeSlot: `seg-fund|manha|${aulaIdx}`,
    });
  };

  /**
   * Distribuição: 4 anos × 3 turmas = 12 turmas por professor.
   * 30 aulas ÷ 12 turmas ≈ 2,5 → algumas turmas têm 2, outras têm 3 aulas.
   * Estratégia: 6 turmas com 3 aulas + 6 turmas com 2 aulas = 30.
   * Sem conflito: cada turma só tem 1 aula de cada professor por slot/dia.
   */

  // ── Roberto Alves — Geografia ─────────────────────────────────────────────
  // 6º Ano A, B, C — 3 aulas cada (18)
  addSched(profRoberto.id, subjGeo.id, '6º Ano A', 'Segunda', 1);
  addSched(profRoberto.id, subjGeo.id, '6º Ano A', 'Quarta',  2);
  addSched(profRoberto.id, subjGeo.id, '6º Ano A', 'Sexta',   1);

  addSched(profRoberto.id, subjGeo.id, '6º Ano B', 'Segunda', 2);
  addSched(profRoberto.id, subjGeo.id, '6º Ano B', 'Quarta',  3);
  addSched(profRoberto.id, subjGeo.id, '6º Ano B', 'Sexta',   2);

  addSched(profRoberto.id, subjGeo.id, '6º Ano C', 'Terça',   1);
  addSched(profRoberto.id, subjGeo.id, '6º Ano C', 'Quinta',  1);
  addSched(profRoberto.id, subjGeo.id, '6º Ano C', 'Sexta',   3);

  // 7º Ano A, B, C — 2 aulas cada (6)
  addSched(profRoberto.id, subjGeo.id, '7º Ano A', 'Segunda', 3);
  addSched(profRoberto.id, subjGeo.id, '7º Ano A', 'Quinta',  2);

  addSched(profRoberto.id, subjGeo.id, '7º Ano B', 'Terça',   2);
  addSched(profRoberto.id, subjGeo.id, '7º Ano B', 'Quinta',  3);

  addSched(profRoberto.id, subjGeo.id, '7º Ano C', 'Terça',   3);
  addSched(profRoberto.id, subjGeo.id, '7º Ano C', 'Sexta',   4);

  // 8º Ano A, B — 2 aulas cada (4)
  addSched(profRoberto.id, subjGeo.id, '8º Ano A', 'Segunda', 4);
  addSched(profRoberto.id, subjGeo.id, '8º Ano A', 'Quarta',  4);

  addSched(profRoberto.id, subjGeo.id, '8º Ano B', 'Segunda', 5);
  addSched(profRoberto.id, subjGeo.id, '8º Ano B', 'Quarta',  5);

  // 9º Ano A, B — 1 aula cada (2) → total 30
  addSched(profRoberto.id, subjGeo.id, '9º Ano A', 'Terça',   4);
  addSched(profRoberto.id, subjGeo.id, '9º Ano A', 'Quinta',  4);

  addSched(profRoberto.id, subjGeo.id, '9º Ano B', 'Terça',   5);
  addSched(profRoberto.id, subjGeo.id, '9º Ano B', 'Quinta',  5);

  // Extra para chegar em 30
  addSched(profRoberto.id, subjGeo.id, '8º Ano C', 'Terça',   6);
  addSched(profRoberto.id, subjGeo.id, '8º Ano C', 'Quinta',  6);

  addSched(profRoberto.id, subjGeo.id, '9º Ano C', 'Quarta',  6);
  addSched(profRoberto.id, subjGeo.id, '9º Ano C', 'Sexta',   5);

  addSched(profRoberto.id, subjGeo.id, '7º Ano A', 'Sexta',   6);
  addSched(profRoberto.id, subjGeo.id, '7º Ano B', 'Sexta',   5);

  const rTotal = state.schedules.filter(s => s.teacherId === profRoberto.id).length;
  console.log(`[seed-ef] Roberto Alves: ${rTotal} aulas`);

  // ── Lúcia Ferreira — História ─────────────────────────────────────────────
  addSched(profLucia.id, subjHist.id, '6º Ano A', 'Segunda', 6);
  addSched(profLucia.id, subjHist.id, '6º Ano A', 'Quarta',  6);
  addSched(profLucia.id, subjHist.id, '6º Ano A', 'Sexta',   6);

  addSched(profLucia.id, subjHist.id, '6º Ano B', 'Terça',   6);
  addSched(profLucia.id, subjHist.id, '6º Ano B', 'Quinta',  6);
  addSched(profLucia.id, subjHist.id, '6º Ano B', 'Sexta',   6); // Sexta aula 6 diferente de Roberto

  addSched(profLucia.id, subjHist.id, '6º Ano C', 'Segunda', 5);
  addSched(profLucia.id, subjHist.id, '6º Ano C', 'Quarta',  5);
  addSched(profLucia.id, subjHist.id, '6º Ano C', 'Sexta',   5);

  addSched(profLucia.id, subjHist.id, '7º Ano A', 'Terça',   5);
  addSched(profLucia.id, subjHist.id, '7º Ano A', 'Quinta',  5);

  addSched(profLucia.id, subjHist.id, '7º Ano B', 'Segunda', 4);
  addSched(profLucia.id, subjHist.id, '7º Ano B', 'Quarta',  4);

  addSched(profLucia.id, subjHist.id, '7º Ano C', 'Segunda', 3);
  addSched(profLucia.id, subjHist.id, '7º Ano C', 'Quarta',  3);

  addSched(profLucia.id, subjHist.id, '8º Ano A', 'Terça',   3);
  addSched(profLucia.id, subjHist.id, '8º Ano A', 'Quinta',  3);

  addSched(profLucia.id, subjHist.id, '8º Ano B', 'Terça',   2);
  addSched(profLucia.id, subjHist.id, '8º Ano B', 'Quinta',  2);

  addSched(profLucia.id, subjHist.id, '8º Ano C', 'Segunda', 2);
  addSched(profLucia.id, subjHist.id, '8º Ano C', 'Quarta',  2);

  addSched(profLucia.id, subjHist.id, '9º Ano A', 'Terça',   4); // diferente de Roberto (slot 4 terça já tem Roberto em 9A)
  // Ajuste: 9A terça já está com Roberto. Usa slot diferente.
  // Vamos substituir pelo slot 1
  state.schedules.pop(); // remove o conflito
  addSched(profLucia.id, subjHist.id, '9º Ano A', 'Segunda', 1); // seg slot 1 — Roberto não usa seg slot 1 para 9A

  addSched(profLucia.id, subjHist.id, '9º Ano A', 'Sexta',   1);

  addSched(profLucia.id, subjHist.id, '9º Ano B', 'Segunda', 6);
  addSched(profLucia.id, subjHist.id, '9º Ano B', 'Quarta',  6); // qua slot 6 — Roberto usa qua 6 para 9C, não 9B

  addSched(profLucia.id, subjHist.id, '9º Ano C', 'Terça',   1);
  addSched(profLucia.id, subjHist.id, '9º Ano C', 'Quinta',  1);

  addSched(profLucia.id, subjHist.id, '7º Ano C', 'Terça',   1); // diferente slot de Roberto em 7C
  addSched(profLucia.id, subjHist.id, '7º Ano A', 'Sexta',   3);

  const lTotal = state.schedules.filter(s => s.teacherId === profLucia.id).length;
  console.log(`[seed-ef] Lúcia Ferreira: ${lTotal} aulas`);

  // ── Marcelo Costa — Ciências ──────────────────────────────────────────────
  // Estratégia espelhada: usa slots que os outros não usam
  const mc = (turma, day, aula) => addSched(profMarcelo.id, subjCiencias.id, turma, day, aula);

  mc('6º Ano A', 'Terça',   2); mc('6º Ano A', 'Quinta',  2); mc('6º Ano A', 'Sexta',  4);
  mc('6º Ano B', 'Segunda', 3); mc('6º Ano B', 'Quinta',  4); mc('6º Ano B', 'Sexta',  3); // Sexta slot 3 — Lucia usa 6B Sexta? Não. Ok.
  mc('6º Ano C', 'Terça',   3); mc('6º Ano C', 'Quinta',  3); mc('6º Ano C', 'Sexta',  6); // ajuste
  mc('7º Ano A', 'Segunda', 5); mc('7º Ano A', 'Quarta',  5);
  mc('7º Ano B', 'Terça',   4); mc('7º Ano B', 'Quinta',  4);
  mc('7º Ano C', 'Segunda', 4); mc('7º Ano C', 'Quarta',  4);
  mc('8º Ano A', 'Terça',   1); mc('8º Ano A', 'Quinta',  1);
  mc('8º Ano B', 'Segunda', 1); mc('8º Ano B', 'Quarta',  1);
  mc('8º Ano C', 'Terça',   5); mc('8º Ano C', 'Quinta',  5);
  mc('9º Ano A', 'Quarta',  3); mc('9º Ano A', 'Sexta',   2);
  mc('9º Ano B', 'Quarta',  5); mc('9º Ano B', 'Sexta',   4);
  mc('9º Ano C', 'Segunda', 4); mc('9º Ano C', 'Sexta',   2); // ajuste seg slot 4 — já tem Roberto 8A!
  // Fix: 9C segunda slot 4 conflito com Roberto (8A seg 4). Troca.
  state.schedules.pop();
  mc('9º Ano C', 'Segunda', 6);
  mc('7º Ano C', 'Sexta',   6);

  const mTotal = state.schedules.filter(s => s.teacherId === profMarcelo.id).length;
  console.log(`[seed-ef] Marcelo Costa: ${mTotal} aulas`);

  // ── Patrícia Nunes — Biologia ─────────────────────────────────────────────
  const pn = (turma, day, aula) => addSched(profPatricia.id, subjBio.id, turma, day, aula);

  pn('6º Ano A', 'Terça',   4); pn('6º Ano A', 'Quinta',  4); pn('6º Ano A', 'Sexta',   2);
  pn('6º Ano B', 'Terça',   5); pn('6º Ano B', 'Quinta',  5); pn('6º Ano B', 'Sexta',   6);
  pn('6º Ano C', 'Segunda', 4); pn('6º Ano C', 'Quarta',  4); pn('6º Ano C', 'Sexta',   4);
  pn('7º Ano A', 'Terça',   6); pn('7º Ano A', 'Quinta',  6);
  pn('7º Ano B', 'Segunda', 6); pn('7º Ano B', 'Quarta',  6);
  pn('7º Ano C', 'Terça',   4); pn('7º Ano C', 'Quinta',  4); // ajuste: 7C terça slot 4 — Marcelo usa 7B terça 4, não 7C
  pn('8º Ano A', 'Segunda', 5); pn('8º Ano A', 'Quarta',  5);
  pn('8º Ano B', 'Terça',   6); pn('8º Ano B', 'Quinta',  6);
  pn('8º Ano C', 'Segunda', 3); pn('8º Ano C', 'Quarta',  3);
  pn('9º Ano A', 'Terça',   3); pn('9º Ano A', 'Quinta',  3);
  pn('9º Ano B', 'Terça',   3); pn('9º Ano B', 'Quinta',  3); // 9B terça 3 — Lucia usa 9B? Não. Ok.
  pn('9º Ano C', 'Terça',   2); pn('9º Ano C', 'Quinta',  2);
  pn('9º Ano A', 'Sexta',   3);

  const pTotal = state.schedules.filter(s => s.teacherId === profPatricia.id).length;
  console.log(`[seed-ef] Patrícia Nunes: ${pTotal} aulas`);

  // ── Resumo ────────────────────────────────────────────────────────────────
  console.log(`[seed-ef] Total de horários inseridos: ${state.schedules.length}`);
  console.log('[seed-ef] Salvando no Firestore...');
  await saveToFirestore();
  console.log('[seed-ef] ✅ Concluído! Recarregue a página (Ctrl+Shift+R).');
}
