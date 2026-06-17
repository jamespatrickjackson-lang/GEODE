import {
  captureCameraPathSampledPoints,
  recipeKeyframesToCameraPath,
  type CaptureCameraPathV1,
} from "./captureCameraPath";

export type CaptureCameraPathNodeKindV2 = "keyframe" | "transition";
export type CaptureCameraPathLookModeV2 =
  | "free-direction"
  | "focus-point-lock"
  | "follow-path-tangent";
export type CaptureCameraPathPreviewMonitorModeV2 =
  | "off"
  | "selected-node"
  | "scrub-time"
  | "while-editing";

export type CaptureVec3 = [number, number, number];

export interface CaptureCameraPathPose {
  position: CaptureVec3;
  target: CaptureVec3;
  up: CaptureVec3;
  fov: number;
}

export interface CaptureCameraPathLegacyKeyframe {
  frameIndex?: number;
  timeSeconds: number;
  camera: CaptureCameraPathPose;
  easing?: "linear" | "ease-in-out";
}

export interface CaptureCameraPathKeyframeV1Input {
  id: string;
  timeSeconds: number;
  position: CaptureVec3;
  target: CaptureVec3;
  up: CaptureVec3;
  fov: number;
  easing: "linear" | "ease-in-out";
}

export interface CaptureCameraPathV1Input {
  version: 1;
  id: string;
  name: string;
  durationSeconds: number;
  interpolation: "catmull-rom";
  targetInterpolation: "linear";
  loop: boolean;
  keyframes: CaptureCameraPathKeyframeV1Input[];
}

export interface CaptureCameraPathFocusPointV2 {
  id: string;
  label?: string;
  position: CaptureVec3;
  picked?: boolean;
}

export interface CaptureCameraPathNodeV2 {
  id: string;
  kind: CaptureCameraPathNodeKindV2;
  timeSeconds: number;
  enabled: boolean;
  hidden: boolean;
  label?: string;
  position: CaptureVec3;
  target?: CaptureVec3;
  focusPointId?: string;
  up: CaptureVec3;
  fov: number;
  lookMode: CaptureCameraPathLookModeV2;
  holdSecondsAfter: number;
}

export interface CaptureCameraPathSegmentV2 {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  enabled: boolean;
  hidden: boolean;
  transitionSeconds: number;
  easing: "linear" | "ease-in-out";
}

export interface CaptureCameraPathDisplayOptionsV2 {
  trackColor: string;
  selectedColor: string;
  targetColor: string;
  focusColor: string;
  trackLineSize: number;
  directionRayLength: number;
  handleScale: number;
  showCameraFrustum: boolean;
  showLookRays: boolean;
  showFocusLockRays: boolean;
  showNodeLabels: boolean;
  showTimelineGhost: boolean;
  showSplineControls: boolean;
  showXyzHandles: boolean;
  defaultSplineCoupling: "tangent" | "non-tangent";
  previewMonitorMode: CaptureCameraPathPreviewMonitorModeV2;
}

export interface CaptureCameraPathV2 {
  version: 2;
  id: string;
  name: string;
  loop: boolean;
  timeline: {
    durationSeconds: number;
  };
  displayOptions: CaptureCameraPathDisplayOptionsV2;
  focusPoints: CaptureCameraPathFocusPointV2[];
  nodes: CaptureCameraPathNodeV2[];
  segments: CaptureCameraPathSegmentV2[];
}

export interface CaptureCameraPathV2ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CaptureCameraPathV2TimelineEntry {
  kind: "hold" | "transition";
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  nodeId?: string;
  segmentId?: string;
  fromNodeId?: string;
  toNodeId?: string;
  easing?: "linear" | "ease-in-out";
}

export interface CaptureCameraPathV2Timeline {
  durationSeconds: number;
  entries: CaptureCameraPathV2TimelineEntry[];
  nodeTimeSeconds: Record<string, number>;
  activeNodeIds: string[];
  activeSegmentIds: string[];
}

export interface CaptureCameraPathV2Sample {
  timeSeconds: number;
  position: CaptureVec3;
  target: CaptureVec3;
  up: CaptureVec3;
  fov: number;
}

export interface CaptureCameraPathV2Recorder {
  stop(): CaptureCameraPathV2;
  cancel(): void;
}

export const DEFAULT_CAPTURE_CAMERA_PATH_DISPLAY_OPTIONS_V2: CaptureCameraPathDisplayOptionsV2 =
  {
    trackColor: "#ff6b4a",
    selectedColor: "#f8fafc",
    targetColor: "#7dd3fc",
    focusColor: "#facc15",
    trackLineSize: 3,
    directionRayLength: 1.5,
    handleScale: 120,
    showCameraFrustum: false,
    showLookRays: true,
    showFocusLockRays: true,
    showNodeLabels: false,
    showTimelineGhost: true,
    showSplineControls: false,
    showXyzHandles: false,
    defaultSplineCoupling: "tangent",
    previewMonitorMode: "selected-node",
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

function lengthVec3(value: CaptureVec3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function normalizeVec3(value: CaptureVec3): CaptureVec3 | null {
  const length = lengthVec3(value);
  if (length <= 0.000_001) return null;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: CaptureVec3, b: CaptureVec3, t: number): CaptureVec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function uniqueNodeId(path: CaptureCameraPathV2, baseId: string): string {
  const existing = new Set(path.nodes.map((node) => node.id));
  const safeBase = baseId.trim() || captureCameraPathV2NodeId(path.nodes.length);
  if (!existing.has(safeBase)) return safeBase;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${safeBase}-${index}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${safeBase}-${Date.now()}`;
}

function safeSeconds(value: unknown): number {
  return finiteNumber(value) ? Math.max(0, value) : 0;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (!finiteNumber(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function safeFov(value: unknown): number {
  return finiteNumber(value) && value > 0 && value <= 180 ? value : 50;
}

function normalizeNodeKind(value: unknown): CaptureCameraPathNodeKindV2 {
  return value === "transition" ? "transition" : "keyframe";
}

function normalizeLookMode(value: unknown): CaptureCameraPathLookModeV2 {
  if (
    value === "focus-point-lock" ||
    value === "follow-path-tangent" ||
    value === "free-direction"
  ) {
    return value;
  }
  return "free-direction";
}

function normalizeEasing(value: unknown): "linear" | "ease-in-out" {
  return value === "ease-in-out" ? "ease-in-out" : "linear";
}

function normalizePreviewMonitorMode(
  value: unknown,
): CaptureCameraPathPreviewMonitorModeV2 {
  if (
    value === "off" ||
    value === "selected-node" ||
    value === "scrub-time" ||
    value === "while-editing"
  ) {
    return value;
  }
  return DEFAULT_CAPTURE_CAMERA_PATH_DISPLAY_OPTIONS_V2.previewMonitorMode;
}

export function normalizeCaptureCameraPathDisplayOptionsV2(
  input: unknown,
): CaptureCameraPathDisplayOptionsV2 {
  const source = isRecord(input) ? input : {};
  const defaults = DEFAULT_CAPTURE_CAMERA_PATH_DISPLAY_OPTIONS_V2;
  return {
    trackColor: isHexColor(source.trackColor) ? source.trackColor : defaults.trackColor,
    selectedColor: isHexColor(source.selectedColor)
      ? source.selectedColor
      : defaults.selectedColor,
    targetColor: isHexColor(source.targetColor)
      ? source.targetColor
      : defaults.targetColor,
    focusColor: isHexColor(source.focusColor) ? source.focusColor : defaults.focusColor,
    trackLineSize: clampNumber(
      source.trackLineSize,
      defaults.trackLineSize,
      1,
      12,
    ),
    directionRayLength: clampNumber(
      source.directionRayLength,
      defaults.directionRayLength,
      0.25,
      12,
    ),
    handleScale: clampNumber(source.handleScale, defaults.handleScale, 24, 360),
    showCameraFrustum:
      typeof source.showCameraFrustum === "boolean"
        ? source.showCameraFrustum
        : defaults.showCameraFrustum,
    showLookRays:
      typeof source.showLookRays === "boolean"
        ? source.showLookRays
        : defaults.showLookRays,
    showFocusLockRays:
      typeof source.showFocusLockRays === "boolean"
        ? source.showFocusLockRays
        : defaults.showFocusLockRays,
    showNodeLabels:
      typeof source.showNodeLabels === "boolean"
        ? source.showNodeLabels
        : defaults.showNodeLabels,
    showTimelineGhost:
      typeof source.showTimelineGhost === "boolean"
        ? source.showTimelineGhost
        : defaults.showTimelineGhost,
    showSplineControls:
      typeof source.showSplineControls === "boolean"
        ? source.showSplineControls
        : defaults.showSplineControls,
    showXyzHandles:
      typeof source.showXyzHandles === "boolean"
        ? source.showXyzHandles
        : defaults.showXyzHandles,
    defaultSplineCoupling:
      source.defaultSplineCoupling === "non-tangent" ? "non-tangent" : "tangent",
    previewMonitorMode: normalizePreviewMonitorMode(source.previewMonitorMode),
  };
}

export function validateCaptureCameraPathDisplayOptionsV2(
  input: Partial<CaptureCameraPathDisplayOptionsV2> | null | undefined,
): CaptureCameraPathV2ValidationResult {
  const errors: string[] = [];
  if (!input || !isRecord(input)) {
    return { valid: false, errors: ["cameraPathV2.displayOptions is missing."] };
  }
  for (const field of [
    "trackColor",
    "selectedColor",
    "targetColor",
    "focusColor",
  ] as const) {
    if (!isHexColor(input[field])) {
      errors.push(`cameraPathV2.displayOptions.${field} must be a #RRGGBB color.`);
    }
  }
  if (
    !finiteNumber(input.trackLineSize) ||
    input.trackLineSize < 1 ||
    input.trackLineSize > 12
  ) {
    errors.push("cameraPathV2.displayOptions.trackLineSize must be between 1 and 12.");
  }
  if (
    !finiteNumber(input.directionRayLength) ||
    input.directionRayLength < 0.25 ||
    input.directionRayLength > 12
  ) {
    errors.push(
      "cameraPathV2.displayOptions.directionRayLength must be between 0.25 and 12.",
    );
  }
  if (
    !finiteNumber(input.handleScale) ||
    input.handleScale < 24 ||
    input.handleScale > 360
  ) {
    errors.push("cameraPathV2.displayOptions.handleScale must be between 24 and 360.");
  }
  for (const field of [
    "showCameraFrustum",
    "showLookRays",
    "showFocusLockRays",
    "showNodeLabels",
    "showTimelineGhost",
  ] as const) {
    if (typeof input[field] !== "boolean") {
      errors.push(`cameraPathV2.displayOptions.${field} must be boolean.`);
    }
  }
  for (const field of ["showSplineControls", "showXyzHandles"] as const) {
    if (input[field] !== undefined && typeof input[field] !== "boolean") {
      errors.push(`cameraPathV2.displayOptions.${field} must be boolean.`);
    }
  }
  if (
    input.defaultSplineCoupling !== undefined &&
    input.defaultSplineCoupling !== "tangent" &&
    input.defaultSplineCoupling !== "non-tangent"
  ) {
    errors.push(
      "cameraPathV2.displayOptions.defaultSplineCoupling must be tangent or non-tangent.",
    );
  }
  if (
    input.previewMonitorMode !== "off" &&
    input.previewMonitorMode !== "selected-node" &&
    input.previewMonitorMode !== "scrub-time" &&
    input.previewMonitorMode !== "while-editing"
  ) {
    errors.push("cameraPathV2.displayOptions.previewMonitorMode is not supported.");
  }
  return { valid: errors.length === 0, errors };
}

function nodeById(path: CaptureCameraPathV2): Map<string, CaptureCameraPathNodeV2> {
  return new Map(path.nodes.map((node) => [node.id, node]));
}

function focusPointById(
  path: CaptureCameraPathV2,
): Map<string, CaptureCameraPathFocusPointV2> {
  return new Map(path.focusPoints.map((point) => [point.id, point]));
}

function nextNodeFor(
  path: CaptureCameraPathV2,
  node: CaptureCameraPathNodeV2,
): CaptureCameraPathNodeV2 | null {
  const nodes = nodeById(path);
  const outgoing = path.segments.find((segment) => segment.fromNodeId === node.id);
  if (outgoing) return nodes.get(outgoing.toNodeId) ?? null;
  const index = path.nodes.findIndex((candidate) => candidate.id === node.id);
  return index >= 0 ? path.nodes[index + 1] ?? null : null;
}

function previousNodeFor(
  path: CaptureCameraPathV2,
  node: CaptureCameraPathNodeV2,
): CaptureCameraPathNodeV2 | null {
  const nodes = nodeById(path);
  const incoming = [...path.segments]
    .reverse()
    .find((segment) => segment.toNodeId === node.id);
  if (incoming) return nodes.get(incoming.fromNodeId) ?? null;
  const index = path.nodes.findIndex((candidate) => candidate.id === node.id);
  return index > 0 ? path.nodes[index - 1] ?? null : null;
}

function resolveNodeTarget(
  path: CaptureCameraPathV2,
  node: CaptureCameraPathNodeV2,
): CaptureVec3 {
  if (node.lookMode === "focus-point-lock" && node.focusPointId) {
    const point = focusPointById(path).get(node.focusPointId);
    if (point) return cloneVec3(point.position);
  }
  if (node.lookMode === "follow-path-tangent") {
    const next = nextNodeFor(path, node);
    const previous = previousNodeFor(path, node);
    const tangent =
      next && lengthVec3(subVec3(next.position, node.position)) > 0.000_001
        ? subVec3(next.position, node.position)
        : previous
          ? subVec3(node.position, previous.position)
          : null;
    const direction = tangent ? normalizeVec3(tangent) : null;
    if (direction) return addVec3(node.position, direction);
  }
  return node.target ? cloneVec3(node.target) : addVec3(node.position, [0, 1, 0]);
}

function poseFromNode(
  path: CaptureCameraPathV2,
  node: CaptureCameraPathNodeV2,
): Omit<CaptureCameraPathV2Sample, "timeSeconds"> {
  return {
    position: cloneVec3(node.position),
    target: resolveNodeTarget(path, node),
    up: cloneVec3(node.up),
    fov: node.fov,
  };
}

export function normalizeCaptureCameraPathV2(
  inputPath: Partial<CaptureCameraPathV2>,
): CaptureCameraPathV2 {
  const source = isRecord(inputPath) ? inputPath : {};
  const displayOptions = normalizeCaptureCameraPathDisplayOptionsV2(
    source.displayOptions,
  );
  const rawFocusPoints = Array.isArray(source.focusPoints) ? source.focusPoints : [];
  const focusPoints = rawFocusPoints.map((point, index) => {
    const record: Record<string, unknown> = isRecord(point) ? point : {};
    return {
      id:
        typeof record.id === "string" && record.id.trim()
          ? record.id
          : `focus-${String(index + 1).padStart(2, "0")}`,
      ...(typeof record.label === "string" && record.label.trim()
        ? { label: record.label }
        : {}),
      position: fallbackVec3(record.position, [0, 0, 0]),
      ...(typeof record.picked === "boolean" ? { picked: record.picked } : {}),
    };
  });

  const rawNodes = Array.isArray(source.nodes) ? source.nodes : [];
  const nodes = rawNodes.map((node, index) => {
    const record: Record<string, unknown> = isRecord(node) ? node : {};
    const kind = normalizeNodeKind(record.kind);
    return {
      id:
        typeof record.id === "string" && record.id.trim()
          ? record.id
          : `node-${String(index + 1).padStart(2, "0")}`,
      kind,
      enabled: record.enabled !== false,
      hidden: record.hidden === true,
      ...(typeof record.label === "string" && record.label.trim()
        ? { label: record.label.trim() }
        : {}),
      position: fallbackVec3(record.position, [0, 0, 0]),
      ...(vec3(record.target) ? { target: cloneVec3(record.target) } : {}),
      ...(typeof record.focusPointId === "string" && record.focusPointId.trim()
        ? { focusPointId: record.focusPointId }
        : {}),
      up: fallbackVec3(record.up, [0, 0, 1]),
      fov: safeFov(record.fov),
      lookMode: normalizeLookMode(record.lookMode),
      holdSecondsAfter: kind === "transition" ? 0 : safeSeconds(record.holdSecondsAfter),
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
              : nodes[index]?.id ?? "";
          const toNodeId =
            typeof record.toNodeId === "string" && record.toNodeId.trim()
              ? record.toNodeId
              : nodes[index + 1]?.id ?? "";
          return {
            id:
              typeof record.id === "string" && record.id.trim()
                ? record.id
                : `${fromNodeId}:${toNodeId}`,
            fromNodeId,
            toNodeId,
            enabled: record.enabled !== false,
            hidden: record.hidden === true,
            transitionSeconds: safeSeconds(record.transitionSeconds),
            easing: normalizeEasing(record.easing),
          };
        })
      : nodes.slice(0, -1).map((node, index) => ({
          id: `${node.id}:${nodes[index + 1].id}`,
          fromNodeId: node.id,
          toNodeId: nodes[index + 1].id,
          enabled: true,
          hidden: false,
          transitionSeconds: 1,
          easing: "linear" as const,
        }));
  let cursor = 0;
  const nodeTimeSeconds = new Map<string, number>();
  for (const segment of segments) {
    const from = nodes.find((node) => node.id === segment.fromNodeId);
    const to = nodes.find((node) => node.id === segment.toNodeId);
    if (!from || !to) continue;
    if (!nodeTimeSeconds.has(from.id)) {
      nodeTimeSeconds.set(from.id, cursor);
    }
    cursor += from.holdSecondsAfter;
    cursor += segment.transitionSeconds;
    nodeTimeSeconds.set(to.id, cursor);
  }
  const terminalId = segments[segments.length - 1]?.toNodeId ?? nodes[0]?.id ?? null;
  const terminal = terminalId ? nodes.find((node) => node.id === terminalId) : null;
  if (terminal) cursor += terminal.holdSecondsAfter;
  const durationSeconds = Math.max(
    0,
    Math.min(
      600,
      finiteNumber((source.timeline as { durationSeconds?: unknown } | undefined)?.durationSeconds)
        ? Math.max(
            cursor,
            Number((source.timeline as { durationSeconds?: unknown }).durationSeconds),
      )
        : cursor,
    ),
  );
  const timedNodes = nodes.map((node) => ({
    ...node,
    timeSeconds: nodeTimeSeconds.get(node.id) ?? 0,
  }));

  return {
    version: 2,
    id:
      typeof source.id === "string" && source.id.trim()
        ? source.id
        : "capture-camera-path-v2",
    name:
      typeof source.name === "string" && source.name.trim()
        ? source.name
        : "Camera Path v2",
    loop: source.loop === true,
    timeline: {
      durationSeconds,
    },
    displayOptions,
    focusPoints,
    nodes: timedNodes,
    segments,
  };
}

export function validateCaptureCameraPathV2(
  path: Partial<CaptureCameraPathV2> | null | undefined,
): CaptureCameraPathV2ValidationResult {
  const errors: string[] = [];
  if (!path || !isRecord(path)) {
    return { valid: false, errors: ["cameraPathV2 is missing."] };
  }
  if (path.version !== 2) errors.push("cameraPathV2.version must be 2.");
  if (typeof path.id !== "string" || path.id.trim() === "") {
    errors.push("cameraPathV2.id is required.");
  }
  if (typeof path.name !== "string" || path.name.trim() === "") {
    errors.push("cameraPathV2.name is required.");
  }
  if (typeof path.loop !== "boolean") {
    errors.push("cameraPathV2.loop must be boolean.");
  }
  if (path.displayOptions !== undefined) {
    errors.push(
      ...validateCaptureCameraPathDisplayOptionsV2(path.displayOptions).errors,
    );
  }

  const focusIds = new Set<string>();
  if (!Array.isArray(path.focusPoints)) {
    errors.push("cameraPathV2.focusPoints must be an array.");
  } else {
    path.focusPoints.forEach((point, index) => {
      if (!isRecord(point)) {
        errors.push(`cameraPathV2.focusPoints[${index}] must be an object.`);
        return;
      }
      if (typeof point.id !== "string" || point.id.trim() === "") {
        errors.push(`cameraPathV2.focusPoints[${index}].id is required.`);
      } else if (focusIds.has(point.id)) {
        errors.push(`cameraPathV2 duplicate focus point id: ${point.id}.`);
      } else {
        focusIds.add(point.id);
      }
      if (!vec3(point.position)) {
        errors.push(`cameraPathV2.focusPoints[${index}].position must be a valid vec3.`);
      }
      if (point.picked !== undefined && typeof point.picked !== "boolean") {
        errors.push(`cameraPathV2.focusPoints[${index}].picked must be boolean.`);
      }
    });
  }

  const nodeIds = new Set<string>();
  if (!Array.isArray(path.nodes)) {
    errors.push("cameraPathV2.nodes must be an array.");
  } else {
    path.nodes.forEach((node, index) => {
      if (!isRecord(node)) {
        errors.push(`cameraPathV2.nodes[${index}] must be an object.`);
        return;
      }
      if (typeof node.id !== "string" || node.id.trim() === "") {
        errors.push(`cameraPathV2.nodes[${index}].id is required.`);
      } else if (nodeIds.has(node.id)) {
        errors.push(`cameraPathV2 duplicate node id: ${node.id}.`);
      } else {
        nodeIds.add(node.id);
      }
      if (node.kind !== "keyframe" && node.kind !== "transition") {
        errors.push(`cameraPathV2.nodes[${index}].kind is not supported.`);
      }
      if (node.enabled !== undefined && typeof node.enabled !== "boolean") {
        errors.push(`cameraPathV2.nodes[${index}].enabled must be boolean.`);
      }
      if (node.hidden !== undefined && typeof node.hidden !== "boolean") {
        errors.push(`cameraPathV2.nodes[${index}].hidden must be boolean.`);
      }
      if (node.label !== undefined && typeof node.label !== "string") {
        errors.push(`cameraPathV2.nodes[${index}].label must be a string.`);
      }
      if (!vec3(node.position)) {
        errors.push(`cameraPathV2.nodes[${index}].position must be a valid vec3.`);
      }
      if (node.target !== undefined && !vec3(node.target)) {
        errors.push(`cameraPathV2.nodes[${index}].target must be a valid vec3.`);
      }
      if (!vec3(node.up)) {
        errors.push(`cameraPathV2.nodes[${index}].up must be a valid vec3.`);
      }
      if (!finiteNumber(node.fov) || node.fov <= 0 || node.fov > 180) {
        errors.push(`cameraPathV2.nodes[${index}].fov must be between 0 and 180.`);
      }
      if (
        node.lookMode !== "free-direction" &&
        node.lookMode !== "focus-point-lock" &&
        node.lookMode !== "follow-path-tangent"
      ) {
        errors.push(`cameraPathV2.nodes[${index}].lookMode is not supported.`);
      }
      if (!finiteNumber(node.holdSecondsAfter) || node.holdSecondsAfter < 0) {
        errors.push(`cameraPathV2.nodes[${index}].holdSecondsAfter must be non-negative.`);
      }
      if (node.kind === "transition" && node.holdSecondsAfter !== 0) {
        errors.push(`cameraPathV2.nodes[${index}] transition nodes cannot hold.`);
      }
      if (node.lookMode === "free-direction" && !vec3(node.target)) {
        errors.push(`cameraPathV2.nodes[${index}].target is required for free-direction.`);
      }
      if (node.lookMode === "focus-point-lock") {
        if (typeof node.focusPointId !== "string" || node.focusPointId.trim() === "") {
          errors.push(
            `cameraPathV2.nodes[${index}].focusPointId is required for focus-point-lock.`,
          );
        } else if (!focusIds.has(node.focusPointId)) {
          errors.push(
            `cameraPathV2.nodes[${index}].focusPointId must reference a focus point.`,
          );
        }
      }
    });
  }

  const segmentIds = new Set<string>();
  if (!Array.isArray(path.segments)) {
    errors.push("cameraPathV2.segments must be an array.");
  } else {
    path.segments.forEach((segment, index) => {
      if (!isRecord(segment)) {
        errors.push(`cameraPathV2.segments[${index}] must be an object.`);
        return;
      }
      if (typeof segment.id !== "string" || segment.id.trim() === "") {
        errors.push(`cameraPathV2.segments[${index}].id is required.`);
      } else if (segmentIds.has(segment.id)) {
        errors.push(`cameraPathV2 duplicate segment id: ${segment.id}.`);
      } else {
        segmentIds.add(segment.id);
      }
      if (typeof segment.fromNodeId !== "string" || !nodeIds.has(segment.fromNodeId)) {
        errors.push(`cameraPathV2.segments[${index}].fromNodeId must reference a node.`);
      }
      if (typeof segment.toNodeId !== "string" || !nodeIds.has(segment.toNodeId)) {
        errors.push(`cameraPathV2.segments[${index}].toNodeId must reference a node.`);
      }
      if (segment.enabled !== undefined && typeof segment.enabled !== "boolean") {
        errors.push(`cameraPathV2.segments[${index}].enabled must be boolean.`);
      }
      if (segment.hidden !== undefined && typeof segment.hidden !== "boolean") {
        errors.push(`cameraPathV2.segments[${index}].hidden must be boolean.`);
      }
      if (
        segment.easing !== undefined &&
        segment.easing !== "linear" &&
        segment.easing !== "ease-in-out"
      ) {
        errors.push(`cameraPathV2.segments[${index}].easing is not supported.`);
      }
      if (
        !finiteNumber(segment.transitionSeconds) ||
        segment.transitionSeconds < 0
      ) {
        errors.push(
          `cameraPathV2.segments[${index}].transitionSeconds must be non-negative.`,
        );
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function captureCameraPathV2NodeId(index: number): string {
  return `camera-node-${String(index + 1).padStart(2, "0")}`;
}

export function captureCameraPathV2SegmentId(
  fromNodeId: string,
  toNodeId: string,
): string {
  return `${fromNodeId}:${toNodeId}`;
}

export function captureCameraPathV2HasAuthoredNodes(
  inputPath: CaptureCameraPathV2,
): boolean {
  return normalizeCaptureCameraPathV2(inputPath).nodes.length > 0;
}

export function captureCameraPathV2EnabledNodes(
  inputPath: CaptureCameraPathV2,
): CaptureCameraPathNodeV2[] {
  return normalizeCaptureCameraPathV2(inputPath).nodes.filter(
    (node) => node.enabled !== false,
  );
}

export function captureCameraPathV2EnabledSegments(
  inputPath: CaptureCameraPathV2,
): CaptureCameraPathSegmentV2[] {
  const path = normalizeCaptureCameraPathV2(inputPath);
  const enabledNodeIds = new Set(
    path.nodes.filter((node) => node.enabled !== false).map((node) => node.id),
  );
  return path.segments.filter(
    (segment) =>
      segment.enabled !== false &&
      enabledNodeIds.has(segment.fromNodeId) &&
      enabledNodeIds.has(segment.toNodeId),
  );
}

function enabledPathForSampling(inputPath: CaptureCameraPathV2): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  const nodes = path.nodes.filter((node) => node.enabled !== false);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const segments = path.segments.filter(
    (segment) =>
      segment.enabled !== false &&
      nodeIds.has(segment.fromNodeId) &&
      nodeIds.has(segment.toNodeId),
  );
  return {
    ...path,
    nodes,
    segments,
  };
}

export function captureCameraPathV2Renderable(inputPath: CaptureCameraPathV2): boolean {
  const path = enabledPathForSampling(inputPath);
  if (path.nodes.length < 2) return false;
  return resolveCaptureCameraPathV2Timeline(path).durationSeconds > 0;
}

export function validateCaptureCameraPathV2Playback(
  inputPath: CaptureCameraPathV2,
): CaptureCameraPathV2ValidationResult {
  const validation = validateCaptureCameraPathV2(inputPath);
  const errors = [...validation.errors];
  const path = enabledPathForSampling(inputPath);
  if (path.nodes.length < 2) {
    errors.push("Add at least two active camera views before playing the path.");
  }
  if (path.nodes.length >= 2 && path.segments.length === 0) {
    errors.push("Enable at least one transition between active camera views.");
  }
  const timeline = resolveCaptureCameraPathV2Timeline(path);
  if (timeline.durationSeconds <= 0) {
    errors.push("Camera path duration must be greater than zero.");
  }
  return { valid: errors.length === 0, errors };
}

export function cameraPathV2NodeFromPose({
  id,
  kind,
  pose,
  holdSecondsAfter = 0,
  lookMode = "free-direction",
  focusPointId,
}: {
  id: string;
  kind: CaptureCameraPathNodeKindV2;
  pose: CaptureCameraPathPose;
  holdSecondsAfter?: number;
  lookMode?: CaptureCameraPathLookModeV2;
  focusPointId?: string | null;
}): CaptureCameraPathNodeV2 {
  return {
    id,
    kind,
    timeSeconds: 0,
    enabled: true,
    hidden: false,
    position: cloneVec3(pose.position),
    target: cloneVec3(pose.target),
    up: cloneVec3(pose.up),
    fov: safeFov(pose.fov),
    holdSecondsAfter: kind === "transition" ? 0 : safeSeconds(holdSecondsAfter),
    lookMode,
    ...(focusPointId ? { focusPointId } : {}),
  };
}

export function linearizeCaptureCameraPathV2Transitions(
  inputPath: CaptureCameraPathV2,
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  return normalizeCaptureCameraPathV2({
    ...path,
    nodes: path.nodes.map((node) =>
      node.kind === "transition"
        ? { ...node, holdSecondsAfter: 0 }
        : node,
    ),
    segments: path.segments.map((segment) => ({
      ...segment,
      easing: "linear" as const,
    })),
  });
}

export function insertCaptureCameraPathV2Orbit360(
  inputPath: CaptureCameraPathV2,
  sourceNodeId: string | null | undefined,
  options: {
    orbitDurationSeconds?: number;
    orbitStepCount?: number;
  } = {},
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  const sourceIndex = path.nodes.findIndex((node) => node.id === sourceNodeId);
  if (sourceIndex < 0) return path;
  const sourceNode = path.nodes[sourceIndex];
  if (sourceNode.kind !== "keyframe") return path;

  const orbitStepCount = Math.max(
    4,
    Math.min(32, Math.round(options.orbitStepCount ?? 12)),
  );
  const orbitDurationSeconds =
    Number.isFinite(options.orbitDurationSeconds) &&
    (options.orbitDurationSeconds ?? 0) > 0
      ? Math.min(120, Math.max(0.1, options.orbitDurationSeconds ?? 4))
      : 4;
  const orbitStepSeconds = orbitDurationSeconds / orbitStepCount;
  const sourcePose = poseFromNode(path, sourceNode);
  const offset = subVec3(sourcePose.position, sourcePose.target);
  const horizontalRadius = Math.hypot(offset[0], offset[1]);
  const radius = horizontalRadius > 0.000_001 ? horizontalRadius : 1;
  const startAngle = horizontalRadius > 0.000_001 ? Math.atan2(offset[1], offset[0]) : 0;
  const zOffset = offset[2];
  const orbitNodes: CaptureCameraPathNodeV2[] = [];
  for (let step = 1; step <= orbitStepCount; step += 1) {
    const angle = startAngle + (Math.PI * 2 * step) / orbitStepCount;
    const position: CaptureVec3 =
      step === orbitStepCount
        ? cloneVec3(sourcePose.position)
        : [
            sourcePose.target[0] + Math.cos(angle) * radius,
            sourcePose.target[1] + Math.sin(angle) * radius,
            sourcePose.target[2] + zOffset,
          ];
    orbitNodes.push({
      ...cameraPathV2NodeFromPose({
        id: uniqueNodeId(path, `${sourceNode.id}-orbit-${String(step).padStart(2, "0")}`),
        kind: "transition",
        pose: {
          position,
          target: cloneVec3(sourcePose.target),
          up: cloneVec3(sourcePose.up),
          fov: sourcePose.fov,
        },
        lookMode: sourceNode.lookMode,
        focusPointId: sourceNode.focusPointId,
      }),
      label: `Orbit 360 ${step}/${orbitStepCount}`,
    });
  }

  const outgoingSegment = path.segments.find(
    (segment) => segment.fromNodeId === sourceNode.id,
  );
  const orbitSegments: CaptureCameraPathSegmentV2[] = [];
  let fromNodeId = sourceNode.id;
  for (const orbitNode of orbitNodes) {
    orbitSegments.push({
      id: captureCameraPathV2SegmentId(fromNodeId, orbitNode.id),
      fromNodeId,
      toNodeId: orbitNode.id,
      enabled: true,
      hidden: false,
      transitionSeconds: orbitStepSeconds,
      easing: "linear",
    });
    fromNodeId = orbitNode.id;
  }
  if (outgoingSegment) {
    // The exit segment keeps its authored easing; only the orbit steps are
    // forced to constant-speed linear so the 360 spin reads evenly.
    orbitSegments.push({
      ...outgoingSegment,
      id: captureCameraPathV2SegmentId(fromNodeId, outgoingSegment.toNodeId),
      fromNodeId,
    });
  }

  const nodes = [
    ...path.nodes.slice(0, sourceIndex + 1),
    ...orbitNodes,
    ...path.nodes.slice(sourceIndex + 1),
  ];
  const segments = outgoingSegment
    ? path.segments.flatMap((segment) =>
        segment.id === outgoingSegment.id ? orbitSegments : [segment],
      )
    : [...path.segments, ...orbitSegments];

  return normalizeCaptureCameraPathV2({
    ...path,
    nodes,
    segments,
  });
}

export function resolveCaptureCameraPathV2Timeline(
  inputPath: CaptureCameraPathV2,
): CaptureCameraPathV2Timeline {
  const path = enabledPathForSampling(inputPath);
  const nodes = nodeById(path);
  const entries: CaptureCameraPathV2TimelineEntry[] = [];
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
    const holdSeconds = from.holdSecondsAfter;
    if (holdSeconds > 0) {
      entries.push({
        kind: "hold",
        nodeId: from.id,
        startSeconds: cursor,
        endSeconds: cursor + holdSeconds,
        durationSeconds: holdSeconds,
      });
      cursor += holdSeconds;
    }
    const transitionSeconds = segment.transitionSeconds;
    entries.push({
      kind: "transition",
      segmentId: segment.id,
      fromNodeId: from.id,
      toNodeId: to.id,
      easing: segment.easing,
      startSeconds: cursor,
      endSeconds: cursor + transitionSeconds,
      durationSeconds: transitionSeconds,
    });
    cursor += transitionSeconds;
    nodeTimeSeconds[to.id] = cursor;
  }

  const terminalId = path.segments[path.segments.length - 1]?.toNodeId ?? path.nodes[0].id;
  const terminal = nodes.get(terminalId) ?? path.nodes[path.nodes.length - 1];
  if (terminal && terminal.holdSecondsAfter > 0) {
    entries.push({
      kind: "hold",
      nodeId: terminal.id,
      startSeconds: cursor,
      endSeconds: cursor + terminal.holdSecondsAfter,
      durationSeconds: terminal.holdSecondsAfter,
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

export function sampleCaptureCameraPathV2(
  inputPath: CaptureCameraPathV2,
  timeSeconds: number,
): CaptureCameraPathV2Sample {
  const path = enabledPathForSampling(inputPath);
  const timeline = resolveCaptureCameraPathV2Timeline(path);
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
  const duration = timeline.durationSeconds;
  const safeTime =
    path.loop && duration > 0
      ? ((timeSeconds % duration) + duration) % duration
      : Math.max(0, Math.min(duration, finiteNumber(timeSeconds) ? timeSeconds : 0));
  const entry =
    timeline.entries.find(
      (candidate) =>
        safeTime >= candidate.startSeconds && safeTime < candidate.endSeconds,
    ) ?? timeline.entries[timeline.entries.length - 1] ?? null;

  if (!entry) {
    return { timeSeconds: safeTime, ...poseFromNode(path, first) };
  }
  if (entry.kind === "hold") {
    const node = (entry.nodeId ? nodes.get(entry.nodeId) : null) ?? first;
    return { timeSeconds: safeTime, ...poseFromNode(path, node) };
  }

  const from = entry.fromNodeId ? nodes.get(entry.fromNodeId) : null;
  const to = entry.toNodeId ? nodes.get(entry.toNodeId) : null;
  if (!from || !to) {
    return { timeSeconds: safeTime, ...poseFromNode(path, first) };
  }
  const localT =
    entry.durationSeconds <= 0
      ? 1
      : Math.max(
          0,
          Math.min(1, (safeTime - entry.startSeconds) / entry.durationSeconds),
        );
  const easedT =
    entry.easing === "ease-in-out"
      ? localT * localT * (3 - 2 * localT)
      : localT;
  const fromPose = poseFromNode(path, from);
  const toPose = poseFromNode(path, to);
  return {
    timeSeconds: safeTime,
    position: lerpVec3(fromPose.position, toPose.position, easedT),
    target: lerpVec3(fromPose.target, toPose.target, easedT),
    up: lerpVec3(fromPose.up, toPose.up, easedT),
    fov: lerp(fromPose.fov, toPose.fov, easedT),
  };
}

export function moveCaptureCameraPathV2NodePosition(
  inputPath: CaptureCameraPathV2,
  nodeId: string,
  position: CaptureVec3,
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  return {
    ...path,
    nodes: path.nodes.map((node) =>
      node.id === nodeId ? { ...node, position: cloneVec3(position) } : node,
    ),
  };
}

export function moveCaptureCameraPathV2NodeTarget(
  inputPath: CaptureCameraPathV2,
  nodeId: string,
  target: CaptureVec3,
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  const targetNode = path.nodes.find((node) => node.id === nodeId);
  if (targetNode?.lookMode === "focus-point-lock" && targetNode.focusPointId) {
    return {
      ...path,
      focusPoints: path.focusPoints.map((point) =>
        point.id === targetNode.focusPointId
          ? { ...point, position: cloneVec3(target) }
          : point,
      ),
    };
  }
  return {
    ...path,
    nodes: path.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            lookMode: "free-direction",
            target: cloneVec3(target),
            focusPointId: undefined,
          }
        : node,
    ),
  };
}

export function moveCaptureCameraPathV2SegmentAdjacentPositions(
  inputPath: CaptureCameraPathV2,
  segmentId: string,
  delta: CaptureVec3,
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  const segment = path.segments.find((candidate) => candidate.id === segmentId);
  if (!segment) return path;
  const adjacentIds = new Set([segment.fromNodeId, segment.toNodeId]);
  return {
    ...path,
    nodes: path.nodes.map((node) =>
      adjacentIds.has(node.id)
        ? { ...node, position: addVec3(node.position, delta) }
        : node,
    ),
  };
}

export function setCaptureCameraPathV2NodeEnabled(
  inputPath: CaptureCameraPathV2,
  nodeId: string,
  enabled: boolean,
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  return normalizeCaptureCameraPathV2({
    ...path,
    nodes: path.nodes.map((node) =>
      node.id === nodeId ? { ...node, enabled } : node,
    ),
  });
}

export function setCaptureCameraPathV2NodeHidden(
  inputPath: CaptureCameraPathV2,
  nodeId: string,
  hidden: boolean,
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  return normalizeCaptureCameraPathV2({
    ...path,
    nodes: path.nodes.map((node) =>
      node.id === nodeId ? { ...node, hidden } : node,
    ),
  });
}

export function setCaptureCameraPathV2SegmentEnabled(
  inputPath: CaptureCameraPathV2,
  segmentId: string,
  enabled: boolean,
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  return normalizeCaptureCameraPathV2({
    ...path,
    segments: path.segments.map((segment) =>
      segment.id === segmentId ? { ...segment, enabled } : segment,
    ),
  });
}

export function setCaptureCameraPathV2SegmentHidden(
  inputPath: CaptureCameraPathV2,
  segmentId: string,
  hidden: boolean,
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  return normalizeCaptureCameraPathV2({
    ...path,
    segments: path.segments.map((segment) =>
      segment.id === segmentId ? { ...segment, hidden } : segment,
    ),
  });
}

export function setCaptureCameraPathV2SegmentEasing(
  inputPath: CaptureCameraPathV2,
  segmentId: string,
  easing: "linear" | "ease-in-out",
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  return normalizeCaptureCameraPathV2({
    ...path,
    segments: path.segments.map((segment) =>
      segment.id === segmentId ? { ...segment, easing } : segment,
    ),
  });
}

export function bindCaptureCameraPathV2FocusPoint(
  inputPath: CaptureCameraPathV2,
  nodeId: string,
  focusPoint: CaptureCameraPathFocusPointV2,
): CaptureCameraPathV2 {
  const path = normalizeCaptureCameraPathV2(inputPath);
  const normalizedFocusPoint = {
    ...focusPoint,
    position: cloneVec3(focusPoint.position),
    picked: focusPoint.picked ?? true,
  };
  const hasFocusPoint = path.focusPoints.some((point) => point.id === focusPoint.id);
  return {
    ...path,
    focusPoints: hasFocusPoint
      ? path.focusPoints.map((point) =>
          point.id === focusPoint.id ? normalizedFocusPoint : point,
        )
      : [...path.focusPoints, normalizedFocusPoint],
    nodes: path.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            lookMode: "focus-point-lock",
            focusPointId: focusPoint.id,
          }
        : node,
    ),
  };
}

export function upgradeCaptureCameraPathV1ToV2(
  path: CaptureCameraPathV1Input,
): CaptureCameraPathV2 {
  const keyframes = [...path.keyframes].sort((a, b) => a.timeSeconds - b.timeSeconds);
  const nodes = keyframes.map((keyframe, index) => ({
    id: keyframe.id || `node-${String(index + 1).padStart(2, "0")}`,
    kind: "keyframe" as const,
    timeSeconds: keyframe.timeSeconds,
    enabled: true,
    hidden: false,
    position: cloneVec3(keyframe.position),
    target: cloneVec3(keyframe.target),
    up: cloneVec3(keyframe.up),
    fov: keyframe.fov,
    lookMode: "free-direction" as const,
    holdSecondsAfter:
      index === keyframes.length - 1
        ? Math.max(0, path.durationSeconds - keyframe.timeSeconds)
        : 0,
  }));
  return normalizeCaptureCameraPathV2({
    version: 2,
    id: path.id || "capture-camera-path-v2",
    name: path.name || "Camera Path v2",
    loop: path.loop === true,
    focusPoints: [],
    nodes,
    segments: keyframes.slice(0, -1).map((keyframe, index) => ({
      id: `${nodes[index].id}:${nodes[index + 1].id}`,
      fromNodeId: nodes[index].id,
      toNodeId: nodes[index + 1].id,
      enabled: true,
      hidden: false,
      transitionSeconds: Math.max(0, keyframes[index + 1].timeSeconds - keyframe.timeSeconds),
      easing: "linear" as const,
    })),
  });
}

function poseFromSample(sample: CaptureCameraPathV2Sample): CaptureCameraPathPose {
  return {
    position: cloneVec3(sample.position),
    target: cloneVec3(sample.target),
    up: cloneVec3(sample.up),
    fov: sample.fov,
  };
}

export function captureCameraPathV2ToLegacyKeyframes(
  inputPath: CaptureCameraPathV2,
): CaptureCameraPathLegacyKeyframe[] {
  const path = enabledPathForSampling(inputPath);
  const timeline = resolveCaptureCameraPathV2Timeline(path);
  return path.nodes.map((node, index) => {
    const timeSeconds = timeline.nodeTimeSeconds[node.id] ?? 0;
    return {
      timeSeconds,
      camera: poseFromSample(sampleCaptureCameraPathV2(path, timeSeconds)),
      easing: index === 0 ? "linear" : "ease-in-out",
    };
  });
}

export const cameraPathV2ToRecipeKeyframes = captureCameraPathV2ToLegacyKeyframes;

export function recipeKeyframesToCameraPathV2(
  recipe: {
    cameraKeyframes: readonly CaptureCameraPathLegacyKeyframe[];
    durationSeconds: number;
  },
  options: { id?: string; name?: string } = {},
): CaptureCameraPathV2 {
  const sorted = [...recipe.cameraKeyframes].sort(
    (a, b) => a.timeSeconds - b.timeSeconds,
  );
  const nodes = sorted.map((keyframe, index) =>
    cameraPathV2NodeFromPose({
      id: captureCameraPathV2NodeId(index),
      kind: "keyframe",
      pose: keyframe.camera,
    }),
  );
  const segments: CaptureCameraPathSegmentV2[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    segments.push({
      id: captureCameraPathV2SegmentId(nodes[index].id, nodes[index + 1].id),
      fromNodeId: nodes[index].id,
      toNodeId: nodes[index + 1].id,
      enabled: true,
      hidden: false,
      transitionSeconds: Math.max(0.1, end.timeSeconds - start.timeSeconds),
      easing: "linear",
    });
  }
  return normalizeCaptureCameraPathV2({
    version: 2,
    id: options.id ?? "capture-camera-path-v2",
    name: options.name ?? "Camera Path v2",
    loop: false,
    focusPoints: [],
    nodes,
    segments,
  });
}

export function captureCameraPathV2ToV1(path: CaptureCameraPathV2): CaptureCameraPathV1 {
  const normalized = normalizeCaptureCameraPathV2(path);
  return recipeKeyframesToCameraPath(
    {
      cameraKeyframes: captureCameraPathV2ToLegacyKeyframes(normalized).map(
        (keyframe) => ({
          frameIndex: keyframe.frameIndex,
          timeSeconds: keyframe.timeSeconds,
          camera: keyframe.camera,
          easing: keyframe.easing,
        }),
      ),
      durationSeconds: resolveCaptureCameraPathV2Timeline(normalized).durationSeconds,
    },
    { id: normalized.id.replace(/-v2$/, ""), name: normalized.name },
  );
}

export function cameraPathV2SampledPoints(
  path: CaptureCameraPathV2,
  sampleCount = 96,
): CaptureVec3[] {
  const enabledPath = enabledPathForSampling(path);
  if (enabledPath.nodes.length === 0) return [];
  if (!captureCameraPathV2Renderable(enabledPath)) {
    return enabledPath.nodes.map((node) => cloneVec3(node.position));
  }
  return captureCameraPathSampledPoints(captureCameraPathV2ToV1(enabledPath), sampleCount);
}

export function cameraPathV2SegmentIds(path: CaptureCameraPathV2): string[] {
  return captureCameraPathV2EnabledSegments(path).map((segment) => segment.id);
}

export function serializeCaptureCameraPathV2(path: CaptureCameraPathV2): string {
  return `${JSON.stringify(normalizeCaptureCameraPathV2(path), null, 2)}\n`;
}

export function parseCaptureCameraPathV2Json(text: string): {
  path: CaptureCameraPathV2 | null;
  validation: CaptureCameraPathV2ValidationResult;
} {
  try {
    const parsed = JSON.parse(text) as CaptureCameraPathV2;
    const validation = validateCaptureCameraPathV2(parsed);
    return {
      path: validation.valid ? normalizeCaptureCameraPathV2(parsed) : null,
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

export function createCaptureCameraPathV2Recorder(options: {
  getPose(): CaptureCameraPathPose;
  onTick(callback: (timeMs: number) => void): () => void;
  now?: () => number;
}): CaptureCameraPathV2Recorder {
  const now = options.now ?? (() => performance.now());
  const samples: Array<{ timeSeconds: number; pose: CaptureCameraPathPose }> = [];
  const startedAt = now();
  const captureSample = () => {
    const timeSeconds = Math.max(0, (now() - startedAt) / 1000);
    samples.push({
      timeSeconds,
      pose: options.getPose(),
    });
  };
  captureSample();
  const unsubscribe = options.onTick(() => {
    const previous = samples[samples.length - 1];
    const timeSeconds = Math.max(0, (now() - startedAt) / 1000);
    if (!previous || timeSeconds - previous.timeSeconds >= 0.15) {
      captureSample();
    }
  });
  return {
    stop() {
      unsubscribe();
      captureSample();
      const selectedSamples =
        samples.length <= 6
          ? samples
          : samples.filter(
              (_sample, index) =>
                index === 0 ||
                index === samples.length - 1 ||
                index % Math.ceil(samples.length / 6) === 0,
            );
      const nodes = selectedSamples.map((sample, index) =>
        cameraPathV2NodeFromPose({
          id: captureCameraPathV2NodeId(index),
          kind:
            index === 0 || index === selectedSamples.length - 1
              ? "keyframe"
              : "transition",
          pose: sample.pose,
        }),
      );
      const segments: CaptureCameraPathSegmentV2[] = [];
      for (let index = 0; index < nodes.length - 1; index += 1) {
        const fromSample = selectedSamples[index];
        const toSample = selectedSamples[index + 1];
        segments.push({
          id: captureCameraPathV2SegmentId(nodes[index].id, nodes[index + 1].id),
          fromNodeId: nodes[index].id,
          toNodeId: nodes[index + 1].id,
          enabled: true,
          hidden: false,
          transitionSeconds: Math.max(
            0.1,
            toSample.timeSeconds - fromSample.timeSeconds,
          ),
          easing: "linear",
        });
      }
      return normalizeCaptureCameraPathV2({
        version: 2,
        id: "capture-camera-path-v2",
        name: "Recorded Camera Path",
        loop: false,
        focusPoints: [],
        nodes,
        segments,
      });
    },
    cancel() {
      unsubscribe();
    },
  };
}
