import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CompiledGraph, ContentManifest, MissionDefinition, ValidationReport } from '../../src/lib/content-schema';

const ROOT = join(__dirname, '..', '..');
const OUT = join(ROOT, 'static', 'content', 'core-0.1.0');
const read = <T>(name: string) => JSON.parse(readFileSync(join(OUT, name), 'utf8')) as T;

describe('content package', () => {
  it('validates without errors', () => {
    const result = spawnSync('npx', ['tsx', '--tsconfig', 'scripts/tsconfig.json', 'scripts/compile-content.ts', '--check'], { cwd: ROOT, encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('Content validation passed');
  });

  it('is compiled with every file listed in the manifest', () => {
    const manifest = read<ContentManifest>('manifest.json');
    expect(manifest.id).toBe('core');
    expect(manifest.supportedLocales).toEqual(['fr', 'en']);
    for (const file of Object.values(manifest.files)) expect(existsSync(join(OUT, file.path)), file.path).toBe(true);
    const report = read<ValidationReport>('report.json');
    expect(report.errors).toHaveLength(0);
  });

  it('covers the vertical slice: three worlds, all regions, the derivative and its mission', () => {
    const graph = read<CompiledGraph>('graph.json');
    expect(graph.worlds.map((w) => w.id).sort()).toEqual(['world.chemistry', 'world.mathematics', 'world.physics']);
    expect(graph.regions.filter((r) => !r.isBridge)).toHaveLength(30);
    expect(graph.regions.filter((r) => r.isBridge)).toHaveLength(9);
    const derivative = graph.nodes.find((n) => n.id === 'tool.derivative')!;
    expect(derivative.backpack).toBe(true);
    expect(derivative.depths.map((d) => d.stage)).toEqual(['terminale', 'mpsi', 'mp']);
    expect(graph.edges.filter((e) => e.from === 'tool.derivative' && e.type === 'applies_to' && e.coverageEligible).length).toBeGreaterThanOrEqual(3);
    const missions = read<MissionDefinition[]>('missions.json');
    const galileo = missions.find((m) => m.id === 'mission.galileo.inclined_plane')!;
    expect(galileo.historicalContext.places).toContain('place.padua');
    expect(galileo.historicalContext.people).toContain('person.galileo_galilei');
    expect(galileo.historicalContext.date.certainty).toBe('interval');
    expect(galileo.experience.steps.some((s) => s.type === 'prediction')).toBe(true);
    expect(galileo.experience.steps.filter((s) => s.type === 'transfer_challenge')).toHaveLength(2);
    expect(galileo.experience.steps.every((s) => s.dialogue.every((d) => d.status !== 'attested' || d.quotation))).toBe(true);
  });

  it('keeps every learner-facing string in both languages', () => {
    const graph = read<CompiledGraph>('graph.json');
    for (const n of graph.nodes) {
      expect(n.title.fr.length, n.id).toBeGreaterThan(0);
      expect(n.title.en.length, n.id).toBeGreaterThan(0);
      expect(n.shortPurpose.fr.length, n.id).toBeGreaterThan(0);
      expect(n.shortPurpose.en.length, n.id).toBeGreaterThan(0);
      for (const d of n.depths) expect(d.outcomes.fr.length, n.id).toBe(d.outcomes.en.length);
    }
  });
});
