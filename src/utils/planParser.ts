import type { PdfCell, PdfLine, PlanCard, PlanData, PlanSection, PlanWeekRow } from '../types/plan';
import type { WorkoutFields } from '../types';

const TOL = 14; // tolerância (pt) para atribuir uma célula à coluna mais próxima

const lineText = (l: PdfLine) => l.cells.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim();
const join = (a: string, b: string) => (a ? `${a} ${b}` : b).replace(/\s+/g, ' ').trim();

/** Coluna cujo início (x) é o último ≤ x + TOL. -1 se estiver à esquerda da primeira. */
function colOf(starts: number[], x: number): number {
  let idx = -1;
  for (let i = 0; i < starts.length; i++) if (starts[i] <= x + TOL) idx = i;
  return idx;
}

function isFooter(t: string) {
  return /\bPage\s+\d+\s+of\s+\d+\b/i.test(t) || /\bP[áa]gina\s+\d+\s+(de|\/)\s+\d+\b/i.test(t);
}

const HEADING_WORDS = /^(m[êe]s\b|fase\b|academia\b|controle\b|refer[êe]ncia\b|zonas?\b|semanas?\b|ciclo\b)/i;

function isHeading(l: PdfLine): boolean {
  // Leitura por OCR às vezes parte um título em 2–3 células: aceita se tudo for maiúsculo e começar por palavra-chave.
  if (l.cells.length > 1 && l.cells.length <= 3 && l.cells[0].x < 80) {
    const t = lineText(l);
    const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
    return HEADING_WORDS.test(t) && letters.length >= 6 && letters === letters.toUpperCase();
  }
  if (l.cells.length !== 1) return false;
  const t = l.cells[0].text;
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  return letters.length >= 6 && letters === letters.toUpperCase() && l.cells[0].x < 80;
}

const NOTE_START = /^(regras?|obs\.?|observa[çc][õo]es?|aten[çc][ãa]o|importante)\b/i;

function splitMeta(t: string) {
  if (!/\s\|\s/.test(t)) {
    // sem barras (o OCR as descarta): separa nos rótulos "Palavra:"
    const keys = [...t.matchAll(/(?:^|\s)([A-ZÀ-Ú][A-Za-zÀ-ÿ]{2,15}):/g)];
    return keys
      .map((k, i) => ({ label: k[1], value: t.slice(k.index! + k[0].length, keys[i + 1]?.index ?? t.length).trim() }))
      .filter((m) => m.value);
  }
  return t
    .split(/\s+\|\s+/)
    .map((p) => {
      const i = p.indexOf(':');
      return i > 0 && i < 24 ? { label: p.slice(0, i).trim(), value: p.slice(i + 1).trim() } : { label: '', value: p.trim() };
    })
    .filter((m) => m.value);
}

function parseCards(block: PdfLine[]): PlanSection | null {
  const header = block[0];
  if (!header || header.cells.length < 2) return null;
  const starts = header.cells.map((c) => c.x);
  const cards: PlanCard[] = header.cells.map((c) => ({ title: c.text, lines: [] }));
  for (const l of block.slice(1)) {
    for (const c of l.cells) {
      const i = Math.max(0, colOf(starts, c.x));
      cards[i].lines.push(c.text);
    }
  }
  return { type: 'cards', cards };
}

const WEEK_LABEL = /^[0-9oOlIsSbB]{1,2}$/;

function parseWeeks(title: string, block: PdfLine[]): PlanSection {
  const header = block[0];
  // colunas = células do cabeçalho; a 1ª ("Sem.") só é descartada se não for um dia da semana.
  // No OCR o título "Sem." sai ilegível e pode colar no 1º dia ("EN Segunda (Base)").
  const cols = header.cells
    .filter((c, i) => (i === 0 ? weekdayIndex(c.text) !== null : true))
    .map((c) => ({ ...c }));
  const first = cols[0];
  const m = first ? first.text.match(/(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)/i) : null;
  if (first && m && m.index) first.text = first.text.slice(m.index);
  const starts = cols.map((c) => c.x);
  // posição real da 1ª coluna = onde começa o texto da 1ª linha de dados, logo após o rótulo da semana
  const firstData = block.slice(1).find((l) => l.cells.length > 1 && WEEK_LABEL.test(l.cells[0].text));
  if (firstData && starts.length) starts[0] = firstData.cells[1].x;
  const rows: PlanWeekRow[] = [];
  let cur: PlanWeekRow | null = null;
  for (const l of block.slice(1)) {
    // número da semana; no OCR "05" pode sair "os", "o5", "O5"… (a numeração segue a sequência)
    const label = WEEK_LABEL.test(l.cells[0].text) && l.cells.length > 1 ? l.cells[0] : undefined;
    if (label) {
      const digits = label.text.replace(/[oO]/g, '0').replace(/[lI]/g, '1');
      const n = /^\d{1,2}$/.test(digits) ? parseInt(digits, 10) : (rows.length ? parseInt(rows[rows.length - 1].week, 10) + 1 : 1);
      cur = { week: String(n).padStart(2, '0'), cells: cols.map(() => '') };
      rows.push(cur);
    }
    if (!cur) continue;
    for (const c of l.cells) {
      if (c === label) continue;
      const i = Math.max(0, colOf(starts, c.x));
      cur.cells[i] = join(cur.cells[i], c.text);
    }
  }
  return { type: 'weeks', title, columns: cols.map((c) => c.text), rows };
}

function parseTable(title: string, block: PdfLine[]): PlanSection {
  const header = block[0];
  const starts = header.cells.map((c) => c.x);
  const rows: string[][] = [];
  // Cabeçalho ausente (OCR não leu a faixa colorida): a 1ª linha já é um dado (tem números).
  const headerless = header.cells.some((c) => /\d/.test(c.text.replace(/\([^)]*\)/g, '')));
  for (const l of headerless ? block : block.slice(1)) {
    const first = colOf(starts, l.cells[0].x) === 0;
    if (first || !rows.length) rows.push(starts.map(() => ''));
    const row = rows[rows.length - 1];
    for (const c of l.cells) {
      const i = Math.max(0, colOf(starts, c.x));
      row[i] = join(row[i], c.text);
    }
  }
  return { type: 'table', title, headers: header.cells.map((c) => (headerless ? '' : c.text)), rows };
}

function parseLists(title: string, block: PdfLine[]): PlanSection {
  const header = block[0];
  const starts = header.cells.map((c) => c.x);
  const groups = header.cells.map((c) => ({ title: c.text, items: [] as string[] }));
  for (const l of block.slice(1)) {
    for (const c of l.cells) {
      const g = groups[Math.max(0, colOf(starts, c.x))];
      if (/^\d+\s*[.)]\s/.test(c.text) || !g.items.length) g.items.push(c.text);
      else g.items[g.items.length - 1] = join(g.items[g.items.length - 1], c.text);
    }
  }
  return { type: 'lists', title, groups };
}

function parseTextBlock(fallbackTitle: string, block: PdfLine[]): PlanSection | null {
  if (!block.length) return null;
  const text = block.map(lineText).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const m = text.match(/^([^:]{3,40}):\s*(.*)$/);
  if (m && NOTE_START.test(m[1])) return { type: 'text', title: m[1].trim(), text: m[2].trim() };
  return { type: 'text', title: fallbackTitle, text };
}

function parseBlock(title: string, lines: PdfLine[], warnings: string[]): PlanSection[] {
  if (!lines.length) return [];
  // separa observações/regras no final do bloco
  const noteAt = lines.findIndex((l, i) => i > 0 && NOTE_START.test(lineText(l)) && l.cells[0].x < 80);
  const body = noteAt === -1 ? lines : lines.slice(0, noteAt);
  const tail = noteAt === -1 ? [] : lines.slice(noteAt);

  const out: PlanSection[] = [];
  const head = body[0];
  const firstCell = head?.cells[0]?.text ?? '';
  const weekdayCols = head ? head.cells.filter((c) => weekdayIndex(c.text) !== null).length : 0;
  if (head && head.cells.length >= 2 && (/^sem\.?$/i.test(firstCell) || (weekdayCols >= 2 && !/^treino\b/i.test(firstCell)))) out.push(parseWeeks(title, body));
  else if (head && head.cells.length >= 2 && /^treino\b/i.test(firstCell)) out.push(parseLists(title, body));
  else if (head && head.cells.length >= 2 && body.length >= 2) out.push(parseTable(title, body));
  else {
    const t = parseTextBlock(title, body);
    if (t) out.push(t);
  }
  // Cada observação/regra vira seção própria (começa em linhas que iniciam com o marcador).
  let group: PdfLine[] = [];
  const flush = () => {
    const t = parseTextBlock('Observações', group);
    if (t) out.push(t);
    group = [];
  };
  for (const l of tail) {
    if (NOTE_START.test(lineText(l)) && group.length) flush();
    group.push(l);
  }
  flush();
  if (!out.length) warnings.push(`Não foi possível estruturar a seção "${title}".`);
  return out;
}

/** Converte as linhas posicionadas do PDF em um plano estruturado. */
export function parsePlan(allLines: PdfLine[]): PlanData {
  const lines = allLines.filter((l) => l.cells.length && !isFooter(lineText(l)));
  const warnings: string[] = [];
  const raw = lines.map(lineText);
  const sections: PlanSection[] = [];

  const isMetaLine = (l?: PdfLine) =>
    !!l && (/\s\|\s/.test(lineText(l)) || /^[A-ZÀ-Ú][A-Za-zÀ-ÿ]{2,15}:.*\s[A-ZÀ-Ú][A-Za-zÀ-ÿ]{2,15}:/.test(lineText(l)));
  // O título pode faltar (faixa escura com texto branco que o OCR não leu): nesse caso a 1ª linha já é o cabeçalho.
  const hasTitle = !!lines[0] && !isMetaLine(lines[0]);
  const title = hasTitle ? lineText(lines[0]) : 'Plano de treino';
  if (!hasTitle) warnings.push('O título do plano não foi reconhecido; informe um título na conferência.');
  let i = hasTitle ? 1 : 0;
  let meta: PlanData['meta'] = [];
  if (isMetaLine(lines[i])) {
    const parsed = splitMeta(lineText(lines[i]));
    if (parsed.length >= 2 && parsed.every((m) => m.label)) {
      meta = parsed;
      i++;
    }
  }

  // bloco inicial (antes do 1º título de seção) = cartões de dados
  const intro: PdfLine[] = [];
  while (i < lines.length && !isHeading(lines[i])) intro.push(lines[i++]);
  if (intro.length) {
    const cards = parseCards(intro);
    if (cards) sections.push(cards);
    else {
      const t = parseTextBlock('Informações', intro);
      if (t) sections.push(t);
    }
  }

  while (i < lines.length) {
    const heading = lineText(lines[i++]);
    const block: PdfLine[] = [];
    while (i < lines.length && !isHeading(lines[i])) block.push(lines[i++]);
    sections.push(...parseBlock(heading, block, warnings));
  }

  if (!sections.some((s) => s.type === 'weeks' || s.type === 'lists' || s.type === 'table'))
    warnings.push('Nenhuma tabela de treinos foi reconhecida. O conteúdo foi mantido como texto; confira antes de salvar.');
  return { version: 1, title, meta, sections, raw, warnings };
}

// ---------- geração de treinos a partir do plano ----------
const DAYS: [RegExp, number][] = [
  [/segunda|\bseg\b/i, 0], [/ter[çc]a|\bter\b/i, 1], [/quarta|\bqua\b/i, 2], [/quinta|\bqui\b/i, 3],
  [/sexta|\bsex\b/i, 4], [/s[áa]bado|\bs[áa]b\b/i, 5], [/domingo|\bdom\b/i, 6],
];
export const weekdayIndex = (label: string): number | null => {
  for (const [re, n] of DAYS) if (re.test(label)) return n;
  return null;
};

export interface PlannedWorkout {
  dayOffset: number; // 0 = segunda-feira da semana 1
  fields: WorkoutFields;
}

function guessType(label: string, text: string): string {
  const all = `${label} ${text}`;
  if (/tiros?|velocidade/i.test(label)) return 'tiro';
  if (/\d+\s*x\s*[\d.]+\s*m\b/i.test(text)) return 'corrida_intervalada';
  if (/rodagem|volume|manuten|cont[ií]nu/i.test(all)) return 'corrida_continua';
  if (/mobilidade|soltura/i.test(text) && !/\d+\s*x/.test(text)) return 'mobilidade';
  return 'corrida_continua';
}

const blank = (): WorkoutFields => ({
  name: '', modality_id: null, workout_type: 'corrida_continua', distance_m: null, planned_time_s: null,
  planned_pace_s: null, intensity: null, sets: null, reps: null, rest: null, warmup: null, main_part: null,
  cooldown: null, notes: null,
});

/** Treinos de corrida (colunas com dia da semana) e de academia (grupos com dia entre parênteses). */
export function planToWorkouts(plan: PlanData): PlannedWorkout[] {
  const out: PlannedWorkout[] = [];
  let maxWeek = 0;
  for (const s of plan.sections) {
    if (s.type !== 'weeks') continue;
    s.rows.forEach((r) => (maxWeek = Math.max(maxWeek, parseInt(r.week, 10) || 0)));
    s.rows.forEach((r) => {
      const wk = parseInt(r.week, 10);
      if (!wk) return;
      s.columns.forEach((col, ci) => {
        const text = r.cells[ci];
        const d = weekdayIndex(col);
        if (!text || d === null) return;
        out.push({
          dayOffset: (wk - 1) * 7 + d,
          fields: {
            ...blank(),
            name: `Sem ${r.week} — ${col}`,
            workout_type: guessType(col, text),
            main_part: text,
            notes: s.title,
          },
        });
      });
    });
  }
  const obs = plan.sections.find((s) => s.type === 'text' && /obs.*academia|academia.*obs/i.test(s.title));
  const obsText = obs && obs.type === 'text' ? `Obs. Academia: ${obs.text}` : null;
  for (const s of plan.sections) {
    if (s.type !== 'lists') continue;
    for (const g of s.groups) {
      const d = weekdayIndex(g.title);
      if (d === null || !g.items.length) continue;
      for (let wk = 1; wk <= (maxWeek || 1); wk++) {
        out.push({
          dayOffset: (wk - 1) * 7 + d,
          fields: {
            ...blank(),
            name: `Sem ${String(wk).padStart(2, '0')} — ${g.title.split('—')[0].trim()}`,
            workout_type: 'forca',
            main_part: g.items.join('\n'),
            notes: [s.title, g.title.includes('—') ? g.title.split('—').slice(1).join('—').trim() : '', obsText]
              .filter(Boolean).join('\n'),
          },
        });
      }
    }
  }
  return out.sort((a, b) => a.dayOffset - b.dayOffset);
}

/** Agrupa itens do pdf.js (com coordenadas) em linhas e células. */
export interface RawItem {
  str: string;
  x: number;
  y: number;
  w: number;
}
export function itemsToLines(items: RawItem[], page: number, mergeGap = 5): PdfLine[] {
  const rows: { y: number; items: RawItem[] }[] = [];
  for (const it of [...items].sort((a, b) => b.y - a.y)) {
    const row = rows.find((r) => Math.abs(r.y - it.y) < 2.5);
    if (row) row.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  }
  const lines: PdfLine[] = [];
  for (const r of rows.sort((a, b) => b.y - a.y)) {
    const sorted = r.items.sort((a, b) => a.x - b.x);
    const cells: PdfCell[] = [];
    let prevEnd = -Infinity;
    let cur: PdfCell | null = null;
    for (const it of sorted) {
      if (!it.str.trim()) continue; // espaços de preenchimento
      const text = it.str.replace(/\s+$/, '');
      if (cur && it.x - prevEnd < mergeGap) {
        cur.text = `${cur.text}${it.x - prevEnd > 0.6 || /^\s/.test(it.str) ? ' ' : ''}${text.trim()}`;
      } else {
        cur = { x: it.x, text: text.trim() };
        cells.push(cur);
      }
      prevEnd = it.x + it.w;
    }
    if (cells.length) lines.push({ page, cells });
  }
  return lines;
}

export interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence?: number;
}
/** Palavras do OCR (pixels de imagem renderizada com `scale` px por ponto) -> itens para itemsToLines. */
export function ocrWordsToItems(words: OcrWord[], scale: number): RawItem[] {
  return words
    .filter((w) => w.text.trim() && (w.confidence ?? 100) >= 30 && !/^[|¦_[\]{}!\\]+$/.test(w.text.trim())) // descarta só bordas/ruído de tabela; mantém +, /, —
    .map((w) => ({
      str: w.text,
      x: w.bbox.x0 / scale,
      y: -((w.bbox.y0 + w.bbox.y1) / 2) / scale,
      w: (w.bbox.x1 - w.bbox.x0) / scale,
    }));
}
