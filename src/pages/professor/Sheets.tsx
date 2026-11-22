import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { createSheet, deleteSheet, listAllSheetItemCounts, listSheets } from '../../services/training';
import { errorMessage } from '../../services/db';
import { SHEET_KINDS, sheetKindLabel } from '../../utils/constants';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Badge, EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui/Misc';
import type { Sheet } from '../../types';

export default function Sheets() {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(async () => {
    const [sheets, counts] = await Promise.all([listSheets(), listAllSheetItemCounts()]);
    return { sheets, counts };
  }, []);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Sheet | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('semanal');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setErr('Informe o nome da planilha.');
    setBusy(true);
    try {
      const id = await createSheet(session!.user.id, name.trim(), kind, description.trim() || null);
      toast.success('Planilha criada.');
      navigate(`/professor/planilhas/${id}`);
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
      <PageHeader title="Planilhas" subtitle="Monte planilhas reutilizáveis e atribua a atletas ou grupos." actions={<Button onClick={() => { setName(''); setDescription(''); setErr(''); setCreating(true); }}><Plus size={16} /> Nova planilha</Button>} />

      {data.sheets.length === 0 ? (
        <div className="card"><EmptyState icon={<ClipboardList size={24} />} title="Nenhuma planilha criada" text="Crie uma planilha diária, semanal, mensal ou personalizada." /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.sheets.map((s) => (
            <div key={s.id} className="card flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/professor/planilhas/${s.id}`} className="text-base font-bold hover:underline">{s.name}</Link>
                <Badge tone="orange">{sheetKindLabel(s.kind)}</Badge>
              </div>
              {s.description && <p className="line-clamp-2 text-sm text-gray-500">{s.description}</p>}
              <p className="text-sm text-gray-500">{data.counts[s.id] ?? 0} treino(s)</p>
              <div className="mt-auto flex gap-2 pt-2">
                <Link to={`/professor/planilhas/${s.id}`} className="btn btn-secondary btn-sm flex-1">Abrir / editar</Link>
                <Button size="sm" variant="ghost" aria-label={`Excluir ${s.name}`} onClick={() => setDeleting(s)}><Trash2 size={15} className="text-red-600" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={creating} title="Nova planilha" onClose={() => setCreating(false)}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Nome" error={err}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Base 5 km — 8 semanas" /></Field>
          <Field label="Tipo"><select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>{SHEET_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></Field>
          <Field label="Descrição (opcional)"><textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setCreating(false)}>Cancelar</Button><Button type="submit" loading={busy}>Criar e editar</Button></div>
        </form>
      </Modal>

      <ConfirmDialog open={deleting !== null} title="Excluir planilha" message={`Excluir "${deleting?.name}"? Os treinos já atribuídos aos atletas permanecem na agenda deles.`} onClose={() => setDeleting(null)}
        onConfirm={async () => { try { await deleteSheet(deleting!.id); toast.success('Planilha excluída.'); setDeleting(null); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />
    </div>
  );
}
