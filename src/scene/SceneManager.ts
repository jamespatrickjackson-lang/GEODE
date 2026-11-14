import * as THREE from "three";
import type {
  EditableStyle,
  AreaOutlineDef,
  EnvironmentSetup,
  EasingName,
  Pose,
  PresentationPage,
  ProjectLayerSpec,
  SceneProperties,
  Vec3,
} from "../pages/types";
import {
  effectiveStyle,
  effectiveVisibility,
} from "../pages/effective";
import {
  activeRenderPresetIdForPage,
} from "../pages/renderPresets";
import type { PostHandle } from "./postprocessing";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { SceneOverlayHandle } from "../loaders/loadSceneOverlays";
import type { GeologyHandle } from "../loaders/loadGeology";
import { loadMeshPreview } from "../loaders/loadMeshPreview";
import {
  setDistanceAttenuatedLineWidth,
} from "../loaders/topoLineMaterial";
import {
  applyMtThresholdSurfaceMaterialOpacity,
  createMtThresholdSurfaceMaterial,
  MT_THRESHOLD_SURFACE_POLICY,
  SURFACE_RENDER_ORDER,
} from "../loaders/surfaceRenderPolicy";
import type { SceneOverlayDef } from "../pages/types";
import { disposeObjectTree } from "./disposeObjectTree";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import {
  DEFAULT_MT_SURFACE_BOUNDARIES,
  resolveMtSurfaceBoundaries,
  type MtSurfaceBoundaryDefinition,
  type ResolvedMtSurfaceBoundary,
} from "../projectModules/utahForge/mtSurfaceBoundaries";
import { CASE_STUDY_B_DEMO_SHELL_LAYER_ID } from "../projectModules/caseStudyB/layerIds";
import { CASE_STUDY_B_DEMO_LAYER_ALIASES } from "../projectModules/caseStudyB/demoLayerAliases";
import {
  SHAHBAZI_GROUND_CONTOUR_LAYER_ID,
} from "../projectModules/shahbazi/layerIds";
import {
  scalarSourceRange,
} from "./styles/colorScales";
import {
  isScalarSectionMesh,
  scalarSectionMeshId,
  scalarSectionMeshKind,
  scalarSectionMeshLabel,
  scalarSectionTargetKey,
  seismicSectionMeshId,
  seismicSectionMeshKind,
  seismicSectionMeshLabel,
  seismicSectionTargetKey,
} from "./isoOverlays/sectionIsoOverlay";
import {
  buildMtVolumeCutMeshImpl,
  buildSeismicVolumeCutMeshImpl,
  clearMtVolumeCutIsoOverlaysImpl,
  clearSeismicResistivityIsoOverlaysImpl,
  clearSeismicVolumeCutIsoOverlaysImpl,
  listMtVolumeCutIsoTargetsImpl,
  listSeismicResistivitySectionIsoTargetsImpl,
  listSeismicResistivityVolumeCutIsoTargetsImpl,
  listSeismicVolumeCutIsoTargetsImpl,
  sampleScalarVolumeByteImpl,
  scalarVolumeIsoOverlayGroupImpl,
  seismicResistivityIsoOverlayGroupImpl,
  seismicVolumeIsoOverlayGroupImpl,
  updateMtVolumeCutIsoOverlaysImpl,
  updateSeismicResistivityIsoOverlaysImpl,
  updateSeismicVolumeCutIsoOverlaysImpl,
  type SectionIsoOverlayUpdateOptions,
} from "./isoOverlays/volumeCutIsoOverlays";
import {
  type LayerOpacityTween,
  type LayerTransitionSnapshot,
  type NavigationReason,
  type ProductTransitionDecision,
  type ResolvedLayerRenderState,
  type ScalarStyleTween,
  type SectionIsoOverlayTransition,
  type SectionIsoOverlayTransitionRootKind,
  type SceneSectionStyleTween,
  type SceneTransitionContext,
  type WorkingAreaFocusStyleTween,
  easeProgress,
} from "./transitions/transitionStyles";
import type { TransitionAssignmentTrace } from "./transitions/transitionRenderGraphAdapter";
import {
  recordTransitionCommitAttempt as recordTransitionCommitAttemptImpl,
  reapplyReasonBypassesPostCommitSuppression,
  transitionCommitGraphFromAssignmentTraces,
  type TransitionCommitGraph,
  type TransitionCommitTrace,
} from "./transitions/transitionCommitGate";
import { observeTransitionCommitGraph } from "./transitions/transitionCommitObserver";
import { replanTransitionEntityReadiness } from "./transitions/transitionExecutionPlan";
import { DEFAULT_DETACHED_FADE_MS } from "./transitions/transitionDefaults";
import {
  AreaOutlineController,
  type AreaOutlinePreview,
} from "./outlines/AreaOutlineController";
import {
  applyDrillingAssayDisplay as applyDrillingAssayDisplayToLayers,
  applyTopoDetailDistanceDisplay as applyTopoDetailDistanceDisplayToLayers,
} from "./styles/drillingAndTopoDisplay";
import { applyScalarPreviewStyle as applyScalarPreviewStyleToLayer } from "./styles/scalarPreviewStyle";
import { applyScalarVolumeStyle as applyScalarVolumeStyleImpl } from "./styles/scalarVolumeStyle";
import { applyMtThresholdSurfaceStyle as applyMtThresholdSurfaceStyleImpl } from "./styles/mtThresholdSurfaceStyle";
import {
  applyMtSurfaceMaskStyleImpl,
  applyMtTopSurfaceStyleImpl,
  applyPointMarkerStyleImpl,
  applyResistivitySliceStyleImpl,
  applySurfaceGradientStyleImpl,
  restoreMtSurfaceMaskMaterialsImpl,
  updateMtSurfaceMaskForPointsImpl,
} from "./styles/mtResistivityStyles";
import { applySeismicBrowserStyle as applySeismicBrowserStyleToLayer } from "./styles/seismicBrowserStyle";
import {
  findLocalAtmosphereVolumeRoot,
  getLocalAtmospherePreview,
  getLocalAtmosphereWorldCenter,
  listLocalAtmospherePickables,
  previewLocalAtmosphereMove,
  previewLocalAtmosphereSizeFromWorld,
  tickLocalAtmosphereVolumeLayers,
  type LocalAtmosphereHandleMode,
  type LocalAtmospherePreview,
} from "./atmosphere/localAtmosphereVolume";
export type { LocalAtmosphereHandleMode, LocalAtmospherePreview };
import {
  applyDemoBoreholeStyle as applyDemoBoreholeStyleToLayer,
  applyEzGammaStyle as applyEzGammaStyleToLayer,
  applyGeochemStyle as applyGeochemStyleToLayer,
  applyHyperspectralStyle as applyHyperspectralStyleToLayer,
  applyImageryLidarAoiStyle as applyImageryLidarAoiStyleToLayer,
  applyUtahForgeBoreholeLogStyle as applyUtahForgeBoreholeLogStyleToLayer,
} from "./styles/siteDetailStyles";
import {
  clamp01,
  clampRange,
  styleNumber,
} from "./styles/styleUtils";
import {
  SceneOverlaysController,
  type SceneOverlayDebugState,
  type SceneOverlayTransitionClock,
} from "./overlays/SceneOverlaysController";
import {
  applySceneSectionHelperTransitionOpacity as applySceneSectionHelperTransitionOpacityImpl,
  applySceneSectionMaterial as applySceneSectionMaterialImpl,
  applySceneSectionPlanes as applySceneSectionPlanesImpl,
  createSceneSectionLabel as createSceneSectionLabelImpl,
  createSceneSectionScaleLabel as createSceneSectionScaleLabelImpl,
  currentSceneSectionStyle as currentSceneSectionStyleImpl,
  ensureSceneSectionRuntime as ensureSceneSectionRuntimeImpl,
  getSceneSectionPlaneNormal as getSceneSectionPlaneNormalImpl,
  getSceneSectionPlanePosition as getSceneSectionPlanePositionImpl,
  getSceneSectionPlaneScalar as getSceneSectionPlaneScalarImpl,
  getSceneSectionWindowNormal as getSceneSectionWindowNormalImpl,
  getSceneSectionWindowValue as getSceneSectionWindowValueImpl,
  interpolatedSceneSectionStyle as interpolatedSceneSectionStyleImpl,
  sceneSectionTweenStyle as sceneSectionTweenStyleImpl,
  listSceneSectionObjectTargets as listSceneSectionObjectTargetsImpl,
  listSceneSectionPlanePickables as listSceneSectionPlanePickablesImpl,
  previewSceneSectionPlane as previewSceneSectionPlaneImpl,
  previewSceneSectionWindow as previewSceneSectionWindowImpl,
  rebuildSceneSectionHelpers as rebuildSceneSectionHelpersImpl,
  reapplySceneSectionPlanes as reapplySceneSectionPlanesImpl,
  resolveSceneSectionFrames as resolveSceneSectionFramesImpl,
  resolveSceneSectionPlanes as resolveSceneSectionPlanesImpl,
  resolveSceneSectionWindow as resolveSceneSectionWindowImpl,
  sceneSectionActivePlanes as sceneSectionActivePlanesImpl,
  sceneSectionAxisAlongIndex as sceneSectionAxisAlongIndexImpl,
  sceneSectionBounds as sceneSectionBoundsImpl,
  sceneSectionClippingPlanes as sceneSectionClippingPlanesImpl,
  sceneSectionFrameClippingPlanes as sceneSectionFrameClippingPlanesImpl,
  sceneSectionFrameForObject as sceneSectionFrameForObjectImpl,
  sceneSectionHelperExitSnapshotNeeded as sceneSectionHelperExitSnapshotNeededImpl,
  sceneSectionHelperOpacityForTween as sceneSectionHelperOpacityForTweenImpl,
  sceneSectionHelperSnapshotAllowedForTween as sceneSectionHelperSnapshotAllowedForTweenImpl,
  sceneSectionMaskTransitionForTween as sceneSectionMaskTransitionForTweenImpl,
  sceneSectionLayerIds as sceneSectionLayerIdsImpl,
  sceneSectionObjectVisibilityForObject as sceneSectionObjectVisibilityForObjectImpl,
  sceneSectionObjectTargeted as sceneSectionObjectTargetedImpl,
  sceneSectionProductIds as sceneSectionProductIdsImpl,
  setSceneSectionUniforms as setSceneSectionUniformsImpl,
  updateSceneSectionPlanarTextFacing as updateSceneSectionPlanarTextFacingImpl,
} from "./section/sceneSectionController";
import {
  applySceneSectionObjectVisibilityBuiltInMaterial,
} from "./shaders/sceneSectionObjectVisibilityShader";
import {
  applyWorkingAreaFocusMaterialImpl,
  applyWorkingAreaFocusStyleImpl,
  cleanWorkingAreaFocusVectorImpl,
  ensureWorkingAreaFocusRuntimeImpl,
  getWorkingAreaFocusDebugStateImpl,
  interpolatedWorkingAreaFocusStyleImpl,
  rebuildWorkingAreaFocusHelperImpl,
  reapplyWorkingAreaFocusImpl,
  resolveWorkingAreaFocusBoundsImpl,
  setKnownShaderWorkingAreaFocusImpl,
  transitionWorkingAreaFocusForPageImpl,
  workingAreaFocusOutsideOpacityImpl,
  workingAreaFocusSegmentPositionsImpl,
  workingAreaFocusStateImpl,
  workingAreaFocusTargetLayerIdsImpl,
  type WorkingAreaFocusRuntime,
  type WorkingAreaFocusState,
} from "./workingArea/workingAreaFocusController";
import {
  isTopoMapGraticuleLayer,
  isTopoMapSurfaceLayer,
  topoMapRuntimeLayerIds,
} from "../topoMap/settings";
import {
  createTopoMapRuntime,
  type TopoMapRuntime,
} from "../topoMap/runtime";
import { peekHeightSampler } from "./heightSampler";
import {
  applyCinematicPostProcessing,
  applyEnvironment as applyEnvironmentImpl,
} from "./environment/applyEnvironment";
import {
  type EnvironmentSunVisualRuntime,
  updateEnvironmentSunVisualDirection,
} from "./environment/sunVisual";
import { applyLakesToTerrain as applyLakesToTerrainImpl } from "./terrain/applyLakesToTerrain";
import {
  applySiteSurfaceGuideStyleImpl,
  applyTerrainCompositeOpacityImpl,
  applyTerrainCompositeStyleImpl,
  applyTerrainFogStyleImpl,
  applyTerrainLiftStyleImpl,
  buildSiteGuideFillGeometryImpl,
  isSiteSurfaceGuideLayerIdImpl,
  pointInSiteGuideRingImpl,
  reapplySiteSurfaceGuidesImpl,
  resampleSiteGuideLineImpl,
  siteGuideRingImpl,
  siteGuideSurfaceZImpl,
  siteSurfaceGuideOriginImpl,
  sourceSiteGuideLinesImpl,
  updateSiteSurfaceGuideImpl,
} from "./terrain/terrainStyleController";
import { transitionEffectiveLayersForPage as transitionEffectiveLayersForPageImpl } from "./transitions/transitionEffectiveLayersForPage";
import {
  applyEntityBehaviorFrame,
  applyEntityOpacityFade,
} from "./transitions/entityBehaviorApplier";
import {
  blendCinematicSceneForTransition,
  cinematicSceneTransitionDebugState,
  createCinematicSceneTransition,
  inactiveCinematicSceneTransitionDebugState,
  resolveCinematicSceneForTransition,
  type CinematicSceneTransitionDebugState,
  type CinematicSceneTransitionRuntime,
} from "./transitions/cinematicSceneTransitions";
import {
  blendEnvironmentSceneTransitionFrame,
  createEnvironmentSceneTransition,
  syntheticSceneForEnvironmentFrame,
  type EnvironmentSceneTransitionFrame,
  type EnvironmentSceneTransitionRuntime,
} from "./transitions/environmentSceneTransition";
import {
  enforceTransitionVisibilityEnvelopeImpl,
  interpolatedScalarStyleImpl,
  tickLayerTweensImpl,
  transitionEnvelopeAllowsLayerImpl,
  transitionFrameOpacityForLayerImpl,
  warnUnexpectedTransitionLayerImpl,
} from "./transitions/layerTweenRuntime";
import { tickSeismicGraphTransitionImpl } from "./transitions/seismicGraphTransitionExecutor";
import { applyStyle as applyStyleImpl } from "./styles/applyLayerStyle";
import { setMaterialFog } from "./shaders/layerFogShader";
import {
  addLightingStudioHandleImpl,
  addLightingStudioSourceImpl,
  clearLightingStudioSourcesImpl,
  createOrbitCenterHandleImpl,
  createPageCameraLabelImpl,
  createPageCameraMarkerImpl,
  lightingHandleKeyImpl,
  listPageCameraMarkerPickablesImpl,
  makeLightingHandleMaterialImpl,
  makeOrbitCenterMaterialImpl,
  markLightingPickableImpl,
  markOrbitCenterPickableImpl,
  markPageCameraPickableImpl,
  setGlobalPageCameraMarkersImpl,
  setPageCameraMarkerImpl,
  setStudioSceneElementsVisibleImpl,
  updateDynamicCameraOrbitCenterScaleImpl,
  updateLightingStudioElementScaleImpl,
  updateLightingStudioHelpersImpl,
  updatePageCameraMarkerLineImpl,
  updatePageCameraMarkerPoseImpl,
  updatePageCameraMarkerScaleImpl,
  updatePageCameraMarkerVisibilityImpl,
  updatePageCameraMarkersScaleImpl,
  type LightingHandleKind,
  type LightingHandleMode,
  type LightingHandleRuntime,
  type LightingStudioRuntime,
  type OrbitCenterHandleRuntime,
  type PageCameraMarkerRuntime,
} from "./handles/sceneHandleControllers";
import { extractRuntimeMarchingCubesGeometry } from "../mtResistivity/runtimeMarchingCubes";

export type {
  AreaOutlineHandleMode,
  AreaOutlinePreview,
} from "./outlines/AreaOutlineController";

// Fade duration matches the markdown overlay panel (OverlayDisplay's
// FADE_MS) so chapter transitions feel coherent across UI surfaces. Shared
// detached-fade default (A7) so this and SCENE_OVERLAY_FADE_MS tune together.
const DEFAULT_LAYER_FADE_MS = DEFAULT_DETACHED_FADE_MS;
const READINESS_ENTER_MIN_REMAINING_MS = 150;
// F3 fade floor: minimum fade duration for a near-end late arrival so the
// pipeline fades it in instead of snapping to full opacity (flag ON only).
const ENTITY_BEHAVIOR_FADE_FLOOR_MS = 250;
// Editor/legend visibility toggles fade rather than snap (7.3), matching the
// slider-style standard. Page loads and transitions stay instant.
const VISIBILITY_TOGGLE_FADE_MS = 360;
// Throttle for regenerating the Section ISO contours so they follow a moving
// section cut. The contour rebuild is ~30-40ms, so regenerating every frame
// would tank the transition; ~70ms gives a stepped follow that reads as smooth
// while keeping headroom (DEC-168).
const SECTION_ISO_MOVE_FOLLOW_INTERVAL_MS = 70;
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
const DEFAULT_CONTOUR_DISTANCE_FADE_NEAR_M = 80;
const DEFAULT_CONTOUR_DISTANCE_FADE_FAR_M = 420;
const DEFAULT_CONTOUR_FAR_LINE_SCALE = 0.28;
const DEFAULT_CONTOUR_FAR_OPACITY = 0.72;
const DEFAULT_CONTOUR_LIFT_M = 0;
const DEFAULT_SCENE_FOG_DENSITY = 0.00018;


// SceneManager. Owns lights, fog, post chain config, layer registry.
//
// Sky concept removed (Week 4 iteration #2): the entire frame now
// dissolves into a single neutral "fog/background" color -- no horizon,
// no gradient backdrop, no edges. Renderer clear color and FogExp2 share
// the same color. Sun direction still drives the key light + terrain
// hillshade; it just doesn't paint a sky any more.
//
// Sun direction can stay world/model anchored or follow the camera when
// env.scene.sun.lockToCamera is enabled. The same vector drives the key
// light and terrain hillshade.

function isContourLikeLayerId(id: string): boolean {
  const lower = id.toLowerCase();
  return lower.includes("contour") || lower.includes("isoline");
}


type PresentationLightSource = NonNullable<
  NonNullable<SceneProperties["lighting"]>["sources"]
>[number];

export type OrbitCenterHandleMode = "plane" | "x" | "y" | "z";
export type SceneSectionAxis = "x" | "y" | "z";
export type SceneSectionWindowHandleKind =
  | "window-min"
  | "window-max"
  | "window-bottom"
  | "frame-min-a"
  | "frame-max-a"
  | "frame-min-b"
  | "frame-max-b";
export type SectionIsoTargetGroup =
  | "mt-slices"
  | "mt-volume-cuts"
  | "seismic-sections"
  | "seismic-volume-cuts"
  | "resistivity-on-seismic-sections"
  | "resistivity-on-seismic-volume-cuts";

export interface ScalarSectionIsoTarget {
  targetKey: string;
  layerId: string;
  sectionId: string;
  label: string;
  kind: string;
  group: SectionIsoTargetGroup;
  groupLabel: string;
  visible: boolean;
  scalarMin: number;
  scalarMax: number;
  isoSource?: "seismic-amplitude" | "mt-resistivity";
  sourceLayerId?: string;
}

export interface ResolvedSceneSectionPlane {
  frameId: string;
  label: string;
  axis: SceneSectionAxis;
  enabled: boolean;
  positionM: number;
  signedDistanceM: number;
  point: THREE.Vector3;
  invert: boolean;
  normal: THREE.Vector3;
  axisAVector: THREE.Vector3;
  axisBVector: THREE.Vector3;
}

export interface ResolvedSceneSectionWindow {
  axis: Exclude<SceneSectionAxis, "z">;
  minAlongM: number;
  maxAlongM: number;
  bottomElevationM: number;
  alongIndex: 0 | 1;
}

export interface ResolvedSceneSectionFrame {
  frameId: string;
  label: string;
  axis: SceneSectionAxis;
  enabled: boolean;
  controlsVisible: boolean;
  minAM: number;
  maxAM: number;
  minBM: number;
  maxBM: number;
  axisAIndex: 0 | 1 | 2;
  axisBIndex: 0 | 1 | 2;
  signedDistanceM: number;
  axisAVector: THREE.Vector3;
  axisBVector: THREE.Vector3;
  normal: THREE.Vector3;
  center: THREE.Vector3;
  axisAlignment: "utm" | "cardinal";
  axisDatum: "utm" | "local" | "latlon";
  axisDatumOriginEastingM: number;
  axisDatumOriginNorthingM: number;
  axisDatumLatLonDecimals: number;
  utmZone: number | null;
  groundTraceVisible: boolean;
  groundTraceWidthM: number;
  axesVisible: boolean;
  axisIntervalM: number;
  axisTextScale: number;
  axisTextPaddingM: number;
  axisAHeading: string;
  axisBHeading: string;
  axisHeadingPaddingM: number;
  axisHeadingColor: string;
  axisHeadingScale: number;
}

export interface SceneSectionObjectTarget {
  objectId: string;
  label: string;
  layerId: string;
  productId?: string;
  representationKind?: "section" | "volume";
  supported: boolean;
  visible: boolean;
  axes: SceneSectionAxis[];
}

export interface SceneSectionObjectVisibility {
  objectId?: string;
  outsideOpacityByAxis: Record<SceneSectionAxis, number>;
  outsideOpacityByFrameId: Record<string, number>;
  active: boolean;
  hasSoftOpacity: boolean;
}

export interface SceneSectionMaskUniformState {
  planes: ResolvedSceneSectionPlane[];
  frames: ResolvedSceneSectionFrame[];
  visibility: SceneSectionObjectVisibility;
}

export interface SceneSectionMaskTransition {
  progress: number;
  source: SceneSectionMaskUniformState;
  target: SceneSectionMaskUniformState;
}

export interface SceneSectionStyleMaskTransition {
  fromStyle: EditableStyle;
  toStyle: EditableStyle;
  progress: number;
}

export interface SceneSectionApplyOptions {
  transitionFrame?: boolean;
  maskTransition?: SceneSectionStyleMaskTransition | null;
}

export interface SceneSectionRuntime {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  planes: Map<string, THREE.Object3D>;
}


export interface PageCameraMarkerSpec {
  id: string;
  title: string;
  pose: Pose;
  color: string;
}

interface LateReapplyDebugEvent {
  sequence: number;
  reason:
    | "state-reapply"
    | "async-layer-resolve"
    | "editor-deferred-flush"
    | "geology-register";
  action:
    | "transition-envelope"
    | "transition-aware-current-page-state"
    | "full-current-page-state";
  pageId: string | null;
  duringTransition: boolean;
  transitionSourcePageId: string | null;
  transitionTargetPageId: string | null;
  transitionReason: NavigationReason | null;
  transitionProgress: number | null;
  timeMs: number;
}

interface LateReapplyDebugState {
  totalCount: number;
  duringTransitionCount: number;
  events: LateReapplyDebugEvent[];
}

type ReapplyCurrentPageStateReason =
  | "state-reapply"
  | "async-layer-resolve"
  | "editor-deferred-flush";

interface SceneSectionApplyDebugState {
  totalMs: number;
  boundsMs: number;
  frameResolveMs: number;
  materialApplyMs: number;
  helperRebuildMs: number;
  helperOpacityMs: number;
  mtCutIsoMs: number;
  mtCutIsoUpdate: MtVolumeCutIsoUpdateDebugState | null;
  seismicCutIsoMs: number;
  traversedObjectCount: number;
  materialApplyCount: number;
  helperObjectCount: number;
}

interface MtVolumeCutIsoUpdateDebugState {
  policy: "full-rebuild";
  totalMs: number;
  clearMs: number;
  setupMs: number;
  meshBuildMs: number;
  meshBuildSetupMs: number;
  meshBuildFrameRangeMs: number;
  meshBuildBufferAllocMs: number;
  meshBuildGridSampleMs: number;
  meshBuildIndexMs: number;
  meshBuildGeometryMs: number;
  meshBuildMaterialMs: number;
  meshBuildMeshObjectMs: number;
  meshBuildVertexCount: number;
  meshBuildIndexCount: number;
  overlayUpdateMs: number;
  overlayDebug: ScalarSectionIsoOverlayUpdateDebugState;
  attachMs: number;
  disposeMs: number;
  planesCount: number;
  selectedPlaneCount: number;
  cutsBuiltCount: number;
  overlayRootCount: number;
  gridSize: number;
  skippedReason: string | null;
}

interface ScalarSectionIsoOverlayUpdateDebugState {
  totalMs: number;
  disposeMs: number;
  rootCreateMs: number;
  bandMeshMs: number;
  lineGeometryMs: number;
  lineMaterialMs: number;
  attachMs: number;
  lineGeometryDebug: ScalarSectionIsoLineGeometryDebugState;
  bandMeshCount: number;
  lineMeshCount: number;
  lineSourceSegmentCount: number;
  lineTinySegmentCount: number;
  linePolylineCount: number;
  lineSimplifiedPointCount: number;
  lineRibbonSegmentCount: number;
  lineSnapToleranceM: number;
  skippedReason: string | null;
}

interface ScalarSectionIsoLineGeometryDebugState {
  timingMode: "coarse-pass";
  totalMs: number;
  setupMs: number;
  contourPassMs: number;
  triangleScanMs: number;
  triangleIntersectionMs: number;
  segmentRecordMs: number;
  segmentStitchMs: number;
  stitchNodeBuildMs: number;
  stitchTraversalMs: number;
  stitchPointAssemblyMs: number;
  stitchLengthFilterMs: number;
  stitchNormalMs: number;
  polylineSimplifyMs: number;
  ribbonExtrudeMs: number;
  geometryCreateMs: number;
  triangleCount: number;
  maskedTriangleCount: number;
  invalidTriangleCount: number;
  degenerateTriangleCount: number;
  levelCandidateCount: number;
  intersectionAttemptCount: number;
}

interface LayerTweenTickDebugState {
  timestampMs: number;
  totalMs: number;
  sceneSectionMs: number;
  sceneSectionApply: SceneSectionApplyDebugState | null;
  workingAreaMs: number;
  scalarMs: number;
  layerMs: number;
  snapshotMs: number;
  helperSnapshotMs: number;
  envelopeMs: number;
  activeSceneTransition: boolean;
  sceneSectionApplyMode: "none" | "full" | "helper-opacity-only";
  layerTweenIds: string[];
  scalarTweenIds: string[];
  snapshotIds: string[];
  layerTweenCountBefore: number;
  scalarTweenCountBefore: number;
  snapshotCountBefore: number;
  sceneSectionStyleTweenActiveBefore: boolean;
  helperSnapshotActiveBefore: boolean;
  workingAreaFocusTweenActiveBefore: boolean;
}

interface FrameUpdateDebugState {
  timestampMs: number;
  totalMs: number;
  cameraLockedSunMs: number;
  layerTweensMs: number;
  environmentSceneMs: number;
  cinematicPostMs: number;
  boreLensMs: number;
  lightingStudioScaleMs: number;
  dynamicCameraOrbitCenterScaleMs: number;
  pageCameraMarkerScaleMs: number;
  ezGammaBillboardMs: number;
  sceneSectionTextFacingMs: number;
  sectionIsoThresholdOcclusionMs: number;
  topoGridCameraVisibilityMs: number;
  localAtmosphereMs: number;
  sceneOverlayTickMs: number;
  activeSceneTransition: boolean;
}

interface SectionIsoOverlayDebugState {
  opacityPolicy: "split-section-iso-overlay-opacity-from-layer-opacity";
  overlayMaterialCount: number;
  independentOverlayMaterialCount: number;
  transitionEnvelopeOverlayMaterialCount: number;
  hiddenWithParentMaterialCount: number;
  layerRenderOpacityMin: number | null;
  layerRenderOpacityMax: number | null;
  transitionOpacityMin: number | null;
  transitionOpacityMax: number | null;
}

interface SceneSectionHelperDebugState {
  groundTracePolicy: "mirror-delayed-ground-trace-into-helper-snapshot";
  liveGroundTraceCount: number;
  snapshotGroundTraceCount: number;
  snapshotActive: boolean;
  transitionOpacity: number;
}

function transitionDebugMs(value: number): number {
  return Number(Math.max(0, value).toFixed(3));
}


export class SceneManager {
  private layers = new Map<string, THREE.Group>();
  private layerSpecs = new Map<string, ProjectLayerSpec>();
  // Capture fidelity lock state. While active, the scene renders for output:
  // seismic holds the source LOD tier (no transient downgrade), raymarch volumes
  // use max sample steps, and per-layer upgraders (e.g. draped vector re-bake)
  // run. Restored to the live profile on lock release.
  private captureFidelityActive = false;
  private captureFidelityLoadPromises: Promise<void>[] = [];
  envHemiLight: THREE.HemisphereLight | null = null;
  private envKeyLight: THREE.DirectionalLight | null = null;
  envFillLight: THREE.DirectionalLight | null = null;
  envRimLight: THREE.DirectionalLight | null = null;
  envCustomLights: THREE.Light[] = [];
  envCustomLightTargets: THREE.Object3D[] = [];
  envLightHelperGroup: THREE.Group | null = null;
  envSunVisual: EnvironmentSunVisualRuntime | null = null;
  envLightRuntimes = new Map<string, LightingStudioRuntime>();
  envLightHandles = new Map<string, LightingHandleRuntime>();
  envLightHandlePickables: THREE.Object3D[] = [];
  orbitCenterHandle: OrbitCenterHandleRuntime | null = null;
  pageCameraMarker: PageCameraMarkerRuntime | null = null;
  globalPageCameraMarkers = new Map<string, PageCameraMarkerRuntime>();
  private sceneSectionRuntime: SceneSectionRuntime | null = null;
  private readonly topoRuntime: TopoMapRuntime;
  private workingAreaFocusRuntime: WorkingAreaFocusRuntime | null = null;
  private lastSceneSectionStyle: EditableStyle = {};
  private lastWorkingAreaFocusStyle: EditableStyle = {};
  currentWorkingAreaFocusStyle: EditableStyle = {};
  private sceneSectionClippingActive = false;
  private publicSurfaceClippingActive = false;
  private appliedLayerStyles = new Map<string, EditableStyle>();
  private editorMode = true;
  studioSceneElementsVisible = true;
  envFog: THREE.FogExp2 | null = null;
  envFogEnabled = true;
  envFogDensity = DEFAULT_SCENE_FOG_DENSITY;
  private postHandle: PostHandle | null = null;
  activeCamera: THREE.Camera | null = null;
  private baseExposure = 1.0;
  private currentSunDir = new THREE.Vector3(0.6, -0.4, 0.7).normalize();
  private authoredWorldSunDir = new THREE.Vector3(0.6, -0.4, 0.7).normalize();
  private baseSunLockToCamera = false;
  private sunLockToCamera = false;
  private pendingCameraSunCapture = false;
  lastSunConfigKey = "";
  private readonly cameraLocalSunDir = new THREE.Vector3(
    0.6,
    -0.4,
    0.7,
  ).normalize();
  private readonly pendingCameraSunWorldDir = new THREE.Vector3(
    0.6,
    -0.4,
    0.7,
  ).normalize();
  private readonly cameraSunRight = new THREE.Vector3();
  private readonly cameraSunUp = new THREE.Vector3();
  private readonly cameraSunBack = new THREE.Vector3();
  readonly previousSunDir = new THREE.Vector3();
  private readonly boreLensPos = new THREE.Vector3();
  private readonly boreLensNormal = new THREE.Vector3();
  private readonly boreLensToCamera = new THREE.Vector3();
  readonly studioHandleWorldPos = new THREE.Vector3();
  readonly orbitCenterWorldPos = new THREE.Vector3();
  readonly pageCameraMarkerWorldPos = new THREE.Vector3();
  private readonly ezGammaWorldPos = new THREE.Vector3();
  private readonly ezGammaToCamera = new THREE.Vector3();
  private readonly sectionIsoThresholdRaycaster = new THREE.Raycaster();
  private readonly sectionIsoThresholdRayOrigin = new THREE.Vector3();
  private readonly sectionIsoThresholdRayTarget = new THREE.Vector3();
  private readonly sectionIsoThresholdRayDirection = new THREE.Vector3();
  private readonly sectionIsoThresholdSurfaces: THREE.Object3D[] = [];
  private readonly sectionIsoThresholdLineOverlays: THREE.Mesh[] = [];
  private readonly sectionIsoThresholdSeenSurfaceIds = new Set<string>();
  private readonly sectionIsoThresholdSamplePoints = [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ];
  private sceneSectionHelperTransitionSnapshot: LayerTransitionSnapshot | null =
    null;
  // Last env applied. Stashed so a layer that arrives after the initial
  // applyEnvironment call (terrain is async, loadTerrain resolves later
  // than the PageController mount effect) can trigger a re-apply once
  // its userData.terrainHandle exists. Without this, terrain material
  // uniforms ran on buildTerrainMaterial's construction-time defaults
  // until the user touched any env control.
  private lastEnv: EnvironmentSetup | null = null;
  // Last effective page state applied by PageController. Async loaders often
  // resolve after the initial visibility/style pass; replaying this state keeps
  // freshly-added meshes from showing loader defaults until the next UI edit.
  private lastEffectiveEnv: EnvironmentSetup | null = null;
  private lastEffectivePage: PresentationPage | null = null;
  // Page-to-page layer fades. Keyed by layer id; frameUpdate advances material
  // opacity and terrain-composite uniforms until the target page state settles.
  private layerTweens = new Map<string, LayerOpacityTween>();
  // Editor/legend visibility-toggle fades (7.3). Kept separate from layerTweens
  // so a non-transition toggle never reaches the transition completion / commit
  // gate bookkeeping (which falls back to lastTransitionCommitState). Advanced
  // by frameUpdate; an OFF fade hides the group only once it reaches 0.
  private visibilityToggleFades = new Map<
    string,
    { from: number; to: number; startMs: number; durationMs: number; hideOnDone: boolean }
  >();
  private scalarStyleTweens = new Map<string, ScalarStyleTween>();
  private layerTransitionSnapshots = new Map<string, LayerTransitionSnapshot>();
  private sectionIsoOverlayTransition: SectionIsoOverlayTransition | null =
    null;
  private workingAreaFocusTween: WorkingAreaFocusStyleTween | null = null;
  sceneSectionStyleTween: SceneSectionStyleTween | null = null;
  sceneSectionHelperTransitionOpacity = 1;
  private activeSceneTransitionContext: SceneTransitionContext | null = null;
  private cinematicSceneTransition: CinematicSceneTransitionRuntime | null = null;
  private environmentSceneTransition: EnvironmentSceneTransitionRuntime | null =
    null;
  private currentEnvironmentSceneTransitionFrame: EnvironmentSceneTransitionFrame | null =
    null;
  private lastCinematicSceneTransitionDebug: CinematicSceneTransitionDebugState =
    inactiveCinematicSceneTransitionDebugState();
  private lastTransitionCommitState: SceneTransitionContext["commitState"] | null =
    null;
  private lastPostCommitTargetAssertionSuppressed = false;
  sceneSectionReapplySuspended = false;
  // Execution layer (TRD-013): seismic survey-geometry / figure-annotation
  // entities currently being faded by the seismic graph executor.
  seismicGraphTransitionActiveEntities = new Set<string>();
  private materialBaseOpacity = new WeakMap<THREE.Material, number>();
  private currentVisibleLayerIds: ReadonlySet<string> | null = null;
  private readonly sceneOverlayController: SceneOverlaysController;
  private readonly areaOutlineController = new AreaOutlineController(
    this.layers,
    () => this.editorMode,
  );
  // Geology layer handle. Stashed so applyEffectiveStylesForPage can
  // forward env overrides (per-unit visibility / colour) into the
  // mask rebuild, and the editor's sub-layer panel can read the
  // distinct-units list.
  private geologyHandle: GeologyHandle | null = null;
  environmentScenePreviewPatch: Partial<SceneProperties> | null = null;
  currentSceneProperties: SceneProperties = {};
  private lastAppliedRenderPresetId: string | null = null;
  private lateReapplyDebugSequence = 0;
  private lateReapplyDebugDuringTransitionCount = 0;
  private readonly lateReapplyDebugEvents: LateReapplyDebugEvent[] = [];
  private lastLayerTweenTickDebug: LayerTweenTickDebugState | null = null;
  lastSceneSectionApplyDebug: SceneSectionApplyDebugState | null = null;
  lastMtVolumeCutIsoUpdateDebug: MtVolumeCutIsoUpdateDebugState | null = null;
  private lastFrameUpdateDebug: FrameUpdateDebugState | null = null;
  private seismicCameraLodPosition: THREE.Vector3 | null = null;
  private seismicCameraMovingUntilMs = 0;

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
  ) {
    this.sceneOverlayController = new SceneOverlaysController(scene);
    this.topoRuntime = createTopoMapRuntime({
      scene,
      renderer,
      resolveAssetPath: (path) =>
        this.sceneOverlayController.resolveAssetPath(path),
      getMaxAnisotropy: () => this.sceneOverlayController.getMaxAnisotropy(),
      getLayerGroup: (id) => this.layers.get(id),
      getLayerStyle: (id) => this.styleForLayer(id),
      getSurfaceLayerId: () => this.topoSurfaceLayerId(),
      getGraticuleLayerIds: () => this.topoGraticuleLayerIds(),
      getPublicSurfaceLayerIds: () => this.topoPublicSurfaceLayerIds(),
      isSurfaceLayerId: (id) => this.isTopoSurfaceLayerId(id),
      isGraticuleLayerId: (id) => this.isTopoGraticuleLayerId(id),
      getEditorMode: () => this.editorMode,
      onPublicSurfaceClippingActive: (active) => {
        this.publicSurfaceClippingActive = active;
      },
      updateRendererLocalClipping: () => this.updateRendererLocalClipping(),
    });
  }

  private layerSpecFor(id: string): ProjectLayerSpec | undefined {
    return this.layerSpecs.get(id);
  }

  private topoSurfaceLayerId(): string {
    return this.topoRuntimeLayerIds().surfaceLayerId;
  }

  topoSurfaceGroup(): THREE.Group | undefined {
    return this.layers.get(this.topoSurfaceLayerId());
  }

  private isTopoSurfaceLayerId(id: string): boolean {
    const spec = this.layerSpecFor(id);
    if (spec) return isTopoMapSurfaceLayer(spec);
    return id === this.topoRuntimeLayerIds().surfaceLayerId;
  }

  private isTopoGraticuleLayerId(id: string): boolean {
    const spec = this.layerSpecFor(id);
    if (spec) return isTopoMapGraticuleLayer(spec);
    return this.topoRuntimeLayerIds().graticuleLayerIds.includes(id);
  }

  private topoGraticuleLayerIds(): string[] {
    return this.topoRuntimeLayerIds().graticuleLayerIds;
  }

  private topoPublicSurfaceLayerIds(): string[] {
    return this.topoRuntimeLayerIds().publicSurfaceLayerIds;
  }

  private topoRuntimeLayerIds() {
    return topoMapRuntimeLayerIds({
      layerSpecs: this.layerSpecs.values(),
      hasLoadedLayer: (id) => this.layers.has(id),
    });
  }

  setPostHandle(handle: PostHandle): void {
    this.postHandle = handle;
  }

  setEditorMode(enabled: boolean): void {
    this.editorMode = enabled;
    if (this.envLightHelperGroup) {
      this.envLightHelperGroup.visible =
        enabled && this.studioSceneElementsVisible;
    }
    if (this.orbitCenterHandle) {
      this.orbitCenterHandle.group.visible = enabled;
    }
    if (this.sceneSectionRuntime) {
      const helperVisible =
        typeof this.lastSceneSectionStyle.sceneSectionHelperVisible === "boolean"
          ? this.lastSceneSectionStyle.sceneSectionHelperVisible
          : enabled;
      this.sceneSectionRuntime.group.visible =
        this.lastSceneSectionStyle.sceneSectionEnabled === true &&
        helperVisible;
    }
    this.topoRuntime.setEditorMode(enabled);
    if (this.workingAreaFocusRuntime) {
      const focusState = this.workingAreaFocusState(
        this.lastWorkingAreaFocusStyle,
      );
      this.workingAreaFocusRuntime.group.visible =
        enabled && focusState.enabled && focusState.helperVisible;
    }
    this.updateAreaOutlineHandleVisibility();
    this.updatePageCameraMarkerVisibility();
  }

  private applySunDirectionToRuntime(): void {
    if (this.envKeyLight) {
      this.envKeyLight.position.copy(this.currentSunDir).multiplyScalar(8000);
      this.envKeyLight.target.position.set(0, 0, 0);
      this.envKeyLight.target.updateMatrixWorld();
    }

    this.topoRuntime.applySunDirection(this.currentSunDir);
    if (this.envSunVisual) {
      updateEnvironmentSunVisualDirection(this.envSunVisual, this.currentSunDir);
    }
  }

  private requestCameraSunCapture(worldDir: THREE.Vector3): void {
    this.pendingCameraSunWorldDir.copy(worldDir).normalize();
    this.pendingCameraSunCapture = true;
  }

  private setEffectiveSunLockToCamera(enabled: boolean): void {
    if (enabled === this.sunLockToCamera) return;
    this.sunLockToCamera = enabled;
    this.pendingCameraSunCapture = false;

    if (enabled) {
      this.requestCameraSunCapture(this.currentSunDir);
      return;
    }

    this.currentSunDir.copy(this.authoredWorldSunDir);
    this.cameraLocalSunDir.copy(this.authoredWorldSunDir);
    this.applySunDirectionToRuntime();
  }

  private updateCameraLockedSun(camera: THREE.Camera): void {
    if (!this.sunLockToCamera) return;

    this.cameraSunRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.cameraSunUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    this.cameraSunBack.set(0, 0, 1).applyQuaternion(camera.quaternion);

    if (this.pendingCameraSunCapture) {
      this.cameraLocalSunDir.set(
        this.pendingCameraSunWorldDir.dot(this.cameraSunRight),
        this.pendingCameraSunWorldDir.dot(this.cameraSunBack),
        this.pendingCameraSunWorldDir.dot(this.cameraSunUp),
      );
      if (this.cameraLocalSunDir.lengthSq() < 0.000001) {
        this.cameraLocalSunDir.copy(this.authoredWorldSunDir);
      } else {
        this.cameraLocalSunDir.normalize();
      }
      this.pendingCameraSunCapture = false;
    }

    this.currentSunDir
      .copy(this.cameraSunRight)
      .multiplyScalar(this.cameraLocalSunDir.x)
      .addScaledVector(this.cameraSunBack, this.cameraLocalSunDir.y)
      .addScaledVector(this.cameraSunUp, this.cameraLocalSunDir.z)
      .normalize();
    this.applySunDirectionToRuntime();
  }

  setStudioSceneElementsVisible(enabled: boolean): void {
    return setStudioSceneElementsVisibleImpl.call(this, enabled);
  }

  clearLightingStudioSources(): void {
    return clearLightingStudioSourcesImpl.call(this);
  }

  lightingHandleKey(sourceId: string, kind: LightingHandleKind): string {
    return lightingHandleKeyImpl.call(this, sourceId, kind);
  }

  makeLightingHandleMaterial(color: THREE.ColorRepresentation, opacity = 0.92): THREE.MeshBasicMaterial {
    return makeLightingHandleMaterialImpl.call(this, color, opacity);
  }

  markLightingPickable(obj: THREE.Object3D, sourceId: string, kind: LightingHandleKind, mode: LightingHandleMode, pickables: THREE.Object3D[]): void {
    return markLightingPickableImpl.call(this, obj, sourceId, kind, mode, pickables);
  }

  addLightingStudioHandle(sourceId: string, kind: LightingHandleKind, position: THREE.Vector3, color: THREE.Color, helperGroup: THREE.Group): void {
    return addLightingStudioHandleImpl.call(this, sourceId, kind, position, color, helperGroup);
  }

  updateLightingStudioHelpers(): void {
    return updateLightingStudioHelpersImpl.call(this);
  }

  makeOrbitCenterMaterial(color: THREE.ColorRepresentation, opacity = 0.9): THREE.MeshStandardMaterial {
    return makeOrbitCenterMaterialImpl.call(this, color, opacity);
  }

  markOrbitCenterPickable(obj: THREE.Object3D, mode: OrbitCenterHandleMode, pickables: THREE.Object3D[]): void {
    return markOrbitCenterPickableImpl.call(this, obj, mode, pickables);
  }

  markPageCameraPickable(obj: THREE.Object3D, pickables: THREE.Object3D[], id: string, kind: "current" | "global"): void {
    return markPageCameraPickableImpl.call(this, obj, pickables, id, kind);
  }

  createPageCameraLabel(text = "Camera", accentColor = "rgba(48, 48, 48, 0.22)", fillColor = "rgba(255, 255, 255, 0.92)"): THREE.Sprite {
    return createPageCameraLabelImpl.call(this, text, accentColor, fillColor);
  }

  createPageCameraMarker(pose: Pose, opts: {
      id: string;
      kind: "current" | "global";
      label: string;
      color?: string;
      fillColor?: string;
      labelBaseWidth?: number;
      labelBaseHeight?: number;
      labelLift?: number;
    }): PageCameraMarkerRuntime {
    return createPageCameraMarkerImpl.call(this, pose, opts);
  }

  updatePageCameraMarkerLine(marker: PageCameraMarkerRuntime): void {
    return updatePageCameraMarkerLineImpl.call(this, marker);
  }

  updatePageCameraMarkerPose(marker: PageCameraMarkerRuntime, pose: Pose): void {
    return updatePageCameraMarkerPoseImpl.call(this, marker, pose);
  }

  updatePageCameraMarkerVisibility(): void {
    return updatePageCameraMarkerVisibilityImpl.call(this);
  }

  createOrbitCenterHandle(position: THREE.Vector3): OrbitCenterHandleRuntime {
    return createOrbitCenterHandleImpl.call(this, position);
  }

  private updateOrbitCenterDirection(direction: 1 | -1): void {
    if (!this.orbitCenterHandle) return;
    this.orbitCenterHandle.directionArrow.rotation.z =
      direction === -1 ? Math.PI : 0;
  }

  setDynamicCameraOrbitCenter(point: Vec3 | null, direction: 1 | -1 = 1): void {
    if (!point) {
      if (this.orbitCenterHandle) {
        this.scene.remove(this.orbitCenterHandle.group);
        disposeObjectTree(this.orbitCenterHandle.group);
        this.orbitCenterHandle = null;
      }
      return;
    }
    const position = new THREE.Vector3(point[0], point[1], point[2]);
    if (!this.orbitCenterHandle) {
      this.orbitCenterHandle = this.createOrbitCenterHandle(position);
      this.updateOrbitCenterDirection(direction);
      return;
    }
    this.orbitCenterHandle.group.position.copy(position);
    this.orbitCenterHandle.group.visible = this.editorMode;
    this.updateOrbitCenterDirection(direction);
  }

  listDynamicCameraOrbitCenterPickables(): THREE.Object3D[] {
    return this.editorMode && this.orbitCenterHandle
      ? this.orbitCenterHandle.pickables
      : [];
  }

  getDynamicCameraOrbitCenter(): THREE.Vector3 | null {
    return this.orbitCenterHandle
      ? this.orbitCenterHandle.group.position.clone()
      : null;
  }

  previewDynamicCameraOrbitCenter(position: THREE.Vector3): void {
    if (!this.orbitCenterHandle) {
      this.orbitCenterHandle = this.createOrbitCenterHandle(position);
      return;
    }
    this.orbitCenterHandle.group.position.copy(position);
  }

  setPageCameraMarker(pose: Pose | null): void {
    return setPageCameraMarkerImpl.call(this, pose);
  }

  setGlobalPageCameraMarkers(markers: PageCameraMarkerSpec[] | null): void {
    return setGlobalPageCameraMarkersImpl.call(this, markers);
  }

  listPageCameraMarkerPickables(): THREE.Object3D[] {
    return listPageCameraMarkerPickablesImpl.call(this);
  }

  addLightingStudioSource(source: PresentationLightSource, helperGroup: THREE.Group): void {
    return addLightingStudioSourceImpl.call(this, source, helperGroup);
  }

  listLightingHandlePickables(): THREE.Object3D[] {
    return this.editorMode && this.studioSceneElementsVisible
      ? this.envLightHandlePickables
      : [];
  }

  getLightingHandlePosition(
    sourceId: string,
    kind: LightingHandleKind,
  ): THREE.Vector3 | null {
    const handle = this.envLightHandles.get(
      this.lightingHandleKey(sourceId, kind),
    );
    return handle ? handle.group.position.clone() : null;
  }

  previewLightingHandle(
    sourceId: string,
    kind: LightingHandleKind,
    position: THREE.Vector3,
  ): void {
    const handle = this.envLightHandles.get(
      this.lightingHandleKey(sourceId, kind),
    );
    const runtime = this.envLightRuntimes.get(sourceId);
    if (!handle || !runtime) return;
    handle.group.position.copy(position);
    if (kind === "position") {
      runtime.light.position.copy(position);
      if (runtime.type === "area" && runtime.target) {
        runtime.light.lookAt(runtime.target.position);
      }
    } else if (runtime.target) {
      runtime.target.position.copy(position);
      runtime.target.updateMatrixWorld();
      if (runtime.type === "area") {
        runtime.light.lookAt(position);
      }
    }
    this.updateLightingStudioHelpers();
  }

  registerLayer(layer: string | ProjectLayerSpec): THREE.Group {
    const id = typeof layer === "string" ? layer : layer.id;
    const spec = typeof layer === "string" ? undefined : layer;
    if (spec) this.layerSpecs.set(id, spec);
    if (this.layers.has(id)) {
      console.warn(`[SceneManager] layer "${id}" already registered`);
      const existing = this.layers.get(id)!;
      if (spec) existing.userData.layerSpec = spec;
      return existing;
    }
    const group = new THREE.Group();
    group.name = id;
    group.visible = false;
    if (spec) group.userData.layerSpec = spec;
    this.scene.add(group);
    this.layers.set(id, group);
    return group;
  }

  removeLayer(id: string): void {
    const group = this.layers.get(id);
    if (!group) return;
    this.scene.remove(group);
    disposeObjectTree(group);
    this.layers.delete(id);
    this.layerSpecs.delete(id);
    this.appliedLayerStyles.delete(id);
    if (this.currentVisibleLayerIds) {
      this.currentVisibleLayerIds = new Set(
        [...this.currentVisibleLayerIds].filter((layerId) => layerId !== id),
      );
    }
  }

  setVisible(nextVisible: ReadonlySet<string>): void {
    this.currentVisibleLayerIds = nextVisible;
    for (const [id, group] of this.layers) {
      group.visible = nextVisible.has(id);
    }
    for (const id of Object.keys(CASE_STUDY_B_DEMO_LAYER_ALIASES)) {
      this.applyCaseStudyBDemoLayerAlias(id, this.styleForLayer(id));
    }
    for (const id of this.topoGraticuleLayerIds()) {
      this.topoRuntime.applyGraticuleStyle(id, this.styleForLayer(id));
    }
    this.reapplyTopoAlignedOverlays();
    this.reapplySceneSectionPlanes();
    this.reapplyWorkingAreaFocus();
  }

  // 7.3: editor/legend visibility toggles fade the changed layers instead of
  // binary-flipping them, matching the slider-style standard the MT mode
  // buttons set. Unchanged layers keep their state with no work. PageController
  // page loads and the capture exporter keep calling the instant `setVisible`.
  setVisibleFaded(nextVisible: ReadonlySet<string>): void {
    // Never fade against a live page transition; fall back to the instant path
    // (the editor live-apply gate normally defers toggles during transitions,
    // this is defence in depth).
    if (this.activeSceneTransitionContext) {
      this.setVisible(nextVisible);
      return;
    }
    const prev = this.currentVisibleLayerIds ?? new Set<string>();
    const now = performance.now();
    for (const [id, group] of this.layers) {
      const wasVisible = prev.has(id);
      const willVisible = nextVisible.has(id);
      if (wasVisible === willVisible) {
        if (!this.visibilityToggleFades.has(id)) group.visible = willVisible;
        continue;
      }
      const authored = this.authoredLayerOpacity(id);
      const current = this.currentVisibilityFadeOpacity(id);
      group.visible = true; // stay rendered while the fade runs (both directions)
      this.visibilityToggleFades.set(id, {
        from: current ?? (willVisible ? 0 : authored),
        to: willVisible ? authored : 0,
        startMs: now,
        durationMs: VISIBILITY_TOGGLE_FADE_MS,
        hideOnDone: !willVisible,
      });
    }
    // Case Study B alias ids are logical layers mapped onto the demo shell, not
    // real groups in `this.layers`, so the loop above never enqueues their fade
    // and they would snap on editor visibility toggles (Codex audit F1). Enqueue
    // the changed alias ids here; the shared tick + start-opacity machinery
    // already routes alias ids through applyCaseStudyBDemoLayerAlias via
    // applyLayerTransitionRenderOpacity, so they fade with everything else.
    for (const id of Object.keys(CASE_STUDY_B_DEMO_LAYER_ALIASES)) {
      const wasVisible = prev.has(id);
      const willVisible = nextVisible.has(id);
      if (wasVisible === willVisible) continue;
      const authored = this.authoredLayerOpacity(id);
      const current = this.currentVisibilityFadeOpacity(id);
      this.visibilityToggleFades.set(id, {
        from: current ?? (willVisible ? 0 : authored),
        to: willVisible ? authored : 0,
        startMs: now,
        durationMs: VISIBILITY_TOGGLE_FADE_MS,
        hideOnDone: !willVisible,
      });
    }
    this.currentVisibleLayerIds = nextVisible;
    // Same post-visibility bookkeeping as setVisible so aliases, graticules,
    // topo-aligned overlays, sections, and working-area stay correct.
    for (const id of Object.keys(CASE_STUDY_B_DEMO_LAYER_ALIASES)) {
      this.applyCaseStudyBDemoLayerAlias(id, this.styleForLayer(id));
    }
    for (const id of this.topoGraticuleLayerIds()) {
      this.topoRuntime.applyGraticuleStyle(id, this.styleForLayer(id));
    }
    this.reapplyTopoAlignedOverlays();
    this.reapplySceneSectionPlanes();
    this.reapplyWorkingAreaFocus();
    // Apply the start opacity immediately so the section/alias reapply above
    // cannot leave a one-frame full-opacity flash before the first tick.
    for (const [id, fade] of this.visibilityToggleFades) {
      this.applyLayerTransitionRenderOpacity(id, fade.from, fade.from > 0.001 ? 1 : 0);
    }
  }

  private authoredLayerOpacity(id: string): number {
    const style = this.styleForLayer(id);
    if (
      style &&
      typeof style.opacity === "number" &&
      Number.isFinite(style.opacity)
    ) {
      return clamp01(style.opacity);
    }
    return clamp01(this.baseOpacityForLayer(id));
  }

  private currentVisibilityFadeOpacity(id: string): number | null {
    const fade = this.visibilityToggleFades.get(id);
    if (!fade) return null;
    const t =
      fade.durationMs <= 0 ? 1 : (performance.now() - fade.startMs) / fade.durationMs;
    const eased = t >= 1 ? 1 : easeInOutCubic(t);
    return fade.from + (fade.to - fade.from) * eased;
  }

  private tickVisibilityToggleFades(nowMs: number): void {
    if (this.visibilityToggleFades.size === 0) return;
    for (const [id, fade] of this.visibilityToggleFades) {
      const t =
        fade.durationMs <= 0 ? 1 : (nowMs - fade.startMs) / fade.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeInOutCubic(t);
      const opacity = fade.from + (fade.to - fade.from) * eased;
      this.applyLayerTransitionRenderOpacity(
        id,
        opacity,
        opacity > 0.001 ? 1 : 0,
      );
      if (done) {
        if (fade.hideOnDone) {
          const group = this.layers.get(id);
          if (group) group.visible = false;
        }
        this.visibilityToggleFades.delete(id);
      }
    }
  }

  private targetOpacityForLayer(
    environment: EnvironmentSetup,
    page: PresentationPage,
    layerId: string,
  ): number {
    const visible = effectiveVisibility(environment, page).has(layerId);
    if (!visible) return 0;
    const style = effectiveStyle(environment, page, layerId);
    return typeof style.opacity === "number"
      ? style.opacity
      : this.baseOpacityForLayer(layerId);
  }

  private baseOpacityForMaterial(material: THREE.Material): number {
    const stored = this.materialBaseOpacity.get(material);
    if (typeof stored === "number") return stored;
    this.materialBaseOpacity.set(material, material.opacity);
    return material.opacity;
  }

  private shaderOpacityForMaterial(material: THREE.Material): number | null {
    if (
      material instanceof THREE.ShaderMaterial &&
      typeof material.uniforms?.uOpacity?.value === "number" &&
      Number.isFinite(material.uniforms.uOpacity.value)
    ) {
      return material.uniforms.uOpacity.value;
    }
    return null;
  }

  private productOpacityBaseForMaterial(material: THREE.Material): number {
    const authoredBase = material.userData?.preserveMaterialOpacityBase;
    if (typeof authoredBase === "number" && Number.isFinite(authoredBase)) {
      return clamp01(authoredBase);
    }
    const shaderOpacity = this.shaderOpacityForMaterial(material);
    if (shaderOpacity !== null) return clamp01(shaderOpacity);
    return clamp01(this.baseOpacityForMaterial(material));
  }

  setProductOpacityBaseForMaterial(
    material: THREE.Material,
    opacity: number,
  ): void {
    if (material.userData?.preserveMaterialOpacity !== true) return;
    if (!Number.isFinite(opacity)) return;
    material.userData.preserveMaterialOpacityBase = clamp01(opacity);
  }

  private baseOpacityForLayer(id: string): number {
    const group = this.layers.get(id);
    if (!group) return 1;
    let opacity: number | null = null;
    group.traverse((obj) => {
      if (opacity !== null) return;
      const mat = (obj as THREE.Mesh | THREE.Line).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!mat) return;
      const first = Array.isArray(mat) ? mat[0] : mat;
      if (first) opacity = this.baseOpacityForMaterial(first);
    });
    return opacity ?? 1;
  }

  private currentRenderOpacityForTree(
    root: THREE.Object3D,
    fallback: number,
  ): number {
    if (!root.visible) return 0;
    let opacity: number | null = null;
    root.traverse((obj) => {
      if (!obj.visible) return;
      const mat = (
        obj as THREE.Object3D & {
          material?: THREE.Material | THREE.Material[];
        }
      ).material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const material of mats) {
        const isSectionIsoOverlay =
          obj.userData?.scalarSectionIsoOverlay === true ||
          material.userData?.scalarSectionIsoOverlay === true;
        if (isSectionIsoOverlay) continue;
        if (
          material.userData?.ignoreLayerStyle === true
        ) {
          continue;
        }
        const shaderOpacity = this.shaderOpacityForMaterial(material);
        const rawOpacity =
          typeof shaderOpacity === "number" && Number.isFinite(shaderOpacity)
            ? shaderOpacity
            : material.opacity;
        const preserveProductOpacity =
          material.userData?.preserveMaterialOpacity === true;
        const productBase = preserveProductOpacity
          ? this.productOpacityBaseForMaterial(material)
          : 1;
        const next =
          preserveProductOpacity && productBase > 0
            ? rawOpacity / productBase
            : rawOpacity;
        if (typeof next !== "number" || !Number.isFinite(next)) continue;
        opacity = Math.max(opacity ?? 0, next);
      }
    });
    return clamp01(opacity ?? fallback);
  }

  private sectionIsoAuthoredOpacity(material: THREE.Material): number {
    const authored = material.userData?.sectionIsoBaseOpacity;
    if (typeof authored === "number" && Number.isFinite(authored)) {
      return clamp01(authored);
    }
    if (
      material instanceof THREE.ShaderMaterial &&
      typeof material.uniforms.uOpacity?.value === "number"
    ) {
      const value = clamp01(material.uniforms.uOpacity.value);
      material.userData.sectionIsoBaseOpacity = value;
      return value;
    }
    const value =
      typeof material.opacity === "number" && Number.isFinite(material.opacity)
        ? clamp01(material.opacity)
        : 1;
    material.userData.sectionIsoBaseOpacity = value;
    return value;
  }

  private applySectionIsoOverlayMaterialOpacity(
    material: THREE.Material,
    opacity: number,
    layerRenderOpacity?: number,
    mode: "layer-render-opacity" | "transition-envelope" =
      "layer-render-opacity",
  ): void {
    const transitionOpacity = clamp01(opacity);
    const opacityMode =
      mode === "layer-render-opacity" &&
      material.userData?.sectionIsoOpacityPolicy ===
        "transition-envelope-opacity" &&
      transitionOpacity < 0.999
        ? "transition-envelope"
        : mode;
    const parentLayerOpacity =
      typeof layerRenderOpacity === "number" && Number.isFinite(layerRenderOpacity)
        ? clamp01(layerRenderOpacity)
        : typeof material.userData?.sectionIsoLayerRenderOpacity === "number" &&
            Number.isFinite(material.userData.sectionIsoLayerRenderOpacity)
          ? clamp01(material.userData.sectionIsoLayerRenderOpacity)
        : transitionOpacity;
    const authoredOpacity = this.sectionIsoAuthoredOpacity(material);
    const occlusion =
      typeof material.userData?.sectionIsoThresholdOcclusionAttenuation ===
        "number" &&
      Number.isFinite(material.userData.sectionIsoThresholdOcclusionAttenuation)
        ? clamp01(material.userData.sectionIsoThresholdOcclusionAttenuation)
        : 1;
    const helperTransitionOpacity =
      typeof material.userData?.sectionIsoHelperTransitionOpacity === "number" &&
      Number.isFinite(material.userData.sectionIsoHelperTransitionOpacity)
        ? clamp01(material.userData.sectionIsoHelperTransitionOpacity)
        : 1;
    const nextOpacity = clamp01(
      authoredOpacity * transitionOpacity * helperTransitionOpacity * occlusion,
    );
    material.userData.sectionIsoTransitionOpacity = transitionOpacity;
    material.userData.sectionIsoHelperTransitionOpacity =
      helperTransitionOpacity;
    material.userData.sectionIsoLayerRenderOpacity = parentLayerOpacity;
    material.userData.sectionIsoOpacityPolicy =
      transitionOpacity <= 0.001
        ? "hidden-with-parent-layer"
        : opacityMode === "transition-envelope"
          ? "transition-envelope-opacity"
        : "independent-of-layer-render-opacity";
    material.userData.sectionIsoComposedOpacity = nextOpacity;
    material.opacity = nextOpacity;
    material.transparent = true;
    if (material instanceof THREE.ShaderMaterial && material.uniforms.uOpacity) {
      material.uniforms.uOpacity.value = nextOpacity;
    }
    material.needsUpdate = true;
  }

  applySectionIsoHelperTransitionOpacity(
    material: THREE.Material,
    helperOpacity: number,
  ): void {
    material.userData.sectionIsoHelperTransitionOpacity = clamp01(helperOpacity);
    const transitionOpacity =
      typeof material.userData?.sectionIsoTransitionOpacity === "number" &&
      Number.isFinite(material.userData.sectionIsoTransitionOpacity)
        ? material.userData.sectionIsoTransitionOpacity
        : 1;
    const layerRenderOpacity =
      typeof material.userData?.sectionIsoLayerRenderOpacity === "number" &&
      Number.isFinite(material.userData.sectionIsoLayerRenderOpacity)
        ? material.userData.sectionIsoLayerRenderOpacity
        : undefined;
    this.applySectionIsoOverlayMaterialOpacity(
      material,
      transitionOpacity,
      layerRenderOpacity,
      material.userData?.sectionIsoOpacityPolicy ===
        "transition-envelope-opacity"
        ? "transition-envelope"
        : "layer-render-opacity",
    );
  }

  captureLayerRenderStates(
    environment: EnvironmentSetup,
    page: PresentationPage,
    layerIds: ReadonlySet<string>,
  ): Map<string, ResolvedLayerRenderState> {
    const visibleSet = effectiveVisibility(environment, page);
    const states = new Map<string, ResolvedLayerRenderState>();
    for (const id of layerIds) {
      const fallbackStyle = effectiveStyle(environment, page, id);
      const appliedStyle = this.appliedLayerStyles.get(id) ?? fallbackStyle;
      const fallbackOpacity = visibleSet.has(id)
        ? this.targetOpacityForLayer(environment, page, id)
        : 0;
      const group = this.layers.get(id);
      const opacity = group
        ? this.currentRenderOpacityForTree(group, fallbackOpacity)
        : fallbackOpacity;
      const snapshot = this.layerTransitionSnapshots.get(id);
      const snapshotOpacity = snapshot
        ? this.currentRenderOpacityForTree(snapshot.group, snapshot.from)
        : 0;
      const useSnapshot =
        !!snapshot &&
        snapshotOpacity > opacity + 0.001 &&
        snapshot.style !== undefined;
      states.set(id, {
        id,
        visible: group
          ? (group.visible && opacity > 0.001) || snapshotOpacity > 0.001
          : visibleSet.has(id) && fallbackOpacity > 0.001,
        opacity: Math.max(opacity, snapshotOpacity),
        style: { ...(useSnapshot ? snapshot.style! : appliedStyle) },
      });
    }
    return states;
  }

  private applyRenderOpacityToTree(
    root: THREE.Object3D,
    opacity: number,
    sectionIsoTransitionOpacity?: number,
  ): void {
    const next = clamp01(opacity);
    const sectionIsoEnvelope =
      typeof sectionIsoTransitionOpacity === "number" &&
      Number.isFinite(sectionIsoTransitionOpacity)
        ? clamp01(sectionIsoTransitionOpacity)
        : null;
    root.visible = next > 0.001 || (sectionIsoEnvelope ?? 0) > 0.001;
    root.traverse((obj) => {
      const mat = (obj as THREE.Mesh | THREE.Line).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        const isSectionIsoOverlay =
          obj.userData?.scalarSectionIsoOverlay === true ||
          m.userData?.scalarSectionIsoOverlay === true;
        if (m.userData?.ignoreLayerStyle === true && !isSectionIsoOverlay) {
          continue;
        }
        if (isSectionIsoOverlay) {
          this.applySectionIsoOverlayMaterialOpacity(
            m,
            sectionIsoEnvelope ?? (next <= 0.001 ? 0 : 1),
            next,
            sectionIsoEnvelope === null
              ? "layer-render-opacity"
              : "transition-envelope",
          );
          continue;
        }
        const preserveProductOpacity =
          m.userData?.preserveMaterialOpacity === true;
        const productBase = preserveProductOpacity
          ? this.productOpacityBaseForMaterial(m)
          : 1;
        const materialOpacity = preserveProductOpacity
          ? clamp01(productBase * next)
          : next;
        this.baseOpacityForMaterial(m);
        if (
          m.userData?.surfaceRenderPolicy === MT_THRESHOLD_SURFACE_POLICY.name
        ) {
          applyMtThresholdSurfaceMaterialOpacity(
            m,
            materialOpacity,
            "wireframe" in m &&
              (m as THREE.Material & { wireframe?: boolean }).wireframe === true,
            false,
          );
        } else {
          m.opacity = materialOpacity;
          m.transparent =
            m.userData?.forceTransparent === true || materialOpacity < 1;
        }
        if (m instanceof THREE.ShaderMaterial && m.uniforms.uOpacity) {
          m.uniforms.uOpacity.value = materialOpacity;
        }
        if (m.userData?.terrainMaterial === true) {
          m.transparent = true;
          m.depthWrite = materialOpacity >= 0.999;
        }
        m.needsUpdate = true;
      }
    });
  }

  applyLayerRenderOpacity(id: string, opacity: number): void {
    const group = this.layers.get(id);
    const next = clamp01(opacity);
    if (!group) {
      this.applyCaseStudyBDemoLayerAlias(id, this.styleForLayer(id), next);
      return;
    }
    this.applyRenderOpacityToTree(group, next);
    this.applyTerrainCompositeOpacity(id, next);
    this.applyCaseStudyBDemoLayerAlias(id, this.styleForLayer(id), next);
  }

  applyLayerTransitionRenderOpacity(
    id: string,
    opacity: number,
    transitionOpacity: number,
  ): void {
    const group = this.layers.get(id);
    const next = clamp01(opacity);
    const envelope = clamp01(transitionOpacity);
    if (!group) {
      this.applyCaseStudyBDemoLayerAlias(id, this.styleForLayer(id), next);
      return;
    }
    this.applyRenderOpacityToTree(group, next, envelope);
    this.applyTerrainCompositeOpacity(id, next);
    this.applyCaseStudyBDemoLayerAlias(id, this.styleForLayer(id), next);
  }

  private layerHasScalarPreviewData(group: THREE.Group): boolean {
    let found = false;
    group.traverse((obj) => {
      if (found) return;
      if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.Points))
        return;
      const values = obj.geometry.userData.scalarValues as
        | Float32Array
        | number[]
        | undefined;
      found = !!values && values.length > 0;
    });
    return found;
  }

  layerSupportsScalarStyleTween(
    id: string,
    group: THREE.Group,
  ): boolean {
    if (this.isTopoSurfaceLayerId(id)) return true;
    if (id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) return true;
    // Scalar-tween eligibility is authoritative from the layer spec type,
    // independent of load timing (DEC-166, review finding 2.3): a
    // scalar-colored point cloud or scalar volume qualifies before its async
    // scalar data attaches to geometry, so the same authored change no longer
    // classifies `continuous` or `none` depending on whether the load happened
    // to finish at transition setup. Geometry-presence stays as a secondary
    // readiness OR for loaded layers whose spec type falls through. The
    // full-density MT layer is also `pointcloud`, but its transition kind is
    // special-cased to `full-density-scalar` at the classifier, so this path
    // does not alter the protected MT scalar behavior.
    const specType = this.layerSpecFor(id)?.type;
    if (specType === "pointcloud" || specType === "volume") return true;
    return this.layerHasScalarPreviewData(group);
  }

  private cloneTransitionUserData(
    userData: Record<string, unknown> | undefined,
  ): Record<string, unknown> {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(userData ?? {})) {
      if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        next[key] = value;
      } else if (
        Array.isArray(value) &&
        value.every(
          (item) =>
            item === null ||
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean",
        )
      ) {
        next[key] = [...value];
      }
    }
    return next;
  }

  private cloneTransitionGeometry(
    geometry: THREE.BufferGeometry,
  ): THREE.BufferGeometry {
    const originalUserData = geometry.userData;
    geometry.userData = {};
    try {
      const clone = geometry.clone();
      clone.userData = {};
      return clone;
    } finally {
      geometry.userData = originalUserData;
    }
  }

  private cloneTransitionMaterial(material: THREE.Material): THREE.Material {
    const originalUserData = material.userData;
    const originalClippingPlanes =
      material.clippingPlanes?.map((plane) => plane.clone()) ?? null;
    const originalClipIntersection = material.clipIntersection === true;
    material.userData = this.cloneTransitionUserData(originalUserData);
    try {
      const clone = material.clone();
      clone.userData = this.cloneTransitionUserData(originalUserData);
      // Section helpers (cones, frame outlines, ground traces) are exempt from
      // section/working-area clip + shader in the live apply (the
      // `sceneSectionHelper` skip). Their transition snapshot must match: a
      // cloned helper that inherits clipping planes or the section visibility
      // shader renders clipped-to-box -- the "cone flat-cube" during transitions.
      // Clear any inherited clipping and skip rehydration for helper clones.
      if (originalUserData?.sceneSectionHelper === true) {
        clone.clippingPlanes = null;
        clone.clipIntersection = false;
        return clone;
      }
      this.rehydrateWorkingAreaFocusTransitionMaterial(clone, originalUserData);
      this.rehydrateSceneSectionTransitionMaterial(
        clone,
        originalUserData,
        originalClippingPlanes,
        originalClipIntersection,
      );
      return clone;
    } finally {
      material.userData = originalUserData;
    }
  }

  private rehydrateWorkingAreaFocusTransitionMaterial(
    clone: THREE.Material,
    originalUserData: Record<string, unknown> | undefined,
  ): void {
    if (
      !originalUserData ||
      (originalUserData.workingAreaFocusPatched !== true &&
        originalUserData.workingAreaFocusEnabled !== true)
    ) {
      return;
    }
    const currentState = this.workingAreaFocusState(
      this.currentWorkingAreaFocusStyle,
    );
    const boundsMin =
      this.cleanWorkingAreaFocusVector(
        originalUserData.workingAreaFocusBoundsMin,
      ) ?? currentState.boundsMin.clone();
    const boundsMax =
      this.cleanWorkingAreaFocusVector(
        originalUserData.workingAreaFocusBoundsMax,
      ) ?? currentState.boundsMax.clone();
    const outsideOpacity =
      typeof originalUserData.workingAreaFocusOutsideOpacity === "number" &&
      Number.isFinite(originalUserData.workingAreaFocusOutsideOpacity)
        ? clamp01(originalUserData.workingAreaFocusOutsideOpacity)
        : 1;
    const enabled = originalUserData.workingAreaFocusEnabled === true;
    delete clone.userData.workingAreaFocusPatched;
    delete clone.userData.workingAreaFocusShader;
    const state: WorkingAreaFocusState = {
      ...currentState,
      enabled,
      boundsMin,
      boundsMax,
    };
    this.applyWorkingAreaFocusMaterial(
      clone,
      enabled,
      state,
      outsideOpacity,
    );
  }

  private rehydrateSceneSectionTransitionMaterial(
    clone: THREE.Material,
    originalUserData: Record<string, unknown> | undefined,
    originalClippingPlanes: THREE.Plane[] | null,
    originalClipIntersection: boolean,
  ): void {
    if (originalClippingPlanes) {
      clone.clippingPlanes = originalClippingPlanes;
      clone.clipIntersection = originalClipIntersection;
    }
    if (
      !originalUserData ||
      (originalUserData.sceneSectionObjectVisibilityPatched !== true &&
        originalUserData.sceneSectionObjectVisibilityEnabled !== true &&
        !originalUserData.sceneSectionObjectVisibilityMaskTransition)
    ) {
      return;
    }
    const planes = Array.isArray(
      originalUserData.sceneSectionObjectVisibilityPlanes,
    )
      ? (originalUserData.sceneSectionObjectVisibilityPlanes as ResolvedSceneSectionPlane[])
      : [];
    const frames = Array.isArray(
      originalUserData.sceneSectionObjectVisibilityFrames,
    )
      ? (originalUserData.sceneSectionObjectVisibilityFrames as ResolvedSceneSectionFrame[])
      : [];
    const visibility =
      originalUserData.sceneSectionObjectVisibility &&
      typeof originalUserData.sceneSectionObjectVisibility === "object"
        ? (originalUserData.sceneSectionObjectVisibility as SceneSectionObjectVisibility)
        : {
            outsideOpacityByAxis: { x: 1, y: 1, z: 1 },
            outsideOpacityByFrameId: {},
            active: false,
            hasSoftOpacity: false,
          };
    const maskTransition =
      originalUserData.sceneSectionObjectVisibilityMaskTransition &&
      typeof originalUserData.sceneSectionObjectVisibilityMaskTransition ===
        "object"
        ? (originalUserData.sceneSectionObjectVisibilityMaskTransition as SceneSectionMaskTransition)
        : null;
    const enabled =
      originalUserData.sceneSectionObjectVisibilityEnabled === true;
    delete clone.userData.sceneSectionObjectVisibilityPatched;
    delete clone.userData.sceneSectionObjectVisibilityShader;
    applySceneSectionObjectVisibilityBuiltInMaterial(
      clone,
      enabled,
      planes,
      frames,
      visibility,
      maskTransition,
    );
    if (originalClippingPlanes) {
      clone.clippingPlanes = originalClippingPlanes;
      clone.clipIntersection = originalClipIntersection;
      clone.needsUpdate = true;
    }
  }

  private cloneTransitionObjectTree(
    id: string,
    source: THREE.Object3D,
  ): THREE.Object3D {
    const originalUserData = source.userData;
    source.userData = this.cloneTransitionUserData(originalUserData);
    let snapshot: THREE.Object3D;
    try {
      snapshot = source.clone(false);
    } finally {
      source.userData = originalUserData;
    }
    snapshot.userData = {
      ...this.cloneTransitionUserData(originalUserData),
      transitionSnapshotForLayer: id,
    };
    const sourceRenderable = source as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    const snapshotRenderable = snapshot as THREE.Object3D & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    if (sourceRenderable.geometry) {
      snapshotRenderable.geometry = this.cloneTransitionGeometry(
        sourceRenderable.geometry,
      );
    }
    if (sourceRenderable.material) {
      snapshotRenderable.material = Array.isArray(sourceRenderable.material)
        ? sourceRenderable.material.map((material) =>
            this.cloneTransitionMaterial(material),
          )
        : this.cloneTransitionMaterial(sourceRenderable.material);
    }
    for (const child of source.children) {
      // Section ISO overlay roots are derived transition-scene entities with
      // their own crossfade owner (TRD-011). Cloning them into layer
      // snapshots double-draws the contours and drags them through the
      // layer envelope against that owner.
      if (
        child.userData?.mtVolumeSectionIsoOverlayGroup === true ||
        child.userData?.seismicVolumeSectionIsoOverlayGroup === true ||
        child.userData?.seismicResistivitySectionIsoOverlayGroup === true ||
        child.userData?.sectionIsoOverlayTransitionRoot === true
      ) {
        continue;
      }
      snapshot.add(this.cloneTransitionObjectTree(id, child));
    }
    return snapshot;
  }

  cloneLayerTransitionSnapshot(
    id: string,
    source: THREE.Group,
  ): THREE.Group {
    const snapshot = this.cloneTransitionObjectTree(id, source) as THREE.Group;
    snapshot.name = `${id}-transition-snapshot`;
    snapshot.userData = {
      ...snapshot.userData,
      transitionSnapshotForLayer: id,
    };
    this.scene.add(snapshot);
    return snapshot;
  }

  private removeLayerTransitionSnapshot(id: string): void {
    const snapshot = this.layerTransitionSnapshots.get(id);
    if (!snapshot) return;
    this.layerTransitionSnapshots.delete(id);
    snapshot.group.parent?.remove(snapshot.group);
    disposeObjectTree(snapshot.group);
  }

  private clearLayerTransitionSnapshots(): void {
    for (const id of Array.from(this.layerTransitionSnapshots.keys())) {
      this.removeLayerTransitionSnapshot(id);
    }
    this.removeSceneSectionHelperTransitionSnapshot();
  }

  private removeSceneSectionHelperTransitionSnapshot(): void {
    const snapshot = this.sceneSectionHelperTransitionSnapshot;
    if (!snapshot) return;
    this.sceneSectionHelperTransitionSnapshot = null;
    snapshot.group.parent?.remove(snapshot.group);
    disposeObjectTree(snapshot.group);
  }

  beginSceneSectionHelperTransitionSnapshot(
    startMs: number,
    durationMs: number,
    easing: EasingName,
  ): void {
    this.removeSceneSectionHelperTransitionSnapshot();
    const runtime = this.sceneSectionRuntime;
    if (
      !runtime?.group.visible ||
      runtime.group.children.length === 0 ||
      durationMs <= 0
    ) {
      return;
    }
    const snapshot = this.cloneTransitionObjectTree(
      UTAH_FORGE_SCENE_SECTION_LAYER_ID,
      runtime.group,
    ) as THREE.Group;
    snapshot.name = "scene-section-helper-transition-snapshot";
    snapshot.userData = {
      ...snapshot.userData,
      transitionSnapshotForLayer: UTAH_FORGE_SCENE_SECTION_LAYER_ID,
      sceneSectionHelperTransitionSnapshot: true,
    };
    this.scene.add(snapshot);
    this.applyRenderOpacityToTree(snapshot, 1);
    this.sceneSectionHelperTransitionSnapshot = {
      id: UTAH_FORGE_SCENE_SECTION_LAYER_ID,
      group: snapshot,
      from: 1,
      to: 0,
      startMs,
      durationMs,
      easing,
    };
  }

  private sectionIsoOverlayGroupsForTransition(): Array<{
    kind: SectionIsoOverlayTransitionRootKind;
    layerId: string;
    group: THREE.Group;
  }> {
    const groups: Array<{
      kind: SectionIsoOverlayTransitionRootKind;
      layerId: string;
      group: THREE.Group;
    }> = [];
    const mtLayer = this.layers.get(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID);
    const mtGroup = mtLayer?.userData.mtVolumeSectionIsoOverlayGroup as
      | THREE.Group
      | undefined;
    if (mtGroup?.parent) {
      groups.push({
        kind: "mt-volume",
        layerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        group: mtGroup,
      });
    }
    const seismicLayer = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    const seismicVolumeGroup = seismicLayer?.userData
      .seismicVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (seismicVolumeGroup?.parent) {
      groups.push({
        kind: "seismic-volume",
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        group: seismicVolumeGroup,
      });
    }
    const seismicResistivityGroup = seismicLayer?.userData
      .seismicResistivitySectionIsoOverlayGroup as THREE.Group | undefined;
    if (seismicResistivityGroup?.parent) {
      groups.push({
        kind: "seismic-resistivity",
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        group: seismicResistivityGroup,
      });
    }
    return groups;
  }

  discardSectionIsoOverlayTransition(): void {
    const transition = this.sectionIsoOverlayTransition;
    if (!transition) return;
    for (const root of [...transition.sourceRoots, ...transition.targetRoots]) {
      const isCloneSnapshot =
        root.group.userData?.sectionIsoOverlayTransitionRole === "source" ||
        root.group.userData?.transitionSnapshotForLayer !== undefined;
      if (isCloneSnapshot) {
        root.group.parent?.remove(root.group);
        disposeObjectTree(root.group);
        continue;
      }
      // Live overlay groups are registered as transition target roots.
      // Disposing them here destroys visible Section ISO content the moment
      // a chained navigation interrupts a running transition (instant pop
      // out, then pop back in at the next full apply). Leave live roots in
      // the scene at their current envelope; the next transition snapshots
      // them as sources. Inactive-target exits clear live section state through
      // the section-iso-disabled style path after detached source roots are
      // cloned for the visual fade.
      delete root.group.userData.sectionIsoOverlayTransitionRoot;
      delete root.group.userData.sectionIsoOverlayTransitionRole;
    }
    this.sectionIsoOverlayTransition = null;
  }

  clearSectionIsoOverlayTransition(): void {
    this.discardSectionIsoOverlayTransition();
  }

  private sectionIsoOverlayTransitionShouldStart(
    fromSceneSectionStyle: EditableStyle,
    toSceneSectionStyle: EditableStyle,
    hasSourceRoots: boolean,
  ): boolean {
    const sourceActive =
      fromSceneSectionStyle.sceneSectionEnabled === true &&
      this.sceneSectionActivePlanes(fromSceneSectionStyle).length > 0;
    const targetActive =
      toSceneSectionStyle.sceneSectionEnabled === true &&
      this.sceneSectionActivePlanes(toSceneSectionStyle).length > 0;
    return targetActive || (sourceActive && hasSourceRoots);
  }

  beginSectionIsoOverlayTransition(
    fromSceneSectionStyle: EditableStyle,
    toSceneSectionStyle: EditableStyle,
    startMs: number,
    durationMs: number,
    easing: EasingName,
  ): void {
    this.discardSectionIsoOverlayTransition();
    if (durationMs <= 0) return;
    const sourceRootsForTransition = this.sectionIsoOverlayGroupsForTransition();
    if (
      !this.sectionIsoOverlayTransitionShouldStart(
        fromSceneSectionStyle,
        toSceneSectionStyle,
        sourceRootsForTransition.length > 0,
      )
    ) {
      return;
    }
    const sourceRoots = sourceRootsForTransition.map(
      ({ kind, layerId, group }) => {
        const snapshot = this.cloneTransitionObjectTree(
          layerId,
          group,
        ) as THREE.Group;
        snapshot.name = `${group.name || "section-iso-overlay"}-transition-source`;
        snapshot.userData = {
          ...snapshot.userData,
          sectionIsoOverlayTransitionRoot: true,
          sectionIsoOverlayTransitionRole: "source",
        };
        // Salvage (CODEX_003): detach the source-root snapshot to the neutral
        // scene parent with the source world transform baked in, so target
        // application that hides/clears the live layer parent cannot drag the
        // fading exit snapshot with it.
        group.updateWorldMatrix(true, false);
        snapshot.matrix.copy(group.matrixWorld);
        snapshot.matrix.decompose(
          snapshot.position,
          snapshot.quaternion,
          snapshot.scale,
        );
        this.scene.add(snapshot);
        this.applyRenderOpacityToTree(snapshot, 1, 1);
        return {
          kind,
          layerId,
          group: snapshot,
          role: "source" as const,
        };
      },
    );
    this.sectionIsoOverlayTransition = {
      sourceRoots,
      targetRoots: [],
      startMs,
      durationMs,
      easing,
      targetOpacity: 0,
    };
  }

  currentSectionIsoOverlayTransitionOpacity(): number {
    return this.sectionIsoOverlayTransition?.targetOpacity ?? 1;
  }

  registerSectionIsoOverlayTransitionTargetRoot(
    kind: SectionIsoOverlayTransitionRootKind,
    layerId: string,
    group: THREE.Group,
  ): void {
    const transition = this.sectionIsoOverlayTransition;
    if (!transition) return;
    if (transition.targetRoots.some((root) => root.group === group)) {
      this.applyRenderOpacityToTree(group, 1, transition.targetOpacity);
      return;
    }
    group.userData.sectionIsoOverlayTransitionRoot = true;
    group.userData.sectionIsoOverlayTransitionRole = "target";
    transition.targetRoots.push({
      kind,
      layerId,
      group,
      role: "target",
    });
    this.applyRenderOpacityToTree(group, 1, transition.targetOpacity);
  }

  unregisterSectionIsoOverlayTransitionTargetRoot(group: THREE.Group): void {
    const transition = this.sectionIsoOverlayTransition;
    if (!transition) return;
    transition.targetRoots = transition.targetRoots.filter(
      (root) => root.group !== group,
    );
    if (group.userData?.sectionIsoOverlayTransitionRole === "target") {
      delete group.userData.sectionIsoOverlayTransitionRoot;
      delete group.userData.sectionIsoOverlayTransitionRole;
    }
  }

  tickSectionIsoOverlayTransition(nowMs: number, eased?: number): boolean {
    const transition = this.sectionIsoOverlayTransition;
    if (!transition) return false;
    const progress =
      typeof eased === "number" && Number.isFinite(eased)
        ? clamp01(eased)
        : transition.durationMs <= 0
          ? 1
          : easeProgress(
              (nowMs - transition.startMs) / transition.durationMs,
              transition.easing,
            );
    const targetOpacity = clamp01(progress);
    const sourceOpacity = 1 - targetOpacity;
    transition.targetOpacity = targetOpacity;
    for (const root of transition.sourceRoots) {
      this.applyRenderOpacityToTree(root.group, 1, sourceOpacity);
    }
    for (const root of transition.targetRoots) {
      this.applyRenderOpacityToTree(root.group, 1, targetOpacity);
    }
    return true;
  }

  commitSectionIsoOverlayTransition(): void {
    const transition = this.sectionIsoOverlayTransition;
    if (!transition) return;
    if (transition.targetOpacity < 0.98) {
      // The crossfade has not landed yet. Snapping the remaining envelope
      // to 1 in one frame is the visible "iso pop" regression, so land the
      // remainder on a short residual clock instead; tickLayerTweens keeps
      // ticking this transition until it really finishes.
      const now = performance.now();
      const elapsed =
        transition.durationMs <= 0
          ? 1
          : (now - transition.startMs) / transition.durationMs;
      if (elapsed < 1) return;
      const remainingMs = Math.max(
        120,
        (1 - transition.targetOpacity) * 360,
      );
      transition.startMs = now - remainingMs * transition.targetOpacity;
      transition.durationMs = remainingMs;
      transition.easing = "linear";
      return;
    }
    this.tickSectionIsoOverlayTransition(
      transition.startMs + transition.durationMs,
      1,
    );
    for (const root of transition.targetRoots) {
      this.applyRenderOpacityToTree(root.group, 1, 1);
    }
    for (const root of transition.sourceRoots) {
      root.group.parent?.remove(root.group);
      disposeObjectTree(root.group);
    }
    this.sectionIsoOverlayTransition = null;
  }

  addSceneSectionHelperObjectToTransitionSnapshot(
    source: THREE.Object3D,
  ): boolean {
    const snapshot = this.sceneSectionHelperTransitionSnapshot;
    if (!snapshot) return false;
    const elapsed =
      snapshot.durationMs <= 0
        ? 1
        : (performance.now() - snapshot.startMs) / snapshot.durationMs;
    if (elapsed >= 1) return false;
    const eased = easeProgress(elapsed, snapshot.easing);
    const opacity = snapshot.from + (snapshot.to - snapshot.from) * eased;
    const clone = this.cloneTransitionObjectTree(
      UTAH_FORGE_SCENE_SECTION_LAYER_ID,
      source,
    );
    clone.userData = {
      ...clone.userData,
      sceneSectionLateHelperSnapshotObject: true,
    };
    snapshot.group.add(clone);
    this.applyRenderOpacityToTree(clone, opacity);
    return true;
  }

  applyTerrainCompositeOpacity(layerId: string, opacity: number): void {
    return applyTerrainCompositeOpacityImpl.call(this, layerId, opacity);
  }

  applyTerrainFogStyle(layerId: string, affectedByFog: boolean, fogDensity: number): void {
    return applyTerrainFogStyleImpl.call(this, layerId, affectedByFog, fogDensity);
  }

  private styleForLayer(id: string): EditableStyle {
    const appliedStyle = this.appliedLayerStyles.get(id);
    if (appliedStyle) return appliedStyle;
    if (this.lastEffectiveEnv && this.lastEffectivePage) {
      return effectiveStyle(this.lastEffectiveEnv, this.lastEffectivePage, id);
    }
    return this.lastEnv?.layerStyles[id] ?? {};
  }

  private topoSurfaceVisibleForAlignment(): boolean {
    const surfaceLayerId = this.topoSurfaceLayerId();
    const terrainGroup = this.topoSurfaceGroup();
    if (!terrainGroup) return false;
    const visibleByState = this.currentVisibleLayerIds
      ? this.currentVisibleLayerIds.has(surfaceLayerId)
      : terrainGroup.visible;
    return visibleByState && terrainGroup.visible;
  }

  renderedTopoSurfaceKey(): string {
    const sampleHeight = peekHeightSampler();
    const terrainGroup = this.topoSurfaceGroup();
    if (!terrainGroup) return "topo:no-group";
    if (!this.topoSurfaceVisibleForAlignment()) return "topo:hidden";
    if (!sampleHeight) return "topo:no-sampler";
    const scaleZ =
      typeof terrainGroup.scale.z === "number" &&
      Number.isFinite(terrainGroup.scale.z)
        ? terrainGroup.scale.z
        : 1;
    const liftZ =
      typeof terrainGroup.position.z === "number" &&
      Number.isFinite(terrainGroup.position.z)
        ? terrainGroup.position.z
        : 0;
    return `topo:${scaleZ.toFixed(6)}:${liftZ.toFixed(3)}`;
  }

  renderedTopoSurfaceZ(x: number, y: number): number | null {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const sampleHeight = peekHeightSampler();
    if (!sampleHeight) return null;
    const terrainGroup = this.topoSurfaceGroup();
    if (!terrainGroup || !this.topoSurfaceVisibleForAlignment()) return null;
    const origin = this.siteSurfaceGuideOrigin(terrainGroup);
    const sourceZ =
      sampleHeight(origin.easting + x, origin.northing + y) -
      origin.elevation;
    if (!Number.isFinite(sourceZ)) return null;
    const scaleZ =
      typeof terrainGroup.scale.z === "number" &&
      Number.isFinite(terrainGroup.scale.z)
        ? terrainGroup.scale.z
        : 1;
    const liftZ =
      typeof terrainGroup.position.z === "number" &&
      Number.isFinite(terrainGroup.position.z)
        ? terrainGroup.position.z
        : 0;
    const z = sourceZ * scaleZ + liftZ;
    return Number.isFinite(z) ? z : null;
  }

  reapplyTopoAlignedOverlays(): void {
    for (const id of this.layers.keys()) {
      const style = this.styleForLayer(id);
      if (style.siteDetailsAlignToTopo === true) {
        this.applyDemoBoreholeStyle(id, style);
      }
      if (style.pointMarkerAlignToTopo === true) {
        this.applyPointMarkerStyle(id, style);
      }
    }
  }

  isSiteSurfaceGuideLayerId(id: string): boolean {
    return isSiteSurfaceGuideLayerIdImpl.call(this, id);
  }

  siteSurfaceGuideOrigin(group?: THREE.Object3D): {
    easting: number;
    northing: number;
    elevation: number;
  } {
    return siteSurfaceGuideOriginImpl.call(this, group);
  }

  sourceSiteGuideLines(group: THREE.Object3D): Vec3[][] {
    return sourceSiteGuideLinesImpl.call(this, group);
  }

  resampleSiteGuideLine(line: Vec3[], stepM: number): Vec3[] {
    return resampleSiteGuideLineImpl.call(this, line, stepM);
  }

  siteGuideSurfaceZ(x: number, y: number, sampleHeight: (easting: number, northing: number) => number, origin: { easting: number; northing: number; elevation: number }, liftM: number): number {
    return siteGuideSurfaceZImpl.call(this, x, y, sampleHeight, origin, liftM);
  }

  pointInSiteGuideRing(x: number, y: number, ring: Vec3[]): boolean {
    return pointInSiteGuideRingImpl.call(this, x, y, ring);
  }

  siteGuideRing(lines: Vec3[][]): Vec3[] | null {
    return siteGuideRingImpl.call(this, lines);
  }

  buildSiteGuideFillGeometry(ring: Vec3[], sampleHeight: (easting: number, northing: number) => number, origin: { easting: number; northing: number; elevation: number }): THREE.BufferGeometry {
    return buildSiteGuideFillGeometryImpl.call(this, ring, sampleHeight, origin);
  }

  updateSiteSurfaceGuide(id: string, group: THREE.Object3D, style: EditableStyle, sampleHeight: (easting: number, northing: number) => number): void {
    return updateSiteSurfaceGuideImpl.call(this, id, group, style, sampleHeight);
  }

  applySiteSurfaceGuideStyle(id: string, style: EditableStyle): void {
    return applySiteSurfaceGuideStyleImpl.call(this, id, style);
  }

  reapplySiteSurfaceGuides(): void {
    return reapplySiteSurfaceGuidesImpl.call(this);
  }

  applyMtSurfaceMaskStyle(id: string, style: EditableStyle): void {
    return applyMtSurfaceMaskStyleImpl.call(this, id, style);
  }

  updateMtSurfaceMaskForPoints(points: THREE.Points, options: {
      enabled: boolean;
      depthM: number;
      featherM: number;
      origin: { easting: number; northing: number; elevation: number };
      maskKey: string;
      sampleHeight: (easting: number, northing: number) => number;
      terrainScaleZ: number;
      terrainLiftZ: number;
    }): void {
    return updateMtSurfaceMaskForPointsImpl.call(this, points, options);
  }

  restoreMtSurfaceMaskMaterials(id: string): void {
    return restoreMtSurfaceMaskMaterialsImpl.call(this, id);
  }

  sceneSectionProductIds(style: EditableStyle): Set<string> {
    return sceneSectionProductIdsImpl.call(this, style);
  }

  sceneSectionLayerIds(style: EditableStyle): Set<string> {
    return sceneSectionLayerIdsImpl.call(this, style);
  }

  listSceneSectionObjectTargets(): SceneSectionObjectTarget[] {
    return listSceneSectionObjectTargetsImpl.call(this);
  }

  resolveSceneSectionPlanes(
    style: EditableStyle,
  ): ResolvedSceneSectionPlane[] {
    return resolveSceneSectionPlanesImpl.call(this, style);
  }

  sceneSectionActivePlanes(
    style: EditableStyle,
  ): ResolvedSceneSectionPlane[] {
    return sceneSectionActivePlanesImpl.call(this, style);
  }

  sceneSectionObjectTargeted(
    layerId: string,
    obj: THREE.Object3D,
    style: EditableStyle,
    layerTargets: Set<string>,
    productTargets: Set<string>,
  ): boolean {
    return sceneSectionObjectTargetedImpl.call(this, layerId, obj, style, layerTargets, productTargets);
  }

  sceneSectionObjectVisibilityForObject(
    layerId: string,
    obj: THREE.Object3D,
    style: EditableStyle,
    layerTargets: Set<string>,
    productTargets: Set<string>,
  ): SceneSectionObjectVisibility {
    return sceneSectionObjectVisibilityForObjectImpl.call(
      this,
      layerId,
      obj,
      style,
      layerTargets,
      productTargets,
    );
  }

  sceneSectionClippingPlanes(
    planes: ResolvedSceneSectionPlane[],
  ): THREE.Plane[] {
    return sceneSectionClippingPlanesImpl.call(this, planes);
  }

  sceneSectionAxisAlongIndex(
    axis: SceneSectionAxis,
  ): 0 | 1 | null {
    return sceneSectionAxisAlongIndexImpl.call(this, axis);
  }

  resolveSceneSectionWindow(
    style: EditableStyle,
    bounds: THREE.Box3,
  ): ResolvedSceneSectionWindow | null {
    return resolveSceneSectionWindowImpl.call(this, style, bounds);
  }

  resolveSceneSectionFrames(
    style: EditableStyle,
    bounds: THREE.Box3,
  ): ResolvedSceneSectionFrame[] {
    return resolveSceneSectionFramesImpl.call(this, style, bounds);
  }

  sceneSectionFrameClippingPlanes(
    frame: ResolvedSceneSectionFrame | null,
  ): THREE.Plane[] {
    return sceneSectionFrameClippingPlanesImpl.call(this, frame);
  }

  sceneSectionFrameForObject(
    layerId: string,
    obj: THREE.Object3D,
    frames: ResolvedSceneSectionFrame[],
  ): ResolvedSceneSectionFrame | null {
    return sceneSectionFrameForObjectImpl.call(this, layerId, obj, frames);
  }

  setSceneSectionUniforms(
    material: THREE.ShaderMaterial,
    planes: ResolvedSceneSectionPlane[],
    visibility: SceneSectionObjectVisibility,
    frames: ResolvedSceneSectionFrame[],
    maskTransition?: SceneSectionMaskTransition | null,
  ): void {
    return setSceneSectionUniformsImpl.call(this, material, planes, visibility, frames, maskTransition);
  }

  applySceneSectionMaterial(
    material: THREE.Material,
    planes: ResolvedSceneSectionPlane[],
    visibility: SceneSectionObjectVisibility,
    clippingPlanes: THREE.Plane[],
    frames: ResolvedSceneSectionFrame[],
    frameClippingPlanes: THREE.Plane[],
    maskTransition?: SceneSectionMaskTransition | null,
  ): void {
    return applySceneSectionMaterialImpl.call(this, material, planes, visibility, clippingPlanes, frames, frameClippingPlanes, maskTransition);
  }

  interpolatedSceneSectionStyle(
    fromStyle: EditableStyle,
    toStyle: EditableStyle,
    amount: number,
  ): EditableStyle {
    return interpolatedSceneSectionStyleImpl.call(this, fromStyle, toStyle, amount);
  }

  sceneSectionTweenStyle(
    tween: SceneSectionStyleTween,
    eased: number,
  ): EditableStyle {
    return sceneSectionTweenStyleImpl.call(this, tween, eased);
  }

  currentSceneSectionStyle(nowMs = performance.now()): EditableStyle {
    return currentSceneSectionStyleImpl.call(this, nowMs);
  }

  sceneSectionHelperOpacityForTween(
    tween: SceneSectionStyleTween,
    eased: number,
  ): number {
    return sceneSectionHelperOpacityForTweenImpl.call(this, tween, eased);
  }

  sceneSectionHelperSnapshotAllowedForTween(
    tween: SceneSectionStyleTween,
  ): boolean {
    return sceneSectionHelperSnapshotAllowedForTweenImpl.call(this, tween);
  }

  sceneSectionHelperExitSnapshotNeeded(
    fromStyle: EditableStyle,
    toStyle: EditableStyle,
  ): boolean {
    return sceneSectionHelperExitSnapshotNeededImpl.call(
      this,
      fromStyle,
      toStyle,
    );
  }

  sceneSectionMaskTransitionForTween(
    tween: SceneSectionStyleTween,
    eased: number,
  ): SceneSectionStyleMaskTransition {
    return sceneSectionMaskTransitionForTweenImpl.call(this, tween, eased);
  }

  applySceneSectionHelperTransitionOpacity(): void {
    return applySceneSectionHelperTransitionOpacityImpl.call(this);
  }

  sceneSectionBounds(
    style: EditableStyle,
    layerTargets: Set<string>,
    productTargets: Set<string>,
  ): THREE.Box3 {
    return sceneSectionBoundsImpl.call(this, style, layerTargets, productTargets);
  }

  ensureSceneSectionRuntime(): SceneSectionRuntime {
    return ensureSceneSectionRuntimeImpl.call(this);
  }

  createSceneSectionLabel(text: string, color: string): THREE.Mesh {
    return createSceneSectionLabelImpl.call(this, text, color);
  }

  createSceneSectionScaleLabel(
    text: string,
    textScale?: number,
    color?: string,
  ): THREE.Mesh {
    return createSceneSectionScaleLabelImpl.call(this, text, textScale, color);
  }

  rebuildSceneSectionHelpers(
    style: EditableStyle,
    planes: ResolvedSceneSectionPlane[],
    layerTargets: Set<string>,
    productTargets: Set<string>,
  ): void {
    return rebuildSceneSectionHelpersImpl.call(this, style, planes, layerTargets, productTargets);
  }

  applySceneSectionPlanes(
    style: EditableStyle,
    options?: SceneSectionApplyOptions,
  ): void {
    return applySceneSectionPlanesImpl.call(this, style, options);
  }

  updateSceneSectionPlanarTextFacing(camera: THREE.Camera): void {
    return updateSceneSectionPlanarTextFacingImpl.call(this, camera);
  }

  reapplySceneSectionPlanes(): void {
    return reapplySceneSectionPlanesImpl.call(this);
  }

  listSceneSectionPlanePickables(): THREE.Object3D[] {
    return listSceneSectionPlanePickablesImpl.call(this);
  }

  getSceneSectionPlanePosition(axis: SceneSectionAxis, frameId?: string): THREE.Vector3 | null {
    return getSceneSectionPlanePositionImpl.call(this, axis, frameId);
  }

  getSceneSectionPlaneScalar(axis: SceneSectionAxis, frameId?: string): number | null {
    return getSceneSectionPlaneScalarImpl.call(this, axis, frameId);
  }

  getSceneSectionPlaneNormal(axis: SceneSectionAxis, frameId?: string): THREE.Vector3 | null {
    return getSceneSectionPlaneNormalImpl.call(this, axis, frameId);
  }

  getSceneSectionWindowValue(
    axis: SceneSectionAxis,
    kind: SceneSectionWindowHandleKind,
    frameId?: string,
  ): number | null {
    return getSceneSectionWindowValueImpl.call(this, axis, kind, frameId);
  }

  getSceneSectionWindowNormal(
    axis: SceneSectionAxis,
    kind: SceneSectionWindowHandleKind,
    frameId?: string,
  ): THREE.Vector3 | null {
    return getSceneSectionWindowNormalImpl.call(this, axis, kind, frameId);
  }

  previewSceneSectionPlane(axis: SceneSectionAxis, positionM: number, frameId?: string): void {
    return previewSceneSectionPlaneImpl.call(this, axis, positionM, frameId);
  }

  private applyCaseStudyBDemoLayerAlias(
    id: string,
    style: EditableStyle,
    renderOpacity?: number,
  ): void {
    const alias = CASE_STUDY_B_DEMO_LAYER_ALIASES[id];
    if (!alias) return;
    const shell = this.layers.get(CASE_STUDY_B_DEMO_SHELL_LAYER_ID);
    if (!shell) return;

    const layerVisible = this.currentVisibleLayerIds
      ? this.currentVisibleLayerIds.has(id)
      : true;
    const layerOpacity =
      renderOpacity !== undefined
        ? clamp01(renderOpacity)
        : layerVisible
          ? clamp01(typeof style.opacity === "number" ? style.opacity : 1)
          : 0;
    const showLabels = style.showLabels !== false;

    shell.traverse((obj) => {
      const zoneId =
        typeof obj.userData?.demoZoneId === "string"
          ? obj.userData.demoZoneId
          : null;
      const matches =
        alias.all === true ||
        (zoneId !== null && alias.zoneIds?.includes(zoneId)) ||
        alias.objectNames?.includes(obj.name);
      if (!matches) return;

      const isLabelAnchor = obj.userData?.demoZoneLabelAnchor === true;
      obj.visible = isLabelAnchor
        ? layerOpacity > 0.001 && showLabels
        : layerOpacity > 0.001;

      const mat = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const material of mats) {
        if (typeof material.userData.caseBDemoBaseOpacity !== "number") {
          material.userData.caseBDemoBaseOpacity =
            typeof material.userData.demoBaseOpacity === "number"
              ? material.userData.demoBaseOpacity
              : this.baseOpacityForMaterial(material);
        }
        const baseOpacity = material.userData.caseBDemoBaseOpacity as number;
        const nextOpacity = clamp01(baseOpacity * layerOpacity);
        const colored = material as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
        };
        if (
          alias.applyColor !== false &&
          typeof style.color === "string" &&
          colored.color
        ) {
          colored.color.set(style.color);
          colored.emissive?.set(style.color);
        }
        material.opacity = nextOpacity;
        material.transparent =
          material.userData?.forceTransparent === true || nextOpacity < 1;
        material.needsUpdate = true;
      }
    });
  }

  applyTerrainLiftStyle(layerId: string, style: EditableStyle): void {
    return applyTerrainLiftStyleImpl.call(this, layerId, style);
  }

  private updateRendererLocalClipping(): void {
    this.renderer.localClippingEnabled =
      this.sceneSectionClippingActive || this.publicSurfaceClippingActive;
  }

    workingAreaFocusTargetLayerIds(style: EditableStyle): Set<string> {
    return workingAreaFocusTargetLayerIdsImpl.call(this, style);
  }

    workingAreaFocusOutsideOpacity(style: EditableStyle, layerId: string): number {
    return workingAreaFocusOutsideOpacityImpl.call(this, style, layerId);
  }

    cleanWorkingAreaFocusVector(value: unknown): THREE.Vector3 | null {
    return cleanWorkingAreaFocusVectorImpl.call(this, value);
  }

    resolveWorkingAreaFocusBounds(boundsLayerId: string): {
    min: THREE.Vector3;
    max: THREE.Vector3;
  } {
    return resolveWorkingAreaFocusBoundsImpl.call(this, boundsLayerId);
  }

    workingAreaFocusState(style: EditableStyle): WorkingAreaFocusState {
    return workingAreaFocusStateImpl.call(this, style);
  }

    workingAreaFocusSegmentPositions(min: THREE.Vector3, max: THREE.Vector3): number[] {
    return workingAreaFocusSegmentPositionsImpl.call(this, min, max);
  }

    ensureWorkingAreaFocusRuntime(): WorkingAreaFocusRuntime {
    return ensureWorkingAreaFocusRuntimeImpl.call(this);
  }

    rebuildWorkingAreaFocusHelper(state: WorkingAreaFocusState): void {
    return rebuildWorkingAreaFocusHelperImpl.call(this, state);
  }

    setKnownShaderWorkingAreaFocus(material: THREE.ShaderMaterial, enabled: boolean, state: WorkingAreaFocusState, outsideOpacity: number): boolean {
    return setKnownShaderWorkingAreaFocusImpl.call(this, material, enabled, state, outsideOpacity);
  }

    applyWorkingAreaFocusMaterial(material: THREE.Material, enabled: boolean, state: WorkingAreaFocusState, outsideOpacity: number): void {
    return applyWorkingAreaFocusMaterialImpl.call(this, material, enabled, state, outsideOpacity);
  }

    applyWorkingAreaFocusStyle(style: EditableStyle): void {
    return applyWorkingAreaFocusStyleImpl.call(this, style);
  }

    reapplyWorkingAreaFocus(): void {
    return reapplyWorkingAreaFocusImpl.call(this);
  }

    interpolatedWorkingAreaFocusStyle(fromStyle: EditableStyle, toStyle: EditableStyle, t: number): EditableStyle {
    return interpolatedWorkingAreaFocusStyleImpl.call(this, fromStyle, toStyle, t);
  }

    transitionWorkingAreaFocusForPage(fromEnvironment: EnvironmentSetup, toEnvironment: EnvironmentSetup, fromPage: PresentationPage, toPage: PresentationPage, durationMs: number, easing: EasingName): void {
    return transitionWorkingAreaFocusForPageImpl.call(this, fromEnvironment, toEnvironment, fromPage, toPage, durationMs, easing);
  }

    getWorkingAreaFocusDebugState(): {
    enabled: boolean;
    mode: string;
    boundsLayerId: string;
    targetLayerIds: string[];
    outsideOpacityByLayerId: Record<string, number>;
    helperVisible: boolean;
    helperRenderable: boolean;
    boundsMin: [number, number, number];
    boundsMax: [number, number, number];
  } {
    return getWorkingAreaFocusDebugStateImpl.call(this);
  }

  applyTerrainCompositeStyle(layerId: string, style: EditableStyle): void {
    return applyTerrainCompositeStyleImpl.call(this, layerId, style);
  }

  applyEzGammaStyle(layerId: string, style: EditableStyle): void {
    applyEzGammaStyleToLayer.call(this, layerId, style);
  }

  private updateEzGammaBillboards(camera: THREE.Camera): void {
    const group = this.layers.get("ez-gamma-2024");
    if (!group || !group.visible) return;
    group.traverse((obj) => {
      if (obj.userData?.ezGammaBillboardPivot !== true) return;
      obj.getWorldPosition(this.ezGammaWorldPos);
      this.ezGammaToCamera.copy(camera.position).sub(this.ezGammaWorldPos);
      this.ezGammaToCamera.z = 0;
      if (this.ezGammaToCamera.lengthSq() < 0.0001) return;
      this.ezGammaToCamera.normalize();
      obj.rotation.z =
        Math.atan2(this.ezGammaToCamera.y, this.ezGammaToCamera.x) +
        Math.PI / 2;
    });
  }

  applyStreamLakeOcclusion(lakesVisible: boolean): void {
    const streamsGroup = this.layers.get("hydrography-streams");
    if (!streamsGroup) return;
    streamsGroup.traverse((obj) => {
      if (obj.userData?.hiddenByLakes === true) {
        obj.visible = !lakesVisible;
      }
    });
  }

  previewSceneSectionWindow(
    axis: SceneSectionAxis,
    kind: SceneSectionWindowHandleKind,
    valueM: number,
    frameId?: string,
  ): void {
    return previewSceneSectionWindowImpl.call(this, axis, kind, valueM, frameId);
  }

  applyDemoBoreholeStyle(layerId: string, style: EditableStyle): void {
    applyDemoBoreholeStyleToLayer.call(this, layerId, style);
  }

  applyUtahForgeBoreholeLogStyle(layerId: string, style: EditableStyle): void {
    applyUtahForgeBoreholeLogStyleToLayer.call(this, layerId, style);
  }

  applyGeochemStyle(layerId: string, style: EditableStyle): void {
    applyGeochemStyleToLayer.call(this, layerId, style);
  }

  applyHyperspectralStyle(layerId: string, style: EditableStyle): void {
    applyHyperspectralStyleToLayer.call(this, layerId, style);
  }

  applyImageryLidarAoiStyle(layerId: string, style: EditableStyle): void {
    applyImageryLidarAoiStyleToLayer.call(this, layerId, style);
  }

  private updateAreaOutlineHandleVisibility(): void {
    this.areaOutlineController.updateHandleVisibility();
  }

  listAreaOutlinePickables(): THREE.Object3D[] {
    return this.areaOutlineController.listPickables();
  }

  previewAreaOutlineMove(id: string, sceneCenter: THREE.Vector3): void {
    this.areaOutlineController.previewAreaOutlineMove(id, sceneCenter);
  }

  getAreaOutlineWorldCenter(id: string): THREE.Vector3 | null {
    return this.areaOutlineController.getAreaOutlineWorldCenter(id);
  }

  previewAreaOutlineScaleFromWorld(
    id: string,
    mode: "scaleX" | "scaleY",
    worldPoint: THREE.Vector3,
  ): void {
    this.areaOutlineController.previewAreaOutlineScaleFromWorld(
      id,
      mode,
      worldPoint,
    );
  }

  getAreaOutlinePreview(id: string): AreaOutlinePreview | null {
    return this.areaOutlineController.getAreaOutlinePreview(id);
  }

  rebuildAreaOutlines(outlines: AreaOutlineDef[] = []): void {
    this.areaOutlineController.rebuild(outlines);
  }

  listLocalAtmospherePickables(): THREE.Object3D[] {
    return listLocalAtmospherePickables(this.layers.values(), this.editorMode);
  }

  private localAtmosphereRoot(layerId: string): THREE.Group | null {
    const layer = this.layers.get(layerId);
    return layer ? findLocalAtmosphereVolumeRoot(layer) : null;
  }

  getLocalAtmosphereWorldCenter(layerId: string): THREE.Vector3 | null {
    const root = this.localAtmosphereRoot(layerId);
    return root ? getLocalAtmosphereWorldCenter(root) : null;
  }

  previewLocalAtmosphereMove(
    layerId: string,
    sceneCenter: THREE.Vector3,
  ): void {
    const root = this.localAtmosphereRoot(layerId);
    if (root) previewLocalAtmosphereMove(root, sceneCenter);
  }

  previewLocalAtmosphereSizeFromWorld(
    layerId: string,
    mode: Exclude<LocalAtmosphereHandleMode, "move">,
    worldPoint: THREE.Vector3,
  ): void {
    const root = this.localAtmosphereRoot(layerId);
    if (root) previewLocalAtmosphereSizeFromWorld(root, mode, worldPoint);
  }

  getLocalAtmospherePreview(layerId: string): LocalAtmospherePreview | null {
    const root = this.localAtmosphereRoot(layerId);
    return root ? getLocalAtmospherePreview(root) : null;
  }

  applyDrillingAssayDisplay(sp: SceneProperties): void {
    applyDrillingAssayDisplayToLayers(this.layers, sp);
  }

  applyTopoDetailDistanceDisplay(sp: SceneProperties): void {
    applyTopoDetailDistanceDisplayToLayers(this.layers, sp);
  }

  getLayer(id: string): THREE.Group | undefined {
    return this.layers.get(id);
  }

  getSectionIsoOverlayDebugState(): SectionIsoOverlayDebugState {
    let overlayMaterialCount = 0;
    let independentOverlayMaterialCount = 0;
    let transitionEnvelopeOverlayMaterialCount = 0;
    let hiddenWithParentMaterialCount = 0;
    let layerRenderOpacityMin: number | null = null;
    let layerRenderOpacityMax: number | null = null;
    let transitionOpacityMin: number | null = null;
    let transitionOpacityMax: number | null = null;
    const addRangeValue = (
      value: unknown,
      currentMin: number | null,
      currentMax: number | null,
    ): [number | null, number | null] => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return [currentMin, currentMax];
      }
      const next = clamp01(value);
      return [
        currentMin === null ? next : Math.min(currentMin, next),
        currentMax === null ? next : Math.max(currentMax, next),
      ];
    };

    for (const group of this.layers.values()) {
      group.traverse((obj) => {
        const mat = (obj as THREE.Mesh | THREE.Line).material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (!mat) return;
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const material of mats) {
          const isSectionIsoOverlay =
            obj.userData?.scalarSectionIsoOverlay === true ||
            material.userData?.scalarSectionIsoOverlay === true;
          if (!isSectionIsoOverlay) continue;
          overlayMaterialCount += 1;
          if (
            material.userData?.sectionIsoOpacityPolicy ===
            "independent-of-layer-render-opacity"
          ) {
            independentOverlayMaterialCount += 1;
          }
          if (
            material.userData?.sectionIsoOpacityPolicy ===
            "transition-envelope-opacity"
          ) {
            transitionEnvelopeOverlayMaterialCount += 1;
          }
          if (
            material.userData?.sectionIsoOpacityPolicy ===
            "hidden-with-parent-layer"
          ) {
            hiddenWithParentMaterialCount += 1;
          }
          [layerRenderOpacityMin, layerRenderOpacityMax] = addRangeValue(
            material.userData?.sectionIsoLayerRenderOpacity,
            layerRenderOpacityMin,
            layerRenderOpacityMax,
          );
          [transitionOpacityMin, transitionOpacityMax] = addRangeValue(
            material.userData?.sectionIsoTransitionOpacity,
            transitionOpacityMin,
            transitionOpacityMax,
          );
        }
      });
    }

    return {
      opacityPolicy: "split-section-iso-overlay-opacity-from-layer-opacity",
      overlayMaterialCount,
      independentOverlayMaterialCount,
      transitionEnvelopeOverlayMaterialCount,
      hiddenWithParentMaterialCount,
      layerRenderOpacityMin,
      layerRenderOpacityMax,
      transitionOpacityMin,
      transitionOpacityMax,
    };
  }

  private countGroundTraceObjects(root: THREE.Object3D | null | undefined): number {
    if (!root) return 0;
    let count = 0;
    root.traverse((obj) => {
      if (obj.userData?.sceneSectionGroundTrace === true) count += 1;
    });
    return count;
  }

  getSceneSectionHelperDebugState(): SceneSectionHelperDebugState {
    return {
      groundTracePolicy: "mirror-delayed-ground-trace-into-helper-snapshot",
      liveGroundTraceCount: this.countGroundTraceObjects(
        this.sceneSectionRuntime?.group,
      ),
      snapshotGroundTraceCount: this.countGroundTraceObjects(
        this.sceneSectionHelperTransitionSnapshot?.group,
      ),
      snapshotActive: this.sceneSectionHelperTransitionSnapshot !== null,
      transitionOpacity: this.sceneSectionHelperTransitionOpacity,
    };
  }

  getTransitionDebugState(): {
    active: boolean;
    sourcePageId: string | null;
    targetPageId: string | null;
    reason: NavigationReason | null;
    activeDataTransitionCount: number;
    snapshotCount: number;
    scalarTweenCount: number;
    layerTweenCount: number;
    workingAreaFocusTweenActive: boolean;
    sceneSectionStyleTweenActive: boolean;
    sceneSectionHelperTransitionSnapshotActive: boolean;
    sceneSectionHelperTransitionOpacity: number;
    layerTweenTick: LayerTweenTickDebugState | null;
    frameUpdate: FrameUpdateDebugState | null;
    sectionIsoOverlays: SectionIsoOverlayDebugState;
    sceneSectionHelpers: SceneSectionHelperDebugState;
    productFamilies: ProductTransitionDecision[];
    assignmentTraces: TransitionAssignmentTrace[];
    readinessAttachedLayerIds: string[];
    sceneOverlays: SceneOverlayDebugState;
    cinematicPost: CinematicSceneTransitionDebugState;
    lateReapply: LateReapplyDebugState;
    transitionCommit: {
      transitionId: string;
      commitOwner: string;
      commitPhase: string | null;
      hasFinalized: boolean;
      finalizedAt: number | null;
      suppressedDuplicateAssertions: number;
    } | null;
    commitTraces: TransitionCommitTrace[];
  } {
    const transition = this.activeSceneTransitionContext;
    const commitState = transition?.commitState ?? this.lastTransitionCommitState;
    return {
      active: !!transition,
      sourcePageId: transition?.sourcePageId ?? null,
      targetPageId: transition?.targetPageId ?? null,
      reason: transition?.reason ?? null,
      activeDataTransitionCount:
        this.layerTweens.size +
        this.scalarStyleTweens.size +
        (this.workingAreaFocusTween ? 1 : 0),
      snapshotCount: this.layerTransitionSnapshots.size,
      scalarTweenCount: this.scalarStyleTweens.size,
      layerTweenCount: this.layerTweens.size,
      workingAreaFocusTweenActive: this.workingAreaFocusTween !== null,
      sceneSectionStyleTweenActive: this.sceneSectionStyleTween !== null,
      sceneSectionHelperTransitionSnapshotActive:
        this.sceneSectionHelperTransitionSnapshot !== null,
      sceneSectionHelperTransitionOpacity: this.sceneSectionHelperTransitionOpacity,
      layerTweenTick: this.lastLayerTweenTickDebug,
      frameUpdate: this.lastFrameUpdateDebug,
      sectionIsoOverlays: this.getSectionIsoOverlayDebugState(),
      sceneSectionHelpers: this.getSceneSectionHelperDebugState(),
      productFamilies: transition?.productFamilies.slice() ?? [],
      assignmentTraces: transition?.assignmentTraces.slice() ?? [],
      readinessAttachedLayerIds: Array.from(
        transition?.readinessAttachedLayerIds ?? [],
      ).sort(),
      sceneOverlays: this.getSceneOverlayDebugState(),
      cinematicPost: this.lastCinematicSceneTransitionDebug,
      lateReapply: this.getLateReapplyDebugState(),
      transitionCommit: commitState
        ? {
            transitionId: commitState.transitionId,
            commitOwner: commitState.commitOwner,
            commitPhase: commitState.commitPhase,
            hasFinalized: commitState.hasFinalized,
            finalizedAt: commitState.finalizedAt,
            suppressedDuplicateAssertions:
              commitState.suppressedDuplicateAssertions,
          }
        : null,
      commitTraces: commitState?.commitTraces.slice() ?? [],
    };
  }

  getSceneOverlayDebugState(): SceneOverlayDebugState {
    return this.sceneOverlayController.getDebugState();
  }

  getLateReapplyDebugState(): LateReapplyDebugState {
    return {
      totalCount: this.lateReapplyDebugSequence,
      duringTransitionCount: this.lateReapplyDebugDuringTransitionCount,
      events: this.lateReapplyDebugEvents.slice(),
    };
  }

  private recordLateReapplyDebugEvent(
    reason: LateReapplyDebugEvent["reason"],
    action: LateReapplyDebugEvent["action"],
  ): void {
    const transition = this.activeSceneTransitionContext;
    const duringTransition = transition !== null;
    if (duringTransition) this.lateReapplyDebugDuringTransitionCount += 1;
    const transitionProgress = this.activeTransitionEasedProgress();
    const timeMs =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    this.lateReapplyDebugEvents.push({
      sequence: ++this.lateReapplyDebugSequence,
      reason,
      action,
      pageId: this.lastEffectivePage?.id ?? null,
      duringTransition,
      transitionSourcePageId: transition?.sourcePageId ?? null,
      transitionTargetPageId: transition?.targetPageId ?? null,
      transitionReason: transition?.reason ?? null,
      transitionProgress,
      timeMs,
    });
    if (this.lateReapplyDebugEvents.length > 25) {
      this.lateReapplyDebugEvents.shift();
    }
  }

  private activeTransitionEasedProgress(nowMs = performance.now()): number | null {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return null;
    const raw =
      transition.durationMs <= 0
        ? 1
        : (nowMs - transition.startMs) / transition.durationMs;
    return clamp01(easeProgress(raw, transition.easing));
  }

  private transitionCommitTargetGraph(): TransitionCommitGraph {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return { entities: [] };
    return transitionCommitGraphFromAssignmentTraces(
      transition.assignmentTraces,
      "target",
    );
  }

  private observeTransitionCommitGraph(
    expected: TransitionCommitGraph,
  ): TransitionCommitGraph {
    return observeTransitionCommitGraph(expected, (layerId) => {
      const group = this.layers.get(layerId);
      if (!group) return { attached: false, visible: false, opacity: null };
      // NaN is deliberate: an unmeasurable material must remain unknown,
      // never fall back to an authored or projected target opacity.
      const opacity = group.visible
        ? this.currentRenderOpacityForTree(group, Number.NaN)
        : 0;
      return {
        attached: true,
        visible: group.visible,
        opacity: Number.isFinite(opacity) ? opacity : null,
      };
    });
  }

  recordTransitionCommitAttempt(input: {
    phase:
      | "terminal-before-commit"
      | "final-commit"
      | "duplicate-target-assertion"
      | "overlay-end-application"
      | "editor-deferred-reapply"
      | "tween-completion"
      | "post-commit-graph-check";
    attemptedBy: string;
    terminalTransitionGraph?: TransitionCommitGraph | null;
    resolvedTargetGraph?: TransitionCommitGraph | null;
    committedGraph?: TransitionCommitGraph | null;
    reason?: string;
  }): TransitionCommitTrace | null {
    const activeState = this.activeSceneTransitionContext?.commitState ?? null;
    const commitState = activeState ?? this.lastTransitionCommitState;
    if (!commitState) return null;
    const trace = recordTransitionCommitAttemptImpl(commitState, {
      ...input,
      resolvedTargetGraph:
        input.resolvedTargetGraph ??
        (this.activeSceneTransitionContext
          ? this.transitionCommitTargetGraph()
          : { entities: [] }),
    });
    if (commitState.hasFinalized) {
      this.lastTransitionCommitState = commitState;
    }
    return trace;
  }

  suppressPostCommitTargetAssertion(
    pageId: string | null,
    attemptedBy: string,
  ): boolean {
    const state = this.lastTransitionCommitState;
    if (
      !state?.hasFinalized ||
      !pageId ||
      state.targetPageId !== pageId ||
      this.lastPostCommitTargetAssertionSuppressed
    ) {
      return false;
    }
    this.applySettledMtCellPointsTargetStyle(pageId);
    const trace = this.recordTransitionCommitAttempt({
      phase: "duplicate-target-assertion",
      attemptedBy,
      reason: "post-transition target assertion suppressed after final commit",
    });
    if (trace?.suppressed) {
      this.lastPostCommitTargetAssertionSuppressed = true;
      return true;
    }
    return false;
  }

  private suppressDuplicatePostCommitReapply(page: PresentationPage | null): boolean {
    const state = this.lastTransitionCommitState;
    if (!state?.hasFinalized || !page || state.targetPageId !== page.id) {
      return false;
    }
    this.applySettledMtCellPointsTargetStyle(page.id);
    const trace = this.recordTransitionCommitAttempt({
      phase: "editor-deferred-reapply",
      attemptedBy: "SceneManager.reapplyCurrentPageState",
      reason: "post-transition target reapply suppressed after final commit",
    });
    if (trace?.suppressed) {
      this.lastPostCommitTargetAssertionSuppressed = true;
      return true;
    }
    return false;
  }

  private applySettledMtCellPointsTargetStyle(
    pageId: string | null,
  ): void {
    if (
      !pageId ||
      this.lastEffectivePage?.id !== pageId ||
      !this.lastEffectiveEnv ||
      this.scalarStyleTweens.has(UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID)
    ) {
      return;
    }
    this.applyStyle(
      UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
      effectiveStyle(
        this.lastEffectiveEnv,
        this.lastEffectivePage,
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
      ),
    );
  }

  finalizePageTransitionCommit(
    environment: EnvironmentSetup,
    nextPage: PresentationPage,
  ): TransitionCommitTrace | null {
    if (!this.activeSceneTransitionContext) {
      this.sceneOverlayController.applySceneOverlaysAtTransitionEnd(
        environment,
        nextPage,
        undefined,
      );
      return null;
    }
    const resolvedTargetGraph = this.transitionCommitTargetGraph();
    const terminalTransitionGraph =
      this.observeTransitionCommitGraph(resolvedTargetGraph);
    this.lastPostCommitTargetAssertionSuppressed = false;
    this.recordTransitionCommitAttempt({
      phase: "terminal-before-commit",
      attemptedBy: "SceneManager.finalizePageTransitionCommit",
      terminalTransitionGraph,
      resolvedTargetGraph,
      reason: "terminal graph captured before final commit owner runs",
    });
    const finalTrace = this.recordTransitionCommitAttempt({
      phase: "final-commit",
      attemptedBy: "SceneManager.finalizePageTransitionCommit",
      terminalTransitionGraph,
      resolvedTargetGraph,
      // No committed-state receipt exists until final scene writers run.
      reason: "SceneManager owns page-transition final commit",
    });
    if (finalTrace?.allowed) {
      this.cinematicSceneTransition = null;
      this.environmentSceneTransition = null;
      this.currentEnvironmentSceneTransitionFrame = null;
      this.lastCinematicSceneTransitionDebug =
        inactiveCinematicSceneTransitionDebugState();
      this.applyEnvironment(environment);
      this.applyPageScene(nextPage);
      this.sceneOverlayController.applySceneOverlaysAtTransitionEnd(
        environment,
        nextPage,
        this.sceneOverlayTransitionClock(),
      );
      // Reveal lazy MT threshold boundaries that loaded HIDDEN during the
      // transition. The lazy loader attaches surface meshes with visible=false
      // mid-transition (to avoid a full-opacity pop) and the per-frame readiness
      // path does not reliably flip them on, so without this they stay
      // loaded-but-hidden after navigating to a page that shows them (only a
      // manual toggle re-styled them). Narrow single-layer reveal at settle;
      // respects per-boundary visibility (a page that hides them keeps the layer
      // group hidden anyway), and is idempotent if they were already revealed.
      this.applyMtThresholdSurfaceStyle(
        UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
        effectiveStyle(
          environment,
          nextPage,
          UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
        ),
      );
    }
    const committedGraph = this.observeTransitionCommitGraph(resolvedTargetGraph);
    this.recordTransitionCommitAttempt({
      phase: "post-commit-graph-check",
      attemptedBy: "SceneManager.finalizePageTransitionCommit",
      terminalTransitionGraph,
      resolvedTargetGraph,
      committedGraph,
      reason: "observed attached scene-root visibility and measurable material opacity; other channels unresolved",
    });
    return finalTrace;
  }

  private transitionTweenEasedProgress(
    tween: Pick<LayerOpacityTween, "startMs" | "durationMs" | "easing">,
    nowMs: number,
  ): number {
    const raw =
      tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
    return clamp01(easeProgress(raw, tween.easing));
  }

  private transitionTerrainOpacityOverrides(): Map<string, number> {
    const ids = [
      "hydrography-lakes",
      "three-firs-target",
      "great-plains-target",
      "claim-boundary",
      "bedrock-geology",
      "trees-vri",
    ];
    const overrides = new Map<string, number>();
    for (const id of ids) {
      if (!this.transitionEnvelopeAllowsLayer(id)) continue;
      overrides.set(id, this.transitionFrameOpacityForLayer(id));
    }
    return overrides;
  }

  private reapplyActiveTransitionPageState(
    environment: EnvironmentSetup,
    page: PresentationPage,
    reason: ReapplyCurrentPageStateReason = "state-reapply",
  ): void {
    this.lastEffectiveEnv = environment;
    this.lastEffectivePage = page;
    this.applyEnvironment(environment);
    this.applyPageScene(page);

    const nowMs = performance.now();
    if (reason === "async-layer-resolve") {
      this.attachReadyTargetLayersDuringActiveTransition(
        environment,
        page,
        nowMs,
      );
    }
    this.sceneSectionReapplySuspended = true;
    try {
      for (const id of this.layers.keys()) {
        const scalarTween = this.scalarStyleTweens.get(id);
        if (scalarTween) {
          this.applyStyle(
            id,
            this.interpolatedScalarStyle(
              scalarTween.fromStyle,
              scalarTween.toStyle,
              this.transitionTweenEasedProgress(scalarTween, nowMs),
            ),
          );
          continue;
        }
        this.applyStyle(id, effectiveStyle(environment, page, id));
      }
    } finally {
      this.sceneSectionReapplySuspended = false;
    }

    if (this.sceneSectionStyleTween) {
      this.sceneSectionHelperTransitionOpacity =
        this.sceneSectionHelperOpacityForTween(
          this.sceneSectionStyleTween,
          this.transitionTweenEasedProgress(this.sceneSectionStyleTween, nowMs),
        );
    }
    this.reapplySceneSectionPlanes();

    if (this.workingAreaFocusTween) {
      this.applyWorkingAreaFocusStyle(
        this.interpolatedWorkingAreaFocusStyle(
          this.workingAreaFocusTween.fromStyle,
          this.workingAreaFocusTween.toStyle,
          this.transitionTweenEasedProgress(this.workingAreaFocusTween, nowMs),
        ),
      );
    } else {
      this.reapplyWorkingAreaFocus();
    }

    this.applyLakesToTerrain(
      environment,
      page,
      this.transitionTerrainOpacityOverrides(),
    );
    this.enforceTransitionVisibilityEnvelope();
  }

  private attachReadyTargetLayersDuringActiveTransition(
    environment: EnvironmentSetup,
    page: PresentationPage,
    nowMs: number,
  ): void {
    const transition = this.activeSceneTransitionContext;
    if (!transition || transition.targetNotReadyLayerIds.size === 0) return;
    for (const layerId of Array.from(transition.targetNotReadyLayerIds)) {
      if (this.mtThresholdLayerIsLazy(layerId)) {
        // Lazy MT surfaces are "ready" only when the target's visible boundary
        // meshes are actually attached; keep fetching until then so they enter
        // on the transition clock rather than popping in at full opacity.
        const targetStyle = effectiveStyle(environment, page, layerId);
        if (!this.mtThresholdLayerGeometryReady(layerId, targetStyle)) {
          this.prefetchMtThresholdTargetBoundaries(layerId, targetStyle);
          continue;
        }
      } else if (!this.layers.has(layerId)) {
        continue;
      }
      transition.targetNotReadyLayerIds.delete(layerId);
      transition.readinessAttachedLayerIds.add(layerId);
      if (!transition.targetVisibleLayerIds.has(layerId)) continue;
      if (
        this.layerTweens.has(layerId) ||
        this.scalarStyleTweens.has(layerId) ||
        this.layerTransitionSnapshots.has(layerId)
      ) {
        continue;
      }

      const remainingMs = Math.max(
        0,
        transition.startMs + transition.durationMs - nowMs,
      );
      const readyEntityKeys = new Set<string>([`layer:${layerId}`, layerId]);
      if (transition.executionPlan) {
        replanTransitionEntityReadiness(
          transition.executionPlan,
          readyEntityKeys,
          nowMs,
          remainingMs,
        );
      }
      const targetOpacity = this.targetOpacityForLayer(environment, page, layerId);
      this.applyStyle(layerId, effectiveStyle(environment, page, layerId));
      if (targetOpacity <= 0.001) {
        // Hidden target: apply instantly (no fade needed).
        this.applyLayerTransitionRenderOpacity(layerId, targetOpacity, 0);
        continue;
      }
      const nearEnd = remainingMs <= READINESS_ENTER_MIN_REMAINING_MS;
      // F3 fade floor: with the flag ON a near-end visible late arrival fades
      // over a floor instead of snapping to full opacity; flag OFF keeps the
      // legacy snap-on. This is the v1 idea done through the pipeline.
      if (nearEnd && !this.perEntityBehaviorActive) {
        this.applyLayerTransitionRenderOpacity(layerId, targetOpacity, 1);
        continue;
      }
      this.applyLayerTransitionRenderOpacity(layerId, 0, 0);
      const lateFadeMs = nearEnd
        ? Math.max(remainingMs, ENTITY_BEHAVIOR_FADE_FLOOR_MS)
        : remainingMs;
      // Opacity owner via the pipeline (F2 parity for the normal fade; F3 floor
      // for the near-end case). Else legacy assignment.
      if (
        this.perEntityBehaviorActive &&
        applyEntityOpacityFade(
          this,
          layerId,
          0,
          targetOpacity,
          nowMs,
          lateFadeMs,
          transition.easing,
        )
      ) {
        continue;
      }
      this.layerTweens.set(layerId, {
        from: 0,
        to: targetOpacity,
        startMs: nowMs,
        durationMs: lateFadeMs,
        easing: transition.easing,
      });
    }
  }

  private listAuthoredScalarSectionIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    const targets: ScalarSectionIsoTarget[] = [];
    const entries =
      typeof layerId === "string"
        ? ([[layerId, this.layers.get(layerId)]].filter(
            (entry) => entry[1],
          ) as Array<[string, THREE.Group]>)
        : Array.from(this.layers.entries());
    for (const [id, group] of entries) {
      group.traverse((obj) => {
        if (!isScalarSectionMesh(obj)) return;
        const sectionId = scalarSectionMeshId(obj) ?? obj.uuid;
        const range = scalarSourceRange(obj.geometry);
        targets.push({
          targetKey: scalarSectionTargetKey(id, obj),
          layerId: id,
          sectionId,
          label: scalarSectionMeshLabel(obj),
          kind: scalarSectionMeshKind(obj),
          group: "mt-slices",
          groupLabel: "MT slices",
          visible: group.visible && obj.visible,
          scalarMin: range.min,
          scalarMax: range.max,
        });
      });
    }
    return targets;
  }

  private listSeismicSectionIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return [];
    const group = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!group) return [];
    const targets: ScalarSectionIsoTarget[] = [];
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.userData?.seismicSection !== true) return;
      const values = obj.geometry.userData.seismicAmplitudeValues as
        | Float32Array
        | number[]
        | undefined;
      let scalarMin = 0;
      let scalarMax = 1;
      if (values && values.length > 0) {
        scalarMin = 1;
        scalarMax = 0;
        for (let i = 0; i < values.length; i += 1) {
          const value = values[i];
          if (!Number.isFinite(value)) continue;
          scalarMin = Math.min(scalarMin, value);
          scalarMax = Math.max(scalarMax, value);
        }
        if (scalarMax <= scalarMin) {
          scalarMin = 0;
          scalarMax = 1;
        }
      }
      const sectionId = seismicSectionMeshId(obj) ?? obj.uuid;
      targets.push({
        targetKey: seismicSectionTargetKey(
          UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
          obj,
        ),
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        sectionId,
        label: seismicSectionMeshLabel(obj),
        kind: seismicSectionMeshKind(obj),
        group: "seismic-sections",
        groupLabel: "Seismic sections",
        visible: group.visible && obj.visible,
        scalarMin,
        scalarMax,
        isoSource: "seismic-amplitude",
        sourceLayerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
      });
    });
    return targets;
  }

  activeScalarVolumeMesh(): THREE.Mesh | null {
    const group = this.layers.get(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID);
    if (!group || !group.visible) return null;
    let active: THREE.Mesh | null = null;
    group.traverse((obj) => {
      if (active) return;
      if (
        obj instanceof THREE.Mesh &&
        obj.userData?.scalarVolume === true &&
        obj.visible
      ) {
        active = obj;
      }
    });
    return active;
  }

  activeSeismicVolumeMesh(): THREE.Mesh | null {
    const group = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!group || !group.visible) return null;
    let active: THREE.Mesh | null = null;
    group.traverse((obj) => {
      if (active) return;
      if (
        obj instanceof THREE.Mesh &&
        obj.userData?.seismicRaymarchVolume === true &&
        obj.visible
      ) {
        active = obj;
      }
    });
    return active;
  }

  listMtVolumeCutIsoTargets(layerId?: string): ScalarSectionIsoTarget[] {
    return listMtVolumeCutIsoTargetsImpl.call(this, layerId);
  }

  listSeismicVolumeCutIsoTargets(layerId?: string): ScalarSectionIsoTarget[] {
    return listSeismicVolumeCutIsoTargetsImpl.call(this, layerId);
  }

  listSeismicResistivitySectionIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    return listSeismicResistivitySectionIsoTargetsImpl.call(this, layerId);
  }

  listSeismicResistivityVolumeCutIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    return listSeismicResistivityVolumeCutIsoTargetsImpl.call(this, layerId);
  }

  listSectionIsoTargets(layerId?: string): ScalarSectionIsoTarget[] {
    const targets = [
      ...this.listAuthoredScalarSectionIsoTargets(layerId),
      ...this.listMtVolumeCutIsoTargets(layerId),
      ...this.listSeismicSectionIsoTargets(layerId),
      ...this.listSeismicVolumeCutIsoTargets(layerId),
      ...this.listSeismicResistivitySectionIsoTargets(layerId),
      ...this.listSeismicResistivityVolumeCutIsoTargets(layerId),
    ];
    const groupOrder: Record<SectionIsoTargetGroup, number> = {
      "mt-slices": 0,
      "mt-volume-cuts": 1,
      "seismic-sections": 2,
      "seismic-volume-cuts": 3,
      "resistivity-on-seismic-sections": 4,
      "resistivity-on-seismic-volume-cuts": 5,
    };
    targets.sort((a, b) => {
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      if (a.group !== b.group) return groupOrder[a.group] - groupOrder[b.group];
      if (a.layerId !== b.layerId) return a.layerId.localeCompare(b.layerId);
      return a.label.localeCompare(b.label);
    });
    return targets;
  }

  listScalarSectionIsoTargets(layerId?: string): ScalarSectionIsoTarget[] {
    return this.listAuthoredScalarSectionIsoTargets(layerId).sort((a, b) => {
      if (a.visible !== b.visible) return a.visible ? -1 : 1;
      if (a.layerId !== b.layerId) return a.layerId.localeCompare(b.layerId);
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Iterator over (id, group) pairs. Used by the hover-raycaster in
   * scene.ts to assemble the set of intersect targets minus terrain.
   */
  layerEntries(): IterableIterator<[string, THREE.Group]> {
    return this.layers.entries();
  }

  applySurfaceGradientStyle(id: string, style: EditableStyle): void {
    return applySurfaceGradientStyleImpl.call(this, id, style);
  }

  applyMtTopSurfaceStyle(id: string, style: EditableStyle): void {
    return applyMtTopSurfaceStyleImpl.call(this, id, style);
  }

  applyScalarPreviewStyle(id: string, style: EditableStyle): void {
    applyScalarPreviewStyleToLayer.call(this, id, style);
  }

  applyPointMarkerStyle(id: string, style: EditableStyle): void {
    return applyPointMarkerStyleImpl.call(this, id, style);
  }

  applyResistivitySliceStyle(id: string, style: EditableStyle): void {
    return applyResistivitySliceStyleImpl.call(this, id, style);
  }





  applyScalarVolumeStyle(id: string, style: EditableStyle): void {
    return applyScalarVolumeStyleImpl.call(this, id, style);
  }
  scalarVolumeIsoOverlayGroup(volumeLayer: THREE.Group): THREE.Group {
    return scalarVolumeIsoOverlayGroupImpl.call(this, volumeLayer);
  }

  clearMtVolumeCutIsoOverlays(volumeLayer?: THREE.Group): void {
    return clearMtVolumeCutIsoOverlaysImpl.call(this, volumeLayer);
  }

  sampleScalarVolumeByte(bytes: Uint8Array, dimensions: [number, number, number], u: number, v: number, w: number): number {
    return sampleScalarVolumeByteImpl.call(this, bytes, dimensions, u, v, w);
  }

  buildMtVolumeCutMesh(mesh: THREE.Mesh, plane: ResolvedSceneSectionPlane, options: {
      sourceMin: number;
      sourceMax: number;
      thresholdMin: number;
      thresholdMax: number;
      maskVisible: boolean;
      targetKey: string;
      sectionFrame?: ResolvedSceneSectionFrame | null;
    }): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
    hardMaskValues: Float32Array;
    debug: {
      totalMs: number;
      setupMs: number;
      frameRangeMs: number;
      bufferAllocMs: number;
      gridSampleMs: number;
      indexMs: number;
      geometryMs: number;
      materialMs: number;
      meshObjectMs: number;
      vertexCount: number;
      indexCount: number;
    };
  } | null {
    return buildMtVolumeCutMeshImpl.call(this, mesh, plane, options);
  }

  private transitionAwareSectionIsoOverlayUpdateOptions(
    style: EditableStyle,
    options?: SectionIsoOverlayUpdateOptions,
  ): SectionIsoOverlayUpdateOptions | undefined {
    const transition = this.sectionIsoOverlayTransition;
    if (!transition || style.sectionIsoEnabled !== true) return options;

    const sceneSectionStyle = this.lastSceneSectionStyle;
    const targetSectionActive =
      !!sceneSectionStyle &&
      sceneSectionStyle.sceneSectionEnabled === true &&
      this.sceneSectionActivePlanes(sceneSectionStyle).length > 0;

    if (!targetSectionActive) return options;

    return {
      ...(options ?? {}),
      initialTransitionOpacity:
        options?.initialTransitionOpacity ?? transition.targetOpacity,
    };
  }

  // Once a Section ISO transition has registered a populated target root,
  // further rebuilds during the tween (mid-tween reapplies, the commit-time
  // full section apply) duplicate the root or swap contour geometry at full
  // opacity — the measured post-transition "iso pop". Hold those rebuilds;
  // only the delayed height-sampler retry may pass with an explicit bypass
  // because it must replace untrimmed contours (it clears first and attaches
  // at the current transition envelope).
  private sectionIsoOverlayUpdateHeldByTransition(
    kind: SectionIsoOverlayTransitionRootKind,
    options?: SectionIsoOverlayUpdateOptions,
  ): boolean {
    if (options?.bypassTransitionHold === true) return false;
    const transition = this.sectionIsoOverlayTransition;
    if (!transition) return false;
    return transition.targetRoots.some(
      (root) => root.kind === kind && root.group.children.length > 0,
    );
  }

  updateMtVolumeCutIsoOverlays(
    style: EditableStyle,
    options?: SectionIsoOverlayUpdateOptions,
  ): void {
    if (this.sectionIsoOverlayUpdateHeldByTransition("mt-volume", options)) {
      return;
    }
    const tween = this.sceneSectionStyleTween;
    const sectionIsoMoveFollowSourceStyle =
      style.sectionIsoEnabled !== true
        ? tween?.sectionIsoMoveFollowSourceStyles?.get(
            UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
          )
        : undefined;
    if (sectionIsoMoveFollowSourceStyle && tween) {
      const progress = this.transitionTweenEasedProgress(
        tween,
        performance.now(),
      );
      if (progress < 1) {
        return updateMtVolumeCutIsoOverlaysImpl.call(
          this,
          sectionIsoMoveFollowSourceStyle,
          {
            ...(options ?? {}),
            bypassTransitionHold: true,
            initialTransitionOpacity: 1 - progress,
          },
        );
      }
    }
    return updateMtVolumeCutIsoOverlaysImpl.call(
      this,
      style,
      this.transitionAwareSectionIsoOverlayUpdateOptions(style, options),
    );
  }

  // DEC-168/DEC-171: transition-frame Section ISO roots stay attached to the
  // interpolated cut. The contour rebuild is throttled; rebuilding every frame
  // is too expensive, but leaving roots at the source cut makes them snap at
  // commit or after a later UI style apply.
  private lastSectionIsoMoveFollowMs = 0;
  applyMtVolumeCutIsoFollowForTransitionFrame(): void {
    const now = performance.now();
    if (
      now - this.lastSectionIsoMoveFollowMs <
      SECTION_ISO_MOVE_FOLLOW_INTERVAL_MS
    ) {
      return;
    }
    this.lastSectionIsoMoveFollowMs = now;
    const tween = this.sceneSectionStyleTween;
    const sectionIsoMoveFollowSourceStyle =
      tween?.sectionIsoMoveFollowSourceStyles?.get(
        UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
      );
    const sectionIsoMoveFollowOpacity =
      sectionIsoMoveFollowSourceStyle && tween
        ? 1 - this.transitionTweenEasedProgress(tween, now)
        : undefined;
    const sectionIsoTransitionOpacity =
      sectionIsoMoveFollowOpacity ??
      this.currentSectionIsoOverlayTransitionOpacity();
    if (
      sectionIsoMoveFollowSourceStyle &&
      sectionIsoMoveFollowOpacity !== undefined
    ) {
      this.updateMtVolumeCutIsoOverlays(sectionIsoMoveFollowSourceStyle, {
        bypassTransitionHold: true,
        initialTransitionOpacity: sectionIsoMoveFollowOpacity,
      });
      return;
    }
    const volStyle =
      this.styleForLayer(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID);
    if (volStyle.sectionIsoEnabled === true) {
      this.updateMtVolumeCutIsoOverlays(volStyle, {
        bypassTransitionHold: true,
        initialTransitionOpacity: sectionIsoTransitionOpacity,
      });
    }
  }

  applyMtVolumeCutIsoFollowForMoveTween(): void {
    this.applyMtVolumeCutIsoFollowForTransitionFrame();
  }

  seismicVolumeIsoOverlayGroup(seismicLayer: THREE.Group): THREE.Group {
    return seismicVolumeIsoOverlayGroupImpl.call(this, seismicLayer);
  }

  seismicResistivityIsoOverlayGroup(seismicLayer: THREE.Group): THREE.Group {
    return seismicResistivityIsoOverlayGroupImpl.call(this, seismicLayer);
  }

  clearSeismicVolumeCutIsoOverlays(seismicLayer?: THREE.Group): void {
    return clearSeismicVolumeCutIsoOverlaysImpl.call(this, seismicLayer);
  }

  clearSeismicResistivityIsoOverlays(seismicLayer?: THREE.Group): void {
    return clearSeismicResistivityIsoOverlaysImpl.call(this, seismicLayer);
  }

  buildSeismicVolumeCutMesh(mesh: THREE.Mesh, plane: ResolvedSceneSectionPlane, options: {
      amplitudeMin: number;
      amplitudeMax: number;
      amplitudeGamma: number;
      removeBackground: boolean;
      backgroundCutoff: number;
      targetKey: string;
      sectionFrame?: ResolvedSceneSectionFrame | null;
    }): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
    hardMaskValues: Float32Array;
  } | null {
    return buildSeismicVolumeCutMeshImpl.call(this, mesh, plane, options);
  }

  updateSeismicVolumeCutIsoOverlays(
    style: EditableStyle,
    options?: SectionIsoOverlayUpdateOptions,
  ): void {
    if (
      this.sectionIsoOverlayUpdateHeldByTransition("seismic-volume", options)
    ) {
      return;
    }
    return updateSeismicVolumeCutIsoOverlaysImpl.call(
      this,
      style,
      this.transitionAwareSectionIsoOverlayUpdateOptions(style, options),
    );
  }

  updateSeismicResistivityIsoOverlays(
    style: EditableStyle,
    options?: SectionIsoOverlayUpdateOptions,
  ): void {
    if (
      this.sectionIsoOverlayUpdateHeldByTransition(
        "seismic-resistivity",
        options,
      )
    ) {
      return;
    }
    return updateSeismicResistivityIsoOverlaysImpl.call(
      this,
      style,
      this.transitionAwareSectionIsoOverlayUpdateOptions(style, options),
    );
  }

  mtSurfaceBoundaryDefinitionsFromGroup(
    group: THREE.Group,
  ): MtSurfaceBoundaryDefinition[] {
    const byId = new Map<string, MtSurfaceBoundaryDefinition>();
    const addSurface = (
      surface:
        | {
            id?: unknown;
            label?: unknown;
            color?: unknown;
            comparison?: unknown;
            thresholdOhmM?: unknown;
            thresholdLog10?: unknown;
            kind?: unknown;
          }
        | undefined,
      fallbackId?: unknown,
    ) => {
      const id =
        typeof surface?.id === "string"
          ? surface.id
          : typeof fallbackId === "string"
            ? fallbackId
            : "";
      if (!id || byId.has(id)) return;
      const thresholdOhmM =
        typeof surface?.thresholdOhmM === "number" &&
        Number.isFinite(surface.thresholdOhmM)
          ? surface.thresholdOhmM
          : undefined;
      const thresholdLog10 =
        typeof surface?.thresholdLog10 === "number" &&
        Number.isFinite(surface.thresholdLog10)
          ? surface.thresholdLog10
          : thresholdOhmM && thresholdOhmM > 0
            ? Math.log10(thresholdOhmM)
            : undefined;
      const fallback = DEFAULT_MT_SURFACE_BOUNDARIES.find(
        (boundary) => boundary.id === id,
      );
      if (
        thresholdOhmM === undefined &&
        thresholdLog10 === undefined &&
        !fallback
      ) {
        return;
      }
      const comparison =
        surface?.comparison === ">=" || surface?.comparison === "<="
          ? surface.comparison
          : id.includes("-ge-")
            ? ">="
            : "<=";
      const resolvedOhmM =
        thresholdOhmM ??
        (thresholdLog10 !== undefined ? 10 ** thresholdLog10 : fallback!.thresholdOhmM);
      byId.set(id, {
        id,
        label:
          typeof surface?.label === "string"
            ? surface.label
            : fallback?.label ?? id,
        color:
          typeof surface?.color === "string"
            ? surface.color
            : fallback?.color ?? "#f8f4e8",
        comparison,
        thresholdOhmM: resolvedOhmM,
        thresholdLog10:
          thresholdLog10 ??
          (resolvedOhmM > 0 ? Math.log10(resolvedOhmM) : fallback!.thresholdLog10),
        kind: typeof surface?.kind === "string" ? surface.kind : undefined,
        source: "precomputed",
      });
    };
    // Lazy boundaries: full surface descriptors are stashed on the group by the
    // loader so every definition exists before any geometry is fetched.
    const stashed = group.userData?.mtThresholdSurfaceDefinitions;
    if (Array.isArray(stashed)) {
      for (const surface of stashed) addSurface(surface);
    }
    // Loaded/live surfaces also carry their descriptor on the mesh userData.
    group.traverse((obj) => {
      if (obj.userData?.mtThresholdSurfacePreview !== true) return;
      addSurface(
        obj.userData.mtThresholdSurface as Parameters<typeof addSurface>[0],
        obj.userData.mtThresholdSurfaceId,
      );
    });
    for (const boundary of DEFAULT_MT_SURFACE_BOUNDARIES) {
      if (!byId.has(boundary.id)) byId.set(boundary.id, boundary);
    }
    return [...byId.values()];
  }

  private mtVolumeProductIdForIsosurfaceProduct(_productId: string): string {
    // Single uncropped product (DEC-180): the focused volume was retired.
    return "mt-resistivity-full-extent-volume";
  }

  private activeMtScalarVolumeForIsosurface(productId: string): THREE.Mesh | null {
    const volumeGroup = this.layers.get(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID);
    if (!volumeGroup) return null;
    const sourceProductId = this.mtVolumeProductIdForIsosurfaceProduct(productId);
    let mesh: THREE.Mesh | null = null;
    volumeGroup.traverse((obj) => {
      if (
        mesh === null &&
        obj instanceof THREE.Mesh &&
        obj.userData?.scalarVolume === true &&
        obj.userData.scalarVolumeProductId === sourceProductId
      ) {
        mesh = obj;
      }
    });
    return mesh;
  }

  private clearLiveMtSurfaceBoundaries(group: THREE.Group): void {
    const removals = group.children.filter(
      (child) => child.userData?.mtSurfaceBoundaryLive === true,
    );
    for (const child of removals) {
      group.remove(child);
      disposeObjectTree(child);
    }
  }

  ensureLiveMtSurfaceBoundaries(
    group: THREE.Group,
    selectedProductId: string,
    boundaries: ResolvedMtSurfaceBoundary[],
    style: EditableStyle,
  ): void {
    if (style.mtSurfaceBoundaryMode !== "live-compute") {
      this.clearLiveMtSurfaceBoundaries(group);
      return;
    }
    const liveBoundaries = boundaries.filter(
      (boundary) => boundary.source === "live" && boundary.visible,
    );
    if (liveBoundaries.length === 0) {
      this.clearLiveMtSurfaceBoundaries(group);
      return;
    }
    const volumeMesh = this.activeMtScalarVolumeForIsosurface(selectedProductId);
    const volumeData = volumeMesh?.userData.scalarVolumeData as
      | Uint8Array
      | undefined;
    const maskData = volumeMesh?.userData.scalarVolumeMaskData as
      | Uint8Array
      | undefined;
    const dimensions = volumeMesh?.userData.scalarVolumeDimensions as
      | [number, number, number]
      | undefined;
    const bounds = volumeMesh?.userData.scalarVolumeBounds as
      | { min?: [number, number, number]; max?: [number, number, number] }
      | undefined;
    const sourceRange = volumeMesh?.userData.scalarVolumeSourceRange as
      | [number, number]
      | undefined;
    if (!volumeData || !maskData || !dimensions || !bounds?.min || !bounds?.max || !sourceRange) {
      this.clearLiveMtSurfaceBoundaries(group);
      return;
    }
    const wantedIds = new Set(liveBoundaries.map((boundary) => boundary.id));
    let createdLiveBoundary = false;
    for (const child of [...group.children]) {
      if (
        child.userData?.mtSurfaceBoundaryLive === true &&
        !wantedIds.has(String(child.userData.mtThresholdSurfaceId ?? ""))
      ) {
        group.remove(child);
        disposeObjectTree(child);
      }
    }
    for (const boundary of liveBoundaries) {
      const cacheKey = `${selectedProductId}:${boundary.id}:${boundary.comparison}:${boundary.thresholdLog10.toFixed(5)}`;
      const existing = group.children.find(
        (child) =>
          child.userData?.mtSurfaceBoundaryLive === true &&
          child.userData?.mtThresholdSurfaceId === boundary.id &&
          child.userData?.mtSurfaceBoundaryLiveCacheKey === cacheKey,
      );
      if (existing) continue;
      for (const child of [...group.children]) {
        if (
          child.userData?.mtSurfaceBoundaryLive === true &&
          child.userData?.mtThresholdSurfaceId === boundary.id
        ) {
          group.remove(child);
          disposeObjectTree(child);
        }
      }
      const geometry = extractRuntimeMarchingCubesGeometry({
        volume: volumeData,
        mask: maskData,
        dimensions,
        bounds: { min: bounds.min, max: bounds.max },
        sourceRange,
        thresholdLog10: boundary.thresholdLog10,
        comparison: boundary.comparison,
      });
      if (!geometry) continue;
      // Salvage (CODEX_003): build live threshold surfaces through the shared
      // surface render-policy material so transition snapshots and working-area
      // focus rehydration treat runtime-generated surfaces identically to
      // loaded ones. Opacity routes through the masked-policy helper instead of
      // a raw material.opacity write.
      const material = createMtThresholdSurfaceMaterial();
      material.color.set(boundary.color);
      // Salvage correction: createMtThresholdSurfaceMaterial enables
      // vertexColors for the loaded mesh-preview path, but live marching-cubes
      // geometry (extractRuntimeMarchingCubesGeometry) is position-only. Leaving
      // vertexColors on would multiply the diffuse by an unbound vColor and drop
      // the boundary color. Drive color from material.color instead.
      material.vertexColors = false;
      material.userData.preserveVertexColors = false;
      material.roughness = styleNumber(
        style,
        "mtThresholdSurfaceRoughness",
        0.64,
        0,
        1,
      );
      material.metalness = styleNumber(
        style,
        "mtThresholdSurfaceMetalness",
        0,
        0,
        1,
      );
      material.side =
        style.mtThresholdSurfaceSide === "front"
          ? THREE.FrontSide
          : THREE.DoubleSide;
      material.emissiveIntensity = styleNumber(
        style,
        "mtThresholdSurfaceEmissiveBoost",
        0.08,
        0,
        1,
      );
      applyMtThresholdSurfaceMaterialOpacity(
        material,
        styleNumber(style, "opacity", 0.86, 0, 1) * boundary.opacity,
        false,
        true,
      );
      material.userData.mtThresholdSurfaceMasterOpacity = styleNumber(
        style,
        "opacity",
        0.86,
        0,
        1,
      );
      material.userData.mtThresholdSurfaceBoundaryOpacity = boundary.opacity;
      material.userData.mtThresholdSurfaceWireframe = false;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = boundary.label;
      mesh.renderOrder = SURFACE_RENDER_ORDER.meshPreview + 0.01;
      mesh.userData = {
        mtThresholdSurfacePreview: true,
        mtSurfaceBoundaryLive: true,
        mtSurfaceBoundaryLiveCacheKey: cacheKey,
        mtThresholdSurfaceId: boundary.id,
        mtThresholdSurfaceKind: "live-threshold-surface",
        mtIsosurfaceProductId: selectedProductId,
        mtThresholdSurface: boundary,
      };
      group.add(mesh);
      createdLiveBoundary = true;
    }
    if (createdLiveBoundary) {
      // Newly attached live surfaces must be patched by working-area focus
      // before they can render during a transition (DEC-173 rehydration).
      this.reapplyWorkingAreaFocus();
    }
  }

  // Lazy precomputed boundaries (DEC-180): the single uncropped product carries
  // 23 source-derived surfaces at full fineness, far too large to load at once.
  // Each boundaries/<product>/<id>.json is a self-contained single-surface
  // payload; fetch only visible surfaces on demand.
  private mtThresholdLayerIsLazy(layerId: string): boolean {
    return (
      layerId === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID &&
      this.layers.get(layerId)?.userData?.mtThresholdSurfaceLazy === true
    );
  }

  private mtThresholdBoundaryMeshPresent(
    group: THREE.Group,
    productId: string,
    boundaryId: string,
  ): boolean {
    return group.children.some(
      (child) =>
        child.userData?.mtThresholdSurfacePreview === true &&
        child.userData?.mtSurfaceBoundaryLive !== true &&
        child.userData?.mtThresholdSurfaceId === boundaryId &&
        child.userData?.mtIsosurfaceProductId === productId,
    );
  }

  private mtThresholdSelectedProductId(style: EditableStyle): string {
    return typeof style.mtIsosurfaceProductId === "string"
      ? style.mtIsosurfaceProductId
      : "mt-isosurface-full-extent";
  }

  private mtThresholdVisiblePrecomputedBoundaries(
    group: THREE.Group,
    style: EditableStyle,
  ): ResolvedMtSurfaceBoundary[] {
    return resolveMtSurfaceBoundaries(
      style,
      this.mtSurfaceBoundaryDefinitionsFromGroup(group),
    ).filter((boundary) => boundary.visible && boundary.source !== "live");
  }

  // Geometry readiness for the lazy threshold layer: true only when every
  // visible precomputed boundary mesh for the selected product is attached.
  // The transition engine consults this so the layer stays "loading" until the
  // actual surfaces arrive, instead of treating group existence as ready.
  mtThresholdLayerGeometryReady(layerId: string, style: EditableStyle): boolean {
    const group = this.layers.get(layerId);
    if (!group) return false;
    if (group.userData?.mtThresholdSurfaceRegistry === undefined) return true;
    const productId = this.mtThresholdSelectedProductId(style);
    const boundaries = this.mtThresholdVisiblePrecomputedBoundaries(group, style);
    if (boundaries.length === 0) return true;
    return boundaries.every((boundary) =>
      this.mtThresholdBoundaryMeshPresent(group, productId, boundary.id),
    );
  }

  // Kick off lazy fetches for the target style's visible boundaries without
  // styling them, so geometry becomes ready during a transition. Idempotent.
  prefetchMtThresholdTargetBoundaries(layerId: string, style: EditableStyle): void {
    const group = this.layers.get(layerId);
    if (!group) return;
    this.ensurePrecomputedMtSurfaceBoundaries(
      group,
      layerId,
      this.mtThresholdSelectedProductId(style),
      this.mtThresholdVisiblePrecomputedBoundaries(group, style),
      style,
    );
  }

  ensurePrecomputedMtSurfaceBoundaries(
    group: THREE.Group,
    layerId: string,
    selectedProductId: string,
    boundaries: ResolvedMtSurfaceBoundary[],
    style: EditableStyle,
  ): void {
    const registry = group.userData?.mtThresholdSurfaceRegistry as
      | Record<string, { assetUrl: string; isoProductId: string; id: string }>
      | undefined;
    if (!registry) return;
    // Hidden boundary meshes are intentionally NOT evicted here. Once loaded a
    // boundary mesh stays attached and visibility is a pure obj.visible toggle,
    // so a boundary hidden on one page reappears on another with no async
    // reload. An earlier lazy-unload (evict-on-hide) made a boundary "stay off"
    // after navigation because the target-page reload raced the transition
    // commit. Bounded set (~tens of boundaries), so retaining them is cheap.
    const inFlight: Set<string> =
      group.userData.__mtPrecomputedInFlight instanceof Set
        ? group.userData.__mtPrecomputedInFlight
        : (group.userData.__mtPrecomputedInFlight = new Set<string>());
    for (const boundary of boundaries) {
      if (!boundary.visible || boundary.source === "live") continue;
      const meshId = `${selectedProductId}:${boundary.id}`;
      const entry = registry[meshId];
      if (!entry) continue;
      if (
        this.mtThresholdBoundaryMeshPresent(group, selectedProductId, boundary.id) ||
        inFlight.has(meshId)
      ) {
        continue;
      }
      inFlight.add(meshId);
      loadMeshPreview(entry.assetUrl)
        .then((loaded) => {
          if (this.layers.get(layerId) !== group) return;
          // During an active transition, attach hidden; the readiness/attach
          // path enters the surface on the transition clock (spec: no late
          // full-opacity pop). Otherwise the completion reapply styles it.
          const duringTransition = this.activeSceneTransitionContext !== null;
          for (const child of [...loaded.children]) {
            if (child.userData?.mtThresholdSurfacePreview === true) {
              child.userData.mtSurfaceBoundaryPrecomputedLazy = true;
              if (duringTransition) child.visible = false;
              loaded.remove(child);
              group.add(child);
            }
          }
          disposeObjectTree(loaded);
        })
        .catch((error) =>
          console.error(
            `MT precomputed boundary load failed (${meshId}):`,
            error,
          ),
        )
        .finally(() => {
          inFlight.delete(meshId);
          if (this.layers.get(layerId) !== group) return;
          // Never full-restyle during a transition: that would own opacity and
          // break final-commit idempotency. The per-frame readiness/attach path
          // (attachReadyTargetLayersDuringActiveTransition) styles and fades the
          // surface in on the transition clock instead.
          if (this.activeSceneTransitionContext !== null) return;
          this.applyMtThresholdSurfaceStyle(layerId, style);
          this.reapplyWorkingAreaFocus();
        });
    }
  }

  applyMtThresholdSurfaceStyle(id: string, style: EditableStyle): void {
    return applyMtThresholdSurfaceStyleImpl.call(this, id, style);
  }

  private seismicBrowserRoot(group: THREE.Group): THREE.Object3D | null {
    if (group.userData?.seismicBrowser === true) return group;
    let root: THREE.Object3D | null = null;
    group.traverse((obj) => {
      if (!root && obj.userData?.seismicBrowser === true) root = obj;
    });
    return root;
  }

  // Execution layer (TRD-013): seismic graph root for the per-entity transition
  // executor, or null when the seismic layer is absent.
  seismicGraphTransitionRoot(): THREE.Object3D | null {
    const group = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!group) return null;
    return this.seismicBrowserRoot(group);
  }

  tickSeismicGraphTransition(nowMs: number): void {
    tickSeismicGraphTransitionImpl.call(this, nowMs);
  }

  seismicBrowserRuntimeIndex(group: THREE.Group): {
    root: THREE.Object3D;
    productSummaries: Array<{
      id: string;
      surveyKind?: string;
      productKind?: string;
      domainKind?: string;
      amplitudeStats?: Record<string, unknown>;
      raymarchCapable: boolean;
    }>;
    sectionsByProduct: Map<string, THREE.Object3D[]>;
    volumesByProduct: Map<string, THREE.Object3D[]>;
    navigationObjects: THREE.Object3D[];
  } | null {
    const root = this.seismicBrowserRoot(group);
    if (!root) return null;
    const cached = group.userData.seismicRuntimeIndex as
      | ReturnType<SceneManager["seismicBrowserRuntimeIndex"]>
      | undefined;
    if (cached && cached.root === root) return cached;

    const rawSummaries = Array.isArray(root.userData.seismicProducts)
      ? (root.userData.seismicProducts as Array<{
          id?: unknown;
          surveyKind?: unknown;
          productKind?: unknown;
          domainKind?: unknown;
          amplitudeStats?: unknown;
          raymarchCapable?: unknown;
        }>)
      : Array.isArray(group.userData.seismicProducts)
        ? (group.userData.seismicProducts as Array<{
            id?: unknown;
            surveyKind?: unknown;
            productKind?: unknown;
            domainKind?: unknown;
            amplitudeStats?: unknown;
            raymarchCapable?: unknown;
          }>)
        : [];
    const summaryMap = new Map<
      string,
      {
        id: string;
        surveyKind?: string;
        productKind?: string;
        domainKind?: string;
        amplitudeStats?: Record<string, unknown>;
        raymarchCapable: boolean;
      }
    >();
    for (const summary of rawSummaries) {
      if (typeof summary.id !== "string" || summary.id.length === 0) continue;
      summaryMap.set(summary.id, {
        id: summary.id,
        surveyKind:
          typeof summary.surveyKind === "string"
            ? summary.surveyKind
            : undefined,
        productKind:
          typeof summary.productKind === "string"
            ? summary.productKind
            : undefined,
        domainKind:
          typeof summary.domainKind === "string"
            ? summary.domainKind
            : undefined,
        amplitudeStats:
          summary.amplitudeStats &&
          typeof summary.amplitudeStats === "object" &&
          !Array.isArray(summary.amplitudeStats)
            ? (summary.amplitudeStats as Record<string, unknown>)
            : undefined,
        raymarchCapable: summary.raymarchCapable === true,
      });
    }

    const sectionsByProduct = new Map<string, THREE.Object3D[]>();
    const volumesByProduct = new Map<string, THREE.Object3D[]>();
    const navigationObjects: THREE.Object3D[] = [];
    const navigationObjectsByRole = new Map<string, THREE.Object3D[]>();
    root.traverse((obj) => {
      if (obj.userData?.seismicNavigation === true) {
        navigationObjects.push(obj);
        const role =
          typeof obj.userData.seismicNavigationRole === "string"
            ? obj.userData.seismicNavigationRole
            : "all";
        const roleObjects = navigationObjectsByRole.get(role) ?? [];
        roleObjects.push(obj);
        navigationObjectsByRole.set(role, roleObjects);
      }
      const productId =
        typeof obj.userData?.seismicProductId === "string"
          ? obj.userData.seismicProductId
          : "";
      if (!productId) return;
      if (!summaryMap.has(productId)) {
        summaryMap.set(productId, {
          id: productId,
          surveyKind:
            typeof obj.userData.seismicProductSurveyKind === "string"
              ? obj.userData.seismicProductSurveyKind
              : undefined,
          productKind:
            typeof obj.userData.seismicProductKind === "string"
              ? obj.userData.seismicProductKind
              : undefined,
          domainKind:
            typeof obj.userData.seismicProductDomainKind === "string"
              ? obj.userData.seismicProductDomainKind
              : undefined,
          amplitudeStats:
            obj.userData.seismicProductValueStats &&
            typeof obj.userData.seismicProductValueStats === "object" &&
            !Array.isArray(obj.userData.seismicProductValueStats)
              ? (obj.userData.seismicProductValueStats as Record<
                  string,
                  unknown
                >)
              : undefined,
          raymarchCapable: obj.userData?.seismicRaymarchVolume === true,
        });
      } else if (obj.userData?.seismicRaymarchVolume === true) {
        summaryMap.get(productId)!.raymarchCapable = true;
      }
      if (obj.userData?.seismicSection === true) {
        const sections = sectionsByProduct.get(productId) ?? [];
        sections.push(obj);
        sectionsByProduct.set(productId, sections);
      }
      if (obj.userData?.seismicRaymarchVolume === true) {
        const volumes = volumesByProduct.get(productId) ?? [];
        volumes.push(obj);
        volumesByProduct.set(productId, volumes);
      }
    });

    const index = {
      root,
      productSummaries: Array.from(summaryMap.values()),
      sectionsByProduct,
      volumesByProduct,
      navigationObjects,
      navigationObjectsByRole,
    };
    group.userData.seismicRuntimeIndex = index;
    return index;
  }

  private updateSeismicTransientLodState(
    camera: THREE.Camera,
    nowMs: number,
  ): void {
    const cameraMoved =
      this.seismicCameraLodPosition !== null &&
      this.seismicCameraLodPosition.distanceTo(camera.position) > 10;
    if (cameraMoved) {
      this.seismicCameraMovingUntilMs = nowMs + 750;
    }
    if (this.seismicCameraLodPosition) {
      this.seismicCameraLodPosition.copy(camera.position);
    } else {
      this.seismicCameraLodPosition = camera.position.clone();
    }

    const seismicTransitionActive = this.activeSceneTransitionContext !== null;
    const seismicCameraMoving = nowMs < this.seismicCameraMovingUntilMs;
    // While the capture fidelity lock is active, hold the source tier (incl.
    // volume) and ignore the transient coarse/standard downgrade so outputs are
    // never rendered from a browser/coarse seismic tier.
    const requestedTier: "coarse" | "standard" | "source" = this
      .captureFidelityActive
      ? "source"
      : seismicTransitionActive || seismicCameraMoving
        ? "coarse"
        : "standard";
    const seismicTransientLodReason = this.captureFidelityActive
      ? "capture-source"
      : seismicTransitionActive
        ? "page-transition"
        : seismicCameraMoving
          ? "camera-moving"
          : "settled";

    for (const group of this.layers.values()) {
      const root = this.seismicBrowserRoot(group);
      if (!root) continue;
      root.userData.seismicTransitionActive = seismicTransitionActive;
      root.userData.seismicCameraMoving = seismicCameraMoving;
      root.userData.seismicCameraMovingUntilMs = this.seismicCameraMovingUntilMs;
      root.userData.seismicTransientLodReason = seismicTransientLodReason;
      if (group.visible !== true) {
        root.userData.seismicFrameRequestedLodTier = null;
        root.userData.seismicFrameRequestedProductKey = "";
        continue;
      }

      const productIds = this.seismicVisibleProductIdsForRoot(root);
      if (productIds.length === 0) continue;
      const productKey = productIds.slice().sort().join("\0");
      if (
        root.userData.seismicFrameRequestedLodTier === requestedTier &&
        root.userData.seismicFrameRequestedProductKey === productKey
      ) {
        continue;
      }
      root.userData.seismicFrameRequestedLodTier = requestedTier;
      root.userData.seismicFrameRequestedProductKey = productKey;
      const ensureProductsLoaded = root.userData.seismicEnsureProductsLoaded as
        | ((
            productIds: string[],
            tier: "coarse" | "standard" | "source",
            options?: { includeVolume?: boolean },
          ) => Promise<void>)
        | undefined;
      ensureProductsLoaded?.(
        productIds,
        requestedTier,
        this.captureFidelityActive ? { includeVolume: true } : undefined,
      ).catch((error: unknown) => {
        console.warn("[seismic] transient LOD request failed", error);
      });
    }
  }

  applySeismicBrowserStyle(id: string, style: EditableStyle): void {
    applySeismicBrowserStyleToLayer.call(this, id, style);
  }

  applyContourDisplayStyle(id: string, style: EditableStyle): void {
    if (id !== SHAHBAZI_GROUND_CONTOUR_LAYER_ID && !isContourLikeLayerId(id)) {
      return;
    }

    const group = this.layers.get(id);
    if (!group) return;

    const near = styleNumber(
      style,
      "contourDistanceFadeNearM",
      DEFAULT_CONTOUR_DISTANCE_FADE_NEAR_M,
      5,
      2000,
    );
    const rawFar = styleNumber(
      style,
      "contourDistanceFadeFarM",
      DEFAULT_CONTOUR_DISTANCE_FADE_FAR_M,
      10,
      5000,
    );
    const far = Math.max(rawFar, near + 5);
    const minScale = styleNumber(
      style,
      "contourFarLineScale",
      DEFAULT_CONTOUR_FAR_LINE_SCALE,
      0.03,
      1,
    );
    const minAlpha = styleNumber(
      style,
      "contourFarOpacity",
      DEFAULT_CONTOUR_FAR_OPACITY,
      0.05,
      1,
    );
    const lift = styleNumber(
      style,
      "contourLiftM",
      DEFAULT_CONTOUR_LIFT_M,
      -0.25,
      8,
    );
    const lineColor =
      typeof style.contourPresetColor === "string"
        ? style.contourPresetColor
        : typeof style.color === "string"
          ? style.color
          : null;
    const lineOpacity =
      typeof style.contourPresetOpacity === "number"
        ? clamp01(style.contourPresetOpacity)
        : typeof style.opacity === "number"
          ? clamp01(style.opacity)
          : null;
    const lineWidth =
      typeof style.contourPresetLineWidth === "number"
        ? style.contourPresetLineWidth
        : typeof style.lineWidth === "number"
          ? style.lineWidth
          : null;

    group.traverse((obj) => {
      if (obj.userData?.contourLine === true) {
        obj.position.z = lift;
      }
      const mat = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        if (!(m instanceof LineMaterial)) continue;
        const preserveLineColor =
          m.userData?.preserveMaterialColor === true ||
          obj.userData?.naipTileDiagnosticOutline === true ||
          obj.userData?.naipTileDiagnosticLabel === true;
        if (lineColor && !preserveLineColor) m.color.set(lineColor);
        if (lineOpacity !== null) {
          m.opacity = lineOpacity;
          m.transparent = lineOpacity < 1;
        }
        if (lineWidth !== null) {
          const worldLineWidthScale =
            typeof m.userData?.worldLineWidthScale === "number"
              ? m.userData.worldLineWidthScale
              : 1;
          const minLineWidth =
            typeof m.userData?.worldLineWidthMin === "number"
              ? m.userData.worldLineWidthMin
              : 0.5;
          const maxLineWidth =
            typeof m.userData?.worldLineWidthMax === "number"
              ? m.userData.worldLineWidthMax
              : 12;
          m.linewidth = clampRange(
            lineWidth * worldLineWidthScale,
            minLineWidth,
            maxLineWidth,
          );
        }
        if (m.userData?.contourDistanceAttenuatedLineWidth === true) {
          setDistanceAttenuatedLineWidth(m, {
            near,
            far,
            minScale,
            minAlpha,
          });
        }
        m.dashed = false;
        m.depthTest = true;
        m.depthFunc = THREE.LessEqualDepth;
        m.depthWrite = false;
        m.polygonOffset = true;
        m.polygonOffsetFactor = -6;
        m.polygonOffsetUnits = -6;
        m.needsUpdate = true;
      }
    });
  }

  applyStyle(id: string, style: EditableStyle): void {
    applyStyleImpl.call(this, id, style);
    // The full-density MT cloud isolates to the iso-bands selected on the volume
    // layer's section config (the source of truth). applyStyle only re-styles the
    // one layer, so refresh the cloud when the volume changes — otherwise band
    // toggles authored on the volume never cross to the cloud.
    if (id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
      for (const cloudId of [
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
      ]) {
        if (this.layers.has(cloudId)) {
          applyStyleImpl.call(this, cloudId, this.styleForLayer(cloudId));
        }
      }
    }
  }

  applyEffectiveStylesForPage(
    environment: EnvironmentSetup,
    page: PresentationPage,
  ): void {
    // A full reapply may land while a Section ISO root crossfade is still
    // ramping (late async layer resolve, deferred editor reapply). Discarding
    // that ramp and rebuilding overlays at full opacity is the visible
    // "isolines pop in after the transition" regression, so capture the
    // in-flight envelope and resume the landing after the rebuild.
    const inFlightIsoEnvelope = this.sectionIsoOverlayTransition
      ? clamp01(this.sectionIsoOverlayTransition.targetOpacity)
      : null;
    this.layerTweens.clear();
    this.scalarStyleTweens.clear();
    this.visibilityToggleFades.clear();
    this.workingAreaFocusTween = null;
    this.sceneSectionStyleTween = null;
    this.sceneSectionHelperTransitionOpacity = 1;
    this.clearSectionIsoOverlayTransition();
    this.clearLayerTransitionSnapshots();
    this.activeSceneTransitionContext = null;
    this.lastEffectiveEnv = environment;
    this.lastEffectivePage = page;
    for (const id of this.layers.keys()) {
      this.applyStyle(id, effectiveStyle(environment, page, id));
    }
    this.applySceneSectionPlanes(
      effectiveStyle(environment, page, UTAH_FORGE_SCENE_SECTION_LAYER_ID),
    );
    this.applyWorkingAreaFocusStyle(
      effectiveStyle(environment, page, UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID),
    );
    this.applyLakesToTerrain(environment, page);
    if (inFlightIsoEnvelope !== null && inFlightIsoEnvelope < 0.98) {
      this.resumeSectionIsoOverlayLanding(inFlightIsoEnvelope);
    }
  }

  private resumeSectionIsoOverlayLanding(envelope: number): void {
    const groups = this.sectionIsoOverlayGroupsForTransition();
    if (groups.length === 0) return;
    const remainingMs = Math.max(160, (1 - envelope) * 420);
    this.sectionIsoOverlayTransition = {
      sourceRoots: [],
      targetRoots: [],
      startMs: performance.now() - remainingMs * envelope,
      durationMs: remainingMs,
      easing: "linear",
      targetOpacity: envelope,
    };
    for (const { kind, layerId, group } of groups) {
      this.registerSectionIsoOverlayTransitionTargetRoot(kind, layerId, group);
    }
  }

  applyEffectiveVisibilityForPage(
    environment: EnvironmentSetup,
    page: PresentationPage,
  ): void {
    this.layerTweens.clear();
    this.scalarStyleTweens.clear();
    this.visibilityToggleFades.clear();
    this.workingAreaFocusTween = null;
    this.sceneSectionStyleTween = null;
    this.sceneSectionHelperTransitionOpacity = 1;
    this.clearSectionIsoOverlayTransition();
    this.clearLayerTransitionSnapshots();
    this.activeSceneTransitionContext = null;
    this.lastEffectiveEnv = environment;
    this.lastEffectivePage = page;
    this.setVisible(effectiveVisibility(environment, page));
    this.applyWorkingAreaFocusStyle(
      effectiveStyle(environment, page, UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID),
    );
    this.applyLakesToTerrain(environment, page);
  }

  transitionEffectiveLayersForPage(
    fromEnvironment: EnvironmentSetup,
    toEnvironment: EnvironmentSetup,
    fromPage: PresentationPage,
    toPage: PresentationPage,
    durationMs: number = DEFAULT_LAYER_FADE_MS,
    easing: EasingName = "easeInOutCubic",
    scalarStyleDurationMs: number = durationMs,
    scalarStyleEasing: EasingName = easing,
    reason: NavigationReason = "programmatic",
    transitionId?: string,
    startMs?: number,
  ): void {
    return transitionEffectiveLayersForPageImpl.call(
      this,
      fromEnvironment,
      toEnvironment,
      fromPage,
      toPage,
      durationMs,
      easing,
      scalarStyleDurationMs,
      scalarStyleEasing,
      reason,
      transitionId,
      startMs,
    );
  }

  freezeCapturePageSourceTransitionPreview(
    nowMs: number = performance.now(),
  ): void {
    const pinDurationMs = 1_000_000_000_000;
    for (const [id, tween] of this.layerTweens) {
      const group = this.layers.get(id);
      const opacity = group
        ? this.currentRenderOpacityForTree(group, tween.to)
        : tween.to;
      tween.from = opacity;
      tween.to = opacity;
      tween.startMs = nowMs;
      tween.durationMs = pinDurationMs;
      tween.easing = "linear";
    }
    for (const snapshot of this.layerTransitionSnapshots.values()) {
      const opacity = this.currentRenderOpacityForTree(
        snapshot.group,
        snapshot.to,
      );
      snapshot.from = opacity;
      snapshot.to = opacity;
      snapshot.startMs = nowMs;
      snapshot.durationMs = pinDurationMs;
      snapshot.easing = "linear";
    }
    if (this.sceneSectionHelperTransitionSnapshot) {
      const snapshot = this.sceneSectionHelperTransitionSnapshot;
      const opacity = this.currentRenderOpacityForTree(
        snapshot.group,
        snapshot.to,
      );
      snapshot.from = opacity;
      snapshot.to = opacity;
      snapshot.startMs = nowMs;
      snapshot.durationMs = pinDurationMs;
      snapshot.easing = "linear";
    }
    if (this.sectionIsoOverlayTransition) {
      const opacity = clamp01(this.sectionIsoOverlayTransition.targetOpacity);
      this.sectionIsoOverlayTransition.startMs = nowMs - opacity * pinDurationMs;
      this.sectionIsoOverlayTransition.durationMs = pinDurationMs;
      this.sectionIsoOverlayTransition.easing = "linear";
      this.sectionIsoOverlayTransition.targetOpacity = opacity;
    }
    // Pin the environment-scene (background/fog) and cinematic-scene transitions
    // at the sampled progress instead of dropping them, so captured Page Bar page
    // transitions crossfade those channels with full page-navigation parity
    // (DEC-175). Mirrors the section-ISO pin above. These transitions share the
    // {startMs, durationMs, easing} timing shape and the same eased-progress
    // formula; only progress < 1 reaches here (settled transitions are already
    // nulled before the freeze).
    if (this.environmentSceneTransition) {
      const t = this.environmentSceneTransition;
      const raw = t.durationMs <= 0 ? 1 : (nowMs - t.startMs) / t.durationMs;
      const progress = raw >= 1 ? 1 : easeProgress(clamp01(raw), t.easing);
      t.startMs = nowMs - progress * pinDurationMs;
      t.durationMs = pinDurationMs;
      t.easing = "linear";
    }
    if (this.cinematicSceneTransition) {
      const t = this.cinematicSceneTransition;
      const raw = t.durationMs <= 0 ? 1 : (nowMs - t.startMs) / t.durationMs;
      const progress = raw >= 1 ? 1 : easeProgress(clamp01(raw), t.easing);
      t.startMs = nowMs - progress * pinDurationMs;
      t.durationMs = pinDurationMs;
      t.easing = "linear";
    }
    this.scalarStyleTweens.clear();
    this.visibilityToggleFades.clear();
    this.workingAreaFocusTween = null;
    this.sceneSectionStyleTween = null;
    this.sceneSectionHelperTransitionOpacity = 1;
    this.activeSceneTransitionContext = null;
  }

  /**
   * Release the capture page-source freeze pins.
   * `freezeCapturePageSourceTransitionPreview` pins the environment-scene and
   * cinematic-scene transitions to hold a mid-transition frame (DEC-175). When
   * the capture preview settles, stops, or the dock closes, those pins MUST be
   * nulled — otherwise `frameUpdate` keeps re-applying the stale mid-transition
   * background/fog/cinematic over the restored page. Called by the capture
   * page-source teardown paths in PageController.
   */
  clearCapturePageSourceFreeze(): void {
    this.environmentSceneTransition = null;
    this.cinematicSceneTransition = null;
    this.currentEnvironmentSceneTransitionFrame = null;
    this.lastCinematicSceneTransitionDebug =
      inactiveCinematicSceneTransitionDebugState();
  }

  /**
   * Special-case hook: hydrography-lakes, VRI forest cover, and the two target glow-fills
   * are rendered by the TERRAIN shader (rasterized polygon masks
   * recolor terrain pixels where the layer exists) rather than by
   * their own geometry. Push effective color + visibility into the
   * terrain handle's per-slot uniforms. The ring outlines for the
   * targets remain as Line2 polylines in the layer groups and follow
   * the standard applyStyle path.
   */
  applyLakesToTerrain(
    environment: EnvironmentSetup,
    page: PresentationPage,
    opacityOverrides: ReadonlyMap<string, number> = new Map(),
  ): void {
    return applyLakesToTerrainImpl.call(this, environment, page, opacityOverrides);
  }

  /** Stash the geology handle for per-page apply paths + editor reads. */
  registerGeology(handle: GeologyHandle): void {
    this.geologyHandle = handle;
    // Re-apply if we have a cached env/page so the loader's first
    // rebuild reflects authored overrides.
    if (
      !this.activeSceneTransitionContext &&
      this.lastEffectiveEnv &&
      this.lastEffectivePage
    ) {
      this.recordLateReapplyDebugEvent(
        "geology-register",
        "full-current-page-state",
      );
      this.applyEffectiveStylesForPage(
        this.lastEffectiveEnv,
        this.lastEffectivePage,
      );
    }
  }

  /** Editor read accessor for the sub-layer panel. */
  getGeology(): GeologyHandle | null {
    return this.geologyHandle;
  }

  /**
   * Per-page mood: cinematicExposure multiplies env exposure, bloomBoost
   * multiplies env bloom strength. sunLockToCamera optionally forces the
   * camera-follow sun mode on/off for the page.
   */
  applyPageScene(page: PresentationPage): void {
    this.lastEffectivePage = page;
    if (this.lastEnv) {
      const nextPresetId = activeRenderPresetIdForPage(this.lastEnv, page);
      if ((nextPresetId ?? null) !== this.lastAppliedRenderPresetId) {
        this.applyEnvironment(this.lastEnv);
      }
    }
    const expMul = page.cinematicExposure ?? 1.0;
    this.renderer.toneMappingExposure = this.baseExposure * expMul;

    if (this.postHandle) {
      const bloomMul = page.bloomBoost ?? 1.0;
      this.postHandle.bloomPass.strength =
        this.postHandle.baseBloomStrength * bloomMul;
    }

    this.setEffectiveSunLockToCamera(
      page.sunLockToCamera ?? this.baseSunLockToCamera,
    );
  }

  beginCinematicSceneTransition(
    fromEnvironment: EnvironmentSetup,
    toEnvironment: EnvironmentSetup,
    fromPage: PresentationPage,
    toPage: PresentationPage,
    durationMs: number,
    easing: EasingName,
    startMs: number = performance.now(),
  ): void {
    this.cinematicSceneTransition = createCinematicSceneTransition(
      fromEnvironment,
      toEnvironment,
      fromPage,
      toPage,
      durationMs,
      easing,
      startMs,
    );
    this.updateCinematicPostFrame(startMs);
  }

  beginEnvironmentSceneTransition(
    fromEnvironment: EnvironmentSetup,
    toEnvironment: EnvironmentSetup,
    fromPage: PresentationPage,
    toPage: PresentationPage,
    durationMs: number,
    easing: EasingName,
    startMs: number = performance.now(),
  ): void {
    this.environmentSceneTransition = createEnvironmentSceneTransition({
      sourcePageId: fromPage.id,
      targetPageId: toPage.id,
      sourceScene: resolveCinematicSceneForTransition(fromEnvironment, fromPage),
      targetScene: resolveCinematicSceneForTransition(toEnvironment, toPage),
      durationMs,
      easing,
      startMs,
    });
    this.updateEnvironmentSceneTransitionFrame(startMs);
  }

  private updateEnvironmentSceneTransitionFrame(nowMs: number): void {
    const transition = this.environmentSceneTransition;
    if (!transition) {
      this.currentEnvironmentSceneTransitionFrame = null;
      return;
    }

    const frame = blendEnvironmentSceneTransitionFrame(transition, nowMs);
    this.applyEnvironmentSceneTransitionFrame(frame);
    this.currentEnvironmentSceneTransitionFrame = frame;
    if (frame.done) {
      this.environmentSceneTransition = null;
    }
  }

  private layerFogDensityForFrame(
    style: EditableStyle,
    fallback: number,
  ): number {
    return typeof style.fogDensity === "number" &&
      Number.isFinite(style.fogDensity)
      ? clampRange(style.fogDensity, 0.000001, 0.002)
      : fallback;
  }

  private applyLayerFogFrame(
    fogEnabled: boolean,
    fallbackDensity: number,
  ): void {
    for (const [id, group] of this.layers.entries()) {
      const style = this.styleForLayer(id);
      const affectedByFog = style.affectedByFog !== false;
      const fogDensity = this.layerFogDensityForFrame(style, fallbackDensity);
      group.traverse((obj: THREE.Object3D) => {
        const mat = (obj as THREE.Mesh | THREE.Line).material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (!mat) return;
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const material of mats) {
          if (material.userData?.ignoreLayerStyle === true) continue;
          setMaterialFog(material, fogEnabled && affectedByFog, fogDensity);
        }
      });
      this.applyTerrainFogStyle(id, affectedByFog, fogDensity);
    }
  }

  private applyEnvironmentSceneTransitionFrame(
    frame: EnvironmentSceneTransitionFrame,
  ): void {
    const backgroundColor = new THREE.Color(frame.backgroundHex);
    const fogColor = new THREE.Color(frame.fogHex);
    this.renderer.setClearColor(backgroundColor);
    this.scene.background = backgroundColor;

    this.envFogEnabled = frame.fogEnabled;
    this.envFogDensity = frame.fogDensity;
    if (frame.fogEnabled) {
      if (!this.envFog) {
        this.envFog = new THREE.FogExp2(fogColor, frame.fogDensity);
      } else {
        this.envFog.color.copy(fogColor);
        this.envFog.density = frame.fogDensity;
      }
      this.scene.fog = this.envFog;
    } else {
      this.scene.fog = null;
      this.envFog = null;
    }

    this.topoRuntime.applyFogFrame({
      fogColor,
      fogDensity: frame.fogDensity,
    });
    this.applyLayerFogFrame(frame.fogEnabled, frame.fogDensity);
  }

  private updateCinematicPostFrame(nowMs: number): void {
    const transition = this.cinematicSceneTransition;
    if (!transition) {
      if (this.postHandle?.gradePass?.uniforms?.time) {
        this.postHandle.gradePass.uniforms.time.value = nowMs / 1000;
      }
      this.lastCinematicSceneTransitionDebug =
        inactiveCinematicSceneTransitionDebugState();
      return;
    }

    const frame = blendCinematicSceneForTransition(transition, nowMs);
    const environmentFrame = this.currentEnvironmentSceneTransitionFrame;
    const scene = environmentFrame
      ? {
          ...frame.scene,
          ...syntheticSceneForEnvironmentFrame(environmentFrame),
        }
      : frame.scene;
    applyCinematicPostProcessing.call(this, scene, {
      page: frame.page,
      nowMs,
      applyPageMood: true,
    });
    this.lastCinematicSceneTransitionDebug = cinematicSceneTransitionDebugState(
      transition,
      frame.progress,
    );
    if (frame.done) {
      this.cinematicSceneTransition = null;
    }
  }

  setEnvironmentScenePreviewPatch(
    patch: Partial<SceneProperties> | null | undefined,
  ): void {
    this.environmentScenePreviewPatch = patch ? { ...patch } : null;
    if (this.lastEnv) {
      this.applyEnvironment(this.lastEnv);
    }
  }

  applyEnvironment(environment: EnvironmentSetup): void {
    return applyEnvironmentImpl.call(this, environment);
  }

  /**
   * Re-run applyEnvironment against the last-applied env. Called by
   * scene.ts when an async loader resolves so any uniforms that needed
   * the loader's content (terrain shader uniforms in particular) get
   * the real env values instead of construction-time defaults.
   */
  reapplyEnvironment(): void {
    if (!this.lastEnv) return;
    this.applyEnvironment(this.lastEnv);
  }

  /**
   * Re-run the full current page/env state after an async layer loader resolves.
   * PageController may have applied styles before the mesh existed; this closes
   * that startup race so first open matches the saved presentation immediately.
   */
  reapplyCurrentPageState(
    reason: ReapplyCurrentPageStateReason = "state-reapply",
    environmentOverride?: EnvironmentSetup,
    pageOverride?: PresentationPage,
  ): void {
    const env = environmentOverride ?? this.lastEnv ?? this.lastEffectiveEnv;
    const page = pageOverride ?? this.lastEffectivePage;
    const isAsyncLayerResolve = reason === "async-layer-resolve";
    const isEditorDeferredFlush = reason === "editor-deferred-flush";
    const preserveRunningLayerTweens =
      isAsyncLayerResolve || isEditorDeferredFlush;
    const mayStartAsyncEnterTweens = isAsyncLayerResolve;
    const activeTransitionHasFinalized =
      this.activeSceneTransitionContext?.commitState.hasFinalized === true;
    if (
      activeTransitionHasFinalized &&
      !reapplyReasonBypassesPostCommitSuppression(reason)
    ) {
      this.recordLateReapplyDebugEvent(
        reason,
        "transition-envelope",
      );
      this.recordTransitionCommitAttempt({
        phase: "editor-deferred-reapply",
        attemptedBy: "SceneManager.reapplyCurrentPageState",
        reason: "active transition reapply suppressed after final commit",
      });
      return;
    }
    if (
      !reapplyReasonBypassesPostCommitSuppression(reason) &&
      !this.activeSceneTransitionContext &&
      this.suppressDuplicatePostCommitReapply(page)
    ) {
      this.recordLateReapplyDebugEvent(
        reason,
        "transition-envelope",
      );
      return;
    }
    if (
      this.activeSceneTransitionContext &&
      !activeTransitionHasFinalized &&
      env &&
      page
    ) {
      this.recordLateReapplyDebugEvent(
        reason,
        "transition-aware-current-page-state",
      );
      this.reapplyActiveTransitionPageState(env, page, reason);
      return;
    }
    if (this.activeSceneTransitionContext && !activeTransitionHasFinalized) {
      this.recordLateReapplyDebugEvent(
        reason,
        "transition-envelope",
      );
      this.enforceTransitionVisibilityEnvelope();
      this.reapplySceneSectionPlanes();
      this.reapplyWorkingAreaFocus();
      return;
    }
    this.recordLateReapplyDebugEvent(
      reason,
      "full-current-page-state",
    );
    const previousLayerOpacity = new Map<string, number>();
    const previousEnterTweens = preserveRunningLayerTweens
      ? new Map(this.layerTweens)
      : null;
    if (preserveRunningLayerTweens && env && page) {
      for (const [id, group] of this.layers) {
        previousLayerOpacity.set(
          id,
          group.visible ? this.currentRenderOpacityForTree(group, 0) : 0,
        );
      }
    }
    if (env) this.applyEnvironment(env);
    if (env && page) {
      this.applyEffectiveVisibilityForPage(env, page);
      this.applyEffectiveStylesForPage(env, page);
      this.applyPageScene(page);
      if (preserveRunningLayerTweens) {
        // Readiness rule: a layer whose data resolves after the page landed
        // must not flash to full opacity. Async resolves arrive in bursts,
        // and the full style apply above writes full target opacity and
        // clears layerTweens — without restoring in-flight enter fades each
        // burst snapped half-faded layers to full ("terrain snaps in") and
        // restarted not-yet-visible ones. Restore running fades first, then
        // start fades only for genuinely new arrivals.
        const now = performance.now();
        for (const [id, group] of this.layers) {
          if (!group.visible) continue;
          const target = this.targetOpacityForLayer(env, page, id);
          if (target <= 0.001) continue;
          const preserved = previousEnterTweens?.get(id);
          if (preserved) {
            const t =
              preserved.durationMs <= 0
                ? 1
                : (now - preserved.startMs) / preserved.durationMs;
            if (t < 1) {
              this.layerTweens.set(id, { ...preserved, to: target });
              this.applyLayerRenderOpacity(
                id,
                previousLayerOpacity.get(id) ?? 0,
              );
              continue;
            }
          }
          if (!mayStartAsyncEnterTweens) continue;
          if ((previousLayerOpacity.get(id) ?? 0) > 0.001) continue;
          this.applyLayerRenderOpacity(id, 0);
          this.layerTweens.set(id, {
            from: 0,
            to: target,
            startMs: now,
            durationMs: DEFAULT_LAYER_FADE_MS,
            easing: "easeInOutCubic",
          });
        }
      }
    }
  }

  warnUnexpectedTransitionLayer(id: string): void {
    return warnUnexpectedTransitionLayerImpl.call(this, id);
  }

  transitionEnvelopeAllowsLayer(id: string): boolean {
    return transitionEnvelopeAllowsLayerImpl.call(this, id);
  }

  transitionFrameOpacityForLayer(id: string): number {
    return transitionFrameOpacityForLayerImpl.call(this, id);
  }

  enforceTransitionVisibilityEnvelope(): void {
    return enforceTransitionVisibilityEnvelopeImpl.call(this);
  }

  // Per-entity behavior pipeline (Phase 2) runtime flag. Default OFF so the
  // legacy scattered owners run unchanged; A/B-toggleable in DEV via
  // window.__geoseeBehaviorPipeline. ON routes migrated owners through the
  // single applier; non-migrated owners still fall through.
  private perEntityBehaviorActive = false;

  setPerEntityBehaviorActive(value: boolean): void {
    this.perEntityBehaviorActive = value;
  }

  isPerEntityBehaviorActive(): boolean {
    return this.perEntityBehaviorActive;
  }

  // F1.1 observability: counts the owners the pipeline took, so a parity step is
  // verifiable as a hard number (count > 0 with the flag ON, 0 with it OFF) —
  // the eye cannot prove parity. Read/reset via the DEV window hooks.
  private entityBehaviorOpacityOwned = 0;
  private entityBehaviorExitHoldOwned = 0;

  noteEntityBehaviorOpacityOwned(): void {
    this.entityBehaviorOpacityOwned += 1;
  }

  noteEntityBehaviorExitHoldOwned(): void {
    this.entityBehaviorExitHoldOwned += 1;
  }

  entityBehaviorStats(): {
    opacityTweensOwned: number;
    exitHoldsOwned: number;
  } {
    return {
      opacityTweensOwned: this.entityBehaviorOpacityOwned,
      exitHoldsOwned: this.entityBehaviorExitHoldOwned,
    };
  }

  resetEntityBehaviorStats(): void {
    this.entityBehaviorOpacityOwned = 0;
    this.entityBehaviorExitHoldOwned = 0;
  }

  tickLayerTweens(nowMs: number): void {
    if (this.perEntityBehaviorActive && applyEntityBehaviorFrame(this, nowMs)) {
      return;
    }
    return tickLayerTweensImpl.call(this, nowMs);
  }

  interpolatedScalarStyle(fromStyle: EditableStyle, toStyle: EditableStyle, amount: number): EditableStyle {
    return interpolatedScalarStyleImpl.call(this, fromStyle, toStyle, amount);
  }

  private updateBoreLensVisibility(camera: THREE.Camera): void {
    const groups = [
      this.layers.get("drillholes-2023"),
      this.layers.get("assay-samples"),
    ].filter((group): group is THREE.Group => !!group && group.visible);
    if (groups.length === 0) return;
    for (const group of groups) {
      group.traverse((obj) => {
        if (obj.userData?.drillBoreLens !== true) return;
        if (obj.userData?.lensEnabled === false) {
          obj.visible = false;
          return;
        }
        const axis = Array.isArray(obj.userData.capAxis)
          ? obj.userData.capAxis
          : null;
        if (!axis) {
          obj.visible = false;
          return;
        }
        this.boreLensNormal
          .set(Number(axis[0]), Number(axis[1]), Number(axis[2]))
          .normalize();
        obj.getWorldPosition(this.boreLensPos);
        this.boreLensToCamera
          .copy(camera.position)
          .sub(this.boreLensPos)
          .normalize();
        // Inverted from the previous attempt: hide the face that was being
        // shown on the visible coin side, and show the opposite contact cue.
        obj.visible = this.boreLensNormal.dot(this.boreLensToCamera) < 0;
      });
    }
  }

  updateLightingStudioElementScale(camera: THREE.Camera): void {
    return updateLightingStudioElementScaleImpl.call(this, camera);
  }

  updateDynamicCameraOrbitCenterScale(camera: THREE.Camera): void {
    return updateDynamicCameraOrbitCenterScaleImpl.call(this, camera);
  }

  updatePageCameraMarkerScale(marker: PageCameraMarkerRuntime, camera: THREE.Camera): void {
    return updatePageCameraMarkerScaleImpl.call(this, marker, camera);
  }

  updatePageCameraMarkersScale(camera: THREE.Camera): void {
    return updatePageCameraMarkersScaleImpl.call(this, camera);
  }

  private objectTreeVisible(obj: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = obj;
    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }
    return true;
  }

  private mtThresholdSurfaceVisibleForIsoOcclusion(
    material: THREE.Material | THREE.Material[] | undefined,
  ): boolean {
    if (!material) return false;
    const materials = Array.isArray(material) ? material : [material];
    return materials.some((m) => {
      const typed = m as THREE.Material & {
        opacity?: number;
        wireframe?: boolean;
      };
      const wireframe =
        m.userData?.mtThresholdSurfaceWireframe === true ||
        typed.wireframe === true;
      if (wireframe) return false;
      const effectiveOpacity =
        typeof m.userData?.mtThresholdSurfaceEffectiveOpacity === "number"
          ? m.userData.mtThresholdSurfaceEffectiveOpacity
          : typeof typed.opacity === "number"
            ? typed.opacity
            : 1;
      return effectiveOpacity > 0.001;
    });
  }

  private collectMtThresholdSurfacesFromRoot(root: THREE.Object3D): void {
    if (!this.objectTreeVisible(root)) return;
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.userData?.mtThresholdSurfacePreview !== true) return;
      if (!this.objectTreeVisible(obj)) return;
      if (!this.mtThresholdSurfaceVisibleForIsoOcclusion(obj.material)) return;
      obj.updateWorldMatrix(true, false);
      this.sectionIsoThresholdSurfaces.push(obj);
    });
  }

  private collectMtThresholdSurfacesForIsoOcclusion(): THREE.Object3D[] {
    this.sectionIsoThresholdSurfaces.length = 0;
    const group = this.layers.get(UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID);
    if (group) this.collectMtThresholdSurfacesFromRoot(group);
    const snapshot = this.layerTransitionSnapshots.get(
      UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
    );
    if (snapshot) this.collectMtThresholdSurfacesFromRoot(snapshot.group);
    return this.sectionIsoThresholdSurfaces;
  }

  private collectSectionIsoLineOverlaysFromRoot(root: THREE.Object3D): void {
    if (!this.objectTreeVisible(root)) return;
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (
        obj.userData?.sectionIsoLineOverlay !== true &&
        obj.name !== "scalar-section-iso-line-overlay"
      ) {
        return;
      }
      if (!this.objectTreeVisible(obj)) return;
      obj.updateWorldMatrix(true, false);
      this.sectionIsoThresholdLineOverlays.push(obj);
    });
  }

  private collectSectionIsoLineOverlays(): THREE.Mesh[] {
    this.sectionIsoThresholdLineOverlays.length = 0;
    for (const group of this.layers.values()) {
      this.collectSectionIsoLineOverlaysFromRoot(group);
    }
    for (const snapshot of this.layerTransitionSnapshots.values()) {
      this.collectSectionIsoLineOverlaysFromRoot(snapshot.group);
    }
    return this.sectionIsoThresholdLineOverlays;
  }

  private sectionIsoThresholdSurfaceId(obj: THREE.Object3D): string {
    const surfaceId =
      typeof obj.userData?.mtThresholdSurfaceId === "string"
        ? obj.userData.mtThresholdSurfaceId
        : "";
    const productId =
      typeof obj.userData?.mtIsosurfaceProductId === "string"
        ? obj.userData.mtIsosurfaceProductId
        : "";
    return surfaceId ? `${productId}:${surfaceId}` : obj.uuid;
  }

  private setSectionIsoLineThresholdOcclusion(
    line: THREE.Mesh,
    attenuation: number,
    occlusionCount: number,
  ): void {
    const material = line.material;
    const materials = Array.isArray(material) ? material : [material];
    for (const m of materials) {
      const baseOpacity =
        typeof m.userData?.sectionIsoBaseOpacity === "number"
          ? m.userData.sectionIsoBaseOpacity
          : m.opacity;
      m.userData.sectionIsoBaseOpacity = baseOpacity;
      m.userData.sectionIsoThresholdOcclusionCount = occlusionCount;
      // Occlusion count changes are discrete (x0.8 per occluding surface).
      // Snapping the attenuation steps composed opacity ~12% in one frame
      // mid-transition; ramp toward the target at a bounded per-frame rate
      // instead. This runs from the per-frame occlusion update, so the ramp
      // completes in roughly 0.2 / 0.04 = 5 frames per step.
      const previousAttenuation =
        typeof m.userData?.sectionIsoThresholdOcclusionAttenuation === "number" &&
        Number.isFinite(m.userData.sectionIsoThresholdOcclusionAttenuation)
          ? m.userData.sectionIsoThresholdOcclusionAttenuation
          : attenuation;
      const attenuationStep = 0.04;
      const rampedAttenuation =
        Math.abs(attenuation - previousAttenuation) <= attenuationStep
          ? attenuation
          : previousAttenuation +
            Math.sign(attenuation - previousAttenuation) * attenuationStep;
      m.userData.sectionIsoThresholdOcclusionAttenuation = rampedAttenuation;
      const transitionOpacity =
        typeof m.userData?.sectionIsoTransitionOpacity === "number"
          ? m.userData.sectionIsoTransitionOpacity
          : 1;
      this.applySectionIsoOverlayMaterialOpacity(m, transitionOpacity);
    }
    line.userData.sectionIsoThresholdOcclusionCount = occlusionCount;
    line.userData.sectionIsoThresholdOcclusionAttenuation = attenuation;
  }

  private stableSectionIsoThresholdOcclusionCount(
    line: THREE.Mesh,
    rawCount: number,
  ): number {
    const previousStable =
      typeof line.userData.sectionIsoThresholdOcclusionCount === "number"
        ? line.userData.sectionIsoThresholdOcclusionCount
        : null;
    const previousRaw =
      typeof line.userData.sectionIsoThresholdRawOcclusionCount === "number"
        ? line.userData.sectionIsoThresholdRawOcclusionCount
        : null;
    let stable = rawCount;
    if (previousStable !== null && rawCount !== previousStable) {
      stable = rawCount === previousRaw ? rawCount : previousStable;
    }
    line.userData.sectionIsoThresholdRawOcclusionCount = rawCount;
    line.userData.sectionIsoThresholdStableOcclusionCount = stable;
    return stable;
  }

  private sectionIsoLineSamplePoints(line: THREE.Mesh): THREE.Vector3[] {
    const geometry = line.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return this.sectionIsoThresholdSamplePoints.slice(0, 1);
    const size = box.getSize(this.sectionIsoThresholdSamplePoints[0]);
    const axis =
      size.x >= size.y && size.x >= size.z ? "x" : size.y >= size.z ? "y" : "z";
    const min = box.min.getComponent(axis === "x" ? 0 : axis === "y" ? 1 : 2);
    const max = box.max.getComponent(axis === "x" ? 0 : axis === "y" ? 1 : 2);
    const center = box.getCenter(this.sectionIsoThresholdSamplePoints[0]);
    this.sectionIsoThresholdSamplePoints[1].copy(center);
    this.sectionIsoThresholdSamplePoints[1].setComponent(
      axis === "x" ? 0 : axis === "y" ? 1 : 2,
      min,
    );
    this.sectionIsoThresholdSamplePoints[2].copy(center);
    this.sectionIsoThresholdSamplePoints[2].setComponent(
      axis === "x" ? 0 : axis === "y" ? 1 : 2,
      max,
    );
    for (const point of this.sectionIsoThresholdSamplePoints) {
      point.applyMatrix4(line.matrixWorld);
    }
    return this.sectionIsoThresholdSamplePoints;
  }

  private updateSectionIsoThresholdOcclusion(camera: THREE.Camera): void {
    const lines = this.collectSectionIsoLineOverlays();
    if (lines.length === 0) return;

    const surfaces = this.collectMtThresholdSurfacesForIsoOcclusion();
    if (surfaces.length === 0) {
      for (const line of lines) {
        this.setSectionIsoLineThresholdOcclusion(line, 1, 0);
      }
      return;
    }

    camera.getWorldPosition(this.sectionIsoThresholdRayOrigin);
    for (const line of lines) {
      this.sectionIsoThresholdSeenSurfaceIds.clear();
      const samplePoints = this.sectionIsoLineSamplePoints(line);
      for (const samplePoint of samplePoints) {
        this.sectionIsoThresholdRayTarget.copy(samplePoint);
        this.sectionIsoThresholdRayDirection
          .copy(this.sectionIsoThresholdRayTarget)
          .sub(this.sectionIsoThresholdRayOrigin);
        const distance = this.sectionIsoThresholdRayDirection.length();
        if (distance <= 1) continue;
        this.sectionIsoThresholdRayDirection.multiplyScalar(1 / distance);
        this.sectionIsoThresholdRaycaster.set(
          this.sectionIsoThresholdRayOrigin,
          this.sectionIsoThresholdRayDirection,
        );
        this.sectionIsoThresholdRaycaster.near = 0;
        this.sectionIsoThresholdRaycaster.far = Math.max(0, distance - 1);
        const hits =
          this.sectionIsoThresholdRaycaster.intersectObjects(surfaces, false);
        for (const hit of hits) {
          this.sectionIsoThresholdSeenSurfaceIds.add(
            this.sectionIsoThresholdSurfaceId(hit.object),
          );
        }
      }
      const occlusionCount = this.stableSectionIsoThresholdOcclusionCount(
        line,
        this.sectionIsoThresholdSeenSurfaceIds.size,
      );
      this.setSectionIsoLineThresholdOcclusion(
        line,
        Math.pow(0.8, occlusionCount),
        occlusionCount,
      );
    }
  }

  /**
   * Deterministic settle when the tab regains visibility mid-transition (A4).
   * RAF is throttled or paused while the tab is hidden, but `performance.now()`
   * keeps advancing, so on regain every transition clock is already past its
   * end. Run the per-frame transition stages once, in their fixed order
   * (layer/section/ISO tweens via `tickLayerTweens`, then the environment scene
   * transition), so the catch-up lands deterministically instead of each
   * subsystem independently detecting overrun in an order never exercised
   * during normal play. The interrupt-finalize safety net (5.2) guarantees the
   * context is finalized even if the camera completion callback never fires.
   */
  settleActiveTransitionAfterVisibilityRegain(): void {
    if (!this.activeSceneTransitionContext) return;
    const nowMs = performance.now();
    this.tickLayerTweens(nowMs);
    this.updateEnvironmentSceneTransitionFrame(nowMs);
  }

  /**
   * Per-frame tick. Drives scene-overlay opacity tweens and any
   * camera-locked sun updates.
   */
  frameUpdate(camera: THREE.Camera, nowMs: number = performance.now()): void {
    const startedAt = performance.now();
    let stageStart = startedAt;
    this.activeCamera = camera;

    this.updateCameraLockedSun(camera);
    const cameraLockedSunMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    this.tickLayerTweens(nowMs);
    this.tickVisibilityToggleFades(nowMs);
    const layerTweensMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    this.updateEnvironmentSceneTransitionFrame(nowMs);
    const environmentSceneMs = transitionDebugMs(
      performance.now() - stageStart,
    );
    stageStart = performance.now();

    this.updateCinematicPostFrame(nowMs);
    const cinematicPostMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    this.updateBoreLensVisibility(camera);
    const boreLensMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    this.updateLightingStudioElementScale(camera);
    const lightingStudioScaleMs = transitionDebugMs(
      performance.now() - stageStart,
    );
    stageStart = performance.now();

    this.updateDynamicCameraOrbitCenterScale(camera);
    const dynamicCameraOrbitCenterScaleMs = transitionDebugMs(
      performance.now() - stageStart,
    );
    stageStart = performance.now();

    this.updatePageCameraMarkersScale(camera);
    const pageCameraMarkerScaleMs = transitionDebugMs(
      performance.now() - stageStart,
    );
    stageStart = performance.now();

    this.updateEzGammaBillboards(camera);
    const ezGammaBillboardMs = transitionDebugMs(
      performance.now() - stageStart,
    );
    stageStart = performance.now();

    this.updateSceneSectionPlanarTextFacing(camera);
    const sceneSectionTextFacingMs = transitionDebugMs(
      performance.now() - stageStart,
    );
    stageStart = performance.now();

    this.updateSectionIsoThresholdOcclusion(camera);
    const sectionIsoThresholdOcclusionMs = transitionDebugMs(
      performance.now() - stageStart,
    );
    stageStart = performance.now();

    this.topoRuntime.updateGridCameraVisibility(camera);
    const topoGridCameraVisibilityMs = transitionDebugMs(
      performance.now() - stageStart,
    );
    stageStart = performance.now();

    tickLocalAtmosphereVolumeLayers(this.layers.values(), nowMs);
    const localAtmosphereMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    this.updateSeismicTransientLodState(camera, nowMs);
    this.tickSeismicGraphTransition(nowMs);

    this.sceneOverlayController.tick(nowMs);
    const sceneOverlayTickMs = transitionDebugMs(
      performance.now() - stageStart,
    );

    this.lastFrameUpdateDebug = {
      timestampMs: transitionDebugMs(nowMs),
      totalMs: transitionDebugMs(performance.now() - startedAt),
      cameraLockedSunMs,
      layerTweensMs,
      environmentSceneMs,
      cinematicPostMs,
      boreLensMs,
      lightingStudioScaleMs,
      dynamicCameraOrbitCenterScaleMs,
      pageCameraMarkerScaleMs,
      ezGammaBillboardMs,
      sceneSectionTextFacingMs,
      sectionIsoThresholdOcclusionMs,
      topoGridCameraVisibilityMs,
      localAtmosphereMs,
      sceneOverlayTickMs,
      activeSceneTransition: this.activeSceneTransitionContext !== null,
    };
  }

  /**
   * Register the eager-loaded scene-overlay meshes. Adds them to a
   * dedicated group on the scene -- intentionally NOT entered into the
   * `layers` map so the editor's regular Layer tab + visibility flow
   * doesn't show or toggle them. Per-page activation is handled by
   * applySceneOverlaysForPage.
   */
  registerSceneOverlays(handles: Map<string, SceneOverlayHandle>): void {
    this.sceneOverlayController.registerSceneOverlays(handles);
  }

  setSceneOverlayLoaderHooks(opts: {
    resolveAssetPath: (rel: string) => string;
    maxAnisotropy: number;
  }): void {
    this.sceneOverlayController.setSceneOverlayLoaderHooks(opts);
  }

  disposeTerrainOrthoPhotoTexture(): void {
    this.topoRuntime.disposeOrthoPhotoTexture();
  }

  setCaptureFullResolution(enabled: boolean): void {
    this.captureFidelityActive = enabled;
    this.captureFidelityLoadPromises = [];
    this.topoRuntime.setCaptureFullResolution(enabled);
    // Per-layer capture-fidelity upgraders (draped vector re-bake, etc.). A
    // loader opts in by setting `userData.captureFidelityUpgrade` on its group.
    for (const group of this.layers.values()) {
      const upgrade = group.userData?.captureFidelityUpgrade as
        | ((enabled: boolean) => void | Promise<void>)
        | undefined;
      if (typeof upgrade !== "function") continue;
      const result = upgrade(enabled);
      if (
        enabled &&
        result &&
        typeof (result as Promise<void>).then === "function"
      ) {
        this.captureFidelityLoadPromises.push(
          (result as Promise<void>).catch(() => undefined),
        );
      }
    }
    // Raymarch volumes (MT + seismic): max sample steps for capture.
    this.applyCaptureRaymarchSampleSteps(enabled);
    // Seismic: eagerly load the source LOD tier (incl. volume) for visible
    // products so the render does not fall back to a browser/coarse tier.
    if (enabled) {
      this.requestSeismicSourceTierForCapture();
    }
  }

  waitForCaptureFullResolution(): Promise<void> {
    return Promise.allSettled([
      this.topoRuntime.waitForCaptureFullResolution(),
      ...this.captureFidelityLoadPromises,
    ]).then(() => undefined);
  }

  private seismicVisibleProductIdsForRoot(root: THREE.Object3D): string[] {
    const hasVisibleProductIdsState = Array.isArray(
      root.userData.seismicVisibleProductIds,
    );
    const visibleProductIds = hasVisibleProductIdsState
      ? (root.userData.seismicVisibleProductIds as unknown[]).filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        )
      : [];
    const selectedProductId =
      typeof root.userData.seismicSelectedProductId === "string"
        ? root.userData.seismicSelectedProductId
        : typeof root.userData.seismicDefaultProductId === "string"
          ? root.userData.seismicDefaultProductId
          : "";
    return visibleProductIds.length > 0
      ? visibleProductIds
      : !hasVisibleProductIdsState && selectedProductId
        ? [selectedProductId]
        : [];
  }

  private requestSeismicSourceTierForCapture(): void {
    for (const group of this.layers.values()) {
      if (group.visible !== true) continue;
      const root = this.seismicBrowserRoot(group);
      if (!root) continue;
      const productIds = this.seismicVisibleProductIdsForRoot(root);
      if (productIds.length === 0) continue;
      const ensureProductsLoaded = root.userData.seismicEnsureProductsLoaded as
        | ((
            productIds: string[],
            tier: "coarse" | "standard" | "source",
            options?: { includeVolume?: boolean },
          ) => Promise<void>)
        | undefined;
      if (!ensureProductsLoaded) continue;
      // Pre-mark the frame-requested tier so the per-frame driver treats source
      // as already issued (it forces source while capture is active anyway).
      root.userData.seismicFrameRequestedLodTier = "source";
      root.userData.seismicFrameRequestedProductKey = productIds
        .slice()
        .sort()
        .join("\0");
      const promise = ensureProductsLoaded(productIds, "source", {
        includeVolume: true,
      }).catch((error: unknown) => {
        console.warn("[seismic] capture source-tier request failed", error);
      });
      this.captureFidelityLoadPromises.push(promise);
    }
  }

  private applyCaptureRaymarchSampleSteps(enabled: boolean): void {
    const CAPTURE_MAX_SAMPLE_STEPS = 384;
    const applyToMaterial = (
      material: THREE.Material | null | undefined,
      isRaymarch: boolean,
    ): void => {
      const shader = material as THREE.ShaderMaterial | null | undefined;
      const uniforms = shader?.uniforms;
      if (!uniforms || !uniforms.uSampleSteps) return;
      if (
        !isRaymarch &&
        shader?.userData?.scalarVolumeRaymarchMaterial !== true
      ) {
        return;
      }
      if (enabled) {
        if (typeof shader!.userData.captureOrigSampleSteps !== "number") {
          shader!.userData.captureOrigSampleSteps = uniforms.uSampleSteps.value;
        }
        uniforms.uSampleSteps.value = CAPTURE_MAX_SAMPLE_STEPS;
      } else if (typeof shader!.userData.captureOrigSampleSteps === "number") {
        uniforms.uSampleSteps.value = shader!.userData.captureOrigSampleSteps;
        delete shader!.userData.captureOrigSampleSteps;
      }
    };
    for (const group of this.layers.values()) {
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const material = (mesh as { material?: unknown }).material;
        if (!material) return;
        const isRaymarch =
          mesh.userData?.seismicRaymarchVolume === true ||
          mesh.userData?.scalarVolume === true;
        if (Array.isArray(material)) {
          for (const entry of material) applyToMaterial(entry, isRaymarch);
        } else {
          applyToMaterial(material as THREE.Material, isRaymarch);
        }
      });
    }
  }

  /**
   * Editor entry point: load a freshly-added overlay and register it.
   * Awaits the heightSampler internally (via the loader) so the
   * mesh's z drape is correct on the first frame.
   */
  async addSceneOverlay(id: string, def: SceneOverlayDef): Promise<void> {
    return this.sceneOverlayController.addSceneOverlay(id, def);
  }

  removeSceneOverlay(id: string): void {
    this.sceneOverlayController.removeSceneOverlay(id);
  }

  async rebuildSceneOverlayBounds(
    id: string,
    newBounds: SceneOverlayDef["bounds"],
  ): Promise<void> {
    return this.sceneOverlayController.rebuildSceneOverlayBounds(id, newBounds);
  }

  getSceneOverlay(id: string): SceneOverlayHandle | undefined {
    return this.sceneOverlayController.getSceneOverlay(id);
  }

  setHoveredSceneOverlay(id: string | null): void {
    this.sceneOverlayController.setHoveredSceneOverlay(id);
  }

  listSceneOverlays(): SceneOverlayHandle[] {
    return this.sceneOverlayController.listSceneOverlays();
  }

  applySceneOverlaysForPage(
    environment: EnvironmentSetup,
    page: PresentationPage,
  ): void {
    this.sceneOverlayController.applySceneOverlaysForPage(environment, page);
  }

  applySceneOverlaysAtTransitionStart(
    environment: EnvironmentSetup,
    nextPage: PresentationPage,
    clock?: SceneOverlayTransitionClock,
  ): void {
    this.sceneOverlayController.applySceneOverlaysAtTransitionStart(
      environment,
      nextPage,
      clock ?? this.sceneOverlayTransitionClock(),
    );
  }

  applySceneOverlaysAtTransitionEnd(
    environment: EnvironmentSetup,
    nextPage: PresentationPage,
  ): void {
    const trace = this.recordTransitionCommitAttempt({
      phase: "overlay-end-application",
      attemptedBy: "SceneManager.applySceneOverlaysAtTransitionEnd",
    });
    if (trace?.suppressed) return;
    this.sceneOverlayController.applySceneOverlaysAtTransitionEnd(
      environment,
      nextPage,
      this.sceneOverlayTransitionClock(),
    );
  }

  private sceneOverlayTransitionClock():
    | SceneOverlayTransitionClock
    | undefined {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return undefined;
    return {
      durationMs: transition.durationMs,
      startMs: transition.startMs,
    };
  }

  notifyResize(width: number, height: number): void {
    for (const group of this.layers.values()) {
      group.traverse((obj) => {
        const mat = (obj as { material?: THREE.Material | THREE.Material[] })
          .material;
        if (!mat) return;
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
          if (m instanceof LineMaterial) {
            m.resolution.set(width, height);
          }
        }
      });
      const tm = (group.userData as { traceMaterial?: LineMaterial })
        .traceMaterial;
      if (tm) tm.resolution.set(width, height);
    }
    this.sceneOverlayController.notifyResize(width, height);
    this.topoRuntime.notifyResize(width, height);
    const focusMaterial = this.workingAreaFocusRuntime?.line.material;
    if (focusMaterial instanceof LineMaterial) {
      focusMaterial.resolution.set(width, height);
    }
  }
}
