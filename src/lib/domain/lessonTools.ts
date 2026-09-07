import { compileExpression } from './answers';

// ---------------------------------------------------------------------------
// Arithmetic (multiples, divisors, primes)
// ---------------------------------------------------------------------------

export function divisors(n: number): number[] {
  const out: number[] = [];
  if (!Number.isInteger(n) || n < 1) return out;
  for (let d = 1; d * d <= n; d++)
    if (n % d === 0) {
      out.push(d);
      if (d !== n / d) out.push(n / d);
    }
  return out.sort((a, b) => a - b);
}

export function primeFactors(n: number): number[] {
  const out: number[] = [];
  if (!Number.isInteger(n) || n < 2) return out;
  let m = n;
  for (let p = 2; p * p <= m; p++)
    while (m % p === 0) {
      out.push(p);
      m /= p;
    }
  if (m > 1) out.push(m);
  return out;
}

export function isPrime(n: number): boolean {
  return Number.isInteger(n) && n >= 2 && primeFactors(n).length === 1;
}

/** Primes up to `max` (sieve of Eratosthenes). */
export function primesUpTo(max: number): number[] {
  const sieve = new Uint8Array(max + 1);
  const out: number[] = [];
  for (let i = 2; i <= max; i++) {
    if (sieve[i]) continue;
    out.push(i);
    for (let j = i * i; j <= max; j += i) sieve[j] = 1;
  }
  return out;
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export function superscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => (d === '-' ? '⁻' : SUPERSCRIPT[Number(d)]))
    .join('');
}

/** `2² × 3²` for 36; the number itself when it is prime, `1` for 1. */
export function factorisationText(n: number): string {
  const factors = primeFactors(n);
  if (factors.length === 0) return String(n);
  const groups = new Map<number, number>();
  for (const f of factors) groups.set(f, (groups.get(f) ?? 0) + 1);
  return [...groups.entries()]
    .map(([p, e]) => (e === 1 ? String(p) : `${p}${superscript(e)}`))
    .join(' × ');
}

// ---------------------------------------------------------------------------
// Descriptive statistics (lycée conventions: population standard deviation, quartiles by rank)
// ---------------------------------------------------------------------------

export interface DataSummary {
  n: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  range: number;
  iqr: number;
  std: number;
}

/** Expands a series given with counts into the sorted list of its values. */
export function expandSeries(values: number[], counts?: number[]): number[] {
  const out: number[] = [];
  values.forEach((v, i) => {
    const c = counts?.[i] ?? 1;
    for (let k = 0; k < c; k++) out.push(v);
  });
  return out.sort((a, b) => a - b);
}

export function describeData(values: number[], counts?: number[]): DataSummary | null {
  const sorted = expandSeries(values, counts);
  const n = sorted.length;
  if (n === 0) return null;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  // Q1: the smallest value such that at least a quarter of the values are at most equal to it.
  const q1 = sorted[Math.ceil(n / 4) - 1];
  const q3 = sorted[Math.ceil((3 * n) / 4) - 1];
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return {
    n,
    mean,
    median,
    q1,
    q3,
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    iqr: q3 - q1,
    std: Math.sqrt(variance),
  };
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

export function histogram(
  values: number[],
  counts: number[] | undefined,
  bins: number
): HistogramBin[] {
  const sorted = expandSeries(values, counts);
  if (sorted.length === 0) return [];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (max === min) return [{ from: min, to: max, count: sorted.length }];
  const width = (max - min) / bins;
  const out: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of sorted) {
    const i = Math.min(bins - 1, Math.floor((v - min) / width));
    out[i].count++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Random experiments
// ---------------------------------------------------------------------------

export interface Outcome {
  id: string;
  /** Theoretical probability. */
  p: number;
}

export function outcomesOf(tool: {
  experiment: 'die' | 'coin' | 'urn';
  sides: number;
  urn: Array<{ id: string; count: number }>;
}): Outcome[] {
  if (tool.experiment === 'coin')
    return [
      { id: 'heads', p: 0.5 },
      { id: 'tails', p: 0.5 },
    ];
  if (tool.experiment === 'urn') {
    const total = tool.urn.reduce((s, b) => s + b.count, 0);
    return tool.urn.map((b) => ({ id: b.id, p: total ? b.count / total : 0 }));
  }
  return Array.from({ length: tool.sides }, (_, i) => ({ id: String(i + 1), p: 1 / tool.sides }));
}

/** One draw: the outcome whose cumulative probability the random number falls in. */
export function drawOne(outcomes: Outcome[], random: () => number): string {
  const r = random();
  let acc = 0;
  for (const o of outcomes) {
    acc += o.p;
    if (r < acc) return o.id;
  }
  return outcomes[outcomes.length - 1]?.id ?? '';
}

/** Counts of every outcome after `count` draws. */
export function drawMany(
  outcomes: Outcome[],
  count: number,
  random: () => number
): Record<string, number> {
  const tally: Record<string, number> = Object.fromEntries(outcomes.map((o) => [o.id, 0]));
  for (let i = 0; i < count; i++) tally[drawOne(outcomes, random)]++;
  return tally;
}

/** Frequency of an event on `samples` samples of `size` draws each. */
export function sampleFrequencies(
  outcomes: Outcome[],
  event: Set<string>,
  size: number,
  samples: number,
  random: () => number
): number[] {
  const out: number[] = [];
  for (let s = 0; s < samples; s++) {
    let hits = 0;
    for (let i = 0; i < size; i++) if (event.has(drawOne(outcomes, random))) hits++;
    out.push(hits / size);
  }
  return out;
}

export function eventProbability(outcomes: Outcome[], event: Set<string>): number {
  return outcomes.filter((o) => event.has(o.id)).reduce((s, o) => s + o.p, 0);
}

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

export interface SequenceTerm {
  n: number;
  u: number;
}

/**
 * Terms of a sequence: `explicit` evaluates the expression of n; `recurrence` iterates
 * u(n+1) = f(u(n), n) from the first term. Null when the expression does not compile.
 */
export function sequenceTerms(
  tool: {
    mode: 'explicit' | 'recurrence';
    expr: string;
    first: number;
    start: number;
    count: number;
  },
  params: Record<string, number>
): SequenceTerm[] | null {
  const names = Object.keys(params);
  try {
    if (tool.mode === 'explicit') {
      const fn = compileExpression(tool.expr, ['n', ...names]);
      return Array.from({ length: tool.count }, (_, i) => {
        const n = tool.start + i;
        return { n, u: fn({ ...params, n }) };
      });
    }
    const fn = compileExpression(tool.expr, ['u', 'n', ...names]);
    const out: SequenceTerm[] = [{ n: tool.start, u: tool.first }];
    for (let i = 1; i < tool.count; i++) {
      const previous = out[i - 1];
      out.push({ n: previous.n + 1, u: fn({ ...params, u: previous.u, n: previous.n }) });
    }
    return out;
  } catch {
    return null;
  }
}

export function sequenceSum(terms: SequenceTerm[], upTo: number): number {
  return terms.filter((t) => t.n <= upTo).reduce((s, t) => s + t.u, 0);
}

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------

export interface WaveQuantities {
  period: number;
  frequency: number;
  wavelength: number;
  speed: number;
}

/** Period plus one of wavelength / speed determine the other (λ = v·T). */
export function waveQuantities(input: {
  period: number;
  wavelength?: number;
  speed?: number;
}): WaveQuantities {
  const period = input.period;
  const wavelength = input.wavelength ?? (input.speed ?? 1) * period;
  const speed = input.speed ?? wavelength / period;
  return { period, frequency: 1 / period, wavelength, speed };
}

/** Displacement of a progressive sinusoidal wave at x and t (zero before the front reaches x). */
export function waveDisplacement(
  x: number,
  t: number,
  wave: { amplitude: number; period: number; wavelength: number; speed: number }
): number {
  const delay = x / wave.speed;
  if (t < delay) return 0;
  return wave.amplitude * Math.sin((2 * Math.PI * (t - delay)) / wave.period);
}

// ---------------------------------------------------------------------------
// Optics
// ---------------------------------------------------------------------------

/** Angle of refraction (degrees) from Snell's law, or null under total internal reflection. */
export function refractionAngle(n1: number, n2: number, incidence: number): number | null {
  const s = (n1 * Math.sin((incidence * Math.PI) / 180)) / n2;
  if (Math.abs(s) > 1) return null;
  return (Math.asin(s) * 180) / Math.PI;
}

/** Critical angle of incidence (degrees) beyond which the light is totally reflected, if any. */
export function criticalAngle(n1: number, n2: number): number | null {
  if (n1 <= n2) return null;
  return (Math.asin(n2 / n1) * 180) / Math.PI;
}

export interface LensImage {
  /** Algebraic position of the image (positive: after the lens, a real image). */
  position: number;
  height: number;
  magnification: number;
  real: boolean;
  /** Object at the focal point: the image is at infinity. */
  atInfinity: boolean;
}

/** Thin converging lens (Descartes): 1/OA' − 1/OA = 1/f', with OA = −distance (object before the lens). */
export function lensImage(focal: number, distance: number, height: number): LensImage {
  const oa = -distance;
  const inverse = 1 / focal + 1 / oa;
  if (Math.abs(inverse) < 1e-9)
    return {
      position: Infinity,
      height: Infinity,
      magnification: Infinity,
      real: true,
      atInfinity: true,
    };
  const position = 1 / inverse;
  const magnification = position / oa;
  return {
    position,
    height: magnification * height,
    magnification,
    real: position > 0,
    atInfinity: false,
  };
}

// ---------------------------------------------------------------------------
// Periodic table (Z ≤ 36)
// ---------------------------------------------------------------------------

export type ElementFamily =
  | 'alkali'
  | 'alkaline_earth'
  | 'transition'
  | 'post_transition'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble_gas';

export interface Element {
  z: number;
  symbol: string;
  name: { fr: string; en: string };
  /** Mass number of the most abundant isotope. */
  a: number;
  group: number;
  period: number;
  family: ElementFamily;
}

const E = (
  z: number,
  symbol: string,
  fr: string,
  en: string,
  a: number,
  group: number,
  period: number,
  family: ElementFamily
): Element => ({ z, symbol, name: { fr, en }, a, group, period, family });

export const ELEMENTS: Element[] = [
  E(1, 'H', 'Hydrogène', 'Hydrogen', 1, 1, 1, 'nonmetal'),
  E(2, 'He', 'Hélium', 'Helium', 4, 18, 1, 'noble_gas'),
  E(3, 'Li', 'Lithium', 'Lithium', 7, 1, 2, 'alkali'),
  E(4, 'Be', 'Béryllium', 'Beryllium', 9, 2, 2, 'alkaline_earth'),
  E(5, 'B', 'Bore', 'Boron', 11, 13, 2, 'metalloid'),
  E(6, 'C', 'Carbone', 'Carbon', 12, 14, 2, 'nonmetal'),
  E(7, 'N', 'Azote', 'Nitrogen', 14, 15, 2, 'nonmetal'),
  E(8, 'O', 'Oxygène', 'Oxygen', 16, 16, 2, 'nonmetal'),
  E(9, 'F', 'Fluor', 'Fluorine', 19, 17, 2, 'halogen'),
  E(10, 'Ne', 'Néon', 'Neon', 20, 18, 2, 'noble_gas'),
  E(11, 'Na', 'Sodium', 'Sodium', 23, 1, 3, 'alkali'),
  E(12, 'Mg', 'Magnésium', 'Magnesium', 24, 2, 3, 'alkaline_earth'),
  E(13, 'Al', 'Aluminium', 'Aluminium', 27, 13, 3, 'post_transition'),
  E(14, 'Si', 'Silicium', 'Silicon', 28, 14, 3, 'metalloid'),
  E(15, 'P', 'Phosphore', 'Phosphorus', 31, 15, 3, 'nonmetal'),
  E(16, 'S', 'Soufre', 'Sulfur', 32, 16, 3, 'nonmetal'),
  E(17, 'Cl', 'Chlore', 'Chlorine', 35, 17, 3, 'halogen'),
  E(18, 'Ar', 'Argon', 'Argon', 40, 18, 3, 'noble_gas'),
  E(19, 'K', 'Potassium', 'Potassium', 39, 1, 4, 'alkali'),
  E(20, 'Ca', 'Calcium', 'Calcium', 40, 2, 4, 'alkaline_earth'),
  E(21, 'Sc', 'Scandium', 'Scandium', 45, 3, 4, 'transition'),
  E(22, 'Ti', 'Titane', 'Titanium', 48, 4, 4, 'transition'),
  E(23, 'V', 'Vanadium', 'Vanadium', 51, 5, 4, 'transition'),
  E(24, 'Cr', 'Chrome', 'Chromium', 52, 6, 4, 'transition'),
  E(25, 'Mn', 'Manganèse', 'Manganese', 55, 7, 4, 'transition'),
  E(26, 'Fe', 'Fer', 'Iron', 56, 8, 4, 'transition'),
  E(27, 'Co', 'Cobalt', 'Cobalt', 59, 9, 4, 'transition'),
  E(28, 'Ni', 'Nickel', 'Nickel', 58, 10, 4, 'transition'),
  E(29, 'Cu', 'Cuivre', 'Copper', 63, 11, 4, 'transition'),
  E(30, 'Zn', 'Zinc', 'Zinc', 64, 12, 4, 'transition'),
  E(31, 'Ga', 'Gallium', 'Gallium', 69, 13, 4, 'post_transition'),
  E(32, 'Ge', 'Germanium', 'Germanium', 74, 14, 4, 'metalloid'),
  E(33, 'As', 'Arsenic', 'Arsenic', 75, 15, 4, 'metalloid'),
  E(34, 'Se', 'Sélénium', 'Selenium', 80, 16, 4, 'nonmetal'),
  E(35, 'Br', 'Brome', 'Bromine', 79, 17, 4, 'halogen'),
  E(36, 'Kr', 'Krypton', 'Krypton', 84, 18, 4, 'noble_gas'),
];

export function elementOf(z: number): Element | undefined {
  return ELEMENTS[z - 1];
}

/** Symbols of the elements 37 to 94 (the nucleus panel goes beyond the table shown). */
const SYMBOLS_BEYOND =
  'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu'.split(
    ' '
  );

/** Symbol of the element of atomic number z (1 to 94), or `Z = z` beyond. */
export function nucleusSymbol(z: number): string {
  return elementOf(z)?.symbol ?? SYMBOLS_BEYOND[z - 37] ?? `Z=${z}`;
}

const SUBSHELLS: Array<[string, number]> = [
  ['1s', 2],
  ['2s', 2],
  ['2p', 6],
  ['3s', 2],
  ['3p', 6],
  ['4s', 2],
  ['3d', 10],
  ['4p', 6],
];

/** Electron configuration in the aufbau order (`1s² 2s² 2p⁶ 3s¹` for sodium), Z ≤ 36. */
export function electronConfiguration(z: number): string {
  if (z < 1 || z > 36) return '';
  const filled: Array<[string, number]> = [];
  let left = z;
  for (const [name, capacity] of SUBSHELLS) {
    if (left <= 0) break;
    const n = Math.min(capacity, left);
    filled.push([name, n]);
    left -= n;
  }
  // Chromium and copper take one 4s electron into the 3d subshell.
  if (z === 24 || z === 29) {
    const s4 = filled.find(([n]) => n === '4s');
    const d3 = filled.find(([n]) => n === '3d');
    if (s4 && d3) {
      s4[1] = 1;
      d3[1] += 1;
    }
  }
  return filled.map(([name, n]) => `${name}${superscript(n)}`).join(' ');
}

/** Electrons of the outer shell (valence electrons of a main-group element). */
export function valenceElectrons(z: number): number {
  const el = elementOf(z);
  if (!el) return 0;
  if (el.family === 'transition') return 2;
  if (el.z === 2) return 2;
  return el.group <= 2 ? el.group : el.group - 10;
}

/** The monoatomic ion an element forms most commonly, when it does (`Na⁺`, `O²⁻`). */
export function stableIon(z: number): string | null {
  const el = elementOf(z);
  if (!el) return null;
  const transition: Record<number, string> = {
    21: 'Sc³⁺',
    22: 'Ti⁴⁺',
    24: 'Cr³⁺',
    25: 'Mn²⁺',
    26: 'Fe²⁺ / Fe³⁺',
    27: 'Co²⁺',
    28: 'Ni²⁺',
    29: 'Cu²⁺',
    30: 'Zn²⁺',
  };
  if (transition[z]) return transition[z];
  if (el.family === 'transition' || el.family === 'noble_gas') return null;
  if (z === 1) return 'H⁺';
  const charge = el.group <= 2 ? el.group : el.group === 13 ? 3 : el.group - 18;
  if (charge === 0 || el.group === 14) return null;
  const magnitude = Math.abs(charge) === 1 ? '' : superscript(Math.abs(charge));
  return `${el.symbol}${magnitude}${charge > 0 ? '⁺' : '⁻'}`;
}

export type DecayKind = 'alpha' | 'beta_minus' | 'beta_plus';

/** The daughter nucleus of a decay (conservation of A and Z). */
export function decay(a: number, z: number, kind: DecayKind): { a: number; z: number } {
  switch (kind) {
    case 'alpha':
      return { a: a - 4, z: z - 2 };
    case 'beta_minus':
      return { a, z: z + 1 };
    case 'beta_plus':
      return { a, z: z - 1 };
  }
}

// ---------------------------------------------------------------------------
// Reaction extent table
// ---------------------------------------------------------------------------

export interface ExtentResult {
  xmax: number;
  /** Indexes of the limiting reactants (several when the mixture is stoichiometric). */
  limiting: number[];
}

/** Maximum extent of a reaction from the initial amounts: the first reactant to run out stops it. */
export function extentMax(
  reactants: Array<{ coefficient: number; initial: number }>
): ExtentResult {
  const ratios = reactants.map((r) => r.initial / r.coefficient);
  const xmax = Math.max(0, Math.min(...ratios));
  const limiting = ratios.map((r, i) => (Math.abs(r - xmax) < 1e-9 ? i : -1)).filter((i) => i >= 0);
  return { xmax, limiting };
}

/** Amount of a species at extent x: reactants are consumed, products formed. */
export function amountAt(
  species: { coefficient: number; initial: number },
  x: number,
  role: 'reactant' | 'product'
): number {
  return role === 'reactant'
    ? species.initial - species.coefficient * x
    : species.initial + species.coefficient * x;
}

// ---------------------------------------------------------------------------
// Trigonometry (unit circle)
// ---------------------------------------------------------------------------

/** The measure of an angle in ]−π, π]. */
export function principalAngle(t: number): number {
  const twoPi = 2 * Math.PI;
  let a = t % twoPi;
  if (a <= -Math.PI) a += twoPi;
  if (a > Math.PI) a -= twoPi;
  return a;
}

/** Index k of an angle t ≈ k·π/12 (the grid of the remarkable angles), or null. */
export function twelfthOf(t: number): number | null {
  const k = (12 * t) / Math.PI;
  const rounded = Math.round(k);
  return Math.abs(k - rounded) < 1e-6 ? rounded : null;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/** `π/6`, `−3π/4`, `0`, `π` for k twelfths of π. */
export function angleLabel(k: number): string {
  if (k === 0) return '0';
  const sign = k < 0 ? '−' : '';
  const n = Math.abs(k);
  const d = gcd(n, 12);
  const num = n / d;
  const den = 12 / d;
  const numText = num === 1 ? '' : String(num);
  return den === 1 ? `${sign}${numText}π` : `${sign}${numText}π/${den}`;
}

export interface ExactTrig {
  cos: string;
  sin: string;
  tan: string;
}

const EXACT_COS: Record<number, string> = {
  0: '1',
  2: '√3/2',
  3: '√2/2',
  4: '1/2',
  6: '0',
  8: '−1/2',
  9: '−√2/2',
  10: '−√3/2',
  12: '−1',
};
const EXACT_SIN: Record<number, string> = {
  0: '0',
  2: '1/2',
  3: '√2/2',
  4: '√3/2',
  6: '1',
  8: '√3/2',
  9: '√2/2',
  10: '1/2',
  12: '0',
};
const EXACT_TAN: Record<number, string> = {
  0: '0',
  2: '√3/3',
  3: '1',
  4: '√3',
  6: '∞',
  8: '−√3',
  9: '−1',
  10: '−√3/3',
  12: '0',
};

function negate(s: string): string {
  if (s === '0' || s === '∞') return s;
  return s.startsWith('−') ? s.slice(1) : `−${s}`;
}

/** Exact cosine, sine and tangent of a remarkable angle (multiples of π/6 and π/4), or null. */
export function exactTrig(t: number): ExactTrig | null {
  const k = twelfthOf(t);
  if (k === null) return null;
  let m = ((k % 24) + 24) % 24;
  // cos(2π − x) = cos x, sin(2π − x) = −sin x: reduce to the upper half-circle.
  const lower = m > 12;
  if (lower) m = 24 - m;
  if (EXACT_COS[m] === undefined) return null;
  return {
    cos: EXACT_COS[m],
    sin: lower ? negate(EXACT_SIN[m]) : EXACT_SIN[m],
    tan: lower ? negate(EXACT_TAN[m]) : EXACT_TAN[m],
  };
}

// ---------------------------------------------------------------------------
// Vector fields (electric, gravitational, uniform)
// ---------------------------------------------------------------------------

export type FieldMode = 'electric' | 'gravitational' | 'uniform';

/** k of Coulomb's law (N·m²/C²), G of the law of gravitation (N·m²/kg²). */
export const FIELD_CONSTANTS: Record<FieldMode, number> = {
  electric: 8.99e9,
  gravitational: 6.674e-11,
  uniform: 1,
};

export interface PlacedSource {
  x: number;
  y: number;
  /** Charge (C) or mass (kg). */
  value: number;
}

/**
 * The field at (x, y) by superposition of inverse-square sources: away from a positive charge
 * (electric), towards a mass (gravitational), constant in the uniform mode. Null at a source.
 */
export function fieldAt(
  mode: FieldMode,
  constant: number,
  sources: PlacedSource[],
  uniform: [number, number],
  x: number,
  y: number
): [number, number] | null {
  if (mode === 'uniform') return [uniform[0], uniform[1]];
  const sign = mode === 'electric' ? 1 : -1;
  let fx = 0;
  let fy = 0;
  for (const s of sources) {
    const dx = x - s.x;
    const dy = y - s.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1e-12) return null;
    const magnitude = (sign * constant * s.value) / r2;
    const r = Math.sqrt(r2);
    fx += (magnitude * dx) / r;
    fy += (magnitude * dy) / r;
  }
  return [fx, fy];
}

/** Force on a test charge or mass placed in the field. */
export function forceIn(field: [number, number], test: number): [number, number] {
  return [field[0] * test, field[1] * test];
}

// ---------------------------------------------------------------------------
// Photons and energy levels
// ---------------------------------------------------------------------------

export const PLANCK = 6.626e-34;
export const LIGHT_SPEED = 2.998e8;
export const ELECTRON_VOLT = 1.602e-19;

export type SpectralDomain = 'uv' | 'visible' | 'ir';

export function spectralDomain(nm: number): SpectralDomain {
  return nm < 400 ? 'uv' : nm > 800 ? 'ir' : 'visible';
}

export interface PhotonQuantities {
  energyEv: number;
  energyJ: number;
  frequency: number;
  wavelengthNm: number;
  domain: SpectralDomain;
  /** The atom falls to the lower level (the photon is emitted) rather than climbs (absorbed). */
  emission: boolean;
}

/** The photon exchanged between two levels: E = h·ν = h·c/λ. */
export function photonBetween(fromEv: number, toEv: number): PhotonQuantities {
  const energyEv = Math.abs(toEv - fromEv);
  const energyJ = energyEv * ELECTRON_VOLT;
  const frequency = energyJ / PLANCK;
  const wavelengthNm = energyJ > 0 ? ((PLANCK * LIGHT_SPEED) / energyJ) * 1e9 : Infinity;
  return {
    energyEv,
    energyJ,
    frequency,
    wavelengthNm,
    domain: spectralDomain(wavelengthNm),
    emission: toEv < fromEv,
  };
}

/** An approximate colour of a visible wavelength; grey outside the visible range. */
export function wavelengthColour(nm: number): string {
  if (nm < 400 || nm > 800) return '#8a8a8a';
  if (nm < 440) return '#7f00ff';
  if (nm < 490) return '#2e5bff';
  if (nm < 510) return '#00c8d8';
  if (nm < 580) return '#2ecc40';
  if (nm < 600) return '#ffdc00';
  if (nm < 645) return '#ff851b';
  return '#ff2a2a';
}

// ---------------------------------------------------------------------------
// Molecules (Lewis structures, groups, polarity)
// ---------------------------------------------------------------------------

/** Pauling electronegativities, Z ≤ 36 (noble gases absent). */
export const ELECTRONEGATIVITY: Record<string, number> = {
  H: 2.2,
  Li: 0.98,
  Be: 1.57,
  B: 2.04,
  C: 2.55,
  N: 3.04,
  O: 3.44,
  F: 3.98,
  Na: 0.93,
  Mg: 1.31,
  Al: 1.61,
  Si: 1.9,
  P: 2.19,
  S: 2.58,
  Cl: 3.16,
  K: 0.82,
  Ca: 1.0,
  Sc: 1.36,
  Ti: 1.54,
  V: 1.63,
  Cr: 1.66,
  Mn: 1.55,
  Fe: 1.83,
  Co: 1.88,
  Ni: 1.91,
  Cu: 1.9,
  Zn: 1.65,
  Ga: 1.81,
  Ge: 2.01,
  As: 2.18,
  Se: 2.55,
  Br: 2.96,
};

export function elementBySymbol(symbol: string): Element | undefined {
  return ELEMENTS.find((e) => e.symbol === symbol);
}

const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';
export function subscript(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPT[Number(d)] ?? d)
    .join('');
}

export interface MoleculeAtom {
  id: string;
  element: string;
  lonePairs: number;
  charge?: number;
}

export interface MoleculeBond {
  from: string;
  to: string;
  order: number;
}

/** Molecular formula in the Hill order: C, then H, then the others alphabetically (alphabetical without carbon). */
export function moleculeFormula(atoms: Array<{ element: string }>): string {
  const counts = new Map<string, number>();
  for (const a of atoms) counts.set(a.element, (counts.get(a.element) ?? 0) + 1);
  const hasCarbon = counts.has('C');
  const rank = (s: string) => (hasCarbon ? (s === 'C' ? '0' : s === 'H' ? '1' : `2${s}`) : s);
  return [...counts.keys()]
    .sort((a, b) => rank(a).localeCompare(rank(b)))
    .map((s) => {
      const n = counts.get(s) ?? 1;
      return n === 1 ? s : `${s}${subscript(n)}`;
    })
    .join('');
}

/** Valence electrons a Lewis structure must place: those of the atoms, minus the charge of the ion. */
export function valenceElectronCount(atoms: MoleculeAtom[]): number {
  return atoms.reduce((s, a) => {
    const el = elementBySymbol(a.element);
    return s + (el ? valenceElectrons(el.z) : 0) - (a.charge ?? 0);
  }, 0);
}

export interface OctetCheck {
  /** Bonding pairs around the atom (a double bond counts two). */
  bonding: number;
  lone: number;
  electrons: number;
  /** 2 for hydrogen and helium (the duet), 8 otherwise. */
  needed: number;
  complete: boolean;
}

/** Electrons around an atom of a Lewis structure: two per bond order plus two per lone pair. */
export function octetCheck(atom: MoleculeAtom, bonds: MoleculeBond[]): OctetCheck {
  const bonding = bonds
    .filter((b) => b.from === atom.id || b.to === atom.id)
    .reduce((s, b) => s + b.order, 0);
  const electrons = 2 * bonding + 2 * atom.lonePairs;
  const needed = atom.element === 'H' || atom.element === 'He' ? 2 : 8;
  return { bonding, lone: atom.lonePairs, electrons, needed, complete: electrons === needed };
}

export interface BondPolarity {
  difference: number;
  /** Polar when the electronegativities differ by 0.4 or more. */
  polar: boolean;
  /** Which end carries δ−. */
  negative: 'from' | 'to' | null;
}

export function bondPolarity(from: string, to: string): BondPolarity {
  const a = ELECTRONEGATIVITY[from] ?? 0;
  const b = ELECTRONEGATIVITY[to] ?? 0;
  const difference = Math.abs(a - b);
  const polar = difference >= 0.4;
  return { difference, polar, negative: !polar ? null : a > b ? 'from' : 'to' };
}

/** Sum of the bond dipoles of the flat drawing, from δ+ to δ−, weighted by the electronegativity differences. */
export function moleculeDipole(
  atoms: Array<MoleculeAtom & { x: number; y: number }>,
  bonds: MoleculeBond[]
): [number, number] {
  const byId = new Map(atoms.map((a) => [a.id, a]));
  let dx = 0;
  let dy = 0;
  for (const b of bonds) {
    const from = byId.get(b.from);
    const to = byId.get(b.to);
    if (!from || !to) continue;
    const polarity = bondPolarity(from.element, to.element);
    if (!polarity.polar) continue;
    const head = polarity.negative === 'from' ? from : to;
    const tail = head === from ? to : from;
    const vx = head.x - tail.x;
    const vy = head.y - tail.y;
    const n = Math.hypot(vx, vy) || 1;
    dx += (polarity.difference * vx) / n;
    dy += (polarity.difference * vy) / n;
  }
  return [dx, dy];
}

/** Polar when the bond dipoles do not cancel (the authored verdict wins when given). */
export function moleculePolar(
  atoms: Array<MoleculeAtom & { x: number; y: number }>,
  bonds: MoleculeBond[],
  override?: boolean
): boolean {
  if (override !== undefined) return override;
  const [dx, dy] = moleculeDipole(atoms, bonds);
  return Math.hypot(dx, dy) > 0.05;
}

// ---------------------------------------------------------------------------
// Probability trees and random variables
// ---------------------------------------------------------------------------

export interface ProbabilityTreeSpec {
  first: Array<{ id: string; p: number }>;
  second: Array<{ id: string }>;
  given: Record<string, number[]>;
}

export interface TreeLeaf {
  first: string;
  second: string;
  /** P(A ∩ B) = P(A) × P_A(B). */
  p: number;
}

export const leafId = (first: string, second: string): string => `${first}_${second}`;

export function treeLeaves(tree: ProbabilityTreeSpec): TreeLeaf[] {
  return tree.first.flatMap((a) =>
    tree.second.map((b, j) => ({
      first: a.id,
      second: b.id,
      p: a.p * (tree.given[a.id]?.[j] ?? 0),
    }))
  );
}

/** P_A(B) as authored on the tree. */
export function givenProbability(
  tree: ProbabilityTreeSpec,
  firstId: string,
  secondId: string
): number {
  const j = tree.second.findIndex((s) => s.id === secondId);
  return j < 0 ? 0 : (tree.given[firstId]?.[j] ?? 0);
}

/** P(B) = Σ P(A_i) × P_{A_i}(B) over the first level. */
export function totalProbability(tree: ProbabilityTreeSpec, secondId: string): number {
  return treeLeaves(tree)
    .filter((l) => l.second === secondId)
    .reduce((s, l) => s + l.p, 0);
}

/** P_B(A) = P(A ∩ B) / P(B): reading the tree backwards. */
export function conditionalProbability(
  tree: ProbabilityTreeSpec,
  firstId: string,
  secondId: string
): number {
  const pb = totalProbability(tree, secondId);
  if (pb === 0) return NaN;
  const leaf = treeLeaves(tree).find((l) => l.first === firstId && l.second === secondId);
  return (leaf?.p ?? 0) / pb;
}

/** A and B are independent when P_A(B) = P(B). */
export function isIndependent(
  tree: ProbabilityTreeSpec,
  firstId: string,
  secondId: string,
  eps = 1e-9
): boolean {
  return (
    Math.abs(givenProbability(tree, firstId, secondId) - totalProbability(tree, secondId)) < eps
  );
}

/** One two-stage draw along the tree. */
export function drawTree(
  tree: ProbabilityTreeSpec,
  random: () => number
): { first: string; second: string } {
  const first = drawOne(
    tree.first.map((f) => ({ id: f.id, p: f.p })),
    random
  );
  const row = tree.given[first] ?? [];
  const second = drawOne(
    tree.second.map((s, j) => ({ id: s.id, p: row[j] ?? 0 })),
    random
  );
  return { first, second };
}

export interface LawEntry {
  x: number;
  p: number;
}

/** The law of a random variable: the outcomes grouped by value, probabilities added. */
export function distributionOf(outcomes: Outcome[], values: Record<string, number>): LawEntry[] {
  const byValue = new Map<number, number>();
  for (const o of outcomes) {
    const x = values[o.id];
    if (x === undefined) continue;
    byValue.set(x, (byValue.get(x) ?? 0) + o.p);
  }
  return [...byValue.entries()].map(([x, p]) => ({ x, p })).sort((a, b) => a.x - b.x);
}

export function expectation(law: LawEntry[]): number {
  return law.reduce((s, e) => s + e.x * e.p, 0);
}

export function variance(law: LawEntry[]): number {
  const mean = expectation(law);
  return law.reduce((s, e) => s + e.p * (e.x - mean) ** 2, 0);
}

export function stdDeviation(law: LawEntry[]): number {
  return Math.sqrt(variance(law));
}

// ---------------------------------------------------------------------------
// Colours (additive and subtractive syntheses)
// ---------------------------------------------------------------------------

export type Channel = 'r' | 'g' | 'b';
export type Rgb = [number, number, number];
export type ColourName =
  'white' | 'red' | 'green' | 'blue' | 'yellow' | 'cyan' | 'magenta' | 'black';

/** The name of a light from the channels it carries (a channel counts above one half). */
export function colourName(rgb: Rgb): ColourName {
  const [r, g, b] = rgb.map((c) => c > 0.5);
  if (r && g && b) return 'white';
  if (r && g) return 'yellow';
  if (r && b) return 'magenta';
  if (g && b) return 'cyan';
  if (r) return 'red';
  if (g) return 'green';
  if (b) return 'blue';
  return 'black';
}

/** The light left after a filter that passes only some channels (an object reflecting them: the same). */
export function transmitLight(rgb: Rgb, passes: Channel[]): Rgb {
  return [
    passes.includes('r') ? rgb[0] : 0,
    passes.includes('g') ? rgb[1] : 0,
    passes.includes('b') ? rgb[2] : 0,
  ];
}

export function rgbHex(rgb: Rgb): string {
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, c)) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

// ---------------------------------------------------------------------------
// Reactions: yield, bond energies, half-equations
// ---------------------------------------------------------------------------

/** Yield of a synthesis: the amount obtained over the amount the extent table allows. */
export function reactionYield(obtained: number, maximum: number): number {
  return maximum > 0 ? obtained / maximum : NaN;
}

/** Molar reaction energy from bond energies: broken bonds cost, formed bonds release (positive: endothermic). */
export function bondEnergyBalance(
  bonds: Array<{ energy: number; broken: number; formed: number }>
): number {
  return bonds.reduce((s, b) => s + b.energy * (b.broken - b.formed), 0);
}

/** Multipliers of two half-equations so that the electrons exchanged balance. */
export function electronMultipliers(e1: number, e2: number): [number, number] {
  const l = (e1 * e2) / gcd(e1, e2);
  return [l / e1, l / e2];
}

// ---------------------------------------------------------------------------
// Uncertainties (physics conventions: sample standard deviation)
// ---------------------------------------------------------------------------

/** Sample standard deviation (n − 1 in the denominator), the estimator of the physics programme. */
export function sampleStd(values: number[], counts?: number[]): number {
  const sorted = expandSeries(values, counts);
  const n = sorted.length;
  if (n < 2) return NaN;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  return Math.sqrt(sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
}

/** Standard uncertainty of the mean of n measurements, u = s/√n. */
export function standardUncertainty(values: number[], counts?: number[]): number {
  const n = expandSeries(values, counts).length;
  return n < 2 ? NaN : sampleStd(values, counts) / Math.sqrt(n);
}
