import { describe, expect, it } from 'vitest';
import { en } from '../../src/lib/domain/i18n/messages.en';
import { fr } from '../../src/lib/domain/i18n/messages.fr';
import { localise, translate } from '../../src/lib/domain/i18n';
import { formatHistoricalDate } from '../../src/lib/domain/i18n/format';

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('interface dictionaries', () => {
  it('have identical key sets in French and English', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it('use the same placeholders in both languages', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(fr[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('have no empty strings', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(en[key].length, key).toBeGreaterThan(0);
      expect(fr[key].length, key).toBeGreaterThan(0);
    }
  });

  it('interpolates parameters', () => {
    expect(translate('fr', 'horizon.plusYears', { n: 2 })).toBe('+2 an(s)');
    expect(translate('en', 'mission.step', { n: 3, total: 15 })).toBe('Step 3 of 15');
  });
});

describe('content localisation', () => {
  it('returns the requested language and falls back to the other one', () => {
    expect(localise({ fr: 'Dérivée', en: 'Derivative' }, 'en')).toBe('Derivative');
    expect(localise({ fr: 'Dérivée', en: '' }, 'en')).toBe('Dérivée');
    expect(localise(undefined, 'fr')).toBe('');
    expect(
      formatHistoricalDate(
        {
          certainty: 'interval',
          from: '1602',
          to: '1608',
          display: { fr: 'vers 1604', en: 'c. 1604' },
        },
        'en'
      )
    ).toBe('c. 1604');
  });
});
