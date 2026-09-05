import { describe, expect, it } from 'vitest';
import {
  FOCUS_DISTANCE,
  MAX_CAMERA_DISTANCE,
  overviewDistance,
  zoomLevelForDistance,
} from '../../src/lib/atlas/zoom';

describe('overviewDistance', () => {
  it('never comes closer than the authored universe distance on wide canvases', () => {
    expect(overviewDistance(60, 50, 16 / 9)).toBe(FOCUS_DISTANCE.universe);
    expect(overviewDistance(10, 50, 1.2)).toBe(FOCUS_DISTANCE.universe);
  });

  it('moves further away on portrait canvases so the whole universe still fits', () => {
    const wide = overviewDistance(60, 50, 1.6);
    const portrait = overviewDistance(60, 50, 0.56);
    expect(portrait).toBeGreaterThan(wide);
    // A sphere of radius r fits when r / sin(half-angle) ≤ distance.
    const horizontalHalf = Math.atan(Math.tan((25 * Math.PI) / 180) * 0.56);
    expect(portrait).toBeCloseTo(60 / Math.sin(horizontalHalf), 6);
  });

  it('grows with the radius and is capped by the orbit limit', () => {
    expect(overviewDistance(60, 50, 0.5)).toBeGreaterThan(overviewDistance(45, 50, 0.5));
    expect(overviewDistance(10_000, 50, 1)).toBe(MAX_CAMERA_DISTANCE);
    expect(zoomLevelForDistance(overviewDistance(60, 50, 0.5))).toBe('universe');
  });

  it('tolerates degenerate inputs (zero-height canvas, absurd fov)', () => {
    expect(overviewDistance(60, 50, NaN)).toBe(overviewDistance(60, 50, 1));
    expect(overviewDistance(60, 50, 0)).toBe(overviewDistance(60, 50, 1));
    expect(Number.isFinite(overviewDistance(60, 0, 1))).toBe(true);
    expect(Number.isFinite(overviewDistance(60, 400, 1))).toBe(true);
  });
});
