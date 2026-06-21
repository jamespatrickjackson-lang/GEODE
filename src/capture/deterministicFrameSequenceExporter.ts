import type * as THREE from "three";
import type { SceneHandle } from "../scene";
import { applyPose, capturePose } from "../pages/capturePose";
import type { EditableStyle, Pose } from "../pages/types";
import {
  getCaptureFrameTime,
  validateCaptureRecipe,
  type CaptureCameraKeyframe,
  type CaptureRecipeV1,
} from "./captureRecipe";
import { poseFromCaptureCameraPathKeyframe, sampleCaptureCameraPath } from "./captureCameraPath";
import { sampleCaptureCameraPathV2 } from "./captureCameraPathV2";
import { sampleCaptureCameraPathV3 } from "./captureCameraPathV3";
import {
  clampCaptureSupersampleScale,
  resolveEffectiveCaptureCapabilities,
  validateRenderResolutionRequest,
  type CaptureCapabilityLimits,
} from "./captureResolution";
import { renderCaptureOverlay } from "./captureOverlayRenderer";
import { captureVisibilityProfileForMode } from "./captureProfiles";
import type { CaptureOverlayFrameContext } from "./captureTypes";

export type DeterministicFrameMimeType = "image/png" | "image/webp";

export interface DeterministicFrameSequenceFrame {
  frameIndex: number;
  timeSeconds: number;
  blob: Blob;
  url: string;
  filename: string;
  width: number;
  height: number;
  mimeType: DeterministicFrameMimeType;
}

export interface DeterministicFrameSequenceResult {
  recipe: CaptureRecipeV1;
  frames: DeterministicFrameSequenceFrame[];
  totalFrames: number;
  width: number;
  height: number;
  renderWidth: number;
  renderHeight: number;
  fps: number;
  durationSeconds: number;
  supersampleScale: number;
  cleanup(): void;
}

export interface DeterministicFrameSequenceExportOptions {
  sceneHandle: SceneHandle;
  recipe: CaptureRecipeV1;
  mimeType?: DeterministicFrameMimeType;
  imageQuality?: number;
  filenamePrefix?: string;
  timeOffsetSeconds?: number;
  signal?: AbortSignal;
  // Resolved capability budget from the caller (combined as the STRICTER limit
  // with the raw GL caps), so the frame render gate matches the provider
  // preflight. See exportDeterministicStill for rationale.
  capabilities?: CaptureCapabilityLimits | null;
  overlayContext?: (
    frame: Pick<DeterministicFrameSequenceFrame, "frameIndex" | "timeSeconds">,
  ) => Partial<CaptureOverlayFrameContext>;
  onFrame?: (frame: DeterministicFrameSequenceFrame) => void | Promise<void>;
}

interface RecipeSceneManagerAccess {
  layers?: Map<string, THREE.Group>;
  currentVisibleLayerIds?: ReadonlySet<string> | null;
  styleForLayer?: (id: string) => EditableStyle;
  setVisible(nextVisible: ReadonlySet<string>): void;
  applyStyle(id: string, style: EditableStyle): void;
}

interface RecipeLayerStateSnapshot {
  visibleCaptured: boolean;
  visibleLayerIds: Set<string>;
  styles: Map<string, EditableStyle>;
}

function clonePose(pose: Pose): Pose {
  return {
    position: [...pose.position],
    target: [...pose.target],
    up: [...pose.up],
    fov: pose.fov,
  };
}

function cloneStyle(style: EditableStyle): EditableStyle {
  return { ...style };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function managerAccess(sceneHandle: SceneHandle): RecipeSceneManagerAccess {
  return sceneHandle.manager as unknown as RecipeSceneManagerAccess;
}

function visibleLayerIds(manager: RecipeSceneManagerAccess): {
  captured: boolean;
  ids: Set<string>;
} {
  if (manager.currentVisibleLayerIds instanceof Set) {
    return { captured: true, ids: new Set(manager.currentVisibleLayerIds) };
  }
  if (!(manager.layers instanceof Map)) {
    return { captured: false, ids: new Set() };
  }
  const ids = new Set<string>();
  for (const [id, group] of manager.layers) {
    if (group.visible) ids.add(id);
  }
  return { captured: true, ids };
}

export function applyRecipeLayerState(
  sceneHandle: SceneHandle,
  recipe: CaptureRecipeV1,
): RecipeLayerStateSnapshot {
  const manager = managerAccess(sceneHandle);
  const capturedVisibility = visibleLayerIds(manager);
  const styles = new Map<string, EditableStyle>();
  for (const id of Object.keys(recipe.layerStyles)) {
    const current = manager.styleForLayer?.(id);
    if (current) {
      styles.set(id, cloneStyle(current));
    }
  }

  const visibilityEntries = Object.entries(recipe.layerVisibility);
  if (visibilityEntries.length > 0 && capturedVisibility.captured) {
    const nextVisible = new Set(capturedVisibility.ids);
    for (const [id, visible] of visibilityEntries) {
      if (visible) {
        nextVisible.add(id);
      } else {
        nextVisible.delete(id);
      }
    }
    manager.setVisible(nextVisible);
  }

  for (const [id, style] of Object.entries(recipe.layerStyles)) {
    if (isRecord(style)) {
      manager.applyStyle(id, style as EditableStyle);
    }
  }

  return {
    visibleCaptured: capturedVisibility.captured,
    visibleLayerIds: capturedVisibility.ids,
    styles,
  };
}

export function restoreRecipeLayerState(
  sceneHandle: SceneHandle,
  snapshot: RecipeLayerStateSnapshot,
): void {
  const manager = managerAccess(sceneHandle);
  if (snapshot.visibleCaptured) {
    manager.setVisible(snapshot.visibleLayerIds);
  }
  for (const [id, style] of snapshot.styles) {
    manager.applyStyle(id, style);
  }
}

export function getCaptureFrameCount(recipe: CaptureRecipeV1): number {
  return Math.max(1, Math.ceil(recipe.durationSeconds * recipe.fps));
}

function easeKeyframeT(t: number, easing?: CaptureCameraKeyframe["easing"]): number {
  if (easing !== "ease-in-out") return t;
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Pose["position"], b: Pose["position"], t: number): Pose["position"] {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

function interpolatePose(a: Pose, b: Pose, t: number): Pose {
  return {
    position: lerpVec3(a.position, b.position, t),
    target: lerpVec3(a.target, b.target, t),
    up: lerpVec3(a.up, b.up, t),
    fov: lerp(a.fov, b.fov, t),
  };
}

export function interpolateCaptureCameraKeyframes(
  recipe: CaptureRecipeV1,
  timeSeconds: number,
): Pose | null {
  return interpolateCameraKeyframes(
    recipe.cameraKeyframes,
    recipe.camera,
    timeSeconds,
  );
}

function interpolateCameraKeyframes(
  sourceKeyframes: readonly CaptureCameraKeyframe[],
  fallbackCamera: Pose | null,
  timeSeconds: number,
): Pose | null {
  const keyframes = [...sourceKeyframes].sort(
    (a, b) => a.timeSeconds - b.timeSeconds,
  );
  if (keyframes.length === 0) {
    return fallbackCamera ? clonePose(fallbackCamera) : null;
  }
  if (timeSeconds <= keyframes[0].timeSeconds) {
    return clonePose(keyframes[0].camera);
  }
  const last = keyframes[keyframes.length - 1];
  if (timeSeconds >= last.timeSeconds) {
    return clonePose(last.camera);
  }
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    if (timeSeconds < start.timeSeconds || timeSeconds > end.timeSeconds) {
      continue;
    }
    const span = Math.max(0.000_001, end.timeSeconds - start.timeSeconds);
    const t = easeKeyframeT(
      Math.max(0, Math.min(1, (timeSeconds - start.timeSeconds) / span)),
      end.easing ?? start.easing,
    );
    return interpolatePose(start.camera, end.camera, t);
  }
  return fallbackCamera ? clonePose(fallbackCamera) : null;
}

export function sampleCaptureRecipeCameraPoseAtFrame(
  recipe: CaptureRecipeV1,
  frameIndex: number,
  timeOffsetSeconds = 0,
): Pose | null {
  const timeSeconds =
    getCaptureFrameTime(frameIndex, recipe.fps) + timeOffsetSeconds;
  if (recipe.cameraPath) {
    if (recipe.cameraPath.version === 1) {
      return poseFromCaptureCameraPathKeyframe(
        sampleCaptureCameraPath(recipe.cameraPath, timeSeconds),
      );
    }
    if (recipe.cameraPath.version === 2) {
      return poseFromCaptureCameraPathKeyframe(
        sampleCaptureCameraPathV2(recipe.cameraPath, timeSeconds),
      );
    }
    return poseFromCaptureCameraPathKeyframe(
      sampleCaptureCameraPathV3(recipe.cameraPath, timeSeconds),
    );
  }
  return interpolateCaptureCameraKeyframes(recipe, timeSeconds);
}

function encodeCanvasFrame(
  canvas: HTMLCanvasElement,
  mimeType: DeterministicFrameMimeType,
  imageQuality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Frame encoding failed."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      mimeType === "image/webp" ? imageQuality : undefined,
    );
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException("Frame-sequence export was aborted.", "AbortError");
}

function frameExtension(mimeType: DeterministicFrameMimeType): string {
  return mimeType === "image/webp" ? "webp" : "png";
}

export async function exportDeterministicFrameSequence({
  sceneHandle,
  recipe,
  mimeType = "image/png",
  imageQuality = 0.92,
  filenamePrefix = "geosee-capture",
  signal,
  timeOffsetSeconds = 0,
  capabilities,
  overlayContext,
  onFrame,
}: DeterministicFrameSequenceExportOptions): Promise<DeterministicFrameSequenceResult> {
  const validation = validateCaptureRecipe(recipe);
  if (!validation.valid) {
    throw new Error(`Invalid capture recipe: ${validation.errors.join(" ")}`);
  }
  if (recipe.mode === "off") {
    throw new Error("Capture mode must be active for deterministic frame export.");
  }
  if (recipe.mode === "full-ui") {
    throw new Error(
      "Full UI display capture is not supported by deterministic frame export.",
    );
  }
  if (!sceneHandle.renderCaptureFrame) {
    throw new Error("Scene renderer does not expose deterministic frame rendering.");
  }

  const width = recipe.resolution.width;
  const height = recipe.resolution.height;
  // Optional supersampling: render at width*scale x height*scale, then
  // high-quality downscale to the exact output size per frame. The scale is
  // clamped so the internal render stays within the safe budget (e.g. 8K is
  // forced to 1x), avoiding the black-frame GPU-memory blowup.
  const supersampleScale = clampCaptureSupersampleScale(
    typeof recipe.supersampleScale === "number" ? recipe.supersampleScale : 1,
    width,
    height,
  );
  const capabilityValidation = validateRenderResolutionRequest({
    resolution: recipe.resolution,
    supersampleScale,
    ...resolveEffectiveCaptureCapabilities(
      sceneHandle.getCaptureCapabilities(),
      capabilities,
    ),
  });
  if (!capabilityValidation.valid) {
    throw new Error(
      `Render output is not available: ${capabilityValidation.errors.join(" ")}`,
    );
  }
  const renderWidth = capabilityValidation.renderWidth;
  const renderHeight = capabilityValidation.renderHeight;
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputContext = outputCanvas.getContext("2d", { alpha: false });
  if (!outputContext) {
    throw new Error("Frame-sequence output canvas could not be created.");
  }
  // High-quality downscale for the supersample path (renderWidth/Height may
  // exceed the output size). No-op when rendering at exact size (scale 1).
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";

  const originalPose = capturePose(sceneHandle.camera, sceneHandle.controls);
  let snapshot: RecipeLayerStateSnapshot | null = null;
  const frames: DeterministicFrameSequenceFrame[] = [];
  const totalFrames = getCaptureFrameCount(recipe);
  let completed = false;
  let fidelitySnapshot:
    | ReturnType<SceneHandle["beginCaptureFidelityLock"]>
    | null = null;

  try {
    snapshot = applyRecipeLayerState(sceneHandle, recipe);
    sceneHandle.setCaptureNativeAnnotationsVisible?.(
      captureVisibilityProfileForMode(recipe.mode).captureNativeAnnotations,
    );
    fidelitySnapshot =
      typeof sceneHandle.beginCaptureFidelityLock === "function"
        ? sceneHandle.beginCaptureFidelityLock({
            reason: "render-out",
            width: renderWidth,
            height: renderHeight,
            gradeMode: recipe.captureGradeMode,
            mode: "max-detail-render",
          })
        : null;
    if (!fidelitySnapshot) {
      sceneHandle.beginCaptureSize({
        width: renderWidth,
        height: renderHeight,
        pixelRatio: 1,
      });
    }
    await sceneHandle.waitForCaptureFidelityReady?.();

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      throwIfAborted(signal);
      const baseCameraPose = sampleCaptureRecipeCameraPoseAtFrame(recipe, frameIndex);
      const timeSeconds =
        getCaptureFrameTime(frameIndex, recipe.fps) + timeOffsetSeconds;
      const cameraPose =
        timeOffsetSeconds === 0
          ? baseCameraPose
          : sampleCaptureRecipeCameraPoseAtFrame(
              recipe,
              frameIndex,
              timeOffsetSeconds,
            );
      if (cameraPose) {
        applyPose(sceneHandle.camera, sceneHandle.controls, cameraPose);
      }
      sceneHandle.renderCaptureFrame({ timeSeconds, frameIndex });
      outputContext.clearRect(0, 0, width, height);
      outputContext.drawImage(sceneHandle.getCanvas(), 0, 0, width, height);
      if (recipe.mode === "scene-annotations" || recipe.mode === "presentation-ui") {
        renderCaptureOverlay(outputContext, {
          mode: recipe.mode,
          title: recipe.pageId ?? recipe.projectSlug,
          projectName: recipe.projectSlug,
          pageLabel: recipe.pageId,
          ...(overlayContext?.({ frameIndex, timeSeconds }) ?? {}),
          width,
          height,
        });
      }
      const blob = await encodeCanvasFrame(outputCanvas, mimeType, imageQuality);
      const frame: DeterministicFrameSequenceFrame = {
        frameIndex,
        timeSeconds,
        blob,
        url: URL.createObjectURL(blob),
        filename: `${filenamePrefix}-${String(frameIndex).padStart(6, "0")}.${frameExtension(mimeType)}`,
        width,
        height,
        mimeType,
      };
      frames.push(frame);
      await onFrame?.(frame);
    }
    completed = true;
  } finally {
    try {
      sceneHandle.setCaptureNativeAnnotationsVisible?.(true);
      if (snapshot) {
        restoreRecipeLayerState(sceneHandle, snapshot);
      }
      applyPose(sceneHandle.camera, sceneHandle.controls, originalPose);
    } finally {
      if (
        fidelitySnapshot &&
        typeof sceneHandle.endCaptureFidelityLock === "function"
      ) {
        sceneHandle.endCaptureFidelityLock(fidelitySnapshot);
      } else {
        sceneHandle.endCaptureSize();
      }
      if (!completed) {
        for (const frame of frames) {
          URL.revokeObjectURL(frame.url);
        }
      }
    }
  }

  return {
    recipe,
    frames,
    totalFrames,
    width,
    height,
    renderWidth,
    renderHeight,
    fps: recipe.fps,
    durationSeconds: recipe.durationSeconds,
    supersampleScale,
    cleanup() {
      for (const frame of frames) {
        URL.revokeObjectURL(frame.url);
      }
    },
  };
}
