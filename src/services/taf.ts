import { supabase } from '../integrations/supabase/client';
import type { TafExam, TafGoal, TafResult, TafTest } from '../types';
import { fetchAll, unwrap } from './db';

export const listExams = async () =>
  unwrap<TafExam[]>(await supabase.from('taf_exams').select('*').order('exam_date', { nullsFirst: false })) ?? [];
export async function getExam(id: string) {
  return unwrap<TafExam | null>(await supabase.from('taf_exams').select('*').eq('id', id).maybeSingle());
}
export type ExamInput = Omit<TafExam, 'id' | 'professor_id'>;
export async function saveExam(professorId: string, input: ExamInput, id?: string): Promise<string> {
  if (id) {
    unwrap(await supabase.from('taf_exams').update(input).eq('id', id));
    return id;
  }
  const row = unwrap<{ id: string }>(
    await supabase.from('taf_exams').insert({ ...input, professor_id: professorId }).select('id').single()
  );
  return row.id;
}
export const deleteExam = async (id: string) => void unwrap(await supabase.from('taf_exams').delete().eq('id', id));

export const listTests = async (examId?: string) => {
  let q = supabase.from('taf_tests').select('*').order('created_at');
  if (examId) q = q.eq('exam_id', examId);
  return unwrap<TafTest[]>(await q) ?? [];
};
export type TestInput = Omit<TafTest, 'id' | 'professor_id' | 'exam_id'>;
export async function saveTest(professorId: string, examId: string, input: TestInput, id?: string) {
  if (id) unwrap(await supabase.from('taf_tests').update(input).eq('id', id));
  else unwrap(await supabase.from('taf_tests').insert({ ...input, professor_id: professorId, exam_id: examId }));
}
export const deleteTest = async (id: string) => void unwrap(await supabase.from('taf_tests').delete().eq('id', id));

export const listEnrollments = async (examId?: string) => {
  let q = supabase.from('taf_enrollments').select('exam_id,athlete_id');
  if (examId) q = q.eq('exam_id', examId);
  return unwrap<{ exam_id: string; athlete_id: string }[]>(await q) ?? [];
};
export async function setEnrollments(professorId: string, examId: string, athleteIds: string[]) {
  unwrap(await supabase.from('taf_enrollments').delete().eq('exam_id', examId));
  if (athleteIds.length)
    unwrap(
      await supabase
        .from('taf_enrollments')
        .insert(athleteIds.map((athlete_id) => ({ exam_id: examId, athlete_id, professor_id: professorId })))
    );
}

export const listGoals = async (athleteId?: string) => {
  let q = supabase.from('taf_goals').select('*');
  if (athleteId) q = q.eq('athlete_id', athleteId);
  return unwrap<TafGoal[]>(await q) ?? [];
};
export async function setGoal(professorId: string, testId: string, athleteId: string, value: number | null) {
  if (value == null) {
    unwrap(await supabase.from('taf_goals').delete().eq('test_id', testId).eq('athlete_id', athleteId));
    return;
  }
  unwrap(
    await supabase
      .from('taf_goals')
      .upsert({ test_id: testId, athlete_id: athleteId, professor_id: professorId, goal_value: value }, { onConflict: 'test_id,athlete_id' })
  );
}

export const listTafResults = (athleteId?: string) =>
  fetchAll<TafResult>((f, t) => {
    let q = supabase.from('taf_results').select('*').order('result_date', { ascending: false });
    if (athleteId) q = q.eq('athlete_id', athleteId);
    return q.range(f, t);
  });
export async function addTafResult(professorId: string, testId: string, athleteId: string, date: string, value: number, notes: string | null) {
  unwrap(
    await supabase
      .from('taf_results')
      .insert({ test_id: testId, athlete_id: athleteId, professor_id: professorId, result_date: date, value, notes })
  );
}
export const deleteTafResult = async (id: string) => void unwrap(await supabase.from('taf_results').delete().eq('id', id));
