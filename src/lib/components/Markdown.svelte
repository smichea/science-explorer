<script lang="ts">
  import { renderRichText } from './richtext';

  let { text, class: className = '' }: { text: string | undefined; class?: string } = $props();
  const html = $derived(renderRichText(text));
</script>

<div class="rich {className}">{@html html}</div>
