import { describe, expect, it } from 'vitest';
import type { LessonTool } from '../../src/lib/content-schema';
import {
  applyPlotterAction,
  exercisesForNode,
  initialPlotterState,
  itemVisible,
  lessonFor,
  nextLessonOnRoute,
  plotterStateAt,
  toolStateAt,
  type LessonPlan,
} from '../../src/lib/domain/lesson';
import { loadGraph, loadPackage } from './helpers';

const graph = loadGraph();
const pkg = loadPackage();
const node = (id: string) => graph.getNode(id)!;
type Plotter = Extract<LessonTool, { kind: 'plotter' }>;

describe('lessons', () => {
  it('plays the authored lesson of a node: slides, a free play, exercises', () => {
    const plan = lessonFor(node('concept.function'), pkg.lessons, pkg.exercises);
    expect(plan.authored).toBe(true);
    expect(plan.id).toBe('lesson.concept.function');
    expect(plan.tools.map((t) => t.kind)).toEqual(['plotter']);
    expect(plan.steps.map((s) => s.kind)).toEqual([
      'slide',
      'slide',
      'slide',
      'slide',
      'play',
      'exercises',
    ]);
    const exercises = plan.steps.at(-1)!.exercises;
    expect(exercises.length).toBe(3);
    for (const id of exercises) {
      const exercise = pkg.exercises.find((e) => e.id === id)!;
      expect(exercise.nodeId).toBe('concept.function');
      expect(['numeric', 'symbolic']).toContain(exercise.type);
    }
  });

  it('composes a lesson from the description when none is authored', () => {
    const plan = lessonFor(node('concept.dimension_unit'), pkg.lessons, pkg.exercises);
    expect(plan.authored).toBe(false);
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.steps[0].kind).toBe('slide');
    expect(plan.steps[0].text.fr.length).toBeGreaterThan(40);
    expect(plan.steps[0].text.en.length).toBeGreaterThan(40);
  });

  it('adds a free play and the exercises of the node around a simulation tool', () => {
    const plan = lessonFor(
      node('phenomenon.motion.uniformly_accelerated'),
      pkg.lessons,
      pkg.exercises
    );
    expect(plan.tools[0]).toMatchObject({
      kind: 'simulation',
      simulationId: 'simulation.galileo.inclined_plane',
    });
    const kinds = plan.steps.map((s) => s.kind);
    expect(kinds.at(-2)).toBe('play');
    expect(kinds.at(-1)).toBe('exercises');
    expect(plan.steps.at(-1)!.exercises).toContain('exercise.galileo.ratio_distances');
  });

  it('gives every lesson a lesson, never a mission', () => {
    for (const n of graph.graph.nodes) {
      if (n.type === 'mission') continue;
      const plan = lessonFor(n, pkg.lessons, pkg.exercises);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.steps.every((s) => s.text.fr.trim() && s.text.en.trim())).toBe(true);
    }
  });

  it('replays the plotter actions up to a sentence, accumulating across slides', () => {
    const plan = lessonFor(node('concept.function'), pkg.lessons, pkg.exercises);
    const tool = plan.tools[0] as Plotter;
    expect(plotterStateAt(tool, plan.steps, 0, 0).curves).toEqual([]);
    const afterSecond = plotterStateAt(tool, plan.steps, 0, 1);
    expect(afterSecond.curves.map((c) => c.id)).toEqual(['f']);
    expect(afterSecond.points).toEqual([]);
    expect(plotterStateAt(tool, plan.steps, 0, 2).points.map((p) => p.id)).toEqual(['p2']);
    expect(plotterStateAt(tool, plan.steps, 0, null).points.length).toBe(2);
    // The second slide hides f, which also removes the points sitting on it, and widens the view.
    const next = plotterStateAt(tool, plan.steps, 1, 1);
    expect(next.curves.map((c) => c.id)).toEqual(['g']);
    expect(next.points).toEqual([]);
    expect(next.view.y).toEqual([-2, 16]);
    // A later slide clears everything and relabels the axes.
    const time = plotterStateAt(tool, plan.steps, 2, 0);
    expect(time.curves).toEqual([]);
    expect(time.view.labels).toEqual({ x: 't (s)', y: 'h (m)' });
  });

  it('keeps parameters, applies clear and set', () => {
    const tool: Plotter = {
      id: 'plotter',
      kind: 'plotter',
      variable: 'x',
      view: { x: [-1, 1], y: [-1, 1] },
      parameters: [{ id: 'a', min: 0, max: 2, step: 0.1, value: 1 }],
      input: true,
      initial: [],
    };
    let state = initialPlotterState(tool);
    expect(state.params).toEqual({ a: 1 });
    expect(state.view.labels).toEqual({ x: 'x', y: 'y' });
    state = applyPlotterAction(state, {
      at: 0,
      show: [],
      hide: [],
      clear: false,
      plot: { id: 'f', expr: 'a*x', dashed: false },
      set: { a: 0.5 },
    });
    expect(state.curves.length).toBe(1);
    expect(state.params.a).toBe(0.5);
    state = applyPlotterAction(state, { at: 0, show: [], hide: [], clear: true });
    expect(state.curves).toEqual([]);
    expect(state.order).toEqual([]);
  });

  it('shows and hides the items of any tool from the slides', () => {
    const plan: LessonPlan = {
      id: 'preview',
      node: node('tool.vector'),
      depth: 1,
      authored: true,
      tools: [
        {
          id: 'vectors',
          kind: 'vectors',
          view: { x: [-1, 5], y: [-1, 5] },
          parameters: [],
          vectors: [
            { id: 'u', x: 3, y: 1, components: false, drag: false, hidden: false },
            { id: 'v', x: 1, y: 2, components: false, drag: false, hidden: true },
          ],
          paths: [],
          points: [],
          segments: [],
          sums: [],
        },
      ],
      steps: [
        {
          id: 'one',
          kind: 'slide',
          text: { fr: 'Un. Deux.', en: 'One. Two.' },
          actions: [{ at: 1, show: ['v'], hide: [], clear: false }],
          exercises: [],
        },
        {
          id: 'two',
          kind: 'slide',
          text: { fr: 'Trois.', en: 'Three.' },
          actions: [{ at: 0, show: [], hide: ['u'], clear: false }],
          exercises: [],
        },
      ],
    };
    const tool = plan.tools[0] as Extract<LessonTool, { kind: 'vectors' }>;
    const before = toolStateAt(plan, 'vectors', 0, 0)!;
    expect(tool.vectors.map((v) => itemVisible(v, before))).toEqual([true, false]);
    const shown = toolStateAt(plan, 'vectors', 0, 1)!;
    expect(tool.vectors.map((v) => itemVisible(v, shown))).toEqual([true, true]);
    const later = toolStateAt(plan, 'vectors', 1, null)!;
    expect(tool.vectors.map((v) => itemVisible(v, later))).toEqual([false, true]);
  });

  it('finds the next lesson along the routes, skipping missions', () => {
    const next = (id: string) => nextLessonOnRoute(id, pkg.routes, (x) => graph.getNode(x))?.id;
    expect(next('concept.function')).toBe('concept.graph');
    // After the derivative comes the mission (skipped), then the first stop of the next route.
    expect(next('tool.derivative')).toBe('question.how_to_predict_motion');
    expect(next('phenomenon.motion.with_drag')).toBeUndefined();
  });

  it('lists the exercises of a node, closest depth first, without free explanations', () => {
    const ids = exercisesForNode('tool.derivative', 1, pkg.exercises).map((e) => e.id);
    expect(ids).toContain('exercise.workshop.power_rule');
    expect(ids).not.toContain('exercise.debrief.reflection');
  });
});
