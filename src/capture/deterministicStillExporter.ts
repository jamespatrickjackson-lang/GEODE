import { encodeCaptureExr, encodeCapturePng16 } from "./captureFloatStill";
import type { SceneHandle } from "../scene";
import { applyPose, capturePose } from "../pages/capturePose";
import type { Pose } from "../pages/types";
import {
  getCaptureFrameTime,
  validateCaptureRecipe,
  type CaptureRecipeV1,
} from "./captureRecipe";
import {
  clampCaptureSupersampleScale,
  resolveEffectiveCaptureCapabilities,
  validateRenderResolutionRequest,
  type CaptureCapabilityLimits,
} from "./captureResolution";
import { renderCaptureOverlay } from "./captureOverlayRenderer";
import { captureVisibilityProfileForMode } from "./captureProfiles";
import type { CaptureOverlayFrameContext } from "./captureTypes";
import {
  applyRecipeLayerState,
  restoreRecipeLayerState,
  sampleCaptureRecipeCameraPoseAtFrame,
} from "./deterministicFrameSequenceExporter";

export type DeterministicStillMimeType =
  | "image/png"
  | "image/webp"
  | "image/jpeg"
  | "image/x-exr"
  // Routing marker for 16-bit PNG (saved as image/png .png); takes the float path.
  | "image/x-png16";

export interface DeterministicStillExportOptions {
  sceneHandle: SceneHandle;
  recipe: CaptureRecipeV1;
  cameraPose?: Pose | null;
  useCurrentSceneState?: boolean;
  timeSeconds?: number;
  frameIndex?: number;
  mimeType?: DeterministicStillMimeType;
  imageQuality?: number;
  // Apply the capture log transfer before EXR / 16-bit PNG encode (grading
  // latitude). Ignored by the 8-bit canvas formats.
  logTransfer?: boolean;
  filenamePrefix?: string;
  // Resolved capability budget from the caller (e.g. the provider preflight,
  // which honors the dev capability override). Combined with the raw GL caps as
  // the STRICTER limit, so the exporter never validates more permissively than
  // the preflight and never attempts a render the device was already told it
  // cannot perform.
  capabilities?: CaptureCapabilityLimits | null;
  overlayContext?: (
    frame: Pick<
      DeterministicStillExportResult,
      "frameIndex" | "timeSeconds"
    >,
  ) => Partial<CaptureOverlayFrameContext>;
}

export interface DeterministicStillExportResult {
  recipe: CaptureRecipeV1;
  blob: Blob;
  url: string;
  filename: string;
  width: number;
  height: number;
  renderWidth: number;
  renderHeight: number;
  frameIndex: number;
  timeSeconds: number;
  mimeType: DeterministicStillMimeType;
  byteLength: number;
  cleanup(): void;
}

function stillExtension(
  mimeType: DeterministicStillMimeType,
): "png" | "webp" | "jpg" | "exr" {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/x-exr") return "exr";
  // image/x-png16 (and image/png) save as .png.
  return "png";
}

function isFloatStillMimeType(mimeType: DeterministicStillMimeType): boolean {
  return mimeType === "image/x-exr" || mimeType === "image/x-png16";
}

function encodeStillCanvas(
  canvas: HTMLCanvasElement,
  mimeType: DeterministicStillMimeType,
  imageQuality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Screen Capture image encoding failed."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      mimeType === "image/png" ? undefined : imageQuality,
    );
  });
}

export function validateStillBlob(blob: Blob): void {
  if (blob.size > 0) return;
  throw new Error("Screen Capture produced an empty image.");
}

export async function exportDeterministicStill({
  sceneHandle,
  recipe,
  cameraPose: stillCameraPose,
  useCurrentSceneState = false,
  timeSeconds,
  frameIndex,
  mimeType = "image/png",
  imageQuality = 0.92,
  logTransfer = false,
  filenamePrefix = "geosee-screen-capture",
  capabilities,
  overlayContext,
}: DeterministicStillExportOptions): Promise<DeterministicStillExportResult> {
  const validation = validateCaptureRecipe(recipe);
  if (!validation.valid) {
    throw new Error(`Invalid capture recipe: ${validation.errors.join(" ")}`);
  }
  if (recipe.mode === "off") {
    throw new Error("Capture mode must be active for Screen Capture.");
  }
  if (recipe.mode === "full-ui") {
    throw new Error("Full UI Screen Capture requires browser display capture.");
  }
  if (!sceneHandle.renderCaptureFrame) {
    throw new Error("Scene renderer does not expose deterministic frame rendering.");
  }

  const width = recipe.resolution.width;
  const height = recipe.resolution.height;
  // Optional supersampling: render at width*scale x height*scale, then
  // high-quality downscale to the exact output size in the final drawImage.
  // The output is never upscaled; scale 1 is the exact-size path. The scale is
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
      `Screen Capture render output is not available: ${capabilityValidation.errors.join(" ")}`,
    );
  }
  const renderWidth = capabilityValidation.renderWidth;
  const renderHeight = capabilityValidation.renderHeight;
  const resolvedFrameIndex =
    typeof frameIndex === "number"
      ? frameIndex
      : Math.max(
          0,
          Math.round((timeSeconds ?? 0) * recipe.fps),
        );
  const resolvedTimeSeconds =
    getCaptureFrameTime(resolvedFrameIndex, recipe.fps);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputContext = outputCanvas.getContext("2d", { alpha: false });
  if (!outputContext) {
    throw new Error("Screen Capture output canvas could not be created.");
  }
  // High-quality downscale for the supersample path (renderWidth/Height may
  // exceed the output size). No-op when rendering at exact size (scale 1).
  outputContext.imageSmoothingEnabled = true;
  outputContext.imageSmoothingQuality = "high";

  const originalPose = capturePose(sceneHandle.camera, sceneHandle.controls);
  let snapshot: ReturnType<typeof applyRecipeLayerState> | null = null;
  let fidelitySnapshot:
    | ReturnType<SceneHandle["beginCaptureFidelityLock"]>
    | null = null;
  let outputUrl: string | null = null;
  let completed = false;

  try {
    snapshot = useCurrentSceneState ? null : applyRecipeLayerState(sceneHandle, recipe);
    sceneHandle.setCaptureNativeAnnotationsVisible?.(
      captureVisibilityProfileForMode(recipe.mode).captureNativeAnnotations,
    );
    fidelitySnapshot =
      typeof sceneHandle.beginCaptureFidelityLock === "function"
        ? sceneHandle.beginCaptureFidelityLock({
            reason: "still-capture",
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

    const cameraPose =
      stillCameraPose ??
      sampleCaptureRecipeCameraPoseAtFrame(recipe, resolvedFrameIndex);
    if (cameraPose) {
      applyPose(sceneHandle.camera, sceneHandle.controls, cameraPose);
    }
    let blob: Blob;
    if (isFloatStillMimeType(mimeType)) {
      // EXR / 16-bit PNG: keep the full HalfFloat composed range (no 8-bit blit,
      // no banding). The 2D overlay + supersample downscale are skipped; these are
      // clean, render-resolution float plates.
      if (typeof sceneHandle.renderCaptureFloatTarget !== "function") {
        throw new Error(
          "Float capture requires the float render path, which this renderer does not expose.",
        );
      }
      const floatTarget = sceneHandle.renderCaptureFloatTarget({
        timeSeconds: resolvedTimeSeconds,
        frameIndex: resolvedFrameIndex,
      });
      if (!floatTarget) {
        throw new Error("Float capture produced no float render target.");
      }
      blob =
        mimeType === "image/x-png16"
          ? await encodeCapturePng16(sceneHandle.renderer, floatTarget, {
              log: logTransfer,
            })
          : await encodeCaptureExr(sceneHandle.renderer, floatTarget, {
              log: logTransfer,
            });
    } else {
      sceneHandle.renderCaptureFrame({
        timeSeconds: resolvedTimeSeconds,
        frameIndex: resolvedFrameIndex,
      });
      outputContext.clearRect(0, 0, width, height);
      outputContext.drawImage(sceneHandle.getCanvas(), 0, 0, width, height);
      if (recipe.mode === "scene-annotations" || recipe.mode === "presentation-ui") {
        renderCaptureOverlay(outputContext, {
          mode: recipe.mode,
          title: recipe.pageId ?? recipe.projectSlug,
          projectName: recipe.projectSlug,
          pageLabel: recipe.pageId,
          ...(overlayContext?.({
            frameIndex: resolvedFrameIndex,
            timeSeconds: resolvedTimeSeconds,
          }) ?? {}),
          width,
          height,
        });
      }
      blob = await encodeStillCanvas(outputCanvas, mimeType, imageQuality);
    }
    validateStillBlob(blob);
    outputUrl = URL.createObjectURL(blob);
    const resultUrl = outputUrl;
    completed = true;
    return {
      recipe,
      blob,
      url: resultUrl,
      filename: `${filenamePrefix}-screen-capture.${stillExtension(mimeType)}`,
      width,
      height,
      renderWidth,
      renderHeight,
      frameIndex: resolvedFrameIndex,
      timeSeconds: resolvedTimeSeconds,
      mimeType,
      byteLength: blob.size,
      cleanup() {
        URL.revokeObjectURL(resultUrl);
      },
    };
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
      if (!completed && outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    }
  }
}
