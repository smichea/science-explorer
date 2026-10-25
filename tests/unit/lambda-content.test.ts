import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { loadPackage, loadGraph } from './helpers';
import { lessonFor, nextLessonOnRoute, toolStateAt } from '../../src/lib/domain/lesson';
import { alphaKey, parseLambda } from '../../src/lib/domain/lambda';
import { LessonSchema } from '../../src/lib/content-schema/lesson';

describe('lambda discovery content', () => {
  const pkg = loadPackage();
  const graph = loadGraph();
  for (const nodeId of ['concept.lambda_calculus', 'concept.lambda_reduction_paths']) {
    it(`${nodeId} has a bilingual guided lesson, a workbench and corrected exercises`, () => {
      const node = graph.getNode(nodeId)!;
      expect(node).toBeDefined();
      const plan = lessonFor(node, pkg.lessons, pkg.exercises, 1);
      expect(plan.authored).toBe(true);
      expect(plan.steps.filter((s) => s.kind === 'slide').length).toBeGreaterThanOrEqual(5);
      expect(plan.steps.some((s) => s.kind === 'play')).toBe(true);
      expect(plan.steps.flatMap((s) => s.exercises)).toHaveLength(3);
      for (const step of plan.steps) {
        const state = toolStateAt(plan, plan.tools[0].id, plan.steps.indexOf(step), null)!;
        expect(() => parseLambda(state.lambdaTerm!)).not.toThrow();
        for (const lang of ['fr', 'en'] as const) {
          expect(step.text[lang].length).toBeGreaterThan(30);
          for (const match of step.text[lang].matchAll(/\$([^$]+)\$/g))
            expect(() => katex.renderToString(match[1], { throwOnError: true })).not.toThrow();
        }
      }
    });
  }
  it('changes the expression with the narrative, and validates syntax before compiling content', () => {
    const plan = lessonFor(
      graph.getNode('concept.lambda_calculus')!,
      pkg.lessons,
      pkg.exercises,
      1
    );
    expect(alphaKey(parseLambda(toolStateAt(plan, 'diagram', 0, null)!.lambdaTerm!))).toBe(
      alphaKey(parseLambda('λx. x'))
    );
    expect(alphaKey(parseLambda(toolStateAt(plan, 'diagram', 2, null)!.lambdaTerm!))).toBe(
      alphaKey(parseLambda('(λx. x x) (λz. z)'))
    );
    expect(
      LessonSchema.safeParse({
        id: 'lesson.bad',
        nodeId: 'concept.lambda_calculus',
        tools: [{ id: 'bad', kind: 'lambda_diagram', term: '(λx.)' }],
      }).success
    ).toBe(false);
    const route = pkg.routes.find((r) => r.id === 'route.lambda.discovery')!;
    expect(route.nodes).toEqual(['concept.lambda_calculus', 'concept.lambda_reduction_paths']);
    const next = (id: string) => nextLessonOnRoute(id, pkg.routes, (x) => graph.getNode(x));
    expect(next('concept.lambda_calculus')?.id).toBe('concept.lambda_reduction_paths');
    expect(next('concept.lambda_reduction_paths')).toBeNull();
  });
});
