// Edge Function "send-push": envia a notificação push quando uma mensagem é criada.
// Acionada por um Database Webhook (tabela messages, evento INSERT) — veja docs/NOTIFICACOES.md.
// Secrets necessários (supabase secrets set ...): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT (mailto:seu@email), WEBHOOK_SECRET. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
// já existem automaticamente dentro da função (a service key NUNCA vai para o app).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

interface MessageRecord {
  id: string;
  professor_id: string;
  athlete_id: string;
  sender_id: string;
  kind: string;
  body: string;
}

const env = (k: string) => Deno.env.get(k) ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método não permitido', { status: 405 });
  if (!env('WEBHOOK_SECRET') || req.headers.get('x-webhook-secret') !== env('WEBHOOK_SECRET'))
    return new Response('Não autorizado', { status: 401 });

  const payload = await req.json().catch(() => null);
  const rec = payload?.record as MessageRecord | undefined;
  if (payload?.type !== 'INSERT' || !rec?.athlete_id) return new Response('ignorado', { status: 200 });

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

  // Quem recebe: se o professor escreveu -> o atleta; se o atleta escreveu -> o professor.
  let recipient: string | null = rec.professor_id;
  let title = 'Nova mensagem do atleta';
  let url = './#/professor/mensagens';
  if (rec.sender_id === rec.professor_id) {
    const { data: athlete } = await admin.from('athletes').select('user_id, status').eq('id', rec.athlete_id).maybeSingle();
    if (!athlete?.user_id || athlete.status !== 'ativo') return new Response('sem destinatário', { status: 200 });
    recipient = athlete.user_id;
    title = rec.kind === 'notificacao' ? 'Novo treino' : rec.kind === 'aviso' ? 'Aviso do professor' : 'Mensagem do professor';
    url = './#/atleta/mensagens';
  }

  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', recipient);
  if (!subs?.length) return new Response('sem aparelhos', { status: 200 });

  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  const message = JSON.stringify({ title, body: rec.body.slice(0, 140), url, tag: `msg-${rec.athlete_id}` });

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, message, { TTL: 86400 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id); // aparelho removido
      }
    })
  );
  return new Response(JSON.stringify({ sent }), { status: 200, headers: { 'content-type': 'application/json' } });
});
