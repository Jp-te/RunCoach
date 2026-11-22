import { useState, type FormEvent } from 'react';
import type { Athlete, Modality, ResultRow } from '../types';
import type { ResultInput } from '../services/results';
import { Button } from './ui/Button';
import { Field } from './ui/Field';
import { formatDuration, parseDuration, todayISO } from '../utils/format';

interface Props {
  modalities: Modality[];
  /** Quando informado, o professor escolhe o atleta. */
  athletes?: Athlete[];
  initial?: ResultRow;
  onSubmit: (athleteId: string | null, input: ResultInput) => Promise<void>;
  onCancel: () => void;
}

export default function ResultForm({ modalities, athletes, initial, onSubmit, onCancel }: Props) {
  const [athleteId, setAthleteId] = useState(initial?.athlete_id ?? '');
  const [modalityId, setModalityId] = useState(initial?.modality_id ?? '');
  const [date, setDate] = useState(initial?.result_date ?? todayISO());
  const [time, setTime] = useState(initial ? formatDuration(initial.time_s) : '');
  const [competition, setCompetition] = useState(initial?.is_competition ?? false);
  const [compName, setCompName] = useState(initial?.competition_name ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (athletes && !athleteId) errs.athlete = 'Escolha o atleta.';
    if (!modalityId) errs.modality = 'Escolha a modalidade/prova.';
    if (!date) errs.date = 'Informe a data.';
    const t = parseDuration(time);
    if (t == null || t <= 0) errs.time = 'Informe o tempo (mm:ss ou h:mm:ss).';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError('');
    try {
      await onSubmit(athletes ? athleteId : null, {
        modality_id: modalityId,
        result_date: date,
        time_s: t!,
        is_competition: competition,
        competition_name: competition && compName.trim() ? compName.trim() : null,
        notes: notes.trim() || null,
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
        {athletes && (
          <Field label="Atleta" error={errors.athlete} className="sm:col-span-2">
            <select className="input" value={athleteId} onChange={(e) => setAthleteId(e.target.value)}>
              <option value="">— escolher —</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Modalidade / prova" error={errors.modality}>
          <select className="input" value={modalityId} onChange={(e) => setModalityId(e.target.value)}>
            <option value="">— escolher —</option>
            {modalities.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data" error={errors.date}>
          <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Tempo" error={errors.time} hint="mm:ss, h:mm:ss ou segundos com decimal (ex.: 11,8)">
          <input className="input" value={time} onChange={(e) => setTime(e.target.value)} placeholder="22:30" />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input type="checkbox" checked={competition} onChange={(e) => setCompetition(e.target.checked)} />
          Resultado de competição
        </label>
        {competition && (
          <Field label="Nome da competição" className="sm:col-span-2">
            <input className="input" value={compName} onChange={(e) => setCompName(e.target.value)} />
          </Field>
        )}
        <Field label="Observações" className="sm:col-span-2">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
          Salvar resultado
        </Button>
      </div>
    </form>
  );
}
