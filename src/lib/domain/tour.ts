import type {
  CompiledNode,
  EdgeType,
  HorizonConfig,
  LocalisedText,
  RouteDefinition,
  TourDefinition,
  TourLeg,
} from '../content-schema';
import type { GraphIndex } from './graph';
import { nodeStage, stageIndex, type Horizon } from './horizon';
import { coverageScope, statusOf, type NodeStatus, type ProgressionSnapshot } from './progression';

/** Camera target of a step (structurally the atlas FocusTarget, kept out of the UI layer). */
export interface TourFocus {
  kind: 'universe' | 'world' | 'region' | 'node' | 'group';
  id?: string;
  /** The nodes framed together by a `group` target (the stops of a leg). */
  ids?: string[];
}

export interface TourContext {
  graph: GraphIndex;
  routes: RouteDefinition[];
  /** The learner's horizon; null flies over the whole universe (content checks). */
  horizon: Horizon | null;
  config: HorizonConfig;
  snapshot: ProgressionSnapshot | null;
}

export interface TourOptions {
  /** Also fly over destinations already practised or mastered (default: only what remains). */
  includeDone?: boolean;
  /** Ignore the horizon and the statuses: every lesson of the universe (content checks). */
  everything?: boolean;
}

export interface TourIntroStep {
  kind: 'intro' | 'outro';
  title: LocalisedText;
  text: LocalisedText;
  focus: TourFocus;
}

export interface TourLegStop {
  id: string;
  title: LocalisedText;
}

export interface TourLegStep {
  kind: 'leg';
  legIndex: number;
  title: LocalisedText;
  /** The authored transition from the previous leg, or the route summary for the first leg. */
  text: LocalisedText;
  focus: TourFocus;
  nodeIds: string[];
  /** The stops of the leg, in the order they are flown (prerequisites first). */
  stops: TourLegStop[];
}

export interface TourStopStep {
  kind: 'stop';
  legIndex: number;
  legTitle: LocalisedText;
  node: CompiledNode;
  status: NodeStatus;
  /** The spoken presentation excerpt (node overview, or its short purpose). */
  text: LocalisedText;
  focus: TourFocus;
  indexInLeg: number;
  legCount: number;
}

export type TourStep = TourIntroStep | TourLegStep | TourStopStep;

/** A prerequisite flown after the destination that needs it. */
export interface PrerequisiteInversion {
  /** The prerequisite (flown too late). */
  from: string;
  /** The destination that needs it (flown too early). */
  to: string;
  type: 'requires_essentially' | 'requires_recommended';
  fromLeg: number;
  toLeg: number;
}

const PREREQUISITE_TYPES: EdgeType[] = ['requires_essentially', 'requires_recommended'];
const HISTORY_TYPES = new Set(['person', 'place', 'period']);
const HISTORY_ORDER: Record<string, number> = { period: 0, place: 1, person: 2 };

/**
 * Builds the ordered steps of a guided flight: every lesson in the learner's horizon that is not
 * yet practised, first along the authored routes, then in the automatic legs (worlds, history,
 * bridges), each destination exactly once. Missions are never flown over (they are practised, not
 * presented). Inside a leg the stops follow the prerequisites: a destination always comes after
 * the prerequisites flown in the same leg. Legs left empty are skipped with their transition.
 */
export function buildTour(
  tour: TourDefinition,
  ctx: TourContext,
  options: TourOptions = {}
): TourStep[] {
  const { graph, routes, horizon, config, snapshot } = ctx;
  const scope = horizon && !options.everything ? new Set(coverageScope(horizon, config)) : null;
  const inScope = (node: CompiledNode) => {
    if (!scope) return true;
    const stage = nodeStage(node, config);
    return stage === null || scope.has(stage);
  };
  const isDone = (node: CompiledNode) => {
    if (options.everything || options.includeDone) return false;
    const status = statusOf(snapshot, node.id);
    return status === 'practised' || status === 'mastered';
  };
  const candidates = new Map(
    graph.graph.nodes
      .filter((n) => n.type !== 'mission' && inScope(n) && !isDone(n))
      .map((n) => [n.id, n])
  );
  const visited = new Set<string>();
  const steps: TourStep[] = [
    { kind: 'intro', title: tour.title, text: tour.intro, focus: { kind: 'universe' } },
  ];

  tour.legs.forEach((leg, legIndex) => {
    const route = leg.route ? routes.find((r) => r.id === leg.route) : undefined;
    const nodes = orderByPrerequisites(
      legNodes(leg, route, candidates, visited, graph, config),
      graph
    );
    if (nodes.length === 0) return;
    const title = route?.title ?? leg.title ?? tour.title;
    const text = leg.transition ?? route?.summary ?? title;
    steps.push({
      kind: 'leg',
      legIndex,
      title,
      text,
      focus: legFocus(leg, nodes),
      nodeIds: nodes.map((n) => n.id),
      stops: nodes.map((n) => ({ id: n.id, title: n.title })),
    });
    nodes.forEach((node, indexInLeg) => {
      visited.add(node.id);
      steps.push({
        kind: 'stop',
        legIndex,
        legTitle: title,
        node,
        status: statusOf(snapshot, node.id),
        text: node.overview ?? node.shortPurpose,
        focus: { kind: 'node', id: node.id },
        indexInLeg,
        legCount: nodes.length,
      });
    });
  });

  steps.push({ kind: 'outro', title: tour.title, text: tour.outro, focus: { kind: 'universe' } });
  return steps;
}

function legNodes(
  leg: TourLeg,
  route: RouteDefinition | undefined,
  candidates: Map<string, CompiledNode>,
  visited: Set<string>,
  graph: GraphIndex,
  config: HorizonConfig
): CompiledNode[] {
  const fresh = (n: CompiledNode | undefined): n is CompiledNode =>
    !!n && candidates.has(n.id) && !visited.has(n.id);
  if (leg.route) return (route?.nodes ?? []).map((id) => candidates.get(id)).filter(fresh);
  const remaining = [...candidates.values()].filter(fresh);
  if (leg.world) {
    const world = graph.getWorld(leg.world);
    const regionOrder = (n: CompiledNode) =>
      n.region && world ? Math.max(0, world.regionIds.indexOf(n.region)) : 99;
    return remaining
      .filter((n) => n.world === leg.world)
      .sort(
        (a, b) =>
          stageOrder(a, config) - stageOrder(b, config) ||
          regionOrder(a) - regionOrder(b) ||
          b.importance - a.importance ||
          a.id.localeCompare(b.id)
      );
  }
  if (leg.history)
    return remaining
      .filter((n) => HISTORY_TYPES.has(n.type))
      .sort(
        (a, b) =>
          (HISTORY_ORDER[a.type] ?? 9) - (HISTORY_ORDER[b.type] ?? 9) || a.id.localeCompare(b.id)
      );
  // bridges: everything without a world that is not a history node (methods, shared concepts, questions)
  return remaining
    .filter((n) => !n.world && !HISTORY_TYPES.has(n.type))
    .sort(
      (a, b) =>
        stageOrder(a, config) - stageOrder(b, config) ||
        b.importance - a.importance ||
        a.id.localeCompare(b.id)
    );
}

function stageOrder(node: CompiledNode, config: HorizonConfig): number {
  const stage = nodeStage(node, config);
  return stage === null ? -1 : stageIndex(stage, config);
}

/**
 * Reorders the nodes so that every prerequisite present in the list comes before the nodes that
 * need it (essential and recommended alike). The given order is kept wherever it already respects
 * the prerequisites: a prerequisite written after a node that needs it is pulled forward, just
 * before that node, together with its own prerequisites. Prerequisites outside the list are
 * ignored (they belong to another leg; the content compiler checks the whole flight).
 */
export function orderByPrerequisites(nodes: CompiledNode[], graph: GraphIndex): CompiledNode[] {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const out: CompiledNode[] = [];
  const place = (node: CompiledNode) => {
    if (placed.has(node.id) || visiting.has(node.id)) return;
    visiting.add(node.id);
    const prerequisites = graph
      .getNeighbours(node.id, PREREQUISITE_TYPES, 'in')
      .map((n) => n.node)
      .filter((n) => index.has(n.id))
      .sort((a, b) => index.get(a.id)! - index.get(b.id)!);
    for (const prerequisite of prerequisites) place(prerequisite);
    visiting.delete(node.id);
    placed.add(node.id);
    out.push(node);
  };
  for (const node of nodes) place(node);
  return out;
}

/**
 * The prerequisites flown after a destination that needs them, across the whole flight. Empty
 * for a well-authored flight: the compiler refuses an essential inversion and warns about a
 * recommended one.
 */
export function prerequisiteInversions(
  steps: TourStep[],
  graph: GraphIndex
): PrerequisiteInversion[] {
  const position = new Map<string, { order: number; leg: number }>();
  steps.forEach((step, order) => {
    if (step.kind === 'stop') position.set(step.node.id, { order, leg: step.legIndex });
  });
  const out: PrerequisiteInversion[] = [];
  for (const [id, at] of position) {
    for (const { node, edge } of graph.getNeighbours(id, PREREQUISITE_TYPES, 'in')) {
      const before = position.get(node.id);
      if (!before || before.order < at.order) continue;
      out.push({
        from: node.id,
        to: id,
        type: edge.type as PrerequisiteInversion['type'],
        fromLeg: before.leg,
        toLeg: at.leg,
      });
    }
  }
  return out.sort((a, b) => a.toLeg - b.toLeg || a.to.localeCompare(b.to));
}

function legFocus(leg: TourLeg, nodes: CompiledNode[]): TourFocus {
  if (leg.world) return { kind: 'world', id: leg.world };
  // Frame the whole leg rather than the centre of a region (where the most important node
  // sits, whatever the order of the stops).
  return { kind: 'group', ids: nodes.map((n) => n.id) };
}

/** Number of destinations a flight would visit, for the start button. */
export function countTourStops(steps: TourStep[]): number {
  return steps.filter((s) => s.kind === 'stop').length;
}
