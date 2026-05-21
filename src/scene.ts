import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadSceneOverlays } from "./loaders/loadSceneOverlays";
import { loadLayerInto, resolveDataPath } from "./scene/layerLoaders";
import { SceneManager } from "./scene/SceneManager";
import type {
  AreaOutlineHandleMode,
  AreaOutlinePreview,
  OrbitCenterHandleMode,
  PageCameraMarkerSpec,
  SceneSectionAxis,
} from "./scene/SceneManager";
import { buildPostprocessing } from "./scene/postprocessing";
import { setHoverTooltip } from "./ui/HoverTooltip";
import type { Pose, ProjectLayerSpec, SceneOverlayDef, Vec3 } from "./pages/types";
import { debugLog } from "./utils/debugLog";
import { UTAH_FORGE_MT_STATIONS_LAYER_ID } from "./projectModules/utahForge/layerIds";

// Z-up convention for the whole scene.
THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const CAMERA_NEAR_M = 5;
const CAMERA_FAR_M = 5_000_000;

export interface DrillFocus {
  holeId: string;
  point: THREE.Vector3;
}

export interface SceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
  manager: SceneManager;
  onTick(fn: (timeMs: number) => void): () => void;
  onDrillFocus(fn: (focus: DrillFocus | null) => void): () => void;
  /**
   * Gate the hover-raycast loop. PageController flips this to false at
   * the start of a camera tween and back to true at completion so the
   * tooltip doesn't pop up as the camera flies past objects mid-tween.
   */
  setRaycastEnabled(enabled: boolean): void;
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
  setSceneSectionPlaneCommitHandler(
    fn: ((axis: SceneSectionAxis, positionM: number) => void) | null,
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
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
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

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    CAMERA_NEAR_M,
    CAMERA_FAR_M,
  );
  camera.position.set(6_000, -6_000, 4_000);
  camera.up.set(0, 0, 1);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  // No more grid/axes -- they're authoring crutches that read as "tech demo"
  // in presenter mode. The terrain shader carries spatial reference now.

  const manager = new SceneManager(scene, renderer);
  for (const spec of layerSpecs) {
    manager.registerLayer(spec.id);
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

  const tickers = new Set<(t: number) => void>();
  const onTick = (fn: (t: number) => void) => {
    tickers.add(fn);
    return () => tickers.delete(fn);
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
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(w, h);
    manager.notifyResize(w, h);
  };
  window.addEventListener("resize", onResize);

  let raf = 0;
  const tick = (timeMs: number) => {
    raf = requestAnimationFrame(tick);
    for (const fn of tickers) fn(timeMs);
    controls.update();
    // Sky / light camera-follow mode (when "Lock to scene" is off in env).
    manager.frameUpdate(camera, timeMs);
    post.composer.render();
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
      while (node) {
        const name = (node.userData as { displayName?: string }).displayName;
        if (typeof name === "string" && name.length > 0) return name;
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
  let dragSceneSectionPlane:
    | {
        axis: SceneSectionAxis;
        normal: THREE.Vector3;
        originalPositionM: number;
        grabOffsetM: number;
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
  let sceneSectionPlaneCommit:
    | ((axis: SceneSectionAxis, positionM: number) => void)
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
  const setSceneSectionPlaneCommitHandler = (
    fn: ((axis: SceneSectionAxis, positionM: number) => void) | null,
  ) => {
    sceneSectionPlaneCommit = fn;
  };
  const setEditorMode = (on: boolean) => {
    editorMode = on;
    manager.setEditorMode(on);
    if (!on) {
      orbitCenterPick = null;
      dragOrbitCenter = null;
      dragAreaOutline = null;
      dragSceneSectionPlane = null;
      manager.setHoveredSceneOverlay(null);
      renderer.domElement.style.cursor = "";
    }
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

  const pickSceneSectionPlaneHandle = (
    clientX: number,
    clientY: number,
  ): { axis: SceneSectionAxis; world: THREE.Vector3 } | null => {
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
      };
      if (
        data.sceneSectionPlaneHandle === true &&
        (data.sceneSectionAxis === "x" ||
          data.sceneSectionAxis === "y" ||
          data.sceneSectionAxis === "z")
      ) {
        return { axis: data.sceneSectionAxis, world: hit.point.clone() };
      }
    }
    return null;
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
    if (dragSceneSectionPlane) {
      const cur = new THREE.Vector3();
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(dragSceneSectionPlane.dragPlane, cur)) {
        const positionM = THREE.MathUtils.clamp(
          cur.dot(dragSceneSectionPlane.normal) - dragSceneSectionPlane.grabOffsetM,
          -250_000,
          250_000,
        );
        manager.previewSceneSectionPlane(dragSceneSectionPlane.axis, positionM);
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
    if (ev.button === 0) {
      focusPointerDown = { x: ev.clientX, y: ev.clientY };
      suppressNextDrillFocusClick = false;
    }
    if (!editorMode || ev.button !== 0) return;
    if (orbitCenterPick) {
      suppressNextDrillFocusClick = true;
      controls.enabled = false;
      renderer.domElement.style.cursor = "crosshair";
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
    const sceneSectionHandle = pickSceneSectionPlaneHandle(ev.clientX, ev.clientY);
    if (sceneSectionHandle) {
      suppressNextDrillFocusClick = true;
      const normal =
        sceneSectionHandle.axis === "x"
          ? new THREE.Vector3(1, 0, 0)
          : sceneSectionHandle.axis === "y"
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 0, 1);
      const originalPosition =
        manager.getSceneSectionPlaneScalar(sceneSectionHandle.axis) ??
        sceneSectionHandle.world.dot(normal);
      const cameraRight = new THREE.Vector3()
        .setFromMatrixColumn(camera.matrixWorld, 0)
        .normalize();
      const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        cameraRight,
        sceneSectionHandle.world,
      );
      dragSceneSectionPlane = {
        axis: sceneSectionHandle.axis,
        normal,
        originalPositionM: originalPosition,
        grabOffsetM: sceneSectionHandle.world.dot(normal) - originalPosition,
        dragPlane,
      };
      controls.enabled = false;
      renderer.domElement.style.cursor = "grabbing";
      ev.preventDefault();
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

  const onWindowMouseUp = () => {
    if (dragSceneSectionPlane) {
      const positionM = manager.getSceneSectionPlaneScalar(
        dragSceneSectionPlane.axis,
      );
      if (positionM !== null && sceneSectionPlaneCommit) {
        sceneSectionPlaneCommit(dragSceneSectionPlane.axis, positionM);
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

  const dispose = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    renderer.domElement.removeEventListener("mousemove", onCanvasMouseMove);
    renderer.domElement.removeEventListener("mouseleave", onCanvasMouseLeave);
    renderer.domElement.removeEventListener("mousedown", onCanvasMouseDown);
    renderer.domElement.removeEventListener("click", onCanvasClick);
    window.removeEventListener("mouseup", onWindowMouseUp);
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    setHoverTooltip(null);
    controls.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  };

  // Debug handle for headless inspection during Week 4 polish iteration.
  (window as unknown as { __scene?: unknown }).__scene = {
    scene,
    camera,
    renderer,
    manager,
    post,
  };

  return {
    scene,
    camera,
    controls,
    renderer,
    manager,
    onTick,
    onDrillFocus,
    setRaycastEnabled,
    setEditorMode,
    setOverlayBoundsCommitHandler,
    setLightingSourceCommitHandler,
    setDynamicCameraOrbitCenter,
    beginDynamicCameraOrbitCenterPick,
    cancelDynamicCameraOrbitCenterPick,
    setDynamicCameraOrbitCenterCommitHandler,
    setAreaOutlineCommitHandler,
    setSceneSectionPlaneCommitHandler,
    setPageCameraMarker,
    setPageCameraMarkerClickHandler,
    setGlobalPageCameraMarkers,
    setGlobalPageCameraMarkerClickHandler,
    dispose,
  };
}
