<script lang="ts">
  /** Responsive SVG time graph: series of (t, value) points, a current-time marker and an optional tangent. */
  interface Series {
    name: string;
    color: string;
    points: Array<[number, number]>;
    dashed?: boolean;
  }
  interface Props {
    series: Series[];
    currentT?: number;
    xLabel: string;
    yLabel: string;
    tangent?: { t0: number; q0: number; slope: number } | null;
    marks?: Array<{ t: number; label?: string }>;
    height?: number;
    title?: string;
  }
  let {
    series,
    currentT = 0,
    xLabel,
    yLabel,
    tangent = null,
    marks = [],
    height = 240,
    title = '',
  }: Props = $props();

  const W = 420;
  const H = $derived(height);
  const pad = { l: 52, r: 14, t: 18, b: 34 };

  const extent = $derived.by(() => {
    let xMax = 1;
    let yMin = 0;
    let yMax = 1;
    for (const s of series) {
      for (const [x, y] of s.points) {
        xMax = Math.max(xMax, x);
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
    }
    if (yMax === yMin) yMax = yMin + 1;
    const span = yMax - yMin;
    return { xMin: 0, xMax, yMin: yMin < 0 ? yMin - span * 0.05 : 0, yMax: yMax + span * 0.08 };
  });

  const sx = (x: number) =>
    pad.l + ((x - extent.xMin) / (extent.xMax - extent.xMin)) * (W - pad.l - pad.r);
  const sy = (y: number) =>
    H - pad.b - ((y - extent.yMin) / (extent.yMax - extent.yMin)) * (H - pad.t - pad.b);

  function niceTicks(min: number, max: number, count = 5): number[] {
    const span = max - min;
    if (span <= 0) return [min];
    const rough = span / count;
    const pow = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / pow;
    const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * pow;
    const ticks: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step)
      ticks.push(Number(v.toFixed(10)));
    return ticks;
  }
  const xTicks = $derived(niceTicks(extent.xMin, extent.xMax));
  const yTicks = $derived(niceTicks(extent.yMin, extent.yMax));

  function path(points: Array<[number, number]>): string {
    if (points.length === 0) return '';
    return points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`)
      .join(' ');
  }
  function fmt(v: number): string {
    return Math.abs(v) >= 100
      ? v.toFixed(0)
      : Math.abs(v) >= 10
        ? v.toFixed(1)
        : v.toFixed(2).replace(/\.?0+$/, '');
  }
  const tangentLine = $derived.by(() => {
    if (!tangent) return null;
    const dt = (extent.xMax - extent.xMin) * 0.25;
    return {
      x1: tangent.t0 - dt,
      y1: tangent.q0 - tangent.slope * dt,
      x2: tangent.t0 + dt,
      y2: tangent.q0 + tangent.slope * dt,
    };
  });
</script>

<svg class="graph" viewBox="0 0 {W} {H}" role="img" aria-label={title || `${yLabel} / ${xLabel}`}>
  {#if title}<text x={W / 2} y="12" text-anchor="middle" class="graph__title">{title}</text>{/if}
  <g class="graph__grid">
    {#each yTicks as tick (tick)}
      <line x1={pad.l} x2={W - pad.r} y1={sy(tick)} y2={sy(tick)} />
      <text x={pad.l - 6} y={sy(tick) + 4} text-anchor="end">{fmt(tick)}</text>
    {/each}
    {#each xTicks as tick (tick)}
      <line y1={pad.t} y2={H - pad.b} x1={sx(tick)} x2={sx(tick)} />
      <text x={sx(tick)} y={H - pad.b + 14} text-anchor="middle">{fmt(tick)}</text>
    {/each}
  </g>
  <line class="graph__axis" x1={pad.l} x2={W - pad.r} y1={sy(0)} y2={sy(0)} />
  <line class="graph__axis" x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} />
  <text x={W - pad.r} y={H - 4} text-anchor="end" class="graph__label">{xLabel}</text>
  <text x={pad.l - 40} y={pad.t - 4} class="graph__label">{yLabel}</text>
  {#each marks as m (m.t)}
    <line class="graph__mark" x1={sx(m.t)} x2={sx(m.t)} y1={pad.t} y2={H - pad.b} />
    {#if m.label}<text x={sx(m.t) + 3} y={pad.t + 10} class="graph__marklabel">{m.label}</text>{/if}
  {/each}
  {#each series as s (s.name)}
    <path
      d={path(s.points)}
      fill="none"
      stroke={s.color}
      stroke-width="2.2"
      stroke-dasharray={s.dashed ? '6 4' : undefined}
    />
  {/each}
  {#if tangentLine}
    <line
      x1={sx(tangentLine.x1)}
      y1={sy(tangentLine.y1)}
      x2={sx(tangentLine.x2)}
      y2={sy(tangentLine.y2)}
      class="graph__tangent"
    />
    <circle cx={sx(tangent!.t0)} cy={sy(tangent!.q0)} r="4" class="graph__tangentdot" />
  {/if}
  {#if currentT > 0}
    <line
      class="graph__cursor"
      x1={sx(Math.min(currentT, extent.xMax))}
      x2={sx(Math.min(currentT, extent.xMax))}
      y1={pad.t}
      y2={H - pad.b}
    />
  {/if}
  <g class="graph__legend">
    {#each series as s, i (s.name)}
      <rect x={pad.l + 4 + i * 110} y={pad.t + 2} width="14" height="3" fill={s.color} />
      <text x={pad.l + 22 + i * 110} y={pad.t + 7}>{s.name}</text>
    {/each}
  </g>
</svg>

<style>
  .graph {
    width: 100%;
    height: auto;
    display: block;
    background: var(--bg-elev);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    font-family: var(--font-body);
  }
  .graph__grid line {
    stroke: var(--border);
    stroke-width: 1;
  }
  .graph__grid text,
  .graph__label,
  .graph__legend text,
  .graph__marklabel {
    fill: var(--muted);
    font-size: 10px;
  }
  .graph__title {
    fill: var(--text);
    font-size: 11px;
    font-weight: 600;
  }
  .graph__axis {
    stroke: var(--muted);
    stroke-width: 1.2;
  }
  .graph__cursor {
    stroke: var(--focus);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .graph__mark {
    stroke: var(--accent-2);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }
  .graph__tangent {
    stroke: #ff8fab;
    stroke-width: 2;
  }
  .graph__tangentdot {
    fill: #ff8fab;
  }
</style>
