import type { Rect } from "../schema/primitives";

export type AlignMode = "left" | "right" | "top" | "bottom" | "centre-h" | "centre-v";

export interface AlignTarget {
  bounds: Rect;
}

export function alignRects(
  rects: ReadonlyArray<Rect>,
  mode: AlignMode,
  target: AlignTarget,
): Rect[] {
  return rects.map((r) => alignOne(r, mode, target.bounds));
}

function alignOne(r: Rect, mode: AlignMode, t: Rect): Rect {
  switch (mode) {
    case "left":
      return { ...r, x: t.x };
    case "right":
      return { ...r, x: t.x + t.w - r.w };
    case "top":
      return { ...r, y: t.y };
    case "bottom":
      return { ...r, y: t.y + t.h - r.h };
    case "centre-h":
      return { ...r, x: t.x + (t.w - r.w) / 2 };
    case "centre-v":
      return { ...r, y: t.y + (t.h - r.h) / 2 };
  }
}

export function distributeRects(rects: ReadonlyArray<Rect>, axis: "x" | "y"): Rect[] {
  if (rects.length < 3) return rects.slice();
  const indexed = rects.map((r, i) => ({ r, i }));
  indexed.sort((a, b) => (axis === "x" ? a.r.x - b.r.x : a.r.y - b.r.y));
  const first = indexed[0]!.r;
  const last = indexed[indexed.length - 1]!.r;
  const startCentre = axis === "x" ? first.x + first.w / 2 : first.y + first.h / 2;
  const endCentre = axis === "x" ? last.x + last.w / 2 : last.y + last.h / 2;
  const step = (endCentre - startCentre) / (indexed.length - 1);
  const out: Rect[] = new Array(rects.length);
  out[indexed[0]!.i] = indexed[0]!.r;
  out[indexed[indexed.length - 1]!.i] = indexed[indexed.length - 1]!.r;
  for (let k = 1; k < indexed.length - 1; k++) {
    const entry = indexed[k]!;
    const targetCentre = startCentre + step * k;
    const r = entry.r;
    if (axis === "x") {
      out[entry.i] = { ...r, x: targetCentre - r.w / 2 };
    } else {
      out[entry.i] = { ...r, y: targetCentre - r.h / 2 };
    }
  }
  return out;
}
