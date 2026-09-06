<script lang="ts">
  import { page } from '$app/state';
  import LessonPlayer from '$lib/lessons/LessonPlayer.svelte';
  import { lessonFor } from '$lib/domain/lesson';
  import { content } from '$lib/state/content.svelte';
  import { L, t } from '$lib/state/locale.svelte';

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  const node = $derived(graph.getNode(page.params.nodeId ?? ''));
  const depth = $derived(Number(page.url.searchParams.get('depth')) || 1);
  const plan = $derived(
    node && node.type !== 'mission' ? lessonFor(node, pkg.lessons, pkg.exercises, depth) : null
  );
</script>

<svelte:head>
  <title>{plan ? L(plan.node.title) : t('common.notFound')} · {t('app.name')}</title>
</svelte:head>

<div class="container" style="padding-top: var(--space-4)">
  {#if plan}
    {#key plan.id}
      <LessonPlayer {plan} />
    {/key}
  {:else}
    <h1>{t('common.notFound')}</h1>
    <p class="muted">{t('common.notFoundHelp')}</p>
  {/if}
</div>
