# ADR-0006: Two reusable simulation engines, `motion_2d` and `first_order`

- Status: accepted
- Date: 2026-09-05

## Context

The Galileo mission needs an inclined plane with measurement tools; the transfer challenges need an RC circuit and a first-order reaction; later content needs free fall, drag and radioactive decay. Simulations must be deterministic, explainable and usable without animation.

## Decision

- `motion_2d`: point mass under uniform gravity, optional linear drag, inclined plane with an optional rolling factor (5/7 for a solid sphere), integrated with fixed-step RK4; analytic solutions are exposed for comparison, and measurement tools (clock marks, seeded water-clock noise) are part of the engine.
- `first_order`: exact exponential solution of `dq/dt = (q∞ − q)/τ` with configurations for RC charging, first-order kinetics and radioactive decay, plus tangent and half-life helpers.
- Every simulation declares its assumptions, validity domain, numerical method, ignored effects and a textual alternative; the view offers step-by-step control and tables for reduced motion.

## Consequences

- One YAML configuration per phenomenon; the same engines serve six simulations in the vertical slice.
- Numerical results are tested against the analytic laws (`s = ½gt²`, `a = g·sin θ`, `e^(−t/τ)`).
