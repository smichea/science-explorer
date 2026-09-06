# ADR-0015 — The stage of a destination is relative to the learner; foundations stay out of the flight

**Status:** accepted · 2026-09-06

## Context

The atlas grows downwards: the Seconde programme (then Première) joins the Terminale → MPSI → MP
slice. The learning model wants one node per idea with one depth per year, so a node taught in
Seconde and again in Terminale (the function, the vector, the kinematics of a point, measurement)
now carries a `seconde` depth below its `terminale` one. Until now the stage of a node was its
lowest depth, which would have turned these destinations into foundations for a Terminale learner,
pushed the derivative below the Terminale layer, and made the bird's-eye flight of Paul start with
thirty Seconde stops.

## Decision

- **`stageFor(node, horizon)`**: the stage at which a node meets a learner is the lowest of its
  depths at or above the learner's current stage, else its highest depth (a foundation from an
  earlier year). `learnerDepth` follows: the lesson opened from a destination, the depth
  unfolded in its card and the next-lesson link use the depth of that stage. Bands, the emphasis
  of the filters, the flight and the recommendations use `stageFor`; the layout keeps the lowest
  stage (a node sits where it is first taught, foundations a little below the Terminale layer).
- **Foundations are flown only on request.** `buildTour` takes `includeFoundations` (a preference
  next to "include what is already practised"); a route may declare its `stage`, and the flight
  skips a route of an earlier year for a learner already past it, so that a destination taught
  again later is flown in the legs of the learner's own years. The content compiler still checks
  the whole flight (every leg, every stage) for prerequisite inversions.
- **Stage filters come from the enumeration**: every stage but "beyond" has a filter, and a
  stage filter keeps a destination taught at that stage at any of its depths.
- **Depths go from 1 to 4** so that Seconde → Première → Terminale → MPSI fit on one node.

## Consequences

- Adding an earlier year to an existing node changes nothing for a learner of a later year except
  the depth number of what they follow; curricula align the depth of their own year.
- A learner of Seconde has Seconde as the current stage: everything of the year is current, the
  following years are next and final, nothing is a foundation.
- The count of the flight for a Terminale learner stays the count of the Terminale slice; the
  foundations add to it only when asked for.
