import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { makeEvidence } from '../../src/lib/domain/evidence';
import { buildProfile } from '../../src/lib/domain/profile';
import { resetDbForTests } from '../../src/lib/persistence/db';
import type { MissionSession } from '../../src/lib/persistence/db';
import {
  readProfileIndex,
  setStorage,
  upsertProfileSummary,
  type StorageLike,
} from '../../src/lib/persistence/localStorage';
import {
  evidenceRepo,
  profileRepo,
  sessionRepo,
  settingsRepo,
} from '../../src/lib/persistence/repositories';
import { loadPackage } from './helpers';

const pkg = loadPackage();

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDbForTests();
  setStorage(new MemoryStorage());
});

function session(learnerId: string): MissionSession {
  return {
    id: 'session.1',
    learnerId,
    missionId: 'mission.galileo.inclined_plane',
    missionVersion: 1,
    contentPackageVersion: '0.1.0',
    locale: 'fr',
    selectedDepth: 1,
    variantId: 'terminale',
    currentStepId: 'arrival',
    status: 'briefing',
    branchHistory: [],
    stepStates: {},
    guideCommands: [],
    startedAt: 'a',
    updatedAt: 'b',
    simulationSnapshotIds: [],
  };
}

describe('persistence', () => {
  it('keeps the profile index in localStorage and the record in IndexedDB', async () => {
    const profile = buildProfile({ name: 'Paul', age: 17, locale: 'fr' }, pkg.horizon, '0.1.0');
    await profileRepo.put(profile);
    upsertProfileSummary({
      id: profile.id,
      name: profile.name,
      age: profile.age,
      preferredLocale: 'fr',
      lastOpenedAt: 'now',
    });
    expect(readProfileIndex().profiles.map((p) => p.id)).toEqual([profile.id]);
    expect((await profileRepo.get(profile.id))?.name).toBe('Paul');
  });

  it('commits a step atomically and never stores the same idempotency key twice', async () => {
    const learnerId = 'learner.test';
    const s = session(learnerId);
    const ctx = { learnerId, contentVersion: '0.1.0' };
    const e1 = makeEvidence({ type: 'mission_started', sessionId: s.id, stepId: 'arrival' }, ctx);
    const e1bis = makeEvidence(
      { type: 'mission_started', sessionId: s.id, stepId: 'arrival' },
      ctx
    );
    const first = await sessionRepo.commitStep(s, [e1]);
    const second = await sessionRepo.commitStep({ ...s, updatedAt: 'c' }, [e1bis]);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(await evidenceRepo.listByLearner(learnerId)).toHaveLength(1);
    expect((await sessionRepo.get(s.id))?.updatedAt).toBe('c');
    expect((await sessionRepo.findOpen(learnerId, s.missionId))?.id).toBe(s.id);
  });

  it('deletes a profile with every record that belongs to it', async () => {
    const profile = buildProfile({ name: 'Paul', age: 17, locale: 'fr' }, pkg.horizon, '0.1.0');
    await profileRepo.put(profile);
    await settingsRepo.put({ learnerId: profile.id, savedForLater: [], updatedAt: 'x' });
    await sessionRepo.commitStep(session(profile.id), [
      makeEvidence(
        { type: 'mission_started', sessionId: 'session.1', stepId: 'arrival' },
        { learnerId: profile.id, contentVersion: '0.1.0' }
      ),
    ]);
    await profileRepo.deleteCascade(profile.id);
    expect(await profileRepo.get(profile.id)).toBeUndefined();
    expect(await evidenceRepo.listByLearner(profile.id)).toHaveLength(0);
    expect(await sessionRepo.listByLearner(profile.id)).toHaveLength(0);
  });
});
