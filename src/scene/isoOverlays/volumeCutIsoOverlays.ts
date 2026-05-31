import * as THREE from "three";
import type { EditableStyle } from "../../pages/types";
import {
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import { disposeObjectTree } from "../disposeObjectTree";
import {
  getHeightSampler,
  peekHeightSampler,
  type HeightSampler,
} from "../heightSampler";
import {
  DEFAULT_SCALAR_HIGH_COLOR,
  DEFAULT_SCALAR_LOW_COLOR,
  DEFAULT_SCALAR_MID_COLOR,
  DEFAULT_SEISMIC_HIGH_COLOR,
  DEFAULT_SEISMIC_LOW_COLOR,
  DEFAULT_SEISMIC_MID_COLOR,
  seismicBackgroundAlphaAt,
} from "../styles/colorScales";
import { clampRange, styleColor, styleNumber } from "../styles/styleUtils";
import {
  mtVolumeCutSectionId,
  mtVolumeCutTargetKey,
  seismicVolumeCutSectionId,
  seismicVolumeCutTargetKey,
  updateScalarSectionIsoOverlay,
  type ScalarSectionIsoLineGeometryDebugState,
  type ScalarSectionIsoOverlayUpdateDebugState,
  type ScalarSectionIsoOptions,
} from "./sectionIsoOverlay";
import type {
  ResolvedSceneSectionFrame,
  ResolvedSceneSectionPlane,
  ScalarSectionIsoTarget,
} from "../SceneManager";

const MT_VOLUME_SECTION_ISO_GRID_SIZE = 96;
const SECTION_GROUND_TRIM_EPSILON_M = 0.01;
const SECTION_GROUND_TRACE_LIFT_M = 26;

type SectionGroundTrimContext = {
  sampleHeight: HeightSampler;
  origin: { easting: number; northing: number; elevation: number };
};

type MtVolumeCutIsoUpdateDebugState = {
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
};

type MtVolumeCutMeshBuildDebugState = {
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

function emptyMtVolumeCutMeshBuildDebug(): MtVolumeCutMeshBuildDebugState {
  return {
    totalMs: 0,
    setupMs: 0,
    frameRangeMs: 0,
    bufferAllocMs: 0,
    gridSampleMs: 0,
    indexMs: 0,
    geometryMs: 0,
    materialMs: 0,
    meshObjectMs: 0,
    vertexCount: 0,
    indexCount: 0,
  };
}

function addMtVolumeCutMeshBuildDebug(
  target: MtVolumeCutIsoUpdateDebugState,
  source: MtVolumeCutMeshBuildDebugState,
): void {
  target.meshBuildSetupMs += source.setupMs;
  target.meshBuildFrameRangeMs += source.frameRangeMs;
  target.meshBuildBufferAllocMs += source.bufferAllocMs;
  target.meshBuildGridSampleMs += source.gridSampleMs;
  target.meshBuildIndexMs += source.indexMs;
  target.meshBuildGeometryMs += source.geometryMs;
  target.meshBuildMaterialMs += source.materialMs;
  target.meshBuildMeshObjectMs += source.meshObjectMs;
  target.meshBuildVertexCount += source.vertexCount;
  target.meshBuildIndexCount += source.indexCount;
}

function cutIsoDebugMs(value: number): number {
  return Number(Math.max(0, value).toFixed(3));
}

function emptyScalarSectionIsoLineGeometryDebug(): ScalarSectionIsoLineGeometryDebugState {
  return {
    timingMode: "coarse-pass",
    totalMs: 0,
    setupMs: 0,
    contourPassMs: 0,
    triangleScanMs: 0,
    triangleIntersectionMs: 0,
    segmentRecordMs: 0,
    segmentStitchMs: 0,
    stitchNodeBuildMs: 0,
    stitchTraversalMs: 0,
    stitchPointAssemblyMs: 0,
    stitchLengthFilterMs: 0,
    stitchNormalMs: 0,
    polylineSimplifyMs: 0,
    ribbonExtrudeMs: 0,
    geometryCreateMs: 0,
    triangleCount: 0,
    maskedTriangleCount: 0,
    invalidTriangleCount: 0,
    degenerateTriangleCount: 0,
    levelCandidateCount: 0,
    intersectionAttemptCount: 0,
  };
}

function emptyScalarSectionIsoOverlayDebug(): ScalarSectionIsoOverlayUpdateDebugState {
  return {
    totalMs: 0,
    disposeMs: 0,
    rootCreateMs: 0,
    bandMeshMs: 0,
    lineGeometryMs: 0,
    lineMaterialMs: 0,
    attachMs: 0,
    lineGeometryDebug: emptyScalarSectionIsoLineGeometryDebug(),
    bandMeshCount: 0,
    lineMeshCount: 0,
    lineSourceSegmentCount: 0,
    lineTinySegmentCount: 0,
    linePolylineCount: 0,
    lineSimplifiedPointCount: 0,
    lineRibbonSegmentCount: 0,
    lineSnapToleranceM: 0,
    skippedReason: null,
  };
}

function addScalarSectionIsoOverlayDebug(
  target: ScalarSectionIsoOverlayUpdateDebugState,
  source: ScalarSectionIsoOverlayUpdateDebugState,
): void {
  target.totalMs += source.totalMs;
  target.disposeMs += source.disposeMs;
  target.rootCreateMs += source.rootCreateMs;
  target.bandMeshMs += source.bandMeshMs;
  target.lineGeometryMs += source.lineGeometryMs;
  target.lineMaterialMs += source.lineMaterialMs;
  target.attachMs += source.attachMs;
  target.lineGeometryDebug.totalMs += source.lineGeometryDebug.totalMs;
  target.lineGeometryDebug.timingMode = source.lineGeometryDebug.timingMode;
  target.lineGeometryDebug.setupMs += source.lineGeometryDebug.setupMs;
  target.lineGeometryDebug.contourPassMs +=
    source.lineGeometryDebug.contourPassMs;
  target.lineGeometryDebug.triangleScanMs +=
    source.lineGeometryDebug.triangleScanMs;
  target.lineGeometryDebug.triangleIntersectionMs +=
    source.lineGeometryDebug.triangleIntersectionMs;
  target.lineGeometryDebug.segmentRecordMs +=
    source.lineGeometryDebug.segmentRecordMs;
  target.lineGeometryDebug.segmentStitchMs +=
    source.lineGeometryDebug.segmentStitchMs;
  target.lineGeometryDebug.stitchNodeBuildMs +=
    source.lineGeometryDebug.stitchNodeBuildMs;
  target.lineGeometryDebug.stitchTraversalMs +=
    source.lineGeometryDebug.stitchTraversalMs;
  target.lineGeometryDebug.stitchPointAssemblyMs +=
    source.lineGeometryDebug.stitchPointAssemblyMs;
  target.lineGeometryDebug.stitchLengthFilterMs +=
    source.lineGeometryDebug.stitchLengthFilterMs;
  target.lineGeometryDebug.stitchNormalMs +=
    source.lineGeometryDebug.stitchNormalMs;
  target.lineGeometryDebug.polylineSimplifyMs +=
    source.lineGeometryDebug.polylineSimplifyMs;
  target.lineGeometryDebug.ribbonExtrudeMs +=
    source.lineGeometryDebug.ribbonExtrudeMs;
  target.lineGeometryDebug.geometryCreateMs +=
    source.lineGeometryDebug.geometryCreateMs;
  target.lineGeometryDebug.triangleCount +=
    source.lineGeometryDebug.triangleCount;
  target.lineGeometryDebug.maskedTriangleCount +=
    source.lineGeometryDebug.maskedTriangleCount;
  target.lineGeometryDebug.invalidTriangleCount +=
    source.lineGeometryDebug.invalidTriangleCount;
  target.lineGeometryDebug.degenerateTriangleCount +=
    source.lineGeometryDebug.degenerateTriangleCount;
  target.lineGeometryDebug.levelCandidateCount +=
    source.lineGeometryDebug.levelCandidateCount;
  target.lineGeometryDebug.intersectionAttemptCount +=
    source.lineGeometryDebug.intersectionAttemptCount;
  target.bandMeshCount += source.bandMeshCount;
  target.lineMeshCount += source.lineMeshCount;
  target.lineSourceSegmentCount += source.lineSourceSegmentCount;
  target.lineTinySegmentCount += source.lineTinySegmentCount;
  target.linePolylineCount += source.linePolylineCount;
  target.lineSimplifiedPointCount += source.lineSimplifiedPointCount;
  target.lineRibbonSegmentCount += source.lineRibbonSegmentCount;
  target.lineSnapToleranceM = Math.max(
    target.lineSnapToleranceM,
    source.lineSnapToleranceM,
  );
  target.skippedReason = source.skippedReason ?? target.skippedReason;
}

function sectionCutFrameRange(
  plane: ResolvedSceneSectionPlane,
  min: [number, number, number],
  max: [number, number, number],
  frame?: ResolvedSceneSectionFrame | null,
): {
  axisA: THREE.Vector3;
  axisB: THREE.Vector3;
  center: THREE.Vector3;
  minA: number;
  maxA: number;
  minB: number;
  maxB: number;
} | null {
  const corners = sectionBoundsCorners(min, max);
  const normalValues = corners.map((corner) => corner.dot(plane.normal));
  const normalMin = Math.min(...normalValues);
  const normalMax = Math.max(...normalValues);
  if (
    plane.signedDistanceM < normalMin - 0.000001 ||
    plane.signedDistanceM > normalMax + 0.000001
  ) {
    return null;
  }
  const matchingFrame = frame?.frameId === plane.frameId ? frame : null;
  const axisA = (matchingFrame?.axisAVector ?? plane.axisAVector).clone();
  const axisB = (matchingFrame?.axisBVector ?? plane.axisBVector).clone();
  const center = (matchingFrame?.center ?? plane.point).clone();
  const [boundsMinA, boundsMaxA] = sectionProjectedRange(corners, axisA);
  const [boundsMinB, boundsMaxB] = sectionProjectedRange(corners, axisB);
  const minA = matchingFrame
    ? clampRange(matchingFrame.minAM, boundsMinA, boundsMaxA)
    : boundsMinA;
  const maxA = matchingFrame
    ? clampRange(matchingFrame.maxAM, boundsMinA, boundsMaxA)
    : boundsMaxA;
  const minB = matchingFrame
    ? clampRange(matchingFrame.minBM, boundsMinB, boundsMaxB)
    : boundsMinB;
  const maxB = matchingFrame
    ? clampRange(matchingFrame.maxBM, boundsMinB, boundsMaxB)
    : boundsMaxB;
  if (maxA <= minA + 0.000001 || maxB <= minB + 0.000001) return null;
  return { axisA, axisB, center, minA, maxA, minB, maxB };
}

function sectionBoundsCorners(
  min: [number, number, number],
  max: [number, number, number],
): THREE.Vector3[] {
  const corners: THREE.Vector3[] = [];
  for (const x of [min[0], max[0]]) {
    for (const y of [min[1], max[1]]) {
      for (const z of [min[2], max[2]]) {
        corners.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  return corners;
}

function sectionProjectedRange(
  points: THREE.Vector3[],
  axis: THREE.Vector3,
): [number, number] {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const value = point.dot(axis);
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  return [low, high];
}

function sectionPointWithinBounds(
  point: THREE.Vector3,
  min: [number, number, number],
  max: [number, number, number],
): boolean {
  return (
    point.x >= min[0] &&
    point.x <= max[0] &&
    point.y >= min[1] &&
    point.y <= max[1] &&
    point.z >= min[2] &&
    point.z <= max[2]
  );
}

function sectionGroundTrimContext(
  host: any,
  plane: ResolvedSceneSectionPlane,
  frame?: ResolvedSceneSectionFrame | null,
): SectionGroundTrimContext | null {
  if (plane.axis === "z" || frame?.groundTraceVisible !== true) return null;
  const sampleHeight = peekHeightSampler();
  if (!sampleHeight) return null;
  return {
    sampleHeight,
    origin: host.siteSurfaceGuideOrigin(
      host.layers.get(host.topoSurfaceLayerId()),
    ),
  };
}

function sectionGroundCeilingM(
  host: any,
  groundTrim: SectionGroundTrimContext | null,
  x: number,
  y: number,
  fallbackM: number,
): number {
  if (!groundTrim) return fallbackM;
  return Math.min(
    fallbackM,
    host.siteGuideSurfaceZ(
      x,
      y,
      groundTrim.sampleHeight,
      groundTrim.origin,
      SECTION_GROUND_TRACE_LIFT_M,
    ),
  );
}

function sectionGroundTrimRequested(
  planes: ResolvedSceneSectionPlane[],
  frames: ResolvedSceneSectionFrame[],
): boolean {
  return planes.some((plane) => {
    if (plane.axis === "z") return false;
    return frames.some(
      (frame) => frame.frameId === plane.frameId && frame.groundTraceVisible,
    );
  });
}

export function listMtVolumeCutIsoTargetsImpl(this: any, layerId?: string): ScalarSectionIsoTarget[] {
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
      (plane: ResolvedSceneSectionPlane) => ({
        targetKey: mtVolumeCutTargetKey(
          UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
          productId,
          plane.axis,
          plane.frameId,
        ),
        layerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        sectionId: mtVolumeCutSectionId(productId, plane.axis, plane.frameId),
        label: `${productLabel} ${plane.label.replace(/\s*frame$/i, "")} cut`,
        kind: "MT volume cut",
        group: "mt-volume-cuts",
        groupLabel: "MT volume cuts",
        visible: true,
        scalarMin,
        scalarMax,
      }),
    );
  }

export function listSeismicVolumeCutIsoTargetsImpl(this: any, layerId?: string): ScalarSectionIsoTarget[] {
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
      (plane: ResolvedSceneSectionPlane) => ({
        targetKey: seismicVolumeCutTargetKey(
          UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
          productId,
          plane.axis,
          plane.frameId,
        ),
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        sectionId: seismicVolumeCutSectionId(
          productId,
          plane.axis,
          plane.frameId,
        ),
        label: `${productLabel} ${plane.label.replace(/\s*frame$/i, "")} volume cut`,
        kind: "seismic volume cut",
        group: "seismic-volume-cuts",
        groupLabel: "Seismic volume cuts",
        visible: true,
        scalarMin: 0,
        scalarMax: 1,
      }),
    );
  }

export function scalarVolumeIsoOverlayGroupImpl(this: any, volumeLayer: THREE.Group): THREE.Group {
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

export function clearMtVolumeCutIsoOverlaysImpl(this: any, volumeLayer?: THREE.Group): void {
    const group = (
      volumeLayer ?? this.layers.get(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID)
    )?.userData.mtVolumeSectionIsoOverlayGroup as THREE.Group | undefined;
    if (!group) return;
    const parent = group.parent;
    if (parent) parent.remove(group);
    disposeObjectTree(group);
    if (volumeLayer) delete volumeLayer.userData.mtVolumeSectionIsoOverlayGroup;
  }

export function sampleScalarVolumeByteImpl(this: any, bytes: Uint8Array, dimensions: [number, number, number], u: number, v: number, w: number): number {
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

export function buildMtVolumeCutMeshImpl(this: any, mesh: THREE.Mesh, plane: ResolvedSceneSectionPlane, options: {
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
    debug: MtVolumeCutMeshBuildDebugState;
  } | null {
    const startedAt = performance.now();
    let stageStart = startedAt;
    const debug = emptyMtVolumeCutMeshBuildDebug();
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

    const grid = MT_VOLUME_SECTION_ISO_GRID_SIZE;
    debug.setupMs += cutIsoDebugMs(performance.now() - stageStart);
    stageStart = performance.now();
    const positions = new Float32Array(grid * grid * 3);
    const values = new Float32Array(grid * grid);
    const alphaValues = new Float32Array(grid * grid);
    const hardMaskValues = new Float32Array(grid * grid);
    debug.vertexCount = grid * grid;
    debug.bufferAllocMs += cutIsoDebugMs(performance.now() - stageStart);
    stageStart = performance.now();
    const frameRange = sectionCutFrameRange(
      plane,
      min,
      max,
      options.sectionFrame,
    );
    if (!frameRange) return null;
    const { axisA, axisB, center, minA, maxA, minB, maxB } = frameRange;
    const centerA = center.dot(axisA);
    const centerB = center.dot(axisB);
    const point = new THREE.Vector3();
    const groundTrim = sectionGroundTrimContext(
      this,
      plane,
      options.sectionFrame,
    );
    debug.frameRangeMs += cutIsoDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    for (let j = 0; j < grid; j += 1) {
      const bT = j / (grid - 1);
      for (let i = 0; i < grid; i += 1) {
        const aT = i / (grid - 1);
        const alongA = minA + (maxA - minA) * aT;
        const columnPoint = center
          .clone()
          .addScaledVector(axisA, alongA - centerA);
        const columnX = columnPoint.x;
        const columnY = columnPoint.y;
        const columnMaxB =
          Math.abs(axisB.z) > 0.82
            ? sectionGroundCeilingM(
                this,
                groundTrim,
                columnX,
                columnY,
                maxB,
              )
            : maxB;
        const columnVisible =
          columnMaxB > minB + SECTION_GROUND_TRIM_EPSILON_M;
        const alongB = columnVisible
          ? minB + (columnMaxB - minB) * bT
          : minB;
        point
          .copy(center)
          .addScaledVector(axisA, alongA - centerA)
          .addScaledVector(axisB, alongB - centerB);
        const vertexIndex = i + j * grid;
        positions[vertexIndex * 3] = point.x;
        positions[vertexIndex * 3 + 1] = point.y;
        positions[vertexIndex * 3 + 2] = point.z;
        const insideVolume = sectionPointWithinBounds(point, min, max);
        const u = (point.x - min[0]) / Math.max(0.000001, max[0] - min[0]);
        const v = (point.y - min[1]) / Math.max(0.000001, max[1] - min[1]);
        const w = (point.z - min[2]) / Math.max(0.000001, max[2] - min[2]);
        const normalized =
          insideVolume
            ? this.sampleScalarVolumeByte(volumeData, dimensions, u, v, w) / 255
            : 0;
        const scalar =
          options.sourceMin +
          normalized * (options.sourceMax - options.sourceMin);
        const mask =
          insideVolume && options.maskVisible && maskData
            ? this.sampleScalarVolumeByte(maskData, dimensions, u, v, w) / 255
            : insideVolume
              ? 1
              : 0;
        values[vertexIndex] = scalar;
        hardMaskValues[vertexIndex] = columnVisible && insideVolume ? 1 : 0;
        alphaValues[vertexIndex] =
          scalar >= options.thresholdMin &&
          scalar <= options.thresholdMax &&
          mask > 0.01
            ? mask
            : 0;
      }
    }
    debug.gridSampleMs += cutIsoDebugMs(performance.now() - stageStart);

    stageStart = performance.now();
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
    debug.indexCount = indices.length;
    debug.indexMs += cutIsoDebugMs(performance.now() - stageStart);

    stageStart = performance.now();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    debug.geometryMs += cutIsoDebugMs(performance.now() - stageStart);
    stageStart = performance.now();
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      fog: false,
    });
    material.userData.ignoreLayerStyle = true;
    material.userData.sceneSectionHelper = true;
    debug.materialMs += cutIsoDebugMs(performance.now() - stageStart);
    stageStart = performance.now();
    const cut = new THREE.Mesh(geometry, material);
    cut.name = `${plane.axis.toUpperCase()} MT volume ISO cut`;
    cut.userData.ignoreLayerStyle = true;
    cut.userData.sceneSectionHelper = true;
    cut.userData.sectionIsoTargetKey = options.targetKey;
    cut.userData.sectionIsoPlaneAxis = plane.axis;
    cut.userData.sectionIsoFrameId = plane.frameId;
    cut.userData.sectionIsoFrameLabel = plane.label;
    cut.userData.sectionIsoPlanePositionM = plane.positionM;
    cut.userData.sectionGroundTrimEnabled = groundTrim !== null;
    cut.userData.sectionGroundTrimSource = "ground-trace";
    debug.meshObjectMs += cutIsoDebugMs(performance.now() - stageStart);
    debug.totalMs = cutIsoDebugMs(performance.now() - startedAt);
    return { mesh: cut, values, alphaValues, hardMaskValues, debug };
  }

export function updateMtVolumeCutIsoOverlaysImpl(this: any, style: EditableStyle): void {
    const startedAt = performance.now();
    const debug: MtVolumeCutIsoUpdateDebugState = {
      policy: "full-rebuild",
      totalMs: 0,
      clearMs: 0,
      setupMs: 0,
      meshBuildMs: 0,
      meshBuildSetupMs: 0,
      meshBuildFrameRangeMs: 0,
      meshBuildBufferAllocMs: 0,
      meshBuildGridSampleMs: 0,
      meshBuildIndexMs: 0,
      meshBuildGeometryMs: 0,
      meshBuildMaterialMs: 0,
      meshBuildMeshObjectMs: 0,
      meshBuildVertexCount: 0,
      meshBuildIndexCount: 0,
      overlayUpdateMs: 0,
      overlayDebug: emptyScalarSectionIsoOverlayDebug(),
      attachMs: 0,
      disposeMs: 0,
      planesCount: 0,
      selectedPlaneCount: 0,
      cutsBuiltCount: 0,
      overlayRootCount: 0,
      gridSize: MT_VOLUME_SECTION_ISO_GRID_SIZE,
      skippedReason: null,
    };
    const finish = (skippedReason: string | null = null): void => {
      debug.skippedReason = skippedReason;
      debug.totalMs = cutIsoDebugMs(performance.now() - startedAt);
      this.lastMtVolumeCutIsoUpdateDebug = debug;
    };

    const volumeLayer = this.layers.get(
      UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
    );
    if (!volumeLayer) {
      finish("missing-volume-layer");
      return;
    }

    let stageStart = performance.now();
    this.clearMtVolumeCutIsoOverlays(volumeLayer);
    debug.clearMs += cutIsoDebugMs(performance.now() - stageStart);

    if (style.sectionIsoEnabled !== true) {
      finish("section-iso-disabled");
      return;
    }
    if (!volumeLayer.visible) {
      finish("volume-layer-hidden");
      return;
    }
    const mesh = this.activeScalarVolumeMesh();
    if (!mesh) {
      finish("missing-active-volume-mesh");
      return;
    }
    const planes = this.sceneSectionActivePlanes(this.lastSceneSectionStyle);
    debug.planesCount = planes.length;
    if (planes.length === 0) {
      finish("no-active-section-planes");
      return;
    }

    stageStart = performance.now();
    const sectionBounds = this.sceneSectionBounds(
      this.lastSceneSectionStyle,
      this.sceneSectionLayerIds(this.lastSceneSectionStyle),
      this.sceneSectionProductIds(this.lastSceneSectionStyle),
    );
    const sectionFrames = this.resolveSceneSectionFrames(
      this.lastSceneSectionStyle,
      sectionBounds,
    );
    if (
      sectionGroundTrimRequested(planes, sectionFrames) &&
      !peekHeightSampler()
    ) {
      void getHeightSampler().then(() => {
        this.updateMtVolumeCutIsoOverlays(
          this.styleForLayer(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID),
        );
      });
    }

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
    debug.setupMs += cutIsoDebugMs(performance.now() - stageStart);

    stageStart = performance.now();
    const overlayGroup = this.scalarVolumeIsoOverlayGroup(volumeLayer);
    debug.attachMs += cutIsoDebugMs(performance.now() - stageStart);
    for (const plane of planes) {
      const targetKey = mtVolumeCutTargetKey(
        UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        productId,
        plane.axis,
        plane.frameId,
      );
      if (selectedTargets[targetKey] === false) continue;
      debug.selectedPlaneCount += 1;
      stageStart = performance.now();
      const cut = this.buildMtVolumeCutMesh(mesh, plane, {
        sourceMin,
        sourceMax,
        thresholdMin,
        thresholdMax,
        maskVisible: style.scalarVolumeMaskVisible !== false,
        targetKey,
        sectionFrame:
          sectionFrames.find(
            (frame: ResolvedSceneSectionFrame) =>
              frame.frameId === plane.frameId,
          ) ?? null,
      });
      debug.meshBuildMs += cutIsoDebugMs(performance.now() - stageStart);
      if (!cut) continue;
      addMtVolumeCutMeshBuildDebug(debug, cut.debug);
      debug.cutsBuiltCount += 1;
      const overlayDebug = emptyScalarSectionIsoOverlayDebug();
      stageStart = performance.now();
      updateScalarSectionIsoOverlay(cut.mesh, cut.values, {
        ...baseOptions,
        targetKey,
        alphaValues: cut.alphaValues,
        hardMaskValues: cut.hardMaskValues,
        debug: overlayDebug,
      });
      addScalarSectionIsoOverlayDebug(debug.overlayDebug, overlayDebug);
      debug.overlayUpdateMs += cutIsoDebugMs(performance.now() - stageStart);
      stageStart = performance.now();
      if (cut.mesh.userData.scalarSectionIsoOverlayRoot) {
        overlayGroup.add(cut.mesh);
        debug.overlayRootCount += 1;
      } else {
        const disposeStartedAt = performance.now();
        disposeObjectTree(cut.mesh);
        debug.disposeMs += cutIsoDebugMs(
          performance.now() - disposeStartedAt,
        );
      }
      debug.attachMs += cutIsoDebugMs(performance.now() - stageStart);
    }
    if (overlayGroup.children.length === 0) {
      stageStart = performance.now();
      this.clearMtVolumeCutIsoOverlays(volumeLayer);
      debug.disposeMs += cutIsoDebugMs(performance.now() - stageStart);
    }
    finish();
  }

export function seismicVolumeIsoOverlayGroupImpl(this: any, seismicLayer: THREE.Group): THREE.Group {
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

export function clearSeismicVolumeCutIsoOverlaysImpl(this: any, seismicLayer?: THREE.Group): void {
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

export function buildSeismicVolumeCutMeshImpl(this: any, mesh: THREE.Mesh, plane: ResolvedSceneSectionPlane, options: {
      amplitudeMin: number;
      amplitudeMax: number;
      amplitudeGamma: number;
      removeBackground: boolean;
      backgroundCutoff: number;
      targetKey: string;
      sectionFrame?: ResolvedSceneSectionFrame | null;
    }): {
    mesh: THREE.Mesh;
    values: Float32Array;
    alphaValues: Float32Array;
    hardMaskValues: Float32Array;
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

    const grid = MT_VOLUME_SECTION_ISO_GRID_SIZE;
    const positions = new Float32Array(grid * grid * 3);
    const values = new Float32Array(grid * grid);
    const alphaValues = new Float32Array(grid * grid);
    const hardMaskValues = new Float32Array(grid * grid);
    const frameRange = sectionCutFrameRange(
      plane,
      min,
      max,
      options.sectionFrame,
    );
    if (!frameRange) return null;
    const { axisA, axisB, center, minA, maxA, minB, maxB } = frameRange;
    const centerA = center.dot(axisA);
    const centerB = center.dot(axisB);
    const point = new THREE.Vector3();
    const groundTrim = sectionGroundTrimContext(
      this,
      plane,
      options.sectionFrame,
    );

    for (let j = 0; j < grid; j += 1) {
      const bT = j / (grid - 1);
      for (let i = 0; i < grid; i += 1) {
        const aT = i / (grid - 1);
        const alongA = minA + (maxA - minA) * aT;
        const columnPoint = center
          .clone()
          .addScaledVector(axisA, alongA - centerA);
        const columnX = columnPoint.x;
        const columnY = columnPoint.y;
        const columnMaxB =
          Math.abs(axisB.z) > 0.82
            ? sectionGroundCeilingM(
                this,
                groundTrim,
                columnX,
                columnY,
                maxB,
              )
            : maxB;
        const columnVisible =
          columnMaxB > minB + SECTION_GROUND_TRIM_EPSILON_M;
        const alongB = columnVisible
          ? minB + (columnMaxB - minB) * bT
          : minB;
        point
          .copy(center)
          .addScaledVector(axisA, alongA - centerA)
          .addScaledVector(axisB, alongB - centerB);
        const vertexIndex = i + j * grid;
        positions[vertexIndex * 3] = point.x;
        positions[vertexIndex * 3 + 1] = point.y;
        positions[vertexIndex * 3 + 2] = point.z;
        const insideVolume = sectionPointWithinBounds(point, min, max);
        const u = (point.x - min[0]) / Math.max(0.000001, max[0] - min[0]);
        const v = (point.y - min[1]) / Math.max(0.000001, max[1] - min[1]);
        const w = (point.z - min[2]) / Math.max(0.000001, max[2] - min[2]);
        const amplitude =
          insideVolume
            ? this.sampleScalarVolumeByte(volumeData, dimensions, u, v, w) / 255
            : 0;
        values[vertexIndex] = amplitude;
        hardMaskValues[vertexIndex] = columnVisible && insideVolume ? 1 : 0;
        alphaValues[vertexIndex] = insideVolume
          ? seismicBackgroundAlphaAt(
              amplitude,
              options.amplitudeMin,
              options.amplitudeMax,
              options.removeBackground,
              options.amplitudeGamma,
              options.backgroundCutoff,
            )
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
    cut.name = `${plane.axis.toUpperCase()} seismic volume ISO cut`;
    cut.userData.ignoreLayerStyle = true;
    cut.userData.sceneSectionHelper = true;
    cut.userData.sectionIsoTargetKey = options.targetKey;
    cut.userData.sectionIsoPlaneAxis = plane.axis;
    cut.userData.sectionIsoFrameId = plane.frameId;
    cut.userData.sectionIsoFrameLabel = plane.label;
    cut.userData.sectionIsoPlanePositionM = plane.positionM;
    cut.userData.sectionGroundTrimEnabled = groundTrim !== null;
    cut.userData.sectionGroundTrimSource = "ground-trace";
    return { mesh: cut, values, alphaValues, hardMaskValues };
  }

export function updateSeismicVolumeCutIsoOverlaysImpl(this: any, style: EditableStyle): void {
    const seismicLayer = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!seismicLayer) return;
    this.clearSeismicVolumeCutIsoOverlays(seismicLayer);
    if (style.sectionIsoEnabled !== true || !seismicLayer.visible) return;
    const mesh = this.activeSeismicVolumeMesh();
    if (!mesh) return;
    const planes = this.sceneSectionActivePlanes(this.lastSceneSectionStyle);
    if (planes.length === 0) return;
    const sectionBounds = this.sceneSectionBounds(
      this.lastSceneSectionStyle,
      this.sceneSectionLayerIds(this.lastSceneSectionStyle),
      this.sceneSectionProductIds(this.lastSceneSectionStyle),
    );
    const sectionFrames = this.resolveSceneSectionFrames(
      this.lastSceneSectionStyle,
      sectionBounds,
    );
    if (
      sectionGroundTrimRequested(planes, sectionFrames) &&
      !peekHeightSampler()
    ) {
      void getHeightSampler().then(() => {
        this.updateSeismicVolumeCutIsoOverlays(
          this.styleForLayer(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID),
        );
      });
    }

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
        plane.frameId,
      );
      if (selectedTargets[targetKey] === false) continue;
      const cut = this.buildSeismicVolumeCutMesh(mesh, plane, {
        amplitudeMin,
        amplitudeMax,
        amplitudeGamma,
        removeBackground,
        backgroundCutoff,
        targetKey,
        sectionFrame:
          sectionFrames.find(
            (frame: ResolvedSceneSectionFrame) =>
              frame.frameId === plane.frameId,
          ) ?? null,
      });
      if (!cut) continue;
      updateScalarSectionIsoOverlay(cut.mesh, cut.values, {
        ...baseOptions,
        targetKey,
        alphaValues: cut.alphaValues,
        hardMaskValues: cut.hardMaskValues,
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
