import { z } from 'zod';
import { Id, LocalisedList, LocalisedText } from './common';

export const EngineIdSchema = z.enum(['motion_2d', 'first_order']);
export type EngineId = z.infer<typeof EngineIdSchema>;

export const ControlSchema = z.object({
  variable: z.string().min(1),
  label: LocalisedText,
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  unit: z.string().optional(),
  default: z.number(),
});
export type ControlDefinition = z.infer<typeof ControlSchema>;

/** Configuration of the `motion_2d` engine (point mass in a uniform gravity field). */
export const Motion2dConfigSchema = z.object({
  scene: z.enum(['inclined_plane', 'free_fall', 'projectile']),
  g: z.number().positive().default(9.81),
  mass: z.number().positive().default(1),
  /** Plane angle in degrees (inclined_plane scene). */
  angle: z.number().min(1).max(89).default(10),
  /** Plane length in metres. */
  length: z.number().positive().default(4),
  /** Linear drag coefficient k in F = -k v (kg/s). */
  linearDrag: z.number().min(0).default(0),
  /** Rolling solid sphere: acceleration multiplied by 5/7. */
  rolling: z.boolean().default(false),
  initialHeight: z.number().min(0).default(10),
  initialSpeed: z.number().min(0).default(0),
  launchAngle: z.number().min(0).max(90).default(45),
  /** Fixed integration step (s). */
  dt: z.number().positive().default(0.001),
  /** Optional measurement noise for the "water clock" (seeded, relative). */
  clockNoise: z.number().min(0).max(0.2).default(0),
});

/** Configuration of the `first_order` engine: dq/dt = (q_inf - q)/tau  or  dN/dt = -k N. */
export const FirstOrderConfigSchema = z.object({
  scene: z.enum(['rc_charging', 'first_order_kinetics', 'radioactive_decay', 'newton_cooling']),
  /** Asymptotic value (e.g. E for RC charging, 0 for decay). */
  target: z.number().default(0),
  initial: z.number().default(1),
  /** Time constant tau (s) — k = 1/tau. */
  tau: z.number().positive().default(1),
  unit: z.string().default(''),
  timeUnit: z.string().default('s'),
  duration: z.number().positive().default(6),
  dt: z.number().positive().default(0.001),
});

export const SimulationSchema = z.object({
  id: Id,
  engine: EngineIdSchema,
  title: LocalisedText,
  description: LocalisedText,
  seedPolicy: z.enum(['deterministic', 'random']).default('deterministic'),
  seed: z.number().int().default(1),
  config: z.union([Motion2dConfigSchema, FirstOrderConfigSchema]),
  controls: z.array(ControlSchema).default([]),
  observables: z.array(z.string()).min(1),
  views: z.array(z.string()).min(1),
  modelNode: Id.optional(),
  assumptions: LocalisedList,
  validity: LocalisedText,
  numericalMethod: LocalisedText,
  ignoredEffects: LocalisedList,
  learningUse: LocalisedText,
  a11y: LocalisedText,
});
export type SimulationDefinition = z.infer<typeof SimulationSchema>;
export type Motion2dConfig = z.infer<typeof Motion2dConfigSchema>;
export type FirstOrderConfig = z.infer<typeof FirstOrderConfigSchema>;
