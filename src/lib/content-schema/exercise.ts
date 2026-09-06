import { z } from 'zod';
import { Id, LocalisedText, MasteryDimensionSchema } from './common';

export const ExerciseTypeSchema = z.enum([
  'numeric',
  'choice',
  'ordering',
  'symbolic',
  'free_explanation',
]);
export type ExerciseType = z.infer<typeof ExerciseTypeSchema>;

const Level = z.number().int().min(1).max(5);

/** Difficulty is multidimensional (§10.2), never one arbitrary number. */
export const DifficultySchema = z.object({
  mathematicalDepth: Level,
  conceptualNovelty: Level,
  calculationLength: Level,
  modellingOpenness: Level,
  linkedConcepts: Level,
  transfer: Level,
  autonomy: Level,
});

export const RubricSchema = z.object({
  id: z.string().min(1),
  criteria: z
    .array(
      z.object({
        id: z.string().min(1),
        text: LocalisedText,
        weight: z.number().min(0).max(1).default(1),
      })
    )
    .min(1),
});

export const ExerciseSchema = z.object({
  id: Id,
  type: ExerciseTypeSchema,
  nodeId: Id,
  phenomenonId: Id.optional(),
  depth: z.number().int().min(1).max(4),
  prompt: LocalisedText,
  context: LocalisedText.optional(),
  numeric: z
    .object({
      value: z.number(),
      unit: z.string().optional(),
      tolerance: z.object({ kind: z.enum(['absolute', 'relative']), value: z.number().min(0) }),
      inputLabel: LocalisedText.optional(),
    })
    .optional(),
  choice: z
    .object({
      multiple: z.boolean().default(false),
      choices: z
        .array(
          z.object({
            id: z.string().min(1),
            text: LocalisedText,
            correct: z.boolean().default(false),
            feedback: LocalisedText.optional(),
          })
        )
        .min(2),
      requireReasoning: z.boolean().default(false),
    })
    .optional(),
  ordering: z
    .object({
      items: z.array(z.object({ id: z.string().min(1), text: LocalisedText })).min(2),
      correctOrder: z.array(z.string()).min(2),
    })
    .optional(),
  symbolic: z
    .object({
      variable: z.string().min(1).default('t'),
      /** Accepted answers, compared after normalisation (spaces, `*`, `^`, ordering of sums). */
      accepted: z.array(z.string().min(1)).min(1),
      display: z.string().optional(),
    })
    .optional(),
  rubric: RubricSchema.optional(),
  hints: z
    .array(
      z.object({
        id: z.string().min(1),
        text: LocalisedText,
        autonomy: z.number().min(0).max(1).default(0.8),
      })
    )
    .default([]),
  solution: LocalisedText,
  difficulty: DifficultySchema,
  evidenceDimension: MasteryDimensionSchema,
});
export type ExerciseDefinition = z.infer<typeof ExerciseSchema>;
