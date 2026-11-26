# Notificações push no celular

O app avisa o atleta quando chega **treino/planilha/mensagem** e avisa o professor quando o atleta **comenta**. Funciona em Android (Chrome) e iPhone/iPad (iOS 16.4+, **somente com o app instalado na tela inicial**).

Peças: o app (assina o aparelho) → tabela `push_subscriptions` → **Database Webhook** na tabela `messages` → **Edge Function `send-push`** → serviço de push do navegador → celular.
Nenhuma chave secreta fica no app: a chave **privada** vive só nos *secrets* da função.

## Passo a passo (uma vez)

1. **Banco**: rode `supabase/migrations/005_acesso_e_push.sql` no SQL Editor.
2. **Gere as chaves** (no seu computador, com Node): `node scripts/generate-vapid.mjs`
   - guarde a **PÚBLICA** e a **PRIVADA** (a privada é secreta: não coloque no GitHub, nem no Vercel como `VITE_`).
3. **Chave pública no app**: Vercel → projeto → Settings → Environment Variables → `VITE_VAPID_PUBLIC_KEY` = chave pública → **Redeploy**.
4. **Instale o Supabase CLI** (https://supabase.com/docs/guides/cli) e, na pasta do projeto:
   ```bash
   supabase login
   supabase link --project-ref sigfnhwheyyqprgimori
   supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:seu@email.com" WEBHOOK_SECRET="uma-senha-longa-que-voce-inventar"
   supabase functions deploy send-push --no-verify-jwt
   ```
   (`--no-verify-jwt` porque quem chama é o webhook; a função só aceita chamadas com o cabeçalho `x-webhook-secret` correto.)
5. **Webhook**: Supabase → **Database → Webhooks → Create a new hook**:
   - Table: `messages` • Events: **Insert**
   - Type: *HTTP Request* • Method **POST** • URL: `https://sigfnhwheyyqprgimori.supabase.co/functions/v1/send-push`
   - HTTP Headers: adicione `x-webhook-secret` = o mesmo valor do `WEBHOOK_SECRET`.
6. **Em cada aparelho**: abra o app → *Minha conta* (atleta) ou *Configurações* (professor) → **Ativar notificações**.
   No iPhone: Safari → Compartilhar → Adicionar à Tela de Início → abra pelo ícone → ative.

## Como testar
Como professor, atribua uma planilha ao atleta (ou envie uma mensagem). O celular do atleta deve receber o aviso em segundos. Se não chegar: *Edge Functions → send-push → Logs* e *Database → Webhooks* (histórico de chamadas) mostram o erro.

## Limites
- Não foi possível testar o envio ponta a ponta com o seu projeto (precisa das suas chaves e do deploy da função): o que foi verificado é o banco (RLS), o formato das chaves VAPID com a biblioteca `web-push`, o build e a interface.
- Aviso de "treino do dia" por horário (lembrete) não existe; os avisos são disparados por mensagens/atribuições.
- Se o usuário bloquear notificações no sistema, o app mostra como liberar.
