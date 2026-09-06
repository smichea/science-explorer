<script lang="ts">
  import type { CompiledNode } from '$lib/content-schema';
  import Markdown from '$lib/components/Markdown.svelte';
  import NodeChip from '$lib/components/NodeChip.svelte';
  import { content } from '$lib/state/content.svelte';
  import { L, LL, t } from '$lib/state/locale.svelte';

  /** The right-hand panel of a lesson without a tool: what the destination is for and unlocks. */
  let { node, depth }: { node: CompiledNode; depth: number } = $props();

  const graph = $derived(content.graph!);
  const depthInfo = $derived(node.depths.find((d) => d.depth === depth) ?? node.depths[0]);
  const prerequisites = $derived(graph.prerequisitesOf(node.id));
  const dependents = $derived(graph.dependentsOf(node.id));
</script>

<div class="card stack-sm" data-testid="lesson-board">
  <p class="small muted" style="margin: 0">{t('lesson.board.purpose')}</p>
  <p class="lead" style="margin: 0">{L(node.shortPurpose)}</p>
  {#if depthInfo}
    <p class="small muted" style="margin: 0">{t('lesson.board.outcomes')}</p>
    <ul class="board__list">
      {#each LL(depthInfo.outcomes) as outcome (outcome)}
        <li><Markdown text={outcome} /></li>
      {/each}
    </ul>
  {/if}
  {#if prerequisites.essential.length || prerequisites.recommended.length}
    <p class="small muted" style="margin: 0">{t('concept.prerequisites')}</p>
    <div class="cluster">
      {#each [...prerequisites.essential, ...prerequisites.recommended] as p (p.id)}
        <NodeChip node={p} />
      {/each}
    </div>
  {/if}
  {#if dependents.length}
    <p class="small muted" style="margin: 0">{t('concept.related')}</p>
    <div class="cluster">
      {#each dependents as d (d.id)}<NodeChip node={d} />{/each}
    </div>
  {/if}
</div>

<style>
  .board__list {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.35rem;
  }
</style>
