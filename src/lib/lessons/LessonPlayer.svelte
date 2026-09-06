<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import type { ExerciseDefinition, LessonToolKind } from '$lib/content-schema';
  import Markdown from '$lib/components/Markdown.svelte';
  import ExerciseRunner from '$lib/exercises/ExerciseRunner.svelte';
  import SimulationView from '$lib/simulations/SimulationView.svelte';
  import type { AnswerCheck } from '$lib/domain/answers';
  import { autonomyFromHints, makeEvidence } from '$lib/domain/evidence';
  import { nextLessonOnRoute, type LessonPlan } from '$lib/domain/lesson';
  import { splitSentences } from '$lib/domain/speech';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { lesson } from '$lib/state/lesson.svelte';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';
  import { speech } from '$lib/state/speech.svelte';
  import LessonBoard from './LessonBoard.svelte';
  import Plotter from './Plotter.svelte';
  import DimensionsTool from './tools/DimensionsTool.svelte';
  import FieldTool from './tools/FieldTool.svelte';
  import FitTool from './tools/FitTool.svelte';
  import SlopeFieldTool from './tools/SlopeFieldTool.svelte';
  import TimelineTool from './tools/TimelineTool.svelte';
  import VectorsTool from './tools/VectorsTool.svelte';

  let { plan }: { plan: LessonPlan } = $props();

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  const step = $derived(lesson.step);
  const stepIndex = $derived(lesson.index);
  const tool = $derived(lesson.tool);
  const toolState = $derived(tool ? lesson.toolState(tool.id) : null);
  const plotterTool = $derived(tool?.kind === 'plotter' ? tool : null);
  const simulation = $derived.by(() => {
    const current = tool;
    return current?.kind === 'simulation'
      ? pkg.simulations.find((s) => s.id === current.simulationId)
      : undefined;
  });
  const parameters = $derived(tool && 'parameters' in tool ? tool.parameters : []);
  const toolName = (kind: LessonToolKind, title?: { fr: string; en: string }) =>
    title ? L(title) : t(`lesson.tool.${kind}`);
  const exercises = $derived(
    (step?.kind === 'exercises' ? step.exercises : [])
      .map((id) => pkg.exercises.find((e) => e.id === id))
      .filter((e): e is ExerciseDefinition => !!e)
  );
  const totalExercises = $derived(
    plan.steps.filter((s) => s.kind === 'exercises').reduce((n, s) => n + s.exercises.length, 0)
  );
  const nextNode = $derived(nextLessonOnRoute(plan.node.id, pkg.routes, (id) => graph.getNode(id)));
  const text = $derived(step ? L(step.text) : '');
  /** Plain prose is shown sentence by sentence (the one being read stands out); Markdown as is. */
  const plain = $derived(!/[$*#_`[\n]/.test(text));
  const sentences = $derived(plain ? splitSentences(text) : []);
  const playLabel = $derived(
    lesson.status === 'playing'
      ? `⏸ ${t('lesson.pause')}`
      : step?.kind === 'slide'
        ? `▶ ${t('lesson.resume')}`
        : `▶ ${t('lesson.replay')}`
  );
  let showTangent = $state(false);
  let heading = $state<HTMLElement | null>(null);
  const fmt = (v: number) =>
    new Intl.NumberFormat(locale.current, { maximumFractionDigits: 2 }).format(v);

  onMount(() => {
    lesson.open(plan);
    void profile.setLastVisited('node', plan.node.id);
  });
  onDestroy(() => lesson.exit());

  // Keyboard and screen-reader users land on the step title whenever the step changes.
  $effect(() => {
    void lesson.tick;
    heading?.focus({ preventScroll: true });
  });

  const ctx = () => ({ learnerId: profile.active!.id, contentVersion: pkg.manifest.version });

  /** Following the slides to their end counts as a worked example seen (one per node and day). */
  function observed() {
    const learner = profile.active;
    if (!learner) return;
    const today = new Date().toISOString().slice(0, 10);
    const already = learning.evidence.some(
      (e) =>
        e.type === 'worked_example_observed' &&
        e.nodeId === plan.node.id &&
        e.timestamp.slice(0, 10) === today
    );
    if (already) return;
    void learning.append([
      makeEvidence(
        {
          type: 'worked_example_observed',
          nodeId: plan.node.id,
          stepId: plan.id,
          depth: plan.depth,
          discriminator: today,
        },
        ctx()
      ),
    ]);
  }
  $effect(() => {
    const kind = step?.kind;
    const status = lesson.status;
    untrack(() => {
      if (kind === 'exercises' || kind === 'play' || status === 'finished') observed();
    });
  });

  function onResult(exercise: ExerciseDefinition, check: AnswerCheck, value: unknown) {
    const attempts = lesson.recordResult(exercise.id, check, value);
    if (!profile.active) return;
    void learning.append([
      makeEvidence(
        {
          type: check.correct ? 'exercise_solved' : 'exercise_attempted',
          stepId: plan.id,
          exerciseId: exercise.id,
          nodeId: exercise.nodeId,
          phenomenonId: exercise.phenomenonId,
          dimension: exercise.evidenceDimension,
          depth: exercise.depth,
          result: check.correct ? 'correct' : check.score > 0 ? 'partial' : 'incorrect',
          score: check.score,
          autonomy: autonomyFromHints((lesson.hints[exercise.id] ?? []).length),
          payload: { value },
          discriminator: `attempt:${attempts}`,
        },
        ctx()
      ),
    ]);
  }

  function onHint(exercise: ExerciseDefinition, hintId: string) {
    lesson.openHint(exercise.id, hintId);
    if (!profile.active) return;
    void learning.append([
      makeEvidence(
        {
          type: 'hint_opened',
          stepId: plan.id,
          exerciseId: exercise.id,
          nodeId: exercise.nodeId,
          discriminator: hintId,
        },
        ctx()
      ),
    ]);
  }
</script>

<div
  class="lesson"
  data-testid="lesson-player"
  data-node-id={plan.node.id}
  data-step-kind={step?.kind}
  data-step-index={stepIndex}
  data-status={lesson.status}
>
  <header class="lesson__head stack-sm">
    <div class="cluster" style="justify-content: space-between">
      <a
        class="btn btn--sm btn--ghost"
        href="{base}/concept/{plan.node.id}"
        data-testid="lesson-back">← {t('lesson.backToDestination')}</a
      >
      <span class="badge">{t('lesson.title')} · {t(`type.${plan.node.type}`)}</span>
    </div>
    <h1 style="margin: 0; font-size: var(--fs-xl)">{L(plan.node.title)}</h1>
    <ol class="rail" aria-label={t('lesson.step', { n: stepIndex + 1, total: lesson.total })}>
      {#each plan.steps as s, i (s.id)}
        <li
          class="rail__item"
          class:is-done={i < stepIndex}
          class:is-active={i === stepIndex}
          title={t(`lesson.kind.${s.kind}`)}
        >
          {i + 1}
        </li>
      {/each}
    </ol>
  </header>

  {#if lesson.status === 'finished'}
    <section class="card card--paper stack" data-testid="lesson-finished">
      <h2 style="margin: 0">{t('lesson.finished')}</h2>
      <p style="margin: 0">
        {t('lesson.finishedText', { n: lesson.solved, total: totalExercises })}
      </p>
      <div class="cluster">
        {#if nextNode}
          <a
            class="btn btn--primary"
            href="{base}/lesson/{nextNode.id}"
            data-testid="lesson-next-lesson"
            >{t('lesson.nextLesson', { title: L(nextNode.title) })}</a
          >
        {/if}
        <a class="btn" href="{base}/concept/{plan.node.id}">{t('lesson.backToDestination')}</a>
        <button class="btn btn--ghost" type="button" onclick={() => lesson.open(plan)}
          >↻ {t('lesson.replay')}</button
        >
      </div>
    </section>
  {:else if step}
    <div class="lesson__body">
      <section
        class="lesson__text card card--paper stack-sm"
        data-testid="lesson-step"
        data-step-id={step.id}
      >
        <p class="small muted" style="margin: 0">
          <span class="badge">{t(`lesson.kind.${step.kind}`)}</span>
          {t('lesson.step', { n: stepIndex + 1, total: lesson.total })}
        </p>
        <h2 class="lesson__title" tabindex="-1" bind:this={heading}>
          {step.title ? L(step.title) : L(plan.node.title)}
        </h2>
        {#if plain}
          <p class="lesson__prose" data-testid="lesson-text">
            {#each sentences as sentence, i (i)}
              <span
                class="lesson__sentence"
                class:is-current={lesson.sentence === i}
                class:is-read={lesson.sentence !== null && i < lesson.sentence}>{sentence}</span
              >{i < sentences.length - 1 ? ' ' : ''}
            {/each}
          </p>
        {:else}
          <Markdown {text} class="lesson__prose" />
        {/if}

        {#if step.kind === 'exercises'}
          {#if exercises.length}
            <div class="stack" data-testid="lesson-exercises">
              {#each exercises as exercise, i (exercise.id)}
                <div class="card stack-sm">
                  <ExerciseRunner
                    {exercise}
                    index={i + 1}
                    record={lesson.records[exercise.id]}
                    hintsOpened={lesson.hints[exercise.id] ?? []}
                    onresult={(check, value) => onResult(exercise, check, value)}
                    onhint={(id) => onHint(exercise, id)}
                  />
                </div>
              {/each}
            </div>
            <p class="small muted" style="margin: 0" data-testid="lesson-exercises-done">
              {t('lesson.exercisesDone', { n: lesson.solved, total: exercises.length })}
            </p>
          {:else}
            <p class="muted">{t('lesson.noExercises')}</p>
          {/if}
        {/if}

        <div
          class="cluster lesson__controls"
          class:lesson__controls--flow={step.kind === 'exercises'}
          role="group"
          aria-label={t('lesson.title')}
        >
          <button
            class="btn btn--sm btn--icon"
            type="button"
            data-testid="lesson-prev"
            disabled={stepIndex === 0}
            aria-label={t('lesson.prev')}
            title={t('lesson.prev')}
            onclick={() => lesson.prev()}>⏮</button
          >
          <button
            class="btn btn--sm"
            type="button"
            data-testid="lesson-toggle"
            onclick={() => lesson.togglePause()}>{playLabel}</button
          >
          <button
            class="btn btn--sm btn--primary"
            type="button"
            data-testid="lesson-next"
            onclick={() => lesson.next()}
            >{stepIndex >= lesson.total - 1 ? t('lesson.finished') : t('lesson.next')} ⏭</button
          >
          <button
            class="btn btn--sm btn--ghost"
            type="button"
            data-testid="lesson-voice"
            aria-pressed={lesson.voiceOn}
            disabled={!speech.available}
            onclick={() => lesson.setVoice(!lesson.voiceOn)}
          >
            {lesson.voiceOn ? '🔊' : '🔇'}
            {t('lesson.voice')}
          </button>
        </div>
        {#if !speech.available}<p class="small muted" style="margin: 0">
            {t('lesson.noVoice')}
          </p>{/if}
        {#if !plan.authored}<p class="small muted" style="margin: 0">{t('lesson.auto')}</p>{/if}
      </section>

      <aside class="lesson__tool" data-testid="lesson-tool" data-tool={tool?.kind ?? 'board'}>
        {#if plan.tools.length > 1}
          <div class="segmented lesson__tabs" role="tablist" aria-label={t('lesson.tools')}>
            {#each plan.tools as candidate (candidate.id)}
              <button
                type="button"
                role="tab"
                aria-selected={tool?.id === candidate.id}
                disabled={!lesson.interactive && tool?.id !== candidate.id}
                data-testid="lesson-tab-{candidate.id}"
                onclick={() => lesson.chooseTool(candidate.id)}
                >{toolName(candidate.kind, candidate.title)}</button
              >
            {/each}
          </div>
        {/if}
        {#if tool && toolState}
          <div class="card stack-sm">
            {#if tool.kind === 'plotter' && toolState.plotter}
              <Plotter
                plot={toolState.plotter}
                variable={tool.variable}
                interactive={lesson.interactive}
                customExpression={lesson.customExpression}
                marker={lesson.marker}
                {showTangent}
                onmarker={(x) => (lesson.marker = x)}
              />
            {:else if tool.kind === 'simulation'}
              {#if simulation}
                <SimulationView {simulation} />
                <p class="small muted" style="margin: 0">{t('lesson.simulationHint')}</p>
              {/if}
            {:else if tool.kind === 'vectors'}
              <VectorsTool {tool} tstate={toolState} interactive={lesson.interactive} />
            {:else if tool.kind === 'slope_field'}
              <SlopeFieldTool {tool} tstate={toolState} interactive={lesson.interactive} />
            {:else if tool.kind === 'fit'}
              <FitTool {tool} tstate={toolState} interactive={lesson.interactive} />
            {:else if tool.kind === 'field'}
              <FieldTool {tool} tstate={toolState} interactive={lesson.interactive} />
            {:else if tool.kind === 'dimensions'}
              <DimensionsTool {tool} interactive={lesson.interactive} />
            {:else if tool.kind === 'timeline'}
              <TimelineTool {tool} tstate={toolState} interactive={lesson.interactive} />
            {/if}
            {#if lesson.interactive && (parameters.length || plotterTool)}
              <div class="stack-sm" data-testid="tool-controls">
                {#if plotterTool?.input}
                  <label class="field">
                    <span class="label">{t('lesson.expression')}</span>
                    <input
                      class="input"
                      type="text"
                      spellcheck="false"
                      autocomplete="off"
                      placeholder="x^2 - 2*x"
                      bind:value={lesson.customExpression}
                      data-testid="plotter-expression"
                    />
                    <span class="small muted"
                      >{t('lesson.expressionHint', { v: plotterTool.variable })}</span
                    >
                  </label>
                {/if}
                {#each parameters as p (p.id)}
                  <label class="field">
                    <span class="label"
                      >{p.label ? L(p.label) : p.id} = {fmt(
                        toolState.params[p.id] ?? p.value
                      )}</span
                    >
                    <input
                      type="range"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={toolState.params[p.id] ?? p.value}
                      oninput={(e) =>
                        lesson.setParameter(tool.id, p.id, Number(e.currentTarget.value))}
                      data-testid="plotter-param-{p.id}"
                    />
                  </label>
                {/each}
                {#if plotterTool}
                  <div class="cluster small">
                    <span class="muted">{t('lesson.markerHint')}</span>
                    <label class="cluster"
                      ><input type="checkbox" bind:checked={showTangent} />
                      {t('lesson.showTangent')}</label
                    >
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {:else}
          <LessonBoard node={plan.node} depth={plan.depth} />
        {/if}
      </aside>
    </div>
  {/if}
</div>

<style>
  .lesson {
    display: grid;
    gap: var(--space-3);
  }
  .lesson__body {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    align-items: start;
  }
  .lesson__body > * {
    min-width: 0;
  }
  .lesson__title {
    margin: 0;
    font-size: var(--fs-lg);
  }
  .lesson__title:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  .lesson__prose {
    font-size: 1.05rem;
    line-height: 1.6;
  }
  .lesson__sentence {
    transition: background-color 0.3s ease;
    border-radius: 0.2rem;
  }
  .lesson__sentence.is-current {
    background: rgba(47, 79, 201, 0.16);
    box-shadow: 0 0 0 3px rgba(47, 79, 201, 0.16);
  }
  .lesson__sentence.is-read {
    opacity: 0.72;
  }
  .lesson__controls {
    position: sticky;
    bottom: calc(var(--safe-bottom) + var(--space-2));
    z-index: 2;
    padding: var(--space-2) 0;
    background: var(--paper, #f7f1e3);
  }
  .lesson__controls--flow {
    position: static;
  }
  .lesson__tool {
    position: sticky;
    top: var(--space-3);
    display: grid;
    gap: var(--space-2);
  }
  .lesson__tabs {
    justify-self: start;
  }
  .rail {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .rail__item {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--border-strong);
    font-size: 0.75rem;
    color: var(--muted);
  }
  .rail__item.is-done {
    background: var(--accent);
    color: #0b1020;
    border-color: var(--accent);
  }
  .rail__item.is-active {
    border-color: var(--focus);
    color: var(--focus);
    font-weight: 700;
  }
  @media (max-width: 900px) {
    .lesson__body {
      grid-template-columns: 1fr;
    }
    .lesson__tool {
      order: -1;
      position: static;
    }
  }
</style>
