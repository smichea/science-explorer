<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import NodeChip from '$lib/components/NodeChip.svelte';
  import { content } from '$lib/state/content.svelte';
  import { L, t } from '$lib/state/locale.svelte';

  const graph = $derived(content.graph!);
  const region = $derived(graph.getRegion(page.params.regionId ?? ''));
  const world = $derived(region?.worldId ? graph.getWorld(region.worldId) : undefined);
  const nodes = $derived(region ? graph.nodesOfRegion(region.id) : []);
</script>

{#if region}
  <div class="stack" data-testid="region-panel">
    <p class="badge">{region.isBridge ? t('type.bridge') : t('type.region')}</p>
    <h1 style="font-size: var(--fs-xl)">{L(region.title)}</h1>
    {#if world}<p class="small"><a href="{base}/world/{world.id}" style="color: {world.color}">{L(world.title)}</a></p>{/if}
    <p>{L(region.summary)}</p>
    <h2 style="font-size: var(--fs-lg)">{t('region.destinations')}</h2>
    {#if nodes.length === 0}
      <p class="muted">{t('region.empty')}</p>
    {:else}
      <ul class="nodes">
        {#each nodes as node (node.id)}
          <li><NodeChip {node} showType /></li>
        {/each}
      </ul>
    {/if}
    <a class="btn btn--ghost btn--sm" href="{base}/universe">{t('common.back')}</a>
  </div>
{:else}
  <p>{t('common.notFound')}</p>
{/if}

<style>
  .nodes {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
</style>
