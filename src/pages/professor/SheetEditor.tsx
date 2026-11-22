import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { expandTargets, listAthletes, listGroupMembers, listGroups, listModalities } from '../../services/athletes';
import { assignSheet, deleteSheetItem, duplicateSheetWeek, getSheet, listSheetItems, listTemplates, saveSheetItem, saveTemplate, updateSheet } from '../../services/training';
import { errorMessage } from '../../services/db';
import { SHEET_KINDS, workoutTypeLabel } from '../../utils/constants';
import { formatDistance, formatDuration, startOfWeek, todayISO } from '../../utils/format';
import type { SheetItem } from '../../types';
import WorkoutForm from '../../components/WorkoutForm';
import { TargetPicker } from '../../components/TargetPicker';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Badge, ErrorBox, Section, Spinner } from '../../components/ui/Misc';

export default function SheetEditor() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const toast = useToast();
  const professorId = session!.user.id;
  const { data, loading, error, reload } = useAsync(async () => {
    const [sheet, items, modalities, templates, athletes, groups, members] = await Promise.all([
      getSheet(id), listSheetItems(id), listModalities(), listTemplates(), listAthletes(), listGroups(), listGroupMembers(),
    ]);
    return { sheet, items, modalities, templates, athletes, groups, members };
  }, [id]);

  const [editing, setEditing] = useState<{ item: SheetItem | null; day: number } | null>(null);
  const [deleting, setDeleting] = useState<SheetItem | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [meta, setMeta] = useState<{ name: string; kind: string; description: string } | null>(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data?.sheet) return <ErrorBox message="Planilha não encontrada." />;
  const { sheet, items } = data;

  const maxDay = items.reduce((m, i) => Math.max(m, i.day_offset), 0);
  const weekCount = Math.max(1, Math.floor(maxDay / 7) + 1);
  const weeks = Array.from({ length: weekCount }, (_, w) => w);
  const view = meta ?? { name: sheet.name, kind: sheet.kind, description: sheet.description ?? '' };

  async function saveMeta() {
    if (!meta) return;
    if (meta.name.trim().length < 2) return toast.error('Informe o nome da planilha.');
    try {
      await updateSheet(id, meta.name.trim(), meta.kind, meta.description.trim() || null);
      toast.success('Planilha atualizada.');
      setMeta(null);
      await reload();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div>
      <Link to="/professor/planilhas" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft size={16} /> Planilhas</Link>

      <div className="card mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <Field label="Nome"><input className="input" value={view.name} onChange={(e) => setMeta({ ...view, name: e.target.value })} /></Field>
          <Field label="Tipo"><select className="input" value={view.kind} onChange={(e) => setMeta({ ...view, kind: e.target.value })}>{SHEET_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></Field>
          <Field label="Descrição" className="sm:col-span-2"><input className="input" value={view.description} onChange={(e) => setMeta({ ...view, description: e.target.value })} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">{meta && <><Button size="sm" onClick={saveMeta}>Salvar alterações</Button><Button size="sm" variant="secondary" onClick={() => setMeta(null)}>Descartar</Button></>}</div>
          <Button onClick={() => setAssigning(true)} disabled={items.length === 0}><Send size={16} /> Atribuir a atletas / grupos</Button>
        </div>
      </div>

      {weeks.map((w) => {
        const wi = items.filter((i) => i.day_offset >= w * 7 && i.day_offset < w * 7 + 7);
        return (
          <Section key={w} title={`Semana ${w + 1}`} className="mb-4" actions={
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={wi.length === 0} onClick={async () => { try { const n = await duplicateSheetWeek(professorId, id, items, w); toast.success(`${n} treino(s) copiados para a semana ${w + 2}.`); await reload(); } catch (e) { toast.error(errorMessage(e)); } }}><Copy size={14} /> Copiar para semana {w + 2}</Button>
              <Button size="sm" onClick={() => setEditing({ item: null, day: w * 7 })}><Plus size={14} /> Treino</Button>
            </div>
          }>
            {wi.length === 0 ? <p className="text-sm text-gray-500">Sem treinos nesta semana.</p> : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {wi.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold"><Badge tone="orange">Dia {i.day_offset + 1}</Badge> {i.name}</p>
                      <p className="text-sm text-gray-500">{workoutTypeLabel(i.workout_type)} • {formatDistance(i.distance_m)} • {formatDuration(i.planned_time_s)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setEditing({ item: i, day: i.day_offset })}><Pencil size={15} /></Button>
                      <Button size="sm" variant="ghost" aria-label="Excluir" onClick={() => setDeleting(i)}><Trash2 size={15} className="text-red-600" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        );
      })}
      <Button variant="secondary" onClick={() => setEditing({ item: null, day: weekCount * 7 })}><Plus size={16} /> Adicionar semana</Button>

      <Modal open={editing !== null} title={editing?.item ? 'Editar treino da planilha' : 'Novo treino da planilha'} onClose={() => setEditing(null)} wide>
        {editing && (
          <WorkoutForm
            key={editing.item?.id ?? 'new' + editing.day}
            mode="offset" initial={editing.item ?? undefined} initialOffset={editing.day}
            modalities={data.modalities} templates={data.templates}
            onCancel={() => setEditing(null)}
            onSaveTemplate={async (f) => { await saveTemplate(professorId, f); toast.success('Modelo salvo em Treinamentos.'); }}
            onSubmit={async (fields, { dayOffset }) => {
              await saveSheetItem(professorId, id, dayOffset, fields, editing.item?.id);
              toast.success('Treino salvo.');
              setEditing(null);
              await reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog open={deleting !== null} title="Excluir treino" message={`Remover "${deleting?.name}" desta planilha?`} onClose={() => setDeleting(null)}
        onConfirm={async () => { try { await deleteSheetItem(deleting!.id); setDeleting(null); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />

      <Modal open={assigning} title="Atribuir planilha" onClose={() => setAssigning(false)}>
        {assigning && <AssignModal athletes={data.athletes} groups={data.groups} members={data.members} onCancel={() => setAssigning(false)}
          onAssign={async (ids, start) => {
            try { const n = await assignSheet(id, ids, start); toast.success(`${n} treino(s) criado(s) para ${ids.length} atleta(s). Eles foram notificados.`); setAssigning(false); } catch (e) { toast.error(errorMessage(e)); }
          }} />}
      </Modal>
    </div>
  );
}

function AssignModal({ athletes, groups, members, onAssign, onCancel }: {
  athletes: Parameters<typeof TargetPicker>[0]['athletes']; groups: Parameters<typeof TargetPicker>[0]['groups'];
  members: Parameters<typeof expandTargets>[2]; onAssign: (ids: string[], start: string) => Promise<void>; onCancel: () => void;
}) {
  const [aIds, setAIds] = useState<string[]>([]);
  const [gIds, setGIds] = useState<string[]>([]);
  const [start, setStart] = useState(startOfWeek(todayISO()));
  const [busy, setBusy] = useState(false);
  const ids = expandTargets(aIds, gIds, members);
  return (
    <div className="space-y-4">
      <Field label="Data do dia 1 da planilha" hint="Os demais dias são contados a partir desta data."><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      <TargetPicker athletes={athletes} groups={groups} athleteIds={aIds} groupIds={gIds} onChange={(a, g) => { setAIds(a); setGIds(g); }} />
      <p className="text-sm text-gray-500">{ids.length} atleta(s) receberão a planilha.</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button loading={busy} disabled={ids.length === 0 || !start} onClick={async () => { setBusy(true); await onAssign(ids, start); setBusy(false); }}>Atribuir</Button>
      </div>
    </div>
  );
}
