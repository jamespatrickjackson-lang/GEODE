import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8").replace(/\r\n/g, "\n");
}

const requiredCaptureFiles = [
  "captureTypes.ts",
  "captureProfiles.ts",
  "captureResolution.ts",
  "canvasPreviewRecorder.ts",
  "displayPreviewRecorder.ts",
  "compositedCaptureRecorder.ts",
  "captureOverlayRenderer.ts",
  "CaptureDirectorProvider.tsx",
  "CaptureDirectorToolbar.tsx",
  "CaptureChromeGate.tsx",
  "captureRecipe.ts",
  "deterministicStillExporter.ts",
  "deterministicFrameSequenceExporter.ts",
  "frameSequenceVideoEncoder.ts",
  "browserFfmpegRuntime.ts",
  "capturePageRange.ts",
  "screenCaptureSaveOptions.ts",
  "externalStillRenderJob.ts",
  "captureCameraPath.ts",
  "captureCameraPathV2.ts",
  "captureCameraPathV3.ts",
  "captureCameraPathV3Solver.ts",
  "captureJobTypes.ts",
  "captureJobRuntime.ts",
  "captureJobDiagnostics.ts",
  "externalVideoRenderJob.ts",
  "captureScrollTimeline.ts",
  "scrollHandoffPackage.ts",
  "captureVideoSaveOptions.ts",
  "previewVideoTranscoder.ts",
  "CameraPathLineItemEditor.tsx",
  "CameraPathTransitionEditor.tsx",
  "CameraPathTimeline.tsx",
];

test("Capture Director v1 module boundary exists", () => {
  for (const file of requiredCaptureFiles) {
    assert.ok(
      existsSync(join(repoRoot, "src", "capture", file)),
      `src/capture/${file} should exist`,
    );
  }
});

test("capture visibility profiles cover every mode and UI group", () => {
  const source = readSource("src", "capture", "captureProfiles.ts");
  for (const mode of [
    "off",
    "scene-only",
    "scene-annotations",
    "presentation-ui",
    "full-ui",
  ]) {
    assert.ok(
      source.includes(`"${mode}"`) || source.includes(`${mode}:`),
      `profile should include ${mode}`,
    );
  }
  for (const group of [
    "sceneCanvas",
    "captureNativeAnnotations",
    "presenterOverlay",
    "sceneLabels",
    "legends",
    "logo",
    "navControls",
    "editorSidebar",
    "authoringControls",
    "debugPanels",
    "fullChrome",
  ]) {
    assert.ok(source.includes(`${group}:`), `profile should include ${group}`);
  }
  const sceneOnlyBlock = source.match(/"scene-only":\s*{([\s\S]*?)\n  },/)?.[1] ?? "";
  assert.ok(sceneOnlyBlock.includes("editorSidebar: false"));
  assert.ok(sceneOnlyBlock.includes("navControls: false"));
  assert.ok(sceneOnlyBlock.includes("sceneLabels: false"));
  assert.ok(sceneOnlyBlock.includes("legends: false"));
  const annotationsBlock =
    source.match(/"scene-annotations":\s*{([\s\S]*?)\n  },/)?.[1] ?? "";
  assert.ok(annotationsBlock.includes("captureNativeAnnotations: true"));
  assert.ok(annotationsBlock.includes("editorSidebar: false"));
  const fullUiBlock = source.match(/"full-ui":\s*{([\s\S]*?)\n  },/)?.[1] ?? "";
  assert.ok(fullUiBlock.includes("fullChrome: true"));
  assert.ok(fullUiBlock.includes("editorSidebar: true"));
});

test("MediaRecorder MIME negotiation preserves marketing fallback order", () => {
  const source = readSource("src", "capture", "canvasPreviewRecorder.ts");
  const vp9Index = source.indexOf('"video/webm;codecs=vp9"');
  const vp8Index = source.indexOf('"video/webm;codecs=vp8"');
  const webmIndex = source.indexOf('"video/webm"');
  assert.ok(vp9Index >= 0, "VP9 MIME should be attempted");
  assert.ok(vp8Index > vp9Index, "VP8 fallback should follow VP9");
  assert.ok(webmIndex > vp8Index, "plain webm fallback should follow VP8");
  assert.ok(
    source.includes("selectSupportedMediaRecorderMimeType"),
    "MIME selection helper should be exported for tests and reuse",
  );
  for (const expected of [
    "EmptyCaptureRecordingError",
    "validateCaptureRecorderBlob",
    "formatEmptyCaptureRecordingMessage",
    "recorder.requestData?.()",
    "requestCanvasCaptureFrame",
    "track?.requestFrame?.()",
    "onAfterRender",
    "globalThis.setInterval",
    "globalThis.clearInterval",
    "recorder.start(1000)",
    "byteLength: blob.size",
    "emptyChunkCount",
    "requestDataSupported",
  ]) {
    assert.ok(source.includes(expected), `recorder should include ${expected}`);
  }
});

test("capture resolution presets and validation cover v1 quality targets", () => {
  const source = readSource("src", "capture", "captureResolution.ts");
  for (const expected of [
    "1920",
    "1080",
    "2560",
    "1440",
    "3840",
    "2160",
    "7680",
    "4320",
    "render-8k",
    "CAPTURE_PREVIEW_RESOLUTION_PRESET_ORDER",
    "CAPTURE_RENDER_RESOLUTION_PRESET_ORDER",
    "CAPTURE_REALTIME_FPS_OPTIONS",
    "CAPTURE_RENDER_FPS_OPTIONS",
    "captureResolutionPresetIdForResolution",
    "validateRenderResolutionRequest",
    "defaultFps: 30",
    "defaultFps: 60",
    "validateCaptureResolution",
    "validateCaptureFps",
  ]) {
    assert.ok(source.includes(expected), `captureResolution should include ${expected}`);
  }
  const previewOrderBlock =
    source.match(/CAPTURE_PREVIEW_RESOLUTION_PRESET_ORDER[\s\S]*?\];/)?.[0] ??
    "";
  assert.ok(!previewOrderBlock.includes("render-8k"), "8K must not be realtime preview");
  const renderOrderBlock =
    source.match(/CAPTURE_RENDER_RESOLUTION_PRESET_ORDER[\s\S]*?\];/)?.[0] ??
    "";
  assert.ok(renderOrderBlock.includes("render-8k"), "8K must be render-output only");
});

test("CaptureRecipeV1 schema and deterministic frame-time helper exist", () => {
  const source = readSource("src", "capture", "captureRecipe.ts");
  for (const field of [
    "version",
    "projectSlug",
    "pageId",
    "mode",
    "resolution",
    "fps",
    "durationSeconds",
    "camera",
    "cameraKeyframes",
    "layerVisibility",
    "layerStyles",
    "environmentState",
    "visualPreset",
    "supersampleScale",
    "qualityPreset",
    "createdAt",
    "previewResolution",
    "captureScope",
    "pageRangeStartId",
    "pageRangeEndId",
    "pageRangeTiming",
    "equalHoldSeconds",
    "cameraPath",
    "cameraTimeline",
    "renderFidelity",
  ]) {
    assert.ok(source.includes(field), `CaptureRecipeV1 should include ${field}`);
  }
  assert.ok(
    source.includes("createCaptureRecipeFromCurrentState"),
    "recipe helper should create recipes from current app state",
  );
  assert.ok(
    source.includes("validateCaptureRecipe"),
    "recipe helper should validate deterministic export inputs",
  );
  for (const expected of [
    "serializeCaptureRecipe",
    "parseCaptureRecipeJson",
    "captureRecipeFilename",
    "normalizeCaptureCameraKeyframes",
    "CaptureCameraPathRecipe",
    "normalizeCaptureCameraPathForRecipe",
    "camera keyframe times must be unique",
  ]) {
    assert.ok(source.includes(expected), `recipe helper should include ${expected}`);
  }
  assert.match(
    source,
    /frameIndex\s*\/\s*fps/,
    "getCaptureFrameTime should use frameIndex / fps",
  );
});

test("Capture Director production types expose panel, still, save, and fidelity modes", () => {
  const source = readSource("src", "capture", "captureTypes.ts");
  for (const expected of [
    "CaptureDirectorPanel",
    '"closed"',
    '"realtime"',
    '"render-out"',
    '"still-capture"',
    '"camera-path"',
    '"scroll-animation"',
    "CaptureScrollOutputFormat",
    '"mp4"',
    '"webm"',
    '"scroll-friendly-video"',
    '"png-sequence"',
    "CaptureScrollQualityPreset",
    '"1080p"',
    '"1440p"',
    '"4k"',
    '"6k"',
    '"8k"',
    "CaptureScrollRangeMode",
    '"full-video"',
    '"frame-range"',
    "CaptureScrollPreviewState",
    '"idle"',
    '"playing"',
    '"paused"',
    "CaptureStillType",
    '"png"',
    '"webp"',
    '"jpeg"',
    "CaptureRenderFidelityMode",
    '"live-preview"',
    '"max-detail-render"',
    "CaptureSaveDestination",
    '"browser-picker"',
    '"download-link"',
    '"external-job"',
  ]) {
    assert.ok(source.includes(expected), `captureTypes should include ${expected}`);
  }
});

test("Capture Director exposes Scroll Animation shell without renderer endpoints", () => {
  const provider = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  const toolbar = readSource("src", "capture", "CaptureDirectorToolbar.tsx");
  for (const expected of [
    "scrollOutputFormat",
    "setScrollOutputFormat",
    "scrollQualityPreset",
    "setScrollQualityPreset",
    "scrollRangeMode",
    "setScrollRangeMode",
    "scrollStartFrame",
    "setScrollStartFrame",
    "scrollEndFrame",
    "setScrollEndFrame",
    "scrollSaveDestination",
    "setScrollSaveDestination",
    "scrollOutputPackageName",
    "setScrollOutputPackageName",
    "scrollAdvancedOpen",
    "setScrollAdvancedOpen",
    "scrollPreviewState",
    "playScrollPreview",
    "pauseScrollPreview",
    "stopScrollPreview",
    "scrollRecordPopoutOpen",
    "setScrollRecordPopoutOpen",
    "lastScrollPackagePath",
    "lastScrollManifestPath",
    "acceptScrollRenderShell",
  ]) {
    assert.ok(provider.includes(expected), `provider should include ${expected}`);
  }
  assert.match(
    provider,
    /const stopScrollPreview = useCallback\(\(\) => \{[\s\S]*const scrollPreviewResetFrame =\s*scrollRangeMode === "frame-range"\s*\?\s*Math\.max\(0,\s*scrollStartFrame\)\s*:\s*0;[\s\S]*setScrollCurrentFrame\(scrollPreviewResetFrame\);[\s\S]*\}, \[scrollRangeMode, scrollStartFrame\]\);/,
    "Stop preview should reset to frame 0 for full-video and selected start for frame-range",
  );
  assert.match(
    provider,
    /if \(panel === "closed"\) \{[\s\S]*setScrollRecordPopoutOpen\(false\);[\s\S]*setScrollPreviewState\("idle"\);[\s\S]*\}/,
    "closing Capture Director should clear transient scroll popout and preview state",
  );
  const panelCloseBlock =
    provider.match(/if \(panel === "closed"\) \{([\s\S]*?)\n      \}/)?.[1] ?? "";
  for (const forbidden of [
    "setLastScrollPackagePath",
    "setLastScrollManifestPath",
  ]) {
    assert.equal(
      panelCloseBlock.includes(forbidden),
      false,
      `panel close must preserve scroll output path state: ${forbidden}`,
    );
  }
  for (const expected of [
    "scroll-animation",
    "Scroll Animation",
    "capture-scroll-panel",
    "capture-scroll-play",
    "capture-scroll-pause",
    "capture-scroll-stop",
    "capture-scroll-record",
    "capture-scroll-record-popout",
    "capture-scroll-advanced-toggle",
    "Accept and Render",
    "Open Output",
    "MP4",
    "WebM",
    "Scroll-Friendly Video",
    "PNG Sequence",
    "1080p",
    "1440p",
    "4K",
    "6K",
    "8K",
    "Full video",
    "Frame range",
    "Format",
    "Quality",
    "Range",
    "Save destination",
    "Output package name",
    "Estimated frame count",
    "Render size",
    "scrollPopoutDialogRef",
    "scrollPopoutRestoreFocusRef",
    "closeScrollRecordPopout",
    "openScrollRecordPopout",
    "getScrollDialogFocusableElements",
    "scrollRecordPopoutOpen &&",
    "scrollPopoutDialogRef.current",
    "event.key === \"Escape\"",
    "event.key !== \"Tab\"",
    "event.shiftKey",
    ".focus()",
    "document.addEventListener(\"keydown\"",
    "document.removeEventListener(\"keydown\"",
    "role=\"dialog\"",
    "aria-modal=\"true\"",
    "tabIndex={-1}",
    "ref={scrollPopoutDialogRef}",
  ]) {
    assert.ok(toolbar.includes(expected), `toolbar should include ${expected}`);
  }
  const scrollStart = toolbar.indexOf('data-testid="capture-scroll-panel"');
  assert.ok(scrollStart >= 0, "scroll panel block should exist");
  const scrollEnd = toolbar.indexOf('panelTestId="capture-camera-path-panel"', scrollStart);
  assert.ok(scrollEnd > scrollStart, "scroll panel block should precede camera path panel");
  const scrollBlock = toolbar.slice(scrollStart, scrollEnd);
  for (const forbidden of [
    "startLocalVideoRenderJob",
    "createExternalVideoRenderJob",
    "/api/capture/render-video",
    "/api/capture/video-output",
    "render-capture-video-job.mjs",
    "capture-video-outputs",
  ]) {
    assert.equal(
      scrollBlock.includes(forbidden),
      false,
      `Scroll Animation UI shell must not call renderer endpoint ${forbidden}`,
    );
  }
});

test("Capture Director scroll animation timeline and handoff package contracts exist", () => {
  const scrollTimelineSource = readSource(
    "src",
    "capture",
    "captureScrollTimeline.ts",
  );
  const scrollPackageSource = readSource(
    "src",
    "capture",
    "scrollHandoffPackage.ts",
  );

  for (const expected of [
    "CaptureScrollTimelineV1",
    "CaptureScrollRecordRequestV1",
    "normalizeCaptureScrollTimeline",
    "validateCaptureScrollTimeline",
    "createScrollRecordRequest",
    "validateScrollRecordRequest",
    "sampleCaptureScrollTimeline",
    "CAPTURE_SCROLL_FPS_OPTIONS",
    "DEFAULT_CAPTURE_SCROLL_FPS",
  ]) {
    assert.ok(scrollTimelineSource.includes(expected), `scroll timeline should include ${expected}`);
  }

  for (const expected of [
    "ScrollHandoffPackageV1",
    "createScrollHandoffManifest",
    "createPendingScrollHandoffManifest",
    "validateScrollHandoffManifest",
    '"complete"',
    '"partial"',
    '"cancelled"',
    '"failed"',
  ]) {
    assert.ok(scrollPackageSource.includes(expected), `scroll package should include ${expected}`);
  }
});

test("Capture Director scroll accept logic creates package diagnostics without renderer endpoints", () => {
  const provider = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  const acceptStart = provider.indexOf("const acceptScrollRenderShell = useCallback");
  const acceptEnd = provider.indexOf("const overlayContext = useCallback", acceptStart);
  assert.ok(acceptStart >= 0, "acceptScrollRenderShell block should exist");
  assert.ok(acceptEnd > acceptStart, "acceptScrollRenderShell block should have a clear end");
  const acceptBlock = provider.slice(acceptStart, acceptEnd);

  for (const expected of [
    "createScrollRecordRequest",
    "validateScrollRecordRequest",
    "createPendingScrollHandoffManifest",
    "DEFAULT_CAPTURE_SCROLL_FPS",
    "deterministicDurationSeconds",
    "pageTimelineDurationSeconds",
    "durationFrames - 1",
    "pageSource",
    "cameraPathPlaybackValidation.valid",
    "cameraSource",
    "setScrollRecordValidationErrors",
    "setLastScrollPackagePath(null)",
    "setLastScrollManifestPath(null)",
    "setError",
    "setScrollRecordPopoutOpen(false)",
    "beginCaptureJob",
    "completeCaptureJob",
    "kind: \"scroll-package\"",
    "request",
    "manifest",
  ]) {
    assert.ok(acceptBlock.includes(expected), `scroll accept should include ${expected}`);
  }

  for (const forbidden of [
    "startLocalVideoRenderJob",
    "createExternalVideoRenderJob",
    "/api/capture/render-video",
    "/api/capture/video-output",
    "render-capture-video-job.mjs",
    "capture-video-outputs",
  ]) {
    assert.equal(
      acceptBlock.includes(forbidden),
      false,
      `scroll accept logic must not call renderer boundary ${forbidden}`,
    );
  }
});

test("Capture Director toolbar renders scroll record validation errors without starting render work", () => {
  const toolbar = readSource("src", "capture", "CaptureDirectorToolbar.tsx");
  assert.ok(
    toolbar.includes("scrollRecordValidationErrors"),
    "toolbar should consume scroll record validation errors",
  );
  assert.ok(
    toolbar.includes("capture-scroll-record-validation-errors"),
    "toolbar should expose a scroll-specific validation error surface",
  );
  assert.ok(
    toolbar.includes("capture-scroll-output-paths"),
    "toolbar should keep displaying accepted scroll output paths",
  );
  assert.ok(
    toolbar.includes("DEFAULT_CAPTURE_SCROLL_FPS"),
    "toolbar scroll frame estimates should use the deterministic scroll FPS",
  );
  assert.ok(
    toolbar.includes("scrollPageBarDurationSeconds"),
    "toolbar scroll frame estimates should reflect enabled Page Bar clips",
  );
});

test("Capture camera path module defines recipe-owned spline helpers", () => {
  const source = readSource("src", "capture", "captureCameraPath.ts");
  for (const expected of [
    "CaptureCameraPathV1",
    "CaptureCameraPathKeyframeV1",
    "CaptureCameraPathSample",
    "validateCaptureCameraPath",
    "normalizeCaptureCameraPath",
    "sampleCaptureCameraPath",
    "createCaptureCameraPathFromKeyframes",
    "moveCaptureCameraPathKeyframe",
    "moveCaptureCameraPathSegment",
    "cameraPathToRecipeKeyframes",
    "recipeKeyframesToCameraPath",
    '"catmull-rom"',
  ]) {
    assert.ok(source.includes(expected), `captureCameraPath should include ${expected}`);
  }
});

test("Capture Camera Path v2 schema separates keyframes, transitions, holds, looks, and focus binding", () => {
  const pathSource = readSource("src", "capture", "captureCameraPathV2.ts");
  const recipeSource = readSource("src", "capture", "captureRecipe.ts");
  for (const expected of [
    "CaptureCameraPathV2",
    "CaptureCameraPathNodeV2",
    "CaptureCameraPathNodeKindV2",
    "CaptureCameraPathSegmentV2",
    "CaptureCameraPathLookModeV2",
    "CaptureCameraPathFocusPointV2",
    "CaptureCameraPathV2Timeline",
    "CaptureCameraPathV2Sample",
    "CaptureCameraPathDisplayOptionsV2",
    "CaptureCameraPathPreviewMonitorModeV2",
    '"keyframe"',
    '"transition"',
    "transitionSeconds",
    "holdSecondsAfter",
    "lookMode",
    "focusPointId",
    "displayOptions",
    "trackColor",
    "trackLineSize",
    "directionRayLength",
    "showCameraFrustum",
    "showLookRays",
    "showFocusLockRays",
    "showNodeLabels",
    "showTimelineGhost",
    "previewMonitorMode",
    "normalizeCaptureCameraPathV2",
    "validateCaptureCameraPathV2",
    "sampleCaptureCameraPathV2",
    "normalizeCaptureCameraPathDisplayOptionsV2",
    "validateCaptureCameraPathDisplayOptionsV2",
    "upgradeCaptureCameraPathV1ToV2",
    "captureCameraPathV2ToLegacyKeyframes",
  ]) {
    assert.ok(pathSource.includes(expected), `captureCameraPathV2 should include ${expected}`);
  }
  for (const expected of [
    "CaptureCameraPathV2",
    "CaptureCameraPathRecipe",
    "cameraPath?: CaptureCameraPathRecipe | null",
    "normalizeCaptureCameraPathV2",
    "validateCaptureCameraPathV2",
  ]) {
    assert.ok(recipeSource.includes(expected), `captureRecipe should include ${expected}`);
  }
});

test("Capture Director provider uses canonical Camera Path v2/v3 modules instead of local duplicate schema", () => {
  const provider = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  for (const expected of [
    'from "./captureCameraPathV2"',
    'from "./captureCameraPathV3"',
    "type CaptureCameraPathV2",
    "type CaptureCameraPathV3",
    "normalizeCaptureCameraPathV2",
    "normalizeCaptureCameraPathV3",
    "validateCaptureCameraPathV2",
    "validateCaptureCameraPathV3Playback",
    "serializeCaptureCameraPathV3",
    "parseCaptureCameraPathV2Json",
    "parseCaptureCameraPathV3Json",
    "cameraPathV2ToRecipeKeyframes",
    "cameraPathV3ToRecipeKeyframes",
    "recipeKeyframesToCameraPathV2",
    "captureCameraPathV3SampledPoints",
    "createCaptureCameraPathV2Recorder",
    "normalizeCaptureCameraPathDisplayOptionsV2",
  ]) {
    assert.ok(provider.includes(expected), `provider should import/use ${expected}`);
  }
  for (const forbidden of [
    "interface CaptureCameraPathV2 {",
    "function normalizeCaptureCameraPathV2(",
    "function validateCaptureCameraPathV2(",
    "function sampleCaptureCameraPathV2(",
    "function cameraPathV2ToRecipeKeyframes(",
    "interface CaptureCameraPathV3 {",
    "function normalizeCaptureCameraPathV3(",
    "function sampleCaptureCameraPathV3(",
  ]) {
    assert.equal(
      provider.includes(forbidden),
      false,
      `provider should not keep a duplicate v2 implementation: ${forbidden}`,
    );
  }
});

test("Capture Director provider exposes Camera Path v3 state, compatibility mirror, and actions", () => {
  const provider = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  for (const expected of [
    "captureCameraPathV2",
    "captureCameraPathV3",
    "cameraPathEquationOverlayOptions",
    "cameraPathDisplayOptions",
    "setCameraPathDisplayOptions",
    "setCameraPathEquationOverlayOptions",
    "cameraPathPreviewMonitor",
    "renderCameraPathPreviewFrame",
    "selectedCameraPathNodeId",
    "setSelectedCameraPathNodeId",
    "selectedCameraPathSegmentId",
    "setSelectedCameraPathSegmentId",
    "cameraPathScrubTimeSeconds",
    "setCameraPathScrubTimeSeconds",
    "cameraPathTimelinePlaying",
    "playCameraPathTimeline",
    "pauseCameraPathTimeline",
    "cameraPathDurationSeconds",
    "addCameraPathKeyframe",
    "addCameraPathTransitionNode",
    "setCameraPathSegmentTransitionSeconds",
    "setCameraPathSegmentTimeCurve",
    "setCameraPathSegmentContinuity",
    "setCameraPathSegmentTension",
    "setCameraPathSegmentBias",
    "setCameraPathSegmentInfluence",
    "setCameraPathNodeHoldSecondsAfter",
    "setCameraPathNodeLookMode",
    "setCameraPathNodeAimGeometry",
    "setCameraPathNodeSplineCoupling",
    "setCameraPathNodeSplineHandleMode",
    "setCameraPathNodeSplineContinuity",
    "setCameraPathNodeSplineHandleLength",
    "bindCameraPathFocusPoint",
    "moveCameraPathTarget",
    "moveCameraPathInfluenceHandle",
    "moveCameraPathSplineHandle",
    "moveCameraPathNodeAxis",
    "moveCameraPathFocusDistanceHandle",
    "startRealtimeCameraPathRecording",
    "stopRealtimeCameraPathRecording",
    "realtimeCameraPathRecording",
    "normalizeCaptureCameraPathV2",
    "validateCaptureCameraPathV2",
    "normalizeCaptureCameraPathV3",
    "serializeCaptureCameraPathV3",
    "parseCaptureCameraPathV2Json",
    "parseCaptureCameraPathV3Json",
    "cameraPathV2ToRecipeKeyframes",
    "cameraPathV3ToRecipeKeyframes",
    "recipeKeyframesToCameraPathV2",
    "captureCameraPathV3SampledPoints",
    "createCaptureCameraPathV2Recorder",
  ]) {
    assert.ok(provider.includes(expected), `provider should include ${expected}`);
  }
  assert.match(
    provider,
    /cameraPath:\s*cameraPathForRecipeSnapshot/,
    "recipe snapshots should pass the v3 cameraPath through the provider",
  );
});

test("Capture Director provider guards Play Path and preview recording with playback validation", () => {
  const provider = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  for (const expected of [
    "const cameraPathPlaybackValidation = useMemo",
    "validateCaptureCameraPathV3Playback(captureCameraPathV3)",
    "const playCameraPath = useCallback((): boolean =>",
    "if (!validation.valid) {",
    "return false;",
    "const startCameraPathPreviewRecording = useCallback(async () =>",
    "await startRecording();",
    "if (!playCameraPath()) {",
    "await stopRecording();",
  ]) {
    assert.ok(provider.includes(expected), `provider should include ${expected}`);
  }
  assert.match(
    provider,
    /const playCameraPath = useCallback\(\(\): boolean => \{[\s\S]*validateCaptureCameraPathV3Playback\(captureCameraPathV3\)[\s\S]*return false;[\s\S]*return true;/,
    "Play Path should reject invalid v3 playback routes before ticking the scene",
  );
  assert.match(
    provider,
    /const startCameraPathPreviewRecording = useCallback\(async \(\) => \{[\s\S]*validateCaptureCameraPathV3Playback\(captureCameraPathV3\)[\s\S]*return;[\s\S]*if \(!playCameraPath\(\)\) \{[\s\S]*await stopRecording\(\);/,
    "Record Path Preview should stop the recorder if playback validation or launch fails",
  );
});

test("Capture Camera Path V3.1 uses node-owned spline controls", () => {
  const source = readSource("src", "capture", "captureCameraPathV3.ts");
  for (const expected of [
    "CaptureCameraPathSplineControlsV3",
    "CaptureCameraPathSplineCouplingV3",
    "splineControls: CaptureCameraPathSplineControlsV3",
    "normalizeCaptureCameraPathSplineControlsV3",
    "upgradeSegmentFairingToNodeSplineControls",
    "resolveCaptureCameraPathBezierSegment",
    "moveCaptureCameraPathSplineHandle",
    "moveCaptureCameraPathNodeAxis",
    "p0",
    "p1",
    "p2",
    "p3",
    "requestedContinuity",
    "effectiveContinuity",
    "derivativeGuardApplied",
    "envelopeGuardApplied",
    "fallbackApplied",
    "warnings",
  ]) {
    assert.ok(source.includes(expected), `V3.1 source should include ${expected}`);
  }
  assert.ok(
    source.includes("from.out") || source.includes('"out"'),
    "V3.1 sampling should read outgoing node handles",
  );
  assert.ok(
    source.includes("to.in") || source.includes('"in"'),
    "V3.1 sampling should read incoming node handles",
  );
  assert.ok(
    source.includes("resolveCaptureCameraPathBezierSegment(path, segment)"),
    "V3.1 runtime sampling should consume the effective Bezier segment resolver",
  );
  assert.ok(
    !source.includes("sampleCaptureCameraPathV3SegmentGeometry"),
    "V3.1 runtime sampling should not use the legacy Hermite segment solver",
  );
});

test("Capture Camera Path V3.1 transition UI surfaces Gx guard warnings", () => {
  const source = readSource("src", "capture", "CameraPathTransitionEditor.tsx");
  for (const expected of [
    "fairingDiagnostics",
    "capture-path-gx-warning",
    "effectiveContinuity",
    "fallbackApplied",
    "derivativeGuardApplied",
    "envelopeGuardApplied",
  ]) {
    assert.ok(source.includes(expected), `CameraPathTransitionEditor should include ${expected}`);
  }
});

test("Capture Director provider flags hidden authoring nodes in overlay metadata while sampling active paths", () => {
  const provider = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  assert.match(
    provider,
    /sampledPoints:\s*captureCameraPathV3SampledPoints\(captureCameraPathV3,\s*192\)/,
    "overlay geometry should use a finer active v3 path sample density",
  );
  assert.match(
    provider,
    /keyframes:\s*captureCameraPathV3\.nodes\.map\(\(node\) => \{[\s\S]*hidden:\s*node\.hidden/,
    "keyframe overlay metadata should flag hidden nodes instead of dropping them",
  );
  assert.match(
    provider,
    /segments:\s*captureCameraPathV3\.segments\.map\(\(segment,\s*index\) => \(\{[\s\S]*hidden:\s*segment\.hidden/,
    "segment overlay metadata should flag hidden segments instead of dropping them",
  );
});

test("Capture Director camera path state remains recipe-only and does not write fixtures", () => {
  const sources = [
    ["captureCameraPath", readSource("src", "capture", "captureCameraPath.ts")],
    ["captureRecipe", readSource("src", "capture", "captureRecipe.ts")],
    [
      "deterministicFrameSequenceExporter",
      readSource("src", "capture", "deterministicFrameSequenceExporter.ts"),
    ],
    ["CaptureDirectorProvider", readSource("src", "capture", "CaptureDirectorProvider.tsx")],
    ["CaptureDirectorToolbar", readSource("src", "capture", "CaptureDirectorToolbar.tsx")],
  ];
  for (const [name, source] of sources) {
    for (const forbidden of [
      "/api/write-batch",
      "write-batch",
      "projects/",
      "overlays/",
      "project.json",
      "environment.json",
      "localStorage",
      "indexedDB",
    ]) {
      assert.ok(
        !source.includes(forbidden),
        `${name} should not persist camera path state through ${forbidden}`,
      );
    }
  }
});

test("Capture Director Playwright specs are split and legacy monolith is not timeout-prone", () => {
  const specDir = join(repoRoot, "tests", "utah-forge");
  const captureSpecs = readdirSync(specDir)
    .filter((name) => /^capture-director.*\.spec\.ts$/.test(name))
    .sort();
  const splitSpecs = captureSpecs.filter((name) => name !== "capture-director.spec.ts");

  assert.ok(
    splitSpecs.length >= 3,
    `Capture Director Playwright coverage should be split across focused specs; found ${captureSpecs.join(", ")}`,
  );
  assert.ok(
    splitSpecs.some((name) => /realtime|preview/.test(name)),
    "split specs should include realtime or preview recording coverage",
  );
  assert.ok(
    splitSpecs.some((name) => /render|still/.test(name)),
    "split specs should include render-out or still capture coverage",
  );
  assert.ok(
    splitSpecs.some((name) => /camera-path/.test(name)),
    "split specs should include Camera Path coverage",
  );

  const legacyPath = join(specDir, "capture-director.spec.ts");
  if (!existsSync(legacyPath)) return;

  const legacySource = readFileSync(legacyPath, "utf8");
  const legacyTestCount = legacySource.match(/\btest\(/g)?.length ?? 0;
  const longTimeouts = [...legacySource.matchAll(/test\.setTimeout\(\s*([0-9_]+)/g)]
    .map((match) => Number(match[1].replaceAll("_", "")))
    .filter((timeoutMs) => timeoutMs > 120_000);
  const allInOneSignals = [
    "Realtime Capture",
    "Render Out",
    "Still Capture",
    "Camera Path",
  ].filter((label) => legacySource.includes(label));

  assert.ok(
    legacyTestCount <= 2,
    "legacy capture-director.spec.ts should be a small smoke wrapper after split specs exist",
  );
  assert.deepEqual(
    longTimeouts,
    [],
    "legacy capture-director.spec.ts should not keep long timeout-prone Playwright tests",
  );
  assert.ok(
    allInOneSignals.length <= 1,
    `legacy capture-director.spec.ts should not remain an all-in-one workflow spec; found ${allInOneSignals.join(", ")}`,
  );
});

test("Capture Director workflow UI is split into task panels", () => {
  const source = readSource("src", "capture", "CaptureDirectorToolbar.tsx");
  const editorRootSource = readSource("src", "editor", "EditorRoot.tsx");
  for (const expected of [
    "capture-director-launcher",
    "Open Capture Director",
    "Close Capture Director",
    "capture-realtime-panel",
    "Realtime Capture",
    "capture-render-panel",
    "Render Out",
    "capture-still-panel",
    "Still Capture",
    "capture-camera-path-panel",
    "Capture Scope",
    "Camera Path",
    "Recipe",
    "Max Detail",
    "No downsampling",
    "capture-scope-select",
    "capture-page-range-start",
    "capture-page-range-end",
    "capture-page-range-timing",
    "capture-page-range-summary",
    "capture-screen-capture-options",
    "capture-screen-type-select",
    "capture-screen-quality-input",
    "capture-screen-location",
    "capture-screen-capture-run",
    "capture-path-save",
    "capture-path-load",
    "capture-path-record-start",
  ]) {
    assert.ok(source.includes(expected), `toolbar should include ${expected}`);
  }
  assert.equal(
    source.includes("Supersample"),
    false,
    "deterministic Render Out UI must not expose downsampling/supersampling controls",
  );
  assert.ok(
    source.includes("CONTROL_BUTTON_SIZE_PX = 36"),
    "Capture Director launcher should match the 36px bottom control stack",
  );
  assert.ok(
    source.includes("CONTROL_STACK_WIDTH_PX"),
    "Capture Director launcher should align to the existing bottom control stack width",
  );
  assert.ok(
    source.includes("editorState.presenterMode"),
    "Capture Director launcher should account for preview mode before choosing its stack position",
  );
  assert.ok(
    source.includes("right: launcherRight"),
    "Capture Director launcher should use the computed stack position, not a fixed offset",
  );
  assert.ok(
    editorRootSource.includes("previewToggleRight"),
    "Preview toggle should reserve a stack slot for Capture Director in editor mode",
  );
  assert.ok(
    editorRootSource.includes("navigatorControlStackWidthPx"),
    "Preview toggle should derive its editor-mode position from the bottom navigator stack width",
  );
  assert.equal(
    editorRootSource.includes("right: presenterMode ? navBottom : navBottom + 132"),
    false,
    "Preview toggle should not keep the old fixed offset that collides with Capture Director",
  );
});

test("Capture Camera Path v2 UI exposes row editors, transition editors, and timeline block ids", () => {
  const source = readSource("src", "capture", "CaptureDirectorToolbar.tsx");
  const providerSource = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  const recipeSource = readSource("src", "capture", "captureRecipe.ts");
  const deterministicExporterSource = readSource(
    "src",
    "capture",
    "deterministicFrameSequenceExporter.ts",
  );
  const displayOptionsSource = readSource("src", "capture", "captureCameraPathV2.ts");
  const lowerTimelineSource = readSource("src", "capture", "CameraPathTimeline.tsx");
  const captureTimelineSource = readSource("src", "capture", "captureTimeline.ts");
  for (const expected of [
    "capture-camera-path-panel",
    "capture-path-options-panel",
    "Camera Path Options",
    'from "./CameraPathLineItemEditor"',
    "<CameraPathLineItemEditor",
    'from "./CameraPathTransitionEditor"',
    "<CameraPathTransitionEditor",
    'from "./CameraPathTimeline"',
    "<CameraPathTimeline",
    "capture-path-track-color",
    "capture-path-selected-color",
    "capture-path-target-color",
    "capture-path-focus-color",
    "capture-path-line-size",
    "capture-path-handle-scale",
    "capture-path-direction-ray-length",
    "capture-path-show-frustum",
    "capture-path-show-look-rays",
    "capture-path-show-focus-rays",
    "capture-path-show-node-labels",
    "capture-path-show-spline-controls",
    "capture-path-show-xyz-handles",
    "capture-path-default-spline-coupling",
    "capture-path-preview-monitor-mode",
    "capture-path-preview-monitor",
    "capture-path-play",
    "capture-path-pause",
    "capture-path-preview-resolution",
    "capture-path-preview-fps",
    "capture-path-record-stop",
    "capture-path-video-download",
    "capture-path-save",
    "capture-path-load",
  ]) {
    assert.ok(source.includes(expected), `toolbar should include ${expected}`);
  }
  for (const expected of [
    "CaptureTimelineState",
    "CaptureTimelinePageClip",
    "createPageClipFromPresentationPage",
    "createPageClipsFromRange",
    "sampleCaptureTimeline",
    "resizeCaptureTimelineBoundary",
  ]) {
    assert.ok(
      captureTimelineSource.includes(expected),
      `capture timeline module should include ${expected}`,
    );
  }
  for (const expected of [
    "captureTimeline",
    "addCurrentPageClip",
    "addPageClip",
    "addPageRangeClips",
    "resizeTimelineBoundary",
    "setTimelineDiagnosticsVisible",
  ]) {
    assert.ok(providerSource.includes(expected), `provider should expose ${expected}`);
  }
  assert.ok(
    recipeSource.includes("captureTimeline?: CaptureTimelineState"),
    "recipes should preserve Capture Director Page Bar timeline state",
  );
  assert.ok(
    providerSource.includes("captureTimeline.pageClips.some") &&
      providerSource.includes("timeOffsetSeconds: clip.startSeconds"),
    "deterministic render-out should sample Page Bar clips on the shared timeline clock",
  );
  assert.ok(
    deterministicExporterSource.includes("timeOffsetSeconds"),
    "deterministic frame exporter should support timeline clock offsets",
  );
  for (const expected of [
    "capture-timeline-pages-lane",
    "capture-timeline-page-add-button",
    "capture-timeline-page-add-menu",
    "capture-timeline-camera-path-lane",
    "capture-timeline-spine-bar",
    "capture-timeline-spine-thumb",
    "capture-timeline-spine-graduation",
    "capture-timeline-time-axis",
    "capture-timeline-time-axis-tick",
    "capture-timeline-time-scale",
    "capture-timeline-time-scale-label",
    "capture-timeline-spine-play",
    "capture-timeline-spine-icon-play",
    "capture-timeline-spine-icon-pause",
    "capture-timeline-camera-scrub-marker",
    "cameraScrubMarkerStyle",
    "timelinePauseIconStyle",
    "timelineSpinePlayButtonStyle",
    "capture-timeline-add-current-camera",
    "capture-timeline-icon-add-camera",
    "capture-timeline-add-group",
    "pageLaneAddButtonStyle",
    "pageLaneContentOffsetPx",
    "setPageAddMenuOpen",
    "timelineScaleForDuration",
    "snapTimelinePercent",
    "snapTimelineBlockPercent",
    "capture-timeline-add-current-page",
    "capture-timeline-add-page-range",
  ]) {
    assert.ok(lowerTimelineSource.includes(expected), `timeline should include ${expected}`);
  }
  assert.ok(
    providerSource.includes("const setCameraPathScrubTimeSeconds = useCallback") &&
      !providerSource.includes(
        "sceneHandle.setCameraPose(sampleCaptureCameraPathV3(captureCameraPathV3, safeSeconds))",
      ),
    "timeline scrub should update the camera-path preview marker without moving the live editor camera",
  );
  for (const expected of [
    "capture-timeline-icon-play",
    "capture-timeline-icon-pause",
    "capture-timeline-icon-record",
  ]) {
    assert.ok(source.includes(expected), `toolbar should include ${expected}`);
  }
  assert.ok(
    lowerTimelineSource.indexOf('data-testid="capture-timeline-spine-bar"') <
      lowerTimelineSource.indexOf('data-testid="capture-timeline-time-axis"') &&
      !lowerTimelineSource.includes('data-testid="capture-timeline-time-graph-lane"') &&
      !lowerTimelineSource.includes("<span>Capture Timeline</span>") &&
      !lowerTimelineSource.includes('data-testid="capture-timeline-timecode"'),
    "timeline should remove the heading/timecode and hide the Time Graph lane",
  );
  assert.ok(
    lowerTimelineSource.includes("left: snapTimelinePercent(") &&
      lowerTimelineSource.includes("width: snapTimelineBlockPercent(") &&
      lowerTimelineSource.includes("snapTimelineDeltaSeconds("),
    "page clips, camera blocks, and time graph curves should align to the shared graduated timeline rail",
  );
  assert.ok(
      lowerTimelineSource.includes("selectTimelineCameraBlock") &&
      lowerTimelineSource.includes("fromNodeId") &&
      lowerTimelineSource.includes("toNodeId") &&
      lowerTimelineSource.includes("forwardBlock") &&
      lowerTimelineSource.includes("candidate.fromNodeId === block.nodeId") &&
      lowerTimelineSource.includes("onScrub(block.startSeconds)") &&
      lowerTimelineSource.includes('data-selected={selected ? "true" : "false"}') &&
      lowerTimelineSource.includes("data-forward-selected") &&
      source.includes("selectedNodeId={selectedCameraPathNodeId ?? selectedCameraPathKeyframeId}") &&
      source.includes("selectedSegmentId={selectedCameraPathSegmentId}") &&
      lowerTimelineSource.includes("onSelectSegment(block.segmentId, nodeId)") &&
      source.includes("onSelectSegment={(id, nodeId) =>"),
    "selecting a camera path transition on the timeline should also select the adjacent camera node",
  );
  assert.ok(
    lowerTimelineSource.includes("data-scale-step") &&
      lowerTimelineSource.includes("data-scale-major-step") &&
      lowerTimelineSource.includes("formatTimelineScaleLabel(") &&
      lowerTimelineSource.includes("timelineRailOffsetStyle") &&
      lowerTimelineSource.includes("width: `calc(100% - ${pageLaneContentOffsetPx}px)`"),
    "timeline scale should expose emergent tick metadata and readable labels as duration changes",
  );
  assert.ok(
    lowerTimelineSource.includes("capture-timeline-time-axis-tick") &&
      lowerTimelineSource.includes("height: graduation.major ? 10 : 5") &&
      !lowerTimelineSource.includes("<span style={laneLabelStyle}>Ruler</span>"),
    "timeline should replace the fake Ruler lane with a real graduated time axis under the scrub bar",
  );
  assert.ok(
    source.includes('data-testid="capture-director-bottom-actions"') &&
      source.includes('data-testid="capture-timeline-transport-actions"') &&
      source.includes('aria-label="Play timeline"') &&
      source.includes('aria-label="Pause timeline"') &&
      source.includes('aria-label="Record path preview"') &&
      source.indexOf('data-testid="capture-recipe-actions"') <
        source.indexOf('data-testid="capture-timeline-transport-actions"') &&
      !lowerTimelineSource.includes('data-testid="capture-timeline-play"') &&
      !lowerTimelineSource.includes('data-testid="capture-timeline-pause"') &&
      !lowerTimelineSource.includes('data-testid="capture-timeline-record-preview"') &&
      lowerTimelineSource.includes('aria-label="Add current camera"') &&
      lowerTimelineSource.includes("cameraPathLaneAddButtonStyle") &&
      lowerTimelineSource.includes("cameraPathLaneContentOffsetPx") &&
      !lowerTimelineSource.includes(">Play<") &&
      !lowerTimelineSource.includes(">Pause<") &&
      !lowerTimelineSource.includes(">Record Preview<"),
    "timeline transport controls should be icon-only footer buttons on the far side of the panel action row",
  );
  assert.ok(
    lowerTimelineSource.indexOf('data-testid="capture-timeline-camera-path-lane"') <
        lowerTimelineSource.indexOf('data-testid="capture-timeline-add-current-camera"') &&
      lowerTimelineSource.indexOf('data-testid="capture-timeline-add-current-camera"') <
        lowerTimelineSource.indexOf('data-testid="capture-timeline-camera-path-content"') &&
      lowerTimelineSource.indexOf('data-testid="capture-timeline-camera-path-content"') <
        lowerTimelineSource.indexOf("{blocks.map((block)") &&
      lowerTimelineSource.includes("left: cameraPathLaneContentOffsetPx") &&
      lowerTimelineSource.includes("right: 0") &&
      lowerTimelineSource.includes("cameraPathLaneAddButtonStyle") &&
      lowerTimelineSource.includes("width: cameraPathLaneContentOffsetPx"),
    "add current camera should live at the start of the Camera Path bar and camera blocks should offset around it",
  );
  assert.ok(
    lowerTimelineSource.includes('aria-label="Open page add options"') &&
      lowerTimelineSource.includes("Current") &&
      lowerTimelineSource.includes("Page") &&
      lowerTimelineSource.includes("Range") &&
      lowerTimelineSource.indexOf('data-testid="capture-timeline-pages-lane"') <
        lowerTimelineSource.indexOf('data-testid="capture-timeline-page-add-button"') &&
      lowerTimelineSource.indexOf('data-testid="capture-timeline-page-add-button"') <
        lowerTimelineSource.indexOf('data-testid="capture-timeline-page-add-menu"') &&
      !lowerTimelineSource.includes(">Add Current<") &&
      !lowerTimelineSource.includes(">Add Page<") &&
      !lowerTimelineSource.includes(">Add Range<") &&
      !lowerTimelineSource.includes(">Show diagnostics<") &&
      !lowerTimelineSource.includes("capture-timeline-show-diagnostics") &&
      !lowerTimelineSource.includes("capture-timeline-duration"),
    "timeline page controls should open from a plus button inside the Pages bar and drop permanent left-rail add clutter",
  );
  assert.ok(
    lowerTimelineSource.includes('pointerEvents: "none"') &&
      lowerTimelineSource.includes('pointerEvents: "auto"') &&
      lowerTimelineSource.includes("zIndex: 36"),
    "timeline shell should not blanket-block other UI and should sit below capture/editor panels",
  );
  assert.ok(
    source.includes("left: 24") &&
      !source.includes("right: 24,\n  top: 76") &&
      source.includes('overflowX: "hidden"') &&
      source.includes("boxSizing: \"border-box\"") &&
      source.includes("const previewMonitorPanelStyle") &&
      source.includes("width: \"100%\"") &&
      source.includes("previewMonitorPanelStyle") &&
      displayOptionsSource.includes('previewMonitorMode: "selected-node"'),
    "Capture Director should dock left and the camera preview monitor should default selected and live in the panel footer",
  );
  assert.ok(
    source.indexOf('data-testid="capture-path-preview-monitor"') <
      source.indexOf('data-testid="capture-director-bottom-actions"') &&
      source.indexOf('data-testid="capture-director-bottom-actions"') <
        source.indexOf("<CameraPathTimeline"),
    "camera preview monitor should render above the icon action row, before the lower timeline",
  );
  assert.ok(
    source.includes("realtime: false") &&
      source.includes("render: false") &&
      source.includes("still: false") &&
      source.includes('"camera-path": false') &&
      source.includes("onAddCurrentCamera={addCurrentCameraKeyframe}"),
    "Capture Director panels should start collapsed and timeline plus button should add the current camera",
  );
  assert.ok(
    providerSource.includes(
      "cameraPathScrubTimeSeconds >= playbackTimeline.durationSeconds - 0.001",
    ) &&
      providerSource.includes("cameraPathPlaybackStartScrubSecondsRef.current = playbackStartSeconds") &&
      lowerTimelineSource.includes('"Play timeline from spine"') &&
      lowerTimelineSource.includes('"Pause timeline from spine"') &&
      lowerTimelineSource.includes('"Play timeline from spine"') &&
      lowerTimelineSource.includes("if (isPlaying)") &&
      lowerTimelineSource.includes("capture-timeline-spine-icon-pause") &&
      source.includes("isPlaying={cameraPathTimelinePlaying}") &&
      source.includes("onPause={stopCameraPathPlayback}") &&
      source.includes("onPlay={playCameraPath}"),
    "timeline play should restart from 0s when the scrubber is already at the end",
  );
  assert.ok(
    source.includes('data-testid="capture-recipe-actions"') &&
      source.includes("const recipeActions") &&
      source.includes('data-testid="capture-director-bottom-actions"') &&
      source.includes("{timelineTransportActions}\n              {recipeActions}") &&
      source.includes('data-testid="capture-save-recipe"') &&
      source.includes('aria-label="Save recipe"') &&
      source.includes('data-testid="capture-load-recipe"') &&
      source.includes('aria-label="Load recipe"') &&
      source.includes('data-testid="capture-clear-recipe"') &&
      source.includes('aria-label="Clear recipe"') &&
      source.includes('testId="capture-recipe-icon-save"') &&
      source.includes('testId="capture-recipe-icon-load"') &&
      source.includes('testId="capture-recipe-icon-trash"') &&
      !source.includes("<span>Recipe</span>") &&
      !source.includes("Current scene") &&
      !source.includes(">Save Recipe<") &&
      !source.includes(">Load Recipe<") &&
      !source.includes(">Clear Recipe<"),
    "recipe controls should be compact icon-only footer actions without visible recipe copy",
  );
  assert.ok(
    lowerTimelineSource.includes("diagnosticsVisible &&"),
    "diagnostic timeline lanes should be hidden by default behind an explicit toggle",
  );

  const lineItemSource = readSource("src", "capture", "CameraPathLineItemEditor.tsx");
  for (const expected of [
    "export function CameraPathLineItemEditor",
    "capture-path-row",
    "data-node-id",
    "capture-path-row-number",
    "capture-path-row-enabled",
    "capture-path-row-hidden",
    "capture-path-node-kind",
    "capture-path-keyframe-hold-time",
    "capture-path-look-mode",
    "capture-path-focus-binding",
    "capture-path-node-spline-mode",
    "capture-path-node-spline-coupling",
    "capture-path-node-spline-continuity",
    "capture-path-node-spline-in",
    "capture-path-node-spline-out",
    "capture-path-row-jump",
    "capture-path-row-set-current",
    "capture-path-row-delete",
    "padStart(2",
  ]) {
    assert.ok(
      lineItemSource.includes(expected),
      `CameraPathLineItemEditor should include ${expected}`,
    );
  }

  const transitionSource = readSource(
    "src",
    "capture",
    "CameraPathTransitionEditor.tsx",
  );
  for (const expected of [
    "export function CameraPathTransitionEditor",
    "capture-path-transition",
    "data-segment-id",
    "capture-path-transition-label",
    "capture-path-transition-enabled",
    "capture-path-transition-hidden",
    "capture-path-transition-duration",
    "capture-path-transition-easing",
    "padStart(2",
  ]) {
    assert.ok(
      transitionSource.includes(expected),
      `CameraPathTransitionEditor should include ${expected}`,
    );
  }

  const timelineSource = readSource("src", "capture", "CameraPathTimeline.tsx");
  for (const expected of [
    "export function CameraPathTimeline",
    "capture-timeline-bar",
    "capture-timeline-scrubber",
    "capture-timeline-time-axis",
    "capture-timeline-playhead",
    "capture-timeline-continuity-marker",
    "capture-timeline-gd-zone",
    "capture-timeline-aim-marker",
    "capture-timeline-hold-block",
    "capture-timeline-transition-block",
    "capture-timeline-block-handle",
    "data-block-id",
    "data-block-kind",
  ]) {
    assert.ok(
      timelineSource.includes(expected),
      `CameraPathTimeline should include ${expected}`,
    );
  }
});

test("Capture Camera Path video preview defaults 4K recording to 30 FPS and preserves end-stop callback", () => {
  const toolbarSource = readSource("src", "capture", "CaptureDirectorToolbar.tsx");
  const providerSource = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  assert.ok(
    toolbarSource.includes('nextId === "marketing-4k"') &&
      toolbarSource.includes("? 30"),
    "4K path-video preview should default to 30 FPS for realtime MediaRecorder viability",
  );
  const startRecordingIndex = providerSource.indexOf(
    "const startCameraPathPreviewRecording",
  );
  const playIndex = providerSource.indexOf("if (!playCameraPath())", startRecordingIndex);
  const callbackIndex = providerSource.indexOf(
    "cameraPathPlaybackCompleteRef.current = () =>",
    playIndex,
  );
  assert.ok(playIndex >= 0, "path video recording should start camera path playback");
  assert.ok(
    callbackIndex > playIndex,
    "path completion callback should be assigned after playCameraPath clears stale callbacks",
  );
});

test("capture page-range helper resolves ordered visible presentation ranges", () => {
  const source = readSource("src", "capture", "capturePageRange.ts");
  for (const expected of [
    "CaptureScope",
    "CapturePageRangeTiming",
    "visibleCapturePages",
    "resolveCapturePageRange",
    "captureScope",
    "pageRangeStartId",
    "pageRangeEndId",
    "pageRangeTiming",
    "equalHoldSeconds",
    "Authored Timing",
    "Page Range",
  ]) {
    assert.ok(source.includes(expected), `capturePageRange should include ${expected}`);
  }
});

test("Screen Capture save options expose file type, quality, and picker routing", () => {
  const source = readSource("src", "capture", "screenCaptureSaveOptions.ts");
  for (const expected of [
    "CaptureStillImageType",
    "CaptureStillSaveOptions",
    "captureStillMimeType",
    "captureStillExtension",
    "normalizeCaptureStillQuality",
    "validateCaptureStillSaveOptions",
    "saveCaptureStillBlobWithPicker",
    "showSaveFilePicker",
    "image/png",
    "image/webp",
    "image/jpeg",
  ]) {
    assert.ok(source.includes(expected), `screenCaptureSaveOptions should include ${expected}`);
  }
});

test("external still render jobs preserve 8K recipe state for out-of-browser rendering", () => {
  const source = readSource("src", "capture", "externalStillRenderJob.ts");
  for (const expected of [
    "ExternalStillRenderJobV1",
    "CaptureStillRenderJobV1",
    'schema: "CaptureStillRenderJobV1"',
    "createExternalStillRenderJob",
    "validateExternalStillRenderJob",
    "externalStillRenderJobFilename",
    "app",
    "recipe",
    "still",
    "tile",
    "overlapPixels: 0",
    "fidelity",
    "max-detail-render",
  ]) {
    assert.ok(source.includes(expected), `externalStillRenderJob should include ${expected}`);
  }
});

test("external 8K still renderer tool exists and exposes a self-test path", () => {
  const toolPath = join(repoRoot, "tools", "render-capture-still-job.mjs");
  assert.ok(existsSync(toolPath), "tools/render-capture-still-job.mjs should exist");
  const source = readFileSync(toolPath, "utf8");
  for (const expected of [
    "--self-test",
    "--synthetic",
    "--out",
    "--app-url",
    "CaptureStillRenderJobV1",
    "computeTilePlan",
    "chromium",
    "sharp",
    "__geoseeCaptureStillRenderer",
    "7680",
    "4320",
    "diagnostics",
    "validateFinalOutput",
  ]) {
    assert.ok(source.includes(expected), `external still tool should include ${expected}`);
  }
});

test("camera path authoring overlay uses Line2 screen-space materials", () => {
  const sceneSource = readSource("src", "scene.ts");
  const helperPath = join(repoRoot, "src", "scene", "captureCameraPathOverlayLine.ts");
  assert.ok(
    existsSync(helperPath),
    "src/scene/captureCameraPathOverlayLine.ts should own Line2 overlay helpers",
  );
  const helperSource = readFileSync(helperPath, "utf8");
  for (const expected of [
    "Line2",
    "LineGeometry",
    "LineMaterial",
    "createCaptureCameraPathLine",
    "disposeCaptureCameraPathOverlayObject",
    "setCaptureCameraPathLineResolution",
    "material.resolution.set",
    "linewidth",
  ]) {
    assert.ok(helperSource.includes(expected), `Line2 helper should include ${expected}`);
  }
  assert.ok(
    sceneSource.includes("createCaptureCameraPathLine"),
    "scene overlay should call the Line2 helper for path/rays",
  );
  assert.ok(
    !sceneSource.includes("const material = new THREE.LineBasicMaterial({\n      color: pathColor"),
    "visible camera path should not use LineBasicMaterial",
  );
  assert.ok(
    sceneSource.includes('renderer: "Line2"'),
    "local test seam should report Line2 overlay construction",
  );
  assert.ok(
    sceneSource.includes("cameraPathPreviewBallColor") &&
      sceneSource.includes("cameraPathPreviewDashColor") &&
      sceneSource.includes("previewDashSegments") &&
      sceneSource.includes("captureCameraPathCurrentSampleMarker") &&
      sceneSource.includes("captureCameraPathCurrentSampleLookDash") &&
      sceneSource.includes("captureCameraPathCurrentSampleTarget"),
    "scrub preview should draw a red camera marker, dashed view ray, and view-point target without moving the live camera",
  );
});

test("camera path V3 equation overlays are typed and authoring-only", () => {
  const sceneSource = readSource("src", "scene.ts");
  const helperSource = readSource("src", "scene", "captureCameraPathOverlayLine.ts");
  for (const expected of [
    "CaptureCameraPathEquationOptions",
    "transitionEquations",
    "tangentHandles",
    "influenceHandles",
    "splineHandles",
    "nodeAxisHandles",
    "curvatureComb",
    "focusDistanceVectors",
    "onMoveInfluenceHandle",
    "onMoveSplineHandle",
    "onMoveNodeAxis",
    "onMoveFocusDistance",
    "onSelectEquationSegment",
    "captureCameraPathEquationSegmentId",
    "captureCameraPathSplineHandleNodeId",
    "captureCameraPathNodeAxisNodeId",
    "options.editable && equationOptions?.visible === true",
  ]) {
    assert.ok(sceneSource.includes(expected), `scene overlay should include ${expected}`);
  }
  for (const expected of [
    "captureCameraPathEquationOverlay",
    "captureCameraPathEquationKind",
    "captureCameraPathEquationLabel",
  ]) {
    assert.ok(helperSource.includes(expected), `Line2 helper should include ${expected}`);
  }
  assert.ok(
    sceneSource.includes("captureCameraPathOverlay.visible = false"),
    "capture output paths should continue hiding camera path authoring overlays",
  );
});

test("browser still tile bridge is local-only and projection-offset based", () => {
  const providerSource = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  const tileSource = readSource("src", "capture", "deterministicStillTileExporter.ts");
  for (const expected of [
    "__geoseeCaptureStillRenderer",
    "captureDirectorLocalTestSeamAllowed",
    "exportDeterministicStillTile",
    "delete window.__geoseeCaptureStillRenderer",
  ]) {
    assert.ok(providerSource.includes(expected), `provider should include ${expected}`);
  }
  for (const expected of [
    "exportDeterministicStillTile",
    "CaptureStillTileRenderResultV1",
    "camera.setViewOffset",
    "camera.clearViewOffset",
    "ctx.translate(-tile.x, -tile.y)",
    "beginCaptureFidelityLock",
    'reason: "external-still"',
    "validateStillTileBlob",
  ]) {
    assert.ok(tileSource.includes(expected), `tile exporter should include ${expected}`);
  }
});

test("scene handle exposes capture sizing and after-render hooks", () => {
  const sceneSource = readSource("src", "scene.ts");
  const postSource = readSource("src", "scene", "postprocessing.ts");
  for (const method of [
    "getCanvas(): HTMLCanvasElement",
    "beginCaptureSize",
    "endCaptureSize",
    "onAfterRender",
    "renderCaptureFrame",
    "getCameraPose",
    "setCameraPose",
    "beginCaptureFidelityLock",
    "endCaptureFidelityLock",
    "setCaptureCameraPathOverlay",
    "clearCaptureCameraPathOverlay",
    "setCaptureCameraPathInteraction",
    "renderCameraPathPreviewFrame",
  ]) {
    assert.ok(sceneSource.includes(method), `SceneHandle should include ${method}`);
  }
  assert.ok(
    sceneSource.includes("afterRenderCallbacks"),
    "scene render loop should own after-render callbacks",
  );
  assert.ok(
    sceneSource.includes("post.composer.render();\n    notifyAfterRenderCallbacks();"),
    "after-render callbacks should run after composer render",
  );
  assert.ok(
    postSource.includes("setPixelRatio(pixelRatio: number): void"),
    "postprocessing handle should expose pixel-ratio updates",
  );
});

test("scene camera path overlay v2 stays runtime-owned and editor-gated", () => {
  const sceneSource = readSource("src", "scene.ts");
  const providerSource = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  const sceneHandleControllersSource = readSource(
    "src",
    "scene",
    "handles",
    "sceneHandleControllers.ts",
  );
  const displayOptionsSource = readSource("src", "capture", "captureCameraPathV2.ts");
  for (const expected of [
    "nodeKind?: \"keyframe\" | \"transition\"",
    "currentSample?: CaptureCameraPathOverlaySample | null",
    "lineSize?: number",
    "directionRayLength?: number",
    "showCameraFrustum?: boolean",
    "showLookRays?: boolean",
    "showCurrentSampleMarker?: boolean",
    "showCurrentSampleLookRay?: boolean",
    "showFocusLockRays?: boolean",
    "showNodeLabels?: boolean",
    "onMoveTarget?: (id: string, target: CaptureVec3) => void",
    "onBindFocusPoint?: (id: string, point: CaptureVec3) => void",
    "captureCameraPathOverlay.name = \"__capture_camera_path_overlay__\"",
    "captureCameraPathOverlayEditable",
    "captureCameraPathTargetKeyframeId",
    "captureCameraPathFocusKeyframeId",
    "cancelCaptureCameraPathInteraction",
    "resolveCaptureCameraPathFocusPoint",
    "captureCameraPathInteraction?.onMoveTarget?.",
    "captureCameraPathInteraction?.onBindFocusPoint?.",
  ]) {
    assert.ok(sceneSource.includes(expected), `scene source should include ${expected}`);
  }
  assert.ok(
    sceneSource.includes("CAPTURE_CAMERA_PATH_WHITE_CROSSHAIR_CURSOR") &&
      sceneSource.includes("setCaptureCameraPathPickCursor") &&
      sceneSource.includes("captureCameraPathFocusBindId()"),
    "camera path focus picking should switch the scene canvas to a white crosshair cursor while waiting for a point",
  );
  assert.ok(
    displayOptionsSource.includes("showCameraFrustum: false"),
    "camera path frustum/extents helper should default off",
  );
  assert.ok(
    sceneSource.includes("CAPTURE_CAMERA_PATH_NODE_MARKER_SCALE = 8"),
    "camera path node markers should be 8x larger than the base handle scale",
  );
  assert.ok(
    sceneSource.includes("CAPTURE_CAMERA_PATH_TRANSITION_MARKER_SCALE = 5.44"),
    "camera path transition markers should keep their relative size at 8x scale",
  );
  assert.ok(
    sceneSource.includes("CAPTURE_CAMERA_PATH_SAMPLE_MARKER_SCALE = 2.44"),
    "moving camera sample marker should be 2x larger than the previous preview marker",
  );
  assert.ok(
    sceneSource.includes("const cameraPathPreviewBallColor = targetColor") &&
      sceneSource.includes("const cameraPathPreviewDashColor = selectedColor") &&
      sceneSource.includes("linewidth: Math.max(1, lineSize * 0.575)"),
    "moving camera sample marker should stay cyan while the scrub view dash uses off-white at half thickness",
  );
  assert.ok(
    sceneSource.includes("CAPTURE_CAMERA_PATH_NODE_FOCAL_LINE_WIDTH_SCALE = 0.8"),
    "node-to-focal rays should be 20% thinner than regular path lines",
  );
  assert.ok(
    sceneSource.includes("captureCameraPathNodeFocalDash") &&
      sceneSource.includes("linewidth: Math.max(1, lineSize * CAPTURE_CAMERA_PATH_NODE_FOCAL_LINE_WIDTH_SCALE)"),
    "node-to-focal rays should be dashed instead of solid",
  );
  assert.ok(
    sceneSource.includes("CAPTURE_CAMERA_PATH_CLOSE_FADE_START_M") &&
      sceneSource.includes("CAPTURE_CAMERA_PATH_CLOSE_FADE_MIN_OPACITY") &&
      sceneSource.includes("captureCameraPathCloseOpacity"),
    "camera path overlay should define a near-camera opacity falloff",
  );
  assert.ok(
    sceneSource.includes("opacity: captureCameraPathCloseOpacity(points, 0.92)") &&
      sceneSource.includes("opacity: captureCameraPathCloseOpacity(dash,"),
    "path and preview direction lines should fade when close to the live camera",
  );
  assert.ok(
    sceneSource.includes("const showCurrentSampleLookRay =") &&
      sceneSource.includes("if (showCurrentSampleLookRay)") &&
      providerSource.includes("showCurrentSampleLookRay: !cameraPathPlaying"),
    "camera path playback should hide the moving preview camera look ray without disabling authored look rays",
  );
  assert.ok(
    sceneSource.includes("const showCurrentSampleMarker =") &&
      sceneSource.includes("if (options.currentSample && showCurrentSampleMarker)") &&
      providerSource.includes("showCurrentSampleMarker: !cameraPathPlaying"),
    "camera path playback should hide the moving preview camera marker from the camera-perspective preview",
  );
  assert.match(
    sceneHandleControllersSource,
    /for \(const marker of this\.globalPageCameraMarkers\.values\(\)\) \{[\s\S]*marker\.group\.visible = false;[\s\S]*if \(this\.pageCameraMarker\) \{[\s\S]*this\.pageCameraMarker\.group\.visible = false;/,
    "page camera markers should remain hidden in the director/editing view",
  );
  assert.match(
    sceneSource,
    /if \(!captureCameraPathOverlay\.visible \|\| !captureCameraPathOverlayEditable\) return null;/,
    "capture path picking should be disabled when editable=false",
  );
  assert.match(
    sceneSource,
    /const sceneTarget = pickSceneTarget\(clientX, clientY\);[\s\S]*pickMapPoint\(clientX, clientY\)/,
    "focus binding should prefer scene target picks and fall back to world points",
  );
  assert.match(
    sceneSource,
    /clearCaptureCameraPathOverlay[\s\S]*cancelCaptureCameraPathInteraction/,
    "clearing the runtime overlay should cancel drags and restore controls",
  );
});

test("scene target picking ignores visual labels during focus binding", () => {
  const sceneSource = readSource("src", "scene.ts");
  assert.ok(
    sceneSource.includes("const isSceneLabelTargetNode =") &&
      sceneSource.includes("isSceneLabelTargetNode(node)"),
    "scene target picking should route all visual label filtering through a shared helper",
  );
  for (const expected of [
    "data.demoBoreholeLabelAnchor === true",
    "data.demoZoneLabelAnchor === true",
    "data.pointMarkerLabelAnchor === true",
    "data.sceneSectionScaleLabel === true",
    "data.naipTileDiagnosticLabel === true",
    "typeof data.captureCameraPathEquationLabel === \"string\"",
    "data.seismicFigureAnnotation === true",
  ]) {
    assert.ok(
      sceneSource.includes(expected),
      `scene target picking should ignore label metadata: ${expected}`,
    );
  }
  assert.match(
    sceneSource,
    /const sceneTarget = pickSceneTarget\(clientX, clientY\);[\s\S]*pickMapPoint\(clientX, clientY\)/,
    "focus binding should still fall back to terrain/world picking after labels are ignored",
  );
});

test("capture modes gate native seismic graph annotations through the scene handle", () => {
  const sceneSource = readSource("src", "scene.ts");
  const providerSource = readSource(
    "src",
    "capture",
    "CaptureDirectorProvider.tsx",
  );
  const stillSource = readSource(
    "src",
    "capture",
    "deterministicStillExporter.ts",
  );
  const frameSource = readSource(
    "src",
    "capture",
    "deterministicFrameSequenceExporter.ts",
  );

  assert.match(sceneSource, /setCaptureNativeAnnotationsVisible/);
  assert.match(sceneSource, /captureNativeAnnotationBaseVisible/);
  assert.match(sceneSource, /seismicFigureAnnotationRoot|seismicFigureAnnotation/);
  assert.match(providerSource, /captureVisibilityProfileForMode/);
  assert.match(
    providerSource,
    /setCaptureNativeAnnotationsVisible\(\s*captureVisibilityProfileForMode\(captureMode\)\.captureNativeAnnotations\s*\)/,
    "realtime capture mode should drive native annotation visibility from capture profiles",
  );
  for (const source of [stillSource, frameSource]) {
    assert.match(source, /captureVisibilityProfileForMode/);
    assert.match(source, /setCaptureNativeAnnotationsVisible/);
    assert.match(
      source,
      /captureVisibilityProfileForMode\(recipe\.mode\)\.captureNativeAnnotations/,
      "deterministic exporters should share profile semantics with realtime capture",
    );
  }
});

test("deterministic frame-sequence exporter owns fixed-timestep browser frames", () => {
  const source = readSource(
    "src",
    "capture",
    "deterministicFrameSequenceExporter.ts",
  );
  for (const expected of [
    "DeterministicFrameSequenceExportOptions",
    "DeterministicFrameSequenceResult",
    "exportDeterministicFrameSequence",
    "getCaptureFrameCount",
    "sampleCaptureRecipeCameraPoseAtFrame",
    "interpolateCaptureCameraKeyframes",
    "applyRecipeLayerState",
    "restoreRecipeLayerState",
    "sceneHandle.beginCaptureSize",
    "sceneHandle.renderCaptureFrame",
    "sceneHandle.endCaptureSize",
    "getCaptureFrameTime(frameIndex, recipe.fps)",
    "supersampleScale",
    "toBlob",
    "renderCaptureOverlay",
    "manager.setVisible",
    "manager.applyStyle",
    "frames: DeterministicFrameSequenceFrame[]",
    "recipe: CaptureRecipeV1",
    "totalFrames: number",
    "url: string",
    "cleanup(): void",
  ]) {
    assert.ok(source.includes(expected), `exporter should include ${expected}`);
  }
  for (const forbidden of [
    "performance.now",
    "Date.now",
    "requestAnimationFrame",
  ]) {
    assert.ok(
      !source.includes(forbidden),
      `deterministic exporter should not use ${forbidden}`,
    );
  }
  assert.match(
    source,
    /Math\.ceil\(recipe\.durationSeconds\s*\*\s*recipe\.fps\)/,
    "frame count should be derived from duration * fps",
  );
  assert.match(
    source,
    /sampleCaptureRecipeCameraPoseAtFrame\(recipe,\s*frameIndex\)/,
    "exporter should sample camera poses from frameIndex and fps",
  );
  assert.match(
    source,
    /if\s*\(\s*recipe\.mode\s*===\s*"full-ui"\s*\)/,
    "deterministic exporter should reject browser display capture mode",
  );
  assert.match(
    source,
    /recipe\.mode\s*===\s*"off"/,
    "deterministic exporter should reject off mode",
  );
  assert.match(
    source,
    /finally\s*{[\s\S]*restoreRecipeLayerState[\s\S]*sceneHandle\.endCaptureSize\(\)/,
    "exporter should restore recipe layer state and capture size in finally",
  );
  assert.match(
    source,
    /recipe\.mode\s*===\s*"scene-annotations"[\s\S]*recipe\.mode\s*===\s*"presentation-ui"[\s\S]*renderCaptureOverlay/,
    "annotation and presentation exports should use capture-native overlays",
  );
});

test("deterministic exporter samples Camera Path v2 from fixed recipe frame time", () => {
  const source = readSource(
    "src",
    "capture",
    "deterministicFrameSequenceExporter.ts",
  );
  assert.ok(
    source.includes("sampleCaptureCameraPathV2"),
    "deterministic exporter should use the v2 camera path sampler",
  );
  assert.match(
    source,
    /sampleCaptureRecipeCameraPoseAtFrame\(recipe,\s*frameIndex\)[\s\S]*getCaptureFrameTime\(frameIndex,\s*recipe\.fps\)/,
    "recipe camera sampling should be derived from frameIndex / fps",
  );
  assert.match(
    source,
    /sampleCaptureCameraPathV2\(\s*recipe\.cameraPath[\s\S]*timeSeconds/,
    "v2 camera path sampling should use fixed recipe time",
  );
});

test("deterministic still exporter owns app-rendered Screen Capture output", () => {
  const source = readSource("src", "capture", "deterministicStillExporter.ts");
  for (const expected of [
    "DeterministicStillExportOptions",
    "DeterministicStillExportResult",
    "exportDeterministicStill",
    "validateStillBlob",
    "sceneHandle.beginCaptureSize",
    "sceneHandle.renderCaptureFrame",
    "sceneHandle.endCaptureSize",
    "applyRecipeLayerState",
    "restoreRecipeLayerState",
    "renderCaptureOverlay",
    "toBlob",
    "Screen Capture",
    "byteLength",
    "renderWidth",
    "renderHeight",
    "supersampleScale",
    "cameraPose",
    "useCurrentSceneState",
    "image/jpeg",
  ]) {
    assert.ok(source.includes(expected), `still exporter should include ${expected}`);
  }
  assert.match(
    source,
    /finally\s*{[\s\S]*restoreRecipeLayerState[\s\S]*sceneHandle\.endCaptureSize\(\)/,
    "still exporter should restore scene state and capture size in finally",
  );
  const providerSource = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  assert.match(
    providerSource,
    /cameraPose:\s*capturePose\(sceneHandle\.camera,\s*sceneHandle\.controls\)[\s\S]*useCurrentSceneState:\s*true/,
    "Screen Capture should save the current editor camera and live scene state instead of replaying page camera/layer state",
  );
});

test("Capture Director decision log records frame-sequence exporter boundary", () => {
  const source = readSource("docs", "03-decisions.md");
  assert.ok(
    source.includes("DEC-120 - Capture frame-sequence exporter writes browser frames"),
    "decision log should record the deterministic frame-sequence exporter boundary",
  );
  assert.ok(
    source.includes("encoder remains deferred"),
    "decision log should keep FFmpeg/WebCodecs encoding deferred",
  );
});

test("frame-sequence video encoder consumes deterministic frames only", () => {
  const source = readSource("src", "capture", "frameSequenceVideoEncoder.ts");
  for (const expected of [
    "CaptureVideoFormat",
    "CaptureVideoEncodePreset",
    "FfmpegFrameSequenceRuntime",
    "CaptureVideoEncodeValidationResult",
    "validateDeterministicFrameSequenceForEncoding",
    "createFfmpegFrameSequenceEncodePlan",
    "buildFfmpegFrameSequenceEncodeArgs",
    "encodeDeterministicFrameSequenceWithFfmpeg",
    "DeterministicFrameSequenceResult",
    "validateCaptureRecipe",
    "mp4-h264-marketing",
    "webm-vp9-marketing",
    "libx264",
    "libvpx-vp9",
    "-framerate",
    "-start_number",
    "yuv420p",
  ]) {
    assert.ok(source.includes(expected), `encoder should include ${expected}`);
  }
  for (const forbidden of [
    "MediaRecorder",
    "getDisplayMedia",
    "captureStream",
    "sceneHandle",
    "renderCaptureFrame",
    "Date.now",
    "performance.now",
    "requestAnimationFrame",
  ]) {
    assert.ok(
      !source.includes(forbidden),
      `video encoder should not use ${forbidden}`,
    );
  }
  assert.match(
    source,
    /sequence\.recipe\.mode\s*===\s*"full-ui"/,
    "encoder should reject full-ui display-capture sequences",
  );
  assert.match(
    source,
    /sequence\.recipe\.mode\s*===\s*"off"/,
    "encoder should reject off-mode sequences",
  );
  assert.match(
    source,
    /Math\.ceil\(sequence\.recipe\.durationSeconds\s*\*\s*sequence\.recipe\.fps\)/,
    "encoder should validate frame count against recipe duration and fps",
  );
});

test("Capture Director decision log records FFmpeg encoder boundary", () => {
  const source = readSource("docs", "03-decisions.md");
  assert.ok(
    source.includes(
      "DEC-121 - Capture frame-sequence encoder consumes deterministic frames",
    ),
    "decision log should record the FFmpeg frame-sequence encoder boundary",
  );
  assert.ok(
    source.includes("does not replace fixed-frame rendering"),
    "decision log should keep encoding downstream of deterministic rendering",
  );
  assert.ok(
    source.includes("browser FFmpeg adapter lazily loads `@ffmpeg/ffmpeg`"),
    "decision log should record browser FFmpeg runtime wiring",
  );
  assert.ok(
    source.includes("deterministic MP4 and WebM export"),
    "decision log should record deterministic MP4/WebM toolbar wiring",
  );
});

test("Capture Director decision log records empty realtime output guard", () => {
  const source = readSource("docs", "03-decisions.md");
  assert.ok(
    source.includes(
      "DEC-122 - Capture preview recorders reject empty realtime output",
    ),
    "decision log should record the empty realtime preview output guard",
  );
  assert.ok(
    source.includes("zero-byte output before creating or keeping a download URL"),
    "decision log should reject empty recorder output as a downloadable artifact",
  );
  assert.ok(
    source.includes("do not silently downgrade realtime preview presets"),
    "decision log should keep 4K preview failures explicit",
  );
});

test("Capture Director decision log records render-out production boundary", () => {
  const source = readSource("docs", "03-decisions.md");
  assert.ok(
    source.includes(
      "DEC-123 - Capture render-out production separates preview from output",
    ),
    "decision log should record the render-out production boundary",
  );
  assert.ok(
    source.includes("Preview recording remains limited to"),
    "decision log should keep 8K out of realtime preview",
  );
  assert.ok(
    source.includes("Browser FFmpeg core assets are self-hosted"),
    "decision log should record self-hosted FFmpeg core assets",
  );
  assert.ok(
    source.includes("portable JSON files"),
    "decision log should record portable recipe save/load",
  );
});

test("Capture Director decision log records Camera Path v2 production contract", () => {
  const source = readSource("docs", "03-decisions.md");
  assert.ok(
    source.includes(
      "DEC-125 - Capture Director Camera Path v2 is recipe-only production state",
    ),
    "decision log should record the Camera Path v2 production contract",
  );
  for (const [pattern, label] of [
    [/keyframe nodes that hold authored camera poses/, "keyframe nodes"],
    [
      /transition nodes that define\s+the motion boundary between keyframes/,
      "transition nodes",
    ],
    [
      /Segment transition time belongs to the\s+segment\/transition node/,
      "segment transition time",
    ],
    [/hold time belongs to the keyframe node/, "keyframe hold time"],
    [
      /Lower\s+timeline scrub and playback sample the same deterministic timeline/,
      "lower timeline scrub and playback",
    ],
    [/Look modes are explicit/, "look modes"],
    [
      /Focus point\s+binding stores recipe references and offsets/,
      "focus point binding",
    ],
    [/Camera Path v2 state is recipe-only/, "recipe-only state"],
    [/must not write `projects\/\*\/pages\/\*\*`/, "no fixture writes"],
    [
      /Render\s+Out must sample camera path time from fixed `frameIndex \/ fps` recipe time/,
      "fixed frame time sampling",
    ],
  ]) {
    assert.match(source, pattern, `decision log should include ${label}`);
  }
});

test("Capture Director decision log records camera track options and preview monitor contract", () => {
  const source = readSource("docs", "03-decisions.md");
  for (const expected of [
    "Capture Director camera track options and preview monitor",
    "track line size",
    "track color",
    "preview monitor",
    "focus-lock",
    "recipe/path JSON",
    "must not write page camera fields",
    "must remain out of exported scene output",
  ]) {
    assert.ok(source.includes(expected), `decision log should include ${expected}`);
  }
});

test("Capture Director decision log records Line2 overlay and external still route", () => {
  const source = readSource("docs", "03-decisions.md");
  for (const expected of [
    "Capture Director Line2 camera overlay and external 8K still route",
    "Line2",
    "CaptureStillRenderJobV1",
    "external/local tiled still",
    "7680 x 4320",
    "Do not leave the Line2 camera-path overlay in exported scene output",
    "ready for visual check",
  ]) {
    assert.ok(source.includes(expected), `decision log should include ${expected}`);
  }
});

test("Capture Director decision log records repaired camera path row workflow", () => {
  const source = readSource("docs", "03-decisions.md");
  const normalizedSource = source.replace(/\s+/g, " ");
  for (const expected of [
    "DEC-128 - Capture Director camera paths use rows, transitions, and timeline blocks",
    "An empty v2 path is valid draft state",
    "`cameraPath: null`",
    "Numbered camera-view rows",
    "Transition containers",
    "hold and transition blocks",
    "`enabled` controls participation in playback",
    "`hidden` controls authoring overlay visibility only",
    "Play Path and Record Path Preview must use v2 playback validation",
  ]) {
    assert.ok(
      normalizedSource.includes(expected),
      `decision log should include ${expected}`,
    );
  }
});

test("Capture Director docs record camera path surfacing directive", () => {
  const decisionLog = readSource("docs", "03-decisions.md");
  const readme = readSource("docs", "capture-director", "README.md");
  const surfacing = readSource(
    "docs",
    "capture-director",
    "camera-path-surfacing-model.md",
  );
  const agentGuide = readSource(
    "docs",
    "capture-director",
    "agent-guide-camera-path-surfacing.md",
  );
  const combined = `${decisionLog}\n${readme}\n${surfacing}\n${agentGuide}`;
  for (const expected of [
    "DEC-129 - Capture Director camera paths separate temporal easing from geometric continuity",
    "DEC-130 - Capture Director Camera Path V3 is a surfacing-aware schema",
    "Current Capture Director UI state upgrades v2 paths into",
    "V2 remains load-compatible",
    "temporal easing",
    "geometric continuity",
    "G0 positional continuity",
    "G1 tangent continuity",
    "G2 curvature continuity",
    "G3 curvature-flow continuity",
    "Gd",
    "CaptureCameraPathV3",
    "timeCurve",
    "pathFairing",
    "aimGeometry",
    "equationOverlayOptions",
    "Do not overload `CaptureCameraPathSegmentV2.easing`",
    "curvature comb",
    "Equation overlays are authoring aids",
  ]) {
    assert.ok(combined.includes(expected), `surfacing docs should include ${expected}`);
  }
});

test("Capture Director docs record Page Bar and subsystem render queue boundary", () => {
  const readme = readSource("docs", "capture-director", "README.md");
  const decisions = readSource("docs", "03-decisions.md");
  for (const expected of [
    "Page Bar",
    "Camera Path is a separate spatial camera spine",
    "shared capture timeline clock",
    "Pages lane",
    "Time Graph lane",
    "diagnostics are hidden by default",
    "external frame queue",
  ]) {
    assert.ok(readme.includes(expected), `README should document ${expected}`);
  }
  assert.ok(
    decisions.includes(
      "DEC-135 - Capture Director Page Bar is the scene datum for camera-spine renders",
    ),
    "decision log should record the Page Bar and camera spine timeline contract",
  );
});

test("browser FFmpeg runtime adapter is lazy and downstream-only", () => {
  const source = readSource("src", "capture", "browserFfmpegRuntime.ts");
  for (const expected of [
    "BrowserFfmpegRuntimeHandle",
    "BrowserFfmpegRuntimeOptions",
    "captureFfmpegCoreAssetUrls",
    "defaultBrowserFfmpegLoadOptions",
    "createBrowserFfmpegFrameSequenceRuntime",
    "loadBrowserFfmpegModule",
    "import(\"@ffmpeg/ffmpeg\")",
    "__captureDirectorFfmpegModule",
    "captureDirectorTestSeamsAllowed",
    "ffmpeg.load",
    "writeFile",
    "exec",
    "readFile",
    "deleteFile",
    "terminate",
    "FfmpegFrameSequenceRuntime",
  ]) {
    assert.ok(source.includes(expected), `runtime adapter should include ${expected}`);
  }
  assert.ok(
    source.includes("/runtime/ffmpeg/ffmpeg-core.js"),
    "browser FFmpeg runtime should default to same-origin coreURL",
  );
  assert.ok(
    source.includes("/runtime/ffmpeg/ffmpeg-core.wasm"),
    "browser FFmpeg runtime should default to same-origin wasmURL",
  );
  assert.ok(
    source.includes("/runtime/ffmpeg/ffmpeg-core.worker.js"),
    "browser FFmpeg runtime should include the same-origin worker URL when present",
  );
  assert.ok(
    !source.includes("unpkg.com"),
    "browser FFmpeg runtime should not rely on CDN core assets",
  );
  for (const forbidden of [
    "MediaRecorder",
    "getDisplayMedia",
    "captureStream",
    "renderCaptureFrame",
    "Date.now",
    "performance.now",
    "requestAnimationFrame",
  ]) {
    assert.ok(
      !source.includes(forbidden),
      `browser FFmpeg runtime should not use ${forbidden}`,
    );
  }
});

test("Vite and package metadata self-host FFmpeg core assets", () => {
  const vite = readSource("vite.config.ts");
  const packageJson = readSource("package.json");
  for (const expected of [
    "copyFfmpegCoreAssetsPlugin",
    "@ffmpeg/core",
    "runtime",
    "ffmpeg",
    "ffmpeg-core.js",
    "ffmpeg-core.wasm",
    "ffmpeg-core.worker.js",
    "Cache-Control",
  ]) {
    assert.ok(vite.includes(expected), `vite config should include ${expected}`);
  }
  assert.ok(
    packageJson.includes('"@ffmpeg/core"'),
    "package.json should declare the self-hosted FFmpeg core dependency",
  );
});

test("Capture Director provider and toolbar expose split realtime and render-out export", () => {
  const provider = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  const toolbar = readSource("src", "capture", "CaptureDirectorToolbar.tsx");
  const compositedRecorder = readSource(
    "src",
    "capture",
    "compositedCaptureRecorder.ts",
  );
  const canvasRecorder = readSource("src", "capture", "canvasPreviewRecorder.ts");
  for (const expected of [
    "exportDeterministicFrameSequence",
    "exportDeterministicStill",
    "createCaptureRecipeFromCurrentState",
    "createBrowserFfmpegFrameSequenceRuntime",
    "encodeDeterministicFrameSequenceWithFfmpeg",
    "effectiveVisibility",
    "effectiveStyle",
    "captureRecipeLayerState",
    "layerVisibility: recipeLayerState.layerVisibility",
    "layerStyles: recipeLayerState.layerStyles",
    "previewResolutionPresetId",
    "setPreviewResolutionPresetId",
    "renderResolutionPresetId",
    "setRenderResolutionPresetId",
    "previewResolution",
    "renderResolution",
    "deterministicDurationSeconds",
    "setDeterministicDurationSeconds",
    "supersampleScale",
    "setSupersampleScale",
    "cameraKeyframes",
    "addCurrentCameraKeyframe",
    "replaceCameraKeyframePose",
    "jumpToCameraKeyframe",
    "removeCameraKeyframe",
    "saveRecipe",
    "loadRecipeFromFile",
    "clearLoadedRecipe",
    "startScreenCapture",
    "screenCaptureStatus",
    "screenCaptureOutputUrl",
    "startDeterministicExport",
    "cancelDeterministicExport",
    "deterministicExportFormat",
    "setDeterministicExportFormat",
    "deterministicExportStatus",
    "deterministicExportProgress",
    "deterministicOutputUrl",
    "deterministicOutputFilename",
    "mp4-h264-marketing",
    "webm-vp9-marketing",
    "cleanupInputFrames: true",
    "deterministicAbortRef",
    "deterministicAbortRef.current?.abort()",
    "__captureDirectorDeterministicDurationSeconds",
    "onFrame",
  ]) {
    assert.ok(provider.includes(expected), `provider should include ${expected}`);
  }
  for (const expected of [
    "Realtime Capture",
    "Render Out",
    "Camera Path",
    "capture-export-format-select",
    "capture-preview-resolution-select",
    "capture-render-resolution-select",
    "capture-export-mp4",
    "capture-screen-capture",
    "capture-screen-capture-options",
    "capture-screen-download",
    "capture-save-recipe",
    "capture-load-recipe",
    "capture-clear-recipe",
    "capture-keyframe-add",
    "capture-keyframe-list",
    "capture-cancel-export",
    "capture-export-state",
    "Render MP4",
    "Render WebM",
    "Download WebM",
    "Cancel Export",
    "deterministicOutputUrl",
    "deterministicOutputFilename",
    "deterministicExportProgress",
    "Rendering",
    "Screen Capture",
  ]) {
    assert.ok(toolbar.includes(expected), `toolbar should include ${expected}`);
  }
  for (const expected of [
    "onUnexpectedStop",
    "onRecorderError",
    "completeRecordingFromResult",
    "failRecordingFromError",
    "deterministicRuntimeHandleRef.current?.dispose()",
  ]) {
    assert.ok(provider.includes(expected), `provider should include ${expected}`);
  }
  for (const expected of ["onDrawError", "stopMediaStreamTracks(stream)"]) {
    assert.ok(
      compositedRecorder.includes(expected),
      `composited recorder should include ${expected}`,
    );
  }
  for (const expected of ["onUnexpectedStop", "onRecorderError", "stopRequested"]) {
    assert.ok(
      canvasRecorder.includes(expected),
      `canvas recorder should include ${expected}`,
    );
  }
  for (const expected of [
    "clearPreviewOutput",
    "outputContext",
    "width: previewResolution.width",
    "height: previewResolution.height",
    "resolution: renderResolution",
    "onAfterRender: sceneHandle.onAfterRender",
  ]) {
    assert.ok(provider.includes(expected), `provider should include ${expected}`);
  }
  assert.ok(
    compositedRecorder.includes("track?.requestFrame?.();"),
    "composited recorder should request an initial frame after recorder start",
  );
});

test("Capture Job Runtime and deterministic path render wiring exist", () => {
  for (const file of [
    "captureJobTypes.ts",
    "captureJobRuntime.ts",
    "captureJobDiagnostics.ts",
  ]) {
    assert.ok(
      existsSync(join(repoRoot, "src", "capture", file)),
      `src/capture/${file} should exist`,
    );
  }
  const types = readSource("src", "capture", "captureJobTypes.ts");
  for (const expected of [
    "CaptureJobKind",
    '"path-preview"',
    '"path-preview-transcode"',
    '"deterministic-video"',
    '"path-video"',
    '"external-video"',
    '"external-still"',
    "CaptureJobStatus",
    '"preparing"',
    '"rendering"',
    '"encoding"',
    '"cancelled"',
    "CaptureJobRecord",
    "AbortController",
  ]) {
    assert.ok(types.includes(expected), `job types should include ${expected}`);
  }
  const runtime = readSource("src", "capture", "captureJobRuntime.ts");
  for (const expected of [
    "createCaptureJobRecord",
    "updateCaptureJobStatus",
    "completeCaptureJob",
    "failCaptureJob",
    "cancelCaptureJob",
    "clearCaptureJobRecord",
    "isCaptureJobRunning",
    "canStartCaptureJob",
    "URL.revokeObjectURL",
  ]) {
    assert.ok(runtime.includes(expected), `job runtime should include ${expected}`);
  }
  const diagnostics = readSource("src", "capture", "captureJobDiagnostics.ts");
  for (const expected of [
    "capturePathJobDiagnostics",
    "captureVideoOutputDiagnostics",
    "mediaRecorder: true",
    "maxDetail: true",
    "renderedFrames",
    "outputByteLength",
  ]) {
    assert.ok(
      diagnostics.includes(expected),
      `job diagnostics should include ${expected}`,
    );
  }
  const provider = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  for (const expected of [
    "captureJobs",
    "activeCaptureJobId",
    "clearCompletedCaptureJob",
    "startPathDeterministicRender",
    "cancelPathDeterministicRender",
    "pathRenderStatus",
    "pathRenderOutputUrl",
    "pathRenderOutputFilename",
    "pathRenderProgress",
    "pathRenderSaveMessage",
    "pathPreviewMp4Status",
    "startPathPreviewMp4Transcode",
    "savePathRenderVideo",
    "savePathPreviewVideo",
    "kind: \"path-preview\"",
    "kind: \"path-preview-transcode\"",
    "kind: \"deterministic-video\"",
    "kind: \"path-video\"",
    "validateCaptureCameraPathV3Playback(captureCameraPathV3)",
    "resolveCaptureCameraPathV3Timeline(captureCameraPathV3)",
    "cameraPath: normalizedPath",
    "captureScope: \"current-page\"",
    "Full UI is not supported for deterministic path video",
    "exportDeterministicFrameSequence",
    "encodeDeterministicFrameSequenceWithFfmpeg",
    "createExternalVideoRenderJob",
    "externalVideoRenderCommand",
    "externalVideoJobUrl",
  ]) {
    assert.ok(provider.includes(expected), `provider should include ${expected}`);
  }
  const toolbar = readSource("src", "capture", "CaptureDirectorToolbar.tsx");
  for (const expected of [
    "Render Path Video",
    "Download Rendered Path Video",
    "Save Rendered Video",
    "Rendered MP4",
    "Rendered WebM",
    "capture-path-render-start",
    "capture-path-render-cancel",
    "capture-path-render-download",
    "capture-path-render-status",
    "capture-path-render-details",
    "Record Path Video",
    "Convert Preview to MP4",
    "Download Preview MP4",
    "Save Preview MP4",
    "No file has been saved yet",
    "Preview WebM",
  ]) {
    assert.ok(toolbar.includes(expected), `toolbar should include ${expected}`);
  }
  const saveOptions = readSource("src", "capture", "captureVideoSaveOptions.ts");
  for (const expected of [
    "saveCaptureVideoBlobWithPicker",
    "showSaveFilePicker",
    "video/mp4",
    "video/webm",
    "validateCaptureVideoBlob",
  ]) {
    assert.ok(
      saveOptions.includes(expected),
      `video save options should include ${expected}`,
    );
  }
  const transcoder = readSource("src", "capture", "previewVideoTranscoder.ts");
  for (const expected of [
    "transcodePreviewVideoToMp4",
    "createPreviewVideoTranscodePlan",
    "libx264",
    "+faststart",
    "Preview MP4 conversion",
  ]) {
    assert.ok(transcoder.includes(expected), `preview transcoder should include ${expected}`);
  }
});

test("4K deterministic video has external job and encoder-stall guardrails", () => {
  const encoder = readSource("src", "capture", "frameSequenceVideoEncoder.ts");
  for (const expected of [
    "CaptureVideoEncodeProgress",
    "stallTimeoutMs",
    "execTimeoutMs",
    "onProgress",
    "Encoding stalled",
    "writing-frames",
    "finalizing",
  ]) {
    assert.ok(encoder.includes(expected), `encoder should include ${expected}`);
  }

  const browserRuntime = readSource("src", "capture", "browserFfmpegRuntime.ts");
  for (const expected of [
    "BrowserFfmpegProgressEvent",
    "onProgress",
    "timeoutMs",
    "activeFfmpeg.on",
    "activeFfmpeg.off",
  ]) {
    assert.ok(browserRuntime.includes(expected), `browser runtime should include ${expected}`);
  }

  const externalVideo = readSource("src", "capture", "externalVideoRenderJob.ts");
  for (const expected of [
    "CaptureVideoRenderJobV1",
    'schema: "CaptureVideoRenderJobV1"',
    "CAPTURE_VIDEO_RENDER_JOB_SCHEMA",
    "createExternalVideoRenderJob",
    "validateExternalVideoRenderJob",
    "serializeExternalVideoRenderJob",
    "parseExternalVideoRenderJobJson",
    "externalVideoRenderJobFilename",
    "externalVideoRenderCommand",
    "recipe.mode full-ui is not supported by external video jobs",
  ]) {
    assert.ok(externalVideo.includes(expected), `external video job should include ${expected}`);
  }

  const localVideoRunner = readSource("src", "capture", "localVideoRenderRunner.ts");
  for (const expected of [
    "startLocalVideoRenderJob",
    "pollLocalVideoRenderJob",
    "cancelLocalVideoRenderJob",
    "/api/capture/render-video",
    "/api/capture/video-status",
    "/api/capture/cancel-video",
    "/api/capture/video-output",
    "localRendererAvailable",
  ]) {
    assert.ok(
      localVideoRunner.includes(expected),
      `local video runner should include ${expected}`,
    );
  }

  const provider = readSource("src", "capture", "CaptureDirectorProvider.tsx");
  for (const expected of [
    "startLocalVideoRenderJob",
    "pollLocalVideoRenderJob",
    "cancelLocalVideoRenderJob",
    "runExternalVideoRenderJob",
    "Local renderer unavailable",
    "External video render complete",
  ]) {
    assert.ok(provider.includes(expected), `provider should include ${expected}`);
  }

  const authorWritePlugin = readSource("plugins", "vite-plugin-author-write.ts");
  for (const expected of [
    "/api/capture/render-video",
    "/api/capture/video-status",
    "/api/capture/cancel-video",
    "/api/capture/video-output",
    "render-capture-video-job.mjs",
    "capture-video-outputs",
  ]) {
    assert.ok(
      authorWritePlugin.includes(expected),
      `Vite local capture runner should include ${expected}`,
    );
  }

  const cli = readSource("tools", "render-capture-video-job.mjs");
  for (const expected of [
    "CaptureVideoRenderJobV1",
    "--synthetic",
    "--keep-frames",
    "ffmpeg-static",
    "FFMPEG_PATH",
    "spawn",
    "frameDiagnostics",
    "CaptureVideoRenderJobDiagnosticsV1",
  ]) {
    assert.ok(cli.includes(expected), `external video CLI should include ${expected}`);
  }
});
