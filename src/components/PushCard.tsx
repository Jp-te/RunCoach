import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { errorMessage } from '../services/db';
import { disablePush, enablePush, pushStatus, type PushStatus } from '../services/push';
import { Button } from './ui/Button';
import { Section } from './ui/Misc';

const TEXT: Record<Exclude<PushStatus, 'off' | 'on'>, string> = {
  unsupported: 'Este navegador não suporta notificações push.',
  'not-configured': 'As notificações no celular ainda não foram ativadas pelo administrador do app (veja docs/NOTIFICACOES.md).',
  'ios-needs-install': 'No iPhone/iPad, instale o app primeiro: Safari → Compartilhar → “Adicionar à Tela de Início”, abra pelo ícone e volte aqui (iOS 16.4 ou superior).',
  denied: 'As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador/sistema e volte aqui.',
};

export default function PushCard() {
  const { session } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => void pushStatus().then(setStatus).catch(() => setStatus('unsupported')), []);
  useEffect(refresh, [refresh]);

  return (
    <Section title="Notificações no celular">
      {status === null ? null : status === 'on' || status === 'off' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {status === 'on' ? 'Ativas neste aparelho: você recebe um aviso quando chegar treino ou mensagem nova.' : 'Receba um aviso no celular quando chegar treino ou mensagem nova.'}
          </p>
          <Button
            variant={status === 'on' ? 'secondary' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (status === 'on') {
                  await disablePush();
                  toast.success('Notificações desativadas neste aparelho.');
                } else {
                  await enablePush(session!.user.id);
                  toast.success('Notificações ativadas neste aparelho.');
                }
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setBusy(false);
                refresh();
              }
            }}
          >
            {status === 'on' ? <><BellOff size={16} aria-hidden /> Desativar</> : <><Bell size={16} aria-hidden /> Ativar notificações</>}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-300">{TEXT[status]}</p>
      )}
    </Section>
  );
}
