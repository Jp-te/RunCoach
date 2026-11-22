import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { listAthletes } from '../../services/athletes';
import { deleteTest, getExam, listEnrollments, listTests, saveExam, saveTest, setEnrollments } from '../../services/taf';
import { errorMessage } from '../../services/db';
import { TAF_PRESETS, formatTafValue, parseTafValue, tafPlaceholder } from '../../utils/taf';
import { formatDuration } from '../../utils/format';
import type { TafKind, TafTest } from '../../types';
import TafPanel from '../../components/TafPanel';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Badge, ErrorBox, Section, Spinner } from '../../components/ui/Misc';

export default function TafExamPage() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const toast = useToast();
  const professorId = session!.user.id;
  const { data, loading, error, reload } = useAsync(async () => {
    const [exam, tests, enr, athletes] = await Promise.all([getExam(id), listTests(id), listEnrollments(id), listAthletes()]);
    return { exam, tests, enr, athletes };
  }, [id]);

  const [meta, setMeta] = useState<Record<string, string> | null>(null);
  const [editingTest, setEditingTest] = useState<TafTest | 'new' | null>(null);
  const [deletingTest, setDeletingTest] = useState<TafTest | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [panelAthlete, setPanelAthlete] = useState('');

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data?.exam) return <ErrorBox message="Concurso não encontrado." />;
  const { exam, tests, enr, athletes } = data;
  const enrolled = athletes.filter((a) => enr.some((e) => e.athlete_id === a.id));
  const m = meta ?? { name: exam.name, institution: exam.institution ?? '', position: exam.position ?? '', date: exam.exam_date ?? '', reg: exam.regulation_ref ?? '', notes: exam.notes ?? '' };

  async function saveMeta() {
    if (m.name.trim().length < 3) return toast.error('Informe o nome do concurso.');
    try {
      await saveExam(professorId, { name: m.name.trim(), institution: m.institution.trim() || null, position: m.position.trim() || null, exam_date: m.date || null, regulation_ref: m.reg.trim() || null, notes: m.notes.trim() || null }, id);
      toast.success('Concurso atualizado.');
      setMeta(null);
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div>
      <Link to="/professor/taf" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft size={16} /> Preparação TAF</Link>

      <Section title="Dados do concurso" className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome do concurso" className="sm:col-span-2"><input className="input" value={m.name} onChange={(e) => setMeta({ ...m, name: e.target.value })} /></Field>
          <Field label="Instituição"><input className="input" value={m.institution} onChange={(e) => setMeta({ ...m, institution: e.target.value })} /></Field>
          <Field label="Cargo"><input className="input" value={m.position} onChange={(e) => setMeta({ ...m, position: e.target.value })} /></Field>
          <Field label="Data da prova"><input className="input" type="date" value={m.date} onChange={(e) => setMeta({ ...m, date: e.target.value })} /></Field>
          <Field label="Regulamento / edital utilizado"><input className="input" value={m.reg} onChange={(e) => setMeta({ ...m, reg: e.target.value })} /></Field>
          <Field label="Observações" className="sm:col-span-2"><textarea className="input" rows={2} value={m.notes} onChange={(e) => setMeta({ ...m, notes: e.target.value })} /></Field>
        </div>
        {meta && <div className="mt-3 flex gap-2"><Button size="sm" onClick={saveMeta}>Salvar alterações</Button><Button size="sm" variant="secondary" onClick={() => setMeta(null)}>Descartar</Button></div>}
      </Section>

      <Section title="Testes exigidos e índices mínimos" className="mb-5" actions={<Button size="sm" onClick={() => setEditingTest('new')}><Plus size={14} /> Teste</Button>}>
        {tests.length === 0 ? <p className="text-sm text-gray-500">Nenhum teste configurado. Adicione os testes exigidos pelo edital.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="th">Teste</th><th className="th">Tipo</th><th className="th">Índice mínimo</th><th className="th">Referência no edital</th><th className="th" /></tr></thead>
              <tbody>
                {tests.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 dark:border-gray-800/60">
                    <td className="td font-semibold">{t.name}</td>
                    <td className="td">{t.kind === 'tempo' ? 'Tempo' : t.kind === 'distancia' ? 'Distância' : 'Repetições'} <span className="text-xs text-gray-500">({t.better === 'menor' ? 'menor é melhor' : 'maior é melhor'})</span></td>
                    <td className="td">{t.min_value != null ? formatTafValue(t.kind, t.min_value) : <Badge tone="yellow">não configurado</Badge>}</td>
                    <td className="td">{t.edital_ref || '—'}</td>
                    <td className="td text-right"><Button size="sm" variant="ghost" aria-label="Editar teste" onClick={() => setEditingTest(t)}><Pencil size={15} /></Button><Button size="sm" variant="ghost" aria-label="Excluir teste" onClick={() => setDeletingTest(t)}><Trash2 size={15} className="text-red-600" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Atletas inscritos" className="mb-5" actions={<Button size="sm" onClick={() => setEnrolling(true)}>Gerenciar inscritos</Button>}>
        {enrolled.length === 0 ? <p className="text-sm text-gray-500">Nenhum atleta inscrito neste concurso.</p> : (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {enrolled.map((a) => (
                <button key={a.id} onClick={() => setPanelAthlete(a.id)} className={`rounded-full border px-3 py-1 text-sm ${panelAthlete === a.id ? 'border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'border-gray-300 dark:border-gray-700'}`}>{a.full_name}</button>
              ))}
            </div>
            {panelAthlete ? <TafPanel key={panelAthlete} athleteId={panelAthlete} professorId={professorId} canEdit /> : <p className="text-sm text-gray-500">Escolha um atleta para ver o painel individual, registrar avaliações e definir metas.</p>}
          </>
        )}
      </Section>

      <Modal open={editingTest !== null} title={editingTest && editingTest !== 'new' ? 'Editar teste' : 'Novo teste'} onClose={() => setEditingTest(null)}>
        {editingTest !== null && <TestForm key={editingTest === 'new' ? 'new' : editingTest.id} test={editingTest === 'new' ? null : editingTest} onCancel={() => setEditingTest(null)}
          onSave={async (input) => { try { await saveTest(professorId, id, input, editingTest !== 'new' ? editingTest.id : undefined); toast.success('Teste salvo.'); setEditingTest(null); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />}
      </Modal>

      <ConfirmDialog open={deletingTest !== null} title="Excluir teste" message={`Excluir "${deletingTest?.name}" apaga também as metas e os resultados deste teste.`} onClose={() => setDeletingTest(null)}
        onConfirm={async () => { try { await deleteTest(deletingTest!.id); setDeletingTest(null); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />

      <Modal open={enrolling} title="Atletas inscritos no concurso" onClose={() => setEnrolling(false)}>
        {enrolling && <EnrollForm athletes={athletes} initial={enrolled.map((a) => a.id)} onCancel={() => setEnrolling(false)}
          onSave={async (ids) => { try { await setEnrollments(professorId, id, ids); toast.success('Inscrições atualizadas.'); setEnrolling(false); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />}
      </Modal>
    </div>
  );
}

function TestForm({ test, onSave, onCancel }: { test: TafTest | null; onSave: (i: Omit<TafTest, 'id' | 'professor_id' | 'exam_id'>) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(test?.name ?? '');
  const [kind, setKind] = useState<TafKind>(test?.kind ?? 'tempo');
  const [better, setBetter] = useState<'menor' | 'maior'>(test?.better ?? 'menor');
  const [min, setMin] = useState(test?.min_value != null ? (test.kind === 'tempo' ? formatDuration(test.min_value) : String(test.min_value).replace('.', ',')) : '');
  const [ref, setRef] = useState(test?.edital_ref ?? '');
  const [notes, setNotes] = useState(test?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function preset(i: string) {
    const p = TAF_PRESETS[Number(i)];
    if (!p) return;
    setName(p.name); setKind(p.kind); setBetter(p.better);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Informe o nome do teste.';
    const minV = min.trim() ? parseTafValue(kind, min) : null;
    if (min.trim() && minV == null) errs.min = 'Valor inválido para este tipo de teste.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    await onSave({ name: name.trim(), kind, better, min_value: minV, edital_ref: ref.trim() || null, notes: notes.trim() || null });
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!test && (
        <Field label="Começar de um teste pré-configurado (opcional)" hint="Define apenas nome e tipo. Nenhum índice é preenchido.">
          <select className="input" defaultValue="" onChange={(e) => preset(e.target.value)}>
            <option value="">— personalizado —</option>
            {TAF_PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Nome do teste" error={errors.name}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Resultado medido em">
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as TafKind)}>
            <option value="tempo">Tempo (mm:ss)</option><option value="distancia">Distância (metros)</option><option value="repeticoes">Repetições</option>
          </select>
        </Field>
        <Field label="Melhor resultado é">
          <select className="input" value={better} onChange={(e) => setBetter(e.target.value as 'menor' | 'maior')}>
            <option value="menor">o menor valor (ex.: tempo)</option><option value="maior">o maior valor (ex.: repetições)</option>
          </select>
        </Field>
      </div>
      <Field label="Índice mínimo (conforme edital)" error={errors.min} hint="Deixe vazio se ainda não definido."><input className="input" value={min} onChange={(e) => setMin(e.target.value)} placeholder={tafPlaceholder(kind)} /></Field>
      <Field label="Referência no edital"><input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Ex.: item 9.3, tabela B (masculino 18–25)" /></Field>
      <Field label="Observações"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button type="submit" loading={busy}>Salvar teste</Button></div>
    </form>
  );
}

function EnrollForm({ athletes, initial, onSave, onCancel }: { athletes: { id: string; full_name: string; status: string }[]; initial: string[]; onSave: (ids: string[]) => Promise<void>; onCancel: () => void }) {
  const [ids, setIds] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2 dark:border-gray-800">
        {athletes.map((a) => (
          <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            <input type="checkbox" checked={ids.includes(a.id)} onChange={() => setIds((l) => (l.includes(a.id) ? l.filter((x) => x !== a.id) : [...l, a.id]))} />
            {a.full_name} {a.status === 'inativo' && <Badge>inativo</Badge>}
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancelar</Button><Button loading={busy} onClick={async () => { setBusy(true); await onSave(ids); setBusy(false); }}>Salvar inscritos</Button></div>
    </div>
  );
}
