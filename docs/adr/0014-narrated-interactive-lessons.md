# ADR-0014 — Narrated, interactive lessons: slides, a tool that follows the words, free play, typed exercises

**Status:** accepted · 2026-09-06

## Context

The lesson of a destination was a page of Markdown. The learner asked for lessons that work like
the historical mission: short steps, the text read aloud, and an interactive screen next to it
where the objects named by the text appear as they are named (a curve plotter for functions), then
a moment to play with the tool, then exercises with typed answers rather than multiple choice.

## Decision

- A lesson is content (`content/lessons/<node>.yaml`, `LessonSchema`): a tool (`plotter` or
  `simulation`), then steps of three kinds — `slide` (read, then moves on), `play` (waits), and
  `exercises` (ids of exercises of the node). A slide carries `actions` keyed by the index of the
  sentence at which they fire: `plot`, `point`, `secant`, `tangent`, `interval`, `hide`, `clear`,
  `view`, `set`. Items accumulate from slide to slide; the state of the plotter at any point of
  the text is a pure replay of the actions (`plotterStateAt`), so going back is exact.
- The narration reuses the browser voice of ADR-0013, sentence by sentence; the `onSentence`
  callback of the speech wrapper drives the actions. Without a voice, the sentences are paced on
  their reading time, so the tool still follows the text.
- Every non-mission node has a lesson: without an authored script, the slides are cut from the
  description (one paragraph each), followed by a free play when there is a tool and by the
  exercises of the node. Authoring a script adds the tool and the synchronisation.
- The plotter is a small SVG component fed by the safe expression compiler already used for
  symbolic answers (`compileExpression`): variable, parameters, `exp`, `ln`, `sqrt`,
  trigonometric functions. Secants and tangents are computed numerically.
- Evidence: reaching the play or the exercises records `worked_example_observed` (the destination
  becomes *discovered*); exercise results are recorded like in a mission, with the lesson id as
  `stepId`.
- The short presentation (`overview`) is read aloud when a destination opens, governed by one
  `voice` preference shared with the flight (default on).

## Consequences

- Content authors write lessons as prose meant to be heard (no LaTeX in slide text; formulas are
  shown by the tool's labels and by the exercises).
- The compiler validates expressions, references and sentence indices, so a broken lesson never
  ships.
- Simulations are shown as tools without synchronised actions for now; a later ADR may add
  actions (play, set a parameter, mark a time) to the simulation engines.
