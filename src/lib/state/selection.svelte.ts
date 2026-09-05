import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { page } from '$app/state';
import { MAP_FILTERS, MAP_LAYERS, type MapFilter, type MapLayer } from '$lib/domain/horizon';
import { prefs } from './prefs.svelte';

export type MapView = '3d' | '2d' | 'list';

/**
 * The URL is the selection: /concept/:id, /region/:id, /world/:id select; `layer`, `filter`,
 * `tool` and `view` search parameters are preserved across navigation so deep links stay complete.
 */
class SelectionState {
  hoveredId = $state<string | null>(null);

  get selectedId(): string | null {
    return page.params.conceptId ?? null;
  }
  get regionId(): string | null {
    return page.params.regionId ?? null;
  }
  get worldId(): string | null {
    return page.params.worldId ?? null;
  }
  get layer(): MapLayer {
    const v = page.url.searchParams.get('layer');
    return MAP_LAYERS.includes(v as MapLayer) ? (v as MapLayer) : 'concepts';
  }
  get filter(): MapFilter {
    const v = page.url.searchParams.get('filter');
    return MAP_FILTERS.includes(v as MapFilter) ? (v as MapFilter) : 'my_horizon';
  }
  get toolId(): string | null {
    return page.url.searchParams.get('tool');
  }
  get view(): MapView {
    const v = page.url.searchParams.get('view');
    if (v === '3d' || v === '2d' || v === 'list') return v;
    if (prefs.performanceMode === '2d') return '2d';
    return prefs.prefs.mapView;
  }

  private navigate(pathname: string, params: Record<string, string | null>) {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a throwaway URL, not reactive state
    const url = new URL(page.url);
    url.pathname = pathname;
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === '') url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    }
    return goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
  }

  selectNode(id: string | null) {
    return this.navigate(id ? `${base}/concept/${id}` : `${base}/universe`, {});
  }
  selectRegion(id: string) {
    return this.navigate(`${base}/region/${id}`, {});
  }
  selectWorld(id: string) {
    return this.navigate(`${base}/world/${id}`, {});
  }
  setLayer(layer: MapLayer, toolId?: string | null) {
    return this.navigate(page.url.pathname, {
      layer: layer === 'concepts' ? null : layer,
      tool: toolId === undefined ? this.toolId : toolId,
    });
  }
  setFilter(filter: MapFilter) {
    return this.navigate(page.url.pathname, { filter: filter === 'my_horizon' ? null : filter });
  }
  setView(view: MapView) {
    prefs.update({ mapView: view === 'list' ? prefs.prefs.mapView : view });
    return this.navigate(page.url.pathname, { view });
  }
}

export const selection = new SelectionState();
