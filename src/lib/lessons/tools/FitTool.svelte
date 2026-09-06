<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { curveFunction, evaluateScalar, itemVisible, type ToolState } from '$lib/domain/lesson';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { PALETTE, fmt, gaussian, scales, seeded } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'fit' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const sc = $derived(scales(tstate.view));
  /** Extra measurements taken by the learner (free play). */
  let extra = $state(0);
  let chosen = $state<string | null>(null);

  /** Measured points: listed, or generated once from the law with reproducible noise. */
  const points = $derived.by((): Array<[number, number]> => {
    const gen = tool.generator;
    if (!gen) return tool.points;
    const law = curveFunction(gen.expr, 'x', tstate.params);
    if (!law) return tool.points;
    const random = seeded(gen.seed);
    const out: Array<[number, number]> = [...tool.points];
    const total = gen.count + extra;
    // Measurements are spread from `from` to `to`; extra ones continue with the same spacing.
    const step = gen.count > 1 ? (gen.to - gen.from) / (gen.count - 1) : 1;
    for (let i = 0; i < total; i++) {
      const x = gen.from + step * i;
      const y = law(x) + gaussian(random, gen.noise);
      if (Number.isFinite(y)) out.push([Number(x.toFixed(3)), Number(y.toFixed(3))]);
    }
    return out;
  });

  const models = $derived(
    tool.models
      .filter((m) => itemVisible(m, tstate))
      .map((m, i) => {
        const fn = curveFunction(m.expr, 'x', tstate.params);
        const residuals = fn
          ? points.map(([x, y]) => y - fn(x)).filter((r) => Number.isFinite(r))
          : [];
        const rms = residuals.length
          ? Math.sqrt(residuals.reduce((acc, r) => acc + r * r, 0) / residuals.length)
          : NaN;
        return {
          id: m.id,
          label: L(m.label),
          color: m.color ?? PALETTE[i % PALETTE.length],
          fn,
          rms,
        };
      })
  );
  const active = $derived(models.find((m) => m.id === chosen) ?? models[0] ?? null);
  const target = $derived(
    tool.target !== undefined ? evaluateScalar(tool.target, tstate.params) : null
  );
  const prediction = $derived(target !== null && active?.fn ? active.fn(target) : null);

  function pathOf(fn: (x: number) => number): string {
    const [a, b] = tstate.view.x;
    let d = '';
    let pen = false;
    for (let i = 0; i <= 240; i++) {
      const x = a + ((b - a) * i) / 240;
      const y = fn(x);
      if (!Number.isFinite(y) || Math.abs(y) > 1e6) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sc.sx(x).toFixed(1)} ${sc.sy(y).toFixed(1)} `;
      pen = true;
    }
    return d;
  }
  $effect(() => {
    if (!interactive) {
      extra = 0;
      chosen = null;
    }
  });
</script>

<div class="tool stack-sm">
  <svg
    viewBox="0 0 {sc.W} {sc.H}"
    class="tool__svg"
    role="img"
    aria-label="{t('lesson.tool.fit')} — {points.length} {t('lesson.fit.points')}"
    data-testid="fit-tool"
    data-points={points.length}
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
    <text x={sc.W - sc.pad.r} y={sc.H - 6} class="label" text-anchor="end">{tool.labels.x}</text>
    <text x={sc.pad.l + 4} y={sc.pad.t - 4} class="label">{tool.labels.y}</text>
    {#if active?.fn}
      {#each points as [x, y], i (i)}
        <line
          x1={sc.sx(x)}
          y1={sc.sy(y)}
          x2={sc.sx(x)}
          y2={sc.sy(active.fn(x))}
          stroke={active.color}
          stroke-width="1.2"
          opacity="0.6"
        />
      {/each}
    {/if}
    {#each models as m (m.id)}
      {#if m.fn}
        <path
          d={pathOf(m.fn)}
          fill="none"
          stroke={m.color}
          stroke-width={m.id === active?.id ? 2.8 : 1.6}
          opacity={m.id === active?.id ? 1 : 0.55}
          class="fade"
        />
      {/if}
    {/each}
    {#each points as [x, y], i (i)}
      <circle cx={sc.sx(x)} cy={sc.sy(y)} r="4.5" class="point" />
    {/each}
    {#if target !== null}
      <line
        x1={sc.sx(target)}
        y1={sc.pad.t}
        x2={sc.sx(target)}
        y2={sc.H - sc.pad.b}
        class="target"
      />
      {#if prediction !== null && Number.isFinite(prediction)}
        <circle
          cx={sc.sx(target)}
          cy={sc.sy(prediction)}
          r="6"
          fill={active?.color ?? '#fff'}
          stroke="#0b1020"
          stroke-width="1.5"
        />
        <text x={sc.sx(target) - 8} y={sc.sy(prediction) - 10} class="note" text-anchor="end"
          >{t('lesson.fit.prediction')}
          {tool.labels.x} = {fmt(target, locale.current)} : {fmt(prediction, locale.current)}</text
        >
      {/if}
    {/if}
  </svg>
  <div class="cluster small" data-testid="fit-models">
    {#each models as m (m.id)}
      <button
        type="button"
        class="chip"
        class:chip--active={m.id === active?.id}
        style="border-color: {m.color}"
        aria-pressed={m.id === active?.id}
        disabled={!interactive}
        onclick={() => (chosen = m.id)}
      >
        <span style="color: {m.color}">●</span>
        {m.label} · {t('lesson.fit.error')}
        {fmt(m.rms, locale.current)}
      </button>
    {/each}
  </div>
  {#if interactive && tool.measure && tool.generator}
    <div class="cluster small">
      <button
        class="btn btn--sm"
        type="button"
        onclick={() => (extra += 1)}
        data-testid="fit-measure">{t('lesson.fit.measure')}</button
      >
      <span class="muted">{points.length} {t('lesson.fit.points')}</span>
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
  .note {
    font-size: 13px;
    fill: #eef1f8;
    font-family: var(--font-body);
    font-weight: 600;
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .point {
    fill: #fff;
    stroke: #0b1020;
    stroke-width: 1.2;
  }
  .target {
    stroke: #fff;
    stroke-width: 1;
    stroke-dasharray: 3 4;
    opacity: 0.8;
  }
  .chip--active {
    background: rgba(255, 255, 255, 0.12);
  }
  .fade {
    animation: fade 0.8s ease-out;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fade {
      animation: none;
    }
  }
</style>
