import { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { listAthletes } from '../../services/athletes';
import { listMessages } from '../../services/communication';
import Conversation from '../../components/Conversation';
import { Badge, EmptyState, ErrorBox, PageHeader, Section, Spinner } from '../../components/ui/Misc';
import { formatDateTimeBR } from '../../utils/format';

export default function Messages() {
  const { session } = useAuth();
  const myId = session!.user.id;
  const { data, loading, error, reload } = useAsync(async () => {
    const [athletes, messages] = await Promise.all([listAthletes(), listMessages()]);
    return { athletes, messages };
  }, []);
  const [selected, setSelected] = useState('');

  const rows = useMemo(() => {
    if (!data) return [];
    return data.athletes
      .map((a) => {
        const msgs = data.messages.filter((m) => m.athlete_id === a.id);
        return { a, last: msgs[0], unread: msgs.filter((m) => m.sender_id !== myId && !m.read_at).length };
      })
      .sort((x, y) => (y.last?.created_at ?? '').localeCompare(x.last?.created_at ?? '') || x.a.full_name.localeCompare(y.a.full_name));
  }, [data, myId]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;
  const current = data.athletes.find((a) => a.id === selected);

  return (
    <div>
      <PageHeader title="Mensagens" subtitle="Orientações, avisos e comentários sobre resultados. Novas planilhas notificam o atleta automaticamente." />
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="card max-h-[70vh] overflow-y-auto">
          {rows.length === 0 ? <EmptyState title="Nenhum atleta" text="Cadastre atletas para trocar mensagens." /> : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map(({ a, last, unread }) => (
                <li key={a.id}>
                  <button onClick={() => { setSelected(a.id); void reload(); }} aria-current={selected === a.id} className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 ${selected === a.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{a.full_name}</span>
                      {unread > 0 && <Badge tone="red">{unread}</Badge>}
                    </div>
                    <p className="truncate text-xs text-gray-500">{last ? `${formatDateTimeBR(last.created_at)} — ${last.body}` : 'Sem mensagens'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Section title={current ? `Conversa com ${current.full_name}` : 'Conversa'}>
          {current ? <Conversation key={current.id} athleteId={current.id} professorId={myId} isProfessor /> : <p className="py-10 text-center text-sm text-gray-500">Escolha um atleta na lista.</p>}
        </Section>
      </div>
    </div>
  );
}
