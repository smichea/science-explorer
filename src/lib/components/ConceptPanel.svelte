<script lang="ts">
  import { base } from '$app/paths';
  import { untrack } from 'svelte';
  import type { CompiledNode } from '$lib/content-schema';
  import EvidenceBadge from './EvidenceBadge.svelte';
  import Markdown from './Markdown.svelte';
  import NodeChip from './NodeChip.svelte';
  import StateBadge from './StateBadge.svelte';
  import { makeEvidence } from '$lib/domain/evidence';
  import { formatHistoricalDate, formatPercent } from '$lib/domain/i18n/format';
  import { nodeStage } from '$lib/domain/horizon';
  import { content } from '$lib/state/content.svelte';
  import { learning } from '$lib/state/learning.svelte';
  import { L, LL, locale, t } from '$lib/state/locale.svelte';
  import { profile } from '$lib/state/profile.svelte';
  import { selection } from '$lib/state/selection.svelte';

  let { node }: { node: CompiledNode } = $props();

  const graph = $derived(content.graph!);
  const pkg = $derived(content.pkg!);
  const region = $derived(graph.regionOf(node));
  const world = $derived(graph.worldOf(node));
  const destination = $derived(learning.destination(node));
  const nodeState = $derived(learning.snapshot?.nodeStates.get(node.id));
  const coverage = $derived(learning.snapshot?.coverage.get(node.id));
  const prerequisites = $derived(graph.prerequisitesOf(node.id));
  const dependents = $derived(graph.dependentsOf(node.id));
  const applications = $derived(
    node.type === 'mathematical_tool' ? graph.getApplications(node.id) : []
  );
  const tools = $derived(node.type === 'phenomenon' ? graph.getToolsFor(node.id) : []);
  const related = $derived(
    graph.getNeighbours(node.id, [
      'models',
      'explains',
      'analogous_to',
      'transfers_to',
      'generalises',
      'specialises',
      'derived_from',
      'measured_by',
      'contrasts_with',
    ])
  );
  const missions = $derived(graph.getHistoricalMissions(node.id));
  const mission = $derived(node.type === 'mission' ? graph.getMission(node.id) : undefined);
  const openSession = $derived(node.type === 'mission' ? learning.sessionFor(node.id) : undefined);
  const stage = $derived(nodeStage(node, pkg.horizon));
  const sources = $derived(
    node.sources.map((id) => pkg.sources.find((s) => s.id === id)).filter((s) => !!s)
  );
  const historicalSources = $derived(
    (node.history?.sources ?? [])
      .map((id) => pkg.sources.find((s) => s.id === id))
      .filter((s) => !!s)
  );
  const missionSources = $derived(
    (mission?.historicalContext.sources ?? [])
      .map((id) => pkg.sources.find((s) => s.id === id))
      .filter((s) => !!s)
  );
  const chipClass = $derived(
    world?.id === 'world.mathematics'
      ? 'chip--math'
      : world?.id === 'world.physics'
        ? 'chip--physics'
        : world?.id === 'world.chemistry'
          ? 'chip--chemistry'
          : 'chip--bridge'
  );

  function stageTitle(id: string): string {
    const s = pkg.horizon.stages.find((x) => x.id === id);
    return s ? L(s.title) : id;
  }
  function stageShort(id: string): string {
    const s = pkg.horizon.stages.find((x) => x.id === id);
    return s ? L(s.short) : id;
  }

  // A visit marks the node as seen (never as mastered): one event per node and day.
  $effect(() => {
    const id = node.id;
    const kind = node.type === 'mission' ? 'mission' : 'node';
    untrack(() => {
      const learner = profile.active;
      if (!learner || !content.pkg) return;
      void profile.setLastVisited(kind, id);
      const today = new Date().toISOString().slice(0, 10);
      const already = learning.evidence.some(
        (e) => e.type === 'node_opened' && e.nodeId === id && e.timestamp.slice(0, 10) === today
      );
      if (already) return;
      void learning.append([
        makeEvidence(
          { type: 'node_opened', nodeId: id, discriminator: today },
          { learnerId: learner.id, contentVersion: content.pkg.manifest.version }
        ),
      ]);
    });
  });

  function showApplications() {
    void selection.setLayer('applications', node.id);
  }
</script>

<article class="concept stack" data-testid="concept-panel" data-node-id={node.id}>
  <header class="stack-sm">
    <div class="cluster" style="justify-content: space-between">
      <span class="badge">{t(`type.${node.type}`)}</span>
      <a class="btn btn--sm btn--ghost" href="{base}/universe" aria-label={t('concept.closePanel')}
        >✕</a
      >
    </div>
    <h1 style="font-size: var(--fs-xl); margin: 0">{L(node.title)}</h1>
    <p class="lead">{L(node.shortPurpose)}</p>
    <div class="cluster">
      {#if world}<a class="chip {chipClass}" href="{base}/world/{world.id}">{L(world.title)}</a
        >{/if}
      {#if region}<a class="chip" href="{base}/region/{region.id}">{L(region.title)}</a>{/if}
      {#if stage}<span class="chip">{t('concept.stage')} : {stageShort(stage)}</span>{/if}
      {#if destination}<StateBadge kind={destination.kind} />{/if}
    </div>
  </header>

  {#if destination && (destination.missingEssential.length || destination.missingRecommended.length) && node.type !== 'mission'}
    <section class="card card--paper stack-sm" data-testid="route-options">
      <p style="margin: 0"><strong>{t('concept.missingIntro')}</strong></p>
      {#if destination.band === 'beyond' || destination.band === 'final' || destination.band === 'next'}
        <p class="muted small" style="margin: 0">
          {t('concept.beyondIntro', { stage: stage ? stageTitle(stage) : '' })}
        </p>
      {/if}
      {#if destination.missingEssential.length}
        <p class="small" style="margin: 0"><strong>{t('concept.essential')}</strong></p>
        <div class="cluster">
          {#each destination.missingEssential as p (p.id)}<NodeChip node={p} />{/each}
        </div>
      {/if}
      {#if destination.missingRecommended.length}
        <p class="small" style="margin: 0"><strong>{t('concept.recommended')}</strong></p>
        <div class="cluster">
          {#each destination.missingRecommended as p (p.id)}<NodeChip node={p} />{/each}
        </div>
      {/if}
      <div class="cluster">
        <a class="btn btn--sm btn--primary" href="#concept-body">{t('concept.explore')}</a>
        {#if destination.missingEssential[0] ?? destination.missingRecommended[0]}
          {@const first = destination.missingEssential[0] ?? destination.missingRecommended[0]}
          <a class="btn btn--sm" href="{base}/concept/{first.id}?layer=prerequisites"
            >{t('concept.followRoute')}</a
          >
        {/if}
        <button
          class="btn btn--sm btn--ghost"
          type="button"
          onclick={() => profile.toggleSavedForLater(node.id)}
        >
          {destination.saved ? t('concept.unsave') : t('concept.saveLater')}
        </button>
      </div>
    </section>
  {/if}

  {#if mission}
    <section class="card stack-sm" data-testid="mission-card">
      <div class="cluster">
        <span class="chip"
          >📍 {mission.historicalContext.places
            .map((p) => L(graph.getNode(p)?.title))
            .join(', ')}</span
        >
        <span class="chip"
          >🗓 {formatHistoricalDate(mission.historicalContext.date, locale.current)}</span
        >
        <span class="chip"
          >👤 {mission.historicalContext.people
            .map((p) => L(graph.getNode(p)?.title))
            .join(', ')}</span
        >
        <span class="chip"
          >⏱ {t('mission.duration', { n: mission.experience.estimatedMinutes })}</span
        >
      </div>
      <p style="margin: 0">{L(mission.summary)}</p>
      <p class="muted small" style="margin: 0">
        <strong>{t('mission.role')}</strong> — {L(mission.role)}
      </p>
      <div class="cluster">
        <a class="btn btn--primary" href="{base}/mission/{node.id}" data-testid="start-mission"
          >{openSession ? t('concept.resumeMission') : t('concept.startMission')}</a
        >
      </div>
      <p class="muted small" style="margin: 0">{L(mission.historicalContext.evidenceSummary)}</p>
      {#if missionSources.length}
        <details>
          <summary>{t('concept.sources')}</summary>
          <ul class="sources">
            {#each missionSources as s (s.id)}<li>
                {s.authors.join(', ')} ({s.year}). <em>{s.title}</em>{s.publication
                  ? `, ${s.publication}`
                  : ''}.
              </li>{/each}
          </ul>
        </details>
      {/if}
    </section>
  {/if}

  {#if node.tool}
    <section class="card card--paper stack-sm" data-testid="tool-questions">
      <h2 style="font-size: var(--fs-lg)">{t('concept.q.problem')}</h2>
      <Markdown text={L(node.tool.problemSolved)} />
      <h2 style="font-size: var(--fs-lg)">{t('concept.q.construction')}</h2>
      <Markdown text={L(node.tool.construction)} />
      <h2 style="font-size: var(--fs-lg)">{t('concept.q.used')}</h2>
      {#if coverage && coverage.appliedCount > 0}
        <ul class="apps">
          {#each coverage.applications.filter((a) => a.value >= 0.4) as a (a.phenomenonId)}
            {@const p = graph.getNode(a.phenomenonId)}
            {#if p}<li>
                <NodeChip node={p} />
                <span class="muted small">{t(`backpack.state.${a.state}`)}</span>
              </li>{/if}
          {/each}
        </ul>
      {:else}
        <p class="muted">{t('concept.notUsedYet')}</p>
      {/if}
      <h2 style="font-size: var(--fs-lg)">{t('concept.q.elsewhere')}</h2>
      <ul class="apps">
        {#each applications as a (a.phenomenon.id)}
          {@const value =
            coverage?.applications.find((x) => x.phenomenonId === a.phenomenon.id)?.value ?? 0}
          {#if value < 0.4}<li>
              <NodeChip node={a.phenomenon} />
              {#if a.edge.note}<span class="muted small">{L(a.edge.note)}</span>{/if}
            </li>{/if}
        {/each}
      </ul>
      <h2 style="font-size: var(--fs-lg)">{t('concept.q.depth')}</h2>
      <p class="muted" style="margin: 0">
        {#if nodeState && nodeState.highestDepthVisited > 0}{t('concept.depthVisited', {
            n: nodeState.highestDepthVisited,
          })}{:else}{t('backpack.notDiscovered')}{/if}
        {#if nodeState}· {t('concept.mastery')}
          {formatPercent(nodeState.mastery.estimate, locale.current)} ({t('backpack.confidence', {
            label: t(`backpack.confidence.${nodeState.mastery.confidenceLabel}`),
          })}){/if}
      </p>
      {#if coverage}
        <p class="muted small" style="margin: 0">
          {t('backpack.coverageDetail', {
            applied: coverage.appliedCount,
            eligible: coverage.eligibleCount,
          })} — {formatPercent(coverage.estimate, locale.current)}
        </p>
      {/if}
      <div class="cluster">
        <button class="btn btn--sm" type="button" onclick={showApplications}
          >{t('concept.showApplications')}</button
        >
        <a class="btn btn--sm btn--ghost" href="{base}/backpack">{t('nav.backpack')}</a>
      </div>
    </section>
  {/if}

  <section id="concept-body" class="stack-sm">
    {#if node.description}
      <Markdown text={L(node.description)} />
    {:else if node.type !== 'mission'}
      <p class="muted">{t('concept.noDescription')}</p>
    {/if}
  </section>

  {#if node.person}
    <section class="card stack-sm">
      {#if node.person.born}<p style="margin:0">
          <strong>{t('concept.person.born')}</strong> : {formatHistoricalDate(
            node.person.born,
            locale.current
          )}
        </p>{/if}
      {#if node.person.died}<p style="margin:0">
          <strong>{t('concept.person.died')}</strong> : {formatHistoricalDate(
            node.person.died,
            locale.current
          )}
        </p>{/if}
      <p style="margin:0"><strong>{t('concept.person.roles')}</strong></p>
      <ul>
        {#each LL(node.person.roles) as role (role)}<li>{role}</li>{/each}
      </ul>
      <Markdown text={L(node.person.biography)} />
      <EvidenceBadge status={node.person.evidenceStatus} />
    </section>
  {/if}
  {#if node.place}
    <section class="card stack-sm">
      {#if node.place.modernName}<p style="margin:0">
          <strong>{t('concept.place.modern')}</strong> : {L(node.place.modernName)}
        </p>{/if}
      <p class="muted small" style="margin:0">
        {t('concept.place.certainty', {
          certainty: t(
            `certainty.${node.place.locationCertainty === 'exact' ? 'exact' : node.place.locationCertainty === 'disputed' ? 'disputed' : node.place.locationCertainty === 'unknown' ? 'unknown' : 'approximate'}`
          ),
        })}
      </p>
      <Markdown text={L(node.place.context)} />
    </section>
  {/if}
  {#if node.period}
    <section class="card stack-sm">
      <p style="margin:0">
        <strong>{formatHistoricalDate(node.period.date, locale.current)}</strong>
        <span class="muted small">({t(`certainty.${node.period.date.certainty}`)})</span>
      </p>
      <Markdown text={L(node.period.context)} />
      <div class="cluster">
        {#each [...node.period.people, ...node.period.places] as id (id)}
          {@const n = graph.getNode(id)}
          {#if n}<NodeChip node={n} />{/if}
        {/each}
      </div>
    </section>
  {/if}

  {#if node.depths.length}
    <section class="stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('concept.depths')}</h2>
      {#each node.depths as depth (depth.depth)}
        <details
          class="card"
          open={depth.stage === (profile.horizon(pkg.horizon)?.currentStage ?? 'terminale')}
        >
          <summary
            >{t('concept.depth', { n: depth.depth })} · {stageTitle(depth.stage)}
            <span class="muted small">({depth.role})</span></summary
          >
          <p class="small muted" style="margin: var(--space-2) 0 0">{t('concept.outcomes')}</p>
          <ul>
            {#each LL(depth.outcomes) as o (o)}<li>{o}</li>{/each}
          </ul>
          {#if depth.lesson}
            <p class="small muted" style="margin: 0">{t('concept.lesson')}</p>
            <div class="card card--paper" style="margin-top: var(--space-2)">
              <Markdown text={L(depth.lesson)} />
            </div>
          {/if}
        </details>
      {/each}
    </section>
  {/if}

  {#if node.model}
    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('concept.assumptions')}</h2>
      <ul>
        {#each LL(node.model.assumptions) as a (a)}<li>{a}</li>{/each}
      </ul>
      <h2 style="font-size: var(--fs-lg)">{t('concept.limits')}</h2>
      <ul>
        {#each LL(node.model.limits) as l (l)}<li>{l}</li>{/each}
      </ul>
    </section>
  {/if}
  {#if node.law}
    <section class="card card--paper stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('concept.statement')}</h2>
      <Markdown text={L(node.law.statement)} />
      <h2 style="font-size: var(--fs-lg)">{t('concept.validity')}</h2>
      <Markdown text={L(node.law.validity)} />
    </section>
  {/if}
  {#if node.history}
    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">
        {t('concept.history')}
        <EvidenceBadge status={node.history.status} />
      </h2>
      <Markdown text={L(node.history.summary)} />
      {#if historicalSources.length}
        <ul class="sources">
          {#each historicalSources as s (s.id)}<li>
              {s.authors.join(', ')} ({s.year}). <em>{s.title}</em>.
            </li>{/each}
        </ul>
      {/if}
    </section>
  {/if}

  {#if prerequisites.essential.length || prerequisites.recommended.length}
    <section class="stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('concept.prerequisites')}</h2>
      {#if prerequisites.essential.length}
        <p class="small muted" style="margin:0">{t('concept.essential')}</p>
        <div class="cluster">
          {#each prerequisites.essential as p (p.id)}<NodeChip node={p} />{/each}
        </div>
      {/if}
      {#if prerequisites.recommended.length}
        <p class="small muted" style="margin:0">{t('concept.recommended')}</p>
        <div class="cluster">
          {#each prerequisites.recommended as p (p.id)}<NodeChip node={p} />{/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if tools.length}
    <section class="stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('concept.related')}</h2>
      <div class="cluster">
        {#each tools as x (x.tool.id)}<NodeChip node={x.tool} showType />{/each}
      </div>
    </section>
  {/if}
  {#if related.length}
    <section class="stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('concept.related')}</h2>
      <ul class="related">
        {#each related as r (r.edge.id)}
          <li>
            <span class="badge">{r.edge.type.replace(/_/g, ' ')}</span>
            <NodeChip node={r.node} />{#if r.edge.note}<span class="muted small">
                — {L(r.edge.note)}</span
              >{/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if dependents.length}
    <section class="stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('concept.routes')}</h2>
      <div class="cluster">
        {#each dependents as d (d.id)}<NodeChip node={d} showType />{/each}
      </div>
    </section>
  {/if}

  {#if missions.length && node.type !== 'mission'}
    <section class="stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('concept.missions')}</h2>
      {#each missions as m (m.id)}
        <div class="card cluster" style="justify-content: space-between">
          <div>
            <strong>{L(m.title)}</strong><br /><span class="muted small"
              >{formatHistoricalDate(m.historicalContext.date, locale.current)} · {t(
                'mission.duration',
                { n: m.experience.estimatedMinutes }
              )}</span
            >
          </div>
          <a class="btn btn--sm btn--primary" href="{base}/mission/{m.id}"
            >{learning.sessionFor(m.id) ? t('concept.resumeMission') : t('concept.startMission')}</a
          >
        </div>
      {/each}
    </section>
  {/if}

  {#if nodeState && nodeState.evidenceCount > 0}
    <section class="card stack-sm" data-testid="node-status">
      <h2 style="font-size: var(--fs-lg)">{t('concept.status')}</h2>
      <p style="margin:0">
        <StateBadge kind={destination?.kind ?? 'unknown'} /> · {t('backpack.evidenceCount', {
          n: nodeState.evidenceCount,
        })}
      </p>
      {#if nodeState.mastery.evidenceCount > 0}
        <p class="small muted" style="margin:0">
          {t('concept.mastery')} : {formatPercent(nodeState.mastery.estimate, locale.current)} · {t(
            'backpack.confidence',
            { label: t(`backpack.confidence.${nodeState.mastery.confidenceLabel}`) }
          )}
        </p>
        <div class="progress" aria-hidden="true">
          <span style="width: {nodeState.mastery.estimate * 100}%"></span>
        </div>
      {/if}
    </section>
  {/if}

  {#if sources.length}
    <section class="stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('concept.sources')}</h2>
      <ul class="sources">
        {#each sources as s (s.id)}<li>
            {s.authors.join(', ')} ({s.year}). <em>{s.title}</em>{s.publication
              ? `, ${s.publication}`
              : ''}.{#if s.note}
              <span class="muted">{L(s.note)}</span>{/if}
          </li>{/each}
      </ul>
    </section>
  {/if}
</article>

<style>
  .lead {
    font-size: var(--fs-lg);
    margin: 0;
  }
  .apps,
  .related,
  .sources {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }
  .sources li {
    font-size: var(--fs-sm);
  }
  .concept :global(h2) {
    margin-top: var(--space-2);
  }
</style>
