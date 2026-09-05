import { z } from 'zod';
import type {
  EvidenceEvent,
  JournalEntry,
  LearnerProfile,
  MissionSession,
  ProfileSettings,
} from '../../persistence/db';
import { newId } from '../../persistence/ids';

export const EXPORT_FORMAT = 'science-explorer-progress';
export const EXPORT_FORMAT_VERSION = 1;
export const APPLICATION_VERSION = '0.1.0';
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** Versioned export envelope (TECHNICAL_ARCHITECTURE §6.5). Derived caches are omitted. */
export interface ProgressExport {
  format: typeof EXPORT_FORMAT;
  formatVersion: number;
  exportedAt: string;
  applicationVersion: string;
  contentVersions: string[];
  profile: LearnerProfile;
  profileSettings: Omit<ProfileSettings, 'guidePinHash' | 'guidePinSalt'>;
  missionSessions: MissionSession[];
  evidenceEvents: EvidenceEvent[];
  journalEntries: JournalEntry[];
}

export function buildExport(input: {
  profile: LearnerProfile;
  settings: ProfileSettings;
  sessions: MissionSession[];
  evidence: EvidenceEvent[];
  journal: JournalEntry[];
  contentVersion: string;
  now?: Date;
}): ProgressExport {
  const { guidePinHash: _h, guidePinSalt: _s, ...settings } = input.settings;
  const versions = new Set<string>([
    input.contentVersion,
    ...input.evidence.map((e) => e.contentVersion),
  ]);
  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    applicationVersion: APPLICATION_VERSION,
    contentVersions: [...versions],
    profile: input.profile,
    profileSettings: settings,
    missionSessions: input.sessions,
    evidenceEvents: input.evidence,
    journalEntries: input.journal,
  };
}

const Loose = z.looseObject({});
const EnvelopeSchema = z.looseObject({
  format: z.literal(EXPORT_FORMAT),
  formatVersion: z.number().int().min(1).max(EXPORT_FORMAT_VERSION),
  exportedAt: z.string(),
  applicationVersion: z.string(),
  contentVersions: z.array(z.string()).default([]),
  profile: z.looseObject({
    id: z.string().min(1),
    name: z.string().min(1),
    age: z.number().int().min(1),
    preferredLocale: z.enum(['fr', 'en']),
  }),
  profileSettings: Loose.optional(),
  missionSessions: z
    .array(z.looseObject({ id: z.string(), learnerId: z.string(), missionId: z.string() }))
    .default([]),
  evidenceEvents: z
    .array(
      z.looseObject({
        id: z.string(),
        idempotencyKey: z.string(),
        learnerId: z.string(),
        type: z.string(),
        timestamp: z.string(),
      })
    )
    .default([]),
  journalEntries: z
    .array(
      z.looseObject({
        id: z.string(),
        learnerId: z.string(),
        at: z.string(),
        kind: z.string(),
        text: z.string(),
      })
    )
    .default([]),
});

export interface ImportPreview {
  ok: true;
  data: ProgressExport;
  learner: { id: string; name: string; age: number };
  counts: { sessions: number; evidence: number; journal: number };
  contentVersions: string[];
  unknownNodeIds: string[];
  conflict: boolean;
}

export interface ImportFailure {
  ok: false;
  reason: 'too_large' | 'invalid';
  detail?: string;
}

/** Validates an export file and describes what it contains before anything is written. */
export function previewImport(
  text: string,
  knownNodeIds: Set<string>,
  existingProfileIds: string[]
): ImportPreview | ImportFailure {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, reason: 'too_large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid', detail: 'json' };
  }
  const parsed = EnvelopeSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, reason: 'invalid', detail: z.prettifyError(parsed.error) };
  const data = parsed.data as unknown as ProgressExport;
  // Reject anything that looks executable: exports carry data only.
  const serialised = JSON.stringify(data);
  if (/<script|javascript:/i.test(serialised))
    return { ok: false, reason: 'invalid', detail: 'executable content' };
  const unknown = new Set<string>();
  for (const e of data.evidenceEvents) {
    if (e.nodeId && !knownNodeIds.has(e.nodeId)) unknown.add(e.nodeId);
    if (e.phenomenonId && !knownNodeIds.has(e.phenomenonId)) unknown.add(e.phenomenonId);
  }
  return {
    ok: true,
    data,
    learner: { id: data.profile.id, name: data.profile.name, age: data.profile.age },
    counts: {
      sessions: data.missionSessions.length,
      evidence: data.evidenceEvents.length,
      journal: data.journalEntries.length,
    },
    contentVersions: data.contentVersions,
    unknownNodeIds: [...unknown],
    conflict: existingProfileIds.includes(data.profile.id),
  };
}

export interface ImportPlan {
  profile: LearnerProfile;
  settings: ProfileSettings;
  sessions: MissionSession[];
  evidence: EvidenceEvent[];
  journal: JournalEntry[];
}

/** Restores as a separate profile: every identifier is re-keyed to the new learner. */
export function planCreateNew(data: ProgressExport, now = new Date()): ImportPlan {
  const learnerId = newId('learner');
  const at = now.toISOString();
  const sessionIds = new Map<string, string>();
  for (const s of data.missionSessions) sessionIds.set(s.id, newId('session'));
  const profile: LearnerProfile = { ...data.profile, id: learnerId, updatedAt: at };
  const settings: ProfileSettings = {
    learnerId,
    savedForLater: data.profileSettings?.savedForLater ?? [],
    lastVisited: data.profileSettings?.lastVisited,
    updatedAt: at,
  };
  const sessions = data.missionSessions.map((s) => ({
    ...s,
    id: sessionIds.get(s.id)!,
    learnerId,
  }));
  const evidence = data.evidenceEvents.map((e) => ({
    ...e,
    id: newId('evidence'),
    learnerId,
    sessionId: e.sessionId ? (sessionIds.get(e.sessionId) ?? e.sessionId) : undefined,
    idempotencyKey: `${learnerId}:${e.idempotencyKey}`,
  }));
  const journal = data.journalEntries.map((j) => ({ ...j, id: newId('journal'), learnerId }));
  return { profile, settings, sessions, evidence, journal };
}

/** Merges into the same profile: union of evidence by idempotency key, newest session state wins. */
export function planMerge(
  data: ProgressExport,
  existing: {
    profile: LearnerProfile;
    settings: ProfileSettings;
    sessions: MissionSession[];
    evidence: EvidenceEvent[];
    journal: JournalEntry[];
  }
): ImportPlan {
  const keys = new Set(existing.evidence.map((e) => e.idempotencyKey));
  const evidence = data.evidenceEvents
    .filter((e) => !keys.has(e.idempotencyKey))
    .map((e) => ({ ...e, learnerId: existing.profile.id }));
  const sessions: MissionSession[] = [];
  for (const imported of data.missionSessions) {
    const local = existing.sessions.find((s) => s.id === imported.id);
    if (!local || local.updatedAt < imported.updatedAt)
      sessions.push({ ...imported, learnerId: existing.profile.id });
  }
  const journalIds = new Set(existing.journal.map((j) => j.id));
  const journal = data.journalEntries
    .filter((j) => !journalIds.has(j.id))
    .map((j) => ({ ...j, learnerId: existing.profile.id }));
  const settings: ProfileSettings = {
    ...existing.settings,
    savedForLater: [
      ...new Set([
        ...existing.settings.savedForLater,
        ...(data.profileSettings?.savedForLater ?? []),
      ]),
    ],
  };
  return { profile: existing.profile, settings, sessions, evidence, journal };
}
