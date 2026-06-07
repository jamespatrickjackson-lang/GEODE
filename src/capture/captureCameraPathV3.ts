import {
  applyCaptureCameraPathV3TimeCurve,
} from "./captureCameraPathV3Solver";
import {
  captureCameraPathV2NodeId,
  captureCameraPathV2SegmentId,
  cameraPathV2NodeFromPose,
  normalizeCaptureCameraPathDisplayOptionsV2,
  normalizeCaptureCameraPathV2,
  recipeKeyframesToCameraPathV2,
  validateCaptureCameraPathDisplayOptionsV2,
  type CaptureCameraPathDisplayOptionsV2,
  type CaptureCameraPathFocusPointV2,
  type CaptureCameraPathLegacyKeyframe,
  type CaptureCameraPathLookModeV2,
  type CaptureCameraPathNodeKindV2,
  type CaptureCameraPathPose,
  type CaptureCameraPathV2,
  type CaptureCameraPathV2ValidationResult,
  type CaptureVec3,
} from "./captureCameraPathV2";

export { applyCaptureCameraPathV3TimeCurve };
export type { CaptureVec3 };

export type CaptureCameraPathContinuityV3 = "G0" | "G1" | "G2" | "G3";
export type CaptureCameraPathTimeCurveModeV3 =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "custom-ramp";
export type CaptureCameraPathAimModeV3 =
  | "free-direction"
  | "follow-path-tangent"
  | "focus-point-lock"
  | "target-blend";
export type CaptureCameraPathLensModeV3 =
  | "fixed-fov"
  | "maintain-focus-size"
  | "dolly-zoom";
export type CaptureCameraPathSplineHandleSideV3 = "in" | "out";
export type CaptureCameraPathSplineAxisV3 = "x" | "y" | "z";
export type CaptureCameraPathSplineHandleModeV3 = "auto" | "manual" | "vector";
export type CaptureCameraPathSplineCouplingV3 = "tangent" | "non-tangent";

export interface CaptureCameraPathTimeCurveV3 {
  mode: CaptureCameraPathTimeCurveModeV3;
  ramp?: Array<{ t: number; value: number }>;
}

export interface CaptureCameraPathFairingV3 {
  continuity: CaptureCameraPathContinuityV3;
  tension: number;
  bias: number;
  fromInfluenceOut: number | "auto";
  toInfluenceIn: number | "auto";
  autoHandles: boolean;
}

export interface CaptureCameraPathSplineSideHandleV3 {
  mode: "auto" | "manual";
  length: number | "auto";
  direction?: CaptureVec3;
  position?: CaptureVec3;
}

export interface CaptureCameraPathSplineControlsV3 {
  enabled: boolean;
  continuity: CaptureCameraPathContinuityV3;
  handleMode: CaptureCameraPathSplineHandleModeV3;
  coupling: CaptureCameraPathSplineCouplingV3;
  in: CaptureCameraPathSplineSideHandleV3;
  out: CaptureCameraPathSplineSideHandleV3;
  autoScale: number;
  maxLengthRatio: number;
  preventLoopback: boolean;
}

export interface CaptureCameraPathAimGeometryV3 {
  mode: CaptureCameraPathAimModeV3;
  focusPointId?: string;
  focusDistance?: number | "auto";
  tangentForwardDistance?: number;
  targetBlend?: {
    fromNodeId?: string;
    toNodeId?: string;
    curve: CaptureCameraPathTimeCurveV3;
  };
  lensMode: CaptureCameraPathLensModeV3;
  dollyZoomStrength?: number;
}

export interface CaptureCameraPathEquationOverlayOptionsV3 {
  visible: boolean;
  selectedTransitionOnly: boolean;
  showStackLabels: boolean;
  showTemporalRamp: boolean;
  showTangents: boolean;
  showInfluenceHandles: boolean;
  showCurvatureComb: boolean;
  showFocusDistance: boolean;
}

export interface CaptureCameraPathNodeV3 {
  id: string;
  kind: CaptureCameraPathNodeKindV2;
  enabled: boolean;
  hidden: boolean;
  label?: string;
  timeSeconds: number;
  position: CaptureVec3;
  target?: CaptureVec3;
  up: CaptureVec3;
  fov: number;
  holdSecondsAfter: number;
  aimGeometry: CaptureCameraPathAimGeometryV3;
  splineControls: CaptureCameraPathSplineControlsV3;
}

export interface CaptureCameraPathSegmentV3 {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  enabled: boolean;
  hidden: boolean;
  transitionSeconds: number;
  timeCurve: CaptureCameraPathTimeCurveV3;
  pathFairing: CaptureCameraPathFairingV3;
}

export interface CaptureCameraPathV3 {
  version: 3;
  id: string;
  name: string;
  loop: boolean;
  timeline: {
    durationSeconds: number;
  };
  displayOptions: CaptureCameraPathDisplayOptionsV2;
  equationOverlayOptions: CaptureCameraPathEquationOverlayOptionsV3;
  focusPoints: CaptureCameraPathFocusPointV2[];
  nodes: CaptureCameraPathNodeV3[];
  segments: CaptureCameraPathSegmentV3[];
}

export interface CaptureCameraPathV3TimelineEntry {
  kind: "hold" | "transition";
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  nodeId?: string;
  segmentId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  timeCurve?: CaptureCameraPathTimeCurveV3;
  continuity?: CaptureCameraPathContinuityV3;
  focusMode?: CaptureCameraPathAimModeV3;
  equationVisible?: boolean;
}

export interface CaptureCameraPathV3Timeline {
  durationSeconds: number;
  entries: CaptureCameraPathV3TimelineEntry[];
  nodeTimeSeconds: Record<string, number>;
  activeNodeIds: string[];
  activeSegmentIds: string[];
}

export interface CaptureCameraPathV3Sample {
  timeSeconds: number;
  position: CaptureVec3;
  target: CaptureVec3;
  up: CaptureVec3;
  fov: number;
}

export interface CaptureCameraPathBezierSegmentV3 {
  segmentId: string;
  p0: CaptureVec3;
  p1: CaptureVec3;
  p2: CaptureVec3;
  p3: CaptureVec3;
  diagnostics: {
    requestedContinuity: CaptureCameraPathContinuityV3;
    effectiveContinuity: CaptureCameraPathContinuityV3;
    loopbackGuardApplied: boolean;
    derivativeGuardApplied: boolean;
    envelopeGuardApplied: boolean;
    fallbackApplied: boolean;
    continuity: CaptureCameraPathContinuityV3;
    fromHandleLength: number;
    toHandleLength: number;
    warnings: string[];
  };
}

const DEFAULT_TIME_CURVE_V3: CaptureCameraPathTimeCurveV3 = { mode: "linear" };
const DEFAULT_FAIRING_V3: CaptureCameraPathFairingV3 = {
  continuity: "G1",
  tension: 0.35,
  bias: 0,
  fromInfluenceOut: "auto",
  toInfluenceIn: "auto",
  autoHandles: true,
};
export const DEFAULT_CAPTURE_CAMERA_PATH_SPLINE_CONTROLS_V3: CaptureCameraPathSplineControlsV3 =
  {
    enabled: true,
    continuity: "G1",
    handleMode: "auto",
    coupling: "tangent",
    in: { mode: "auto", length: "auto" },
    out: { mode: "auto", length: "auto" },
    autoScale: 0.35,
    maxLengthRatio: 0.45,
    preventLoopback: true,
  };
export const DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3: CaptureCameraPathEquationOverlayOptionsV3 =
  {
    visible: false,
    selectedTransitionOnly: true,
    showStackLabels: true,
    showTemporalRamp: true,
    showTangents: true,
    showInfluenceHandles: true,
    showCurvatureComb: true,
    showFocusDistance: true,
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function vec3(value: unknown): value is CaptureVec3 {
  return Array.isArray(value) && value.length === 3 && value.every(finiteNumber);
}

function cloneVec3(value: CaptureVec3): CaptureVec3 {
  return [value[0], value[1], value[2]];
}

function fallbackVec3(value: unknown, fallback: CaptureVec3): CaptureVec3 {
  return vec3(value) ? cloneVec3(value) : cloneVec3(fallback);
}

function addVec3(a: CaptureVec3, b: CaptureVec3): CaptureVec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subVec3(a: CaptureVec3, b: CaptureVec3): CaptureVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scaleVec3(value: CaptureVec3, scale: number): CaptureVec3 {
  return [value[0] * scale, value[1] * scale, value[2] * scale];
}

function lengthVec3(value: CaptureVec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalizeVec3(value: CaptureVec3): CaptureVec3 | null {
  const length = lengthVec3(value);
  if (length <= 0.000_001) return null;
  return scaleVec3(value, 1 / length);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: CaptureVec3, b: CaptureVec3, t: number): CaptureVec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function safeSeconds(value: unknown): number {
  return finiteNumber(value) ? Math.max(0, value) : 0;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (!finiteNumber(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function safeFov(value: unknown): number {
  return finiteNumber(value) && value > 0 && value <= 180 ? value : 50;
}

function normalizeNodeKind(value: unknown): CaptureCameraPathNodeKindV2 {
  return value === "transition" ? "transition" : "keyframe";
}

function normalizeTimeCurve(value: unknown): CaptureCameraPathTimeCurveV3 {
  const record = isRecord(value) ? value : {};
  const mode: CaptureCameraPathTimeCurveModeV3 =
    record.mode === "ease-in" ||
    record.mode === "ease-out" ||
    record.mode === "ease-in-out" ||
    record.mode === "custom-ramp"
      ? record.mode
      : "linear";
  if (mode !== "custom-ramp") return { mode };
  const ramp = Array.isArray(record.ramp)
    ? record.ramp
        .filter((point) => isRecord(point))
        .map((point) => ({
          t: clampNumber(point.t, 0, 0, 1),
          value: clampNumber(point.value, 0, 0, 1),
        }))
    : undefined;
  return { mode, ...(ramp ? { ramp } : {}) };
}

function normalizeFairing(value: unknown): CaptureCameraPathFairingV3 {
  const record = isRecord(value) ? value : {};
  const continuity: CaptureCameraPathContinuityV3 =
    record.continuity === "G0" ||
    record.continuity === "G2" ||
    record.continuity === "G3"
      ? record.continuity
      : "G1";
  const influenceValue = (candidate: unknown): number | "auto" =>
    candidate === "auto" ? "auto" : clampNumber(candidate, 0, 0, 1_000_000);
  return {
    continuity,
    tension: clampNumber(record.tension, DEFAULT_FAIRING_V3.tension, 0, 1),
    bias: clampNumber(record.bias, 0, -1, 1),
    fromInfluenceOut: influenceValue(record.fromInfluenceOut),
    toInfluenceIn: influenceValue(record.toInfluenceIn),
    autoHandles: record.autoHandles !== false,
  };
}

function negateVec3(value: CaptureVec3): CaptureVec3 {
  return [-value[0], -value[1], -value[2]];
}

function dotVec3(a: CaptureVec3, b: CaptureVec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function axisDelta(axis: CaptureCameraPathSplineAxisV3, delta: number): CaptureVec3 {
  if (axis === "x") return [delta, 0, 0];
  if (axis === "y") return [0, delta, 0];
  return [0, 0, delta];
}

function continuityRank(value: CaptureCameraPathContinuityV3): number {
  switch (value) {
    case "G3":
      return 3;
    case "G2":
      return 2;
    case "G1":
      return 1;
    case "G0":
    default:
      return 0;
  }
}

function maxContinuity(
  a: CaptureCameraPathContinuityV3,
  b: CaptureCameraPathContinuityV3,
): CaptureCameraPathContinuityV3 {
  return continuityRank(a) >= continuityRank(b) ? a : b;
}

function safeSplineCoupling(value: unknown): CaptureCameraPathSplineCouplingV3 {
  return value === "non-tangent" ? "non-tangent" : "tangent";
}

function safeSplineHandleMode(value: unknown): CaptureCameraPathSplineHandleModeV3 {
  if (value === "manual" || value === "vector") return value;
  return "auto";
}

function adjacentSegmentsForNode(
  nodes: Pick<CaptureCameraPathNodeV3, "id" | "position">[],
  segments: CaptureCameraPathSegmentV3[],
  nodeId: string,
): {
  previousNode?: Pick<CaptureCameraPathNodeV3, "id" | "position">;
  nextNode?: Pick<CaptureCameraPathNodeV3, "id" | "position">;
  incomingSegment?: CaptureCameraPathSegmentV3;
  outgoingSegment?: CaptureCameraPathSegmentV3;
} {
  const incomingSegment = [...segments].reverse().find((segment) => segment.toNodeId === nodeId);
  const outgoingSegment = segments.find((segment) => segment.fromNodeId === nodeId);
  return {
    incomingSegment,
    outgoingSegment,
    previousNode: incomingSegment
      ? nodes.find((candidate) => candidate.id === incomingSegment.fromNodeId)
      : undefined,
    nextNode: outgoingSegment
      ? nodes.find((candidate) => candidate.id === outgoingSegment.toNodeId)
      : undefined,
  };
}

function autoTangentDirections({
  node,
  previous,
  next,
  coupling,
}: {
  node: Pick<CaptureCameraPathNodeV3, "position">;
  previous?: Pick<CaptureCameraPathNodeV3, "position">;
  next?: Pick<CaptureCameraPathNodeV3, "position">;
  coupling: CaptureCameraPathSplineCouplingV3;
}): { inDirection: CaptureVec3; outDirection: CaptureVec3 } {
  const inDirection =
    previous ? normalizeVec3(subVec3(previous.position, node.position)) : null;
  const outDirection = next ? normalizeVec3(subVec3(next.position, node.position)) : null;
  if (coupling === "tangent") {
    const travel =
      previous && next
        ? normalizeVec3(subVec3(next.position, previous.position))
        : outDirection ?? (inDirection ? negateVec3(inDirection) : null);
    const safeTravel = travel ?? [1, 0, 0];
    return { inDirection: negateVec3(safeTravel), outDirection: safeTravel };
  }
  return {
    inDirection: inDirection ?? (outDirection ? negateVec3(outDirection) : [-1, 0, 0]),
    outDirection: outDirection ?? (inDirection ? negateVec3(inDirection) : [1, 0, 0]),
  };
}

function autoHandleLength(
  adjacentLength: number,
  controls: Pick<CaptureCameraPathSplineControlsV3, "autoScale" | "maxLengthRatio">,
): number {
  const chord = Math.max(0.000_001, adjacentLength);
  return Math.min(chord * controls.maxLengthRatio, chord * controls.autoScale);
}

function sideHandleRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeSplineSideHandle(
  value: unknown,
  fallbackDirection: CaptureVec3,
  fallbackLength: number,
  nodePosition: CaptureVec3,
): CaptureCameraPathSplineSideHandleV3 {
  const record = sideHandleRecord(value);
  const mode = record.mode === "manual" ? "manual" : "auto";
  const length =
    record.length === "auto"
      ? "auto"
      : finiteNumber(record.length)
        ? Math.max(0, record.length)
        : "auto";
  const direction = normalizeVec3(fallbackVec3(record.direction, fallbackDirection)) ??
    fallbackDirection;
  const resolvedLength = length === "auto" ? fallbackLength : length;
  const position = vec3(record.position)
    ? cloneVec3(record.position)
    : addVec3(nodePosition, scaleVec3(direction, resolvedLength));
  return {
    mode,
    length,
    direction,
    position,
  };
}

function nodeContinuityFromSegments(
  incomingSegment?: CaptureCameraPathSegmentV3,
  outgoingSegment?: CaptureCameraPathSegmentV3,
): CaptureCameraPathContinuityV3 {
  const incoming = incomingSegment?.pathFairing.continuity ?? "G1";
  const outgoing = outgoingSegment?.pathFairing.continuity ?? "G1";
  return maxContinuity(incoming, outgoing);
}

function influenceFromSegment(
  segment: CaptureCameraPathSegmentV3 | undefined,
  edge: "from" | "to",
): number | "auto" {
  if (!segment) return "auto";
  return edge === "from"
    ? segment.pathFairing.fromInfluenceOut
    : segment.pathFairing.toInfluenceIn;
}

function defaultSplineControlsFromSegments({
  node,
  previousNode,
  nextNode,
  incomingSegment,
  outgoingSegment,
}: {
  node: Pick<CaptureCameraPathNodeV3, "position">;
  previousNode?: Pick<CaptureCameraPathNodeV3, "position">;
  nextNode?: Pick<CaptureCameraPathNodeV3, "position">;
  incomingSegment?: CaptureCameraPathSegmentV3;
  outgoingSegment?: CaptureCameraPathSegmentV3;
}): CaptureCameraPathSplineControlsV3 {
  const controls = { ...DEFAULT_CAPTURE_CAMERA_PATH_SPLINE_CONTROLS_V3 };
  const continuity = nodeContinuityFromSegments(incomingSegment, outgoingSegment);
  const coupling: CaptureCameraPathSplineCouplingV3 =
    continuity === "G0" ? "non-tangent" : controls.coupling;
  const directions = autoTangentDirections({ node, previous: previousNode, next: nextNode, coupling });
  const incomingLength = previousNode
    ? lengthVec3(subVec3(previousNode.position, node.position))
    : nextNode
      ? lengthVec3(subVec3(nextNode.position, node.position))
      : 1;
  const outgoingLength = nextNode
    ? lengthVec3(subVec3(nextNode.position, node.position))
    : incomingLength;
  const inInfluence = influenceFromSegment(incomingSegment, "to");
  const outInfluence = influenceFromSegment(outgoingSegment, "from");
  const inLength =
    inInfluence === "auto" ? autoHandleLength(incomingLength, controls) : inInfluence;
  const outLength =
    outInfluence === "auto" ? autoHandleLength(outgoingLength, controls) : outInfluence;
  return {
    ...controls,
    continuity,
    handleMode: continuity === "G0" ? "vector" : controls.handleMode,
    coupling,
    in: {
      mode: "auto",
      length: inInfluence,
      direction: directions.inDirection,
      position: addVec3(node.position, scaleVec3(directions.inDirection, inLength)),
    },
    out: {
      mode: "auto",
      length: outInfluence,
      direction: directions.outDirection,
      position: addVec3(node.position, scaleVec3(directions.outDirection, outLength)),
    },
  };
}

export function normalizeCaptureCameraPathSplineControlsV3(
  input: unknown,
  node: Pick<CaptureCameraPathNodeV3, "position">,
  neighbors: {
    previousNode?: Pick<CaptureCameraPathNodeV3, "position">;
    nextNode?: Pick<CaptureCameraPathNodeV3, "position">;
    incomingSegment?: CaptureCameraPathSegmentV3;
    outgoingSegment?: CaptureCameraPathSegmentV3;
  } = {},
): CaptureCameraPathSplineControlsV3 {
  const defaults = defaultSplineControlsFromSegments({
    node,
    previousNode: neighbors.previousNode,
    nextNode: neighbors.nextNode,
    incomingSegment: neighbors.incomingSegment,
    outgoingSegment: neighbors.outgoingSegment,
  });
  const record = isRecord(input) ? input : {};
  const continuity: CaptureCameraPathContinuityV3 =
    record.continuity === "G0" ||
    record.continuity === "G2" ||
    record.continuity === "G3"
      ? record.continuity
      : record.continuity === "G1"
        ? "G1"
        : defaults.continuity;
  const coupling =
    continuity === "G0" ? "non-tangent" : safeSplineCoupling(record.coupling ?? defaults.coupling);
  const autoScale = clampNumber(record.autoScale, defaults.autoScale, 0.05, 1);
  const maxLengthRatio = clampNumber(record.maxLengthRatio, defaults.maxLengthRatio, 0.05, 2);
  const baseControls = {
    ...defaults,
    enabled: record.enabled !== false,
    continuity,
    handleMode:
      continuity === "G0"
        ? "vector"
        : safeSplineHandleMode(record.handleMode ?? defaults.handleMode),
    coupling,
    autoScale,
    maxLengthRatio,
    preventLoopback:
      typeof record.preventLoopback === "boolean"
        ? record.preventLoopback
        : defaults.preventLoopback,
  };
  const directions = autoTangentDirections({
    node,
    previous: neighbors.previousNode,
    next: neighbors.nextNode,
    coupling,
  });
  const incomingLength = neighbors.previousNode
    ? lengthVec3(subVec3(neighbors.previousNode.position, node.position))
    : 1;
  const outgoingLength = neighbors.nextNode
    ? lengthVec3(subVec3(neighbors.nextNode.position, node.position))
    : incomingLength;
  const inFallbackLength = autoHandleLength(incomingLength, baseControls);
  const outFallbackLength = autoHandleLength(outgoingLength, baseControls);
  let inHandle = normalizeSplineSideHandle(
    record.in,
    directions.inDirection,
    inFallbackLength,
    node.position,
  );
  let outHandle = normalizeSplineSideHandle(
    record.out,
    directions.outDirection,
    outFallbackLength,
    node.position,
  );
  if (coupling === "tangent") {
    const manualOut = outHandle.mode === "manual";
    const manualIn = inHandle.mode === "manual";
    const source = manualOut
      ? normalizeVec3(outHandle.direction ?? directions.outDirection)
      : manualIn
        ? normalizeVec3(negateVec3(inHandle.direction ?? directions.inDirection))
        : directions.outDirection;
    const outDirection = source ?? directions.outDirection;
    const inDirection = negateVec3(outDirection);
    inHandle = {
      ...inHandle,
      direction: inDirection,
      position: addVec3(
        node.position,
        scaleVec3(
          inDirection,
          inHandle.length === "auto" ? inFallbackLength : inHandle.length,
        ),
      ),
    };
    outHandle = {
      ...outHandle,
      direction: outDirection,
      position: addVec3(
        node.position,
        scaleVec3(
          outDirection,
          outHandle.length === "auto" ? outFallbackLength : outHandle.length,
        ),
      ),
    };
  }
  return {
    ...baseControls,
    in: inHandle,
    out: outHandle,
  };
}

function normalizeAimGeometry(
  value: unknown,
  fallbackLookMode: CaptureCameraPathLookModeV2 = "free-direction",
  focusPointId?: string,
): CaptureCameraPathAimGeometryV3 {
  const record = isRecord(value) ? value : {};
  const mode: CaptureCameraPathAimModeV3 =
    record.mode === "follow-path-tangent" ||
    record.mode === "focus-point-lock" ||
    record.mode === "target-blend"
      ? record.mode
      : fallbackLookMode === "follow-path-tangent" ||
          fallbackLookMode === "focus-point-lock"
        ? fallbackLookMode
        : "free-direction";
  const lensMode: CaptureCameraPathLensModeV3 =
    record.lensMode === "maintain-focus-size" || record.lensMode === "dolly-zoom"
      ? record.lensMode
      : "fixed-fov";
  const targetBlend = isRecord(record.targetBlend)
    ? {
        ...(typeof record.targetBlend.fromNodeId === "string"
          ? { fromNodeId: record.targetBlend.fromNodeId }
          : {}),
        ...(typeof record.targetBlend.toNodeId === "string"
          ? { toNodeId: record.targetBlend.toNodeId }
          : {}),
        curve: normalizeTimeCurve(record.targetBlend.curve),
      }
    : undefined;
  return {
    mode,
    ...(typeof record.focusPointId === "string" && record.focusPointId.trim()
      ? { focusPointId: record.focusPointId }
      : focusPointId
        ? { focusPointId }
        : {}),
    ...(record.focusDistance === "auto"
      ? { focusDistance: "auto" as const }
      : finiteNumber(record.focusDistance)
        ? { focusDistance: Math.max(0, record.focusDistance) }
        : {}),
    tangentForwardDistance: clampNumber(record.tangentForwardDistance, 1, 0.1, 10_000),
    ...(targetBlend ? { targetBlend } : {}),
    lensMode,
    dollyZoomStrength: clampNumber(record.dollyZoomStrength, 0, 0, 1),
  };
}

function normalizeEquationOptions(
  value: unknown,
): CaptureCameraPathEquationOverlayOptionsV3 {
  const record = isRecord(value) ? value : {};
  return {
    visible:
      typeof record.visible === "boolean"
        ? record.visible
        : DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3.visible,
    selectedTransitionOnly:
      typeof record.selectedTransitionOnly === "boolean"
        ? record.selectedTransitionOnly
        : DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3.selectedTransitionOnly,
    showStackLabels:
      typeof record.showStackLabels === "boolean"
        ? record.showStackLabels
        : DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3.showStackLabels,
    showTemporalRamp:
      typeof record.showTemporalRamp === "boolean"
        ? record.showTemporalRamp
        : DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3.showTemporalRamp,
    showTangents:
      typeof record.showTangents === "boolean"
        ? record.showTangents
        : DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3.showTangents,
    showInfluenceHandles:
      typeof record.showInfluenceHandles === "boolean"
        ? record.showInfluenceHandles
        : DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3.showInfluenceHandles,
    showCurvatureComb:
      typeof record.showCurvatureComb === "boolean"
        ? record.showCurvatureComb
        : DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3.showCurvatureComb,
    showFocusDistance:
      typeof record.showFocusDistance === "boolean"
        ? record.showFocusDistance
        : DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3.showFocusDistance,
  };
}

export function normalizeCaptureCameraPathV3(
  inputPath: Partial<CaptureCameraPathV3>,
): CaptureCameraPathV3 {
  const source = isRecord(inputPath) ? inputPath : {};
  const displayOptions = normalizeCaptureCameraPathDisplayOptionsV2(
    source.displayOptions,
  );
  const focusPoints = (Array.isArray(source.focusPoints) ? source.focusPoints : []).map(
    (point, index) => {
      const record: Record<string, unknown> = isRecord(point) ? point : {};
      return {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id
            : `focus-${String(index + 1).padStart(2, "0")}`,
        ...(typeof record.label === "string" && record.label.trim()
          ? { label: record.label.trim() }
          : {}),
        position: fallbackVec3(record.position, [0, 0, 0]),
        ...(typeof record.picked === "boolean" ? { picked: record.picked } : {}),
      };
    },
  );
  const rawNodes = Array.isArray(source.nodes) ? source.nodes : [];
  const baseNodes = rawNodes.map((node, index) => {
    const record: Record<string, unknown> = isRecord(node) ? node : {};
    const kind = normalizeNodeKind(record.kind);
    const lookMode =
      record.lookMode === "follow-path-tangent" ||
      record.lookMode === "focus-point-lock"
        ? record.lookMode
        : "free-direction";
    const focusPointId =
      typeof record.focusPointId === "string" && record.focusPointId.trim()
        ? record.focusPointId
        : undefined;
    return {
      id:
        typeof record.id === "string" && record.id.trim()
          ? record.id
          : captureCameraPathV2NodeId(index),
      kind,
      enabled: record.enabled !== false,
      hidden: record.hidden === true,
      ...(typeof record.label === "string" && record.label.trim()
        ? { label: record.label.trim() }
        : {}),
      timeSeconds: 0,
      position: fallbackVec3(record.position, [0, 0, 0]),
      ...(vec3(record.target) ? { target: cloneVec3(record.target) } : {}),
      up: fallbackVec3(record.up, [0, 0, 1]),
      fov: safeFov(record.fov),
      holdSecondsAfter: kind === "transition" ? 0 : safeSeconds(record.holdSecondsAfter),
      aimGeometry: normalizeAimGeometry(record.aimGeometry, lookMode, focusPointId),
      splineControls: DEFAULT_CAPTURE_CAMERA_PATH_SPLINE_CONTROLS_V3,
    };
  });
  const rawSegments = Array.isArray(source.segments) ? source.segments : [];
  const segments =
    rawSegments.length > 0
      ? rawSegments.map((segment, index) => {
          const record: Record<string, unknown> = isRecord(segment) ? segment : {};
          const fromNodeId =
            typeof record.fromNodeId === "string" && record.fromNodeId.trim()
              ? record.fromNodeId
              : baseNodes[index]?.id ?? "";
          const toNodeId =
            typeof record.toNodeId === "string" && record.toNodeId.trim()
              ? record.toNodeId
              : baseNodes[index + 1]?.id ?? "";
          return {
            id:
              typeof record.id === "string" && record.id.trim()
                ? record.id
                : captureCameraPathV2SegmentId(fromNodeId, toNodeId),
            fromNodeId,
            toNodeId,
            enabled: record.enabled !== false,
            hidden: record.hidden === true,
            transitionSeconds: safeSeconds(record.transitionSeconds),
            timeCurve: normalizeTimeCurve(record.timeCurve ?? { mode: record.easing }),
            pathFairing: normalizeFairing(record.pathFairing),
          };
        })
      : baseNodes.slice(0, -1).map((node, index) => ({
          id: captureCameraPathV2SegmentId(node.id, baseNodes[index + 1].id),
          fromNodeId: node.id,
          toNodeId: baseNodes[index + 1].id,
          enabled: true,
          hidden: false,
          transitionSeconds: 1,
          timeCurve: { ...DEFAULT_TIME_CURVE_V3 },
          pathFairing: { ...DEFAULT_FAIRING_V3 },
        }));
  const nodes = baseNodes.map((node) => {
    const rawNode = rawNodes.find((candidate) => isRecord(candidate) && candidate.id === node.id);
    const record: Record<string, unknown> = isRecord(rawNode) ? rawNode : {};
    return {
      ...node,
      splineControls: normalizeCaptureCameraPathSplineControlsV3(
        record.splineControls,
        node,
        adjacentSegmentsForNode(baseNodes, segments, node.id),
      ),
    };
  });

  let cursor = 0;
  const nodeTimeSeconds = new Map<string, number>();
  for (const segment of segments) {
    const from = nodes.find((node) => node.id === segment.fromNodeId);
    const to = nodes.find((node) => node.id === segment.toNodeId);
    if (!from || !to) continue;
    if (!nodeTimeSeconds.has(from.id)) nodeTimeSeconds.set(from.id, cursor);
    cursor += from.holdSecondsAfter;
    cursor += segment.transitionSeconds;
    nodeTimeSeconds.set(to.id, cursor);
  }
  const terminalId = segments[segments.length - 1]?.toNodeId ?? nodes[0]?.id ?? null;
  const terminal = terminalId ? nodes.find((node) => node.id === terminalId) : null;
  if (terminal) cursor += terminal.holdSecondsAfter;
  const sourceDuration = (source.timeline as { durationSeconds?: unknown } | undefined)
    ?.durationSeconds;
  const durationSeconds = Math.max(
    0,
    Math.min(600, finiteNumber(sourceDuration) ? Math.max(cursor, sourceDuration) : cursor),
  );
  return {
    version: 3,
    id:
      typeof source.id === "string" && source.id.trim()
        ? source.id
        : "capture-camera-path-v3",
    name:
      typeof source.name === "string" && source.name.trim()
        ? source.name
        : "Camera Path v3",
    loop: source.loop === true,
    timeline: { durationSeconds },
    displayOptions,
    equationOverlayOptions: normalizeEquationOptions(source.equationOverlayOptions),
    focusPoints,
    nodes: nodes.map((node) => ({
      ...node,
      timeSeconds: nodeTimeSeconds.get(node.id) ?? 0,
    })),
    segments,
  };
}

function validateTimeCurve(
  curve: unknown,
  label: string,
  errors: string[],
): void {
  if (!isRecord(curve)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (
    curve.mode !== "linear" &&
    curve.mode !== "ease-in" &&
    curve.mode !== "ease-out" &&
    curve.mode !== "ease-in-out" &&
    curve.mode !== "custom-ramp"
  ) {
    errors.push(`${label}.mode is not supported.`);
  }
  if (curve.mode !== "custom-ramp") return;
  if (!Array.isArray(curve.ramp) || curve.ramp.length < 2) {
    errors.push(`${label}.ramp must contain at least two points.`);
    return;
  }
  let previousT = -Infinity;
  let previousValue = -Infinity;
  curve.ramp.forEach((point, index) => {
    if (!isRecord(point) || !finiteNumber(point.t) || !finiteNumber(point.value)) {
      errors.push(`${label}.ramp[${index}] must contain finite t and value.`);
      return;
    }
    if (point.t < 0 || point.t > 1 || point.value < 0 || point.value > 1) {
      errors.push(`${label}.ramp[${index}] values must be between 0 and 1.`);
    }
    if (point.t <= previousT || point.value < previousValue) {
      errors.push(`${label}.ramp must be monotonic in t and value.`);
    }
    previousT = point.t;
    previousValue = point.value;
  });
  const first = curve.ramp[0];
  const last = curve.ramp[curve.ramp.length - 1];
  if (!isRecord(first) || first.t !== 0 || first.value !== 0) {
    errors.push(`${label}.ramp must start at { t: 0, value: 0 }.`);
  }
  if (!isRecord(last) || last.t !== 1 || last.value !== 1) {
    errors.push(`${label}.ramp must end at { t: 1, value: 1 }.`);
  }
}

function validateFairing(
  fairing: unknown,
  label: string,
  errors: string[],
): void {
  if (!isRecord(fairing)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (
    fairing.continuity !== "G0" &&
    fairing.continuity !== "G1" &&
    fairing.continuity !== "G2" &&
    fairing.continuity !== "G3"
  ) {
    errors.push(`${label}.continuity is not supported.`);
  }
  if (!finiteNumber(fairing.tension) || fairing.tension < 0 || fairing.tension > 1) {
    errors.push(`${label}.tension must be between 0 and 1.`);
  }
  if (!finiteNumber(fairing.bias) || fairing.bias < -1 || fairing.bias > 1) {
    errors.push(`${label}.bias must be between -1 and 1.`);
  }
  for (const field of ["fromInfluenceOut", "toInfluenceIn"] as const) {
    const value = fairing[field];
    if (value !== "auto" && (!finiteNumber(value) || value < 0)) {
      errors.push(`${label}.${field} must be auto or a non-negative number.`);
    }
  }
  if (typeof fairing.autoHandles !== "boolean") {
    errors.push(`${label}.autoHandles must be boolean.`);
  }
}

function validateAimGeometry(
  aim: unknown,
  label: string,
  focusIds: Set<string>,
  errors: string[],
): void {
  if (!isRecord(aim)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (
    aim.mode !== "free-direction" &&
    aim.mode !== "follow-path-tangent" &&
    aim.mode !== "focus-point-lock" &&
    aim.mode !== "target-blend"
  ) {
    errors.push(`${label}.mode is not supported.`);
  }
  if (aim.mode === "focus-point-lock") {
    if (typeof aim.focusPointId !== "string" || !focusIds.has(aim.focusPointId)) {
      errors.push(`${label}.focusPointId must reference a focus point.`);
    }
  }
  if (aim.focusDistance !== undefined && aim.focusDistance !== "auto") {
    if (!finiteNumber(aim.focusDistance) || aim.focusDistance < 0) {
      errors.push(`${label}.focusDistance must be auto or non-negative.`);
    }
  }
  if (
    aim.tangentForwardDistance !== undefined &&
    (!finiteNumber(aim.tangentForwardDistance) || aim.tangentForwardDistance <= 0)
  ) {
    errors.push(`${label}.tangentForwardDistance must be greater than zero.`);
  }
  if (
    aim.lensMode !== "fixed-fov" &&
    aim.lensMode !== "maintain-focus-size" &&
    aim.lensMode !== "dolly-zoom"
  ) {
    errors.push(`${label}.lensMode is not supported.`);
  }
  if (
    aim.dollyZoomStrength !== undefined &&
    (!finiteNumber(aim.dollyZoomStrength) ||
      aim.dollyZoomStrength < 0 ||
      aim.dollyZoomStrength > 1)
  ) {
    errors.push(`${label}.dollyZoomStrength must be between 0 and 1.`);
  }
  if (isRecord(aim.targetBlend)) {
    validateTimeCurve(aim.targetBlend.curve, `${label}.targetBlend.curve`, errors);
  }
}

function validateSplineControls(
  controls: unknown,
  label: string,
  errors: string[],
): void {
  if (!isRecord(controls)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  if (typeof controls.enabled !== "boolean") {
    errors.push(`${label}.enabled must be boolean.`);
  }
  if (
    controls.continuity !== "G0" &&
    controls.continuity !== "G1" &&
    controls.continuity !== "G2" &&
    controls.continuity !== "G3"
  ) {
    errors.push(`${label}.continuity is not supported.`);
  }
  if (
    controls.handleMode !== "auto" &&
    controls.handleMode !== "manual" &&
    controls.handleMode !== "vector"
  ) {
    errors.push(`${label}.handleMode is not supported.`);
  }
  if (controls.coupling !== "tangent" && controls.coupling !== "non-tangent") {
    errors.push(`${label}.coupling must be tangent or non-tangent.`);
  }
  for (const side of ["in", "out"] as const) {
    const handle = controls[side];
    if (!isRecord(handle)) {
      errors.push(`${label}.${side} must be an object.`);
      continue;
    }
    if (handle.mode !== "auto" && handle.mode !== "manual") {
      errors.push(`${label}.${side}.mode must be auto or manual.`);
    }
    if (handle.length !== "auto" && (!finiteNumber(handle.length) || handle.length < 0)) {
      errors.push(`${label}.${side}.length must be auto or non-negative.`);
    }
    if (handle.direction !== undefined && !vec3(handle.direction)) {
      errors.push(`${label}.${side}.direction must be a valid vec3.`);
    }
    if (handle.position !== undefined && !vec3(handle.position)) {
      errors.push(`${label}.${side}.position must be a valid vec3.`);
    }
  }
  if (!finiteNumber(controls.autoScale) || controls.autoScale <= 0 || controls.autoScale > 1) {
    errors.push(`${label}.autoScale must be between 0 and 1.`);
  }
  if (
    !finiteNumber(controls.maxLengthRatio) ||
    controls.maxLengthRatio <= 0 ||
    controls.maxLengthRatio > 2
  ) {
    errors.push(`${label}.maxLengthRatio must be between 0 and 2.`);
  }
  if (typeof controls.preventLoopback !== "boolean") {
    errors.push(`${label}.preventLoopback must be boolean.`);
  }
}

export function validateCaptureCameraPathV3(
  path: Partial<CaptureCameraPathV3> | null | undefined,
): CaptureCameraPathV2ValidationResult {
  const errors: string[] = [];
  if (!path || !isRecord(path)) {
    return { valid: false, errors: ["cameraPathV3 is missing."] };
  }
  if (path.version !== 3) errors.push("cameraPathV3.version must be 3.");
  if (typeof path.id !== "string" || path.id.trim() === "") {
    errors.push("cameraPathV3.id is required.");
  }
  if (typeof path.name !== "string" || path.name.trim() === "") {
    errors.push("cameraPathV3.name is required.");
  }
  if (typeof path.loop !== "boolean") errors.push("cameraPathV3.loop must be boolean.");
  if (path.displayOptions !== undefined) {
    errors.push(...validateCaptureCameraPathDisplayOptionsV2(path.displayOptions).errors);
  }
  const focusIds = new Set<string>();
  if (!Array.isArray(path.focusPoints)) {
    errors.push("cameraPathV3.focusPoints must be an array.");
  } else {
    path.focusPoints.forEach((point, index) => {
      if (!isRecord(point)) {
        errors.push(`cameraPathV3.focusPoints[${index}] must be an object.`);
        return;
      }
      if (typeof point.id !== "string" || point.id.trim() === "") {
        errors.push(`cameraPathV3.focusPoints[${index}].id is required.`);
      } else if (focusIds.has(point.id)) {
        errors.push(`cameraPathV3 duplicate focus point id: ${point.id}.`);
      } else {
        focusIds.add(point.id);
      }
      if (!vec3(point.position)) {
        errors.push(`cameraPathV3.focusPoints[${index}].position must be a valid vec3.`);
      }
    });
  }
  const nodeIds = new Set<string>();
  if (!Array.isArray(path.nodes)) {
    errors.push("cameraPathV3.nodes must be an array.");
  } else {
    path.nodes.forEach((node, index) => {
      if (!isRecord(node)) {
        errors.push(`cameraPathV3.nodes[${index}] must be an object.`);
        return;
      }
      if (typeof node.id !== "string" || node.id.trim() === "") {
        errors.push(`cameraPathV3.nodes[${index}].id is required.`);
      } else if (nodeIds.has(node.id)) {
        errors.push(`cameraPathV3 duplicate node id: ${node.id}.`);
      } else {
        nodeIds.add(node.id);
      }
      if (node.kind !== "keyframe" && node.kind !== "transition") {
        errors.push(`cameraPathV3.nodes[${index}].kind is not supported.`);
      }
      if (node.enabled !== undefined && typeof node.enabled !== "boolean") {
        errors.push(`cameraPathV3.nodes[${index}].enabled must be boolean.`);
      }
      if (node.hidden !== undefined && typeof node.hidden !== "boolean") {
        errors.push(`cameraPathV3.nodes[${index}].hidden must be boolean.`);
      }
      if (!vec3(node.position)) {
        errors.push(`cameraPathV3.nodes[${index}].position must be a valid vec3.`);
      }
      if (node.target !== undefined && !vec3(node.target)) {
        errors.push(`cameraPathV3.nodes[${index}].target must be a valid vec3.`);
      }
      if (!vec3(node.up)) {
        errors.push(`cameraPathV3.nodes[${index}].up must be a valid vec3.`);
      }
      if (!finiteNumber(node.fov) || node.fov <= 0 || node.fov > 180) {
        errors.push(`cameraPathV3.nodes[${index}].fov must be between 0 and 180.`);
      }
      if (!finiteNumber(node.holdSecondsAfter) || node.holdSecondsAfter < 0) {
        errors.push(
          `cameraPathV3.nodes[${index}].holdSecondsAfter must be non-negative.`,
        );
      }
      if (node.kind === "transition" && node.holdSecondsAfter !== 0) {
        errors.push(`cameraPathV3.nodes[${index}] transition nodes cannot hold.`);
      }
      validateAimGeometry(
        node.aimGeometry,
        `cameraPathV3.nodes[${index}].aimGeometry`,
        focusIds,
        errors,
      );
      validateSplineControls(
        node.splineControls,
        `cameraPathV3.nodes[${index}].splineControls`,
        errors,
      );
    });
  }
  const segmentIds = new Set<string>();
  if (!Array.isArray(path.segments)) {
    errors.push("cameraPathV3.segments must be an array.");
  } else {
    path.segments.forEach((segment, index) => {
      if (!isRecord(segment)) {
        errors.push(`cameraPathV3.segments[${index}] must be an object.`);
        return;
      }
      if (typeof segment.id !== "string" || segment.id.trim() === "") {
        errors.push(`cameraPathV3.segments[${index}].id is required.`);
      } else if (segmentIds.has(segment.id)) {
        errors.push(`cameraPathV3 duplicate segment id: ${segment.id}.`);
      } else {
        segmentIds.add(segment.id);
      }
      if (typeof segment.fromNodeId !== "string" || !nodeIds.has(segment.fromNodeId)) {
        errors.push(`cameraPathV3.segments[${index}].fromNodeId must reference a node.`);
      }
      if (typeof segment.toNodeId !== "string" || !nodeIds.has(segment.toNodeId)) {
        errors.push(`cameraPathV3.segments[${index}].toNodeId must reference a node.`);
      }
      if (segment.enabled !== undefined && typeof segment.enabled !== "boolean") {
        errors.push(`cameraPathV3.segments[${index}].enabled must be boolean.`);
      }
      if (segment.hidden !== undefined && typeof segment.hidden !== "boolean") {
        errors.push(`cameraPathV3.segments[${index}].hidden must be boolean.`);
      }
      if (!finiteNumber(segment.transitionSeconds) || segment.transitionSeconds < 0) {
        errors.push(
          `cameraPathV3.segments[${index}].transitionSeconds must be non-negative.`,
        );
      }
      validateTimeCurve(segment.timeCurve, `cameraPathV3.segments[${index}].timeCurve`, errors);
      validateFairing(
        segment.pathFairing,
        `cameraPathV3.segments[${index}].pathFairing`,
        errors,
      );
    });
  }
  return { valid: errors.length === 0, errors };
}

function nodeById(path: CaptureCameraPathV3): Map<string, CaptureCameraPathNodeV3> {
  return new Map(path.nodes.map((node) => [node.id, node]));
}

function enabledPathForSampling(inputPath: CaptureCameraPathV3): CaptureCameraPathV3 {
  const path = normalizeCaptureCameraPathV3(inputPath);
  const nodes = path.nodes.filter((node) => node.enabled !== false);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const segments = path.segments.filter(
    (segment) =>
      segment.enabled !== false &&
      nodeIds.has(segment.fromNodeId) &&
      nodeIds.has(segment.toNodeId),
  );
  return normalizeCaptureCameraPathV3({ ...path, nodes, segments });
}

export function captureCameraPathV3Renderable(inputPath: CaptureCameraPathV3): boolean {
  const path = enabledPathForSampling(inputPath);
  return path.nodes.length >= 2 && resolveCaptureCameraPathV3Timeline(path).durationSeconds > 0;
}

export function validateCaptureCameraPathV3Playback(
  inputPath: CaptureCameraPathV3,
): CaptureCameraPathV2ValidationResult {
  const validation = validateCaptureCameraPathV3(inputPath);
  const errors = [...validation.errors];
  const path = enabledPathForSampling(inputPath);
  if (path.nodes.length < 2) {
    errors.push("Add at least two active camera views before playing the path.");
  }
  if (path.nodes.length >= 2 && path.segments.length === 0) {
    errors.push("Enable at least one transition between active camera views.");
  }
  if (resolveCaptureCameraPathV3Timeline(path).durationSeconds <= 0) {
    errors.push("Camera path duration must be greater than zero.");
  }
  return { valid: errors.length === 0, errors };
}

export function upgradeSegmentFairingToNodeSplineControls(
  inputPath: CaptureCameraPathV3,
): CaptureCameraPathV3 {
  return normalizeCaptureCameraPathV3({
    ...inputPath,
    nodes: inputPath.nodes.map((node) => {
      const incomingSegment = inputPath.segments.find(
        (segment) => segment.toNodeId === node.id,
      );
      const outgoingSegment = inputPath.segments.find(
        (segment) => segment.fromNodeId === node.id,
      );
      return {
        ...node,
        splineControls: {
          ...node.splineControls,
          continuity: nodeContinuityFromSegments(incomingSegment, outgoingSegment),
        },
      };
    }),
  });
}

function updateNodeSplineControls(
  inputPath: CaptureCameraPathV3,
  nodeId: string,
  updater: (
    controls: CaptureCameraPathSplineControlsV3,
    node: CaptureCameraPathNodeV3,
  ) => CaptureCameraPathSplineControlsV3,
): CaptureCameraPathV3 {
  const path = normalizeCaptureCameraPathV3(inputPath);
  return normalizeCaptureCameraPathV3({
    ...path,
    nodes: path.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            splineControls: updater(node.splineControls, node),
          }
        : node,
    ),
  });
}

export function setCaptureCameraPathNodeSplineCoupling(
  inputPath: CaptureCameraPathV3,
  nodeId: string,
  coupling: CaptureCameraPathSplineCouplingV3,
): CaptureCameraPathV3 {
  const path = normalizeCaptureCameraPathV3(inputPath);
  return updateNodeSplineControls(inputPath, nodeId, (controls, node) =>
    normalizeCaptureCameraPathSplineControlsV3(
      {
        ...controls,
        coupling,
      },
      node,
      adjacentSegmentsForNode(path.nodes, path.segments, nodeId),
    ),
  );
}

export function setCaptureCameraPathNodeSplineHandle(
  inputPath: CaptureCameraPathV3,
  nodeId: string,
  side: CaptureCameraPathSplineHandleSideV3,
  handle: Partial<CaptureCameraPathSplineSideHandleV3>,
): CaptureCameraPathV3 {
  const path = normalizeCaptureCameraPathV3(inputPath);
  return updateNodeSplineControls(inputPath, nodeId, (controls, node) =>
    normalizeCaptureCameraPathSplineControlsV3(
      {
        ...controls,
        [side]: {
          ...controls[side],
          ...handle,
        },
      },
      node,
      adjacentSegmentsForNode(path.nodes, path.segments, nodeId),
    ),
  );
}

export function setCaptureCameraPathNodeSplineContinuity(
  inputPath: CaptureCameraPathV3,
  nodeId: string,
  continuity: CaptureCameraPathContinuityV3,
): CaptureCameraPathV3 {
  const path = normalizeCaptureCameraPathV3(inputPath);
  return updateNodeSplineControls(inputPath, nodeId, (controls, node) =>
    normalizeCaptureCameraPathSplineControlsV3(
      {
        ...controls,
        continuity,
        handleMode: continuity === "G0" ? "vector" : controls.handleMode,
      },
      node,
      adjacentSegmentsForNode(path.nodes, path.segments, nodeId),
    ),
  );
}

export function moveCaptureCameraPathSplineHandle(
  inputPath: CaptureCameraPathV3,
  nodeId: string,
  side: CaptureCameraPathSplineHandleSideV3,
  worldPosition: CaptureVec3,
): CaptureCameraPathV3 {
  const path = normalizeCaptureCameraPathV3(inputPath);
  const node = path.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return path;
  const vector = subVec3(worldPosition, node.position);
  const direction = normalizeVec3(vector) ?? node.splineControls[side].direction ?? [1, 0, 0];
  const length = lengthVec3(vector);
  const controls = node.splineControls;
  const patch: CaptureCameraPathSplineControlsV3 = {
    ...controls,
    handleMode: controls.handleMode === "vector" ? "manual" : controls.handleMode,
    [side]: {
      ...controls[side],
      mode: "manual",
      length,
      direction,
      position: cloneVec3(worldPosition),
    },
  };
  if (controls.coupling === "tangent") {
    const oppositeSide: CaptureCameraPathSplineHandleSideV3 = side === "out" ? "in" : "out";
    const oppositeDirection = negateVec3(direction);
    const oppositeLength = resolvedHandleLength(
      controls[oppositeSide],
      controls,
      length,
    );
    patch[oppositeSide] = {
      ...controls[oppositeSide],
      direction: oppositeDirection,
      position: addVec3(node.position, scaleVec3(oppositeDirection, oppositeLength)),
    };
  }
  return updateNodeSplineControls(path, nodeId, (_controls, node) =>
    normalizeCaptureCameraPathSplineControlsV3(
      patch,
      node,
      adjacentSegmentsForNode(path.nodes, path.segments, nodeId),
    ),
  );
}

export function moveCaptureCameraPathNodeAxis(
  inputPath: CaptureCameraPathV3,
  nodeId: string,
  axis: CaptureCameraPathSplineAxisV3,
  delta: number,
): CaptureCameraPathV3 {
  const path = normalizeCaptureCameraPathV3(inputPath);
  const movement = axisDelta(axis, Number.isFinite(delta) ? delta : 0);
  return normalizeCaptureCameraPathV3({
    ...path,
    nodes: path.nodes.map((node) => {
      if (node.id !== nodeId) return node;
      const translateHandle = (
        handle: CaptureCameraPathSplineSideHandleV3,
      ): CaptureCameraPathSplineSideHandleV3 => ({
        ...handle,
        ...(handle.mode === "manual" && handle.position
          ? { position: addVec3(handle.position, movement) }
          : {}),
      });
      return {
        ...node,
        position: addVec3(node.position, movement),
        splineControls: {
          ...node.splineControls,
          in: translateHandle(node.splineControls.in),
          out: translateHandle(node.splineControls.out),
        },
      };
    }),
  });
}

export function resolveCaptureCameraPathV3Timeline(
  inputPath: CaptureCameraPathV3,
): CaptureCameraPathV3Timeline {
  const path = enabledPathForSampling(inputPath);
  const nodes = nodeById(path);
  const entries: CaptureCameraPathV3TimelineEntry[] = [];
  const nodeTimeSeconds: Record<string, number> = {};
  if (path.nodes.length === 0) {
    return {
      durationSeconds: 0,
      entries,
      nodeTimeSeconds,
      activeNodeIds: [],
      activeSegmentIds: [],
    };
  }
  let cursor = 0;
  nodeTimeSeconds[path.nodes[0].id] = 0;
  for (const segment of path.segments) {
    const from = nodes.get(segment.fromNodeId);
    const to = nodes.get(segment.toNodeId);
    if (!from || !to) continue;
    if (from.holdSecondsAfter > 0) {
      entries.push({
        kind: "hold",
        nodeId: from.id,
        startSeconds: cursor,
        endSeconds: cursor + from.holdSecondsAfter,
        durationSeconds: from.holdSecondsAfter,
        focusMode: from.aimGeometry.mode,
      });
      cursor += from.holdSecondsAfter;
    }
    entries.push({
      kind: "transition",
      segmentId: segment.id,
      fromNodeId: from.id,
      toNodeId: to.id,
      startSeconds: cursor,
      endSeconds: cursor + segment.transitionSeconds,
      durationSeconds: segment.transitionSeconds,
      timeCurve: segment.timeCurve,
      continuity: segment.pathFairing.continuity,
      focusMode: from.aimGeometry.mode,
      equationVisible: path.equationOverlayOptions.visible,
    });
    cursor += segment.transitionSeconds;
    nodeTimeSeconds[to.id] = cursor;
  }
  const terminalId = path.segments[path.segments.length - 1]?.toNodeId ?? path.nodes[0].id;
  const terminal = nodes.get(terminalId) ?? path.nodes[path.nodes.length - 1];
  if (terminal?.holdSecondsAfter > 0) {
    entries.push({
      kind: "hold",
      nodeId: terminal.id,
      startSeconds: cursor,
      endSeconds: cursor + terminal.holdSecondsAfter,
      durationSeconds: terminal.holdSecondsAfter,
      focusMode: terminal.aimGeometry.mode,
    });
    cursor += terminal.holdSecondsAfter;
  }
  return {
    durationSeconds: cursor,
    entries,
    nodeTimeSeconds,
    activeNodeIds: path.nodes.map((node) => node.id),
    activeSegmentIds: path.segments.map((segment) => segment.id),
  };
}

function fallbackTarget(node: CaptureCameraPathNodeV3): CaptureVec3 {
  return node.target ? cloneVec3(node.target) : addVec3(node.position, [0, 1, 0]);
}

function focusPointPosition(path: CaptureCameraPathV3, id: string | undefined): CaptureVec3 | null {
  if (!id) return null;
  return path.focusPoints.find((point) => point.id === id)?.position ?? null;
}

function nodeTarget(path: CaptureCameraPathV3, node: CaptureCameraPathNodeV3): CaptureVec3 {
  const aim = node.aimGeometry;
  if (aim.mode === "focus-point-lock") {
    return focusPointPosition(path, aim.focusPointId) ?? fallbackTarget(node);
  }
  if (aim.mode === "follow-path-tangent") {
    return fallbackTarget(node);
  }
  return fallbackTarget(node);
}

function poseFromNode(
  path: CaptureCameraPathV3,
  node: CaptureCameraPathNodeV3,
): CaptureCameraPathV3Sample {
  return {
    timeSeconds: node.timeSeconds,
    position: cloneVec3(node.position),
    target: nodeTarget(path, node),
    up: cloneVec3(node.up),
    fov: node.fov,
  };
}

function segmentNeighbors(
  path: CaptureCameraPathV3,
  segment: CaptureCameraPathSegmentV3,
): {
  previous: CaptureVec3 | null;
  from: CaptureCameraPathNodeV3;
  to: CaptureCameraPathNodeV3;
  next: CaptureVec3 | null;
} | null {
  const nodes = nodeById(path);
  const from = nodes.get(segment.fromNodeId);
  const to = nodes.get(segment.toNodeId);
  if (!from || !to) return null;
  const previousSegment = [...path.segments]
    .reverse()
    .find((candidate) => candidate.toNodeId === from.id);
  const nextSegment = path.segments.find((candidate) => candidate.fromNodeId === to.id);
  const previous = previousSegment
    ? nodes.get(previousSegment.fromNodeId)?.position ?? null
    : null;
  const next = nextSegment ? nodes.get(nextSegment.toNodeId)?.position ?? null : null;
  return { previous, from, to, next };
}

function resolvedHandleLength(
  handle: CaptureCameraPathSplineSideHandleV3,
  controls: CaptureCameraPathSplineControlsV3,
  adjacentLength: number,
): number {
  return handle.length === "auto"
    ? autoHandleLength(adjacentLength, controls)
    : Math.max(0, handle.length);
}

function handleWorldPosition(
  node: CaptureCameraPathNodeV3,
  side: CaptureCameraPathSplineHandleSideV3,
  adjacentLength: number,
): CaptureVec3 {
  const controls = node.splineControls;
  const handle = controls[side];
  const fallback = side === "in" ? [-1, 0, 0] as CaptureVec3 : [1, 0, 0] as CaptureVec3;
  const direction =
    normalizeVec3(handle.direction ?? fallback) ?? fallback;
  const length = resolvedHandleLength(handle, controls, adjacentLength);
  if (handle.mode === "manual" && handle.position) {
    return cloneVec3(handle.position);
  }
  return addVec3(node.position, scaleVec3(direction, length));
}

function evaluateCubicBezier(
  p0: CaptureVec3,
  p1: CaptureVec3,
  p2: CaptureVec3,
  p3: CaptureVec3,
  t: number,
): CaptureVec3 {
  const inv = 1 - t;
  const a = inv * inv * inv;
  const b = 3 * inv * inv * t;
  const c = 3 * inv * t * t;
  const d = t * t * t;
  return [
    p0[0] * a + p1[0] * b + p2[0] * c + p3[0] * d,
    p0[1] * a + p1[1] * b + p2[1] * c + p3[1] * d,
    p0[2] * a + p1[2] * b + p2[2] * c + p3[2] * d,
  ];
}

function evaluateCubicBezierDerivative(
  p0: CaptureVec3,
  p1: CaptureVec3,
  p2: CaptureVec3,
  p3: CaptureVec3,
  t: number,
): CaptureVec3 {
  const inv = 1 - t;
  return [
    3 * inv * inv * (p1[0] - p0[0]) +
      6 * inv * t * (p2[0] - p1[0]) +
      3 * t * t * (p3[0] - p2[0]),
    3 * inv * inv * (p1[1] - p0[1]) +
      6 * inv * t * (p2[1] - p1[1]) +
      3 * t * t * (p3[1] - p2[1]),
    3 * inv * inv * (p1[2] - p0[2]) +
      6 * inv * t * (p2[2] - p1[2]) +
      3 * t * t * (p3[2] - p2[2]),
  ];
}

function evaluateCubicBezierSecondDerivative(
  p0: CaptureVec3,
  p1: CaptureVec3,
  p2: CaptureVec3,
  p3: CaptureVec3,
  t: number,
): CaptureVec3 {
  const inv = 1 - t;
  return [
    6 * inv * (p0[0] - 2 * p1[0] + p2[0]) +
      6 * t * (p1[0] - 2 * p2[0] + p3[0]),
    6 * inv * (p0[1] - 2 * p1[1] + p2[1]) +
      6 * t * (p1[1] - 2 * p2[1] + p3[1]),
    6 * inv * (p0[2] - 2 * p1[2] + p2[2]) +
      6 * t * (p1[2] - 2 * p2[2] + p3[2]),
  ];
}

function crossVec3(a: CaptureVec3, b: CaptureVec3): CaptureVec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function cubicBezierCurvature(
  p0: CaptureVec3,
  p1: CaptureVec3,
  p2: CaptureVec3,
  p3: CaptureVec3,
  t: number,
): number {
  const first = evaluateCubicBezierDerivative(p0, p1, p2, p3, t);
  const second = evaluateCubicBezierSecondDerivative(p0, p1, p2, p3, t);
  const speed = Math.max(0.000_001, lengthVec3(first));
  return lengthVec3(crossVec3(first, second)) / (speed * speed * speed);
}

function finiteVec3(value: CaptureVec3): boolean {
  return value.every((entry) => Number.isFinite(entry));
}

function continuityFromRank(rank: number): CaptureCameraPathContinuityV3 {
  if (rank >= 3) return "G3";
  if (rank === 2) return "G2";
  if (rank === 1) return "G1";
  return "G0";
}

function pointDistanceFromChord(
  point: CaptureVec3,
  p0: CaptureVec3,
  chordDirection: CaptureVec3,
  chordLength: number,
): number {
  const vector = subVec3(point, p0);
  const projection = Math.max(0, Math.min(chordLength, dotVec3(vector, chordDirection)));
  const closest = addVec3(p0, scaleVec3(chordDirection, projection));
  return lengthVec3(subVec3(point, closest));
}

function guardBezierControls({
  p0,
  p1,
  p2,
  p3,
  chordDirection,
  chordLength,
}: {
  p0: CaptureVec3;
  p1: CaptureVec3;
  p2: CaptureVec3;
  p3: CaptureVec3;
  chordDirection: CaptureVec3;
  chordLength: number;
}): {
  valid: boolean;
  derivativeGuardApplied: boolean;
  envelopeGuardApplied: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let derivativeGuardApplied = false;
  let envelopeGuardApplied = false;
  if (![p0, p1, p2, p3].every(finiteVec3)) {
    return {
      valid: false,
      derivativeGuardApplied: true,
      envelopeGuardApplied: true,
      warnings: ["Spline controls produced non-finite Bezier points."],
    };
  }
  const projectionTolerance = chordLength * 0.02;
  const derivativeTolerance = -chordLength * 0.002;
  const envelopeLimit = Math.max(chordLength * 0.85, 0.000_001);
  let previousProjection = 0;
  for (let index = 0; index <= 24; index += 1) {
    const t = index / 24;
    const point = evaluateCubicBezier(p0, p1, p2, p3, t);
    const derivative = evaluateCubicBezierDerivative(p0, p1, p2, p3, t);
    if (!finiteVec3(point) || !finiteVec3(derivative)) {
      derivativeGuardApplied = true;
      envelopeGuardApplied = true;
      break;
    }
    const projection = dotVec3(subVec3(point, p0), chordDirection);
    if (projection < previousProjection - projectionTolerance) {
      derivativeGuardApplied = true;
    }
    previousProjection = Math.max(previousProjection, projection);
    if (dotVec3(derivative, chordDirection) < derivativeTolerance) {
      derivativeGuardApplied = true;
    }
    if (pointDistanceFromChord(point, p0, chordDirection, chordLength) > envelopeLimit) {
      envelopeGuardApplied = true;
    }
  }
  if (derivativeGuardApplied) {
    warnings.push("Spline guard damped a derivative reversal or non-monotonic chord projection.");
  }
  if (envelopeGuardApplied) {
    warnings.push("Spline guard damped a handle that left the chord envelope.");
  }
  return {
    valid: !derivativeGuardApplied && !envelopeGuardApplied,
    derivativeGuardApplied,
    envelopeGuardApplied,
    warnings,
  };
}

function dampBezierHandles({
  p0,
  p1,
  p2,
  p3,
  factor,
}: {
  p0: CaptureVec3;
  p1: CaptureVec3;
  p2: CaptureVec3;
  p3: CaptureVec3;
  factor: number;
}): { p1: CaptureVec3; p2: CaptureVec3 } {
  return {
    p1: addVec3(p0, scaleVec3(subVec3(p1, p0), factor)),
    p2: addVec3(p3, scaleVec3(subVec3(p2, p3), factor)),
  };
}

function clampHandleAgainstChord({
  anchor,
  handle,
  chordDirection,
  chordLength,
  maxLength,
}: {
  anchor: CaptureVec3;
  handle: CaptureVec3;
  chordDirection: CaptureVec3;
  chordLength: number;
  maxLength: number;
}): { position: CaptureVec3; clamped: boolean } {
  const vector = subVec3(handle, anchor);
  const length = lengthVec3(vector);
  if (length <= 0.000_001) return { position: cloneVec3(anchor), clamped: false };
  const direction = normalizeVec3(vector) ?? chordDirection;
  const projected = dotVec3(direction, chordDirection);
  let clamped = false;
  let safeLength = Math.min(length, maxLength);
  if (projected < -0.08) {
    safeLength = Math.min(safeLength, chordLength * 0.2);
    clamped = true;
  }
  if (safeLength < length - 0.000_001) clamped = true;
  return {
    position: addVec3(anchor, scaleVec3(direction, safeLength)),
    clamped,
  };
}

function rawHandleWorldPosition(
  node: CaptureCameraPathNodeV3,
  side: CaptureCameraPathSplineHandleSideV3,
  adjacentLength: number,
): CaptureVec3 {
  return handleWorldPosition(node, side, adjacentLength);
}

function nodeAdjacentGeometry(
  path: CaptureCameraPathV3,
  nodeId: string,
): {
  node: CaptureCameraPathNodeV3;
  previousNode?: CaptureCameraPathNodeV3;
  nextNode?: CaptureCameraPathNodeV3;
  incomingSegment?: CaptureCameraPathSegmentV3;
  outgoingSegment?: CaptureCameraPathSegmentV3;
  incomingLength: number;
  outgoingLength: number;
} | null {
  const nodes = nodeById(path);
  const node = nodes.get(nodeId);
  if (!node) return null;
  const incomingSegment = [...path.segments].reverse().find((segment) => segment.toNodeId === nodeId);
  const outgoingSegment = path.segments.find((segment) => segment.fromNodeId === nodeId);
  const previousNode = incomingSegment ? nodes.get(incomingSegment.fromNodeId) : undefined;
  const nextNode = outgoingSegment ? nodes.get(outgoingSegment.toNodeId) : undefined;
  return {
    node,
    previousNode,
    nextNode,
    incomingSegment,
    outgoingSegment,
    incomingLength: previousNode ? lengthVec3(subVec3(node.position, previousNode.position)) : 0,
    outgoingLength: nextNode ? lengthVec3(subVec3(nextNode.position, node.position)) : 0,
  };
}

function nodeTangentDirectionsForSolve(
  geometry: NonNullable<ReturnType<typeof nodeAdjacentGeometry>>,
): { inDirection: CaptureVec3; outDirection: CaptureVec3 } {
  const controls = geometry.node.splineControls;
  const directions = autoTangentDirections({
    node: geometry.node,
    previous: geometry.previousNode,
    next: geometry.nextNode,
    coupling: controls.coupling,
  });
  const outDirection =
    normalizeVec3(controls.out.direction ?? directions.outDirection) ??
    directions.outDirection;
  const inDirection =
    controls.coupling === "tangent"
      ? negateVec3(outDirection)
      : normalizeVec3(controls.in.direction ?? directions.inDirection) ??
        directions.inDirection;
  return { inDirection, outDirection };
}

function continuityScoreAtNode({
  geometry,
  inLength,
  outLength,
  inDirection,
  outDirection,
  continuity,
}: {
  geometry: NonNullable<ReturnType<typeof nodeAdjacentGeometry>>;
  inLength: number;
  outLength: number;
  inDirection: CaptureVec3;
  outDirection: CaptureVec3;
  continuity: CaptureCameraPathContinuityV3;
}): number {
  if (
    !geometry.previousNode ||
    !geometry.nextNode ||
    !geometry.incomingSegment ||
    !geometry.outgoingSegment
  ) {
    return 0;
  }
  const leftP0 = geometry.previousNode.position;
  const leftP1 = rawHandleWorldPosition(
    geometry.previousNode,
    "out",
    geometry.incomingLength,
  );
  const leftP2 = addVec3(geometry.node.position, scaleVec3(inDirection, inLength));
  const leftP3 = geometry.node.position;
  const rightP0 = geometry.node.position;
  const rightP1 = addVec3(geometry.node.position, scaleVec3(outDirection, outLength));
  const rightP2 = rawHandleWorldPosition(
    geometry.nextNode,
    "in",
    geometry.outgoingLength,
  );
  const rightP3 = geometry.nextNode.position;
  const leftEnd = cubicBezierCurvature(leftP0, leftP1, leftP2, leftP3, 1);
  const rightStart = cubicBezierCurvature(rightP0, rightP1, rightP2, rightP3, 0);
  const curvatureJump = Math.abs(leftEnd - rightStart);
  if (continuity === "G2") return curvatureJump;
  const leftBefore = cubicBezierCurvature(leftP0, leftP1, leftP2, leftP3, 0.82);
  const rightAfter = cubicBezierCurvature(rightP0, rightP1, rightP2, rightP3, 0.18);
  const flowSpike = Math.max(
    Math.abs(leftEnd - leftBefore),
    Math.abs(rightAfter - rightStart),
    curvatureJump,
  );
  return curvatureJump + flowSpike * 0.65;
}

function solveNodeFairingLengths(
  path: CaptureCameraPathV3,
  nodeId: string,
  continuity: CaptureCameraPathContinuityV3,
): { inLength?: number; outLength?: number; solved: boolean } {
  const geometry = nodeAdjacentGeometry(path, nodeId);
  if (
    !geometry ||
    !geometry.previousNode ||
    !geometry.nextNode ||
    geometry.node.splineControls.enabled === false ||
    geometry.node.splineControls.coupling !== "tangent" ||
    continuityRank(continuity) < 2
  ) {
    return { solved: false };
  }
  const controls = geometry.node.splineControls;
  const directions = nodeTangentDirectionsForSolve(geometry);
  const baseIn = resolvedHandleLength(controls.in, controls, geometry.incomingLength);
  const baseOut = resolvedHandleLength(controls.out, controls, geometry.outgoingLength);
  const minIn = Math.max(0.000_001, geometry.incomingLength * 0.08);
  const minOut = Math.max(0.000_001, geometry.outgoingLength * 0.08);
  const maxIn = Math.max(minIn, geometry.incomingLength * 1.25);
  const maxOut = Math.max(minOut, geometry.outgoingLength * 1.25);
  const averageChord = (geometry.incomingLength + geometry.outgoingLength) / 2;
  const balanced = averageChord * controls.autoScale * (1 - controls.maxLengthRatio * 0.08);
  const preferredIn = Math.max(minIn, Math.min(maxIn, (baseIn + balanced) / 2));
  const preferredOut = Math.max(minOut, Math.min(maxOut, (baseOut + balanced) / 2));
  const candidates = continuity === "G3"
    ? [0.45, 0.62, 0.78, 0.92, 1, 1.08, 1.22, 1.38]
    : [0.55, 0.72, 0.88, 1, 1.12, 1.28, 1.45];
  let best = {
    inLength: preferredIn,
    outLength: preferredOut,
    score: Number.POSITIVE_INFINITY,
  };
  for (const inScale of candidates) {
    for (const outScale of candidates) {
      const inLength = Math.max(minIn, Math.min(maxIn, preferredIn * inScale));
      const outLength = Math.max(minOut, Math.min(maxOut, preferredOut * outScale));
      const stabilityPenalty =
        Math.abs(inLength - preferredIn) * 0.002 +
        Math.abs(outLength - preferredOut) * 0.002;
      const symmetryPenalty = continuity === "G3"
        ? Math.abs(inLength - outLength) * 0.004
        : 0;
      const score =
        continuityScoreAtNode({
          geometry,
          inLength,
          outLength,
          inDirection: directions.inDirection,
          outDirection: directions.outDirection,
          continuity,
        }) +
        stabilityPenalty +
        symmetryPenalty;
      if (score < best.score) {
        best = { inLength, outLength, score };
      }
    }
  }
  return {
    inLength: best.inLength,
    outLength: best.outLength,
    solved: Number.isFinite(best.score),
  };
}

function effectiveHandleWorldPosition({
  path,
  node,
  side,
  adjacentLength,
  continuity,
}: {
  path: CaptureCameraPathV3;
  node: CaptureCameraPathNodeV3;
  side: CaptureCameraPathSplineHandleSideV3;
  adjacentLength: number;
  continuity: CaptureCameraPathContinuityV3;
}): CaptureVec3 {
  const controls = node.splineControls;
  const raw = rawHandleWorldPosition(node, side, adjacentLength);
  if (
    continuityRank(continuity) < 2 ||
    controls.coupling !== "tangent" ||
    controls.handleMode === "manual"
  ) {
    return raw;
  }
  const solution = solveNodeFairingLengths(path, node.id, continuity);
  if (!solution.solved) return raw;
  const geometry = nodeAdjacentGeometry(path, node.id);
  if (!geometry) return raw;
  const directions = nodeTangentDirectionsForSolve(geometry);
  const length = side === "in" ? solution.inLength : solution.outLength;
  if (!finiteNumber(length)) return raw;
  return addVec3(
    node.position,
    scaleVec3(side === "in" ? directions.inDirection : directions.outDirection, length),
  );
}

function stabilizeBezierCandidate({
  p0,
  p1,
  p2,
  p3,
  chordDirection,
  chordLength,
}: {
  p0: CaptureVec3;
  p1: CaptureVec3;
  p2: CaptureVec3;
  p3: CaptureVec3;
  chordDirection: CaptureVec3;
  chordLength: number;
}): {
  p1: CaptureVec3;
  p2: CaptureVec3;
  derivativeGuardApplied: boolean;
  envelopeGuardApplied: boolean;
  warnings: string[];
  damped: boolean;
  valid: boolean;
} {
  let derivativeGuardApplied = false;
  let envelopeGuardApplied = false;
  const warnings = new Set<string>();
  for (const factor of [1, 0.72, 0.52, 0.36, 0.24, 0.16, 0.1, 0.06]) {
    const handles = dampBezierHandles({ p0, p1, p2, p3, factor });
    const guard = guardBezierControls({
      p0,
      p1: handles.p1,
      p2: handles.p2,
      p3,
      chordDirection,
      chordLength,
    });
    derivativeGuardApplied = derivativeGuardApplied || guard.derivativeGuardApplied;
    envelopeGuardApplied = envelopeGuardApplied || guard.envelopeGuardApplied;
    guard.warnings.forEach((warning) => warnings.add(warning));
    if (guard.valid) {
      if (factor < 1) warnings.add("Spline guard reduced handle reach to keep the rail inside safe bounds.");
      return {
        p1: handles.p1,
        p2: handles.p2,
        derivativeGuardApplied,
        envelopeGuardApplied,
        warnings: [...warnings],
        damped: factor < 1,
        valid: true,
      };
    }
  }
  return {
    p1,
    p2,
    derivativeGuardApplied: true,
    envelopeGuardApplied: true,
    warnings: [
      ...warnings,
      "Spline guard could not stabilize the requested continuity without fallback.",
    ],
    damped: true,
    valid: false,
  };
}

export function resolveCaptureCameraPathBezierSegment(
  inputPath: CaptureCameraPathV3,
  inputSegment: CaptureCameraPathSegmentV3,
): CaptureCameraPathBezierSegmentV3 {
  const path = normalizeCaptureCameraPathV3(inputPath);
  const segment =
    path.segments.find((candidate) => candidate.id === inputSegment.id) ??
    normalizeCaptureCameraPathV3({
      ...path,
      segments: [inputSegment],
    }).segments[0];
  const nodes = nodeById(path);
  const from = nodes.get(segment.fromNodeId);
  const to = nodes.get(segment.toNodeId);
  if (!from || !to) {
    return {
      segmentId: inputSegment.id,
      p0: [0, 0, 0],
      p1: [0, 0, 0],
      p2: [0, 0, 0],
      p3: [0, 0, 0],
      diagnostics: {
        requestedContinuity: "G0",
        effectiveContinuity: "G0",
        loopbackGuardApplied: false,
        derivativeGuardApplied: false,
        envelopeGuardApplied: false,
        fallbackApplied: false,
        continuity: "G0",
        fromHandleLength: 0,
        toHandleLength: 0,
        warnings: ["Bezier segment could not resolve its endpoint nodes."],
      },
    };
  }
  const chord = subVec3(to.position, from.position);
  const chordLength = Math.max(0.000_001, lengthVec3(chord));
  const chordDirection = normalizeVec3(chord) ?? [1, 0, 0];
  const requestedContinuity = maxContinuity(
    from.splineControls.continuity,
    to.splineControls.continuity,
  );
  if (
    requestedContinuity === "G0" ||
    from.splineControls.handleMode === "vector" ||
    to.splineControls.handleMode === "vector" ||
    from.splineControls.enabled === false ||
    to.splineControls.enabled === false
  ) {
    return {
      segmentId: segment.id,
      p0: cloneVec3(from.position),
      p1: cloneVec3(from.position),
      p2: cloneVec3(to.position),
      p3: cloneVec3(to.position),
      diagnostics: {
        requestedContinuity,
        effectiveContinuity: "G0",
        loopbackGuardApplied: false,
        derivativeGuardApplied: false,
        envelopeGuardApplied: false,
        fallbackApplied: requestedContinuity !== "G0",
        continuity: "G0",
        fromHandleLength: 0,
        toHandleLength: 0,
        warnings:
          requestedContinuity === "G0"
            ? []
            : ["Vector or disabled spline controls reduced the segment to G0."],
      },
    };
  }
  const warningSet = new Set<string>();
  let loopbackGuardApplied = false;
  let derivativeGuardApplied = false;
  let envelopeGuardApplied = false;
  let fallbackApplied = false;
  const buildCandidate = (continuity: CaptureCameraPathContinuityV3) => {
    let p1 = effectiveHandleWorldPosition({
      path,
      node: from,
      side: "out",
      adjacentLength: chordLength,
      continuity,
    });
    let p2 = effectiveHandleWorldPosition({
      path,
      node: to,
      side: "in",
      adjacentLength: chordLength,
      continuity,
    });
    if (from.splineControls.preventLoopback) {
      const clamped = clampHandleAgainstChord({
        anchor: from.position,
        handle: p1,
        chordDirection,
        chordLength,
        maxLength: chordLength * 2,
      });
      p1 = clamped.position;
      loopbackGuardApplied = loopbackGuardApplied || clamped.clamped;
      if (clamped.clamped) warningSet.add("Loopback guard clamped the outgoing handle.");
    }
    if (to.splineControls.preventLoopback) {
      const clamped = clampHandleAgainstChord({
        anchor: to.position,
        handle: p2,
        chordDirection: negateVec3(chordDirection),
        chordLength,
        maxLength: chordLength * 2,
      });
      p2 = clamped.position;
      loopbackGuardApplied = loopbackGuardApplied || clamped.clamped;
      if (clamped.clamped) warningSet.add("Loopback guard clamped the incoming handle.");
    }
    return { p1, p2 };
  };
  let effectiveContinuity = requestedContinuity;
  let p1: CaptureVec3 = cloneVec3(from.position);
  let p2: CaptureVec3 = cloneVec3(to.position);
  for (let rank = continuityRank(requestedContinuity); rank >= 1; rank -= 1) {
    const candidateContinuity = continuityFromRank(rank) as Exclude<
      CaptureCameraPathContinuityV3,
      "G0"
    >;
    const candidate = buildCandidate(candidateContinuity);
    const stabilized = stabilizeBezierCandidate({
      p0: from.position,
      p1: candidate.p1,
      p2: candidate.p2,
      p3: to.position,
      chordDirection,
      chordLength,
    });
    derivativeGuardApplied =
      derivativeGuardApplied || stabilized.derivativeGuardApplied;
    envelopeGuardApplied = envelopeGuardApplied || stabilized.envelopeGuardApplied;
    stabilized.warnings.forEach((warning) => warningSet.add(warning));
    if (stabilized.valid) {
      p1 = stabilized.p1;
      p2 = stabilized.p2;
      effectiveContinuity = candidateContinuity;
      fallbackApplied =
        fallbackApplied ||
        candidateContinuity !== requestedContinuity ||
        stabilized.damped;
      break;
    }
    fallbackApplied = true;
    warningSet.add(
      `Continuity ${candidateContinuity} could not be stabilized; trying a lower class.`,
    );
  }
  if (lengthVec3(subVec3(p1, from.position)) <= 0.000_001 && lengthVec3(subVec3(p2, to.position)) <= 0.000_001) {
    const fallbackFrom = handleWorldPosition(from, "out", chordLength);
    const fallbackTo = handleWorldPosition(to, "in", chordLength);
    p1 = addVec3(from.position, scaleVec3(subVec3(fallbackFrom, from.position), 0.45));
    p2 = addVec3(to.position, scaleVec3(subVec3(fallbackTo, to.position), 0.45));
    effectiveContinuity = "G1";
    fallbackApplied = true;
    warningSet.add("Spline guard fell back to stable G1 auto handles.");
  }
  if (effectiveContinuity !== requestedContinuity) {
    warningSet.add(
      `Requested ${requestedContinuity}; using ${effectiveContinuity} after Gx guard stabilization.`,
    );
  }
  return {
    segmentId: segment.id,
    p0: cloneVec3(from.position),
    p1,
    p2,
    p3: cloneVec3(to.position),
    diagnostics: {
      requestedContinuity,
      effectiveContinuity,
      loopbackGuardApplied,
      derivativeGuardApplied,
      envelopeGuardApplied,
      fallbackApplied,
      continuity: effectiveContinuity,
      fromHandleLength: lengthVec3(subVec3(p1, from.position)),
      toHandleLength: lengthVec3(subVec3(p2, to.position)),
      warnings: [...warningSet],
    },
  };
}

function geometrySampleForSegment(
  path: CaptureCameraPathV3,
  segment: CaptureCameraPathSegmentV3,
  progress: number,
): { position: CaptureVec3; derivative: CaptureVec3 } | null {
  const neighbors = segmentNeighbors(path, segment);
  if (!neighbors) return null;
  const t = Math.max(0, Math.min(1, progress));
  const bezier = resolveCaptureCameraPathBezierSegment(path, segment);
  if (bezier.diagnostics.continuity === "G0") {
    const chord = subVec3(bezier.p3, bezier.p0);
    return {
      position: addVec3(bezier.p0, scaleVec3(chord, t)),
      derivative: chord,
    };
  }
  return {
    position: evaluateCubicBezier(bezier.p0, bezier.p1, bezier.p2, bezier.p3, t),
    derivative: evaluateCubicBezierDerivative(
      bezier.p0,
      bezier.p1,
      bezier.p2,
      bezier.p3,
      t,
    ),
  };
}

function resolveSegmentTarget(
  path: CaptureCameraPathV3,
  from: CaptureCameraPathNodeV3,
  to: CaptureCameraPathNodeV3,
  segment: CaptureCameraPathSegmentV3,
  progress: number,
  position: CaptureVec3,
  derivative: CaptureVec3,
): CaptureVec3 {
  const fromAim = from.aimGeometry;
  const toAim = to.aimGeometry;
  if (fromAim.mode === "follow-path-tangent" || toAim.mode === "follow-path-tangent") {
    const direction = normalizeVec3(derivative) ?? normalizeVec3(subVec3(to.position, from.position));
    const distance = lerp(
      fromAim.tangentForwardDistance ?? 1,
      toAim.tangentForwardDistance ?? fromAim.tangentForwardDistance ?? 1,
      progress,
    );
    return direction ? addVec3(position, scaleVec3(direction, distance)) : fallbackTarget(from);
  }
  if (fromAim.mode === "target-blend" || toAim.mode === "target-blend") {
    const blendCurve = fromAim.targetBlend?.curve ?? toAim.targetBlend?.curve ?? segment.timeCurve;
    const targetT = applyCaptureCameraPathV3TimeCurve(blendCurve, progress);
    return lerpVec3(nodeTarget(path, from), nodeTarget(path, to), targetT);
  }
  return lerpVec3(nodeTarget(path, from), nodeTarget(path, to), progress);
}

function maintainFocusSizeFov({
  basePosition,
  baseTarget,
  baseFov,
  position,
  target,
}: {
  basePosition: CaptureVec3;
  baseTarget: CaptureVec3;
  baseFov: number;
  position: CaptureVec3;
  target: CaptureVec3;
}): number {
  const baseDistance = Math.max(0.000_001, lengthVec3(subVec3(baseTarget, basePosition)));
  const currentDistance = Math.max(0.000_001, lengthVec3(subVec3(target, position)));
  const radians = (baseFov * Math.PI) / 180;
  const nextRadians = 2 * Math.atan((baseDistance * Math.tan(radians / 2)) / currentDistance);
  return Math.max(1, Math.min(179, (nextRadians * 180) / Math.PI));
}

function resolveSegmentFov(
  from: CaptureCameraPathNodeV3,
  to: CaptureCameraPathNodeV3,
  progress: number,
  position: CaptureVec3,
  target: CaptureVec3,
): number {
  const fixed = lerp(from.fov, to.fov, progress);
  const lensMode = from.aimGeometry.lensMode;
  if (lensMode === "fixed-fov") return fixed;
  const maintained = maintainFocusSizeFov({
    basePosition: from.position,
    baseTarget: from.target ?? target,
    baseFov: from.fov,
    position,
    target,
  });
  if (lensMode === "maintain-focus-size") return maintained;
  return lerp(fixed, maintained, from.aimGeometry.dollyZoomStrength ?? 0);
}

export function sampleCaptureCameraPathV3(
  inputPath: CaptureCameraPathV3,
  timeSeconds: number,
): CaptureCameraPathV3Sample {
  const path = enabledPathForSampling(inputPath);
  const timeline = resolveCaptureCameraPathV3Timeline(path);
  const nodes = nodeById(path);
  const first = path.nodes[0];
  if (!first) {
    return {
      timeSeconds: 0,
      position: [0, 0, 0],
      target: [0, 1, 0],
      up: [0, 0, 1],
      fov: 50,
    };
  }
  if (timeline.durationSeconds <= 0) {
    return { ...poseFromNode(path, first), timeSeconds: 0 };
  }
  const safeTime = path.loop
    ? ((Math.max(0, timeSeconds) % timeline.durationSeconds) + timeline.durationSeconds) %
      timeline.durationSeconds
    : Math.max(0, Math.min(timeSeconds, timeline.durationSeconds));
  const entry =
    timeline.entries.find(
      (candidate) =>
        safeTime >= candidate.startSeconds && safeTime <= candidate.endSeconds,
    ) ?? timeline.entries[timeline.entries.length - 1];
  if (!entry) return { ...poseFromNode(path, first), timeSeconds: safeTime };
  if (entry.kind === "hold" && entry.nodeId) {
    const node = nodes.get(entry.nodeId) ?? first;
    return { ...poseFromNode(path, node), timeSeconds: safeTime };
  }
  const segment = path.segments.find((candidate) => candidate.id === entry.segmentId);
  const from = entry.fromNodeId ? nodes.get(entry.fromNodeId) : null;
  const to = entry.toNodeId ? nodes.get(entry.toNodeId) : null;
  if (!segment || !from || !to) {
    return { ...poseFromNode(path, first), timeSeconds: safeTime };
  }
  const localT =
    entry.durationSeconds <= 0
      ? 1
      : Math.max(0, Math.min(1, (safeTime - entry.startSeconds) / entry.durationSeconds));
  const progress = applyCaptureCameraPathV3TimeCurve(segment.timeCurve, localT);
  const geometry =
    geometrySampleForSegment(path, segment, progress) ?? {
      position: lerpVec3(from.position, to.position, progress),
      derivative: subVec3(to.position, from.position),
    };
  const target = resolveSegmentTarget(
    path,
    from,
    to,
    segment,
    progress,
    geometry.position,
    geometry.derivative,
  );
  return {
    timeSeconds: safeTime,
    position: geometry.position,
    target,
    up: lerpVec3(from.up, to.up, progress),
    fov: resolveSegmentFov(from, to, progress, geometry.position, target),
  };
}

export function captureCameraPathV3SampledPoints(
  path: CaptureCameraPathV3,
  sampleCount = 96,
): CaptureVec3[] {
  const enabledPath = enabledPathForSampling(path);
  if (enabledPath.nodes.length === 0) return [];
  if (!captureCameraPathV3Renderable(enabledPath)) {
    return enabledPath.nodes.map((node) => cloneVec3(node.position));
  }
  const timeline = resolveCaptureCameraPathV3Timeline(enabledPath);
  const count = Math.max(2, Math.floor(sampleCount));
  return Array.from({ length: count }, (_value, index) =>
    sampleCaptureCameraPathV3(
      enabledPath,
      (timeline.durationSeconds * index) / (count - 1),
    ).position,
  );
}

function poseFromSample(sample: CaptureCameraPathV3Sample): CaptureCameraPathPose {
  return {
    position: cloneVec3(sample.position),
    target: cloneVec3(sample.target),
    up: cloneVec3(sample.up),
    fov: sample.fov,
  };
}

export function captureCameraPathV3ToLegacyKeyframes(
  inputPath: CaptureCameraPathV3,
): CaptureCameraPathLegacyKeyframe[] {
  const path = enabledPathForSampling(inputPath);
  const timeline = resolveCaptureCameraPathV3Timeline(path);
  return path.nodes.map((node, index) => {
    const timeSeconds = timeline.nodeTimeSeconds[node.id] ?? 0;
    return {
      timeSeconds,
      camera: poseFromSample(sampleCaptureCameraPathV3(path, timeSeconds)),
      easing: index === 0 ? "linear" : "ease-in-out",
    };
  });
}

export function cameraPathV3ToRecipeKeyframes(
  path: CaptureCameraPathV3,
  fps?: number,
): CaptureCameraPathLegacyKeyframe[] {
  return captureCameraPathV3ToLegacyKeyframes(path).map((keyframe) => ({
    ...keyframe,
    ...(fps ? { frameIndex: Math.round(keyframe.timeSeconds * fps) } : {}),
  }));
}

export function upgradeCaptureCameraPathV2ToV3(inputPath: CaptureCameraPathV2): CaptureCameraPathV3 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  return normalizeCaptureCameraPathV3({
    version: 3,
    id: path.id.replace(/-v2$/, "-v3"),
    name: path.name.replace(/\bv2\b/i, "v3"),
    loop: path.loop,
    displayOptions: path.displayOptions,
    equationOverlayOptions: DEFAULT_CAPTURE_CAMERA_PATH_EQUATION_OVERLAY_OPTIONS_V3,
    focusPoints: path.focusPoints,
    nodes: path.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      enabled: node.enabled,
      hidden: node.hidden,
      ...(node.label ? { label: node.label } : {}),
      timeSeconds: node.timeSeconds,
      position: cloneVec3(node.position),
      ...(node.target ? { target: cloneVec3(node.target) } : {}),
      up: cloneVec3(node.up),
      fov: node.fov,
      holdSecondsAfter: node.holdSecondsAfter,
      aimGeometry: normalizeAimGeometry(
        {
          mode: node.lookMode,
          focusPointId: node.focusPointId,
          lensMode: "fixed-fov",
          tangentForwardDistance: 1,
        },
        node.lookMode,
        node.focusPointId,
      ),
      splineControls: DEFAULT_CAPTURE_CAMERA_PATH_SPLINE_CONTROLS_V3,
    })),
    segments: path.segments.map((segment) => ({
      id: segment.id,
      fromNodeId: segment.fromNodeId,
      toNodeId: segment.toNodeId,
      enabled: segment.enabled,
      hidden: segment.hidden,
      transitionSeconds: segment.transitionSeconds,
      timeCurve: { mode: segment.easing === "ease-in-out" ? "ease-in-out" : "linear" },
      pathFairing: { ...DEFAULT_FAIRING_V3 },
    })),
  });
}

function aimModeToLookMode(mode: CaptureCameraPathAimModeV3): CaptureCameraPathLookModeV2 {
  if (mode === "follow-path-tangent") return "follow-path-tangent";
  if (mode === "focus-point-lock") return "focus-point-lock";
  return "free-direction";
}

export function downgradeCaptureCameraPathV3ToV2(inputPath: CaptureCameraPathV3): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV3(inputPath);
  return normalizeCaptureCameraPathV2({
    version: 2,
    id: path.id.replace(/-v3$/, "-v2"),
    name: path.name.replace(/\bv3\b/i, "v2"),
    loop: path.loop,
    displayOptions: path.displayOptions,
    focusPoints: path.focusPoints,
    nodes: path.nodes.map((node) =>
      cameraPathV2NodeFromPose({
        id: node.id,
        kind: node.kind,
        pose: {
          position: cloneVec3(node.position),
          target: node.target ? cloneVec3(node.target) : nodeTarget(path, node),
          up: cloneVec3(node.up),
          fov: node.fov,
        },
        holdSecondsAfter: node.holdSecondsAfter,
        lookMode: aimModeToLookMode(node.aimGeometry.mode),
        focusPointId: node.aimGeometry.focusPointId,
      }),
    ),
    segments: path.segments.map((segment) => ({
      id: segment.id,
      fromNodeId: segment.fromNodeId,
      toNodeId: segment.toNodeId,
      enabled: segment.enabled,
      hidden: segment.hidden,
      transitionSeconds: segment.transitionSeconds,
      easing: segment.timeCurve.mode === "ease-in-out" ? "ease-in-out" : "linear",
    })),
  });
}

export function recipeKeyframesToCameraPathV3(
  recipe: {
    cameraKeyframes: readonly CaptureCameraPathLegacyKeyframe[];
    durationSeconds: number;
  },
  options: { id?: string; name?: string } = {},
): CaptureCameraPathV3 {
  return upgradeCaptureCameraPathV2ToV3(
    recipeKeyframesToCameraPathV2(recipe, {
      id: options.id ?? "capture-camera-path-v3",
      name: options.name ?? "Camera Path v3",
    }),
  );
}

export function serializeCaptureCameraPathV3(path: CaptureCameraPathV3): string {
  return `${JSON.stringify(normalizeCaptureCameraPathV3(path), null, 2)}\n`;
}

export function parseCaptureCameraPathV3Json(text: string): {
  path: CaptureCameraPathV3 | null;
  validation: CaptureCameraPathV2ValidationResult;
} {
  try {
    const parsed = JSON.parse(text) as CaptureCameraPathV3;
    const validation = validateCaptureCameraPathV3(parsed);
    return {
      path: validation.valid ? normalizeCaptureCameraPathV3(parsed) : null,
      validation,
    };
  } catch (error) {
    return {
      path: null,
      validation: {
        valid: false,
        errors: [
          error instanceof Error
            ? `Camera path JSON could not be parsed: ${error.message}`
            : "Camera path JSON could not be parsed.",
        ],
      },
    };
  }
}
