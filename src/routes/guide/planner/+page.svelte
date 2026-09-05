<script lang="ts">
  import { base } from '$app/paths';
  import NodeChip from '$lib/components/NodeChip.svelte';
  import StateBadge from '$lib/components/StateBadge.svelte';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  const saved = $derived(
    (profile.settings?.savedForLater ?? []).map((id) => graph.getNode(id)).filter((n) => !!n)
  );
</script>

<svelte:head>
  <title>{t('guide.planner')} · {t('app.name')}</title>
</svelte:head>

<div class="stack" data-testid="guide-planner">
  <p class="muted">{t('guide.plannerIntro')}</p>
  {#if saved.length}
    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('state.saved')}</h2>
      <div class="cluster">
        {#each saved as n (n.id)}<NodeChip node={n} showType />{/each}
      </div>
    </section>
  {/if}
  {#each pkg.routes as route (route.id)}
    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg); margin:0">
        {L(route.title)} <span class="badge">{route.kind}</span>
      </h2>
      <p class="muted small" style="margin:0">{L(route.summary)}</p>
      <ol class="route">
        {#each route.nodes as id (id)}
          {@const node = graph.getNode(id)}
          {#if node}
            {@const d = learning.destination(node)}
            <li>
              <NodeChip {node} showType />
              {#if d}<StateBadge kind={d.kind} />{/if}
              {#if node.type === 'mission'}<a class="btn btn--sm" href="{base}/mission/{node.id}"
                  >{t('common.open')}</a
                >{/if}
            </li>
          {/if}
        {/each}
      </ol>
    </section>
  {/each}
</div>

<style>
  .route {
    padding-left: 1.2rem;
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }
  .route li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
</style>
