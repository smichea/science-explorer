# Architecture decision records

Decisions that shape the implementation of the vertical slice. Each record states its context, the decision and its consequences; superseding a decision means adding a new record, not rewriting an old one.

| # | Decision |
|---|----------|
| [0001](0001-sveltekit-static-spa-on-github-pages.md) | SvelteKit static single-page application deployed on GitHub Pages |
| [0002](0002-threejs-used-directly.md) | Three.js used directly inside one Svelte component (Threlte deferred) |
| [0003](0003-indexeddb-with-idb-and-migrations.md) | IndexedDB through `idb` with in-house migrations |
| [0004](0004-yaml-content-with-markdown-latex-and-zod.md) | Content authored in YAML with Markdown + LaTeX strings, validated by zod |
| [0005](0005-structured-answers-and-katex.md) | Structured answer checking with KaTeX rendering (MathLive deferred) |
| [0006](0006-simulation-engines-motion2d-and-first-order.md) | Two reusable simulation engines, `motion_2d` and `first_order` |
| [0007](0007-authored-hybrid-layout-frozen-per-content-version.md) | Authored hybrid layout frozen per content version |
| [0008](0008-optional-local-guide-pin.md) | Optional local PIN for guide mode |
| [0009](0009-pwa-update-on-next-launch.md) | Progressive web app with updates applied on the next launch |
| [0010](0010-no-cloud-sync-export-import-boundary.md) | No cloud synchronisation; export/import is the transfer boundary |
| [0011](0011-single-application-repository-with-explicit-boundaries.md) | Single application repository with explicit module boundaries |
| [0012](0012-typed-i18n-and-localised-content-fields.md) | Typed interface dictionaries and localised content fields |
| [0013](0013-browser-speech-synthesis-for-guided-flights.md) | Browser speech synthesis for the bird's-eye flight |
| [0014](0014-narrated-interactive-lessons.md) | Narrated, interactive lessons: slides, a tool that follows the words, free play, typed exercises |
| [0015](0015-learner-relative-stage-and-foundations.md) | The stage of a destination is relative to the learner; foundations stay out of the flight unless asked for |
