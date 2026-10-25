<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import type { LessonTool } from '$lib/content-schema';
  import {
    alphaKey,
    LambdaError,
    LAMBDA_EXAMPLES,
    lambdaAt,
    lambdaSize,
    parseLambda,
    printLambda,
    redexPaths,
    reduceLambda,
    type LambdaTerm,
    type LambdaReduction,
    type LambdaStrategy,
  } from '$lib/domain/lambda';
  import { locale } from '$lib/state/locale.svelte';
  import { prefs } from '$lib/state/prefs.svelte';
  import { lambdaText } from '../lambdaText';
  import LambdaDiagram from './LambdaDiagram.svelte';
  type Tool = Extract<LessonTool, { kind: 'lambda_diagram' }>;
  let {
    tool,
    source,
    interactive = false,
    onterm,
  }: {
    tool: Tool;
    source?: string;
    interactive?: boolean;
    onterm?: (source: string) => void;
  } = $props();
  const text = $derived(lambdaText(locale.current));
  let draft = $state('');
  let term = $state.raw<LambdaTerm>(parseLambda('λx. x'));
  let history = $state.raw<LambdaTerm[]>([]);
  let last = $state.raw<LambdaReduction | null>(null);
  let animation = $state.raw<{ reduction: LambdaReduction; progress: number } | null>(null);
  let strategy = $state<LambdaStrategy>('normal');
  let selected = $state<string | null>(null);
  let duration = $state(1100);
  let names = $state(false);
  let autoplay = $state(false);
  let notice = $state<'loop' | 'limit' | null>(null);
  let error = $state.raw<LambdaError | null>(null);
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const paths = $derived(redexPaths(term, strategy));
  const choice = $derived(
    selected !== null && paths.includes(selected) ? selected : (paths[0] ?? null)
  );
  const busy = $derived(animation !== null);
  const size = $derived(lambdaSize(term));
  const errorText = $derived(
    error
      ? error.code === 'syntax'
        ? `${text.errorSyntax} ${error.position + 1}.`
        : error.code === 'size'
          ? text.errorSize
          : error.code === 'depth'
            ? text.errorDepth
            : text.errorRedex
      : ''
  );

  function pause() {
    autoplay = false;
    if (frame) cancelAnimationFrame(frame);
    if (timer) clearTimeout(timer);
    animation = null;
  }
  function load(value: string, notify = false) {
    pause();
    try {
      const parsed = parseLambda(value);
      draft = value;
      term = parsed;
      history = [];
      last = null;
      selected = null;
      error = null;
      notice = null;
      if (notify) onterm?.(value);
    } catch (e) {
      error = e instanceof LambdaError ? e : new LambdaError('syntax');
    }
  }
  $effect(() => {
    const value = source ?? tool.term;
    const initialStrategy = tool.strategy;
    untrack(() => {
      load(value);
      strategy = initialStrategy;
    });
  });
  onDestroy(pause);

  function finish(reduction: LambdaReduction) {
    const repeated = [...history, term].some((t) => alphaKey(t) === alphaKey(reduction.after));
    history = [...history, term];
    term = reduction.after;
    last = reduction;
    animation = null;
    selected = null;
    if (repeated) {
      notice = 'loop';
      autoplay = false;
    } else if (history.length >= tool.maxSteps && redexPaths(term).length) {
      notice = 'limit';
      autoplay = false;
    } else if (redexPaths(term).length === 0) autoplay = false;
    if (autoplay) timer = setTimeout(step, 220);
  }
  function step() {
    if (busy || choice === null || history.length >= tool.maxSteps) return;
    try {
      const reduction = reduceLambda(term, choice);
      error = null;
      notice = null;
      if (prefs.reducedMotion) {
        finish(reduction);
        return;
      }
      const start = performance.now();
      animation = { reduction, progress: 0 };
      const tick = (now: number) => {
        const progress = Math.max(0, (now - start - duration * 0.25) / (duration * 0.75));
        if (progress >= 1) finish(reduction);
        else {
          animation = { reduction, progress };
          frame = requestAnimationFrame(tick);
        }
      };
      frame = requestAnimationFrame(tick);
    } catch (e) {
      pause();
      error = e instanceof LambdaError ? e : new LambdaError('redex');
    }
  }
  function back() {
    pause();
    if (!history.length) return;
    term = history[history.length - 1];
    history = history.slice(0, -1);
    last = null;
    selected = null;
    notice = null;
    error = null;
  }
</script>

<div
  class="lambda-tool stack-sm"
  data-testid="lambda-diagram-tool"
  data-steps={history.length}
  data-phase={busy ? (animation!.progress === 0 ? 'highlight' : 'substitute') : 'idle'}
>
  {#if interactive}
    <label class="field"
      >{text.examples}
      <select
        aria-label={text.examples}
        value=""
        onchange={(e) => {
          const example = LAMBDA_EXAMPLES.find((v) => v.id === e.currentTarget.value);
          if (example) load(example.source, true);
        }}
      >
        <option value="">{text.custom}</option>
        {#each LAMBDA_EXAMPLES as example (example.id)}<option value={example.id}
            >{example[locale.current]}</option
          >{/each}
      </select>
    </label>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        load(draft, true);
      }}
      class="stack-sm"
    >
      <label class="field"
        >{text.source}<textarea
          rows="2"
          spellcheck="false"
          bind:value={draft}
          data-testid="lambda-input"></textarea></label
      >
      <button class="btn" type="submit" data-testid="lambda-draw">{text.draw}</button>
    </form>
    <p class="small muted">{text.syntax}</p>
  {/if}
  {#if error}<p class="error" role="alert" data-testid="lambda-error">{errorText}</p>{/if}
  <code class="expression" data-testid="lambda-current">{printLambda(term)}</code>
  <LambdaDiagram
    {term}
    {names}
    selectedPath={choice}
    {animation}
    onselect={(path) => {
      if (!busy) {
        selected = path;
        notice = null;
      }
    }}
  />
  <div class="legend small">
    <span>━ {text.binder}</span><span>│ {text.wire}</span><span>●━● {text.join}</span><span
      >{text.selected}</span
    >
  </div>
  <div class="cluster metrics">
    <span>{text.count} : <strong data-testid="lambda-step-count">{history.length}</strong></span
    ><span>{text.size} : <strong>{size}</strong></span><span
      >{text.choices} : <strong>{paths.length}</strong></span
    >
  </div>
  <div class="cluster">
    <button
      class="btn btn--primary"
      onclick={step}
      disabled={busy || !paths.length || history.length >= tool.maxSteps}
      data-testid="lambda-step">{text.step}</button
    >
    <button
      class="btn"
      onclick={() => {
        if (autoplay || busy) pause();
        else {
          autoplay = true;
          step();
        }
      }}
      disabled={!paths.length || history.length >= tool.maxSteps}
      data-testid="lambda-play">{autoplay || busy ? text.pause : text.play}</button
    >
    <button class="btn" onclick={back} disabled={!history.length} data-testid="lambda-undo"
      >{text.undo}</button
    >
    <button class="btn btn--ghost" onclick={() => load(source ?? tool.term)}>{text.reset}</button>
  </div>
  <label class="field"
    >{text.strategy}
    <select
      bind:value={strategy}
      disabled={busy}
      onchange={() => {
        selected = null;
        notice = null;
      }}
      data-testid="lambda-strategy"
      ><option value="normal">{text.normal}</option><option value="applicative"
        >{text.applicative}</option
      ></select
    >
  </label>
  <div class="cluster">
    <label><input type="checkbox" bind:checked={names} /> {text.names}</label>
    <label
      >{text.speed}
      <input
        aria-label={text.speed}
        type="range"
        min="500"
        max="2200"
        step="100"
        bind:value={duration}
        disabled={busy}
      /></label
    >
  </div>
  <p class="reading" role="status" data-testid="lambda-status">
    {notice
      ? text[notice]
      : busy
        ? animation!.progress === 0
          ? text.phase
          : text.moving
        : paths.length
          ? text.ready
          : text.noRedex}
  </p>
  {#if last}<p class="small">
      {text.copies} : <strong>{last.count}</strong>. {text.size} : {lambdaSize(last.before)} → {lambdaSize(
        last.after
      )}.
      {#if last.renamed.length}<br />{text.renamed} : {last.renamed
          .map((n) => `${n.from} → ${n.to}`)
          .join(', ')}.{/if}
    </p>{/if}
  <p class="small muted">{text.strategies}</p>
  {#if paths.length > 1}<div class="redex-list">
      {#each redexPaths(term) as path, i (path)}<button
          class="btn btn--sm"
          class:chosen={choice === path}
          disabled={busy}
          onclick={() => {
            selected = path;
            notice = null;
          }}>β{i + 1} : <code>{printLambda(lambdaAt(term, path))}</code></button
        >{/each}
    </div>{/if}
  {#if history.length}<details>
      <summary>{text.history}</summary>
      <ol start="0">
        {#each [...history, term] as item, i (i)}<li>
            <code>{printLambda(item)}</code>
            <span class="muted">({text.size.toLowerCase()} {lambdaSize(item)})</span>
          </li>{/each}
      </ol>
    </details>{/if}
</div>

<style>
  .lambda-tool {
    min-width: 0;
  }
  textarea,
  select {
    width: 100%;
    min-width: 0;
  }
  textarea,
  select {
    background: #101d2b;
    color: #f1e9db;
    border: 1px solid #51617c;
    border-radius: 0.5rem;
    padding: 0.55rem 0.65rem;
    font: inherit;
  }
  textarea,
  code {
    font-family: ui-monospace, monospace;
  }
  .expression {
    display: block;
    padding: 0.6rem;
    border-radius: 0.4rem;
    background: #101d2b;
    color: #fff3df;
    overflow-wrap: anywhere;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1rem;
  }
  .legend span:first-child {
    color: #aacbff;
  }
  .legend span:nth-child(2) {
    color: #74ddcf;
  }
  .legend span:nth-child(3) {
    color: #ffd083;
  }
  .legend span:nth-child(4) {
    color: #ff94cf;
  }
  .metrics {
    font-variant-numeric: tabular-nums;
    gap: 0.5rem 1rem;
  }
  .reading {
    border-left: 3px solid #d8ab62;
    padding-left: 0.75rem;
  }
  .error {
    color: var(--color-danger, #cf5365);
  }
  .redex-list {
    display: grid;
    gap: 0.3rem;
  }
  .redex-list button {
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .chosen {
    outline: 2px solid #c26ca0;
  }
  li {
    margin-block: 0.5rem;
    overflow-wrap: anywhere;
  }
  p {
    margin: 0;
  }
</style>
