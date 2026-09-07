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
  return Math.max(FOCUS_DISTANCE.universe, fitDistance(radius, verticalFovDeg, aspect));
}

/**
 * Camera distance at which a sphere of the given radius fits inside the frustum, whatever the
 * canvas aspect; never beyond the orbit limit. Used to frame a group of destinations (a leg of
 * the bird's-eye flight): never closer than a region view, so a tight group is not shown from
 * up close.
 */
export function groupDistance(radius: number, verticalFovDeg: number, aspect: number): number {
  return Math.max(FOCUS_DISTANCE.region, fitDistance(radius, verticalFovDeg, aspect));
}

function fitDistance(radius: number, verticalFovDeg: number, aspect: number): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const vertical = (Math.max(1, Math.min(179, verticalFovDeg)) / 2) * (Math.PI / 180);
  const horizontal = Math.atan(Math.tan(vertical) * safeAspect);
  const half = Math.min(vertical, horizontal);
  const fit = Math.max(0, radius) / Math.sin(half);
  return Math.min(MAX_CAMERA_DISTANCE, fit);
}

/**
 * Semantic zoom of the 2D map: the scale of the view decides what is named, as the camera
 * distance does in the 3D atlas, so both views follow the same budget.
 */
export function zoomLevelFor2d(scale: number): ZoomLevel {
  if (scale < 1.2) return 'universe';
  if (scale < 2) return 'world';
  if (scale < 3.5) return 'region';
  return 'concept';
}

/** Label budget per zoom level (labels beyond the budget are hidden, lowest priority first). */
export const LABEL_BUDGET: Record<ZoomLevel, number> = {
  universe: 11,
  world: 18,
  region: 26,
  concept: 32,
};
