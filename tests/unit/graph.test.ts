import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/lib/domain/layout';
import { loadGraph, loadPackage } from './helpers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { LayoutAnchorsSchema } from '../../src/lib/content-schema';

const graph = loadGraph();
const pkg = loadPackage();

describe('graph queries', () => {
  it('resolves nodes, regions and worlds', () => {
    const d = graph.getNode('tool.derivative')!;
    expect(d.type).toBe('mathematical_tool');
    expect(graph.regionOf(d)?.id).toBe('region.math.functions_analysis');
    expect(graph.worldOf(d)?.id).toBe('world.mathematics');
    expect(graph.graph.regions.length).toBe(39);
  });

  it('lists essential and recommended prerequisites of the derivative', () => {
    const { essential, recommended } = graph.prerequisitesOf('tool.derivative');
    expect(essential.map((n) => n.id)).toEqual(
      expect.arrayContaining(['concept.function', 'concept.rate_of_change'])
    );
    expect(recommended.map((n) => n.id)).toContain('concept.graph');
  });

  it('orders the prerequisite closure foundations first', () => {
    const closure = graph.prerequisiteClosure('tool.gradient').map((n) => n.id);
    expect(closure).toContain('tool.derivative');
    expect(closure.indexOf('concept.function')).toBeLessThan(closure.indexOf('tool.derivative'));
  });

  it('finds the eight coverage-eligible applications of the derivative', () => {
    const apps = graph.getApplications('tool.derivative').map((a) => a.phenomenon.id);
    expect(apps).toHaveLength(8);
    expect(apps).toContain('phenomenon.circuit.capacitor_charging');
    expect(graph.getToolsFor('phenomenon.motion.free_fall').map((x) => x.tool.id)).toContain(
      'tool.derivative'
    );
  });

  it('links the mission to its nodes', () => {
    expect(graph.getHistoricalMissions('tool.derivative').map((m) => m.id)).toContain(
      'mission.galileo.inclined_plane'
    );
    expect(graph.getHistoricalMissions('person.galileo_galilei').map((m) => m.id)).toContain(
      'mission.galileo.inclined_plane'
    );
  });

  it('searches in both languages and resolves aliases to canonical nodes', () => {
    const fr = graph.searchText('dériv', 'fr');
    expect(fr[0]?.entry.target).toBe('tool.derivative');
    const en = graph.searchText('differential coefficient', 'en');
    expect(en.map((h) => h.entry.target)).toContain('tool.derivative');
    expect(graph.searchText('galil', 'fr').map((h) => h.entry.target)).toEqual(
      expect.arrayContaining(['person.galileo_galilei', 'mission.galileo.inclined_plane'])
    );
    expect(graph.searchText('x', 'fr')).toHaveLength(0);
  });
});

describe('layout', () => {
  const anchors = LayoutAnchorsSchema.parse(
    yaml.load(
      readFileSync(join(__dirname, '..', '..', 'content', 'layout', 'anchors.yaml'), 'utf8')
    )
  );

  it('is deterministic and identical to the frozen snapshot', () => {
    const a = computeLayout(pkg.graph, anchors);
    const b = computeLayout(pkg.graph, anchors);
    expect(a).toEqual(b);
    expect(a.positions['tool.derivative']).toEqual(pkg.layout.positions['tool.derivative']);
  });

  it('places every node, region and world, with no two nodes on the same spot', () => {
    for (const n of pkg.graph.nodes) expect(pkg.layout.positions[n.id]).toBeDefined();
    for (const r of pkg.graph.regions) expect(pkg.layout.regions[r.id]).toBeDefined();
    for (const w of pkg.graph.worlds) expect(pkg.layout.worlds[w.id]).toBeDefined();
    const ids = Object.keys(pkg.layout.positions);
    let minDistance = Infinity;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = pkg.layout.positions[ids[i]];
        const b = pkg.layout.positions[ids[j]];
        minDistance = Math.min(minDistance, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      }
    }
    expect(minDistance).toBeGreaterThan(1);
  });
});
