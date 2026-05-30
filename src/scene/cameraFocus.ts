import * as THREE from "three";
import type { PerspectiveCamera } from "three";
import type { Pose, Vec3 } from "../pages/types";

const MIN_FIT_PADDING_MARGIN_PX = 32;
const MIN_FOCUS_DISTANCE_M = 5;

export function vec3FromArray(value: Vec3): THREE.Vector3 {
  return new THREE.Vector3(value[0], value[1], value[2]);
}

export function vec3ToArray(value: THREE.Vector3): Vec3 {
  return [value.x, value.y, value.z];
}

export function poseForFocusFit({
  camera,
  focusPoint,
  worldBox,
  viewport,
  paddingPx,
}: {
  camera: PerspectiveCamera;
  focusPoint: THREE.Vector3;
  worldBox: THREE.Box3 | null;
  viewport: { width: number; height: number };
  paddingPx: number;
}): Pose {
  const direction = camera.position.clone().sub(focusPoint);
  if (direction.lengthSq() < 0.0001) {
    direction.set(0, -1, 0.65);
  }
  direction.normalize();

  const sphere = new THREE.Sphere(focusPoint.clone(), 1);
  if (worldBox && !worldBox.isEmpty()) {
    worldBox.getBoundingSphere(sphere);
    sphere.radius = Math.max(sphere.radius, 1);
  }

  const width = Math.max(1, viewport.width);
  const height = Math.max(1, viewport.height);
  const safePadding = THREE.MathUtils.clamp(
    paddingPx,
    0,
    Math.max(0, Math.min(width, height) * 0.5 - MIN_FIT_PADDING_MARGIN_PX),
  );
  const usableWidth = Math.max(1, width - safePadding * 2);
  const usableHeight = Math.max(1, height - safePadding * 2);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov =
    2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const verticalDistance =
    sphere.radius / Math.sin(Math.max(0.01, verticalFov / 2));
  const horizontalDistance =
    sphere.radius / Math.sin(Math.max(0.01, horizontalFov / 2));
  const paddedDistance =
    Math.max(verticalDistance, horizontalDistance) *
    Math.max(width / usableWidth, height / usableHeight);
  const distance = Math.max(
    MIN_FOCUS_DISTANCE_M,
    paddedDistance,
    sphere.radius * 1.2,
  );
  const position = focusPoint.clone().addScaledVector(direction, distance);
  return {
    position: vec3ToArray(position),
    target: vec3ToArray(focusPoint),
    up: [camera.up.x, camera.up.y, camera.up.z],
    fov: camera.fov,
  };
}

export function poseForFocusZoom({
  camera,
  focusPoint,
  zoomFactor,
}: {
  camera: PerspectiveCamera;
  focusPoint: THREE.Vector3;
  zoomFactor: number;
}): Pose {
  const direction = camera.position.clone().sub(focusPoint);
  const currentDistance = direction.length();
  if (currentDistance < 0.0001) {
    direction.set(0, -1, 0.65);
  }
  direction.normalize();
  const distance = Math.max(
    MIN_FOCUS_DISTANCE_M,
    currentDistance * THREE.MathUtils.clamp(zoomFactor, 0.05, 1.5),
  );
  const position = focusPoint.clone().addScaledVector(direction, distance);
  return {
    position: vec3ToArray(position),
    target: vec3ToArray(focusPoint),
    up: [camera.up.x, camera.up.y, camera.up.z],
    fov: camera.fov,
  };
}
