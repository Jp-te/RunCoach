import { LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { InstallInstructions } from '../Install';
import PasswordCard from '../../components/PasswordCard';
import { Button } from '../../components/ui/Button';
import { PageHeader, Section } from '../../components/ui/Misc';
import { formatDateBR, ageFrom } from '../../utils/format';
import { experienceLabel } from '../../utils/constants';

export default function Account() {
  const { profile, athlete, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  return (
    <div className="space-y-5">
      <PageHeader title="Minha conta" />
      <Section title="Meus dados">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-gray-500">Nome</dt><dd className="font-semibold">{athlete?.full_name ?? profile?.full_name}</dd></div>
          <div><dt className="text-xs text-gray-500">E-mail</dt><dd className="font-semibold">{profile?.email}</dd></div>
          {athlete && <>
            <div><dt className="text-xs text-gray-500">Na assessoria desde</dt><dd className="font-semibold">{formatDateBR(athlete.start_date)}</dd></div>
            <div><dt className="text-xs text-gray-500">Idade</dt><dd className="font-semibold">{ageFrom(athlete.birth_date) ?? '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">Nível</dt><dd className="font-semibold">{experienceLabel(athlete.experience_level)}</dd></div>
            <div><dt className="text-xs text-gray-500">Objetivos</dt><dd>{athlete.goals || '—'}</dd></div>
          </>}
        </dl>
        <p className="mt-3 text-xs text-gray-500">Para corrigir seus dados cadastrais, fale com o seu professor.</p>
      </Section>
      <Section title="Aparência"><Button variant="secondary" onClick={toggle}>Tema: {theme === 'dark' ? 'escuro' : 'claro'} (alternar)</Button></Section>
      <PasswordCard />
      <Section title="Instalar como aplicativo"><InstallInstructions /></Section>
      <Button variant="secondary" onClick={() => void signOut()}><LogOut size={16} /> Sair da conta</Button>
    </div>
  );
}
