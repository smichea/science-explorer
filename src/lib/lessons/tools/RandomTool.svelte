<script lang="ts">
  import type { LessonTool } from '$lib/content-schema';
  import {
    conditionalProbability,
    distributionOf,
    drawMany,
    drawOne,
    drawTree,
    eventProbability,
    expectation,
    givenProbability,
    isIndependent,
    leafId,
    outcomesOf,
    sampleFrequencies,
    stdDeviation,
    totalProbability,
    treeLeaves,
    variance,
  } from '$lib/domain/lessonTools';
  import { L, locale, t } from '$lib/state/locale.svelte';
  import { fmt, niceTicks, seeded } from '../axes';

  type Tool = Extract<LessonTool, { kind: 'random' }>;
  interface Props {
    tool: Tool;
    interactive?: boolean;
  }
  let { tool, interactive = false }: Props = $props();

  const outcomes = $derived(outcomesOf(tool));
  /** The weighted tree of the tree mode. */
  const tree = $derived(tool.mode === 'tree' ? (tool.tree ?? null) : null);
  /** Its leaves `first_second`, each with P(A ∩ B) = P(A) × P_A(B). */
  const leaves = $derived(
    tree ? treeLeaves(tree).map((l) => ({ ...l, id: leafId(l.first, l.second) })) : []
  );
  const eventSet = $derived(new Set(tool.event?.outcomes ?? []));
  /** The B of the conditional readouts: the first outcome of the event, a second-level id. */
  const eventB = $derived.by(() => {
    const first = tool.event?.outcomes[0];
    return tree && first ? (tree.second.find((s) => s.id === first) ?? null) : null;
  });
  const p = $derived.by(() => {
    const ev = tool.event;
    if (!ev) return null;
    if (tree) return ev.outcomes.reduce((s, id) => s + totalProbability(tree, id), 0);
    return eventProbability(outcomes, eventSet);
  });
  /** The law of the random variable, on the outcomes of the experiment or on the leaves of the tree. */
  const law = $derived(
    tool.variable ? distributionOf(tree ? leaves : outcomes, tool.variable.values) : null
  );
  const unit = $derived(tool.variable?.unit ? ` ${tool.variable.unit}` : '');
  const valueOf = (id: string) => tool.variable?.values[id] ?? 0;
  let random: () => number = () => 0;
  let tally = $state<Record<string, number>>({});
  let draws = $state(0);
  /** Sampling mode: the frequency of the event on each sample, or the mean of the variable. */
  let samples = $state<number[]>([]);
  // A new tool restarts the reproducible draws; so does the end of the free play.
  $effect(() => {
    void tool.seed;
    reset();
  });
  $effect(() => {
    if (!interactive) reset();
  });
  function reset() {
    random = seeded(tool.seed);
    tally = {};
    draws = 0;
    samples = [];
  }
  function draw(count: number) {
    const next = { ...tally };
    if (tree) {
      for (let i = 0; i < count; i++) {
        const { first, second } = drawTree(tree, random);
        const id = leafId(first, second);
        next[id] = (next[id] ?? 0) + 1;
      }
    } else {
      const more = drawMany(outcomes, count, random);
      for (const [id, n] of Object.entries(more)) next[id] = (next[id] ?? 0) + n;
    }
    tally = next;
    draws += count;
  }
  function sample(count: number) {
    if (tool.variable) {
      const means: number[] = [];
      for (let s = 0; s < count; s++) {
        let sum = 0;
        for (let i = 0; i < tool.sample; i++) sum += valueOf(drawOne(outcomes, random));
        means.push(sum / tool.sample);
      }
      samples = [...samples, ...means];
    } else {
      samples = [...samples, ...sampleFrequencies(outcomes, eventSet, tool.sample, count, random)];
    }
  }
  function labelOf(id: string): string {
    if (tree) {
      const node = tree.second.find((s) => s.id === id) ?? tree.first.find((a) => a.id === id);
      if (node) return L(node.label);
    }
    if (tool.experiment === 'coin')
      return t(id === 'heads' ? 'lesson.random.heads' : 'lesson.random.tails');
    if (tool.experiment === 'urn') {
      const ball = tool.urn.find((b) => b.id === id);
      return ball ? L(ball.label) : id;
    }
    return id;
  }
  function colorOf(id: string, i: number): string {
    return (
      tool.urn.find((b) => b.id === id)?.color ??
      ['#7f9cff', '#ffb347', '#5ee6a8', '#ff8fab', '#b39dff', '#ffd166'][i % 6]
    );
  }
  const f = (v: number) => fmt(v, locale.current, 3);
  const f2 = (v: number) => fmt(v, locale.current, 2);
  const W = 560;
  const H = 240;
  const pad = { l: 40, r: 16, t: 16, b: 36 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const sy = (v: number) => H - pad.b - v * plotH;
  const barW = $derived(plotW / Math.max(1, outcomes.length));
  const frequency = (id: string) => (draws ? (tally[id] ?? 0) / draws : 0);
  /** Observed frequency of the event, from the tally of the draws (frequencies and tree modes). */
  const eventFrequency = $derived.by(() => {
    const ev = tool.event;
    if (!ev || !draws) return null;
    const hits = tree
      ? leaves.filter((l) => eventSet.has(l.second)).reduce((s, l) => s + (tally[l.id] ?? 0), 0)
      : ev.outcomes.reduce((s, id) => s + (tally[id] ?? 0), 0);
    return hits / draws;
  });
  /** Observed frequency of a value of the variable, from the tally of the draws. */
  function valueFrequency(x: number): number {
    const values = tool.variable?.values ?? {};
    const ids = (tree ? leaves : outcomes).filter((o) => values[o.id] === x).map((o) => o.id);
    return draws ? ids.reduce((s, id) => s + (tally[id] ?? 0), 0) / draws : 0;
  }
  /** Sampling: the band p ± 1/√n around the frequency of the event (not for the means of a variable). */
  const interval = $derived(
    p !== null && !law
      ? [Math.max(0, p - 1 / Math.sqrt(tool.sample)), Math.min(1, p + 1 / Math.sqrt(tool.sample))]
      : null
  );
  const inInterval = $derived(
    interval ? samples.filter((s) => s >= interval[0] && s <= interval[1]).length : 0
  );
  const samplesMean = $derived(
    samples.length ? samples.reduce((s, v) => s + v, 0) / samples.length : null
  );
  /** The reference line of the sampling chart: p for frequencies, E for the means of a variable. */
  const centre = $derived(law ? expectation(law) : p);
  /** Abscissa of the sampling chart: frequencies in [0, 1], or the values of the variable. */
  const xRange = $derived.by((): [number, number] => {
    if (!law || law.length === 0) return [0, 1];
    const lo = law[0].x;
    const hi = law[law.length - 1].x;
    return lo < hi ? [lo, hi] : [lo - 1, hi + 1];
  });
  const xTicks = $derived(law ? niceTicks(xRange[0], xRange[1]) : [0, 0.25, 0.5, 0.75, 1]);
  const sx = (v: number) => pad.l + ((v - xRange[0]) / (xRange[1] - xRange[0])) * plotW;

  // --- tree layout: the root on the left, the leaves on the right ------------
  const TH = 320;
  const X0 = 30;
  const X1 = 175;
  const X2 = 320;
  const XP = 400;
  const XF = 475;
  const layout = $derived.by(() => {
    if (!tree) return null;
    const n2 = tree.second.length;
    const total = tree.first.length * n2;
    const avail = TH - 36;
    const leafY = (k: number) => 18 + ((k + 0.5) * avail) / total;
    const firsts = tree.first.map((a, i) => ({
      id: a.id,
      label: L(a.label),
      p: a.p,
      // Each first-level node sits at the middle of its leaves.
      y: leafY(i * n2 + (n2 - 1) / 2),
      color: colorOf(a.id, i),
    }));
    const nodes = tree.first.flatMap((a, i) =>
      tree.second.map((b, j) => {
        const id = leafId(a.id, b.id);
        return {
          id,
          first: firsts[i],
          label: L(b.label),
          q: givenProbability(tree, a.id, b.id),
          p: leaves.find((l) => l.id === id)?.p ?? 0,
          y: leafY(i * n2 + j),
        };
      })
    );
    const rootY = firsts.reduce((s, a) => s + a.y, 0) / Math.max(1, firsts.length);
    return { rootY, firsts, nodes };
  });
</script>

<div
  class="tool stack-sm"
  data-testid="random-tool"
  data-mode={tool.mode}
  data-draws={draws}
  data-samples={samples.length}
>
  {#if tree && layout}
    <svg viewBox="0 0 {W} {TH}" class="tool__svg" role="img" aria-label={t('lesson.random.tree')}>
      <circle cx={X0} cy={layout.rootY} r="4" fill="#eef1f8" />
      {#each layout.firsts as a (a.id)}
        <line x1={X0} y1={layout.rootY} x2={X1} y2={a.y} stroke={a.color} stroke-width="2" />
      {/each}
      {#each layout.nodes as n (n.id)}
        <line
          x1={X1}
          y1={n.first.y}
          x2={X2}
          y2={n.y}
          stroke="#eef1f8"
          stroke-width="1.5"
          opacity="0.6"
        />
      {/each}
      {#each layout.firsts as a (a.id)}
        <text
          x={(X0 + X1) / 2}
          y={(layout.rootY + a.y) / 2 - 5}
          class="node node--small"
          text-anchor="middle"
          style="fill: {a.color}">{f2(a.p)}</text
        >
        <text x={X1} y={a.y + 4} class="node" text-anchor="middle" style="fill: {a.color}"
          >{a.label}</text
        >
      {/each}
      <text x={XP} y="12" class="tick">P(A ∩ B)</text>
      {#if draws}<text x={XF} y="12" class="tick">{t('lesson.random.frequency')}</text>{/if}
      {#each layout.nodes as n (n.id)}
        <text
          x={(X1 + X2) / 2}
          y={(n.first.y + n.y) / 2 - 5}
          class="node node--small"
          text-anchor="middle">{f2(n.q)}</text
        >
        <text x={X2} y={n.y + 4} class="node" text-anchor="middle">{n.label}</text>
        <text x={XP} y={n.y + 4} class="node">{f(n.p)}</text>
        {#if draws}<text x={XF} y={n.y + 4} class="node node--muted">{f(frequency(n.id))}</text
          >{/if}
      {/each}
    </svg>
    <p class="small muted" style="margin: 0">
      {t('lesson.random.tree')} · P(A ∩ B) = P(A) × P<sub>A</sub>(B)
      {#if draws}
        · {t('lesson.random.frequency')} ({t('lesson.random.draws', { n: draws })}){/if}
    </p>
    <div class="scroll-x">
      <table class="law" data-testid="random-tree-table">
        <tbody>
          {#each tree.second as b (b.id)}
            <tr>
              <th scope="row">{t('lesson.random.total')} P({L(b.label)})</th>
              <td>{f(totalProbability(tree, b.id))}</td>
              <td></td>
            </tr>
          {/each}
          {#if eventB}
            {#each tree.first as a (a.id)}
              {@const independent = isIndependent(tree, a.id, eventB.id)}
              <tr>
                <th scope="row"
                  >{t('lesson.random.conditional')} P({L(a.label)}
                  {t('lesson.random.given')}
                  {L(eventB.label)})</th
                >
                <td>{f(conditionalProbability(tree, a.id, eventB.id))}</td>
                <td
                  >P<sub>{L(a.label)}</sub>({L(eventB.label)}) = {f(
                    givenProbability(tree, a.id, eventB.id)
                  )}
                  {independent ? '=' : '≠'} P({L(eventB.label)}) = {f(
                    totalProbability(tree, eventB.id)
                  )} → {independent
                    ? t('lesson.random.independent')
                    : t('lesson.random.dependent')}</td
                >
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  {:else if tool.mode === 'sampling'}
    <svg viewBox="0 0 {W} {H}" class="tool__svg" role="img" aria-label={t('lesson.tool.random')}>
      {#if interval}
        <rect
          x={sx(interval[0])}
          y={pad.t}
          width={sx(interval[1]) - sx(interval[0])}
          height={plotH}
          fill="#5ee6a8"
          opacity="0.12"
        />
      {/if}
      {#each xTicks as v (v)}
        <line x1={sx(v)} y1={pad.t} x2={sx(v)} y2={H - pad.b} class="grid" />
        <text x={sx(v)} y={H - pad.b + 14} class="tick" text-anchor="middle">{f2(v)}</text>
      {/each}
      {#if centre !== null}
        <line
          x1={sx(centre)}
          y1={pad.t}
          x2={sx(centre)}
          y2={H - pad.b}
          stroke="#fff"
          stroke-width="1.5"
          stroke-dasharray="4 4"
        />
        <text x={sx(centre) + 4} y={pad.t + 12} class="note">{law ? 'E' : 'p'} = {f(centre)}</text>
      {/if}
      {#each samples as s, i (i)}
        <circle
          cx={sx(s)}
          cy={H - pad.b - 8 - (i % 24) * 7}
          r="3.2"
          fill="#ffb347"
          opacity="0.85"
        />
      {/each}
      {#if law}
        <text x={W - pad.r} y={H - 6} class="tick" text-anchor="end"
          >{t('lesson.random.sampleMeans')}</text
        >
      {/if}
    </svg>
    <p class="small muted" style="margin: 0" data-testid="random-sampling">
      {t('lesson.random.samplesOf', { n: samples.length, size: tool.sample })}
      {#if samplesMean !== null}
        · {t(law ? 'lesson.random.meansMean' : 'lesson.random.samplesMean')}
        {f(samplesMean)}{law ? unit : ''}{/if}
      {#if interval && samples.length}
        · {t('lesson.random.inInterval', { n: inInterval, total: samples.length })}{/if}
    </p>
  {:else}
    <svg viewBox="0 0 {W} {H}" class="tool__svg" role="img" aria-label={t('lesson.tool.random')}>
      {#each [0, 0.25, 0.5, 0.75, 1] as v (v)}
        <line x1={pad.l} y1={sy(v)} x2={W - pad.r} y2={sy(v)} class="grid" />
        <text x={pad.l - 6} y={sy(v) + 3} class="tick" text-anchor="end">{f(v)}</text>
      {/each}
      {#each outcomes as o, i (o.id)}
        {@const x = pad.l + i * barW}
        <rect
          x={x + barW * 0.15}
          y={sy(frequency(o.id))}
          width={barW * 0.45}
          height={sy(0) - sy(frequency(o.id))}
          fill={colorOf(o.id, i)}
          opacity="0.85"
        />
        <rect
          x={x + barW * 0.62}
          y={sy(o.p)}
          width={barW * 0.2}
          height={sy(0) - sy(o.p)}
          fill="#fff"
          opacity="0.35"
        />
        <text x={x + barW / 2} y={H - pad.b + 14} class="tick" text-anchor="middle"
          >{labelOf(o.id)}</text
        >
        <text x={x + barW * 0.37} y={sy(frequency(o.id)) - 4} class="note" text-anchor="middle"
          >{draws ? f(frequency(o.id)) : ''}</text
        >
      {/each}
    </svg>
    <p class="small muted" style="margin: 0">
      <span class="swatch" style="background: #7f9cff"></span>{t('lesson.random.frequency')} ({t(
        'lesson.random.draws',
        { n: draws }
      )})
      <span class="swatch" style="background: rgba(255,255,255,0.35)"></span>{t(
        'lesson.random.probability'
      )}
    </p>
  {/if}
  {#if tool.event}
    <p class="small" style="margin: 0">
      {t('lesson.random.event')} « {L(tool.event.label)} » : {tool.event.outcomes
        .map(labelOf)
        .join(', ')}
      {#if p !== null}
        · {t('lesson.random.probability')} {f(p)}{/if}
      {#if eventFrequency !== null}
        · {t('lesson.random.frequency')} {f(eventFrequency)}{/if}
    </p>
  {/if}
  {#if tool.variable && law}
    <div class="scroll-x">
      <table class="law" data-testid="random-law">
        <caption>{t('lesson.random.law')} · {L(tool.variable.label)}</caption>
        <tbody>
          <tr>
            <th scope="row">x<sub>i</sub></th>
            {#each law as e (e.x)}<td>{f2(e.x)}{unit}</td>{/each}
          </tr>
          <tr>
            <th scope="row">p<sub>i</sub></th>
            {#each law as e (e.x)}<td>{f(e.p)}</td>{/each}
          </tr>
          {#if draws}
            <tr>
              <th scope="row">f<sub>i</sub></th>
              {#each law as e (e.x)}<td>{f(valueFrequency(e.x))}</td>{/each}
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
    <p class="small" style="margin: 0" data-testid="random-variable">
      {t('lesson.random.expectation')} E = {f(expectation(law))}{unit} ·
      {t('lesson.random.variance')} V = {f(variance(law))}{unit ? `${unit}²` : ''} ·
      {t('lesson.random.std')} σ = {f(stdDeviation(law))}{unit}
    </p>
  {/if}
  {#if interactive}
    <div class="cluster" data-testid="random-controls">
      {#if tool.mode === 'sampling'}
        {#each [1, 10, 100] as n (n)}
          <button
            class="btn btn--sm"
            type="button"
            onclick={() => sample(n)}
            data-testid="random-sample-{n}"
            >{t('lesson.random.sample', { n, size: tool.sample })}</button
          >
        {/each}
      {:else}
        {#each [1, 10, 100, 1000] as n (n)}
          <button
            class="btn btn--sm"
            type="button"
            onclick={() => draw(n)}
            data-testid="random-draw-{n}">{t('lesson.random.draw', { n })}</button
          >
        {/each}
      {/if}
      <button class="btn btn--sm btn--ghost" type="button" onclick={reset}
        >{t('lesson.random.reset')}</button
      >
    </div>
  {/if}
</div>

<style>
  .tool__svg {
    width: 100%;
    height: auto;
    display: block;
    border-radius: var(--radius);
    background: #070b17;
  }
  .grid {
    stroke: rgba(255, 255, 255, 0.08);
  }
  .tick {
    font-size: 11px;
    fill: #a7b0c8;
    font-family: var(--font-body);
  }
  .note {
    font-size: 12px;
    fill: #eef1f8;
    font-family: var(--font-body);
    font-weight: 600;
  }
  /* Labels of the tree sit on the branches: an outline keeps them legible. */
  .node {
    font-size: 13px;
    fill: #eef1f8;
    font-family: var(--font-body);
    font-weight: 600;
    paint-order: stroke;
    stroke: #070b17;
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .node--small {
    font-size: 11px;
    font-weight: 500;
  }
  .node--muted {
    fill: #a7b0c8;
  }
  .swatch {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 3px;
    margin: 0 0.3rem 0 0.6rem;
    vertical-align: middle;
  }
  .law {
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  .law caption {
    caption-side: top;
    text-align: left;
    color: var(--muted);
    padding-bottom: 0.25rem;
  }
  .law th,
  .law td {
    padding: 0.25rem 0.6rem;
    border: 1px solid var(--border);
    text-align: center;
  }
  .law th[scope='row'] {
    white-space: nowrap;
  }
  .law th[scope='row'] {
    text-align: left;
    font-weight: 600;
  }
</style>
