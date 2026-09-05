import type { CompiledNode, RouteDefinition } from '../../content-schema';
import type { GraphIndex } from '../graph';
import type { ProgressionSnapshot } from './index';

export type RecommendationKind =
  | 'startFirstMission'
  | 'continue_route'
  | 'revisit_foundation'
  | 'apply_tool'
  | 'deepen'
  | 'history'
  | 'review'
  | 'challenge';

export interface Recommendation {
  kind: RecommendationKind;
  node: CompiledNode;
  /** Extra node the recommendation refers to (the tool for apply_tool, the route for continue_route). */
  via?: CompiledNode;
  routeId?: string;
}

/** Recommendation categories of PRODUCT_SPECIFICATION §14.2. Suggestions only: the learner keeps the map. */
export function recommend(graph: GraphIndex, snapshot: ProgressionSnapshot | null, routes: RouteDefinition[], limit = 5): Recommendation[] {
  const out: Recommendation[] = [];
  const status = (id: string) => snapshot?.nodeStates.get(id)?.status ?? 'unknown';
  const done = (id: string) => status(id) === 'practised' || status(id) === 'mastered' || snapshot?.completedMissions.has(id);

  const firstMission = graph.graph.nodes.find((n) => n.type === 'mission');
  if (firstMission && !snapshot?.completedMissions.has(firstMission.id)) {
    out.push({ kind: 'startFirstMission', node: firstMission });
  }

  for (const route of routes.filter((r) => r.kind === 'recommended')) {
    const next = route.nodes.map((id) => graph.getNode(id)).find((n) => n && !done(n.id) && n.type !== 'mission');
    if (next && !out.some((r) => r.node.id === next.id)) out.push({ kind: 'continue_route', node: next, routeId: route.id });
  }

  for (const [toolId, cov] of snapshot?.coverage ?? []) {
    if (status(toolId) === 'unknown') continue;
    const unexplored = cov.applications.find((a) => a.value < 0.4);
    if (!unexplored) continue;
    const phenomenon = graph.getNode(unexplored.phenomenonId);
    const tool = graph.getNode(toolId);
    if (phenomenon && tool && !out.some((r) => r.node.id === phenomenon.id)) out.push({ kind: 'apply_tool', node: phenomenon, via: tool });
  }

  for (const [id, state] of snapshot?.nodeStates ?? []) {
    if (!state.reviewRecommended) continue;
    const node = graph.getNode(id);
    if (node) out.push({ kind: 'review', node });
  }

  for (const [id, state] of snapshot?.nodeStates ?? []) {
    const node = graph.getNode(id);
    if (!node || state.status !== 'practised' && state.status !== 'mastered') continue;
    const next = node.depths.find((d) => d.depth === state.highestDepthVisited + 1);
    if (next && !out.some((r) => r.node.id === id)) out.push({ kind: 'deepen', node });
  }

  for (const route of routes.filter((r) => r.kind === 'historical')) {
    const next = route.nodes.map((id) => graph.getNode(id)).find((n) => n && status(n.id) === 'unknown' && (n.type === 'person' || n.type === 'place' || n.type === 'period'));
    if (next && out.length < limit) out.push({ kind: 'history', node: next, routeId: route.id });
  }

  return out.slice(0, limit);
}
