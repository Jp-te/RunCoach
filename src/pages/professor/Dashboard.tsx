import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Users, UserCheck, ClipboardList } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync';
import { listAthletes } from '../../services/athletes';
import { listLogs, listWorkouts } from '../../services/training';
import { addDays, daysBetween, formatDateBR, formatDistance, formatDuration, formatPace, startOfWeek, todayISO, formatDateShort } from '../../utils/format';
import { workoutTypeLabel, logStatusLabel } from '../../utils/constants';
import { BarSeries, ChartBox, LineSeries } from '../../components/charts';
import { Badge, EmptyState, ErrorBox, PageHeader, Section, Spinner, StatCard } from '../../components/ui/Misc';
import { Button } from '../../components/ui/Button';

export default function Dashboard() {
  const today = todayISO();
  const from = addDays(today, -55); // 8 semanas
  const to = addDays(today, 30);
  const { data, loading, error, reload } = useAsync(async () => {
    const [athletes, workouts, logs] = await Promise.all([
      listAthletes(),
      listWorkouts({ from, to }),
      listLogs({ from }),
    ]);
    return { athletes, workouts, logs };
  }, []);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const { athletes, workouts, logs } = data;
  const nameOf = (id: string) => athletes.find((a) => a.id === id)?.full_name ?? 'Atleta';
  const active = athletes.filter((a) => a.status === 'ativo');

  const last30 = addDays(today, -29);
  const done = new Set(logs.filter((l) => l.status !== 'nao_realizado').map((l) => l.workout_id).filter(Boolean));
  const upcoming = workouts.filter((w) => w.scheduled_date >= today);
  const past30 = workouts.filter((w) => w.scheduled_date >= last30 && w.scheduled_date < today);
  const concluded = past30.filter((w) => done.has(w.id)).length;
  const pending = past30.length - concluded;

  // Gráfico: km por semana (todos os atletas) e % de conclusão
  const weeks: { label: string; km: number; sessions: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const ws = startOfWeek(addDays(today, -7 * i));
    const we = addDays(ws, 6);
    const ls = logs.filter((l) => l.status !== 'nao_realizado' && l.log_date >= ws && l.log_date <= we);
    weeks.push({ label: formatDateShort(ws), km: Math.round(ls.reduce((s, l) => s + (l.distance_m ?? 0), 0) / 100) / 10, sessions: ls.length });
  }

  // Atletas que precisam de acompanhamento
  const needsAttention = active
    .map((a) => {
      const myLogs = logs.filter((l) => l.athlete_id === a.id && l.status !== 'nao_realizado');
      const lastLog = myLogs.map((l) => l.log_date).sort().pop() ?? null;
      const myPast = workouts.filter((w) => w.athlete_id === a.id && w.scheduled_date >= addDays(today, -14) && w.scheduled_date < today);
      const missed = myPast.filter((w) => !done.has(w.id)).length;
      const hasPlan = workouts.some((w) => w.athlete_id === a.id && w.scheduled_date >= addDays(today, -14));
      const idle = lastLog ? daysBetween(lastLog, today) : null;
      const reasons: string[] = [];
      if (missed >= 2) reasons.push(`${missed} treinos sem registro (14 dias)`);
      if (hasPlan && (idle == null || idle >= 7)) reasons.push(idle == null ? 'nunca registrou treino' : `sem registro há ${idle} dias`);
      if (!hasPlan) reasons.push('sem treinos programados');
      return { a, reasons, score: missed + (idle ?? 30) / 7 };
    })
    .filter((x) => x.reasons.length > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 6);

  const recent = [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, 6);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral da assessoria." actions={<Link to="/professor/atletas"><Button><Users size={16} /> Atletas</Button></Link>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Atletas cadastrados" value={athletes.length} icon={<Users size={22} />} />
        <StatCard label="Atletas ativos" value={active.length} icon={<UserCheck size={22} />} tone="green" />
        <StatCard label="Treinos programados" value={upcoming.length} hint="de hoje aos próximos 30 dias" icon={<CalendarClock size={22} />} tone="blue" />
        <StatCard label="Treinos concluídos" value={concluded} hint="últimos 30 dias" icon={<CheckCircle2 size={22} />} tone="green" />
        <StatCard label="Treinos pendentes" value={pending} hint="últimos 30 dias, sem registro" icon={<Clock size={22} />} tone="red" />
        <StatCard label="Planilhas" value={<Link to="/professor/planilhas" className="text-base underline">Gerenciar</Link>} icon={<ClipboardList size={22} />} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Section title="Evolução geral">
          <ChartBox title="Km totais por semana (todos os atletas)" empty={weeks.every((w) => w.km === 0)}>
            <LineSeries data={weeks} xKey="label" series={[{ key: 'km', name: 'Km' }]} formatY={(v) => `${v}`} />
          </ChartBox>
          <div className="mt-4">
            <ChartBox title="Treinos registrados por semana" empty={weeks.every((w) => w.sessions === 0)}>
              <BarSeries data={weeks} xKey="label" series={[{ key: 'sessions', name: 'Treinos' }]} />
            </ChartBox>
          </div>
        </Section>

        <div className="space-y-5">
          <Section title="Atletas que precisam de acompanhamento">
            {needsAttention.length === 0 ? (
              <EmptyState title="Tudo em dia" text="Nenhum atleta ativo com pendências recentes." icon={<CheckCircle2 size={24} />} />
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {needsAttention.map(({ a, reasons }) => (
                  <li key={a.id} className="flex items-start gap-3 py-2.5">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-brand-500" />
                    <div className="min-w-0 flex-1">
                      <Link to={`/professor/atletas/${a.id}`} className="font-semibold hover:underline">{a.full_name}</Link>
                      <p className="text-sm text-gray-500">{reasons.join(' • ')}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Próximos treinamentos">
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum treino programado.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {upcoming.slice(0, 6).map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{w.name}</p>
                      <p className="truncate text-sm text-gray-500">{nameOf(w.athlete_id)} • {workoutTypeLabel(w.workout_type)}</p>
                    </div>
                    <Badge tone="orange">{formatDateBR(w.scheduled_date).slice(0, 5)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <Section title="Últimos resultados registrados" className="mt-5">
        {recent.length === 0 ? (
          <p className="text-sm text-gray-500">Os registros dos atletas aparecerão aqui.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="th">Data</th><th className="th">Atleta</th><th className="th">Distância</th><th className="th">Tempo</th><th className="th">Ritmo</th><th className="th">Situação</th></tr></thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id} className="border-b border-gray-100 dark:border-gray-800/60">
                    <td className="td">{formatDateBR(l.log_date)}</td>
                    <td className="td font-semibold"><Link to={`/professor/atletas/${l.athlete_id}`} className="hover:underline">{nameOf(l.athlete_id)}</Link></td>
                    <td className="td">{formatDistance(l.distance_m)}</td>
                    <td className="td">{formatDuration(l.time_s)}</td>
                    <td className="td">{formatPace(l.avg_pace_s)}</td>
                    <td className="td"><Badge tone={l.status === 'concluido' ? 'green' : l.status === 'parcial' ? 'yellow' : 'red'}>{logStatusLabel(l.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
