import { z } from 'zod';
import {
  EvidenceStatusSchema,
  HistoricalDate,
  Id,
  LocalisedList,
  LocalisedText,
  StageSchema,
} from './common';

export const NodeTypeSchema = z.enum([
  'mathematical_tool',
  'mathematical_concept',
  'phenomenon',
  'law',
  'model',
  'method',
  'question',
  'person',
  'place',
  'period',
  'mission',
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const DepthRoleSchema = z.enum(['core', 'extension_and_application', 'discovery', 'review']);

/** One curriculum depth of a canonical node (one node, several depths — never duplicated per year). */
export const DepthDescriptor = z.object({
  depth: z.number().int().min(1).max(4),
  stage: StageSchema,
  role: DepthRoleSchema.default('core'),
  outcomes: LocalisedList,
  /** Optional short lesson text (markdown + LaTeX) for this depth. */
  lesson: LocalisedText.optional(),
});
export type DepthDescriptor = z.infer<typeof DepthDescriptor>;

/** Fields shared by every graph node, whatever its source folder. */
export const NodeBase = z.object({
  id: Id,
  type: NodeTypeSchema,
  /** World the node belongs to (absent for bridge, history and question nodes). */
  world: Id.optional(),
  /** Region or bridge hub the node is placed in. */
  region: Id.optional(),
  /** Node to be placed next to, when the node has no region (people, places, missions). */
  anchorNode: Id.optional(),
  title: LocalisedText,
  shortPurpose: LocalisedText,
  /** Spoken presentation excerpt for guided flights: 2–4 plain sentences, no LaTeX or Markdown. */
  overview: LocalisedText.optional(),
  /** Markdown + LaTeX. */
  description: LocalisedText.optional(),
  aliases: LocalisedList.optional(),
  /** 1 = minor, 2 = normal, 3 = major (labels are prioritised with it). */
  importance: z.number().int().min(1).max(3).default(2),
  tags: z.array(z.string()).default([]),
  sources: z.array(Id).default([]),
});

/** Knowledge node authored under content/graph/nodes. */
export const NodeSchema = NodeBase.extend({
  type: NodeTypeSchema.exclude(['person', 'place', 'period', 'mission']),
  /** Collectable in the virtual backpack (mathematical tools). */
  backpack: z.boolean().default(false),
  depths: z.array(DepthDescriptor).default([]),
  /** For mathematical tools: the five questions of the concept view. */
  tool: z
    .object({
      problemSolved: LocalisedText,
      construction: LocalisedText,
      icon: z.string().default('tool'),
    })
    .optional(),
  /** For models: explicit assumptions and known limits. */
  model: z
    .object({
      assumptions: LocalisedList,
      limits: LocalisedList,
    })
    .optional(),
  /** For laws: domain of validity. */
  law: z
    .object({
      statement: LocalisedText,
      validity: LocalisedText,
    })
    .optional(),
  /** Historical attribution summary shown on the node (with evidence status). */
  history: z
    .object({
      summary: LocalisedText,
      status: EvidenceStatusSchema,
      sources: z.array(Id).min(1),
    })
    .optional(),
});
export type NodeDefinition = z.infer<typeof NodeSchema>;

export const PersonSchema = NodeBase.extend({
  type: z.literal('person').default('person'),
  names: z.object({
    display: LocalisedText,
    original: z.string().optional(),
  }),
  born: HistoricalDate.optional(),
  died: HistoricalDate.optional(),
  roles: LocalisedList,
  places: z.array(Id).default([]),
  biography: LocalisedText,
  evidenceStatus: EvidenceStatusSchema.default('attested'),
});
export type PersonDefinition = z.infer<typeof PersonSchema>;

export const PlaceSchema = NodeBase.extend({
  type: z.literal('place').default('place'),
  modernName: LocalisedText.optional(),
  coordinates: z.object({ lat: z.number(), lon: z.number() }).optional(),
  locationCertainty: z.enum(['exact', 'approximate', 'disputed', 'unknown']).default('approximate'),
  context: LocalisedText,
});
export type PlaceDefinition = z.infer<typeof PlaceSchema>;

export const PeriodSchema = NodeBase.extend({
  type: z.literal('period').default('period'),
  date: HistoricalDate,
  context: LocalisedText,
  people: z.array(Id).default([]),
  places: z.array(Id).default([]),
});
export type PeriodDefinition = z.infer<typeof PeriodSchema>;

export const EdgeTypeSchema = z.enum([
  'requires_essentially',
  'requires_recommended',
  'introduces',
  'uses',
  'assesses',
  'models',
  'applies_to',
  'explains',
  'generalises',
  'specialises',
  'analogous_to',
  'derived_from',
  'measured_by',
  'historically_developed_by',
  'historically_occurred_at',
  'historically_precedes',
  'appears_in_mission',
  'aligned_with',
  'contrasts_with',
  'transfers_to',
]);
export type EdgeType = z.infer<typeof EdgeTypeSchema>;

export const EdgeSchema = z.object({
  id: z.string().min(1).optional(),
  from: Id,
  to: Id,
  type: EdgeTypeSchema,
  weight: z.number().min(0).max(1).default(1),
  coverageEligible: z.boolean().default(false),
  depthRange: z.tuple([z.number().int().min(1), z.number().int().max(4)]).optional(),
  visibleBeforeDiscovery: z.boolean().default(true),
  evidenceStatus: EvidenceStatusSchema.optional(),
  sources: z.array(Id).default([]),
  note: LocalisedText.optional(),
});
export type EdgeDefinition = z.infer<typeof EdgeSchema>;

export const EdgeFileSchema = z.object({ edges: z.array(EdgeSchema) });

export const RegionSchema = z.object({
  id: Id,
  title: LocalisedText,
  summary: LocalisedText,
});
export type RegionDefinition = z.infer<typeof RegionSchema>;

export const WorldSchema = z.object({
  id: Id,
  title: LocalisedText,
  purpose: LocalisedText,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  regions: z.array(RegionSchema).min(1),
});
export type WorldDefinition = z.infer<typeof WorldSchema>;

export const BridgeSchema = z.object({
  id: Id,
  title: LocalisedText,
  summary: LocalisedText,
});
export type BridgeDefinition = z.infer<typeof BridgeSchema>;

export const WorldsFileSchema = z.object({
  worlds: z.array(WorldSchema).min(1),
  bridges: z.array(BridgeSchema).default([]),
});
export type WorldsFile = z.infer<typeof WorldsFileSchema>;
