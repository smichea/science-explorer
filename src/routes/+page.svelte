<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { profile } from '$lib/state/profile.svelte';

  $effect(() => {
    void goto(profile.active ? `${base}/universe` : `${base}/welcome`, { replaceState: true });
  });
</script>
