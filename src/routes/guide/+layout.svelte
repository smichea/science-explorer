<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { guide } from '$lib/state/guide.svelte';
  import { t } from '$lib/state/locale.svelte';

  let { children } = $props();
  let pin = $state('');
  let wrong = $state(false);

  async function unlock(event: SubmitEvent) {
    event.preventDefault();
    wrong = !(await guide.unlock(pin));
    pin = '';
  }
  const path = $derived(page.url.pathname.slice(base.length));
</script>

<div class="container stack" style="padding: var(--space-5) 0 var(--space-7)" data-testid="guide">
  <header class="cluster" style="justify-content: space-between">
    <div>
      <h1 style="margin:0">{t('guide.title')}</h1>
      <p class="muted small" style="margin:0">{t('guide.intro')}</p>
    </div>
    {#if guide.unlocked}
      <nav class="segmented" aria-label={t('guide.title')}>
        <a
          class="seg-link"
          href="{base}/guide/progress"
          aria-current={path.startsWith('/guide/progress') ? 'page' : undefined}
          >{t('guide.progress')}</a
        >
        <a
          class="seg-link"
          href="{base}/guide/planner"
          aria-current={path.startsWith('/guide/planner') ? 'page' : undefined}
          >{t('guide.planner')}</a
        >
        {#if guide.hasPin}<button type="button" onclick={() => guide.lock()}
            >{t('guide.lock')}</button
          >{/if}
      </nav>
    {/if}
  </header>
  {#if guide.unlocked}
    {@render children()}
  {:else}
    <form
      class="card stack-sm"
      onsubmit={unlock}
      style="max-width: 24rem"
      data-testid="guide-unlock"
    >
      <label class="field">
        <span class="label">{t('guide.unlock')}</span>
        <input
          class="input"
          type="password"
          inputmode="numeric"
          bind:value={pin}
          autocomplete="off"
          data-testid="guide-pin"
        />
      </label>
      {#if wrong}<p class="error" role="alert">{t('guide.wrongPin')}</p>{/if}
      <button class="btn btn--primary btn--sm" type="submit">{t('guide.unlockButton')}</button>
    </form>
  {/if}
</div>

<style>
  .seg-link {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 0.35rem 0.9rem;
    color: var(--muted);
    text-decoration: none;
  }
  .seg-link[aria-current='page'] {
    background: var(--accent);
    color: #0b1020;
    font-weight: 700;
  }
</style>
