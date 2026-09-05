import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { EvidenceType, Locale, MasteryDimension } from '../content-schema/common';
import type { Stage } from '../content-schema/common';

export const DB_NAME = 'science-explorer';
export const DB_VERSION = 1;

// ---------------------------------------------------------------------------
// Record types (source data and derived caches)
// ---------------------------------------------------------------------------

export interface LearnerProfile {
  id: string;
  name: string;
  age: number;
  ageConfirmedAt: string;
  createdAt: string;
  updatedAt: string;
  preferredLocale: Locale;
  inferredStage: Stage;
  stageOverride?: Stage;
  horizonYears: 2 | 3;
  curriculumPathId: string;
  targetIds: string[];
  contentVersion: string;
}

export interface ProfileSettings {
  learnerId: string;
  guidePinHash?: string;
  guidePinSalt?: string;
  savedForLater: string[];
  lastVisited?: { kind: 'node' | 'mission'; id: string; at: string };
  updatedAt: string;
}

export type MissionSessionStatus =
  | 'not_started'
  | 'briefing'
  | 'active_step'
  | 'awaiting_prediction'
  | 'running_simulation'
  | 'awaiting_response'
  | 'paused'
  | 'completed'
  | 'abandoned';

export interface StepState {
  status: 'pending' | 'active' | 'completed' | 'skipped';
  attempts: number;
  hintsOpened: string[];
  guideHints?: 'revealed' | 'withheld';
  choice?: string;
  inputs?: Record<string, number | string>;
  answers?: Record<string, { correct: boolean; score: number; attempts: number; value: unknown }>;
  measurements?: Array<{ t: number; value: number; label?: string }>;
  parameterChanges?: number;
  explanation?: string;
  toolSelected?: string;
  toolCorrect?: boolean;
  completedAt?: string;
}

export interface MissionSession {
  id: string;
  learnerId: string;
  missionId: string;
  missionVersion: number;
  contentPackageVersion: string;
  locale: Locale;
  selectedDepth: number;
  variantId: string;
  currentStepId: string;
  status: MissionSessionStatus;
  branchHistory: string[];
  stepStates: Record<string, StepState>;
  guideCommands: Array<{ type: string; stepId?: string; at: string }>;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  simulationSnapshotIds: string[];
}

export interface EvidenceEvent {
  id: string;
  idempotencyKey: string;
  learnerId: string;
  timestamp: string;
  missionId?: string;
  sessionId?: string;
  stepId?: string;
  exerciseId?: string;
  nodeId?: string;
  phenomenonId?: string;
  type: EvidenceType;
  result?: 'correct' | 'incorrect' | 'partial' | 'n/a';
  score?: number;
  autonomy?: number;
  depth?: number;
  dimension?: MasteryDimension;
  review?: boolean;
  payload?: unknown;
  contentVersion: string;
}

export interface JournalEntry {
  id: string;
  learnerId: string;
  at: string;
  kind: 'note' | 'guide' | 'mission' | 'import' | 'export';
  text: string;
  refId?: string;
}

export interface CacheRecord<T> {
  key: string;
  learnerId: string;
  algorithmVersion: string;
  computedAt: string;
  value: T;
}

export interface ContentPackageRecord {
  key: string;
  id: string;
  version: string;
  installedAt: string;
  state: 'bundled' | 'downloaded';
}

export interface SimulationSnapshot {
  id: string;
  sessionId: string;
  simulationId: string;
  state: unknown;
  at: string;
}

export interface ExportMetadata {
  id: string;
  learnerId: string;
  kind: 'export' | 'import';
  at: string;
  note?: string;
}

export interface MigrationRecord {
  version: number;
  appliedAt: string;
}

interface ScienceExplorerDB extends DBSchema {
  profiles: { key: string; value: LearnerProfile };
  profileSettings: { key: string; value: ProfileSettings };
  missionSessions: {
    key: string;
    value: MissionSession;
    indexes: { byLearner: string; byLearnerMission: [string, string] };
  };
  evidenceEvents: {
    key: string;
    value: EvidenceEvent;
    indexes: {
      byLearner: string;
      byLearnerNode: [string, string];
      bySession: string;
      byIdempotency: string;
    };
  };
  nodeStateCache: { key: string; value: CacheRecord<unknown>; indexes: { byLearner: string } };
  toolApplicationCache: {
    key: string;
    value: CacheRecord<unknown>;
    indexes: { byLearner: string };
  };
  masteryCache: { key: string; value: CacheRecord<unknown>; indexes: { byLearner: string } };
  journalEntries: { key: string; value: JournalEntry; indexes: { byLearner: string } };
  contentPackages: { key: string; value: ContentPackageRecord };
  contentAssets: { key: string; value: { id: string; blob: Blob } };
  simulationSnapshots: { key: string; value: SimulationSnapshot; indexes: { bySession: string } };
  exportsMetadata: { key: string; value: ExportMetadata };
  migrations: { key: number; value: MigrationRecord };
}

export type Database = IDBPDatabase<ScienceExplorerDB>;

let dbPromise: Promise<Database> | null = null;

/** Opens (and migrates) the local database. Migrations are an explicit, ordered list. */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = openDB<ScienceExplorerDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          db.createObjectStore('profiles', { keyPath: 'id' });
          db.createObjectStore('profileSettings', { keyPath: 'learnerId' });
          const sessions = db.createObjectStore('missionSessions', { keyPath: 'id' });
          sessions.createIndex('byLearner', 'learnerId');
          sessions.createIndex('byLearnerMission', ['learnerId', 'missionId']);
          const evidence = db.createObjectStore('evidenceEvents', { keyPath: 'id' });
          evidence.createIndex('byLearner', 'learnerId');
          evidence.createIndex('byLearnerNode', ['learnerId', 'nodeId']);
          evidence.createIndex('bySession', 'sessionId');
          evidence.createIndex('byIdempotency', 'idempotencyKey', { unique: true });
          for (const name of ['nodeStateCache', 'toolApplicationCache', 'masteryCache'] as const) {
            const cache = db.createObjectStore(name, { keyPath: 'key' });
            cache.createIndex('byLearner', 'learnerId');
          }
          const journal = db.createObjectStore('journalEntries', { keyPath: 'id' });
          journal.createIndex('byLearner', 'learnerId');
          db.createObjectStore('contentPackages', { keyPath: 'key' });
          db.createObjectStore('contentAssets', { keyPath: 'id' });
          const snapshots = db.createObjectStore('simulationSnapshots', { keyPath: 'id' });
          snapshots.createIndex('bySession', 'sessionId');
          db.createObjectStore('exportsMetadata', { keyPath: 'id' });
          const migrations = db.createObjectStore('migrations', { keyPath: 'version' });
          migrations.put({ version: 1, appliedAt: new Date().toISOString() });
        }
        void tx;
      },
    });
  }
  return dbPromise;
}

/** Used by tests to reopen a fresh database. */
export function resetDbForTests(): void {
  dbPromise = null;
}
