import type { Pose } from "../pages/types";
import type { CaptureCameraKeyframe, CaptureRecipeV1 } from "./captureRecipe";

export type CaptureCameraPathEasing = "linear" | "ease-in-out";
export type CaptureCameraPathInterpolation = "catmull-rom";
export type CaptureCameraTargetInterpolation = "linear";

export type CaptureVec3 = [number, number, number];

export interface CaptureCameraPathKeyframeV1 {
  id: string;
  timeSeconds: number;
  position: CaptureVec3;
  target: CaptureVec3;
  up: CaptureVec3;
  fov: number;
  easing: CaptureCameraPathEasing;
}

export interface CaptureCameraPathV1 {
  version: 1;
  id: string;
  name: string;
  durationSeconds: number;
  interpolation: CaptureCameraPathInterpolation;
  targetInterpolation: CaptureCameraTargetInterpolation;
  loop: boolean;
  keyframes: CaptureCameraPathKeyframeV1[];
}

export interface CaptureCameraPathSample {
  timeSeconds: number;
  position: CaptureVec3;
  target: CaptureVec3;
  up: CaptureVec3;
  fov: number;
}

export interface CaptureCameraPathValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CaptureCameraPathCreateOptions {
  id?: string;
  name?: string;
  loop?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function cloneVec3(value: CaptureVec3): CaptureVec3 {
  return [value[0], value[1], value[2]];
}

function vec3FromPose(value: Pose["position"]): CaptureVec3 {
  return [value[0], value[1], value[2]];
}

function vec3(value: unknown): value is CaptureVec3 {
  return Array.isArray(value) && value.length === 3 && value.every(finiteNumber);
}

function addVec3(a: CaptureVec3, b: CaptureVec3): CaptureVec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subVec3(a: CaptureVec3, b: CaptureVec3): CaptureVec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function mulVec3(a: CaptureVec3, scalar: number): CaptureVec3 {
  return [a[0] * scalar, a[1] * scalar, a[2] * scalar];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: CaptureVec3, b: CaptureVec3, t: number): CaptureVec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function distance(a: CaptureVec3, b: CaptureVec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function ease(t: number, easing: CaptureCameraPathEasing): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (easing !== "ease-in-out") return clamped;
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

function catmullRomVec3(
  p0: CaptureVec3,
  p1: CaptureVec3,
  p2: CaptureVec3,
  p3: CaptureVec3,
  t: number,
): CaptureVec3 {
  const t0 = 0;
  const t1 = t0 + Math.sqrt(Math.max(0.000_001, distance(p0, p1)));
  const t2 = t1 + Math.sqrt(Math.max(0.000_001, distance(p1, p2)));
  const t3 = t2 + Math.sqrt(Math.max(0.000_001, distance(p2, p3)));
  const localT = t1 + (t2 - t1) * Math.max(0, Math.min(1, t));

  const interpolate = (
    a: CaptureVec3,
    b: CaptureVec3,
    ta: number,
    tb: number,
  ): CaptureVec3 => {
    const span = Math.max(0.000_001, tb - ta);
    return addVec3(mulVec3(a, (tb - localT) / span), mulVec3(b, (localT - ta) / span));
  };

  const a1 = interpolate(p0, p1, t0, t1);
  const a2 = interpolate(p1, p2, t1, t2);
  const a3 = interpolate(p2, p3, t2, t3);
  const b1 = addVec3(
    mulVec3(a1, (t2 - localT) / Math.max(0.000_001, t2 - t0)),
    mulVec3(a2, (localT - t0) / Math.max(0.000_001, t2 - t0)),
  );
  const b2 = addVec3(
    mulVec3(a2, (t3 - localT) / Math.max(0.000_001, t3 - t1)),
    mulVec3(a3, (localT - t1) / Math.max(0.000_001, t3 - t1)),
  );
  return addVec3(
    mulVec3(b1, (t2 - localT) / Math.max(0.000_001, t2 - t1)),
    mulVec3(b2, (localT - t1) / Math.max(0.000_001, t2 - t1)),
  );
}

function keyframeFromPose(
  keyframe: CaptureCameraKeyframe,
  index: number,
): CaptureCameraPathKeyframeV1 {
  return {
    id: `camera-${String(index + 1).padStart(2, "0")}`,
    timeSeconds: keyframe.timeSeconds,
    position: vec3FromPose(keyframe.camera.position),
    target: vec3FromPose(keyframe.camera.target),
    up: vec3FromPose(keyframe.camera.up),
    fov: keyframe.camera.fov,
    easing: keyframe.easing ?? "linear",
  };
}

export function poseFromCaptureCameraPathKeyframe(
  keyframe: CaptureCameraPathKeyframeV1 | CaptureCameraPathSample,
): Pose {
  return {
    position: cloneVec3(keyframe.position),
    target: cloneVec3(keyframe.target),
    up: cloneVec3(keyframe.up),
    fov: keyframe.fov,
  };
}

export function normalizeCaptureCameraPath(
  path: CaptureCameraPathV1,
): CaptureCameraPathV1 {
  return {
    version: 1,
    id: path.id || "capture-camera-path",
    name: path.name || "Camera Path",
    durationSeconds: Math.max(0.1, path.durationSeconds),
    interpolation: "catmull-rom",
    targetInterpolation: "linear",
    loop: path.loop === true,
    keyframes: [...path.keyframes]
      .map((keyframe, index) => ({
        id: keyframe.id || `camera-${String(index + 1).padStart(2, "0")}`,
        timeSeconds: keyframe.timeSeconds,
        position: cloneVec3(keyframe.position),
        target: cloneVec3(keyframe.target),
        up: cloneVec3(keyframe.up),
        fov: keyframe.fov,
        easing: keyframe.easing ?? "linear",
      }))
      .sort((a, b) => a.timeSeconds - b.timeSeconds),
  };
}

export function validateCaptureCameraPath(
  path: Partial<CaptureCameraPathV1> | null | undefined,
  durationSeconds = path?.durationSeconds ?? 0,
): CaptureCameraPathValidationResult {
  const errors: string[] = [];
  if (!path || !isRecord(path)) {
    return { valid: false, errors: ["cameraPath is missing."] };
  }
  if (path.version !== 1) errors.push("cameraPath.version must be 1.");
  if (typeof path.id !== "string" || path.id.trim() === "") {
    errors.push("cameraPath.id is required.");
  }
  if (typeof path.name !== "string" || path.name.trim() === "") {
    errors.push("cameraPath.name is required.");
  }
  if (
    !finiteNumber(path.durationSeconds) ||
    path.durationSeconds <= 0 ||
    path.durationSeconds > 600
  ) {
    errors.push("cameraPath.durationSeconds must be between 0 and 600.");
  }
  if (path.interpolation !== "catmull-rom") {
    errors.push("cameraPath.interpolation must be catmull-rom.");
  }
  if (path.targetInterpolation !== "linear") {
    errors.push("cameraPath.targetInterpolation must be linear.");
  }
  if (typeof path.loop !== "boolean") {
    errors.push("cameraPath.loop must be boolean.");
  }
  if (!Array.isArray(path.keyframes)) {
    errors.push("cameraPath.keyframes must be an array.");
  } else {
    const seen = new Set<string>();
    path.keyframes.forEach((keyframe, index) => {
      if (!isRecord(keyframe)) {
        errors.push(`cameraPath.keyframes[${index}] must be an object.`);
        return;
      }
      if (typeof keyframe.id !== "string" || keyframe.id.trim() === "") {
        errors.push(`cameraPath.keyframes[${index}].id is required.`);
      }
      if (!finiteNumber(keyframe.timeSeconds) || keyframe.timeSeconds < 0) {
        errors.push(`cameraPath.keyframes[${index}].timeSeconds must be non-negative.`);
      } else {
        if (keyframe.timeSeconds > durationSeconds) {
          errors.push(
            `cameraPath.keyframes[${index}].timeSeconds must not exceed durationSeconds.`,
          );
        }
        const key = keyframe.timeSeconds.toFixed(6);
        if (seen.has(key)) errors.push("cameraPath keyframe times must be unique.");
        seen.add(key);
      }
      if (!vec3(keyframe.position)) {
        errors.push(`cameraPath.keyframes[${index}].position must be a valid vec3.`);
      }
      if (!vec3(keyframe.target)) {
        errors.push(`cameraPath.keyframes[${index}].target must be a valid vec3.`);
      }
      if (!vec3(keyframe.up)) {
        errors.push(`cameraPath.keyframes[${index}].up must be a valid vec3.`);
      }
      if (!finiteNumber(keyframe.fov) || keyframe.fov <= 0 || keyframe.fov > 180) {
        errors.push(`cameraPath.keyframes[${index}].fov must be between 0 and 180.`);
      }
      if (keyframe.easing !== "linear" && keyframe.easing !== "ease-in-out") {
        errors.push(`cameraPath.keyframes[${index}].easing is not supported.`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

export function createCaptureCameraPathFromKeyframes(
  keyframes: readonly CaptureCameraPathKeyframeV1[],
  durationSeconds: number,
  options: CaptureCameraPathCreateOptions = {},
): CaptureCameraPathV1 {
  return normalizeCaptureCameraPath({
    version: 1,
    id: options.id ?? "capture-camera-path",
    name: options.name ?? "Camera Path",
    durationSeconds,
    interpolation: "catmull-rom",
    targetInterpolation: "linear",
    loop: options.loop === true,
    keyframes: keyframes.map((keyframe, index) => ({
      ...keyframe,
      id: keyframe.id || `camera-${String(index + 1).padStart(2, "0")}`,
      position: cloneVec3(keyframe.position),
      target: cloneVec3(keyframe.target),
      up: cloneVec3(keyframe.up),
      easing: keyframe.easing ?? "linear",
    })),
  });
}

export function sampleCaptureCameraPath(
  inputPath: CaptureCameraPathV1,
  timeSeconds: number,
): CaptureCameraPathSample {
  const path = normalizeCaptureCameraPath(inputPath);
  if (path.keyframes.length === 0) {
    return {
      timeSeconds: 0,
      position: [0, 0, 0],
      target: [0, 0, 0],
      up: [0, 0, 1],
      fov: 50,
    };
  }
  const safeTime = path.loop
    ? ((timeSeconds % path.durationSeconds) + path.durationSeconds) %
      path.durationSeconds
    : Math.max(0, Math.min(path.durationSeconds, timeSeconds));
  if (safeTime <= path.keyframes[0].timeSeconds) {
    const first = path.keyframes[0];
    return { ...poseFromCaptureCameraPathKeyframe(first), timeSeconds: safeTime };
  }
  const last = path.keyframes[path.keyframes.length - 1];
  if (safeTime >= last.timeSeconds) {
    return { ...poseFromCaptureCameraPathKeyframe(last), timeSeconds: safeTime };
  }
  for (let index = 0; index < path.keyframes.length - 1; index += 1) {
    const start = path.keyframes[index];
    const end = path.keyframes[index + 1];
    if (safeTime < start.timeSeconds || safeTime > end.timeSeconds) continue;
    const span = Math.max(0.000_001, end.timeSeconds - start.timeSeconds);
    const localT = ease((safeTime - start.timeSeconds) / span, end.easing);
    const previous = path.keyframes[Math.max(0, index - 1)] ?? start;
    const next = path.keyframes[Math.min(path.keyframes.length - 1, index + 2)] ?? end;
    return {
      timeSeconds: safeTime,
      position: catmullRomVec3(
        previous.position,
        start.position,
        end.position,
        next.position,
        localT,
      ),
      target: lerpVec3(start.target, end.target, localT),
      up: lerpVec3(start.up, end.up, localT),
      fov: lerp(start.fov, end.fov, localT),
    };
  }
  return { ...poseFromCaptureCameraPathKeyframe(last), timeSeconds: safeTime };
}

export function moveCaptureCameraPathKeyframe(
  inputPath: CaptureCameraPathV1,
  keyframeId: string,
  position: CaptureVec3,
): CaptureCameraPathV1 {
  const path = normalizeCaptureCameraPath(inputPath);
  return {
    ...path,
    keyframes: path.keyframes.map((keyframe) =>
      keyframe.id === keyframeId ? { ...keyframe, position: cloneVec3(position) } : keyframe,
    ),
  };
}

export function moveCaptureCameraPathSegment(
  inputPath: CaptureCameraPathV1,
  segmentId: string,
  delta: CaptureVec3,
): CaptureCameraPathV1 {
  const path = normalizeCaptureCameraPath(inputPath);
  const [startId, endId] = segmentId.split(":");
  return {
    ...path,
    keyframes: path.keyframes.map((keyframe) =>
      keyframe.id === startId || keyframe.id === endId
        ? { ...keyframe, position: addVec3(keyframe.position, delta) }
        : keyframe,
    ),
  };
}

export function cameraPathToRecipeKeyframes(
  path: CaptureCameraPathV1,
): CaptureCameraKeyframe[] {
  return normalizeCaptureCameraPath(path).keyframes.map((keyframe) => ({
    timeSeconds: keyframe.timeSeconds,
    camera: poseFromCaptureCameraPathKeyframe(keyframe),
    easing: keyframe.easing,
  }));
}

export function recipeKeyframesToCameraPath(
  recipe: Pick<CaptureRecipeV1, "cameraKeyframes" | "durationSeconds">,
  options: CaptureCameraPathCreateOptions = {},
): CaptureCameraPathV1 {
  return createCaptureCameraPathFromKeyframes(
    recipe.cameraKeyframes.map(keyframeFromPose),
    recipe.durationSeconds,
    options,
  );
}

export function captureCameraPathSegmentIds(path: CaptureCameraPathV1): string[] {
  const keyframes = normalizeCaptureCameraPath(path).keyframes;
  const segmentIds: string[] = [];
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    segmentIds.push(`${keyframes[index].id}:${keyframes[index + 1].id}`);
  }
  return segmentIds;
}

export function captureCameraPathSampledPoints(
  path: CaptureCameraPathV1,
  sampleCount = 64,
): CaptureVec3[] {
  const safeCount = Math.max(2, Math.min(512, Math.round(sampleCount)));
  const points: CaptureVec3[] = [];
  for (let index = 0; index < safeCount; index += 1) {
    const t = index / (safeCount - 1);
    points.push(sampleCaptureCameraPath(path, path.durationSeconds * t).position);
  }
  return points;
}

export function captureCameraPathDelta(
  from: CaptureVec3,
  to: CaptureVec3,
): CaptureVec3 {
  return subVec3(to, from);
}
