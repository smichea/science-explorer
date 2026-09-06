/**
 * Content compiler: authored YAML → validated, immutable, versioned runtime package.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/compile-content.ts [--check] [--out DIR]
 *
 * Pipeline (§8 technical architecture): schema validation → cross-reference validation →
 * bilingual parity checks → historical-source checks → curriculum checks → simulation checks →
 * graph compilation → search indexes → layout snapshot → manifest with checksums.
 */
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'zod';
import {
  CurriculumSchema,
  EdgeFileSchema,
  ExerciseSchema,
  FirstOrderConfigSchema,
  GlossaryFileSchema,
  HorizonConfigSchema,
  LayoutAnchorsSchema,
  LOCALES,
  MissionSchema,
  Motion2dConfigSchema,
  NodeSchema,
  PeriodSchema,
  PersonSchema,
  PlaceSchema,
  RoutesFileSchema,
  SimulationSchema,
  SourcesFileSchema,
  WorldsFileSchema,
  type CompiledEdge,
  type CompiledGraph,
  type CompiledNode,
  type TourDefinition,
  type CompiledRegion,
  type CompiledWorld,
  type ContentManifest,
  type CurriculumDefinition,
  type EdgeDefinition,
  type ExerciseDefinition,
  type GlossaryEntry,
  type GlossaryLocalised,
  type HorizonConfig,
  type Locale,
  type MissionDefinition,
  type QuotationDefinition,
  type RouteDefinition,
  type SearchEntry,
  type SimulationDefinition,
  type SourceDefinition,
  LessonSchema,
  type LessonDefinition,
  type PlotterAction,
  type ValidationMessage,
  type ValidationReport,
} from '../src/lib/content-schema/index';
import { GraphIndex } from '../src/lib/domain/graph';
import { compileExpression } from '../src/lib/domain/answers';
import { computeLayout } from '../src/lib/domain/layout';
import { speakableText, splitSentences } from '../src/lib/domain/speech';
import { buildTour, prerequisiteInversions } from '../src/lib/domain/tour';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'content');
const PACKAGE_ID = 'core';
const PACKAGE_VERSION = '0.1.0';
const SCHEMA_VERSION = 1;

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const outIndex = args.indexOf('--out');
const OUT_DIR =
  outIndex >= 0
    ? resolve(args[outIndex + 1])
    : join(ROOT, 'static', 'content', `${PACKAGE_ID}-${PACKAGE_VERSION}`);

const errors: ValidationMessage[] = [];
const warnings: ValidationMessage[] = [];
const error = (message: string, file?: string, id?: string) =>
  errors.push({ level: 'error', message, file, id });
const warn = (message: string, file?: string, id?: string) =>
  warnings.push({ level: 'warning', message, file, id });

// ---------------------------------------------------------------------------
// Loading helpers
// ---------------------------------------------------------------------------

function listYaml(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listYaml(full));
    else if (/\.ya?ml$/.test(entry)) out.push(full);
  }
  return out.sort();
}

function rel(file: string): string {
  return relative(ROOT, file);
}

function loadYaml(file: string): unknown {
  try {
    return yaml.load(readFileSync(file, 'utf8'));
  } catch (e) {
    error(`YAML parse error: ${(e as Error).message}`, rel(file));
    return undefined;
  }
}

function parseFile<T extends z.ZodTypeAny>(schema: T, file: string): z.infer<T> | undefined {
  const raw = loadYaml(file);
  if (raw === undefined) return undefined;
  const result = schema.safeParse(raw);
  if (!result.success) {
    error(`schema validation failed:\n${z.prettifyError(result.error)}`, rel(file));
    return undefined;
  }
  return result.data;
}

function parseDir<T extends z.ZodTypeAny>(
  schema: T,
  dir: string
): Array<{ file: string; data: z.infer<T> }> {
  const out: Array<{ file: string; data: z.infer<T> }> = [];
  for (const file of listYaml(dir)) {
    const data = parseFile(schema, file);
    if (data !== undefined) out.push({ file: rel(file), data });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bilingual parity: every {fr, en} pair of arrays must have the same length.
// ---------------------------------------------------------------------------

function checkParity(value: unknown, file: string, path = ''): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => checkParity(v, file, `${path}[${i}]`));
    return;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.fr) && Array.isArray(obj.en) && obj.fr.length !== obj.en.length) {
      error(
        `bilingual list length differs (fr: ${obj.fr.length}, en: ${obj.en.length}) at ${path}`,
        file
      );
    }
    if (typeof obj.fr === 'string' && typeof obj.en === 'string') {
      const frMath = (obj.fr.match(/\$/g) ?? []).length;
      const enMath = (obj.en.match(/\$/g) ?? []).length;
      if (frMath !== enMath) {
        warn(`different number of formula delimiters in fr/en at ${path}`, file);
      }
    }
    for (const [k, v] of Object.entries(obj)) checkParity(v, file, path ? `${path}.${k}` : k);
  }
}

// ---------------------------------------------------------------------------
// Load everything
// ---------------------------------------------------------------------------

const worldsFile = parseFile(WorldsFileSchema, join(CONTENT_DIR, 'graph', 'worlds.yaml'));
const anchors = parseFile(LayoutAnchorsSchema, join(CONTENT_DIR, 'layout', 'anchors.yaml'));
const horizon = parseFile(HorizonConfigSchema, join(CONTENT_DIR, 'curricula', 'horizon.yaml'));
const nodeFiles = parseDir(NodeSchema, join(CONTENT_DIR, 'graph', 'nodes'));
const edgeFiles = parseDir(EdgeFileSchema, join(CONTENT_DIR, 'graph', 'edges'));
const curriculumFiles = parseDir(CurriculumSchema, join(CONTENT_DIR, 'curricula', 'programmes'));
const missionFiles = parseDir(MissionSchema, join(CONTENT_DIR, 'missions'));
const exerciseFiles = parseDir(ExerciseSchema, join(CONTENT_DIR, 'exercises'));
const simulationFiles = parseDir(SimulationSchema, join(CONTENT_DIR, 'simulations'));
const personFiles = parseDir(PersonSchema, join(CONTENT_DIR, 'people'));
const placeFiles = parseDir(PlaceSchema, join(CONTENT_DIR, 'places'));
const periodFiles = parseDir(PeriodSchema, join(CONTENT_DIR, 'periods'));
const sourceFiles = parseDir(SourcesFileSchema, join(CONTENT_DIR, 'sources'));
const glossaryFiles = parseDir(GlossaryFileSchema, join(CONTENT_DIR, 'glossary'));
const routeFiles = parseDir(RoutesFileSchema, join(CONTENT_DIR, 'routes'));
const lessonFiles = parseDir(LessonSchema, join(CONTENT_DIR, 'lessons'));

for (const group of [
  nodeFiles,
  edgeFiles,
  curriculumFiles,
  missionFiles,
  exerciseFiles,
  simulationFiles,
  personFiles,
  placeFiles,
  periodFiles,
  sourceFiles,
  glossaryFiles,
  routeFiles,
]) {
  for (const { file, data } of group) checkParity(data, file);
}
if (worldsFile) checkParity(worldsFile, 'content/graph/worlds.yaml');
if (horizon) checkParity(horizon, 'content/curricula/horizon.yaml');

if (!worldsFile || !anchors || !horizon) {
  printMessages();
  console.error(
    '\nContent validation FAILED: worlds.yaml, layout/anchors.yaml and curricula/horizon.yaml are required.'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Compile graph
// ---------------------------------------------------------------------------

const worlds: CompiledWorld[] = worldsFile.worlds.map((w) => ({
  id: w.id,
  title: w.title,
  purpose: w.purpose,
  color: w.color,
  regionIds: w.regions.map((r) => r.id),
}));

const regions: CompiledRegion[] = [
  ...worldsFile.worlds.flatMap((w) =>
    w.regions.map((r) => ({
      id: r.id,
      worldId: w.id,
      isBridge: false,
      title: r.title,
      summary: r.summary,
      nodeIds: [] as string[],
    }))
  ),
  ...worldsFile.bridges.map((b) => ({
    id: b.id,
    worldId: null,
    isBridge: true,
    title: b.title,
    summary: b.summary,
    nodeIds: [] as string[],
  })),
];
const regionById = new Map(regions.map((r) => [r.id, r]));
const worldById = new Map(worlds.map((w) => [w.id, w]));

const nodes: CompiledNode[] = [];
const nodeFileById = new Map<string, string>();

function pushNode(node: CompiledNode, file: string) {
  if (nodeFileById.has(node.id)) {
    error(`duplicate node id ${node.id} (also in ${nodeFileById.get(node.id)})`, file, node.id);
    return;
  }
  nodeFileById.set(node.id, file);
  nodes.push(node);
}

for (const { file, data } of nodeFiles) {
  pushNode(
    {
      id: data.id,
      type: data.type,
      world: data.world,
      region: data.region,
      anchorNode: data.anchorNode,
      title: data.title,
      shortPurpose: data.shortPurpose,
      overview: data.overview,
      description: data.description,
      aliases: data.aliases,
      importance: data.importance,
      tags: data.tags,
      sources: data.sources,
      backpack: data.backpack,
      depths: data.depths,
      tool: data.tool,
      model: data.model,
      law: data.law,
      history: data.history,
    },
    file
  );
  if (data.type === 'mathematical_tool' && data.backpack && !data.tool) {
    error(
      `backpack tool ${data.id} must answer the five questions (tool.problemSolved, tool.construction)`,
      file,
      data.id
    );
  }
  if (data.type === 'model' && !data.model)
    warn(`model ${data.id} has no explicit assumptions/limits`, file, data.id);
  if (!data.description) warn(`node ${data.id} has no description`, file, data.id);
  if (data.history && data.history.sources.length === 0)
    error(`historical summary of ${data.id} has no source`, file, data.id);
}
for (const { file, data } of personFiles) {
  pushNode(
    {
      id: data.id,
      type: 'person',
      world: data.world,
      region: data.region,
      anchorNode: data.anchorNode,
      title: data.title,
      shortPurpose: data.shortPurpose,
      overview: data.overview,
      description: data.description,
      aliases: data.aliases,
      importance: data.importance,
      tags: data.tags,
      sources: data.sources,
      backpack: false,
      depths: [],
      person: {
        display: data.names.display,
        original: data.names.original,
        born: data.born,
        died: data.died,
        roles: data.roles,
        places: data.places,
        biography: data.biography,
        evidenceStatus: data.evidenceStatus,
      },
    },
    file
  );
  if (data.sources.length === 0)
    error(`person ${data.id} needs at least one source`, file, data.id);
}
for (const { file, data } of placeFiles) {
  pushNode(
    {
      id: data.id,
      type: 'place',
      world: data.world,
      region: data.region,
      anchorNode: data.anchorNode,
      title: data.title,
      shortPurpose: data.shortPurpose,
      overview: data.overview,
      description: data.description,
      aliases: data.aliases,
      importance: data.importance,
      tags: data.tags,
      sources: data.sources,
      backpack: false,
      depths: [],
      place: {
        modernName: data.modernName,
        coordinates: data.coordinates,
        locationCertainty: data.locationCertainty,
        context: data.context,
      },
    },
    file
  );
}
for (const { file, data } of periodFiles) {
  pushNode(
    {
      id: data.id,
      type: 'period',
      world: data.world,
      region: data.region,
      anchorNode: data.anchorNode,
      title: data.title,
      shortPurpose: data.shortPurpose,
      overview: data.overview,
      description: data.description,
      aliases: data.aliases,
      importance: data.importance,
      tags: data.tags,
      sources: data.sources,
      backpack: false,
      depths: [],
      period: { date: data.date, context: data.context, people: data.people, places: data.places },
    },
    file
  );
}
const missions: MissionDefinition[] = [];
for (const { file, data } of missionFiles) {
  missions.push(data);
  pushNode(
    {
      id: data.id,
      type: 'mission',
      region: data.region,
      anchorNode: data.anchorNode ?? data.learning.phenomena[0],
      title: data.title,
      shortPurpose: data.summary,
      overview: data.overview,
      importance: data.importance,
      tags: [],
      sources: data.historicalContext.sources,
      backpack: false,
      depths: [],
      mission: {
        date: data.historicalContext.date,
        places: data.historicalContext.places,
        people: data.historicalContext.people,
        estimatedMinutes: data.experience.estimatedMinutes,
        phenomena: data.learning.phenomena,
        toolsIntroduced: data.learning.toolsIntroduced,
      },
    },
    file
  );
}

const nodeById = new Map(nodes.map((n) => [n.id, n]));

// Region membership and reference checks for nodes.
for (const node of nodes) {
  const file = nodeFileById.get(node.id);
  if (node.world && !worldById.has(node.world)) error(`unknown world ${node.world}`, file, node.id);
  if (node.region) {
    const region = regionById.get(node.region);
    if (!region) error(`unknown region ${node.region}`, file, node.id);
    else {
      region.nodeIds.push(node.id);
      if (node.world && region.worldId && region.worldId !== node.world)
        error(`region ${node.region} does not belong to world ${node.world}`, file, node.id);
      if (!node.world && region.worldId) node.world = region.worldId;
    }
  }
  if (node.anchorNode && !nodeById.has(node.anchorNode))
    error(`unknown anchorNode ${node.anchorNode}`, file, node.id);
  if (!node.region && !node.anchorNode)
    warn(
      `node ${node.id} has neither region nor anchorNode: it will be placed near the centre`,
      file,
      node.id
    );
}

// Edges
const edges: CompiledEdge[] = [];
const edgeIds = new Set<string>();
const allEdgeDefs: Array<{ file: string; edge: EdgeDefinition }> = edgeFiles.flatMap(
  ({ file, data }) => data.edges.map((edge) => ({ file, edge }))
);
for (const { file, edge } of allEdgeDefs) {
  const id = edge.id ?? `${edge.type}:${edge.from}>${edge.to}`;
  if (edgeIds.has(id)) {
    error(`duplicate edge ${id}`, file, id);
    continue;
  }
  edgeIds.add(id);
  if (!nodeById.has(edge.from)) error(`edge ${id}: unknown source node ${edge.from}`, file, id);
  if (!nodeById.has(edge.to)) error(`edge ${id}: unknown target node ${edge.to}`, file, id);
  if (edge.coverageEligible && edge.type !== 'applies_to' && edge.type !== 'models')
    error(`edge ${id}: only applies_to/models edges may be coverageEligible`, file, id);
  if (edge.type === 'historically_developed_by' && edge.sources.length === 0)
    error(`edge ${id}: historical attribution needs a source`, file, id);
  if (edge.type === 'historically_developed_by' && !edge.evidenceStatus)
    error(`edge ${id}: historical attribution needs an evidenceStatus`, file, id);
  edges.push({ ...edge, id });
}

// Essential prerequisites must be acyclic.
{
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (e.type !== 'requires_essentially') continue;
    adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]);
  }
  const state = new Map<string, number>();
  const visit = (id: string, path: string[]): void => {
    const s = state.get(id) ?? 0;
    if (s === 1) {
      error(`essential prerequisite cycle: ${[...path, id].join(' → ')}`);
      return;
    }
    if (s === 2) return;
    state.set(id, 1);
    for (const next of adj.get(id) ?? []) visit(next, [...path, id]);
    state.set(id, 2);
  };
  for (const id of adj.keys()) visit(id, []);
}

// ---------------------------------------------------------------------------
// Sources, quotations
// ---------------------------------------------------------------------------

const sources: SourceDefinition[] = [];
const quotations: QuotationDefinition[] = [];
for (const { file, data } of sourceFiles) {
  for (const s of data.sources) {
    if (sources.some((x) => x.id === s.id)) error(`duplicate source ${s.id}`, file, s.id);
    else sources.push(s);
  }
  for (const q of data.quotations) {
    if (quotations.some((x) => x.id === q.id)) error(`duplicate quotation ${q.id}`, file, q.id);
    else quotations.push(q);
  }
}
const sourceIds = new Set(sources.map((s) => s.id));
const quotationById = new Map(quotations.map((q) => [q.id, q]));
for (const q of quotations)
  if (!sourceIds.has(q.source))
    error(`quotation ${q.id}: unknown source ${q.source}`, undefined, q.id);
for (const node of nodes) {
  for (const s of node.sources)
    if (!sourceIds.has(s))
      error(`node ${node.id}: unknown source ${s}`, nodeFileById.get(node.id), node.id);
  if (node.history)
    for (const s of node.history.sources)
      if (!sourceIds.has(s))
        error(`node ${node.id}: unknown history source ${s}`, nodeFileById.get(node.id), node.id);
}
for (const e of edges)
  for (const s of e.sources)
    if (!sourceIds.has(s)) error(`edge ${e.id}: unknown source ${s}`, undefined, e.id);

// ---------------------------------------------------------------------------
// Curricula and horizon
// ---------------------------------------------------------------------------

const curricula: CurriculumDefinition[] = curriculumFiles.map((c) => c.data);
const curriculumById = new Map(curricula.map((c) => [c.id, c]));
for (const { file, data } of curriculumFiles) {
  for (const item of data.items) {
    if (item.alignedNodes.length === 0)
      warn(`curriculum item ${data.id}/${item.id} is not aligned with any node`, file, item.id);
    for (const a of item.alignedNodes)
      if (!nodeById.has(a.node))
        error(`curriculum item ${item.id}: unknown node ${a.node}`, file, item.id);
  }
}
const pathIds = new Set(horizon.paths.map((p) => p.id));
for (const r of horizon.rules)
  if (!pathIds.has(r.pathId))
    error(
      `horizon rule ${r.ageMin}-${r.ageMax}: unknown path ${r.pathId}`,
      'content/curricula/horizon.yaml'
    );
const stageIds = new Set(horizon.stages.map((s) => s.id));
for (const p of horizon.paths)
  for (const s of p.stages)
    if (!stageIds.has(s))
      error(`path ${p.id}: unknown stage ${s}`, 'content/curricula/horizon.yaml', p.id);

// ---------------------------------------------------------------------------
// Exercises, simulations
// ---------------------------------------------------------------------------

const exercises: ExerciseDefinition[] = [];
for (const { file, data } of exerciseFiles) {
  if (exercises.some((x) => x.id === data.id)) {
    error(`duplicate exercise ${data.id}`, file, data.id);
    continue;
  }
  exercises.push(data);
  if (!nodeById.has(data.nodeId))
    error(`exercise ${data.id}: unknown node ${data.nodeId}`, file, data.id);
  if (data.phenomenonId && !nodeById.has(data.phenomenonId))
    error(`exercise ${data.id}: unknown phenomenon ${data.phenomenonId}`, file, data.id);
  const payloads = {
    numeric: data.numeric,
    choice: data.choice,
    ordering: data.ordering,
    symbolic: data.symbolic,
    free_explanation: data.rubric,
  };
  if (!payloads[data.type])
    error(
      `exercise ${data.id} of type ${data.type} lacks its ${data.type === 'free_explanation' ? 'rubric' : data.type} block`,
      file,
      data.id
    );
  if (data.choice && !data.choice.choices.some((c) => c.correct))
    error(`exercise ${data.id}: no correct choice`, file, data.id);
  if (data.ordering) {
    const ids = data.ordering.items
      .map((i) => i.id)
      .sort()
      .join(',');
    const order = [...data.ordering.correctOrder].sort().join(',');
    if (ids !== order)
      error(`exercise ${data.id}: correctOrder is not a permutation of item ids`, file, data.id);
  }
}
const exerciseById = new Map(exercises.map((e) => [e.id, e]));

const simulations: SimulationDefinition[] = [];
for (const { file, data } of simulationFiles) {
  if (simulations.some((x) => x.id === data.id)) {
    error(`duplicate simulation ${data.id}`, file, data.id);
    continue;
  }
  const configSchema = data.engine === 'motion_2d' ? Motion2dConfigSchema : FirstOrderConfigSchema;
  const parsed = configSchema.safeParse(data.config);
  if (!parsed.success)
    error(
      `simulation ${data.id}: invalid ${data.engine} config\n${z.prettifyError(parsed.error)}`,
      file,
      data.id
    );
  else {
    data.config = parsed.data;
    for (const c of data.controls) {
      if (!(c.variable in parsed.data))
        error(
          `simulation ${data.id}: control ${c.variable} is not a config variable`,
          file,
          data.id
        );
      if (c.min > c.max || c.default < c.min || c.default > c.max)
        error(`simulation ${data.id}: control ${c.variable} range is inconsistent`, file, data.id);
    }
  }
  if (data.modelNode && !nodeById.has(data.modelNode))
    error(`simulation ${data.id}: unknown modelNode ${data.modelNode}`, file, data.id);
  simulations.push(data);
}
const simulationById = new Map(simulations.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// Lessons: one per node and depth, a known tool, exercises of the node, expressions that compile,
// actions that fall inside the spoken text.
// ---------------------------------------------------------------------------

const lessons: LessonDefinition[] = [];
for (const { file, data } of lessonFiles) {
  if (lessons.some((l) => l.id === data.id)) {
    error(`duplicate lesson ${data.id}`, file, data.id);
    continue;
  }
  if (lessons.some((l) => l.nodeId === data.nodeId && l.depth === data.depth))
    error(
      `lesson ${data.id}: ${data.nodeId} already has a lesson at depth ${data.depth}`,
      file,
      data.id
    );
  lessons.push(data);
  const node = nodeById.get(data.nodeId);
  if (!node) error(`lesson ${data.id}: unknown node ${data.nodeId}`, file, data.id);
  else if (node.type === 'mission')
    error(`lesson ${data.id}: a mission is practised, not taught`, file, data.id);
  if (data.tools.length === 0) warn(`lesson ${data.id} has no tool`, file, data.id);

  const compiles = (expr: string, variables: string[], where: string) => {
    try {
      compileExpression(expr, variables);
    } catch (e) {
      error(`${where}: ${expr}: ${(e as Error).message}`, file, data.id);
    }
  };
  const toolIds = new Set<string>();
  /** Items a slide may show or hide, per tool. */
  const itemsOf = new Map<string, Set<string>>();
  for (const tool of data.tools) {
    const where = `lesson ${data.id}, tool ${tool.id}`;
    if (toolIds.has(tool.id)) error(`${where}: duplicate tool id`, file, data.id);
    toolIds.add(tool.id);
    const parameters = 'parameters' in tool ? tool.parameters.map((p) => p.id) : [];
    const items = new Set<string>();
    const scalar = (value: number | string | undefined, what: string) => {
      if (typeof value === 'string') compiles(value, parameters, `${where}: ${what}`);
    };
    switch (tool.kind) {
      case 'simulation':
        if (!simulationById.has(tool.simulationId))
          error(`${where}: unknown simulation ${tool.simulationId}`, file, data.id);
        break;
      case 'plotter':
        break;
      case 'vectors':
        for (const v of tool.vectors) {
          items.add(v.id);
          scalar(v.x, `vector ${v.id}`);
          scalar(v.y, `vector ${v.id}`);
          if (v.from && !tool.vectors.some((o) => o.id === v.from))
            error(`${where}: vector ${v.id} starts from unknown vector ${v.from}`, file, data.id);
        }
        for (const path of tool.paths) {
          items.add(path.id);
          compiles(path.x, ['s', ...parameters], `${where}: path ${path.id}`);
          compiles(path.y, ['s', ...parameters], `${where}: path ${path.id}`);
        }
        for (const sum of tool.sums) {
          items.add(sum.id);
          for (const id of sum.of)
            if (!tool.vectors.some((v) => v.id === id))
              error(`${where}: sum ${sum.id} uses unknown vector ${id}`, file, data.id);
        }
        break;
      case 'slope_field':
        compiles(tool.equation, ['x', 'y', ...parameters], `${where}: equation`);
        for (const sol of tool.solutions) {
          items.add(sol.id);
          scalar(sol.x0, `solution ${sol.id}`);
          scalar(sol.y0, `solution ${sol.id}`);
        }
        break;
      case 'fit':
        if (tool.generator)
          compiles(tool.generator.expr, ['x', ...parameters], `${where}: generator`);
        else if (tool.points.length === 0)
          error(`${where}: no points and no generator`, file, data.id);
        if (tool.measure && !tool.generator)
          error(`${where}: measuring again needs a generator`, file, data.id);
        for (const model of tool.models) {
          items.add(model.id);
          compiles(model.expr, ['x', ...parameters], `${where}: model ${model.id}`);
        }
        scalar(tool.target, 'target');
        break;
      case 'field':
        compiles(tool.expr, ['x', 'y', ...parameters], `${where}: field`);
        break;
      case 'dimensions':
        for (const q of tool.quantities) {
          if (items.has(q.id)) error(`${where}: duplicate quantity ${q.id}`, file, data.id);
          items.add(q.id);
        }
        if (!tool.quantities.some((q) => !q.base))
          warn(`${where}: no derived quantity to reconstruct`, file, data.id);
        break;
      case 'timeline':
        for (const ev of tool.events) {
          items.add(ev.id);
          const years = [ev.year, ev.start, ev.end].filter((y): y is number => y !== undefined);
          if (years.length === 0) error(`${where}: event ${ev.id} has no year`, file, data.id);
          for (const y of years)
            if (y < tool.from || y > tool.to)
              warn(
                `${where}: event ${ev.id} (${y}) is outside ${tool.from}–${tool.to}`,
                file,
                data.id
              );
        }
        break;
    }
    itemsOf.set(tool.id, items);
    if (tool.kind === 'plotter')
      tool.initial.forEach((a, i) => checkAction(tool, a, `${where}: initial action ${i + 1}`));
  }

  function checkAction(tool: (typeof data.tools)[number], action: PlotterAction, where: string) {
    const parameters = 'parameters' in tool ? tool.parameters.map((p) => p.id) : [];
    const items = itemsOf.get(tool.id) ?? new Set<string>();
    if (tool.kind === 'plotter') {
      const variables = [tool.variable, ...parameters];
      if (action.plot) compiles(action.plot.expr, variables, `${where}: curve ${action.plot.id}`);
      const scalars = [
        action.point?.x,
        action.secant?.from,
        action.secant?.to,
        action.tangent?.x,
        action.interval?.from,
        action.interval?.to,
      ];
      for (const s of scalars) if (typeof s === 'string') compiles(s, parameters, where);
    } else if (action.plot || action.point || action.secant || action.tangent || action.interval) {
      error(
        `${where}: drawing actions need a plotter (tool ${tool.id} is a ${tool.kind})`,
        file,
        data.id
      );
    }
    for (const id of action.show)
      if (!items.has(id))
        warn(`${where}: shows unknown item ${id} of tool ${tool.id}`, file, data.id);
    if (tool.kind !== 'plotter')
      for (const id of action.hide)
        if (!items.has(id))
          warn(`${where}: hides unknown item ${id} of tool ${tool.id}`, file, data.id);
    for (const id of Object.keys(action.set ?? {}))
      if (!parameters.includes(id)) error(`${where}: unknown parameter ${id}`, file, data.id);
  }

  const stepIds = new Set<string>();
  for (const step of data.steps ?? []) {
    const where = `lesson ${data.id}, step ${step.id}`;
    if (stepIds.has(step.id)) error(`${where}: duplicate step id`, file, data.id);
    stepIds.add(step.id);
    if (step.tool && !toolIds.has(step.tool))
      error(`${where}: unknown tool ${step.tool}`, file, data.id);
    const tool = data.tools.find((t) => t.id === step.tool) ?? data.tools[0];
    if (step.actions.length && !tool) error(`${where}: actions without a tool`, file, data.id);
    const sentences = splitSentences(speakableText(step.text.fr, 'fr')).length;
    step.actions.forEach((action, i) => {
      if (tool) checkAction(tool, action, `${where}, action ${i + 1}`);
      if (action.at >= sentences)
        warn(
          `${where}: action ${i + 1} fires at sentence ${action.at + 1} but the French text has ${sentences}`,
          file,
          data.id
        );
    });
    if (step.kind === 'exercises' && step.exercises.length === 0)
      error(`${where}: an exercises step needs exercises`, file, data.id);
    if (step.kind !== 'exercises' && step.exercises.length)
      warn(`${where}: exercises listed on a ${step.kind} step are ignored`, file, data.id);
    for (const id of step.exercises) {
      const exercise = exerciseById.get(id);
      if (!exercise) error(`${where}: unknown exercise ${id}`, file, data.id);
      else if (exercise.nodeId !== data.nodeId)
        warn(`${where}: exercise ${id} belongs to ${exercise.nodeId}`, file, data.id);
    }
  }
  if (data.steps && data.tools.length && !data.steps.some((s) => s.kind === 'play'))
    warn(`lesson ${data.id} has tools but no free play step`, file, data.id);
  const nodeExercises = exercises.filter(
    (e) => e.nodeId === data.nodeId && e.type !== 'free_explanation'
  );
  if (nodeExercises.length === 0)
    warn(`lesson ${data.id}: ${data.nodeId} has no exercise`, file, data.id);
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

for (const { file, data } of missionFiles) {
  const ctx = data.historicalContext;
  for (const p of ctx.places)
    if (nodeById.get(p)?.type !== 'place')
      error(`mission ${data.id}: ${p} is not a known place`, file, data.id);
  for (const p of ctx.people)
    if (nodeById.get(p)?.type !== 'person')
      error(`mission ${data.id}: ${p} is not a known person`, file, data.id);
  for (const s of ctx.sources)
    if (!sourceIds.has(s)) error(`mission ${data.id}: unknown source ${s}`, file, data.id);
  for (const c of ctx.claims) {
    if (
      (c.status === 'attested' || c.status === 'scholarly_interpretation') &&
      c.sources.length === 0
    )
      error(`mission ${data.id}: claim ${c.id} (${c.status}) has no source`, file, data.id);
    for (const s of c.sources)
      if (!sourceIds.has(s))
        error(`mission ${data.id}: claim ${c.id} unknown source ${s}`, file, data.id);
  }
  const l = data.learning;
  if (nodeById.get(l.centralQuestion)?.type !== 'question')
    error(
      `mission ${data.id}: centralQuestion ${l.centralQuestion} is not a question node`,
      file,
      data.id
    );
  for (const list of [
    l.phenomena,
    l.toolsIntroduced,
    l.toolsUsed,
    l.nodesAssessed,
    l.essentialPrerequisites,
    l.recommendedPrerequisites,
    data.experience.transferTargets,
  ]) {
    for (const id of list)
      if (!nodeById.has(id)) error(`mission ${data.id}: unknown node ${id}`, file, data.id);
  }
  for (const a of l.curriculumAlignments) {
    const c = curriculumById.get(a.curriculum);
    if (!c) error(`mission ${data.id}: unknown curriculum ${a.curriculum}`, file, data.id);
    else if (!c.items.some((i) => i.id === a.item))
      error(
        `mission ${data.id}: unknown curriculum item ${a.item} in ${a.curriculum}`,
        file,
        data.id
      );
  }
  const stepIds = new Set<string>();
  for (const step of data.experience.steps) {
    if (stepIds.has(step.id)) error(`mission ${data.id}: duplicate step ${step.id}`, file, data.id);
    stepIds.add(step.id);
  }
  let hasTransfer = false;
  let hasPrediction = false;
  for (const step of data.experience.steps) {
    if (step.type === 'transfer_challenge') hasTransfer = true;
    if (step.type === 'prediction' || step.type === 'hypothesis_choice') hasPrediction = true;
    if (step.next && !stepIds.has(step.next))
      error(`mission ${data.id}: step ${step.id} → unknown next ${step.next}`, file, data.id);
    for (const b of step.branches)
      if (!stepIds.has(b.goto))
        error(`mission ${data.id}: step ${step.id} branch → unknown step ${b.goto}`, file, data.id);
    if (step.completion.kind === 'exercises')
      for (const ex of step.completion.exerciseIds)
        if (!exerciseById.has(ex))
          error(`mission ${data.id}: step ${step.id} unknown exercise ${ex}`, file, data.id);
    if (step.completion.kind === 'choice' && step.branches.length > 0) {
      const ids = new Set(step.completion.choices.map((c) => c.id));
      for (const b of step.branches)
        if (!ids.has(b.whenChoice))
          error(
            `mission ${data.id}: step ${step.id} branch on unknown choice ${b.whenChoice}`,
            file,
            data.id
          );
    }
    if (step.simulationRef && !simulationById.has(step.simulationRef))
      error(
        `mission ${data.id}: step ${step.id} unknown simulation ${step.simulationRef}`,
        file,
        data.id
      );
    if ((step.type === 'simulation' || step.type === 'measurement') && !step.simulationRef)
      error(
        `mission ${data.id}: ${step.type} step ${step.id} needs a simulationRef`,
        file,
        data.id
      );
    if (step.toolSelection) {
      const ts = step.toolSelection;
      if (!nodeById.has(ts.phenomenonId))
        error(
          `mission ${data.id}: step ${step.id} unknown phenomenon ${ts.phenomenonId}`,
          file,
          data.id
        );
      for (const c of ts.candidates)
        if (!nodeById.has(c))
          error(`mission ${data.id}: step ${step.id} unknown tool candidate ${c}`, file, data.id);
      if (!ts.candidates.includes(ts.correct))
        error(
          `mission ${data.id}: step ${step.id} correct tool is not among candidates`,
          file,
          data.id
        );
    }
    for (const ev of step.evidence) {
      if (ev.nodeId && !nodeById.has(ev.nodeId))
        error(
          `mission ${data.id}: step ${step.id} evidence → unknown node ${ev.nodeId}`,
          file,
          data.id
        );
      if (ev.phenomenonId && !nodeById.has(ev.phenomenonId))
        error(
          `mission ${data.id}: step ${step.id} evidence → unknown phenomenon ${ev.phenomenonId}`,
          file,
          data.id
        );
    }
    for (const t of step.transferTargets)
      if (!nodeById.has(t))
        error(`mission ${data.id}: step ${step.id} unknown transfer target ${t}`, file, data.id);
    for (const c of step.historicalClaims) {
      if (
        (c.status === 'attested' || c.status === 'scholarly_interpretation') &&
        c.sources.length === 0
      )
        error(
          `mission ${data.id}: step ${step.id} claim ${c.id} (${c.status}) has no source`,
          file,
          data.id
        );
      for (const s of c.sources)
        if (!sourceIds.has(s))
          error(
            `mission ${data.id}: step ${step.id} claim ${c.id} unknown source ${s}`,
            file,
            data.id
          );
    }
    for (const line of step.dialogue) {
      if (
        line.speaker !== 'learner' &&
        line.speaker !== 'narrator' &&
        nodeById.get(line.speaker)?.type !== 'person'
      )
        error(
          `mission ${data.id}: step ${step.id} dialogue speaker ${line.speaker} is not a person`,
          file,
          data.id
        );
      if (line.status === 'attested' && !line.quotation)
        error(
          `mission ${data.id}: step ${step.id} has an attested line without a quotation record — invented dialogue must never look authentic`,
          file,
          data.id
        );
      if (line.quotation && !quotationById.has(line.quotation))
        error(
          `mission ${data.id}: step ${step.id} unknown quotation ${line.quotation}`,
          file,
          data.id
        );
    }
  }
  for (const v of l.depthVariants)
    for (const s of v.skipSteps)
      if (!stepIds.has(s))
        error(`mission ${data.id}: variant ${v.id} skips unknown step ${s}`, file, data.id);
  if (!hasTransfer) warn(`mission ${data.id} has no transfer_challenge step`, file, data.id);
  if (!hasPrediction) warn(`mission ${data.id} never asks for a prediction`, file, data.id);
}

// ---------------------------------------------------------------------------
// Glossary, routes
// ---------------------------------------------------------------------------

const glossaryEntries: GlossaryEntry[] = [];
for (const { file, data } of glossaryFiles) {
  for (const g of data.entries) {
    if (glossaryEntries.some((x) => x.id === g.id))
      error(`duplicate glossary entry ${g.id}`, file, g.id);
    else glossaryEntries.push(g);
    if (g.nodeId && !nodeById.has(g.nodeId))
      error(`glossary ${g.id}: unknown node ${g.nodeId}`, file, g.id);
  }
}
const routes: RouteDefinition[] = [];
for (const { file, data } of routeFiles) {
  for (const r of data.routes) {
    if (routes.some((x) => x.id === r.id)) error(`duplicate route ${r.id}`, file, r.id);
    else routes.push(r);
    for (const n of r.nodes)
      if (!nodeById.has(n)) error(`route ${r.id}: unknown node ${n}`, file, r.id);
  }
}

// Guided flights: every leg after the first must carry its transition sentence, and the lessons
// flown over should have a spoken overview (otherwise the short purpose is read instead).
const tours: TourDefinition[] = [];
const speakableProblem = (text: string) =>
  /\$|\*\*|^#|\[[^\]]+\]\(/m.test(text) ? 'contains LaTeX or Markdown' : null;
for (const { file, data } of routeFiles) {
  for (const tour of data.tours) {
    if (tours.some((x) => x.id === tour.id)) error(`duplicate tour ${tour.id}`, file, tour.id);
    else tours.push(tour);
    tour.legs.forEach((leg, i) => {
      const label = `tour ${tour.id}, leg ${i + 1}`;
      if (leg.route && !routes.some((r) => r.id === leg.route))
        error(`${label}: unknown route ${leg.route}`, file, tour.id);
      if (leg.world && !worldById.has(leg.world))
        error(`${label}: unknown world ${leg.world}`, file, tour.id);
      if (i > 0 && !leg.transition)
        error(`${label}: a transition sentence is required between two legs`, file, tour.id);
      if (leg.route) {
        const route = routes.find((r) => r.id === leg.route);
        for (const id of route?.nodes ?? []) {
          const node = nodeById.get(id);
          // Missions are practised, never flown over: no spoken overview expected.
          if (!node || node.type === 'mission') continue;
          if (!node.overview)
            warn(`${label}: ${id} has no overview (its short purpose will be read)`, file, id);
        }
      }
    });
  }
}
for (const node of nodes) {
  const text = node.overview ? `${node.overview.fr}\n${node.overview.en}` : '';
  const problem = text && speakableProblem(text);
  if (problem)
    warn(
      `${node.id}: overview ${problem}; it is read aloud as plain text`,
      nodeFileById.get(node.id) ?? '',
      node.id
    );
}

// ---------------------------------------------------------------------------
// Warnings about pedagogical shape
// ---------------------------------------------------------------------------

for (const node of nodes) {
  const file = nodeFileById.get(node.id);
  if (
    node.type === 'mathematical_tool' &&
    !edges.some((e) => e.from === node.id && e.type === 'applies_to')
  )
    warn(`tool ${node.id} has no application`, file, node.id);
  if (
    node.type === 'phenomenon' &&
    !edges.some((e) => e.to === node.id && (e.type === 'models' || e.type === 'explains'))
  )
    warn(`phenomenon ${node.id} has no modelling connection`, file, node.id);
  if (node.type === 'person') {
    const used =
      edges.some((e) => e.from === node.id || e.to === node.id) ||
      missions.some((m) => m.historicalContext.people.includes(node.id));
    if (!used) warn(`person ${node.id} is only decoration (no edge, no mission)`, file, node.id);
  }
}
for (const region of regions)
  if (region.nodeIds.length === 0 && !region.isBridge) {
    // Silhouette regions are expected in the vertical slice: they keep the global geography visible.
  }

// ---------------------------------------------------------------------------
// Layout, search, glossary per locale
// ---------------------------------------------------------------------------

const graph: CompiledGraph = { version: PACKAGE_VERSION, worlds, regions, nodes, edges };

// A flight must follow the prerequisites: rebuild each flight over the whole universe (no horizon,
// no progression) and refuse an essential prerequisite flown after a destination that needs it.
{
  const index = new GraphIndex(graph, missions, { fr: [], en: [] });
  for (const tour of tours) {
    const steps = buildTour(
      tour,
      { graph: index, routes, horizon: null, config: horizon, snapshot: null },
      { everything: true }
    );
    for (const inversion of prerequisiteInversions(steps, index)) {
      const message =
        `${inversion.to} (leg ${inversion.toLeg + 1}) is flown before its ` +
        `${inversion.type === 'requires_essentially' ? 'essential' : 'recommended'} prerequisite ` +
        `${inversion.from} (leg ${inversion.fromLeg + 1})`;
      const file = routeFiles.find((f) => f.data.tours.some((t) => t.id === tour.id))?.file ?? '';
      if (inversion.type === 'requires_essentially') error(message, file, tour.id);
      else warn(message, file, tour.id);
    }
  }
}
const layout = computeLayout(graph, anchors);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

const search: Record<Locale, SearchEntry[]> = { fr: [], en: [] };
const glossary: Record<Locale, GlossaryLocalised[]> = { fr: [], en: [] };
for (const locale of LOCALES) {
  for (const w of worlds)
    search[locale].push({
      id: w.id,
      kind: 'world',
      target: w.id,
      text: w.title[locale],
      terms: tokens(`${w.title[locale]} ${w.purpose[locale]}`),
    });
  for (const r of regions)
    search[locale].push({
      id: r.id,
      kind: 'region',
      target: r.id,
      text: r.title[locale],
      terms: tokens(`${r.title[locale]} ${r.summary[locale]}`),
    });
  for (const n of nodes) {
    const kind: SearchEntry['kind'] =
      n.type === 'mission'
        ? 'mission'
        : n.type === 'person'
          ? 'person'
          : n.type === 'place'
            ? 'place'
            : 'node';
    const aliases = n.aliases?.[locale] ?? [];
    search[locale].push({
      id: n.id,
      kind,
      target: n.id,
      text: n.title[locale],
      terms: tokens([n.title[locale], ...aliases, n.shortPurpose[locale]].join(' ')),
    });
  }
  for (const g of glossaryEntries) {
    glossary[locale].push({
      id: g.id,
      nodeId: g.nodeId,
      preferred: g[locale].preferred,
      aliases: g[locale].aliases,
    });
    if (g.nodeId)
      search[locale].push({
        id: g.id,
        kind: 'glossary',
        target: g.nodeId,
        text: g[locale].preferred,
        terms: tokens([g[locale].preferred, ...g[locale].aliases].join(' ')),
      });
  }
}

// ---------------------------------------------------------------------------
// Report and output
// ---------------------------------------------------------------------------

function printMessages() {
  const fmt = (m: ValidationMessage) =>
    `  ${m.file ? `[${m.file}] ` : ''}${m.id ? `${m.id}: ` : ''}${m.message}`;
  if (warnings.length)
    console.log(`\n${warnings.length} warning(s):\n${warnings.map(fmt).join('\n')}`);
  if (errors.length) console.error(`\n${errors.length} error(s):\n${errors.map(fmt).join('\n')}`);
}

function report(): ValidationReport {
  const counts = {
    worlds: worlds.length,
    regions: regions.length,
    nodes: nodes.length,
    edges: edges.length,
    missions: missions.length,
    exercises: exercises.length,
    simulations: simulations.length,
    sources: sources.length,
    quotations: quotations.length,
    glossary: glossaryEntries.length,
    routes: routes.length,
    tours: tours.length,
    lessons: lessons.length,
    curricula: curricula.length,
  };
  const r: ValidationReport = { createdAt: new Date().toISOString(), errors, warnings, counts };
  printMessages();
  console.log(
    `\ncontent ${PACKAGE_ID}-${PACKAGE_VERSION}: ${Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ')}`
  );
  return r;
}

const validation = report();
if (errors.length > 0) {
  console.error(`\nContent validation FAILED (${errors.length} error(s)).`);
  process.exit(1);
}
if (CHECK_ONLY) {
  console.log('\nContent validation passed.');
  process.exit(0);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const files: ContentManifest['files'] = {};
function emit(name: string, data: unknown) {
  const text = JSON.stringify(data);
  const file = join(OUT_DIR, name);
  writeFileSync(file, text);
  files[name] = {
    path: name,
    sha256: createHash('sha256').update(text).digest('hex'),
    bytes: Buffer.byteLength(text),
  };
}

emit('graph.json', graph);
emit('layout.json', layout);
emit('curricula.json', { curricula, horizon: horizon satisfies HorizonConfig });
emit('missions.json', missions);
emit('exercises.json', exercises);
emit('simulations.json', simulations);
emit(
  'people.json',
  nodes.filter((n) => n.type === 'person')
);
emit(
  'places.json',
  nodes.filter((n) => n.type === 'place')
);
emit('sources.json', { sources, quotations });
emit('glossary.fr.json', glossary.fr);
emit('glossary.en.json', glossary.en);
emit('search.fr.json', search.fr);
emit('search.en.json', search.en);
emit('routes.json', routes);
emit('tours.json', tours);
emit('lessons.json', lessons);
emit('glossary-entries.json', glossaryEntries);
emit('asset-manifest.json', { assets: [] });
emit('report.json', validation);

const manifest: ContentManifest = {
  id: PACKAGE_ID,
  version: PACKAGE_VERSION,
  schemaVersion: SCHEMA_VERSION,
  createdAt: new Date().toISOString(),
  supportedLocales: [...LOCALES],
  curriculumPaths: horizon.paths.map((p) => p.id),
  dependencies: [],
  entryWorlds: worlds.map((w) => w.id),
  files,
};
writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nWrote ${Object.keys(files).length + 1} files to ${rel(OUT_DIR)}.`);
