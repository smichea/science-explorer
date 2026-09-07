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
  /**
   * The area between a curve and the axis, from `from` to `to`: its value is read out, and with
   * `riemann` the subdivision into rectangles taken on that `side` of each step is drawn too.
   */
  area: z
    .object({
      id: ItemId,
      on: ItemId,
      from: Scalar,
      to: Scalar,
      label: LocalisedText.optional(),
      color: z.string().optional(),
      riemann: z.number().int().min(1).max(200).optional(),
      side: z.enum(['left', 'right', 'middle']).default('left'),
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

/** A source of a vector field: a charge (C) or a mass (kg) placed at (x, y), expressions of the parameters. */
export const FieldSourceSchema = z.object({
  id: ItemId,
  x: Scalar,
  y: Scalar,
  value: Scalar,
  label: LocalisedText.optional(),
  color: z.string().optional(),
  /** The learner may drag it during the free play. */
  drag: z.boolean().default(false),
  hidden: Hidden,
});
export type FieldSource = z.infer<typeof FieldSourceSchema>;

/** An energy level of an atom (eV; negative for a bound state). */
export const EnergyLevelSchema = z.object({
  id: ItemId,
  energy: z.number(),
  label: LocalisedText.optional(),
  hidden: Hidden,
});
export type EnergyLevel = z.infer<typeof EnergyLevelSchema>;

/** A transition between two levels, drawn as an arrow (emission downwards, absorption upwards). */
export const TransitionItemSchema = z.object({
  id: ItemId,
  from: ItemId,
  to: ItemId,
  label: LocalisedText.optional(),
  hidden: Hidden,
});
export type TransitionItem = z.infer<typeof TransitionItemSchema>;

/** An atom of a molecule drawing: element symbol, position (drawing units), lone pairs. */
export const AtomItemSchema = z.object({
  id: ItemId,
  element: z.string().regex(/^[A-Z][a-z]?$/),
  x: z.number(),
  y: z.number(),
  lonePairs: z.number().int().min(0).max(4).default(0),
  /** Formal charge of an ion (+1, −1). */
  charge: z.number().int().optional(),
});
export type AtomItem = z.infer<typeof AtomItemSchema>;

/** A covalent bond between two atoms (single, double or triple). */
export const BondItemSchema = z.object({
  id: ItemId,
  from: ItemId,
  to: ItemId,
  order: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  hidden: Hidden,
});
export type BondItem = z.infer<typeof BondItemSchema>;

/** A characteristic group of an organic molecule: the atoms it gathers, its name and family. */
export const GroupItemSchema = z.object({
  id: ItemId,
  atoms: z.array(ItemId).min(1),
  label: LocalisedText,
  family: LocalisedText.optional(),
  color: z.string().optional(),
  hidden: Hidden,
});
export type GroupItem = z.infer<typeof GroupItemSchema>;

/** A bond energy (kJ/mol) with the numbers of such bonds broken and formed by the reaction. */
export const BondEnergySchema = z.object({
  id: ItemId,
  label: z.string().min(1),
  energy: z.number().positive(),
  broken: z.number().int().min(0).default(0),
  formed: z.number().int().min(0).default(0),
});
export type BondEnergy = z.infer<typeof BondEnergySchema>;

/** A half-equation of a redox couple: `left` and `right` are formulas, `electrons` the number exchanged. */
export const HalfEquationSchema = z.object({
  id: ItemId,
  left: z.string().min(1),
  right: z.string().min(1),
  electrons: z.number().int().min(1),
  role: z.enum(['oxidation', 'reduction']),
});
export type HalfEquation = z.infer<typeof HalfEquationSchema>;

/** A weighted two-level tree: P(A) on the first level, the rows of P_A(B) on the second. */
export const ProbabilityTreeSchema = z.object({
  first: z
    .array(z.object({ id: ItemId, label: LocalisedText, p: z.number().min(0).max(1) }))
    .min(2),
  second: z.array(z.object({ id: ItemId, label: LocalisedText })).min(2),
  /** For each first-level id, the conditional probabilities of the second-level outcomes, in order. */
  given: z.record(ItemId, z.array(z.number().min(0).max(1)).min(2)),
});
export type ProbabilityTree = z.infer<typeof ProbabilityTreeSchema>;

/** A real random variable on the outcomes of the experiment (or on the leaves `first_second` of a tree). */
export const RandomVariableSchema = z.object({
  label: LocalisedText,
  values: z.record(z.string().min(1), z.number()),
  unit: z.string().optional(),
});
export type RandomVariable = z.infer<typeof RandomVariableSchema>;

const Channels = z.array(z.enum(['r', 'g', 'b']));
/** Colour mode of the optics tool: the source light, an optional filter and an optional object. */
export const ColourSetupSchema = z.object({
  /** Additive components of the source light, 0 to 1 (expressions of the parameters). */
  source: z.tuple([Scalar, Scalar, Scalar]).default([1, 1, 1]),
  filter: z.object({ passes: Channels }).optional(),
  object: z.object({ reflects: Channels }).optional(),
});
export type ColourSetup = z.infer<typeof ColourSetupSchema>;

/** A point of the space tool: three coordinates, expressions of the parameters. */
export const SpacePointSchema = z.object({
  id: ItemId,
  x: Scalar,
  y: Scalar,
  z: Scalar,
  label: LocalisedText.optional(),
  color: z.string().optional(),
  hidden: Hidden,
});
export type SpacePoint = z.infer<typeof SpacePointSchema>;

/** A vector of the space tool, drawn from the origin or from a point. */
export const SpaceVectorSchema = z.object({
  id: ItemId,
  x: Scalar,
  y: Scalar,
  z: Scalar,
  /** Tail placed at this point rather than at the origin. */
  from: ItemId.optional(),
  label: LocalisedText.optional(),
  color: z.string().optional(),
  hidden: Hidden,
});
export type SpaceVector = z.infer<typeof SpaceVectorSchema>;

/** A line through a point, directed by a vector, drawn across the box. */
export const SpaceLineSchema = z.object({
  id: ItemId,
  through: ItemId,
  direction: ItemId,
  label: LocalisedText.optional(),
  color: z.string().optional(),
  hidden: Hidden,
});
export type SpaceLine = z.infer<typeof SpaceLineSchema>;

/** A plane, given by a point and a normal vector or by three points; its equation is read out. */
export const SpacePlaneSchema = z.object({
  id: ItemId,
  through: ItemId.optional(),
  normal: ItemId.optional(),
  of: z.array(ItemId).length(3).optional(),
  label: LocalisedText.optional(),
  color: z.string().optional(),
  hidden: Hidden,
});
export type SpacePlane = z.infer<typeof SpacePlaneSchema>;

/** An acid-base couple: the two species of the couple and its pKa. */
export const CoupleSchema = z.object({
  id: ItemId,
  acid: LocalisedText,
  base: LocalisedText,
  pka: Scalar,
  color: z.string().optional(),
  hidden: Hidden,
});
export type Couple = z.infer<typeof CoupleSchema>;

/** The titration of the acid-base tool: what is titrated, what is poured, and how much. */
export const TitrationSchema = z.object({
  /** Titrated solution: concentration (mol/L) and volume (mL). */
  c: Scalar,
  v: Scalar,
  /** The couple of the titrated species when it is weak; without it, a strong acid or base. */
  couple: ItemId.optional(),
  /** An acid is titrated (a strong base is poured), or a base (a strong acid is poured). */
  role: z.enum(['acid', 'base']).default('acid'),
  /** Concentration of the titrant (mol/L). */
  titrant: Scalar,
  /** Volume poured (mL) shown at first; the learner moves it during the free play. */
  volume: Scalar.optional(),
  /** A colour indicator and its turning range. */
  indicator: z.object({ label: LocalisedText, from: z.number(), to: z.number() }).optional(),
});
export type Titration = z.infer<typeof TitrationSchema>;

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
    /** Two vectors whose dot product, norms, angle and orthogonality are read out. */
    dot: z.tuple([ItemId, ItemId]).optional(),
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
    /** Read out the standard uncertainty of the mean, u = s/√n (sample standard deviation), and the result x̄ ± u. */
    uncertainty: z.boolean().default(false),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('random'),
    experiment: z.enum(['die', 'coin', 'urn', 'binomial']).default('die'),
    /** Faces of the die. */
    sides: z.number().int().min(2).max(20).default(6),
    urn: z.array(UrnItemSchema).default([]),
    /** Binomial law: number of repeated trials, and the probability of a success in one of them. */
    trials: z.number().int().min(1).max(60).default(10),
    success: z.number().min(0).max(1).default(0.5),
    /** Value every outcome by its own name (the number of successes): the law is then read out. */
    identity: z.boolean().default(false),
    /** The event followed: its outcomes (faces as strings, `heads`/`tails`, urn item ids). */
    event: z
      .object({ label: LocalisedText, outcomes: z.array(z.string().min(1)).min(1) })
      .optional(),
    /** `frequencies`: frequencies of every outcome; `sampling`: frequency of the event (or the mean of the variable) on samples of size n; `tree`: a weighted two-level tree. */
    mode: z.enum(['frequencies', 'sampling', 'tree']).default('frequencies'),
    /** Sample size of the sampling mode. */
    sample: z.number().int().min(1).max(10000).default(50),
    seed: z.number().int().default(1),
    /** The tree of the `tree` mode (the event's outcomes are then second-level ids). */
    tree: ProbabilityTreeSchema.optional(),
    /** A random variable on the outcomes: its law, expectation, variance and standard deviation are read out. */
    variable: RandomVariableSchema.optional(),
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
    /** `string`: a wave along a string and its two graphs; `doppler`: circles emitted by a moving source. */
    mode: z.enum(['string', 'doppler']).default('string'),
    /** Doppler: speeds of the source and of the observer along the line joining them (m/s). */
    sourceSpeed: Scalar.optional(),
    observerSpeed: Scalar.optional(),
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
    mode: z.enum(['refraction', 'lens', 'colour', 'telescope']).default('refraction'),
    /** Refraction: indices and incidence (degrees), expressions of the parameters. */
    n1: Scalar.default(1),
    n2: Scalar.default(1.5),
    angle: Scalar.default(30),
    /** Lens: focal length and object (distance to the lens, height), in centimetres. */
    focal: Scalar.default(5),
    object: z
      .object({ distance: Scalar.default(12), height: Scalar.default(3) })
      .default({ distance: 12, height: 3 }),
    /** Telescope: focal length of the eyepiece (cm); `focal` is then the objective's, `angle` the
     * angular diameter of the object at infinity (degrees). The magnification is read out. */
    eyepiece: Scalar.optional(),
    /** Colour: the source light, a filter, an object (additive and subtractive syntheses). */
    colour: ColourSetupSchema.optional(),
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
    /** Amount of the first product actually obtained: the yield is read out. */
    obtained: Scalar.optional(),
    /** Bond energies broken and formed: the molar energy of the reaction is read out. */
    bonds: z.array(BondEnergySchema).default([]),
    /** Two half-equations (one oxidation, one reduction) combined with electron multipliers. */
    halfEquations: z.array(HalfEquationSchema).max(2).default([]),
    /** Equilibrium constant: the reaction quotient, the final extent and the yield are read out. */
    equilibrium: z.object({ k: Scalar, volume: Scalar.default(1) }).optional(),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('unit_circle'),
    parameters: Parameters,
    /** Angle shown at first, in radians (an expression of the parameters: `a`, `pi/3`). */
    angle: Scalar.default(0),
    /** Main readout in degrees rather than radians. */
    degrees: z.boolean().default(false),
    /** Show the remarkable angles (multiples of π/6 and π/4) on the circle. */
    marks: z.boolean().default(true),
    /** Draw the sine and cosine curves next to the circle, with the current angle marked. */
    curves: z.boolean().default(false),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('vector_field'),
    view: View,
    parameters: Parameters,
    mode: z.enum(['electric', 'gravitational', 'uniform']).default('electric'),
    sources: z.array(FieldSourceSchema).default([]),
    /** k (electric) or G (gravitational); the physical constant by default, 1 in the uniform mode. */
    constant: Scalar.optional(),
    /** The field of the uniform mode (V/m or N/kg), expressions of the parameters. */
    uniform: z.object({ x: Scalar.default(0), y: Scalar.default(-1) }).default({ x: 0, y: -1 }),
    /** Arrows per side of the grid. */
    grid: z.number().int().min(4).max(24).default(10),
    marker: z.object({ x: z.number(), y: z.number() }).default({ x: 1, y: 1 }),
    /** Test charge (C) or test mass (kg) whose force is read at the marker. */
    test: Scalar.default(1),
    labels: z
      .object({ x: z.string().default('x (m)'), y: z.string().default('y (m)') })
      .default({ x: 'x (m)', y: 'y (m)' }),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('energy_levels'),
    levels: z.array(EnergyLevelSchema).min(2),
    /** Pair of levels selected at first: the arrow, ΔE, the frequency, the wavelength and the domain are read out. */
    selected: z.tuple([ItemId, ItemId]).optional(),
    transitions: z.array(TransitionItemSchema).default([]),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('molecule'),
    atoms: z.array(AtomItemSchema).min(1),
    bonds: z.array(BondItemSchema).default([]),
    groups: z.array(GroupItemSchema).default([]),
    name: LocalisedText.optional(),
    geometry: z.enum(['linear', 'bent', 'trigonal_planar', 'pyramidal', 'tetrahedral']).optional(),
    /** Show δ+ / δ− on the polar bonds and the polarity verdict. */
    polarity: z.boolean().default(false),
    /** Authored verdict when the flat drawing cannot decide (a symmetry in space). */
    polar: z.boolean().optional(),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('space'),
    parameters: Parameters,
    /** Half-width of the box shown, in units. */
    extent: z.number().positive().default(5),
    points: z.array(SpacePointSchema).default([]),
    vectors: z.array(SpaceVectorSchema).default([]),
    lines: z.array(SpaceLineSchema).default([]),
    planes: z.array(SpacePlaneSchema).default([]),
    /** Two vectors whose dot product, norms, angle and orthogonality are read out. */
    dot: z.tuple([ItemId, ItemId]).optional(),
    /** A point and a plane whose distance is read out. */
    distance: z.tuple([ItemId, ItemId]).optional(),
  }),
  z.object({
    ...ToolBase,
    kind: z.literal('acid_base'),
    parameters: Parameters,
    /** `predominance`: the domains on a pH axis; `titration`: the curve pH = f(V). */
    mode: z.enum(['predominance', 'titration']).default('predominance'),
    couples: z.array(CoupleSchema).min(1),
    /** Predominance: the pH read at first; the learner moves it during the free play. */
    ph: Scalar.default(7),
    titration: TitrationSchema.optional(),
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
