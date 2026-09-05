<script lang="ts">
  import { renderRichText } from './richtext';

  let { text, class: className = '' }: { text: string | undefined; class?: string } = $props();
  const html = $derived(renderRichText(text));
</script>

<!-- The HTML comes from renderRichText, which sanitises the Markdown output with DOMPurify. -->
<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<div class="rich {className}">{@html html}</div>
