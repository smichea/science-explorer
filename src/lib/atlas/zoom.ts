export type ZoomLevel = 'universe' | 'world' | 'region' | 'concept';

/** Semantic zoom: the camera distance to its target decides what is rendered and labelled. */
export function zoomLevelForDistance(distance: number): ZoomLevel {
  if (distance > 140) return 'universe';
  if (distance > 70) return 'world';
  if (distance > 30) return 'region';
  return 'concept';
}

export const FOCUS_DISTANCE = { universe: 178, world: 86, region: 38, node: 15, mission: 15 } as const;

/** Label budget per zoom level (labels beyond the budget are hidden, lowest priority first). */
export const LABEL_BUDGET: Record<ZoomLevel, number> = { universe: 11, world: 18, region: 26, concept: 32 };
