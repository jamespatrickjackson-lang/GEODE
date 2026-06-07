import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";

const repoRoot = process.cwd();

async function importBundled(entryPoint) {
  const dir = await mkdtemp(join(tmpdir(), "geosee-camera-path-v2-test-"));
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

function validPath(overrides = {}) {
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
        position: [0, 0, 0],
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
        holdSecondsAfter: 1,
      },
      {
        id: "b",
        kind: "transition",
        position: [10, 0, 10],
        target: [10, 0, 0],
        up: [0, 0, 1],
        fov: 45,
        lookMode: "free-direction",
        holdSecondsAfter: 0,
      },
      {
        id: "c",
        kind: "keyframe",
        position: [20, 0, 10],
        focusPointId: "focus-a",
        up: [0, 0, 1],
        fov: 40,
        lookMode: "focus-point-lock",
        holdSecondsAfter: 2,
      },
    ],
    segments: [
      {
        id: "a-b",
        fromNodeId: "a",
        toNodeId: "b",
        transitionSeconds: 2,
      },
      {
        id: "b-c",
        fromNodeId: "b",
        toNodeId: "c",
        transitionSeconds: 2,
      },
    ],
    ...overrides,
  };
}

function validRecipe(overrides = {}) {
  return {
    version: 1,
    projectSlug: "camera-path-v2-runtime",
    pageId: "page-a",
    mode: "scene-only",
    resolution: { width: 1920, height: 1080, label: "1080p" },
    fps: 30,
    durationSeconds: 4,
    camera: {
      position: [0, 0, 10],
      target: [0, 0, 0],
      up: [0, 0, 1],
      fov: 50,
    },
    cameraKeyframes: [],
    layerVisibility: {},
    layerStyles: {},
    environmentState: null,
    visualPreset: null,
    supersampleScale: 1,
    qualityPreset: "preview",
    renderFidelity: "max-detail-render",
    createdAt: "2026-06-06T00:00:00.000Z",
    captureScope: "current-page",
    pageRangeStartId: null,
    pageRangeEndId: null,
    pageRangeTiming: "authored",
    equalHoldSeconds: null,
    ...overrides,
  };
}

test("CaptureCameraPath v2 validates a nodes and segments path", async () => {
  const { validateCaptureCameraPathV2, normalizeCaptureCameraPathV2 } =
    await importBundled("src/capture/captureCameraPathV2.ts");

  const path = validPath();
  assert.equal(validateCaptureCameraPathV2(path).valid, true);

  const normalized = normalizeCaptureCameraPathV2({
    ...path,
    id: "",
    name: "",
    loop: undefined,
    nodes: path.nodes.map((node) => ({ ...node })),
    segments: path.segments.map((segment) => ({ ...segment })),
  });
  assert.equal(normalized.id, "capture-camera-path-v2");
  assert.equal(normalized.name, "Camera Path v2");
  assert.equal(normalized.loop, false);
  assert.deepEqual(normalized.focusPoints[0].position, [0, 0, 0]);
});

test("CaptureCameraPath v2 validation rejects duplicate ids and invalid refs", async () => {
  const { validateCaptureCameraPathV2 } = await importBundled(
    "src/capture/captureCameraPathV2.ts",
  );

  const duplicateIds = validateCaptureCameraPathV2(
    validPath({
      nodes: [
        validPath().nodes[0],
        { ...validPath().nodes[1], id: "a" },
      ],
    }),
  );
  assert.equal(duplicateIds.valid, false);
  assert.match(duplicateIds.errors.join("\n"), /duplicate node id/);

  const invalidRefs = validateCaptureCameraPathV2(
    validPath({
      segments: [
        {
          id: "missing-ref",
          fromNodeId: "a",
          toNodeId: "missing",
          transitionSeconds: 1,
        },
      ],
    }),
  );
  assert.equal(invalidRefs.valid, false);
  assert.match(invalidRefs.errors.join("\n"), /toNodeId must reference a node/);
});

test("CaptureCameraPath v2 validation rejects empty playback drafts", async () => {
  const {
    captureCameraPathV2HasAuthoredNodes,
    normalizeCaptureCameraPathV2,
    validateCaptureCameraPathV2Playback,
  } = await importBundled("src/capture/captureCameraPathV2.ts");

  const emptyDraft = normalizeCaptureCameraPathV2(
    validPath({
      nodes: [],
      segments: [],
      focusPoints: [],
      timeline: { durationSeconds: 0 },
    }),
  );
  assert.equal(captureCameraPathV2HasAuthoredNodes(emptyDraft), false);

  const validation = validateCaptureCameraPathV2Playback(emptyDraft);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /at least two active camera views/i);
});

test("CaptureCameraPath v2 display options normalize, validate, and roundtrip through recipes", async () => {
  const {
    normalizeCaptureCameraPathDisplayOptionsV2,
    normalizeCaptureCameraPathV2,
    validateCaptureCameraPathDisplayOptionsV2,
    validateCaptureCameraPathV2,
  } = await importBundled("src/capture/captureCameraPathV2.ts");
  const {
    createCaptureRecipeFromCurrentState,
    parseCaptureRecipeJson,
    validateCaptureRecipe,
  } = await importBundled("src/capture/captureRecipe.ts");

  const normalizedOptions = normalizeCaptureCameraPathDisplayOptionsV2({
    trackColor: "not-a-color",
    selectedColor: "#ffffff",
    targetColor: "#123abc",
    focusColor: "#fff000",
    trackLineSize: 99,
    directionRayLength: -1,
    handleScale: 9999,
    showCameraFrustum: true,
    showLookRays: false,
    showFocusLockRays: true,
    showNodeLabels: true,
    showTimelineGhost: false,
    previewMonitorMode: "scrub-time",
  });
  assert.equal(normalizedOptions.trackColor, "#ff6b4a");
  assert.equal(normalizedOptions.trackLineSize, 12);
  assert.equal(normalizedOptions.directionRayLength, 0.25);
  assert.equal(normalizedOptions.handleScale, 360);
  assert.equal(normalizedOptions.previewMonitorMode, "scrub-time");
  assert.equal(validateCaptureCameraPathDisplayOptionsV2(normalizedOptions).valid, true);
  assert.equal(
    validateCaptureCameraPathDisplayOptionsV2({
      ...normalizedOptions,
      previewMonitorMode: "always",
      trackColor: "red",
    }).valid,
    false,
  );

  const path = normalizeCaptureCameraPathV2(
    validPath({
      displayOptions: normalizedOptions,
    }),
  );
  assert.equal(path.displayOptions.trackColor, "#ff6b4a");
  assert.equal(path.displayOptions.showNodeLabels, true);
  assert.equal(validateCaptureCameraPathV2(path).valid, true);

  const recipe = createCaptureRecipeFromCurrentState(
    validRecipe({
      cameraPath: path,
      cameraKeyframes: [],
    }),
  );
  assert.equal(validateCaptureRecipe(recipe).valid, true);
  const parsed = parseCaptureRecipeJson(`${JSON.stringify(recipe)}\n`).recipe;
  assert.equal(parsed.cameraPath.displayOptions.previewMonitorMode, "scrub-time");
  assert.equal(parsed.cameraPath.displayOptions.handleScale, 360);
});

test("CaptureCameraPath v2 validation rejects negative timing and transition holds", async () => {
  const { normalizeCaptureCameraPathV2, validateCaptureCameraPathV2 } =
    await importBundled("src/capture/captureCameraPathV2.ts");

  const invalid = validateCaptureCameraPathV2(
    validPath({
      nodes: [
        { ...validPath().nodes[0], holdSecondsAfter: -1 },
        { ...validPath().nodes[1], holdSecondsAfter: 1 },
      ],
      segments: [
        { ...validPath().segments[0], transitionSeconds: -0.5 },
      ],
    }),
  );
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /holdSecondsAfter must be non-negative/);
  assert.match(invalid.errors.join("\n"), /transition nodes cannot hold/);
  assert.match(invalid.errors.join("\n"), /transitionSeconds must be non-negative/);

  const normalized = normalizeCaptureCameraPathV2(
    validPath({
      nodes: [
        { ...validPath().nodes[0], holdSecondsAfter: -1 },
        { ...validPath().nodes[1], holdSecondsAfter: 3 },
      ],
      segments: [
        { ...validPath().segments[0], transitionSeconds: -2 },
      ],
    }),
  );
  assert.equal(normalized.nodes[0].holdSecondsAfter, 0);
  assert.equal(normalized.nodes[1].holdSecondsAfter, 0);
  assert.equal(normalized.segments[0].transitionSeconds, 0);
});

test("CaptureCameraPath v2 validation enforces look-mode requirements", async () => {
  const { validateCaptureCameraPathV2 } = await importBundled(
    "src/capture/captureCameraPathV2.ts",
  );

  const freeDirection = validateCaptureCameraPathV2(
    validPath({
      nodes: [{ ...validPath().nodes[0], target: undefined }],
    }),
  );
  assert.equal(freeDirection.valid, false);
  assert.match(freeDirection.errors.join("\n"), /target is required/);

  const focusLock = validateCaptureCameraPathV2(
    validPath({
      nodes: [
        {
          ...validPath().nodes[0],
          target: undefined,
          lookMode: "focus-point-lock",
          focusPointId: "missing",
        },
      ],
    }),
  );
  assert.equal(focusLock.valid, false);
  assert.match(focusLock.errors.join("\n"), /focusPointId must reference a focus point/);
});

test("CaptureCameraPath v2 playback validation rejects empty, disabled, and zero-duration paths", async () => {
  const { normalizeCaptureCameraPathV2, validateCaptureCameraPathV2Playback } =
    await importBundled("src/capture/captureCameraPathV2.ts");

  const emptyPath = normalizeCaptureCameraPathV2(
    validPath({
      nodes: [],
      segments: [],
      timeline: { durationSeconds: 0 },
    }),
  );
  const allDisabledPath = normalizeCaptureCameraPathV2(
    validPath({
      nodes: validPath().nodes.map((node) => ({ ...node, enabled: false })),
      segments: validPath().segments.map((segment) => ({
        ...segment,
        enabled: false,
      })),
    }),
  );
  const zeroDurationPath = normalizeCaptureCameraPathV2(
    validPath({
      nodes: validPath().nodes.map((node) => ({
        ...node,
        holdSecondsAfter: 0,
      })),
      segments: validPath().segments.map((segment) => ({
        ...segment,
        transitionSeconds: 0,
      })),
      timeline: { durationSeconds: 0 },
    }),
  );

  for (const [label, path, message] of [
    ["empty", emptyPath, /at least two active camera views/i],
    ["all-disabled", allDisabledPath, /at least two active camera views/i],
    ["zero-duration", zeroDurationPath, /duration.*greater than zero/i],
  ]) {
    const validation = validateCaptureCameraPathV2Playback(path);
    assert.equal(validation.valid, false, `${label} path should be rejected`);
    assert.match(validation.errors.join("\n"), message);
  }
});

test("CaptureCameraPath v2 sampler covers holds, transitions, and tangent fallback", async () => {
  const { resolveCaptureCameraPathV2Timeline, sampleCaptureCameraPathV2 } =
    await importBundled("src/capture/captureCameraPathV2.ts");

  const path = validPath();
  const timeline = resolveCaptureCameraPathV2Timeline(path);
  assert.equal(timeline.durationSeconds, 7);
  assert.deepEqual(sampleCaptureCameraPathV2(path, 0.5).position, [0, 0, 10]);

  const transition = sampleCaptureCameraPathV2(path, 2);
  assert.deepEqual(transition.position, [5, 0, 10]);
  assert.deepEqual(transition.target, [5, 0, 0]);
  assert.equal(transition.fov, 47.5);

  const focusHold = sampleCaptureCameraPathV2(path, 6.5);
  assert.deepEqual(focusHold.position, [20, 0, 10]);
  assert.deepEqual(focusHold.target, [0, 0, 0]);

  const tangentPath = validPath({
    nodes: [
      {
        id: "a",
        kind: "keyframe",
        position: [0, 0, 10],
        target: [0, 1, 10],
        up: [0, 0, 1],
        fov: 50,
        lookMode: "follow-path-tangent",
      },
      {
        id: "b",
        kind: "keyframe",
        position: [0, 0, 10],
        target: [0, 2, 10],
        up: [0, 0, 1],
        fov: 50,
        lookMode: "follow-path-tangent",
      },
    ],
    segments: [
      { id: "a-b", fromNodeId: "a", toNodeId: "b", transitionSeconds: 1 },
    ],
  });
  assert.deepEqual(sampleCaptureCameraPathV2(tangentPath, 0).target, [0, 1, 10]);
});

test("CaptureCameraPath v2 sampler excludes disabled nodes and segments", async () => {
  const { normalizeCaptureCameraPathV2, resolveCaptureCameraPathV2Timeline, sampleCaptureCameraPathV2 } =
    await importBundled("src/capture/captureCameraPathV2.ts");

  const path = normalizeCaptureCameraPathV2(
    validPath({
      nodes: [
        {
          ...validPath().nodes[0],
          id: "start",
          position: [0, 0, 10],
          target: [0, 0, 0],
          holdSecondsAfter: 0,
        },
        {
          ...validPath().nodes[1],
          id: "disabled-node",
          enabled: false,
          position: [100, 0, 10],
          target: [100, 0, 0],
        },
        {
          ...validPath().nodes[2],
          id: "end",
          position: [20, 0, 10],
          target: [20, 0, 0],
          lookMode: "free-direction",
          focusPointId: undefined,
          holdSecondsAfter: 0,
        },
      ],
      segments: [
        {
          id: "start-disabled",
          fromNodeId: "start",
          toNodeId: "disabled-node",
          transitionSeconds: 10,
        },
        {
          id: "disabled-end",
          fromNodeId: "disabled-node",
          toNodeId: "end",
          transitionSeconds: 10,
        },
        {
          id: "disabled-segment",
          fromNodeId: "start",
          toNodeId: "end",
          enabled: false,
          transitionSeconds: 10,
        },
        {
          id: "start-end",
          fromNodeId: "start",
          toNodeId: "end",
          transitionSeconds: 4,
        },
      ],
    }),
  );
  const timeline = resolveCaptureCameraPathV2Timeline(path);

  assert.deepEqual(timeline.activeNodeIds, ["start", "end"]);
  assert.deepEqual(timeline.activeSegmentIds, ["start-end"]);
  assert.deepEqual(
    timeline.entries
      .filter((entry) => entry.kind === "transition")
      .map((entry) => entry.segmentId),
    ["start-end"],
  );
  assert.deepEqual(sampleCaptureCameraPathV2(path, 2).position, [10, 0, 10]);
});

test("CaptureCameraPath v2 sampler keeps hidden enabled nodes active", async () => {
  const { normalizeCaptureCameraPathV2, resolveCaptureCameraPathV2Timeline, sampleCaptureCameraPathV2 } =
    await importBundled("src/capture/captureCameraPathV2.ts");

  const path = normalizeCaptureCameraPathV2(
    validPath({
      nodes: [
        {
          ...validPath().nodes[0],
          id: "start",
          position: [0, 0, 10],
          target: [0, 0, 0],
          holdSecondsAfter: 0,
        },
        {
          ...validPath().nodes[1],
          id: "hidden-middle",
          hidden: true,
          position: [10, 0, 10],
          target: [10, 0, 0],
        },
        {
          ...validPath().nodes[2],
          id: "end",
          position: [20, 0, 10],
          target: [20, 0, 0],
          lookMode: "free-direction",
          focusPointId: undefined,
          holdSecondsAfter: 0,
        },
      ],
      segments: [
        {
          id: "start-hidden",
          fromNodeId: "start",
          toNodeId: "hidden-middle",
          transitionSeconds: 2,
        },
        {
          id: "hidden-end",
          fromNodeId: "hidden-middle",
          toNodeId: "end",
          transitionSeconds: 2,
        },
      ],
    }),
  );
  const timeline = resolveCaptureCameraPathV2Timeline(path);

  assert.deepEqual(timeline.activeNodeIds, ["start", "hidden-middle", "end"]);
  assert.deepEqual(timeline.activeSegmentIds, ["start-hidden", "hidden-end"]);
  assert.deepEqual(sampleCaptureCameraPathV2(path, 2).position, [10, 0, 10]);
  assert.deepEqual(sampleCaptureCameraPathV2(path, 3).position, [15, 0, 10]);
});

test("CaptureCameraPath v2 edit helpers move nodes, segments, and focus bindings", async () => {
  const {
    bindCaptureCameraPathV2FocusPoint,
    moveCaptureCameraPathV2NodePosition,
    moveCaptureCameraPathV2NodeTarget,
    moveCaptureCameraPathV2SegmentAdjacentPositions,
  } = await importBundled("src/capture/captureCameraPathV2.ts");

  const path = validPath();
  const movedNode = moveCaptureCameraPathV2NodePosition(path, "a", [1, 2, 3]);
  assert.deepEqual(movedNode.nodes.find((node) => node.id === "a").position, [1, 2, 3]);

  const movedTarget = moveCaptureCameraPathV2NodeTarget(path, "a", [4, 5, 6]);
  const targetNode = movedTarget.nodes.find((node) => node.id === "a");
  assert.equal(targetNode.lookMode, "free-direction");
  assert.deepEqual(targetNode.target, [4, 5, 6]);

  const movedSegment = moveCaptureCameraPathV2SegmentAdjacentPositions(
    path,
    "a-b",
    [1, 1, 1],
  );
  assert.deepEqual(movedSegment.nodes.find((node) => node.id === "a").position, [1, 1, 11]);
  assert.deepEqual(movedSegment.nodes.find((node) => node.id === "b").position, [11, 1, 11]);

  const bound = bindCaptureCameraPathV2FocusPoint(path, "a", {
    id: "focus-b",
    label: "Focus B",
    position: [9, 8, 7],
    picked: true,
  });
  const boundNode = bound.nodes.find((node) => node.id === "a");
  assert.equal(boundNode.lookMode, "focus-point-lock");
  assert.equal(boundNode.focusPointId, "focus-b");
  assert.deepEqual(bound.focusPoints.find((point) => point.id === "focus-b").position, [9, 8, 7]);
});

test("CaptureCameraPath v2 upgrades v1 and derives legacy keyframes", async () => {
  const {
    captureCameraPathV2ToLegacyKeyframes,
    upgradeCaptureCameraPathV1ToV2,
  } = await importBundled("src/capture/captureCameraPathV2.ts");

  const v1 = {
    version: 1,
    id: "legacy",
    name: "Legacy",
    durationSeconds: 5,
    interpolation: "catmull-rom",
    targetInterpolation: "linear",
    loop: false,
    keyframes: [
      {
        id: "a",
        timeSeconds: 0,
        position: [0, 0, 10],
        target: [0, 0, 0],
        up: [0, 0, 1],
        fov: 50,
        easing: "linear",
      },
      {
        id: "b",
        timeSeconds: 2,
        position: [10, 0, 10],
        target: [10, 0, 0],
        up: [0, 0, 1],
        fov: 40,
        easing: "ease-in-out",
      },
    ],
  };

  const upgraded = upgradeCaptureCameraPathV1ToV2(v1);
  assert.equal(upgraded.version, 2);
  assert.deepEqual(upgraded.nodes.map((node) => node.id), ["a", "b"]);
  assert.equal(upgraded.segments[0].transitionSeconds, 2);
  assert.equal(upgraded.nodes[1].holdSecondsAfter, 3);

  const legacy = captureCameraPathV2ToLegacyKeyframes(upgraded);
  assert.deepEqual(legacy.map((keyframe) => keyframe.timeSeconds), [0, 2]);
  assert.deepEqual(legacy[1].camera.position, [10, 0, 10]);
  assert.deepEqual(legacy[1].camera.target, [10, 0, 0]);
});
