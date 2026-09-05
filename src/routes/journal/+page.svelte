<script lang="ts">
  import { base } from '$app/paths';
  import { formatDateTime } from '$lib/domain/i18n/format';
  import { newId } from '$lib/persistence/ids';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';

  const graph = $derived(content.graph!);
  let draft = $state('');

  interface Row {
    id: string;
    at: string;
    kind: string;
    text: string;
    href?: string;
  }
  const rows = $derived.by((): Row[] => {
    const out: Row[] = learning.journal.map((j) => ({
      id: j.id,
      at: j.at,
      kind: j.kind,
      text: j.text,
      href: j.refId ? `${base}/concept/${j.refId}` : undefined,
    }));
    for (const e of learning.evidence) {
      if (e.type === 'mission_completed' && e.missionId) {
        const m = graph.getMission(e.missionId);
        out.push({
          id: e.id,
          at: e.timestamp,
          kind: 'mission',
          text: `${t('mission.completed')} — ${m ? L(m.title) : e.missionId}`,
          href: `${base}/concept/${e.missionId}`,
        });
      } else if (e.type === 'mission_started' && e.missionId) {
        const m = graph.getMission(e.missionId);
        out.push({
          id: e.id,
          at: e.timestamp,
          kind: 'mission',
          text: `${t('mission.start')} — ${m ? L(m.title) : e.missionId}`,
          href: `${base}/mission/${e.missionId}`,
        });
      }
    }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!profile.active || draft.trim().length === 0) return;
    await learning.addJournal({
      id: newId('journal'),
      learnerId: profile.active.id,
      at: new Date().toISOString(),
      kind: 'note',
      text: draft.trim(),
    });
    draft = '';
  }
</script>

<svelte:head>
  <title>{t('journal.title')} · {t('app.name')}</title>
</svelte:head>

<div
  class="container container--narrow stack"
  style="padding: var(--space-5) 0 var(--space-7)"
  data-testid="journal"
>
  <h1>{t('journal.title')}</h1>
  <p class="muted">{t('journal.intro')}</p>
  <form class="card stack-sm" onsubmit={save}>
    <label class="field">
      <span class="label">{t('journal.add')}</span>
      <textarea
        class="input"
        rows="3"
        bind:value={draft}
        placeholder={t('journal.notePlaceholder')}
        data-testid="journal-input"></textarea>
    </label>
    <button class="btn btn--primary btn--sm" type="submit" disabled={draft.trim().length === 0}
      >{t('journal.save')}</button
    >
  </form>
  {#if rows.length === 0}
    <p class="muted">{t('journal.empty')}</p>
  {:else}
    <ul class="entries">
      {#each rows as row (row.id)}
        <li class="card">
          <div class="cluster small muted" style="justify-content: space-between">
            <span class="badge">{t(`journal.kind.${row.kind}` as never)}</span>
            <time datetime={row.at}>{formatDateTime(row.at, locale.current)}</time>
          </div>
          <p style="margin: var(--space-2) 0 0; white-space: pre-wrap">{row.text}</p>
          {#if row.href}<a class="small" href={row.href}>{t('common.open')}</a>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .entries {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-3);
  }
</style>
