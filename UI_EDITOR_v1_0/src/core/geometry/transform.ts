import type { Rect } from "../schema/primitives";
import type { Constraints, AnchorKind } from "../schema/anchor";

export type HandleId = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export const DEFAULT_MIN_SIZE = { w: 8, h: 8 } as const;

export function applyMove(
  rect: Rect,
  delta: { dx: number; dy: number },
  parentRect: Rect | null,
  _constraints: Constraints | null,
): Rect {
  let next: Rect = { x: rect.x + delta.dx, y: rect.y + delta.dy, w: rect.w, h: rect.h };
  if (parentRect) next = clampToParent(next, parentRect);
  return next;
}

export function applyResize(
  rect: Rect,
  handle: HandleId,
  delta: { dx: number; dy: number },
  parentRect: Rect | null,
  _constraints: Constraints | null,
  minSize: { w: number; h: number } = DEFAULT_MIN_SIZE,
  aspectLock = false,
): Rect {
  let { x, y, w, h } = rect;
  switch (handle) {
    case "n":
      y += delta.dy;
      h -= delta.dy;
      break;
    case "s":
      h += delta.dy;
      break;
    case "e":
      w += delta.dx;
      break;
    case "w":
      x += delta.dx;
      w -= delta.dx;
      break;
    case "ne":
      y += delta.dy;
      h -= delta.dy;
      w += delta.dx;
      break;
    case "nw":
      x += delta.dx;
      w -= delta.dx;
      y += delta.dy;
      h -= delta.dy;
      break;
    case "se":
      w += delta.dx;
      h += delta.dy;
      break;
    case "sw":
      x += delta.dx;
      w -= delta.dx;
      h += delta.dy;
      break;
  }
  if (aspectLock && isCornerHandle(handle)) {
    const aspect = rect.w / Math.max(rect.h, 1);
    const newAspect = w / Math.max(h, 1);
    if (Math.abs(newAspect - aspect) > 0.001) {
      // pick the smaller change to preserve ratio
      if (Math.abs(w - rect.w) >= Math.abs(h - rect.h)) {
        const newH = w / aspect;
        if (handle === "nw" || handle === "ne") y += h - newH;
        h = newH;
      } else {
        const newW = h * aspect;
        if (handle === "nw" || handle === "sw") x += w - newW;
        w = newW;
      }
    }
  }
  if (w < minSize.w) {
    if (handle === "w" || handle === "nw" || handle === "sw") x -= minSize.w - w;
    w = minSize.w;
  }
  if (h < minSize.h) {
    if (handle === "n" || handle === "ne" || handle === "nw") y -= minSize.h - h;
    h = minSize.h;
  }
  let next: Rect = { x, y, w, h };
  if (parentRect) next = clampToParent(next, parentRect);
  return next;
}

function clampToParent(r: Rect, parent: Rect): Rect {
  const w = Math.min(r.w, parent.w);
  const h = Math.min(r.h, parent.h);
  const x = Math.max(0, Math.min(r.x, parent.w - w));
  const y = Math.max(0, Math.min(r.y, parent.h - h));
  return { x, y, w, h };
}

function isCornerHandle(h: HandleId): boolean {
  return h === "nw" || h === "ne" || h === "sw" || h === "se";
}

export function applyParentResizeToChild(
  childRect: Rect,
  oldParent: { w: number; h: number },
  newParent: { w: number; h: number },
  constraints: Constraints,
): Rect {
  const x = transformPos(childRect.x, oldParent.w, newParent.w, constraints.horizontal);
  const y = transformPos(childRect.y, oldParent.h, newParent.h, constraints.vertical);
  const w = transformSize(childRect.x, childRect.w, oldParent.w, newParent.w, constraints.horizontal);
  const h = transformSize(childRect.y, childRect.h, oldParent.h, newParent.h, constraints.vertical);
  return { x, y, w, h };
}

function transformPos(pos: number, oldP: number, newP: number, kind: AnchorKind): number {
  switch (kind) {
    case "left":
      return pos;
    case "right":
      return pos + (newP - oldP);
    case "centre":
      return pos + (newP - oldP) / 2;
    case "scale":
      return pos * (newP / Math.max(oldP, 1));
    case "stretch":
      return pos;
  }
}

function transformSize(pos: number, size: number, oldP: number, newP: number, kind: AnchorKind): number {
  switch (kind) {
    case "left":
    case "right":
    case "centre":
      return size;
    case "scale":
      return size * (newP / Math.max(oldP, 1));
    case "stretch": {
      const trailing = oldP - (pos + size);
      return newP - pos - trailing;
    }
  }
}
