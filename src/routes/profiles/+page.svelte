<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import LocaleSwitch from '$lib/components/LocaleSwitch.svelte';
  import { t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';
  import { learning } from '$lib/state/learning.svelte';

  async function open(id: string) {
    await profile.open(id);
    await learning.bind(id);
    await goto(`${base}/universe`);
  }

  async function remove(id: string, name: string) {
    if (!confirm(t('profiles.deleteConfirm', { name }))) return;
    await profile.remove(id);
  }
</script>

<svelte:head>
  <title>{t('profiles.title')} · {t('app.name')}</title>
</svelte:head>

<div class="container container--narrow stack" style="padding: calc(var(--space-6) + var(--safe-top)) 0 var(--space-7)">
  <div class="cluster" style="justify-content: space-between">
    <h1 style="margin:0">{t('profiles.title')}</h1>
    <LocaleSwitch compact />
  </div>
  {#if profile.summaries.length === 0}
    <p class="muted">{t('profiles.empty')}</p>
  {:else}
    <ul class="list">
      {#each profile.summaries as s (s.id)}
        <li class="card cluster" style="justify-content: space-between">
          <div>
            <strong>{s.name}</strong> · {s.age}
            {#if profile.active?.id === s.id}<span class="badge">{t('profiles.active')}</span>{/if}
          </div>
          <div class="cluster">
            <button class="btn btn--sm btn--primary" type="button" onclick={() => open(s.id)}>{t('profiles.open')}</button>
            <button class="btn btn--sm btn--danger" type="button" onclick={() => remove(s.id, s.name)}>{t('profiles.delete')}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  <div class="cluster">
    <a class="btn" href="{base}/welcome?new=1">{t('profiles.new')}</a>
    {#if profile.active}<a class="btn btn--ghost" href="{base}/universe">{t('returning.map')}</a>{/if}
  </div>
</div>

<style>
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-3);
  }
</style>
