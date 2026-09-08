<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { evaluateScalar, itemVisible, slopeAt, type ToolState } from '$lib/domain/lesson';
  import {
    equivalenceVolume,
    predominance,
    ratioFromPH,
    titrationPH,
    type TitrationSetup,
  } from '$lib/domain/lessonTools';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { shortLabel } from '$lib/atlas/labels';
  import { fmt, PALETTE, scales } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'acid_base' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const params = $derived(tstate.params);
  const couples = $derived(
    tool.couples
      .filter((c) => itemVisible(c, tstate))
      .map((c, i) => ({
        id: c.id,
        pka: evaluateScalar(c.pka, params),
        acid: L(c.acid),
        base: L(c.base),
        color: c.color ?? PALETTE[i % PALETTE.length],
      }))
      .filter((c) => Number.isFinite(c.pka))
  );

  const titration = $derived(tool.mode === 'titration' ? (tool.titration ?? null) : null);
  const setup = $derived.by((): TitrationSetup | null => {
    if (!titration) return null;
    const couple = couples.find((c) => c.id === titration.couple);
    return {
      c: evaluateScalar(titration.c, params),
      v: evaluateScalar(titration.v, params),
      titrant: evaluateScalar(titration.titrant, params),
      role: titration.role,
      pka: couple?.pka,
    };
  });
  const equivalence = $derived.by(() => {
    const value = setup ? equivalenceVolume(setup.c, setup.v, setup.titrant) : NaN;
    // A titrant of zero concentration never reaches the equivalence: keep a drawable axis anyway.
    return Number.isFinite(value) && value > 0 ? value : NaN;
  });

  /**
   * The pH read at the cursor, or the volume poured: whichever the mode moves. Written by the
   * lesson, then by the learner during the free play — a writable derived, so a slide that
   * changes a parameter takes the cursor back with it.
   */
  let ph = $derived(evaluateScalar(tool.ph, params));
  let volume = $derived(
    titration?.volume !== undefined ? evaluateScalar(titration.volume, params) : NaN
  );
  const pouring = $derived(
    Number.isFinite(volume) ? volume : Number.isFinite(equivalence) ? equivalence : 0
  );

  const CANVAS = { W: 560, H: 320, pad: { l: 46, r: 18, t: 18, b: 38 } };
  const view = $derived(
    titration
      ? {
          x: [0, Number.isFinite(equivalence) ? 2 * equivalence : 1] as [number, number],
          y: [0, 14] as [number, number],
        }
      : { x: [0, 14] as [number, number], y: [0, 1] as [number, number] }
  );
  const sc = $derived(scales(view, CANVAS));

  /** The titration curve, solved point by point from the charge balance. */
  const curve = $derived.by(() => {
    if (!setup) return '';
    let d = '';
    for (let i = 0; i <= 240; i++) {
      const v = (view.x[1] * i) / 240;
      const value = titrationPH(setup, v);
      if (!Number.isFinite(value)) continue;
      d += `${d ? 'L' : 'M'}${sc.sx(v).toFixed(2)} ${sc.sy(value).toFixed(2)} `;
    }
    return d;
  });
  const phAt = $derived(setup ? titrationPH(setup, pouring) : NaN);
  const phEquivalence = $derived(setup ? titrationPH(setup, equivalence) : NaN);
  const phHalf = $derived(setup ? titrationPH(setup, equivalence / 2) : NaN);
  const slope = $derived(
    setup && Number.isFinite(equivalence)
      ? slopeAt((v: number) => titrationPH(setup, v), pouring, equivalence / 400)
      : NaN
  );

  /** Predominance lanes: one per couple, cut at its pKa. */
  const laneHeight = $derived(Math.min(70, (CANVAS.H - 70) / Math.max(1, couples.length)));

  const f = (v: number) => fmt(v, locale.current, 2);
  const f1 = (v: number) => fmt(v, locale.current, 1);
  /** A name cut to what its band can hold, so it never runs across the pKa line. */
  const fit = (text: string, width: number) => shortLabel(text, Math.max(3, Math.floor(width / 7)));
</script>

<div class="tool stack-sm" data-testid="acid-base-tool" data-mode={tool.mode}>
  <svg
    viewBox="0 0 {sc.W} {sc.H}"
    class="tool__svg"
    role="img"
    aria-label={t('lesson.tool.acid_base')}
  >
    {#each sc.xTicks as tick (tick)}
      <line x1={sc.sx(tick)} y1={sc.pad.t} x2={sc.sx(tick)} y2={sc.H - sc.pad.b} stroke="#1b2340" />
      <text x={sc.sx(tick)} y={sc.H - sc.pad.b + 14} class="tick" text-anchor="middle"
        >{f1(tick)}</text
      >
    {/each}

    {#if titration && setup}
      {#each sc.yTicks as tick (tick)}
        <line
          x1={sc.pad.l}
          y1={sc.sy(tick)}
          x2={sc.W - sc.pad.r}
          y2={sc.sy(tick)}
          stroke="#1b2340"
        />
        <text x={sc.pad.l - 6} y={sc.sy(tick) + 4} class="tick" text-anchor="end">{f1(tick)}</text>
      {/each}
      {#if titration.indicator}
        <rect
          x={sc.pad.l}
          y={sc.sy(titration.indicator.to)}
          width={sc.plotW}
          height={Math.abs(sc.sy(titration.indicator.from) - sc.sy(titration.indicator.to))}
          fill="#ffd166"
          opacity="0.14"
        />
        <text
          x={sc.W - sc.pad.r - 4}
          y={sc.sy(titration.indicator.to) - 4}
          class="tick"
          text-anchor="end">{L(titration.indicator.label)}</text
        >
      {/if}
      <path
        d={curve}
        fill="none"
        stroke="#7f9cff"
        stroke-width="2.5"
        data-testid="titration-curve"
      />
      <line
        x1={sc.sx(equivalence)}
        y1={sc.pad.t}
        x2={sc.sx(equivalence)}
        y2={sc.H - sc.pad.b}
        stroke="#ff8fab"
        stroke-dasharray="4 3"
      />
      <circle cx={sc.sx(equivalence)} cy={sc.sy(phEquivalence)} r="5" fill="#ff8fab" />
      <text x={sc.sx(equivalence) + 6} y={sc.sy(phEquivalence) - 8} class="note" fill="#ff8fab"
        >E</text
      >
      {#if setup.pka !== undefined}
        <circle cx={sc.sx(equivalence / 2)} cy={sc.sy(phHalf)} r="4" fill="#5ee6a8" />
        <text x={sc.sx(equivalence / 2) + 6} y={sc.sy(phHalf) - 6} class="note" fill="#5ee6a8"
          >pKa</text
        >
      {/if}
      <circle cx={sc.sx(pouring)} cy={sc.sy(phAt)} r="5" fill="#ffd166" />
      <text x={sc.W - sc.pad.r} y={sc.pad.t + 12} class="tick" text-anchor="end">pH</text>
      <text x={sc.W - sc.pad.r} y={sc.H - 6} class="tick" text-anchor="end">V (mL)</text>
    {:else}
      {#each couples as couple, i (couple.id)}
        {@const y = sc.pad.t + i * laneHeight}
        <rect
          x={sc.pad.l}
          y={y + 6}
          width={Math.max(0, sc.sx(couple.pka) - sc.pad.l)}
          height={laneHeight - 18}
          fill={couple.color}
          opacity="0.22"
        />
        <rect
          x={sc.sx(couple.pka)}
          y={y + 6}
          width={Math.max(0, sc.W - sc.pad.r - sc.sx(couple.pka))}
          height={laneHeight - 18}
          fill={couple.color}
          opacity="0.45"
        />
        <line
          x1={sc.sx(couple.pka)}
          y1={y + 6}
          x2={sc.sx(couple.pka)}
          y2={y + laneHeight - 12}
          stroke="#eef1f8"
          stroke-width="2"
        />
        <text
          x={(sc.pad.l + sc.sx(couple.pka)) / 2}
          y={y + laneHeight / 2}
          class="note"
          text-anchor="middle">{fit(couple.acid, sc.sx(couple.pka) - sc.pad.l)}</text
        >
        <text
          x={(sc.sx(couple.pka) + sc.W - sc.pad.r) / 2}
          y={y + laneHeight / 2}
          class="note"
          text-anchor="middle">{fit(couple.base, sc.W - sc.pad.r - sc.sx(couple.pka))}</text
        >
        <text x={sc.sx(couple.pka)} y={y + 2} class="tick" text-anchor="middle"
          >pKa = {f1(couple.pka)}</text
        >
      {/each}
      <line
        x1={sc.sx(ph)}
        y1={sc.pad.t}
        x2={sc.sx(ph)}
        y2={sc.H - sc.pad.b}
        stroke="#ffd166"
        stroke-width="2"
        data-testid="ph-cursor"
      />
      <text x={sc.W - sc.pad.r} y={sc.H - 6} class="tick" text-anchor="end">pH</text>
    {/if}
  </svg>

  {#if titration && setup}
    <p class="small" style="margin: 0" data-testid="acid-base-reading" aria-live="polite">
      {t('lesson.acid.volume')} V = {f1(pouring)} mL · {t('lesson.acid.ph')} = {f(phAt)} ·
      {t('lesson.acid.equivalence')} V<sub>E</sub> = {f(equivalence)} mL, pH = {f(phEquivalence)}
      {#if setup.pka !== undefined}· {t('lesson.acid.halfEquivalence')} pH = pKa = {f(phHalf)}{/if}
      · {t('lesson.acid.slope')} = {f(slope)}
    </p>
  {:else}
    <p class="small" style="margin: 0" data-testid="acid-base-reading" aria-live="polite">
      {t('lesson.acid.ph')} = {f(ph)}
      {#each couples as couple (couple.id)}
        &nbsp;· {predominance(couple.pka, ph) === 'equal'
          ? `${couple.acid} / ${couple.base} : ${t('lesson.acid.equal')}`
          : `${predominance(couple.pka, ph) === 'acid' ? couple.acid : couple.base} ${t('lesson.acid.predominates')}`}
        ({t('lesson.acid.ratio')} = {ratioFromPH(couple.pka, ph) >= 1000
          ? '≫ 1'
          : f(ratioFromPH(couple.pka, ph))})
      {/each}
    </p>
  {/if}

  {#if interactive && tool.parameters.length === 0}
    <label class="field">
      <span class="label"
        >{titration ? `${t('lesson.acid.volume')} (mL)` : t('lesson.acid.ph')} :
        {f1(titration ? pouring : ph)}</span
      >
      {#if titration}
        <input
          type="range"
          min="0"
          max={view.x[1]}
          step={view.x[1] / 200}
          bind:value={volume}
          data-testid="acid-base-volume"
        />
      {:else}
        <input
          type="range"
          min="0"
          max="14"
          step="0.1"
          bind:value={ph}
          data-testid="acid-base-ph"
        />
      {/if}
    </label>
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
  .tick {
    font-size: 11px;
    fill: #a7b0c8;
    font-family: var(--font-body);
  }
</style>
