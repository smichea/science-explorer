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

describe('Première numerics', () => {
  it('names the remarkable angles and gives their exact cosine, sine and tangent', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    expect(m.principalAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(m.principalAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 9);
    expect(m.angleLabel(2)).toBe('π/6');
    expect(m.angleLabel(-9)).toBe('−3π/4');
    expect(m.angleLabel(12)).toBe('π');
    expect(m.angleLabel(0)).toBe('0');
    expect(m.exactTrig(Math.PI / 6)).toEqual({ cos: '√3/2', sin: '1/2', tan: '√3/3' });
    expect(m.exactTrig(-Math.PI / 4)).toEqual({ cos: '√2/2', sin: '−√2/2', tan: '−1' });
    expect(m.exactTrig((5 * Math.PI) / 6)).toEqual({ cos: '−√3/2', sin: '1/2', tan: '−√3/3' });
    expect(m.exactTrig(Math.PI / 12)).toBeNull();
    expect(m.exactTrig(1)).toBeNull();
  });

  it('superposes inverse-square fields: away from a positive charge, towards a mass', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const k = m.FIELD_CONSTANTS.electric;
    const single = m.fieldAt('electric', k, [{ x: 0, y: 0, value: 1e-9 }], [0, 0], 2, 0);
    expect(single?.[0]).toBeCloseTo((k * 1e-9) / 4, 6);
    expect(single?.[1]).toBeCloseTo(0, 9);
    // Two equal charges: the field vanishes halfway between them.
    const middle = m.fieldAt(
      'electric',
      k,
      [
        { x: -1, y: 0, value: 1e-9 },
        { x: 1, y: 0, value: 1e-9 },
      ],
      [0, 0],
      0,
      0
    );
    expect(Math.hypot(middle![0], middle![1])).toBeLessThan(1e-6);
    const g = m.fieldAt(
      'gravitational',
      m.FIELD_CONSTANTS.gravitational,
      [{ x: 0, y: 0, value: 5.97e24 }],
      [0, 0],
      6.37e6,
      0
    );
    expect(g![0]).toBeCloseTo(-9.82, 1);
    expect(m.fieldAt('electric', k, [{ x: 0, y: 0, value: 1 }], [0, 0], 0, 0)).toBeNull();
    expect(m.fieldAt('uniform', 1, [], [0, -3], 5, 5)).toEqual([0, -3]);
    expect(m.forceIn([2, 0], -1.5)).toEqual([-3, -0]);
  });

  it('converts a transition between levels into a photon', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const balmer = m.photonBetween(-1.51, -3.4);
    expect(balmer.emission).toBe(true);
    expect(balmer.energyEv).toBeCloseTo(1.89, 2);
    expect(balmer.wavelengthNm).toBeCloseTo(656, 0);
    expect(balmer.domain).toBe('visible');
    const lyman = m.photonBetween(-13.6, -3.4);
    expect(lyman.emission).toBe(false);
    expect(lyman.domain).toBe('uv');
    expect(m.spectralDomain(1000)).toBe('ir');
  });

  it('reads a Lewis structure: formula, valence electrons, octets, polarity', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const water = [
      { id: 'o', element: 'O', lonePairs: 2, x: 0, y: 0 },
      { id: 'h1', element: 'H', lonePairs: 0, x: -1, y: -0.8 },
      { id: 'h2', element: 'H', lonePairs: 0, x: 1, y: -0.8 },
    ];
    const bonds = [
      { from: 'o', to: 'h1', order: 1 },
      { from: 'o', to: 'h2', order: 1 },
    ];
    expect(m.moleculeFormula(water)).toBe('H₂O');
    expect(m.moleculeFormula([{ element: 'C' }, { element: 'O' }, { element: 'O' }])).toBe('CO₂');
    expect(
      m.moleculeFormula([{ element: 'N' }, { element: 'H' }, { element: 'H' }, { element: 'H' }])
    ).toBe('NH₃');
    expect(m.moleculeFormula([{ element: 'Cl' }, { element: 'H' }])).toBe('HCl');
    expect(m.moleculeFormula([{ element: 'Cl' }, { element: 'Na' }])).toBe('NaCl');
    expect(
      m.moleculeFormula([
        { element: 'C' },
        { element: 'H' },
        { element: 'H' },
        { element: 'H' },
        { element: 'H' },
      ])
    ).toBe('CH₄');
    expect(m.valenceElectronCount(water)).toBe(8);
    expect(m.octetCheck(water[0], bonds)).toMatchObject({
      bonding: 2,
      lone: 2,
      electrons: 8,
      needed: 8,
      complete: true,
    });
    expect(m.octetCheck(water[1], bonds)).toMatchObject({
      electrons: 2,
      needed: 2,
      complete: true,
    });
    expect(m.bondPolarity('O', 'H')).toMatchObject({ polar: true, negative: 'from' });
    expect(m.bondPolarity('C', 'H').polar).toBe(false);
    expect(m.moleculePolar(water, bonds)).toBe(true);
    const co2 = [
      { id: 'c', element: 'C', lonePairs: 0, x: 0, y: 0 },
      { id: 'o1', element: 'O', lonePairs: 2, x: -1, y: 0 },
      { id: 'o2', element: 'O', lonePairs: 2, x: 1, y: 0 },
    ];
    expect(
      m.moleculePolar(co2, [
        { from: 'c', to: 'o1', order: 2 },
        { from: 'c', to: 'o2', order: 2 },
      ])
    ).toBe(false);
    expect(m.moleculePolar(co2, [], true)).toBe(true);
  });

  it('reads a weighted tree: intersections, total and conditional probabilities, independence', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const tree = {
      first: [
        { id: 'a', p: 0.3 },
        { id: 'na', p: 0.7 },
      ],
      second: [{ id: 'b' }, { id: 'nb' }],
      given: { a: [0.8, 0.2], na: [0.5, 0.5] },
    };
    const leaves = m.treeLeaves(tree);
    expect(leaves.find((l) => l.first === 'a' && l.second === 'b')?.p).toBeCloseTo(0.24, 9);
    expect(m.totalProbability(tree, 'b')).toBeCloseTo(0.59, 9);
    expect(m.conditionalProbability(tree, 'a', 'b')).toBeCloseTo(0.24 / 0.59, 9);
    expect(m.isIndependent(tree, 'a', 'b')).toBe(false);
    const independent = { ...tree, given: { a: [0.5, 0.5], na: [0.5, 0.5] } };
    expect(m.isIndependent(independent, 'a', 'b')).toBe(true);
    const random = seeded(3);
    const draw = m.drawTree(tree, random);
    expect(['a', 'na']).toContain(draw.first);
    expect(['b', 'nb']).toContain(draw.second);
  });

  it('computes the law, expectation, variance and standard deviation of a random variable', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const die = outcomesOf({ experiment: 'die', sides: 6, urn: [] });
    const law = m.distributionOf(die, { '1': -1, '2': -1, '3': -1, '4': -1, '5': -1, '6': 5 });
    expect(law.map((e) => e.x)).toEqual([-1, 5]);
    expect(law[0].p).toBeCloseTo(5 / 6, 9);
    expect(law[1].p).toBeCloseTo(1 / 6, 9);
    expect(m.expectation(law)).toBeCloseTo(0, 9);
    expect(m.variance(law)).toBeCloseTo(5, 9);
    expect(m.stdDeviation(law)).toBeCloseTo(Math.sqrt(5), 9);
  });

  it('names lights and applies filters', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    expect(m.colourName([1, 1, 1])).toBe('white');
    expect(m.colourName([1, 1, 0])).toBe('yellow');
    expect(m.colourName([0, 1, 1])).toBe('cyan');
    expect(m.colourName([0, 0, 0])).toBe('black');
    expect(m.transmitLight([1, 1, 1], ['r', 'b'])).toEqual([1, 0, 1]);
    expect(m.colourName(m.transmitLight([1, 1, 1], ['g']))).toBe('green');
    expect(m.rgbHex([1, 0, 0.5])).toBe('#ff0080');
  });

  it('computes yields, bond-energy balances, electron multipliers and uncertainties', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    expect(m.reactionYield(0.6, 0.8)).toBeCloseTo(0.75, 9);
    expect(Number.isNaN(m.reactionYield(1, 0))).toBe(true);
    // CH4 + 2 O2 → CO2 + 2 H2O: 4 C–H and 2 O=O broken, 2 C=O and 4 O–H formed.
    const balance = m.bondEnergyBalance([
      { energy: 413, broken: 4, formed: 0 },
      { energy: 498, broken: 2, formed: 0 },
      { energy: 799, broken: 0, formed: 2 },
      { energy: 463, broken: 0, formed: 4 },
    ]);
    expect(balance).toBe(4 * 413 + 2 * 498 - 2 * 799 - 4 * 463);
    expect(balance).toBeLessThan(0);
    expect(m.electronMultipliers(1, 2)).toEqual([2, 1]);
    expect(m.electronMultipliers(2, 3)).toEqual([3, 2]);
    expect(m.sampleStd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(m.standardUncertainty([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138 / Math.sqrt(8), 3);
    expect(Number.isNaN(m.sampleStd([1]))).toBe(true);
  });
});

describe('the integral read as an area', () => {
  it('sums rectangles that close in on the exact value', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const square = (x: number) => x * x;
    expect(m.riemannSum(square, 0, 1, 4, 'left')).toBeCloseTo((0 + 1 + 4 + 9) / 64, 12);
    expect(m.riemannSum(square, 0, 1, 4, 'right')).toBeCloseTo((1 + 4 + 9 + 16) / 64, 12);
    // The left sum underestimates a growing function, the right one overestimates it, and the
    // middle one is already close: a hundred rectangles land within a thousandth of a third.
    expect(m.riemannSum(square, 0, 1, 100, 'middle')).toBeCloseTo(1 / 3, 4);
    expect(m.integralOf(square, 0, 1)).toBeCloseTo(1 / 3, 6);
    expect(m.integralOf(Math.sin, 0, Math.PI)).toBeCloseTo(2, 5);
    // A point the function does not define is dropped instead of poisoning the whole sum.
    expect(m.riemannSum((x) => 1 / x, 0, 1, 4, 'left')).toBeCloseTo(
      0.25 * (1 / 0.25 + 1 / 0.5 + 1 / 0.75),
      9
    );
  });
});

describe('the binomial law', () => {
  it('gives the coefficients, a law that sums to one, and E = np', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    expect(m.binomialCoefficient(5, 2)).toBe(10);
    expect(m.binomialCoefficient(10, 0)).toBe(1);
    expect(m.binomialCoefficient(52, 5)).toBe(2598960);
    const law = m.binomialLaw(10, 0.3);
    expect(law).toHaveLength(11);
    expect(law.reduce((s, o) => s + o.p, 0)).toBeCloseTo(1, 12);
    expect(law[3].p).toBeCloseTo(120 * 0.3 ** 3 * 0.7 ** 7, 12);
    const values = Object.fromEntries(law.map((o) => [o.id, Number(o.id)]));
    const distribution = m.distributionOf(law, values);
    expect(m.expectation(distribution)).toBeCloseTo(3, 10);
    expect(m.variance(distribution)).toBeCloseTo(10 * 0.3 * 0.7, 10);
    expect(m.stdDeviation(distribution)).toBeCloseTo(Math.sqrt(2.1), 10);
  });

  it('reads the law through the outcomes of the tool', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const outcomes = m.outcomesOf({
      experiment: 'binomial',
      sides: 6,
      urn: [],
      trials: 4,
      success: 0.5,
    });
    expect(outcomes.map((o) => o.id)).toEqual(['0', '1', '2', '3', '4']);
    expect(outcomes.map((o) => o.p)).toEqual([1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16]);
  });
});

describe('geometry in space', () => {
  it('multiplies vectors, builds planes and measures distances', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const i: [number, number, number] = [1, 0, 0];
    const j: [number, number, number] = [0, 1, 0];
    expect(m.dot3(i, j)).toBe(0);
    expect(m.cross(i, j)).toEqual([0, 0, 1]);
    expect(m.norm3([2, 3, 6])).toBe(7);
    expect(m.angleBetween(i, j)).toBeCloseTo(90, 9);
    expect(m.angleBetween([1, 1, 0], i)).toBeCloseTo(45, 9);
    const plane = m.planeThrough([0, 0, 2], [0, 0, 1]);
    expect(plane).toEqual({ a: 0, b: 0, c: 1, d: -2 });
    expect(m.distancePointPlane([5, 7, 5], plane!)).toBeCloseTo(3, 12);
    // Three points of the plane z = 2 give the same plane, up to the length of the normal.
    const same = m.planeOfPoints([1, 0, 2], [0, 1, 2], [0, 0, 2])!;
    expect(m.distancePointPlane([5, 7, 5], same)).toBeCloseTo(3, 12);
    expect(m.planeOfPoints([0, 0, 0], [1, 1, 1], [2, 2, 2])).toBeNull();
  });

  it('clips a line to the box it is drawn in', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const segment = m.lineClipBox([0, 0, 0], [1, 0, 0], 5)!;
    expect(segment[0]).toEqual([-5, 0, 0]);
    expect(segment[1]).toEqual([5, 0, 0]);
    // A line parallel to an axis but outside the box never enters it.
    expect(m.lineClipBox([9, 0, 0], [0, 1, 0], 5)).toBeNull();
    const diagonal = m.lineClipBox([0, 0, 0], [1, 1, 1], 3)!;
    expect(diagonal[1]).toEqual([3, 3, 3]);
  });
});

describe('the Doppler effect and the telescope', () => {
  it('raises the pitch of a source that closes in, lowers it when it flees', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    expect(m.dopplerFrequency(440, 340, 0, 0)).toBeCloseTo(440, 9);
    expect(m.dopplerFrequency(440, 340, 34)).toBeCloseTo(440 * (340 / 306), 9);
    expect(m.dopplerFrequency(440, 340, 34)).toBeGreaterThan(440);
    expect(m.dopplerFrequency(440, 340, -34)).toBeLessThan(440);
    expect(m.dopplerFrequency(440, 340, 0, 34)).toBeCloseTo(440 * (374 / 340), 9);
  });

  it('magnifies the angle by the ratio of the two focal lengths', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const scope = m.telescope(60, 3, 0.5);
    expect(scope.magnification).toBeCloseTo(20, 12);
    expect(scope.length).toBe(63);
    expect(scope.apparentAngle).toBeCloseTo(10, 12);
    expect(scope.imageHeight).toBeCloseTo(60 * Math.tan((0.5 * Math.PI) / 180), 12);
  });
});

describe('chemical equilibrium', () => {
  it('settles where the quotient of reaction reaches the constant', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const reactants = [{ coefficient: 1, initial: 1 }];
    const products = [{ coefficient: 1, initial: 0 }];
    // A → B with K = 4: three quarters of A have reacted at equilibrium.
    const final = m.equilibriumExtent(reactants, products, 4);
    expect(final).toBeCloseTo(0.8, 6);
    expect(m.reactionQuotient(reactants, products, final)).toBeCloseTo(4, 4);
    expect(m.extentRatio(final, 1)).toBeCloseTo(0.8, 6);
    // A large constant leaves almost nothing behind: the transformation is all but total.
    expect(m.extentRatio(m.equilibriumExtent(reactants, products, 1e6), 1)).toBeGreaterThan(0.99);
    expect(m.reactionQuotient(reactants, products, 0)).toBe(0);
  });
});

describe('acids and bases', () => {
  it('reads a predominance diagram both ways', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    expect(m.pHFromRatio(4.8, 1)).toBeCloseTo(4.8, 12);
    expect(m.pHFromRatio(4.8, 10)).toBeCloseTo(5.8, 12);
    expect(m.ratioFromPH(4.8, 5.8)).toBeCloseTo(10, 9);
    expect(m.predominance(4.8, 3)).toBe('acid');
    expect(m.predominance(4.8, 6)).toBe('base');
    expect(m.predominance(4.8, 4.8)).toBe('equal');
  });

  it('titrates a strong acid: pH 7 at the equivalence, and a jump around it', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const setup = { c: 0.1, v: 20, titrant: 0.1, role: 'acid' as const };
    const ve = m.equivalenceVolume(0.1, 20, 0.1);
    expect(ve).toBeCloseTo(20, 12);
    expect(m.titrationPH(setup, 0)).toBeCloseTo(1, 2);
    expect(m.titrationPH(setup, ve)).toBeCloseTo(7, 2);
    expect(m.titrationPH(setup, 2 * ve)).toBeCloseTo(12.52, 1);
    // The jump: two units of pH crossed within a millilitre on either side of the equivalence.
    expect(m.titrationPH(setup, ve + 0.5) - m.titrationPH(setup, ve - 0.5)).toBeGreaterThan(2);
  });

  it('titrates a weak acid: pH = pKa at the half-equivalence, above 7 at the equivalence', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const setup = { c: 0.1, v: 20, titrant: 0.1, role: 'acid' as const, pka: 4.8 };
    const ve = m.equivalenceVolume(0.1, 20, 0.1);
    expect(m.titrationPH(setup, ve / 2)).toBeCloseTo(4.8, 2);
    expect(m.titrationPH(setup, ve)).toBeGreaterThan(8);
    expect(m.titrationPH(setup, 0)).toBeCloseTo((4.8 - Math.log10(0.1)) / 2, 1);
  });

  it('titrates a base with a strong acid, the mirror of the same balance', async () => {
    const m = await import('../../src/lib/domain/lessonTools');
    const strong = { c: 0.1, v: 20, titrant: 0.1, role: 'base' as const };
    const ve = m.equivalenceVolume(0.1, 20, 0.1);
    expect(m.titrationPH(strong, 0)).toBeCloseTo(13, 2);
    expect(m.titrationPH(strong, ve)).toBeCloseTo(7, 2);
    expect(m.titrationPH(strong, 2 * ve)).toBeCloseTo(1.48, 1);
    const weak = { ...strong, pka: 9.2 };
    expect(m.titrationPH(weak, ve / 2)).toBeCloseTo(9.2, 2);
    expect(m.titrationPH(weak, ve)).toBeLessThan(7);
  });
});
