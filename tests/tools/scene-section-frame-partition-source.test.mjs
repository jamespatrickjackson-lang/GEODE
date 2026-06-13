import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

// DEC-164 regression guard. Section transitions partition frames per stable id:
// a frame whose discrete identity matches on both pages MOVES (its numeric
// geometry interpolates), while only added/removed/identity-changed frames
// DISSOLVE. The recurring "Y-section snap" was a single toggled axis flipping a
// GLOBAL discrete flag, which dissolved every surviving plane (and the data
// they clip) instead of sliding it. This test locks the per-frame decision so
// that cannot come back.

async function loadPartitionModule() {
  const source = readFileSync(
    join(
      process.cwd(),
      "src",
      "scene",
      "transitions",
      "sceneSectionFrameSignature.ts",
    ),
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
    `geosee-section-partition-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`,
  );
  writeFileSync(filePath, output);
  return import(pathToFileURL(filePath).href);
}

const { sceneSectionFramePartition } = await loadPartitionModule();

const plane = (enabled, positionM, extra = {}) => ({
  enabled,
  positionM,
  ...extra,
});

test("a surviving axis moves while a toggled-off axis dissolves (the Y-snap case)", () => {
  // 172 -> 166 shape: x present on both (only its position moves), y turned off.
  const from = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: {
      x: plane(true, -10544),
      y: plane(true, -4654),
    },
  };
  const to = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: {
      x: plane(true, -5753),
      y: plane(false, -4654),
    },
  };
  const { movingFrameIds, dissolveFrameIds } = sceneSectionFramePartition(
    from,
    to,
  );
  assert.ok(
    movingFrameIds.has("axis:x"),
    "the surviving x plane must move (interpolate), not snap",
  );
  assert.ok(
    dissolveFrameIds.has("axis:y"),
    "the toggled-off y plane must cross-dissolve",
  );
  assert.ok(!dissolveFrameIds.has("axis:x"), "x must not be dissolved");
  assert.ok(!movingFrameIds.has("axis:y"), "y must not be treated as moving");
});

test("a position-only change keeps the frame moving (never dissolves)", () => {
  const from = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -10000) },
  };
  const to = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -1000) },
  };
  const { movingFrameIds, dissolveFrameIds } = sceneSectionFramePartition(
    from,
    to,
  );
  assert.deepEqual([...movingFrameIds], ["axis:x"]);
  assert.equal(dissolveFrameIds.size, 0);
});

test("presentation-only differences (headings/controls) still let the frame move", () => {
  // Two pages share the x cut but differ in heading text and control/ground-
  // trace visibility — helper concerns that must not block the slide.
  const from = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -10544) },
    sceneSectionFrameByAxis: {
      x: { axisAHeading: "WEST", controlsVisible: true, groundTraceVisible: true },
    },
  };
  const to = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -5753) },
    sceneSectionFrameByAxis: {
      x: { axisAHeading: "EAST", controlsVisible: false, groundTraceVisible: false },
    },
  };
  const { movingFrameIds, dissolveFrameIds } = sceneSectionFramePartition(
    from,
    to,
  );
  assert.ok(
    movingFrameIds.has("axis:x"),
    "a plane that only changed presentation + position must slide, not dissolve",
  );
  assert.ok(!dissolveFrameIds.has("axis:x"));
});

test("a flip keeps the frame moving (DEC-164: flips slide, not dissolve)", () => {
  // The kept half-space flips, but the plane is the same cut and still slides.
  // The runtime holds the source kept-side during the glide and applies the
  // target flip at commit, so the volume changes side once rather than the whole
  // section dissolving.
  const from = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -5000, { invert: false }) },
  };
  const to = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -3000, { invert: true }) },
  };
  const { movingFrameIds, dissolveFrameIds } = sceneSectionFramePartition(
    from,
    to,
  );
  assert.ok(
    movingFrameIds.has("axis:x"),
    "a flipped plane must still slide, not dissolve",
  );
  assert.ok(!dissolveFrameIds.has("axis:x"));
});

test("a changed coordinate frame (alignment/datum) dissolves that frame", () => {
  // Alignment/datum changes redefine the cut's coordinate frame, so position
  // can't be meaningfully interpolated — this is a genuine identity change.
  const from = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -5000) },
    sceneSectionFrameByAxis: { x: { axisAlignment: "utm" } },
  };
  const to = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -5000) },
    sceneSectionFrameByAxis: { x: { axisAlignment: "cardinal" } },
  };
  const { movingFrameIds, dissolveFrameIds } = sceneSectionFramePartition(
    from,
    to,
  );
  assert.ok(
    dissolveFrameIds.has("axis:x"),
    "a changed coordinate frame can't be interpolated -> dissolve",
  );
  assert.ok(!movingFrameIds.has("axis:x"));
});

test("added and removed frames dissolve; inactive-on-both are ignored", () => {
  const from = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -5000) },
  };
  const to = {
    sceneSectionEnabled: true,
    sceneSectionPlanes: { x: plane(true, -5000), z: plane(true, -2200) },
  };
  const { movingFrameIds, dissolveFrameIds } = sceneSectionFramePartition(
    from,
    to,
  );
  assert.ok(movingFrameIds.has("axis:x"), "x unchanged -> moves");
  assert.ok(dissolveFrameIds.has("axis:z"), "z added -> dissolves in");
  assert.ok(
    !movingFrameIds.has("axis:y") && !dissolveFrameIds.has("axis:y"),
    "y inactive on both pages must be ignored entirely",
  );
});

// Source-level locks for the runtime wiring that can't be cheaply executed
// (it lives in the THREE-heavy controller / classifier).
const controllerSource = readFileSync(
  "src/scene/section/sceneSectionController.ts",
  "utf8",
);
const classifierSource = readFileSync(
  "src/scene/transitions/transitionEffectiveLayersForPage.ts",
  "utf8",
);

test("the dual-mask is built from dissolveFrameIds only", () => {
  assert.match(
    controllerSource,
    /withDissolveFrameStateFromStyle/,
    "mask construction must scope to dissolve frames so surviving frames keep interpolated geometry",
  );
  assert.match(
    controllerSource,
    /tween\.dissolveFrameIds/,
    "sceneSectionMaskTransitionForTween must read the per-frame dissolve set",
  );
});

test("currentSceneSectionStyle no longer snaps the whole section on any discrete change", () => {
  assert.doesNotMatch(
    controllerSource,
    /if\s*\(\s*t\s*>=\s*1\s*\|\|\s*tween\.discreteChanged\s*\)\s*return\s*tween\.toStyle/,
    "the global discreteChanged short-circuit must be gone (it snapped surviving frames)",
  );
});

test("the classifier wires the per-frame partition onto the tween", () => {
  assert.match(
    classifierSource,
    /sceneSectionFramePartition\(/,
    "tween setup must compute the per-frame partition",
  );
  assert.match(
    classifierSource,
    /dissolveFrameIds/,
    "tween must carry dissolveFrameIds",
  );
});

test("a moving frame's flip is held to the source side during the glide", () => {
  assert.match(
    controllerSource,
    /holdMovingFrameInvertFromSource/,
    "flip-slide must hold the source kept-side mid-tween, applying the target flip at commit",
  );
  assert.match(
    controllerSource,
    /sceneSectionTweenStyle/,
    "tick and dual-mask must share the flip-holding tween style so the clip agrees",
  );
});
