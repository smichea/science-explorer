<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import type { MissionDefinition, StepDefinition } from '$lib/content-schema';
  import EvidenceBadge from '$lib/components/EvidenceBadge.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import NodeChip from '$lib/components/NodeChip.svelte';
  import ExerciseRunner from '$lib/exercises/ExerciseRunner.svelte';
  import SimulationView from '$lib/simulations/SimulationView.svelte';
  import { announcer } from '$lib/accessibility/announce.svelte';
  import { formatHistoricalDate, formatPercent } from '$lib/domain/i18n/format';
  import {
    createSession,
    currentStep,
    reduce,
    sessionProgress,
    stepIsComplete,
    stepsForVariant,
    type MissionCommand,
  } from '$lib/domain/mission/machine';
  import type { MissionSession } from '$lib/persistence/db';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';

  let { mission, guide = false }: { mission: MissionDefinition; guide?: boolean } = $props();

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  let session = $state.raw<MissionSession | null>(null);
  let completed = $state(false);
  let ready = $state(false);
  let inputDraft = $state<Record<string, string>>({});
  let explanationDraft = $state('');
  let busy = $state(false);

  const steps = $derived(session ? stepsForVariant(mission, session.variantId) : []);
  const step = $derived(session ? currentStep(mission, session) : undefined);
  const stepState = $derived(session && step ? session.stepStates[step.id] : undefined);
  const complete = $derived(!!(session && step && stepIsComplete(step, session)));
  const progress = $derived(session ? sessionProgress(mission, session) : { index: 0, total: 0 });
  const stepIndex = $derived(step ? steps.findIndex((s) => s.id === step.id) : -1);

  const ctx = () => ({ learnerId: profile.active!.id, contentVersion: pkg.manifest.version });

  onMount(() => {
    const open = learning.sessionFor(mission.id);
    if (open) {
      session = open;
      completed = open.status === 'completed';
    }
    ready = true;
    void profile.setLastVisited('mission', mission.id);
  });

  async function start(variantId: string) {
    if (!profile.active) return;
    const transition = createSession(mission, variantId, ctx(), locale.current);
    session = transition.session;
    await learning.commitStep(transition.session, transition.evidence);
    announcer.say(L(mission.title));
  }

  async function dispatch(command: MissionCommand) {
    if (!session || !profile.active || busy) return;
    busy = true;
    try {
      const transition = reduce(mission, session, command, ctx());
      session = transition.session;
      await learning.commitStep(transition.session, transition.evidence);
      if (transition.completedMission) {
        completed = true;
        announcer.say(t('mission.completed'));
      } else if (
        command.type === 'advance' ||
        command.type === 'back' ||
        command.type === 'guide_goto' ||
        command.type === 'guide_skip'
      ) {
        const next = currentStep(mission, transition.session);
        if (next)
          announcer.say(
            `${t('mission.step', { n: sessionProgress(mission, transition.session).index, total: sessionProgress(mission, transition.session).total })} — ${L(next.title)}`
          );
        inputDraft = {};
        explanationDraft = '';
        document
          .getElementById('mission-step')
          ?.scrollIntoView({ block: 'start', behavior: 'auto' });
      }
    } finally {
      busy = false;
    }
  }

  // Language switching updates the same session, never creates another one.
  $effect(() => {
    const l = locale.current;
    untrack(() => {
      if (session && session.locale !== l && !completed)
        void dispatch({ type: 'locale', locale: l });
    });
  });

  function sourceLabel(id: string): string {
    const s = pkg.sources.find((x) => x.id === id);
    return s ? `${s.authors[0] ?? ''} ${s.year}` : id;
  }

  function speakerName(id: string): string {
    if (id === 'narrator') return t('mission.dialogue');
    if (id === 'learner') return profile.active?.name ?? '';
    return L(graph.getNode(id)?.title);
  }

  function submitInputs(event: SubmitEvent, s: StepDefinition) {
    event.preventDefault();
    if (s.completion.kind !== 'inputs') return;
    const values: Record<string, number | string> = {};
    for (const input of s.completion.inputs) {
      const raw = inputDraft[input.id] ?? '';
      values[input.id] = input.kind === 'text' ? raw : Number(raw.replace(',', '.'));
    }
    void dispatch({ type: 'inputs', values });
  }

  function hintsForExercise(exerciseId: string): string[] {
    return (stepState?.hintsOpened ?? [])
      .filter((h) => h.startsWith(`${exerciseId}:`))
      .map((h) => h.slice(exerciseId.length + 1));
  }

  const toolReport = $derived(
    learning.snapshot?.coverage.get(mission.learning.toolsIntroduced[0] ?? '')
  );
  const toolState = $derived(
    learning.snapshot?.nodeStates.get(mission.learning.toolsIntroduced[0] ?? '')
  );
  const confidenceLabel = $derived(
    toolState ? t(`backpack.confidence.${toolState.mastery.confidenceLabel}`) : ''
  );
  const suggested = $derived.by(() => {
    const explored = new Set(
      toolReport?.applications.filter((a) => a.value >= 0.4).map((a) => a.phenomenonId) ?? []
    );
    return (toolReport?.applications ?? [])
      .filter((a) => !explored.has(a.phenomenonId))
      .map((a) => graph.getNode(a.phenomenonId))
      .filter((n) => !!n)
      .slice(0, 3);
  });

  function returnToMap() {
    const tool = mission.learning.toolsIntroduced[0];
    void goto(
      tool ? `${base}/concept/${tool}?layer=applications&tool=${tool}` : `${base}/universe`
    );
  }
</script>

<div class="mission" data-testid="mission-player" data-mission-id={mission.id}>
  <header class="mission__head">
    <div class="mission__meta">
      <a
        class="btn btn--sm btn--ghost"
        href="{base}/concept/{mission.id}"
        aria-label={t('common.back')}>← {t('nav.universe')}</a
      >
      <h1 style="font-size: var(--fs-xl); margin: 0">{L(mission.title)}</h1>
      <div class="cluster small">
        <span class="chip"
          >📍 {mission.historicalContext.places
            .map((p) => L(graph.getNode(p)?.title))
            .join(', ')}</span
        >
        <span class="chip"
          >🗓 {formatHistoricalDate(mission.historicalContext.date, locale.current)}
          <span class="muted"
            >({t(('certainty.' + mission.historicalContext.date.certainty) as never)})</span
          ></span
        >
        <span class="chip"
          >👤 {mission.historicalContext.people
            .map((p) => L(graph.getNode(p)?.title))
            .join(', ')}</span
        >
        {#if session}<span class="chip" data-testid="mission-progress"
            >{t('mission.step', { n: progress.index, total: progress.total })}</span
          >{/if}
      </div>
    </div>
    {#if session && !completed}
      <ol class="rail" aria-label={t('mission.step', { n: progress.index, total: progress.total })}>
        {#each steps as s, i (s.id)}
          {@const st = session.stepStates[s.id]}
          <li
            class="rail__item"
            class:is-active={s.id === step?.id}
            class:is-done={st?.status === 'completed'}
            class:is-skipped={st?.status === 'skipped'}
            title={L(s.title)}
          >
            <span class="visually-hidden"
              >{L(s.title)} — {t(
                ('mission.stepStatus.' +
                  (s.id === step?.id
                    ? 'active'
                    : st?.status === 'completed'
                      ? 'completed'
                      : st?.status === 'skipped'
                        ? 'skipped'
                        : 'pending')) as never
              )}</span
            >
            <span aria-hidden="true">{i + 1}</span>
          </li>
        {/each}
      </ol>
    {/if}
  </header>

  {#if !ready}
    <p class="muted">{t('common.loading')}</p>
  {:else if !session}
    <section class="card card--paper stack" data-testid="variant-chooser">
      <p class="lead">{L(mission.summary)}</p>
      <p><strong>{t('mission.role')}</strong> — {L(mission.role)}</p>
      <h2 style="font-size: var(--fs-lg)">{t('mission.chooseVariant')}</h2>
      <div class="grid">
        {#each mission.learning.depthVariants as v (v.id)}
          <div
            class="card stack-sm"
            style="background: rgba(47,79,201,0.06); border-color: #d8d2c4"
          >
            <strong>{L(v.title)}</strong>
            <span class="muted small"
              >{t('mission.variantMinutes', { n: v.minutes })} · {t('concept.depth', {
                n: v.depth,
              })}</span
            >
            {#if v.note}<span class="small">{L(v.note)}</span>{/if}
            <button
              class="btn btn--primary btn--sm"
              type="button"
              onclick={() => start(v.id)}
              data-testid="start-variant-{v.id}">{t('mission.start')}</button
            >
          </div>
        {/each}
      </div>
      <p class="muted small">{L(mission.historicalContext.evidenceSummary)}</p>
    </section>
  {:else if completed}
    <section class="card card--paper stack" data-testid="mission-complete">
      <h2>{t('mission.completed')}</h2>
      <p>{t('mission.completedIntro')}</p>
      <h3>{t('mission.illuminated')}</h3>
      <div class="cluster">
        {#each [...mission.learning.toolsIntroduced, ...mission.learning.phenomena, ...mission.experience.transferTargets] as id (id)}
          {@const n = graph.getNode(id)}
          {#if n}<NodeChip node={n} />{/if}
        {/each}
      </div>
      {#if toolReport && toolState}
        <div class="card" style="background: rgba(47,79,201,0.06); border-color: #d8d2c4">
          <strong>{L(graph.getNode(toolReport.toolId)?.title)}</strong> — {t(
            'backpack.coverageDetail',
            { applied: toolReport.appliedCount, eligible: toolReport.eligibleCount }
          )} ({formatPercent(toolReport.estimate, locale.current)}) · {t('concept.mastery')}
          {formatPercent(toolState.mastery.estimate, locale.current)} · {t('backpack.confidence', {
            label: confidenceLabel,
          })}
        </div>
      {/if}
      {#if suggested.length}
        <h3>{t('mission.suggested')}</h3>
        <div class="cluster">
          {#each suggested as n (n.id)}<NodeChip node={n} showType />{/each}
        </div>
      {/if}
      <div class="cluster">
        <button
          class="btn btn--primary"
          type="button"
          onclick={returnToMap}
          data-testid="return-to-map">{t('mission.finish')}</button
        >
        <a class="btn" href="{base}/backpack">{t('nav.backpack')}</a>
      </div>
    </section>
  {:else if step && stepState}
    <article
      id="mission-step"
      class="step"
      data-testid="mission-step"
      data-step-id={step.id}
      data-step-type={step.type}
    >
      <header class="step__head">
        <span class="badge">{step.type.replace(/_/g, ' ')}</span>
        <h2 style="margin: 0">{L(step.title)}</h2>
        <span class="muted small">{t('mission.duration', { n: step.minutes })}</span>
      </header>

      <div class="card card--paper stack">
        {#if step.dialogue.length}
          <div class="dialogue stack-sm">
            {#each step.dialogue as line, i (i)}
              <p
                class="dialogue__line"
                class:dialogue__line--narrator={line.speaker === 'narrator'}
              >
                <strong>{speakerName(line.speaker)}</strong>
                <EvidenceBadge status={line.status} compact /><br />
                {L(line.text)}
              </p>
            {/each}
          </div>
        {/if}
        <Markdown text={L(step.instructions)} />
        {#if step.historicalClaims.length}
          <details class="claims">
            <summary>{t('mission.claims')} ({step.historicalClaims.length})</summary>
            <ul>
              {#each step.historicalClaims as c (c.id)}
                <li>
                  <EvidenceBadge status={c.status} />
                  {L(c.claim)}{#if c.sources.length}
                    <span class="muted small">— {c.sources.map(sourceLabel).join(' ; ')}</span>{/if}
                </li>
              {/each}
            </ul>
          </details>
        {/if}
        <details class="a11y">
          <summary class="small">{t('mission.a11y')}</summary>
          <p class="small">{L(step.a11y)}</p>
        </details>
      </div>

      {#if step.simulationRef}
        {@const sim = pkg.simulations.find((s) => s.id === step.simulationRef)}
        {#if sim}
          <div class="card">
            <SimulationView
              simulation={sim}
              measurements={stepState.measurements ?? []}
              onmeasure={(m) =>
                dispatch({ type: 'measurement', t: m.t, value: m.value, label: m.label })}
              onparameter={(variable, value) =>
                dispatch({ type: 'parameter_changed', parameter: variable, value })}
            />
            {#if step.completion.kind === 'simulation' && (stepState.measurements?.length ?? 0) < step.completion.minMeasurements}
              <p class="muted small" style="margin: var(--space-2) 0 0">
                {t('mission.needMeasurements', {
                  n: step.completion.minMeasurements,
                  done: stepState.measurements?.length ?? 0,
                })}
              </p>
            {/if}
          </div>
        {/if}
      {/if}

      {#if step.toolSelection}
        <section class="card stack-sm" data-testid="tool-selection">
          <h3 style="margin:0">{t('mission.toolSelection')}</h3>
          <p class="muted small" style="margin:0">
            <NodeChip node={graph.getNode(step.toolSelection.phenomenonId)!} />
          </p>
          <div class="cluster">
            {#each step.toolSelection.candidates as cid (cid)}
              {@const tool = graph.getNode(cid)}
              <button
                class="btn btn--sm"
                class:btn--primary={stepState.toolSelected === cid && stepState.toolCorrect}
                class:btn--danger={stepState.toolSelected === cid &&
                  stepState.toolCorrect === false}
                type="button"
                onclick={() => dispatch({ type: 'select_tool', toolId: cid })}
                data-tool-id={cid}
              >
                {tool ? L(tool.title) : cid}
              </button>
            {/each}
          </div>
          {#if stepState.toolSelected}
            <p class="small" role="status">
              {t('mission.toolSelected', { tool: L(graph.getNode(stepState.toolSelected)?.title) })}
              {stepState.toolCorrect ? t('mission.toolCorrect') : t('mission.toolIncorrect')}
            </p>
          {/if}
        </section>
      {/if}

      {#if step.completion.kind === 'choice'}
        <section class="card card--paper stack-sm" data-testid="step-choice">
          <ul class="choices">
            {#each step.completion.choices as c (c.id)}
              <li>
                <label class="choice" class:is-selected={stepState.choice === c.id}>
                  <input
                    type="radio"
                    name="step-choice"
                    value={c.id}
                    checked={stepState.choice === c.id}
                    onchange={() => dispatch({ type: 'choose', choiceId: c.id })}
                    data-choice-id={c.id}
                  />
                  <span>{L(c.text)}</span>
                </label>
                {#if stepState.choice === c.id && c.feedback && step.type !== 'prediction' && step.type !== 'hypothesis_choice'}<p
                    class="small muted"
                  >
                    {L(c.feedback)}
                  </p>{/if}
              </li>
            {/each}
          </ul>
          {#if stepState.choice && (step.type === 'prediction' || step.type === 'hypothesis_choice')}<p
              class="small muted"
              role="status"
            >
              {t('mission.predictionLocked')}
            </p>{/if}
        </section>
      {:else if step.completion.kind === 'inputs'}
        <form
          class="card card--paper stack-sm"
          onsubmit={(e) => submitInputs(e, step)}
          data-testid="step-inputs"
        >
          {#each step.completion.inputs as input (input.id)}
            <label class="field">
              <span class="label">{L(input.label)}{input.unit ? ' (' + input.unit + ')' : ''}</span>
              <input
                class="input"
                inputmode={input.kind === 'text' ? 'text' : 'decimal'}
                value={stepState.inputs?.[input.id] ?? inputDraft[input.id] ?? ''}
                oninput={(e) => (inputDraft = { ...inputDraft, [input.id]: e.currentTarget.value })}
                placeholder={input.placeholder ? L(input.placeholder) : ''}
                style="max-width: 12rem"
                data-input-id={input.id}
              />
            </label>
          {/each}
          {#if stepState.inputs}
            <p class="small muted" role="status">{t('mission.predictionLocked')}</p>
          {:else}
            <button class="btn btn--primary btn--sm" type="submit">{t('mission.record')}</button>
          {/if}
        </form>
      {:else if step.completion.kind === 'exercises'}
        <div class="stack">
          {#each step.completion.exerciseIds as exerciseId, i (exerciseId)}
            {@const exercise = pkg.exercises.find((e) => e.id === exerciseId)}
            {#if exercise}
              <ExerciseRunner
                {exercise}
                index={i + 1}
                record={stepState.answers?.[exerciseId]}
                hintsOpened={hintsForExercise(exerciseId)}
                hintsWithheld={stepState.guideHints === 'withheld'}
                onresult={(check, value) => dispatch({ type: 'exercise', exercise, check, value })}
                onexplain={(text) => dispatch({ type: 'explanation', exerciseId, text })}
                onhint={(hintId) =>
                  dispatch({ type: 'open_hint', hintId: exerciseId + ':' + hintId })}
              />
            {/if}
          {/each}
        </div>
      {:else if step.completion.kind === 'explanation'}
        <form
          class="card card--paper stack-sm"
          onsubmit={(e) => {
            e.preventDefault();
            void dispatch({ type: 'explanation', exerciseId: step.id, text: explanationDraft });
          }}
        >
          <label class="field">
            <span class="label">{t('exercise.explanation')}</span>
            <textarea
              class="input"
              rows="5"
              value={stepState.explanation ?? explanationDraft}
              oninput={(e) => (explanationDraft = e.currentTarget.value)}></textarea>
          </label>
          {#if (stepState.explanation?.length ?? 0) >= step.completion.minCharacters}
            <p class="small muted">{t('exercise.submitted')}</p>
          {:else}
            <p class="small muted">
              {t('mission.needExplanation', { n: step.completion.minCharacters })}
            </p>
            <button
              class="btn btn--primary btn--sm"
              type="submit"
              disabled={explanationDraft.trim().length < step.completion.minCharacters}
              >{t('exercise.submit')}</button
            >
          {/if}
        </form>
      {/if}

      {#if step.hints.length}
        <div class="card stack-sm">
          {#each step.hints.filter( (h) => stepState.hintsOpened.includes('step:' + h.id) ) as h (h.id)}
            <div class="hint">💡 <Markdown text={L(h.text)} /></div>
          {/each}
          {#if stepState.guideHints === 'withheld'}
            <p class="muted small" style="margin:0">{t('mission.hintWithheld')}</p>
          {:else}
            {@const next = step.hints.find((h) => !stepState.hintsOpened.includes('step:' + h.id))}
            {#if next}
              <div class="cluster">
                <button
                  class="btn btn--sm btn--ghost"
                  type="button"
                  onclick={() => dispatch({ type: 'open_hint', hintId: 'step:' + next.id })}
                  >💡 {t('mission.hintOpen')}</button
                >
                <span class="muted small">{t('mission.hintCost', { autonomy: next.autonomy })}</span
                >
              </div>
            {/if}
          {/if}
        </div>
      {/if}

      <footer class="step__nav">
        <button
          class="btn btn--ghost"
          type="button"
          onclick={() => dispatch({ type: 'back' })}
          disabled={stepIndex <= 0}>← {t('mission.back')}</button
        >
        {#if guide}
          <button
            class="btn btn--sm btn--ghost"
            type="button"
            onclick={() => dispatch({ type: 'guide_skip' })}>{t('guide.skip')}</button
          >
        {/if}
        <button
          class="btn btn--primary"
          type="button"
          onclick={() => dispatch({ type: 'advance' })}
          disabled={!complete || busy}
          data-testid="mission-continue"
        >
          {step.type === 'map_return' ? t('mission.finish') : t('mission.continue')} →
        </button>
        {#if !complete}
          <span class="muted small step__why">
            {#if step.completion.kind === 'exercises'}{t(
                'mission.needExercises'
              )}{:else if step.completion.kind === 'simulation'}{t('mission.needMeasurements', {
                n: step.completion.minMeasurements,
                done: stepState.measurements?.length ?? 0,
              })}{:else if step.toolSelection && !stepState.toolSelected}{t(
                'mission.toolSelection'
              )}{/if}
          </span>
        {/if}
      </footer>
    </article>
  {/if}
</div>

<style>
  .mission {
    display: grid;
    gap: var(--space-4);
    padding-bottom: var(--space-6);
  }
  .mission__head {
    display: grid;
    gap: var(--space-3);
  }
  .mission__meta {
    display: grid;
    gap: var(--space-2);
    justify-items: start;
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
    width: 30px;
    height: 30px;
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
  .rail__item.is-skipped {
    border-style: dashed;
  }
  .step {
    display: grid;
    gap: var(--space-3);
  }
  .step > * {
    min-width: 0;
  }
  .step__head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-3);
    align-items: baseline;
  }
  .step__nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
    position: sticky;
    z-index: 3;
    bottom: calc(var(--safe-bottom) + var(--space-2));
    padding: var(--space-2);
    border-radius: var(--radius);
    background: rgba(19, 26, 48, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border);
  }
  .step__why {
    flex-basis: 100%;
  }
  .dialogue__line {
    padding: var(--space-2) var(--space-3);
    border-left: 3px solid #2f4fc9;
    background: rgba(47, 79, 201, 0.06);
    margin: 0;
  }
  .dialogue__line--narrator {
    border-left-color: #b9761a;
    font-style: italic;
  }
  .choices {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  .choice {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--paper-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    min-height: 44px;
  }
  .choice input {
    width: 20px;
    height: 20px;
  }
  .choice.is-selected {
    border-color: #2f4fc9;
    background: rgba(47, 79, 201, 0.08);
  }
  .hint {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: rgba(255, 209, 102, 0.15);
  }
  .hint :global(p) {
    margin: 0;
  }
  .claims ul {
    display: grid;
    gap: 0.4rem;
    padding-left: 1.2rem;
  }
  .card--paper .input {
    background: #fff;
    color: var(--paper-text);
    border-color: #c9c4b8;
  }
  .card--paper .field .label {
    color: var(--paper-muted);
  }
  @media (max-width: 700px) {
    .step__nav {
      bottom: calc(var(--nav-height) + var(--safe-bottom) + var(--space-2));
    }
  }
</style>
