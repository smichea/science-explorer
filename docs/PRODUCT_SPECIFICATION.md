# Science Explorer — Product and UX Specification

**Status:** Draft v0.1  
**Date:** 2026-09-06  
**Primary language of this document:** English  
**Supported product languages:** French and English

## 1. Product vision

Science Explorer is an immersive, bilingual atlas of mathematics, physics, chemistry, and the history of science.

The learner is not presented with a linear catalogue of courses. They enter a stable knowledge universe, visible from the first session, and explore it at their own pace. They may follow a recommended route, move deeply into one branch, return to earlier foundations, or approach the same idea through another scientific phenomenon.

The central pedagogical loop is:

```text
Explore a phenomenon
→ encounter a problem
→ build or retrieve a mathematical tool
→ use the tool to construct a model
→ test the model in a simulation or experiment
→ transfer the tool to another phenomenon
→ update the learner's map and virtual backpack
```

Every major activity is also a historical journey. It takes place at a defined location and time and involves one or more scientists of that period. The product must distinguish documented history from pedagogical reconstruction and narrative fiction.

## 2. Initial learner and curriculum target

The first reference learner is Paul:

```yaml
name: Paul
age: 17
current_stage: terminale
three_year_horizon:
  - terminale
  - mpsi
  - mp
objectives:
  - ENS entrance examinations
  - Ecole polytechnique entrance examinations
```

For Paul, the detailed content horizon is therefore:

1. the current Terminale year;
2. the following MPSI year;
3. the following MP year.

The MPSI and MP mathematics and physics/chemistry programmes define the main target corpus. Terminale concepts form the entry layer and the set of foundations that can be revisited at any time.

The application architecture must support other ages and other horizons without creating a separate product.

## 3. Product goals

Science Explorer shall:

1. give the learner a meaningful global view of the three scientific domains from the first session;
2. show how mathematical tools are built and reused to model physical and chemical phenomena;
3. support non-linear exploration while making prerequisite routes explicit;
4. cover the intended curriculum through a connected knowledge graph rather than isolated chapters;
5. turn each core activity into an immersive historical scenario;
6. include interactive simulations in which the learner predicts, manipulates, measures, and reasons;
7. track both mastery and breadth of application for each mathematical tool;
8. provide the complete experience in French and English;
9. work local-first, without requiring an account for the initial version;
10. provide a guide view for the adult leading the weekly session;
11. provide an authoring path so the complete three-year universe can be prepared in advance.

## 4. Non-goals for the initial release

The initial release is not intended to be:

- a conventional learning management system;
- a list of recorded lectures;
- an open-ended 3D walking game;
- a competitive multiplayer game;
- an AI tutor that invents the curriculum dynamically;
- a replacement for formal school or preparatory-class instruction;
- a cloud account platform;
- a comprehensive implementation of every Terminale, MPSI, and MP activity before the core interaction loop has been validated.

## 5. Core design principles

### 5.1 One stable universe

The geography of knowledge must remain stable. Progress, curriculum level, historical view, and prerequisites are visual layers over the same underlying universe.

The learner should gradually form a spatial memory of science. For example, they should come to recognise that complex numbers connect naturally to waves, differential equations connect to mechanics, circuits, and chemical kinetics, and probability connects to statistical physics and measurement.

### 5.2 Mathematics is the toolbox world

The mathematics world contains tools that can be constructed at increasing levels of depth. Those tools are connected to the physical and chemical phenomena they can model.

A mathematical concept is not duplicated once per school year. There is one concept node with multiple curriculum depths.

Example:

```text
Derivative
├── Terminale depth: rate of change, tangent, velocity, standard rules
├── MPSI depth: rigorous local analysis, mean-value results, expansions, ODE use
└── MP depth: multivariable differentiation, gradients, systems, optimisation
```

### 5.3 Age selects a lens, not a prison

The learner's age determines a default current stage and a two- or three-year highlighted horizon. It must not create absolute locks.

Destinations outside the recommended horizon may remain visible at a high level. A learner may inspect or attempt them. The application should explain the missing tools and propose routes rather than deny access.

### 5.4 Prediction before animation

A simulation is pedagogically useful only when the learner can make a prediction that may be wrong.

Whenever appropriate, the sequence shall be:

```text
Observe the setup → predict → run or manipulate → measure → explain
```

### 5.5 Historical honesty

Historical scenarios must clearly separate:

- documented facts;
- scholarly interpretation;
- pedagogical reconstruction;
- narrative fiction.

Invented dialogue must never be presented as an authentic quotation.

### 5.6 Language independence

Changing language must not create a new learner, reset progress, change node identifiers, or alter scoring. French and English are two presentations of the same content and learning state.

## 6. Users and modes

### 6.1 Explorer mode

The learner can:

- create or select a local profile;
- choose French or English;
- enter the knowledge universe;
- inspect worlds, regions, concepts, phenomena, scientists, and missions;
- launch historical missions;
- interact with simulations;
- solve exercises and record explanations;
- open the virtual backpack;
- inspect progress and discovered connections;
- resume an unfinished mission;
- revisit foundations;
- export local progress.

### 6.2 Guide mode

The adult guiding the learner can additionally:

- inspect the intended learning outcomes of a mission;
- view estimated time per step;
- see suggested oral questions;
- reveal or withhold hints;
- skip, repeat, or branch from a mission step;
- see expected reasoning and common misconceptions;
- add session notes;
- inspect detailed evidence behind progress estimates;
- change the inferred curriculum stage when necessary;
- choose a recommended next destination;
- resume a mission at a precise step.

Guide mode may initially be protected by a simple local gesture or local PIN. It does not require a cloud identity in the first version.

### 6.3 Architect mode

The content author can:

- edit the knowledge graph;
- define curriculum alignments and depth levels;
- author bilingual concepts and missions;
- link mathematical tools to phenomena;
- configure reusable simulations;
- create exercises and rubrics;
- attach historical sources and evidence statuses;
- preview both language versions;
- validate broken links and incomplete translations;
- publish a versioned content package.

A full visual editor is not required for the first vertical slice, but the content format must support it from the beginning.

## 7. First-run experience

### 7.1 Welcome screen

On first launch, the application displays a simple, calm welcome screen containing:

- product title;
- one-sentence explanation;
- language selection: `Français` / `English`;
- learner name field;
- learner age field;
- primary action: `Enter the universe` / `Entrer dans l'univers`;
- privacy statement explaining that profile and progress are stored on the device.

No email address, password, or online account is required.

### 7.2 Required fields

The learner enters only:

```text
Name
Age
```

The selected interface language is stored as a preference, not as part of the learner's scientific progress.

### 7.3 Inferred horizon

After validation, the application infers a default current curriculum stage and a two- or three-year horizon using configurable rules.

For Paul at age 17:

```text
Now          +1 year      +2 years
Terminale →  MPSI      →  MP
```

The confirmation screen shall say, in the selected language, that this is the highlighted route rather than a restriction.

### 7.4 Returning learner

On later launches, the application displays:

- learner name;
- age;
- current highlighted path;
- last visited destination or mission;
- `Resume exploration`;
- `Open the map`;
- `Change explorer`;
- language switch.

### 7.5 Age refresh

Because a stored age becomes stale, the profile includes the date on which it was last confirmed. After a configurable period, the application asks the learner to confirm or update it. Updating age must never reset progress.

## 8. Curriculum horizon behaviour

### 8.1 Horizon configuration

A learner profile contains:

- inferred or guide-selected current stage;
- horizon length: two or three years;
- ordered curriculum stages;
- optional target examinations;
- content version.

### 8.2 Visibility rules

The map shall provide these visual bands:

| Band | Meaning | Default representation |
|---|---|---|
| Foundations | Earlier concepts useful for review | Visible below or behind the current layer |
| Current stage | Concepts appropriate now | Bright, detailed, labelled |
| Next stage | Concepts expected in the following year | Visible and slightly more distant |
| Final horizon stage | Concepts expected within the configured horizon | Visible as a frontier with selective detail |
| Beyond horizon | Scientific regions outside the current programme | High-level silhouettes or constellations |

The complete major-domain structure remains visible from the first session, but detailed destinations and labels are prioritised according to the horizon.

### 8.3 No hard lock by default

A destination with missing prerequisites is shown with an interrupted or incomplete route, not a padlock.

Opening it presents three options:

1. **Explore now** — start with contextual help;
2. **Follow the recommended route** — visit prerequisite tools first;
3. **Save for later** — add it to planned destinations.

### 8.4 Programme filters

The map offers at least:

- `My horizon`;
- `Ready to explore`;
- `Current stage`;
- `Terminale`;
- `MPSI`;
- `MP`;
- `Entire universe`.

A filter changes emphasis and detail, not the underlying geography.

## 9. Universe map

### 9.1 Main worlds

The initial universe contains three major worlds:

#### Mathematics

Purpose: construct tools and structures used to reason and model.

Initial major regions include:

- numbers and algebra;
- functions and analysis;
- geometry;
- sequences and series;
- complex numbers;
- linear algebra and matrices;
- probability and statistics;
- differential equations;
- multivariable analysis;
- numerical methods.

#### Physics

Purpose: observe, model, predict, and explain phenomena.

Initial major regions include:

- measurement and dimensions;
- motion and mechanics;
- gravitation;
- oscillations;
- waves;
- optics;
- electricity and circuits;
- fields and electromagnetism;
- thermodynamics;
- quantum physics.

#### Chemistry

Purpose: understand matter and its transformations.

Initial major regions include:

- atomic and molecular structure;
- amount of substance and measurement;
- reactions and stoichiometry;
- kinetics;
- equilibria;
- acid-base chemistry;
- oxidation-reduction;
- thermochemistry;
- electrochemistry;
- links between microscopic and macroscopic descriptions.

### 9.2 Interdisciplinary bridge regions

Bridge concepts include:

- modelling;
- measurement;
- orders of magnitude;
- energy;
- symmetry;
- information;
- experiment;
- uncertainty;
- statistics.

These may be rendered as hubs, gates, or shared routes rather than owned by one world.

### 9.3 Semantic zoom

The map shall support at least five levels:

1. **Universe:** major worlds and bridge regions;
2. **World:** major regions;
3. **Region:** concept islands and routes;
4. **Concept:** definitions, depth levels, applications, prerequisites, missions;
5. **Mission:** immersive activity interface.

Zooming must change the amount and type of information shown. It must not merely scale labels.

### 9.4 Map layers

The learner can switch among these layers:

- **Concepts:** mathematical tools, laws, models, and phenomena;
- **Applications:** highlights where a selected tool can be used;
- **History:** shows missions by date, place, and scientist;
- **Progress:** shows discovered, practised, mastered, and due-for-review content;
- **Prerequisites:** shows possible routes to a destination;
- **Curriculum:** shows Terminale, MPSI, and MP depth and alignment.

### 9.5 Destination visual states

A destination can be:

- unknown but visible;
- in the learner's horizon;
- ready to explore;
- missing recommended prerequisites;
- missing essential prerequisites;
- discovered;
- practised;
- mastered;
- due for review;
- saved for later;
- in progress.

The visual design must not rely on colour alone.

## 10. Concept view

Opening a concept displays:

- bilingual title and concise purpose;
- type: tool, phenomenon, law, model, method, person, place, or mission;
- curriculum depths;
- essential and recommended prerequisites;
- related phenomena or tools;
- available historical missions;
- learner status;
- mastery breakdown;
- application coverage;
- next possible routes;
- sources where relevant.

For a mathematical tool, the view must answer:

1. What problem does this tool solve?
2. How is it constructed?
3. Where has the learner used it?
4. Where else can it be used?
5. At what depth does the learner understand it?

## 11. Historical mission experience

### 11.1 Required metadata

Every core mission contains:

- title;
- location;
- date or historical interval;
- one or more scientists or historical actors;
- central scientific question;
- scientific phenomena;
- mathematical tools introduced, used, and assessed;
- curriculum alignments and depth variants;
- prerequisites;
- estimated duration;
- bilingual content;
- sources;
- historical evidence labels;
- simulation and exercise references.

### 11.2 Standard mission arc

A full mission should support the following sequence:

1. **Arrival:** establish place, time, and scientific context;
2. **Role:** give the learner a meaningful position in the situation;
3. **Question:** present the unresolved problem;
4. **Prediction:** record the learner's initial expectation;
5. **Observation or experiment:** manipulate a simulation or evidence;
6. **Need for a tool:** expose the limitation of the current approach;
7. **Mathematics workshop:** build or retrieve the required tool;
8. **Return to the phenomenon:** apply the tool to the original question;
9. **Transfer:** use the same tool in another physical or chemical context;
10. **Historical debrief:** distinguish period knowledge from modern interpretation;
11. **Return to map:** illuminate new nodes, routes, and backpack evidence.

Not every short mission must contain every step, but every mission must include active reasoning rather than passive narration.

### 11.3 Historical labels

Each historical statement or scene can be marked as:

- `attested`;
- `scholarly_interpretation`;
- `pedagogical_reconstruction`;
- `narrative_fiction`.

The learner view uses discreet icons and a clear debrief. The guide and architect views expose full metadata.

### 11.4 Example mission destinations

Initial content may include missions connected to:

- Euclid in Alexandria and geometry;
- Archimedes in Syracuse and mechanics or hydrostatics;
- Galileo in Pisa or Padua and motion;
- Kepler in Prague and planetary orbits;
- Newton in Cambridge and mechanics or calculus;
- Lavoisier in Paris and quantitative chemistry;
- Marie Curie in Paris and radioactivity;
- Bohr in Copenhagen and atomic models.

Exact dates, locations, actions, and dialogues must be validated during content authoring rather than assumed from the example labels alone.

## 12. Simulations and interactions

### 12.1 Simulation requirements

A simulation shall expose:

- controllable parameters;
- visible initial conditions;
- observable quantities;
- optional measurement tools;
- pause, reset, and replay;
- a prediction step when pedagogically relevant;
- bilingual labels and units;
- deterministic replay when a seed is provided;
- an accessible non-3D or reduced-motion alternative where necessary.

### 12.2 Reusable simulation families

The product should prefer configurable engines over mission-specific one-off code. Candidate families include:

- functions and graphs;
- geometry constructions;
- motion and trajectories;
- oscillators;
- waves;
- vector fields;
- geometric optics;
- electric circuits;
- particle systems and collisions;
- thermodynamic systems;
- chemical kinetics;
- chemical equilibrium;
- probability experiments;
- linear transformations and eigenmodes;
- differential systems.

### 12.3 Learner evidence

The application may capture:

- initial prediction;
- selected parameters;
- measurements;
- equations entered;
- final explanation;
- hints used;
- retries;
- level of autonomy;
- transfer performance.

Only evidence required for learning and progression should be stored.

## 13. Virtual backpack

### 13.1 Purpose

The virtual backpack is the learner's inventory of discovered mathematical and scientific tools. It is not merely a badge collection.

Each tool entry displays:

- tool name and icon;
- discovery status;
- curriculum depths visited;
- percentage of relevant phenomena explored with the tool;
- mastery percentage;
- confidence in the estimate;
- last use;
- review recommendation;
- known applications;
- unexplored applications;
- common difficulties;
- related missions.

### 13.2 Two distinct headline indicators

#### Application coverage

This answers:

> Across the phenomena represented in the configured knowledge graph, in how many has the learner actually used this tool?

The interface shows both a percentage and an explicit fraction when possible.

Example:

```text
Derivative — applications: 8 / 23 — 35%
```

Guided use, lightly assisted use, and autonomous selection may contribute different weights. The details must be inspectable.

#### Mastery

This answers:

> How reliably can the learner recognise, explain, execute, model with, and transfer this tool?

The headline score is supported by a breakdown such as:

- recognition and explanation;
- procedural execution;
- modelling choice;
- transfer to a new context;
- retention over time.

The product must not imply high confidence after one successful answer.

### 13.3 Selected-tool map view

Selecting a backpack tool switches the universe into application view:

- phenomena already explored with the tool have solid illuminated routes;
- eligible but unexplored phenomena have dotted routes;
- recently mastered applications have a distinct marker;
- suggested transfer missions are highlighted.

## 14. Progress and recommendation behaviour

### 14.1 Progress is evidence-based

Progress updates are derived from recorded activity evidence, not only from page visits.

### 14.2 Recommendation categories

The application may recommend:

- continue the current route;
- revisit a foundation;
- apply a known tool to a new phenomenon;
- deepen the same concept at MPSI or MP level;
- explore a historical predecessor or successor;
- review a concept whose retention is uncertain;
- attempt a challenge problem.

### 14.3 Learner choice remains primary

Recommendations are suggestions. The learner must always retain access to the map and alternative destinations.

## 15. Bilingual requirements

### 15.1 Supported languages

The first release supports:

- French: `fr`;
- English: `en`.

### 15.2 Scope of translation

Both languages are required for:

- onboarding;
- navigation;
- map labels;
- world, region, and concept content;
- mission narration and dialogue;
- exercise statements;
- hints and feedback;
- simulation labels;
- backpack indicators;
- guide notes intended for display;
- historical debriefs;
- accessibility labels;
- errors and empty states.

Source titles and authentic historical quotations may remain in their original language, but a translation and source note should be available.

### 15.3 Language switching

The learner can change language from any top-level screen and during a mission.

Changing language must:

- preserve the current route and mission step;
- preserve all progress;
- preserve simulation state when practical;
- preserve mathematical input;
- switch all available interface and content text together;
- never create duplicate evidence.

### 15.4 Language-neutral identifiers

All nodes, missions, steps, exercises, and evidence records use language-neutral stable identifiers. Localised strings are stored separately.

Example:

```json
{
  "id": "tool.derivative",
  "title": {
    "fr": "Dérivée",
    "en": "Derivative"
  }
}
```

### 15.5 Translation completeness

A content package must fail validation for publication when required learner-facing text is missing in either French or English.

Temporary fallback to another language may be allowed only in development mode and must be visibly flagged.

### 15.6 Scientific notation and locale

The application must distinguish translation from mathematical convention.

Examples:

- decimal separators follow locale in prose and inputs where appropriate;
- canonical stored numeric values remain locale independent;
- formulas are not translated as plain text;
- units follow consistent scientific standards;
- dates in historical content are formatted appropriately for the selected language;
- proper names are not translated unless a conventional language-specific form is deliberately provided.

## 16. Local-first privacy and persistence

### 16.1 Local profile

Name, age, active profile, and language preference are stored on the device.

### 16.2 Detailed progress

Detailed mission state, attempts, evidence, and backpack data are also stored locally in the first version.

### 16.3 Privacy statement

The onboarding screen clearly states that no online account is required and identifies what is stored locally.

### 16.4 Export and restore

Guide mode provides:

- export of one learner profile and all associated progress to a versioned JSON file;
- restore from a compatible export;
- conflict-safe import preview;
- option to create a separate restored profile instead of overwriting an existing profile.

### 16.5 Multiple local learners

The data model must support multiple local profiles on one device, although the initial UI may optimise for one active learner.

## 17. Offline and installable behaviour

The target product is an installable progressive web application.

After required assets and a content package have been downloaded, the learner shall be able to:

- open the application;
- access the map;
- run downloaded missions;
- use simulations;
- record progress;
- change between French and English;
- export progress;

without a network connection.

The application must clearly indicate which optional content has not yet been downloaded.

## 18. Accessibility and comfort

The product shall provide:

- keyboard navigation for all non-spatial controls;
- text alternatives for visual nodes and routes;
- a searchable 2D list or graph alternative to the 3D map;
- sufficient contrast;
- no information conveyed by colour alone;
- scalable interface text;
- reduced-motion mode;
- pause and replay for animated explanations;
- captions or transcripts for audio;
- controls usable on desktop and tablet;
- clear focus management when moving between map, concept, and mission views.

The 3D atlas is a primary experience, but it must not become the only way to reach content.

## 19. Initial navigation structure

Suggested top-level routes:

```text
/welcome
/profiles
/universe
/world/:worldId
/region/:regionId
/concept/:conceptId
/mission/:missionId
/backpack
/timeline
/journal
/settings

/guide/session/:sessionId
/guide/progress
/guide/planner

/studio/graph
/studio/missions
/studio/simulations
/studio/exercises
/studio/sources
```

Exact framework routing is an implementation decision, but every destination must have a stable deep link and a non-3D accessible view.

## 20. Initial vertical slice

The first end-to-end release shall include:

1. French/English welcome and profile creation;
2. local storage of name, age, language, and active profile;
3. inferred Paul horizon: Terminale → MPSI → MP;
4. a global universe view with Mathematics, Physics, and Chemistry;
5. approximately 15–25 concept or phenomenon nodes;
6. one mathematical tool, initially recommended as the derivative;
7. at least three linked applications across physics and chemistry;
8. one complete historical mission with validated metadata;
9. one reusable simulation engine;
10. prediction, manipulation, measurement, and explanation steps;
11. at least three exercise types;
12. a working backpack entry with application coverage and mastery;
13. application-layer highlighting on the map;
14. guide view with timing, prompts, hints, and evidence;
15. local resume, export, and restore;
16. a complete bilingual content package with no missing production translations.

## 21. Product acceptance criteria for the vertical slice

The vertical slice is acceptable when:

- a new learner can select French or English, enter a name and age, and reach the map without creating an account;
- entering `Paul`, age `17`, produces a highlighted Terminale → MPSI → MP horizon;
- the same global geography is visible in both languages;
- changing language preserves the current location and progress;
- the learner can select a future MPSI or MP destination and receive prerequisite route options rather than a hard lock;
- a historical mission visibly identifies place, time, and scientist;
- the mission asks for a prediction before revealing the simulated result;
- the learner constructs or retrieves a mathematical tool and applies it to a phenomenon;
- completion updates the relevant map nodes and backpack evidence;
- the backpack shows separate mastery and application-coverage indicators;
- the selected tool highlights both explored and unexplored application routes;
- the guide can inspect the evidence behind the displayed scores;
- closing and reopening the application restores the learner's state;
- exported progress can be restored on the same or another device;
- every learner-facing production string exists in both French and English;
- the core experience remains usable with the network disconnected after installation and content download.

## 22. Open product decisions

The following decisions should be resolved during prototyping:

1. exact visual metaphor for semantic zoom and concept depth;
2. exact age-to-stage inference table and how national curriculum differences are configured;
3. whether guide mode requires a local PIN in the first version;
4. which historical mission best demonstrates the full loop;
5. whether the first derivative mission is centred on Galileo, another historical setting, or a deliberately cross-period scenario;
6. balance between free camera movement and curated camera transitions;
7. how much narration is read versus heard;
8. how mastery confidence is communicated without clutter;
9. how downloaded content packages are selected and updated;
10. when optional cloud synchronisation becomes useful.

These decisions must not compromise the fixed principles: one stable universe, bilingual content, non-linear exploration, mathematics as a reusable toolbox, historically honest missions, and evidence-based progression.
