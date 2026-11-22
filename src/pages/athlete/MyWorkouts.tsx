import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { listModalities } from '../../services/athletes';
import { listLogs, listWorkouts, saveLog } from '../../services/training';
import { addDays, formatDateBR, formatDistance, formatDuration, formatPace, startOfWeek, todayISO, weekdayOf } from '../../utils/format';
import { logStatusLabel } from '../../utils/constants';
import type { Workout, WorkoutLog } from '../../types';
import LogForm from '../../components/LogForm';
import NoAthleteRecord from '../../components/NoAthleteRecord';
import { WorkoutDetails } from '../../components/WorkoutCard';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge, EmptyState, ErrorBox, PageHeader, Section, Spinner } from '../../components/ui/Misc';
import { useMe } from './useMe';

export default function MyWorkouts() {
  const { athlete } = useMe();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(startOfWeek(todayISO()));
  const { data, loading, error, reload } = useAsync(async () => {
    if (!athlete) return null;
    const [workouts, logs, modalities, history] = await Promise.all([
      listWorkouts({ athleteId: athlete.id, from: weekStart, to: addDays(weekStart, 6) }),
      listLogs({ athleteId: athlete.id, from: weekStart, to: addDays(weekStart, 6) }),
      listModalities(),
      listLogs({ athleteId: athlete.id }),
    ]);
    return { workouts, logs, modalities, history };
  }, [athlete?.id, weekStart]);
  const [logging, setLogging] = useState<{ w: Workout; log: WorkoutLog | null } | null>(null);

  if (!athlete) return <NoAthleteRecord />;
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-5">
      <PageHeader title="Meus treinos" subtitle="Planilha da semana e histórico." />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" aria-label="Semana anterior" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft size={16} /></Button>
        <Button size="sm" variant="secondary" onClick={() => setWeekStart(startOfWeek(todayISO()))}>Esta semana</Button>
        <Button size="sm" variant="secondary" aria-label="Próxima semana" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight size={16} /></Button>
        <b className="ml-1">{formatDateBR(weekStart)} – {formatDateBR(addDays(weekStart, 6))}</b>
      </div>

      <div className="space-y-3">
        {days.map((d) => {
          const ws = data.workouts.filter((w) => w.scheduled_date === d);
          return (
            <div key={d} className="card p-4">
              <p className={`font-bold ${d === todayISO() ? 'text-brand-600' : ''}`}>{weekdayOf(d)} • {formatDateBR(d)}</p>
              {ws.length === 0 ? <p className="text-sm text-gray-400">Descanso</p> : (
                <div className="mt-2 space-y-3">
                  {ws.map((w) => {
                    const log = data.logs.find((l) => l.workout_id === w.id) ?? null;
                    return (
                      <div key={w.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{w.name}</p>
                          {log ? <Badge tone={log.status === 'concluido' ? 'green' : log.status === 'parcial' ? 'yellow' : 'red'}>{logStatusLabel(log.status)}</Badge> : d <= todayISO() ? <Badge tone="red">Sem registro</Badge> : <Badge tone="gray">Programado</Badge>}
                        </div>
                        <div className="mt-2"><WorkoutDetails w={w} modalities={data.modalities} /></div>
                        {d <= todayISO() && <Button size="sm" className="mt-3" variant={log ? 'secondary' : 'primary'} onClick={() => setLogging({ w, log })}>{log ? 'Editar registro' : 'Registrar'}</Button>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Section title="Histórico de treinos realizados">
        {data.history.length === 0 ? <EmptyState title="Nenhum treino registrado ainda" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="th">Data</th><th className="th">Distância</th><th className="th">Tempo</th><th className="th">Ritmo</th><th className="th">Esforço</th><th className="th">Situação</th></tr></thead>
              <tbody>
                {data.history.slice(0, 60).map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 dark:border-gray-800/60">
                    <td className="td">{formatDateBR(l.log_date)}</td><td className="td">{formatDistance(l.distance_m)}</td><td className="td">{formatDuration(l.time_s)}</td>
                    <td className="td">{formatPace(l.avg_pace_s)}</td><td className="td">{l.rpe ? `${l.rpe}/10` : '—'}</td>
                    <td className="td"><Badge tone={l.status === 'concluido' ? 'green' : l.status === 'parcial' ? 'yellow' : 'red'}>{logStatusLabel(l.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Modal open={logging !== null} title={logging ? `Registrar: ${logging.w.name}` : ''} onClose={() => setLogging(null)}>
        {logging && <LogForm key={logging.w.id} initial={logging.log} defaultDate={logging.w.scheduled_date} plannedDistanceM={logging.w.distance_m} onCancel={() => setLogging(null)}
          onSubmit={async (input) => { await saveLog(athlete.professor_id, athlete.id, logging.w.id, input, logging.log?.id); toast.success('Registro salvo.'); setLogging(null); await reload(); }} />}
      </Modal>
    </div>
  );
}
