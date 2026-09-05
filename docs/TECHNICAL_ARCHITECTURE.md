# Science Explorer — Technical Architecture Specification

**Status:** Draft v0.1  
**Date:** 2026-09-06

## 1. Architecture objectives

The implementation must support:

- an immersive but accessible 3D knowledge atlas;
- French and English from the first release;
- a local learner profile containing name and age;
- a Terminale → MPSI → MP horizon for the initial 17-year-old reference learner;
- offline-capable missions and simulations;
- a versioned knowledge graph and content packages;
- historical scenarios with sources and evidence labels;
- a virtual backpack with explainable progress metrics;
- deterministic local persistence and export;
- future guide and authoring tools;
- progressive expansion to the complete three-year corpus.

The initial architecture should remain simple enough for a small team to implement. It must not require a backend merely to launch the first useful release.

## 2. Recommended technology baseline

### 2.1 Application framework

Recommended:

- **SvelteKit**;
- **TypeScript** with strict checking;
- static or hybrid rendering depending on deployment;
- progressive web application support.

Reasons:

- component model suitable for interactive scientific interfaces;
- clean state and routing model;
- good fit for an installable local-first application;
- straightforward integration with Three.js, Web Workers, and browser storage.

The product specifications are framework-independent. A different stack may be selected through an architecture decision record if it preserves all requirements.

### 2.2 3D and visualisation

Recommended:

- **Three.js** as the rendering foundation;
- **Threlte** as the Svelte integration layer;
- WebGL as the compatibility baseline;
- optional WebGPU paths only after graceful fallback is proven;
- SVG or Canvas 2D for diagrams that do not benefit from 3D;
- a 2D accessible map alternative backed by the same graph data.

3D is used for spatial memory, navigation, and selected simulations. It must not be used when a precise 2D graph or diagram is clearer.

### 2.3 Mathematical display and input

Recommended:

- **KaTeX** for fast formula rendering;
- **MathLive** or an equivalent accessible mathematical input component;
- canonical LaTeX-like storage for authored formulas;
- structured answer representations when exact symbolic validation is required.

### 2.4 Local persistence

Required split:

- **localStorage** for small synchronous preferences and profile index data;
- **IndexedDB** for learner progress, evidence, mission state, downloaded content, and larger records;
- versioned JSON files for export and restore.

### 2.5 Optional future backend

No backend is required for the first local-first release.

A future backend may provide:

- encrypted account sync;
- shared family profiles;
- content distribution;
- analytics with explicit consent;
- collaborative authoring;
- server-assisted AI features.

Backend introduction must not invalidate local identifiers or require online access for downloaded content.

## 3. High-level architecture

```text
┌──────────────────────────────────────────────────────────┐
│                    SvelteKit application                  │
├──────────────────────────────────────────────────────────┤
│ UI shell │ 3D atlas │ 2D map │ Missions │ Guide │ Studio │
├──────────────────────────────────────────────────────────┤
│ Domain services                                            │
│ Profile │ Horizon │ Graph │ Routing │ Mission │ Evidence  │
│ Mastery │ Coverage │ Localisation │ Content packages      │
├──────────────────────────────────────────────────────────┤
│ Simulation runtime │ Math engine adapters │ Workers        │
├──────────────────────────────────────────────────────────┤
│ localStorage │ IndexedDB │ Cache Storage │ Export/import   │
├──────────────────────────────────────────────────────────┤
│ Versioned compiled content packages                       │
└──────────────────────────────────────────────────────────┘
```

The UI must consume domain services rather than calculate curriculum or progress rules directly inside components.

## 4. Suggested repository layout

```text
science-explorer/
├── README.md
├── docs/
│   ├── PRODUCT_SPECIFICATION.md
│   ├── LEARNING_AND_CONTENT_MODEL.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── adr/
│   └── diagrams/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── routes/
│       │   ├── lib/
│       │   │   ├── components/
│       │   │   ├── atlas/
│       │   │   ├── missions/
│       │   │   ├── simulations/
│       │   │   ├── domain/
│       │   │   ├── persistence/
│       │   │   ├── i18n/
│       │   │   └── accessibility/
│       │   └── workers/
│       ├── static/
│       └── tests/
├── packages/
│   ├── domain/
│   ├── content-schema/
│   ├── content-compiler/
│   ├── simulation-runtime/
│   ├── progression/
│   └── ui/
├── content/
│   ├── graph/
│   ├── curricula/
│   ├── missions/
│   ├── exercises/
│   ├── simulations/
│   ├── people/
│   ├── places/
│   ├── sources/
│   ├── glossary/
│   └── assets/
├── schemas/
├── scripts/
└── .github/
    └── workflows/
```

A smaller initial repository may combine packages, but the boundaries should remain explicit in code.

## 5. Domain modules

### 5.1 Profile service

Responsibilities:

- create and validate local profiles;
- store name, age, age-confirmation date, and profile settings;
- select the active profile;
- support multiple profiles;
- update age without resetting progress;
- expose guide overrides for current stage and horizon;
- produce privacy-safe display data.

Suggested interface:

```ts
export interface LearnerProfile {
  id: string;
  name: string;
  age: number;
  ageConfirmedAt: string;
  createdAt: string;
  updatedAt: string;
  preferredLocale: "fr" | "en";
  inferredStage: CurriculumStage;
  stageOverride?: CurriculumStage;
  horizonYears: 2 | 3;
  curriculumPathId: string;
  targetIds: string[];
}
```

### 5.2 Horizon service

Responsibilities:

- infer a default stage from age using a versioned configuration;
- select the ordered two- or three-year path;
- determine map emphasis and detail;
- expose foundations, current stage, next stages, and beyond-horizon bands;
- avoid hard permission checks except for safety or technical incompatibility.

The inference table must be data, not scattered conditional code.

Example configuration:

```yaml
id: horizon.fr.reference.2026
rules:
  - age_min: 17
    age_max: 17
    current_stage: terminale
    default_horizon_years: 3
    path_id: fr-terminale-mpsi-mp
```

Guide mode can override the inferred stage because age and school stage do not always match.

### 5.3 Knowledge graph service

Responsibilities:

- load canonical nodes and typed edges;
- query neighbours, prerequisites, applications, and historical links;
- filter or rank by horizon and map layer;
- find routes between nodes;
- support search in French and English;
- expose graph snapshots by content version;
- provide deterministic data to both 3D and 2D views.

### 5.4 Map layout service

Responsibilities:

- load authored world and region anchors;
- calculate or retrieve stable node positions;
- preserve geography across languages and learner profiles;
- provide semantic-zoom visibility rules;
- generate route geometry;
- expose camera destinations;
- keep layout deterministic for a content version.

The map should use an authored hybrid layout:

- world and region positions are curated;
- local node placement may be assisted by graph-layout algorithms;
- published positions are frozen per content version;
- user progress changes styling, not canonical location.

### 5.5 Mission runtime

Responsibilities:

- load a mission definition and selected depth variant;
- run its state machine;
- select localised content;
- persist resumable state;
- invoke simulations and exercises;
- emit learner evidence;
- support guide commands such as reveal hint, skip, repeat, and branch;
- return the learner to the same map context.

### 5.6 Simulation runtime

Responsibilities:

- register reusable simulation engines;
- validate mission configuration;
- run deterministic simulations;
- isolate expensive computation in Web Workers when appropriate;
- expose serialisable state for pause and resume;
- emit measurement and interaction events;
- provide reduced-motion and accessible alternatives;
- document numerical method, units, assumptions, and limits.

### 5.7 Evidence service

Responsibilities:

- append immutable learner evidence events;
- associate events with profile, mission, step, node, phenomenon, and content version;
- preserve hint and autonomy information;
- support guide rubric evidence;
- provide event queries for derived progression;
- prevent duplicate completion events after language switching or resume.

### 5.8 Progression service

Responsibilities:

- derive node status;
- calculate tool application coverage;
- calculate multidimensional mastery and confidence;
- flag review opportunities;
- produce human-readable explanations;
- version every scoring algorithm;
- recalculate cached values from evidence after migrations or algorithm changes.

### 5.9 Localisation service

Responsibilities:

- select `fr` or `en`;
- localise interface and content through canonical IDs;
- format numbers and dates appropriately;
- maintain current route and state during language change;
- detect missing production translations;
- expose development-only fallback diagnostics;
- support glossary aliases and bilingual search.

### 5.10 Content package service

Responsibilities:

- install bundled or downloaded content packages;
- validate package compatibility and integrity;
- expose package versions;
- preserve old content metadata needed by learner evidence;
- migrate references when canonical IDs are intentionally replaced;
- support offline access.

## 6. Client-side storage specification

### 6.1 localStorage keys

Suggested keys:

```text
science-explorer.schema-version
science-explorer.active-profile-id
science-explorer.profile-index
science-explorer.locale
science-explorer.ui-preferences
```

A profile index contains only small profile summaries. Detailed records belong in IndexedDB.

Example summary:

```json
{
  "schemaVersion": 1,
  "profiles": [
    {
      "id": "learner.paul.local",
      "name": "Paul",
      "age": 17,
      "preferredLocale": "fr",
      "lastOpenedAt": "2026-09-06T15:00:00Z"
    }
  ]
}
```

### 6.2 IndexedDB database

Suggested database name:

```text
science-explorer
```

Suggested object stores:

```text
profiles
profileSettings
missionSessions
evidenceEvents
nodeStateCache
toolApplicationCache
masteryCache
journalEntries
contentPackages
contentAssets
simulationSnapshots
exportsMetadata
migrations
```

### 6.3 Source of truth

- Profile identity fields are source data.
- Evidence events are the source of truth for learning activity.
- Mission session state is the source of truth for resume.
- Mastery, coverage, and node states are derived caches.
- Compiled content packages are immutable by version.

### 6.4 Transactions

Mission-step completion should write atomically where practical:

```text
step state
+ emitted evidence
+ session checkpoint
```

Derived score updates may occur asynchronously after the evidence transaction completes.

### 6.5 Export format

Export files use a versioned envelope:

```json
{
  "format": "science-explorer-progress",
  "formatVersion": 1,
  "exportedAt": "2026-09-06T15:00:00Z",
  "applicationVersion": "0.1.0",
  "contentVersions": ["core-0.1.0"],
  "profile": {},
  "missionSessions": [],
  "evidenceEvents": [],
  "journalEntries": []
}
```

Derived caches should normally be omitted or clearly marked as disposable.

### 6.6 Import safety

Import must:

- validate schema and size;
- reject executable content;
- preview learner identity and record counts;
- identify incompatible content references;
- allow create-new-profile or merge when safe;
- never silently overwrite local progress;
- record the import operation.

## 7. Internationalisation architecture

### 7.1 Two localisation layers

#### Interface localisation

Static application strings are stored in locale dictionaries by stable message key.

```ts
msg("welcome.enterUniverse")
```

#### Content localisation

Authored node, mission, exercise, and historical text is compiled from bilingual content fields.

The two layers must use the same locale service but remain independently versioned.

### 7.2 Locale state

The active locale is application state independent from the learner evidence state.

Changing locale must not recreate:

- mission session;
- exercise attempt;
- simulation state;
- selected node;
- map camera destination;
- backpack metrics.

### 7.3 Route behaviour

The initial recommendation is not to duplicate all routes as `/fr/...` and `/en/...` because the application is local-first and language switching should preserve state. Locale may remain in application state and persistence.

Public shareable content pages may later support locale-prefixed URLs without changing canonical IDs.

### 7.4 Validation

Production build validation fails when:

- a required interface key is missing in either language;
- a required learner-facing content field is missing;
- answer choices differ structurally between languages;
- a mission branch exists in one language only;
- simulation labels or accessibility descriptions are incomplete.

### 7.5 Search indexes

The content compiler creates separate French and English search indexes that resolve to canonical IDs.

Searchable material includes:

- titles;
- aliases;
- glossary entries;
- mission summaries;
- people;
- places;
- scientific questions.

## 8. Content compilation pipeline

```text
Authored YAML/JSON/Markdown
→ schema validation
→ cross-reference validation
→ bilingual parity checks
→ historical-source checks
→ curriculum-alignment checks
→ simulation configuration checks
→ graph compilation
→ search-index generation
→ map-layout snapshot
→ immutable versioned content package
```

The compiler should produce:

```text
manifest.json
graph.json
curricula.json
missions.json
exercises.json
simulations.json
people.json
places.json
sources.json
glossary.fr.json
glossary.en.json
search.fr.json
search.en.json
layout.json
asset-manifest.json
```

Large packages may later be split by world, curriculum horizon, or mission collection.

## 9. Content package manifest

Example:

```json
{
  "id": "core",
  "version": "0.1.0",
  "schemaVersion": 1,
  "createdAt": "2026-09-06T00:00:00Z",
  "supportedLocales": ["fr", "en"],
  "curriculumPaths": ["fr-terminale-mpsi-mp"],
  "dependencies": [],
  "entryWorlds": ["mathematics", "physics", "chemistry"],
  "checksums": {}
}
```

## 10. Mission state machine

### 10.1 Runtime states

A mission session may be:

```text
not_started
briefing
active_step
awaiting_prediction
running_simulation
awaiting_response
paused
completed
abandoned
```

### 10.2 Session record

```ts
export interface MissionSession {
  id: string;
  learnerId: string;
  missionId: string;
  missionVersion: number;
  contentPackageVersion: string;
  locale: "fr" | "en";
  selectedDepth: number;
  currentStepId: string;
  status: MissionSessionStatus;
  branchHistory: string[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  serialisedStepState?: unknown;
  simulationSnapshotIds: string[];
}
```

Locale is recorded for audit and resume display, but changing it updates the same session rather than creating a new one.

### 10.3 Idempotency

Every scoring or completion event must have an idempotency key derived from session, step, and attempt where appropriate. Re-rendering, reconnecting, or changing language must not create duplicate evidence.

## 11. Knowledge graph queries

The graph service should support:

```ts
getNode(id)
getLocalisedNode(id, locale)
getNeighbours(id, edgeTypes)
getPrerequisiteRoutes(destinationId, profileContext)
getApplications(toolId, curriculumScope)
getHistoricalMissions(nodeId)
getCurriculumDepths(nodeId, pathId)
getVisibleSubgraph(viewContext)
findRoute(fromId, toId, routePolicy)
search(query, locale, filters)
```

For the initial graph size, in-memory indexes are sufficient. The API should not assume a remote graph database.

## 12. 3D atlas architecture

### 12.1 Scene hierarchy

Suggested hierarchy:

```text
UniverseScene
├── Background
├── WorldLayer
│   ├── MathematicsWorld
│   ├── PhysicsWorld
│   └── ChemistryWorld
├── BridgeLayer
├── HistoricalRouteLayer
├── KnowledgeRouteLayer
├── NodeLayer
├── ProgressEffectsLayer
├── LabelsLayer
├── CameraController
└── InteractionController
```

### 12.2 Data-driven rendering

No scientific node should be hard-coded in a scene component. Scene objects are created from compiled graph and layout data.

### 12.3 Semantic zoom

Visibility rules depend on:

- camera distance;
- selected world or region;
- active map layer;
- learner horizon;
- node importance;
- discovery state;
- device performance mode.

Labels must be prioritised to prevent clutter.

### 12.4 Selection and deep links

Selecting a node updates application routing. Opening a deep link selects and frames the same node in the 3D map when supported, while retaining a normal accessible page.

### 12.5 Performance modes

At minimum:

- high visual quality;
- balanced;
- reduced graphics;
- 2D map.

The application may select an initial mode from device capability but must allow manual override.

## 13. Performance budgets

Initial target budgets for a representative mid-range laptop or tablet should include:

- interactive welcome screen without loading the full 3D universe;
- progressive loading of the atlas;
- stable interaction at a usable frame rate in balanced mode;
- no long main-thread blocks during graph query or scoring;
- simulation computation moved to a worker when it risks blocking input;
- compressed, lazy-loaded 3D assets;
- texture and geometry reuse;
- limited label redraws;
- explicit memory cleanup when leaving heavy missions.

Exact numeric budgets should be established with the first target devices and recorded in an architecture decision record.

## 14. Offline/PWA architecture

### 14.1 Cached application shell

The service worker caches:

- application shell;
- interface locale dictionaries;
- core fonts and icons where licensing permits;
- currently installed content-package manifests;
- downloaded mission assets.

### 14.2 Content download states

Content packages or missions can be:

- bundled;
- available online;
- downloading;
- downloaded;
- update available;
- incompatible;
- failed.

The learner must know whether a destination can be completed offline before starting it.

### 14.3 Updates

Application and content updates must not interrupt an active mission. A new version is activated after a safe checkpoint or next launch.

## 15. Security and privacy

### 15.1 Local data

The first version stores no credentials. Learner name and age are personal data and must be treated accordingly even when local.

Requirements:

- no third-party analytics by default;
- no remote transmission without an explicit feature and consent;
- escape or sanitise authored rich content;
- disallow arbitrary scripts in content packages;
- validate imports;
- use content security policy appropriate to deployment;
- avoid storing sensitive free-form data unnecessarily;
- provide a clear local delete-profile action.

### 15.2 Authoring content

Compiled content is trusted only after validation. Runtime must not execute authored JavaScript. Simulations are registered code modules with validated configuration.

### 15.3 Future sync

Future cloud sync should use end-to-end or strong application-level protections appropriate to the data model and must remain optional.

## 16. Accessibility architecture

### 16.1 Shared navigation model

The 3D atlas and 2D accessible map consume the same selection, graph, route, and progress services.

### 16.2 Focus and announcements

The application shall:

- move focus predictably when opening concept and mission panels;
- announce selected destination and route changes;
- expose keyboard commands;
- provide a list of visible destinations;
- avoid trapping focus in canvas controls;
- expose text descriptions of simulations.

### 16.3 Reduced motion

Reduced-motion mode disables or reduces:

- automatic camera flights;
- pulsing effects;
- parallax;
- decorative particles;
- unnecessary continuous animation.

Scientific motion essential to a simulation remains available with pause, step, and speed controls.

## 17. Testing strategy

### 17.1 Unit tests

Required for:

- age-to-stage inference;
- horizon calculation;
- graph queries;
- prerequisite routing;
- coverage calculation;
- mastery calculation;
- evidence idempotency;
- localisation lookup;
- export/import validation;
- mission state transitions.

### 17.2 Content tests

Required for:

- schema validation;
- graph integrity;
- bilingual parity;
- source requirements;
- curriculum references;
- simulation parameter validity;
- exercise answer equivalence across languages.

### 17.3 Component tests

Required for:

- onboarding;
- language switching;
- backpack indicators;
- concept panel;
- mission controls;
- guide controls;
- offline-state messages.

### 17.4 End-to-end tests

Critical journeys:

1. create Paul, age 17, in French;
2. verify Terminale → MPSI → MP horizon;
3. switch to English without losing map selection;
4. open an MP destination and inspect prerequisite routes;
5. start and resume a historical mission;
6. record a prediction;
7. complete a simulation and exercise;
8. verify backpack coverage and mastery evidence;
9. close and reopen offline;
10. export and restore progress.

### 17.5 Visual and performance tests

- screenshot or scene-state regression for curated atlas views;
- label-clutter checks at semantic zoom levels;
- device performance smoke tests;
- reduced-motion verification;
- WebGL context loss and recovery tests.

## 18. Continuous integration

Recommended checks on every pull request:

```text
format
lint
typecheck
unit tests
component tests
content schema validation
bilingual completeness
historical-source rules
graph integrity
build
PWA/offline smoke test
```

Preview deployments should make both French and English paths easy to review.

## 19. Versioning and migrations

Version independently:

- application;
- storage schema;
- content schema;
- content packages;
- curriculum packages;
- mastery algorithm;
- coverage algorithm;
- export format.

Every migration must be testable on an exported fixture from the previous supported version.

Canonical IDs should remain stable. When an ID must change, content packages provide an explicit migration map.

## 20. Observability in the local-first release

Developer diagnostics may include:

- content-package version;
- storage migration status;
- rendering mode;
- frame-time summary;
- worker errors;
- missing translation diagnostics in development;
- mission state and emitted evidence inspector;
- score explanation trace.

Diagnostics should be local and easy to export deliberately. They must not silently transmit learner activity.

## 21. First vertical-slice implementation sequence

### Phase 1 — Foundations

- initialise SvelteKit and TypeScript;
- add localisation infrastructure;
- implement profile creation and localStorage index;
- implement IndexedDB wrapper and migration system;
- define content schemas and compiler skeleton.

### Phase 2 — Universe shell

- compile a 15–25 node graph;
- create stable authored layout;
- render three worlds and selectable nodes;
- add semantic zoom and 2D fallback;
- implement Paul horizon and map filters.

### Phase 3 — Mission runtime

- implement mission state machine;
- implement historical briefing, prediction, simulation, response, debrief, and map-return steps;
- persist session state;
- implement guide controls.

### Phase 4 — Scientific vertical slice

- add derivative tool;
- add motion, electrical, and chemical applications;
- add one reusable simulation engine;
- add exercises and rubrics;
- emit learner evidence.

### Phase 5 — Backpack and progression

- implement coverage and mastery algorithms with versioning;
- display explainable indicators;
- highlight applications on the map;
- add review recommendations.

### Phase 6 — Offline and hardening

- installable PWA;
- content caching;
- export and restore;
- end-to-end bilingual tests;
- accessibility pass;
- performance pass.

## 22. Technical acceptance criteria

The architecture is validated by the first release when:

- the same compiled graph drives French and English views;
- Paul, age 17, receives the configured Terminale → MPSI → MP horizon;
- the learner can change language in an active mission without creating a new session or duplicate evidence;
- profile summary data is in localStorage and detailed progress is in IndexedDB;
- the application resumes after a full browser restart;
- a versioned export can restore the learner on another browser;
- the 3D atlas and 2D alternative select the same canonical nodes;
- content nodes and missions are loaded from data rather than hard-coded scene components;
- one historical mission runs through the reusable mission engine;
- one scientific simulation runs from validated configuration;
- application coverage and mastery are recomputed from evidence with identifiable algorithm versions;
- production build fails on broken references or missing French/English content;
- downloaded core content works offline;
- learner data is not transmitted by default;
- automated tests cover the critical journeys listed above.

## 23. Architecture decisions to record next

Create architecture decision records for:

1. SvelteKit and deployment adapter;
2. Three.js/Threlte rendering approach;
3. local database wrapper and schema migration library;
4. content source format: YAML, JSON, or Markdown with frontmatter;
5. mathematical answer engine;
6. first reusable simulation engine;
7. authored versus generated map layout;
8. local guide-mode protection;
9. PWA content-package update policy;
10. future cloud-sync boundary.
