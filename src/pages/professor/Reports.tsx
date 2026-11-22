import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { listAthletes } from '../../services/athletes';
import AthleteReport from '../../components/AthleteReport';
import { Field } from '../../components/ui/Field';
import { EmptyState, ErrorBox, PageHeader, Spinner } from '../../components/ui/Misc';

export default function Reports() {
  const { data, loading, error, reload } = useAsync(() => listAthletes(), []);
  const [athleteId, setAthleteId] = useState('');

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const athletes = data ?? [];
  const current = athletes.find((a) => a.id === athleteId);

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Evolução individual com filtros por período e modalidade. Exporte em PDF." />
      <div className="card mb-5 p-4">
        <Field label="Atleta" className="max-w-md">
          <select className="input" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
            <option value="">— escolher atleta —</option>
            {athletes.map((a) => <option key={a.id} value={a.id}>{a.full_name}{a.status === 'inativo' ? ' (inativo)' : ''}</option>)}
          </select>
        </Field>
      </div>
      {current ? <AthleteReport key={current.id} athleteId={current.id} athleteName={current.full_name} /> : (
        <div className="card"><EmptyState title="Escolha um atleta" text="O relatório mostra evolução de tempos e distâncias, frequência, conclusão das planilhas, metas e comparação entre períodos." /></div>
      )}
    </div>
  );
}
