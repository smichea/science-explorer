<script lang="ts">
  import { STATE_GLYPH } from '$lib/atlas/styles';
  import type { DestinationStateKind } from '$lib/domain/progression/destination';
  import { t } from '$lib/state/locale.svelte';

  let { kind }: { kind: DestinationStateKind } = $props();
</script>

<span class="state state--{kind}"
  ><span aria-hidden="true">{STATE_GLYPH[kind]}</span> {t(`state.${kind}`)}</span
>

<style>
  .state {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: var(--fs-sm);
    font-weight: 600;
    background: var(--bg-elev);
    border: 1px solid var(--border-strong);
  }
  .state--mastered {
    border-color: #ffd166;
  }
  .state--practised {
    border-color: #7f9cff;
  }
  .state--in_progress {
    border-color: #5ee6a8;
  }
  .state--due_for_review {
    border-color: #ff8fab;
  }
  .state--missing_essential {
    border-color: #ff6b6b;
  }
</style>
