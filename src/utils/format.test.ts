import { describe, expect, it } from 'vitest';
import {
  addDays, computePace, distanceToMeters, formatDistance, formatDuration, formatPace,
  metersToField, parseDuration, startOfWeek,
} from './format';
import { formatTafValue, meetsMin, parseTafValue, remainingToGoal } from './taf';

describe('tempo', () => {
  it('formata durações', () => {
    expect(formatDuration(750)).toBe('12:30');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(7.5)).toBe('0:07,5');
    expect(formatDuration(null)).toBe('—');
  });
  it('interpreta durações', () => {
    expect(parseDuration('12:30')).toBe(750);
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('7,5')).toBe(7.5);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('1:2:3:4')).toBeNull();
    expect(parseDuration('')).toBeNull();
  });
});

describe('ritmo e distância', () => {
  it('calcula ritmo médio', () => {
    expect(computePace(5000, 1500)).toBe(300);
    expect(formatPace(300)).toBe('5:00/km');
    expect(computePace(0, 100)).toBeNull();
  });
  it('formata e converte distâncias', () => {
    expect(formatDistance(5000)).toBe('5 km');
    expect(formatDistance(400)).toBe('400 m');
    expect(distanceToMeters('5,5', 'km')).toBe(5500);
    expect(distanceToMeters('400', 'm')).toBe(400);
    expect(metersToField(2400)).toEqual({ value: '2,4', unit: 'km' });
    expect(metersToField(400)).toEqual({ value: '400', unit: 'm' });
  });
});

describe('datas', () => {
  it('calcula início da semana (segunda) e soma de dias', () => {
    expect(startOfWeek('2026-11-21')).toBe('2026-11-16');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('TAF', () => {
  it('interpreta e formata valores por tipo de teste', () => {
    expect(parseTafValue('tempo', '12:00')).toBe(720);
    expect(parseTafValue('repeticoes', '25')).toBe(25);
    expect(parseTafValue('repeticoes', '2,5')).toBeNull();
    expect(formatTafValue('distancia', 2600)).toContain('m');
  });
  it('compara com índice mínimo e meta', () => {
    expect(meetsMin('menor', 700, 720)).toBe(true);
    expect(meetsMin('menor', 730, 720)).toBe(false);
    expect(meetsMin('maior', 20, 25)).toBe(false);
    expect(meetsMin('maior', null, 25)).toBeNull();
    expect(remainingToGoal('menor', 750, 720)).toBe(30);
    expect(remainingToGoal('maior', 20, 25)).toBe(5);
    expect(remainingToGoal('maior', 30, 25)).toBe(-5);
  });
});
