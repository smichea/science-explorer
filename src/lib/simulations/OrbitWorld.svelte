<script lang="ts">
  import type { CentralForceConfig } from '$lib/content-schema';
  import { t } from '$lib/state/locale.svelte';

  interface Props {
    config: CentralForceConfig;
    /** Whatever the view holds at this instant: the position, the speed and the radius. */
    observables: { x: number; y: number; v: number; r?: number };
    /** The whole orbit, in metres, precomputed by the view. */
    path?: Array<[number, number]>;
    currentT?: number;
  }
  let { config, observables, path = [], currentT = 0 }: Props = $props();

  const W = 420;
  const H = 320;
  const MARGIN = 18;

  /** The whole orbit is framed at once, so the ellipse never drifts out of the picture. */
  const scale = $derived.by(() => {
    const reach = path.reduce((acc, [x, y]) => Math.max(acc, Math.abs(x), Math.abs(y)), config.r0);
    return Math.min(W / 2 - MARGIN, H / 2 - MARGIN) / Math.max(1, reach);
  });
  const sx = (x: number) => W / 2 + x * scale;
  const sy = (y: number) => H / 2 - y * scale;

  const orbitPath = $derived(
    path.length < 2
      ? ''
      : path.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ')
  );
  const body = $derived({ x: sx(observables.x), y: sy(observables.y) });
  const centre = $derived(Math.max(3, config.centralRadius * scale));

  /**
   * Two sectors swept in the same time, one where the body runs fastest and one where it crawls:
   * drawn side by side they are the second law, since their areas are equal.
   */
  const sectors = $derived.by(() => {
    if (path.length < 24) return [] as string[];
    const span = Math.max(2, Math.floor(path.length / 12));
    const wedge = (start: number) => {
      const arc = path.slice(start, start + span + 1);
      if (arc.length < 2) return '';
      const head = `M${sx(0).toFixed(1)} ${sy(0).toFixed(1)} `;
      return (
        head + arc.map(([x, y]) => `L${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ') + ' Z'
      );
    };
    // The nearest and the farthest points of the sampled orbit: the perigee and the apogee.
    const distances = path.map(([x, y]) => Math.hypot(x, y));
    const near = distances.indexOf(Math.min(...distances));
    const far = distances.indexOf(Math.max(...distances));
    return [wedge(near), wedge(Math.min(far, path.length - span - 1))].filter(Boolean);
  });
</script>

<svg class="world" viewBox="0 0 {W} {H}" role="img" aria-label={t('sim.world')}>
  <defs>
    <radialGradient id="orbitcentre" cx="35%" cy="35%">
      <stop offset="0%" stop-color="#9fd0ff" />
      <stop offset="100%" stop-color="#2b5ea8" />
    </radialGradient>
    <radialGradient id="orbitbody" cx="35%" cy="35%">
      <stop offset="0%" stop-color="#ffe9b0" />
      <stop offset="100%" stop-color="#c68a2b" />
    </radialGradient>
  </defs>

  {#each sectors as sector, i (i)}
    <path class="world__sector" d={sector} />
  {/each}

  {#if orbitPath}
    <path class="world__orbit" d={orbitPath} />
  {/if}

  <line class="world__radius" x1={sx(0)} y1={sy(0)} x2={body.x} y2={body.y} />
  <circle cx={sx(0)} cy={sy(0)} r={centre} fill="url(#orbitcentre)" />
  <circle cx={body.x} cy={body.y} r="6" fill="url(#orbitbody)" data-testid="orbit-body" />

  <text class="world__readout" x={12} y={20}>
    r = {((observables.r ?? 0) / 1000).toFixed(0)} km · v = {observables.v.toFixed(0)} m/s
  </text>
  <text class="world__text" x={12} y={H - 12}>
    t = {currentT.toFixed(0)} s
  </text>
</svg>

<style>
  .world {
    width: 100%;
    height: auto;
    display: block;
    background: radial-gradient(circle at 50% 45%, #101a34, #080c18);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    font-family: var(--font-body);
  }
  .world__orbit {
    fill: none;
    stroke: #7f9cff;
    stroke-width: 1.5;
    opacity: 0.8;
  }
  .world__sector {
    fill: rgba(255, 209, 102, 0.28);
    stroke: none;
  }
  .world__radius {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .world__text {
    fill: var(--muted);
    font-size: 11px;
  }
  .world__readout {
    fill: var(--text);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }
</style>
