import type {
  CompiledNode,
  ExerciseDefinition,
  LessonDefinition,
  LessonStep,
  LessonTool,
  LocalisedText,
  PlotterAction,
  PlotterCurve,
  PlotterParameter,
  RouteDefinition,
} from '../content-schema';
import { compileExpression } from './answers';

/** The lesson actually played for a node: authored, or built from its description. */
export interface LessonPlan {
  id: string;
  node: CompiledNode;
  depth: number;
  tools: LessonTool[];
  steps: LessonStep[];
  authored: boolean;
}

const AUTO_TEXT = {
  play: {
    fr: 'À vous : manipulez l’outil librement. Changez les réglages, observez ce qui varie et ce qui reste, et formulez à voix haute ce que vous voyez.',
    en: 'Your turn: handle the tool freely. Change the settings, watch what varies and what stays, and say out loud what you see.',
  },
  exercises: {
    fr: 'Quelques exercices pour fixer les idées. Saisissez vos réponses ; un indice est disponible si vous bloquez.',
    en: 'A few exercises to settle the ideas. Type your answers; a hint is available if you get stuck.',
  },
} satisfies Record<string, LocalisedText>;

/** Splits a description into slides: one paragraph each, both languages paired by rank. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function pairedSlides(text: LocalisedText): LocalisedText[] {
  const fr = paragraphs(text.fr);
  const en = paragraphs(text.en);
  const count = Math.min(fr.length, en.length);
  if (count === 0) return [text];
  const out: LocalisedText[] = [];
  for (let i = 0; i < count; i++) {
    // The longer language keeps its remaining paragraphs on the last slide.
    const last = i === count - 1;
    out.push({
      fr: last ? fr.slice(i).join('\n\n') : fr[i],
      en: last ? en.slice(i).join('\n\n') : en[i],
    });
  }
  return out;
}

/** Exercises of a node, the ones at or below the lesson depth first. */
export function exercisesForNode(
  nodeId: string,
  depth: number,
  exercises: ExerciseDefinition[]
): ExerciseDefinition[] {
  return exercises
    .filter((e) => e.nodeId === nodeId && e.type !== 'free_explanation')
    .sort(
      (a, b) => Math.abs(a.depth - depth) - Math.abs(b.depth - depth) || a.id.localeCompare(b.id)
    );
}

function autoSteps(
  node: CompiledNode,
  depth: number,
  tools: LessonTool[],
  exercises: ExerciseDefinition[]
): LessonStep[] {
  const source = node.description ?? node.overview ?? node.shortPurpose;
  const steps: LessonStep[] = pairedSlides(source).map((text, i) => ({
    id: `slide_${i + 1}`,
    kind: 'slide',
    text,
    actions: [],
    exercises: [],
  }));
  if (tools.length)
    steps.push({ id: 'play', kind: 'play', text: AUTO_TEXT.play, actions: [], exercises: [] });
  const ids = exercisesForNode(node.id, depth, exercises).map((e) => e.id);
  if (ids.length)
    steps.push({
      id: 'exercises',
      kind: 'exercises',
      text: AUTO_TEXT.exercises,
      actions: [],
      exercises: ids,
    });
  return steps;
}

/**
 * The lesson of a node at a depth: the authored lesson for that depth (else the closest one),
 * completed with automatic slides when it has none; without any authored lesson, slides are cut
 * from the description, followed by the exercises of the node. An authored lesson without an
 * exercises step still ends with the exercises of the node.
 */
export function lessonFor(
  node: CompiledNode,
  lessons: LessonDefinition[],
  exercises: ExerciseDefinition[],
  depth = 1
): LessonPlan {
  const own = lessons
    .filter((l) => l.nodeId === node.id)
    .sort((a, b) => Math.abs(a.depth - depth) - Math.abs(b.depth - depth) || a.depth - b.depth);
  const authored = own[0];
  const effectiveDepth = authored?.depth ?? depth;
  const tools = authored?.tools ?? [];
  let steps = authored?.steps ?? autoSteps(node, effectiveDepth, tools, exercises);
  if (authored?.steps && !steps.some((s) => s.kind === 'exercises')) {
    const ids = exercisesForNode(node.id, effectiveDepth, exercises).map((e) => e.id);
    if (ids.length)
      steps = [
        ...steps,
        {
          id: 'exercises',
          kind: 'exercises',
          text: AUTO_TEXT.exercises,
          actions: [],
          exercises: ids,
        },
      ];
  }
  return {
    id: authored?.id ?? `lesson.auto.${node.id}`,
    node,
    depth: effectiveDepth,
    tools,
    steps,
    authored: !!authored?.steps,
  };
}

/** The tool a step shows: the one it names, else the first tool of the lesson. */
export function toolOfStep(plan: LessonPlan, step: LessonStep | null): LessonTool | null {
  if (!plan.tools.length) return null;
  return plan.tools.find((t) => t.id === step?.tool) ?? plan.tools[0];
}

/**
 * The next lesson along the routes: the rest of the first authored route that contains the
 * node, then the following routes in their order (missions skipped).
 */
export function nextLessonOnRoute(
  nodeId: string,
  routes: RouteDefinition[],
  nodeById: (id: string) => CompiledNode | undefined
): CompiledNode | null {
  const at = routes.findIndex((r) => r.nodes.includes(nodeId));
  if (at < 0) return null;
  const candidates = [
    ...routes[at].nodes.slice(routes[at].nodes.indexOf(nodeId) + 1),
    ...routes.slice(at + 1).flatMap((r) => r.nodes),
  ];
  for (const id of candidates) {
    const node = nodeById(id);
    if (node && node.type !== 'mission' && node.id !== nodeId) return node;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tool state: parameters, shown and hidden items, plus the plotter drawing, after the actions
// of the slides up to a point of the text
// ---------------------------------------------------------------------------

export interface PlotterPoint {
  id: string;
  on: string;
  x: number | string;
  label?: LocalisedText;
  guides: boolean;
}
export interface PlotterSegment {
  id: string;
  on: string;
  from: number | string;
  to: number | string;
  label?: LocalisedText;
}
export interface PlotterTangent {
  id: string;
  on: string;
  x: number | string;
  label?: LocalisedText;
}
export interface PlotterView {
  x: [number, number];
  y: [number, number];
  labels: { x: string; y: string };
}
export interface PlotterState {
  view: PlotterView;
  params: Record<string, number>;
  curves: PlotterCurve[];
  points: PlotterPoint[];
  secants: PlotterSegment[];
  tangents: PlotterTangent[];
  intervals: PlotterSegment[];
  /** Ids in the order they appeared, so that the newest item can be animated. */
  order: string[];
}

/** What every tool keeps between slides; the plotter also keeps its drawing. */
export interface ToolState {
  params: Record<string, number>;
  /** Items declared hidden that a slide has shown. */
  shown: Set<string>;
  /** Items a slide has hidden. */
  hidden: Set<string>;
  view: PlotterView;
  plotter: PlotterState | null;
}

type PlotterTool = Extract<LessonTool, { kind: 'plotter' }>;

function viewOf(tool: LessonTool): PlotterView {
  const labels =
    tool.kind === 'plotter'
      ? { x: tool.variable, y: 'y' }
      : tool.kind === 'slope_field' || tool.kind === 'fit'
        ? { x: tool.labels.x, y: tool.labels.y }
        : { x: 'x', y: 'y' };
  if ('view' in tool) return { x: [...tool.view.x], y: [...tool.view.y], labels };
  return { x: [0, 1], y: [0, 1], labels };
}

export function parameterDefaults(parameters: PlotterParameter[]): Record<string, number> {
  return Object.fromEntries(parameters.map((p) => [p.id, p.value]));
}

export function initialPlotterState(tool: PlotterTool): PlotterState {
  const state: PlotterState = {
    view: viewOf(tool),
    params: parameterDefaults(tool.parameters),
    curves: [],
    points: [],
    secants: [],
    tangents: [],
    intervals: [],
    order: [],
  };
  return tool.initial.reduce(applyPlotterAction, state);
}

export function initialToolState(tool: LessonTool): ToolState {
  const parameters = 'parameters' in tool ? tool.parameters : [];
  const plotter = tool.kind === 'plotter' ? initialPlotterState(tool) : null;
  return {
    params: plotter?.params ?? parameterDefaults(parameters),
    shown: new Set(),
    hidden: new Set(),
    view: plotter?.view ?? viewOf(tool),
    plotter,
  };
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return [...list.filter((x) => x.id !== item.id), item];
}

function applyView(view: PlotterView, action: PlotterAction): PlotterView {
  if (!action.view) return view;
  return {
    x: action.view.x ? [...action.view.x] : view.x,
    y: action.view.y ? [...action.view.y] : view.y,
    labels: {
      x: action.view.labels?.x ?? view.labels.x,
      y: action.view.labels?.y ?? view.labels.y,
    },
  };
}

export function applyPlotterAction(state: PlotterState, action: PlotterAction): PlotterState {
  let next: PlotterState = { ...state, order: [...state.order] };
  if (action.clear)
    next = { ...next, curves: [], points: [], secants: [], tangents: [], intervals: [], order: [] };
  if (action.hide.length) {
    const hidden = new Set(action.hide);
    const keep = <T extends { id: string; on?: string }>(list: T[]) =>
      list.filter((x) => !hidden.has(x.id) && !(x.on && hidden.has(x.on)));
    next = {
      ...next,
      curves: next.curves.filter((c) => !hidden.has(c.id)),
      points: keep(next.points),
      secants: keep(next.secants),
      tangents: keep(next.tangents),
      intervals: keep(next.intervals),
      order: next.order.filter((id) => !hidden.has(id)),
    };
  }
  next.view = applyView(next.view, action);
  if (action.set) next.params = { ...next.params, ...action.set };
  const touch = (id: string) => {
    next.order = [...next.order.filter((x) => x !== id), id];
  };
  if (action.plot) {
    next.curves = upsert(next.curves, action.plot);
    touch(action.plot.id);
  }
  if (action.point) {
    next.points = upsert(next.points, action.point);
    touch(action.point.id);
  }
  if (action.secant) {
    next.secants = upsert(next.secants, action.secant);
    touch(action.secant.id);
  }
  if (action.tangent) {
    next.tangents = upsert(next.tangents, action.tangent);
    touch(action.tangent.id);
  }
  if (action.interval) {
    next.intervals = upsert(next.intervals, action.interval);
    touch(action.interval.id);
  }
  return next;
}

export function applyToolAction(state: ToolState, action: PlotterAction): ToolState {
  const shown = new Set(state.shown);
  const hidden = new Set(state.hidden);
  if (action.clear) {
    shown.clear();
    hidden.clear();
  }
  for (const id of action.show) {
    shown.add(id);
    hidden.delete(id);
  }
  for (const id of action.hide) {
    hidden.add(id);
    shown.delete(id);
  }
  const plotter = state.plotter ? applyPlotterAction(state.plotter, action) : null;
  return {
    params: plotter?.params ?? (action.set ? { ...state.params, ...action.set } : state.params),
    shown,
    hidden,
    view: plotter?.view ?? applyView(state.view, action),
    plotter,
  };
}

/**
 * The state of a tool after every action of the steps before `stepIndex` that show it, plus the
 * actions of that step fired up to the given sentence (`null`: all of them).
 */
export function toolStateAt(
  plan: LessonPlan,
  toolId: string,
  stepIndex: number,
  sentence: number | null
): ToolState | null {
  const tool = plan.tools.find((t) => t.id === toolId);
  if (!tool) return null;
  let state = initialToolState(tool);
  plan.steps.slice(0, stepIndex).forEach((step) => {
    if (toolOfStep(plan, step)?.id !== toolId) return;
    state = step.actions.reduce(applyToolAction, state);
  });
  const current = plan.steps[stepIndex];
  if (current && toolOfStep(plan, current)?.id === toolId)
    state = current.actions
      .filter((a) => sentence === null || a.at <= sentence)
      .reduce(applyToolAction, state);
  return state;
}

/** Whether an item declared in a tool is visible in a state. */
export function itemVisible(item: { id: string; hidden?: boolean }, state: ToolState): boolean {
  if (state.hidden.has(item.id)) return false;
  return !item.hidden || state.shown.has(item.id);
}

/** Backwards-compatible replay of a plotter alone (unit tests, previews). */
export function plotterStateAt(
  tool: PlotterTool,
  steps: LessonStep[],
  stepIndex: number,
  sentence: number | null
): PlotterState {
  const plan: LessonPlan = {
    id: 'preview',
    node: {} as CompiledNode,
    depth: 1,
    tools: [tool],
    steps,
    authored: true,
  };
  return toolStateAt(plan, tool.id, stepIndex, sentence)?.plotter ?? initialPlotterState(tool);
}

// ---------------------------------------------------------------------------
// Numerics shared by the tools
// ---------------------------------------------------------------------------

/** A number, or an expression of the parameters (`a + h`). */
export function evaluateScalar(value: number | string, params: Record<string, number>): number {
  if (typeof value === 'number') return value;
  try {
    return compileExpression(value, Object.keys(params))(params);
  } catch {
    return NaN;
  }
}

/** The function of the variable behind a curve, with the current parameter values. */
export function curveFunction(
  expr: string,
  variable: string,
  params: Record<string, number>
): ((x: number) => number) | null {
  try {
    const fn = compileExpression(expr, [variable, ...Object.keys(params)]);
    return (x: number) => fn({ ...params, [variable]: x });
  } catch {
    return null;
  }
}

/** A function of two variables (a slope field's right-hand side, a scalar field). */
export function fieldFunction(
  expr: string,
  params: Record<string, number>,
  variables: [string, string] = ['x', 'y']
): ((x: number, y: number) => number) | null {
  try {
    const fn = compileExpression(expr, [...variables, ...Object.keys(params)]);
    return (x: number, y: number) => fn({ ...params, [variables[0]]: x, [variables[1]]: y });
  } catch {
    return null;
  }
}

/** Slope of a curve at x, by a centred difference. */
export function slopeAt(fn: (x: number) => number, x: number, h = 1e-4): number {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

/** Gradient of a scalar field at a point, by centred differences. */
export function gradientAt(
  f: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 1e-4
): [number, number] {
  return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
}

/**
 * Integrates y' = f(x, y) from (x0, y0) in both directions inside the view with a fixed-step
 * Runge–Kutta scheme; stops where the solution leaves the view or blows up.
 */
export function integrateSolution(
  f: (x: number, y: number) => number,
  x0: number,
  y0: number,
  view: { x: [number, number]; y: [number, number] },
  steps = 240
): Array<[number, number]> {
  const [xMin, xMax] = view.x;
  const [yMin, yMax] = view.y;
  const margin = (yMax - yMin) * 2;
  const h = (xMax - xMin) / steps;
  const march = (direction: 1 | -1): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    let x = x0;
    let y = y0;
    for (let i = 0; i < steps; i++) {
      const dx = direction * h;
      const k1 = f(x, y);
      const k2 = f(x + dx / 2, y + (dx / 2) * k1);
      const k3 = f(x + dx / 2, y + (dx / 2) * k2);
      const k4 = f(x + dx, y + dx * k3);
      const dy = (dx / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      if (!Number.isFinite(dy)) break;
      x += dx;
      y += dy;
      if (x < xMin - 1e-9 || x > xMax + 1e-9 || y < yMin - margin || y > yMax + margin) break;
      out.push([x, y]);
    }
    return out;
  };
  return [...march(-1).reverse(), [x0, y0], ...march(1)];
}

/** Sum of the dimension exponents of a product of quantities raised to integer powers. */
export function combineDimensions(
  quantities: Array<{ id: string; dims: Record<string, number> }>,
  exponents: Record<string, number>
): Record<string, number> {
  const out: Record<string, number> = { L: 0, M: 0, T: 0, I: 0, Th: 0 };
  for (const q of quantities) {
    const e = exponents[q.id] ?? 0;
    if (!e) continue;
    for (const [dim, power] of Object.entries(q.dims)) out[dim] = (out[dim] ?? 0) + e * power;
  }
  return out;
}

export function sameDimensions(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
}

/** `L T⁻²` style text for a dimension vector. */
export function dimensionText(dims: Record<string, number>): string {
  const sup = (n: number) =>
    String(n)
      .replace(/-/g, '⁻')
      .replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  const names: Record<string, string> = { L: 'L', M: 'M', T: 'T', I: 'I', Th: 'Θ' };
  const parts = Object.entries(dims)
    .filter(([, e]) => e !== 0)
    .map(([d, e]) => (e === 1 ? names[d] : `${names[d]}${sup(e)}`));
  return parts.length ? parts.join(' ') : '1';
}
