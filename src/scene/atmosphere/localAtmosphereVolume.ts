import * as THREE from "three";
import type { EditableStyle, ProjectLayerSpec, Vec3 } from "../../pages/types";
import { disposeObjectTree } from "../disposeObjectTree";
import { createMistTexture } from "./createMistTexture";
import {
  localAtmosphereStructuralKey,
  localAtmosphereTextureCacheKey,
  resolveLocalAtmosphereStyle,
} from "./localAtmosphereDefaults";
import type { ResolvedLocalAtmosphereStyle } from "./atmosphereTypes";

export type LocalAtmosphereHandleMode = "move" | "sizeX" | "sizeY" | "sizeZ";

export interface LocalAtmospherePreview {
  atmosphereBoundsCenterX: number;
  atmosphereBoundsCenterY: number;
  atmosphereBoundsCenterZ: number;
  atmosphereBoundsSizeX: number;
  atmosphereBoundsSizeY: number;
  atmosphereBoundsSizeZ: number;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSigned(rng: () => number): number {
  return rng() * 2 - 1;
}

function randomInBounds(
  rng: () => number,
  resolved: ResolvedLocalAtmosphereStyle,
): Vec3 {
  const { center, size, mode } = resolved.bounds;
  if (mode === "ellipsoid") {
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = randomSigned(rng);
      y = randomSigned(rng);
      z = randomSigned(rng);
    } while (x * x + y * y + z * z > 1);
    return [
      center[0] + x * size[0] * 0.5,
      center[1] + y * size[1] * 0.5,
      center[2] + z * size[2] * 0.5,
    ];
  }
  return [
    center[0] + randomSigned(rng) * size[0] * 0.5,
    center[1] + randomSigned(rng) * size[1] * 0.5,
    center[2] + randomSigned(rng) * size[2] * 0.5,
  ];
}

function edgeWeight(position: Vec3, resolved: ResolvedLocalAtmosphereStyle): number {
  const { center, size, mode } = resolved.bounds;
  const nx = Math.abs(position[0] - center[0]) / Math.max(size[0] * 0.5, 0.0001);
  const ny = Math.abs(position[1] - center[1]) / Math.max(size[1] * 0.5, 0.0001);
  const nz = Math.abs(position[2] - center[2]) / Math.max(size[2] * 0.5, 0.0001);
  const normalizedEdge = mode === "ellipsoid" ? Math.sqrt(nx * nx + ny * ny + nz * nz) : Math.max(nx, ny, nz);
  return THREE.MathUtils.lerp(
    1,
    1 - THREE.MathUtils.smoothstep(normalizedEdge, 1 - resolved.edgeFade, 1),
    resolved.edgeFade,
  );
}

function verticalWeight(position: Vec3, resolved: ResolvedLocalAtmosphereStyle): number {
  const { center, size } = resolved.bounds;
  const bottom = center[2] - size[2] * 0.5;
  const normalizedHeight = THREE.MathUtils.clamp((position[2] - bottom) / Math.max(size[2], 0.0001), 0, 1);
  return THREE.MathUtils.lerp(1, 1 - normalizedHeight, resolved.verticalFalloff);
}

function updateDebugState(
  group: THREE.Group,
  layerId: string,
  resolved: ResolvedLocalAtmosphereStyle,
  textureCacheKey: string,
): void {
  let puffCount = 0;
  group.traverse((obj) => {
    if (obj.userData?.localAtmospherePuff === true) puffCount += 1;
  });
  group.userData.localAtmosphereDebug = {
    layerId,
    subtype: resolved.subtype,
    textureSource: "generated-canvas",
    cacheKey: textureCacheKey,
    textureCacheKey,
    bounds: resolved.bounds,
    puffCount: resolved.puffCount,
    material: {
      type: "THREE.SpriteMaterial",
      transparent: true,
      depthWrite: false,
      depthTest: resolved.depthTest,
      renderOrder: resolved.renderOrder,
    },
    materialType: "SpriteMaterial",
    shader: "THREE.SpriteMaterial built-in sprite shader",
    shaderMaterial: "THREE.SpriteMaterial",
    geometry: {
      type: "THREE.Sprite",
      primitive: "screen-aligned quad billboard",
      count: puffCount,
    },
    geometryType: "Sprite",
    meshGeometry: "THREE.Sprite screen-aligned quad",
    color: resolved.color,
    opacity: resolved.opacity,
    density: resolved.density,
    softness: resolved.softness,
    edgeFade: resolved.edgeFade,
    verticalFalloff: resolved.verticalFalloff,
    singlePuff: resolved.puffCount === 1,
    depthTest: resolved.depthTest,
    renderOrder: resolved.renderOrder,
    driftEnabled: resolved.driftEnabled,
    driftSpeedMps: resolved.driftSpeedMps,
    driftDirection: resolved.driftDirection,
    boundsHelperVisible: resolved.boundsHelperVisible,
  };
}

function disposeChildren(group: THREE.Group): void {
  for (const child of [...group.children]) {
    disposeObjectTree(child);
    group.remove(child);
  }
}

function helperMaterial(color = "#7dd3fc", opacity = 0.86): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  material.userData.ignoreLayerStyle = true;
  material.userData.ignoreLayerFog = true;
  return material;
}

function helperLineMaterial(): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({
    color: "#7dd3fc",
    transparent: true,
    opacity: 0.62,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  material.userData.ignoreLayerStyle = true;
  material.userData.ignoreLayerFog = true;
  return material;
}

function markEditorHandle(
  obj: THREE.Object3D,
  layerId: string,
  mode: LocalAtmosphereHandleMode,
  pickables: THREE.Object3D[],
): void {
  obj.userData.localAtmosphereEditorHandle = true;
  obj.userData.localAtmosphereLayerId = layerId;
  obj.userData.localAtmosphereHandleMode = mode;
  obj.renderOrder = 4580;
  pickables.push(obj);
}

function removeEditorHelper(group: THREE.Group): void {
  const existing = group.children.find(
    (child) => child.userData?.localAtmosphereEditorRoot === true,
  );
  if (!existing) return;
  group.remove(existing);
  disposeObjectTree(existing);
}

function setHelperTransform(
  helper: THREE.Group,
  resolved: ResolvedLocalAtmosphereStyle,
): void {
  const previewSize = (helper.userData.localAtmospherePreviewSize ??
    resolved.bounds.size) as Vec3;
  const center = resolved.bounds.center;
  const size = [
    Math.max(1, previewSize[0]),
    Math.max(1, previewSize[1]),
    Math.max(1, previewSize[2]),
  ] as Vec3;
  const outline = helper.children.find(
    (child) => child.userData?.localAtmosphereBoundsOutline === true,
  );
  if (outline) {
    outline.position.set(center[0], center[1], center[2]);
    outline.scale.set(size[0], size[1], size[2]);
  }
  for (const child of helper.children) {
    const mode = child.userData
      ?.localAtmosphereHandleMode as LocalAtmosphereHandleMode | undefined;
    if (!mode) continue;
    if (mode === "move") {
      child.position.set(center[0], center[1], center[2]);
    } else if (mode === "sizeX") {
      child.position.set(center[0] + size[0] * 0.5, center[1], center[2]);
    } else if (mode === "sizeY") {
      child.position.set(center[0], center[1] + size[1] * 0.5, center[2]);
    } else if (mode === "sizeZ") {
      child.position.set(center[0], center[1], center[2] + size[2] * 0.5);
    }
  }
}

function updateEditorHelper(
  group: THREE.Group,
  spec: ProjectLayerSpec,
  resolved: ResolvedLocalAtmosphereStyle,
): void {
  removeEditorHelper(group);
  group.userData.localAtmosphereBoundsHelperVisible =
    resolved.boundsHelperVisible;
  group.userData.localAtmosphereEditorPickables = [];
  if (!resolved.boundsHelperVisible) return;
  const pickables: THREE.Object3D[] = [];
  const helper = new THREE.Group();
  helper.name = `${spec.id}-bounds-helper`;
  helper.userData.localAtmosphereEditorRoot = true;

  const outlineGeometry =
    resolved.bounds.mode === "ellipsoid"
      ? new THREE.WireframeGeometry(new THREE.SphereGeometry(0.5, 24, 12))
      : new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
  const outline = new THREE.LineSegments(outlineGeometry, helperLineMaterial());
  outline.name = `${spec.id}-bounds-outline`;
  outline.userData.localAtmosphereBoundsOutline = true;
  outline.renderOrder = 4575;
  helper.add(outline);

  const size = Math.max(
    24,
    Math.min(
      240,
      Math.max(
        resolved.bounds.size[0],
        resolved.bounds.size[1],
        resolved.bounds.size[2],
      ) * 0.035,
    ),
  );
  const move = new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 10),
    helperMaterial("#38bdf8", 0.92),
  );
  markEditorHandle(move, spec.id, "move", pickables);
  helper.add(move);

  const handleGeometry = new THREE.BoxGeometry(
    size * 1.15,
    size * 1.15,
    size * 1.15,
  );
  const handleSpecs: [LocalAtmosphereHandleMode, string][] = [
    ["sizeX", "#f97316"],
    ["sizeY", "#22c55e"],
    ["sizeZ", "#a78bfa"],
  ];
  for (const [mode, color] of handleSpecs) {
    const handle = new THREE.Mesh(
      handleGeometry.clone(),
      helperMaterial(color, 0.88),
    );
    markEditorHandle(handle, spec.id, mode, pickables);
    helper.add(handle);
  }

  helper.userData.localAtmospherePreviewSize = resolved.bounds.size;
  setHelperTransform(helper, resolved);
  group.add(helper);
  group.userData.localAtmosphereEditorPickables = pickables;
}

export function createLocalAtmosphereVolume(spec: ProjectLayerSpec): THREE.Group {
  const group = new THREE.Group();
  group.name = spec.label || spec.id;
  group.userData = {
    displayName: spec.label || spec.id,
    localAtmosphereVolume: true,
    localAtmosphereVolumeLayer: true,
    layerId: spec.id,
    layerSpec: spec,
  };
  rebuildLocalAtmosphereVolume(group, spec, {});
  return group;
}

export function isLocalAtmosphereLayerSpec(spec?: ProjectLayerSpec): boolean {
  return (spec as { type?: string } | undefined)?.type === "atmosphere-volume";
}

export function findLocalAtmosphereVolumeRoot(layerGroup: THREE.Object3D): THREE.Group | null {
  if (layerGroup instanceof THREE.Group && layerGroup.userData?.localAtmosphereVolume === true) {
    return layerGroup;
  }
  let found: THREE.Group | null = null;
  layerGroup.traverse((obj) => {
    if (found) return;
    if (obj instanceof THREE.Group && obj.userData?.localAtmosphereVolume === true) {
      found = obj;
    }
  });
  return found;
}

export function rebuildLocalAtmosphereVolume(
  group: THREE.Group,
  spec: ProjectLayerSpec,
  style: EditableStyle,
): ResolvedLocalAtmosphereStyle {
  const resolved = resolveLocalAtmosphereStyle(spec, style);
  const structuralKey = localAtmosphereStructuralKey(resolved);
  const textureCacheKey = localAtmosphereTextureCacheKey(
    spec.id,
    resolved.seed,
    resolved.softness,
  );
  disposeChildren(group);
  group.position.set(0, 0, 0);
  delete group.userData.localAtmospherePreviewCenter;
  delete group.userData.localAtmospherePreviewSize;
  const texture = createMistTexture(resolved.softness, resolved.seed);
  texture.userData.localAtmosphereTextureSource = "generated-canvas";
  texture.userData.localAtmosphereTextureCacheKey = textureCacheKey;

  const rng = mulberry32(resolved.seed);
  const color = new THREE.Color(resolved.color);
  const singlePuff = resolved.puffCount === 1;
  for (let i = 0; i < resolved.puffCount; i += 1) {
    const position = singlePuff
      ? ([...resolved.bounds.center] as Vec3)
      : randomInBounds(rng, resolved);
    const scaleJitter = singlePuff
      ? 1
      : 1 + randomSigned(rng) * resolved.scaleJitter;
    const scale = resolved.puffScaleM * THREE.MathUtils.clamp(scaleJitter, 0.18, 3);
    const baseOpacity =
      singlePuff
        ? resolved.density
        : resolved.density *
          (0.38 + rng() * 0.62) *
          edgeWeight(position, resolved) *
          verticalWeight(position, resolved);
    const material = new THREE.SpriteMaterial({
      map: texture,
      color,
      opacity: THREE.MathUtils.clamp(baseOpacity * resolved.opacity, 0, 1),
      transparent: true,
      depthWrite: false,
      depthTest: resolved.depthTest,
      toneMapped: true,
    });
    material.userData.preserveMaterialOpacity = true;
    material.userData.preserveMaterialOpacityBase = THREE.MathUtils.clamp(baseOpacity, 0, 1);
    material.userData.localAtmosphereMaterial = true;
    material.userData.localAtmosphereBaseOpacity = material.userData.preserveMaterialOpacityBase;
    const sprite = new THREE.Sprite(material);
    sprite.name = `${spec.id}-puff-${i + 1}`;
    sprite.position.set(position[0], position[1], position[2]);
    sprite.scale.set(scale, scale, 1);
    sprite.renderOrder = resolved.renderOrder;
    sprite.userData.localAtmospherePuff = true;
    sprite.userData.localAtmosphereBasePosition = position;
    sprite.userData.localAtmosphereBaseScale = scale;
    sprite.userData.localAtmosphereBaseOpacity = material.userData.preserveMaterialOpacityBase;
    sprite.userData.localAtmosphereDriftPhase = rng() * Math.PI * 2;
    group.add(sprite);
  }

  group.userData.localAtmosphereStructuralKey = structuralKey;
  group.userData.localAtmosphereResolvedStyle = resolved;
  group.userData.localAtmosphereStyleState = resolved;
  group.userData.localAtmosphereDrift = {
    enabled: resolved.driftEnabled,
    speedMps: resolved.driftSpeedMps,
    direction: resolved.driftDirection,
  };
  group.userData.localAtmosphereTextureCacheKey = textureCacheKey;
  group.renderOrder = resolved.renderOrder;
  updateEditorHelper(group, spec, resolved);
  updateDebugState(group, spec.id, resolved, textureCacheKey);
  return resolved;
}

export function applyLocalAtmosphereVolumeStyle(
  group: THREE.Group,
  spec: ProjectLayerSpec,
  style: EditableStyle,
): ResolvedLocalAtmosphereStyle {
  const resolved = resolveLocalAtmosphereStyle(spec, style);
  const nextStructuralKey = localAtmosphereStructuralKey(resolved);
  const previousResolved = group.userData.localAtmosphereResolvedStyle as
    | ResolvedLocalAtmosphereStyle
    | undefined;
  if (group.userData.localAtmosphereStructuralKey !== nextStructuralKey) {
    return rebuildLocalAtmosphereVolume(group, spec, style);
  }

  const textureCacheKey = localAtmosphereTextureCacheKey(
    spec.id,
    resolved.seed,
    resolved.softness,
  );
  const color = new THREE.Color(resolved.color);
  group.renderOrder = resolved.renderOrder;
  group.userData.localAtmosphereResolvedStyle = resolved;
  group.userData.localAtmosphereDrift = {
    enabled: resolved.driftEnabled,
    speedMps: resolved.driftSpeedMps,
    direction: resolved.driftDirection,
  };
  updateEditorHelper(group, spec, resolved);
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Sprite)) return;
    obj.renderOrder = resolved.renderOrder;
    const material = obj.material;
    const baseOpacity =
      typeof material.userData.localAtmosphereBaseOpacity === "number"
        ? material.userData.localAtmosphereBaseOpacity
        : typeof material.userData.preserveMaterialOpacityBase === "number"
          ? material.userData.preserveMaterialOpacityBase
          : 1;
    const previousBase =
      typeof material.userData.preserveMaterialOpacityBase === "number"
        ? material.userData.preserveMaterialOpacityBase
        : baseOpacity;
    const currentLayerOpacity =
      previousBase > 0
        ? THREE.MathUtils.clamp(material.opacity / previousBase, 0, 1)
        : resolved.opacity;
    const nextLayerOpacity =
      previousResolved && previousResolved.opacity === resolved.opacity
        ? currentLayerOpacity
        : resolved.opacity;
    material.color.copy(color);
    material.opacity = THREE.MathUtils.clamp(baseOpacity * nextLayerOpacity, 0, 1);
    material.transparent = true;
    material.depthWrite = false;
    material.depthTest = resolved.depthTest;
    material.userData.preserveMaterialOpacity = true;
    material.userData.preserveMaterialOpacityBase = baseOpacity;
    material.userData.localAtmosphereBaseOpacity = baseOpacity;
    material.needsUpdate = true;
  });
  updateDebugState(group, spec.id, resolved, textureCacheKey);
  return resolved;
}

function localAtmosphereHelper(group: THREE.Group): THREE.Group | null {
  const helper = group.children.find(
    (child) => child.userData?.localAtmosphereEditorRoot === true,
  );
  return helper instanceof THREE.Group ? helper : null;
}

export function listLocalAtmospherePickables(
  layers: Iterable<THREE.Group>,
  editorMode: boolean,
): THREE.Object3D[] {
  if (!editorMode) return [];
  const pickables: THREE.Object3D[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    const group = findLocalAtmosphereVolumeRoot(layer);
    if (!group?.userData.localAtmosphereBoundsHelperVisible) continue;
    const layerPickables = Array.isArray(
      group.userData.localAtmosphereEditorPickables,
    )
      ? (group.userData.localAtmosphereEditorPickables as THREE.Object3D[])
      : [];
    pickables.push(...layerPickables.filter((obj) => obj.visible !== false));
  }
  return pickables;
}

export function getLocalAtmosphereWorldCenter(
  group: THREE.Group,
): THREE.Vector3 | null {
  const resolved = group.userData.localAtmosphereResolvedStyle as
    | ResolvedLocalAtmosphereStyle
    | undefined;
  if (!resolved) return null;
  const previewCenter = group.userData.localAtmospherePreviewCenter as
    | Vec3
    | undefined;
  const center = previewCenter ?? resolved.bounds.center;
  return new THREE.Vector3(center[0], center[1], center[2]);
}

export function previewLocalAtmosphereMove(
  group: THREE.Group,
  sceneCenter: THREE.Vector3,
): void {
  const resolved = group.userData.localAtmosphereResolvedStyle as
    | ResolvedLocalAtmosphereStyle
    | undefined;
  if (!resolved) return;
  group.position.set(
    sceneCenter.x - resolved.bounds.center[0],
    sceneCenter.y - resolved.bounds.center[1],
    sceneCenter.z - resolved.bounds.center[2],
  );
  const center: Vec3 = [
    sceneCenter.x,
    sceneCenter.y,
    sceneCenter.z,
  ];
  group.userData.localAtmospherePreviewCenter = center;
}

export function previewLocalAtmosphereSizeFromWorld(
  group: THREE.Group,
  mode: Exclude<LocalAtmosphereHandleMode, "move">,
  worldPoint: THREE.Vector3,
): void {
  const resolved = group.userData.localAtmosphereResolvedStyle as
    | ResolvedLocalAtmosphereStyle
    | undefined;
  if (!resolved) return;
  const helper = localAtmosphereHelper(group);
  if (!helper) return;
  const local = group.worldToLocal(worldPoint.clone());
  const nextSize = [
    ...((group.userData.localAtmospherePreviewSize as Vec3 | undefined) ??
      resolved.bounds.size),
  ] as Vec3;
  if (mode === "sizeX") {
    nextSize[0] = THREE.MathUtils.clamp(
      Math.abs(local.x - resolved.bounds.center[0]) * 2,
      1,
      1000000,
    );
  } else if (mode === "sizeY") {
    nextSize[1] = THREE.MathUtils.clamp(
      Math.abs(local.y - resolved.bounds.center[1]) * 2,
      1,
      1000000,
    );
  } else {
    nextSize[2] = THREE.MathUtils.clamp(
      Math.abs(local.z - resolved.bounds.center[2]) * 2,
      1,
      1000000,
    );
  }
  group.userData.localAtmospherePreviewSize = nextSize;
  helper.userData.localAtmospherePreviewSize = nextSize;
  setHelperTransform(helper, resolved);
}

export function getLocalAtmospherePreview(
  group: THREE.Group,
): LocalAtmospherePreview | null {
  const resolved = group.userData.localAtmosphereResolvedStyle as
    | ResolvedLocalAtmosphereStyle
    | undefined;
  if (!resolved) return null;
  const previewCenter = group.userData.localAtmospherePreviewCenter as
    | Vec3
    | undefined;
  const center =
    previewCenter ??
    ([
      resolved.bounds.center[0] + group.position.x,
      resolved.bounds.center[1] + group.position.y,
      resolved.bounds.center[2] + group.position.z,
    ] as Vec3);
  const size =
    (group.userData.localAtmospherePreviewSize as Vec3 | undefined) ??
    resolved.bounds.size;
  return {
    atmosphereBoundsCenterX: center[0],
    atmosphereBoundsCenterY: center[1],
    atmosphereBoundsCenterZ: center[2],
    atmosphereBoundsSizeX: size[0],
    atmosphereBoundsSizeY: size[1],
    atmosphereBoundsSizeZ: size[2],
  };
}

export function tickLocalAtmosphereVolumeLayers(
  layers: Iterable<THREE.Group>,
  nowMs: number,
): void {
  const nowSeconds = nowMs / 1000;
  for (const layer of layers) {
    if (!layer.visible) continue;
    const group = findLocalAtmosphereVolumeRoot(layer);
    if (!group) continue;
    const resolved = group.userData.localAtmosphereResolvedStyle as
      | ResolvedLocalAtmosphereStyle
      | undefined;
    if (!resolved?.driftEnabled) continue;
    const direction = resolved.driftDirection;
    const speed = resolved.driftSpeedMps;
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Sprite)) return;
      const basePosition = obj.userData.localAtmosphereBasePosition as
        | Vec3
        | undefined;
      if (!basePosition) return;
      const baseScale =
        typeof obj.userData.localAtmosphereBaseScale === "number"
          ? obj.userData.localAtmosphereBaseScale
          : 1;
      const phase =
        typeof obj.userData.localAtmosphereDriftPhase === "number"
          ? obj.userData.localAtmosphereDriftPhase
          : 0;
      const offset = Math.sin(nowSeconds * speed * 0.18 + phase) * baseScale * 0.16;
      obj.position.set(
        basePosition[0] + direction[0] * offset,
        basePosition[1] + direction[1] * offset,
        basePosition[2] + direction[2] * offset,
      );
    });
  }
}
