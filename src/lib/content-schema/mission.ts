import { z } from 'zod';
import {
  EvidenceTypeSchema,
  HistoricalClaim,
  HistoricalDate,
  Id,
  LocalisedList,
  LocalisedText,
  MasteryDimensionSchema,
} from './common';

export const StepTypeSchema = z.enum([
  'historical_briefing',
  'dialogue',
  'source_inspection',
  'observation',
  'prediction',
  'hypothesis_choice',
  'simulation',
  'measurement',
  'graph_construction',
  'mathematics_workshop',
  'guided_derivation',
  'proof',
  'calculation',
  'free_mathematical_response',
  'model_selection',
  'comparison_of_models',
  'transfer_challenge',
  'historical_debrief',
  'reflection',
  'map_return',
]);
export type StepType = z.infer<typeof StepTypeSchema>;

export const ChoiceSchema = z.object({
  id: z.string().min(1),
  text: LocalisedText,
  correct: z.boolean().optional(),
  feedback: LocalisedText.optional(),
});

export const InputSchema = z.object({
  id: z.string().min(1),
  label: LocalisedText,
  kind: z.enum(['number', 'text', 'ratio']),
  unit: z.string().optional(),
  placeholder: LocalisedText.optional(),
  /** Expected value (number) or list of accepted numbers for ratio inputs. */
  expected: z.union([z.number(), z.array(z.number())]).optional(),
  tolerance: z.number().min(0).optional(),
});

/** How the runtime decides that a step is complete. */
export const CompletionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('read') }),
  z.object({ kind: z.literal('choice'), choices: z.array(ChoiceSchema).min(2) }),
  z.object({ kind: z.literal('inputs'), inputs: z.array(InputSchema).min(1) }),
  z.object({
    kind: z.literal('simulation'),
    /** Minimum number of measurements (or parameter changes) before the learner may continue. */
    minMeasurements: z.number().int().min(0).default(0),
    minParameterChanges: z.number().int().min(0).default(0),
  }),
  z.object({ kind: z.literal('exercises'), exerciseIds: z.array(Id).min(1) }),
  z.object({ kind: z.literal('explanation'), minCharacters: z.number().int().min(1).default(20) }),
]);
export type StepCompletion = z.infer<typeof CompletionSchema>;

export const DialogueLineSchema = z.object({
  speaker: Id.or(z.literal('learner')).or(z.literal('narrator')),
  text: LocalisedText,
  status: z.enum([
    'attested',
    'scholarly_interpretation',
    'pedagogical_reconstruction',
    'narrative_fiction',
  ]),
  /** Required when the line is an authentic quotation. */
  quotation: Id.optional(),
});

export const StepEvidenceSchema = z.object({
  type: EvidenceTypeSchema,
  nodeId: Id.optional(),
  phenomenonId: Id.optional(),
  dimension: MasteryDimensionSchema.optional(),
});

export const HintSchema = z.object({
  id: z.string().min(1),
  text: LocalisedText,
  /** Autonomy coefficient applied when this hint has been opened (§10.4). */
  autonomy: z.number().min(0).max(1).default(0.8),
});

export const StepSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/),
  type: StepTypeSchema,
  title: LocalisedText,
  /** Markdown + LaTeX shown to the learner. */
  instructions: LocalisedText,
  dialogue: z.array(DialogueLineSchema).default([]),
  guideNotes: LocalisedText.optional(),
  oralPrompts: LocalisedList.optional(),
  misconceptions: LocalisedList.optional(),
  hints: z.array(HintSchema).default([]),
  minutes: z.number().min(0),
  completion: CompletionSchema.default({ kind: 'read' }),
  evidence: z.array(StepEvidenceSchema).default([]),
  simulationRef: Id.optional(),
  /** Tool the learner must select to model the phenomenon in this step (emits tool_selected_for_model). */
  toolSelection: z
    .object({
      phenomenonId: Id,
      candidates: z.array(Id).min(2),
      correct: Id,
    })
    .optional(),
  /** Next step id; defaults to the following step in the list. */
  next: z.string().optional(),
  branches: z.array(z.object({ whenChoice: z.string(), goto: z.string() })).default([]),
  historicalClaims: z.array(HistoricalClaim).default([]),
  /** Accessible alternative or description of the visual content. */
  a11y: LocalisedText,
  transferTargets: z.array(Id).default([]),
});
export type StepDefinition = z.infer<typeof StepSchema>;

export const DepthVariantSchema = z.object({
  id: z.enum(['discovery', 'terminale', 'mpsi', 'mp']),
  depth: z.number().int().min(1).max(4),
  title: LocalisedText,
  minutes: z.number().min(0),
  skipSteps: z.array(z.string()).default([]),
  note: LocalisedText.optional(),
});

export const ThenVsNowSchema = z.object({
  knownAtTheTime: LocalisedText,
  couldMeasure: LocalisedText,
  toolsAvailable: LocalisedText,
  discoveredLater: LocalisedText,
  modernModel: LocalisedText,
});

export const MissionSchema = z.object({
  id: Id,
  status: z.enum(['draft', 'review', 'published']).default('draft'),
  version: z.number().int().min(1),
  title: LocalisedText,
  summary: LocalisedText,
  /** Spoken presentation excerpt for guided flights (plain sentences, no LaTeX). */
  overview: LocalisedText.optional(),
  /** Learner's role in the scenario (labelled as pedagogical reconstruction or fiction). */
  role: LocalisedText,
  region: Id.optional(),
  anchorNode: Id.optional(),
  importance: z.number().int().min(1).max(3).default(3),
  historicalContext: z.object({
    places: z.array(Id).min(1),
    date: HistoricalDate,
    people: z.array(Id).min(1),
    evidenceSummary: LocalisedText,
    sources: z.array(Id).min(1),
    claims: z.array(HistoricalClaim).default([]),
  }),
  learning: z.object({
    centralQuestion: Id,
    phenomena: z.array(Id).min(1),
    toolsIntroduced: z.array(Id).default([]),
    toolsUsed: z.array(Id).default([]),
    nodesAssessed: z.array(Id).default([]),
    essentialPrerequisites: z.array(Id).default([]),
    recommendedPrerequisites: z.array(Id).default([]),
    curriculumAlignments: z
      .array(z.object({ curriculum: Id, item: z.string(), depth: z.number().int() }))
      .default([]),
    depthVariants: z.array(DepthVariantSchema).min(1),
  }),
  experience: z.object({
    estimatedMinutes: z.number().min(1),
    steps: z.array(StepSchema).min(1),
    transferTargets: z.array(Id).default([]),
  }),
  debrief: ThenVsNowSchema,
});
export type MissionDefinition = z.infer<typeof MissionSchema>;
