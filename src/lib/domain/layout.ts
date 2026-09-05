import type {
  CompiledGraph,
  CompiledLayout,
  CompiledNode,
  LayoutAnchors,
  Stage,
  Vec3,
} from '../content-schema';
import { stableRandom } from './prng';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEG = Math.PI / 180;

const STAGE_INDEX: Record<Stage, number> = {
  seconde: 0,
  premiere: 0,
  terminale: 0,
  mpsi: 1,
  mp: 2,
  beyond: 3,
};

/** Lowest curriculum stage at which the node is taught (drives the small vertical offset). */
export function nodeStageIndex(node: CompiledNode): number {
  if (node.depths.length === 0) return 0;
  return Math.min(...node.depths.map((d) => STAGE_INDEX[d.stage] ?? 0));
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/**
 * Deterministic, authored hybrid layout (§5.4 architecture):
 *  - worlds sit on a ring, bridges near the centre, regions around their world (authored anchors);
 *  - nodes spread on a golden-angle spiral around their region, ordered by importance then id;
 *  - nodes anchored to another node (people, places, missions) orbit that node;
 *  - the stage adds a small vertical offset so "next year" is visibly a little further away;
 *  - jitter is derived from identifiers, so the geography is identical on every device.
 */
export function computeLayout(graph: CompiledGraph, anchors: LayoutAnchors): CompiledLayout {
  const p = anchors.parameters;
  const worlds: Record<string, Vec3> = {};
  const regions: Record<string, Vec3> = {};
  const positions: Record<string, Vec3> = {};

  for (const w of anchors.worlds) {
    const a = w.angle * DEG;
    worlds[w.id] = [p.worldRingRadius * Math.cos(a), w.y, p.worldRingRadius * Math.sin(a)];
  }
  for (const b of anchors.bridges) {
    regions[b.id] = [b.x, b.y, b.z];
  }
  for (const r of anchors.regions) {
    const region = graph.regions.find((g) => g.id === r.id);
    const worldCentre = region?.worldId ? worlds[region.worldId] : undefined;
    if (!worldCentre) continue;
    const a = r.angle * DEG;
    const radius = r.radius ?? p.regionRingRadius;
    regions[r.id] = add(worldCentre, [radius * Math.cos(a), r.y, radius * Math.sin(a)]);
  }
  // Regions without an authored anchor are distributed evenly around their world.
  for (const region of graph.regions) {
    if (regions[region.id]) continue;
    const world = region.worldId ? graph.worlds.find((w) => w.id === region.worldId) : undefined;
    const centre: Vec3 = world ? worlds[world.id] : [0, 0, 0];
    const siblings = world ? world.regionIds : graph.regions.filter((r) => r.isBridge).map((r) => r.id);
    const k = Math.max(0, siblings.indexOf(region.id));
    const a = (k / Math.max(1, siblings.length)) * Math.PI * 2;
    const radius = world ? p.regionRingRadius : 10;
    regions[region.id] = add(centre, [radius * Math.cos(a), 0, radius * Math.sin(a)]);
  }

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const sorted = [...graph.nodes].sort(
    (a, b) => b.importance - a.importance || a.id.localeCompare(b.id)
  );

  // Pass 1: nodes attached to a region or bridge.
  const perRegion = new Map<string, number>();
  for (const node of sorted) {
    if (!node.region || !regions[node.region]) continue;
    const k = perRegion.get(node.region) ?? 0;
    perRegion.set(node.region, k + 1);
    const centre = regions[node.region];
    const jitter = stableRandom(node.id, p.seed);
    const rho = k === 0 ? 0 : p.nodeSpread * Math.sqrt(k) * (0.85 + 0.3 * jitter);
    const phi = k * GOLDEN_ANGLE + jitter * 0.6;
    const y = nodeStageIndex(node) * p.stageOffsetY + (stableRandom(node.id, p.seed + 1) - 0.5) * 0.8;
    positions[node.id] = add(centre, [rho * Math.cos(phi), y, rho * Math.sin(phi)]);
  }

  // Pass 2: nodes anchored to another node (resolve chains, at most a few hops).
  const perAnchor = new Map<string, number>();
  let pending = sorted.filter((n) => !positions[n.id] && n.anchorNode);
  for (let hop = 0; hop < 4 && pending.length > 0; hop++) {
    const next: CompiledNode[] = [];
    for (const node of pending) {
      const anchor = node.anchorNode ? positions[node.anchorNode] : undefined;
      if (!anchor) {
        next.push(node);
        continue;
      }
      const k = perAnchor.get(node.anchorNode!) ?? 0;
      perAnchor.set(node.anchorNode!, k + 1);
      const jitter = stableRandom(node.id, p.seed + 2);
      const phi = k * GOLDEN_ANGLE * 1.7 + jitter * Math.PI * 2;
      const radius = 2.4 + 0.5 * k;
      positions[node.id] = add(anchor, [radius * Math.cos(phi), 1.2 + jitter * 0.6, radius * Math.sin(phi)]);
    }
    pending = next;
  }

  // Pass 3: fallback near the centre for anything still unplaced (the compiler warns about it).
  let orphan = 0;
  for (const node of sorted) {
    if (positions[node.id]) continue;
    const phi = orphan * GOLDEN_ANGLE;
    positions[node.id] = [6 * Math.cos(phi), -3, 6 * Math.sin(phi)];
    orphan++;
  }

  const all: Vec3[] = [...Object.values(positions), ...Object.values(worlds), ...Object.values(regions)];
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of all) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], v[i]);
      max[i] = Math.max(max[i], v[i]);
    }
  }
  const radius = Math.max(...all.map((v) => Math.hypot(v[0], v[1], v[2])), 1);
  void byId;
  return { version: graph.version, positions, worlds, regions, bounds: { min, max, radius } };
}
