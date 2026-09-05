import type { ExerciseDefinition, Locale, MissionDefinition, StepDefinition } from '../../content-schema';
import type { EvidenceEvent, MissionSession, MissionSessionStatus, StepState } from '../../persistence/db';
import { newId } from '../../persistence/ids';
import { autonomyFromHints, makeEvidence, type EvidenceDraft } from '../evidence';
import type { AnswerCheck } from '../answers';

export interface MissionContext {
  learnerId: string;
  contentVersion: string;
  now?: Date;
}

export type MissionCommand =
  | { type: 'acknowledge' }
  | { type: 'choose'; choiceId: string }
  | { type: 'inputs'; values: Record<string, number | string> }
  | { type: 'measurement'; t: number; value: number; label?: string }
  | { type: 'parameter_changed'; parameter: string; value: number }
  | { type: 'exercise'; exercise: ExerciseDefinition; check: AnswerCheck; value: unknown }
  | { type: 'explanation'; exerciseId: string; text: string }
  | { type: 'select_tool'; toolId: string }
  | { type: 'open_hint'; hintId: string }
  | { type: 'advance' }
  | { type: 'back' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'abandon' }
  | { type: 'locale'; locale: Locale }
  | { type: 'guide_skip' }
  | { type: 'guide_repeat'; stepId: string }
  | { type: 'guide_goto'; stepId: string }
  | { type: 'guide_hints'; mode: 'revealed' | 'withheld' }
  | { type: 'guide_rubric'; exerciseId: string; nodeId: string; score: number; stepId: string };

export interface Transition {
  session: MissionSession;
  evidence: EvidenceEvent[];
  completedMission: boolean;
}

export function stepsForVariant(mission: MissionDefinition, variantId: string): StepDefinition[] {
  const variant = mission.learning.depthVariants.find((v) => v.id === variantId) ?? mission.learning.depthVariants[0];
  const skip = new Set(variant.skipSteps);
  return mission.experience.steps.filter((s) => !skip.has(s.id));
}

function statusForStep(step: StepDefinition | undefined): MissionSessionStatus {
  if (!step) return 'completed';
  if (step.type === 'historical_briefing' && step.completion.kind === 'read') return 'briefing';
  if (step.type === 'prediction' || step.type === 'hypothesis_choice') return 'awaiting_prediction';
  if (step.type === 'simulation' || step.type === 'measurement') return 'running_simulation';
  if (step.completion.kind === 'exercises' || step.completion.kind === 'explanation' || step.completion.kind === 'choice' || step.completion.kind === 'inputs') return 'awaiting_response';
  return 'active_step';
}

function emptyStep(): StepState {
  return { status: 'pending', attempts: 0, hintsOpened: [] };
}

export function createSession(mission: MissionDefinition, variantId: string, ctx: MissionContext, locale: Locale): Transition {
  const now = (ctx.now ?? new Date()).toISOString();
  const steps = stepsForVariant(mission, variantId);
  const variant = mission.learning.depthVariants.find((v) => v.id === variantId) ?? mission.learning.depthVariants[0];
  const stepStates: Record<string, StepState> = {};
  for (const s of steps) stepStates[s.id] = emptyStep();
  stepStates[steps[0].id].status = 'active';
  const session: MissionSession = {
    id: newId('session'),
    learnerId: ctx.learnerId,
    missionId: mission.id,
    missionVersion: mission.version,
    contentPackageVersion: ctx.contentVersion,
    locale,
    selectedDepth: variant.depth,
    variantId: variant.id,
    currentStepId: steps[0].id,
    status: statusForStep(steps[0]),
    branchHistory: [],
    stepStates,
    guideCommands: [],
    startedAt: now,
    updatedAt: now,
    simulationSnapshotIds: [],
  };
  return { session, evidence: stepEvidence(mission, steps[0], session, ctx, 'enter'), completedMission: false };
}

/** Evidence declared on a step: `mission_started` is emitted on entering, the rest on completion. */
function stepEvidence(mission: MissionDefinition, step: StepDefinition, session: MissionSession, ctx: MissionContext, when: 'enter' | 'complete'): EvidenceEvent[] {
  const state = session.stepStates[step.id];
  const autonomy = autonomyFromHints(state?.hintsOpened.length ?? 0, state?.guideHints === 'revealed');
  const drafts: EvidenceDraft[] = [];
  for (const ev of step.evidence) {
    const onEnter = ev.type === 'mission_started' || ev.type === 'node_opened';
    if ((when === 'enter') !== onEnter) continue;
    const draft: EvidenceDraft = {
      type: ev.type,
      missionId: mission.id,
      sessionId: session.id,
      stepId: step.id,
      nodeId: ev.nodeId,
      phenomenonId: ev.phenomenonId,
      dimension: ev.dimension,
      depth: session.selectedDepth,
      autonomy,
    };
    if (ev.type === 'transfer_completed' || ev.type === 'tool_selected_for_model') draft.result = state?.toolCorrect === false ? 'incorrect' : 'correct';
    if (ev.type === 'prediction_recorded') draft.payload = { choice: state?.choice, inputs: state?.inputs };
    if (ev.type === 'measurement_recorded') draft.payload = { measurements: state?.measurements ?? [] };
    drafts.push(draft);
  }
  return drafts.map((d) => makeEvidence(d, ctx));
}

function isComplete(step: StepDefinition, state: StepState): boolean {
  const c = step.completion;
  if (step.toolSelection && !state.toolSelected) return false;
  switch (c.kind) {
    case 'read':
      return true;
    case 'choice':
      return !!state.choice;
    case 'inputs':
      return c.inputs.every((i) => state.inputs?.[i.id] !== undefined && state.inputs?.[i.id] !== '');
    case 'simulation':
      return (state.measurements?.length ?? 0) >= c.minMeasurements && (state.parameterChanges ?? 0) >= c.minParameterChanges;
    case 'exercises':
      return c.exerciseIds.every((id) => state.answers?.[id]?.correct || (state.answers?.[id]?.attempts ?? 0) >= 3);
    case 'explanation':
      return (state.explanation?.length ?? 0) >= c.minCharacters;
  }
}

export function stepIsComplete(step: StepDefinition, session: MissionSession): boolean {
  return isComplete(step, session.stepStates[step.id] ?? emptyStep());
}

function nextStepId(steps: StepDefinition[], step: StepDefinition, state: StepState): string | null {
  if (state.choice) {
    const branch = step.branches.find((b) => b.whenChoice === state.choice);
    if (branch && steps.some((s) => s.id === branch.goto)) return branch.goto;
  }
  if (step.next && steps.some((s) => s.id === step.next)) return step.next;
  const index = steps.findIndex((s) => s.id === step.id);
  return index >= 0 && index < steps.length - 1 ? steps[index + 1].id : null;
}

/** Pure reducer: applies a command to a session and returns the new session plus emitted evidence. */
export function reduce(mission: MissionDefinition, session: MissionSession, command: MissionCommand, ctx: MissionContext): Transition {
  const now = (ctx.now ?? new Date()).toISOString();
  const steps = stepsForVariant(mission, session.variantId);
  const step = steps.find((s) => s.id === session.currentStepId) ?? steps[0];
  const next: MissionSession = { ...session, stepStates: { ...session.stepStates }, guideCommands: [...session.guideCommands], branchHistory: [...session.branchHistory], updatedAt: now };
  const state: StepState = { ...(next.stepStates[step.id] ?? emptyStep()) };
  next.stepStates[step.id] = state;
  const evidence: EvidenceEvent[] = [];
  const autonomy = () => autonomyFromHints(state.hintsOpened.length, state.guideHints === 'revealed');
  const base = { missionId: mission.id, sessionId: session.id, stepId: step.id, depth: session.selectedDepth };
  let completedMission = false;

  const goTo = (stepId: string | null) => {
    if (!stepId) {
      next.status = 'completed';
      next.completedAt = now;
      completedMission = true;
      return;
    }
    const target = steps.find((s) => s.id === stepId);
    if (!target) return;
    next.currentStepId = stepId;
    const targetState = { ...(next.stepStates[stepId] ?? emptyStep()) };
    if (targetState.status === 'pending' || targetState.status === 'skipped') targetState.status = 'active';
    next.stepStates[stepId] = targetState;
    next.status = statusForStep(target);
    evidence.push(...stepEvidence(mission, target, next, ctx, 'enter'));
  };

  switch (command.type) {
    case 'acknowledge':
      state.attempts += 1;
      break;
    case 'choose': {
      state.choice = command.choiceId;
      const isPrediction = step.type === 'prediction' || step.type === 'hypothesis_choice';
      if (!isPrediction && step.completion.kind === 'choice') {
        const correct = step.completion.choices.find((c) => c.id === command.choiceId)?.correct;
        if (correct !== undefined) evidence.push(makeEvidence({ ...base, type: correct ? 'exercise_solved' : 'exercise_attempted', result: correct ? 'correct' : 'incorrect', autonomy: autonomy(), discriminator: `choice:${command.choiceId}` }, ctx));
      }
      break;
    }
    case 'inputs':
      state.inputs = { ...(state.inputs ?? {}), ...command.values };
      break;
    case 'measurement':
      state.measurements = [...(state.measurements ?? []), { t: command.t, value: command.value, label: command.label }];
      evidence.push(makeEvidence({ ...base, type: 'measurement_recorded', nodeId: step.evidence.find((e) => e.type === 'measurement_recorded')?.nodeId, phenomenonId: step.evidence.find((e) => e.type === 'measurement_recorded')?.phenomenonId, payload: { t: command.t, value: command.value }, discriminator: `m:${state.measurements.length}` }, ctx));
      break;
    case 'parameter_changed':
      state.parameterChanges = (state.parameterChanges ?? 0) + 1;
      evidence.push(makeEvidence({ ...base, type: 'simulation_parameter_changed', payload: { parameter: command.parameter, value: command.value }, discriminator: `p:${state.parameterChanges}` }, ctx));
      break;
    case 'exercise': {
      const previous = state.answers?.[command.exercise.id] ?? { correct: false, score: 0, attempts: 0, value: undefined };
      const attempts = previous.attempts + 1;
      const record = { correct: command.check.correct || previous.correct, score: Math.max(previous.score, command.check.score), attempts, value: command.value };
      state.answers = { ...(state.answers ?? {}), [command.exercise.id]: record };
      state.attempts += 1;
      const ex = command.exercise;
      evidence.push(makeEvidence({ ...base, type: command.check.correct ? 'exercise_solved' : 'exercise_attempted', exerciseId: ex.id, nodeId: ex.nodeId, phenomenonId: ex.phenomenonId, dimension: ex.evidenceDimension, depth: ex.depth, result: command.check.correct ? 'correct' : command.check.score > 0 ? 'partial' : 'incorrect', score: command.check.score, autonomy: autonomy(), payload: { value: command.value }, discriminator: `attempt:${attempts}` }, ctx));
      break;
    }
    case 'explanation': {
      state.explanation = command.text;
      const ex = mission.experience.steps.flatMap(() => []).length ? undefined : undefined;
      void ex;
      state.answers = { ...(state.answers ?? {}), [command.exerciseId]: { correct: true, score: 0.5, attempts: (state.answers?.[command.exerciseId]?.attempts ?? 0) + 1, value: command.text } };
      evidence.push(makeEvidence({ ...base, type: 'explanation_submitted', exerciseId: command.exerciseId, nodeId: step.evidence.find((e) => e.type === 'explanation_submitted')?.nodeId, dimension: 'recognition_explanation', score: 0.5, autonomy: autonomy(), payload: { text: command.text } }, ctx));
      break;
    }
    case 'select_tool': {
      if (!step.toolSelection) break;
      state.toolSelected = command.toolId;
      state.toolCorrect = command.toolId === step.toolSelection.correct;
      state.attempts += 1;
      evidence.push(makeEvidence({ ...base, type: 'tool_selected_for_model', nodeId: command.toolId, phenomenonId: step.toolSelection.phenomenonId, dimension: 'modelling_choice', result: state.toolCorrect ? 'correct' : 'incorrect', autonomy: autonomy(), discriminator: `tool:${command.toolId}` }, ctx));
      break;
    }
    case 'open_hint':
      if (!state.hintsOpened.includes(command.hintId)) {
        state.hintsOpened = [...state.hintsOpened, command.hintId];
        evidence.push(makeEvidence({ ...base, type: 'hint_opened', discriminator: `hint:${command.hintId}` }, ctx));
      }
      break;
    case 'advance': {
      if (!isComplete(step, state) && state.status !== 'skipped') break;
      if (state.status !== 'skipped') {
        state.status = 'completed';
        state.completedAt = now;
        evidence.push(...stepEvidence(mission, step, next, ctx, 'complete'));
      }
      if (step.type === 'map_return' || nextStepId(steps, step, state) === null) {
        next.status = 'completed';
        next.completedAt = now;
        completedMission = true;
        if (!step.evidence.some((e) => e.type === 'mission_completed')) evidence.push(makeEvidence({ ...base, type: 'mission_completed', discriminator: 'completed' }, ctx));
      } else {
        next.branchHistory.push(step.id);
        goTo(nextStepId(steps, step, state));
      }
      break;
    }
    case 'back': {
      const index = steps.findIndex((s) => s.id === step.id);
      if (index > 0) {
        next.currentStepId = steps[index - 1].id;
        next.status = statusForStep(steps[index - 1]);
      }
      break;
    }
    case 'pause':
      next.status = 'paused';
      break;
    case 'resume':
      next.status = statusForStep(step);
      break;
    case 'abandon':
      next.status = 'abandoned';
      break;
    case 'locale':
      next.locale = command.locale;
      break;
    case 'guide_skip':
      state.status = 'skipped';
      next.guideCommands.push({ type: 'skip', stepId: step.id, at: now });
      next.branchHistory.push(step.id);
      goTo(nextStepId(steps, step, state));
      break;
    case 'guide_repeat': {
      const target = next.stepStates[command.stepId];
      if (target) next.stepStates[command.stepId] = { ...target, status: 'active', answers: {}, measurements: [], choice: undefined, inputs: undefined, explanation: undefined, toolSelected: undefined, toolCorrect: undefined, attempts: target.attempts };
      next.guideCommands.push({ type: 'repeat', stepId: command.stepId, at: now });
      next.currentStepId = command.stepId;
      next.status = statusForStep(steps.find((s) => s.id === command.stepId));
      break;
    }
    case 'guide_goto':
      next.guideCommands.push({ type: 'goto', stepId: command.stepId, at: now });
      goTo(command.stepId);
      break;
    case 'guide_hints':
      state.guideHints = command.mode;
      next.guideCommands.push({ type: `hints:${command.mode}`, stepId: step.id, at: now });
      break;
    case 'guide_rubric':
      evidence.push(makeEvidence({ missionId: mission.id, sessionId: session.id, stepId: command.stepId, type: 'guide_rubric_scored', exerciseId: command.exerciseId, nodeId: command.nodeId, dimension: 'recognition_explanation', score: command.score, result: command.score >= 0.5 ? 'correct' : 'partial', autonomy: 1, depth: session.selectedDepth, discriminator: `rubric:${Math.round(command.score * 100)}` }, ctx));
      next.guideCommands.push({ type: 'rubric', stepId: command.stepId, at: now });
      break;
  }
  return { session: next, evidence, completedMission };
}

export function currentStep(mission: MissionDefinition, session: MissionSession): StepDefinition | undefined {
  return stepsForVariant(mission, session.variantId).find((s) => s.id === session.currentStepId);
}

export function sessionProgress(mission: MissionDefinition, session: MissionSession): { index: number; total: number } {
  const steps = stepsForVariant(mission, session.variantId);
  return { index: Math.max(0, steps.findIndex((s) => s.id === session.currentStepId)) + 1, total: steps.length };
}
