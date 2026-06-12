import type { SceneHandle } from "../scene";
import { applyPose, capturePose } from "../pages/capturePose";
import type { Pose } from "../pages/types";
import {
  getCaptureFrameTime,
  validateCaptureRecipe,
  type CaptureRecipeV1,
} from "./captureRecipe";
import { validateRenderResolutionRequest } from "./captureResolution";
import { renderCaptureOverlay } from "./captureOverlayRenderer";
import { captureVisibilityProfileForMode } from "./captureProfiles";
import type { CaptureOverlayFrameContext } from "./captureTypes";
import {
  applyRecipeLayerState,
  restoreRecipeLayerState,
  sampleCaptureRecipeCameraPoseAtFrame,
} from "./deterministicFrameSequenceExporter";

export type DeterministicStillMimeType = "image/png" | "image/webp" | "image/jpeg";

export interface DeterministicStillExportOptions {
  sceneHandle: SceneHandle;
  recipe: CaptureRecipeV1;
  cameraPose?: Pose | null;
  useCurrentSceneState?: boolean;
  timeSeconds?: number;
  frameIndex?: number;
  mimeType?: DeterministicStillMimeType;
  imageQuality?: number;
  filenamePrefix?: string;
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

function stillExtension(mimeType: DeterministicStillMimeType): "png" | "webp" | "jpg" {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";
  return "png";
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
  filenamePrefix = "geosee-screen-capture",
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
  if (recipe.supersampleScale !== 1) {
    throw new Error("Screen Capture supersampling exceeds the max-detail no-downsampling policy; render at exact output size.");
  }
  const supersampleScale = 1;
  const capabilityValidation = validateRenderResolutionRequest({
    resolution: recipe.resolution,
    supersampleScale,
    ...sceneHandle.getCaptureCapabilities(),
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

    const cameraPose =
      stillCameraPose ??
      sampleCaptureRecipeCameraPoseAtFrame(recipe, resolvedFrameIndex);
    if (cameraPose) {
      applyPose(sceneHandle.camera, sceneHandle.controls, cameraPose);
    }
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

    const blob = await encodeStillCanvas(outputCanvas, mimeType, imageQuality);
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
