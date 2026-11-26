import { CalendarDays, FileText, Home, ListChecks, LineChart, MessageSquare, Target, UserCircle } from 'lucide-react';
import { AppShell, type NavItem } from './AppShell';

export const athleteNav: NavItem[] = [
  { to: '/atleta', label: 'Hoje', icon: <Home size={20} />, end: true },
  { to: '/atleta/treinos', label: 'Treinos', icon: <ListChecks size={20} /> },
  { to: '/atleta/plano', label: 'Plano', icon: <FileText size={20} /> },
  { to: '/atleta/evolucao', label: 'Evolução', icon: <LineChart size={20} /> },
  { to: '/atleta/taf', label: 'TAF', icon: <Target size={20} /> },
  { to: '/atleta/calendario', label: 'Calendário', icon: <CalendarDays size={20} /> },
  { to: '/atleta/mensagens', label: 'Mensagens', icon: <MessageSquare size={20} />, badge: 'messages' },
  { to: '/atleta/conta', label: 'Minha conta', icon: <UserCircle size={20} /> },
];

export default function AthleteLayout() {
  return <AppShell items={athleteNav} roleLabel="Atleta" mobileTabs={['/atleta', '/atleta/treinos', '/atleta/evolucao', '/atleta/mensagens']} />;
}
