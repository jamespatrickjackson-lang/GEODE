import type { Point, Rect } from "../schema/primitives";

export interface Viewport {
  panX: number;
  panY: number;
  zoom: number;
}

export function screenToCanvas(p: Point, vp: Viewport, viewportRect: Rect): Point {
  const relX = p.x - viewportRect.x;
  const relY = p.y - viewportRect.y;
  return { x: relX / vp.zoom - vp.panX, y: relY / vp.zoom - vp.panY };
}

export function canvasToScreen(p: Point, vp: Viewport, viewportRect: Rect): Point {
  return {
    x: (p.x + vp.panX) * vp.zoom + viewportRect.x,
    y: (p.y + vp.panY) * vp.zoom + viewportRect.y,
  };
}

export function canvasToFrame(p: Point, frameOriginCanvas: Point): Point {
  return { x: p.x - frameOriginCanvas.x, y: p.y - frameOriginCanvas.y };
}

export function frameToCanvas(p: Point, frameOriginCanvas: Point): Point {
  return { x: p.x + frameOriginCanvas.x, y: p.y + frameOriginCanvas.y };
}
