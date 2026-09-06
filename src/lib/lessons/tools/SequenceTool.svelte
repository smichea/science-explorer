<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { curveFunction, evaluateScalar, type ToolState } from '$lib/domain/lesson';
  import { sequenceSum, sequenceTerms } from '$lib/domain/lessonTools';
  import { locale, t } from '$lib/state/locale.svelte';
  import { fmt, scales } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'sequence' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  let expr = $state('');
  let count = $state(0);
  let selected = $state(0);
  $effect(() => {
    if (!interactive) {
      expr = tool.expr;
      count = tool.count;
      selected = tool.start + Math.min(tool.count - 1, 4);
    }
  });
  const first = $derived(evaluateScalar(tool.first, tstate.params));
  const terms = $derived(
    sequenceTerms(
      { mode: tool.mode, expr: expr || tool.expr, first, start: tool.start, count },
      tstate.params
    )
  );
  const error = $derived(!!expr.trim() && terms === null);
  const sc = $derived(scales(tstate.view));
  const current = $derived(terms?.find((x) => x.n === selected) ?? terms?.[0] ?? null);
  const sum = $derived(terms ? sequenceSum(terms, selected) : null);
  /** The staircase of a recurrence: f drawn against y = x, the terms bouncing between them. */
  const recurrence = $derived(
    tool.mode === 'recurrence' && tool.cobweb
      ? curveFunction(expr || tool.expr, 'u', { ...tstate.params, n: 0 })
      : null
  );
  function pathOf(fn: (x: number) => number): string {
    const [a, b] = tstate.view.x;
    let d = '';
    let pen = false;
    for (let i = 0; i <= 200; i++) {
      const x = a + ((b - a) * i) / 200;
      const y = fn(x);
      if (!Number.isFinite(y)) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sc.sx(x).toFixed(1)} ${sc.sy(y).toFixed(1)} `;
      pen = true;
    }
    return d;
  }
  const cobweb = $derived.by(() => {
    if (!recurrence || !terms) return '';
    let d = `M${sc.sx(terms[0].u).toFixed(1)} ${sc.sy(0).toFixed(1)} `;
    for (let i = 0; i < terms.length - 1; i++) {
      const u = terms[i].u;
      const v = terms[i + 1].u;
      d += `L${sc.sx(u).toFixed(1)} ${sc.sy(v).toFixed(1)} L${sc.sx(v).toFixed(1)} ${sc.sy(v).toFixed(1)} `;
    }
    return d;
  });
  const f = (v: number) => fmt(v, locale.current, 3);
</script>

<div class="tool stack-sm" data-testid="sequence-tool" data-terms={terms?.length ?? 0}>
  <svg
    viewBox="0 0 {sc.W} {sc.H}"
    class="tool__svg"
    role="img"
    aria-label={t('lesson.tool.sequence')}
  >
    {#each sc.xTicks as v (v)}
      <line
        x1={sc.sx(v)}
        y1={sc.pad.t}
        x2={sc.sx(v)}
        y2={sc.H - sc.pad.b}
        class="grid"
        class:axis={v === 0}
      />
      <text x={sc.sx(v)} y={sc.H - sc.pad.b + 14} class="tick" text-anchor="middle"
        >{fmt(v, locale.current)}</text
      >
    {/each}
    {#each sc.yTicks as v (v)}
      <line
        x1={sc.pad.l}
        y1={sc.sy(v)}
        x2={sc.W - sc.pad.r}
        y2={sc.sy(v)}
        class="grid"
        class:axis={v === 0}
      />
      <text x={sc.pad.l - 6} y={sc.sy(v) + 3} class="tick" text-anchor="end"
        >{fmt(v, locale.current)}</text
      >
    {/each}
    <text x={sc.W - sc.pad.r} y={sc.H - 6} class="label" text-anchor="end"
      >{recurrence ? 'u(n)' : 'n'}</text
    >
    <text x={sc.pad.l + 4} y={sc.pad.t - 4} class="label">{recurrence ? 'u(n+1)' : 'u(n)'}</text>
    {#if recurrence}
      <path d={pathOf(recurrence)} fill="none" stroke="#7f9cff" stroke-width="2" />
      <path
        d={pathOf((x) => x)}
        fill="none"
        stroke="#a7b0c8"
        stroke-width="1.2"
        stroke-dasharray="5 4"
      />
      <path d={cobweb} fill="none" stroke="#ffd166" stroke-width="1.6" />
    {:else if terms}
      {#each terms as term (term.n)}
        <line
          x1={sc.sx(term.n)}
          y1={sc.sy(0)}
          x2={sc.sx(term.n)}
          y2={sc.sy(term.u)}
          stroke="#7f9cff"
          stroke-width="1"
          opacity="0.5"
        />
        <circle
          cx={sc.sx(term.n)}
          cy={sc.sy(term.u)}
          r={term.n === selected ? 6 : 4}
          fill={term.n === selected ? '#ffd166' : '#7f9cff'}
          stroke="#0b1020"
        />
      {/each}
    {/if}
  </svg>
  {#if current}
    <p style="margin: 0" data-testid="sequence-reading" aria-live="polite">
      {t('lesson.seq.term', { n: current.n, value: f(current.u) })}
      {#if sum !== null}
        · {t('lesson.seq.sum', { n: selected, value: f(sum) })}{/if}
    </p>
  {/if}
  {#if interactive}
    <div class="stack-sm" data-testid="sequence-controls">
      {#if tool.input}
        <label class="field">
          <span class="label">{t('lesson.seq.formula')}</span>
          <input
            class="input"
            type="text"
            spellcheck="false"
            autocomplete="off"
            bind:value={expr}
            data-testid="sequence-expression"
          />
          <span class="small muted"
            >{tool.mode === 'explicit'
              ? t('lesson.seq.explicitHint')
              : t('lesson.seq.recurrenceHint')}</span
          >
        </label>
        {#if error}<p class="small" role="alert" style="margin: 0; color: #ff8fab">
            {t('lesson.expressionError')}
          </p>{/if}
      {/if}
      <label class="field">
        <span class="label">{t('lesson.seq.count')} : {count}</span>
        <input type="range" min="2" max="60" step="1" bind:value={count} />
      </label>
      <label class="field">
        <span class="label">n = {selected}</span>
        <input
          type="range"
          min={tool.start}
          max={tool.start + count - 1}
          step="1"
          bind:value={selected}
          data-testid="sequence-index"
        />
      </label>
    </div>
  {/if}
</div>

<style>
  .tool__svg {
    width: 100%;
    height: auto;
    display: block;
    border-radius: var(--radius);
    background: #070b17;
  }
  .grid {
    stroke: rgba(255, 255, 255, 0.08);
  }
  .axis {
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1.4;
  }
  .tick {
    font-size: 11px;
    fill: #a7b0c8;
    font-family: var(--font-body);
  }
  .label {
    font-size: 12px;
    fill: #d5dcf0;
    font-family: var(--font-body);
    font-weight: 600;
  }
</style>
