import { supabase } from '../integrations/supabase/client';
import type { Athlete, AthleteGroup, Category, GroupMember, Modality } from '../types';
import { fetchAll, unwrap } from './db';

export type AthleteInput = Omit<Athlete, 'id' | 'professor_id' | 'user_id' | 'created_at' | 'is_demo'>;

export const listAthletes = () =>
  fetchAll<Athlete>((f, t) => supabase.from('athletes').select('*').order('full_name').range(f, t));

export async function getAthlete(id: string): Promise<Athlete | null> {
  return unwrap<Athlete | null>(await supabase.from('athletes').select('*').eq('id', id).maybeSingle());
}

/** Observações privadas do professor (tabela separada: o atleta não consegue lê-las). */
export async function listNotes(): Promise<Record<string, string>> {
  const rows = await fetchAll<{ athlete_id: string; notes: string }>((f, t) =>
    supabase.from('athlete_notes').select('athlete_id,notes').range(f, t)
  );
  return Object.fromEntries(rows.map((r) => [r.athlete_id, r.notes]));
}

export async function saveAthlete(professorId: string, input: AthleteInput, notes: string | null, id?: string): Promise<void> {
  const payload = { ...input, email: input.email.trim().toLowerCase() };
  let athleteId = id;
  if (id) unwrap(await supabase.from('athletes').update(payload).eq('id', id));
  else {
    const row = unwrap<{ id: string }>(
      await supabase.from('athletes').insert({ ...payload, professor_id: professorId }).select('id').single()
    );
    athleteId = row.id;
  }
  if (notes && notes.trim())
    unwrap(
      await supabase
        .from('athlete_notes')
        .upsert({ athlete_id: athleteId, professor_id: professorId, notes: notes.trim() }, { onConflict: 'athlete_id' })
    );
  else unwrap(await supabase.from('athlete_notes').delete().eq('athlete_id', athleteId!));
}

export async function deleteAthlete(id: string): Promise<void> {
  unwrap(await supabase.from('athletes').delete().eq('id', id));
}

export async function deleteDemoAthletes(): Promise<void> {
  unwrap(await supabase.from('athletes').delete().eq('is_demo', true));
}

// ---------- categorias ----------
export const listCategories = async () =>
  unwrap<Category[]>(await supabase.from('categories').select('*').order('name')) ?? [];
export const addCategory = async (professorId: string, name: string) =>
  void unwrap(await supabase.from('categories').insert({ professor_id: professorId, name: name.trim() }));
export const deleteCategory = async (id: string) => void unwrap(await supabase.from('categories').delete().eq('id', id));

// ---------- modalidades / provas ----------
export const listModalities = async () =>
  unwrap<Modality[]>(await supabase.from('modalities').select('*').order('distance_m', { nullsFirst: false }).order('name')) ?? [];
export const addModality = async (professorId: string, name: string, distance_m: number | null, kind: string) =>
  void unwrap(await supabase.from('modalities').insert({ professor_id: professorId, name: name.trim(), distance_m, kind }));
export const deleteModality = async (id: string) => void unwrap(await supabase.from('modalities').delete().eq('id', id));

// ---------- grupos ----------
export const listGroups = async () =>
  unwrap<AthleteGroup[]>(await supabase.from('athlete_groups').select('*').order('name')) ?? [];
export const listGroupMembers = () =>
  fetchAll<GroupMember>((f, t) => supabase.from('group_members').select('group_id,athlete_id').range(f, t));
export const addGroup = async (professorId: string, name: string) =>
  void unwrap(await supabase.from('athlete_groups').insert({ professor_id: professorId, name: name.trim() }));
export const deleteGroup = async (id: string) => void unwrap(await supabase.from('athlete_groups').delete().eq('id', id));

/** Substitui os membros de um grupo. */
export async function setGroupMembers(professorId: string, groupId: string, athleteIds: string[]): Promise<void> {
  unwrap(await supabase.from('group_members').delete().eq('group_id', groupId));
  if (athleteIds.length)
    unwrap(
      await supabase
        .from('group_members')
        .insert(athleteIds.map((athlete_id) => ({ group_id: groupId, athlete_id, professor_id: professorId })))
    );
}

/** Expande atletas individuais + grupos em uma lista única de IDs de atletas. */
export function expandTargets(athleteIds: string[], groupIds: string[], members: GroupMember[]): string[] {
  const set = new Set(athleteIds);
  members.filter((m) => groupIds.includes(m.group_id)).forEach((m) => set.add(m.athlete_id));
  return [...set];
}
