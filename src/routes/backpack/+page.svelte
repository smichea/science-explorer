<script lang="ts">
  import { base } from '$app/paths';
  import NodeChip from '$lib/components/NodeChip.svelte';
  import { formatDate, formatPercent } from '$lib/domain/i18n/format';
  import {
    COVERAGE_ALGORITHM,
    MASTERY_ALGORITHM,
    MASTERY_DIMENSIONS,
  } from '$lib/domain/progression';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  const tools = $derived(graph.graph.nodes.filter((n) => n.backpack));
  const firstMission = $derived(graph.graph.nodes.find((n) => n.type === 'mission'));
  const horizon = $derived(profile.horizon(pkg.horizon));

  function scopeLabel(stages: string[]): string {
    return stages
      .map((id) => L(pkg.horizon.stages.find((s) => s.id === id)?.short) || id)
      .join(' + ');
  }
  function when(iso: string | undefined): string {
    if (!iso) return t('backpack.neverUsed');
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return t('common.today');
    if (days < 14) return t('common.daysAgo', { n: days });
    return t('common.weeksAgo', { n: Math.floor(days / 7) });
  }
</script>

<svelte:head>
  <title>{t('backpack.title')} · {t('app.name')}</title>
</svelte:head>

<div
  class="container stack"
  style="padding: var(--space-5) 0 var(--space-7)"
  data-testid="backpack"
>
  <h1>{t('backpack.title')}</h1>
  <p class="muted">{t('backpack.intro')}</p>
  {#if horizon}<p class="small">
      <span class="badge">{t('backpack.scope', { scope: scopeLabel(horizon.stages) })}</span>
    </p>{/if}

  {#each tools as tool (tool.id)}
    {@const state = learning.snapshot?.nodeStates.get(tool.id)}
    {@const coverage = learning.snapshot?.coverage.get(tool.id)}
    {@const discovered = !!state && state.status !== 'unknown' && state.status !== 'seen'}
    <article
      class="card tool"
      class:tool--undiscovered={!discovered}
      data-testid="backpack-tool"
      data-tool-id={tool.id}
    >
      <header class="cluster" style="justify-content: space-between">
        <div>
          <h2 style="margin: 0">
            <span aria-hidden="true">🧰</span>
            <a href="{base}/concept/{tool.id}">{L(tool.title)}</a>
          </h2>
          <p class="muted small" style="margin: 0">{L(tool.shortPurpose)}</p>
        </div>
        {#if discovered && state}
          <span class="badge">{t(`state.${state.status}`)}</span>
        {:else}
          <span class="badge">{t('backpack.notDiscovered')}</span>
        {/if}
      </header>

      {#if !discovered}
        <p class="muted">{t('backpack.empty')}</p>
        {#if firstMission}<a
            class="btn btn--sm btn--primary"
            href="{base}/mission/{firstMission.id}">{t('recommend.startFirstMission')}</a
          >{/if}
      {:else if state && coverage}
        <div class="tool__indicators">
          <section class="indicator" data-testid="coverage">
            <h3>{t('backpack.coverage')}</h3>
            <p class="indicator__headline">
              <strong>{coverage.appliedCount} / {coverage.eligibleCount}</strong> — {formatPercent(
                coverage.estimate,
                locale.current
              )}
            </p>
            <div class="progress" aria-hidden="true">
              <span style="width: {coverage.estimate * 100}%"></span>
            </div>
            <p class="small muted">
              {t('backpack.coverageDetail', {
                applied: coverage.appliedCount,
                eligible: coverage.eligibleCount,
              })}<br />{t('backpack.coverageWeighted', {
                pct: formatPercent(coverage.estimate, locale.current),
              })}<br />{t('backpack.scope', { scope: scopeLabel(coverage.scope) })}
            </p>
          </section>
          <section class="indicator" data-testid="mastery">
            <h3>{t('backpack.mastery')}</h3>
            <p class="indicator__headline">
              <strong>{formatPercent(state.mastery.estimate, locale.current)}</strong> · {t(
                'backpack.confidence',
                { label: t(`backpack.confidence.${state.mastery.confidenceLabel}`) }
              )}
            </p>
            <ul class="dims">
              {#each MASTERY_DIMENSIONS as d (d)}
                <li>
                  <span class="dims__label">{t(`backpack.dim.${d}`)}</span>
                  <span class="progress dims__bar" aria-hidden="true"
                    ><span style="width: {state.mastery.dimensions[d] * 100}%"></span></span
                  >
                  <span class="dims__value"
                    >{formatPercent(state.mastery.dimensions[d], locale.current)}</span
                  >
                </li>
              {/each}
            </ul>
            <p class="small muted">
              {t('backpack.lastUse', { when: when(state.lastIndependentUseAt) })} · {t(
                'backpack.evidenceCount',
                { n: state.mastery.evidenceCount }
              )}<br />
              {state.reviewRecommended ? t('backpack.review') : t('backpack.noReview')} · {t(
                'backpack.depthsVisited',
                {
                  depths:
                    state.highestDepthVisited > 0
                      ? Array.from({ length: state.highestDepthVisited }, (_, i) => i + 1).join(
                          ', '
                        )
                      : t('backpack.noDepth'),
                }
              )}
            </p>
          </section>
        </div>

        <div class="tool__apps">
          <section>
            <h3>{t('backpack.known')}</h3>
            <ul class="apps">
              {#each coverage.applications.filter((a) => a.value >= 0.4) as a (a.phenomenonId)}
                {@const p = graph.getNode(a.phenomenonId)}
                {#if p}<li>
                    <NodeChip node={p} />
                    <span class="muted small"
                      >{t(`backpack.state.${a.state}`)}{a.lastAt
                        ? ` · ${formatDate(a.lastAt, locale.current)}`
                        : ''}</span
                    >
                  </li>{/if}
              {:else}
                <li class="muted small">{t('common.none')}</li>
              {/each}
            </ul>
          </section>
          <section>
            <h3>{t('backpack.unexplored')}</h3>
            <ul class="apps">
              {#each coverage.applications.filter((a) => a.value < 0.4) as a (a.phenomenonId)}
                {@const p = graph.getNode(a.phenomenonId)}
                {#if p}<li>
                    <NodeChip node={p} />
                    <span class="muted small"
                      >{a.value > 0
                        ? t(`backpack.state.${a.state}`)
                        : t('backpack.state.not_encountered')}</span
                    >
                  </li>{/if}
              {:else}
                <li class="muted small">{t('common.none')}</li>
              {/each}
            </ul>
          </section>
        </div>

        <div class="cluster">
          <a
            class="btn btn--sm btn--primary"
            href="{base}/concept/{tool.id}?layer=applications&tool={tool.id}"
            data-testid="show-on-map">{t('backpack.showOnMap')}</a
          >
          {#each graph.getHistoricalMissions(tool.id) as m (m.id)}
            <a class="btn btn--sm" href="{base}/mission/{m.id}">{L(m.title)}</a>
          {/each}
        </div>
        <details>
          <summary class="small">{t('backpack.explain')}</summary>
          <p class="small muted">{t('backpack.explainCoverage')}</p>
          <p class="small muted">{t('backpack.explainMastery')}</p>
          <p class="small muted">
            {t('backpack.algorithm', { coverage: COVERAGE_ALGORITHM, mastery: MASTERY_ALGORITHM })}
          </p>
        </details>
      {/if}
    </article>
  {/each}
</div>

<style>
  .tool {
    display: grid;
    gap: var(--space-3);
  }
  .tool--undiscovered {
    opacity: 0.85;
  }
  .tool h2 a {
    color: var(--text);
    text-decoration: none;
  }
  .tool__indicators,
  .tool__apps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
    gap: var(--space-3);
  }
  .indicator {
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--bg-elev);
  }
  .indicator h3 {
    font-size: var(--fs-base);
    margin-bottom: var(--space-1);
  }
  .indicator__headline {
    font-size: var(--fs-lg);
    margin: 0 0 var(--space-2);
  }
  .dims {
    list-style: none;
    padding: 0;
    margin: var(--space-2) 0;
    display: grid;
    gap: 0.35rem;
  }
  .dims li {
    display: grid;
    grid-template-columns: minmax(8rem, 1.2fr) 2fr auto;
    gap: var(--space-2);
    align-items: center;
    font-size: var(--fs-sm);
  }
  .dims__bar {
    display: block;
  }
  .dims__value {
    font-variant-numeric: tabular-nums;
    min-width: 3rem;
    text-align: right;
  }
  .apps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }
  @media (max-width: 480px) {
    .dims li {
      grid-template-columns: 1fr auto;
    }
    .dims__bar {
      grid-column: 1 / -1;
    }
  }
</style>
