<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import {
    drawMany,
    eventProbability,
    outcomesOf,
    sampleFrequencies,
  } from '$lib/domain/lessonTools';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { fmt, seeded } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'random' }>;
  interface Props {
    tool: Tool;
    interactive?: boolean;
  }
  let { tool, interactive = false }: Props = $props();

  const outcomes = $derived(outcomesOf(tool));
  const eventSet = $derived(new Set(tool.event?.outcomes ?? []));
  const p = $derived(tool.event ? eventProbability(outcomes, eventSet) : null);
  let random: () => number = () => 0;
  let tally = $state<Record<string, number>>({});
  let draws = $state(0);
  let samples = $state<number[]>([]);
  // A new tool restarts the reproducible draws; so does the end of the free play.
  $effect(() => {
    void tool.seed;
    reset();
  });
  $effect(() => {
    if (!interactive) reset();
  });
  function reset() {
    random = seeded(tool.seed);
    tally = {};
    draws = 0;
    samples = [];
  }
  function draw(count: number) {
    const more = drawMany(outcomes, count, random);
    const next = { ...tally };
    for (const [id, n] of Object.entries(more)) next[id] = (next[id] ?? 0) + n;
    tally = next;
    draws += count;
  }
  function sample(count: number) {
    samples = [...samples, ...sampleFrequencies(outcomes, eventSet, tool.sample, count, random)];
  }
  function labelOf(id: string): string {
    if (tool.experiment === 'coin')
      return t(id === 'heads' ? 'lesson.random.heads' : 'lesson.random.tails');
    if (tool.experiment === 'urn') {
      const ball = tool.urn.find((b) => b.id === id);
      return ball ? L(ball.label) : id;
    }
    return id;
  }
  function colorOf(id: string, i: number): string {
    return (
      tool.urn.find((b) => b.id === id)?.color ??
      ['#7f9cff', '#ffb347', '#5ee6a8', '#ff8fab', '#b39dff', '#ffd166'][i % 6]
    );
  }
  const f = (v: number) => fmt(v, locale.current, 3);
  const W = 560;
  const H = 240;
  const pad = { l: 40, r: 16, t: 16, b: 36 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const sy = (v: number) => H - pad.b - v * plotH;
  const barW = $derived(plotW / Math.max(1, outcomes.length));
  const frequency = (id: string) => (draws ? (tally[id] ?? 0) / draws : 0);
  const interval = $derived(
    p !== null
      ? [Math.max(0, p - 1 / Math.sqrt(tool.sample)), Math.min(1, p + 1 / Math.sqrt(tool.sample))]
      : null
  );
  const inInterval = $derived(
    interval ? samples.filter((s) => s >= interval[0] && s <= interval[1]).length : 0
  );
  const samplesMean = $derived(
    samples.length ? samples.reduce((s, v) => s + v, 0) / samples.length : null
  );
  const sx = (v: number) => pad.l + v * plotW;
</script>

<div
  class="tool stack-sm"
  data-testid="random-tool"
  data-draws={draws}
  data-samples={samples.length}
>
  {#if tool.mode === 'frequencies'}
    <svg viewBox="0 0 {W} {H}" class="tool__svg" role="img" aria-label={t('lesson.tool.random')}>
      {#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
        <line x1={pad.l} y1={sy(v)} x2={W - pad.r} y2={sy(v)} class="grid" />
        <text x={pad.l - 6} y={sy(v) + 3} class="tick" text-anchor="end">{f(v)}</text>
      {/each}
      {#each outcomes as o, i (o.id)}
        {@const x = pad.l + i * barW}
        <rect
          x={x + barW * 0.15}
          y={sy(frequency(o.id))}
          width={barW * 0.45}
          height={sy(0) - sy(frequency(o.id))}
          fill={colorOf(o.id, i)}
          opacity="0.85"
        />
        <rect
          x={x + barW * 0.62}
          y={sy(o.p)}
          width={barW * 0.2}
          height={sy(0) - sy(o.p)}
          fill="#fff"
          opacity="0.35"
        />
        <text x={x + barW / 2} y={H - pad.b + 14} class="tick" text-anchor="middle"
          >{labelOf(o.id)}</text
        >
        <text x={x + barW * 0.37} y={sy(frequency(o.id)) - 4} class="note" text-anchor="middle"
          >{draws ? f(frequency(o.id)) : ''}</text
        >
      {/each}
    </svg>
    <p class="small muted" style="margin: 0">
      <span class="swatch" style="background: #7f9cff"></span>{t('lesson.random.frequency')} ({t(
        'lesson.random.draws',
        { n: draws }
      )})
      <span class="swatch" style="background: rgba(255,255,255,0.35)"></span>{t(
        'lesson.random.probability'
      )}
    </p>
  {:else}
    <svg viewBox="0 0 {W} {H}" class="tool__svg" role="img" aria-label={t('lesson.tool.random')}>
      {#if interval}
        <rect
          x={sx(interval[0])}
          y={pad.t}
          width={sx(interval[1]) - sx(interval[0])}
          height={plotH}
          fill="#5ee6a8"
          opacity="0.12"
        />
      {/if}
      {#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
        <line x1={sx(v)} y1={pad.t} x2={sx(v)} y2={H - pad.b} class="grid" />
        <text x={sx(v)} y={H - pad.b + 14} class="tick" text-anchor="middle">{f(v)}</text>
      {/each}
      {#if p !== null}
        <line
          x1={sx(p)}
          y1={pad.t}
          x2={sx(p)}
          y2={H - pad.b}
          stroke="#fff"
          stroke-width="1.5"
          stroke-dasharray="4 4"
        />
        <text x={sx(p) + 4} y={pad.t + 12} class="note">p = {f(p)}</text>
      {/if}
      {#each samples as s, i (i)}
        <circle
          cx={sx(s)}
          cy={H - pad.b - 8 - (i % 24) * 7}
          r="3.2"
          fill="#ffb347"
          opacity="0.85"
        />
      {/each}
    </svg>
    <p class="small muted" style="margin: 0" data-testid="random-sampling">
      {t('lesson.random.samplesOf', { n: samples.length, size: tool.sample })}
      {#if samplesMean !== null}
        · {t('lesson.random.samplesMean')} {f(samplesMean)}{/if}
      {#if interval && samples.length}
        · {t('lesson.random.inInterval', { n: inInterval, total: samples.length })}{/if}
    </p>
  {/if}
  {#if tool.event}
    <p class="small" style="margin: 0">
      {t('lesson.random.event')} « {L(tool.event.label)} » : {tool.event.outcomes
        .map(labelOf)
        .join(', ')}
      {#if p !== null}
        · {t('lesson.random.probability')} {f(p)}{/if}
      {#if tool.mode === 'frequencies' && draws}
        · {t('lesson.random.frequency')}
        {f(tool.event.outcomes.reduce((s, id) => s + (tally[id] ?? 0), 0) / draws)}{/if}
    </p>
  {/if}
  {#if interactive}
    <div class="cluster" data-testid="random-controls">
      {#if tool.mode === 'frequencies'}
        {#each [1, 10, 100, 1000] as n (n)}
          <button
            class="btn btn--sm"
            type="button"
            onclick={() => draw(n)}
            data-testid="random-draw-{n}">{t('lesson.random.draw', { n })}</button
          >
        {/each}
      {:else}
        {#each [1, 10, 100] as n (n)}
          <button
            class="btn btn--sm"
            type="button"
            onclick={() => sample(n)}
            data-testid="random-sample-{n}"
            >{t('lesson.random.sample', { n, size: tool.sample })}</button
          >
        {/each}
      {/if}
      <button class="btn btn--sm btn--ghost" type="button" onclick={reset}
        >{t('lesson.random.reset')}</button
      >
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
  .tick {
    font-size: 11px;
    fill: #a7b0c8;
    font-family: var(--font-body);
  }
  .note {
    font-size: 12px;
    fill: #eef1f8;
    font-family: var(--font-body);
    font-weight: 600;
  }
  .swatch {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 3px;
    margin: 0 0.3rem 0 0.6rem;
    vertical-align: middle;
  }
</style>
