import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { listMessages, markRead, sendMessage } from '../services/communication';
import { errorMessage } from '../services/db';
import { MESSAGE_KINDS, messageKindLabel } from '../utils/constants';
import { formatDateTimeBR } from '../utils/format';
import type { MessageKind } from '../types';
import { Button } from './ui/Button';
import { Badge, ErrorBox, Spinner } from './ui/Misc';

interface Props {
  athleteId: string;
  professorId: string;
  /** Professor escolhe o tipo; atleta sempre envia "comentário". */
  isProfessor: boolean;
}

export default function Conversation({ athleteId, professorId, isProfessor }: Props) {
  const { session } = useAuth();
  const toast = useToast();
  const myId = session!.user.id;
  const { data, loading, error, reload } = useAsync(() => listMessages(athleteId), [athleteId]);
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<MessageKind>('orientacao');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Marca como lidas ao abrir e atualiza a cada 30 s / ao voltar para a aba
  useEffect(() => {
    markRead(athleteId, myId).catch(() => undefined);
    const id = setInterval(() => void reload(), 30000);
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [athleteId, myId, reload]);

  const messages = [...(data ?? [])].reverse();
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await sendMessage(professorId, athleteId, myId, isProfessor ? kind : 'comentario', body);
      setBody('');
      await reload();
      toast.success('Mensagem enviada.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="max-h-[50vh] min-h-[200px] space-y-2 overflow-y-auto rounded-xl bg-gray-50 p-3 dark:bg-gray-950" aria-live="polite">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Nenhuma mensagem ainda.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={clsx('max-w-[85%] rounded-2xl px-3 py-2 text-sm', m.kind === 'notificacao' ? 'border border-dashed border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900' : mine ? 'bg-brand-500 text-white' : 'bg-white shadow-card dark:bg-gray-800')}>
                <div className="mb-0.5 flex items-center gap-2">
                  {m.kind !== 'comentario' && <Badge tone={m.kind === 'aviso' ? 'yellow' : m.kind === 'notificacao' ? 'blue' : 'orange'}>{messageKindLabel(m.kind)}</Badge>}
                </div>
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={clsx('mt-1 text-[11px]', mine && m.kind !== 'notificacao' ? 'text-white/80' : 'text-gray-400')}>{formatDateTimeBR(m.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="space-y-2">
        {isProfessor && (
          <select className="input sm:w-56" value={kind} onChange={(e) => setKind(e.target.value as MessageKind)} aria-label="Tipo de mensagem">
            {MESSAGE_KINDS.filter((k) => k.value !== 'notificacao').map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <textarea
            className="input"
            rows={2}
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={isProfessor ? 'Escreva uma orientação, aviso ou comentário...' : 'Escreva uma mensagem para o professor...'}
            aria-label="Mensagem"
          />
          <Button type="submit" loading={busy} aria-label="Enviar mensagem" disabled={!body.trim()}>
            <Send size={16} />
          </Button>
        </div>
      </form>
    </div>
  );
}
