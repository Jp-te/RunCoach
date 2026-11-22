import { useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { listModalities } from '../services/athletes';
import { listLogs, listWorkouts } from '../services/training';
import { listResults, personalBests } from '../services/results';
import { listEnrollments, listExams, listGoals, listTafResults, listTests } from '../services/taf';
import { errorMessage } from '../services/db';
import { addDays, formatDateBR, formatDateShort, formatDuration, formatPace, todayISO } from '../utils/format';
import { formatTafValue, meetsMin, remainingToGoal } from '../utils/taf';
import { periodStats, previousPeriod, weeklySeries, type PeriodStats } from '../utils/report';
import { exportReportPdf } from '../utils/pdf';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { Badge, ErrorBox, Section, Spinner } from './ui/Misc';
import { BarSeries, ChartBox, LineSeries } from './charts';

function Delta({ cur, prev, unit = '', invert = false }: { cur: number | null; prev: number | null; unit?: string; invert?: boolean }) {
  if (cur == null || prev == null) return <span className="text-gray-400">—</span>;
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return <span className="text-gray-500">igual</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={good ? 'text-green-600' : 'text-red-600'}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d)}
      {unit}
    </span>
  );
}

/** Relatório individual com filtros, gráficos, comparação entre períodos e exportação em PDF. */
export default function AthleteReport({ athleteId, athleteName }: { athleteId: string; athleteName: string }) {
  const toast = useToast();
  const [from, setFrom] = useState(addDays(todayISO(), -89));
  const [to, setTo] = useState(todayISO());
  const [modalityId, setModalityId] = useState('');
  const [chartModality, setChartModality] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const [logs, workouts, results, modalities, exams, tests, enr, goals, tafRes] = await Promise.all([
      listLogs({ athleteId }), listWorkouts({ athleteId }), listResults({ athleteId }), listModalities(),
      listExams(), listTests(), listEnrollments(), listGoals(athleteId), listTafResults(athleteId),
    ]);
    const mine = new Set(enr.filter((e) => e.athlete_id === athleteId).map((e) => e.exam_id));
    return { logs, workouts, results, modalities, exams: exams.filter((x) => mine.has(x.id)), tests, goals, tafRes };
  }, [athleteId]);

  const valid = from && to && from <= to;
  const calc = useMemo(() => {
    if (!data || !valid) return null;
    const prev = previousPeriod(from, to);
    const cur: PeriodStats = periodStats(data.logs, data.workouts, from, to, modalityId);
    const before: PeriodStats = periodStats(data.logs, data.workouts, prev.from, prev.to, modalityId);
    const weeks = weeklySeries(data.logs, data.workouts, from, to, modalityId);
    const results = data.results.filter((r) => r.result_date >= from && r.result_date <= to && (!modalityId || r.modality_id === modalityId));
    return { prev, cur, before, weeks, results };
  }, [data, from, to, modalityId, valid]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return null;

  const modName = (id: string | null) => data.modalities.find((m) => m.id === id)?.name ?? '—';
  const modsWithResults = [...new Set(data.results.map((r) => r.modality_id).filter(Boolean))] as string[];
  const timeModality = chartModality || modalityId || modsWithResults[0] || '';
  const timeSeries = data.results
    .filter((r) => r.modality_id === timeModality && r.result_date >= from && r.result_date <= to)
    .sort((a, b) => a.result_date.localeCompare(b.result_date))
    .map((r) => ({ d: formatDateShort(r.result_date), t: r.time_s }));
  const pbs = personalBests(data.results);

  const tafRows = data.exams.flatMap((ex) =>
    data.tests
      .filter((t) => t.exam_id === ex.id)
      .map((t) => {
        const rs = data.tafRes.filter((r) => r.test_id === t.id).sort((a, b) => b.result_date.localeCompare(a.result_date));
        const current = rs[0]?.value ?? null;
        const goal = data.goals.find((g) => g.test_id === t.id)?.goal_value ?? null;
        const rem = remainingToGoal(t.better, current, goal);
        const ok = meetsMin(t.better, current, t.min_value);
        return { ex, t, current, goal, reached: rem != null && rem <= 0, ok };
      })
  );
  const goalsSet = tafRows.filter((r) => r.goal != null);
  const goalsReached = goalsSet.filter((r) => r.reached).length;

  async function exportPdf() {
    if (!calc) return;
    setExporting(true);
    try {
      await exportReportPdf({
        athleteName,
        from, to,
        modalityLabel: modalityId ? modName(modalityId) : 'Todas',
        current: calc.cur,
        previous: calc.before,
        weeks: calc.weeks,
        results: calc.results.map((r) => ({ date: r.result_date, modality: modName(r.modality_id), time_s: r.time_s, competition: r.competition_name ?? (r.is_competition ? 'Sim' : '') })),
        taf: tafRows.map((r) => ({
          exam: r.ex.name, test: r.t.name,
          min: r.t.min_value != null ? formatTafValue(r.t.kind, r.t.min_value) : '—',
          current: formatTafValue(r.t.kind, r.current),
          goal: r.goal != null ? formatTafValue(r.t.kind, r.goal) : '—',
          status: r.ok == null ? '—' : r.ok ? 'Atinge o mínimo' : 'Abaixo do mínimo',
        })),
      });
      toast.success('PDF gerado.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <Field label="De" className="w-40">
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Até" className="w-40">
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Modalidade" className="w-56">
          <select className="input" value={modalityId} onChange={(e) => setModalityId(e.target.value)}>
            <option value="">Todas</option>
            {data.modalities.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
        <div className="flex gap-1.5">
          {[30, 90, 180].map((n) => (
            <Button key={n} size="sm" variant="secondary" onClick={() => { setFrom(addDays(todayISO(), -(n - 1))); setTo(todayISO()); }}>
              {n} dias
            </Button>
          ))}
        </div>
        <Button className="ml-auto" onClick={exportPdf} loading={exporting} disabled={!calc}>
          <FileDown size={16} /> Exportar PDF
        </Button>
      </div>

      {!valid && <ErrorBox message="O período é inválido: a data inicial deve ser anterior à final." />}

      {calc && (
        <>
          <Section title="Comparação entre períodos">
            <p className="mb-3 text-xs text-gray-500">
              Atual: {formatDateBR(from)} a {formatDateBR(to)} • Anterior: {formatDateBR(calc.prev.from)} a {formatDateBR(calc.prev.to)}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="th">Indicador</th><th className="th">Atual</th><th className="th">Anterior</th><th className="th">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100 dark:border-gray-800/60"><td className="td">Distância total</td><td className="td font-semibold">{calc.cur.km.toFixed(1)} km</td><td className="td">{calc.before.km.toFixed(1)} km</td><td className="td"><Delta cur={calc.cur.km} prev={calc.before.km} unit=" km" /></td></tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800/60"><td className="td">Treinos realizados</td><td className="td font-semibold">{calc.cur.sessions}</td><td className="td">{calc.before.sessions}</td><td className="td"><Delta cur={calc.cur.sessions} prev={calc.before.sessions} /></td></tr>
                  <tr className="border-b border-gray-100 dark:border-gray-800/60"><td className="td">Conclusão das planilhas</td><td className="td font-semibold">{calc.cur.completionPct != null ? `${calc.cur.completionPct}%` : '—'}</td><td className="td">{calc.before.completionPct != null ? `${calc.before.completionPct}%` : '—'}</td><td className="td"><Delta cur={calc.cur.completionPct} prev={calc.before.completionPct} unit=" p.p." /></td></tr>
                  <tr><td className="td">Ritmo médio</td><td className="td font-semibold">{formatPace(calc.cur.avgPaceS)}</td><td className="td">{formatPace(calc.before.avgPaceS)}</td><td className="td"><Delta cur={calc.cur.avgPaceS} prev={calc.before.avgPaceS} unit=" s/km" invert /></td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Conclusão = treinos planejados (até hoje) que têm registro de realização: {calc.cur.done} de {calc.cur.planned}.
            </p>
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Evolução das distâncias">
              <ChartBox title="Km por semana — planejado × realizado" empty={calc.weeks.every((w) => w.km === 0 && w.plannedKm === 0)}>
                <BarSeries data={calc.weeks} xKey="label" series={[{ key: 'plannedKm', name: 'Planejado (km)' }, { key: 'km', name: 'Realizado (km)' }]} />
              </ChartBox>
            </Section>
            <Section title="Frequência de treinamento">
              <ChartBox title="Treinos realizados por semana" empty={calc.weeks.every((w) => w.sessions === 0)}>
                <BarSeries data={calc.weeks} xKey="label" series={[{ key: 'sessions', name: 'Treinos' }]} />
              </ChartBox>
            </Section>
          </div>

          <Section
            title="Evolução dos tempos"
            actions={
              <select className="input w-52" value={timeModality} onChange={(e) => setChartModality(e.target.value)} aria-label="Modalidade do gráfico">
                {modsWithResults.length === 0 && <option value="">Sem resultados</option>}
                {modsWithResults.map((id) => (
                  <option key={id} value={id}>{modName(id)}</option>
                ))}
              </select>
            }
          >
            <ChartBox title={timeModality ? `Tempos — ${modName(timeModality)} (menor é melhor)` : 'Tempos'} empty={timeSeries.length === 0}>
              <LineSeries data={timeSeries} xKey="d" series={[{ key: 't', name: 'Tempo' }]} formatY={formatDuration} reversed />
            </ChartBox>
            {Object.keys(pbs).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(pbs).map(([id, t]) => (
                  <Badge key={id} tone="orange">PB {modName(id)}: {formatDuration(t)}</Badge>
                ))}
              </div>
            )}
          </Section>

          <Section title="Histórico de resultados">
            {calc.results.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum resultado no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                  <thead><tr className="border-b border-gray-200 dark:border-gray-800"><th className="th">Data</th><th className="th">Prova</th><th className="th">Tempo</th><th className="th">Competição</th></tr></thead>
                  <tbody>
                    {calc.results.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800/60">
                        <td className="td">{formatDateBR(r.result_date)}</td>
                        <td className="td">{modName(r.modality_id)}</td>
                        <td className="td font-semibold">{formatDuration(r.time_s)} {r.modality_id && pbs[r.modality_id] === r.time_s && <Badge tone="green">PB</Badge>}</td>
                        <td className="td">{r.is_competition ? r.competition_name || 'Sim' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Metas alcançadas (TAF)">
            {goalsSet.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma meta de TAF definida para este atleta.</p>
            ) : (
              <>
                <p className="mb-2 text-sm"><b>{goalsReached}</b> de <b>{goalsSet.length}</b> metas atingidas (pelo resultado mais recente).</p>
                <ul className="space-y-1 text-sm">
                  {goalsSet.map((r) => (
                    <li key={r.t.id} className="flex flex-wrap items-center gap-2">
                      {r.reached ? <Badge tone="green">Atingida</Badge> : <Badge tone="gray">Em andamento</Badge>}
                      {r.ex.name} — {r.t.name}: {formatTafValue(r.t.kind, r.current)} / meta {formatTafValue(r.t.kind, r.goal)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
