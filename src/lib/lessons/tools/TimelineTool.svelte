<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { itemVisible, type ToolState } from '$lib/domain/lesson';
  import { SvelteMap } from 'svelte/reactivity';
  import { L, t } from '$lib/state/locale.svelte';

  type Tool = Extract<LessonTool, { kind: 'timeline' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const W = 560;
  const H = 300;
  const pad = { l: 24, r: 24, t: 28, b: 40 };
  const LANES: Array<'context' | 'place' | 'life' | 'work'> = ['context', 'place', 'life', 'work'];
  const laneY = (kind: string) => pad.t + 30 + LANES.indexOf(kind as (typeof LANES)[number]) * 56;
  const sx = (year: number) =>
    pad.l + ((year - tool.from) / (tool.to - tool.from)) * (W - pad.l - pad.r);
  const fromSx = (px: number) =>
    tool.from + ((px - pad.l) / (W - pad.l - pad.r)) * (tool.to - tool.from);
  let cursor = $state<number | null>(null);
  const year = $derived(cursor ?? tool.cursor ?? tool.from);
  const events = $derived(
    tool.events
      .filter((e) => itemVisible(e, tstate))
      .map((e) => ({
        id: e.id,
        start: e.start ?? e.year ?? tool.from,
        end: e.end ?? e.year ?? tool.from,
        point: e.year !== undefined,
        label: L(e.label),
        kind: e.kind,
      }))
  );
  const current = $derived(events.filter((e) => e.start <= year && year <= e.end));
  /** Labels of one lane alternate above and below its line so that neighbours do not collide. */
  const staggered = $derived.by(() => {
    // Labels of one lane climb through three levels when neighbours are close, so that a dense
    // decade stays readable; a label near an edge is anchored inwards.
    const LEVELS = [-11, 24, 37];
    const last = new SvelteMap<string, { x: number; level: number }>();
    return [...events]
      .sort((a, b) => a.start - b.start)
      .map((e) => {
        const x = sx(e.start);
        const previous = last.get(e.kind);
        const level = previous && x - previous.x < 130 ? (previous.level + 1) % LEVELS.length : 0;
        last.set(e.kind, { x, level });
        const anchor = !e.point ? 'start' : x < 110 ? 'start' : x > W - 110 ? 'end' : 'middle';
        return { ...e, dy: LEVELS[level], anchor };
      });
  });
  const decades = $derived.by(() => {
    const out: number[] = [];
    const step = tool.to - tool.from > 200 ? 50 : 10;
    for (let y = Math.ceil(tool.from / step) * step; y <= tool.to; y += step) out.push(y);
    return out;
  });
  let svg = $state<SVGSVGElement | null>(null);
  let dragging = false;
  function yearAt(event: PointerEvent): number | null {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    return Math.round(Math.max(tool.from, Math.min(tool.to, fromSx(px))));
  }
  function onPointerDown(event: PointerEvent) {
    if (!interactive) return;
    dragging = true;
    const y = yearAt(event);
    if (y !== null) cursor = y;
  }
  function onPointerMove(event: PointerEvent) {
    if (!interactive || !dragging) return;
    const y = yearAt(event);
    if (y !== null) cursor = y;
  }
  function onPointerUp() {
    dragging = false;
  }
  const KIND_COLOR: Record<string, string> = {
    life: '#ffd166',
    work: '#7f9cff',
    context: '#a7b0c8',
    place: '#5ee6a8',
  };
</script>

<div class="tool stack-sm">
  <svg
    bind:this={svg}
    viewBox="0 0 {W} {H}"
    class="tool__svg"
    class:tool__svg--pick={interactive}
    role="img"
    aria-label="{t('lesson.tool.timeline')} {tool.from}–{tool.to}"
    data-testid="timeline-tool"
    data-events={events.length}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
  >
    <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} class="axis" />
    {#each decades as d (d)}
      <line x1={sx(d)} y1={H - pad.b - 4} x2={sx(d)} y2={H - pad.b + 4} class="axis" />
      <text x={sx(d)} y={H - pad.b + 18} class="tick" text-anchor="middle">{d}</text>
    {/each}
    {#each LANES as lane (lane)}
      <text x={pad.l} y={laneY(lane) - 16} class="lane">{t(`lesson.timeline.${lane}`)}</text>
    {/each}
    {#each staggered as e (e.id)}
      {#if e.point}
        <circle cx={sx(e.start)} cy={laneY(e.kind)} r="6" fill={KIND_COLOR[e.kind]} class="fade" />
        <text x={sx(e.start)} y={laneY(e.kind) + e.dy} class="note" text-anchor="middle"
          >{e.label} ({e.start})</text
        >
      {:else}
        <rect
          x={sx(e.start)}
          y={laneY(e.kind) - 7}
          width={Math.max(4, sx(e.end) - sx(e.start))}
          height="14"
          rx="4"
          fill={KIND_COLOR[e.kind]}
          opacity="0.75"
          class="fade"
        />
        <text x={sx(e.start)} y={laneY(e.kind) + e.dy} class="note"
          >{e.label} ({e.start}–{e.end})</text
        >
      {/if}
    {/each}
    <line x1={sx(year)} y1={pad.t} x2={sx(year)} y2={H - pad.b} class="cursor" />
    <text x={sx(year)} y={pad.t - 8} class="note note--cursor" text-anchor="middle">{year}</text>
  </svg>
  <p class="small muted" style="margin: 0" data-testid="timeline-current" aria-live="polite">
    <strong>{year}</strong> — {current.length
      ? current.map((e) => e.label).join(' · ')
      : t('lesson.timeline.nothing')}
  </p>
  {#if interactive}<p class="small muted" style="margin: 0">{t('lesson.timeline.dragHint')}</p>{/if}
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
    cursor: ew-resize;
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
  .lane {
    font-size: 10px;
    fill: #a7b0c8;
    font-family: var(--font-body);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .note {
    font-size: 10.5px;
    fill: #eef1f8;
    font-family: var(--font-body);
    font-weight: 600;
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .note--cursor {
    fill: #fff;
    font-size: 13px;
  }
  .cursor {
    stroke: #fff;
    stroke-width: 1.5;
    stroke-dasharray: 4 4;
  }
  .fade {
    animation: fade 0.6s ease-out;
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
