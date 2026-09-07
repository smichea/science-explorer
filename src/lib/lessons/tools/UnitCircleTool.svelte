<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { evaluateScalar, type ToolState } from '$lib/domain/lesson';
  import { angleLabel, exactTrig, principalAngle, twelfthOf } from '$lib/domain/lessonTools';
  import { locale, t } from '$lib/state/locale.svelte';
  import { PALETTE, fmt } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'unit_circle' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  /** The grid of the remarkable angles: the point snaps to the multiples of π/12. */
  const STEP = Math.PI / 12;
  const R = 150;
  const H = 400;
  const cy = 200;
  /** With the curves, the circle keeps the left 400 px and the curves take a panel on the right. */
  const W = $derived(tool.curves ? 720 : 560);
  const cx = $derived(tool.curves ? 200 : 270);
  const COLOR = { angle: PALETTE[5], cos: PALETTE[0], sin: PALETTE[2], tan: PALETTE[3] };
  /** Twelfths of π marked on the circle: the multiples of π/6 and π/4. */
  const MARKS = [2, 3, 4, 6, 8, 9, 10, 12, -2, -3, -4, -6, -8, -9, -10];

  /** The angle the learner dragged to (radians, winding kept), or null. */
  let dragged = $state<number | null>(null);
  let dragging = false;
  let svg = $state<SVGSVGElement | null>(null);

  const authored = $derived.by(() => {
    const a = evaluateScalar(tool.angle, tstate.params);
    return Number.isFinite(a) ? a : 0;
  });
  /** The raw angle: it may exceed 2π, the winding matters. */
  const angle = $derived(dragged ?? authored);
  const principal = $derived(principalAngle(angle));
  const cos = $derived(Math.cos(angle));
  const sin = $derived(Math.sin(angle));
  const tan = $derived(Math.tan(angle));
  const exact = $derived(exactTrig(angle));
  const degrees = $derived((angle * 180) / Math.PI);
  /** `π/6` for a remarkable angle, the radian value otherwise. */
  const labelOf = (a: number) => {
    const k = twelfthOf(a);
    return k === null ? fmt(a, locale.current, 2) : angleLabel(k);
  };
  const angleText = $derived(labelOf(angle));
  /** Screen position of a point given in polar coordinates (counter-clockwise, y up). */
  const px = (r: number, a: number) => cx + r * Math.cos(a);
  const py = (r: number, a: number) => cy - r * Math.sin(a);
  const M = $derived({ x: px(R, angle), y: py(R, angle) });

  /** Arrow head polygon at the tip of a segment (screen coordinates). */
  function arrowHead(tail: [number, number], head: [number, number], size = 9): string {
    const a = Math.atan2(head[1] - tail[1], head[0] - tail[0]);
    const p = (d: number) =>
      `${(head[0] - size * Math.cos(a + d)).toFixed(1)},${(head[1] - size * Math.sin(a + d)).toFixed(1)}`;
    return `${head[0].toFixed(1)},${head[1].toFixed(1)} ${p(0.4)} ${p(-0.4)}`;
  }

  const marks = $derived(
    MARKS.map((k) => {
      const a = k * STEP;
      return {
        k,
        label: angleLabel(k),
        x1: px(R - 5, a),
        y1: py(R - 5, a),
        x2: px(R + 5, a),
        y2: py(R + 5, a),
        lx: px(R + 18, a),
        ly: py(R + 18, a),
      };
    })
  );
  /** The mark under the point M keeps its tick but loses its label, which M's label replaces. */
  const currentK = $derived(twelfthOf(principal));

  /** Radius of the angle arc: it grows a little at each turn, so that a winding shows as a spiral. */
  const arcRadius = (a: number) => 34 + (5 * Math.abs(a)) / (2 * Math.PI);
  const arcPath = $derived.by(() => {
    const n = Math.max(2, Math.ceil(Math.abs(angle) / (Math.PI / 90)));
    let d = '';
    for (let i = 0; i <= n; i++) {
      const a = (angle * i) / n;
      const r = arcRadius(a);
      d += `${i ? 'L' : 'M'}${px(r, a).toFixed(1)} ${py(r, a).toFixed(1)} `;
    }
    return d;
  });
  const arcHead = $derived.by(() => {
    if (Math.abs(angle) < 0.25) return null;
    const r = arcRadius(angle);
    const back = angle - Math.sign(angle) * 0.08;
    return arrowHead([px(r, back), py(r, back)], [px(r, angle), py(r, angle)], 8);
  });
  const arcLabel = $derived.by(() => {
    const a = angle / 2;
    const r = arcRadius(a) + 18;
    return { x: px(r, a), y: py(r, a) + 4 };
  });

  /** The tangent axis x = 1 carries the point T(1, tan θ); the line (OM) passes through it. */
  const tangent = $derived.by(() => {
    if (!Number.isFinite(tan) || Math.abs(tan) >= 3) return null;
    // T sits at parameter 1/cos θ on the line O + s·(cos θ, sin θ), where M is at s = 1.
    const s = 1 / cos;
    const from = Math.min(0, s);
    const to = Math.max(1, s);
    return {
      x: cx + R,
      y: cy - R * tan,
      x1: cx + from * R * cos,
      y1: cy - from * R * sin,
      x2: cx + to * R * cos,
      y2: cy - to * R * sin,
      labelY: Math.max(30, Math.min(H - 14, cy - R * tan + 4)),
    };
  });

  // --- curves panel (y = cos x and y = sin x for x in [−π, 2π]) ----------------------------
  const PANEL = { x0: 436, x1: 692, xMin: -Math.PI, xMax: 2 * Math.PI };
  const pxOf = (x: number) =>
    PANEL.x0 + ((x - PANEL.xMin) / (PANEL.xMax - PANEL.xMin)) * (PANEL.x1 - PANEL.x0);
  /** Same vertical scale as the circle, so that the sine of M and its point on the curve line up. */
  const pyOf = (y: number) => cy - R * y;
  function curvePath(fn: (x: number) => number): string {
    let d = '';
    for (let i = 0; i <= 240; i++) {
      const x = PANEL.xMin + ((PANEL.xMax - PANEL.xMin) * i) / 240;
      d += `${i ? 'L' : 'M'}${pxOf(x).toFixed(1)} ${pyOf(fn(x)).toFixed(1)} `;
    }
    return d;
  }
  const cosPath = curvePath(Math.cos);
  const sinPath = curvePath(Math.sin);
  const panelTicks = [-12, -6, 0, 6, 12, 18, 24].map((k) => ({
    k,
    x: pxOf(k * STEP),
    label: angleLabel(k),
  }));

  // --- free play: drag the point, or move it with the arrow keys ---------------------------
  function angleAt(event: PointerEvent): number | null {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    const dx = x - cx;
    const dy = cy - y;
    // Too close to the centre, the direction means nothing.
    if (Math.hypot(dx, dy) < 12) return null;
    return Math.atan2(dy, dx);
  }
  function moveTo(pointer: number) {
    const snapped = Math.round(pointer / STEP) * STEP;
    // Keep the winding: the angle changes by less than π between two pointer events.
    let delta = snapped - principal;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta <= -Math.PI) delta += 2 * Math.PI;
    dragged = Math.round((angle + delta) / STEP) * STEP;
  }
  function onPointerDown(event: PointerEvent) {
    if (!interactive) return;
    dragging = true;
    const a = angleAt(event);
    if (a !== null) moveTo(a);
  }
  function onPointerMove(event: PointerEvent) {
    if (!interactive || !dragging) return;
    const a = angleAt(event);
    if (a !== null) moveTo(a);
  }
  function onPointerUp() {
    dragging = false;
  }
  function onKeyDown(event: KeyboardEvent) {
    if (!interactive) return;
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0;
    if (!direction) return;
    event.preventDefault();
    dragged = Math.round((angle + direction * STEP) / STEP) * STEP;
  }
  $effect(() => {
    if (!interactive) dragged = null;
  });

  // --- readout ------------------------------------------------------------------------------
  const f3 = (v: number) => fmt(v, locale.current, 3);
  /** `π/3 rad (60°)`, the degrees first when the tool asks for them. */
  const angleValue = $derived.by(() => {
    const rad = `${angleText} ${t('lesson.circle.radians')}`;
    const deg = `${fmt(degrees, locale.current, 1)}°`;
    return tool.degrees ? `${deg} (${rad})` : `${rad} (${deg})`;
  });
  const lines = $derived.by(() => {
    const out: Array<{ label: string; text: string; color?: string }> = [
      { label: t('lesson.circle.angle'), text: angleValue, color: COLOR.angle },
      { label: t('lesson.circle.cosine'), text: f3(cos), color: COLOR.cos },
      { label: t('lesson.circle.sine'), text: f3(sin), color: COLOR.sin },
      {
        label: t('lesson.circle.tangent'),
        text: Math.abs(tan) < 1e6 ? f3(tan) : '∞',
        color: COLOR.tan,
      },
    ];
    if (exact)
      out.push({
        label: t('lesson.circle.exact'),
        text: `cos ${exact.cos}, sin ${exact.sin}, tan ${exact.tan}`,
      });
    return out;
  });
  const readoutText = $derived(lines.map((l) => `${l.label} : ${l.text}`).join(' · '));
</script>

{#snippet picture()}
  <!-- axes -->
  <line x1={cx - R - 40} y1={cy} x2={cx + R + 40} y2={cy} class="axis" />
  <polygon
    points="{cx + R + 40},{cy} {cx + R + 32},{cy - 4} {cx + R + 32},{cy + 4}"
    class="axis-head"
  />
  <line x1={cx} y1={cy + R + 40} x2={cx} y2={cy - R - 40} class="axis" />
  <polygon
    points="{cx},{cy - R - 40} {cx - 4},{cy - R - 32} {cx + 4},{cy - R - 32}"
    class="axis-head"
  />
  <text x={cx + R + 44} y={cy + 4} class="tick">x</text>
  <text x={cx + 8} y={cy - R - 30} class="tick">y</text>
  <text x={cx - 6} y={cy + 16} class="tick" text-anchor="end">O</text>
  <!-- the circle and its remarkable angles -->
  <circle {cx} {cy} r={R} class="circle" />
  {#if tool.marks}
    {#each marks as m (m.k)}
      <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} class="mark" />
      {#if m.k !== currentK}
        <text x={m.lx} y={m.ly} class="tick" text-anchor="middle" dominant-baseline="middle"
          >{m.label}</text
        >
      {/if}
    {/each}
  {/if}
  <!-- the tangent axis -->
  <line x1={cx + R} y1={12} x2={cx + R} y2={H - 12} class="taxis" />
  <text x={cx + R + 6} y={22} class="note note--small" fill={COLOR.tan}>tan</text>
  <!-- the angle -->
  <path d={arcPath} fill="none" stroke={COLOR.angle} stroke-width="2" />
  {#if arcHead}
    <polygon points={arcHead} fill={COLOR.angle} />
  {/if}
  <text x={arcLabel.x} y={arcLabel.y} class="note" fill={COLOR.angle} text-anchor="middle"
    >{angleText}</text
  >
  <!-- projections on the axes -->
  <line x1={M.x} y1={M.y} x2={M.x} y2={cy} class="guide" stroke={COLOR.cos} />
  <line x1={M.x} y1={M.y} x2={cx} y2={M.y} class="guide" stroke={COLOR.sin} />
  <circle cx={M.x} {cy} r="3" fill={COLOR.cos} />
  <circle {cx} cy={M.y} r="3" fill={COLOR.sin} />
  <text
    x={M.x}
    y={sin >= 0 ? cy + 16 : cy - 8}
    class="note note--small"
    fill={COLOR.cos}
    text-anchor="middle">cos = {fmt(cos, locale.current)}</text
  >
  <text
    x={cos >= 0 ? cx - 8 : cx + 8}
    y={Math.abs(sin) < 0.08 ? M.y - 6 : M.y + 4}
    class="note note--small"
    fill={COLOR.sin}
    text-anchor={cos >= 0 ? 'end' : 'start'}>sin = {fmt(sin, locale.current)}</text
  >
  <!-- the tangent -->
  {#if tangent}
    <line
      x1={tangent.x1}
      y1={tangent.y1}
      x2={tangent.x2}
      y2={tangent.y2}
      class="guide"
      stroke={COLOR.tan}
    />
    <circle cx={tangent.x} cy={tangent.y} r="4" fill={COLOR.tan} stroke="#0b1020" />
    <text x={tangent.x + 8} y={tangent.labelY} class="note note--small" fill={COLOR.tan}
      >tan = {fmt(tan, locale.current)}</text
    >
  {/if}
  <!-- the point M -->
  <line x1={cx} y1={cy} x2={M.x} y2={M.y} stroke="#eef1f8" stroke-width="1.5" opacity="0.8" />
  {#if interactive}
    <circle cx={M.x} cy={M.y} r="14" fill="#fff" opacity="0.15" />
  {/if}
  <circle cx={M.x} cy={M.y} r="6" fill="#fff" stroke="#0b1020" stroke-width="1.5" />
  <text x={px(R + 16, angle)} y={py(R + 16, angle) + 4} class="note" text-anchor="middle">M</text>
  <!-- the curves -->
  {#if tool.curves}
    <line x1={PANEL.x0} y1={cy} x2={PANEL.x1 + 8} y2={cy} class="axis" />
    <line x1={pxOf(0)} y1={pyOf(1.2)} x2={pxOf(0)} y2={pyOf(-1.2)} class="axis" />
    {#each panelTicks as tk (tk.k)}
      <line x1={tk.x} y1={cy - 4} x2={tk.x} y2={cy + 4} class="axis" />
      <text x={tk.x} y={cy + 16} class="tick" text-anchor="middle">{tk.label}</text>
    {/each}
    {#each [-1, 1] as v (v)}
      <line x1={pxOf(0) - 4} y1={pyOf(v)} x2={pxOf(0) + 4} y2={pyOf(v)} class="axis" />
      <text x={pxOf(0) - 7} y={pyOf(v) + 4} class="tick" text-anchor="end"
        >{fmt(v, locale.current)}</text
      >
    {/each}
    <path d={cosPath} fill="none" stroke={COLOR.cos} stroke-width="2" />
    <path d={sinPath} fill="none" stroke={COLOR.sin} stroke-width="2" />
    <text x={PANEL.x1 + 6} y={pyOf(1) + 4} class="note note--small" fill={COLOR.cos}>cos</text>
    <text x={PANEL.x1 + 6} y={pyOf(0) - 6} class="note note--small" fill={COLOR.sin}>sin</text>
    <!-- the current angle on the curves: the sine of M and its point on the curve share a height -->
    <line
      x1={M.x}
      y1={M.y}
      x2={pxOf(principal)}
      y2={pyOf(sin)}
      class="guide"
      stroke={COLOR.sin}
      opacity="0.45"
    />
    <line
      x1={pxOf(principal)}
      y1={pyOf(1.2)}
      x2={pxOf(principal)}
      y2={pyOf(-1.2)}
      class="guide"
      stroke={COLOR.angle}
    />
    <circle cx={pxOf(principal)} cy={pyOf(cos)} r="5" fill={COLOR.cos} stroke="#0b1020" />
    <circle cx={pxOf(principal)} cy={pyOf(sin)} r="5" fill={COLOR.sin} stroke="#0b1020" />
    <text
      x={pxOf(principal)}
      y={pyOf(1.2) - 6}
      class="note note--small"
      fill={COLOR.angle}
      text-anchor="middle">{labelOf(principal)}</text
    >
  {/if}
{/snippet}

<div class="tool stack-sm" data-testid="unit-circle-tool" data-angle={angle.toFixed(4)}>
  {#if interactive}
    <!-- During the free play the picture is a slider: drag the point, or press the arrow keys. -->
    <svg
      bind:this={svg}
      viewBox="0 0 {W} {H}"
      class="tool__svg tool__svg--drag"
      role="slider"
      tabindex="0"
      aria-label={readoutText}
      aria-valuenow={Number(angle.toFixed(4))}
      aria-valuetext={angleValue}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointerleave={onPointerUp}
      onkeydown={onKeyDown}
    >
      {@render picture()}
    </svg>
  {:else}
    <svg
      bind:this={svg}
      viewBox="0 0 {W} {H}"
      class="tool__svg"
      role="img"
      aria-label={readoutText}
    >
      {@render picture()}
    </svg>
  {/if}
  <ul class="readout small" aria-live="polite" data-testid="unit-circle-reading">
    {#each lines as line (line.label)}
      <li>
        <strong style:color={line.color}>{line.label}</strong> : {line.text}
      </li>
    {/each}
  </ul>
  {#if interactive}<p class="small muted" style="margin: 0">{t('lesson.circle.dragHint')}</p>{/if}
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
  .tool__svg--drag {
    cursor: grab;
  }
  .tool__svg:focus-visible {
    outline: 2px solid #7f9cff;
    outline-offset: 2px;
  }
  .axis {
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1.4;
  }
  .axis-head {
    fill: rgba(255, 255, 255, 0.45);
  }
  .circle {
    fill: none;
    stroke: #eef1f8;
    stroke-width: 2;
  }
  .mark {
    stroke: rgba(255, 255, 255, 0.55);
    stroke-width: 1.2;
  }
  .taxis {
    stroke: #ff8fab;
    stroke-width: 1;
    opacity: 0.5;
  }
  .tick {
    font-size: 11px;
    fill: #a7b0c8;
    font-family: var(--font-body);
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
  .note--small {
    font-size: 11px;
    font-weight: 500;
  }
  .guide {
    stroke-width: 1.2;
    stroke-dasharray: 4 4;
    opacity: 0.8;
  }
  .readout {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.15rem;
  }
</style>
