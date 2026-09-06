import type {
  CompiledGraph,
  CompiledLayout,
  ContentManifest,
  ContentPackage,
  CurriculumDefinition,
  ExerciseDefinition,
  GlossaryEntry,
  GlossaryLocalised,
  HorizonConfig,
  MissionDefinition,
  QuotationDefinition,
  RouteDefinition,
  TourDefinition,
  SearchEntry,
  SimulationDefinition,
  SourceDefinition,
  ValidationReport,
  LessonDefinition,
} from '../../content-schema';

export const BUNDLED_PACKAGE = { id: 'core', version: '0.1.0' } as const;

export function packagePath(base: string, id = BUNDLED_PACKAGE.id, version = BUNDLED_PACKAGE.version): string {
  return `${base}/content/${id}-${version}`;
}

type Fetch = typeof fetch;

async function getJson<T>(fetchFn: Fetch, url: string): Promise<T> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Loads the bundled content package (manifest first, then every file it lists). */
export async function loadContentPackage(base: string, fetchFn: Fetch = fetch): Promise<ContentPackage> {
  const root = packagePath(base);
  const manifest = await getJson<ContentManifest>(fetchFn, `${root}/manifest.json`);
  const file = <T>(name: string) => getJson<T>(fetchFn, `${root}/${name}`);
  const [graph, layout, curricula, missions, exercises, simulations, sources, glossaryFr, glossaryEn, searchFr, searchEn, routes, tours, lessons, glossaryEntries, report] = await Promise.all([
    file<CompiledGraph>('graph.json'),
    file<CompiledLayout>('layout.json'),
    file<{ curricula: CurriculumDefinition[]; horizon: HorizonConfig }>('curricula.json'),
    file<MissionDefinition[]>('missions.json'),
    file<ExerciseDefinition[]>('exercises.json'),
    file<SimulationDefinition[]>('simulations.json'),
    file<{ sources: SourceDefinition[]; quotations: QuotationDefinition[] }>('sources.json'),
    file<GlossaryLocalised[]>('glossary.fr.json'),
    file<GlossaryLocalised[]>('glossary.en.json'),
    file<SearchEntry[]>('search.fr.json'),
    file<SearchEntry[]>('search.en.json'),
    file<RouteDefinition[]>('routes.json'),
    file<TourDefinition[]>('tours.json'),
    file<LessonDefinition[]>('lessons.json'),
    file<GlossaryEntry[]>('glossary-entries.json'),
    file<ValidationReport>('report.json'),
  ]);
  return {
    manifest,
    graph,
    layout,
    curricula: curricula.curricula,
    horizon: curricula.horizon,
    missions,
    exercises,
    simulations,
    sources: sources.sources,
    quotations: sources.quotations,
    glossary: { fr: glossaryFr, en: glossaryEn },
    search: { fr: searchFr, en: searchEn },
    routes,
    tours,
    lessons,
    glossaryEntries,
    report,
  };
}
