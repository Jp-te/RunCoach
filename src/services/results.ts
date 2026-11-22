import { supabase } from '../integrations/supabase/client';
import type { ResultRow } from '../types';
import { fetchAll, unwrap } from './db';

export const listResults = (opts: { athleteId?: string; from?: string; to?: string } = {}) =>
  fetchAll<ResultRow>((f, t) => {
    let q = supabase.from('results').select('*').order('result_date', { ascending: false });
    if (opts.athleteId) q = q.eq('athlete_id', opts.athleteId);
    if (opts.from) q = q.gte('result_date', opts.from);
    if (opts.to) q = q.lte('result_date', opts.to);
    return q.range(f, t);
  });

export type ResultInput = Pick<ResultRow, 'modality_id' | 'result_date' | 'time_s' | 'is_competition' | 'competition_name' | 'notes'>;

export async function saveResult(professorId: string, athleteId: string, input: ResultInput, id?: string) {
  if (id) unwrap(await supabase.from('results').update(input).eq('id', id));
  else unwrap(await supabase.from('results').insert({ ...input, professor_id: professorId, athlete_id: athleteId }));
}
export const deleteResult = async (id: string) => void unwrap(await supabase.from('results').delete().eq('id', id));

/** Marca pessoal (menor tempo) por modalidade. */
export function personalBests(rows: ResultRow[]): Record<string, number> {
  const best: Record<string, number> = {};
  rows.forEach((r) => {
    if (!r.modality_id) return;
    if (best[r.modality_id] == null || r.time_s < best[r.modality_id]) best[r.modality_id] = r.time_s;
  });
  return best;
}
