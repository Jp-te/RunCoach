import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Trash2, ClipboardList } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { getAthlete, listCategories, listModalities, listNotes } from '../../services/athletes';
import { assignSheet, copyWeek, deleteWorkout, listLogs, listSheets, listTemplates, listWorkouts, saveTemplate, saveWorkout } from '../../services/training';
import { deleteResult, listResults, personalBests, saveResult } from '../../services/results';
import { errorMessage } from '../../services/db';
import { ageFrom, addDays, formatDateBR, formatDistance, formatDuration, formatPace, startOfWeek, todayISO, weekdayOf } from '../../utils/format';
import { experienceLabel, logStatusLabel } from '../../utils/constants';
import type { Workout, WorkoutLog, ResultRow } from '../../types';
import WorkoutForm from '../../components/WorkoutForm';
import { WorkoutDetails } from '../../components/WorkoutCard';
import ResultForm from '../../components/ResultForm';
import TafPanel from '../../components/TafPanel';
import AthleteReport from '../../components/AthleteReport';
import Conversation from '../../components/Conversation';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Badge, DemoBadge, EmptyState, ErrorBox, Section, Spinner } from '../../components/ui/Misc';

type Tab = 'treinos' | 'resultados' | 'taf' | 'relatorio' | 'mensagens';
const TABS: { id: Tab; label: string }[] = [
  { id: 'treinos', label: 'Treinos' },
  { id: 'resultados', label: 'Marcas e provas' },
  { id: 'taf', label: 'TAF' },
  { id: 'relatorio', label: 'Relatório' },
  { id: 'mensagens', label: 'Mensagens' },
];

export default function AthleteDetail() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>('treinos');
  const { data, loading, error, reload } = useAsync(async () => {
    const [athlete, categories, modalities, notes] = await Promise.all([getAthlete(id), listCategories(), listModalities(), listNotes()]);
    return { athlete, categories, modalities, notes };
  }, [id]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data?.athlete) return <ErrorBox message="Atleta não encontrado." />;
  const { athlete: a, modalities } = data;
  const professorId = session!.user.id;
  const category = data.categories.find((c) => c.id === a.category_id)?.name;

  return (
    <div>
      <Link to="/professor/atletas" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft size={16} /> Atletas
      </Link>

      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">{a.full_name}</h1>
            <p className="text-sm text-gray-500">{a.email}{a.phone ? ` • ${a.phone}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {a.is_demo && <DemoBadge />}
            <Badge tone={a.status === 'ativo' ? 'green' : 'gray'}>{a.status === 'ativo' ? 'Ativo' : 'Inativo'}</Badge>
            {category && <Badge tone="blue">{category}</Badge>}
            <Badge tone="gray">{experienceLabel(a.experience_level)}</Badge>
            {ageFrom(a.birth_date) != null && <Badge tone="gray">{ageFrom(a.birth_date)} anos</Badge>}
            <Badge tone={a.user_id ? 'green' : 'yellow'}>{a.user_id ? 'Conta ativa' : 'Aguardando 1º acesso'}</Badge>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-gray-500">Na assessoria desde</dt><dd className="font-semibold">{formatDateBR(a.start_date)}</dd></div>
          <div><dt className="text-xs text-gray-500">Modalidades</dt><dd className="font-semibold">{a.modalities.join(', ') || '—'}</dd></div>
          <div><dt className="text-xs text-gray-500">Objetivos</dt><dd>{a.goals || '—'}</dd></div>
          <div><dt className="text-xs text-gray-500">Observações privadas (só você vê)</dt><dd>{data.notes[a.id] || '—'}</dd></div>
        </dl>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={clsx('whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold', tab === t.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'treinos' && <TrainingTab athleteId={a.id} professorId={professorId} />}
      {tab === 'resultados' && <ResultsTab athleteId={a.id} professorId={professorId} />}
      {tab === 'taf' && <Section title="Preparação para TAF"><TafPanel athleteId={a.id} professorId={professorId} canEdit /></Section>}
      {tab === 'relatorio' && <AthleteReport athleteId={a.id} athleteName={a.full_name} />}
      {tab === 'mensagens' && <Section title="Comunicação com o atleta"><Conversation athleteId={a.id} professorId={professorId} isProfessor /></Section>}
      <span className="hidden">{modalities.length}</span>
    </div>
  );
}

// ---------------------------------------------------------------- Treinos
function TrainingTab({ athleteId, professorId }: { athleteId: string; professorId: string }) {
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(startOfWeek(todayISO()));
  const weekEnd = addDays(weekStart, 6);
  const { data, loading, error, reload } = useAsync(async () => {
    const [workouts, logs, modalities, templates, sheets] = await Promise.all([
      listWorkouts({ athleteId, from: addDays(weekStart, -7), to: addDays(weekStart, 14) }),
      listLogs({ athleteId, from: addDays(weekStart, -7), to: addDays(weekStart, 14) }),
      listModalities(), listTemplates(), listSheets(),
    ]);
    return { workouts, logs, modalities, templates, sheets };
  }, [athleteId, weekStart]);

  const [editing, setEditing] = useState<{ w: Workout | null; date: string } | null>(null);
  const [deleting, setDeleting] = useState<Workout | null>(null);
  const [copying, setCopying] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const logOf = (w: Workout): WorkoutLog | undefined => data.logs.find((l) => l.workout_id === w.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></Button>
        <Button size="sm" variant="secondary" onClick={() => setWeekStart(startOfWeek(todayISO()))}>Esta semana</Button>
        <Button size="sm" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Próxima semana"><ChevronRight size={16} /></Button>
        <span className="mx-1 font-bold">{formatDateBR(weekStart)} – {formatDateBR(weekEnd)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAssigning(true)}><ClipboardList size={15} /> Atribuir planilha</Button>
          <Button size="sm" variant="secondary" onClick={() => setCopying(true)}><Copy size={15} /> Copiar semana</Button>
          <Button size="sm" onClick={() => setEditing({ w: null, date: todayISO() })}><Plus size={15} /> Treino</Button>
        </div>
      </div>

      <div className="space-y-3">
        {days.map((d) => {
          const ws = data.workouts.filter((w) => w.scheduled_date === d);
          return (
            <div key={d} className="card p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <p className={clsx('font-bold', d === todayISO() && 'text-brand-600')}>{weekdayOf(d)} • {formatDateBR(d)}</p>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ w: null, date: d })} aria-label={`Adicionar treino em ${formatDateBR(d)}`}><Plus size={15} /></Button>
              </div>
              {ws.length === 0 ? <p className="text-sm text-gray-400">Descanso / sem treino</p> : (
                <ul className="mt-2 space-y-2">
                  {ws.map((w) => {
                    const log = logOf(w);
                    const isOpen = open === w.id;
                    return (
                      <li key={w.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <button className="min-w-0 text-left" onClick={() => setOpen(isOpen ? null : w.id)} aria-expanded={isOpen}>
                            <p className="font-semibold">{w.name}</p>
                            <p className="text-sm text-gray-500">Planejado: {formatDistance(w.distance_m)} • {formatDuration(w.planned_time_s)} • {formatPace(w.planned_pace_s)}</p>
                          </button>
                          <div className="flex items-center gap-1">
                            {log ? <Badge tone={log.status === 'concluido' ? 'green' : log.status === 'parcial' ? 'yellow' : 'red'}>{logStatusLabel(log.status)}</Badge> : d <= todayISO() ? <Badge tone="red">Sem registro</Badge> : <Badge tone="gray">Programado</Badge>}
                            <Button size="sm" variant="ghost" aria-label="Editar treino" onClick={() => setEditing({ w, date: d })}><Pencil size={15} /></Button>
                            <Button size="sm" variant="ghost" aria-label="Excluir treino" onClick={() => setDeleting(w)}><Trash2 size={15} className="text-red-600" /></Button>
                          </div>
                        </div>
                        {log && (
                          <div className="mt-2 rounded-lg bg-gray-50 p-2 text-sm dark:bg-gray-950">
                            <p><b>Realizado:</b> {formatDistance(log.distance_m)} • {formatDuration(log.time_s)} • {formatPace(log.avg_pace_s)}{log.rpe ? ` • esforço ${log.rpe}/10` : ''}</p>
                            {w.distance_m != null && log.distance_m != null && (
                              <p className="text-gray-500">Diferença de distância: {log.distance_m - w.distance_m >= 0 ? '+' : ''}{formatDistance(Math.abs(log.distance_m - w.distance_m)).replace(/^/, log.distance_m - w.distance_m < 0 ? '−' : '')}</p>
                            )}
                            {log.notes && <p className="text-gray-600 dark:text-gray-300">“{log.notes}”</p>}
                          </div>
                        )}
                        {isOpen && <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800"><WorkoutDetails w={w} modalities={data.modalities} /></div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={editing !== null} title={editing?.w ? 'Editar treino' : 'Novo treino'} onClose={() => setEditing(null)} wide>
        {editing && (
          <WorkoutForm
            key={editing.w?.id ?? 'new' + editing.date}
            mode="date"
            initial={editing.w ?? undefined}
            initialDate={editing.date}
            modalities={data.modalities}
            templates={data.templates}
            onCancel={() => setEditing(null)}
            onSaveTemplate={async (f) => { await saveTemplate(professorId, f); toast.success('Modelo salvo em Treinamentos.'); }}
            onSubmit={async (fields, { date }) => {
              await saveWorkout(professorId, athleteId, date, fields, editing.w?.id);
              toast.success('Treino salvo.');
              setEditing(null);
              await reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog open={deleting !== null} title="Excluir treino" message={`Excluir "${deleting?.name}" de ${formatDateBR(deleting?.scheduled_date)}? O registro de realização (se houver) também perde o vínculo.`} onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try { await deleteWorkout(deleting!.id); toast.success('Treino excluído.'); setDeleting(null); await reload(); } catch (e) { toast.error(errorMessage(e)); }
        }} />

      <CopyWeekModal open={copying} defaultFrom={weekStart} onClose={() => setCopying(false)} onCopy={async (from, to) => {
        try { const n = await copyWeek(athleteId, from, to); toast.success(`${n} treino(s) copiado(s).`); setCopying(false); await reload(); } catch (e) { toast.error(errorMessage(e)); }
      }} />

      <Modal open={assigning} title="Atribuir planilha a este atleta" onClose={() => setAssigning(false)}>
        {assigning && <AssignForm sheets={data.sheets} onCancel={() => setAssigning(false)} onAssign={async (sheetId, start) => {
          try { const n = await assignSheet(sheetId, [athleteId], start); toast.success(`${n} treino(s) criado(s).`); setAssigning(false); await reload(); } catch (e) { toast.error(errorMessage(e)); }
        }} />}
      </Modal>
    </div>
  );
}

function CopyWeekModal({ open, defaultFrom, onClose, onCopy }: { open: boolean; defaultFrom: string; onClose: () => void; onCopy: (from: string, to: string) => Promise<void> }) {
  const [to, setTo] = useState(addDays(defaultFrom, 7));
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} title="Copiar semana de treinos" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">Copia todos os treinos da semana de <b>{formatDateBR(defaultFrom)}</b> a <b>{formatDateBR(addDays(defaultFrom, 6))}</b> para a semana que começa na data abaixo.</p>
        <Field label="Início da semana de destino (segunda-feira)"><input className="input" type="date" value={to} onChange={(e) => setTo(startOfWeek(e.target.value || to))} /></Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={busy} onClick={async () => { setBusy(true); await onCopy(defaultFrom, to); setBusy(false); }}>Copiar</Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignForm({ sheets, onAssign, onCancel }: { sheets: { id: string; name: string }[]; onAssign: (sheetId: string, start: string) => Promise<void>; onCancel: () => void }) {
  const [sheetId, setSheetId] = useState('');
  const [start, setStart] = useState(startOfWeek(todayISO()));
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      {sheets.length === 0 ? <p className="text-sm text-gray-500">Crie uma planilha primeiro em “Planilhas”.</p> : (
        <>
          <Field label="Planilha"><select className="input" value={sheetId} onChange={(e) => setSheetId(e.target.value)}><option value="">— escolher —</option>{sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Data do dia 1 da planilha"><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        </>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button loading={busy} disabled={!sheetId || !start} onClick={async () => { setBusy(true); await onAssign(sheetId, start); setBusy(false); }}>Atribuir</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Resultados
function ResultsTab({ athleteId, professorId }: { athleteId: string; professorId: string }) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const [results, modalities] = await Promise.all([listResults({ athleteId }), listModalities()]);
    return { results, modalities };
  }, [athleteId]);
  const [editing, setEditing] = useState<ResultRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ResultRow | null>(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;
  const mod = (id: string | null) => data.modalities.find((m) => m.id === id)?.name ?? '—';
  const pbs = personalBests(data.results);

  return (
    <Section title="Marcas pessoais e resultados" actions={<Button size="sm" onClick={() => setEditing('new')}><Plus size={15} /> Registrar</Button>}>
      {Object.keys(pbs).length > 0 && <div className="mb-3 flex flex-wrap gap-2">{Object.entries(pbs).map(([mid, t]) => <Badge key={mid} tone="orange">PB {mod(mid)}: {formatDuration(t)}</Badge>)}</div>}
      {data.results.length === 0 ? <EmptyState title="Nenhum resultado registrado" text="Registre tempos de provas, testes e competições." /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="th">Data</th><th className="th">Prova</th><th className="th">Tempo</th><th className="th">Tipo</th><th className="th" /></tr></thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800/60">
                  <td className="td">{formatDateBR(r.result_date)}</td><td className="td">{mod(r.modality_id)}</td>
                  <td className="td font-semibold">{formatDuration(r.time_s)} {r.modality_id && pbs[r.modality_id] === r.time_s && <Badge tone="green">PB</Badge>}</td>
                  <td className="td">{r.is_competition ? r.competition_name || 'Competição' : 'Teste/treino'}</td>
                  <td className="td text-right"><Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(r)}><Pencil size={15} /></Button><Button size="sm" variant="ghost" aria-label="Excluir" onClick={() => setDeleting(r)}><Trash2 size={15} className="text-red-600" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={editing !== null} title={editing && editing !== 'new' ? 'Editar resultado' : 'Registrar resultado'} onClose={() => setEditing(null)}>
        {editing !== null && <ResultForm key={editing === 'new' ? 'new' : editing.id} modalities={data.modalities} initial={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)}
          onSubmit={async (_a, input) => { await saveResult(professorId, athleteId, input, editing !== 'new' ? editing.id : undefined); toast.success('Resultado salvo.'); setEditing(null); await reload(); }} />}
      </Modal>
      <ConfirmDialog open={deleting !== null} title="Excluir resultado" message="Este resultado será removido do histórico." onClose={() => setDeleting(null)}
        onConfirm={async () => { try { await deleteResult(deleting!.id); setDeleting(null); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />
    </Section>
  );
}
