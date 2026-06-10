import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { SceneHandle } from "../scene";
import { useEditor } from "../editor/EditorContext";
import { usePageController } from "../pages/PageController";
import { applyPose, capturePose } from "../pages/capturePose";
import { effectiveStyle, effectiveVisibility } from "../pages/effective";
import type { EditableStyle, EnvironmentSetup, Pose, PresentationPage } from "../pages/types";
import {
  captureRecipeFilename,
  createCaptureRecipeFromCurrentState,
  getCaptureFrameTime,
  normalizeCaptureCameraKeyframes,
  parseCaptureRecipeJson,
  type CaptureCameraKeyframe,
  type CaptureRecipeV1,
} from "./captureRecipe";
import {
  cameraPathToRecipeKeyframes,
  normalizeCaptureCameraPath,
  type CaptureCameraPathV1,
} from "./captureCameraPath";
import {
  cameraPathV2NodeFromPose,
  cameraPathV2ToRecipeKeyframes,
  bindCaptureCameraPathV2FocusPoint,
  captureCameraPathV2ToV1,
  captureCameraPathV2NodeId,
  captureCameraPathV2SegmentId,
  createCaptureCameraPathV2Recorder,
  moveCaptureCameraPathV2NodePosition,
  moveCaptureCameraPathV2NodeTarget,
  moveCaptureCameraPathV2SegmentAdjacentPositions,
  normalizeCaptureCameraPathDisplayOptionsV2,
  normalizeCaptureCameraPathV2,
  parseCaptureCameraPathV2Json,
  recipeKeyframesToCameraPathV2,
  sampleCaptureCameraPathV2,
  setCaptureCameraPathV2NodeEnabled,
  setCaptureCameraPathV2NodeHidden,
  setCaptureCameraPathV2SegmentEasing,
  setCaptureCameraPathV2SegmentEnabled,
  setCaptureCameraPathV2SegmentHidden,
  validateCaptureCameraPathV2,
  type CaptureCameraPathDisplayOptionsV2,
  type CaptureCameraPathLookModeV2,
  type CaptureCameraPathNodeKindV2,
  type CaptureCameraPathV2,
  type CaptureCameraPathV2Recorder,
} from "./captureCameraPathV2";
import {
  captureCameraPathV3Renderable,
  cameraPathV3ToRecipeKeyframes,
  captureCameraPathV3SampledPoints,
  downgradeCaptureCameraPathV3ToV2,
  moveCaptureCameraPathNodeAxis as moveCaptureCameraPathV3NodeAxis,
  moveCaptureCameraPathSplineHandle as moveCaptureCameraPathV3SplineHandle,
  normalizeCaptureCameraPathV3,
  parseCaptureCameraPathV3Json,
  resolveCaptureCameraPathV3Timeline,
  sampleCaptureCameraPathV3,
  serializeCaptureCameraPathV3,
  setCaptureCameraPathNodeSplineContinuity,
  setCaptureCameraPathNodeSplineCoupling,
  setCaptureCameraPathNodeSplineHandle,
  upgradeCaptureCameraPathV2ToV3,
  validateCaptureCameraPathV3Playback,
  type CaptureCameraPathAimGeometryV3,
  type CaptureCameraPathContinuityV3,
  type CaptureCameraPathEquationOverlayOptionsV3,
  type CaptureCameraPathFairingV3,
  type CaptureCameraPathSplineCouplingV3,
  type CaptureCameraPathSplineHandleModeV3,
  type CaptureCameraPathSplineHandleSideV3,
  type CaptureCameraPathTimeCurveV3,
  type CaptureCameraPathV3,
} from "./captureCameraPathV3";
import {
  createCanvasPreviewRecorder,
  selectSupportedMediaRecorderMimeType,
  validateCaptureRecorderBlob,
} from "./canvasPreviewRecorder";
import { createCompositedCaptureRecorder, CompositedCaptureDrawError } from "./compositedCaptureRecorder";
import { createDisplayPreviewRecorder } from "./displayPreviewRecorder";
import { createBrowserFfmpegFrameSequenceRuntime } from "./browserFfmpegRuntime";
import type { BrowserFfmpegRuntimeHandle } from "./browserFfmpegRuntime";
import {
  capturePreviewResolutionPresetById,
  captureRenderResolutionPresetById,
  captureResolutionPresetIdForResolution,
  validateRenderResolutionRequest,
} from "./captureResolution";
import { exportDeterministicFrameSequence } from "./deterministicFrameSequenceExporter";
import type {
  DeterministicFrameSequenceFrame,
  DeterministicFrameSequenceResult,
} from "./deterministicFrameSequenceExporter";
import {
  exportDeterministicStill,
  validateStillBlob,
} from "./deterministicStillExporter";
import { exportDeterministicStillTile } from "./deterministicStillTileExporter";
import { encodeDeterministicFrameSequenceWithFfmpeg } from "./frameSequenceVideoEncoder";
import type {
  ActiveCaptureMode,
  CaptureDeterministicExportFormat,
  CaptureDeterministicExportProgress,
  CaptureDeterministicExportStatus,
  CaptureDirectorPanel,
  CaptureFeatureAvailability,
  CaptureFps,
  CaptureMode,
  CaptureRecorderController,
  CaptureRecorderOutputContext,
  CaptureRecorderResult,
  CaptureRecordingStatus,
  CaptureResolution,
  CapturePreviewResolutionPresetId,
  CaptureRenderResolutionPresetId,
  CaptureScreenCaptureStatus,
} from "./captureTypes";
import {
  resolveCapturePageRange,
  visibleCapturePages,
  type CapturePageRangeResolution,
  type CapturePageRangeTiming,
  type CaptureScope,
} from "./capturePageRange";
import {
  createPageClipFromPresentationPage,
  createPageClipsFromRange,
  normalizeCaptureTimelineState,
  resizeCaptureTimelineBoundary,
  type CaptureTimelineState,
  type CaptureTimelineTrack,
} from "./captureTimeline";
import {
  captureStillFilename,
  captureStillMimeType,
  normalizeCaptureStillQuality,
  saveCaptureStillBlobWithPicker,
  validateCaptureStillSaveOptions,
  type CaptureStillImageType,
} from "./screenCaptureSaveOptions";
import {
  saveCaptureVideoBlobWithPicker,
  validateCaptureVideoBlob,
  type CaptureVideoFileType,
} from "./captureVideoSaveOptions";
import { transcodePreviewVideoToMp4 } from "./previewVideoTranscoder";
import {
  createExternalStillRenderJob,
  externalStillRenderCommand,
  externalStillRenderJobFilename,
  serializeExternalStillRenderJob,
  type CaptureStillRenderJobV1,
  type CaptureStillTileSpec,
} from "./externalStillRenderJob";
import {
  createExternalVideoRenderJob,
  externalVideoRenderCommand,
  externalVideoRenderJobFilename,
  serializeExternalVideoRenderJob,
  shouldDefaultToExternalVideoRenderJob,
  type CaptureVideoRenderJobV1,
} from "./externalVideoRenderJob";
import {
  cancelLocalVideoRenderJob,
  pollLocalVideoRenderJob,
  startLocalVideoRenderJob,
  type LocalVideoRenderRunStatus,
} from "./localVideoRenderRunner";
import {
  capturePathJobDiagnostics,
  captureVideoOutputDiagnostics,
} from "./captureJobDiagnostics";
import {
  cancelCaptureJob,
  canStartCaptureJob,
  clearCaptureJobRecord,
  completeCaptureJob,
  createCaptureJobRecord,
  failCaptureJob,
  isCaptureJobRunning,
  updateCaptureJobProgress,
  updateCaptureJobStatus,
} from "./captureJobRuntime";
import type {
  CaptureJobKind,
  CaptureJobProgress,
  CaptureJobRecord,
  CaptureJobStatus,
} from "./captureJobTypes";

interface CaptureDirectorContextValue {
  directorPanel: CaptureDirectorPanel;
  setDirectorPanel(panel: CaptureDirectorPanel): void;
  captureMode: CaptureMode;
  armedMode: ActiveCaptureMode;
  setArmedMode(mode: ActiveCaptureMode): void;
  previewResolutionPresetId: CapturePreviewResolutionPresetId;
  setPreviewResolutionPresetId(id: CapturePreviewResolutionPresetId): void;
  previewResolution: CaptureResolution;
  renderResolutionPresetId: CaptureRenderResolutionPresetId;
  setRenderResolutionPresetId(id: CaptureRenderResolutionPresetId): void;
  renderResolution: CaptureResolution;
  fps: CaptureFps;
  setFps(fps: CaptureFps): void;
  deterministicDurationSeconds: number;
  setDeterministicDurationSeconds(seconds: number): void;
  supersampleScale: number;
  setSupersampleScale(scale: number): void;
  captureScope: CaptureScope;
  setCaptureScope(scope: CaptureScope): void;
  pageRangeStartId: string | null;
  setPageRangeStartId(pageId: string | null): void;
  pageRangeEndId: string | null;
  setPageRangeEndId(pageId: string | null): void;
  pageRangeTiming: CapturePageRangeTiming;
  setPageRangeTiming(timing: CapturePageRangeTiming): void;
  equalHoldSeconds: number;
  setEqualHoldSeconds(seconds: number): void;
  capturePageOptions: Array<{ id: string; label: string }>;
  capturePageRange: CapturePageRangeResolution;
  captureTimeline: CaptureTimelineState;
  selectedTimelineTrack: CaptureTimelineTrack;
  setSelectedTimelineTrack(track: CaptureTimelineTrack): void;
  addCurrentPageClip(): void;
  addPageClip(pageId: string): void;
  addPageRangeClips(startId: string, endId: string): void;
  removePageClip(clipId: string): void;
  clearPageClips(): void;
  setPageClipEnabled(clipId: string, enabled: boolean): void;
  setPageClipLocked(clipId: string, locked: boolean): void;
  selectPageClip(clipId: string | null): void;
  resizeTimelineBoundary(boundaryId: string, deltaSeconds: number): void;
  setTimelineDiagnosticsVisible(visible: boolean): void;
  cameraKeyframes: CaptureCameraKeyframe[];
  cameraPath: CaptureCameraPathV1;
  captureCameraPathV2: CaptureCameraPathV2;
  captureCameraPathV3: CaptureCameraPathV3;
  cameraPathEquationOverlayOptions: CaptureCameraPathEquationOverlayOptionsV3;
  cameraPathDisplayOptions: CaptureCameraPathDisplayOptionsV2;
  setCameraPathDisplayOptions(
    patch: Partial<CaptureCameraPathDisplayOptionsV2>,
  ): void;
  setCameraPathEquationOverlayOptions(
    patch: Partial<CaptureCameraPathEquationOverlayOptionsV3>,
  ): void;
  cameraPathPreviewMonitor: CaptureCameraPathPreviewMonitorState;
  selectedCameraPathKeyframeId: string | null;
  setSelectedCameraPathKeyframeId(id: string | null): void;
  selectedCameraPathNodeId: string | null;
  setSelectedCameraPathNodeId(id: string | null): void;
  selectedCameraPathSegmentId: string | null;
  setSelectedCameraPathSegmentId(id: string | null): void;
  cameraPathFocusPickNodeId: string | null;
  beginCameraPathFocusPick(nodeId: string): void;
  cameraPathScrubTimeSeconds: number;
  setCameraPathScrubTimeSeconds(seconds: number): void;
  cameraPathTimelinePlaying: boolean;
  playCameraPathTimeline(): void;
  pauseCameraPathTimeline(): void;
  cameraPathDurationSeconds: number;
  cameraPathVisible: boolean;
  setCameraPathVisible(visible: boolean): void;
  cameraPathPlaying: boolean;
  cameraPathPlaybackValidation: { valid: boolean; errors: string[] };
  cameraPathOutputUrl: string | null;
  cameraPathOutputFilename: string | null;
  saveCameraPath(): void;
  loadCameraPathFromFile(file: File): Promise<void>;
  playCameraPath(): boolean;
  stopCameraPathPlayback(): void;
  startCameraPathPreviewRecording(): Promise<void>;
  addCameraPathKeyframe(): void;
  addCameraPathTransitionNode(segmentId?: string | null): void;
  setCameraPathNodeKind(nodeId: string, kind: CaptureCameraPathNodeKindV2): void;
  setCameraPathNodeEnabled(nodeId: string, enabled: boolean): void;
  setCameraPathNodeHidden(nodeId: string, hidden: boolean): void;
  setCameraPathSegmentTransitionSeconds(segmentId: string, seconds: number): void;
  setCameraPathSegmentEnabled(segmentId: string, enabled: boolean): void;
  setCameraPathSegmentHidden(segmentId: string, hidden: boolean): void;
  setCameraPathSegmentEasing(segmentId: string, easing: "linear" | "ease-in-out"): void;
  setCameraPathSegmentTimeCurve(segmentId: string, curve: CaptureCameraPathTimeCurveV3): void;
  setCameraPathSegmentContinuity(
    segmentId: string,
    continuity: CaptureCameraPathContinuityV3,
  ): void;
  setCameraPathSegmentTension(segmentId: string, tension: number): void;
  setCameraPathSegmentBias(segmentId: string, bias: number): void;
  setCameraPathSegmentInfluence(
    segmentId: string,
    edge: "from" | "to",
    influence: number | "auto",
  ): void;
  setCameraPathSegmentAutoHandles(segmentId: string, autoHandles: boolean): void;
  setCameraPathNodeHoldSecondsAfter(nodeId: string, seconds: number): void;
  setCameraPathNodeLookMode(nodeId: string, mode: CaptureCameraPathLookModeV2): void;
  setCameraPathNodeAimGeometry(
    nodeId: string,
    patch: Partial<CaptureCameraPathAimGeometryV3>,
  ): void;
  setCameraPathNodeSplineCoupling(
    nodeId: string,
    coupling: CaptureCameraPathSplineCouplingV3,
  ): void;
  setCameraPathNodeSplineHandleMode(
    nodeId: string,
    mode: CaptureCameraPathSplineHandleModeV3,
  ): void;
  setCameraPathNodeSplineContinuity(
    nodeId: string,
    continuity: CaptureCameraPathContinuityV3,
  ): void;
  setCameraPathNodeSplineHandleLength(
    nodeId: string,
    side: CaptureCameraPathSplineHandleSideV3,
    length: number | "auto",
  ): void;
  bindCameraPathFocusPoint(
    nodeId: string,
    focusPointId: string | null,
    target?: [number, number, number],
  ): void;
  moveCameraPathTarget(nodeId: string, target: [number, number, number]): void;
  moveCameraPathInfluenceHandle(
    segmentId: string,
    edge: "from" | "to",
    distance: number,
  ): void;
  moveCameraPathSplineHandle(
    nodeId: string,
    side: CaptureCameraPathSplineHandleSideV3,
    worldPosition: [number, number, number],
  ): void;
  moveCameraPathNodeAxis(
    nodeId: string,
    axis: "x" | "y" | "z",
    delta: number,
  ): void;
  moveCameraPathFocusDistanceHandle(nodeId: string, distance: number): void;
  realtimeCameraPathRecording: boolean;
  startRealtimeCameraPathRecording(): void;
  stopRealtimeCameraPathRecording(): void;
  addCurrentCameraKeyframe(): void;
  replaceCameraKeyframePose(index: number): void;
  updateCameraKeyframe(index: number, patch: Partial<CaptureCameraKeyframe>): void;
  jumpToCameraKeyframe(index: number): void;
  removeCameraKeyframe(index: number): void;
  clearCameraKeyframes(): void;
  loadedRecipe: CaptureRecipeV1 | null;
  loadedRecipeFilename: string | null;
  recipeOutputUrl: string | null;
  recipeOutputFilename: string | null;
  saveRecipe(): void;
  loadRecipeFromFile(file: File): Promise<void>;
  clearLoadedRecipe(): void;
  recordingStatus: CaptureRecordingStatus;
  isRecording: boolean;
  elapsedSeconds: number;
  outputBlob: Blob | null;
  outputUrl: string | null;
  outputFilename: string | null;
  pathPreviewMp4Status: CaptureJobStatus;
  pathPreviewMp4OutputUrl: string | null;
  pathPreviewMp4OutputFilename: string | null;
  pathPreviewMp4Progress: CaptureJobProgress;
  pathPreviewVideoSaveMessage: string | null;
  deterministicExportStatus: CaptureDeterministicExportStatus;
  isDeterministicExporting: boolean;
  deterministicOutputBlob: Blob | null;
  deterministicOutputUrl: string | null;
  deterministicOutputFilename: string | null;
  deterministicExportFormat: CaptureDeterministicExportFormat;
  setDeterministicExportFormat(format: CaptureDeterministicExportFormat): void;
  deterministicExportProgress: CaptureDeterministicExportProgress;
  screenCaptureStatus: CaptureScreenCaptureStatus;
  screenCaptureOptionsOpen: boolean;
  setScreenCaptureOptionsOpen(open: boolean): void;
  screenCaptureType: CaptureStillImageType;
  setScreenCaptureType(type: CaptureStillImageType): void;
  screenCaptureQuality: number;
  setScreenCaptureQuality(quality: number): void;
  screenCaptureSaveMessage: string | null;
  screenCaptureOutputBlob: Blob | null;
  screenCaptureOutputUrl: string | null;
  screenCaptureOutputFilename: string | null;
  externalStillJobUrl: string | null;
  externalStillJobFilename: string | null;
  externalStillJobCommand: string | null;
  externalVideoJobUrl: string | null;
  externalVideoJobFilename: string | null;
  externalVideoJobCommand: string | null;
  captureJobs: CaptureJobRecord[];
  activeCaptureJobId: string | null;
  pathRenderStatus: CaptureJobStatus;
  pathRenderOutputUrl: string | null;
  pathRenderOutputFilename: string | null;
  pathRenderProgress: CaptureJobProgress;
  pathRenderSaveMessage: string | null;
  error: string | null;
  availability: CaptureFeatureAvailability;
  startRecording(): Promise<void>;
  stopRecording(): Promise<void>;
  startPathPreviewMp4Transcode(): Promise<void>;
  cancelPathPreviewMp4Transcode(): void;
  savePathPreviewVideo(type: CaptureVideoFileType): Promise<void>;
  savePathPreviewMp4(): Promise<void>;
  startDeterministicExport(): Promise<void>;
  startPathDeterministicRender(): Promise<void>;
  cancelPathDeterministicRender(): void;
  savePathRenderVideo(): Promise<void>;
  startScreenCapture(): Promise<void>;
  cancelDeterministicExport(): void;
  clearCompletedCaptureJob(jobId: string): void;
  resetRecording(): void;
}

interface CaptureCameraPathPreviewMonitorState {
  visible: boolean;
  imageUrl: string | null;
  timeSeconds: number;
  label: string | null;
  lookMode: CaptureCameraPathLookModeV2 | "target-blend" | null;
  focusLocked: boolean;
}

const CaptureDirectorContext =
  createContext<CaptureDirectorContextValue | null>(null);

function readAvailability(): CaptureFeatureAvailability {
  const mediaRecorder = typeof MediaRecorder !== "undefined";
  const canvasCaptureStream =
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function";
  const displayCapture =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia;
  return {
    mediaRecorder,
    canvasCaptureStream,
    displayCapture,
    supportedMimeType: selectSupportedMediaRecorderMimeType(),
  };
}

function formatCaptureError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Capture recording failed.";
}

// Reduce a verbose ANGLE renderer string to the GPU name, e.g.
// "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti SUPER ... D3D11)" -> "RTX 4070 Ti SUPER".
function shortGpuName(renderer: string): string {
  if (/swiftshader|software|llvmpipe/i.test(renderer)) return "software (no GPU)";
  const model = renderer.match(/(?:GeForce |Radeon |Arc )([^(,]+)/);
  if (model?.[1]) return model[1].trim();
  return renderer.length > 40 ? `${renderer.slice(0, 37)}…` : renderer;
}

function recorderOutputContextForMode({
  mode,
  resolution,
  fps,
}: {
  mode: ActiveCaptureMode;
  resolution: CaptureResolution;
  fps: CaptureFps;
}): CaptureRecorderOutputContext {
  return {
    mode,
    fps,
    ...(mode === "full-ui"
      ? {}
      : {
          width: resolution.width,
          height: resolution.height,
        }),
  };
}

const DETERMINISTIC_EXPORT_DURATION_SECONDS = 4;

declare global {
  interface Window {
    __captureDirectorDeterministicDurationSeconds?: number;
    __captureDirectorCapabilitiesOverride?: {
      maxTextureSize?: number;
      maxRenderbufferSize?: number;
    };
    __geoseeCaptureStillRenderer?: {
      renderTile(
        job: CaptureStillRenderJobV1,
        tile: CaptureStillTileSpec,
        frameIndex?: number,
      ): ReturnType<typeof exportDeterministicStillTile>;
      capabilities(): ReturnType<SceneHandle["getCaptureCapabilities"]> & {
        supportsViewOffsetTiles: true;
      };
    };
  }
}

function captureDirectorLocalTestSeamAllowed(): boolean {
  const env = (import.meta as ImportMeta & {
    env?: { DEV?: boolean; MODE?: string };
  }).env;
  return (
    env?.DEV ||
    env?.MODE === "test" ||
    (typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname === "::1"))
  );
}

function deterministicExportDurationSeconds(): number {
  const testSeamAllowed = captureDirectorLocalTestSeamAllowed();
  const override =
    typeof window !== "undefined" && testSeamAllowed
      ? window.__captureDirectorDeterministicDurationSeconds
      : undefined;
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return Math.min(override, DETERMINISTIC_EXPORT_DURATION_SECONDS);
  }
  return DETERMINISTIC_EXPORT_DURATION_SECONDS;
}

function captureCapabilitiesForPreflight(sceneHandle: SceneHandle): {
  maxTextureSize: number;
  maxRenderbufferSize: number;
} {
  const base = sceneHandle.getCaptureCapabilities();
  if (
    typeof window === "undefined" ||
    !captureDirectorLocalTestSeamAllowed() ||
    !window.__captureDirectorCapabilitiesOverride
  ) {
    return base;
  }
  const override = window.__captureDirectorCapabilitiesOverride;
  return {
    maxTextureSize:
      typeof override.maxTextureSize === "number" &&
      Number.isFinite(override.maxTextureSize)
        ? override.maxTextureSize
        : base.maxTextureSize,
    maxRenderbufferSize:
      typeof override.maxRenderbufferSize === "number" &&
      Number.isFinite(override.maxRenderbufferSize)
        ? override.maxRenderbufferSize
        : base.maxRenderbufferSize,
  };
}

function cloneCaptureLayerStyle(style: EditableStyle): Record<string, unknown> {
  return { ...style };
}

function captureRecipeLayerState({
  environment,
  page,
  layerIds,
}: {
  environment: EnvironmentSetup;
  page: PresentationPage | null;
  layerIds: readonly string[];
}): {
  layerVisibility: Record<string, boolean>;
  layerStyles: Record<string, unknown>;
} {
  const allLayerIds = new Set<string>([
    ...layerIds,
    ...Object.keys(environment.layerStyles ?? {}),
    ...(page ? Object.keys(page.layerOverrides ?? {}) : []),
  ]);
  const visible = page
    ? effectiveVisibility(environment, page)
    : new Set(environment.defaultVisibleLayers);
  const layerVisibility: Record<string, boolean> = {};
  const layerStyles: Record<string, unknown> = {};
  for (const layerId of allLayerIds) {
    layerVisibility[layerId] = visible.has(layerId);
    const style = page
      ? effectiveStyle(environment, page, layerId)
      : (environment.layerStyles[layerId] ?? {});
    layerStyles[layerId] = cloneCaptureLayerStyle(style);
  }
  return { layerVisibility, layerStyles };
}

function captureKeyframeEasing(
  easing: PresentationPage["transition"]["easing"] | undefined,
): CaptureCameraKeyframe["easing"] {
  return easing === "linear" ? "linear" : "ease-in-out";
}

function clonePoseForCapture(pose: Pose): Pose {
  return {
    position: [...pose.position],
    target: [...pose.target],
    up: [...pose.up],
    fov: pose.fov,
  };
}

function pageRangeSegmentCameraKeyframes({
  page,
  previousPage,
  durationSeconds,
  timing,
}: {
  page: PresentationPage;
  previousPage: PresentationPage | null;
  durationSeconds: number;
  timing: CapturePageRangeTiming;
}): CaptureCameraKeyframe[] {
  if (timing !== "authored" || !previousPage) return [];
  const transitionSeconds = Math.max(0, (page.transition.duration ?? 0) / 1000);
  if (transitionSeconds <= 0) return [];
  const keyframes: CaptureCameraKeyframe[] = [
    {
      timeSeconds: 0,
      camera: clonePoseForCapture(previousPage.camera),
      easing: captureKeyframeEasing(page.transition.easing),
    },
    {
      timeSeconds: Math.min(transitionSeconds, durationSeconds),
      camera: clonePoseForCapture(page.camera),
      easing: captureKeyframeEasing(page.transition.easing),
    },
  ];
  if (durationSeconds - transitionSeconds > 0.000_001) {
    keyframes.push({
      timeSeconds: durationSeconds,
      camera: clonePoseForCapture(page.camera),
      easing: "linear",
    });
  }
  return keyframes;
}

function combineDeterministicSequences({
  recipe,
  sequences,
}: {
  recipe: CaptureRecipeV1;
  sequences: DeterministicFrameSequenceResult[];
}): DeterministicFrameSequenceResult {
  const first = sequences[0];
  if (!first) {
    throw new Error("Page Range export did not produce any frames.");
  }
  const frames: DeterministicFrameSequenceFrame[] = [];
  for (const sequence of sequences) {
    for (const frame of sequence.frames) {
      const frameIndex = frames.length;
      frames.push({
        ...frame,
        frameIndex,
        timeSeconds: getCaptureFrameTime(frameIndex, recipe.fps),
      });
    }
  }
  const durationSeconds = frames.length / recipe.fps;
  return {
    recipe: {
      ...recipe,
      durationSeconds,
    },
    frames,
    totalFrames: frames.length,
    width: first.width,
    height: first.height,
    renderWidth: first.renderWidth,
    renderHeight: first.renderHeight,
    fps: recipe.fps,
    durationSeconds,
    supersampleScale: first.supersampleScale,
    cleanup() {
      for (const sequence of sequences) {
        sequence.cleanup();
      }
    },
  };
}

export function CaptureDirectorProvider({
  sceneHandle,
  children,
}: {
  sceneHandle: SceneHandle;
  children: ReactNode;
}) {
  const { state } = useEditor();
  const { pages, currentIndex } = usePageController();
  const [captureMode, setCaptureMode] = useState<CaptureMode>("off");
  const [directorPanel, setDirectorPanelState] =
    useState<CaptureDirectorPanel>("closed");
  const [armedMode, setArmedModeState] =
    useState<ActiveCaptureMode>("scene-only");
  const [previewResolutionPresetId, setPreviewResolutionPresetId] =
    useState<CapturePreviewResolutionPresetId>("preview-1080");
  const [renderResolutionPresetId, setRenderResolutionPresetId] =
    useState<CaptureRenderResolutionPresetId>("marketing-4k");
  const [fps, setFps] = useState<CaptureFps>(30);
  const [deterministicDurationSeconds, setDeterministicDurationSecondsState] =
    useState(() => deterministicExportDurationSeconds());
  const [supersampleScale, setSupersampleScaleState] = useState(1);
  const [captureScope, setCaptureScope] = useState<CaptureScope>("current-page");
  const [pageRangeStartId, setPageRangeStartId] = useState<string | null>(null);
  const [pageRangeEndId, setPageRangeEndId] = useState<string | null>(null);
  const [pageRangeTiming, setPageRangeTiming] =
    useState<CapturePageRangeTiming>("authored");
  const [equalHoldSeconds, setEqualHoldSecondsState] = useState(4);
  const [captureTimeline, setCaptureTimeline] = useState<CaptureTimelineState>(
    () => normalizeCaptureTimelineState(null),
  );
  const [selectedTimelineTrack, setSelectedTimelineTrack] =
    useState<CaptureTimelineTrack>("camera-path");
  const [cameraKeyframes, setCameraKeyframes] = useState<CaptureCameraKeyframe[]>([]);
  const [captureCameraPathV2, setCaptureCameraPathV2] = useState<CaptureCameraPathV2>(
    () =>
      normalizeCaptureCameraPathV2({
        version: 2,
        id: "capture-camera-path-v2",
        name: "Camera Path",
        loop: false,
        timeline: { durationSeconds: deterministicExportDurationSeconds() },
        displayOptions: normalizeCaptureCameraPathDisplayOptionsV2(null),
        focusPoints: [],
        nodes: [],
        segments: [],
      }),
  );
  const [captureCameraPathV3, setCaptureCameraPathV3] = useState<CaptureCameraPathV3>(
    () =>
      upgradeCaptureCameraPathV2ToV3(
        normalizeCaptureCameraPathV2({
          version: 2,
          id: "capture-camera-path-v2",
          name: "Camera Path",
          loop: false,
          timeline: { durationSeconds: deterministicExportDurationSeconds() },
          displayOptions: normalizeCaptureCameraPathDisplayOptionsV2(null),
          focusPoints: [],
          nodes: [],
          segments: [],
        }),
      ),
  );
  const [cameraPathDisplayOptions, setCameraPathDisplayOptionsState] =
    useState<CaptureCameraPathDisplayOptionsV2>(() =>
      normalizeCaptureCameraPathDisplayOptionsV2(null),
    );
  const [cameraPathPreviewMonitor, setCameraPathPreviewMonitor] =
    useState<CaptureCameraPathPreviewMonitorState>({
      visible: false,
      imageUrl: null,
      timeSeconds: 0,
      label: null,
      lookMode: null,
      focusLocked: false,
    });
  const [selectedCameraPathKeyframeId, setSelectedCameraPathKeyframeId] =
    useState<string | null>(null);
  const [selectedCameraPathNodeId, setSelectedCameraPathNodeId] =
    useState<string | null>(null);
  const [selectedCameraPathSegmentId, setSelectedCameraPathSegmentId] =
    useState<string | null>(null);
  const [cameraPathFocusPickNodeId, setCameraPathFocusPickNodeId] =
    useState<string | null>(null);
  const [cameraPathScrubTimeSeconds, setCameraPathScrubTimeSecondsState] =
    useState(0);
  const [cameraPathTimelinePlaying, setCameraPathTimelinePlaying] = useState(false);
  const [realtimeCameraPathRecording, setRealtimeCameraPathRecording] =
    useState(false);
  const [cameraPathVisible, setCameraPathVisible] = useState(true);
  const [cameraPathPlaying, setCameraPathPlaying] = useState(false);
  const [loadedRecipe, setLoadedRecipe] = useState<CaptureRecipeV1 | null>(null);
  const [loadedRecipeFilename, setLoadedRecipeFilename] = useState<string | null>(null);
  const [recipeOutputUrl, setRecipeOutputUrl] = useState<string | null>(null);
  const [recipeOutputFilename, setRecipeOutputFilename] = useState<string | null>(null);
  const [cameraPathOutputUrl, setCameraPathOutputUrl] = useState<string | null>(null);
  const [cameraPathOutputFilename, setCameraPathOutputFilename] =
    useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] =
    useState<CaptureRecordingStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState<string | null>(null);
  const [pathPreviewMp4OutputBlob, setPathPreviewMp4OutputBlob] =
    useState<Blob | null>(null);
  const [pathPreviewMp4OutputUrl, setPathPreviewMp4OutputUrl] =
    useState<string | null>(null);
  const [pathPreviewMp4OutputFilename, setPathPreviewMp4OutputFilename] =
    useState<string | null>(null);
  const [pathPreviewVideoSaveMessage, setPathPreviewVideoSaveMessage] =
    useState<string | null>(null);
  const [deterministicExportStatus, setDeterministicExportStatus] =
    useState<CaptureDeterministicExportStatus>("idle");
  const [deterministicOutputBlob, setDeterministicOutputBlob] =
    useState<Blob | null>(null);
  const [deterministicOutputUrl, setDeterministicOutputUrl] =
    useState<string | null>(null);
  const [deterministicOutputFilename, setDeterministicOutputFilename] =
    useState<string | null>(null);
  const [deterministicExportFormat, setDeterministicExportFormat] =
    useState<CaptureDeterministicExportFormat>("mp4");
  const [deterministicExportProgress, setDeterministicExportProgress] =
    useState<CaptureDeterministicExportProgress>({
      renderedFrames: 0,
      totalFrames: 0,
    });
  const [screenCaptureStatus, setScreenCaptureStatus] =
    useState<CaptureScreenCaptureStatus>("idle");
  const [screenCaptureOptionsOpen, setScreenCaptureOptionsOpen] = useState(false);
  const [screenCaptureType, setScreenCaptureType] =
    useState<CaptureStillImageType>("png");
  const [screenCaptureQuality, setScreenCaptureQualityState] = useState(0.92);
  const [screenCaptureSaveMessage, setScreenCaptureSaveMessage] = useState<
    string | null
  >(null);
  const [screenCaptureOutputBlob, setScreenCaptureOutputBlob] =
    useState<Blob | null>(null);
  const [screenCaptureOutputUrl, setScreenCaptureOutputUrl] =
    useState<string | null>(null);
  const [screenCaptureOutputFilename, setScreenCaptureOutputFilename] =
    useState<string | null>(null);
  const [externalStillJobUrl, setExternalStillJobUrl] = useState<string | null>(null);
  const [externalStillJobFilename, setExternalStillJobFilename] =
    useState<string | null>(null);
  const [externalStillJobCommand, setExternalStillJobCommand] =
    useState<string | null>(null);
  const [externalVideoJobUrl, setExternalVideoJobUrl] = useState<string | null>(null);
  const [externalVideoJobFilename, setExternalVideoJobFilename] =
    useState<string | null>(null);
  const [externalVideoJobCommand, setExternalVideoJobCommand] =
    useState<string | null>(null);
  const [captureJobs, setCaptureJobs] = useState<CaptureJobRecord[]>([]);
  const [activeCaptureJobId, setActiveCaptureJobId] = useState<string | null>(null);
  const [pathRenderOutputBlob, setPathRenderOutputBlob] =
    useState<Blob | null>(null);
  const [pathRenderOutputUrl, setPathRenderOutputUrl] =
    useState<string | null>(null);
  const [pathRenderOutputFilename, setPathRenderOutputFilename] =
    useState<string | null>(null);
  const [pathRenderSaveMessage, setPathRenderSaveMessage] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] =
    useState<CaptureFeatureAvailability>(() => readAvailability());
  const recorderRef = useRef<CaptureRecorderController | null>(null);
  const captureSizedRef = useRef(false);
  const elapsedTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const outputUrlRef = useRef<string | null>(null);
  const pathPreviewMp4OutputCleanupRef = useRef<(() => void) | null>(null);
  const deterministicOutputCleanupRef = useRef<(() => void) | null>(null);
  const screenCaptureOutputCleanupRef = useRef<(() => void) | null>(null);
  const externalStillJobUrlRef = useRef<string | null>(null);
  const externalVideoJobUrlRef = useRef<string | null>(null);
  const recipeOutputUrlRef = useRef<string | null>(null);
  const cameraPathOutputUrlRef = useRef<string | null>(null);
  const pathRenderOutputCleanupRef = useRef<(() => void) | null>(null);
  const cameraPathPlaybackUnsubscribeRef = useRef<(() => void) | null>(null);
  const cameraPathPlaybackStartMsRef = useRef<number | null>(null);
  const cameraPathPlaybackStartScrubSecondsRef = useRef(0);
  const cameraPathPlaybackCompleteRef = useRef<(() => void) | null>(null);
  const realtimeCameraPathRecorderRef = useRef<CaptureCameraPathV2Recorder | null>(
    null,
  );
  const pathPreviewJobIdRef = useRef<string | null>(null);
  const pathPreviewMp4AbortRef = useRef<AbortController | null>(null);
  const deterministicAbortRef = useRef<AbortController | null>(null);
  const pathRenderAbortRef = useRef<AbortController | null>(null);
  const deterministicLocalVideoRunIdRef = useRef<string | null>(null);
  const pathRenderLocalVideoRunIdRef = useRef<string | null>(null);
  const pathRenderEncodingTimerRef = useRef<number | null>(null);
  const deterministicRuntimeHandleRef =
    useRef<BrowserFfmpegRuntimeHandle | null>(null);
  const pathPreviewMp4RuntimeHandleRef =
    useRef<BrowserFfmpegRuntimeHandle | null>(null);
  const pathRenderRuntimeHandleRef =
    useRef<BrowserFfmpegRuntimeHandle | null>(null);
  const isRecording =
    recordingStatus === "preparing" ||
    recordingStatus === "recording" ||
    recordingStatus === "stopping";
  const isDeterministicExporting =
    deterministicExportStatus === "rendering" ||
    deterministicExportStatus === "encoding";
  const previewResolution =
    capturePreviewResolutionPresetById(previewResolutionPresetId);
  const renderResolution =
    captureRenderResolutionPresetById(renderResolutionPresetId);
  const currentPage = pages[currentIndex] ?? null;
  const capturePageOptions = useMemo(
    () =>
      visibleCapturePages(pages).map((page, index) => ({
        id: page.id,
        label: `${String(index + 1).padStart(2, "0")} ${page.title}`,
      })),
    [pages],
  );
  const capturePageRange = useMemo(
    () =>
      resolveCapturePageRange({
        pages,
        currentPageId: currentPage?.id ?? null,
        captureScope,
        pageRangeStartId,
        pageRangeEndId,
        pageRangeTiming,
        equalHoldSeconds,
        fps,
        currentPageDurationSeconds: deterministicDurationSeconds,
      }),
    [
      captureScope,
      currentPage?.id,
      deterministicDurationSeconds,
      equalHoldSeconds,
      fps,
      pageRangeEndId,
      pageRangeStartId,
      pageRangeTiming,
      pages,
    ],
  );
  const appendPageClips = useCallback(
    (clips: ReturnType<typeof createPageClipsFromRange>) => {
      if (clips.length === 0) return;
      setCaptureTimeline((previous) => {
        const normalized = normalizeCaptureTimelineState(previous);
        const suffixBase = normalized.pageClips.length + 1;
        const appended = clips.map((clip, index) => ({
          ...clip,
          id: `${clip.id}:${suffixBase + index}`,
        }));
        return normalizeCaptureTimelineState({
          ...normalized,
          pageClips: [...normalized.pageClips, ...appended],
          selectedPageClipId: appended[0]?.id ?? normalized.selectedPageClipId,
        });
      });
      setSelectedTimelineTrack("pages");
    },
    [],
  );
  const addCurrentPageClip = useCallback(() => {
    if (!currentPage) return;
    const clip = createPageClipFromPresentationPage(currentPage, {
      timing: pageRangeTiming,
      equalHoldSeconds,
    });
    appendPageClips([clip]);
  }, [appendPageClips, currentPage, equalHoldSeconds, pageRangeTiming]);
  const addPageClip = useCallback(
    (pageId: string) => {
      const page = pages.find((entry) => entry.id === pageId);
      if (!page) return;
      const clip = createPageClipFromPresentationPage(page, {
        timing: pageRangeTiming,
        equalHoldSeconds,
      });
      appendPageClips([clip]);
    },
    [appendPageClips, equalHoldSeconds, pageRangeTiming, pages],
  );
  const addPageRangeClips = useCallback(
    (startId: string, endId: string) => {
      appendPageClips(
        createPageClipsFromRange(pages, startId, endId, {
          timing: pageRangeTiming,
          equalHoldSeconds,
        }),
      );
    },
    [appendPageClips, equalHoldSeconds, pageRangeTiming, pages],
  );
  const removePageClip = useCallback((clipId: string) => {
    setCaptureTimeline((previous) => {
      const normalized = normalizeCaptureTimelineState(previous);
      return normalizeCaptureTimelineState({
        ...normalized,
        pageClips: normalized.pageClips.filter((clip) => clip.id !== clipId),
        selectedPageClipId:
          normalized.selectedPageClipId === clipId
            ? null
            : normalized.selectedPageClipId,
      });
    });
  }, []);
  const clearPageClips = useCallback(() => {
    setCaptureTimeline((previous) =>
      normalizeCaptureTimelineState({
        ...previous,
        pageClips: [],
        selectedPageClipId: null,
      }),
    );
  }, []);
  const setPageClipEnabled = useCallback((clipId: string, enabled: boolean) => {
    setCaptureTimeline((previous) => {
      const normalized = normalizeCaptureTimelineState(previous);
      return normalizeCaptureTimelineState({
        ...normalized,
        pageClips: normalized.pageClips.map((clip) =>
          clip.id === clipId ? { ...clip, enabled } : clip,
        ),
      });
    });
  }, []);
  const setPageClipLocked = useCallback((clipId: string, locked: boolean) => {
    setCaptureTimeline((previous) => {
      const normalized = normalizeCaptureTimelineState(previous);
      return normalizeCaptureTimelineState({
        ...normalized,
        pageClips: normalized.pageClips.map((clip) =>
          clip.id === clipId ? { ...clip, locked } : clip,
        ),
      });
    });
  }, []);
  const selectPageClip = useCallback((clipId: string | null) => {
    setCaptureTimeline((previous) => {
      const normalized = normalizeCaptureTimelineState(previous);
      const selectedPageClipId =
        clipId && normalized.pageClips.some((clip) => clip.id === clipId)
          ? clipId
          : null;
      return { ...normalized, selectedPageClipId };
    });
    setSelectedTimelineTrack("pages");
  }, []);
  const resizeTimelineBoundary = useCallback(
    (boundaryId: string, deltaSeconds: number) => {
      setCaptureTimeline((previous) =>
        resizeCaptureTimelineBoundary({
          state: previous,
          boundaryId,
          deltaSeconds,
        }),
      );
    },
    [],
  );
  const setTimelineDiagnosticsVisible = useCallback((visible: boolean) => {
    setCaptureTimeline((previous) =>
      normalizeCaptureTimelineState({
        ...previous,
        diagnosticsVisible: visible,
      }),
    );
  }, []);
  const cameraPath = useMemo(
    () => captureCameraPathV2ToV1(downgradeCaptureCameraPathV3ToV2(captureCameraPathV3)),
    [captureCameraPathV3],
  );
  const cameraPathDurationSeconds = captureCameraPathV3.timeline.durationSeconds;
  const cameraPathPlaybackValidation = useMemo(
    () => validateCaptureCameraPathV3Playback(captureCameraPathV3),
    [captureCameraPathV3],
  );
  const activeCaptureJob = useMemo(
    () => captureJobs.find((job) => job.id === activeCaptureJobId) ?? null,
    [activeCaptureJobId, captureJobs],
  );
  const pathRenderJob = useMemo(
    () =>
      [...captureJobs].reverse().find((job) => job.kind === "path-video") ?? null,
    [captureJobs],
  );
  const pathPreviewMp4Job = useMemo(
    () =>
      [...captureJobs].reverse().find((job) => job.kind === "path-preview-transcode") ??
      null,
    [captureJobs],
  );
  const pathRenderStatus: CaptureJobStatus = pathRenderJob?.status ?? "idle";
  const pathRenderProgress: CaptureJobProgress = pathRenderJob?.progress ?? {
    phase: "preparing",
    renderedFrames: 0,
    totalFrames: 0,
  };
  const pathPreviewMp4Status: CaptureJobStatus =
    pathPreviewMp4Job?.status ?? "idle";
  const pathPreviewMp4Progress: CaptureJobProgress =
    pathPreviewMp4Job?.progress ?? { phase: "preparing" };

  useEffect(() => {
    if (capturePageOptions.length === 0) return;
    const optionIds = new Set(capturePageOptions.map((option) => option.id));
    const preferredId =
      currentPage && optionIds.has(currentPage.id)
        ? currentPage.id
        : capturePageOptions[0].id;
    setPageRangeStartId((previous) =>
      previous && optionIds.has(previous) ? previous : preferredId,
    );
    setPageRangeEndId((previous) =>
      previous && optionIds.has(previous) ? previous : preferredId,
    );
  }, [capturePageOptions, currentPage]);

  useEffect(() => {
    setAvailability(readAvailability());
  }, []);

  useEffect(() => {
    outputUrlRef.current = outputUrl;
  }, [outputUrl]);

  useEffect(() => {
    recipeOutputUrlRef.current = recipeOutputUrl;
  }, [recipeOutputUrl]);

  useEffect(() => {
    cameraPathOutputUrlRef.current = cameraPathOutputUrl;
  }, [cameraPathOutputUrl]);

  useEffect(() => {
    externalStillJobUrlRef.current = externalStillJobUrl;
  }, [externalStillJobUrl]);

  useEffect(() => {
    externalVideoJobUrlRef.current = externalVideoJobUrl;
  }, [externalVideoJobUrl]);

  const revokeOutputUrl = useCallback(() => {
    if (outputUrlRef.current) {
      URL.revokeObjectURL(outputUrlRef.current);
      outputUrlRef.current = null;
    }
  }, []);

  const revokePathPreviewMp4OutputUrl = useCallback(() => {
    pathPreviewMp4OutputCleanupRef.current?.();
    pathPreviewMp4OutputCleanupRef.current = null;
  }, []);

  const revokeDeterministicOutputUrl = useCallback(() => {
    deterministicOutputCleanupRef.current?.();
    deterministicOutputCleanupRef.current = null;
  }, []);

  const revokePathRenderOutputUrl = useCallback(() => {
    pathRenderOutputCleanupRef.current?.();
    pathRenderOutputCleanupRef.current = null;
  }, []);

  const revokeScreenCaptureOutputUrl = useCallback(() => {
    screenCaptureOutputCleanupRef.current?.();
    screenCaptureOutputCleanupRef.current = null;
  }, []);

  const revokeRecipeOutputUrl = useCallback(() => {
    if (recipeOutputUrlRef.current) {
      URL.revokeObjectURL(recipeOutputUrlRef.current);
      recipeOutputUrlRef.current = null;
    }
  }, []);

  const revokeCameraPathOutputUrl = useCallback(() => {
    if (cameraPathOutputUrlRef.current) {
      URL.revokeObjectURL(cameraPathOutputUrlRef.current);
      cameraPathOutputUrlRef.current = null;
    }
  }, []);

  const revokeExternalStillJobUrl = useCallback(() => {
    if (externalStillJobUrlRef.current) {
      URL.revokeObjectURL(externalStillJobUrlRef.current);
      externalStillJobUrlRef.current = null;
    }
    setExternalStillJobUrl(null);
    setExternalStillJobFilename(null);
    setExternalStillJobCommand(null);
  }, []);

  const revokeExternalVideoJobUrl = useCallback(() => {
    if (externalVideoJobUrlRef.current) {
      URL.revokeObjectURL(externalVideoJobUrlRef.current);
      externalVideoJobUrlRef.current = null;
    }
    setExternalVideoJobUrl(null);
    setExternalVideoJobFilename(null);
    setExternalVideoJobCommand(null);
  }, []);

  const clearElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const restoreCaptureSize = useCallback(() => {
    if (captureSizedRef.current) {
      sceneHandle.endCaptureSize();
      captureSizedRef.current = false;
    }
  }, [sceneHandle]);

  const clearPathPreviewMp4Output = useCallback(() => {
    revokePathPreviewMp4OutputUrl();
    setPathPreviewMp4OutputBlob(null);
    setPathPreviewMp4OutputUrl(null);
    setPathPreviewMp4OutputFilename(null);
    setPathPreviewVideoSaveMessage(null);
  }, [revokePathPreviewMp4OutputUrl]);

  const clearPreviewOutput = useCallback(() => {
    revokeOutputUrl();
    setOutputUrl(null);
    setOutputBlob(null);
    setOutputFilename(null);
    clearPathPreviewMp4Output();
  }, [clearPathPreviewMp4Output, revokeOutputUrl]);

  const clearScreenCaptureOutput = useCallback(() => {
    revokeScreenCaptureOutputUrl();
    revokeExternalStillJobUrl();
    setScreenCaptureOutputBlob(null);
    setScreenCaptureOutputUrl(null);
    setScreenCaptureOutputFilename(null);
    setExternalStillJobUrl(null);
    setExternalStillJobFilename(null);
    setScreenCaptureSaveMessage(null);
  }, [revokeExternalStillJobUrl, revokeScreenCaptureOutputUrl]);

  const clearPathRenderOutput = useCallback(() => {
    revokePathRenderOutputUrl();
    revokeExternalVideoJobUrl();
    setPathRenderOutputBlob(null);
    setPathRenderOutputUrl(null);
    setPathRenderOutputFilename(null);
    setPathRenderSaveMessage(null);
  }, [revokeExternalVideoJobUrl, revokePathRenderOutputUrl]);

  const updateCaptureJob = useCallback(
    (jobId: string, updater: (job: CaptureJobRecord) => CaptureJobRecord) => {
      setCaptureJobs((jobs) =>
        jobs.map((job) => (job.id === jobId ? updater(job) : job)),
      );
    },
    [],
  );

  const clearPathRenderEncodingTimer = useCallback(() => {
    if (pathRenderEncodingTimerRef.current !== null) {
      window.clearInterval(pathRenderEncodingTimerRef.current);
      pathRenderEncodingTimerRef.current = null;
    }
  }, []);

  const startPathRenderEncodingTimer = useCallback(
    ({
      jobId,
      totalFrames,
      format,
    }: {
      jobId: string;
      totalFrames: number;
      format: CaptureDeterministicExportFormat;
    }) => {
      clearPathRenderEncodingTimer();
      const startedAt = Date.now();
      const updateMessage = () => {
        const elapsedSeconds = Math.max(
          0,
          Math.floor((Date.now() - startedAt) / 1000),
        );
        const timecode = `${Math.floor(elapsedSeconds / 60)}:${String(
          elapsedSeconds % 60,
        ).padStart(2, "0")}`;
        const formatLabel = format === "webm" ? "WebM" : "MP4";
        const message =
          elapsedSeconds >= 90
            ? `Encoding ${formatLabel} for ${timecode}. 4K encodes can take several minutes; cancel if this is longer than expected. No file has been saved yet.`
            : `Encoding ${formatLabel} for ${timecode}. No file has been saved yet.`;
        updateCaptureJob(jobId, (entry) =>
          entry.status === "encoding"
            ? updateCaptureJobProgress(entry, {
                phase: "encoding",
                renderedFrames: totalFrames,
                totalFrames,
                percent: 0.98,
                message,
              })
            : entry,
        );
      };
      updateMessage();
      pathRenderEncodingTimerRef.current = window.setInterval(updateMessage, 1000);
    },
    [clearPathRenderEncodingTimer, updateCaptureJob],
  );

  const beginCaptureJob = useCallback(
    (options: {
      kind: CaptureJobKind;
      label: string;
      abortController?: AbortController;
      diagnostics?: Record<string, unknown>;
    }) => {
      if (!canStartCaptureJob(captureJobs)) {
        throw new Error("Another capture job is already running.");
      }
      const job = createCaptureJobRecord(options);
      setCaptureJobs((jobs) => [...jobs, job]);
      setActiveCaptureJobId(job.id);
      return job;
    },
    [captureJobs],
  );

  const finishCaptureJob = useCallback(
    (jobId: string, updater: (job: CaptureJobRecord) => CaptureJobRecord) => {
      setCaptureJobs((jobs) =>
        jobs.map((job) => (job.id === jobId ? updater(job) : job)),
      );
      setActiveCaptureJobId((current) => (current === jobId ? null : current));
    },
    [],
  );

  const clearCompletedCaptureJob = useCallback((jobId: string) => {
    setCaptureJobs((jobs) => {
      const target = jobs.find((job) => job.id === jobId);
      if (target && !isCaptureJobRunning(target)) {
        clearCaptureJobRecord(target);
      }
      return jobs.filter((job) => job.id !== jobId || isCaptureJobRunning(job));
    });
    setActiveCaptureJobId((current) => (current === jobId ? null : current));
  }, []);

  const completePathPreviewJob = useCallback(
    (result: CaptureRecorderResult, filename: string) => {
      const jobId = pathPreviewJobIdRef.current;
      if (!jobId) return;
      pathPreviewJobIdRef.current = null;
      finishCaptureJob(jobId, (job) =>
        completeCaptureJob(job, {
          output: {
            blob: result.blob,
            url: result.url,
            filename,
            mimeType: result.mimeType,
            byteLength: result.byteLength,
          },
          diagnostics: {
            ...capturePathJobDiagnostics({
              mode: armedMode,
              pathVersion: captureCameraPathV3.version,
              nodeCount: captureCameraPathV3.nodes.length,
              segmentCount: captureCameraPathV3.segments.length,
              durationSeconds: cameraPathDurationSeconds,
              fps,
              resolution: previewResolution,
              format: "webm",
              mediaRecorder: true,
            }),
            outputByteLength: result.byteLength,
            emptyChunkCount: result.diagnostics.emptyChunkCount,
            chunkCount: result.diagnostics.chunkCount,
          },
        }),
      );
    },
    [
      armedMode,
      cameraPathDurationSeconds,
      captureCameraPathV3,
      finishCaptureJob,
      fps,
      previewResolution,
    ],
  );

  const failPathPreviewJob = useCallback(
    (errorValue: unknown) => {
      const jobId = pathPreviewJobIdRef.current;
      if (!jobId) return;
      pathPreviewJobIdRef.current = null;
      finishCaptureJob(jobId, (job) => failCaptureJob(job, errorValue));
    },
    [finishCaptureJob],
  );

  const completeRecordingFromResult = useCallback(
    (result: CaptureRecorderResult, mode: ActiveCaptureMode) => {
      try {
        validateCaptureRecorderBlob(
          result.blob,
          recorderOutputContextForMode({ mode, resolution: previewResolution, fps }),
        );
      } catch (recordingError) {
        URL.revokeObjectURL(result.url);
        recorderRef.current = null;
        clearElapsedTimer();
        restoreCaptureSize();
        clearPreviewOutput();
        setCaptureMode("off");
        setRecordingStatus("idle");
        setError(formatCaptureError(recordingError));
        failPathPreviewJob(recordingError);
        return;
      }
      recorderRef.current = null;
      clearElapsedTimer();
      restoreCaptureSize();
      setOutputBlob(result.blob);
      setOutputUrl(result.url);
      setOutputFilename(`geosee-capture-${mode}.webm`);
      outputUrlRef.current = result.url;
      setRecordingStatus("complete");
      setCaptureMode("off");
      completePathPreviewJob(result, `geosee-capture-${mode}.webm`);
    },
    [
      clearElapsedTimer,
      clearPreviewOutput,
      completePathPreviewJob,
      failPathPreviewJob,
      fps,
      previewResolution,
      restoreCaptureSize,
    ],
  );

  const failRecordingFromError = useCallback(
    (recordingError: Error) => {
      recorderRef.current = null;
      clearElapsedTimer();
      restoreCaptureSize();
      clearPreviewOutput();
      setCaptureMode("off");
      setRecordingStatus("idle");
      setError(formatCaptureError(recordingError));
      failPathPreviewJob(recordingError);
    },
    [clearElapsedTimer, clearPreviewOutput, failPathPreviewJob, restoreCaptureSize],
  );

  const resetRecording = useCallback(() => {
    clearPreviewOutput();
    clearScreenCaptureOutput();
    clearPathRenderOutput();
    clearPathRenderEncodingTimer();
    revokeDeterministicOutputUrl();
    setDeterministicOutputUrl(null);
    setDeterministicOutputBlob(null);
    setDeterministicOutputFilename(null);
    setDeterministicExportProgress({ renderedFrames: 0, totalFrames: 0 });
    setCaptureJobs((jobs) => {
      for (const job of jobs) {
        if (!isCaptureJobRunning(job)) {
          clearCaptureJobRecord(job);
        }
      }
      return jobs.filter(isCaptureJobRunning);
    });
    setScreenCaptureStatus("idle");
    setScreenCaptureOptionsOpen(false);
    setScreenCaptureSaveMessage(null);
    setError(null);
    setElapsedSeconds(0);
    if (!isRecording && !isDeterministicExporting) {
      setRecordingStatus("idle");
      setDeterministicExportStatus("idle");
      setCaptureMode("off");
    }
  }, [
    clearPreviewOutput,
    clearPathRenderOutput,
    clearPathRenderEncodingTimer,
    clearScreenCaptureOutput,
    isDeterministicExporting,
    isRecording,
    revokeDeterministicOutputUrl,
  ]);

  const setArmedMode = useCallback(
    (mode: ActiveCaptureMode) => {
      setArmedModeState(mode);
      if (!isRecording) {
        setCaptureMode(mode);
      }
    },
    [isRecording],
  );

  const stopCameraPathPlayback = useCallback(() => {
    cameraPathPlaybackUnsubscribeRef.current?.();
    cameraPathPlaybackUnsubscribeRef.current = null;
    cameraPathPlaybackStartMsRef.current = null;
    cameraPathPlaybackCompleteRef.current = null;
    setCameraPathPlaying(false);
    setCameraPathTimelinePlaying(false);
  }, []);

  const setDirectorPanel = useCallback(
    (panel: CaptureDirectorPanel) => {
      setDirectorPanelState(panel);
      if (panel === "closed") {
        stopCameraPathPlayback();
        setCameraPathFocusPickNodeId(null);
        sceneHandle.clearCaptureCameraPathOverlay();
      }
    },
    [sceneHandle, stopCameraPathPlayback],
  );

  const overlayContext = useCallback(
    (pageOverride?: PresentationPage | null, pageIndexOverride?: number) => {
      const overlayPage = pageOverride === undefined ? currentPage : pageOverride;
      const overlayIndex =
        typeof pageIndexOverride === "number" ? pageIndexOverride : currentIndex;
      return {
      mode: armedMode,
      width: previewResolution.width,
      height: previewResolution.height,
      projectName: state.manifest.name,
      title: overlayPage?.title ?? state.manifest.name,
      pageTitle: overlayPage?.title ?? null,
      pageLabel: overlayPage
        ? `${String(overlayIndex + 1).padStart(2, "0")} / ${pages.length}`
        : null,
      brandLabel: "GeoVox / GeoSee",
      legendItems: [],
      elapsedSeconds,
      };
    },
    [
      armedMode,
      currentIndex,
      currentPage,
      elapsedSeconds,
      pages.length,
      previewResolution.height,
      previewResolution.width,
      state.manifest.name,
    ],
  );

  const startElapsedTimer = useCallback(() => {
    clearElapsedTimer();
    startedAtRef.current = performance.now();
    setElapsedSeconds(0);
    elapsedTimerRef.current = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt === null) return;
      setElapsedSeconds((performance.now() - startedAt) / 1000);
    }, 250);
  }, [clearElapsedTimer]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    const nextAvailability = readAvailability();
    setAvailability(nextAvailability);
    const mimeType = nextAvailability.supportedMimeType;
    if (!nextAvailability.mediaRecorder || !mimeType) {
      setError("Video recording is not available in this browser.");
      return;
    }
    if (armedMode !== "full-ui" && !nextAvailability.canvasCaptureStream) {
      setError("Canvas recording is not available in this browser.");
      return;
    }
    if (armedMode === "full-ui" && !nextAvailability.displayCapture) {
      setError("Full UI capture is not available in this browser.");
      return;
    }

    clearPreviewOutput();
    setError(null);
    setRecordingStatus("preparing");
    setCaptureMode(armedMode);
    const activeMode = armedMode;
    const outputContext = recorderOutputContextForMode({
      mode: activeMode,
      resolution: previewResolution,
      fps,
    });
    const recorderCallbacks = {
      onUnexpectedStop: (result: CaptureRecorderResult) => {
        completeRecordingFromResult(result, activeMode);
      },
      onRecorderError: (recordingError: Error) => {
        failRecordingFromError(recordingError);
      },
    };

    try {
      let recorder: CaptureRecorderController;
      if (armedMode === "full-ui") {
        recorder = await createDisplayPreviewRecorder({
          fps,
          mimeType,
          outputContext,
          video: true,
          audio: false,
          ...recorderCallbacks,
        });
      } else {
        sceneHandle.beginCaptureSize({
          width: previewResolution.width,
          height: previewResolution.height,
          pixelRatio: 1,
        });
        captureSizedRef.current = true;
        if (armedMode === "scene-only") {
          recorder = createCanvasPreviewRecorder({
            canvas: sceneHandle.getCanvas(),
            fps,
            mimeType,
            outputContext,
            onAfterRender: sceneHandle.onAfterRender,
            ...recorderCallbacks,
          });
        } else {
          try {
            recorder = createCompositedCaptureRecorder({
              sceneHandle,
              width: previewResolution.width,
              height: previewResolution.height,
              fps,
              mimeType,
              outputContext,
              overlayContext,
              onDrawError(drawError) {
                setError(
                  `Composited capture stopped updating: ${drawError.message}`,
                );
              },
              ...recorderCallbacks,
            });
          } catch (captureError) {
            if (!(captureError instanceof CompositedCaptureDrawError)) {
              throw captureError;
            }
            setError(
              "Composited capture is unavailable; recording scene-only fallback.",
            );
            recorder = createCanvasPreviewRecorder({
              canvas: sceneHandle.getCanvas(),
              fps,
              mimeType,
              outputContext,
              onAfterRender: sceneHandle.onAfterRender,
              ...recorderCallbacks,
            });
          }
        }
      }
      recorderRef.current = recorder;
      startElapsedTimer();
      setRecordingStatus("recording");
    } catch (recordingError) {
      recorderRef.current = null;
      clearElapsedTimer();
      restoreCaptureSize();
      clearPreviewOutput();
      setCaptureMode("off");
      setRecordingStatus("idle");
      setError(formatCaptureError(recordingError));
    }
  }, [
    armedMode,
    clearPreviewOutput,
    clearElapsedTimer,
    completeRecordingFromResult,
    failRecordingFromError,
    fps,
    isRecording,
    overlayContext,
    previewResolution.height,
    previewResolution.width,
    restoreCaptureSize,
    sceneHandle,
    startElapsedTimer,
  ]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recordingStatus === "stopping") return;
    setRecordingStatus("stopping");
    try {
      const result = await recorder.stop();
      try {
        validateCaptureRecorderBlob(
          result.blob,
          recorderOutputContextForMode({ mode: armedMode, resolution: previewResolution, fps }),
        );
      } catch (recordingError) {
        URL.revokeObjectURL(result.url);
        throw recordingError;
      }
      recorderRef.current = null;
      clearElapsedTimer();
      restoreCaptureSize();
      setOutputBlob(result.blob);
      setOutputUrl(result.url);
      setOutputFilename(`geosee-capture-${armedMode}.webm`);
      outputUrlRef.current = result.url;
      setRecordingStatus("complete");
      setCaptureMode("off");
      completePathPreviewJob(result, `geosee-capture-${armedMode}.webm`);
    } catch (stopError) {
      recorderRef.current = null;
      clearElapsedTimer();
      restoreCaptureSize();
      clearPreviewOutput();
      setCaptureMode("off");
      setRecordingStatus("idle");
      setError(formatCaptureError(stopError));
      failPathPreviewJob(stopError);
    }
  }, [
    armedMode,
    clearElapsedTimer,
    clearPreviewOutput,
    completePathPreviewJob,
    failPathPreviewJob,
    fps,
    recordingStatus,
    previewResolution,
    restoreCaptureSize,
  ]);

  const cancelPathPreviewMp4Transcode = useCallback(() => {
    pathPreviewMp4AbortRef.current?.abort();
    pathPreviewMp4RuntimeHandleRef.current?.dispose();
    pathPreviewMp4RuntimeHandleRef.current = null;
  }, []);

  const startPathPreviewMp4Transcode = useCallback(async () => {
    if (isCaptureJobRunning(activeCaptureJob)) {
      setError("Another capture job is already running.");
      return;
    }
    if (!outputBlob || outputBlob.size <= 0) {
      setError("Record a path preview before converting it to MP4.");
      return;
    }

    const abortController = new AbortController();
    let jobId: string | null = null;
    try {
      const job = beginCaptureJob({
        kind: "path-preview-transcode",
        label: "Convert Preview MP4",
        abortController,
        diagnostics: {
          sourceMimeType: outputBlob.type || "video/webm",
          sourceByteLength: outputBlob.size,
          format: "mp4",
          mediaRecorder: false,
        },
      });
      jobId = job.id;
    } catch (jobError) {
      setError(formatCaptureError(jobError));
      return;
    }
    const transcodeJobId = jobId;
    if (!transcodeJobId) return;

    pathPreviewMp4AbortRef.current = abortController;
    clearPathPreviewMp4Output();
    setPathPreviewVideoSaveMessage("Converting preview WebM to MP4. No file has been saved yet.");
    updateCaptureJob(transcodeJobId, (entry) =>
      updateCaptureJobStatus(entry, "encoding", {
        progress: {
          phase: "encoding",
          percent: 0.5,
          message: "Converting preview WebM to MP4. No file has been saved yet.",
        },
      }),
    );

    const runtimeHandle = createBrowserFfmpegFrameSequenceRuntime({
      signal: abortController.signal,
    });
    pathPreviewMp4RuntimeHandleRef.current = runtimeHandle;
    try {
      const encoded = await transcodePreviewVideoToMp4({
        inputBlob: outputBlob,
        runtime: runtimeHandle.runtime,
        signal: abortController.signal,
        outputBasename: "geosee-camera-path-preview",
      });
      validateCaptureVideoBlob(encoded.blob, "Preview MP4 conversion");
      pathPreviewMp4OutputCleanupRef.current = encoded.cleanup;
      setPathPreviewMp4OutputBlob(encoded.blob);
      setPathPreviewMp4OutputUrl(encoded.url);
      setPathPreviewMp4OutputFilename(encoded.filename);
      setPathPreviewVideoSaveMessage("Preview MP4 ready. Save or download the file.");
      finishCaptureJob(transcodeJobId, (entry) =>
        completeCaptureJob(entry, {
          output: {
            blob: encoded.blob,
            url: encoded.url,
            filename: encoded.filename,
            mimeType: encoded.mimeType,
            byteLength: encoded.blob.size,
            cleanup: encoded.cleanup,
          },
          diagnostics: captureVideoOutputDiagnostics({
            outputByteLength: encoded.blob.size,
            encoderPreset: "preview-webm-to-mp4",
            mimeType: encoded.mimeType,
            filename: encoded.filename,
          }),
        }),
      );
    } catch (transcodeError) {
      clearPathPreviewMp4Output();
      if (
        abortController.signal.aborted ||
        (transcodeError instanceof DOMException &&
          transcodeError.name === "AbortError")
      ) {
        setPathPreviewVideoSaveMessage("Preview MP4 conversion was cancelled.");
        finishCaptureJob(transcodeJobId, (entry) =>
          cancelCaptureJob(entry, { reason: "Preview MP4 conversion was cancelled." }),
        );
      } else {
        setPathPreviewVideoSaveMessage(null);
        setError(formatCaptureError(transcodeError));
        finishCaptureJob(transcodeJobId, (entry) =>
          failCaptureJob(entry, transcodeError),
        );
      }
    } finally {
      runtimeHandle.dispose();
      if (pathPreviewMp4RuntimeHandleRef.current === runtimeHandle) {
        pathPreviewMp4RuntimeHandleRef.current = null;
      }
      pathPreviewMp4AbortRef.current = null;
    }
  }, [
    activeCaptureJob,
    beginCaptureJob,
    clearPathPreviewMp4Output,
    finishCaptureJob,
    outputBlob,
    updateCaptureJob,
  ]);

  const savePathPreviewVideo = useCallback(
    async (type: CaptureVideoFileType) => {
      const blob = type === "mp4" ? pathPreviewMp4OutputBlob : outputBlob;
      const filename =
        type === "mp4"
          ? pathPreviewMp4OutputFilename ?? "geosee-camera-path-preview.mp4"
          : outputFilename ?? "geosee-camera-path-preview.webm";
      if (!blob) {
        setPathPreviewVideoSaveMessage(
          type === "mp4"
            ? "Convert the preview to MP4 before saving it."
            : "Record a path preview before saving it.",
        );
        return;
      }
      try {
        const result = await saveCaptureVideoBlobWithPicker({
          blob,
          filename,
          type,
        });
        setPathPreviewVideoSaveMessage(
          result.status === "saved"
            ? `${type.toUpperCase()} preview saved.`
            : result.status === "cancelled"
              ? `${type.toUpperCase()} preview save was cancelled.`
              : "Save picker unavailable. Use the download link.",
        );
      } catch (saveError) {
        setPathPreviewVideoSaveMessage(null);
        setError(formatCaptureError(saveError));
      }
    },
    [
      outputBlob,
      outputFilename,
      pathPreviewMp4OutputBlob,
      pathPreviewMp4OutputFilename,
    ],
  );

  const savePathPreviewMp4 = useCallback(
    () => savePathPreviewVideo("mp4"),
    [savePathPreviewVideo],
  );

  const cancelDeterministicExport = useCallback(() => {
    deterministicAbortRef.current?.abort();
    const localRunId = deterministicLocalVideoRunIdRef.current;
    if (localRunId) {
      void cancelLocalVideoRenderJob(localRunId).finally(() => {
        if (deterministicLocalVideoRunIdRef.current === localRunId) {
          deterministicLocalVideoRunIdRef.current = null;
        }
      });
    }
    deterministicRuntimeHandleRef.current?.dispose();
    deterministicRuntimeHandleRef.current = null;
  }, []);

  const applyCaptureCameraPathV3 = useCallback((nextPath: CaptureCameraPathV3) => {
    const normalized = normalizeCaptureCameraPathV3(nextPath);
    setCaptureCameraPathV3(normalized);
    setCaptureCameraPathV2(downgradeCaptureCameraPathV3ToV2(normalized));
    setCameraPathDisplayOptionsState(normalized.displayOptions);
    setCameraKeyframes(cameraPathV3ToRecipeKeyframes(normalized, fps));
    setDeterministicDurationSecondsState(normalized.timeline.durationSeconds);
    setCameraPathScrubTimeSecondsState((previous) =>
      Math.max(0, Math.min(normalized.timeline.durationSeconds, previous)),
    );
    return normalized;
  }, [fps]);

  const applyCaptureCameraPathV2 = useCallback((nextPath: CaptureCameraPathV2) => {
    const normalized = normalizeCaptureCameraPathV2(nextPath);
    const upgraded = upgradeCaptureCameraPathV2ToV3(normalized);
    setCaptureCameraPathV2(normalized);
    setCaptureCameraPathV3(upgraded);
    setCameraPathDisplayOptionsState(upgraded.displayOptions);
    setCameraKeyframes(cameraPathV3ToRecipeKeyframes(upgraded, fps));
    setDeterministicDurationSecondsState(upgraded.timeline.durationSeconds);
    setCameraPathScrubTimeSecondsState((previous) =>
      Math.max(0, Math.min(upgraded.timeline.durationSeconds, previous)),
    );
    return normalized;
  }, [fps]);

  const setCameraPathDisplayOptions = useCallback(
    (patch: Partial<CaptureCameraPathDisplayOptionsV2>) => {
      setCaptureCameraPathV3((path) => {
        const nextDisplayOptions = normalizeCaptureCameraPathDisplayOptionsV2({
          ...path.displayOptions,
          ...patch,
        });
        const nextPath = normalizeCaptureCameraPathV3({
          ...path,
          displayOptions: nextDisplayOptions,
        });
        setCameraPathDisplayOptionsState(nextDisplayOptions);
        setCaptureCameraPathV2(downgradeCaptureCameraPathV3ToV2(nextPath));
        return nextPath;
      });
    },
    [],
  );

  const setCameraPathEquationOverlayOptions = useCallback(
    (patch: Partial<CaptureCameraPathEquationOverlayOptionsV3>) => {
      setCaptureCameraPathV3((path) =>
        normalizeCaptureCameraPathV3({
          ...path,
          equationOverlayOptions: {
            ...path.equationOverlayOptions,
            ...patch,
          },
        }),
      );
    },
    [],
  );

  const setCameraPathScrubTimeSeconds = useCallback(
    (seconds: number) => {
      const safeSeconds = Number.isFinite(seconds)
        ? Math.max(0, Math.min(cameraPathDurationSeconds, seconds))
        : 0;
      setCameraPathScrubTimeSecondsState(safeSeconds);
    },
    [cameraPathDurationSeconds],
  );

  const setDeterministicDurationSeconds = useCallback((seconds: number) => {
    const safeSeconds = Number.isFinite(seconds)
      ? Math.max(0.1, Math.min(600, seconds))
      : deterministicExportDurationSeconds();
    setDeterministicDurationSecondsState(safeSeconds);
    setCameraKeyframes((keyframes) =>
      keyframes.filter((keyframe) => keyframe.timeSeconds <= safeSeconds),
    );
    setCaptureCameraPathV3((path) => {
      const nextPath = normalizeCaptureCameraPathV3({
        ...path,
        timeline: { durationSeconds: safeSeconds },
        nodes: path.nodes.filter((node) => node.timeSeconds <= safeSeconds),
        segments: path.segments.filter((segment) => {
          const from = path.nodes.find((node) => node.id === segment.fromNodeId);
          const to = path.nodes.find((node) => node.id === segment.toNodeId);
          return (
            (!from || from.timeSeconds <= safeSeconds) &&
            (!to || to.timeSeconds <= safeSeconds)
          );
        }),
      });
      setCaptureCameraPathV2(downgradeCaptureCameraPathV3ToV2(nextPath));
      return nextPath;
    });
  }, []);

  const setSupersampleScale = useCallback((scale: number) => {
    void scale;
    setSupersampleScaleState(1);
  }, []);

  const setEqualHoldSeconds = useCallback((seconds: number) => {
    const safeSeconds = Number.isFinite(seconds)
      ? Math.max(0.1, Math.min(600, seconds))
      : 4;
    setEqualHoldSecondsState(safeSeconds);
  }, []);

  const setScreenCaptureQuality = useCallback((quality: number) => {
    const safeQuality =
      Number.isFinite(quality) && quality > 0 ? Math.min(1, quality) : 0.92;
    setScreenCaptureQualityState(Math.max(0.01, safeQuality));
  }, []);

  const addCurrentCameraKeyframe = useCallback(() => {
    const pose = capturePose(sceneHandle.camera, sceneHandle.controls);
    const nodeId = captureCameraPathV2NodeId(captureCameraPathV2.nodes.length);
    const nodes = [
      ...captureCameraPathV2.nodes,
      cameraPathV2NodeFromPose({ id: nodeId, kind: "keyframe", pose }),
    ];
    const segments = [...captureCameraPathV2.segments];
    const previous = captureCameraPathV2.nodes[captureCameraPathV2.nodes.length - 1];
    if (previous) {
      segments.push({
        id: captureCameraPathV2SegmentId(previous.id, nodeId),
        fromNodeId: previous.id,
        toNodeId: nodeId,
        enabled: true,
        hidden: false,
        transitionSeconds: 2,
        easing: "ease-in-out",
      });
    }
    const next = applyCaptureCameraPathV2({
      ...captureCameraPathV2,
      nodes,
      segments,
    });
    setSelectedCameraPathKeyframeId(nodeId);
    setSelectedCameraPathNodeId(nodeId);
    setCameraPathScrubTimeSecondsState(next.timeline.durationSeconds);
  }, [applyCaptureCameraPathV2, captureCameraPathV2, sceneHandle]);

  const addCameraPathKeyframe = addCurrentCameraKeyframe;

  const replaceCameraKeyframePose = useCallback(
    (index: number) => {
      const node = captureCameraPathV2.nodes[index];
      if (!node) return;
      applyCaptureCameraPathV2({
        ...captureCameraPathV2,
        nodes: captureCameraPathV2.nodes.map((entry) =>
          entry.id === node.id
            ? {
                ...entry,
                ...cameraPathV2NodeFromPose({
                  id: entry.id,
                  kind: entry.kind,
                  pose: capturePose(sceneHandle.camera, sceneHandle.controls),
                  holdSecondsAfter: entry.holdSecondsAfter,
                  lookMode: entry.lookMode,
                  focusPointId: entry.focusPointId,
                }),
              }
            : entry,
        ),
      });
    },
    [applyCaptureCameraPathV2, captureCameraPathV2, sceneHandle],
  );

  const updateCameraKeyframe = useCallback(
    (index: number, patch: Partial<CaptureCameraKeyframe>) => {
      const keyframes = cameraPathV2ToRecipeKeyframes(captureCameraPathV2);
      const nextKeyframes = normalizeCaptureCameraKeyframes(
        keyframes.map((keyframe, keyframeIndex) =>
          keyframeIndex === index
            ? {
                ...keyframe,
                ...patch,
                timeSeconds:
                  typeof patch.timeSeconds === "number"
                    ? Math.max(
                        0,
                        Math.min(cameraPathDurationSeconds, patch.timeSeconds),
                      )
                    : keyframe.timeSeconds,
              }
            : keyframe,
        ),
      );
      applyCaptureCameraPathV2(
        recipeKeyframesToCameraPathV2(
          {
            cameraKeyframes: nextKeyframes,
            durationSeconds: cameraPathDurationSeconds,
          },
          { id: captureCameraPathV2.id, name: captureCameraPathV2.name },
        ),
      );
    },
    [
      applyCaptureCameraPathV2,
      cameraPathDurationSeconds,
      captureCameraPathV2,
    ],
  );

  const jumpToCameraKeyframe = useCallback(
    (index: number) => {
      const keyframe = cameraKeyframes[index];
      if (!keyframe) return;
      applyPose(sceneHandle.camera, sceneHandle.controls, keyframe.camera);
    },
    [cameraKeyframes, sceneHandle],
  );

  const removeCameraKeyframe = useCallback((index: number) => {
    const node = captureCameraPathV2.nodes[index];
    if (!node) return;
    const nodes = captureCameraPathV2.nodes.filter((entry) => entry.id !== node.id);
    const segments = captureCameraPathV2.segments.filter(
      (segment) => segment.fromNodeId !== node.id && segment.toNodeId !== node.id,
    );
    const next = applyCaptureCameraPathV2({ ...captureCameraPathV2, nodes, segments });
    const firstNodeId = next.nodes[0]?.id ?? null;
    setSelectedCameraPathKeyframeId(firstNodeId);
    setSelectedCameraPathNodeId(firstNodeId);
  }, [applyCaptureCameraPathV2, captureCameraPathV2]);

  const clearCameraKeyframes = useCallback(() => {
    setCameraKeyframes([]);
    applyCaptureCameraPathV3(
      normalizeCaptureCameraPathV3({
        ...captureCameraPathV3,
        nodes: [],
        segments: [],
      }),
    );
    setSelectedCameraPathKeyframeId(null);
    setSelectedCameraPathNodeId(null);
    setSelectedCameraPathSegmentId(null);
    setCameraPathScrubTimeSecondsState(0);
  }, [applyCaptureCameraPathV3, captureCameraPathV3]);

  const addCameraPathTransitionNode = useCallback(
    (segmentId?: string | null) => {
      const segment =
        captureCameraPathV2.segments.find(
          (entry) =>
            entry.id === segmentId || entry.id === selectedCameraPathSegmentId,
        ) ?? captureCameraPathV2.segments[captureCameraPathV2.segments.length - 1];
      if (!segment) {
        addCurrentCameraKeyframe();
        return;
      }
      const fromIndex = captureCameraPathV2.nodes.findIndex(
        (node) => node.id === segment.fromNodeId,
      );
      const toIndex = captureCameraPathV2.nodes.findIndex(
        (node) => node.id === segment.toNodeId,
      );
      if (fromIndex < 0 || toIndex < 0) return;
      const fromNode = captureCameraPathV2.nodes[fromIndex];
      const transitionTime =
        fromNode.timeSeconds + Math.max(0.05, segment.transitionSeconds / 2);
      const sample = sampleCaptureCameraPathV2(captureCameraPathV2, transitionTime);
      const nodeId = captureCameraPathV2NodeId(captureCameraPathV2.nodes.length);
      const transitionNode = cameraPathV2NodeFromPose({
        id: nodeId,
        kind: "transition",
        pose: sample,
      });
      const nodes = [...captureCameraPathV2.nodes];
      nodes.splice(Math.max(fromIndex, toIndex), 0, transitionNode);
      const splitSeconds = Math.max(0.1, segment.transitionSeconds / 2);
      const segments = captureCameraPathV2.segments
        .filter((entry) => entry.id !== segment.id)
        .concat([
          {
            id: captureCameraPathV2SegmentId(segment.fromNodeId, nodeId),
            fromNodeId: segment.fromNodeId,
            toNodeId: nodeId,
            enabled: segment.enabled,
            hidden: segment.hidden,
            transitionSeconds: splitSeconds,
            easing: segment.easing,
          },
          {
            id: captureCameraPathV2SegmentId(nodeId, segment.toNodeId),
            fromNodeId: nodeId,
            toNodeId: segment.toNodeId,
            enabled: segment.enabled,
            hidden: segment.hidden,
            transitionSeconds: splitSeconds,
            easing: segment.easing,
          },
        ]);
      applyCaptureCameraPathV2({ ...captureCameraPathV2, nodes, segments });
      setSelectedCameraPathNodeId(nodeId);
      setSelectedCameraPathKeyframeId(nodeId);
      setSelectedCameraPathSegmentId(null);
    },
    [
      addCurrentCameraKeyframe,
      applyCaptureCameraPathV2,
      captureCameraPathV2,
      selectedCameraPathSegmentId,
    ],
  );

  const setCameraPathNodeKind = useCallback(
    (nodeId: string, kind: CaptureCameraPathNodeKindV2) => {
      applyCaptureCameraPathV2({
        ...captureCameraPathV2,
        nodes: captureCameraPathV2.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                kind,
                holdSecondsAfter:
                  kind === "transition" ? 0 : node.holdSecondsAfter,
              }
            : node,
        ),
      });
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const setCameraPathNodeEnabled = useCallback(
    (nodeId: string, enabled: boolean) => {
      applyCaptureCameraPathV2(
        setCaptureCameraPathV2NodeEnabled(captureCameraPathV2, nodeId, enabled),
      );
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const setCameraPathNodeHidden = useCallback(
    (nodeId: string, hidden: boolean) => {
      applyCaptureCameraPathV2(
        setCaptureCameraPathV2NodeHidden(captureCameraPathV2, nodeId, hidden),
      );
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const setCameraPathSegmentTransitionSeconds = useCallback(
    (segmentId: string, seconds: number) => {
      const transitionSeconds =
        Number.isFinite(seconds) && seconds > 0 ? Math.min(600, seconds) : 0.1;
      applyCaptureCameraPathV2({
        ...captureCameraPathV2,
        segments: captureCameraPathV2.segments.map((segment) =>
          segment.id === segmentId ? { ...segment, transitionSeconds } : segment,
        ),
      });
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const setCameraPathSegmentEnabled = useCallback(
    (segmentId: string, enabled: boolean) => {
      applyCaptureCameraPathV2(
        setCaptureCameraPathV2SegmentEnabled(
          captureCameraPathV2,
          segmentId,
          enabled,
        ),
      );
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const setCameraPathSegmentHidden = useCallback(
    (segmentId: string, hidden: boolean) => {
      applyCaptureCameraPathV2(
        setCaptureCameraPathV2SegmentHidden(captureCameraPathV2, segmentId, hidden),
      );
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const setCameraPathSegmentEasing = useCallback(
    (segmentId: string, easing: "linear" | "ease-in-out") => {
      applyCaptureCameraPathV2(
        setCaptureCameraPathV2SegmentEasing(captureCameraPathV2, segmentId, easing),
      );
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const updateCameraPathSegmentFairing = useCallback(
    (
      segmentId: string,
      patch: Partial<CaptureCameraPathFairingV3>,
    ) => {
      const segment = captureCameraPathV3.segments.find((entry) => entry.id === segmentId);
      const nextSegments = captureCameraPathV3.segments.map((entry) =>
        entry.id === segmentId
          ? {
              ...entry,
              pathFairing: {
                ...entry.pathFairing,
                ...patch,
              },
            }
          : entry,
      );
      applyCaptureCameraPathV3({
        ...captureCameraPathV3,
        segments: nextSegments,
        nodes: captureCameraPathV3.nodes.map((node) => {
          if (!segment || (node.id !== segment.fromNodeId && node.id !== segment.toNodeId)) {
            return node;
          }
          const side = node.id === segment.fromNodeId ? "out" : "in";
          return {
            ...node,
            splineControls: {
              ...node.splineControls,
              ...(patch.continuity ? { continuity: patch.continuity } : {}),
              ...(patch.autoHandles !== undefined
                ? { handleMode: patch.autoHandles ? "auto" : "manual" }
                : {}),
              [side]: {
                ...node.splineControls[side],
                ...(side === "out" && patch.fromInfluenceOut !== undefined
                  ? { length: patch.fromInfluenceOut }
                  : {}),
                ...(side === "in" && patch.toInfluenceIn !== undefined
                  ? { length: patch.toInfluenceIn }
                  : {}),
              },
            },
          };
        }),
      });
    },
    [applyCaptureCameraPathV3, captureCameraPathV3],
  );

  const setCameraPathSegmentTimeCurve = useCallback(
    (segmentId: string, curve: CaptureCameraPathTimeCurveV3) => {
      applyCaptureCameraPathV3({
        ...captureCameraPathV3,
        segments: captureCameraPathV3.segments.map((segment) =>
          segment.id === segmentId ? { ...segment, timeCurve: curve } : segment,
        ),
      });
    },
    [applyCaptureCameraPathV3, captureCameraPathV3],
  );

  const setCameraPathSegmentContinuity = useCallback(
    (segmentId: string, continuity: CaptureCameraPathContinuityV3) => {
      updateCameraPathSegmentFairing(segmentId, { continuity });
    },
    [updateCameraPathSegmentFairing],
  );

  const setCameraPathSegmentTension = useCallback(
    (segmentId: string, tension: number) => {
      updateCameraPathSegmentFairing(segmentId, { tension });
    },
    [updateCameraPathSegmentFairing],
  );

  const setCameraPathSegmentBias = useCallback(
    (segmentId: string, bias: number) => {
      updateCameraPathSegmentFairing(segmentId, { bias });
    },
    [updateCameraPathSegmentFairing],
  );

  const setCameraPathSegmentInfluence = useCallback(
    (segmentId: string, edge: "from" | "to", influence: number | "auto") => {
      updateCameraPathSegmentFairing(
        segmentId,
        edge === "from"
          ? { fromInfluenceOut: influence }
          : { toInfluenceIn: influence },
      );
    },
    [updateCameraPathSegmentFairing],
  );

  const setCameraPathSegmentAutoHandles = useCallback(
    (segmentId: string, autoHandles: boolean) => {
      updateCameraPathSegmentFairing(segmentId, { autoHandles });
    },
    [updateCameraPathSegmentFairing],
  );

  const setCameraPathNodeAimGeometry = useCallback(
    (nodeId: string, patch: Partial<CaptureCameraPathAimGeometryV3>) => {
      applyCaptureCameraPathV3({
        ...captureCameraPathV3,
        nodes: captureCameraPathV3.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                aimGeometry: {
                  ...node.aimGeometry,
                  ...patch,
                },
              }
            : node,
        ),
      });
    },
    [applyCaptureCameraPathV3, captureCameraPathV3],
  );

  const setCameraPathNodeSplineCoupling = useCallback(
    (nodeId: string, coupling: CaptureCameraPathSplineCouplingV3) => {
      applyCaptureCameraPathV3(
        setCaptureCameraPathNodeSplineCoupling(captureCameraPathV3, nodeId, coupling),
      );
    },
    [applyCaptureCameraPathV3, captureCameraPathV3],
  );

  const setCameraPathNodeSplineHandleMode = useCallback(
    (nodeId: string, mode: CaptureCameraPathSplineHandleModeV3) => {
      applyCaptureCameraPathV3({
        ...captureCameraPathV3,
        nodes: captureCameraPathV3.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                splineControls: {
                  ...node.splineControls,
                  handleMode: mode,
                },
              }
            : node,
        ),
      });
    },
    [applyCaptureCameraPathV3, captureCameraPathV3],
  );

  const setCameraPathNodeSplineContinuity = useCallback(
    (nodeId: string, continuity: CaptureCameraPathContinuityV3) => {
      applyCaptureCameraPathV3(
        setCaptureCameraPathNodeSplineContinuity(
          captureCameraPathV3,
          nodeId,
          continuity,
        ),
      );
    },
    [applyCaptureCameraPathV3, captureCameraPathV3],
  );

  const setCameraPathNodeSplineHandleLength = useCallback(
    (
      nodeId: string,
      side: CaptureCameraPathSplineHandleSideV3,
      length: number | "auto",
    ) => {
      applyCaptureCameraPathV3(
        setCaptureCameraPathNodeSplineHandle(captureCameraPathV3, nodeId, side, {
          mode: length === "auto" ? "auto" : "manual",
          length,
        }),
      );
    },
    [applyCaptureCameraPathV3, captureCameraPathV3],
  );

  const moveCameraPathSplineHandle = useCallback(
    (
      nodeId: string,
      side: CaptureCameraPathSplineHandleSideV3,
      worldPosition: [number, number, number],
    ) => {
      applyCaptureCameraPathV3(
        moveCaptureCameraPathV3SplineHandle(
          captureCameraPathV3,
          nodeId,
          side,
          worldPosition,
        ),
      );
      setSelectedCameraPathNodeId(nodeId);
      setSelectedCameraPathKeyframeId(nodeId);
    },
    [applyCaptureCameraPathV3, captureCameraPathV3],
  );

  const moveCameraPathNodeAxis = useCallback(
    (nodeId: string, axis: "x" | "y" | "z", delta: number) => {
      applyCaptureCameraPathV3(
        moveCaptureCameraPathV3NodeAxis(captureCameraPathV3, nodeId, axis, delta),
      );
      setSelectedCameraPathNodeId(nodeId);
      setSelectedCameraPathKeyframeId(nodeId);
    },
    [applyCaptureCameraPathV3, captureCameraPathV3],
  );

  const moveCameraPathInfluenceHandle = useCallback(
    (segmentId: string, edge: "from" | "to", distance: number) => {
      setCameraPathSegmentInfluence(
        segmentId,
        edge,
        Number.isFinite(distance) ? Math.max(0, distance) : "auto",
      );
    },
    [setCameraPathSegmentInfluence],
  );

  const moveCameraPathFocusDistanceHandle = useCallback(
    (nodeId: string, distance: number) => {
      setCameraPathNodeAimGeometry(nodeId, {
        focusDistance: Number.isFinite(distance) ? Math.max(0, distance) : "auto",
      });
    },
    [setCameraPathNodeAimGeometry],
  );

  const setCameraPathNodeHoldSecondsAfter = useCallback(
    (nodeId: string, seconds: number) => {
      const holdSecondsAfter =
        Number.isFinite(seconds) && seconds > 0 ? Math.min(600, seconds) : 0;
      applyCaptureCameraPathV2({
        ...captureCameraPathV2,
        nodes: captureCameraPathV2.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                holdSecondsAfter:
                  node.kind === "transition" ? 0 : holdSecondsAfter,
              }
            : node,
        ),
      });
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const setCameraPathNodeLookMode = useCallback(
    (nodeId: string, mode: CaptureCameraPathLookModeV2) => {
      if (mode === "focus-point-lock") {
        const targetNode = captureCameraPathV2.nodes.find((node) => node.id === nodeId);
        if (targetNode && !targetNode.focusPointId) {
          const fallbackTarget =
            targetNode.target ?? sceneHandle.getCameraPose().target;
          applyCaptureCameraPathV2(
            bindCaptureCameraPathV2FocusPoint(captureCameraPathV2, nodeId, {
              id: `focus-${nodeId}`,
              position: fallbackTarget,
              picked: false,
            }),
          );
          return;
        }
      }
      applyCaptureCameraPathV2({
        ...captureCameraPathV2,
        nodes: captureCameraPathV2.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                lookMode: mode,
              }
            : node,
        ),
      });
    },
    [applyCaptureCameraPathV2, captureCameraPathV2, sceneHandle],
  );

  const bindCameraPathFocusPoint = useCallback(
    (
      nodeId: string,
      focusPointId: string | null,
      target?: [number, number, number],
    ) => {
      if (focusPointId && target) {
        applyCaptureCameraPathV2(
          bindCaptureCameraPathV2FocusPoint(captureCameraPathV2, nodeId, {
            id: focusPointId,
            position: target,
            picked: true,
          }),
        );
        return;
      }
      applyCaptureCameraPathV2({
        ...captureCameraPathV2,
        nodes: captureCameraPathV2.nodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                focusPointId: undefined,
                lookMode: "free-direction",
              }
            : node,
        ),
      });
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const beginCameraPathFocusPick = useCallback((nodeId: string) => {
    setSelectedCameraPathNodeId(nodeId);
    setSelectedCameraPathKeyframeId(nodeId);
    setSelectedCameraPathSegmentId(null);
    setCameraPathFocusPickNodeId(nodeId);
  }, []);

  const moveCameraPathTarget = useCallback(
    (nodeId: string, target: [number, number, number]) => {
      applyCaptureCameraPathV2(
        moveCaptureCameraPathV2NodeTarget(captureCameraPathV2, nodeId, target),
      );
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const saveCameraPath = useCallback(() => {
    revokeCameraPathOutputUrl();
    const serialized = serializeCaptureCameraPathV3(captureCameraPathV3);
    const blob = new Blob([serialized], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    cameraPathOutputUrlRef.current = url;
    setCameraPathOutputUrl(url);
    setCameraPathOutputFilename(
      `geosee-camera-path-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}.json`,
    );
  }, [captureCameraPathV3, revokeCameraPathOutputUrl]);

  const loadCameraPathFromFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as
          | CaptureCameraPathV1
          | CaptureCameraPathV2
          | CaptureCameraPathV3;
        const normalizedV3 =
          parsed.version === 3
            ? parseCaptureCameraPathV3Json(text).path
            : parsed.version === 2
              ? upgradeCaptureCameraPathV2ToV3(
                  parseCaptureCameraPathV2Json(text).path ??
                    normalizeCaptureCameraPathV2({
                      version: 2,
                      id: "capture-camera-path-v2",
                      name: "Camera Path",
                      loop: false,
                      focusPoints: [],
                      nodes: [],
                      segments: [],
                    }),
                )
              : upgradeCaptureCameraPathV2ToV3(
                  recipeKeyframesToCameraPathV2(
                {
                  cameraKeyframes: cameraPathToRecipeKeyframes(
                    normalizeCaptureCameraPath(parsed as CaptureCameraPathV1),
                  ),
                  durationSeconds: (parsed as CaptureCameraPathV1).durationSeconds,
                },
                { id: "capture-camera-path-v2", name: parsed.name },
                  ),
                );
        if (!normalizedV3) {
          const validation = validateCaptureCameraPathV2(parsed as CaptureCameraPathV2);
          setError(validation.errors.join(" "));
          return;
        }
        const next = applyCaptureCameraPathV3(normalizedV3);
        const firstNodeId = next.nodes[0]?.id ?? null;
        setSelectedCameraPathKeyframeId(firstNodeId);
        setSelectedCameraPathNodeId(firstNodeId);
        setSelectedCameraPathSegmentId(null);
        setDirectorPanelState("camera-path");
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? `Camera path JSON could not be parsed: ${loadError.message}`
            : "Camera path JSON could not be parsed.",
        );
      }
    },
    [applyCaptureCameraPathV3],
  );

  const playCameraPath = useCallback((): boolean => {
    stopCameraPathPlayback();
    const validation = validateCaptureCameraPathV3Playback(captureCameraPathV3);
    if (!validation.valid) {
      setError(validation.errors.join(" "));
      return false;
    }
    setError(null);
    const playbackTimeline = resolveCaptureCameraPathV3Timeline(captureCameraPathV3);
    const playbackStartSeconds =
      cameraPathScrubTimeSeconds >= playbackTimeline.durationSeconds - 0.001
        ? 0
        : Math.max(0, cameraPathScrubTimeSeconds);
    setCameraPathScrubTimeSecondsState(playbackStartSeconds);
    setCameraPathPlaying(true);
    setCameraPathTimelinePlaying(true);
    cameraPathPlaybackStartMsRef.current = null;
    cameraPathPlaybackStartScrubSecondsRef.current = playbackStartSeconds;
    cameraPathPlaybackUnsubscribeRef.current = sceneHandle.onTick((timeMs) => {
      if (cameraPathPlaybackStartMsRef.current === null) {
        cameraPathPlaybackStartMsRef.current = timeMs;
      }
      const elapsed =
        cameraPathPlaybackStartScrubSecondsRef.current +
        Math.max(0, (timeMs - cameraPathPlaybackStartMsRef.current) / 1000);
      const sample = sampleCaptureCameraPathV3(captureCameraPathV3, elapsed);
      sceneHandle.setCameraPose(sample);
      setCameraPathScrubTimeSecondsState(
        Math.max(0, Math.min(playbackTimeline.durationSeconds, elapsed)),
      );
      if (elapsed >= playbackTimeline.durationSeconds) {
        const onComplete = cameraPathPlaybackCompleteRef.current;
        cameraPathPlaybackCompleteRef.current = null;
        stopCameraPathPlayback();
        onComplete?.();
      }
    }, "CaptureDirectorCameraPathPlayback");
    return true;
  }, [
    cameraPathScrubTimeSeconds,
    captureCameraPathV3,
    sceneHandle,
    stopCameraPathPlayback,
  ]);

  const playCameraPathTimeline = playCameraPath;
  const pauseCameraPathTimeline = stopCameraPathPlayback;

  const startCameraPathPreviewRecording = useCallback(async () => {
    if (isCaptureJobRunning(activeCaptureJob)) {
      setError("Another capture job is already running.");
      return;
    }
    const validation = validateCaptureCameraPathV3Playback(captureCameraPathV3);
    if (!validation.valid) {
      setError(validation.errors.join(" "));
      return;
    }
    let previewJobId: string | null = null;
    try {
      const job = beginCaptureJob({
        kind: "path-preview",
        label: "Record Path Video",
        diagnostics: capturePathJobDiagnostics({
          mode: armedMode,
          pathVersion: captureCameraPathV3.version,
          nodeCount: captureCameraPathV3.nodes.length,
          segmentCount: captureCameraPathV3.segments.length,
          durationSeconds: cameraPathDurationSeconds,
          fps,
          resolution: previewResolution,
          format: "webm",
          mediaRecorder: true,
        }),
      });
      previewJobId = job.id;
      pathPreviewJobIdRef.current = job.id;
      updateCaptureJob(job.id, (entry) =>
        updateCaptureJobStatus(entry, "rendering", {
          progress: {
            phase: "rendering",
            renderedFrames: 0,
            totalFrames: Math.max(
              1,
              Math.ceil(cameraPathDurationSeconds * fps),
            ),
          },
        }),
      );
      await startRecording();
    } catch (recordingStartError) {
      if (previewJobId) {
        finishCaptureJob(previewJobId, (job) =>
          failCaptureJob(job, recordingStartError),
        );
      }
      pathPreviewJobIdRef.current = null;
      setError(formatCaptureError(recordingStartError));
      return;
    }
    if (!recorderRef.current) {
      failPathPreviewJob(new Error("Path video recorder did not start."));
      return;
    }
    if (!playCameraPath()) {
      cameraPathPlaybackCompleteRef.current = null;
      await stopRecording();
      return;
    }
    cameraPathPlaybackCompleteRef.current = () => {
      void stopRecording();
    };
  }, [
    activeCaptureJob,
    armedMode,
    beginCaptureJob,
    cameraPathDurationSeconds,
    captureCameraPathV3,
    failPathPreviewJob,
    finishCaptureJob,
    fps,
    playCameraPath,
    previewResolution,
    startRecording,
    stopRecording,
    updateCaptureJob,
  ]);

  const moveCameraPathKeyframe = useCallback(
    (id: string, position: [number, number, number]) => {
      applyCaptureCameraPathV2(
        moveCaptureCameraPathV2NodePosition(captureCameraPathV2, id, position),
      );
      setSelectedCameraPathNodeId(id);
      setSelectedCameraPathKeyframeId(id);
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const moveCameraPathSegment = useCallback(
    (segmentId: string, delta: [number, number, number]) => {
      applyCaptureCameraPathV2(
        moveCaptureCameraPathV2SegmentAdjacentPositions(
          captureCameraPathV2,
          segmentId,
          delta,
        ),
      );
      setSelectedCameraPathSegmentId(segmentId);
    },
    [applyCaptureCameraPathV2, captureCameraPathV2],
  );

  const startRealtimeCameraPathRecording = useCallback(() => {
    if (realtimeCameraPathRecorderRef.current) return;
    realtimeCameraPathRecorderRef.current = createCaptureCameraPathV2Recorder({
      getPose: () => capturePose(sceneHandle.camera, sceneHandle.controls),
      onTick(callback) {
        return sceneHandle.onTick(callback, "CaptureDirectorCameraPathV2Recorder");
      },
    });
    setRealtimeCameraPathRecording(true);
    setDirectorPanelState("camera-path");
    setError(null);
  }, [sceneHandle]);

  const stopRealtimeCameraPathRecording = useCallback(() => {
    const recorder = realtimeCameraPathRecorderRef.current;
    if (!recorder) return;
    realtimeCameraPathRecorderRef.current = null;
    const recordedPath = recorder.stop();
    const next = applyCaptureCameraPathV2(recordedPath);
    const firstNodeId = next.nodes[0]?.id ?? null;
    setRealtimeCameraPathRecording(false);
    setSelectedCameraPathNodeId(firstNodeId);
    setSelectedCameraPathKeyframeId(firstNodeId);
    setSelectedCameraPathSegmentId(null);
    setCameraPathScrubTimeSecondsState(0);
  }, [applyCaptureCameraPathV2]);

  useEffect(() => {
    const pathShouldShow =
      directorPanel !== "closed" &&
      cameraPathVisible &&
      captureCameraPathV3.nodes.length > 0 &&
      !(captureScope === "page-range" && pageRangeTiming === "authored");
    if (!pathShouldShow) {
      sceneHandle.clearCaptureCameraPathOverlay();
      return;
    }
    const currentSample = sampleCaptureCameraPathV3(
      captureCameraPathV3,
      cameraPathScrubTimeSeconds,
    );
    sceneHandle.setCaptureCameraPathOverlay({
      visible: true,
      editable: directorPanel === "camera-path",
      selectedKeyframeId: selectedCameraPathNodeId ?? selectedCameraPathKeyframeId,
      selectedSegmentId: selectedCameraPathSegmentId,
      sampledPoints: captureCameraPathV3SampledPoints(captureCameraPathV3, 192),
      keyframes: captureCameraPathV3.nodes.map((node) => {
        const nodeSample = sampleCaptureCameraPathV3(
          captureCameraPathV3,
          node.timeSeconds,
        );
        const displayIndex =
          captureCameraPathV3.nodes.findIndex((entry) => entry.id === node.id) + 1;
        return {
          id: node.id,
          displayIndex,
          enabled: node.enabled,
          hidden: node.hidden,
          nodeKind: node.kind,
          position: node.position,
          target: nodeSample.target,
          lookMode: node.aimGeometry.mode,
          focusLocked: node.aimGeometry.mode === "focus-point-lock",
        };
      }),
      segmentIds: captureCameraPathV3.segments
        .filter((segment) => segment.enabled !== false)
        .map((segment) => segment.id),
      segments: captureCameraPathV3.segments.map((segment, index) => ({
        id: segment.id,
        displayIndex: index + 1,
        enabled: segment.enabled,
        hidden: segment.hidden,
        fromNodeId: segment.fromNodeId,
        toNodeId: segment.toNodeId,
      })),
      currentSample,
      colors: {
        path: cameraPathDisplayOptions.trackColor,
        selected: cameraPathDisplayOptions.selectedColor,
        keyframe: cameraPathDisplayOptions.selectedColor,
        target: cameraPathDisplayOptions.targetColor,
        hover: cameraPathDisplayOptions.focusColor,
      },
      lineSize: cameraPathDisplayOptions.trackLineSize,
      directionRayLength: cameraPathDisplayOptions.directionRayLength,
      handleScale: cameraPathDisplayOptions.handleScale,
      showCameraFrustum: cameraPathDisplayOptions.showCameraFrustum,
      showLookRays: cameraPathDisplayOptions.showLookRays,
      showCurrentSampleMarker: !cameraPathPlaying,
      showCurrentSampleLookRay: !cameraPathPlaying,
      showFocusLockRays: cameraPathDisplayOptions.showFocusLockRays,
      showNodeLabels: cameraPathDisplayOptions.showNodeLabels,
      showTimelineGhost: cameraPathDisplayOptions.showTimelineGhost,
      previewMonitorMode: cameraPathDisplayOptions.previewMonitorMode,
      equationOptions: captureCameraPathV3.equationOverlayOptions,
      transitionEquations: captureCameraPathV3.segments.map((segment, index) => {
        const from = captureCameraPathV3.nodes.find((node) => node.id === segment.fromNodeId);
        const to = captureCameraPathV3.nodes.find((node) => node.id === segment.toNodeId);
        return {
          id: `equation:${segment.id}`,
          segmentId: segment.id,
          label: `A/T/D/G/Gd ${index + 1}`,
          position:
            from && to
              ? [
                  (from.position[0] + to.position[0]) / 2,
                  (from.position[1] + to.position[1]) / 2,
                  (from.position[2] + to.position[2]) / 2,
                ]
              : undefined,
          continuity: segment.pathFairing.continuity,
          timeCurve: segment.timeCurve.mode,
          visible:
            captureCameraPathV3.equationOverlayOptions.visible &&
            (!captureCameraPathV3.equationOverlayOptions.selectedTransitionOnly ||
              selectedCameraPathSegmentId === segment.id),
        };
      }),
      tangentHandles: captureCameraPathV3.segments.flatMap((segment) => {
        const from = captureCameraPathV3.nodes.find((node) => node.id === segment.fromNodeId);
        const to = captureCameraPathV3.nodes.find((node) => node.id === segment.toNodeId);
        return from && to
          ? [
              {
                id: `tangent:${segment.id}`,
                segmentId: segment.id,
                label: "T",
                start: from.position,
                end: to.position,
              },
            ]
          : [];
      }),
      influenceHandles: captureCameraPathV3.segments.flatMap((segment) => {
        const from = captureCameraPathV3.nodes.find((node) => node.id === segment.fromNodeId);
        const to = captureCameraPathV3.nodes.find((node) => node.id === segment.toNodeId);
        return from && to
          ? [
              {
                id: `gd-out:${segment.id}`,
                segmentId: segment.id,
                label: "Gd out",
                position: from.position,
                anchor: from.position,
              },
              {
                id: `gd-in:${segment.id}`,
                segmentId: segment.id,
                label: "Gd in",
                position: to.position,
                anchor: to.position,
              },
            ]
          : [];
      }),
      splineHandles: cameraPathDisplayOptions.showSplineControls
        ? captureCameraPathV3.nodes.flatMap((node) => {
            if (node.hidden) return [];
            const controls = node.splineControls;
            return (["in", "out"] as const).flatMap((side) => {
              const handle = controls[side];
              if (!handle.position) return [];
              return [
                {
                  id: `spline-${side}:${node.id}`,
                  nodeId: node.id,
                  side,
                  label: side === "in" ? "Tin / Gd in" : "Tout / Gd out",
                  anchor: node.position,
                  position: handle.position,
                  tangentCoupled: controls.coupling === "tangent",
                },
              ];
            });
          })
        : [],
      nodeAxisHandles:
        cameraPathDisplayOptions.showXyzHandles &&
        (selectedCameraPathNodeId || selectedCameraPathKeyframeId)
          ? captureCameraPathV3.nodes
              .filter(
                (node) =>
                  node.id ===
                  (selectedCameraPathNodeId ?? selectedCameraPathKeyframeId),
              )
              .flatMap((node) => {
                const scale = Math.max(1, cameraPathDisplayOptions.handleScale * 4);
                return [
                  {
                    id: `axis-x:${node.id}`,
                    nodeId: node.id,
                    axis: "x" as const,
                    start: node.position,
                    end: [
                      node.position[0] + scale,
                      node.position[1],
                      node.position[2],
                    ] as [number, number, number],
                  },
                  {
                    id: `axis-y:${node.id}`,
                    nodeId: node.id,
                    axis: "y" as const,
                    start: node.position,
                    end: [
                      node.position[0],
                      node.position[1] + scale,
                      node.position[2],
                    ] as [number, number, number],
                  },
                  {
                    id: `axis-z:${node.id}`,
                    nodeId: node.id,
                    axis: "z" as const,
                    start: node.position,
                    end: [
                      node.position[0],
                      node.position[1],
                      node.position[2] + scale,
                    ] as [number, number, number],
                  },
                ];
              })
          : [],
      focusDistanceVectors: captureCameraPathV3.nodes.map((node) => {
        const sample = sampleCaptureCameraPathV3(captureCameraPathV3, node.timeSeconds);
        return {
          id: `focus-distance:${node.id}`,
          nodeId: node.id,
          label: "D",
          start: node.position,
          end: sample.target,
        };
      }),
    });
    const unsubscribe = sceneHandle.setCaptureCameraPathInteraction({
      onSelectKeyframe(id) {
        if (id) {
          setSelectedCameraPathKeyframeId(id);
          setSelectedCameraPathNodeId(id);
          setSelectedCameraPathSegmentId(null);
        }
      },
      onMoveKeyframe: moveCameraPathKeyframe,
      onMoveTarget: moveCameraPathTarget,
      onMoveSegment: moveCameraPathSegment,
      onMoveInfluenceHandle(id, position) {
        const match = id.match(/^gd-(out|in):(.+)$/);
        if (!match) return;
        const edge = match[1] === "out" ? "from" : "to";
        const segmentId = match[2];
        const segment = captureCameraPathV3.segments.find((entry) => entry.id === segmentId);
        const node = captureCameraPathV3.nodes.find((entry) =>
          edge === "from" ? entry.id === segment?.fromNodeId : entry.id === segment?.toNodeId,
        );
        if (!node) return;
        moveCameraPathInfluenceHandle(
          segmentId,
          edge,
          Math.hypot(
            position[0] - node.position[0],
            position[1] - node.position[1],
            position[2] - node.position[2],
          ),
        );
      },
      onMoveSplineHandle(nodeId, side, position) {
        moveCameraPathSplineHandle(nodeId, side, position);
      },
      onMoveNodeAxis(nodeId, axis, delta) {
        moveCameraPathNodeAxis(nodeId, axis, delta);
      },
      onMoveFocusDistance(id, position) {
        const nodeId = id.replace(/^focus-distance:/, "");
        const node = captureCameraPathV3.nodes.find((entry) => entry.id === nodeId);
        if (!node) return;
        moveCameraPathFocusDistanceHandle(
          nodeId,
          Math.hypot(
            position[0] - node.position[0],
            position[1] - node.position[1],
            position[2] - node.position[2],
          ),
        );
      },
      onSelectEquationSegment(segmentId) {
        setSelectedCameraPathSegmentId(segmentId);
      },
      bindFocusKeyframeId: cameraPathFocusPickNodeId,
      onBindFocusPoint(id, point) {
        bindCameraPathFocusPoint(id, `focus-${id}`, point);
        setCameraPathFocusPickNodeId(null);
      },
    });
    return () => {
      unsubscribe();
    };
  }, [
    cameraPathVisible,
    cameraPathDisplayOptions,
    cameraPathPlaying,
    cameraPathScrubTimeSeconds,
    cameraPathFocusPickNodeId,
    captureScope,
    captureCameraPathV3,
    bindCameraPathFocusPoint,
    directorPanel,
    moveCameraPathFocusDistanceHandle,
    moveCameraPathInfluenceHandle,
    moveCameraPathKeyframe,
    moveCameraPathNodeAxis,
    moveCameraPathSegment,
    moveCameraPathSplineHandle,
    moveCameraPathTarget,
    pageRangeTiming,
    sceneHandle,
    selectedCameraPathNodeId,
    selectedCameraPathKeyframeId,
    selectedCameraPathSegmentId,
  ]);

  useEffect(() => {
    const selectedNode = captureCameraPathV3.nodes.find(
      (node) => node.id === (selectedCameraPathNodeId ?? selectedCameraPathKeyframeId),
    );
    const mode = cameraPathDisplayOptions.previewMonitorMode;
    const shouldShow =
      directorPanel !== "closed" &&
      cameraPathVisible &&
      captureCameraPathV3.nodes.length > 0 &&
      mode !== "off" &&
      (mode === "scrub-time" ||
        (mode === "selected-node" && !!selectedNode) ||
        (mode === "while-editing" && directorPanel === "camera-path"));
    if (!shouldShow) {
      setCameraPathPreviewMonitor((previous) =>
        previous.visible
          ? {
              visible: false,
              imageUrl: null,
              timeSeconds: 0,
              label: null,
              lookMode: null,
              focusLocked: false,
            }
          : previous,
      );
      return;
    }
    const timeSeconds =
      mode === "selected-node" && selectedNode
        ? selectedNode.timeSeconds
        : cameraPathScrubTimeSeconds;
    const sample = sampleCaptureCameraPathV3(captureCameraPathV3, timeSeconds);
    const imageUrl = sceneHandle.renderCameraPathPreviewFrame({
      pose: sample,
      width: 280,
      height: 158,
    });
    const activeNode =
      selectedNode ??
      captureCameraPathV3.nodes.reduce((closest, node) => {
        if (!closest) return node;
        return Math.abs(node.timeSeconds - timeSeconds) <
          Math.abs(closest.timeSeconds - timeSeconds)
          ? node
          : closest;
      }, null as (typeof captureCameraPathV3.nodes)[number] | null);
    setCameraPathPreviewMonitor({
      visible: true,
      imageUrl,
      timeSeconds: sample.timeSeconds,
      label: activeNode
        ? `${activeNode.kind === "transition" ? "Transition" : "Keyframe"} ${activeNode.id}`
        : "Camera Preview",
      lookMode: activeNode?.aimGeometry.mode ?? "free-direction",
      focusLocked: activeNode?.aimGeometry.mode === "focus-point-lock",
    });
  }, [
    cameraPathDisplayOptions.previewMonitorMode,
    cameraPathScrubTimeSeconds,
    cameraPathVisible,
    captureCameraPathV3,
    directorPanel,
    sceneHandle,
    selectedCameraPathKeyframeId,
    selectedCameraPathNodeId,
  ]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !captureDirectorLocalTestSeamAllowed()
    ) {
      return;
    }
    const bridge = {
      renderTile: (
        job: CaptureStillRenderJobV1,
        tile: CaptureStillTileSpec,
        frameIndex?: number,
      ) => exportDeterministicStillTile({ sceneHandle, job, tile, frameIndex }),
      capabilities: () => ({
        ...sceneHandle.getCaptureCapabilities(),
        supportsViewOffsetTiles: true as const,
      }),
    };
    window.__geoseeCaptureStillRenderer = bridge;
    return () => {
      if (window.__geoseeCaptureStillRenderer === bridge) {
        delete window.__geoseeCaptureStillRenderer;
      }
    };
  }, [sceneHandle]);


  const clearRecipeOutput = useCallback(() => {
    revokeRecipeOutputUrl();
    setRecipeOutputUrl(null);
    setRecipeOutputFilename(null);
  }, [revokeRecipeOutputUrl]);

  const publishExternalStillJob = useCallback(
    ({
      recipe,
      failureReason,
    }: {
      recipe: CaptureRecipeV1;
      failureReason: string;
    }) => {
      revokeExternalStillJobUrl();
      const job = createExternalStillRenderJob({
        recipe,
        stillOptions: {
          type: screenCaptureType,
          quality: normalizeCaptureStillQuality(
            screenCaptureType,
            screenCaptureQuality,
          ),
        },
        failureReason,
        appUrl:
          typeof window === "undefined"
            ? null
            : `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(
                recipe.projectSlug,
              )}`,
      });
      const blob = new Blob([serializeExternalStillRenderJob(job)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const filename = externalStillRenderJobFilename(job);
      externalStillJobUrlRef.current = url;
      setExternalStillJobUrl(url);
      setExternalStillJobFilename(filename);
      setExternalStillJobCommand(externalStillRenderCommand(filename, job));
      setScreenCaptureSaveMessage(
        "Browser cannot render this still at the requested size. External still render job ready.",
      );
    },
    [
      revokeExternalStillJobUrl,
      screenCaptureQuality,
      screenCaptureType,
    ],
  );

  const publishExternalVideoJob = useCallback(
    ({
      recipe,
      format,
      message,
    }: {
      recipe: CaptureRecipeV1;
      format: CaptureDeterministicExportFormat;
      message: string;
    }) => {
      revokeExternalVideoJobUrl();
      const job = createExternalVideoRenderJob({
        recipe,
        format,
        appUrl:
          typeof window === "undefined"
            ? null
            : `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(
                recipe.projectSlug,
              )}`,
      });
      const blob = new Blob([serializeExternalVideoRenderJob(job)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const filename = externalVideoRenderJobFilename(job);
      externalVideoJobUrlRef.current = url;
      setExternalVideoJobUrl(url);
      setExternalVideoJobFilename(filename);
      setExternalVideoJobCommand(externalVideoRenderCommand(filename, job));
      setPathRenderSaveMessage(message);
      return { job, blob, url, filename };
    },
    [revokeExternalVideoJobUrl],
  );

  const runExternalVideoRenderJob = useCallback(
    async ({
      job,
      captureJobId,
      abortController,
      totalFrames,
      target,
    }: {
      job: CaptureVideoRenderJobV1;
      captureJobId: string;
      abortController: AbortController;
      totalFrames: number;
      target: "render-out" | "path-video";
    }): Promise<LocalVideoRenderRunStatus> => {
      const run = await startLocalVideoRenderJob({
        job,
        outputFilename: job.video.filename,
      });
      if (target === "path-video") {
        pathRenderLocalVideoRunIdRef.current = run.runId;
        setPathRenderSaveMessage(`External renderer started. Output: ${run.outputPath}`);
      } else {
        deterministicLocalVideoRunIdRef.current = run.runId;
      }
      updateCaptureJob(captureJobId, (entry) =>
        ({
          ...updateCaptureJobStatus(entry, "rendering", {
            progress: {
              phase: "rendering",
              renderedFrames: 0,
              totalFrames,
              percent: 0.02,
              message: `External renderer started. Output: ${run.outputPath}`,
            },
          }),
          diagnostics: {
            ...entry.diagnostics,
            localExternalVideoRunId: run.runId,
            outputPath: run.outputPath,
            diagnosticsPath: run.diagnosticsPath,
          },
        }),
      );

      let latest = run;
      while (latest.status !== "complete") {
        if (abortController.signal.aborted) {
          await cancelLocalVideoRenderJob(latest.runId).catch(() => null);
          throw new DOMException("External video render was cancelled.", "AbortError");
        }
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1000);
        });
        latest = await pollLocalVideoRenderJob(latest.runId);
        const isEncoding = latest.status === "encoding" || latest.phase === "encoding";
        const liveTotal = latest.totalFrames ?? totalFrames;
        const liveRendered = latest.renderedFrames ?? 0;
        const renderFraction = liveTotal > 0 ? liveRendered / liveTotal : 0;
        const percent = isEncoding
          ? Math.max(0.9, Math.min(0.98, 0.9 + renderFraction * 0.08))
          : Math.max(0.02, Math.min(0.88, renderFraction * 0.88));
        const gpuNote = latest.renderer ? ` · ${shortGpuName(latest.renderer)}` : "";
        const message =
          latest.status === "complete"
            ? `External render complete: ${latest.outputPath}`
            : isEncoding
              ? `Encoding ${liveTotal} frames${gpuNote}.`
              : `Rendering frame ${liveRendered}/${liveTotal}${gpuNote} (${
                  latest.elapsedSeconds ?? 0
                }s)`;
        updateCaptureJob(captureJobId, (entry) =>
          ({
            ...updateCaptureJobStatus(entry, isEncoding ? "encoding" : "rendering", {
              progress: {
                phase: isEncoding ? "encoding" : "rendering",
                renderedFrames: liveRendered,
                totalFrames: liveTotal,
                percent,
                message,
              },
            }),
            diagnostics: {
              ...entry.diagnostics,
              localExternalVideoRunId: latest.runId,
              outputPath: latest.outputPath,
              diagnosticsPath: latest.diagnosticsPath,
              masterPath: latest.masterPath ?? null,
              masterUrl: latest.masterUrl ?? null,
              frameSequenceDir: latest.frameSequenceDir ?? null,
              renderer: latest.renderer ?? null,
              superscale: latest.superscale ?? null,
              externalStatus: latest.status,
            },
          }),
        );
        if (latest.status === "failed") {
          throw new Error(latest.error ?? "External video renderer failed.");
        }
        if (latest.status === "cancelled") {
          throw new DOMException("External video render was cancelled.", "AbortError");
        }
      }
      if (target === "path-video") {
        pathRenderLocalVideoRunIdRef.current = null;
      } else {
        deterministicLocalVideoRunIdRef.current = null;
      }
      return latest;
    },
    [updateCaptureJob],
  );

  const createRecipeSnapshot = useCallback((options?: {
    page?: PresentationPage | null;
    pageIndex?: number;
    pageId?: string | null;
    durationSeconds?: number;
    camera?: Pose | null;
    cameraKeyframes?: CaptureCameraKeyframe[];
    cameraPath?: CaptureCameraPathV1 | CaptureCameraPathV2 | CaptureCameraPathV3 | null;
    captureScope?: CaptureScope;
    pageRangeStartId?: string | null;
    pageRangeEndId?: string | null;
    pageRangeTiming?: CapturePageRangeTiming;
    equalHoldSeconds?: number | null;
    captureTimeline?: CaptureTimelineState | null;
    useLoadedLayerState?: boolean;
  }): CaptureRecipeV1 => {
    const recipePage = options?.page === undefined ? currentPage : options.page;
    const recipeCaptureScope = options?.captureScope ?? captureScope;
    const recipeLayerState = captureRecipeLayerState({
      environment: state.environment,
      page: recipePage,
      layerIds: state.manifest.layers.map((layer) => layer.id),
    });
    const useLoadedLayerState = options?.useLoadedLayerState ?? true;
    const recipeDurationSeconds =
      options?.durationSeconds ??
      (captureScope === "page-range" && capturePageRange.valid
        ? Math.max(0.1, capturePageRange.totalFrames / fps)
        : Math.max(0.1, cameraPathDurationSeconds || deterministicDurationSeconds));
    const normalizedCurrentCameraPath = normalizeCaptureCameraPathV3(captureCameraPathV3);
    const cameraPathForRecipeSnapshot =
      options?.cameraPath === undefined
        ? normalizedCurrentCameraPath.nodes.length > 0 &&
          captureCameraPathV3Renderable(normalizedCurrentCameraPath)
          ? normalizedCurrentCameraPath
          : null
        : options.cameraPath?.version === 3
          ? normalizeCaptureCameraPathV3(options.cameraPath)
          : options.cameraPath?.version === 2
            ? upgradeCaptureCameraPathV2ToV3(options.cameraPath)
            : options.cameraPath;
    const currentRecipe = createCaptureRecipeFromCurrentState({
      projectSlug: loadedRecipe?.projectSlug ?? state.projectSlug ?? state.manifest.id,
      pageId:
        options?.pageId ??
        (options ? recipePage?.id : loadedRecipe?.pageId) ??
        recipePage?.id ??
        null,
      mode: armedMode,
      resolution: renderResolution,
      previewResolution,
      fps,
      durationSeconds: recipeDurationSeconds,
      camera:
        options?.camera ??
        (options ? null : loadedRecipe?.camera) ??
        capturePose(sceneHandle.camera, sceneHandle.controls),
      cameraKeyframes: options?.cameraKeyframes ?? cameraKeyframes,
      cameraPath: cameraPathForRecipeSnapshot,
      environmentState:
        options?.useLoadedLayerState === false
          ? state.environment
          : loadedRecipe?.environmentState ?? state.environment,
      layerVisibility: recipeLayerState.layerVisibility,
      layerStyles: recipeLayerState.layerStyles,
      visualPreset: loadedRecipe?.visualPreset ?? null,
      supersampleScale: 1,
      qualityPreset: renderResolution.qualityPreset,
      renderFidelity: "max-detail-render",
      captureScope: recipeCaptureScope,
      pageRangeStartId:
        recipeCaptureScope === "page-range"
          ? (options?.pageRangeStartId ?? pageRangeStartId)
          : null,
      pageRangeEndId:
        recipeCaptureScope === "page-range"
          ? (options?.pageRangeEndId ?? pageRangeEndId)
          : null,
      pageRangeTiming: options?.pageRangeTiming ?? pageRangeTiming,
      equalHoldSeconds: options?.equalHoldSeconds ?? equalHoldSeconds,
      captureTimeline:
        options?.captureTimeline === undefined
          ? captureTimeline
          : options.captureTimeline,
    });
    if (!loadedRecipe || !useLoadedLayerState) return currentRecipe;
    return {
      ...currentRecipe,
      layerVisibility: loadedRecipe.layerVisibility,
      layerStyles: loadedRecipe.layerStyles,
      environmentState: loadedRecipe.environmentState,
    };
  }, [
    armedMode,
    cameraKeyframes,
    cameraPathDurationSeconds,
    capturePageRange,
    captureScope,
    captureCameraPathV3,
    captureTimeline,
    currentPage,
    deterministicDurationSeconds,
    equalHoldSeconds,
    fps,
    loadedRecipe,
    pageRangeEndId,
    pageRangeStartId,
    pageRangeTiming,
    previewResolution,
    renderResolution,
    sceneHandle,
    state.environment,
    state.manifest.id,
    state.manifest.layers,
    state.projectSlug,
  ]);

  const saveRecipe = useCallback(() => {
    clearRecipeOutput();
    const recipe = createRecipeSnapshot();
    const blob = new Blob([`${JSON.stringify(recipe, null, 2)}\n`], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const filename = captureRecipeFilename(recipe);
    recipeOutputUrlRef.current = url;
    setRecipeOutputUrl(url);
    setRecipeOutputFilename(filename);
  }, [clearRecipeOutput, createRecipeSnapshot]);

  const clearLoadedRecipe = useCallback(() => {
    setLoadedRecipe(null);
    setLoadedRecipeFilename(null);
  }, []);

  const loadRecipeFromFile = useCallback(
    async (file: File) => {
      const parsed = parseCaptureRecipeJson(await file.text());
      if (!parsed.recipe) {
        setError(parsed.validation.errors.join(" "));
        return;
      }
      const recipe = parsed.recipe;
      const renderPresetId = captureResolutionPresetIdForResolution(
        recipe.resolution,
      );
      if (!renderPresetId) {
        setError("Loaded recipe uses a custom render resolution not exposed in v1.");
        return;
      }
      const previewPresetId = recipe.previewResolution
        ? captureResolutionPresetIdForResolution(recipe.previewResolution)
        : null;
      if (recipe.mode !== "off") {
        setArmedModeState(recipe.mode);
        setCaptureMode(recipe.mode);
      }
      setRenderResolutionPresetId(renderPresetId);
      if (
        previewPresetId &&
        previewPresetId !== "render-8k"
      ) {
        setPreviewResolutionPresetId(previewPresetId);
      }
      setFps(recipe.fps);
      setDeterministicDurationSeconds(recipe.durationSeconds);
      setSupersampleScale(recipe.supersampleScale);
      setCaptureScope(recipe.captureScope ?? "current-page");
      setPageRangeStartId(recipe.pageRangeStartId ?? null);
      setPageRangeEndId(recipe.pageRangeEndId ?? null);
      setPageRangeTiming(recipe.pageRangeTiming ?? "authored");
      setEqualHoldSeconds(recipe.equalHoldSeconds ?? 4);
      setCaptureTimeline(normalizeCaptureTimelineState(recipe.captureTimeline ?? null));
      const loadedCameraPathV3 =
        recipe.cameraPath && (recipe.cameraPath as { version?: number }).version === 3
          ? normalizeCaptureCameraPathV3(recipe.cameraPath as unknown as CaptureCameraPathV3)
          : recipe.cameraPath && (recipe.cameraPath as { version?: number }).version === 2
            ? upgradeCaptureCameraPathV2ToV3(
                normalizeCaptureCameraPathV2(
                  recipe.cameraPath as unknown as CaptureCameraPathV2,
                ),
              )
            : recipe.cameraPath
              ? upgradeCaptureCameraPathV2ToV3(
                  recipeKeyframesToCameraPathV2(
                    {
                      cameraKeyframes: cameraPathToRecipeKeyframes(
                        normalizeCaptureCameraPath(
                          recipe.cameraPath as unknown as CaptureCameraPathV1,
                        ),
                      ),
                      durationSeconds: recipe.durationSeconds,
                    },
                    { id: "capture-camera-path-v2", name: "Camera Path" },
                  ),
                )
              : upgradeCaptureCameraPathV2ToV3(
                  recipeKeyframesToCameraPathV2(recipe, {
                    id: "capture-camera-path-v2",
                    name: "Camera Path",
                  }),
                );
      const loadedCameraPathWithDuration =
        loadedCameraPathV3.nodes.length === 0
          ? normalizeCaptureCameraPathV3({
              ...loadedCameraPathV3,
              timeline: { durationSeconds: recipe.durationSeconds },
            })
          : loadedCameraPathV3;
      applyCaptureCameraPathV3(loadedCameraPathWithDuration);
      setSelectedCameraPathKeyframeId(loadedCameraPathWithDuration.nodes[0]?.id ?? null);
      setSelectedCameraPathNodeId(loadedCameraPathWithDuration.nodes[0]?.id ?? null);
      setLoadedRecipe(recipe);
      setLoadedRecipeFilename(file.name);
      setError(null);
    },
    [
      applyCaptureCameraPathV3,
      setDeterministicDurationSeconds,
      setEqualHoldSeconds,
      setSupersampleScale,
    ],
  );

  const startDeterministicExport = useCallback(async () => {
    if (isRecording || isDeterministicExporting || isCaptureJobRunning(activeCaptureJob)) {
      setError("Another capture job is already running.");
      return;
    }
    if (armedMode === "full-ui") {
      setError("Deterministic export is available for scene marketing modes, not Full UI.");
      return;
    }
    if (captureScope === "page-range" && !capturePageRange.valid) {
      setError(capturePageRange.errors.join(" "));
      return;
    }

    const abortController = new AbortController();
    let jobId: string | null = null;
    try {
      const timelineForExport = normalizeCaptureTimelineState(captureTimeline);
      const timelineClipsForExport = timelineForExport.pageClips.filter(
        (clip) => clip.enabled,
      );
      const hasTimelinePageClips = captureTimeline.pageClips.some(
        (clip) => clip.enabled,
      );
      const timelineDurationSeconds = timelineClipsForExport.reduce(
        (max, clip) =>
          Math.max(max, clip.startSeconds + clip.transitionSeconds + clip.holdSeconds),
        0,
      );
      const expectedFrames = Math.max(
        1,
        Math.ceil(
          (hasTimelinePageClips
            ? timelineDurationSeconds
            : captureScope === "page-range" && capturePageRange.valid
            ? capturePageRange.totalFrames / fps
            : deterministicDurationSeconds) * fps,
        ),
      );
      const job = beginCaptureJob({
        kind: "deterministic-video",
        label: "Render Out",
        abortController,
        diagnostics: {
          captureMode: armedMode,
          durationSeconds: deterministicDurationSeconds,
          fps,
          width: renderResolution.width,
          height: renderResolution.height,
          format: deterministicExportFormat,
          totalFrames: expectedFrames,
          maxDetail: true,
        },
      });
      jobId = job.id;
      updateCaptureJob(job.id, (entry) =>
        updateCaptureJobStatus(entry, "rendering", {
          progress: {
            phase: "rendering",
            renderedFrames: 0,
            totalFrames: expectedFrames,
          },
        }),
      );
    } catch (jobError) {
      setError(formatCaptureError(jobError));
      return;
    }
    deterministicAbortRef.current = abortController;
    revokeDeterministicOutputUrl();
    setDeterministicOutputUrl(null);
    setDeterministicOutputBlob(null);
    setDeterministicOutputFilename(null);
    setDeterministicExportProgress({ renderedFrames: 0, totalFrames: 0 });
    setError(null);
    setCaptureMode(armedMode);
    setDeterministicExportStatus("rendering");

    try {
      const recipe = createRecipeSnapshot();
      const renderValidation = validateRenderResolutionRequest({
        resolution: renderResolution,
        supersampleScale: recipe.supersampleScale,
        ...captureCapabilitiesForPreflight(sceneHandle),
      });
      if (!renderValidation.valid) {
        throw new Error(renderValidation.errors.join(" "));
      }
      const expectedTotalFrames = Math.max(
        1,
        Math.ceil(recipe.durationSeconds * recipe.fps),
      );
      const timelineForExport = normalizeCaptureTimelineState(captureTimeline);
      const timelineClipsForExport = timelineForExport.pageClips.filter(
        (clip) => clip.enabled,
      );
      const hasTimelinePageClips = captureTimeline.pageClips.some(
        (clip) => clip.enabled,
      );
      const timelineTotalFrames = Math.max(
        1,
        Math.ceil(
          timelineClipsForExport.reduce(
            (max, clip) =>
              Math.max(
                max,
                clip.startSeconds + clip.transitionSeconds + clip.holdSeconds,
              ),
            0,
          ) * fps,
        ),
      );
      const resolvedTotalFrames =
        hasTimelinePageClips
          ? timelineTotalFrames
          : captureScope === "page-range" && capturePageRange.valid
          ? capturePageRange.totalFrames
          : expectedTotalFrames;
      const videoRecipe = {
        ...recipe,
        durationSeconds: Math.max(1 / fps, resolvedTotalFrames / fps),
      };
      if (shouldDefaultToExternalVideoRenderJob(videoRecipe)) {
        const externalJob = createExternalVideoRenderJob({
          recipe: videoRecipe,
          format: deterministicExportFormat,
          appUrl:
            typeof window === "undefined"
              ? null
              : `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(
                  videoRecipe.projectSlug,
                )}`,
        });
        setDeterministicExportProgress({
          renderedFrames: 0,
          totalFrames: resolvedTotalFrames,
        });
        setDeterministicExportStatus("rendering");
        try {
          if (!jobId) throw new Error("Capture job id missing.");
          const rendered = await runExternalVideoRenderJob({
            job: externalJob,
            captureJobId: jobId,
            abortController,
            totalFrames: resolvedTotalFrames,
            target: "render-out",
          });
          setDeterministicOutputBlob(null);
          setDeterministicOutputUrl(rendered.outputUrl);
          setDeterministicOutputFilename(rendered.outputFilename);
          setDeterministicExportStatus("complete");
          setCaptureMode("off");
          finishCaptureJob(jobId, (entry) =>
            completeCaptureJob(entry, {
              output: {
                blob: null,
                url: rendered.outputUrl,
                filename: rendered.outputFilename,
                mimeType:
                  deterministicExportFormat === "webm" ? "video/webm" : "video/mp4",
              },
              diagnostics: {
                externalVideoJob: true,
                localExternalVideoRunId: rendered.runId,
                outputPath: rendered.outputPath,
                diagnosticsPath: rendered.diagnosticsPath,
                masterUrl: rendered.masterUrl ?? null,
                masterPath: rendered.masterPath ?? null,
                frameSequenceDir: rendered.frameSequenceDir ?? null,
                renderer: rendered.renderer ?? null,
                superscale: rendered.superscale ?? null,
                totalFrames: resolvedTotalFrames,
                format: deterministicExportFormat,
                width: videoRecipe.resolution.width,
                height: videoRecipe.resolution.height,
              },
              progress: {
                phase: "complete",
                renderedFrames: resolvedTotalFrames,
                totalFrames: resolvedTotalFrames,
                percent: 1,
                message: `External video render complete: ${rendered.outputPath}`,
              },
            }),
          );
        } catch (localRenderError) {
          if (
            abortController.signal.aborted ||
            (localRenderError instanceof DOMException &&
              localRenderError.name === "AbortError")
          ) {
            throw localRenderError;
          }
          const external = publishExternalVideoJob({
            recipe: videoRecipe,
            format: deterministicExportFormat,
            message: `Local renderer unavailable: ${formatCaptureError(
              localRenderError,
            )}. External video job JSON ready as fallback.`,
          });
          setDeterministicExportStatus("idle");
          setCaptureMode("off");
          if (jobId) {
            finishCaptureJob(jobId, (entry) =>
              completeCaptureJob(entry, {
                output: {
                  blob: external.blob,
                  url: external.url,
                  filename: external.filename,
                  mimeType: "application/json",
                  byteLength: external.blob.size,
                },
                diagnostics: {
                  externalVideoJob: true,
                  fallbackOnly: true,
                  localRendererError: formatCaptureError(localRenderError),
                  externalVideoJobId: external.job.jobId,
                  outputByteLength: external.blob.size,
                  totalFrames: resolvedTotalFrames,
                  format: deterministicExportFormat,
                  width: videoRecipe.resolution.width,
                  height: videoRecipe.resolution.height,
                },
                progress: {
                  phase: "complete",
                  renderedFrames: 0,
                  totalFrames: resolvedTotalFrames,
                  percent: 1,
                  message:
                    "Local renderer unavailable. External video job JSON ready as fallback.",
                },
              }),
            );
          }
        }
        return;
      }
      setDeterministicExportProgress({
        renderedFrames: 0,
        totalFrames: resolvedTotalFrames,
      });
      let sequence: DeterministicFrameSequenceResult;
      if (hasTimelinePageClips) {
        const segmentSequences: DeterministicFrameSequenceResult[] = [];
        let renderedFrames = 0;
        for (const clip of timelineClipsForExport) {
          const page = pages.find((entry) => entry.id === clip.pageId) as
            | PresentationPage
            | undefined;
          if (!page) {
            throw new Error(`Page Bar clip "${clip.label}" no longer has a page.`);
          }
          const segmentDurationSeconds = Math.max(
            1 / fps,
            clip.transitionSeconds + clip.holdSeconds,
          );
          const segmentRecipe = createRecipeSnapshot({
            page,
            pageId: page.id,
            durationSeconds: segmentDurationSeconds,
            camera: clonePoseForCapture(page.camera),
            cameraKeyframes: [],
            captureScope: "current-page",
            captureTimeline: timelineForExport,
            useLoadedLayerState: false,
          });
          const pageIndex = pages.findIndex((entry) => entry.id === page.id);
          const segment = await exportDeterministicFrameSequence({
            sceneHandle,
            recipe: segmentRecipe,
            signal: abortController.signal,
            filenamePrefix: `geosee-${recipe.projectSlug}-${page.id}-${recipe.resolution.label}`,
            timeOffsetSeconds: clip.startSeconds,
            overlayContext: () => overlayContext(page, pageIndex),
            onFrame() {
              renderedFrames += 1;
              setDeterministicExportProgress({
                renderedFrames,
                totalFrames: resolvedTotalFrames,
              });
              if (jobId) {
                updateCaptureJob(jobId, (entry) =>
                  updateCaptureJobProgress(entry, {
                    phase: "rendering",
                    renderedFrames,
                    totalFrames: resolvedTotalFrames,
                  }),
                );
              }
            },
          });
          segmentSequences.push(segment);
        }
        sequence = combineDeterministicSequences({
          recipe: {
            ...recipe,
            captureTimeline: timelineForExport,
            durationSeconds: Math.max(1 / fps, resolvedTotalFrames / fps),
          },
          sequences: segmentSequences,
        });
      } else if (captureScope === "page-range" && capturePageRange.valid) {
        const segmentSequences: DeterministicFrameSequenceResult[] = [];
        let renderedFrames = 0;
        for (let index = 0; index < capturePageRange.pages.length; index += 1) {
          const page = capturePageRange.pages[index] as PresentationPage;
          const previousPage =
            index > 0 ? (capturePageRange.pages[index - 1] as PresentationPage) : null;
          const segmentDurationSeconds = Math.max(
            1 / fps,
            capturePageRange.segmentDurationsSeconds[index] ?? 1 / fps,
          );
          const segmentRecipe = createRecipeSnapshot({
            page,
            pageId: page.id,
            durationSeconds: segmentDurationSeconds,
            camera: clonePoseForCapture(page.camera),
            cameraKeyframes: pageRangeSegmentCameraKeyframes({
              page,
              previousPage,
              durationSeconds: segmentDurationSeconds,
              timing: pageRangeTiming,
            }),
            cameraPath: null,
            captureScope: "page-range",
            pageRangeStartId,
            pageRangeEndId,
            pageRangeTiming,
            equalHoldSeconds,
            useLoadedLayerState: false,
          });
          const pageIndex = pages.findIndex((entry) => entry.id === page.id);
          const segment = await exportDeterministicFrameSequence({
            sceneHandle,
            recipe: segmentRecipe,
            signal: abortController.signal,
            filenamePrefix: `geosee-${recipe.projectSlug}-${page.id}-${recipe.resolution.label}`,
            overlayContext: () => overlayContext(page, pageIndex),
            onFrame() {
              renderedFrames += 1;
              setDeterministicExportProgress({
                renderedFrames,
                totalFrames: resolvedTotalFrames,
              });
              if (jobId) {
                updateCaptureJob(jobId, (entry) =>
                  updateCaptureJobProgress(entry, {
                    phase: "rendering",
                    renderedFrames,
                    totalFrames: resolvedTotalFrames,
                  }),
                );
              }
            },
          });
          segmentSequences.push(segment);
        }
        sequence = combineDeterministicSequences({
          recipe,
          sequences: segmentSequences,
        });
      } else {
        sequence = await exportDeterministicFrameSequence({
          sceneHandle,
          recipe,
          signal: abortController.signal,
          filenamePrefix: `geosee-${recipe.projectSlug}-${recipe.resolution.label}`,
          overlayContext: () => overlayContext(),
          onFrame(frame) {
            setDeterministicExportProgress({
              renderedFrames: frame.frameIndex + 1,
              totalFrames: resolvedTotalFrames,
            });
            if (jobId) {
              updateCaptureJob(jobId, (entry) =>
                updateCaptureJobProgress(entry, {
                  phase: "rendering",
                  renderedFrames: frame.frameIndex + 1,
                  totalFrames: resolvedTotalFrames,
                }),
              );
            }
          },
        });
      }
      setDeterministicExportStatus("encoding");
      if (jobId) {
        updateCaptureJob(jobId, (entry) =>
          updateCaptureJobStatus(entry, "encoding", {
            progress: {
              phase: "encoding",
              renderedFrames: resolvedTotalFrames,
              totalFrames: resolvedTotalFrames,
            },
          }),
        );
      }
      const runtimeHandle = createBrowserFfmpegFrameSequenceRuntime({
        signal: abortController.signal,
      });
      deterministicRuntimeHandleRef.current = runtimeHandle;
      try {
        const encoded = await encodeDeterministicFrameSequenceWithFfmpeg({
          sequence,
          runtime: runtimeHandle.runtime,
          signal: abortController.signal,
          execTimeoutMs: 10 * 60 * 1000,
          stallTimeoutMs: 2 * 60 * 1000,
          onProgress(progress) {
            if (!jobId) return;
            updateCaptureJob(jobId, (entry) =>
              updateCaptureJobProgress(entry, {
                phase: progress.phase,
                renderedFrames: resolvedTotalFrames,
                totalFrames: resolvedTotalFrames,
                writtenFrames: progress.framesWritten,
                percent: progress.percent,
                message: progress.message,
              }),
            );
          },
          preset:
            deterministicExportFormat === "webm"
              ? "webm-vp9-marketing"
              : "mp4-h264-marketing",
          outputBasename: `geosee-${recipe.projectSlug}-${recipe.resolution.label}`,
          cleanupInputFrames: true,
        });
        deterministicOutputCleanupRef.current = encoded.cleanup;
        setDeterministicOutputBlob(encoded.blob);
        setDeterministicOutputUrl(encoded.url);
        setDeterministicOutputFilename(encoded.filename);
        setDeterministicExportStatus("complete");
        if (jobId) {
          finishCaptureJob(jobId, (entry) =>
            completeCaptureJob(entry, {
              output: {
                blob: encoded.blob,
                url: encoded.url,
                filename: encoded.filename,
                mimeType: encoded.mimeType,
                byteLength: encoded.blob.size,
                cleanup: encoded.cleanup,
              },
              diagnostics: captureVideoOutputDiagnostics({
                outputByteLength: encoded.blob.size,
                encoderPreset:
                  deterministicExportFormat === "webm"
                    ? "webm-vp9-marketing"
                    : "mp4-h264-marketing",
                mimeType: encoded.mimeType,
                filename: encoded.filename,
              }),
            }),
          );
        }
      } finally {
        runtimeHandle.dispose();
        if (deterministicRuntimeHandleRef.current === runtimeHandle) {
          deterministicRuntimeHandleRef.current = null;
        }
      }
      setCaptureMode("off");
    } catch (exportError) {
      setCaptureMode("off");
      setDeterministicExportStatus("idle");
      if (
        abortController.signal.aborted ||
        (exportError instanceof DOMException && exportError.name === "AbortError")
      ) {
        setError("Deterministic export was cancelled.");
        if (jobId) {
          finishCaptureJob(jobId, (entry) =>
            cancelCaptureJob(entry, { reason: "Deterministic export was cancelled." }),
          );
        }
      } else {
        setError(formatCaptureError(exportError));
        if (jobId) {
          finishCaptureJob(jobId, (entry) => failCaptureJob(entry, exportError));
        }
      }
    } finally {
      deterministicAbortRef.current = null;
      deterministicRuntimeHandleRef.current = null;
    }
  }, [
    activeCaptureJob,
    armedMode,
    beginCaptureJob,
    capturePageRange,
    captureScope,
    captureTimeline,
    deterministicExportFormat,
    equalHoldSeconds,
    finishCaptureJob,
    fps,
    isDeterministicExporting,
    isRecording,
    overlayContext,
    createRecipeSnapshot,
    pageRangeEndId,
    pageRangeStartId,
    pageRangeTiming,
    pages,
    publishExternalVideoJob,
    renderResolution,
    revokeDeterministicOutputUrl,
    sceneHandle,
    updateCaptureJob,
  ]);

  const cancelPathDeterministicRender = useCallback(() => {
    clearPathRenderEncodingTimer();
    pathRenderAbortRef.current?.abort();
    const localRunId = pathRenderLocalVideoRunIdRef.current;
    if (localRunId) {
      void cancelLocalVideoRenderJob(localRunId).finally(() => {
        if (pathRenderLocalVideoRunIdRef.current === localRunId) {
          pathRenderLocalVideoRunIdRef.current = null;
        }
      });
    }
    pathRenderRuntimeHandleRef.current?.dispose();
    pathRenderRuntimeHandleRef.current = null;
  }, [clearPathRenderEncodingTimer]);

  const startPathDeterministicRender = useCallback(async () => {
    if (
      isRecording ||
      isDeterministicExporting ||
      screenCaptureStatus === "rendering" ||
      isCaptureJobRunning(activeCaptureJob)
    ) {
      setError("Another capture job is already running.");
      return;
    }
    if (armedMode === "full-ui") {
      setError("Full UI is not supported for deterministic path video.");
      return;
    }
    const validation = validateCaptureCameraPathV3Playback(captureCameraPathV3);
    if (!validation.valid) {
      setError(validation.errors.join(" "));
      return;
    }

    const normalizedPath = normalizeCaptureCameraPathV3(captureCameraPathV3);
    const pathTimeline = resolveCaptureCameraPathV3Timeline(normalizedPath);
    const totalFrames = Math.max(1, Math.ceil(pathTimeline.durationSeconds * fps));
    const abortController = new AbortController();
    let jobId: string | null = null;

    try {
      const job = beginCaptureJob({
        kind: "path-video",
        label: "Render Path Video",
        abortController,
        diagnostics: capturePathJobDiagnostics({
          mode: armedMode,
          pathVersion: normalizedPath.version,
          nodeCount: normalizedPath.nodes.length,
          segmentCount: normalizedPath.segments.length,
          durationSeconds: pathTimeline.durationSeconds,
          fps,
          resolution: renderResolution,
          format: deterministicExportFormat,
          totalFrames,
          renderedFrames: 0,
          maxDetail: true,
        }),
      });
      jobId = job.id;
    } catch (jobError) {
      setError(formatCaptureError(jobError));
      return;
    }
    const pathRenderJobId = jobId;
    if (!pathRenderJobId) return;

    pathRenderAbortRef.current = abortController;
    clearPathRenderOutput();
    setError(null);
    setCaptureMode(armedMode);
    updateCaptureJob(pathRenderJobId, (entry) =>
      updateCaptureJobStatus(entry, "rendering", {
        progress: {
          phase: "rendering",
          renderedFrames: 0,
          totalFrames,
        },
      }),
    );

    try {
      const recipe = createRecipeSnapshot({
        durationSeconds: pathTimeline.durationSeconds,
        cameraPath: normalizedPath,
        cameraKeyframes: cameraPathV3ToRecipeKeyframes(normalizedPath, fps),
        captureScope: "current-page",
        pageRangeStartId: null,
        pageRangeEndId: null,
        useLoadedLayerState: true,
      });
      if (shouldDefaultToExternalVideoRenderJob(recipe)) {
        const externalJob = createExternalVideoRenderJob({
          recipe,
          format: deterministicExportFormat,
          appUrl:
            typeof window === "undefined"
              ? null
              : `${window.location.origin}${window.location.pathname}?project=${encodeURIComponent(
                  recipe.projectSlug,
                )}`,
        });
        try {
          const rendered = await runExternalVideoRenderJob({
            job: externalJob,
            captureJobId: pathRenderJobId,
            abortController,
            totalFrames,
            target: "path-video",
          });
          setPathRenderOutputBlob(null);
          setPathRenderOutputUrl(rendered.outputUrl);
          setPathRenderOutputFilename(rendered.outputFilename);
          setPathRenderSaveMessage(`External path video render complete: ${rendered.outputPath}`);
          setCaptureMode("off");
          finishCaptureJob(pathRenderJobId, (entry) =>
            completeCaptureJob(entry, {
              output: {
                blob: null,
                url: rendered.outputUrl,
                filename: rendered.outputFilename,
                mimeType:
                  deterministicExportFormat === "webm" ? "video/webm" : "video/mp4",
              },
              diagnostics: {
                externalVideoJob: true,
                localExternalVideoRunId: rendered.runId,
                outputPath: rendered.outputPath,
                diagnosticsPath: rendered.diagnosticsPath,
                masterUrl: rendered.masterUrl ?? null,
                masterPath: rendered.masterPath ?? null,
                frameSequenceDir: rendered.frameSequenceDir ?? null,
                renderer: rendered.renderer ?? null,
                superscale: rendered.superscale ?? null,
                totalFrames,
                format: deterministicExportFormat,
                width: recipe.resolution.width,
                height: recipe.resolution.height,
              },
              progress: {
                phase: "complete",
                renderedFrames: totalFrames,
                totalFrames,
                percent: 1,
                message: `External path video render complete: ${rendered.outputPath}`,
              },
            }),
          );
        } catch (localRenderError) {
          if (
            abortController.signal.aborted ||
            (localRenderError instanceof DOMException &&
              localRenderError.name === "AbortError")
          ) {
            throw localRenderError;
          }
          const external = publishExternalVideoJob({
            recipe,
            format: deterministicExportFormat,
            message: `Local renderer unavailable: ${formatCaptureError(
              localRenderError,
            )}. External path video job JSON ready as fallback.`,
          });
          setCaptureMode("off");
          finishCaptureJob(pathRenderJobId, (entry) =>
            completeCaptureJob(entry, {
              output: {
                blob: external.blob,
                url: external.url,
                filename: external.filename,
                mimeType: "application/json",
                byteLength: external.blob.size,
              },
              diagnostics: {
                externalVideoJob: true,
                fallbackOnly: true,
                localRendererError: formatCaptureError(localRenderError),
                externalVideoJobId: external.job.jobId,
                outputByteLength: external.blob.size,
                totalFrames,
                format: deterministicExportFormat,
                width: recipe.resolution.width,
                height: recipe.resolution.height,
              },
              progress: {
                phase: "complete",
                renderedFrames: 0,
                totalFrames,
                percent: 1,
                message:
                  "Local renderer unavailable. External path video job JSON ready as fallback.",
              },
            }),
          );
        }
        return;
      }
      const sequence = await exportDeterministicFrameSequence({
        sceneHandle,
        recipe,
        signal: abortController.signal,
        filenamePrefix: `geosee-${recipe.projectSlug}-path-${recipe.resolution.label}`,
        overlayContext: () => overlayContext(),
        onFrame(frame) {
          updateCaptureJob(pathRenderJobId, (entry) =>
            updateCaptureJobProgress(entry, {
              phase: "rendering",
              renderedFrames: frame.frameIndex + 1,
              totalFrames,
            }),
          );
        },
      });
      updateCaptureJob(pathRenderJobId, (entry) =>
        updateCaptureJobStatus(entry, "encoding", {
          progress: {
            phase: "encoding",
            renderedFrames: totalFrames,
            totalFrames,
            percent: 0.98,
            message:
              "Encoding path video. No file has been saved yet; save/download appears after encoding completes.",
          },
        }),
      );
      startPathRenderEncodingTimer({
        jobId: pathRenderJobId,
        totalFrames,
        format: deterministicExportFormat,
      });
      const runtimeHandle = createBrowserFfmpegFrameSequenceRuntime({
        signal: abortController.signal,
      });
      pathRenderRuntimeHandleRef.current = runtimeHandle;
      try {
        const encoded = await encodeDeterministicFrameSequenceWithFfmpeg({
          sequence,
          runtime: runtimeHandle.runtime,
          signal: abortController.signal,
          execTimeoutMs: 10 * 60 * 1000,
          stallTimeoutMs: 2 * 60 * 1000,
          onProgress(progress) {
            updateCaptureJob(pathRenderJobId, (entry) =>
              updateCaptureJobProgress(entry, {
                phase: progress.phase,
                renderedFrames: totalFrames,
                totalFrames,
                writtenFrames: progress.framesWritten,
                percent: progress.percent,
                message: progress.message,
              }),
            );
          },
          preset:
            deterministicExportFormat === "webm"
              ? "webm-vp9-marketing"
              : "mp4-h264-marketing",
          outputBasename: `geosee-${recipe.projectSlug}-path-${recipe.resolution.label}`,
          cleanupInputFrames: true,
        });
        if (encoded.blob.size <= 0) {
          encoded.cleanup();
          throw new Error("Rendered path video produced no video data.");
        }
        pathRenderOutputCleanupRef.current = encoded.cleanup;
        setPathRenderOutputBlob(encoded.blob);
        setPathRenderOutputUrl(encoded.url);
        setPathRenderOutputFilename(encoded.filename);
        setPathRenderSaveMessage("Rendered path video ready. Save or download the file.");
        finishCaptureJob(pathRenderJobId, (entry) =>
          completeCaptureJob(entry, {
            output: {
              blob: encoded.blob,
              url: encoded.url,
              filename: encoded.filename,
              mimeType: encoded.mimeType,
              byteLength: encoded.blob.size,
              cleanup: encoded.cleanup,
            },
            diagnostics: captureVideoOutputDiagnostics({
              outputByteLength: encoded.blob.size,
              encoderPreset:
                deterministicExportFormat === "webm"
                  ? "webm-vp9-marketing"
                  : "mp4-h264-marketing",
              mimeType: encoded.mimeType,
              filename: encoded.filename,
            }),
          }),
        );
      } finally {
        runtimeHandle.dispose();
        if (pathRenderRuntimeHandleRef.current === runtimeHandle) {
          pathRenderRuntimeHandleRef.current = null;
        }
      }
      setCaptureMode("off");
    } catch (pathRenderError) {
      setCaptureMode("off");
      clearPathRenderOutput();
      if (
        abortController.signal.aborted ||
        (pathRenderError instanceof DOMException &&
          pathRenderError.name === "AbortError")
      ) {
        setError("Rendered path video was cancelled.");
        finishCaptureJob(pathRenderJobId, (entry) =>
          cancelCaptureJob(entry, { reason: "Rendered path video was cancelled." }),
        );
      } else {
        setError(formatCaptureError(pathRenderError));
        finishCaptureJob(pathRenderJobId, (entry) =>
          failCaptureJob(entry, pathRenderError),
        );
      }
    } finally {
      clearPathRenderEncodingTimer();
      pathRenderAbortRef.current = null;
      pathRenderRuntimeHandleRef.current = null;
    }
  }, [
    activeCaptureJob,
    armedMode,
    beginCaptureJob,
    captureCameraPathV3,
    clearPathRenderOutput,
    createRecipeSnapshot,
    deterministicExportFormat,
    finishCaptureJob,
    fps,
    isDeterministicExporting,
    isRecording,
    overlayContext,
    publishExternalVideoJob,
    renderResolution,
    sceneHandle,
    screenCaptureStatus,
    startPathRenderEncodingTimer,
    clearPathRenderEncodingTimer,
    updateCaptureJob,
  ]);

  const savePathRenderVideo = useCallback(async () => {
    if (!pathRenderOutputBlob) {
      setPathRenderSaveMessage("Render Path Video has not produced a file yet.");
      return;
    }
    const type: CaptureVideoFileType =
      deterministicExportFormat === "webm" ? "webm" : "mp4";
    try {
      const result = await saveCaptureVideoBlobWithPicker({
        blob: pathRenderOutputBlob,
        filename:
          pathRenderOutputFilename ?? `geosee-rendered-path.${deterministicExportFormat}`,
        type,
      });
      setPathRenderSaveMessage(
        result.status === "saved"
          ? "Rendered path video saved."
          : result.status === "cancelled"
            ? "Rendered path video save was cancelled."
            : "Save picker unavailable. Use the download link.",
      );
    } catch (saveError) {
      setPathRenderSaveMessage(null);
      setError(formatCaptureError(saveError));
    }
  }, [
    deterministicExportFormat,
    pathRenderOutputBlob,
    pathRenderOutputFilename,
  ]);

  const startScreenCapture = useCallback(async () => {
    if (
      isRecording ||
      isDeterministicExporting ||
      screenCaptureStatus === "rendering" ||
      isCaptureJobRunning(activeCaptureJob)
    ) {
      setError("Another capture job is already running.");
      return;
    }
    const stillQuality = normalizeCaptureStillQuality(
      screenCaptureType,
      screenCaptureQuality,
    );
    const saveValidation = validateCaptureStillSaveOptions({
      type: screenCaptureType,
      quality: stillQuality,
    });
    if (!saveValidation.valid) {
      setError(saveValidation.errors.join(" "));
      return;
    }
    clearScreenCaptureOutput();
    setScreenCaptureStatus("rendering");
    setScreenCaptureSaveMessage(null);
    setError(null);
    setScreenCaptureOptionsOpen(false);
    let stillJobId: string | null = null;
    try {
      const job = beginCaptureJob({
        kind: "still",
        label: "Still Capture",
        diagnostics: {
          captureMode: armedMode,
          width: renderResolution.width,
          height: renderResolution.height,
          stillType: screenCaptureType,
          maxDetail: armedMode !== "full-ui",
        },
      });
      stillJobId = job.id;
      updateCaptureJob(job.id, (entry) =>
        updateCaptureJobStatus(entry, "rendering", {
          progress: { phase: "rendering", percent: 0 },
        }),
      );
    } catch (jobError) {
      setScreenCaptureStatus("idle");
      setError(formatCaptureError(jobError));
      return;
    }
    const activeStillJobId = stillJobId;
    if (!activeStillJobId) return;
    const mimeType = captureStillMimeType(screenCaptureType) as
      | "image/png"
      | "image/webp"
      | "image/jpeg";

    try {
      if (armedMode === "full-ui") {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          throw new Error("Full UI Screen Capture is not available in this browser.");
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
        try {
          const video = document.createElement("video");
          video.muted = true;
          video.srcObject = stream;
          await video.play();
          const width = video.videoWidth || window.innerWidth;
          const height = video.videoHeight || window.innerHeight;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) {
            throw new Error("Full UI Screen Capture canvas could not be created.");
          }
          ctx.drawImage(video, 0, 0, width, height);
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((nextBlob) => {
              if (!nextBlob) {
                reject(new Error("Full UI Screen Capture image encoding failed."));
                return;
              }
              resolve(nextBlob);
            }, mimeType, stillQuality);
          });
          validateStillBlob(blob);
          const filename = captureStillFilename(
            "geosee-full-ui-screen-capture",
            screenCaptureType,
          );
          const saveResult = await saveCaptureStillBlobWithPicker({
            blob,
            filename,
            type: screenCaptureType,
          });
          if (saveResult.status === "cancelled") {
            setScreenCaptureStatus("idle");
            setError("Screen Capture save was cancelled.");
            finishCaptureJob(activeStillJobId, (job) =>
              cancelCaptureJob(job, { reason: "Screen Capture save was cancelled." }),
            );
            return;
          }
          const url = URL.createObjectURL(blob);
          screenCaptureOutputCleanupRef.current = () => URL.revokeObjectURL(url);
          setScreenCaptureOutputBlob(blob);
          setScreenCaptureOutputUrl(url);
          setScreenCaptureOutputFilename(filename);
          setScreenCaptureSaveMessage(
            saveResult.status === "saved"
              ? "Screen Capture saved. Download link ready."
              : "Save picker unavailable. Download link ready.",
          );
          setScreenCaptureStatus("complete");
          finishCaptureJob(activeStillJobId, (job) =>
            completeCaptureJob(job, {
              output: {
                blob,
                url,
                filename,
                mimeType,
                byteLength: blob.size,
                cleanup: () => URL.revokeObjectURL(url),
              },
              diagnostics: {
                outputByteLength: blob.size,
                saveDestination: saveResult.status,
              },
            }),
          );
        } finally {
          for (const track of stream.getTracks()) {
            track.stop();
          }
        }
        return;
      }

      setCaptureMode(armedMode);
      const recipe = createRecipeSnapshot();
      const stillRenderValidation = validateRenderResolutionRequest({
        resolution: recipe.resolution,
        supersampleScale: recipe.supersampleScale,
        ...captureCapabilitiesForPreflight(sceneHandle),
      });
      if (!stillRenderValidation.valid) {
        throw new Error(stillRenderValidation.errors.join(" "));
      }
      const still = await exportDeterministicStill({
        sceneHandle,
        recipe,
        cameraPose: capturePose(sceneHandle.camera, sceneHandle.controls),
        useCurrentSceneState: true,
        timeSeconds: Math.min(
          deterministicDurationSeconds,
          cameraKeyframes[0]?.timeSeconds ?? 0,
        ),
        mimeType,
        imageQuality: stillQuality ?? 0.92,
        filenamePrefix: `geosee-${recipe.projectSlug}-${recipe.resolution.label}`,
        overlayContext: () => overlayContext(),
      });
      const saveFilename = captureStillFilename(still.filename, screenCaptureType);
      const saveResult = await saveCaptureStillBlobWithPicker({
        blob: still.blob,
        filename: saveFilename,
        type: screenCaptureType,
      });
      if (saveResult.status === "cancelled") {
        still.cleanup();
        setScreenCaptureStatus("idle");
        setError("Screen Capture save was cancelled.");
        setCaptureMode("off");
        finishCaptureJob(activeStillJobId, (job) =>
          cancelCaptureJob(job, { reason: "Screen Capture save was cancelled." }),
        );
        return;
      }
      screenCaptureOutputCleanupRef.current = still.cleanup;
      setScreenCaptureOutputBlob(still.blob);
      setScreenCaptureOutputUrl(still.url);
      setScreenCaptureOutputFilename(saveFilename);
      setScreenCaptureSaveMessage(
        saveResult.status === "saved"
          ? "Screen Capture saved. Download link ready."
          : "Save picker unavailable. Download link ready.",
      );
      setScreenCaptureStatus("complete");
      setCaptureMode("off");
      finishCaptureJob(activeStillJobId, (job) =>
        completeCaptureJob(job, {
          output: {
            blob: still.blob,
            url: still.url,
            filename: saveFilename,
            mimeType,
            byteLength: still.blob.size,
            cleanup: still.cleanup,
          },
          diagnostics: {
            outputByteLength: still.blob.size,
            saveDestination: saveResult.status,
          },
        }),
      );
    } catch (captureError) {
      const message = formatCaptureError(captureError);
      let createdExternalStillJob = false;
      if (
        armedMode !== "full-ui" &&
        /render output is not available|exceeds/i.test(message)
      ) {
        try {
          publishExternalStillJob({
            recipe: createRecipeSnapshot(),
            failureReason: message,
          });
          createdExternalStillJob = true;
        } catch {
          // Keep the original capture error if the fallback job cannot be created.
        }
      }
      setScreenCaptureStatus("idle");
      setCaptureMode("off");
      if (!externalStillJobUrlRef.current) {
        clearScreenCaptureOutput();
        setError(message);
      } else {
        setError(message);
      }
      if (createdExternalStillJob) {
        finishCaptureJob(activeStillJobId, (job) =>
          completeCaptureJob(job, {
            diagnostics: {
              saveDestination: "external-job",
              fallbackReason: message,
            },
          }),
        );
      } else {
        finishCaptureJob(activeStillJobId, (job) => failCaptureJob(job, captureError));
      }
    }
  }, [
    activeCaptureJob,
    armedMode,
    beginCaptureJob,
    cameraKeyframes,
    clearScreenCaptureOutput,
    createRecipeSnapshot,
    deterministicDurationSeconds,
    finishCaptureJob,
    isDeterministicExporting,
    isRecording,
    overlayContext,
    publishExternalStillJob,
    renderResolution.height,
    renderResolution.width,
    sceneHandle,
    screenCaptureQuality,
    screenCaptureStatus,
    screenCaptureType,
  ]);

  useEffect(() => {
    return () => {
      deterministicAbortRef.current?.abort();
      deterministicAbortRef.current = null;
      deterministicRuntimeHandleRef.current?.dispose();
      deterministicRuntimeHandleRef.current = null;
      pathRenderAbortRef.current?.abort();
      pathRenderAbortRef.current = null;
      pathRenderRuntimeHandleRef.current?.dispose();
      pathRenderRuntimeHandleRef.current = null;
      clearElapsedTimer();
      void recorderRef.current?.stop().catch(() => undefined);
      restoreCaptureSize();
      revokeOutputUrl();
      revokePathPreviewMp4OutputUrl();
      revokeDeterministicOutputUrl();
      revokePathRenderOutputUrl();
      revokeScreenCaptureOutputUrl();
      revokeRecipeOutputUrl();
      revokeCameraPathOutputUrl();
      revokeExternalStillJobUrl();
      stopCameraPathPlayback();
      pathPreviewMp4AbortRef.current?.abort();
      pathPreviewMp4RuntimeHandleRef.current?.dispose();
      pathPreviewMp4RuntimeHandleRef.current = null;
      clearPathRenderEncodingTimer();
      realtimeCameraPathRecorderRef.current?.cancel();
      realtimeCameraPathRecorderRef.current = null;
      sceneHandle.clearCaptureCameraPathOverlay();
    };
  }, [
    clearElapsedTimer,
    restoreCaptureSize,
    revokeDeterministicOutputUrl,
    revokePathPreviewMp4OutputUrl,
    revokePathRenderOutputUrl,
    revokeOutputUrl,
    revokeRecipeOutputUrl,
    revokeScreenCaptureOutputUrl,
    revokeExternalStillJobUrl,
    revokeCameraPathOutputUrl,
    sceneHandle,
    stopCameraPathPlayback,
    clearPathRenderEncodingTimer,
  ]);

  const value = useMemo<CaptureDirectorContextValue>(
    () => ({
      directorPanel,
      setDirectorPanel,
      captureMode,
      armedMode,
      setArmedMode,
      previewResolutionPresetId,
      setPreviewResolutionPresetId,
      previewResolution,
      renderResolutionPresetId,
      setRenderResolutionPresetId,
      renderResolution,
      fps,
      setFps,
      deterministicDurationSeconds,
      setDeterministicDurationSeconds,
      supersampleScale,
      setSupersampleScale,
      captureScope,
      setCaptureScope,
      pageRangeStartId,
      setPageRangeStartId,
      pageRangeEndId,
      setPageRangeEndId,
      pageRangeTiming,
      setPageRangeTiming,
      equalHoldSeconds,
      setEqualHoldSeconds,
      capturePageOptions,
      capturePageRange,
      captureTimeline,
      selectedTimelineTrack,
      setSelectedTimelineTrack,
      addCurrentPageClip,
      addPageClip,
      addPageRangeClips,
      removePageClip,
      clearPageClips,
      setPageClipEnabled,
      setPageClipLocked,
      selectPageClip,
      resizeTimelineBoundary,
      setTimelineDiagnosticsVisible,
      cameraKeyframes,
      cameraPath,
      captureCameraPathV2,
      captureCameraPathV3,
      cameraPathEquationOverlayOptions: captureCameraPathV3.equationOverlayOptions,
      cameraPathDisplayOptions,
      setCameraPathDisplayOptions,
      setCameraPathEquationOverlayOptions,
      cameraPathPreviewMonitor,
      selectedCameraPathKeyframeId,
      setSelectedCameraPathKeyframeId,
      selectedCameraPathNodeId,
      setSelectedCameraPathNodeId,
      selectedCameraPathSegmentId,
      setSelectedCameraPathSegmentId,
      cameraPathFocusPickNodeId,
      beginCameraPathFocusPick,
      cameraPathScrubTimeSeconds,
      setCameraPathScrubTimeSeconds,
      cameraPathTimelinePlaying,
      playCameraPathTimeline,
      pauseCameraPathTimeline,
      cameraPathDurationSeconds,
      cameraPathVisible,
      setCameraPathVisible,
      cameraPathPlaying,
      cameraPathPlaybackValidation,
      cameraPathOutputUrl,
      cameraPathOutputFilename,
      saveCameraPath,
      loadCameraPathFromFile,
      playCameraPath,
      stopCameraPathPlayback,
      startCameraPathPreviewRecording,
      addCameraPathKeyframe,
      addCameraPathTransitionNode,
      setCameraPathNodeKind,
      setCameraPathNodeEnabled,
      setCameraPathNodeHidden,
      setCameraPathSegmentTransitionSeconds,
      setCameraPathSegmentEnabled,
      setCameraPathSegmentHidden,
      setCameraPathSegmentEasing,
      setCameraPathSegmentTimeCurve,
      setCameraPathSegmentContinuity,
      setCameraPathSegmentTension,
      setCameraPathSegmentBias,
      setCameraPathSegmentInfluence,
      setCameraPathSegmentAutoHandles,
      setCameraPathNodeHoldSecondsAfter,
      setCameraPathNodeLookMode,
      setCameraPathNodeAimGeometry,
      setCameraPathNodeSplineCoupling,
      setCameraPathNodeSplineHandleMode,
      setCameraPathNodeSplineContinuity,
      setCameraPathNodeSplineHandleLength,
      bindCameraPathFocusPoint,
      moveCameraPathTarget,
      moveCameraPathInfluenceHandle,
      moveCameraPathSplineHandle,
      moveCameraPathNodeAxis,
      moveCameraPathFocusDistanceHandle,
      realtimeCameraPathRecording,
      startRealtimeCameraPathRecording,
      stopRealtimeCameraPathRecording,
      addCurrentCameraKeyframe,
      replaceCameraKeyframePose,
      updateCameraKeyframe,
      jumpToCameraKeyframe,
      removeCameraKeyframe,
      clearCameraKeyframes,
      loadedRecipe,
      loadedRecipeFilename,
      recipeOutputUrl,
      recipeOutputFilename,
      saveRecipe,
      loadRecipeFromFile,
      clearLoadedRecipe,
      recordingStatus,
      isRecording,
      elapsedSeconds,
      outputBlob,
      outputUrl,
      outputFilename,
      pathPreviewMp4Status,
      pathPreviewMp4OutputUrl,
      pathPreviewMp4OutputFilename,
      pathPreviewMp4Progress,
      pathPreviewVideoSaveMessage,
      deterministicExportStatus,
      isDeterministicExporting,
      deterministicOutputBlob,
      deterministicOutputUrl,
      deterministicOutputFilename,
      deterministicExportFormat,
      setDeterministicExportFormat,
      deterministicExportProgress,
      screenCaptureStatus,
      screenCaptureOptionsOpen,
      setScreenCaptureOptionsOpen,
      screenCaptureType,
      setScreenCaptureType,
      screenCaptureQuality,
      setScreenCaptureQuality,
      screenCaptureSaveMessage,
      screenCaptureOutputBlob,
      screenCaptureOutputUrl,
      screenCaptureOutputFilename,
      externalStillJobUrl,
      externalStillJobFilename,
      externalStillJobCommand,
      externalVideoJobUrl,
      externalVideoJobFilename,
      externalVideoJobCommand,
      captureJobs,
      activeCaptureJobId,
      pathRenderStatus,
      pathRenderOutputUrl,
      pathRenderOutputFilename,
      pathRenderProgress,
      pathRenderSaveMessage,
      error,
      availability,
      startRecording,
      stopRecording,
      startPathPreviewMp4Transcode,
      cancelPathPreviewMp4Transcode,
      savePathPreviewVideo,
      savePathPreviewMp4,
      startDeterministicExport,
      startPathDeterministicRender,
      cancelPathDeterministicRender,
      savePathRenderVideo,
      startScreenCapture,
      cancelDeterministicExport,
      clearCompletedCaptureJob,
      resetRecording,
    }),
    [
      activeCaptureJobId,
      armedMode,
      availability,
      cancelPathDeterministicRender,
      captureJobs,
      captureTimeline,
      directorPanel,
      setDirectorPanel,
      addCurrentPageClip,
      addPageClip,
      addPageRangeClips,
      capturePageOptions,
      capturePageRange,
      captureMode,
      captureScope,
      cameraKeyframes,
      cameraPath,
      captureCameraPathV2,
      captureCameraPathV3,
      cameraPathDisplayOptions,
      setCameraPathEquationOverlayOptions,
      setCameraPathDisplayOptions,
      cameraPathPreviewMonitor,
      selectedCameraPathKeyframeId,
      selectedCameraPathNodeId,
      selectedCameraPathSegmentId,
      selectedTimelineTrack,
      cameraPathFocusPickNodeId,
      beginCameraPathFocusPick,
      cameraPathScrubTimeSeconds,
      setCameraPathScrubTimeSeconds,
      cameraPathTimelinePlaying,
      playCameraPathTimeline,
      pauseCameraPathTimeline,
      cameraPathDurationSeconds,
      cameraPathVisible,
      cameraPathPlaying,
      cameraPathPlaybackValidation,
      cameraPathOutputUrl,
      cameraPathOutputFilename,
      saveCameraPath,
      loadCameraPathFromFile,
      playCameraPath,
      stopCameraPathPlayback,
      startCameraPathPreviewRecording,
      addCameraPathKeyframe,
      addCameraPathTransitionNode,
      setCameraPathNodeKind,
      setCameraPathNodeEnabled,
      setCameraPathNodeHidden,
      setCameraPathSegmentTransitionSeconds,
      setCameraPathSegmentEnabled,
      setCameraPathSegmentHidden,
      setCameraPathSegmentEasing,
      setCameraPathSegmentTimeCurve,
      setCameraPathSegmentContinuity,
      setCameraPathSegmentTension,
      setCameraPathSegmentBias,
      setCameraPathSegmentInfluence,
      setCameraPathSegmentAutoHandles,
      setCameraPathNodeHoldSecondsAfter,
      setCameraPathNodeLookMode,
      setCameraPathNodeAimGeometry,
      setCameraPathNodeSplineContinuity,
      setCameraPathNodeSplineCoupling,
      setCameraPathNodeSplineHandleLength,
      setCameraPathNodeSplineHandleMode,
      bindCameraPathFocusPoint,
      moveCameraPathTarget,
      moveCameraPathInfluenceHandle,
      moveCameraPathSplineHandle,
      moveCameraPathNodeAxis,
      moveCameraPathFocusDistanceHandle,
      realtimeCameraPathRecording,
      startRealtimeCameraPathRecording,
      stopRealtimeCameraPathRecording,
      addCurrentCameraKeyframe,
      replaceCameraKeyframePose,
      updateCameraKeyframe,
      jumpToCameraKeyframe,
      removeCameraKeyframe,
      clearCameraKeyframes,
      clearCompletedCaptureJob,
      clearPageClips,
      clearLoadedRecipe,
      deterministicDurationSeconds,
      elapsedSeconds,
      error,
      fps,
      loadedRecipe,
      loadedRecipeFilename,
      deterministicExportStatus,
      deterministicExportFormat,
      deterministicExportProgress,
      deterministicOutputBlob,
      deterministicOutputFilename,
      deterministicOutputUrl,
      equalHoldSeconds,
      externalStillJobFilename,
      externalStillJobCommand,
      externalStillJobUrl,
      externalVideoJobFilename,
      externalVideoJobCommand,
      externalVideoJobUrl,
      isRecording,
      isDeterministicExporting,
      outputBlob,
      outputFilename,
      outputUrl,
      pathPreviewMp4Status,
      pathPreviewMp4OutputFilename,
      pathPreviewMp4OutputUrl,
      pathPreviewMp4Progress,
      pathPreviewVideoSaveMessage,
      pageRangeEndId,
      pageRangeStartId,
      pageRangeTiming,
      pathRenderOutputFilename,
      pathRenderOutputUrl,
      pathRenderProgress,
      pathRenderStatus,
      pathRenderSaveMessage,
      previewResolution,
      previewResolutionPresetId,
      recipeOutputFilename,
      recipeOutputUrl,
      recordingStatus,
      renderResolution,
      renderResolutionPresetId,
      resetRecording,
      saveRecipe,
      loadRecipeFromFile,
      setArmedMode,
      setDeterministicDurationSeconds,
      startDeterministicExport,
      startPathDeterministicRender,
      startScreenCapture,
      cancelDeterministicExport,
      screenCaptureStatus,
      screenCaptureOptionsOpen,
      screenCaptureOutputBlob,
      screenCaptureOutputUrl,
      screenCaptureOutputFilename,
      screenCaptureQuality,
      screenCaptureSaveMessage,
      screenCaptureType,
      setEqualHoldSeconds,
      setPageClipEnabled,
      setPageClipLocked,
      selectPageClip,
      setScreenCaptureQuality,
      setSelectedTimelineTrack,
      setSupersampleScale,
      setTimelineDiagnosticsVisible,
      startRecording,
      startPathPreviewMp4Transcode,
      cancelPathPreviewMp4Transcode,
      savePathPreviewVideo,
      savePathPreviewMp4,
      stopRecording,
      supersampleScale,
      savePathRenderVideo,
    ],
  );

  return (
    <CaptureDirectorContext.Provider value={value}>
      {children}
    </CaptureDirectorContext.Provider>
  );
}

export function useCaptureDirector(): CaptureDirectorContextValue {
  const context = useContext(CaptureDirectorContext);
  if (!context) {
    throw new Error("useCaptureDirector must be used inside CaptureDirectorProvider.");
  }
  return context;
}
