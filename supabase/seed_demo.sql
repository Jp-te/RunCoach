-- =====================================================================
-- RunCoach — DADOS DE EXEMPLO (OPCIONAL)
-- Rode SOMENTE se quiser conhecer o sistema com dados fictícios.
-- Todos os atletas criados aqui têm is_demo = true, aparecem com o selo EXEMPLO
-- e e-mail @exemplo.invalid (ninguém consegue criar conta com eles).
-- Para apagar tudo: app > Configurações > "Remover dados de exemplo".
--
-- Pré-requisito: você já criou sua conta de professor (ela precisa existir).
-- Executa para o professor mais antigo cadastrado.
-- =====================================================================
do $$
declare
  v_prof uuid;
  v_a1 uuid; v_a2 uuid; v_a3 uuid;
  v_m5k uuid; v_m800 uuid;
  v_w uuid;
  i int;
begin
  select id into v_prof from public.profiles where role = 'professor' order by created_at limit 1;
  if v_prof is null then
    raise exception 'Crie primeiro a conta de professor no aplicativo (Primeiro acesso).';
  end if;
  if exists (select 1 from public.athletes where is_demo and professor_id = v_prof) then
    raise notice 'Dados de exemplo já existem. Nada a fazer.';
    return;
  end if;

  select id into v_m5k  from public.modalities where professor_id = v_prof and distance_m = 5000 limit 1;
  select id into v_m800 from public.modalities where professor_id = v_prof and distance_m = 800 limit 1;

  insert into public.athletes (professor_id, full_name, email, birth_date, start_date, modalities, goals, experience_level, status, is_demo)
  values (v_prof, 'EXEMPLO — Ana Corredora', 'demo1@exemplo.invalid', '1995-03-10', current_date - 120, array['5.000 metros'], 'Baixar de 25 minutos nos 5 km', 'intermediario', 'ativo', true)
  returning id into v_a1;
  insert into public.athletes (professor_id, full_name, email, birth_date, start_date, modalities, goals, experience_level, status, is_demo)
  values (v_prof, 'EXEMPLO — Bruno Velocista', 'demo2@exemplo.invalid', '2001-07-22', current_date - 60, array['800 metros'], 'Melhorar marca nos 800 m', 'avancado', 'ativo', true)
  returning id into v_a2;
  insert into public.athletes (professor_id, full_name, email, birth_date, start_date, modalities, goals, experience_level, status, is_demo)
  values (v_prof, 'EXEMPLO — Carla Iniciante', 'demo3@exemplo.invalid', '1989-11-02', current_date - 20, array['Preparação física geral'], 'Começar a correr 30 min seguidos', 'iniciante', 'ativo', true)
  returning id into v_a3;

  -- 4 semanas de treinos (3 por semana) para a Ana, com registros nas semanas passadas
  for i in 0..11 loop
    insert into public.workouts (professor_id, athlete_id, scheduled_date, name, modality_id, workout_type, distance_m, planned_time_s, planned_pace_s, intensity, warmup, main_part)
    values (v_prof, v_a1, current_date - 21 + (i / 3) * 7 + (i % 3) * 2, 'EXEMPLO — ' || (array['Contínuo leve','Intervalado 6x800','Longão'])[(i % 3) + 1],
            v_m5k, (array['corrida_continua','corrida_intervalada','longao'])[(i % 3) + 1],
            (array[5000, 6000, 10000])[(i % 3) + 1], (array[1800, 2100, 3600])[(i % 3) + 1], (array[360, 350, 360])[(i % 3) + 1],
            'moderada', 'Trote 10 min', 'Conforme tipo do treino')
    returning id into v_w;
    if i < 8 and i <> 4 then
      insert into public.workout_logs (professor_id, athlete_id, workout_id, log_date, distance_m, time_s, avg_pace_s, rpe, status, notes)
      select v_prof, v_a1, v_w, scheduled_date, distance_m, planned_time_s + (i * 5), round((planned_time_s + i * 5) / (distance_m / 1000.0)), 5 + (i % 3), 'concluido', 'Registro de exemplo'
        from public.workouts where id = v_w;
    end if;
  end loop;

  insert into public.workouts (professor_id, athlete_id, scheduled_date, name, modality_id, workout_type, distance_m, planned_time_s, intensity)
  values (v_prof, v_a2, current_date, 'EXEMPLO — Tiros 400 m', v_m800, 'tiro', 3200, 1500, 'forte'),
         (v_prof, v_a3, current_date + 1, 'EXEMPLO — Caminhada/corrida 20 min', null, 'regenerativo', 2000, 1200, 'leve');

  -- Marcas de exemplo (evolução dos tempos)
  insert into public.results (professor_id, athlete_id, modality_id, result_date, time_s, is_competition, competition_name) values
    (v_prof, v_a1, v_m5k, current_date - 100, 1620, false, null),
    (v_prof, v_a1, v_m5k, current_date - 60, 1560, false, null),
    (v_prof, v_a1, v_m5k, current_date - 25, 1515, true, 'Corrida de exemplo'),
    (v_prof, v_a2, v_m800, current_date - 40, 128.4, false, null),
    (v_prof, v_a2, v_m800, current_date - 10, 125.9, true, 'Meeting de exemplo');

  insert into public.calendar_events (professor_id, athlete_id, title, kind, event_date, location, notes) values
    (v_prof, null, 'EXEMPLO — Avaliação física da turma', 'avaliacao', current_date + 7, 'Pista', 'Evento fictício de demonstração'),
    (v_prof, v_a1, 'EXEMPLO — Corrida de rua 10 km', 'competicao', current_date + 21, null, null);

  raise notice 'Dados de exemplo criados (3 atletas).';
end $$;
