<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { content } from '$lib/state/content.svelte';
  import { L, t } from '$lib/state/locale.svelte';

  const pkg = $derived(content.pkg!);
  const graph = $derived(content.graph!);
  const section = $derived(page.params.section ?? 'graph');
  const edgeCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const e of graph.graph.edges) counts[e.type] = (counts[e.type] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  });
</script>

<svelte:head>
  <title>{t('studio.title')} · {t('app.name')}</title>
</svelte:head>

<div class="container stack" style="padding: var(--space-5) 0 var(--space-7)" data-testid="studio">
  <h1>{t('studio.title')}</h1>
  <p class="muted">{t('studio.intro')}</p>
  <nav class="cluster" aria-label={t('studio.title')}>
    {#each ['graph', 'missions', 'simulations', 'exercises', 'sources'] as s (s)}
      <a class="chip" href="{base}/studio/{s}" aria-current={section === s ? 'page' : undefined}
        >{s}</a
      >
    {/each}
  </nav>

  {#if section === 'graph'}
    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('studio.report')}</h2>
      <p style="margin:0">
        <span class="badge">{t('studio.errors', { n: pkg.report.errors.length })}</span>
        <span class="badge">{t('studio.warnings', { n: pkg.report.warnings.length })}</span>
        · {pkg.manifest.id}
        {pkg.manifest.version}
      </p>
      <p class="small muted" style="margin:0">
        {Object.entries(pkg.report.counts)
          .map(([k, v]) => `${v} ${k}`)
          .join(' · ')}
      </p>
      {#if pkg.report.warnings.length}
        <ul class="small">
          {#each pkg.report.warnings as w, i (i)}<li>
              {w.file ? `[${w.file}] ` : ''}{w.message}
            </li>{/each}
        </ul>
      {/if}
    </section>
    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('studio.edges')}</h2>
      <p class="small">
        {#each edgeCounts as [type, n] (type)}<span class="chip">{type} · {n}</span>
        {/each}
      </p>
    </section>
    <section class="card stack-sm">
      <h2 style="font-size: var(--fs-lg)">{t('studio.nodes')}</h2>
      <div class="scroll-x">
        <div class="table-scroll">
          <table class="data small">
            <thead
              ><tr
                ><th>id</th><th>{t('type.mathematical_concept').split(' ')[0]}</th><th
                  >{t('concept.region')}</th
                ><th>{t('concept.depths')}</th></tr
              ></thead
            >
            <tbody>
              {#each graph.graph.nodes as n (n.id)}
                <tr
                  ><td><a href="{base}/concept/{n.id}">{n.id}</a></td><td>{t(`type.${n.type}`)}</td
                  ><td>{n.region ?? n.anchorNode ?? ''}</td><td
                    >{n.depths.map((d) => `${d.depth}:${d.stage}`).join(', ')}</td
                  ></tr
                >
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  {:else if section === 'missions'}
    <ul class="stack-sm">
      {#each pkg.missions as m (m.id)}<li class="card">
          <a href="{base}/concept/{m.id}">{L(m.title)}</a> · {m.status} v{m.version} · {m.experience
            .steps.length} steps
        </li>{/each}
    </ul>
  {:else if section === 'simulations'}
    <ul class="stack-sm">
      {#each pkg.simulations as s (s.id)}<li class="card">
          {s.id} · {s.engine} · {L(s.title)}
        </li>{/each}
    </ul>
  {:else if section === 'exercises'}
    <ul class="stack-sm">
      {#each pkg.exercises as e (e.id)}<li class="card">{e.id} · {e.type} · {e.nodeId}</li>{/each}
    </ul>
  {:else if section === 'sources'}
    <ul class="stack-sm">
      {#each pkg.sources as s (s.id)}<li class="card">
          {s.id} · {s.authors.join(', ')} ({s.year}) <em>{s.title}</em>
        </li>{/each}
    </ul>
  {/if}
  <p class="muted small">{t('studio.comingSoon')}</p>
</div>
