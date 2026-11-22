-- =====================================================================
-- RunCoach — 002: FUNÇÕES E TRIGGERS
-- Execute DEPOIS do 001. Idempotente.
-- =====================================================================

-- ---------- Funções auxiliares usadas pelas políticas RLS ----------
create or replace function public.is_professor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'professor');
$$;

-- IDs dos registros de atleta ligados ao usuário logado
create or replace function public.my_athlete_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.athletes where user_id = auth.uid();
$$;

-- IDs dos professores do atleta logado
create or replace function public.my_professor_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select professor_id from public.athletes where user_id = auth.uid();
$$;

-- ---------- updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'athletes', 'sheets', 'workouts', 'workout_logs', 'athlete_notes'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- Cadastro: só entra quem foi autorizado ----------
-- Regras:
--  * e-mail na professor_allowlist  -> vira PROFESSOR
--  * e-mail cadastrado pelo professor em "athletes" (sem conta ainda) -> vira ATLETA e é vinculado
--  * qualquer outro e-mail -> cadastro recusado (a transação inteira é desfeita)
-- O papel NUNCA vem de dados enviados pelo navegador.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(new.email);
  v_athlete public.athletes%rowtype;
begin
  if exists (select 1 from public.professor_allowlist where email = v_email) then
    insert into public.profiles (id, email, full_name, role)
    values (new.id, v_email,
            coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(v_email, '@', 1)),
            'professor');
    return new;
  end if;

  select * into v_athlete from public.athletes
   where email = v_email and user_id is null
   for update;

  if found then
    insert into public.profiles (id, email, full_name, role)
    values (new.id, v_email, v_athlete.full_name, 'atleta');
    -- vínculo feito aqui; o trigger de proteção libera pois roda sem auth.uid()
    update public.athletes set user_id = new.id where id = v_athlete.id;
    return new;
  end if;

  raise exception 'Cadastro não autorizado: peça ao seu professor para cadastrar este e-mail.';
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Proteção de privilégios ----------
-- Ninguém altera papel/e-mail do perfil pela API.
create or replace function public.protect_profile()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.role is distinct from old.role
       or new.email is distinct from old.email
       or new.id is distinct from old.id then
      raise exception 'Não é permitido alterar papel, e-mail ou id do perfil.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- O professor não pode religar a conta de um atleta nem trocar o dono do registro.
create or replace function public.protect_athlete()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if new.user_id is distinct from old.user_id
       or new.professor_id is distinct from old.professor_id then
      raise exception 'Não é permitido alterar o vínculo da conta ou do professor.';
    end if;
    if old.user_id is not null and new.email is distinct from old.email then
      raise exception 'O e-mail de um atleta que já ativou a conta não pode ser alterado.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_athlete on public.athletes;
create trigger protect_athlete before update on public.athletes
  for each row execute function public.protect_athlete();

-- Padrões ao criar professor: modalidades de atletismo (apenas nomes/distâncias; sem índices)
create or replace function public.seed_professor_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'professor' then
    insert into public.modalities (professor_id, name, distance_m, kind) values
      (new.id, '100 metros', 100, 'velocidade'),
      (new.id, '200 metros', 200, 'velocidade'),
      (new.id, '400 metros', 400, 'velocidade'),
      (new.id, '800 metros', 800, 'meio-fundo'),
      (new.id, '1.500 metros', 1500, 'meio-fundo'),
      (new.id, '3.000 metros', 3000, 'fundo'),
      (new.id, '5.000 metros', 5000, 'fundo'),
      (new.id, '10.000 metros', 10000, 'fundo'),
      (new.id, 'Corrida de rua', null, 'rua'),
      (new.id, 'Corrida de longa distância', null, 'rua'),
      (new.id, 'Preparação física geral', null, 'geral')
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists seed_professor_defaults on public.profiles;
create trigger seed_professor_defaults after insert on public.profiles
  for each row execute function public.seed_professor_defaults();

-- ---------- Integridade de donos ----------
-- Preenche professor_id a partir do atleta (o cliente não decide de quem é o dado).
create or replace function public.set_professor_from_athlete()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_prof uuid;
begin
  if new.athlete_id is null then
    return new;
  end if;
  select professor_id into v_prof from public.athletes where id = new.athlete_id;
  if v_prof is null then
    raise exception 'Atleta inválido.';
  end if;
  new.professor_id := v_prof;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['workouts', 'workout_logs', 'results', 'taf_enrollments',
                           'taf_goals', 'taf_results', 'messages', 'group_members', 'calendar_events', 'athlete_notes'] loop
    execute format('drop trigger if exists set_professor_from_athlete on public.%I', t);
    execute format('create trigger set_professor_from_athlete before insert or update of athlete_id on public.%I
                    for each row execute function public.set_professor_from_athlete()', t);
  end loop;
end $$;

-- Registro "filho" só pode apontar para um "pai" do mesmo professor.
create or replace function public.check_parent_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  execute format('select exists (select 1 from public.%I where id = $1 and professor_id = $2)', TG_ARGV[0])
    into ok
    using (to_jsonb(new) ->> TG_ARGV[1])::uuid, new.professor_id;
  if not ok then
    raise exception 'Registro relacionado inválido.';
  end if;
  return new;
end $$;

drop trigger if exists check_parent on public.sheet_items;
create trigger check_parent before insert or update on public.sheet_items
  for each row execute function public.check_parent_owner('sheets', 'sheet_id');

drop trigger if exists check_parent on public.taf_tests;
create trigger check_parent before insert or update on public.taf_tests
  for each row execute function public.check_parent_owner('taf_exams', 'exam_id');

drop trigger if exists check_parent on public.taf_enrollments;
create trigger check_parent before insert or update on public.taf_enrollments
  for each row execute function public.check_parent_owner('taf_exams', 'exam_id');

drop trigger if exists check_parent on public.taf_goals;
create trigger check_parent before insert or update on public.taf_goals
  for each row execute function public.check_parent_owner('taf_tests', 'test_id');

drop trigger if exists check_parent on public.taf_results;
create trigger check_parent before insert or update on public.taf_results
  for each row execute function public.check_parent_owner('taf_tests', 'test_id');

drop trigger if exists check_parent on public.group_members;
create trigger check_parent before insert or update on public.group_members
  for each row execute function public.check_parent_owner('athlete_groups', 'group_id');

-- O treino vinculado a um registro precisa ser do mesmo atleta.
create or replace function public.check_log_workout()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.workout_id is not null and not exists (
    select 1 from public.workouts w where w.id = new.workout_id and w.athlete_id = new.athlete_id
  ) then
    raise exception 'Treino não pertence a este atleta.';
  end if;
  return new;
end $$;

drop trigger if exists check_log_workout on public.workout_logs;
create trigger check_log_workout before insert or update on public.workout_logs
  for each row execute function public.check_log_workout();

-- Atleta só altera "lida" nas mensagens; conteúdo é imutável para ele.
create or replace function public.protect_message()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_professor() then
    if new.body is distinct from old.body
       or new.kind is distinct from old.kind
       or new.sender_id is distinct from old.sender_id
       or new.athlete_id is distinct from old.athlete_id then
      raise exception 'Atletas só podem marcar mensagens como lidas.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_message on public.messages;
create trigger protect_message before update on public.messages
  for each row execute function public.protect_message();

-- ---------- Funções de negócio (rodam com as permissões/RLS de quem chama) ----------

-- Atribui uma planilha a vários atletas: copia os itens como treinos datados
-- e envia uma notificação a cada atleta. Retorna o nº de treinos criados.
create or replace function public.assign_sheet(p_sheet_id uuid, p_athlete_ids uuid[], p_start_date date)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  v_sheet public.sheets%rowtype;
  v_athlete uuid;
  v_count integer := 0;
  v_n integer;
begin
  select * into v_sheet from public.sheets where id = p_sheet_id and professor_id = auth.uid();
  if not found then
    raise exception 'Planilha não encontrada.';
  end if;

  foreach v_athlete in array p_athlete_ids loop
    if not exists (select 1 from public.athletes where id = v_athlete and professor_id = auth.uid()) then
      raise exception 'Atleta inválido na lista.';
    end if;

    insert into public.workouts (professor_id, athlete_id, sheet_id, scheduled_date, name, modality_id,
                                 workout_type, distance_m, planned_time_s, planned_pace_s, intensity,
                                 sets, reps, rest, warmup, main_part, cooldown, notes)
    select auth.uid(), v_athlete, v_sheet.id, p_start_date + i.day_offset, i.name, i.modality_id,
           i.workout_type, i.distance_m, i.planned_time_s, i.planned_pace_s, i.intensity,
           i.sets, i.reps, i.rest, i.warmup, i.main_part, i.cooldown, i.notes
      from public.sheet_items i
     where i.sheet_id = v_sheet.id;
    get diagnostics v_n = row_count;
    v_count := v_count + v_n;

    insert into public.messages (professor_id, athlete_id, sender_id, kind, body)
    values (auth.uid(), v_athlete, auth.uid(), 'notificacao',
            'Nova planilha: "' || v_sheet.name || '" a partir de ' || to_char(p_start_date, 'DD/MM/YYYY') || '.');
  end loop;

  return v_count;
end $$;

-- Copia a semana (7 dias a partir de p_from_start) de um atleta para outra semana.
create or replace function public.copy_week(p_athlete_id uuid, p_from_start date, p_to_start date)
returns integer language plpgsql security invoker set search_path = public as $$
declare v_n integer;
begin
  if not exists (select 1 from public.athletes where id = p_athlete_id and professor_id = auth.uid()) then
    raise exception 'Atleta inválido.';
  end if;

  insert into public.workouts (professor_id, athlete_id, sheet_id, scheduled_date, name, modality_id,
                               workout_type, distance_m, planned_time_s, planned_pace_s, intensity,
                               sets, reps, rest, warmup, main_part, cooldown, notes)
  select professor_id, athlete_id, sheet_id, scheduled_date + (p_to_start - p_from_start), name, modality_id,
         workout_type, distance_m, planned_time_s, planned_pace_s, intensity,
         sets, reps, rest, warmup, main_part, cooldown, notes
    from public.workouts
   where athlete_id = p_athlete_id
     and professor_id = auth.uid()
     and scheduled_date between p_from_start and p_from_start + 6;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------- Permissões de execução ----------
revoke all on function public.assign_sheet(uuid, uuid[], date) from public, anon;
revoke all on function public.copy_week(uuid, date, date) from public, anon;
grant execute on function public.assign_sheet(uuid, uuid[], date) to authenticated;
grant execute on function public.copy_week(uuid, date, date) to authenticated;

revoke all on function public.is_professor() from public, anon;
revoke all on function public.my_athlete_ids() from public, anon;
revoke all on function public.my_professor_ids() from public, anon;
grant execute on function public.is_professor() to authenticated;
grant execute on function public.my_athlete_ids() to authenticated;
grant execute on function public.my_professor_ids() to authenticated;
