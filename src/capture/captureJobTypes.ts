export type CaptureJobKind =
  | "realtime-preview"
  | "path-preview"
  | "path-preview-transcode"
  | "deterministic-video"
  | "path-video"
  | "still"
  | "external-still"
  | "external-video"
  | "scroll-package";

export type CaptureJobStatus =
  | "idle"
  | "queued"
  | "preparing"
  | "rendering"
  | "encoding"
  | "complete"
  | "failed"
  | "cancelled";

export interface CaptureJobProgress {
  phase?:
    | "preparing"
    | "rendering"
    | "writing-frames"
    | "encoding"
    | "finalizing"
    | "complete";
  renderedFrames?: number;
  totalFrames?: number;
  writtenFrames?: number;
  percent?: number;
  message?: string;
}

export type CaptureJobDiagnostics = Record<string, unknown>;

export interface CaptureJobOutput {
  blob?: Blob | { size: number } | null;
  url?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  byteLength?: number;
  cleanup?: (() => void) | null;
}

export interface CaptureJobRecord {
  id: string;
  kind: CaptureJobKind;
  label: string;
  status: CaptureJobStatus;
  progress: CaptureJobProgress;
  startedAt: number;
  completedAt: number | null;
  error: string | null;
  output: CaptureJobOutput | null;
  diagnostics: CaptureJobDiagnostics;
  abortController?: AbortController | { abort?: () => void; signal?: unknown } | null;
}

export interface CaptureJobCreateOptions {
  kind: CaptureJobKind;
  label: string;
  id?: string;
  now?: () => number;
  abortController?: CaptureJobRecord["abortController"];
  diagnostics?: CaptureJobDiagnostics;
  progress?: CaptureJobProgress;
}

export interface CaptureJobCompleteOptions {
  now?: () => number;
  output?: CaptureJobOutput | null;
  diagnostics?: CaptureJobDiagnostics;
  progress?: CaptureJobProgress;
}

export interface CaptureJobFailureOptions {
  now?: () => number;
  diagnostics?: CaptureJobDiagnostics;
}

export interface CaptureJobCancelOptions extends CaptureJobFailureOptions {
  reason?: string;
}
