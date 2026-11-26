import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { listResults } from '../services/results';
import { listLogs, listWorkouts } from '../services/training';
import { listModalities } from '../services/athletes';
import type { Modality, ResultRow, Workout, WorkoutLog } from '../types';
import { computeGame, diffSnapshot, snapshotOf, type Badge, type GameSnapshot, type GameState } from '../utils/game';
import { todayISO } from '../utils/format';

export type GameEvent =
  | { id: number; type: 'xp'; amount: number }
  | { id: number; type: 'level'; level: number; evolved: boolean }
  | { id: number; type: 'badge'; badge: Badge };

interface GameCtx {
  enabled: boolean;
  loading: boolean;
  game: GameState | null;
  workouts: Workout[];
  logs: WorkoutLog[];
  modalities: Modality[];
  /** Recarrega os dados e dispara as celebrações (XP, nível, conquistas). */
  refresh: () => Promise<void>;
  events: GameEvent[];
  dismiss: (id: number) => void;
}

const Ctx = createContext<GameCtx | null>(null);
const KEY = (athleteId: string) => `rc_game_${athleteId}`;

function readSnap(athleteId: string): GameSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY(athleteId));
    return raw ? (JSON.parse(raw) as GameSnapshot) : null;
  } catch {
    return null;
  }
}
function writeSnap(athleteId: string, s: GameSnapshot) {
  try {
    localStorage.setItem(KEY(athleteId), JSON.stringify(s));
  } catch {
    /* sem armazenamento: apenas não lembra o que já foi celebrado */
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { athlete } = useAuth();
  const enabled = !!athlete && athlete.status === 'ativo' && athlete.game_enabled !== false;
  const [data, setData] = useState<{ workouts: Workout[]; logs: WorkoutLog[]; results: ResultRow[]; modalities: Modality[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const prev = useRef<GameState | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    if (!athlete || !enabled) return;
    setLoading(true);
    try {
      const [workouts, logs, results, modalities] = await Promise.all([
        listWorkouts({ athleteId: athlete.id }), listLogs({ athleteId: athlete.id }), listResults({ athleteId: athlete.id }), listModalities(),
      ]);
      const g = computeGame({ workouts, logs, results, today: todayISO() });
      const before = prev.current;
      const stored = readSnap(athlete.id);
      const snap: GameSnapshot | null = before ? snapshotOf(before) : stored;
      const ev: GameEvent[] = [];
      if (before && g.xp > before.xp) ev.push({ id: ++seq.current, type: 'xp', amount: g.xp - before.xp });
      if (snap) {
        const d = diffSnapshot(snap, g);
        if (d.levelUp) ev.push({ id: ++seq.current, type: 'level', level: d.levelUp, evolved: g.stage.emoji !== (before ? before.stage.emoji : g.stage.emoji) });
        d.newBadges.slice(0, 4).forEach((badge) => ev.push({ id: ++seq.current, type: 'badge', badge }));
      }
      writeSnap(athlete.id, snapshotOf(g));
      prev.current = g;
      setData({ workouts, logs, results, modalities });
      if (ev.length) setEvents((e) => [...e, ...ev]);
    } finally {
      setLoading(false);
    }
  }, [athlete, enabled]);

  useEffect(() => {
    prev.current = null;
    setData(null);
    void refresh().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete?.id, enabled]);

  const game = useMemo(() => (data ? computeGame({ ...data, today: todayISO() }) : null), [data]);
  const dismiss = useCallback((id: number) => setEvents((e) => e.filter((x) => x.id !== id)), []);

  const value: GameCtx = {
    enabled, loading, game, workouts: data?.workouts ?? [], logs: data?.logs ?? [], modalities: data?.modalities ?? [], refresh, events, dismiss,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGame fora do GameProvider');
  return c;
}
/** Versão que não lança erro (usada em componentes compartilhados com o professor). */
export const useGameOptional = () => useContext(Ctx);
