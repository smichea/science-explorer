# Science Explorer

Science Explorer is a bilingual, immersive learning environment in which mathematics, physics, chemistry, and the history of science form one explorable knowledge universe.

The product is designed first for a learner entering the French **Terminale → MPSI → MP** path and preparing over three years for highly selective examinations such as **ENS** and **École polytechnique**. Its architecture must nevertheless support other ages, horizons, curricula, and learners.

## Product idea

The learner does not follow a fixed list of chapters. They enter a stable 3D atlas of scientific knowledge, choose destinations, take part in historical scientific missions, build mathematical tools, and apply those tools to physical and chemical phenomena.

The same knowledge universe is visible from the first session. A learner profile changes the highlighted horizon, recommended depth, and available missions, but it does not replace the universe with a separate map or enforce hard locks.

## Core principles

- **One universe, several views:** concepts, applications, history, prerequisites, and progress are layers over the same map.
- **Mathematics is the toolbox:** mathematical ideas are constructed and then reused to model phenomena in physics and chemistry.
- **Every activity is a scenario:** each mission takes place at a specific location and time and involves one or more scientists of that period.
- **Free but guided exploration:** learners may go deeper, return to foundations, or branch into another domain.
- **Evidence-based progression:** the virtual backpack shows both mastery and the percentage of relevant phenomena in which each tool has actually been applied.
- **Bilingual by design:** the complete learner experience and authored content are available in French and English.
- **Local-first:** name and age are stored locally; detailed progress is kept on the device and can be exported.

## Reference learner

The initial reference profile is:

```yaml
name: Paul
age: 17
current_stage: terminale
horizon:
  - terminale
  - mpsi
  - mp
targets:
  - ENS
  - Ecole_polytechnique
language_options:
  - fr
  - en
```

Age selects a default learning horizon, not an absolute permission boundary. Paul may inspect or attempt an MP destination immediately; the application should expose the useful prerequisite routes rather than display a closed lock.

## Status

The [initial implementation target](#initial-implementation-target) below is implemented as a complete vertical slice: bilingual local onboarding, the three worlds with every region visible from the first session, the derivative tool at three depths, eight linked phenomena, the historical mission *Galileo in Padua: the inclined plane*, two reusable simulation engines, five exercise types with evidence collection, the virtual backpack (application coverage and mastery), learner and guide views, offline use as an installable progressive web app, and local persistence with export/import.

## Getting started

Requirements: Node.js 22 and npm.

```bash
npm ci
npm run dev          # compiles the content package, then starts Vite on http://localhost:5173
```

Useful scripts:

| Script | What it does |
|--------|--------------|
| `npm run content:validate` | Validates every YAML file under `content/` and prints errors and warnings without writing the package |
| `npm run content:compile` | Validates and writes the compiled package to `static/content/core-<version>/` (generated, not committed) |
| `npm run check` | Type-checks Svelte and TypeScript sources with `svelte-check` |
| `npm run lint` / `npm run format` | Prettier and ESLint |
| `npm test` | Unit and content tests (Vitest) |
| `npm run test:e2e` | Playwright journeys on three viewports (phone, tablet, desktop); builds and serves the app itself |
| `npm run build` / `npm run preview` | Production build (static SPA) and local preview |

Set `BASE_PATH=/science-explorer` when building for GitHub Pages; leave it empty for a root deployment.

## Repository layout

```text
content/            authored sources (YAML, Markdown + LaTeX strings, fr/en fields)
  graph/            worlds and regions, one node per file, typed edges
  curricula/        stage inference rules and programme alignments
  missions/         historical missions (steps, evidence, variants)
  exercises/        numeric, choice, ordering, symbolic and free-explanation exercises
  simulations/      engine configurations (motion_2d, first_order)
  people/ places/ periods/ sources/ glossary/ routes/ layout/
scripts/            content compiler and validator (tsx)
src/lib/
  content-schema/   zod schemas: the source of truth for content shapes
  domain/           pure services: horizon, graph, layout, mission machine, engines,
                    answers, progression (status, coverage-0.1, mastery-0.1), i18n, transfer
  persistence/      localStorage bootstrap state and IndexedDB repositories
  state/            Svelte 5 rune stores (locale, profile, content, learning, selection, guide)
  atlas/            Three.js scene, 2D map, destination list, semantic zoom and styles
  missions/ simulations/ exercises/ components/ accessibility/
src/routes/         welcome, profiles, universe/world/region/concept, mission, backpack,
                    journal, timeline, settings, guide/*, studio/*
tests/              unit (Vitest), content (package invariants), e2e (Playwright)
docs/               specifications, content authoring guide, parent guide, ADRs
```

## Content pipeline

Content is compiled, never parsed at runtime: `scripts/compile-content.ts` loads the YAML sources, validates them against the zod schemas, checks cross references (identifiers, prerequisites, French/English parity, historical sources and evidence statuses, coverage eligibility, exercise and simulation consistency), computes the frozen layout of the universe and writes the versioned JSON package with a validation report. Errors fail the build; warnings appear in the Studio inside the app. See [docs/CONTENT_AUTHORING.md](docs/CONTENT_AUTHORING.md).

## Deployment

`.github/workflows/ci.yml` runs on every push: content validation, lint, type-check, unit tests, a build with the Pages base path and the end-to-end journeys. `.github/workflows/deploy.yml` builds `main` and publishes it to GitHub Pages. Once, in the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**; the site is then served at `https://<owner>.github.io/science-explorer/`.

## Documentation

- [Parent guide (French)](docs/GUIDE.md) — how to run the weekly one-hour session
- [Content authoring](docs/CONTENT_AUTHORING.md) — adding nodes, missions, exercises and simulations
- [Architecture decision records](docs/adr/README.md)

## Specifications

- [Product and UX specification](docs/PRODUCT_SPECIFICATION.md)
- [Knowledge, content, and learning model](docs/LEARNING_AND_CONTENT_MODEL.md)
- [Technical architecture](docs/TECHNICAL_ARCHITECTURE.md)

## Initial implementation target

The first useful release is a complete vertical slice rather than a large but shallow map:

1. bilingual local onboarding;
2. a small 3D universe containing the three worlds;
3. one mathematical tool;
4. three linked physical or chemical phenomena;
5. one complete historical mission;
6. a reusable simulation;
7. exercises and evidence collection;
8. a working virtual backpack;
9. learner and guide views;
10. local persistence and progress export.

The specifications in this repository are the source of truth for the first implementation.
