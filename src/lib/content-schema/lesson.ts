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
  /** Shade the curve between two abscissae (variations, an interval of study); without `on`, a band on the axis (the solutions of an inequality). */
  interval: z
    .object({
      id: ItemId,
      on: ItemId.optional(),
      from: Scalar,
      to: Scalar,
      label: LocalisedText.optional(),
    })
    .optional(),
  /** A straight line a·x + b·y + c = 0 (vertical lines included), drawn across the view. */
  line: z
    .object({
      id: ItemId,
      a: Scalar,
      b: Scalar,
      c: Scalar,
      label: LocalisedText.optional(),
      color: z.string().optional(),
      dashed: z.boolean().default(false),
    })
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

/** A named point of the vectors tool (a frame of reference): draggable during the free play. */
export const PointItemSchema = z.object({
  id: ItemId,
  x: Scalar,
  y: Scalar,
  label: LocalisedText.optional(),
  color: z.string().optional(),
  drag: z.boolean().default(false),
  hidden: Hidden,
});
export type PointItem = z.infer<typeof PointItemSchema>;

/** A segment between two points: its length and its midpoint are read out. */
export const SegmentItemSchema = z.object({
  id: ItemId,
  from: ItemId,
  to: ItemId,
  label: LocalisedText.optional(),
  dashed: z.boolean().default(false),
  hidden: Hidden,
});
export type SegmentItem = z.infer<typeof SegmentItemSchema>;

/** A species of a reaction: formula, stoichiometric coefficient, initial amount (an expression of the parameters). */
export const SpeciesItemSchema = z.object({
  id: ItemId,
  formula: z.string().min(1),
  coefficient: z.number().int().min(1).default(1),
  initial: Scalar.default(0),
  label: LocalisedText.optional(),
});
export type SpeciesItem = z.infer<typeof SpeciesItemSchema>;

/** A kind of ball of an urn, with its count. */
export const UrnItemSchema = z.object({
  id: ItemId,
  label: LocalisedText,
  count: z.number().int().min(1),
  color: z.string().optional(),
});
export type UrnItem = z.infer<typeof UrnItemSchema>;

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
    points: z.array(PointItemSchema).default([]),
    segments: z.array(SegmentItemSchema).default([]),
    /** Two vectors whose determinant (the colinearity test) is read out. */
    determinant: z.tuple([ItemId, ItemId]).optional(),
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
  z.object({
    ...ToolBase,
    kind: z.literal('arithmetic'),
    /** Largest integer of the sieve. */
    max: z.number().int().min(20).max(400).default(120),
    /** Multiples of this integer are highlighted at first. */
    highlight: z.number().int().min(2).default(3),
    /** Integer whose divisors and prime factorisation are shown at first. */
    number: z.number().int().min(1).default(36),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('data'),
    /** The statistical series (values; optional counts of the same length). */
    values: z.array(z.number()).min(3),
    counts: z.array(z.number().int().min(1)).optional(),
    label: LocalisedText.optional(),
    unit: z.string().optional(),
    /** Number of classes of the histogram. */
    bins: z.number().int().min(2).max(24).default(8),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('random'),
    experiment: z.enum(['die', 'coin', 'urn']).default('die'),
    /** Faces of the die. */
    sides: z.number().int().min(2).max(20).default(6),
    urn: z.array(UrnItemSchema).default([]),
    /** The event followed: its outcomes (faces as strings, `heads`/`tails`, urn item ids). */
    event: z
      .object({ label: LocalisedText, outcomes: z.array(z.string().min(1)).min(1) })
      .optional(),
    /** `frequencies`: frequencies of every outcome; `sampling`: frequency of the event on samples of size n. */
    mode: z.enum(['frequencies', 'sampling']).default('frequencies'),
    /** Sample size of the sampling mode. */
    sample: z.number().int().min(1).max(10000).default(50),
    seed: z.number().int().default(1),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('sequence'),
    view: View,
    parameters: Parameters,
    /** `explicit`: u(n) is an expression of n; `recurrence`: u(n+1) is an expression of u (the previous term) and n. */
    mode: z.enum(['explicit', 'recurrence']).default('explicit'),
    expr: z.string().min(1),
    /** First term of a recurrence (an expression of the parameters). */
    first: Scalar.default(1),
    /** Index of the first term. */
    start: z.number().int().min(0).default(0),
    count: z.number().int().min(2).max(60).default(12),
    /** Draw the staircase u(n+1) = f(u(n)) against y = x (recurrence). */
    cobweb: z.boolean().default(false),
    /** Let the learner type their own formula during the free play. */
    input: z.boolean().default(true),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('wave'),
    parameters: Parameters,
    /** Period (s), wavelength (m) or speed (m/s): expressions of the parameters. */
    period: Scalar.default(1),
    wavelength: Scalar.optional(),
    speed: Scalar.optional(),
    amplitude: z.number().positive().default(1),
    /** Length of the string shown (m). */
    length: z.number().positive().default(4),
    /** Position of the observation point M (m). */
    point: z.number().min(0).default(1.5),
    labels: z
      .object({ x: z.string().default('x (m)'), t: z.string().default('t (s)') })
      .default({ x: 'x (m)', t: 't (s)' }),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('optics'),
    parameters: Parameters,
    mode: z.enum(['refraction', 'lens']).default('refraction'),
    /** Refraction: indices and incidence (degrees), expressions of the parameters. */
    n1: Scalar.default(1),
    n2: Scalar.default(1.5),
    angle: Scalar.default(30),
    /** Lens: focal length and object (distance to the lens, height), in centimetres. */
    focal: Scalar.default(5),
    object: z
      .object({ distance: Scalar.default(12), height: Scalar.default(3) })
      .default({ distance: 12, height: 3 }),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('periodic_table'),
    /** Largest atomic number shown. */
    max: z.number().int().min(10).max(36).default(18),
    /** Element selected at first. */
    selected: z.number().int().min(1).max(36).default(6),
    mode: z.enum(['table', 'nucleus']).default('table'),
    /** Nucleus shown at first in the nucleus mode. */
    nucleus: z
      .object({ a: z.number().int().min(1), z: z.number().int().min(1) })
      .default({ a: 12, z: 6 }),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('reaction'),
    parameters: Parameters,
    reactants: z.array(SpeciesItemSchema).min(1),
    products: z.array(SpeciesItemSchema).min(1),
    unit: z.string().default('mol'),
    /** Extent shown at first (an expression of the parameters); the maximum by default. */
    extent: Scalar.optional(),
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
  depth: z.number().int().min(1).max(4).default(1),
  tools: z.array(LessonToolSchema).default([]),
  steps: z.array(LessonStepSchema).min(1).optional(),
});
export type LessonDefinition = z.infer<typeof LessonSchema>;
