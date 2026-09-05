<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import Atlas from '$lib/atlas/Atlas.svelte';
  import DestinationList from '$lib/atlas/DestinationList.svelte';
  import Map2D from '$lib/atlas/Map2D.svelte';
  import type { FocusTarget } from '$lib/atlas/scene';
  import { computeNodeStyles, computeRoutes, type NodeStyle, type StyleContext } from '$lib/atlas/styles';
  import { announcer } from '$lib/accessibility/announce.svelte';
  import { MAP_FILTERS, MAP_LAYERS } from '$lib/domain/horizon';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { prefs } from '$lib/state/prefs.svelte';
  import { selection } from '$lib/state/selection.svelte';

  let { children } = $props();

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);

  const styleCtx = $derived.by((): StyleContext | null => {
    const ctx = learning.destinationContext();
    if (!ctx) return null;
    return { ...ctx, filter: selection.filter, layer: selection.layer, selectedId: selection.selectedId, toolId: selection.toolId, locale: locale.current };
  });
  const styles = $derived(styleCtx ? computeNodeStyles(styleCtx) : new Map<string, NodeStyle>());
  const routes = $derived(styleCtx ? computeRoutes(styleCtx, learning.snapshot) : []);

  const focus = $derived.by((): FocusTarget => {
    if (selection.selectedId) return { kind: 'node', id: selection.selectedId };
    if (selection.regionId) return { kind: 'region', id: selection.regionId };
    if (selection.worldId) return { kind: 'world', id: selection.worldId };
    return { kind: 'universe' };
  });
  let focusKey = $state(0);

  const view = $derived(prefs.performanceMode === '2d' && selection.view === '3d' ? '2d' : selection.view);
  const hasPanel = $derived(!!(selection.selectedId || selection.regionId || selection.worldId) || page.url.pathname.endsWith('/universe'));
  let panelExpanded = $state(false);
  let hudOpen = $state(false);
  let query = $state('');
  let webglLost = $state(false);

  const results = $derived(query.trim().length >= 2 ? graph.searchText(query, locale.current, 8) : []);

  function labelText(id: string, kind: 'node' | 'region' | 'world' | 'hub'): string {
    if (kind === 'hub') return t('universe.bridges');
    if (kind === 'node') return L(graph.getNode(id)?.title);
    if (kind === 'region') return L(graph.getRegion(id)?.title);
    return L(graph.getWorld(id)?.title);
  }
  function stateLabel(id: string): string {
    const style = styles.get(id);
    return style ? t(`state.${style.kind}`) : t('state.unknown');
  }
  function href(id: string, kind: 'node' | 'region' | 'world'): string {
    return `${base}/${kind === 'node' ? 'concept' : kind}/${id}`;
  }
  function onselect(id: string, kind: 'node' | 'region' | 'world') {
    hudOpen = false;
    query = '';
    const name = labelText(id, kind);
    announcer.say(t('universe.selected', { title: name }));
    if (kind === 'node') void selection.selectNode(id);
    else if (kind === 'region') void selection.selectRegion(id);
    else void selection.selectWorld(id);
  }
  function overview() {
    void selection.selectNode(null);
    focusKey++;
  }
  function onContextLost() {
    webglLost = true;
    prefs.webglAvailable = false;
    void selection.setView('2d');
  }

  const stats = $derived({ nodes: graph.graph.nodes.length, regions: graph.graph.regions.length });
</script>

<svelte:head>
  <title>{t('universe.title')} · {t('app.name')}</title>
</svelte:head>

<div class="atlas-page" class:panel-open={hasPanel} class:panel-expanded={panelExpanded}>
  <div class="hud" class:hud--open={hudOpen}>
    <div class="hud__row">
      <label class="hud__search">
        <span class="visually-hidden">{t('universe.search')}</span>
        <input class="input" type="search" placeholder={t('universe.searchPlaceholder')} bind:value={query} autocomplete="off" data-testid="atlas-search" />
      </label>
      <button class="btn btn--sm only-phone" type="button" aria-expanded={hudOpen} onclick={() => (hudOpen = !hudOpen)}>☰ {t('universe.filters')}</button>
      <div class="hud__controls">
        <label class="hud__select">
          <span class="visually-hidden">{t('universe.filters')}</span>
          <select class="input" value={selection.filter} onchange={(e) => selection.setFilter(e.currentTarget.value as never)} data-testid="atlas-filter">
            {#each MAP_FILTERS as f (f)}<option value={f}>{t(`filter.${f}`)}</option>{/each}
          </select>
        </label>
        <label class="hud__select">
          <span class="visually-hidden">{t('universe.layers')}</span>
          <select class="input" value={selection.layer} onchange={(e) => selection.setLayer(e.currentTarget.value as never)} data-testid="atlas-layer">
            {#each MAP_LAYERS as l (l)}<option value={l}>{t(`layer.${l}`)}</option>{/each}
          </select>
        </label>
        <div class="segmented" role="group" aria-label={t('universe.view3d')}>
          <button type="button" aria-pressed={view === '3d'} disabled={prefs.performanceMode === '2d'} onclick={() => selection.setView('3d')}>{t('universe.view3d')}</button>
          <button type="button" aria-pressed={view === '2d'} onclick={() => selection.setView('2d')}>{t('universe.view2d')}</button>
          <button type="button" aria-pressed={view === 'list'} onclick={() => selection.setView('list')}>{t('universe.viewList')}</button>
        </div>
        <button class="btn btn--sm" type="button" onclick={overview}>{t('universe.overview')}</button>
      </div>
    </div>
    {#if results.length}
      <ul class="hud__results" role="listbox" aria-label={t('universe.search')}>
        {#each results as hit (hit.entry.id)}
          <li>
            <button type="button" role="option" aria-selected="false" onclick={() => onselect(hit.entry.target, hit.node ? 'node' : hit.region ? 'region' : 'world')}>
              <strong>{hit.entry.text}</strong>
              <span class="muted small">{hit.node ? t(`type.${hit.node.type}`) : hit.region ? t('type.region') : t('type.world')}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else if query.trim().length >= 2}
      <p class="hud__results muted small">{t('universe.noResult')}</p>
    {/if}
  </div>

  <div class="stage" data-view={view}>
    {#if view === '3d' && !webglLost}
      <Atlas
        {graph}
        layout={pkg.layout}
        {styles}
        {routes}
        {focus}
        {focusKey}
        locale={locale.current}
        performance={prefs.performanceMode}
        reducedMotion={prefs.reducedMotion}
        {labelText}
        {onselect}
        onhover={(id) => (selection.hoveredId = id)}
        oncontextlost={onContextLost}
      />
      <p class="stage__help muted small hide-phone">{t('universe.help')}</p>
    {:else if view === 'list'}
      <DestinationList {graph} {styles} selectedId={selection.selectedId} {labelText} {stateLabel} {href} {query} />
    {:else}
      {#if webglLost}<p class="stage__notice">{t('universe.webglUnavailable')}</p>{/if}
      <Map2D {graph} layout={pkg.layout} {styles} {routes} selectedId={selection.selectedId} focusId={focus.id ?? null} {labelText} {stateLabel} {href} {onselect} />
    {/if}
    <p class="visually-hidden">{t('universe.destinations', { n: stats.nodes })}</p>
  </div>

  {#if hasPanel}
    <aside class="panel" aria-label={t('concept.openPage')} data-testid="atlas-panel">
      <div class="panel__bar only-phone">
        <button class="panel__handle" type="button" aria-label={panelExpanded ? t('common.less') : t('common.more')} onclick={() => (panelExpanded = !panelExpanded)}></button>
      </div>
      <div class="panel__content">
        {@render children()}
      </div>
    </aside>
  {/if}
</div>

<style>
  .atlas-page {
    position: relative;
    height: calc(100dvh - var(--nav-height) - var(--safe-top));
    display: grid;
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr;
    overflow: hidden;
  }
  .hud {
    z-index: 5;
    padding: var(--space-2) var(--space-3);
    background: rgba(11, 16, 32, 0.75);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
  }
  .hud__row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .hud__search {
    flex: 1 1 14rem;
    min-width: 10rem;
  }
  .hud__controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .hud__select .input {
    min-width: 9rem;
  }
  .hud__results {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: grid;
    gap: 0.25rem;
    max-height: 40vh;
    overflow: auto;
  }
  .hud__results button {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
    text-align: left;
    min-height: 44px;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    cursor: pointer;
  }
  .stage {
    position: relative;
    min-height: 0;
    overflow: hidden;
  }
  .stage__help {
    position: absolute;
    left: var(--space-3);
    bottom: var(--space-2);
    margin: 0;
    pointer-events: none;
  }
  .stage__notice {
    position: absolute;
    top: var(--space-2);
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    margin: 0;
    padding: 0.3rem 0.8rem;
    border-radius: 999px;
    background: var(--warn);
    color: #000;
    font-size: var(--fs-sm);
  }
  .panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(30rem, 42vw);
    background: rgba(19, 26, 48, 0.96);
    border-left: 1px solid var(--border);
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    z-index: 6;
  }
  .panel__content {
    overflow: auto;
    padding: var(--space-4);
    flex: 1;
  }
  .panel-open .stage__help {
    right: min(30rem, 42vw);
  }
  @media (max-width: 1024px) {
    .panel {
      width: min(26rem, 50vw);
    }
  }
  @media (max-width: 700px) {
    .atlas-page {
      height: calc(100dvh - var(--nav-height) - var(--safe-bottom));
    }
    .hud__controls {
      display: none;
      width: 100%;
    }
    .hud--open .hud__controls {
      display: flex;
    }
    .panel {
      top: auto;
      left: 0;
      width: auto;
      height: 46%;
      border-left: 0;
      border-top: 1px solid var(--border-strong);
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      transition: height 0.25s ease;
    }
    .panel-expanded .panel {
      height: 100%;
      border-radius: 0;
    }
    .panel__bar {
      display: flex;
      justify-content: center;
      padding: var(--space-2) 0 0;
    }
    .panel__handle {
      width: 44px;
      height: 28px;
      border: 0;
      background: transparent;
      position: relative;
      cursor: pointer;
    }
    .panel__handle::after {
      content: '';
      position: absolute;
      left: 4px;
      right: 4px;
      top: 12px;
      height: 5px;
      border-radius: 3px;
      background: var(--border-strong);
    }
  }
</style>
