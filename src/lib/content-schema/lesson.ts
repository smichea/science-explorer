import { z } from 'zod';
import { Id, LocalisedText } from './common';

const Range = z.tuple([z.number(), z.number()]);
/** A number, or an expression of the tool's parameters (`a`, `a+h`). */
const Scalar = z.union([z.number(), z.string().min(1)]);
const ItemId = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** A curve of the plotter: an expression of the variable and of the tool's parameters. */
export const PlotterCurveSchema = z.object({
  id: ItemId,
  expr: z.string().min(1),
  label: LocalisedText.optional(),
  color: z.string().optional(),
  dashed: z.boolean().default(false),
  /** Draw the curve on this interval of the variable only. */
  domain: Range.optional(),
});
export type PlotterCurve = z.infer<typeof PlotterCurveSchema>;

/** A parameter the learner can move with a slider (and that expressions may use). */
export const PlotterParameterSchema = z.object({
  id: z.string().regex(/^[a-z]$/),
  label: LocalisedText.optional(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive().default(0.1),
  value: z.number(),
});
export type PlotterParameter = z.infer<typeof PlotterParameterSchema>;

/**
 * One change of the plotter, fired while the text of a slide is read: `at` is the index of the
 * sentence (0-based) at which it happens. Items accumulate from slide to slide until `hide` or
 * `clear`.
 */
export const PlotterActionSchema = z.object({
  at: z.number().int().min(0).default(0),
  plot: PlotterCurveSchema.optional(),
  point: z
    .object({
      id: ItemId,
      /** The curve the point sits on. */
      on: ItemId,
      x: Scalar,
      label: LocalisedText.optional(),
      /** Dashed guides to both axes (reading an image on the graph). */
      guides: z.boolean().default(false),
    })
    .optional(),
  secant: z
    .object({ id: ItemId, on: ItemId, from: Scalar, to: Scalar, label: LocalisedText.optional() })
    .optional(),
  tangent: z
    .object({ id: ItemId, on: ItemId, x: Scalar, label: LocalisedText.optional() })
    .optional(),
  /** Shade the curve between two abscissae (variations, an interval of study). */
  interval: z
    .object({ id: ItemId, on: ItemId, from: Scalar, to: Scalar, label: LocalisedText.optional() })
    .optional(),
  hide: z.array(ItemId).default([]),
  clear: z.boolean().default(false),
  view: z
    .object({
      x: Range.optional(),
      y: Range.optional(),
      /** Axis captions (`t (s)`, `h (m)`) when the variable stands for something. */
      labels: z.object({ x: z.string().optional(), y: z.string().optional() }).optional(),
    })
    .optional(),
  /** New values for parameters. */
  set: z.record(z.string().regex(/^[a-z]$/), z.number()).optional(),
});
export type PlotterAction = z.infer<typeof PlotterActionSchema>;

export const LessonToolSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('plotter'),
    variable: z
      .string()
      .regex(/^[a-z]$/)
      .default('x'),
    view: z.object({ x: Range, y: Range }),
    parameters: z.array(PlotterParameterSchema).default([]),
    /** Let the learner type an expression of their own during the free play. */
    input: z.boolean().default(true),
    /** State before the first slide. */
    initial: z.array(PlotterActionSchema).default([]),
  }),
  z.object({ kind: z.literal('simulation'), simulationId: Id }),
]);
export type LessonTool = z.infer<typeof LessonToolSchema>;

export const LessonStepKindSchema = z.enum(['slide', 'play', 'exercises']);
export type LessonStepKind = z.infer<typeof LessonStepKindSchema>;

export const LessonStepSchema = z.object({
  id: ItemId,
  kind: LessonStepKindSchema.default('slide'),
  title: LocalisedText.optional(),
  /** Read aloud (Markdown and LaTeX are turned into speakable prose) and shown. */
  text: LocalisedText,
  actions: z.array(PlotterActionSchema).default([]),
  /** Exercises of an `exercises` step, answered in order. */
  exercises: z.array(Id).default([]),
});
export type LessonStep = z.infer<typeof LessonStepSchema>;

/**
 * A narrated, interactive lesson for one node at one depth: slides read aloud with a tool that
 * follows the text, a free play with the tool, then exercises with typed answers. Without
 * `steps`, the slides are built from the node description at runtime.
 */
export const LessonSchema = z.object({
  id: Id,
  nodeId: Id,
  depth: z.number().int().min(1).max(3).default(1),
  tool: LessonToolSchema.optional(),
  steps: z.array(LessonStepSchema).min(1).optional(),
});
export type LessonDefinition = z.infer<typeof LessonSchema>;
