import { useState } from 'react';
import { Dumbbell, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { expandTargets, listAthletes, listGroupMembers, listGroups, listModalities } from '../../services/athletes';
import { deleteTemplate, listTemplates, saveTemplate, scheduleForAthletes } from '../../services/training';
import { errorMessage } from '../../services/db';
import { workoutTypeLabel } from '../../utils/constants';
import { formatDistance, formatDuration, todayISO } from '../../utils/format';
import type { WorkoutTemplate } from '../../types';
import WorkoutForm from '../../components/WorkoutForm';
import { WorkoutDetails } from '../../components/WorkoutCard';
import { TargetPicker } from '../../components/TargetPicker';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Badge, EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui/Misc';

export default function Trainings() {
  const { session } = useAuth();
  const toast = useToast();
  const professorId = session!.user.id;
  const { data, loading, error, reload } = useAsync(async () => {
    const [templates, modalities, athletes, groups, members] = await Promise.all([
      listTemplates(), listModalities(), listAthletes(), listGroups(), listGroupMembers(),
    ]);
    return { templates, modalities, athletes, groups, members };
  }, []);
  const [editing, setEditing] = useState<WorkoutTemplate | 'new' | null>(null);
  const [deleting, setDeleting] = useState<WorkoutTemplate | null>(null);
  const [applying, setApplying] = useState<WorkoutTemplate | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader title="Treinamentos" subtitle="Modelos de treino reutilizáveis. Aplique a atletas individuais ou a grupos."
        actions={<Button onClick={() => setEditing('new')}><Plus size={16} /> Novo modelo</Button>} />

      {data.templates.length === 0 ? (
        <div className="card"><EmptyState icon={<Dumbbell size={24} />} title="Nenhum modelo criado" text="Crie modelos como “Tiros de 400 m” ou “Longão 90 min” e reutilize-os em qualquer planilha ou atleta." /></div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.templates.map((t) => (
            <div key={t.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <button className="text-left" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>
                  <p className="font-bold">{t.name}</p>
                  <p className="text-sm text-gray-500">{workoutTypeLabel(t.workout_type)} • {formatDistance(t.distance_m)} • {formatDuration(t.planned_time_s)}</p>
                </button>
                <Badge tone="orange">Modelo</Badge>
              </div>
              {open === t.id && <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800"><WorkoutDetails w={t} modalities={data.modalities} /></div>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => setApplying(t)}><Send size={14} /> Aplicar</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditing(t)}><Pencil size={14} /> Editar</Button>
                <Button size="sm" variant="ghost" aria-label={`Excluir ${t.name}`} onClick={() => setDeleting(t)}><Trash2 size={15} className="text-red-600" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editing !== null} title={editing && editing !== 'new' ? 'Editar modelo' : 'Novo modelo de treino'} onClose={() => setEditing(null)} wide>
        {editing !== null && (
          <WorkoutForm key={editing === 'new' ? 'new' : editing.id} mode="none" initial={editing === 'new' ? undefined : editing} modalities={data.modalities}
            onCancel={() => setEditing(null)}
            onSubmit={async (fields) => { await saveTemplate(professorId, fields, editing !== 'new' ? editing.id : undefined); toast.success('Modelo salvo.'); setEditing(null); await reload(); }} />
        )}
      </Modal>

      <Modal open={applying !== null} title={`Aplicar “${applying?.name ?? ''}”`} onClose={() => setApplying(null)}>
        {applying && <ApplyForm template={applying} athletes={data.athletes} groups={data.groups} members={data.members} onCancel={() => setApplying(null)}
          onApply={async (ids, date) => {
            try {
              const { id: _i, professor_id: _p, ...fields } = applying;
              await scheduleForAthletes(professorId, ids, date, fields);
              toast.success(`Treino agendado para ${ids.length} atleta(s).`);
              setApplying(null);
            } catch (e) { toast.error(errorMessage(e)); }
          }} />}
      </Modal>

      <ConfirmDialog open={deleting !== null} title="Excluir modelo" message={`Excluir o modelo "${deleting?.name}"? Treinos já criados a partir dele não são afetados.`} onClose={() => setDeleting(null)}
        onConfirm={async () => { try { await deleteTemplate(deleting!.id); toast.success('Modelo excluído.'); setDeleting(null); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />
    </div>
  );
}

function ApplyForm({ athletes, groups, members, onApply, onCancel }: {
  template: WorkoutTemplate; athletes: Parameters<typeof TargetPicker>[0]['athletes']; groups: Parameters<typeof TargetPicker>[0]['groups'];
  members: Parameters<typeof expandTargets>[2]; onApply: (ids: string[], date: string) => Promise<void>; onCancel: () => void;
}) {
  const [aIds, setAIds] = useState<string[]>([]);
  const [gIds, setGIds] = useState<string[]>([]);
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const ids = expandTargets(aIds, gIds, members);
  return (
    <div className="space-y-4">
      <Field label="Data do treino"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <TargetPicker athletes={athletes} groups={groups} athleteIds={aIds} groupIds={gIds} onChange={(a, g) => { setAIds(a); setGIds(g); }} />
      <p className="text-sm text-gray-500">{ids.length} atleta(s) selecionado(s).</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button loading={busy} disabled={!ids.length || !date} onClick={async () => { setBusy(true); await onApply(ids, date); setBusy(false); }}>Agendar</Button>
      </div>
    </div>
  );
}
