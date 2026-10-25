import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  BUNDLED_PACKAGE,
  loadContentPackage,
  packagePath,
} from '../../src/lib/domain/content/package';

it('loads the lambda lessons when an older service worker still caches the previous graph', async () => {
  const base = '/science-explorer';
  const root = packagePath(join(__dirname, '..', '..', 'static'));
  const graph = JSON.parse(readFileSync(join(root, 'graph.json'), 'utf8'));
  const oldGraph = {
    ...graph,
    nodes: graph.nodes.filter((node: { id: string }) => !node.id.startsWith('concept.lambda_')),
  };
  const oldCache = new Map([[`${base}/content/core-0.1.0/graph.json`, JSON.stringify(oldGraph)]]);
  const requests: string[] = [];
  const fetchWithOldCache: typeof fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    const cached = oldCache.get(url);
    return new Response(cached ?? readFileSync(join(root, url.split('/').at(-1)!), 'utf8'), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const pkg = await loadContentPackage(base, fetchWithOldCache);
  expect(pkg.manifest.version).toBe(BUNDLED_PACKAGE.version);
  expect(pkg.graph.version).toBe(BUNDLED_PACKAGE.version);
  expect(pkg.graph.nodes.some((node) => node.id === 'concept.lambda_calculus')).toBe(true);
  expect(pkg.lessons.some((lesson) => lesson.nodeId === 'concept.lambda_reduction_paths')).toBe(
    true
  );
  expect(requests.every((url) => !url.includes('/core-0.1.0/'))).toBe(true);
});
