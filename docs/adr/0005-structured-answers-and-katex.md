# ADR-0005: Structured answer checking with KaTeX rendering (MathLive deferred)

- Status: accepted
- Date: 2026-09-05

## Context

Exercises must be checked locally and explainably: numeric values with units and tolerance, choices with partial credit, orderings, small symbolic expressions and free explanations assessed by the guide with a rubric.

## Decision

- Each exercise type has a structured answer specification and a pure checker in `src/lib/domain/answers.ts` (`checkNumeric`, `checkChoice`, `checkOrdering`, `checkSymbolic`).
- Symbolic answers are parsed by a small recursive-descent parser and compared numerically at sample points, which covers the polynomial and exponential expressions of the vertical slice without a computer algebra system.
- Mathematics is rendered with KaTeX (fonts bundled, no CDN). A formula editor such as MathLive is deferred: typed linear expressions with `inputmode="decimal"` are sufficient for the current exercises.
- Free explanations are never auto-graded; the guide scores them with the rubric and the score becomes evidence.

## Consequences

- Checking works offline and is deterministic; feedback names the unit or the missing reasoning instead of a bare wrong/right.
- Adding a computer algebra system later only replaces `checkSymbolic`.
