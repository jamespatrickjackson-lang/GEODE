import * as THREE from "three";
import type {
  EditableStyle,
  EasingName,
  ProjectLayerSpec,
  SceneSectionFrameState,
} from "../../pages/types";
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
  TOPO_MAP_LEGACY_PUBLIC_SURFACE_LAYER_IDS,
  TOPO_MAP_PUBLIC_SURFACE_CLIP_STYLE_FIELDS,
  isTopoMapGraticuleLayer,
  isTopoMapLayer,
} from "../../topoMap/settings";
import type { TransitionCommitGateState } from "./transitionCommitGate";
import type { TransitionAssignmentTrace } from "./transitionRenderGraphAdapter";
import type { TransitionExecutionPlan } from "./transitionExecutionPlan";
import { easeProgress } from "./transitionEasing";

// Re-exported so existing `import { easeProgress } from "./transitionStyles"`
// call sites keep working; the implementation lives in the dependency-free
// transitionEasing module.
export { easeProgress };

const MT_SURFACE_MASK_DEFAULT_DEPTH_M = 25;
const MT_SURFACE_MASK_DEFAULT_FEATHER_M = 175;

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

export type SectionIsoOverlayTransitionRootKind =
  | "mt-volume"
  | "seismic-volume"
  | "seismic-resistivity";

export interface SectionIsoOverlayTransitionRoot {
  kind: SectionIsoOverlayTransitionRootKind;
  layerId: string;
  group: THREE.Group;
  role: "source" | "target";
}

export interface SectionIsoOverlayTransition {
  sourceRoots: SectionIsoOverlayTransitionRoot[];
  targetRoots: SectionIsoOverlayTransitionRoot[];
  startMs: number;
  durationMs: number;
  easing: EasingName;
  targetOpacity: number;
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

export type ProductTransitionFamily =
  | "simple-geometry"
  | "point-markers"
  | "point-cloud"
  | "scalar-volume"
  | "scalar-slices"
  | "mt-isosurfaces"
  | "seismic-volume"
  | "seismic-sections"
  | "section-iso-overlays"
  | "scene-section-helpers";

export type ProductTransitionPolicy =
  | "preserve"
  | "fade-opacity"
  | "interpolate-style"
  | "interpolate-full-density-scalar"
  | "crossfade-discrete"
  | "state-source-only"
  | "translate-section-helpers"
  | "follow-section-iso-style";

export interface ProductTransitionDecision {
  layerId: string;
  layerType: string | null;
  family: ProductTransitionFamily;
  policy: ProductTransitionPolicy;
  transitionKind: LayerTransitionKind;
  stateSource: "loaded-layer" | "authored-layer" | "scene-section-helper";
  loadedAtStart: boolean;
  sourceVisible: boolean;
  targetVisible: boolean;
  sourceOpacity: number;
  targetOpacity: number;
  reason: string;
}

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
  productFamilies: ProductTransitionDecision[];
  sourceLayers: Map<string, ResolvedLayerRenderState>;
  sourceVisibleLayerIds: Set<string>;
  targetVisibleLayerIds: Set<string>;
  targetNotReadyLayerIds: Set<string>;
  sectionIsoStableLayerIds: Set<string>;
  warnedUnexpectedVisibleLayerIds: Set<string>;
  assignmentTraces: TransitionAssignmentTrace[];
  // Execution layer (TRD-013 / DEC-152). The classifier assignments are turned
  // into a plan of per-entity operations. The seismic entity executor consumes
  // its `seismic-entity` operations; protected/existing channels keep their
  // guarded materialization kernels and are mirrored here for trace fidelity.
  executionPlan: TransitionExecutionPlan | null;
  commitState: TransitionCommitGateState;
}

export interface SceneSectionStyleTween {
  fromStyle: EditableStyle;
  toStyle: EditableStyle;
  startMs: number;
  durationMs: number;
  easing: EasingName;
  discreteChanged: boolean;
  maskMode: "interpolated" | "dual-mask";
  appliedDiscreteTarget?: boolean;
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
  "atmosphereDensity",
  "atmosphereSoftness",
  "atmospherePuffCount",
  "atmospherePuffScaleM",
  "atmosphereScaleJitter",
  "atmosphereVerticalFalloff",
  "atmosphereEdgeFade",
  "atmosphereSeed",
  "atmosphereDriftSpeedMps",
  "atmosphereDriftDirectionX",
  "atmosphereDriftDirectionY",
  "atmosphereDriftDirectionZ",
  "atmosphereRenderOrder",
];

const LOCAL_ATMOSPHERE_DISCRETE_STYLE_FIELDS: readonly (keyof EditableStyle)[] =
  [
    "atmosphereSubtype",
    "atmosphereBoundsMode",
    "atmosphereBoundsCenterX",
    "atmosphereBoundsCenterY",
    "atmosphereBoundsCenterZ",
    "atmosphereBoundsSizeX",
    "atmosphereBoundsSizeY",
    "atmosphereBoundsSizeZ",
    "atmosphereDensity",
    "atmosphereSoftness",
    "atmospherePuffCount",
    "atmospherePuffScaleM",
    "atmosphereScaleJitter",
    "atmosphereVerticalFalloff",
    "atmosphereEdgeFade",
    "atmosphereSeed",
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
    "sceneSectionFrameEnabled",
    "sceneSectionActiveFrameId",
    "sceneSectionFrames",
    "sceneSectionFrameByAxis",
    "sceneSectionObjectVisibilityByAxis",
    "sceneSectionObjectVisibilityByFrameId",
    "sceneSectionTargetLayerIds",
    "sceneSectionTargetProductIds",
    "sceneSectionHelperVisible",
    "sceneSectionGroundTraceVisible",
    "sceneSectionAxesVisible",
    "sceneSectionAxisIntervalM",
    "sceneSectionAxisTextScale",
  ];

export const SCENE_SECTION_AFFECTED_LAYER_IDS = new Set<string>([
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
]);

function sceneSectionFrameAlignmentSignature(
  frame: Partial<SceneSectionFrameState>,
): "utm" | "cardinal" {
  return frame.axisAlignment === "cardinal" ? "cardinal" : "utm";
}

function sceneSectionFrameDatumSignature(
  frame: Partial<SceneSectionFrameState>,
): "utm" | "local" | "latlon" {
  return frame.axisDatum === "local" || frame.axisDatum === "latlon"
    ? frame.axisDatum
    : "utm";
}

function finiteSceneSectionFrameNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sceneSectionFrameDiscreteSignature(style: EditableStyle): Array<{
  id: string;
  axis: string | null;
  enabled: boolean;
  invert: boolean;
  frameEnabled: boolean | null;
  controlsVisible: boolean | null;
  groundTraceVisible: boolean | null;
  axisAHeading: string | null;
  axisBHeading: string | null;
  axisHeadingColor: string | null;
  axisAlignment: string | null;
  axisDatum: string | null;
  axisDatumOriginEastingM: number | null;
  axisDatumOriginNorthingM: number | null;
  axisDatumLatLonDecimals: number | null;
}> {
  const planes = style.sceneSectionPlanes ?? {};
  const frames = style.sceneSectionFrameByAxis ?? {};
  const explicit = Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames
    : [];
  const explicitById = new Map(
    explicit
      .filter((entry) => typeof entry?.id === "string" && entry.id.trim())
      .map((entry) => [entry.id, entry]),
  );
  const signatures: Array<{
    id: string;
    axis: string | null;
    enabled: boolean;
    invert: boolean;
    frameEnabled: boolean | null;
    controlsVisible: boolean | null;
    groundTraceVisible: boolean | null;
    axisAHeading: string | null;
    axisBHeading: string | null;
    axisHeadingColor: string | null;
    axisAlignment: string | null;
    axisDatum: string | null;
    axisDatumOriginEastingM: number | null;
    axisDatumOriginNorthingM: number | null;
    axisDatumLatLonDecimals: number | null;
  }> = [];
  for (const axis of ["x", "y", "z"] as const) {
    const id = `axis:${axis}`;
    const explicitEntry = explicitById.get(id);
    const plane = { ...(explicitEntry?.plane ?? {}), ...(planes[axis] ?? {}) };
    const frame = { ...(frames[axis] ?? {}), ...(explicitEntry?.frame ?? {}) };
    const axisDatum = sceneSectionFrameDatumSignature(frame);
    signatures.push({
      id,
      axis,
      enabled: plane.enabled === true,
      invert: plane.invert === true,
      frameEnabled:
        typeof frame.enabled === "boolean" ? frame.enabled : null,
      controlsVisible:
        typeof frame.controlsVisible === "boolean"
          ? frame.controlsVisible
          : null,
      groundTraceVisible:
        typeof frame.groundTraceVisible === "boolean"
          ? frame.groundTraceVisible
          : null,
      axisAHeading:
        typeof frame.axisAHeading === "string" ? frame.axisAHeading : null,
      axisBHeading:
        typeof frame.axisBHeading === "string" ? frame.axisBHeading : null,
      axisHeadingColor:
        typeof frame.axisHeadingColor === "string"
          ? frame.axisHeadingColor
          : null,
      axisAlignment: sceneSectionFrameAlignmentSignature(frame),
      axisDatum,
      axisDatumOriginEastingM:
        axisDatum === "local"
          ? finiteSceneSectionFrameNumber(frame.axisDatumOriginEastingM)
          : null,
      axisDatumOriginNorthingM:
        axisDatum === "local"
          ? finiteSceneSectionFrameNumber(frame.axisDatumOriginNorthingM)
          : null,
      axisDatumLatLonDecimals:
        axisDatum === "latlon"
          ? finiteSceneSectionFrameNumber(frame.axisDatumLatLonDecimals) ?? 3
          : null,
    });
  }
  for (const entry of explicit) {
    if (
      !entry ||
      typeof entry.id !== "string" ||
      !entry.id.trim() ||
      entry.id.startsWith("axis:")
    ) {
      continue;
    }
    const plane = entry.plane ?? {};
    const frame = entry.frame ?? {};
    const axisDatum = sceneSectionFrameDatumSignature(frame);
    signatures.push({
      id: entry.id,
      axis:
        entry.axis === "x" || entry.axis === "y" || entry.axis === "z"
          ? entry.axis
          : null,
      enabled: plane.enabled === true,
      invert: plane.invert === true,
      frameEnabled:
        typeof frame.enabled === "boolean" ? frame.enabled : null,
      controlsVisible:
        typeof frame.controlsVisible === "boolean"
          ? frame.controlsVisible
          : null,
      groundTraceVisible:
        typeof frame.groundTraceVisible === "boolean"
          ? frame.groundTraceVisible
          : null,
      axisAHeading:
        typeof frame.axisAHeading === "string" ? frame.axisAHeading : null,
      axisBHeading:
        typeof frame.axisBHeading === "string" ? frame.axisBHeading : null,
      axisHeadingColor:
        typeof frame.axisHeadingColor === "string"
          ? frame.axisHeadingColor
          : null,
      axisAlignment: sceneSectionFrameAlignmentSignature(frame),
      axisDatum,
      axisDatumOriginEastingM:
        axisDatum === "local"
          ? finiteSceneSectionFrameNumber(frame.axisDatumOriginEastingM)
          : null,
      axisDatumOriginNorthingM:
        axisDatum === "local"
          ? finiteSceneSectionFrameNumber(frame.axisDatumOriginNorthingM)
          : null,
      axisDatumLatLonDecimals:
        axisDatum === "latlon"
          ? finiteSceneSectionFrameNumber(frame.axisDatumLatLonDecimals) ?? 3
          : null,
    });
  }
  return signatures.sort((a, b) => a.id.localeCompare(b.id));
}

export function sceneSectionDiscreteSignature(style: EditableStyle): string {
  return JSON.stringify({
    enabled: style.sceneSectionEnabled === true,
    mode: style.sceneSectionMode ?? null,
    targetScope: style.sceneSectionTargetScope ?? null,
    windowEnabled: style.sceneSectionWindowEnabled === true,
    windowActiveAxis: style.sceneSectionWindowActiveAxis ?? null,
    frameEnabled: style.sceneSectionFrameEnabled === true,
    frames: sceneSectionFrameDiscreteSignature(style),
    targetLayerIds: style.sceneSectionTargetLayerIds ?? [],
    targetProductIds: style.sceneSectionTargetProductIds ?? [],
    groundTraceVisible: style.sceneSectionGroundTraceVisible === true,
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
  const topoLayer =
    (layerSpec && isTopoMapLayer(layerSpec)) ||
    (TOPO_MAP_LEGACY_PUBLIC_SURFACE_LAYER_IDS as readonly string[]).includes(
      layerId,
    );
  if (
    topoLayer &&
    styleFieldsChanged(
      fromStyle,
      toStyle,
      TOPO_MAP_PUBLIC_SURFACE_CLIP_STYLE_FIELDS,
    )
  ) {
    return true;
  }
  if (layerSpec && isTopoMapGraticuleLayer(layerSpec)) {
    return styleFieldsChanged(
      fromStyle,
      toStyle,
      TOPO_MAP_GRATICULE_EDGE_STYLE_FIELDS,
    );
  }
  if (layerSpec?.type === "atmosphere-volume") {
    return styleFieldsChanged(
      fromStyle,
      toStyle,
      LOCAL_ATMOSPHERE_DISCRETE_STYLE_FIELDS,
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
