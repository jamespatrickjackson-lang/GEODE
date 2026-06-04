import type {
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

export interface ResolvedDemoBoreholeSourceLocationStyle {
  visible: boolean;
  mode: DemoBoreholeSourceLocationMode;
  color: string;
  opacity: number;
  diameterM: number;
  lengthM: number;
  lineWidth: number;
  topRingVisible: boolean;
  topRingRadiusM: number;
  topRingTubeM: number;
  topRingColor: string;
  topRingOpacity: number;
  labelVisible: boolean;
  labelLiftM: number;
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
    mode: "rounded-trace",
    color: "#f6d365",
    opacity: 0.92,
    diameterM: 72,
    lengthM: 900,
    lineWidth: 8,
    topRingVisible: false,
    topRingRadiusM: 135,
    topRingTubeM: 12,
    topRingColor: "#ffffff",
    topRingOpacity: 0.88,
    labelVisible: true,
    labelLiftM: 130,
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
  return {
    visible: booleanValue(
      authored.visible,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.visible,
    ),
    mode: sourceLocationMode(
      authored.mode,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.mode,
    ),
    color: stringValue(
      authored.color,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.color,
    ),
    opacity: numberValue(
      authored.opacity,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.opacity,
      0,
      1,
    ),
    diameterM: numberValue(
      authored.diameterM,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.diameterM,
      8,
      400,
    ),
    lengthM: numberValue(
      authored.lengthM,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.lengthM,
      50,
      4000,
    ),
    lineWidth: numberValue(
      authored.lineWidth,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.lineWidth,
      1,
      28,
    ),
    topRingVisible: booleanValue(
      authored.topRingVisible,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.topRingVisible,
    ),
    topRingRadiusM: numberValue(
      authored.topRingRadiusM,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.topRingRadiusM,
      20,
      1200,
    ),
    topRingTubeM: numberValue(
      authored.topRingTubeM,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.topRingTubeM,
      2,
      120,
    ),
    topRingColor: stringValue(
      authored.topRingColor,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.topRingColor,
    ),
    topRingOpacity: numberValue(
      authored.topRingOpacity,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.topRingOpacity,
      0,
      1,
    ),
    labelVisible: booleanValue(
      authored.labelVisible,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.labelVisible,
    ),
    labelLiftM: numberValue(
      authored.labelLiftM,
      UTAH_FORGE_DEMO_SOURCE_LOCATION_DEFAULT.labelLiftM,
      -250,
      1000,
    ),
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
