import * as THREE from "three";
import {
  SURFACE_RENDER_ORDER,
  SURFACE_PREVIEW_DEPTH_POLICY,
  createSurfaceDepthOccluderMaterial,
  createSurfacePreviewMaterial,
} from "./surfaceRenderPolicy";

interface MeshPreviewPayload {
  schema: string;
  label?: string;
  source?: Record<string, unknown>;
  sourceBounds?: Record<string, unknown>;
  sceneBounds?: {
    min: [number, number, number];
    max: [number, number, number];
  };
  scenePlacement?: Record<string, unknown>;
  processing?: Record<string, unknown>;
  material?: {
    side?: "front" | "back" | "double";
    note?: string;
  };
  attributes?: {
    scalarValues?: number[];
    scalar?: {
      name?: string;
      unit?: string;
      min?: number;
      max?: number;
      displayMin?: number;
      displayMax?: number;
      colorStops?: Array<{
        value: number;
        color: string;
      }>;
    };
  };
  vertices: number[];
  colors?: number[];
  indices: number[];
}

interface MeshSliceSummary {
  id?: string;
  label?: string;
  kind?: string;
  meshRange?: {
    vertexStart?: number;
    vertexCount?: number;
    indexStart?: number;
    indexCount?: number;
  };
  [key: string]: unknown;
}

type MeshMaterialSide = NonNullable<MeshPreviewPayload["material"]>["side"];
type ScalarMetadata = NonNullable<MeshPreviewPayload["attributes"]>["scalar"];

interface LoadMeshPreviewOptions {
  depthPolicy?: "none" | "depth-occluding-preview";
  renderOrder?: number;
}

const LOW_COLOR = new THREE.Color("#2cc9ff");
const MID_COLOR = new THREE.Color("#69f0b4");
const HIGH_COLOR = new THREE.Color("#f8dd6d");

function heightColor(t: number): THREE.Color {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const color = new THREE.Color();
  if (clamped < 0.5) {
    color.lerpColors(LOW_COLOR, MID_COLOR, clamped / 0.5);
  } else {
    color.lerpColors(MID_COLOR, HIGH_COLOR, (clamped - 0.5) / 0.5);
  }
  return color;
}

function colorBuffer(vertices: Float32Array, minZ: number, maxZ: number): Float32Array {
  const colors = new Float32Array(vertices.length);
  const zRange = Math.max(1, maxZ - minZ);
  const scratch = new THREE.Color();
  for (let i = 0; i < vertices.length; i += 3) {
    scratch.copy(heightColor((vertices[i + 2] - minZ) / zRange));
    colors[i] = scratch.r;
    colors[i + 1] = scratch.g;
    colors[i + 2] = scratch.b;
  }
  return colors;
}

function applyMaterialSide(
  material: THREE.Material & { side?: THREE.Side },
  side: MeshMaterialSide,
): void {
  if (side === "double") {
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
  } else if (side === "back") {
    material.side = THREE.BackSide;
    material.needsUpdate = true;
  }
}

function buildPreviewGeometry(
  vertices: Float32Array,
  indices: Uint32Array,
  colors: Float32Array,
  scalarValues: Float32Array | null,
  scalar: ScalarMetadata,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (scalarValues && scalarValues.length === vertices.length / 3) {
    geometry.userData.scalarValues = scalarValues;
    geometry.userData.scalar = scalar;
    geometry.userData.scalarColorMode = "scalar";
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createPreviewMesh(
  geometry: THREE.BufferGeometry,
  payload: MeshPreviewPayload,
  renderOrder: number,
  label: string,
): THREE.Mesh {
  const material = createSurfacePreviewMaterial();
  applyMaterialSide(material, payload.material?.side);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = label;
  mesh.renderOrder = renderOrder;
  mesh.userData = {
    displayName: label,
    source: payload.source,
    sourceBounds: payload.sourceBounds,
    sceneBounds: payload.sceneBounds,
    scenePlacement: payload.scenePlacement,
    processing: payload.processing,
    meshPreview: true,
    scaleReferenceSurface: true,
    surfaceRenderPolicy: SURFACE_PREVIEW_DEPTH_POLICY.name,
  };
  return mesh;
}

function addDepthOccluder(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  label: string,
): void {
  const occluderMaterial = createSurfaceDepthOccluderMaterial();
  const occluder = new THREE.Mesh(geometry, occluderMaterial);
  occluder.name = `${label} depth occluder`;
  occluder.renderOrder = SURFACE_RENDER_ORDER.depthOccluder;
  occluder.userData = {
    displayName: label,
    meshPreviewDepthOccluder: true,
    ignoreLayerStyle: true,
    surfaceRenderPolicy: SURFACE_PREVIEW_DEPTH_POLICY.name,
  };
  group.add(occluder);
}

function meshSlices(payload: MeshPreviewPayload): MeshSliceSummary[] {
  const raw = payload.processing?.slices;
  return Array.isArray(raw) ? (raw as MeshSliceSummary[]) : [];
}

function meshThresholdSurfaces(payload: MeshPreviewPayload): MeshSliceSummary[] {
  const raw = payload.processing?.thresholdSurfaces;
  return Array.isArray(raw) ? (raw as MeshSliceSummary[]) : [];
}

export async function loadMeshPreview(
  url: string,
  options: LoadMeshPreviewOptions = {},
): Promise<THREE.Group> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch mesh preview ${url}: ${response.status}`);
  }

  const payload = (await response.json()) as MeshPreviewPayload;
  if (
    !["geosee.mesh-preview.v1", "geosee.scalar-grid-mesh-preview.v1"].includes(
      payload.schema,
    ) ||
    !Array.isArray(payload.vertices) ||
    !Array.isArray(payload.indices) ||
    payload.vertices.length % 3 !== 0 ||
    payload.indices.length % 3 !== 0 ||
    (payload.colors !== undefined &&
      (!Array.isArray(payload.colors) ||
        payload.colors.length !== payload.vertices.length))
  ) {
    throw new Error(`Invalid mesh preview payload: ${url}`);
  }

  const vertices = new Float32Array(payload.vertices);
  const indices = new Uint32Array(payload.indices);
  const payloadColors = payload.colors
    ? new Float32Array(payload.colors)
    : null;
  const payloadScalarValues =
    payload.attributes?.scalarValues &&
    payload.attributes.scalarValues.length === payload.vertices.length / 3
      ? new Float32Array(payload.attributes.scalarValues)
      : null;
  const minZ = payload.sceneBounds?.min?.[2] ?? 0;
  const maxZ = payload.sceneBounds?.max?.[2] ?? minZ + 1;
  const colors = payloadColors ?? colorBuffer(vertices, minZ, maxZ);

  const group = new THREE.Group();
  group.name = payload.label ?? "Mesh preview";
  group.userData.displayName = payload.label ?? "Mesh preview";

  const thresholdSurfaces = meshThresholdSurfaces(payload);
  const slices = meshSlices(payload);
  const parts = thresholdSurfaces.length > 0 ? thresholdSurfaces : slices;
  const canSplitSlices =
    payload.schema === "geosee.scalar-grid-mesh-preview.v1" &&
    parts.length > 0 &&
    payloadScalarValues !== null;

  if (canSplitSlices) {
    for (const slice of parts) {
      const range = slice.meshRange;
      if (!range) continue;
      const vertexStart = Math.max(0, Math.floor(range.vertexStart ?? -1));
      const vertexCount = Math.max(0, Math.floor(range.vertexCount ?? 0));
      const indexStart = Math.max(0, Math.floor(range.indexStart ?? -1));
      const indexCount = Math.max(0, Math.floor(range.indexCount ?? 0));
      if (
        vertexStart < 0 ||
        vertexCount <= 0 ||
        indexStart < 0 ||
        indexCount <= 0 ||
        (vertexStart + vertexCount) * 3 > vertices.length ||
        indexStart + indexCount > indices.length
      ) {
        continue;
      }

      const subVertices = vertices.slice(
        vertexStart * 3,
        (vertexStart + vertexCount) * 3,
      );
      const subColors = colors.slice(
        vertexStart * 3,
        (vertexStart + vertexCount) * 3,
      );
      const subScalars = payloadScalarValues.slice(
        vertexStart,
        vertexStart + vertexCount,
      );
      const subIndices = new Uint32Array(indexCount);
      for (let i = 0; i < indexCount; i += 1) {
        subIndices[i] = indices[indexStart + i] - vertexStart;
      }
      const geometry = buildPreviewGeometry(
        subVertices,
        subIndices,
        subColors,
        subScalars,
        payload.attributes?.scalar,
      );
      const label = slice.label ?? slice.id ?? payload.label ?? "Mesh preview";
      const mesh = createPreviewMesh(
        geometry,
        payload,
        options.renderOrder ?? SURFACE_RENDER_ORDER.meshPreview,
        label,
      );
      if (thresholdSurfaces.length > 0) {
        mesh.userData.mtThresholdSurfacePreview = true;
        mesh.userData.mtThresholdSurfaceId = slice.id;
        mesh.userData.mtThresholdSurfaceKind = slice.kind;
        mesh.userData.mtThresholdSurface = slice;
      } else {
        mesh.userData.resistivitySlicePreview = true;
        mesh.userData.resistivitySliceId = slice.id;
        mesh.userData.resistivitySliceKind = slice.kind;
        mesh.userData.resistivitySlice = slice;
      }
      group.add(mesh);
      if (options.depthPolicy === "depth-occluding-preview") {
        addDepthOccluder(group, geometry, label);
      }
    }
  } else {
    const geometry = buildPreviewGeometry(
      vertices,
      indices,
      colors,
      payloadScalarValues,
      payload.attributes?.scalar,
    );
    const mesh = createPreviewMesh(
      geometry,
      payload,
      options.renderOrder ?? SURFACE_RENDER_ORDER.meshPreview,
      payload.label ?? "Mesh preview",
    );
    group.add(mesh);
    if (options.depthPolicy === "depth-occluding-preview") {
      addDepthOccluder(group, geometry, payload.label ?? "Mesh preview");
    }
  }

  if (payload.sceneBounds) {
    const anchor = new THREE.Object3D();
    anchor.name = "mesh-preview-label-anchor";
    anchor.position.set(
      (payload.sceneBounds.min[0] + payload.sceneBounds.max[0]) / 2,
      (payload.sceneBounds.min[1] + payload.sceneBounds.max[1]) / 2,
      payload.sceneBounds.max[2] + 2,
    );
    anchor.userData = {
      labelAnchor: true,
      displayName: payload.label ?? "Mesh preview",
    };
    group.add(anchor);
  }

  return group;
}
