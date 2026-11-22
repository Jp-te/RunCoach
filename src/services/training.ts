import { supabase } from '../integrations/supabase/client';
import type { Sheet, SheetItem, Workout, WorkoutFields, WorkoutLog, WorkoutTemplate } from '../types';
import { addDays } from '../utils/format';
import { fetchAll, unwrap } from './db';

// ---------- treinos agendados ----------
export const listWorkouts = (opts: { from?: string; to?: string; athleteId?: string } = {}) =>
  fetchAll<Workout>((f, t) => {
    let q = supabase.from('workouts').select('*').order('scheduled_date').order('created_at');
    if (opts.from) q = q.gte('scheduled_date', opts.from);
    if (opts.to) q = q.lte('scheduled_date', opts.to);
    if (opts.athleteId) q = q.eq('athlete_id', opts.athleteId);
    return q.range(f, t);
  });

export async function saveWorkout(professorId: string, athleteId: string, date: string, fields: WorkoutFields, id?: string) {
  if (id) unwrap(await supabase.from('workouts').update({ ...fields, scheduled_date: date }).eq('id', id));
  else
    unwrap(
      await supabase.from('workouts').insert({ ...fields, professor_id: professorId, athlete_id: athleteId, scheduled_date: date })
    );
}
export const deleteWorkout = async (id: string) => void unwrap(await supabase.from('workouts').delete().eq('id', id));

/** Cria o mesmo treino para vários atletas e envia uma notificação a cada um. */
export async function scheduleForAthletes(professorId: string, athleteIds: string[], date: string, fields: WorkoutFields) {
  if (!athleteIds.length) throw new Error('Selecione ao menos um atleta ou grupo.');
  unwrap(
    await supabase
      .from('workouts')
      .insert(athleteIds.map((athlete_id) => ({ ...fields, professor_id: professorId, athlete_id, scheduled_date: date })))
  );
  unwrap(
    await supabase.from('messages').insert(
      athleteIds.map((athlete_id) => ({
        professor_id: professorId,
        athlete_id,
        sender_id: professorId,
        kind: 'notificacao',
        body: `Novo treino agendado: "${fields.name}" em ${date.split('-').reverse().join('/')}.`,
      }))
    )
  );
}

export async function copyWeek(athleteId: string, fromStart: string, toStart: string): Promise<number> {
  const n = unwrap<number>(
    await supabase.rpc('copy_week', { p_athlete_id: athleteId, p_from_start: fromStart, p_to_start: toStart })
  );
  return n ?? 0;
}

// ---------- registros de treino realizado ----------
export const listLogs = (opts: { from?: string; to?: string; athleteId?: string } = {}) =>
  fetchAll<WorkoutLog>((f, t) => {
    let q = supabase.from('workout_logs').select('*').order('log_date', { ascending: false });
    if (opts.from) q = q.gte('log_date', opts.from);
    if (opts.to) q = q.lte('log_date', opts.to);
    if (opts.athleteId) q = q.eq('athlete_id', opts.athleteId);
    return q.range(f, t);
  });

export type LogInput = Pick<WorkoutLog, 'log_date' | 'distance_m' | 'time_s' | 'avg_pace_s' | 'rpe' | 'notes' | 'status'>;

export async function saveLog(professorId: string, athleteId: string, workoutId: string | null, input: LogInput, id?: string) {
  if (id) unwrap(await supabase.from('workout_logs').update(input).eq('id', id));
  else
    unwrap(
      await supabase
        .from('workout_logs')
        .insert({ ...input, professor_id: professorId, athlete_id: athleteId, workout_id: workoutId })
    );
}
export const deleteLog = async (id: string) => void unwrap(await supabase.from('workout_logs').delete().eq('id', id));

// ---------- modelos de treino ----------
export const listTemplates = async () =>
  unwrap<WorkoutTemplate[]>(await supabase.from('workout_templates').select('*').order('name')) ?? [];
export async function saveTemplate(professorId: string, fields: WorkoutFields, id?: string) {
  if (id) unwrap(await supabase.from('workout_templates').update(fields).eq('id', id));
  else unwrap(await supabase.from('workout_templates').insert({ ...fields, professor_id: professorId }));
}
export const deleteTemplate = async (id: string) => void unwrap(await supabase.from('workout_templates').delete().eq('id', id));

// ---------- planilhas ----------
export const listSheets = async () => unwrap<Sheet[]>(await supabase.from('sheets').select('*').order('name')) ?? [];
export const listAllSheetItemCounts = async (): Promise<Record<string, number>> => {
  const rows = await fetchAll<{ sheet_id: string }>((f, t) => supabase.from('sheet_items').select('sheet_id').range(f, t));
  const out: Record<string, number> = {};
  rows.forEach((r) => (out[r.sheet_id] = (out[r.sheet_id] ?? 0) + 1));
  return out;
};
export async function getSheet(id: string): Promise<Sheet | null> {
  return unwrap<Sheet | null>(await supabase.from('sheets').select('*').eq('id', id).maybeSingle());
}
export async function createSheet(professorId: string, name: string, kind: string, description: string | null): Promise<string> {
  const row = unwrap<{ id: string }>(
    await supabase.from('sheets').insert({ professor_id: professorId, name, kind, description }).select('id').single()
  );
  return row.id;
}
export const updateSheet = async (id: string, name: string, kind: string, description: string | null) =>
  void unwrap(await supabase.from('sheets').update({ name, kind, description }).eq('id', id));
export const deleteSheet = async (id: string) => void unwrap(await supabase.from('sheets').delete().eq('id', id));

export const listSheetItems = async (sheetId: string) =>
  unwrap<SheetItem[]>(
    await supabase.from('sheet_items').select('*').eq('sheet_id', sheetId).order('day_offset').order('created_at')
  ) ?? [];

export async function saveSheetItem(professorId: string, sheetId: string, dayOffset: number, fields: WorkoutFields, id?: string) {
  if (id) unwrap(await supabase.from('sheet_items').update({ ...fields, day_offset: dayOffset }).eq('id', id));
  else
    unwrap(
      await supabase.from('sheet_items').insert({ ...fields, professor_id: professorId, sheet_id: sheetId, day_offset: dayOffset })
    );
}
export const deleteSheetItem = async (id: string) => void unwrap(await supabase.from('sheet_items').delete().eq('id', id));

/** Copia os itens de uma semana da planilha (week = 0, 1, ...) para a semana seguinte. */
export async function duplicateSheetWeek(professorId: string, sheetId: string, items: SheetItem[], week: number) {
  const src = items.filter((i) => i.day_offset >= week * 7 && i.day_offset < week * 7 + 7);
  if (!src.length) throw new Error('Não há treinos nesta semana para copiar.');
  unwrap(
    await supabase.from('sheet_items').insert(
      src.map(({ id: _id, sheet_id: _s, ...rest }) => ({ ...rest, professor_id: professorId, sheet_id: sheetId, day_offset: rest.day_offset + 7 }))
    )
  );
  return src.length;
}

export async function assignSheet(sheetId: string, athleteIds: string[], startDate: string): Promise<number> {
  if (!athleteIds.length) throw new Error('Selecione ao menos um atleta ou grupo.');
  const n = unwrap<number>(
    await supabase.rpc('assign_sheet', { p_sheet_id: sheetId, p_athlete_ids: athleteIds, p_start_date: startDate })
  );
  return n ?? 0;
}

export { addDays };
