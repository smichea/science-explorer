<script lang="ts">
  import type { CompiledLayout, Vec3 } from '$lib/content-schema';
  import type { GraphIndex } from '$lib/domain/graph';
  import {
    colorOfRegion,
    ROUTE_COLORS,
    ROUTE_DASHED,
    type NodeStyle,
    type RouteStyle,
  } from './styles';
  import { t } from '$lib/state/locale.svelte';
  import { placeLabels, shortLabel, type LabelCandidate } from './labels';
  import { LABEL_BUDGET, zoomLevelFor2d } from './zoom';

  interface Props {
    graph: GraphIndex;
    layout: CompiledLayout;
    styles: Map<string, NodeStyle>;
    routes: RouteStyle[];
    selectedId: string | null;
    focusId: string | null;
    /** Destinations framed together when no single element is focused (a leg of a flight). */
    focusIds?: string[] | null;
    labelText: (id: string, kind: 'node' | 'region' | 'world' | 'hub') => string;
    stateLabel: (id: string) => string;
    href: (id: string, kind: 'node' | 'region' | 'world') => string;
    onselect: (id: string, kind: 'node' | 'region' | 'world') => void;
  }

  let {
    graph,
    layout,
    styles,
    routes,
    selectedId,
    focusId,
    focusIds = null,
    labelText,
    stateLabel,
    href,
    onselect,
  }: Props = $props();

  const pad = 12;
  const minX = $derived(layout.bounds.min[0] - pad);
  const minZ = $derived(layout.bounds.min[2] - pad);
  const width = $derived(layout.bounds.max[0] - layout.bounds.min[0] + 2 * pad);
  const height = $derived(layout.bounds.max[2] - layout.bounds.min[2] + 2 * pad);

  let scale = $state(1);
  let tx = $state(0);
  let tz = $state(0);
  let svg: SVGSVGElement;
  let dragging: { x: number; y: number; tx: number; tz: number } | null = null;
  let pinch: { distance: number; scale: number } | null = null;
  let moved = false;
  /** The destination under the pointer or the keyboard focus: its name is always written. */
  let hoveredId = $state<string | null>(null);
  let mapWidth = $state(0);

  const viewBox = $derived(`${minX + tx} ${minZ + tz} ${width / scale} ${height / scale}`);

  function pos(id: string): [number, number] | null {
    const p = layout.positions[id];
    return p ? [p[0], p[2]] : null;
  }

  function zoomAt(factor: number, cx = 0.5, cy = 0.5) {
    // Without a pointer the zoom keeps the centre of the view, not the corner of the map.
    const next = Math.max(0.6, Math.min(8, scale * factor));
    const w0 = width / scale;
    const w1 = width / next;
    const h0 = height / scale;
    const h1 = height / next;
    tx += (w0 - w1) * cx;
    tz += (h0 - h1) * cy;
    scale = next;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = svg.getBoundingClientRect();
    zoomAt(
      e.deltaY < 0 ? 1.15 : 1 / 1.15,
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height
    );
  }

  function onPointerDown(e: PointerEvent) {
    if ((e.target as Element).closest('a')) return;
    dragging = { x: e.clientX, y: e.clientY, tx, tz };
    moved = false;
    svg.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - dragging.x) / rect.width) * (width / scale);
    const dz = ((e.clientY - dragging.y) / rect.height) * (height / scale);
    if (Math.abs(e.clientX - dragging.x) + Math.abs(e.clientY - dragging.y) > 4) moved = true;
    tx = dragging.tx - dx;
    tz = dragging.tz - dz;
  }
  function onPointerUp() {
    dragging = null;
  }
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinch = { distance: d, scale };
    }
  }
  function onTouchMove(e: TouchEvent) {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.max(0.6, Math.min(8, (pinch.scale * d) / pinch.distance));
    }
  }
  function onTouchEnd() {
    pinch = null;
  }

  function reset() {
    scale = 1;
    tx = 0;
    tz = 0;
  }

  // Centre the view on the focused element, or frame a group of destinations.
  $effect(() => {
    if (focusId) {
      const p = layout.positions[focusId] ?? layout.regions[focusId] ?? layout.worlds[focusId];
      if (!p) return;
      const target = Math.max(
        scale,
        layout.positions[focusId] ? 3 : layout.regions[focusId] ? 2 : 1.2
      );
      scale = target;
      tx = p[0] - minX - width / scale / 2;
      tz = p[2] - minZ - height / scale / 2;
      return;
    }
    const points = (focusIds ?? []).map((id) => layout.positions[id]).filter((p): p is Vec3 => !!p);
    if (points.length === 0) return;
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[2]);
    const spanX = Math.max(...xs) - Math.min(...xs) + 2 * pad;
    const spanZ = Math.max(...zs) - Math.min(...zs) + 2 * pad;
    scale = Math.max(1, Math.min(3, width / spanX, height / spanZ));
    tx = (Math.min(...xs) + Math.max(...xs)) / 2 - minX - width / scale / 2;
    tz = (Math.min(...zs) + Math.max(...zs)) / 2 - minZ - height / scale / 2;
  });

  function shapePath(type: string, r: number): string {
    switch (type) {
      case 'mathematical_tool':
        return `M0,${-r} L${r},0 L0,${r} L${-r},0 Z`;
      case 'model':
        return `M${-r * 0.8},${-r * 0.8} h${r * 1.6} v${r * 1.6} h${-r * 1.6} Z`;
      case 'law':
        return `M0,${-r} L${r * 0.95},${r * 0.7} L${-r * 0.95},${r * 0.7} Z`;
      case 'method':
        return `M0,${-r} L${r * 0.9},${r * 0.9} L${-r * 0.9},${r * 0.9} Z`;
      case 'mission':
        return `M0,${-r * 1.2} L${r * 0.35},${-r * 0.35} L${r * 1.2},0 L${r * 0.35},${r * 0.35} L0,${r * 1.2} L${-r * 0.35},${r * 0.35} L${-r * 1.2},0 L${-r * 0.35},${-r * 0.35} Z`;
      case 'phenomenon':
        return `M0,${-r} L${r * 0.87},${-r * 0.5} L${r * 0.87},${r * 0.5} L0,${r} L${-r * 0.87},${r * 0.5} L${-r * 0.87},${-r * 0.5} Z`;
      default:
        return '';
    }
  }

  const level = $derived(zoomLevelFor2d(scale));
  /** A narrow map (a phone, or a stage squeezed by the panel) carries fewer and smaller names. */
  const compact = $derived(mapWidth > 0 && mapWidth < 600);
  // The budget of the 3D atlas, widened: a flat map carries more names than floating pills.
  const budget = $derived(Math.ceil(LABEL_BUDGET[level] * 1.6 * (compact ? 0.55 : 1)));
  /** One screen pixel, in map units: a name then reads the same size on a phone and on a desk. */
  const unit = $derived(width / scale / Math.max(320, mapWidth || 960));
  const fontSize = $derived({
    world: (compact ? 17 : 26) * unit,
    hub: (compact ? 11 : 15) * unit,
    region: (compact ? 11 : 15) * unit,
    node: (compact ? 10 : 12) * unit,
  });

  const view = $derived({
    x: minX + tx,
    y: minZ + tz,
    width: width / scale,
    height: height / scale,
  });

  /**
   * The names written on the map: worlds first (always), then the regions and the destinations
   * that still find a free place, richest first. A name dropped here stays in the accessible
   * name of its link, in the list view and under the pointer.
   */
  const labels = $derived.by(() => {
    const candidates: LabelCandidate[] = [];
    for (const world of graph.graph.worlds) {
      const c = layout.worlds[world.id];
      if (c)
        candidates.push({
          id: world.id,
          kind: 'world',
          x: c[0],
          y: c[2] - 22,
          text: labelText(world.id, 'world'),
          priority: 1,
          fontSize: fontSize.world,
          anchor: 'middle',
          pinned: true,
        });
    }
    candidates.push({
      id: 'hub',
      kind: 'hub',
      x: 0,
      y: -12,
      text: labelText('hub', 'hub'),
      priority: 1,
      fontSize: fontSize.hub,
      anchor: 'middle',
    });
    for (const region of graph.graph.regions) {
      const c = layout.regions[region.id];
      const detailed = region.nodeIds.length > 0;
      // The empty regions are named once the view leaves the whole universe.
      if (!c || (!detailed && level === 'universe')) continue;
      candidates.push({
        id: region.id,
        kind: 'region',
        x: c[0],
        y: c[2] - (detailed ? 3.4 : 2.7),
        text: shortLabel(labelText(region.id, 'region'), compact ? 20 : 30),
        // The regions holding the most destinations are named first, whatever their world.
        priority: detailed ? region.nodeIds.length : 0.3,
        fontSize: fontSize.region,
        anchor: 'middle',
      });
    }
    for (const node of graph.graph.nodes) {
      const p = pos(node.id);
      const style = styles.get(node.id);
      if (!p || !style) continue;
      const pointed = node.id === hoveredId;
      // Outside the selection of the filter a destination is named only when pointed at.
      if (style.muted && !pointed && !style.selected) continue;
      const r = 0.9 + node.importance * 0.25;
      const name = shortLabel(labelText(node.id, 'node'));
      candidates.push({
        id: node.id,
        kind: 'node',
        x: p[0] + r + 0.6,
        y: p[1] + 0.5,
        text: style.glyph ? `${style.glyph} ${name}` : name,
        priority: style.labelPriority,
        fontSize: fontSize.node,
        anchor: 'start',
        pinned: style.selected || pointed,
      });
    }
    // The geography is named first, then what is left of the budget names destinations: a map
    // that shows only its regions would say nothing of what it holds.
    const geography = placeLabels(
      candidates.filter((c) => c.kind !== 'node'),
      { budget: Math.ceil(budget * 0.6), view }
    );
    const destinations = placeLabels(
      candidates.filter((c) => c.kind === 'node'),
      { budget: Math.max(1, budget - geography.length), view, occupied: geography }
    );
    return new Map([...geography, ...destinations].map((c) => [c.id, c.text]));
  });
</script>

<div class="map2d" data-testid="atlas-2d" bind:clientWidth={mapWidth}>
  <div class="map2d__tools">
    <button class="btn btn--sm btn--icon" type="button" onclick={() => zoomAt(1.3)} aria-label="+"
      >+</button
    >
    <button
      class="btn btn--sm btn--icon"
      type="button"
      onclick={() => zoomAt(1 / 1.3)}
      aria-label="−">−</button
    >
    <button class="btn btn--sm" type="button" onclick={reset}>{t('universe.reset')}</button>
  </div>
  <svg
    bind:this={svg}
    class="map2d__svg"
    {viewBox}
    role="group"
    aria-label={t('universe.view2d')}
    onwheel={onWheel}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointercancel={onPointerUp}
    ontouchstart={onTouchStart}
    ontouchmove={onTouchMove}
    ontouchend={onTouchEnd}
  >
    <defs>
      <radialGradient id="world-glow">
        <stop offset="0%" stop-color="#fff" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#fff" stop-opacity="0" />
      </radialGradient>
    </defs>
    <!-- worlds -->
    {#each graph.graph.worlds as world (world.id)}
      {@const c = layout.worlds[world.id]}
      {#if c}
        <g class="world">
          <circle cx={c[0]} cy={c[2]} r="21" fill="url(#world-glow)" />
          <circle
            cx={c[0]}
            cy={c[2]}
            r="19.5"
            fill="none"
            stroke={world.color}
            stroke-width="0.35"
            opacity="0.7"
          />
          <a
            href={href(world.id, 'world')}
            onclick={(e) => {
              e.preventDefault();
              if (!moved) onselect(world.id, 'world');
            }}
            aria-label={labelText(world.id, 'world')}
          >
            <text
              x={c[0]}
              y={c[2] - 22}
              text-anchor="middle"
              class="label label--world"
              style={`font-size: ${fontSize.world}px`}
              fill={world.color}>{labelText(world.id, 'world')}</text
            >
          </a>
        </g>
      {/if}
    {/each}
    <circle cx="0" cy="0" r="10.5" fill="none" stroke="#f7f1e3" stroke-width="0.25" opacity="0.5" />
    {#if labels.has('hub')}
      <text
        x="0"
        y="-12"
        text-anchor="middle"
        class="label label--hub"
        style={`font-size: ${fontSize.hub}px`}
        fill="#f7f1e3">{labels.get('hub')}</text
      >
    {/if}
    <!-- routes -->
    {#each routes as route (route.id)}
      {@const a = pos(route.from)}
      {@const b = pos(route.to)}
      {#if a && b}
        <line
          x1={a[0]}
          y1={a[1]}
          x2={b[0]}
          y2={b[1]}
          stroke={ROUTE_COLORS[route.kind]}
          stroke-width={0.18 + 0.25 * route.emphasis}
          stroke-opacity={0.25 + 0.7 * route.emphasis}
          stroke-dasharray={ROUTE_DASHED[route.kind] ? '0.9 0.6' : undefined}
        />
      {/if}
    {/each}
    <!-- regions -->
    {#each graph.graph.regions as region (region.id)}
      {@const c = layout.regions[region.id]}
      {#if c}
        {@const detailed = region.nodeIds.length > 0}
        <a
          href={href(region.id, 'region')}
          onclick={(e) => {
            e.preventDefault();
            if (!moved) onselect(region.id, 'region');
          }}
          aria-label={`${labelText(region.id, 'region')} — ${detailed ? t('type.region') : t('state.silhouette')}`}
        >
          <circle
            cx={c[0]}
            cy={c[2]}
            r={detailed ? 2.6 : 1.9}
            fill={colorOfRegion(region, graph)}
            fill-opacity={detailed ? 0.28 : 0.08}
            stroke={colorOfRegion(region, graph)}
            stroke-width="0.25"
            stroke-dasharray={detailed ? undefined : '0.6 0.5'}
          />
          {#if labels.has(region.id)}
            <text
              x={c[0]}
              y={c[2] - (detailed ? 3.4 : 2.7)}
              text-anchor="middle"
              class="label label--region"
              class:label--silhouette={!detailed}
              style={`font-size: ${fontSize.region}px`}
              fill={colorOfRegion(region, graph)}>{labels.get(region.id)}</text
            >
          {/if}
        </a>
      {/if}
    {/each}
    <!-- nodes -->
    {#each graph.graph.nodes as node (node.id)}
      {@const p = pos(node.id)}
      {@const style = styles.get(node.id)}
      {#if p && style}
        {@const r = 0.9 + node.importance * 0.25}
        {@const path = shapePath(node.type, r)}
        <a
          href={href(node.id, 'node')}
          onclick={(e) => {
            e.preventDefault();
            if (!moved) onselect(node.id, 'node');
          }}
          aria-label={`${labelText(node.id, 'node')} — ${stateLabel(node.id)}`}
          aria-current={node.id === selectedId ? 'true' : undefined}
          data-node-id={node.id}
          data-state={style.kind}
          onpointerenter={() => (hoveredId = node.id)}
          onpointerleave={() => hoveredId === node.id && (hoveredId = null)}
          onfocusin={() => (hoveredId = node.id)}
          onfocusout={() => hoveredId === node.id && (hoveredId = null)}
          data-muted={style.muted ? 'true' : undefined}
          class:node--muted={style.muted}
          style={`opacity: ${style.muted ? 0.6 : 0.35 + 0.65 * style.emphasis}`}
        >
          {#if style.selected}
            <circle cx={p[0]} cy={p[1]} r={r + 1.1} fill="none" stroke="#fff" stroke-width="0.3" />
          {/if}
          {#if style.kind === 'practised' || style.kind === 'mastered' || style.kind === 'discovered' || style.kind === 'in_progress' || style.kind === 'due_for_review'}
            <circle
              cx={p[0]}
              cy={p[1]}
              r={r + 0.6}
              fill="none"
              stroke={style.color}
              stroke-width={style.kind === 'discovered' ? 0.15 : 0.3}
              stroke-dasharray={style.kind === 'due_for_review' ? '0.5 0.3' : undefined}
            />
          {/if}
          <!-- Outside the selection only the outline of the shape is drawn (a faint fill keeps
               the whole shape hoverable: an unfilled shape only reacts on its stroke). -->
          {#if path}
            <path
              d={path}
              transform={`translate(${p[0]} ${p[1]})`}
              fill={style.color}
              fill-opacity={style.muted ? 0.1 : 1}
              stroke={style.muted ? style.color : '#0b1020'}
              stroke-width={style.muted ? 0.22 : 0.15}
            />
          {:else}
            <circle
              cx={p[0]}
              cy={p[1]}
              r={r * 0.9}
              fill={style.color}
              fill-opacity={style.muted ? 0.1 : 1}
              stroke={style.muted ? style.color : '#0b1020'}
              stroke-width={style.muted ? 0.22 : 0.15}
            />
          {/if}
          {#if labels.has(node.id)}
            <!-- The name is the head of the title: the whole one is in the link and in the card. -->
            <text
              x={p[0] + r + 0.6}
              y={p[1] + 0.5}
              class="label label--node"
              class:label--selected={style.selected}
              style={`font-size: ${fontSize.node}px`}
              fill="#eef1f8">{labels.get(node.id)}</text
            >
          {/if}
        </a>
      {/if}
    {/each}
  </svg>
</div>

<style>
  .map2d {
    position: relative;
    width: 100%;
    height: 100%;
    background: radial-gradient(800px 500px at 50% 40%, #131a33, #070b17 70%);
    overflow: hidden;
    touch-action: none;
  }
  .map2d__svg {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
  }
  .map2d__tools {
    position: absolute;
    right: var(--space-3);
    bottom: var(--space-3);
    display: flex;
    gap: var(--space-2);
    z-index: 2;
  }
  .label {
    font-family: var(--font-body);
    pointer-events: none;
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 0.14em;
    stroke-linejoin: round;
  }
  .label--world {
    font-size: 4px;
    font-weight: 700;
    letter-spacing: 0.15px;
    text-transform: uppercase;
  }
  .label--hub {
    font-size: 2.6px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .label--region {
    font-size: 2.1px;
    font-weight: 600;
  }
  .label--silhouette {
    opacity: 0.6;
    font-weight: 400;
  }
  .label--node {
    font-size: 1.7px;
  }
  .label--selected {
    font-weight: 700;
  }
  .node--muted:hover,
  .node--muted:focus-visible {
    opacity: 1 !important;
  }
  a:focus-visible circle,
  a:focus-visible path {
    stroke: var(--focus);
    stroke-width: 0.5;
  }
</style>
