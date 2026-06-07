import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadSceneOverlays } from "./loaders/loadSceneOverlays";
import { loadLayerInto, resolveDataPath } from "./scene/layerLoaders";
import { SceneManager } from "./scene/SceneManager";
import type {
  AreaOutlineHandleMode,
  AreaOutlinePreview,
  LocalAtmosphereHandleMode,
  LocalAtmospherePreview,
  OrbitCenterHandleMode,
  PageCameraMarkerSpec,
  SceneSectionAxis,
  SceneSectionWindowHandleKind,
} from "./scene/SceneManager";
import { buildPostprocessing } from "./scene/postprocessing";
import { setHoverTooltip } from "./ui/HoverTooltip";
import type { Pose, ProjectLayerSpec, SceneOverlayDef, Vec3 } from "./pages/types";
import { applyPose, capturePose } from "./pages/capturePose";
import { debugLog } from "./utils/debugLog";
import { UTAH_FORGE_MT_STATIONS_LAYER_ID } from "./projectModules/utahForge/layerIds";
import {
  createCaptureCameraPathLine,
  disposeCaptureCameraPathOverlayObject,
  setCaptureCameraPathLineResolution,
} from "./scene/captureCameraPathOverlayLine";
import type {
  CaptureCameraPathKeyframeV1,
  CaptureCameraPathSample,
  CaptureVec3,
} from "./capture/captureCameraPath";

// Z-up convention for the whole scene.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const CAMERA_NEAR_M = 50;
// Presentation/topo context must stay inside the frustum at overview zoom.
// Do not use the camera far plane as a visual crop; use authored clip tools.
const CAMERA_FAR_M = 5_000_000;
const CAPTURE_CAMERA_PATH_NODE_MARKER_SCALE = 8;
const CAPTURE_CAMERA_PATH_TRANSITION_MARKER_SCALE = 5.44;
const CAPTURE_CAMERA_PATH_SAMPLE_MARKER_SCALE = 2.44;
const CAPTURE_CAMERA_PATH_NODE_FOCAL_LINE_WIDTH_SCALE = 0.8;
const CAPTURE_CAMERA_PATH_CLOSE_FADE_START_M = 2_600;
const CAPTURE_CAMERA_PATH_CLOSE_FADE_END_M = 180;
const CAPTURE_CAMERA_PATH_CLOSE_FADE_MIN_OPACITY = 0.18;
const CAPTURE_CAMERA_PATH_WHITE_CROSSHAIR_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'M12 2v7M12 15v7M2 12h7M15 12h7\' stroke=\'%23f8fafc\' stroke-width=\'2\' stroke-linecap=\'round\'/%3E%3Ccircle cx=\'12\' cy=\'12\' r=\'2.5\' fill=\'none\' stroke=\'%23f8fafc\' stroke-width=\'1.5\'/%3E%3C/svg%3E") 12 12, crosshair';

type SceneDepthBufferMode = "reverse" | "logarithmic" | "standard";
type SceneSectionHandlePick = {
  axis: SceneSectionAxis;
  frameId?: string;
  kind: "plane" | SceneSectionWindowHandleKind;
  world: THREE.Vector3;
};

function sceneSectionHandleKind(
  kind: unknown,
): SceneSectionWindowHandleKind | null {
  return kind === "window-min" ||
    kind === "window-max" ||
    kind === "window-bottom" ||
    kind === "frame-min-a" ||
    kind === "frame-max-a" ||
    kind === "frame-min-b" ||
    kind === "frame-max-b"
    ? kind
    : null;
}

function sceneSectionFrameDragNormal(
  axis: SceneSectionAxis,
  kind: SceneSectionWindowHandleKind,
): THREE.Vector3 {
  if (
    kind === "window-min" ||
    kind === "window-max" ||
    kind === "frame-min-a" ||
    kind === "frame-max-a"
  ) {
    if (axis === "x") return new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3(1, 0, 0);
  }
  if (axis === "z") return new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(0, 0, 1);
}

function projectToClient(
  camera: THREE.Camera,
  world: THREE.Vector3,
  rect: DOMRect,
): THREE.Vector2 {
  const projected = world.clone().project(camera);
  return new THREE.Vector2(
    rect.left + (projected.x * 0.5 + 0.5) * rect.width,
    rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
  );
}

function sceneSectionScreenDragProjection(
  camera: THREE.Camera,
  world: THREE.Vector3,
  normal: THREE.Vector3,
  rect: DOMRect,
): { screenAxis: THREE.Vector2; metersPerPixel: number } {
  const distance = camera.position.distanceTo(world);
  const stepM = THREE.MathUtils.clamp(distance * 0.035, 250, 8_000);
  const p0 = projectToClient(camera, world, rect);
  const p1 = projectToClient(
    camera,
    world.clone().addScaledVector(normal.clone().normalize(), stepM),
    rect,
  );
  const delta = p1.sub(p0);
  const pixels = delta.length();
  if (Number.isFinite(pixels) && pixels > 2) {
    return {
      screenAxis: delta.multiplyScalar(1 / pixels),
      metersPerPixel: stepM / pixels,
    };
  }
  return {
    screenAxis: new THREE.Vector2(0, -1),
    metersPerPixel: THREE.MathUtils.clamp(distance * 0.0035, 35, 1_800),
  };
}

function browserSupportsReverseDepthBuffer(): boolean {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) return false;
  const supported = !!gl.getExtension("EXT_clip_control");
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return supported;
}

function sceneDepthBufferMode(
  renderer: THREE.WebGLRenderer,
): SceneDepthBufferMode {
  if (renderer.capabilities.reverseDepthBuffer) return "reverse";
  if (renderer.capabilities.logarithmicDepthBuffer) return "logarithmic";
  return "standard";
}

export interface DrillFocus {
  holeId: string;
  point: THREE.Vector3;
}

export interface SceneTargetBox {
  min: Vec3;
  max: Vec3;
}

export interface SceneTargetEventDetail {
  targetId: string;
  layerId: string;
  productId?: string;
  objectId?: string;
  label: string;
  worldPoint: Vec3;
  worldBox: SceneTargetBox | null;
}

export interface SceneTargetResolution {
  targetId: string;
  layerId: string;
  productId?: string;
  label: string;
  worldBox: SceneTargetBox | null;
}

export interface SceneRenderLoopDebugState {
  frameIndex: number;
  timestampMs: number;
  rafDeltaMs: number | null;
  wallDeltaMs: number | null;
  idleGapMs: number | null;
  totalMs: number;
  tickersMs: number;
  controlsUpdateMs: number;
  managerFrameUpdateMs: number;
  renderMs: number;
  tickerCount: number;
  tickerDurations: Array<{
    name: string;
    durationMs: number;
  }>;
}

export interface CaptureFidelityDiagnostics {
  requestedWidth: number;
  requestedHeight: number;
  effectiveWidth: number;
  effectiveHeight: number;
  rendererPixelRatio: number;
  downsamplingDisabled: boolean;
  dynamicResolutionDisabled: boolean;
  maxTextureSize: number;
  maxRenderbufferSize: number;
  layerDetailPolicy: Array<{
    layerId: string;
    requested: "max";
    effective: "max" | "highest-available-preview";
    note?: string;
  }>;
}

export interface CaptureFidelitySnapshot {
  reason: "render-out" | "still-capture" | "external-still";
  width: number;
  height: number;
  pixelRatio: number;
  cameraAspect: number;
  diagnostics: CaptureFidelityDiagnostics;
}

export interface CaptureCameraPathOverlayKeyframe {
  id: string;
  displayIndex?: number;
  enabled?: boolean;
  hidden?: boolean;
  nodeKind?: "keyframe" | "transition";
  position: CaptureVec3;
  target?: CaptureVec3;
  lookMode?:
    | "free-direction"
    | "focus-point-lock"
    | "follow-path-tangent"
    | "target-blend";
  focusLocked?: boolean;
}

export interface CaptureCameraPathOverlaySegment {
  id: string;
  displayIndex?: number;
  enabled?: boolean;
  hidden?: boolean;
  fromNodeId: string;
  toNodeId: string;
}

export interface CaptureCameraPathOverlaySample {
  timeSeconds: number;
  position: CaptureVec3;
  target: CaptureVec3;
  up: CaptureVec3;
  fov: number;
  nodeId?: string | null;
}

export interface CaptureCameraPathEquationOptions {
  visible: boolean;
  selectedTransitionOnly?: boolean;
  showStackLabels?: boolean;
  showTemporalRamp?: boolean;
  showTangents?: boolean;
  showInfluenceHandles?: boolean;
  showCurvatureComb?: boolean;
  showFocusDistance?: boolean;
}

export interface CaptureCameraPathTransitionEquation {
  id: string;
  segmentId: string;
  label?: string;
  position?: CaptureVec3;
  anchor?: CaptureVec3;
  continuity?: "G0" | "G1" | "G2" | "G3";
  timeCurve?: string;
  visible?: boolean;
}

export interface CaptureCameraPathTangentHandle {
  id: string;
  segmentId?: string;
  nodeId?: string;
  label?: string;
  start: CaptureVec3;
  end: CaptureVec3;
}

export interface CaptureCameraPathInfluenceHandle {
  id: string;
  segmentId?: string;
  nodeId?: string;
  label?: string;
  position: CaptureVec3;
  anchor?: CaptureVec3;
  gdPercent?: number;
}

export interface CaptureCameraPathCurvatureCombSample {
  position: CaptureVec3;
  normal: CaptureVec3;
  length: number;
}

export interface CaptureCameraPathCurvatureComb {
  id: string;
  segmentId?: string;
  samples: CaptureCameraPathCurvatureCombSample[];
}

export interface CaptureCameraPathFocusDistanceVector {
  id: string;
  nodeId?: string;
  segmentId?: string;
  label?: string;
  start: CaptureVec3;
  end: CaptureVec3;
  distanceM?: number;
}

export interface CaptureCameraPathSplineHandle {
  id: string;
  nodeId: string;
  side: "in" | "out";
  label?: string;
  anchor: CaptureVec3;
  position: CaptureVec3;
  tangentCoupled?: boolean;
}

export interface CaptureCameraPathNodeAxisHandle {
  id: string;
  nodeId: string;
  axis: "x" | "y" | "z";
  start: CaptureVec3;
  end: CaptureVec3;
}

export interface CaptureCameraPathOverlayState {
  visible: boolean;
  editable: boolean;
  selectedKeyframeId: string | null;
  selectedSegmentId?: string | null;
  sampledPoints: CaptureVec3[];
  keyframes: CaptureCameraPathOverlayKeyframe[];
  segmentIds: string[];
  segments?: CaptureCameraPathOverlaySegment[];
  currentSample?: CaptureCameraPathOverlaySample | null;
  colors?: {
    path?: string;
    selected?: string;
    keyframe?: string;
    target?: string;
    hover?: string;
  };
  lineSize?: number;
  directionRayLength?: number;
  handleScale?: number;
  showCameraFrustum?: boolean;
  showLookRays?: boolean;
  showCurrentSampleMarker?: boolean;
  showCurrentSampleLookRay?: boolean;
  showFocusLockRays?: boolean;
  showNodeLabels?: boolean;
  showTimelineGhost?: boolean;
  previewMonitorMode?: string;
  equationOptions?: CaptureCameraPathEquationOptions;
  transitionEquations?: CaptureCameraPathTransitionEquation[];
  tangentHandles?: CaptureCameraPathTangentHandle[];
  influenceHandles?: CaptureCameraPathInfluenceHandle[];
  splineHandles?: CaptureCameraPathSplineHandle[];
  nodeAxisHandles?: CaptureCameraPathNodeAxisHandle[];
  curvatureComb?: CaptureCameraPathCurvatureComb[];
  focusDistanceVectors?: CaptureCameraPathFocusDistanceVector[];
}

export interface CaptureCameraPathInteractionOptions {
  onSelectKeyframe?: (id: string) => void;
  onMoveKeyframe?: (id: string, position: CaptureVec3) => void;
  onMoveTarget?: (id: string, target: CaptureVec3) => void;
  onMoveSegment?: (segmentId: string, delta: CaptureVec3) => void;
  onMoveInfluenceHandle?: (id: string, position: CaptureVec3) => void;
  onMoveSplineHandle?: (
    nodeId: string,
    side: "in" | "out",
    position: CaptureVec3,
  ) => void;
  onMoveNodeAxis?: (nodeId: string, axis: "x" | "y" | "z", delta: number) => void;
  onMoveFocusDistance?: (id: string, position: CaptureVec3) => void;
  onSelectEquationSegment?: (segmentId: string) => void;
  bindFocusKeyframeId?: string | null;
  onBindFocusPoint?: (id: string, point: CaptureVec3) => void;
}

export interface SceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  manager: SceneManager;
  getCanvas(): HTMLCanvasElement;
  beginCaptureSize(options: {
    width: number;
    height: number;
    pixelRatio?: number;
    suppressCameraPathOverlay?: boolean;
  }): void;
  endCaptureSize(): void;
  onAfterRender(callback: () => void): () => void;
  renderCaptureFrame?(options: {
    timeSeconds: number;
    frameIndex: number;
  }): void;
  getCameraPose(): CaptureCameraPathKeyframeV1;
  setCameraPose(pose: CaptureCameraPathSample | CaptureCameraPathKeyframeV1): void;
  beginCaptureFidelityLock(options: {
    reason: "render-out" | "still-capture" | "external-still";
    width: number;
    height: number;
    fullOutputWidth?: number;
    fullOutputHeight?: number;
    tileX?: number;
    tileY?: number;
    tileId?: string;
    mode: "max-detail-render";
  }): CaptureFidelitySnapshot;
  endCaptureFidelityLock(snapshot: CaptureFidelitySnapshot): void;
  setCaptureCameraPathOverlay(options: CaptureCameraPathOverlayState): void;
  clearCaptureCameraPathOverlay(): void;
  setCaptureCameraPathInteraction(
    options: CaptureCameraPathInteractionOptions,
  ): () => void;
  renderCameraPathPreviewFrame(options: {
    pose: CaptureCameraPathSample;
    width: number;
    height: number;
  }): string | null;
  getCaptureCapabilities(): {
    maxTextureSize: number;
    maxRenderbufferSize: number;
  };
  onTick(fn: (timeMs: number) => void, debugName?: string): () => void;
  getFrameLoopDebugState(): SceneRenderLoopDebugState | null;
  onDrillFocus(fn: (focus: DrillFocus | null) => void): () => void;
  /**
   * Gate the hover-raycast loop. PageController flips this to false at
   * the start of a camera tween and back to true at completion so the
   * tooltip doesn't pop up as the camera flies past objects mid-tween.
   */
  setRaycastEnabled(enabled: boolean): void;
  /**
   * Synchronous transition flag for render-loop consumers that need to avoid
   * expensive nonessential work before React context updates are flushed.
   */
  setTransitionActive(enabled: boolean): void;
  isTransitionActive(): boolean;
  resolveSceneTarget(targetId: string): SceneTargetResolution | null;
  /**
   * Editor flag: when true, hovering a scene-overlay outline shows a
   * grab cursor + brightens the outline; mousedown begins a translate
   * drag. Presenter mode flips this off so overlays are inert.
   */
  setEditorMode(enabled: boolean): void;
  /**
   * Register a callback invoked on overlay drag-mouseup with the new
   * bounds. EditorContext wires this to dispatch a SET_ENV_SCENE_OVERLAY_BOUNDS
   * action and rebuild geometry against the committed bounds.
   */
  setOverlayBoundsCommitHandler(
    fn: ((id: string, bounds: [number, number, number, number]) => void) | null,
  ): void;
  /**
   * Register a callback invoked when an editor-mode light handle is dragged
   * and released. SceneManager owns the live preview; EditorContext owns the
   * saved environment JSON commit.
   */
  setLightingSourceCommitHandler(
    fn:
      | ((
          id: string,
          patch: { position?: Vec3; target?: Vec3 },
        ) => void)
      | null,
  ): void;
  /**
   * Editor-only dynamic camera orbit-center helper. The selected page owns
   * the durable value; scene.ts owns pick/drag preview in the viewport.
   */
  setDynamicCameraOrbitCenter(point: Vec3 | null, direction?: 1 | -1): void;
  beginDynamicCameraOrbitCenterPick(fn: (point: Vec3) => void): void;
  cancelDynamicCameraOrbitCenterPick(): void;
  setDynamicCameraOrbitCenterCommitHandler(
    fn: ((point: Vec3) => void) | null,
  ): void;
  setAreaOutlineCommitHandler(
    fn: ((id: string, patch: AreaOutlinePreview) => void) | null,
  ): void;
  setLocalAtmosphereCommitHandler(
    fn: ((layerId: string, patch: LocalAtmospherePreview) => void) | null,
  ): void;
  setSceneSectionPlaneCommitHandler(
    fn:
      | ((axis: SceneSectionAxis, positionM: number, frameId?: string) => void)
      | null,
  ): void;
  setSceneSectionWindowCommitHandler(
    fn:
      | ((
          axis: SceneSectionAxis,
          kind: SceneSectionWindowHandleKind,
          valueM: number,
          frameId?: string,
        ) => void)
      | null,
  ): void;
  setPageCameraMarker(pose: Pose | null): void;
  setPageCameraMarkerClickHandler(fn: (() => void) | null): void;
  setGlobalPageCameraMarkers(markers: PageCameraMarkerSpec[] | null): void;
  setGlobalPageCameraMarkerClickHandler(
    fn: ((pageId: string) => void) | null,
  ): void;
  dispose(): void;
}

export function mountScene(
  container: HTMLElement,
  layerSpecs: ProjectLayerSpec[],
  sceneOverlays: Record<string, SceneOverlayDef> = {},
): SceneHandle {
  const useReverseDepthBuffer = browserSupportsReverseDepthBuffer();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    reverseDepthBuffer: useReverseDepthBuffer,
    logarithmicDepthBuffer: !useReverseDepthBuffer,
  });
  const depthBufferMode = sceneDepthBufferMode(renderer);
  renderer.domElement.dataset.depthBufferMode = depthBufferMode;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Tone mapping + exposure are owned by SceneManager.applyEnvironment.
  // Setting baseline here so first-paint before applyEnvironment looks
  // sane.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const captureCameraPathOverlay = new THREE.Group();
  captureCameraPathOverlay.name = "__capture_camera_path_overlay__";
  captureCameraPathOverlay.visible = false;
  captureCameraPathOverlay.userData.geoseePickIgnore = true;
  captureCameraPathOverlay.userData.captureCameraPathOverlay = true;
  scene.add(captureCameraPathOverlay);

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    CAMERA_NEAR_M,
    CAMERA_FAR_M,
  );
  camera.position.set(6_000, -6_000, 4_000);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);

  const captureCameraPathCloseOpacity = (
    points: readonly THREE.Vector3[],
    opacity: number,
  ): number => {
    const closestDistance = points.reduce(
      (closest, point) => Math.min(closest, camera.position.distanceTo(point)),
      Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(closestDistance)) return opacity;
    const fade = THREE.MathUtils.smoothstep(
      closestDistance,
      CAPTURE_CAMERA_PATH_CLOSE_FADE_END_M,
      CAPTURE_CAMERA_PATH_CLOSE_FADE_START_M,
    );
    const scale =
      CAPTURE_CAMERA_PATH_CLOSE_FADE_MIN_OPACITY +
      fade * (1 - CAPTURE_CAMERA_PATH_CLOSE_FADE_MIN_OPACITY);
    return opacity * THREE.MathUtils.clamp(
      scale,
      CAPTURE_CAMERA_PATH_CLOSE_FADE_MIN_OPACITY,
      1,
    );
  };

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  // No more grid/axes -- they're authoring crutches that read as "tech demo"
  // in presenter mode. The terrain shader carries spatial reference now.

  const manager = new SceneManager(scene, renderer);
  for (const spec of layerSpecs) {
    manager.registerLayer(spec);
  }
  for (const spec of layerSpecs) {
    loadLayerInto(spec, manager);
  }

  // Scene overlays load eagerly: one mesh per env.sceneOverlays entry.
  // The terrain heightSampler isn't published until loadTerrain finishes
  // its GeoTIFF parse, so loadSceneOverlays awaits getHeightSampler()
  // internally. Per-page activation happens in PageController via
  // manager.applySceneOverlaysForPage; meshes start at opacity 0.
  debugLog(
    "[scene] sceneOverlays registry passed to loader:",
    Object.keys(sceneOverlays),
  );
  // Hand the loader knobs to SceneManager so the editor's "add overlay"
  // flow can hot-load a single new overlay later.
  manager.setSceneOverlayLoaderHooks({
    resolveAssetPath: resolveDataPath,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
  });
  loadSceneOverlays(
    sceneOverlays,
    resolveDataPath,
    renderer.capabilities.getMaxAnisotropy(),
  )
    .then((handles) => {
      debugLog(
        `[scene] loadSceneOverlays resolved with ${handles.size} handle(s)`,
      );
      manager.registerSceneOverlays(handles);
    })
    .catch((e) => console.error("loadSceneOverlays failed:", e));

  // Post-processing chain: bloom + grade + vignette + output. Hooked to
  // manager so applyEnvironment can tune values.
  const post = buildPostprocessing(renderer, scene, camera, {
    w: container.clientWidth,
    h: container.clientHeight,
  });
  manager.setPostHandle(post);

  const tickers = new Set<{
    fn: (t: number) => void;
    debugName: string;
  }>();
  const afterRenderCallbacks = new Set<() => void>();
  let captureSizeSnapshot: {
    width: number;
    height: number;
    pixelRatio: number;
    cameraAspect: number;
    cameraPathOverlayVisible: boolean;
  } | null = null;
  let lastFrameLoopDebug: SceneRenderLoopDebugState | null = null;
  let frameLoopIndex = 0;
  let lastRafTimeMs: number | null = null;
  let lastFrameStartMs: number | null = null;
  let lastFrameEndMs: number | null = null;
  const onTick = (fn: (t: number) => void, debugName = "anonymous") => {
    const entry = { fn, debugName };
    tickers.add(entry);
    return () => tickers.delete(entry);
  };
  const getFrameLoopDebugState = () => lastFrameLoopDebug;
  const getCanvas = () => renderer.domElement;
  const onAfterRender = (callback: () => void) => {
    afterRenderCallbacks.add(callback);
    return () => afterRenderCallbacks.delete(callback);
  };
  const getCameraPose = (): CaptureCameraPathKeyframeV1 => ({
    id: "current-camera",
    timeSeconds: 0,
    ...capturePose(camera, controls),
    easing: "linear",
  });
  const setCameraPose = (
    pose: CaptureCameraPathSample | CaptureCameraPathKeyframeV1,
  ) => {
    applyPose(camera, controls, {
      position: [pose.position[0], pose.position[1], pose.position[2]],
      target: [pose.target[0], pose.target[1], pose.target[2]],
      up: [pose.up[0], pose.up[1], pose.up[2]],
      fov: pose.fov,
    });
  };
  const notifyAfterRenderCallbacks = () => {
    for (const callback of afterRenderCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error("[scene] after-render callback failed:", error);
      }
    }
  };
  const applyRenderSize = (
    width: number,
    height: number,
    pixelRatio: number,
    updateCanvasStyle: boolean,
  ) => {
    const safeWidth = Math.max(1, Math.round(width));
    const safeHeight = Math.max(1, Math.round(height));
    const safePixelRatio = Math.max(0.25, Math.min(4, pixelRatio));
    renderer.setPixelRatio(safePixelRatio);
    renderer.setSize(safeWidth, safeHeight, updateCanvasStyle);
    setCaptureCameraPathLineResolution(
      captureCameraPathOverlay,
      safeWidth,
      safeHeight,
    );
    camera.aspect = safeWidth / safeHeight;
    camera.updateProjectionMatrix();
    post.setPixelRatio(safePixelRatio);
    post.setSize(safeWidth, safeHeight);
    manager.notifyResize(safeWidth, safeHeight);
  };
  const beginCaptureSize = (options: {
    width: number;
    height: number;
    pixelRatio?: number;
    suppressCameraPathOverlay?: boolean;
  }) => {
    if (captureSizeSnapshot) {
      endCaptureSize();
    }
    const currentSize = renderer.getSize(new THREE.Vector2());
    captureSizeSnapshot = {
      width: currentSize.x,
      height: currentSize.y,
      pixelRatio: renderer.getPixelRatio(),
      cameraAspect: camera.aspect,
      cameraPathOverlayVisible: captureCameraPathOverlay.visible,
    };
    if (options.suppressCameraPathOverlay !== false) {
      captureCameraPathOverlay.visible = false;
    }
    applyRenderSize(
      options.width,
      options.height,
      options.pixelRatio ?? renderer.getPixelRatio(),
      false,
    );
  };
  const endCaptureSize = () => {
    const snapshot = captureSizeSnapshot;
    if (!snapshot) return;
    captureSizeSnapshot = null;
    const liveWidth = container.clientWidth || snapshot.width;
    const liveHeight = container.clientHeight || snapshot.height;
    captureCameraPathOverlay.visible = snapshot.cameraPathOverlayVisible;
    applyRenderSize(
      liveWidth,
      liveHeight,
      snapshot.pixelRatio,
      !!container.clientWidth && !!container.clientHeight,
    );
    if (!container.clientWidth || !container.clientHeight) {
      camera.aspect = snapshot.cameraAspect;
      camera.updateProjectionMatrix();
    }
  };
  const renderCaptureFrame = ({
    timeSeconds,
  }: {
    timeSeconds: number;
    frameIndex: number;
  }) => {
    const timeMs = timeSeconds * 1000;
    const cameraPathOverlayVisible = captureCameraPathOverlay.visible;
    captureCameraPathOverlay.visible = false;
    try {
      for (const ticker of tickers) {
        ticker.fn(timeMs);
      }
      controls.update();
      manager.frameUpdate(camera, timeMs);
      post.composer.render();
      notifyAfterRenderCallbacks();
    } finally {
      if (!captureSizeSnapshot) {
        captureCameraPathOverlay.visible = cameraPathOverlayVisible;
      }
    }
  };
  const renderCameraPathPreviewFrame = ({
    pose,
    width,
    height,
  }: {
    pose: CaptureCameraPathSample;
    width: number;
    height: number;
  }): string | null => {
    const safeWidth = Math.max(1, Math.min(640, Math.round(width)));
    const safeHeight = Math.max(1, Math.min(360, Math.round(height)));
    const previewCamera = camera.clone() as THREE.PerspectiveCamera;
    previewCamera.position.set(pose.position[0], pose.position[1], pose.position[2]);
    previewCamera.up.set(pose.up[0], pose.up[1], pose.up[2]);
    previewCamera.fov = pose.fov;
    previewCamera.aspect = safeWidth / safeHeight;
    previewCamera.lookAt(new THREE.Vector3(pose.target[0], pose.target[1], pose.target[2]));
    previewCamera.updateProjectionMatrix();
    const renderTarget = new THREE.WebGLRenderTarget(safeWidth, safeHeight, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    const previousRenderTarget = renderer.getRenderTarget();
    const overlayWasVisible = captureCameraPathOverlay.visible;
    const pixelBuffer = new Uint8Array(safeWidth * safeHeight * 4);
    try {
      captureCameraPathOverlay.visible = false;
      renderer.setRenderTarget(renderTarget);
      renderer.render(scene, previewCamera);
      renderer.readRenderTargetPixels(
        renderTarget,
        0,
        0,
        safeWidth,
        safeHeight,
        pixelBuffer,
      );
      const canvas = document.createElement("canvas");
      canvas.width = safeWidth;
      canvas.height = safeHeight;
      const context = canvas.getContext("2d");
      if (!context) return null;
      const imageData = context.createImageData(safeWidth, safeHeight);
      const rowBytes = safeWidth * 4;
      for (let y = 0; y < safeHeight; y += 1) {
        const sourceOffset = (safeHeight - y - 1) * rowBytes;
        const targetOffset = y * rowBytes;
        imageData.data.set(
          pixelBuffer.subarray(sourceOffset, sourceOffset + rowBytes),
          targetOffset,
        );
      }
      context.putImageData(imageData, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.76);
    } catch (error) {
      debugLog("capture", "camera path preview render failed", error);
      return null;
    } finally {
      renderer.setRenderTarget(previousRenderTarget);
      captureCameraPathOverlay.visible = overlayWasVisible;
      renderTarget.dispose();
    }
  };
  const getCaptureCapabilities = () => {
    const gl = renderer.getContext();
    const maxTextureSize =
      renderer.capabilities.maxTextureSize ??
      gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
    return {
      maxTextureSize:
        typeof maxTextureSize === "number" && Number.isFinite(maxTextureSize)
          ? maxTextureSize
          : 4096,
      maxRenderbufferSize:
        typeof maxRenderbufferSize === "number" &&
        Number.isFinite(maxRenderbufferSize)
          ? maxRenderbufferSize
      : 4096,
    };
  };
  const beginCaptureFidelityLock = (options: {
    reason: "render-out" | "still-capture" | "external-still";
    width: number;
    height: number;
    fullOutputWidth?: number;
    fullOutputHeight?: number;
    tileX?: number;
    tileY?: number;
    tileId?: string;
    mode: "max-detail-render";
  }): CaptureFidelitySnapshot => {
    const currentSize = renderer.getSize(new THREE.Vector2());
    const capabilities = getCaptureCapabilities();
    const snapshot: CaptureFidelitySnapshot = {
      reason: options.reason,
      width: currentSize.x,
      height: currentSize.y,
      pixelRatio: renderer.getPixelRatio(),
      cameraAspect: camera.aspect,
      diagnostics: {
        requestedWidth: options.width,
        requestedHeight: options.height,
        effectiveWidth: options.width,
        effectiveHeight: options.height,
        rendererPixelRatio: 1,
        downsamplingDisabled: true,
        dynamicResolutionDisabled: true,
        maxTextureSize: capabilities.maxTextureSize,
        maxRenderbufferSize: capabilities.maxRenderbufferSize,
        layerDetailPolicy: Array.from(manager.layerEntries()).map(([layerId]) => ({
          layerId,
          requested: "max" as const,
          effective: "highest-available-preview" as const,
          note: "Capture Director uses the highest currently loaded app source without additional render downsampling.",
        })),
      },
    };
    beginCaptureSize({
      width: options.width,
      height: options.height,
      pixelRatio: 1,
    });
    renderer.domElement.dataset.captureFidelity = options.mode;
    renderer.domElement.dataset.captureDownsampling = "disabled";
    return snapshot;
  };
  const endCaptureFidelityLock = (_snapshot: CaptureFidelitySnapshot) => {
    delete renderer.domElement.dataset.captureFidelity;
    delete renderer.domElement.dataset.captureDownsampling;
    endCaptureSize();
  };
  const drillFocusListeners = new Set<(focus: DrillFocus | null) => void>();
  let currentDrillFocus: DrillFocus | null = null;
  const cloneDrillFocus = (focus: DrillFocus | null): DrillFocus | null =>
    focus ? { holeId: focus.holeId, point: focus.point.clone() } : null;
  const emitDrillFocus = (focus: DrillFocus | null) => {
    currentDrillFocus = cloneDrillFocus(focus);
    for (const fn of drillFocusListeners) {
      fn(cloneDrillFocus(currentDrillFocus));
    }
  };
  const onDrillFocus = (fn: (focus: DrillFocus | null) => void) => {
    drillFocusListeners.add(fn);
    fn(cloneDrillFocus(currentDrillFocus));
    return () => drillFocusListeners.delete(fn);
  };

  const onResize = () => {
    if (captureSizeSnapshot) {
      return;
    }
    const w = container.clientWidth;
    const h = container.clientHeight;
    applyRenderSize(w, h, renderer.getPixelRatio(), true);
  };
  window.addEventListener("resize", onResize);

  let raf = 0;
  const tick = (timeMs: number) => {
    raf = requestAnimationFrame(tick);
    const frameStartMs = performance.now();
    const frameIndex = ++frameLoopIndex;
    const rafDeltaMs =
      lastRafTimeMs === null ? null : Math.max(0, timeMs - lastRafTimeMs);
    const wallDeltaMs =
      lastFrameStartMs === null
        ? null
        : Math.max(0, frameStartMs - lastFrameStartMs);
    const idleGapMs =
      lastFrameEndMs === null ? null : Math.max(0, frameStartMs - lastFrameEndMs);
    const tickersStartMs = performance.now();
    const tickerDurations: SceneRenderLoopDebugState["tickerDurations"] = [];
    for (const ticker of tickers) {
      const tickerStartMs = performance.now();
      ticker.fn(timeMs);
      tickerDurations.push({
        name: ticker.debugName,
        durationMs: performance.now() - tickerStartMs,
      });
    }
    const tickersEndMs = performance.now();
    const controlsStartMs = performance.now();
    controls.update();
    const controlsEndMs = performance.now();
    // Sky / light camera-follow mode (when "Lock to scene" is off in env).
    const managerStartMs = performance.now();
    manager.frameUpdate(camera, timeMs);
    const managerEndMs = performance.now();
    const renderStartMs = performance.now();
    post.composer.render();
    notifyAfterRenderCallbacks();
    const frameEndMs = performance.now();
    lastFrameLoopDebug = {
      frameIndex,
      timestampMs: timeMs,
      rafDeltaMs,
      wallDeltaMs,
      idleGapMs,
      totalMs: frameEndMs - frameStartMs,
      tickersMs: tickersEndMs - tickersStartMs,
      controlsUpdateMs: controlsEndMs - controlsStartMs,
      managerFrameUpdateMs: managerEndMs - managerStartMs,
      renderMs: frameEndMs - renderStartMs,
      tickerCount: tickers.size,
      tickerDurations,
    };
    lastRafTimeMs = timeMs;
    lastFrameStartMs = frameStartMs;
    lastFrameEndMs = frameEndMs;
  };
  raf = requestAnimationFrame(tick);

  // ---- Hover tooltip raycaster --------------------------------------
  // Picks the first intersected object whose userData.displayName is
  // populated, then drives the singleton tooltip store. The 200ms
  // hover-delay state machine lives here (not in the React component)
  // so the tooltip never re-renders during the throttled cursor sweep.
  // Throttle: raycast at most every 33ms (~30Hz). Position updates on
  // every move so the tooltip tracks the cursor smoothly even between
  // raycasts.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let raycastEnabled = true;
  let transitionActive = false;
  let lastRayMs = 0;
  let currentLabel: string | null = null;
  let shown = false;
  let hoverTimer: number | null = null;
  const HOVER_DELAY_MS = 200;
  const RAY_THROTTLE_MS = 33;

  const pickLabel = (clientX: number, clientY: number): string | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    // Walk only the registered layer groups (skip terrain group -- its
    // big mesh would intercept everything and has no displayName).
    const targets: THREE.Object3D[] = [];
    for (const [id, group] of manager.layerEntries()) {
      if (id === "terrain") continue;
      if (group.visible) targets.push(group);
    }
    const hits = raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      // Walk up to find the first ancestor (including self) carrying a
      // displayName. Lets a child-mesh-of-a-group pattern still resolve.
      let node: THREE.Object3D | null = hit.object;
      let hiddenBySection = false;
      while (node) {
        const data = node.userData as {
          displayName?: string;
          sceneSectionLabelHidden?: boolean;
        };
        hiddenBySection =
          hiddenBySection || data.sceneSectionLabelHidden === true;
        const name = data.displayName;
        if (!hiddenBySection && typeof name === "string" && name.length > 0) {
          return name;
        }
        node = node.parent;
      }
    }
    return null;
  };

  const pickDrillFocus = (
    clientX: number,
    clientY: number,
  ): DrillFocus | null => {
    const groups = [
      manager.getLayer("drillholes-2023"),
      manager.getLayer("assay-samples"),
    ].filter((group): group is THREE.Group => !!group && group.visible);
    if (groups.length === 0) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(groups, true);
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const holeId = (node.userData as { holeId?: string }).holeId;
        if (typeof holeId === "string" && holeId.length > 0) {
          return { holeId, point: hit.point.clone() };
        }
        node = node.parent;
      }
    }
    return null;
  };

  const pickMtStation = (
    clientX: number,
    clientY: number,
  ): { layerId: string; stationId: string } | null => {
    const stationLayer = manager.getLayer(UTAH_FORGE_MT_STATIONS_LAYER_ID);
    if (!stationLayer?.visible) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([stationLayer], true);
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const data = node.userData as {
          pointMarker?: unknown;
          markerId?: unknown;
          sourceProperties?: { stationId?: unknown; id?: unknown };
        };
        const stationId =
          typeof data.sourceProperties?.stationId === "string"
            ? data.sourceProperties.stationId
            : typeof data.sourceProperties?.id === "string"
              ? data.sourceProperties.id
              : typeof data.markerId === "string"
                ? data.markerId
                : null;
        if (data.pointMarker === true && stationId) {
          return { layerId: UTAH_FORGE_MT_STATIONS_LAYER_ID, stationId };
        }
        node = node.parent;
      }
    }
    return null;
  };

  const isSceneLabelTargetNode = (node: THREE.Object3D): boolean => {
    const data = node.userData as Record<string, unknown>;
    return (
      data.topoGraticuleLabel === true ||
      data.demoBoreholeLabelAnchor === true ||
      data.demoZoneLabelAnchor === true ||
      data.pointMarkerLabelAnchor === true ||
      data.sceneSectionScaleLabel === true ||
      data.naipTileDiagnosticLabel === true ||
      typeof data.captureCameraPathEquationLabel === "string" ||
      (data.seismicFigureAnnotation === true && node instanceof THREE.Sprite)
    );
  };

  const isIgnoredSceneTargetNode = (node: THREE.Object3D): boolean => {
    const data = node.userData as Record<string, unknown>;
    return (
      isSceneLabelTargetNode(node) ||
      data.geoseePickIgnore === true ||
      data.terrainHandle === true ||
      data.topoGraticule === true ||
      data.topoGraticuleLines === true ||
      data.topoMapBranding === true ||
      data.sceneSectionHelper === true ||
      data.sceneSectionPlaneHandle === true ||
      data.pageCameraMarker === true ||
      data.captureCameraPathOverlay === true ||
      data.publicSurfaceClipHelper === true ||
      data.workingAreaFocusHelper === true ||
      data.lightingSourceHandle === true ||
      data.dynamicCameraOrbitCenter === true ||
      data.areaOutlineEditorHandle === true
    );
  };

  const ancestorChainVisible = (node: THREE.Object3D): boolean => {
    let cursor: THREE.Object3D | null = node;
    while (cursor) {
      if (cursor.visible === false) return false;
      if (isIgnoredSceneTargetNode(cursor)) return false;
      cursor = cursor.parent;
    }
    return true;
  };

  const vec3ToSceneArray = (value: THREE.Vector3): Vec3 => [
    value.x,
    value.y,
    value.z,
  ];

  const boxToSceneTargetBox = (box: THREE.Box3): SceneTargetBox | null => {
    if (box.isEmpty() || !Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) {
      return null;
    }
    return {
      min: vec3ToSceneArray(box.min),
      max: vec3ToSceneArray(box.max),
    };
  };

  const sceneTargetProductId = (
    node: THREE.Object3D | null,
  ): { productId?: string; productNode?: THREE.Object3D } => {
    let cursor = node;
    while (cursor) {
      const data = cursor.userData as Record<string, unknown>;
      const candidates = [
        data.seismicProductId,
        data.scalarVolumeProductId,
        data.resistivitySliceId,
        data.mtThresholdSurfaceId,
        data.mtIsosurfaceProductId,
        data.markerId,
      ];
      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.length > 0) {
          return { productId: candidate, productNode: cursor };
        }
      }
      cursor = cursor.parent;
    }
    return {};
  };

  const sceneTargetLabel = (
    node: THREE.Object3D | null,
    layerSpec: ProjectLayerSpec | undefined,
    productId?: string,
  ): string => {
    let cursor = node;
    while (cursor) {
      const name = (cursor.userData as { displayName?: unknown }).displayName;
      if (typeof name === "string" && name.trim().length > 0) return name;
      cursor = cursor.parent;
    }
    return layerSpec?.label ?? productId ?? "Scene object";
  };

  const sceneTargetBounds = (
    primary: THREE.Object3D | null,
    fallback: THREE.Object3D | null,
  ): SceneTargetBox | null => {
    const box = new THREE.Box3();
    if (primary) {
      box.setFromObject(primary);
      const converted = boxToSceneTargetBox(box);
      if (converted) return converted;
    }
    if (fallback) {
      box.setFromObject(fallback);
      return boxToSceneTargetBox(box);
    }
    return null;
  };

  const layerIdFromTargetId = (
    targetId: string,
  ): { layerId: string; productId?: string } | null => {
    if (targetId.startsWith("layer:")) {
      const layerId = targetId.slice("layer:".length);
      return layerId ? { layerId } : null;
    }
    if (targetId.startsWith("product:")) {
      const rest = targetId.slice("product:".length);
      const separator = rest.indexOf(":");
      if (separator <= 0) return null;
      return {
        layerId: rest.slice(0, separator),
        productId: rest.slice(separator + 1),
      };
    }
    return null;
  };

  const resolveSceneTarget = (
    targetId: string,
  ): SceneTargetResolution | null => {
    const parsed = layerIdFromTargetId(targetId);
    if (!parsed) return null;
    const group = manager.getLayer(parsed.layerId);
    if (!group) return null;
    const layerSpec = (group.userData as { layerSpec?: ProjectLayerSpec }).layerSpec;
    let productNode: THREE.Object3D | null = null;
    if (parsed.productId) {
      group.traverse((node) => {
        if (productNode) return;
        const product = sceneTargetProductId(node).productId;
        if (product === parsed.productId) productNode = node;
      });
      if (!productNode) return null;
    }
    return {
      targetId,
      layerId: parsed.layerId,
      productId: parsed.productId,
      label: sceneTargetLabel(productNode ?? group, layerSpec, parsed.productId),
      worldBox: sceneTargetBounds(productNode ?? group, group),
    };
  };

  const pickSceneTarget = (
    clientX: number,
    clientY: number,
  ): SceneTargetEventDetail | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const layerByObject = new WeakMap<THREE.Object3D, string>();
    const targets: THREE.Object3D[] = [];
    for (const [id, group] of manager.layerEntries()) {
      if (id === "terrain" || id.toLowerCase().includes("graticule")) continue;
      if (!group.visible || isIgnoredSceneTargetNode(group)) continue;
      layerByObject.set(group, id);
      targets.push(group);
    }
    if (targets.length === 0) return null;
    const hits = raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      if (!ancestorChainVisible(hit.object)) continue;
      let layerGroup: THREE.Object3D | null = hit.object;
      let layerId: string | undefined;
      while (layerGroup) {
        layerId = layerByObject.get(layerGroup);
        if (layerId) break;
        layerGroup = layerGroup.parent;
      }
      if (!layerId || !layerGroup) continue;
      const layerSpec = (layerGroup.userData as { layerSpec?: ProjectLayerSpec })
        .layerSpec;
      const { productId, productNode } = sceneTargetProductId(hit.object);
      const targetId = productId
        ? `product:${layerId}:${productId}`
        : `layer:${layerId}`;
      return {
        targetId,
        layerId,
        productId,
        objectId:
          typeof hit.object.uuid === "string" && hit.object.uuid.length > 0
            ? hit.object.uuid
            : undefined,
        label: sceneTargetLabel(hit.object, layerSpec, productId),
        worldPoint: vec3ToSceneArray(hit.point),
        worldBox: sceneTargetBounds(productNode ?? hit.object, layerGroup),
      };
    }
    return null;
  };

  const dispatchSceneTargetClick = (detail: SceneTargetEventDetail): void => {
    window.dispatchEvent(
      new CustomEvent("geosee:scene-target-click", { detail }),
    );
  };

  const dispatchSceneTargetFocus = (detail: SceneTargetEventDetail): void => {
    window.dispatchEvent(
      new CustomEvent("geosee:scene-target-focus", { detail }),
    );
  };

  const applyHover = (label: string | null, x: number, y: number) => {
    if (label !== currentLabel) {
      currentLabel = label;
      shown = false;
      if (hoverTimer !== null) {
        window.clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      setHoverTooltip(null);
      if (label) {
        hoverTimer = window.setTimeout(() => {
          hoverTimer = null;
          if (currentLabel) {
            shown = true;
            setHoverTooltip({ x: x + 12, y: y + 8, label: currentLabel });
          }
        }, HOVER_DELAY_MS);
      }
    } else if (label && shown) {
      setHoverTooltip({ x: x + 12, y: y + 8, label });
    }
  };

  // ---- Scene-overlay drag interaction --------------------------------
  // Editor-only: hover the bounds outline -> grab cursor + outline
  // brightening; mousedown + drag translates the overlay's meshes in
  // scene-XY. Mouseup commits new bounds via a callback registered by
  // EditorContext (see manager.setOverlayBoundsCommitHandler).
  raycaster.params.Line2 = { threshold: 12 }; // generous pixel hit-radius
  raycaster.params.Line = { threshold: 12 };
  let editorMode = true;
  let dragOverlayId: string | null = null;
  let dragStartWorld: THREE.Vector3 | null = null;
  let dragStartBoundsScene: { dx0: number; dy0: number } | null = null;
  let dragOriginalBounds: SceneOverlayDef["bounds"] | null = null;
  let dragLight:
    | {
        sourceId: string;
        kind: "position" | "target";
        mode: "plane" | "height";
        original: THREE.Vector3;
        dragPlane: THREE.Plane | null;
      }
    | null = null;
  let dragOrbitCenter:
    | {
        original: THREE.Vector3;
        grabOffset: THREE.Vector3;
        mode: OrbitCenterHandleMode;
        dragPlane: THREE.Plane | null;
      }
    | null = null;
  let dragAreaOutline:
    | {
        id: string;
        mode: AreaOutlineHandleMode;
        original: THREE.Vector3;
        grabOffset: THREE.Vector3;
      }
    | null = null;
  let dragLocalAtmosphere:
    | {
        layerId: string;
        mode: LocalAtmosphereHandleMode;
        original: THREE.Vector3;
        grabOffset: THREE.Vector3;
        dragPlane: THREE.Plane | null;
      }
    | null = null;
  let dragSceneSectionPlane:
    | {
        axis: SceneSectionAxis;
        frameId?: string;
        kind: "plane" | SceneSectionWindowHandleKind;
        originalPositionM: number;
        startClient: THREE.Vector2;
        screenAxis: THREE.Vector2;
        metersPerPixel: number;
      }
    | null = null;
  let captureCameraPathInteraction: CaptureCameraPathInteractionOptions | null =
    null;
  let captureCameraPathOverlayEditable = false;
  let captureCameraPathSelectedKeyframeId: string | null = null;
  let dragCaptureCameraPath:
    | {
        type:
          | "keyframe"
          | "segment"
          | "target"
          | "influence"
          | "spline-handle"
          | "node-axis"
          | "focus-distance";
        id: string;
        side?: "in" | "out";
        axis?: "x" | "y" | "z";
        startWorld: THREE.Vector3;
        lastWorld: THREE.Vector3;
        dragPlane: THREE.Plane;
      }
    | null = null;
  let focusPointerDown: { x: number; y: number } | null = null;
  let suppressNextDrillFocusClick = false;
  let overlayBoundsCommit:
    | ((id: string, newBounds: SceneOverlayDef["bounds"]) => void)
    | null = null;
  let lightingSourceCommit:
    | ((id: string, patch: { position?: Vec3; target?: Vec3 }) => void)
    | null = null;
  let orbitCenterCommit: ((point: Vec3) => void) | null = null;
  let areaOutlineCommit:
    | ((id: string, patch: AreaOutlinePreview) => void)
    | null = null;
  let localAtmosphereCommit:
    | ((layerId: string, patch: LocalAtmospherePreview) => void)
    | null = null;
  let sceneSectionPlaneCommit:
    | ((axis: SceneSectionAxis, positionM: number, frameId?: string) => void)
    | null = null;
  let sceneSectionWindowCommit:
    | ((
        axis: SceneSectionAxis,
        kind: SceneSectionWindowHandleKind,
        valueM: number,
        frameId?: string,
      ) => void)
    | null = null;
  let orbitCenterPick: ((point: Vec3) => void) | null = null;
  let pageCameraMarkerClick: (() => void) | null = null;
  let globalPageCameraMarkerClick: ((pageId: string) => void) | null = null;

  const setOverlayBoundsCommitHandler = (
    fn: ((id: string, b: SceneOverlayDef["bounds"]) => void) | null,
  ) => {
    overlayBoundsCommit = fn;
  };
  const setLightingSourceCommitHandler = (
    fn:
      | ((id: string, patch: { position?: Vec3; target?: Vec3 }) => void)
      | null,
  ) => {
    lightingSourceCommit = fn;
  };
  const setDynamicCameraOrbitCenter = (
    point: Vec3 | null,
    direction: 1 | -1 = 1,
  ) => {
    manager.setDynamicCameraOrbitCenter(point, direction);
  };
  const setPageCameraMarker = (pose: Pose | null) => {
    manager.setPageCameraMarker(pose);
  };
  const setPageCameraMarkerClickHandler = (fn: (() => void) | null) => {
    pageCameraMarkerClick = fn;
  };
  const setGlobalPageCameraMarkers = (
    markers: PageCameraMarkerSpec[] | null,
  ) => {
    manager.setGlobalPageCameraMarkers(markers);
  };
  const setGlobalPageCameraMarkerClickHandler = (
    fn: ((pageId: string) => void) | null,
  ) => {
    globalPageCameraMarkerClick = fn;
  };
  const beginDynamicCameraOrbitCenterPick = (fn: (point: Vec3) => void) => {
    orbitCenterPick = fn;
    renderer.domElement.style.cursor = "crosshair";
  };
  const cancelDynamicCameraOrbitCenterPick = () => {
    orbitCenterPick = null;
    renderer.domElement.style.cursor = "";
    controls.enabled = true;
  };
  const setDynamicCameraOrbitCenterCommitHandler = (
    fn: ((point: Vec3) => void) | null,
  ) => {
    orbitCenterCommit = fn;
  };
  const setAreaOutlineCommitHandler = (
    fn: ((id: string, patch: AreaOutlinePreview) => void) | null,
  ) => {
    areaOutlineCommit = fn;
  };
  const setLocalAtmosphereCommitHandler = (
    fn: ((layerId: string, patch: LocalAtmospherePreview) => void) | null,
  ) => {
    localAtmosphereCommit = fn;
  };
  const setSceneSectionPlaneCommitHandler = (
    fn:
      | ((axis: SceneSectionAxis, positionM: number, frameId?: string) => void)
      | null,
  ) => {
    sceneSectionPlaneCommit = fn;
  };
  const setSceneSectionWindowCommitHandler = (
    fn:
      | ((
          axis: SceneSectionAxis,
          kind: SceneSectionWindowHandleKind,
          valueM: number,
          frameId?: string,
        ) => void)
      | null,
  ) => {
    sceneSectionWindowCommit = fn;
  };
  const setEditorMode = (on: boolean) => {
    editorMode = on;
    manager.setEditorMode(on);
    if (!on) {
      orbitCenterPick = null;
      cancelCaptureCameraPathInteraction();
      dragOrbitCenter = null;
      dragAreaOutline = null;
      dragLocalAtmosphere = null;
      dragSceneSectionPlane = null;
      manager.setHoveredSceneOverlay(null);
      renderer.domElement.style.cursor = "";
    }
  };

  const captureVecToThree = (value: CaptureVec3): THREE.Vector3 =>
    new THREE.Vector3(value[0], value[1], value[2]);
  const threeToCaptureVec = (value: THREE.Vector3): CaptureVec3 => [
    value.x,
    value.y,
    value.z,
  ];

  const createCaptureCameraPathTextLabel = (
    labelText: string,
    position: THREE.Vector3,
    scale: number,
  ): THREE.Sprite | null => {
    if (typeof document === "undefined") return null;
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 192;
    labelCanvas.height = 48;
    const labelContext = labelCanvas.getContext("2d");
    if (!labelContext) return null;
    labelContext.fillStyle = "rgba(12, 18, 24, 0.72)";
    labelContext.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    labelContext.fillStyle = "#f8fafc";
    labelContext.font = "22px Inter, system-ui, sans-serif";
    labelContext.fillText(labelText, 10, 31);
    const texture = new THREE.CanvasTexture(labelCanvas);
    const labelMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const label = new THREE.Sprite(labelMaterial);
    label.position.copy(position);
    label.scale.set(scale * 3.4, scale * 0.85, 1);
    label.renderOrder = 9_650;
    label.userData.geoseePickIgnore = true;
    label.userData.captureCameraPathOverlay = true;
    label.userData.captureCameraPathEquationLabel = labelText;
    return label;
  };

  const cancelCaptureCameraPathInteraction = () => {
    if (!dragCaptureCameraPath) return;
    dragCaptureCameraPath = null;
    controls.enabled = true;
    renderer.domElement.style.cursor = "";
    suppressNextDrillFocusClick = false;
    focusPointerDown = null;
  };

  const disposeCaptureCameraPathOverlayObjects = () => {
    captureCameraPathOverlay.traverse((node) => {
      disposeCaptureCameraPathOverlayObject(node);
    });
    captureCameraPathOverlay.clear();
  };

  const clearCaptureCameraPathOverlay = () => {
    cancelCaptureCameraPathInteraction();
    disposeCaptureCameraPathOverlayObjects();
    captureCameraPathOverlay.visible = false;
    captureCameraPathOverlayEditable = false;
    captureCameraPathSelectedKeyframeId = null;
  };

  const captureDirectorLocalTestSeamAllowed = (): boolean =>
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1");

  const recordCaptureCameraPathOverlayEvent = (options: {
    trackColor: string;
    trackLineSize: number;
    handleScale: number;
    showCameraFrustum: boolean;
    previewMonitorMode?: string;
    equationLabels?: string[];
  }): void => {
    if (!captureDirectorLocalTestSeamAllowed()) return;
    const target = window as Window & {
      __captureDirectorEvents?: Array<Record<string, unknown>>;
    };
    target.__captureDirectorEvents?.push({
      kind: "camera-path-overlay",
      renderer: "Line2",
      trackColor: options.trackColor,
      trackLineSize: options.trackLineSize,
      handleScale: options.handleScale,
      showCameraFrustum: options.showCameraFrustum,
      previewMonitorMode: options.previewMonitorMode ?? null,
      equationLabels: options.equationLabels ?? [],
    });
  };

  const setCaptureCameraPathOverlay = (
    options: CaptureCameraPathOverlayState,
  ) => {
    if (!options.visible || options.sampledPoints.length === 0) {
      clearCaptureCameraPathOverlay();
      return;
    }
    if (!options.editable) {
      cancelCaptureCameraPathInteraction();
    }
    disposeCaptureCameraPathOverlayObjects();
    captureCameraPathOverlayEditable = options.editable;
    captureCameraPathSelectedKeyframeId = options.selectedKeyframeId;
    captureCameraPathOverlay.visible =
      options.visible && options.sampledPoints.length > 0;

    const pathColor = new THREE.Color(options.colors?.path ?? "#ff6b4a");
    const selectedColor = new THREE.Color(options.colors?.selected ?? "#f8fafc");
    const keyframeColor = new THREE.Color(options.colors?.keyframe ?? "#d7dde2");
    const targetColor = new THREE.Color(options.colors?.target ?? "#7dd3fc");
    const focusColor = new THREE.Color(options.colors?.hover ?? "#facc15");
    const lineSize = Math.max(1, Math.min(12, options.lineSize ?? 3));
    const handleScale = Math.max(10, options.handleScale ?? 90);
    const showLookRays = options.showLookRays !== false;
    const showCurrentSampleMarker = options.showCurrentSampleMarker !== false;
    const showCurrentSampleLookRay =
      showLookRays && options.showCurrentSampleLookRay !== false;
    const showFocusLockRays = options.showFocusLockRays !== false;
    const lineResolution = renderer.getSize(new THREE.Vector2());

    const points = options.sampledPoints.map(captureVecToThree);
    const line = createCaptureCameraPathLine({
      points,
      color: pathColor,
      linewidth: lineSize,
      opacity: captureCameraPathCloseOpacity(points, 0.92),
      renderOrder: 9_500,
      resolution: lineResolution,
    });
    captureCameraPathOverlay.add(line);

    const overlaySegments =
      options.segments ??
      options.segmentIds.map((segmentId, index) => {
        const [fromNodeId, toNodeId] = segmentId.split(":");
        return {
          id: segmentId,
          displayIndex: index + 1,
          enabled: true,
          hidden: false,
          fromNodeId,
          toNodeId,
        };
      });

    for (const segmentMeta of overlaySegments) {
      if (segmentMeta.hidden) continue;
      const segmentEnabled = segmentMeta.enabled !== false;
      if (!segmentEnabled && !options.showTimelineGhost) continue;
      const startId = segmentMeta.fromNodeId;
      const endId = segmentMeta.toNodeId;
      const start = options.keyframes.find((keyframe) => keyframe.id === startId);
      const end = options.keyframes.find((keyframe) => keyframe.id === endId);
      if (!start || !end) continue;
      const selectedSegment = segmentMeta.id === options.selectedSegmentId;
      const segment = createCaptureCameraPathLine({
        points: [
          captureVecToThree(start.position),
          captureVecToThree(end.position),
        ],
        color: selectedSegment ? selectedColor : pathColor,
        linewidth: Math.max(12, lineSize + (selectedSegment ? 12 : 8)),
        opacity: segmentEnabled ? 0.001 : 0.0005,
        renderOrder: 9_501,
        resolution: lineResolution,
        userData: { captureCameraPathSegmentId: segmentMeta.id },
      });
      captureCameraPathOverlay.add(segment);
    }

    for (const keyframe of options.keyframes) {
      if (keyframe.hidden) continue;
      const enabled = keyframe.enabled !== false;
      if (!enabled && !options.showTimelineGhost) continue;
      const selected = keyframe.id === options.selectedKeyframeId;
      const markerSize =
        handleScale *
        (keyframe.nodeKind === "transition"
          ? CAPTURE_CAMERA_PATH_TRANSITION_MARKER_SCALE
          : CAPTURE_CAMERA_PATH_NODE_MARKER_SCALE);
      const markerGeometry = new THREE.SphereGeometry(markerSize, 18, 12);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color: selected ? selectedColor : keyframeColor,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: captureCameraPathCloseOpacity(
          [captureVecToThree(keyframe.position)],
          enabled ? (selected ? 1 : 0.88) : 0.34,
        ),
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.copy(captureVecToThree(keyframe.position));
      marker.renderOrder = 9_600;
      marker.userData.geoseePickIgnore = true;
      marker.userData.captureCameraPathOverlay = true;
      marker.userData.captureCameraPathKeyframeId = keyframe.id;
      captureCameraPathOverlay.add(marker);

      if (keyframe.target && showLookRays) {
        const focalStart = captureVecToThree(keyframe.position);
        const focalEnd = captureVecToThree(keyframe.target);
        const focalVector = focalEnd.clone().sub(focalStart);
        const focalLength = focalVector.length();
        if (focalLength > 0.000_001) {
          const focalDirection = focalVector.clone().normalize();
          const dashLength = Math.max(handleScale * 0.8, focalLength / 26);
          const gapLength = Math.max(handleScale * 0.45, dashLength * 0.52);
          let cursor = 0;
          let dashIndex = 0;
          while (cursor < focalLength && dashIndex < 72) {
            const dashEnd = Math.min(focalLength, cursor + dashLength);
            const targetRay = createCaptureCameraPathLine({
              points: [
                focalStart.clone().addScaledVector(focalDirection, cursor),
                focalStart.clone().addScaledVector(focalDirection, dashEnd),
              ],
              color: targetColor,
              linewidth: Math.max(1, lineSize * CAPTURE_CAMERA_PATH_NODE_FOCAL_LINE_WIDTH_SCALE),
              opacity: captureCameraPathCloseOpacity(
                [
                  focalStart.clone().addScaledVector(focalDirection, cursor),
                  focalStart.clone().addScaledVector(focalDirection, dashEnd),
                ],
                dashIndex % 2 === 0 ? 0.58 : 0.42,
              ),
              renderOrder: 9_520,
              resolution: lineResolution,
              userData: { captureCameraPathNodeFocalDash: true },
            });
            captureCameraPathOverlay.add(targetRay);
            cursor = dashEnd + gapLength;
            dashIndex += 1;
          }
        }

        const targetHandleGeometry = new THREE.SphereGeometry(
          handleScale * 0.72,
          16,
          10,
        );
        const targetHandleMaterial = new THREE.MeshBasicMaterial({
          color: targetColor,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: captureCameraPathCloseOpacity(
            [captureVecToThree(keyframe.target)],
            selected ? 0.95 : 0.78,
          ),
        });
        const targetHandle = new THREE.Mesh(
          targetHandleGeometry,
          targetHandleMaterial,
        );
        targetHandle.position.copy(captureVecToThree(keyframe.target));
        targetHandle.renderOrder = 9_610;
        targetHandle.userData.geoseePickIgnore = true;
        targetHandle.userData.captureCameraPathOverlay = true;
        targetHandle.userData.captureCameraPathTargetKeyframeId = keyframe.id;
        captureCameraPathOverlay.add(targetHandle);

        if (showFocusLockRays || keyframe.focusLocked) {
          const focusHandleGeometry = new THREE.TorusGeometry(
            handleScale * 1.05,
            handleScale * 0.08,
            8,
            28,
          );
          const focusHandleMaterial = new THREE.MeshBasicMaterial({
            color: keyframe.focusLocked ? focusColor : targetColor,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: captureCameraPathCloseOpacity(
              [captureVecToThree(keyframe.target)],
              selected ? 0.9 : 0.42,
            ),
          });
          const focusHandle = new THREE.Mesh(
            focusHandleGeometry,
            focusHandleMaterial,
          );
          focusHandle.position.copy(captureVecToThree(keyframe.target));
          focusHandle.renderOrder = 9_611;
          focusHandle.userData.geoseePickIgnore = true;
          focusHandle.userData.captureCameraPathOverlay = true;
          focusHandle.userData.captureCameraPathFocusKeyframeId = keyframe.id;
          captureCameraPathOverlay.add(focusHandle);
        }
      }

      if (options.showNodeLabels && typeof document !== "undefined") {
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 192;
        labelCanvas.height = 48;
        const labelContext = labelCanvas.getContext("2d");
        if (labelContext) {
          labelContext.fillStyle = "rgba(12, 18, 24, 0.72)";
          labelContext.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
          labelContext.fillStyle = "#f8fafc";
          labelContext.font = "22px Inter, system-ui, sans-serif";
          labelContext.fillText(
            `${keyframe.nodeKind === "transition" ? "T" : "K"} ${keyframe.id}`,
            10,
            31,
          );
          const texture = new THREE.CanvasTexture(labelCanvas);
          const labelMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
          });
          const label = new THREE.Sprite(labelMaterial);
          label.position.copy(captureVecToThree(keyframe.position));
          label.position.z += handleScale * 1.6;
          label.scale.set(handleScale * 3.4, handleScale * 0.85, 1);
          label.renderOrder = 9_650;
          label.userData.geoseePickIgnore = true;
          label.userData.captureCameraPathOverlay = true;
          captureCameraPathOverlay.add(label);
        }
      }
    }

    for (const handle of options.splineHandles ?? []) {
      const handlePosition = captureVecToThree(handle.position);
      const anchor = captureVecToThree(handle.anchor);
      const splineColor = handle.side === "out" ? targetColor : focusColor;
      const splineLine = createCaptureCameraPathLine({
        points: [anchor, handlePosition],
        color: splineColor,
        linewidth: Math.max(1, lineSize * 0.9),
        opacity: captureCameraPathCloseOpacity(
          [anchor, handlePosition],
          handle.tangentCoupled ? 0.86 : 0.72,
        ),
        renderOrder: 9_735,
        resolution: lineResolution,
        userData: {
          captureCameraPathSplineHandleNodeId: handle.nodeId,
          captureCameraPathSplineHandleSide: handle.side,
        },
      });
      captureCameraPathOverlay.add(splineLine);
      const splineHandle = new THREE.Mesh(
        new THREE.SphereGeometry(handleScale * 0.42, 12, 8),
        new THREE.MeshBasicMaterial({
          color: splineColor,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: captureCameraPathCloseOpacity([handlePosition], 0.9),
        }),
      );
      splineHandle.position.copy(handlePosition);
      splineHandle.renderOrder = 9_736;
      splineHandle.userData.geoseePickIgnore = true;
      splineHandle.userData.captureCameraPathOverlay = true;
      splineHandle.userData.captureCameraPathSplineHandleNodeId = handle.nodeId;
      splineHandle.userData.captureCameraPathSplineHandleSide = handle.side;
      captureCameraPathOverlay.add(splineHandle);
      if (options.showNodeLabels && handle.label) {
        const label = createCaptureCameraPathTextLabel(
          handle.label,
          handlePosition.clone().add(new THREE.Vector3(0, 0, handleScale * 0.52)),
          handleScale * 0.48,
        );
        if (label) captureCameraPathOverlay.add(label);
      }
    }

    const axisColors: Record<"x" | "y" | "z", THREE.Color> = {
      x: new THREE.Color("#ef4444"),
      y: new THREE.Color("#22c55e"),
      z: new THREE.Color("#3b82f6"),
    };
    for (const axisHandle of options.nodeAxisHandles ?? []) {
      const start = captureVecToThree(axisHandle.start);
      const end = captureVecToThree(axisHandle.end);
      const axisLine = createCaptureCameraPathLine({
        points: [start, end],
        color: axisColors[axisHandle.axis],
        linewidth: Math.max(2, lineSize),
        opacity: captureCameraPathCloseOpacity([start, end], 0.88),
        renderOrder: 9_738,
        resolution: lineResolution,
        userData: {
          captureCameraPathNodeAxisNodeId: axisHandle.nodeId,
          captureCameraPathNodeAxis: axisHandle.axis,
        },
      });
      captureCameraPathOverlay.add(axisLine);
      const axisHandleMesh = new THREE.Mesh(
        new THREE.SphereGeometry(handleScale * 0.36, 12, 8),
        new THREE.MeshBasicMaterial({
          color: axisColors[axisHandle.axis],
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: captureCameraPathCloseOpacity([end], 0.92),
        }),
      );
      axisHandleMesh.position.copy(end);
      axisHandleMesh.renderOrder = 9_739;
      axisHandleMesh.userData.geoseePickIgnore = true;
      axisHandleMesh.userData.captureCameraPathOverlay = true;
      axisHandleMesh.userData.captureCameraPathNodeAxisNodeId = axisHandle.nodeId;
      axisHandleMesh.userData.captureCameraPathNodeAxis = axisHandle.axis;
      captureCameraPathOverlay.add(axisHandleMesh);
    }

    const equationOptions = options.equationOptions;
    const equationOverlayVisible =
      options.editable && equationOptions?.visible === true;
    const equationSegmentAllowed = (segmentId?: string): boolean => {
      if (!equationOverlayVisible) return false;
      if (!equationOptions?.selectedTransitionOnly) return true;
      return !!segmentId && segmentId === options.selectedSegmentId;
    };

    if (equationOverlayVisible && equationOptions) {
      const equationColor = new THREE.Color("#f8fafc");
      const tangentColor = new THREE.Color("#a78bfa");
      const influenceColor = new THREE.Color("#facc15");
      const curvatureColor = new THREE.Color("#34d399");
      const focusDistanceColor = new THREE.Color(options.colors?.hover ?? "#facc15");

      if (equationOptions.showTemporalRamp !== false) {
        for (const equation of options.transitionEquations ?? []) {
          if (equation.visible === false) continue;
          if (!equationSegmentAllowed(equation.segmentId)) continue;
          const labelText =
            equation.label ??
            [equation.timeCurve, equation.continuity].filter(Boolean).join(" ");
          if (equation.position && equation.anchor) {
            const equationStart = captureVecToThree(equation.anchor);
            const equationEnd = captureVecToThree(equation.position);
            const equationLine = createCaptureCameraPathLine({
              points: [equationStart, equationEnd],
              color: equationColor,
              linewidth: Math.max(1, lineSize * 0.8),
              opacity: captureCameraPathCloseOpacity([equationStart, equationEnd], 0.72),
              renderOrder: 9_700,
              resolution: lineResolution,
              userData: {
                captureCameraPathEquationKind: "transition-equation",
                captureCameraPathEquationLabel: labelText || equation.id,
                captureCameraPathEquationSegmentId: equation.segmentId,
              },
            });
            captureCameraPathOverlay.add(equationLine);
          }
          if (equation.position) {
            const equationHandle = new THREE.Mesh(
              new THREE.SphereGeometry(handleScale * 0.34, 12, 8),
              new THREE.MeshBasicMaterial({
                color: equationColor,
                depthTest: false,
                depthWrite: false,
                transparent: true,
                opacity: captureCameraPathCloseOpacity(
                  [captureVecToThree(equation.position)],
                  0.84,
                ),
              }),
            );
            equationHandle.position.copy(captureVecToThree(equation.position));
            equationHandle.renderOrder = 9_705;
            equationHandle.userData.geoseePickIgnore = true;
            equationHandle.userData.captureCameraPathOverlay = true;
            equationHandle.userData.captureCameraPathEquationOverlay = true;
            equationHandle.userData.captureCameraPathEquationSegmentId =
              equation.segmentId;
            captureCameraPathOverlay.add(equationHandle);
            if (equationOptions.showStackLabels !== false && labelText) {
              const label = createCaptureCameraPathTextLabel(
                labelText,
                captureVecToThree(equation.position).add(
                  new THREE.Vector3(0, 0, handleScale * 0.8),
                ),
                handleScale * 0.68,
              );
              if (label) captureCameraPathOverlay.add(label);
            }
          }
        }
      }

      if (equationOptions.showTangents !== false) {
        for (const handle of options.tangentHandles ?? []) {
          if (!equationSegmentAllowed(handle.segmentId)) continue;
          const tangentStart = captureVecToThree(handle.start);
          const tangentEnd = captureVecToThree(handle.end);
          const tangentLine = createCaptureCameraPathLine({
            points: [tangentStart, tangentEnd],
            color: tangentColor,
            linewidth: Math.max(1, lineSize * 0.85),
            opacity: captureCameraPathCloseOpacity([tangentStart, tangentEnd], 0.74),
            renderOrder: 9_710,
            resolution: lineResolution,
            userData: {
              captureCameraPathEquationKind: "tangent",
              captureCameraPathEquationLabel: handle.label ?? "T",
            },
          });
          captureCameraPathOverlay.add(tangentLine);
        }
      }

      if (equationOptions.showInfluenceHandles !== false) {
        for (const handle of options.influenceHandles ?? []) {
          if (!equationSegmentAllowed(handle.segmentId)) continue;
          const handlePosition = captureVecToThree(handle.position);
          if (handle.anchor) {
            const influenceStart = captureVecToThree(handle.anchor);
            const influenceLine = createCaptureCameraPathLine({
              points: [influenceStart, handlePosition],
              color: influenceColor,
              linewidth: Math.max(1, lineSize * 0.8),
              opacity: captureCameraPathCloseOpacity([influenceStart, handlePosition], 0.72),
              renderOrder: 9_720,
              resolution: lineResolution,
              userData: {
                captureCameraPathEquationKind: "influence",
                captureCameraPathEquationLabel: handle.label ?? "Gd",
                captureCameraPathInfluenceHandleId: handle.id,
              },
            });
            captureCameraPathOverlay.add(influenceLine);
          }
          const influenceHandle = new THREE.Mesh(
            new THREE.SphereGeometry(handleScale * 0.34, 12, 8),
            new THREE.MeshBasicMaterial({
              color: influenceColor,
              depthTest: false,
              depthWrite: false,
              transparent: true,
              opacity: captureCameraPathCloseOpacity([handlePosition], 0.86),
            }),
          );
          influenceHandle.position.copy(handlePosition);
          influenceHandle.renderOrder = 9_725;
          influenceHandle.userData.geoseePickIgnore = true;
          influenceHandle.userData.captureCameraPathOverlay = true;
          influenceHandle.userData.captureCameraPathEquationOverlay = true;
          influenceHandle.userData.captureCameraPathInfluenceHandleId = handle.id;
          captureCameraPathOverlay.add(influenceHandle);
        }
      }

      if (equationOptions.showCurvatureComb !== false) {
        for (const comb of options.curvatureComb ?? []) {
          if (!equationSegmentAllowed(comb.segmentId)) continue;
          for (const [index, sample] of comb.samples.entries()) {
            const start = captureVecToThree(sample.position);
            const normal = captureVecToThree(sample.normal);
            if (normal.lengthSq() <= 0.000_001 || sample.length <= 0) continue;
            const end = start
              .clone()
              .add(normal.normalize().multiplyScalar(sample.length));
            const combLine = createCaptureCameraPathLine({
              points: [start, end],
              color: curvatureColor,
              linewidth: Math.max(1, lineSize * 0.55),
              opacity: captureCameraPathCloseOpacity([start, end], 0.54),
              renderOrder: 9_715,
              resolution: lineResolution,
              userData: {
                captureCameraPathEquationKind: "curvature-comb",
                captureCameraPathEquationLabel: `G ${index + 1}`,
              },
            });
            captureCameraPathOverlay.add(combLine);
          }
        }
      }

      if (equationOptions.showFocusDistance !== false) {
        for (const vector of options.focusDistanceVectors ?? []) {
          if (!equationSegmentAllowed(vector.segmentId)) continue;
          const focusStart = captureVecToThree(vector.start);
          const focusEnd = captureVecToThree(vector.end);
          const focusLine = createCaptureCameraPathLine({
            points: [focusStart, focusEnd],
            color: focusDistanceColor,
            linewidth: Math.max(1, lineSize * 0.9),
            opacity: captureCameraPathCloseOpacity([focusStart, focusEnd], 0.8),
            renderOrder: 9_730,
            resolution: lineResolution,
            userData: {
              captureCameraPathEquationKind: "focus-distance",
              captureCameraPathEquationLabel: vector.label ?? "D",
              captureCameraPathFocusDistanceId: vector.id,
            },
          });
          captureCameraPathOverlay.add(focusLine);
        }
      }
    }

    if (options.currentSample && showCurrentSampleMarker) {
      const samplePosition = captureVecToThree(options.currentSample.position);
      const sampleTarget = captureVecToThree(options.currentSample.target);
      const cameraPathPreviewBallColor = targetColor;
      const cameraPathPreviewDashColor = selectedColor;
      const cameraPathPreviewTargetColor = new THREE.Color("#ffd15c");
      const sampleGeometry = new THREE.SphereGeometry(
        handleScale * CAPTURE_CAMERA_PATH_SAMPLE_MARKER_SCALE,
        24,
        16,
      );
      const sampleMaterial = new THREE.MeshBasicMaterial({
        color: cameraPathPreviewBallColor,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: captureCameraPathCloseOpacity([samplePosition], 0.96),
      });
      const sampleMarker = new THREE.Mesh(sampleGeometry, sampleMaterial);
      sampleMarker.position.copy(samplePosition);
      sampleMarker.renderOrder = 9_680;
      sampleMarker.userData.geoseePickIgnore = true;
      sampleMarker.userData.captureCameraPathOverlay = true;
      sampleMarker.userData.captureCameraPathCurrentSampleMarker = true;
      captureCameraPathOverlay.add(sampleMarker);

      if (showCurrentSampleLookRay) {
        const viewVector = sampleTarget.clone().sub(samplePosition);
        const viewLength = viewVector.length();
        if (viewLength > 0.000_001) {
          const direction = viewVector.clone().normalize();
          const dashLength = Math.max(handleScale * 1.2, viewLength / 28);
          const gapLength = Math.max(handleScale * 0.7, dashLength * 0.58);
          const previewDashSegments: Array<[THREE.Vector3, THREE.Vector3]> = [];
          let cursor = 0;
          while (cursor < viewLength && previewDashSegments.length < 64) {
            const dashEnd = Math.min(viewLength, cursor + dashLength);
            previewDashSegments.push([
              samplePosition.clone().add(direction.clone().multiplyScalar(cursor)),
              samplePosition.clone().add(direction.clone().multiplyScalar(dashEnd)),
            ]);
            cursor = dashEnd + gapLength;
          }
          for (const [index, dash] of previewDashSegments.entries()) {
            const ray = createCaptureCameraPathLine({
              points: dash,
              color: cameraPathPreviewDashColor,
              linewidth: Math.max(1, lineSize * 0.575),
              opacity: captureCameraPathCloseOpacity(dash, index % 2 === 0 ? 0.92 : 0.7),
              renderOrder: 9_690,
              resolution: lineResolution,
              userData: { captureCameraPathCurrentSampleLookDash: true },
            });
            captureCameraPathOverlay.add(ray);
          }
          const targetGeometry = new THREE.SphereGeometry(handleScale * 0.58, 18, 12);
          const targetMaterial = new THREE.MeshBasicMaterial({
            color: cameraPathPreviewTargetColor,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: captureCameraPathCloseOpacity([sampleTarget], 0.94),
          });
          const targetMarker = new THREE.Mesh(targetGeometry, targetMaterial);
          targetMarker.position.copy(sampleTarget);
          targetMarker.renderOrder = 9_692;
          targetMarker.userData.geoseePickIgnore = true;
          targetMarker.userData.captureCameraPathOverlay = true;
          targetMarker.userData.captureCameraPathCurrentSampleTarget = true;
          captureCameraPathOverlay.add(targetMarker);
        }
      }

      if (options.showCameraFrustum) {
        const previewCamera = new THREE.PerspectiveCamera(
          options.currentSample.fov,
          16 / 9,
          CAMERA_NEAR_M,
          CAMERA_FAR_M,
        );
        previewCamera.position.copy(samplePosition);
        previewCamera.up.set(
          options.currentSample.up[0],
          options.currentSample.up[1],
          options.currentSample.up[2],
        );
        previewCamera.lookAt(sampleTarget);
        previewCamera.updateProjectionMatrix();
        previewCamera.updateMatrixWorld(true);
        const helper = new THREE.CameraHelper(previewCamera);
        helper.renderOrder = 9_640;
        helper.userData.geoseePickIgnore = true;
        helper.userData.captureCameraPathOverlay = true;
        for (const child of helper.children) {
          child.userData.geoseePickIgnore = true;
        }
        captureCameraPathOverlay.add(helper);
      }
    }

    recordCaptureCameraPathOverlayEvent({
      trackColor: options.colors?.path ?? "#ff6b4a",
      trackLineSize: lineSize,
      handleScale,
      showCameraFrustum: options.showCameraFrustum === true,
      previewMonitorMode: options.previewMonitorMode,
      equationLabels: (options.transitionEquations ?? [])
        .filter((equation) => equation.visible !== false)
        .map((equation) => equation.label ?? equation.id),
    });
  };

  const setCaptureCameraPathInteraction = (
    options: CaptureCameraPathInteractionOptions,
  ) => {
    captureCameraPathInteraction = options;
    setCaptureCameraPathPickCursor();
    return () => {
      if (captureCameraPathInteraction === options) {
        cancelCaptureCameraPathInteraction();
        captureCameraPathInteraction = null;
        renderer.domElement.style.cursor = "";
      }
    };
  };

  const pickCaptureCameraPathHandle = (
    clientX: number,
    clientY: number,
  ):
    | { type: "keyframe"; id: string; world: THREE.Vector3 }
    | { type: "segment"; id: string; world: THREE.Vector3 }
    | { type: "target"; id: string; world: THREE.Vector3 }
    | { type: "focus"; id: string; world: THREE.Vector3 }
    | { type: "influence"; id: string; world: THREE.Vector3 }
    | { type: "spline-handle"; id: string; side: "in" | "out"; world: THREE.Vector3 }
    | { type: "node-axis"; id: string; axis: "x" | "y" | "z"; world: THREE.Vector3 }
    | { type: "focus-distance"; id: string; world: THREE.Vector3 }
    | { type: "equation-segment"; id: string; world: THREE.Vector3 }
    | null => {
    if (!captureCameraPathOverlay.visible || !captureCameraPathOverlayEditable) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(captureCameraPathOverlay.children, true);
    for (const hit of hits) {
      const data = hit.object.userData as {
        captureCameraPathKeyframeId?: string;
        captureCameraPathSegmentId?: string;
        captureCameraPathTargetKeyframeId?: string;
        captureCameraPathFocusKeyframeId?: string;
        captureCameraPathInfluenceHandleId?: string;
        captureCameraPathSplineHandleNodeId?: string;
        captureCameraPathSplineHandleSide?: "in" | "out";
        captureCameraPathNodeAxisNodeId?: string;
        captureCameraPathNodeAxis?: "x" | "y" | "z";
        captureCameraPathFocusDistanceId?: string;
        captureCameraPathEquationSegmentId?: string;
      };
      if (data.captureCameraPathKeyframeId) {
        return {
          type: "keyframe",
          id: data.captureCameraPathKeyframeId,
          world: hit.point.clone(),
        };
      }
      if (data.captureCameraPathTargetKeyframeId) {
        return {
          type: "target",
          id: data.captureCameraPathTargetKeyframeId,
          world: hit.point.clone(),
        };
      }
      if (data.captureCameraPathFocusKeyframeId) {
        return {
          type: "focus",
          id: data.captureCameraPathFocusKeyframeId,
          world: hit.point.clone(),
        };
      }
      if (data.captureCameraPathInfluenceHandleId) {
        return {
          type: "influence",
          id: data.captureCameraPathInfluenceHandleId,
          world: hit.point.clone(),
        };
      }
      if (
        data.captureCameraPathSplineHandleNodeId &&
        data.captureCameraPathSplineHandleSide
      ) {
        return {
          type: "spline-handle",
          id: data.captureCameraPathSplineHandleNodeId,
          side: data.captureCameraPathSplineHandleSide,
          world: hit.point.clone(),
        };
      }
      if (data.captureCameraPathNodeAxisNodeId && data.captureCameraPathNodeAxis) {
        return {
          type: "node-axis",
          id: data.captureCameraPathNodeAxisNodeId,
          axis: data.captureCameraPathNodeAxis,
          world: hit.point.clone(),
        };
      }
      if (data.captureCameraPathFocusDistanceId) {
        return {
          type: "focus-distance",
          id: data.captureCameraPathFocusDistanceId,
          world: hit.point.clone(),
        };
      }
      if (data.captureCameraPathEquationSegmentId) {
        return {
          type: "equation-segment",
          id: data.captureCameraPathEquationSegmentId,
          world: hit.point.clone(),
        };
      }
      if (data.captureCameraPathSegmentId) {
        return {
          type: "segment",
          id: data.captureCameraPathSegmentId,
          world: hit.point.clone(),
        };
      }
    }
    return null;
  };

  // Pick the first overlay outline (or its paired texture mesh) under
  // the cursor. Returns id + world-space hit point (used as the drag
  // anchor so subsequent moves compute a delta).
  const pickOverlay = (
    clientX: number,
    clientY: number,
  ): { id: string; world: THREE.Vector3 } | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    // Overlay meshes live in __scene_overlays__ which is NOT in the
    // layer registry. Walk via the manager's overlay list.
    const meshes: THREE.Object3D[] = [];
    for (const h of manager.listSceneOverlays()) {
      meshes.push(h.outlineMesh, h.mesh);
    }
    const hits = raycaster.intersectObjects(meshes, false);
    for (const hit of hits) {
      const id = (hit.object.userData as { sceneOverlayId?: string })
        .sceneOverlayId;
      if (id) return { id, world: hit.point.clone() };
    }
    return null;
  };

  const pickLightingHandle = (
    clientX: number,
    clientY: number,
  ): {
    sourceId: string;
    kind: "position" | "target";
    mode: "plane" | "height";
    world: THREE.Vector3;
  } | null => {
    const pickables = manager.listLightingHandlePickables();
    if (pickables.length === 0) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    for (const hit of hits) {
      const data = hit.object.userData as {
        lightingHandle?: boolean;
        lightingSourceId?: string;
        lightingHandleKind?: "position" | "target";
        lightingHandleMode?: "plane" | "height";
      };
      if (
        data.lightingHandle === true &&
        data.lightingSourceId &&
        data.lightingHandleKind &&
        data.lightingHandleMode
      ) {
        return {
          sourceId: data.lightingSourceId,
          kind: data.lightingHandleKind,
          mode: data.lightingHandleMode,
          world: hit.point.clone(),
        };
      }
    }
    return null;
  };

  // World-space cursor projected onto the horizontal plane at z = anchorZ.
  // Used during drag to compute a 1:1 delta that matches the camera's
  // current angle on the terrain.
  const tmpPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const projectCursorToPlane = (
    clientX: number,
    clientY: number,
    anchorZ: number,
    out: THREE.Vector3,
  ): boolean => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    tmpPlane.constant = -anchorZ;
    return raycaster.ray.intersectPlane(tmpPlane, out) !== null;
  };

  const pickMapPoint = (
    clientX: number,
    clientY: number,
    fallbackZ = 0,
  ): THREE.Vector3 | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const terrain = manager.getLayer("terrain");
    if (terrain) {
      const hits = raycaster.intersectObjects([terrain], true);
      if (hits.length > 0) return hits[0].point.clone();
    }
    const fallback = new THREE.Vector3();
    return projectCursorToPlane(clientX, clientY, fallbackZ, fallback)
      ? fallback.clone()
      : null;
  };

  const captureCameraPathFocusBindId = (): string | null =>
    captureCameraPathInteraction?.bindFocusKeyframeId ??
    captureCameraPathSelectedKeyframeId;

  const setCaptureCameraPathPickCursor = (): boolean => {
    const pendingFocusPick =
      !!captureCameraPathInteraction?.onBindFocusPoint &&
      !!captureCameraPathFocusBindId();
    if (pendingFocusPick) {
      renderer.domElement.style.cursor = CAPTURE_CAMERA_PATH_WHITE_CROSSHAIR_CURSOR;
      return true;
    }
    return false;
  };

  const resolveCaptureCameraPathFocusPoint = (
    clientX: number,
    clientY: number,
  ): THREE.Vector3 | null => {
    const sceneTarget = pickSceneTarget(clientX, clientY);
    if (sceneTarget?.worldPoint) {
      return captureVecToThree(sceneTarget.worldPoint);
    }
    return pickMapPoint(clientX, clientY);
  };

  const pickOrbitCenterHandle = (
    clientX: number,
    clientY: number,
  ): { world: THREE.Vector3; mode: OrbitCenterHandleMode } | null => {
    const pickables = manager.listDynamicCameraOrbitCenterPickables();
    if (pickables.length === 0) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    for (const hit of hits) {
      const data = hit.object.userData as {
        dynamicCameraOrbitCenter?: boolean;
        dynamicCameraOrbitCenterMode?: OrbitCenterHandleMode;
      };
      if (data.dynamicCameraOrbitCenter === true) {
        return {
          world: hit.point.clone(),
          mode: data.dynamicCameraOrbitCenterMode ?? "plane",
        };
      }
    }
    return null;
  };

  const pickAreaOutlineHandle = (
    clientX: number,
    clientY: number,
  ): { id: string; mode: AreaOutlineHandleMode; world: THREE.Vector3 } | null => {
    const pickables = manager.listAreaOutlinePickables();
    if (pickables.length === 0) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    for (const hit of hits) {
      const data = hit.object.userData as {
        areaOutlineEditorHandle?: boolean;
        areaOutlineId?: string;
        areaOutlineHandleMode?: AreaOutlineHandleMode;
      };
      if (
        data.areaOutlineEditorHandle === true &&
        data.areaOutlineId &&
        data.areaOutlineHandleMode
      ) {
        return {
          id: data.areaOutlineId,
          mode: data.areaOutlineHandleMode,
          world: hit.point.clone(),
        };
      }
    }
    return null;
  };

  const pickLocalAtmosphereHandle = (
    clientX: number,
    clientY: number,
  ): {
    layerId: string;
    mode: LocalAtmosphereHandleMode;
    world: THREE.Vector3;
  } | null => {
    const pickables = manager.listLocalAtmospherePickables();
    if (pickables.length === 0) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    for (const hit of hits) {
      const data = hit.object.userData as {
        localAtmosphereEditorHandle?: boolean;
        localAtmosphereLayerId?: string;
        localAtmosphereHandleMode?: LocalAtmosphereHandleMode;
      };
      if (
        data.localAtmosphereEditorHandle === true &&
        data.localAtmosphereLayerId &&
        data.localAtmosphereHandleMode
      ) {
        return {
          layerId: data.localAtmosphereLayerId,
          mode: data.localAtmosphereHandleMode,
          world: hit.point.clone(),
        };
      }
    }
    return null;
  };

  const pickSceneSectionPlaneHandle = (
    clientX: number,
    clientY: number,
  ): SceneSectionHandlePick | null => {
    const pickables = manager.listSceneSectionPlanePickables();
    if (pickables.length === 0) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    for (const hit of hits) {
      const data = hit.object.userData as {
        sceneSectionPlaneHandle?: boolean;
        sceneSectionAxis?: SceneSectionAxis;
        sceneSectionFrameId?: string;
        sceneSectionPlaneHandleKind?: string;
      };
      if (
        data.sceneSectionPlaneHandle === true &&
        (data.sceneSectionAxis === "x" ||
          data.sceneSectionAxis === "y" ||
          data.sceneSectionAxis === "z")
      ) {
        const kind =
          sceneSectionHandleKind(data.sceneSectionPlaneHandleKind) ?? "plane";
        return {
          axis: data.sceneSectionAxis,
          frameId:
            typeof data.sceneSectionFrameId === "string"
              ? data.sceneSectionFrameId
              : undefined,
          kind,
          world: hit.point.clone(),
        };
      }
    }
    return null;
  };

  const beginSceneSectionHandleDrag = (
    sceneSectionHandle: SceneSectionHandlePick,
    ev: MouseEvent,
  ): void => {
    suppressNextDrillFocusClick = true;
    const normal =
      sceneSectionHandle.kind === "plane"
        ? (manager.getSceneSectionPlaneNormal(
            sceneSectionHandle.axis,
            sceneSectionHandle.frameId,
          ) ??
          (sceneSectionHandle.axis === "x"
            ? new THREE.Vector3(1, 0, 0)
            : sceneSectionHandle.axis === "y"
              ? new THREE.Vector3(0, 1, 0)
              : new THREE.Vector3(0, 0, 1)))
        : (manager.getSceneSectionWindowNormal(
            sceneSectionHandle.axis,
            sceneSectionHandle.kind,
            sceneSectionHandle.frameId,
          ) ??
          sceneSectionFrameDragNormal(
            sceneSectionHandle.axis,
            sceneSectionHandle.kind,
          ));
    const originalPosition =
      sceneSectionHandle.kind === "plane"
        ? (manager.getSceneSectionPlaneScalar(
            sceneSectionHandle.axis,
            sceneSectionHandle.frameId,
          ) ??
          sceneSectionHandle.world.dot(normal))
        : (manager.getSceneSectionWindowValue(
            sceneSectionHandle.axis,
            sceneSectionHandle.kind,
            sceneSectionHandle.frameId,
          ) ?? sceneSectionHandle.world.dot(normal));
    const rect = renderer.domElement.getBoundingClientRect();
    const dragProjection = sceneSectionScreenDragProjection(
      camera,
      sceneSectionHandle.world,
      normal,
      rect,
    );
    dragSceneSectionPlane = {
      axis: sceneSectionHandle.axis,
      frameId: sceneSectionHandle.frameId,
      kind: sceneSectionHandle.kind,
      originalPositionM: originalPosition,
      startClient: new THREE.Vector2(ev.clientX, ev.clientY),
      screenAxis: dragProjection.screenAxis,
      metersPerPixel: dragProjection.metersPerPixel,
    };
    controls.enabled = false;
    renderer.domElement.style.cursor = "grabbing";
    ev.preventDefault();
  };

  const pickPageCameraMarker = (
    clientX: number,
    clientY: number,
  ): { kind: "current" | "global"; pageId: string } | null => {
    const pickables = manager.listPageCameraMarkerPickables();
    if (pickables.length === 0) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickables, false);
    for (const hit of hits) {
      const data = hit.object.userData as {
        pageCameraMarker?: boolean;
        pageCameraMarkerKind?: "current" | "global";
        pageCameraMarkerId?: string;
      };
      if (data.pageCameraMarker === true && data.pageCameraMarkerId) {
        return {
          kind: data.pageCameraMarkerKind ?? "current",
          pageId: data.pageCameraMarkerId,
        };
      }
    }
    return null;
  };

  const onCanvasMouseMove = (ev: MouseEvent) => {
    if (dragCaptureCameraPath) {
      const cur = new THREE.Vector3();
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(dragCaptureCameraPath.dragPlane, cur)) {
        if (dragCaptureCameraPath.type === "keyframe") {
          captureCameraPathInteraction?.onMoveKeyframe?.(
            dragCaptureCameraPath.id,
            threeToCaptureVec(cur),
          );
        } else if (dragCaptureCameraPath.type === "target") {
          captureCameraPathInteraction?.onMoveTarget?.(
            dragCaptureCameraPath.id,
            threeToCaptureVec(cur),
          );
        } else if (dragCaptureCameraPath.type === "influence") {
          captureCameraPathInteraction?.onMoveInfluenceHandle?.(
            dragCaptureCameraPath.id,
            threeToCaptureVec(cur),
          );
        } else if (dragCaptureCameraPath.type === "spline-handle") {
          if (dragCaptureCameraPath.side) {
            captureCameraPathInteraction?.onMoveSplineHandle?.(
              dragCaptureCameraPath.id,
              dragCaptureCameraPath.side,
              threeToCaptureVec(cur),
            );
          }
        } else if (dragCaptureCameraPath.type === "node-axis") {
          if (dragCaptureCameraPath.axis) {
            const deltaVector = cur.clone().sub(dragCaptureCameraPath.lastWorld);
            const axisVector =
              dragCaptureCameraPath.axis === "x"
                ? new THREE.Vector3(1, 0, 0)
                : dragCaptureCameraPath.axis === "y"
                  ? new THREE.Vector3(0, 1, 0)
                  : new THREE.Vector3(0, 0, 1);
            captureCameraPathInteraction?.onMoveNodeAxis?.(
              dragCaptureCameraPath.id,
              dragCaptureCameraPath.axis,
              deltaVector.dot(axisVector),
            );
            dragCaptureCameraPath.lastWorld.copy(cur);
          }
        } else if (dragCaptureCameraPath.type === "focus-distance") {
          captureCameraPathInteraction?.onMoveFocusDistance?.(
            dragCaptureCameraPath.id,
            threeToCaptureVec(cur),
          );
        } else {
          const delta = cur.clone().sub(dragCaptureCameraPath.lastWorld);
          captureCameraPathInteraction?.onMoveSegment?.(
            dragCaptureCameraPath.id,
            threeToCaptureVec(delta),
          );
          dragCaptureCameraPath.lastWorld.copy(cur);
        }
      }
      return;
    }
    if (dragSceneSectionPlane) {
      const pointerDelta = new THREE.Vector2(
        ev.clientX - dragSceneSectionPlane.startClient.x,
        ev.clientY - dragSceneSectionPlane.startClient.y,
      );
      const positionM = THREE.MathUtils.clamp(
        dragSceneSectionPlane.originalPositionM +
          pointerDelta.dot(dragSceneSectionPlane.screenAxis) *
            dragSceneSectionPlane.metersPerPixel,
        -250_000,
        250_000,
      );
      if (dragSceneSectionPlane.kind === "plane") {
        manager.previewSceneSectionPlane(
          dragSceneSectionPlane.axis,
          positionM,
          dragSceneSectionPlane.frameId,
        );
      } else {
        manager.previewSceneSectionWindow(
          dragSceneSectionPlane.axis,
          dragSceneSectionPlane.kind,
          positionM,
          dragSceneSectionPlane.frameId,
        );
      }
      return;
    }

    if (dragAreaOutline) {
      const cur = new THREE.Vector3();
      if (projectCursorToPlane(ev.clientX, ev.clientY, dragAreaOutline.original.z, cur)) {
        if (dragAreaOutline.mode === "move") {
          manager.previewAreaOutlineMove(
            dragAreaOutline.id,
            new THREE.Vector3(
              cur.x - dragAreaOutline.grabOffset.x,
              cur.y - dragAreaOutline.grabOffset.y,
              dragAreaOutline.original.z,
            ),
          );
        } else {
          manager.previewAreaOutlineScaleFromWorld(
            dragAreaOutline.id,
            dragAreaOutline.mode,
            cur,
          );
        }
      }
      return;
    }

    if (dragLocalAtmosphere) {
      const cur = new THREE.Vector3();
      if (dragLocalAtmosphere.mode === "sizeZ" && dragLocalAtmosphere.dragPlane) {
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(dragLocalAtmosphere.dragPlane, cur)) {
          manager.previewLocalAtmosphereSizeFromWorld(
            dragLocalAtmosphere.layerId,
            "sizeZ",
            cur,
          );
        }
      } else if (
        projectCursorToPlane(
          ev.clientX,
          ev.clientY,
          dragLocalAtmosphere.original.z,
          cur,
        )
      ) {
        if (dragLocalAtmosphere.mode === "move") {
          manager.previewLocalAtmosphereMove(
            dragLocalAtmosphere.layerId,
            new THREE.Vector3(
              cur.x - dragLocalAtmosphere.grabOffset.x,
              cur.y - dragLocalAtmosphere.grabOffset.y,
              dragLocalAtmosphere.original.z,
            ),
          );
        } else {
          manager.previewLocalAtmosphereSizeFromWorld(
            dragLocalAtmosphere.layerId,
            dragLocalAtmosphere.mode,
            cur,
          );
        }
      }
      return;
    }

    if (dragOrbitCenter) {
      const next = dragOrbitCenter.original.clone();
      if (dragOrbitCenter.mode === "z" && dragOrbitCenter.dragPlane) {
        const cur = new THREE.Vector3();
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(dragOrbitCenter.dragPlane, cur)) {
          next.z = THREE.MathUtils.clamp(
            cur.z - dragOrbitCenter.grabOffset.z,
            -2000,
            12000,
          );
        }
      } else {
        const cur = new THREE.Vector3();
        if (projectCursorToPlane(ev.clientX, ev.clientY, dragOrbitCenter.original.z, cur)) {
          if (dragOrbitCenter.mode === "x") {
            next.x = cur.x - dragOrbitCenter.grabOffset.x;
          } else if (dragOrbitCenter.mode === "y") {
            next.y = cur.y - dragOrbitCenter.grabOffset.y;
          } else {
            next.x = cur.x - dragOrbitCenter.grabOffset.x;
            next.y = cur.y - dragOrbitCenter.grabOffset.y;
          }
        }
      }
      manager.previewDynamicCameraOrbitCenter(next);
      return;
    }

    // Drag in flight: move the editor-only light handle and the live light.
    if (dragLight) {
      const next = dragLight.original.clone();
      if (dragLight.mode === "height" && dragLight.dragPlane) {
        const cur = new THREE.Vector3();
        const rect = renderer.domElement.getBoundingClientRect();
        ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        if (raycaster.ray.intersectPlane(dragLight.dragPlane, cur)) {
          next.z = THREE.MathUtils.clamp(cur.z, -2000, 12000);
        }
      } else {
        const cur = new THREE.Vector3();
        if (projectCursorToPlane(ev.clientX, ev.clientY, dragLight.original.z, cur)) {
          next.x = cur.x;
          next.y = cur.y;
        }
      }
      manager.previewLightingHandle(dragLight.sourceId, dragLight.kind, next);
      return;
    }

    // Drag in flight: translate the overlay's meshes for live feedback.
    if (dragOverlayId && dragStartWorld && dragStartBoundsScene) {
      const cur = new THREE.Vector3();
      if (projectCursorToPlane(ev.clientX, ev.clientY, dragStartWorld.z, cur)) {
        const dx = cur.x - dragStartBoundsScene.dx0;
        const dy = cur.y - dragStartBoundsScene.dy0;
        const handle = manager.getSceneOverlay(dragOverlayId);
        if (handle) {
          handle.mesh.position.set(dx, dy, 0);
          handle.outlineMesh.position.set(dx, dy, 0);
        }
      }
      return;
    }

    if (!raycastEnabled) {
      applyHover(null, ev.clientX, ev.clientY);
      return;
    }
    const now = performance.now();
    if (now - lastRayMs < RAY_THROTTLE_MS) {
      // Skip raycast this tick but keep position fresh on the same label.
      applyHover(currentLabel, ev.clientX, ev.clientY);
      return;
    }
    lastRayMs = now;
    // Editor mode: prefer overlay-outline hover over the regular
    // tooltip pick so authoring handles win where they overlap.
    if (editorMode) {
      if (setCaptureCameraPathPickCursor()) {
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      const capturePathHandle = pickCaptureCameraPathHandle(ev.clientX, ev.clientY);
      if (capturePathHandle) {
        renderer.domElement.style.cursor =
          capturePathHandle.type === "focus"
            ? "crosshair"
            : capturePathHandle.type === "segment" ||
                capturePathHandle.type === "equation-segment"
              ? "grab"
              : "move";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      if (orbitCenterPick) {
        renderer.domElement.style.cursor = "crosshair";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      const orbitCenter = pickOrbitCenterHandle(ev.clientX, ev.clientY);
      if (orbitCenter) {
        renderer.domElement.style.cursor =
          orbitCenter.mode === "z" ? "ns-resize" : "move";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      if (pickPageCameraMarker(ev.clientX, ev.clientY)) {
        renderer.domElement.style.cursor = "pointer";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      const areaHandle = pickAreaOutlineHandle(ev.clientX, ev.clientY);
      if (areaHandle) {
        renderer.domElement.style.cursor =
          areaHandle.mode === "move" ? "move" : "ew-resize";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      const localAtmosphereHandle = pickLocalAtmosphereHandle(
        ev.clientX,
        ev.clientY,
      );
      if (localAtmosphereHandle) {
        renderer.domElement.style.cursor =
          localAtmosphereHandle.mode === "move"
            ? "move"
            : localAtmosphereHandle.mode === "sizeZ"
              ? "ns-resize"
              : "ew-resize";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      const sceneSectionHandle = pickSceneSectionPlaneHandle(
        ev.clientX,
        ev.clientY,
      );
      if (sceneSectionHandle) {
        renderer.domElement.style.cursor = "grab";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      const lightHandle = pickLightingHandle(ev.clientX, ev.clientY);
      if (lightHandle) {
        renderer.domElement.style.cursor =
          lightHandle.mode === "height" ? "ns-resize" : "move";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      const ov = pickOverlay(ev.clientX, ev.clientY);
      manager.setHoveredSceneOverlay(ov?.id ?? null);
      if (ov) {
        renderer.domElement.style.cursor = "grab";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      } else {
        renderer.domElement.style.cursor = "";
      }
    } else {
      const sceneSectionHandle = pickSceneSectionPlaneHandle(
        ev.clientX,
        ev.clientY,
      );
      if (sceneSectionHandle) {
        renderer.domElement.style.cursor = "grab";
        applyHover(null, ev.clientX, ev.clientY);
        return;
      }
      renderer.domElement.style.cursor = "";
    }
    const label = pickLabel(ev.clientX, ev.clientY);
    applyHover(label, ev.clientX, ev.clientY);
  };
  const onCanvasMouseLeave = () => {
    applyHover(null, 0, 0);
    manager.setHoveredSceneOverlay(null);
    renderer.domElement.style.cursor = "";
  };

  const onCanvasMouseDown = (ev: MouseEvent) => {
    if (ev.button === 2) {
      window.dispatchEvent(
        new CustomEvent("geosee:camera-focus-release-request", {
          detail: { clientX: ev.clientX, clientY: ev.clientY, distancePx: 0 },
        }),
      );
      ev.preventDefault();
      return;
    }
    if (ev.button === 0) {
      focusPointerDown = { x: ev.clientX, y: ev.clientY };
      suppressNextDrillFocusClick = false;
    }
    if (ev.button !== 0) return;
    if (!editorMode) {
      const sceneSectionHandle = pickSceneSectionPlaneHandle(
        ev.clientX,
        ev.clientY,
      );
      if (sceneSectionHandle) {
        beginSceneSectionHandleDrag(sceneSectionHandle, ev);
      }
      return;
    }
    if (orbitCenterPick) {
      suppressNextDrillFocusClick = true;
      controls.enabled = false;
      renderer.domElement.style.cursor = "crosshair";
      ev.preventDefault();
      return;
    }
    const capturePathHandle = pickCaptureCameraPathHandle(ev.clientX, ev.clientY);
    if (capturePathHandle) {
      suppressNextDrillFocusClick = true;
      if (capturePathHandle.type === "equation-segment") {
        captureCameraPathInteraction?.onSelectEquationSegment?.(
          capturePathHandle.id,
        );
        renderer.domElement.style.cursor = "grab";
        ev.preventDefault();
        return;
      }
      captureCameraPathInteraction?.onSelectKeyframe?.(
        capturePathHandle.type === "segment" ? "" : capturePathHandle.id,
      );
      if (capturePathHandle.type === "focus") {
        renderer.domElement.style.cursor = "crosshair";
        ev.preventDefault();
        return;
      }
      const normal = new THREE.Vector3()
        .subVectors(camera.position, capturePathHandle.world)
        .normalize();
      const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        normal.lengthSq() > 0 ? normal : new THREE.Vector3(0, 0, 1),
        capturePathHandle.world,
      );
      dragCaptureCameraPath = {
        type: capturePathHandle.type,
        id: capturePathHandle.id,
        side:
          capturePathHandle.type === "spline-handle"
            ? capturePathHandle.side
            : undefined,
        axis:
          capturePathHandle.type === "node-axis"
            ? capturePathHandle.axis
            : undefined,
        startWorld: capturePathHandle.world.clone(),
        lastWorld: capturePathHandle.world.clone(),
        dragPlane,
      };
      controls.enabled = false;
      renderer.domElement.style.cursor = "grabbing";
      ev.preventDefault();
      return;
    }
    const orbitCenter = pickOrbitCenterHandle(ev.clientX, ev.clientY);
    if (orbitCenter) {
      suppressNextDrillFocusClick = true;
      const original = manager.getDynamicCameraOrbitCenter();
      if (!original) return;
      let dragPlane: THREE.Plane | null = null;
      if (orbitCenter.mode === "z") {
        const cameraRight = new THREE.Vector3()
          .setFromMatrixColumn(camera.matrixWorld, 0)
          .normalize();
        dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          cameraRight,
          original,
        );
      }
      dragOrbitCenter = {
        original,
        grabOffset: orbitCenter.world.clone().sub(original),
        mode: orbitCenter.mode,
        dragPlane,
      };
      controls.enabled = false;
      renderer.domElement.style.cursor =
        orbitCenter.mode === "z" ? "ns-resize" : "move";
      ev.preventDefault();
      return;
    }
    const areaHandle = pickAreaOutlineHandle(ev.clientX, ev.clientY);
    if (areaHandle) {
      suppressNextDrillFocusClick = true;
      dragAreaOutline = {
        id: areaHandle.id,
        mode: areaHandle.mode,
        original: areaHandle.world.clone(),
        grabOffset: new THREE.Vector3(),
      };
      if (areaHandle.mode === "move") {
        const center = manager.getAreaOutlineWorldCenter(areaHandle.id);
        if (center) {
          dragAreaOutline.original.copy(center);
          dragAreaOutline.grabOffset.copy(areaHandle.world).sub(center);
        }
      }
      controls.enabled = false;
      renderer.domElement.style.cursor =
        areaHandle.mode === "move" ? "move" : "ew-resize";
      ev.preventDefault();
      return;
    }
    const localAtmosphereHandle = pickLocalAtmosphereHandle(
      ev.clientX,
      ev.clientY,
    );
    if (localAtmosphereHandle) {
      suppressNextDrillFocusClick = true;
      const original = manager.getLocalAtmosphereWorldCenter(
        localAtmosphereHandle.layerId,
      );
      if (!original) return;
      let dragPlane: THREE.Plane | null = null;
      if (localAtmosphereHandle.mode === "sizeZ") {
        const cameraRight = new THREE.Vector3()
          .setFromMatrixColumn(camera.matrixWorld, 0)
          .normalize();
        dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          cameraRight,
          localAtmosphereHandle.world,
        );
      }
      dragLocalAtmosphere = {
        layerId: localAtmosphereHandle.layerId,
        mode: localAtmosphereHandle.mode,
        original,
        grabOffset: localAtmosphereHandle.world.clone().sub(original),
        dragPlane,
      };
      controls.enabled = false;
      renderer.domElement.style.cursor =
        localAtmosphereHandle.mode === "move"
          ? "move"
          : localAtmosphereHandle.mode === "sizeZ"
            ? "ns-resize"
            : "ew-resize";
      ev.preventDefault();
      return;
    }
    const sceneSectionHandle = pickSceneSectionPlaneHandle(ev.clientX, ev.clientY);
    if (sceneSectionHandle) {
      beginSceneSectionHandleDrag(sceneSectionHandle, ev);
      return;
    }
    const lightHandle = pickLightingHandle(ev.clientX, ev.clientY);
    if (lightHandle) {
      suppressNextDrillFocusClick = true;
      const original = manager.getLightingHandlePosition(
        lightHandle.sourceId,
        lightHandle.kind,
      );
      if (!original) return;
      let dragPlane: THREE.Plane | null = null;
      if (lightHandle.mode === "height") {
        const cameraRight = new THREE.Vector3()
          .setFromMatrixColumn(camera.matrixWorld, 0)
          .normalize();
        dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          cameraRight,
          original,
        );
      }
      dragLight = {
        sourceId: lightHandle.sourceId,
        kind: lightHandle.kind,
        mode: lightHandle.mode,
        original,
        dragPlane,
      };
      controls.enabled = false;
      renderer.domElement.style.cursor =
        lightHandle.mode === "height" ? "ns-resize" : "move";
      ev.preventDefault();
      return;
    }
    const ov = pickOverlay(ev.clientX, ev.clientY);
    if (!ov) return;
    suppressNextDrillFocusClick = true;
    const handle = manager.getSceneOverlay(ov.id);
    if (!handle) return;
    dragOverlayId = ov.id;
    dragStartWorld = ov.world.clone();
    dragStartBoundsScene = { dx0: ov.world.x, dy0: ov.world.y };
    dragOriginalBounds = [...handle.def.bounds] as SceneOverlayDef["bounds"];
    renderer.domElement.style.cursor = "grabbing";
    // Disable orbit controls while dragging; otherwise the camera
    // pans/orbits at the same time as the overlay translates.
    controls.enabled = false;
    ev.preventDefault();
  };

  const onCanvasClick = (ev: MouseEvent) => {
    if (ev.button !== 0) return;
    if (orbitCenterPick) {
      const point = pickMapPoint(ev.clientX, ev.clientY);
      const handler = orbitCenterPick;
      orbitCenterPick = null;
      renderer.domElement.style.cursor = "";
      controls.enabled = true;
      if (point) {
        const vec: Vec3 = [point.x, point.y, point.z];
        handler(vec);
      }
      suppressNextDrillFocusClick = false;
      focusPointerDown = null;
      ev.preventDefault();
      return;
    }
    const pageCameraMarker = pickPageCameraMarker(ev.clientX, ev.clientY);
    if (pageCameraMarker) {
      if (pageCameraMarker.kind === "global") {
        globalPageCameraMarkerClick?.(pageCameraMarker.pageId);
      } else {
        pageCameraMarkerClick?.();
      }
      suppressNextDrillFocusClick = false;
      focusPointerDown = null;
      ev.preventDefault();
      return;
    }
    if (suppressNextDrillFocusClick) {
      suppressNextDrillFocusClick = false;
      focusPointerDown = null;
      return;
    }
    if (focusPointerDown) {
      const dx = ev.clientX - focusPointerDown.x;
      const dy = ev.clientY - focusPointerDown.y;
      focusPointerDown = null;
      if (Math.hypot(dx, dy) > 8) return;
    }
    const focusBindId = captureCameraPathFocusBindId();
    if (captureCameraPathInteraction?.onBindFocusPoint && focusBindId) {
      const point = resolveCaptureCameraPathFocusPoint(ev.clientX, ev.clientY);
      if (point) {
        captureCameraPathInteraction?.onBindFocusPoint?.(
          focusBindId,
          threeToCaptureVec(point),
        );
        ev.preventDefault();
        return;
      }
    }
    const sceneTarget = pickSceneTarget(ev.clientX, ev.clientY);
    if (sceneTarget) {
      dispatchSceneTargetClick(sceneTarget);
    }
    const mtStation = pickMtStation(ev.clientX, ev.clientY);
    if (mtStation) {
      window.dispatchEvent(
        new CustomEvent("geosee:mt-station-click", {
          detail: mtStation,
        }),
      );
      ev.preventDefault();
      return;
    }
    emitDrillFocus(pickDrillFocus(ev.clientX, ev.clientY));
  };

  const onCanvasDblClick = (ev: MouseEvent) => {
    if (ev.button !== 0) return;
    const sceneTarget = pickSceneTarget(ev.clientX, ev.clientY);
    if (!sceneTarget) return;
    dispatchSceneTargetFocus(sceneTarget);
    suppressNextDrillFocusClick = true;
    focusPointerDown = null;
    ev.preventDefault();
  };

  const onCanvasContextMenu = (ev: MouseEvent) => {
    ev.preventDefault();
  };

  const onWindowMouseUp = () => {
    if (dragCaptureCameraPath) {
      cancelCaptureCameraPathInteraction();
      return;
    }
    if (dragSceneSectionPlane) {
      const positionM =
        dragSceneSectionPlane.kind === "plane"
          ? manager.getSceneSectionPlaneScalar(
              dragSceneSectionPlane.axis,
              dragSceneSectionPlane.frameId,
            )
          : manager.getSceneSectionWindowValue(
              dragSceneSectionPlane.axis,
              dragSceneSectionPlane.kind,
              dragSceneSectionPlane.frameId,
            );
      if (
        positionM !== null &&
        dragSceneSectionPlane.kind === "plane" &&
        sceneSectionPlaneCommit
      ) {
        sceneSectionPlaneCommit(
          dragSceneSectionPlane.axis,
          positionM,
          dragSceneSectionPlane.frameId,
        );
      } else if (
        positionM !== null &&
        dragSceneSectionPlane.kind !== "plane" &&
        sceneSectionWindowCommit
      ) {
        sceneSectionWindowCommit(
          dragSceneSectionPlane.axis,
          dragSceneSectionPlane.kind,
          positionM,
          dragSceneSectionPlane.frameId,
        );
      }
      dragSceneSectionPlane = null;
      renderer.domElement.style.cursor = "";
      controls.enabled = true;
      return;
    }
    if (dragAreaOutline) {
      const preview = manager.getAreaOutlinePreview(dragAreaOutline.id);
      if (preview && areaOutlineCommit) {
        areaOutlineCommit(dragAreaOutline.id, preview);
      }
      dragAreaOutline = null;
      renderer.domElement.style.cursor = "";
      controls.enabled = true;
      return;
    }
    if (dragLocalAtmosphere) {
      const preview = manager.getLocalAtmospherePreview(
        dragLocalAtmosphere.layerId,
      );
      if (preview && localAtmosphereCommit) {
        localAtmosphereCommit(dragLocalAtmosphere.layerId, preview);
      }
      dragLocalAtmosphere = null;
      renderer.domElement.style.cursor = "";
      controls.enabled = true;
      return;
    }
    if (dragOrbitCenter) {
      const position = manager.getDynamicCameraOrbitCenter();
      if (position && orbitCenterCommit) {
        orbitCenterCommit([position.x, position.y, position.z]);
      }
      dragOrbitCenter = null;
      renderer.domElement.style.cursor = "";
      controls.enabled = true;
      return;
    }
    if (orbitCenterPick) {
      controls.enabled = true;
    }
    if (dragLight) {
      const position = manager.getLightingHandlePosition(
        dragLight.sourceId,
        dragLight.kind,
      );
      if (position && lightingSourceCommit) {
        const vec: Vec3 = [position.x, position.y, position.z];
        lightingSourceCommit(
          dragLight.sourceId,
          dragLight.kind === "position"
            ? { position: vec }
            : { target: vec },
        );
      }
      dragLight = null;
      renderer.domElement.style.cursor = "";
      controls.enabled = true;
      return;
    }
    if (!dragOverlayId || !dragOriginalBounds) {
      controls.enabled = true;
      return;
    }
    const handle = manager.getSceneOverlay(dragOverlayId);
    if (handle) {
      const dx = handle.mesh.position.x;
      const dy = handle.mesh.position.y;
      // Scene-XY delta == EN delta (utmToScene is just a subtraction).
      const [minE, minN, maxE, maxN] = dragOriginalBounds;
      const newBounds: SceneOverlayDef["bounds"] = [
        minE + dx,
        minN + dy,
        maxE + dx,
        maxN + dy,
      ];
      // Snap meshes back to identity transform; the geometry rebuild
      // (kicked off by the commit handler via SceneManager) will
      // re-anchor them to the new bounds.
      handle.mesh.position.set(0, 0, 0);
      handle.outlineMesh.position.set(0, 0, 0);
      if (overlayBoundsCommit) {
        overlayBoundsCommit(dragOverlayId, newBounds);
      }
    }
    dragOverlayId = null;
    dragStartWorld = null;
    dragStartBoundsScene = null;
    dragOriginalBounds = null;
    renderer.domElement.style.cursor = "";
    controls.enabled = true;
  };

  renderer.domElement.addEventListener("mousemove", onCanvasMouseMove);
  renderer.domElement.addEventListener("mouseleave", onCanvasMouseLeave);
  renderer.domElement.addEventListener("mousedown", onCanvasMouseDown);
  renderer.domElement.addEventListener("click", onCanvasClick);
  renderer.domElement.addEventListener("dblclick", onCanvasDblClick);
  renderer.domElement.addEventListener("contextmenu", onCanvasContextMenu);
  window.addEventListener("mouseup", onWindowMouseUp);

  const setRaycastEnabled = (enabled: boolean) => {
    raycastEnabled = enabled;
    if (!enabled) {
      // Drop any in-flight hover state so we don't reveal a tooltip the
      // moment the tween starts.
      if (hoverTimer !== null) {
        window.clearTimeout(hoverTimer);
        hoverTimer = null;
      }
      currentLabel = null;
      shown = false;
      setHoverTooltip(null);
    }
  };
  const setTransitionActive = (enabled: boolean) => {
    transitionActive = enabled;
  };
  const isTransitionActive = () => transitionActive;

  const dispose = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    renderer.domElement.removeEventListener("mousemove", onCanvasMouseMove);
    renderer.domElement.removeEventListener("mouseleave", onCanvasMouseLeave);
    renderer.domElement.removeEventListener("mousedown", onCanvasMouseDown);
    renderer.domElement.removeEventListener("click", onCanvasClick);
    renderer.domElement.removeEventListener("dblclick", onCanvasDblClick);
    renderer.domElement.removeEventListener("contextmenu", onCanvasContextMenu);
    window.removeEventListener("mouseup", onWindowMouseUp);
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    setHoverTooltip(null);
    clearCaptureCameraPathOverlay();
    controls.dispose();
    manager.disposeTerrainOrthoPhotoTexture();
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };

  // Debug handle for headless inspection during Week 4 polish iteration.
  (window as unknown as { __scene?: unknown }).__scene = {
    scene,
    camera,
    controls,
    renderer,
    manager,
    post,
    depthBufferMode,
    cameraClip: {
      near: CAMERA_NEAR_M,
      far: CAMERA_FAR_M,
    },
  };

  return {
    scene,
    camera,
    controls,
    renderer,
    manager,
    getCanvas,
    beginCaptureSize,
    endCaptureSize,
    onAfterRender,
    renderCaptureFrame,
    getCameraPose,
    setCameraPose,
    beginCaptureFidelityLock,
    endCaptureFidelityLock,
    setCaptureCameraPathOverlay,
    clearCaptureCameraPathOverlay,
    setCaptureCameraPathInteraction,
    renderCameraPathPreviewFrame,
    getCaptureCapabilities,
    onTick,
    getFrameLoopDebugState,
    onDrillFocus,
    setRaycastEnabled,
    setTransitionActive,
    isTransitionActive,
    resolveSceneTarget,
    setEditorMode,
    setOverlayBoundsCommitHandler,
    setLightingSourceCommitHandler,
    setDynamicCameraOrbitCenter,
    beginDynamicCameraOrbitCenterPick,
    cancelDynamicCameraOrbitCenterPick,
    setDynamicCameraOrbitCenterCommitHandler,
    setAreaOutlineCommitHandler,
    setLocalAtmosphereCommitHandler,
    setSceneSectionPlaneCommitHandler,
    setSceneSectionWindowCommitHandler,
    setPageCameraMarker,
    setPageCameraMarkerClickHandler,
    setGlobalPageCameraMarkers,
    setGlobalPageCameraMarkerClickHandler,
    dispose,
  };
}
