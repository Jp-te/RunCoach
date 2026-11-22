import { useState, type FormEvent } from 'react';
import type { LogStatus, WorkoutLog } from '../types';
import type { LogInput } from '../services/training';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { LOG_STATUS, RPE_LABELS } from '../utils/constants';
import {
  computePace, distanceToMeters, formatDuration, formatPace, metersToField, parseDuration, todayISO, type DistUnit,
} from '../utils/format';

interface Props {
  initial?: WorkoutLog | null;
  defaultDate?: string;
  plannedDistanceM?: number | null;
  onSubmit: (input: LogInput) => Promise<void>;
  onCancel: () => void;
}

/** Registro de treino realizado pelo atleta. */
export default function LogForm({ initial, defaultDate, plannedDistanceM, onSubmit, onCancel }: Props) {
  const d0 = metersToField(initial?.distance_m ?? plannedDistanceM ?? null);
  const [date, setDate] = useState(initial?.log_date ?? defaultDate ?? todayISO());
  const [dist, setDist] = useState(initial ? metersToField(initial.distance_m).value : '');
  const [unit, setUnit] = useState<DistUnit>(initial ? metersToField(initial.distance_m).unit : d0.unit);
  const [time, setTime] = useState(initial?.time_s != null ? formatDuration(initial.time_s) : '');
  const [pace, setPace] = useState(initial?.avg_pace_s != null ? formatPace(initial.avg_pace_s).replace('/km', '') : '');
  const [rpe, setRpe] = useState(initial?.rpe != null ? String(initial.rpe) : '');
  const [status, setStatus] = useState<LogStatus>(initial?.status ?? 'concluido');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const distM = distanceToMeters(dist, unit);
  const timeS = time.trim() ? parseDuration(time) : null;
  const autoPace = computePace(distM, timeS);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!date) errs.date = 'Informe a data.';
    if (dist.trim() && distM == null) errs.dist = 'Distância inválida.';
    if (time.trim() && timeS == null) errs.time = 'Use mm:ss ou h:mm:ss.';
    let paceS = pace.trim() ? parseDuration(pace) : null;
    if (pace.trim() && paceS == null) errs.pace = 'Use mm:ss (ex.: 5:30).';
    if (rpe && (!/^\d+$/.test(rpe) || Number(rpe) < 1 || Number(rpe) > 10)) errs.rpe = 'Escolha de 1 a 10.';
    if (status !== 'nao_realizado' && !dist.trim() && !time.trim()) errs.dist = 'Informe a distância ou o tempo.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (paceS == null) paceS = autoPace;

    setBusy(true);
    setFormError('');
    try {
      await onSubmit({
        log_date: date,
        distance_m: distM,
        time_s: timeS,
        avg_pace_s: paceS,
        rpe: rpe ? Number(rpe) : null,
        notes: notes.trim() || null,
        status,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data" error={errors.date}>
          <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Situação">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as LogStatus)}>
            {LOG_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <div>
          <span className="label">Distância realizada</span>
          <div className="flex gap-2">
            <input className="input" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} aria-label="Distância realizada" placeholder="5" />
            <select className="input w-24" value={unit} onChange={(e) => setUnit(e.target.value as DistUnit)} aria-label="Unidade">
              <option value="km">km</option>
              <option value="m">m</option>
            </select>
          </div>
          {errors.dist && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.dist}</span>}
        </div>
        <Field label="Tempo realizado" error={errors.time} hint="mm:ss ou h:mm:ss">
          <input className="input" value={time} onChange={(e) => setTime(e.target.value)} placeholder="30:00" />
        </Field>
        <Field label="Ritmo médio (por km)" error={errors.pace} hint={autoPace ? `Calculado: ${formatPace(autoPace)}` : 'Calculado automaticamente se vazio.'}>
          <input className="input" value={pace} onChange={(e) => setPace(e.target.value)} placeholder="5:30" />
        </Field>
        <Field label="Percepção de esforço (1–10)" error={errors.rpe} hint={rpe && RPE_LABELS[Number(rpe)] ? RPE_LABELS[Number(rpe)] : undefined}>
          <select className="input" value={rpe} onChange={(e) => setRpe(e.target.value)}>
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} — {RPE_LABELS[n]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Como se sentiu, clima, dores, local..." />
        </Field>
      </div>
      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={busy}>
          Salvar registro
        </Button>
      </div>
    </form>
  );
}
