<script lang="ts">
  import { base } from '$app/paths';
  import NodeChip from '$lib/components/NodeChip.svelte';
  import { formatHistoricalDate } from '$lib/domain/i18n/format';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, locale, t } from '$lib/state/locale.svelte';

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  const items = $derived.by(() => {
    const rows = [
      ...pkg.missions.map((m) => ({
        kind: 'mission' as const,
        id: m.id,
        title: L(m.title),
        date: m.historicalContext.date,
        from: m.historicalContext.date.from ?? '',
        people: m.historicalContext.people,
        places: m.historicalContext.places,
      })),
      ...graph.graph.nodes
        .filter((n) => n.period)
        .map((n) => ({
          kind: 'period' as const,
          id: n.id,
          title: L(n.title),
          date: n.period!.date,
          from: n.period!.date.from ?? '',
          people: n.period!.people,
          places: n.period!.places,
        })),
      ...graph.graph.nodes
        .filter((n) => n.person?.born)
        .map((n) => ({
          kind: 'person' as const,
          id: n.id,
          title: L(n.title),
          date: n.person!.born!,
          from: n.person!.born!.from ?? '',
          people: [],
          places: n.person!.places,
        })),
    ];
    return rows.sort((a, b) => a.from.localeCompare(b.from));
  });
</script>

<svelte:head>
  <title>{t('timeline.title')} · {t('app.name')}</title>
</svelte:head>

<div class="container container--narrow stack" style="padding: var(--space-5) 0 var(--space-7)">
  <h1>{t('timeline.title')}</h1>
  <p class="muted">{t('timeline.intro')}</p>
  <ol class="timeline">
    {#each items as item (item.id)}
      <li class="timeline__item card">
        <div class="timeline__date">
          {formatHistoricalDate(item.date, locale.current)}
          <span class="muted small">({t(`certainty.${item.date.certainty}`)})</span>
        </div>
        <div class="stack-sm">
          <strong
            ><span class="badge">{t(`type.${item.kind}`)}</span>
            <a href="{base}/concept/{item.id}">{item.title}</a></strong
          >
          <div class="cluster">
            {#each [...item.places, ...item.people] as id (id)}
              {@const n = graph.getNode(id)}
              {#if n}<NodeChip node={n} />{/if}
            {/each}
          </div>
          {#if item.kind === 'mission'}
            <a class="btn btn--sm btn--primary" href="{base}/mission/{item.id}"
              >{learning.sessionFor(item.id) ? t('concept.resumeMission') : t('timeline.open')}</a
            >
          {/if}
        </div>
      </li>
    {/each}
  </ol>
</div>

<style>
  .timeline {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-3);
  }
  .timeline__item {
    display: grid;
    grid-template-columns: minmax(7rem, 10rem) 1fr;
    gap: var(--space-3);
  }
  .timeline__date {
    font-weight: 700;
  }
  .timeline__item a {
    color: var(--text);
  }
  @media (max-width: 600px) {
    .timeline__item {
      grid-template-columns: 1fr;
    }
  }
</style>
