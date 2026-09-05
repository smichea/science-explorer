<script lang="ts">
  import { renderTex } from './richtext';

  let { tex, display = false }: { tex: string; display?: boolean } = $props();
  const html = $derived(renderTex(tex, display));
</script>

<span class="katex-wrap" class:katex-block={display}>{@html html}</span>

<style>
  .katex-block {
    display: block;
    overflow-x: auto;
    padding: 0.2rem 0;
  }
</style>
