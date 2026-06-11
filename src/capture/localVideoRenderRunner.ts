import type { CaptureVideoRenderJobV1 } from "./externalVideoRenderJob";

export const LOCAL_VIDEO_RENDER_ENDPOINTS = {
  start: "/api/capture/render-video",
  status: "/api/capture/video-status",
  cancel: "/api/capture/cancel-video",
  output: "/api/capture/video-output",
  availability: "/api/capture/video-renderer-availability",
} as const;

export type LocalVideoRenderStatus =
  | "queued"
  | "preparing"
  | "rendering"
  | "encoding"
  | "complete"
  | "failed"
  | "cancelled";

export interface LocalVideoRenderRunStatus {
  runId: string;
  status: LocalVideoRenderStatus;
  phase: LocalVideoRenderStatus;
  startedAt: string;
  completedAt?: string | null;
  outputFilename: string;
  outputPath: string;
  outputUrl: string | null;
  diagnosticsPath: string;
  error?: string | null;
  exitCode?: number | null;
  elapsedSeconds?: number;
  renderedFrames?: number;
  totalFrames?: number | null;
  renderer?: string | null;
  superscale?: number | null;
  masterUrl?: string | null;
  masterPath?: string | null;
  frameSequenceDir?: string | null;
}

export interface StartLocalVideoRenderJobOptions {
  job: CaptureVideoRenderJobV1;
  outputFilename?: string;
}

export interface LocalVideoRenderAvailability {
  available: boolean;
  reason?: string;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = parsed?.error ?? `Local video render request failed (${response.status}).`;
    throw new Error(error);
  }
  return parsed as T;
}

export async function startLocalVideoRenderJob({
  job,
  outputFilename,
}: StartLocalVideoRenderJobOptions): Promise<LocalVideoRenderRunStatus> {
  return postJson<LocalVideoRenderRunStatus>(LOCAL_VIDEO_RENDER_ENDPOINTS.start, {
    job,
    outputFilename: outputFilename ?? job.video.filename,
  });
}

export async function pollLocalVideoRenderJob(
  runId: string,
): Promise<LocalVideoRenderRunStatus> {
  return postJson<LocalVideoRenderRunStatus>(LOCAL_VIDEO_RENDER_ENDPOINTS.status, {
    runId,
  });
}

export async function cancelLocalVideoRenderJob(
  runId: string,
): Promise<LocalVideoRenderRunStatus> {
  return postJson<LocalVideoRenderRunStatus>(LOCAL_VIDEO_RENDER_ENDPOINTS.cancel, {
    runId,
  });
}

export async function localRendererAvailable(): Promise<LocalVideoRenderAvailability> {
  try {
    const status = await postJson<{ available: boolean; reason?: string }>(
      LOCAL_VIDEO_RENDER_ENDPOINTS.availability,
      {},
    );
    return status;
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
