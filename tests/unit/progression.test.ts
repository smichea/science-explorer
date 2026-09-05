import { describe, expect, it } from 'vitest';
import type { EvidenceEvent } from '../../src/lib/persistence/db';
import { autonomyFromHints, idempotencyKey, makeEvidence } from '../../src/lib/domain/evidence';
import { inferHorizon } from '../../src/lib/domain/horizon';
import {
  computeCoverage,
  computeMastery,
  computeNodeState,
  computeProgression,
  coverageScope,
} from '../../src/lib/domain/progression';
import { destinationState } from '../../src/lib/domain/progression/destination';
import { recommend } from '../../src/lib/domain/progression/recommend';
import { loadGraph, loadPackage } from './helpers';

const graph = loadGraph();
const pkg = loadPackage();
const horizon = inferHorizon(17, pkg.horizon);
const ctx = {
  learnerId: 'learner.test',
  contentVersion: '0.1.0',
  now: new Date('2026-09-10T10:00:00Z'),
};

function ev(partial: Partial<EvidenceEvent> & { type: EvidenceEvent['type'] }): EvidenceEvent {
  return makeEvidence(
    { ...partial, discriminator: partial.id ?? Math.random().toString(36).slice(2) },
    ctx
  );
}

describe('evidence', () => {
  it('builds idempotency keys without the locale, so switching languages never duplicates events', () => {
    const a = idempotencyKey(
      {
        type: 'exercise_solved',
        sessionId: 's1',
        stepId: 'workshop',
        exerciseId: 'ex',
        discriminator: 'attempt:1',
      },
      'l'
    );
    const b = idempotencyKey(
      {
        type: 'exercise_solved',
        sessionId: 's1',
        stepId: 'workshop',
        exerciseId: 'ex',
        discriminator: 'attempt:1',
      },
      'l'
    );
    expect(a).toBe(b);
    expect(a).not.toContain('fr');
    expect(
      idempotencyKey(
        {
          type: 'exercise_solved',
          sessionId: 's1',
          stepId: 'workshop',
          exerciseId: 'ex',
          discriminator: 'attempt:2',
        },
        'l'
      )
    ).not.toBe(a);
  });

  it('derives autonomy from hints', () => {
    expect(autonomyFromHints(0)).toBe(1);
    expect(autonomyFromHints(1)).toBe(0.8);
    expect(autonomyFromHints(2)).toBe(0.6);
    expect(autonomyFromHints(0, true)).toBe(0.4);
  });
});

describe('mastery-0.1', () => {
  it('one correct answer never looks like reliable mastery', () => {
    const events = [
      ev({
        type: 'exercise_solved',
        nodeId: 'tool.derivative',
        phenomenonId: 'phenomenon.motion.uniformly_accelerated',
        dimension: 'procedural_execution',
        result: 'correct',
        autonomy: 1,
      }),
    ];
    const { mastery } = computeMastery(events, ctx.now);
    expect(mastery.estimate).toBeCloseTo(0.25, 5);
    expect(mastery.confidence).toBeLessThan(0.25);
    expect(mastery.confidenceLabel).toBe('low');
    expect(computeNodeState('tool.derivative', events, ctx.now).status).toBe('practised');
  });

  it('weights dimensions, recency and autonomy', () => {
    const base = { nodeId: 'tool.derivative', result: 'correct' as const };
    const events = [
      ev({
        ...base,
        type: 'exercise_solved',
        dimension: 'procedural_execution',
        autonomy: 1,
        timestamp: '2026-09-01T10:00:00Z',
      }),
      ev({
        ...base,
        type: 'tool_selected_for_model',
        dimension: 'modelling_choice',
        autonomy: 0.6,
        phenomenonId: 'a',
        timestamp: '2026-09-02T10:00:00Z',
      }),
      ev({
        ...base,
        type: 'transfer_completed',
        dimension: 'transfer',
        autonomy: 1,
        phenomenonId: 'b',
        timestamp: '2026-09-03T10:00:00Z',
      }),
      ev({
        nodeId: 'tool.derivative',
        type: 'explanation_submitted',
        autonomy: 1,
        timestamp: '2026-09-04T10:00:00Z',
      }),
    ];
    const { mastery, explanation } = computeMastery(events, ctx.now);
    expect(mastery.dimensions.procedural_execution).toBe(1);
    expect(mastery.dimensions.modelling_choice).toBeCloseTo(0.6, 5);
    expect(mastery.dimensions.transfer).toBe(1);
    expect(mastery.dimensions.recognition_explanation).toBeCloseTo(0.5, 5);
    expect(mastery.estimate).toBeCloseTo(0.25 * 1 + 0.3 * 0.6 + 0.2 * 1 + 0.2 * 0.5, 5);
    expect(mastery.contexts).toBe(2);
    expect(explanation.length).toBe(4);
    expect(explanation.reduce((s, x) => s + x.contribution, 0)).toBeGreaterThan(0);
  });

  it('marks mastery only with enough confidence, and flags review after 21 days', () => {
    const many: EvidenceEvent[] = [];
    for (let i = 0; i < 12; i++) {
      many.push(
        ev({
          type:
            i % 3 === 0
              ? 'transfer_completed'
              : i % 3 === 1
                ? 'tool_selected_for_model'
                : 'exercise_solved',
          nodeId: 'tool.derivative',
          phenomenonId: `p${i % 4}`,
          dimension:
            i % 3 === 0 ? 'transfer' : i % 3 === 1 ? 'modelling_choice' : 'procedural_execution',
          result: 'correct',
          autonomy: 1,
          timestamp: `2026-08-${String(10 + i).padStart(2, '0')}T10:00:00Z`,
        })
      );
    }
    many.push(
      ev({
        type: 'explanation_submitted',
        nodeId: 'tool.derivative',
        dimension: 'recognition_explanation',
        score: 1,
        autonomy: 1,
        timestamp: '2026-08-25T10:00:00Z',
      })
    );
    const state = computeNodeState('tool.derivative', many, new Date('2026-08-26T10:00:00Z'));
    expect(state.mastery.estimate).toBeGreaterThan(0.7);
    expect(state.mastery.confidence).toBeGreaterThanOrEqual(0.55);
    expect(state.status).toBe('mastered');
    const later = computeNodeState('tool.derivative', many, new Date('2026-10-20T10:00:00Z'));
    expect(later.reviewRecommended).toBe(true);
  });
});

describe('coverage-0.1', () => {
  const scope = coverageScope(horizon, pkg.horizon);

  it('counts eligible applications within the scope and weights evidence of use', () => {
    const events = [
      ev({
        type: 'tool_selected_for_model',
        nodeId: 'tool.derivative',
        phenomenonId: 'phenomenon.motion.uniformly_accelerated',
        result: 'correct',
        autonomy: 1,
      }),
      ev({
        type: 'exercise_solved',
        nodeId: 'tool.derivative',
        phenomenonId: 'phenomenon.motion.free_fall',
        result: 'correct',
        autonomy: 0.6,
      }),
      ev({
        type: 'worked_example_observed',
        nodeId: 'tool.derivative',
        phenomenonId: 'phenomenon.motion.with_drag',
      }),
    ];
    const c = computeCoverage('tool.derivative', events, graph, scope, pkg.horizon);
    expect(c.eligibleCount).toBe(8);
    expect(c.appliedCount).toBe(2);
    const weights = graph.getApplications('tool.derivative').reduce((s, a) => s + a.edge.weight, 0);
    expect(c.estimate).toBeCloseTo((1 * 1 + 1 * 0.6 + 0.8 * 0.2) / weights, 5);
    expect(
      c.applications.find((a) => a.phenomenonId === 'phenomenon.motion.free_fall')?.state
    ).toBe('hinted');
    expect(
      c.applications.find((a) => a.phenomenonId === 'phenomenon.motion.with_drag')?.state
    ).toBe('observed');
    expect(
      c.applications.find((a) => a.phenomenonId === 'phenomenon.nuclear.radioactive_decay')?.state
    ).toBe('not_encountered');
  });

  it('is empty without evidence and complete when every application is used autonomously', () => {
    expect(computeCoverage('tool.derivative', [], graph, scope, pkg.horizon).estimate).toBe(0);
    const all = graph.getApplications('tool.derivative').map((a) =>
      ev({
        type: 'transfer_completed',
        nodeId: 'tool.derivative',
        phenomenonId: a.phenomenon.id,
        result: 'correct',
        autonomy: 1,
      })
    );
    const c = computeCoverage('tool.derivative', all, graph, scope, pkg.horizon);
    expect(c.estimate).toBeCloseTo(1, 5);
    expect(c.applications.every((a) => a.state === 'transferred')).toBe(true);
  });
});

describe('destination states and recommendations', () => {
  it('reports interrupted routes instead of locks', () => {
    const snapshot = computeProgression([], graph, pkg.horizon, horizon, ctx.now);
    const d = destinationState(graph.getNode('tool.gradient')!, {
      graph,
      config: pkg.horizon,
      horizon,
      snapshot,
      savedForLater: [],
      openMissionIds: [],
    });
    expect(d.kind).toBe('missing_essential');
    expect(d.band).toBe('final');
    expect(d.missingEssential.map((n) => n.id)).toContain('tool.derivative');
    const f = destinationState(graph.getNode('concept.function')!, {
      graph,
      config: pkg.horizon,
      horizon,
      snapshot,
      savedForLater: ['concept.function'],
      openMissionIds: [],
    });
    expect(f.kind).toBe('saved');
  });

  it('suggests the first mission, then applications of a practised tool', () => {
    const none = recommend(
      graph,
      computeProgression([], graph, pkg.horizon, horizon, ctx.now),
      pkg.routes
    );
    expect(none[0]?.kind).toBe('startFirstMission');
    const events = [
      ev({
        type: 'tool_selected_for_model',
        nodeId: 'tool.derivative',
        phenomenonId: 'phenomenon.motion.uniformly_accelerated',
        result: 'correct',
        autonomy: 1,
      }),
    ];
    const some = recommend(
      graph,
      computeProgression(events, graph, pkg.horizon, horizon, ctx.now),
      pkg.routes
    );
    expect(some.some((r) => r.kind === 'apply_tool' && r.via?.id === 'tool.derivative')).toBe(true);
  });
});
