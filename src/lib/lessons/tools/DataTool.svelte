<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { describeData, histogram } from '$lib/domain/lessonTools';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { fmt, scales } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'data' }>;
  interface Props {
    tool: Tool;
    interactive?: boolean;
  }
  let { tool, interactive = false }: Props = $props();

  /** The series as typed by the learner (values separated by spaces, commas or semicolons). */
  let text = $state('');
  const authored = $derived(
    tool.counts
      ? tool.values.map((v, i) => `${v}×${tool.counts?.[i] ?? 1}`).join(' ; ')
      : tool.values.join(' ; ')
  );
  $effect(() => {
    if (!interactive) text = authored;
  });
  /** Parses `12 ; 15×3 ; 7` into values and counts. */
  const parsed = $derived.by(() => {
    const values: number[] = [];
    const counts: number[] = [];
    for (const raw of text.split(/[;\s]+/)) {
      if (!raw) continue;
      const [v, c] = raw.split(/[×x*]/);
      const value = Number(v.replace(',', '.'));
      const count = c ? Number(c) : 1;
      if (!Number.isFinite(value) || !Number.isInteger(count) || count < 1) continue;
      values.push(value);
      counts.push(count);
    }
    return values.length >= 1 ? { values, counts } : { values: tool.values, counts: tool.counts };
  });
  const summary = $derived(describeData(parsed.values, parsed.counts));
  const bins = $derived(histogram(parsed.values, parsed.counts, tool.bins));
  const view = $derived({
    x: [
      summary?.min ?? 0,
      summary && summary.max > summary.min ? summary.max : (summary?.min ?? 0) + 1,
    ] as [number, number],
    y: [0, Math.max(1, ...bins.map((b) => b.count)) * 1.15] as [number, number],
  });
  const sc = $derived(scales(view, { W: 560, H: 300, pad: { l: 46, r: 18, t: 18, b: 38 } }));
  const f = (v: number) => fmt(v, locale.current);
  const unit = $derived(tool.unit ? ` ${tool.unit}` : '');
  /** Box plot geometry, under the histogram. */
  const boxY = $derived(sc.H - sc.pad.b + 4);
</script>

<div class="tool stack-sm" data-testid="data-tool" data-count={summary?.n ?? 0}>
  {#if tool.label}<p class="small muted" style="margin: 0">{L(tool.label)}</p>{/if}
  <svg
    viewBox="0 0 {sc.W} {sc.H + 40}"
    class="tool__svg"
    role="img"
    aria-label={t('lesson.tool.data')}
  >
    {#each sc.yTicks as v (v)}
      <line x1={sc.pad.l} y1={sc.sy(v)} x2={sc.W - sc.pad.r} y2={sc.sy(v)} class="grid" />
      <text x={sc.pad.l - 6} y={sc.sy(v) + 3} class="tick" text-anchor="end">{f(v)}</text>
    {/each}
    {#each bins as b, i (i)}
      <rect
        x={sc.sx(b.from) + 1}
        y={sc.sy(b.count)}
        width={Math.max(1, sc.sx(b.to) - sc.sx(b.from) - 2)}
        height={sc.sy(0) - sc.sy(b.count)}
        fill="#7f9cff"
        opacity="0.75"
      />
    {/each}
    {#each sc.xTicks as v (v)}
      <text x={sc.sx(v)} y={sc.H - sc.pad.b + 14} class="tick" text-anchor="middle">{f(v)}</text>
    {/each}
    {#if summary}
      <!-- box plot: min, Q1, median, Q3, max -->
      <line
        x1={sc.sx(summary.min)}
        y1={boxY + 22}
        x2={sc.sx(summary.q1)}
        y2={boxY + 22}
        stroke="#ffd166"
        stroke-width="2"
      />
      <line
        x1={sc.sx(summary.q3)}
        y1={boxY + 22}
        x2={sc.sx(summary.max)}
        y2={boxY + 22}
        stroke="#ffd166"
        stroke-width="2"
      />
      <rect
        x={sc.sx(summary.q1)}
        y={boxY + 12}
        width={Math.max(2, sc.sx(summary.q3) - sc.sx(summary.q1))}
        height="20"
        fill="rgba(255, 209, 102, 0.25)"
        stroke="#ffd166"
      />
      <line
        x1={sc.sx(summary.median)}
        y1={boxY + 12}
        x2={sc.sx(summary.median)}
        y2={boxY + 32}
        stroke="#fff"
        stroke-width="2.5"
      />
      <line
        x1={sc.sx(summary.mean)}
        y1={boxY + 8}
        x2={sc.sx(summary.mean)}
        y2={boxY + 36}
        stroke="#5ee6a8"
        stroke-width="1.5"
        stroke-dasharray="3 3"
      />
    {/if}
  </svg>
  {#if summary}
    <dl class="stats small" data-testid="data-reading">
      <div>
        <dt>{t('lesson.data.count')}</dt>
        <dd>{summary.n}</dd>
      </div>
      <div>
        <dt>{t('lesson.data.mean')}</dt>
        <dd>{f(summary.mean)}{unit}</dd>
      </div>
      <div>
        <dt>{t('lesson.data.median')}</dt>
        <dd>{f(summary.median)}{unit}</dd>
      </div>
      <div>
        <dt>Q1</dt>
        <dd>{f(summary.q1)}{unit}</dd>
      </div>
      <div>
        <dt>Q3</dt>
        <dd>{f(summary.q3)}{unit}</dd>
      </div>
      <div>
        <dt>{t('lesson.data.range')}</dt>
        <dd>{f(summary.range)}{unit}</dd>
      </div>
      <div>
        <dt>{t('lesson.data.iqr')}</dt>
        <dd>{f(summary.iqr)}{unit}</dd>
      </div>
      <div>
        <dt>{t('lesson.data.std')}</dt>
        <dd>{f(summary.std)}{unit}</dd>
      </div>
    </dl>
  {/if}
  {#if interactive}
    <label class="field">
      <span class="label">{t('lesson.data.values')}</span>
      <textarea class="input" rows="2" bind:value={text} data-testid="data-values"></textarea>
      <span class="small muted">{t('lesson.data.hint')}</span>
    </label>
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
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    gap: 0.25rem 0.75rem;
    margin: 0;
  }
  .stats div {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  .stats dt {
    color: var(--muted);
  }
  .stats dd {
    margin: 0;
    font-weight: 600;
  }
</style>
