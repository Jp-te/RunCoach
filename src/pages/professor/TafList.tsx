import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Target, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { deleteExam, listEnrollments, listExams, saveExam } from '../../services/taf';
import { errorMessage } from '../../services/db';
import { formatDateBR } from '../../utils/format';
import type { TafExam } from '../../types';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Badge, EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui/Misc';

export default function TafList() {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(async () => {
    const [exams, enr] = await Promise.all([listExams(), listEnrollments()]);
    return { exams, enr };
  }, []);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TafExam | null>(null);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [position, setPosition] = useState('');
  const [date, setDate] = useState('');
  const [reg, setReg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) return setErr('Informe o nome do concurso.');
    setBusy(true);
    try {
      const id = await saveExam(session!.user.id, {
        name: name.trim(), institution: institution.trim() || null, position: position.trim() || null,
        exam_date: date || null, regulation_ref: reg.trim() || null, notes: null,
      });
      toast.success('Concurso cadastrado. Agora configure os testes e os índices.');
      navigate(`/professor/taf/${id}`);
    } catch (e2) {
      setErr(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Preparação para TAF" subtitle="Cadastre concursos/editais, configure testes e índices e acompanhe os candidatos."
        actions={<Button onClick={() => { setName(''); setInstitution(''); setPosition(''); setDate(''); setReg(''); setErr(''); setCreating(true); }}><Plus size={16} /> Novo concurso</Button>} />

      <p className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900 dark:border-brand-900 dark:bg-brand-900/20 dark:text-brand-200">
        Os índices mínimos variam conforme instituição, edital, categoria e critérios. O RunCoach <b>não traz índices oficiais</b>: você informa cada índice, com a referência do edital.
      </p>

      {data.exams.length === 0 ? (
        <div className="card"><EmptyState icon={<Target size={24} />} title="Nenhum concurso cadastrado" text="Cadastre o primeiro concurso para configurar testes e inscrever atletas." /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.exams.map((x) => (
            <div key={x.id} className="card flex flex-col gap-1 p-4">
              <Link to={`/professor/taf/${x.id}`} className="text-base font-bold hover:underline">{x.name}</Link>
              <p className="text-sm text-gray-500">{[x.institution, x.position].filter(Boolean).join(' • ') || 'Sem instituição/cargo'}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge tone="orange">Prova: {formatDateBR(x.exam_date)}</Badge>
                <Badge tone="blue">{data.enr.filter((e) => e.exam_id === x.id).length} atleta(s)</Badge>
              </div>
              <div className="mt-2 flex gap-2">
                <Link to={`/professor/taf/${x.id}`} className="btn btn-secondary btn-sm flex-1">Abrir</Link>
                <Button size="sm" variant="ghost" aria-label={`Excluir ${x.name}`} onClick={() => setDeleting(x)}><Trash2 size={15} className="text-red-600" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating} title="Novo concurso / edital" onClose={() => setCreating(false)}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Nome do concurso" error={err}><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Instituição"><input className="input" value={institution} onChange={(e) => setInstitution(e.target.value)} /></Field>
            <Field label="Cargo"><input className="input" value={position} onChange={(e) => setPosition(e.target.value)} /></Field>
            <Field label="Data da prova"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Regulamento / edital utilizado"><input className="input" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="Ex.: Edital nº 1/2026, item 8" /></Field>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCreating(false)}>Cancelar</Button><Button type="submit" loading={busy}>Criar</Button></div>
        </form>
      </Modal>

      <ConfirmDialog open={deleting !== null} title="Excluir concurso" message={`Excluir "${deleting?.name}" apaga os testes, metas e resultados de TAF vinculados.`} onClose={() => setDeleting(null)}
        onConfirm={async () => { try { await deleteExam(deleting!.id); toast.success('Concurso excluído.'); setDeleting(null); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />
    </div>
  );
}
