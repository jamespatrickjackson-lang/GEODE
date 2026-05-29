import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { EditableStyle } from "../pages/types";
import {
  setTopoGraticuleEdgeFade,
  setTopoPerspectiveLineWidth,
} from "../loaders/topoLineMaterial";
import {
  topoEdgeFadeInsideDistance,
  topoEdgeFadePreferenceScore,
} from "./edgeFade";
import type { PublicSurfaceClipBox } from "./publicSurfaceClipRuntime";
import type { TerrainEdgeFadeState } from "./surfaceRuntime";
import {
  TOPO_GRATICULE_MINOR_SCALE,
  clamp01,
  clampRange,
  styleNumber,
} from "./runtimeUtils";

interface TopoGraticuleLabelCandidate {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
}

interface TopoGraticuleIndexedCrossing {
  crossing: TopoGraticuleLabelCandidate;
  segmentIndex: number;
}

interface TopoGraticuleSourceLine {
  kind: "lat" | "lon";
  value: number;
  preference: "west" | "north";
  candidates: TopoGraticuleLabelCandidate[];
}

interface TopoGraticuleLabelTarget {
  position: THREE.Vector3;
  anchor: THREE.Vector3;
  tangent: THREE.Vector3;
  outward: THREE.Vector3;
  insideDistance: number;
  minor: boolean;
}

const TOPO_GRATICULE_EDGE_LEADER_MIN_M = 1_000;
const TOPO_GRATICULE_EDGE_LEADER_MAX_M = 120_000;
const TOPO_GRATICULE_EDGE_CLIP_SUBDIVISIONS = 6;
const TOPO_GRATICULE_EDGE_CROSSING_WINDOW = 2;

export interface ApplyTopoGraticuleStyleParams {
  group: THREE.Group;
  style: EditableStyle;
  clipBox: PublicSurfaceClipBox;
  clipPlanes: THREE.Plane[];
  terrainEdge: TerrainEdgeFadeState | null;
}

function terrainEdgeInsideDistance(
  point: THREE.Vector3,
  edge: TerrainEdgeFadeState,
): number {
  return topoEdgeFadeInsideDistance(point, {
    ...edge,
    min: edge.boundsMin,
    max: edge.boundsMax,
  });
}

function terrainEdgePreferenceScore(
  point: THREE.Vector3,
  edge: TerrainEdgeFadeState,
  preference: "west" | "north",
): number {
  return topoEdgeFadePreferenceScore(
    point,
    { ...edge, min: edge.boundsMin, max: edge.boundsMax },
    preference,
  );
}

function coerceVector3(value: unknown): THREE.Vector3 | null {
  if (value instanceof THREE.Vector3) return value.clone();
  const vector = value as { x?: unknown; y?: unknown; z?: unknown } | null;
  if (
    vector &&
    typeof vector.x === "number" &&
    typeof vector.y === "number" &&
    typeof vector.z === "number" &&
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  ) {
    return new THREE.Vector3(vector.x, vector.y, vector.z);
  }
  return null;
}

function topoGraticuleLabelCandidate(
  value: unknown,
): TopoGraticuleLabelCandidate | null {
  const position = coerceVector3(value);
  if (position) {
    return {
      position,
      tangent: new THREE.Vector3(1, 0, 0),
    };
  }
  const record = value as
    | { position?: unknown; tangent?: unknown }
    | null
    | undefined;
  const candidatePosition = coerceVector3(record?.position);
  if (!candidatePosition) return null;
  const tangent = coerceVector3(record?.tangent) ?? new THREE.Vector3(1, 0, 0);
  tangent.z = 0;
  if (tangent.lengthSq() <= 0.000001) tangent.set(1, 0, 0);
  else tangent.normalize();
  return {
    position: candidatePosition,
    tangent,
  };
}

function topoGraticuleSourceLine(value: unknown): TopoGraticuleSourceLine | null {
  const record = value as
    | {
        kind?: unknown;
        value?: unknown;
        preference?: unknown;
        candidates?: unknown;
      }
    | null
    | undefined;
  if (!record) return null;
  const kind = record.kind === "lat" ? "lat" : record.kind === "lon" ? "lon" : null;
  const valueNumber =
    typeof record.value === "number" && Number.isFinite(record.value)
      ? record.value
      : NaN;
  const preference =
    record.preference === "north"
      ? "north"
      : record.preference === "west"
        ? "west"
        : null;
  if (!kind || !preference || !Array.isArray(record.candidates)) return null;
  const candidates = record.candidates
    .map((candidate) => topoGraticuleLabelCandidate(candidate))
    .filter((candidate): candidate is TopoGraticuleLabelCandidate =>
      Boolean(candidate),
    );
  if (candidates.length < 2) return null;
  return { kind, value: valueNumber, preference, candidates };
}

function normalizeFullGroundTextAngle(angle: number): number {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
}

function topoGraticuleLineKey(
  kind: "lat" | "lon",
  value: number,
  preference: "west" | "north",
): string {
  const valueKey = Number.isFinite(value) ? value.toFixed(6) : "unknown";
  return `${kind}:${valueKey}:${preference}`;
}

function topoGraticuleLabelKey(obj: THREE.Object3D): string | null {
  const kind =
    obj.userData?.topoGraticuleLineKind === "lat"
      ? "lat"
      : obj.userData?.topoGraticuleLineKind === "lon"
        ? "lon"
        : null;
  const value = obj.userData?.topoGraticuleLineValue;
  const preference =
    obj.userData?.topoGraticuleLabelPreference === "north"
      ? "north"
      : obj.userData?.topoGraticuleLabelPreference === "west"
        ? "west"
        : null;
  if (!kind || !preference || typeof value !== "number") return null;
  return topoGraticuleLineKey(kind, value, preference);
}

function topoGraticuleIsHalfDegree(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const doubled = Math.abs(value) * 2;
  const rounded = Math.round(doubled);
  return Math.abs(doubled - rounded) < 0.0001 && rounded % 2 === 1;
}

function terrainEdgeStraightSideEligible(
  point: THREE.Vector3,
  edge: TerrainEdgeFadeState,
  preference: "west" | "north",
): boolean {
  if (edge.shape !== "rounded-square") return true;
  const centerX = (edge.boundsMin.x + edge.boundsMax.x) * 0.5;
  const centerY = (edge.boundsMin.y + edge.boundsMax.y) * 0.5;
  const halfX = Math.max(
    1,
    (edge.boundsMax.x - edge.boundsMin.x) * 0.5 - edge.insetM,
  );
  const halfY = Math.max(
    1,
    (edge.boundsMax.y - edge.boundsMin.y) * 0.5 - edge.insetM,
  );
  const radius = clampRange(
    edge.cornerRadiusM,
    0,
    Math.max(0, Math.min(halfX, halfY) - 1),
  );
  if (radius <= 0) return true;
  const localX = point.x - centerX;
  const localY = point.y - centerY;
  const tolerance = Math.max(2000, Math.min(edge.fadeDistanceM * 0.25, radius * 0.2));
  if (preference === "north") {
    return localY >= 0 && Math.abs(localX) <= halfX - radius + tolerance;
  }
  return localX <= 0 && Math.abs(localY) <= halfY - radius + tolerance;
}

function topoGraticuleReadableTangent(
  direction: THREE.Vector3,
  preference: "west" | "north",
): THREE.Vector3 {
  const readable = direction.clone();
  readable.z = 0;
  if (readable.lengthSq() <= 0.000001) {
    readable.set(preference === "north" ? 0 : 1, preference === "north" ? 1 : 0, 0);
  } else {
    readable.normalize();
  }
  if (preference === "north" && readable.y < 0) readable.multiplyScalar(-1);
  if (preference === "west" && readable.x < 0) readable.multiplyScalar(-1);
  return readable;
}

function topoGraticuleEdgeTextBasis(preference: "west" | "north"): {
  tangent: THREE.Vector3;
  outward: THREE.Vector3;
} {
  return preference === "north"
    ? {
        tangent: new THREE.Vector3(0, 1, 0),
        outward: new THREE.Vector3(0, 1, 0),
      }
    : {
        tangent: new THREE.Vector3(1, 0, 0),
        outward: new THREE.Vector3(-1, 0, 0),
      };
}

function topoGraticuleReadableAngle(
  direction: THREE.Vector3,
  preference: "west" | "north",
): number {
  const tangent = topoGraticuleReadableTangent(direction, preference);
  return normalizeFullGroundTextAngle(Math.atan2(tangent.y, tangent.x));
}

function edgeOutwardLineTangent(
  candidate: TopoGraticuleLabelCandidate,
  edge: TerrainEdgeFadeState,
): THREE.Vector3 {
  const step = 1000;
  const plus = candidate.position
    .clone()
    .addScaledVector(candidate.tangent, step);
  const minus = candidate.position
    .clone()
    .addScaledVector(candidate.tangent, -step);
  const plusInside = terrainEdgeInsideDistance(plus, edge);
  const minusInside = terrainEdgeInsideDistance(minus, edge);
  const direction = candidate.tangent.clone();
  if (plusInside > minusInside) direction.multiplyScalar(-1);
  direction.z = 0;
  if (direction.lengthSq() <= 0.000001) direction.set(1, 0, 0);
  else direction.normalize();
  return direction;
}

export function topoGraticuleThresholdCrossing(
  a: TopoGraticuleLabelCandidate,
  b: TopoGraticuleLabelCandidate,
  edge: TerrainEdgeFadeState,
  threshold: number,
): TopoGraticuleLabelCandidate | null {
  const aValue = terrainEdgeInsideDistance(a.position, edge) - threshold;
  const bValue = terrainEdgeInsideDistance(b.position, edge) - threshold;
  if (Math.abs(aValue) <= 0.0001) return a;
  if (Math.abs(bValue) <= 0.0001) return b;
  if (aValue * bValue > 0) return null;
  const t = clampRange(aValue / (aValue - bValue), 0, 1);
  const position = a.position.clone().lerp(b.position, t);
  const tangent = b.position.clone().sub(a.position);
  tangent.z = 0;
  if (tangent.lengthSq() <= 0.000001) tangent.copy(a.tangent);
  if (tangent.lengthSq() <= 0.000001) tangent.set(1, 0, 0);
  else tangent.normalize();
  return { position, tangent };
}

function topoGraticulePreferredCrossingWithIndex(
  candidates: TopoGraticuleLabelCandidate[],
  edge: TerrainEdgeFadeState,
  preference: "west" | "north",
  threshold: number,
): TopoGraticuleIndexedCrossing | null {
  let best: TopoGraticuleIndexedCrossing | null = null;
  let bestScore = -Infinity;
  for (let index = 1; index < candidates.length; index += 1) {
    const crossing = topoGraticuleThresholdCrossing(
      candidates[index - 1],
      candidates[index],
      edge,
      threshold,
    );
    if (!crossing) continue;
    const score = terrainEdgePreferenceScore(
      crossing.position,
      edge,
      preference,
    );
    if (score > bestScore) {
      bestScore = score;
      best = { crossing, segmentIndex: index };
    }
  }
  return best;
}

function topoGraticulePreferredCrossing(
  candidates: TopoGraticuleLabelCandidate[],
  edge: TerrainEdgeFadeState,
  preference: "west" | "north",
  threshold: number,
): TopoGraticuleLabelCandidate | null {
  return topoGraticulePreferredCrossingWithIndex(
    candidates,
    edge,
    preference,
    threshold,
  )?.crossing ?? null;
}

function topoGraticuleNearestCrossing(
  candidates: TopoGraticuleLabelCandidate[],
  edge: TerrainEdgeFadeState,
  threshold: number,
  reference: THREE.Vector3,
  startIndex = 1,
  endIndex = candidates.length - 1,
): TopoGraticuleLabelCandidate | null {
  let best: TopoGraticuleLabelCandidate | null = null;
  let bestDistanceSq = Infinity;
  const firstIndex = Math.max(1, Math.floor(startIndex));
  const lastIndex = Math.min(candidates.length - 1, Math.floor(endIndex));
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const crossing = topoGraticuleThresholdCrossing(
      candidates[index - 1],
      candidates[index],
      edge,
      threshold,
    );
    if (!crossing) continue;
    const distanceSq = crossing.position.distanceToSquared(reference);
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = crossing;
    }
  }
  return best;
}

// Tracks per-segment line distances so dashed `LineSegments2` instances can
// share a coherent dash phase per source polyline instead of the cumulative
// across-the-whole-buffer phase that `computeLineDistances()` produces.
type DashDistanceTracker = {
  // Two entries per pushed segment: [d_start, d_end].
  distances: number[];
  // Distance accumulator for the current source polyline.
  current: number;
};

function pushTopoGraticuleSegment(
  positions: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  tracker: DashDistanceTracker | null = null,
): void {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  if (tracker) {
    const length = a.distanceTo(b);
    tracker.distances.push(tracker.current);
    tracker.distances.push(tracker.current + length);
    tracker.current += length;
  }
}

function topoGraticuleVisibleSegment(
  a: TopoGraticuleLabelCandidate,
  b: TopoGraticuleLabelCandidate,
  edge: TerrainEdgeFadeState,
  threshold: number,
): [THREE.Vector3, THREE.Vector3] | null {
  const aValue = terrainEdgeInsideDistance(a.position, edge) - threshold;
  const bValue = terrainEdgeInsideDistance(b.position, edge) - threshold;
  if (aValue < 0 && bValue < 0) return null;
  if (aValue >= 0 && bValue >= 0) return [a.position, b.position];
  const crossing = topoGraticuleThresholdCrossing(a, b, edge, threshold);
  if (!crossing) return null;
  return aValue >= 0
    ? [a.position, crossing.position]
    : [crossing.position, b.position];
}

function topoGraticulePairTangent(
  a: TopoGraticuleLabelCandidate,
  b: TopoGraticuleLabelCandidate,
): THREE.Vector3 {
  const tangent = b.position.clone().sub(a.position);
  tangent.z = 0;
  if (tangent.lengthSq() <= 0.000001) tangent.copy(a.tangent);
  tangent.z = 0;
  if (tangent.lengthSq() <= 0.000001) tangent.set(1, 0, 0);
  else tangent.normalize();
  return tangent;
}

function topoGraticuleInterpolatedCandidate(
  a: TopoGraticuleLabelCandidate,
  b: TopoGraticuleLabelCandidate,
  t: number,
  tangent: THREE.Vector3,
): TopoGraticuleLabelCandidate {
  return {
    position: a.position.clone().lerp(b.position, t),
    tangent: tangent.clone(),
  };
}

function pushTopoGraticuleVisibleSegmentParts(
  positions: number[],
  a: TopoGraticuleLabelCandidate,
  b: TopoGraticuleLabelCandidate,
  edge: TerrainEdgeFadeState,
  threshold: number,
  tracker: DashDistanceTracker | null = null,
): void {
  const tangent = topoGraticulePairTangent(a, b);
  let runStart: THREE.Vector3 | null = null;
  let runEnd: THREE.Vector3 | null = null;
  const flushRun = () => {
    if (runStart && runEnd && runStart.distanceToSquared(runEnd) > 1) {
      pushTopoGraticuleSegment(positions, runStart, runEnd, tracker);
    }
    runStart = null;
    runEnd = null;
  };

  for (let step = 1; step <= TOPO_GRATICULE_EDGE_CLIP_SUBDIVISIONS; step += 1) {
    const t0 = (step - 1) / TOPO_GRATICULE_EDGE_CLIP_SUBDIVISIONS;
    const t1 = step / TOPO_GRATICULE_EDGE_CLIP_SUBDIVISIONS;
    const subA = topoGraticuleInterpolatedCandidate(a, b, t0, tangent);
    const subB = topoGraticuleInterpolatedCandidate(a, b, t1, tangent);
    const clipped = topoGraticuleVisibleSegment(subA, subB, edge, threshold);
    if (!clipped) {
      flushRun();
      continue;
    }
    if (!runStart || !runEnd) {
      runStart = clipped[0].clone();
      runEnd = clipped[1].clone();
      continue;
    }
    if (runEnd.distanceToSquared(clipped[0]) <= 1) {
      runEnd.copy(clipped[1]);
      continue;
    }
    flushRun();
    runStart = clipped[0].clone();
    runEnd = clipped[1].clone();
  }
  flushRun();
}

type RibbonBlendColors = {
  // Per-segment two-stop gradient (start = inner end, end = outer end). RGB
  // floats in [0, 1]. When null, every vertex of every segment uses (1,1,1)
  // and the material color carries the look.
  innerRGB: [number, number, number];
  outerRGB: [number, number, number];
};

function setTopoGraticuleRibbonPositions(
  mesh: THREE.Mesh,
  positions: number[],
  ribbonWidthM: number,
  blend: RibbonBlendColors | null = null,
): void {
  // Build a flat strip quad for each segment in `positions` (which holds
  // [ax, ay, az, bx, by, bz, …]). Quads are perpendicular to the line in
  // the XY plane; z is interpolated linearly between segment endpoints so
  // ribbons drape on terrain the same way the lines do.
  const segmentCount = Math.floor(positions.length / 6);
  if (segmentCount === 0) {
    mesh.geometry.dispose();
    mesh.geometry = new THREE.BufferGeometry();
    mesh.userData.topoGraticuleSegmentCount = 0;
    return;
  }
  const halfWidth = Math.max(1, ribbonWidthM) * 0.5;
  const vertexFloats = new Float32Array(segmentCount * 12); // 4 verts × 3 = 12 per quad
  const colorFloats = new Float32Array(segmentCount * 12);
  const indices = new Uint32Array(segmentCount * 6); // 2 tris × 3 indices
  const innerR = blend ? blend.innerRGB[0] : 1;
  const innerG = blend ? blend.innerRGB[1] : 1;
  const innerB = blend ? blend.innerRGB[2] : 1;
  const outerR = blend ? blend.outerRGB[0] : 1;
  const outerG = blend ? blend.outerRGB[1] : 1;
  const outerB = blend ? blend.outerRGB[2] : 1;
  for (let i = 0; i < segmentCount; i += 1) {
    const offset = i * 6;
    const ax = positions[offset];
    const ay = positions[offset + 1];
    const az = positions[offset + 2];
    const bx = positions[offset + 3];
    const by = positions[offset + 4];
    const bz = positions[offset + 5];
    let dx = bx - ax;
    let dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len > 0.000001) {
      dx /= len;
      dy /= len;
    } else {
      dx = 1;
      dy = 0;
    }
    const px = -dy * halfWidth;
    const py = dx * halfWidth;
    const vBase = i * 12;
    // start - perp (inner end, side 0)
    vertexFloats[vBase + 0] = ax - px;
    vertexFloats[vBase + 1] = ay - py;
    vertexFloats[vBase + 2] = az;
    // start + perp (inner end, side 1)
    vertexFloats[vBase + 3] = ax + px;
    vertexFloats[vBase + 4] = ay + py;
    vertexFloats[vBase + 5] = az;
    // end - perp (outer end, side 0)
    vertexFloats[vBase + 6] = bx - px;
    vertexFloats[vBase + 7] = by - py;
    vertexFloats[vBase + 8] = bz;
    // end + perp (outer end, side 1)
    vertexFloats[vBase + 9] = bx + px;
    vertexFloats[vBase + 10] = by + py;
    vertexFloats[vBase + 11] = bz;
    // Per-vertex colour: start verts get inner, end verts get outer.
    colorFloats[vBase + 0] = innerR;
    colorFloats[vBase + 1] = innerG;
    colorFloats[vBase + 2] = innerB;
    colorFloats[vBase + 3] = innerR;
    colorFloats[vBase + 4] = innerG;
    colorFloats[vBase + 5] = innerB;
    colorFloats[vBase + 6] = outerR;
    colorFloats[vBase + 7] = outerG;
    colorFloats[vBase + 8] = outerB;
    colorFloats[vBase + 9] = outerR;
    colorFloats[vBase + 10] = outerG;
    colorFloats[vBase + 11] = outerB;
    const iBase = i * 6;
    const vIndex = i * 4;
    indices[iBase + 0] = vIndex + 0;
    indices[iBase + 1] = vIndex + 2;
    indices[iBase + 2] = vIndex + 1;
    indices[iBase + 3] = vIndex + 1;
    indices[iBase + 4] = vIndex + 2;
    indices[iBase + 5] = vIndex + 3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(vertexFloats, 3),
  );
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(colorFloats, 3),
  );
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  mesh.geometry.dispose();
  mesh.geometry = geometry;
  mesh.userData.topoGraticuleSegmentCount = segmentCount;
}

function setTopoGraticuleLinePositions(
  line: LineSegments2,
  positions: number[],
  // When supplied, [d0_seg0, d1_seg0, d0_seg1, d1_seg1, …]. Used for dashed
  // roles so each source polyline restarts its dash phase at 0 instead of
  // inheriting whatever cumulative distance the previous polyline left
  // (which makes dashes look randomly placed inside each grid box).
  lineDistances: number[] | null = null,
): void {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  line.geometry.dispose();
  line.geometry = geometry;
  if (lineDistances && lineDistances.length === (positions.length / 6) * 2) {
    const buffer = new THREE.InstancedInterleavedBuffer(
      new Float32Array(lineDistances),
      2,
      1,
    );
    geometry.setAttribute(
      "instanceDistanceStart",
      new THREE.InterleavedBufferAttribute(buffer, 1, 0),
    );
    geometry.setAttribute(
      "instanceDistanceEnd",
      new THREE.InterleavedBufferAttribute(buffer, 1, 1),
    );
  } else {
    line.computeLineDistances();
  }
  line.userData.topoGraticuleSegmentCount = positions.length / 6;
}

export interface TopoGraticuleRebuildOptions {
  ribbonMode?: boolean;
  ribbonWidthM?: number;
  minorRibbonWidthM?: number | null;
  leaderBlendEnabled?: boolean;
  leaderBlendInnerRGB?: [number, number, number];
  leaderBlendOuterRGB?: [number, number, number];
}

export function rebuildTopoGraticuleEdgeLines(
  group: THREE.Group,
  edge: TerrainEdgeFadeState | null,
  edgeAware: boolean,
  labelOffsetM: number,
  labelGapM: number,
  options: TopoGraticuleRebuildOptions = {},
): void {
  const ribbonMode = options.ribbonMode === true;
  const ribbonWidthM = options.ribbonWidthM ?? 250;
  const minorRibbonWidthM =
    options.minorRibbonWidthM ?? ribbonWidthM * TOPO_GRATICULE_MINOR_SCALE;
  const leaderBlendEnabled = options.leaderBlendEnabled === true;
  const leaderInner: [number, number, number] =
    options.leaderBlendInnerRGB ?? [1, 1, 1];
  const leaderOuter: [number, number, number] =
    options.leaderBlendOuterRGB ?? [1, 1, 1];
  let sourceRoot: THREE.Object3D | null =
    group.userData?.topoGraticule === true ? group : null;
  group.traverse((obj) => {
    if (!sourceRoot && obj.userData?.topoGraticule === true) {
      sourceRoot = obj;
    }
  });
  if (!sourceRoot) return;
  const rawSourceLines = sourceRoot.userData?.topoGraticuleSourceLines as
    | unknown[]
    | undefined;
  if (!Array.isArray(rawSourceLines)) return;
  const sourceLines = rawSourceLines
    .map((line) => topoGraticuleSourceLine(line))
    .filter((line): line is TopoGraticuleSourceLine => Boolean(line));
  if (sourceLines.length === 0) return;

  let interiorLine: LineSegments2 | null = null;
  let dashedInteriorLine: LineSegments2 | null = null;
  let leaderLine: LineSegments2 | null = null;
  let dashedLeaderLine: LineSegments2 | null = null;
  let interiorRibbon: THREE.Mesh | null = null;
  let dashedInteriorRibbon: THREE.Mesh | null = null;
  let leaderRibbon: THREE.Mesh | null = null;
  let dashedLeaderRibbon: THREE.Mesh | null = null;
  group.traverse((obj) => {
    if (obj instanceof LineSegments2) {
      if (obj.userData?.topoGraticuleLineRole === "leader") leaderLine = obj;
      else if (obj.userData?.topoGraticuleLineRole === "leader-dashed") {
        dashedLeaderLine = obj;
      } else if (obj.userData?.topoGraticuleLineRole === "interior-dashed") {
        dashedInteriorLine = obj;
      } else if (obj.userData?.topoGraticuleLineRole === "interior") {
        interiorLine = obj;
      }
      return;
    }
    if (
      obj instanceof THREE.Mesh &&
      obj.userData?.topoGraticuleRibbon === true
    ) {
      if (obj.userData?.topoGraticuleLineRole === "leader") leaderRibbon = obj;
      else if (obj.userData?.topoGraticuleLineRole === "leader-dashed") {
        dashedLeaderRibbon = obj;
      } else if (obj.userData?.topoGraticuleLineRole === "interior-dashed") {
        dashedInteriorRibbon = obj;
      } else if (obj.userData?.topoGraticuleLineRole === "interior") {
        interiorRibbon = obj;
      }
    }
  });
  const interior = interiorLine as LineSegments2 | null;
  const dashedInterior = dashedInteriorLine as LineSegments2 | null;
  const leader = leaderLine as LineSegments2 | null;
  const dashedLeader = dashedLeaderLine as LineSegments2 | null;
  const interiorRibbonMesh = interiorRibbon as THREE.Mesh | null;
  const dashedInteriorRibbonMesh = dashedInteriorRibbon as THREE.Mesh | null;
  const leaderRibbonMesh = leaderRibbon as THREE.Mesh | null;
  const dashedLeaderRibbonMesh = dashedLeaderRibbon as THREE.Mesh | null;
  if (!interior || !dashedInterior || !leader || !dashedLeader) return;

  const interiorPositions: number[] = [];
  const dashedInteriorPositions: number[] = [];
  const leaderPositions: number[] = [];
  const dashedLeaderPositions: number[] = [];
  // Dash distance is tracked per source polyline (one constant-latitude or
  // constant-longitude line). Reset at the top of each source-line loop so
  // every polyline starts its dash phase at 0, giving a coherent dashed
  // grid pattern across boxes.
  const dashedInteriorTracker: DashDistanceTracker = {
    distances: [],
    current: 0,
  };
  const dashedLeaderTracker: DashDistanceTracker = {
    distances: [],
    current: 0,
  };
  const labelTargets = new Map<string, TopoGraticuleLabelTarget>();
  const innerThreshold = edgeAware && edge ? edge.fadeDistanceM : -Infinity;
  const labelGap = labelGapM;

  for (const sourceLine of sourceLines) {
    const { candidates } = sourceLine;
    const isMinor = topoGraticuleIsHalfDegree(sourceLine.value);
    const sourceInteriorPositions = isMinor
      ? dashedInteriorPositions
      : interiorPositions;
    const sourceInteriorTracker = isMinor ? dashedInteriorTracker : null;
    if (sourceInteriorTracker) sourceInteriorTracker.current = 0;
    for (let index = 1; index < candidates.length; index += 1) {
      if (!edgeAware || !edge) {
        pushTopoGraticuleSegment(
          sourceInteriorPositions,
          candidates[index - 1].position,
          candidates[index].position,
          sourceInteriorTracker,
        );
        continue;
      }
      pushTopoGraticuleVisibleSegmentParts(
        sourceInteriorPositions,
        candidates[index - 1],
        candidates[index],
        edge,
        innerThreshold,
        sourceInteriorTracker,
      );
    }

    if (!edgeAware || !edge) continue;
    const innerResult = topoGraticulePreferredCrossingWithIndex(
      candidates,
      edge,
      sourceLine.preference,
      innerThreshold,
    );
    if (!innerResult) continue;
    const inner = innerResult.crossing;
    const outerStartIndex = Math.max(
      1,
      innerResult.segmentIndex - TOPO_GRATICULE_EDGE_CROSSING_WINDOW,
    );
    const outerEndIndex = Math.min(
      candidates.length - 1,
      innerResult.segmentIndex + TOPO_GRATICULE_EDGE_CROSSING_WINDOW,
    );
    const outer = topoGraticuleNearestCrossing(
      candidates,
      edge,
      0,
      inner.position,
      outerStartIndex,
      outerEndIndex,
    );
    const eligibleOuter =
      outer &&
      terrainEdgeStraightSideEligible(
        outer.position,
        edge,
        sourceLine.preference,
      )
        ? outer
        : null;
    // Minor (.5) labels keep the same offset from their anchor as major
    // labels — only the text scale shrinks via TOPO_GRATICULE_MINOR_SCALE
    // downstream. Scaling the offset here previously made minor labels look
    // crowded against their leader.
    const effectiveLabelOffsetM = labelOffsetM;
    const effectiveLabelThreshold = -Math.max(0, effectiveLabelOffsetM);
    const target =
      topoGraticuleNearestCrossing(
        candidates,
        edge,
        effectiveLabelThreshold,
        inner.position,
      ) ??
      (() => {
        const outward = edgeOutwardLineTangent(inner, edge);
        const currentInside = terrainEdgeInsideDistance(inner.position, edge);
        return {
          position: inner.position
            .clone()
            .addScaledVector(outward, currentInside - effectiveLabelThreshold),
          tangent: inner.tangent.clone(),
        };
      })();
    const edgeTextBasis = topoGraticuleEdgeTextBasis(sourceLine.preference);
    const readableTangent = edgeTextBasis.tangent;
    const positions = isMinor ? dashedLeaderPositions : leaderPositions;
    if (eligibleOuter) {
      // Leader length is no longer scaled by TOPO_GRATICULE_MINOR_SCALE —
      // minor leaders match the length of major leaders so the .5 labels sit
      // at the same distance from the map edge as the whole-degree labels.
      const leaderLengthM = clampRange(
        Math.abs(labelGapM),
        TOPO_GRATICULE_EDGE_LEADER_MIN_M,
        TOPO_GRATICULE_EDGE_LEADER_MAX_M,
      );
      const leaderEnd = eligibleOuter.position
        .clone()
        .addScaledVector(edgeTextBasis.outward, leaderLengthM);
      leaderEnd.z = eligibleOuter.position.z;
      const leaderTracker = isMinor ? dashedLeaderTracker : null;
      if (leaderTracker) leaderTracker.current = 0;
      pushTopoGraticuleSegment(
        positions,
        eligibleOuter.position,
        leaderEnd,
        leaderTracker,
      );
    }
    labelTargets.set(
      topoGraticuleLineKey(
        sourceLine.kind,
        sourceLine.value,
        sourceLine.preference,
      ),
      {
        position: target.position.clone(),
        anchor: target.position.clone(),
        tangent: readableTangent,
        outward: edgeTextBasis.outward,
        insideDistance: terrainEdgeInsideDistance(target.position, edge),
        minor: isMinor,
      },
    );
  }

  setTopoGraticuleLinePositions(interior, interiorPositions);
  setTopoGraticuleLinePositions(
    dashedInterior,
    dashedInteriorPositions,
    dashedInteriorTracker.distances,
  );
  setTopoGraticuleLinePositions(leader, leaderPositions);
  setTopoGraticuleLinePositions(
    dashedLeader,
    dashedLeaderPositions,
    dashedLeaderTracker.distances,
  );
  const interiorVisible = interiorPositions.length > 0;
  const dashedInteriorVisible = dashedInteriorPositions.length > 0;
  const leaderVisible = edgeAware && leaderPositions.length > 0;
  const dashedLeaderVisible = edgeAware && dashedLeaderPositions.length > 0;
  interior.visible = interiorVisible && !ribbonMode;
  dashedInterior.visible = dashedInteriorVisible && !ribbonMode;
  leader.visible = leaderVisible && !ribbonMode;
  dashedLeader.visible = dashedLeaderVisible && !ribbonMode;
  // Only rebuild ribbon geometry when ribbon mode is on. When toggled off,
  // the ribbon meshes stay hidden with their last (possibly stale) geometry;
  // no perf cost from rebuilding strips that are never rendered.
  if (ribbonMode) {
    const leaderBlend: RibbonBlendColors | null = leaderBlendEnabled
      ? { innerRGB: leaderInner, outerRGB: leaderOuter }
      : null;
    if (interiorRibbonMesh) {
      setTopoGraticuleRibbonPositions(
        interiorRibbonMesh,
        interiorPositions,
        ribbonWidthM,
      );
      interiorRibbonMesh.visible = interiorVisible;
    }
    if (dashedInteriorRibbonMesh) {
      setTopoGraticuleRibbonPositions(
        dashedInteriorRibbonMesh,
        dashedInteriorPositions,
        minorRibbonWidthM,
      );
      dashedInteriorRibbonMesh.visible = dashedInteriorVisible;
    }
    if (leaderRibbonMesh) {
      setTopoGraticuleRibbonPositions(
        leaderRibbonMesh,
        leaderPositions,
        ribbonWidthM,
        leaderBlend,
      );
      leaderRibbonMesh.visible = leaderVisible;
    }
    if (dashedLeaderRibbonMesh) {
      setTopoGraticuleRibbonPositions(
        dashedLeaderRibbonMesh,
        dashedLeaderPositions,
        minorRibbonWidthM,
        leaderBlend,
      );
      dashedLeaderRibbonMesh.visible = dashedLeaderVisible;
    }
  } else {
    if (interiorRibbonMesh) interiorRibbonMesh.visible = false;
    if (dashedInteriorRibbonMesh) dashedInteriorRibbonMesh.visible = false;
    if (leaderRibbonMesh) leaderRibbonMesh.visible = false;
    if (dashedLeaderRibbonMesh) dashedLeaderRibbonMesh.visible = false;
  }
  for (const target of [group, sourceRoot]) {
    const leaderLinesVisible =
      edgeAware && leaderPositions.length + dashedLeaderPositions.length > 0;
    target.userData.topoGraticuleEdgeAware = edgeAware;
    target.userData.topoGraticuleEdgeColorBlendEnabled = false;
    target.userData.topoGraticuleEdgeAlphaFadeEnabled = false;
    target.userData.topoGraticuleEdgeLeaderLinesVisible = leaderLinesVisible;
    target.userData.topoGraticuleInteriorSegmentCount =
      (interiorPositions.length + dashedInteriorPositions.length) / 6;
    target.userData.topoGraticuleDashedInteriorSegmentCount =
      dashedInteriorPositions.length / 6;
    target.userData.topoGraticuleLeaderSegmentCount =
      (leaderPositions.length + dashedLeaderPositions.length) / 6;
    target.userData.topoGraticuleDashedLeaderSegmentCount =
      dashedLeaderPositions.length / 6;
    target.userData.topoGraticuleInnerTrimInsideDistance = innerThreshold;
    target.userData.topoGraticuleLabelOffsetM = labelOffsetM;
    target.userData.topoGraticuleLabelGapM = labelGap;
    target.userData.topoGraticuleEdgeLeaderMinM =
      TOPO_GRATICULE_EDGE_LEADER_MIN_M;
    target.userData.topoGraticuleEdgeLeaderMaxM =
      TOPO_GRATICULE_EDGE_LEADER_MAX_M;
    target.userData.topoGraticuleEdgeClipSubdivisions =
      TOPO_GRATICULE_EDGE_CLIP_SUBDIVISIONS;
    target.userData.topoGraticuleEdgeCrossingWindow =
      TOPO_GRATICULE_EDGE_CROSSING_WINDOW;
    target.userData.topoGraticuleLabelTargets = labelTargets;
  }
}

function applyTopoGraticuleLabelPlacement(
  obj: THREE.Object3D,
  edge: TerrainEdgeFadeState | null,
  edgeAware: boolean,
  labelOffsetM: number,
  labelGapM: number,
  labelSizeM: number,
): void {
  if (!edgeAware || !edge) return;
  const preference =
    obj.userData?.topoGraticuleLabelPreference === "north"
      ? "north"
      : "west";
  const targetMap = obj.parent?.userData
    ?.topoGraticuleLabelTargets as Map<string, TopoGraticuleLabelTarget> | undefined;
  if (targetMap instanceof Map) {
    const labelKey = topoGraticuleLabelKey(obj);
    const target = labelKey ? targetMap.get(labelKey) : null;
    if (!target) {
      obj.visible = false;
      obj.userData.topoGraticuleLabelHasLeader = false;
      obj.userData.topoGraticuleLabelExcludedReason = "no-edge-leader";
      return;
    }
    const aspect =
      typeof obj.userData?.topoGraticuleLabelAspect === "number"
        ? Math.max(1, obj.userData.topoGraticuleLabelAspect)
        : 2.4;
    const labelScale =
      (labelSizeM / 9000) *
      (target.minor ? TOPO_GRATICULE_MINOR_SCALE : 1);
    const halfTextLengthM = 9000 * aspect * labelScale * 0.5;
    const labelGap = labelGapM;
    const position = target.anchor
      .clone()
      .addScaledVector(target.outward, labelGap + halfTextLengthM);
    obj.position.copy(position);
    obj.rotation.set(
      0,
      0,
      normalizeFullGroundTextAngle(
        Math.atan2(target.tangent.y, target.tangent.x),
      ),
    );
    obj.userData.topoGraticuleLabelHasLeader = true;
    obj.userData.topoGraticuleLabelExcludedReason = null;
    obj.userData.topoGraticuleActiveLabelInsideDistance =
      terrainEdgeInsideDistance(position, edge);
    obj.userData.topoGraticuleActiveLabelAnchor = {
      x: target.anchor.x,
      y: target.anchor.y,
      z: target.anchor.z,
    };
    obj.userData.topoGraticuleActiveLabelTangent = {
      x: target.tangent.x,
      y: target.tangent.y,
      z: target.tangent.z,
    };
    obj.userData.topoGraticuleLabelGapM = labelGapM;
    obj.userData.topoGraticuleLabelMinor = target.minor;
    return;
  }
  const candidates = obj.userData?.topoGraticuleLabelCandidates as
    | unknown[]
    | undefined;
  if (!Array.isArray(candidates) || candidates.length === 0) return;
  const targetInsideDistance = -Math.max(0, labelOffsetM);
  const parsedCandidates = candidates
    .map((candidate) => topoGraticuleLabelCandidate(candidate))
    .filter((candidate): candidate is TopoGraticuleLabelCandidate =>
      Boolean(candidate),
    );
  const target = topoGraticulePreferredCrossing(
    parsedCandidates,
    edge,
    preference,
    targetInsideDistance,
  );
  if (target) {
    obj.position.copy(target.position);
    obj.rotation.set(0, 0, topoGraticuleReadableAngle(target.tangent, preference));
    obj.userData.topoGraticuleActiveLabelInsideDistance =
      terrainEdgeInsideDistance(target.position, edge);
    obj.userData.topoGraticuleActiveLabelTangent = {
      x: target.tangent.x,
      y: target.tangent.y,
      z: target.tangent.z,
    };
    return;
  }

  let best: TopoGraticuleLabelCandidate | null = null;
  let bestScore = -Infinity;
  for (const candidate of parsedCandidates) {
    const insideDistance = terrainEdgeInsideDistance(
      candidate.position,
      edge,
    );
    const edgeFit = -Math.abs(insideDistance - targetInsideDistance);
    const sideFit =
      terrainEdgePreferenceScore(candidate.position, edge, preference) *
      0.35;
    const score = sideFit + edgeFit;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (!best) return;

  const position = best.position.clone();
  const currentInsideDistance = terrainEdgeInsideDistance(position, edge);
  if (currentInsideDistance > targetInsideDistance) {
    const outward = edgeOutwardLineTangent(best, edge);
    position.addScaledVector(
      outward,
      currentInsideDistance - targetInsideDistance,
    );
  }
  obj.position.copy(position);
  obj.rotation.set(0, 0, topoGraticuleReadableAngle(best.tangent, preference));
  obj.userData.topoGraticuleActiveLabelInsideDistance =
    terrainEdgeInsideDistance(position, edge);
  obj.userData.topoGraticuleActiveLabelTangent = {
    x: best.tangent.x,
    y: best.tangent.y,
    z: best.tangent.z,
  };
}

export function applyTopoGraticuleStyle({
  group,
  style,
  clipBox,
  clipPlanes,
  terrainEdge,
}: ApplyTopoGraticuleStyleParams): void {
  const labelVisible = style.graticuleLabelVisible !== false;
  const labelSize = styleNumber(
    style,
    "graticuleLabelSizeM",
    9000,
    1500,
    60000,
  );
  const lift = styleNumber(style, "graticuleLiftM", 24, -50, 500);
  group.position.z = lift;
  const opacity = clamp01(styleNumber(style, "opacity", 0.62, 0, 1));
  const color = typeof style.color === "string" ? style.color : "#d7d1c7";
  const edgeAware = style.graticuleEdgeFadeAware !== false;
  const edgeStrength = styleNumber(
    style,
    "graticuleEdgeFadeStrength",
    1,
    0,
    1,
  );
  const edgeLineColor =
    typeof style.graticuleEdgeLineColor === "string"
      ? style.graticuleEdgeLineColor
      : "#ffffff";
  const edgeLabelColor =
    typeof style.graticuleEdgeLabelColor === "string"
      ? style.graticuleEdgeLabelColor
      : "#ffffff";
  const edgeLabelVisible = style.graticuleEdgeLabelVisible !== false;
  const edgeLabelOffsetM = styleNumber(
    style,
    "graticuleEdgeLabelOffsetM",
    90000,
    0,
    160000,
  );
  const edgeLabelGapM = styleNumber(
    style,
    "graticuleEdgeLabelGapM",
    22000,
    -100000,
    100000,
  );
  const graticuleLineWidth = styleNumber(style, "lineWidth", 4.75, 0.1, 24);
  const graticuleEdgeLineWidth = styleNumber(
    style,
    "graticuleEdgeLineWidth",
    graticuleLineWidth,
    0.1,
    32,
  );
  const perspectiveLineWidth = style.graticulePerspectiveLineWidth === true;
  // Reference camera-space depth (m) at which a perspective-mode line keeps
  // its authored width. Closer than this → lines look thicker; farther →
  // lines look thinner. Tuned for typical Utah FORGE oblique camera ranges.
  const perspectiveReferenceM = 30_000;
  const ribbonMode = style.graticuleRibbonMode === true;
  const ribbonAdditive = style.graticuleRibbonAdditive !== false;
  const ribbonBrightness = styleNumber(
    style,
    "graticuleRibbonBrightness",
    1,
    0.1,
    8,
  );
  // Ribbon soft-occlusion style fields (graticuleRibbonOcclude /
  // graticuleRibbonOcclusionSoftnessM) are reserved for a future depth-aware
  // overlay pass; current implementation renders ribbons unconditionally on
  // top of the composed canvas and does not consult these fields.
  void style.graticuleRibbonOcclude;
  void style.graticuleRibbonOcclusionSoftnessM;
  const ribbonWidthM = styleNumber(
    style,
    "graticuleRibbonWidthM",
    250,
    50,
    3000,
  );
  const minorRibbonWidthM =
    typeof style.graticuleMinorRibbonWidthM === "number" &&
    Number.isFinite(style.graticuleMinorRibbonWidthM)
      ? clampRange(style.graticuleMinorRibbonWidthM, 10, 3000)
      : null;
  const minorLineWidth =
    typeof style.graticuleMinorLineWidth === "number" &&
    Number.isFinite(style.graticuleMinorLineWidth)
      ? clampRange(style.graticuleMinorLineWidth, 0.1, 32)
      : null;
  const minorOpacity =
    typeof style.graticuleMinorOpacity === "number" &&
    Number.isFinite(style.graticuleMinorOpacity)
      ? clamp01(style.graticuleMinorOpacity)
      : null;
  const minorColor =
    typeof style.graticuleMinorColor === "string"
      ? style.graticuleMinorColor
      : null;
  const leaderBlendEnabled = style.graticuleLeaderBlendEnabled === true;
  const leaderBlendInnerColor =
    typeof style.graticuleLeaderBlendInnerColor === "string"
      ? style.graticuleLeaderBlendInnerColor
      : color;
  const leaderBlendOuterColor =
    typeof style.graticuleLeaderBlendOuterColor === "string"
      ? style.graticuleLeaderBlendOuterColor
      : edgeLineColor;
  const colorToRGB = (hex: string): [number, number, number] => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  rebuildTopoGraticuleEdgeLines(
    group,
    terrainEdge,
    edgeAware,
    edgeLabelOffsetM,
    edgeLabelGapM,
    {
      ribbonMode,
      ribbonWidthM,
      minorRibbonWidthM,
      leaderBlendEnabled,
      leaderBlendInnerRGB: colorToRGB(leaderBlendInnerColor),
      leaderBlendOuterRGB: colorToRGB(leaderBlendOuterColor),
    },
  );
  // DEC-077: graticule layers opt in to scene-section clipping via
  // style.topoSectionable. Stamp on the group AND every traversed object;
  // material loop below stamps materials. Cleared to undefined when off so
  // sceneSectionObjectExcludedFromClipping returns its default exclusion.
  const sectionable = style.topoSectionable === true;
  group.userData.topoSectionable = sectionable;
  group.traverse((obj) => {
    obj.userData.topoSectionable = sectionable;
    if (obj.userData?.topoGraticuleLabel === true) {
      obj.visible = labelVisible && (!edgeAware || edgeLabelVisible);
      applyTopoGraticuleLabelPlacement(
        obj,
        terrainEdge,
        edgeAware,
        edgeLabelOffsetM,
        edgeLabelGapM,
        labelSize,
      );
      const base = obj.userData.topoGraticuleBaseScale as
        | THREE.Vector3
        | undefined;
      const scaleFactor =
        (labelSize / 9000) *
        (obj.userData.topoGraticuleLabelMinor === true
          ? TOPO_GRATICULE_MINOR_SCALE
          : 1);
      if (base) {
        obj.scale.set(
          base.x * scaleFactor,
          base.y * scaleFactor,
          base.z * scaleFactor,
        );
      } else {
        obj.scale.setScalar(scaleFactor);
      }
    }
    const material = (obj as { material?: THREE.Material | THREE.Material[] })
      .material;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const item of materials) {
      // DEC-077: mirror the per-object sectionable flag on the material so
      // applySceneSectionMaterial's early-return path can honor the opt-in
      // without re-walking the object tree.
      item.userData.topoSectionable = sectionable;
      const lineRole = obj.userData?.topoGraticuleLineRole;
      const isGraticuleLineObject =
        lineRole === "interior" ||
        lineRole === "interior-dashed" ||
        lineRole === "leader" ||
        lineRole === "leader-dashed" ||
        obj.userData?.topoGraticuleLines === true;
      const minorLine =
        lineRole === "interior-dashed" || lineRole === "leader-dashed";
      const minorLabel =
        obj.userData?.topoGraticuleLabel === true &&
        obj.userData.topoGraticuleLabelMinor === true;
      if ("color" in item && item.color instanceof THREE.Color) {
        const isLeaderRole =
          lineRole === "leader" || lineRole === "leader-dashed";
        const isLabel = obj.userData?.topoGraticuleLabel === true;
        const effectiveColor = isLabel && edgeAware
          ? edgeLabelColor
          : isLeaderRole && edgeAware
            ? edgeLineColor
            : minorLine && minorColor
              ? minorColor
              : color;
        item.color.set(effectiveColor);
      }
      if (isGraticuleLineObject) {
        item.depthTest = true;
        item.depthWrite = false;
        item.userData.topoGraticuleDepthTest = item.depthTest;
        item.userData.topoGraticuleDepthWrite = item.depthWrite;
        item.userData.topoGraticuleLineOpacity = opacity;
        item.userData.topoGraticuleLineRole = lineRole;
        item.userData.topoGraticuleEdgeAware = edgeAware;
        item.userData.topoGraticuleEdgeColorBlendEnabled = false;
        item.userData.topoGraticuleEdgeAlphaFadeEnabled = false;
        item.userData.topoGraticuleEdgeLeaderLinesVisible =
          (lineRole === "leader" || lineRole === "leader-dashed") &&
          obj.visible !== false;
      }
      if (item instanceof LineMaterial && item.userData?.topoGraticuleLineMaterial) {
        const edgeLine =
          lineRole === "leader" || lineRole === "leader-dashed";
        const baseLineWidth = edgeLine
          ? graticuleEdgeLineWidth
          : graticuleLineWidth;
        // Minor (.5) lines use an explicit width override when authored,
        // otherwise fall back to the legacy MINOR_SCALE multiplier.
        const effectiveMinorWidth =
          minorLineWidth !== null
            ? minorLineWidth
            : baseLineWidth * TOPO_GRATICULE_MINOR_SCALE;
        item.linewidth = minorLine ? effectiveMinorWidth : baseLineWidth;
        setTopoPerspectiveLineWidth(
          item,
          perspectiveLineWidth,
          perspectiveReferenceM,
        );
        setTopoGraticuleEdgeFade(item, {
          enabled: edgeAware,
          strength: edgeStrength,
          lineColor: edgeLineColor,
          boundsMin: terrainEdge
            ? [terrainEdge.boundsMin.x, terrainEdge.boundsMin.y]
            : undefined,
          boundsMax: terrainEdge
            ? [terrainEdge.boundsMax.x, terrainEdge.boundsMax.y]
            : undefined,
          edgeFadeDistanceM: terrainEdge?.fadeDistanceM ?? 0,
          edgeFadeShape: terrainEdge?.shape ?? "square",
          edgeFadeInsetM: terrainEdge?.insetM ?? 0,
          edgeFadeCornerRadiusM: terrainEdge?.cornerRadiusM ?? 0,
        });
      }
      // Ribbon material settings: additive vs normal blending and brightness
      // multiplier baked into material color. Note: the per-vertex color
      // attribute carries the leader blend; here we just gate the global
      // material color back to white when leader blend is on (so the vertex
      // colours show through unmodified) for leader roles.
      if (
        item instanceof THREE.MeshBasicMaterial &&
        item.userData?.topoGraticuleRibbonMaterial === true
      ) {
        item.blending = ribbonAdditive
          ? THREE.AdditiveBlending
          : THREE.NormalBlending;
        item.vertexColors = true;
        if ("color" in item && item.color instanceof THREE.Color) {
          const isLeaderRibbon =
            lineRole === "leader" || lineRole === "leader-dashed";
          if (isLeaderRibbon && leaderBlendEnabled) {
            // White material colour lets per-vertex colours (inner/outer)
            // pass through with no modulation.
            item.color.setRGB(
              ribbonBrightness,
              ribbonBrightness,
              ribbonBrightness,
            );
          } else {
            // Apply brightness to whatever colour was set above.
            const r = item.color.r * ribbonBrightness;
            const g = item.color.g * ribbonBrightness;
            const b = item.color.b * ribbonBrightness;
            item.color.setRGB(r, g, b);
          }
        }
      }
      const effectiveOpacity = minorLine || minorLabel
        ? minorOpacity !== null
          ? minorOpacity
          : opacity * TOPO_GRATICULE_MINOR_SCALE
        : opacity;
      item.opacity = effectiveOpacity;
      item.transparent = true;
      item.depthWrite = false;
      const publicSurfaceClipPlanes =
        clipBox.enabled &&
        (isGraticuleLineObject || !edgeAware)
          ? clipPlanes
          : null;
      item.userData.publicSurfaceClipPlanes = publicSurfaceClipPlanes;
      item.clippingPlanes = publicSurfaceClipPlanes;
      item.clipIntersection = false;
      item.needsUpdate = true;
    }
  });
}
