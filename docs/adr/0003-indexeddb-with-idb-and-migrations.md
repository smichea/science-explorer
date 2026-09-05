# ADR-0003: IndexedDB through `idb` with in-house migrations

- Status: accepted
- Date: 2026-09-05

## Context

Progress must be kept on the device (no accounts), survive restarts, hold thousands of immutable evidence events and remain exportable. localStorage is too small and synchronous; a full ORM would hide the schema the specification describes.

## Decision

- localStorage holds only the small bootstrap state (schema version, active profile id, profile index, locale, UI preferences).
- IndexedDB database `science-explorer` (version 1) holds the stores of the technical architecture §6.2: profiles, profile settings, mission sessions, evidence events, journal entries, content packages, exports metadata and caches.
- Access goes through the thin `idb` wrapper and typed repositories (`src/lib/persistence/repositories.ts`); schema upgrades are explicit functions keyed by version in `db.ts`.
- Step completion is atomic: session state, evidence events and the resume point are written in one transaction (`sessionRepo.commitStep`).

## Consequences

- Derived caches (node states, coverage, mastery) are recomputable from evidence, so a bug in a score never corrupts the record of what happened.
- Unit tests run against `fake-indexeddb`; end-to-end tests use fresh browser contexts.
