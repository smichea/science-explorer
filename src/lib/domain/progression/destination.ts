import type { CompiledNode, HorizonConfig } from '../../content-schema';
import type { GraphIndex } from '../graph';
import { bandOf, nodeStage, type Band, type Horizon } from '../horizon';
import { satisfiesPrerequisite, type ProgressionSnapshot } from './index';

/** Visual states of PRODUCT_SPECIFICATION §9.5, derived from graph + horizon + progression + planning. */
export type DestinationStateKind =
  | 'unknown'
  | 'in_horizon'
  | 'ready'
  | 'missing_recommended'
  | 'missing_essential'
  | 'discovered'
  | 'practised'
  | 'mastered'
  | 'due_for_review'
  | 'saved'
  | 'in_progress';

export interface DestinationState {
  kind: DestinationStateKind;
  band: Band;
  missingEssential: CompiledNode[];
  missingRecommended: CompiledNode[];
  saved: boolean;
  inProgress: boolean;
  silhouette: boolean;
}

export interface DestinationContext {
  graph: GraphIndex;
  config: HorizonConfig;
  horizon: Horizon;
  snapshot: ProgressionSnapshot | null;
  savedForLater: string[];
  openMissionIds: string[];
}

export function destinationState(node: CompiledNode, ctx: DestinationContext): DestinationState {
  const { graph, config, horizon, snapshot } = ctx;
  const band = bandOf(nodeStage(node, config), horizon, config);
  const { essential, recommended } = graph.prerequisitesOf(node.id);
  const status = (id: string) => snapshot?.nodeStates.get(id)?.status ?? 'unknown';
  const missingEssential = essential.filter((p) => !satisfiesPrerequisite(status(p.id)));
  const missingRecommended = recommended.filter((p) => !satisfiesPrerequisite(status(p.id)));
  const saved = ctx.savedForLater.includes(node.id);
  const inProgress = node.type === 'mission' ? ctx.openMissionIds.includes(node.id) : ctx.openMissionIds.some((m) => graph.getMission(m)?.learning.nodesAssessed.includes(node.id) || graph.getMission(m)?.learning.toolsIntroduced.includes(node.id));
  const own = snapshot?.nodeStates.get(node.id);
  let kind: DestinationStateKind = 'unknown';
  if (own?.reviewRecommended) kind = 'due_for_review';
  else if (own?.status === 'mastered') kind = 'mastered';
  else if (own?.status === 'practised') kind = 'practised';
  else if (own?.status === 'discovered' || own?.status === 'seen') kind = 'discovered';
  else if (missingEssential.length > 0) kind = 'missing_essential';
  else if (missingRecommended.length > 0) kind = 'missing_recommended';
  else if (essential.length + recommended.length > 0 || node.type === 'mission') kind = 'ready';
  else if (band === 'current' || band === 'next' || band === 'final') kind = 'in_horizon';
  if (inProgress && (kind === 'unknown' || kind === 'ready' || kind === 'in_horizon' || kind === 'discovered')) kind = 'in_progress';
  if (saved && (kind === 'unknown' || kind === 'in_horizon' || kind === 'ready')) kind = 'saved';
  return { kind, band, missingEssential, missingRecommended, saved, inProgress, silhouette: false };
}
