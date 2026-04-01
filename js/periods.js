/**
 * periods.js — Motor de geração de períodos.
 *
 * Um período é gerado a partir de uma configuração:
 *   { inicio, duracao, qtd, intervalos: [{ apos, duracao, inicio? }] }
 *
 * Um "timeSlot" é armazenado no formato "segId|turno|aulaIdx"
 * Ex: "seg-fund|manha|3" = 3ª aula do turno manhã do Ensino Fundamental.
 */

import { state } from './state.js';

// ─── Helpers de tempo ────────────────────────────────────────────────────────

export const toMin = s => {
  const [h, m] = (s || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
};

export const fromMin = m => {
  const h = Math.floor(Math.abs(m) / 60) % 24;
  const min = Math.abs(m) % 60;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
};

// ─── Geração de períodos ──────────────────────────────────────────────────────

/**
 * Gera a sequência de períodos (aulas + intervalos) a partir de uma config.
 * @returns {Array<{ aulaIdx, label, inicio, fim, isIntervalo }>}
 */
export function gerarPeriodos(cfg) {
  if (!cfg) return [];
  const { inicio = '07:00', duracao = 50, qtd = 5, intervalos = [] } = cfg;
  let minutos = toMin(inicio);
  const result = [];

  for (let i = 1; i <= qtd; i++) {
    const ini = fromMin(minutos);
    const fim = fromMin(minutos + duracao);
    result.push({ aulaIdx: i, label: `${i}ª Aula`, inicio: ini, fim, isIntervalo: false });
    minutos += duracao;

    // Insere intervalo(s) após esta aula
    intervalos.filter(iv => iv.apos === i).forEach(iv => {
      const ivIni = iv.inicio || fromMin(minutos);
      const ivMin = toMin(ivIni);
      const ivDur = iv.duracao || 20;
      const ivFim = fromMin(ivMin + ivDur);
      result.push({
        aulaIdx:     null,
        label:       'Intervalo',
        inicio:      ivIni,
        fim:         ivFim,
        isIntervalo: true,
        duracao:     ivDur,
      });
      minutos = ivMin + ivDur;
    });
  }

  return result;
}

/** Configuração padrão para um turno */
export function defaultCfg(turno = 'manha') {
  return {
    inicio:     turno === 'tarde' ? '13:00' : '07:00',
    duracao:    50,
    qtd:        5,
    intervalos: [{ apos: 3, duracao: 20 }],
  };
}

// ─── Acesso via state ─────────────────────────────────────────────────────────

/** Retorna a config de um segmento/turno, com fallback para o padrão */
export function getCfg(segmentId, turno) {
  return state.periodConfigs?.[segmentId]?.[turno] ?? defaultCfg(turno);
}

/**
 * Retorna os períodos gerados para um segmento/turno.
 * Inclui intervalos (isIntervalo=true) para exibição na grade.
 */
export function getPeriodos(segmentId, turno) {
  return gerarPeriodos(getCfg(segmentId, turno));
}

/**
 * Retorna apenas as aulas (sem intervalos) de um segmento/turno.
 */
export function getAulas(segmentId, turno) {
  return getPeriodos(segmentId, turno).filter(p => !p.isIntervalo);
}

// ─── Resolução de timeSlot ────────────────────────────────────────────────────

/**
 * Parseia "seg-fund|manha|3" → { segmentId, turno, aulaIdx }
 */
export function parseSlot(timeSlot) {
  if (!timeSlot) return null;
  const parts = timeSlot.split('|');
  if (parts.length < 3) return null;
  return { segmentId: parts[0], turno: parts[1], aulaIdx: Number(parts[2]) };
}

/** Monta um timeSlot string */
export const makeSlot = (segId, turno, aulaIdx) => `${segId}|${turno}|${aulaIdx}`;

/**
 * Resolve um timeSlot → período { aulaIdx, label, inicio, fim }.
 * Retorna null se não encontrado.
 */
export function resolveSlot(timeSlot) {
  const parsed = parseSlot(timeSlot);
  if (!parsed) return null;
  const { segmentId, turno, aulaIdx } = parsed;
  return getAulas(segmentId, turno).find(p => p.aulaIdx === aulaIdx) ?? null;
}

/** "seg-fund|manha|3" → "3ª Aula" */
export function slotLabel(timeSlot) {
  const p = resolveSlot(timeSlot);
  return p ? p.label : (timeSlot ?? '—');
}

/** "seg-fund|manha|3" → "09:40–10:30" */
export function slotTimeRange(timeSlot) {
  const p = resolveSlot(timeSlot);
  return p ? `${p.inicio}–${p.fim}` : '';
}

/** "seg-fund|manha|3" → "3ª Aula (09:40–10:30)" */
export function slotFullLabel(timeSlot) {
  const p = resolveSlot(timeSlot);
  if (!p) return timeSlot ?? '—';
  return `${p.label} (${p.inicio}–${p.fim})`;
}

/**
 * Retorna todos os timeSlots únicos usados nas schedules,
 * ordenados cronologicamente por horário de início.
 */
export function allUsedSlots() {
  const seen = new Set(state.schedules.map(s => s.timeSlot).filter(Boolean));
  return [...seen].sort((a, b) => {
    const pa = resolveSlot(a), pb = resolveSlot(b);
    if (!pa || !pb) return 0;
    return toMin(pa.inicio) - toMin(pb.inicio);
  });
}

/**
 * Gera os timeSlots disponíveis para uma turma específica.
 * turma = { segmentId, turno }
 */
export function slotsForTurma(segmentId, turno) {
  return getAulas(segmentId, turno).map(p => makeSlot(segmentId, turno, p.aulaIdx));
}
