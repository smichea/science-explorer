<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { itemVisible, type ToolState } from '$lib/domain/lesson';
  import { photonBetween, subscript, wavelengthColour } from '$lib/domain/lessonTools';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { fmt, fmtSci } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'energy_levels' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const W = 560;
  const H = 400;
  const PAD_T = 26;
  const PAD_B = 30;
  /** The level lines run from X0 to X1: energies sit on their left, labels on their right. */
  const X0 = 120;
  const X1 = 400;
  /** The spectrum strip under the diagram: 380 → 780 nm across the bar. */
  const STRIP = { x0: 70, x1: 490, y0: 12, y1: 30, h: 50 };
  const STOPS = Array.from({ length: 10 }, (_, k) => ({
    offset: (100 * k) / 9,
    colour: wavelengthColour(380 + (400 * k) / 9),
  }));
  const uid = $props.id();
  const f = (v: number, d = 2) => fmt(v, locale.current, d);

  /** Levels picked during the free play: the first click, then the pair. */
  let picks = $state<string[]>([]);
  $effect(() => {
    if (!interactive) picks = [];
  });
  function pick(id: string) {
    if (!interactive) return;
    picks = picks.length === 1 && picks[0] !== id ? [picks[0], id] : [id];
  }
  function onKey(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    pick(id);
  }

  interface Placed {
    id: string;
    energy: number;
    y: number;
    /** Where the texts sit: pushed apart when two levels are close (the lines stay put). */
    labelY: number;
    label: string;
  }
  /** Rank of every authored level by increasing energy: E₁ is the lowest whatever the order of the file. */
  const rank = $derived(
    new Map([...tool.levels].sort((a, b) => a.energy - b.energy).map((l, i) => [l.id, i + 1]))
  );
  const visible = $derived(
    tool.levels.filter((l) => itemVisible(l, tstate)).sort((a, b) => a.energy - b.energy)
  );
  /** Energy scale: 10 % of margin below the lowest level and above max(0, highest). */
  const range = $derived.by(() => {
    const energies = visible.map((l) => l.energy);
    const lo = energies.length ? Math.min(...energies) : -1;
    const hi = energies.length ? Math.max(0, ...energies) : 0;
    const span = hi - lo || 1;
    return { min: lo - 0.1 * span, max: hi + 0.1 * span };
  });
  const sy = (e: number) =>
    PAD_T + ((range.max - e) / (range.max - range.min)) * (H - PAD_T - PAD_B);
  /** The dashed ionisation limit, unless a level already sits at 0 eV. */
  const ionised = $derived(
    visible.length > 0 && visible[0].energy < 0 && !visible.some((l) => Math.abs(l.energy) < 1e-9)
  );
  /** Levels placed on the canvas; the ionisation line takes part in the spreading of the texts. */
  const placed = $derived.by((): { levels: Placed[]; ionisedY: number } => {
    const entries: Placed[] = visible.map((l) => ({
      id: l.id,
      energy: l.energy,
      y: sy(l.energy),
      labelY: sy(l.energy),
      label: l.label ? L(l.label) : `E${subscript(rank.get(l.id) ?? 1)}`,
    }));
    if (ionised) entries.push({ id: '', energy: 0, y: sy(0), labelY: sy(0), label: '' });
    const GAP = 14;
    for (let i = 1; i < entries.length; i++)
      entries[i].labelY = Math.min(entries[i].labelY, entries[i - 1].labelY - GAP);
    const top = PAD_T + 4;
    if (entries.length && entries[entries.length - 1].labelY < top) {
      entries[entries.length - 1].labelY = top;
      for (let i = entries.length - 2; i >= 0; i--)
        entries[i].labelY = Math.max(entries[i].labelY, entries[i + 1].labelY + GAP);
    }
    return {
      levels: entries.filter((e) => e.id !== ''),
      ionisedY: entries.find((e) => e.id === '')?.labelY ?? sy(0),
    };
  });
  const levels = $derived(placed.levels);

  const from = $derived.by((): string | null => {
    const id = picks.length ? picks[0] : tool.selected?.[0];
    return id && levels.some((l) => l.id === id) ? id : null;
  });
  const to = $derived.by((): string | null => {
    const id = picks.length === 2 ? picks[1] : picks.length === 1 ? undefined : tool.selected?.[1];
    return id && levels.some((l) => l.id === id) ? id : null;
  });
  const fromLevel = $derived(levels.find((l) => l.id === from) ?? null);
  const toLevel = $derived(levels.find((l) => l.id === to) ?? null);
  const photon = $derived(
    fromLevel && toLevel && fromLevel.id !== toLevel.id
      ? photonBetween(fromLevel.energy, toLevel.energy)
      : null
  );
  const colour = $derived(photon ? wavelengthColour(photon.wavelengthNm) : '#8a8a8a');

  interface Arrow {
    id: string;
    from: Placed;
    to: Placed;
    label?: string;
    colour: string;
    x: number;
  }
  const authored = $derived(
    tool.transitions
      .filter((tr) => itemVisible(tr, tstate))
      .flatMap((tr) => {
        const a = levels.find((l) => l.id === tr.from);
        const b = levels.find((l) => l.id === tr.to);
        if (!a || !b || a.id === b.id) return [];
        return [
          {
            id: tr.id,
            from: a,
            to: b,
            label: tr.label ? L(tr.label) : undefined,
            colour: wavelengthColour(photonBetween(a.energy, b.energy).wavelengthNm),
          },
        ];
      })
  );
  /** The authored transition that is the selected pair lends its label to the thick arrow. */
  const selectedLabel = $derived(authored.find((a) => a.from.id === from && a.to.id === to)?.label);
  /** Arrows spread across the diagram, the selected pair last so that its photon has room. */
  const arrows = $derived.by((): { thin: Arrow[]; x: number } => {
    const thin = authored.filter((a) => !(a.from.id === from && a.to.id === to));
    const count = thin.length + (photon ? 1 : 0);
    const centre = (X0 + X1) / 2 - 10;
    const step = count > 1 ? Math.min(46, 200 / (count - 1)) : 0;
    const start = centre - (step * (count - 1)) / 2;
    return {
      thin: thin.map((a, i) => ({ ...a, x: start + i * step })),
      x: start + (count - 1) * step,
    };
  });

  /** Head of a vertical arrow from y1 to y2 (the tip at y2). */
  function head(x: number, y1: number, y2: number, size: number): string {
    const dir = Math.sign(y2 - y1) || 1;
    const base = y2 - dir * size;
    return `${x},${y2} ${x - size * 0.45},${base} ${x + size * 0.45},${base}`;
  }
  /** A wavy photon beside the arrow, leaving the atom (emission) or reaching it (absorption). */
  const glyph = $derived.by(() => {
    if (!photon || !fromLevel || !toLevel) return null;
    const x = arrows.x + 12;
    const y = (fromLevel.y + toLevel.y) / 2;
    const length = 30;
    const steps = 24;
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const px = x + (length * i) / steps;
      const py = y + 4 * Math.sin((i / steps) * Math.PI * 6);
      d += `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)} `;
    }
    const tip = photon.emission
      ? `${x + length + 6},${y} ${x + length},${y - 4} ${x + length},${y + 4}`
      : `${x - 6},${y} ${x},${y - 4} ${x},${y + 4}`;
    return { d, tip, x, y };
  });
  const stripX = (nm: number) =>
    Math.max(STRIP.x0, Math.min(STRIP.x1, STRIP.x0 + ((nm - 380) / 400) * (STRIP.x1 - STRIP.x0)));
</script>

<div
  class="tool stack-sm"
  data-testid="energy-levels-tool"
  data-selected={from && to ? `${from},${to}` : ''}
  data-domain={photon?.domain ?? ''}
>
  <svg
    viewBox="0 0 {W} {H}"
    class="tool__svg"
    role="group"
    aria-label={t('lesson.tool.energy_levels')}
  >
    <!-- the energy axis -->
    <line x1="28" y1={H - PAD_B} x2="28" y2={PAD_T + 4} class="axis" />
    <polygon points="28,{PAD_T - 4} 23,{PAD_T + 8} 33,{PAD_T + 8}" fill="#a7b0c8" />
    <text x="36" y={PAD_T + 2} class="tick">E (eV)</text>
    {#if ionised}
      <line x1={X0} y1={sy(0)} x2={X1} y2={sy(0)} class="ionised" />
      {#if Math.abs(placed.ionisedY - sy(0)) > 1}
        <line x1={X0 - 7} y1={placed.ionisedY} x2={X0} y2={sy(0)} class="leader" />
        <line x1={X1} y1={sy(0)} x2={X1 + 7} y2={placed.ionisedY} class="leader" />
      {/if}
      <text x={X0 - 10} y={placed.ionisedY + 4} class="tick" text-anchor="end">0 eV</text>
      <text x={X1 + 10} y={placed.ionisedY + 4} class="tick">{t('lesson.levels.ionised')}</text>
    {/if}
    {#each levels as l, i (l.id)}
      <g
        class="level"
        class:level--active={interactive}
        class:level--from={l.id === from}
        class:level--to={l.id === to}
      >
        <line
          x1={X0}
          y1={l.y}
          x2={X1}
          y2={l.y}
          class="level__line"
          class:level__line--ground={i === 0}
        />
        {#if Math.abs(l.labelY - l.y) > 1}
          <line x1={X0 - 7} y1={l.labelY} x2={X0} y2={l.y} class="leader" />
          <line x1={X1} y1={l.y} x2={X1 + 7} y2={l.labelY} class="leader" />
        {/if}
        <text x={X0 - 10} y={l.labelY + 4} class="tick" text-anchor="end">{f(l.energy)} eV</text>
        <text x={X1 + 10} y={l.labelY + 4} class="note level__label">{l.label}</text>
        {#if i === 0}
          <text x={(X0 + X1) / 2} y={l.y + 15} class="tick" text-anchor="middle"
            >{t('lesson.levels.ground')}</text
          >
        {/if}
        <rect
          x={X0}
          y={l.y - 9}
          width={X1 - X0}
          height="18"
          class="level__hit"
          role="button"
          tabindex={interactive ? 0 : -1}
          aria-disabled={!interactive}
          aria-label="{t('lesson.levels.level')} {l.label} : {f(l.energy)} eV"
          data-testid="level-{l.id}"
          onclick={() => pick(l.id)}
          onkeydown={(e) => onKey(e, l.id)}
        />
      </g>
    {/each}
    {#each arrows.thin as a (a.id)}
      <line
        x1={a.x}
        y1={a.from.y}
        x2={a.x}
        y2={a.to.y}
        stroke={a.colour}
        stroke-width="1.5"
        opacity="0.9"
      />
      <polygon points={head(a.x, a.from.y, a.to.y, 8)} fill={a.colour} />
      {#if a.label}
        <text x={a.x + 5} y={(a.from.y + a.to.y) / 2 + 4} class="note note--small" fill={a.colour}
          >{a.label}</text
        >
      {/if}
    {/each}
    {#if photon && fromLevel && toLevel && glyph}
      <line
        x1={arrows.x}
        y1={fromLevel.y}
        x2={arrows.x}
        y2={toLevel.y}
        stroke={colour}
        stroke-width="3"
        class="fade"
      />
      <polygon points={head(arrows.x, fromLevel.y, toLevel.y, 11)} fill={colour} class="fade" />
      <path d={glyph.d} fill="none" stroke={colour} stroke-width="2" class="fade" />
      <polygon points={glyph.tip} fill={colour} class="fade" />
      <text x={glyph.x} y={glyph.y - 9} class="note note--small fade" fill={colour}
        >{selectedLabel ? `${selectedLabel} · ` : ''}{f(photon.wavelengthNm, 0)} nm</text
      >
    {/if}
  </svg>
  <svg
    viewBox="0 0 {W} {STRIP.h}"
    class="tool__svg"
    role="img"
    aria-label={t('lesson.levels.wavelength')}
  >
    <defs>
      <linearGradient id="{uid}-spectrum" x1="0" y1="0" x2="1" y2="0">
        {#each STOPS as s (s.offset)}
          <stop offset="{s.offset}%" stop-color={s.colour} />
        {/each}
      </linearGradient>
    </defs>
    <rect
      x={STRIP.x0}
      y={STRIP.y0}
      width={STRIP.x1 - STRIP.x0}
      height={STRIP.y1 - STRIP.y0}
      rx="3"
      fill="url(#{uid}-spectrum)"
    />
    <text x={STRIP.x0 - 8} y={STRIP.y1 - 5} class="tick" text-anchor="end">UV</text>
    <text x={STRIP.x1 + 8} y={STRIP.y1 - 5} class="tick">IR</text>
    {#each [400, 500, 600, 700] as nm (nm)}
      <line x1={stripX(nm)} y1={STRIP.y1} x2={stripX(nm)} y2={STRIP.y1 + 4} class="axis" />
      <text x={stripX(nm)} y={STRIP.y1 + 16} class="tick" text-anchor="middle"
        >{nm}{nm === 700 ? ' nm' : ''}</text
      >
    {/each}
    {#if photon && Number.isFinite(photon.wavelengthNm)}
      {@const mx = stripX(photon.wavelengthNm)}
      {#if photon.domain === 'visible'}
        <line
          x1={mx}
          y1={STRIP.y0 - 4}
          x2={mx}
          y2={STRIP.y1 + 4}
          stroke="#070b17"
          stroke-width="4"
        />
        <line
          x1={mx}
          y1={STRIP.y0 - 4}
          x2={mx}
          y2={STRIP.y1 + 4}
          stroke="#eef1f8"
          stroke-width="2"
        />
      {/if}
      <polygon
        points="{mx},{STRIP.y0 - 2} {mx - 5},{STRIP.y0 - 10} {mx + 5},{STRIP.y0 - 10}"
        fill="#eef1f8"
      />
    {/if}
  </svg>
  <ul class="readout small" aria-live="polite" data-testid="energy-levels-reading">
    {#if photon && fromLevel && toLevel}
      <li>
        <strong>{t('lesson.levels.transition')}</strong>
        {t('lesson.levels.selected', { from: fromLevel.label, to: toLevel.label })} :
        <span style="color: {colour}"
          >{photon.emission ? t('lesson.levels.emission') : t('lesson.levels.absorption')}</span
        >
      </li>
      <li>
        {t('lesson.levels.photon')} · {t('lesson.levels.energy')} : ΔE = {f(photon.energyEv)} eV = {fmtSci(
          photon.energyJ,
          locale.current
        )} J
      </li>
      <li>{t('lesson.levels.frequency')} : ν = {fmtSci(photon.frequency, locale.current)} Hz</li>
      <li>
        {t('lesson.levels.wavelength')} : λ = {f(photon.wavelengthNm, 0)} nm ({t(
          `lesson.levels.${photon.domain}`
        )})
      </li>
    {:else}
      <li>{t('lesson.levels.pickHint')}</li>
    {/if}
  </ul>
  {#if interactive && photon}
    <p class="small muted" style="margin: 0">{t('lesson.levels.pickHint')}</p>
  {/if}
</div>

<style>
  .tool__svg {
    width: 100%;
    height: auto;
    display: block;
    border-radius: var(--radius);
    background: #070b17;
  }
  .axis {
    stroke: rgba(255, 255, 255, 0.45);
    stroke-width: 1.4;
  }
  .ionised {
    stroke: #a7b0c8;
    stroke-width: 1.2;
    stroke-dasharray: 6 5;
  }
  .leader {
    stroke: rgba(255, 255, 255, 0.35);
    stroke-width: 1;
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
  .level__line {
    stroke: #a7b0c8;
    stroke-width: 2;
    transition: stroke 0.15s ease;
  }
  .level__line--ground {
    stroke: #eef1f8;
    stroke-width: 3.5;
  }
  .level--from .level__line,
  .level--to .level__line {
    stroke: #ffd166;
  }
  .level--from .level__label,
  .level--to .level__label {
    fill: #ffd166;
  }
  .level__hit {
    fill: transparent;
    outline: none;
  }
  .level--active {
    cursor: pointer;
  }
  .level--active:hover .level__line {
    stroke: #ffffff;
  }
  .level__hit:focus-visible {
    stroke: #ffd166;
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
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
