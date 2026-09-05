import type { Motion2dConfig } from '../../content-schema';
import { mulberry32 } from '../prng';

/**
 * `motion_2d` engine: a point mass in a uniform gravity field, with optional linear drag and an
 * inclined-plane constraint. Deterministic fixed-step RK4 integration. Units: SI.
 *
 * Scenes:
 *  - inclined_plane: 1-D motion along the plane, s = distance from the top; a = g sinθ (or 5/7 g sinθ
 *    for a rolling solid sphere) − (k/m) v; stops at the end of the plane.
 *  - free_fall: vertical motion from initialHeight, y measured upwards from the ground; stops at y = 0.
 *  - projectile: 2-D motion with an initial speed and launch angle; stops at y = 0.
 */
export interface Motion2dState {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Distance travelled along the plane (inclined_plane) or path length. */
  s: number;
  v: number;
  a: number;
  finished: boolean;
}

export interface Motion2dObservables {
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
}

const DEG = Math.PI / 180;

export function effectiveAcceleration(config: Motion2dConfig): number {
  if (config.scene === 'inclined_plane') {
    const factor = config.rolling ? 5 / 7 : 1;
    return factor * config.g * Math.sin(config.angle * DEG);
  }
  return config.g;
}

export function initialState(config: Motion2dConfig): Motion2dState {
  if (config.scene === 'inclined_plane') {
    return {
      t: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      s: 0,
      v: 0,
      a: effectiveAcceleration(config),
      finished: false,
    };
  }
  if (config.scene === 'projectile') {
    const v0 = config.initialSpeed;
    const angle = config.launchAngle * DEG;
    return {
      t: 0,
      x: 0,
      y: config.initialHeight,
      vx: v0 * Math.cos(angle),
      vy: v0 * Math.sin(angle),
      s: 0,
      v: v0,
      a: config.g,
      finished: false,
    };
  }
  return {
    t: 0,
    x: 0,
    y: config.initialHeight,
    vx: 0,
    vy: -config.initialSpeed,
    s: 0,
    v: config.initialSpeed,
    a: config.g,
    finished: false,
  };
}

/** Right-hand side of the ODE system. Returns derivatives of (x, y, vx, vy, s). */
function derivative(
  config: Motion2dConfig,
  state: { vx: number; vy: number }
): { dx: number; dy: number; dvx: number; dvy: number; ds: number } {
  const k = config.linearDrag / config.mass;
  if (config.scene === 'inclined_plane') {
    // Along-plane motion stored in vx (speed along the plane), vy unused.
    const a = effectiveAcceleration(config) - k * state.vx;
    return { dx: state.vx, dy: 0, dvx: a, dvy: 0, ds: state.vx };
  }
  const speed = Math.hypot(state.vx, state.vy);
  return {
    dx: state.vx,
    dy: state.vy,
    dvx: -k * state.vx,
    dvy: -config.g - k * state.vy,
    ds: speed,
  };
}

/** One RK4 step of duration dt. */
export function step(config: Motion2dConfig, state: Motion2dState, dt: number): Motion2dState {
  if (state.finished) return state;
  const k1 = derivative(config, state);
  const s2 = { vx: state.vx + (dt / 2) * k1.dvx, vy: state.vy + (dt / 2) * k1.dvy };
  const k2 = derivative(config, s2);
  const s3 = { vx: state.vx + (dt / 2) * k2.dvx, vy: state.vy + (dt / 2) * k2.dvy };
  const k3 = derivative(config, s3);
  const s4 = { vx: state.vx + dt * k3.dvx, vy: state.vy + dt * k3.dvy };
  const k4 = derivative(config, s4);
  const mix = (a: number, b: number, c: number, d: number) => (dt / 6) * (a + 2 * b + 2 * c + d);
  const next: Motion2dState = {
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
  if (config.scene === 'inclined_plane') {
    next.v = next.vx;
    next.a = k1.dvx;
    if (next.s >= config.length) {
      // Interpolate the exact end-of-plane instant.
      const overshoot = next.s - config.length;
      const frac = next.v > 0 ? overshoot / Math.max(1e-9, next.v * dt) : 0;
      next.t -= frac * dt;
      next.s = config.length;
      next.x = config.length;
      next.finished = true;
    }
  } else {
    next.v = Math.hypot(next.vx, next.vy);
    next.a = Math.hypot(k1.dvx, k1.dvy);
    if (next.y <= 0) {
      const frac = state.y / Math.max(1e-9, state.y - next.y);
      next.t = state.t + frac * dt;
      next.x = state.x + frac * (next.x - state.x);
      next.y = 0;
      next.finished = true;
    }
  }
  return next;
}

/** Advances the simulation to time `t` from the initial state (deterministic, fixed dt). */
export function stateAt(config: Motion2dConfig, t: number): Motion2dState {
  let state = initialState(config);
  const dt = config.dt;
  while (state.t < t - 1e-12 && !state.finished) {
    const h = Math.min(dt, t - state.t);
    state = step(config, state, h);
  }
  return state;
}

export function observe(config: Motion2dConfig, state: Motion2dState): Motion2dObservables {
  const m = config.mass;
  const kinetic = 0.5 * m * state.v * state.v;
  let potential: number;
  if (config.scene === 'inclined_plane') {
    const height = (config.length - state.s) * Math.sin(config.angle * DEG);
    potential = m * config.g * height;
  } else {
    potential = m * config.g * state.y;
  }
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
  };
}

/** Closed-form solution without drag (used by tests and to display "exact vs numeric"). */
export function analytic(config: Motion2dConfig, t: number): { s: number; v: number } | null {
  if (config.linearDrag > 0) return null;
  const a = effectiveAcceleration(config);
  if (config.scene === 'inclined_plane') {
    const s = Math.min(config.length, 0.5 * a * t * t);
    return { s, v: Math.sqrt(2 * a * s) };
  }
  if (config.scene === 'free_fall') {
    const fallen = Math.min(config.initialHeight, config.initialSpeed * t + 0.5 * config.g * t * t);
    return { s: fallen, v: Math.sqrt(config.initialSpeed ** 2 + 2 * config.g * fallen) };
  }
  return null;
}

/** Total duration of the motion (until the end of the plane or the ground). */
export function duration(config: Motion2dConfig): number {
  let state = initialState(config);
  const limit = 120;
  while (!state.finished && state.t < limit) state = step(config, state, config.dt * 10);
  return state.t;
}

/** Water-clock reading: the measured time carries optional seeded relative noise. */
export function clockReading(
  config: Motion2dConfig,
  seed: number,
  index: number,
  trueTime: number
): number {
  if (config.clockNoise <= 0) return trueTime;
  const rng = mulberry32(seed + index * 7919);
  const u = rng() + rng() + rng() - 1.5; // roughly normal, sd ≈ 0.5
  return trueTime * (1 + config.clockNoise * u);
}

/** Along-plane distance reached at a clock mark (in seconds), for the odd-number law. */
export function distanceAtClockMark(config: Motion2dConfig, mark: number): number {
  return stateAt(config, mark).s;
}
