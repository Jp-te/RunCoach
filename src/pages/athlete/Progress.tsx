import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { listModalities } from '../../services/athletes';
import { deleteResult, listResults, saveResult } from '../../services/results';
import { errorMessage } from '../../services/db';
import { formatDateBR, formatDuration } from '../../utils/format';
import AthleteReport from '../../components/AthleteReport';
import NoAthleteRecord from '../../components/NoAthleteRecord';
import ResultForm from '../../components/ResultForm';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { Badge, ErrorBox, PageHeader, Section, Spinner } from '../../components/ui/Misc';
import type { ResultRow } from '../../types';
import { useMe } from './useMe';

export default function Progress() {
  const { athlete } = useMe();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(async () => {
    if (!athlete) return null;
    const [results, modalities] = await Promise.all([listResults({ athleteId: athlete.id }), listModalities()]);
    return { results, modalities };
  }, [athlete?.id]);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<ResultRow | null>(null);
  const [version, setVersion] = useState(0);

  if (!athlete) return <NoAthleteRecord />;
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;
  const mod = (id: string | null) => data.modalities.find((m) => m.id === id)?.name ?? '—';

  return (
    <div className="space-y-5">
      <PageHeader title="Minha evolução" subtitle="Gráficos, marcas pessoais e comparação entre períodos." />

      <Section title="Minhas marcas e provas" actions={<Button size="sm" onClick={() => setAdding(true)}><Plus size={15} /> Registrar marca</Button>}>
        {data.results.length === 0 ? <p className="text-sm text-gray-500">Registre tempos de provas e testes para acompanhar sua evolução.</p> : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.results.slice(0, 15).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span><b>{mod(r.modality_id)}</b> — {formatDuration(r.time_s)} <span className="text-gray-500">({formatDateBR(r.result_date)})</span> {r.is_competition && <Badge tone="red">{r.competition_name || 'Competição'}</Badge>}</span>
                <Button size="sm" variant="ghost" aria-label="Excluir marca" onClick={() => setDeleting(r)}><Trash2 size={15} className="text-red-600" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <AthleteReport key={version} athleteId={athlete.id} athleteName={athlete.full_name} />

      <Modal open={adding} title="Registrar marca / prova" onClose={() => setAdding(false)}>
        {adding && <ResultForm modalities={data.modalities} onCancel={() => setAdding(false)}
          onSubmit={async (_a, input) => { await saveResult(athlete.professor_id, athlete.id, input); toast.success('Marca registrada.'); setAdding(false); setVersion((v) => v + 1); await reload(); }} />}
      </Modal>
      <ConfirmDialog open={deleting !== null} title="Excluir marca" message="Esta marca será removida do seu histórico." onClose={() => setDeleting(null)}
        onConfirm={async () => { try { await deleteResult(deleting!.id); setDeleting(null); setVersion((v) => v + 1); await reload(); } catch (e) { toast.error(errorMessage(e)); } }} />
    </div>
  );
}
