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

export interface SectionIsoOverlayUpdateOptions {
  preserveExisting?: boolean;
  initialTransitionOpacity?: number;
  // Height-sampler retries must replace untrimmed contours even while a
  // Section ISO transition holds rebuilds of its registered target roots.
  bypassTransitionHold?: boolean;
}
import type {
  ResolvedSceneSectionFrame,
  ResolvedSceneSectionPlane,
  ScalarSectionIsoTarget,
} from "../SceneManager";

const MT_VOLUME_SECTION_ISO_GRID_SIZE = 96;
const SECTION_GROUND_TRIM_EPSILON_M = 0.01;
const SECTION_GROUND_TRACE_LIFT_M = 26;
const RESISTIVITY_ON_SEISMIC_SECTION_GROUP =
  "resistivity-on-seismic-sections";
const RESISTIVITY_ON_SEISMIC_VOLUME_CUT_GROUP =
  "resistivity-on-seismic-volume-cuts";

function resistivityOnSeismicSectionTargetKey(
  layerId: string,
  productId: string,
  sectionId: string,
): string {
  return `${layerId}:${productId}:${sectionId}:mt-resistivity`;
}

function resistivityOnSeismicVolumeCutTargetKey(
  layerId: string,
  productId: string,
  axis: string,
  frameId: string,
): string {
  return `${layerId}:${productId}:${axis}:${frameId}:mt-resistivity`;
}

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
        isoSource: "seismic-amplitude",
        sourceLayerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
      }),
    );
  }

export function listSeismicResistivitySectionIsoTargetsImpl(this: any, layerId?: string): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return [];
    const seismicLayer = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    const mtMesh = findMtResistivityVolumeMesh(this);
    if (!seismicLayer || !mtMesh) return [];
    const { sourceMin, sourceMax } = mtSourceRange(mtMesh);
    const targets: ScalarSectionIsoTarget[] = [];
    seismicLayer.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.userData?.seismicSection !== true) return;
      const productId =
        typeof obj.userData.seismicProductId === "string"
          ? obj.userData.seismicProductId
          : obj.uuid;
      const sectionId =
        typeof obj.userData.seismicSectionId === "string"
          ? obj.userData.seismicSectionId
          : typeof obj.userData.sectionId === "string"
            ? obj.userData.sectionId
            : obj.uuid;
      const productLabel =
        typeof obj.userData.seismicProductLabel === "string"
          ? obj.userData.seismicProductLabel
          : "Seismic section";
      targets.push({
        targetKey: resistivityOnSeismicSectionTargetKey(
          UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
          productId,
          sectionId,
        ),
        layerId: UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        sectionId,
        label: `${productLabel} resistivity ISO`,
        kind: "resistivity on seismic section",
        group: RESISTIVITY_ON_SEISMIC_SECTION_GROUP,
        groupLabel: "Resistivity on seismic sections",
        visible: seismicLayer.visible && obj.visible,
        scalarMin: sourceMin,
        scalarMax: sourceMax,
        isoSource: "mt-resistivity",
        sourceLayerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
      });
    });
    return targets;
  }

export function listSeismicResistivityVolumeCutIsoTargetsImpl(this: any, layerId?: string): ScalarSectionIsoTarget[] {
    if (layerId && layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return [];
    const mtMesh = findMtResistivityVolumeMesh(this);
    const mesh = this.activeSeismicVolumeMesh();
    if (!mtMesh || !mesh) return [];
    const { sourceMin, sourceMax } = mtSourceRange(mtMesh);
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
        targetKey: resistivityOnSeismicVolumeCutTargetKey(
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
        label: `${productLabel} ${plane.label.replace(/\s*frame$/i, "")} resistivity cut`,
        kind: "resistivity on seismic volume cut",
        group: RESISTIVITY_ON_SEISMIC_VOLUME_CUT_GROUP,
        groupLabel: "Resistivity on seismic volume cuts",
        visible: true,
        scalarMin: sourceMin,
        scalarMax: sourceMax,
        isoSource: "mt-resistivity",
        sourceLayerId: UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
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

function findMtResistivityVolumeMesh(host: any): THREE.Mesh | null {
  const group = host.layers.get(UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) as
    | THREE.Group
    | undefined;
  if (!group) return null;
  let first: THREE.Mesh | null = null;
  let visible: THREE.Mesh | null = null;
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj.userData?.scalarVolume !== true) return;
    if (!(obj.userData.scalarVolumeData instanceof Uint8Array)) return;
    first = first ?? obj;
    if (!visible && obj.visible) visible = obj;
  });
  return visible ?? first;
}

function mtSourceRange(mesh: THREE.Mesh): { sourceMin: number; sourceMax: number } {
  const sourceRange = Array.isArray(mesh.userData.scalarVolumeSourceRange)
    ? (mesh.userData.scalarVolumeSourceRange as number[])
    : [-2, 4.5];
  const sourceMin = Number.isFinite(sourceRange[0]) ? sourceRange[0] : -2;
  const sourceMax = Number.isFinite(sourceRange[1]) ? sourceRange[1] : 4.5;
  return { sourceMin, sourceMax };
}

function mtSourceBounds(mesh: THREE.Mesh):
  | {
      min: [number, number, number];
      max: [number, number, number];
      dimensions: [number, number, number];
      data: Uint8Array;
      maskData?: Uint8Array;
    }
  | null {
  const dimensions = Array.isArray(mesh.userData.scalarVolumeDimensions)
    ? (mesh.userData.scalarVolumeDimensions as [number, number, number])
    : null;
  const bounds = mesh.userData.scalarVolumeBounds as
    | { min?: [number, number, number]; max?: [number, number, number] }
    | undefined;
  const data = mesh.userData.scalarVolumeData as Uint8Array | undefined;
  if (!dimensions || !bounds?.min || !bounds.max || !data) return null;
  const [nx, ny, nz] = dimensions;
  if (nx <= 1 || ny <= 1 || nz <= 1) return null;
  const maskData = mesh.userData.scalarVolumeMaskData as Uint8Array | undefined;
  return {
    min: bounds.min,
    max: bounds.max,
    dimensions,
    data,
    maskData,
  };
}

function sampleMtResistivityAtWorldPoint(
  host: any,
  mesh: THREE.Mesh,
  point: THREE.Vector3,
  options: {
    sourceMin: number;
    sourceMax: number;
    thresholdMin: number;
    thresholdMax: number;
    maskVisible: boolean;
  },
): { value: number; alpha: number; hardMask: number } {
  const source = mtSourceBounds(mesh);
  if (!source) {
    return { value: options.sourceMin, alpha: 0, hardMask: 0 };
  }
  const { min, max, dimensions, data, maskData } = source;
  const insideVolume = sectionPointWithinBounds(point, min, max);
  if (!insideVolume) {
    return { value: options.sourceMin, alpha: 0, hardMask: 0 };
  }
  const u = (point.x - min[0]) / Math.max(0.000001, max[0] - min[0]);
  const v = (point.y - min[1]) / Math.max(0.000001, max[1] - min[1]);
  const w = (point.z - min[2]) / Math.max(0.000001, max[2] - min[2]);
  const normalized =
    host.sampleScalarVolumeByte(data, dimensions, u, v, w) / 255;
  const value =
    options.sourceMin + normalized * (options.sourceMax - options.sourceMin);
  const mask =
    options.maskVisible && maskData
      ? host.sampleScalarVolumeByte(maskData, dimensions, u, v, w) / 255
      : 1;
  const alpha =
    value >= options.thresholdMin &&
    value <= options.thresholdMax &&
    mask > 0.01
      ? mask
      : 0;
  return { value, alpha, hardMask: 1 };
}

function annotateResistivityIsoRoot(
  mesh: THREE.Mesh,
  group: string,
): void {
  const root = mesh.userData.scalarSectionIsoOverlayRoot as
    | THREE.Object3D
    | undefined;
  if (!root) return;
  root.userData.sectionIsoSource = "mt-resistivity";
  root.userData.sectionIsoSourceLayerId =
    UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID;
  root.userData.sectionIsoTargetGroup = group;
  mesh.userData.sectionIsoSource = "mt-resistivity";
  mesh.userData.sectionIsoSourceLayerId =
    UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID;
  mesh.userData.sectionIsoTargetGroup = group;
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

export function updateMtVolumeCutIsoOverlaysImpl(
  this: any,
  style: EditableStyle,
  options?: SectionIsoOverlayUpdateOptions,
): void {
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
    if (!options?.preserveExisting) {
      this.clearMtVolumeCutIsoOverlays(volumeLayer);
    }
    debug.clearMs += cutIsoDebugMs(performance.now() - stageStart);

    if (style.sectionIsoEnabled !== true) {
      finish("section-iso-disabled");
      return;
    }
    if (!volumeLayer.visible) {
      finish("volume-layer-hidden");
      return;
    }
    const mesh = this.activeScalarVolumeMesh() ?? findMtResistivityVolumeMesh(this);
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
          {
            ...options,
            preserveExisting: false,
            bypassTransitionHold: true,
            initialTransitionOpacity:
              this.currentSectionIsoOverlayTransitionOpacity?.() ?? 0,
          },
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
      if (!options?.preserveExisting) {
        this.clearMtVolumeCutIsoOverlays(volumeLayer);
      }
      debug.disposeMs += cutIsoDebugMs(performance.now() - stageStart);
      finish();
      return;
    }
    this.registerSectionIsoOverlayTransitionTargetRoot?.(
      "mt-volume",
      UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
      overlayGroup,
    );
    this.applyRenderOpacityToTree?.(
      overlayGroup,
      1,
      options?.initialTransitionOpacity ??
        this.currentSectionIsoOverlayTransitionOpacity?.() ??
        1,
    );
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

export function seismicResistivityIsoOverlayGroupImpl(this: any, seismicLayer: THREE.Group): THREE.Group {
    const existing = seismicLayer.userData
      .seismicResistivitySectionIsoOverlayGroup as THREE.Group | undefined;
    if (existing && existing.parent === seismicLayer) return existing;
    const group = new THREE.Group();
    group.name = "resistivity-on-seismic-iso-overlays";
    group.userData.ignoreLayerStyle = true;
    group.userData.sceneSectionHelper = true;
    group.userData.seismicResistivitySectionIsoOverlayGroup = true;
    seismicLayer.userData.seismicResistivitySectionIsoOverlayGroup = group;
    seismicLayer.add(group);
    return group;
  }

export function clearSeismicResistivityIsoOverlaysImpl(this: any, seismicLayer?: THREE.Group): void {
    const group = (
      seismicLayer ?? this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
    )?.userData.seismicResistivitySectionIsoOverlayGroup as
      | THREE.Group
      | undefined;
    if (!group) return;
    const parent = group.parent;
    if (parent) parent.remove(group);
    disposeObjectTree(group);
    if (seismicLayer) {
      delete seismicLayer.userData.seismicResistivitySectionIsoOverlayGroup;
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

function seismicSectionIdForIso(section: THREE.Mesh): string {
  return typeof section.userData.seismicSectionId === "string"
    ? section.userData.seismicSectionId
    : typeof section.userData.sectionId === "string"
      ? section.userData.sectionId
      : section.uuid;
}

function buildSeismicSectionResistivityIsoMesh(
  host: any,
  section: THREE.Mesh,
  mtMesh: THREE.Mesh,
  options: {
    targetKey: string;
    sourceMin: number;
    sourceMax: number;
    thresholdMin: number;
    thresholdMax: number;
    maskVisible: boolean;
  },
): {
  mesh: THREE.Mesh;
  values: Float32Array;
  alphaValues: Float32Array;
  hardMaskValues: Float32Array;
} | null {
  const sourcePosition = section.geometry.getAttribute("position");
  if (!(sourcePosition instanceof THREE.BufferAttribute)) return null;
  section.updateMatrixWorld(true);

  const useGeneratedGrid = sourcePosition.count <= 8;
  let positions: Float32Array;
  let indices: number[];
  let sourceAlpha: Float32Array | null = null;
  const localPoint = new THREE.Vector3();
  const worldPoint = new THREE.Vector3();

  if (useGeneratedGrid) {
    section.geometry.computeBoundingBox();
    const box = section.geometry.boundingBox;
    if (!box) return null;
    const ranges = [
      box.max.x - box.min.x,
      box.max.y - box.min.y,
      box.max.z - box.min.z,
    ];
    const axes = [0, 1, 2].sort((a, b) => ranges[b] - ranges[a]);
    const axisA = axes[0] ?? 0;
    const axisB = axes[1] ?? 2;
    const fixedAxis = axes[2] ?? 1;
    const mins = [box.min.x, box.min.y, box.min.z];
    const maxes = [box.max.x, box.max.y, box.max.z];
    const fixedValue = (mins[fixedAxis] + maxes[fixedAxis]) * 0.5;
    const grid = MT_VOLUME_SECTION_ISO_GRID_SIZE;
    positions = new Float32Array(grid * grid * 3);
    indices = [];
    for (let j = 0; j < grid; j += 1) {
      const bT = j / (grid - 1);
      for (let i = 0; i < grid; i += 1) {
        const aT = i / (grid - 1);
        const coords = [0, 0, 0];
        coords[axisA] = mins[axisA] + (maxes[axisA] - mins[axisA]) * aT;
        coords[axisB] = mins[axisB] + (maxes[axisB] - mins[axisB]) * bT;
        coords[fixedAxis] = fixedValue;
        localPoint.set(coords[0], coords[1], coords[2]);
        worldPoint.copy(localPoint).applyMatrix4(section.matrixWorld);
        const index = i + j * grid;
        positions[index * 3] = worldPoint.x;
        positions[index * 3 + 1] = worldPoint.y;
        positions[index * 3 + 2] = worldPoint.z;
      }
    }
    for (let j = 0; j < grid - 1; j += 1) {
      for (let i = 0; i < grid - 1; i += 1) {
        const a = i + j * grid;
        const b = i + 1 + j * grid;
        const c = i + (j + 1) * grid;
        const d = i + 1 + (j + 1) * grid;
        indices.push(a, b, c, b, d, c);
      }
    }
  } else {
    positions = new Float32Array(sourcePosition.count * 3);
    const alphaAttribute =
      section.geometry.getAttribute("seismicAlpha") ??
      section.geometry.getAttribute("alpha");
    if (alphaAttribute instanceof THREE.BufferAttribute) {
      sourceAlpha = new Float32Array(sourcePosition.count);
    }
    for (let i = 0; i < sourcePosition.count; i += 1) {
      localPoint.fromBufferAttribute(sourcePosition, i);
      worldPoint.copy(localPoint).applyMatrix4(section.matrixWorld);
      positions[i * 3] = worldPoint.x;
      positions[i * 3 + 1] = worldPoint.y;
      positions[i * 3 + 2] = worldPoint.z;
      if (sourceAlpha && alphaAttribute instanceof THREE.BufferAttribute) {
        sourceAlpha[i] = alphaAttribute.getX(i);
      }
    }
    indices = section.geometry.index
      ? Array.from(section.geometry.index.array)
      : Array.from({ length: sourcePosition.count }, (_, index) => index);
  }

  const values = new Float32Array(positions.length / 3);
  const alphaValues = new Float32Array(values.length);
  const hardMaskValues = new Float32Array(values.length);
  for (let i = 0; i < values.length; i += 1) {
    worldPoint.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    const sample = sampleMtResistivityAtWorldPoint(host, mtMesh, worldPoint, {
      sourceMin: options.sourceMin,
      sourceMax: options.sourceMax,
      thresholdMin: options.thresholdMin,
      thresholdMax: options.thresholdMax,
      maskVisible: options.maskVisible,
    });
    const sectionAlpha = sourceAlpha ? sourceAlpha[i] ?? 1 : 1;
    values[i] = sample.value;
    alphaValues[i] = sample.alpha * sectionAlpha;
    hardMaskValues[i] =
      sample.hardMask > 0 && sectionAlpha > 0.01 ? 1 : 0;
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
  const helper = new THREE.Mesh(geometry, material);
  helper.name = `${section.name || "seismic section"} resistivity ISO helper`;
  helper.userData.ignoreLayerStyle = true;
  helper.userData.sceneSectionHelper = true;
  helper.userData.sectionIsoTargetKey = options.targetKey;
  helper.userData.sectionIsoSourceSectionId = seismicSectionIdForIso(section);
  return { mesh: helper, values, alphaValues, hardMaskValues };
}

export function updateSeismicVolumeCutIsoOverlaysImpl(
  this: any,
  style: EditableStyle,
  options?: SectionIsoOverlayUpdateOptions,
): void {
    const seismicLayer = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!seismicLayer) return;
    if (!options?.preserveExisting) {
      this.clearSeismicVolumeCutIsoOverlays(seismicLayer);
    }
    if (style.seismicIsoSource === "mt-resistivity") return;
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
          {
            ...options,
            preserveExisting: false,
            bypassTransitionHold: true,
            initialTransitionOpacity:
              this.currentSectionIsoOverlayTransitionOpacity?.() ?? 0,
          },
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
        const root = cut.mesh.userData.scalarSectionIsoOverlayRoot as
          | THREE.Object3D
          | undefined;
        if (root) {
          root.userData.sectionIsoSource = "seismic-amplitude";
          root.userData.sectionIsoSourceLayerId =
            UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID;
          root.userData.sectionIsoTargetGroup = "seismic-volume-cuts";
        }
        overlayGroup.add(cut.mesh);
      } else {
        disposeObjectTree(cut.mesh);
      }
    }
    if (overlayGroup.children.length === 0) {
      if (!options?.preserveExisting) {
        this.clearSeismicVolumeCutIsoOverlays(seismicLayer);
      }
      return;
    }
    this.registerSectionIsoOverlayTransitionTargetRoot?.(
      "seismic-volume",
      UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
      overlayGroup,
    );
    this.applyRenderOpacityToTree?.(
      overlayGroup,
      1,
      options?.initialTransitionOpacity ??
        this.currentSectionIsoOverlayTransitionOpacity?.() ??
        1,
    );
  }

export function updateSeismicResistivityIsoOverlaysImpl(
  this: any,
  style: EditableStyle,
  options?: SectionIsoOverlayUpdateOptions,
): void {
    const seismicLayer = this.layers.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID);
    if (!seismicLayer) return;
    if (!options?.preserveExisting) {
      this.clearSeismicResistivityIsoOverlays(seismicLayer);
    }
    if (style.seismicIsoSource !== "mt-resistivity") return;
    if (style.sectionIsoEnabled !== true || !seismicLayer.visible) return;
    const mtMesh = findMtResistivityVolumeMesh(this);
    if (!mtMesh) return;
    const mtStyle = this.styleForLayer(
      UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
    ) as EditableStyle;
    const { sourceMin, sourceMax } = mtSourceRange(mtMesh);
    const displayRange = Array.isArray(mtMesh.userData.scalarVolumeDisplayRange)
      ? (mtMesh.userData.scalarVolumeDisplayRange as number[])
      : [sourceMin, sourceMax];
    const displayMin = styleNumber(
      mtStyle,
      "scalarDisplayMin",
      Number.isFinite(displayRange[0]) ? displayRange[0] : sourceMin,
      -100,
      100,
    );
    const displayMax = Math.max(
      styleNumber(
        mtStyle,
        "scalarDisplayMax",
        Number.isFinite(displayRange[1]) ? displayRange[1] : sourceMax,
        -100,
        100,
      ),
      displayMin + 0.000001,
    );
    const thresholdMin = styleNumber(
      mtStyle,
      "scalarVolumeThresholdMin",
      styleNumber(mtStyle, "scalarFocusMin", sourceMin, -100, 100),
      -100,
      100,
    );
    const thresholdMax = Math.max(
      styleNumber(
        mtStyle,
        "scalarVolumeThresholdMax",
        styleNumber(mtStyle, "scalarFocusMax", sourceMax, -100, 100),
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
    const selectedTargets =
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? (style.sectionIsoTargetIds as Record<string, boolean>)
        : {};
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
      colorMin: displayMin,
      colorMax: displayMax,
      midpoint: styleNumber(mtStyle, "scalarMidpoint", 0.5, 0.05, 0.95),
      contrast: styleNumber(mtStyle, "scalarContrast", 1.05, 0.35, 3),
      lowColor: styleColor(mtStyle, "scalarColorLow", DEFAULT_SCALAR_LOW_COLOR),
      midColor: styleColor(mtStyle, "scalarColorMid", DEFAULT_SCALAR_MID_COLOR),
      highColor: styleColor(
        mtStyle,
        "scalarColorHigh",
        DEFAULT_SCALAR_HIGH_COLOR,
      ),
      skipSceneSectionClipping: true,
    } satisfies Omit<ScalarSectionIsoOptions, "targetKey" | "alphaValues">;
    const sampleOptions = {
      sourceMin,
      sourceMax,
      thresholdMin,
      thresholdMax,
      maskVisible: mtStyle.scalarVolumeMaskVisible !== false,
    };
    const overlayGroup = this.seismicResistivityIsoOverlayGroup(seismicLayer);

    seismicLayer.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.userData?.seismicSection !== true || !obj.visible) return;
      const productId =
        typeof obj.userData.seismicProductId === "string"
          ? obj.userData.seismicProductId
          : obj.uuid;
      const sectionId = seismicSectionIdForIso(obj);
      const targetKey = resistivityOnSeismicSectionTargetKey(
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        productId,
        sectionId,
      );
      if (selectedTargets[targetKey] === false) return;
      const helper = buildSeismicSectionResistivityIsoMesh(
        this,
        obj,
        mtMesh,
        {
          targetKey,
          ...sampleOptions,
        },
      );
      if (!helper) return;
      updateScalarSectionIsoOverlay(helper.mesh, helper.values, {
        ...baseOptions,
        targetKey,
        alphaValues: helper.alphaValues,
        hardMaskValues: helper.hardMaskValues,
      });
      if (helper.mesh.userData.scalarSectionIsoOverlayRoot) {
        annotateResistivityIsoRoot(
          helper.mesh,
          RESISTIVITY_ON_SEISMIC_SECTION_GROUP,
        );
        overlayGroup.add(helper.mesh);
      } else {
        disposeObjectTree(helper.mesh);
      }
    });

    const seismicVolumeMesh = this.activeSeismicVolumeMesh();
    const planes = this.sceneSectionActivePlanes(this.lastSceneSectionStyle);
    if (seismicVolumeMesh && planes.length > 0) {
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
          this.updateSeismicResistivityIsoOverlays(
            this.styleForLayer(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID),
            {
              ...options,
              preserveExisting: false,
              bypassTransitionHold: true,
              initialTransitionOpacity:
                this.currentSectionIsoOverlayTransitionOpacity?.() ?? 0,
            },
          );
        });
      }
      const productId =
        typeof seismicVolumeMesh.userData.seismicProductId === "string"
          ? seismicVolumeMesh.userData.seismicProductId
          : seismicVolumeMesh.uuid;
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
      const worldPoint = new THREE.Vector3();
      for (const plane of planes) {
        const targetKey = resistivityOnSeismicVolumeCutTargetKey(
          UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
          productId,
          plane.axis,
          plane.frameId,
        );
        if (selectedTargets[targetKey] === false) continue;
        const cut = this.buildSeismicVolumeCutMesh(seismicVolumeMesh, plane, {
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
        const position = cut.mesh.geometry.getAttribute("position");
        if (!(position instanceof THREE.BufferAttribute)) {
          disposeObjectTree(cut.mesh);
          continue;
        }
        for (let i = 0; i < position.count; i += 1) {
          worldPoint.fromBufferAttribute(position, i);
          const sample = sampleMtResistivityAtWorldPoint(
            this,
            mtMesh,
            worldPoint,
            sampleOptions,
          );
          cut.values[i] = sample.value;
          cut.alphaValues[i] = cut.alphaValues[i] * sample.alpha;
          cut.hardMaskValues[i] = cut.hardMaskValues[i] * sample.hardMask;
        }
        updateScalarSectionIsoOverlay(cut.mesh, cut.values, {
          ...baseOptions,
          targetKey,
          alphaValues: cut.alphaValues,
          hardMaskValues: cut.hardMaskValues,
        });
        if (cut.mesh.userData.scalarSectionIsoOverlayRoot) {
          annotateResistivityIsoRoot(
            cut.mesh,
            RESISTIVITY_ON_SEISMIC_VOLUME_CUT_GROUP,
          );
          overlayGroup.add(cut.mesh);
        } else {
          disposeObjectTree(cut.mesh);
        }
      }
    }

    if (overlayGroup.children.length === 0) {
      if (!options?.preserveExisting) {
        this.clearSeismicResistivityIsoOverlays(seismicLayer);
      }
      return;
    }
    this.registerSectionIsoOverlayTransitionTargetRoot?.(
      "seismic-resistivity",
      UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
      overlayGroup,
    );
    this.applyRenderOpacityToTree?.(
      overlayGroup,
      1,
      options?.initialTransitionOpacity ??
        this.currentSectionIsoOverlayTransitionOpacity?.() ??
        1,
    );
  }
