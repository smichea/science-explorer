<script lang="ts">
  import type { CompiledNode } from '$lib/content-schema';
  import type { GraphIndex } from '$lib/domain/graph';
  import type { NodeStyle } from './styles';
  import { t } from '$lib/state/locale.svelte';

  interface Props {
    graph: GraphIndex;
    styles: Map<string, NodeStyle>;
    selectedId: string | null;
    labelText: (id: string, kind: 'node' | 'region' | 'world' | 'hub') => string;
    stateLabel: (id: string) => string;
    href: (id: string, kind: 'node' | 'region' | 'world') => string;
    query?: string;
  }

  let { graph, styles, selectedId, labelText, stateLabel, href, query = '' }: Props = $props();

  function matches(node: CompiledNode): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return labelText(node.id, 'node').toLowerCase().includes(q);
  }

  const groups = $derived.by(() => {
    const out: Array<{ id: string; kind: 'world' | 'hub'; title: string; regions: Array<{ id: string; title: string; silhouette: boolean; nodes: CompiledNode[] }> }> = [];
    for (const world of graph.graph.worlds) {
      out.push({
        id: world.id,
        kind: 'world',
        title: labelText(world.id, 'world'),
        regions: world.regionIds.map((rid) => ({ id: rid, title: labelText(rid, 'region'), silhouette: graph.nodesOfRegion(rid).length === 0, nodes: graph.nodesOfRegion(rid).filter(matches) })),
      });
    }
    out.push({
      id: 'hub',
      kind: 'hub',
      title: labelText('hub', 'hub'),
      regions: graph.graph.regions.filter((r) => r.isBridge).map((r) => ({ id: r.id, title: labelText(r.id, 'region'), silhouette: graph.nodesOfRegion(r.id).length === 0, nodes: graph.nodesOfRegion(r.id).filter(matches) })),
    });
    return out;
  });

  const history = $derived(graph.graph.nodes.filter((n) => !n.region && (n.type === 'mission' || n.type === 'person' || n.type === 'place' || n.type === 'period' || n.type === 'question')).filter(matches));
</script>

<nav class="dlist" aria-label={t('universe.viewList')} data-testid="destination-list">
  {#each groups as group (group.id)}
    <section class="dlist__world">
      <h2>
        {#if group.kind === 'world'}<a href={href(group.id, 'world')}>{group.title}</a>{:else}{group.title}{/if}
      </h2>
      {#each group.regions as region (region.id)}
        <details open={!region.silhouette}>
          <summary>
            <a href={href(region.id, 'region')}>{region.title}</a>
            {#if region.silhouette}<span class="badge">{t('state.silhouette')}</span>{/if}
          </summary>
          {#if region.silhouette}
            <p class="muted small">{t('universe.silhouette')}</p>
          {:else}
            <ul>
              {#each region.nodes as node (node.id)}
                {@const style = styles.get(node.id)}
                <li>
                  <a href={href(node.id, 'node')} aria-current={node.id === selectedId ? 'page' : undefined} data-node-id={node.id}>
                    <span class="dlist__glyph" aria-hidden="true">{style?.glyph ?? ''}</span>
                    <span>{labelText(node.id, 'node')}</span>
                    <span class="badge">{stateLabel(node.id)}</span>
                    <span class="muted small">{t(`type.${node.type}`)}</span>
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </details>
      {/each}
    </section>
  {/each}
  {#if history.length}
    <section class="dlist__world">
      <h2>{t('layer.history')}</h2>
      <ul>
        {#each history as node (node.id)}
          {@const style = styles.get(node.id)}
          <li>
            <a href={href(node.id, 'node')} aria-current={node.id === selectedId ? 'page' : undefined} data-node-id={node.id}>
              <span class="dlist__glyph" aria-hidden="true">{style?.glyph ?? ''}</span>
              <span>{labelText(node.id, 'node')}</span>
              <span class="badge">{stateLabel(node.id)}</span>
              <span class="muted small">{t(`type.${node.type}`)}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</nav>

<style>
  .dlist {
    height: 100%;
    overflow: auto;
    padding: var(--space-4);
    display: grid;
    gap: var(--space-4);
    align-content: start;
  }
  .dlist__world h2 {
    font-size: var(--fs-lg);
    margin-bottom: var(--space-2);
  }
  .dlist__world h2 a {
    color: var(--text);
    text-decoration: none;
  }
  details {
    margin: 0 0 var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  summary a {
    color: var(--text);
    text-decoration: none;
    font-weight: 600;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: var(--space-2) 0 0;
    display: grid;
    gap: 0.25rem;
  }
  li a {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0.35rem 0.5rem;
    border-radius: var(--radius-sm);
    color: var(--text);
    text-decoration: none;
  }
  li a:hover,
  li a[aria-current='page'] {
    background: var(--surface-2);
  }
  .dlist__glyph {
    width: 1.2em;
    text-align: center;
    color: var(--accent-2);
  }
</style>
