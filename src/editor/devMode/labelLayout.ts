// Pure geometry for dev-mode container label placement (no DOM / no React).
// Container labels are first positioned beside their container, then packed so
// they never overlap (D4: "labels must not stack"). Kept dependency-free so the
// packing can be unit-tested directly.

export interface LabelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface LabelViewport {
  width: number;
  height: number;
}

export interface PackOptions {
  gap?: number;
  margin?: number;
}

function rectsOverlap(a: LabelRect, b: LabelRect, gap: number): boolean {
  return (
    a.left < b.left + b.width + gap &&
    a.left + a.width + gap > b.left &&
    a.top < b.top + b.height + gap &&
    a.top + a.height + gap > b.top
  );
}

/**
 * De-overlaps label rects. Labels are processed top-first; each one is nudged
 * downward until it clears every already-placed label, wrapping into a column to
 * the left when it runs out of vertical room. Returns a same-length, same-order
 * array of resolved rects (input order preserved for stable mapping back).
 */
export function packLabelRects(
  rects: LabelRect[],
  viewport: LabelViewport,
  options: PackOptions = {},
): LabelRect[] {
  const gap = options.gap ?? 4;
  const margin = options.margin ?? 4;
  const order = rects
    .map((_, index) => index)
    .sort((a, b) => rects[a].top - rects[b].top || a - b);

  const placed: LabelRect[] = [];
  const result = new Array<LabelRect>(rects.length);

  for (const index of order) {
    const base = rects[index];
    const { width, height } = base;
    let left = base.left;
    let top = base.top;
    const step = height + gap;
    let guard = 0;

    while (
      placed.some((other) => rectsOverlap({ left, top, width, height }, other, gap)) &&
      guard < 5000
    ) {
      top += step;
      if (top + height > viewport.height - margin) {
        // out of vertical room: wrap into a column to the left.
        const nextLeft = left - (width + gap);
        if (nextLeft < margin) {
          // no room left either; clamp and accept this position.
          left = Math.max(margin, left);
          top = Math.max(margin, viewport.height - margin - height);
          break;
        }
        left = nextLeft;
        top = margin;
      }
      guard += 1;
    }

    const resolved: LabelRect = { left, top, width, height };
    placed.push(resolved);
    result[index] = resolved;
  }

  return result;
}
