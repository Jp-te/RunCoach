import { supabase } from '../integrations/supabase/client';
import type { CalendarEvent, Message, MessageKind } from '../types';
import { fetchAll, unwrap } from './db';

// ---------- calendário ----------
export const listEvents = (from: string, to: string) =>
  fetchAll<CalendarEvent>((f, t) =>
    supabase.from('calendar_events').select('*').gte('event_date', from).lte('event_date', to).order('event_date').range(f, t)
  );

export type EventInput = Omit<CalendarEvent, 'id' | 'professor_id'>;
export async function saveEvent(professorId: string, input: EventInput, id?: string) {
  if (id) unwrap(await supabase.from('calendar_events').update(input).eq('id', id));
  else unwrap(await supabase.from('calendar_events').insert({ ...input, professor_id: professorId }));
}
export const deleteEvent = async (id: string) => void unwrap(await supabase.from('calendar_events').delete().eq('id', id));

// ---------- mensagens ----------
export const listMessages = (athleteId?: string) =>
  fetchAll<Message>((f, t) => {
    let q = supabase.from('messages').select('*').order('created_at', { ascending: false });
    if (athleteId) q = q.eq('athlete_id', athleteId);
    return q.range(f, t);
  });

export async function sendMessage(professorId: string, athleteId: string, senderId: string, kind: MessageKind, body: string) {
  unwrap(
    await supabase
      .from('messages')
      .insert({ professor_id: professorId, athlete_id: athleteId, sender_id: senderId, kind, body: body.trim() })
  );
}

/** Marca como lidas as mensagens recebidas (enviadas por outra pessoa). */
export async function markRead(athleteId: string, myId: string) {
  unwrap(
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('athlete_id', athleteId)
      .neq('sender_id', myId)
      .is('read_at', null)
  );
}

/** Quantidade de mensagens não lidas recebidas. */
export async function unreadCount(myId: string): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', myId)
    .is('read_at', null);
  if (error) return 0;
  return count ?? 0;
}
