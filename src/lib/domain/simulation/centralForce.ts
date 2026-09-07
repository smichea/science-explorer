import type { CentralForceConfig } from '../../content-schema';

/**
 * `central_force` engine: a body orbiting a fixed centre, with the acceleration −μ r⃗ / r³.
 * Deterministic fixed-step RK4 integration. Units: SI (metres, seconds, kilograms).
 *
 * The body starts at the distance `r0` from the centre with the speed `v0` perpendicular to the
 * radius: a circular orbit when v0 = √(μ/r0), an ellipse otherwise, an escape beyond √(2μ/r0).
 * Two observables carry Kepler's laws: the areal speed ½(x v_y − y v_x), constant along any
 * orbit (the second law), and the period, whose square over the cube of the semi-major axis is
 * the same 4π²/μ for every orbit around the same centre (the third).
 */
export interface CentralForceState {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Path length travelled along the orbit. */
  s: number;
  v: number;
  a: number;
  finished: boolean;
}

export interface CentralForceObservables {
  t: number;
  x: number;
  y: number;
  s: number;
  v: number;
  a: number;
  kinetic: number;
  potential: number;
  total: number;
  finished: boolean;
  /** Distance to the centre. */
  r: number;
  /** Areal speed ½(x v_y − y v_x): the rate at which the radius sweeps out area. */
  arealSpeed: number;
}

export function initialState(config: CentralForceConfig): CentralForceState {
  return {
    t: 0,
    x: config.r0,
    y: 0,
    vx: 0,
    vy: config.v0,
    s: 0,
    v: config.v0,
    a: config.mu / (config.r0 * config.r0),
    finished: false,
  };
}

/** Right-hand side of the system: the acceleration points at the centre, in 1/r². */
function derivative(
  config: CentralForceConfig,
  state: { x: number; y: number; vx: number; vy: number }
) {
  const r = Math.hypot(state.x, state.y);
  const pull = r > 0 ? -config.mu / (r * r * r) : 0;
  return {
    dx: state.vx,
    dy: state.vy,
    dvx: pull * state.x,
    dvy: pull * state.y,
    ds: Math.hypot(state.vx, state.vy),
  };
}

/** One RK4 step of duration dt. */
export function step(
  config: CentralForceConfig,
  state: CentralForceState,
  dt: number
): CentralForceState {
  if (state.finished) return state;
  const shift = (k: ReturnType<typeof derivative>, h: number) => ({
    x: state.x + h * k.dx,
    y: state.y + h * k.dy,
    vx: state.vx + h * k.dvx,
    vy: state.vy + h * k.dvy,
  });
  const k1 = derivative(config, state);
  const k2 = derivative(config, shift(k1, dt / 2));
  const k3 = derivative(config, shift(k2, dt / 2));
  const k4 = derivative(config, shift(k3, dt));
  const mix = (a: number, b: number, c: number, d: number) => (dt / 6) * (a + 2 * b + 2 * c + d);
  const next: CentralForceState = {
    t: state.t + dt,
    x: state.x + mix(k1.dx, k2.dx, k3.dx, k4.dx),
    y: state.y + mix(k1.dy, k2.dy, k3.dy, k4.dy),
    vx: state.vx + mix(k1.dvx, k2.dvx, k3.dvx, k4.dvx),
    vy: state.vy + mix(k1.dvy, k2.dvy, k3.dvy, k4.dvy),
    s: state.s + mix(k1.ds, k2.ds, k3.ds, k4.ds),
    v: 0,
    a: 0,
    finished: false,
  };
  const r = Math.hypot(next.x, next.y);
  next.v = Math.hypot(next.vx, next.vy);
  next.a = r > 0 ? config.mu / (r * r) : 0;
  // The orbit ends when the body reaches the surface of the central body, never at y = 0.
  next.finished = config.centralRadius > 0 && r <= config.centralRadius;
  return next;
}

/** Advances the simulation to time `t` from the initial state (deterministic, fixed dt). */
export function stateAt(config: CentralForceConfig, t: number): CentralForceState {
  let state = initialState(config);
  while (state.t < t - 1e-12 && !state.finished) {
    state = step(config, state, Math.min(config.dt, t - state.t));
  }
  return state;
}

export function observe(
  config: CentralForceConfig,
  state: CentralForceState
): CentralForceObservables {
  const r = Math.hypot(state.x, state.y);
  const kinetic = 0.5 * config.mass * state.v * state.v;
  // The potential of an inverse-square attraction is negative and vanishes at infinity: a bound
  // orbit therefore has a negative total energy, which is what makes it bound.
  const potential = r > 0 ? (-config.mu * config.mass) / r : -Infinity;
  return {
    t: state.t,
    x: state.x,
    y: state.y,
    s: state.s,
    v: state.v,
    a: state.a,
    kinetic,
    potential,
    total: kinetic + potential,
    finished: state.finished,
    r,
    arealSpeed: 0.5 * (state.x * state.vy - state.y * state.vx),
  };
}

export interface OrbitElements {
  /** Semi-major axis; infinite or negative when the body escapes. */
  semiMajorAxis: number;
  eccentricity: number;
  /** Orbital period, NaN when the orbit is not closed. */
  period: number;
  /** T² / a³ — the same for every closed orbit around the same centre (Kepler's third law). */
  keplerRatio: number;
  bound: boolean;
}

/**
 * The elements of the orbit, from the initial conditions alone: the energy gives the semi-major
 * axis (1/a = 2/r − v²/μ), the angular momentum the eccentricity.
 */
export function orbitElements(config: CentralForceConfig): OrbitElements {
  const { mu, r0, v0 } = config;
  const inverse = 2 / r0 - (v0 * v0) / mu;
  const bound = inverse > 0;
  const semiMajorAxis = bound ? 1 / inverse : Infinity;
  const angular = r0 * v0;
  const squared = 1 - (angular * angular) / (mu * semiMajorAxis);
  const eccentricity = bound ? Math.sqrt(Math.max(0, squared)) : NaN;
  const period = bound ? 2 * Math.PI * Math.sqrt(semiMajorAxis ** 3 / mu) : NaN;
  return {
    semiMajorAxis,
    eccentricity,
    period,
    keplerRatio: bound ? (period * period) / semiMajorAxis ** 3 : NaN,
    bound,
  };
}

/** Duration shown: two periods of a closed orbit, or the authored duration. */
export function duration(config: CentralForceConfig): number {
  const { period, bound } = orbitElements(config);
  return bound && Number.isFinite(period) ? Math.min(config.duration, 2 * period) : config.duration;
}

/** Speed of the circular orbit of radius r: √(μ/r), the one that closes on itself at once. */
export function circularSpeed(mu: number, r: number): number {
  return Math.sqrt(mu / r);
}
