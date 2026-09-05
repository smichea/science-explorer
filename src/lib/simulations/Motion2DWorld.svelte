<script lang="ts">
  import type { Motion2dConfig } from '$lib/content-schema';
  import type { Motion2dObservables } from '$lib/domain/simulation/motion2d';
  import { t } from '$lib/state/locale.svelte';

  interface Props {
    config: Motion2dConfig;
    observables: Motion2dObservables;
    /** Clock marks along the plane (distance reached at each mark). */
    marks?: Array<{ t: number; s: number; label: string }>;
    trail?: Array<{ x: number; y: number }>;
  }
  let { config, observables, marks = [], trail = [] }: Props = $props();

  const W = 420;
  const H = 260;
  const DEG = Math.PI / 180;

  // Inclined plane geometry in SVG coordinates.
  const plane = $derived.by(() => {
    const angle = config.angle * DEG;
    const usable = W - 60;
    const length = config.length;
    const dx = Math.cos(angle) * usable;
    const dy = Math.sin(angle) * usable;
    const scale = usable / length;
    const top = { x: 30, y: Math.max(40, H - 40 - dy) };
    const bottom = { x: top.x + dx, y: top.y + dy };
    return { top, bottom, scale, angle };
  });

  function alongPlane(s: number): { x: number; y: number } {
    const k = Math.min(1, s / config.length);
    return {
      x: plane.top.x + (plane.bottom.x - plane.top.x) * k,
      y: plane.top.y + (plane.bottom.y - plane.top.y) * k,
    };
  }

  const fallScale = $derived((H - 60) / Math.max(1, config.initialHeight));
  const ball = $derived(
    config.scene === 'inclined_plane'
      ? alongPlane(observables.s)
      : {
          x: config.scene === 'projectile' ? 40 + observables.x * fallScale : W / 2,
          y: H - 30 - observables.y * fallScale,
        }
  );
</script>

<svg class="world" viewBox="0 0 {W} {H}" role="img" aria-label={t('sim.world')}>
  <defs>
    <radialGradient id="ballfill" cx="35%" cy="35%">
      <stop offset="0%" stop-color="#ffe9b0" />
      <stop offset="100%" stop-color="#c68a2b" />
    </radialGradient>
  </defs>
  {#if config.scene === 'inclined_plane'}
    <polygon
      points="{plane.top.x},{plane.top.y} {plane.bottom.x},{plane.bottom.y} {plane.bottom.x},{H -
        20} {plane.top.x},{H - 20}"
      class="world__wedge"
    />
    <line
      x1={plane.top.x}
      y1={plane.top.y}
      x2={plane.bottom.x}
      y2={plane.bottom.y}
      class="world__plane"
    />
    <text x={plane.top.x + 6} y={H - 6} class="world__text">θ = {config.angle}°</text>
    {#each marks as m (m.t)}
      {@const p = alongPlane(m.s)}
      <line x1={p.x} y1={p.y - 14} x2={p.x} y2={p.y + 6} class="world__mark" />
      <text x={p.x} y={p.y - 18} text-anchor="middle" class="world__text">{m.label}</text>
    {/each}
    <circle cx={ball.x} cy={ball.y - 9} r="9" fill="url(#ballfill)" stroke="#5a3a10" />
  {:else}
    <line x1="20" y1={H - 30} x2={W - 20} y2={H - 30} class="world__plane" />
    <line x1="30" y1={H - 30} x2="30" y2="20" class="world__axis" />
    <text x="34" y="26" class="world__text">{config.initialHeight} m</text>
    {#each trail as p, i (i)}
      <circle
        cx={config.scene === 'projectile' ? 40 + p.x * fallScale : W / 2}
        cy={H - 30 - p.y * fallScale}
        r="2"
        class="world__trail"
      />
    {/each}
    <circle cx={ball.x} cy={ball.y - 9} r="9" fill="url(#ballfill)" stroke="#5a3a10" />
  {/if}
  <text x={W - 10} y="16" text-anchor="end" class="world__readout"
    >t = {observables.t.toFixed(2)} s</text
  >
  <text x={W - 10} y="32" text-anchor="end" class="world__readout"
    >{config.scene === 'inclined_plane' ? 's' : 'h'} = {(config.scene === 'inclined_plane'
      ? observables.s
      : observables.y
    ).toFixed(2)} m</text
  >
  <text x={W - 10} y="48" text-anchor="end" class="world__readout"
    >v = {observables.v.toFixed(2)} m/s</text
  >
</svg>

<style>
  .world {
    width: 100%;
    height: auto;
    display: block;
    background: linear-gradient(180deg, #0f1730, #141c36);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    font-family: var(--font-body);
  }
  .world__wedge {
    fill: rgba(127, 156, 255, 0.12);
  }
  .world__plane {
    stroke: #c7d2ff;
    stroke-width: 3;
    stroke-linecap: round;
  }
  .world__axis {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .world__mark {
    stroke: var(--accent-2);
    stroke-width: 2;
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
  .world__trail {
    fill: rgba(255, 233, 176, 0.5);
  }
</style>
