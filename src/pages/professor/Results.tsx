import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { listAthletes, listModalities } from '../../services/athletes';
import { deleteResult, listResults, personalBests, saveResult } from '../../services/results';
import { listLogs, listWorkouts } from '../../services/training';
import { errorMessage } from '../../services/db';
import { addDays, formatDateBR, formatDistance, formatDuration, formatPace, todayISO } from '../../utils/format';
import { logStatusLabel } from '../../utils/constants';
import type { ResultRow } from '../../types';
import ResultForm from '../../components/ResultForm';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { Badge, EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui/Misc';

export default function Results() {
  const { session } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<'provas' | 'treinos'>('treinos');
  const [athleteId, setAthleteId] = useState('');
  const [modalityId, setModalityId] = useState('');
  const from = addDays(todayISO(), -59);

  const { data, loading, error, reload } = useAsync(async () => {
    const [athletes, modalities, results, logs, workouts] = await Promise.all([
      listAthletes(), listModalities(), listResults(), listLogs({ from }), listWorkouts({ from }),
    ]);
    return { athletes, modalities, results, logs, workouts };
  }, []);
  const [editing, setEditing] = useState<ResultRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ResultRow | null>(null);

  const results = useMemo(
    () => (data?.results ?? []).filter((r) => (!athleteId || r.athlete_id === athleteId) && (!modalityId || r.modality_id === modalityId)),
    [data, athleteId, modalityId]
  );
  const logs = useMemo(() => (data?.logs ?? []).filter((l) => !athleteId || l.athlete_id === athleteId).slice(0, 100), [data, athleteId]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const aName = (id: string) => data.athletes.find((a) => a.id === id)?.full_name ?? '—';
  const mName = (id: string | null) => data.modalities.find((m) => m.id === id)?.name ?? '—';
  const bestByAthlete = new Map(data.athletes.map((a) => [a.id, personalBests(data.results.filter((r) => r.athlete_id === a.id))]));

  return (
    <div>
      <PageHeader title="Resultados" subtitle="Treinos realizados (planejado × realizado), marcas pessoais e competições."
        actions={<Button onClick={() => setEditing('new')}><Plus size={16} /> Registrar resultado</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700" role="tablist">
          {([['treinos', 'Treinos realizados'], ['provas', 'Marcas e provas']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={clsx('px-3 py-1.5 text-sm font-semibold', tab === k ? 'bg-brand-500 text-white' : 'bg-white dark:bg-gray-900')}>{l}</button>
          ))}
        </div>
        <select className="input w-52" value={athleteId} onChange={(e) => setAthleteId(e.target.value)} aria-label="Atleta">
          <option value="">Todos os atletas</option>{data.athletes.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
        {tab === 'provas' && (
          <select className="input w-52" value={modalityId} onChange={(e) => setModalityId(e.target.value)} aria-label="Modalidade">
            <option value="">Todas as modalidades</option>{data.modalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
      </div>

      {tab === 'treinos' ? (
        <div className="card overflow-x-auto">
          {logs.length === 0 ? <EmptyState title="Nenhum treino registrado" text="Os registros feitos pelos atletas nos últimos 60 dias aparecem aqui." /> : (
            <table className="w-full min-w-[760px]">
              <thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="th">Data</th><th className="th">Atleta</th><th className="th">Treino</th><th className="th">Planejado</th><th className="th">Realizado</th><th className="th">Ritmo</th><th className="th">Esforço</th><th className="th">Situação</th></tr></thead>
              <tbody>
                {logs.map((l) => {
                  const w = data.workouts.find((x) => x.id === l.workout_id);
                  return (
                    <tr key={l.id} className="border-b border-gray-100 align-top dark:border-gray-800/60">
                      <td className="td">{formatDateBR(l.log_date)}</td>
                      <td className="td font-semibold"><Link className="hover:underline" to={`/professor/atletas/${l.athlete_id}`}>{aName(l.athlete_id)}</Link></td>
                      <td className="td">{w?.name ?? <span className="text-gray-400">avulso</span>}</td>
                      <td className="td">{w ? `${formatDistance(w.distance_m)} • ${formatDuration(w.planned_time_s)}` : '—'}</td>
                      <td className="td font-semibold">{formatDistance(l.distance_m)} • {formatDuration(l.time_s)}{l.notes && <span className="block text-xs font-normal text-gray-500">“{l.notes}”</span>}</td>
                      <td className="td">{formatPace(l.avg_pace_s)}</td>
                      <td className="td">{l.rpe ? `${l.rpe}/10` : '—'}</td>
                      <td className="td"><Badge tone={l.status === 'concluido' ? 'green' : l.status === 'parcial' ? 'yellow' : 'red'}>{logStatusLabel(l.status)}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          {results.length === 0 ? <EmptyState title="Nenhum resultado" text="Registre tempos de provas, testes e competições." /> : (
            <table className="w-full min-w-[640px]">
              <thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="th">Data</th><th className="th">Atleta</th><th className="th">Prova</th><th className="th">Tempo</th><th className="th">Tipo</th><th className="th" /></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800/60">
                    <td className="td">{formatDateBR(r.result_date)}</td>
                    <td className="td font-semibold"><Link className="hover:underline" to={`/professor/atletas/${r.athlete_id}`}>{aName(r.athlete_id)}</Link></td>
                    <td className="td">{mName(r.modality_id)}</td>
                    <td className="td font-semibold">{formatDuration(r.time_s)} {r.modality_id && bestByAthlete.get(r.athlete_id)?.[r.modality_id] === r.time_s && <Badge tone="green">PB</Badge>}</td>
                    <td className="td">{r.is_competition ? r.competition_name || 'Competição' : 'Teste/treino'}</td>
                    <td className="td text-right"><Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setEditing(r)}><Pencil size={15} /></Button><Button size="sm" variant="ghost" aria-label="Excluir" onClick={() => setDeleting(r)}><Trash2 size={15} className="text-red-600" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal open={editing !== null} title={editing && editing !== 'new' ? 'Editar resultado' : 'Registrar resultado'} onClose={() => setEditing(null)}>
        {editing !== null && (
          <ResultForm key={editing === 'new' ? 'new' : editing.id} modalities={data.modalities} athletes={data.athletes} initial={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)}
            onSubmit={async (aid, input) => { await saveResult(session!.user.id, aid ?? '', input, editing !== 'new' ? editing.id : undefined); toast.success('Resultado salvo.'); setEditing(null); await reload(); }} />
        )}
      </Modal>
      <ConfirmDialog open={deleting !== null} title="Excluir resultado" message="Este resultado será removido do histórico." onClose={() => setDeleting(null)}
        onConfirm={async () => { try { await deleteResult(deleting!.id); setDeleting(null); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />
    </div>
  );
}
