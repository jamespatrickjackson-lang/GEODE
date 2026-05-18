import * as THREE from "three";
import type { SceneHandle } from "../scene";

export interface LayerDiagnosticsProjectContext {
  projectSlug?: string;
  projectName?: string;
}

export interface LayerDiagnosticsSnapshot {
  timestamp: string;
  projectSlug: string | null;
  projectName: string | null;
  totalSceneObjectCount: number;
  visibleSceneObjectCount: number;
  geometryCount: number | null;
  materialCount: number | null;
  textureCount: number | null;
  approximateTriangleCount: number | null;
  approximatePointCount: number | null;
  rendererInfoMemory: Record<string, number> | null;
  rendererInfoRender: Record<string, number> | null;
  registeredLayerIds: string[];
  loadedLayerIds: string[];
  visibleLayerIds: string[];
  hiddenLayerIds: string[];
  layerObjectCounts: Record<string, number>;
  layerVisibleObjectCounts: Record<string, number>;
  notes: string[];
}

export interface GeovoxDiagnosticsHook {
  getSnapshot: () => LayerDiagnosticsSnapshot;
  logSnapshot: () => LayerDiagnosticsSnapshot;
  getLastSnapshot: () => LayerDiagnosticsSnapshot | null;
}

declare global {
  interface Window {
    __GEOVOX_DIAGNOSTICS__?: GeovoxDiagnosticsHook;
  }
}

const MATERIAL_TEXTURE_KEYS = [
  "map",
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "lightMap",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
  "specularMap",
] as const;

function objectIsEffectivelyVisible(object: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = object;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return true;
}

function materialArray(
  material: THREE.Material | THREE.Material[] | undefined,
): THREE.Material[] {
  if (!material) return [];
  return Array.isArray(material) ? material : [material];
}

function collectTexturesFromMaterial(
  material: THREE.Material,
  textures: Set<THREE.Texture>,
): void {
  const materialRecord = material as unknown as Record<string, unknown>;
  for (const key of MATERIAL_TEXTURE_KEYS) {
    const value = materialRecord[key];
    if (value instanceof THREE.Texture) {
      textures.add(value);
    }
  }

  const uniforms = materialRecord.uniforms;
  if (!uniforms || typeof uniforms !== "object") return;
  for (const uniform of Object.values(uniforms as Record<string, { value?: unknown }>)) {
    const value = uniform?.value;
    if (value instanceof THREE.Texture) {
      textures.add(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof THREE.Texture) textures.add(item);
      }
    }
  }
}

function triangleCountForMesh(mesh: THREE.Mesh): number {
  const geometry = mesh.geometry;
  if (!geometry) return 0;
  const index = geometry.getIndex();
  if (index) return Math.floor(index.count / 3);
  const position = geometry.getAttribute("position");
  return position ? Math.floor(position.count / 3) : 0;
}

function pointCountForObject(object: THREE.Object3D): number {
  if (!(object instanceof THREE.Points)) return 0;
  const position = object.geometry?.getAttribute("position");
  return position?.count ?? 0;
}

function copyNumericRecord(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object") return null;
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = entry;
    }
  }
  return result;
}

function layerChildCounts(group: THREE.Group): {
  objectCount: number;
  visibleObjectCount: number;
} {
  let objectCount = 0;
  let visibleObjectCount = 0;
  group.traverse((object) => {
    if (object === group) return;
    objectCount += 1;
    if (objectIsEffectivelyVisible(object)) visibleObjectCount += 1;
  });
  return { objectCount, visibleObjectCount };
}

export function collectLayerDiagnosticsSnapshot(
  handle: SceneHandle,
  context: LayerDiagnosticsProjectContext = {},
): LayerDiagnosticsSnapshot {
  const notes: string[] = [];
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let totalSceneObjectCount = 0;
  let visibleSceneObjectCount = 0;
  let approximateTriangleCount = 0;
  let approximatePointCount = 0;

  handle.scene.traverse((object) => {
    if (object !== handle.scene) {
      totalSceneObjectCount += 1;
      if (objectIsEffectivelyVisible(object)) visibleSceneObjectCount += 1;
    }

    const maybeGeometry = (object as { geometry?: THREE.BufferGeometry }).geometry;
    if (maybeGeometry) geometries.add(maybeGeometry);

    for (const material of materialArray(
      (object as { material?: THREE.Material | THREE.Material[] }).material,
    )) {
      materials.add(material);
      collectTexturesFromMaterial(material, textures);
    }

    if (object instanceof THREE.Mesh) {
      approximateTriangleCount += triangleCountForMesh(object);
    }
    approximatePointCount += pointCountForObject(object);
  });

  const registeredLayerIds: string[] = [];
  const loadedLayerIds: string[] = [];
  const visibleLayerIds: string[] = [];
  const hiddenLayerIds: string[] = [];
  const layerObjectCounts: Record<string, number> = {};
  const layerVisibleObjectCounts: Record<string, number> = {};

  if (typeof handle.manager.layerEntries === "function") {
    for (const [id, group] of handle.manager.layerEntries()) {
      registeredLayerIds.push(id);
      const counts = layerChildCounts(group);
      layerObjectCounts[id] = counts.objectCount;
      layerVisibleObjectCounts[id] = counts.visibleObjectCount;
      if (counts.objectCount > 0) loadedLayerIds.push(id);
      if (group.visible) visibleLayerIds.push(id);
      else hiddenLayerIds.push(id);
    }
  } else {
    notes.push("manager.layerEntries unavailable; layer IDs and counts not captured.");
  }

  if (!handle.renderer.info) {
    notes.push("renderer.info unavailable.");
  }
  if (textures.size === 0) {
    notes.push("Texture count is best-effort and may miss internally-owned renderer textures.");
  }

  return {
    timestamp: new Date().toISOString(),
    projectSlug: context.projectSlug ?? null,
    projectName: context.projectName ?? null,
    totalSceneObjectCount,
    visibleSceneObjectCount,
    geometryCount: geometries.size,
    materialCount: materials.size,
    textureCount: textures.size,
    approximateTriangleCount,
    approximatePointCount,
    rendererInfoMemory: copyNumericRecord(handle.renderer.info?.memory),
    rendererInfoRender: copyNumericRecord(handle.renderer.info?.render),
    registeredLayerIds: registeredLayerIds.sort(),
    loadedLayerIds: loadedLayerIds.sort(),
    visibleLayerIds: visibleLayerIds.sort(),
    hiddenLayerIds: hiddenLayerIds.sort(),
    layerObjectCounts,
    layerVisibleObjectCounts,
    notes,
  };
}

export function installDevLayerDiagnostics(
  handle: SceneHandle,
  context: LayerDiagnosticsProjectContext = {},
): () => void {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return () => {};
  }

  let lastSnapshot: LayerDiagnosticsSnapshot | null = null;
  const hook: GeovoxDiagnosticsHook = {
    getSnapshot: () => {
      lastSnapshot = collectLayerDiagnosticsSnapshot(handle, context);
      return lastSnapshot;
    },
    logSnapshot: () => {
      const snapshot = hook.getSnapshot();
      console.log("[GeoVox diagnostics]", snapshot);
      return snapshot;
    },
    getLastSnapshot: () => lastSnapshot,
  };

  window.__GEOVOX_DIAGNOSTICS__ = hook;

  return () => {
    if (window.__GEOVOX_DIAGNOSTICS__ === hook) {
      delete window.__GEOVOX_DIAGNOSTICS__;
    }
  };
}
