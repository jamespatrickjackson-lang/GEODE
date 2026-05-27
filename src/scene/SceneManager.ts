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
import type { TerrainMaterialHandle } from "./terrainMaterial";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { RectAreaLightHelper } from "three/examples/jsm/helpers/RectAreaLightHelper.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { SceneOverlayHandle } from "../loaders/loadSceneOverlays";
import type { GeologyHandle } from "../loaders/loadGeology";
import {
  setDistanceAttenuatedLineWidth,
} from "../loaders/topoLineMaterial";
import { SURFACE_RENDER_ORDER } from "../loaders/surfaceRenderPolicy";
import { getHeightSampler } from "./heightSampler";
import type { SceneOverlayDef } from "../pages/types";
import { SCENE_ORIGIN } from "../constants";
import { disposeObjectTree } from "./disposeObjectTree";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../projectModules/utahForge/layerIds";
import {
  DEFAULT_MT_SURFACE_BOUNDARIES,
  resolveMtSurfaceBoundaries,
  type MtSurfaceBoundaryDefinition,
  type ResolvedMtSurfaceBoundary,
} from "../projectModules/utahForge/mtSurfaceBoundaries";
import {
  WORKING_AREA_FOCUS_DEFAULT_BOUNDS,
  WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY,
  WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS,
} from "../projectModules/utahForge/workingAreaFocus";
import { CASE_STUDY_B_DEMO_SHELL_LAYER_ID } from "../projectModules/caseStudyB/layerIds";
import { CASE_STUDY_B_DEMO_LAYER_ALIASES } from "../projectModules/caseStudyB/demoLayerAliases";
import {
  SHAHBAZI_GROUND_CONTOUR_LAYER_ID,
  SHAHBAZI_GROUND_SURFACE_LAYER_ID,
} from "../projectModules/shahbazi/layerIds";
import {
  DEFAULT_SCALAR_HIGH_COLOR,
  DEFAULT_SCALAR_LOW_COLOR,
  DEFAULT_SCALAR_MID_COLOR,
  DEFAULT_SEISMIC_HIGH_COLOR,
  DEFAULT_SEISMIC_LOW_COLOR,
  DEFAULT_SEISMIC_MID_COLOR,
  DEFAULT_SURFACE_GRADIENT_HIGH_COLOR,
  DEFAULT_SURFACE_GRADIENT_LOW_COLOR,
  DEFAULT_SURFACE_GRADIENT_MID_COLOR,
  scalarSourceRange,
  seismicBackgroundAlphaAt,
  surfaceGradientColorAt,
} from "./styles/colorScales";
import { applyMtSurfaceMaskPointMaterial } from "./shaders/mtSurfaceMaskShader";
import {
  applyWorkingAreaFocusBuiltInMaterial,
  setWorkingAreaFocusShaderUniforms,
} from "./shaders/workingAreaFocusShader";
import {
  isScalarSectionMesh,
  isSeismicSectionMesh,
  mtVolumeCutSectionId,
  mtVolumeCutTargetKey,
  scalarSectionMeshId,
  scalarSectionMeshKind,
  scalarSectionMeshLabel,
  scalarSectionTargetKey,
  seismicSectionMeshId,
  seismicSectionMeshKind,
  seismicSectionMeshLabel,
  seismicSectionTargetKey,
  seismicVolumeCutSectionId,
  seismicVolumeCutTargetKey,
  updateScalarSectionIsoOverlay,
  type ScalarSectionIsoOptions,
} from "./isoOverlays/sectionIsoOverlay";
import {
  SCALAR_TRANSITION_STYLE_FIELDS,
  SCENE_SECTION_AFFECTED_LAYER_IDS,
  easeProgress,
  forgeDiscreteDataStyleChanged,
  scalarStyleNumber,
  scalarTransitionStyleChanged,
  sceneSectionDiscreteStyleChanged,
  sceneSectionTransitionStyleChanged,
  type LayerOpacityTween,
  type LayerTransitionKind,
  type LayerTransitionSnapshot,
  type NavigationReason,
  type ResolvedLayerRenderState,
  type ScalarStyleTween,
  type SceneSectionStyleTween,
  type SceneTransitionContext,
  type WorkingAreaFocusStyleTween,
} from "./transitions/transitionStyles";
import {
  AreaOutlineController,
  type AreaOutlinePreview,
} from "./outlines/AreaOutlineController";
import {
  applyDrillingAssayDisplay as applyDrillingAssayDisplayToLayers,
  applyTopoDetailDistanceDisplay as applyTopoDetailDistanceDisplayToLayers,
} from "./styles/drillingAndTopoDisplay";
import { applyScalarPreviewStyle as applyScalarPreviewStyleToLayer } from "./styles/scalarPreviewStyle";
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
  styleColor,
  styleNumber,
} from "./styles/styleUtils";
import { SceneOverlaysController } from "./overlays/SceneOverlaysController";
import {
  applySceneSectionHelperTransitionOpacity as applySceneSectionHelperTransitionOpacityImpl,
  applySceneSectionMaterial as applySceneSectionMaterialImpl,
  applySceneSectionPlanes as applySceneSectionPlanesImpl,
  createSceneSectionLabel as createSceneSectionLabelImpl,
  createSceneSectionScaleLabel as createSceneSectionScaleLabelImpl,
  currentSceneSectionStyle as currentSceneSectionStyleImpl,
  ensureSceneSectionRuntime as ensureSceneSectionRuntimeImpl,
  getSceneSectionPlanePosition as getSceneSectionPlanePositionImpl,
  getSceneSectionPlaneScalar as getSceneSectionPlaneScalarImpl,
  getSceneSectionWindowValue as getSceneSectionWindowValueImpl,
  interpolatedSceneSectionStyle as interpolatedSceneSectionStyleImpl,
  listSceneSectionPlanePickables as listSceneSectionPlanePickablesImpl,
  previewSceneSectionPlane as previewSceneSectionPlaneImpl,
  previewSceneSectionWindow as previewSceneSectionWindowImpl,
  rebuildSceneSectionHelpers as rebuildSceneSectionHelpersImpl,
  reapplySceneSectionPlanes as reapplySceneSectionPlanesImpl,
  resolveSceneSectionPlanes as resolveSceneSectionPlanesImpl,
  resolveSceneSectionWindow as resolveSceneSectionWindowImpl,
  sceneSectionActivePlanes as sceneSectionActivePlanesImpl,
  sceneSectionAxisAlongIndex as sceneSectionAxisAlongIndexImpl,
  sceneSectionBounds as sceneSectionBoundsImpl,
  sceneSectionClippingPlanes as sceneSectionClippingPlanesImpl,
  sceneSectionHelperOpacityForTween as sceneSectionHelperOpacityForTweenImpl,
  sceneSectionLayerIds as sceneSectionLayerIdsImpl,
  sceneSectionObjectTargeted as sceneSectionObjectTargetedImpl,
  sceneSectionProductIds as sceneSectionProductIdsImpl,
  sceneSectionWindowAppliesToObject as sceneSectionWindowAppliesToObjectImpl,
  sceneSectionWindowClippingPlanes as sceneSectionWindowClippingPlanesImpl,
  setSceneSectionUniforms as setSceneSectionUniformsImpl,
} from "./section/sceneSectionController";
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
import { applyStyle as applyStyleImpl } from "./styles/applyLayerStyle";
import { extractRuntimeMarchingCubesGeometry } from "../mtResistivity/runtimeMarchingCubes";
import { DEFAULT_MT_RESISTIVITY_SLICE_ID } from "../mtResistivity/sliceProducts";

export type {
  AreaOutlineHandleMode,
  AreaOutlinePreview,
} from "./outlines/AreaOutlineController";

// Fade duration matches the markdown overlay panel (OverlayDisplay's
// FADE_MS) so chapter transitions feel coherent across UI surfaces.
const DEFAULT_LAYER_FADE_MS = 800;
const WORKING_AREA_FOCUS_RENDER_ORDER = 4575;
const MT_SURFACE_MASK_DEFAULT_DEPTH_M = 25;
const MT_SURFACE_MASK_DEFAULT_FEATHER_M = 175;
const MT_VOLUME_SECTION_ISO_GRID_SIZE = 96;
const DEFAULT_CONTOUR_DISTANCE_FADE_NEAR_M = 80;
const DEFAULT_CONTOUR_DISTANCE_FADE_FAR_M = 420;
const DEFAULT_CONTOUR_FAR_LINE_SCALE = 0.28;
const DEFAULT_CONTOUR_FAR_OPACITY = 0.72;
const DEFAULT_CONTOUR_LIFT_M = 0;
const STUDIO_HANDLE_SCREEN_SCALE_DISTANCE_M = 4200;
const STUDIO_HANDLE_MIN_SCALE = 0.55;
const STUDIO_HANDLE_MAX_SCALE = 7.5;
const ORBIT_CENTER_HANDLE_SCREEN_SCALE_DISTANCE_M = 5200;
const ORBIT_CENTER_HANDLE_MIN_SCALE = 0.65;
const ORBIT_CENTER_HANDLE_MAX_SCALE = 1;
const DEFAULT_SCENE_FOG_DENSITY = 0.00018;

let rectAreaLightsReady = false;

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

function styleAffectedByFog(style: EditableStyle): boolean {
  return style.affectedByFog !== false;
}

function styleFogDensity(style: EditableStyle, fallback: number): number {
  return typeof style.fogDensity === "number" &&
    Number.isFinite(style.fogDensity)
    ? clampRange(style.fogDensity, 0.000001, 0.002)
    : fallback;
}

function isContourLikeLayerId(id: string): boolean {
  const lower = id.toLowerCase();
  return lower.includes("contour") || lower.includes("isoline");
}

function hasSurfaceGradientStyle(style: EditableStyle): boolean {
  return (
    typeof style.surfaceGradientLowColor === "string" ||
    typeof style.surfaceGradientMidColor === "string" ||
    typeof style.surfaceGradientHighColor === "string" ||
    typeof style.surfaceGradientMidpoint === "number" ||
    typeof style.surfaceGradientContrast === "number"
  );
}

type PresentationLightSource = NonNullable<
  NonNullable<SceneProperties["lighting"]>["sources"]
>[number];
type PresentationLightType = NonNullable<PresentationLightSource["type"]>;
type LightingHandleKind = "position" | "target";
type LightingHandleMode = "plane" | "height";

interface LightingStudioRuntime {
  type: PresentationLightType;
  light: THREE.Object3D;
  target?: THREE.Object3D;
  helper?: THREE.Object3D;
}

function presentationLightGain(type: PresentationLightType): number {
  switch (type) {
    case "point":
      return 220000;
    case "spot":
      return 140000;
    case "area":
      return 160;
    case "directional":
    default:
      return 1;
  }
}

interface LightingHandleRuntime {
  sourceId: string;
  kind: LightingHandleKind;
  group: THREE.Group;
  pickables: THREE.Object3D[];
}

interface OrbitCenterHandleRuntime {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  directionArrow: THREE.Object3D;
}

interface PageCameraMarkerRuntime {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  line: THREE.Line;
  label: THREE.Sprite;
  targetLocal: THREE.Vector3;
  labelBaseWidth: number;
  labelBaseHeight: number;
  labelLift: number;
}

export type OrbitCenterHandleMode = "plane" | "x" | "y" | "z";
export type SceneSectionAxis = "x" | "y" | "z";
export type SceneSectionWindowHandleKind =
  | "window-min"
  | "window-max"
  | "window-bottom";
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
  axis: SceneSectionAxis;
  enabled: boolean;
  positionM: number;
  invert: boolean;
  normal: THREE.Vector3;
}

export interface ResolvedSceneSectionWindow {
  axis: Exclude<SceneSectionAxis, "z">;
  minAlongM: number;
  maxAlongM: number;
  bottomElevationM: number;
  alongIndex: 0 | 1;
}

export interface SceneSectionRuntime {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  planes: Map<SceneSectionAxis, THREE.Object3D>;
}

interface WorkingAreaFocusRuntime {
  group: THREE.Group;
  line: LineSegments2;
}

interface WorkingAreaFocusState {
  enabled: boolean;
  mode: "inside-only" | "outside-context";
  boundsLayerId: string;
  boundsMin: THREE.Vector3;
  boundsMax: THREE.Vector3;
  targetLayerIds: Set<string>;
  outsideOpacityByLayerId: Map<string, number>;
  helperVisible: boolean;
}

export interface PageCameraMarkerSpec {
  id: string;
  title: string;
  pose: Pose;
  color: string;
}

function ensureRectAreaLights(): void {
  if (rectAreaLightsReady) return;
  RectAreaLightUniformsLib.init();
  rectAreaLightsReady = true;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hardenStudioHelperMaterial(material: THREE.Material): void {
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  material.userData.ignoreLayerFog = true;
  (material as THREE.Material & { fog?: boolean }).fog = false;
  material.transparent = true;
  material.needsUpdate = true;
}

function hardenStudioHelperTree(obj: THREE.Object3D): void {
  obj.renderOrder = 4500;
  obj.traverse((child) => {
    child.renderOrder = 4500;
    const mesh = child as THREE.Object3D & {
      material?: THREE.Material | THREE.Material[];
    };
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) hardenStudioHelperMaterial(mat);
  });
}

export class SceneManager {
  private layers = new Map<string, THREE.Group>();
  private layerSpecs = new Map<string, ProjectLayerSpec>();
  envHemiLight: THREE.HemisphereLight | null = null;
  private envKeyLight: THREE.DirectionalLight | null = null;
  envFillLight: THREE.DirectionalLight | null = null;
  envRimLight: THREE.DirectionalLight | null = null;
  private envCustomLights: THREE.Light[] = [];
  private envCustomLightTargets: THREE.Object3D[] = [];
  private envLightHelperGroup: THREE.Group | null = null;
  private envLightRuntimes = new Map<string, LightingStudioRuntime>();
  private envLightHandles = new Map<string, LightingHandleRuntime>();
  private envLightHandlePickables: THREE.Object3D[] = [];
  private orbitCenterHandle: OrbitCenterHandleRuntime | null = null;
  private pageCameraMarker: PageCameraMarkerRuntime | null = null;
  private globalPageCameraMarkers = new Map<string, PageCameraMarkerRuntime>();
  private sceneSectionRuntime: SceneSectionRuntime | null = null;
  private readonly topoRuntime: TopoMapRuntime;
  private workingAreaFocusRuntime: WorkingAreaFocusRuntime | null = null;
  private lastSceneSectionStyle: EditableStyle = {};
  private lastWorkingAreaFocusStyle: EditableStyle = {};
  private currentWorkingAreaFocusStyle: EditableStyle = {};
  private sceneSectionClippingActive = false;
  private publicSurfaceClippingActive = false;
  private appliedLayerStyles = new Map<string, EditableStyle>();
  private editorMode = true;
  private studioSceneElementsVisible = true;
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
  private readonly studioHandleWorldPos = new THREE.Vector3();
  private readonly orbitCenterWorldPos = new THREE.Vector3();
  private readonly pageCameraMarkerWorldPos = new THREE.Vector3();
  private readonly ezGammaWorldPos = new THREE.Vector3();
  private readonly ezGammaToCamera = new THREE.Vector3();
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
  private sceneSectionStyleTween: SceneSectionStyleTween | null = null;
  sceneSectionHelperTransitionOpacity = 1;
  private activeSceneTransitionContext: SceneTransitionContext | null = null;
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

  private topoSurfaceGroup(): THREE.Group | undefined {
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
        this.lastSceneSectionStyle.sceneSectionHelperVisible !== false;
      this.sceneSectionRuntime.group.visible =
        enabled &&
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
    this.studioSceneElementsVisible = enabled;
    if (this.envLightHelperGroup) {
      this.envLightHelperGroup.visible = this.editorMode && enabled;
    }
  }

  clearLightingStudioSources(): void {
    for (const light of this.envCustomLights) {
      this.scene.remove(light);
      (light as { dispose?: () => void }).dispose?.();
    }
    for (const target of this.envCustomLightTargets) {
      this.scene.remove(target);
    }
    this.envCustomLights = [];
    this.envCustomLightTargets = [];
    this.envLightRuntimes.clear();
    this.envLightHandles.clear();
    this.envLightHandlePickables = [];
    if (this.envLightHelperGroup) {
      this.scene.remove(this.envLightHelperGroup);
      disposeObjectTree(this.envLightHelperGroup);
      this.envLightHelperGroup = null;
    }
  }

  private lightingHandleKey(
    sourceId: string,
    kind: LightingHandleKind,
  ): string {
    return `${sourceId}:${kind}`;
  }

  private makeLightingHandleMaterial(
    color: THREE.ColorRepresentation,
    opacity = 0.92,
  ): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(mat);
    return mat;
  }

  private markLightingPickable(
    obj: THREE.Object3D,
    sourceId: string,
    kind: LightingHandleKind,
    mode: LightingHandleMode,
    pickables: THREE.Object3D[],
  ): void {
    obj.userData.lightingHandle = true;
    obj.userData.lightingSourceId = sourceId;
    obj.userData.lightingHandleKind = kind;
    obj.userData.lightingHandleMode = mode;
    obj.renderOrder = 4500;
    pickables.push(obj);
  }

  private addLightingStudioHandle(
    sourceId: string,
    kind: LightingHandleKind,
    position: THREE.Vector3,
    color: THREE.Color,
    helperGroup: THREE.Group,
  ): void {
    const group = new THREE.Group();
    group.name = `lighting-handle-${kind}-${sourceId}`;
    group.position.copy(position);
    group.renderOrder = 4500;

    const pickables: THREE.Object3D[] = [];
    const scale = kind === "target" ? 0.68 : 1;
    const axisLength = 720 * scale;
    const coneLength = 150 * scale;
    const axisRadius = 16 * scale;
    const ringRadius = 360 * scale;
    const coreRadius = 120 * scale;

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(coreRadius, 18, 12),
      this.makeLightingHandleMaterial(color, kind === "target" ? 0.45 : 0.55),
    );
    this.markLightingPickable(core, sourceId, kind, "plane", pickables);
    group.add(core);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 9 * scale, 8, 72),
      this.makeLightingHandleMaterial("#ffffff", 0.72),
    );
    this.markLightingPickable(ring, sourceId, kind, "plane", pickables);
    group.add(ring);

    const addAxis = (
      axis: "x" | "y" | "z",
      axisColor: THREE.ColorRepresentation,
    ) => {
      const mode: LightingHandleMode = axis === "z" ? "height" : "plane";
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 12),
        this.makeLightingHandleMaterial(axisColor, 0.88),
      );
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(48 * scale, coneLength, 18),
        this.makeLightingHandleMaterial(axisColor, 0.92),
      );
      if (axis === "x") {
        shaft.rotation.z = -Math.PI / 2;
        shaft.position.x = axisLength / 2;
        head.rotation.z = -Math.PI / 2;
        head.position.x = axisLength + coneLength / 2;
      } else if (axis === "z") {
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = axisLength / 2;
        head.rotation.x = Math.PI / 2;
        head.position.z = axisLength + coneLength / 2;
      } else {
        shaft.position.y = axisLength / 2;
        head.position.y = axisLength + coneLength / 2;
      }
      this.markLightingPickable(shaft, sourceId, kind, mode, pickables);
      this.markLightingPickable(head, sourceId, kind, mode, pickables);
      group.add(shaft, head);
    };

    addAxis("x", "#ff4f4f");
    addAxis("y", "#4ddf9a");
    addAxis("z", "#58a6ff");

    const labelColor = kind === "target" ? "#ffcc66" : "#ffffff";
    const targetRing = new THREE.Mesh(
      new THREE.TorusGeometry(185 * scale, 7 * scale, 8, 48),
      this.makeLightingHandleMaterial(
        labelColor,
        kind === "target" ? 0.85 : 0.35,
      ),
    );
    targetRing.rotation.x = Math.PI / 2;
    targetRing.position.z = 8 * scale;
    this.markLightingPickable(targetRing, sourceId, kind, "plane", pickables);
    group.add(targetRing);

    helperGroup.add(group);
    hardenStudioHelperTree(group);
    const runtime: LightingHandleRuntime = { sourceId, kind, group, pickables };
    this.envLightHandles.set(this.lightingHandleKey(sourceId, kind), runtime);
    this.envLightHandlePickables.push(...pickables);
  }

  private updateLightingStudioHelpers(): void {
    if (!this.envLightHelperGroup) return;
    this.envLightHelperGroup.traverse((obj) => {
      (obj as { update?: () => void }).update?.();
    });
    hardenStudioHelperTree(this.envLightHelperGroup);
  }

  private makeOrbitCenterMaterial(
    color: THREE.ColorRepresentation,
    opacity = 0.9,
  ): THREE.MeshStandardMaterial {
    const tint = new THREE.Color(color);
    const mat = new THREE.MeshStandardMaterial({
      color: tint,
      emissive: tint.clone().multiplyScalar(0.28),
      emissiveIntensity: 0.18,
      roughness: 0.46,
      metalness: 0.08,
      transparent: opacity < 1,
      opacity,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    mat.side = THREE.DoubleSide;
    hardenStudioHelperMaterial(mat);
    return mat;
  }

  private markOrbitCenterPickable(
    obj: THREE.Object3D,
    mode: OrbitCenterHandleMode,
    pickables: THREE.Object3D[],
  ): void {
    obj.userData.dynamicCameraOrbitCenter = true;
    obj.userData.dynamicCameraOrbitCenterMode = mode;
    obj.renderOrder = 4520;
    pickables.push(obj);
  }

  private markPageCameraPickable(
    obj: THREE.Object3D,
    pickables: THREE.Object3D[],
    id: string,
    kind: "current" | "global",
  ): void {
    obj.userData.pageCameraMarker = true;
    obj.userData.pageCameraMarkerId = id;
    obj.userData.pageCameraMarkerKind = kind;
    obj.renderOrder = 4540;
    pickables.push(obj);
  }

  private createPageCameraLabel(
    text = "Camera",
    accentColor = "rgba(48, 48, 48, 0.22)",
    fillColor = "rgba(255, 255, 255, 0.92)",
  ): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 104;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = fillColor;
      roundRect(ctx, 12, 12, 488, 70, 18);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 7;
      roundRect(ctx, 12, 12, 488, 70, 18);
      ctx.stroke();
      ctx.fillStyle = "rgba(0, 0, 0, 0.76)";
      let fontSize = 27;
      const fontFamily = "system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.font = `700 ${fontSize}px ${fontFamily}`;
      while (fontSize > 17 && ctx.measureText(text).width > 420) {
        fontSize -= 1;
        ctx.font = `700 ${fontSize}px ${fontFamily}`;
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, canvas.width / 2, 47);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(material);
    const sprite = new THREE.Sprite(material);
    sprite.name = "page-camera-label";
    sprite.renderOrder = 4540;
    return sprite;
  }

  private createPageCameraMarker(
    pose: Pose,
    opts: {
      id: string;
      kind: "current" | "global";
      label: string;
      color?: string;
      fillColor?: string;
      labelBaseWidth?: number;
      labelBaseHeight?: number;
      labelLift?: number;
    },
  ): PageCameraMarkerRuntime {
    const group = new THREE.Group();
    group.name = `__page_camera_marker_${opts.kind}_${opts.id}__`;
    group.visible = this.editorMode;
    group.renderOrder = 4540;

    const pickables: THREE.Object3D[] = [];
    const labelStroke =
      opts.kind === "global"
        ? (opts.color ?? "rgba(48, 48, 48, 0.22)")
        : "rgba(48, 48, 48, 0.22)";
    const label = this.createPageCameraLabel(
      opts.label,
      labelStroke,
      opts.fillColor,
    );
    this.markPageCameraPickable(label, pickables, opts.id, opts.kind);
    group.add(label);

    const lineMaterial = new THREE.LineDashedMaterial({
      color: opts.color ?? "#ffffff",
      transparent: true,
      opacity: 0.82,
      dashSize: 120,
      gapSize: 72,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(lineMaterial);
    const line = new THREE.Line(new THREE.BufferGeometry(), lineMaterial);
    line.name = "page-camera-to-target-line";
    line.renderOrder = 4538;
    group.add(line);

    this.scene.add(group);
    const runtime = {
      group,
      pickables,
      line,
      label,
      targetLocal: new THREE.Vector3(),
      labelBaseWidth: opts.labelBaseWidth ?? 520,
      labelBaseHeight: opts.labelBaseHeight ?? 106,
      labelLift: opts.labelLift ?? 250,
    };
    this.updatePageCameraMarkerPose(runtime, pose);
    return runtime;
  }

  private updatePageCameraMarkerLine(marker: PageCameraMarkerRuntime): void {
    const start = marker.label.position;
    const end = marker.targetLocal;
    const positionAttribute = marker.line.geometry.getAttribute("position");
    if (
      positionAttribute instanceof THREE.BufferAttribute &&
      positionAttribute.count >= 2
    ) {
      positionAttribute.setXYZ(0, start.x, start.y, start.z);
      positionAttribute.setXYZ(1, end.x, end.y, end.z);
      positionAttribute.needsUpdate = true;
      marker.line.geometry.computeBoundingSphere();
    } else {
      marker.line.geometry.dispose();
      marker.line.geometry = new THREE.BufferGeometry().setFromPoints([
        start.clone(),
        end.clone(),
      ]);
    }
    marker.line.computeLineDistances();
  }

  private updatePageCameraMarkerPose(
    marker: PageCameraMarkerRuntime,
    pose: Pose,
  ): void {
    const position = new THREE.Vector3(...pose.position);
    const target = new THREE.Vector3(...pose.target);
    marker.group.position.copy(position);
    marker.label.position.set(0, 0, marker.labelLift);
    marker.targetLocal.copy(target.sub(position));
    this.updatePageCameraMarkerLine(marker);
    hardenStudioHelperTree(marker.group);
  }

  private updatePageCameraMarkerVisibility(): void {
    const showGlobal = this.editorMode && this.globalPageCameraMarkers.size > 0;
    for (const marker of this.globalPageCameraMarkers.values()) {
      marker.group.visible = showGlobal;
    }
    if (this.pageCameraMarker) {
      this.pageCameraMarker.group.visible = this.editorMode && !showGlobal;
    }
  }

  private createOrbitCenterHandle(
    position: THREE.Vector3,
  ): OrbitCenterHandleRuntime {
    const group = new THREE.Group();
    group.name = "__dynamic_camera_orbit_center__";
    group.position.copy(position);
    group.visible = this.editorMode;
    group.renderOrder = 4520;

    const pickables: THREE.Object3D[] = [];
    const ringRadius = 150;
    const innerRadius = 78;
    const axisLength = 260;
    const coneLength = 60;
    const axisRadius = 6;
    const ringZ = 16;

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 5, 8, 72),
      this.makeOrbitCenterMaterial("#ffffff", 0.8),
    );
    halo.position.z = ringZ;
    this.markOrbitCenterPickable(halo, "plane", pickables);

    const directionArrow = new THREE.Mesh(
      new THREE.ConeGeometry(18, 38, 3),
      this.makeOrbitCenterMaterial("#ffffff", 0.8),
    );
    directionArrow.position.set(ringRadius, 0, ringZ);
    this.markOrbitCenterPickable(directionArrow, "plane", pickables);

    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(innerRadius, 4, 8, 64),
      this.makeOrbitCenterMaterial("#34d5ff", 0.8),
    );
    inner.position.z = 18;
    this.markOrbitCenterPickable(inner, "plane", pickables);

    const addAxis = (
      axis: OrbitCenterHandleMode,
      axisColor: THREE.ColorRepresentation,
    ) => {
      if (axis === "plane") return;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(axisRadius, axisRadius, axisLength, 12),
        this.makeOrbitCenterMaterial(axisColor, 0.8),
      );
      const head = new THREE.Mesh(
        new THREE.ConeGeometry(22, coneLength, 18),
        this.makeOrbitCenterMaterial(axisColor, 0.8),
      );
      if (axis === "x") {
        shaft.rotation.z = -Math.PI / 2;
        shaft.position.x = axisLength / 2;
        head.rotation.z = -Math.PI / 2;
        head.position.x = axisLength + coneLength / 2;
      } else if (axis === "z") {
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = axisLength / 2;
        head.rotation.x = Math.PI / 2;
        head.position.z = axisLength + coneLength / 2;
      } else {
        shaft.position.y = axisLength / 2;
        head.position.y = axisLength + coneLength / 2;
      }
      this.markOrbitCenterPickable(shaft, axis, pickables);
      this.markOrbitCenterPickable(head, axis, pickables);
      group.add(shaft, head);
    };

    addAxis("x", "#ff4f4f");
    addAxis("y", "#4ddf9a");
    addAxis("z", "#58a6ff");

    const cameraIcon = new THREE.Group();
    cameraIcon.name = "dynamic-camera-orbit-center-camera-icon";
    cameraIcon.position.set(0, -205, 122);
    const iconMaterial = this.makeOrbitCenterMaterial("#ffffff", 0.8);
    const iconBody = new THREE.Mesh(
      new THREE.BoxGeometry(8, 58, 34),
      iconMaterial,
    );
    const iconPrism = new THREE.Mesh(
      new THREE.BoxGeometry(8, 24, 12),
      iconMaterial,
    );
    iconPrism.position.set(0, -8, 23);
    const iconLens = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 11, 8, 24),
      this.makeOrbitCenterMaterial("#34d5ff", 0.8),
    );
    iconLens.rotation.z = Math.PI / 2;
    iconLens.position.set(-6, 8, 0);
    cameraIcon.add(iconBody, iconPrism, iconLens);

    group.add(halo, directionArrow, inner, cameraIcon);
    hardenStudioHelperTree(group);
    this.scene.add(group);
    return { group, pickables, directionArrow };
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
    if (!pose) {
      if (this.pageCameraMarker) {
        this.scene.remove(this.pageCameraMarker.group);
        disposeObjectTree(this.pageCameraMarker.group);
        this.pageCameraMarker = null;
      }
      return;
    }
    if (!this.pageCameraMarker) {
      this.pageCameraMarker = this.createPageCameraMarker(pose, {
        id: "__current_page_camera__",
        kind: "current",
        label: "Camera",
        color: "#ffffff",
      });
      this.updatePageCameraMarkerVisibility();
      return;
    }
    this.updatePageCameraMarkerPose(this.pageCameraMarker, pose);
    this.updatePageCameraMarkerVisibility();
  }

  setGlobalPageCameraMarkers(markers: PageCameraMarkerSpec[] | null): void {
    for (const marker of this.globalPageCameraMarkers.values()) {
      this.scene.remove(marker.group);
      disposeObjectTree(marker.group);
    }
    this.globalPageCameraMarkers.clear();
    if (!markers || markers.length === 0) {
      this.updatePageCameraMarkerVisibility();
      return;
    }
    for (const marker of markers) {
      const runtime = this.createPageCameraMarker(marker.pose, {
        id: marker.id,
        kind: "global",
        label: marker.title,
        color: marker.color,
        fillColor: marker.color,
        labelBaseWidth: 760,
        labelBaseHeight: 154,
        labelLift: 270,
      });
      this.globalPageCameraMarkers.set(marker.id, runtime);
    }
    this.updatePageCameraMarkerVisibility();
  }

  listPageCameraMarkerPickables(): THREE.Object3D[] {
    if (!this.editorMode) return [];
    const pickables: THREE.Object3D[] = [];
    if (this.pageCameraMarker?.group.visible) {
      pickables.push(...this.pageCameraMarker.pickables);
    }
    for (const marker of this.globalPageCameraMarkers.values()) {
      if (marker.group.visible) pickables.push(...marker.pickables);
    }
    return pickables;
  }

  addLightingStudioSource(
    source: PresentationLightSource,
    helperGroup: THREE.Group,
  ): void {
    if (source.enabled === false) return;
    const color = new THREE.Color(source.color ?? "#ffffff");
    const [px, py, pz] = source.position ?? [0, -3500, 2500];
    const [tx, ty, tz] = source.target ?? [0, 0, 0];
    const type = source.type ?? "spot";
    const intensity =
      (source.intensity ?? 1) * (source.gain ?? presentationLightGain(type));

    if (type === "point") {
      const light = new THREE.PointLight(
        color,
        intensity,
        source.distance ?? 9000,
        source.decay ?? 1.6,
      );
      light.position.set(px, py, pz);
      light.castShadow = false;
      light.name = source.label ?? source.id;
      this.scene.add(light);
      this.envCustomLights.push(light);
      const helper = new THREE.PointLightHelper(light, 300, color);
      hardenStudioHelperTree(helper);
      helperGroup.add(helper);
      this.envLightRuntimes.set(source.id, { type, light, helper });
      this.addLightingStudioHandle(
        source.id,
        "position",
        light.position,
        color,
        helperGroup,
      );
      return;
    }

    if (type === "area") {
      ensureRectAreaLights();
      const light = new THREE.RectAreaLight(
        color,
        intensity,
        source.width ?? 1600,
        source.height ?? 900,
      );
      light.position.set(px, py, pz);
      light.lookAt(tx, ty, tz);
      light.name = source.label ?? source.id;
      const target = new THREE.Object3D();
      target.position.set(tx, ty, tz);
      target.name = `${source.id}-target`;
      this.scene.add(target);
      this.envCustomLightTargets.push(target);
      this.scene.add(light);
      this.envCustomLights.push(light);
      const helper = new RectAreaLightHelper(light);
      hardenStudioHelperTree(helper);
      helperGroup.add(helper);
      this.envLightRuntimes.set(source.id, { type, light, target, helper });
      this.addLightingStudioHandle(
        source.id,
        "position",
        light.position,
        color,
        helperGroup,
      );
      this.addLightingStudioHandle(
        source.id,
        "target",
        target.position,
        color,
        helperGroup,
      );
      return;
    }

    if (type === "directional") {
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(px, py, pz);
      light.target.position.set(tx, ty, tz);
      this.scene.add(light.target);
      this.envCustomLightTargets.push(light.target);
      light.target.updateMatrixWorld();
      light.castShadow = false;
      light.name = source.label ?? source.id;
      this.scene.add(light);
      this.envCustomLights.push(light);
      const helper = new THREE.DirectionalLightHelper(light, 650, color);
      hardenStudioHelperTree(helper);
      helperGroup.add(helper);
      this.envLightRuntimes.set(source.id, {
        type,
        light,
        target: light.target,
        helper,
      });
      this.addLightingStudioHandle(
        source.id,
        "position",
        light.position,
        color,
        helperGroup,
      );
      this.addLightingStudioHandle(
        source.id,
        "target",
        light.target.position,
        color,
        helperGroup,
      );
      return;
    }

    const light = new THREE.SpotLight(
      color,
      intensity,
      source.distance ?? 12000,
      THREE.MathUtils.degToRad(source.angle ?? 24),
      source.penumbra ?? 0.35,
      source.decay ?? 1.4,
    );
    light.position.set(px, py, pz);
    light.target.position.set(tx, ty, tz);
    this.scene.add(light.target);
    this.envCustomLightTargets.push(light.target);
    light.target.updateMatrixWorld();
    light.castShadow = false;
    light.name = source.label ?? source.id;
    this.scene.add(light);
    this.envCustomLights.push(light);
    const helper = new THREE.SpotLightHelper(light, color);
    helper.update();
    hardenStudioHelperTree(helper);
    helperGroup.add(helper);
    this.envLightRuntimes.set(source.id, {
      type,
      light,
      target: light.target,
      helper,
    });
    this.addLightingStudioHandle(
      source.id,
      "position",
      light.position,
      color,
      helperGroup,
    );
    this.addLightingStudioHandle(
      source.id,
      "target",
      light.target.position,
      color,
      helperGroup,
    );
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

  private setProductOpacityBaseForMaterial(
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
        const isTransitionEntity =
          obj.userData?.scalarSectionIsoOverlay === true ||
          material.userData?.scalarSectionIsoOverlay === true;
        if (
          material.userData?.ignoreLayerStyle === true &&
          !isTransitionEntity
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

  private captureLayerRenderStates(
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
  ): void {
    const next = clamp01(opacity);
    root.visible = next > 0.001;
    root.traverse((obj) => {
      const mat = (obj as THREE.Mesh | THREE.Line).material as
        | THREE.Material
        | THREE.Material[]
        | undefined;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        if (m.userData?.ignoreLayerStyle === true) continue;
        const preserveProductOpacity =
          m.userData?.preserveMaterialOpacity === true;
        const productBase = preserveProductOpacity
          ? this.productOpacityBaseForMaterial(m)
          : 1;
        const materialOpacity = preserveProductOpacity
          ? clamp01(productBase * next)
          : next;
        this.baseOpacityForMaterial(m);
        m.opacity = materialOpacity;
        m.transparent =
          m.userData?.forceTransparent === true || materialOpacity < 1;
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

  private applyLayerRenderOpacity(id: string, opacity: number): void {
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

  private layerSupportsScalarStyleTween(
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

  private cloneLayerTransitionSnapshot(
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
  }

  private applyTerrainCompositeOpacity(layerId: string, opacity: number): void {
    if (
      layerId !== "hydrography-lakes" &&
      layerId !== "three-firs-target" &&
      layerId !== "great-plains-target" &&
      layerId !== "claim-boundary" &&
      layerId !== "bedrock-geology" &&
      layerId !== "trees-vri"
    ) {
      return;
    }
    const terrainGroup = this.topoSurfaceGroup();
    if (!terrainGroup) return;
    terrainGroup.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      switch (layerId) {
        case "hydrography-lakes":
          handle.setLakeOpacity(opacity);
          break;
        case "three-firs-target":
          handle.setTargetOpacity("target-three-firs", opacity);
          break;
        case "great-plains-target":
          handle.setTargetOpacity("target-great-plains", opacity);
          break;
        case "claim-boundary":
          handle.setClaimOpacity(opacity);
          break;
        case "bedrock-geology":
          handle.setGeologyOpacity(opacity);
          break;
        case "trees-vri":
          handle.setForestFillOpacity(opacity);
          handle.setForestOutlineOpacity(opacity);
          break;
      }
    });
    if (layerId === "hydrography-lakes") {
      this.applyStreamLakeOcclusion(opacity > 0.001);
    }
  }

  applyTerrainFogStyle(
    layerId: string,
    affectedByFog: boolean,
    fogDensity: number,
  ): void {
    if (
      !this.isTopoSurfaceLayerId(layerId) &&
      layerId !== "hydrography-lakes" &&
      layerId !== "three-firs-target" &&
      layerId !== "great-plains-target" &&
      layerId !== "claim-boundary" &&
      layerId !== "bedrock-geology" &&
      layerId !== "trees-vri"
    ) {
      return;
    }
    const terrainGroup = this.topoSurfaceGroup();
    if (!terrainGroup) return;
    const enabled = this.envFogEnabled && affectedByFog;
    terrainGroup.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      switch (layerId) {
        case this.topoSurfaceLayerId():
          handle.setTerrainFogEnabled(enabled);
          handle.setTerrainFogDensity(fogDensity);
          break;
        case "hydrography-lakes":
          handle.setLakeFogEnabled(enabled);
          handle.setLakeFogDensity(fogDensity);
          break;
        case "three-firs-target":
          handle.setTargetFogEnabled("target-three-firs", enabled);
          handle.setTargetFogDensity("target-three-firs", fogDensity);
          break;
        case "great-plains-target":
          handle.setTargetFogEnabled("target-great-plains", enabled);
          handle.setTargetFogDensity("target-great-plains", fogDensity);
          break;
        case "claim-boundary":
          handle.setClaimFogEnabled(enabled);
          handle.setClaimFogDensity(fogDensity);
          break;
        case "bedrock-geology":
          handle.setGeologyFogEnabled(enabled);
          handle.setGeologyFogDensity(fogDensity);
          break;
        case "trees-vri":
          handle.setForestFogEnabled(enabled);
          handle.setForestFogDensity(fogDensity);
          break;
      }
    });
  }

  private styleForLayer(id: string): EditableStyle {
    const appliedStyle = this.appliedLayerStyles.get(id);
    if (appliedStyle) return appliedStyle;
    if (this.lastEffectiveEnv && this.lastEffectivePage) {
      return effectiveStyle(this.lastEffectiveEnv, this.lastEffectivePage, id);
    }
    return this.lastEnv?.layerStyles[id] ?? {};
  }

  private isSiteSurfaceGuideLayerId(id: string): boolean {
    return (
      id === UTAH_FORGE_SITE_BOUNDARY_LAYER_ID ||
      id === UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID
    );
  }

  private siteSurfaceGuideOrigin(group?: THREE.Object3D): {
    easting: number;
    northing: number;
    elevation: number;
  } {
    const parseOrigin = (
      value: unknown,
    ): { easting: number; northing: number; elevation: number } | null => {
      if (Array.isArray(value) && value.length >= 2) {
        const [easting, northing, elevation = 0] = value;
        return typeof easting === "number" &&
          Number.isFinite(easting) &&
          typeof northing === "number" &&
          Number.isFinite(northing) &&
          typeof elevation === "number" &&
          Number.isFinite(elevation)
          ? { easting, northing, elevation }
          : null;
      }
      if (!value || typeof value !== "object") return null;
      const record = value as Record<string, unknown>;
      const easting = record.easting ?? record.easting_m;
      const northing = record.northing ?? record.northing_m;
      const elevation = record.elevation ?? record.elevation_m ?? 0;
      return typeof easting === "number" &&
        Number.isFinite(easting) &&
        typeof northing === "number" &&
        Number.isFinite(northing) &&
        typeof elevation === "number" &&
        Number.isFinite(elevation)
        ? { easting, northing, elevation }
        : null;
    };

    const terrainMetadata = this.layerSpecFor(this.topoSurfaceLayerId())
      ?.metadata as Record<string, unknown> | undefined;
    const terrainTransform = terrainMetadata?.geoTransform as
      | Record<string, unknown>
      | undefined;
    let sourceProps = group?.userData?.sourceProperties as
      | Record<string, unknown>
      | undefined;
    let source = group?.userData?.source as Record<string, unknown> | undefined;
    group?.traverse((child) => {
      sourceProps ??= child.userData?.sourceProperties as
        | Record<string, unknown>
        | undefined;
      source ??= child.userData?.source as Record<string, unknown> | undefined;
    });
    const sourceTransform = source?.geoTransform as
      | Record<string, unknown>
      | undefined;

    return (
      parseOrigin(terrainTransform?.sceneOriginUtm) ??
      parseOrigin(sourceProps?.sceneOriginUtm) ??
      parseOrigin(sourceTransform?.sceneOriginUtm) ?? {
        easting: SCENE_ORIGIN.easting,
        northing: SCENE_ORIGIN.northing,
        elevation: SCENE_ORIGIN.elevation,
      }
    );
  }

  private sourceSiteGuideLines(group: THREE.Object3D): Vec3[][] {
    const rawLines: unknown[] = [];
    group.traverse((child) => {
      const lines = child.userData?.sourceLineStrings;
      if (Array.isArray(lines)) rawLines.push(...lines);
    });
    return rawLines
      .map((line) =>
        Array.isArray(line)
          ? line.filter(
              (point): point is Vec3 =>
                Array.isArray(point) &&
                point.length >= 3 &&
                point.every(
                  (entry) =>
                    typeof entry === "number" && Number.isFinite(entry),
                ),
            )
          : [],
      )
      .filter((line) => line.length >= 2);
  }

  private resampleSiteGuideLine(line: Vec3[], stepM: number): Vec3[] {
    if (line.length <= 1) return line;
    const resampled: Vec3[] = [line[0]];
    for (let index = 1; index < line.length; index += 1) {
      const start = line[index - 1];
      const end = line[index];
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const dz = end[2] - start[2];
      const distance = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(distance / stepM));
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        resampled.push([
          start[0] + dx * t,
          start[1] + dy * t,
          start[2] + dz * t,
        ]);
      }
    }
    return resampled;
  }

  private siteGuideSurfaceZ(
    x: number,
    y: number,
    sampleHeight: (easting: number, northing: number) => number,
    origin: { easting: number; northing: number; elevation: number },
    liftM: number,
  ): number {
    return (
      sampleHeight(origin.easting + x, origin.northing + y) -
      origin.elevation +
      liftM
    );
  }

  private pointInSiteGuideRing(x: number, y: number, ring: Vec3[]): boolean {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const denom = yj - yi;
      const intersects =
        yi > y !== yj > y &&
        x <
          ((xj - xi) * (y - yi)) /
            (Math.abs(denom) < 0.000001 ? 0.000001 : denom) +
            xi;
      if (intersects) inside = !inside;
    }
    return inside;
  }

  private siteGuideRing(lines: Vec3[][]): Vec3[] | null {
    const longest = lines.reduce<Vec3[] | null>(
      (best, line) => (!best || line.length > best.length ? line : best),
      null,
    );
    if (!longest || longest.length < 3) return null;
    const ring = longest.slice();
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.hypot(last[0] - first[0], last[1] - first[1]) > 0.001) {
      ring.push(first);
    }
    return ring;
  }

  private buildSiteGuideFillGeometry(
    ring: Vec3[],
    sampleHeight: (easting: number, northing: number) => number,
    origin: { easting: number; northing: number; elevation: number },
  ): THREE.BufferGeometry {
    const xs = ring.map((point) => point[0]);
    const ys = ring.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const targetStepM = 140;
    const cols = Math.max(1, Math.ceil((maxX - minX) / targetStepM));
    const rows = Math.max(1, Math.ceil((maxY - minY) / targetStepM));
    const stepX = (maxX - minX) / cols;
    const stepY = (maxY - minY) / rows;
    const positions: number[] = [];
    const push = (x: number, y: number) => {
      positions.push(
        x,
        y,
        this.siteGuideSurfaceZ(x, y, sampleHeight, origin, 1.4),
      );
    };

    for (let col = 0; col < cols; col += 1) {
      const x0 = minX + col * stepX;
      const x1 = minX + (col + 1) * stepX;
      for (let row = 0; row < rows; row += 1) {
        const y0 = minY + row * stepY;
        const y1 = minY + (row + 1) * stepY;
        const cx = (x0 + x1) * 0.5;
        const cy = (y0 + y1) * 0.5;
        if (!this.pointInSiteGuideRing(cx, cy, ring)) continue;
        push(x0, y0);
        push(x1, y0);
        push(x1, y1);
        push(x0, y0);
        push(x1, y1);
        push(x0, y1);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  private updateSiteSurfaceGuide(
    id: string,
    group: THREE.Object3D,
    style: EditableStyle,
    sampleHeight: (easting: number, northing: number) => number,
  ): void {
    const sourceLines = this.sourceSiteGuideLines(group);
    if (sourceLines.length === 0) return;
    const origin = this.siteSurfaceGuideOrigin(group);
    const linePositions: number[] = [];
    for (const sourceLine of sourceLines) {
      const line = this.resampleSiteGuideLine(sourceLine, 90);
      for (let index = 1; index < line.length; index += 1) {
        for (const point of [line[index - 1], line[index]]) {
          linePositions.push(
            point[0],
            point[1],
            this.siteGuideSurfaceZ(point[0], point[1], sampleHeight, origin, 3),
          );
        }
      }
    }

    const fillColor =
      typeof style.color === "string"
        ? style.color
        : id === UTAH_FORGE_SITE_BOUNDARY_LAYER_ID
          ? "#ffd84a"
          : "#adadad";
    const fillOpacity =
      typeof style.fillOpacity === "number" ? clamp01(style.fillOpacity) : 0.08;
    const outlineColor =
      typeof style.outlineColor === "string" ? style.outlineColor : fillColor;
    const outlineOpacity =
      typeof style.opacity === "number" ? clamp01(style.opacity) : 1;
    const renderOrder =
      id === UTAH_FORGE_SITE_BOUNDARY_LAYER_ID ? 4590 : 4580;

    group.traverse((obj) => {
      if (obj.userData?.terrainDrapedSiteGuideLine !== true) return;
      const line = obj as LineSegments2;
      const geometry = line.geometry as LineSegmentsGeometry | undefined;
      if (geometry?.setPositions) {
        geometry.setPositions(linePositions);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        line.computeLineDistances();
      }
      const material = line.material as LineMaterial | undefined;
      if (material instanceof LineMaterial) {
        material.color.set(outlineColor);
        material.opacity = outlineOpacity;
        material.transparent = true;
        material.depthTest = true;
        material.depthWrite = false;
        material.userData.forceTransparent = true;
        material.userData.lakeOutlineMaterial = true;
        material.needsUpdate = true;
      }
    });

    const ring = this.siteGuideRing(sourceLines);
    let fill = group.children.find(
      (child) => child.userData?.terrainDrapedSiteGuideFill === true,
    ) as THREE.Mesh | undefined;
    if (!ring || fillOpacity <= 0.0001) {
      if (fill) {
        fill.parent?.remove(fill);
        disposeObjectTree(fill);
      }
      return;
    }

    const fillGeometry = this.buildSiteGuideFillGeometry(
      ring,
      sampleHeight,
      origin,
    );
    if (!fill) {
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: fillColor,
        transparent: true,
        opacity: fillOpacity,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      fillMaterial.userData.forceTransparent = true;
      fillMaterial.userData.lakeFillMaterial = true;
      fill = new THREE.Mesh(fillGeometry, fillMaterial);
      fill.name = `${group.name || id} fill`;
      fill.userData = {
        displayName: group.userData?.displayName ?? group.name,
        terrainDrapedSiteGuideFill: true,
      };
      group.add(fill);
    } else {
      fill.geometry.dispose();
      fill.geometry = fillGeometry;
    }
    fill.renderOrder = renderOrder - 0.1;
    const material = fill.material as THREE.MeshBasicMaterial;
    material.color.set(fillColor);
    material.opacity = fillOpacity;
    material.transparent = true;
    material.depthTest = true;
    material.depthWrite = false;
    material.needsUpdate = true;
  }

  private applySiteSurfaceGuideStyle(id: string, style: EditableStyle): void {
    if (!this.isSiteSurfaceGuideLayerId(id)) return;
    const group = this.layers.get(id);
    if (!group) return;
    void getHeightSampler().then((sampleHeight) => {
      if (this.layers.get(id) !== group) return;
      this.updateSiteSurfaceGuide(id, group, style, sampleHeight);
    });
  }

  reapplySiteSurfaceGuides(): void {
    for (const id of [
      UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
      UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
    ]) {
      this.applySiteSurfaceGuideStyle(id, this.styleForLayer(id));
    }
  }

  applyMtSurfaceMaskStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    this.restoreMtSurfaceMaskMaterials(id);
    const enabled = style.scalarSurfaceMaskEnabled !== false;
    const depthM = styleNumber(
      style,
      "scalarSurfaceMaskDepthM",
      MT_SURFACE_MASK_DEFAULT_DEPTH_M,
      0,
      500,
    );
    const featherM = styleNumber(
      style,
      "scalarSurfaceMaskFeatherM",
      MT_SURFACE_MASK_DEFAULT_FEATHER_M,
      0,
      1000,
    );

    void getHeightSampler().then((sampleHeight) => {
      if (this.layers.get(id) !== group) return;
      const origin = this.siteSurfaceGuideOrigin(group);
      const terrainGroup = this.layers.get(this.topoSurfaceLayerId());
      const terrainScaleZ =
        typeof terrainGroup?.scale.z === "number" &&
        Number.isFinite(terrainGroup.scale.z)
          ? terrainGroup.scale.z
          : 1;
      const terrainLiftZ =
        typeof terrainGroup?.position.z === "number" &&
        Number.isFinite(terrainGroup.position.z)
          ? terrainGroup.position.z
          : 0;
      const maskKey = [
        enabled ? "1" : "0",
        depthM.toFixed(3),
        featherM.toFixed(3),
        origin.easting.toFixed(3),
        origin.northing.toFixed(3),
        origin.elevation.toFixed(3),
        terrainScaleZ.toFixed(6),
        terrainLiftZ.toFixed(3),
      ].join("|");

      group.traverse((obj) => {
        if (!(obj instanceof THREE.Points)) return;
        this.updateMtSurfaceMaskForPoints(obj, {
          enabled,
          depthM,
          featherM,
          origin,
          maskKey,
          sampleHeight,
          terrainScaleZ,
          terrainLiftZ,
        });
      });
    });
  }

  private updateMtSurfaceMaskForPoints(
    points: THREE.Points,
    options: {
      enabled: boolean;
      depthM: number;
      featherM: number;
      origin: { easting: number; northing: number; elevation: number };
      maskKey: string;
      sampleHeight: (easting: number, northing: number) => number;
      terrainScaleZ: number;
      terrainLiftZ: number;
    },
  ): void {
    const geometry = points.geometry;
    const position = geometry.getAttribute("position");
    if (!(position instanceof THREE.BufferAttribute)) return;

    const material = points.material;
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      if (mat instanceof THREE.PointsMaterial) {
        applyMtSurfaceMaskPointMaterial(mat);
      }
    }

    if (
      geometry.userData.mtSurfaceMaskKey === options.maskKey &&
      geometry.getAttribute("surfaceMaskAlpha")
    ) {
      return;
    }

    let alphaAttribute = geometry.getAttribute("surfaceMaskAlpha");
    if (
      !(alphaAttribute instanceof THREE.BufferAttribute) ||
      alphaAttribute.count !== position.count
    ) {
      alphaAttribute = new THREE.BufferAttribute(
        new Float32Array(position.count),
        1,
      );
      geometry.setAttribute("surfaceMaskAlpha", alphaAttribute);
    }

    const alpha = alphaAttribute.array as Float32Array;
    if (!options.enabled) {
      alpha.fill(1);
    } else {
      const world = new THREE.Vector3();
      points.updateMatrixWorld(true);
      const feather = Math.max(0.000001, options.featherM);
      for (let i = 0; i < position.count; i += 1) {
        world
          .set(position.getX(i), position.getY(i), position.getZ(i))
          .applyMatrix4(points.matrixWorld);
        const terrainSurfaceZ =
          (options.sampleHeight(
            options.origin.easting + world.x,
            options.origin.northing + world.y,
          ) -
            options.origin.elevation) *
            options.terrainScaleZ +
          options.terrainLiftZ;
        if (!Number.isFinite(terrainSurfaceZ)) {
          alpha[i] = 1;
          continue;
        }
        const clearanceM = terrainSurfaceZ - world.z;
        if (clearanceM <= options.depthM) {
          alpha[i] = 0;
        } else if (options.featherM <= 0) {
          alpha[i] = 1;
        } else {
          const t = clamp01((clearanceM - options.depthM) / feather);
          alpha[i] = t * t * (3 - 2 * t);
        }
      }
    }
    alphaAttribute.needsUpdate = true;
    geometry.userData.mtSurfaceMaskKey = options.maskKey;
  }

  private restoreMtSurfaceMaskMaterials(id: string): void {
    if (id !== UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    group.traverse((obj) => {
      const material = (obj as THREE.Points).material;
      const materials = Array.isArray(material) ? material : [material];
      for (const mat of materials) {
        if (!(mat instanceof THREE.PointsMaterial)) continue;
        mat.depthWrite = false;
        mat.depthTest = true;
        mat.blending = THREE.NormalBlending;
        mat.toneMapped = false;
        mat.needsUpdate = true;
      }
    });
  }

  sceneSectionProductIds(style: EditableStyle): Set<string> {
    return sceneSectionProductIdsImpl.call(this, style);
  }

  sceneSectionLayerIds(style: EditableStyle): Set<string> {
    return sceneSectionLayerIdsImpl.call(this, style);
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

  sceneSectionWindowClippingPlanes(
    window: ResolvedSceneSectionWindow | null,
  ): THREE.Plane[] {
    return sceneSectionWindowClippingPlanesImpl.call(this, window);
  }

  sceneSectionWindowAppliesToObject(
    layerId: string,
    obj: THREE.Object3D,
  ): boolean {
    return sceneSectionWindowAppliesToObjectImpl.call(this, layerId, obj);
  }

  setSceneSectionUniforms(
    material: THREE.ShaderMaterial,
    planes: ResolvedSceneSectionPlane[],
    targeted: boolean,
    window: ResolvedSceneSectionWindow | null,
  ): void {
    return setSceneSectionUniformsImpl.call(this, material, planes, targeted, window);
  }

  applySceneSectionMaterial(
    material: THREE.Material,
    planes: ResolvedSceneSectionPlane[],
    targeted: boolean,
    clippingPlanes: THREE.Plane[],
    window: ResolvedSceneSectionWindow | null,
    windowClippingPlanes: THREE.Plane[],
    windowTargeted: boolean,
  ): void {
    return applySceneSectionMaterialImpl.call(this, material, planes, targeted, clippingPlanes, window, windowClippingPlanes, windowTargeted);
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

  createSceneSectionScaleLabel(text: string): THREE.Mesh {
    return createSceneSectionScaleLabelImpl.call(this, text);
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

  reapplySceneSectionPlanes(): void {
    return reapplySceneSectionPlanesImpl.call(this);
  }

  listSceneSectionPlanePickables(): THREE.Object3D[] {
    return listSceneSectionPlanePickablesImpl.call(this);
  }

  getSceneSectionPlanePosition(axis: SceneSectionAxis): THREE.Vector3 | null {
    return getSceneSectionPlanePositionImpl.call(this, axis);
  }

  getSceneSectionPlaneScalar(axis: SceneSectionAxis): number | null {
    return getSceneSectionPlaneScalarImpl.call(this, axis);
  }

  getSceneSectionWindowValue(
    axis: SceneSectionAxis,
    kind: SceneSectionWindowHandleKind,
  ): number | null {
    return getSceneSectionWindowValueImpl.call(this, axis, kind);
  }

  previewSceneSectionPlane(axis: SceneSectionAxis, positionM: number): void {
    return previewSceneSectionPlaneImpl.call(this, axis, positionM);
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
    this.topoRuntime.applySurfaceLiftStyle(layerId, style);
  }

  private updateRendererLocalClipping(): void {
    this.renderer.localClippingEnabled =
      this.sceneSectionClippingActive || this.publicSurfaceClippingActive;
  }

  private workingAreaFocusTargetLayerIds(style: EditableStyle): Set<string> {
    const configured = Array.isArray(style.workingAreaFocusTargetLayerIds)
      ? style.workingAreaFocusTargetLayerIds.filter(
          (id) => typeof id === "string",
        )
      : [];
    return new Set(
      configured.length > 0
        ? configured
        : Array.from(WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS),
    );
  }

  private workingAreaFocusOutsideOpacity(
    style: EditableStyle,
    layerId: string,
  ): number {
    if (style.workingAreaFocusEnabled !== true) return 1;
    if (style.workingAreaFocusMode === "inside-only") return 0;
    const map = style.workingAreaFocusOutsideOpacityByLayerId ?? {};
    const value = map[layerId];
    return typeof value === "number" && Number.isFinite(value)
      ? clamp01(value)
      : WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY;
  }

  private cleanWorkingAreaFocusVector(value: unknown): THREE.Vector3 | null {
    if (Array.isArray(value) && value.length >= 3) {
      const [x, y, z] = value;
      return typeof x === "number" &&
        typeof y === "number" &&
        typeof z === "number" &&
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(z)
        ? new THREE.Vector3(x, y, z)
        : null;
    }
    const vector = value as { x?: unknown; y?: unknown; z?: unknown } | null;
    if (
      vector &&
      typeof vector.x === "number" &&
      typeof vector.y === "number" &&
      typeof vector.z === "number" &&
      Number.isFinite(vector.x) &&
      Number.isFinite(vector.y) &&
      Number.isFinite(vector.z)
    ) {
      return new THREE.Vector3(vector.x, vector.y, vector.z);
    }
    return null;
  }

  private resolveWorkingAreaFocusBounds(boundsLayerId: string): {
    min: THREE.Vector3;
    max: THREE.Vector3;
  } {
    const layer = this.layers.get(boundsLayerId);
    const candidates: unknown[] = [];
    if (layer?.userData?.sceneBounds)
      candidates.push(layer.userData.sceneBounds);
    layer?.traverse((obj) => {
      if (obj.userData?.sceneBounds) candidates.push(obj.userData.sceneBounds);
    });
    for (const candidate of candidates) {
      const bounds = candidate as { min?: unknown; max?: unknown };
      const min = this.cleanWorkingAreaFocusVector(bounds.min);
      const max = this.cleanWorkingAreaFocusVector(bounds.max);
      if (min && max) return { min, max };
    }
    return {
      min: WORKING_AREA_FOCUS_DEFAULT_BOUNDS.min.clone(),
      max: WORKING_AREA_FOCUS_DEFAULT_BOUNDS.max.clone(),
    };
  }

  private workingAreaFocusState(style: EditableStyle): WorkingAreaFocusState {
    const boundsLayerId =
      typeof style.workingAreaFocusBoundsLayerId === "string"
        ? style.workingAreaFocusBoundsLayerId
        : UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID;
    const bounds = this.resolveWorkingAreaFocusBounds(boundsLayerId);
    const targetLayerIds = this.workingAreaFocusTargetLayerIds(style);
    const outsideOpacityByLayerId = new Map<string, number>();
    for (const layerId of targetLayerIds) {
      outsideOpacityByLayerId.set(
        layerId,
        this.workingAreaFocusOutsideOpacity(style, layerId),
      );
    }
    return {
      enabled: style.workingAreaFocusEnabled === true,
      mode:
        style.workingAreaFocusMode === "inside-only"
          ? "inside-only"
          : "outside-context",
      boundsLayerId,
      boundsMin: bounds.min,
      boundsMax: bounds.max,
      targetLayerIds,
      outsideOpacityByLayerId,
      helperVisible: style.workingAreaFocusHelperVisible !== false,
    };
  }

  private workingAreaFocusSegmentPositions(
    min: THREE.Vector3,
    max: THREE.Vector3,
  ): number[] {
    const corners = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z),
    ];
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ] as const;
    return edges.flatMap(([a, b]) => [
      corners[a].x,
      corners[a].y,
      corners[a].z,
      corners[b].x,
      corners[b].y,
      corners[b].z,
    ]);
  }

  private ensureWorkingAreaFocusRuntime(): WorkingAreaFocusRuntime {
    if (this.workingAreaFocusRuntime) return this.workingAreaFocusRuntime;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions([]);
    const material = new LineMaterial({
      color: 0x69f0ff,
      linewidth: 2,
      worldUnits: false,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
      depthWrite: false,
      dashed: false,
    });
    material.fog = false;
    material.userData.forceTransparent = true;
    material.resolution.set(
      window.innerWidth || 1920,
      window.innerHeight || 1080,
    );
    const line = new LineSegments2(geometry, material);
    line.name = "Working area focus box";
    line.renderOrder = WORKING_AREA_FOCUS_RENDER_ORDER;
    line.userData.workingAreaFocusHelper = true;
    const group = new THREE.Group();
    group.name = "__working_area_focus_box__";
    group.visible = false;
    group.userData.workingAreaFocusHelper = true;
    group.add(line);
    this.scene.add(group);
    this.workingAreaFocusRuntime = { group, line };
    return this.workingAreaFocusRuntime;
  }

  private rebuildWorkingAreaFocusHelper(state: WorkingAreaFocusState): void {
    const runtime = this.ensureWorkingAreaFocusRuntime();
    runtime.group.visible =
      this.editorMode && state.enabled && state.helperVisible;
    if (!state.enabled) return;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(
      this.workingAreaFocusSegmentPositions(state.boundsMin, state.boundsMax),
    );
    runtime.line.geometry.dispose();
    runtime.line.geometry = geometry;
    runtime.line.computeLineDistances();
  }

  private setKnownShaderWorkingAreaFocus(
    material: THREE.ShaderMaterial,
    enabled: boolean,
    state: WorkingAreaFocusState,
    outsideOpacity: number,
  ): boolean {
    const uniforms = material.uniforms as Record<string, { value: unknown }>;
    if (!uniforms.uWorkingAreaFocusEnabled) return false;
    setWorkingAreaFocusShaderUniforms(
      uniforms,
      enabled,
      state.boundsMin,
      state.boundsMax,
      outsideOpacity,
    );
    material.needsUpdate = true;
    return true;
  }

  private applyWorkingAreaFocusMaterial(
    material: THREE.Material,
    enabled: boolean,
    state: WorkingAreaFocusState,
    outsideOpacity: number,
  ): void {
    if (material.userData?.workingAreaFocusHelper === true) return;
    if (material instanceof THREE.ShaderMaterial) {
      if (
        this.setKnownShaderWorkingAreaFocus(
          material,
          enabled,
          state,
          outsideOpacity,
        )
      ) {
        return;
      }
      material.userData.workingAreaFocusUnsupported = enabled;
      return;
    }
    applyWorkingAreaFocusBuiltInMaterial(
      material,
      enabled,
      state.boundsMin,
      state.boundsMax,
      outsideOpacity,
    );
  }

  private applyWorkingAreaFocusStyle(style: EditableStyle): void {
    this.lastWorkingAreaFocusStyle = style;
    this.currentWorkingAreaFocusStyle = style;
    const state = this.workingAreaFocusState(style);
    for (const [layerId, group] of this.layers) {
      const targeted =
        state.enabled &&
        state.targetLayerIds.has(layerId) &&
        layerId !== state.boundsLayerId;
      const outsideOpacity = state.outsideOpacityByLayerId.get(layerId) ?? 1;
      group.traverse((obj) => {
        const material = (
          obj as { material?: THREE.Material | THREE.Material[] }
        ).material;
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        for (const m of materials) {
          this.applyWorkingAreaFocusMaterial(
            m,
            targeted,
            state,
            outsideOpacity,
          );
        }
      });
    }
    this.rebuildWorkingAreaFocusHelper(state);
  }

  private reapplyWorkingAreaFocus(): void {
    this.applyWorkingAreaFocusStyle(this.lastWorkingAreaFocusStyle);
  }

  private interpolatedWorkingAreaFocusStyle(
    fromStyle: EditableStyle,
    toStyle: EditableStyle,
    t: number,
  ): EditableStyle {
    const targetLayerIds = new Set<string>([
      ...this.workingAreaFocusTargetLayerIds(fromStyle),
      ...this.workingAreaFocusTargetLayerIds(toStyle),
    ]);
    const outsideOpacityByLayerId: Record<string, number> = {};
    for (const layerId of targetLayerIds) {
      const from = this.workingAreaFocusOutsideOpacity(fromStyle, layerId);
      const to = this.workingAreaFocusOutsideOpacity(toStyle, layerId);
      outsideOpacityByLayerId[layerId] = from + (to - from) * t;
    }
    return {
      ...toStyle,
      workingAreaFocusEnabled:
        fromStyle.workingAreaFocusEnabled === true ||
        toStyle.workingAreaFocusEnabled === true,
      workingAreaFocusMode: "outside-context",
      workingAreaFocusTargetLayerIds: Array.from(targetLayerIds),
      workingAreaFocusOutsideOpacityByLayerId: outsideOpacityByLayerId,
    };
  }

  private transitionWorkingAreaFocusForPage(
    environment: EnvironmentSetup,
    fromPage: PresentationPage,
    toPage: PresentationPage,
    durationMs: number,
    easing: EasingName,
  ): void {
    const fromStyle =
      Object.keys(this.currentWorkingAreaFocusStyle).length > 0
        ? this.currentWorkingAreaFocusStyle
        : effectiveStyle(
            environment,
            fromPage,
            UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
          );
    const toStyle = effectiveStyle(
      environment,
      toPage,
      UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
    );
    const duration = Math.max(0, durationMs);
    if (duration <= 0) {
      this.workingAreaFocusTween = null;
      this.applyWorkingAreaFocusStyle(toStyle);
      return;
    }
    this.workingAreaFocusTween = {
      fromStyle,
      toStyle,
      startMs: performance.now(),
      durationMs: duration,
      easing,
    };
    this.applyWorkingAreaFocusStyle(
      this.interpolatedWorkingAreaFocusStyle(fromStyle, toStyle, 0),
    );
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
    const state = this.workingAreaFocusState(this.currentWorkingAreaFocusStyle);
    return {
      enabled: state.enabled,
      mode: state.mode,
      boundsLayerId: state.boundsLayerId,
      targetLayerIds: Array.from(state.targetLayerIds),
      outsideOpacityByLayerId: Object.fromEntries(
        state.outsideOpacityByLayerId,
      ),
      helperVisible: state.helperVisible,
      helperRenderable: this.workingAreaFocusRuntime?.group.visible === true,
      boundsMin: [state.boundsMin.x, state.boundsMin.y, state.boundsMin.z],
      boundsMax: [state.boundsMax.x, state.boundsMax.y, state.boundsMax.z],
    };
  }

  applyTerrainCompositeStyle(
    layerId: string,
    style: EditableStyle,
  ): void {
    if (
      layerId !== "hydrography-lakes" &&
      layerId !== "three-firs-target" &&
      layerId !== "great-plains-target" &&
      layerId !== "claim-boundary" &&
      layerId !== "bedrock-geology" &&
      layerId !== "trees-vri"
    ) {
      return;
    }
    const terrainGroup = this.topoSurfaceGroup();
    if (!terrainGroup) return;
    const opacity =
      typeof style.opacity === "number" ? clamp01(style.opacity) : 1;
    const fillOpacity =
      typeof style.fillOpacity === "number"
        ? clamp01(style.fillOpacity)
        : opacity;
    const affectedByFog = styleAffectedByFog(style);
    const fogDensity = styleFogDensity(style, this.envFogDensity);
    terrainGroup.traverse((obj) => {
      const handle = (obj as THREE.Mesh).userData?.terrainHandle as
        | TerrainMaterialHandle
        | undefined;
      if (!handle) return;
      switch (layerId) {
        case "hydrography-lakes":
          if (typeof style.color === "string") handle.setLakeColor(style.color);
          handle.setLakeFogEnabled(affectedByFog);
          handle.setLakeFogDensity(fogDensity);
          handle.setLakeOpacity(fillOpacity);
          break;
        case "three-firs-target":
          if (typeof style.color === "string") {
            handle.setTargetColor("target-three-firs", style.color);
          }
          handle.setTargetFogEnabled("target-three-firs", affectedByFog);
          handle.setTargetFogDensity("target-three-firs", fogDensity);
          handle.setTargetOpacity("target-three-firs", opacity);
          break;
        case "great-plains-target":
          if (typeof style.color === "string") {
            handle.setTargetColor("target-great-plains", style.color);
          }
          handle.setTargetFogEnabled("target-great-plains", affectedByFog);
          handle.setTargetFogDensity("target-great-plains", fogDensity);
          handle.setTargetOpacity("target-great-plains", opacity);
          break;
        case "claim-boundary":
          if (typeof style.color === "string")
            handle.setClaimColor(style.color);
          handle.setClaimFogEnabled(affectedByFog);
          handle.setClaimFogDensity(fogDensity);
          handle.setClaimOpacity(opacity);
          break;
        case "bedrock-geology":
          handle.setGeologyFogEnabled(affectedByFog);
          handle.setGeologyFogDensity(fogDensity);
          handle.setGeologyOpacity(opacity);
          break;
        case "trees-vri":
          if (typeof style.color === "string") {
            handle.setForestColor(style.color);
            handle.setForestOutlineColor(style.color);
          }
          handle.setForestFogEnabled(affectedByFog);
          handle.setForestFogDensity(fogDensity);
          handle.setForestEdge(
            typeof style.forestEdgeThreshold === "number"
              ? style.forestEdgeThreshold
              : 0.5,
            typeof style.forestEdgeSoftness === "number"
              ? style.forestEdgeSoftness
              : 0.035,
          );
          handle.setForestFillOpacity(opacity);
          handle.setForestOutlineOpacity(opacity);
          // Sync wall geometry material (created by loadTreesVri).
          // wallMaterial lives on the inner group returned by the loader,
          // not on the outer wrapper group, so traverse to find it.
          {
            let wallMat: THREE.ShaderMaterial | undefined;
            this.layers.get("trees-vri")?.traverse((child) => {
              if (
                !wallMat &&
                child.userData?.wallMaterial instanceof THREE.ShaderMaterial
              )
                wallMat = child.userData.wallMaterial;
            });
            if (wallMat) {
              wallMat.uniforms.uWallHeight.value = Math.max(
                0,
                typeof style.forestEmbossHeight === "number"
                  ? style.forestEmbossHeight
                  : 0,
              );
              if (typeof style.color === "string")
                wallMat.uniforms.uColor.value.set(style.color);
              wallMat.uniforms.uFogEnabled.value = affectedByFog ? 1 : 0;
              wallMat.uniforms.uFogFar.value =
                3 / Math.max(fogDensity, 0.00001);
            }
          }
          break;
      }
    });
    if (layerId === "hydrography-lakes") {
      this.applyStreamLakeOcclusion(opacity > 0.001);
    }
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

  private applyStreamLakeOcclusion(lakesVisible: boolean): void {
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
  ): void {
    return previewSceneSectionWindowImpl.call(this, axis, kind, valueM);
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

  getTransitionDebugState(): {
    active: boolean;
    sourcePageId: string | null;
    targetPageId: string | null;
    reason: NavigationReason | null;
    activeDataTransitionCount: number;
    snapshotCount: number;
    scalarTweenCount: number;
    layerTweenCount: number;
  } {
    const transition = this.activeSceneTransitionContext;
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
    };
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

  private activeScalarVolumeMesh(): THREE.Mesh | null {
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

  private activeSeismicVolumeMesh(): THREE.Mesh | null {
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

  private listMtVolumeCutIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID)
      return [];
    const mesh = this.activeScalarVolumeMesh();
    if (!mesh) return [];
    const productId =
      typeof mesh.userData.scalarVolumeProductId === "string"
        ? mesh.userData.scalarVolumeProductId
        : mesh.uuid;
    const productLabel =
      typeof mesh.userData.scalarVolumeProductLabel === "string"
        ? mesh.userData.scalarVolumeProductLabel
        : "MT volume";
    const sourceRange = Array.isArray(mesh.userData.scalarVolumeSourceRange)
      ? (mesh.userData.scalarVolumeSourceRange as number[])
      : [-2, 4.5];
    const scalarMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
    const scalarMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
    return this.sceneSectionActivePlanes(this.lastSceneSectionStyle).map(
      (plane) => ({
        targetKey: mtVolumeCutTargetKey(
          UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
          productId,
          plane.axis,
        ),
        layerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        sectionId: mtVolumeCutSectionId(productId, plane.axis),
        label: `${productLabel} ${plane.axis.toUpperCase()} cut`,
        kind: "MT volume cut",
        group: "mt-volume-cuts",
        groupLabel: "MT volume cuts",
        visible: true,
        scalarMin,
        scalarMax,
      }),
    );
  }

  private listSeismicVolumeCutIsoTargets(
    layerId?: string,
  ): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return [];
    const mesh = this.activeSeismicVolumeMesh();
    if (!mesh) return [];
    const productId =
      typeof mesh.userData.seismicProductId === "string"
        ? mesh.userData.seismicProductId
        : mesh.uuid;
    const productLabel =
      typeof mesh.userData.seismicProductLabel === "string"
        ? mesh.userData.seismicProductLabel
        : "Seismic volume";
    return this.sceneSectionActivePlanes(this.lastSceneSectionStyle).map(
      (plane) => ({
        targetKey: seismicVolumeCutTargetKey(
          UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
          productId,
          plane.axis,
        ),
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        sectionId: seismicVolumeCutSectionId(productId, plane.axis),
        label: `${productLabel} ${plane.axis.toUpperCase()} volume cut`,
        kind: "seismic volume cut",
        group: "seismic-volume-cuts",
        groupLabel: "Seismic volume cuts",
        visible: true,
        scalarMin: 0,
        scalarMax: 1,
      }),
    );
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
    if (
      id !== SHAHBAZI_GROUND_SURFACE_LAYER_ID ||
      !hasSurfaceGradientStyle(style)
    ) {
      return;
    }

    const group = this.layers.get(id);
    if (!group) return;

    const meshes: THREE.Mesh[] = [];
    let minZ = Infinity;
    let maxZ = -Infinity;

    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.userData?.meshPreview !== true) return;
      const position = obj.geometry.getAttribute("position");
      if (!(position instanceof THREE.BufferAttribute)) return;
      meshes.push(obj);
      for (let i = 0; i < position.count; i += 1) {
        const z = position.getZ(i);
        if (Number.isFinite(z)) {
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
        }
      }
    });

    if (
      meshes.length === 0 ||
      !Number.isFinite(minZ) ||
      !Number.isFinite(maxZ)
    ) {
      return;
    }

    const zRange = Math.max(0.0001, maxZ - minZ);
    const lowColor = styleColor(
      style,
      "surfaceGradientLowColor",
      DEFAULT_SURFACE_GRADIENT_LOW_COLOR,
    );
    const midColor = styleColor(
      style,
      "surfaceGradientMidColor",
      DEFAULT_SURFACE_GRADIENT_MID_COLOR,
    );
    const highColor = styleColor(
      style,
      "surfaceGradientHighColor",
      DEFAULT_SURFACE_GRADIENT_HIGH_COLOR,
    );
    const midpoint = styleNumber(
      style,
      "surfaceGradientMidpoint",
      0.5,
      0.05,
      0.95,
    );
    const contrast = styleNumber(
      style,
      "surfaceGradientContrast",
      1,
      0.35,
      2.5,
    );
    const scratch = new THREE.Color();

    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      const position = geometry.getAttribute("position");
      if (!(position instanceof THREE.BufferAttribute)) continue;

      let color = geometry.getAttribute("color");
      if (
        !(color instanceof THREE.BufferAttribute) ||
        color.count !== position.count
      ) {
        color = new THREE.BufferAttribute(
          new Float32Array(position.count * 3),
          3,
        );
        geometry.setAttribute("color", color);
      }

      for (let i = 0; i < position.count; i += 1) {
        surfaceGradientColorAt(
          (position.getZ(i) - minZ) / zRange,
          midpoint,
          contrast,
          lowColor,
          midColor,
          highColor,
          scratch,
        );
        color.setXYZ(i, scratch.r, scratch.g, scratch.b);
      }
      color.needsUpdate = true;

      const material = mesh.material;
      const materials = Array.isArray(material) ? material : [material];
      for (const m of materials) {
        if ("vertexColors" in m) {
          (m as THREE.Material & { vertexColors: boolean }).vertexColors = true;
          m.needsUpdate = true;
        }
      }
    }
  }

  applyMtTopSurfaceStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;

    const liftM = styleNumber(style, "meshSurfaceLiftM", 0, -12000, 12000);
    const wireframe = style.meshWireframe === true;
    const roughness = styleNumber(style, "meshRoughness", 0.72, 0, 1);
    const metalness = styleNumber(style, "meshMetalness", 0.02, 0, 1);
    const tint = styleColor(style, "color", "#ffffff");

    const liftedRoots = group.children.length > 0 ? group.children : [group];
    for (const child of liftedRoots) {
      const baseZ =
        typeof child.userData.mtTopSurfaceBaseZ === "number"
          ? child.userData.mtTopSurfaceBaseZ
          : child.position.z;
      child.userData.mtTopSurfaceBaseZ = baseZ;
      child.position.z = baseZ + liftM;
      child.updateMatrixWorld();
    }

    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const material = obj.material;
      const materials = Array.isArray(material) ? material : [material];
      for (const m of materials) {
        if (m.userData?.ignoreLayerStyle === true) continue;
        if ("wireframe" in m) {
          (m as THREE.Material & { wireframe: boolean }).wireframe = wireframe;
        }
        if ("roughness" in m) {
          (m as THREE.Material & { roughness: number }).roughness = roughness;
        }
        if ("metalness" in m) {
          (m as THREE.Material & { metalness: number }).metalness = metalness;
        }
        if ("color" in m) {
          (m as THREE.Material & { color: THREE.Color }).color.copy(tint);
        }
        m.needsUpdate = true;
      }
    });
  }

  applyScalarPreviewStyle(id: string, style: EditableStyle): void {
    applyScalarPreviewStyleToLayer.call(this, id, style);
  }

  applyPointMarkerStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_STATIONS_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;

    const defaultRadius =
      typeof group.userData.defaultMarkerRadiusM === "number"
        ? group.userData.defaultMarkerRadiusM
        : 1;
    const defaultLift =
      typeof group.userData.defaultMarkerLiftM === "number"
        ? group.userData.defaultMarkerLiftM
        : 0;
    const defaultLabelLift =
      typeof group.userData.defaultMarkerLabelLiftM === "number"
        ? group.userData.defaultMarkerLabelLiftM
        : 1;
    const radius = styleNumber(
      style,
      "pointMarkerRadiusM",
      defaultRadius,
      0.05,
      20000,
    );
    const lift = styleNumber(
      style,
      "pointMarkerLiftM",
      defaultLift,
      -20000,
      20000,
    );
    const labelLift = styleNumber(
      style,
      "pointMarkerLabelLiftM",
      defaultLabelLift,
      0,
      50000,
    );
    const selectedStationId =
      typeof style.mtStationQcSelectedStationId === "string"
        ? style.mtStationQcSelectedStationId
        : "";
    group.userData.mtStationQcSelectedStationId = selectedStationId;

    group.traverse((obj) => {
      if (obj.userData?.pointMarker === true && obj instanceof THREE.Mesh) {
        const baseRadius =
          typeof obj.userData.baseMarkerRadiusM === "number"
            ? obj.userData.baseMarkerRadiusM
            : defaultRadius;
        const scale = radius / Math.max(0.0001, baseRadius);
        obj.scale.setScalar(scale);
        const baseZ =
          typeof obj.userData.baseZ === "number"
            ? obj.userData.baseZ
            : obj.position.z;
        obj.position.z = baseZ + lift;
        const stationId =
          typeof obj.userData.sourceProperties?.stationId === "string"
            ? obj.userData.sourceProperties.stationId
            : typeof obj.userData.markerId === "string"
              ? obj.userData.markerId
              : "";
        const material = obj.material;
        const materials = Array.isArray(material) ? material : [material];
        for (const m of materials) {
          if ("color" in m) {
            (m as THREE.Material & { color: THREE.Color }).color.set(
              stationId && stationId === selectedStationId
                ? "#ffd34d"
                : (style.color ?? "#999999"),
            );
          }
          if ("emissive" in m) {
            (m as THREE.Material & { emissive: THREE.Color }).emissive.set(
              stationId && stationId === selectedStationId
                ? "#ff7a2c"
                : "#000000",
            );
          }
          m.needsUpdate = true;
        }
      }
      if (obj.userData?.pointMarkerLabelAnchor === true) {
        const baseZ =
          typeof obj.userData.baseZ === "number"
            ? obj.userData.baseZ
            : obj.position.z;
        obj.position.z = baseZ + lift + labelLift;
      }
    });
  }

  applyResistivitySliceStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    const horizontalVisible =
      style.resistivityHorizontalSlicesVisible !== false;
    const verticalVisible = style.resistivityVerticalSectionsVisible !== false;
    const topTraceVisible = style.resistivitySectionTopTraceVisible !== false;
    const sliceMode = style.resistivitySliceMode === "single" ? "single" : "stack";
    const selectedSliceId =
      typeof style.resistivitySelectedSliceId === "string"
        ? style.resistivitySelectedSliceId
        : DEFAULT_MT_RESISTIVITY_SLICE_ID;
    const perSlice =
      typeof style.resistivitySliceVisibility === "object" &&
      style.resistivitySliceVisibility !== null
        ? (style.resistivitySliceVisibility as Record<string, boolean>)
        : {};

    group.traverse((obj) => {
      if (
        obj.userData?.resistivitySlicePreview !== true &&
        obj.userData?.resistivitySectionTopTrace !== true
      ) {
        return;
      }
      const kind =
        typeof obj.userData.resistivitySliceKind === "string"
          ? obj.userData.resistivitySliceKind
          : "";
      const sliceId =
        typeof obj.userData.resistivitySliceId === "string"
          ? obj.userData.resistivitySliceId
          : "";
      const groupVisible =
        kind === "vertical-section" ? verticalVisible : horizontalVisible;
      const stackVisible =
        sliceMode === "stack" || sliceId === selectedSliceId;
      const roleVisible =
        obj.userData?.resistivitySectionTopTrace === true
          ? topTraceVisible
          : true;
      obj.visible =
        groupVisible && roleVisible && stackVisible && perSlice[sliceId] !== false;
    });
  }

  private scalarVolumeTransferModeCode(style: EditableStyle): number {
    if (style.scalarVolumeTransferMode === "soft") return 0;
    if (style.scalarVolumeTransferMode === "dense") return 2;
    return 1;
  }

  applyScalarVolumeStyle(id: string, style: EditableStyle): void {
    if (id !== UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;

    const products = Array.isArray(group.userData.scalarVolumeProducts)
      ? (group.userData.scalarVolumeProducts as Array<{ id?: unknown }>)
          .map((product) => product.id)
          .filter(
            (productId): productId is string => typeof productId === "string",
          )
      : [];
    const requested =
      typeof style.scalarVolumeProductId === "string"
        ? style.scalarVolumeProductId
        : typeof group.userData.scalarVolumeDefaultProductId === "string"
          ? group.userData.scalarVolumeDefaultProductId
          : products[0];
    const selectedProductId =
      requested && (products.length === 0 || products.includes(requested))
        ? requested
        : products[0];
    group.userData.scalarVolumeSelectedProductId = selectedProductId;

    const lowColor = styleColor(
      style,
      "scalarColorLow",
      DEFAULT_SCALAR_LOW_COLOR,
    );
    const midColor = styleColor(
      style,
      "scalarColorMid",
      DEFAULT_SCALAR_MID_COLOR,
    );
    const highColor = styleColor(
      style,
      "scalarColorHigh",
      DEFAULT_SCALAR_HIGH_COLOR,
    );
    const midpoint = styleNumber(style, "scalarMidpoint", 0.5, 0.05, 0.95);
    const contrast = styleNumber(style, "scalarContrast", 1.05, 0.35, 3);
    const opacity = styleNumber(
      style,
      "scalarVolumeOpacity",
      styleNumber(style, "opacity", 0.48, 0, 1),
      0,
      1,
    );
    const isoSourceOpacity =
      style.sectionIsoEnabled === true
        ? styleNumber(style, "sectionIsoSourceOpacity", 0, 0, 1)
        : 1;
    const renderOpacity = opacity * isoSourceOpacity;
    const density = styleNumber(style, "scalarVolumeDensity", 0.72, 0, 2);
    const sampleSteps = styleNumber(
      style,
      "scalarVolumeSampleSteps",
      112,
      24,
      192,
    );
    const maskVisible = style.scalarVolumeMaskVisible !== false ? 1 : 0;
    const transferMode = this.scalarVolumeTransferModeCode(style);

    group.traverse((obj) => {
      if (obj.userData?.scalarVolume !== true || !(obj instanceof THREE.Mesh))
        return;
      const productId =
        typeof obj.userData.scalarVolumeProductId === "string"
          ? obj.userData.scalarVolumeProductId
          : "";
      obj.visible = productId === selectedProductId;
      const material = obj.material;
      const materials = Array.isArray(material) ? material : [material];
      const sourceRange = Array.isArray(obj.userData.scalarVolumeSourceRange)
        ? (obj.userData.scalarVolumeSourceRange as number[])
        : [-2, 4.5];
      const displayRange = Array.isArray(obj.userData.scalarVolumeDisplayRange)
        ? (obj.userData.scalarVolumeDisplayRange as number[])
        : [0.139879, 3.937122];
      const sourceMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
      const sourceMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
      const displayMin = styleNumber(
        style,
        "scalarDisplayMin",
        Number.isFinite(displayRange[0]) ? displayRange[0] : 0.139879,
        -100,
        100,
      );
      const rawDisplayMax = styleNumber(
        style,
        "scalarDisplayMax",
        Number.isFinite(displayRange[1]) ? displayRange[1] : 3.937122,
        -100,
        100,
      );
      const displayMax = Math.max(rawDisplayMax, displayMin + 0.000001);
      const thresholdMin = styleNumber(
        style,
        "scalarVolumeThresholdMin",
        styleNumber(style, "scalarFocusMin", sourceMin, -100, 100),
        -100,
        100,
      );
      const rawThresholdMax = styleNumber(
        style,
        "scalarVolumeThresholdMax",
        styleNumber(style, "scalarFocusMax", sourceMax, -100, 100),
        -100,
        100,
      );
      const thresholdMax = Math.max(rawThresholdMax, thresholdMin + 0.000001);
      for (const m of materials) {
        if (!(m instanceof THREE.ShaderMaterial)) continue;
        const uniforms = m.uniforms;
        if (uniforms.uColorLow) uniforms.uColorLow.value.copy(lowColor);
        if (uniforms.uColorMid) uniforms.uColorMid.value.copy(midColor);
        if (uniforms.uColorHigh) uniforms.uColorHigh.value.copy(highColor);
        if (uniforms.uDisplayMin) uniforms.uDisplayMin.value = displayMin;
        if (uniforms.uDisplayMax) uniforms.uDisplayMax.value = displayMax;
        if (uniforms.uThresholdMin) uniforms.uThresholdMin.value = thresholdMin;
        if (uniforms.uThresholdMax) uniforms.uThresholdMax.value = thresholdMax;
        if (uniforms.uMidpoint) uniforms.uMidpoint.value = midpoint;
        if (uniforms.uContrast) uniforms.uContrast.value = contrast;
        if (uniforms.uOpacity) uniforms.uOpacity.value = renderOpacity;
        this.setProductOpacityBaseForMaterial(m, renderOpacity);
        if (uniforms.uDensity) uniforms.uDensity.value = density;
        if (uniforms.uSampleSteps) uniforms.uSampleSteps.value = sampleSteps;
        if (uniforms.uTransferMode) uniforms.uTransferMode.value = transferMode;
        if (uniforms.uMaskVisible) uniforms.uMaskVisible.value = maskVisible;
        m.userData.scalarVolumeUniformState = {
          productId,
          visible: obj.visible,
          displayMin,
          displayMax,
          thresholdMin,
          thresholdMax,
          opacity: renderOpacity,
          sourceOpacity: opacity,
          sectionIsoSourceOpacity: isoSourceOpacity,
          density,
          sampleSteps,
          transferMode,
          maskVisible,
        };
        m.needsUpdate = true;
      }
    });
    this.updateMtVolumeCutIsoOverlays(style);
  }

  private scalarVolumeIsoOverlayGroup(volumeLayer: THREE.Group): THREE.Group {
    const existing = volumeLayer.userData.mtVolumeSectionIsoOverlayGroup as
      | THREE.Group
      | undefined;
    if (existing && existing.parent === volumeLayer) return existing;
    const group = new THREE.Group();
    group.name = "mt-volume-section-iso-overlays";
    group.userData.ignoreLayerStyle = true;
    group.userData.sceneSectionHelper = true;
    group.userData.mtVolumeSectionIsoOverlayGroup = true;
    volumeLayer.userData.mtVolumeSectionIsoOverlayGroup = group;
    volumeLayer.add(group);
    return group;
  }

  private clearMtVolumeCutIsoOverlays(volumeLayer?: THREE.Group): void {
    const group = (
      volumeLayer ?? this.layers.get(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID)
    )?.userData.mtVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (!group) return;
    const parent = group.parent;
    if (parent) parent.remove(group);
    disposeObjectTree(group);
    if (volumeLayer) delete volumeLayer.userData.mtVolumeSectionIsoOverlayGroup;
  }

  private sampleScalarVolumeByte(
    bytes: Uint8Array,
    dimensions: [number, number, number],
    u: number,
    v: number,
    w: number,
  ): number {
    const [nx, ny, nz] = dimensions;
    const x = clampRange(u, 0, 1) * Math.max(0, nx - 1);
    const y = clampRange(v, 0, 1) * Math.max(0, ny - 1);
    const z = clampRange(w, 0, 1) * Math.max(0, nz - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);
    const x1 = Math.min(nx - 1, x0 + 1);
    const y1 = Math.min(ny - 1, y0 + 1);
    const z1 = Math.min(nz - 1, z0 + 1);
    const tx = x - x0;
    const ty = y - y0;
    const tz = z - z0;
    const sample = (ix: number, iy: number, iz: number): number => {
      const index = ix + nx * (iy + ny * iz);
      return bytes[index] ?? 0;
    };
    const c000 = sample(x0, y0, z0);
    const c100 = sample(x1, y0, z0);
    const c010 = sample(x0, y1, z0);
    const c110 = sample(x1, y1, z0);
    const c001 = sample(x0, y0, z1);
    const c101 = sample(x1, y0, z1);
    const c011 = sample(x0, y1, z1);
    const c111 = sample(x1, y1, z1);
    const c00 = c000 + (c100 - c000) * tx;
    const c10 = c010 + (c110 - c010) * tx;
    const c01 = c001 + (c101 - c001) * tx;
    const c11 = c011 + (c111 - c011) * tx;
    const c0 = c00 + (c10 - c00) * ty;
    const c1 = c01 + (c11 - c01) * ty;
    return c0 + (c1 - c0) * tz;
  }

  private buildMtVolumeCutMesh(
    mesh: THREE.Mesh,
    plane: ResolvedSceneSectionPlane,
    options: {
      sourceMin: number;
      sourceMax: number;
      thresholdMin: number;
      thresholdMax: number;
      maskVisible: boolean;
      targetKey: string;
      sectionWindow?: ResolvedSceneSectionWindow | null;
    },
  ): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
  } | null {
    const dimensions = Array.isArray(mesh.userData.scalarVolumeDimensions)
      ? (mesh.userData.scalarVolumeDimensions as [number, number, number])
      : null;
    const bounds = mesh.userData.scalarVolumeBounds as
      | { min?: [number, number, number]; max?: [number, number, number] }
      | undefined;
    const volumeData = mesh.userData.scalarVolumeData as Uint8Array | undefined;
    const maskData = mesh.userData.scalarVolumeMaskData as
      | Uint8Array
      | undefined;
    if (!dimensions || !bounds?.min || !bounds.max || !volumeData) return null;
    const [nx, ny, nz] = dimensions;
    if (nx <= 1 || ny <= 1 || nz <= 1) return null;

    const min = bounds.min;
    const max = bounds.max;
    const axisIndex = plane.axis === "x" ? 0 : plane.axis === "y" ? 1 : 2;
    if (plane.positionM < min[axisIndex] || plane.positionM > max[axisIndex]) {
      return null;
    }

    const grid = MT_VOLUME_SECTION_ISO_GRID_SIZE;
    const positions = new Float32Array(grid * grid * 3);
    const values = new Float32Array(grid * grid);
    const alphaValues = new Float32Array(grid * grid);
    const axisA = plane.axis === "x" ? 1 : 0;
    const axisB = plane.axis === "z" ? 1 : 2;
    const coords = [0, 0, 0];

    for (let j = 0; j < grid; j += 1) {
      const bT = j / (grid - 1);
      for (let i = 0; i < grid; i += 1) {
        const aT = i / (grid - 1);
        coords[axisIndex] = plane.positionM;
        coords[axisA] = min[axisA] + (max[axisA] - min[axisA]) * aT;
        coords[axisB] = min[axisB] + (max[axisB] - min[axisB]) * bT;
        const vertexIndex = i + j * grid;
        positions[vertexIndex * 3] = coords[0];
        positions[vertexIndex * 3 + 1] = coords[1];
        positions[vertexIndex * 3 + 2] = coords[2];
        const insideSectionWindow =
          !options.sectionWindow ||
          (coords[options.sectionWindow.alongIndex] >=
            options.sectionWindow.minAlongM &&
            coords[options.sectionWindow.alongIndex] <=
              options.sectionWindow.maxAlongM &&
            coords[2] >= options.sectionWindow.bottomElevationM);
        const u = (coords[0] - min[0]) / Math.max(0.000001, max[0] - min[0]);
        const v = (coords[1] - min[1]) / Math.max(0.000001, max[1] - min[1]);
        const w = (coords[2] - min[2]) / Math.max(0.000001, max[2] - min[2]);
        const normalized =
          this.sampleScalarVolumeByte(volumeData, dimensions, u, v, w) / 255;
        const scalar =
          options.sourceMin +
          normalized * (options.sourceMax - options.sourceMin);
        const mask =
          options.maskVisible && maskData
            ? this.sampleScalarVolumeByte(maskData, dimensions, u, v, w) / 255
            : 1;
        values[vertexIndex] = scalar;
        alphaValues[vertexIndex] =
          insideSectionWindow &&
          scalar >= options.thresholdMin &&
          scalar <= options.thresholdMax &&
          mask > 0.01
            ? mask
            : 0;
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < grid - 1; j += 1) {
      for (let i = 0; i < grid - 1; i += 1) {
        const a = i + j * grid;
        const b = i + 1 + j * grid;
        const c = i + (j + 1) * grid;
        const d = i + 1 + (j + 1) * grid;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
    });
    material.userData.ignoreLayerStyle = true;
    material.userData.sceneSectionHelper = true;
    const cut = new THREE.Mesh(geometry, material);
    cut.name = `${plane.axis.toUpperCase()} MT volume ISO cut`;
    cut.userData.ignoreLayerStyle = true;
    cut.userData.sceneSectionHelper = true;
    cut.userData.sectionIsoTargetKey = options.targetKey;
    cut.userData.sectionIsoPlaneAxis = plane.axis;
    cut.userData.sectionIsoPlanePositionM = plane.positionM;
    return { mesh: cut, values, alphaValues };
  }

  private updateMtVolumeCutIsoOverlays(style: EditableStyle): void {
    const volumeLayer = this.layers.get(
      UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
    );
    if (!volumeLayer) return;
    this.clearMtVolumeCutIsoOverlays(volumeLayer);
    if (style.sectionIsoEnabled !== true || !volumeLayer.visible) return;
    const mesh = this.activeScalarVolumeMesh();
    if (!mesh) return;
    const planes = this.sceneSectionActivePlanes(this.lastSceneSectionStyle);
    if (planes.length === 0) return;
    const sectionBounds = this.sceneSectionBounds(
      this.lastSceneSectionStyle,
      this.sceneSectionLayerIds(this.lastSceneSectionStyle),
      this.sceneSectionProductIds(this.lastSceneSectionStyle),
    );
    const sectionWindow = this.resolveSceneSectionWindow(
      this.lastSceneSectionStyle,
      sectionBounds,
    );

    const productId =
      typeof mesh.userData.scalarVolumeProductId === "string"
        ? mesh.userData.scalarVolumeProductId
        : mesh.uuid;
    const selectedTargets =
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? (style.sectionIsoTargetIds as Record<string, boolean>)
        : {};
    const sourceRange = Array.isArray(mesh.userData.scalarVolumeSourceRange)
      ? (mesh.userData.scalarVolumeSourceRange as number[])
      : [-2, 4.5];
    const displayRange = Array.isArray(mesh.userData.scalarVolumeDisplayRange)
      ? (mesh.userData.scalarVolumeDisplayRange as number[])
      : [sourceRange[0], sourceRange[1]];
    const sourceMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
    const sourceMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
    const displayMin = styleNumber(
      style,
      "scalarDisplayMin",
      Number.isFinite(displayRange[0]) ? displayRange[0] : sourceMin,
      -100,
      100,
    );
    const displayMax = Math.max(
      styleNumber(
        style,
        "scalarDisplayMax",
        Number.isFinite(displayRange[1]) ? displayRange[1] : sourceMax,
        -100,
        100,
      ),
      displayMin + 0.000001,
    );
    const thresholdMin = styleNumber(
      style,
      "scalarVolumeThresholdMin",
      styleNumber(style, "scalarFocusMin", sourceMin, -100, 100),
      -100,
      100,
    );
    const thresholdMax = Math.max(
      styleNumber(
        style,
        "scalarVolumeThresholdMax",
        styleNumber(style, "scalarFocusMax", sourceMax, -100, 100),
        -100,
        100,
      ),
      thresholdMin + 0.000001,
    );
    const isoMin = clampRange(
      styleNumber(style, "sectionIsoMin", thresholdMin, sourceMin, sourceMax),
      sourceMin,
      sourceMax,
    );
    const isoMax = clampRange(
      Math.max(
        styleNumber(style, "sectionIsoMax", thresholdMax, sourceMin, sourceMax),
        isoMin + 0.000001,
      ),
      isoMin + 0.000001,
      sourceMax,
    );
    const baseOptions = {
      layerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
      enabled: true,
      linesVisible: style.sectionIsoLinesVisible !== false,
      bandsVisible: style.sectionIsoBandsVisible !== false,
      selectedTargetIds: selectedTargets,
      isoMin,
      isoMax,
      levelCount: Math.round(
        styleNumber(style, "sectionIsoLevelCount", 5, 2, 32),
      ),
      lineWidth: styleNumber(style, "sectionIsoLineWidth", 2.6, 0, 12),
      lineStyle: style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid",
      bandOpacity: styleNumber(style, "sectionIsoBandOpacity", 0.32, 0, 0.85),
      fillOffset: styleNumber(style, "sectionIsoFillOffset", 0, -1, 1),
      colorMin: displayMin,
      colorMax: displayMax,
      midpoint: styleNumber(style, "scalarMidpoint", 0.5, 0.05, 0.95),
      contrast: styleNumber(style, "scalarContrast", 1.05, 0.35, 3),
      lowColor: styleColor(style, "scalarColorLow", DEFAULT_SCALAR_LOW_COLOR),
      midColor: styleColor(style, "scalarColorMid", DEFAULT_SCALAR_MID_COLOR),
      highColor: styleColor(
        style,
        "scalarColorHigh",
        DEFAULT_SCALAR_HIGH_COLOR,
      ),
      skipSceneSectionClipping: true,
    } satisfies Omit<ScalarSectionIsoOptions, "targetKey" | "alphaValues">;

    const overlayGroup = this.scalarVolumeIsoOverlayGroup(volumeLayer);
    for (const plane of planes) {
      const targetKey = mtVolumeCutTargetKey(
        UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        productId,
        plane.axis,
      );
      if (selectedTargets[targetKey] === false) continue;
      const cut = this.buildMtVolumeCutMesh(mesh, plane, {
        sourceMin,
        sourceMax,
        thresholdMin,
        thresholdMax,
        maskVisible: style.scalarVolumeMaskVisible !== false,
        targetKey,
        sectionWindow:
          sectionWindow && sectionWindow.axis === plane.axis
            ? sectionWindow
            : null,
      });
      if (!cut) continue;
      updateScalarSectionIsoOverlay(cut.mesh, cut.values, {
        ...baseOptions,
        targetKey,
        alphaValues: cut.alphaValues,
      });
      if (cut.mesh.userData.scalarSectionIsoOverlayRoot) {
        overlayGroup.add(cut.mesh);
      } else {
        disposeObjectTree(cut.mesh);
      }
    }
    if (overlayGroup.children.length === 0) {
      this.clearMtVolumeCutIsoOverlays(volumeLayer);
    }
  }

  private seismicVolumeIsoOverlayGroup(seismicLayer: THREE.Group): THREE.Group {
    const existing = seismicLayer.userData
      .seismicVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (existing && existing.parent === seismicLayer) return existing;
    const group = new THREE.Group();
    group.name = "seismic-volume-section-iso-overlays";
    group.userData.ignoreLayerStyle = true;
    group.userData.sceneSectionHelper = true;
    group.userData.seismicVolumeSectionIsoOverlayGroup = true;
    seismicLayer.userData.seismicVolumeSectionIsoOverlayGroup = group;
    seismicLayer.add(group);
    return group;
  }

  private clearSeismicVolumeCutIsoOverlays(seismicLayer?: THREE.Group): void {
    const group = (
      seismicLayer ?? this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
    )?.userData.seismicVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (!group) return;
    const parent = group.parent;
    if (parent) parent.remove(group);
    disposeObjectTree(group);
    if (seismicLayer) {
      delete seismicLayer.userData.seismicVolumeSectionIsoOverlayGroup;
    }
  }

  private buildSeismicVolumeCutMesh(
    mesh: THREE.Mesh,
    plane: ResolvedSceneSectionPlane,
    options: {
      amplitudeMin: number;
      amplitudeMax: number;
      amplitudeGamma: number;
      removeBackground: boolean;
      backgroundCutoff: number;
      targetKey: string;
    },
  ): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
  } | null {
    const dimensions = Array.isArray(mesh.userData.seismicVolumeDimensions)
      ? (mesh.userData.seismicVolumeDimensions as [number, number, number])
      : null;
    const bounds =
      (mesh.userData.seismicVolumeCurrentBounds as
        | { min?: [number, number, number]; max?: [number, number, number] }
        | undefined) ??
      (mesh.userData.seismicVolumeBaseBounds as
        | { min?: [number, number, number]; max?: [number, number, number] }
        | undefined);
    const volumeData = mesh.userData.seismicVolumeData as
      | Uint8Array
      | undefined;
    if (!dimensions || !bounds?.min || !bounds.max || !volumeData) return null;
    const [nx, ny, nz] = dimensions;
    if (nx <= 1 || ny <= 1 || nz <= 1) return null;

    const min = bounds.min;
    const max = bounds.max;
    const axisIndex = plane.axis === "x" ? 0 : plane.axis === "y" ? 1 : 2;
    if (plane.positionM < min[axisIndex] || plane.positionM > max[axisIndex]) {
      return null;
    }

    const grid = MT_VOLUME_SECTION_ISO_GRID_SIZE;
    const positions = new Float32Array(grid * grid * 3);
    const values = new Float32Array(grid * grid);
    const alphaValues = new Float32Array(grid * grid);
    const axisA = plane.axis === "x" ? 1 : 0;
    const axisB = plane.axis === "z" ? 1 : 2;
    const coords = [0, 0, 0];

    for (let j = 0; j < grid; j += 1) {
      const bT = j / (grid - 1);
      for (let i = 0; i < grid; i += 1) {
        const aT = i / (grid - 1);
        coords[axisIndex] = plane.positionM;
        coords[axisA] = min[axisA] + (max[axisA] - min[axisA]) * aT;
        coords[axisB] = min[axisB] + (max[axisB] - min[axisB]) * bT;
        const vertexIndex = i + j * grid;
        positions[vertexIndex * 3] = coords[0];
        positions[vertexIndex * 3 + 1] = coords[1];
        positions[vertexIndex * 3 + 2] = coords[2];
        const u = (coords[0] - min[0]) / Math.max(0.000001, max[0] - min[0]);
        const v = (coords[1] - min[1]) / Math.max(0.000001, max[1] - min[1]);
        const w = (coords[2] - min[2]) / Math.max(0.000001, max[2] - min[2]);
        const amplitude =
          this.sampleScalarVolumeByte(volumeData, dimensions, u, v, w) / 255;
        values[vertexIndex] = amplitude;
        alphaValues[vertexIndex] = seismicBackgroundAlphaAt(
          amplitude,
          options.amplitudeMin,
          options.amplitudeMax,
          options.removeBackground,
          options.amplitudeGamma,
          options.backgroundCutoff,
        );
      }
    }

    const indices: number[] = [];
    for (let j = 0; j < grid - 1; j += 1) {
      for (let i = 0; i < grid - 1; i += 1) {
        const a = i + j * grid;
        const b = i + 1 + j * grid;
        const c = i + (j + 1) * grid;
        const d = i + 1 + (j + 1) * grid;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
    });
    material.userData.ignoreLayerStyle = true;
    material.userData.sceneSectionHelper = true;
    const cut = new THREE.Mesh(geometry, material);
    cut.name = `${plane.axis.toUpperCase()} seismic volume ISO cut`;
    cut.userData.ignoreLayerStyle = true;
    cut.userData.sceneSectionHelper = true;
    cut.userData.sectionIsoTargetKey = options.targetKey;
    cut.userData.sectionIsoPlaneAxis = plane.axis;
    cut.userData.sectionIsoPlanePositionM = plane.positionM;
    return { mesh: cut, values, alphaValues };
  }

  updateSeismicVolumeCutIsoOverlays(style: EditableStyle): void {
    const seismicLayer = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!seismicLayer) return;
    this.clearSeismicVolumeCutIsoOverlays(seismicLayer);
    if (style.sectionIsoEnabled !== true || !seismicLayer.visible) return;
    const mesh = this.activeSeismicVolumeMesh();
    if (!mesh) return;
    const planes = this.sceneSectionActivePlanes(this.lastSceneSectionStyle);
    if (planes.length === 0) return;

    const productId =
      typeof mesh.userData.seismicProductId === "string"
        ? mesh.userData.seismicProductId
        : mesh.uuid;
    const selectedTargets =
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? (style.sectionIsoTargetIds as Record<string, boolean>)
        : {};
    const amplitudeMin = styleNumber(style, "seismicAmplitudeMin", 0.08, 0, 1);
    const amplitudeMax = Math.max(
      amplitudeMin + 0.001,
      styleNumber(style, "seismicAmplitudeMax", 0.92, 0, 1),
    );
    const amplitudeGamma = styleNumber(
      style,
      "seismicAmplitudeGamma",
      1,
      0.35,
      2.5,
    );
    const removeBackground = style.seismicRemoveBackground === true;
    const backgroundCutoff = styleNumber(
      style,
      "seismicBackgroundCutoff",
      0.16,
      0,
      0.45,
    );
    const rawIsoMin = styleNumber(style, "sectionIsoMin", amplitudeMin, 0, 1);
    const isoMin = clampRange(rawIsoMin, 0, 1);
    const rawIsoMax = styleNumber(style, "sectionIsoMax", amplitudeMax, 0, 1);
    const isoMax = clampRange(
      Math.max(rawIsoMax, isoMin + 0.000001),
      isoMin + 0.000001,
      1,
    );
    const colormap =
      style.seismicColormap === "grayscale" ||
      style.seismicColormap === "velocity"
        ? style.seismicColormap
        : "blue-white-red";
    const colorMode =
      colormap === "grayscale"
        ? "seismic-grayscale"
        : colormap === "velocity"
          ? "seismic-velocity"
          : "seismic-blue-white-red";
    const baseOptions = {
      layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
      enabled: true,
      linesVisible: style.sectionIsoLinesVisible !== false,
      bandsVisible: style.sectionIsoBandsVisible !== false,
      selectedTargetIds: selectedTargets,
      isoMin,
      isoMax,
      levelCount: Math.round(
        styleNumber(style, "sectionIsoLevelCount", 5, 2, 32),
      ),
      lineWidth: styleNumber(style, "sectionIsoLineWidth", 2.6, 0, 12),
      lineStyle: style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid",
      bandOpacity: styleNumber(style, "sectionIsoBandOpacity", 0.32, 0, 0.85),
      fillOffset: styleNumber(style, "sectionIsoFillOffset", 0, -1, 1),
      colorMode,
      amplitudeGamma,
      colorMin: amplitudeMin,
      colorMax: amplitudeMax,
      midpoint: 0.5,
      contrast: 1,
      lowColor: new THREE.Color(DEFAULT_SEISMIC_LOW_COLOR),
      midColor: new THREE.Color(DEFAULT_SEISMIC_MID_COLOR),
      highColor: new THREE.Color(DEFAULT_SEISMIC_HIGH_COLOR),
      skipSceneSectionClipping: true,
    } satisfies Omit<ScalarSectionIsoOptions, "targetKey" | "alphaValues">;

    const overlayGroup = this.seismicVolumeIsoOverlayGroup(seismicLayer);
    for (const plane of planes) {
      const targetKey = seismicVolumeCutTargetKey(
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        productId,
        plane.axis,
      );
      if (selectedTargets[targetKey] === false) continue;
      const cut = this.buildSeismicVolumeCutMesh(mesh, plane, {
        amplitudeMin,
        amplitudeMax,
        amplitudeGamma,
        removeBackground,
        backgroundCutoff,
        targetKey,
      });
      if (!cut) continue;
      updateScalarSectionIsoOverlay(cut.mesh, cut.values, {
        ...baseOptions,
        targetKey,
        alphaValues: cut.alphaValues,
      });
      if (cut.mesh.userData.scalarSectionIsoOverlayRoot) {
        overlayGroup.add(cut.mesh);
      } else {
        disposeObjectTree(cut.mesh);
      }
    }
    if (overlayGroup.children.length === 0) {
      this.clearSeismicVolumeCutIsoOverlays(seismicLayer);
    }
  }

  private mtSurfaceBoundaryDefinitionsFromGroup(
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

  private ensureLiveMtSurfaceBoundaries(
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
    if (id !== UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID) return;
    const group = this.layers.get(id);
    if (!group) return;
    const boundaries = resolveMtSurfaceBoundaries(
      style,
      this.mtSurfaceBoundaryDefinitionsFromGroup(group),
    );
    const boundaryById = new Map(
      boundaries.map((boundary) => [boundary.id, boundary]),
    );
    const wireframe = style.mtThresholdSurfaceWireframe === true;
    const opacity = styleNumber(style, "opacity", 0.86, 0, 1);
    const roughness = styleNumber(
      style,
      "mtThresholdSurfaceRoughness",
      0.64,
      0,
      1,
    );
    const metalness = styleNumber(
      style,
      "mtThresholdSurfaceMetalness",
      0,
      0,
      1,
    );
    const smoothNormals = style.mtThresholdSurfaceSmoothNormals !== false;
    const emissiveBoost = styleNumber(
      style,
      "mtThresholdSurfaceEmissiveBoost",
      0.08,
      0,
      1,
    );
    const side =
      style.mtThresholdSurfaceSide === "front"
        ? THREE.FrontSide
        : THREE.DoubleSide;
    const wireframeColor = styleColor(
      style,
      "mtThresholdSurfaceWireframeColor",
      "#f8f4e8",
    );
    const wireframeOpacity = styleNumber(
      style,
      "mtThresholdSurfaceWireframeOpacity",
      0.42,
      0,
      1,
    );
    const selectedProductId =
      typeof style.mtIsosurfaceProductId === "string"
        ? style.mtIsosurfaceProductId
        : "mt-isosurface-forge-focused";
    this.ensureLiveMtSurfaceBoundaries(
      group,
      selectedProductId,
      boundaries,
      style,
    );
    group.traverse((obj) => {
      if (obj.userData?.mtThresholdSurfacePreview !== true) return;
      const productId =
        typeof obj.userData.mtIsosurfaceProductId === "string"
          ? obj.userData.mtIsosurfaceProductId
          : "";
      const surfaceId =
        typeof obj.userData.mtThresholdSurfaceId === "string"
          ? obj.userData.mtThresholdSurfaceId
          : "";
      const productVisible =
        productId.length === 0 || productId === selectedProductId;
      const boundary = boundaryById.get(surfaceId);
      obj.visible = productVisible && boundary?.visible === true;
      const material = (obj as { material?: THREE.Material | THREE.Material[] })
        .material;
      const materials = Array.isArray(material)
        ? material
        : material
          ? [material]
          : [];
      for (const m of materials) {
        if ("wireframe" in m) {
          (m as THREE.Material & { wireframe: boolean }).wireframe = wireframe;
        }
        if ("vertexColors" in m) {
          (m as THREE.Material & { vertexColors: boolean }).vertexColors =
            false;
        }
        if ("roughness" in m) {
          (m as THREE.Material & { roughness: number }).roughness = roughness;
        }
        if ("metalness" in m) {
          (m as THREE.Material & { metalness: number }).metalness = metalness;
        }
        if ("flatShading" in m) {
          (m as THREE.Material & { flatShading: boolean }).flatShading =
            !smoothNormals;
        }
        if ("emissive" in m) {
          (m as THREE.Material & { emissive: THREE.Color }).emissive.set(
            0xffffff,
          );
        }
        if ("emissiveIntensity" in m) {
          (m as THREE.Material & { emissiveIntensity: number }).emissiveIntensity =
            wireframe ? 0 : emissiveBoost;
        }
        if ("color" in m && wireframe) {
          (m as THREE.Material & { color: THREE.Color }).color.copy(
            wireframeColor,
          );
        } else if ("color" in m) {
          (m as THREE.Material & { color: THREE.Color }).color.set(
            boundary?.color ?? "#ffffff",
          );
        }
        m.side = side;
        m.opacity = wireframe
          ? wireframeOpacity
          : opacity * (boundary?.opacity ?? 1);
        m.transparent = true;
        m.depthWrite = !wireframe;
        m.depthTest = true;
        m.needsUpdate = true;
      }
    });
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
    environment: EnvironmentSetup,
    fromPage: PresentationPage,
    toPage: PresentationPage,
    durationMs: number = DEFAULT_LAYER_FADE_MS,
    easing: EasingName = "easeInOutCubic",
    scalarStyleDurationMs: number = durationMs,
    scalarStyleEasing: EasingName = easing,
    reason: NavigationReason = "programmatic",
  ): void {
    const layerIds = new Set<string>([
      ...this.layers.keys(),
      ...Object.keys(CASE_STUDY_B_DEMO_LAYER_ALIASES),
    ]);
    const sourceLayers = this.captureLayerRenderStates(
      environment,
      fromPage,
      layerIds,
    );
    this.layerTweens.clear();
    this.scalarStyleTweens.clear();
    this.workingAreaFocusTween = null;
    this.sceneSectionStyleTween = null;
    this.sceneSectionHelperTransitionOpacity = 1;
    this.clearLayerTransitionSnapshots();
    this.lastEffectiveEnv = environment;
    this.lastEffectivePage = toPage;

    const toVisible = effectiveVisibility(environment, toPage);
    this.currentVisibleLayerIds = toVisible;
    const sourceVisibleLayerIds = new Set<string>();
    for (const [id, state] of sourceLayers) {
      if (state.visible && state.opacity > 0.001) {
        sourceVisibleLayerIds.add(id);
      }
    }
    const now = performance.now();
    const duration = Math.max(0, durationMs);
    const terrainOverrides = new Map<string, number>();
    const layerKinds: Record<string, LayerTransitionKind> = {};
    this.activeSceneTransitionContext = {
      sourcePageId: fromPage.id,
      targetPageId: toPage.id,
      reason,
      startMs: now,
      durationMs: duration,
      easing,
      layerKinds,
      sourceLayers,
      sourceVisibleLayerIds,
      targetVisibleLayerIds: new Set(toVisible),
      warnedUnexpectedVisibleLayerIds: new Set(),
    };

    const fromSceneSectionStyle = effectiveStyle(
      environment,
      fromPage,
      UTAH_FORGE_SCENE_SECTION_LAYER_ID,
    );
    const targetSceneSectionStyle = effectiveStyle(
      environment,
      toPage,
      UTAH_FORGE_SCENE_SECTION_LAYER_ID,
    );
    const sceneSectionStyleChanged = sceneSectionTransitionStyleChanged(
      fromSceneSectionStyle,
      targetSceneSectionStyle,
    );
    const sceneSectionDiscreteChanged =
      sceneSectionStyleChanged &&
      sceneSectionDiscreteStyleChanged(
        fromSceneSectionStyle,
        targetSceneSectionStyle,
      );
    if (sceneSectionStyleChanged && duration > 0) {
      this.sceneSectionStyleTween = {
        fromStyle: fromSceneSectionStyle,
        toStyle: targetSceneSectionStyle,
        startMs: now,
        durationMs: duration,
        easing,
        discreteChanged: sceneSectionDiscreteChanged,
      };
      this.sceneSectionHelperTransitionOpacity =
        this.sceneSectionHelperOpacityForTween(this.sceneSectionStyleTween, 0);
    }

    this.sceneSectionReapplySuspended = true;
    try {
      for (const id of layerIds) {
        const sourceState = sourceLayers.get(id);
        const fromOpacity = sourceState?.opacity ?? 0;
        const toOpacity = toVisible.has(id)
          ? this.targetOpacityForLayer(environment, toPage, id)
          : 0;
        const fromStyle =
          sourceState?.style ?? effectiveStyle(environment, fromPage, id);
        const targetStyle = effectiveStyle(environment, toPage, id);
        const group = this.layers.get(id);
        if (group) group.visible = fromOpacity > 0.001 || toOpacity > 0.001;
        const shouldCrossfadeDiscreteData =
          !!group &&
          duration > 0 &&
          fromOpacity > 0.001 &&
          forgeDiscreteDataStyleChanged(
            id,
            fromStyle,
            targetStyle,
            this.layerSpecFor(id),
          );
        const shouldCrossfadeSceneSection =
          !!group &&
          duration > 0 &&
          sceneSectionDiscreteChanged &&
          fromOpacity > 0.001 &&
          SCENE_SECTION_AFFECTED_LAYER_IDS.has(id);
        const shouldTweenScalarStyle =
          !!group &&
          !shouldCrossfadeDiscreteData &&
          !shouldCrossfadeSceneSection &&
          scalarStyleDurationMs > 0 &&
          fromOpacity > 0.001 &&
          toOpacity > 0.001 &&
          this.layerSupportsScalarStyleTween(id, group) &&
          scalarTransitionStyleChanged(fromStyle, targetStyle);
        const shouldCrossfadeScalarStyle =
          !!group &&
          duration > 0 &&
          fromOpacity > 0.001 &&
          this.layerHasScalarPreviewData(group) &&
          !toVisible.has(id);
        const transitionSnapshot =
          shouldCrossfadeDiscreteData ||
          shouldCrossfadeScalarStyle ||
          shouldCrossfadeSceneSection
            ? this.cloneLayerTransitionSnapshot(id, group)
            : null;
        const transitionKind: LayerTransitionKind =
          shouldCrossfadeDiscreteData ||
          shouldCrossfadeScalarStyle ||
          shouldCrossfadeSceneSection
            ? "discrete-crossfade"
            : shouldTweenScalarStyle
              ? id === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID
                ? "full-density-scalar"
                : "continuous"
              : "none";
        layerKinds[id] = transitionKind;

        // Apply target page colour/provenance-style immediately, but restore the
        // visual opacity to the old page value before the fade begins.
        this.applyStyle(id, shouldTweenScalarStyle ? fromStyle : targetStyle);
        if (shouldTweenScalarStyle) {
          this.scalarStyleTweens.set(id, {
            id,
            from: 0,
            to: 1,
            fromStyle,
            toStyle: targetStyle,
            startMs: now,
            durationMs: Math.max(0, scalarStyleDurationMs),
            easing: scalarStyleEasing,
          });
        }
        if (transitionSnapshot) {
          this.applyRenderOpacityToTree(transitionSnapshot, fromOpacity);
          this.applyLayerRenderOpacity(id, 0);
          this.layerTweens.set(id, {
            from: 0,
            to: toOpacity,
            startMs: now,
            durationMs: duration,
            easing,
          });
          this.layerTransitionSnapshots.set(id, {
            id,
            group: transitionSnapshot,
            from: fromOpacity,
            to: 0,
            style: fromStyle,
            startMs: now,
            durationMs: duration,
            easing,
          });
          terrainOverrides.set(id, 0);
          continue;
        }
        this.applyLayerRenderOpacity(id, fromOpacity);
        terrainOverrides.set(id, fromOpacity);

        if (duration <= 0 || Math.abs(fromOpacity - toOpacity) < 0.001) {
          this.applyLayerRenderOpacity(id, toOpacity);
          terrainOverrides.set(id, toOpacity);
          continue;
        }

        this.layerTweens.set(id, {
          from: fromOpacity,
          to: toOpacity,
          startMs: now,
          durationMs: duration,
          easing,
        });
      }
    } finally {
      this.sceneSectionReapplySuspended = false;
    }
    this.reapplySceneSectionPlanes();

    this.transitionWorkingAreaFocusForPage(
      environment,
      fromPage,
      toPage,
      duration,
      easing,
    );

    // Terrain-composite layers (lakes, targets, claims, geology, forest cover)
    // render part of their visual fill through terrain uniforms, not just group
    // materials.
    // This call sets their target colours while preserving old-page opacities;
    // frameUpdate then fades the same uniforms alongside regular materials.
    this.applyLakesToTerrain(environment, toPage, terrainOverrides);
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
    if (this.activeSceneTransitionContext) {
      this.enforceTransitionVisibilityEnvelope();
      this.reapplySceneSectionPlanes();
      return;
    }
    const env = this.lastEnv ?? this.lastEffectiveEnv;
    const page = this.lastEffectivePage;
    if (env) this.applyEnvironment(env);
    if (env && page) {
      this.applyEffectiveVisibilityForPage(env, page);
      this.applyEffectiveStylesForPage(env, page);
      this.applyPageScene(page);
    }
  }

  private warnUnexpectedTransitionLayer(id: string): void {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return;
    if (transition.warnedUnexpectedVisibleLayerIds.has(id)) return;
    transition.warnedUnexpectedVisibleLayerIds.add(id);
    console.warn(
      `[SceneManager] layer "${id}" became visible outside the page-transition envelope`,
      {
        sourcePageId: transition.sourcePageId,
        targetPageId: transition.targetPageId,
        reason: transition.reason,
      },
    );
  }

  private transitionEnvelopeAllowsLayer(id: string): boolean {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return true;
    return (
      transition.sourceVisibleLayerIds.has(id) ||
      transition.targetVisibleLayerIds.has(id) ||
      this.layerTransitionSnapshots.has(id)
    );
  }

  private transitionFrameOpacityForLayer(id: string): number {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return 0;
    const elapsed =
      transition.durationMs <= 0
        ? 1
        : (performance.now() - transition.startMs) / transition.durationMs;
    const t = elapsed >= 1 ? 1 : easeProgress(elapsed, transition.easing);
    const from = transition.sourceLayers.get(id)?.opacity ?? 0;
    const to =
      transition.targetVisibleLayerIds.has(id) &&
      this.lastEffectiveEnv &&
      this.lastEffectivePage
        ? this.targetOpacityForLayer(
            this.lastEffectiveEnv,
            this.lastEffectivePage,
            id,
          )
        : 0;
    return from + (to - from) * clamp01(t);
  }

  private enforceTransitionVisibilityEnvelope(): void {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return;
    for (const [id, group] of this.layers) {
      if (this.transitionEnvelopeAllowsLayer(id)) {
        if (
          !this.layerTweens.has(id) &&
          !this.layerTransitionSnapshots.has(id)
        ) {
          this.applyLayerRenderOpacity(
            id,
            this.transitionFrameOpacityForLayer(id),
          );
        }
        continue;
      }
      if (group.visible) this.warnUnexpectedTransitionLayer(id);
      this.applyLayerRenderOpacity(id, 0);
    }
  }

  private tickLayerTweens(nowMs: number): void {
    if (
      this.layerTweens.size === 0 &&
      this.scalarStyleTweens.size === 0 &&
      this.layerTransitionSnapshots.size === 0 &&
      !this.sceneSectionStyleTween &&
      !this.workingAreaFocusTween &&
      !this.activeSceneTransitionContext
    ) {
      return;
    }
    if (this.sceneSectionStyleTween) {
      const tween = this.sceneSectionStyleTween;
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      const style = done
        ? tween.toStyle
        : tween.discreteChanged
          ? tween.toStyle
          : this.interpolatedSceneSectionStyle(
              tween.fromStyle,
              tween.toStyle,
              eased,
            );
      this.sceneSectionHelperTransitionOpacity = done
        ? 1
        : this.sceneSectionHelperOpacityForTween(tween, eased);
      this.applySceneSectionPlanes(style);
      if (done) {
        this.sceneSectionStyleTween = null;
        this.sceneSectionHelperTransitionOpacity = 1;
      }
    }
    if (this.workingAreaFocusTween) {
      const tween = this.workingAreaFocusTween;
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      this.applyWorkingAreaFocusStyle(
        done
          ? tween.toStyle
          : this.interpolatedWorkingAreaFocusStyle(
              tween.fromStyle,
              tween.toStyle,
              eased,
            ),
      );
      if (done) this.workingAreaFocusTween = null;
    }
    for (const [id, tween] of this.scalarStyleTweens) {
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      const style = done
        ? tween.toStyle
        : this.interpolatedScalarStyle(tween.fromStyle, tween.toStyle, eased);
      this.applyStyle(id, style);
      if (done) this.scalarStyleTweens.delete(id);
    }
    for (const [id, tween] of this.layerTweens) {
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      const opacity = tween.from + (tween.to - tween.from) * eased;
      this.applyLayerRenderOpacity(id, done ? tween.to : opacity);
      if (done) this.layerTweens.delete(id);
    }
    for (const [id, snapshot] of this.layerTransitionSnapshots) {
      const t =
        snapshot.durationMs <= 0
          ? 1
          : (nowMs - snapshot.startMs) / snapshot.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, snapshot.easing);
      const opacity = snapshot.from + (snapshot.to - snapshot.from) * eased;
      this.applyRenderOpacityToTree(
        snapshot.group,
        done ? snapshot.to : opacity,
      );
      if (done) this.removeLayerTransitionSnapshot(id);
    }
    this.enforceTransitionVisibilityEnvelope();
    if (
      this.layerTweens.size === 0 &&
      this.scalarStyleTweens.size === 0 &&
      this.layerTransitionSnapshots.size === 0 &&
      !this.sceneSectionStyleTween &&
      !this.workingAreaFocusTween
    ) {
      const transition = this.activeSceneTransitionContext;
      const transitionDone =
        !transition ||
        transition.durationMs <= 0 ||
        performance.now() - transition.startMs >= transition.durationMs;
      if (transitionDone) {
        this.activeSceneTransitionContext = null;
      }
    }
  }

  private interpolatedScalarStyle(
    fromStyle: EditableStyle,
    toStyle: EditableStyle,
    amount: number,
  ): EditableStyle {
    const t = clamp01(amount);
    const next: EditableStyle = { ...toStyle };
    if (
      typeof fromStyle.opacity === "number" &&
      Number.isFinite(fromStyle.opacity) &&
      typeof toStyle.opacity === "number" &&
      Number.isFinite(toStyle.opacity)
    ) {
      next.opacity = fromStyle.opacity + (toStyle.opacity - fromStyle.opacity) * t;
    }
    if (fromStyle.mtSurfaceBoundariesById && toStyle.mtSurfaceBoundariesById) {
      const nextBoundaries = { ...toStyle.mtSurfaceBoundariesById };
      for (const [id, toBoundary] of Object.entries(toStyle.mtSurfaceBoundariesById)) {
        const fromBoundary = fromStyle.mtSurfaceBoundariesById[id];
        if (
          fromBoundary &&
          typeof fromBoundary.opacity === "number" &&
          Number.isFinite(fromBoundary.opacity) &&
          typeof toBoundary.opacity === "number" &&
          Number.isFinite(toBoundary.opacity)
        ) {
          nextBoundaries[id] = {
            ...toBoundary,
            opacity: fromBoundary.opacity + (toBoundary.opacity - fromBoundary.opacity) * t,
          };
        }
      }
      next.mtSurfaceBoundariesById = nextBoundaries;
    }
    for (const field of SCALAR_TRANSITION_STYLE_FIELDS) {
      const from = scalarStyleNumber(fromStyle, field);
      const to = scalarStyleNumber(toStyle, field);
      if (typeof from !== "number" || typeof to !== "number") continue;
      (next as Record<string, unknown>)[field] = from + (to - from) * t;
    }
    return next;
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

  private updateLightingStudioElementScale(camera: THREE.Camera): void {
    if (!this.envLightHelperGroup || !this.studioSceneElementsVisible) return;
    for (const handle of this.envLightHandles.values()) {
      handle.group.getWorldPosition(this.studioHandleWorldPos);
      const distance = camera.position.distanceTo(this.studioHandleWorldPos);
      const scale = clampRange(
        distance / STUDIO_HANDLE_SCREEN_SCALE_DISTANCE_M,
        STUDIO_HANDLE_MIN_SCALE,
        STUDIO_HANDLE_MAX_SCALE,
      );
      handle.group.scale.setScalar(scale);
    }
  }

  private updateDynamicCameraOrbitCenterScale(camera: THREE.Camera): void {
    if (!this.orbitCenterHandle) return;
    this.orbitCenterHandle.group.getWorldPosition(this.orbitCenterWorldPos);
    const distance = camera.position.distanceTo(this.orbitCenterWorldPos);
    const scale = clampRange(
      distance / ORBIT_CENTER_HANDLE_SCREEN_SCALE_DISTANCE_M,
      ORBIT_CENTER_HANDLE_MIN_SCALE,
      ORBIT_CENTER_HANDLE_MAX_SCALE,
    );
    this.orbitCenterHandle.group.scale.setScalar(scale);
  }

  private updatePageCameraMarkerScale(
    marker: PageCameraMarkerRuntime,
    camera: THREE.Camera,
  ): void {
    marker.group.getWorldPosition(this.pageCameraMarkerWorldPos);
    const distance = camera.position.distanceTo(this.pageCameraMarkerWorldPos);
    const scale = clampRange(distance / 5200, 0.62, 2.8);
    marker.label.scale.set(
      marker.labelBaseWidth * scale,
      marker.labelBaseHeight * scale,
      1,
    );
    marker.label.position.z = marker.labelLift * scale;
    this.updatePageCameraMarkerLine(marker);
  }

  private updatePageCameraMarkersScale(camera: THREE.Camera): void {
    if (this.pageCameraMarker?.group.visible) {
      this.updatePageCameraMarkerScale(this.pageCameraMarker, camera);
    }
    for (const marker of this.globalPageCameraMarkers.values()) {
      if (marker.group.visible)
        this.updatePageCameraMarkerScale(marker, camera);
    }
  }

  /**
   * Per-frame tick. Drives scene-overlay opacity tweens and any
   * camera-locked sun updates.
   */
  frameUpdate(camera: THREE.Camera, nowMs: number = performance.now()): void {
    this.updateCameraLockedSun(camera);
    this.tickLayerTweens(nowMs);
    this.updateBoreLensVisibility(camera);
    this.updateLightingStudioElementScale(camera);
    this.updateDynamicCameraOrbitCenterScale(camera);
    this.updatePageCameraMarkersScale(camera);
    this.updateEzGammaBillboards(camera);
    this.topoRuntime.updateGridCameraVisibility(camera);
    this.sceneOverlayController.tick(nowMs);
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

