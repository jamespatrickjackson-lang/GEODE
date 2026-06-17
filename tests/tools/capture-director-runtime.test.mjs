import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";

const repoRoot = process.cwd();
const execFileAsync = promisify(execFile);

async function importBundled(entryPoint) {
  const dir = await mkdtemp(join(tmpdir(), "geosee-capture-test-"));
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

function pose(position, target = [0, 0, 0]) {
  return {
    position,
    target,
    up: [0, 0, 1],
    fov: 50,
  };
}

function validRecipe(overrides = {}) {
  return {
    version: 1,
    projectSlug: "runtime-test",
    pageId: "page-a",
    mode: "scene-only",
    resolution: { width: 640, height: 360, label: "Runtime" },
    fps: 30,
    durationSeconds: 0.1,
    camera: pose([0, 0, 10]),
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

function cameraPathV2(overrides = {}) {
  return {
    version: 2,
    id: "camera-path-v2-runtime",
    name: "Camera Path v2 Runtime",
    loop: false,
    focusPoints: [],
    nodes: [
      {
        id: "start",
        kind: "keyframe",
        position: [0, 0, 0],
        target: [0, 0, 0],
        up: [0, 0, 1],
        fov: 50,
        lookMode: "free-direction",
        holdSecondsAfter: 0,
      },
      {
        id: "end",
        kind: "keyframe",
        position: [60, 0, 0],
        target: [6, 0, 0],
        up: [0, 0, 1],
        fov: 50,
        lookMode: "free-direction",
        holdSecondsAfter: 0,
      },
    ],
    segments: [
      {
        id: "start:end",
        fromNodeId: "start",
        toNodeId: "end",
        transitionSeconds: 2,
      },
    ],
    ...overrides,
  };
}

function validScrollTimeline(overrides = {}) {
  return {
    version: 1,
    fps: 60,
    durationSeconds: 4,
    range: { mode: "full" },
    pageSource: { mode: "page-bar", fallback: "current-page" },
    cameraSource: { mode: "camera-path", pathId: "camera-spine" },
    anchors: [{ id: "intro", label: "Intro", progress: 0, posterFrame: 0 }],
    outputProfileId: "mp4-review",
    ...overrides,
  };
}

test("capture profiles expose behavior-level mode visibility", async () => {
  const {
    captureVisibilityProfileForMode,
    isCaptureGroupVisible,
  } = await importBundled("src/capture/captureProfiles.ts");

  assert.equal(isCaptureGroupVisible("scene-only", "navControls"), false);
  assert.equal(isCaptureGroupVisible("scene-only", "legends"), false);
  assert.equal(
    isCaptureGroupVisible("scene-annotations", "captureNativeAnnotations"),
    true,
  );
  assert.equal(isCaptureGroupVisible("presentation-ui", "editorSidebar"), false);
  assert.equal(isCaptureGroupVisible("full-ui", "editorSidebar"), true);
  assert.equal(captureVisibilityProfileForMode("off").fullChrome, true);
});

test("capture MIME fallback and resolution validation behave at runtime", async () => {
  const {
    selectSupportedMediaRecorderMimeType,
  } = await importBundled("src/capture/canvasPreviewRecorder.ts");
  const {
    captureResolutionPresetById,
    captureResolutionPresetIdForResolution,
    validateRenderResolutionRequest,
    validateCaptureFps,
    validateCaptureResolution,
  } = await importBundled("src/capture/captureResolution.ts");

  assert.equal(
    selectSupportedMediaRecorderMimeType({
      isTypeSupported: (mimeType) => mimeType === "video/webm;codecs=vp8",
    }),
    "video/webm;codecs=vp8",
  );
  assert.equal(
    selectSupportedMediaRecorderMimeType({
      isTypeSupported: () => false,
    }),
    null,
  );
  assert.equal(selectSupportedMediaRecorderMimeType(undefined), null);
  assert.equal(captureResolutionPresetById("marketing-4k").width, 3840);
  assert.equal(captureResolutionPresetById("render-8k").width, 7680);
  assert.equal(
    captureResolutionPresetIdForResolution({ width: 7680, height: 4320 }),
    "render-8k",
  );
  assert.equal(validateCaptureResolution({ width: 7680, height: 4320 }), true);
  assert.equal(validateCaptureResolution({ width: 7681, height: 4320 }), false);
  assert.equal(
    validateRenderResolutionRequest({
      resolution: captureResolutionPresetById("render-8k"),
      supersampleScale: 1,
      maxTextureSize: 8192,
    }).valid,
    true,
  );
  assert.match(
    validateRenderResolutionRequest({
      resolution: captureResolutionPresetById("render-8k"),
      supersampleScale: 2,
      maxTextureSize: 8192,
    }).errors.join("\n"),
    /exceeds/,
  );
  assert.equal(validateCaptureFps(60), true);
  assert.equal(validateCaptureFps(24), true);
  assert.equal(validateCaptureFps(25), false);
});

test("capture frame-time helper rejects invalid inputs", async () => {
  const { getCaptureFrameTime } = await importBundled(
    "src/capture/captureRecipe.ts",
  );

  assert.equal(getCaptureFrameTime(15, 30), 0.5);
  assert.throws(() => getCaptureFrameTime(-1, 30), /frameIndex/);
  assert.throws(() => getCaptureFrameTime(1, 0), /fps/);
});

test("scroll animation timeline normalizes FPS, frame ranges, and progress samples", async () => {
  const {
    DEFAULT_CAPTURE_SCROLL_FPS,
    CAPTURE_SCROLL_FPS_OPTIONS,
    captureScrollFrameForSeconds,
    captureScrollSecondsForFrame,
    clampCaptureScrollFrameToRange,
    normalizeCaptureScrollTimeline,
    resolveCaptureScrollPlayStartFrame,
    resolveCaptureScrollFrameRange,
    sampleCaptureScrollTimeline,
    validateCaptureScrollTimeline,
  } = await importBundled("src/capture/captureScrollTimeline.ts");

  assert.equal(DEFAULT_CAPTURE_SCROLL_FPS, 60);
  assert.deepEqual(CAPTURE_SCROLL_FPS_OPTIONS, [30, 60, 120]);
  assert.equal(captureScrollFrameForSeconds(1.004), 60);
  assert.equal(captureScrollFrameForSeconds(1.009), 61);
  assert.equal(captureScrollFrameForSeconds(Number.NaN), 0);
  assert.equal(captureScrollSecondsForFrame(90), 1.5);

  const timeline = normalizeCaptureScrollTimeline({
    version: 1,
    fps: 60,
    durationSeconds: 10,
    range: { mode: "frame-range", startFrame: 120, endFrame: 239 },
    pageSource: { mode: "page-bar", fallback: "current-page" },
    cameraSource: { mode: "camera-path", pathId: "camera-spine" },
    anchors: [{ id: "intro", label: "Intro", progress: 0, posterFrame: 0 }],
    outputProfileId: "mp4-review",
  });

  assert.equal(timeline.fps, 60);
  assert.deepEqual(resolveCaptureScrollFrameRange(timeline), {
    startFrame: 120,
    endFrame: 239,
    totalFrames: 120,
  });
  assert.equal(
    clampCaptureScrollFrameToRange(80, resolveCaptureScrollFrameRange(timeline)),
    120,
  );
  assert.equal(
    clampCaptureScrollFrameToRange(180, resolveCaptureScrollFrameRange(timeline)),
    180,
  );
  assert.equal(
    resolveCaptureScrollPlayStartFrame(180, resolveCaptureScrollFrameRange(timeline)),
    180,
  );
  assert.equal(
    resolveCaptureScrollPlayStartFrame(260, resolveCaptureScrollFrameRange(timeline)),
    120,
  );
  assert.equal(sampleCaptureScrollTimeline(timeline, 180).normalizedProgress, 0.3);

  const invalidRange = validateCaptureScrollTimeline({
    ...timeline,
    range: { mode: "frame-range", startFrame: 240, endFrame: 239 },
  });
  assert.equal(invalidRange.valid, false);
  assert.match(invalidRange.errors.join("\n"), /startFrame/);
});

test("scroll animation timeline samples Page Bar clips without changing frame identity", async () => {
  const {
    normalizeCaptureScrollTimeline,
    sampleCaptureScrollTimeline,
    validateCaptureScrollTimeline,
  } = await importBundled("src/capture/captureScrollTimeline.ts");

  const pageClips = [
    {
      id: "clip-a",
      pageId: "page-a",
      label: "Page A",
      enabled: true,
      locked: false,
      startSeconds: 0,
      transitionSeconds: 1,
      holdSeconds: 1,
      transitionEasing: "linear",
    },
    {
      id: "clip-b",
      pageId: "page-b",
      label: "Page B",
      enabled: true,
      locked: false,
      startSeconds: 2,
      transitionSeconds: 1,
      holdSeconds: 1,
      transitionEasing: "ease-in-out",
    },
  ];

  const timeline = normalizeCaptureScrollTimeline({
    version: 1,
    fps: 60,
    durationSeconds: 4,
    range: { mode: "frame-range", startFrame: 120, endFrame: 179 },
    pageSource: {
      mode: "page-bar",
      fallback: "current-page",
      clips: pageClips,
    },
    cameraSource: { mode: "camera-path", pathId: "camera-spine" },
    anchors: [],
    outputProfileId: "mp4-review",
  });

  assert.equal(validateCaptureScrollTimeline(timeline).valid, true);

  const firstClipSample = sampleCaptureScrollTimeline(timeline, 30);
  assert.equal(firstClipSample.frameIndex, 30);
  assert.equal(firstClipSample.page.clipId, "clip-a");
  assert.equal(firstClipSample.page.pageId, "page-a");
  assert.equal(firstClipSample.page.sourcePageId, "page-a");
  assert.equal(firstClipSample.page.targetPageId, null);
  assert.equal(firstClipSample.page.transitionProgress, 0.5);
  assert.equal(firstClipSample.page.transitionEasing, "linear");
  assert.equal(firstClipSample.page.fallbackMode, "none");

  const crossingSample = sampleCaptureScrollTimeline(timeline, 150);
  assert.equal(crossingSample.frameIndex, 150);
  assert.equal(crossingSample.clampedFrameIndex, 150);
  assert.equal(crossingSample.timeSeconds, 2.5);
  assert.equal(crossingSample.page.clipId, "clip-b");
  assert.equal(crossingSample.page.pageId, "page-b");
  assert.equal(crossingSample.page.sourcePageId, "page-a");
  assert.equal(crossingSample.page.targetPageId, "page-b");
  assert.equal(crossingSample.page.localTimeSeconds, 0.5);
  assert.equal(crossingSample.page.transitionProgress, 0.5);
  assert.equal(crossingSample.page.transitionEasing, "ease-in-out");
  assert.ok(crossingSample.rangeProgress > 0 && crossingSample.rangeProgress < 1);
});

test("scroll page source preview resolves scene source while Camera Path owns pose", async () => {
  const {
    normalizeCaptureScrollTimeline,
    sampleCaptureScrollTimeline,
  } = await importBundled("src/capture/captureScrollTimeline.ts");
  const {
    normalizeCaptureCameraPathV3,
    sampleCaptureCameraPathV3,
  } = await importBundled("src/capture/captureCameraPathV3.ts");
  const {
    clearCapturePageSourcePreviewDebugState,
    resolveCapturePageSourcePreview,
  } = await importBundled("src/pages/capturePageSourcePreview.ts");

  const pages = [
    {
      id: "page-a",
      title: "Synthetic Page A",
      camera: pose([1000, 0, 100]),
    },
    {
      id: "page-b",
      title: "Synthetic Page B",
      camera: pose([2000, 0, 100]),
      visibilityOverrides: { seismic: true },
    },
  ];
  const timeline = normalizeCaptureScrollTimeline({
    version: 1,
    fps: 60,
    durationSeconds: 4,
    range: { mode: "full" },
    pageSource: {
      mode: "page-bar",
      fallback: "current-page",
      clips: [
        {
          id: "clip-a",
          pageId: "page-a",
          label: "Page A",
          enabled: true,
          locked: false,
          startSeconds: 0,
          transitionSeconds: 1,
          holdSeconds: 1,
          transitionEasing: "linear",
        },
        {
          id: "clip-b",
          pageId: "page-b",
          label: "Page B",
          enabled: true,
          locked: false,
          startSeconds: 2,
          transitionSeconds: 1,
          holdSeconds: 1,
          transitionEasing: "ease-in-out",
        },
      ],
    },
    cameraSource: { mode: "camera-path", pathId: "camera-spine" },
    anchors: [],
    outputProfileId: "mp4-review",
  });
  const cameraPath = normalizeCaptureCameraPathV3({
    version: 3,
    id: "camera-spine",
    name: "Camera Spine",
    loop: false,
    timeline: { durationSeconds: 4 },
    nodes: [
      {
        id: "cam-a",
        kind: "keyframe",
        enabled: true,
        hidden: false,
        timeSeconds: 0,
        position: [0, 0, 20],
        target: [0, 0, 0],
        up: [0, 1, 0],
        fov: 50,
        holdSecondsAfter: 0,
        aimGeometry: { mode: "free-direction", lensMode: "fixed-fov" },
      },
      {
        id: "cam-b",
        kind: "keyframe",
        enabled: true,
        hidden: false,
        timeSeconds: 4,
        position: [8, 0, 20],
        target: [8, 0, 0],
        up: [0, 1, 0],
        fov: 50,
        holdSecondsAfter: 0,
        aimGeometry: { mode: "free-direction", lensMode: "fixed-fov" },
      },
    ],
    segments: [
      {
        id: "cam-a:cam-b",
        fromNodeId: "cam-a",
        toNodeId: "cam-b",
        enabled: true,
        hidden: false,
        transitionSeconds: 4,
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
  });

  const pageBSample = sampleCaptureScrollTimeline(timeline, 210);
  const pageBPreview = resolveCapturePageSourcePreview({
    sample: {
      sourcePageId: pageBSample.page.sourcePageId,
      targetPageId: pageBSample.page.targetPageId,
      transitionProgress: pageBSample.page.transitionProgress,
      transitionEasing: pageBSample.page.transitionEasing,
      reason: "capture-scroll-preview",
    },
    pages,
    currentIndex: 0,
  });
  const cameraSample = sampleCaptureCameraPathV3(cameraPath, pageBSample.timeSeconds);
  assert.equal(pageBPreview.resolvedSourcePageId, "page-b");
  assert.equal(pageBPreview.resolvedTargetPageId, null);
  assert.equal(pageBPreview.appliedPageId, "page-b");
  assert.equal(pageBPreview.transitionActive, false);
  assert.notDeepEqual(cameraSample.position, pages[1].camera.position);

  const crossingSample = sampleCaptureScrollTimeline(timeline, 150);
  const crossingPreview = resolveCapturePageSourcePreview({
    sample: {
      sourcePageId: crossingSample.page.sourcePageId,
      targetPageId: crossingSample.page.targetPageId,
      transitionProgress: crossingSample.page.transitionProgress,
      transitionEasing: crossingSample.page.transitionEasing,
      reason: "capture-scroll-preview",
    },
    pages,
    currentIndex: 0,
  });
  assert.equal(crossingPreview.resolvedSourcePageId, "page-a");
  assert.equal(crossingPreview.resolvedTargetPageId, "page-b");
  assert.equal(crossingPreview.transitionActive, true);
  assert.equal(crossingPreview.transitionProgress, 0.5);
  assert.equal(crossingPreview.transitionEasing, "ease-in-out");

  const fallbackSample = sampleCaptureScrollTimeline(
    normalizeCaptureScrollTimeline({
      ...timeline,
      pageSource: { mode: "page-bar", fallback: "current-page", clips: [] },
    }),
    15,
  );
  const fallbackPreview = resolveCapturePageSourcePreview({
    sample: {
      sourcePageId: fallbackSample.page.sourcePageId,
      targetPageId: fallbackSample.page.targetPageId,
      transitionProgress: fallbackSample.page.transitionProgress,
      transitionEasing: fallbackSample.page.transitionEasing,
      reason: "capture-scroll-preview",
    },
    pages,
    currentIndex: 0,
  });
  assert.equal(fallbackPreview.fallbackMode, "current-page");
  assert.equal(fallbackPreview.appliedPageId, "page-a");

  const clearedPreview = clearCapturePageSourcePreviewDebugState(
    crossingPreview,
    "page-a",
  );
  assert.equal(clearedPreview.active, false);
  assert.equal(clearedPreview.transitionActive, false);
  assert.equal(clearedPreview.appliedPageId, "page-a");
});

test("scroll animation timeline reports current-page fallback and rejects overlong Page Bar clips", async () => {
  const {
    normalizeCaptureScrollTimeline,
    sampleCaptureScrollTimeline,
    validateCaptureScrollTimeline,
  } = await importBundled("src/capture/captureScrollTimeline.ts");

  const fallbackTimeline = normalizeCaptureScrollTimeline({
    version: 1,
    fps: 60,
    durationSeconds: 2,
    range: { mode: "full" },
    pageSource: {
      mode: "page-bar",
      fallback: "current-page",
      clips: [],
    },
    cameraSource: { mode: "camera-path", pathId: "camera-spine" },
    anchors: [],
    outputProfileId: "mp4-review",
  });

  const fallbackSample = sampleCaptureScrollTimeline(fallbackTimeline, 15);
  assert.equal(fallbackSample.page.clipId, null);
  assert.equal(fallbackSample.page.pageId, null);
  assert.equal(fallbackSample.page.sourcePageId, null);
  assert.equal(fallbackSample.page.targetPageId, null);
  assert.equal(fallbackSample.page.transitionProgress, 1);
  assert.equal(fallbackSample.page.transitionEasing, "ease-in-out");
  assert.equal(fallbackSample.page.fallbackMode, "current-page");

  const overlongTimeline = normalizeCaptureScrollTimeline({
    ...fallbackTimeline,
    pageSource: {
      mode: "page-bar",
      fallback: "current-page",
      clips: [
        {
          id: "overlong",
          pageId: "page-c",
          label: "Page C",
          enabled: true,
          locked: false,
          startSeconds: 1.5,
          transitionSeconds: 0.75,
          holdSeconds: 0,
          transitionEasing: "linear",
        },
      ],
    },
  });
  const overlongValidation = validateCaptureScrollTimeline(overlongTimeline);
  assert.equal(overlongValidation.valid, false);
  assert.match(overlongValidation.errors.join("\n"), /Page Bar clip timing/);
});

test("scroll animation timeline does not silently repair malformed frame ranges", async () => {
  const {
    normalizeCaptureScrollTimeline,
    resolveCaptureScrollFrameRange,
    validateCaptureScrollTimeline,
  } = await importBundled("src/capture/captureScrollTimeline.ts");

  const timeline = normalizeCaptureScrollTimeline({
    version: 1,
    fps: 60,
    durationSeconds: 2,
    range: { mode: "frame-range", startFrame: "bad", endFrame: "also-bad" },
    pageSource: { mode: "page-bar", fallback: "current-page" },
    cameraSource: { mode: "camera-path", pathId: "camera-spine" },
    anchors: [],
    outputProfileId: "mp4-review",
  });
  const validation = validateCaptureScrollTimeline(timeline);

  assert.equal(validation.valid, false);
  assert.match(validation.errors.join("\n"), /startFrame/);
  assert.match(validation.errors.join("\n"), /endFrame/);
  assert.throws(() => resolveCaptureScrollFrameRange(timeline), /Invalid capture scroll timeline/);
});

test("scroll animation timeline rejects invalid sample frames and clamps terminal progress", async () => {
  const {
    normalizeCaptureScrollTimeline,
    sampleCaptureScrollTimeline,
  } = await importBundled("src/capture/captureScrollTimeline.ts");

  const timeline = normalizeCaptureScrollTimeline({
    version: 1,
    fps: 60,
    durationSeconds: 1,
    range: { mode: "full" },
    pageSource: { mode: "page-bar", fallback: "current-page" },
    cameraSource: { mode: "camera-path", pathId: "camera-spine" },
    anchors: [],
    outputProfileId: "mp4-review",
  });

  for (const frameIndex of [Number.NaN, Infinity, 1.5, -1]) {
    assert.throws(
      () => sampleCaptureScrollTimeline(timeline, frameIndex),
      /frameIndex/,
    );
  }

  assert.equal(sampleCaptureScrollTimeline(timeline, 59).normalizedProgress, 1);
  assert.deepEqual(
    {
      clampedFrameIndex: sampleCaptureScrollTimeline(timeline, 60).clampedFrameIndex,
      normalizedProgress: sampleCaptureScrollTimeline(timeline, 60).normalizedProgress,
    },
    { clampedFrameIndex: 59, normalizedProgress: 1 },
  );
});

test("scroll animation timeline normalization preserves invalid fps and duration for validation", async () => {
  const {
    normalizeCaptureScrollTimeline,
    validateCaptureScrollTimeline,
  } = await importBundled("src/capture/captureScrollTimeline.ts");

  const base = {
    version: 1,
    fps: 60,
    durationSeconds: 1,
    range: { mode: "full" },
    pageSource: { mode: "page-bar", fallback: "current-page" },
    cameraSource: { mode: "camera-path", pathId: "camera-spine" },
    anchors: [],
    outputProfileId: "mp4-review",
  };

  const invalidFps = validateCaptureScrollTimeline(
    normalizeCaptureScrollTimeline({ ...base, fps: 24 }),
  );
  assert.equal(invalidFps.valid, false);
  assert.match(invalidFps.errors.join("\n"), /fps/);

  for (const durationSeconds of [Number.NaN, Infinity, 0, -1]) {
    const validation = validateCaptureScrollTimeline(
      normalizeCaptureScrollTimeline({ ...base, durationSeconds }),
    );
    assert.equal(validation.valid, false);
    assert.match(validation.errors.join("\n"), /durationSeconds/);
  }
});

test("scroll animation timeline validates anchor progress and poster frame bounds", async () => {
  const {
    normalizeCaptureScrollTimeline,
    validateCaptureScrollTimeline,
  } = await importBundled("src/capture/captureScrollTimeline.ts");

  const base = {
    version: 1,
    fps: 60,
    durationSeconds: 1,
    range: { mode: "full" },
    pageSource: { mode: "page-bar", fallback: "current-page" },
    cameraSource: { mode: "camera-path", pathId: "camera-spine" },
    outputProfileId: "mp4-review",
  };
  const invalidProgress = validateCaptureScrollTimeline(
    normalizeCaptureScrollTimeline({
      ...base,
      anchors: [{ id: "intro", label: "Intro", progress: 1.5, posterFrame: 0 }],
    }),
  );
  assert.equal(invalidProgress.valid, false);
  assert.match(invalidProgress.errors.join("\n"), /progress/);

  const invalidPoster = validateCaptureScrollTimeline(
    normalizeCaptureScrollTimeline({
      ...base,
      anchors: [{ id: "intro", label: "Intro", progress: 0.5, posterFrame: 60 }],
    }),
  );
  assert.equal(invalidPoster.valid, false);
  assert.match(invalidPoster.errors.join("\n"), /posterFrame/);
});

test("scroll record requests default to deterministic 60 FPS and validate accepted output state", async () => {
  const {
    createScrollRecordRequest,
    validateScrollRecordRequest,
  } = await importBundled("src/capture/captureScrollTimeline.ts");

  const request = createScrollRecordRequest({
    timeline: {
      version: 1,
      durationSeconds: 3,
      range: { mode: "full" },
      pageSource: { mode: "current-page", fallback: "none" },
      cameraSource: { mode: "current-camera", pathId: null },
      anchors: [],
      outputProfileId: "mp4-review",
    },
    format: "mp4",
    quality: { preset: "1080p", width: 1920, height: 1080 },
    destination: ".tmp/capture-scroll-outputs",
    packageName: "task-3-scroll",
    cleanRender: true,
    renderRouteIntent: "browser-inline",
    advancedOptions: { includeDiagnostics: true },
    createdAt: "2026-06-16T00:00:00.000Z",
  });

  assert.equal(request.schema, "CaptureScrollRecordRequestV1");
  assert.equal(request.version, 1);
  assert.equal(request.timeline.fps, 60);
  assert.deepEqual(request.frameRange, {
    startFrame: 0,
    endFrame: 179,
    totalFrames: 180,
  });
  assert.equal(request.format, "mp4");
  assert.equal(request.quality.width, 1920);
  assert.equal(request.destination, ".tmp/capture-scroll-outputs");
  assert.equal(request.packageName, "task-3-scroll");
  assert.equal(request.cleanRender, true);
  assert.equal(request.renderRouteIntent, "browser-inline");
  assert.equal(validateScrollRecordRequest(request).valid, true);
});

test("scroll handoff pending manifests derive valid partial package contracts from requests", async () => {
  const {
    createScrollRecordRequest,
  } = await importBundled("src/capture/captureScrollTimeline.ts");
  const {
    createPendingScrollHandoffManifest,
    validateScrollHandoffManifest,
  } = await importBundled("src/capture/scrollHandoffPackage.ts");

  const request = createScrollRecordRequest({
    timeline: validScrollTimeline({
      range: { mode: "frame-range", startFrame: 30, endFrame: 89 },
    }),
    format: "mp4",
    quality: { preset: "4k", width: 3840, height: 2160 },
    destination: ".tmp/capture-scroll-outputs",
    packageName: "valid-4k-scroll",
    cleanRender: true,
    renderRouteIntent: "local-external",
    advancedOptions: { includeDiagnostics: true, manualFallbackAccepted: false },
    createdAt: "2026-06-16T00:00:00.000Z",
  });
  const manifest = createPendingScrollHandoffManifest(request);

  assert.equal(manifest.status, "partial");
  assert.equal(manifest.packageId, "valid-4k-scroll");
  assert.equal(manifest.createdAt, request.createdAt);
  assert.deepEqual(manifest.frameRange, request.frameRange);
  assert.deepEqual(manifest.frames, {
    directory: "frames",
    pattern: "frame-%06d.png",
    count: request.frameRange.totalFrames,
  });
  assert.equal(manifest.media.length, 1);
  assert.equal(manifest.media[0].role, "primary");
  assert.equal(manifest.media[0].path, "media/scroll-master.mp4");
  assert.equal(manifest.diagnosticsPath, "diagnostics/valid-4k-scroll.json");
  assert.equal(manifest.sourceContract.request.schema, "CaptureScrollRecordRequestV1");
  assert.equal(validateScrollHandoffManifest(manifest).valid, true);
});

test("scroll handoff pending manifests support partial PNG sequence outputs", async () => {
  const {
    createScrollRecordRequest,
  } = await importBundled("src/capture/captureScrollTimeline.ts");
  const {
    createPendingScrollHandoffManifest,
    validateScrollHandoffManifest,
  } = await importBundled("src/capture/scrollHandoffPackage.ts");

  const request = createScrollRecordRequest({
    timeline: validScrollTimeline({
      durationSeconds: 2,
      range: { mode: "frame-range", startFrame: 10, endFrame: 20 },
    }),
    format: "png-sequence",
    quality: { preset: "1440p", width: 2560, height: 1440 },
    destination: ".tmp/capture-scroll-outputs",
    packageName: "png-sequence-scroll",
    cleanRender: true,
    renderRouteIntent: "browser-inline",
    advancedOptions: {},
    createdAt: "2026-06-16T00:00:00.000Z",
  });
  const manifest = createPendingScrollHandoffManifest(request);

  assert.equal(manifest.status, "partial");
  assert.deepEqual(manifest.frames, {
    directory: "frames",
    pattern: "frame-%06d.png",
    count: 11,
  });
  assert.deepEqual(manifest.media, []);
  assert.equal(validateScrollHandoffManifest(manifest).valid, true);
});

test("scroll handoff pending manifests assign media roles by scroll output format", async () => {
  const {
    createScrollRecordRequest,
  } = await importBundled("src/capture/captureScrollTimeline.ts");
  const {
    createPendingScrollHandoffManifest,
  } = await importBundled("src/capture/scrollHandoffPackage.ts");

  const cases = [
    ["mp4", "primary", "video/mp4", "media/scroll-master.mp4"],
    ["webm", "delivery", "video/webm", "media/scroll-master.webm"],
    [
      "scroll-friendly-video",
      "scroll-friendly",
      "video/mp4",
      "media/scroll-friendly.mp4",
    ],
  ];

  for (const [format, role, mimeType, path] of cases) {
    const request = createScrollRecordRequest({
      timeline: validScrollTimeline(),
      format,
      quality: { preset: "1080p", width: 1920, height: 1080 },
      destination: ".tmp/capture-scroll-outputs",
      packageName: `media-role-${format}`,
      cleanRender: true,
      renderRouteIntent: "browser-inline",
      advancedOptions: {},
      createdAt: "2026-06-16T00:00:00.000Z",
    });
    const manifest = createPendingScrollHandoffManifest(request);

    assert.deepEqual(manifest.media, [{ role, path, mimeType }]);
  }
});

test("scroll record request validation rejects unsafe package, timing, route, and dimensions", async () => {
  const {
    createScrollRecordRequest,
    validateScrollRecordRequest,
  } = await importBundled("src/capture/captureScrollTimeline.ts");

  function invalidRequest(overrides) {
    return validateScrollRecordRequest(
      createScrollRecordRequest({
        timeline: validScrollTimeline(),
        format: "mp4",
        quality: { preset: "1080p", width: 1920, height: 1080 },
        destination: ".tmp/capture-scroll-outputs",
        packageName: "invalid-scroll",
        cleanRender: true,
        renderRouteIntent: "browser-inline",
        advancedOptions: {},
        createdAt: "2026-06-16T00:00:00.000Z",
        ...overrides,
      }),
    );
  }

  for (const [label, overrides, pattern] of [
    ["empty package", { packageName: "   " }, /packageName/],
    ["unsafe package characters", { packageName: "bad package:name" }, /packageName/],
    ["reserved package name", { packageName: "CON.json" }, /packageName/],
    ["bad fps", { timeline: validScrollTimeline({ fps: 24 }) }, /fps/],
    [
      "bad frame range",
      { timeline: validScrollTimeline({ range: { mode: "frame-range", startFrame: 20, endFrame: 10 } }) },
      /startFrame/,
    ],
    ["absolute destination", { destination: "C:\\capture\\out" }, /destination/],
    ["uri destination", { destination: "file:///tmp/out" }, /destination/],
    ["parent destination", { destination: "../out" }, /destination/],
    ["project fixture destination", { destination: "projects/utah-forge/out" }, /destination/],
    [
      "4k inline route",
      { quality: { preset: "4k", width: 3840, height: 2160 } },
      /local-external/,
    ],
    [
      "malformed 8k",
      {
        quality: { preset: "8k", width: 7680, height: 4000 },
        renderRouteIntent: "local-external",
      },
      /8K/,
    ],
    [
      "preset dimension mismatch",
      {
        quality: { preset: "6k", width: 7680, height: 4320 },
        renderRouteIntent: "local-external",
      },
      /dimensions/,
    ],
    ["unsupported format", { format: "mov" }, /format/],
  ]) {
    const validation = invalidRequest(overrides);
    assert.equal(validation.valid, false, `${label} should be invalid`);
    assert.match(validation.errors.join("\n"), pattern, label);
  }

  assert.equal(
    invalidRequest({
      quality: { preset: "4k", width: 3840, height: 2160 },
      renderRouteIntent: "manual-fallback",
      advancedOptions: { manualFallbackAccepted: true },
    }).valid,
    true,
  );
});

test("scroll handoff packages validate explicit status and complete outputs", async () => {
  const {
    createScrollHandoffManifest,
    validateScrollHandoffManifest,
  } = await importBundled("src/capture/scrollHandoffPackage.ts");

  const complete = createScrollHandoffManifest({
    packageId: "scroll-run-1",
    status: "complete",
    createdAt: "2026-06-16T00:00:00.000Z",
    outputProfileId: "mp4-review",
    fps: 60,
    durationSeconds: 2,
    frameRange: { startFrame: 0, endFrame: 119, totalFrames: 120 },
    media: [
      {
        role: "primary",
        path: "media/scroll.mp4",
        mimeType: "video/mp4",
        byteLength: 1024,
      },
    ],
    sourceContract: { timeline: "scroll" },
  });

  assert.equal(complete.schema, "ScrollHandoffPackageV1");
  assert.equal(validateScrollHandoffManifest(complete).valid, true);

  const incomplete = validateScrollHandoffManifest({
    ...complete,
    media: [],
    frames: { directory: null, pattern: null, count: 0 },
  });
  assert.equal(incomplete.valid, false);
  assert.match(incomplete.errors.join("\n"), /complete/);

  const partial = validateScrollHandoffManifest({
    ...complete,
    status: "partial",
    media: [],
    frames: { directory: null, pattern: null, count: 0 },
  });
  assert.equal(partial.valid, true);

  const invalidPath = validateScrollHandoffManifest({
    ...complete,
    media: [{ role: "primary", path: "/absolute/out.mp4", mimeType: "video/mp4" }],
  });
  assert.equal(invalidPath.valid, false);
  assert.match(invalidPath.errors.join("\n"), /package-relative/);

  const driveRelativePath = validateScrollHandoffManifest({
    ...complete,
    media: [
      {
        role: "primary",
        path: "C:drive-relative.mp4",
        mimeType: "video/mp4",
      },
    ],
  });
  assert.equal(driveRelativePath.valid, false);
  assert.match(driveRelativePath.errors.join("\n"), /package-relative/);

  const uriSchemePath = validateScrollHandoffManifest({
    ...complete,
    media: [
      {
        role: "primary",
        path: "data:text/plain",
        mimeType: "video/mp4",
      },
    ],
  });
  assert.equal(uriSchemePath.valid, false);
  assert.match(uriSchemePath.errors.join("\n"), /package-relative/);

  const arraySourceContract = validateScrollHandoffManifest({
    ...complete,
    sourceContract: [],
  });
  assert.equal(arraySourceContract.valid, false);
  assert.match(arraySourceContract.errors.join("\n"), /sourceContract/);
});

test("scroll handoff complete, cancelled, and failed manifests retain package evidence", async () => {
  const {
    createScrollRecordRequest,
  } = await importBundled("src/capture/captureScrollTimeline.ts");
  const {
    createFinalScrollHandoffManifest,
    createPendingScrollHandoffManifest,
    validateScrollHandoffManifest,
  } = await importBundled("src/capture/scrollHandoffPackage.ts");

  const request = createScrollRecordRequest({
    timeline: validScrollTimeline({
      durationSeconds: 3,
      range: { mode: "frame-range", startFrame: 60, endFrame: 89 },
    }),
    format: "mp4",
    quality: { preset: "1080p", width: 1920, height: 1080 },
    destination: ".tmp/capture-scroll-outputs",
    packageName: "complete-scroll",
    cleanRender: true,
    renderRouteIntent: "browser-inline",
    advancedOptions: { includeDiagnostics: true },
    createdAt: "2026-06-16T00:00:00.000Z",
  });
  const pending = createPendingScrollHandoffManifest(request);
  const complete = createFinalScrollHandoffManifest({
    manifest: pending,
    status: "complete",
    media: [
      {
        role: "primary",
        path: "media/scroll-master.mp4",
        mimeType: "video/mp4",
        byteLength: 2048,
      },
    ],
    frames: { directory: "frames", pattern: "frame-%06d.png", count: 30 },
    diagnosticsPath: "diagnostics/complete-scroll.json",
    posters: [
      { anchorId: "first", frame: 60, path: "posters/frame-000060.png" },
      { anchorId: "last", frame: 89, path: "posters/frame-000089.png" },
    ],
    contactSheetPath: "posters/contact-sheet.png",
    warnings: ["kept source frames"],
  });

  assert.equal(complete.status, "complete");
  assert.deepEqual(complete.frameRange, { startFrame: 60, endFrame: 89, totalFrames: 30 });
  assert.equal(complete.media[0].byteLength, 2048);
  assert.equal(complete.frames.count, 30);
  assert.equal(complete.posters.length, 2);
  assert.equal(complete.contactSheetPath, "posters/contact-sheet.png");
  assert.equal(validateScrollHandoffManifest(complete).valid, true);

  const cancelled = createFinalScrollHandoffManifest({
    manifest: pending,
    status: "cancelled",
    frames: { directory: "frames", pattern: "frame-%06d.png", count: 12 },
    diagnosticsPath: "diagnostics/complete-scroll.json",
    warnings: ["cancelled by user"],
  });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.frames.count, 12);
  assert.equal(validateScrollHandoffManifest(cancelled).valid, true);

  const failed = createFinalScrollHandoffManifest({
    manifest: pending,
    status: "failed",
    frames: { directory: "frames", pattern: "frame-%06d.png", count: 3 },
    diagnosticsPath: "diagnostics/complete-scroll.json",
    warnings: ["renderer exited"],
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.frames.count, 3);
  assert.equal(validateScrollHandoffManifest(failed).valid, true);
});

test("scroll handoff clean render metadata, README, hashes, and handoff paths validate", async () => {
  const {
    createScrollRecordRequest,
  } = await importBundled("src/capture/captureScrollTimeline.ts");
  const {
    createFinalScrollHandoffManifest,
    createPendingScrollHandoffManifest,
    scrollCleanRenderSettingsForRequest,
    validateScrollHandoffManifest,
  } = await importBundled("src/capture/scrollHandoffPackage.ts");

  const request = createScrollRecordRequest({
    timeline: validScrollTimeline({ durationSeconds: 2 }),
    format: "mp4",
    quality: { preset: "1080p", width: 1920, height: 1080 },
    destination: ".tmp/capture-scroll-outputs",
    packageName: "clean-handoff-scroll",
    cleanRender: true,
    renderRouteIntent: "browser-inline",
    advancedOptions: { includeDiagnostics: true },
    createdAt: "2026-06-16T00:00:00.000Z",
  });
  const pending = createPendingScrollHandoffManifest(request);
  assert.deepEqual(pending.cleanRender, scrollCleanRenderSettingsForRequest(request));
  assert.equal(pending.cleanRender.enabled, true);
  assert.equal(pending.cleanRender.mode, "scene-only");
  assert.ok(pending.cleanRender.hiddenGroups.includes("authoringControls"));
  assert.ok(pending.cleanRender.hiddenGroups.includes("debugPanels"));
  assert.deepEqual(pending.cleanRender.exportOverlay, { enabled: false, mode: null });

  const complete = createFinalScrollHandoffManifest({
    manifest: pending,
    status: "complete",
    media: [
      {
        role: "primary",
        path: "media/scroll-master.mp4",
        mimeType: "video/mp4",
        byteLength: 4096,
      },
    ],
    frames: { directory: "frames", pattern: "frame-%06d.png", count: 120 },
    posters: [{ anchorId: "intro", frame: 0, path: "posters/intro-frame-000000.png" }],
    contactSheetPath: "posters/contact-sheet.png",
    readmePath: "README.md",
    diagnosticsPath: "diagnostics/clean-handoff-scroll.json",
    hashes: [
      { path: "media/scroll-master.mp4", sha256: "a".repeat(64) },
      { path: "README.md", sha256: "b".repeat(64) },
      { path: "posters/contact-sheet.png", sha256: "c".repeat(64) },
    ],
  });

  assert.equal(validateScrollHandoffManifest(complete).valid, true);
  assert.equal(complete.readmePath, "README.md");
  assert.equal(complete.hashes.length, 3);

  for (const [field, value] of [
    ["readmePath", "../README.md"],
    ["contactSheetPath", "file:///tmp/contact-sheet.png"],
  ]) {
    const invalid = validateScrollHandoffManifest({ ...complete, [field]: value });
    assert.equal(invalid.valid, false);
    assert.match(invalid.errors.join("\n"), /package-relative/);
  }

  const badHash = validateScrollHandoffManifest({
    ...complete,
    hashes: [{ path: "../media/scroll-master.mp4", sha256: "" }],
  });
  assert.equal(badHash.valid, false);
  assert.match(badHash.errors.join("\n"), /hashes\[0\]/);
});

test("scroll handoff poster and contact sheet frames are deterministic", async () => {
  const {
    selectScrollContactSheetFrames,
    selectScrollPosterFrames,
  } = await importBundled("src/capture/scrollHandoffPackage.ts");

  const timeline = validScrollTimeline({
    durationSeconds: 4,
    anchors: [
      { id: "intro", label: "Intro", progress: 0, posterFrame: 0 },
      { id: "center", label: "Center", progress: 0.5, posterFrame: 120 },
      { id: "dupe", label: "Duplicate", progress: 0.5, posterFrame: 120 },
      { id: "outro", label: "Outro", progress: 1, posterFrame: 239 },
    ],
  });
  const frameRange = { startFrame: 0, endFrame: 239, totalFrames: 240 };

  assert.deepEqual(selectScrollPosterFrames(timeline, frameRange), [
    { anchorId: "intro", frame: 0 },
    { anchorId: "center", frame: 120 },
    { anchorId: "dupe", frame: 120 },
    { anchorId: "outro", frame: 239 },
  ]);
  assert.deepEqual(selectScrollContactSheetFrames(timeline, frameRange), [
    { id: "first", frame: 0 },
    { id: "middle", frame: 119 },
    { id: "center", frame: 120 },
    { id: "outro", frame: 239 },
  ]);

  const fallbackTimeline = validScrollTimeline({ anchors: [] });
  assert.deepEqual(selectScrollPosterFrames(fallbackTimeline, frameRange), [
    { anchorId: "first", frame: 0 },
    { anchorId: "middle", frame: 119 },
    { anchorId: "last", frame: 239 },
  ]);
  assert.deepEqual(selectScrollContactSheetFrames(fallbackTimeline, frameRange), [
    { id: "first", frame: 0 },
    { id: "middle", frame: 119 },
    { id: "last", frame: 239 },
  ]);
});

test("CaptureCameraPath validates, normalizes, samples, and moves spline-owned keyframes", async () => {
  const {
    createCaptureCameraPathFromKeyframes,
    cameraPathToRecipeKeyframes,
    moveCaptureCameraPathKeyframe,
    moveCaptureCameraPathSegment,
    normalizeCaptureCameraPath,
    recipeKeyframesToCameraPath,
    sampleCaptureCameraPath,
    validateCaptureCameraPath,
  } = await importBundled("src/capture/captureCameraPath.ts");

  const path = createCaptureCameraPathFromKeyframes(
    [
      {
        id: "b",
        timeSeconds: 2,
        position: [20, 0, 10],
        target: [2, 0, 0],
        up: [0, 0, 1],
        fov: 45,
        easing: "ease-in-out",
      },
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
        id: "c",
        timeSeconds: 4,
        position: [40, 0, 10],
        target: [4, 0, 0],
        up: [0, 0, 1],
        fov: 40,
        easing: "linear",
      },
    ],
    4,
    { id: "path-test", name: "Path Test" },
  );

  assert.equal(validateCaptureCameraPath(path, 4).valid, true);
  assert.deepEqual(
    normalizeCaptureCameraPath(path).keyframes.map((keyframe) => keyframe.id),
    ["a", "b", "c"],
  );
  assert.equal(sampleCaptureCameraPath(path, 2).timeSeconds, 2);
  assert.deepEqual(sampleCaptureCameraPath(path, 0).position, [0, 0, 10]);
  assert.deepEqual(sampleCaptureCameraPath(path, 4).position, [40, 0, 10]);
  const middle = sampleCaptureCameraPath(path, 1);
  assert.equal(middle.position.length, 3);
  assert.equal(middle.target.length, 3);
  assert.equal(Number.isFinite(middle.fov), true);

  const movedPoint = moveCaptureCameraPathKeyframe(path, "b", [25, 5, 15]);
  assert.deepEqual(
    movedPoint.keyframes.find((keyframe) => keyframe.id === "b").position,
    [25, 5, 15],
  );
  const movedSegment = moveCaptureCameraPathSegment(path, "a:b", [1, 2, 3]);
  assert.deepEqual(
    movedSegment.keyframes.find((keyframe) => keyframe.id === "a").position,
    [1, 2, 13],
  );
  assert.deepEqual(
    movedSegment.keyframes.find((keyframe) => keyframe.id === "b").position,
    [21, 2, 13],
  );
  assert.deepEqual(
    cameraPathToRecipeKeyframes(path).map((keyframe) => keyframe.timeSeconds),
    [0, 2, 4],
  );
  assert.equal(
    recipeKeyframesToCameraPath(
      {
        cameraKeyframes: cameraPathToRecipeKeyframes(path),
        durationSeconds: 4,
      },
      { id: "upgraded", name: "Upgraded" },
    ).keyframes.length,
    3,
  );

  const invalid = validateCaptureCameraPath(
    {
      ...path,
      keyframes: [
        path.keyframes[0],
        { ...path.keyframes[1], timeSeconds: 0, easing: "bounce" },
      ],
    },
    4,
  );
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /unique/);
  assert.match(invalid.errors.join("\n"), /easing/);
});

test("CaptureRecipe validation rejects malformed deterministic export state", async () => {
  const { validateCaptureRecipe } = await importBundled(
    "src/capture/captureRecipe.ts",
  );

  assert.equal(validateCaptureRecipe(validRecipe()).valid, true);

  const invalid = validateCaptureRecipe(
    validRecipe({
      mode: "invalid-mode",
      camera: { position: [1, 2], target: [0, 0, 0], up: [0, 0, 1], fov: 50 },
      cameraKeyframes: [
        {
          timeSeconds: -1,
          camera: { position: [1, 2, 3], target: [0, 0, 0], up: [0, 0, 1] },
          easing: "bounce",
        },
      ],
      layerVisibility: { a: "yes" },
      layerStyles: { a: null },
    }),
  );

  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /mode is not supported/);
  assert.match(invalid.errors.join("\n"), /camera must be a valid pose/);
  assert.match(invalid.errors.join("\n"), /timeSeconds must be non-negative/);
  assert.match(invalid.errors.join("\n"), /easing is not supported/);
  assert.match(invalid.errors.join("\n"), /layerVisibility\.a must be boolean/);
  assert.match(invalid.errors.join("\n"), /layerStyles\.a must be an object/);

  const invalidPageRange = validateCaptureRecipe(
    validRecipe({
      captureScope: "page-range",
      pageRangeStartId: "",
      pageRangeEndId: null,
      pageRangeTiming: "wild",
      equalHoldSeconds: -1,
    }),
  );
  assert.equal(invalidPageRange.valid, false);
  assert.match(invalidPageRange.errors.join("\n"), /pageRangeStartId/);
  assert.match(invalidPageRange.errors.join("\n"), /pageRangeEndId/);
  assert.match(invalidPageRange.errors.join("\n"), /pageRangeTiming/);
  assert.match(invalidPageRange.errors.join("\n"), /equalHoldSeconds/);
});

test("CaptureRecipe JSON helpers roundtrip and validate keyframe timelines", async () => {
  const {
    captureRecipeFilename,
    parseCaptureRecipeJson,
    serializeCaptureRecipe,
    validateCaptureRecipe,
  } = await importBundled("src/capture/captureRecipe.ts");
  const recipe = validRecipe({
    resolution: { width: 7680, height: 4320, label: "8K" },
    previewResolution: { width: 1920, height: 1080, label: "1080p" },
    durationSeconds: 4,
    cameraKeyframes: [
      { timeSeconds: 2, camera: pose([20, 0, 10]), easing: "ease-in-out" },
      { timeSeconds: 0, camera: pose([0, 0, 10]), easing: "linear" },
    ],
    captureScope: "page-range",
    pageRangeStartId: "page-a",
    pageRangeEndId: "page-c",
    pageRangeTiming: "authored",
  });

  const serialized = serializeCaptureRecipe(recipe);
  assert.ok(serialized.endsWith("\n"));
  const parsed = parseCaptureRecipeJson(serialized);
  assert.equal(parsed.validation.valid, true);
  assert.equal(parsed.recipe.resolution.width, 7680);
  assert.equal(parsed.recipe.renderFidelity, "max-detail-render");
  assert.equal(parsed.recipe.captureScope, "page-range");
  assert.equal(parsed.recipe.pageRangeStartId, "page-a");
  assert.equal(parsed.recipe.pageRangeEndId, "page-c");
  assert.deepEqual(
    parsed.recipe.cameraKeyframes.map((keyframe) => keyframe.timeSeconds),
    [0, 2],
  );
  assert.match(captureRecipeFilename(parsed.recipe), /^geosee-runtime-test-page-a-8k-\d{8}T\d{6}Z\.capture\.json$/);

  assert.equal(parseCaptureRecipeJson("{ nope").recipe, null);
  const invalidDuplicate = validateCaptureRecipe(
    validRecipe({
      durationSeconds: 1,
      cameraKeyframes: [
        { timeSeconds: 0.5, camera: pose([0, 0, 10]) },
        { timeSeconds: 0.5, camera: pose([1, 0, 10]) },
      ],
    }),
  );
  assert.match(invalidDuplicate.errors.join("\n"), /keyframe times must be unique/);

  const invalidFrameIndex = validateCaptureRecipe(
    validRecipe({
      fps: 30,
      cameraKeyframes: [
        { timeSeconds: 1, frameIndex: 2, camera: pose([0, 0, 10]) },
      ],
    }),
  );
  assert.match(invalidFrameIndex.errors.join("\n"), /frameIndex/);
});

test("CaptureRecipe JSON helpers roundtrip v2 camera paths and mirror legacy keyframes", async () => {
  const {
    parseCaptureRecipeJson,
    serializeCaptureRecipe,
    validateCaptureRecipe,
  } = await importBundled("src/capture/captureRecipe.ts");
  const recipe = validRecipe({
    fps: 30,
    durationSeconds: 2,
    cameraKeyframes: [],
    cameraPath: cameraPathV2(),
  });

  const validation = validateCaptureRecipe(recipe);
  assert.equal(validation.valid, true, validation.errors.join("\n"));

  const parsed = parseCaptureRecipeJson(serializeCaptureRecipe(recipe));
  assert.equal(parsed.validation.valid, true, parsed.validation.errors.join("\n"));
  assert.equal(parsed.recipe.cameraPath.version, 2);
  assert.deepEqual(
    parsed.recipe.cameraPath.nodes.map((node) => node.id),
    ["start", "end"],
  );
  assert.deepEqual(
    parsed.recipe.cameraKeyframes.map((keyframe) => [
      keyframe.frameIndex,
      keyframe.timeSeconds,
      keyframe.camera.position,
    ]),
    [
      [0, 0, [0, 0, 0]],
      [60, 2, [60, 0, 0]],
    ],
  );
  assert.deepEqual(parsed.recipe.cameraTimeline, {
    version: 2,
    fps: 30,
    durationFrames: 60,
    durationSeconds: 2,
    keyframeCount: 2,
  });
});

test("CaptureRecipe normalization drops empty v2 camera paths", async () => {
  const {
    createCaptureRecipeFromCurrentState,
    normalizeCaptureRecipe,
  } = await importBundled("src/capture/captureRecipe.ts");
  const emptyCameraPath = cameraPathV2({
    nodes: [],
    segments: [],
    timeline: { durationSeconds: 0 },
  });

  const normalized = normalizeCaptureRecipe(
    validRecipe({
      durationSeconds: 4,
      cameraPath: emptyCameraPath,
      cameraKeyframes: [],
    }),
  );
  assert.equal(normalized.cameraPath, null);
  assert.equal(normalized.cameraTimeline, null);
  assert.deepEqual(normalized.cameraKeyframes, []);

  const snapshot = createCaptureRecipeFromCurrentState(
    validRecipe({
      durationSeconds: 4,
      cameraPath: emptyCameraPath,
      cameraKeyframes: [],
    }),
  );
  assert.equal(snapshot.cameraPath, null);
  assert.equal(snapshot.cameraTimeline, null);
  assert.deepEqual(snapshot.cameraKeyframes, []);
});

test("CaptureCameraPath v2 playback validation rejects unusable recipe paths", async () => {
  const {
    captureCameraPathV2Renderable,
    validateCaptureCameraPathV2,
    validateCaptureCameraPathV2Playback,
  } = await importBundled("src/capture/captureCameraPathV2.ts");
  const allDisabledPath = cameraPathV2({
    nodes: cameraPathV2().nodes.map((node) => ({ ...node, enabled: false })),
    segments: cameraPathV2().segments.map((segment) => ({
      ...segment,
      enabled: false,
    })),
  });
  const zeroDurationPath = cameraPathV2({
    nodes: cameraPathV2().nodes.map((node) => ({
      ...node,
      holdSecondsAfter: 0,
    })),
    segments: cameraPathV2().segments.map((segment) => ({
      ...segment,
      transitionSeconds: 0,
    })),
    timeline: { durationSeconds: 0 },
  });

  for (const [label, cameraPath, message] of [
    [
      "empty",
      cameraPathV2({ nodes: [], segments: [], timeline: { durationSeconds: 0 } }),
      /at least two active camera views/i,
    ],
    ["all-disabled", allDisabledPath, /at least two active camera views/i],
    ["zero-duration", zeroDurationPath, /duration.*greater than zero/i],
  ]) {
    assert.equal(
      validateCaptureCameraPathV2(cameraPath).valid,
      true,
      `${label} path should remain a valid draft recipe path`,
    );
    assert.equal(
      captureCameraPathV2Renderable(cameraPath),
      false,
      `${label} path should not be renderable for Play Path or preview recording`,
    );
    const validation = validateCaptureCameraPathV2Playback(cameraPath);
    assert.equal(validation.valid, false, `${label} path should be rejected`);
    assert.match(validation.errors.join("\n"), message);
  }
});

test("CaptureRecipe keeps empty v2 paths as cameraPath null while still and render exports remain valid", async () => {
  const restoreDocument = installDocumentStub();
  const urlStub = installUrlStub();
  try {
    const {
      createCaptureRecipeFromCurrentState,
      validateCaptureRecipe,
    } = await importBundled("src/capture/captureRecipe.ts");
    const { exportDeterministicFrameSequence } = await importBundled(
      "src/capture/deterministicFrameSequenceExporter.ts",
    );
    const { exportDeterministicStill } = await importBundled(
      "src/capture/deterministicStillExporter.ts",
    );
    const recipe = createCaptureRecipeFromCurrentState(
      validRecipe({
        fps: 24,
        durationSeconds: 1 / 24,
        resolution: { width: 320, height: 180, label: "Focused" },
        camera: pose([1, 2, 3], [0, 0, 0]),
        cameraKeyframes: [],
        cameraPath: cameraPathV2({
          nodes: [],
          segments: [],
          timeline: { durationSeconds: 0 },
        }),
      }),
    );

    assert.equal(recipe.cameraPath, null);
    assert.equal(recipe.cameraTimeline, null);
    assert.deepEqual(recipe.cameraKeyframes, []);
    assert.equal(recipe.fps, 24);
    assert.equal(validateCaptureRecipe(recipe).valid, true);

    const renderScene = fakeSceneHandle();
    const sequence = await exportDeterministicFrameSequence({
      sceneHandle: renderScene,
      recipe,
    });
    assert.equal(sequence.totalFrames, 1);
    assert.deepEqual(
      renderScene.calls.find((call) => call[0] === "renderCaptureFrame")?.[1],
      { timeSeconds: 0, frameIndex: 0 },
    );
    sequence.cleanup();

    const stillScene = fakeSceneHandle();
    const still = await exportDeterministicStill({
      sceneHandle: stillScene,
      recipe,
      frameIndex: 0,
    });
    assert.equal(still.width, 320);
    assert.equal(still.height, 180);
    assert.deepEqual(
      stillScene.calls.find((call) => call[0] === "renderCaptureFrame")?.[1],
      { timeSeconds: 0, frameIndex: 0 },
    );
    still.cleanup();
  } finally {
    urlStub.restore();
    restoreDocument();
  }
});

test("capture page-range helper validates ordered visible page ranges", async () => {
  const {
    visibleCapturePages,
    resolveCapturePageRange,
  } = await importBundled("src/capture/capturePageRange.ts");
  const pages = [
    {
      id: "page-a",
      title: "A",
      transition: { duration: 1000, easing: "linear" },
      holdDuration: 2000,
    },
    {
      id: "page-hidden",
      title: "Hidden",
      hidden: true,
      transition: { duration: 1000, easing: "linear" },
      holdDuration: 2000,
    },
    {
      id: "page-b",
      title: "B",
      transition: { duration: 500, easing: "easeInOutCubic" },
      holdDuration: 1500,
    },
    {
      id: "page-c",
      title: "C",
      transition: { duration: 250, easing: "easeOutQuart" },
      holdDuration: 1000,
    },
  ];

  assert.deepEqual(
    visibleCapturePages(pages).map((page) => page.id),
    ["page-a", "page-b", "page-c"],
  );

  const authored = resolveCapturePageRange({
    pages,
    currentPageId: "page-a",
    captureScope: "page-range",
    pageRangeStartId: "page-a",
    pageRangeEndId: "page-c",
    pageRangeTiming: "authored",
    equalHoldSeconds: 2,
    fps: 30,
    currentPageDurationSeconds: 4,
  });
  assert.equal(authored.valid, true);
  assert.deepEqual(authored.pageIds, ["page-a", "page-b", "page-c"]);
  assert.equal(authored.durationSeconds, 5.25);
  assert.equal(authored.totalFrames, 158);

  const equalHolds = resolveCapturePageRange({
    pages,
    currentPageId: "page-a",
    captureScope: "page-range",
    pageRangeStartId: "page-a",
    pageRangeEndId: "page-c",
    pageRangeTiming: "equal-holds",
    equalHoldSeconds: 1.5,
    fps: 60,
    currentPageDurationSeconds: 4,
  });
  assert.equal(equalHolds.durationSeconds, 4.5);
  assert.equal(equalHolds.totalFrames, 270);

  const reversed = resolveCapturePageRange({
    pages,
    currentPageId: "page-a",
    captureScope: "page-range",
    pageRangeStartId: "page-c",
    pageRangeEndId: "page-a",
    pageRangeTiming: "authored",
    equalHoldSeconds: 2,
    fps: 30,
    currentPageDurationSeconds: 4,
  });
  assert.equal(reversed.valid, false);
  assert.match(reversed.errors.join("\n"), /before or equal/);
});

test("Screen Capture save options validate type and quality", async () => {
  const {
    captureStillExtension,
    captureStillMimeType,
    normalizeCaptureStillQuality,
    validateCaptureStillSaveOptions,
  } = await importBundled("src/capture/screenCaptureSaveOptions.ts");

  assert.equal(captureStillMimeType("png"), "image/png");
  assert.equal(captureStillMimeType("webp"), "image/webp");
  assert.equal(captureStillMimeType("jpeg"), "image/jpeg");
  assert.equal(captureStillExtension("jpeg"), "jpg");
  assert.equal(normalizeCaptureStillQuality("png", 0.2), undefined);
  assert.equal(normalizeCaptureStillQuality("webp", 2), 1);
  assert.equal(normalizeCaptureStillQuality("jpeg", -1), 0.01);
  assert.equal(
    validateCaptureStillSaveOptions({ type: "webp", quality: 0.8 }).valid,
    true,
  );
  assert.match(
    validateCaptureStillSaveOptions({ type: "tiff", quality: 0.8 }).errors.join("\n"),
    /type/,
  );
  assert.match(
    validateCaptureStillSaveOptions({ type: "jpeg", quality: 2 }).errors.join("\n"),
    /quality/,
  );
});

test("external still render job schema roundtrips exact 8K tile state", async () => {
  const {
    createExternalStillRenderJob,
    parseExternalStillRenderJobJson,
    serializeExternalStillRenderJob,
    validateExternalStillRenderJob,
  } = await importBundled("src/capture/externalStillRenderJob.ts");

  const recipe = validRecipe({
    resolution: { width: 7680, height: 4320, label: "8K" },
    mode: "scene-annotations",
  });
  const job = createExternalStillRenderJob({
    appUrl: "http://127.0.0.1:5173/?project=runtime-test",
    recipe,
    stillOptions: { type: "webp", quality: 0.8 },
    failureReason: "browser cap",
    createdAt: "2026-06-06T00:00:00.000Z",
  });

  assert.equal(job.schema, "CaptureStillRenderJobV1");
  assert.equal(job.version, 1);
  assert.equal(job.projectSlug, "runtime-test");
  assert.equal(job.app.projectSlug, "runtime-test");
  assert.equal(job.still.width, 7680);
  assert.equal(job.still.height, 4320);
  assert.equal(job.still.type, "webp");
  assert.equal(job.still.quality, 0.8);
  assert.equal(job.tile.width, 1920);
  assert.equal(job.tile.height, 1080);
  assert.equal(job.tile.overlapPixels, 0);
  assert.equal(job.fidelity, "max-detail-render");
  assert.equal(validateExternalStillRenderJob(job).valid, true);

  const parsed = parseExternalStillRenderJobJson(serializeExternalStillRenderJob(job));
  assert.equal(parsed.validation.valid, true, parsed.validation.errors.join("\n"));
  assert.equal(parsed.job.still.width, 7680);
  assert.equal(parsed.job.recipe.mode, "scene-annotations");

  const invalid = validateExternalStillRenderJob({
    ...job,
    recipe: { ...job.recipe, mode: "full-ui" },
    still: { ...job.still, type: "gif", width: 0 },
    tile: { ...job.tile, overlapPixels: 4 },
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /full-ui/);
  assert.match(invalid.errors.join("\n"), /type/);
  assert.match(invalid.errors.join("\n"), /width/);
  assert.match(invalid.errors.join("\n"), /overlapPixels/);
});

test("external still CLI synthetic job writes exact output and diagnostics", async () => {
  const dir = await mkdtemp(join(tmpdir(), "geosee-external-still-cli-"));
  const jobPath = join(dir, "job.json");
  const outPath = join(dir, "out.png");
  try {
    const {
      createExternalStillRenderJob,
      serializeExternalStillRenderJob,
    } = await importBundled("src/capture/externalStillRenderJob.ts");
    const job = createExternalStillRenderJob({
      appUrl: "http://127.0.0.1:5173/?project=runtime-test",
      recipe: validRecipe({
        resolution: { width: 640, height: 360, label: "Test" },
        mode: "scene-only",
      }),
      stillOptions: { type: "png" },
      failureReason: "runtime synthetic test",
      createdAt: "2026-06-06T00:00:00.000Z",
    });
    const smallJob = {
      ...job,
      still: { ...job.still, width: 640, height: 360, filename: "out.png" },
      tile: { width: 320, height: 180, overlapPixels: 0 },
    };
    await writeFile(jobPath, serializeExternalStillRenderJob(smallJob), "utf8");

    const { stdout } = await execFileAsync(
      "node",
      [
        join(repoRoot, "tools", "render-capture-still-job.mjs"),
        "--job",
        jobPath,
        "--out",
        outPath,
        "--synthetic",
      ],
      { cwd: repoRoot, timeout: 120_000 },
    );
    const diagnostics = JSON.parse(stdout);
    assert.equal(diagnostics.status, "pass");
    assert.equal(diagnostics.finalOutput.width, 640);
    assert.equal(diagnostics.finalOutput.height, 360);
    assert.equal(diagnostics.tilePlan.grid.tileCount, 4);
    assert.ok(existsSync(outPath), "synthetic output image should exist");
    assert.ok(
      existsSync(`${outPath}.capture-diagnostics.json`),
      "synthetic diagnostics file should exist",
    );
    const file = await readFile(outPath);
    assert.ok(file.byteLength > 0, "synthetic output image should be non-empty");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("external still render jobs serialize requested 8K output for out-of-browser fallback", async () => {
  const {
    createExternalStillRenderJob,
    externalStillRenderJobFilename,
  } = await importBundled("src/capture/externalStillRenderJob.ts");
  const recipe = validRecipe({
    resolution: { width: 7680, height: 4320, label: "8K" },
    qualityPreset: "render-8k",
  });
  const job = createExternalStillRenderJob({
    recipe,
    stillOptions: { type: "webp", quality: 0.82 },
    failureReason: "8K exceeds browser limit",
  });

  assert.equal(job.version, 1);
  assert.equal(job.schema, "CaptureStillRenderJobV1");
  assert.equal(job.recipe.resolution.width, 7680);
  assert.equal(job.still.type, "webp");
  assert.equal(job.still.quality, 0.82);
  assert.equal(job.fidelity, "max-detail-render");
  assert.equal(job.tile.overlapPixels, 0);
  assert.match(job.failureReason, /browser limit/);
  assert.match(
    externalStillRenderJobFilename(job),
    /^runtime-test-page-a-8k-external-still-\d{8}T\d{6}Z\.json$/,
  );
});

test("deterministic exporter frame math and keyframe interpolation are fixed-time", async () => {
  const {
    getCaptureFrameCount,
    interpolateCaptureCameraKeyframes,
    sampleCaptureRecipeCameraPoseAtFrame,
  } = await importBundled("src/capture/deterministicFrameSequenceExporter.ts");
  const recipe = validRecipe({
    fps: 60,
    durationSeconds: 1.01,
    cameraKeyframes: [
      { timeSeconds: 0, camera: pose([0, 0, 0]) },
      { timeSeconds: 1, camera: pose([60, 0, 0]) },
    ],
  });

  assert.equal(getCaptureFrameCount(recipe), 61);
  assert.deepEqual(
    interpolateCaptureCameraKeyframes(recipe, 0.5).position,
    [30, 0, 0],
  );

  const v2Recipe = validRecipe({
    fps: 30,
    durationSeconds: 2,
    cameraPath: cameraPathV2(),
  });
  assert.deepEqual(
    sampleCaptureRecipeCameraPoseAtFrame(v2Recipe, 30).position,
    [30, 0, 0],
  );
});

test("deterministic exporter samples enabled v2 camera path playback only", async () => {
  const {
    getCaptureFrameCount,
    sampleCaptureRecipeCameraPoseAtFrame,
  } = await importBundled("src/capture/deterministicFrameSequenceExporter.ts");
  const {
    captureCameraPathV2EnabledNodes,
    captureCameraPathV2EnabledSegments,
    cameraPathV2SampledPoints,
    resolveCaptureCameraPathV2Timeline,
    sampleCaptureCameraPathV2,
  } = await importBundled("src/capture/captureCameraPathV2.ts");
  const path = cameraPathV2({
    nodes: [
      {
        ...cameraPathV2().nodes[0],
        id: "start",
        position: [0, 0, 0],
        target: [0, 0, 0],
      },
      {
        ...cameraPathV2().nodes[1],
        id: "disabled-node",
        enabled: false,
        position: [90, 0, 0],
        target: [9, 0, 0],
      },
      {
        ...cameraPathV2().nodes[1],
        id: "hidden-middle",
        hidden: true,
        position: [30, 0, 0],
        target: [3, 0, 0],
      },
      {
        ...cameraPathV2().nodes[1],
        id: "end",
        position: [60, 0, 0],
        target: [6, 0, 0],
      },
    ],
    segments: [
      {
        id: "start-disabled",
        fromNodeId: "start",
        toNodeId: "disabled-node",
        transitionSeconds: 4,
      },
      {
        id: "disabled-hidden",
        fromNodeId: "disabled-node",
        toNodeId: "hidden-middle",
        transitionSeconds: 4,
      },
      {
        id: "start-hidden-disabled",
        fromNodeId: "start",
        toNodeId: "hidden-middle",
        enabled: false,
        transitionSeconds: 4,
      },
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
  });
  const recipe = validRecipe({
    fps: 30,
    durationSeconds: 4,
    cameraPath: path,
  });

  assert.deepEqual(
    captureCameraPathV2EnabledNodes(path).map((node) => [node.id, node.hidden]),
    [
      ["start", false],
      ["hidden-middle", true],
      ["end", false],
    ],
  );
  assert.deepEqual(
    captureCameraPathV2EnabledSegments(path).map((segment) => segment.id),
    ["start-hidden", "hidden-end"],
  );
  assert.deepEqual(resolveCaptureCameraPathV2Timeline(path).activeNodeIds, [
    "start",
    "hidden-middle",
    "end",
  ]);
  assert.deepEqual(sampleCaptureCameraPathV2(path, 2).position, [30, 0, 0]);
  assert.ok(
    cameraPathV2SampledPoints(path, 5).some(
      (point) => point[0] === 30 && point[1] === 0 && point[2] === 0,
    ),
    "hidden active nodes should remain sampled for path geometry",
  );
  assert.equal(getCaptureFrameCount(recipe), 120);
  assert.deepEqual(sampleCaptureRecipeCameraPoseAtFrame(recipe, 60).position, [
    30,
    0,
    0,
  ]);
  assert.deepEqual(sampleCaptureRecipeCameraPoseAtFrame(recipe, 90).position, [
    45,
    0,
    0,
  ]);
});

test("Capture Camera Path v2 focus binding stays recipe-local and drives locked samples", async () => {
  const {
    bindCaptureCameraPathV2FocusPoint,
    moveCaptureCameraPathV2NodeTarget,
    sampleCaptureCameraPathV2,
    validateCaptureCameraPathV2,
  } = await importBundled("src/capture/captureCameraPathV2.ts");
  const focused = bindCaptureCameraPathV2FocusPoint(
    cameraPathV2(),
    "end",
    {
      id: "focus-end",
      label: "End Focus",
      position: [12, 3, 4],
      picked: true,
    },
  );

  assert.deepEqual(focused.focusPoints, [
    {
      id: "focus-end",
      label: "End Focus",
      position: [12, 3, 4],
      picked: true,
    },
  ]);
  const focusedNode = focused.nodes.find((node) => node.id === "end");
  assert.equal(focusedNode?.lookMode, "focus-point-lock");
  assert.equal(focusedNode?.focusPointId, "focus-end");
  assert.equal(focusedNode?.enabled, true);
  assert.equal(focusedNode?.hidden, false);
  assert.equal(focusedNode?.timeSeconds, 2);
  assert.deepEqual(sampleCaptureCameraPathV2(focused, 2).target, [12, 3, 4]);
  assert.equal(validateCaptureCameraPathV2(focused).valid, true);

  const movedTarget = moveCaptureCameraPathV2NodeTarget(focused, "end", [
    20,
    4,
    8,
  ]);
  assert.deepEqual(
    movedTarget.focusPoints.find((point) => point.id === "focus-end")?.position,
    [20, 4, 8],
  );
  assert.equal(
    movedTarget.nodes.find((node) => node.id === "end")?.focusPointId,
    "focus-end",
  );
  assert.deepEqual(sampleCaptureCameraPathV2(movedTarget, 2).target, [20, 4, 8]);
});

test("Capture Camera Path timeline layout helper preserves drag-duration blocks", async () => {
  const { resolveCaptureCameraPathV2Timeline } = await importBundled(
    "src/capture/captureCameraPathV2.ts",
  );
  const { layoutCapturePathTimeline } = await importBundled(
    "src/capture/cameraPathTimelineLayout.ts",
  );
  const timeline = resolveCaptureCameraPathV2Timeline(
    cameraPathV2({
      nodes: [
        { ...cameraPathV2().nodes[0], id: "start", holdSecondsAfter: 1 },
        { ...cameraPathV2().nodes[1], id: "end", holdSecondsAfter: 2 },
      ],
      segments: [
        {
          id: "start:end",
          fromNodeId: "start",
          toNodeId: "end",
          transitionSeconds: 3,
        },
      ],
    }),
  );
  const blocks = layoutCapturePathTimeline({
    timeline,
    minBlockPercent: 0.8,
  });

  assert.equal(timeline.durationSeconds, 6);
  assert.deepEqual(
    blocks.map((block) => [
      block.id,
      block.kind,
      block.startSeconds,
      block.durationSeconds,
      block.nodeId ?? block.segmentId,
    ]),
    [
      ["hold:start", "hold", 0, 1, "start"],
      ["transition:start:end", "transition", 1, 3, "start:end"],
      ["hold:end", "hold", 4, 2, "end"],
    ],
  );
  assert.ok(Math.abs(blocks[0].leftPercent - 0) < 0.000_001);
  assert.ok(Math.abs(blocks[0].widthPercent - 100 / 6) < 0.000_001);
  assert.ok(Math.abs(blocks[1].leftPercent - 100 / 6) < 0.000_001);
  assert.ok(Math.abs(blocks[1].widthPercent - 50) < 0.000_001);
  assert.ok(Math.abs(blocks[2].leftPercent - (400 / 6)) < 0.000_001);
  assert.ok(Math.abs(blocks[2].widthPercent - (200 / 6)) < 0.000_001);
});

test("Capture Camera Path timeline layout exposes V3 surfacing metadata", async () => {
  const { layoutCapturePathTimeline } = await importBundled(
    "src/capture/cameraPathTimelineLayout.ts",
  );
  const blocks = layoutCapturePathTimeline({
    timeline: {
      durationSeconds: 10,
      activeNodeIds: ["start", "end"],
      activeSegmentIds: ["start:end"],
      nodeTimeSeconds: { start: 0, end: 10 },
      entries: [
        {
          kind: "transition",
          startSeconds: 2,
          endSeconds: 8,
          durationSeconds: 6,
          segmentId: "start:end",
          fromNodeId: "start",
          toNodeId: "end",
          easing: "ease-in-out",
          timeCurve: {
            mode: "custom-ramp",
            ramp: [
              { t: 0, value: 0 },
              { t: 0.5, value: 0.72 },
              { t: 1, value: 1 },
            ],
          },
          continuity: "G2",
          gdStartPercent: 25,
          gdEndPercent: 75,
          focusMode: "focus-point-lock",
          equationVisible: true,
        },
      ],
    },
  });

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].timeCurve.mode, "custom-ramp");
  assert.deepEqual(blocks[0].timeCurve.ramp?.map((point) => point.value), [
    0,
    0.72,
    1,
  ]);
  assert.equal(blocks[0].continuity, "G2");
  assert.equal(blocks[0].gdStartPercent, 25);
  assert.equal(blocks[0].gdEndPercent, 75);
  assert.equal(blocks[0].focusMode, "focus-point-lock");
  assert.equal(blocks[0].equationVisible, true);

  const fallback = layoutCapturePathTimeline({
    timeline: {
      durationSeconds: 4,
      activeNodeIds: [],
      activeSegmentIds: [],
      nodeTimeSeconds: {},
      entries: [
        {
          kind: "transition",
          startSeconds: 0,
          endSeconds: 4,
          durationSeconds: 4,
          segmentId: "fallback",
          easing: "linear",
        },
      ],
    },
  })[0];

  assert.equal(fallback.timeCurve.mode, "linear");
  assert.equal(fallback.continuity, "G1");
  assert.equal(fallback.gdStartPercent, 0);
  assert.equal(fallback.gdEndPercent, 100);
  assert.equal(fallback.focusMode, "free-direction");
  assert.equal(fallback.equationVisible, false);
});

test("Capture timeline page clips preserve presentation timing and stay independent from camera path", async () => {
  const {
    createPageClipFromPresentationPage,
    createPageClipsFromRange,
    normalizeCaptureTimelineState,
    resizeCaptureTimelineBoundary,
    sampleCaptureTimeline,
    validateCaptureTimelineState,
  } = await importBundled("src/capture/captureTimeline.ts");
  const { normalizeCaptureCameraPathV3 } = await importBundled(
    "src/capture/captureCameraPathV3.ts",
  );

  const pages = [
    {
      id: "phase3-site",
      title: "Phase 3 Site",
      camera: {
        position: [0, 0, 10],
        target: [0, 0, 0],
        up: [0, 1, 0],
        fov: 50,
      },
      transition: { duration: 1200, easing: "ease-in-out" },
      holdDuration: 2800,
    },
    {
      id: "phase3-mt",
      title: "Phase 3 MT",
      camera: {
        position: [10, 0, 10],
        target: [5, 0, 0],
        up: [0, 1, 0],
        fov: 45,
      },
      transition: { duration: 600, easing: "linear" },
      holdDuration: 2400,
    },
    {
      id: "hidden",
      title: "Hidden",
      hidden: true,
      transition: { duration: 200 },
      holdDuration: 1000,
    },
  ];

  const firstClip = createPageClipFromPresentationPage(pages[0], {
    startSeconds: 0,
  });
  assert.equal(firstClip.pageId, "phase3-site");
  assert.equal(firstClip.label, "Phase 3 Site");
  assert.equal(firstClip.transitionSeconds, 1.2);
  assert.equal(firstClip.holdSeconds, 2.8);
  assert.equal(firstClip.transitionEasing, "ease-in-out");

  const range = createPageClipsFromRange(pages, "phase3-site", "phase3-mt", {
    timing: "authored",
  });
  assert.deepEqual(
    range.map((clip) => [clip.pageId, clip.startSeconds, clip.transitionSeconds, clip.holdSeconds]),
    [
      ["phase3-site", 0, 1.2, 2.8],
      ["phase3-mt", 4, 0.6, 2.4],
    ],
  );

  const state = normalizeCaptureTimelineState({
    version: 1,
    pageClips: range,
    selectedPageClipId: range[0].id,
    diagnosticsVisible: true,
  });
  assert.equal(validateCaptureTimelineState(state, pages).valid, true);

  const cameraPath = normalizeCaptureCameraPathV3({
    version: 3,
    id: "camera-spine",
    name: "Camera Spine",
    loop: false,
    timeline: { durationSeconds: 6 },
    nodes: [
      {
        id: "cam-a",
        kind: "keyframe",
        enabled: true,
        hidden: false,
        timeSeconds: 0,
        position: [0, 0, 20],
        target: [0, 0, 0],
        up: [0, 1, 0],
        fov: 50,
        holdSecondsAfter: 0,
        aimGeometry: { mode: "free-direction", lensMode: "fixed-fov" },
      },
      {
        id: "cam-b",
        kind: "keyframe",
        enabled: true,
        hidden: false,
        timeSeconds: 6,
        position: [6, 0, 20],
        target: [6, 0, 0],
        up: [0, 1, 0],
        fov: 50,
        holdSecondsAfter: 0,
        aimGeometry: { mode: "free-direction", lensMode: "fixed-fov" },
      },
    ],
    segments: [
      {
        id: "cam-a:cam-b",
        fromNodeId: "cam-a",
        toNodeId: "cam-b",
        enabled: true,
        hidden: false,
        transitionSeconds: 6,
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
  });

  const sample = sampleCaptureTimeline({
    state,
    pages,
    cameraPath,
    currentPage: pages[0],
    currentCamera: pages[0].camera,
    timeSeconds: 4.5,
  });
  assert.equal(sample.page.pageId, "phase3-mt");
  assert.equal(sample.page.transitionEasing, "linear");
  assert.equal(sample.camera.source, "camera-path");
  assert.notDeepEqual(sample.camera.pose.position, pages[1].camera.position);

  const resized = resizeCaptureTimelineBoundary({
    state,
    boundaryId: `page:${range[0].id}:${range[1].id}`,
    deltaSeconds: 1,
  });
  const beforeDurations = state.pageClips.map(
    (clip) => clip.transitionSeconds + clip.holdSeconds,
  );
  const afterDurations = resized.pageClips.map(
    (clip) => clip.transitionSeconds + clip.holdSeconds,
  );
  assert.deepEqual(afterDurations, [beforeDurations[0] + 1, beforeDurations[1] - 1]);
  assert.equal(
    afterDurations.reduce((total, duration) => total + duration, 0),
    beforeDurations.reduce((total, duration) => total + duration, 0),
  );

  const disabled = normalizeCaptureTimelineState({
    ...state,
    pageClips: state.pageClips.map((clip, index) =>
      index === 0 ? { ...clip, enabled: false } : clip,
    ),
  });
  assert.equal(
    sampleCaptureTimeline({
      state: disabled,
      pages,
      cameraPath: null,
      currentPage: pages[0],
      currentCamera: pages[0].camera,
      timeSeconds: 0.5,
    }).page.pageId,
    "phase3-mt",
  );
});

test("Capture timeline page clip replacement preserves timing", async () => {
  const {
    createPageClipFromPresentationPage,
    normalizeCaptureTimelineState,
    replaceCaptureTimelinePageClipPage,
  } = await importBundled("src/capture/captureTimeline.ts");

  const pages = [
    { id: "page-a", title: "Page A", transition: { duration: 600 }, holdDuration: 2400 },
    { id: "page-b", title: "Page B", transition: { duration: 300 }, holdDuration: 1700 },
    { id: "page-c", title: "Page C", transition: { duration: 900 }, holdDuration: 3100 },
  ];
  const clip = createPageClipFromPresentationPage(pages[0], { id: "clip-a" });
  const state = normalizeCaptureTimelineState({
    version: 1,
    pageClips: [clip],
    selectedPageClipId: clip.id,
  });

  const replaced = replaceCaptureTimelinePageClipPage({
    state,
    clipId: clip.id,
    page: pages[2],
  });

  assert.equal(replaced.pageClips[0].pageId, "page-c");
  assert.equal(replaced.pageClips[0].label, "Page C");
  assert.equal(replaced.pageClips[0].transitionSeconds, clip.transitionSeconds);
  assert.equal(replaced.pageClips[0].holdSeconds, clip.holdSeconds);
  assert.equal(replaced.selectedPageClipId, clip.id);
});

test("Capture timeline frame edits stay local and clamp to neighboring page clips", async () => {
  const {
    captureTimelineClipFrameBounds,
    editCaptureTimelinePageClipFrames,
    normalizeCaptureTimelineState,
    removeCaptureTimelinePageClip,
  } = await importBundled("src/capture/captureTimeline.ts");

  const state = normalizeCaptureTimelineState({
    version: 1,
    selectedPageClipId: "clip-b",
    pageClips: [
      {
        id: "clip-a",
        pageId: "page-a",
        label: "Page A",
        enabled: true,
        locked: false,
        transitionSeconds: 0,
        holdSeconds: 1,
      },
      {
        id: "clip-b",
        pageId: "page-b",
        label: "Page B",
        enabled: true,
        locked: false,
        transitionSeconds: 0,
        holdSeconds: 1,
      },
      {
        id: "clip-c",
        pageId: "page-c",
        label: "Page C",
        enabled: true,
        locked: false,
        transitionSeconds: 0,
        holdSeconds: 1,
      },
    ],
  });

  const startEdited = editCaptureTimelinePageClipFrames({
    state,
    clipId: "clip-b",
    fps: 60,
    startFrame: 30,
  });
  assert.deepEqual(
    startEdited.pageClips.map((clip) => Math.round((clip.transitionSeconds + clip.holdSeconds) * 60)),
    [30, 90, 60],
  );

  const endEdited = editCaptureTimelinePageClipFrames({
    state,
    clipId: "clip-b",
    fps: 60,
    endFrame: 149,
  });
  assert.deepEqual(
    endEdited.pageClips.map((clip) => Math.round((clip.transitionSeconds + clip.holdSeconds) * 60)),
    [60, 90, 30],
  );

  const durationEdited = editCaptureTimelinePageClipFrames({
    state,
    clipId: "clip-b",
    fps: 60,
    durationFrames: 90,
  });
  assert.deepEqual(
    durationEdited.pageClips.map((clip) => Math.round((clip.transitionSeconds + clip.holdSeconds) * 60)),
    [60, 90, 30],
  );
  assert.deepEqual(captureTimelineClipFrameBounds(durationEdited.pageClips[1], 60), {
    startFrame: 60,
    endFrame: 149,
    durationFrames: 90,
  });

  const removed = removeCaptureTimelinePageClip({ state, clipId: "clip-b" });
  assert.deepEqual(
    removed.pageClips.map((clip) => [clip.id, Math.round(clip.startSeconds * 60)]),
    [
      ["clip-a", 0],
      ["clip-c", 60],
    ],
  );
  assert.equal(removed.selectedPageClipId, null);
});

test("Capture Director toolbar keeps timeline layout blocks when lower helper exists", async () => {
  const toolbarSource = await readFile(
    join(repoRoot, "src/capture/CaptureDirectorToolbar.tsx"),
    "utf8",
  );
  const timelineSource = await readFile(
    join(repoRoot, "src/capture/CameraPathTimeline.tsx"),
    "utf8",
  );
  const helperIndex = toolbarSource.indexOf(
    "<CameraPathTimeline",
  );
  assert.notEqual(helperIndex, -1, "lower timeline helper should exist");
  assert.match(
    timelineSource,
    /const rootStyle: CSSProperties = \{[\s\S]*display:\s*"grid"/,
    "timeline helper should keep controls and lanes in grid blocks",
  );
  for (const laneTestId of [
    "capture-timeline-keyframe-track",
    "capture-timeline-position-lane",
    "capture-timeline-look-lane",
    "capture-timeline-focus-lane",
  ]) {
    const laneIndex = timelineSource.indexOf(`data-testid="${laneTestId}"`);
    assert.ok(
      laneIndex >= 0,
      `${laneTestId} should stay inside the lower timeline helper layout`,
    );
  }
});

class FakeVector {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

function installRecorderUrlStub() {
  const created = [];
  const previousCreate = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    const url = `blob:recorder-${created.length}`;
    created.push({ url, blob });
    return url;
  };
  return {
    created,
    restore() {
      URL.createObjectURL = previousCreate;
    },
  };
}

function installMediaRecorderStub({
  chunks = [new Blob(["recording"], { type: "video/webm" })],
} = {}) {
  const previous = globalThis.MediaRecorder;
  const calls = [];
  class FakeMediaRecorder extends EventTarget {
    static isTypeSupported() {
      return true;
    }

    constructor(_stream, options = {}) {
      super();
      this.state = "inactive";
      this.mimeType = options.mimeType ?? "video/webm";
      calls.push(["constructor", this.mimeType]);
    }

    start() {
      this.state = "recording";
      calls.push(["start"]);
    }

    requestData() {
      calls.push(["requestData"]);
      this.#emitChunk();
    }

    stop() {
      calls.push(["stop"]);
      if (this.state === "inactive") return;
      this.state = "inactive";
      queueMicrotask(() => {
        this.dispatchEvent(new Event("stop"));
      });
    }

    #emitChunk() {
      const index = calls.filter((call) => call[0] === "dataavailable").length;
      const data = chunks[Math.min(index, chunks.length - 1)] ?? new Blob([]);
      calls.push(["dataavailable", data.size]);
      const event = new Event("dataavailable");
      Object.defineProperty(event, "data", { value: data });
      this.dispatchEvent(event);
    }
  }
  globalThis.MediaRecorder = FakeMediaRecorder;
  return {
    calls,
    restore() {
      globalThis.MediaRecorder = previous;
    },
  };
}

function fakeCaptureTrack() {
  const calls = [];
  return {
    calls,
    track: {
      requestFrame() {
        calls.push("requestFrame");
      },
      stop() {
        calls.push("stop");
      },
    },
  };
}

test("preview recorder rejects zero-byte realtime output and creates no download URL", async () => {
  const recorderStub = installMediaRecorderStub({ chunks: [new Blob([])] });
  const urlStub = installRecorderUrlStub();
  try {
    const { createCanvasPreviewRecorder } = await importBundled(
      "src/capture/canvasPreviewRecorder.ts",
    );
    const { track } = fakeCaptureTrack();
    const canvas = {
      captureStream() {
        return {
          getTracks: () => [track],
          getVideoTracks: () => [track],
        };
      },
    };

    const recorder = createCanvasPreviewRecorder({
      canvas,
      fps: 60,
      mimeType: "video/webm",
      outputContext: {
        width: 3840,
        height: 2160,
        fps: 60,
      },
    });

    await assert.rejects(
      () => recorder.stop(),
      /No video data was produced for 3840x2160 at 60 FPS/,
    );
    assert.equal(urlStub.created.length, 0);
    assert.ok(
      recorderStub.calls.some((call) => call[0] === "requestData"),
      "recorder should request pending data before stop",
    );
  } finally {
    urlStub.restore();
    recorderStub.restore();
  }
});

test("preview recorder requests direct canvas frames and reports byte length", async () => {
  const recorderStub = installMediaRecorderStub();
  const urlStub = installRecorderUrlStub();
  try {
    const { createCanvasPreviewRecorder } = await importBundled(
      "src/capture/canvasPreviewRecorder.ts",
    );
    const { track, calls } = fakeCaptureTrack();
    let afterRender = null;
    let unsubscribed = false;
    const canvas = {
      captureStream() {
        return {
          getTracks: () => [track],
          getVideoTracks: () => [track],
        };
      },
    };

    const recorder = createCanvasPreviewRecorder({
      canvas,
      fps: 30,
      mimeType: "video/webm",
      onAfterRender(callback) {
        afterRender = callback;
        return () => {
          unsubscribed = true;
        };
      },
    });

    assert.deepEqual(calls, ["requestFrame"]);
    afterRender();
    assert.deepEqual(calls, ["requestFrame", "requestFrame"]);

    const result = await recorder.stop();
    assert.equal(result.byteLength, "recording".length);
    assert.equal(unsubscribed, true);
    assert.ok(
      recorderStub.calls.findIndex((call) => call[0] === "requestData") <
        recorderStub.calls.findIndex((call) => call[0] === "stop"),
      "requestData should run before stop",
    );
  } finally {
    urlStub.restore();
    recorderStub.restore();
  }
});

class FakeCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.dataset = {};
    this.contextCalls = [];
    this.captureTrackCalls = [];
  }

  getContext() {
    const contextCalls = this.contextCalls;
    return {
      clearRect() {
        contextCalls.push(["clearRect"]);
      },
      drawImage() {
        contextCalls.push(["drawImage"]);
      },
      fill() {
        contextCalls.push(["fill"]);
      },
      stroke() {
        contextCalls.push(["stroke"]);
      },
      beginPath() {
        contextCalls.push(["beginPath"]);
      },
      moveTo() {
        contextCalls.push(["moveTo"]);
      },
      lineTo() {
        contextCalls.push(["lineTo"]);
      },
      quadraticCurveTo() {
        contextCalls.push(["quadraticCurveTo"]);
      },
      closePath() {
        contextCalls.push(["closePath"]);
      },
      fillText(text) {
        contextCalls.push(["fillText", text]);
      },
      arc() {
        contextCalls.push(["arc"]);
      },
      save() {
        contextCalls.push(["save"]);
      },
      restore() {
        contextCalls.push(["restore"]);
      },
      set fillStyle(_value) {},
      set strokeStyle(_value) {},
      set lineWidth(_value) {},
      set textBaseline(_value) {},
      set textAlign(_value) {},
      set font(_value) {},
    };
  }

  toBlob(callback, mimeType) {
    callback(new Blob(["frame"], { type: mimeType }));
  }

  captureStream() {
    const captureTrackCalls = this.captureTrackCalls;
    const track = {
      requestFrame() {
        captureTrackCalls.push("requestFrame");
      },
      stop() {
        captureTrackCalls.push("stop");
      },
    };
    return {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    };
  }
}

function installDocumentStub() {
  const previousDocument = globalThis.document;
  const createdCanvases = [];
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      const canvas = new FakeCanvas();
      createdCanvases.push(canvas);
      return canvas;
    },
  };
  const restore = () => {
    globalThis.document = previousDocument;
  };
  restore.createdCanvases = createdCanvases;
  return restore;
}

function installUrlStub() {
  const created = [];
  const revoked = [];
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => {
    const url = `blob:runtime-${created.length}`;
    created.push({ url, blob });
    return url;
  };
  URL.revokeObjectURL = (url) => {
    revoked.push(url);
  };
  return {
    created,
    revoked,
    restore() {
      URL.createObjectURL = previousCreate;
      URL.revokeObjectURL = previousRevoke;
    },
  };
}

function fakeSceneHandle({ throwOnRestoreStyle = false, maxTextureSize = 16384 } = {}) {
  const calls = [];
  let afterRender = null;
  const styles = new Map([
    ["a", { opacity: 0.3 }],
    ["b", { opacity: 0.7 }],
  ]);
  const manager = {
    currentVisibleLayerIds: new Set(["virtual", "a"]),
    layers: new Map([
      ["a", { visible: true }],
      ["b", { visible: false }],
    ]),
    styleForLayer(id) {
      return styles.get(id);
    },
    setVisible(nextVisible) {
      this.currentVisibleLayerIds = new Set(nextVisible);
      calls.push(["setVisible", [...nextVisible].sort()]);
    },
    applyStyle(id, style) {
      calls.push(["applyStyle", id, { ...style }]);
      if (throwOnRestoreStyle && style.opacity === 0.3) {
        throw new Error("restore style failed");
      }
      styles.set(id, { ...style });
    },
  };
  const camera = {
    position: new FakeVector(0, 0, 10),
    up: new FakeVector(0, 0, 1),
    fov: 50,
    updateProjectionMatrix() {
      calls.push(["cameraProjection"]);
    },
  };
  const controls = {
    target: new FakeVector(0, 0, 0),
    update() {
      calls.push(["controlsUpdate"]);
    },
  };
  return {
    calls,
    manager,
    camera,
    controls,
    beginCaptureSize(options) {
      calls.push(["beginCaptureSize", options]);
    },
    endCaptureSize() {
      calls.push(["endCaptureSize"]);
    },
    onAfterRender(callback) {
      afterRender = callback;
      calls.push(["onAfterRender"]);
      return () => calls.push(["unsubscribeAfterRender"]);
    },
    triggerAfterRender() {
      afterRender?.();
    },
    renderCaptureFrame(options) {
      calls.push(["renderCaptureFrame", options]);
      calls.push([
        "renderCameraPose",
        [camera.position.x, camera.position.y, camera.position.z],
        [controls.target.x, controls.target.y, controls.target.z],
        camera.fov,
      ]);
    },
    getCanvas() {
      return new FakeCanvas();
    },
    getCaptureCapabilities() {
      return {
        maxTextureSize,
        maxRenderbufferSize: maxTextureSize,
      };
    },
  };
}

test("composited recorder rejects zero-byte output and cleans stream resources", async () => {
  const restoreDocument = installDocumentStub();
  const recorderStub = installMediaRecorderStub({ chunks: [new Blob([])] });
  const urlStub = installRecorderUrlStub();
  try {
    const { createCompositedCaptureRecorder } = await importBundled(
      "src/capture/compositedCaptureRecorder.ts",
    );
    const sceneHandle = fakeSceneHandle();
    const recorder = createCompositedCaptureRecorder({
      sceneHandle,
      width: 3840,
      height: 2160,
      fps: 60,
      mimeType: "video/webm",
      overlayContext: () => ({
        mode: "scene-annotations",
        width: 3840,
        height: 2160,
        title: "Runtime Overlay",
      }),
      outputContext: {
        mode: "scene-annotations",
        width: 3840,
        height: 2160,
        fps: 60,
      },
    });

    sceneHandle.triggerAfterRender();
    await assert.rejects(
      () => recorder.stop(),
      /No video data was produced for 3840x2160 at 60 FPS/,
    );
    assert.equal(urlStub.created.length, 0);
    assert.ok(
      sceneHandle.calls.some((call) => call[0] === "unsubscribeAfterRender"),
      "after-render callback should be cleaned up",
    );
    assert.ok(
      restoreDocument.createdCanvases[0].captureTrackCalls.includes("stop"),
      "capture stream tracks should be stopped",
    );
    assert.ok(
      recorderStub.calls.some((call) => call[0] === "requestData"),
      "composited recorder should request pending data before stop",
    );
  } finally {
    urlStub.restore();
    recorderStub.restore();
    restoreDocument();
  }
});

test("deterministic exporter writes fixed-timestep frame metadata and overlays", async () => {
  const restoreDocument = installDocumentStub();
  const urlStub = installUrlStub();
  try {
    const { exportDeterministicFrameSequence } = await importBundled(
      "src/capture/deterministicFrameSequenceExporter.ts",
    );
    const sceneHandle = fakeSceneHandle();
    const recipe = validRecipe({
      mode: "scene-annotations",
      durationSeconds: 0.1,
      fps: 30,
      resolution: { width: 640, height: 360, label: "Runtime" },
      layerVisibility: { a: false, b: true },
      layerStyles: { a: { opacity: 0.9 }, b: { opacity: 0.4 } },
    });

    const sequence = await exportDeterministicFrameSequence({
      sceneHandle,
      recipe,
      overlayContext: () => ({ title: "Runtime Overlay" }),
    });

    assert.equal(sequence.totalFrames, 3);
    assert.deepEqual(
      sequence.frames.map((frame) => frame.timeSeconds),
      [0, 1 / 30, 2 / 30],
    );
    assert.deepEqual(sequence.frames.map((frame) => frame.width), [640, 640, 640]);
    assert.deepEqual(sequence.frames.map((frame) => frame.height), [360, 360, 360]);
    assert.deepEqual(
      sceneHandle.calls.filter((call) => call[0] === "beginCaptureSize"),
      [["beginCaptureSize", { width: 640, height: 360, pixelRatio: 1 }]],
    );
    assert.deepEqual(
      sceneHandle.calls
        .filter((call) => call[0] === "renderCaptureFrame")
        .map((call) => call[1]),
      [
        { timeSeconds: 0, frameIndex: 0 },
        { timeSeconds: 1 / 30, frameIndex: 1 },
        { timeSeconds: 2 / 30, frameIndex: 2 },
      ],
    );
    assert.ok(
      restoreDocument.createdCanvases.some((canvas) =>
        canvas.contextCalls.some(
          (call) => call[0] === "fillText" && call[1] === "Runtime Overlay",
        ),
      ),
    );
    assert.equal(urlStub.created.length, 3);

    sequence.cleanup();
    assert.deepEqual(urlStub.revoked, [
      "blob:runtime-0",
      "blob:runtime-1",
      "blob:runtime-2",
    ]);
  } finally {
    restoreDocument();
    urlStub.restore();
  }
});

test("deterministic frame and still exporters sample v2 camera paths from frame index", async () => {
  const restoreDocument = installDocumentStub();
  const urlStub = installUrlStub();
  try {
    const { exportDeterministicFrameSequence } = await importBundled(
      "src/capture/deterministicFrameSequenceExporter.ts",
    );
    const { exportDeterministicStill } = await importBundled(
      "src/capture/deterministicStillExporter.ts",
    );
    const recipe = validRecipe({
      durationSeconds: 3 / 30,
      fps: 30,
      cameraPath: cameraPathV2({
        nodes: [
          {
            id: "start",
            kind: "keyframe",
            position: [0, 0, 0],
            target: [0, 0, 0],
            up: [0, 0, 1],
            fov: 50,
            lookMode: "free-direction",
            holdSecondsAfter: 0,
          },
          {
            id: "end",
            kind: "keyframe",
            position: [60, 0, 0],
            target: [6, 0, 0],
            up: [0, 0, 1],
            fov: 50,
            lookMode: "free-direction",
            holdSecondsAfter: 0,
          },
        ],
        segments: [
          {
            id: "start:end",
            fromNodeId: "start",
            toNodeId: "end",
            transitionSeconds: 2 / 30,
          },
        ],
      }),
    });
    const sequenceSceneHandle = fakeSceneHandle();
    const sequencePositions = [];

    const sequence = await exportDeterministicFrameSequence({
      sceneHandle: sequenceSceneHandle,
      recipe,
      onFrame() {
        sequencePositions.push([
          sequenceSceneHandle.camera.position.x,
          sequenceSceneHandle.camera.position.y,
          sequenceSceneHandle.camera.position.z,
        ]);
      },
    });

    assert.deepEqual(sequencePositions, [
      [0, 0, 0],
      [30, 0, 0],
      [60, 0, 0],
    ]);
    sequence.cleanup();

    const stillSceneHandle = fakeSceneHandle();
    const stillPositions = [];
    stillSceneHandle.renderCaptureFrame = (options) => {
      stillSceneHandle.calls.push(["renderCaptureFrame", options]);
      stillPositions.push([
        stillSceneHandle.camera.position.x,
        stillSceneHandle.camera.position.y,
        stillSceneHandle.camera.position.z,
      ]);
    };

    const still = await exportDeterministicStill({
      sceneHandle: stillSceneHandle,
      recipe,
      frameIndex: 1,
    });

    assert.deepEqual(stillPositions, [[30, 0, 0]]);
    assert.deepEqual(
      stillSceneHandle.calls.find((call) => call[0] === "renderCaptureFrame")?.[1],
      { timeSeconds: 1 / 30, frameIndex: 1 },
    );
    still.cleanup();
  } finally {
    urlStub.restore();
    restoreDocument();
  }
});

test("deterministic exporter restores visibility and revokes partial frame URLs after onFrame failure", async () => {
  const restoreDocument = installDocumentStub();
  const urlStub = installUrlStub();
  try {
    const { exportDeterministicFrameSequence } = await importBundled(
      "src/capture/deterministicFrameSequenceExporter.ts",
    );
    const sceneHandle = fakeSceneHandle();
    const recipe = validRecipe({
      durationSeconds: 0.08,
      fps: 30,
      layerVisibility: { a: false, b: true },
      layerStyles: { a: { opacity: 1 } },
    });

    await assert.rejects(
      () =>
        exportDeterministicFrameSequence({
          sceneHandle,
          recipe,
          onFrame() {
            throw new Error("stop after first frame");
          },
        }),
      /stop after first frame/,
    );

    assert.deepEqual([...sceneHandle.manager.currentVisibleLayerIds].sort(), [
      "a",
      "virtual",
    ]);
    assert.deepEqual(urlStub.created.map((entry) => entry.url), ["blob:runtime-0"]);
    assert.deepEqual(urlStub.revoked, ["blob:runtime-0"]);
    assert.ok(sceneHandle.calls.some((call) => call[0] === "endCaptureSize"));
  } finally {
    urlStub.restore();
    restoreDocument();
  }
});

test("capture job runtime tracks progress, completion, failure, and URL cleanup", async () => {
  const {
    createCaptureJobRecord,
    updateCaptureJobStatus,
    updateCaptureJobProgress,
    completeCaptureJob,
    failCaptureJob,
    cancelCaptureJob,
    clearCaptureJobRecord,
    isCaptureJobRunning,
    canStartCaptureJob,
  } = await importBundled("src/capture/captureJobRuntime.ts");
  const { capturePathJobDiagnostics, captureVideoOutputDiagnostics } =
    await importBundled("src/capture/captureJobDiagnostics.ts");

  const revoked = [];
  const originalUrl = globalThis.URL;
  globalThis.URL = {
    ...originalUrl,
    revokeObjectURL(url) {
      revoked.push(url);
    },
  };
  try {
    const job = createCaptureJobRecord({
      kind: "path-video",
      label: "Render Path Video",
      now: () => 1000,
      abortController: { signal: { aborted: false } },
      diagnostics: capturePathJobDiagnostics({
        mode: "scene-only",
        pathVersion: 3,
        nodeCount: 2,
        segmentCount: 1,
        durationSeconds: 2,
        fps: 30,
        resolution: { width: 3840, height: 2160, label: "4K" },
        format: "mp4",
        totalFrames: 60,
        renderedFrames: 0,
        maxDetail: true,
      }),
    });
    assert.equal(job.status, "queued");
    assert.equal(isCaptureJobRunning(job), true);
    assert.equal(canStartCaptureJob([job]), false);

    const rendering = updateCaptureJobStatus(job, "rendering", { now: () => 1100 });
    const progressed = updateCaptureJobProgress(rendering, {
      renderedFrames: 10,
      totalFrames: 60,
      phase: "rendering",
    });
    assert.equal(progressed.status, "rendering");
    assert.equal(progressed.progress.renderedFrames, 10);
    assert.equal(progressed.diagnostics.maxDetail, true);

    const complete = completeCaptureJob(progressed, {
      now: () => 2000,
      output: {
        blob: { size: 12 },
        url: "blob:path-render",
        filename: "path.mp4",
        mimeType: "video/mp4",
        byteLength: 12,
        cleanup: () => revoked.push("cleanup:path-render"),
      },
      diagnostics: captureVideoOutputDiagnostics({
        outputByteLength: 12,
        encoderPreset: "mp4-h264-marketing",
      }),
    });
    assert.equal(complete.status, "complete");
    assert.equal(complete.output.byteLength, 12);
    assert.equal(complete.diagnostics.outputByteLength, 12);
    assert.equal(canStartCaptureJob([complete]), true);

    clearCaptureJobRecord(complete);
    assert.deepEqual(revoked, ["cleanup:path-render", "blob:path-render"]);

    const failed = failCaptureJob(job, new Error("encoder failed"), {
      now: () => 2100,
      diagnostics: { renderedFrames: 4 },
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.error, "encoder failed");
    assert.equal(failed.diagnostics.renderedFrames, 4);

    const cancelled = cancelCaptureJob(job, { now: () => 2200, reason: "user" });
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.error, "user");
  } finally {
    globalThis.URL = originalUrl;
  }
});

test("deterministic exporter still ends capture size when layer restore throws", async () => {
  const restoreDocument = installDocumentStub();
  const urlStub = installUrlStub();
  try {
    const { exportDeterministicFrameSequence } = await importBundled(
      "src/capture/deterministicFrameSequenceExporter.ts",
    );
    const sceneHandle = fakeSceneHandle({ throwOnRestoreStyle: true });
    const recipe = validRecipe({
      durationSeconds: 0.02,
      fps: 30,
      layerStyles: { a: { opacity: 1 } },
    });

    await assert.rejects(
      () =>
        exportDeterministicFrameSequence({
          sceneHandle,
          recipe,
          onFrame() {
            throw new Error("trigger cleanup");
          },
        }),
      /restore style failed/,
    );

    assert.ok(sceneHandle.calls.some((call) => call[0] === "endCaptureSize"));
    assert.deepEqual(urlStub.revoked, ["blob:runtime-0"]);
  } finally {
    urlStub.restore();
    restoreDocument();
  }
});

test("deterministic still exporter renders Screen Capture at output resolution", async () => {
  const restoreDocument = installDocumentStub();
  const urlStub = installUrlStub();
  try {
    const { exportDeterministicStill } = await importBundled(
      "src/capture/deterministicStillExporter.ts",
    );
    const sceneHandle = fakeSceneHandle();
    const recipe = validRecipe({
      mode: "presentation-ui",
      resolution: { width: 7680, height: 4320, label: "8K" },
      durationSeconds: 4,
      layerVisibility: { a: false, b: true },
      layerStyles: { a: { opacity: 0.9 } },
    });

    const result = await exportDeterministicStill({
      sceneHandle,
      recipe,
      timeSeconds: 2,
      mimeType: "image/jpeg",
      imageQuality: 0.72,
      filenamePrefix: "screen-capture",
      overlayContext: () => ({ title: "Screen Capture Runtime" }),
    });

    assert.equal(result.width, 7680);
    assert.equal(result.height, 4320);
    assert.equal(result.byteLength, "frame".length);
    assert.equal(result.mimeType, "image/jpeg");
    assert.equal(result.filename, "screen-capture-screen-capture.jpg");
    assert.equal(result.url, "blob:runtime-0");
    assert.deepEqual(
      sceneHandle.calls.filter((call) => call[0] === "beginCaptureSize"),
      [["beginCaptureSize", { width: 7680, height: 4320, pixelRatio: 1 }]],
    );
    assert.deepEqual(
      sceneHandle.calls.find((call) => call[0] === "renderCaptureFrame")?.[1],
      { timeSeconds: 2, frameIndex: 60 },
    );
    assert.ok(sceneHandle.calls.some((call) => call[0] === "endCaptureSize"));
    assert.ok(
      restoreDocument.createdCanvases.some((canvas) =>
        canvas.contextCalls.some(
          (call) => call[0] === "fillText" && call[1] === "Screen Capture Runtime",
        ),
      ),
    );

    result.cleanup();
    assert.deepEqual(urlStub.revoked, ["blob:runtime-0"]);
  } finally {
    urlStub.restore();
    restoreDocument();
  }
});

test("deterministic still exporter can force Screen Capture to use the live current view", async () => {
  const restoreDocument = installDocumentStub();
  const urlStub = installUrlStub();
  try {
    const { exportDeterministicStill } = await importBundled(
      "src/capture/deterministicStillExporter.ts",
    );
    const sceneHandle = fakeSceneHandle();
    const currentView = pose([88, 12, 34], [4, 5, 6]);
    const recipe = validRecipe({
      durationSeconds: 2,
      camera: pose([1, 1, 1]),
      cameraKeyframes: [
        { timeSeconds: 0, frameIndex: 0, camera: pose([10, 0, 0]) },
        { timeSeconds: 1, frameIndex: 30, camera: pose([20, 0, 0]) },
      ],
    });

    const result = await exportDeterministicStill({
      sceneHandle,
      recipe,
      cameraPose: currentView,
      useCurrentSceneState: true,
    });

    assert.deepEqual(
      sceneHandle.calls.find((call) => call[0] === "renderCameraPose"),
      ["renderCameraPose", currentView.position, currentView.target, currentView.fov],
    );
    assert.equal(
      sceneHandle.calls.some((call) => call[0] === "setVisible"),
      false,
      "current-view still capture should preserve currently visible scene layers",
    );
    assert.equal(
      sceneHandle.calls.some((call) => call[0] === "applyStyle"),
      false,
      "current-view still capture should preserve currently active scene styles",
    );
    result.cleanup();
  } finally {
    urlStub.restore();
    restoreDocument();
  }
});

test("deterministic still exporter rejects empty output without a download URL", async () => {
  const restoreDocument = installDocumentStub();
  const urlStub = installUrlStub();
  try {
    const { exportDeterministicStill } = await importBundled(
      "src/capture/deterministicStillExporter.ts",
    );
    FakeCanvas.prototype.toBlob = function toBlob(callback, mimeType) {
      callback(new Blob([], { type: mimeType }));
    };

    await assert.rejects(
      () =>
        exportDeterministicStill({
          sceneHandle: fakeSceneHandle(),
          recipe: validRecipe(),
        }),
      /Screen Capture produced an empty image/,
    );
    assert.equal(urlStub.created.length, 0);
  } finally {
    delete FakeCanvas.prototype.toBlob;
    FakeCanvas.prototype.toBlob = function toBlob(callback, mimeType) {
      callback(new Blob(["frame"], { type: mimeType }));
    };
    urlStub.restore();
    restoreDocument();
  }
});

test("deterministic still exporter preflights oversized render requests before scene mutation", async () => {
  const restoreDocument = installDocumentStub();
  try {
    const { exportDeterministicStill } = await importBundled(
      "src/capture/deterministicStillExporter.ts",
    );
    const sceneHandle = fakeSceneHandle({ maxTextureSize: 8192 });

    await assert.rejects(
      () =>
        exportDeterministicStill({
          sceneHandle,
          recipe: validRecipe({
            resolution: { width: 7680, height: 4320, label: "8K" },
            supersampleScale: 2,
          }),
        }),
      /exceeds/,
    );
    assert.equal(sceneHandle.calls.some((call) => call[0] === "setVisible"), false);
    assert.equal(sceneHandle.calls.some((call) => call[0] === "applyStyle"), false);
    assert.equal(
      sceneHandle.calls.some((call) => call[0] === "beginCaptureSize"),
      false,
    );
  } finally {
    restoreDocument();
  }
});

function fakeEncodingSequence(overrides = {}) {
  const recipe = overrides.recipe ?? validRecipe({
    mode: "scene-annotations",
    resolution: { width: 1920, height: 1080, label: "1080p" },
    durationSeconds: 0.1,
    fps: 30,
  });
  const fps = overrides.fps ?? recipe.fps;
  const width = overrides.width ?? recipe.resolution.width;
  const height = overrides.height ?? recipe.resolution.height;
  const totalFrames =
    overrides.totalFrames ??
    Math.max(1, Math.ceil(recipe.durationSeconds * recipe.fps));
  const mimeType = overrides.mimeType ?? "image/png";
  const frames = Array.from({ length: totalFrames }, (_, frameIndex) => ({
    frameIndex,
    timeSeconds: frameIndex / fps,
    blob: new Blob([`frame-${frameIndex}`], { type: mimeType }),
    url: `blob:frame-${frameIndex}`,
    filename: `unsafe/path/frame-${frameIndex}.${
      mimeType === "image/webp" ? "webp" : "png"
    }`,
    width,
    height,
    mimeType,
  }));
  return {
    recipe,
    frames,
    totalFrames,
    width,
    height,
    renderWidth: width,
    renderHeight: height,
    fps,
    durationSeconds: recipe.durationSeconds,
    supersampleScale: recipe.supersampleScale,
    cleanup() {
      this.cleaned = true;
    },
    ...overrides,
  };
}

function fakeFfmpegRuntime({ failExec = false } = {}) {
  const calls = [];
  const files = new Map();
  return {
    calls,
    files,
    async writeFile(path, data) {
      calls.push(["writeFile", path, data.length]);
      files.set(path, data);
    },
    async exec(args) {
      calls.push(["exec", args]);
      if (failExec) {
        throw new Error("ffmpeg failed");
      }
      const outputPath = Array.isArray(args) ? args[args.length - 1] : null;
      files.set("/geosee-capture/output.mp4", new Uint8Array([1, 2, 3]));
      files.set("/geosee-capture/output.webm", new Uint8Array([4, 5, 6]));
      if (typeof outputPath === "string") {
        files.set(outputPath, new Uint8Array([9, 8, 7]));
      }
    },
    async readFile(path) {
      calls.push(["readFile", path]);
      const data = files.get(path);
      if (!data) throw new Error(`missing file ${path}`);
      return data;
    },
    async deleteFile(path) {
      calls.push(["deleteFile", path]);
      files.delete(path);
    },
  };
}

function fakePendingFfmpegRuntime() {
  const calls = [];
  const files = new Map();
  return {
    calls,
    files,
    async writeFile(path, data) {
      calls.push(["writeFile", path, data.length]);
      files.set(path, data);
    },
    async exec(args, options) {
      calls.push(["exec", args, options]);
      await new Promise(() => {});
    },
    async readFile(path) {
      calls.push(["readFile", path]);
      const data = files.get(path);
      if (!data) throw new Error(`missing file ${path}`);
      return data;
    },
    async deleteFile(path) {
      calls.push(["deleteFile", path]);
      files.delete(path);
    },
  };
}

test("frame-sequence encoder validates deterministic frame integrity", async () => {
  const {
    validateDeterministicFrameSequenceForEncoding,
  } = await importBundled("src/capture/frameSequenceVideoEncoder.ts");

  assert.equal(
    validateDeterministicFrameSequenceForEncoding(fakeEncodingSequence()).valid,
    true,
  );

  const invalid = fakeEncodingSequence({
    recipe: validRecipe({ mode: "full-ui" }),
    width: 1919,
    frames: [
      {
        frameIndex: 1,
        timeSeconds: 0.25,
        blob: new Blob([], { type: "image/jpeg" }),
        url: "blob:bad",
        filename: "bad.jpg",
        width: 1900,
        height: 1080,
        mimeType: "image/jpeg",
      },
    ],
  });
  const result = validateDeterministicFrameSequenceForEncoding(invalid);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /full-ui/);
  assert.match(result.errors.join("\n"), /frame count/);
  assert.match(result.errors.join("\n"), /frameIndex/);
  assert.match(result.errors.join("\n"), /timeSeconds/);
  assert.match(result.errors.join("\n"), /blob/);
  assert.match(result.errors.join("\n"), /mimeType/);
  assert.match(result.errors.join("\n"), /dimensions/);
});

test("frame-sequence encoder builds deterministic MP4 and WebM FFmpeg plans", async () => {
  const {
    createFfmpegFrameSequenceEncodePlan,
  } = await importBundled("src/capture/frameSequenceVideoEncoder.ts");
  const sequence = fakeEncodingSequence();
  const mp4 = createFfmpegFrameSequenceEncodePlan(sequence, {
    preset: "mp4-h264-marketing",
  });
  const webm = createFfmpegFrameSequenceEncodePlan(sequence, {
    preset: "webm-vp9-marketing",
    virtualDirectory: "/custom",
    outputBasename: "demo",
  });

  assert.equal(mp4.outputPath, "/geosee-capture/output.mp4");
  assert.equal(mp4.inputPattern, "/geosee-capture/frame-%06d.png");
  assert.deepEqual(mp4.inputFiles.map((file) => file.path), [
    "/geosee-capture/frame-000000.png",
    "/geosee-capture/frame-000001.png",
    "/geosee-capture/frame-000002.png",
  ]);
  assert.deepEqual(mp4.args, [
    "-hide_banner",
    "-y",
    "-framerate",
    "30",
    "-start_number",
    "0",
    "-i",
    "/geosee-capture/frame-%06d.png",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "/geosee-capture/output.mp4",
  ]);
  assert.equal(webm.outputPath, "/custom/demo.webm");
  assert.ok(webm.args.includes("libvpx-vp9"));
  assert.ok(webm.args.includes("-row-mt"));
  assert.ok(!webm.inputPattern.includes("unsafe/path"));
});

test("frame-sequence encoder writes frames, executes FFmpeg, and cleans virtual files", async () => {
  const {
    encodeDeterministicFrameSequenceWithFfmpeg,
  } = await importBundled("src/capture/frameSequenceVideoEncoder.ts");
  const urlStub = installUrlStub();
  const runtime = fakeFfmpegRuntime();
  try {
    const sequence = fakeEncodingSequence();
    const result = await encodeDeterministicFrameSequenceWithFfmpeg({
      sequence,
      runtime,
      preset: "mp4-h264-marketing",
    });

    assert.equal(result.mimeType, "video/mp4");
    assert.equal(result.url, "blob:runtime-0");
    assert.equal(urlStub.created.length, 1);
    assert.equal(runtime.calls.filter((call) => call[0] === "writeFile").length, 3);
    assert.equal(runtime.calls.filter((call) => call[0] === "exec").length, 1);
    assert.equal(runtime.calls.filter((call) => call[0] === "readFile").length, 1);
    assert.equal(
      runtime.calls.filter((call) => call[0] === "deleteFile").length,
      4,
    );
    assert.equal(sequence.cleaned, undefined);

    result.cleanup();
    assert.deepEqual(urlStub.revoked, ["blob:runtime-0"]);
  } finally {
    urlStub.restore();
  }
});

test("frame-sequence encoder cleans virtual files when FFmpeg fails", async () => {
  const {
    encodeDeterministicFrameSequenceWithFfmpeg,
  } = await importBundled("src/capture/frameSequenceVideoEncoder.ts");
  const runtime = fakeFfmpegRuntime({ failExec: true });

  await assert.rejects(
    encodeDeterministicFrameSequenceWithFfmpeg({
      sequence: fakeEncodingSequence(),
      runtime,
      preset: "mp4-h264-marketing",
    }),
    /ffmpeg failed/,
  );
  assert.equal(
    runtime.calls.filter((call) => call[0] === "deleteFile").length,
    4,
  );
});

test("frame-sequence encoder rejects stalled FFmpeg exec and cleans virtual files", async () => {
  const {
    encodeDeterministicFrameSequenceWithFfmpeg,
  } = await importBundled("src/capture/frameSequenceVideoEncoder.ts");
  const runtime = fakePendingFfmpegRuntime();
  const progress = [];

  await assert.rejects(
    encodeDeterministicFrameSequenceWithFfmpeg({
      sequence: fakeEncodingSequence(),
      runtime,
      preset: "mp4-h264-marketing",
      stallTimeoutMs: 15,
      execTimeoutMs: 1000,
      onProgress: (event) => progress.push(event),
    }),
    /Encoding stalled/,
  );

  assert.equal(runtime.calls.filter((call) => call[0] === "exec").length, 1);
  assert.equal(
    runtime.calls.filter((call) => call[0] === "deleteFile").length,
    4,
  );
  assert.equal(progress.some((event) => event.phase === "writing-frames"), true);
  assert.equal(progress.some((event) => event.phase === "encoding"), true);
});

test("frame-sequence encoder cleans input frames when encode planning fails", async () => {
  const {
    encodeDeterministicFrameSequenceWithFfmpeg,
  } = await importBundled("src/capture/frameSequenceVideoEncoder.ts");
  const runtime = fakeFfmpegRuntime();
  const sequence = fakeEncodingSequence({
    recipe: validRecipe({
      resolution: { width: 641, height: 360, label: "Odd Width" },
    }),
    width: 641,
    frames: [
      {
        frameIndex: 0,
        timeSeconds: 0,
        blob: new Blob(["a"], { type: "image/png" }),
        url: "blob:a",
        filename: "frame-000000.png",
        width: 641,
        height: 360,
        mimeType: "image/png",
      },
      {
        frameIndex: 1,
        timeSeconds: 1 / 30,
        blob: new Blob(["b"], { type: "image/png" }),
        url: "blob:b",
        filename: "frame-000001.png",
        width: 641,
        height: 360,
        mimeType: "image/png",
      },
      {
        frameIndex: 2,
        timeSeconds: 2 / 30,
        blob: new Blob(["c"], { type: "image/png" }),
        url: "blob:c",
        filename: "frame-000002.png",
        width: 641,
        height: 360,
        mimeType: "image/png",
      },
    ],
  });

  await assert.rejects(
    encodeDeterministicFrameSequenceWithFfmpeg({
      sequence,
      runtime,
      preset: "mp4-h264-marketing",
      cleanupInputFrames: true,
    }),
    /requires even sequence width/,
  );
  assert.equal(sequence.cleaned, true);
  assert.equal(runtime.calls.length, 0);
});

test("video save options validate blobs and handle picker outcomes", async () => {
  const {
    captureVideoFilename,
    captureVideoMimeType,
    saveCaptureVideoBlobWithPicker,
    validateCaptureVideoBlob,
  } = await importBundled("src/capture/captureVideoSaveOptions.ts");

  assert.equal(captureVideoFilename("unsafe name.mp4", "mp4"), "unsafe-name.mp4");
  assert.equal(captureVideoMimeType("webm"), "video/webm");
  assert.throws(
    () => validateCaptureVideoBlob(new Blob([]), "Preview MP4"),
    /no video data/,
  );
  assert.deepEqual(
    await saveCaptureVideoBlobWithPicker({
      blob: new Blob(["video"], { type: "video/webm" }),
      filename: "preview.webm",
      type: "webm",
      picker: null,
    }),
    { status: "unavailable" },
  );

  const writes = [];
  const saved = await saveCaptureVideoBlobWithPicker({
    blob: new Blob(["video"], { type: "video/mp4" }),
    filename: "preview.mp4",
    type: "mp4",
    picker: async (options) => {
      writes.push(["picker", options.suggestedName, options.types[0].accept]);
      return {
        async createWritable() {
          return {
            async write(blob) {
              writes.push(["write", blob.size]);
            },
            async close() {
              writes.push(["close"]);
            },
          };
        },
      };
    },
  });
  assert.deepEqual(saved, { status: "saved" });
  assert.deepEqual(writes, [
    ["picker", "preview.mp4", { "video/mp4": [".mp4"] }],
    ["write", 5],
    ["close"],
  ]);

  const cancelled = await saveCaptureVideoBlobWithPicker({
    blob: new Blob(["video"], { type: "video/mp4" }),
    filename: "preview.mp4",
    type: "mp4",
    picker: async () => {
      throw new DOMException("cancelled", "AbortError");
    },
  });
  assert.deepEqual(cancelled, { status: "cancelled" });
});

test("preview WebM transcode builds MP4 plan and validates output bytes", async () => {
  const {
    createPreviewVideoTranscodePlan,
    transcodePreviewVideoToMp4,
  } = await importBundled("src/capture/previewVideoTranscoder.ts");
  const urlStub = installUrlStub();
  const runtime = fakeFfmpegRuntime();
  try {
    const plan = createPreviewVideoTranscodePlan({
      outputBasename: "path-preview",
      virtualDirectory: "/preview",
    });
    assert.equal(plan.inputPath, "/preview/input.webm");
    assert.equal(plan.outputPath, "/preview/path-preview.mp4");
    assert.ok(plan.args.includes("libx264"));
    assert.ok(plan.args.includes("+faststart"));

    const result = await transcodePreviewVideoToMp4({
      inputBlob: new Blob(["webm-data"], { type: "video/webm" }),
      runtime,
      outputBasename: "path-preview",
      virtualDirectory: "/preview",
    });
    assert.equal(result.mimeType, "video/mp4");
    assert.equal(result.filename, "path-preview.mp4");
    assert.equal(result.blob.size, 3);
    assert.equal(runtime.calls.filter((call) => call[0] === "writeFile").length, 1);
    assert.equal(runtime.calls.filter((call) => call[0] === "exec").length, 1);
    assert.equal(runtime.calls.filter((call) => call[0] === "readFile").length, 1);
    assert.equal(runtime.calls.filter((call) => call[0] === "deleteFile").length, 2);
    result.cleanup();
    assert.deepEqual(urlStub.revoked, ["blob:runtime-0"]);
  } finally {
    urlStub.restore();
  }

  await assert.rejects(
    transcodePreviewVideoToMp4({
      inputBlob: new Blob([]),
      runtime: fakeFfmpegRuntime(),
    }),
    /Preview WebM produced no video data/,
  );
});

test("browser FFmpeg runtime adapter loads lazily and maps filesystem calls", async () => {
  const {
    createBrowserFfmpegFrameSequenceRuntime,
  } = await importBundled("src/capture/browserFfmpegRuntime.ts");
  const calls = [];

  class FakeFFmpeg {
    async load(options) {
      calls.push(["load", options]);
    }

    async writeFile(path, data) {
      calls.push(["writeFile", path, data.length]);
    }

    async exec(args) {
      calls.push(["exec", args]);
    }

    async readFile(path) {
      calls.push(["readFile", path]);
      return new Uint8Array([7, 8, 9]);
    }

    async deleteFile(path) {
      calls.push(["deleteFile", path]);
    }

    terminate() {
      calls.push(["terminate"]);
    }
  }

  const handle = await createBrowserFfmpegFrameSequenceRuntime({
    loadOptions: { coreURL: "/ffmpeg-core.js" },
    loadModule: async () => ({ FFmpeg: FakeFFmpeg }),
  });
  await handle.runtime.writeFile("/frames/frame-000000.png", new Uint8Array([1, 2]));
  await handle.runtime.exec(["-version"]);
  assert.deepEqual(await handle.runtime.readFile("/frames/output.mp4"), new Uint8Array([7, 8, 9]));
  await handle.runtime.deleteFile?.("/frames/frame-000000.png");
  handle.dispose();

  assert.deepEqual(calls, [
    ["load", { coreURL: "/ffmpeg-core.js" }],
    ["writeFile", "/frames/frame-000000.png", 2],
    ["exec", ["-version"]],
    ["readFile", "/frames/output.mp4"],
    ["deleteFile", "/frames/frame-000000.png"],
    ["terminate"],
  ]);
});

test("browser FFmpeg runtime adapter defaults to self-hosted core assets", async () => {
  const {
    createBrowserFfmpegFrameSequenceRuntime,
  } = await importBundled("src/capture/browserFfmpegRuntime.ts");
  const calls = [];
  const previousDocument = globalThis.document;
  globalThis.document = { baseURI: "https://example.test/app/" };

  class FakeFFmpeg {
    async load(options) {
      calls.push(["load", options]);
    }

    async writeFile(path, data) {
      calls.push(["writeFile", path, data.length]);
    }
  }

  try {
    const handle = createBrowserFfmpegFrameSequenceRuntime({
      loadModule: async () => ({ FFmpeg: FakeFFmpeg }),
    });
    await handle.runtime.writeFile("/frame.png", new Uint8Array([1]));
    handle.dispose();
  } finally {
    globalThis.document = previousDocument;
  }

  assert.deepEqual(calls, [
    [
      "load",
      {
        coreURL: "https://example.test/runtime/ffmpeg/ffmpeg-core.js",
        wasmURL: "https://example.test/runtime/ffmpeg/ffmpeg-core.wasm",
        workerURL: "https://example.test/runtime/ffmpeg/ffmpeg-core.worker.js",
      },
    ],
    ["writeFile", "/frame.png", 1],
  ]);
});

test("browser FFmpeg runtime adapter forwards abort signals to FFmpeg calls", async () => {
  const {
    createBrowserFfmpegFrameSequenceRuntime,
  } = await importBundled("src/capture/browserFfmpegRuntime.ts");
  const calls = [];
  const controller = new AbortController();

  class FakeFFmpeg {
    async load(options, runtimeOptions) {
      calls.push(["load", options, runtimeOptions?.signal === controller.signal]);
    }

    async writeFile(path, data, runtimeOptions) {
      calls.push(["writeFile", path, data.length, runtimeOptions?.signal === controller.signal]);
    }

    on(event, handler) {
      calls.push(["on", event, typeof handler]);
    }

    off(event, handler) {
      calls.push(["off", event, typeof handler]);
    }

    async exec(args, timeout, runtimeOptions) {
      calls.push(["exec", args, timeout, runtimeOptions?.signal === controller.signal]);
      return 0;
    }

    async readFile(path, encoding, runtimeOptions) {
      calls.push(["readFile", path, encoding, runtimeOptions?.signal === controller.signal]);
      return new Uint8Array([1]);
    }

    async deleteFile(path, runtimeOptions) {
      calls.push(["deleteFile", path, runtimeOptions?.signal === controller.signal]);
    }
  }

  const handle = createBrowserFfmpegFrameSequenceRuntime({
    signal: controller.signal,
    loadModule: async () => ({ FFmpeg: FakeFFmpeg }),
  });
  await handle.runtime.writeFile("/frame.png", new Uint8Array([1]));
  const progressEvents = [];
  await handle.runtime.exec(["-version"], {
    timeoutMs: 1234,
    onProgress: (event) => progressEvents.push(event),
  });
  await handle.runtime.readFile("/output.mp4");
  await handle.runtime.deleteFile?.("/frame.png");

  assert.equal(calls[0][0], "load");
  assert.equal(calls[0][2], true);
  assert.match(calls[0][1].coreURL, /\/runtime\/ffmpeg\/ffmpeg-core\.js$/);
  assert.match(calls[0][1].wasmURL, /\/runtime\/ffmpeg\/ffmpeg-core\.wasm$/);
  assert.deepEqual(calls.slice(1), [
    ["writeFile", "/frame.png", 1, true],
    ["on", "progress", "function"],
    ["on", "log", "function"],
    ["exec", ["-version"], 1234, true],
    ["off", "progress", "function"],
    ["off", "log", "function"],
    ["readFile", "/output.mp4", undefined, true],
    ["deleteFile", "/frame.png", true],
  ]);
  assert.deepEqual(progressEvents, []);
});

test("external video render jobs validate 4K deterministic video metadata", async () => {
  const {
    createExternalVideoRenderJob,
    externalVideoRenderCommand,
    externalVideoRenderJobFilename,
    parseExternalVideoRenderJobJson,
    serializeExternalVideoRenderJob,
    shouldDefaultToExternalVideoRenderJob,
    validateExternalVideoRenderJob,
  } = await importBundled("src/capture/externalVideoRenderJob.ts");

  const recipe = validRecipe({
    mode: "scene-annotations",
    resolution: { width: 3840, height: 2160, label: "4K" },
    durationSeconds: 2,
    fps: 30,
  });
  const job = createExternalVideoRenderJob({
    recipe,
    format: "mp4",
    appUrl: "http://127.0.0.1:5173/?project=runtime-test",
    createdAt: "2026-06-07T00:00:00.000Z",
  });

  assert.equal(job.schema, "CaptureVideoRenderJobV1");
  assert.equal(job.video.width, 3840);
  assert.equal(job.video.height, 2160);
  assert.equal(job.video.totalFrames, 60);
  assert.equal(job.video.format, "mp4");
  assert.equal(job.fidelity, "max-detail-render");
  assert.equal(validateExternalVideoRenderJob(job).valid, true);
  assert.equal(shouldDefaultToExternalVideoRenderJob(recipe), true);
  assert.match(externalVideoRenderJobFilename(job), /external-video/);
  assert.match(
    externalVideoRenderCommand("job.json", job),
    /node tools\\render-capture-video-job\.mjs --job job\.json --out .*\.mp4/,
  );

  const parsed = parseExternalVideoRenderJobJson(serializeExternalVideoRenderJob(job));
  assert.equal(parsed.validation.valid, true);
  assert.equal(parsed.job?.jobId, job.jobId);

  const invalid = validateExternalVideoRenderJob({
    ...job,
    recipe: { ...job.recipe, mode: "full-ui" },
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /full-ui/);
});

test("local video render runner starts, polls, and cancels the dev renderer endpoint", async () => {
  const {
    cancelLocalVideoRenderJob,
    localRendererAvailable,
    pollLocalVideoRenderJob,
    startLocalVideoRenderJob,
  } = await importBundled("src/capture/localVideoRenderRunner.ts");

  const {
    createExternalVideoRenderJob,
  } = await importBundled("src/capture/externalVideoRenderJob.ts");

  const job = createExternalVideoRenderJob({
    recipe: validRecipe({
      mode: "scene-only",
      resolution: { width: 3840, height: 2160, label: "4K" },
      durationSeconds: 1,
      fps: 30,
    }),
    format: "mp4",
    appUrl: "http://127.0.0.1:5173/?project=runtime-test",
    createdAt: "2026-06-07T00:00:00.000Z",
  });

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(String(options.body)) : null;
    calls.push({ url: String(url), body });
    if (String(url).endsWith("/video-renderer-availability")) {
      return new Response(JSON.stringify({ available: true }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        runId: body?.runId ?? "local-run-1",
        status: String(url).endsWith("/cancel-video") ? "cancelled" : "rendering",
        phase: "rendering",
        startedAt: "2026-06-07T00:00:00.000Z",
        completedAt: null,
        outputFilename: job.video.filename,
        outputPath: "C:\\GeoSee\\GeoSee_Dev\\.tmp\\capture-video-outputs\\out.mp4",
        outputUrl: "/api/capture/video-output?runId=local-run-1",
        diagnosticsPath:
          "C:\\GeoSee\\GeoSee_Dev\\.tmp\\capture-video-outputs\\out.mp4.capture-diagnostics.json",
        elapsedSeconds: 1,
      }),
      { status: 200 },
    );
  };

  try {
    const availability = await localRendererAvailable();
    assert.equal(availability.available, true);
    const started = await startLocalVideoRenderJob({ job });
    assert.equal(started.runId, "local-run-1");
    assert.match(started.outputUrl, /\/api\/capture\/video-output/);
    const polled = await pollLocalVideoRenderJob(started.runId);
    assert.equal(polled.status, "rendering");
    const cancelled = await cancelLocalVideoRenderJob(started.runId);
    assert.equal(cancelled.status, "cancelled");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "/api/capture/video-renderer-availability",
      "/api/capture/render-video",
      "/api/capture/video-status",
      "/api/capture/cancel-video",
    ],
  );
  assert.equal(calls[1].body.job.schema, "CaptureVideoRenderJobV1");
  assert.equal(calls[1].body.outputFilename, job.video.filename);
});

test("local scroll package runner starts, polls, downloads, and cancels package endpoint", async () => {
  const {
    cancelLocalScrollPackageRenderJob,
    localScrollPackageRendererAvailable,
    pollLocalScrollPackageRenderJob,
    scrollPackageOutputUrl,
    startLocalScrollPackageRenderJob,
  } = await importBundled("src/capture/localScrollPackageRunner.ts");
  const {
    createScrollRecordRequest,
  } = await importBundled("src/capture/captureScrollTimeline.ts");
  const {
    createPendingScrollHandoffManifest,
  } = await importBundled("src/capture/scrollHandoffPackage.ts");
  const {
    createExternalVideoRenderJob,
  } = await importBundled("src/capture/externalVideoRenderJob.ts");

  const request = createScrollRecordRequest({
    timeline: validScrollTimeline({
      durationSeconds: 2,
      range: { mode: "frame-range", startFrame: 30, endFrame: 59 },
    }),
    format: "mp4",
    quality: { preset: "1080p", width: 1920, height: 1080 },
    destination: ".tmp/capture-scroll-outputs",
    packageName: "runner-scroll",
    cleanRender: true,
    renderRouteIntent: "browser-inline",
    advancedOptions: { includeDiagnostics: true },
    createdAt: "2026-06-16T00:00:00.000Z",
  });
  const manifest = createPendingScrollHandoffManifest(request);
  const renderJob = createExternalVideoRenderJob({
    recipe: validRecipe({
      mode: "scene-only",
      resolution: { width: 1920, height: 1080, label: "1080p" },
      durationSeconds: 2,
      fps: 60,
    }),
    format: "mp4",
    appUrl: "http://127.0.0.1:5194/?project=runtime-test",
    createdAt: "2026-06-16T00:00:00.000Z",
  });

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(String(options.body)) : null;
    calls.push({ url: String(url), body });
    if (String(url).endsWith("/scroll-package/availability")) {
      return new Response(JSON.stringify({ available: true }), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        runId: body?.runId ?? "scroll-run-1",
        status: String(url).endsWith("/cancel") ? "cancelled" : "rendering",
        phase: "rendering",
        startedAt: "2026-06-16T00:00:00.000Z",
        completedAt: null,
        packageName: "runner-scroll",
        packagePath: "C:\\GeoSee\\GeoSee_Dev\\.tmp\\capture-scroll-outputs\\runner-scroll",
        manifestPath:
          "C:\\GeoSee\\GeoSee_Dev\\.tmp\\capture-scroll-outputs\\runner-scroll\\scroll-manifest.json",
        manifestUrl:
          "/api/capture/scroll-package-output?runId=scroll-run-1&variant=manifest",
        outputUrl:
          "/api/capture/scroll-package-output?runId=scroll-run-1&variant=media&path=media%2Fscroll-master.mp4",
        diagnosticsPath:
          "C:\\GeoSee\\GeoSee_Dev\\.tmp\\capture-scroll-outputs\\runner-scroll\\diagnostics\\runner-scroll.json",
        renderedFrames: 12,
        totalFrames: 30,
        warnings: [],
      }),
      { status: 200 },
    );
  };

  try {
    const availability = await localScrollPackageRendererAvailable();
    assert.equal(availability.available, true);
    const started = await startLocalScrollPackageRenderJob({
      request,
      manifest,
      renderJob,
      synthetic: true,
    });
    assert.equal(started.runId, "scroll-run-1");
    assert.match(started.manifestUrl ?? "", /\/api\/capture\/scroll-package-output/);
    assert.match(scrollPackageOutputUrl(started.runId, "manifest"), /variant=manifest/);
    const polled = await pollLocalScrollPackageRenderJob(started.runId);
    assert.equal(polled.status, "rendering");
    const cancelled = await cancelLocalScrollPackageRenderJob(started.runId);
    assert.equal(cancelled.status, "cancelled");
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "/api/capture/scroll-package/availability",
      "/api/capture/scroll-package/start",
      "/api/capture/scroll-package/status",
      "/api/capture/scroll-package/cancel",
    ],
  );
  assert.equal(calls[1].body.request.schema, "CaptureScrollRecordRequestV1");
  assert.equal(calls[1].body.manifest.schema, "ScrollHandoffPackageV1");
  assert.equal(calls[1].body.renderJob.schema, "CaptureVideoRenderJobV1");
  assert.equal(calls[1].body.renderJob.video.sourceFrameStart, 30);
});
