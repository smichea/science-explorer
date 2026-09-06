import { z } from 'zod';
import { Id, LocalisedText } from './common';

const Range = z.tuple([z.number(), z.number()]);
/** A number, or an expression of the tool's parameters (`a`, `a+h`). */
const Scalar = z.union([z.number(), z.string().min(1)]);
const ItemId = z.string().regex(/^[a-z][a-z0-9_]*$/);
const View = z.object({ x: Range, y: Range });

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
const Parameters = z.array(PlotterParameterSchema).default([]);

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

/**
 * One change of the tool shown by a slide, fired while its text is read: `at` is the index of
 * the sentence (0-based) at which it happens. `show`, `hide`, `set` and `view` work on every
 * kind of tool (items declared `hidden` in a tool appear with `show`); the other fields draw on
 * the plotter. Items accumulate from slide to slide until `hide` or `clear`.
 */
export const PlotterActionSchema = z.object({
  at: z.number().int().min(0).default(0),
  show: z.array(ItemId).default([]),
  hide: z.array(ItemId).default([]),
  clear: z.boolean().default(false),
  /** New values for parameters. */
  set: z.record(z.string().regex(/^[a-z]$/), z.number()).optional(),
  view: z
    .object({
      x: Range.optional(),
      y: Range.optional(),
      /** Axis captions (`t (s)`, `h (m)`) when the variable stands for something. */
      labels: z.object({ x: z.string().optional(), y: z.string().optional() }).optional(),
    })
    .optional(),
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
});
export type PlotterAction = z.infer<typeof PlotterActionSchema>;

const Hidden = z.boolean().default(false);

/** A vector of the vectors tool: coordinates may depend on the parameters. */
export const VectorItemSchema = z.object({
  id: ItemId,
  x: Scalar,
  y: Scalar,
  /** Tail placed at the head of another vector (a chain, a velocity drawn from a position). */
  from: ItemId.optional(),
  label: LocalisedText.optional(),
  color: z.string().optional(),
  /** Dashed projections on both axes. */
  components: z.boolean().default(false),
  /** The learner may drag its head during the free play. */
  drag: z.boolean().default(false),
  hidden: Hidden,
});
export type VectorItem = z.infer<typeof VectorItemSchema>;

/** A parametric path (a trajectory, a slope): expressions of `s` and of the parameters. */
export const PathItemSchema = z.object({
  id: ItemId,
  x: z.string().min(1),
  y: z.string().min(1),
  range: Range,
  label: LocalisedText.optional(),
  color: z.string().optional(),
  dashed: z.boolean().default(false),
  hidden: Hidden,
});
export type PathItem = z.infer<typeof PathItemSchema>;

/** A solution curve of a slope field, from an initial condition. */
export const SolutionItemSchema = z.object({
  id: ItemId,
  x0: Scalar,
  y0: Scalar,
  label: LocalisedText.optional(),
  color: z.string().optional(),
  hidden: Hidden,
});
export type SolutionItem = z.infer<typeof SolutionItemSchema>;

/** A candidate model of the fit tool: an expression of `x` and of the parameters. */
export const ModelItemSchema = z.object({
  id: ItemId,
  expr: z.string().min(1),
  label: LocalisedText,
  color: z.string().optional(),
  hidden: Hidden,
});
export type ModelItem = z.infer<typeof ModelItemSchema>;

/** An event of the timeline tool: a year, or a span of years. */
export const TimelineEventSchema = z.object({
  id: ItemId,
  year: z.number().optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  label: LocalisedText,
  kind: z.enum(['life', 'work', 'context', 'place']).default('work'),
  hidden: Hidden,
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

/** A physical quantity of the dimensions tool, with its dimension exponents and its SI unit. */
export const QuantityItemSchema = z.object({
  id: ItemId,
  symbol: z.string().min(1),
  label: LocalisedText,
  unit: z.string().min(1),
  dims: z
    .object({
      L: z.number().int().default(0),
      M: z.number().int().default(0),
      T: z.number().int().default(0),
      I: z.number().int().default(0),
      Th: z.number().int().default(0),
    })
    .default({ L: 0, M: 0, T: 0, I: 0, Th: 0 }),
  /** Building blocks appear in the palette; results are targets to reconstruct. */
  base: z.boolean().default(true),
});
export type QuantityItem = z.infer<typeof QuantityItemSchema>;

const ToolBase = { id: ItemId, title: LocalisedText.optional() };

export const LessonToolSchema = z.discriminatedUnion('kind', [
  z.object({
    ...ToolBase,
    kind: z.literal('plotter'),
    variable: z
      .string()
      .regex(/^[a-z]$/)
      .default('x'),
    view: View,
    parameters: Parameters,
    /** Let the learner type an expression of their own during the free play. */
    input: z.boolean().default(true),
    /** State before the first slide. */
    initial: z.array(PlotterActionSchema).default([]),
  }),
  z.object({ ...ToolBase, kind: z.literal('simulation'), simulationId: Id }),
  z.object({
    ...ToolBase,
    kind: z.literal('vectors'),
    view: View,
    parameters: Parameters,
    vectors: z.array(VectorItemSchema).default([]),
    paths: z.array(PathItemSchema).default([]),
    /** Sums drawn as a parallelogram / chain: the resultant of the listed vectors. */
    sums: z
      .array(
        z.object({
          id: ItemId,
          of: z.array(ItemId).min(2),
          label: LocalisedText.optional(),
          color: z.string().optional(),
          hidden: Hidden,
        })
      )
      .default([]),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('slope_field'),
    view: View,
    parameters: Parameters,
    /** The right-hand side of y' = f(x, y), an expression of x, y and the parameters. */
    equation: z.string().min(1),
    solutions: z.array(SolutionItemSchema).default([]),
    labels: z
      .object({ x: z.string().default('x'), y: z.string().default('y') })
      .default({ x: 'x', y: 'y' }),
    /** The learner may click to add a solution during the free play. */
    pick: z.boolean().default(true),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('fit'),
    view: View,
    parameters: Parameters,
    labels: z
      .object({ x: z.string().default('x'), y: z.string().default('y') })
      .default({ x: 'x', y: 'y' }),
    /** Measured points: listed, or generated from a law with noise (seeded, reproducible). */
    points: z.array(z.tuple([z.number(), z.number()])).default([]),
    generator: z
      .object({
        expr: z.string().min(1),
        noise: z.number().min(0).default(0),
        count: z.number().int().min(1).max(200).default(10),
        from: z.number(),
        to: z.number(),
        seed: z.number().int().default(1),
      })
      .optional(),
    models: z.array(ModelItemSchema).default([]),
    /** Abscissa at which the models are asked to predict a value. */
    target: Scalar.optional(),
    /** The learner may add measurements during the free play (from the generator). */
    measure: z.boolean().default(false),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('field'),
    view: View,
    parameters: Parameters,
    /** A scalar field f(x, y), an expression of x, y and the parameters. */
    expr: z.string().min(1),
    levels: z.number().int().min(2).max(24).default(10),
    marker: z.object({ x: z.number(), y: z.number() }).default({ x: 1, y: 1 }),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('dimensions'),
    quantities: z.array(QuantityItemSchema).min(2),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('timeline'),
    from: z.number(),
    to: z.number(),
    events: z.array(TimelineEventSchema).min(1),
    /** Year shown by the cursor before the learner moves it. */
    cursor: z.number().optional(),
  }),
]);
export type LessonTool = z.infer<typeof LessonToolSchema>;
export type LessonToolKind = LessonTool['kind'];

export const LessonStepKindSchema = z.enum(['slide', 'play', 'exercises']);
export type LessonStepKind = z.infer<typeof LessonStepKindSchema>;

export const LessonStepSchema = z.object({
  id: ItemId,
  kind: LessonStepKindSchema.default('slide'),
  title: LocalisedText.optional(),
  /** Read aloud (Markdown and LaTeX are turned into speakable prose) and shown. */
  text: LocalisedText,
  /** The tool shown by this step (the first tool of the lesson by default). */
  tool: ItemId.optional(),
  actions: z.array(PlotterActionSchema).default([]),
  /** Exercises of an `exercises` step, answered in order. */
  exercises: z.array(Id).default([]),
});
export type LessonStep = z.infer<typeof LessonStepSchema>;

/**
 * A narrated, interactive lesson for one node at one depth: slides read aloud with one or
 * several tools that follow the text, a free play with the tools, then exercises with typed
 * answers. Without `steps`, the slides are built from the node description at runtime.
 */
export const LessonSchema = z.object({
  id: Id,
  nodeId: Id,
  depth: z.number().int().min(1).max(3).default(1),
  tools: z.array(LessonToolSchema).default([]),
  steps: z.array(LessonStepSchema).min(1).optional(),
});
export type LessonDefinition = z.infer<typeof LessonSchema>;
