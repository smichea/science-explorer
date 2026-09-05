<script lang="ts">
  import { base } from '$app/paths';
  import type { CompiledNode } from '$lib/content-schema';
  import { STATE_GLYPH } from '$lib/atlas/styles';
  import { learning } from '$lib/state/learning.svelte';
  import { L, t } from '$lib/state/locale.svelte';

  let { node, showType = false }: { node: CompiledNode; showType?: boolean } = $props();
  const state = $derived(learning.destination(node));
  const href = $derived(`${base}/concept/${node.id}`);
  const cls = $derived(
    node.world === 'world.mathematics'
      ? 'chip--math'
      : node.world === 'world.physics'
        ? 'chip--physics'
        : node.world === 'world.chemistry'
          ? 'chip--chemistry'
          : 'chip--bridge'
  );
</script>

<a class="chip {cls}" {href} title={state ? t(`state.${state.kind}`) : undefined}>
  {#if state?.kind && STATE_GLYPH[state.kind]}<span aria-hidden="true"
      >{STATE_GLYPH[state.kind]}</span
    >{/if}
  <span>{L(node.title)}</span>
  {#if showType}<span class="muted">· {t(`type.${node.type}`)}</span>{/if}
  {#if state}<span class="visually-hidden">— {t(`state.${state.kind}`)}</span>{/if}
</a>
