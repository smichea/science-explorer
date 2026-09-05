<script lang="ts">
  import { page } from '$app/state';
  import MissionPlayer from '$lib/missions/MissionPlayer.svelte';
  import { content } from '$lib/state/content.svelte';
  import { L, t } from '$lib/state/locale.svelte';

  const graph = $derived(content.graph!);
  const mission = $derived(graph.getMission(page.params.missionId ?? ''));
  const guide = $derived(page.url.searchParams.get('guide') === '1');
</script>

<svelte:head>
  <title>{mission ? L(mission.title) : t('mission.notFound')} · {t('app.name')}</title>
</svelte:head>

<div class="container" style="padding-top: var(--space-4)">
  {#if mission}
    {#key mission.id}
      <MissionPlayer {mission} {guide} />
    {/key}
  {:else}
    <h1>{t('mission.notFound')}</h1>
  {/if}
</div>
