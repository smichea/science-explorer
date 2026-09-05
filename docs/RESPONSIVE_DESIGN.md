# Science Explorer — Responsive Design Requirements

**Status:** Draft v0.1  
**Date:** 2026-09-06

Science Explorer is responsive by design. The complete learning experience must remain usable on phones, tablets, laptops, and desktop computers. Responsive behaviour is a product requirement, not a late CSS adaptation.

## 1. Supported device classes

The application shall support at least:

- small phones in portrait and landscape;
- large phones;
- tablets in portrait and landscape;
- laptops;
- desktop and large desktop displays.

The same learner profile, mission state, knowledge graph, and progression model are used on every device. Only presentation and interaction patterns adapt.

## 2. Responsive principles

### 2.1 Same universe, adapted viewport

The knowledge universe must remain conceptually identical across screen sizes. A mobile device must not receive a different curriculum or simplified graph merely because of its viewport.

What changes is:

- camera framing;
- label density;
- control placement;
- panel behaviour;
- amount of simultaneously visible secondary information;
- interaction gestures;
- rendering quality.

### 2.2 Mobile-first interaction design

All core learner actions must be possible with touch alone:

- pan and orbit;
- semantic zoom;
- select a world, region, or node;
- open a destination;
- switch map layers;
- open the backpack;
- run and manipulate simulations;
- answer exercises;
- pause and resume missions;
- switch language.

Hover must never be required for essential information or actions.

### 2.3 Progressive disclosure

Desktop can display the atlas, contextual information, backpack, and guide elements simultaneously. On smaller screens, secondary panels become drawers, bottom sheets, tabs, or full-screen overlays.

No important content should be permanently removed because of screen size.

## 3. Reference responsive layouts

### Phone portrait

- atlas uses the full viewport;
- top bar contains learner, language, and primary navigation in compact form;
- selected-node information opens as a draggable bottom sheet;
- backpack opens full-screen or as a bottom sheet;
- filters and map layers live in a compact drawer;
- mission steps use a single-column layout;
- simulation and instructions may switch between tabs when simultaneous display would be too small;
- mathematical keyboard must not hide the active expression or validation controls.

### Phone landscape

- prioritise simulation workspace;
- mission narrative may occupy a collapsible side panel;
- controls remain reachable without covering the main experimental area;
- use safe areas around device cut-outs and browser UI.

### Tablet portrait

- atlas remains dominant;
- contextual panel can occupy roughly one third of the screen;
- mission text and simulation may use resizable stacked areas;
- backpack can appear as a side drawer or modal panel.

### Tablet landscape

- atlas plus side panel is the default exploration layout;
- mission view may show narrative/exercise content beside the simulation;
- Guide mode may expose additional controls in a secondary rail.

### Laptop and desktop

- use multi-panel layouts where useful;
- atlas may coexist with concept details and backpack summaries;
- mission simulation and reasoning workspace can be visible together;
- wide screens must not stretch text lines excessively;
- large displays should reveal more context rather than simply scale everything up.

## 4. Breakpoints

Implementation should use content-driven breakpoints rather than device names alone. Initial CSS/container-query thresholds may start approximately around:

```text
compact:       < 600 px
medium:        600–899 px
large:         900–1279 px
extra-large:   >= 1280 px
```

These values are starting points and must be adjusted through real-device testing.

Container queries should be preferred for reusable panels and mission components whose layout depends on available component width rather than the global viewport.

## 5. 3D atlas responsiveness

The 3D atlas must adapt both UI and rendering load.

### Compact screens

- reduce visible label count;
- prioritise selected route and nearby concepts;
- enlarge hit targets;
- simplify decorative particles and distant geometry;
- use curated camera framing;
- prevent accidental selection during pan/orbit gestures.

### Larger screens

- progressively reveal additional labels and contextual routes;
- allow more simultaneous world context;
- show richer historical markers and bridge regions;
- expose optional persistent side panels.

Canonical world and node coordinates remain unchanged across devices.

## 6. Touch and pointer requirements

- minimum touch target should normally be at least 44 CSS px in each dimension;
- controls near screen edges must respect safe-area insets;
- gestures must have visible button alternatives when practical;
- pinch-to-zoom must coexist safely with page/browser gestures;
- drag thresholds must distinguish camera movement from node selection;
- mouse wheel, keyboard, and pointer interactions must remain available on desktop;
- stylus input should behave as pointer input without special requirements in the first release.

## 7. Responsive mission design

Mission steps are authored semantically, not with fixed pixel layouts.

A mission step declares its content blocks, for example:

```text
historical context
scientific question
prediction input
simulation
measurements
mathematical workspace
hint
validation
```

The runtime chooses an appropriate composition for the available space.

Content authors must not encode assumptions such as “the simulation is always on the right”.

## 8. Responsive simulations

Every simulation must support:

- dynamic canvas resizing;
- resolution scaling independent of CSS size;
- readable axes and labels at compact widths;
- touch-friendly parameter controls;
- collapsible advanced controls;
- portrait and landscape layouts;
- preservation of simulation state on orientation change;
- reduced graphics mode on constrained devices.

Where a scientifically meaningful simulation cannot fit beside instructions on a phone, the runtime may use separate `Experiment`, `Notebook`, and `Explanation` tabs while preserving a single continuous mission state.

## 9. Responsive mathematical input

- formula display wraps or scrolls deliberately rather than clipping;
- long derivations can use horizontal mathematical scrolling without forcing the whole page to scroll sideways;
- MathLive or equivalent input remains usable with the on-screen keyboard;
- answer controls remain visible while the software keyboard is open;
- graphs and matrices receive dedicated compact layouts when necessary.

## 10. Responsive backpack

### Phone

The backpack is a full-screen inventory or bottom sheet. Tool cards show headline mastery and application coverage first; details expand on demand.

### Tablet/Desktop

The backpack may remain in a side panel while the selected tool highlights application routes on the universe map.

All displays use the same underlying progression metrics.

## 11. Responsive Guide mode

Guide mode must work on a tablet and phone as well as desktop because the guide may stand beside the learner during a session.

On compact screens:

- guide controls are grouped in a drawer;
- step timing, expected reasoning, misconceptions, and hints use collapsible sections;
- large learner-facing simulation controls retain priority over guide metadata.

The guide should be able to operate the session from a tablet while the learner uses another device in a future synchronised configuration, but cross-device synchronisation is not required in the initial release.

## 12. Orientation and resize behaviour

Viewport resizing or device rotation must not:

- restart a mission;
- reset a simulation;
- lose an answer in progress;
- change selected concept;
- recreate learner evidence;
- reset camera destination unexpectedly.

State is preserved while layout recomposes.

## 13. Performance adaptation

Rendering quality is independent from curriculum depth.

The application may adapt:

- pixel ratio;
- shadow quality;
- particle count;
- texture resolution;
- level of detail;
- post-processing;
- number of simultaneous animated objects.

It must never remove scientifically necessary information solely to improve frame rate. A 2D equivalent or simplified scientific rendering should be used instead.

## 14. Responsive accessibility

Responsive layouts must maintain:

- logical DOM order;
- visible focus states;
- screen-reader landmarks;
- adequate text size;
- non-colour-only status indications;
- keyboard navigation;
- reduced-motion behaviour;
- no trapped focus inside drawers or 3D canvas overlays.

Browser zoom up to at least 200% must leave core flows usable.

## 15. Testing matrix

The critical flows must be tested at representative viewport sizes, including at least:

```text
360 × 800   phone portrait
800 × 360   phone landscape
768 × 1024  tablet portrait
1024 × 768  tablet landscape
1366 × 768  laptop
1440 × 900  desktop
1920 × 1080 large desktop
```

Automated tests should verify layout invariants, while manual tests on real touch devices validate gesture quality and readability.

## 16. Acceptance criteria

Responsive implementation is acceptable when:

- onboarding is fully usable on a 360 px-wide phone;
- the universe can be explored by touch without hover;
- selected-node details remain readable on phone, tablet, and desktop;
- the backpack is fully functional at every supported size;
- the historical mission vertical slice can be completed on a phone in portrait mode;
- its simulation remains practically usable in phone landscape mode;
- orientation changes preserve all active mission and simulation state;
- French and English both fit without clipped controls or essential labels;
- Guide mode is usable on a tablet;
- no horizontal page scrolling is required for normal UI;
- mathematical content has explicit overflow behaviour where unavoidable;
- the 3D atlas scales rendering complexity to device capability;
- a 2D accessible alternative remains available regardless of device size.
