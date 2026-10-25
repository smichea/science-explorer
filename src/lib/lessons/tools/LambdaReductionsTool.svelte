<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import type { LessonTool } from '$lib/content-schema';
  import {
    LambdaError,
    LAMBDA_EXAMPLES,
    parseLambda,
    printLambda,
    lambdaAt,
    reductionGraph,
    redexPaths,
    type ReductionEdge,
    type ReductionGraph,
    type LambdaStrategy,
  } from '$lib/domain/lambda';
  import { locale } from '$lib/state/locale.svelte';
  import { prefs } from '$lib/state/prefs.svelte';
  import { lambdaText } from '../lambdaText';
  import LambdaGraph3D from './LambdaGraph3D.svelte';
  import LambdaDiagram from './LambdaDiagram.svelte';
  type Tool = Extract<LessonTool, { kind: 'lambda_reductions' }>;
  let {
    tool,
    source,
    interactive = false,
    onterm,
  }: {
    tool: Tool;
    source?: string;
    interactive?: boolean;
    onterm?: (source: string) => void;
  } = $props();
  const text = $derived(lambdaText(locale.current));
  let draft = $state('');
  let activeSource = $state('λx. x');
  let depth = $state(5);
  let graph = $state.raw<ReductionGraph>(reductionGraph(parseLambda('λx. x')));
  let selected = $state(0);
  let traversed = $state<number[]>([]);
  let trail = $state<number[]>([0]);
  let motion = $state<{ edge: number; progress: number } | null>(null);
  let error = $state.raw<LambdaError | null>(null);
  let strategy = $state<LambdaStrategy>('normal');
  let frame = 0;
  let loadedSource = '';
  const node = $derived(graph.nodes[selected] ?? graph.nodes[0]);
  const outgoing = $derived(graph.edges.filter((e) => e.from === selected));
  const nextPath = $derived(redexPaths(node.term, strategy)[0]);
  const nextEdge = $derived(outgoing.find((e) => e.path === nextPath));
  const errorText = $derived(
    error
      ? error.code === 'syntax'
        ? `${text.errorSyntax} ${error.position + 1}.`
        : error.code === 'depth'
          ? text.errorDepth
          : text.errorSize
      : ''
  );
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    motion = null;
  }
  function build(value: string, notify = false) {
    stop();
    try {
      const term = parseLambda(value);
      graph = reductionGraph(term, depth, tool.maxNodes);
      activeSource = value;
      draft = value;
      loadedSource = value;
      selected = 0;
      trail = [0];
      traversed = [];
      error = null;
      if (notify) onterm?.(value);
    } catch (e) {
      error = e instanceof LambdaError ? e : new LambdaError('syntax');
    }
  }
  $effect(() => {
    const value = source ?? tool.term;
    const initialDepth = tool.maxDepth;
    untrack(() => {
      if (value !== loadedSource) {
        depth = initialDepth;
        build(value);
      }
    });
  });
  onDestroy(stop);
  function select(id: number) {
    stop();
    selected = id;
  }
  function follow(edge: ReductionEdge) {
    stop();
    if (trail[trail.length - 1] !== edge.from) {
      trail = [edge.from];
      traversed = [];
    }
    const finish = () => {
      traversed = [...traversed, edge.id].slice(-120);
      trail = [...trail, edge.to].slice(-121);
      selected = edge.to;
      motion = null;
    };
    if (prefs.reducedMotion) {
      finish();
      return;
    }
    const start = performance.now();
    motion = { edge: edge.id, progress: 0 };
    const tick = (now: number) => {
      const progress = (now - start) / 650;
      if (progress >= 1) finish();
      else {
        motion = { edge: edge.id, progress };
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
  }
</script>

<div class="lambda-graph stack-sm" data-testid="lambda-reductions-tool">
  {#if interactive}
    <label class="field"
      >{text.examples}
      <select
        aria-label={text.examples}
        value=""
        onchange={(e) => {
          const example = LAMBDA_EXAMPLES.find((v) => v.id === e.currentTarget.value);
          if (example) build(example.source, true);
        }}
      >
        <option value="">{text.custom}</option
        >{#each LAMBDA_EXAMPLES as example (example.id)}<option value={example.id}
            >{example[locale.current]}</option
          >{/each}
      </select>
    </label>
    <form
      onsubmit={(e) => {
        e.preventDefault();
        build(draft, true);
      }}
      class="stack-sm"
    >
      <label class="field"
        >{text.source}<textarea
          rows="2"
          spellcheck="false"
          bind:value={draft}
          data-testid="lambda-graph-input"></textarea></label
      >
      <div class="cluster">
        <label
          >{text.depth} <input type="number" min="1" max="10" bind:value={depth} required /></label
        ><button class="btn" type="submit" data-testid="lambda-explore">{text.explore}</button>
      </div>
    </form>
    <p class="small muted">{text.syntax}</p>
  {/if}
  {#if error}<p class="error" role="alert">{errorText}</p>{/if}
  <p class="small">{text.graphMeaning}</p>
  <div class="graph-controls">
    <label class="field"
      >{text.strategy}<select bind:value={strategy}
        ><option value="normal">{text.normal}</option><option value="applicative"
          >{text.applicative}</option
        ></select
      ></label
    >
    <div class="cluster">
      <button
        class="btn btn--primary"
        data-testid="lambda-graph-step"
        disabled={!nextEdge || motion !== null}
        onclick={() => nextEdge && follow(nextEdge)}>{text.step}</button
      >
      <button class="btn" onclick={() => build(activeSource)}>{text.reset}</button>
    </div>
  </div>
  <LambdaGraph3D {graph} {selected} {traversed} {motion} onselect={select} onfollow={follow} />
  <div class="cluster">
    <span>{text.vertices} : <strong>{graph.nodes.length}</strong></span><span
      >{text.edges} : <strong>{graph.edges.length}</strong></span
    ><span>✓ {text.normalNode}</span><span>◌ {text.frontier}</span>
  </div>
  <p role="status" class="small" data-testid="lambda-graph-status">
    {graph.truncated ? text.partial : text.complete}
  </p>
  <p class="trail" data-testid="lambda-trail">
    {text.trail} ({traversed.length}) : {trail.join(' → ')}
  </p>
  <div class="outgoing">
    <strong>{text.outgoing}</strong>
    {#each outgoing as edge, i (edge.id)}<button
        class="btn btn--sm"
        disabled={motion !== null}
        data-testid="lambda-follow-edge"
        data-path={edge.path}
        onclick={() => follow(edge)}
        >{text.follow}
        {edge.from} → {edge.to} · β{i + 1} :
        <code>{printLambda(lambdaAt(node.term, edge.path))}</code></button
      >{/each}
    {#if !outgoing.length}<p class="small muted">{text.graphEmpty}</p>{/if}
  </div>
  <p class="small muted">{text.inspectHint}</p>
  <label class="field"
    >{text.inspect}
    <select
      aria-label={text.inspect}
      value={selected}
      onchange={(e) => select(Number(e.currentTarget.value))}
      data-testid="lambda-node-select"
    >
      {#each graph.nodes as item (item.id)}<option value={item.id}
          >{item.id} · {printLambda(item.term)}</option
        >{/each}
    </select>
  </label>
  <code class="expression" data-testid="lambda-graph-term">{printLambda(node.term)}</code>
  <p class="small">
    {text.size} : {node.size}. {node.normal ? text.noRedex : node.frontier ? text.frontier : ''}
  </p>
  <details><summary>{text.diagram}</summary><LambdaDiagram term={node.term} names /></details>
</div>

<style>
  .lambda-graph {
    min-width: 0;
  }
  textarea,
  select {
    width: 100%;
    min-width: 0;
  }
  textarea,
  select,
  input[type='number'] {
    background: #101d2b;
    color: #f1e9db;
    border: 1px solid #51617c;
    border-radius: 0.5rem;
    padding: 0.55rem 0.65rem;
    font: inherit;
  }
  .graph-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.5rem 1rem;
  }
  .graph-controls .field {
    flex: 1 1 260px;
  }
  details summary {
    cursor: pointer;
    margin-bottom: 0.6rem;
  }
  textarea,
  code {
    font-family: ui-monospace, monospace;
  }
  input[type='number'] {
    width: 5rem;
  }
  p {
    margin: 0;
  }
  .expression {
    display: block;
    background: #101d2b;
    color: #fff3df;
    padding: 0.6rem;
    border-radius: 0.4rem;
    overflow-wrap: anywhere;
  }
  .outgoing {
    display: grid;
    gap: 0.4rem;
  }
  .outgoing button {
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .trail {
    overflow-wrap: anywhere;
    padding-left: 0.7rem;
    border-left: 3px solid #d8ab62;
  }
  .error {
    color: var(--color-danger, #cf5365);
  }
</style>
