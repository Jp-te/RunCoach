import { Link } from 'react-router-dom';
import { CheckCircle2, Download, Share, SquarePlus, MoreVertical } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import { Button } from '../components/ui/Button';
import { AuthCard } from './auth/Login';

export function InstallInstructions() {
  const { canInstall, installed, ios, install } = usePWA();

  if (installed)
    return (
      <p className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
        <CheckCircle2 size={18} /> O RunCoach já está instalado neste aparelho.
      </p>
    );

  return (
    <div className="space-y-4 text-sm">
      {canInstall && (
        <Button className="w-full" onClick={() => void install()}>
          <Download size={16} /> Instalar agora
        </Button>
      )}
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <p className="mb-2 font-bold">iPhone / iPad (Safari)</p>
        <ol className="list-decimal space-y-1 pl-5 text-gray-600 dark:text-gray-300">
          <li>Abra este endereço no <b>Safari</b> (outros navegadores não instalam no iPhone).</li>
          <li>
            Toque em <Share size={14} className="inline" /> <b>Compartilhar</b>.
          </li>
          <li>
            Escolha <SquarePlus size={14} className="inline" /> <b>Adicionar à Tela de Início</b>.
          </li>
        </ol>
        {ios && <p className="mt-2 text-xs text-brand-600">Você está em um iPhone/iPad: siga estes passos.</p>}
      </div>
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <p className="mb-2 font-bold">Android (Chrome)</p>
        <ol className="list-decimal space-y-1 pl-5 text-gray-600 dark:text-gray-300">
          <li>
            Toque no menu <MoreVertical size={14} className="inline" /> do Chrome.
          </li>
          <li>
            Escolha <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.
          </li>
        </ol>
      </div>
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <p className="mb-2 font-bold">Computador (Chrome / Edge)</p>
        <p className="text-gray-600 dark:text-gray-300">Clique no ícone de instalação na barra de endereço.</p>
      </div>
    </div>
  );
}

export default function Install() {
  return (
    <AuthCard title="Instalar o RunCoach" subtitle="Use como um aplicativo, direto da tela inicial do celular.">
      <InstallInstructions />
      <p className="mt-4 text-center text-sm">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </AuthCard>
  );
}
