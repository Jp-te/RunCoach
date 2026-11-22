const pad = (n: number) => String(n).padStart(2, '0');

/** Segundos -> "m:ss", "h:mm:ss" (com décimo quando houver, ex.: "0:07,5"). */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return '—';
  const tenths = Math.round(totalSeconds * 10);
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const sec = pad(s) + (frac ? `,${frac}` : '');
  return h > 0 ? `${h}:${pad(m)}:${sec}` : `${m}:${sec}`;
}

/** "mm:ss", "h:mm:ss", "ss" ou com decimais ("7,5", "1:02,3") -> segundos. */
export function parseDuration(input: string): number | null {
  const raw = input.trim().replace(',', '.');
  if (!raw) return null;
  const parts = raw.split(':');
  if (parts.length > 3 || parts.some((p) => p === '' || Number.isNaN(Number(p)))) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => n < 0)) return null;
  for (let i = 0; i < nums.length - 1; i++) if (!Number.isInteger(nums[i])) return null;
  const total = nums.reduce((acc, n) => acc * 60 + n, 0);
  return Math.round(total * 10) / 10;
}

/** Ritmo em segundos/km -> "5:30/km". */
export function formatPace(secPerKm: number | null | undefined): string {
  if (secPerKm == null || Number.isNaN(secPerKm)) return '—';
  const r = Math.round(secPerKm);
  return `${Math.floor(r / 60)}:${pad(r % 60)}/km`;
}

/** Ritmo médio (s/km) a partir da distância (m) e do tempo (s). */
export function computePace(distanceM: number | null, timeS: number | null): number | null {
  if (!distanceM || !timeS || distanceM <= 0 || timeS <= 0) return null;
  return Math.round(timeS / (distanceM / 1000));
}

export function formatDistance(m: number | null | undefined): string {
  if (m == null || Number.isNaN(m)) return '—';
  if (m >= 1000) return `${(m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km`;
  return `${Math.round(m)} m`;
}

export type DistUnit = 'km' | 'm';

export function distanceToMeters(value: string, unit: DistUnit): number | null {
  const raw = value.trim().replace(',', '.');
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(unit === 'km' ? n * 1000 : n);
}

export function metersToField(m: number | null): { value: string; unit: DistUnit } {
  if (m == null) return { value: '', unit: 'km' };
  if (m >= 1000 && m % 10 === 0) return { value: String(m / 1000).replace('.', ','), unit: 'km' };
  return { value: String(m), unit: 'm' };
}

export function parseIntOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ---------------- Datas (sempre em data LOCAL, formato ISO yyyy-mm-dd) ----------------
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function todayISO(): string {
  return toISO(new Date());
}
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
/** Segunda-feira da semana da data informada. */
export function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return toISO(d);
}
export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
export function formatDateShort(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}
export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export function weekdayOf(iso: string): string {
  return WEEKDAYS[(parseISO(iso).getDay() + 6) % 7];
}
export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}
export function ageFrom(birth: string | null): number | null {
  if (!birth) return null;
  const b = parseISO(birth);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age;
}
export function formatDateTimeBR(ts: string): string {
  const d = new Date(ts);
  return `${formatDateBR(toISO(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
