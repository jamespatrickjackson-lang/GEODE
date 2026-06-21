import type {
  CaptureRecorderController,
  CompositedCaptureRecorderOptions,
} from "./captureTypes";
import { createMediaStreamRecorder, stopMediaStreamTracks } from "./canvasPreviewRecorder";
import { renderCaptureOverlay } from "./captureOverlayRenderer";

export class CompositedCaptureDrawError extends Error {
  constructor(message = "Composited capture could not read the WebGL canvas.") {
    super(message);
    this.name = "CompositedCaptureDrawError";
  }
}

export function createCompositedCaptureRecorder({
  sceneHandle,
  width,
  height,
  fps,
  mimeType,
  overlayContext,
  outputContext,
  onDrawError,
  onUnexpectedStop,
  onRecorderError,
}: CompositedCaptureRecorderOptions): CaptureRecorderController {
  const sourceCanvas = sceneHandle.getCanvas();
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  outputCanvas.dataset.captureCompositedCanvas = "true";
  const ctx = outputCanvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Composited capture canvas could not be created.");
  }
  if (typeof outputCanvas.captureStream !== "function") {
    throw new Error("Canvas captureStream is not available in this browser.");
  }

  let drawFailed = false;
  let recorder: CaptureRecorderController | null = null;
  let stream: MediaStream | null = null;
  const createDrawError = (error: unknown) =>
    new CompositedCaptureDrawError(
      error instanceof Error ? error.message : undefined,
    );
  const drawFrame = (throwOnFailure = false) => {
    try {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(sourceCanvas, 0, 0, width, height);
      renderCaptureOverlay(ctx, {
        ...overlayContext(),
        width,
        height,
      });
      return true;
    } catch (error) {
      const drawError = createDrawError(error);
      if (throwOnFailure) {
        throw drawError;
      }
      if (!drawFailed) {
        drawFailed = true;
        onDrawError?.(drawError);
        if (stream) stopMediaStreamTracks(stream);
        // Abort (not stop): a draw failure is an unexpected terminal failure, so
        // it must surface through onRecorderError/onUnexpectedStop rather than be
        // masked as an intentional stop. stop() would set stopRequested and
        // suppress those callbacks, leaving the recorder owner wedged.
        void recorder?.abort?.(drawError).catch(() => undefined);
      }
      return false;
    }
  };

  drawFrame(true);
  stream = outputCanvas.captureStream(fps);
  const track = stream.getVideoTracks?.()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  const unsubscribe = sceneHandle.onAfterRender(() => {
    if (drawFailed) return;
    if (drawFrame()) {
      track?.requestFrame?.();
    }
  });

  recorder = createMediaStreamRecorder(stream, {
    mimeType,
    outputContext,
    onStop: () => {
      unsubscribe();
      if (stream) stopMediaStreamTracks(stream);
    },
    onUnexpectedStop,
    onRecorderError,
  });
  track?.requestFrame?.();

  return {
    mimeType,
    stop: () => recorder.stop(),
  };
}
