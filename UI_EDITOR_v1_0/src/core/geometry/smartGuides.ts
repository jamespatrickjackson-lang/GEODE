import type { Rect } from "../schema/primitives";

export interface SmartGuide {
  axis: "x" | "y";
  position: number;
  start: number;
  end: number;
  sourceId: string;
  alignmentKind: "edge" | "centre";
}

export function computeSmartGuides(
  movingRect: Rect,
  movingId: string,
  candidateRects: ReadonlyArray<{ id: string; rect: Rect }>,
  toleranceFramePx: number,
): SmartGuide[] {
  const out: SmartGuide[] = [];
  const movingEdges = edges(movingRect);
  for (const { id, rect } of candidateRects) {
    if (id === movingId) continue;
    const partnerEdges = edges(rect);
    for (const [axis, list] of [
      ["x", ["left", "centreX", "right"] as const],
      ["y", ["top", "centreY", "bottom"] as const],
    ] as const) {
      for (const mKey of list) {
        for (const pKey of list) {
          const mVal = movingEdges[mKey];
          const pVal = partnerEdges[pKey];
          if (Math.abs(mVal - pVal) > toleranceFramePx) continue;
          const orth =
            axis === "x"
              ? [movingRect.y, movingRect.y + movingRect.h, rect.y, rect.y + rect.h]
              : [movingRect.x, movingRect.x + movingRect.w, rect.x, rect.x + rect.w];
          const start = Math.min(...orth);
          const end = Math.max(...orth);
          out.push({
            axis,
            position: pVal,
            start,
            end,
            sourceId: id,
            alignmentKind: mKey === "centreX" || mKey === "centreY" ? "centre" : "edge",
          });
        }
      }
    }
  }
  return out;
}

function edges(r: Rect) {
  return {
    left: r.x,
    right: r.x + r.w,
    centreX: r.x + r.w / 2,
    top: r.y,
    bottom: r.y + r.h,
    centreY: r.y + r.h / 2,
  };
}
