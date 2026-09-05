# ADR-0004: Content authored in YAML with Markdown + LaTeX strings, validated by zod

- Status: accepted
- Date: 2026-09-05

## Context

The universe is content: nodes, edges, missions, exercises, simulations, people, places, sources, curricula. Authoring must be possible without touching application code, in French and English, with historical claims carrying their evidence status.

## Decision

- Sources live under `content/` as YAML files, one node per file, with `{fr, en}` localised fields and Markdown strings that may contain `$…$` / `$$…$$` LaTeX.
- The zod schemas in `src/lib/content-schema/` are the single source of truth for shapes; JSON Schema files can be exported for editors.
- `scripts/compile-content.ts` validates every file, checks cross references (identifiers, prerequisites, fr/en parity, historical sources, coverage eligibility, exercise/simulation consistency), computes the frozen layout and emits the versioned package in `static/content/core-<version>/` together with `report.json`. Errors fail the build; warnings are shown in the Studio.
- The compiled package is generated (ignored by git) before `dev`, `build` and `test`.

## Consequences

- Content mistakes are caught at build time, not by the learner.
- The application only ever reads compiled JSON, so runtime code never parses YAML.
