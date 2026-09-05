# Science Explorer — Knowledge, Content, and Learning Model

**Status:** Draft v0.1  
**Date:** 2026-09-06

## 1. Purpose

This document defines how Science Explorer represents scientific knowledge, curricula, historical missions, exercises, simulations, and learner progress.

The model must make it possible to prepare the complete three-year universe in advance while preserving non-linear exploration. It must also ensure that French and English content refer to the same scientific objects and the same learner evidence.

## 2. Fundamental distinction: universe versus journeys

Science Explorer separates two structures.

### 2.1 The knowledge universe

The universe is a stable graph of:

- mathematical concepts and tools;
- physical and chemical phenomena;
- laws, principles, and models;
- experimental methods;
- scientists, places, periods, and historical events;
- relationships among all of these objects.

It answers:

> What exists in this scientific universe, and how are the ideas connected?

### 2.2 Journeys through the universe

A journey is a mission, activity, route, or recommended sequence through selected graph nodes.

It answers:

> Which connected ideas will the learner encounter in this particular experience?

A mission does not own or duplicate the concepts it uses. It references them.

This distinction allows many historical scenarios and applications to reuse one mathematical tool without producing several incompatible versions of that tool.

## 3. Stable identifiers and localisation

Every entity has a language-neutral, stable identifier.

Examples:

```text
tool.derivative
concept.function.continuity
phenomenon.motion.uniform_acceleration
model.harmonic_oscillator
law.energy_conservation
person.galileo_galilei
place.padua
mission.galileo.inclined_plane
```

Localised text is attached separately:

```json
{
  "id": "tool.derivative",
  "type": "mathematical_tool",
  "title": {
    "fr": "Dérivée",
    "en": "Derivative"
  },
  "shortPurpose": {
    "fr": "Décrire une variation instantanée.",
    "en": "Describe an instantaneous rate of change."
  }
}
```

Identifiers must not contain translated titles and must not change when wording is revised.

## 4. Knowledge node types

### 4.1 Mathematical tool

A reusable mathematical object or technique used to reason, calculate, or model.

Examples:

- vector;
- derivative;
- integral;
- complex number;
- matrix;
- eigenvalue;
- probability distribution;
- differential equation;
- gradient;
- series expansion.

A tool can be collected in the virtual backpack.

### 4.2 Mathematical concept

A mathematical idea that may support a tool or form part of a structure.

Examples:

- continuity;
- convergence;
- vector space;
- linearity;
- orthogonality;
- compactness at an appropriate curriculum depth;
- conditional probability.

Not every concept must appear as a separate backpack item.

### 4.3 Phenomenon

An observable physical or chemical behaviour.

Examples:

- free fall;
- orbital motion;
- resonance;
- diffraction;
- capacitor charging;
- heat diffusion;
- first-order chemical decay;
- acid-base equilibrium;
- radioactive decay.

Phenomena form the denominator for application-coverage metrics when linked to a mathematical tool.

### 4.4 Law or principle

A scientific statement with a defined domain of validity.

Examples:

- Newton's second law;
- conservation of energy;
- Gauss's law;
- second law of thermodynamics;
- mass-action law.

### 4.5 Model

A mathematical representation of a system, with assumptions and limits.

Examples:

- point mass;
- ideal gas;
- harmonic oscillator;
- perfect lens;
- RC circuit;
- reaction of order one;
- two-level quantum system.

A model must explicitly reference its assumptions and known limitations.

### 4.6 Experimental method

A method for producing, measuring, analysing, or validating evidence.

Examples:

- dimensional analysis;
- calibration;
- control experiment;
- uncertainty propagation;
- linear regression;
- repeated measurement;
- titration;
- spectroscopy.

### 4.7 Scientific question

A question that can organise several concepts and missions.

Examples:

- How can motion be predicted?
- Why do systems oscillate?
- How can invisible fields be measured?
- Why does a chemical reaction stop before all reactants disappear?

### 4.8 Historical person

A scientist or other relevant actor. The person record includes names, dates, roles, places, sources, and language-specific display notes.

### 4.9 Place

A historically meaningful location, represented with stable coordinates where appropriate and uncertainty metadata where exact location is not known.

### 4.10 Historical period or event

A date, interval, publication, experiment, institutional change, controversy, or discovery relevant to missions.

### 4.11 Mission

A playable historical learning scenario that references nodes, simulations, exercises, and sources.

### 4.12 Curriculum item

A versioned external or internal curriculum requirement. A curriculum item references graph nodes rather than becoming the node itself.

## 5. Knowledge edge types

Edges are typed and directed. A generic `related_to` edge should be avoided when a more meaningful relation is available.

Core edge types include:

| Edge | Meaning |
|---|---|
| `requires_essentially` | Activity or concept cannot be meaningfully completed without the source node |
| `requires_recommended` | Source strongly helps but can be supplied just in time |
| `introduces` | Mission or concept first presents another node |
| `uses` | Activity explicitly uses a tool, law, model, or method |
| `assesses` | Activity creates evidence for another node |
| `models` | Mathematical tool or model represents a phenomenon |
| `applies_to` | Tool can be used meaningfully in a phenomenon |
| `explains` | Model, law, or principle explains part of a phenomenon |
| `generalises` | Target extends source to a broader setting |
| `specialises` | Target is a restricted case of source |
| `analogous_to` | Structurally similar idea in another domain |
| `derived_from` | Target follows mathematically or conceptually from source |
| `measured_by` | Phenomenon or quantity is observed using a method or instrument |
| `historically_developed_by` | Idea is connected to a person with evidence metadata |
| `historically_occurred_at` | Event or mission is connected to a place |
| `historically_precedes` | Historical ordering, not necessarily logical dependence |
| `appears_in_mission` | Node is present in a mission |
| `aligned_with` | Node or depth is connected to a curriculum item |
| `contrasts_with` | Competing, complementary, or historically opposed idea |
| `transfers_to` | Learned use should transfer to another phenomenon or domain |

Each edge may contain:

- weight or pedagogical importance;
- curriculum-depth applicability;
- historical evidence references;
- author notes;
- visual routing hints;
- whether it contributes to application coverage;
- whether it is visible before discovery.

Example:

```json
{
  "id": "edge.derivative.free_fall",
  "from": "tool.derivative",
  "to": "phenomenon.motion.free_fall",
  "type": "applies_to",
  "coverageEligible": true,
  "weight": 1.0,
  "depthRange": [1, 3]
}
```

## 6. Curriculum model

### 6.1 One node, multiple depths

The same scientific idea is represented by one canonical node with one or more depth descriptors.

Example:

```json
{
  "nodeId": "tool.derivative",
  "depths": [
    {
      "depth": 1,
      "stage": "terminale",
      "role": "core",
      "outcomes": [
        "interpret a derivative as an instantaneous rate",
        "connect position, velocity, and acceleration",
        "differentiate standard functions"
      ]
    },
    {
      "depth": 2,
      "stage": "mpsi",
      "role": "core",
      "outcomes": [
        "reason about differentiability",
        "use local approximations and mean-value results",
        "use derivatives in differential models"
      ]
    },
    {
      "depth": 3,
      "stage": "mp",
      "role": "extension_and_application",
      "outcomes": [
        "work with partial derivatives and differentials",
        "interpret gradients",
        "use differentiation in systems and optimisation"
      ]
    }
  ]
}
```

Depth values are internal pedagogical levels. They must not be displayed as a simplistic intelligence ranking.

### 6.2 Versioned curricula

Curriculum definitions must be versioned because official programmes change.

A curriculum package includes:

```yaml
id: curriculum.fr.cpge.mpsi
country: FR
stage: mpsi
version: 2026-reference
valid_from: 2021-09-01
valid_to: null
source_references: []
items: []
```

The dates and source references must be verified when the package is authored. Learner progress is attached to canonical knowledge nodes and therefore survives a curriculum-package update.

### 6.3 Reference path for Paul

The initial path is configured as:

```yaml
path_id: fr-terminale-mpsi-mp
current_stage: terminale
horizon_years: 3
stages:
  - terminale
  - mpsi
  - mp
```

This path affects visibility, recommendations, and depth, not permission to inspect nodes.

## 7. Mission content model

### 7.1 Required mission fields

A mission definition contains at least:

```yaml
id: mission.example
status: draft
version: 1

localisation:
  title:
    fr: "..."
    en: "..."
  summary:
    fr: "..."
    en: "..."

historical_context:
  places: []
  date_or_interval: ""
  people: []
  evidence_summary:
    fr: ""
    en: ""
  sources: []

learning:
  central_question: "question.id"
  phenomena: []
  tools_introduced: []
  tools_used: []
  nodes_assessed: []
  essential_prerequisites: []
  recommended_prerequisites: []
  curriculum_alignments: []
  depth_variants: []

experience:
  estimated_minutes: 60
  steps: []
  simulation_refs: []
  exercise_refs: []
  transfer_targets: []
```

### 7.2 Mission variants

A single historical setting may support several depth variants.

Example:

```text
Discovery variant        30–40 minutes
Terminale variant        approximately 60 minutes
MPSI variant             approximately 60–90 minutes
MP or ENS/X challenge    optional extension
```

Variants share historical context and core phenomena but may use different mathematics, proofs, and exercises.

### 7.3 Mission step types

Reusable step types include:

- `historical_briefing`;
- `dialogue`;
- `source_inspection`;
- `observation`;
- `prediction`;
- `hypothesis_choice`;
- `simulation`;
- `measurement`;
- `graph_construction`;
- `mathematics_workshop`;
- `guided_derivation`;
- `proof`;
- `calculation`;
- `free_mathematical_response`;
- `model_selection`;
- `comparison_of_models`;
- `transfer_challenge`;
- `historical_debrief`;
- `reflection`;
- `map_return`.

Each step may define:

- bilingual instructions;
- guide notes;
- completion condition;
- optional hints;
- evidence emitted;
- time guidance;
- branch conditions;
- accessibility alternative;
- resume state.

### 7.4 Standard historical mission arc

The preferred full arc is:

```text
Arrival in place and time
→ role and unresolved question
→ prediction
→ observation or experiment
→ mathematical need
→ tool construction
→ return to phenomenon
→ transfer to another domain
→ historical and epistemological debrief
→ update map and backpack
```

This is a template, not a mandatory linear sequence. Authors may branch or revisit steps.

## 8. Historical evidence model

### 8.1 Evidence statuses

Every historically meaningful claim, scene, quotation, attribution, or date can carry one of these statuses:

| Status | Definition |
|---|---|
| `attested` | Directly supported by a reliable primary or scholarly source |
| `scholarly_interpretation` | A reasoned interpretation supported by historical scholarship |
| `pedagogical_reconstruction` | A plausible reconstruction created to make the concept learnable |
| `narrative_fiction` | An invented narrative element, clearly marked as such |

### 8.2 Quotations

A quotation record must include:

- exact source;
- original language;
- original text where legally and pedagogically appropriate;
- French translation;
- English translation;
- translator or translation status;
- quotation confidence;
- context note.

A narrative line without these fields must not be displayed as an authentic quotation.

### 8.3 Place and date uncertainty

Historical location and date records may include:

- exact;
- approximate;
- interval;
- disputed;
- unknown.

The learner-facing display should communicate uncertainty naturally instead of inventing precision.

### 8.4 Then versus now

Every substantial historical mission should include a debrief with:

```text
What was known or believed at the time
What the historical actors could measure
Which notation and mathematical tools were available
What was discovered later
How the modern model differs
```

## 9. Simulation model

### 9.1 Reusable engines

A simulation definition references a reusable engine and provides configuration.

Example:

```yaml
id: simulation.free_fall.basic
engine: motion_2d
seed_policy: deterministic

objects:
  - id: body
    type: point_mass
    position: [0, 10]
    velocity: [0, 0]
    mass: 1

forces:
  - type: uniform_gravity
    g: 9.81

controls:
  - variable: initial_height
    min: 1
    max: 30
  - variable: linear_drag
    min: 0
    max: 1

observables:
  - position
  - velocity
  - acceleration
  - energy

views:
  - world
  - position_time_graph
  - velocity_time_graph
```

### 9.2 Simulation contract

Every engine must define:

- accepted configuration schema;
- physical units;
- numerical method and limits;
- deterministic-state representation;
- observables;
- controls;
- accessible alternative representation;
- evidence events;
- bilingual labels supplied by content or interface dictionaries.

### 9.3 Scientific validity

Every simulation configuration must identify:

- model used;
- assumptions;
- domain of validity;
- numerical approximation;
- intentionally ignored effects;
- expected learning use.

## 10. Exercise and assessment model

### 10.1 Exercise types

The system supports at least:

- single or multiple choice with reasoning;
- numerical response with units and tolerance;
- symbolic mathematical response;
- graph reading or construction;
- parameter selection;
- ordering or classification;
- proof step or argument structure;
- free explanation evaluated by a guide rubric;
- model choice;
- transfer problem;
- multi-stage competition-style problem.

### 10.2 Difficulty dimensions

Difficulty must not be represented by a single arbitrary number. Useful dimensions include:

- mathematical depth;
- conceptual novelty;
- calculation length;
- modelling openness;
- number of linked concepts;
- need for transfer;
- historical-source interpretation;
- expected autonomy.

### 10.3 Rubrics

Exercises that produce mastery evidence reference a rubric.

Example rubric dimensions:

- recognises the relevant tool;
- explains why it applies;
- performs the procedure correctly;
- states assumptions;
- checks dimensions or units;
- interprets the result physically or chemically;
- transfers the tool to a new context.

### 10.4 Hints and autonomy

Evidence records how much help was used. Suggested autonomy coefficients are configurable:

| Performance mode | Example coefficient |
|---|---:|
| Fully guided | 0.4 |
| Significant hints | 0.6 |
| Light hint | 0.8 |
| Autonomous | 1.0 |

These coefficients should be calibrated rather than treated as immutable truth.

## 11. Learner evidence model

### 11.1 Evidence events

Activities emit immutable evidence events such as:

```text
mission_started
prediction_recorded
simulation_parameter_changed
measurement_recorded
hint_opened
exercise_attempted
exercise_solved
explanation_submitted
tool_selected_for_model
transfer_completed
mission_completed
guide_rubric_scored
```

Derived progress can be recalculated from evidence and algorithm version.

### 11.2 Evidence record example

```json
{
  "id": "evidence.01J...",
  "learnerId": "learner.paul.local",
  "timestamp": "2026-09-06T15:00:00Z",
  "missionId": "mission.galileo.inclined_plane",
  "stepId": "step.choose_derivative",
  "nodeId": "tool.derivative",
  "phenomenonId": "phenomenon.motion.accelerated",
  "type": "tool_selected_for_model",
  "result": "correct",
  "autonomy": 0.8,
  "depth": 1,
  "contentVersion": "0.1.0"
}
```

### 11.3 Visit versus learning

Opening a page can mark a node as seen, but it must not produce mastery evidence by itself.

## 12. Tool application coverage

### 12.1 Definition

Application coverage measures how broadly a learner has genuinely used a mathematical tool across eligible phenomena in the configured graph.

For tool `t`:

```text
coverage(t) = weighted explored applications / weighted eligible applications
```

A reference formulation is:

```text
C_t = Σ(w_p × a_t,p) / Σ(w_p)
```

where:

- `p` is an eligible phenomenon;
- `w_p` is the pedagogical importance of the tool-to-phenomenon edge;
- `a_t,p` is the strongest or aggregated evidence of use, from 0 to 1.

### 12.2 Eligibility

Only `applies_to` edges explicitly marked `coverageEligible: true` contribute to the denominator.

The denominator is affected by:

- selected curriculum package;
- configured horizon;
- content version;
- optional domain filters.

The UI must reveal the fraction and scope so that the percentage is not mysterious.

Example:

```text
8 of 23 eligible phenomena used
Weighted application coverage: 35%
Scope: Terminale + MPSI + MP
```

### 12.3 Application states

For each tool/phenomenon pair, the learner can have:

- not encountered;
- observed in a worked example;
- used with full guidance;
- used with hints;
- selected autonomously;
- transferred autonomously;
- retained on later review.

## 13. Mastery model

### 13.1 Mastery dimensions

A tool mastery estimate should include at least:

- `recognition_explanation`;
- `procedural_execution`;
- `modelling_choice`;
- `transfer`;
- `retention`.

A reference initial weighting may be:

```text
20% recognition and explanation
25% procedural execution
30% modelling choice
20% transfer
5% retention adjustment
```

Weights must be versioned and configurable.

### 13.2 Confidence

The system stores both an estimate and a confidence value.

Confidence should increase with:

- independent evidence items;
- diversity of contexts;
- higher autonomy;
- later successful review;
- agreement between exercise and guide observations.

One successful answer must not display as reliable mastery.

### 13.3 Recency and retention

Mastery need not simply decay every day. Instead, the recommendation system may lower confidence or flag review when evidence is old and no retained use has been observed.

### 13.4 Visible explanation

The backpack headline percentage is accompanied by an inspectable explanation:

```text
Mastery: 61%
Confidence: developing
Recognition: 75%
Execution: 85%
Modelling: 52%
Transfer: 40%
Last independent use: 3 weeks ago
```

## 14. Prerequisite policy

### 14.1 Essential prerequisites

Without these, the destination cannot be completed meaningfully. The application may still allow inspection but should warn that the full mission expects them.

### 14.2 Recommended prerequisites

These improve fluency but can be supplied with just-in-time micro-lessons.

### 14.3 Route generation

For a selected destination, the system can propose:

- direct route with embedded reminders;
- prepared route through prerequisites;
- lateral route through an analogous phenomenon;
- historical route following the development of ideas;
- review route through previously discovered tools.

### 14.4 Micro-portals

A missing recommended prerequisite can open a short reusable activity of approximately three to eight minutes:

```text
visual reminder
→ one example
→ one check
→ immediate return to mission
```

## 15. Learner node state

A learner's state for a node may contain:

```json
{
  "nodeId": "tool.derivative",
  "status": "practised",
  "firstSeenAt": "2026-09-10T00:00:00Z",
  "discoveredAt": "2026-09-10T00:20:00Z",
  "lastUsedAt": "2026-10-02T00:00:00Z",
  "highestDepthVisited": 1,
  "mastery": {
    "estimate": 0.61,
    "confidence": 0.54,
    "algorithmVersion": "mastery-0.1"
  },
  "coverage": {
    "estimate": 0.35,
    "appliedCount": 8,
    "eligibleCount": 23,
    "scope": "fr-terminale-mpsi-mp",
    "algorithmVersion": "coverage-0.1"
  },
  "reviewRecommended": false
}
```

Derived fields may be cached but must be reproducible from evidence whenever practical.

## 16. Bilingual content authoring

### 16.1 Required bilingual fields

Every learner-facing field must define both `fr` and `en` values before production publication.

### 16.2 Content parity

Translations should convey the same pedagogical task, not merely the same approximate topic. Validation should detect structural divergence such as:

- different numbers of choices;
- missing hints;
- different units;
- different completion conditions;
- an exercise answer valid in one language but not the other.

### 16.3 Mathematical vocabulary

A shared bilingual glossary shall define approved terms and aliases.

Example:

```yaml
id: glossary.derivative
fr:
  preferred: dérivée
  aliases: []
en:
  preferred: derivative
  aliases:
    - differential coefficient
notes: "Use the preferred form in learner UI."
```

### 16.4 Search

Search must index titles, aliases, glossary terms, people, places, and mission text in both languages while returning the same canonical nodes.

## 17. Content repository structure

Recommended source layout:

```text
content/
├── graph/
│   ├── nodes/
│   ├── edges/
│   └── curricula/
├── missions/
├── exercises/
├── simulations/
├── people/
├── places/
├── periods/
├── sources/
├── glossary/
├── routes/
└── assets/

schemas/
├── node.schema.json
├── edge.schema.json
├── mission.schema.json
├── exercise.schema.json
├── simulation.schema.json
└── source.schema.json
```

The source format may be YAML, JSON, or a controlled Markdown-plus-frontmatter format. It must compile to a deterministic runtime package.

## 18. Content validation

Publication validation must check at least:

- identifier uniqueness;
- valid references;
- absence of orphaned required nodes;
- required French and English strings;
- translation structure parity;
- valid curriculum stages and versions;
- acyclic essential prerequisite paths where required;
- explicit handling of intentional prerequisite cycles;
- valid units and parameter ranges;
- exercise answer consistency;
- source presence for historical claims;
- no authentic quotation without source metadata;
- mission place, time, and person metadata;
- tool-to-phenomenon coverage eligibility;
- simulation schema validity;
- accessibility alternative metadata;
- content-package version compatibility.

Warnings may include:

- tool with no applications;
- phenomenon with no modelling connection;
- mission with no transfer step;
- curriculum item with no graph alignment;
- historical person used only as decoration;
- excessive dependence on passive text.

## 19. Suggested initial vertical-slice graph

A useful first graph can include approximately 15–25 nodes.

### Mathematical tools and concepts

- function;
- graph;
- rate of change;
- derivative;
- vector;
- exponential function;
- first-order differential equation.

### Physical phenomena and models

- position, velocity, and acceleration;
- uniformly accelerated motion;
- free fall;
- motion with drag;
- capacitor charging;
- model of an RC circuit.

### Chemical phenomena and models

- concentration changing over time;
- first-order reaction kinetics;
- radioactive decay as an analogous exponential process.

### Bridge concepts

- measurement;
- dimension and unit;
- modelling;
- initial condition;
- rate proportional to current quantity.

### Historical objects

- one validated historical setting;
- one or more scientists;
- relevant place and period;
- primary or scholarly sources;
- then-versus-now debrief.

This graph is large enough to demonstrate transfer without pretending to implement the whole curriculum.

## 20. Acceptance criteria for the learning model

The model is acceptable for implementation when:

- the same derivative node supports Terminale, MPSI, and MP depth metadata;
- French and English content share canonical identifiers;
- a mission can reference a place, date, scientist, tool, phenomenon, simulation, exercise, and source;
- historical claims can be labelled by evidence status;
- the mission can emit evidence for both mastery and application coverage;
- selecting the derivative can reveal multiple linked phenomena;
- essential and recommended prerequisites produce different route behaviour;
- a learner can complete a mission in one language and inspect the same progress in the other;
- a new scoring algorithm can recalculate derived scores from stored evidence;
- curriculum-package updates do not erase canonical learner progress;
- incomplete translations and broken graph references fail content validation.
