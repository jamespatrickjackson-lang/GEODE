import * as THREE from "three";
import {
  SURFACE_RENDER_ORDER,
  SURFACE_PREVIEW_DEPTH_POLICY,
  createMtThresholdSurfaceMaterial,
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
    flatShading?: boolean;
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
  normals?: number[];
  alpha?: number[];
  indices: number[];
}

interface MeshSliceSummary {
  id?: string;
  label?: string;
  kind?: string;
  isoProductId?: string;
  sourceProductId?: string;
  cropStatus?: string;
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
  normals: Float32Array | null = null,
  alpha: Float32Array | null = null,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  const vertexCount = vertices.length / 3;
  if (alpha && alpha.length === vertexCount) {
    // R10: pack RGB + per-vertex feather alpha into an itemSize-4 color
    // attribute. three multiplies vertex alpha into fragment alpha on a
    // transparent vertexColors material, so the feather composes with the
    // transition opacity envelope automatically (no new opacity owner).
    const rgba = new Float32Array(vertexCount * 4);
    for (let i = 0; i < vertexCount; i += 1) {
      rgba[i * 4] = colors[i * 3];
      rgba[i * 4 + 1] = colors[i * 3 + 1];
      rgba[i * 4 + 2] = colors[i * 3 + 2];
      rgba[i * 4 + 3] = alpha[i];
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
    geometry.userData.feathered = true;
  } else {
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  if (scalarValues && scalarValues.length === vertices.length / 3) {
    geometry.userData.scalarValues = scalarValues;
    geometry.userData.scalar = scalar;
    geometry.userData.scalarColorMode = "scalar";
  }
  if (normals && normals.length === vertices.length) {
    // Precomputed field-gradient normals (best practice for isosurfaces):
    // grid-independent, removes lattice-aligned shading striation. Use them
    // instead of geometry-derived normals.
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createPreviewMesh(
  geometry: THREE.BufferGeometry,
  payload: MeshPreviewPayload,
  renderOrder: number,
  label: string,
  materialKind: "surface-preview" | "mt-threshold-surface" = "surface-preview",
): THREE.Mesh {
  const material =
    materialKind === "mt-threshold-surface"
      ? createMtThresholdSurfaceMaterial()
      : createSurfacePreviewMaterial();
  applyMaterialSide(material, payload.material?.side);
  if (payload.material?.flatShading === true) {
    material.flatShading = true;
    material.needsUpdate = true;
  }
  // R10: a feathered surface carries per-vertex alpha (RGBA color attribute).
  // Flag the material so the opaque fast-path never drops that alpha. The bulk
  // is fully opaque (alpha 1; only the sparsest rind fades), so keep depthWrite
  // on — otherwise the solid surface renders see-through/ghosted.
  if (geometry.userData.feathered === true) {
    material.userData.mtThresholdSurfaceFeathered = true;
    material.transparent = true;
    material.depthWrite = true;
    material.needsUpdate = true;
  }
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

function addVerticalSectionTopTrace(
  group: THREE.Group,
  payload: MeshPreviewPayload,
  slice: MeshSliceSummary,
  label: string,
  renderOrder: number,
): void {
  if (slice.kind !== "vertical-section") return;
  const sectionLine = slice.sectionLine as
    | {
        orientation?: string;
        fixedX?: number;
        fixedY?: number;
        xMin?: number;
        xMax?: number;
        yMin?: number;
        yMax?: number;
      }
    | undefined;
  const topZ = payload.sceneBounds?.max?.[2];
  if (!sectionLine || !Number.isFinite(topZ)) return;

  let points: THREE.Vector3[] | null = null;
  if (
    sectionLine.orientation === "east-west" &&
    Number.isFinite(sectionLine.fixedY) &&
    Number.isFinite(sectionLine.xMin) &&
    Number.isFinite(sectionLine.xMax)
  ) {
    points = [
      new THREE.Vector3(sectionLine.xMin, sectionLine.fixedY, topZ),
      new THREE.Vector3(sectionLine.xMax, sectionLine.fixedY, topZ),
    ];
  } else if (
    sectionLine.orientation === "north-south" &&
    Number.isFinite(sectionLine.fixedX) &&
    Number.isFinite(sectionLine.yMin) &&
    Number.isFinite(sectionLine.yMax)
  ) {
    points = [
      new THREE.Vector3(sectionLine.fixedX, sectionLine.yMin, topZ),
      new THREE.Vector3(sectionLine.fixedX, sectionLine.yMax, topZ),
    ];
  }
  if (!points) return;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: "#f8f4e8",
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.name = `${label} top trace`;
  line.renderOrder = renderOrder + 0.02;
  line.userData = {
    displayName: `${label} top trace`,
    resistivitySectionTopTrace: true,
    resistivitySliceId: slice.id,
    resistivitySliceKind: slice.kind,
    resistivitySlice: slice,
    scaleReferenceSurface: true,
  };
  group.add(line);
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
  const payloadNormals =
    payload.normals && payload.normals.length === payload.vertices.length
      ? new Float32Array(payload.normals)
      : null;
  const payloadScalarValues =
    payload.attributes?.scalarValues &&
    payload.attributes.scalarValues.length === payload.vertices.length / 3
      ? new Float32Array(payload.attributes.scalarValues)
      : null;
  // R10: per-vertex uncertainty feather alpha (0..1), one per vertex.
  const payloadAlpha =
    payload.alpha && payload.alpha.length === payload.vertices.length / 3
      ? new Float32Array(payload.alpha)
      : null;
  const minZ = payload.sceneBounds?.min?.[2] ?? 0;
  const maxZ = payload.sceneBounds?.max?.[2] ?? minZ + 1;
  const colors = payloadColors ?? colorBuffer(vertices, minZ, maxZ);

  const group = new THREE.Group();
  group.name = payload.label ?? "Mesh preview";
  group.userData.displayName = payload.label ?? "Mesh preview";
  if (Array.isArray(payload.processing?.isosurfaceProducts)) {
    group.userData.mtIsosurfaceProducts = payload.processing.isosurfaceProducts;
  }

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
      const subNormals = payloadNormals
        ? payloadNormals.slice(
            vertexStart * 3,
            (vertexStart + vertexCount) * 3,
          )
        : null;
      const subAlpha = payloadAlpha
        ? payloadAlpha.slice(vertexStart, vertexStart + vertexCount)
        : null;
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
        subNormals,
        subAlpha,
      );
      const label = slice.label ?? slice.id ?? payload.label ?? "Mesh preview";
      const mesh = createPreviewMesh(
        geometry,
        payload,
        options.renderOrder ?? SURFACE_RENDER_ORDER.meshPreview,
        label,
        thresholdSurfaces.length > 0
          ? "mt-threshold-surface"
          : "surface-preview",
      );
      if (thresholdSurfaces.length > 0) {
        mesh.userData.mtThresholdSurfacePreview = true;
        mesh.userData.mtThresholdSurfaceId = slice.id;
        mesh.userData.mtThresholdSurfaceKind = slice.kind;
        mesh.userData.mtIsosurfaceProductId = slice.isoProductId;
        mesh.userData.mtIsosurfaceSourceProductId = slice.sourceProductId;
        mesh.userData.mtIsosurfaceCropStatus = slice.cropStatus;
        mesh.userData.mtThresholdSurface = slice;
      } else {
        mesh.userData.resistivitySlicePreview = true;
        mesh.userData.resistivitySliceId = slice.id;
        mesh.userData.resistivitySliceKind = slice.kind;
        mesh.userData.resistivitySlice = slice;
      }
      group.add(mesh);
      if (thresholdSurfaces.length === 0) {
        addVerticalSectionTopTrace(
          group,
          payload,
          slice,
          label,
          options.renderOrder ?? SURFACE_RENDER_ORDER.meshPreview,
        );
      }
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
      payloadNormals,
      payloadAlpha,
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
