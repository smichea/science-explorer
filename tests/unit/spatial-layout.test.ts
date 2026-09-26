import { describe, expect, it } from 'vitest';
import { spatialLayout } from '../../src/lib/atlas/spatial-layout';
import { loadGraph, loadPackage } from './helpers';

const graph = loadGraph();
const authored = loadPackage().layout;

describe('3D atlas geography', () => {
  it('places every destination deterministically without changing the authored map', () => {
    const before = JSON.stringify(authored);
    const first = spatialLayout(graph, authored);
    expect(spatialLayout(graph, authored).layout).toEqual(first.layout);
    expect(Object.keys(first.layout.positions).sort()).toEqual(
      graph.graph.nodes.map((node) => node.id).sort()
    );
    expect(JSON.stringify(authored)).toBe(before);
  });

  it('keeps destination models apart, including satellites and neighbouring regions', () => {
    const { layout } = spatialLayout(graph, authored);
    const points = Object.entries(layout.positions);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const [a, p] = points[i];
        const [b, q] = points[j];
        const distance = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
        expect(distance, `${a} / ${b}`).toBeGreaterThan(7);
      }
    }
  });

  it('separates world territories and contains destinations inside their region', () => {
    const { layout, worldRadii, regionRadii } = spatialLayout(graph, authored);
    const worlds = Object.entries(layout.worlds);
    for (let i = 0; i < worlds.length; i++) {
      for (let j = i + 1; j < worlds.length; j++) {
        const [a, p] = worlds[i];
        const [b, q] = worlds[j];
        expect(Math.hypot(p[0] - q[0], p[2] - q[2])).toBeGreaterThan(
          worldRadii.get(a)! + worldRadii.get(b)! + 10
        );
      }
    }
    for (const node of graph.graph.nodes) {
      const region = graph.regionOf(node);
      if (!region) continue;
      const p = layout.positions[node.id];
      const q = layout.regions[region.id];
      expect(Math.hypot(p[0] - q[0], p[2] - q[2])).toBeLessThan(regionRadii.get(region.id)! - 3);
    }
  });
});
