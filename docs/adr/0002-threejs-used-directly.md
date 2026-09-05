# ADR-0002: Three.js used directly inside one Svelte component (Threlte deferred)

- Status: accepted
- Date: 2026-09-05

## Context

The atlas is the central experience: a stable 3D universe with worlds, regions, routes, nodes, labels, semantic zoom, selection and camera flights. Rendering must stay deterministic and must degrade gracefully (2D map, list) on weak devices.

## Decision

- Encapsulate Three.js in `src/lib/atlas/scene.ts` (`AtlasScene`), created once in `onMount` of `Atlas.svelte` and updated through explicit methods (`setStyles`, `setRoutes`, `focus`, `setLocale`); the scene is never recreated on state changes.
- Labels are DOM elements positioned by `CSS2DRenderer`, which keeps them accessible, localisable and stylable, with a per-zoom label budget and overlap removal.
- Picking uses a `Raycaster`; `OrbitControls` provides touch-friendly navigation.
- Threlte (declarative Three.js for Svelte) is deferred: the current scene has a small number of object kinds and imperative control over label budgets and tweens is simpler to reason about.

## Consequences

- One well-defined imperative boundary; the rest of the UI stays declarative.
- The 2D map (`Map2D.svelte`) and the destination list share the same selection service and the same frozen layout, so every destination exists without WebGL.
