import type { HorizonConfig, Locale } from '../content-schema';
import type { LearnerProfile } from '../persistence/db';
import type { ProfileSummary } from '../persistence/localStorage';
import { newId } from '../persistence/ids';
import { inferHorizon } from './horizon';

export interface ProfileInput {
  name: string;
  age: number;
  locale: Locale;
}

export interface ProfileValidation {
  ok: boolean;
  errors: { name?: boolean; age?: boolean };
}

export const AGE_MIN = 5;
export const AGE_MAX = 120;

export function validateProfileInput(input: { name: string; age: number | string }): ProfileValidation {
  const errors: ProfileValidation['errors'] = {};
  const name = input.name.trim();
  if (name.length < 1 || name.length > 40) errors.name = true;
  const age = typeof input.age === 'string' ? Number(input.age) : input.age;
  if (!Number.isInteger(age) || age < AGE_MIN || age > AGE_MAX) errors.age = true;
  return { ok: Object.keys(errors).length === 0, errors };
}

export function buildProfile(input: ProfileInput, config: HorizonConfig, contentVersion: string, now = new Date()): LearnerProfile {
  const horizon = inferHorizon(input.age, config);
  const at = now.toISOString();
  return {
    id: newId('learner'),
    name: input.name.trim(),
    age: input.age,
    ageConfirmedAt: at,
    createdAt: at,
    updatedAt: at,
    preferredLocale: input.locale,
    inferredStage: horizon.currentStage,
    horizonYears: horizon.horizonYears,
    curriculumPathId: horizon.pathId,
    targetIds: horizon.targets.map((t) => t.id),
    contentVersion,
  };
}

/** Updating the age re-infers the default horizon but never touches evidence or the guide override. */
export function withAge(profile: LearnerProfile, age: number, config: HorizonConfig, now = new Date()): LearnerProfile {
  const horizon = inferHorizon(age, config);
  const at = now.toISOString();
  return {
    ...profile,
    age,
    ageConfirmedAt: at,
    updatedAt: at,
    inferredStage: horizon.currentStage,
    horizonYears: horizon.horizonYears,
    curriculumPathId: horizon.pathId,
    targetIds: horizon.targets.map((t) => t.id),
  };
}

export function confirmAge(profile: LearnerProfile, now = new Date()): LearnerProfile {
  const at = now.toISOString();
  return { ...profile, ageConfirmedAt: at, updatedAt: at };
}

export function needsAgeConfirmation(profile: LearnerProfile, days: number, now = new Date()): boolean {
  const confirmed = new Date(profile.ageConfirmedAt).getTime();
  if (Number.isNaN(confirmed)) return true;
  return now.getTime() - confirmed > days * 86_400_000;
}

export function toSummary(profile: LearnerProfile, lastOpenedAt = new Date().toISOString()): ProfileSummary {
  return { id: profile.id, name: profile.name, age: profile.age, preferredLocale: profile.preferredLocale, lastOpenedAt };
}
