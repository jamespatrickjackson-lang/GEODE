import * as THREE from "three";
import type { EditableStyle } from "../../pages/types";
import { getHeightSampler } from "../heightSampler";
import { disposeObjectTree } from "../disposeObjectTree";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import { clamp01, clampRange } from "../styles/styleUtils";
import {
  easeProgress,
  type SceneSectionStyleTween,
} from "../transitions/transitionStyles";
import type {
  ResolvedSceneSectionPlane,
  ResolvedSceneSectionWindow,
  SceneSectionAxis,
  SceneSectionRuntime,
  SceneSectionWindowHandleKind,
} from "../SceneManager";

const SCENE_SECTION_AXIS_NORMALS = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
} as const;
const SCENE_SECTION_AXIS_COLORS = {
  x: "#ff6b78",
  y: "#35c7e8",
  z: "#f6d76b",
} as const;
const SCENE_SECTION_DEFAULT_POSITIONS = {
  x: -6000,
  y: -10300,
  z: -2200,
} as const;
const SCENE_SECTION_RENDER_ORDER = 4560;
const SCENE_SECTION_MIN_HELPER_SIZE_M = 1200;
const SCENE_SECTION_HELPER_PADDING = 1.14;
const SCENE_SECTION_LABEL_WIDTH_M = 980;
const SCENE_SECTION_LABEL_HEIGHT_M = 260;
const SCENE_SECTION_LABEL_INSET_M = 180;
const SCENE_SECTION_HANDLE_MIN_SPAN_M = 360;
const SCENE_SECTION_HANDLE_MAX_SPAN_M = 1200;
const SCENE_SECTION_WINDOW_HANDLE_RADIUS_M = 260;
const SCENE_SECTION_AXIS_TICK_COUNT = 5;
const SCENE_SECTION_GROUND_TRACE_SAMPLES = 96;

function hardenStudioHelperMaterial(material: THREE.Material): void {
  material.depthTest = false;
  material.depthWrite = false;
  material.toneMapped = false;
  material.userData.ignoreLayerFog = true;
  (material as THREE.Material & { fog?: boolean }).fog = false;
  material.transparent = true;
  material.needsUpdate = true;
}

export function sceneSectionProductIds(this: any, style: EditableStyle): Set<string> {
  const seismic = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
  const selected =
    typeof seismic?.userData.seismicSelectedProductId === "string"
      ? seismic.userData.seismicSelectedProductId
      : typeof style.seismicProductId === "string"
        ? style.seismicProductId
        : "";
  if (style.sceneSectionTargetScope === "all-visible") {
    const ids = new Set<string>();
    seismic?.traverse((obj: THREE.Object3D) => {
      const productId = obj.userData?.seismicProductId;
      if (typeof productId === "string") ids.add(productId);
    });
    return ids;
  }
  const configured = Array.isArray(style.sceneSectionTargetProductIds)
    ? style.sceneSectionTargetProductIds.filter(
        (id) => typeof id === "string",
      )
    : [];
  if (style.sceneSectionTargetScope === "active-selection") {
    return new Set(selected ? [selected] : configured);
  }
  return new Set(
    configured.length > 0 ? configured : selected ? [selected] : [],
  );
}

export function sceneSectionLayerIds(this: any, style: EditableStyle): Set<string> {
  if (style.sceneSectionTargetScope === "all-visible") {
    const ids = new Set<string>();
    for (const [id, group] of this.layers) {
      if (group.visible) ids.add(id);
    }
    return ids;
  }
  const configured = Array.isArray(style.sceneSectionTargetLayerIds)
    ? style.sceneSectionTargetLayerIds.filter((id) => typeof id === "string")
    : [];
  if (style.sceneSectionTargetScope === "active-selection") {
    return new Set(configured);
  }
  return new Set(
    configured.length > 0
      ? configured
      : [
          UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
          UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        ],
  );
}

export function resolveSceneSectionPlanes(this: any, 
  style: EditableStyle,
): ResolvedSceneSectionPlane[] {
  const planes = style.sceneSectionPlanes ?? {};
  const axes: SceneSectionAxis[] = ["x", "y", "z"];
  return axes.map((axis) => {
    const plane = planes[axis] ?? {};
    const position =
      typeof plane.positionM === "number" && Number.isFinite(plane.positionM)
        ? clampRange(plane.positionM, -250_000, 250_000)
        : SCENE_SECTION_DEFAULT_POSITIONS[axis];
    return {
      axis,
      enabled: plane.enabled === true,
      positionM: position,
      invert: plane.invert === true,
      normal: SCENE_SECTION_AXIS_NORMALS[axis].clone(),
    };
  });
}

export function sceneSectionActivePlanes(this: any, 
  style: EditableStyle,
): ResolvedSceneSectionPlane[] {
  if (style.sceneSectionEnabled !== true) return [];
  return this.resolveSceneSectionPlanes(style).filter(
    (plane: ResolvedSceneSectionPlane) => plane.enabled,
  );
}

export function sceneSectionObjectTargeted(this: any, 
  layerId: string,
  obj: THREE.Object3D,
  style: EditableStyle,
  layerTargets: Set<string>,
  productTargets: Set<string>,
): boolean {
  if (obj.userData?.sceneSectionHelper === true) return false;
  if (style.sceneSectionTargetScope === "all-visible") return true;
  if (layerId === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) {
    const productId = obj.userData?.seismicProductId;
    if (typeof productId === "string") return productTargets.has(productId);
    if (obj.userData?.seismicNavigation === true)
      return layerTargets.has(layerId);
    return layerTargets.has(layerId);
  }
  return layerTargets.has(layerId);
}

export function sceneSectionClippingPlanes(this: any, 
  planes: ResolvedSceneSectionPlane[],
): THREE.Plane[] {
  const clippingPlanes: THREE.Plane[] = [];
  for (const plane of planes) {
    const position = plane.positionM;
    const normal = plane.invert
      ? plane.normal.clone()
      : plane.normal.clone().multiplyScalar(-1);
    const constant = plane.invert ? -position : position;
    clippingPlanes.push(new THREE.Plane(normal, constant));
  }
  return clippingPlanes;
}

export function sceneSectionAxisAlongIndex(this: any, 
  axis: SceneSectionAxis,
): 0 | 1 | null {
  if (axis === "x") return 1;
  if (axis === "y") return 0;
  return null;
}

export function resolveSceneSectionWindow(this: any, 
  style: EditableStyle,
  bounds: THREE.Box3,
): ResolvedSceneSectionWindow | null {
  if (style.sceneSectionWindowEnabled !== true) return null;
  const activeWindowAxis =
    style.sceneSectionWindowActiveAxis === "x" ||
    style.sceneSectionWindowActiveAxis === "y"
      ? style.sceneSectionWindowActiveAxis
      : null;
  const activeSectionAxis =
    style.sceneSectionActiveAxis === "x" || style.sceneSectionActiveAxis === "y"
      ? style.sceneSectionActiveAxis
      : null;
  const planes = style.sceneSectionPlanes ?? {};
  const windowByAxis = style.sceneSectionWindowByAxis ?? {};
  const fallbackAxis =
    planes.x?.enabled === true && windowByAxis.x
      ? "x"
      : planes.y?.enabled === true && windowByAxis.y
        ? "y"
        : windowByAxis.x
          ? "x"
          : windowByAxis.y
            ? "y"
            : null;
  const axis = activeWindowAxis ?? activeSectionAxis ?? fallbackAxis;
  if (!axis) return null;
  const alongIndex = this.sceneSectionAxisAlongIndex(axis);
  if (alongIndex === null) return null;
  const raw = windowByAxis[axis] ?? {};
  const minBound = bounds.min.getComponent(alongIndex);
  const maxBound = bounds.max.getComponent(alongIndex);
  const bottomBound = bounds.min.z;
  const rawMin =
    typeof raw.minAlongM === "number" && Number.isFinite(raw.minAlongM)
      ? raw.minAlongM
      : minBound;
  const rawMax =
    typeof raw.maxAlongM === "number" && Number.isFinite(raw.maxAlongM)
      ? raw.maxAlongM
      : maxBound;
  const minAlongM = clampRange(Math.min(rawMin, rawMax), -250_000, 250_000);
  const maxAlongM = clampRange(
    Math.max(rawMin, rawMax, minAlongM + 100),
    minAlongM + 100,
    250_000,
  );
  const bottomElevationM =
    typeof raw.bottomElevationM === "number" &&
    Number.isFinite(raw.bottomElevationM)
      ? clampRange(raw.bottomElevationM, -250_000, 250_000)
      : bottomBound;
  return { axis, minAlongM, maxAlongM, bottomElevationM, alongIndex };
}

export function sceneSectionWindowClippingPlanes(this: any, 
  window: ResolvedSceneSectionWindow | null,
): THREE.Plane[] {
  if (!window) return [];
  if (window.alongIndex === 0) {
    return [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -window.minAlongM),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), window.maxAlongM),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -window.bottomElevationM),
    ];
  }
  return [
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -window.minAlongM),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), window.maxAlongM),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -window.bottomElevationM),
  ];
}

export function sceneSectionWindowAppliesToObject(this: any, 
  layerId: string,
  obj: THREE.Object3D,
): boolean {
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    return obj.userData?.scalarVolume === true;
  }
  if (layerId !== UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) return false;
  if (obj.userData?.scalarSectionIsoOverlay === true) return true;
  return (
    obj.userData?.resistivitySlicePreview === true &&
    obj.userData?.resistivitySliceKind === "vertical-section"
  );
}

export function setSceneSectionUniforms(this: any, 
  material: THREE.ShaderMaterial,
  planes: ResolvedSceneSectionPlane[],
  targeted: boolean,
  window: ResolvedSceneSectionWindow | null,
): void {
  const uniforms = material.uniforms;
  const ensure = <T>(key: string, value: T) => {
    if (!uniforms[key]) uniforms[key] = { value };
    return uniforms[key] as { value: T };
  };
  ensure<number>("uSceneSectionEnabled", 0).value =
    targeted && planes.length > 0 ? 1 : 0;
  ensure<number>("uSceneSectionMode", 0).value = 0;
  ensure<number>("uSceneSectionPlaneCount", 0).value = targeted
    ? planes.length
    : 0;
  const normalUniform = ensure<THREE.Vector3[]>("uSceneSectionNormals", [
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const positionUniform = ensure<number[]>(
    "uSceneSectionPositions",
    [0, 0, 0],
  );
  const thicknessUniform = ensure<number[]>(
    "uSceneSectionThickness",
    [1, 1, 1],
  );
  const invertUniform = ensure<number[]>("uSceneSectionInvert", [0, 0, 0]);
  const normals = normalUniform.value;
  const positions = positionUniform.value;
  const thickness = thicknessUniform.value;
  const invert = invertUniform.value;
  for (let i = 0; i < 3; i += 1) {
    const plane = planes[i];
    normals[i].copy(plane?.normal ?? new THREE.Vector3());
    positions[i] = plane?.positionM ?? 0;
    thickness[i] = 1;
    invert[i] = plane?.invert ? 1 : 0;
  }
  ensure<number>("uSceneSectionWindowEnabled", 0).value =
    targeted && window ? 1 : 0;
  ensure<number>("uSceneSectionWindowAxis", 0).value =
    window?.axis === "y" ? 1 : 0;
  ensure<number>("uSceneSectionWindowMinAlong", -250_000).value =
    window?.minAlongM ?? -250_000;
  ensure<number>("uSceneSectionWindowMaxAlong", 250_000).value =
    window?.maxAlongM ?? 250_000;
  ensure<number>("uSceneSectionWindowBottomZ", -250_000).value =
    window?.bottomElevationM ?? -250_000;
}

export function applySceneSectionMaterial(this: any, 
  material: THREE.Material,
  planes: ResolvedSceneSectionPlane[],
  targeted: boolean,
  clippingPlanes: THREE.Plane[],
  window: ResolvedSceneSectionWindow | null,
  windowClippingPlanes: THREE.Plane[],
  windowTargeted: boolean,
): void {
  if (material.userData?.sceneSectionHelper === true) return;
  const seismicShader =
    material instanceof THREE.ShaderMaterial &&
    (material.userData?.seismicRaymarchMaterial === true ||
      material.userData?.seismicSectionMaterial === true ||
      material.userData?.scalarVolumeRaymarchMaterial === true);
  if (seismicShader) {
    this.setSceneSectionUniforms(material, planes, targeted, windowTargeted ? window : null);
    material.needsUpdate = true;
    return;
  }
  const active = targeted && clippingPlanes.length > 0;
  const publicSurfaceClipPlanes = Array.isArray(
    material.userData?.publicSurfaceClipPlanes,
  )
    ? (material.userData.publicSurfaceClipPlanes as THREE.Plane[])
    : [];
  const combinedPlanes = [
    ...publicSurfaceClipPlanes,
    ...(active ? clippingPlanes : []),
    ...(windowTargeted ? windowClippingPlanes : []),
  ];
  material.clippingPlanes = combinedPlanes.length > 0 ? combinedPlanes : null;
  material.clipIntersection = false;
  material.needsUpdate = true;
}

export function interpolatedSceneSectionStyle(this: any, 
  fromStyle: EditableStyle,
  toStyle: EditableStyle,
  amount: number,
): EditableStyle {
  const t = clamp01(amount);
  const next: EditableStyle = { ...toStyle };
  const axes: SceneSectionAxis[] = ["x", "y", "z"];
  const fromPlanes = fromStyle.sceneSectionPlanes ?? {};
  const toPlanes = toStyle.sceneSectionPlanes ?? {};
  const sceneSectionPlanes: NonNullable<EditableStyle["sceneSectionPlanes"]> =
    { ...toPlanes };

  for (const axis of axes) {
    const fromPlane = fromPlanes[axis];
    const toPlane = toPlanes[axis];
    if (
      typeof fromPlane?.positionM === "number" &&
      Number.isFinite(fromPlane.positionM) &&
      typeof toPlane?.positionM === "number" &&
      Number.isFinite(toPlane.positionM)
    ) {
      sceneSectionPlanes[axis] = {
        ...toPlane,
        positionM:
          fromPlane.positionM + (toPlane.positionM - fromPlane.positionM) * t,
      };
    }
  }
  next.sceneSectionPlanes = sceneSectionPlanes;

  const fromWindowByAxis = fromStyle.sceneSectionWindowByAxis ?? {};
  const toWindowByAxis = toStyle.sceneSectionWindowByAxis ?? {};
  const windowByAxis: NonNullable<EditableStyle["sceneSectionWindowByAxis"]> =
    { ...toWindowByAxis };
  for (const axis of axes) {
    const fromWindow = fromWindowByAxis[axis];
    const toWindow = toWindowByAxis[axis];
    if (!toWindow) continue;
    const nextWindow = { ...toWindow };
    for (const key of [
      "minAlongM",
      "maxAlongM",
      "bottomElevationM",
    ] as const) {
      const from = fromWindow?.[key];
      const to = toWindow[key];
      if (
        typeof from === "number" &&
        Number.isFinite(from) &&
        typeof to === "number" &&
        Number.isFinite(to)
      ) {
        nextWindow[key] = from + (to - from) * t;
      }
    }
    windowByAxis[axis] = nextWindow;
  }
  next.sceneSectionWindowByAxis = windowByAxis;
  return next;
}

export function currentSceneSectionStyle(this: any, nowMs = performance.now()): EditableStyle {
  const tween = this.sceneSectionStyleTween;
  if (!tween) return this.styleForLayer(UTAH_FORGE_SCENE_SECTION_LAYER_ID);
  const t =
    tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
  if (t >= 1 || tween.discreteChanged) return tween.toStyle;
  return this.interpolatedSceneSectionStyle(
    tween.fromStyle,
    tween.toStyle,
    easeProgress(t, tween.easing),
  );
}

export function sceneSectionHelperOpacityForTween(this: any, 
  tween: SceneSectionStyleTween,
  eased: number,
): number {
  const fromActive =
    tween.fromStyle.sceneSectionEnabled === true &&
    tween.fromStyle.sceneSectionHelperVisible !== false;
  const toActive =
    tween.toStyle.sceneSectionEnabled === true &&
    tween.toStyle.sceneSectionHelperVisible !== false;
  if (!fromActive && toActive) return clamp01(eased);
  if (fromActive && !toActive) return 1 - clamp01(eased);
  return 1;
}

export function applySceneSectionHelperTransitionOpacity(this: any): void {
  const runtime = this.sceneSectionRuntime;
  if (!runtime?.group.visible) return;
  const opacity = clamp01(this.sceneSectionHelperTransitionOpacity);
  runtime.group.traverse((obj: THREE.Object3D) => {
    const mat = (obj as { material?: THREE.Material | THREE.Material[] })
      .material;
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const material of mats) {
      if (material.userData?.sceneSectionHelper !== true) continue;
      const baseOpacity = this.baseOpacityForMaterial(material);
      material.opacity = baseOpacity * opacity;
      material.transparent =
        material.userData?.forceTransparent === true ||
        material.opacity < 0.999;
      if (
        material instanceof THREE.ShaderMaterial &&
        material.uniforms.uOpacity
      ) {
        material.uniforms.uOpacity.value = material.opacity;
      }
      material.needsUpdate = true;
    }
  });
}

export function sceneSectionBounds(this: any, 
  style: EditableStyle,
  layerTargets: Set<string>,
  productTargets: Set<string>,
): THREE.Box3 {
  const box = new THREE.Box3();
  for (const [layerId, group] of this.layers) {
    if (!group.visible) continue;
    group.updateMatrixWorld(true);
    group.traverse((obj: THREE.Object3D) => {
      if (!obj.visible || obj.userData?.sceneSectionHelper === true) return;
      if (
        !this.sceneSectionObjectTargeted(
          layerId,
          obj,
          style,
          layerTargets,
          productTargets,
        )
      ) {
        return;
      }
      const candidate = obj as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        isMesh?: boolean;
        isLine?: boolean;
        isPoints?: boolean;
      };
      if (
        !candidate.geometry &&
        candidate.isMesh !== true &&
        candidate.isLine !== true &&
        candidate.isPoints !== true
      ) {
        return;
      }
      const objectBox = new THREE.Box3().setFromObject(obj);
      if (!objectBox.isEmpty()) box.union(objectBox);
    });
  }
  if (!box.isEmpty()) return box;
  const fallback = new THREE.Box3();
  for (const group of this.layers.values()) {
    if (!group.visible) continue;
    const groupBox = new THREE.Box3().setFromObject(group);
    if (!groupBox.isEmpty()) fallback.union(groupBox);
  }
  if (!fallback.isEmpty()) return fallback;
  return new THREE.Box3(
    new THREE.Vector3(-14_000, -14_000, -8_000),
    new THREE.Vector3(2_000, -6_000, 2_000),
  );
}

export function createSceneSectionLabel(this: any, text: string, color: string): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 136;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 42px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(6, 9, 12, 0.82)";
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  hardenStudioHelperMaterial(material);
  material.userData.sceneSectionHelper = true;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(
      SCENE_SECTION_LABEL_WIDTH_M,
      SCENE_SECTION_LABEL_HEIGHT_M,
    ),
    material,
  );
  mesh.name = text;
  mesh.userData.sceneSectionHelper = true;
  mesh.renderOrder = SCENE_SECTION_RENDER_ORDER + 2;
  return mesh;
}

export function createSceneSectionScaleLabel(this: any, text: string): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 112;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "700 32px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.82)";
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = "#f8f4e8";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.94,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  hardenStudioHelperMaterial(material);
  material.userData.sceneSectionHelper = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(620, 180), material);
  mesh.userData.sceneSectionHelper = true;
  mesh.renderOrder = SCENE_SECTION_RENDER_ORDER + 3;
  return mesh;
}

export function ensureSceneSectionRuntime(this: any): SceneSectionRuntime {
  if (this.sceneSectionRuntime) return this.sceneSectionRuntime;
  const group = new THREE.Group();
  group.name = "__scene_section_planes__";
  group.visible = false;
  group.userData.sceneSectionHelper = true;
  this.scene.add(group);
  this.sceneSectionRuntime = {
    group,
    pickables: [],
    planes: new Map(),
  };
  return this.sceneSectionRuntime;
}

export function rebuildSceneSectionHelpers(this: any, 
  style: EditableStyle,
  planes: ResolvedSceneSectionPlane[],
  layerTargets: Set<string>,
  productTargets: Set<string>,
): void {
  const runtime = this.ensureSceneSectionRuntime();
  while (runtime.group.children.length > 0) {
    const child = runtime.group.children[0];
    runtime.group.remove(child);
    disposeObjectTree(child);
  }
  runtime.pickables = [];
  runtime.planes.clear();

  const helperVisible = style.sceneSectionHelperVisible !== false;
  runtime.group.visible =
    this.editorMode &&
    style.sceneSectionEnabled === true &&
    helperVisible &&
    planes.length > 0;
  if (!runtime.group.visible) return;

  const bounds = this.sceneSectionBounds(style, layerTargets, productTargets);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const activeAxis =
    style.sceneSectionActiveAxis === "x" ||
    style.sceneSectionActiveAxis === "y" ||
    style.sceneSectionActiveAxis === "z"
      ? style.sceneSectionActiveAxis
      : "z";
  const sectionWindow = this.resolveSceneSectionWindow(style, bounds);
  const showGroundTrace = style.sceneSectionGroundTraceVisible === true;
  const showAxes = style.sceneSectionAxesVisible === true;

  for (const plane of planes) {
    const color = SCENE_SECTION_AXIS_COLORS[plane.axis];
    const tangentA =
      plane.axis === "x"
        ? new THREE.Vector3(0, 1, 0)
        : plane.axis === "y"
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(1, 0, 0);
    const tangentB =
      plane.axis === "z"
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
    const width =
      plane.axis === "x" ? size.y : plane.axis === "y" ? size.x : size.x;
    const height =
      plane.axis === "x" ? size.z : plane.axis === "y" ? size.z : size.y;
    const paddedWidth = Math.max(
      SCENE_SECTION_MIN_HELPER_SIZE_M,
      width * SCENE_SECTION_HELPER_PADDING,
    );
    const paddedHeight = Math.max(
      SCENE_SECTION_MIN_HELPER_SIZE_M,
      height * SCENE_SECTION_HELPER_PADDING,
    );
    const halfWidth = paddedWidth * 0.5;
    const halfHeight = paddedHeight * 0.5;
    const windowForPlane =
      sectionWindow && sectionWindow.axis === plane.axis
        ? sectionWindow
        : null;
    const planeCenter = center.clone();
    if (plane.axis === "x") {
      planeCenter.x = plane.positionM;
    } else if (plane.axis === "y") {
      planeCenter.y = plane.positionM;
    } else {
      planeCenter.z = plane.positionM;
    }
    const planeBasis = new THREE.Matrix4().makeBasis(
      tangentA,
      tangentB,
      plane.normal,
    );
    const planeQuaternion = new THREE.Quaternion().setFromRotationMatrix(
      planeBasis,
    );

    const cornerA = planeCenter
      .clone()
      .addScaledVector(tangentA, -halfWidth)
      .addScaledVector(tangentB, -halfHeight);
    const cornerB = planeCenter
      .clone()
      .addScaledVector(tangentA, halfWidth)
      .addScaledVector(tangentB, -halfHeight);
    const cornerC = planeCenter
      .clone()
      .addScaledVector(tangentA, halfWidth)
      .addScaledVector(tangentB, halfHeight);
    const cornerD = planeCenter
      .clone()
      .addScaledVector(tangentA, -halfWidth)
      .addScaledVector(tangentB, halfHeight);
    const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
      cornerA,
      cornerB,
      cornerC,
      cornerD,
      cornerA,
    ]);
    const outlineMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: plane.axis === activeAxis ? 0.98 : 0.72,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(outlineMaterial);
    outlineMaterial.userData.sceneSectionHelper = true;
    const outline = new THREE.Line(outlineGeometry, outlineMaterial);
    outline.name = `${plane.axis.toUpperCase()} Section outline`;
    outline.userData.sceneSectionHelper = true;
    outline.renderOrder = SCENE_SECTION_RENDER_ORDER;
    runtime.group.add(outline);

    const controlGroup = new THREE.Group();
    controlGroup.name = `${plane.axis.toUpperCase()} Section push/pull controls`;
    controlGroup.position.copy(planeCenter);
    controlGroup.quaternion.copy(planeQuaternion);
    controlGroup.userData.sceneSectionHelper = true;
    controlGroup.renderOrder = SCENE_SECTION_RENDER_ORDER + 1;

    const handleSpan = clampRange(
      Math.min(paddedWidth, paddedHeight) * 0.16,
      SCENE_SECTION_HANDLE_MIN_SPAN_M,
      SCENE_SECTION_HANDLE_MAX_SPAN_M,
    );
    const coneLength = clampRange(handleSpan * 1.12, 520, 1120);
    const coneRadius = coneLength * 0.52;
    const guideMaterial = new THREE.LineDashedMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: plane.axis === activeAxis ? 0.86 : 0.58,
      dashSize: Math.max(80, handleSpan * 0.18),
      gapSize: Math.max(55, handleSpan * 0.12),
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    hardenStudioHelperMaterial(guideMaterial);
    guideMaterial.userData.sceneSectionHelper = true;
    const guide = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -handleSpan),
        new THREE.Vector3(0, 0, handleSpan),
      ]),
      guideMaterial,
    );
    guide.name = `${plane.axis.toUpperCase()} Section push/pull guide`;
    guide.userData.sceneSectionHelper = true;
    guide.renderOrder = SCENE_SECTION_RENDER_ORDER + 1;
    guide.computeLineDistances();
    controlGroup.add(guide);

    const makeHandle = (direction: 1 | -1): THREE.Mesh => {
      const handleMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: plane.axis === activeAxis ? 0.96 : 0.72,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      hardenStudioHelperMaterial(handleMaterial);
      handleMaterial.userData.sceneSectionHelper = true;
      const handle = new THREE.Mesh(
        new THREE.ConeGeometry(coneRadius, coneLength, 3),
        handleMaterial,
      );
      handle.name = `${plane.axis.toUpperCase()} Section ${
        direction > 0 ? "push" : "pull"
      } handle`;
      handle.position.z = direction * handleSpan;
      handle.rotation.x = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
      handle.userData.sceneSectionHelper = true;
      handle.userData.sceneSectionPlaneHandle = true;
      handle.userData.sceneSectionAxis = plane.axis;
      handle.userData.sceneSectionPlaneHandleKind = "push-pull";
      handle.userData.sceneSectionPlaneHandleDirection = direction;
      handle.renderOrder = SCENE_SECTION_RENDER_ORDER + 2;
      runtime.pickables.push(handle);
      return handle;
    };
    controlGroup.add(makeHandle(-1), makeHandle(1));
    if (windowForPlane) {
      const alongCenter =
        plane.axis === "x" ? planeCenter.y : planeCenter.x;
      const minLocal = clampRange(
        windowForPlane.minAlongM - alongCenter,
        -halfWidth,
        halfWidth,
      );
      const maxLocal = clampRange(
        windowForPlane.maxAlongM - alongCenter,
        -halfWidth,
        halfWidth,
      );
      const bottomLocal = clampRange(
        windowForPlane.bottomElevationM - planeCenter.z,
        -halfHeight,
        halfHeight,
      );
      const windowGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(minLocal, bottomLocal, 0),
        new THREE.Vector3(maxLocal, bottomLocal, 0),
        new THREE.Vector3(maxLocal, halfHeight, 0),
        new THREE.Vector3(minLocal, halfHeight, 0),
        new THREE.Vector3(minLocal, bottomLocal, 0),
      ]);
      const windowMaterial = new THREE.LineDashedMaterial({
        color: "#f8f4e8",
        transparent: true,
        opacity: 0.94,
        dashSize: Math.max(90, paddedWidth * 0.012),
        gapSize: Math.max(60, paddedWidth * 0.008),
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      hardenStudioHelperMaterial(windowMaterial);
      windowMaterial.userData.sceneSectionHelper = true;
      const windowLine = new THREE.Line(windowGeometry, windowMaterial);
      windowLine.name = `${plane.axis.toUpperCase()} MT section window`;
      windowLine.userData.sceneSectionHelper = true;
      windowLine.renderOrder = SCENE_SECTION_RENDER_ORDER + 1;
      windowLine.computeLineDistances();
      controlGroup.add(windowLine);

      const makeWindowHandle = (
        kind: SceneSectionWindowHandleKind,
        x: number,
        y: number,
      ): THREE.Mesh => {
        const material = new THREE.MeshBasicMaterial({
          color: kind === "window-bottom" ? "#f8f4e8" : color,
          transparent: true,
          opacity: 0.96,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        });
        hardenStudioHelperMaterial(material);
        material.userData.sceneSectionHelper = true;
        const handle = new THREE.Mesh(
          new THREE.SphereGeometry(SCENE_SECTION_WINDOW_HANDLE_RADIUS_M, 16, 10),
          material,
        );
        handle.name = `${plane.axis.toUpperCase()} Section ${kind} handle`;
        handle.position.set(x, y, 0);
        handle.userData.sceneSectionHelper = true;
        handle.userData.sceneSectionPlaneHandle = true;
        handle.userData.sceneSectionAxis = plane.axis;
        handle.userData.sceneSectionPlaneHandleKind = kind;
        handle.renderOrder = SCENE_SECTION_RENDER_ORDER + 3;
        runtime.pickables.push(handle);
        return handle;
      };
      controlGroup.add(
        makeWindowHandle("window-min", minLocal, (bottomLocal + halfHeight) * 0.5),
        makeWindowHandle("window-max", maxLocal, (bottomLocal + halfHeight) * 0.5),
        makeWindowHandle("window-bottom", (minLocal + maxLocal) * 0.5, bottomLocal),
      );
    }
    runtime.group.add(controlGroup);
    runtime.planes.set(plane.axis, controlGroup);

    const label = this.createSceneSectionLabel(
      `${plane.axis.toUpperCase()} Section`,
      color,
    );
    label.position
      .copy(planeCenter)
      .addScaledVector(
        tangentA,
        halfWidth -
          SCENE_SECTION_LABEL_INSET_M -
          SCENE_SECTION_LABEL_WIDTH_M * 0.5,
      )
      .addScaledVector(
        tangentB,
        halfHeight -
          SCENE_SECTION_LABEL_INSET_M -
          SCENE_SECTION_LABEL_HEIGHT_M * 0.5,
      );
    label.quaternion.copy(planeQuaternion);
    runtime.group.add(label);

    if (windowForPlane && (showGroundTrace || showAxes)) {
      const alongCenter = plane.axis === "x" ? planeCenter.y : planeCenter.x;
      const minLocal = clampRange(
        windowForPlane.minAlongM - alongCenter,
        -halfWidth,
        halfWidth,
      );
      const maxLocal = clampRange(
        windowForPlane.maxAlongM - alongCenter,
        -halfWidth,
        halfWidth,
      );
      const bottomLocal = clampRange(
        windowForPlane.bottomElevationM - planeCenter.z,
        -halfHeight,
        halfHeight,
      );
      if (showAxes) {
        const axisMaterial = new THREE.LineBasicMaterial({
          color: "#f8f4e8",
          transparent: true,
          opacity: 0.82,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
          fog: false,
        });
        hardenStudioHelperMaterial(axisMaterial);
        axisMaterial.userData.sceneSectionHelper = true;
        const axisLine = new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints([
            planeCenter
              .clone()
              .addScaledVector(tangentA, minLocal)
              .addScaledVector(tangentB, bottomLocal),
            planeCenter
              .clone()
              .addScaledVector(tangentA, maxLocal)
              .addScaledVector(tangentB, bottomLocal),
            planeCenter
              .clone()
              .addScaledVector(tangentA, minLocal)
              .addScaledVector(tangentB, bottomLocal),
            planeCenter
              .clone()
              .addScaledVector(tangentA, minLocal)
              .addScaledVector(tangentB, halfHeight),
          ]),
          axisMaterial,
        );
        axisLine.name = `${plane.axis.toUpperCase()} section scale axes`;
        axisLine.userData.sceneSectionHelper = true;
        axisLine.renderOrder = SCENE_SECTION_RENDER_ORDER + 1;
        runtime.group.add(axisLine);
        const tickCount = SCENE_SECTION_AXIS_TICK_COUNT;
        const origin = this.siteSurfaceGuideOrigin(
          this.layers.get(this.topoSurfaceLayerId()),
        );
        for (let i = 0; i < tickCount; i += 1) {
          const t = i / (tickCount - 1);
          const along = windowForPlane.minAlongM +
            (windowForPlane.maxAlongM - windowForPlane.minAlongM) * t;
          const horizontalLabel =
            plane.axis === "y"
              ? `${((origin.easting + along) / 1000).toFixed(1)} E km`
              : `${((origin.northing + along) / 1000).toFixed(1)} N km`;
          const labelMesh = this.createSceneSectionScaleLabel(horizontalLabel);
          labelMesh.position
            .copy(planeCenter)
            .addScaledVector(tangentA, minLocal + (maxLocal - minLocal) * t)
            .addScaledVector(tangentB, bottomLocal - 420);
          labelMesh.quaternion.copy(planeQuaternion);
          runtime.group.add(labelMesh);
        }
        for (let i = 0; i < tickCount; i += 1) {
          const t = i / (tickCount - 1);
          const z = windowForPlane.bottomElevationM +
            (bounds.max.z - windowForPlane.bottomElevationM) * t;
          const labelMesh = this.createSceneSectionScaleLabel(
            `${(z / 1000).toFixed(1)} elev km`,
          );
          labelMesh.position
            .copy(planeCenter)
            .addScaledVector(tangentA, minLocal - 620)
            .addScaledVector(tangentB, bottomLocal + (halfHeight - bottomLocal) * t);
          labelMesh.quaternion.copy(planeQuaternion);
          runtime.group.add(labelMesh);
        }
      }
      if (showGroundTrace && (plane.axis === "x" || plane.axis === "y")) {
        const traceGroup = new THREE.Group();
        traceGroup.name = `${plane.axis.toUpperCase()} section ground trace`;
        traceGroup.userData.sceneSectionHelper = true;
        runtime.group.add(traceGroup);
        const origin = this.siteSurfaceGuideOrigin(
          this.layers.get(this.topoSurfaceLayerId()),
        );
        void getHeightSampler().then((sampleHeight) => {
          if (!traceGroup.parent) return;
          const points: THREE.Vector3[] = [];
          for (let i = 0; i < SCENE_SECTION_GROUND_TRACE_SAMPLES; i += 1) {
            const t = i / (SCENE_SECTION_GROUND_TRACE_SAMPLES - 1);
            const along =
              windowForPlane.minAlongM +
              (windowForPlane.maxAlongM - windowForPlane.minAlongM) * t;
            const x = plane.axis === "y" ? along : plane.positionM;
            const y = plane.axis === "x" ? along : plane.positionM;
            points.push(
              new THREE.Vector3(
                x,
                y,
                this.siteGuideSurfaceZ(x, y, sampleHeight, origin, 26),
              ),
            );
          }
          const material = new THREE.LineDashedMaterial({
            color: "#ffffff",
            transparent: true,
            opacity: 0.96,
            dashSize: 150,
            gapSize: 90,
            depthTest: false,
            depthWrite: false,
            toneMapped: false,
            fog: false,
          });
          hardenStudioHelperMaterial(material);
          material.userData.sceneSectionHelper = true;
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(points),
            material,
          );
          line.name = `${plane.axis.toUpperCase()} dashed ground intersection`;
          line.userData.sceneSectionHelper = true;
          line.renderOrder = SCENE_SECTION_RENDER_ORDER + 2;
          line.computeLineDistances();
          traceGroup.add(line);
        });
      }
    }
  }
}

export function applySceneSectionPlanes(this: any, style: EditableStyle): void {
  this.lastSceneSectionStyle = style;
  const planes = this.sceneSectionActivePlanes(style);
  const clippingPlanes = this.sceneSectionClippingPlanes(planes);
  const layerTargets = this.sceneSectionLayerIds(style);
  const productTargets = this.sceneSectionProductIds(style);
  const bounds = this.sceneSectionBounds(style, layerTargets, productTargets);
  const sectionWindow = this.resolveSceneSectionWindow(style, bounds);
  const sectionWindowClippingPlanes =
    this.sceneSectionWindowClippingPlanes(sectionWindow);
  this.sceneSectionClippingActive =
    planes.length > 0 || sectionWindowClippingPlanes.length > 0;
  this.updateRendererLocalClipping();

  for (const [layerId, group] of this.layers) {
    group.traverse((obj: THREE.Object3D) => {
      const material = (
        obj as { material?: THREE.Material | THREE.Material[] }
      ).material;
      if (!material) return;
      const targeted = this.sceneSectionObjectTargeted(
        layerId,
        obj,
        style,
        layerTargets,
        productTargets,
      );
      const materials = Array.isArray(material) ? material : [material];
      const windowTargeted =
        targeted &&
        this.sceneSectionWindowAppliesToObject(layerId, obj) &&
        sectionWindow !== null;
      for (const m of materials) {
        this.applySceneSectionMaterial(
          m,
          planes,
          targeted,
          clippingPlanes,
          sectionWindow,
          sectionWindowClippingPlanes,
          windowTargeted,
        );
      }
    });
  }
  this.rebuildSceneSectionHelpers(
    style,
    planes,
    layerTargets,
    productTargets,
  );
  this.applySceneSectionHelperTransitionOpacity();
  this.updateMtVolumeCutIsoOverlays(
    this.styleForLayer(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID),
  );
  this.updateSeismicVolumeCutIsoOverlays(
    this.styleForLayer(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID),
  );
}

export function reapplySceneSectionPlanes(this: any): void {
  if (this.sceneSectionReapplySuspended) return;
  this.applySceneSectionPlanes(this.currentSceneSectionStyle());
}

export function listSceneSectionPlanePickables(this: any): THREE.Object3D[] {
  return this.sceneSectionRuntime?.pickables ?? [];
}

export function getSceneSectionPlanePosition(this: any, axis: SceneSectionAxis): THREE.Vector3 | null {
  const obj = this.sceneSectionRuntime?.planes.get(axis);
  return obj ? obj.position.clone() : null;
}

export function getSceneSectionPlaneScalar(this: any, axis: SceneSectionAxis): number | null {
  const plane = this.resolveSceneSectionPlanes(
    this.lastSceneSectionStyle,
  ).find((candidate: ResolvedSceneSectionPlane) => candidate.axis === axis);
  return plane ? plane.positionM : null;
}

export function getSceneSectionWindowValue(this: any, 
  axis: SceneSectionAxis,
  kind: SceneSectionWindowHandleKind,
): number | null {
  if (axis !== "x" && axis !== "y") return null;
  const bounds = this.sceneSectionBounds(
    this.lastSceneSectionStyle,
    this.sceneSectionLayerIds(this.lastSceneSectionStyle),
    this.sceneSectionProductIds(this.lastSceneSectionStyle),
  );
  const window = this.resolveSceneSectionWindow(
    {
      ...this.lastSceneSectionStyle,
      sceneSectionActiveAxis: axis,
      sceneSectionWindowEnabled: true,
      sceneSectionWindowActiveAxis: axis,
    },
    bounds,
  );
  if (!window) return null;
  if (kind === "window-min") return window.minAlongM;
  if (kind === "window-max") return window.maxAlongM;
  return window.bottomElevationM;
}

export function previewSceneSectionPlane(this: any, axis: SceneSectionAxis, positionM: number): void {
  const style = this.lastSceneSectionStyle;
  const planes = style.sceneSectionPlanes ?? {};
  this.applySceneSectionPlanes({
    ...style,
    sceneSectionEnabled: true,
    sceneSectionActiveAxis: axis,
    sceneSectionPlanes: {
      ...planes,
      [axis]: {
        ...(planes[axis] ?? {}),
        enabled: true,
        positionM,
      },
    },
  });
}

export function previewSceneSectionWindow(this: any, 
  axis: SceneSectionAxis,
  kind: SceneSectionWindowHandleKind,
  valueM: number,
): void {
  if (axis !== "x" && axis !== "y") return;
  const style = this.lastSceneSectionStyle;
  const byAxis = style.sceneSectionWindowByAxis ?? {};
  const current = byAxis[axis] ?? {};
  const patch =
    kind === "window-min"
      ? { minAlongM: valueM }
      : kind === "window-max"
        ? { maxAlongM: valueM }
        : { bottomElevationM: valueM };
  this.applySceneSectionPlanes({
    ...style,
    sceneSectionEnabled: true,
    sceneSectionActiveAxis: axis,
    sceneSectionWindowEnabled: true,
    sceneSectionWindowActiveAxis: axis,
    sceneSectionWindowByAxis: {
      ...byAxis,
      [axis]: {
        ...current,
        ...patch,
      },
    },
  });
}
