import type {
  EvidenceStatus,
  HistoricalDate,
  Id,
  Locale,
  LocalisedList,
  LocalisedText,
} from './common';
import type { CurriculumDefinition, HorizonConfig } from './curriculum';
import type { ExerciseDefinition } from './exercise';
import type { DepthDescriptor, EdgeType, NodeType } from './graph';
import type { MissionDefinition } from './mission';
import type { GlossaryEntry, RouteDefinition } from './misc';
import type { SimulationDefinition } from './simulation';
import type { QuotationDefinition, SourceDefinition } from './source';

/** A node as consumed by the application: every authored folder is normalised to this shape. */
export interface CompiledNode {
  id: Id;
  type: NodeType;
  world?: Id;
  region?: Id;
  anchorNode?: Id;
  title: LocalisedText;
  shortPurpose: LocalisedText;
  description?: LocalisedText;
  aliases?: LocalisedList;
  importance: number;
  tags: string[];
  sources: Id[];
  backpack: boolean;
  depths: DepthDescriptor[];
  tool?: { problemSolved: LocalisedText; construction: LocalisedText; icon: string };
  model?: { assumptions: LocalisedList; limits: LocalisedList };
  law?: { statement: LocalisedText; validity: LocalisedText };
  history?: { summary: LocalisedText; status: EvidenceStatus; sources: Id[] };
  person?: {
    display: LocalisedText;
    original?: string;
    born?: HistoricalDate;
    died?: HistoricalDate;
    roles: LocalisedList;
    places: Id[];
    biography: LocalisedText;
    evidenceStatus: EvidenceStatus;
  };
  place?: {
    modernName?: LocalisedText;
    coordinates?: { lat: number; lon: number };
    locationCertainty: string;
    context: LocalisedText;
  };
  period?: { date: HistoricalDate; context: LocalisedText; people: Id[]; places: Id[] };
  mission?: {
    date: HistoricalDate;
    places: Id[];
    people: Id[];
    estimatedMinutes: number;
    phenomena: Id[];
    toolsIntroduced: Id[];
  };
}

export interface CompiledEdge {
  id: string;
  from: Id;
  to: Id;
  type: EdgeType;
  weight: number;
  coverageEligible: boolean;
  depthRange?: [number, number];
  visibleBeforeDiscovery: boolean;
  evidenceStatus?: EvidenceStatus;
  sources: Id[];
  note?: LocalisedText;
}

export interface CompiledRegion {
  id: Id;
  /** `null` for bridge hubs, which are shared by all worlds. */
  worldId: Id | null;
  isBridge: boolean;
  title: LocalisedText;
  summary: LocalisedText;
  nodeIds: Id[];
}

export interface CompiledWorld {
  id: Id;
  title: LocalisedText;
  purpose: LocalisedText;
  color: string;
  regionIds: Id[];
}

export interface CompiledGraph {
  version: string;
  worlds: CompiledWorld[];
  regions: CompiledRegion[];
  nodes: CompiledNode[];
  edges: CompiledEdge[];
}

export type Vec3 = [number, number, number];

export interface CompiledLayout {
  version: string;
  positions: Record<Id, Vec3>;
  worlds: Record<Id, Vec3>;
  regions: Record<Id, Vec3>;
  bounds: { min: Vec3; max: Vec3; radius: number };
}

export interface SearchEntry {
  id: Id;
  kind: 'node' | 'mission' | 'person' | 'place' | 'glossary' | 'region' | 'world';
  /** Canonical target node or region id. */
  target: Id;
  text: string;
  terms: string[];
}

export interface GlossaryLocalised {
  id: Id;
  nodeId?: Id;
  preferred: string;
  aliases: string[];
}

export interface ContentManifest {
  id: string;
  version: string;
  schemaVersion: number;
  createdAt: string;
  supportedLocales: Locale[];
  curriculumPaths: string[];
  dependencies: string[];
  entryWorlds: Id[];
  files: Record<string, { path: string; sha256: string; bytes: number }>;
}

export interface ValidationMessage {
  level: 'error' | 'warning';
  file?: string;
  id?: string;
  message: string;
}

export interface ValidationReport {
  createdAt: string;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  counts: Record<string, number>;
}

/** Everything the application loads for one content package. */
export interface ContentPackage {
  manifest: ContentManifest;
  graph: CompiledGraph;
  layout: CompiledLayout;
  curricula: CurriculumDefinition[];
  horizon: HorizonConfig;
  missions: MissionDefinition[];
  exercises: ExerciseDefinition[];
  simulations: SimulationDefinition[];
  sources: SourceDefinition[];
  quotations: QuotationDefinition[];
  glossary: Record<Locale, GlossaryLocalised[]>;
  search: Record<Locale, SearchEntry[]>;
  routes: RouteDefinition[];
  glossaryEntries: GlossaryEntry[];
  report: ValidationReport;
}
