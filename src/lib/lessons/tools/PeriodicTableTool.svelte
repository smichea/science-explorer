<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import {
    ELEMENTS,
    decay,
    electronConfiguration,
    elementOf,
    nucleusSymbol,
    stableIon,
    valenceElectrons,
    type DecayKind,
    type ElementFamily,
  } from '$lib/domain/lessonTools';
  import { L, t } from '$lib/state/locale.svelte';

  type Tool = Extract<LessonTool, { kind: 'periodic_table' }>;
  interface Props {
    tool: Tool;
    interactive?: boolean;
  }
  let { tool, interactive = false }: Props = $props();

  let selected = $state(1);
  let mode = $state<'table' | 'nucleus'>('table');
  let a = $state(12);
  let z = $state(6);
  let history = $state<
    Array<{ from: { a: number; z: number }; kind: DecayKind; to: { a: number; z: number } }>
  >([]);
  $effect(() => {
    if (!interactive) {
      selected = tool.selected;
      mode = tool.mode;
      a = tool.nucleus.a;
      z = tool.nucleus.z;
      history = [];
    }
  });
  const shown = $derived(ELEMENTS.filter((e) => e.z <= tool.max));
  const element = $derived(elementOf(selected));
  const COLORS: Record<ElementFamily, string> = {
    alkali: '#ff8fab',
    alkaline_earth: '#ffb347',
    transition: '#b39dff',
    post_transition: '#a7b0c8',
    metalloid: '#5ee6a8',
    nonmetal: '#7f9cff',
    halogen: '#ffd166',
    noble_gas: '#f7f1e3',
  };
  const families = $derived([...new Set(shown.map((e) => e.family))]);
  const symbolOf = (zz: number) => nucleusSymbol(zz);
  function applyDecay(kind: DecayKind) {
    const to = decay(a, z, kind);
    if (to.a < 1 || to.z < 1 || to.z > to.a) return;
    history = [...history, { from: { a, z }, kind, to }];
    a = to.a;
    z = to.z;
  }
  const particle: Record<DecayKind, string> = {
    alpha: '⁴₂He',
    beta_minus: '⁰₋₁e',
    beta_plus: '⁰₁e',
  };
</script>

<div
  class="tool stack-sm"
  data-testid="periodic-table-tool"
  data-selected={selected}
  data-mode={mode}
>
  {#if interactive}
    <div class="segmented" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'table'}
        onclick={() => (mode = 'table')}>{t('lesson.ptable.table')}</button
      >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'nucleus'}
        onclick={() => (mode = 'nucleus')}>{t('lesson.ptable.nucleus')}</button
      >
    </div>
  {/if}
  {#if mode === 'table'}
    <div class="table" role="grid" aria-label={t('lesson.tool.periodic_table')}>
      {#each shown as e (e.z)}
        <button
          type="button"
          class="element"
          class:element--selected={e.z === selected}
          style="grid-column: {e.group}; grid-row: {e.period}; --family: {COLORS[e.family]}"
          disabled={!interactive}
          onclick={() => (selected = e.z)}
          data-testid="element-{e.symbol}"
          aria-label="{e.symbol} {L(e.name)} Z = {e.z}"
        >
          <span class="element__z">{e.z}</span>
          <span class="element__symbol">{e.symbol}</span>
        </button>
      {/each}
    </div>
    <p class="small muted legend" style="margin: 0">
      {#each families as fam (fam)}<span
          ><span class="swatch" style="background: {COLORS[fam]}"></span>{t(
            `lesson.ptable.family.${fam}`
          )}</span
        >{/each}
    </p>
    {#if element}
      <div class="card stack-sm" data-testid="element-info">
        <p style="margin: 0">
          <strong style="font-size: var(--fs-lg)">{element.symbol}</strong> · {L(element.name)} · Z =
          {element.z} · A = {element.a} ·
          {t('lesson.ptable.period')}
          {element.period}, {t('lesson.ptable.group')}
          {element.group}
        </p>
        <p style="margin: 0">
          {t('lesson.ptable.configuration')} : <code>{electronConfiguration(element.z)}</code> · {t(
            'lesson.ptable.valence'
          )} : {valenceElectrons(element.z)}
        </p>
        <p style="margin: 0">
          {t('lesson.ptable.family')} : {t(`lesson.ptable.family.${element.family}`)} · {t(
            'lesson.ptable.ion'
          )} : {stableIon(element.z) ?? t('lesson.ptable.none')}
        </p>
      </div>
    {/if}
    {#if interactive}<p class="small muted" style="margin: 0">{t('lesson.ptable.select')}</p>{/if}
  {:else}
    <div class="card stack-sm" data-testid="nucleus-panel">
      <p style="margin: 0; font-size: var(--fs-lg)">
        <sup>{a}</sup><sub>{z}</sub><strong>{symbolOf(z)}</strong>
      </p>
      <p style="margin: 0">
        {t('lesson.ptable.protons')} : {z} · {t('lesson.ptable.neutrons')} : {a - z} · {t(
          'lesson.ptable.electrons'
        )} : {z}
      </p>
      {#if interactive}
        <label class="field">
          <span class="label">{t('lesson.ptable.massNumber')} = {a}</span>
          <input type="range" min={z} max="240" step="1" bind:value={a} data-testid="nucleus-a" />
        </label>
        <label class="field">
          <span class="label">{t('lesson.ptable.atomicNumber')} = {z}</span>
          <input
            type="range"
            min="1"
            max={Math.min(a, 100)}
            step="1"
            bind:value={z}
            data-testid="nucleus-z"
          />
        </label>
        <div class="cluster">
          {#each ['alpha', 'beta_minus', 'beta_plus'] as const as kind (kind)}
            <button
              class="btn btn--sm"
              type="button"
              onclick={() => applyDecay(kind)}
              data-testid="decay-{kind}">{t(`lesson.ptable.decay.${kind}`)}</button
            >
          {/each}
        </div>
      {/if}
      {#each history as step, i (i)}
        <p class="small" style="margin: 0">
          <sup>{step.from.a}</sup><sub>{step.from.z}</sub>{symbolOf(step.from.z)} →
          <sup>{step.to.a}</sup><sub>{step.to.z}</sub>{symbolOf(step.to.z)} + {particle[step.kind]}
          ({t('lesson.ptable.daughter')} : {symbolOf(step.to.z)})
        </p>
      {/each}
    </div>
  {/if}
</div>

<style>
  .table {
    display: grid;
    grid-template-columns: repeat(18, 1fr);
    gap: 2px;
    background: #070b17;
    padding: 6px;
    border-radius: var(--radius);
  }
  .element {
    display: grid;
    gap: 0;
    padding: 2px 0;
    border: 1px solid var(--family);
    border-radius: 4px;
    background: color-mix(in srgb, var(--family) 22%, transparent);
    color: #eef1f8;
    font-family: inherit;
    cursor: pointer;
    min-width: 0;
  }
  .element:disabled {
    cursor: default;
  }
  .element--selected {
    background: var(--family);
    color: #0b1020;
  }
  .element__z {
    font-size: 0.55rem;
    line-height: 1;
  }
  .element__symbol {
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1.1;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.8rem;
  }
  .swatch {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 3px;
    margin-right: 0.3rem;
    vertical-align: middle;
  }
</style>
