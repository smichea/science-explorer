<script lang="ts">
  import { base } from '$app/paths';
  import NodeChip from '$lib/components/NodeChip.svelte';
  import { recommend } from '$lib/domain/progression/recommend';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';
  import { tour } from '$lib/state/tour.svelte';

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  const horizon = $derived(profile.horizon(pkg.horizon));
  const recommendations = $derived(
    recommend(
      graph,
      learning.snapshot,
      pkg.routes,
      4,
      horizon ? { horizon, config: pkg.horizon } : undefined
    )
  );
  const plannedStops = $derived.by(() => {
    void learning.snapshot;
    return tour.plannedStops();
  });
  const discovered = $derived(
    [...(learning.snapshot?.nodeStates.values() ?? [])].filter(
      (s) => s.status !== 'unknown' && s.status !== 'seen'
    ).length
  );

  function stageTitle(id: string): string {
    const s = pkg.horizon.stages.find((x) => x.id === id);
    return s ? L(s.short) : id;
  }
</script>

<div class="stack" data-testid="universe-panel">
  <h1 style="font-size: var(--fs-xl)">{t('universe.title')}</h1>
  <p class="muted">{t('app.tagline')}</p>

  {#if horizon}
    <p class="small">
      <span class="badge">{t('horizon.band.current')}</span>
      {horizon.stages.map(stageTitle).join(' → ')}
    </p>
  {/if}

  {#if pkg.tours.length}
    <div class="card card--paper stack-sm">
      <p style="margin: 0"><strong>🕊 {t('tour.title')}</strong></p>
      <p class="small muted" style="margin: 0">{t('tour.intro')}</p>
      <button
        class="btn btn--primary"
        type="button"
        data-testid="tour-start-panel"
        onclick={() => tour.start()}
      >
        {t('tour.start')} · {t('tour.startCount', { n: plannedStops })}
      </button>
    </div>
  {/if}

  <div class="legend card">
    <h2 class="small muted" style="margin-bottom: var(--space-2)">{t('universe.legend')}</h2>
    <ul class="legend__list">
      {#each graph.graph.worlds as world (world.id)}
        <li>
          <span class="legend__dot" style="background: {world.color}"></span>
          <a href="{base}/world/{world.id}">{L(world.title)}</a>
        </li>
      {/each}
      <li><span class="legend__dot" style="background: #f7f1e3"></span> {t('universe.bridges')}</li>
      <li><span class="legend__dot" style="background: #ff8fab"></span> {t('type.mission')}</li>
      <li><span class="legend__dot" style="background: #ffd166"></span> {t('layer.history')}</li>
    </ul>
    <p class="muted small" style="margin: var(--space-2) 0 0">
      {t('universe.destinations', { n: graph.graph.nodes.length })} · {t('state.discovered')} : {discovered}
    </p>
  </div>

  <section class="stack-sm">
    <h2 style="font-size: var(--fs-lg)">{t('recommend.title')}</h2>
    {#each recommendations as rec (rec.kind + rec.node.id)}
      <div class="card stack-sm">
        <p class="small muted" style="margin: 0">{t(`recommend.${rec.kind}`)}</p>
        <div class="cluster">
          <NodeChip node={rec.node} showType />
          {#if rec.via}<span class="muted small">← {L(rec.via.title)}</span>{/if}
        </div>
        {#if rec.node.type === 'mission'}
          <a class="btn btn--primary btn--sm" href="{base}/mission/{rec.node.id}"
            >{t('concept.startMission')}</a
          >
        {/if}
      </div>
    {/each}
  </section>

  <section class="stack-sm">
    <h2 style="font-size: var(--fs-lg)">{t('concept.routes')}</h2>
    {#each pkg.routes as route (route.id)}
      <details class="card">
        <summary>{L(route.title)}</summary>
        <p class="muted small">{L(route.summary)}</p>
        <div class="cluster">
          {#each route.nodes as id (id)}
            {@const node = graph.getNode(id)}
            {#if node}<NodeChip {node} />{/if}
          {/each}
        </div>
      </details>
    {/each}
  </section>
</div>

<style>
  .legend__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.3rem;
  }
  .legend__list a {
    color: var(--text);
  }
  .legend__dot {
    display: inline-block;
    width: 0.8em;
    height: 0.8em;
    border-radius: 50%;
    margin-right: 0.3rem;
    vertical-align: middle;
  }
</style>
