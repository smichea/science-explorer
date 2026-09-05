import type { CompiledNode, HorizonConfig, HorizonRule, Stage } from '../content-schema';
import type { LearnerProfile } from '../persistence/db';

export interface Horizon {
  currentStage: Stage;
  horizonYears: 2 | 3;
  pathId: string;
  /** Ordered stages highlighted for the learner (current stage first). */
  stages: Stage[];
  targets: Array<{ id: string; title: { fr: string; en: string } }>;
  note?: { fr: string; en: string };
  overridden: boolean;
}

export type Band = 'foundation' | 'current' | 'next' | 'final' | 'beyond';

export const BAND_EMPHASIS: Record<Band, number> = {
  current: 1,
  next: 0.82,
  final: 0.66,
  foundation: 0.75,
  beyond: 0.38,
};

export type MapFilter =
  'my_horizon' | 'ready' | 'current_stage' | 'terminale' | 'mpsi' | 'mp' | 'entire';
export const MAP_FILTERS: MapFilter[] = [
  'my_horizon',
  'ready',
  'current_stage',
  'terminale',
  'mpsi',
  'mp',
  'entire',
];

export type MapLayer =
  'concepts' | 'applications' | 'history' | 'progress' | 'prerequisites' | 'curriculum';
export const MAP_LAYERS: MapLayer[] = [
  'concepts',
  'applications',
  'history',
  'progress',
  'prerequisites',
  'curriculum',
];

export function stageIndex(stage: Stage, config: HorizonConfig): number {
  return config.stages.find((s) => s.id === stage)?.order ?? -1;
}

export function findRule(age: number, config: HorizonConfig): HorizonRule {
  const rule = config.rules.find((r) => age >= r.ageMin && age <= r.ageMax);
  return rule ?? config.rules[config.rules.length - 1];
}

function buildHorizon(
  currentStage: Stage,
  years: 2 | 3,
  pathId: string,
  config: HorizonConfig,
  overridden: boolean,
  note?: HorizonRule['note']
): Horizon {
  const path = config.paths.find((p) => p.id === pathId) ?? config.paths[0];
  const start = Math.max(0, path.stages.indexOf(currentStage));
  let stages = path.stages.slice(start, start + years);
  if (stages.length === 0) stages = [currentStage];
  return {
    currentStage,
    horizonYears: years,
    pathId: path.id,
    stages,
    targets: path.targets,
    note,
    overridden,
  };
}

/** Infers the default stage and highlighted route from the learner's age (data-driven, §5.2 architecture). */
export function inferHorizon(age: number, config: HorizonConfig): Horizon {
  const rule = findRule(age, config);
  return buildHorizon(
    rule.currentStage,
    rule.defaultHorizonYears,
    rule.pathId,
    config,
    false,
    rule.note
  );
}

/** Applies the guide's stage override when present: the path containing that stage is used. */
export function effectiveHorizon(
  profile: Pick<
    LearnerProfile,
    'age' | 'stageOverride' | 'horizonYears' | 'curriculumPathId' | 'inferredStage'
  >,
  config: HorizonConfig
): Horizon {
  if (!profile.stageOverride || profile.stageOverride === profile.inferredStage) {
    const inferred = inferHorizon(profile.age, config);
    return { ...inferred, currentStage: profile.inferredStage, overridden: false };
  }
  const override = profile.stageOverride;
  const rule = config.rules.find((r) => r.currentStage === override);
  const pathId =
    config.paths.find((p) => p.id === profile.curriculumPathId && p.stages.includes(override))
      ?.id ??
    rule?.pathId ??
    config.paths.find((p) => p.stages.includes(override))?.id ??
    profile.curriculumPathId;
  return buildHorizon(
    override,
    rule?.defaultHorizonYears ?? profile.horizonYears,
    pathId,
    config,
    true,
    rule?.note
  );
}

/** Lowest stage at which a node is taught, or null when it has no curriculum depth (bridges, history). */
export function nodeStage(node: CompiledNode, config: HorizonConfig): Stage | null {
  if (node.depths.length === 0) return null;
  return node.depths.reduce<Stage>(
    (best, d) => (stageIndex(d.stage, config) < stageIndex(best, config) ? d.stage : best),
    node.depths[0].stage
  );
}

export function bandOf(stage: Stage | null, horizon: Horizon, config: HorizonConfig): Band {
  if (stage === null) return 'current';
  const s = stageIndex(stage, config);
  const current = stageIndex(horizon.currentStage, config);
  if (s < current) return 'foundation';
  if (s === current) return 'current';
  const position = horizon.stages.indexOf(stage);
  if (position === 1) return 'next';
  if (position > 1 && position === horizon.stages.length - 1) return 'final';
  if (position > 1) return 'next';
  return 'beyond';
}

/** Emphasis in [0, 1] used identically by the 3D atlas and the 2D map: filters change emphasis, never geography. */
export function emphasisFor(
  stage: Stage | null,
  horizon: Horizon,
  filter: MapFilter,
  config: HorizonConfig,
  ready = true
): number {
  const band = bandOf(stage, horizon, config);
  switch (filter) {
    case 'entire':
      return 1;
    case 'my_horizon':
      return BAND_EMPHASIS[band];
    case 'current_stage':
      return band === 'current' ? 1 : 0.35;
    case 'ready':
      return ready ? 1 : 0.3;
    case 'terminale':
    case 'mpsi':
    case 'mp':
      return stage === filter || stage === null ? 1 : 0.3;
    default:
      return 1;
  }
}
