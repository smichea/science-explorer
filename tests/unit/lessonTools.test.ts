import { describe, expect, it } from 'vitest';
import {
  amountAt,
  criticalAngle,
  decay,
  describeData,
  divisors,
  drawMany,
  electronConfiguration,
  extentMax,
  factorisationText,
  histogram,
  isPrime,
  lensImage,
  nucleusSymbol,
  outcomesOf,
  primeFactors,
  primesUpTo,
  refractionAngle,
  sampleFrequencies,
  sequenceSum,
  sequenceTerms,
  stableIon,
  valenceElectrons,
  waveDisplacement,
  waveQuantities,
} from '../../src/lib/domain/lessonTools';
import { seeded } from '../../src/lib/lessons/axes';

describe('arithmetic', () => {
  it('lists divisors and prime factors', () => {
    expect(divisors(36)).toEqual([1, 2, 3, 4, 6, 9, 12, 18, 36]);
    expect(primeFactors(36)).toEqual([2, 2, 3, 3]);
    expect(factorisationText(36)).toBe('2² × 3²');
    expect(factorisationText(97)).toBe('97');
    expect(isPrime(97)).toBe(true);
    expect(isPrime(1)).toBe(false);
    expect(primesUpTo(30)).toEqual([2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  });
});

describe('descriptive statistics', () => {
  it('follows the lycée conventions (rank quartiles, population standard deviation)', () => {
    const s = describeData([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(s.n).toBe(8);
    expect(s.mean).toBe(5);
    expect(s.median).toBe(4.5);
    expect(s.q1).toBe(4); // rank ceil(8/4) = 2
    expect(s.q3).toBe(5); // rank ceil(24/4) = 6
    expect(s.std).toBe(2);
    expect(s.range).toBe(7);
  });
  it('expands counts and bins a histogram', () => {
    const s = describeData([10, 12, 15], [1, 2, 1])!;
    expect(s.n).toBe(4);
    expect(s.mean).toBeCloseTo(12.25);
    expect(s.median).toBe(12);
    const bins = histogram([1, 2, 3, 4, 5, 6, 7, 8], undefined, 4);
    expect(bins.map((b) => b.count)).toEqual([2, 2, 2, 2]);
    expect(bins[3].to).toBe(8);
  });
});

describe('random experiments', () => {
  it('is reproducible and converges to the probabilities', () => {
    const outcomes = outcomesOf({ experiment: 'die', sides: 6, urn: [] });
    expect(outcomes).toHaveLength(6);
    const a = drawMany(outcomes, 600, seeded(3));
    const b = drawMany(outcomes, 600, seeded(3));
    expect(a).toEqual(b);
    expect(Object.values(a).reduce((s, v) => s + v, 0)).toBe(600);
    const big = drawMany(outcomes, 60000, seeded(5));
    for (const face of ['1', '2', '3', '4', '5', '6'])
      expect(big[face] / 60000).toBeCloseTo(1 / 6, 1);
    const urn = outcomesOf({
      experiment: 'urn',
      sides: 6,
      urn: [
        { id: 'red', count: 3 },
        { id: 'blue', count: 1 },
      ],
    });
    expect(urn.find((o) => o.id === 'red')?.p).toBe(0.75);
    const freqs = sampleFrequencies(urn, new Set(['red']), 100, 20, seeded(11));
    expect(freqs).toHaveLength(20);
    const mean = freqs.reduce((s, f) => s + f, 0) / freqs.length;
    expect(mean).toBeGreaterThan(0.65);
    expect(mean).toBeLessThan(0.85);
  });
});

describe('sequences', () => {
  it('computes explicit and recurrent sequences', () => {
    const explicit = sequenceTerms(
      { mode: 'explicit', expr: '2*n+1', first: 0, start: 0, count: 4 },
      {}
    )!;
    expect(explicit.map((t) => t.u)).toEqual([1, 3, 5, 7]);
    const geometric = sequenceTerms(
      { mode: 'recurrence', expr: 'q*u', first: 3, start: 1, count: 4 },
      { q: 2 }
    )!;
    expect(geometric.map((t) => [t.n, t.u])).toEqual([
      [1, 3],
      [2, 6],
      [3, 12],
      [4, 24],
    ]);
    expect(sequenceSum(geometric, 3)).toBe(21);
    expect(
      sequenceTerms({ mode: 'explicit', expr: 'n+', first: 0, start: 0, count: 3 }, {})
    ).toBeNull();
  });
});

describe('waves', () => {
  it('links period, wavelength and speed, and delays the front', () => {
    const w = waveQuantities({ period: 0.5, speed: 340 });
    expect(w.wavelength).toBe(170);
    expect(w.frequency).toBe(2);
    const wave = { amplitude: 1, ...waveQuantities({ period: 2, wavelength: 4 }) };
    expect(wave.speed).toBe(2);
    expect(waveDisplacement(3, 1, wave)).toBe(0); // the front (at x = 2 m) has not reached 3 m
    expect(waveDisplacement(0, 0.5, wave)).toBeCloseTo(1);
  });
});

describe('optics', () => {
  it('applies Snell’s law and the thin-lens formula', () => {
    expect(refractionAngle(1, 1.5, 30)).toBeCloseTo(19.47, 1);
    expect(refractionAngle(1.5, 1, 60)).toBeNull();
    expect(criticalAngle(1.5, 1)).toBeCloseTo(41.8, 1);
    expect(criticalAngle(1, 1.5)).toBeNull();
    const image = lensImage(5, 12, 3);
    expect(image.position).toBeCloseTo(60 / 7, 3);
    expect(image.magnification).toBeCloseTo(-5 / 7, 3);
    expect(image.real).toBe(true);
    expect(lensImage(5, 5, 3).atInfinity).toBe(true);
    expect(lensImage(5, 3, 3).real).toBe(false);
  });
});

describe('periodic table', () => {
  it('writes configurations, valence electrons and common ions', () => {
    expect(electronConfiguration(11)).toBe('1s² 2s² 2p⁶ 3s¹');
    expect(electronConfiguration(17)).toBe('1s² 2s² 2p⁶ 3s² 3p⁵');
    expect(electronConfiguration(24)).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹ 3d⁵');
    expect(valenceElectrons(17)).toBe(7);
    expect(valenceElectrons(12)).toBe(2);
    expect(stableIon(11)).toBe('Na⁺');
    expect(stableIon(12)).toBe('Mg²⁺');
    expect(stableIon(17)).toBe('Cl⁻');
    expect(stableIon(8)).toBe('O²⁻');
    expect(stableIon(10)).toBeNull();
    expect(stableIon(6)).toBeNull();
    expect(decay(238, 92, 'alpha')).toEqual({ a: 234, z: 90 });
    expect(decay(14, 6, 'beta_minus')).toEqual({ a: 14, z: 7 });
    expect(nucleusSymbol(92)).toBe('U');
    expect(nucleusSymbol(90)).toBe('Th');
    expect(nucleusSymbol(6)).toBe('C');
  });
});

describe('reaction extent', () => {
  it('finds the limiting reactant and the final amounts', () => {
    // 2 H2 + O2 → 2 H2O with 3 mol H2 and 2 mol O2: xmax = 1.5, H2 limiting.
    const r = extentMax([
      { coefficient: 2, initial: 3 },
      { coefficient: 1, initial: 2 },
    ]);
    expect(r.xmax).toBe(1.5);
    expect(r.limiting).toEqual([0]);
    expect(amountAt({ coefficient: 1, initial: 2 }, 1.5, 'reactant')).toBe(0.5);
    expect(amountAt({ coefficient: 2, initial: 0 }, 1.5, 'product')).toBe(3);
    const stoichiometric = extentMax([
      { coefficient: 2, initial: 4 },
      { coefficient: 1, initial: 2 },
    ]);
    expect(stoichiometric.limiting).toEqual([0, 1]);
  });
});
