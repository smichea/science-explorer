import { describe, expect, it } from 'vitest';
import { bandOf, effectiveHorizon, emphasisFor, inferHorizon } from '../../src/lib/domain/horizon';
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
