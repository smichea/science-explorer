<script lang="ts">
  import { base } from '$app/paths';
  import NodeChip from '$lib/components/NodeChip.svelte';
  import { formatDateTime, formatPercent } from '$lib/domain/i18n/format';
  import { recommend } from '$lib/domain/progression/recommend';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  const horizon = $derived(profile.horizon(pkg.horizon));
  const states = $derived(
    [...(learning.snapshot?.nodeStates.values() ?? [])]
      .filter((s) => s.status !== 'unknown')
      .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
  );
  const recommendations = $derived(recommend(graph, learning.snapshot, pkg.routes, 6));
  const sessions = $derived(
    [...learning.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  );
  let expanded = $state<string | null>(null);

  function stageTitle(id: string): string {
    return L(pkg.horizon.stages.find((s) => s.id === id)?.title) || id;
  }
</script>

<svelte:head>
  <title>{t('guide.progress')} · {t('app.name')}</title>
</svelte:head>

<div class="stack" data-testid="guide-progress">
  {#if profile.active && horizon}
    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{profile.active.name} · {profile.active.age}</h2>
      <p style="margin:0">
        {horizon.stages.map(stageTitle).join(' → ')}
        {#if horizon.overridden}<span class="badge">{t('guide.stageOverride')}</span>{/if}
      </p>
      <p class="small muted" style="margin:0">
        <a href="{base}/settings">{t('settings.stageOverride')}</a> · {t('settings.evidenceCount', {
          n: learning.evidence.length,
        })}
      </p>
    </section>
  {/if}

  <section class="stack-sm">
    <h2 style="font-size: var(--fs-lg)">{t('guide.activeSessions')}</h2>
    {#if sessions.length === 0}
      <p class="muted">{t('guide.noSession')}</p>
    {:else}
      <ul class="list">
        {#each sessions as s (s.id)}
          {@const m = graph.getMission(s.missionId)}
          <li class="card cluster" style="justify-content: space-between">
            <div>
              <strong>{m ? L(m.title) : s.missionId}</strong> ·
              <span class="badge">{s.status}</span><br />
              <span class="muted small"
                >{formatDateTime(s.updatedAt, locale.current)} · {t(
                  ('mission.variant.' + s.variantId) as never
                )} · {t('mission.step', {
                  n: Object.values(s.stepStates).filter((x) => x.status === 'completed').length,
                  total: Object.keys(s.stepStates).length,
                })}</span
              >
            </div>
            <a class="btn btn--sm btn--primary" href="{base}/guide/session/{s.id}"
              >{t('guide.open')}</a
            >
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="stack-sm">
    <h2 style="font-size: var(--fs-lg)">{t('guide.nextDestination')}</h2>
    <ul class="list">
      {#each recommendations as r (r.kind + r.node.id)}
        <li class="card cluster" style="justify-content: space-between">
          <div>
            <span class="muted small">{t(`recommend.${r.kind}`)}</span><br /><NodeChip
              node={r.node}
              showType
            />
          </div>
          <button
            class="btn btn--sm"
            type="button"
            onclick={() => profile.toggleSavedForLater(r.node.id)}
            >{profile.settings?.savedForLater.includes(r.node.id)
              ? t('concept.unsave')
              : t('guide.chooseNext')}</button
          >
        </li>
      {/each}
    </ul>
  </section>

  <section class="stack-sm">
    <h2 style="font-size: var(--fs-lg)">{t('guide.evidence')}</h2>
    {#if states.length === 0}
      <p class="muted">{t('guide.noEvidence')}</p>
    {:else}
      <div class="scroll-x">
        <div class="table-scroll">
          <table class="data">
            <thead
              ><tr
                ><th>{t('concept.status')}</th><th></th><th>{t('backpack.mastery')}</th><th
                  >{t('backpack.confidence', { label: '' })}</th
                ><th>{t('common.evidence')}</th><th></th></tr
              ></thead
            >
            <tbody>
              {#each states as s (s.nodeId)}
                {@const node = graph.getNode(s.nodeId)}
                <tr>
                  <td>{node ? L(node.title) : s.nodeId}</td>
                  <td><span class="badge">{t(`state.${s.status}`)}</span></td>
                  <td
                    >{s.mastery.evidenceCount
                      ? formatPercent(s.mastery.estimate, locale.current)
                      : '—'}</td
                  >
                  <td
                    >{s.mastery.evidenceCount
                      ? t(`backpack.confidence.${s.mastery.confidenceLabel}`)
                      : '—'}</td
                  >
                  <td>{s.evidenceCount}</td>
                  <td
                    ><button
                      class="btn btn--sm btn--ghost"
                      type="button"
                      onclick={() => (expanded = expanded === s.nodeId ? null : s.nodeId)}
                      aria-expanded={expanded === s.nodeId}
                      >{expanded === s.nodeId ? t('common.less') : t('common.more')}</button
                    ></td
                  >
                </tr>
                {#if expanded === s.nodeId}
                  <tr>
                    <td colspan="6">
                      <ul class="trace small">
                        {#each learning.evidence.filter((e) => e.nodeId === s.nodeId) as e (e.id)}
                          <li>
                            <time datetime={e.timestamp}
                              >{formatDateTime(e.timestamp, locale.current)}</time
                            >
                            · <strong>{e.type}</strong>{e.dimension
                              ? ` · ${t(`backpack.dim.${e.dimension}`)}`
                              : ''}{e.result ? ` · ${e.result}` : ''}{typeof e.score === 'number'
                              ? ` · ${formatPercent(e.score, locale.current)}`
                              : ''}{e.autonomy !== undefined
                              ? ` · ${t('exercise.autonomy', { value: e.autonomy })}`
                              : ''}{e.phenomenonId
                              ? ` · ${L(graph.getNode(e.phenomenonId)?.title)}`
                              : ''}
                          </li>
                        {/each}
                      </ul>
                      {#each learning.snapshot?.explanations.get(s.nodeId) ?? [] as x (x.eventId)}
                        <span class="visually-hidden">{x.dimension} {x.contribution}</span>
                      {/each}
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </section>
</div>

<style>
  .list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  .trace {
    margin: 0;
    padding-left: 1rem;
    display: grid;
    gap: 0.2rem;
  }
</style>
