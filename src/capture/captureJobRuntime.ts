import type {
  CaptureJobCancelOptions,
  CaptureJobCompleteOptions,
  CaptureJobCreateOptions,
  CaptureJobFailureOptions,
  CaptureJobOutput,
  CaptureJobProgress,
  CaptureJobRecord,
  CaptureJobStatus,
} from "./captureJobTypes";

let captureJobIdCounter = 0;

const RUNNING_JOB_STATUSES = new Set<CaptureJobStatus>([
  "queued",
  "preparing",
  "rendering",
  "encoding",
]);

function nowMs(now?: () => number): number {
  return now ? now() : Date.now();
}

function nextCaptureJobId(kind: CaptureJobRecord["kind"]): string {
  captureJobIdCounter += 1;
  return `capture-job-${kind}-${captureJobIdCounter}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  return "Capture job failed.";
}

export function createCaptureJobRecord(
  options: CaptureJobCreateOptions,
): CaptureJobRecord {
  return {
    id: options.id ?? nextCaptureJobId(options.kind),
    kind: options.kind,
    label: options.label,
    status: "queued",
    progress: options.progress ?? { phase: "preparing" },
    startedAt: nowMs(options.now),
    completedAt: null,
    error: null,
    output: null,
    diagnostics: options.diagnostics ?? {},
    abortController: options.abortController ?? null,
  };
}

export function updateCaptureJobStatus(
  job: CaptureJobRecord,
  status: CaptureJobStatus,
  options: { now?: () => number; progress?: CaptureJobProgress } = {},
): CaptureJobRecord {
  const completed =
    status === "complete" || status === "failed" || status === "cancelled";
  return {
    ...job,
    status,
    progress: options.progress ?? job.progress,
    completedAt: completed ? nowMs(options.now) : job.completedAt,
  };
}

export function updateCaptureJobProgress(
  job: CaptureJobRecord,
  progress: CaptureJobProgress,
): CaptureJobRecord {
  return {
    ...job,
    progress: {
      ...job.progress,
      ...progress,
    },
    diagnostics: {
      ...job.diagnostics,
      ...(typeof progress.renderedFrames === "number"
        ? { renderedFrames: progress.renderedFrames }
        : {}),
      ...(typeof progress.totalFrames === "number"
        ? { totalFrames: progress.totalFrames }
        : {}),
    },
  };
}

export function completeCaptureJob(
  job: CaptureJobRecord,
  options: CaptureJobCompleteOptions = {},
): CaptureJobRecord {
  return {
    ...job,
    status: "complete",
    progress: {
      ...job.progress,
      ...options.progress,
      phase: "complete",
      percent: options.progress?.percent ?? 1,
    },
    completedAt: nowMs(options.now),
    error: null,
    output: options.output ?? job.output,
    diagnostics: {
      ...job.diagnostics,
      ...options.diagnostics,
      ...(typeof options.output?.byteLength === "number"
        ? { outputByteLength: options.output.byteLength }
        : {}),
    },
  };
}

export function failCaptureJob(
  job: CaptureJobRecord,
  error: unknown,
  options: CaptureJobFailureOptions = {},
): CaptureJobRecord {
  return {
    ...job,
    status: "failed",
    completedAt: nowMs(options.now),
    error: errorMessage(error),
    diagnostics: {
      ...job.diagnostics,
      ...options.diagnostics,
      failureReason: errorMessage(error),
    },
  };
}

export function cancelCaptureJob(
  job: CaptureJobRecord,
  options: CaptureJobCancelOptions = {},
): CaptureJobRecord {
  job.abortController?.abort?.();
  const reason = options.reason ?? "Capture job was cancelled.";
  return {
    ...job,
    status: "cancelled",
    completedAt: nowMs(options.now),
    error: reason,
    diagnostics: {
      ...job.diagnostics,
      ...options.diagnostics,
      cancellationReason: reason,
    },
  };
}

export function clearCaptureJobRecord(job: CaptureJobRecord): void {
  const output: CaptureJobOutput | null = job.output;
  try {
    output?.cleanup?.();
  } finally {
    if (output?.url) {
      URL.revokeObjectURL(output.url);
    }
  }
}

export function isCaptureJobRunning(job: CaptureJobRecord | null | undefined): boolean {
  return !!job && RUNNING_JOB_STATUSES.has(job.status);
}

export function canStartCaptureJob(jobs: readonly CaptureJobRecord[]): boolean {
  return !jobs.some(isCaptureJobRunning);
}

export function captureJobProgressPercent(job: CaptureJobRecord | null | undefined): number {
  if (!job) return 0;
  if (typeof job.progress.percent === "number") {
    return Math.max(0, Math.min(1, job.progress.percent));
  }
  if (
    typeof job.progress.renderedFrames === "number" &&
    typeof job.progress.totalFrames === "number" &&
    job.progress.totalFrames > 0
  ) {
    return Math.max(
      0,
      Math.min(1, job.progress.renderedFrames / job.progress.totalFrames),
    );
  }
  return job.status === "complete" ? 1 : 0;
}
