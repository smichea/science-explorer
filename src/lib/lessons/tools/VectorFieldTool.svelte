<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { evaluateScalar, itemVisible, type ToolState } from '$lib/domain/lesson';
  import { FIELD_CONSTANTS, fieldAt, forceIn, type PlacedSource } from '$lib/domain/lessonTools';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { PALETTE, fmt, fmtSci, scales } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'vector_field' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const sc = $derived(scales(tstate.view));
  /** Hit radius of a handle, in pixels. */
  const HIT = 18;
  /** Sources moved by the learner, in data units. */
  let dragged = $state<Record<string, [number, number]>>({});
  /** Marker moved by the learner, in data units. */
  let markerDrag = $state<[number, number] | null>(null);
  /** The id of the source being dragged, or `marker`. */
  let dragging: string | null = null;
  let svg = $state<SVGSVGElement | null>(null);

  /** A scalar of the tool, or the fallback when it does not evaluate. */
  const num = (value: number | string, fallback: number) => {
    const v = evaluateScalar(value, tstate.params);
    return Number.isFinite(v) ? v : fallback;
  };
  const constant = $derived(
    tool.constant === undefined
      ? FIELD_CONSTANTS[tool.mode]
      : num(tool.constant, FIELD_CONSTANTS[tool.mode])
  );
  const uniform = $derived<[number, number]>([num(tool.uniform.x, 0), num(tool.uniform.y, 0)]);
  const test = $derived(num(tool.test, 0));
  const gravity = $derived(tool.mode === 'gravitational');
  const unit = $derived(gravity ? 'N/kg' : 'V/m');
  const sourceUnit = $derived(gravity ? 'kg' : 'C');
  const symbol = $derived(gravity ? 'g' : 'E');

  interface Placed extends PlacedSource {
    id: string;
    label: string;
    color: string;
    drag: boolean;
    radius: number;
  }
  const placed = $derived.by((): Placed[] =>
    tool.sources
      .filter((s) => itemVisible(s, tstate))
      .map((s) => {
        const override = dragged[s.id];
        const value = num(s.value, 0);
        return {
          id: s.id,
          x: override ? override[0] : num(s.x, NaN),
          y: override ? override[1] : num(s.y, NaN),
          value,
          label: s.label ? L(s.label) : `${fmtSci(value, locale.current)} ${sourceUnit}`,
          color: s.color ?? (gravity ? PALETTE[5] : value >= 0 ? PALETTE[3] : PALETTE[0]),
          drag: s.drag,
          // A mass shows as a disc growing with the logarithm of the mass; a charge as a fixed disc.
          radius: gravity ? Math.min(24, 6 + 1.6 * Math.log10(1 + Math.abs(value))) : 10,
        };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  );

  /** Pixels per data unit on each axis: the drawn direction of a vector respects the view. */
  const kx = $derived(sc.plotW / (tstate.view.x[1] - tstate.view.x[0]));
  const ky = $derived(sc.plotH / (tstate.view.y[1] - tstate.view.y[0]));
  /** Unit vector of a field vector on screen (y down), or null for a zero vector. */
  function direction(f: [number, number]): [number, number] | null {
    const dx = f[0] * kx;
    const dy = -f[1] * ky;
    const len = Math.hypot(dx, dy);
    if (!(len > 0) || !Number.isFinite(len)) return null;
    return [dx / len, dy / len];
  }
  /** Arrow head polygon at the tip of a segment (screen coordinates). */
  function arrowHead(x1: number, y1: number, x2: number, y2: number, size = 11): string {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const p = (d: number) =>
      `${(x2 - size * Math.cos(a + d)).toFixed(1)},${(y2 - size * Math.sin(a + d)).toFixed(1)}`;
    return `${x2.toFixed(1)},${y2.toFixed(1)} ${p(0.4)} ${p(-0.4)}`;
  }
  const hex = (c: string): [number, number, number] => [
    parseInt(c.slice(1, 3), 16),
    parseInt(c.slice(3, 5), 16),
    parseInt(c.slice(5, 7), 16),
  ];
  const RAMP = [hex(PALETTE[0]), hex(PALETTE[1])];
  /** Colour of an arrow from its relative magnitude: weak in blue, strong in orange. */
  function ramp(s: number): string {
    const mix = (i: number) => Math.round(RAMP[0][i] + (RAMP[1][i] - RAMP[0][i]) * s);
    return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`;
  }

  interface Arrow {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    head: string;
    color: string;
  }
  /** The field sampled at the centres of a grid of cells, drawn as arrows scaled by magnitude. */
  const arrows = $derived.by((): Arrow[] => {
    const n = tool.grid;
    const [xMin, xMax] = tstate.view.x;
    const [yMin, yMax] = tstate.view.y;
    const cells: Array<{ cx: number; cy: number; f: [number, number]; m: number }> = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = xMin + ((i + 0.5) / n) * (xMax - xMin);
        const y = yMin + ((j + 0.5) / n) * (yMax - yMin);
        const f = fieldAt(tool.mode, constant, placed, uniform, x, y);
        if (!f) continue;
        const m = Math.hypot(f[0], f[1]);
        if (!Number.isFinite(m) || m === 0) continue;
        cells.push({ cx: sc.sx(x), cy: sc.sy(y), f, m });
      }
    }
    // Lengths relative to the 90th percentile: weak arrows stay visible, strong ones fill the cell.
    const sorted = cells.map((c) => c.m).sort((a, b) => a - b);
    const e90 = sorted.length ? sorted[Math.floor(0.9 * (sorted.length - 1))] : 0;
    const cell = Math.min(sc.plotW, sc.plotH) / n;
    return cells.flatMap((c) => {
      const d = direction(c.f);
      if (!d) return [];
      const s = e90 > 0 ? Math.min(1, c.m / e90) : 1;
      const len = 0.85 * cell * (0.3 + 0.7 * s);
      const x1 = c.cx - (d[0] * len) / 2;
      const y1 = c.cy - (d[1] * len) / 2;
      const x2 = c.cx + (d[0] * len) / 2;
      const y2 = c.cy + (d[1] * len) / 2;
      const head = arrowHead(x1, y1, x2, y2, Math.max(3.5, Math.min(8, len * 0.35)));
      return [{ x1, y1, x2, y2, head, color: ramp(s) }];
    });
  });

  const marker = $derived<[number, number]>(markerDrag ?? [tool.marker.x, tool.marker.y]);
  /** The field and the force on the test charge or mass at the marker; null on a source. */
  const reading = $derived.by(() => {
    const f = fieldAt(tool.mode, constant, placed, uniform, marker[0], marker[1]);
    if (!f || !Number.isFinite(f[0]) || !Number.isFinite(f[1])) return null;
    const force = forceIn(f, test);
    return {
      f,
      norm: Math.hypot(f[0], f[1]),
      angle: (Math.atan2(f[1], f[0]) * 180) / Math.PI,
      force,
      forceNorm: Math.hypot(force[0], force[1]),
    };
  });
  function bigArrow(v: [number, number], length: number, size: number) {
    const d = direction(v);
    if (!d) return null;
    const x1 = sc.sx(marker[0]);
    const y1 = sc.sy(marker[1]);
    const x2 = x1 + d[0] * length;
    const y2 = y1 + d[1] * length;
    return { x1, y1, x2, y2, head: arrowHead(x1, y1, x2, y2, size) };
  }
  const fieldArrow = $derived(reading ? bigArrow(reading.f, 60, 11) : null);
  const forceArrow = $derived(reading && test !== 0 ? bigArrow(reading.force, 42, 9) : null);

  // --- free play: drag the marker, or a source ---------------------------------------------
  function dataAt(event: PointerEvent): [number, number] | null {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * sc.W;
    const py = ((event.clientY - rect.top) / rect.height) * sc.H;
    return [sc.fromSx(px), sc.fromSy(py)];
  }
  /** Snaps to a round fraction of the view (a tenth of a metre on a 4 m view) and clamps to it. */
  function snapped(at: [number, number]): [number, number] {
    const [xMin, xMax] = tstate.view.x;
    const [yMin, yMax] = tstate.view.y;
    const snap = (v: number, span: number) => {
      const step = 10 ** Math.floor(Math.log10(span / 40));
      return Math.round(v / step) * step;
    };
    return [
      Math.max(xMin, Math.min(xMax, snap(at[0], xMax - xMin))),
      Math.max(yMin, Math.min(yMax, snap(at[1], yMax - yMin))),
    ];
  }
  function moveTo(at: [number, number]) {
    const target = snapped(at);
    if (dragging === 'marker') markerDrag = target;
    else if (dragging) dragged = { ...dragged, [dragging]: target };
  }
  function onPointerDown(event: PointerEvent) {
    if (!interactive) return;
    const at = dataAt(event);
    if (!at) return;
    const px = sc.sx(at[0]);
    const py = sc.sy(at[1]);
    let best: { id: string; d: number } | null = null;
    for (const p of placed) {
      if (!p.drag) continue;
      const d = Math.hypot(sc.sx(p.x) - px, sc.sy(p.y) - py);
      if (d < HIT && (!best || d < best.d)) best = { id: p.id, d };
    }
    // The nearest handle wins; a press away from every source moves the marker there.
    const dm = Math.hypot(sc.sx(marker[0]) - px, sc.sy(marker[1]) - py);
    dragging = best && best.d < dm ? best.id : 'marker';
    moveTo(at);
  }
  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    const at = dataAt(event);
    if (at) moveTo(at);
  }
  function onPointerUp() {
    dragging = null;
  }
  $effect(() => {
    if (!interactive) {
      dragged = {};
      markerDrag = null;
    }
  });
  const f2 = (v: number) => fmt(v, locale.current);
  const sci = (v: number) => fmtSci(v, locale.current);
</script>

<div
  class="tool stack-sm"
  data-testid="vector-field-tool"
  data-mode={tool.mode}
  data-sources={placed.length}
>
  <svg
    bind:this={svg}
    viewBox="0 0 {sc.W} {sc.H}"
    class="tool__svg"
    class:tool__svg--pick={interactive}
    role="img"
    aria-label={t('lesson.tool.vector_field')}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
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
    <!-- the field on the grid -->
    {#each arrows as a, i (i)}
      <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={a.color} stroke-width="1.6" />
      <polygon points={a.head} fill={a.color} />
    {/each}
    <!-- the sources: charges with their sign, masses as discs -->
    {#if tool.mode !== 'uniform'}
      {#each placed as p (p.id)}
        {#if p.drag && interactive}
          <circle cx={sc.sx(p.x)} cy={sc.sy(p.y)} r={p.radius + 8} fill={p.color} opacity="0.2" />
        {/if}
        <circle
          cx={sc.sx(p.x)}
          cy={sc.sy(p.y)}
          r={p.radius}
          fill={p.color}
          stroke="#0b1020"
          stroke-width="1.5"
        />
        {#if tool.mode === 'electric'}
          <text
            x={sc.sx(p.x)}
            y={sc.sy(p.y)}
            class="sign"
            text-anchor="middle"
            dominant-baseline="central">{p.value >= 0 ? '+' : '−'}</text
          >
        {/if}
        <text
          x={sc.sx(p.x) + p.radius + 5}
          y={sc.sy(p.y) - p.radius - 3}
          class="note"
          fill={p.color}>{p.label}</text
        >
      {/each}
    {/if}
    <!-- the marker, the field there and the force on the test charge or mass -->
    {#if fieldArrow}
      <line
        x1={fieldArrow.x1}
        y1={fieldArrow.y1}
        x2={fieldArrow.x2}
        y2={fieldArrow.y2}
        stroke="#fff"
        stroke-width="3"
      />
      <polygon points={fieldArrow.head} fill="#fff" />
      <text x={fieldArrow.x2 + 8} y={fieldArrow.y2 - 8} class="note">{symbol}</text>
    {/if}
    {#if forceArrow}
      <line
        x1={forceArrow.x1}
        y1={forceArrow.y1}
        x2={forceArrow.x2}
        y2={forceArrow.y2}
        stroke={PALETTE[5]}
        stroke-width="3.5"
      />
      <polygon points={forceArrow.head} fill={PALETTE[5]} />
      <text x={forceArrow.x2 + 8} y={forceArrow.y2 + 14} class="note" fill={PALETTE[5]}>F</text>
    {/if}
    {#if interactive}
      <circle cx={sc.sx(marker[0])} cy={sc.sy(marker[1])} r="14" fill="#fff" opacity="0.12" />
    {/if}
    <circle
      cx={sc.sx(marker[0])}
      cy={sc.sy(marker[1])}
      r="7"
      fill="none"
      stroke="#fff"
      stroke-width="2.2"
    />
    <circle cx={sc.sx(marker[0])} cy={sc.sy(marker[1])} r="1.5" fill="#fff" />
  </svg>
  <ul class="readout small" aria-live="polite" data-testid="vector-field-reading">
    <li>
      <strong>{t(`lesson.vfield.${tool.mode}`)}</strong>
      {#if tool.mode === 'electric'}
        · k = {sci(constant)} N·m²/C²
      {:else if tool.mode === 'gravitational'}
        · G = {sci(constant)} N·m²/kg²
      {/if}
    </li>
    {#if reading}
      <li>
        {t('lesson.vfield.field')} ({f2(marker[0])} ; {f2(marker[1])}) : |{symbol}| = {sci(
          reading.norm
        )}
        {unit} · ({sci(reading.f[0])} ; {sci(reading.f[1])})
      </li>
      <li>
        {t('lesson.vfield.direction')} : {reading.norm > 0
          ? `${fmt(reading.angle, locale.current, 1)}°`
          : '—'}
      </li>
      {#if test !== 0}
        <li>
          {t(gravity ? 'lesson.vfield.forceMass' : 'lesson.vfield.forceCharge')} ({gravity
            ? 'm'
            : 'q'} = {sci(test)}
          {sourceUnit}) : |F| = {sci(reading.forceNorm)} N
        </li>
      {/if}
    {:else}
      <li>
        {t('lesson.vfield.field')} ({f2(marker[0])} ; {f2(marker[1])}) : {t(
          'lesson.vfield.atSource'
        )}
      </li>
    {/if}
  </ul>
  {#if interactive}<p class="small muted" style="margin: 0">{t('lesson.vfield.dragHint')}</p>{/if}
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
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 3px;
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
  .sign {
    font-size: 15px;
    fill: #0b1020;
    font-family: var(--font-body);
    font-weight: 700;
  }
  .readout {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.15rem;
  }
</style>
