import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Pose } from "./types";

// Read the current camera + controls state into a Pose. This is what the
// Week 3 authoring UI's "Capture pose" button will call -- exposing it now
// lets the dev console use it (window.__capture()) to hand-author the test
// pages without measuring against sceneOrigin manually.

export function capturePose(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
): Pose {
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
    up: [camera.up.x, camera.up.y, camera.up.z],
    fov: camera.fov,
  };
}

// Snap (no tween) into a pose. Used for the very first page on load and
// after a hard reset. Updates projection matrix and orbits target so
// OrbitControls stays consistent.
export function applyPose(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  pose: Pose,
): void {
  camera.position.set(...pose.position);
  camera.up.set(...pose.up);
  camera.fov = pose.fov;
  camera.updateProjectionMatrix();
  controls.target.set(...pose.target);
  controls.update();
}
