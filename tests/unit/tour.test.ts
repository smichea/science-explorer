import { describe, expect, it } from 'vitest';
import { inferHorizon } from '../../src/lib/domain/horizon';
import type { NodeState, ProgressionSnapshot } from '../../src/lib/domain/progression';
import { buildTour, countTourStops, type TourStopStep } from '../../src/lib/domain/tour';
import { loadGraph, loadPackage } from './helpers';

const graph = loadGraph();
const pkg = loadPackage();
const tour = pkg.tours[0];
const config = pkg.horizon;

function snapshotWith(statuses: Record<string, NodeState['status']>): ProgressionSnapshot {
  const nodeStates = new Map<string, NodeState>();
  for (const [id, status] of Object.entries(statuses))
    nodeStates.set(id, { nodeId: id, status } as NodeState);
  return {
    nodeStates,
    coverage: new Map(),
    explanations: new Map(),
    completedMissions: new Set(),
    computedAt: '2026-09-05T00:00:00Z',
  };
}

const stops = (steps: ReturnType<typeof buildTour>) =>
  steps.filter((s): s is TourStopStep => s.kind === 'stop');

describe('bird’s-eye flight', () => {
  const horizon = inferHorizon(17, config);
  const ctx = { graph, routes: pkg.routes, horizon, config, snapshot: null };

  it('is authored: an intro, legs with transitions, an outro', () => {
    expect(tour.id).toBe('tour.horizon_flight');
    expect(tour.legs.length).toBeGreaterThanOrEqual(4);
    tour.legs.slice(1).forEach((leg) => expect(leg.transition?.fr).toBeTruthy());
  });

  it('flies over every destination of the horizon exactly once, routes first', () => {
    const steps = buildTour(tour, ctx);
    expect(steps[0].kind).toBe('intro');
    expect(steps[steps.length - 1].kind).toBe('outro');
    const ids = stops(steps).map((s) => s.node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(graph.graph.nodes.length);
    expect(countTourStops(steps)).toBe(ids.length);
    // The first leg is the recommended route, in its authored order.
    const firstLeg = steps.find((s) => s.kind === 'leg');
    expect(firstLeg?.kind === 'leg' && firstLeg.nodeIds).toEqual(
      pkg.routes.find((r) => r.id === 'route.first_journey')!.nodes
    );
    // The mission appears on the first route, so the history route skips it.
    const history = steps.find((s) => s.kind === 'leg' && s.legIndex === 1);
    expect(history?.kind === 'leg' && history.nodeIds).not.toContain(
      'mission.galileo.inclined_plane'
    );
    expect(history?.kind === 'leg' && history.text.fr).toContain('Remontons');
  });

  it('reads the authored overview of each stop, never a formula', () => {
    for (const stop of stops(buildTour(tour, ctx))) {
      expect(stop.text.fr.length).toBeGreaterThan(40);
      expect(stop.text.fr).not.toContain('$');
      expect(stop.text.en).not.toContain('$');
    }
  });

  it('skips what is already practised, unless asked to include it', () => {
    const snapshot = snapshotWith({
      'tool.derivative': 'practised',
      'concept.function': 'mastered',
      'concept.graph': 'seen',
    });
    const remaining = stops(buildTour(tour, { ...ctx, snapshot })).map((s) => s.node.id);
    expect(remaining).not.toContain('tool.derivative');
    expect(remaining).not.toContain('concept.function');
    expect(remaining).toContain('concept.graph');
    const all = stops(buildTour(tour, { ...ctx, snapshot }, { includeDone: true }));
    expect(all.map((s) => s.node.id)).toContain('tool.derivative');
    expect(all.find((s) => s.node.id === 'tool.derivative')?.status).toBe('practised');
  });

  it('drops a leg whose destinations are all done, with its transition', () => {
    const galileoRoute = pkg.routes.find((r) => r.id === 'route.galileo_history')!;
    const done = Object.fromEntries(galileoRoute.nodes.map((id) => [id, 'mastered' as const]));
    const steps = buildTour(tour, { ...ctx, snapshot: snapshotWith(done) });
    const legs = steps.filter((s) => s.kind === 'leg');
    expect(legs.some((l) => l.kind === 'leg' && l.legIndex === 1)).toBe(false);
    expect(legs.length).toBe(tour.legs.length - 1);
  });

  it('narrows the flight to the horizon of the learner', () => {
    // A 15-year-old still has Terminale within a three-year horizon: only the MP-only gradient is out.
    const young = inferHorizon(15, config);
    const youngIds = stops(buildTour(tour, { ...ctx, horizon: young })).map((s) => s.node.id);
    expect(youngIds).toContain('tool.derivative');
    expect(youngIds).not.toContain('tool.gradient');
    expect(youngIds.length).toBe(graph.graph.nodes.length - 1);
    // A horizon that stops at Seconde keeps only the stage-less destinations (history, questions).
    const seconde = { ...young, stages: ['seconde' as const] };
    const ids = stops(buildTour(tour, { ...ctx, horizon: seconde })).map((s) => s.node.id);
    expect(ids).toContain('person.galileo_galilei');
    expect(ids).toContain('question.how_to_predict_motion');
    expect(ids).not.toContain('tool.derivative');
    expect(ids.length).toBeLessThan(graph.graph.nodes.length / 2);
  });

  it('orders automatic legs by stage, region and importance', () => {
    const steps = buildTour(tour, ctx);
    const maths = steps.find((s) => s.kind === 'leg' && s.legIndex === 3);
    expect(maths?.kind === 'leg' && maths.focus).toEqual({
      kind: 'world',
      id: 'world.mathematics',
    });
    const ids = maths?.kind === 'leg' ? maths.nodeIds : [];
    expect(ids).toContain('tool.vector');
    expect(ids.indexOf('tool.vector')).toBeLessThan(ids.indexOf('tool.gradient'));
  });
});
