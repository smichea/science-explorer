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
  tool?: LessonTool;
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
  tool: LessonTool | undefined,
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
  if (tool)
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
 * from the description, followed by the exercises of the node.
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
  return {
    id: authored?.id ?? `lesson.auto.${node.id}`,
    node,
    depth: effectiveDepth,
    tool: authored?.tool,
    steps: authored?.steps ?? autoSteps(node, effectiveDepth, authored?.tool, exercises),
    authored: !!authored?.steps,
  };
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
// Plotter state: the items drawn after the actions of the slides up to a point of the text
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

export function initialPlotterState(tool: Extract<LessonTool, { kind: 'plotter' }>): PlotterState {
  const params: Record<string, number> = {};
  for (const p of tool.parameters) params[p.id] = p.value;
  const state: PlotterState = {
    view: { x: [...tool.view.x], y: [...tool.view.y], labels: { x: tool.variable, y: 'y' } },
    params,
    curves: [],
    points: [],
    secants: [],
    tangents: [],
    intervals: [],
    order: [],
  };
  return tool.initial.reduce(applyPlotterAction, state);
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return [...list.filter((x) => x.id !== item.id), item];
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
  if (action.view) {
    next.view = {
      x: action.view.x ? [...action.view.x] : next.view.x,
      y: action.view.y ? [...action.view.y] : next.view.y,
      labels: {
        x: action.view.labels?.x ?? next.view.labels.x,
        y: action.view.labels?.y ?? next.view.labels.y,
      },
    };
  }
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

/**
 * The plotter after every action of the steps before `stepIndex`, plus the actions of that step
 * fired up to the given sentence (`null`: all of them).
 */
export function plotterStateAt(
  tool: Extract<LessonTool, { kind: 'plotter' }>,
  steps: LessonStep[],
  stepIndex: number,
  sentence: number | null
): PlotterState {
  let state = initialPlotterState(tool);
  steps.slice(0, stepIndex).forEach((step) => {
    state = step.actions.reduce(applyPlotterAction, state);
  });
  const current = steps[stepIndex];
  if (current)
    state = current.actions
      .filter((a) => sentence === null || a.at <= sentence)
      .reduce(applyPlotterAction, state);
  return state;
}

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

/** Slope of a curve at x, by a centred difference. */
export function slopeAt(fn: (x: number) => number, x: number, h = 1e-4): number {
  return (fn(x + h) - fn(x - h)) / (2 * h);
}

/** Default value of a slider parameter. */
export function parameterDefaults(parameters: PlotterParameter[]): Record<string, number> {
  return Object.fromEntries(parameters.map((p) => [p.id, p.value]));
}
