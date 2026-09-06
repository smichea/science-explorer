/** Shared SVG scales for the lesson tools: a view in data units mapped onto a fixed canvas. */
export interface Scales {
  W: number;
  H: number;
  pad: { l: number; r: number; t: number; b: number };
  plotW: number;
  plotH: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
  fromSx: (px: number) => number;
  fromSy: (py: number) => number;
  xTicks: number[];
  yTicks: number[];
}

export const CANVAS = { W: 560, H: 400, pad: { l: 46, r: 18, t: 18, b: 38 } };
export const PALETTE = [
  '#7f9cff',
  '#ffb347',
  '#5ee6a8',
  '#ff8fab',
  '#b39dff',
  '#ffd166',
  '#f7f1e3',
];

export function niceTicks(min: number, max: number, count = 6): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const rough = span / count;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * pow;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step)
    out.push(Number(v.toFixed(10)));
  return out;
}

export function scales(
  view: { x: [number, number]; y: [number, number] },
  canvas = CANVAS
): Scales {
  const { W, H, pad } = canvas;
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const [xMin, xMax] = view.x;
  const [yMin, yMax] = view.y;
  return {
    W,
    H,
    pad,
    plotW,
    plotH,
    sx: (x) => pad.l + ((x - xMin) / (xMax - xMin)) * plotW,
    sy: (y) => H - pad.b - ((y - yMin) / (yMax - yMin)) * plotH,
    fromSx: (px) => xMin + ((px - pad.l) / plotW) * (xMax - xMin),
    fromSy: (py) => yMin + ((H - pad.b - py) / plotH) * (yMax - yMin),
    xTicks: niceTicks(xMin, xMax),
    yTicks: niceTicks(yMin, yMax),
  };
}

/** Formats a coordinate for a label, in the current locale. */
export function fmt(value: number, locale: string, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  // Rounding can produce a negative zero, which would print as "-0".
  const rounded = Number(value.toFixed(digits)) + 0;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(rounded);
}

/** Deterministic pseudo-random numbers (mulberry32), so generated measurements are reproducible. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Approximately normal noise (sum of uniforms), scaled to the given standard deviation. */
export function gaussian(random: () => number, sigma: number): number {
  let sum = 0;
  for (let i = 0; i < 6; i++) sum += random();
  return (sum - 3) * sigma;
}
