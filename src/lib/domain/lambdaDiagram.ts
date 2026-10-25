import { type LambdaTerm, type LambdaReduction, type ReductionGraph } from './lambda';

export interface DiagramStroke {
  key: string;
  owner: number;
  kind: 'bar' | 'wire' | 'join' | 'left' | 'right';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dots: 'none' | 'start' | 'both';
  binder?: number;
  label?: string;
}
export interface TermBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface LambdaDiagram {
  strokes: DiagramStroke[];
  width: number;
  height: number;
  bounds: Map<number, TermBounds>;
}

/** Tromp's leftmost-output convention, with explicit attachment dots and coloured joins. */
export function lambdaDiagram(term: LambdaTerm): LambdaDiagram {
  const strokes: DiagramStroke[] = [];
  const bounds = new Map<number, TermBounds>();
  let column = 0;
  const X = (x: number) => 60 + x * 64;
  const Y = (y: number) => 46 + y * 24;
  type Binder = { id: number; name: string; y: number };
  function draw(
    t: LambdaTerm,
    top: number,
    env: Binder[]
  ): { lo: number; hi: number; bottom: number } {
    let shape: { lo: number; hi: number; bottom: number };
    if (t.kind === 'var') {
      const col = column++;
      const binder = [...env].reverse().find((b) => b.name === t.name);
      const bottom = top + 0.8;
      strokes.push({
        key: `wire:${t.id}`,
        owner: t.id,
        kind: 'wire',
        x1: X(col),
        x2: X(col),
        y1: Y(binder?.y ?? -0.7),
        y2: Y(bottom),
        binder: binder?.id,
        dots: binder ? 'start' : 'none',
        label: binder ? undefined : t.name,
      });
      shape = { lo: col, hi: col, bottom };
    } else if (t.kind === 'lam') {
      shape = draw(t.body, top + 1, [...env, { id: t.id, name: t.name, y: top }]);
      strokes.push({
        key: `bar:${t.id}`,
        owner: t.id,
        kind: 'bar',
        x1: X(shape.lo) - 14,
        x2: X(shape.hi) + 14,
        y1: Y(top),
        y2: Y(top),
        dots: 'none',
        label: `λ${t.name}`,
      });
    } else {
      const f = draw(t.fun, top, env);
      const a = draw(t.arg, top, env);
      const join = Math.max(f.bottom, a.bottom) + 0.8;
      strokes.push({
        key: `left:${t.id}`,
        owner: t.id,
        kind: 'left',
        x1: X(f.lo),
        x2: X(f.lo),
        y1: Y(f.bottom),
        y2: Y(join + 0.4),
        dots: 'none',
      });
      strokes.push({
        key: `right:${t.id}`,
        owner: t.id,
        kind: 'right',
        x1: X(a.lo),
        x2: X(a.lo),
        y1: Y(a.bottom),
        y2: Y(join),
        dots: 'none',
      });
      strokes.push({
        key: `join:${t.id}`,
        owner: t.id,
        kind: 'join',
        x1: X(f.lo),
        x2: X(a.lo),
        y1: Y(join),
        y2: Y(join),
        dots: 'both',
      });
      shape = { lo: f.lo, hi: a.hi, bottom: join + 0.4 };
    }
    bounds.set(t.id, {
      x: X(shape.lo) - 20,
      y: Y(top) - 10,
      width: X(shape.hi) - X(shape.lo) + 40,
      height: Y(shape.bottom) - Y(top) + 20,
    });
    return shape;
  }
  const result = draw(term, 0, []);
  const width = Math.max(360, X(result.hi) + 65);
  const height = Math.max(180, Y(result.bottom) + 35);
  const offset = (width - (X(result.hi) + 65)) / 2;
  for (const s of strokes) {
    s.x1 += offset;
    s.x2 += offset;
  }
  for (const b of bounds.values()) b.x += offset;
  // Bars underneath wires; origin and join dots remain readable at crossings.
  strokes.sort((a, b) => Number(a.kind !== 'bar') - Number(b.kind !== 'bar'));
  return { strokes, bounds, width, height };
}

export interface MovingStroke extends DiagramStroke {
  opacity: number;
}
/** Copies start at their actual argument's coordinates, then move to their substitution sites. */
export function morphDiagram(
  before: LambdaDiagram,
  after: LambdaDiagram,
  reduction: LambdaReduction,
  progress: number
): MovingStroke[] {
  const old = new Map(before.strokes.map((s) => [s.key, s]));
  const target = new Set(after.strokes.map((s) => s.key));
  const p = Math.max(0, Math.min(1, progress));
  const ease = p * p * (3 - 2 * p);
  const next: MovingStroke[] = after.strokes.map((s) => {
    const source = old.get(s.key) ?? old.get(`${s.kind}:${reduction.origins.get(s.owner)}`);
    if (!source) return { ...s, opacity: p };
    const lerp = (a: number, b: number) => a + (b - a) * ease;
    return {
      ...s,
      x1: lerp(source.x1, s.x1),
      y1: lerp(source.y1, s.y1),
      x2: lerp(source.x2, s.x2),
      y2: lerp(source.y2, s.y2),
      opacity: 1,
    };
  });
  for (const s of before.strokes)
    if (!target.has(s.key)) next.push({ ...s, opacity: Math.max(0, 1 - p * 2) });
  return next;
}

export type LambdaPoint3 = [number, number, number];
/** Stable depth layers. Height measures term size; width separates nodes of a layer. */
export function reductionPositions(graph: ReductionGraph): Map<number, LambdaPoint3> {
  const result = new Map<number, LambdaPoint3>();
  const maxDepth = Math.max(0, ...graph.nodes.map((n) => n.depth));
  const maxSize = Math.max(1, ...graph.nodes.map((n) => n.size));
  for (let depth = 0; depth <= maxDepth; depth++) {
    const layer = graph.nodes.filter((n) => n.depth === depth);
    layer.forEach((n, i) =>
      result.set(n.id, [
        (i - (layer.length - 1) / 2) * 3.4,
        (n.size / maxSize - 0.5) * 5,
        (depth - maxDepth / 2) * 3.2,
      ])
    );
  }
  return result;
}
