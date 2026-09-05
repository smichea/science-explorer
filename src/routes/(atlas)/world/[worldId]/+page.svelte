<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import NodeChip from '$lib/components/NodeChip.svelte';
  import { content } from '$lib/state/content.svelte';
  import { L, t } from '$lib/state/locale.svelte';

  const graph = $derived(content.graph!);
  const world = $derived(graph.getWorld(page.params.worldId ?? ''));
</script>

{#if world}
  <div class="stack" data-testid="world-panel">
    <p class="badge">{t('type.world')}</p>
    <h1 style="font-size: var(--fs-xl); color: {world.color}">{L(world.title)}</h1>
    <p>{L(world.purpose)}</p>
    <h2 style="font-size: var(--fs-lg)">{t('world.regions')}</h2>
    <ul class="regions">
      {#each world.regionIds as rid (rid)}
        {@const region = graph.getRegion(rid)}
        {#if region}
          {@const nodes = graph.nodesOfRegion(rid)}
          <li class="card">
            <a href="{base}/region/{rid}"><strong>{L(region.title)}</strong></a>
            <p class="muted small" style="margin: 0.2rem 0">{L(region.summary)}</p>
            {#if nodes.length}
              <div class="cluster">
                {#each nodes as node (node.id)}<NodeChip {node} />{/each}
              </div>
            {:else}
              <span class="badge">{t('state.silhouette')}</span>
            {/if}
          </li>
        {/if}
      {/each}
    </ul>
    <a class="btn btn--ghost btn--sm" href="{base}/universe">{t('common.back')}</a>
  </div>
{:else}
  <p>{t('common.notFound')}</p>
{/if}

<style>
  .regions {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  .regions a {
    color: var(--text);
    text-decoration: none;
  }
</style>
