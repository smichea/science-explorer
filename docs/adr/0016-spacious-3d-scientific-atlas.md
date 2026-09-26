# ADR-0016: Spacious 3D scientific atlas

- Status: accepted
- Date: 2026-09-26
- Amends: ADR-0007 for the 3D presentation only

## Context

The original region anchors were designed for a small vertical slice. With 113 destinations, neighbouring region spirals and historical satellites overlap. Primitive shapes also provide few visual clues about the scientific subject.

## Decision

The 3D renderer derives a deterministic presentation layout from the compiled graph. Region envelopes grow with their destination counts; world orbits reserve room for those envelopes. Historical satellites occupy separate slots in their anchor's region. The authored world orientation is retained. Coordinates do not depend on device, learner, filter, or animation. The compiled layout and the existing 2D map remain unchanged; switching representations can therefore change the precise arrangement of regions.

The overview emphasises three scientific landmarks. World views name regions, and closer views reveal destination labels. Camera framing uses the actual territory bounds and the viewport aspect ratio. Structural edges are shown when relevant to a selection, an explicit layer or a guided flight, rather than drawing the entire prerequisite network by default.

Procedural scientific sculptures replace individual primitive shapes. They evoke mathematical surfaces, tangents, distributions, vectors, orbital systems, waves, circuits, molecules, laboratory glassware and historical observation. These are navigation symbols, not simulations or exact molecular structures. Each sculpture's geometry is merged into a single mesh to bound draw calls. They require no remote assets or continuous animation.

## Validation

Unit tests check complete and deterministic placement, destination separation, territory separation and regional containment. Browser checks cover world → region → destination navigation and the existing selected-node interactions. Desktop and portrait screenshots are reviewed for framing and label collisions.
