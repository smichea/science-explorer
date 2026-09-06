import { describe, expect, it } from 'vitest';
import type { TourDefinition } from '../../src/lib/content-schema';
import { inferHorizon } from '../../src/lib/domain/horizon';
import type { NodeState, ProgressionSnapshot } from '../../src/lib/domain/progression';
import {
  buildTour,
  countTourStops,
  orderByPrerequisites,
  prerequisiteInversions,
  type TourStopStep,
} from '../../src/lib/domain/tour';
import { loadGraph, loadPackage } from './helpers';

const graph = loadGraph();
const pkg = loadPackage();
const tour = pkg.tours[0];
const config = pkg.horizon;
const lessons = graph.graph.nodes.filter((n) => n.type !== 'mission');

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
const node = (id: string) => graph.getNode(id)!;

describe('bird’s-eye flight', () => {
  const horizon = inferHorizon(17, config);
  const ctx = { graph, routes: pkg.routes, horizon, config, snapshot: null };

  it('is authored: an intro, legs with transitions, an outro', () => {
    expect(tour.id).toBe('tour.horizon_flight');
    expect(tour.legs.length).toBeGreaterThanOrEqual(4);
    tour.legs.slice(1).forEach((leg) => expect(leg.transition?.fr).toBeTruthy());
  });

  it('flies over every lesson of the horizon exactly once, routes first, never a mission', () => {
    const steps = buildTour(tour, ctx);
    expect(steps[0].kind).toBe('intro');
    expect(steps[steps.length - 1].kind).toBe('outro');
    const ids = stops(steps).map((s) => s.node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(lessons.length);
    expect(ids).not.toContain('mission.galileo.inclined_plane');
    expect(countTourStops(steps)).toBe(ids.length);
    // The first leg is the recommended route, in its authored order, without its mission.
    const firstLeg = steps.find((s) => s.kind === 'leg');
    expect(firstLeg?.kind === 'leg' && firstLeg.nodeIds).toEqual([
      'concept.function',
      'concept.graph',
      'concept.rate_of_change',
      'tool.derivative',
    ]);
    expect(firstLeg?.kind === 'leg' && firstLeg.stops.map((s) => s.title.fr)).toEqual([
      'Fonction',
      'Courbe représentative',
      'Taux de variation',
      'Dérivée',
    ]);
    // A route leg frames its stops together instead of the centre of a region.
    expect(firstLeg?.kind === 'leg' && firstLeg.focus).toEqual({
      kind: 'group',
      ids: firstLeg?.kind === 'leg' ? firstLeg.nodeIds : [],
    });
    const history = steps.find((s) => s.kind === 'leg' && s.legIndex === 2);
    expect(history?.kind === 'leg' && history.nodeIds).not.toContain(
      'mission.galileo.inclined_plane'
    );
    expect(history?.kind === 'leg' && history.text.fr).toContain('Padoue');
    // Even when asked to include everything, a mission is never a stop.
    const all = stops(buildTour(tour, ctx, { includeDone: true })).map((s) => s.node.id);
    expect(all).not.toContain('mission.galileo.inclined_plane');
    expect(all.length).toBe(lessons.length);
  });

  it('never flies over a prerequisite after a destination that needs it', () => {
    expect(prerequisiteInversions(buildTour(tour, ctx), graph)).toEqual([]);
    expect(prerequisiteInversions(buildTour(tour, ctx, { everything: true }), graph)).toEqual([]);
    expect(
      prerequisiteInversions(buildTour(tour, { ...ctx, horizon: inferHorizon(15, config) }), graph)
    ).toEqual([]);
    // The applications of the exponential come after the exponential itself.
    const ids = stops(buildTour(tour, ctx)).map((s) => s.node.id);
    const at = (id: string) => ids.indexOf(id);
    expect(at('tool.exponential')).toBeGreaterThan(at('tool.derivative'));
    for (const application of [
      'phenomenon.circuit.capacitor_charging',
      'phenomenon.chemistry.first_order_reaction',
      'phenomenon.nuclear.radioactive_decay',
      'concept.rate_proportional_to_quantity',
    ])
      expect(at(application)).toBeGreaterThan(at('tool.exponential'));
    expect(at('model.kinematics_point')).toBeLessThan(
      at('phenomenon.motion.uniformly_accelerated')
    );
    expect(at('concept.initial_condition')).toBeLessThan(at('tool.ode_first_order'));
  });

  it('reports the inversions of a badly ordered flight', () => {
    const reversed: TourDefinition = {
      ...tour,
      legs: [...tour.legs].reverse().map((leg, i) => ({
        ...leg,
        transition: i === 0 ? undefined : (leg.transition ?? { fr: 'puis', en: 'then' }),
      })),
    };
    const inversions = prerequisiteInversions(buildTour(reversed, ctx), graph);
    expect(inversions.length).toBeGreaterThan(0);
    // Physics is flown before mathematics: kinematics comes before the derivative it needs.
    expect(inversions).toContainEqual(
      expect.objectContaining({
        from: 'tool.derivative',
        to: 'model.kinematics_point',
        type: 'requires_essentially',
      })
    );
    inversions.forEach((i) => expect(i.fromLeg).toBeGreaterThan(i.toLeg));
  });

  it('pulls a prerequisite written too late forward, keeping the rest of the order', () => {
    const ordered = orderByPrerequisites(
      [
        node('tool.derivative'),
        node('concept.function'),
        node('tool.vector'),
        node('concept.graph'),
      ],
      graph
    ).map((n) => n.id);
    // function (essential) and graph (recommended) move before the derivative; vector stays.
    expect(ordered).toEqual([
      'concept.function',
      'concept.graph',
      'tool.derivative',
      'tool.vector',
    ]);
    // An order that already respects the prerequisites is left untouched.
    const route = pkg.routes.find((r) => r.id === 'route.exponential_everywhere')!;
    const nodes = route.nodes.map(node);
    expect(orderByPrerequisites(nodes, graph)).toEqual(nodes);
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
    expect(prerequisiteInversions(buildTour(tour, { ...ctx, snapshot }), graph)).toEqual([]);
    const all = stops(buildTour(tour, { ...ctx, snapshot }, { includeDone: true }));
    expect(all.map((s) => s.node.id)).toContain('tool.derivative');
    expect(all.find((s) => s.node.id === 'tool.derivative')?.status).toBe('practised');
  });

  it('drops a leg whose destinations are all done, with its transition', () => {
    const flown = buildTour(tour, ctx).filter((s) => s.kind === 'leg');
    const galileoRoute = pkg.routes.find((r) => r.id === 'route.galileo_history')!;
    const done = Object.fromEntries(galileoRoute.nodes.map((id) => [id, 'mastered' as const]));
    const steps = buildTour(tour, { ...ctx, snapshot: snapshotWith(done) });
    const legs = steps.filter((s) => s.kind === 'leg');
    expect(legs.some((l) => l.kind === 'leg' && l.legIndex === 2)).toBe(false);
    expect(legs.length).toBe(flown.length - 1);
  });

  it('narrows the flight to the horizon of the learner', () => {
    // A 15-year-old still has Terminale within a three-year horizon: only the MP-only gradient is out.
    const young = inferHorizon(15, config);
    const youngIds = stops(buildTour(tour, { ...ctx, horizon: young })).map((s) => s.node.id);
    expect(youngIds).toContain('tool.derivative');
    expect(youngIds).not.toContain('tool.gradient');
    expect(youngIds.length).toBe(lessons.length - 1);
    // A horizon that stops at Seconde keeps only the stage-less destinations (history, questions).
    const seconde = { ...young, stages: ['seconde' as const] };
    const ids = stops(buildTour(tour, { ...ctx, horizon: seconde })).map((s) => s.node.id);
    expect(ids).toContain('person.galileo_galilei');
    expect(ids).toContain('question.how_to_predict_motion');
    expect(ids).not.toContain('tool.derivative');
    expect(ids.length).toBeLessThan(lessons.length / 2);
  });

  it('orders automatic legs by stage, region and importance, then by prerequisites', () => {
    const steps = buildTour(tour, ctx);
    const maths = steps.find((s) => s.kind === 'leg' && s.legIndex === 4);
    expect(maths?.kind === 'leg' && maths.focus).toEqual({
      kind: 'world',
      id: 'world.mathematics',
    });
    // Only the gradient is left in mathematics after the routes.
    expect(maths?.kind === 'leg' && maths.nodeIds).toEqual(['tool.gradient']);
    // A flight made of one automatic leg orders the whole world by itself.
    const mathsOnly: TourDefinition = {
      ...tour,
      legs: [{ world: 'world.mathematics', title: { fr: 'Maths', en: 'Maths' } }],
    };
    const ids = stops(buildTour(mathsOnly, ctx)).map((s) => s.node.id);
    const at = (id: string) => ids.indexOf(id);
    expect(ids.length).toBe(lessons.filter((n) => n.world === 'world.mathematics').length);
    expect(at('concept.function')).toBeLessThan(at('tool.derivative'));
    expect(at('tool.derivative')).toBeLessThan(at('tool.exponential'));
    expect(at('tool.exponential')).toBeLessThan(at('tool.ode_first_order'));
    expect(at('tool.vector')).toBeLessThan(at('tool.gradient'));
    expect(prerequisiteInversions(buildTour(mathsOnly, ctx), graph)).toEqual([]);
  });
});
