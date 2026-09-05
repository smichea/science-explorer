# ADR-0009: Progressive web app with updates applied on the next launch

- Status: accepted
- Date: 2026-09-05

## Context

A weekly session must not depend on the network, and an update must never interrupt a mission in progress.

## Decision

- A hand-written service worker (`src/service-worker.ts`, built by SvelteKit) precaches the application shell, the compiled content package and static files at install; navigation requests fall back to the cached shell; same-origin responses are cached on use.
- A new version installs in the background and is activated on the next launch; old caches are removed on activation.
- The web manifest declares a standalone display, icons and a scope under the deployment base path.

## Consequences

- After the first visit the whole product works offline; the offline banner tells the learner what is happening.
- Immediate "reload to update" prompts are avoided by design.
