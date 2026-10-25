<script lang="ts">
  import type { ReductionGraph, ReductionEdge } from '$lib/domain/lambda';
  import { reductionPositions, type LambdaPoint3 } from '$lib/domain/lambdaDiagram';
  import { locale } from '$lib/state/locale.svelte';
  import { lambdaText } from '../lambdaText';
  let {
    graph,
    selected = 0,
    traversed = [],
    motion = null,
    onselect,
    onfollow,
  }: {
    graph: ReductionGraph;
    selected?: number;
    traversed?: number[];
    motion?: { edge: number; progress: number } | null;
    onselect: (id: number) => void;
    onfollow: (edge: ReductionEdge) => void;
  } = $props();
  const text = $derived(lambdaText(locale.current));
  const uid = $props.id();
  let azimuth = $state(0.6);
  let elevation = $state(0.8);
  let zoom = $state(1);
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const positions = $derived(reductionPositions(graph));
  const extent = $derived(Math.max(5, ...[...positions.values()].map((p) => Math.hypot(...p))));
  const bends = $derived.by(() => {
    const groups: Record<string, number[]> = {};
    for (const edge of graph.edges) {
      const key = `${edge.from}:${edge.to}`;
      (groups[key] ??= []).push(edge.id);
    }
    const offsets: Record<number, number> = {};
    for (const ids of Object.values(groups))
      ids.forEach((id, i) => (offsets[id] = (i - (ids.length - 1) / 2) * 1.7));
    return offsets;
  });
  function project(p: LambdaPoint3) {
    const x = Math.cos(azimuth) * p[0] - Math.sin(azimuth) * p[2];
    const z = Math.sin(azimuth) * p[0] + Math.cos(azimuth) * p[2];
    const y = Math.cos(elevation) * p[1] - Math.sin(elevation) * z;
    const depth = Math.sin(elevation) * p[1] + Math.cos(elevation) * z;
    const perspective = (extent * 3) / (extent * 3 - depth);
    const scale = (165 / extent) * zoom * perspective;
    return {
      x: 330 + x * scale,
      y: 215 - y * scale,
      depth,
      radius: Math.max(8, 11 * perspective * Math.sqrt(zoom)),
    };
  }
  function edgePoint(edge: ReductionEdge, t: number): LambdaPoint3 {
    const from = positions.get(edge.from)!;
    const to = positions.get(edge.to)!;
    if (edge.from === edge.to) {
      const angle = t * Math.PI * 2;
      return [
        from[0] + 1.15 * (1 - Math.cos(angle)),
        from[1] + 1.15 * Math.sin(angle),
        from[2] + 0.3 * Math.sin(angle),
      ];
    }
    const offset = bends[edge.id] ?? 0;
    const wave = Math.sin(Math.PI * t) * offset;
    return [
      from[0] + (to[0] - from[0]) * t + wave,
      from[1] + (to[1] - from[1]) * t + wave * 0.3,
      from[2] + (to[2] - from[2]) * t - wave * 0.5,
    ];
  }
  const drawnEdges = $derived(
    graph.edges.map((edge) => {
      const points = Array.from({ length: 30 }, (_, i) =>
        project(edgePoint(edge, 0.055 + (i / 29) * 0.89))
      );
      return {
        edge,
        path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
        selected: traversed.includes(edge.id),
        loop: edge.from === edge.to,
      };
    })
  );
  const drawnNodes = $derived(
    graph.nodes
      .map((node) => ({ node, point: project(positions.get(node.id)!) }))
      .sort((a, b) => a.point.depth - b.point.depth)
  );
  const pulse = $derived(
    motion && graph.edges[motion.edge]
      ? project(edgePoint(graph.edges[motion.edge], motion.progress))
      : null
  );
  function reset() {
    azimuth = 0.6;
    elevation = 0.8;
    zoom = 1;
  }
  function key(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', 'Home'].includes(event.key))
      return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') azimuth -= 0.12;
    if (event.key === 'ArrowRight') azimuth += 0.12;
    if (event.key === 'ArrowUp') elevation = Math.min(1.4, elevation + 0.1);
    if (event.key === 'ArrowDown') elevation = Math.max(-1.4, elevation - 0.1);
    if (event.key === '+') zoom = Math.min(2.5, zoom + 0.1);
    if (event.key === '-') zoom = Math.max(0.5, zoom - 0.1);
    if (event.key === 'Home') reset();
  }
</script>

<div class="graph-view stack-sm">
  <!-- The spatial viewport has keyboard camera controls; every node is also a keyboard button and available in the adjacent HTML selector. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <svg
    viewBox="0 0 660 440"
    role="application"
    tabindex="0"
    aria-label={text.graph}
    data-testid="lambda-graph-3d"
    data-azimuth={azimuth.toFixed(3)}
    onkeydown={key}
    onpointerdown={(e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    }}
    onpointermove={(e) => {
      if (!dragging) return;
      azimuth += (e.clientX - lastX) * 0.008;
      elevation = Math.max(-1.4, Math.min(1.4, elevation + (e.clientY - lastY) * 0.008));
      lastX = e.clientX;
      lastY = e.clientY;
    }}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
    onwheel={(e) => {
      e.preventDefault();
      zoom = Math.max(0.5, Math.min(2.5, zoom * Math.exp(-e.deltaY * 0.001)));
    }}
  >
    <title>{text.graph}</title>
    <defs>
      {#each ['#8ca4b9', '#ffd083', '#dca1f8'] as color, i (color)}<marker
          id={`${uid}-arrow-${i}`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill={color} /></marker
        >{/each}
      <radialGradient id={`${uid}-background`}
        ><stop offset="0" stop-color="#1e354b" /><stop
          offset="1"
          stop-color="#0c1727"
        /></radialGradient
      >
    </defs>
    <rect width="660" height="440" rx="14" fill={`url(#${uid}-background)`} />
    {#each drawnEdges as item (item.edge.id)}
      <g
        role="button"
        tabindex="0"
        aria-label={`${text.follow} ${item.edge.from} → ${item.edge.to}, β${item.edge.id + 1}`}
        data-testid="lambda-spatial-edge"
        onpointerdown={(event) => event.stopPropagation()}
        onclick={() => onfollow(item.edge)}
        onkeydown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onfollow(item.edge);
          }
        }}
      >
        <path d={item.path} fill="none" stroke="transparent" stroke-width="14" />
        <path
          d={item.path}
          fill="none"
          stroke={item.selected ? '#ffd083' : item.loop ? '#dca1f8' : '#8ca4b9'}
          stroke-width={item.selected ? 3 : 1.6}
          marker-end={`url(#${uid}-arrow-${item.selected ? 1 : item.loop ? 2 : 0})`}
          opacity={item.selected ? 1 : 0.75}
          data-testid="lambda-graph-edge"
          data-from={item.edge.from}
          data-to={item.edge.to}
        />
      </g>
    {/each}
    {#each drawnNodes as { node, point } (node.id)}
      <g
        role="button"
        tabindex="0"
        aria-label={`${node.id} — ${text.size} ${node.size}${node.normal ? ` — ${text.normalNode}` : node.frontier ? ` — ${text.frontier}` : ''}`}
        aria-pressed={node.id === selected}
        data-testid="lambda-graph-node"
        data-node={node.id}
        onpointerdown={(e) => e.stopPropagation()}
        onclick={() => onselect(node.id)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onselect(node.id);
          }
        }}
      >
        {#if node.id === selected}<circle
            cx={point.x}
            cy={point.y}
            r={point.radius + 6}
            fill="none"
            stroke="#fff0cb"
            stroke-width="2"
          />{/if}
        <circle
          cx={point.x}
          cy={point.y}
          r={point.radius}
          fill={node.normal ? '#74ddcf' : node.id === 0 ? '#a8c8ff' : '#d8ab62'}
          stroke="#e8efff"
          stroke-width="1.7"
          stroke-dasharray={node.frontier ? '3 3' : undefined}
        />
        <text
          x={point.x}
          y={point.y + 4}
          text-anchor="middle"
          font-size="11"
          font-weight="700"
          fill="#0b1728">{node.id}</text
        >
        <text
          x={point.x}
          y={point.y + point.radius + 16}
          text-anchor="middle"
          fill="#dbe8f5"
          font-size="11">{node.normal ? '✓ ' : ''}|M| = {node.size}</text
        >
      </g>
    {/each}
    {#if pulse}<circle
        cx={pulse.x}
        cy={pulse.y}
        r="6"
        fill="#fff7c7"
        stroke="#ffd083"
        stroke-width="4"
      />{/if}
  </svg>
  <div class="cluster">
    <button class="btn btn--sm" onclick={reset}>{text.camera}</button><label
      >{text.zoom} <input type="range" min="0.5" max="2.5" step="0.1" bind:value={zoom} /></label
    >
  </div>
  <p class="small muted">{text.rotate}</p>
  <p class="small muted">{text.axes}</p>
</div>

<style>
  svg {
    width: 100%;
    height: auto;
    min-height: 240px;
    max-height: 480px;
    touch-action: none;
    cursor: grab;
    border-radius: 14px;
  }
  svg:active {
    cursor: grabbing;
  }
  svg:focus-visible {
    outline: 2px solid #d8ab62;
  }
  g[role='button'] {
    cursor: pointer;
    outline: none;
  }
  g[role='button']:focus-visible circle {
    stroke: white;
    stroke-width: 4;
  }
  g[role='button']:focus-visible path:last-child,
  g[role='button']:hover path:last-child {
    stroke: #ff94cf;
    stroke-width: 3;
  }
  p {
    margin: 0;
  }
</style>
