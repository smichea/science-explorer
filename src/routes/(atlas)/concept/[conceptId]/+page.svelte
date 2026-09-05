<script lang="ts">
  import { page } from '$app/state';
  import ConceptPanel from '$lib/components/ConceptPanel.svelte';
  import { content } from '$lib/state/content.svelte';
  import { t } from '$lib/state/locale.svelte';

  const graph = $derived(content.graph!);
  const node = $derived(graph.getNode(page.params.conceptId ?? ''));
</script>

{#if node}
  {#key node.id}
    <ConceptPanel {node} />
  {/key}
{:else}
  <div class="stack">
    <h1 style="font-size: var(--fs-xl)">{t('common.notFound')}</h1>
    <p class="muted">{t('common.notFoundHelp')}</p>
  </div>
{/if}
