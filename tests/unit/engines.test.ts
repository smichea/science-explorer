import { describe, expect, it } from 'vitest';
import { FirstOrderConfigSchema, Motion2dConfigSchema } from '../../src/lib/content-schema';
import * as fo from '../../src/lib/domain/simulation/firstOrder';
import * as m2 from '../../src/lib/domain/simulation/motion2d';
import { loadPackage } from './helpers';

const { simulations } = loadPackage();

describe('motion_2d', () => {
  it('reproduces free fall from 10 m (lands at t ≈ 1.428 s with v ≈ 14 m/s)', () => {
    const config = Motion2dConfigSchema.parse({ scene: 'free_fall', initialHeight: 10 });
    const t = m2.duration(config);
    expect(t).toBeCloseTo(Math.sqrt((2 * 10) / 9.81), 3);
    const s = m2.stateAt(config, 1);
    expect(10 - s.y).toBeCloseTo(0.5 * 9.81, 4);
    expect(s.v).toBeCloseTo(9.81, 4);
    const end = m2.stateAt(config, 5);
    expect(end.finished).toBe(true);
    expect(end.v).toBeCloseTo(Math.sqrt(2 * 9.81 * 10), 2);
  });

  it('accelerates along an incline at g sinθ, or 5/7 of it for a rolling sphere', () => {
    const sliding = Motion2dConfigSchema.parse({
      scene: 'inclined_plane',
      angle: 30,
      length: 50,
      rolling: false,
    });
    expect(m2.effectiveAcceleration(sliding)).toBeCloseTo(4.905, 3);
    expect(m2.stateAt(sliding, 2).v).toBeCloseTo(9.81, 3);
    const rolling = Motion2dConfigSchema.parse({
      scene: 'inclined_plane',
      angle: 10,
      length: 7,
      rolling: true,
    });
    expect(m2.effectiveAcceleration(rolling)).toBeCloseTo(
      (5 / 7) * 9.81 * Math.sin((10 * Math.PI) / 180),
      6
    );
    const d1 = m2.distanceAtClockMark(rolling, 1);
    const d2 = m2.distanceAtClockMark(rolling, 2);
    const d3 = m2.distanceAtClockMark(rolling, 3);
    expect(d2 / d1).toBeCloseTo(4, 4);
    expect(d3 / d1).toBeCloseTo(9, 4);
    expect(d1).toBeCloseTo(0.608, 2);
    expect(m2.stateAt(rolling, 10).finished).toBe(true);
    expect(m2.stateAt(rolling, 10).s).toBeCloseTo(7, 6);
  });

  it('matches the analytic solution and conserves energy without drag', () => {
    const config = Motion2dConfigSchema.parse({
      scene: 'inclined_plane',
      angle: 20,
      length: 30,
      rolling: false,
    });
    for (const t of [0.5, 1, 1.5]) {
      const numeric = m2.stateAt(config, t);
      const exact = m2.analytic(config, t)!;
      expect(numeric.s).toBeCloseTo(exact.s, 6);
      expect(numeric.v).toBeCloseTo(exact.v, 6);
    }
    const e0 = m2.observe(config, m2.initialState(config)).total;
    const e1 = m2.observe(config, m2.stateAt(config, 1.5)).total;
    expect(Math.abs(e1 - e0) / e0).toBeLessThan(1e-4);
  });

  it('reaches a terminal velocity mg/k with linear drag', () => {
    const config = Motion2dConfigSchema.parse({
      scene: 'free_fall',
      initialHeight: 5000,
      linearDrag: 1,
      mass: 1,
    });
    const late = m2.stateAt(config, 30);
    expect(late.v).toBeCloseTo(9.81, 1);
    expect(m2.analytic(config, 1)).toBeNull();
  });

  it('is deterministic, including the seeded clock noise', () => {
    const config = Motion2dConfigSchema.parse({ scene: 'inclined_plane', clockNoise: 0.05 });
    expect(m2.clockReading(config, 1604, 2, 2)).toBe(m2.clockReading(config, 1604, 2, 2));
    expect(m2.clockReading(config, 1604, 2, 2)).not.toBe(m2.clockReading(config, 7, 2, 2));
    expect(m2.clockReading({ ...config, clockNoise: 0 }, 1604, 2, 2)).toBe(2);
  });
});

describe('first_order', () => {
  it('follows the exact exponential and its rate stays proportional to the remaining quantity', () => {
    const rc = FirstOrderConfigSchema.parse({
      scene: 'rc_charging',
      target: 6,
      initial: 0,
      tau: 2,
      duration: 12,
    });
    expect(fo.valueAt(rc, 0)).toBe(0);
    expect(fo.valueAt(rc, 2)).toBeCloseTo(6 * (1 - Math.exp(-1)), 8);
    expect(fo.rateAt(rc, 0)).toBeCloseTo(3, 8);
    for (const t of [0, 1, 3])
      expect(fo.rateAt(rc, t)).toBeCloseTo(fo.observe(rc, fo.stateAt(rc, t)).remaining / rc.tau, 8);
    let state = fo.initialState(rc);
    for (let i = 0; i < 2000; i++) state = fo.step(rc, state, 0.001);
    expect(state.q).toBeCloseTo(fo.valueAt(rc, 2), 6);
  });

  it('computes half-lives and kinetics rates', () => {
    const kin = FirstOrderConfigSchema.parse({
      scene: 'first_order_kinetics',
      target: 0,
      initial: 0.5,
      tau: 10,
      duration: 40,
    });
    expect(fo.halfLife(kin)).toBeCloseTo(10 * Math.LN2, 8);
    expect(-fo.rateAt(kin, 0)).toBeCloseTo(0.05, 8);
    expect(fo.valueAt(kin, fo.halfLife(kin))).toBeCloseTo(0.25, 8);
  });

  it('accepts every authored simulation configuration', () => {
    for (const sim of simulations) {
      if (sim.engine === 'motion_2d') {
        const config = Motion2dConfigSchema.parse(sim.config);
        expect(m2.duration(config)).toBeGreaterThan(0);
      } else {
        const config = FirstOrderConfigSchema.parse(sim.config);
        expect(fo.valueAt(config, config.duration)).toBeDefined();
      }
    }
  });
});
