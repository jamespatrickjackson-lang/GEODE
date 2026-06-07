import type { CaptureMode, CaptureResolution } from "./captureTypes";
import type { CaptureJobDiagnostics } from "./captureJobTypes";
import type { CaptureDeterministicExportFormat } from "./captureTypes";

export interface CapturePathJobDiagnosticInput {
  mode: Exclude<CaptureMode, "off">;
  pathVersion: 1 | 2 | 3;
  nodeCount: number;
  segmentCount: number;
  durationSeconds: number;
  fps: number;
  resolution: Pick<CaptureResolution, "width" | "height" | "label">;
  format?: CaptureDeterministicExportFormat | "webm";
  totalFrames?: number;
  renderedFrames?: number;
  maxDetail?: boolean;
  mediaRecorder?: boolean;
}

export function capturePathJobDiagnostics(
  input: CapturePathJobDiagnosticInput,
): CaptureJobDiagnostics {
  return {
    captureMode: input.mode,
    pathVersion: input.pathVersion,
    nodeCount: input.nodeCount,
    segmentCount: input.segmentCount,
    durationSeconds: input.durationSeconds,
    fps: input.fps,
    resolutionLabel: input.resolution.label,
    width: input.resolution.width,
    height: input.resolution.height,
    format: input.format ?? null,
    totalFrames: input.totalFrames ?? null,
    renderedFrames: input.renderedFrames ?? 0,
    ...(input.maxDetail ? { maxDetail: true } : { maxDetail: false }),
    ...(input.mediaRecorder ? { mediaRecorder: true } : { mediaRecorder: false }),
  };
}

export function captureVideoOutputDiagnostics(input: {
  outputByteLength: number;
  encoderPreset?: string | null;
  mimeType?: string | null;
  filename?: string | null;
}): CaptureJobDiagnostics {
  return {
    outputByteLength: input.outputByteLength,
    encoderPreset: input.encoderPreset ?? null,
    mimeType: input.mimeType ?? null,
    filename: input.filename ?? null,
  };
}

export function mergeCaptureJobDiagnostics(
  ...entries: Array<CaptureJobDiagnostics | null | undefined>
): CaptureJobDiagnostics {
  return Object.assign({}, ...entries.filter(Boolean));
}
