import type { TafKind, TafTest } from '../types';
import { formatDuration, parseDuration } from './format';

export function parseTafValue(kind: TafKind, input: string): number | null {
  if (kind === 'tempo') return parseDuration(input);
  const n = Number(input.trim().replace(',', '.'));
  if (!input.trim() || Number.isNaN(n) || n < 0) return null;
  return kind === 'repeticoes' ? (Number.isInteger(n) ? n : null) : n;
}

export function formatTafValue(kind: TafKind, value: number | null | undefined): string {
  if (value == null) return '—';
  if (kind === 'tempo') return formatDuration(value);
  if (kind === 'distancia') return `${value.toLocaleString('pt-BR')} m`;
  return `${value} rep.`;
}

export function tafPlaceholder(kind: TafKind): string {
  return kind === 'tempo' ? 'mm:ss (ex.: 12:30 ou 7,5)' : kind === 'distancia' ? 'metros (ex.: 2600)' : 'repetições (ex.: 25)';
}

/** O valor atinge o índice mínimo? (índice configurado pelo professor, conforme o edital) */
export function meetsMin(better: TafTest['better'], value: number | null, min: number | null): boolean | null {
  if (value == null || min == null) return null;
  return better === 'menor' ? value <= min : value >= min;
}

/**
 * Quanto falta para a meta. > 0: ainda falta melhorar essa quantidade; <= 0: meta atingida.
 * Para "menor é melhor" (tempo): atual - meta. Para "maior é melhor": meta - atual.
 */
export function remainingToGoal(better: TafTest['better'], current: number | null, goal: number | null): number | null {
  if (current == null || goal == null) return null;
  return better === 'menor' ? current - goal : goal - current;
}

/** Presets só de nome/tipo — NENHUM índice é pré-definido. */
export const TAF_PRESETS: { name: string; kind: TafKind; better: 'menor' | 'maior' }[] = [
  { name: 'Corrida de 12 minutos', kind: 'distancia', better: 'maior' },
  { name: 'Corrida de 2.400 metros', kind: 'tempo', better: 'menor' },
  { name: 'Corrida de 2.000 metros', kind: 'tempo', better: 'menor' },
  { name: 'Corrida de 50 metros', kind: 'tempo', better: 'menor' },
  { name: 'Corrida de 100 metros', kind: 'tempo', better: 'menor' },
  { name: 'Flexão de braço', kind: 'repeticoes', better: 'maior' },
  { name: 'Abdominal', kind: 'repeticoes', better: 'maior' },
  { name: 'Barra fixa', kind: 'repeticoes', better: 'maior' },
];
