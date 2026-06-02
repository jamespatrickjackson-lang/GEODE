import { describe, expect, it } from "vitest";
import { rectContainsRect, rectsIntersect, rectUnion } from "../rect";
import { canvasToFrame, canvasToScreen, frameToCanvas, screenToCanvas } from "../canvasMath";
import { snapPoint, snapToPixelGrid } from "../snap";
import { applyMove, applyParentResizeToChild, applyResize } from "../transform";
import { alignRects, distributeRects } from "../distribute";
import { anchorsForFrame } from "../anchorsForFrame";
import { computeSmartGuides } from "../smartGuides";
import type { Frame } from "../../schema/frame";

describe("rect helpers", () => {
  it("contains and intersects", () => {
    const outer = { x: 0, y: 0, w: 100, h: 100 };
    expect(rectContainsRect(outer, { x: 10, y: 10, w: 20, h: 20 })).toBe(true);
    expect(rectContainsRect(outer, { x: 90, y: 90, w: 20, h: 20 })).toBe(false);
    expect(rectsIntersect(outer, { x: 50, y: 50, w: 80, h: 80 })).toBe(true);
    expect(rectsIntersect(outer, { x: 200, y: 200, w: 10, h: 10 })).toBe(false);
  });
  it("unions empty list to zero rect", () => {
    expect(rectUnion([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe("canvasMath", () => {
  it("screen<->canvas round-trip", () => {
    const vp = { panX: 10, panY: -20, zoom: 2 };
    const viewportRect = { x: 50, y: 60, w: 800, h: 600 };
    const screen = { x: 250, y: 200 };
    const canvas = screenToCanvas(screen, vp, viewportRect);
    const back = canvasToScreen(canvas, vp, viewportRect);
    expect(back.x).toBeCloseTo(screen.x);
    expect(back.y).toBeCloseTo(screen.y);
  });
  it("canvas<->frame round-trip", () => {
    const origin = { x: 100, y: 200 };
    const p = { x: 150, y: 250 };
    const frame = canvasToFrame(p, origin);
    expect(frame).toEqual({ x: 50, y: 50 });
    expect(frameToCanvas(frame, origin)).toEqual(p);
  });
});

describe("snap", () => {
  it("snaps to nearest pixel grid", () => {
    const r = snapPoint({ x: 49.2, y: 30.9 }, [], 1, 4, 1);
    expect(r).toEqual({ x: 49, y: 31, triggeredAnchors: [] });
  });
  it("snaps to 8px grid", () => {
    expect(snapToPixelGrid({ x: 50, y: 30 }, 8)).toEqual({ x: 48, y: 32 });
  });
  it("snaps to an anchor inside threshold", () => {
    const r = snapPoint(
      { x: 102, y: 50 },
      [{ axis: "x", position: 100, sourceKind: "frame-edge" }],
      null,
      4,
      1,
    );
    expect(r.x).toBe(100);
    expect(r.triggeredAnchors).toHaveLength(1);
  });
  it("respects zoom when comparing threshold", () => {
    const r = snapPoint(
      { x: 105, y: 0 },
      [{ axis: "x", position: 100, sourceKind: "frame-edge" }],
      null,
      4,
      2,
    );
    // threshold/zoom = 2; 5 > 2 so no snap
    expect(r.x).toBe(105);
  });
});

describe("transform", () => {
  const parent = { x: 0, y: 0, w: 1000, h: 1000 };
  it("applyMove translates and clamps to parent", () => {
    expect(applyMove({ x: 10, y: 10, w: 30, h: 30 }, { dx: 5, dy: 5 }, parent, null)).toEqual({
      x: 15,
      y: 15,
      w: 30,
      h: 30,
    });
    expect(applyMove({ x: 990, y: 990, w: 30, h: 30 }, { dx: 100, dy: 100 }, parent, null)).toEqual({
      x: 970,
      y: 970,
      w: 30,
      h: 30,
    });
  });
  it("applyResize honours minSize", () => {
    const r = applyResize({ x: 0, y: 0, w: 30, h: 30 }, "se", { dx: -100, dy: -100 }, null, null);
    expect(r.w).toBeGreaterThanOrEqual(8);
    expect(r.h).toBeGreaterThanOrEqual(8);
  });
  it("applyResize NW handle moves origin and shrinks", () => {
    const r = applyResize({ x: 10, y: 10, w: 30, h: 30 }, "nw", { dx: 5, dy: 5 }, null, null);
    expect(r).toEqual({ x: 15, y: 15, w: 25, h: 25 });
  });
  it("aspect lock works on NE corner", () => {
    const r = applyResize({ x: 0, y: 0, w: 200, h: 100 }, "ne", { dx: 100, dy: -10 }, null, null, undefined, true);
    expect(r.w / r.h).toBeCloseTo(2.0, 1);
  });
  it("applyParentResizeToChild stretch grows with parent", () => {
    const out = applyParentResizeToChild(
      { x: 10, y: 0, w: 80, h: 20 },
      { w: 100, h: 50 },
      { w: 200, h: 50 },
      { horizontal: "stretch", vertical: "left" },
    );
    expect(out.w).toBe(180);
  });
  it("applyParentResizeToChild right pins right edge", () => {
    const out = applyParentResizeToChild(
      { x: 70, y: 0, w: 20, h: 20 },
      { w: 100, h: 50 },
      { w: 200, h: 50 },
      { horizontal: "right", vertical: "left" },
    );
    expect(out.x).toBe(170);
    expect(out.w).toBe(20);
  });
});

describe("distribute", () => {
  it("aligns left to selection bounds", () => {
    const rects = [
      { x: 10, y: 10, w: 20, h: 20 },
      { x: 50, y: 50, w: 30, h: 30 },
    ];
    const aligned = alignRects(rects, "left", { bounds: { x: 0, y: 0, w: 200, h: 200 } });
    expect(aligned[0]!.x).toBe(0);
    expect(aligned[1]!.x).toBe(0);
  });
  it("distributes horizontally", () => {
    const rects = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 30, y: 0, w: 10, h: 10 },
      { x: 100, y: 0, w: 10, h: 10 },
    ];
    const out = distributeRects(rects, "x");
    const mid = out[1]!;
    expect(mid.x + mid.w / 2).toBeCloseTo(55, 1);
  });
});

describe("anchorsForFrame", () => {
  const frame: Frame = {
    id: "f1",
    name: "F1",
    positionOnCanvas: { x: 0, y: 0 },
    size: { w: 200, h: 100 },
    safeArea: { left: 8, top: 8, right: 8, bottom: 8 },
    background: {},
    containerIds: [],
    componentIds: [],
  };
  it("yields frame edges, centres, safe area", () => {
    const anchors = anchorsForFrame(frame, [], [], frame.safeArea, [], new Set());
    expect(anchors.some((a) => a.axis === "x" && a.position === 0)).toBe(true);
    expect(anchors.some((a) => a.axis === "x" && a.position === 200)).toBe(true);
    expect(anchors.some((a) => a.axis === "x" && a.position === 100)).toBe(true); // centre
    expect(anchors.some((a) => a.axis === "x" && a.position === 8)).toBe(true); // safe left
    expect(anchors.some((a) => a.axis === "x" && a.position === 192)).toBe(true); // safe right
  });
  it("excludes ids in excludeIds", () => {
    const c = {
      id: "c1",
      name: "C",
      archetype: "container-blank" as const,
      parentId: null,
      frameId: "f1",
      rect: { x: 5, y: 5, w: 50, h: 50 },
      constraints: { horizontal: "left" as const, vertical: "left" as const },
      containerIds: [],
      componentIds: [],
      locked: false,
      hidden: false,
    };
    const all = anchorsForFrame(frame, [c], [], frame.safeArea, [], new Set());
    const excluded = anchorsForFrame(frame, [c], [], frame.safeArea, [], new Set(["c1"]));
    expect(all.length).toBeGreaterThan(excluded.length);
  });
});

describe("computeSmartGuides", () => {
  it("emits a guide when edges align within tolerance", () => {
    const moving = { x: 100, y: 50, w: 40, h: 20 };
    const partners = [
      { id: "p1", rect: { x: 100, y: 200, w: 40, h: 20 } },
    ];
    const guides = computeSmartGuides(moving, "m1", partners, 1);
    expect(guides.some((g) => g.axis === "x" && Math.round(g.position) === 100)).toBe(true);
  });
});
