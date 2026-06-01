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
import {
  setDistanceAttenuatedLineWidth,
} from "../loaders/topoLineMaterial";
import {
  applyMtThresholdSurfaceMaterialOpacity,
  MT_THRESHOLD_SURFACE_POLICY,
  SURFACE_RENDER_ORDER,
} from "../loaders/surfaceRenderPolicy";
import type { SceneOverlayDef } from "../pages/types";
import { disposeObjectTree } from "./disposeObjectTree";
import {
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import {
  DEFAULT_MT_SURFACE_BOUNDARIES,
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
  isSeismicSectionMesh,
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
  clearSeismicVolumeCutIsoOverlaysImpl,
  listMtVolumeCutIsoTargetsImpl,
  listSeismicVolumeCutIsoTargetsImpl,
  sampleScalarVolumeByteImpl,
  scalarVolumeIsoOverlayGroupImpl,
  seismicVolumeIsoOverlayGroupImpl,
  updateMtVolumeCutIsoOverlaysImpl,
  updateSeismicVolumeCutIsoOverlaysImpl,
} from "./isoOverlays/volumeCutIsoOverlays";
import {
  type LayerOpacityTween,
  type LayerTransitionSnapshot,
  type NavigationReason,
  type ProductTransitionDecision,
  type ResolvedLayerRenderState,
  type ScalarStyleTween,
  type SceneSectionStyleTween,
  type SceneTransitionContext,
  type WorkingAreaFocusStyleTween,
  easeProgress,
} from "./transitions/transitionStyles";
import type { TransitionAssignmentTrace } from "./transitions/transitionRenderGraphAdapter";
import {
  recordTransitionCommitAttempt as recordTransitionCommitAttemptImpl,
  transitionCommitGraphFromAssignmentTraces,
  type TransitionCommitGraph,
  type TransitionCommitTrace,
} from "./transitions/transitionCommitGate";
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
  applyDemoBoreholeStyle as applyDemoBoreholeStyleToLayer,
  applyEzGammaStyle as applyEzGammaStyleToLayer,
  applyGeochemStyle as applyGeochemStyleToLayer,
  applyHyperspectralStyle as applyHyperspectralStyleToLayer,
  applyImageryLidarAoiStyle as applyImageryLidarAoiStyleToLayer,
} from "./styles/siteDetailStyles";
import {
  clamp01,
  clampRange,
  styleNumber,
} from "./styles/styleUtils";
import {
  SceneOverlaysController,
  type SceneOverlayDebugState,
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
  sceneSectionHelperOpacityForTween as sceneSectionHelperOpacityForTweenImpl,
  sceneSectionLayerIds as sceneSectionLayerIdsImpl,
  sceneSectionObjectVisibilityForObject as sceneSectionObjectVisibilityForObjectImpl,
  sceneSectionObjectTargeted as sceneSectionObjectTargetedImpl,
  sceneSectionProductIds as sceneSectionProductIdsImpl,
  setSceneSectionUniforms as setSceneSectionUniformsImpl,
  updateSceneSectionPlanarTextFacing as updateSceneSectionPlanarTextFacingImpl,
} from "./section/sceneSectionController";
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
import { applyEnvironment as applyEnvironmentImpl } from "./environment/applyEnvironment";
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
  enforceTransitionVisibilityEnvelopeImpl,
  interpolatedScalarStyleImpl,
  tickLayerTweensImpl,
  transitionEnvelopeAllowsLayerImpl,
  transitionFrameOpacityForLayerImpl,
  warnUnexpectedTransitionLayerImpl,
} from "./transitions/layerTweenRuntime";
import { applyStyle as applyStyleImpl } from "./styles/applyLayerStyle";
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
// FADE_MS) so chapter transitions feel coherent across UI surfaces.
const DEFAULT_LAYER_FADE_MS = 800;
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
  | "seismic-volume-cuts";

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
  legendVisible: boolean;
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
  reason: "async-layer-resolve" | "geology-register";
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
  boreLensMs: number;
  lightingStudioScaleMs: number;
  dynamicCameraOrbitCenterScaleMs: number;
  pageCameraMarkerScaleMs: number;
  ezGammaBillboardMs: number;
  sceneSectionTextFacingMs: number;
  sectionIsoThresholdOcclusionMs: number;
  topoGridCameraVisibilityMs: number;
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
  envHemiLight: THREE.HemisphereLight | null = null;
  private envKeyLight: THREE.DirectionalLight | null = null;
  envFillLight: THREE.DirectionalLight | null = null;
  envRimLight: THREE.DirectionalLight | null = null;
  envCustomLights: THREE.Light[] = [];
  envCustomLightTargets: THREE.Object3D[] = [];
  envLightHelperGroup: THREE.Group | null = null;
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
  private scalarStyleTweens = new Map<string, ScalarStyleTween>();
  private layerTransitionSnapshots = new Map<string, LayerTransitionSnapshot>();
  private workingAreaFocusTween: WorkingAreaFocusStyleTween | null = null;
  sceneSectionStyleTween: SceneSectionStyleTween | null = null;
  sceneSectionHelperTransitionOpacity = 1;
  private activeSceneTransitionContext: SceneTransitionContext | null = null;
  private lastTransitionCommitState: SceneTransitionContext["commitState"] | null =
    null;
  private lastPostCommitTargetAssertionSuppressed = false;
  sceneSectionReapplySuspended = false;
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
  private lastAppliedRenderPresetId: string | null = null;
  private lateReapplyDebugSequence = 0;
  private lateReapplyDebugDuringTransitionCount = 0;
  private readonly lateReapplyDebugEvents: LateReapplyDebugEvent[] = [];
  private lastLayerTweenTickDebug: LayerTweenTickDebugState | null = null;
  lastSceneSectionApplyDebug: SceneSectionApplyDebugState | null = null;
  lastMtVolumeCutIsoUpdateDebug: MtVolumeCutIsoUpdateDebugState | null = null;
  private lastFrameUpdateDebug: FrameUpdateDebugState | null = null;

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
    this.reapplySceneSectionPlanes();
    this.reapplyWorkingAreaFocus();
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
        const next =
          typeof shaderOpacity === "number" && Number.isFinite(shaderOpacity)
            ? shaderOpacity
            : material.opacity;
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
    const nextOpacity = clamp01(authoredOpacity * transitionOpacity * occlusion);
    material.userData.sectionIsoTransitionOpacity = transitionOpacity;
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
    return (
      this.layerHasScalarPreviewData(group) ||
      id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID
    );
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
    material.userData = this.cloneTransitionUserData(originalUserData);
    try {
      const clone = material.clone();
      clone.userData = this.cloneTransitionUserData(originalUserData);
      return clone;
    } finally {
      material.userData = originalUserData;
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
  ): void {
    return setSceneSectionUniformsImpl.call(this, material, planes, visibility, frames);
  }

  applySceneSectionMaterial(
    material: THREE.Material,
    planes: ResolvedSceneSectionPlane[],
    visibility: SceneSectionObjectVisibility,
    clippingPlanes: THREE.Plane[],
    frames: ResolvedSceneSectionFrame[],
    frameClippingPlanes: THREE.Plane[],
  ): void {
    return applySceneSectionMaterialImpl.call(this, material, planes, visibility, clippingPlanes, frames, frameClippingPlanes);
  }

  interpolatedSceneSectionStyle(
    fromStyle: EditableStyle,
    toStyle: EditableStyle,
    amount: number,
  ): EditableStyle {
    return interpolatedSceneSectionStyleImpl.call(this, fromStyle, toStyle, amount);
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

  applySceneSectionPlanes(style: EditableStyle): void {
    return applySceneSectionPlanesImpl.call(this, style);
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
    sceneOverlays: SceneOverlayDebugState;
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
      sceneOverlays: this.getSceneOverlayDebugState(),
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

  private transitionCommitUnknownTerminalGraph(): TransitionCommitGraph {
    const targetGraph = this.transitionCommitTargetGraph();
    return {
      entities: targetGraph.entities.map((entity) => ({
        ...entity,
        channels: Object.fromEntries(
          Object.entries(entity.channels ?? {}).map(([key, value]) => [
            key,
            {
              ...(value && typeof value === "object" && !Array.isArray(value)
                ? (value as Record<string, unknown>)
                : { value }),
              coverage: "unknown",
            },
          ]),
        ),
      })),
    };
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

  finalizePageTransitionCommit(
    environment: EnvironmentSetup,
    nextPage: PresentationPage,
  ): TransitionCommitTrace | null {
    if (!this.activeSceneTransitionContext) {
      this.sceneOverlayController.applySceneOverlaysAtTransitionEnd(
        environment,
        nextPage,
      );
      return null;
    }
    const terminalTransitionGraph = this.transitionCommitUnknownTerminalGraph();
    const resolvedTargetGraph = this.transitionCommitTargetGraph();
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
      committedGraph: terminalTransitionGraph,
      reason: "SceneManager owns page-transition final commit",
    });
    if (finalTrace?.allowed) {
      this.sceneOverlayController.applySceneOverlaysAtTransitionEnd(
        environment,
        nextPage,
      );
    }
    this.recordTransitionCommitAttempt({
      phase: "post-commit-graph-check",
      attemptedBy: "SceneManager.finalizePageTransitionCommit",
      terminalTransitionGraph,
      resolvedTargetGraph,
      committedGraph: terminalTransitionGraph,
      reason: "post-commit graph comparison is observational only",
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
  ): void {
    this.lastEffectiveEnv = environment;
    this.lastEffectivePage = page;
    this.applyEnvironment(environment);
    this.applyPageScene(page);

    const nowMs = performance.now();
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
      if (!isSeismicSectionMesh(obj)) return;
      const values = obj.geometry.userData.seismicAmplitudeValues as
        | Float32Array
        | number[];
      let scalarMin = 1;
      let scalarMax = 0;
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

  listSectionIsoTargets(layerId?: string): ScalarSectionIsoTarget[] {
    const targets = [
      ...this.listAuthoredScalarSectionIsoTargets(layerId),
      ...this.listMtVolumeCutIsoTargets(layerId),
      ...this.listSeismicSectionIsoTargets(layerId),
      ...this.listSeismicVolumeCutIsoTargets(layerId),
    ];
    const groupOrder: Record<SectionIsoTargetGroup, number> = {
      "mt-slices": 0,
      "mt-volume-cuts": 1,
      "seismic-sections": 2,
      "seismic-volume-cuts": 3,
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

  updateMtVolumeCutIsoOverlays(style: EditableStyle): void {
    return updateMtVolumeCutIsoOverlaysImpl.call(this, style);
  }

  seismicVolumeIsoOverlayGroup(seismicLayer: THREE.Group): THREE.Group {
    return seismicVolumeIsoOverlayGroupImpl.call(this, seismicLayer);
  }

  clearSeismicVolumeCutIsoOverlays(seismicLayer?: THREE.Group): void {
    return clearSeismicVolumeCutIsoOverlaysImpl.call(this, seismicLayer);
  }

  buildSeismicVolumeCutMesh(mesh: THREE.Mesh, plane: ResolvedSceneSectionPlane, options: {
      amplitudeMin: number;
      amplitudeMax: number;
      amplitudeGamma: number;
      removeBackground: boolean;
      backgroundCutoff: number;
      targetKey: string;
    }): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
  } | null {
    return buildSeismicVolumeCutMeshImpl.call(this, mesh, plane, options);
  }

  updateSeismicVolumeCutIsoOverlays(style: EditableStyle): void {
    return updateSeismicVolumeCutIsoOverlaysImpl.call(this, style);
  }

  mtSurfaceBoundaryDefinitionsFromGroup(
    group: THREE.Group,
  ): MtSurfaceBoundaryDefinition[] {
    const byId = new Map<string, MtSurfaceBoundaryDefinition>();
    group.traverse((obj) => {
      if (obj.userData?.mtThresholdSurfacePreview !== true) return;
      const surface = obj.userData.mtThresholdSurface as
        | {
            id?: unknown;
            label?: unknown;
            color?: unknown;
            comparison?: unknown;
            thresholdOhmM?: unknown;
            thresholdLog10?: unknown;
            kind?: unknown;
          }
        | undefined;
      const id =
        typeof surface?.id === "string"
          ? surface.id
          : typeof obj.userData.mtThresholdSurfaceId === "string"
            ? obj.userData.mtThresholdSurfaceId
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
    });
    for (const boundary of DEFAULT_MT_SURFACE_BOUNDARIES) {
      if (!byId.has(boundary.id)) byId.set(boundary.id, boundary);
    }
    return [...byId.values()];
  }

  private mtVolumeProductIdForIsosurfaceProduct(productId: string): string {
    return productId === "mt-isosurface-full-extent"
      ? "mt-resistivity-full-extent-volume"
      : "mt-resistivity-forge-focused-volume";
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
      const material = new THREE.MeshStandardMaterial({
        color: boundary.color,
        transparent: true,
        opacity: styleNumber(style, "opacity", 0.86, 0, 1) * boundary.opacity,
        roughness: styleNumber(style, "mtThresholdSurfaceRoughness", 0.64, 0, 1),
        metalness: styleNumber(style, "mtThresholdSurfaceMetalness", 0, 0, 1),
        side:
          style.mtThresholdSurfaceSide === "front"
            ? THREE.FrontSide
            : THREE.DoubleSide,
        depthWrite: true,
        depthTest: true,
      });
      material.emissive.set(0xffffff);
      material.emissiveIntensity = styleNumber(
        style,
        "mtThresholdSurfaceEmissiveBoost",
        0.08,
        0,
        1,
      );
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
        if (lineColor) m.color.set(lineColor);
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
    return applyStyleImpl.call(this, id, style);
  }

  applyEffectiveStylesForPage(
    environment: EnvironmentSetup,
    page: PresentationPage,
  ): void {
    this.layerTweens.clear();
    this.scalarStyleTweens.clear();
    this.workingAreaFocusTween = null;
    this.sceneSectionStyleTween = null;
    this.sceneSectionHelperTransitionOpacity = 1;
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
  }

  applyEffectiveVisibilityForPage(
    environment: EnvironmentSetup,
    page: PresentationPage,
  ): void {
    this.layerTweens.clear();
    this.scalarStyleTweens.clear();
    this.workingAreaFocusTween = null;
    this.sceneSectionStyleTween = null;
    this.sceneSectionHelperTransitionOpacity = 1;
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
  ): void {
    return transitionEffectiveLayersForPageImpl.call(this, fromEnvironment, toEnvironment, fromPage, toPage, durationMs, easing, scalarStyleDurationMs, scalarStyleEasing, reason, transitionId);
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
  reapplyCurrentPageState(): void {
    const env = this.lastEnv ?? this.lastEffectiveEnv;
    const page = this.lastEffectivePage;
    if (this.activeSceneTransitionContext?.commitState.hasFinalized) {
      this.recordLateReapplyDebugEvent(
        "async-layer-resolve",
        "transition-envelope",
      );
      this.recordTransitionCommitAttempt({
        phase: "editor-deferred-reapply",
        attemptedBy: "SceneManager.reapplyCurrentPageState",
        reason: "active transition reapply suppressed after final commit",
      });
      return;
    }
    if (!this.activeSceneTransitionContext && this.suppressDuplicatePostCommitReapply(page)) {
      this.recordLateReapplyDebugEvent(
        "async-layer-resolve",
        "transition-envelope",
      );
      return;
    }
    if (this.activeSceneTransitionContext && env && page) {
      this.recordLateReapplyDebugEvent(
        "async-layer-resolve",
        "transition-aware-current-page-state",
      );
      this.reapplyActiveTransitionPageState(env, page);
      return;
    }
    if (this.activeSceneTransitionContext) {
      this.recordLateReapplyDebugEvent(
        "async-layer-resolve",
        "transition-envelope",
      );
      this.enforceTransitionVisibilityEnvelope();
      this.reapplySceneSectionPlanes();
      this.reapplyWorkingAreaFocus();
      return;
    }
    this.recordLateReapplyDebugEvent(
      "async-layer-resolve",
      "full-current-page-state",
    );
    if (env) this.applyEnvironment(env);
    if (env && page) {
      this.applyEffectiveVisibilityForPage(env, page);
      this.applyEffectiveStylesForPage(env, page);
      this.applyPageScene(page);
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

  tickLayerTweens(nowMs: number): void {
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
      m.userData.sectionIsoThresholdOcclusionAttenuation = attenuation;
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
   * Per-frame tick. Drives scene-overlay opacity tweens and any
   * camera-locked sun updates.
   */
  frameUpdate(camera: THREE.Camera, nowMs: number = performance.now()): void {
    const startedAt = performance.now();
    let stageStart = startedAt;

    this.updateCameraLockedSun(camera);
    const cameraLockedSunMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    this.tickLayerTweens(nowMs);
    const layerTweensMs = transitionDebugMs(performance.now() - stageStart);
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

    this.sceneOverlayController.tick(nowMs);
    const sceneOverlayTickMs = transitionDebugMs(
      performance.now() - stageStart,
    );

    this.lastFrameUpdateDebug = {
      timestampMs: transitionDebugMs(nowMs),
      totalMs: transitionDebugMs(performance.now() - startedAt),
      cameraLockedSunMs,
      layerTweensMs,
      boreLensMs,
      lightingStudioScaleMs,
      dynamicCameraOrbitCenterScaleMs,
      pageCameraMarkerScaleMs,
      ezGammaBillboardMs,
      sceneSectionTextFacingMs,
      sectionIsoThresholdOcclusionMs,
      topoGridCameraVisibilityMs,
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
  ): void {
    this.sceneOverlayController.applySceneOverlaysAtTransitionStart(
      environment,
      nextPage,
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
    );
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
