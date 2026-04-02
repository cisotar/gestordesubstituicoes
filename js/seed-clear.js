/**
 * seed-clear.js — Limpa dados de professores, horários e ausências.
 *
 * Mantém intactos: segmentos, séries, turmas, áreas, matérias e períodos.
 *
 * Como usar no console do browser (F12):
 *   (async () => { const { runClear } = await import('/js/seed-clear.js?v=1'); await runClear(); })();
 */

import { state, saveState } from './state.js';
import { saveToFirestore }  from './db.js';

export async function runClear() {
  console.log('[clear] Iniciando limpeza...');

  const nProf  = state.teachers.length;
  const nSched = state.schedules.length;
  const nAbs   = (state.absences ?? []).length;
  const nHist  = (state.history  ?? []).length;

  state.teachers  = [];
  state.schedules = [];
  state.absences  = [];
  state.history   = [];
  state.subs      = {};

  console.log(`[clear] Removidos: ${nProf} prof · ${nSched} horários · ${nAbs} ausências · ${nHist} histórico`);
  console.log('[clear] Salvando no Firestore...');
  await saveToFirestore();
  console.log('[clear] ✅ Limpeza concluída. Recarregue a página.');
}
