<script lang="ts">
  import type { EvidenceStatus } from '$lib/content-schema';
  import { t } from '$lib/state/locale.svelte';

  let { status, compact = false }: { status: EvidenceStatus; compact?: boolean } = $props();

  const ICONS: Record<EvidenceStatus, string> = {
    attested: '✓',
    scholarly_interpretation: '§',
    pedagogical_reconstruction: '✎',
    narrative_fiction: '❝',
  };
</script>

<span class="evidence evidence--{status}" title={t(`evidence.${status}.help`)}>
  <span class="evidence__icon" aria-hidden="true">{ICONS[status]}</span>
  <span class:visually-hidden={compact}>{t(`evidence.${status}`)}</span>
</span>

<style>
  .evidence {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.05rem 0.5rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid currentColor;
    vertical-align: middle;
  }
  .evidence--attested {
    color: #2c9a6a;
  }
  .evidence--scholarly_interpretation {
    color: #2f6fc9;
  }
  .evidence--pedagogical_reconstruction {
    color: #b9761a;
  }
  .evidence--narrative_fiction {
    color: #b23b6b;
  }
  .evidence__icon {
    font-weight: 700;
  }
</style>
