import type {
  DynamicCamera,
  DynamicCameraCurve,
  Pose,
  PresentationPage,
  Vec3,
} from "./types";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
  const n = finiteNumber(value, fallback);
  return n > 0 ? n : fallback;
}

function curveEnvelope(value: number, curve: DynamicCameraCurve): number {
  const t = clamp01(value);
  if (curve === "linear") return t;
  if (curve === "cinematic") return easeOutCubic(t);
  return t * t * (3 - 2 * t);
}

function dynamicOrbitEnabled(dynamic: DynamicCamera | undefined): boolean {
  return dynamic?.enabled === true && dynamic.orbitEnabled !== false;
}

// Camera policy: a dynamic orbit radius is authored relative to the page's
// framing distance (baseRadius = the authored camera's horizontal offset from
// the POI). A runaway authored value (fat-fingered, or a control/scroll
// overflow) can fling the camera entirely out of the scene, collapsing every
// layer to a sub-pixel speck. Clamp the orbit radius to a generous multiple of
// the authored framing distance so no single page can push the camera out of
// the world. Legit authored ratios across the deck top out near ~2.2x; 8x
// leaves wide headroom while still catching order-of-magnitude runaways.
export const MAX_ORBIT_RADIUS_FRAMING_FACTOR = 8;

export function clampDynamicOrbitRadius(
  authoredRadius: number,
  baseRadius: number,
): number {
  const safeBase =
    Number.isFinite(baseRadius) && baseRadius > 0 ? baseRadius : 1;
  if (!Number.isFinite(authoredRadius) || authoredRadius <= 0) return safeBase;
  return Math.min(authoredRadius, safeBase * MAX_ORBIT_RADIUS_FRAMING_FACTOR);
}

function dynamicZoomEnabled(
  dynamic: DynamicCamera | undefined,
  basePose: Pose,
): boolean {
  if (dynamic?.enabled !== true) return false;
  if (dynamic.zoomEnabled === true) return true;
  if (dynamic.zoomEnabled === false) return false;
  return (
    typeof dynamic.zoomFov === "number" &&
    Number.isFinite(dynamic.zoomFov) &&
    Math.abs(dynamic.zoomFov - basePose.fov) > 0.01
  );
}

function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vecLength(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function vecNormalize(v: Vec3, fallback: Vec3): Vec3 {
  const length = vecLength(v);
  if (length <= 0.000001) return fallback;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function vecCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vecScale(v: Vec3, amount: number): Vec3 {
  return [v[0] * amount, v[1] * amount, v[2] * amount];
}

function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function shotProgress(dynamic: DynamicCamera, elapsedMs: number): number {
  const start = Math.max(0, finiteNumber(dynamic.shotStartMs, 0));
  const end = Math.max(start + 1, finiteNumber(dynamic.shotEndMs, 2500));
  return curveEnvelope(
    (elapsedMs - start) / Math.max(1, end - start),
    dynamic.shotCurve ?? "smooth",
  );
}

function applyShotAxes(
  dynamic: DynamicCamera,
  pose: Pose,
  elapsedMs: number,
): Pose {
  if (
    dynamic.dollyEnabled !== true &&
    dynamic.truckEnabled !== true &&
    dynamic.craneEnabled !== true
  ) {
    return pose;
  }

  const amount = shotProgress(dynamic, elapsedMs);
  if (amount <= 0) return pose;

  const forward = vecNormalize(vecSub(pose.target, pose.position), [0, 1, 0]);
  const up = vecNormalize(pose.up, [0, 0, 1]);
  const right = vecNormalize(vecCross(forward, up), [1, 0, 0]);
  let offset: Vec3 = [0, 0, 0];

  if (dynamic.dollyEnabled === true) {
    offset = vecAdd(
      offset,
      vecScale(forward, finiteNumber(dynamic.dollyDistanceM, 0) * amount),
    );
  }
  if (dynamic.truckEnabled === true) {
    offset = vecAdd(
      offset,
      vecScale(right, finiteNumber(dynamic.truckDistanceM, 0) * amount),
    );
  }
  if (dynamic.craneEnabled === true) {
    offset = vecAdd(
      offset,
      vecScale(up, finiteNumber(dynamic.craneHeightM, 0) * amount),
    );
  }

  return {
    ...pose,
    position: vecAdd(pose.position, offset),
    target: vecAdd(pose.target, offset),
  };
}

function applyHandheldPolish(
  dynamic: DynamicCamera,
  pose: Pose,
  elapsedMs: number,
): Pose {
  const amplitude = Math.max(0, finiteNumber(dynamic.handheldAmplitudeM, 0));
  const handheld = dynamic.handheldEnabled === true && amplitude > 0;
  const rollDeg = finiteNumber(dynamic.rollDeg, 0);
  if (!handheld && Math.abs(rollDeg) <= 0.0001) return pose;

  const forward = vecNormalize(vecSub(pose.target, pose.position), [0, 1, 0]);
  const baseUp = vecNormalize(pose.up, [0, 0, 1]);
  const right = vecNormalize(vecCross(forward, baseUp), [1, 0, 0]);
  let offset: Vec3 = [0, 0, 0];

  if (handheld) {
    const frequency = Math.max(0, finiteNumber(dynamic.handheldFrequencyHz, 0.35));
    const phase = (elapsedMs / 1000) * frequency * TWO_PI;
    offset = vecAdd(offset, vecScale(right, Math.sin(phase) * amplitude * 0.4));
    offset = vecAdd(offset, vecScale(baseUp, -Math.sin(phase) * amplitude * 0.2));
  }

  let up = baseUp;
  if (Math.abs(rollDeg) > 0.0001) {
    const roll = -rollDeg * THREE_DEG_TO_RAD;
    up = vecNormalize(
      vecAdd(vecScale(baseUp, Math.cos(roll)), vecScale(right, Math.sin(roll))),
      baseUp,
    );
  }

  return {
    ...pose,
    position: vecAdd(pose.position, offset),
    target: vecAdd(pose.target, offset),
    up,
  };
}

export function computeDynamicPose(
  page: PresentationPage,
  basePose: Pose,
  timeMs: number,
  startMs: number,
  runtime?: { orbitBlendMs?: number },
): Pose {
  const dynamic = page.dynamicCamera;
  if (dynamic?.enabled !== true) return basePose;
  const elapsedMs = Math.max(0, timeMs - startMs);
  const poi = dynamic.poi ?? basePose.target;
  let position = basePose.position;
  let target = basePose.target;

  if (dynamicOrbitEnabled(dynamic)) {
    const easeMs = Math.max(
      0,
      finiteNumber(runtime?.orbitBlendMs, finiteNumber(dynamic.easeInMs, 1600)),
    );
    const blend = easeMs <= 0 ? 1 : easeOutCubic(elapsedMs / easeMs);
    const baseDx = basePose.position[0] - poi[0];
    const baseDy = basePose.position[1] - poi[1];
    const baseRadius = Math.max(1, Math.hypot(baseDx, baseDy));
    const radius = clampDynamicOrbitRadius(
      positiveNumber(dynamic.orbitRadius, baseRadius),
      baseRadius,
    );
    const height = finiteNumber(
      dynamic.orbitHeight,
      basePose.position[2] - poi[2],
    );
    const speedDeg = finiteNumber(dynamic.orbitSpeedDegPerSec, 4);
    const direction = dynamic.orbitDirection === -1 ? -1 : 1;
    const baseAngle = Math.atan2(baseDy, baseDx);
    const angle =
      baseAngle +
      direction * THREE_DEG_TO_RAD * speedDeg * (elapsedMs / 1000);
    const orbitX = poi[0] + Math.cos(angle) * radius;
    const orbitY = poi[1] + Math.sin(angle) * radius;
    const orbitZ = poi[2] + height;
    position = [
      lerp(basePose.position[0], orbitX, blend),
      lerp(basePose.position[1], orbitY, blend),
      lerp(basePose.position[2], orbitZ, blend),
    ];
    target = [
      lerp(basePose.target[0], poi[0], blend),
      lerp(basePose.target[1], poi[1], blend),
      lerp(basePose.target[2], poi[2], blend),
    ];
  }

  let fov = basePose.fov;
  if (dynamicZoomEnabled(dynamic, basePose)) {
    const start = Math.max(0, finiteNumber(dynamic.zoomStartMs, 0));
    const end = Math.max(start + 1, finiteNumber(dynamic.zoomEndMs, 2500));
    const amount = curveEnvelope(
      (elapsedMs - start) / Math.max(1, end - start),
      dynamic.zoomCurve ?? "smooth",
    );
    const legacyDelta =
      typeof dynamic.zoomFov === "number" && Number.isFinite(dynamic.zoomFov)
        ? dynamic.zoomFov - basePose.fov
        : 0;
    const delta = finiteNumber(dynamic.zoomDeltaFov, legacyDelta);
    const targetFov = Math.max(15, Math.min(90, basePose.fov + delta));
    fov = lerp(basePose.fov, targetFov, amount);
  }

  const shotPose = applyShotAxes(
    dynamic,
    {
      position,
      target,
      up: basePose.up,
      fov,
    },
    elapsedMs,
  );
  return applyHandheldPolish(dynamic, shotPose, elapsedMs);
}

const THREE_DEG_TO_RAD = Math.PI / 180;
const TWO_PI = Math.PI * 2;
