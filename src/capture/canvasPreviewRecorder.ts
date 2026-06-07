import type {
  CanvasPreviewRecorderOptions,
  CaptureRecorderDiagnostics,
  CaptureRecorderController,
  CaptureRecorderOutputContext,
  CaptureRecorderResult,
} from "./captureTypes";

export const MEDIA_RECORDER_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
] as const;

export function selectSupportedMediaRecorderMimeType(
  mediaRecorderCtor: typeof MediaRecorder | undefined =
    typeof MediaRecorder === "undefined" ? undefined : MediaRecorder,
): string | null {
  if (!mediaRecorderCtor) return null;
  if (typeof mediaRecorderCtor.isTypeSupported !== "function") {
    return "video/webm";
  }
  for (const mimeType of MEDIA_RECORDER_MIME_TYPES) {
    if (mediaRecorderCtor.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return null;
}

export function stopMediaStreamTracks(stream: MediaStream): void {
  for (const track of stream.getTracks?.() ?? []) {
    track.stop();
  }
}

export class EmptyCaptureRecordingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyCaptureRecordingError";
  }
}

export function formatEmptyCaptureRecordingMessage(
  context?: CaptureRecorderOutputContext,
): string {
  const resolution =
    typeof context?.width === "number" && typeof context.height === "number"
      ? `${context.width}x${context.height}`
      : null;
  const fps =
    typeof context?.fps === "number" && Number.isFinite(context.fps)
      ? `${context.fps} FPS`
      : null;
  if (resolution && fps) {
    return `No video data was produced for ${resolution} at ${fps}. Try 1440p preview or deterministic export.`;
  }
  if (fps) {
    return `No video data was produced at ${fps}. Try a lower realtime preset or deterministic export.`;
  }
  return "No video data was produced. Try a lower realtime preset or deterministic export.";
}

export function validateCaptureRecorderBlob(
  blob: Blob,
  context?: CaptureRecorderOutputContext,
): void {
  if (blob.size > 0) return;
  throw new EmptyCaptureRecordingError(formatEmptyCaptureRecordingMessage(context));
}

function requestCanvasCaptureFrame(stream: MediaStream): void {
  const track = stream.getVideoTracks?.()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  track?.requestFrame?.();
}

export function createMediaStreamRecorder(
  stream: MediaStream,
  options: {
    mimeType: string;
    outputContext?: CaptureRecorderOutputContext;
    onStop?: () => void;
    onUnexpectedStop?: (result: CaptureRecorderResult) => void;
    onRecorderError?: (error: Error) => void;
  },
): CaptureRecorderController {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder is not available in this browser.");
  }
  const recorder = new MediaRecorder(stream, {
    mimeType: options.mimeType,
    videoBitsPerSecond: 18_000_000,
  });
  const chunks: Blob[] = [];
  let stopRequested = false;
  let stopCalled = false;
  let finished = false;
  let resolveResult: (result: CaptureRecorderResult) => void = () => undefined;
  let rejectResult: (error: unknown) => void = () => undefined;
  const resultPromise = new Promise<CaptureRecorderResult>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const requestDataSupported = typeof recorder.requestData === "function";
  let byteLength = 0;
  let chunkCount = 0;
  let emptyChunkCount = 0;

  recorder.addEventListener("dataavailable", (event: Event) => {
    const data = (event as BlobEvent).data;
    if (data && data.size > 0) {
      chunkCount += 1;
      byteLength += data.size;
      chunks.push(data);
    } else if (data) {
      emptyChunkCount += 1;
    }
  });

  const finish = () => {
    if (finished) return;
    finished = true;
    try {
      const blob = new Blob(chunks, { type: options.mimeType });
      validateCaptureRecorderBlob(blob, options.outputContext);
      const diagnostics: CaptureRecorderDiagnostics = {
        chunkCount,
        emptyChunkCount,
        byteLength: blob.size,
        requestDataSupported,
      };
      const result = {
        blob,
        url: URL.createObjectURL(blob),
        mimeType: options.mimeType,
        byteLength: blob.size,
        diagnostics,
      };
      resolveResult(result);
      if (!stopRequested) {
        options.onUnexpectedStop?.(result);
      }
    } catch (error) {
      const recordingError =
        error instanceof Error ? error : new Error("Recording failed.");
      rejectResult(recordingError);
      if (!stopRequested) {
        options.onRecorderError?.(recordingError);
      }
    } finally {
      options.onStop?.();
    }
  };
  const fail = (error: Error) => {
    if (finished) return;
    finished = true;
    options.onStop?.();
    rejectResult(error);
    if (!stopRequested) {
      options.onRecorderError?.(error);
    }
  };
  recorder.addEventListener("stop", finish, { once: true });
  recorder.addEventListener(
    "error",
    (event) => {
      fail(
        event instanceof ErrorEvent && event.error instanceof Error
          ? event.error
          : new Error("Recording failed."),
      );
    },
    { once: true },
  );

  recorder.start(1000);

  return {
    mimeType: options.mimeType,
    stop() {
      stopRequested = true;
      if (!stopCalled && recorder.state !== "inactive") {
        stopCalled = true;
        try {
          recorder.requestData?.();
        } catch {
          // Some browsers throw when flushing a recorder that is already ending.
        }
        recorder.stop();
      }
      if (recorder.state === "inactive" && !finished) {
        queueMicrotask(finish);
      }
      return resultPromise;
    },
  };
}

export function createCanvasPreviewRecorder({
  canvas,
  fps,
  mimeType,
  outputContext,
  onAfterRender,
  frameRequestIntervalMs,
  onUnexpectedStop,
  onRecorderError,
}: CanvasPreviewRecorderOptions): CaptureRecorderController {
  if (typeof canvas.captureStream !== "function") {
    throw new Error("Canvas captureStream is not available in this browser.");
  }
  const stream = canvas.captureStream(fps);
  let unsubscribeAfterRender: (() => void) | null = null;
  let framePump: ReturnType<typeof setInterval> | null = null;
  const recorder = createMediaStreamRecorder(stream, {
    mimeType,
    outputContext,
    onStop: () => {
      if (framePump !== null) {
        globalThis.clearInterval(framePump);
        framePump = null;
      }
      unsubscribeAfterRender?.();
      unsubscribeAfterRender = null;
      stopMediaStreamTracks(stream);
    },
    onUnexpectedStop,
    onRecorderError,
  });
  const requestFrame = () => requestCanvasCaptureFrame(stream);
  requestFrame();
  unsubscribeAfterRender = onAfterRender?.(requestFrame) ?? null;
  const pumpIntervalMs =
    typeof frameRequestIntervalMs === "number" && Number.isFinite(frameRequestIntervalMs)
      ? Math.max(16, frameRequestIntervalMs)
      : Math.max(16, Math.round(1000 / fps));
  framePump = globalThis.setInterval(requestFrame, pumpIntervalMs);
  return recorder;
}
