import type { CaptureVideoRenderJobV1 } from "./externalVideoRenderJob";
import type { CaptureScrollRecordRequestV1 } from "./captureScrollTimeline";
import type { ScrollHandoffPackageV1 } from "./scrollHandoffPackage";

export const LOCAL_SCROLL_PACKAGE_ENDPOINTS = {
  start: "/api/capture/scroll-package/start",
  status: "/api/capture/scroll-package/status",
  cancel: "/api/capture/scroll-package/cancel",
  output: "/api/capture/scroll-package-output",
  availability: "/api/capture/scroll-package/availability",
} as const;

export type LocalScrollPackageRenderStatus =
  | "queued"
  | "preparing"
  | "rendering"
  | "encoding"
  | "finalizing"
  | "complete"
  | "failed"
  | "cancelled";

export interface LocalScrollPackageRunStatus {
  runId: string;
  status: LocalScrollPackageRenderStatus;
  phase: LocalScrollPackageRenderStatus;
  startedAt: string;
  completedAt?: string | null;
  packageName: string;
  packagePath: string;
  manifestPath: string;
  manifestUrl: string | null;
  outputUrl: string | null;
  diagnosticsPath: string;
  error?: string | null;
  exitCode?: number | null;
  elapsedSeconds?: number;
  renderedFrames?: number;
  totalFrames?: number | null;
  renderer?: string | null;
  superscale?: number | null;
  mediaPath?: string | null;
  mediaUrl?: string | null;
  frameSequenceDir?: string | null;
  warnings?: string[];
}

export interface StartLocalScrollPackageRenderJobOptions {
  request: CaptureScrollRecordRequestV1;
  manifest: ScrollHandoffPackageV1;
  renderJob: CaptureVideoRenderJobV1;
  synthetic?: boolean;
}

export interface LocalScrollPackageAvailability {
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
    const error =
      parsed?.error ?? `Local scroll package request failed (${response.status}).`;
    throw new Error(error);
  }
  return parsed as T;
}

function renderJobWithScrollFrameRange(
  request: CaptureScrollRecordRequestV1,
  renderJob: CaptureVideoRenderJobV1,
): CaptureVideoRenderJobV1 {
  const totalFrames = request.frameRange.totalFrames;
  return {
    ...renderJob,
    video: {
      ...renderJob.video,
      fps: request.timeline.fps,
      totalFrames,
      durationSeconds: totalFrames / request.timeline.fps,
      sourceFrameStart: request.frameRange.startFrame,
      sourceFrameEnd: request.frameRange.endFrame,
    },
  };
}

export async function startLocalScrollPackageRenderJob({
  request,
  manifest,
  renderJob,
  synthetic,
}: StartLocalScrollPackageRenderJobOptions): Promise<LocalScrollPackageRunStatus> {
  return postJson<LocalScrollPackageRunStatus>(LOCAL_SCROLL_PACKAGE_ENDPOINTS.start, {
    request,
    manifest,
    renderJob: renderJobWithScrollFrameRange(request, renderJob),
    synthetic: synthetic === true,
  });
}

export async function pollLocalScrollPackageRenderJob(
  runId: string,
): Promise<LocalScrollPackageRunStatus> {
  return postJson<LocalScrollPackageRunStatus>(LOCAL_SCROLL_PACKAGE_ENDPOINTS.status, {
    runId,
  });
}

export async function cancelLocalScrollPackageRenderJob(
  runId: string,
): Promise<LocalScrollPackageRunStatus> {
  return postJson<LocalScrollPackageRunStatus>(LOCAL_SCROLL_PACKAGE_ENDPOINTS.cancel, {
    runId,
  });
}

export function scrollPackageOutputUrl(
  runId: string,
  variant: "manifest" | "diagnostics" | "media" | "frame" | "package",
  path?: string,
): string {
  const params = new URLSearchParams({ runId, variant });
  if (path) params.set("path", path);
  return `${LOCAL_SCROLL_PACKAGE_ENDPOINTS.output}?${params.toString()}`;
}

export async function localScrollPackageRendererAvailable(): Promise<LocalScrollPackageAvailability> {
  try {
    return await postJson<LocalScrollPackageAvailability>(
      LOCAL_SCROLL_PACKAGE_ENDPOINTS.availability,
      {},
    );
  } catch (error) {
    return {
      available: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
