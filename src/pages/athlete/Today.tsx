import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MessageSquare, Pencil, PlusCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { listModalities } from '../../services/athletes';
import { deleteLog, listLogs, listWorkouts, saveLog } from '../../services/training';
import { listMessages } from '../../services/communication';
import { useAuth } from '../../contexts/AuthContext';
import { addDays, formatDateBR, formatDistance, formatDuration, formatPace, startOfWeek, todayISO, weekdayOf } from '../../utils/format';
import { logStatusLabel } from '../../utils/constants';
import type { Workout, WorkoutLog } from '../../types';
import LogForm from '../../components/LogForm';
import NoAthleteRecord from '../../components/NoAthleteRecord';
import { WorkoutDetails } from '../../components/WorkoutCard';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { Badge, EmptyState, ErrorBox, PageHeader, Section, Spinner } from '../../components/ui/Misc';
import { errorMessage } from '../../services/db';
import { useMe } from './useMe';

export default function Today() {
  const { athlete, profile } = useMe();
  const { session } = useAuth();
  const toast = useToast();
  const today = todayISO();
  const weekStart = startOfWeek(today);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!athlete) return null;
    const [workouts, logs, modalities, messages] = await Promise.all([
      listWorkouts({ athleteId: athlete.id, from: addDays(today, -7), to: addDays(today, 7) }),
      listLogs({ athleteId: athlete.id, from: addDays(weekStart, -7) }),
      listModalities(), listMessages(athlete.id),
    ]);
    return { workouts, logs, modalities, messages };
  }, [athlete?.id]);

  const [logging, setLogging] = useState<{ w: Workout | null; log: WorkoutLog | null } | null>(null);
  const [removing, setRemoving] = useState<WorkoutLog | null>(null);

  if (!athlete) return <NoAthleteRecord />;
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const myId = session!.user.id;
  const unread = data.messages.filter((m) => m.sender_id !== myId && !m.read_at).length;
  const todays = data.workouts.filter((w) => w.scheduled_date === today);
  const overdue = data.workouts.filter((w) => w.scheduled_date < today && !data.logs.some((l) => l.workout_id === w.id));
  const upcoming = data.workouts.filter((w) => w.scheduled_date > today);
  const logOf = (w: Workout) => data.logs.find((l) => l.workout_id === w.id) ?? null;

  const weekWorkouts = data.workouts.filter((w) => w.scheduled_date >= weekStart && w.scheduled_date <= addDays(weekStart, 6));
  const weekDone = weekWorkouts.filter((w) => logOf(w) && logOf(w)!.status !== 'nao_realizado').length;
  const pct = weekWorkouts.length ? Math.round((weekDone / weekWorkouts.length) * 100) : 0;

  const card = (w: Workout, showDate = false) => {
    const log = logOf(w);
    return (
      <div key={w.id} className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold">{w.name}</p>
            {showDate && <p className="text-sm text-gray-500">{weekdayOf(w.scheduled_date)} • {formatDateBR(w.scheduled_date)}</p>}
          </div>
          {log ? <Badge tone={log.status === 'concluido' ? 'green' : log.status === 'parcial' ? 'yellow' : 'red'}>{logStatusLabel(log.status)}</Badge> : <Badge tone="orange">Pendente</Badge>}
        </div>
        <div className="mt-3"><WorkoutDetails w={w} modalities={data.modalities} /></div>
        {log ? (
          <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm dark:bg-green-950/40">
            <p className="flex items-center gap-1 font-semibold text-green-700 dark:text-green-300"><CheckCircle2 size={16} /> Seu registro</p>
            <p>{formatDistance(log.distance_m)} • {formatDuration(log.time_s)} • {formatPace(log.avg_pace_s)}{log.rpe ? ` • esforço ${log.rpe}/10` : ''}</p>
            {log.notes && <p className="text-gray-600 dark:text-gray-300">“{log.notes}”</p>}
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setLogging({ w, log })}><Pencil size={14} /> Editar</Button>
              <Button size="sm" variant="ghost" onClick={() => setRemoving(log)}>Remover registro</Button>
            </div>
          </div>
        ) : (
          <Button className="mt-3 w-full sm:w-auto" onClick={() => setLogging({ w, log: null })}><CheckCircle2 size={16} /> Registrar treino realizado</Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader title={`Olá, ${(athlete.full_name || profile?.full_name || '').split(' ')[0]}!`} subtitle={`${weekdayOf(today)}, ${formatDateBR(today)}`}
        actions={<Button variant="secondary" onClick={() => setLogging({ w: null, log: null })}><PlusCircle size={16} /> Treino avulso</Button>} />

      {unread > 0 && (
        <Link to="/atleta/mensagens" className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm font-semibold text-brand-800 dark:border-brand-900 dark:bg-brand-900/20 dark:text-brand-200">
          <MessageSquare size={18} /> Você tem {unread} mensagem(ns) nova(s) do professor.
        </Link>
      )}

      <Section title="Progresso da semana">
        <div className="flex items-center justify-between text-sm"><span>{weekDone} de {weekWorkouts.length} treinos registrados</span><b>{pct}%</b></div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da semana"><div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} /></div>
      </Section>

      <div>
        <h2 className="mb-2 text-lg font-bold">Treinos de hoje</h2>
        {todays.length === 0 ? <div className="card"><EmptyState title="Sem treino programado para hoje" text="Aproveite para descansar ou fale com seu professor." /></div> : <div className="space-y-3">{todays.map((w) => card(w))}</div>}
      </div>

      {overdue.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-bold">Pendentes (sem registro)</h2>
          <div className="space-y-3">{overdue.map((w) => card(w, true))}</div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-bold">Próximos dias</h2>
          <div className="space-y-3">{upcoming.slice(0, 5).map((w) => card(w, true))}</div>
        </div>
      )}

      <Modal open={logging !== null} title={logging?.log ? 'Editar registro' : logging?.w ? `Registrar: ${logging.w.name}` : 'Registrar treino avulso'} onClose={() => setLogging(null)}>
        {logging && (
          <LogForm key={logging.log?.id ?? logging.w?.id ?? 'avulso'} initial={logging.log} defaultDate={logging.w && logging.w.scheduled_date <= today ? logging.w.scheduled_date : today}
            plannedDistanceM={logging.w?.distance_m} onCancel={() => setLogging(null)}
            onSubmit={async (input) => {
              await saveLog(athlete.professor_id, athlete.id, logging.w?.id ?? null, input, logging.log?.id);
              toast.success('Treino registrado!');
              setLogging(null);
              await reload();
            }} />
        )}
      </Modal>

      <ConfirmDialog open={removing !== null} title="Remover registro" confirmLabel="Remover" message="O treino voltará a aparecer como pendente." onClose={() => setRemoving(null)}
        onConfirm={async () => { try { await deleteLog(removing!.id); setRemoving(null); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />
    </div>
  );
}
