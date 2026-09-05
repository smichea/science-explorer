export type ZoomLevel = 'universe' | 'world' | 'region' | 'concept';

/** Semantic zoom: the camera distance to its target decides what is rendered and labelled. */
export function zoomLevelForDistance(distance: number): ZoomLevel {
  if (distance > 140) return 'universe';
  if (distance > 70) return 'world';
  if (distance > 30) return 'region';
  return 'concept';
}

export const FOCUS_DISTANCE = {
  universe: 178,
  world: 86,
  region: 38,
  node: 15,
  mission: 15,
} as const;

/** Farthest the camera may orbit or fly (OrbitControls maxDistance). */
export const MAX_CAMERA_DISTANCE = 320;

/**
 * Camera distance at which a sphere of the given radius fits inside the frustum, whatever the
 * canvas aspect: narrow canvases (a phone in portrait, a stage shrunk by the side panel) push the
 * overview further away so the whole universe stays visible. Never closer than the authored
 * universe distance, never beyond the orbit limit.
 */
export function overviewDistance(radius: number, verticalFovDeg: number, aspect: number): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const vertical = (Math.max(1, Math.min(179, verticalFovDeg)) / 2) * (Math.PI / 180);
  const horizontal = Math.atan(Math.tan(vertical) * safeAspect);
  const half = Math.min(vertical, horizontal);
  const fit = Math.max(0, radius) / Math.sin(half);
  return Math.min(MAX_CAMERA_DISTANCE, Math.max(FOCUS_DISTANCE.universe, fit));
}

/** Label budget per zoom level (labels beyond the budget are hidden, lowest priority first). */
export const LABEL_BUDGET: Record<ZoomLevel, number> = {
  universe: 11,
  world: 18,
  region: 26,
  concept: 32,
};
