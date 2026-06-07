import type {
  CaptureRecorderController,
  DisplayPreviewRecorderOptions,
} from "./captureTypes";
import {
  createMediaStreamRecorder,
  stopMediaStreamTracks,
} from "./canvasPreviewRecorder";

export async function createDisplayPreviewRecorder({
  fps,
  mimeType,
  outputContext,
  onUnexpectedStop,
  onRecorderError,
}: DisplayPreviewRecorderOptions): Promise<CaptureRecorderController> {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getDisplayMedia) {
    throw new Error("Full UI capture is not available in this browser.");
  }
  let stream: MediaStream;
  try {
    stream = await mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === "NotAllowedError"
        ? "Full UI capture permission was denied."
        : "Full UI capture could not start.";
    throw new Error(message);
  }
  return createMediaStreamRecorder(stream, {
    mimeType,
    outputContext: outputContext ?? { mode: "full-ui", fps },
    onStop: () => stopMediaStreamTracks(stream),
    onUnexpectedStop,
    onRecorderError,
  });
}
