<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { itemVisible, type ToolState } from '$lib/domain/lesson';
  import {
    ELECTRONEGATIVITY,
    bondPolarity,
    elementBySymbol,
    moleculeFormula,
    moleculePolar,
    octetCheck,
    superscript,
    valenceElectronCount,
    valenceElectrons,
  } from '$lib/domain/lessonTools';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { PALETTE, fmt } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'molecule' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const W = 560;
  const H = 380;
  /** Pixels per drawing unit at most: small molecules are not blown up. */
  const MAX_SCALE = 120;
  /** Room kept around the atoms for the discs, the hulls of the groups and their labels. */
  const EDGE = 74;
  const HULL_PAD = 30;
  const COLOURS: Record<string, string> = {
    H: '#f7f1e3',
    C: '#8c8c8c',
    N: '#5b7cff',
    O: '#ff5b5b',
    Cl: '#5ee6a8',
    S: '#ffd166',
    F: '#b3ffb3',
    Br: '#b85c3c',
    P: '#ffa64d',
    Na: '#b39dff',
    K: '#b39dff',
    Ca: '#b39dff',
    Mg: '#b39dff',
  };
  const colourOf = (symbol: string) => COLOURS[symbol] ?? '#7f9cff';
  /** Dark text on light discs, light text on dark ones. */
  function textOn(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    const luma = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return luma > 0.55 ? '#0b1020' : '#eef1f8';
  }

  /** Learner-side state of the free play: the atom inspected and the two toggles. */
  let selected = $state<string | null>(null);
  let showPairs = $state(true);
  let showGroups = $state(true);
  $effect(() => {
    if (!interactive) {
      selected = null;
      showPairs = true;
      showGroups = true;
    }
  });
  function select(id: string) {
    if (!interactive) return;
    selected = selected === id ? null : id;
  }
  function onKey(event: KeyboardEvent, id: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    select(id);
  }

  // --- layout: drawing units (y up) → canvas, aspect ratio kept ----------------
  const view = $derived.by(() => {
    const xs = tool.atoms.map((a) => a.x);
    const ys = tool.atoms.map((a) => a.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    // The bounding box plus a margin of one unit fits; a pixel edge guarantees the decorations fit too.
    const k = Math.min(
      MAX_SCALE,
      W / (maxX - minX + 2),
      H / (maxY - minY + 2),
      (W - 2 * EDGE) / (maxX - minX),
      (H - 2 * EDGE) / (maxY - minY)
    );
    return { k, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
  });
  const px = (x: number) => W / 2 + (x - view.cx) * view.k;
  const py = (y: number) => H / 2 - (y - view.cy) * view.k;
  /** Disc radius: 22 px, smaller when the bonds are short on screen. */
  const R = $derived(Math.min(22, Math.max(13, view.k * 0.3)));

  interface PlacedAtom {
    id: string;
    element: string;
    lonePairs: number;
    charge?: number;
    cx: number;
    cy: number;
    colour: string;
  }
  const atoms = $derived(
    tool.atoms.map((a): PlacedAtom => ({
      id: a.id,
      element: a.element,
      lonePairs: a.lonePairs,
      charge: a.charge,
      cx: px(a.x),
      cy: py(a.y),
      colour: colourOf(a.element),
    }))
  );
  const atomById = $derived(new Map(atoms.map((a) => [a.id, a])));
  const visibleBonds = $derived(tool.bonds.filter((b) => itemVisible(b, tstate)));
  /** Bonds between the rims of the discs, with their unit vector and its normal. */
  const bonds = $derived(
    visibleBonds.flatMap((b) => {
      const from = atomById.get(b.from);
      const to = atomById.get(b.to);
      if (!from || !to || from.id === to.id) return [];
      const dx = to.cx - from.cx;
      const dy = to.cy - from.cy;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;
      // The normal points upwards (or to the right, for a vertical bond): δ labels sit on that side.
      const flip = ux > 0 || (ux === 0 && uy > 0) ? -1 : 1;
      return [
        {
          id: b.id,
          order: b.order,
          from,
          to,
          x1: from.cx + ux * R,
          y1: from.cy + uy * R,
          x2: to.cx - ux * R,
          y2: to.cy - uy * R,
          ux,
          uy,
          nx: -uy * flip,
          ny: ux * flip,
          polarity: tool.polarity ? bondPolarity(from.element, to.element) : null,
        },
      ];
    })
  );
  const offsets = (order: number): number[] =>
    order === 3 ? [-5, 0, 5] : order === 2 ? [-2.5, 2.5] : [0];

  /** The direction away from the bonds of an atom: the middle of the widest gap between them. */
  function awayAngle(directions: number[]): number {
    if (directions.length === 0) return -Math.PI / 2;
    if (directions.length === 1) return directions[0] + Math.PI;
    const sorted = [...directions].sort((a, b) => a - b);
    let best = sorted[0] + Math.PI;
    let widest = -1;
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const b = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 2 * Math.PI;
      if (b - a > widest) {
        widest = b - a;
        best = (a + b) / 2;
      }
    }
    return best;
  }
  /** Lone pairs as two dots on the rim of each atom, away from its bonds. */
  const pairs = $derived.by(() => {
    const out: Array<{ key: string; dots: Array<[number, number]> }> = [];
    const spacing = (50 * Math.PI) / 180;
    for (const a of atoms) {
      if (!a.lonePairs) continue;
      const directions = bonds
        .filter((b) => b.from.id === a.id || b.to.id === a.id)
        .map((b) => {
          const other = b.from.id === a.id ? b.to : b.from;
          return Math.atan2(other.cy - a.cy, other.cx - a.cx);
        });
      const n = a.lonePairs;
      const base = awayAngle(directions);
      for (let i = 0; i < n; i++) {
        const angle = directions.length
          ? base + (i - (n - 1) / 2) * spacing
          : -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const cx = a.cx + (R + 6) * Math.cos(angle);
        const cy = a.cy + (R + 6) * Math.sin(angle);
        const tx = -Math.sin(angle) * 3.5;
        const ty = Math.cos(angle) * 3.5;
        out.push({
          key: `${a.id}-${i}`,
          dots: [
            [cx + tx, cy + ty],
            [cx - tx, cy - ty],
          ],
        });
      }
    }
    return out;
  });

  /** δ+ / δ− on the polar bonds, with the dipole arrow drawn along the bond towards δ−. */
  const dipoles = $derived(
    bonds.flatMap((b) => {
      if (!b.polarity?.polar) return [];
      // The arrow runs from the δ+ end to the δ− end; `dir` is its sense along (ux, uy).
      const dir = b.polarity.negative === 'to' ? 1 : -1;
      const plusEnd = dir > 0 ? { x: b.x1, y: b.y1 } : { x: b.x2, y: b.y2 };
      const minusEnd = dir > 0 ? { x: b.x2, y: b.y2 } : { x: b.x1, y: b.y1 };
      const side = 13;
      const along = 10;
      const ax = b.x1 + (b.x2 - b.x1) * (dir > 0 ? 0.3 : 0.7) - b.nx * side;
      const ay = b.y1 + (b.y2 - b.y1) * (dir > 0 ? 0.3 : 0.7) - b.ny * side;
      const hx = b.x1 + (b.x2 - b.x1) * (dir > 0 ? 0.7 : 0.3) - b.nx * side;
      const hy = b.y1 + (b.y2 - b.y1) * (dir > 0 ? 0.7 : 0.3) - b.ny * side;
      const angle = Math.atan2(hy - ay, hx - ax);
      const tip = (a: number, r: number) =>
        `${hx - r * Math.cos(angle + a)},${hy - r * Math.sin(angle + a)}`;
      return [
        {
          id: b.id,
          plus: {
            x: plusEnd.x + b.ux * dir * along + b.nx * side,
            y: plusEnd.y + b.uy * dir * along + b.ny * side,
          },
          minus: {
            x: minusEnd.x - b.ux * dir * along + b.nx * side,
            y: minusEnd.y - b.uy * dir * along + b.ny * side,
          },
          arrow: {
            x1: ax,
            y1: ay,
            x2: hx,
            y2: hy,
            head: `${hx},${hy} ${tip(0.45, 7)} ${tip(-0.45, 7)}`,
          },
          cross: {
            x1: ax - b.nx * 3.5,
            y1: ay - b.ny * 3.5,
            x2: ax + b.nx * 3.5,
            y2: ay + b.ny * 3.5,
          },
        },
      ];
    })
  );

  /** Translucent rounded hulls around the characteristic groups. */
  const groups = $derived(
    tool.groups
      .filter((g) => itemVisible(g, tstate))
      .flatMap((g, i) => {
        const members = g.atoms.map((id) => atomById.get(id)).filter((a) => !!a);
        if (!members.length) return [];
        const left = Math.min(...members.map((a) => a.cx)) - R - HULL_PAD + 14;
        const right = Math.max(...members.map((a) => a.cx)) + R + HULL_PAD - 14;
        const top = Math.min(...members.map((a) => a.cy)) - R - HULL_PAD + 14;
        const bottom = Math.max(...members.map((a) => a.cy)) + R + HULL_PAD - 14;
        return [
          {
            id: g.id,
            x: left,
            y: top,
            w: right - left,
            h: bottom - top,
            labelY: top > 22 ? top - 7 : bottom + 16,
            colour: g.color ?? PALETTE[(i + 1) % PALETTE.length],
            label: L(g.label),
            family: g.family ? L(g.family) : undefined,
          },
        ];
      })
  );

  // --- readings ------------------------------------------------------------------
  const charge = $derived(tool.atoms.reduce((s, a) => s + (a.charge ?? 0), 0));
  const formula = $derived(
    moleculeFormula(tool.atoms) +
      (charge === 0
        ? ''
        : `${Math.abs(charge) > 1 ? superscript(Math.abs(charge)) : ''}${charge > 0 ? '⁺' : '⁻'}`)
  );
  const formulaText = $derived(tool.name ? `${formula} — ${L(tool.name)}` : formula);
  const bondingPairs = $derived(visibleBonds.reduce((s, b) => s + b.order, 0));
  const lonePairs = $derived(tool.atoms.reduce((s, a) => s + a.lonePairs, 0));
  const geometry = $derived(tool.geometry);
  const polar = $derived(
    tool.polarity ? moleculePolar(tool.atoms, visibleBonds, tool.polar) : null
  );
  /** The atom inspected during the free play. */
  const info = $derived.by(() => {
    const atom = tool.atoms.find((a) => a.id === selected);
    const element = atom ? elementBySymbol(atom.element) : undefined;
    if (!atom || !element) return null;
    return {
      atom,
      element,
      valence: valenceElectrons(element.z),
      electronegativity: ELECTRONEGATIVITY[atom.element],
      octet: octetCheck(atom, visibleBonds),
    };
  });
  const chargeText = (c: number) => `${Math.abs(c) > 1 ? Math.abs(c) : ''}${c > 0 ? '+' : '−'}`;
</script>

<div class="tool stack-sm" data-testid="molecule-tool" data-atoms={tool.atoms.length}>
  <svg viewBox="0 0 {W} {H}" class="tool__svg" role="group" aria-label={t('lesson.tool.molecule')}>
    {#if showGroups}
      {#each groups as g (g.id)}
        <rect
          x={g.x}
          y={g.y}
          width={g.w}
          height={g.h}
          rx="18"
          fill={g.colour}
          fill-opacity="0.18"
          stroke={g.colour}
          stroke-width="1.5"
          stroke-dasharray="6 5"
          data-testid="group-{g.id}"
        />
        <text x={g.x + 10} y={g.labelY} class="note" fill={g.colour}>{g.label}</text>
      {/each}
    {/if}
    {#each bonds as b (b.id)}
      {#each offsets(b.order) as o (o)}
        <line
          x1={b.x1 + b.nx * o}
          y1={b.y1 + b.ny * o}
          x2={b.x2 + b.nx * o}
          y2={b.y2 + b.ny * o}
          class="bond"
        />
      {/each}
    {/each}
    {#each dipoles as d (d.id)}
      <line x1={d.arrow.x1} y1={d.arrow.y1} x2={d.arrow.x2} y2={d.arrow.y2} class="dipole" />
      <line x1={d.cross.x1} y1={d.cross.y1} x2={d.cross.x2} y2={d.cross.y2} class="dipole" />
      <polygon points={d.arrow.head} fill="#eef1f8" opacity="0.85" />
      <text
        x={d.plus.x}
        y={d.plus.y + 4}
        class="note note--small"
        fill="#ff8fab"
        text-anchor="middle">δ+</text
      >
      <text
        x={d.minus.x}
        y={d.minus.y + 4}
        class="note note--small"
        fill="#7f9cff"
        text-anchor="middle">δ−</text
      >
    {/each}
    {#each atoms as a (a.id)}
      <g
        class="atom"
        class:atom--active={interactive}
        class:atom--selected={selected === a.id}
        role="button"
        tabindex={interactive ? 0 : -1}
        aria-disabled={!interactive}
        aria-pressed={selected === a.id}
        aria-label="{a.element} · {L(elementBySymbol(a.element)?.name)}"
        data-testid="atom-{a.id}"
        onclick={() => select(a.id)}
        onkeydown={(e) => onKey(e, a.id)}
      >
        {#if selected === a.id}
          <circle cx={a.cx} cy={a.cy} r={R + 5} class="atom__ring" />
        {/if}
        <circle cx={a.cx} cy={a.cy} r={R} fill={a.colour} class="atom__disc" />
        <text
          x={a.cx}
          y={a.cy}
          dy="0.35em"
          class="atom__symbol"
          style="font-size: {Math.round(R * 0.8)}px"
          fill={textOn(a.colour)}
          text-anchor="middle">{a.element}</text
        >
        {#if a.charge}
          <circle cx={a.cx + R * 0.8} cy={a.cy - R * 0.8} r="8" fill="#0b1020" stroke={a.colour} />
          <text
            x={a.cx + R * 0.8}
            y={a.cy - R * 0.8}
            dy="0.35em"
            class="atom__charge"
            text-anchor="middle">{chargeText(a.charge)}</text
          >
        {/if}
      </g>
    {/each}
    {#if showPairs}
      {#each pairs as p (p.key)}
        {#each p.dots as [x, y], i (i)}
          <circle cx={x} cy={y} r="2.4" class="pair" />
        {/each}
      {/each}
    {/if}
  </svg>
  {#if interactive}
    <div class="cluster">
      <label class="small"
        ><input type="checkbox" bind:checked={showPairs} data-testid="molecule-show-pairs" />
        {t('lesson.molecule.showPairs')}</label
      >
      {#if tool.groups.length}
        <label class="small"
          ><input type="checkbox" bind:checked={showGroups} data-testid="molecule-show-groups" />
          {t('lesson.molecule.showGroups')}</label
        >
      {/if}
    </div>
  {/if}
  {#if info}
    <div class="card stack-sm" data-testid="molecule-atom" data-complete={info.octet.complete}>
      <p style="margin: 0">
        <strong style="font-size: var(--fs-lg)">{info.element.symbol}</strong> · {L(
          info.element.name
        )} · Z = {info.element.z}
      </p>
      <p style="margin: 0">
        {t('lesson.molecule.valence')} : {info.valence}{#if info.electronegativity !== undefined}
          · {t('lesson.molecule.electronegativity')} : {fmt(
            info.electronegativity,
            locale.current,
            2
          )}{/if}
      </p>
      <p style="margin: 0">
        {t(info.octet.needed === 2 ? 'lesson.molecule.duet' : 'lesson.molecule.octet')} : {info
          .octet.electrons} / {info.octet.needed} —
        <strong
          >{info.octet.complete
            ? t('lesson.molecule.complete')
            : t('lesson.molecule.incomplete')}</strong
        >
        ({t('lesson.molecule.bonding')} : {info.octet.bonding}, {t('lesson.molecule.lone')} : {info
          .octet.lone})
      </p>
    </div>
  {/if}
  <ul class="readout small" aria-live="polite" data-testid="molecule-reading">
    <li>
      <strong>{t('lesson.molecule.formula')}</strong> : {formulaText}
    </li>
    <li>{t('lesson.molecule.valence')} : {valenceElectronCount(tool.atoms)}</li>
    <li>{t('lesson.molecule.bonding')} : {bondingPairs}</li>
    <li>{t('lesson.molecule.lone')} : {lonePairs}</li>
    {#if geometry}
      <li>{t('lesson.molecule.geometry')} : {t(`lesson.molecule.geometry.${geometry}`)}</li>
    {/if}
    {#if polar !== null}
      <li data-testid="molecule-polarity">
        {polar ? t('lesson.molecule.polar') : t('lesson.molecule.apolar')}
      </li>
    {/if}
    {#each groups as g (g.id)}
      <li>
        {t('lesson.molecule.group')} :
        <span style="color: {g.colour}">{g.label}</span>
        {g.family ? `(${t('lesson.molecule.family')} : ${g.family})` : ''}
      </li>
    {/each}
  </ul>
  {#if interactive}
    <p class="small muted" style="margin: 0">{t('lesson.molecule.clickHint')}</p>
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
  .bond {
    stroke: #dfe4f2;
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .dipole {
    stroke: #eef1f8;
    stroke-width: 1.5;
    opacity: 0.85;
  }
  .pair {
    fill: #eef1f8;
  }
  .atom {
    outline: none;
  }
  .atom--active {
    cursor: pointer;
  }
  .atom__disc {
    stroke: #070b17;
    stroke-width: 1.5;
    transition: stroke 0.15s ease;
  }
  .atom--active:hover .atom__disc,
  .atom:focus-visible .atom__disc {
    stroke: #ffffff;
    stroke-width: 3;
  }
  .atom__ring {
    fill: none;
    stroke: #ffd166;
    stroke-width: 2.5;
  }
  .atom__symbol {
    font-family: var(--font-body);
    font-weight: 700;
    pointer-events: none;
  }
  .atom__charge {
    font-family: var(--font-body);
    font-size: 10px;
    font-weight: 700;
    fill: #eef1f8;
    pointer-events: none;
  }
  .readout {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.15rem;
  }
</style>
