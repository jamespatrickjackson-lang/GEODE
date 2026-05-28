import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { SceneHandle } from "../scene";
import type { GuiLabelVisualStyle, SceneProperties } from "../pages/types";
import { useEditor } from "../editor/EditorContext";
import { usePageController } from "../pages/PageController";
import { effectiveStyle } from "../pages/effective";
import {
  activeRenderPresetIdForPage,
  labelSettingsPatchForRenderPreset,
  projectRenderPresets,
} from "../pages/renderPresets";

// HTML-overlay floating labels. Each frame we project a labelable
// feature's world position to NDC, transform to screen pixels, and
// imperatively place a frosted DOM chip there. Imperative DOM (not
// React JSX) is deliberate: ~50 elements re-positioned at 60 Hz would
// flood React's reconciler. We keep a Map<key, HTMLElement>, reuse
// nodes across frames, and only React-render the empty container.
//
// Anchor strategy: dedupe by displayName per layer (a single drillhole
// can have a collar Mesh + Line2 trace + halo Sprite, all carrying the
// same displayName -- one label is what you want). For the chosen
// object we use its geometry's bounding-box centre transformed into
// world space, falling back to the object's world position. Box centre
// works for Line2 outlines (target rings) where the object's transform
// is identity but the vertex cloud has a meaningful midpoint.
//
// Layout: stable screen-space placement. Every label tries a small set of
// familiar cartographic positions around its anchor, then scores those
// positions against occupied labels, previous placement, and leader-line
// crossings. GUI panels paint above this layer, so labels can pass behind
// interface chrome instead of being pushed around by it.
//
// When the chosen offset displaces the chip more than ~4 px from its
// anchor, a thin leader line connects them so the eye still maps chip
// -> feature.

const LABEL_LINE_HEIGHT_PX = 22;
const LABEL_CHAR_WIDTH_PX = 7; // rough monospace-ish heuristic
const LAND_TITLE_FONT_SIZE_PX = 14.3;
const LAND_TITLE_CHAR_WIDTH_PX = 7.15;
const LAND_TITLE_HORIZONTAL_PAD_PX = 28;
const LAND_TITLE_POINTER_PAD_PX = 18;
const LAND_TITLE_CORNER_RADIUS_PX = 7;

type LabelKind = "siteElement" | "landTitle" | "area" | "anomaly";
type LabelPointerSide = "auto" | "left" | "right";
type PlacementSide =
  | "top"
  | "topLeft"
  | "topRight"
  | "bottom"
  | "bottomLeft"
  | "bottomRight"
  | "left"
  | "right";

interface LeaderSegment {
  ax: number;
  ay: number;
  lx: number;
  ly: number;
}

interface LabelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface LabelMemory {
  x: number;
  y: number;
  side: PlacementSide;
}

interface LabelAnchorChoice {
  obj: THREE.Object3D;
  rank: number;
}

interface LabelCandidate {
  key: string;
  label: string;
  layerId: string;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  width: number;
  height: number;
  opacity: number;
  dist: number;
  priority: number;
  placementSide: PlacementSide;
  labelTextColor: string;
  labelOutlineColor: string | null;
  labelFillColor: string | null;
  labelTextOpacity: number;
  labelOutlineOpacity: number;
  labelFillOpacity: number;
  labelKind: LabelKind;
  labelPointerSide: LabelPointerSide;
  labelPointerVisible: boolean;
}

interface LabelRuntimeSettings {
  enabled: boolean;
  followLerp: number;
  maxSpringPx: number;
  pinGapPx: number;
  collisionPadPx: number;
  fadeNearM: number;
  fadeFarM: number;
  frustumMargin: number;
  maxSiteLabelsDesktop: number;
  maxSiteLabelsMobile: number;
  leaderVisibleThresholdPx: number;
  nearNudgeMinPx: number;
  nearNudgeMaxPx: number;
  nearNudgeScale: number;
  farNudgeMinPx: number;
  farNudgeMaxPx: number;
  farNudgeScale: number;
  topNudgePenalty: number;
  farNudgePenalty: number;
  bottomPenalty: number;
  bottomDiagonalPenalty: number;
  overlapPenalty: number;
  crossingPenalty: number;
  distancePenaltyDivisor: number;
  landTitleDistancePenaltyDivisor: number;
  movementPenaltyDivisor: number;
  sideChangePenalty: number;
  belowAnchorPenalty: number;
}

const DEFAULT_LABEL_SETTINGS: LabelRuntimeSettings = {
  enabled: true,
  followLerp: 0.1,
  maxSpringPx: 70,
  pinGapPx: 28,
  collisionPadPx: 10,
  fadeNearM: 15_000,
  fadeFarM: 40_000,
  frustumMargin: 1.2,
  maxSiteLabelsDesktop: 34,
  maxSiteLabelsMobile: 18,
  leaderVisibleThresholdPx: 4,
  nearNudgeMinPx: 48,
  nearNudgeMaxPx: 118,
  nearNudgeScale: 0.72,
  farNudgeMinPx: 96,
  farNudgeMaxPx: 190,
  farNudgeScale: 1.28,
  topNudgePenalty: 22,
  farNudgePenalty: 72,
  bottomPenalty: 1200,
  bottomDiagonalPenalty: 1450,
  overlapPenalty: 18,
  crossingPenalty: 5000,
  distancePenaltyDivisor: 58,
  landTitleDistancePenaltyDivisor: 90,
  movementPenaltyDivisor: 52,
  sideChangePenalty: 280,
  belowAnchorPenalty: 1800,
};

const DEFAULT_LABEL_VISUAL_STYLES: Record<
  LabelKind,
  Required<GuiLabelVisualStyle>
> = {
  siteElement: {
    textColor: "#e6e2dc",
    textOpacity: 1,
    outlineColor: "#e6e2dc",
    outlineOpacity: 1,
    fillColor: "#14161c",
    fillOpacity: 0,
    pointerVisible: true,
    pointerSide: "auto",
  },
  landTitle: {
    textColor: "#fff4e6",
    textOpacity: 1,
    outlineColor: "#e6e2dc",
    outlineOpacity: 0.34,
    fillColor: "#2a2118",
    fillOpacity: 0.82,
    pointerVisible: true,
    pointerSide: "auto",
  },
  area: {
    textColor: "#f4f7ee",
    textOpacity: 1,
    outlineColor: "#d9ead0",
    outlineOpacity: 0.76,
    fillColor: "#263426",
    fillOpacity: 0.68,
    pointerVisible: true,
    pointerSide: "auto",
  },
  anomaly: {
    textColor: "#fff2df",
    textOpacity: 1,
    outlineColor: "#ff9f43",
    outlineOpacity: 0.82,
    fillColor: "#4d2412",
    fillOpacity: 0.76,
    pointerVisible: true,
    pointerSide: "auto",
  },
};

function normalizeLabelKind(value: unknown): LabelKind {
  return value === "landTitle" || value === "area" || value === "anomaly"
    ? value
    : "siteElement";
}

function labelVisualStyle(
  scene: SceneProperties | undefined,
  kind: LabelKind,
): Required<GuiLabelVisualStyle> {
  return {
    ...DEFAULT_LABEL_VISUAL_STYLES[kind],
    ...(scene?.gui?.labels?.styles?.[kind] ?? {}),
  };
}

function numberSetting(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}

function getLabelSettings(
  scene: SceneProperties | undefined,
  presetPatch?: Partial<LabelRuntimeSettings> | null,
): LabelRuntimeSettings {
  const raw = { ...(scene?.gui?.labels ?? {}), ...(presetPatch ?? {}) };
  const d = DEFAULT_LABEL_SETTINGS;
  return {
    enabled: raw.enabled ?? d.enabled,
    followLerp: numberSetting(raw.followLerp, d.followLerp, 0, 1),
    maxSpringPx: numberSetting(raw.maxSpringPx, d.maxSpringPx, 0, 400),
    pinGapPx: numberSetting(raw.pinGapPx, d.pinGapPx, 0, 120),
    collisionPadPx: numberSetting(raw.collisionPadPx, d.collisionPadPx, 0, 80),
    fadeNearM: numberSetting(raw.fadeNearM, d.fadeNearM, 0, 100_000),
    fadeFarM: numberSetting(raw.fadeFarM, d.fadeFarM, 1, 150_000),
    frustumMargin: numberSetting(raw.frustumMargin, d.frustumMargin, 0.8, 2.5),
    maxSiteLabelsDesktop: Math.round(
      numberSetting(
        raw.maxSiteLabelsDesktop,
        d.maxSiteLabelsDesktop,
        0,
        120,
      ),
    ),
    maxSiteLabelsMobile: Math.round(
      numberSetting(raw.maxSiteLabelsMobile, d.maxSiteLabelsMobile, 0, 80),
    ),
    leaderVisibleThresholdPx: numberSetting(
      raw.leaderVisibleThresholdPx,
      d.leaderVisibleThresholdPx,
      0,
      80,
    ),
    nearNudgeMinPx: numberSetting(raw.nearNudgeMinPx, d.nearNudgeMinPx, 0, 240),
    nearNudgeMaxPx: numberSetting(raw.nearNudgeMaxPx, d.nearNudgeMaxPx, 0, 320),
    nearNudgeScale: numberSetting(raw.nearNudgeScale, d.nearNudgeScale, 0, 3),
    farNudgeMinPx: numberSetting(raw.farNudgeMinPx, d.farNudgeMinPx, 0, 360),
    farNudgeMaxPx: numberSetting(raw.farNudgeMaxPx, d.farNudgeMaxPx, 0, 520),
    farNudgeScale: numberSetting(raw.farNudgeScale, d.farNudgeScale, 0, 4),
    topNudgePenalty: numberSetting(
      raw.topNudgePenalty,
      d.topNudgePenalty,
      0,
      2000,
    ),
    farNudgePenalty: numberSetting(
      raw.farNudgePenalty,
      d.farNudgePenalty,
      0,
      3000,
    ),
    bottomPenalty: numberSetting(raw.bottomPenalty, d.bottomPenalty, 0, 10_000),
    bottomDiagonalPenalty: numberSetting(
      raw.bottomDiagonalPenalty,
      d.bottomDiagonalPenalty,
      0,
      10_000,
    ),
    overlapPenalty: numberSetting(raw.overlapPenalty, d.overlapPenalty, 0, 120),
    crossingPenalty: numberSetting(
      raw.crossingPenalty,
      d.crossingPenalty,
      0,
      20_000,
    ),
    distancePenaltyDivisor: numberSetting(
      raw.distancePenaltyDivisor,
      d.distancePenaltyDivisor,
      1,
      500,
    ),
    landTitleDistancePenaltyDivisor: numberSetting(
      raw.landTitleDistancePenaltyDivisor,
      d.landTitleDistancePenaltyDivisor,
      1,
      500,
    ),
    movementPenaltyDivisor: numberSetting(
      raw.movementPenaltyDivisor,
      d.movementPenaltyDivisor,
      1,
      500,
    ),
    sideChangePenalty: numberSetting(
      raw.sideChangePenalty,
      d.sideChangePenalty,
      0,
      5000,
    ),
    belowAnchorPenalty: numberSetting(
      raw.belowAnchorPenalty,
      d.belowAnchorPenalty,
      0,
      10_000,
    ),
  };
}

function getLabelAnchor(obj: THREE.Object3D, out: THREE.Vector3): void {
  const mesh = obj as THREE.Mesh & { geometry?: THREE.BufferGeometry };
  if (mesh.geometry) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (bb) {
      bb.getCenter(out);
      mesh.localToWorld(out);
      return;
    }
  }
  obj.getWorldPosition(out);
}

function labelAnchorRank(obj: THREE.Object3D): number {
  const data = obj.userData as {
    labelAnchor?: boolean;
    kind?: string;
    drillTraceRole?: string;
  };
  if (data.labelAnchor === true) return 0;
  if (typeof data.kind === "string" && data.kind.includes("collar")) return 1;
  if (obj.type === "Mesh" || obj.type === "Sprite") return 2;
  if (data.drillTraceRole === "bore") return 3;
  if ((obj as THREE.Mesh & { geometry?: THREE.BufferGeometry }).geometry) {
    return 4;
  }
  return 8;
}

function chooseLabelAnchors(group: THREE.Group): Map<string, THREE.Object3D> {
  const choices = new Map<string, LabelAnchorChoice>();
  group.traverse((obj) => {
    if (obj.visible === false) return;
    const data = obj.userData as {
      displayName?: string;
      sceneSectionLabelHidden?: boolean;
    };
    if (data.sceneSectionLabelHidden === true) return;
    const dn = data.displayName;
    if (typeof dn !== "string" || dn.length === 0) return;
    const rank = labelAnchorRank(obj);
    const current = choices.get(dn);
    if (!current || rank < current.rank) {
      choices.set(dn, { obj, rank });
    }
  });
  const anchors = new Map<string, THREE.Object3D>();
  for (const [label, choice] of choices) {
    anchors.set(label, choice.obj);
  }
  return anchors;
}

function measureLabelSize(
  label: string,
  kind: LabelKind,
  context: CanvasRenderingContext2D | null,
): { width: number; height: number } {
  const isCallout = kind !== "siteElement";
  const fallbackTextWidth =
    label.length * (isCallout ? LAND_TITLE_CHAR_WIDTH_PX : LABEL_CHAR_WIDTH_PX);
  let textWidth = fallbackTextWidth;
  if (context) {
    context.font = isCallout
      ? `600 ${LAND_TITLE_FONT_SIZE_PX}px system-ui, sans-serif`
      : "500 11px system-ui, sans-serif";
    textWidth = context.measureText(label).width;
  }
  return {
    width: Math.ceil(
      textWidth + (isCallout ? LAND_TITLE_HORIZONTAL_PAD_PX : 18),
    ),
    height: isCallout ? LAND_TITLE_FONT_SIZE_PX + 14 : LABEL_LINE_HEIGHT_PX,
  };
}

function createChipElement(text: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:absolute;top:0;left:0;pointer-events:auto;" +
    "font-family:system-ui,sans-serif;font-size:11px;" +
    "white-space:nowrap;will-change:transform,opacity;line-height:14px;" +
    "transition:opacity 180ms ease;" +
    "padding:4px 8px;border-radius:6px;" +
    "box-sizing:border-box;text-align:center;" +
    "background:rgba(20,22,28,0.72);" +
    "backdrop-filter:blur(16px) saturate(180%);" +
    "-webkit-backdrop-filter:blur(16px) saturate(180%);" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.4);" +
    "overflow:visible;isolation:isolate;";
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  shape.dataset.labelShape = "true";
  shape.style.cssText =
    "position:absolute;left:0;top:0;display:none;overflow:visible;pointer-events:none;z-index:0;";
  const shapePath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  shapePath.dataset.labelShapePath = "true";
  shapePath.setAttribute("stroke-width", "1.5");
  shapePath.setAttribute("stroke-linejoin", "round");
  shapePath.setAttribute("stroke-linecap", "round");
  const pointEdge = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  pointEdge.dataset.labelShapePointEdge = "true";
  pointEdge.setAttribute("fill", "none");
  pointEdge.setAttribute("stroke-width", "1.5");
  pointEdge.setAttribute("stroke-linejoin", "round");
  pointEdge.setAttribute("stroke-linecap", "round");
  shape.appendChild(shapePath);
  shape.appendChild(pointEdge);
  const textSpan = document.createElement("span");
  textSpan.dataset.labelText = "true";
  textSpan.textContent = text;
  textSpan.style.cssText =
    "position:relative;z-index:1;display:block;overflow:hidden;text-overflow:ellipsis;";
  wrap.appendChild(shape);
  wrap.appendChild(textSpan);
  // border + color filled in per-frame from effective layer style.
  return wrap;
}

function cssColorWithOpacity(color: string, opacity: number): string {
  const alpha = clamp(opacity, 0, 1);
  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const [r, g, b] = short[1].split("").map((ch) => parseInt(ch + ch, 16));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  if (full) {
    const raw = full[1];
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

function applyChipColor(
  el: HTMLDivElement,
  textColor: string,
  outlineColor: string | null,
  fillColor: string | null,
  textOpacity: number,
  outlineOpacity: number,
  fillOpacity: number,
): void {
  const textCss = cssColorWithOpacity(textColor, textOpacity);
  const outlineCss = outlineColor
    ? cssColorWithOpacity(outlineColor, outlineOpacity)
    : null;
  const fillCss = cssColorWithOpacity(fillColor ?? "#14161c", fillOpacity);
  el.style.color = textCss;
  el.style.borderTop = outlineCss ? `1px solid ${outlineCss}` : "none";
  el.style.borderRight = outlineCss ? `1px solid ${outlineCss}` : "none";
  el.style.borderBottom = outlineCss ? `1px solid ${outlineCss}` : "none";
  el.style.borderLeft = outlineCss ? `1px solid ${outlineCss}` : "none";
  el.style.background = fillCss;
  const shapePath = el.querySelector<SVGPathElement>("[data-label-shape-path]");
  const pointEdge = el.querySelector<SVGPathElement>(
    "[data-label-shape-point-edge]",
  );
  if (shapePath) {
    shapePath.setAttribute("fill", fillCss);
    if (outlineCss) {
      shapePath.setAttribute("stroke", outlineCss);
    } else {
      shapePath.setAttribute("stroke", "none");
    }
  }
  if (pointEdge) {
    pointEdge.setAttribute("stroke", outlineCss ?? fillCss);
  }
}

function applyChipPresentation(
  el: HTMLDivElement,
  kind: LabelKind,
): void {
  const isCallout = kind !== "siteElement";
  el.dataset.labelKind = kind;
  el.style.fontSize = isCallout ? `${LAND_TITLE_FONT_SIZE_PX}px` : "11px";
  el.style.lineHeight = isCallout ? "18px" : "14px";
  el.style.padding = isCallout ? "5px 10px" : "4px 8px";
  el.style.borderRadius = isCallout ? "7px" : "6px";
  el.style.fontWeight = isCallout ? "600" : "500";
  el.style.textAlign = "center";
  el.style.boxShadow = isCallout
    ? "0 4px 14px rgba(0,0,0,0.5)"
    : "0 2px 8px rgba(0,0,0,0.4)";
  if (isCallout) {
    el.style.background = "transparent";
    el.style.backdropFilter = "none";
    el.style.setProperty("-webkit-backdrop-filter", "none");
    el.style.borderTop = "none";
    el.style.borderRight = "none";
    el.style.borderBottom = "none";
    el.style.borderLeft = "none";
  } else {
    el.style.width = "auto";
    el.style.backdropFilter = "blur(16px) saturate(180%)";
    el.style.setProperty(
      "-webkit-backdrop-filter",
      "blur(16px) saturate(180%)",
    );
  }
  const shape = el.querySelector<SVGSVGElement>("[data-label-shape]");
  if (shape) shape.style.display = isCallout ? "block" : "none";
}

function roundedRectPath(width: number, height: number, radius: number): string {
  const r = Math.min(radius, width / 2, height / 2);
  return [
    `M${r} 0`,
    `H${width - r}`,
    `Q${width} 0 ${width} ${r}`,
    `V${height - r}`,
    `Q${width} ${height} ${width - r} ${height}`,
    `H${r}`,
    `Q0 ${height} 0 ${height - r}`,
    `V${r}`,
    `Q0 0 ${r} 0`,
    "Z",
  ].join(" ");
}

function placeLandTitlePointer(
  el: HTMLDivElement,
  anchorX: number,
  anchorY: number,
  renderedX: number,
  renderedY: number,
  width: number,
  height: number,
  pointerSide: LabelPointerSide,
  pointerVisible: boolean,
): void {
  const shape = el.querySelector<SVGSVGElement>("[data-label-shape]");
  const shapePath = el.querySelector<SVGPathElement>(
    "[data-label-shape-path]",
  );
  const pointEdge = el.querySelector<SVGPathElement>(
    "[data-label-shape-point-edge]",
  );
  if (!shape || !shapePath) return;
  const r = LAND_TITLE_CORNER_RADIUS_PX;
  if (!pointerVisible) {
    shape.style.left = "0px";
    shape.style.top = "0px";
    shape.style.width = `${width.toFixed(1)}px`;
    shape.style.height = `${height.toFixed(1)}px`;
    shape.setAttribute(
      "viewBox",
      `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`,
    );
    shapePath.setAttribute("d", roundedRectPath(width, height, r));
    if (pointEdge) pointEdge.setAttribute("d", "");
    return;
  }
  const chipLeft = renderedX - width / 2;
  const chipTop = renderedY - height / 2;
  const tipX = anchorX - chipLeft;
  const tipY = anchorY - chipTop;
  const tailDown = tipY >= height / 2;
  const halfBase = Math.min(17, Math.max(9, width * 0.05));
  const biasedTipX =
    pointerSide === "left"
      ? Math.min(tipX, LAND_TITLE_POINTER_PAD_PX)
      : pointerSide === "right"
        ? Math.max(tipX, width - LAND_TITLE_POINTER_PAD_PX)
        : tipX;
  const baseCenter = clamp(
    biasedTipX,
    LAND_TITLE_POINTER_PAD_PX + halfBase,
    Math.max(
      LAND_TITLE_POINTER_PAD_PX + halfBase,
      width - LAND_TITLE_POINTER_PAD_PX - halfBase,
    ),
  );
  const leftBase = baseCenter - halfBase;
  const rightBase = baseCenter + halfBase;
  const viewMinX = Math.min(0, tipX - 2);
  const viewMaxX = Math.max(width, tipX + 2);
  const viewMinY = Math.min(0, tipY - 2);
  const viewMaxY = Math.max(height, tipY + 2);
  const viewW = viewMaxX - viewMinX;
  const viewH = viewMaxY - viewMinY;

  shape.style.left = `${viewMinX.toFixed(1)}px`;
  shape.style.top = `${viewMinY.toFixed(1)}px`;
  shape.style.width = `${viewW.toFixed(1)}px`;
  shape.style.height = `${viewH.toFixed(1)}px`;
  shape.setAttribute(
    "viewBox",
    `${viewMinX.toFixed(1)} ${viewMinY.toFixed(1)} ${viewW.toFixed(1)} ${viewH.toFixed(1)}`,
  );
  shapePath.setAttribute(
    "d",
    tailDown
      ? [
          `M${r} 0`,
          `H${width - r}`,
          `Q${width} 0 ${width} ${r}`,
          `V${height - r}`,
          `Q${width} ${height} ${width - r} ${height}`,
          `H${rightBase}`,
          `L${tipX} ${tipY}`,
          `L${leftBase} ${height}`,
          `H${r}`,
          `Q0 ${height} 0 ${height - r}`,
          `V${r}`,
          `Q0 0 ${r} 0`,
          "Z",
        ].join(" ")
      : [
          `M${r} 0`,
          `H${leftBase}`,
          `L${tipX} ${tipY}`,
          `L${rightBase} 0`,
          `H${width - r}`,
          `Q${width} 0 ${width} ${r}`,
          `V${height - r}`,
          `Q${width} ${height} ${width - r} ${height}`,
          `H${r}`,
          `Q0 ${height} 0 ${height - r}`,
          `V${r}`,
          `Q0 0 ${r} 0`,
          "Z",
        ].join(" "),
  );
  if (pointEdge) {
    pointEdge.setAttribute("d", "");
  }
}

function createLeaderElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;top:0;left:0;height:1px;" +
    "transform-origin:0 0;background:rgba(255,255,255,0.5);" +
    "will-change:transform,width,opacity;pointer-events:none;" +
    "transition:opacity 180ms ease;";
  return el;
}

function placeLeader(
  el: HTMLDivElement,
  ax: number,
  ay: number,
  lx: number,
  ly: number,
  visibleThresholdPx: number,
): void {
  const dx = lx - ax;
  const dy = ly - ay;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < visibleThresholdPx) {
    el.style.opacity = "0";
    return;
  }
  const angle = Math.atan2(dy, dx);
  el.style.transform = `translate(${ax.toFixed(1)}px,${ay.toFixed(1)}px) rotate(${angle.toFixed(4)}rad)`;
  el.style.width = `${len.toFixed(1)}px`;
  el.style.opacity = "1";
}

function pointDistanceSq(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

function orient(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function segmentsCross(a: LeaderSegment, b: LeaderSegment): boolean {
  // Strict intersection only: touching at an endpoint or nearly-colinear
  // leader lines is visually acceptable and avoids jittery side swapping.
  const o1 = orient(a.ax, a.ay, a.lx, a.ly, b.ax, b.ay);
  const o2 = orient(a.ax, a.ay, a.lx, a.ly, b.lx, b.ly);
  const o3 = orient(b.ax, b.ay, b.lx, b.ly, a.ax, a.ay);
  const o4 = orient(b.ax, b.ay, b.lx, b.ly, a.lx, a.ly);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function labelRect(
  cx: number,
  cy: number,
  width: number,
  height: number,
  pad = DEFAULT_LABEL_SETTINGS.collisionPadPx,
): LabelRect {
  return {
    x0: cx - width / 2 - pad,
    y0: cy - height / 2 - pad,
    x1: cx + width / 2 + pad,
    y1: cy + height / 2 + pad,
  };
}

function rectOverlapArea(a: LabelRect, b: LabelRect): number {
  const width = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const height = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return width * height;
}

function labelPriority(layerId: string, kind: LabelKind): number {
  if (kind === "landTitle") return 1000;
  if (kind === "anomaly") return 900;
  if (kind === "area") return 760;
  if (layerId === "property-neighbors") return 720;
  if (layerId === "drillholes-2024-tf") return 620;
  if (layerId === "drillholes-2023") return 600;
  return 420;
}

function placementBias(side: PlacementSide, settings: LabelRuntimeSettings): number {
  switch (side) {
    case "top":
      return 0;
    case "topLeft":
    case "topRight":
      return settings.topNudgePenalty;
    case "left":
    case "right":
      return settings.farNudgePenalty;
    case "bottom":
      return settings.bottomPenalty;
    case "bottomLeft":
    case "bottomRight":
      return settings.bottomDiagonalPenalty;
  }
}

function isAbovePlacement(side: PlacementSide): boolean {
  return (
    side === "top" ||
    side === "topLeft" ||
    side === "topRight" ||
    side === "left" ||
    side === "right"
  );
}

function clampPlacement(
  x: number,
  y: number,
): { x: number; y: number; edgePenalty: number } {
  return { x, y, edgePenalty: 0 };
}

function placementPoint(
  c: LabelCandidate,
  side: PlacementSide,
  settings: LabelRuntimeSettings,
): { x: number; y: number; edgePenalty: number } {
  const gap = settings.pinGapPx;
  const nudgeX = Math.min(
    Math.max(settings.nearNudgeMinPx, c.width * settings.nearNudgeScale),
    settings.nearNudgeMaxPx,
  );
  const farNudgeX = Math.min(
    Math.max(settings.farNudgeMinPx, c.width * settings.farNudgeScale),
    settings.farNudgeMaxPx,
  );
  let x = c.anchorX;
  let y = c.anchorY - gap - c.height / 2;
  switch (side) {
    case "top":
      break;
    case "topLeft":
      x -= nudgeX;
      break;
    case "topRight":
      x += nudgeX;
      break;
    case "left":
      x -= farNudgeX;
      break;
    case "right":
      x += farNudgeX;
      break;
    case "bottom":
      y = c.anchorY + gap + c.height / 2;
      break;
    case "bottomLeft":
      x -= nudgeX;
      y = c.anchorY + gap + c.height / 2;
      break;
    case "bottomRight":
      x += nudgeX;
      y = c.anchorY + gap + c.height / 2;
      break;
  }
  return clampPlacement(x, y);
}

function leaderEndpointForPlacement(
  c: LabelCandidate,
  side: PlacementSide,
  labelX: number,
  labelY: number,
): { x: number; y: number } {
  const left = labelX - c.width / 2;
  const right = labelX + c.width / 2;
  const top = labelY - c.height / 2;
  const bottom = labelY + c.height / 2;
  const inset = 7;
  if (side === "bottom" || side === "bottomLeft" || side === "bottomRight") {
    return { x: clamp(c.anchorX, left + inset, right - inset), y: top };
  }
  return { x: clamp(c.anchorX, left + inset, right - inset), y: bottom };
}

function leaderSegmentForPlacement(
  c: LabelCandidate,
  side: PlacementSide,
  labelX: number,
  labelY: number,
): LeaderSegment {
  const endpoint = leaderEndpointForPlacement(c, side, labelX, labelY);
  return { ax: c.anchorX, ay: c.anchorY, lx: endpoint.x, ly: endpoint.y };
}

function scorePlacement(
  c: LabelCandidate,
  side: PlacementSide,
  x: number,
  y: number,
  edgePenalty: number,
  occupiedRects: LabelRect[],
  placedLeaders: LeaderSegment[],
  previous: LabelMemory | undefined,
  settings: LabelRuntimeSettings,
): number {
  const rect = labelRect(x, y, c.width, c.height, settings.collisionPadPx);
  const leader = leaderSegmentForPlacement(c, side, x, y);
  const overlapPenalty = occupiedRects.reduce(
    (sum, other) => sum + rectOverlapArea(rect, other) * settings.overlapPenalty,
    0,
  );
  const crossingPenalty =
    placedLeaders.filter((other) => segmentsCross(leader, other)).length *
    settings.crossingPenalty;
  const distancePenalty =
    pointDistanceSq(c.anchorX, c.anchorY, x, y) /
    (c.labelKind !== "siteElement"
      ? settings.landTitleDistancePenaltyDivisor
      : settings.distancePenaltyDivisor);
  const movementPenalty = previous
    ? pointDistanceSq(previous.x, previous.y, x, y) /
      settings.movementPenaltyDivisor
    : 0;
  const sidePenalty =
    previous && previous.side !== side && isAbovePlacement(previous.side)
      ? settings.sideChangePenalty
      : 0;
  const belowPenalty =
    c.labelKind === "siteElement" && !isAbovePlacement(side)
      ? settings.belowAnchorPenalty
      : 0;
  return (
    placementBias(side, settings) +
    edgePenalty +
    overlapPenalty +
    crossingPenalty +
    distancePenalty +
    movementPenalty +
    sidePenalty +
    belowPenalty
  );
}

function choosePlacement(
  c: LabelCandidate,
  occupiedRects: LabelRect[],
  placedLeaders: LeaderSegment[],
  previous: LabelMemory | undefined,
  settings: LabelRuntimeSettings,
): { x: number; y: number; side: PlacementSide } {
  const aboveSides: PlacementSide[] =
    previous?.side !== undefined && isAbovePlacement(previous.side)
      ? [previous.side, "top", "topLeft", "topRight", "left", "right"]
      : ["top", "topLeft", "topRight", "left", "right"];
  if (c.labelKind === "siteElement") {
    return chooseBestPlacementFromSides(
      c,
      aboveSides,
      occupiedRects,
      placedLeaders,
      previous,
      settings,
    );
  }
  const sides: PlacementSide[] =
    previous?.side !== undefined && isAbovePlacement(previous.side)
      ? [
          previous.side,
          "top",
          "topLeft",
          "topRight",
          "left",
          "right",
          "bottom",
          "bottomLeft",
          "bottomRight",
        ]
      : [
          "top",
          "topLeft",
          "topRight",
          "left",
          "right",
          "bottom",
          "bottomLeft",
          "bottomRight",
        ];
  return chooseBestPlacementFromSides(
    c,
    sides,
    occupiedRects,
    placedLeaders,
    previous,
    settings,
  );
}

function chooseBestPlacementFromSides(
  c: LabelCandidate,
  sides: PlacementSide[],
  occupiedRects: LabelRect[],
  placedLeaders: LeaderSegment[],
  previous: LabelMemory | undefined,
  settings: LabelRuntimeSettings,
): { x: number; y: number; side: PlacementSide } {
  let best: { x: number; y: number; side: PlacementSide; score: number } | null =
    null;
  const seen = new Set<PlacementSide>();
  for (const side of sides) {
    if (seen.has(side)) continue;
    seen.add(side);
    const point = placementPoint(c, side, settings);
    const score = scorePlacement(
      c,
      side,
      point.x,
      point.y,
      point.edgePenalty,
      occupiedRects,
      placedLeaders,
      previous,
      settings,
    );
    if (!best || score < best.score) {
      best = { x: point.x, y: point.y, side, score };
    }
  }
  return best ?? {
    x: c.anchorX,
    y: c.anchorY - settings.pinGapPx - c.height / 2,
    side: "top",
  };
}

interface Props {
  sceneHandle: SceneHandle;
}

export function SceneLabels({ sceneHandle }: Props) {
  const { state } = useEditor();
  const { pages, currentIndex, targetIndex, transitionProgress } =
    usePageController();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Stable across frames: map `${layerId}:${displayName}` -> { chip, leader }.
  const elementsRef = useRef<
    Map<string, { chip: HTMLDivElement; leader: HTMLDivElement }>
  >(new Map());
  const removalTimersRef = useRef<Map<string, number>>(new Map());
  // Last rendered position per visible label key. Used for per-frame
  // smoothing and side hysteresis so labels do not swap slots just
  // because the camera moved a few pixels. Keys absent from this map on
  // a given frame are treated as "first appearance".
  const previousPositionsRef = useRef<Map<string, LabelMemory>>(new Map());

  // Mirror live-updating state into refs so the rAF subscription doesn't
  // need to re-bind whenever environment/page changes.
  const envRef = useRef(state.environment);
  envRef.current = state.environment;
  const page =
    targetIndex !== null && transitionProgress >= 0.92
      ? pages[targetIndex] ?? pages[currentIndex]
      : pages[currentIndex];
  const pageRef = useRef(page);
  pageRef.current = page;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Two sub-containers so all leaders paint UNDER all chips
    // regardless of which key was added first.
    const leadersDiv = document.createElement("div");
    leadersDiv.style.cssText = "position:absolute;inset:0;pointer-events:none;";
    const chipsDiv = document.createElement("div");
    chipsDiv.style.cssText = "position:absolute;inset:0;pointer-events:none;";
    container.appendChild(leadersDiv);
    container.appendChild(chipsDiv);

    const camera = sceneHandle.camera;
    const manager = sceneHandle.manager;

    // Scratch vectors reused per frame to avoid allocations.
    const anchor = new THREE.Vector3();
    const ndc = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");

    const off = sceneHandle.onTick(() => {
      const env = envRef.current;
      const p = pageRef.current;
      if (!p) return;
      const labelSettings = getLabelSettings(
        env.scene,
        labelSettingsPatchForRenderPreset(
          activeRenderPresetIdForPage(env, p),
          projectRenderPresets(env),
        ),
      );

      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.getWorldPosition(camPos);

      const candidates: LabelCandidate[] = [];

      if (labelSettings.enabled) {
        // Walk every registered layer group (skip terrain). Per-layer
        // dedupe by displayName so a hole's collar+trace+halo collapse
        // to one label.
        for (const [layerId, group] of manager.layerEntries()) {
          if (layerId === "terrain") continue;
          if (!group.visible) continue;
          const eff = effectiveStyle(env, p, layerId);
          if (eff.showLabels !== true) continue;
        // Label colours: split controls win, then legacy labelColor,
        // then layer color, then neutral defaults.
        const legacyLabelColor =
          (typeof eff.labelColor === "string" && eff.labelColor) ||
          (typeof eff.color === "string" && eff.color) ||
          "#e6e2dc";
        const labelKind = normalizeLabelKind(eff.labelKind);
        const configuredLabelStyle =
          env.scene?.gui?.labels?.styles?.[labelKind] ?? {};
        const defaultLabelStyle = labelVisualStyle(env.scene, labelKind);
        const labelTextColor =
          (typeof eff.labelTextColor === "string" && eff.labelTextColor) ||
          configuredLabelStyle.textColor ||
          (labelKind === "siteElement"
            ? legacyLabelColor
            : defaultLabelStyle.textColor);
        const labelPointerSide: LabelPointerSide =
          eff.labelPointerSide === "left" || eff.labelPointerSide === "right"
            ? eff.labelPointerSide
            : defaultLabelStyle.pointerSide;
        const labelPointerVisible =
          typeof eff.labelPointerVisible === "boolean"
            ? eff.labelPointerVisible
            : defaultLabelStyle.pointerVisible;
        const labelOutlineColor =
          typeof eff.labelOutlineColor === "string" && eff.labelOutlineColor
            ? eff.labelOutlineColor
            : configuredLabelStyle.outlineColor ||
              (labelKind === "siteElement"
                ? legacyLabelColor
                : defaultLabelStyle.outlineColor);
        const labelFillColor =
          typeof eff.labelFillColor === "string" && eff.labelFillColor
            ? eff.labelFillColor
            : configuredLabelStyle.fillColor ||
              (labelKind === "siteElement"
                ? null
                : defaultLabelStyle.fillColor);
        const labelTextOpacity =
          typeof eff.labelTextOpacity === "number"
            ? clamp(eff.labelTextOpacity, 0, 1)
            : defaultLabelStyle.textOpacity;
        const labelOutlineOpacity =
          typeof eff.labelOutlineOpacity === "number"
            ? clamp(eff.labelOutlineOpacity, 0, 1)
            : defaultLabelStyle.outlineOpacity;
        const labelFillOpacity =
          typeof eff.labelFillOpacity === "number"
            ? clamp(eff.labelFillOpacity, 0, 1)
            : defaultLabelStyle.fillOpacity;
        const labelFadeNearM = numberSetting(
          eff.labelFadeNearM,
          labelSettings.fadeNearM,
          0,
          150_000,
        );
        const labelFadeFarM = Math.max(
          labelFadeNearM + 1,
          numberSetting(
            eff.labelFadeFarM,
            labelSettings.fadeFarM,
            1,
            250_000,
          ),
        );
        const anchorsByLabel = chooseLabelAnchors(group);
          for (const [dn, obj] of anchorsByLabel) {
          const key = `${layerId}:${dn}`;

          getLabelAnchor(obj, anchor);
          ndc.copy(anchor).project(camera);
          // Frustum cull with a 20% margin so labels for features just
          // off the side of the frame still render with a leader to
          // their off-screen anchor.
          if (ndc.z < -1 || ndc.z > 1) continue;
          if (
            ndc.x < -labelSettings.frustumMargin ||
            ndc.x > labelSettings.frustumMargin ||
            ndc.y < -labelSettings.frustumMargin ||
            ndc.y > labelSettings.frustumMargin
          )
            continue;

          const ax = (ndc.x * 0.5 + 0.5) * w;
          const ay = (1 - (ndc.y * 0.5 + 0.5)) * h;
          const dist = camPos.distanceTo(anchor);
          // Linear fade between near (full) and far (gone).
          const fade =
            dist <= labelFadeNearM
              ? 1
              : dist >= labelFadeFarM
                ? 0
                : 1 -
                  (dist - labelFadeNearM) /
                    Math.max(1, labelFadeFarM - labelFadeNearM);
          if (fade <= 0) continue;

          const size = measureLabelSize(dn, labelKind, measureContext);
            candidates.push({
            key,
            label: dn,
            layerId,
            anchorX: ax,
            anchorY: ay,
            // labelX/Y get filled in by the placement solver below.
            labelX: ax,
            labelY: ay - labelSettings.pinGapPx - size.height / 2,
            width: size.width,
            height: size.height,
            opacity: fade,
            dist,
            priority: labelPriority(layerId, labelKind),
            placementSide: "top",
            labelTextColor,
            labelOutlineColor,
            labelFillColor,
            labelTextOpacity,
            labelOutlineOpacity,
            labelFillOpacity,
            labelKind,
            labelPointerSide,
            labelPointerVisible,
            });
          }
        }
      }

      const finalVisible: LabelCandidate[] = [];
      const occupiedRects: LabelRect[] = [];
      const placedLeaderSegments: LeaderSegment[] = [];
      const previousPositions = previousPositionsRef.current;
      const maxSiteLabels =
        w < 760
          ? labelSettings.maxSiteLabelsMobile
          : labelSettings.maxSiteLabelsDesktop;
      const calloutCandidates = candidates.filter(
        (c) => c.labelKind !== "siteElement",
      );
      const siteCandidates = candidates
        .filter((c) => c.labelKind === "siteElement")
        .sort(
          (a, b) =>
            b.priority - a.priority ||
            a.dist - b.dist ||
            a.anchorX - b.anchorX ||
            a.anchorY - b.anchorY,
        )
        .slice(0, maxSiteLabels);
      const layoutCandidates = [...calloutCandidates, ...siteCandidates].sort(
        (a, b) =>
          b.priority - a.priority ||
          a.dist - b.dist ||
          a.anchorX - b.anchorX ||
          a.anchorY - b.anchorY,
      );

      for (const c of layoutCandidates) {
        const placement = choosePlacement(
          c,
          occupiedRects,
          placedLeaderSegments,
          previousPositions.get(c.key),
          labelSettings,
        );
        c.labelX = placement.x;
        c.labelY = placement.y;
        c.placementSide = placement.side;
        occupiedRects.push(
          labelRect(
            c.labelX,
            c.labelY,
            c.width,
            c.height,
            labelSettings.collisionPadPx,
          ),
        );
        if (c.labelKind === "siteElement" && c.labelPointerVisible) {
          placedLeaderSegments.push(
            leaderSegmentForPlacement(
              c,
              c.placementSide,
              c.labelX,
              c.labelY,
            ),
          );
        }
        finalVisible.push(c);
      }

      // DOM diff: drop labels no longer visible, place/update the rest.
      const elements = elementsRef.current;
      const visibleKeys = new Set(finalVisible.map((v) => v.key));
      for (const [key, pair] of elements) {
        if (!visibleKeys.has(key)) {
          if (!removalTimersRef.current.has(key)) {
            pair.chip.style.opacity = "0";
            pair.leader.style.opacity = "0";
            const timer = window.setTimeout(() => {
              if (elements.get(key) === pair) {
                pair.chip.remove();
                pair.leader.remove();
                elements.delete(key);
                previousPositions.delete(key);
              }
              removalTimersRef.current.delete(key);
            }, 220);
            removalTimersRef.current.set(key, timer);
          }
        }
      }
      const orderedVisible = [...finalVisible].sort(
        (a, b) => a.anchorX - b.anchorX || a.labelY - b.labelY,
      );
      for (const v of orderedVisible) {
        let pair = elements.get(v.key);
        const isNew = !pair;
        if (!pair) {
          pair = {
            chip: createChipElement(v.label),
            leader: createLeaderElement(),
          };
          pair.chip.style.opacity = "0";
          pair.leader.style.opacity = "0";
          chipsDiv.appendChild(pair.chip);
          leadersDiv.appendChild(pair.leader);
          elements.set(v.key, pair);
        }
        const removalTimer = removalTimersRef.current.get(v.key);
        if (removalTimer !== undefined) {
          window.clearTimeout(removalTimer);
          removalTimersRef.current.delete(v.key);
        }
        pair.chip.onclick = null;
        // Lerp the displayed position toward the solver's target.
        // First appearance: snap to target so a fresh label doesn't
        // glide in from a default location.
        const prev = previousPositions.get(v.key);
        let renderedX: number;
        let renderedY: number;
        if (v.labelKind !== "siteElement" || !prev || isNew) {
          renderedX = v.labelX;
          renderedY = v.labelY;
        } else {
          renderedX = prev.x + (v.labelX - prev.x) * labelSettings.followLerp;
          renderedY = prev.y + (v.labelY - prev.y) * labelSettings.followLerp;
          const lagX = v.labelX - renderedX;
          const lagY = v.labelY - renderedY;
          const lag = Math.hypot(lagX, lagY);
          if (lag > labelSettings.maxSpringPx) {
            const scale = labelSettings.maxSpringPx / Math.max(0.001, lag);
            renderedX = v.labelX - lagX * scale;
            renderedY = v.labelY - lagY * scale;
          }
        }
        previousPositions.set(v.key, {
          x: renderedX,
          y: renderedY,
          side: v.placementSide,
        });

        pair.chip.style.width = `${v.width.toFixed(1)}px`;
        // Chip centre sits at (renderedX, renderedY).
        pair.chip.style.transform =
          `translate(${renderedX.toFixed(1)}px,${renderedY.toFixed(1)}px) ` +
          `translate(-50%,-50%)`;
        pair.chip.style.opacity = v.opacity.toFixed(3);
        applyChipColor(
          pair.chip,
          v.labelTextColor,
          v.labelOutlineColor,
          v.labelFillColor,
          v.labelTextOpacity,
          v.labelOutlineOpacity,
          v.labelFillOpacity,
        );
        applyChipPresentation(pair.chip, v.labelKind);
        if (v.labelKind !== "siteElement") {
          placeLandTitlePointer(
            pair.chip,
            v.anchorX,
            v.anchorY,
            renderedX,
            renderedY,
            v.width,
            v.height,
            v.labelPointerSide,
            v.labelPointerVisible,
          );
        }
        pair.leader.style.background = v.labelOutlineColor ?? v.labelTextColor;
        if (v.labelKind !== "siteElement" || !v.labelPointerVisible) {
          pair.leader.style.opacity = "0";
        } else {
          const leaderEnd = leaderEndpointForPlacement(
            v,
            v.placementSide,
            renderedX,
            renderedY,
          );
          placeLeader(
            pair.leader,
            v.anchorX,
            v.anchorY,
            leaderEnd.x,
            leaderEnd.y,
            labelSettings.leaderVisibleThresholdPx,
          );
          // Leader inherits chip opacity so distance fade affects both.
          const baseOp = parseFloat(pair.leader.style.opacity || "1");
          if (baseOp > 0) {
            pair.leader.style.opacity = (v.opacity * 0.85).toFixed(3);
          }
        }
      }
    });

    return () => {
      off();
      for (const timer of removalTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      removalTimersRef.current.clear();
      // Tear down DOM on unmount.
      for (const pair of elementsRef.current.values()) {
        pair.chip.remove();
        pair.leader.remove();
      }
      elementsRef.current.clear();
      previousPositionsRef.current.clear();
      leadersDiv.remove();
      chipsDiv.remove();
    };
  }, [sceneHandle]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 18, // below sidebar (20) and toggle (25), above viewport
        pointerEvents: "none",
      }}
    />
  );
}
