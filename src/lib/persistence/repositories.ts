import {
  getDb,
  type CacheRecord,
  type EvidenceEvent,
  type ExportMetadata,
  type JournalEntry,
  type LearnerProfile,
  type MissionSession,
  type ProfileSettings,
  type SimulationSnapshot,
} from './db';

type CacheStore = 'nodeStateCache' | 'toolApplicationCache' | 'masteryCache';

export const profileRepo = {
  async get(id: string): Promise<LearnerProfile | undefined> {
    return (await getDb()).get('profiles', id);
  },
  async list(): Promise<LearnerProfile[]> {
    return (await getDb()).getAll('profiles');
  },
  async put(profile: LearnerProfile): Promise<void> {
    await (await getDb()).put('profiles', profile);
  },
  /** Deletes the profile and every record that belongs to it. */
  async deleteCascade(learnerId: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(
      [
        'profiles',
        'profileSettings',
        'missionSessions',
        'evidenceEvents',
        'nodeStateCache',
        'toolApplicationCache',
        'masteryCache',
        'journalEntries',
        'simulationSnapshots',
      ],
      'readwrite'
    );
    await tx.objectStore('profiles').delete(learnerId);
    await tx.objectStore('profileSettings').delete(learnerId);
    const sessions = await tx
      .objectStore('missionSessions')
      .index('byLearner')
      .getAllKeys(learnerId);
    for (const key of sessions) {
      const snaps = await tx.objectStore('simulationSnapshots').index('bySession').getAllKeys(key);
      for (const s of snaps) await tx.objectStore('simulationSnapshots').delete(s);
      await tx.objectStore('missionSessions').delete(key);
    }
    for (const key of await tx
      .objectStore('evidenceEvents')
      .index('byLearner')
      .getAllKeys(learnerId))
      await tx.objectStore('evidenceEvents').delete(key);
    for (const store of ['nodeStateCache', 'toolApplicationCache', 'masteryCache'] as const) {
      for (const key of await tx.objectStore(store).index('byLearner').getAllKeys(learnerId))
        await tx.objectStore(store).delete(key);
    }
    for (const key of await tx
      .objectStore('journalEntries')
      .index('byLearner')
      .getAllKeys(learnerId))
      await tx.objectStore('journalEntries').delete(key);
    await tx.done;
  },
};

export const settingsRepo = {
  async get(learnerId: string): Promise<ProfileSettings> {
    const db = await getDb();
    return (
      (await db.get('profileSettings', learnerId)) ?? {
        learnerId,
        savedForLater: [],
        updatedAt: new Date(0).toISOString(),
      }
    );
  },
  async put(settings: ProfileSettings): Promise<void> {
    await (
      await getDb()
    ).put('profileSettings', { ...settings, updatedAt: new Date().toISOString() });
  },
};

export const sessionRepo = {
  async get(id: string): Promise<MissionSession | undefined> {
    return (await getDb()).get('missionSessions', id);
  },
  async listByLearner(learnerId: string): Promise<MissionSession[]> {
    return (await getDb()).getAllFromIndex('missionSessions', 'byLearner', learnerId);
  },
  async findOpen(learnerId: string, missionId: string): Promise<MissionSession | undefined> {
    const db = await getDb();
    const all = await db.getAllFromIndex('missionSessions', 'byLearnerMission', [
      learnerId,
      missionId,
    ]);
    return all
      .filter((s) => s.status !== 'completed' && s.status !== 'abandoned')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  },
  async put(session: MissionSession): Promise<void> {
    await (await getDb()).put('missionSessions', session);
  },
  /**
   * Atomic step commit (§6.4 architecture): session checkpoint + emitted evidence (+ snapshot) in one
   * transaction. Evidence with an existing idempotency key is skipped, so re-renders, resumes and
   * language switches never duplicate events.
   */
  async commitStep(
    session: MissionSession,
    evidence: EvidenceEvent[],
    snapshot?: SimulationSnapshot
  ): Promise<EvidenceEvent[]> {
    const db = await getDb();
    const tx = db.transaction(
      ['missionSessions', 'evidenceEvents', 'simulationSnapshots'],
      'readwrite'
    );
    const appended: EvidenceEvent[] = [];
    const evidenceStore = tx.objectStore('evidenceEvents');
    for (const event of evidence) {
      const existing = await evidenceStore.index('byIdempotency').get(event.idempotencyKey);
      if (existing) continue;
      await evidenceStore.put(event);
      appended.push(event);
    }
    if (snapshot) await tx.objectStore('simulationSnapshots').put(snapshot);
    await tx.objectStore('missionSessions').put(session);
    await tx.done;
    return appended;
  },
};

export const evidenceRepo = {
  async listByLearner(learnerId: string): Promise<EvidenceEvent[]> {
    const events = await (await getDb()).getAllFromIndex('evidenceEvents', 'byLearner', learnerId);
    return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  },
  async listBySession(sessionId: string): Promise<EvidenceEvent[]> {
    return (await getDb()).getAllFromIndex('evidenceEvents', 'bySession', sessionId);
  },
  /** Appends events, skipping idempotency-key collisions; returns the events actually stored. */
  async appendMany(events: EvidenceEvent[]): Promise<EvidenceEvent[]> {
    const db = await getDb();
    const tx = db.transaction('evidenceEvents', 'readwrite');
    const appended: EvidenceEvent[] = [];
    for (const event of events) {
      const existing = await tx.store.index('byIdempotency').get(event.idempotencyKey);
      if (existing) continue;
      await tx.store.put(event);
      appended.push(event);
    }
    await tx.done;
    return appended;
  },
};

export const cacheRepo = {
  async put<T>(store: CacheStore, record: CacheRecord<T>): Promise<void> {
    await (await getDb()).put(store, record as CacheRecord<unknown>);
  },
  async listByLearner<T>(store: CacheStore, learnerId: string): Promise<CacheRecord<T>[]> {
    return (await (
      await getDb()
    ).getAllFromIndex(store, 'byLearner', learnerId)) as CacheRecord<T>[];
  },
};

export const journalRepo = {
  async listByLearner(learnerId: string): Promise<JournalEntry[]> {
    const entries = await (await getDb()).getAllFromIndex('journalEntries', 'byLearner', learnerId);
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  },
  async put(entry: JournalEntry): Promise<void> {
    await (await getDb()).put('journalEntries', entry);
  },
  async delete(id: string): Promise<void> {
    await (await getDb()).delete('journalEntries', id);
  },
};

export const packageRepo = {
  async record(id: string, version: string): Promise<void> {
    const db = await getDb();
    const key = `${id}@${version}`;
    if (!(await db.get('contentPackages', key))) {
      await db.put('contentPackages', {
        key,
        id,
        version,
        installedAt: new Date().toISOString(),
        state: 'bundled',
      });
    }
  },
  async list() {
    return (await getDb()).getAll('contentPackages');
  },
};

export const exportsRepo = {
  async put(meta: ExportMetadata): Promise<void> {
    await (await getDb()).put('exportsMetadata', meta);
  },
};
