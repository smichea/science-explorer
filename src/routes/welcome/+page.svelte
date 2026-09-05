<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import LocaleSwitch from '$lib/components/LocaleSwitch.svelte';
  import { inferHorizon } from '$lib/domain/horizon';
  import { validateProfileInput } from '$lib/domain/profile';
  import { content } from '$lib/state/content.svelte';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';
  import { learning } from '$lib/state/learning.svelte';

  const forceNew = $derived(page.url.searchParams.has('new'));
  let name = $state('');
  let ageText = $state('');
  let errors = $state<{ name?: boolean; age?: boolean }>({});
  let confirmed = $state(false);
  let ageUpdated = $state(false);
  let editingAge = $state(false);
  let newAge = $state('');

  const config = $derived(content.pkg?.horizon);
  const returning = $derived(!!profile.active && !forceNew && !confirmed);
  const preview = $derived.by(() => {
    if (!config) return null;
    const age = Number(ageText);
    if (!Number.isInteger(age)) return null;
    return inferHorizon(age, config);
  });

  function stageTitle(id: string): string {
    const s = config?.stages.find((x) => x.id === id);
    return s ? L(s.title) : id;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const check = validateProfileInput({ name, age: ageText });
    errors = check.errors;
    if (!check.ok || !config || !content.pkg) return;
    await profile.create({ name, age: Number(ageText), locale: locale.current }, config, content.pkg.manifest.version);
    confirmed = true;
  }

  function lastVisitedLabel(): string {
    const lv = profile.settings?.lastVisited;
    if (!lv || !content.graph) return t('returning.nothingYet');
    const node = content.graph.getNode(lv.id);
    return node ? L(node.title) : lv.id;
  }

  function resumeHref(): string {
    const lv = profile.settings?.lastVisited;
    if (!lv) return `${base}/universe`;
    return lv.kind === 'mission' ? `${base}/mission/${lv.id}` : `${base}/concept/${lv.id}`;
  }

  async function updateAge() {
    const age = Number(newAge);
    if (!config || !Number.isInteger(age) || age < 5 || age > 120) return;
    await profile.updateAge(age, config);
    editingAge = false;
    ageUpdated = true;
  }
</script>

<svelte:head>
  <title>{t('welcome.title')} · {t('app.name')}</title>
</svelte:head>

<div class="welcome">
  <div class="container container--narrow stack">
    <header class="welcome__head">
      <p class="welcome__brand"><span aria-hidden="true">✦</span> {t('app.name')}</p>
      <LocaleSwitch />
    </header>

    {#if confirmed && profile.active && config}
      {@const horizon = profile.horizon(config)}
      <section class="card card--paper stack" aria-labelledby="horizon-title" data-testid="horizon-confirmation">
        <h1 id="horizon-title">{t('horizon.title')}</h1>
        <p>{t('horizon.intro', { name: profile.active.name, age: profile.active.age, stage: stageTitle(profile.active.inferredStage), years: horizon?.horizonYears ?? 3 })}</p>
        <ol class="route" aria-label={t('horizon.title')}>
          {#each horizon?.stages ?? [] as stage, i (stage)}
            <li class="route__stage">
              <span class="route__when">{i === 0 ? t('horizon.now') : t('horizon.plusYears', { n: i })}</span>
              <strong class="route__name">{stageTitle(stage)}</strong>
            </li>
          {/each}
        </ol>
        {#if horizon?.targets.length}
          <p class="muted">{t('horizon.targets', { targets: horizon.targets.map((x) => L(x.title)).join(' · ') })}</p>
        {/if}
        <p><strong>{t('horizon.notRestriction')}</strong></p>
        {#if horizon?.note}<p class="muted">{L(horizon.note)}</p>{/if}
        <p class="muted small">{t('horizon.adjust')}</p>
        <div class="cluster">
          <a class="btn btn--primary" href="{base}/universe" data-testid="open-map">{t('horizon.confirm')}</a>
        </div>
      </section>
    {:else if returning && profile.active && config}
      {@const horizon = profile.horizon(config)}
      <section class="card card--paper stack" aria-labelledby="returning-title">
        <h1 id="returning-title">{t('returning.title', { name: profile.active.name })}</h1>
        <p>{t('returning.summary', { age: profile.active.age, path: (horizon?.stages ?? []).map(stageTitle).join(' → ') })}</p>
        <p class="muted">{t('returning.lastVisited', { what: lastVisitedLabel() })}</p>
        {#if profile.ageConfirmationDue(config) && !ageUpdated}
          <div class="age-check stack-sm">
            <p><strong>{t('returning.confirmAge', { age: profile.active.age })}</strong></p>
            {#if editingAge}
              <div class="cluster">
                <input class="input" style="max-width: 8rem" type="number" inputmode="numeric" min="5" max="120" bind:value={newAge} aria-label={t('welcome.age')} />
                <button class="btn" type="button" onclick={updateAge}>{t('common.save')}</button>
              </div>
            {:else}
              <div class="cluster">
                <button class="btn btn--sm" type="button" onclick={() => profile.confirmAge()}>{t('returning.confirmAgeYes')}</button>
                <button class="btn btn--sm btn--ghost" type="button" onclick={() => { editingAge = true; newAge = String(profile.active?.age ?? ''); }}>{t('returning.confirmAgeUpdate')}</button>
              </div>
            {/if}
          </div>
        {:else if ageUpdated}
          <p class="muted">{t('returning.ageUpdated')}</p>
        {/if}
        <div class="cluster">
          <a class="btn btn--primary" href={resumeHref()}>{t('returning.resume')}</a>
          <a class="btn" href="{base}/universe">{t('returning.map')}</a>
          <a class="btn btn--ghost" href="{base}/profiles">{t('returning.change')}</a>
        </div>
      </section>
    {:else}
      <section class="card card--paper stack" aria-labelledby="welcome-title">
        <h1 id="welcome-title">{t('welcome.title')}</h1>
        <p>{t('welcome.explain')}</p>
        <form class="stack" onsubmit={submit} novalidate>
          <div class="field">
            <span class="label">{t('welcome.language')}</span>
            <LocaleSwitch />
          </div>
          <div class="field">
            <label for="name">{t('welcome.name')}</label>
            <input id="name" name="name" class="input" bind:value={name} placeholder={t('welcome.namePlaceholder')} autocomplete="given-name" maxlength="40" aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? 'name-error' : undefined} />
            {#if errors.name}<p id="name-error" class="error">{t('welcome.errors.name')}</p>{/if}
          </div>
          <div class="field">
            <label for="age">{t('welcome.age')}</label>
            <input id="age" name="age" class="input" type="number" inputmode="numeric" min="5" max="120" bind:value={ageText} aria-invalid={errors.age ? 'true' : undefined} aria-describedby={errors.age ? 'age-error' : undefined} style="max-width: 10rem" />
            {#if errors.age}<p id="age-error" class="error">{t('welcome.errors.age')}</p>{/if}
            {#if preview}
              <p class="muted small">{(preview.stages ?? []).map(stageTitle).join(' → ')}</p>
            {/if}
          </div>
          <button class="btn btn--primary" type="submit" data-testid="enter-universe">{t('welcome.enter')}</button>
          <p class="muted small">{t('welcome.privacy')}</p>
        </form>
        {#if profile.summaries.length > 0}
          <div class="stack-sm">
            <h2 class="small muted" style="margin:0">{t('welcome.returning')}</h2>
            <ul class="profile-list">
              {#each profile.summaries as s (s.id)}
                <li>
                  <button class="btn btn--sm" type="button" onclick={async () => { await profile.open(s.id); await learning.bind(s.id); await goto(`${base}/universe`); }}>{s.name} · {s.age}</button>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </section>
    {/if}
  </div>
</div>

<style>
  .welcome {
    min-height: 100dvh;
    padding: calc(var(--space-6) + var(--safe-top)) 0 calc(var(--space-6) + var(--safe-bottom));
  }
  .welcome__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .welcome__brand {
    font-weight: 700;
    margin: 0;
  }
  .route {
    display: flex;
    gap: var(--space-3);
    list-style: none;
    padding: 0;
    margin: 0;
    flex-wrap: wrap;
  }
  .route__stage {
    flex: 1 1 10rem;
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: rgba(47, 79, 201, 0.1);
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .route__when {
    font-size: var(--fs-sm);
    color: var(--paper-muted);
  }
  .profile-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .age-check {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
    background: rgba(255, 179, 71, 0.15);
  }
</style>
