/** Plano de treino importado de PDF (guardado em training_plans.data). */
export interface PlanMeta {
  label: string;
  value: string;
}
export interface PlanCard {
  title: string;
  lines: string[];
}
export interface PlanWeekRow {
  week: string; // "01"
  cells: string[]; // uma por coluna
}
export type PlanSection =
  | { type: 'cards'; cards: PlanCard[] }
  | { type: 'table'; title: string; headers: string[]; rows: string[][] }
  | { type: 'weeks'; title: string; columns: string[]; rows: PlanWeekRow[] }
  | { type: 'lists'; title: string; groups: { title: string; items: string[] }[] }
  | { type: 'text'; title: string; text: string };

export interface PlanData {
  version: 1;
  title: string;
  meta: PlanMeta[];
  sections: PlanSection[];
  /** Texto bruto de todas as linhas lidas, para conferência (nada se perde). */
  raw: string[];
  warnings: string[];
}

export interface TrainingPlan {
  id: string;
  professor_id: string;
  athlete_id: string;
  title: string;
  source_file: string | null;
  start_date: string | null;
  generated_at: string | null;
  data: PlanData;
  created_at: string;
}

/** Linha de texto lida do PDF: células com posição horizontal. */
export interface PdfCell {
  x: number;
  text: string;
}
export interface PdfLine {
  page: number;
  cells: PdfCell[];
}
