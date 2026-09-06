<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import { divisors, factorisationText, isPrime, primesUpTo } from '$lib/domain/lessonTools';
  import { t } from '$lib/state/locale.svelte';

  type Tool = Extract<LessonTool, { kind: 'arithmetic' }>;
  interface Props {
    tool: Tool;
    interactive?: boolean;
  }
  let { tool, interactive = false }: Props = $props();

  let number = $state(0);
  let k = $state(0);
  let showPrimes = $state(true);
  $effect(() => {
    // The authored values return whenever the learner cannot handle the tool.
    if (!interactive) {
      number = tool.number;
      k = tool.highlight;
      showPrimes = true;
    }
  });
  const cells = $derived(Array.from({ length: tool.max }, (_, i) => i + 1));
  const primes = $derived(new Set(primesUpTo(tool.max)));
  const columns = 10;
  const safeNumber = $derived(Number.isInteger(number) && number >= 1 ? number : tool.number);
  const list = $derived(divisors(safeNumber));
</script>

<div class="tool stack-sm" data-testid="arithmetic-tool" data-number={safeNumber}>
  <div
    class="sieve"
    style="grid-template-columns: repeat({columns}, 1fr)"
    role="img"
    aria-label={t('lesson.arith.multiples', { k })}
  >
    {#each cells as n (n)}
      <span
        class="cell"
        class:cell--multiple={n % k === 0}
        class:cell--prime={showPrimes && primes.has(n)}
        class:cell--selected={n === safeNumber}
        title={String(n)}>{n}</span
      >
    {/each}
  </div>
  <p class="small muted legend" style="margin: 0">
    <span class="swatch swatch--multiple"></span>{t('lesson.arith.multiples', { k })}
    {#if showPrimes}<span class="swatch swatch--prime"></span>{t('lesson.arith.primes')}{/if}
    <span class="swatch swatch--selected"></span>{safeNumber}
  </p>
  {#if interactive}
    <div class="cluster" data-testid="arithmetic-controls">
      <label class="field">
        <span class="label">{t('lesson.arith.number')}</span>
        <input
          class="input"
          type="number"
          min="1"
          max="100000"
          step="1"
          bind:value={number}
          data-testid="arithmetic-number"
        />
      </label>
      <label class="field">
        <span class="label">{t('lesson.arith.highlight')} k = {k}</span>
        <input type="range" min="2" max="20" step="1" bind:value={k} />
      </label>
      <label class="small"
        ><input type="checkbox" bind:checked={showPrimes} /> {t('lesson.arith.primes')}</label
      >
    </div>
  {/if}
  <p style="margin: 0" data-testid="arithmetic-reading" aria-live="polite">
    <strong>{safeNumber}</strong> : {safeNumber % 2 === 0
      ? t('lesson.arith.even')
      : t('lesson.arith.odd')},
    {isPrime(safeNumber) ? t('lesson.arith.prime') : t('lesson.arith.notPrime')} ·
    {t('lesson.arith.divisors')} : {list.join(', ')} ({list.length}) ·
    {t('lesson.arith.factorisation')} : {factorisationText(safeNumber)}
  </p>
</div>

<style>
  .sieve {
    display: grid;
    gap: 3px;
    background: #070b17;
    padding: 6px;
    border-radius: var(--radius);
  }
  .cell {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    font-size: 0.75rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.05);
    color: #a7b0c8;
    border: 1px solid transparent;
  }
  .cell--multiple {
    background: rgba(127, 156, 255, 0.35);
    color: #fff;
  }
  .cell--prime {
    border-color: #5ee6a8;
  }
  .cell--selected {
    background: #ffd166;
    color: #0b1020;
    font-weight: 700;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    align-items: center;
  }
  .swatch {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 3px;
    margin-right: 0.3rem;
    vertical-align: middle;
  }
  .swatch--multiple {
    background: rgba(127, 156, 255, 0.6);
  }
  .swatch--prime {
    border: 1px solid #5ee6a8;
  }
  .swatch--selected {
    background: #ffd166;
  }
</style>
