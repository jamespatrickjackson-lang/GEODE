import type {
  DemoBoreholeElementOffset,
  DemoBoreholeIconOrientation,
  DemoBoreholePathTreatment,
  DemoBoreholeSourceLocationItemStyle,
  DemoBoreholeSourceLocationMode,
  DemoBoreholeSourceLocationStyle,
  DemoBoreholeWellStyle,
  DemoOrientationBlockStyle,
  EditableStyle,
} from "../../pages/types";
export { UTAH_FORGE_SITE_BOUNDARY_LAYER_ID } from "./layerIds";

export const UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS = [
  "16A(78)-32",
  "16B(78)-32",
] as const;

export type UtahForgeDemoBoreholeWellId =
  (typeof UTAH_FORGE_DEMO_BOREHOLE_WELL_IDS)[number];

export interface ResolvedDemoBoreholeWellStyle {
  visible: boolean;
  pipeDiameterM: number;
  color: string;
  opacity: number;
  lineStyle: "solid" | "dashed";
  dashLengthM: number;
  dashGapM: number;
  centerlineVisible: boolean;
  centerlineWidth: number;
  centerlineOpacity: number;
  centerlineColor: string;
  collarVisible: boolean;
  collarDiameterM: number;
  pathTreatment: DemoBoreholePathTreatment;
  smoothingStrength: number;
  collarLabelVisible: boolean;
  collarLabelText: string;
  collarLabelLiftM: number;
  toeLabelVisible: boolean;
  toeLabelText: string;
  toeLabelLiftM: number;
}

export interface ResolvedDemoOrientationBlockStyle {
  visible: boolean;
  widthM: number;
  depthM: number;
  heightM: number;
  liftM: number;
  rotationDeg: number;
  fillColor: string;
  opacity: number;
  outlineVisible: boolean;
  outlineColor: string;
  outlineThickness: number;
  outlineOpacity: number;
  labelVisible: boolean;
  labelText: string;
  labelLiftM: number;
}

export type ResolvedSceneOffset = [number, number, number];

export interface ResolvedDemoBoreholeIconStyle {
  visible: boolean;
  src: string | null;
  sizeM: number;
  opacity: number;
  color: string;
  orientation: DemoBoreholeIconOrientation;
  offsetM: ResolvedSceneOffset;
}

export interface ResolvedDemoBoreholeSourceLocationStyle {
  visible: boolean;
  mode: DemoBoreholeSourceLocationMode;
  color: string;
  opacity: number;
  labelVisible: boolean;
  labelLiftM: number;
  // Line element (location / trajectory / depth).
  lineVisible: boolean;
  lineColor: string;
  lineOpacity: number;
  lineWidth: number;
  lineDashed: boolean;
  lineDashLengthM: number;
  lineDashGapM: number;
  depthM: number;
  // Depth trace (rounded cylinder).
  depthTraceVisible: boolean;
  depthTraceColor: string;
  depthTraceOpacity: number;
  diameterM: number;
  lengthM: number;
  // Ground ball.
  groundBallVisible: boolean;
  groundBallRadiusM: number;
  groundBallColor: string;
  groundBallOpacity: number;
  groundBallOffsetM: ResolvedSceneOffset;
  // Ground torus (legacy topRing fields).
  topRingVisible: boolean;
  topRingRadiusM: number;
  topRingTubeM: number;
  topRingColor: string;
  topRingOpacity: number;
  topRingOffsetM: ResolvedSceneOffset;
  // Ground crosshair.
  crosshairVisible: boolean;
  crosshairLengthM: number;
  crosshairWidth: number;
  crosshairColor: string;
  crosshairOpacity: number;
  // SVG icon on top.
  icon: ResolvedDemoBoreholeIconStyle;
}

export interface ResolvedDemoBoreholeSourceLocationItemStyle {
  visible: boolean;
  labelVisible: boolean;
}

export type ScenePointTuple = [number, number, number];

const INJECTION_DEFAULT: ResolvedDemoBoreholeWellStyle = {
  visible: true,
  pipeDiameterM: 24,
  color: "#35d7ff",
  opacity: 0.92,
  lineStyle: "solid",
  dashLengthM: 260,
  dashGapM: 150,
  centerlineVisible: true,
  centerlineWidth: 2.2,
  centerlineOpacity: 0.82,
  centerlineColor: "#35d7ff",
  collarVisible: true,
  collarDiameterM: 60,
  pathTreatment: "survey",
  smoothingStrength: 0.35,
  collarLabelVisible: true,
  collarLabelText: "16A injection",
  collarLabelLiftM: 95,
  toeLabelVisible: true,
  toeLabelText: "Injection toe",
  toeLabelLiftM: 40,
};

const PRODUCTION_DEFAULT: ResolvedDemoBoreholeWellStyle = {
  ...INJECTION_DEFAULT,
  color: "#ff7440",
  centerlineColor: "#ff7440",
  collarLabelText: "16B production",
  toeLabelText: "Production toe",
};

export const UTAH_FORGE_DEMO_BOREHOLE_WELL_DEFAULTS: Record<
  UtahForgeDemoBoreholeWellId,
  ResolvedDemoBoreholeWellStyle
> = {
  "16A(78)-32": INJECTION_DEFAULT,
  "16B(78)-32": PRODUCTION_DEFAULT,
};

export const UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT: ResolvedDemoOrientationBlockStyle =
  {
    visible: true,
    widthM: 118,
    depthM: 68,
    heightM: 34,
    liftM: 0,
    rotationDeg: -24.985,
    fillColor: "#ffffff",
    opacity: 0.82,
    outlineVisible: true,
    outlineColor: "#ffffff",
    outlineThickness: 1.5,
    outlineOpacity: 0.92,
    labelVisible: true,
    labelText: "FORGE surface facility / orientation block",
    labelLiftM: 25.5,
  };

export const UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT: ResolvedDemoBoreholeSourceLocationStyle =
  {
    visible: true,
    mode: "line",
    color: "#f6d365",
    opacity: 0.92,
    labelVisible: false,
    labelLiftM: 130,
    // Line element: default-on (location / trajectory / depth).
    lineVisible: true,
    lineColor: "#f6d365",
    lineOpacity: 0.92,
    lineWidth: 8,
    lineDashed: false,
    lineDashLengthM: 260,
    lineDashGapM: 150,
    depthM: 900,
    // Depth trace: default-off.
    depthTraceVisible: false,
    depthTraceColor: "#f6d365",
    depthTraceOpacity: 0.92,
    diameterM: 72,
    lengthM: 900,
    // Ground ball: default-off.
    groundBallVisible: false,
    groundBallRadiusM: 45,
    groundBallColor: "#f6d365",
    groundBallOpacity: 0.92,
    groundBallOffsetM: [0, 0, 0],
    // Ground torus: default-on.
    topRingVisible: true,
    topRingRadiusM: 135,
    topRingTubeM: 12,
    topRingColor: "#ffffff",
    topRingOpacity: 0.88,
    topRingOffsetM: [0, 0, 0],
    // Crosshair: default-off.
    crosshairVisible: false,
    crosshairLengthM: 320,
    crosshairWidth: 6,
    crosshairColor: "#f6d365",
    crosshairOpacity: 0.92,
    // SVG icon: default-off (until an icon is uploaded).
    icon: {
      visible: false,
      src: null,
      sizeM: 200,
      opacity: 1,
      color: "#ffffff",
      orientation: "axis",
      offsetM: [0, 0, 0],
    },
  };

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function numberValue(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return finiteNumber(value) ? clamp(value, min, max) : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function lineStyle(value: unknown, fallback: "solid" | "dashed") {
  return value === "dashed" || value === "solid" ? value : fallback;
}

function pathTreatment(
  value: unknown,
  fallback: DemoBoreholePathTreatment,
): DemoBoreholePathTreatment {
  return value === "survey" ||
    value === "smoothed" ||
    value === "presentation-normalized"
    ? value
    : fallback;
}

function sourceLocationMode(
  value: unknown,
  fallback: DemoBoreholeSourceLocationMode,
): DemoBoreholeSourceLocationMode {
  return value === "rounded-trace" ||
    value === "line" ||
    value === "pin" ||
    value === "crosshair" ||
    value === "hidden"
    ? value
    : fallback;
}

function offsetTuple(
  value: DemoBoreholeElementOffset | undefined,
): ResolvedSceneOffset {
  return [
    numberValue(value?.x, 0, -20000, 20000),
    numberValue(value?.y, 0, -20000, 20000),
    numberValue(value?.z, 0, -20000, 20000),
  ];
}

interface DemoBoreholeElementFlags {
  line: boolean;
  depthTrace: boolean;
  groundBall: boolean;
  crosshair: boolean;
}

// Back-compat: map the legacy exclusive `mode` onto the composable element
// flags. Ground torus and icon are independent of mode and keep their own
// authored/default values.
function elementFlagsFromMode(
  mode: DemoBoreholeSourceLocationMode,
): DemoBoreholeElementFlags {
  switch (mode) {
    case "line":
      return { line: true, depthTrace: false, groundBall: false, crosshair: false };
    case "pin":
      return { line: true, depthTrace: false, groundBall: true, crosshair: false };
    case "crosshair":
      return { line: false, depthTrace: false, groundBall: false, crosshair: true };
    case "hidden":
      return { line: false, depthTrace: false, groundBall: false, crosshair: false };
    case "rounded-trace":
    default:
      return { line: false, depthTrace: true, groundBall: false, crosshair: false };
  }
}

export function resolveDemoBoreholeWellStyle(
  style: EditableStyle,
  wellId: string,
): ResolvedDemoBoreholeWellStyle {
  const defaultStyle =
    UTAH_FORGE_DEMO_BOREHOLE_WELL_DEFAULTS[
      wellId as UtahForgeDemoBoreholeWellId
    ] ?? INJECTION_DEFAULT;
  const authored = style.demoBoreholeWells?.[wellId] ?? {};
  const legacyDiameter = finiteNumber(style.demoBoreholePipeRadiusM)
    ? clamp(style.demoBoreholePipeRadiusM * 2, 4, 80)
    : defaultStyle.pipeDiameterM;
  const resolved: ResolvedDemoBoreholeWellStyle = {
    visible: booleanValue(authored.visible, defaultStyle.visible),
    pipeDiameterM: numberValue(
      authored.pipeDiameterM,
      legacyDiameter,
      4,
      80,
    ),
    color: stringValue(authored.color, defaultStyle.color),
    opacity: numberValue(authored.opacity, defaultStyle.opacity, 0, 1),
    lineStyle: lineStyle(authored.lineStyle, defaultStyle.lineStyle),
    dashLengthM: numberValue(
      authored.dashLengthM,
      defaultStyle.dashLengthM,
      20,
      1500,
    ),
    dashGapM: numberValue(authored.dashGapM, defaultStyle.dashGapM, 10, 1500),
    centerlineVisible: booleanValue(
      authored.centerlineVisible,
      defaultStyle.centerlineVisible,
    ),
    centerlineWidth: numberValue(
      authored.centerlineWidth,
      defaultStyle.centerlineWidth,
      0.25,
      12,
    ),
    centerlineOpacity: numberValue(
      authored.centerlineOpacity,
      defaultStyle.centerlineOpacity,
      0,
      1,
    ),
    centerlineColor: stringValue(
      authored.centerlineColor,
      authored.color ?? defaultStyle.centerlineColor,
    ),
    collarVisible: booleanValue(
      authored.collarVisible,
      defaultStyle.collarVisible,
    ),
    collarDiameterM: numberValue(
      authored.collarDiameterM,
      defaultStyle.collarDiameterM,
      6,
      160,
    ),
    pathTreatment: pathTreatment(
      authored.pathTreatment,
      defaultStyle.pathTreatment,
    ),
    smoothingStrength: numberValue(
      authored.smoothingStrength,
      defaultStyle.smoothingStrength,
      0,
      1,
    ),
    collarLabelVisible: booleanValue(
      authored.collarLabelVisible,
      defaultStyle.collarLabelVisible,
    ),
    collarLabelText: stringValue(
      authored.collarLabelText,
      defaultStyle.collarLabelText,
    ),
    collarLabelLiftM: numberValue(
      authored.collarLabelLiftM,
      defaultStyle.collarLabelLiftM,
      -250,
      500,
    ),
    toeLabelVisible: booleanValue(
      authored.toeLabelVisible,
      defaultStyle.toeLabelVisible,
    ),
    toeLabelText: stringValue(authored.toeLabelText, defaultStyle.toeLabelText),
    toeLabelLiftM: numberValue(
      authored.toeLabelLiftM,
      defaultStyle.toeLabelLiftM,
      -250,
      500,
    ),
  };
  return resolved;
}

export function resolveDemoOrientationBlockStyle(
  style: EditableStyle,
): ResolvedDemoOrientationBlockStyle {
  const authored = style.demoBoreholeBlock ?? {};
  const legacyVisible =
    typeof style.demoBoreholeBlockVisible === "boolean"
      ? style.demoBoreholeBlockVisible
      : UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.visible;
  return {
    visible: booleanValue(authored.visible, legacyVisible),
    widthM: numberValue(
      authored.widthM,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.widthM,
      5,
      500,
    ),
    depthM: numberValue(
      authored.depthM,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.depthM,
      5,
      500,
    ),
    heightM: numberValue(
      authored.heightM,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.heightM,
      2,
      200,
    ),
    liftM: numberValue(
      authored.liftM,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.liftM,
      -300,
      500,
    ),
    rotationDeg: numberValue(
      authored.rotationDeg,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.rotationDeg,
      -180,
      180,
    ),
    fillColor: stringValue(
      authored.fillColor,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.fillColor,
    ),
    opacity: numberValue(
      authored.opacity,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.opacity,
      0,
      1,
    ),
    outlineVisible: booleanValue(
      authored.outlineVisible,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.outlineVisible,
    ),
    outlineColor: stringValue(
      authored.outlineColor,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.outlineColor,
    ),
    outlineThickness: numberValue(
      authored.outlineThickness,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.outlineThickness,
      0.25,
      8,
    ),
    outlineOpacity: numberValue(
      authored.outlineOpacity,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.outlineOpacity,
      0,
      1,
    ),
    labelVisible: booleanValue(
      authored.labelVisible,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.labelVisible,
    ),
    labelText: stringValue(
      authored.labelText,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.labelText,
    ),
    labelLiftM: numberValue(
      authored.labelLiftM,
      UTAH_FORGE_DEMO_ORIENTATION_BLOCK_DEFAULT.labelLiftM,
      -100,
      300,
    ),
  };
}

export function resolveDemoBoreholeSourceLocationStyle(
  style: EditableStyle,
): ResolvedDemoBoreholeSourceLocationStyle {
  const authored = style.demoBoreholeSourceLocations ?? {};
  const D = UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT;
  const sharedColor = stringValue(authored.color, D.color);
  const sharedOpacity = numberValue(authored.opacity, D.opacity, 0, 1);
  const icon = authored.icon ?? {};

  // Only derive per-element visibility from the legacy `mode` when none of the
  // new element flags are explicitly authored.
  const hasElementFlags =
    typeof authored.lineVisible === "boolean" ||
    typeof authored.depthTraceVisible === "boolean" ||
    typeof authored.groundBallVisible === "boolean" ||
    typeof authored.crosshairVisible === "boolean";
  const modeFlags =
    !hasElementFlags && typeof authored.mode === "string"
      ? elementFlagsFromMode(sourceLocationMode(authored.mode, D.mode))
      : null;

  return {
    visible: booleanValue(authored.visible, D.visible),
    mode: sourceLocationMode(authored.mode, D.mode),
    color: sharedColor,
    opacity: sharedOpacity,
    labelVisible: booleanValue(authored.labelVisible, D.labelVisible),
    labelLiftM: numberValue(authored.labelLiftM, D.labelLiftM, -250, 1000),
    // Line element.
    lineVisible: booleanValue(
      authored.lineVisible,
      modeFlags ? modeFlags.line : D.lineVisible,
    ),
    lineColor: stringValue(authored.lineColor, sharedColor),
    lineOpacity: numberValue(authored.lineOpacity, sharedOpacity, 0, 1),
    lineWidth: numberValue(authored.lineWidth, D.lineWidth, 1, 28),
    lineDashed: booleanValue(authored.lineDashed, D.lineDashed),
    lineDashLengthM: numberValue(
      authored.lineDashLengthM,
      D.lineDashLengthM,
      20,
      1500,
    ),
    lineDashGapM: numberValue(authored.lineDashGapM, D.lineDashGapM, 10, 1500),
    depthM: numberValue(authored.depthM ?? authored.lengthM, D.depthM, 50, 4000),
    // Depth trace.
    depthTraceVisible: booleanValue(
      authored.depthTraceVisible,
      modeFlags ? modeFlags.depthTrace : D.depthTraceVisible,
    ),
    depthTraceColor: stringValue(authored.depthTraceColor, sharedColor),
    depthTraceOpacity: numberValue(
      authored.depthTraceOpacity,
      sharedOpacity,
      0,
      1,
    ),
    diameterM: numberValue(authored.diameterM, D.diameterM, 8, 400),
    lengthM: numberValue(authored.lengthM, D.lengthM, 50, 4000),
    // Ground ball.
    groundBallVisible: booleanValue(
      authored.groundBallVisible,
      modeFlags ? modeFlags.groundBall : D.groundBallVisible,
    ),
    groundBallRadiusM: numberValue(
      authored.groundBallRadiusM,
      D.groundBallRadiusM,
      4,
      600,
    ),
    groundBallColor: stringValue(authored.groundBallColor, sharedColor),
    groundBallOpacity: numberValue(
      authored.groundBallOpacity,
      sharedOpacity,
      0,
      1,
    ),
    groundBallOffsetM: offsetTuple(authored.groundBallOffsetM),
    // Ground torus.
    topRingVisible: booleanValue(authored.topRingVisible, D.topRingVisible),
    topRingRadiusM: numberValue(
      authored.topRingRadiusM,
      D.topRingRadiusM,
      20,
      1200,
    ),
    topRingTubeM: numberValue(authored.topRingTubeM, D.topRingTubeM, 2, 120),
    topRingColor: stringValue(authored.topRingColor, D.topRingColor),
    topRingOpacity: numberValue(
      authored.topRingOpacity,
      D.topRingOpacity,
      0,
      1,
    ),
    topRingOffsetM: offsetTuple(authored.topRingOffsetM),
    // Crosshair.
    crosshairVisible: booleanValue(
      authored.crosshairVisible,
      modeFlags ? modeFlags.crosshair : D.crosshairVisible,
    ),
    crosshairLengthM: numberValue(
      authored.crosshairLengthM,
      D.crosshairLengthM,
      40,
      2000,
    ),
    crosshairWidth: numberValue(authored.crosshairWidth, D.crosshairWidth, 1, 28),
    crosshairColor: stringValue(authored.crosshairColor, sharedColor),
    crosshairOpacity: numberValue(
      authored.crosshairOpacity,
      sharedOpacity,
      0,
      1,
    ),
    // SVG icon.
    icon: {
      visible: booleanValue(icon.visible, D.icon.visible),
      src:
        typeof icon.src === "string" && icon.src.trim() ? icon.src : D.icon.src,
      sizeM: numberValue(icon.sizeM, D.icon.sizeM, 10, 4000),
      opacity: numberValue(icon.opacity, D.icon.opacity, 0, 1),
      color: stringValue(icon.color, D.icon.color),
      orientation:
        icon.orientation === "billboard" || icon.orientation === "axis"
          ? icon.orientation
          : D.icon.orientation,
      offsetM: offsetTuple(icon.offsetM),
    },
  };
}

export function resolveDemoBoreholeSourceLocationItemStyle(
  style: EditableStyle,
  sourceLocationId: string,
): ResolvedDemoBoreholeSourceLocationItemStyle {
  const authored =
    style.demoBoreholeSourceLocations?.items?.[sourceLocationId] ?? {};
  return {
    visible: booleanValue(authored.visible, true),
    labelVisible: booleanValue(authored.labelVisible, true),
  };
}

export function cleanDemoBoreholePath(
  points: readonly ScenePointTuple[],
  mode: DemoBoreholePathTreatment,
  strength: number,
): ScenePointTuple[] {
  if (points.length < 3 || mode === "survey") return points.map((p) => [...p]);
  const normalizedStrength = clamp(strength, 0, 1);
  const smoothingPasses = mode === "presentation-normalized" ? 3 : 1;
  let next = points.map((p) => [...p] as ScenePointTuple);
  for (let pass = 0; pass < smoothingPasses; pass += 1) {
    next = next.map((point, index) => {
      if (index === 0 || index === next.length - 1) return [...point];
      const previous = next[index - 1];
      const following = next[index + 1];
      return [
        point[0] * (1 - normalizedStrength) +
          ((previous[0] + following[0]) * 0.5) * normalizedStrength,
        point[1] * (1 - normalizedStrength) +
          ((previous[1] + following[1]) * 0.5) * normalizedStrength,
        point[2] * (1 - normalizedStrength) +
          ((previous[2] + following[2]) * 0.5) * normalizedStrength,
      ];
    });
  }
  if (mode !== "presentation-normalized") return next;

  const start = points[0];
  const end = points[points.length - 1];
  const straightBlend = normalizedStrength * 0.45;
  return next.map((point, index) => {
    if (index === 0 || index === next.length - 1) return [...point];
    const t = index / (next.length - 1);
    const straight: ScenePointTuple = [
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
      start[2] + (end[2] - start[2]) * t,
    ];
    return [
      point[0] * (1 - straightBlend) + straight[0] * straightBlend,
      point[1] * (1 - straightBlend) + straight[1] * straightBlend,
      point[2] * (1 - straightBlend) + straight[2] * straightBlend,
    ];
  });
}

export function patchDemoBoreholeWellStyle(
  style: EditableStyle,
  wellId: string,
  patch: DemoBoreholeWellStyle,
): Pick<EditableStyle, "demoBoreholeWells"> {
  return {
    demoBoreholeWells: {
      ...(style.demoBoreholeWells ?? {}),
      [wellId]: {
        ...(style.demoBoreholeWells?.[wellId] ?? {}),
        ...patch,
      },
    },
  };
}

export function patchDemoOrientationBlockStyle(
  style: EditableStyle,
  patch: DemoOrientationBlockStyle,
): Pick<EditableStyle, "demoBoreholeBlock"> {
  return {
    demoBoreholeBlock: {
      ...(style.demoBoreholeBlock ?? {}),
      ...patch,
    },
  };
}

export function patchDemoBoreholeSourceLocationStyle(
  style: EditableStyle,
  patch: DemoBoreholeSourceLocationStyle,
): Pick<EditableStyle, "demoBoreholeSourceLocations"> {
  return {
    demoBoreholeSourceLocations: {
      ...(style.demoBoreholeSourceLocations ?? {}),
      ...patch,
    },
  };
}

export function patchDemoBoreholeSourceLocationItemStyle(
  style: EditableStyle,
  sourceLocationId: string,
  patch: DemoBoreholeSourceLocationItemStyle,
): Pick<EditableStyle, "demoBoreholeSourceLocations"> {
  return {
    demoBoreholeSourceLocations: {
      ...(style.demoBoreholeSourceLocations ?? {}),
      items: {
        ...(style.demoBoreholeSourceLocations?.items ?? {}),
        [sourceLocationId]: {
          ...(style.demoBoreholeSourceLocations?.items?.[sourceLocationId] ?? {}),
          ...patch,
        },
      },
    },
  };
}
