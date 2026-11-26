# Guia de configuração do Supabase (passo a passo)

Projeto: `https://sigfnhwheyyqprgimori.supabase.co`

> Faça tudo pelo painel em **https://supabase.com/dashboard** → abra o seu projeto.

## 1. Executar os scripts SQL (nesta ordem)

Menu lateral esquerdo → **SQL Editor** → **New query** → cole o conteúdo do arquivo → **Run**.

| Ordem | Arquivo | O que faz |
|---|---|---|
| 1 | `supabase/migrations/001_schema.sql` | Tabelas, relacionamentos, índices |
| 2 | `supabase/migrations/002_functions_triggers.sql` | Funções, triggers (cadastro controlado, proteção de privilégios, `assign_sheet`, `copy_week`) |
| 3 | `supabase/migrations/003_rls.sql` | Liga o RLS em todas as tabelas e cria as políticas |
| 4 | `supabase/migrations/004_training_plans.sql` | Tabela dos planos importados de PDF (com RLS) |
| 5 | `supabase/migrations/005_acesso_e_push.sql` | Atleta inativo sem acesso, exclusão completa de atleta, tabela de push |
| (opcional) | `supabase/seed_demo.sql` | Dados **fictícios** de exemplo (rode só depois de criar sua conta de professor) |

> Já rodou 001–003 antes? Rode apenas o **004** e o **005** (é independente e seguro de repetir).

Cada um deve terminar com **"Success. No rows returned"**. Os scripts são idempotentes: se der erro no meio, corrija e rode de novo.

## 2. Autorizar o seu e-mail de professor

O cadastro público **não** cria professores. Só e-mails nesta lista viram professor. No **SQL Editor**:

```sql
insert into public.professor_allowlist (email) values ('SEU-EMAIL@exemplo.com');
```

(Use letras minúsculas.) Depois abra o aplicativo → **Primeiro acesso** → informe esse e-mail e crie sua senha.
Para ter mais de um professor, repita o comando com outros e-mails.

## 3. Configurar a autenticação

Menu lateral → **Authentication**:

1. **Sign In / Providers → Email**: mantenha *Email* habilitado.
   - *Confirm email*: **ligado** é o mais seguro (o usuário confirma o e-mail antes de entrar). **Desligado** deixa o primeiro acesso mais simples para os atletas. A escolha é sua; o RunCoach funciona nos dois casos.
2. **URL Configuration**:
   - **Site URL**: o endereço público do app, por exemplo `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
   - **Redirect URLs** → *Add URL* (adicione as duas):
     - `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/**`
     - `http://localhost:5173/**` (para testes locais)
3. (Recomendado) **Authentication → Policies / Password**: comprimento mínimo de senha 8.

Esses endereços são usados nos e-mails de confirmação e de **recuperação de senha**.

## 4. Pegar a Publishable Key

**Project Settings** (engrenagem) → **API Keys** → copie a **Publishable key** (`sb_publishable_...`).
Ela é pública por design: a proteção dos dados é feita pelo RLS. **Nunca** use a *Secret key* / *service_role* no app, no GitHub ou em arquivos.

- Local: copie `.env.example` para `.env` e preencha.
- GitHub Pages: veja `docs/PUBLICACAO.md`.

## 5. Como o fluxo de contas funciona

1. Professor cadastra o atleta (nome + e-mail) em **Atletas → Novo atleta**.
2. O atleta abre o app → **Primeiro acesso** → usa **o mesmo e-mail** e cria a própria senha.
3. O banco só aceita o cadastro se o e-mail estiver cadastrado por um professor; nesse momento a conta é vinculada ao registro do atleta. Qualquer outro e-mail é recusado.
4. O papel (professor/atleta) é definido **no banco**, nunca pelo navegador.

## 6. Conferir a segurança

- **Table Editor**: todas as tabelas devem mostrar o selo **RLS enabled**.
- **Authentication → Users**: lista dos usuários criados. Excluir um atleta no app já apaga também o login dele; para só pausar, use a situação "Inativo".
- **Database → Advisors → Security**: não deve apontar tabelas sem RLS.

## 7. Testar as regras de segurança por conta própria

O arquivo `scripts/test-rls.mjs` roda as políticas num Postgres local (sem tocar no seu projeto) e verifica, entre outros pontos, que atleta não vê dados de outro atleta nem altera o próprio papel, e que um professor não acessa dados de outro. Veja o README.
