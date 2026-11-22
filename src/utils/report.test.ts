import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutLog } from '../types';
import { periodStats, previousPeriod, weeklySeries } from './report';

const log = (over: Partial<WorkoutLog>): WorkoutLog => ({
  id: Math.random().toString(), professor_id: 'p', athlete_id: 'a', workout_id: null, log_date: '2026-01-05',
  distance_m: 5000, time_s: 1500, avg_pace_s: 300, rpe: 5, notes: null, status: 'concluido', ...over,
});
const wk = (over: Partial<Workout>): Workout => ({
  id: Math.random().toString(), professor_id: 'p', athlete_id: 'a', sheet_id: null, scheduled_date: '2026-01-05',
  name: 'x', modality_id: null, workout_type: 'corrida_continua', distance_m: 5000, planned_time_s: null,
  planned_pace_s: null, intensity: null, sets: null, reps: null, rest: null, warmup: null, main_part: null,
  cooldown: null, notes: null, ...over,
});

describe('relatórios', () => {
  it('soma km, sessões, ritmo médio e conclusão', () => {
    const w1 = wk({ id: 'w1', scheduled_date: '2026-01-05' });
    const w2 = wk({ id: 'w2', scheduled_date: '2026-01-06' });
    const logs = [
      log({ workout_id: 'w1', log_date: '2026-01-05' }),
      log({ workout_id: 'w2', log_date: '2026-01-06', status: 'nao_realizado', distance_m: null }),
      log({ log_date: '2026-01-07', distance_m: 10000, time_s: 3000 }),
    ];
    const s = periodStats(logs, [w1, w2], '2026-01-01', '2026-01-31');
    expect(s.km).toBe(15);
    expect(s.sessions).toBe(2);
    expect(s.planned).toBe(2);
    expect(s.done).toBe(1);
    expect(s.completionPct).toBe(50);
    expect(s.avgPaceS).toBe(300);
  });

  it('filtra por modalidade', () => {
    const w = wk({ id: 'w1', modality_id: 'm1' });
    const logs = [log({ workout_id: 'w1' }), log({ log_date: '2026-01-06' })];
    expect(periodStats(logs, [w], '2026-01-01', '2026-01-31', 'm1').sessions).toBe(1);
    expect(periodStats(logs, [w], '2026-01-01', '2026-01-31', '').sessions).toBe(2);
  });

  it('período anterior tem a mesma duração', () => {
    expect(previousPeriod('2026-02-01', '2026-02-28')).toEqual({ from: '2026-01-04', to: '2026-01-31' });
  });

  it('agrupa por semana (segunda a domingo)', () => {
    const logs = [log({ log_date: '2026-01-05' }), log({ log_date: '2026-01-11' }), log({ log_date: '2026-01-12' })];
    const s = weeklySeries(logs, [], '2026-01-05', '2026-01-18');
    expect(s).toHaveLength(2);
    expect(s[0].sessions).toBe(2);
    expect(s[1].sessions).toBe(1);
  });
});
