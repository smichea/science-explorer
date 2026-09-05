<script lang="ts">
  import type { Locale } from '$lib/content-schema';
  import { locale, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';

  let { compact = false }: { compact?: boolean } = $props();

  function choose(next: Locale) {
    locale.set(next);
    void profile.setLocale(next);
  }
</script>

<div class="segmented" role="group" aria-label={t('locale.switch')}>
  <button
    type="button"
    aria-pressed={locale.current === 'fr'}
    onclick={() => choose('fr')}
    lang="fr"
  >
    {compact ? 'FR' : t('locale.fr')}
  </button>
  <button
    type="button"
    aria-pressed={locale.current === 'en'}
    onclick={() => choose('en')}
    lang="en"
  >
    {compact ? 'EN' : t('locale.en')}
  </button>
</div>
