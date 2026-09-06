# Content authoring guide

Authored content lives under `content/` as YAML files whose learner-facing strings are
Markdown with `$…$` / `$$…$$` LaTeX. The compiler (`npm run content:validate` /
`npm run content:compile`) validates every file against the zod schemas in
`src/lib/content-schema/` and writes the immutable runtime package to
`static/content/core-0.1.0/`.

Rules that make the build **fail**:

- every learner-facing field needs both `fr` and `en` (never one language only);
- parallel lists (`{fr: [...], en: [...]}`) must have the same length;
- identifiers are stable, language-neutral, lower-case: `kind.name.sub_name`
  (`tool.derivative`, `mission.galileo.inclined_plane`); never change an id to reword a title;
- every reference (`region`, `world`, `from`/`to`, `sources`, `exerciseIds`, …) must exist;
- a historical claim marked `attested` or `scholarly_interpretation` needs at least one source;
- a dialogue line marked `attested` must reference a `quotation` record (invented dialogue is
  `narrative_fiction` or `pedagogical_reconstruction`, never presented as authentic);
- `coverageEligible: true` is allowed only on `applies_to` / `models` edges;
- essential prerequisites must not form a cycle;
- `backpack: true` tools must carry the `tool` block (the five questions of the concept view);
- exercises must carry the block matching their `type`, with at least one correct choice, an
  ordering that is a permutation of the items, etc.

Warnings (printed, non-blocking): tool without application, phenomenon without model,
mission without transfer step, curriculum item without alignment, decorative person,
node without description.

## YAML gotchas

- In flow style `{ fr: a, en: b }` a **comma inside a value breaks the mapping**. Use block
  style or quote the strings: `fr: "Suites, séries et limites"`.
- A colon followed by a space inside a value must be quoted: `fr: "Vitesse : dérivée de la position"`.
- LaTeX backslashes are safe in single-quoted or block scalars (`|`). In double quotes,
  write `\\` for every backslash. Prefer `|` blocks for long Markdown.

## Folders and shapes

### `content/graph/worlds.yaml`

Worlds, regions and bridge hubs (already authored — do not add regions without discussion).

### `content/graph/nodes/<id>.yaml` — one file per node

```yaml
id: tool.derivative
type: mathematical_tool      # mathematical_tool | mathematical_concept | phenomenon | law | model | method | question
world: world.mathematics     # optional when region is a bridge hub; must match the region's world otherwise
region: region.math.functions_analysis   # region id or bridge id (bridge.modelling …)
# anchorNode: some.node.id  # instead of region: place next to another node (questions, missions)
importance: 3                # 1 minor, 2 normal, 3 major
backpack: true               # only for mathematical tools collected in the backpack
tags: [vertical-slice]
title: { fr: Dérivée, en: Derivative }
shortPurpose:
  fr: Décrire une variation instantanée.
  en: Describe an instantaneous rate of change.
overview:                    # spoken presentation for the bird's-eye flight: 2–4 plain sentences,
  fr: >-                     # no LaTeX, no Markdown (read aloud as is); falls back to shortPurpose
    La dérivée est l'outil central de tout le voyage. …
  en: >-
    The derivative is the central tool of the whole journey. …
aliases:
  fr: [nombre dérivé, fonction dérivée, taux de variation instantané]
  en: [differential coefficient, instantaneous rate of change]
description:                 # Markdown + LaTeX, both languages, 1–3 paragraphs
  fr: |
    La dérivée mesure ...
  en: |
    The derivative measures ...
tool:                        # required when backpack: true
  problemSolved: { fr: "…", en: "…" }     # What problem does this tool solve?
  construction:  { fr: "…", en: "…" }     # How is it constructed?
  icon: slope
depths:                      # one node, several curriculum depths (never one node per year)
  - depth: 1
    stage: terminale         # seconde | premiere | terminale | mpsi | mp | beyond
    role: core               # core | extension_and_application | discovery | review
    outcomes:
      fr: ["interpréter une dérivée comme un taux de variation instantané", "…"]
      en: ["interpret a derivative as an instantaneous rate", "…"]
    lesson:                  # optional short lesson for this depth (Markdown + LaTeX)
      fr: |
        …
      en: |
        …
model:                       # for type: model (assumptions and known limits)
  assumptions: { fr: ["…"], en: ["…"] }
  limits: { fr: ["…"], en: ["…"] }
law:                         # for type: law
  statement: { fr: "…", en: "…" }
  validity: { fr: "…", en: "…" }
history:                     # optional historical attribution shown on the node
  summary: { fr: "…", en: "…" }
  status: attested           # attested | scholarly_interpretation | pedagogical_reconstruction | narrative_fiction
  sources: [source.drake.1978]
sources: []                  # sources for the node text itself (optional)
```

### `content/graph/edges/<theme>.yaml`

```yaml
edges:
  - from: concept.rate_of_change
    to: tool.derivative
    type: requires_essentially      # see the 20 types in LEARNING_AND_CONTENT_MODEL §5
    weight: 1
  - from: tool.derivative
    to: phenomenon.motion.free_fall
    type: applies_to
    coverageEligible: true          # counts in the tool's application coverage
    weight: 1
    depthRange: [1, 3]
  - from: phenomenon.motion.uniformly_accelerated
    to: person.galileo_galilei
    type: historically_developed_by
    evidenceStatus: attested        # required for historical edges
    sources: [source.galileo.discorsi.1638]
    note: { fr: "…", en: "…" }
```

Edge direction conventions: `requires_*` goes **from the prerequisite to the dependent node**;
`applies_to` / `models` / `explains` go from tool/model/law **to the phenomenon**;
`specialises` from the special case to the general one; `transfers_to` from the first
phenomenon to the one the tool should transfer to; `appears_in_mission` from node to mission;
`aligned_with` is not used as an edge (alignment lives in curricula files).

### `content/people/<id>.yaml`, `content/places/<id>.yaml`, `content/periods/<id>.yaml`

```yaml
# person
id: person.galileo_galilei
anchorNode: mission.galileo.inclined_plane
importance: 3
title: { fr: Galilée, en: Galileo Galilei }
shortPurpose: { fr: "…", en: "…" }
names: { display: { fr: Galilée, en: Galileo Galilei }, original: Galileo Galilei }
born: { certainty: exact, from: "1564-02-15", display: { fr: 15 février 1564, en: 15 February 1564 } }
died: { certainty: exact, from: "1642-01-08", display: { fr: 8 janvier 1642, en: 8 January 1642 } }
roles: { fr: ["…"], en: ["…"] }
places: [place.padua]
biography: { fr: "…", en: "…" }
evidenceStatus: attested
sources: [source.drake.1978]

# place
id: place.padua
anchorNode: mission.galileo.inclined_plane
title: { fr: Padoue, en: Padua }
shortPurpose: { fr: "…", en: "…" }
modernName: { fr: Padoue (Italie), en: Padua (Italy) }
coordinates: { lat: 45.4064, lon: 11.8768 }
locationCertainty: exact          # exact | approximate | disputed | unknown
context: { fr: "…", en: "…" }
sources: [source.drake.1978]

# period
id: period.galileo_padua_1592_1610
anchorNode: mission.galileo.inclined_plane
title: { fr: "…", en: "…" }
shortPurpose: { fr: "…", en: "…" }
date: { certainty: interval, from: "1592", to: "1610", display: { fr: "1592–1610", en: "1592–1610" } }
context: { fr: "…", en: "…" }
people: [person.galileo_galilei]
places: [place.padua]
sources: [source.drake.1978]
```

### `content/sources/<name>.yaml`

```yaml
sources:
  - id: source.galileo.discorsi.1638
    kind: primary                    # primary | manuscript | translation | scholarly | tertiary
    title: Discorsi e dimostrazioni matematiche intorno a due nuove scienze
    authors: [Galileo Galilei]
    year: "1638"
    publication: Elzevir
    place: Leiden
    language: it
    note: { fr: "Troisième journée : du mouvement naturellement accéléré.", en: "Third Day: on naturally accelerated motion." }
quotations:
  - id: quotation.galileo.discorsi.odd_numbers
    source: source.galileo.discorsi.1638
    originalLanguage: it
    originalText: "…"                # optional
    fr: "…"
    en: "…"
    translationStatus: published_translation   # published_translation | authors_translation | paraphrase
    confidence: high                 # high | medium | low
    context: { fr: "…", en: "…" }
```

### `content/curricula/programmes/<id>.yaml`

```yaml
id: curriculum.fr.terminale.maths
country: FR
stage: terminale
subject: mathematics             # mathematics | physics_chemistry | physics | chemistry | informatics
title: { fr: "…", en: "…" }
version: 2026-reference
validFrom: "2020-09-01"
validTo: null
sourceReferences:
  - { title: "Programme de mathématiques de terminale générale, BO spécial n°8 du 25 juillet 2019", note: "to verify" }
items:
  - id: derivation
    title: { fr: Compléments sur la dérivation, en: Further differentiation }
    reference: "Analyse — Compléments sur la dérivation"
    alignedNodes: [{ node: tool.derivative, depth: 1 }]
```

### `content/missions/<id>.yaml`

See `src/lib/content-schema/mission.ts`. Skeleton:

```yaml
id: mission.galileo.inclined_plane
status: review
version: 1
title: { fr: "…", en: "…" }
summary: { fr: "…", en: "…" }
role: { fr: "…", en: "…" }            # the learner's role (labelled fiction/reconstruction in the text)
anchorNode: phenomenon.motion.inclined_plane
importance: 3
historicalContext:
  places: [place.padua]
  date: { certainty: interval, from: "1602", to: "1608", display: { fr: "vers 1604", en: "c. 1604" }, note: { fr: "…", en: "…" } }
  people: [person.galileo_galilei]
  evidenceSummary: { fr: "…", en: "…" }
  sources: [source.galileo.discorsi.1638, source.drake.1978]
  claims:
    - { id: professorship, claim: { fr: "…", en: "…" }, status: attested, sources: [source.drake.1978] }
learning:
  centralQuestion: question.how_to_predict_motion
  phenomena: [phenomenon.motion.inclined_plane, phenomenon.motion.uniformly_accelerated]
  toolsIntroduced: [tool.derivative]
  toolsUsed: [tool.derivative]
  nodesAssessed: [tool.derivative, concept.rate_of_change]
  essentialPrerequisites: [concept.function]
  recommendedPrerequisites: [concept.graph, concept.rate_of_change]
  curriculumAlignments: [{ curriculum: curriculum.fr.terminale.maths, item: derivation, depth: 1 }]
  depthVariants:
    - { id: terminale, depth: 1, title: { fr: "…", en: "…" }, minutes: 70 }
    - { id: discovery, depth: 1, title: { fr: "…", en: "…" }, minutes: 35, skipSteps: [graph_construction, return_calculation] }
experience:
  estimatedMinutes: 70
  transferTargets: [phenomenon.circuit.capacitor_charging, phenomenon.chemistry.first_order_reaction]
  steps:
    - id: arrival
      type: historical_briefing     # the 20 step types of LEARNING_AND_CONTENT_MODEL §7.3
      title: { fr: "…", en: "…" }
      instructions: { fr: "…markdown…", en: "…" }
      dialogue:                     # optional
        - { speaker: narrator, text: { fr: "…", en: "…" }, status: pedagogical_reconstruction }
        - { speaker: person.galileo_galilei, text: { fr: "…", en: "…" }, status: narrative_fiction }
      guideNotes: { fr: "…", en: "…" }
      oralPrompts: { fr: ["…"], en: ["…"] }
      misconceptions: { fr: ["…"], en: ["…"] }
      hints: [{ id: h1, text: { fr: "…", en: "…" }, autonomy: 0.8 }]
      minutes: 3
      completion: { kind: read }    # read | choice | inputs | simulation | exercises | explanation
      evidence: [{ type: mission_started }]
      historicalClaims:
        - { id: c1, claim: { fr: "…", en: "…" }, status: attested, sources: [source.drake.1978] }
      a11y: { fr: "…", en: "…" }
    - id: prediction
      type: prediction
      completion:
        kind: choice
        choices:
          - { id: linear, text: { fr: "…", en: "…" }, feedback: { fr: "…", en: "…" } }
          - { id: square, text: { fr: "…", en: "…" }, correct: true }
      evidence: [{ type: prediction_recorded, phenomenonId: phenomenon.motion.uniformly_accelerated }]
      …
    - id: observe
      type: simulation
      simulationRef: simulation.galileo.inclined_plane
      completion: { kind: simulation, minMeasurements: 3 }
      evidence:
        - { type: measurement_recorded, nodeId: method.measurement, phenomenonId: phenomenon.motion.inclined_plane }
      …
    - id: workshop
      type: mathematics_workshop
      completion: { kind: exercises, exerciseIds: [exercise.workshop.difference_quotient, …] }
      evidence: []               # exercise evidence is emitted by the exercises themselves
      …
    - id: return
      type: model_selection
      toolSelection:
        phenomenonId: phenomenon.motion.uniformly_accelerated
        candidates: [tool.derivative, tool.vector, tool.exponential]
        correct: tool.derivative
      completion: { kind: exercises, exerciseIds: [exercise.return.velocity_value] }
      …
    - id: transfer_rc
      type: transfer_challenge
      simulationRef: simulation.rc.charging
      transferTargets: [phenomenon.circuit.capacitor_charging]
      toolSelection: { phenomenonId: phenomenon.circuit.capacitor_charging, candidates: [tool.derivative, tool.vector], correct: tool.derivative }
      completion: { kind: exercises, exerciseIds: [exercise.transfer.rc_model, exercise.transfer.rc_rate] }
      evidence: [{ type: transfer_completed, nodeId: tool.derivative, phenomenonId: phenomenon.circuit.capacitor_charging, dimension: transfer }]
      …
    - id: reflection
      type: reflection
      completion: { kind: explanation, minCharacters: 80 }
      evidence: [{ type: explanation_submitted, nodeId: tool.derivative, dimension: recognition_explanation }]
    - id: map_return
      type: map_return
      completion: { kind: read }
      evidence: [{ type: mission_completed }]
debrief:                            # then vs now (LEARNING_AND_CONTENT_MODEL §8.4)
  knownAtTheTime: { fr: "…", en: "…" }
  couldMeasure: { fr: "…", en: "…" }
  toolsAvailable: { fr: "…", en: "…" }
  discoveredLater: { fr: "…", en: "…" }
  modernModel: { fr: "…", en: "…" }
```

Evidence emitted automatically by the runtime: `exercise_attempted` / `exercise_solved` for
each exercise (with the exercise's `nodeId`, `phenomenonId`, `evidenceDimension`, depth and
autonomy from hints); `tool_selected_for_model` when a `toolSelection` is answered;
`hint_opened`, `simulation_parameter_changed`, `measurement_recorded`. The `evidence` list of
a step adds events emitted when the step is completed.

### `content/exercises/<id>.yaml`

```yaml
id: exercise.workshop.difference_quotient
type: numeric                    # numeric | choice | ordering | symbolic | free_explanation
nodeId: tool.derivative
phenomenonId: phenomenon.motion.uniformly_accelerated   # optional
depth: 1
evidenceDimension: procedural_execution   # recognition_explanation | procedural_execution | modelling_choice | transfer | retention
prompt: { fr: "…markdown…", en: "…" }
context: { fr: "…", en: "…" }              # optional
numeric: { value: 4.2, unit: "m/s", tolerance: { kind: relative, value: 0.02 }, inputLabel: { fr: "Taux moyen", en: "Average rate" } }
# choice:
#   multiple: false
#   requireReasoning: true
#   choices:
#     - { id: a, text: { fr: "…", en: "…" }, correct: true, feedback: { fr: "…", en: "…" } }
# ordering:
#   items: [{ id: s1, text: { fr: "…", en: "…" } }, …]
#   correctOrder: [s1, s2, s3]
# symbolic: { variable: t, accepted: ["6*t+2", "2+6*t"], display: "x'(t) =" }   # compared numerically after parsing
# rubric:
#   id: rubric.derivative.explanation
#   criteria: [{ id: recognises, text: { fr: "…", en: "…" }, weight: 1 }, …]
hints:
  - { id: h1, text: { fr: "…", en: "…" }, autonomy: 0.8 }
  - { id: h2, text: { fr: "…", en: "…" }, autonomy: 0.6 }
solution: { fr: "…markdown…", en: "…" }
difficulty: { mathematicalDepth: 1, conceptualNovelty: 2, calculationLength: 1, modellingOpenness: 1, linkedConcepts: 2, transfer: 1, autonomy: 2 }
```

Symbolic answers are compared by evaluating the learner's expression and each accepted
expression at sample points: `6t+2`, `2 + 6*t`, `2(3t+1)` are all equivalent. Supported:
`+ - * / ^`, implicit multiplication (`6t`), parentheses, `exp ln sqrt sin cos`, `pi`, `e`.

### `content/simulations/<id>.yaml`

```yaml
id: simulation.galileo.inclined_plane
engine: motion_2d                # motion_2d | first_order
title: { fr: "…", en: "…" }
description: { fr: "…", en: "…" }
seedPolicy: deterministic
seed: 1604
config:                          # validated by the engine schema (src/lib/content-schema/simulation.ts)
  scene: inclined_plane          # inclined_plane | free_fall | projectile
  g: 9.81
  mass: 0.1
  angle: 10
  length: 7
  linearDrag: 0
  rolling: true                  # solid sphere rolling without slipping: a = (5/7) g sin(angle)
  dt: 0.001
  clockNoise: 0
controls:
  - { variable: angle, label: { fr: "Angle du plan", en: "Plane angle" }, min: 3, max: 30, step: 1, unit: "°", default: 10 }
  - { variable: clockNoise, label: { fr: "Bruit de l'horloge à eau", en: "Water-clock noise" }, min: 0, max: 0.05, step: 0.01, default: 0 }
observables: [position, velocity, acceleration, energy]
views: [world, position_time_graph, velocity_time_graph, table]
modelNode: model.kinematics_point
assumptions: { fr: ["…"], en: ["…"] }
validity: { fr: "…", en: "…" }
numericalMethod: { fr: "Runge-Kutta d'ordre 4, pas fixe 1 ms", en: "Fourth-order Runge-Kutta, fixed 1 ms step" }
ignoredEffects: { fr: ["…"], en: ["…"] }
learningUse: { fr: "…", en: "…" }
a11y: { fr: "…", en: "…" }
```

`first_order` config: `{ scene: rc_charging | first_order_kinetics | radioactive_decay | newton_cooling, target, initial, tau, unit, timeUnit, duration, dt }`
models `dq/dt = (target − q) / tau`.

### `content/glossary/<name>.yaml`, `content/routes/<name>.yaml`

```yaml
entries:
  - id: glossary.derivative
    nodeId: tool.derivative
    fr: { preferred: dérivée, aliases: [nombre dérivé] }
    en: { preferred: derivative, aliases: [differential coefficient] }
    notes: Use the preferred form in learner UI.
routes:
  - id: route.first_journey
    kind: recommended            # recommended | thematic | historical | review
    title: { fr: "…", en: "…" }
    summary: { fr: "…", en: "…" }
    nodes: [concept.function, concept.graph, concept.rate_of_change, tool.derivative, mission.galileo.inclined_plane]
                                 # in visiting order: a prerequisite before what needs it; missions are practice steps
tours:                           # guided flights ("bird's-eye"): an ordered sequence of legs
  - id: tour.horizon_flight
    title: { fr: "Vol d'oiseau", en: "Bird's-eye flight" }
    intro: { fr: "…", en: "…" }  # spoken before the first leg
    legs:
      - route: route.first_journey                 # an authored route (its summary opens the leg)
      - route: route.galileo_history
        transition: { fr: "…", en: "…" }           # REQUIRED from the second leg: links the previous leg to this one
      - world: world.mathematics                   # automatic leg: what remains in a world (horizon scope)
        title: { fr: "…", en: "…" }
        transition: { fr: "…", en: "…" }
      - history: true                              # remaining people, places, periods
        title: { fr: "…", en: "…" }
        transition: { fr: "…", en: "…" }
      - bridges: true                              # remaining bridge nodes (methods, shared concepts, questions)
        title: { fr: "…", en: "…" }
        transition: { fr: "…", en: "…" }
    outro: { fr: "…", en: "…" }
```

A flight visits each lesson once: first along its routes, then in the automatic legs. Missions are never stops (they are practised, not presented), so no text of a flight should mention them. Lessons already practised or mastered are skipped (unless the learner asks to include them), and a leg left empty is skipped together with its transition, so write every transition so that it still reads well when the previous leg was not flown ("Cap maintenant sur…"). The compiler refuses a leg without a transition (after the first) and warns when a lesson on a flown route has no `overview`.

A flight follows the prerequisites (`requires_essentially` and `requires_recommended` edges): a destination is always flown after the prerequisites flown before it. Inside a leg the order is fixed automatically (a prerequisite written after a node that needs it is pulled forward, just before that node); across legs the compiler rebuilds the complete flight, over the whole universe, and reports every inversion: an **error** for an essential prerequisite, a **warning** for a recommended one. Order the routes and the legs so that the compilation stays silent.

### `content/lessons/<node>.yaml` — narrated, interactive lessons

See `src/lib/content-schema/lesson.ts`. A lesson is played on `/lesson/<nodeId>`: slides read
aloud on the left (the voice of the browser, on by default), one or several tools on the right
that follow the words, a free play with the tools, then exercises with typed answers. Skeleton:

```yaml
id: lesson.concept.function
nodeId: concept.function
depth: 1                            # one lesson per node and depth
tools:                              # one or several; a step shows one of them (`tool: <id>`)
  - id: plotter
    kind: plotter                   # plotter | simulation | vectors | slope_field | fit | field | dimensions | timeline
    variable: x
    view: { x: [-3, 3], y: [-2, 10] }
    parameters:                     # sliders of the free play, usable in expressions (a, a+h)
      - { id: h, label: { fr: "largeur h", en: "width h" }, min: 0.02, max: 1.5, step: 0.02, value: 1 }
    input: true                     # the learner may type an expression of the variable
steps:
  - id: definition
    kind: slide                     # slide (read, then moves on) | play | exercises
    title: { fr: "…", en: "…" }
    text:                           # plain prose, read sentence by sentence; avoid LaTeX here
      fr: >-
        Une fonction associe à chaque valeur de la variable une valeur et une seule.
        Prenons la fonction carré : à tout réel x, elle associe x au carré.
      en: >-
        …
    actions:                        # fired at sentence `at` (0-based) while the text is read
      - { at: 1, plot: { id: f, expr: "x^2", label: { fr: "f(x) = x²", en: "f(x) = x²" } } }
      - { at: 1, point: { id: p, on: f, x: 2, guides: true, label: { fr: "f(2) = 4", en: "f(2) = 4" } } }
      # plotter only: secant { id, on, from, to }  tangent { id, on, x }  interval { id, on, from, to }  clear
      # every tool: show [ids]  hide [ids]  set { h: 0.5 }  view { x, y, labels: { x: "t (s)", y: "h (m)" } }
  - id: play
    kind: play
    text: { fr: "À vous…", en: "Your turn…" }
  - id: exercises
    kind: exercises
    text: { fr: "…", en: "…" }
    exercises: [exercise.function.image, exercise.function.preimage]
```

The tools, all fed by the safe expression compiler (variable and parameters, `exp`, `ln`, `log`,
`sqrt`, `sin`, `cos`, `tan`, `pi`, `e`):

| kind | what it shows | its items (declare `hidden: true` to reveal them with `show`) | free play |
| --- | --- | --- | --- |
| `plotter` | curves of one variable | drawn by the actions | typed expression, marker, tangent, sliders |
| `simulation` | an existing simulation (`simulationId`) | — | the simulation's own controls |
| `vectors` | arrows with components, sums, parametric paths | `vectors` (`x`, `y` may use parameters; `from` chains), `paths` (`x`, `y` of `s`), `sums` | drag the heads (`drag: true`), sliders |
| `slope_field` | the direction field of `y' = equation(x, y)` and solutions | `solutions` (`x0`, `y0`) | click to add an initial condition, sliders |
| `fit` | measured points (`points` or a seeded `generator`) and candidate `models` | `models` | choose a model, tune sliders, `measure: true` adds points, `target` asks a prediction |
| `field` | a scalar field `expr(x, y)` as a heat map with iso-lines and the gradient at a marker | — | drag the marker, sliders |
| `dimensions` | a table of `quantities` with dimension exponents and SI units | `quantities` | rebuild a derived quantity (`base: false`) from the base ones |
| `timeline` | events (`year`, or `start`–`end`) on lanes, a year cursor | `events` | drag the cursor |

- Without `steps`, the slides are cut from the node `description` (one paragraph each), followed
  by a free play when there is a tool and by the exercises of the node. Every node therefore has a
  lesson; authoring the steps adds the synchronisation with the words. An authored lesson without
  an exercises step still ends with the exercises of the node.
- The compiler refuses an unknown node, tool, exercise or simulation, an expression that does not
  compile, two lessons for the same node and depth, drawing actions on a tool that is not a
  plotter; it warns when an action fires beyond the last French sentence, when a lesson has no
  tool, no free play or a node without exercise, and when `show`/`hide` name an unknown item.
- Numbers in the spoken text: write them as words or digits, never as LaTeX (a formula is read
  as "formule"); a sentence may end with a variable (`x.`), while a capitalised one- or two-letter
  word (`M.`) glues the next sentence.

## Historical honesty checklist

1. Every date carries its certainty (`exact`, `approximate`, `interval`, `disputed`, `unknown`).
2. Every claim is labelled; `attested` and `scholarly_interpretation` cite sources.
3. Dialogue lines are `narrative_fiction` or `pedagogical_reconstruction` unless backed by a
   quotation record with source, original language, translations and confidence.
4. The debrief separates what was known then, what could be measured, which tools existed,
   what came later and how the modern model differs.
5. Locators (page, folio, letter date) are verified before `status: published`.
