import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { EditableStyle } from "../pages/types";
import { setTopoGraticuleEdgeFade } from "../loaders/topoLineMaterial";
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

const TOPO_GRATICULE_EDGE_LEADER_MIN_M = 6_000;
const TOPO_GRATICULE_EDGE_LEADER_MAX_M = 24_000;
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

function pushTopoGraticuleSegment(
  positions: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
): void {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
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
): void {
  const tangent = topoGraticulePairTangent(a, b);
  let runStart: THREE.Vector3 | null = null;
  let runEnd: THREE.Vector3 | null = null;
  const flushRun = () => {
    if (runStart && runEnd && runStart.distanceToSquared(runEnd) > 1) {
      pushTopoGraticuleSegment(positions, runStart, runEnd);
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

function setTopoGraticuleLinePositions(
  line: LineSegments2,
  positions: number[],
): void {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  line.geometry.dispose();
  line.geometry = geometry;
  line.computeLineDistances();
  line.userData.topoGraticuleSegmentCount = positions.length / 6;
}

export function rebuildTopoGraticuleEdgeLines(
  group: THREE.Group,
  edge: TerrainEdgeFadeState | null,
  edgeAware: boolean,
  labelOffsetM: number,
  labelGapM: number,
): void {
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
  group.traverse((obj) => {
    if (!(obj instanceof LineSegments2)) return;
    if (obj.userData?.topoGraticuleLineRole === "leader") leaderLine = obj;
    else if (obj.userData?.topoGraticuleLineRole === "leader-dashed") {
      dashedLeaderLine = obj;
    }
    else if (obj.userData?.topoGraticuleLineRole === "interior-dashed") {
      dashedInteriorLine = obj;
    }
    else if (obj.userData?.topoGraticuleLineRole === "interior") {
      interiorLine = obj;
    }
  });
  const interior = interiorLine as LineSegments2 | null;
  const dashedInterior = dashedInteriorLine as LineSegments2 | null;
  const leader = leaderLine as LineSegments2 | null;
  const dashedLeader = dashedLeaderLine as LineSegments2 | null;
  if (!interior || !dashedInterior || !leader || !dashedLeader) return;

  const interiorPositions: number[] = [];
  const dashedInteriorPositions: number[] = [];
  const leaderPositions: number[] = [];
  const dashedLeaderPositions: number[] = [];
  const labelTargets = new Map<string, TopoGraticuleLabelTarget>();
  const innerThreshold = edgeAware && edge ? edge.fadeDistanceM : -Infinity;
  const labelGap = labelGapM;

  for (const sourceLine of sourceLines) {
    const { candidates } = sourceLine;
    const isMinor = topoGraticuleIsHalfDegree(sourceLine.value);
    const sourceInteriorPositions = isMinor
      ? dashedInteriorPositions
      : interiorPositions;
    for (let index = 1; index < candidates.length; index += 1) {
      if (!edgeAware || !edge) {
        pushTopoGraticuleSegment(
          sourceInteriorPositions,
          candidates[index - 1].position,
          candidates[index].position,
        );
        continue;
      }
      pushTopoGraticuleVisibleSegmentParts(
        sourceInteriorPositions,
        candidates[index - 1],
        candidates[index],
        edge,
        innerThreshold,
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
    const effectiveLabelOffsetM =
      labelOffsetM * (isMinor ? TOPO_GRATICULE_MINOR_SCALE : 1);
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
      const leaderLengthM =
        clampRange(
          Math.abs(labelGapM),
          TOPO_GRATICULE_EDGE_LEADER_MIN_M,
          TOPO_GRATICULE_EDGE_LEADER_MAX_M,
        ) * (isMinor ? TOPO_GRATICULE_MINOR_SCALE : 1);
      const leaderEnd = eligibleOuter.position
        .clone()
        .addScaledVector(edgeTextBasis.outward, leaderLengthM);
      leaderEnd.z = eligibleOuter.position.z;
      pushTopoGraticuleSegment(positions, eligibleOuter.position, leaderEnd);
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
  setTopoGraticuleLinePositions(dashedInterior, dashedInteriorPositions);
  setTopoGraticuleLinePositions(leader, leaderPositions);
  setTopoGraticuleLinePositions(dashedLeader, dashedLeaderPositions);
  interior.visible = interiorPositions.length > 0;
  dashedInterior.visible = dashedInteriorPositions.length > 0;
  leader.visible = edgeAware && leaderPositions.length > 0;
  dashedLeader.visible = edgeAware && dashedLeaderPositions.length > 0;
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
  rebuildTopoGraticuleEdgeLines(
    group,
    terrainEdge,
    edgeAware,
    edgeLabelOffsetM,
    edgeLabelGapM,
  );
  group.traverse((obj) => {
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
        item.color.set(
          obj.userData?.topoGraticuleLabel === true && edgeAware
            ? edgeLabelColor
            : (lineRole === "leader" || lineRole === "leader-dashed") &&
                edgeAware
              ? edgeLineColor
              : color,
        );
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
        item.linewidth =
          baseLineWidth * (minorLine ? TOPO_GRATICULE_MINOR_SCALE : 1);
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
      item.opacity =
        opacity *
        (minorLine || minorLabel ? TOPO_GRATICULE_MINOR_SCALE : 1);
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
