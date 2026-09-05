import type { CompiledNode, HorizonConfig, MasteryDimension, Stage } from '../../content-schema';
import type { EvidenceEvent } from '../../persistence/db';
import type { GraphIndex } from '../graph';
import { nodeStage, stageIndex, type Horizon } from '../horizon';

export const COVERAGE_ALGORITHM = 'coverage-0.1';
export const MASTERY_ALGORITHM = 'mastery-0.1';
export const STATUS_ALGORITHM = 'status-0.1';

export const MASTERY_DIMENSIONS: MasteryDimension[] = [
  'recognition_explanation',
  'procedural_execution',
  'modelling_choice',
  'transfer',
  'retention',
];

/** Versioned weights (mastery-0.1). */
export const MASTERY_WEIGHTS: Record<MasteryDimension, number> = {
  recognition_explanation: 0.2,
  procedural_execution: 0.25,
  modelling_choice: 0.3,
  transfer: 0.2,
  retention: 0.05,
};

export type NodeStatus = 'unknown' | 'seen' | 'discovered' | 'practised' | 'mastered';
export type ConfidenceLabel = 'low' | 'developing' | 'solid' | 'established';
export type ApplicationStateKind = 'not_encountered' | 'observed' | 'guided' | 'hinted' | 'autonomous' | 'transferred' | 'retained';

export interface MasteryEstimate {
  estimate: number;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  dimensions: Record<MasteryDimension, number>;
  evidenceCount: number;
  contexts: number;
  algorithmVersion: string;
}

export interface NodeState {
  nodeId: string;
  status: NodeStatus;
  firstSeenAt?: string;
  discoveredAt?: string;
  lastUsedAt?: string;
  lastSuccessAt?: string;
  lastIndependentUseAt?: string;
  highestDepthVisited: number;
  mastery: MasteryEstimate;
  reviewRecommended: boolean;
  evidenceCount: number;
  algorithmVersion: string;
}

export interface ApplicationState {
  phenomenonId: string;
  weight: number;
  value: number;
  state: ApplicationStateKind;
  lastAt?: string;
}

export interface CoverageEstimate {
  toolId: string;
  estimate: number;
  appliedCount: number;
  eligibleCount: number;
  scope: Stage[];
  applications: ApplicationState[];
  algorithmVersion: string;
}

export interface ExplanationItem {
  eventId: string;
  at: string;
  type: string;
  dimension?: MasteryDimension;
  phenomenonId?: string;
  score: number;
  autonomy: number;
  recency: number;
  contribution: number;
}

const SUCCESS_TYPES = new Set(['exercise_solved', 'tool_selected_for_model', 'transfer_completed']);
const DISCOVERY_TYPES = new Set(['prediction_recorded', 'measurement_recorded', 'mission_completed', 'worked_example_observed', 'explanation_submitted', 'exercise_attempted', 'mission_started', 'hint_opened', 'simulation_parameter_changed', 'guide_rubric_scored']);
const NEUTRAL_TYPES = new Set(['node_opened', 'hint_opened', 'simulation_parameter_changed', 'mission_started', 'prediction_recorded', 'measurement_recorded', 'mission_completed']);

/** Score in [0, 1] carried by an event (correct 1, partial its score, incorrect 0). */
export function scoreOf(e: EvidenceEvent): number | null {
  if (NEUTRAL_TYPES.has(e.type)) return null;
  if (typeof e.score === 'number') return Math.max(0, Math.min(1, e.score));
  if (e.result === 'correct') return 1;
  if (e.result === 'partial') return 0.5;
  if (e.result === 'incorrect') return 0;
  if (e.type === 'explanation_submitted') return 0.5;
  if (e.type === 'worked_example_observed') return 0.2;
  return null;
}

export function dimensionOf(e: EvidenceEvent): MasteryDimension | null {
  if (e.dimension) return e.dimension;
  switch (e.type) {
    case 'tool_selected_for_model':
      return 'modelling_choice';
    case 'transfer_completed':
      return 'transfer';
    case 'explanation_submitted':
    case 'guide_rubric_scored':
      return 'recognition_explanation';
    case 'exercise_solved':
    case 'exercise_attempted':
      return 'procedural_execution';
    default:
      return null;
  }
}

export function confidenceLabel(c: number): ConfidenceLabel {
  if (c < 0.25) return 'low';
  if (c < 0.55) return 'developing';
  if (c < 0.8) return 'solid';
  return 'established';
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

const emptyMastery = (): MasteryEstimate => ({
  estimate: 0,
  confidence: 0,
  confidenceLabel: 'low',
  dimensions: { recognition_explanation: 0, procedural_execution: 0, modelling_choice: 0, transfer: 0, retention: 0 },
  evidenceCount: 0,
  contexts: 0,
  algorithmVersion: MASTERY_ALGORITHM,
});

/**
 * mastery-0.1: per dimension, recent evidence weighted by recency (0.85^rank) and autonomy;
 * headline = weighted sum of the five dimensions; a dimension without evidence counts 0, so one
 * correct answer can never look like reliable mastery. Returns the explanation trace too.
 */
export function computeMastery(events: EvidenceEvent[], now: Date): { mastery: MasteryEstimate; explanation: ExplanationItem[] } {
  const scored = events
    .map((e) => ({ e, score: scoreOf(e), dimension: dimensionOf(e) }))
    .filter((x): x is { e: EvidenceEvent; score: number; dimension: MasteryDimension } => x.score !== null && x.dimension !== null)
    .sort((a, b) => b.e.timestamp.localeCompare(a.e.timestamp));
  if (scored.length === 0) return { mastery: emptyMastery(), explanation: [] };

  const mastery = emptyMastery();
  const explanation: ExplanationItem[] = [];
  for (const dim of MASTERY_DIMENSIONS) {
    let num = 0;
    let den = 0;
    let rank = 0;
    for (const item of scored) {
      const inDimension = item.dimension === dim || (dim === 'retention' && item.e.review === true && item.score >= 0.5);
      if (!inDimension) continue;
      const recency = Math.pow(0.85, rank++);
      const autonomy = item.e.autonomy ?? 1;
      num += recency * autonomy * item.score;
      den += recency;
      explanation.push({
        eventId: item.e.id,
        at: item.e.timestamp,
        type: item.e.type,
        dimension: dim,
        phenomenonId: item.e.phenomenonId,
        score: item.score,
        autonomy,
        recency,
        contribution: 0,
      });
    }
    mastery.dimensions[dim] = den > 0 ? num / den : 0;
  }
  mastery.estimate = MASTERY_DIMENSIONS.reduce((sum, d) => sum + MASTERY_WEIGHTS[d] * mastery.dimensions[d], 0);
  for (const item of explanation) {
    item.contribution = item.dimension ? MASTERY_WEIGHTS[item.dimension] * item.recency * item.autonomy * item.score : 0;
  }

  const n = scored.length;
  const contexts = new Set(scored.map((x) => x.e.phenomenonId).filter(Boolean)).size;
  const meanAutonomy = scored.reduce((s, x) => s + (x.e.autonomy ?? 1), 0) / n;
  const first = scored[scored.length - 1].e.timestamp;
  const firstTime = new Date(first).getTime();
  const reviewSuccess = scored.some((x) => x.e.review === true && x.score >= 0.5 && new Date(x.e.timestamp).getTime() - firstTime >= 7 * 86_400_000);
  const rubric = scored.some((x) => x.e.type === 'guide_rubric_scored');
  void now;
  const confidence = clamp01((1 - Math.exp(-n / 8)) * (0.5 + 0.5 * meanAutonomy) * (0.5 + 0.125 * Math.min(contexts, 4)) + (reviewSuccess ? 0.1 : 0) + (rubric ? 0.1 : 0));
  mastery.confidence = confidence;
  mastery.confidenceLabel = confidenceLabel(confidence);
  mastery.evidenceCount = n;
  mastery.contexts = contexts;
  return { mastery, explanation };
}

/** status-0.1 */
export function computeNodeState(nodeId: string, events: EvidenceEvent[], now: Date): NodeState {
  const own = events.filter((e) => e.nodeId === nodeId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const { mastery } = computeMastery(own, now);
  let status: NodeStatus = 'unknown';
  let firstSeenAt: string | undefined;
  let discoveredAt: string | undefined;
  let lastUsedAt: string | undefined;
  let lastSuccessAt: string | undefined;
  let lastIndependentUseAt: string | undefined;
  let highestDepthVisited = 0;
  for (const e of own) {
    firstSeenAt ??= e.timestamp;
    if (e.depth && e.depth > highestDepthVisited) highestDepthVisited = e.depth;
    if (e.type !== 'node_opened') {
      discoveredAt ??= e.timestamp;
      lastUsedAt = e.timestamp;
    }
    const score = scoreOf(e);
    if (SUCCESS_TYPES.has(e.type) && score !== null && score >= 0.5) {
      lastSuccessAt = e.timestamp;
      if ((e.autonomy ?? 1) >= 0.8) lastIndependentUseAt = e.timestamp;
    }
  }
  if (own.some((e) => e.type === 'node_opened')) status = 'seen';
  if (own.some((e) => DISCOVERY_TYPES.has(e.type) || SUCCESS_TYPES.has(e.type))) status = 'discovered';
  if (lastSuccessAt) status = 'practised';
  if (mastery.estimate >= 0.7 && mastery.confidence >= 0.55) status = 'mastered';
  let reviewRecommended = false;
  if ((status === 'practised' || status === 'mastered') && lastSuccessAt) {
    const age = now.getTime() - new Date(lastSuccessAt).getTime();
    const reviewedSince = own.some((e) => e.review === true && new Date(e.timestamp).getTime() > new Date(lastSuccessAt!).getTime() - 1);
    reviewRecommended = age > 21 * 86_400_000 && !reviewedSince;
  }
  return {
    nodeId,
    status,
    firstSeenAt,
    discoveredAt,
    lastUsedAt,
    lastSuccessAt,
    lastIndependentUseAt,
    highestDepthVisited,
    mastery,
    reviewRecommended,
    evidenceCount: own.length,
    algorithmVersion: STATUS_ALGORITHM,
  };
}

function usageValue(e: EvidenceEvent): number {
  const score = scoreOf(e);
  if (e.type === 'worked_example_observed') return 0.2;
  if (!SUCCESS_TYPES.has(e.type) || score === null || score < 0.5) return 0;
  if (e.review) return 1;
  return Math.max(0.4, Math.min(1, e.autonomy ?? 1));
}

function applicationKind(value: number, events: EvidenceEvent[]): ApplicationStateKind {
  if (value <= 0) return 'not_encountered';
  if (value < 0.4) return 'observed';
  if (events.some((e) => e.review && usageValue(e) >= 0.5)) return 'retained';
  if (events.some((e) => e.type === 'transfer_completed' && (e.autonomy ?? 1) >= 0.8 && usageValue(e) >= 0.5)) return 'transferred';
  if (value >= 1) return 'autonomous';
  if (value >= 0.6) return 'hinted';
  return 'guided';
}

/** Scope of coverage: every stage up to the end of the highlighted horizon (foundations included). */
export function coverageScope(horizon: Horizon, config: HorizonConfig): Stage[] {
  const maxIndex = Math.max(...horizon.stages.map((s) => stageIndex(s, config)));
  return config.stages.filter((s) => s.order <= maxIndex).map((s) => s.id);
}

/** coverage-0.1 */
export function computeCoverage(toolId: string, events: EvidenceEvent[], graph: GraphIndex, scope: Stage[], config: HorizonConfig): CoverageEstimate {
  const applications: ApplicationState[] = [];
  let num = 0;
  let den = 0;
  for (const { phenomenon, edge } of graph.getApplications(toolId)) {
    const stage = nodeStage(phenomenon, config);
    if (stage !== null && !scope.includes(stage)) continue;
    const related = events.filter((e) => e.nodeId === toolId && e.phenomenonId === phenomenon.id);
    let value = 0;
    let lastAt: string | undefined;
    for (const e of related) {
      const v = usageValue(e);
      if (v > 0) lastAt = !lastAt || e.timestamp > lastAt ? e.timestamp : lastAt;
      value = Math.max(value, v);
    }
    applications.push({ phenomenonId: phenomenon.id, weight: edge.weight, value, state: applicationKind(value, related), lastAt });
    num += edge.weight * value;
    den += edge.weight;
  }
  return {
    toolId,
    estimate: den > 0 ? num / den : 0,
    appliedCount: applications.filter((a) => a.value >= 0.4).length,
    eligibleCount: applications.length,
    scope,
    applications,
    algorithmVersion: COVERAGE_ALGORITHM,
  };
}

export interface ProgressionSnapshot {
  nodeStates: Map<string, NodeState>;
  coverage: Map<string, CoverageEstimate>;
  explanations: Map<string, ExplanationItem[]>;
  completedMissions: Set<string>;
  computedAt: string;
}

/** Recomputes every derived value from the evidence log (caches are disposable). */
export function computeProgression(events: EvidenceEvent[], graph: GraphIndex, config: HorizonConfig, horizon: Horizon, now = new Date()): ProgressionSnapshot {
  const nodeStates = new Map<string, NodeState>();
  const explanations = new Map<string, ExplanationItem[]>();
  const touched = new Set(events.map((e) => e.nodeId).filter((id): id is string => !!id));
  for (const id of touched) {
    const own = events.filter((e) => e.nodeId === id);
    nodeStates.set(id, computeNodeState(id, events, now));
    explanations.set(id, computeMastery(own, now).explanation);
  }
  const coverage = new Map<string, CoverageEstimate>();
  const scope = coverageScope(horizon, config);
  for (const node of graph.graph.nodes) {
    if (node.type === 'mathematical_tool') coverage.set(node.id, computeCoverage(node.id, events, graph, scope, config));
  }
  const completedMissions = new Set(events.filter((e) => e.type === 'mission_completed' && e.missionId).map((e) => e.missionId!));
  return { nodeStates, coverage, explanations, completedMissions, computedAt: now.toISOString() };
}

export function statusOf(snapshot: ProgressionSnapshot | null, nodeId: string): NodeStatus {
  return snapshot?.nodeStates.get(nodeId)?.status ?? 'unknown';
}

/** Whether a node counts as "known enough" to be a satisfied prerequisite. */
export function satisfiesPrerequisite(status: NodeStatus): boolean {
  return status === 'practised' || status === 'mastered';
}

export function nodeOfType(graph: GraphIndex, type: CompiledNode['type']): CompiledNode[] {
  return graph.graph.nodes.filter((n) => n.type === type);
}
