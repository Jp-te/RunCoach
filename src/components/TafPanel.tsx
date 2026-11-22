import { Fragment, useState, type FormEvent } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Target, Trash2, XCircle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { addTafResult, deleteTafResult, listEnrollments, listExams, listGoals, listTafResults, listTests, setGoal } from '../services/taf';
import { errorMessage } from '../services/db';
import { formatTafValue, meetsMin, parseTafValue, remainingToGoal, tafPlaceholder } from '../utils/taf';
import { formatDateBR, formatDuration, todayISO } from '../utils/format';
import type { TafTest } from '../types';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Field } from './ui/Field';
import { Modal } from './ui/Modal';
import { Badge, EmptyState, ErrorBox, Spinner } from './ui/Misc';
import { ChartBox, LineSeries } from './charts';

interface Props {
  athleteId: string;
  professorId: string;
  /** Professor pode registrar resultados e metas; atleta apenas consulta. */
  canEdit: boolean;
}

/** Painel individual de TAF: teste, índice mínimo, resultado atual, meta, diferença e histórico. */
export default function TafPanel({ athleteId, professorId, canEdit }: Props) {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    const [exams, tests, enr, goals, results] = await Promise.all([
      listExams(), listTests(), listEnrollments(), listGoals(athleteId), listTafResults(athleteId),
    ]);
    const mine = new Set(enr.filter((e) => e.athlete_id === athleteId).map((e) => e.exam_id));
    return { exams: exams.filter((x) => mine.has(x.id)), tests, goals, results };
  }, [athleteId]);

  const [open, setOpen] = useState<string | null>(null);
  const [resultFor, setResultFor] = useState<TafTest | null>(null);
  const [goalFor, setGoalFor] = useState<TafTest | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data || data.exams.length === 0)
    return (
      <EmptyState
        icon={<Target size={24} />}
        title="Nenhum concurso de TAF vinculado"
        text={canEdit ? 'Inscreva o atleta em um concurso na página "Preparação TAF".' : 'Quando o professor vincular você a um concurso, os testes aparecerão aqui.'}
      />
    );

  return (
    <div className="space-y-5">
      {data.exams.map((exam) => {
        const tests = data.tests.filter((t) => t.exam_id === exam.id);
        return (
          <div key={exam.id} className="rounded-xl border border-gray-200 dark:border-gray-800">
            <div className="border-b border-gray-200 p-4 dark:border-gray-800">
              <h3 className="font-bold">{exam.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {[exam.institution, exam.position].filter(Boolean).join(' • ') || 'Instituição/cargo não informados'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Prova: <b>{formatDateBR(exam.exam_date)}</b>
                {exam.regulation_ref && <> • Regulamento: {exam.regulation_ref}</>}
              </p>
            </div>
            {tests.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Nenhum teste configurado para este concurso.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <th className="th">Teste</th>
                      <th className="th">Índice mínimo</th>
                      <th className="th">Resultado atual</th>
                      <th className="th">Meta</th>
                      <th className="th">Diferença p/ meta</th>
                      <th className="th">Situação</th>
                      <th className="th" />
                    </tr>
                  </thead>
                  <tbody>
                    {tests.map((t) => {
                      const rs = data.results.filter((r) => r.test_id === t.id).sort((a, b) => b.result_date.localeCompare(a.result_date));
                      const current = rs[0]?.value ?? null;
                      const goal = data.goals.find((g) => g.test_id === t.id)?.goal_value ?? null;
                      const ok = meetsMin(t.better, current, t.min_value);
                      const rem = remainingToGoal(t.better, current, goal);
                      const isOpen = open === t.id;
                      return (
                        <Fragment key={t.id}>
                          <tr className="border-b border-gray-100 dark:border-gray-800/60">
                            <td className="td font-semibold">
                              {t.name}
                              <span className="block text-xs font-normal text-gray-500">{t.better === 'menor' ? 'menor é melhor' : 'maior é melhor'}{t.edital_ref ? ` • ${t.edital_ref}` : ''}</span>
                            </td>
                            <td className="td">{t.min_value != null ? formatTafValue(t.kind, t.min_value) : <span className="text-gray-400">não configurado</span>}</td>
                            <td className="td font-semibold">{formatTafValue(t.kind, current)}</td>
                            <td className="td">{goal != null ? formatTafValue(t.kind, goal) : '—'}</td>
                            <td className="td">
                              {rem == null ? '—' : rem <= 0 ? <Badge tone="green">Meta atingida</Badge> : <span>faltam {formatTafValue(t.kind, Math.round(rem * 10) / 10)}</span>}
                            </td>
                            <td className="td">
                              {ok == null ? <span className="text-gray-400">—</span> : ok ? (
                                <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={16} /> Atinge o mínimo</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-red-600"><XCircle size={16} /> Abaixo do mínimo</span>
                              )}
                            </td>
                            <td className="td">
                              <div className="flex justify-end gap-1">
                                {canEdit && <Button size="sm" variant="secondary" onClick={() => setResultFor(t)}>+ Resultado</Button>}
                                {canEdit && <Button size="sm" variant="ghost" onClick={() => setGoalFor(t)}>Meta</Button>}
                                <Button size="sm" variant="ghost" onClick={() => setOpen(isOpen ? null : t.id)} aria-label="Histórico" aria-expanded={isOpen}>
                                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="bg-gray-50 dark:bg-gray-950">
                              <td colSpan={7} className="p-4">
                                {rs.length === 0 ? (
                                  <p className="text-sm text-gray-500">Nenhuma avaliação registrada.</p>
                                ) : (
                                  <div className="grid gap-4 lg:grid-cols-2">
                                    <ul className="space-y-1 text-sm">
                                      {rs.map((r) => (
                                        <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
                                          <span>
                                            {formatDateBR(r.result_date)} — <b>{formatTafValue(t.kind, r.value)}</b>
                                            {r.notes && <span className="text-gray-500"> ({r.notes})</span>}
                                          </span>
                                          {canEdit && (
                                            <button aria-label="Excluir resultado" className="text-red-600" onClick={() => setDeleting(r.id)}>
                                              <Trash2 size={15} />
                                            </button>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                    {rs.length >= 2 && (
                                      <ChartBox title="Evolução">
                                        <LineSeries
                                          data={[...rs].reverse().map((r) => ({ d: formatDateBR(r.result_date).slice(0, 5), v: r.value }))}
                                          xKey="d"
                                          series={[{ key: 'v', name: t.name }]}
                                          formatY={(v) => formatTafValue(t.kind, v)}
                                          reversed={t.better === 'menor'}
                                        />
                                      </ChartBox>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <ResultModal
        test={resultFor}
        onClose={() => setResultFor(null)}
        onSave={async (date, value, notes) => {
          try {
            await addTafResult(professorId, resultFor!.id, athleteId, date, value, notes);
            toast.success('Resultado registrado.');
            setResultFor(null);
            await reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
      <GoalModal
        test={goalFor}
        current={goalFor ? data.goals.find((g) => g.test_id === goalFor.id)?.goal_value ?? null : null}
        onClose={() => setGoalFor(null)}
        onSave={async (value) => {
          try {
            await setGoal(professorId, goalFor!.id, athleteId, value);
            toast.success('Meta atualizada.');
            setGoalFor(null);
            await reload();
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Excluir resultado"
        message="Esta avaliação será removida do histórico."
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          try {
            await deleteTafResult(deleting!);
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

function ResultModal({ test, onClose, onSave }: { test: TafTest | null; onClose: () => void; onSave: (date: string, value: number, notes: string | null) => Promise<void> }) {
  const [date, setDate] = useState(todayISO());
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = parseTafValue(test!.kind, value);
    if (v == null) return setError('Valor inválido para este tipo de teste.');
    setBusy(true);
    await onSave(date, v, notes.trim() || null);
    setBusy(false);
    setValue('');
    setNotes('');
    setError('');
  }
  return (
    <Modal open={test !== null} title={`Registrar resultado — ${test?.name ?? ''}`} onClose={onClose}>
      {test && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Data da avaliação">
            <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Resultado" error={error}>
            <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={tafPlaceholder(test.kind)} />
          </Field>
          <Field label="Observações">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={busy}>Salvar</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function GoalModal({ test, current, onClose, onSave }: { test: TafTest | null; current: number | null; onClose: () => void; onSave: (v: number | null) => Promise<void> }) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Texto inicial editável (sem unidade) a partir da meta atual
  const initialText =
    current == null || !test ? '' : test.kind === 'tempo' ? formatDuration(current) : String(current).replace('.', ',');
  const shown = value ?? initialText;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!shown.trim()) {
      setBusy(true);
      await onSave(null);
      setBusy(false);
      setValue(null);
      return;
    }
    const v = parseTafValue(test!.kind, shown);
    if (v == null) return setError('Valor inválido para este tipo de teste.');
    setBusy(true);
    await onSave(v);
    setBusy(false);
    setValue(null);
    setError('');
  }
  return (
    <Modal open={test !== null} title={`Meta do atleta — ${test?.name ?? ''}`} onClose={onClose}>
      {test && (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Meta individual" error={error} hint="Deixe vazio para remover a meta.">
            <input className="input" value={shown} onChange={(e) => setValue(e.target.value)} placeholder={tafPlaceholder(test.kind)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={busy}>Salvar meta</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
