import { z } from 'zod';
import { Id, LocalisedText } from './common';

export const GlossaryEntrySchema = z.object({
  id: Id,
  nodeId: Id.optional(),
  fr: z.object({ preferred: z.string().min(1), aliases: z.array(z.string()).default([]) }),
  en: z.object({ preferred: z.string().min(1), aliases: z.array(z.string()).default([]) }),
  notes: z.string().optional(),
});
export const GlossaryFileSchema = z.object({ entries: z.array(GlossaryEntrySchema) });
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const RouteSchema = z.object({
  id: Id,
  kind: z.enum(['recommended', 'thematic', 'historical', 'review']),
  title: LocalisedText,
  summary: LocalisedText,
  nodes: z.array(Id).min(2),
});
/**
 * One leg of a guided flight: an authored route, or an automatic group that collects the
 * destinations of the horizon not covered by an earlier leg (one world, the bridges, or the
 * remaining history nodes). Every leg after the first carries the sentence that links it to
 * the previous one.
 */
export const TourLegSchema = z
  .object({
    route: Id.optional(),
    world: Id.optional(),
    bridges: z.literal(true).optional(),
    history: z.literal(true).optional(),
    /** Title of an automatic leg (routes use their own title). */
    title: LocalisedText.optional(),
    /** Spoken when entering this leg: links the previous leg to this one. */
    transition: LocalisedText.optional(),
  })
  .refine((leg) => [leg.route, leg.world, leg.bridges, leg.history].filter(Boolean).length === 1, {
    message: 'a leg is exactly one of route, world, bridges or history',
  })
  .refine((leg) => !!leg.route || !!leg.title, {
    message: 'an automatic leg (world, bridges, history) needs a title',
  });
export const TourSchema = z.object({
  id: Id,
  title: LocalisedText,
  intro: LocalisedText,
  outro: LocalisedText,
  legs: z.array(TourLegSchema).min(1),
});
export const RoutesFileSchema = z.object({
  routes: z.array(RouteSchema).default([]),
  tours: z.array(TourSchema).default([]),
});
export type RouteDefinition = z.infer<typeof RouteSchema>;
export type TourLeg = z.infer<typeof TourLegSchema>;
export type TourDefinition = z.infer<typeof TourSchema>;

/** Authored anchors: worlds on a ring, bridges near the centre, regions around their world. */
export const LayoutAnchorsSchema = z.object({
  parameters: z.object({
    worldRingRadius: z.number().positive().default(46),
    regionRingRadius: z.number().positive().default(14),
    nodeSpread: z.number().positive().default(3.2),
    stageOffsetY: z.number().default(1.6),
    seed: z.number().int().default(7),
  }),
  worlds: z.array(
    z.object({
      id: Id,
      /** Angle on the ring, in degrees. */
      angle: z.number(),
      y: z.number().default(0),
    })
  ),
  bridges: z.array(
    z.object({
      id: Id,
      x: z.number(),
      y: z.number().default(0),
      z: z.number(),
    })
  ),
  regions: z.array(
    z.object({
      id: Id,
      /** Angle around the world centre, in degrees. */
      angle: z.number(),
      /** Radius from the world centre; defaults to regionRingRadius. */
      radius: z.number().optional(),
      y: z.number().default(0),
    })
  ),
});
export type LayoutAnchors = z.infer<typeof LayoutAnchorsSchema>;
