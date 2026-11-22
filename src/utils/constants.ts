export const WORKOUT_TYPES: { value: string; label: string }[] = [
  { value: 'corrida_continua', label: 'Corrida contínua' },
  { value: 'corrida_intervalada', label: 'Corrida intervalada' },
  { value: 'fartlek', label: 'Fartlek' },
  { value: 'longao', label: 'Longão' },
  { value: 'regenerativo', label: 'Regenerativo' },
  { value: 'tiro', label: 'Tiro de velocidade' },
  { value: 'resistencia', label: 'Treinamento de resistência' },
  { value: 'forca', label: 'Treinamento de força' },
  { value: 'tecnica', label: 'Técnica de corrida' },
  { value: 'mobilidade', label: 'Mobilidade' },
];
export const workoutTypeLabel = (v: string) => WORKOUT_TYPES.find((t) => t.value === v)?.label ?? v;

export const INTENSITIES: { value: string; label: string }[] = [
  { value: 'muito_leve', label: 'Muito leve' },
  { value: 'leve', label: 'Leve' },
  { value: 'moderada', label: 'Moderada' },
  { value: 'forte', label: 'Forte' },
  { value: 'maxima', label: 'Máxima' },
];
export const intensityLabel = (v: string | null) => INTENSITIES.find((t) => t.value === v)?.label ?? '—';

export const EXPERIENCE: { value: string; label: string }[] = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
];
export const experienceLabel = (v: string | null) => EXPERIENCE.find((t) => t.value === v)?.label ?? '—';

export const SHEET_KINDS: { value: string; label: string }[] = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'personalizada', label: 'Personalizada' },
];
export const sheetKindLabel = (v: string) => SHEET_KINDS.find((t) => t.value === v)?.label ?? v;

export const EVENT_KINDS: { value: string; label: string }[] = [
  { value: 'competicao', label: 'Competição' },
  { value: 'avaliacao', label: 'Avaliação física' },
  { value: 'taf', label: 'Teste de TAF' },
  { value: 'evento', label: 'Evento importante' },
];
export const eventKindLabel = (v: string) => EVENT_KINDS.find((t) => t.value === v)?.label ?? v;

export const MODALITY_KINDS: { value: string; label: string }[] = [
  { value: 'velocidade', label: 'Velocidade' },
  { value: 'meio-fundo', label: 'Meio-fundo' },
  { value: 'fundo', label: 'Fundo' },
  { value: 'rua', label: 'Corrida de rua / longa distância' },
  { value: 'geral', label: 'Preparação física geral' },
  { value: 'outra', label: 'Outra' },
];

export const LOG_STATUS: { value: string; label: string }[] = [
  { value: 'concluido', label: 'Concluído' },
  { value: 'parcial', label: 'Parcialmente concluído' },
  { value: 'nao_realizado', label: 'Não realizado' },
];
export const logStatusLabel = (v: string) => LOG_STATUS.find((t) => t.value === v)?.label ?? v;

export const MESSAGE_KINDS: { value: string; label: string }[] = [
  { value: 'orientacao', label: 'Orientação' },
  { value: 'aviso', label: 'Aviso' },
  { value: 'comentario', label: 'Comentário' },
  { value: 'notificacao', label: 'Notificação' },
];
export const messageKindLabel = (v: string) => MESSAGE_KINDS.find((t) => t.value === v)?.label ?? v;

export const RPE_LABELS: Record<number, string> = {
  1: 'Muito fácil', 2: 'Fácil', 3: 'Leve', 4: 'Moderado', 5: 'Um pouco pesado',
  6: 'Pesado', 7: 'Muito pesado', 8: 'Intenso', 9: 'Quase máximo', 10: 'Máximo',
};

export const CHART_COLORS = ['#f97316', '#0ea5e9', '#16a34a', '#a855f7', '#e11d48', '#ca8a04'];
