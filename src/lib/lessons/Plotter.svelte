<script lang="ts">
  import { curveFunction, evaluateScalar, slopeAt, type PlotterState } from '$lib/domain/lesson';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { prefs } from '$lib/state/prefs.svelte';

  interface Props {
    plot: PlotterState;
    variable: string;
    /** The learner may move the marker (free play, exercises). */
    interactive?: boolean;
    /** The learner's own expression, drawn on top of the authored curves. */
    customExpression?: string;
    marker?: number | null;
    showTangent?: boolean;
    onmarker?: (x: number | null) => void;
  }
  let {
    plot,
    variable,
    interactive = false,
    customExpression = '',
    marker = null,
    showTangent = false,
    onmarker,
  }: Props = $props();

  const W = 560;
  const H = 400;
  const pad = { l: 46, r: 18, t: 18, b: 38 };
  const PALETTE = ['#7f9cff', '#ffb347', '#5ee6a8', '#ff8fab', '#b39dff', '#ffd166', '#f7f1e3'];
  const CUSTOM_COLOR = '#ffffff';
  const SAMPLES = 360;

  const xMin = $derived(plot.view.x[0]);
  const xMax = $derived(plot.view.x[1]);
  const yMin = $derived(plot.view.y[0]);
  const yMax = $derived(plot.view.y[1]);
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const sx = (x: number) => pad.l + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => H - pad.b - ((y - yMin) / (yMax - yMin)) * plotH;
  const fromSx = (px: number) => xMin + ((px - pad.l) / plotW) * (xMax - xMin);

  interface DrawnCurve {
    id: string;
    label?: string;
    color: string;
    dashed: boolean;
    domain?: [number, number];
    fn: ((x: number) => number) | null;
  }
  const curves = $derived.by((): DrawnCurve[] =>
    plot.curves.map((c, i) => ({
      id: c.id,
      label: c.label ? L(c.label) : undefined,
      color: c.color ?? PALETTE[i % PALETTE.length],
      dashed: c.dashed,
      domain: c.domain,
      fn: curveFunction(c.expr, variable, plot.params),
    }))
  );
  const custom = $derived(
    customExpression.trim() ? curveFunction(customExpression, variable, plot.params) : null
  );
  const customError = $derived(!!customExpression.trim() && !custom);
  const fnOf = (id: string) => curves.find((c) => c.id === id)?.fn ?? null;
  /** The curve the marker reads: the learner's, else the most recently drawn one. */
  const mainCurve = $derived.by(() => {
    if (custom) return { fn: custom, color: CUSTOM_COLOR, label: customExpression.trim() };
    const newest = [...plot.order].reverse().find((id) => curves.some((c) => c.id === id));
    const c = curves.find((x) => x.id === newest) ?? curves[0];
    return c?.fn ? { fn: c.fn, color: c.color, label: c.label ?? c.id } : null;
  });

  /** SVG path of a function over an interval, broken where it is undefined or jumps. */
  function pathOf(fn: (x: number) => number, domain?: [number, number]): string {
    const a = Math.max(xMin, domain?.[0] ?? xMin);
    const b = Math.min(xMax, domain?.[1] ?? xMax);
    if (b <= a) return '';
    const jump = 4 * (yMax - yMin);
    let d = '';
    let pen = false;
    let prev = NaN;
    for (let i = 0; i <= SAMPLES; i++) {
      const x = a + ((b - a) * i) / SAMPLES;
      const y = fn(x);
      if (!Number.isFinite(y) || Math.abs(y) > 1e6 || (pen && Math.abs(y - prev) > jump)) {
        pen = false;
        prev = y;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sx(x).toFixed(2)} ${sy(y).toFixed(2)} `;
      pen = true;
      prev = y;
    }
    return d;
  }

  /** Where a curve label sits: on the curve, three quarters of the way across the view. */
  function labelAnchor(c: DrawnCurve): { x: number; y: number } | null {
    if (!c.fn) return null;
    const a = Math.max(xMin, c.domain?.[0] ?? xMin);
    const b = Math.min(xMax, c.domain?.[1] ?? xMax);
    for (let k = 0; k < 40; k++) {
      const x = b - ((b - a) * k) / 40 - (b - a) * 0.08;
      const y = c.fn(x);
      if (Number.isFinite(y) && y > yMin && y < yMax) return { x: sx(x), y: sy(y) };
    }
    return null;
  }

  function lineAcross(
    x0: number,
    y0: number,
    slope: number
  ): { x1: number; y1: number; x2: number; y2: number } {
    return {
      x1: sx(xMin),
      y1: sy(y0 + slope * (xMin - x0)),
      x2: sx(xMax),
      y2: sy(y0 + slope * (xMax - x0)),
    };
  }

  const points = $derived(
    plot.points
      .map((p) => {
        const fn = fnOf(p.on);
        const x = evaluateScalar(p.x, plot.params);
        const y = fn ? fn(x) : NaN;
        return { id: p.id, x, y, label: p.label ? L(p.label) : undefined, guides: p.guides };
      })
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  );
  const secants = $derived(
    plot.secants.flatMap((s) => {
      const fn = s.on ? fnOf(s.on) : null;
      const x1 = evaluateScalar(s.from, plot.params);
      const x2 = evaluateScalar(s.to, plot.params);
      if (!fn || !Number.isFinite(x1) || !Number.isFinite(x2) || x1 === x2) return [];
      const y1 = fn(x1);
      const y2 = fn(x2);
      const slope = (y2 - y1) / (x2 - x1);
      if (!Number.isFinite(slope)) return [];
      return [
        {
          id: s.id,
          x1,
          y1,
          x2,
          y2,
          slope,
          label: s.label ? L(s.label) : undefined,
          line: lineAcross(x1, y1, slope),
        },
      ];
    })
  );
  const tangents = $derived(
    plot.tangents.flatMap((tg) => {
      const fn = fnOf(tg.on);
      const x0 = evaluateScalar(tg.x, plot.params);
      if (!fn || !Number.isFinite(x0)) return [];
      const y0 = fn(x0);
      const slope = slopeAt(fn, x0);
      if (!Number.isFinite(slope) || !Number.isFinite(y0)) return [];
      return [
        {
          id: tg.id,
          x0,
          y0,
          slope,
          label: tg.label ? L(tg.label) : undefined,
          line: lineAcross(x0, y0, slope),
        },
      ];
    })
  );
  const intervals = $derived(
    plot.intervals.flatMap((iv) => {
      const c = iv.on ? curves.find((x) => x.id === iv.on) : null;
      const a = evaluateScalar(iv.from, plot.params);
      const b = evaluateScalar(iv.to, plot.params);
      if ((iv.on && !c?.fn) || !Number.isFinite(a) || !Number.isFinite(b)) return [];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return [
        {
          id: iv.id,
          a: lo,
          b: hi,
          color: c?.color ?? '#ffd166',
          // Without a curve, the interval is a band along the axis (the solutions of an inequality).
          path: c?.fn ? pathOf(c.fn, [lo, hi]) : '',
          onAxis: !c,
          label: iv.label ? L(iv.label) : undefined,
        },
      ];
    })
  );
  /** Straight lines a·x + b·y + c = 0 drawn across the view (vertical ones included). */
  const lines = $derived(
    plot.lines.flatMap((ln, i) => {
      const a = evaluateScalar(ln.a, plot.params);
      const b = evaluateScalar(ln.b, plot.params);
      const c = evaluateScalar(ln.c, plot.params);
      if (![a, b, c].every(Number.isFinite) || (a === 0 && b === 0)) return [];
      const color = ln.color ?? PALETTE[(i + 1) % PALETTE.length];
      const label = ln.label ? L(ln.label) : undefined;
      if (b === 0) {
        const x = -c / a;
        return [
          {
            id: ln.id,
            x1: sx(x),
            y1: sy(yMin),
            x2: sx(x),
            y2: sy(yMax),
            color,
            dashed: ln.dashed,
            label,
            lx: sx(x) + 6,
            ly: pad.t + 14,
          },
        ];
      }
      const y = (x: number) => -(a * x + c) / b;
      // The label sits where the line enters the view from the right.
      const xr = xMax - (xMax - xMin) * 0.06;
      const yr = Math.max(yMin, Math.min(yMax, y(xr)));
      return [
        {
          id: ln.id,
          x1: sx(xMin),
          y1: sy(y(xMin)),
          x2: sx(xMax),
          y2: sy(y(xMax)),
          color,
          dashed: ln.dashed,
          label,
          lx: sx(xr),
          ly: sy(yr) - 8,
        },
      ];
    })
  );
  const markerReading = $derived.by(() => {
    if (marker === null || !mainCurve) return null;
    const y = mainCurve.fn(marker);
    if (!Number.isFinite(y)) return null;
    const slope = showTangent ? slopeAt(mainCurve.fn, marker) : null;
    return { x: marker, y, slope, line: slope !== null ? lineAcross(marker, y, slope) : null };
  });

  function niceTicks(min: number, max: number, count = 6): number[] {
    const span = max - min;
    if (span <= 0) return [min];
    const rough = span / count;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / pow;
    const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * pow;
    const out: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step)
      out.push(Number(v.toFixed(10)));
    return out;
  }
  const xTicks = $derived(niceTicks(xMin, xMax));
  const yTicks = $derived(niceTicks(yMin, yMax));
  const fmt = (v: number) =>
    new Intl.NumberFormat(locale.current, {
      maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1,
    }).format(v);

  let svg = $state<SVGSVGElement | null>(null);
  let dragging = false;
  function xAt(event: PointerEvent): number | null {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const x = fromSx(px);
    return Math.max(xMin, Math.min(xMax, x));
  }
  function onPointerDown(event: PointerEvent) {
    if (!interactive) return;
    dragging = true;
    const x = xAt(event);
    if (x !== null) onmarker?.(x);
  }
  function onPointerMove(event: PointerEvent) {
    if (!interactive || !dragging) return;
    const x = xAt(event);
    if (x !== null) onmarker?.(x);
  }
  function onPointerUp() {
    dragging = false;
  }
  function onKey(event: KeyboardEvent) {
    if (!interactive) return;
    const stepX = (xMax - xMin) / 50;
    const current = marker ?? (xMin + xMax) / 2;
    if (event.key === 'ArrowRight') onmarker?.(Math.min(xMax, current + stepX));
    else if (event.key === 'ArrowLeft') onmarker?.(Math.max(xMin, current - stepX));
    else if (event.key === 'Escape') onmarker?.(null);
    else return;
    event.preventDefault();
  }

  const description = $derived(
    [...curves.map((c) => c.label ?? c.id), ...(custom ? [customExpression] : [])].join(', ')
  );
</script>

<div
  class="plotter"
  class:plotter--interactive={interactive}
  class:plotter--still={prefs.reducedMotion}
>
  <svg
    bind:this={svg}
    viewBox="0 0 {W} {H}"
    class="plotter__svg"
    role="img"
    aria-label="{t('lesson.kind.play')} — {description}"
    data-testid="plotter"
    data-curves={plot.curves.length}
  >
    <defs>
      <clipPath id="plot-area">
        <rect x={pad.l} y={pad.t} width={plotW} height={plotH} />
      </clipPath>
    </defs>
    <rect x={pad.l} y={pad.t} width={plotW} height={plotH} class="plotter__area" />
    <!-- grid and axes -->
    {#each xTicks as v (v)}
      <line
        x1={sx(v)}
        y1={pad.t}
        x2={sx(v)}
        y2={H - pad.b}
        class="plotter__grid"
        class:plotter__axis={v === 0}
      />
      <text x={sx(v)} y={H - pad.b + 14} class="plotter__tick" text-anchor="middle">{fmt(v)}</text>
    {/each}
    {#each yTicks as v (v)}
      <line
        x1={pad.l}
        y1={sy(v)}
        x2={W - pad.r}
        y2={sy(v)}
        class="plotter__grid"
        class:plotter__axis={v === 0}
      />
      <text x={pad.l - 6} y={sy(v) + 3} class="plotter__tick" text-anchor="end">{fmt(v)}</text>
    {/each}
    <text x={W - pad.r} y={H - 6} class="plotter__label" text-anchor="end"
      >{plot.view.labels.x}</text
    >
    <text x={pad.l + 4} y={pad.t - 4} class="plotter__label">{plot.view.labels.y}</text>

    <g clip-path="url(#plot-area)">
      {#each intervals as iv (iv.id)}
        <rect
          x={sx(iv.a)}
          y={pad.t}
          width={Math.max(0, sx(iv.b) - sx(iv.a))}
          height={plotH}
          fill={iv.color}
          opacity="0.12"
        />
        {#if iv.onAxis}
          <line
            x1={sx(iv.a)}
            y1={sy(Math.max(yMin, Math.min(yMax, 0)))}
            x2={sx(iv.b)}
            y2={sy(Math.max(yMin, Math.min(yMax, 0)))}
            stroke={iv.color}
            stroke-width="6"
            opacity="0.7"
            stroke-linecap="round"
          />
        {:else}
          <path
            d={iv.path}
            fill="none"
            stroke={iv.color}
            stroke-width="6"
            opacity="0.45"
            stroke-linecap="round"
          />
        {/if}
        {#if iv.label}<text
            x={(sx(iv.a) + sx(iv.b)) / 2}
            y={H - pad.b - 8}
            class="plotter__note"
            text-anchor="middle"
            fill={iv.color}>{iv.label}</text
          >{/if}
      {/each}
      {#each curves as c (c.id)}
        {#if c.fn}
          <path
            d={pathOf(c.fn, c.domain)}
            fill="none"
            stroke={c.color}
            stroke-width="2.4"
            stroke-dasharray={c.dashed ? '6 5' : undefined}
            pathLength="1"
            class="plotter__curve"
            data-curve-id={c.id}
          />
        {/if}
      {/each}
      {#if custom}
        <path
          d={pathOf(custom)}
          fill="none"
          stroke={CUSTOM_COLOR}
          stroke-width="2.6"
          pathLength="1"
          class="plotter__curve"
          data-curve-id="custom"
        />
      {/if}
      {#each lines as ln (ln.id)}
        <line
          x1={ln.x1}
          y1={ln.y1}
          x2={ln.x2}
          y2={ln.y2}
          stroke={ln.color}
          stroke-width="2.2"
          stroke-dasharray={ln.dashed ? '6 5' : undefined}
          class="plotter__fade"
          data-line-id={ln.id}
        />
      {/each}
      {#each secants as s (s.id)}
        <line
          {...s.line}
          stroke="#ffd166"
          stroke-width="1.6"
          stroke-dasharray="7 4"
          class="plotter__fade"
        />
        <circle cx={sx(s.x1)} cy={sy(s.y1)} r="4" fill="#ffd166" />
        <circle cx={sx(s.x2)} cy={sy(s.y2)} r="4" fill="#ffd166" />
      {/each}
      {#each tangents as tg (tg.id)}
        <line {...tg.line} stroke="#5ee6a8" stroke-width="1.8" class="plotter__fade" />
        <circle cx={sx(tg.x0)} cy={sy(tg.y0)} r="4" fill="#5ee6a8" />
      {/each}
      {#each points as p (p.id)}
        {#if p.guides}
          <line
            x1={sx(p.x)}
            y1={sy(p.y)}
            x2={sx(p.x)}
            y2={sy(Math.max(yMin, Math.min(yMax, 0)))}
            class="plotter__guide"
          />
          <line
            x1={sx(p.x)}
            y1={sy(p.y)}
            x2={sx(Math.max(xMin, Math.min(xMax, 0)))}
            y2={sy(p.y)}
            class="plotter__guide"
          />
        {/if}
        <circle cx={sx(p.x)} cy={sy(p.y)} r="4.5" class="plotter__point plotter__fade" />
      {/each}
      {#if markerReading}
        <line
          x1={sx(markerReading.x)}
          y1={pad.t}
          x2={sx(markerReading.x)}
          y2={H - pad.b}
          class="plotter__marker"
        />
        {#if markerReading.line}<line
            {...markerReading.line}
            stroke="#5ee6a8"
            stroke-width="1.8"
          />{/if}
        <circle
          cx={sx(markerReading.x)}
          cy={sy(markerReading.y)}
          r="5.5"
          fill={mainCurve?.color ?? '#fff'}
          stroke="#0b1020"
          stroke-width="1.5"
        />
      {/if}
    </g>
    <!-- labels drawn last, unclipped so that they stay readable -->
    {#each curves as c (c.id)}
      {@const at = c.label ? labelAnchor(c) : null}
      {#if at && c.label}
        {@const width = c.label.length * 7.5}
        {@const flip = at.x + 6 + width > W - pad.r}
        <text
          x={flip ? at.x - 6 : at.x + 6}
          y={Math.max(pad.t + 12, at.y - 6)}
          class="plotter__note"
          fill={c.color}
          text-anchor={flip ? 'end' : 'start'}>{c.label}</text
        >
      {/if}
    {/each}
    {#each lines as ln (ln.id)}
      {#if ln.label}
        {@const flip = ln.lx + ln.label.length * 7.5 > W - pad.r}
        <text
          x={flip ? ln.lx - 6 : ln.lx}
          y={ln.ly}
          class="plotter__note"
          fill={ln.color}
          text-anchor={flip ? 'end' : 'start'}>{ln.label}</text
        >
      {/if}
    {/each}
    {#each secants as s (s.id)}
      {@const flip = sx(s.x2) + 8 + 190 > W - pad.r}
      <text
        x={flip ? sx(s.x2) - 8 : sx(s.x2) + 8}
        y={sy(s.y2) - 8}
        class="plotter__note"
        fill="#ffd166"
        text-anchor={flip ? 'end' : 'start'}
        >{s.label ? `${s.label} · ` : ''}{t('lesson.slope')} = {fmt(s.slope)}</text
      >
    {/each}
    {#each tangents as tg (tg.id)}
      {@const flip = sx(tg.x0) + 8 + 190 > W - pad.r}
      <text
        x={flip ? sx(tg.x0) - 8 : sx(tg.x0) + 8}
        y={sy(tg.y0) + 16}
        class="plotter__note"
        fill="#5ee6a8"
        text-anchor={flip ? 'end' : 'start'}
        >{tg.label ? `${tg.label} · ` : ''}{t('lesson.slope')} = {fmt(tg.slope)}</text
      >
    {/each}
    {#each points as p (p.id)}
      {#if p.label}
        {@const flip = sx(p.x) + 8 + p.label.length * 7.5 > W - pad.r}
        <text
          x={flip ? sx(p.x) - 8 : sx(p.x) + 8}
          y={sy(p.y) - 8}
          class="plotter__note"
          text-anchor={flip ? 'end' : 'start'}>{p.label}</text
        >
      {/if}
    {/each}
    {#if markerReading}
      <text
        x={sx(markerReading.x) + 8 + 150 > W - pad.r
          ? sx(markerReading.x) - 8
          : sx(markerReading.x) + 8}
        y={pad.t + 14}
        class="plotter__note plotter__note--marker"
        text-anchor={sx(markerReading.x) + 8 + 150 > W - pad.r ? 'end' : 'start'}
      >
        {plot.view.labels.x} = {fmt(markerReading.x)} → {fmt(
          markerReading.y
        )}{#if markerReading.slope !== null}, {t('lesson.showTangent').toLowerCase()} : {fmt(
            markerReading.slope
          )}{/if}
      </text>
    {/if}
    {#if interactive}
      <!-- Captures the pointer and the arrow keys: the marker is a slider along the variable. -->
      <rect
        x={pad.l}
        y={pad.t}
        width={plotW}
        height={plotH}
        class="plotter__hit"
        role="slider"
        tabindex="0"
        aria-label={t('lesson.marker')}
        aria-valuemin={xMin}
        aria-valuemax={xMax}
        aria-valuenow={marker ?? (xMin + xMax) / 2}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointerleave={onPointerUp}
        onkeydown={onKey}
      />
    {/if}
  </svg>
  {#if customError}<p class="small" role="alert" style="margin: 0; color: var(--danger, #ff8fab)">
      {t('lesson.expressionError')}
    </p>{/if}
  {#if markerReading}
    <p class="small muted" style="margin: 0" data-testid="plotter-reading" aria-live="polite">
      {mainCurve?.label ?? ''} : {plot.view.labels.x} = {fmt(markerReading.x)}, {plot.view.labels.y} =
      {fmt(markerReading.y)}{#if markerReading.slope !== null}
        ; {t('lesson.showTangent').toLowerCase()} = {fmt(markerReading.slope)}{/if}
    </p>
  {/if}
</div>

<style>
  .plotter {
    display: grid;
    gap: var(--space-2);
  }
  .plotter__svg {
    width: 100%;
    height: auto;
    display: block;
    border-radius: var(--radius);
    background: #070b17;
    touch-action: none;
  }
  .plotter--interactive .plotter__svg {
    cursor: crosshair;
  }
  .plotter__hit {
    fill: transparent;
    cursor: crosshair;
    outline: none;
  }
  .plotter__hit:focus-visible {
    stroke: var(--focus);
    stroke-width: 2;
  }
  .plotter__area {
    fill: rgba(255, 255, 255, 0.025);
    stroke: rgba(255, 255, 255, 0.14);
  }
  .plotter__grid {
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 1;
  }
  .plotter__axis {
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1.4;
  }
  .plotter__tick {
    font-size: 11px;
    fill: #a7b0c8;
    font-family: var(--font-body);
  }
  .plotter__label {
    font-size: 12px;
    fill: #d5dcf0;
    font-family: var(--font-body);
    font-weight: 600;
  }
  .plotter__note {
    font-size: 13px;
    fill: #eef1f8;
    font-family: var(--font-body);
    font-weight: 600;
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .plotter__note--marker {
    fill: #fff;
  }
  .plotter__guide {
    stroke: #eef1f8;
    stroke-width: 1;
    stroke-dasharray: 4 4;
    opacity: 0.7;
  }
  .plotter__point {
    fill: #fff;
    stroke: #0b1020;
    stroke-width: 1.5;
  }
  .plotter__marker {
    stroke: #fff;
    stroke-width: 1;
    stroke-dasharray: 3 4;
    opacity: 0.8;
  }
  /* A new curve draws itself as the sentence that names it is read. */
  .plotter__curve {
    stroke-dasharray: 1;
    stroke-dashoffset: 0;
    animation: plotter-draw 1.4s ease-out;
  }
  .plotter__fade {
    animation: plotter-fade 0.6s ease-out;
  }
  .plotter--still .plotter__curve,
  .plotter--still .plotter__fade {
    animation: none;
  }
  @keyframes plotter-draw {
    from {
      stroke-dashoffset: 1;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
  @keyframes plotter-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .plotter__curve,
    .plotter__fade {
      animation: none;
    }
  }
</style>
