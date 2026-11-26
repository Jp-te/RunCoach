import { describe, expect, it } from 'vitest';
import type { ResultRow, Workout, WorkoutLog } from '../types';
import { buildJourney, computeGame, diffSnapshot, levelFromXp, snapshotOf, stageOf, streaks, xpToReach, XP } from './game';
import { addDays } from './format';

const MON = '2026-11-02'; // segunda-feira
let seq = 0;
const w = (date: string, name = 'Treino'): Workout =>
  ({ id: `w${++seq}`, professor_id: 'p', athlete_id: 'a', sheet_id: null, scheduled_date: date, name } as unknown as Workout);
const log = (workout: Workout | null, over: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id: `l${++seq}`, professor_id: 'p', athlete_id: 'a', workout_id: workout?.id ?? null, log_date: workout?.scheduled_date ?? MON,
  distance_m: 5000, time_s: 1800, avg_pace_s: 360, rpe: null, notes: null, status: 'concluido', ...over,
});
const res = (date: string, t: number, mod = 'm1'): ResultRow =>
  ({ id: `r${++seq}`, professor_id: 'p', athlete_id: 'a', modality_id: mod, result_date: date, time_s: t, is_competition: false, competition_name: null, notes: null });

describe('níveis', () => {
  it('limiares crescentes e coerentes', () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(2)).toBe(200);
    expect(xpToReach(3)).toBe(600);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(199)).toBe(1);
    expect(levelFromXp(200)).toBe(2);
    expect(levelFromXp(599)).toBe(2);
    expect(levelFromXp(600)).toBe(3);
  });
  it('personagem evolui com o nível', () => {
    expect(stageOf(1).emoji).toBe('🐢');
    expect(stageOf(4).emoji).toBe('🐇');
    expect(stageOf(12).emoji).toBe('🔥');
  });
});

describe('XP', () => {
  const today = addDays(MON, 6);
  it('concluído = 100, + esforço e observação', () => {
    const a = w(MON);
    const g = computeGame({ workouts: [a], logs: [log(a, { rpe: 7, notes: 'Foi bem' })], results: [], today });
    expect(g.xp).toBe(XP.done + XP.rpe + XP.notes);
  });
  it('parcial vale metade; não realizado não vale nada', () => {
    const a = w(MON), b = w(addDays(MON, 1));
    const g = computeGame({ workouts: [a, b], logs: [log(a, { status: 'parcial' }), log(b, { status: 'nao_realizado' })], results: [], today });
    expect(g.xp).toBe(XP.partial);
    expect(g.totals.workouts).toBe(1);
  });
  it('avulso rende no máx. 1x por dia (anti-abuso)', () => {
    const logs = [log(null, { log_date: MON }), log(null, { log_date: MON }), log(null, { log_date: MON })];
    expect(computeGame({ workouts: [], logs, results: [], today }).xp).toBe(XP.extra);
  });
  it('simulado concluído dá bônus', () => {
    const s = w(MON, 'SIMULADO 1: 2.400m');
    const g = computeGame({ workouts: [s], logs: [log(s)], results: [], today });
    expect(g.xp).toBe(XP.done + XP.simulado);
    expect(g.totals.simulados).toBe(1);
  });
  it('primeira marca e PB', () => {
    const g = computeGame({ workouts: [], logs: [], results: [res('2026-01-01', 1000), res('2026-02-01', 990), res('2026-03-01', 1005)], today });
    expect(g.xp).toBe(XP.firstMark + XP.pb);
    expect(g.totals.pbs).toBe(1);
  });
  it('semana ≥80% e semana perfeita dão bônus', () => {
    const ws = [w(MON), w(addDays(MON, 2)), w(addDays(MON, 4))];
    const perfect = computeGame({ workouts: ws, logs: ws.map((x) => log(x)), results: [], today });
    expect(perfect.xp).toBe(3 * XP.done + XP.weekPerfect);
    const two = computeGame({ workouts: ws, logs: ws.slice(0, 2).map((x) => log(x)), results: [], today });
    expect(two.xp).toBe(2 * XP.done); // 67% não alcança 80%
  });
});

describe('sequência semanal', () => {
  const week = (i: number, planned: number, done: number) => ({ start: addDays(MON, i * 7), planned, done });
  const today = addDays(MON, 7 * 5 + 2);
  it('conta semanas seguidas ≥ 80% e a semana atual em andamento não quebra', () => {
    const ws = [week(2, 5, 5), week(3, 5, 4), week(4, 5, 5), week(5, 5, 1)]; // semana 5 = atual, ainda em andamento
    expect(streaks(ws, today).current).toBe(3);
  });
  it('perdoa 1 semana fraca (folga) mas não duas seguidas', () => {
    expect(streaks([week(1, 5, 5), week(2, 5, 0), week(3, 5, 5), week(4, 5, 5)], today).current).toBe(3);
    expect(streaks([week(1, 5, 5), week(2, 5, 0), week(3, 5, 0), week(4, 5, 5)], today).current).toBe(1);
  });
  it('semana sem treino programado é neutra', () => {
    expect(streaks([week(3, 5, 5), week(5, 5, 5)], today).current).toBe(2);
  });
  it('melhor sequência é guardada', () => {
    const s = streaks([week(0, 5, 5), week(1, 5, 5), week(2, 5, 5), week(3, 5, 0), week(4, 5, 0)], today);
    expect(s.best).toBe(3);
    expect(s.current).toBe(0);
  });
});

describe('conquistas, missões e jornada', () => {
  const today = addDays(MON, 2); // quarta
  it('desbloqueia por contagem com data e mostra progresso', () => {
    const ws = Array.from({ length: 6 }, (_, i) => w(addDays(MON, -14 + i)));
    const g = computeGame({ workouts: ws, logs: ws.map((x) => log(x)), results: [], today });
    const b5 = g.badges.find((b) => b.id === 'logs_5')!;
    expect(b5.unlocked).toBe(true);
    expect(b5.unlockedAt).toBe(ws[4].scheduled_date);
    const b10 = g.badges.find((b) => b.id === 'logs_10')!;
    expect(b10.unlocked).toBe(false);
    expect([b10.cur, b10.max]).toEqual([6, 10]);
  });
  it('missões do dia refletem registros de hoje', () => {
    const t = w(today);
    const before = computeGame({ workouts: [t], logs: [], results: [], today });
    expect(before.missions.find((m) => m.id === 'today')!.done).toBe(false);
    const after = computeGame({ workouts: [t], logs: [log(t, { rpe: 6, notes: 'ok!' })], results: [], today });
    expect(after.missions.filter((m) => ['today', 'rpe', 'notes'].includes(m.id)).every((m) => m.done)).toBe(true);
  });
  it('dia sem treino vira dia de recuperação (sem cobrar nada)', () => {
    const g = computeGame({ workouts: [w(addDays(MON, 4))], logs: [], results: [], today });
    expect(g.missions[0]).toMatchObject({ id: 'rest', done: true, xp: 0 });
  });
  it('jornada marca status de cada treino e destaca simulados', () => {
    const a = w(MON), b = w(addDays(MON, 1)), c = w(today), d = w(addDays(MON, 4), 'SIMULADO FINAL');
    const j = buildJourney([a, b, c, d], [log(a)], today);
    expect(j).toHaveLength(1);
    expect(j[0].nodes.map((n) => n.status)).toEqual(['done', 'missed', 'today', 'future']);
    expect(j[0].nodes[3].boss).toBe(true);
    expect(j[0].isCurrent).toBe(true);
  });
  it('detecta subida de nível e conquistas novas para celebrar', () => {
    const a = w(MON);
    const g0 = computeGame({ workouts: [a], logs: [], results: [], today });
    const snap = snapshotOf(g0);
    const g1 = computeGame({ workouts: [a], logs: [log(a, { rpe: 5, notes: 'bom' })], results: [], today });
    const d = diffSnapshot(snap, g1);
    expect(d.newBadges.map((b) => b.id)).toContain('first_log');
    expect(d.levelUp).toBeNull();
    const many = Array.from({ length: 3 }, (_, i) => w(addDays(MON, -7 + i)));
    const g2 = computeGame({ workouts: many, logs: many.map((x) => log(x)), results: [], today });
    expect(diffSnapshot(snap, g2).levelUp).toBe(2);
  });
});
