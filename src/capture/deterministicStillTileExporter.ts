import type { SceneHandle } from "../scene";
import { applyPose, capturePose } from "../pages/capturePose";
import { getCaptureFrameTime } from "./captureRecipe";
import { renderCaptureOverlay } from "./captureOverlayRenderer";
import { captureVisibilityProfileForMode } from "./captureProfiles";
import {
  applyRecipeLayerState,
  restoreRecipeLayerState,
  sampleCaptureRecipeCameraPoseAtFrame,
} from "./deterministicFrameSequenceExporter";
import {
  CAPTURE_STILL_TILE_RESULT_SCHEMA,
  type CaptureStillRenderJobV1,
  type CaptureStillTileRenderResult,
  type CaptureStillTileSpec,
  validateExternalStillRenderJob,
} from "./externalStillRenderJob";

const TILE_RENDER_RESULT_SCHEMA_NAME = "CaptureStillTileRenderResultV1";

export interface DeterministicStillTileExportOptions {
  sceneHandle: SceneHandle;
  job: CaptureStillRenderJobV1;
  tile: CaptureStillTileSpec;
  frameIndex?: number;
}

function validateTile(job: CaptureStillRenderJobV1, tile: CaptureStillTileSpec): void {
  const errors: string[] = [];
  if (!tile.id) errors.push("tile.id is required.");
  if (!Number.isInteger(tile.x) || tile.x < 0) errors.push("tile.x must be non-negative.");
  if (!Number.isInteger(tile.y) || tile.y < 0) errors.push("tile.y must be non-negative.");
  if (!Number.isInteger(tile.width) || tile.width <= 0) {
    errors.push("tile.width must be positive.");
  }
  if (!Number.isInteger(tile.height) || tile.height <= 0) {
    errors.push("tile.height must be positive.");
  }
  if (tile.x + tile.width > job.still.width) {
    errors.push("tile exceeds still width.");
  }
  if (tile.y + tile.height > job.still.height) {
    errors.push("tile exceeds still height.");
  }
  if (errors.length > 0) {
    throw new Error(`Invalid still tile: ${errors.join(" ")}`);
  }
}

function encodeCanvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("External still tile encoding failed."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export function validateStillTileBlob(blob: Blob, tile: CaptureStillTileSpec): void {
  if (blob.size > 0) return;
  throw new Error(`External still tile ${tile.id} produced an empty image.`);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < buffer.length; index += chunkSize) {
    const chunk = buffer.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export async function exportDeterministicStillTile({
  sceneHandle,
  job,
  tile,
  frameIndex = 0,
}: DeterministicStillTileExportOptions): Promise<CaptureStillTileRenderResult> {
  const validation = validateExternalStillRenderJob(job);
  if (!validation.valid) {
    throw new Error(`Invalid external still render job: ${validation.errors.join(" ")}`);
  }
  validateTile(job, tile);
  if (!sceneHandle.renderCaptureFrame) {
    throw new Error("Scene renderer does not expose deterministic frame rendering.");
  }

  const recipe = job.recipe;
  const fullWidth = job.still.width;
  const fullHeight = job.still.height;
  const timeSeconds = getCaptureFrameTime(frameIndex, recipe.fps);
  const originalPose = capturePose(sceneHandle.camera, sceneHandle.controls);
  const originalAspect = sceneHandle.camera.aspect;
  let layerSnapshot: ReturnType<typeof applyRecipeLayerState> | null = null;
  let fidelitySnapshot:
    | ReturnType<SceneHandle["beginCaptureFidelityLock"]>
    | null = null;

  try {
    layerSnapshot = applyRecipeLayerState(sceneHandle, recipe);
    sceneHandle.setCaptureNativeAnnotationsVisible?.(
      captureVisibilityProfileForMode(recipe.mode).captureNativeAnnotations,
    );
    // Overlap-rendered tile: render `overlapPixels` extra on each side (clamped to
    // the full bounds) and crop them off. This gives the sampling-based lens FX
    // (distortion / chromatic aberration) neighbour pixels so tiles join
    // seamlessly. The grade pass computes those FX in full-frame UV via the
    // uTileOffset/uTileScale set from the expanded rect in beginCaptureFidelityLock.
    const overlap = Math.max(0, Math.trunc(job.tile.overlapPixels ?? 0));
    const renderX = Math.max(0, tile.x - overlap);
    const renderY = Math.max(0, tile.y - overlap);
    const renderWidth = Math.min(fullWidth, tile.x + tile.width + overlap) - renderX;
    const renderHeight = Math.min(fullHeight, tile.y + tile.height + overlap) - renderY;
    const cropX = tile.x - renderX; // nominal tile offset within the expanded render
    const cropY = tile.y - renderY;

    fidelitySnapshot = sceneHandle.beginCaptureFidelityLock({
      reason: "external-still",
      width: renderWidth,
      height: renderHeight,
      fullOutputWidth: fullWidth,
      fullOutputHeight: fullHeight,
      tileX: renderX,
      tileY: renderY,
      tileId: tile.id,
      gradeMode: recipe.captureGradeMode,
      mode: "max-detail-render",
    });
    await sceneHandle.waitForCaptureFidelityReady?.();
    const cameraPose = sampleCaptureRecipeCameraPoseAtFrame(recipe, frameIndex);
    if (cameraPose) {
      applyPose(sceneHandle.camera, sceneHandle.controls, cameraPose);
    }
    sceneHandle.camera.aspect = fullWidth / fullHeight;
    sceneHandle.camera.setViewOffset(
      fullWidth,
      fullHeight,
      renderX,
      renderY,
      renderWidth,
      renderHeight,
    );
    sceneHandle.camera.updateProjectionMatrix();

    sceneHandle.renderCaptureFrame({ timeSeconds, frameIndex });
    const tileCanvas = document.createElement("canvas");
    tileCanvas.width = tile.width;
    tileCanvas.height = tile.height;
    const ctx = tileCanvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("External still tile canvas could not be created.");
    }
    // Crop the overlap margin: extract the nominal tile from the expanded render.
    ctx.drawImage(
      sceneHandle.getCanvas(),
      cropX,
      cropY,
      tile.width,
      tile.height,
      0,
      0,
      tile.width,
      tile.height,
    );
    const overlayMode =
      recipe.mode === "scene-annotations" || recipe.mode === "presentation-ui"
        ? recipe.mode
        : null;
    if (overlayMode) {
      ctx.save();
      ctx.translate(-tile.x, -tile.y);
      renderCaptureOverlay(ctx, {
        mode: overlayMode,
        title: recipe.pageId ?? recipe.projectSlug,
        projectName: recipe.projectSlug,
        pageLabel: recipe.pageId,
        width: fullWidth,
        height: fullHeight,
      });
      ctx.restore();
    }

    const blob = await encodeCanvasPng(tileCanvas);
    validateStillTileBlob(blob, tile);
    return {
      schema: TILE_RENDER_RESULT_SCHEMA_NAME as typeof CAPTURE_STILL_TILE_RESULT_SCHEMA,
      tileId: tile.id,
      width: tile.width,
      height: tile.height,
      x: tile.x,
      y: tile.y,
      imageType: "png",
      imageBase64: await blobToBase64(blob),
      byteLength: blob.size,
      diagnostics: {
        projectionOffset: {
          fullWidth,
          fullHeight,
          x: tile.x,
          y: tile.y,
          width: tile.width,
          height: tile.height,
        },
        frameIndex,
        timeSeconds,
        maxDetail: true,
        overlayComposited: !!overlayMode,
      },
    };
  } finally {
    try {
      sceneHandle.setCaptureNativeAnnotationsVisible?.(true);
      sceneHandle.camera.clearViewOffset();
      sceneHandle.camera.aspect = originalAspect;
      sceneHandle.camera.updateProjectionMatrix();
      if (layerSnapshot) {
        restoreRecipeLayerState(sceneHandle, layerSnapshot);
      }
      applyPose(sceneHandle.camera, sceneHandle.controls, originalPose);
    } finally {
      if (fidelitySnapshot) {
        sceneHandle.endCaptureFidelityLock(fidelitySnapshot);
      }
    }
  }
}
