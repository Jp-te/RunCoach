-- =====================================================================
-- RunCoach — 001: TABELAS, RELACIONAMENTOS E ÍNDICES
-- Execute no Supabase: SQL Editor > New query > cole > Run
-- Pode ser executado mais de uma vez (idempotente).
-- Convenções: tempos em SEGUNDOS, distâncias em METROS, ritmo em SEGUNDOS/KM.
-- =====================================================================

-- Lista de e-mails autorizados a ser PROFESSOR. Gerenciada só pelo SQL Editor
-- (RLS ligado e sem políticas => ninguém acessa pela API).
create table if not exists public.professor_allowlist (
  email      text primary key,
  created_at timestamptz not null default now(),
  constraint professor_allowlist_email_lower check (email = lower(email))
);

-- Perfil de cada usuário autenticado (1:1 com auth.users)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  role       text not null check (role in ('professor', 'atleta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now(),
  unique (professor_id, name)
);

-- Modalidades / provas (o professor pode cadastrar outras)
create table if not exists public.modalities (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  distance_m   numeric,
  kind         text not null default 'outra'
               check (kind in ('velocidade', 'meio-fundo', 'fundo', 'rua', 'geral', 'outra')),
  created_at   timestamptz not null default now(),
  unique (professor_id, name)
);

create table if not exists public.athletes (
  id               uuid primary key default gen_random_uuid(),
  professor_id     uuid not null references public.profiles(id) on delete cascade,
  user_id          uuid unique references public.profiles(id) on delete set null,
  full_name        text not null,
  email            text not null,
  birth_date       date,
  phone            text,
  start_date       date default current_date,
  modalities       text[] not null default '{}',
  category_id      uuid references public.categories(id) on delete set null,
  goals            text,
  experience_level text check (experience_level in ('iniciante', 'intermediario', 'avancado')),
  status           text not null default 'ativo' check (status in ('ativo', 'inativo')),
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint athletes_email_lower check (email = lower(email))
);
create unique index if not exists athletes_email_key on public.athletes (email);
create index if not exists athletes_professor_idx on public.athletes (professor_id, status);

-- Observações PRIVADAS do professor sobre o atleta (o atleta não tem política de leitura aqui)
create table if not exists public.athlete_notes (
  athlete_id   uuid primary key references public.athletes(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  notes        text not null,
  updated_at   timestamptz not null default now()
);

create table if not exists public.athlete_groups (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now(),
  unique (professor_id, name)
);

create table if not exists public.group_members (
  group_id     uuid not null references public.athlete_groups(id) on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  primary key (group_id, athlete_id)
);
create index if not exists group_members_athlete_idx on public.group_members (athlete_id);

-- ---------------------------------------------------------------------
-- Planilhas (modelos reutilizáveis atribuídos a atletas) e treinos
-- ---------------------------------------------------------------------
create table if not exists public.sheets (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  kind          text not null default 'semanal'
                check (kind in ('diaria', 'semanal', 'mensal', 'personalizada')),
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists sheets_professor_idx on public.sheets (professor_id);

-- Campos comuns de um treino (repetidos em sheet_items, workout_templates e workouts)
create table if not exists public.sheet_items (
  id               uuid primary key default gen_random_uuid(),
  sheet_id         uuid not null references public.sheets(id) on delete cascade,
  professor_id     uuid not null references public.profiles(id) on delete cascade,
  day_offset       integer not null default 0 check (day_offset >= 0),
  name             text not null,
  modality_id      uuid references public.modalities(id) on delete set null,
  workout_type     text not null default 'corrida_continua',
  distance_m       numeric check (distance_m is null or distance_m >= 0),
  planned_time_s   integer check (planned_time_s is null or planned_time_s >= 0),
  planned_pace_s   integer check (planned_pace_s is null or planned_pace_s >= 0),
  intensity        text check (intensity in ('muito_leve', 'leve', 'moderada', 'forte', 'maxima')),
  sets             integer check (sets is null or sets >= 0),
  reps             integer check (reps is null or reps >= 0),
  rest             text,
  warmup           text,
  main_part        text,
  cooldown         text,
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists sheet_items_sheet_idx on public.sheet_items (sheet_id, day_offset);

create table if not exists public.workout_templates (
  id               uuid primary key default gen_random_uuid(),
  professor_id     uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  modality_id      uuid references public.modalities(id) on delete set null,
  workout_type     text not null default 'corrida_continua',
  distance_m       numeric check (distance_m is null or distance_m >= 0),
  planned_time_s   integer check (planned_time_s is null or planned_time_s >= 0),
  planned_pace_s   integer check (planned_pace_s is null or planned_pace_s >= 0),
  intensity        text check (intensity in ('muito_leve', 'leve', 'moderada', 'forte', 'maxima')),
  sets             integer check (sets is null or sets >= 0),
  reps             integer check (reps is null or reps >= 0),
  rest             text,
  warmup           text,
  main_part        text,
  cooldown         text,
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists workout_templates_professor_idx on public.workout_templates (professor_id);

create table if not exists public.workouts (
  id               uuid primary key default gen_random_uuid(),
  professor_id     uuid not null references public.profiles(id) on delete cascade,
  athlete_id       uuid not null references public.athletes(id) on delete cascade,
  sheet_id         uuid references public.sheets(id) on delete set null,
  scheduled_date   date not null,
  name             text not null,
  modality_id      uuid references public.modalities(id) on delete set null,
  workout_type     text not null default 'corrida_continua',
  distance_m       numeric check (distance_m is null or distance_m >= 0),
  planned_time_s   integer check (planned_time_s is null or planned_time_s >= 0),
  planned_pace_s   integer check (planned_pace_s is null or planned_pace_s >= 0),
  intensity        text check (intensity in ('muito_leve', 'leve', 'moderada', 'forte', 'maxima')),
  sets             integer check (sets is null or sets >= 0),
  reps             integer check (reps is null or reps >= 0),
  rest             text,
  warmup           text,
  main_part        text,
  cooldown         text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists workouts_athlete_date_idx on public.workouts (athlete_id, scheduled_date);
create index if not exists workouts_professor_date_idx on public.workouts (professor_id, scheduled_date);

-- Treino realizado (registrado pelo atleta). No máximo 1 registro por treino planejado.
create table if not exists public.workout_logs (
  id            uuid primary key default gen_random_uuid(),
  professor_id  uuid not null references public.profiles(id) on delete cascade,
  athlete_id    uuid not null references public.athletes(id) on delete cascade,
  workout_id    uuid unique references public.workouts(id) on delete set null,
  log_date      date not null default current_date,
  distance_m    numeric check (distance_m is null or distance_m >= 0),
  time_s        integer check (time_s is null or time_s >= 0),
  avg_pace_s    integer check (avg_pace_s is null or avg_pace_s >= 0),
  rpe           integer check (rpe is null or rpe between 1 and 10),
  notes         text,
  status        text not null default 'concluido'
                check (status in ('concluido', 'parcial', 'nao_realizado')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists workout_logs_athlete_date_idx on public.workout_logs (athlete_id, log_date);
create index if not exists workout_logs_professor_date_idx on public.workout_logs (professor_id, log_date);

-- Resultados de provas / testes de tempo (marcas pessoais e competições)
create table if not exists public.results (
  id               uuid primary key default gen_random_uuid(),
  professor_id     uuid not null references public.profiles(id) on delete cascade,
  athlete_id       uuid not null references public.athletes(id) on delete cascade,
  modality_id      uuid references public.modalities(id) on delete set null,
  result_date      date not null default current_date,
  time_s           numeric not null check (time_s > 0),
  is_competition   boolean not null default false,
  competition_name text,
  notes            text,
  created_at       timestamptz not null default now()
);
create index if not exists results_athlete_idx on public.results (athlete_id, result_date);
create index if not exists results_professor_idx on public.results (professor_id, result_date);

-- ---------------------------------------------------------------------
-- Módulo TAF — índices sempre informados pelo professor (nada é pré-definido)
-- ---------------------------------------------------------------------
create table if not exists public.taf_exams (
  id             uuid primary key default gen_random_uuid(),
  professor_id   uuid not null references public.profiles(id) on delete cascade,
  name           text not null,
  institution    text,
  position       text,
  exam_date      date,
  regulation_ref text,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists taf_exams_professor_idx on public.taf_exams (professor_id);

-- kind: tempo (segundos), distancia (metros) ou repeticoes (contagem)
-- better: 'menor' = quanto menor melhor (ex.: 2.400 m em tempo); 'maior' = quanto maior melhor
create table if not exists public.taf_tests (
  id           uuid primary key default gen_random_uuid(),
  exam_id      uuid not null references public.taf_exams(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  name         text not null,
  kind         text not null check (kind in ('tempo', 'distancia', 'repeticoes')),
  better       text not null check (better in ('menor', 'maior')),
  min_value    numeric,
  edital_ref   text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists taf_tests_exam_idx on public.taf_tests (exam_id);

create table if not exists public.taf_enrollments (
  exam_id      uuid not null references public.taf_exams(id) on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  primary key (exam_id, athlete_id)
);
create index if not exists taf_enrollments_athlete_idx on public.taf_enrollments (athlete_id);

create table if not exists public.taf_goals (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references public.taf_tests(id) on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  goal_value   numeric not null,
  unique (test_id, athlete_id)
);

create table if not exists public.taf_results (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references public.taf_tests(id) on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  professor_id uuid not null references public.profiles(id) on delete cascade,
  result_date  date not null default current_date,
  value        numeric not null,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists taf_results_test_athlete_idx on public.taf_results (test_id, athlete_id, result_date);

-- ---------------------------------------------------------------------
-- Calendário e comunicação
-- ---------------------------------------------------------------------
-- athlete_id nulo = evento geral da assessoria (visível a todos os atletas do professor)
create table if not exists public.calendar_events (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id   uuid references public.athletes(id) on delete cascade,
  title        text not null,
  kind         text not null default 'evento'
               check (kind in ('competicao', 'avaliacao', 'taf', 'evento')),
  event_date   date not null,
  event_time   time,
  location     text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists calendar_events_professor_idx on public.calendar_events (professor_id, event_date);
create index if not exists calendar_events_athlete_idx on public.calendar_events (athlete_id, event_date);

create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  kind         text not null default 'orientacao'
               check (kind in ('orientacao', 'aviso', 'comentario', 'notificacao')),
  body         text not null check (char_length(body) between 1 and 4000),
  workout_id   uuid references public.workouts(id) on delete set null,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists messages_athlete_idx on public.messages (athlete_id, created_at desc);
create index if not exists messages_professor_idx on public.messages (professor_id, created_at desc);
