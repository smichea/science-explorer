import { describe, expect, it } from 'vitest';
import {
  checkChoice,
  checkNumeric,
  checkOrdering,
  checkSymbolic,
  expressionsEquivalent,
} from '../../src/lib/domain/answers';
import { formatNumber, parseLocaleNumber } from '../../src/lib/domain/i18n/format';
import { loadPackage } from './helpers';

const { exercises } = loadPackage();
const byId = (id: string) => exercises.find((e) => e.id === id)!;

describe('locale numbers', () => {
  it('parses French and English decimals', () => {
    expect(parseLocaleNumber('9,81')).toBeCloseTo(9.81);
    expect(parseLocaleNumber('9.81')).toBeCloseTo(9.81);
    expect(parseLocaleNumber('1,2e3')).toBe(1200);
    expect(parseLocaleNumber('1 200')).toBe(1200);
    expect(parseLocaleNumber('−4')).toBe(-4);
    expect(Number.isNaN(parseLocaleNumber('abc'))).toBe(true);
  });
  it('formats with the locale', () => {
    expect(formatNumber(9.81, 'fr', { digits: 2 })).toMatch(/9,81/);
    expect(formatNumber(9.81, 'en', { digits: 2, unit: 'm/s' })).toMatch(/9\.81/);
  });
});

describe('numeric answers', () => {
  const ex = byId('exercise.return.velocity_value');
  it('accepts values within tolerance and the right unit', () => {
    expect(checkNumeric(ex, { value: '9,81', unit: 'm/s' }, 'fr').correct).toBe(true);
    expect(checkNumeric(ex, { value: '9.7', unit: 'm/s' }, 'en').correct).toBe(true);
    expect(checkNumeric(ex, { value: '11', unit: 'm/s' }, 'en').correct).toBe(false);
  });
  it('gives half credit when only the unit is wrong and flags unreadable input', () => {
    const wrongUnit = checkNumeric(ex, { value: '9.81', unit: 'm/s²' }, 'en');
    expect(wrongUnit.correct).toBe(false);
    expect(wrongUnit.score).toBe(0.5);
    expect(wrongUnit.feedback).toBe('unit_wrong');
    expect(checkNumeric(ex, { value: 'neuf' }, 'fr').feedback).toBe('parse_error');
    expect(
      checkNumeric(
        byId('exercise.transfer.kinetics_rate'),
        { value: '0.05', unit: 'mol·L⁻¹·s⁻¹' },
        'en'
      ).correct
    ).toBe(true);
  });
});

describe('choice and ordering answers', () => {
  it('requires reasoning when asked and scores multiple choices partially', () => {
    const single = byId('exercise.galileo.graph_linearise');
    expect(checkChoice(single, ['d_vs_t2'], '').feedback).toBe('reasoning_required');
    expect(checkChoice(single, ['d_vs_t2'], 'because the points line up').correct).toBe(true);
    expect(checkChoice(single, ['d_vs_t'], 'because').correct).toBe(false);
    const multi = byId('exercise.transfer.classify_rate_processes');
    const correct = multi.choice!.choices.filter((c) => c.correct).map((c) => c.id);
    expect(checkChoice(multi, correct).correct).toBe(true);
    const partial = checkChoice(multi, correct.slice(0, 2));
    expect(partial.correct).toBe(false);
    expect(partial.score).toBeGreaterThan(0);
  });
  it('scores orderings by adjacent pairs', () => {
    const ex = byId('exercise.workshop.method_order');
    expect(checkOrdering(ex, ex.ordering!.correctOrder).correct).toBe(true);
    const swapped = [...ex.ordering!.correctOrder];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    const r = checkOrdering(ex, swapped);
    expect(r.correct).toBe(false);
    expect(r.score).toBeGreaterThan(0);
    expect(checkOrdering(ex, [...ex.ordering!.correctOrder].reverse()).score).toBe(0);
  });
});

describe('symbolic answers', () => {
  it('compares expressions numerically after parsing', () => {
    expect(expressionsEquivalent('6t+2', '2+6*t', 't')).toBe(true);
    expect(expressionsEquivalent('2(3t+1)', '6t + 2', 't')).toBe(true);
    expect(expressionsEquivalent('6t', '6t+2', 't')).toBe(false);
    expect(expressionsEquivalent('t^2', 't*t', 't')).toBe(true);
    expect(expressionsEquivalent('exp(0)*t', 't', 't')).toBe(true);
  });
  it('checks the power-rule exercise and reports parse errors', () => {
    const ex = byId('exercise.workshop.power_rule');
    expect(checkSymbolic(ex, '6*t + 2').correct).toBe(true);
    expect(checkSymbolic(ex, '2 + 6t').correct).toBe(true);
    expect(checkSymbolic(ex, '3t^2+2t').correct).toBe(false);
    expect(checkSymbolic(ex, '6t +').feedback).toBe('parse_error');
    expect(checkSymbolic(ex, '6x+2').feedback).toBe('parse_error');
  });
});
