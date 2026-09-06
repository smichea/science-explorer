<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { fieldFunction, gradientAt, type ToolState } from '$lib/domain/lesson';
  import { locale, t } from '$lib/state/locale.svelte';
  import { fmt, scales } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'field' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const sc = $derived(scales(tstate.view));
  const f = $derived(fieldFunction(tool.expr, tstate.params));
  let marker = $state<[number, number] | null>(null);
  const at = $derived(marker ?? [tool.marker.x, tool.marker.y]);
  let svg = $state<SVGSVGElement | null>(null);
  let dragging = false;

  const COLS = 48;
  const ROWS = 34;
  /** Sampled values of the field on a grid, with its range. */
  const grid = $derived.by(() => {
    const values: number[] = [];
    let min = Infinity;
    let max = -Infinity;
    const [xMin, xMax] = tstate.view.x;
    const [yMin, yMax] = tstate.view.y;
    for (let j = 0; j <= ROWS; j++) {
      for (let i = 0; i <= COLS; i++) {
        const x = xMin + (i / COLS) * (xMax - xMin);
        const y = yMin + (j / ROWS) * (yMax - yMin);
        const v = f ? f(x, y) : NaN;
        values.push(v);
        if (Number.isFinite(v)) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      }
    }
    if (!Number.isFinite(min)) {
      min = 0;
      max = 1;
    }
    if (max === min) max = min + 1;
    return { values, min, max };
  });
  const value = (i: number, j: number) => grid.values[j * (COLS + 1) + i];
  const colour = (v: number) => {
    const s = Math.max(0, Math.min(1, (v - grid.min) / (grid.max - grid.min)));
    // Deep blue → violet → orange → yellow.
    const stops: Array<[number, number, number]> = [
      [23, 34, 84],
      [99, 79, 170],
      [230, 140, 70],
      [255, 220, 110],
    ];
    const pos = s * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(pos));
    const tt = pos - k;
    const mix = (a: number, b: number) => Math.round(a + (b - a) * tt);
    return `rgb(${mix(stops[k][0], stops[k + 1][0])}, ${mix(stops[k][1], stops[k + 1][1])}, ${mix(stops[k][2], stops[k + 1][2])})`;
  };
  const cells = $derived.by(() => {
    const out: Array<{ x: number; y: number; w: number; h: number; fill: string }> = [];
    const [xMin, xMax] = tstate.view.x;
    const [yMin, yMax] = tstate.view.y;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const v = (value(i, j) + value(i + 1, j) + value(i, j + 1) + value(i + 1, j + 1)) / 4;
        if (!Number.isFinite(v)) continue;
        const x0 = sc.sx(xMin + (i / COLS) * (xMax - xMin));
        const x1 = sc.sx(xMin + ((i + 1) / COLS) * (xMax - xMin));
        const y0 = sc.sy(yMin + ((j + 1) / ROWS) * (yMax - yMin));
        const y1 = sc.sy(yMin + (j / ROWS) * (yMax - yMin));
        out.push({ x: x0, y: y0, w: x1 - x0 + 0.5, h: y1 - y0 + 0.5, fill: colour(v) });
      }
    }
    return out;
  });
  /** Iso-lines by marching squares, one polyline segment list per level. */
  const contours = $derived.by(() => {
    const [xMin, xMax] = tstate.view.x;
    const [yMin, yMax] = tstate.view.y;
    const px = (i: number) => sc.sx(xMin + (i / COLS) * (xMax - xMin));
    const py = (j: number) => sc.sy(yMin + (j / ROWS) * (yMax - yMin));
    const out: string[] = [];
    for (let l = 1; l <= tool.levels; l++) {
      const level = grid.min + ((grid.max - grid.min) * l) / (tool.levels + 1);
      let d = '';
      for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          const a = value(i, j + 1);
          const b = value(i + 1, j + 1);
          const c = value(i + 1, j);
          const dd = value(i, j);
          if (![a, b, c, dd].every(Number.isFinite)) continue;
          const lerp = (v1: number, v2: number) => (level - v1) / (v2 - v1);
          const pts: Array<[number, number]> = [];
          if (a >= level !== b >= level) pts.push([px(i + lerp(a, b)), py(j + 1)]);
          if (b >= level !== c >= level) pts.push([px(i + 1), py(j + 1 - lerp(b, c))]);
          if (c >= level !== dd >= level) pts.push([px(i + 1 - lerp(c, dd)), py(j)]);
          if (dd >= level !== a >= level) pts.push([px(i), py(j + lerp(dd, a))]);
          if (pts.length >= 2)
            d += `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)} L${pts[1][0].toFixed(1)} ${pts[1][1].toFixed(1)} `;
          if (pts.length === 4)
            d += `M${pts[2][0].toFixed(1)} ${pts[2][1].toFixed(1)} L${pts[3][0].toFixed(1)} ${pts[3][1].toFixed(1)} `;
        }
      }
      out.push(d);
    }
    return out;
  });
  const reading = $derived.by(() => {
    if (!f) return null;
    const [x, y] = at;
    const v = f(x, y);
    const [gx, gy] = gradientAt(f, x, y);
    return { x, y, v, gx, gy, norm: Math.hypot(gx, gy) };
  });
  /** The gradient arrow, scaled to a readable length on screen. */
  const arrow = $derived.by(() => {
    if (!reading || !Number.isFinite(reading.norm) || reading.norm === 0) return null;
    const [xMin, xMax] = tstate.view.x;
    const scale = (xMax - xMin) / 6 / reading.norm;
    const head: [number, number] = [reading.x + reading.gx * scale, reading.y + reading.gy * scale];
    const x1 = sc.sx(reading.x);
    const y1 = sc.sy(reading.y);
    const x2 = sc.sx(head[0]);
    const y2 = sc.sy(head[1]);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const p = (a: number, r: number) =>
      `${x2 - r * Math.cos(angle + a)},${y2 - r * Math.sin(angle + a)}`;
    return { x1, y1, x2, y2, tip: `${x2},${y2} ${p(0.4, 11)} ${p(-0.4, 11)}` };
  });

  function dataAt(event: PointerEvent): [number, number] | null {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * sc.W;
    const py = ((event.clientY - rect.top) / rect.height) * sc.H;
    const [xMin, xMax] = tstate.view.x;
    const [yMin, yMax] = tstate.view.y;
    return [
      Math.max(xMin, Math.min(xMax, sc.fromSx(px))),
      Math.max(yMin, Math.min(yMax, sc.fromSy(py))),
    ];
  }
  function onPointerDown(event: PointerEvent) {
    if (!interactive) return;
    dragging = true;
    const at = dataAt(event);
    if (at) marker = at;
  }
  function onPointerMove(event: PointerEvent) {
    if (!interactive || !dragging) return;
    const at = dataAt(event);
    if (at) marker = at;
  }
  function onPointerUp() {
    dragging = false;
  }
  $effect(() => {
    if (!interactive) marker = null;
  });
</script>

<div class="tool stack-sm">
  <svg
    bind:this={svg}
    viewBox="0 0 {sc.W} {sc.H}"
    class="tool__svg"
    class:tool__svg--pick={interactive}
    role="img"
    aria-label="{t('lesson.tool.field')} — f(x, y) = {tool.expr}"
    data-testid="field-tool"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
  >
    {#each cells as c, i (i)}
      <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={c.fill} />
    {/each}
    {#each contours as d, i (i)}
      <path {d} fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1" />
    {/each}
    {#each sc.xTicks as v (v)}
      <text x={sc.sx(v)} y={sc.H - sc.pad.b + 14} class="tick" text-anchor="middle"
        >{fmt(v, locale.current)}</text
      >
    {/each}
    {#each sc.yTicks as v (v)}
      <text x={sc.pad.l - 6} y={sc.sy(v) + 3} class="tick" text-anchor="end"
        >{fmt(v, locale.current)}</text
      >
    {/each}
    <text x={sc.W - sc.pad.r} y={sc.H - 6} class="label" text-anchor="end">x</text>
    <text x={sc.pad.l + 4} y={sc.pad.t - 4} class="label">y</text>
    {#if arrow}
      <line
        x1={arrow.x1}
        y1={arrow.y1}
        x2={arrow.x2}
        y2={arrow.y2}
        stroke="#fff"
        stroke-width="3"
      />
      <polygon points={arrow.tip} fill="#fff" />
    {/if}
    {#if reading}
      <circle
        cx={sc.sx(reading.x)}
        cy={sc.sy(reading.y)}
        r="6"
        fill="#fff"
        stroke="#0b1020"
        stroke-width="1.5"
      />
    {/if}
  </svg>
  {#if reading}
    <p class="small muted" style="margin: 0" data-testid="field-reading" aria-live="polite">
      f({fmt(reading.x, locale.current)} ; {fmt(reading.y, locale.current)}) = {fmt(
        reading.v,
        locale.current
      )} ·
      {t('lesson.field.gradient')} = ({fmt(reading.gx, locale.current)} ; {fmt(
        reading.gy,
        locale.current
      )}), {t('lesson.vectors.norm')}
      {fmt(reading.norm, locale.current)}
    </p>
  {/if}
  {#if interactive}<p class="small muted" style="margin: 0">{t('lesson.field.dragHint')}</p>{/if}
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
  .tick {
    font-size: 11px;
    fill: #eef1f8;
    font-family: var(--font-body);
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 3px;
  }
  .label {
    font-size: 12px;
    fill: #fff;
    font-family: var(--font-body);
    font-weight: 600;
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 3px;
  }
</style>
