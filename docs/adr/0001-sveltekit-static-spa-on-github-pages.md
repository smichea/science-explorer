# ADR-0001: SvelteKit static single-page application deployed on GitHub Pages

- Status: accepted
- Date: 2026-09-05

## Context

The specifications require a local-first, installable web application with stable deep links for every destination (`/concept/:id`, `/mission/:id`, …), no server-side accounts and a deployment that a single parent can operate. The technical architecture recommends SvelteKit with TypeScript.

## Decision

- Build the application with **SvelteKit 2 (Svelte 5 runes) and strict TypeScript**, rendered entirely on the client (`ssr = false`, `prerender = false`).
- Use `@sveltejs/adapter-static` with a `404.html` fallback so that GitHub Pages serves the same shell for every deep link.
- Read the deployment base path from `BASE_PATH` (`/science-explorer` on Pages, empty locally) through `paths.base`; every link and fetch goes through `$app/paths`.
- Deploy from `main` with GitHub Actions (`.github/workflows/deploy.yml`); continuous integration (`ci.yml`) validates content, lint, types, unit tests, the build and the Playwright journeys on three viewports.

## Consequences

- No server is needed; the whole product is a static bundle plus a compiled content package.
- Deep links work on Pages through the 404 fallback; the trade-off is a 404 status on the first request of a deep link, which browsers and the service worker tolerate.
- Search engines are irrelevant for this product, so client-only rendering costs nothing.
