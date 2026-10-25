<script lang="ts">
  import { lambdaAt, redexPaths, type LambdaTerm, type LambdaReduction } from '$lib/domain/lambda';
  import { lambdaDiagram, morphDiagram } from '$lib/domain/lambdaDiagram';
  import { locale } from '$lib/state/locale.svelte';
  import { lambdaText } from '../lambdaText';
  let {
    term,
    names = false,
    selectedPath = null,
    animation = null,
    onselect,
  }: {
    term: LambdaTerm;
    names?: boolean;
    selectedPath?: string | null;
    animation?: { reduction: LambdaReduction; progress: number } | null;
    onselect?: (path: string) => void;
  } = $props();
  const text = $derived(lambdaText(locale.current));
  const layout = $derived(lambdaDiagram(term));
  const destination = $derived(animation ? lambdaDiagram(animation.reduction.after) : null);
  const strokes = $derived(
    animation && destination
      ? morphDiagram(layout, destination, animation.reduction, animation.progress)
      : layout.strokes.map((s) => ({ ...s, opacity: 1 }))
  );
  const redexes = $derived(redexPaths(term).map((path) => ({ path, term: lambdaAt(term, path) })));
  const selected = $derived(
    selectedPath !== null ? redexes.find((r) => r.path === selectedPath)?.term : undefined
  );
  const binder = $derived(selected?.kind === 'app' ? selected.fun.id : undefined);
  const argument = $derived(
    selected?.kind === 'app' ? layout.bounds.get(selected.arg.id) : undefined
  );
  const width = $derived(Math.max(layout.width, destination?.width ?? 0));
  const height = $derived(Math.max(layout.height, destination?.height ?? 0));
</script>

<div class="tromp" data-testid="lambda-drawing">
  <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={text.diagram}>
    <title>{text.diagram}</title>
    {#if argument && !animation}
      <rect
        x={argument.x}
        y={argument.y}
        width={argument.width}
        height={argument.height}
        rx="9"
        fill="#74ddcf"
        opacity="0.08"
        stroke="#74ddcf"
        stroke-dasharray="5 5"
      />
    {/if}
    {#each strokes as s (s.key)}
      {@const hot =
        s.owner === selected?.id ||
        (binder !== undefined && (s.owner === binder || s.binder === binder))}
      {@const color = hot
        ? '#ff94cf'
        : s.kind === 'bar'
          ? '#aacbff'
          : s.kind === 'join'
            ? '#ffd083'
            : '#74ddcf'}
      <g opacity={s.opacity}>
        <line
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={color}
          stroke-width={s.kind === 'bar' ? 4 : 2.5}
          stroke-linecap="round"
        />
        {#if s.dots !== 'none'}<circle cx={s.x1} cy={s.y1} r="3.8" fill={color} />{/if}
        {#if s.dots === 'both'}<circle cx={s.x2} cy={s.y2} r="3.8" fill={color} />{/if}
        {#if s.label && s.kind === 'wire'}<text
            x={s.x1}
            y={s.y1 - 10}
            text-anchor="middle"
            fill="#f1e9db">{s.label}</text
          >{/if}
        {#if names && s.kind === 'bar'}<text
            x={s.x1 - 6}
            y={s.y1 + 4}
            text-anchor="end"
            fill={color}>{s.label}</text
          >{/if}
      </g>
    {/each}
    {#if onselect && !animation}
      {#each redexes as r, i (r.path)}
        {@const link = layout.strokes.find((s) => s.owner === r.term.id && s.kind === 'join')!}
        <g
          role="button"
          tabindex="0"
          aria-label={`β${i + 1}`}
          aria-pressed={selectedPath === r.path}
          data-testid="lambda-redex"
          data-path={r.path}
          onclick={() => onselect?.(r.path)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onselect?.(r.path);
            }
          }}
        >
          <line
            x1={link.x1}
            y1={link.y1}
            x2={link.x2}
            y2={link.y2}
            stroke="transparent"
            stroke-width="22"
          />
          <text x={(link.x1 + link.x2) / 2} y={link.y1 + 17} fill="#ffb8e0" text-anchor="middle"
            >β{i + 1}</text
          >
        </g>
      {/each}
    {/if}
  </svg>
</div>

<style>
  .tromp {
    background: #101d2b;
    border: 1px solid #31475d;
    border-radius: 0.8rem;
    overflow: auto;
  }
  svg {
    display: block;
    width: 100%;
    min-width: 240px;
    max-height: 440px;
  }
  text {
    font:
      12px ui-monospace,
      monospace;
  }
  g[role='button'] {
    cursor: pointer;
    outline: none;
  }
  g[role='button']:focus-visible line {
    stroke: #fff5;
  }
</style>
