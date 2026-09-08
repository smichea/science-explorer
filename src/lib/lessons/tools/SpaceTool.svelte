<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { evaluateScalar, itemVisible, type ToolState } from '$lib/domain/lesson';
  import {
    angleBetween,
    cross,
    distancePointPlane,
    dot3,
    lineClipBox,
    norm3,
    planeOfPoints,
    planeThrough,
    type Plane,
    type Vec3,
  } from '$lib/domain/lessonTools';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { fmt, PALETTE } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'space' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const W = 560;
  const H = 400;
  const RAD = Math.PI / 180;

  /**
   * The figure is turned rather than dragged: a click gives two screen coordinates and a point of
   * space needs three, so no drag can place one. Turning around the figure is what makes a
   * drawing of space readable anyway — the depth appears in the motion.
   */
  let azimuth = $state(38);
  let elevation = $state(24);
  let turning = false;
  let lastX = 0;
  let lastY = 0;
  $effect(() => {
    if (!interactive) {
      azimuth = 38;
      elevation = 24;
    }
  });

  const camera = $derived.by((): Vec3 => {
    const a = azimuth * RAD;
    const e = elevation * RAD;
    return [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
  });
  /** Orthographic projection: the azimuth turns the figure, the elevation tips it. */
  function project(p: Vec3): [number, number] {
    const a = azimuth * RAD;
    const e = elevation * RAD;
    const px = -p[0] * Math.sin(a) + p[1] * Math.cos(a);
    const py = p[2] * Math.cos(e) - (p[0] * Math.cos(a) + p[1] * Math.sin(a)) * Math.sin(e);
    return [px, py];
  }
  const scale = $derived(Math.min(W, H) / (2 * tool.extent * 1.9));
  const sx = (p: Vec3) => W / 2 + project(p)[0] * scale;
  const sy = (p: Vec3) => H / 2 - project(p)[1] * scale;
  const depth = (p: Vec3) => dot3(p, camera);

  const params = $derived(tstate.params);
  const at = (v: number | string) => evaluateScalar(v, params);

  const points = $derived(
    tool.points
      .filter((p) => itemVisible(p, tstate))
      .map((p, i) => ({
        id: p.id,
        v: [at(p.x), at(p.y), at(p.z)] as Vec3,
        label: p.label ? L(p.label) : p.id.toUpperCase(),
        color: p.color ?? PALETTE[i % PALETTE.length],
      }))
      .filter((p) => p.v.every(Number.isFinite))
  );
  const pointOf = (id: string | undefined) => points.find((p) => p.id === id);

  const vectors = $derived(
    tool.vectors
      .filter((v) => itemVisible(v, tstate))
      .map((v, i) => {
        const tail = pointOf(v.from)?.v ?? ([0, 0, 0] as Vec3);
        const value: Vec3 = [at(v.x), at(v.y), at(v.z)];
        return {
          id: v.id,
          value,
          tail,
          head: [tail[0] + value[0], tail[1] + value[1], tail[2] + value[2]] as Vec3,
          label: v.label ? L(v.label) : v.id,
          color: v.color ?? PALETTE[(i + 2) % PALETTE.length],
        };
      })
      .filter((v) => v.value.every(Number.isFinite))
  );
  const vectorOf = (id: string | undefined) => vectors.find((v) => v.id === id);

  const lines = $derived(
    tool.lines
      .filter((l) => itemVisible(l, tstate))
      .flatMap((l, i) => {
        const through = pointOf(l.through)?.v;
        const direction = vectorOf(l.direction)?.value;
        if (!through || !direction) return [];
        const clipped = lineClipBox(through, direction, tool.extent);
        if (!clipped) return [];
        return [
          {
            id: l.id,
            from: clipped[0],
            to: clipped[1],
            label: l.label ? L(l.label) : l.id,
            color: l.color ?? PALETTE[(i + 4) % PALETTE.length],
          },
        ];
      })
  );

  /** A plane is drawn as the square of its own directions, centred on the point it passes by. */
  const planes = $derived(
    tool.planes
      .filter((pl) => itemVisible(pl, tstate))
      .flatMap((pl, i) => {
        const trio = pl.of?.map((id) => pointOf(id)?.v);
        const equation: Plane | null =
          trio && trio.length === 3 && trio.every(Boolean)
            ? planeOfPoints(trio[0] as Vec3, trio[1] as Vec3, trio[2] as Vec3)
            : (() => {
                const origin = pointOf(pl.through)?.v;
                const normal = vectorOf(pl.normal)?.value;
                return origin && normal ? planeThrough(origin, normal) : null;
              })();
        if (!equation) return [];
        const n: Vec3 = [equation.a, equation.b, equation.c];
        const seed: Vec3 = Math.abs(n[0]) < Math.abs(n[2]) ? [1, 0, 0] : [0, 0, 1];
        const u = cross(n, seed);
        const v = cross(n, u);
        const unit = (w: Vec3): Vec3 => {
          const len = norm3(w) || 1;
          const size = tool.extent * 0.95;
          return [(w[0] / len) * size, (w[1] / len) * size, (w[2] / len) * size];
        };
        const centre = (trio?.[0] ?? pointOf(pl.through)?.v ?? [0, 0, 0]) as Vec3;
        const uu = unit(u);
        const vv = unit(v);
        const corner = (su: number, sv: number): Vec3 => [
          centre[0] + su * uu[0] + sv * vv[0],
          centre[1] + su * uu[1] + sv * vv[1],
          centre[2] + su * uu[2] + sv * vv[2],
        ];
        return [
          {
            id: pl.id,
            equation,
            corners: [corner(1, 1), corner(-1, 1), corner(-1, -1), corner(1, -1)],
            centre,
            label: pl.label ? L(pl.label) : pl.id,
            color: pl.color ?? PALETTE[(i + 5) % PALETTE.length],
          },
        ];
      })
  );

  /** Painter's order: what lies behind is drawn first, so the figure reads as a solid. */
  const sorted = $derived(
    [
      ...planes.map((p) => ({ kind: 'plane' as const, key: p.id, at: depth(p.centre), plane: p })),
      ...lines.map((l) => ({ kind: 'line' as const, key: l.id, at: depth(l.from), line: l })),
      ...vectors.map((v) => ({ kind: 'vector' as const, key: v.id, at: depth(v.head), vector: v })),
      ...points.map((p) => ({ kind: 'point' as const, key: p.id, at: depth(p.v), point: p })),
    ].sort((a, b) => a.at - b.at)
  );

  /** Arrow head at the tip of a projected segment, in screen coordinates. */
  function arrowHead(tail: Vec3, head: Vec3): string {
    const x1 = sx(tail);
    const y1 = sy(tail);
    const x2 = sx(head);
    const y2 = sy(head);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const p = (a: number) => `${x2 - 11 * Math.cos(angle + a)},${y2 - 11 * Math.sin(angle + a)}`;
    return `${x2},${y2} ${p(0.4)} ${p(-0.4)}`;
  }

  const axes = $derived(
    (
      [
        [[tool.extent, 0, 0], 'x'],
        [[0, tool.extent, 0], 'y'],
        [[0, 0, tool.extent], 'z'],
      ] as Array<[Vec3, string]>
    ).map(([end, name]) => ({ end, name }))
  );
  const origin: Vec3 = [0, 0, 0];

  const f = (v: number) => fmt(v, locale.current, 2);
  /** `2x − y + 3z − 4 = 0`, with the signs joined to the terms rather than printed raw. */
  function equationText(plane: Plane): string {
    const terms = (
      [
        [plane.a, 'x'],
        [plane.b, 'y'],
        [plane.c, 'z'],
        [plane.d, ''],
      ] as Array<[number, string]>
    )
      .filter(([k]) => Math.abs(k) > 1e-9)
      .map(([k, name], i) => {
        const sign = k < 0 ? '− ' : i === 0 ? '' : '+ ';
        const size = Math.abs(k);
        const shown = name && Math.abs(size - 1) < 1e-9 ? '' : f(size);
        return `${sign}${shown}${name}`;
      });
    return `${terms.join(' ') || '0'} = 0`;
  }

  const dotPair = $derived.by(() => {
    if (!tool.dot) return null;
    const u = vectorOf(tool.dot[0]);
    const v = vectorOf(tool.dot[1]);
    if (!u || !v) return null;
    return {
      u,
      v,
      value: dot3(u.value, v.value),
      nu: norm3(u.value),
      nv: norm3(v.value),
      angle: angleBetween(u.value, v.value),
    };
  });
  const distancePair = $derived.by(() => {
    if (!tool.distance) return null;
    const point = pointOf(tool.distance[0]);
    const plane = planes.find((p) => p.id === tool.distance?.[1]);
    if (!point || !plane) return null;
    return { point, plane, value: distancePointPlane(point.v, plane.equation) };
  });

  function onPointerDown(event: PointerEvent) {
    if (!interactive) return;
    turning = true;
    lastX = event.clientX;
    lastY = event.clientY;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    if (!turning) return;
    azimuth = (azimuth + (event.clientX - lastX) * 0.5) % 360;
    elevation = Math.max(-80, Math.min(80, elevation + (event.clientY - lastY) * 0.35));
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onPointerUp() {
    turning = false;
  }
</script>

<div class="tool stack-sm" data-testid="space-tool">
  <svg
    viewBox="0 0 {W} {H}"
    class="tool__svg"
    class:tool__svg--live={interactive}
    role="img"
    aria-label={t('lesson.tool.space')}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
  >
    {#each axes as axis (axis.name)}
      <line
        x1={sx(origin)}
        y1={sy(origin)}
        x2={sx(axis.end)}
        y2={sy(axis.end)}
        stroke="#3a4468"
        stroke-width="1.5"
      />
      <text x={sx(axis.end)} y={sy(axis.end) - 5} class="tick" text-anchor="middle"
        >{axis.name}</text
      >
    {/each}

    {#each sorted as item (item.kind + item.key)}
      {#if item.kind === 'plane' && item.plane}
        <polygon
          points={item.plane.corners.map((c) => `${sx(c)},${sy(c)}`).join(' ')}
          fill={item.plane.color}
          opacity="0.18"
          stroke={item.plane.color}
          stroke-width="1"
        />
        <text
          x={sx(item.plane.corners[0])}
          y={sy(item.plane.corners[0]) - 4}
          class="note"
          fill={item.plane.color}>{item.plane.label}</text
        >
      {:else if item.kind === 'line' && item.line}
        <line
          x1={sx(item.line.from)}
          y1={sy(item.line.from)}
          x2={sx(item.line.to)}
          y2={sy(item.line.to)}
          stroke={item.line.color}
          stroke-width="2"
        />
        <text x={sx(item.line.to) + 4} y={sy(item.line.to)} class="note" fill={item.line.color}
          >{item.line.label}</text
        >
      {:else if item.kind === 'vector' && item.vector}
        <line
          x1={sx(item.vector.tail)}
          y1={sy(item.vector.tail)}
          x2={sx(item.vector.head)}
          y2={sy(item.vector.head)}
          stroke={item.vector.color}
          stroke-width="2.5"
        />
        <polygon points={arrowHead(item.vector.tail, item.vector.head)} fill={item.vector.color} />
        <text
          x={(sx(item.vector.tail) + sx(item.vector.head)) / 2 + 6}
          y={(sy(item.vector.tail) + sy(item.vector.head)) / 2 - 4}
          class="note"
          fill={item.vector.color}>{item.vector.label}</text
        >
      {:else if item.kind === 'point' && item.point}
        <circle cx={sx(item.point.v)} cy={sy(item.point.v)} r="4.5" fill={item.point.color} />
        <text x={sx(item.point.v) + 8} y={sy(item.point.v) + 15} class="note"
          >{item.point.label}</text
        >
      {/if}
    {/each}
  </svg>

  <ul class="readout small" aria-live="polite">
    {#each points as p (p.id)}
      <li>{p.label} ({f(p.v[0])} ; {f(p.v[1])} ; {f(p.v[2])})</li>
    {/each}
    {#each vectors as v (v.id)}
      <li>
        {v.label} ({f(v.value[0])} ; {f(v.value[1])} ; {f(v.value[2])}) ·
        {t('lesson.space.norm')} = {f(norm3(v.value))}
      </li>
    {/each}
    {#each planes as pl (pl.id)}
      <li>{pl.label} · {t('lesson.space.equation')} : {equationText(pl.equation)}</li>
    {/each}
    {#if dotPair}
      <li data-testid="space-dot">
        {dotPair.u.label} · {dotPair.v.label} = {f(dotPair.value)} ·
        {t('lesson.space.angle')} = {f(dotPair.angle)}° ·
        {Math.abs(dotPair.value) < 1e-9
          ? t('lesson.space.orthogonal')
          : t('lesson.space.notOrthogonal')}
      </li>
    {/if}
    {#if distancePair}
      <li data-testid="space-distance">
        {t('lesson.space.distance')} ({distancePair.point.label} ; {distancePair.plane.label}) = {f(
          distancePair.value
        )}
      </li>
    {/if}
  </ul>
  {#if interactive}
    <div class="cluster">
      <label class="field" style="flex: 1">
        <span class="label">{t('lesson.space.azimuth')} : {f(azimuth)}°</span>
        <input
          type="range"
          min="-180"
          max="180"
          step="2"
          bind:value={azimuth}
          data-testid="space-azimuth"
        />
      </label>
      <label class="field" style="flex: 1">
        <span class="label">{t('lesson.space.elevation')} : {f(elevation)}°</span>
        <input
          type="range"
          min="-80"
          max="80"
          step="2"
          bind:value={elevation}
          data-testid="space-elevation"
        />
      </label>
    </div>
    <p class="small muted" style="margin: 0">{t('lesson.space.rotateHint')}</p>
  {/if}
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
  .tool__svg--live {
    cursor: grab;
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
  .tick {
    font-size: 11px;
    fill: #a7b0c8;
    font-family: var(--font-body);
  }
  .readout {
    margin: 0;
    padding-left: var(--space-3);
    display: grid;
    gap: 2px;
  }
</style>
