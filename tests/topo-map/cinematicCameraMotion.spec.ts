import { expect, test } from "@playwright/test";
import type { Pose, PresentationPage } from "../../src/pages/types";
import { computeDynamicPose } from "../../src/pages/dynamicCameraPose";

function pageWithDynamic(
  camera: Pose,
  dynamicCamera: PresentationPage["dynamicCamera"],
): PresentationPage {
  return {
    id: "shot-page",
    title: "Shot Page",
    camera,
    dynamicCamera,
    transition: { duration: 1000, easing: "linear" },
    holdDuration: 1000,
  };
}

test("computeDynamicPose applies dolly, truck, and crane in camera-local space", () => {
  const basePose: Pose = {
    position: [0, -100, 0],
    target: [0, 0, 0],
    up: [0, 0, 1],
    fov: 45,
  };
  const page = pageWithDynamic(basePose, {
    enabled: true,
    orbitEnabled: false,
    zoomEnabled: false,
    dollyEnabled: true,
    dollyDistanceM: 10,
    truckEnabled: true,
    truckDistanceM: 6,
    craneEnabled: true,
    craneHeightM: 4,
    shotStartMs: 1000,
    shotEndMs: 2000,
    shotCurve: "linear",
  });

  const pose = computeDynamicPose(page, basePose, 1500, 0);

  expect(pose.position[0]).toBeCloseTo(3, 5);
  expect(pose.position[1]).toBeCloseTo(-95, 5);
  expect(pose.position[2]).toBeCloseTo(2, 5);
  expect(pose.target[0]).toBeCloseTo(3, 5);
  expect(pose.target[1]).toBeCloseTo(5, 5);
  expect(pose.target[2]).toBeCloseTo(2, 5);
  expect(pose.fov).toBe(45);
});

test("computeDynamicPose leaves the pose untouched when shot axes are disabled", () => {
  const basePose: Pose = {
    position: [10, -50, 25],
    target: [10, 0, 5],
    up: [0, 0, 1],
    fov: 38,
  };
  const page = pageWithDynamic(basePose, {
    enabled: true,
    orbitEnabled: false,
    zoomEnabled: false,
    dollyDistanceM: 40,
    truckDistanceM: 20,
    craneHeightM: 10,
  });

  expect(computeDynamicPose(page, basePose, 5000, 0)).toEqual(basePose);
});

test("computeDynamicPose applies handheld drift and roll without changing fov", () => {
  const basePose: Pose = {
    position: [0, -100, 0],
    target: [0, 0, 0],
    up: [0, 0, 1],
    fov: 45,
  };
  const page = pageWithDynamic(basePose, {
    enabled: true,
    orbitEnabled: false,
    zoomEnabled: false,
    handheldEnabled: true,
    handheldAmplitudeM: 10,
    handheldFrequencyHz: 0.25,
    rollDeg: 90,
  });

  const pose = computeDynamicPose(page, basePose, 1000, 0);

  expect(pose.position[0]).toBeCloseTo(4, 5);
  expect(pose.position[2]).toBeCloseTo(-2, 5);
  expect(pose.target[0]).toBeCloseTo(4, 5);
  expect(pose.target[2]).toBeCloseTo(-2, 5);
  expect(pose.up[0]).toBeCloseTo(-1, 5);
  expect(pose.up[1]).toBeCloseTo(0, 5);
  expect(pose.up[2]).toBeCloseTo(0, 5);
  expect(pose.fov).toBe(45);
});
