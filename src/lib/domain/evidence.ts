import type { EvidenceType, MasteryDimension } from '../content-schema/common';
import type { EvidenceEvent } from '../persistence/db';
import { newId } from '../persistence/ids';

export interface EvidenceDraft {
  type: EvidenceType;
  missionId?: string;
  sessionId?: string;
  stepId?: string;
  exerciseId?: string;
  nodeId?: string;
  phenomenonId?: string;
  result?: EvidenceEvent['result'];
  score?: number;
  autonomy?: number;
  depth?: number;
  dimension?: MasteryDimension;
  review?: boolean;
  payload?: unknown;
  /** Distinguishes repeated events of the same type in the same step (attempt number, hint id, measurement index…). */
  discriminator?: string;
}

export interface EvidenceContext {
  learnerId: string;
  contentVersion: string;
  now?: Date;
}

/**
 * Idempotency key: session + step + type (+ discriminator). Locale is never part of it, so a
 * language switch, a re-render or a resume can never duplicate evidence (§10.3 architecture).
 */
export function idempotencyKey(draft: EvidenceDraft, learnerId: string): string {
  const scope = draft.sessionId ?? `learner:${learnerId}`;
  return [scope, draft.stepId ?? '-', draft.type, draft.exerciseId ?? '', draft.nodeId ?? '', draft.phenomenonId ?? '', draft.discriminator ?? ''].join(':');
}

export function makeEvidence(draft: EvidenceDraft, ctx: EvidenceContext): EvidenceEvent {
  const { discriminator: _d, ...rest } = draft;
  return {
    id: newId('evidence'),
    idempotencyKey: idempotencyKey(draft, ctx.learnerId),
    learnerId: ctx.learnerId,
    timestamp: (ctx.now ?? new Date()).toISOString(),
    contentVersion: ctx.contentVersion,
    ...rest,
  };
}

/** Autonomy coefficient from the hints opened on a step (§10.4: guided 0.4, significant hints 0.6, light 0.8, autonomous 1). */
export function autonomyFromHints(hintsOpened: number, guideRevealed = false): number {
  if (guideRevealed) return 0.4;
  if (hintsOpened <= 0) return 1;
  if (hintsOpened === 1) return 0.8;
  return 0.6;
}
