import { useState } from 'react';
import NoAthleteRecord from '../../components/NoAthleteRecord';
import PlanView from '../../components/PlanView';
import { EmptyState, ErrorBox, PageHeader, Section, Spinner } from '../../components/ui/Misc';
import { useAsync } from '../../hooks/useAsync';
import { listPlans } from '../../services/plans';
import { formatDateBR } from '../../utils/format';
import { useMe } from './useMe';

export default function MyPlan() {
  const { athlete } = useMe();
  const [sel, setSel] = useState(0);
  const { data, loading, error, reload } = useAsync(() => (athlete ? listPlans(athlete.id) : Promise.resolve([])), [athlete?.id]);
  if (!athlete) return <NoAthleteRecord />;
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const plans = data ?? [];
  const plan = plans[Math.min(sel, plans.length - 1)];
  return (
    <div>
      <PageHeader title="Meu plano de treino" subtitle="O plano completo enviado pelo seu professor." />
      {!plan ? (
        <EmptyState title="Nenhum plano ainda" text="Quando o professor importar o seu plano de treino, ele aparece aqui." />
      ) : (
        <>
          {plans.length > 1 && (
            <select className="input mb-3" value={sel} onChange={(e) => setSel(Number(e.target.value))} aria-label="Escolher plano">
              {plans.map((p, i) => <option key={p.id} value={i}>{p.title} — {formatDateBR(p.created_at)}</option>)}
            </select>
          )}
          <Section title={plan.title}><PlanView plan={plan.data} hideTitle /></Section>
        </>
      )}
    </div>
  );
}
