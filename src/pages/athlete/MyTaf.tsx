import NoAthleteRecord from '../../components/NoAthleteRecord';
import TafPanel from '../../components/TafPanel';
import { PageHeader, Section } from '../../components/ui/Misc';
import { useMe } from './useMe';

export default function MyTaf() {
  const { athlete } = useMe();
  if (!athlete) return <NoAthleteRecord />;
  return (
    <div>
      <PageHeader title="Minha preparação para TAF" subtitle="Índices mínimos configurados pelo professor, seus resultados e metas." />
      <Section title="Concursos e testes"><TafPanel athleteId={athlete.id} professorId={athlete.professor_id} canEdit={false} /></Section>
    </div>
  );
}
