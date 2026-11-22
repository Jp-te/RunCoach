import Conversation from '../../components/Conversation';
import NoAthleteRecord from '../../components/NoAthleteRecord';
import { PageHeader, Section } from '../../components/ui/Misc';
import { useMe } from './useMe';

export default function Messages() {
  const { athlete } = useMe();
  if (!athlete) return <NoAthleteRecord />;
  return (
    <div>
      <PageHeader title="Mensagens" subtitle="Orientações e avisos do seu professor." />
      <Section title="Conversa com o professor"><Conversation athleteId={athlete.id} professorId={athlete.professor_id} isProfessor={false} /></Section>
    </div>
  );
}
