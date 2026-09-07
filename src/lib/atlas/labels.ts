/**
 * Label decluttering for the 2D map: the names of the destinations, regions and worlds are ranked,
 * capped by a budget and dropped when their box would cover one already placed. Pure functions, so
 * the rule is tested without a browser. The 3D atlas has its own equivalent inside the scene.
 */

export type LabelKind = 'node' | 'region' | 'world' | 'hub';

export interface LabelCandidate {
  id: string;
  kind: LabelKind;
  /** Anchor of the text in map units. */
  x: number;
  y: number;
  text: string;
  /** Rank inside its kind: the label priority of a destination, the importance of a region. */
  priority: number;
  /** Font size in map units, which gives the height and the width of the box. */
  fontSize: number;
  /** `start`: the text runs to the right of the anchor; `middle`: it is centred on it. */
  anchor: 'start' | 'middle';
  /** Always written, whatever the budget and the overlaps: a world, the selection, the hover. */
  pinned?: boolean;
}

export interface LabelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface PlaceOptions {
  /** Largest number of labels written at once. */
  budget: number;
  /** The visible rectangle in map units: a label anchored outside it is not a candidate. */
  view: { x: number; y: number; width: number; height: number };
  /** Labels already written by an earlier pass: their place is taken, they are not returned. */
  occupied?: LabelCandidate[];
}

/** Labels of a world are written first, then the hub, then the regions, then the destinations. */
const KIND_WEIGHT: Record<LabelKind, number> = { world: 1000, hub: 700, region: 60, node: 1 };
/** Average advance of a glyph of the interface font, as a fraction of the font size. */
const GLYPH_ADVANCE = 0.52;
/** Space kept around a label so two neighbours never touch. */
const PADDING = 0.35;

/** The rectangle a label covers, baseline at `y`. */
export function labelBox(candidate: LabelCandidate): LabelBox {
  const width = candidate.text.length * candidate.fontSize * GLYPH_ADVANCE;
  const x0 = candidate.anchor === 'middle' ? candidate.x - width / 2 : candidate.x;
  return {
    x0: x0 - PADDING,
    y0: candidate.y - candidate.fontSize * 0.85 - PADDING,
    x1: x0 + width + PADDING,
    y1: candidate.y + candidate.fontSize * 0.3 + PADDING,
  };
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/**
 * A label is a candidate when it fits inside the view: the whole of it, so a name is never cut by
 * the edge of the map — except a pinned one, which is written as soon as its anchor is in sight.
 */
function inView(candidate: LabelCandidate, view: PlaceOptions['view']): boolean {
  const anchored =
    candidate.x >= view.x &&
    candidate.x <= view.x + view.width &&
    candidate.y >= view.y &&
    candidate.y <= view.y + view.height;
  if (!anchored || candidate.pinned) return anchored;
  const box = labelBox(candidate);
  return (
    box.x0 >= view.x &&
    box.x1 <= view.x + view.width &&
    box.y0 >= view.y &&
    box.y1 <= view.y + view.height
  );
}

/**
 * The labels to write, most important first: pinned ones always, then the best ranked until the
 * budget is spent, each kept only when its box is still free. Deterministic for a given view.
 */
export function placeLabels(
  candidates: LabelCandidate[],
  { budget, view, occupied = [] }: PlaceOptions
): LabelCandidate[] {
  const centreX = view.x + view.width / 2;
  const centreY = view.y + view.height / 2;
  const reach = Math.max(1, Math.hypot(view.width, view.height) / 2);
  const scored = candidates
    .filter((c) => c.text.length > 0 && inView(c, view))
    .map((candidate) => {
      const distance = Math.hypot(candidate.x - centreX, candidate.y - centreY);
      // Between two destinations of equal rank the one near the centre of the view is named;
      // the geography is not ranked by distance, so every world reads the same wherever it sits.
      const falloff = candidate.kind === 'node' ? 1 / (1 + distance / reach) : 1;
      return { candidate, score: KIND_WEIGHT[candidate.kind] * (1 + candidate.priority) * falloff };
    })
    .sort(
      (a, b) =>
        Number(b.candidate.pinned ?? false) - Number(a.candidate.pinned ?? false) ||
        b.score - a.score ||
        a.candidate.id.localeCompare(b.candidate.id)
    );

  const placed: LabelCandidate[] = [];
  const boxes: LabelBox[] = occupied.map(labelBox);
  for (const { candidate } of scored) {
    const box = labelBox(candidate);
    if (candidate.pinned) {
      placed.push(candidate);
      boxes.push(box);
      continue;
    }
    if (placed.length >= budget) continue;
    if (boxes.some((other) => overlaps(box, other))) continue;
    placed.push(candidate);
    boxes.push(box);
  }
  return placed;
}

/** Separators after which a title states its details rather than its name. */
const HEAD = [' : ', ': ', ' — ', ' – ', ' (', ', '];

/**
 * The name a title is known by, short enough to be written on the map: what comes before the
 * details ("Second degré : forme canonique, discriminant" → "Second degré"), cut on a word when
 * it is still too long. The whole title stays in the accessible name and in the destination card.
 */
export function shortLabel(title: string, max = 28): string {
  let text = title.trim();
  for (const separator of HEAD) {
    const at = text.indexOf(separator);
    if (at > 0) text = text.slice(0, at).trim();
  }
  if (text.length <= max) return text;
  // The ellipsis counts in the length asked for.
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
