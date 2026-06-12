import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../editor/EditorContext";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
} from "../editor/styles";
import {
  LEGEND_BOTTOM_EDGE_OFFSET_PX,
  LEGEND_PAGE_EDGE_MARGIN_PX,
  QUICK_LEGEND_INACTIVE_BACKGROUND,
  compactQuickLegendIconButtonBaseStyle,
  compactQuickLegendPrimaryButtonBaseStyle,
  compactQuickLegendRowStyle,
  resolveLegendTextColors,
  transparentLegendPanelStyle,
} from "./legendStyles";
import {
  effectiveStyle,
  effectiveVisibility,
  resolveEnvironmentForPage,
} from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle, PresentationPage } from "../pages/types";
import { selectedLegendAuthoringPage } from "./legendAuthoringTarget";
import { easeProgress } from "../scene/transitions/transitionStyles";
import { UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID } from "../projectModules/utahForge/layerIds";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const MT_CELL_POINTS_MODE_TRANSITION_MS = 1500;
type MtCellPointsMode = "full-cloud" | "spectrum";

interface MtCellPointsModeTransitionScopeArgs {
  projectSlug: string;
  editingEnvironment: boolean;
  pageId: string | null;
  writePageId: string | null;
  layerId: string;
}

const DEFAULT_LOW = "#2cc9ff";
const DEFAULT_MID = "#f8dd6d";
const DEFAULT_HIGH = "#ff637a";
const DEFAULT_MIN = 0.139879;
const DEFAULT_MAX = 3.937122;
const DEFAULT_SOURCE_MIN = -2;
const DEFAULT_SOURCE_MAX = 4.5;
const HANDLE_GAP = 0.01;
const EDGE_LINE_MAX_WIDTH_PX = 8;
const LEGEND_HANDLE_FILL = "#f4f5f7";
const EDGE_POPOVER_WIDTH_PX = 300;
const EDGE_POPOVER_MARGIN_PX = 12;
const rootBaseStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
};

const rampStyle: CSSProperties = {
  height: 13,
  marginTop: 12,
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.22)",
  overflow: "hidden",
};

const rampWrapStyle: CSSProperties = {
  position: "relative",
  height: 28,
  marginTop: 18,
  touchAction: "none",
};

const rampMaskStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.62)",
  backdropFilter: "saturate(60%)",
};

const ticksStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  marginTop: 8,
  fontSize: 10,
  lineHeight: 1.25,
  fontVariantNumeric: "tabular-nums",
};

const tickMiddleStyle: CSSProperties = {
  textAlign: "center",
};

const tickRightStyle: CSSProperties = {
  textAlign: "right",
};

const fineControlLabelStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 2,
  fontSize: 9,
  lineHeight: 1.1,
  textAlign: "center",
};

const fineControlRangeStyle: CSSProperties = {
  width: "100%",
  accentColor: "#ff2a2a",
};

const edgePopoverStyle: CSSProperties = {
  position: "fixed",
  width: EDGE_POPOVER_WIDTH_PX,
  maxWidth: `calc(100vw - ${EDGE_POPOVER_MARGIN_PX * 2}px)`,
  maxHeight: `calc(100vh - ${EDGE_POPOVER_MARGIN_PX * 2}px)`,
  overflowY: "auto",
  zIndex: 8,
  padding: 12,
  boxSizing: "border-box",
  background: "rgba(12, 15, 18, 0.88)",
  border: FROSTED_HAIRLINE,
  borderRadius: 8,
  boxShadow: "0 18px 44px rgba(0, 0, 0, 0.38)",
  backdropFilter: "blur(20px) saturate(145%)",
  WebkitBackdropFilter: "blur(20px) saturate(145%)",
};

const edgePopoverHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 10,
  fontSize: 10,
  fontWeight: 700,
};

const edgePopoverGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 9,
};

const edgePopoverFullRowStyle: CSSProperties = {
  gridColumn: "1 / -1",
};

const closeButtonStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.24)",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.08)",
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 9,
  padding: "3px 7px",
  cursor: "pointer",
};

const mtCellPointsHeaderStyle: CSSProperties = {
  ...compactQuickLegendRowStyle,
  marginBottom: 10,
};

const mtCellPointsPrimaryButtonStyle: CSSProperties = {
  ...compactQuickLegendPrimaryButtonBaseStyle,
  width: 164,
};

function mtCellPointsPrimaryStyle(visible: boolean): CSSProperties {
  return {
    ...mtCellPointsPrimaryButtonStyle,
    background: visible ? "#f4f5f7" : QUICK_LEGEND_INACTIVE_BACKGROUND,
    opacity: visible ? 1 : 0.82,
    cursor: "pointer",
  };
}

function mtCellPointsIconStyle(
  active: boolean,
  available: boolean,
): CSSProperties {
  return {
    ...compactQuickLegendIconButtonBaseStyle,
    background: !available
      ? QUICK_LEGEND_INACTIVE_BACKGROUND
      : active
        ? "#f4f5f7"
        : "rgba(244, 245, 247, 0.46)",
    opacity: available ? 1 : 0.68,
    cursor: available ? "pointer" : "default",
  };
}

function MtCellPointsIcon({
  kind,
}: {
  kind: "full-cloud" | "spectrum" | "controls";
}) {
  if (kind === "full-cloud") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 18h10a4 4 0 0 0 .5-7.97 6 6 0 0 0-11.11-1.9A4.8 4.8 0 0 0 7 18Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "spectrum") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 17h16M6 13l3-5 4 7 3-5 2 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h8M16 17h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="7" r="2" fill="currentColor" />
      <circle cx="8" cy="12" r="2" fill="currentColor" />
      <circle cx="14" cy="17" r="2" fill="currentColor" />
    </svg>
  );
}

function styleString(
  style: EditableStyle,
  field: keyof EditableStyle,
  fallback: string,
): string {
  const value = style[field];
  return typeof value === "string" ? value : fallback;
}

function styleNumber(
  style: EditableStyle,
  field: keyof EditableStyle,
  fallback: number,
): number {
  const value = style[field];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function styleBoolean(
  style: EditableStyle,
  field: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[field];
  return typeof value === "boolean" ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function edgePopoverPositionForLegend(
  legend: HTMLElement | null,
  popover: HTMLElement | null,
): { left: number; top: number } {
  const margin = EDGE_POPOVER_MARGIN_PX;
  const viewportWidth =
    typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight =
    typeof window === "undefined" ? 800 : window.innerHeight;
  const legendRect = legend?.getBoundingClientRect();
  const popoverWidth = Math.min(
    EDGE_POPOVER_WIDTH_PX,
    Math.max(220, viewportWidth - margin * 2),
  );
  const popoverHeight = Math.min(
    popover?.getBoundingClientRect().height ?? 260,
    Math.max(180, viewportHeight - margin * 2),
  );
  const rightOfLegend = (legendRect?.right ?? margin) + 10;
  const belowTopControls = (legendRect?.top ?? margin) + 96;
  return {
    left: clamp(rightOfLegend, margin, viewportWidth - popoverWidth - margin),
    top: clamp(belowTopControls, margin, viewportHeight - popoverHeight - margin),
  };
}

function formatLogValue(value: number): string {
  return value.toFixed(2);
}

function formatOhmMFromLog(logValue: number): string {
  const value = 10 ** logValue;
  if (!Number.isFinite(value)) return "n/a";
  if (value >= 1000) return `${Math.round(value).toLocaleString()} Ohm-m`;
  if (value >= 100) return `${Math.round(value)} Ohm-m`;
  if (value >= 10) return `${value.toFixed(1)} Ohm-m`;
  return `${value.toFixed(2)} Ohm-m`;
}

function percentInRange(value: number, min: number, max: number): number {
  const range = Math.max(0.000001, max - min);
  return clamp(((value - min) / range) * 100, 0, 100);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const SCALAR_LEGEND_SLIDE_FIELDS: readonly (keyof EditableStyle)[] = [
  "scalarBlendMin",
  "scalarBlendMax",
  "scalarDisplayMin",
  "scalarDisplayMax",
  "scalarFocusMin",
  "scalarFocusMax",
  "scalarMidpoint",
  "scalarContrast",
  "scalarEdgeLowerValue",
  "scalarEdgeUpperValue",
  "scalarEdgeLineWidth",
  "scalarEdgeAverage",
  "scalarEdgeFillOffset",
  "scalarNoiseThreshold",
];

function spectralHandleStyle(leftPercent: number, trimHandle: boolean): CSSProperties {
  const width = 5;
  const height = trimHandle ? 16 : 14;
  return {
    position: "absolute",
    left: `${leftPercent}%`,
    top: 20 - height,
    width,
    height,
    borderRadius: 999,
    transform: "translateX(-50%)",
    background: LEGEND_HANDLE_FILL,
    border: "1px solid rgba(0, 0, 0, 0.48)",
    padding: 0,
    cursor: "ew-resize",
    pointerEvents: "auto",
    zIndex: trimHandle ? 4 : 3,
    boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.32)",
    touchAction: "none",
  };
}

function resolvedScalarLegendNumbers(
  style: EditableStyle,
): Record<(typeof SCALAR_LEGEND_SLIDE_FIELDS)[number], number> {
  const colorMin = styleNumber(style, "scalarDisplayMin", DEFAULT_MIN);
  const rawColorMax = styleNumber(style, "scalarDisplayMax", DEFAULT_MAX);
  const colorMax = Math.max(rawColorMax, colorMin + 0.000001);
  const sourceMin = Math.min(DEFAULT_SOURCE_MIN, colorMin);
  const sourceMax = Math.max(DEFAULT_SOURCE_MAX, colorMax);
  const trimMin = clamp(
    styleNumber(style, "scalarFocusMin", sourceMin),
    sourceMin,
    sourceMax,
  );
  const trimMax = clamp(
    styleNumber(style, "scalarFocusMax", sourceMax),
    trimMin,
    sourceMax,
  );
  const blendMin = clamp(
    styleNumber(style, "scalarBlendMin", colorMin),
    trimMin,
    Math.max(trimMin, trimMax - HANDLE_GAP),
  );
  const blendMax = clamp(
    styleNumber(style, "scalarBlendMax", colorMax),
    blendMin + HANDLE_GAP,
    trimMax,
  );
  const edgeLineWidth = clamp(
    styleNumber(
      style,
      "scalarEdgeLineWidth",
      styleNumber(style, "scalarEdgeHighlight", 0) * EDGE_LINE_MAX_WIDTH_PX,
    ),
    0,
    EDGE_LINE_MAX_WIDTH_PX,
  );
  return {
    scalarBlendMin: blendMin,
    scalarBlendMax: blendMax,
    scalarDisplayMin: colorMin,
    scalarDisplayMax: colorMax,
    scalarFocusMin: trimMin,
    scalarFocusMax: trimMax,
    scalarMidpoint: clamp(styleNumber(style, "scalarMidpoint", 0.5), 0.05, 0.95),
    scalarContrast: clamp(styleNumber(style, "scalarContrast", 1), 0.35, 3),
    scalarEdgeLowerValue: clamp(
      styleNumber(style, "scalarEdgeLowerValue", (trimMin + blendMin) / 2),
      trimMin,
      Math.max(trimMin, blendMin),
    ),
    scalarEdgeUpperValue: clamp(
      styleNumber(style, "scalarEdgeUpperValue", (blendMax + trimMax) / 2),
      Math.min(blendMax, trimMax),
      trimMax,
    ),
    scalarEdgeLineWidth: edgeLineWidth,
    scalarEdgeAverage: clamp(styleNumber(style, "scalarEdgeAverage", 0.45), 0, 1),
    scalarEdgeFillOffset: clamp(
      styleNumber(style, "scalarEdgeFillOffset", 0),
      -1,
      1,
    ),
    scalarNoiseThreshold: clamp(styleNumber(style, "scalarNoiseThreshold", 0), 0, 1),
  };
}

function interpolatedScalarLegendStyle(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  amount: number,
): EditableStyle {
  const t = clamp(amount, 0, 1);
  if (t >= 0.999) return toStyle;
  const from = resolvedScalarLegendNumbers(fromStyle);
  const to = resolvedScalarLegendNumbers(toStyle);
  const next: EditableStyle = { ...toStyle };
  for (const field of SCALAR_LEGEND_SLIDE_FIELDS) {
    (next as Record<string, unknown>)[field] = lerp(from[field], to[field], t);
  }
  return next;
}

type SpectralHandle = "blendMin" | "focusMin" | "focusMax" | "blendMax";
type EdgeHandle = "edgeLower" | "edgeUpper";

function displayPercentForOverlappedHandles(
  percent: number,
  direction: -1 | 1,
  overlaps: boolean,
): number {
  return overlaps ? clamp(percent + direction * 1.65, 0, 100) : percent;
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return [255, 255, 255];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb.map((value) => Math.round(value)).join(", ")})`;
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function scalarCssColorAt(
  value: number,
  colorMin: number,
  colorMax: number,
  midpoint: number,
  low: string,
  mid: string,
  high: string,
): string {
  const t = clamp((value - colorMin) / Math.max(0.000001, colorMax - colorMin), 0, 1);
  const midT = clamp(midpoint, 0.05, 0.95);
  if (t <= midT) {
    return rgbToCss(mixRgb(hexToRgb(low), hexToRgb(mid), t / midT));
  }
  return rgbToCss(mixRgb(hexToRgb(mid), hexToRgb(high), (t - midT) / (1 - midT)));
}

function edgeFillRangeStyle(value: number): CSSProperties {
  return {
    ...fineControlRangeStyle,
    accentColor: value < 0 ? "#f4f5f7" : "#1b1e22",
    background:
      "linear-gradient(90deg, #ffffff 0%, rgba(255, 255, 255, 0.18) 50%, #050607 100%)",
    borderRadius: 999,
  };
}

function edgeHandleStyle(leftPercent: number, color: string): CSSProperties {
  return {
    position: "absolute",
    left: `${leftPercent}%`,
    top: -8,
    width: 9,
    height: 9,
    borderRadius: 2,
    transform: "translateX(-50%) rotate(45deg)",
    background: color,
    border: "1px solid rgba(255, 255, 255, 0.86)",
    padding: 0,
    cursor: "ew-resize",
    pointerEvents: "auto",
    zIndex: 5,
    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.5)",
    touchAction: "none",
  };
}

function fullCloudScalarLegendStyle(style: EditableStyle): EditableStyle {
  const colorMin = styleNumber(style, "scalarDisplayMin", DEFAULT_MIN);
  const rawColorMax = styleNumber(style, "scalarDisplayMax", DEFAULT_MAX);
  const colorMax = Math.max(rawColorMax, colorMin + 0.000001);
  const sourceMin = Math.min(DEFAULT_SOURCE_MIN, colorMin);
  const sourceMax = Math.max(DEFAULT_SOURCE_MAX, colorMax);
  return {
    ...style,
    scalarFocusMin: sourceMin,
    scalarBlendMin: sourceMin,
    scalarBlendMax: sourceMax,
    scalarFocusMax: sourceMax,
    scalarNoiseThreshold: 0,
    scalarEdgeLineWidth: 0,
  };
}

function mtCellPointsModeTransitionScopeKey({
  projectSlug,
  editingEnvironment,
  pageId,
  writePageId,
  layerId,
}: MtCellPointsModeTransitionScopeArgs): string {
  const pageScope = editingEnvironment ? "environment" : (pageId ?? "no-page");
  const writeScope = writePageId ?? "no-write-page";
  return `${projectSlug}:${pageScope}:${writeScope}:${layerId}`;
}

export function ResistivityLegend({
  stacked = false,
  pageOverride = null,
  testIdsEnabled = true,
}: {
  stacked?: boolean;
  pageOverride?: PresentationPage | null;
  testIdsEnabled?: boolean;
}) {
  const {
    state,
    sceneHandle,
    setEnvLayerStyle,
    toggleEnvDefaultVisible,
    setPageLayerOverride,
    setPageVisibilityOverride,
    canApplyLiveSceneEdits,
  } = useEditor();
  const { pages, currentIndex, transitionFrame } = usePageController();
  const rootRef = useRef<HTMLElement | null>(null);
  const rampRef = useRef<HTMLDivElement | null>(null);
  const edgePopoverRef = useRef<HTMLDivElement | null>(null);
  const modeTransitionFrameRef = useRef<number | null>(null);
  const modeTransitionTokenRef = useRef(0);
  const modeTransitionScopeKeyRef = useRef<string | null>(null);
  const [edgePopoverOpen, setEdgePopoverOpen] = useState(false);
  const [modeTransitionTarget, setModeTransitionTarget] =
    useState<MtCellPointsMode | null>(null);
  const [edgePopoverPosition, setEdgePopoverPosition] = useState({
    left: EDGE_POPOVER_MARGIN_PX,
    top: EDGE_POPOVER_MARGIN_PX,
  });
  useEffect(() => {
    if (!edgePopoverOpen) return;
    const update = () => {
      setEdgePopoverPosition(
        edgePopoverPositionForLegend(rootRef.current, edgePopoverRef.current),
      );
    };
    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
    };
  }, [edgePopoverOpen]);
  useEffect(() => {
    return () => {
      modeTransitionTokenRef.current += 1;
      if (modeTransitionFrameRef.current !== null) {
        window.cancelAnimationFrame(modeTransitionFrameRef.current);
        modeTransitionFrameRef.current = null;
      }
    };
  }, []);

  const sourceIndex = transitionFrame.sourceIndex;
  const targetIndex = transitionFrame.targetIndex;
  const transitionActive = transitionFrame.active;
  const layerId = UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID;
  const controllerPage =
    pageOverride ??
    pages[targetIndex ?? sourceIndex] ??
    pages[sourceIndex] ??
    pages[currentIndex];
  const editingEnvironment = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const authoringPage = selectedLegendAuthoringPage(state);
  const selectedPage =
    !pageOverride &&
    !editingEnvironment &&
    !transitionActive &&
    state.selectedPageId
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page =
    pageOverride ??
    (transitionActive && targetIndex !== null
      ? controllerPage
      : selectedPage ?? controllerPage);
  const writePage = authoringPage ?? page;
  const modeTransitionScopeKey = mtCellPointsModeTransitionScopeKey({
    projectSlug: state.projectSlug,
    editingEnvironment,
    pageId: page?.id ?? null,
    writePageId: writePage?.id ?? null,
    layerId,
  });
  useLayoutEffect(() => {
    const previousScopeKey = modeTransitionScopeKeyRef.current;
    modeTransitionScopeKeyRef.current = modeTransitionScopeKey;
    if (
      previousScopeKey === null ||
      previousScopeKey === modeTransitionScopeKey
    ) {
      return;
    }
    modeTransitionTokenRef.current += 1;
    if (modeTransitionFrameRef.current !== null) {
      window.cancelAnimationFrame(modeTransitionFrameRef.current);
      modeTransitionFrameRef.current = null;
    }
    setModeTransitionTarget(null);
    setEdgePopoverOpen(false);
  }, [modeTransitionScopeKey]);

  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;
  const legendTextColors = resolveLegendTextColors(
    state.environment.scene?.gui?.overlay,
  );
  if (!page) return null;
  const pageEnvironment = resolveEnvironmentForPage(
    state.environment,
    state.pages,
    page,
  );

  const visible = editingEnvironment
    ? new Set(state.environment.defaultVisibleLayers)
    : effectiveVisibility(pageEnvironment, page);
  const pointCloudVisible = visible.has(layerId);
  const pointCloudExplicitPageOverride =
    writePage?.visibilityOverrides?.[layerId] !== undefined;
  if (
    !pointCloudVisible &&
    !pointCloudExplicitPageOverride &&
    !editingEnvironment
  ) {
    return null;
  }

  const targetStyle = editingEnvironment
    ? state.environment.layerStyles[layerId] ?? {}
    : effectiveStyle(pageEnvironment, page, layerId);
  const currentPage =
    pageOverride ?? pages[sourceIndex] ?? pages[currentIndex] ?? page;
  const currentPageEnvironment = resolveEnvironmentForPage(
    state.environment,
    state.pages,
    currentPage,
  );
  const currentStyle = editingEnvironment
    ? targetStyle
    : effectiveStyle(currentPageEnvironment, currentPage, layerId);
  const style =
    !pageOverride && !editingEnvironment && transitionActive && targetIndex !== null
      ? interpolatedScalarLegendStyle(
          currentStyle,
          targetStyle,
          transitionFrame.progress,
        )
      : targetStyle;
  const targetMode: MtCellPointsMode = styleBoolean(
    targetStyle,
    "scalarLegendVisible",
    true,
  )
    ? "spectrum"
    : "full-cloud";
  const displayedMode = modeTransitionTarget ?? targetMode;
  const rampBodyVisible = pointCloudVisible;
  const controlsAvailable =
    pointCloudVisible &&
    targetMode === "spectrum" &&
    modeTransitionTarget === null;

  const lowColor = styleString(style, "scalarColorLow", DEFAULT_LOW);
  const midColor = styleString(style, "scalarColorMid", DEFAULT_MID);
  const highColor = styleString(style, "scalarColorHigh", DEFAULT_HIGH);
  const colorMin = styleNumber(style, "scalarDisplayMin", DEFAULT_MIN);
  const rawColorMax = styleNumber(style, "scalarDisplayMax", DEFAULT_MAX);
  const colorMax = Math.max(rawColorMax, colorMin + 0.000001);
  const sourceMin = Math.min(DEFAULT_SOURCE_MIN, colorMin);
  const sourceMax = Math.max(DEFAULT_SOURCE_MAX, colorMax);
  const trimMin = clamp(
    styleNumber(style, "scalarFocusMin", sourceMin),
    sourceMin,
    sourceMax,
  );
  const trimMax = clamp(
    styleNumber(style, "scalarFocusMax", sourceMax),
    trimMin,
    sourceMax,
  );
  const rawBlendMin = styleNumber(style, "scalarBlendMin", colorMin);
  const rawBlendMax = styleNumber(style, "scalarBlendMax", colorMax);
  const blendMin = clamp(
    rawBlendMin,
    trimMin,
    Math.max(trimMin, trimMax - HANDLE_GAP),
  );
  const blendMax = clamp(rawBlendMax, blendMin + HANDLE_GAP, trimMax);
  const midpoint = clamp(styleNumber(style, "scalarMidpoint", 0.5), 0.05, 0.95);
  const edgeLineWidth = clamp(
    styleNumber(
      style,
      "scalarEdgeLineWidth",
      styleNumber(style, "scalarEdgeHighlight", 0) * EDGE_LINE_MAX_WIDTH_PX,
    ),
    0,
    EDGE_LINE_MAX_WIDTH_PX,
  );
  const noiseThreshold = clamp(
    styleNumber(style, "scalarNoiseThreshold", 0),
    0,
    1,
  );
  const thresholdControlsActive = displayedMode === "spectrum";
  const edgeAverage = clamp(styleNumber(style, "scalarEdgeAverage", 0.45), 0, 1);
  const edgeFillOffset = clamp(
    styleNumber(style, "scalarEdgeFillOffset", 0),
    -1,
    1,
  );
  const edgeLineStyle =
    style.scalarEdgeLineStyle === "dashed" ? "dashed" : "solid";
  const edgeLowerValue = clamp(
    styleNumber(style, "scalarEdgeLowerValue", (trimMin + blendMin) / 2),
    trimMin,
    Math.max(trimMin, blendMin),
  );
  const edgeUpperValue = clamp(
    styleNumber(style, "scalarEdgeUpperValue", (blendMax + trimMax) / 2),
    Math.min(blendMax, trimMax),
    trimMax,
  );
  const edgeLowerPercent = percentInRange(edgeLowerValue, sourceMin, sourceMax);
  const edgeUpperPercent = percentInRange(edgeUpperValue, sourceMin, sourceMax);
  const edgeLowerColor = scalarCssColorAt(
    edgeLowerValue,
    colorMin,
    colorMax,
    midpoint,
    lowColor,
    midColor,
    highColor,
  );
  const edgeUpperColor = scalarCssColorAt(
    edgeUpperValue,
    colorMin,
    colorMax,
    midpoint,
    lowColor,
    midColor,
    highColor,
  );
  const midValue = colorMin + (colorMax - colorMin) * midpoint;
  const colorMinPercent = percentInRange(colorMin, sourceMin, sourceMax);
  const colorMaxPercent = percentInRange(colorMax, sourceMin, sourceMax);
  const trimMinPercent = percentInRange(trimMin, sourceMin, sourceMax);
  const trimMaxPercent = percentInRange(trimMax, sourceMin, sourceMax);
  const blendMinPercent = percentInRange(blendMin, sourceMin, sourceMax);
  const blendMaxPercent = percentInRange(blendMax, sourceMin, sourceMax);
  const rampMidPercent =
    colorMinPercent + (colorMaxPercent - colorMinPercent) * midpoint;
  const lowOverlap = Math.abs(trimMinPercent - blendMinPercent) < 1.2;
  const highOverlap = Math.abs(trimMaxPercent - blendMaxPercent) < 1.2;
  const setSpectralValue = (handle: SpectralHandle, value: number) => {
    let nextTrimMin = trimMin;
    let nextBlendMin = blendMin;
    let nextBlendMax = blendMax;
    let nextTrimMax = trimMax;

    if (handle === "blendMin") {
      nextBlendMin = clamp(value, nextTrimMin, nextBlendMax - HANDLE_GAP);
    } else if (handle === "blendMax") {
      nextBlendMax = clamp(value, nextBlendMin + HANDLE_GAP, nextTrimMax);
    } else if (handle === "focusMin") {
      nextTrimMin = clamp(value, sourceMin, nextTrimMax - HANDLE_GAP);
      if (nextBlendMin < nextTrimMin) nextBlendMin = nextTrimMin;
      if (nextBlendMax < nextBlendMin + HANDLE_GAP) {
        nextBlendMax = Math.min(nextTrimMax, nextBlendMin + HANDLE_GAP);
      }
    } else {
      nextTrimMax = clamp(value, nextTrimMin + HANDLE_GAP, sourceMax);
      if (nextBlendMax > nextTrimMax) nextBlendMax = nextTrimMax;
      if (nextBlendMin > nextBlendMax - HANDLE_GAP) {
        nextBlendMin = Math.max(nextTrimMin, nextBlendMax - HANDLE_GAP);
      }
    }

    const patch: Partial<EditableStyle> = {
      scalarFocusMin: nextTrimMin,
      scalarFocusMax: nextTrimMax,
      scalarBlendMin: nextBlendMin,
      scalarBlendMax: nextBlendMax,
    };
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(layerId, { ...style, ...patch });
    }
    if (editingEnvironment) {
      setEnvLayerStyle(layerId, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, layerId, patch);
    }
  };
  const setScalarRenderPatch = (patch: Partial<EditableStyle>) => {
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(layerId, { ...style, ...patch });
    }
    if (editingEnvironment) {
      setEnvLayerStyle(layerId, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, layerId, patch);
    }
  };
  const setPointCloudVisible = (nextVisible: boolean) => {
    if (!nextVisible) setEdgePopoverOpen(false);
    if (editingEnvironment) {
      const currentlyDefaultVisible =
        state.environment.defaultVisibleLayers.includes(layerId);
      if (currentlyDefaultVisible !== nextVisible) {
        toggleEnvDefaultVisible(layerId);
      }
      return;
    }
    if (writePage) {
      setPageVisibilityOverride(writePage.id, layerId, nextVisible);
    }
  };
  const persistMtCellPointsMode = (mode: MtCellPointsMode) => {
    const patch: Partial<EditableStyle> = {
      scalarLegendVisible: mode === "spectrum",
      scalarInclusionMode: mode === "spectrum" ? "thresholded" : "all-valid",
    };
    if (editingEnvironment) {
      setEnvLayerStyle(layerId, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, layerId, patch);
    }
  };
  const applyLiveMtCellPointsStyle = (nextStyle: EditableStyle) => {
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(layerId, nextStyle);
    }
  };
  const setMtCellPointsMode = (nextMode: MtCellPointsMode) => {
    if (!pointCloudVisible || nextMode === displayedMode) return;
    if (modeTransitionFrameRef.current !== null) {
      window.cancelAnimationFrame(modeTransitionFrameRef.current);
      modeTransitionFrameRef.current = null;
    }
    const transitionToken = modeTransitionTokenRef.current + 1;
    modeTransitionTokenRef.current = transitionToken;
    const transitionScopeKey =
      modeTransitionScopeKeyRef.current ?? modeTransitionScopeKey;
    setEdgePopoverOpen(false);
    setModeTransitionTarget(nextMode);

    const authoredSpectrumStyle: EditableStyle = {
      ...style,
      scalarLegendVisible: true,
      scalarInclusionMode: "thresholded",
    };
    const fullCloudPreviewStyle: EditableStyle = {
      ...fullCloudScalarLegendStyle(style),
      scalarLegendVisible: true,
      scalarInclusionMode: "thresholded",
    };
    const fromStyle =
      nextMode === "spectrum" ? fullCloudPreviewStyle : authoredSpectrumStyle;
    const toStyle =
      nextMode === "spectrum" ? authoredSpectrumStyle : fullCloudPreviewStyle;
    const startMs = window.performance.now();
    const tick = (nowMs: number) => {
      if (
        transitionToken !== modeTransitionTokenRef.current ||
        transitionScopeKey !== modeTransitionScopeKeyRef.current
      ) {
        modeTransitionFrameRef.current = null;
        return;
      }
      const progress = clamp(
        (nowMs - startMs) / MT_CELL_POINTS_MODE_TRANSITION_MS,
        0,
        1,
      );
      const eased = easeProgress(progress, "easeInOutSine");
      const liveStyle = interpolatedScalarLegendStyle(
        fromStyle,
        toStyle,
        eased,
      );
      applyLiveMtCellPointsStyle({
        ...liveStyle,
        scalarLegendVisible: true,
        scalarInclusionMode: "thresholded",
      });
      if (progress < 1) {
        modeTransitionFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }
      modeTransitionFrameRef.current = null;
      persistMtCellPointsMode(nextMode);
      applyLiveMtCellPointsStyle(
        nextMode === "spectrum"
          ? {
              ...style,
              scalarLegendVisible: true,
              scalarInclusionMode: "thresholded",
            }
          : {
              ...fullCloudScalarLegendStyle(style),
              scalarLegendVisible: false,
              scalarInclusionMode: "all-valid",
            },
      );
      setModeTransitionTarget(null);
    };
    modeTransitionFrameRef.current = window.requestAnimationFrame(tick);
  };
  const setEdgeValue = (handle: EdgeHandle, value: number) => {
    const patch: Partial<EditableStyle> =
      handle === "edgeLower"
        ? { scalarEdgeLowerValue: clamp(value, trimMin, Math.max(trimMin, blendMin)) }
        : { scalarEdgeUpperValue: clamp(value, Math.min(blendMax, trimMax), trimMax) };
    if (canApplyLiveSceneEdits()) {
      sceneHandle.manager.applyStyle(layerId, { ...style, ...patch });
    }
    if (editingEnvironment) {
      setEnvLayerStyle(layerId, patch);
    } else if (writePage) {
      setPageLayerOverride(writePage.id, layerId, patch);
    }
  };
  const nearestHandleForValue = (value: number): SpectralHandle => {
    const candidates: Array<{ handle: SpectralHandle; value: number }> = [
      { handle: "focusMin", value: trimMin },
      { handle: "blendMin", value: blendMin },
      { handle: "blendMax", value: blendMax },
      { handle: "focusMax", value: trimMax },
    ];
    candidates.sort((a, b) => Math.abs(a.value - value) - Math.abs(b.value - value));
    return candidates[0].handle;
  };
  const valueFromClientX = (clientX: number): number | null => {
    const rect = rampRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const t = clamp((clientX - rect.left) / rect.width, 0, 1);
    return sourceMin + (sourceMax - sourceMin) * t;
  };
  const beginDrag =
    (handle: SpectralHandle) =>
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const firstValue = valueFromClientX(event.clientX);
      if (firstValue !== null) setSpectralValue(handle, firstValue);
      const onMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const nextValue = valueFromClientX(moveEvent.clientX);
        if (nextValue !== null) setSpectralValue(handle, nextValue);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
  };
  const beginTrackPlacement = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!thresholdControlsActive) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const value = valueFromClientX(event.clientX);
    if (value === null) return;
    const handle = nearestHandleForValue(value);
    beginDrag(handle)(event);
  };
  const beginEdgeDrag =
    (handle: EdgeHandle) =>
    (event: ReactPointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const firstValue = valueFromClientX(event.clientX);
      if (firstValue !== null) setEdgeValue(handle, firstValue);
      const onMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        const nextValue = valueFromClientX(moveEvent.clientX);
        if (nextValue !== null) setEdgeValue(handle, nextValue);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    };
  const handleKeyDown =
    (handle: SpectralHandle) =>
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      const currentValue =
        handle === "blendMin"
          ? blendMin
          : handle === "blendMax"
            ? blendMax
            : handle === "focusMin"
              ? trimMin
              : trimMax;
      const step = event.shiftKey ? 0.25 : 0.05;
      let nextValue = currentValue;
      if (event.key === "ArrowLeft") nextValue -= step;
      else if (event.key === "ArrowRight") nextValue += step;
      else if (event.key === "Home") {
        nextValue = sourceMin;
      } else if (event.key === "End") {
        nextValue = sourceMax;
      } else return;
      event.preventDefault();
      event.stopPropagation();
      setSpectralValue(handle, nextValue);
    };
  const handleButton = (
    handle: SpectralHandle,
    label: string,
    percent: number,
    inner: boolean,
  ) => (
    <button
      type="button"
      role="slider"
      aria-label={label}
      aria-valuemin={sourceMin}
      aria-valuemax={sourceMax}
      aria-valuenow={
        handle === "blendMin"
          ? blendMin
          : handle === "blendMax"
            ? blendMax
            : handle === "focusMin"
              ? trimMin
              : trimMax
      }
      data-testid={
        testIdsEnabled ? `resistivity-legend-${handle}` : undefined
      }
      title={label}
      onPointerDown={beginDrag(handle)}
      onKeyDown={handleKeyDown(handle)}
      style={spectralHandleStyle(percent, inner)}
    />
  );
  const testId = (id: string): string | undefined =>
    testIdsEnabled ? id : undefined;
  return (
    <aside
      ref={rootRef}
      style={{
        ...rootBaseStyle,
        ...(stacked
          ? { position: "relative" }
          : {
              left: LEGEND_PAGE_EDGE_MARGIN_PX,
              bottom: LEGEND_BOTTOM_EDGE_OFFSET_PX,
            }),
      }}
      aria-label="MT Resistivity Cells legend"
    >
      <div style={mtCellPointsHeaderStyle}>
        <button
          type="button"
          data-testid={testId("resistivity-legend-master-toggle")}
          aria-pressed={pointCloudVisible}
          title={pointCloudVisible ? "Hide MT Cells" : "Show MT Cells"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setPointCloudVisible(!pointCloudVisible)}
          style={mtCellPointsPrimaryStyle(pointCloudVisible)}
        >
          MT Cells
        </button>
        <button
          type="button"
          data-testid={testId("resistivity-legend-controls-toggle")}
          aria-expanded={controlsAvailable && edgePopoverOpen}
          title="MT Resistivity Cells controls"
          disabled={!controlsAvailable}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setEdgePopoverOpen((open) => !open)}
          style={mtCellPointsIconStyle(edgePopoverOpen, controlsAvailable)}
        >
          <MtCellPointsIcon kind="controls" />
        </button>
        <div
          role="radiogroup"
          aria-label="MT Resistivity Cells view"
          style={{ display: "contents" }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={displayedMode === "full-cloud"}
            data-testid={testId("resistivity-legend-full-cloud-toggle")}
            title="All Valid Cells"
            disabled={
              !pointCloudVisible ||
              displayedMode === "full-cloud" ||
              modeTransitionTarget !== null
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setMtCellPointsMode("full-cloud")}
            style={mtCellPointsIconStyle(
              displayedMode === "full-cloud",
              pointCloudVisible,
            )}
          >
            <MtCellPointsIcon kind="full-cloud" />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={displayedMode === "spectrum"}
            data-testid={testId("resistivity-legend-spectrum-toggle")}
            title="Log10 Resistivity Window"
            disabled={
              !pointCloudVisible ||
              displayedMode === "spectrum" ||
              modeTransitionTarget !== null
            }
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setMtCellPointsMode("spectrum")}
            style={mtCellPointsIconStyle(
              displayedMode === "spectrum",
              pointCloudVisible,
            )}
          >
            <MtCellPointsIcon kind="spectrum" />
          </button>
        </div>
      </div>
      {rampBodyVisible ? (
        <>
      <div
        ref={rampRef}
        style={rampWrapStyle}
        data-testid={testId("resistivity-legend-track")}
        onPointerDown={
          thresholdControlsActive ? beginTrackPlacement : undefined
        }
      >
        <div
          style={{
            ...rampStyle,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            marginTop: 0,
            background: `linear-gradient(90deg, ${lowColor} 0%, ${lowColor} ${colorMinPercent.toFixed(
              1,
            )}%, ${midColor} ${rampMidPercent.toFixed(
              1,
            )}%, ${highColor} ${colorMaxPercent.toFixed(
              1,
            )}%, ${highColor} 100%)`,
          }}
        >
          {thresholdControlsActive ? (
            <>
              <span
                style={{
                  ...rampMaskStyle,
                  left: 0,
                  width: `${trimMinPercent}%`,
                }}
              />
              <span
                style={{
                  ...rampMaskStyle,
                  left: `${trimMaxPercent}%`,
                  right: 0,
                }}
              />
              {blendMinPercent > trimMinPercent ? (
                <span
                  style={{
                    position: "absolute",
                    left: `${trimMinPercent}%`,
                    width: `${blendMinPercent - trimMinPercent}%`,
                    top: 0,
                    bottom: 0,
                    background:
                      "linear-gradient(90deg, rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0))",
                  }}
                />
              ) : null}
              {trimMaxPercent > blendMaxPercent ? (
                <span
                  style={{
                    position: "absolute",
                    left: `${blendMaxPercent}%`,
                    width: `${trimMaxPercent - blendMaxPercent}%`,
                    top: 0,
                    bottom: 0,
                    background:
                      "linear-gradient(90deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.58))",
                  }}
                />
              ) : null}
            </>
          ) : null}
        </div>
        {thresholdControlsActive ? (
          <>
            {handleButton(
              "focusMin",
              "Log10 resistivity window minimum",
              displayPercentForOverlappedHandles(trimMinPercent, -1, lowOverlap),
              true,
            )}
            {handleButton(
              "blendMin",
              "Log10 resistivity fade minimum",
              displayPercentForOverlappedHandles(blendMinPercent, 1, lowOverlap),
              false,
            )}
            {handleButton(
              "blendMax",
              "Log10 resistivity fade maximum",
              displayPercentForOverlappedHandles(blendMaxPercent, -1, highOverlap),
              false,
            )}
            {handleButton(
              "focusMax",
              "Log10 resistivity window maximum",
              displayPercentForOverlappedHandles(trimMaxPercent, 1, highOverlap),
              true,
            )}
          </>
        ) : null}
        {thresholdControlsActive ? (
          <>
            <button
              type="button"
              aria-label="Lower isoline log10 resistivity"
              data-testid={testId("resistivity-legend-edge-lower")}
              title="Lower isoline log10 resistivity"
              onPointerDown={beginEdgeDrag("edgeLower")}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setEdgePopoverOpen((open) => !open);
              }}
              style={edgeHandleStyle(edgeLowerPercent, edgeLowerColor)}
            />
            <button
              type="button"
              aria-label="Upper isoline log10 resistivity"
              data-testid={testId("resistivity-legend-edge-upper")}
              title="Upper isoline log10 resistivity"
              onPointerDown={beginEdgeDrag("edgeUpper")}
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setEdgePopoverOpen((open) => !open);
              }}
              style={edgeHandleStyle(edgeUpperPercent, edgeUpperColor)}
            />
          </>
        ) : null}
      </div>
      <div style={{ ...ticksStyle, color: legendTextColors.body }}>
        <div>
          <strong>{formatLogValue(colorMin)}</strong>
          <br />
          {formatOhmMFromLog(colorMin)}
        </div>
        <div style={tickMiddleStyle}>
          <strong>{formatLogValue(midValue)}</strong>
          <br />
          {formatOhmMFromLog(midValue)}
        </div>
        <div style={tickRightStyle}>
          <strong>{formatLogValue(colorMax)}</strong>
          <br />
          {formatOhmMFromLog(colorMax)}
        </div>
      </div>
        </>
      ) : null}
      {controlsAvailable && edgePopoverOpen && typeof document !== "undefined"
        ? createPortal(
            (
        <div
          ref={edgePopoverRef}
          style={{
            ...edgePopoverStyle,
            left: edgePopoverPosition.left,
            top: edgePopoverPosition.top,
            color: legendTextColors.body,
          }}
          data-testid={testId("resistivity-legend-edge-popout")}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div style={{ ...edgePopoverHeaderStyle, color: legendTextColors.heading }}>
            <span>
              3D MT inversion resistivity cell centers
              <br />
              <span style={{ color: legendTextColors.subtext }}>(full-density model cells)</span>
            </span>
            <button
              type="button"
              style={{ ...closeButtonStyle, color: legendTextColors.body }}
              onClick={() => setEdgePopoverOpen(false)}
            >
              Close
            </button>
          </div>
          <div
            style={{
              ...edgePopoverFullRowStyle,
              marginBottom: 10,
              fontSize: 9,
              lineHeight: 1.35,
              color: legendTextColors.subtext,
            }}
          >
            Dataset: MT inversion cell centers
            <br />
            Inclusion:{" "}
            {style.scalarInclusionMode === "thresholded"
              ? "Filter by log10 resistivity"
              : "All valid resistivity cells"}
          </div>
          <div style={edgePopoverGridStyle}>
            <label
              style={{
                ...fineControlLabelStyle,
                ...edgePopoverFullRowStyle,
                color: legendTextColors.body,
              }}
            >
              Band fill {edgeFillOffset === 0 ? "0%" : `${Math.round(edgeFillOffset * 100)}%`}
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={edgeFillOffset}
                data-testid={testId("resistivity-legend-edge-fill-offset")}
                title="Isoline band fill offset"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) =>
                  setScalarRenderPatch({
                    scalarEdgeFillOffset: clamp(
                      Number.parseFloat(event.currentTarget.value),
                      -1,
                      1,
                    ),
                  })
                }
                style={edgeFillRangeStyle(edgeFillOffset)}
              />
            </label>
            <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
              Isoline style
              <select
                value={edgeLineStyle}
                data-testid={testId("resistivity-legend-edge-line-style")}
                title="Isoline style"
                style={{ color: legendTextColors.body }}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) =>
                  setScalarRenderPatch({
                    scalarEdgeLineStyle:
                      event.currentTarget.value === "dashed" ? "dashed" : "solid",
                  })
                }
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
              </select>
            </label>
            <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
              Isoline {edgeLineWidth.toFixed(1)}px
              <input
                type="range"
                min={0}
                max={EDGE_LINE_MAX_WIDTH_PX}
                step={0.1}
                value={edgeLineWidth}
                data-testid={testId("resistivity-legend-edge-highlight")}
                title="Isoline width"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) =>
                  setScalarRenderPatch({
                    scalarEdgeLineWidth: clamp(
                      Number.parseFloat(event.currentTarget.value),
                      0,
                      EDGE_LINE_MAX_WIDTH_PX,
                    ),
                  })
                }
                style={fineControlRangeStyle}
              />
            </label>
            <label style={{ ...fineControlLabelStyle, color: legendTextColors.body }}>
              Smooth {Math.round(edgeAverage * 100)}%
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={edgeAverage}
                data-testid={testId("resistivity-legend-edge-average")}
                title="Isoline smoothing"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) =>
                  setScalarRenderPatch({
                    scalarEdgeAverage: clamp(
                      Number.parseFloat(event.currentTarget.value),
                      0,
                      1,
                    ),
                  })
                }
                style={fineControlRangeStyle}
              />
            </label>
            {thresholdControlsActive ? (
              <label
                style={{
                  ...fineControlLabelStyle,
                  ...edgePopoverFullRowStyle,
                  color: legendTextColors.body,
                }}
              >
                Lateral support {Math.round(noiseThreshold * 100)}%
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={noiseThreshold}
                  data-testid={testId("resistivity-legend-noise-threshold")}
                  title="Filter resistivity cells without lateral support"
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) =>
                    setScalarRenderPatch({
                      scalarNoiseThreshold: clamp(
                        Number.parseFloat(event.currentTarget.value),
                        0,
                        1,
                      ),
                    })
                  }
                  style={fineControlRangeStyle}
                />
              </label>
            ) : null}
          </div>
        </div>
            ),
            document.body,
          )
        : null}
    </aside>
  );
}
