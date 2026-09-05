import { describe, expect, it } from 'vitest';
import {
  buildExport,
  planCreateNew,
  planMerge,
  previewImport,
} from '../../src/lib/domain/transfer';
import { makeEvidence } from '../../src/lib/domain/evidence';
import { buildProfile } from '../../src/lib/domain/profile';
import type { MissionSession, ProfileSettings } from '../../src/lib/persistence/db';
import { loadPackage } from './helpers';

const pkg = loadPackage();
const known = new Set(pkg.graph.nodes.map((n) => n.id));
const profile = buildProfile({ name: 'Paul', age: 17, locale: 'fr' }, pkg.horizon, '0.1.0');
const settings: ProfileSettings = {
  learnerId: profile.id,
  savedForLater: ['tool.gradient'],
  updatedAt: 'x',
  guidePinHash: 'secret',
  guidePinSalt: 's',
};
const session: MissionSession = {
  id: 'session.1',
  learnerId: profile.id,
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
const evidence = [
  makeEvidence(
    {
      type: 'mission_started',
      sessionId: session.id,
      stepId: 'arrival',
      missionId: session.missionId,
    },
    { learnerId: profile.id, contentVersion: '0.1.0' }
  ),
  makeEvidence(
    { type: 'node_opened', nodeId: 'tool.unknown_future' },
    { learnerId: profile.id, contentVersion: '0.2.0' }
  ),
];

describe('export / import', () => {
  const data = buildExport({
    profile,
    settings,
    sessions: [session],
    evidence,
    journal: [],
    contentVersion: '0.1.0',
  });

  it('exports a versioned envelope without the guide PIN', () => {
    expect(data.format).toBe('science-explorer-progress');
    expect(data.formatVersion).toBe(1);
    expect((data.profileSettings as ProfileSettings).guidePinHash).toBeUndefined();
    expect(data.contentVersions.sort()).toEqual(['0.1.0', '0.2.0']);
  });

  it('previews a valid file, detects conflicts and unknown references', () => {
    const preview = previewImport(JSON.stringify(data), known, [profile.id]);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.learner.name).toBe('Paul');
    expect(preview.counts).toEqual({ sessions: 1, evidence: 2, journal: 0 });
    expect(preview.conflict).toBe(true);
    expect(preview.unknownNodeIds).toEqual(['tool.unknown_future']);
    expect(
      previewImport(JSON.stringify(data), known, []).ok &&
        (previewImport(JSON.stringify(data), known, []) as { conflict: boolean }).conflict
    ).toBe(false);
  });

  it('rejects invalid, oversized or executable content', () => {
    expect(previewImport('{"format":"other"}', known, [])).toMatchObject({
      ok: false,
      reason: 'invalid',
    });
    expect(previewImport('not json', known, [])).toMatchObject({ ok: false, reason: 'invalid' });
    expect(previewImport('x'.repeat(21 * 1024 * 1024), known, [])).toMatchObject({
      ok: false,
      reason: 'too_large',
    });
    const evil = JSON.stringify({
      ...data,
      journalEntries: [
        { id: 'j', learnerId: 'l', at: 'a', kind: 'note', text: '<script>alert(1)</script>' },
      ],
    });
    expect(previewImport(evil, known, [])).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('re-keys everything when restoring as a separate explorer', () => {
    const plan = planCreateNew(data);
    expect(plan.profile.id).not.toBe(profile.id);
    expect(plan.sessions[0].learnerId).toBe(plan.profile.id);
    expect(plan.sessions[0].id).not.toBe(session.id);
    expect(plan.evidence[0].sessionId).toBe(plan.sessions[0].id);
    expect(plan.evidence[0].idempotencyKey.startsWith(plan.profile.id)).toBe(true);
    expect(plan.settings.savedForLater).toEqual(['tool.gradient']);
  });

  it('merges without duplicating evidence and keeps the newest session', () => {
    const existing = {
      profile,
      settings: { ...settings, savedForLater: ['concept.function'] },
      sessions: [{ ...session, updatedAt: 'z' }],
      evidence: [evidence[0]],
      journal: [],
    };
    const plan = planMerge(data, existing);
    expect(plan.evidence).toHaveLength(1);
    expect(plan.evidence[0].nodeId).toBe('tool.unknown_future');
    expect(plan.sessions).toHaveLength(0);
    expect(plan.settings.savedForLater.sort()).toEqual(['concept.function', 'tool.gradient']);
  });
});
