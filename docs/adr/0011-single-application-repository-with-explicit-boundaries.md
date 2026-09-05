# ADR-0011: Single application repository with explicit module boundaries

- Status: accepted
- Date: 2026-09-05

## Context

The architecture describes several packages (content schema, domain services, persistence, atlas, missions). A multi-package workspace adds tooling for one small team.

## Decision

Keep one SvelteKit application and enforce boundaries by directory:

- `src/lib/content-schema` — zod schemas and compiled types (no imports from the app);
- `src/lib/domain` — pure TypeScript services (horizon, graph, layout, mission machine, engines, answers, progression, i18n, transfer); no Svelte, no browser APIs except `crypto` in transfer;
- `src/lib/persistence` — localStorage and IndexedDB access;
- `src/lib/state` — Svelte 5 rune stores that orchestrate domain and persistence;
- `src/lib/atlas`, `missions`, `simulations`, `exercises`, `components` — user interface;
- `scripts/` — content compiler; `content/` — authored sources; `tests/` — unit, content and end-to-end tests.

## Consequences

- Domain rules are testable with Vitest in Node; the UI computes no rule itself.
- The directories can be extracted into packages later without changing imports inside them.
