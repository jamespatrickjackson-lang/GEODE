import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditor } from "../editor/EditorContext";
import { ENVIRONMENT_SENTINEL } from "../editor/types";
import {
  FROSTED_HAIRLINE,
  TECHNICAL_MONO_FONT,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "../editor/styles";
import { transparentLegendPanelStyle } from "./legendStyles";
import { effectiveStyle, effectiveVisibility } from "../pages/effective";
import { usePageController } from "../pages/PageController";
import type { EditableStyle } from "../pages/types";

const UTAH_FORGE_PROJECT_SLUG = "utah-forge";
const MT_RESISTIVITY_FULL_DENSITY_LAYER_ID =
  "utah-forge-mt-resistivity-full-density";
const MT_RESISTIVITY_SLICES_LAYER_ID = "utah-forge-mt-resistivity-slices";
const MT_RESISTIVITY_PREVIEW_LAYER_ID = "utah-forge-mt-resistivity-preview";
const MT_RESISTIVITY_VOLUME_LAYER_ID = "utah-forge-mt-resistivity-volume";
const MT_THRESHOLD_SURFACES_LAYER_ID =
  "utah-forge-mt-resistivity-threshold-surfaces";

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
const MT_THRESHOLD_SURFACE_LEGEND_ITEMS = [
  {
    id: "conductive-le-10-ohm-m",
    label: "<=10 Ohm-m",
    color: "#2cc9ff",
  },
  {
    id: "conductive-le-30-ohm-m",
    label: "<=30 Ohm-m",
    color: "#38f0b3",
  },
  {
    id: "resistive-ge-1000-ohm-m",
    label: ">=1000 Ohm-m",
    color: "#ff637a",
  },
] as const;

const rootBaseStyle: CSSProperties = {
  ...transparentLegendPanelStyle,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: vibrancyLabel,
  fontSize: 12,
  lineHeight: 1.15,
  fontWeight: 700,
};

const subtitleStyle: CSSProperties = {
  marginTop: 5,
  color: vibrancySecondaryLabel,
  fontSize: 10,
  lineHeight: 1.25,
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
  height: 23,
  marginTop: 10,
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
  color: vibrancySecondaryLabel,
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

const footerStyle: CSSProperties = {
  marginTop: 9,
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  lineHeight: 1.25,
};

const fineControlsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  marginTop: 10,
};

const targetSelectorStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(74px, 1fr))",
  gap: 5,
  marginTop: 9,
};

const targetButtonBaseStyle: CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.18)",
  borderRadius: 6,
  background: "rgba(255, 255, 255, 0.07)",
  color: vibrancySecondaryLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 9,
  lineHeight: 1.1,
  padding: "5px 6px",
  cursor: "pointer",
};

const fineControlLabelStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  color: vibrancySecondaryLabel,
  fontSize: 9,
  lineHeight: 1.1,
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
  color: vibrancyLabel,
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
  color: vibrancyLabel,
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
  color: vibrancySecondaryLabel,
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 9,
  padding: "3px 7px",
  cursor: "pointer",
};

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

function spectralHandleStyle(leftPercent: number, inner: boolean): CSSProperties {
  return {
    position: "absolute",
    left: `${leftPercent}%`,
    top: 0,
    width: 7,
    height: 20,
    borderRadius: 999,
    transform: "translateX(-50%)",
    background: LEGEND_HANDLE_FILL,
    border: "1px solid rgba(0, 0, 0, 0.48)",
    padding: 0,
    cursor: "ew-resize",
    pointerEvents: "auto",
    zIndex: inner ? 4 : 3,
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

type ScalarLegendLayer = "volume" | "full-density" | "slices" | "preview";

function scalarLegendLayerLabel(layer: ScalarLegendLayer): string {
  if (layer === "volume") return "Volume";
  if (layer === "full-density") return "Full density";
  if (layer === "slices") return "Slices";
  return "Preview";
}

function scalarLegendLayerSubtitle(layer: ScalarLegendLayer): string {
  if (layer === "volume") return "Scalar volume";
  if (layer === "full-density") return "Full-density model";
  if (layer === "slices") return "Authored slices";
  return "Point preview";
}

function activeScalarLayers(visible: Set<string>): ScalarLegendLayer[] {
  const layers: ScalarLegendLayer[] = [];
  if (visible.has(MT_RESISTIVITY_FULL_DENSITY_LAYER_ID)) {
    layers.push("full-density");
  }
  if (visible.has(MT_RESISTIVITY_VOLUME_LAYER_ID)) layers.push("volume");
  if (visible.has(MT_RESISTIVITY_SLICES_LAYER_ID)) layers.push("slices");
  if (visible.has(MT_RESISTIVITY_PREVIEW_LAYER_ID)) layers.push("preview");
  return layers;
}

export function ResistivityLegend({ stacked = false }: { stacked?: boolean }) {
  const { state, sceneHandle, setEnvLayerStyle, setPageLayerOverride } =
    useEditor();
  const { pages, currentIndex, targetIndex, transitionProgress } = usePageController();
  const rootRef = useRef<HTMLElement | null>(null);
  const rampRef = useRef<HTMLDivElement | null>(null);
  const edgePopoverRef = useRef<HTMLDivElement | null>(null);
  const [edgePopoverOpen, setEdgePopoverOpen] = useState(false);
  const [edgePopoverPosition, setEdgePopoverPosition] = useState({
    left: EDGE_POPOVER_MARGIN_PX,
    top: EDGE_POPOVER_MARGIN_PX,
  });
  const [selectedLayer, setSelectedLayer] = useState<ScalarLegendLayer | null>(
    null,
  );
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
  if (state.projectSlug !== UTAH_FORGE_PROJECT_SLUG) return null;

  const controllerPage = pages[targetIndex ?? currentIndex] ?? pages[currentIndex];
  const editingEnvironment = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const selectedPage =
    !editingEnvironment && targetIndex === null && state.selectedPageId
      ? state.pages.find((candidate) => candidate.id === state.selectedPageId)
      : null;
  const page = targetIndex !== null ? controllerPage : selectedPage ?? controllerPage;
  if (!page) return null;

  const visible = editingEnvironment
    ? new Set(state.environment.defaultVisibleLayers)
    : effectiveVisibility(state.environment, page);
  const visibleScalarLayers = activeScalarLayers(visible);
  const activeLayer =
    selectedLayer && visibleScalarLayers.includes(selectedLayer)
      ? selectedLayer
      : visibleScalarLayers[0] ?? null;
  if (!activeLayer) return null;
  const thresholdLayerVisible = visible.has(MT_THRESHOLD_SURFACES_LAYER_ID);

  const layerId =
    activeLayer === "volume"
      ? MT_RESISTIVITY_VOLUME_LAYER_ID
      : activeLayer === "full-density"
      ? MT_RESISTIVITY_FULL_DENSITY_LAYER_ID
      : activeLayer === "slices"
      ? MT_RESISTIVITY_SLICES_LAYER_ID
      : MT_RESISTIVITY_PREVIEW_LAYER_ID;
  const targetStyle = editingEnvironment
    ? state.environment.layerStyles[layerId] ?? {}
    : effectiveStyle(state.environment, page, layerId);
  const currentPage = pages[currentIndex] ?? page;
  const currentStyle = editingEnvironment
    ? targetStyle
    : effectiveStyle(state.environment, currentPage, layerId);
  const style =
    !editingEnvironment && targetIndex !== null
      ? interpolatedScalarLegendStyle(
          currentStyle,
          targetStyle,
          transitionProgress,
        )
      : targetStyle;
  if (!styleBoolean(style, "scalarLegendVisible", true)) return null;

  const lowColor = styleString(style, "scalarColorLow", DEFAULT_LOW);
  const midColor = styleString(style, "scalarColorMid", DEFAULT_MID);
  const highColor = styleString(style, "scalarColorHigh", DEFAULT_HIGH);
  const colorMin = styleNumber(style, "scalarDisplayMin", DEFAULT_MIN);
  const rawColorMax = styleNumber(style, "scalarDisplayMax", DEFAULT_MAX);
  const colorMax = Math.max(rawColorMax, colorMin + 0.000001);
  const sourceMin = Math.min(DEFAULT_SOURCE_MIN, colorMin);
  const sourceMax = Math.max(DEFAULT_SOURCE_MAX, colorMax);
  const trimMin = clamp(
    activeLayer === "volume"
      ? styleNumber(style, "scalarVolumeThresholdMin", sourceMin)
      : styleNumber(style, "scalarFocusMin", sourceMin),
    sourceMin,
    sourceMax,
  );
  const trimMax = clamp(
    activeLayer === "volume"
      ? styleNumber(style, "scalarVolumeThresholdMax", sourceMax)
      : styleNumber(style, "scalarFocusMax", sourceMax),
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
  const thresholdControlsActive = true;
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
  const gui = state.environment.scene?.gui ?? {};
  const navigator = gui.navigator ?? {};
  const inset = navigator.useOverride === true ? navigator.bottom ?? 34 : 34;
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
    if (activeLayer === "volume") {
      patch.scalarVolumeThresholdMin = nextTrimMin;
      patch.scalarVolumeThresholdMax = nextTrimMax;
    }
    sceneHandle.manager.applyStyle(layerId, { ...style, ...patch });
    if (editingEnvironment) {
      setEnvLayerStyle(layerId, patch);
    } else {
      setPageLayerOverride(page.id, layerId, patch);
    }
  };
  const setScalarRenderPatch = (patch: Partial<EditableStyle>) => {
    sceneHandle.manager.applyStyle(layerId, { ...style, ...patch });
    if (editingEnvironment) {
      setEnvLayerStyle(layerId, patch);
    } else {
      setPageLayerOverride(page.id, layerId, patch);
    }
  };
  const setEdgeValue = (handle: EdgeHandle, value: number) => {
    const patch: Partial<EditableStyle> =
      handle === "edgeLower"
        ? { scalarEdgeLowerValue: clamp(value, trimMin, Math.max(trimMin, blendMin)) }
        : { scalarEdgeUpperValue: clamp(value, Math.min(blendMax, trimMax), trimMax) };
    sceneHandle.manager.applyStyle(layerId, { ...style, ...patch });
    if (editingEnvironment) {
      setEnvLayerStyle(layerId, patch);
    } else {
      setPageLayerOverride(page.id, layerId, patch);
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
      data-testid={`resistivity-legend-${handle}`}
      title={label}
      onPointerDown={beginDrag(handle)}
      onKeyDown={handleKeyDown(handle)}
      style={spectralHandleStyle(percent, inner)}
    />
  );
  const volumeOpacity = clamp(styleNumber(style, "scalarVolumeOpacity", 0.48), 0, 1);
  const volumeDensity = clamp(styleNumber(style, "scalarVolumeDensity", 0.72), 0, 2);
  const volumeSamples = clamp(styleNumber(style, "scalarVolumeSampleSteps", 112), 24, 192);
  const thresholdStyle = editingEnvironment
    ? state.environment.layerStyles[MT_THRESHOLD_SURFACES_LAYER_ID] ?? {}
    : effectiveStyle(state.environment, page, MT_THRESHOLD_SURFACES_LAYER_ID);
  const thresholdVisibility =
    typeof thresholdStyle.mtThresholdSurfaceVisibility === "object" &&
    thresholdStyle.mtThresholdSurfaceVisibility !== null
      ? (thresholdStyle.mtThresholdSurfaceVisibility as Record<string, boolean>)
      : {};
  const setVolumePatch = (patch: Partial<EditableStyle>) => {
    sceneHandle.manager.applyStyle(layerId, { ...style, ...patch });
    if (editingEnvironment) {
      setEnvLayerStyle(layerId, patch);
    } else {
      setPageLayerOverride(page.id, layerId, patch);
    }
  };
  const setThresholdVisibility = (surfaceId: string, visibleSurface: boolean) => {
    const patch: Partial<EditableStyle> = {
      mtThresholdSurfaceVisibility: {
        ...thresholdVisibility,
        [surfaceId]: visibleSurface,
      },
    };
    sceneHandle.manager.applyStyle(MT_THRESHOLD_SURFACES_LAYER_ID, {
      ...thresholdStyle,
      ...patch,
    });
    if (editingEnvironment) {
      setEnvLayerStyle(MT_THRESHOLD_SURFACES_LAYER_ID, patch);
    } else {
      setPageLayerOverride(page.id, MT_THRESHOLD_SURFACES_LAYER_ID, patch);
    }
  };
  const thresholdSurfaceLegend = thresholdLayerVisible ? (
    <div style={footerStyle}>
      <div style={{ marginBottom: 5 }}>Threshold surfaces</div>
      {MT_THRESHOLD_SURFACE_LEGEND_ITEMS.map((item) => (
        <label
          key={item.id}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginRight: 8,
            marginTop: 4,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              background: item.color,
              boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.35)",
            }}
          />
          <input
            type="checkbox"
            data-testid={`resistivity-legend-threshold-${item.id}`}
            checked={thresholdVisibility[item.id] !== false}
            onChange={(event) =>
              setThresholdVisibility(item.id, event.currentTarget.checked)
            }
          />{" "}
          {item.label}
        </label>
      ))}
    </div>
  ) : null;

  return (
    <aside
      ref={rootRef}
      style={{
        ...rootBaseStyle,
        ...(stacked
          ? { position: "relative" }
          : { left: inset, bottom: inset + 34 }),
      }}
      aria-label="Utah FORGE MT resistivity color legend"
    >
      <h2 style={titleStyle}>MT resistivity</h2>
      <div style={subtitleStyle}>
        {scalarLegendLayerSubtitle(activeLayer)} - log10 resistivity
      </div>
      {visibleScalarLayers.length > 1 ? (
        <div style={targetSelectorStyle} aria-label="MT resistivity legend target">
          {visibleScalarLayers.map((layer) => {
            const selected = layer === activeLayer;
            return (
              <button
                key={layer}
                type="button"
                data-testid={`resistivity-legend-target-${layer}`}
                title={`Control ${scalarLegendLayerSubtitle(layer).toLowerCase()}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setSelectedLayer(layer)}
                style={{
                  ...targetButtonBaseStyle,
                  border: selected
                    ? "1px solid rgba(255, 255, 255, 0.55)"
                    : targetButtonBaseStyle.border,
                  background: selected
                    ? "rgba(255, 255, 255, 0.18)"
                    : targetButtonBaseStyle.background,
                  color: selected ? vibrancyLabel : vibrancySecondaryLabel,
                }}
              >
                {scalarLegendLayerLabel(layer)}
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        ref={rampRef}
        style={rampWrapStyle}
        data-testid="resistivity-legend-track"
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
              "Trim minimum handle",
              displayPercentForOverlappedHandles(trimMinPercent, -1, lowOverlap),
              true,
            )}
            {handleButton(
              "blendMin",
              "Feather minimum handle",
              displayPercentForOverlappedHandles(blendMinPercent, 1, lowOverlap),
              false,
            )}
            {handleButton(
              "blendMax",
              "Feather maximum handle",
              displayPercentForOverlappedHandles(blendMaxPercent, -1, highOverlap),
              false,
            )}
            {handleButton(
              "focusMax",
              "Trim maximum handle",
              displayPercentForOverlappedHandles(trimMaxPercent, 1, highOverlap),
              true,
            )}
          </>
        ) : null}
        <button
          type="button"
          aria-label="Lower edge line value"
          data-testid="resistivity-legend-edge-lower"
          title="Lower edge line value"
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
          aria-label="Upper edge line value"
          data-testid="resistivity-legend-edge-upper"
          title="Upper edge line value"
          onPointerDown={beginEdgeDrag("edgeUpper")}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setEdgePopoverOpen((open) => !open);
          }}
          style={edgeHandleStyle(edgeUpperPercent, edgeUpperColor)}
        />
      </div>
      <div style={ticksStyle}>
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
      {activeLayer !== "volume" && edgePopoverOpen && typeof document !== "undefined"
        ? createPortal(
            (
        <div
          ref={edgePopoverRef}
          style={{
            ...edgePopoverStyle,
            left: edgePopoverPosition.left,
            top: edgePopoverPosition.top,
          }}
          data-testid="resistivity-legend-edge-popout"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div style={edgePopoverHeaderStyle}>
            <span>Iso line</span>
            <button
              type="button"
              style={closeButtonStyle}
              onClick={() => setEdgePopoverOpen(false)}
            >
              Close
            </button>
          </div>
          <div style={edgePopoverGridStyle}>
            <label style={{ ...fineControlLabelStyle, ...edgePopoverFullRowStyle }}>
              Fill {edgeFillOffset === 0 ? "0%" : `${Math.round(edgeFillOffset * 100)}%`}
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={edgeFillOffset}
                data-testid="resistivity-legend-edge-fill-offset"
                title="Iso line fill offset"
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
            <label style={fineControlLabelStyle}>
              Style
              <select
                value={edgeLineStyle}
                data-testid="resistivity-legend-edge-line-style"
                title="Iso line style"
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
            <label style={fineControlLabelStyle}>
              Line {edgeLineWidth.toFixed(1)}px
              <input
                type="range"
                min={0}
                max={EDGE_LINE_MAX_WIDTH_PX}
                step={0.1}
                value={edgeLineWidth}
                data-testid="resistivity-legend-edge-highlight"
                title="Edge line thickness"
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
            <label style={fineControlLabelStyle}>
              Avg {Math.round(edgeAverage * 100)}%
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={edgeAverage}
                data-testid="resistivity-legend-edge-average"
                title="Average edge line into a smoother spline"
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
              <label style={{ ...fineControlLabelStyle, ...edgePopoverFullRowStyle }}>
                Noise {Math.round(noiseThreshold * 100)}%
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={noiseThreshold}
                  data-testid="resistivity-legend-noise-threshold"
                  title="Hide scalar points without lateral support"
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
      {activeLayer === "volume" ? (
        <>
          <div style={fineControlsStyle}>
            <label style={fineControlLabelStyle}>
              Opac {Math.round(volumeOpacity * 100)}%
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volumeOpacity}
                data-testid="resistivity-legend-volume-opacity"
                title="Volume opacity"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) =>
                  setVolumePatch({
                    scalarVolumeOpacity: clamp(
                      Number.parseFloat(event.currentTarget.value),
                      0,
                      1,
                    ),
                    opacity: clamp(
                      Number.parseFloat(event.currentTarget.value),
                      0,
                      1,
                    ),
                  })
                }
                style={fineControlRangeStyle}
              />
            </label>
            <label style={fineControlLabelStyle}>
              Dens {volumeDensity.toFixed(2)}
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
                value={volumeDensity}
                data-testid="resistivity-legend-volume-density"
                title="Volume density"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) =>
                  setVolumePatch({
                    scalarVolumeDensity: clamp(
                      Number.parseFloat(event.currentTarget.value),
                      0,
                      2,
                    ),
                  })
                }
                style={fineControlRangeStyle}
              />
            </label>
            <label style={fineControlLabelStyle}>
              Steps {Math.round(volumeSamples)}
              <input
                type="range"
                min={24}
                max={192}
                step={4}
                value={volumeSamples}
                data-testid="resistivity-legend-volume-samples"
                title="Raymarch sample steps"
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) =>
                  setVolumePatch({
                    scalarVolumeSampleSteps: clamp(
                      Number.parseFloat(event.currentTarget.value),
                      24,
                      192,
                    ),
                  })
                }
                style={fineControlRangeStyle}
              />
            </label>
          </div>
          {thresholdSurfaceLegend}
        </>
      ) : null}
      {activeLayer !== "volume" ? thresholdSurfaceLegend : null}
    </aside>
  );
}
