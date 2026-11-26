import type { ResultRow, Workout, WorkoutLog } from '../types';
import { addDays, startOfWeek } from './format';

/* =====================================================================
 * Gamificação do RunCoach — tudo é CALCULADO a partir dos registros reais
 * (treinos, registros de treino, marcas). Nada é digitado à mão: o atleta
 * não consegue "dar XP" a si mesmo além do que registrar de verdade.
 *
 * Regras de XP (as mesmas são mostradas ao atleta no app):
 *   treino concluído ........ +100     parcial ........ +50
 *   treino avulso ........... +60 (no máx. 1 por dia, contra abuso)
 *   informar esforço (1–10) . +10      escrever observação ... +10
 *   simulado concluído ...... +150 extra
 *   primeira marca numa prova +30      recorde pessoal (PB) .. +80
 *   semana com ≥ 80% feita .. +150     semana 100% ........... +250
 * ===================================================================== */

export const XP = {
  done: 100, partial: 50, extra: 60, rpe: 10, notes: 10, simulado: 150,
  firstMark: 30, pb: 80, weekOk: 150, weekPerfect: 250,
} as const;

export const WEEK_OK_PCT = 0.8;
const isDone = (l: WorkoutLog) => l.status === 'concluido' || l.status === 'parcial';
export const isSimulado = (name: string) => /simulado/i.test(name);

// ---------- níveis ----------
/** XP total necessário para ALCANÇAR o nível n (nível 1 = 0). */
export const xpToReach = (n: number) => (200 * (n - 1) * n) / 2;
export function levelFromXp(xp: number): number {
  let n = 1;
  while (xpToReach(n + 1) <= xp) n++;
  return n;
}

export interface Stage {
  emoji: string;
  name: string; // personagem
  title: string; // título do nível
  from: string; // gradiente (classes tailwind)
}
const STAGES: { minLevel: number; stage: Stage }[] = [
  { minLevel: 1, stage: { emoji: '🐢', name: 'Tartaruga', title: 'Aquecendo', from: 'from-emerald-400 to-teal-500' } },
  { minLevel: 3, stage: { emoji: '🐇', name: 'Coelho', title: 'Ganhando ritmo', from: 'from-sky-400 to-blue-500' } },
  { minLevel: 5, stage: { emoji: '🦊', name: 'Raposa', title: 'Corredor ágil', from: 'from-orange-400 to-rose-500' } },
  { minLevel: 7, stage: { emoji: '🐆', name: 'Guepardo', title: 'Velocista', from: 'from-amber-400 to-orange-600' } },
  { minLevel: 9, stage: { emoji: '🦅', name: 'Águia', title: 'Atleta de elite', from: 'from-indigo-400 to-violet-600' } },
  { minLevel: 11, stage: { emoji: '🔥', name: 'Fênix', title: 'Lenda', from: 'from-red-500 to-amber-500' } },
];
export const stageOf = (level: number): Stage => [...STAGES].reverse().find((s) => level >= s.minLevel)!.stage;
export const nextStageLevel = (level: number): number | null => STAGES.find((s) => s.minLevel > level)?.minLevel ?? null;

// ---------- tipos ----------
export interface GameInput {
  workouts: Workout[];
  logs: WorkoutLog[];
  results: ResultRow[];
  today: string;
}

export type BadgeTier = 'bronze' | 'prata' | 'ouro';
export interface Badge {
  id: string;
  title: string;
  desc: string;
  icon: 'foot' | 'flame' | 'trophy' | 'star' | 'bolt' | 'medal' | 'route' | 'chat' | 'crown';
  tier: BadgeTier;
  unlocked: boolean;
  cur: number;
  max: number;
  unlockedAt: string | null;
}

export interface Mission {
  id: string;
  title: string;
  desc: string;
  xp: number;
  done: boolean;
  progress?: string;
}

export type NodeStatus = 'done' | 'partial' | 'missed' | 'today' | 'future';
export interface JourneyNode {
  workout: Workout;
  status: NodeStatus;
  boss: boolean;
  log: WorkoutLog | null;
}
export interface JourneyWeek {
  number: number;
  weekStart: string;
  nodes: JourneyNode[];
  planned: number;
  done: number;
  ok: boolean;
  isCurrent: boolean;
}

export interface GameState {
  xp: number;
  level: number;
  xpInLevel: number;
  xpForNext: number;
  levelPct: number;
  stage: Stage;
  streak: { current: number; best: number };
  week: { planned: number; done: number; pct: number; ok: boolean };
  missions: Mission[];
  badges: Badge[];
  totals: { workouts: number; km: number; pbs: number; simulados: number };
  journey: JourneyWeek[];
}

// ---------- semanas ----------
interface WeekAgg {
  start: string;
  planned: number;
  done: number;
}
function weekAggregates(workouts: Workout[], logs: WorkoutLog[]): WeekAgg[] {
  const byWorkout = new Map(logs.filter((l) => l.workout_id).map((l) => [l.workout_id!, l]));
  const map = new Map<string, WeekAgg>();
  for (const w of workouts) {
    const start = startOfWeek(w.scheduled_date);
    const a = map.get(start) ?? { start, planned: 0, done: 0 };
    a.planned++;
    const l = byWorkout.get(w.id);
    if (l && isDone(l)) a.done++;
    map.set(start, a);
  }
  return [...map.values()].sort((a, b) => a.start.localeCompare(b.start));
}
const weekOk = (a: WeekAgg) => a.planned > 0 && a.done / a.planned >= WEEK_OK_PCT;

/**
 * Sequência de semanas. Semana sem treino programado é neutra; a semana atual em andamento nunca
 * quebra a sequência; e 1 semana "fraca" é perdoada a cada 5 (folga) para não punir imprevistos.
 */
export function streaks(weeks: WeekAgg[], today: string): { current: number; best: number } {
  const currentStart = startOfWeek(today);
  // melhor sequência (varredura cronológica)
  let best = 0, run = 0, sinceForgive = 99;
  for (const w of weeks) {
    if (w.start === currentStart && !weekOk(w)) continue;
    if (weekOk(w)) { run++; sinceForgive++; best = Math.max(best, run); }
    else if (sinceForgive >= 5) { sinceForgive = 0; }
    else { run = 0; sinceForgive++; }
  }
  // sequência atual (varredura do mais recente para o mais antigo)
  let current = 0, lastForgive = -99;
  const desc = [...weeks].reverse();
  for (let i = 0; i < desc.length; i++) {
    const w = desc[i];
    if (w.start === currentStart && !weekOk(w)) continue;
    if (weekOk(w)) current++;
    else if (i - lastForgive > 4) lastForgive = i;
    else break;
  }
  return { current, best: Math.max(best, current) };
}

// ---------- cálculo principal ----------
export function computeGame({ workouts, logs, results, today }: GameInput): GameState {
  const wById = new Map(workouts.map((w) => [w.id, w]));
  const doneLogs = logs.filter(isDone);

  // XP por registros
  let xp = 0;
  const avulsoDays = new Set<string>();
  let simulados = 0;
  for (const l of doneLogs) {
    const w = l.workout_id ? wById.get(l.workout_id) : undefined;
    if (l.workout_id) xp += l.status === 'concluido' ? XP.done : XP.partial;
    else if (!avulsoDays.has(l.log_date)) { avulsoDays.add(l.log_date); xp += XP.extra; }
    if (l.rpe) xp += XP.rpe;
    if ((l.notes ?? '').trim().length >= 3) xp += XP.notes;
    if (w && isSimulado(w.name) && l.status === 'concluido') { xp += XP.simulado; simulados++; }
  }

  // marcas / PBs
  let pbs = 0;
  const bestBy = new Map<string, number>();
  const pbDates: string[] = [];
  for (const r of [...results].sort((a, b) => a.result_date.localeCompare(b.result_date))) {
    if (!r.modality_id) continue;
    const prev = bestBy.get(r.modality_id);
    if (prev == null) xp += XP.firstMark;
    else if (r.time_s < prev) { xp += XP.pb; pbs++; pbDates.push(r.result_date); }
    if (prev == null || r.time_s < prev) bestBy.set(r.modality_id, r.time_s);
  }

  // semanas
  const weeks = weekAggregates(workouts, logs);
  for (const w of weeks) {
    if (w.planned >= 2 && w.done === w.planned) xp += XP.weekPerfect;
    else if (w.planned >= 2 && weekOk(w)) xp += XP.weekOk;
  }
  const st = streaks(weeks, today);
  const curStart = startOfWeek(today);
  const cw = weeks.find((w) => w.start === curStart) ?? { start: curStart, planned: 0, done: 0 };

  // nível
  const level = levelFromXp(xp);
  const base = xpToReach(level);
  const next = xpToReach(level + 1);

  // totais
  const km = doneLogs.reduce((s, l) => s + (l.distance_m ?? 0), 0) / 1000;
  const feedbackLogs = doneLogs.filter((l) => l.rpe && (l.notes ?? '').trim().length >= 3).length;
  const sortedDates = doneLogs.map((l) => l.log_date).sort();
  const nth = (n: number) => (sortedDates.length >= n ? sortedDates[n - 1] : null);
  const perfectWeek = weeks.some((w) => w.planned >= 3 && w.done === w.planned);

  const mk = (b: Omit<Badge, 'unlocked' | 'unlockedAt'> & { at?: string | null }): Badge => ({
    ...b, unlocked: b.cur >= b.max, unlockedAt: b.cur >= b.max ? b.at ?? null : null,
  });
  const n = doneLogs.length;
  let kmAcc = 0;
  const kmDate = (target: number) => {
    kmAcc = 0;
    for (const l of [...doneLogs].sort((a, b) => a.log_date.localeCompare(b.log_date))) {
      kmAcc += (l.distance_m ?? 0) / 1000;
      if (kmAcc >= target) return l.log_date;
    }
    return null;
  };
  const badges: Badge[] = [
    mk({ id: 'first_log', title: 'Primeiro passo', desc: 'Registre seu 1º treino', icon: 'foot', tier: 'bronze', cur: n, max: 1, at: nth(1) }),
    mk({ id: 'logs_5', title: 'Pegando o jeito', desc: 'Registre 5 treinos', icon: 'foot', tier: 'bronze', cur: n, max: 5, at: nth(5) }),
    mk({ id: 'logs_10', title: 'Dez e contando', desc: 'Registre 10 treinos', icon: 'foot', tier: 'prata', cur: n, max: 10, at: nth(10) }),
    mk({ id: 'logs_25', title: 'Constante', desc: 'Registre 25 treinos', icon: 'medal', tier: 'prata', cur: n, max: 25, at: nth(25) }),
    mk({ id: 'logs_50', title: 'Cinquentão', desc: 'Registre 50 treinos', icon: 'medal', tier: 'ouro', cur: n, max: 50, at: nth(50) }),
    mk({ id: 'streak_2', title: 'Duas semanas firmes', desc: '2 semanas seguidas com ≥ 80% dos treinos', icon: 'flame', tier: 'bronze', cur: st.best, max: 2 }),
    mk({ id: 'streak_4', title: 'Mês de ferro', desc: '4 semanas seguidas', icon: 'flame', tier: 'prata', cur: st.best, max: 4 }),
    mk({ id: 'streak_8', title: 'Imparável', desc: '8 semanas seguidas', icon: 'flame', tier: 'ouro', cur: st.best, max: 8 }),
    mk({ id: 'streak_12', title: 'Ciclo completo', desc: '12 semanas seguidas', icon: 'crown', tier: 'ouro', cur: st.best, max: 12 }),
    mk({ id: 'perfect_week', title: 'Semana perfeita', desc: '100% dos treinos de uma semana (mín. 3)', icon: 'star', tier: 'prata', cur: perfectWeek ? 1 : 0, max: 1 }),
    mk({ id: 'first_pb', title: 'Recorde pessoal', desc: 'Bata uma marca pessoal (PB)', icon: 'bolt', tier: 'bronze', cur: pbs, max: 1, at: pbDates[0] ?? null }),
    mk({ id: 'pb_3', title: 'Quebrador de marcas', desc: '3 recordes pessoais', icon: 'bolt', tier: 'prata', cur: pbs, max: 3, at: pbDates[2] ?? null }),
    mk({ id: 'simulado_1', title: 'Simulado vencido', desc: 'Conclua um simulado', icon: 'trophy', tier: 'prata', cur: simulados, max: 1 }),
    mk({ id: 'simulado_3', title: 'Veterano de simulados', desc: 'Conclua 3 simulados', icon: 'trophy', tier: 'ouro', cur: simulados, max: 3 }),
    mk({ id: 'feedback_10', title: 'Atleta comunicativo', desc: '10 treinos com esforço e observação', icon: 'chat', tier: 'bronze', cur: feedbackLogs, max: 10 }),
    mk({ id: 'km_50', title: '50 km', desc: 'Acumule 50 km registrados', icon: 'route', tier: 'bronze', cur: Math.floor(km), max: 50, at: kmDate(50) }),
    mk({ id: 'km_100', title: '100 km', desc: 'Acumule 100 km registrados', icon: 'route', tier: 'prata', cur: Math.floor(km), max: 100, at: kmDate(100) }),
    mk({ id: 'km_200', title: '200 km', desc: 'Acumule 200 km registrados', icon: 'route', tier: 'ouro', cur: Math.floor(km), max: 200, at: kmDate(200) }),
    mk({ id: 'level_5', title: 'Nível 5', desc: 'Chegue ao nível 5', icon: 'crown', tier: 'prata', cur: level, max: 5 }),
  ];

  // missões de hoje
  const todays = workouts.filter((w) => w.scheduled_date === today);
  const todayLogs = logs.filter((l) => l.log_date === today && isDone(l));
  const todayDone = todays.filter((w) => logs.some((l) => l.workout_id === w.id && isDone(l))).length;
  const missions: Mission[] = [];
  if (todays.length) {
    missions.push({
      id: 'today', title: todays.length > 1 ? 'Treinos de hoje' : 'Treino de hoje', desc: todays.map((w) => w.name).join(' • '),
      xp: XP.done * todays.length, done: todayDone === todays.length, progress: `${todayDone}/${todays.length}`,
    });
  } else {
    missions.push({ id: 'rest', title: 'Dia de recuperação', desc: 'Sem treino hoje: descanse, hidrate-se e durma bem.', xp: 0, done: true });
  }
  missions.push({ id: 'rpe', title: 'Conte o esforço', desc: 'Informe o esforço (1–10) no treino de hoje', xp: XP.rpe, done: todayLogs.some((l) => !!l.rpe) });
  missions.push({ id: 'notes', title: 'Deixe uma observação', desc: 'Escreva como foi o treino', xp: XP.notes, done: todayLogs.some((l) => (l.notes ?? '').trim().length >= 3) });
  const need = Math.ceil(cw.planned * WEEK_OK_PCT);
  if (cw.planned) missions.push({ id: 'week', title: 'Meta da semana', desc: `Faça ${need} de ${cw.planned} treinos (80%)`, xp: XP.weekOk, done: cw.done >= need, progress: `${Math.min(cw.done, need)}/${need}` });

  return {
    xp, level, xpInLevel: xp - base, xpForNext: next - base, levelPct: Math.round(((xp - base) / (next - base)) * 100),
    stage: stageOf(level), streak: st,
    week: { planned: cw.planned, done: cw.done, pct: cw.planned ? Math.round((cw.done / cw.planned) * 100) : 0, ok: weekOk(cw) },
    missions, badges, totals: { workouts: n, km: Math.round(km * 10) / 10, pbs, simulados },
    journey: buildJourney(workouts, logs, today),
  };
}

// ---------- jornada (mapa de fases) ----------
export function buildJourney(workouts: Workout[], logs: WorkoutLog[], today: string): JourneyWeek[] {
  if (!workouts.length) return [];
  const byWorkout = new Map(logs.filter((l) => l.workout_id).map((l) => [l.workout_id!, l]));
  const sorted = [...workouts].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date) || a.name.localeCompare(b.name));
  const groups = new Map<string, JourneyNode[]>();
  for (const w of sorted) {
    const log = byWorkout.get(w.id) ?? null;
    let status: NodeStatus;
    if (log && log.status === 'concluido') status = 'done';
    else if (log && log.status === 'parcial') status = 'partial';
    else if (w.scheduled_date === today) status = 'today';
    else if (w.scheduled_date < today) status = 'missed';
    else status = 'future';
    const key = startOfWeek(w.scheduled_date);
    groups.set(key, [...(groups.get(key) ?? []), { workout: w, status, boss: isSimulado(w.name), log }]);
  }
  const cur = startOfWeek(today);
  return [...groups.entries()].map(([weekStart, nodes], i) => {
    const done = nodes.filter((x) => x.status === 'done' || x.status === 'partial').length;
    return { number: i + 1, weekStart, nodes, planned: nodes.length, done, ok: done / nodes.length >= WEEK_OK_PCT, isCurrent: weekStart === cur };
  });
}

// ---------- eventos de celebração ----------
export interface GameSnapshot {
  level: number;
  badges: string[];
}
export const snapshotOf = (g: GameState): GameSnapshot => ({ level: g.level, badges: g.badges.filter((b) => b.unlocked).map((b) => b.id) });

export function diffSnapshot(prev: GameSnapshot, g: GameState) {
  return {
    levelUp: g.level > prev.level ? g.level : null,
    newBadges: g.badges.filter((b) => b.unlocked && !prev.badges.includes(b.id)),
  };
}

export { addDays };
