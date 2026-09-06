<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import LocaleSwitch from '$lib/components/LocaleSwitch.svelte';
  import type { Stage } from '$lib/content-schema';
  import {
    buildExport,
    planCreateNew,
    planMerge,
    previewImport,
    type ImportPreview,
  } from '$lib/domain/transfer';
  import { newId } from '$lib/persistence/ids';
  import type { PerformanceMode } from '$lib/persistence/localStorage';
  import {
    evidenceRepo,
    exportsRepo,
    journalRepo,
    profileRepo,
    sessionRepo,
    settingsRepo,
  } from '$lib/persistence/repositories';
  import { content } from '$lib/state/content.svelte';
  import { guide } from '$lib/state/guide.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, t } from '$lib/state/locale.svelte';
  import { prefs } from '$lib/state/prefs.svelte';
  import { profile } from '$lib/state/profile.svelte';

  const pkg = $derived(content.pkg!);
  const graph = $derived(content.graph!);
  let pin = $state('');
  let saved = $state('');
  let preview = $state.raw<ImportPreview | null>(null);
  let importError = $state('');
  let importDone = $state(false);

  const PERFORMANCE: Array<PerformanceMode | 'auto'> = [
    'auto',
    'high',
    'balanced',
    'reduced',
    '2d',
  ];

  async function exportProgress() {
    if (!profile.active || !profile.settings) return;
    const data = buildExport({
      profile: $state.snapshot(profile.active),
      settings: $state.snapshot(profile.settings),
      sessions: learning.sessions,
      evidence: learning.evidence,
      journal: learning.journal,
      contentVersion: pkg.manifest.version,
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `science-explorer-${profile.active.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    await exportsRepo.put({
      id: newId('export'),
      learnerId: profile.active.id,
      kind: 'export',
      at: new Date().toISOString(),
    });
    await learning.addJournal({
      id: newId('journal'),
      learnerId: profile.active.id,
      at: new Date().toISOString(),
      kind: 'export',
      text: a.download,
    });
  }

  async function onImportFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    importError = '';
    importDone = false;
    preview = null;
    if (!file) return;
    const text = await file.text();
    const known = new Set(graph.graph.nodes.map((n) => n.id));
    const result = previewImport(
      text,
      known,
      profile.summaries.map((p) => p.id)
    );
    if (!result.ok) {
      importError = result.reason === 'too_large' ? t('import.tooLarge') : t('import.invalid');
      return;
    }
    preview = result;
    input.value = '';
  }

  async function applyImport(mode: 'create' | 'merge') {
    if (!preview) return;
    let plan;
    if (mode === 'merge') {
      const existingProfile = await profileRepo.get(preview.learner.id);
      if (!existingProfile) return;
      const existing = {
        profile: existingProfile,
        settings: await settingsRepo.get(existingProfile.id),
        sessions: await sessionRepo.listByLearner(existingProfile.id),
        evidence: await evidenceRepo.listByLearner(existingProfile.id),
        journal: await journalRepo.listByLearner(existingProfile.id),
      };
      plan = planMerge(preview.data, existing);
    } else {
      plan = planCreateNew(preview.data);
    }
    await profileRepo.put(plan.profile);
    await settingsRepo.put(plan.settings);
    for (const s of plan.sessions) await sessionRepo.put(s);
    await evidenceRepo.appendMany(plan.evidence);
    for (const j of plan.journal) await journalRepo.put(j);
    await exportsRepo.put({
      id: newId('import'),
      learnerId: plan.profile.id,
      kind: 'import',
      at: new Date().toISOString(),
      note: mode,
    });
    await journalRepo.put({
      id: newId('journal'),
      learnerId: plan.profile.id,
      at: new Date().toISOString(),
      kind: 'import',
      text: `${preview.counts.evidence} ${t('common.evidence')} · ${mode}`,
    });
    await profile.open(plan.profile.id);
    await learning.bind(null);
    await learning.bind(plan.profile.id);
    preview = null;
    importDone = true;
  }

  async function setPin() {
    if (!/^\d{4,8}$/.test(pin)) return;
    await guide.setPin(pin);
    pin = '';
    saved = t('settings.saved');
  }

  async function deleteProfile() {
    if (!profile.active) return;
    if (!confirm(t('profiles.deleteConfirm', { name: profile.active.name }))) return;
    await profile.remove(profile.active.id);
    await goto(`${base}/welcome`);
  }

  const stageOptions = $derived(pkg.horizon.stages.filter((s) => s.id !== 'beyond'));
</script>

<svelte:head>
  <title>{t('settings.title')} · {t('app.name')}</title>
</svelte:head>

<div
  class="container container--narrow stack"
  style="padding: var(--space-5) 0 var(--space-7)"
  data-testid="settings"
>
  <h1>{t('settings.title')}</h1>

  <section class="card stack-sm">
    <h2 style="font-size: var(--fs-lg)">{t('settings.language')}</h2>
    <LocaleSwitch />
  </section>

  <section class="card stack-sm">
    <h2 style="font-size: var(--fs-lg)">{t('settings.performance')}</h2>
    <div class="segmented" role="group" aria-label={t('settings.performance')}>
      {#each PERFORMANCE as mode (mode)}
        <button
          type="button"
          aria-pressed={prefs.prefs.performanceMode === mode}
          onclick={() => prefs.update({ performanceMode: mode })}
          >{mode === 'auto' ? 'Auto' : t(`settings.performance.${mode}`)}</button
        >
      {/each}
    </div>
    <label class="cluster"
      ><input
        type="checkbox"
        checked={prefs.reducedMotion}
        onchange={(e) => prefs.update({ reducedMotion: e.currentTarget.checked })}
      />
      {t('settings.reducedMotion')}</label
    >
    <label class="cluster"
      ><input
        type="checkbox"
        checked={prefs.prefs.voice ?? prefs.prefs.tourVoice ?? true}
        onchange={(e) =>
          prefs.update({ voice: e.currentTarget.checked, tourVoice: e.currentTarget.checked })}
        data-testid="settings-voice"
      />
      {t('settings.voice')}</label
    >
    {#if prefs.systemReducedMotion}<p class="muted small" style="margin:0">
        {t('settings.reducedMotionSystem')}
      </p>{/if}
    <label class="field">
      <span class="label"
        >{t('settings.textSize')} ({Math.round(prefs.prefs.textScale * 100)} %)</span
      >
      <input
        type="range"
        min="0.85"
        max="1.4"
        step="0.05"
        value={prefs.prefs.textScale}
        oninput={(e) => prefs.update({ textScale: Number(e.currentTarget.value) })}
      />
    </label>
  </section>

  {#if profile.active}
    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('settings.stageOverride')}</h2>
      <select
        class="input"
        value={profile.active.stageOverride ?? ''}
        onchange={(e) =>
          profile.setStageOverride((e.currentTarget.value || undefined) as Stage | undefined)}
        data-testid="stage-override"
      >
        <option value=""
          >{t('settings.stageInferred')} — {L(
            pkg.horizon.stages.find((s) => s.id === profile.active?.inferredStage)?.title
          )}</option
        >
        {#each stageOptions as s (s.id)}<option value={s.id}>{L(s.title)}</option>{/each}
      </select>
    </section>

    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('settings.guide')}</h2>
      <p class="muted small" style="margin:0">{t('settings.guidePinHelp')}</p>
      {#if guide.hasPin}
        <button class="btn btn--sm" type="button" onclick={() => guide.clearPin()}
          >{t('settings.guidePinClear')}</button
        >
      {:else}
        <div class="cluster">
          <input
            class="input"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="8"
            bind:value={pin}
            aria-label={t('settings.guidePin')}
            placeholder="••••"
            style="max-width: 8rem"
            data-testid="pin-input"
          />
          <button
            class="btn btn--sm"
            type="button"
            onclick={setPin}
            disabled={!/^\d{4,8}$/.test(pin)}>{t('settings.guidePinSet')}</button
          >
        </div>
      {/if}
      {#if saved}<p class="small muted" role="status">{saved}</p>{/if}
    </section>

    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('settings.export')}</h2>
      <p class="muted small" style="margin:0">{t('settings.exportHelp')}</p>
      <button
        class="btn btn--primary btn--sm"
        type="button"
        onclick={exportProgress}
        data-testid="export-button">{t('settings.export')}</button
      >
      <h2 style="font-size: var(--fs-lg); margin-top: var(--space-3)">{t('settings.import')}</h2>
      <p class="muted small" style="margin:0">{t('settings.importHelp')}</p>
      <input
        class="input"
        type="file"
        accept="application/json,.json"
        onchange={onImportFile}
        data-testid="import-file"
      />
      {#if importError}<p class="error" role="alert">{importError}</p>{/if}
      {#if importDone}<p class="small" role="status">{t('import.done')}</p>{/if}
      {#if preview}
        <div class="card card--paper stack-sm" data-testid="import-preview">
          <h3 style="margin:0">{t('import.title')}</h3>
          <p style="margin:0">
            {t('import.learner', { name: preview.learner.name, age: preview.learner.age })}
          </p>
          <p style="margin:0">
            {t('import.counts', {
              sessions: preview.counts.sessions,
              evidence: preview.counts.evidence,
              journal: preview.counts.journal,
            })}
          </p>
          <p class="small muted" style="margin:0">
            {t('import.contentVersions', { versions: preview.contentVersions.join(', ') })}
          </p>
          {#if preview.unknownNodeIds.length}<p class="small muted" style="margin:0">
              {t('import.unknownNodes', { n: preview.unknownNodeIds.length })}
            </p>{/if}
          {#if preview.conflict}<p class="small" style="margin:0">
              <strong>{t('import.conflict')}</strong>
            </p>{/if}
          <div class="cluster">
            <button
              class="btn btn--primary btn--sm"
              type="button"
              onclick={() => applyImport('create')}
              data-testid="import-create">{t('import.createNew')}</button
            >
            {#if preview.conflict}<button
                class="btn btn--sm"
                type="button"
                onclick={() => applyImport('merge')}
                data-testid="import-merge">{t('import.merge')}</button
              >{/if}
            <button class="btn btn--sm btn--ghost" type="button" onclick={() => (preview = null)}
              >{t('import.cancel')}</button
            >
          </div>
        </div>
      {/if}
    </section>

    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('settings.storage')}</h2>
      <p class="small muted" style="margin:0">
        {t('settings.contentVersion', { id: pkg.manifest.id, version: pkg.manifest.version })} · {t(
          'settings.evidenceCount',
          { n: learning.evidence.length }
        )}
      </p>
      <p class="small muted" style="margin:0">{t('settings.installHint')}</p>
      <div class="cluster">
        <a class="btn btn--sm" href="{base}/profiles">{t('nav.profiles')}</a>
        <a class="btn btn--sm" href="{base}/studio/graph">{t('nav.studio')}</a>
        <button class="btn btn--sm btn--danger" type="button" onclick={deleteProfile}
          >{t('settings.deleteProfile')}</button
        >
      </div>
    </section>
  {/if}
</div>
