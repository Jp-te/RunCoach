import { useState, type FormEvent } from 'react';
import type { Modality, WorkoutFields, WorkoutTemplate } from '../types';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { INTENSITIES, WORKOUT_TYPES } from '../utils/constants';
import {
  computePace, distanceToMeters, formatDuration, formatPace, metersToField, parseDuration, parseIntOrNull, type DistUnit,
} from '../utils/format';

export type WorkoutFormMode = 'date' | 'offset' | 'none';

interface Props {
  initial?: Partial<WorkoutFields>;
  mode: WorkoutFormMode;
  initialDate?: string;
  initialOffset?: number;
  modalities: Modality[];
  templates?: WorkoutTemplate[];
  submitLabel?: string;
  onSubmit: (fields: WorkoutFields, extra: { date: string; dayOffset: number }) => Promise<void>;
  onSaveTemplate?: (fields: WorkoutFields) => Promise<void>;
  onCancel: () => void;
}

export default function WorkoutForm({
  initial, mode, initialDate = '', initialOffset = 0, modalities, templates = [], submitLabel = 'Salvar',
  onSubmit, onSaveTemplate, onCancel,
}: Props) {
  const d0 = metersToField(initial?.distance_m ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [modalityId, setModalityId] = useState(initial?.modality_id ?? '');
  const [type, setType] = useState(initial?.workout_type ?? 'corrida_continua');
  const [dist, setDist] = useState(d0.value);
  const [unit, setUnit] = useState<DistUnit>(d0.unit);
  const [time, setTime] = useState(initial?.planned_time_s != null ? formatDuration(initial.planned_time_s) : '');
  const [pace, setPace] = useState(initial?.planned_pace_s != null ? formatPace(initial.planned_pace_s).replace('/km', '') : '');
  const [intensity, setIntensity] = useState(initial?.intensity ?? '');
  const [sets, setSets] = useState(initial?.sets != null ? String(initial.sets) : '');
  const [reps, setReps] = useState(initial?.reps != null ? String(initial.reps) : '');
  const [rest, setRest] = useState(initial?.rest ?? '');
  const [warmup, setWarmup] = useState(initial?.warmup ?? '');
  const [mainPart, setMainPart] = useState(initial?.main_part ?? '');
  const [cooldown, setCooldown] = useState(initial?.cooldown ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [date, setDate] = useState(initialDate);
  const [offset, setOffset] = useState(String(initialOffset + 1));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    const dd = metersToField(t.distance_m);
    setName(t.name);
    setModalityId(t.modality_id ?? '');
    setType(t.workout_type);
    setDist(dd.value);
    setUnit(dd.unit);
    setTime(t.planned_time_s != null ? formatDuration(t.planned_time_s) : '');
    setPace(t.planned_pace_s != null ? formatPace(t.planned_pace_s).replace('/km', '') : '');
    setIntensity(t.intensity ?? '');
    setSets(t.sets != null ? String(t.sets) : '');
    setReps(t.reps != null ? String(t.reps) : '');
    setRest(t.rest ?? '');
    setWarmup(t.warmup ?? '');
    setMainPart(t.main_part ?? '');
    setCooldown(t.cooldown ?? '');
    setNotes(t.notes ?? '');
  }

  function build(): { fields: WorkoutFields; dayOffset: number } | null {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Informe o nome do treino.';
    const distanceM = distanceToMeters(dist, unit);
    if (dist.trim() && distanceM == null) errs.dist = 'Distância inválida.';
    const timeS = time.trim() ? parseDuration(time) : null;
    if (time.trim() && timeS == null) errs.time = 'Use o formato mm:ss ou h:mm:ss.';
    let paceS = pace.trim() ? parseDuration(pace) : null;
    if (pace.trim() && paceS == null) errs.pace = 'Use o formato mm:ss (ex.: 5:30).';
    if (paceS == null) paceS = computePace(distanceM, timeS);
    const setsN = parseIntOrNull(sets);
    if (sets.trim() && setsN == null) errs.sets = 'Número inteiro.';
    const repsN = parseIntOrNull(reps);
    if (reps.trim() && repsN == null) errs.reps = 'Número inteiro.';
    let dayOffset = 0;
    if (mode === 'date' && !date) errs.date = 'Informe a data.';
    if (mode === 'offset') {
      const n = parseIntOrNull(offset);
      if (n == null || n < 1) errs.offset = 'Dia ≥ 1.';
      else dayOffset = n - 1;
    }
    setErrors(errs);
    if (Object.keys(errs).length) return null;
    const nz = (v: string) => (v.trim() ? v.trim() : null);
    return {
      dayOffset,
      fields: {
        name: name.trim(),
        modality_id: modalityId || null,
        workout_type: type,
        distance_m: distanceM,
        planned_time_s: timeS,
        planned_pace_s: paceS,
        intensity: (intensity || null) as WorkoutFields['intensity'],
        sets: setsN,
        reps: repsN,
        rest: nz(rest),
        warmup: nz(warmup),
        main_part: nz(mainPart),
        cooldown: nz(cooldown),
        notes: nz(notes),
      },
    };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const built = build();
    if (!built) return;
    setBusy(true);
    try {
      await onSubmit(built.fields, { date, dayOffset: built.dayOffset });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate() {
    const built = build();
    if (!built || !onSaveTemplate) return;
    setBusy(true);
    try {
      await onSaveTemplate(built.fields);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar modelo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {templates.length > 0 && (
        <Field label="Começar de um modelo (opcional)">
          <select className="input" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— escolher modelo —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do treino" error={errors.name} className="sm:col-span-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Tiros de 400 m" />
        </Field>
        {mode === 'date' && (
          <Field label="Data" error={errors.date}>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
        {mode === 'offset' && (
          <Field label="Dia da planilha" error={errors.offset} hint="Dia 1 = primeiro dia; dia 8 = início da 2ª semana.">
            <input className="input" inputMode="numeric" value={offset} onChange={(e) => setOffset(e.target.value)} />
          </Field>
        )}
        <Field label="Modalidade">
          <select className="input" value={modalityId} onChange={(e) => setModalityId(e.target.value)}>
            <option value="">— não especificada —</option>
            {modalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo de treinamento">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {WORKOUT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Intensidade">
          <select className="input" value={intensity} onChange={(e) => setIntensity(e.target.value)}>
            <option value="">— não definida —</option>
            {INTENSITIES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <span className="label">Distância</span>
          <div className="flex gap-2">
            <input className="input" inputMode="decimal" value={dist} onChange={(e) => setDist(e.target.value)} aria-label="Distância" placeholder="5" />
            <select className="input w-24" value={unit} onChange={(e) => setUnit(e.target.value as DistUnit)} aria-label="Unidade">
              <option value="km">km</option>
              <option value="m">m</option>
            </select>
          </div>
          {errors.dist && <span role="alert" className="mt-1 block text-xs font-medium text-red-600">{errors.dist}</span>}
        </div>
        <Field label="Tempo previsto" error={errors.time} hint="mm:ss ou h:mm:ss">
          <input className="input" value={time} onChange={(e) => setTime(e.target.value)} placeholder="30:00" />
        </Field>
        <Field label="Ritmo previsto (por km)" error={errors.pace} hint="Se vazio, é calculado pela distância e tempo.">
          <input className="input" value={pace} onChange={(e) => setPace(e.target.value)} placeholder="5:30" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Séries" error={errors.sets}>
            <input className="input" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
          <Field label="Repetições" error={errors.reps}>
            <input className="input" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
        </div>
        <Field label="Intervalos de recuperação" className="sm:col-span-2">
          <input className="input" value={rest} onChange={(e) => setRest(e.target.value)} placeholder="Ex.: 90 s trote entre os tiros" />
        </Field>
        <Field label="Aquecimento" className="sm:col-span-2">
          <textarea className="input" rows={2} value={warmup} onChange={(e) => setWarmup(e.target.value)} />
        </Field>
        <Field label="Parte principal" className="sm:col-span-2">
          <textarea className="input" rows={3} value={mainPart} onChange={(e) => setMainPart(e.target.value)} />
        </Field>
        <Field label="Desaquecimento" className="sm:col-span-2">
          <textarea className="input" rows={2} value={cooldown} onChange={(e) => setCooldown(e.target.value)} />
        </Field>
        <Field label="Orientações adicionais" className="sm:col-span-2">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {formError}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {onSaveTemplate && (
          <Button variant="secondary" onClick={saveTemplate} disabled={busy}>
            Salvar como modelo
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
