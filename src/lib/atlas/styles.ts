import type { CompiledNode, CompiledRegion, Locale } from '$lib/content-schema';
import type { GraphIndex } from '$lib/domain/graph';
import { emphasisFor, nodeStage, type MapFilter, type MapLayer } from '$lib/domain/horizon';
import type { ProgressionSnapshot } from '$lib/domain/progression';
import {
  destinationState,
  type DestinationContext,
  type DestinationStateKind,
} from '$lib/domain/progression/destination';

export const WORLD_COLORS: Record<string, string> = {
  'world.mathematics': '#7f9cff',
  'world.physics': '#ffb347',
  'world.chemistry': '#5ee6a8',
};
export const BRIDGE_COLOR = '#f7f1e3';
export const HISTORY_COLOR = '#ffd166';
export const MISSION_COLOR = '#ff8fab';

/** Text glyphs that encode the destination state without relying on colour alone. */
export const STATE_GLYPH: Record<DestinationStateKind | 'silhouette', string> = {
  unknown: '',
  in_horizon: '·',
  ready: '○',
  missing_recommended: '◌',
  missing_essential: '⊘',
  discovered: '◔',
  practised: '◑',
  mastered: '★',
  due_for_review: '⟳',
  saved: '⚑',
  in_progress: '▶',
  silhouette: '◇',
};

export interface NodeStyle {
  id: string;
  color: string;
  emphasis: number;
  size: number;
  kind: DestinationStateKind;
  glyph: string;
  labelPriority: number;
  selected: boolean;
  highlighted: boolean;
  /** Outside the current filter or layer: drawn as an outline, named only when hovered. */
  muted: boolean;
  stage: string | null;
  band: string;
}

/** Below this emphasis a destination is outside the selection of the filter or the layer. */
export const MUTED_EMPHASIS = 0.5;

export interface StyleContext extends DestinationContext {
  filter: MapFilter;
  layer: MapLayer;
  selectedId: string | null;
  toolId: string | null;
  locale: Locale;
  /** Extra nodes to highlight (the leg of a guided flight). */
  highlightIds?: Set<string>;
  /** Ordered node ids drawn as a flight path. */
  tourPath?: string[];
}

export function colorOfNode(node: CompiledNode, graph: GraphIndex): string {
  if (node.type === 'mission') return MISSION_COLOR;
  if (node.type === 'person' || node.type === 'place' || node.type === 'period')
    return HISTORY_COLOR;
  const world = graph.worldOf(node);
  if (world) return world.color ?? WORLD_COLORS[world.id] ?? BRIDGE_COLOR;
  return BRIDGE_COLOR;
}

export function colorOfRegion(region: CompiledRegion, graph: GraphIndex): string {
  if (region.isBridge || !region.worldId) return BRIDGE_COLOR;
  return graph.getWorld(region.worldId)?.color ?? BRIDGE_COLOR;
}

/** Node styles shared by the 3D atlas, the 2D map and the destination list. */
export function computeNodeStyles(ctx: StyleContext): Map<string, NodeStyle> {
  const styles = new Map<string, NodeStyle>();
  const { graph, config, horizon, selectedId, toolId, layer, filter } = ctx;
  const neighbourIds = new Set<string>();
  if (selectedId) {
    for (const n of graph.getNeighbours(selectedId)) neighbourIds.add(n.node.id);
    for (const s of graph.satellitesOf(selectedId)) neighbourIds.add(s.id);
    const selectedNode = graph.getNode(selectedId);
    if (selectedNode?.anchorNode) neighbourIds.add(selectedNode.anchorNode);
  }
  const applicationIds = new Set<string>();
  const tool =
    toolId ??
    (selectedId && graph.getNode(selectedId)?.type === 'mathematical_tool' ? selectedId : null);
  if (layer === 'applications' && tool)
    for (const a of graph.getApplications(tool)) applicationIds.add(a.phenomenon.id);

  for (const node of graph.graph.nodes) {
    const state = destinationState(node, ctx);
    const stage = nodeStage(node, config);
    const ready = state.kind !== 'missing_essential' && state.kind !== 'missing_recommended';
    let emphasis = emphasisFor(stage, horizon, filter, config, ready);
    if (layer === 'history')
      emphasis *=
        node.type === 'mission' ||
        node.type === 'person' ||
        node.type === 'place' ||
        node.type === 'period'
          ? 1
          : 0.45;
    if (layer === 'applications' && tool)
      emphasis *= node.id === tool || applicationIds.has(node.id) ? 1 : 0.35;
    if (layer === 'progress')
      emphasis *= state.kind === 'unknown' || state.kind === 'in_horizon' ? 0.55 : 1;
    if (layer === 'prerequisites' && selectedId) {
      const closure = new Set(graph.prerequisiteClosure(selectedId).map((n) => n.id));
      emphasis *= node.id === selectedId || closure.has(node.id) ? 1 : 0.3;
    }
    const selected = node.id === selectedId;
    const highlighted =
      neighbourIds.has(node.id) ||
      (layer === 'applications' && applicationIds.has(node.id)) ||
      !!ctx.highlightIds?.has(node.id);
    if (selected) emphasis = 1;
    else if (highlighted) emphasis = Math.max(emphasis, 0.85);
    const muted = !selected && !highlighted && emphasis < MUTED_EMPHASIS;
    const size =
      0.55 +
      node.importance * 0.28 +
      (node.type === 'mission' ? 0.5 : 0) +
      (state.kind === 'mastered' ? 0.2 : 0);
    const stateWeight = selected
      ? 10
      : state.kind === 'in_progress'
        ? 2
        : state.kind === 'mastered' || state.kind === 'practised'
          ? 1.3
          : 1;
    styles.set(node.id, {
      id: node.id,
      color: colorOfNode(node, graph),
      emphasis,
      size,
      kind: state.kind,
      glyph: STATE_GLYPH[state.kind],
      labelPriority: node.importance * emphasis * stateWeight + (highlighted ? 2 : 0),
      selected,
      highlighted,
      muted,
      stage,
      band: state.band,
    });
  }
  return styles;
}

export type RouteKind =
  | 'prerequisite_essential'
  | 'prerequisite_recommended'
  | 'application_explored'
  | 'application_eligible'
  | 'transfer'
  | 'analogy'
  | 'models'
  | 'history'
  | 'route';

export interface RouteStyle {
  id: string;
  from: string;
  to: string;
  kind: RouteKind;
  emphasis: number;
}

/** Route styles per layer (PRODUCT_SPECIFICATION §9.4 / §13.3), shared by the 3D atlas and the 2D map. */
export function computeRoutes(
  ctx: StyleContext,
  snapshot: ProgressionSnapshot | null
): RouteStyle[] {
  const { graph, layer, selectedId, toolId } = ctx;
  const out: RouteStyle[] = [];
  const push = (id: string, from: string, to: string, kind: RouteKind, emphasis: number) =>
    out.push({ id, from, to, kind, emphasis });
  // The leg of a guided flight is drawn on top of whatever layer is active.
  const path = ctx.tourPath ?? [];
  for (let i = 1; i < path.length; i++) push(`tour:${i}`, path[i - 1], path[i], 'route', 0.9);
  const tool =
    toolId ??
    (selectedId && graph.getNode(selectedId)?.type === 'mathematical_tool' ? selectedId : null);

  if (layer === 'applications' && tool) {
    const coverage = snapshot?.coverage.get(tool);
    for (const { phenomenon, edge } of graph.getApplications(tool)) {
      const value =
        coverage?.applications.find((a) => a.phenomenonId === phenomenon.id)?.value ?? 0;
      push(
        edge.id,
        tool,
        phenomenon.id,
        value >= 0.4 ? 'application_explored' : 'application_eligible',
        1
      );
    }
    for (const e of graph.graph.edges)
      if (e.type === 'transfers_to') push(e.id, e.from, e.to, 'transfer', 0.6);
    return out;
  }

  if (layer === 'history') {
    for (const e of graph.graph.edges) {
      if (
        e.type === 'historically_developed_by' ||
        e.type === 'historically_occurred_at' ||
        e.type === 'historically_precedes'
      )
        push(e.id, e.from, e.to, 'history', 0.9);
      if (e.type === 'appears_in_mission') push(e.id, e.from, e.to, 'history', 0.5);
    }
    for (const node of graph.graph.nodes)
      if (
        node.anchorNode &&
        (node.type === 'person' || node.type === 'place' || node.type === 'period')
      )
        push(`anchor:${node.id}`, node.id, node.anchorNode, 'history', 0.6);
    return out;
  }

  if (layer === 'prerequisites' && selectedId) {
    const closure = new Set([
      selectedId,
      ...graph.prerequisiteClosure(selectedId).map((n) => n.id),
    ]);
    for (const e of graph.graph.edges) {
      if (
        (e.type === 'requires_essentially' || e.type === 'requires_recommended') &&
        closure.has(e.from) &&
        closure.has(e.to)
      ) {
        push(
          e.id,
          e.from,
          e.to,
          e.type === 'requires_essentially' ? 'prerequisite_essential' : 'prerequisite_recommended',
          1
        );
      }
    }
    return out;
  }

  // concepts / progress / curriculum: structural prerequisites faintly, the selection's edges strongly.
  for (const e of graph.graph.edges) {
    const touchesSelection = selectedId !== null && (e.from === selectedId || e.to === selectedId);
    if (e.type === 'requires_essentially')
      push(e.id, e.from, e.to, 'prerequisite_essential', touchesSelection ? 1 : 0.35);
    else if (e.type === 'requires_recommended')
      push(e.id, e.from, e.to, 'prerequisite_recommended', touchesSelection ? 0.9 : 0.25);
    else if (touchesSelection && (e.type === 'models' || e.type === 'explains'))
      push(e.id, e.from, e.to, 'models', 0.8);
    else if (touchesSelection && e.type === 'applies_to')
      push(e.id, e.from, e.to, 'application_eligible', 0.8);
    else if (touchesSelection && (e.type === 'analogous_to' || e.type === 'transfers_to'))
      push(e.id, e.from, e.to, 'analogy', 0.8);
    else if (
      touchesSelection &&
      (e.type === 'appears_in_mission' ||
        e.type === 'historically_developed_by' ||
        e.type === 'historically_occurred_at')
    )
      push(e.id, e.from, e.to, 'history', 0.8);
  }
  if (selectedId) {
    for (const s of graph.satellitesOf(selectedId))
      push(`anchor:${s.id}`, s.id, selectedId, 'history', 0.6);
    const node = graph.getNode(selectedId);
    if (node?.anchorNode) push(`anchor:${node.id}`, node.id, node.anchorNode, 'history', 0.6);
  }
  return out;
}

export const ROUTE_COLORS: Record<RouteKind, string> = {
  prerequisite_essential: '#c7d2ff',
  prerequisite_recommended: '#8fa0d8',
  application_explored: '#5ee6a8',
  application_eligible: '#5ee6a8',
  transfer: '#ffb347',
  analogy: '#b39dff',
  models: '#ffb347',
  history: '#ffd166',
  route: '#ffffff',
};

export const ROUTE_DASHED: Record<RouteKind, boolean> = {
  prerequisite_essential: false,
  prerequisite_recommended: true,
  application_explored: false,
  application_eligible: true,
  transfer: true,
  analogy: true,
  models: false,
  history: true,
  route: false,
};
