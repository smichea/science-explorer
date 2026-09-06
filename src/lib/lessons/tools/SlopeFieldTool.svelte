<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import {
    evaluateScalar,
    fieldFunction,
    integrateSolution,
    itemVisible,
    type ToolState,
  } from '$lib/domain/lesson';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { PALETTE, fmt, scales } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'slope_field' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const sc = $derived(scales(tstate.view));
  const f = $derived(fieldFunction(tool.equation, tstate.params));
  /** The learner's own initial condition (free play). */
  let picked = $state<[number, number] | null>(null);
  let svg = $state<SVGSVGElement | null>(null);

  const segments = $derived.by(() => {
    if (!f) return [] as Array<{ x1: number; y1: number; x2: number; y2: number }>;
    const out: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const cols = 18;
    const rows = 13;
    const [xMin, xMax] = tstate.view.x;
    const [yMin, yMax] = tstate.view.y;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = xMin + ((i + 0.5) / cols) * (xMax - xMin);
        const y = yMin + ((j + 0.5) / rows) * (yMax - yMin);
        const m = f(x, y);
        if (!Number.isFinite(m)) continue;
        // Direction in screen space: one unit of x maps to plotW/(xMax-xMin) pixels.
        const dx = sc.plotW / (xMax - xMin);
        const dy = -m * (sc.plotH / (yMax - yMin));
        const len = Math.hypot(dx, dy) || 1;
        const half = 7;
        const cx = sc.sx(x);
        const cy = sc.sy(y);
        out.push({
          x1: cx - (dx / len) * half,
          y1: cy - (dy / len) * half,
          x2: cx + (dx / len) * half,
          y2: cy + (dy / len) * half,
        });
      }
    }
    return out;
  });

  function polyline(points: Array<[number, number]>): string {
    return points.map(([x, y]) => `${sc.sx(x).toFixed(1)},${sc.sy(y).toFixed(1)}`).join(' ');
  }
  const solutions = $derived.by(() => {
    if (!f) return [];
    const fn = f;
    const authored = tool.solutions
      .filter((s) => itemVisible(s, tstate))
      .map((s, i) => {
        const x0 = evaluateScalar(s.x0, tstate.params);
        const y0 = evaluateScalar(s.y0, tstate.params);
        return {
          id: s.id,
          x0,
          y0,
          color: s.color ?? PALETTE[i % PALETTE.length],
          label: s.label ? L(s.label) : `(${fmt(x0, locale.current)} ; ${fmt(y0, locale.current)})`,
          points: integrateSolution(fn, x0, y0, tstate.view),
        };
      });
    if (picked)
      authored.push({
        id: 'picked',
        x0: picked[0],
        y0: picked[1],
        color: '#ffffff',
        label: `(${fmt(picked[0], locale.current)} ; ${fmt(picked[1], locale.current)})`,
        points: integrateSolution(fn, picked[0], picked[1], tstate.view),
      });
    return authored.filter((s) => Number.isFinite(s.x0) && Number.isFinite(s.y0));
  });

  function onPointerDown(event: PointerEvent) {
    if (!interactive || !tool.pick || !svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * sc.W;
    const py = ((event.clientY - rect.top) / rect.height) * sc.H;
    const x = sc.fromSx(px);
    const y = sc.fromSy(py);
    const [xMin, xMax] = tstate.view.x;
    const [yMin, yMax] = tstate.view.y;
    if (x < xMin || x > xMax || y < yMin || y > yMax) return;
    picked = [Math.round(x * 20) / 20, Math.round(y * 20) / 20];
  }
  $effect(() => {
    if (!interactive) picked = null;
  });
  const paramText = $derived(
    Object.entries(tstate.params)
      .map(([k, v]) => `${k} = ${fmt(v, locale.current)}`)
      .join(', ')
  );
</script>

<div class="tool stack-sm">
  <svg
    bind:this={svg}
    viewBox="0 0 {sc.W} {sc.H}"
    class="tool__svg"
    class:tool__svg--pick={interactive && tool.pick}
    role="img"
    aria-label="{t('lesson.tool.slope_field')} — {tool.labels.y}' = {tool.equation}"
    data-testid="slope-field-tool"
    data-solutions={solutions.length}
    onpointerdown={onPointerDown}
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
    {#each segments as s, i (i)}
      <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} class="slope" />
    {/each}
    {#each solutions as s (s.id)}
      <polyline
        points={polyline(s.points)}
        fill="none"
        stroke={s.color}
        stroke-width="2.6"
        class="fade"
      />
      <circle
        cx={sc.sx(s.x0)}
        cy={sc.sy(s.y0)}
        r="5"
        fill={s.color}
        stroke="#0b1020"
        stroke-width="1.5"
      />
      <text x={sc.sx(s.x0) + 8} y={sc.sy(s.y0) - 8} class="note" fill={s.color}>{s.label}</text>
    {/each}
  </svg>
  <p class="small muted" style="margin: 0" data-testid="slope-field-equation">
    {tool.labels.y}′ = {tool.equation}{#if paramText}, {paramText}{/if}
  </p>
  {#if interactive && tool.pick}<p class="small muted" style="margin: 0">
      {t('lesson.slope.pickHint')}
    </p>{/if}
</div>

<style>
  .tool__svg {
    width: 100%;
    height: auto;
    display: block;
    border-radius: var(--radius);
    background: #070b17;
    touch-action: none;
  }
  .tool__svg--pick {
    cursor: crosshair;
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
  .slope {
    stroke: rgba(167, 176, 200, 0.55);
    stroke-width: 1.4;
    stroke-linecap: round;
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
