import { useMemo, useState, type FormEvent } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { listAthletes } from '../services/athletes';
import { deleteEvent, listEvents, saveEvent } from '../services/communication';
import { listExams } from '../services/taf';
import { listLogs, listWorkouts } from '../services/training';
import { errorMessage } from '../services/db';
import { EVENT_KINDS, eventKindLabel, workoutTypeLabel } from '../utils/constants';
import { MONTHS, WEEKDAYS, addDays, formatDateBR, startOfWeek, todayISO, toISO } from '../utils/format';
import type { CalendarEvent, EventKind } from '../types';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Field } from './ui/Field';
import { Modal } from './ui/Modal';
import { Badge, ErrorBox, PageHeader, Section, Spinner } from './ui/Misc';

interface Item {
  key: string;
  kind: 'treino' | EventKind;
  title: string;
  sub?: string;
  done?: boolean;
  event?: CalendarEvent;
}

const kindStyle: Record<string, string> = {
  treino: 'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300',
  competicao: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  avaliacao: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  taf: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  evento: 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

/** Calendário mensal/semanal. Professor: filtra por atleta e gerencia eventos. Atleta: só os seus compromissos (RLS). */
export default function CalendarModule({ isProfessor }: { isProfessor: boolean }) {
  const { session } = useAuth();
  const toast = useToast();
  const [view, setView] = useState<'mes' | 'semana'>('mes');
  const [anchor, setAnchor] = useState(todayISO());
  const [athleteFilter, setAthleteFilter] = useState('');
  const [selected, setSelected] = useState(todayISO());
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);

  const [y, m] = anchor.split('-').map(Number);
  const gridStart = startOfWeek(toISO(new Date(y, m - 1, 1)));
  const gridEnd = addDays(gridStart, 41);

  const athletes = useAsync(() => (isProfessor ? listAthletes() : Promise.resolve([])), [isProfessor]);
  const { data, loading, error, reload } = useAsync(async () => {
    const [workouts, events, logs, exams] = await Promise.all([
      listWorkouts({ from: gridStart, to: gridEnd }),
      listEvents(gridStart, gridEnd),
      listLogs({ from: addDays(gridStart, -7), to: gridEnd }),
      listExams(),
    ]);
    return { workouts, events, logs, exams };
  }, [gridStart]);

  const names = useMemo(() => new Map((athletes.data ?? []).map((a) => [a.id, a.full_name])), [athletes.data]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    const push = (d: string, it: Item) => map.set(d, [...(map.get(d) ?? []), it]);
    if (!data) return map;
    const doneIds = new Set(data.logs.filter((l) => l.status !== 'nao_realizado').map((l) => l.workout_id).filter(Boolean));
    data.workouts
      .filter((w) => !athleteFilter || w.athlete_id === athleteFilter)
      .forEach((w) =>
        push(w.scheduled_date, {
          key: 'w' + w.id,
          kind: 'treino',
          title: w.name,
          sub: [isProfessor ? names.get(w.athlete_id) : null, workoutTypeLabel(w.workout_type)].filter(Boolean).join(' • '),
          done: doneIds.has(w.id),
        })
      );
    data.events
      .filter((e) => !athleteFilter || e.athlete_id === athleteFilter || e.athlete_id === null)
      .forEach((e) =>
        push(e.event_date, {
          key: 'e' + e.id,
          kind: e.kind,
          title: e.title,
          sub: [e.event_time?.slice(0, 5), e.athlete_id ? names.get(e.athlete_id) : 'Todos', e.location].filter(Boolean).join(' • '),
          event: e,
        })
      );
    data.exams.forEach((x) => x.exam_date && push(x.exam_date, { key: 'x' + x.id, kind: 'taf', title: `Prova TAF: ${x.name}`, sub: x.institution ?? undefined }));
    return map;
  }, [data, athleteFilter, names, isProfessor]);

  const days: string[] = useMemo(() => {
    const start = view === 'mes' ? gridStart : startOfWeek(anchor);
    const n = view === 'mes' ? 42 : 7;
    return Array.from({ length: n }, (_, i) => addDays(start, i));
  }, [view, gridStart, anchor]);

  function move(dir: -1 | 1) {
    if (view === 'semana') setAnchor(addDays(anchor, dir * 7));
    else setAnchor(toISO(new Date(y, m - 1 + dir, 1)));
  }

  const title = view === 'mes' ? `${MONTHS[m - 1]} de ${y}` : `Semana de ${formatDateBR(startOfWeek(anchor))}`;
  const today = todayISO();
  const dayItems = byDay.get(selected) ?? [];

  return (
    <div>
      <PageHeader
        title="Calendário"
        subtitle={isProfessor ? 'Treinos programados, competições, avaliações e testes de TAF.' : 'Seus treinos e compromissos.'}
        actions={isProfessor ? <Button onClick={() => setEditing('new')}><CalendarPlus size={16} /> Novo evento</Button> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft size={16} /></Button>
          <Button variant="secondary" size="sm" onClick={() => { setAnchor(todayISO()); setSelected(todayISO()); }}>Hoje</Button>
          <Button variant="secondary" size="sm" onClick={() => move(1)} aria-label="Próximo"><ChevronRight size={16} /></Button>
        </div>
        <h2 className="mx-2 text-lg font-bold">{title}</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          {isProfessor && (
            <select className="input w-52" value={athleteFilter} onChange={(e) => setAthleteFilter(e.target.value)} aria-label="Filtrar por atleta">
              <option value="">Todos os atletas</option>
              {(athletes.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          )}
          <div className="inline-flex overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700" role="group" aria-label="Visualização">
            {(['mes', 'semana'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={clsx('px-3 py-1.5 text-sm font-semibold', view === v ? 'bg-brand-500 text-white' : 'bg-white dark:bg-gray-900')}>
                {v === 'mes' ? 'Mês' : 'Semana'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <Spinner />}

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-950">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const items = byDay.get(d) ?? [];
            const inMonth = view === 'semana' || Number(d.split('-')[1]) === m;
            const treinos = items.filter((i) => i.kind === 'treino');
            const others = items.filter((i) => i.kind !== 'treino');
            return (
              <button
                key={d}
                onClick={() => setSelected(d)}
                aria-label={`${formatDateBR(d)}: ${items.length} item(ns)`}
                aria-pressed={selected === d}
                className={clsx(
                  'flex flex-col items-stretch gap-1 border-b border-r border-gray-100 p-1 text-left align-top dark:border-gray-800',
                  view === 'mes' ? 'min-h-[68px] sm:min-h-[96px]' : 'min-h-[160px]',
                  !inMonth && 'bg-gray-50/60 text-gray-400 dark:bg-gray-950/60',
                  selected === d && 'bg-brand-50 ring-2 ring-inset ring-brand-500 dark:bg-brand-900/20'
                )}
              >
                <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold', d === today && 'bg-brand-500 text-white')}>{Number(d.split('-')[2])}</span>
                {others.slice(0, view === 'mes' ? 2 : 6).map((i) => (
                  <span key={i.key} className={clsx('truncate rounded px-1 text-[10px] font-semibold sm:text-xs', kindStyle[i.kind])}>{i.title}</span>
                ))}
                {treinos.length > 0 && (
                  view === 'mes' ? (
                    <span className={clsx('truncate rounded px-1 text-[10px] font-semibold sm:text-xs', kindStyle.treino)}>{treinos.length} treino{treinos.length > 1 ? 's' : ''}</span>
                  ) : (
                    treinos.slice(0, 6).map((i) => <span key={i.key} className={clsx('truncate rounded px-1 text-xs font-semibold', kindStyle.treino, i.done && 'line-through opacity-70')}>{i.title}</span>)
                  )
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge tone="orange">Treino</Badge><Badge tone="red">Competição</Badge><Badge tone="blue">Avaliação</Badge><span className={clsx('rounded-full px-2 py-0.5 font-semibold', kindStyle.taf)}>TAF</span><Badge tone="gray">Evento</Badge>
      </div>

      <Section title={`Dia ${formatDateBR(selected)}`} className="mt-5">
        {dayItems.length === 0 ? (
          <p className="text-sm text-gray-500">Nada programado neste dia.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {dayItems.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    <span className={clsx('mr-2 rounded px-1.5 py-0.5 text-xs', kindStyle[i.kind])}>{i.kind === 'treino' ? 'Treino' : eventKindLabel(i.kind)}</span>
                    {i.title} {i.done && <Badge tone="green">Feito</Badge>}
                  </p>
                  {i.sub && <p className="text-sm text-gray-500">{i.sub}</p>}
                  {i.event?.notes && <p className="text-sm text-gray-500">{i.event.notes}</p>}
                </div>
                {isProfessor && i.event && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" aria-label="Editar evento" onClick={() => setEditing(i.event!)}><Pencil size={15} /></Button>
                    <Button size="sm" variant="ghost" aria-label="Excluir evento" onClick={() => setDeleting(i.event!)}><Trash2 size={15} className="text-red-600" /></Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {isProfessor && (
        <EventModal
          event={editing}
          defaultDate={selected}
          athletes={(athletes.data ?? []).map((a) => ({ id: a.id, name: a.full_name }))}
          onClose={() => setEditing(null)}
          onSave={async (input) => {
            try {
              await saveEvent(session!.user.id, input, editing && editing !== 'new' ? editing.id : undefined);
              toast.success('Evento salvo.');
              setEditing(null);
              await reload();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Excluir evento"
        message={`Excluir "${deleting?.title}"?`}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await deleteEvent(deleting!.id);
            toast.success('Evento excluído.');
            setDeleting(null);
            await reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function EventModal({
  event, defaultDate, athletes, onClose, onSave,
}: {
  event: CalendarEvent | 'new' | null;
  defaultDate: string;
  athletes: { id: string; name: string }[];
  onClose: () => void;
  onSave: (e: Omit<CalendarEvent, 'id' | 'professor_id'>) => Promise<void>;
}) {
  const ev = event && event !== 'new' ? event : null;
  // "key" no Modal interno garante estado limpo a cada abertura
  return (
    <Modal open={event !== null} title={ev ? 'Editar evento' : 'Novo evento'} onClose={onClose}>
      {event !== null && <EventForm key={ev?.id ?? 'new'} ev={ev} defaultDate={defaultDate} athletes={athletes} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function EventForm({ ev, defaultDate, athletes, onClose, onSave }: { ev: CalendarEvent | null; defaultDate: string; athletes: { id: string; name: string }[]; onClose: () => void; onSave: (e: Omit<CalendarEvent, 'id' | 'professor_id'>) => Promise<void> }) {
  const [title, setTitle] = useState(ev?.title ?? '');
  const [kind, setKind] = useState<EventKind>(ev?.kind ?? 'evento');
  const [date, setDate] = useState(ev?.event_date ?? defaultDate);
  const [time, setTime] = useState(ev?.event_time?.slice(0, 5) ?? '');
  const [athleteId, setAthleteId] = useState(ev?.athlete_id ?? '');
  const [location, setLocation] = useState(ev?.location ?? '');
  const [notes, setNotes] = useState(ev?.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) return setError('Informe o título.');
    if (!date) return setError('Informe a data.');
    setError('');
    setBusy(true);
    await onSave({ title: title.trim(), kind, event_date: date, event_time: time || null, athlete_id: athleteId || null, location: location.trim() || null, notes: notes.trim() || null });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Field label="Título"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as EventKind)}>
            {EVENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </Field>
        <Field label="Para">
          <select className="input" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            <option value="">Todos os atletas (geral)</option>
            {athletes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Data"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Horário (opcional)"><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <Field label="Local"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      <Field label="Observações"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" loading={busy}>Salvar</Button>
      </div>
    </form>
  );
}
