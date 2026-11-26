import { describe, expect, it } from 'vitest';
import pages from './fixtures/plano_exemplo.json';
import { itemsToLines, ocrWordsToItems, parsePlan, planToWorkouts, weekdayIndex } from './planParser';

const plan = parsePlan(pages.flatMap((items, i) => itemsToLines(items, i + 1)));
const sec = <T extends string>(type: T) => plan.sections.filter((s) => s.type === type);

describe('importação de plano em PDF (PDF de exemplo)', () => {
  it('lê título e dados do cabeçalho', () => {
    expect(plan.title).toContain('TAF BOMBEIRO');
    expect(plan.meta.map((m) => m.label)).toEqual(['Aluno', 'Ciclo', 'Meta']);
    expect(plan.meta[1].value).toBe('12 Semanas (3 Meses)');
    expect(plan.warnings).toEqual([]);
  });

  it('lê os 4 cartões de dados (aluno, avaliação, meta, rotina)', () => {
    const cards = sec('cards')[0];
    if (cards.type !== 'cards') throw new Error();
    expect(cards.cards.map((c) => c.title)).toEqual(['Dados do Aluno', 'Avaliação Inicial', 'Meta Final (Mês 3)', 'Rotina Semanal']);
    expect(cards.cards[0].lines).toEqual(['Altura: 1,74m | Peso: 73kg', 'Nível: Iniciante na corrida']);
    expect(cards.cards[2].lines[1]).toContain('1\'40"/volta');
    expect(cards.cards[3].lines).toEqual(['Corrida: Seg / Qua / Sex', 'Academia: Ter / Qui']);
  });

  it('lê a tabela de zonas de ritmo', () => {
    const t = sec('table')[0];
    if (t.type !== 'table') throw new Error();
    expect(t.headers).toHaveLength(4);
    expect(t.rows).toHaveLength(4);
    expect(t.rows[3]).toEqual(['Tiro (Z4)', 'Intenso, ritmo alvo ou acima', '3\'50" – 4\'10"/km', '1\'32" – 1\'40"']);
  });

  it('lê os 3 meses × 4 semanas × 3 treinos, sem misturar colunas', () => {
    const weeks = sec('weeks');
    expect(weeks).toHaveLength(3);
    for (const w of weeks) {
      if (w.type !== 'weeks') throw new Error();
      expect(w.rows).toHaveLength(4);
      w.rows.forEach((r) => r.cells.forEach((c) => expect(c.length).toBeGreaterThan(10)));
    }
    const m1 = weeks[0];
    if (m1.type !== 'weeks') throw new Error();
    expect(m1.columns).toEqual(['Segunda (Base)', 'Quarta (Velocidade)', 'Sexta (Rodagem)']);
    expect(m1.rows[0].cells[0]).toBe("5' caminhada + 6x (2' trote Z2 / 1' caminhada) + 5' solto");
    expect(m1.rows[0].cells[1]).toBe('5\' trote leve + 6x 200m em Z3 (52"–56") | Pausa: 1\'30"');
    expect(m1.rows[3].cells[2]).toContain('SIMULADO 1');
    const m3 = weeks[2];
    if (m3.type !== 'weeks') throw new Error();
    expect(m3.rows[3].cells[2]).toBe('SIMULADO FINAL: Aquec. 10\' + 2.400m (Meta: ≤ 10\'00")');
  });

  it('lê academia (A/B com 6 exercícios), observação, simulados e regras', () => {
    const lists = sec('lists')[0];
    if (lists.type !== 'lists') throw new Error();
    expect(lists.groups.map((g) => g.items.length)).toEqual([6, 6]);
    expect(lists.groups[0].items[0]).toContain('cadência controlada');
    const texts = sec('text').map((t) => (t.type === 'text' ? t : null)!);
    expect(texts.map((t) => t.title)).toEqual(['Obs. Academia', 'Regras Gerais']);
    expect(texts[0].text).toContain('semanas de simulado (04, 08 e 12)');
    expect(texts[1].text).toContain('(3)');
    const tests = sec('table')[1];
    if (tests.type !== 'table') throw new Error();
    expect(tests.rows).toHaveLength(4);
    expect(tests.rows[1][2]).toBe('13\'30"–14\'00"');
    expect(tests.rows[0][3]).toBe('16\'00"');
  });

  it('gera os treinos: 36 de corrida + 24 de academia, nos dias certos', () => {
    const w = planToWorkouts(plan);
    expect(w).toHaveLength(36 + 24);
    const first = w[0];
    expect(first.dayOffset).toBe(0);
    expect(first.fields.name).toBe('Sem 01 — Segunda (Base)');
    expect(w.find((x) => x.fields.name === 'Sem 04 — Sexta (Rodagem)')?.dayOffset).toBe(3 * 7 + 4);
    const gym = w.find((x) => x.fields.name === 'Sem 02 — Treino A (Terça)');
    expect(gym?.dayOffset).toBe(7 + 1);
    expect(gym?.fields.workout_type).toBe('forca');
    expect(gym?.fields.main_part?.split('\n')).toHaveLength(6);
    expect(gym?.fields.notes).toContain('semanas de simulado');
    expect(w.find((x) => x.fields.name === 'Sem 04 — Quinta')).toBeUndefined();
    expect(w.filter((x) => x.dayOffset % 7 === 1)).toHaveLength(12);
  });

  it('mantém o texto bruto completo para conferência', () => {
    expect(plan.raw.join(' ')).toContain('Regras Gerais');
    expect(plan.raw.some((l) => /Page \d of \d/.test(l))).toBe(false);
  });
});

describe('weekdayIndex', () => {
  it('reconhece dias', () => {
    expect(weekdayIndex('Treino A (Terça)')).toBe(1);
    expect(weekdayIndex('Sexta (Rodagem)')).toBe(4);
    expect(weekdayIndex('Zona')).toBeNull();
  });
});

describe('PDF inesperado', () => {
  it('não quebra e avisa quando não há tabelas', () => {
    const p = parsePlan([{ page: 1, cells: [{ x: 50, text: 'Qualquer documento' }] }, { page: 1, cells: [{ x: 50, text: 'texto solto sem tabela' }] }]);
    expect(p.warnings.length).toBe(1);
    expect(p.raw).toHaveLength(2);
  });
});

describe('leitura por OCR (foto/PDF escaneado)', () => {
  it('lê a 1ª página mesmo com cabeçalhos coloridos ilegíveis e pequenos erros', async () => {
    const words = (await import('./fixtures/plano_ocr_pagina1.json')).default as { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; conf: number }[];
    const items = ocrWordsToItems(words.map((w) => ({ text: w.text, bbox: w.bbox, confidence: w.conf })), 200 / 72);
    const p = parsePlan(itemsToLines(items, 1, 7));
    const text = JSON.stringify(p.sections);
    expect(p.meta.map((m) => m.label)).toContain('Ciclo');
    const cards = p.sections.find((s) => s.type === 'cards');
    expect(JSON.stringify(cards)).toContain('Altura: 1,74m');
    // tabela de zonas sem cabeçalho: nenhuma linha de dados é perdida
    const pace = p.sections.find((s) => s.type === 'table');
    expect(pace && pace.type === 'table' && pace.rows.length).toBe(4);
    // os meses 1 e 2 viram tabelas de semanas com 3 colunas de treino
    const weeks = p.sections.filter((s) => s.type === 'weeks');
    expect(weeks.length).toBe(2);
    for (const w of weeks) if (w.type === 'weeks') { expect(w.columns).toHaveLength(3); expect(w.rows.length).toBe(4); }
    expect(text).toContain('SIMULADO 2');
  });
});
