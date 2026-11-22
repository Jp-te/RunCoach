-- =====================================================================
-- RunCoach — 003: ROW LEVEL SECURITY
-- Execute DEPOIS do 002. Idempotente.
--
-- Modelo:
--  * Professor: acesso total APENAS às linhas com professor_id = seu id.
--  * Atleta: lê só o que é seu; escreve só registros de treino/resultados/mensagens
--    próprios. Nunca vê dados de outro atleta e não altera privilégios.
--  * anon (sem login): nenhuma política => nenhum acesso.
-- =====================================================================

-- Liga RLS em TODAS as tabelas
alter table public.professor_allowlist enable row level security; -- sem políticas: ninguém via API
alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.modalities          enable row level security;
alter table public.athletes            enable row level security;
alter table public.athlete_notes       enable row level security;
alter table public.athlete_groups      enable row level security;
alter table public.group_members       enable row level security;
alter table public.sheets              enable row level security;
alter table public.sheet_items         enable row level security;
alter table public.workout_templates   enable row level security;
alter table public.workouts            enable row level security;
alter table public.workout_logs        enable row level security;
alter table public.results             enable row level security;
alter table public.taf_exams           enable row level security;
alter table public.taf_tests           enable row level security;
alter table public.taf_enrollments     enable row level security;
alter table public.taf_goals           enable row level security;
alter table public.taf_results         enable row level security;
alter table public.calendar_events     enable row level security;
alter table public.messages            enable row level security;

-- ---------- Professor: acesso total ao que é dele ----------
do $$
declare t text;
begin
  foreach t in array array['categories', 'modalities', 'athletes', 'athlete_notes', 'athlete_groups', 'group_members',
                           'sheets', 'sheet_items', 'workout_templates', 'workouts', 'workout_logs',
                           'results', 'taf_exams', 'taf_tests', 'taf_enrollments', 'taf_goals',
                           'taf_results', 'calendar_events', 'messages'] loop
    execute format('drop policy if exists professor_all on public.%I', t);
    execute format($p$
      create policy professor_all on public.%I for all to authenticated
        using (professor_id = (select auth.uid()) and (select public.is_professor()))
        with check (professor_id = (select auth.uid()) and (select public.is_professor()))
    $p$, t);
  end loop;
end $$;

-- ---------- profiles ----------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_select_my_professor on public.profiles;
create policy profiles_select_my_professor on public.profiles for select to authenticated
  using (id in (select public.my_professor_ids()));

-- Atualiza só o próprio perfil; o trigger protect_profile bloqueia papel/e-mail.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- (não há política de INSERT/DELETE: perfis só são criados pelo trigger de cadastro)

-- ---------- Atleta: leitura do que é seu ----------
drop policy if exists athlete_select_self on public.athletes;
create policy athlete_select_self on public.athletes for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists athlete_select_categories on public.categories;
create policy athlete_select_categories on public.categories for select to authenticated
  using (professor_id in (select public.my_professor_ids()));

drop policy if exists athlete_select_modalities on public.modalities;
create policy athlete_select_modalities on public.modalities for select to authenticated
  using (professor_id in (select public.my_professor_ids()));

drop policy if exists athlete_select_workouts on public.workouts;
create policy athlete_select_workouts on public.workouts for select to authenticated
  using (athlete_id in (select public.my_athlete_ids()));

-- Registros de treino: o atleta cria/edita/exclui os seus
drop policy if exists athlete_logs_select on public.workout_logs;
create policy athlete_logs_select on public.workout_logs for select to authenticated
  using (athlete_id in (select public.my_athlete_ids()));
drop policy if exists athlete_logs_insert on public.workout_logs;
create policy athlete_logs_insert on public.workout_logs for insert to authenticated
  with check (athlete_id in (select public.my_athlete_ids()));
drop policy if exists athlete_logs_update on public.workout_logs;
create policy athlete_logs_update on public.workout_logs for update to authenticated
  using (athlete_id in (select public.my_athlete_ids()))
  with check (athlete_id in (select public.my_athlete_ids()));
drop policy if exists athlete_logs_delete on public.workout_logs;
create policy athlete_logs_delete on public.workout_logs for delete to authenticated
  using (athlete_id in (select public.my_athlete_ids()));

-- Resultados de provas/testes de tempo
drop policy if exists athlete_results_select on public.results;
create policy athlete_results_select on public.results for select to authenticated
  using (athlete_id in (select public.my_athlete_ids()));
drop policy if exists athlete_results_insert on public.results;
create policy athlete_results_insert on public.results for insert to authenticated
  with check (athlete_id in (select public.my_athlete_ids()));
drop policy if exists athlete_results_update on public.results;
create policy athlete_results_update on public.results for update to authenticated
  using (athlete_id in (select public.my_athlete_ids()))
  with check (athlete_id in (select public.my_athlete_ids()));
drop policy if exists athlete_results_delete on public.results;
create policy athlete_results_delete on public.results for delete to authenticated
  using (athlete_id in (select public.my_athlete_ids()));

-- TAF: atleta só LÊ, e só o que se refere a ele
drop policy if exists athlete_taf_enrollments on public.taf_enrollments;
create policy athlete_taf_enrollments on public.taf_enrollments for select to authenticated
  using (athlete_id in (select public.my_athlete_ids()));

drop policy if exists athlete_taf_exams on public.taf_exams;
create policy athlete_taf_exams on public.taf_exams for select to authenticated
  using (id in (select exam_id from public.taf_enrollments
                 where athlete_id in (select public.my_athlete_ids())));

drop policy if exists athlete_taf_tests on public.taf_tests;
create policy athlete_taf_tests on public.taf_tests for select to authenticated
  using (exam_id in (select exam_id from public.taf_enrollments
                      where athlete_id in (select public.my_athlete_ids())));

drop policy if exists athlete_taf_goals on public.taf_goals;
create policy athlete_taf_goals on public.taf_goals for select to authenticated
  using (athlete_id in (select public.my_athlete_ids()));

drop policy if exists athlete_taf_results on public.taf_results;
create policy athlete_taf_results on public.taf_results for select to authenticated
  using (athlete_id in (select public.my_athlete_ids()));

-- Calendário: eventos próprios + eventos gerais (athlete_id nulo) do seu professor
drop policy if exists athlete_calendar on public.calendar_events;
create policy athlete_calendar on public.calendar_events for select to authenticated
  using (athlete_id in (select public.my_athlete_ids())
         or (athlete_id is null and professor_id in (select public.my_professor_ids())));

-- Mensagens: atleta lê as suas, envia comentários e marca como lida
drop policy if exists athlete_messages_select on public.messages;
create policy athlete_messages_select on public.messages for select to authenticated
  using (athlete_id in (select public.my_athlete_ids()));
drop policy if exists athlete_messages_insert on public.messages;
create policy athlete_messages_insert on public.messages for insert to authenticated
  with check (athlete_id in (select public.my_athlete_ids())
              and sender_id = (select auth.uid())
              and kind = 'comentario');
drop policy if exists athlete_messages_update on public.messages;
create policy athlete_messages_update on public.messages for update to authenticated
  using (athlete_id in (select public.my_athlete_ids()))
  with check (athlete_id in (select public.my_athlete_ids()));

-- Garante que o papel "anon" não tenha privilégios nas tabelas
revoke all on all tables in schema public from anon;
