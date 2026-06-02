import type { AnchorLine } from "../schema/anchor";

export type PixelGridSize = 1 | 2 | 4 | 8 | null;

export interface SnapResult {
  x: number;
  y: number;
  triggeredAnchors: readonly AnchorLine[];
}

export function snapPoint(
  desired: { x: number; y: number },
  anchors: readonly AnchorLine[],
  pixelGridSize: PixelGridSize,
  thresholdPx: number,
  zoom: number,
): SnapResult {
  const frameThreshold = thresholdPx / Math.max(zoom, 0.001);
  let bestX = desired.x;
  let bestY = desired.y;
  let bestXDist = Infinity;
  let bestYDist = Infinity;
  let triggeredX: AnchorLine | undefined;
  let triggeredY: AnchorLine | undefined;

  if (pixelGridSize) {
    const gx = Math.round(desired.x / pixelGridSize) * pixelGridSize;
    const gy = Math.round(desired.y / pixelGridSize) * pixelGridSize;
    const dx = Math.abs(gx - desired.x);
    const dy = Math.abs(gy - desired.y);
    if (dx <= frameThreshold) {
      bestX = gx;
      bestXDist = dx;
    }
    if (dy <= frameThreshold) {
      bestY = gy;
      bestYDist = dy;
    }
  }

  for (const anchor of anchors) {
    const d = Math.abs(anchor.position - (anchor.axis === "x" ? desired.x : desired.y));
    if (d > frameThreshold) continue;
    if (anchor.axis === "x") {
      const tieToGrid =
        triggeredX === undefined &&
        bestXDist !== Infinity &&
        Math.abs(d - bestXDist) < 1;
      if (d < bestXDist || tieToGrid) {
        bestX = anchor.position;
        bestXDist = d;
        triggeredX = anchor;
      }
    } else {
      const tieToGrid =
        triggeredY === undefined &&
        bestYDist !== Infinity &&
        Math.abs(d - bestYDist) < 1;
      if (d < bestYDist || tieToGrid) {
        bestY = anchor.position;
        bestYDist = d;
        triggeredY = anchor;
      }
    }
  }

  const triggered: AnchorLine[] = [];
  if (triggeredX) triggered.push(triggeredX);
  if (triggeredY) triggered.push(triggeredY);

  return { x: bestX, y: bestY, triggeredAnchors: triggered };
}

export function snapToPixelGrid(
  desired: { x: number; y: number },
  pixelGridSize: PixelGridSize,
): { x: number; y: number } {
  if (!pixelGridSize) return desired;
  return {
    x: Math.round(desired.x / pixelGridSize) * pixelGridSize,
    y: Math.round(desired.y / pixelGridSize) * pixelGridSize,
  };
}
