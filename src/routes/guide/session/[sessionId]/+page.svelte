<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import Markdown from '$lib/components/Markdown.svelte';
  import { formatDateTime, formatElapsed, formatPercent } from '$lib/domain/i18n/format';
  import { reduce, stepsForVariant, type MissionCommand } from '$lib/domain/mission/machine';
  import { newId } from '$lib/persistence/ids';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, LL, locale, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  const session = $derived(learning.sessions.find((s) => s.id === page.params.sessionId));
  const mission = $derived(session ? graph.getMission(session.missionId) : undefined);
  const steps = $derived(mission && session ? stepsForVariant(mission, session.variantId) : []);
  const total = $derived(steps.reduce((sum, s) => sum + s.minutes, 0));
  let note = $state('');
  let now = $state(Date.now());
  let rubricScores = $state<Record<string, number>>({});

  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  async function dispatch(command: MissionCommand) {
    if (!session || !mission || !profile.active) return;
    const transition = reduce(mission, session, command, {
      learnerId: profile.active.id,
      contentVersion: pkg.manifest.version,
    });
    await learning.commitStep(transition.session, transition.evidence);
  }

  async function saveNote() {
    if (!profile.active || !session || note.trim().length === 0) return;
    await learning.addJournal({
      id: newId('journal'),
      learnerId: profile.active.id,
      at: new Date().toISOString(),
      kind: 'guide',
      text: note.trim(),
      refId: session.missionId,
    });
    note = '';
  }

  function explanationExercises(stepId: string) {
    const step = steps.find((s) => s.id === stepId);
    if (!step || step.completion.kind !== 'exercises') return [];
    return step.completion.exerciseIds
      .map((id) => pkg.exercises.find((e) => e.id === id))
      .filter((e) => e && e.type === 'free_explanation');
  }

  const sessionEvidence = $derived(learning.evidence.filter((e) => e.sessionId === session?.id));
</script>

<svelte:head>
  <title>{t('guide.session')} · {t('app.name')}</title>
</svelte:head>

{#if session && mission}
  <div class="stack" data-testid="guide-session">
    <section class="card stack-sm">
      <div class="cluster" style="justify-content: space-between">
        <h2 style="margin:0">{L(mission.title)}</h2>
        <a class="btn btn--sm" href="{base}/mission/{mission.id}?guide=1"
          >{t('guide.learnerView')}</a
        >
      </div>
      <p class="small muted" style="margin:0">
        {t(('mission.variant.' + session.variantId) as never)} ·
        <span class="badge">{session.status}</span>
        · {t('guide.total', { n: total })} · {t('guide.elapsed', {
          time: formatElapsed(now - new Date(session.startedAt).getTime()),
        })} · {formatDateTime(session.updatedAt, locale.current)}
      </p>
      <h3 style="font-size: var(--fs-base); margin: var(--space-2) 0 0">{t('guide.outcomes')}</h3>
      <ul class="small">
        {#each mission.learning.nodesAssessed as id (id)}<li>
            {L(graph.getNode(id)?.title)}
          </li>{/each}
      </ul>
    </section>

    <section class="stack-sm">
      <h3 style="font-size: var(--fs-lg)">{t('guide.timing')}</h3>
      <ol class="steps">
        {#each steps as s, i (s.id)}
          {@const st = session.stepStates[s.id]}
          <li class="card step" class:step--current={s.id === session.currentStepId}>
            <div class="step__head">
              <span class="badge">{i + 1}</span>
              <strong>{L(s.title)}</strong>
              <span class="muted small"
                >{t('guide.stepTime', { n: s.minutes })} · {t(
                  `mission.stepStatus.${s.id === session.currentStepId ? 'active' : st?.status === 'completed' ? 'completed' : st?.status === 'skipped' ? 'skipped' : 'pending'}` as never
                )}</span
              >
              <span class="cluster">
                {#if s.id !== session.currentStepId}
                  <button
                    class="btn btn--sm btn--ghost"
                    type="button"
                    onclick={() => dispatch({ type: 'guide_goto', stepId: s.id })}
                    >{t('guide.goto')}</button
                  >
                {/if}
                {#if st?.status === 'completed'}
                  <button
                    class="btn btn--sm btn--ghost"
                    type="button"
                    onclick={() => dispatch({ type: 'guide_repeat', stepId: s.id })}
                    >{t('guide.repeat')}</button
                  >
                {/if}
              </span>
            </div>
            {#if s.id === session.currentStepId}
              <div class="step__guide stack-sm">
                {#if s.guideNotes}<div>
                    <strong>{t('guide.notes')}</strong><Markdown text={L(s.guideNotes)} />
                  </div>{/if}
                {#if s.oralPrompts}<div>
                    <strong>{t('guide.oralPrompts')}</strong>
                    <ul>
                      {#each LL(s.oralPrompts) as q (q)}<li>{q}</li>{/each}
                    </ul>
                  </div>{/if}
                {#if s.misconceptions}<div>
                    <strong>{t('guide.misconceptions')}</strong>
                    <ul>
                      {#each LL(s.misconceptions) as m (m)}<li>{m}</li>{/each}
                    </ul>
                  </div>{/if}
                <div class="cluster">
                  <button
                    class="btn btn--sm"
                    type="button"
                    onclick={() => dispatch({ type: 'guide_hints', mode: 'revealed' })}
                    aria-pressed={st?.guideHints === 'revealed'}>{t('guide.hints.reveal')}</button
                  >
                  <button
                    class="btn btn--sm"
                    type="button"
                    onclick={() => dispatch({ type: 'guide_hints', mode: 'withheld' })}
                    aria-pressed={st?.guideHints === 'withheld'}>{t('guide.hints.withhold')}</button
                  >
                  <button
                    class="btn btn--sm btn--ghost"
                    type="button"
                    onclick={() => dispatch({ type: 'guide_skip' })}>{t('guide.skip')}</button
                  >
                </div>
                {#if st?.hintsOpened.length}<p class="small muted" style="margin:0">
                    {t('mission.hintsUsed', { n: st.hintsOpened.length })}
                  </p>{/if}
              </div>
            {/if}
            {#each explanationExercises(s.id) as ex (ex!.id)}
              {@const answer = st?.answers?.[ex!.id]}
              {#if answer}
                <div class="card card--paper stack-sm" style="margin-top: var(--space-2)">
                  <strong>{t('guide.rubricScore')}</strong>
                  <p class="small" style="white-space: pre-wrap; margin:0">
                    {String((answer.value as string) ?? '')}
                  </p>
                  <ul class="small">
                    {#each ex!.rubric?.criteria ?? [] as c (c.id)}<li>{L(c.text)}</li>{/each}
                  </ul>
                  <label class="field">
                    <span class="label"
                      >{t('guide.rubricScore')} : {formatPercent(
                        rubricScores[ex!.id] ?? 0.5,
                        locale.current
                      )}</span
                    >
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={rubricScores[ex!.id] ?? 0.5}
                      oninput={(e) =>
                        (rubricScores = {
                          ...rubricScores,
                          [ex!.id]: Number(e.currentTarget.value),
                        })}
                    />
                  </label>
                  <button
                    class="btn btn--sm btn--primary"
                    type="button"
                    onclick={() =>
                      dispatch({
                        type: 'guide_rubric',
                        exerciseId: ex!.id,
                        nodeId: ex!.nodeId,
                        score: rubricScores[ex!.id] ?? 0.5,
                        stepId: s.id,
                      })}>{t('common.save')}</button
                  >
                </div>
              {/if}
            {/each}
          </li>
        {/each}
      </ol>
    </section>

    <section class="card stack-sm">
      <h3 style="font-size: var(--fs-lg); margin:0">{t('guide.sessionNote')}</h3>
      <textarea
        class="input"
        rows="3"
        bind:value={note}
        placeholder={t('journal.notePlaceholder')}
        data-testid="guide-note"></textarea>
      <button
        class="btn btn--sm btn--primary"
        type="button"
        onclick={saveNote}
        disabled={note.trim().length === 0}>{t('guide.saveNote')}</button
      >
    </section>

    <section class="stack-sm">
      <h3 style="font-size: var(--fs-lg)">{t('guide.evidence')}</h3>
      {#if sessionEvidence.length === 0}
        <p class="muted">{t('guide.noEvidence')}</p>
      {:else}
        <ul class="trace small card">
          {#each sessionEvidence as e (e.id)}
            <li>
              <time datetime={e.timestamp}>{formatDateTime(e.timestamp, locale.current)}</time> · {e.stepId ??
                ''} · <strong>{e.type}</strong>{e.nodeId
                ? ` · ${L(graph.getNode(e.nodeId)?.title)}`
                : ''}{e.result ? ` · ${e.result}` : ''}{e.autonomy !== undefined
                ? ` · ${e.autonomy}`
                : ''}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
{:else}
  <p class="muted">{t('guide.noSession')}</p>
{/if}

<style>
  .steps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: var(--space-2);
  }
  .step--current {
    border-color: var(--focus);
  }
  .step__head {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: center;
  }
  .step__guide {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border);
  }
  .trace {
    margin: 0;
    padding-left: 1.2rem;
    display: grid;
    gap: 0.2rem;
  }
</style>
