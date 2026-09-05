import { z } from 'zod';
import { Id, LocalisedText, StageSchema } from './common';

export const CurriculumItemSchema = z.object({
  id: z.string().min(1),
  title: LocalisedText,
  /** Official heading or reference in the programme (kept in its original language). */
  reference: z.string().optional(),
  alignedNodes: z
    .array(z.object({ node: Id, depth: z.number().int().min(1).max(3) }))
    .default([]),
});

/** A versioned curriculum package (official programmes change). */
export const CurriculumSchema = z.object({
  id: Id,
  country: z.string().length(2),
  stage: StageSchema,
  subject: z.enum(['mathematics', 'physics_chemistry', 'physics', 'chemistry', 'informatics']),
  title: LocalisedText,
  version: z.string().min(1),
  validFrom: z.string().min(4),
  validTo: z.string().nullable().default(null),
  sourceReferences: z
    .array(z.object({ title: z.string(), url: z.string().optional(), note: z.string().optional() }))
    .default([]),
  items: z.array(CurriculumItemSchema),
});
export type CurriculumDefinition = z.infer<typeof CurriculumSchema>;

export const CurriculumPathSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: LocalisedText,
  stages: z.array(StageSchema).min(1),
  targets: z.array(z.object({ id: z.string(), title: LocalisedText })).default([]),
});
export type CurriculumPath = z.infer<typeof CurriculumPathSchema>;

/** Age → default stage inference is data, never scattered conditionals. */
export const HorizonRuleSchema = z.object({
  ageMin: z.number().int().min(5),
  ageMax: z.number().int().max(120),
  currentStage: StageSchema,
  defaultHorizonYears: z.union([z.literal(2), z.literal(3)]),
  pathId: z.string(),
  note: LocalisedText.optional(),
});

export const HorizonConfigSchema = z.object({
  id: Id,
  /** Days after which the learner is asked to confirm their age again. */
  ageConfirmationDays: z.number().int().min(30).default(180),
  stages: z.array(
    z.object({
      id: StageSchema,
      title: LocalisedText,
      short: LocalisedText,
      order: z.number().int(),
    })
  ),
  rules: z.array(HorizonRuleSchema).min(1),
  paths: z.array(CurriculumPathSchema).min(1),
});
export type HorizonConfig = z.infer<typeof HorizonConfigSchema>;
export type HorizonRule = z.infer<typeof HorizonRuleSchema>;
