import { supabase } from '../integrations/supabase/client';
import type { PlanData, TrainingPlan } from '../types/plan';
import { planToWorkouts } from '../utils/planParser';
import { assignSheet, createSheet } from './training';
import { unwrap } from './db';

export const listPlans = async (athleteId: string) =>
  unwrap<TrainingPlan[]>(
    await supabase.from('training_plans').select('*').eq('athlete_id', athleteId).order('created_at', { ascending: false })
  ) ?? [];

export async function savePlan(
  professorId: string, athleteId: string, data: PlanData, sourceFile: string | null, startDate: string | null
): Promise<string> {
  const row = unwrap<{ id: string }>(
    await supabase
      .from('training_plans')
      .insert({ professor_id: professorId, athlete_id: athleteId, title: data.title.slice(0, 200), source_file: sourceFile, start_date: startDate, data })
      .select('id')
      .single()
  );
  return row.id;
}

export const deletePlan = async (id: string) => void unwrap(await supabase.from('training_plans').delete().eq('id', id));

/** Cria uma planilha com todos os treinos do plano e atribui ao atleta (uma segunda-feira inicial). */
export async function generateWorkoutsFromPlan(
  professorId: string, athleteId: string, data: PlanData, startDate: string, planId?: string
): Promise<number> {
  const items = planToWorkouts(data);
  if (!items.length) throw new Error('Este plano não tem treinos com dia da semana reconhecido.');
  const sheetId = await createSheet(professorId, `${data.title} (importada de PDF)`.slice(0, 200), 'personalizada', 'Gerada a partir de um PDF importado.');
  unwrap(
    await supabase.from('sheet_items').insert(
      items.map((it) => ({ ...it.fields, professor_id: professorId, sheet_id: sheetId, day_offset: it.dayOffset }))
    )
  );
  const n = await assignSheet(sheetId, [athleteId], startDate);
  if (planId) unwrap(await supabase.from('training_plans').update({ generated_at: new Date().toISOString(), start_date: startDate }).eq('id', planId));
  return n;
}
