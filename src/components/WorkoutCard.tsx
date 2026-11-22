import type { Modality, WorkoutFields } from '../types';
import { Badge } from './ui/Misc';
import { intensityLabel, workoutTypeLabel } from '../utils/constants';
import { formatDistance, formatDuration, formatPace } from '../utils/format';

/** Detalhes de um treino planejado (usado por professor e atleta). */
export function WorkoutDetails({ w, modalities }: { w: WorkoutFields; modalities: Modality[] }) {
  const mod = modalities.find((m) => m.id === w.modality_id)?.name;
  const facts: [string, string][] = [];
  if (w.distance_m != null) facts.push(['Distância', formatDistance(w.distance_m)]);
  if (w.planned_time_s != null) facts.push(['Tempo', formatDuration(w.planned_time_s)]);
  if (w.planned_pace_s != null) facts.push(['Ritmo', formatPace(w.planned_pace_s)]);
  if (w.sets != null) facts.push(['Séries', String(w.sets)]);
  if (w.reps != null) facts.push(['Repetições', String(w.reps)]);
  if (w.rest) facts.push(['Intervalo', w.rest]);

  const blocks: [string, string | null][] = [
    ['Aquecimento', w.warmup],
    ['Parte principal', w.main_part],
    ['Desaquecimento', w.cooldown],
    ['Orientações', w.notes],
  ];

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="orange">{workoutTypeLabel(w.workout_type)}</Badge>
        {mod && <Badge tone="blue">{mod}</Badge>}
        {w.intensity && <Badge tone="gray">Intensidade: {intensityLabel(w.intensity)}</Badge>}
      </div>
      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {blocks
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k}>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{k}</p>
            <p className="whitespace-pre-line">{v}</p>
          </div>
        ))}
    </div>
  );
}
