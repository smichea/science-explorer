<script lang="ts">
  import { onMount } from 'svelte';
  import type { CompiledLayout, Locale } from '$lib/content-schema';
  import type { GraphIndex } from '$lib/domain/graph';
  import type { PerformanceMode } from '$lib/persistence/localStorage';
  import { AtlasScene, type FocusTarget } from './scene';
  import type { NodeStyle, RouteStyle } from './styles';
  import type { ZoomLevel } from './zoom';
  import { t } from '$lib/state/locale.svelte';

  interface Props {
    graph: GraphIndex;
    layout: CompiledLayout;
    styles: Map<string, NodeStyle>;
    routes: RouteStyle[];
    focus: FocusTarget | null;
    focusKey: number;
    locale: Locale;
    performance: PerformanceMode;
    reducedMotion: boolean;
    labelText: (id: string, kind: 'node' | 'region' | 'world' | 'hub') => string;
    onselect: (id: string, kind: 'node' | 'region' | 'world') => void;
    onhover?: (id: string | null) => void;
    onzoom?: (level: ZoomLevel) => void;
    oncontextlost?: () => void;
  }

  let { graph, layout, styles, routes, focus, focusKey, locale, performance, reducedMotion, labelText, onselect, onhover, onzoom, oncontextlost }: Props = $props();

  let container: HTMLDivElement;
  let scene: AtlasScene | null = null;
  let firstFocusDone = false;

  onMount(() => {
    try {
      scene = new AtlasScene(container, graph, layout, locale, performance, reducedMotion, {
        onSelect: (id, kind) => {
          if (id) onselect(id, kind);
        },
        onHover: (id) => onhover?.(id),
        onZoom: (level) => onzoom?.(level),
        labelText,
      });
    } catch (e) {
      console.warn('WebGL unavailable', e);
      oncontextlost?.();
      return;
    }
    const observer = new ResizeObserver(() => scene?.resize());
    observer.observe(container);
    const lost = () => oncontextlost?.();
    container.addEventListener('atlas-context-lost', lost);
    return () => {
      observer.disconnect();
      container.removeEventListener('atlas-context-lost', lost);
      scene?.dispose();
      scene = null;
    };
  });

  $effect(() => {
    scene?.setStyles(styles, routes);
  });
  $effect(() => {
    scene?.setLocale(locale);
  });
  $effect(() => {
    scene?.setPerformance(performance);
  });
  $effect(() => {
    scene?.setReducedMotion(reducedMotion);
  });
  $effect(() => {
    void focusKey;
    if (!scene || !focus) return;
    scene.focus(focus, firstFocusDone);
    firstFocusDone = true;
  });
</script>

<div class="atlas" bind:this={container} role="img" aria-label={t('universe.canvasLabel')} data-testid="atlas-3d"></div>

<style>
  .atlas {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #070b17;
    cursor: grab;
  }
</style>
