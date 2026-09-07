import { describe, expect, it } from 'vitest';
import { labelBox, placeLabels, shortLabel, type LabelCandidate } from '../../src/lib/atlas/labels';

const view = { x: 0, y: 0, width: 100, height: 100 };

function node(id: string, x: number, y: number, extra: Partial<LabelCandidate> = {}) {
  return {
    id,
    kind: 'node' as const,
    x,
    y,
    text: id,
    priority: 1,
    fontSize: 1.7,
    anchor: 'start' as const,
    ...extra,
  };
}

describe('map labels', () => {
  it('keeps the name of a destination, not the details of its title', () => {
    expect(shortLabel('Second degré : forme canonique, discriminant, racines, signe')).toBe(
      'Second degré'
    );
    expect(shortLabel('Cercle trigonométrique, radian, cosinus et sinus')).toBe(
      'Cercle trigonométrique'
    );
    expect(shortLabel('Lumière : onde et photon, niveaux d’énergie')).toBe('Lumière');
    expect(shortLabel('Dérivée')).toBe('Dérivée');
    expect(shortLabel('Quadratics: canonical form, discriminant')).toBe('Quadratics');
  });

  it('cuts a long name on a word and marks the cut', () => {
    // No separator: the name is cut on the last word that fits.
    expect(shortLabel('Suites arithmétiques et géométriques')).toBe('Suites arithmétiques et…');
    expect(shortLabel('Transformation', 10)).toBe('Transform…');
    expect(shortLabel('Suites arithmétiques et géométriques').length).toBeLessThanOrEqual(28);
  });

  it('measures a label from its anchor, to the right or centred', () => {
    const start = labelBox(node('abc', 10, 10));
    expect(start.x0).toBeLessThan(10);
    expect(start.x1).toBeGreaterThan(10);
    const middle = labelBox(node('abc', 10, 10, { anchor: 'middle' }));
    expect(middle.x0).toBeLessThan(start.x0);
    expect(middle.x1).toBeLessThan(start.x1);
    // The box sits on the baseline: mostly above it.
    expect(start.y0).toBeLessThan(10);
    expect(start.y1).toBeGreaterThan(10);
  });

  it('drops a label that would cover one already written', () => {
    const first = node('alpha', 10, 10, { text: 'Une destination', priority: 3 });
    const over = node('beta', 11, 10, { text: 'Une autre', priority: 1 });
    const far = node('gamma', 60, 60, { text: 'Ailleurs', priority: 1 });
    const placed = placeLabels([first, over, far], { budget: 10, view });
    expect(placed.map((c) => c.id)).toEqual(['alpha', 'gamma']);
  });

  it('spends the budget on the best ranked, whatever the order given', () => {
    const candidates = [
      node('low', 10, 10, { priority: 0.5 }),
      node('high', 10, 40, { priority: 9 }),
      node('mid', 10, 70, { priority: 3 }),
    ];
    const placed = placeLabels(candidates, { budget: 2, view });
    expect(placed.map((c) => c.id)).toEqual(['high', 'mid']);
    expect(placeLabels([...candidates].reverse(), { budget: 2, view }).map((c) => c.id)).toEqual([
      'high',
      'mid',
    ]);
  });

  it('writes the pinned labels beyond the budget and through the overlaps', () => {
    const world = {
      ...node('world', 10, 10, { text: 'MATHÉMATIQUES', anchor: 'middle' as const }),
      kind: 'world' as const,
      pinned: true,
    };
    const hidden = node('under', 10, 10, { text: 'Une destination', priority: 9 });
    const selected = node('selected', 12, 10, { text: 'La sélection', pinned: true });
    const placed = placeLabels([hidden, world, selected], { budget: 0, view });
    expect(placed.map((c) => c.id).sort()).toEqual(['selected', 'world']);
  });

  it('prefers a label near the centre of the view and ignores what is outside it', () => {
    const centre = node('centre', 50, 50);
    const edge = node('edge', 2, 96);
    const outside = node('outside', 400, 400);
    const placed = placeLabels([edge, outside, centre], { budget: 3, view });
    expect(placed.map((c) => c.id)).toEqual(['centre', 'edge']);
  });

  it('never cuts a name on the edge of the map, unless it is pinned', () => {
    const edge = node('edge', 96, 50, { text: 'Un nom qui déborde' });
    expect(placeLabels([edge], { budget: 5, view })).toEqual([]);
    expect(placeLabels([{ ...edge, pinned: true }], { budget: 5, view }).map((c) => c.id)).toEqual([
      'edge',
    ]);
  });

  it('leaves the places of an earlier pass taken', () => {
    const first = node('alpha', 10, 10, { text: 'Une destination' });
    const over = node('beta', 11, 10, { text: 'Une autre' });
    expect(placeLabels([over], { budget: 5, view, occupied: [first] })).toEqual([]);
    expect(placeLabels([over], { budget: 5, view }).map((c) => c.id)).toEqual(['beta']);
  });

  it('ranks a world above a region, and a region above a destination', () => {
    const candidates: LabelCandidate[] = [
      node('node', 50, 20, { priority: 9 }),
      { ...node('region', 50, 50), kind: 'region', text: 'Une région' },
      { ...node('world', 50, 80), kind: 'world', text: 'UN MONDE' },
    ];
    expect(placeLabels(candidates, { budget: 3, view }).map((c) => c.id)).toEqual([
      'world',
      'region',
      'node',
    ]);
  });
});
