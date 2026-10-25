import { describe, expect, it } from 'vitest';
import {
  alphaKey,
  freeLambda,
  freeOccurrences,
  lambdaSize,
  LAMBDA_EXAMPLES,
  parseLambda as p,
  printLambda,
  redexPaths,
  reduceLambda,
  reductionGraph,
} from '../../src/lib/domain/lambda';
import { lambdaDiagram, morphDiagram } from '../../src/lib/domain/lambdaDiagram';

const sample = (name: string) => p(LAMBDA_EXAMPLES.find((e) => e.id === name)!.source);
const key = (source: string) => alphaKey(p(source));

describe('lambda calculus: syntax, binding, reduction and paths', () => {
  it('parses association, scope and both lambda spellings; rejects every unconsumed character', () => {
    expect(key('\\x y. x y')).toBe(key('λx. λy. x y'));
    expect(key('a b c')).toBe(key('(a b) c'));
    expect(key('a b c')).not.toBe(key('a (b c)'));
    for (const bad of ['', 'λ.x', 'λx x', '(x', 'x)', 'x + y', 'x.y', '42', 'λx.'])
      expect(() => p(bad)).toThrow();
    for (const { source } of LAMBDA_EXAMPLES) expect(key(printLambda(p(source)))).toBe(key(source));
    expect(() => p('('.repeat(200) + 'x' + ')'.repeat(200))).toThrow();
  });
  it('preserves free variables, shadowing and parameter identity, including fresh-name collisions', () => {
    const r = reduceLambda(sample('capture'), '');
    expect(alphaKey(r.after)).toBe(key('λz. y'));
    expect([...freeLambda(r.after)]).toEqual(['y']);
    expect(r.renamed).toHaveLength(1);
    expect(alphaKey(reduceLambda(p('(λx. λx. x) y'), '').after)).toBe(key('λz. z'));
    expect(alphaKey(reduceLambda(p("(λx. λy. λy'. x y) y"), '').after)).toBe(key('λu. λv. y u'));
    expect(alphaKey(reduceLambda(p('λy. (λx. λy. x) y'), 'b').after)).toBe(key('λa. λb. a'));
    expect(freeOccurrences(p('x (λx. x) x'), 'x')).toBe(2);
  });
  it('has the 3- and 4-step paths of the workbook, including size growth', () => {
    const run = (paths: string[]) => {
      let term = sample('paths');
      const sizes = [lambdaSize(term)];
      for (const path of paths) {
        term = reduceLambda(term, path).after;
        sizes.push(lambdaSize(term));
      }
      expect(alphaKey(term)).toBe(key('λx. x'));
      return sizes;
    };
    expect(run(['a', '', ''])).toEqual([10, 7, 5, 2]);
    expect(run(['', 'f', '', ''])).toEqual([10, 11, 8, 5, 2]);
    expect(redexPaths(sample('paths'), 'normal')[0]).toBe('');
    expect(redexPaths(sample('paths'), 'applicative')[0]).toBe('a');
  });
  it('erases a diverging argument and computes the successor of Church two', () => {
    expect(alphaKey(reduceLambda(sample('escape'), '').after)).toBe(key('λx. x'));
    expect(alphaKey(reduceLambda(sample('omega'), '').after)).toBe(alphaKey(sample('omega')));
    let term = sample('church');
    let steps = 0;
    while (redexPaths(term).length && steps++ < 30)
      term = reduceLambda(term, redexPaths(term)[0]).after;
    expect(alphaKey(term)).toBe(key('λf. λx. f (f (f x))'));
  });
  it('keeps self loops and distinct edges that lead to the same alpha class', () => {
    const loop = reductionGraph(sample('omega'));
    expect(loop.nodes).toHaveLength(1);
    expect(loop.edges).toHaveLength(1);
    expect(loop.edges[0].from).toBe(loop.edges[0].to);
    expect(loop.nodes[0].normal).toBe(false);
    expect(loop.truncated).toBe(false);
    const branching = reductionGraph(p('(λx. x) ((λy. y) (λz. z))'));
    const start = branching.edges.filter((e) => e.from === 0);
    expect(start).toHaveLength(2);
    expect(start[0].to).toBe(start[1].to);
    expect(new Set(start.map((e) => e.path)).size).toBe(2);
    const escape = reductionGraph(sample('escape'));
    expect(escape.nodes.some((n) => n.normal)).toBe(true);
    expect(escape.edges.some((e) => e.from === e.to)).toBe(true);
  });
  it('marks exploration frontiers separately from normal forms and enforces resource bounds', () => {
    const graph = reductionGraph(sample('paths'), 0);
    expect(graph.truncated).toBe(true);
    expect(graph.nodes[0].frontier).toBe(true);
    expect(graph.nodes[0].normal).toBe(false);
    expect(reductionGraph(p('λx. x'), 0).truncated).toBe(false);
    expect(reductionGraph(sample('paths'), 8, 1).nodes).toHaveLength(1);
    const huge = '(λx. x x x x x x x x) (' + 'λa. '.repeat(70) + 'a)';
    expect(() => reduceLambda(p(huge), '')).toThrow('size');
  });
  it('draws actual lexical bindings and moves two independent copies from the argument', () => {
    const shadow = lambdaDiagram(p('λx. λx. x'));
    const bars = shadow.strokes.filter((s) => s.kind === 'bar');
    const wire = shadow.strokes.find((s) => s.kind === 'wire')!;
    expect(wire.binder).toBe(bars.find((s) => s.y1 === wire.y1)!.owner);
    expect(wire.y1).toBe(Math.max(...bars.map((s) => s.y1)));
    const r = reduceLambda(sample('copy'), '');
    expect(r.count).toBe(2);
    expect(r.origins.size).toBe(4);
    const before = lambdaDiagram(r.before),
      after = lambdaDiagram(r.after);
    for (const stroke of after.strokes.filter((s) => r.origins.has(s.owner))) {
      const animated = morphDiagram(before, after, r, 0).find((s) => s.key === stroke.key)!;
      const origin = before.strokes.find(
        (s) => s.key === `${stroke.kind}:${r.origins.get(stroke.owner)}`
      )!;
      expect([animated.x1, animated.y1]).toEqual([origin.x1, origin.y1]);
    }
    expect(morphDiagram(before, after, r, 1).filter((s) => s.opacity > 0).length).toBe(
      after.strokes.length
    );
  });
});
