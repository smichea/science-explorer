import type {
  CompiledNode,
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
  kind: 'universe' | 'world' | 'region' | 'node';
  id?: string;
}

export interface TourContext {
  graph: GraphIndex;
  routes: RouteDefinition[];
  horizon: Horizon;
  config: HorizonConfig;
  snapshot: ProgressionSnapshot | null;
}

export interface TourOptions {
  /** Also fly over destinations already practised or mastered (default: only what remains). */
  includeDone?: boolean;
}

export interface TourIntroStep {
  kind: 'intro' | 'outro';
  title: LocalisedText;
  text: LocalisedText;
  focus: TourFocus;
}

export interface TourLegStep {
  kind: 'leg';
  legIndex: number;
  title: LocalisedText;
  /** The authored transition from the previous leg, or the route summary for the first leg. */
  text: LocalisedText;
  focus: TourFocus;
  nodeIds: string[];
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

const HISTORY_TYPES = new Set(['person', 'place', 'period', 'mission']);
const HISTORY_ORDER: Record<string, number> = { period: 0, place: 1, person: 2, mission: 3 };

/**
 * Builds the ordered steps of a guided flight: everything in the learner's horizon that is not
 * yet practised, first along the authored routes, then in the automatic legs (worlds, history,
 * bridges), each destination exactly once. Legs left empty are skipped together with their
 * transition sentence.
 */
export function buildTour(
  tour: TourDefinition,
  ctx: TourContext,
  options: TourOptions = {}
): TourStep[] {
  const { graph, routes, horizon, config, snapshot } = ctx;
  const scope = new Set(coverageScope(horizon, config));
  const inScope = (node: CompiledNode) => {
    const stage = nodeStage(node, config);
    return stage === null || scope.has(stage);
  };
  const isDone = (node: CompiledNode) => {
    const status = statusOf(snapshot, node.id);
    return status === 'practised' || status === 'mastered';
  };
  const candidates = new Map(
    graph.graph.nodes
      .filter((n) => inScope(n) && (options.includeDone || !isDone(n)))
      .map((n) => [n.id, n])
  );
  const visited = new Set<string>();
  const steps: TourStep[] = [
    { kind: 'intro', title: tour.title, text: tour.intro, focus: { kind: 'universe' } },
  ];

  tour.legs.forEach((leg, legIndex) => {
    const route = leg.route ? routes.find((r) => r.id === leg.route) : undefined;
    const nodes = legNodes(leg, route, candidates, visited, graph, config);
    if (nodes.length === 0) return;
    const title = route?.title ?? leg.title ?? tour.title;
    const text = leg.transition ?? route?.summary ?? title;
    steps.push({
      kind: 'leg',
      legIndex,
      title,
      text,
      focus: legFocus(leg, nodes, graph),
      nodeIds: nodes.map((n) => n.id),
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

function legFocus(leg: TourLeg, nodes: CompiledNode[], graph: GraphIndex): TourFocus {
  if (leg.world) return { kind: 'world', id: leg.world };
  const first = nodes[0];
  if (first?.region && graph.getRegion(first.region)) return { kind: 'region', id: first.region };
  if (first?.world) return { kind: 'world', id: first.world };
  return { kind: 'universe' };
}

/** Number of destinations a flight would visit, for the start button. */
export function countTourStops(steps: TourStep[]): number {
  return steps.filter((s) => s.kind === 'stop').length;
}
