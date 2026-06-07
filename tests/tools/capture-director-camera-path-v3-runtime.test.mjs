import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";

const repoRoot = process.cwd();

async function importBundled(entryPoint) {
  const dir = await mkdtemp(join(tmpdir(), "geosee-camera-path-v3-test-"));
  const outfile = join(dir, "bundle.mjs");
  await esbuild.build({
    entryPoints: [join(repoRoot, entryPoint)],
    bundle: true,
    format: "esm",
    platform: "browser",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

function validPathV2(overrides = {}) {
  return {
    version: 2,
    id: "path-v2",
    name: "Path v2",
    loop: false,
    displayOptions: {
      trackColor: "#ff6b4a",
      selectedColor: "#f8fafc",
      targetColor: "#7dd3fc",
      focusColor: "#facc15",
      trackLineSize: 3,
      directionRayLength: 1.5,
      handleScale: 120,
      showCameraFrustum: true,
      showLookRays: true,
      showFocusLockRays: true,
      showNodeLabels: false,
      showTimelineGhost: true,
      previewMonitorMode: "while-editing",
    },
    focusPoints: [
      {
        id: "focus-a",
        label: "Focus A",
        position: [10, 6, 0],
        picked: true,
      },
    ],
    nodes: [
      {
        id: "a",
        kind: "keyframe",
        position: [0, 0, 10],
        target: [0, 0, 0],
        up: [0, 0, 1],
        fov: 50,
        lookMode: "free-direction",
        holdSecondsAfter: 0,
      },
      {
        id: "b",
        kind: "keyframe",
        position: [10, 0, 10],
        target: [10, 0, 0],
        up: [0, 0, 1],
        fov: 45,
        lookMode: "free-direction",
        holdSecondsAfter: 0,
      },
    ],
    segments: [
      {
        id: "a-b",
        fromNodeId: "a",
        toNodeId: "b",
        transitionSeconds: 2,
        easing: "linear",
      },
    ],
    ...overrides,
  };
}

function validPathV3(overrides = {}) {
  return {
    version: 3,
    id: "path-v3",
    name: "Path v3",
    loop: false,
    timeline: { durationSeconds: 4 },
    displayOptions: validPathV2().displayOptions,
    equationOverlayOptions: {
      visible: false,
      selectedTransitionOnly: true,
      showStackLabels: true,
      showTemporalRamp: true,
      showTangents: true,
      showInfluenceHandles: true,
      showCurvatureComb: true,
      showFocusDistance: true,
    },
    focusPoints: [
      {
        id: "focus-a",
        label: "Focus A",
        position: [10, 6, 0],
        picked: true,
      },
    ],
    nodes: [
      {
        id: "a",
        kind: "keyframe",
        enabled: true,
        hidden: false,
        timeSeconds: 0,
        position: [0, 0, 0],
        target: [0, 1, 0],
        up: [0, 0, 1],
        fov: 50,
        holdSecondsAfter: 0,
        aimGeometry: {
          mode: "free-direction",
          tangentForwardDistance: 1,
          lensMode: "fixed-fov",
          dollyZoomStrength: 0,
        },
      },
      {
        id: "b",
        kind: "keyframe",
        enabled: true,
        hidden: false,
        timeSeconds: 0,
        position: [10, 0, 0],
        target: [10, 1, 0],
        up: [0, 0, 1],
        fov: 40,
        holdSecondsAfter: 0,
        aimGeometry: {
          mode: "free-direction",
          tangentForwardDistance: 1,
          lensMode: "fixed-fov",
          dollyZoomStrength: 0,
        },
      },
      {
        id: "c",
        kind: "keyframe",
        enabled: true,
        hidden: false,
        timeSeconds: 0,
        position: [10, 10, 0],
        target: [10, 11, 0],
        up: [0, 0, 1],
        fov: 35,
        holdSecondsAfter: 0,
        aimGeometry: {
          mode: "free-direction",
          tangentForwardDistance: 1,
          lensMode: "fixed-fov",
          dollyZoomStrength: 0,
        },
      },
    ],
    segments: [
      {
        id: "a-b",
        fromNodeId: "a",
        toNodeId: "b",
        enabled: true,
        hidden: false,
        transitionSeconds: 2,
        timeCurve: { mode: "linear" },
        pathFairing: {
          continuity: "G1",
          tension: 0.35,
          bias: 0,
          fromInfluenceOut: "auto",
          toInfluenceIn: "auto",
          autoHandles: true,
        },
      },
      {
        id: "b-c",
        fromNodeId: "b",
        toNodeId: "c",
        enabled: true,
        hidden: false,
        transitionSeconds: 2,
        timeCurve: { mode: "linear" },
        pathFairing: {
          continuity: "G1",
          tension: 0.35,
          bias: 0,
          fromInfluenceOut: "auto",
          toInfluenceIn: "auto",
          autoHandles: true,
        },
      },
    ],
    ...overrides,
  };
}

function approx(actual, expected, epsilon = 0.001) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

function approxVec(actual, expected, epsilon = 0.001) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => approx(value, expected[index], epsilon));
}

function normalize(value) {
  const length = Math.hypot(...value);
  return length > 0 ? value.map((entry) => entry / length) : value;
}

function dot(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

test("CaptureCameraPath v3 upgrades v2 paths with surfacing defaults", async () => {
  const {
    upgradeCaptureCameraPathV2ToV3,
    validateCaptureCameraPathV3,
    validateCaptureCameraPathV3Playback,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const path = upgradeCaptureCameraPathV2ToV3(validPathV2());
  assert.equal(path.version, 3);
  assert.equal(path.segments[0].timeCurve.mode, "linear");
  assert.equal(path.segments[0].pathFairing.continuity, "G1");
  assert.equal(path.segments[0].pathFairing.tension, 0.35);
  assert.equal(path.nodes[0].aimGeometry.mode, "free-direction");
  assert.equal(path.nodes[0].aimGeometry.lensMode, "fixed-fov");
  assert.equal(path.equationOverlayOptions.visible, false);
  assert.equal(validateCaptureCameraPathV3(path).valid, true);
  assert.equal(validateCaptureCameraPathV3Playback(path).valid, true);
});

test("CaptureCameraPath v3 accepts empty drafts but rejects empty playback", async () => {
  const {
    captureCameraPathV3Renderable,
    normalizeCaptureCameraPathV3,
    validateCaptureCameraPathV3,
    validateCaptureCameraPathV3Playback,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const empty = normalizeCaptureCameraPathV3({
    ...validPathV3(),
    nodes: [],
    segments: [],
    focusPoints: [],
    timeline: { durationSeconds: 0 },
  });

  assert.equal(validateCaptureCameraPathV3(empty).valid, true);
  assert.equal(captureCameraPathV3Renderable(empty), false);
  const playback = validateCaptureCameraPathV3Playback(empty);
  assert.equal(playback.valid, false);
  assert.match(playback.errors.join("\n"), /at least two active camera views/i);
});

test("CaptureCameraPath v3 temporal curves change progress but not duration", async () => {
  const {
    applyCaptureCameraPathV3TimeCurve,
    normalizeCaptureCameraPathV3,
    resolveCaptureCameraPathV3Timeline,
    sampleCaptureCameraPathV3,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  approx(applyCaptureCameraPathV3TimeCurve({ mode: "linear" }, 0.5), 0.5);
  approx(applyCaptureCameraPathV3TimeCurve({ mode: "ease-in" }, 0.5), 0.25);
  approx(applyCaptureCameraPathV3TimeCurve({ mode: "ease-out" }, 0.5), 0.75);
  approx(applyCaptureCameraPathV3TimeCurve({ mode: "ease-in-out" }, 0.5), 0.5);
  approx(
    applyCaptureCameraPathV3TimeCurve({
      mode: "custom-ramp",
      ramp: [
        { t: 0, value: 0 },
        { t: 0.5, value: 0.8 },
        { t: 1, value: 1 },
      ],
    }, 0.25),
    0.4,
  );

  const path = normalizeCaptureCameraPathV3({
    ...validPathV3(),
    segments: [
      {
        ...validPathV3().segments[0],
        timeCurve: { mode: "ease-in" },
      },
    ],
  });
  assert.equal(resolveCaptureCameraPathV3Timeline(path).durationSeconds, 2);
  assert.ok(sampleCaptureCameraPathV3(path, 1).position[0] < 5);
});

test("CaptureCameraPath v3 validates custom ramps and focus locks", async () => {
  const { validateCaptureCameraPathV3 } = await importBundled(
    "src/capture/captureCameraPathV3.ts",
  );

  const invalidRamp = validateCaptureCameraPathV3({
    ...validPathV3(),
    segments: [
      {
        ...validPathV3().segments[0],
        timeCurve: {
          mode: "custom-ramp",
          ramp: [
            { t: 0, value: 0 },
            { t: 0.5, value: 0.8 },
            { t: 0.4, value: 0.9 },
            { t: 1, value: 1 },
          ],
        },
      },
    ],
  });
  assert.equal(invalidRamp.valid, false);
  assert.match(invalidRamp.errors.join("\n"), /monotonic/i);

  const invalidFocus = validateCaptureCameraPathV3({
    ...validPathV3(),
    focusPoints: [],
    nodes: [
      {
        ...validPathV3().nodes[0],
        aimGeometry: {
          ...validPathV3().nodes[0].aimGeometry,
          mode: "focus-point-lock",
          focusPointId: "missing",
        },
      },
      validPathV3().nodes[1],
    ],
  });
  assert.equal(invalidFocus.valid, false);
  assert.match(invalidFocus.errors.join("\n"), /focus point/i);
});

test("CaptureCameraPath v3 continuity changes curve shape without moving nodes", async () => {
  const {
    normalizeCaptureCameraPathV3,
    sampleCaptureCameraPathV3,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const g0 = normalizeCaptureCameraPathV3({
    ...validPathV3(),
    segments: validPathV3().segments.map((segment) => ({
      ...segment,
      pathFairing: { ...segment.pathFairing, continuity: "G0" },
    })),
  });
  const g2 = normalizeCaptureCameraPathV3({
    ...validPathV3(),
    segments: validPathV3().segments.map((segment) => ({
      ...segment,
      pathFairing: {
        ...segment.pathFairing,
        continuity: "G2",
        tension: 0,
        bias: 0,
        fromInfluenceOut: 4,
        toInfluenceIn: 4,
        autoHandles: false,
      },
    })),
  });

  approxVec(sampleCaptureCameraPathV3(g0, 0).position, [0, 0, 0]);
  approxVec(sampleCaptureCameraPathV3(g0, 2).position, [10, 0, 0]);
  approxVec(sampleCaptureCameraPathV3(g0, 4).position, [10, 10, 0]);

  const g0Mid = sampleCaptureCameraPathV3(g0, 1).position;
  const g2Mid = sampleCaptureCameraPathV3(g2, 1).position;
  approxVec(g0Mid, [5, 0, 0]);
  assert.notDeepEqual(
    g2Mid.map((value) => Number(value.toFixed(3))),
    g0Mid.map((value) => Number(value.toFixed(3))),
    "G2 fairing should alter the rail shape between authored nodes",
  );
  approxVec(sampleCaptureCameraPathV3(g2, 0).position, [0, 0, 0]);
  approxVec(sampleCaptureCameraPathV3(g2, 2).position, [10, 0, 0]);
  approxVec(sampleCaptureCameraPathV3(g2, 4).position, [10, 10, 0]);
});

test("CaptureCameraPath v3 tangent, focus, and lens modes sample deterministically", async () => {
  const {
    normalizeCaptureCameraPathV3,
    sampleCaptureCameraPathV3,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const tangentPath = normalizeCaptureCameraPathV3({
    ...validPathV3(),
    nodes: validPathV3().nodes.map((node) => ({
      ...node,
      aimGeometry: {
        ...node.aimGeometry,
        mode: "follow-path-tangent",
        tangentForwardDistance: 5,
      },
    })),
  });
  const tangentSample = sampleCaptureCameraPathV3(tangentPath, 1);
  assert.ok(
    dot(
      normalize([
        tangentSample.target[0] - tangentSample.position[0],
        tangentSample.target[1] - tangentSample.position[1],
        tangentSample.target[2] - tangentSample.position[2],
      ]),
      [1, 0, 0],
    ) > 0.95,
  );

  const focusPath = normalizeCaptureCameraPathV3({
    ...validPathV3(),
    nodes: validPathV3().nodes.map((node) => ({
      ...node,
      aimGeometry: {
        ...node.aimGeometry,
        mode: "focus-point-lock",
        focusPointId: "focus-a",
        lensMode: "maintain-focus-size",
      },
    })),
  });
  const focusSample = sampleCaptureCameraPathV3(focusPath, 1);
  approxVec(focusSample.target, [10, 6, 0]);
  assert.notEqual(focusSample.fov, 50);

  const dollyPath = normalizeCaptureCameraPathV3({
    ...focusPath,
    nodes: focusPath.nodes.map((node) => ({
      ...node,
      aimGeometry: {
        ...node.aimGeometry,
        lensMode: "dolly-zoom",
        dollyZoomStrength: 0.5,
      },
    })),
  });
  const dollySample = sampleCaptureCameraPathV3(dollyPath, 1);
  assert.ok(dollySample.fov > 0 && dollySample.fov < 180);
  assert.notEqual(dollySample.fov, focusSample.fov);
});

test("CaptureCameraPath v3 recipes roundtrip and sample by fixed frame time", async () => {
  const {
    createCaptureRecipeFromCurrentState,
    normalizeCaptureRecipe,
    validateCaptureRecipe,
  } = await importBundled("src/capture/captureRecipe.ts");
  const {
    sampleCaptureRecipeCameraPoseAtFrame,
  } = await importBundled("src/capture/deterministicFrameSequenceExporter.ts");

  const path = validPathV3({
    segments: validPathV3().segments.map((segment) => ({
      ...segment,
      pathFairing: { ...segment.pathFairing, continuity: "G0" },
    })),
  });
  const recipe = createCaptureRecipeFromCurrentState({
    projectSlug: "v3-runtime",
    pageId: "page-a",
    mode: "scene-only",
    resolution: { width: 1920, height: 1080, label: "1080p", qualityPreset: "preview" },
    fps: 30,
    durationSeconds: 4,
    camera: {
      position: [0, 0, 10],
      target: [0, 0, 0],
      up: [0, 0, 1],
      fov: 50,
    },
    cameraPath: path,
    layerVisibility: {},
    layerStyles: {},
    environmentState: null,
    visualPreset: null,
    supersampleScale: 1,
    qualityPreset: "preview",
    renderFidelity: "max-detail-render",
    createdAt: "2026-06-06T00:00:00.000Z",
  });

  assert.equal(recipe.cameraPath?.version, 3);
  assert.ok(recipe.cameraKeyframes.length >= 2);
  assert.equal(validateCaptureRecipe(recipe).valid, true);

  const normalized = normalizeCaptureRecipe(recipe);
  assert.equal(normalized.cameraPath?.version, 3);
  assert.deepEqual(sampleCaptureRecipeCameraPoseAtFrame(normalized, 30)?.position, [
    5,
    0,
    0,
  ]);
});

test("CaptureCameraPath v3 empty draft recipe stores cameraPath null", async () => {
  const { createCaptureRecipeFromCurrentState } = await importBundled(
    "src/capture/captureRecipe.ts",
  );
  const emptyPath = {
    ...validPathV3(),
    nodes: [],
    segments: [],
    focusPoints: [],
    timeline: { durationSeconds: 0 },
  };

  const recipe = createCaptureRecipeFromCurrentState({
    projectSlug: "v3-runtime",
    pageId: "page-a",
    mode: "scene-only",
    resolution: { width: 1920, height: 1080, label: "1080p", qualityPreset: "preview" },
    fps: 30,
    durationSeconds: 2,
    camera: {
      position: [0, 0, 10],
      target: [0, 0, 0],
      up: [0, 0, 1],
      fov: 50,
    },
    cameraPath: emptyPath,
    cameraKeyframes: [],
    layerVisibility: {},
    layerStyles: {},
    environmentState: null,
    visualPreset: null,
    supersampleScale: 1,
    qualityPreset: "preview",
    renderFidelity: "max-detail-render",
    createdAt: "2026-06-06T00:00:00.000Z",
  });

  assert.equal(recipe.cameraPath, null);
  assert.deepEqual(recipe.cameraKeyframes, []);
});
