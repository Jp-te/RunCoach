import {
  BarChart3, CalendarDays, ClipboardList, Dumbbell, LayoutDashboard, MessageSquare, Settings, Target, Timer, Users,
} from 'lucide-react';
import { AppShell, type NavItem } from './AppShell';

export const professorNav: NavItem[] = [
  { to: '/professor', label: 'Dashboard', icon: <LayoutDashboard size={18} />, end: true },
  { to: '/professor/atletas', label: 'Atletas', icon: <Users size={18} /> },
  { to: '/professor/planilhas', label: 'Planilhas', icon: <ClipboardList size={18} /> },
  { to: '/professor/calendario', label: 'Calendário', icon: <CalendarDays size={18} /> },
  { to: '/professor/treinamentos', label: 'Treinamentos', icon: <Dumbbell size={18} /> },
  { to: '/professor/resultados', label: 'Resultados', icon: <Timer size={18} /> },
  { to: '/professor/relatorios', label: 'Relatórios', icon: <BarChart3 size={18} /> },
  { to: '/professor/taf', label: 'Preparação TAF', icon: <Target size={18} /> },
  { to: '/professor/mensagens', label: 'Mensagens', icon: <MessageSquare size={18} />, badge: 'messages' },
  { to: '/professor/configuracoes', label: 'Configurações', icon: <Settings size={18} /> },
];

export default function ProfessorLayout() {
  return <AppShell items={professorNav} roleLabel="Professor" />;
}
