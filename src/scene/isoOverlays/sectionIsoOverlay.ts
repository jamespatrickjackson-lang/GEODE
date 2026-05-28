import * as THREE from "three";
import { SECTION_ISO_OVERLAY_POLICY } from "../../loaders/surfaceRenderPolicy";
import { disposeObjectTree } from "../disposeObjectTree";
import {
  deterministicScalarSample,
  scalarValueIsVisible,
  scalarVisibilityWeight,
} from "../scalarFocus";
import { geometryOriginalIndex, sequentialIndex } from "../styles/scalarEdgeLines";
import { scalarColorAt, seismicColorAt } from "../styles/colorScales";

type SceneSectionAxis = "x" | "y" | "z";

const SECTION_ISO_RENDER_ORDER = SECTION_ISO_OVERLAY_POLICY.renderOrder;
const SECTION_ISO_LINE_RENDER_ORDER = SECTION_ISO_RENDER_ORDER + 0.05;
const SECTION_ISO_LIFT_M = SECTION_ISO_OVERLAY_POLICY.liftM;
const SECTION_ISO_LINE_WIDTH_M_PER_PX =
  SECTION_ISO_OVERLAY_POLICY.lineWidthMPerPx;
const SECTION_ISO_MAX_RIBBON_SEGMENTS = 48_000;

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export interface ScalarSectionIsoOptions {
  layerId: string;
  enabled: boolean;
  linesVisible: boolean;
  bandsVisible: boolean;
  selectedTargetIds: Record<string, boolean>;
  targetKey?: string;
  alphaValues?: Float32Array | number[];
  colorMode?:
    | "scalar"
    | "seismic-blue-white-red"
    | "seismic-grayscale"
    | "seismic-velocity";
  amplitudeGamma?: number;
  skipSceneSectionClipping?: boolean;
  isoMin: number;
  isoMax: number;
  levelCount: number;
  lineWidth: number;
  lineStyle: "solid" | "dashed";
  bandOpacity: number;
  fillOffset: number;
  colorMin: number;
  colorMax: number;
  midpoint: number;
  contrast: number;
  lowColor: THREE.Color;
  midColor: THREE.Color;
  highColor: THREE.Color;
}

export function scalarSectionMeshId(obj: THREE.Object3D): string | null {
  const data = obj.userData ?? {};
  const candidates = [
    data.resistivitySliceId,
    data.scalarSectionId,
    data.sectionId,
    data.productId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return obj.name ? obj.name : null;
}

export function scalarSectionTargetKey(layerId: string, obj: THREE.Object3D): string {
  return `${layerId}:${scalarSectionMeshId(obj) ?? obj.uuid}`;
}

export function scalarSectionMeshLabel(obj: THREE.Object3D): string {
  const data = obj.userData ?? {};
  const slice = data.resistivitySlice as
    | { label?: unknown; id?: unknown }
    | undefined;
  if (typeof slice?.label === "string" && slice.label.trim())
    return slice.label;
  if (
    typeof data.scalarSectionLabel === "string" &&
    data.scalarSectionLabel.trim()
  ) {
    return data.scalarSectionLabel;
  }
  if (typeof data.displayName === "string" && data.displayName.trim()) {
    return data.displayName;
  }
  if (typeof slice?.id === "string" && slice.id.trim()) return slice.id;
  if (obj.name) return obj.name;
  return "Scalar section";
}

export function scalarSectionMeshKind(obj: THREE.Object3D): string {
  const data = obj.userData ?? {};
  if (typeof data.resistivitySliceKind === "string")
    return data.resistivitySliceKind;
  if (typeof data.scalarSectionKind === "string") return data.scalarSectionKind;
  return "section";
}

export function seismicSectionMeshId(obj: THREE.Object3D): string | null {
  const data = obj.userData ?? {};
  const sectionId =
    typeof data.seismicSectionId === "string" && data.seismicSectionId.trim()
      ? data.seismicSectionId
      : null;
  const axis =
    typeof data.seismicSectionAxis === "string" &&
    data.seismicSectionAxis.trim()
      ? data.seismicSectionAxis
      : null;
  if (sectionId && axis) return `${axis}-${sectionId}`;
  if (sectionId) return sectionId;
  return obj.name ? obj.name : null;
}

export function seismicSectionTargetKey(layerId: string, obj: THREE.Object3D): string {
  const data = obj.userData ?? {};
  const productId =
    typeof data.seismicProductId === "string" && data.seismicProductId.trim()
      ? data.seismicProductId
      : "seismic-product";
  return `${layerId}:${productId}:${seismicSectionMeshId(obj) ?? obj.uuid}`;
}

export function seismicSectionMeshLabel(obj: THREE.Object3D): string {
  const data = obj.userData ?? {};
  const productLabel =
    typeof data.seismicProductLabel === "string" &&
    data.seismicProductLabel.trim()
      ? data.seismicProductLabel
      : "Seismic";
  const sectionId =
    typeof data.seismicSectionId === "string" && data.seismicSectionId.trim()
      ? data.seismicSectionId
      : "";
  const axis =
    typeof data.seismicSectionAxis === "string" &&
    data.seismicSectionAxis.trim()
      ? data.seismicSectionAxis
      : "section";
  return sectionId
    ? `${productLabel} ${axis} ${sectionId}`
    : `${productLabel} ${axis}`;
}

export function seismicSectionMeshKind(obj: THREE.Object3D): string {
  const axis =
    typeof obj.userData?.seismicSectionAxis === "string"
      ? obj.userData.seismicSectionAxis
      : "section";
  return `seismic ${axis}`;
}

export function mtVolumeCutSectionId(
  productId: string,
  axis: SceneSectionAxis,
): string {
  return `${productId}-${axis}-section`;
}

export function mtVolumeCutTargetKey(
  layerId: string,
  productId: string,
  axis: SceneSectionAxis,
): string {
  return `${layerId}:${productId}:${axis}`;
}

export function seismicVolumeCutSectionId(
  productId: string,
  axis: SceneSectionAxis,
): string {
  return `${productId}-volume-${axis}-section`;
}

export function seismicVolumeCutTargetKey(
  layerId: string,
  productId: string,
  axis: SceneSectionAxis,
): string {
  return `${layerId}:${productId}:volume:${axis}`;
}

export function isScalarSectionMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  if (!(obj instanceof THREE.Mesh)) return false;
  if (obj.userData?.scalarSectionIsoOverlay === true) return false;
  const values = obj.geometry.userData.scalarValues as
    | Float32Array
    | number[]
    | undefined;
  if (!values || values.length === 0) return false;
  return (
    obj.userData?.resistivitySlicePreview === true ||
    obj.userData?.scalarSectionPreview === true ||
    obj.userData?.sectionPreview === true
  );
}

export function isSeismicSectionMesh(obj: THREE.Object3D): obj is THREE.Mesh {
  if (!(obj instanceof THREE.Mesh)) return false;
  if (obj.userData?.scalarSectionIsoOverlay === true) return false;
  if (obj.userData?.seismicSection !== true) return false;
  const values = obj.geometry.userData.seismicAmplitudeValues as
    | Float32Array
    | number[]
    | undefined;
  return !!values && values.length > 0;
}

function sectionIsoAlphaAt(
  alphaValues: Float32Array | number[] | undefined,
  index: number,
): number {
  if (!alphaValues || index < 0 || index >= alphaValues.length) return 1;
  const value = alphaValues[index];
  return Number.isFinite(value) ? clamp01(value) : 0;
}

function sectionIsoTriangleSuppressed(
  alphaValues: Float32Array | number[] | undefined,
  ia: number,
  ib: number,
  ic: number,
): boolean {
  if (!alphaValues) return false;
  return (
    sectionIsoAlphaAt(alphaValues, ia) <= 0.01 &&
    sectionIsoAlphaAt(alphaValues, ib) <= 0.01 &&
    sectionIsoAlphaAt(alphaValues, ic) <= 0.01
  );
}

export function sectionIsoAttributeValues(
  attribute:
    | THREE.BufferAttribute
    | THREE.InterleavedBufferAttribute
    | undefined,
  count: number,
): Float32Array | undefined {
  if (!attribute || attribute.itemSize < 1 || attribute.count < count)
    return undefined;
  const values = new Float32Array(count);
  for (let i = 0; i < count; i += 1) values[i] = attribute.getX(i);
  return values;
}

export function disposeScalarSectionIsoOverlay(obj: THREE.Mesh): void {
  const root = obj.userData.scalarSectionIsoOverlayRoot as
    | THREE.Object3D
    | undefined;
  if (!root) return;
  root.removeFromParent();
  disposeObjectTree(root);
  delete obj.userData.scalarSectionIsoOverlayRoot;
}

function sectionIsoLevels(min: number, max: number, count: number): number[] {
  const safeCount = Math.max(2, Math.round(count));
  const range = Math.max(0.000001, max - min);
  const levels: number[] = [];
  for (let i = 1; i <= safeCount; i += 1) {
    levels.push(min + (range * i) / (safeCount + 1));
  }
  return levels;
}

function sectionIsoColorAt(
  value: number,
  options: ScalarSectionIsoOptions,
  target: THREE.Color,
): THREE.Color {
  const colorMode = options.colorMode ?? "scalar";
  if (colorMode === "seismic-blue-white-red") {
    seismicColorAt(
      value,
      options.colorMin,
      options.colorMax,
      "blue-white-red",
      options.amplitudeGamma ?? 1,
      target,
    );
  } else if (colorMode === "seismic-grayscale") {
    seismicColorAt(
      value,
      options.colorMin,
      options.colorMax,
      "grayscale",
      options.amplitudeGamma ?? 1,
      target,
    );
  } else if (colorMode === "seismic-velocity") {
    seismicColorAt(
      value,
      options.colorMin,
      options.colorMax,
      "velocity",
      options.amplitudeGamma ?? 1,
      target,
    );
  } else {
    scalarColorAt(
      value,
      options.colorMin,
      options.colorMax,
      options.midpoint,
      options.contrast,
      options.lowColor,
      options.midColor,
      options.highColor,
      target,
    );
  }
  const fillOffset = clampRange(options.fillOffset, -1, 1);
  if (Math.abs(fillOffset) > 0.0001) {
    target.lerp(
      fillOffset < 0 ? new THREE.Color(1, 1, 1) : new THREE.Color(0, 0, 0),
      Math.abs(fillOffset),
    );
  }
  return target;
}

function addUniqueIsoPoint(
  points: THREE.Vector3[],
  point: THREE.Vector3,
): void {
  for (const existing of points) {
    if (existing.distanceToSquared(point) < 0.01) return;
  }
  points.push(point);
}

function sectionIsoTriangleIntersections(
  position: THREE.BufferAttribute,
  values: Float32Array | number[],
  ia: number,
  ib: number,
  ic: number,
  level: number,
  target: THREE.Vector3[],
): void {
  target.length = 0;
  const addEdge = (a: number, b: number) => {
    const va = values[a];
    const vb = values[b];
    if (!Number.isFinite(va) || !Number.isFinite(vb)) return;
    const da = va - level;
    const db = vb - level;
    if (Math.abs(da) < 0.000001 && Math.abs(db) < 0.000001) return;
    if ((da < 0 && db < 0) || (da > 0 && db > 0)) return;
    const denom = vb - va;
    if (Math.abs(denom) < 0.000001) return;
    const t = clampRange((level - va) / denom, 0, 1);
    addUniqueIsoPoint(
      target,
      new THREE.Vector3(
        position.getX(a) + (position.getX(b) - position.getX(a)) * t,
        position.getY(a) + (position.getY(b) - position.getY(a)) * t,
        position.getZ(a) + (position.getZ(b) - position.getZ(a)) * t,
      ),
    );
  };
  addEdge(ia, ib);
  addEdge(ib, ic);
  addEdge(ic, ia);
}

function farthestIsoPair(
  points: THREE.Vector3[],
): [THREE.Vector3, THREE.Vector3] | null {
  if (points.length < 2) return null;
  let bestA = points[0];
  let bestB = points[1];
  let bestDistance = bestA.distanceToSquared(bestB);
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = points[i].distanceToSquared(points[j]);
      if (distance > bestDistance) {
        bestDistance = distance;
        bestA = points[i];
        bestB = points[j];
      }
    }
  }
  return bestDistance > 1 ? [bestA, bestB] : null;
}

type SectionIsoContourSegment = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  normal: THREE.Vector3;
  level: number;
};

type SectionIsoContourNode = {
  key: string;
  point: THREE.Vector3;
  count: number;
  segmentIds: number[];
};

type SectionIsoPolyline = {
  points: THREE.Vector3[];
  normal: THREE.Vector3;
  level: number;
};

function sectionIsoSnapTolerance(
  position: THREE.BufferAttribute,
): number {
  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    point.set(position.getX(i), position.getY(i), position.getZ(i));
    bounds.expandByPoint(point);
  }
  if (bounds.isEmpty()) return 1;
  const diagonal = bounds.getSize(new THREE.Vector3()).length();
  return clampRange(diagonal * 0.00001, 1, 90);
}

function sectionIsoPointKey(point: THREE.Vector3, toleranceM: number): string {
  return [
    Math.round(point.x / toleranceM),
    Math.round(point.y / toleranceM),
    Math.round(point.z / toleranceM),
  ].join(":");
}

function sectionIsoPolylineLength(points: THREE.Vector3[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i += 1) {
    length += points[i - 1].distanceTo(points[i]);
  }
  return length;
}

function sectionIsoPointLineDistance(
  point: THREE.Vector3,
  start: THREE.Vector3,
  end: THREE.Vector3,
): number {
  const segment = end.clone().sub(start);
  const lengthSq = segment.lengthSq();
  if (lengthSq <= 0.000001) return point.distanceTo(start);
  const t = clampRange(point.clone().sub(start).dot(segment) / lengthSq, 0, 1);
  return point.distanceTo(start.clone().addScaledVector(segment, t));
}

function simplifySectionIsoPolyline(
  points: THREE.Vector3[],
  toleranceM: number,
): THREE.Vector3[] {
  if (points.length <= 2) return points.map((point) => point.clone());
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop()!;
    let bestIndex = -1;
    let bestDistance = 0;
    for (let i = startIndex + 1; i < endIndex; i += 1) {
      const distance = sectionIsoPointLineDistance(
        points[i],
        points[startIndex],
        points[endIndex],
      );
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0 && bestDistance > toleranceM) {
      keep[bestIndex] = 1;
      stack.push([startIndex, bestIndex], [bestIndex, endIndex]);
    }
  }
  return points.filter((_, index) => keep[index] === 1).map((point) => point.clone());
}

function stitchSectionIsoSegments(
  segments: SectionIsoContourSegment[],
  toleranceM: number,
  minPolylineLengthM: number,
): SectionIsoPolyline[] {
  type SegmentRecord = SectionIsoContourSegment & {
    aKey: string;
    bKey: string;
  };
  const nodes = new Map<string, SectionIsoContourNode>();
  const nodeFor = (point: THREE.Vector3): SectionIsoContourNode => {
    const key = sectionIsoPointKey(point, toleranceM);
    let node = nodes.get(key);
    if (!node) {
      node = {
        key,
        point: point.clone(),
        count: 1,
        segmentIds: [],
      };
      nodes.set(key, node);
      return node;
    }
    node.point
      .multiplyScalar(node.count)
      .add(point)
      .multiplyScalar(1 / (node.count + 1));
    node.count += 1;
    return node;
  };
  const records: SegmentRecord[] = segments.map((segment, segmentId) => {
    const aNode = nodeFor(segment.a);
    const bNode = nodeFor(segment.b);
    aNode.segmentIds.push(segmentId);
    bNode.segmentIds.push(segmentId);
    return {
      ...segment,
      aKey: aNode.key,
      bKey: bNode.key,
    };
  });
  const visited = new Uint8Array(records.length);
  const nextUnvisitedSegment = (nodeKey: string): number => {
    const node = nodes.get(nodeKey);
    if (!node) return -1;
    for (const segmentId of node.segmentIds) {
      if (visited[segmentId] === 0) return segmentId;
    }
    return -1;
  };
  const extendPolyline = (
    points: THREE.Vector3[],
    usedSegmentIds: number[],
    startKey: string,
    append: boolean,
  ): void => {
    let currentKey = startKey;
    while (true) {
      const nextId = nextUnvisitedSegment(currentKey);
      if (nextId < 0) return;
      visited[nextId] = 1;
      usedSegmentIds.push(nextId);
      const record = records[nextId];
      const nextKey = record.aKey === currentKey ? record.bKey : record.aKey;
      const nextNode = nodes.get(nextKey);
      if (!nextNode) return;
      if (append) points.push(nextNode.point.clone());
      else points.unshift(nextNode.point.clone());
      currentKey = nextKey;
      if (points.length > records.length + 2) return;
    }
  };

  const polylines: SectionIsoPolyline[] = [];
  for (let segmentId = 0; segmentId < records.length; segmentId += 1) {
    if (visited[segmentId] !== 0) continue;
    const record = records[segmentId];
    const aNode = nodes.get(record.aKey);
    const bNode = nodes.get(record.bKey);
    if (!aNode || !bNode) continue;
    visited[segmentId] = 1;
    const points = [aNode.point.clone(), bNode.point.clone()];
    const usedSegmentIds = [segmentId];
    extendPolyline(points, usedSegmentIds, record.bKey, true);
    extendPolyline(points, usedSegmentIds, record.aKey, false);
    if (points.length < 2 || sectionIsoPolylineLength(points) < minPolylineLengthM) {
      continue;
    }
    const normal = new THREE.Vector3();
    for (const usedId of usedSegmentIds) normal.add(records[usedId].normal);
    normal.normalize();
    if (normal.lengthSq() < 0.000001) normal.copy(record.normal);
    polylines.push({
      points,
      normal,
      level: record.level,
    });
  }
  return polylines;
}

function appendSectionIsoRibbonSegment(
  positions: number[],
  colors: number[],
  indices: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  normal: THREE.Vector3,
  color: THREE.Color,
  halfWidthM: number,
): boolean {
  if (positions.length / 12 >= SECTION_ISO_MAX_RIBBON_SEGMENTS) return false;
  const direction = b.clone().sub(a);
  const length = direction.length();
  if (length < 1) return false;
  direction.multiplyScalar(1 / length);
  const side = direction.clone().cross(normal).normalize();
  if (side.lengthSq() < 0.000001) return false;
  side.multiplyScalar(halfWidthM);
  const lift = normal.clone().multiplyScalar(SECTION_ISO_LIFT_M);
  const p0 = a.clone().add(lift).add(side);
  const p1 = a.clone().add(lift).sub(side);
  const p2 = b.clone().add(lift).add(side);
  const p3 = b.clone().add(lift).sub(side);
  const base = positions.length / 3;
  positions.push(
    p0.x,
    p0.y,
    p0.z,
    p1.x,
    p1.y,
    p1.z,
    p2.x,
    p2.y,
    p2.z,
    p3.x,
    p3.y,
    p3.z,
  );
  for (let i = 0; i < 4; i += 1) {
    colors.push(color.r, color.g, color.b);
  }
  indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  return true;
}

function appendSectionIsoPolylineRibbon(
  positions: number[],
  colors: number[],
  indices: number[],
  points: THREE.Vector3[],
  normal: THREE.Vector3,
  color: THREE.Color,
  halfWidthM: number,
  dashed: boolean,
): void {
  if (points.length < 2) return;
  if (!dashed) {
    for (let i = 1; i < points.length; i += 1) {
      appendSectionIsoRibbonSegment(
        positions,
        colors,
        indices,
        points[i - 1],
        points[i],
        normal,
        color,
        halfWidthM,
      );
      if (positions.length / 12 >= SECTION_ISO_MAX_RIBBON_SEGMENTS) return;
    }
    return;
  }
  const dashLength = Math.max(halfWidthM * 8, 220);
  const gapLength = Math.max(halfWidthM * 4, 140);
  const cycle = dashLength + gapLength;
  let traveled = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const length = a.distanceTo(b);
    if (length < 1) continue;
    const direction = b.clone().sub(a).multiplyScalar(1 / length);
    let offset = 0;
    while (offset < length) {
      const cyclePosition = traveled % cycle;
      const inDash = cyclePosition < dashLength;
      const boundary = inDash ? dashLength : cycle;
      const step = Math.min(length - offset, boundary - cyclePosition);
      if (step <= 0.0001) break;
      if (inDash) {
        appendSectionIsoRibbonSegment(
          positions,
          colors,
          indices,
          a.clone().addScaledVector(direction, offset),
          a.clone().addScaledVector(direction, offset + step),
          normal,
          color,
          halfWidthM,
        );
        if (positions.length / 12 >= SECTION_ISO_MAX_RIBBON_SEGMENTS) return;
      }
      offset += step;
      traveled += step;
    }
  }
}

function buildSectionIsoLineGeometry(
  obj: THREE.Mesh,
  values: Float32Array | number[],
  options: ScalarSectionIsoOptions,
): THREE.BufferGeometry | null {
  const position = obj.geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) return null;
  const index = obj.geometry.getIndex();
  const sourceIndex = index
    ? Array.from({ length: index.count }, (_, i) => index.getX(i))
    : Array.from({ length: position.count }, (_, i) => i);
  const triangleLimit = sourceIndex.length - (sourceIndex.length % 3);
  if (triangleLimit <= 0) return null;
  const levels = sectionIsoLevels(
    options.isoMin,
    options.isoMax,
    options.levelCount,
  );
  const halfWidthM = Math.max(
    6,
    options.lineWidth * SECTION_ISO_LINE_WIDTH_M_PER_PX * 0.5,
  );
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const segmentsByLevel = new Map<number, SectionIsoContourSegment[]>();
  const intersections: THREE.Vector3[] = [];
  const triangleA = new THREE.Vector3();
  const triangleB = new THREE.Vector3();
  const triangleC = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const color = new THREE.Color();
  const dashed = options.lineStyle === "dashed";
  const snapToleranceM = sectionIsoSnapTolerance(position);
  const minSegmentLengthM = Math.max(1, snapToleranceM * 1.25);
  const minPolylineLengthM = Math.max(halfWidthM * 0.5, snapToleranceM * 2);
  const simplifyToleranceM = Math.max(snapToleranceM * 0.65, halfWidthM * 0.12);
  let sourceSegmentCount = 0;
  let tinySegmentCount = 0;

  for (let i = 0; i < triangleLimit; i += 3) {
    const ia = sourceIndex[i];
    const ib = sourceIndex[i + 1];
    const ic = sourceIndex[i + 2];
    if (sectionIsoTriangleSuppressed(options.alphaValues, ia, ib, ic)) continue;
    const va = values[ia];
    const vb = values[ib];
    const vc = values[ic];
    if (!Number.isFinite(va) || !Number.isFinite(vb) || !Number.isFinite(vc)) {
      continue;
    }
    const minValue = Math.min(va, vb, vc);
    const maxValue = Math.max(va, vb, vc);
    triangleA.set(position.getX(ia), position.getY(ia), position.getZ(ia));
    triangleB.set(position.getX(ib), position.getY(ib), position.getZ(ib));
    triangleC.set(position.getX(ic), position.getY(ic), position.getZ(ic));
    normal
      .copy(triangleB)
      .sub(triangleA)
      .cross(triangleC.clone().sub(triangleA))
      .normalize();
    if (normal.lengthSq() < 0.000001) continue;

    for (const level of levels) {
      if (level < minValue || level > maxValue) continue;
      sectionIsoTriangleIntersections(
        position,
        values,
        ia,
        ib,
        ic,
        level,
        intersections,
      );
      const pair = farthestIsoPair(intersections);
      if (!pair) continue;
      const segmentLength = pair[0].distanceTo(pair[1]);
      if (segmentLength < minSegmentLengthM) {
        tinySegmentCount += 1;
        continue;
      }
      sourceSegmentCount += 1;
      let segments = segmentsByLevel.get(level);
      if (!segments) {
        segments = [];
        segmentsByLevel.set(level, segments);
      }
      segments.push({
        a: pair[0].clone(),
        b: pair[1].clone(),
        normal: normal.clone(),
        level,
      });
    }
  }

  let polylineCount = 0;
  let simplifiedPointCount = 0;
  polylineLoop: for (const [level, segments] of segmentsByLevel) {
    const polylines = stitchSectionIsoSegments(
      segments,
      snapToleranceM,
      minPolylineLengthM,
    );
    for (const polyline of polylines) {
      const simplified = simplifySectionIsoPolyline(
        polyline.points,
        simplifyToleranceM,
      );
      if (
        simplified.length < 2 ||
        sectionIsoPolylineLength(simplified) < minPolylineLengthM
      ) {
        continue;
      }
      sectionIsoColorAt(level, options, color);
      polylineCount += 1;
      simplifiedPointCount += simplified.length;
      appendSectionIsoPolylineRibbon(
        positions,
        colors,
        indices,
        simplified,
        polyline.normal,
        color,
        halfWidthM,
        dashed,
      );
      if (positions.length / 12 >= SECTION_ISO_MAX_RIBBON_SEGMENTS) {
        break polylineLoop;
      }
    }
  }

  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.userData.sectionIsoRenderPolicy = SECTION_ISO_OVERLAY_POLICY.name;
  geometry.userData.sectionIsoSourceSegmentCount = sourceSegmentCount;
  geometry.userData.sectionIsoTinySegmentCount = tinySegmentCount;
  geometry.userData.sectionIsoPolylineCount = polylineCount;
  geometry.userData.sectionIsoSimplifiedPointCount = simplifiedPointCount;
  geometry.userData.sectionIsoRibbonSegmentCount = positions.length / 12;
  geometry.userData.sectionIsoSnapToleranceM = snapToleranceM;
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSectionIsoBandMaterial(
  options: ScalarSectionIsoOptions,
): THREE.ShaderMaterial {
  const fillOffset = clampRange(options.fillOffset, -1, 1);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: SECTION_ISO_OVERLAY_POLICY.material.bandDepthTest,
    depthWrite: SECTION_ISO_OVERLAY_POLICY.material.depthWrite,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor:
      SECTION_ISO_OVERLAY_POLICY.material.polygonOffsetFactor,
    polygonOffsetUnits:
      SECTION_ISO_OVERLAY_POLICY.material.polygonOffsetUnits,
    uniforms: {
      uIsoMin: { value: options.isoMin },
      uIsoMax: { value: options.isoMax },
      uLevelCount: { value: options.levelCount },
      uOpacity: { value: clampRange(options.bandOpacity, 0, 0.85) },
      uFillOffset: { value: fillOffset },
      uColorMin: { value: options.colorMin },
      uColorMax: { value: options.colorMax },
      uMidpoint: { value: options.midpoint },
      uContrast: { value: options.contrast },
      uColorMode: {
        value:
          options.colorMode === "seismic-grayscale"
            ? 2
            : options.colorMode === "seismic-velocity"
              ? 3
              : options.colorMode === "seismic-blue-white-red"
                ? 1
                : 0,
      },
      uAmplitudeGamma: {
        value: clampRange(options.amplitudeGamma ?? 1, 0.35, 2.5),
      },
      uLiftM: { value: SECTION_ISO_LIFT_M * 0.55 },
      uLowColor: { value: options.lowColor.clone() },
      uMidColor: { value: options.midColor.clone() },
      uHighColor: { value: options.highColor.clone() },
    },
    vertexShader: `
      #include <logdepthbuf_pars_vertex>
      attribute float sectionIsoScalar;
      attribute float sectionIsoAlpha;
      uniform float uLiftM;
      varying float vSectionIsoScalar;
      varying float vSectionIsoAlpha;
      void main() {
        vSectionIsoScalar = sectionIsoScalar;
        vSectionIsoAlpha = sectionIsoAlpha;
        vec3 lifted = position + normal * uLiftM;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(lifted, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      varying float vSectionIsoScalar;
      varying float vSectionIsoAlpha;
      uniform float uIsoMin;
      uniform float uIsoMax;
      uniform float uLevelCount;
      uniform float uOpacity;
      uniform float uFillOffset;
      uniform float uColorMin;
      uniform float uColorMax;
      uniform float uMidpoint;
      uniform float uContrast;
      uniform int uColorMode;
      uniform float uAmplitudeGamma;
      uniform vec3 uLowColor;
      uniform vec3 uMidColor;
      uniform vec3 uHighColor;

      float saturate(float value) {
        return clamp(value, 0.0, 1.0);
      }

      vec3 seismicRampColor(float value) {
        float range = max(0.000001, uColorMax - uColorMin);
        float rawT = saturate((value - uColorMin) / range);
        float signedT = (rawT - 0.5) * 2.0;
        float gamma = clamp(uAmplitudeGamma, 0.35, 2.5);
        float t = abs(signedT) < 0.000001
          ? 0.5
          : saturate(0.5 + sign(signedT) * pow(abs(signedT), gamma) * 0.5);
        if (uColorMode == 2) {
          return vec3(t);
        }
        if (uColorMode == 3) {
          if (t < 0.33) {
            return mix(vec3(0.090, 0.231, 0.604), vec3(0.200, 0.714, 0.843), t / 0.33);
          }
          if (t < 0.66) {
            return mix(vec3(0.200, 0.714, 0.843), vec3(0.957, 0.875, 0.388), (t - 0.33) / 0.33);
          }
          return mix(vec3(0.957, 0.875, 0.388), vec3(0.827, 0.294, 0.176), (t - 0.66) / 0.34);
        }
        if (t < 0.5) {
          return mix(vec3(0.141, 0.337, 0.788), vec3(0.957, 0.969, 1.0), t / 0.5);
        }
        return mix(vec3(0.957, 0.969, 1.0), vec3(0.851, 0.212, 0.184), (t - 0.5) / 0.5);
      }

      vec3 rampColor(float value) {
        if (uColorMode != 0) {
          return seismicRampColor(value);
        }
        float range = max(0.000001, uColorMax - uColorMin);
        float t = saturate((value - uColorMin) / range);
        float shaped = saturate((t - 0.5) * uContrast + 0.5);
        float mid = clamp(uMidpoint, 0.05, 0.95);
        if (shaped < mid) {
          return mix(uLowColor, uMidColor, saturate(shaped / max(0.000001, mid)));
        }
        return mix(
          uMidColor,
          uHighColor,
          saturate((shaped - mid) / max(0.000001, 1.0 - mid))
        );
      }

      void main() {
        if (vSectionIsoAlpha <= 0.01) discard;
        if (vSectionIsoScalar < uIsoMin || vSectionIsoScalar > uIsoMax) discard;
        float range = max(0.000001, uIsoMax - uIsoMin);
        float count = max(2.0, floor(uLevelCount + 0.5));
        float band = floor(saturate((vSectionIsoScalar - uIsoMin) / range) * count);
        float value = uIsoMin + ((band + 0.5) / count) * range;
        vec3 color = rampColor(value);
        if (abs(uFillOffset) > 0.0001) {
          color = mix(color, uFillOffset < 0.0 ? vec3(1.0) : vec3(0.0), abs(uFillOffset));
        }
        #include <logdepthbuf_fragment>
        gl_FragColor = vec4(color, uOpacity * saturate(vSectionIsoAlpha));
      }
    `,
  });
  material.userData.ignoreLayerStyle = true;
  material.userData.scalarSectionIsoOverlay = true;
  material.userData.surfaceRenderPolicy = SECTION_ISO_OVERLAY_POLICY.name;
  return material;
}

function buildSectionIsoBandMesh(
  obj: THREE.Mesh,
  values: Float32Array | number[],
  options: ScalarSectionIsoOptions,
): THREE.Mesh | null {
  const position = obj.geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) return null;
  const geometry = obj.geometry.clone();
  const scalarValues =
    values instanceof Float32Array
      ? new Float32Array(values)
      : Float32Array.from(values);
  if (scalarValues.length !== position.count) return null;
  const alphaValues =
    options.alphaValues && options.alphaValues.length === position.count
      ? options.alphaValues instanceof Float32Array
        ? new Float32Array(options.alphaValues)
        : Float32Array.from(options.alphaValues)
      : new Float32Array(position.count).fill(1);
  geometry.setAttribute(
    "sectionIsoScalar",
    new THREE.Float32BufferAttribute(scalarValues, 1),
  );
  geometry.setAttribute(
    "sectionIsoAlpha",
    new THREE.Float32BufferAttribute(alphaValues, 1),
  );
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, makeSectionIsoBandMaterial(options));
  mesh.name = "scalar-section-iso-band-overlay";
  mesh.renderOrder = SECTION_ISO_RENDER_ORDER;
  mesh.userData.ignoreLayerStyle = true;
  mesh.userData.scalarSectionIsoOverlay = true;
  mesh.userData.surfaceRenderPolicy = SECTION_ISO_OVERLAY_POLICY.name;
  if (options.skipSceneSectionClipping) {
    mesh.userData.sceneSectionHelper = true;
    if (mesh.material instanceof THREE.Material) {
      mesh.material.userData.sceneSectionHelper = true;
    }
  }
  return mesh;
}

export function updateScalarSectionIsoOverlay(
  obj: THREE.Mesh,
  values: Float32Array | number[],
  options: ScalarSectionIsoOptions,
): void {
  const targetKey =
    options.targetKey ?? scalarSectionTargetKey(options.layerId, obj);
  const targetSelected = options.selectedTargetIds[targetKey] !== false;
  const enabled =
    options.enabled &&
    targetSelected &&
    options.isoMax > options.isoMin &&
    (options.linesVisible || options.bandsVisible);
  if (!enabled) {
    disposeScalarSectionIsoOverlay(obj);
    return;
  }

  disposeScalarSectionIsoOverlay(obj);
  const root = new THREE.Group();
  root.name = "scalar-section-iso-overlay";
  root.userData.ignoreLayerStyle = true;
  root.userData.scalarSectionIsoOverlay = true;
  root.userData.sectionIsoTargetKey = targetKey;
  if (options.skipSceneSectionClipping) {
    root.userData.sceneSectionHelper = true;
  }
  root.renderOrder = SECTION_ISO_RENDER_ORDER;

  if (options.bandsVisible && options.bandOpacity > 0.001) {
    const band = buildSectionIsoBandMesh(obj, values, options);
    if (band) root.add(band);
  }

  if (options.linesVisible && options.lineWidth > 0.01) {
    const lineGeometry = buildSectionIsoLineGeometry(obj, values, options);
    if (lineGeometry) {
      const lineMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.96,
        vertexColors: true,
        depthTest: SECTION_ISO_OVERLAY_POLICY.material.lineDepthTest,
        depthWrite: SECTION_ISO_OVERLAY_POLICY.material.depthWrite,
        toneMapped: false,
        fog: false,
        side: THREE.DoubleSide,
      });
      lineMaterial.userData.ignoreLayerStyle = true;
      lineMaterial.userData.scalarSectionIsoOverlay = true;
      lineMaterial.userData.surfaceRenderPolicy =
        SECTION_ISO_OVERLAY_POLICY.name;
      const line = new THREE.Mesh(lineGeometry, lineMaterial);
      line.name = "scalar-section-iso-line-overlay";
      line.renderOrder = SECTION_ISO_LINE_RENDER_ORDER;
      line.userData.ignoreLayerStyle = true;
      line.userData.scalarSectionIsoOverlay = true;
      line.userData.surfaceRenderPolicy = SECTION_ISO_OVERLAY_POLICY.name;
      if (options.skipSceneSectionClipping) {
        line.userData.sceneSectionHelper = true;
        lineMaterial.userData.sceneSectionHelper = true;
      }
      root.add(line);
    }
  }

  if (root.children.length === 0) {
    disposeObjectTree(root);
    return;
  }
  obj.userData.scalarSectionIsoOverlayRoot = root;
  obj.add(root);
}

export function applyScalarFocusIndex(
  obj: THREE.Mesh | THREE.Points,
  values: Float32Array | number[],
  trimMin: number,
  blendMin: number,
  blendMax: number,
  trimMax: number,
  filterActive: boolean,
  supportValues: Float32Array | null = null,
  noiseThreshold = 0,
): void {
  const geometry = obj.geometry;
  const position = geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute)) return;

  const originalIndex = geometryOriginalIndex(geometry);
  if (!filterActive) {
    geometry.setIndex(
      originalIndex
        ? new THREE.BufferAttribute(originalIndex.slice(), 1)
        : null,
    );
    geometry.userData.scalarFocusVisibleCount = position.count;
    return;
  }

  if (obj instanceof THREE.Points) {
    const scratch = new Uint32Array(position.count);
    let count = 0;
    for (let i = 0; i < position.count; i += 1) {
      if (
        scalarValueIsVisible(values, i, trimMin, blendMin, blendMax, trimMax) &&
        (!supportValues || supportValues[i] >= noiseThreshold)
      ) {
        scratch[count] = i;
        count += 1;
      }
    }
    geometry.setIndex(new THREE.BufferAttribute(scratch.slice(0, count), 1));
    geometry.userData.scalarFocusVisibleCount = count;
    return;
  }

  const sourceIndex = originalIndex ?? sequentialIndex(position.count);
  const scratch = new Uint32Array(sourceIndex.length);
  let count = 0;
  const triangleLimit = sourceIndex.length - (sourceIndex.length % 3);
  for (let i = 0; i < triangleLimit; i += 3) {
    const a = sourceIndex[i];
    const b = sourceIndex[i + 1];
    const c = sourceIndex[i + 2];
    const weight =
      (scalarVisibilityWeight(values, a, trimMin, blendMin, blendMax, trimMax) +
        scalarVisibilityWeight(
          values,
          b,
          trimMin,
          blendMin,
          blendMax,
          trimMax,
        ) +
        scalarVisibilityWeight(
          values,
          c,
          trimMin,
          blendMin,
          blendMax,
          trimMax,
        )) /
      3;
    if (
      weight >= 1 ||
      (weight > 0 && deterministicScalarSample(i / 3) <= weight)
    ) {
      scratch[count] = a;
      scratch[count + 1] = b;
      scratch[count + 2] = c;
      count += 3;
    }
  }
  geometry.setIndex(new THREE.BufferAttribute(scratch.slice(0, count), 1));
  geometry.userData.scalarFocusVisibleCount = count / 3;
}
