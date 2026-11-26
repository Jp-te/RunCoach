-- =====================================================================
-- RunCoach — 005: atleta inativo sem acesso, exclusão completa de conta,
--               controle de planos gerados e assinaturas de notificação push.
-- Rode DEPOIS de 001–004 (SQL Editor > New query > Run). Idempotente.
-- =====================================================================

-- 1) Atleta INATIVO deixa de enxergar qualquer dado (só consegue ver o próprio cadastro,
--    o que permite ao app mostrar "conta inativa").
create or replace function public.my_athlete_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.athletes where user_id = auth.uid() and status = 'ativo';
$$;
create or replace function public.my_professor_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select professor_id from public.athletes where user_id = auth.uid() and status = 'ativo';
$$;

-- 2) Plano: marca quando os treinos já foram gerados (evita duplicar sem querer)
alter table public.training_plans add column if not exists generated_at timestamptz;

-- 3) Exclusão COMPLETA do atleta: apaga os dados e também o usuário de login.
--    Só o professor dono do atleta pode chamar. Nunca apaga contas de professor.
create or replace function public.delete_athlete_account(p_athlete_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_prof uuid;
begin
  if not public.is_professor() then
    raise exception 'Sem permissão.';
  end if;
  select user_id, professor_id into v_user, v_prof from public.athletes where id = p_athlete_id;
  if v_prof is null or v_prof <> auth.uid() then
    raise exception 'Atleta inválido.';
  end if;
  delete from public.athletes where id = p_athlete_id;
  if v_user is not null
     and not exists (select 1 from public.profiles where id = v_user and role = 'professor')
     and not exists (select 1 from public.athletes where user_id = v_user) then
    delete from auth.users where id = v_user;
  end if;
end $$;
revoke all on function public.delete_athlete_account(uuid) from public, anon;
grant execute on function public.delete_athlete_account(uuid) to authenticated;

-- 4) Assinaturas de notificação push (uma por aparelho/navegador)
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists own_push on public.push_subscriptions;
create policy own_push on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon;
