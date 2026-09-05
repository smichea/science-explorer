import { describe, expect, it } from 'vitest';
import {
  createSession,
  currentStep,
  reduce,
  sessionProgress,
  stepIsComplete,
  stepsForVariant,
  type MissionCommand,
} from '../../src/lib/domain/mission/machine';
import type { MissionSession } from '../../src/lib/persistence/db';
import { loadPackage } from './helpers';

const pkg = loadPackage();
const mission = pkg.missions.find((m) => m.id === 'mission.galileo.inclined_plane')!;
const ctx = {
  learnerId: 'learner.test',
  contentVersion: '0.1.0',
  now: new Date('2026-09-10T10:00:00Z'),
};
const exercise = (id: string) => pkg.exercises.find((e) => e.id === id)!;

function run(session: MissionSession, ...commands: MissionCommand[]) {
  const evidence = [];
  let completed = false;
  for (const c of commands) {
    const t = reduce(mission, session, c, ctx);
    session = t.session;
    evidence.push(...t.evidence);
    completed ||= t.completedMission;
  }
  return { session, evidence, completed };
}

describe('mission state machine', () => {
  it('creates a session on the first step and emits mission_started once', () => {
    const t = createSession(mission, 'terminale', ctx, 'fr');
    expect(t.session.currentStepId).toBe('arrival');
    expect(t.session.status).toBe('briefing');
    expect(t.evidence.map((e) => e.type)).toEqual(['mission_started']);
    expect(stepsForVariant(mission, 'terminale')).toHaveLength(15);
    expect(stepsForVariant(mission, 'discovery')).toHaveLength(10);
  });

  it('refuses to advance an incomplete step and follows completion conditions', () => {
    let { session } = createSession(mission, 'terminale', ctx, 'fr');
    ({ session } = run(session, { type: 'advance' }, { type: 'advance' }, { type: 'advance' }));
    expect(session.currentStepId).toBe('hypothesis');
    const before = run(session, { type: 'advance' });
    expect(before.session.currentStepId).toBe('hypothesis');
    const after = run(session, { type: 'choose', choiceId: 'speed_time' }, { type: 'advance' });
    expect(after.session.currentStepId).toBe('prediction');
    expect(after.evidence.some((e) => e.type === 'prediction_recorded')).toBe(true);
    expect(after.evidence.some((e) => e.type === 'exercise_solved')).toBe(false);
  });

  it('records measurements, exercises and tool selection with autonomy and idempotent keys', () => {
    let { session } = createSession(mission, 'terminale', ctx, 'fr');
    ({ session } = run(
      session,
      { type: 'advance' },
      { type: 'advance' },
      { type: 'advance' },
      { type: 'choose', choiceId: 'speed_time' },
      { type: 'advance' },
      { type: 'inputs', values: { ratio_2: 4, ratio_3: 9 } },
      { type: 'advance' }
    ));
    expect(session.currentStepId).toBe('observe');
    const observe = run(
      session,
      { type: 'measurement', t: 1, value: 0.6 },
      { type: 'measurement', t: 2, value: 2.4 },
      { type: 'measurement', t: 3, value: 5.4 },
      { type: 'advance' }
    );
    expect(observe.evidence.filter((e) => e.type === 'measurement_recorded')).toHaveLength(3);
    expect(new Set(observe.evidence.map((e) => e.idempotencyKey)).size).toBe(
      observe.evidence.length
    );
    session = observe.session;
    expect(session.currentStepId).toBe('graph_construction');
    const ex = exercise('exercise.galileo.ratio_distances');
    const wrong = run(
      session,
      { type: 'open_hint', hintId: `${ex.id}:h1` },
      {
        type: 'exercise',
        exercise: ex,
        check: { correct: false, score: 0, feedback: 'incorrect' },
        value: { value: '3' },
      }
    );
    expect(wrong.evidence.find((e) => e.type === 'exercise_attempted')?.autonomy).toBe(0.8);
    const right = run(wrong.session, {
      type: 'exercise',
      exercise: ex,
      check: { correct: true, score: 1, feedback: 'correct' },
      value: { value: '4' },
    });
    expect(right.evidence.find((e) => e.type === 'exercise_solved')?.idempotencyKey).toContain(
      'attempt:2'
    );
    expect(right.session.stepStates.graph_construction.answers?.[ex.id].correct).toBe(true);
  });

  it('never emits evidence on a language switch and keeps one session', () => {
    const { session } = createSession(mission, 'terminale', ctx, 'fr');
    const t = reduce(mission, session, { type: 'locale', locale: 'en' }, ctx);
    expect(t.evidence).toHaveLength(0);
    expect(t.session.id).toBe(session.id);
    expect(t.session.locale).toBe('en');
  });

  it('supports guide commands: skip, goto, repeat, hints, rubric', () => {
    let { session } = createSession(mission, 'terminale', ctx, 'fr');
    const skipped = run(session, { type: 'guide_skip' });
    expect(skipped.session.currentStepId).toBe('role');
    expect(skipped.session.stepStates.arrival.status).toBe('skipped');
    expect(skipped.session.guideCommands[0].type).toBe('skip');
    const jumped = run(skipped.session, { type: 'guide_goto', stepId: 'workshop' });
    expect(jumped.session.currentStepId).toBe('workshop');
    const withheld = run(jumped.session, { type: 'guide_hints', mode: 'withheld' });
    expect(withheld.session.stepStates.workshop.guideHints).toBe('withheld');
    const rubric = run(withheld.session, {
      type: 'guide_rubric',
      exerciseId: 'exercise.debrief.reflection',
      nodeId: 'tool.derivative',
      score: 0.8,
      stepId: 'reflection',
    });
    expect(rubric.evidence[0].type).toBe('guide_rubric_scored');
    expect(rubric.evidence[0].score).toBe(0.8);
    session = run(rubric.session, { type: 'guide_repeat', stepId: 'arrival' }).session;
    expect(session.currentStepId).toBe('arrival');
    expect(session.stepStates.arrival.status).toBe('active');
  });

  it('completes the mission on the map-return step and reports progress', () => {
    let { session } = createSession(mission, 'discovery', ctx, 'fr');
    const steps = stepsForVariant(mission, 'discovery');
    // Force every step to completion through guide skips, then finish at map_return.
    for (let i = 0; i < steps.length - 1; i++)
      session = run(session, { type: 'guide_skip' }).session;
    expect(session.currentStepId).toBe('map_return');
    expect(stepIsComplete(currentStep(mission, session)!, session)).toBe(true);
    expect(sessionProgress(mission, session)).toEqual({ index: steps.length, total: steps.length });
    const done = run(session, { type: 'advance' });
    expect(done.completed).toBe(true);
    expect(done.session.status).toBe('completed');
    expect(done.evidence.some((e) => e.type === 'mission_completed')).toBe(true);
  });
});
