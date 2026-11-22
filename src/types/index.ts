export type Role = 'professor' | 'atleta';
export type Experience = 'iniciante' | 'intermediario' | 'avancado';
export type Intensity = 'muito_leve' | 'leve' | 'moderada' | 'forte' | 'maxima';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
}

export interface Category {
  id: string;
  professor_id: string;
  name: string;
}

export interface Modality {
  id: string;
  professor_id: string;
  name: string;
  distance_m: number | null;
  kind: string;
}

export interface Athlete {
  id: string;
  professor_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  birth_date: string | null;
  phone: string | null;
  start_date: string | null;
  modalities: string[];
  category_id: string | null;
  goals: string | null;
  experience_level: Experience | null;
  status: 'ativo' | 'inativo';
  is_demo: boolean;
  created_at: string;
}

export interface AthleteGroup {
  id: string;
  professor_id: string;
  name: string;
}
export interface GroupMember {
  group_id: string;
  athlete_id: string;
}

export interface WorkoutFields {
  name: string;
  modality_id: string | null;
  workout_type: string;
  distance_m: number | null;
  planned_time_s: number | null;
  planned_pace_s: number | null;
  intensity: Intensity | null;
  sets: number | null;
  reps: number | null;
  rest: string | null;
  warmup: string | null;
  main_part: string | null;
  cooldown: string | null;
  notes: string | null;
}

export interface Workout extends WorkoutFields {
  id: string;
  professor_id: string;
  athlete_id: string;
  sheet_id: string | null;
  scheduled_date: string;
}

export interface WorkoutTemplate extends WorkoutFields {
  id: string;
  professor_id: string;
}

export type SheetKind = 'diaria' | 'semanal' | 'mensal' | 'personalizada';
export interface Sheet {
  id: string;
  professor_id: string;
  name: string;
  kind: SheetKind;
  description: string | null;
}
export interface SheetItem extends WorkoutFields {
  id: string;
  sheet_id: string;
  day_offset: number;
}

export type LogStatus = 'concluido' | 'parcial' | 'nao_realizado';
export interface WorkoutLog {
  id: string;
  professor_id: string;
  athlete_id: string;
  workout_id: string | null;
  log_date: string;
  distance_m: number | null;
  time_s: number | null;
  avg_pace_s: number | null;
  rpe: number | null;
  notes: string | null;
  status: LogStatus;
}

export interface ResultRow {
  id: string;
  professor_id: string;
  athlete_id: string;
  modality_id: string | null;
  result_date: string;
  time_s: number;
  is_competition: boolean;
  competition_name: string | null;
  notes: string | null;
}

export interface TafExam {
  id: string;
  professor_id: string;
  name: string;
  institution: string | null;
  position: string | null;
  exam_date: string | null;
  regulation_ref: string | null;
  notes: string | null;
}
export type TafKind = 'tempo' | 'distancia' | 'repeticoes';
export interface TafTest {
  id: string;
  exam_id: string;
  professor_id: string;
  name: string;
  kind: TafKind;
  better: 'menor' | 'maior';
  min_value: number | null;
  edital_ref: string | null;
  notes: string | null;
}
export interface TafGoal {
  id: string;
  test_id: string;
  athlete_id: string;
  goal_value: number;
}
export interface TafResult {
  id: string;
  test_id: string;
  athlete_id: string;
  result_date: string;
  value: number;
  notes: string | null;
}

export type EventKind = 'competicao' | 'avaliacao' | 'taf' | 'evento';
export interface CalendarEvent {
  id: string;
  professor_id: string;
  athlete_id: string | null;
  title: string;
  kind: EventKind;
  event_date: string;
  event_time: string | null;
  location: string | null;
  notes: string | null;
}

export type MessageKind = 'orientacao' | 'aviso' | 'comentario' | 'notificacao';
export interface Message {
  id: string;
  professor_id: string;
  athlete_id: string;
  sender_id: string;
  kind: MessageKind;
  body: string;
  workout_id: string | null;
  read_at: string | null;
  created_at: string;
}
