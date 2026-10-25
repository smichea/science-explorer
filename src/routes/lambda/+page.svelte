<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { L } from '$lib/state/locale.svelte';
  import type { LessonTool } from '$lib/content-schema';
  import LambdaDiagramTool from '$lib/lessons/tools/LambdaDiagramTool.svelte';
  import LambdaReductionsTool from '$lib/lessons/tools/LambdaReductionsTool.svelte';
  let view = $derived<'diagram' | 'graph'>(
    page.url.searchParams.get('view') === 'graph' ? 'graph' : 'diagram'
  );
  let source = $state('(λx. x x) ((λy. y) (λz. z))');
  const diagram: Extract<LessonTool, { kind: 'lambda_diagram' }> = {
    id: 'diagram',
    kind: 'lambda_diagram',
    term: '(λx. x x) ((λy. y) (λz. z))',
    strategy: 'normal',
    maxSteps: 60,
  };
  const graph: Extract<LessonTool, { kind: 'lambda_reductions' }> = {
    id: 'graph',
    kind: 'lambda_reductions',
    term: diagram.term,
    maxDepth: 5,
    maxNodes: 60,
  };
</script>

<svelte:head
  ><title
    >{L({ fr: 'Atelier lambda-calcul', en: 'Lambda calculus workbench' })} · Science Explorer</title
  ></svelte:head
>
<div class="container workbench stack">
  <header class="stack-sm">
    <a class="small" href="{base}/concept/concept.lambda_calculus"
      >← {L({ fr: 'La destination dans l’atlas', en: 'The destination in the atlas' })}</a
    >
    <h1>{L({ fr: 'Atelier lambda-calcul', en: 'Lambda calculus workbench' })}</h1>
    <p>
      {L({
        fr: 'Écrire un terme, suivre son remplacement, puis explorer tous les choix de réduction accessibles.',
        en: 'Write a term, follow its substitution, then explore the reachable reduction choices.',
      })}
    </p>
    <div class="cluster">
      <a class="btn btn--sm" href="{base}/lesson/concept.lambda_calculus"
        >{L({
          fr: 'Leçon : lire et réduire un diagramme',
          en: 'Lesson: read and reduce a diagram',
        })}</a
      >
      <a class="btn btn--sm" href="{base}/lesson/concept.lambda_reduction_paths"
        >{L({ fr: 'Leçon : comparer les chemins', en: 'Lesson: compare paths' })}</a
      >
    </div>
  </header>
  <div
    class="segmented"
    role="tablist"
    aria-label={L({ fr: 'Choisir un outil', en: 'Choose a tool' })}
  >
    <button
      role="tab"
      aria-selected={view === 'diagram'}
      onclick={() => (view = 'diagram')}
      data-testid="lambda-tab-diagram"
      >{L({ fr: 'Diagramme et animation', en: 'Diagram and animation' })}</button
    >
    <button
      role="tab"
      aria-selected={view === 'graph'}
      onclick={() => (view = 'graph')}
      data-testid="lambda-tab-graph"
      >{L({ fr: 'Graphe des réductions en 3D', en: '3D reduction graph' })}</button
    >
  </div>
  <section
    class="card stack"
    aria-label={L({ fr: 'Laboratoire de calcul', en: 'Computation laboratory' })}
  >
    {#if view === 'diagram'}<LambdaDiagramTool
        tool={diagram}
        {source}
        interactive
        onterm={(value) => (source = value)}
      />
    {:else}<LambdaReductionsTool
        tool={graph}
        {source}
        interactive
        onterm={(value) => (source = value)}
      />{/if}
  </section>
  <p class="small muted">
    {L({ fr: 'Conventions graphiques :', en: 'Graphical conventions:' })}
    <a href="https://tromp.github.io/cl/diagrams.html" target="_blank" rel="noreferrer"
      >John Tromp, Lambda Diagrams</a
    >.
  </p>
</div>

<style>
  .workbench {
    max-width: 1040px;
    padding-block: var(--space-4);
  }
  header h1,
  header p {
    margin: 0;
  }
  .segmented {
    flex-wrap: wrap;
  }
  .segmented button {
    white-space: normal;
  }
  .segmented button[aria-selected='true'] {
    background: #7f9cff;
    color: #10172b;
    font-weight: 700;
  }
</style>
