# ADR-0007: Authored hybrid layout frozen per content version

- Status: accepted
- Date: 2026-09-05

## Context

The universe must look the same at every session and on every device so that spatial memory works, yet authors should not place hundreds of nodes by hand.

## Decision

- Worlds sit on a ring, bridge hubs between them, regions at authored anchors (`content/layout/anchors.yaml`) relative to their world, detailed nodes on a golden-angle spiral around their region ordered by importance, with a small vertical offset per curriculum stage so the next stage looks a little further away.
- The layout is computed by `src/lib/domain/layout.ts` during content compilation and written to `layout.json`; the application never recomputes positions at runtime.
- A new content version may move nodes; positions are stable within a version.

## Consequences

- The 3D atlas, the 2D map and the list share one set of coordinates.
- Force-directed layouts were rejected because they are not deterministic across devices and drift as content grows.
