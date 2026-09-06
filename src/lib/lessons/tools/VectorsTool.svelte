<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { curveFunction, evaluateScalar, itemVisible, type ToolState } from '$lib/domain/lesson';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { PALETTE, fmt, scales } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'vectors' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const sc = $derived(scales(tstate.view));
  /** Heads moved by the learner, in data units. */
  let dragged = $state<Record<string, [number, number]>>({});
  let dragging: string | null = null;
  let svg = $state<SVGSVGElement | null>(null);

  interface Placed {
    id: string;
    x: number;
    y: number;
    tail: [number, number];
    head: [number, number];
    color: string;
    label?: string;
    components: boolean;
    drag: boolean;
  }
  const placed = $derived.by((): Placed[] => {
    const out = new SvelteMap<string, Placed>();
    const visible = tool.vectors.filter((v) => itemVisible(v, tstate));
    const place = (id: string, depth = 0): Placed | null => {
      const done = out.get(id);
      if (done) return done;
      const v = visible.find((x) => x.id === id);
      if (!v || depth > 8) return null;
      const override = dragged[v.id];
      const x = override ? override[0] : evaluateScalar(v.x, tstate.params);
      const y = override ? override[1] : evaluateScalar(v.y, tstate.params);
      const parent = v.from ? place(v.from, depth + 1) : null;
      const tail: [number, number] = parent ? parent.head : [0, 0];
      const item: Placed = {
        id: v.id,
        x,
        y,
        tail,
        head: [tail[0] + x, tail[1] + y],
        color: v.color ?? PALETTE[tool.vectors.indexOf(v) % PALETTE.length],
        label: v.label ? L(v.label) : v.id,
        components: v.components,
        drag: v.drag,
      };
      out.set(v.id, item);
      return item;
    };
    for (const v of visible) place(v.id);
    return [...out.values()].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  });

  const paths = $derived(
    tool.paths
      .filter((p) => itemVisible(p, tstate))
      .map((p, i) => {
        const fx = curveFunction(p.x, 's', tstate.params);
        const fy = curveFunction(p.y, 's', tstate.params);
        let d = '';
        if (fx && fy) {
          const [a, b] = p.range;
          for (let k = 0; k <= 200; k++) {
            const s = a + ((b - a) * k) / 200;
            const x = fx(s);
            const y = fy(s);
            if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
            d += `${d ? 'L' : 'M'}${sc.sx(x).toFixed(1)} ${sc.sy(y).toFixed(1)} `;
          }
        }
        return {
          id: p.id,
          d,
          color: p.color ?? PALETTE[(i + 3) % PALETTE.length],
          dashed: p.dashed,
          label: p.label ? L(p.label) : undefined,
        };
      })
  );

  const sums = $derived(
    tool.sums
      .filter((s) => itemVisible(s, tstate))
      .flatMap((s) => {
        const parts = s.of.map((id) => placed.find((p) => p.id === id)).filter((p) => !!p);
        if (parts.length < 2) return [];
        const tail = parts[0].tail;
        const x = parts.reduce((acc, p) => acc + p.x, 0);
        const y = parts.reduce((acc, p) => acc + p.y, 0);
        // Dashed copies of the other parts, placed head to tail, show the construction.
        const copies: Array<{ tail: [number, number]; head: [number, number]; color: string }> = [];
        let cursor: [number, number] = tail;
        for (const p of parts) {
          const next: [number, number] = [cursor[0] + p.x, cursor[1] + p.y];
          if (p.tail[0] !== cursor[0] || p.tail[1] !== cursor[1])
            copies.push({ tail: cursor, head: next, color: p.color });
          cursor = next;
        }
        return [
          {
            id: s.id,
            tail,
            head: [tail[0] + x, tail[1] + y] as [number, number],
            x,
            y,
            color: s.color ?? '#ffffff',
            label: s.label ? L(s.label) : `${parts.map((p) => p.label).join(' + ')}`,
            copies,
          },
        ];
      })
  );

  /** Arrow head polygon at the tip of a segment (screen coordinates). */
  function arrowHead(tail: [number, number], head: [number, number]): string {
    const x1 = sc.sx(tail[0]);
    const y1 = sc.sy(tail[1]);
    const x2 = sc.sx(head[0]);
    const y2 = sc.sy(head[1]);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = 11;
    const p = (a: number, r: number) =>
      `${x2 - r * Math.cos(angle + a)},${y2 - r * Math.sin(angle + a)}`;
    return `${x2},${y2} ${p(0.4, size)} ${p(-0.4, size)}`;
  }

  function dataAt(event: PointerEvent): [number, number] | null {
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * sc.W;
    const py = ((event.clientY - rect.top) / rect.height) * sc.H;
    return [sc.fromSx(px), sc.fromSy(py)];
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
      const d = Math.hypot(sc.sx(p.head[0]) - px, sc.sy(p.head[1]) - py);
      if (d < 18 && (!best || d < best.d)) best = { id: p.id, d };
    }
    dragging = best?.id ?? null;
    if (dragging) moveTo(dragging, at);
  }
  function moveTo(id: string, at: [number, number]) {
    const p = placed.find((x) => x.id === id);
    if (!p) return;
    const snap = (v: number) => Math.round(v * 4) / 4;
    dragged = { ...dragged, [id]: [snap(at[0] - p.tail[0]), snap(at[1] - p.tail[1])] };
  }
  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    const at = dataAt(event);
    if (at) moveTo(dragging, at);
  }
  function onPointerUp() {
    dragging = null;
  }
  $effect(() => {
    if (!interactive) dragged = {};
  });
  const norm = (p: { x: number; y: number }) => Math.hypot(p.x, p.y);
</script>

<div class="tool stack-sm">
  <svg
    bind:this={svg}
    viewBox="0 0 {sc.W} {sc.H}"
    class="tool__svg"
    class:tool__svg--drag={interactive && placed.some((p) => p.drag)}
    role="img"
    aria-label={t('lesson.tool.vectors')}
    data-testid="vectors-tool"
    data-vectors={placed.length}
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
    {#each paths as p (p.id)}
      <path
        d={p.d}
        fill="none"
        stroke={p.color}
        stroke-width="2"
        stroke-dasharray={p.dashed ? '6 5' : undefined}
        opacity="0.85"
      />
    {/each}
    {#each sums as s (s.id)}
      {#each s.copies as c, i (i)}
        <line
          x1={sc.sx(c.tail[0])}
          y1={sc.sy(c.tail[1])}
          x2={sc.sx(c.head[0])}
          y2={sc.sy(c.head[1])}
          stroke={c.color}
          stroke-width="1.5"
          stroke-dasharray="5 4"
          opacity="0.7"
        />
      {/each}
      <line
        x1={sc.sx(s.tail[0])}
        y1={sc.sy(s.tail[1])}
        x2={sc.sx(s.head[0])}
        y2={sc.sy(s.head[1])}
        stroke={s.color}
        stroke-width="3"
      />
      <polygon points={arrowHead(s.tail, s.head)} fill={s.color} />
      <text x={sc.sx(s.head[0]) + 8} y={sc.sy(s.head[1]) - 8} class="note" fill={s.color}
        >{s.label} ({fmt(s.x, locale.current)} ; {fmt(s.y, locale.current)})</text
      >
    {/each}
    {#each placed as p (p.id)}
      {#if p.components}
        <line
          x1={sc.sx(p.tail[0])}
          y1={sc.sy(p.tail[1])}
          x2={sc.sx(p.head[0])}
          y2={sc.sy(p.tail[1])}
          class="guide"
        />
        <line
          x1={sc.sx(p.head[0])}
          y1={sc.sy(p.tail[1])}
          x2={sc.sx(p.head[0])}
          y2={sc.sy(p.head[1])}
          class="guide"
        />
        <text
          x={(sc.sx(p.tail[0]) + sc.sx(p.head[0])) / 2}
          y={sc.sy(p.tail[1]) + 14}
          class="note note--small"
          text-anchor="middle">{fmt(p.x, locale.current)}</text
        >
        <text
          x={sc.sx(p.head[0]) + 6}
          y={(sc.sy(p.tail[1]) + sc.sy(p.head[1])) / 2}
          class="note note--small">{fmt(p.y, locale.current)}</text
        >
      {/if}
      <line
        x1={sc.sx(p.tail[0])}
        y1={sc.sy(p.tail[1])}
        x2={sc.sx(p.head[0])}
        y2={sc.sy(p.head[1])}
        stroke={p.color}
        stroke-width="3"
        class="fade"
      />
      <polygon points={arrowHead(p.tail, p.head)} fill={p.color} class="fade" />
      {#if p.drag && interactive}
        <circle cx={sc.sx(p.head[0])} cy={sc.sy(p.head[1])} r="9" fill={p.color} opacity="0.25" />
      {/if}
      <text x={sc.sx(p.head[0]) + 8} y={sc.sy(p.head[1]) - 8} class="note" fill={p.color}
        >{p.label}</text
      >
    {/each}
  </svg>
  <ul class="readout small muted" aria-live="polite" data-testid="vectors-readout">
    {#each placed as p (p.id)}
      <li>
        <strong style="color: {p.color}">{p.label}</strong> = ({fmt(p.x, locale.current)} ; {fmt(
          p.y,
          locale.current
        )}), {t('lesson.vectors.norm')}
        {fmt(norm(p), locale.current)}
      </li>
    {/each}
    {#each sums as s (s.id)}
      <li>
        <strong>{s.label}</strong> = ({fmt(s.x, locale.current)} ; {fmt(s.y, locale.current)}), {t(
          'lesson.vectors.norm'
        )}
        {fmt(norm(s), locale.current)}
      </li>
    {/each}
  </ul>
  {#if interactive && placed.some((p) => p.drag)}<p class="small muted" style="margin: 0">
      {t('lesson.vectors.dragHint')}
    </p>{/if}
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
    stroke: #eef1f8;
    stroke-width: 1;
    stroke-dasharray: 4 4;
    opacity: 0.6;
  }
  .readout {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.15rem;
  }
  .fade {
    animation: fade 0.5s ease-out;
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
