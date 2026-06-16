import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

// Camera policy (reusable behavior family, not a page fixture): a runaway
// authored dynamicCamera.orbitRadius must not be able to fling the orbit camera
// out of the scene. Observed live: 149_page authored orbitRadius 144,024,210
// (~252x its framing distance) parked the camera ~141,000,000 units out, so the
// entire scene collapsed to a sub-pixel speck ("cloud disappears on entry").
// Legit deck ratios top out near 2.2x; the clamp caps at 8x framing distance.

async function loadModule() {
  const source = readFileSync(
    join(process.cwd(), "src", "pages", "dynamicCameraPose.ts"),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const filePath = join(
    tmpdir(),
    `geosee-dynamic-camera-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`,
  );
  writeFileSync(filePath, output);
  return import(pathToFileURL(filePath).href);
}

const {
  clampDynamicOrbitRadius,
  computeDynamicPose,
  MAX_ORBIT_RADIUS_FRAMING_FACTOR,
} = await loadModule();

test("legit orbit radius within the framing budget is unchanged", () => {
  // 106_page-like: ratio ~2.21x, well inside the 8x budget.
  assert.equal(clampDynamicOrbitRadius(127832, 57742), 127832);
  // exactly at the budget edge stays unchanged
  const base = 50000;
  assert.equal(
    clampDynamicOrbitRadius(base * MAX_ORBIT_RADIUS_FRAMING_FACTOR, base),
    base * MAX_ORBIT_RADIUS_FRAMING_FACTOR,
  );
});

test("runaway orbit radius is clamped to the framing budget", () => {
  // 149_page values observed live: orbitRadius 144,024,210, baseRadius 571,131.
  const baseRadius = 571131;
  const clamped = clampDynamicOrbitRadius(144024210, baseRadius);
  assert.equal(clamped, baseRadius * MAX_ORBIT_RADIUS_FRAMING_FACTOR);
  assert.ok(clamped < 144024210);
  // back inside scene scale: the same order of magnitude as the framing.
  assert.ok(clamped / baseRadius <= MAX_ORBIT_RADIUS_FRAMING_FACTOR + 1e-9);
});

test("non-finite or non-positive authored radius falls back to framing distance", () => {
  assert.equal(clampDynamicOrbitRadius(Number.NaN, 1234), 1234);
  assert.equal(clampDynamicOrbitRadius(0, 1234), 1234);
  assert.equal(clampDynamicOrbitRadius(-50, 1234), 1234);
});

test("degenerate framing distance does not divide-by-zero or explode", () => {
  // baseRadius <= 0 / non-finite -> safe base of 1, so the cap is the factor.
  assert.equal(clampDynamicOrbitRadius(1e9, 0), MAX_ORBIT_RADIUS_FRAMING_FACTOR);
  assert.equal(
    clampDynamicOrbitRadius(1e9, Number.NaN),
    MAX_ORBIT_RADIUS_FRAMING_FACTOR,
  );
});

test("computeDynamicPose keeps a runaway-orbit camera inside scene scale", () => {
  const poi = [22528, 32488, 1599];
  const basePose = {
    position: [406908, 454912, 124375],
    target: [22528, 32488, 1599],
    up: [0, 0, 1],
    fov: 22.5,
  };
  const baseRadius = Math.hypot(
    basePose.position[0] - poi[0],
    basePose.position[1] - poi[1],
  );
  const page = {
    id: "synthetic-runaway-orbit",
    dynamicCamera: {
      enabled: true,
      mode: "orbit",
      orbitEnabled: true,
      poi,
      orbitRadius: 144024210,
      orbitHeight: 122776,
      orbitSpeedDegPerSec: 4,
      orbitDirection: 1,
      easeInMs: 0, // fully blended immediately
    },
  };
  // Sample across a full orbit; the horizontal distance from the POI must never
  // exceed the framing budget (plus the height contribution).
  let maxHorizontal = 0;
  for (let t = 0; t <= 8000; t += 250) {
    const pose = computeDynamicPose(page, basePose, t, 0);
    const horizontal = Math.hypot(
      pose.position[0] - poi[0],
      pose.position[1] - poi[1],
    );
    maxHorizontal = Math.max(maxHorizontal, horizontal);
  }
  const budget = baseRadius * MAX_ORBIT_RADIUS_FRAMING_FACTOR;
  assert.ok(
    maxHorizontal <= budget + 1,
    `orbit horizontal ${maxHorizontal} exceeded clamp budget ${budget}`,
  );
  // And vastly smaller than the authored runaway radius.
  assert.ok(maxHorizontal < 144024210 / 10);
});
