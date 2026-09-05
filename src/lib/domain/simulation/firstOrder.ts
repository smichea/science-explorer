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
  /** Quantity still to change: target − q. */
  remaining: number;
  finished: boolean;
}

export function initialState(config: FirstOrderConfig): FirstOrderState {
  return { t: 0, q: config.initial };
}

export function valueAt(config: FirstOrderConfig, t: number): number {
  return config.target + (config.initial - config.target) * Math.exp(-t / config.tau);
}

export function rateAt(config: FirstOrderConfig, t: number): number {
  return (config.target - valueAt(config, t)) / config.tau;
}

export function step(
  config: FirstOrderConfig,
  state: FirstOrderState,
  dt: number
): FirstOrderState {
  const q = config.target + (state.q - config.target) * Math.exp(-dt / config.tau);
  return { t: state.t + dt, q };
}

export function stateAt(config: FirstOrderConfig, t: number): FirstOrderState {
  return { t, q: valueAt(config, t) };
}

export function observe(config: FirstOrderConfig, state: FirstOrderState): FirstOrderObservables {
  return {
    t: state.t,
    q: state.q,
    rate: (config.target - state.q) / config.tau,
    remaining: config.target - state.q,
    finished: state.t >= config.duration,
  };
}

export function halfLife(config: FirstOrderConfig): number {
  return config.tau * Math.LN2;
}

/** Tangent line at t0: q(t) ≈ q(t0) + rate(t0) (t − t0). */
export function tangentAt(config: FirstOrderConfig, t0: number): { q0: number; slope: number } {
  return { q0: valueAt(config, t0), slope: rateAt(config, t0) };
}
