import type { Workout, WorkoutLog } from '../types';
import { addDays, daysBetween, startOfWeek, todayISO, formatDateShort } from './format';

export interface PeriodStats {
  km: number;
  sessions: number;
  planned: number;
  done: number;
  completionPct: number | null;
  avgPaceS: number | null;
}

export interface WeekPoint {
  week: string;
  label: string;
  km: number;
  plannedKm: number;
  sessions: number;
}

const counted = (l: WorkoutLog) => l.status !== 'nao_realizado';

/** Aplica o filtro de modalidade: treinos da modalidade e registros ligados a eles. */
export function filterByModality(logs: WorkoutLog[], workouts: Workout[], modalityId: string) {
  if (!modalityId) return { logs, workouts };
  const ws = workouts.filter((w) => w.modality_id === modalityId);
  const ids = new Set(ws.map((w) => w.id));
  return { workouts: ws, logs: logs.filter((l) => l.workout_id && ids.has(l.workout_id)) };
}

export function periodStats(logs: WorkoutLog[], workouts: Workout[], from: string, to: string, modalityId = ''): PeriodStats {
  const f = filterByModality(logs, workouts, modalityId);
  const ls = f.logs.filter((l) => l.log_date >= from && l.log_date <= to && counted(l));
  const km = ls.reduce((s, l) => s + (l.distance_m ?? 0), 0) / 1000;

  const withBoth = ls.filter((l) => l.distance_m && l.time_s);
  const distBoth = withBoth.reduce((s, l) => s + (l.distance_m ?? 0), 0) / 1000;
  const timeBoth = withBoth.reduce((s, l) => s + (l.time_s ?? 0), 0);
  const avgPaceS = distBoth > 0 ? Math.round(timeBoth / distBoth) : null;

  const today = todayISO();
  const planned = f.workouts.filter((w) => w.scheduled_date >= from && w.scheduled_date <= to && w.scheduled_date <= today);
  const doneIds = new Set(f.logs.filter(counted).map((l) => l.workout_id).filter(Boolean) as string[]);
  const done = planned.filter((w) => doneIds.has(w.id)).length;

  return {
    km,
    sessions: ls.length,
    planned: planned.length,
    done,
    completionPct: planned.length ? Math.round((done / planned.length) * 100) : null,
    avgPaceS,
  };
}

/** Período anterior de mesma duração, imediatamente antes de [from, to]. */
export function previousPeriod(from: string, to: string): { from: string; to: string } {
  const len = daysBetween(from, to) + 1;
  return { from: addDays(from, -len), to: addDays(from, -1) };
}

export function weeklySeries(logs: WorkoutLog[], workouts: Workout[], from: string, to: string, modalityId = ''): WeekPoint[] {
  const f = filterByModality(logs, workouts, modalityId);
  const points = new Map<string, WeekPoint>();
  for (let w = startOfWeek(from); w <= to; w = addDays(w, 7)) {
    points.set(w, { week: w, label: formatDateShort(w), km: 0, plannedKm: 0, sessions: 0 });
  }
  f.logs.forEach((l) => {
    if (!counted(l) || l.log_date < from || l.log_date > to) return;
    const p = points.get(startOfWeek(l.log_date));
    if (p) {
      p.km += (l.distance_m ?? 0) / 1000;
      p.sessions += 1;
    }
  });
  f.workouts.forEach((w) => {
    if (w.scheduled_date < from || w.scheduled_date > to) return;
    const p = points.get(startOfWeek(w.scheduled_date));
    if (p) p.plannedKm += (w.distance_m ?? 0) / 1000;
  });
  return [...points.values()].map((p) => ({ ...p, km: Math.round(p.km * 100) / 100, plannedKm: Math.round(p.plannedKm * 100) / 100 }));
}
