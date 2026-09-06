<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import Markdown from '$lib/components/Markdown.svelte';
  import { L, t } from '$lib/state/locale.svelte';
  import { speech } from '$lib/state/speech.svelte';
  import { tour } from '$lib/state/tour.svelte';

  const step = $derived(tour.current);
  const position = $derived(tour.index + 1);
  const total = $derived(tour.total);
  let heading = $state<HTMLElement | null>(null);

  // Keyboard users land on the card when the flight starts or the step changes.
  $effect(() => {
    void tour.tick;
    heading?.focus({ preventScroll: true });
  });

  function openLesson(id: string) {
    tour.exit();
    void goto(`${base}/concept/${id}`);
  }
</script>

<div
  class="stack tour"
  data-testid="tour-card"
  data-step-kind={step?.kind}
  data-step-index={tour.index}
  aria-label={t('tour.title')}
>
  <p class="small muted" style="margin: 0">
    <span class="badge">🕊 {t('tour.title')}</span>
    {t('tour.step', { n: position, total })}
  </p>
  <div class="progress" aria-hidden="true">
    <span style="width: {total ? (position / total) * 100 : 0}%"></span>
  </div>

  {#if step?.kind === 'intro' || step?.kind === 'outro'}
    <h1 class="tour__title" tabindex="-1" bind:this={heading}>{L(step.title)}</h1>
    <p class="lead">{L(step.text)}</p>
    {#if tour.stops === 0}<p class="small" role="status">{t('tour.nothingLeft')}</p>{/if}
    {#if step.kind === 'outro'}
      <p class="small muted" data-testid="tour-finished">{t('tour.finished', { n: tour.stops })}</p>
    {/if}
  {:else if step?.kind === 'leg'}
    <p class="small muted" style="margin: 0">{t('tour.leg')}</p>
    <h1 class="tour__title" tabindex="-1" bind:this={heading}>{L(step.title)}</h1>
    <p class="lead" data-testid="tour-transition">{L(step.text)}</p>
    <p class="small muted">{t('tour.legCount', { n: step.nodeIds.length })}</p>
  {:else if step?.kind === 'stop'}
    <p class="small muted" style="margin: 0">
      {L(step.legTitle)} · {step.indexInLeg + 1} / {step.legCount}
    </p>
    <h1 class="tour__title" tabindex="-1" bind:this={heading}>{L(step.node.title)}</h1>
    <p class="small muted" style="margin: 0">
      {t(`type.${step.node.type}`)}
      {#if step.status === 'practised' || step.status === 'mastered'}
        <span class="badge">{t('tour.alreadyPractised')}</span>
      {/if}
    </p>
    <Markdown text={L(step.text)} class="tour__excerpt" />
    <a
      class="btn btn--sm"
      href="{base}/concept/{step.node.id}"
      data-testid="tour-open"
      onclick={(e) => {
        e.preventDefault();
        openLesson(step.node.id);
      }}>{t('tour.openLesson')}</a
    >
  {/if}

  <div class="cluster tour__controls" role="group" aria-label={t('tour.title')}>
    <button
      class="btn btn--sm btn--icon"
      type="button"
      data-testid="tour-prev"
      disabled={tour.index === 0}
      aria-label={t('tour.prev')}
      title={t('tour.prev')}
      onclick={() => tour.prev()}>⏮</button
    >
    <button
      class="btn btn--sm btn--primary"
      type="button"
      data-testid="tour-toggle"
      onclick={() => tour.togglePause()}
    >
      {tour.status === 'playing' ? `⏸ ${t('tour.pause')}` : `▶ ${t('tour.resume')}`}
    </button>
    <button
      class="btn btn--sm btn--icon"
      type="button"
      data-testid="tour-next"
      disabled={tour.index >= total - 1}
      aria-label={t('tour.next')}
      title={t('tour.next')}
      onclick={() => tour.next()}>⏭</button
    >
    <button
      class="btn btn--sm btn--ghost"
      type="button"
      data-testid="tour-voice"
      aria-pressed={tour.voiceOn}
      disabled={!speech.available}
      onclick={() => tour.setVoice(!tour.voiceOn)}
    >
      {tour.voiceOn ? '🔊' : '🔇'}
      {t('tour.voice')}
    </button>
    <button
      class="btn btn--sm btn--ghost"
      type="button"
      data-testid="tour-exit"
      onclick={() => tour.exit()}>{t('tour.exit')}</button
    >
  </div>
  {#if !speech.available}<p class="small muted" style="margin: 0">{t('tour.noVoice')}</p>{/if}
  <label class="small tour__option">
    <input
      type="checkbox"
      checked={tour.includeDone}
      data-testid="tour-include-done"
      onchange={(e) => tour.setIncludeDone(e.currentTarget.checked)}
    />
    {t('tour.includeDone')}
  </label>
</div>

<style>
  .tour__title {
    font-size: var(--fs-xl);
    margin: 0;
  }
  .tour__title:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }
  .tour__controls {
    position: sticky;
    bottom: 0;
    padding: var(--space-2) 0;
    background: rgba(19, 26, 48, 0.96);
  }
  .tour__option {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
</style>
