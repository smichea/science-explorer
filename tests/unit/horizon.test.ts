import { describe, expect, it } from 'vitest';
import {
  MAP_FILTERS,
  bandOf,
  effectiveHorizon,
  emphasisFor,
  inferHorizon,
  learnerDepth,
  stageFor,
} from '../../src/lib/domain/horizon';
import {
  buildProfile,
  needsAgeConfirmation,
  validateProfileInput,
  withAge,
} from '../../src/lib/domain/profile';
import { loadPackage } from './helpers';

const { horizon: config } = loadPackage();

describe('horizon inference (data-driven)', () => {
  it('maps Paul, 17, to Terminale → MPSI → MP', () => {
    const h = inferHorizon(17, config);
    expect(h.currentStage).toBe('terminale');
    expect(h.horizonYears).toBe(3);
    expect(h.pathId).toBe('fr-terminale-mpsi-mp');
    expect(h.stages).toEqual(['terminale', 'mpsi', 'mp']);
    expect(h.targets.map((t) => t.id)).toEqual(['ens', 'polytechnique']);
  });

  it('handles the other rule boundaries', () => {
    expect(inferHorizon(18, config).stages).toEqual(['mpsi', 'mp']);
    expect(inferHorizon(19, config).currentStage).toBe('mp');
    expect(inferHorizon(15, config).currentStage).toBe('seconde');
    expect(inferHorizon(16, config).stages).toEqual(['premiere', 'terminale', 'mpsi']);
    expect(inferHorizon(45, config).currentStage).toBe('mp');
  });

  it('assigns bands relative to the current stage', () => {
    const h = inferHorizon(17, config);
    expect(bandOf('terminale', h, config)).toBe('current');
    expect(bandOf('mpsi', h, config)).toBe('next');
    expect(bandOf('mp', h, config)).toBe('final');
    expect(bandOf('premiere', h, config)).toBe('foundation');
    expect(bandOf('beyond', h, config)).toBe('beyond');
    expect(bandOf(null, h, config)).toBe('current');
  });

  it('filters change emphasis, never geography', () => {
    const h = inferHorizon(17, config);
    expect(emphasisFor('terminale', h, 'entire', config)).toBe(1);
    expect(emphasisFor('mp', h, 'my_horizon', config)).toBeLessThan(1);
    expect(emphasisFor('mp', h, 'mp', config)).toBe(1);
    expect(emphasisFor('terminale', h, 'mp', config)).toBeLessThan(0.5);
    expect(emphasisFor('terminale', h, 'ready', config, false)).toBeLessThan(0.5);
  });
});

describe('profile', () => {
  it('validates name and age', () => {
    expect(validateProfileInput({ name: 'Paul', age: 17 }).ok).toBe(true);
    expect(validateProfileInput({ name: '', age: 17 }).errors.name).toBe(true);
    expect(validateProfileInput({ name: 'Paul', age: '4' }).errors.age).toBe(true);
    expect(validateProfileInput({ name: 'Paul', age: 'abc' }).errors.age).toBe(true);
  });

  it('builds a profile with the inferred horizon and keeps progress-related fields on age update', () => {
    const now = new Date('2026-09-06T10:00:00Z');
    const p = buildProfile({ name: ' Paul ', age: 17, locale: 'fr' }, config, '0.1.0', now);
    expect(p.name).toBe('Paul');
    expect(p.inferredStage).toBe('terminale');
    expect(p.horizonYears).toBe(3);
    expect(p.id.startsWith('learner.')).toBe(true);
    const older = withAge(
      { ...p, stageOverride: 'mp' },
      18,
      config,
      new Date('2027-09-06T10:00:00Z')
    );
    expect(older.id).toBe(p.id);
    expect(older.inferredStage).toBe('mpsi');
    expect(older.stageOverride).toBe('mp');
    expect(older.createdAt).toBe(p.createdAt);
  });

  it('asks for age confirmation after the configured period', () => {
    const p = buildProfile(
      { name: 'Paul', age: 17, locale: 'fr' },
      config,
      '0.1.0',
      new Date('2026-01-01T00:00:00Z')
    );
    expect(needsAgeConfirmation(p, 180, new Date('2026-03-01T00:00:00Z'))).toBe(false);
    expect(needsAgeConfirmation(p, 180, new Date('2026-09-01T00:00:00Z'))).toBe(true);
  });

  it('applies the guide override through the path containing that stage', () => {
    const p = buildProfile({ name: 'Paul', age: 17, locale: 'fr' }, config, '0.1.0');
    const h = effectiveHorizon({ ...p, stageOverride: 'mp' }, config);
    expect(h.currentStage).toBe('mp');
    expect(h.overridden).toBe(true);
    expect(h.stages[0]).toBe('mp');
    expect(effectiveHorizon(p, config).overridden).toBe(false);
  });
});

describe('stage relative to the learner', () => {
  const stages = (...list: Array<[number, 'seconde' | 'premiere' | 'terminale' | 'mpsi' | 'mp']>) =>
    ({
      id: 'concept.test',
      depths: list.map(([depth, stage]) => ({
        depth,
        stage,
        role: 'core',
        outcomes: { fr: [], en: [] },
      })),
    }) as unknown as import('../../src/lib/content-schema').CompiledNode;

  it('meets a node at its lowest depth at or above the current stage', () => {
    const paul = inferHorizon(17, config);
    const young = inferHorizon(15, config);
    const both = stages([1, 'seconde'], [2, 'terminale'], [3, 'mpsi']);
    expect(stageFor(both, paul, config)).toBe('terminale');
    expect(learnerDepth(both, paul, config)).toBe(2);
    expect(stageFor(both, young, config)).toBe('seconde');
    expect(learnerDepth(both, young, config)).toBe(1);
    expect(bandOf(stageFor(both, paul, config), paul, config)).toBe('current');
  });

  it('treats a node taught only in earlier years as a foundation', () => {
    const paul = inferHorizon(17, config);
    const early = stages([1, 'seconde']);
    expect(stageFor(early, paul, config)).toBe('seconde');
    expect(learnerDepth(early, paul, config)).toBe(1);
    expect(bandOf(stageFor(early, paul, config), paul, config)).toBe('foundation');
    expect(stageFor(stages(), paul, config)).toBeNull();
    // Later years keep their own stage: an MP-only node stays MP for a Terminale learner.
    expect(stageFor(stages([3, 'mp']), paul, config)).toBe('mp');
  });

  it('offers a filter per stage of the enumeration and keeps a node taught at that stage', () => {
    expect(MAP_FILTERS).toEqual([
      'my_horizon',
      'ready',
      'current_stage',
      'seconde',
      'premiere',
      'terminale',
      'mpsi',
      'mp',
      'entire',
    ]);
    const paul = inferHorizon(17, config);
    expect(emphasisFor('terminale', paul, 'seconde', config, true, ['seconde', 'terminale'])).toBe(
      1
    );
    expect(emphasisFor('terminale', paul, 'seconde', config, true, ['terminale'])).toBeLessThan(
      0.5
    );
    expect(emphasisFor(null, paul, 'premiere', config)).toBe(1);
  });
});
