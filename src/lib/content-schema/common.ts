import { z } from 'zod';

/** Supported product locales. */
export const LocaleSchema = z.enum(['fr', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;
export const LOCALES: readonly Locale[] = ['fr', 'en'];

/** Learner-facing text: both languages are mandatory for production content. */
export const LocalisedText = z.object({
  fr: z.string().trim().min(1),
  en: z.string().trim().min(1),
});
export type LocalisedText = z.infer<typeof LocalisedText>;

/** Parallel lists in both languages (validated for equal length by the compiler). */
export const LocalisedList = z.object({
  fr: z.array(z.string().trim().min(1)),
  en: z.array(z.string().trim().min(1)),
});
export type LocalisedList = z.infer<typeof LocalisedList>;

/** Stable, language-neutral identifier, e.g. `tool.derivative`, `mission.galileo.inclined_plane`. */
export const Id = z
  .string()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/, 'identifier must look like `kind.name.sub_name`');
export type Id = z.infer<typeof Id>;

/** Curriculum stages known to the horizon rules. The vertical slice details terminale → mp. */
export const StageSchema = z.enum(['seconde', 'premiere', 'terminale', 'mpsi', 'mp', 'beyond']);
export type Stage = z.infer<typeof StageSchema>;

/** Historical evidence status of a claim, scene, quotation, attribution or date. */
export const EvidenceStatusSchema = z.enum([
  'attested',
  'scholarly_interpretation',
  'pedagogical_reconstruction',
  'narrative_fiction',
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const DateCertaintySchema = z.enum(['exact', 'approximate', 'interval', 'disputed', 'unknown']);
export type DateCertainty = z.infer<typeof DateCertaintySchema>;

/** A historical date or interval with explicit uncertainty. */
export const HistoricalDate = z.object({
  certainty: DateCertaintySchema,
  /** ISO-like year or date, e.g. "1604" or "1604-10-16". */
  from: z.string().optional(),
  to: z.string().optional(),
  display: LocalisedText,
  note: LocalisedText.optional(),
});
export type HistoricalDate = z.infer<typeof HistoricalDate>;

/** A historical claim with its evidence status and supporting sources. */
export const HistoricalClaim = z.object({
  id: z.string().min(1),
  claim: LocalisedText,
  status: EvidenceStatusSchema,
  sources: z.array(Id).default([]),
});
export type HistoricalClaim = z.infer<typeof HistoricalClaim>;

/** Mastery dimensions (mastery-0.1). */
export const MasteryDimensionSchema = z.enum([
  'recognition_explanation',
  'procedural_execution',
  'modelling_choice',
  'transfer',
  'retention',
]);
export type MasteryDimension = z.infer<typeof MasteryDimensionSchema>;

/** Evidence event types emitted by activities. */
export const EvidenceTypeSchema = z.enum([
  'node_opened',
  'mission_started',
  'prediction_recorded',
  'simulation_parameter_changed',
  'measurement_recorded',
  'hint_opened',
  'exercise_attempted',
  'exercise_solved',
  'explanation_submitted',
  'tool_selected_for_model',
  'transfer_completed',
  'mission_completed',
  'guide_rubric_scored',
  'worked_example_observed',
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;
