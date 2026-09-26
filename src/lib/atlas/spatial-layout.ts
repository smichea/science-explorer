import type { CompiledLayout, Vec3 } from '$lib/content-schema';
import type { GraphIndex } from '$lib/domain/graph';

/** Display geography for the 3D atlas. Authored content and the 2D map retain their coordinates. */
export function spatialLayout(graph: GraphIndex, authored: CompiledLayout) {
  const positions: Record<string, Vec3> = {};
  const regions: Record<string, Vec3> = {};
  const worlds: Record<string, Vec3> = {};
  const regionRadii = new Map<string, number>();
  const worldRadii = new Map<string, number>();
  const members = new Map<string, string[]>();
  for (const region of graph.graph.regions) {
    const nodes = graph.graph.nodes
      .filter((node) => graph.regionOf(node)?.id === region.id)
      .sort((a, b) => b.importance - a.importance || a.id.localeCompare(b.id));
    members.set(
      region.id,
      nodes.map((node) => node.id)
    );
    regionRadii.set(region.id, Math.max(10, 7 + 6 * Math.sqrt(nodes.length)));
  }
  for (const world of graph.graph.worlds) {
    const siblings = graph.graph.regions.filter((region) => region.worldId === world.id);
    const largest = Math.max(10, ...siblings.map((region) => regionRadii.get(region.id)!));
    const orbit = Math.max(36, (largest + 7) / Math.sin(Math.PI / Math.max(2, siblings.length)));
    worldRadii.set(world.id, orbit + largest + 8);
  }
  const largestWorld = Math.max(60, ...worldRadii.values());
  const worldOrbit = largestWorld * 1.6 + 45;
  for (const world of graph.graph.worlds) {
    const source = authored.worlds[world.id] ?? [1, 0, 0];
    const angle = Math.atan2(source[2], source[0]);
    worlds[world.id] = [Math.cos(angle) * worldOrbit, 0, Math.sin(angle) * worldOrbit];
    const siblings = graph.graph.regions.filter((region) => region.worldId === world.id);
    const largest = Math.max(10, ...siblings.map((region) => regionRadii.get(region.id)!));
    const orbit = worldRadii.get(world.id)! - largest - 8;
    for (const [i, region] of siblings.entries()) {
      const a = angle + (i / siblings.length) * Math.PI * 2;
      regions[region.id] = [
        worlds[world.id][0] + Math.cos(a) * orbit,
        0,
        worlds[world.id][2] + Math.sin(a) * orbit,
      ];
    }
  }
  const bridges = graph.graph.regions.filter((region) => !regions[region.id]);
  const bridgeRadius = Math.max(24, ...bridges.map((region) => regionRadii.get(region.id)!));
  const bridgeOrbit = (bridgeRadius + 5) / Math.sin(Math.PI / Math.max(2, bridges.length));
  for (const [i, region] of bridges.entries()) {
    const angle = (i / bridges.length) * Math.PI * 2;
    regions[region.id] = [Math.cos(angle) * bridgeOrbit, -4, Math.sin(angle) * bridgeOrbit];
  }
  for (const [regionId, ids] of members) {
    const centre = regions[regionId];
    for (const [i, id] of ids.entries()) {
      // A sunflower packing gives each destination room, including the historical satellites.
      const radius = 6 * Math.sqrt(i + 1);
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      positions[id] = [
        centre[0] + radius * Math.cos(angle),
        2,
        centre[2] + radius * Math.sin(angle),
      ];
    }
  }
  let orphan = 0;
  for (const node of graph.graph.nodes) {
    if (positions[node.id]) continue;
    const a = orphan++ * Math.PI * (3 - Math.sqrt(5));
    const r = 8 * Math.sqrt(orphan);
    positions[node.id] = [Math.cos(a) * r, 3, Math.sin(a) * r];
  }
  const points = [...Object.values(positions), ...Object.values(regions), ...Object.values(worlds)];
  const min = [0, 1, 2].map((axis) => Math.min(...points.map((p) => p[axis]))) as Vec3;
  const max = [0, 1, 2].map((axis) => Math.max(...points.map((p) => p[axis]))) as Vec3;
  const radius = Math.max(...points.map((p) => Math.hypot(...p))) + 20;
  const layout: CompiledLayout = {
    ...authored,
    positions,
    regions,
    worlds,
    bounds: { min, max, radius },
  };
  return { layout, regionRadii, worldRadii };
}
