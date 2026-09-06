<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { combineDimensions, dimensionText, sameDimensions } from '$lib/domain/lesson';
  import { L, t } from '$lib/state/locale.svelte';

  type Tool = Extract<LessonTool, { kind: 'dimensions' }>;
  interface Props {
    tool: Tool;
    interactive?: boolean;
  }
  let { tool, interactive = false }: Props = $props();

  const bases = $derived(tool.quantities.filter((q) => q.base));
  const targets = $derived(tool.quantities.filter((q) => !q.base));
  let exponents = $state<Record<string, number>>({});
  let targetId = $state<string | null>(null);
  const target = $derived(targets.find((q) => q.id === targetId) ?? targets[0] ?? null);
  const built = $derived(combineDimensions(tool.quantities, exponents));
  const homogeneous = $derived(target ? sameDimensions(built, target.dims) : false);
  const builtText = $derived(
    bases
      .filter((q) => (exponents[q.id] ?? 0) !== 0)
      .map((q) => ((exponents[q.id] ?? 0) === 1 ? q.symbol : `${q.symbol}^${exponents[q.id]}`))
      .join(' · ')
  );
  function bump(id: string, delta: number) {
    exponents = { ...exponents, [id]: Math.max(-3, Math.min(3, (exponents[id] ?? 0) + delta)) };
  }
  $effect(() => {
    if (!interactive) exponents = {};
  });
  // The first derived quantity is proposed until the learner picks another one.
  $effect(() => {
    if (!targetId && targets[0]) targetId = targets[0].id;
  });
</script>

<div class="tool stack-sm" data-testid="dimensions-tool">
  <div class="scroll-x">
    <table class="dims">
      <thead>
        <tr
          ><th>{t('lesson.dims.quantity')}</th><th>{t('lesson.dims.dimension')}</th><th
            >{t('lesson.dims.unit')}</th
          ></tr
        >
      </thead>
      <tbody>
        {#each tool.quantities as q (q.id)}
          <tr class:dims__target={q.id === target?.id}>
            <td><strong>{q.symbol}</strong> · {L(q.label)}</td>
            <td><code>{dimensionText(q.dims)}</code></td>
            <td>{q.unit}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if interactive && targets.length}
    <div class="stack-sm" data-testid="dimensions-builder">
      <label class="field">
        <span class="label">{t('lesson.dims.target')}</span>
        <select class="input" bind:value={targetId}>
          {#each targets as q (q.id)}<option value={q.id}>{q.symbol} · {L(q.label)}</option>{/each}
        </select>
      </label>
      <div class="cluster small">
        {#each bases as q (q.id)}
          <span class="chip dims__chip">
            <button
              type="button"
              class="dims__bump"
              aria-label="{q.symbol} −1"
              onclick={() => bump(q.id, -1)}>−</button
            >
            <strong>{q.symbol}</strong><sup>{exponents[q.id] ?? 0}</sup>
            <button
              type="button"
              class="dims__bump"
              aria-label="{q.symbol} +1"
              onclick={() => bump(q.id, 1)}>+</button
            >
          </span>
        {/each}
      </div>
      <p style="margin: 0" data-testid="dimensions-result">
        {builtText || '1'} → <code>{dimensionText(built)}</code>
        {#if target}
          · {target.symbol} : <code>{dimensionText(target.dims)}</code>
          <strong class:ok={homogeneous} class:ko={!homogeneous}
            >{homogeneous ? t('lesson.dims.ok') : t('lesson.dims.ko')}</strong
          >
        {/if}
      </p>
    </div>
  {/if}
</div>

<style>
  .dims {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  .dims th,
  .dims td {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--border);
  }
  .dims__target td {
    background: rgba(127, 156, 255, 0.12);
  }
  .dims__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .dims__bump {
    border: 1px solid var(--border-strong);
    background: transparent;
    color: inherit;
    border-radius: 999px;
    width: 1.5rem;
    height: 1.5rem;
    cursor: pointer;
  }
  .ok {
    color: #5ee6a8;
  }
  .ko {
    color: #ff8fab;
  }
</style>
