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
  ResolvedSceneSectionFrame,
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
const SCENE_SECTION_AXIS_SPECS: Record<
  SceneSectionAxis,
  {
    normal: THREE.Vector3;
    color: string;
    positionIndex: 0 | 1 | 2;
    frameAIndex: 0 | 1 | 2;
    frameBIndex: 0 | 1 | 2;
  }
> = {
  x: {
    normal: SCENE_SECTION_AXIS_NORMALS.x,
    color: SCENE_SECTION_AXIS_COLORS.x,
    positionIndex: 0,
    frameAIndex: 1,
    frameBIndex: 2,
  },
  y: {
    normal: SCENE_SECTION_AXIS_NORMALS.y,
    color: SCENE_SECTION_AXIS_COLORS.y,
    positionIndex: 1,
    frameAIndex: 0,
    frameBIndex: 2,
  },
  z: {
    normal: SCENE_SECTION_AXIS_NORMALS.z,
    color: SCENE_SECTION_AXIS_COLORS.z,
    positionIndex: 2,
    frameAIndex: 0,
    frameBIndex: 1,
  },
};
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
const SCENE_SECTION_HANDLE_VISUAL_SCALE = 3;
const SCENE_SECTION_CONE_VISUAL_SCALE = SCENE_SECTION_HANDLE_VISUAL_SCALE * 0.7;
const SCENE_SECTION_OUTLINE_WIDTH_SCALE = 0.018;
const SCENE_SECTION_OUTLINE_MIN_WIDTH_M = 240;
const SCENE_SECTION_OUTLINE_MAX_WIDTH_M = 600;
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

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sceneSectionAxes(): SceneSectionAxis[] {
  return ["x", "y", "z"];
}

function sortedClampedRange(
  rawMin: number,
  rawMax: number,
  boundsMin: number,
  boundsMax: number,
): [number, number] {
  const minLimit = -250_000;
  const maxLimit = 250_000;
  const fallbackMin = clampRange(
    Math.min(boundsMin, boundsMax),
    minLimit,
    maxLimit - 100,
  );
  const fallbackMax = clampRange(
    Math.max(boundsMin, boundsMax, fallbackMin + 100),
    fallbackMin + 100,
    maxLimit,
  );
  const sourceMin = Number.isFinite(rawMin) ? rawMin : fallbackMin;
  const sourceMax = Number.isFinite(rawMax) ? rawMax : fallbackMax;
  const low = clampRange(Math.min(sourceMin, sourceMax), minLimit, maxLimit - 100);
  const high = clampRange(
    Math.max(sourceMin, sourceMax, low + 100),
    low + 100,
    maxLimit,
  );
  return [low, high];
}

function axisComponentVector(index: 0 | 1 | 2, direction = 1): THREE.Vector3 {
  const normal = new THREE.Vector3();
  normal.setComponent(index, direction);
  return normal;
}

function sceneSectionOutlineWidthM(width: number, height: number): number {
  const span = Math.max(1, Math.min(Math.abs(width), Math.abs(height)));
  const maxWidth = Math.max(
    16,
    Math.min(SCENE_SECTION_OUTLINE_MAX_WIDTH_M, span * 0.18),
  );
  const minWidth = Math.min(SCENE_SECTION_OUTLINE_MIN_WIDTH_M, maxWidth);
  return clampRange(
    span * SCENE_SECTION_OUTLINE_WIDTH_SCALE,
    minWidth,
    maxWidth,
  );
}

function buildSceneSectionOutlineGeometry(
  minA: number,
  maxA: number,
  minB: number,
  maxB: number,
  widthM: number,
): THREE.BufferGeometry {
  const lowA = Math.min(minA, maxA);
  const highA = Math.max(minA, maxA);
  const lowB = Math.min(minB, maxB);
  const highB = Math.max(minB, maxB);
  const spanA = Math.max(1, highA - lowA);
  const spanB = Math.max(1, highB - lowB);
  const halfStroke = Math.min(widthM * 0.5, spanA * 0.24, spanB * 0.24);
  const outerMinA = lowA - halfStroke;
  const outerMaxA = highA + halfStroke;
  const outerMinB = lowB - halfStroke;
  const outerMaxB = highB + halfStroke;
  const innerMinA = lowA + halfStroke;
  const innerMaxA = highA - halfStroke;
  const innerMinB = lowB + halfStroke;
  const innerMaxB = highB - halfStroke;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        outerMinA,
        outerMinB,
        0,
        outerMaxA,
        outerMinB,
        0,
        outerMaxA,
        outerMaxB,
        0,
        outerMinA,
        outerMaxB,
        0,
        innerMinA,
        innerMinB,
        0,
        innerMaxA,
        innerMinB,
        0,
        innerMaxA,
        innerMaxB,
        0,
        innerMinA,
        innerMaxB,
        0,
      ],
      3,
    ),
  );
  geometry.setIndex([
    0,
    1,
    5,
    0,
    5,
    4,
    1,
    2,
    6,
    1,
    6,
    5,
    2,
    3,
    7,
    2,
    7,
    6,
    3,
    0,
    4,
    3,
    4,
    7,
  ]);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSceneSectionOutlineMaterial(
  color: string,
  opacity: number,
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  hardenStudioHelperMaterial(material);
  material.transparent = opacity < 1;
  (
    material as THREE.MeshBasicMaterial & {
      forceSinglePass?: boolean;
    }
  ).forceSinglePass = true;
  material.userData.sceneSectionHelper = true;
  material.needsUpdate = true;
  return material;
}

function makeSceneSectionConeMaterial(
  color: string,
  opacity: number,
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.38,
    flatShading: true,
    transparent: opacity < 1,
    opacity,
    side: THREE.FrontSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  hardenStudioHelperMaterial(material);
  material.transparent = opacity < 1;
  material.userData.sceneSectionHelper = true;
  material.needsUpdate = true;
  return material;
}

function frameKindForHandle(
  kind: SceneSectionWindowHandleKind,
): "minA" | "maxA" | "minB" | "maxB" {
  if (kind === "window-min" || kind === "frame-min-a") return "minA";
  if (kind === "window-max" || kind === "frame-max-a") return "maxA";
  if (kind === "frame-max-b") return "maxB";
  return "minB";
}

function frameForAxis(
  frames: ResolvedSceneSectionFrame[],
  axis: SceneSectionAxis,
): ResolvedSceneSectionFrame | null {
  return frames.find((frame) => frame.axis === axis) ?? null;
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
  return sceneSectionAxes().map((axis) => {
    const plane = planes[axis] ?? {};
    const spec = SCENE_SECTION_AXIS_SPECS[axis];
    const position =
      typeof plane.positionM === "number" && Number.isFinite(plane.positionM)
        ? clampRange(plane.positionM, -250_000, 250_000)
        : SCENE_SECTION_DEFAULT_POSITIONS[axis];
    return {
      axis,
      enabled: plane.enabled === true,
      positionM: position,
      invert: plane.invert === true,
      normal: spec.normal.clone(),
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
  if (axis === "x" || axis === "y")
    return SCENE_SECTION_AXIS_SPECS[axis].frameAIndex as 0 | 1;
  return null;
}

export function resolveSceneSectionFrames(this: any,
  style: EditableStyle,
  bounds: THREE.Box3,
): ResolvedSceneSectionFrame[] {
  if (
    style.sceneSectionFrameEnabled !== true &&
    style.sceneSectionWindowEnabled !== true
  ) {
    return [];
  }
  const frameByAxis = style.sceneSectionFrameByAxis ?? {};
  const windowByAxis = style.sceneSectionWindowByAxis ?? {};
  const frames: ResolvedSceneSectionFrame[] = [];
  const explicitFrameEnabled = style.sceneSectionFrameEnabled === true;
  for (const axis of sceneSectionAxes()) {
    const spec = SCENE_SECTION_AXIS_SPECS[axis];
    const frame = frameByAxis[axis];
    const legacyWindow =
      axis === "x" || axis === "y" ? windowByAxis[axis] : undefined;
    if (!explicitFrameEnabled && !frame && !legacyWindow) continue;
    const minABound = bounds.min.getComponent(spec.frameAIndex);
    const maxABound = bounds.max.getComponent(spec.frameAIndex);
    const minBBound = bounds.min.getComponent(spec.frameBIndex);
    const maxBBound = bounds.max.getComponent(spec.frameBIndex);
    const rawMinA =
      finiteNumber(frame?.minAM) ??
      finiteNumber(legacyWindow?.minAlongM) ??
      minABound;
    const rawMaxA =
      finiteNumber(frame?.maxAM) ??
      finiteNumber(legacyWindow?.maxAlongM) ??
      maxABound;
    const rawMinB =
      finiteNumber(frame?.minBM) ??
      finiteNumber(legacyWindow?.bottomElevationM) ??
      minBBound;
    const rawMaxB = finiteNumber(frame?.maxBM) ?? maxBBound;
    const [minAM, maxAM] = sortedClampedRange(
      rawMinA,
      rawMaxA,
      minABound,
      maxABound,
    );
    const [minBM, maxBM] = sortedClampedRange(
      rawMinB,
      rawMaxB,
      minBBound,
      maxBBound,
    );
    frames.push({
      axis,
      minAM,
      maxAM,
      minBM,
      maxBM,
      axisAIndex: spec.frameAIndex,
      axisBIndex: spec.frameBIndex,
    });
  }
  return frames;
}

export function resolveSceneSectionWindow(this: any,
  style: EditableStyle,
  bounds: THREE.Box3,
): ResolvedSceneSectionWindow | null {
  const frames = this.resolveSceneSectionFrames(style, bounds).filter(
    (frame: ResolvedSceneSectionFrame) =>
      frame.axis === "x" || frame.axis === "y",
  );
  if (frames.length === 0) return null;
  const preferredAxis =
    style.sceneSectionWindowActiveAxis === "x" ||
    style.sceneSectionWindowActiveAxis === "y"
      ? style.sceneSectionWindowActiveAxis
      : style.sceneSectionActiveAxis === "x" ||
          style.sceneSectionActiveAxis === "y"
        ? style.sceneSectionActiveAxis
        : null;
  const frame =
    (preferredAxis ? frameForAxis(frames, preferredAxis) : null) ?? frames[0];
  return {
    axis: frame.axis as Exclude<SceneSectionAxis, "z">,
    minAlongM: frame.minAM,
    maxAlongM: frame.maxAM,
    bottomElevationM: frame.minBM,
    alongIndex: frame.axisAIndex as 0 | 1,
  };
}

export function sceneSectionFrameClippingPlanes(this: any,
  frame: ResolvedSceneSectionFrame | null,
): THREE.Plane[] {
  if (!frame) return [];
  return [
    new THREE.Plane(axisComponentVector(frame.axisAIndex, 1), -frame.minAM),
    new THREE.Plane(axisComponentVector(frame.axisAIndex, -1), frame.maxAM),
    new THREE.Plane(axisComponentVector(frame.axisBIndex, 1), -frame.minBM),
    new THREE.Plane(axisComponentVector(frame.axisBIndex, -1), frame.maxBM),
  ];
}

export function sceneSectionFrameForObject(this: any,
  layerId: string,
  obj: THREE.Object3D,
  frames: ResolvedSceneSectionFrame[],
): ResolvedSceneSectionFrame | null {
  if (frames.length === 0) return null;
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    return null;
  }
  if (layerId !== UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) return null;
  const overlayAxis =
    typeof obj.userData?.sectionIsoPlaneAxis === "string"
      ? (obj.userData.sectionIsoPlaneAxis as SceneSectionAxis)
      : null;
  if (
    obj.userData?.scalarSectionIsoOverlay === true &&
    (overlayAxis === "x" || overlayAxis === "y" || overlayAxis === "z")
  ) {
    return frameForAxis(frames, overlayAxis);
  }
  if (
    obj.userData?.resistivitySlicePreview !== true ||
    obj.userData?.resistivitySliceKind !== "vertical-section"
  ) {
    return null;
  }
  const sectionLine = (
    obj.userData.resistivitySlice as
      | { sectionLine?: { orientation?: unknown } }
      | undefined
  )?.sectionLine;
  const axis =
    sectionLine?.orientation === "east-west"
      ? "y"
      : sectionLine?.orientation === "north-south"
        ? "x"
        : null;
  return axis ? frameForAxis(frames, axis) : null;
}

export function setSceneSectionUniforms(this: any, 
  material: THREE.ShaderMaterial,
  planes: ResolvedSceneSectionPlane[],
  targeted: boolean,
  frames: ResolvedSceneSectionFrame[],
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
  const activeFrames = targeted ? frames.slice(0, 3) : [];
  ensure<number>("uSceneSectionFrameCount", 0).value = activeFrames.length;
  const frameAxesUniform = ensure<number[]>(
    "uSceneSectionFrameAxes",
    [0, 1, 2],
  );
  const frameBoundsUniform = ensure<THREE.Vector4[]>(
    "uSceneSectionFrameBounds",
    [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()],
  );
  for (let i = 0; i < 3; i += 1) {
    const frame = activeFrames[i];
    frameAxesUniform.value[i] =
      frame?.axis === "y" ? 1 : frame?.axis === "z" ? 2 : 0;
    frameBoundsUniform.value[i].set(
      frame?.minAM ?? -250_000,
      frame?.maxAM ?? 250_000,
      frame?.minBM ?? -250_000,
      frame?.maxBM ?? 250_000,
    );
  }
  const legacyFrame = activeFrames.find(
    (frame) => frame.axis === "x" || frame.axis === "y",
  );
  ensure<number>("uSceneSectionWindowEnabled", 0).value =
    legacyFrame ? 1 : 0;
  ensure<number>("uSceneSectionWindowAxis", 0).value =
    legacyFrame?.axis === "y" ? 1 : 0;
  ensure<number>("uSceneSectionWindowMinAlong", -250_000).value =
    legacyFrame?.minAM ?? -250_000;
  ensure<number>("uSceneSectionWindowMaxAlong", 250_000).value =
    legacyFrame?.maxAM ?? 250_000;
  ensure<number>("uSceneSectionWindowBottomZ", -250_000).value =
    legacyFrame?.minBM ?? -250_000;
}

export function applySceneSectionMaterial(this: any, 
  material: THREE.Material,
  planes: ResolvedSceneSectionPlane[],
  targeted: boolean,
  clippingPlanes: THREE.Plane[],
  frames: ResolvedSceneSectionFrame[],
  frameClippingPlanes: THREE.Plane[],
): void {
  if (material.userData?.sceneSectionHelper === true) return;
  const seismicShader =
    material instanceof THREE.ShaderMaterial &&
    (material.userData?.seismicRaymarchMaterial === true ||
      material.userData?.seismicSectionMaterial === true ||
      material.userData?.scalarVolumeRaymarchMaterial === true);
  if (seismicShader) {
    this.setSceneSectionUniforms(material, planes, targeted, frames);
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
    ...frameClippingPlanes,
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

  const fromFrameByAxis = fromStyle.sceneSectionFrameByAxis ?? {};
  const toFrameByAxis = toStyle.sceneSectionFrameByAxis ?? {};
  const frameByAxis: NonNullable<EditableStyle["sceneSectionFrameByAxis"]> =
    { ...toFrameByAxis };
  for (const axis of axes) {
    const fromFrame = fromFrameByAxis[axis];
    const toFrame = toFrameByAxis[axis];
    if (!toFrame) continue;
    const nextFrame = { ...toFrame };
    for (const key of ["minAM", "maxAM", "minBM", "maxBM"] as const) {
      const from = fromFrame?.[key];
      const to = toFrame[key];
      if (
        typeof from === "number" &&
        Number.isFinite(from) &&
        typeof to === "number" &&
        Number.isFinite(to)
      ) {
        nextFrame[key] = from + (to - from) * t;
      }
    }
    frameByAxis[axis] = nextFrame;
  }
  next.sceneSectionFrameByAxis = frameByAxis;
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
  const helperVisible = (style: EditableStyle): boolean =>
    typeof style.sceneSectionHelperVisible === "boolean"
      ? style.sceneSectionHelperVisible
      : this.editorMode;
  const fromActive =
    tween.fromStyle.sceneSectionEnabled === true &&
    helperVisible(tween.fromStyle);
  const toActive =
    tween.toStyle.sceneSectionEnabled === true &&
    helperVisible(tween.toStyle);
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

  const helperVisible =
    typeof style.sceneSectionHelperVisible === "boolean"
      ? style.sceneSectionHelperVisible
      : this.editorMode;
  runtime.group.visible =
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
  const activePlaneAxes = new Set(
    planes.map((plane: ResolvedSceneSectionPlane) => plane.axis),
  );
  const sectionFrames = this
    .resolveSceneSectionFrames(style, bounds)
    .filter((frame: ResolvedSceneSectionFrame) =>
      activePlaneAxes.has(frame.axis),
    );
  const showGroundTrace = style.sceneSectionGroundTraceVisible === true;
  const showAxes = style.sceneSectionAxesVisible === true;
  const referenceOutlineWidthM = sceneSectionOutlineWidthM(
    Math.max(
      SCENE_SECTION_MIN_HELPER_SIZE_M,
      size.y * SCENE_SECTION_HELPER_PADDING,
    ),
    Math.max(
      SCENE_SECTION_MIN_HELPER_SIZE_M,
      size.z * SCENE_SECTION_HELPER_PADDING,
    ),
  );

  for (const plane of planes) {
    const spec = SCENE_SECTION_AXIS_SPECS[plane.axis];
    const color = spec.color;
    const tangentA = axisComponentVector(spec.frameAIndex);
    const tangentB = axisComponentVector(spec.frameBIndex);
    const width = size.getComponent(spec.frameAIndex);
    const height = size.getComponent(spec.frameBIndex);
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
    const frame = frameForAxis(sectionFrames, plane.axis);
    const planeCenter = center.clone();
    planeCenter.setComponent(spec.positionIndex, plane.positionM);
    const basisNormal = tangentA.clone().cross(tangentB).normalize();
    const planeBasis = new THREE.Matrix4().makeBasis(
      tangentA,
      tangentB,
      basisNormal,
    );
    const planeQuaternion = new THREE.Quaternion().setFromRotationMatrix(
      planeBasis,
    );

    const controlGroup = new THREE.Group();
    controlGroup.name = `${plane.axis.toUpperCase()} Section push/pull controls`;
    controlGroup.position.copy(planeCenter);
    controlGroup.quaternion.copy(planeQuaternion);
    controlGroup.userData.sceneSectionHelper = true;
    controlGroup.renderOrder = SCENE_SECTION_RENDER_ORDER + 1;

    const minLocalA = frame
      ? frame.minAM - planeCenter.getComponent(spec.frameAIndex)
      : -halfWidth;
    const maxLocalA = frame
      ? frame.maxAM - planeCenter.getComponent(spec.frameAIndex)
      : halfWidth;
    const minLocalB = frame
      ? frame.minBM - planeCenter.getComponent(spec.frameBIndex)
      : -halfHeight;
    const maxLocalB = frame
      ? frame.maxBM - planeCenter.getComponent(spec.frameBIndex)
      : halfHeight;
    const frameCenterLocal = new THREE.Vector3(
      (minLocalA + maxLocalA) * 0.5,
      (minLocalB + maxLocalB) * 0.5,
      0,
    );

    const outlineWidthM = referenceOutlineWidthM;
    const outlineGeometry = buildSceneSectionOutlineGeometry(
      minLocalA,
      maxLocalA,
      minLocalB,
      maxLocalB,
      outlineWidthM,
    );
    const outlineOpacity = frame
      ? plane.axis === activeAxis
        ? 1
        : 0.82
      : plane.axis === activeAxis
        ? 1
        : 0.76;
    const outlineMaterial = makeSceneSectionOutlineMaterial(
      color,
      outlineOpacity,
    );
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.name = frame
      ? `${plane.axis.toUpperCase()} Section frame`
      : `${plane.axis.toUpperCase()} Section outline`;
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.userData.sceneSectionHelper = true;
    outline.userData.sceneSectionOutline = true;
    outline.userData.sceneSectionFrameOutline = frame !== null;
    outline.userData.sceneSectionAxis = plane.axis;
    outline.userData.sceneSectionPlaneCoordinateIndex = spec.positionIndex;
    outline.userData.sceneSectionPlanePositionM = plane.positionM;
    outline.userData.sceneSectionFrameColor = color;
    outline.userData.sceneSectionFrameLineWidthM = outlineWidthM;
    outline.userData.sceneSectionFrameBounds = frame
      ? {
          minAM: frame.minAM,
          maxAM: frame.maxAM,
          minBM: frame.minBM,
          maxBM: frame.maxBM,
          axisAIndex: frame.axisAIndex,
          axisBIndex: frame.axisBIndex,
        }
      : null;
    outline.renderOrder = SCENE_SECTION_RENDER_ORDER;
    controlGroup.add(outline);

    const handleSpan = clampRange(
      Math.min(paddedWidth, paddedHeight) * 0.16,
      SCENE_SECTION_HANDLE_MIN_SPAN_M,
      SCENE_SECTION_HANDLE_MAX_SPAN_M,
    );
    const coneLength =
      clampRange(handleSpan * 1.12, 520, 1120) *
      SCENE_SECTION_CONE_VISUAL_SCALE;
    const coneRadius = coneLength * 0.28;
    const arrowSpan = coneLength * 1.28;
    const preservedPickRadius =
      coneRadius *
      (SCENE_SECTION_HANDLE_VISUAL_SCALE / SCENE_SECTION_CONE_VISUAL_SCALE) *
      1.8;
    const pickSize = Math.max(
      SCENE_SECTION_WINDOW_HANDLE_RADIUS_M * SCENE_SECTION_HANDLE_VISUAL_SCALE,
      preservedPickRadius,
    ) * 3;
    const makeDoubleArrowHandle = (
      kind: "push-pull" | SceneSectionWindowHandleKind,
      name: string,
      position: THREE.Vector3,
      localDirection: THREE.Vector3,
      direction?: 1 | -1,
    ): THREE.Group => {
      const group = new THREE.Group();
      group.name = `${name} visual`;
      group.position.copy(position);
      group.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        localDirection.clone().normalize(),
      );
      group.userData.sceneSectionHelper = true;
      group.userData.sceneSectionPlaneHandle = true;
      group.userData.sceneSectionAxis = plane.axis;
      group.userData.sceneSectionPlaneHandleKind = kind;
      group.userData.sceneSectionHandleVisual = "double-arrow";
      group.userData.sceneSectionHandleScale = SCENE_SECTION_HANDLE_VISUAL_SCALE;
      group.renderOrder = SCENE_SECTION_RENDER_ORDER + 3;

      const material = makeSceneSectionConeMaterial(color, outlineOpacity);

      const coneGeometry = new THREE.ConeGeometry(
        coneRadius,
        coneLength,
        18,
        1,
        true,
      );
      coneGeometry.computeVertexNormals();
      const topCone = new THREE.Mesh(coneGeometry, material);
      topCone.position.y = arrowSpan * 0.5;
      topCone.castShadow = false;
      topCone.receiveShadow = false;
      topCone.userData.sceneSectionHelper = true;
      const bottomCone = new THREE.Mesh(coneGeometry.clone(), material);
      bottomCone.position.y = -arrowSpan * 0.5;
      bottomCone.rotation.z = Math.PI;
      bottomCone.castShadow = false;
      bottomCone.receiveShadow = false;
      bottomCone.userData.sceneSectionHelper = true;
      group.add(topCone, bottomCone);

      const pickMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      pickMaterial.userData.sceneSectionHelper = true;
      const pickProxy = new THREE.Mesh(
        new THREE.BoxGeometry(pickSize, pickSize, pickSize),
        pickMaterial,
      );
      pickProxy.name = name;
      pickProxy.userData.sceneSectionHelper = true;
      pickProxy.userData.sceneSectionPlaneHandle = true;
      pickProxy.userData.sceneSectionAxis = plane.axis;
      pickProxy.userData.sceneSectionPlaneHandleKind = kind;
      pickProxy.userData.sceneSectionHandleVisual = "double-arrow";
      pickProxy.userData.sceneSectionHandleScale =
        SCENE_SECTION_HANDLE_VISUAL_SCALE;
      pickProxy.userData.sceneSectionPickProxy = true;
      pickProxy.userData.sceneSectionPickRadius = pickSize * 0.5;
      if (direction) {
        pickProxy.userData.sceneSectionPlaneHandleDirection = direction;
      }
      pickProxy.renderOrder = SCENE_SECTION_RENDER_ORDER + 4;
      group.add(pickProxy);
      runtime.pickables.push(pickProxy);
      return group;
    };

    controlGroup.add(
      makeDoubleArrowHandle(
        "push-pull",
        `${plane.axis.toUpperCase()} Section push/pull handle`,
        new THREE.Vector3(frameCenterLocal.x, frameCenterLocal.y, 0),
        new THREE.Vector3(0, 0, 1),
      ),
    );

    if (frame) {
      const midA = (minLocalA + maxLocalA) * 0.5;
      const midB = (minLocalB + maxLocalB) * 0.5;
      controlGroup.add(
        makeDoubleArrowHandle(
          "frame-min-a",
          `${plane.axis.toUpperCase()} Section frame-min-a handle`,
          new THREE.Vector3(minLocalA, midB, 0),
          new THREE.Vector3(1, 0, 0),
        ),
        makeDoubleArrowHandle(
          "frame-max-a",
          `${plane.axis.toUpperCase()} Section frame-max-a handle`,
          new THREE.Vector3(maxLocalA, midB, 0),
          new THREE.Vector3(1, 0, 0),
        ),
        makeDoubleArrowHandle(
          "frame-min-b",
          `${plane.axis.toUpperCase()} Section frame-min-b handle`,
          new THREE.Vector3(midA, minLocalB, 0),
          new THREE.Vector3(0, 1, 0),
        ),
        makeDoubleArrowHandle(
          "frame-max-b",
          `${plane.axis.toUpperCase()} Section frame-max-b handle`,
          new THREE.Vector3(midA, maxLocalB, 0),
          new THREE.Vector3(0, 1, 0),
        ),
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

    if (frame && (showGroundTrace || showAxes) && plane.axis !== "z") {
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
              .addScaledVector(tangentA, minLocalA)
              .addScaledVector(tangentB, minLocalB),
            planeCenter
              .clone()
              .addScaledVector(tangentA, maxLocalA)
              .addScaledVector(tangentB, minLocalB),
            planeCenter
              .clone()
              .addScaledVector(tangentA, minLocalA)
              .addScaledVector(tangentB, minLocalB),
            planeCenter
              .clone()
              .addScaledVector(tangentA, minLocalA)
              .addScaledVector(tangentB, maxLocalB),
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
          const along = frame.minAM + (frame.maxAM - frame.minAM) * t;
          const horizontalLabel =
            plane.axis === "y"
              ? `${((origin.easting + along) / 1000).toFixed(1)} E km`
              : `${((origin.northing + along) / 1000).toFixed(1)} N km`;
          const labelMesh = this.createSceneSectionScaleLabel(horizontalLabel);
          labelMesh.position
            .copy(planeCenter)
            .addScaledVector(tangentA, minLocalA + (maxLocalA - minLocalA) * t)
            .addScaledVector(tangentB, minLocalB - 420);
          labelMesh.quaternion.copy(planeQuaternion);
          runtime.group.add(labelMesh);
        }
        for (let i = 0; i < tickCount; i += 1) {
          const t = i / (tickCount - 1);
          const z = frame.minBM + (frame.maxBM - frame.minBM) * t;
          const labelMesh = this.createSceneSectionScaleLabel(
            `${(z / 1000).toFixed(1)} elev km`,
          );
          labelMesh.position
            .copy(planeCenter)
            .addScaledVector(tangentA, minLocalA - 620)
            .addScaledVector(tangentB, minLocalB + (maxLocalB - minLocalB) * t);
          labelMesh.quaternion.copy(planeQuaternion);
          runtime.group.add(labelMesh);
        }
      }
      if (showGroundTrace) {
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
            const along = frame.minAM + (frame.maxAM - frame.minAM) * t;
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
  const activePlaneAxes = new Set(
    planes.map((plane: ResolvedSceneSectionPlane) => plane.axis),
  );
  const sectionFrames = this
    .resolveSceneSectionFrames(style, bounds)
    .filter((frame: ResolvedSceneSectionFrame) =>
      activePlaneAxes.has(frame.axis),
    );
  this.sceneSectionClippingActive =
    planes.length > 0 || sectionFrames.length > 0;
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
      const objectFrame = targeted
        ? this.sceneSectionFrameForObject(layerId, obj, sectionFrames)
        : null;
      const frameClippingPlanes =
        this.sceneSectionFrameClippingPlanes(objectFrame);
      for (const m of materials) {
        this.applySceneSectionMaterial(
          m,
          planes,
          targeted,
          clippingPlanes,
          sectionFrames,
          frameClippingPlanes,
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
  const runtime = this.sceneSectionRuntime;
  return runtime?.group.visible ? runtime.pickables : [];
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
  const bounds = this.sceneSectionBounds(
    this.lastSceneSectionStyle,
    this.sceneSectionLayerIds(this.lastSceneSectionStyle),
    this.sceneSectionProductIds(this.lastSceneSectionStyle),
  );
  const frame = frameForAxis(
    this.resolveSceneSectionFrames(
    {
      ...this.lastSceneSectionStyle,
      sceneSectionActiveAxis: axis,
      sceneSectionFrameEnabled: true,
    },
    bounds,
    ),
    axis,
  );
  if (!frame) return null;
  const frameKind = frameKindForHandle(kind);
  if (frameKind === "minA") return frame.minAM;
  if (frameKind === "maxA") return frame.maxAM;
  if (frameKind === "maxB") return frame.maxBM;
  return frame.minBM;
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
  const style = this.lastSceneSectionStyle;
  const frameByAxis = style.sceneSectionFrameByAxis ?? {};
  const currentFrame = frameByAxis[axis] ?? {};
  const legacyByAxis = style.sceneSectionWindowByAxis ?? {};
  const patch =
    frameKindForHandle(kind) === "minA"
      ? { minAM: valueM }
      : frameKindForHandle(kind) === "maxA"
        ? { maxAM: valueM }
        : frameKindForHandle(kind) === "maxB"
          ? { maxBM: valueM }
          : { minBM: valueM };
  const nextFrame = {
    ...currentFrame,
    ...patch,
  };
  const legacyPatch =
    axis === "x" || axis === "y"
      ? {
          sceneSectionWindowEnabled: true,
          sceneSectionWindowActiveAxis: axis,
          sceneSectionWindowByAxis: {
            ...legacyByAxis,
            [axis]: {
              ...(legacyByAxis[axis] ?? {}),
              minAlongM: nextFrame.minAM ?? legacyByAxis[axis]?.minAlongM,
              maxAlongM: nextFrame.maxAM ?? legacyByAxis[axis]?.maxAlongM,
              bottomElevationM:
                nextFrame.minBM ?? legacyByAxis[axis]?.bottomElevationM,
            },
          },
        }
      : {};
  this.applySceneSectionPlanes({
    ...style,
    sceneSectionEnabled: true,
    sceneSectionActiveAxis: axis,
    sceneSectionFrameEnabled: true,
    sceneSectionFrameByAxis: {
      ...frameByAxis,
      [axis]: {
        ...nextFrame,
      },
    },
    ...legacyPatch,
  });
}
