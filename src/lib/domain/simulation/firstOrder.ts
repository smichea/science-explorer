import type { FirstOrderConfig } from '../../content-schema';

/**
 * `first_order` engine: dq/dt = (target − q) / tau. Exact exponential stepping, so the numerical
 * state is the analytic solution at every instant (no integration error).
 *
 *  - rc_charging: q(t) = Q (1 − e^{−t/τ}), target = Q, initial = 0
 *  - first_order_kinetics: [A](t) = [A]₀ e^{−kt}, target = 0, tau = 1/k
 *  - radioactive_decay: N(t) = N₀ e^{−λt}, tau = 1/λ
 *  - newton_cooling: T(t) = T_ext + (T₀ − T_ext) e^{−t/τ}
 */
export interface FirstOrderState {
  t: number;
  q: number;
}

export interface FirstOrderObservables {
  t: number;
  q: number;
  /** dq/dt at t. */
  rate: number;
  /** Quantity still to change: the asymptote minus q. */
  remaining: number;
  finished: boolean;
  /** Energy received since the start, C (q − q₀), when a heat capacity is given. */
  energy: number;
  /** Net power crossing the boundary, C dq/dt: positive while the body warms up. */
  flux: number;
}

/**
 * A body that exchanges heat is still first order: C dθ/dt = P − hS (θ − θ_ext) is
 * dθ/dt = (θ∞ − θ)/τ with τ = C/hS and θ∞ = θ_ext + P/hS. The three fields make that balance
 * visible in the content instead of baking it into a time constant and an asymptote.
 */
export function timeConstant(config: FirstOrderConfig): number {
  return config.capacity !== undefined && config.exchange !== undefined
    ? config.capacity / config.exchange
    : config.tau;
}

/** The value the quantity tends to: the target, raised by P/hS when a power is supplied. */
export function asymptote(config: FirstOrderConfig): number {
  return config.exchange !== undefined && config.power > 0
    ? config.target + config.power / config.exchange
    : config.target;
}

export function initialState(config: FirstOrderConfig): FirstOrderState {
  return { t: 0, q: config.initial };
}

export function valueAt(config: FirstOrderConfig, t: number): number {
  const limit = asymptote(config);
  return limit + (config.initial - limit) * Math.exp(-t / timeConstant(config));
}

export function rateAt(config: FirstOrderConfig, t: number): number {
  return (asymptote(config) - valueAt(config, t)) / timeConstant(config);
}

export function step(
  config: FirstOrderConfig,
  state: FirstOrderState,
  dt: number
): FirstOrderState {
  const limit = asymptote(config);
  const q = limit + (state.q - limit) * Math.exp(-dt / timeConstant(config));
  return { t: state.t + dt, q };
}

export function stateAt(config: FirstOrderConfig, t: number): FirstOrderState {
  return { t, q: valueAt(config, t) };
}

export function observe(config: FirstOrderConfig, state: FirstOrderState): FirstOrderObservables {
  const limit = asymptote(config);
  const rate = (limit - state.q) / timeConstant(config);
  return {
    t: state.t,
    q: state.q,
    rate,
    remaining: limit - state.q,
    finished: state.t >= config.duration,
    energy: config.capacity !== undefined ? config.capacity * (state.q - config.initial) : 0,
    flux: config.capacity !== undefined ? config.capacity * rate : 0,
  };
}

export function halfLife(config: FirstOrderConfig): number {
  return timeConstant(config) * Math.LN2;
}

/** Tangent line at t0: q(t) ≈ q(t0) + rate(t0) (t − t0). */
export function tangentAt(config: FirstOrderConfig, t0: number): { q0: number; slope: number } {
  return { q0: valueAt(config, t0), slope: rateAt(config, t0) };
}
