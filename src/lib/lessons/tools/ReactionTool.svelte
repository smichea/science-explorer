<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { evaluateScalar, type ToolState } from '$lib/domain/lesson';
  import {
    amountAt,
    bondEnergyBalance,
    electronMultipliers,
    extentMax,
    reactionYield,
  } from '$lib/domain/lessonTools';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { fmt } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'reaction' }>;
  interface Props {
    tool: Tool;
    tstate: ToolState;
    interactive?: boolean;
  }
  let { tool, tstate, interactive = false }: Props = $props();

  const reactants = $derived(
    tool.reactants.map((s) => ({
      ...s,
      initial: Math.max(0, evaluateScalar(s.initial, tstate.params)),
    }))
  );
  const products = $derived(
    tool.products.map((s) => ({
      ...s,
      initial: Math.max(0, evaluateScalar(s.initial, tstate.params)),
    }))
  );
  const result = $derived(extentMax(reactants));
  const authoredExtent = $derived(
    tool.extent !== undefined
      ? Math.max(0, Math.min(result.xmax, evaluateScalar(tool.extent, tstate.params)))
      : result.xmax
  );
  let x = $state(0);
  $effect(() => {
    if (!interactive) x = authoredExtent;
  });
  const extent = $derived(Math.max(0, Math.min(result.xmax, x)));
  const rows = $derived([
    { key: 'initial', label: t('lesson.reaction.initial'), x: 0 },
    { key: 'during', label: t('lesson.reaction.during'), x: extent },
    { key: 'final', label: t('lesson.reaction.final'), x: result.xmax },
  ]);
  const f = (v: number) => fmt(v, locale.current, 2);
  const term = (s: { coefficient: number; formula: string }) =>
    `${s.coefficient > 1 ? s.coefficient + ' ' : ''}${s.formula}`;
  const equation = $derived(
    `${tool.reactants.map(term).join(' + ')} → ${tool.products.map(term).join(' + ')}`
  );
  const scaleMax = $derived(
    Math.max(
      1e-9,
      ...reactants.map((s) => s.initial),
      ...products.map((s) => s.initial + s.coefficient * result.xmax)
    )
  );
  const stoichiometric = $derived(result.limiting.length === reactants.length);
  /** Yield of a synthesis: the amount of the first product obtained over the amount x_max allows. */
  const synthesis = $derived.by(() => {
    if (tool.obtained === undefined || products.length === 0) return null;
    const obtained = Math.max(0, evaluateScalar(tool.obtained, tstate.params));
    const maximum = amountAt(products[0], result.xmax, 'product');
    return { product: products[0], obtained, maximum, yield: reactionYield(obtained, maximum) };
  });
  /** Molar reaction energy from the bond energies (positive: endothermic). */
  const energy = $derived(tool.bonds.length ? bondEnergyBalance(tool.bonds) : null);
  const electronsText = (n: number) => `${n > 1 ? n + ' ' : ''}e⁻`;
  /** A side of a half-equation multiplied by k: `Ag⁺ + 2 H⁺` × 2 → `2 Ag⁺ + 4 H⁺`. */
  function scaleSide(side: string, k: number): string {
    if (k <= 1) return side;
    return side
      .split(' + ')
      .map((term) => {
        const m = /^(\d+)\s+(.+)$/.exec(term.trim());
        return m ? `${Number(m[1]) * k} ${m[2]}` : `${k} ${term.trim()}`;
      })
      .join(' + ');
  }
  /** The two half-equations with their electron multipliers, and the overall equation. */
  const redox = $derived.by(() => {
    if (tool.halfEquations.length !== 2) return null;
    const [h1, h2] = tool.halfEquations;
    const [k1, k2] = electronMultipliers(h1.electrons, h2.electrons);
    const halves = [
      { ...h1, k: k1 },
      { ...h2, k: k2 },
    ].map((h) => ({
      ...h,
      text:
        h.role === 'oxidation'
          ? `${h.left} = ${h.right} + ${electronsText(h.electrons)}`
          : `${h.left} + ${electronsText(h.electrons)} = ${h.right}`,
    }));
    return {
      halves,
      electrons: k1 * h1.electrons,
      overall: `${scaleSide(h1.left, k1)} + ${scaleSide(h2.left, k2)} → ${scaleSide(h1.right, k1)} + ${scaleSide(h2.right, k2)}`,
    };
  });
</script>

<div class="tool stack-sm" data-testid="reaction-tool" data-extent={f(extent)}>
  <p style="margin: 0"><strong>{t('lesson.reaction.equation')}</strong> : {equation}</p>
  <div class="scroll-x">
    <table class="extent">
      <thead>
        <tr>
          <th>{t('lesson.reaction.state')}</th>
          <th>{t('lesson.reaction.extent')}</th>
          {#each reactants as s (s.id)}<th>{s.formula}</th>{/each}
          {#each products as s (s.id)}<th>{s.formula}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row (row.key)}
          <tr class:extent__current={row.key === 'during'}>
            <td>{row.label}</td>
            <td
              >{row.key === 'initial'
                ? '0'
                : row.key === 'final'
                  ? `x_max = ${f(result.xmax)}`
                  : `x = ${f(row.x)}`}</td
            >
            {#each reactants as s (s.id)}<td>{f(amountAt(s, row.x, 'reactant'))}</td>{/each}
            {#each products as s (s.id)}<td>{f(amountAt(s, row.x, 'product'))}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="bars" role="img" aria-label={t('lesson.reaction.amounts')}>
    {#each [...reactants.map( (s) => ({ s, role: 'reactant' as const }) ), ...products.map( (s) => ({ s, role: 'product' as const }) )] as { s, role } (s.id)}
      {@const n = amountAt(s, extent, role)}
      <div class="bar">
        <div
          class="bar__fill"
          style="height: {Math.max(2, (n / scaleMax) * 100)}%; background: {role === 'reactant'
            ? '#ffb347'
            : '#5ee6a8'}"
        ></div>
        <span class="bar__label small">{s.formula}<br />{f(n)} {tool.unit}</span>
      </div>
    {/each}
  </div>
  <p class="small" style="margin: 0" data-testid="reaction-reading">
    {t('lesson.reaction.xmax')} = {f(result.xmax)}
    {tool.unit} ·
    {#if stoichiometric}{t('lesson.reaction.stoichiometric')}{:else}
      {t('lesson.reaction.limiting')} : {result.limiting
        .map((i) => (reactants[i]?.label ? L(reactants[i].label!) : reactants[i]?.formula))
        .join(', ')}{/if}
  </p>
  {#if synthesis}
    <p class="small" style="margin: 0" data-testid="reaction-yield">
      {t('lesson.reaction.obtained')}
      {synthesis.product.formula} = {f(synthesis.obtained)} / {f(synthesis.maximum)}
      {tool.unit} · {t('lesson.reaction.yield')} η = {fmt(synthesis.yield * 100, locale.current, 1)} %
    </p>
  {/if}
  {#if energy !== null}
    <div class="scroll-x">
      <table class="extent" data-testid="reaction-bonds">
        <thead>
          <tr>
            <th>{t('lesson.reaction.bonds')}</th>
            <th>kJ/mol</th>
            <th>{t('lesson.reaction.broken')}</th>
            <th>{t('lesson.reaction.formed')}</th>
          </tr>
        </thead>
        <tbody>
          {#each tool.bonds as b (b.id)}
            <tr>
              <td>{b.label}</td>
              <td>{fmt(b.energy, locale.current, 0)}</td>
              <td>{b.broken}</td>
              <td>{b.formed}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="small" style="margin: 0" data-testid="reaction-energy">
      {t('lesson.reaction.energy')} E<sub>r</sub> = {energy > 0 ? '+' : ''}{fmt(
        energy,
        locale.current,
        0
      )} kJ/mol
      {#if energy < 0}· {t('lesson.reaction.exothermic')}{:else if energy > 0}· {t(
          'lesson.reaction.endothermic'
        )}{/if}
    </p>
  {/if}
  {#if redox}
    <div class="small halves" data-testid="reaction-half-equations">
      <p style="margin: 0"><strong>{t('lesson.reaction.halfEquations')}</strong></p>
      <ul>
        {#each redox.halves as h (h.id)}
          <li>
            <span class="muted"
              >{t(
                h.role === 'oxidation' ? 'lesson.reaction.oxidation' : 'lesson.reaction.reduction'
              )}</span
            >
            :
            {#if h.k > 1}<strong>×{h.k}</strong>{/if}
            {h.text}
          </li>
        {/each}
      </ul>
      <p style="margin: 0">
        {t('lesson.reaction.electrons')} : {redox.electrons} · {t('lesson.reaction.overall')} :
        <strong>{redox.overall}</strong>
      </p>
    </div>
  {/if}
  {#if interactive}
    <label class="field">
      <span class="label">{t('lesson.reaction.extent')} = {f(extent)} {tool.unit}</span>
      <input
        type="range"
        min="0"
        max={result.xmax}
        step={result.xmax / 50 || 0.01}
        bind:value={x}
        data-testid="reaction-extent"
      />
    </label>
  {/if}
</div>

<style>
  .extent {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  .extent th,
  .extent td {
    text-align: left;
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .extent__current td {
    background: rgba(127, 156, 255, 0.12);
  }
  .bars {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    height: 120px;
    padding: 6px;
    background: #070b17;
    border-radius: var(--radius);
  }
  .bar {
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    gap: 0.2rem;
  }
  .bar__fill {
    width: 60%;
    border-radius: 3px 3px 0 0;
    transition: height 0.2s ease;
  }
  .bar__label {
    text-align: center;
    color: #a7b0c8;
    line-height: 1.1;
  }
  .halves ul {
    margin: 0.25rem 0;
    padding-left: 1.2rem;
  }
</style>
