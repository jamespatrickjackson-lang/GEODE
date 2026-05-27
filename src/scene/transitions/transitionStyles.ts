import * as THREE from "three";
import type { EditableStyle, EasingName, ProjectLayerSpec } from "../../pages/types";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import { UTAH_FORGE_DISCRETE_CROSSFADE_LAYER_IDS } from "../../projectModules/utahForge/crossfadeFields";
import {
  TOPO_MAP_GRATICULE_EDGE_STYLE_FIELDS,
  TOPO_MAP_LEGACY_GRATICULE_LAYER_ID,
  isTopoMapGraticuleLayer,
} from "../../topoMap/settings";

const MT_SURFACE_MASK_DEFAULT_DEPTH_M = 25;
const MT_SURFACE_MASK_DEFAULT_FEATHER_M = 175;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function easeProgress(t: number, easing: EasingName): number {
  const x = clamp01(t);
  switch (easing) {
    case "linear":
      return x;
    case "easeInOutSine":
      return -(Math.cos(Math.PI * x) - 1) / 2;
    case "easeOutQuart":
      return 1 - Math.pow(1 - x, 4);
    case "easeOutCubic":
      return 1 - Math.pow(1 - x, 3);
    case "easeInOutCubic":
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}

export function scalarInclusionFilterActive(
  layerId: string,
  style: EditableStyle,
  filterActive: boolean,
): boolean {
  const inclusionMode = style.scalarInclusionMode;
  if (inclusionMode === "thresholded") return filterActive;
  if (
    inclusionMode === "all-valid" ||
    layerId === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID
  ) {
    return false;
  }
  return filterActive;
}

export function scalarFullDensityAllValidMode(
  layerId: string,
  style: EditableStyle,
): boolean {
  return (
    layerId === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID &&
    style.scalarInclusionMode !== "thresholded"
  );
}

export interface LayerOpacityTween {
  from: number;
  to: number;
  startMs: number;
  durationMs: number;
  easing: EasingName;
}

export interface LayerTransitionSnapshot extends LayerOpacityTween {
  id: string;
  group: THREE.Group;
  style?: EditableStyle;
}

export interface ScalarStyleTween extends LayerOpacityTween {
  id: string;
  fromStyle: EditableStyle;
  toStyle: EditableStyle;
}

export interface WorkingAreaFocusStyleTween {
  fromStyle: EditableStyle;
  toStyle: EditableStyle;
  startMs: number;
  durationMs: number;
  easing: EasingName;
}

export type NavigationReason =
  | "page-click"
  | "keyboard"
  | "programmatic"
  | "freelook"
  | "interrupted";

export type LayerTransitionKind =
  | "continuous"
  | "discrete-crossfade"
  | "full-density-scalar"
  | "none";

export interface ResolvedLayerRenderState {
  id: string;
  visible: boolean;
  opacity: number;
  style: EditableStyle;
}

export interface SceneTransitionContext {
  sourcePageId: string;
  targetPageId: string;
  reason: NavigationReason;
  startMs: number;
  durationMs: number;
  easing: EasingName;
  layerKinds: Record<string, LayerTransitionKind>;
  sourceLayers: Map<string, ResolvedLayerRenderState>;
  sourceVisibleLayerIds: Set<string>;
  targetVisibleLayerIds: Set<string>;
  warnedUnexpectedVisibleLayerIds: Set<string>;
}

export interface SceneSectionStyleTween {
  fromStyle: EditableStyle;
  toStyle: EditableStyle;
  startMs: number;
  durationMs: number;
  easing: EasingName;
  discreteChanged: boolean;
}

export const SCALAR_TRANSITION_STYLE_FIELDS: readonly (keyof EditableStyle)[] = [
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
  "scalarDistanceLightStrength",
  "scalarSurfaceMaskDepthM",
  "scalarSurfaceMaskFeatherM",
  "scalarVolumeThresholdMin",
  "scalarVolumeThresholdMax",
  "scalarVolumeOpacity",
  "scalarVolumeDensity",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
];

export function scalarStyleNumber(
  style: EditableStyle,
  field: keyof EditableStyle,
): number | null {
  const value = style[field];
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const displayMin =
    typeof style.scalarDisplayMin === "number" &&
    Number.isFinite(style.scalarDisplayMin)
      ? style.scalarDisplayMin
      : 0.139879;
  const displayMax =
    typeof style.scalarDisplayMax === "number" &&
    Number.isFinite(style.scalarDisplayMax)
      ? style.scalarDisplayMax
      : 3.937122;
  const focusMin =
    typeof style.scalarFocusMin === "number" &&
    Number.isFinite(style.scalarFocusMin)
      ? style.scalarFocusMin
      : -2;
  const focusMax =
    typeof style.scalarFocusMax === "number" &&
    Number.isFinite(style.scalarFocusMax)
      ? style.scalarFocusMax
      : 4.5;
  const blendMin =
    typeof style.scalarBlendMin === "number" &&
    Number.isFinite(style.scalarBlendMin)
      ? style.scalarBlendMin
      : displayMin;
  const blendMax =
    typeof style.scalarBlendMax === "number" &&
    Number.isFinite(style.scalarBlendMax)
      ? style.scalarBlendMax
      : displayMax;

  if (field === "scalarEdgeLowerValue") {
    return (Math.min(focusMin, focusMax) + Math.min(blendMin, blendMax)) / 2;
  }
  if (field === "scalarEdgeUpperValue") {
    return (Math.max(blendMin, blendMax) + Math.max(focusMin, focusMax)) / 2;
  }
  if (field === "scalarEdgeLineWidth") {
    return (scalarStyleNumber(style, "scalarEdgeHighlight") ?? 0) * 8;
  }
  if (field === "scalarEdgeAverage") return 0.45;
  if (field === "scalarEdgeFillOffset") return 0;
  if (field === "scalarNoiseThreshold") return 0;
  if (field === "scalarDistanceLightStrength") return 0;
  if (field === "scalarSurfaceMaskDepthM")
    return MT_SURFACE_MASK_DEFAULT_DEPTH_M;
  if (field === "scalarSurfaceMaskFeatherM")
    return MT_SURFACE_MASK_DEFAULT_FEATHER_M;
  if (field === "sectionIsoMin") return displayMin;
  if (field === "sectionIsoMax") return displayMax;
  if (field === "sectionIsoLevelCount") return 5;
  if (field === "sectionIsoLineWidth") return 2.6;
  if (field === "sectionIsoBandOpacity") return 0.32;
  if (field === "sectionIsoFillOffset") return 0;
  if (field === "sectionIsoSourceOpacity") return 0;
  return null;
}

export function scalarTransitionStyleChanged(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
): boolean {
  return SCALAR_TRANSITION_STYLE_FIELDS.some((field) => {
    const from = scalarStyleNumber(fromStyle, field);
    const to = scalarStyleNumber(toStyle, field);
    return (
      typeof from === "number" &&
      typeof to === "number" &&
      Math.abs(from - to) > 0.000001
    );
  });
}

export function styleFieldChanged(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  field: keyof EditableStyle,
): boolean {
  return (
    JSON.stringify(fromStyle[field] ?? null) !==
    JSON.stringify(toStyle[field] ?? null)
  );
}

export function styleFieldsChanged(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  fields: readonly (keyof EditableStyle)[],
): boolean {
  return fields.some((field) => styleFieldChanged(fromStyle, toStyle, field));
}

const SCENE_SECTION_TRANSITION_STYLE_FIELDS: readonly (keyof EditableStyle)[] =
  [
    "sceneSectionEnabled",
    "sceneSectionMode",
    "sceneSectionTargetScope",
    "sceneSectionActiveAxis",
    "sceneSectionPlanes",
    "sceneSectionWindowEnabled",
    "sceneSectionWindowActiveAxis",
    "sceneSectionWindowByAxis",
    "sceneSectionTargetLayerIds",
    "sceneSectionTargetProductIds",
    "sceneSectionHelperVisible",
    "sceneSectionGroundTraceVisible",
    "sceneSectionAxesVisible",
  ];

export const SCENE_SECTION_AFFECTED_LAYER_IDS = new Set<string>([
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
]);

export function sceneSectionDiscreteSignature(style: EditableStyle): string {
  const planes = style.sceneSectionPlanes ?? {};
  return JSON.stringify({
    enabled: style.sceneSectionEnabled === true,
    mode: style.sceneSectionMode ?? null,
    targetScope: style.sceneSectionTargetScope ?? null,
    activeAxis: style.sceneSectionActiveAxis ?? null,
    windowEnabled: style.sceneSectionWindowEnabled === true,
    windowActiveAxis: style.sceneSectionWindowActiveAxis ?? null,
    targetLayerIds: style.sceneSectionTargetLayerIds ?? [],
    targetProductIds: style.sceneSectionTargetProductIds ?? [],
    helperVisible: style.sceneSectionHelperVisible !== false,
    groundTraceVisible: style.sceneSectionGroundTraceVisible === true,
    axesVisible: style.sceneSectionAxesVisible === true,
    planes: {
      x: {
        enabled: planes.x?.enabled === true,
        invert: planes.x?.invert === true,
      },
      y: {
        enabled: planes.y?.enabled === true,
        invert: planes.y?.invert === true,
      },
      z: {
        enabled: planes.z?.enabled === true,
        invert: planes.z?.invert === true,
      },
    },
  });
}

export function sceneSectionTransitionStyleChanged(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
): boolean {
  return styleFieldsChanged(
    fromStyle,
    toStyle,
    SCENE_SECTION_TRANSITION_STYLE_FIELDS,
  );
}

export function sceneSectionDiscreteStyleChanged(
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
): boolean {
  return (
    sceneSectionDiscreteSignature(fromStyle) !==
    sceneSectionDiscreteSignature(toStyle)
  );
}

export function forgeDiscreteDataStyleChanged(
  layerId: string,
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  layerSpec?: ProjectLayerSpec,
): boolean {
  if (layerSpec && isTopoMapGraticuleLayer(layerSpec)) {
    return styleFieldsChanged(
      fromStyle,
      toStyle,
      TOPO_MAP_GRATICULE_EDGE_STYLE_FIELDS,
    );
  }
  if (!UTAH_FORGE_DISCRETE_CROSSFADE_LAYER_IDS.has(layerId)) return false;
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    return styleFieldsChanged(fromStyle, toStyle, [
      "scalarVolumeProductId",
      "scalarVolumeRenderMode",
      "scalarVolumeTransferMode",
      "scalarVolumeMaskVisible",
    ]);
  }
  if (layerId === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID) {
    return styleFieldsChanged(fromStyle, toStyle, [
      "mtIsosurfaceProductId",
      "mtSurfaceBoundaryMode",
      "mtSurfaceBoundaryOrder",
      "mtSurfaceBoundariesById",
      "mtThresholdSurfaceVisibility",
      "mtThresholdSurfaceWireframe",
    ]);
  }
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) {
    return styleFieldsChanged(fromStyle, toStyle, [
      "resistivityHorizontalSlicesVisible",
      "resistivityVerticalSectionsVisible",
      "resistivitySliceVisibility",
    ]);
  }
  if (layerId === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) {
    return styleFieldsChanged(fromStyle, toStyle, [
      "seismicProductId",
      "seismicProductVisibility",
      "seismicRenderMode",
      "seismicSliceAxis",
      "seismicSliceFraction",
      "seismicSliceThroughVolume",
      "seismicComparisonProductId",
      "seismicComparisonMode",
      "seismicComparisonSpacingM",
      "seismicNavigationVisible",
      "seismicNavigationRoleVisibility",
      "sectionIsoEnabled",
      "sectionIsoTargetIds",
    ]);
  }
  if (layerId === TOPO_MAP_LEGACY_GRATICULE_LAYER_ID) {
    return styleFieldsChanged(
      fromStyle,
      toStyle,
      TOPO_MAP_GRATICULE_EDGE_STYLE_FIELDS,
    );
  }
  return false;
}
