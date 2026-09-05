import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  CompiledGraph,
  CompiledLayout,
  ContentPackage,
  CurriculumDefinition,
  HorizonConfig,
  MissionDefinition,
  SearchEntry,
  SimulationDefinition,
  ExerciseDefinition,
  RouteDefinition,
  TourDefinition,
} from '../../src/lib/content-schema';
import { GraphIndex } from '../../src/lib/domain/graph';

const ROOT = join(__dirname, '..', '..', 'static', 'content', 'core-0.1.0');

function read<T>(name: string): T {
  return JSON.parse(readFileSync(join(ROOT, name), 'utf8')) as T;
}

/** Loads the compiled package written by `npm run content:compile` (run before the unit tests). */
export function loadPackage(): Pick<
  ContentPackage,
  | 'graph'
  | 'layout'
  | 'horizon'
  | 'missions'
  | 'exercises'
  | 'simulations'
  | 'routes'
  | 'tours'
  | 'curricula'
  | 'search'
> {
  const curricula = read<{ curricula: CurriculumDefinition[]; horizon: HorizonConfig }>(
    'curricula.json'
  );
  return {
    graph: read<CompiledGraph>('graph.json'),
    layout: read<CompiledLayout>('layout.json'),
    horizon: curricula.horizon,
    curricula: curricula.curricula,
    missions: read<MissionDefinition[]>('missions.json'),
    exercises: read<ExerciseDefinition[]>('exercises.json'),
    simulations: read<SimulationDefinition[]>('simulations.json'),
    routes: read<RouteDefinition[]>('routes.json'),
    tours: read<TourDefinition[]>('tours.json'),
    search: {
      fr: read<SearchEntry[]>('search.fr.json'),
      en: read<SearchEntry[]>('search.en.json'),
    },
  };
}

export function loadGraph(): GraphIndex {
  const pkg = loadPackage();
  return new GraphIndex(pkg.graph, pkg.missions, pkg.search);
}
