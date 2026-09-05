<script lang="ts">
  import { untrack } from 'svelte';
  import type { ExerciseDefinition } from '$lib/content-schema';
  import Markdown from '$lib/components/Markdown.svelte';
  import {
    checkChoice,
    checkNumeric,
    checkOrdering,
    checkSymbolic,
    type AnswerCheck,
  } from '$lib/domain/answers';
  import { autonomyFromHints } from '$lib/domain/evidence';
  import { L, locale, t } from '$lib/state/locale.svelte';

  interface Props {
    exercise: ExerciseDefinition;
    record?: { correct: boolean; score: number; attempts: number; value: unknown };
    hintsOpened?: string[];
    hintsWithheld?: boolean;
    onresult: (check: AnswerCheck, value: unknown) => void;
    onexplain?: (text: string) => void;
    onhint?: (hintId: string) => void;
    index?: number;
  }
  let {
    exercise,
    record,
    hintsOpened = [],
    hintsWithheld = false,
    onresult,
    onexplain,
    onhint,
    index,
  }: Props = $props();

  let numericValue = $state('');
  let numericUnit = $state('');
  let selected = $state<string[]>([]);
  let reasoning = $state('');
  let order = $state<string[]>(untrack(() => exercise.ordering?.items.map((i) => i.id) ?? []));
  let symbolic = $state('');
  let explanation = $state('');
  let feedback = $state<AnswerCheck | null>(null);
  let showSolution = $state(false);

  const done = $derived(!!record?.correct);
  const attempts = $derived(record?.attempts ?? 0);
  const canReveal = $derived(done || attempts >= 3);
  const openedHints = $derived(exercise.hints.filter((h) => hintsOpened.includes(h.id)));
  const nextHint = $derived(exercise.hints.find((h) => !hintsOpened.includes(h.id)));
  const autonomy = $derived(autonomyFromHints(hintsOpened.length));

  const UNIT_FAMILIES: Record<string, string[]> = {
    'm/s': ['m/s', 'm/s²', 'm', 's'],
    'm/s²': ['m/s²', 'm/s', 'm', 's'],
    m: ['m', 'm/s', 's', 'm²'],
    s: ['s', 'm', 'm/s', 'Hz'],
    mA: ['mA', 'µC', 'ms', 'V'],
    µC: ['µC', 'mA', 'ms', 'V'],
    V: ['V', 'A', 'C', 's'],
    'mol/(L·s)': ['mol/(L·s)', 'mol/L', 's⁻¹', 'mol'],
    'mol/L': ['mol/L', 'mol/(L·s)', 'mol', 'L'],
  };
  const unitChoices = $derived.by(() => {
    const u = exercise.numeric?.unit;
    if (!u) return [] as string[];
    const family = UNIT_FAMILIES[u] ?? [u, '—'];
    return family.includes(u) ? family : [u, ...family];
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (done) return;
    let check: AnswerCheck;
    let value: unknown;
    switch (exercise.type) {
      case 'numeric':
        check = checkNumeric(
          exercise,
          { value: numericValue, unit: numericUnit || undefined },
          locale.current
        );
        value = { value: numericValue, unit: numericUnit };
        break;
      case 'choice':
        check = checkChoice(exercise, selected, reasoning);
        value = { selected: $state.snapshot(selected), reasoning };
        break;
      case 'ordering':
        check = checkOrdering(exercise, order);
        value = { order: $state.snapshot(order) };
        break;
      case 'symbolic':
        check = checkSymbolic(exercise, symbolic);
        value = { expression: symbolic };
        break;
      default:
        return;
    }
    feedback = check;
    if (check.feedback === 'parse_error' || check.feedback === 'reasoning_required') return;
    onresult(check, value);
  }

  function submitExplanation(event: SubmitEvent) {
    event.preventDefault();
    if (explanation.trim().length < 20) return;
    onexplain?.(explanation.trim());
  }

  function toggleChoice(id: string) {
    if (exercise.choice?.multiple)
      selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    else selected = [id];
  }
  function move(id: string, delta: number) {
    const i = order.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    order = next;
  }

  const feedbackText = $derived.by(() => {
    if (!feedback) return '';
    switch (feedback.feedback) {
      case 'correct':
        return t('exercise.correct');
      case 'partial':
        return t('exercise.partial');
      case 'unit_wrong':
        return t('exercise.unitWrong');
      case 'parse_error':
        return t('exercise.parseError');
      case 'reasoning_required':
        return t('exercise.reasoningRequired');
      default:
        return t('exercise.incorrect');
    }
  });
</script>

<section
  class="exercise card card--paper"
  class:exercise--done={done}
  data-testid="exercise"
  data-exercise-id={exercise.id}
  aria-labelledby="ex-{exercise.id}"
>
  <header class="exercise__head">
    <h3 id="ex-{exercise.id}" style="margin:0; font-size: var(--fs-base)">
      {index !== undefined ? t('exercise.number', { n: index }) : t('exercise.answer')}
    </h3>
    <div class="cluster small">
      {#if done}<span class="badge badge--ok">{t('exercise.checked')}</span>{/if}
      {#if attempts > 0}<span class="muted">{t('exercise.attempts', { n: attempts })}</span>{/if}
      <span class="muted">{t('exercise.autonomy', { value: autonomy })}</span>
    </div>
  </header>
  <Markdown text={L(exercise.prompt)} />
  {#if exercise.context}<div class="muted"><Markdown text={L(exercise.context)} /></div>{/if}

  {#if exercise.type === 'free_explanation'}
    <form class="stack-sm" onsubmit={submitExplanation}>
      <label class="field">
        <span class="label">{t('exercise.explanation')}</span>
        <textarea
          class="input"
          rows="5"
          bind:value={explanation}
          disabled={done}
          minlength="20"
          data-testid="explanation-input"></textarea>
      </label>
      {#if done}
        <p class="muted small">{t('exercise.submitted')}</p>
      {:else}
        <button
          class="btn btn--primary btn--sm"
          type="submit"
          disabled={explanation.trim().length < 20}>{t('exercise.submit')}</button
        >
      {/if}
      {#if exercise.rubric}
        <details>
          <summary class="small">{t('exercise.rubric')}</summary>
          <ul class="small">
            {#each exercise.rubric.criteria as c (c.id)}<li>{L(c.text)}</li>{/each}
          </ul>
        </details>
      {/if}
    </form>
  {:else}
    <form class="stack-sm" onsubmit={submit}>
      {#if exercise.type === 'numeric'}
        <div class="cluster">
          <label class="field">
            <span class="label"
              >{exercise.numeric?.inputLabel
                ? L(exercise.numeric.inputLabel)
                : t('exercise.answer')}</span
            >
            <input
              class="input"
              inputmode="decimal"
              bind:value={numericValue}
              disabled={done}
              style="max-width: 10rem"
              data-testid="numeric-input"
            />
          </label>
          {#if unitChoices.length}
            <label class="field">
              <span class="label">{t('exercise.unit')}</span>
              <select
                class="input"
                bind:value={numericUnit}
                disabled={done}
                data-testid="unit-select"
              >
                <option value="">—</option>
                {#each unitChoices as u (u)}<option value={u}>{u}</option>{/each}
              </select>
            </label>
          {/if}
        </div>
      {:else if exercise.type === 'choice' && exercise.choice}
        <p class="small muted" style="margin:0">
          {exercise.choice.multiple ? t('exercise.selectAll') : t('exercise.selectOne')}
        </p>
        <ul class="choices">
          {#each exercise.choice.choices as c (c.id)}
            <li>
              <label class="choice" class:is-selected={selected.includes(c.id)}>
                <input
                  type={exercise.choice.multiple ? 'checkbox' : 'radio'}
                  name="choice-{exercise.id}"
                  checked={selected.includes(c.id)}
                  onchange={() => toggleChoice(c.id)}
                  disabled={done}
                  data-choice-id={c.id}
                />
                <span><Markdown text={L(c.text)} /></span>
              </label>
              {#if feedback && selected.includes(c.id) && c.feedback}<p
                  class="small muted choice__feedback"
                >
                  {L(c.feedback)}
                </p>{/if}
            </li>
          {/each}
        </ul>
        {#if exercise.choice.requireReasoning}
          <label class="field">
            <span class="label">{t('exercise.reasoning')}</span>
            <textarea
              class="input"
              rows="2"
              bind:value={reasoning}
              disabled={done}
              data-testid="reasoning-input"></textarea>
          </label>
        {/if}
      {:else if exercise.type === 'ordering' && exercise.ordering}
        <ol class="ordering">
          {#each order as id, i (id)}
            {@const item = exercise.ordering.items.find((x) => x.id === id)}
            <li>
              <span class="ordering__index">{i + 1}</span>
              <span class="ordering__text">{item ? L(item.text) : id}</span>
              <span class="ordering__buttons">
                <button
                  class="btn btn--sm btn--icon"
                  type="button"
                  aria-label={t('exercise.moveUp')}
                  onclick={() => move(id, -1)}
                  disabled={done || i === 0}>↑</button
                >
                <button
                  class="btn btn--sm btn--icon"
                  type="button"
                  aria-label={t('exercise.moveDown')}
                  onclick={() => move(id, 1)}
                  disabled={done || i === order.length - 1}>↓</button
                >
              </span>
            </li>
          {/each}
        </ol>
      {:else if exercise.type === 'symbolic' && exercise.symbolic}
        <label class="field">
          <span class="label">{exercise.symbolic.display ?? t('exercise.answer')}</span>
          <input
            class="input"
            bind:value={symbolic}
            disabled={done}
            placeholder="6*t+2"
            style="max-width: 16rem; font-family: var(--font-mono)"
            data-testid="symbolic-input"
          />
        </label>
      {/if}

      {#if !done}
        <div class="cluster">
          <button class="btn btn--primary btn--sm" type="submit" data-testid="check-answer"
            >{t('exercise.check')}</button
          >
          {#if nextHint && !hintsWithheld}
            <button
              class="btn btn--sm btn--ghost"
              type="button"
              onclick={() => onhint?.(nextHint.id)}>💡 {t('mission.hintOpen')}</button
            >
          {/if}
          {#if hintsWithheld}<span class="muted small">{t('mission.hintWithheld')}</span>{/if}
        </div>
      {/if}
      {#if feedback}
        <p
          class="feedback"
          class:feedback--ok={feedback.correct}
          class:feedback--partial={!feedback.correct && feedback.score > 0}
          role="status"
          data-testid="exercise-feedback"
        >
          {feedbackText}
        </p>
      {/if}
    </form>
  {/if}

  {#if openedHints.length}
    <div class="hints stack-sm">
      {#each openedHints as h (h.id)}
        <div class="hint">
          <strong>💡 {t('mission.hint')}</strong> — <Markdown text={L(h.text)} />
        </div>
      {/each}
    </div>
  {/if}

  {#if canReveal}
    <button
      class="btn btn--sm btn--ghost"
      type="button"
      onclick={() => (showSolution = !showSolution)}
      >{showSolution ? t('exercise.hideSolution') : t('exercise.solution')}</button
    >
    {#if showSolution}
      <div class="solution"><Markdown text={L(exercise.solution)} /></div>
    {/if}
  {/if}
</section>

<style>
  .exercise {
    display: grid;
    gap: var(--space-3);
  }
  .exercise__head {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .exercise--done {
    border-left: 4px solid var(--ok);
  }
  .badge--ok {
    background: rgba(94, 230, 168, 0.25);
    color: #1b6b47;
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
    align-items: flex-start;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--paper-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    min-height: 44px;
  }
  .choice input {
    margin-top: 0.35rem;
    width: 20px;
    height: 20px;
  }
  .choice.is-selected {
    border-color: #2f4fc9;
    background: rgba(47, 79, 201, 0.08);
  }
  .choice :global(p) {
    margin: 0;
  }
  .choice__feedback {
    margin: 0.2rem 0 0 2.6rem;
  }
  .ordering {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  .ordering li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-2);
    border: 1px solid var(--paper-2);
    border-radius: var(--radius-sm);
  }
  .ordering__index {
    width: 1.8rem;
    height: 1.8rem;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #2f4fc9;
    color: #fff;
    font-weight: 700;
    font-size: 0.85rem;
  }
  .ordering__buttons {
    display: flex;
    gap: 0.25rem;
  }
  .feedback {
    margin: 0;
    font-weight: 600;
    color: #b23b3b;
  }
  .feedback--ok {
    color: #1b6b47;
  }
  .feedback--partial {
    color: #b9761a;
  }
  .hint {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: rgba(255, 209, 102, 0.25);
  }
  .hint :global(p) {
    margin: 0;
  }
  .solution {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: rgba(47, 79, 201, 0.08);
  }
  .exercise .input {
    background: #fff;
    color: var(--paper-text);
    border-color: #c9c4b8;
  }
  .exercise .field .label {
    color: var(--paper-muted);
  }
</style>
