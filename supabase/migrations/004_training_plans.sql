-- =====================================================================
-- RunCoach — 004: Planos de treino importados de PDF
-- Rode DEPOIS de 001, 002 e 003 (SQL Editor > New query > Run). Idempotente.
-- O plano completo (cabeçalho, zonas de ritmo, semanas, academia, simulados, regras)
-- fica em "data" (jsonb), já estruturado pelo importador do app.
-- =====================================================================
create table if not exists public.training_plans (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid not null references public.profiles(id) on delete cascade,
  athlete_id    uuid not null references public.athletes(id) on delete cascade,
  title         text not null,
  source_file   text,
  start_date    date,
  data          jsonb not null,
  created_at    timestamptz not null default now(),
  constraint training_plans_data_size check (pg_column_size(data) < 400000)
);
create index if not exists training_plans_athlete_idx on public.training_plans (athlete_id, created_at desc);
create index if not exists training_plans_professor_idx on public.training_plans (professor_id);

drop trigger if exists set_professor_from_athlete on public.training_plans;
create trigger set_professor_from_athlete before insert or update of athlete_id on public.training_plans
  for each row execute function public.set_professor_from_athlete();

alter table public.training_plans enable row level security;

drop policy if exists professor_all on public.training_plans;
create policy professor_all on public.training_plans for all to authenticated
  using (professor_id = (select auth.uid()) and (select public.is_professor()))
  with check (professor_id = (select auth.uid()) and (select public.is_professor()));

-- O atleta apenas LÊ os próprios planos.
drop policy if exists athlete_training_plans on public.training_plans;
create policy athlete_training_plans on public.training_plans for select to authenticated
  using (athlete_id in (select public.my_athlete_ids()));

revoke all on public.training_plans from anon;
