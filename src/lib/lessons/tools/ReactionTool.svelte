<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { evaluateScalar, type ToolState } from '$lib/domain/lesson';
  import { amountAt, extentMax } from '$lib/domain/lessonTools';
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
</style>
