import {
  getCaptureFrameTime,
  validateCaptureRecipe,
} from "./captureRecipe";
import type {
  DeterministicFrameMimeType,
  DeterministicFrameSequenceFrame,
  DeterministicFrameSequenceResult,
} from "./deterministicFrameSequenceExporter";

export type CaptureVideoFormat = "mp4" | "webm";
export type CaptureVideoCodec = "h264" | "vp9";
export type CaptureVideoEncodePreset =
  | "mp4-h264-marketing"
  | "webm-vp9-marketing";

interface CaptureVideoEncodePresetDefinition {
  preset: CaptureVideoEncodePreset;
  format: CaptureVideoFormat;
  codec: CaptureVideoCodec;
  outputExtension: "mp4" | "webm";
  outputMimeType: "video/mp4" | "video/webm";
  crf: number;
}

export interface FfmpegFrameSequenceRuntime {
  writeFile(path: string, data: Uint8Array): Promise<void>;
  exec(
    args: string[],
    options?: FfmpegFrameSequenceRuntimeExecOptions,
  ): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  deleteFile?(path: string): Promise<void>;
}

export type CaptureVideoEncodeProgressPhase =
  | "writing-frames"
  | "encoding"
  | "finalizing"
  | "complete";

export interface CaptureVideoEncodeProgress {
  phase: CaptureVideoEncodeProgressPhase;
  framesWritten?: number;
  totalFrames?: number;
  percent?: number;
  message?: string;
  ffmpegProgress?: number;
  ffmpegTimeSeconds?: number;
  log?: string;
}

export interface FfmpegFrameSequenceRuntimeExecOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (progress: CaptureVideoEncodeProgress) => void;
}

export interface CaptureVideoEncodeValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FfmpegFrameSequenceInputFile {
  path: string;
  frameIndex: number;
  frame: DeterministicFrameSequenceFrame;
}

export interface CaptureVideoEncodePlanOptions {
  preset: CaptureVideoEncodePreset;
  virtualDirectory?: string;
  frameBasename?: string;
  outputBasename?: string;
}

export interface FfmpegFrameSequenceEncodeArgsOptions {
  preset: CaptureVideoEncodePreset;
  fps: number;
  inputPattern: string;
  outputPath: string;
}

export interface FfmpegFrameSequenceEncodePlan {
  preset: CaptureVideoEncodePreset;
  format: CaptureVideoFormat;
  codec: CaptureVideoCodec;
  outputMimeType: "video/mp4" | "video/webm";
  outputFilename: string;
  outputPath: string;
  inputPattern: string;
  inputFiles: FfmpegFrameSequenceInputFile[];
  args: string[];
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
}

export interface CaptureVideoEncodeOptions extends CaptureVideoEncodePlanOptions {
  sequence: DeterministicFrameSequenceResult;
  runtime: FfmpegFrameSequenceRuntime;
  signal?: AbortSignal;
  cleanupInputFrames?: boolean;
  execTimeoutMs?: number;
  stallTimeoutMs?: number;
  onProgress?: (progress: CaptureVideoEncodeProgress) => void;
}

export interface CaptureVideoEncodeResult {
  plan: FfmpegFrameSequenceEncodePlan;
  blob: Blob;
  url: string;
  mimeType: "video/mp4" | "video/webm";
  filename: string;
  cleanup(): void;
}

const ENCODE_PRESETS: Record<
  CaptureVideoEncodePreset,
  CaptureVideoEncodePresetDefinition
> = {
  "mp4-h264-marketing": {
    preset: "mp4-h264-marketing",
    format: "mp4",
    codec: "h264",
    outputExtension: "mp4",
    outputMimeType: "video/mp4",
    crf: 18,
  },
  "webm-vp9-marketing": {
    preset: "webm-vp9-marketing",
    format: "webm",
    codec: "vp9",
    outputExtension: "webm",
    outputMimeType: "video/webm",
    crf: 28,
  },
};

const ALLOWED_FRAME_MIME_TYPES = new Set<DeterministicFrameMimeType>([
  "image/png",
  "image/webp",
]);
const DEFAULT_ENCODE_EXEC_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_ENCODE_STALL_TIMEOUT_MS = 2 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isAllowedFrameMimeType(
  value: unknown,
): value is DeterministicFrameMimeType {
  return (
    typeof value === "string" &&
    ALLOWED_FRAME_MIME_TYPES.has(value as DeterministicFrameMimeType)
  );
}

function hasReadableBlob(value: unknown): value is Blob {
  return (
    isRecord(value) &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number" &&
    value.size > 0
  );
}

function frameExtension(mimeType: DeterministicFrameMimeType): "png" | "webp" {
  return mimeType === "image/webp" ? "webp" : "png";
}

function normalizeVirtualDirectory(directory: string | undefined): string {
  const candidate = (directory ?? "/geosee-capture")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
  if (!candidate || candidate === ".") return "/geosee-capture";
  return candidate.startsWith("/") ? candidate : `/${candidate}`;
}

function sanitizeBasename(value: string | undefined, fallback: string): string {
  const sanitized = (value ?? fallback)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}

function paddedFrameIndex(frameIndex: number): string {
  return String(frameIndex).padStart(6, "0");
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw new DOMException("Frame-sequence video encoding was aborted.", "AbortError");
}

function formatEncodeTimeout(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  return `${seconds}s`;
}

function normalizeEncodeTimeout(value: number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return fallback;
}

async function runEncodingWithWatchdog<T>({
  operation,
  signal,
  execTimeoutMs,
  stallTimeoutMs,
  onProgress,
}: {
  operation: (markProgress: () => void) => Promise<T>;
  signal?: AbortSignal;
  execTimeoutMs: number;
  stallTimeoutMs: number;
  onProgress?: (progress: CaptureVideoEncodeProgress) => void;
}): Promise<T> {
  throwIfAborted(signal);
  let settled = false;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let rejectWatchdog: ((error: Error) => void) | null = null;

  const clearTimers = () => {
    if (stallTimer) {
      clearTimeout(stallTimer);
      stallTimer = null;
    }
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
  };

  const watchdogPromise = new Promise<never>((_resolve, reject) => {
    rejectWatchdog = reject;
    const failStalled = () => {
      if (settled) return;
      reject(
        new Error(
          `Encoding stalled after ${formatEncodeTimeout(
            stallTimeoutMs,
          )} without FFmpeg progress. Cancel and use external render for 4K/page sequences.`,
        ),
      );
    };
    const failTimedOut = () => {
      if (settled) return;
      reject(
        new Error(
          `Encoding exceeded ${formatEncodeTimeout(
            execTimeoutMs,
          )}. Use external render for final 4K/page-sequence output.`,
        ),
      );
    };
    stallTimer = setTimeout(failStalled, stallTimeoutMs);
    timeoutTimer = setTimeout(failTimedOut, execTimeoutMs);
  });

  const markProgress = () => {
    if (settled) return;
    if (stallTimer) {
      clearTimeout(stallTimer);
    }
    stallTimer = setTimeout(() => {
      if (settled || !rejectWatchdog) return;
      rejectWatchdog(
        new Error(
          `Encoding stalled after ${formatEncodeTimeout(
            stallTimeoutMs,
          )} without FFmpeg progress. Cancel and use external render for 4K/page sequences.`,
        ),
      );
    }, stallTimeoutMs);
  };

  try {
    return await Promise.race([
      operation(markProgress),
      watchdogPromise,
    ]);
  } finally {
    settled = true;
    clearTimers();
    onProgress?.({
      phase: "finalizing",
      percent: 0.99,
      message: "Finalizing encoded video.",
    });
  }
}

async function deleteVirtualFiles(
  runtime: FfmpegFrameSequenceRuntime,
  paths: string[],
): Promise<void> {
  if (!runtime.deleteFile) return;
  await Promise.all(
    [...new Set(paths)].map(async (path) => {
      try {
        await runtime.deleteFile?.(path);
      } catch {
        // Some FFmpeg runtimes throw when a path was never created.
      }
    }),
  );
}

export function validateDeterministicFrameSequenceForEncoding(
  sequence: DeterministicFrameSequenceResult,
): CaptureVideoEncodeValidationResult {
  const errors: string[] = [];
  if (!isRecord(sequence)) {
    return { valid: false, errors: ["Frame sequence is missing."] };
  }

  const recipeValidation = validateCaptureRecipe(sequence.recipe);
  if (!recipeValidation.valid) {
    errors.push(...recipeValidation.errors.map((error) => `recipe ${error}`));
  }
  if (sequence.recipe.mode === "off") {
    errors.push("off mode cannot be encoded as deterministic video.");
  }
  if (sequence.recipe.mode === "full-ui") {
    errors.push("full-ui display capture cannot be encoded from frame sequence.");
  }

  if (!Number.isInteger(sequence.width) || sequence.width <= 0) {
    errors.push("sequence width must be a positive integer.");
  }
  if (!Number.isInteger(sequence.height) || sequence.height <= 0) {
    errors.push("sequence height must be a positive integer.");
  }
  if (!Number.isInteger(sequence.totalFrames) || sequence.totalFrames <= 0) {
    errors.push("totalFrames must be a positive integer.");
  }
  if (!Number.isFinite(sequence.fps) || sequence.fps <= 0) {
    errors.push("fps must be greater than zero.");
  }
  if (sequence.recipe && sequence.fps !== sequence.recipe.fps) {
    errors.push("sequence fps must match recipe fps.");
  }
  if (
    sequence.recipe &&
    (sequence.width !== sequence.recipe.resolution?.width ||
      sequence.height !== sequence.recipe.resolution?.height)
  ) {
    errors.push("sequence dimensions must match recipe resolution.");
  }

  const expectedTotalFrames = sequence.recipe
    ? Math.max(1, Math.ceil(sequence.recipe.durationSeconds * sequence.recipe.fps))
    : null;
  if (
    expectedTotalFrames !== null &&
    Number.isFinite(expectedTotalFrames) &&
    sequence.totalFrames !== expectedTotalFrames
  ) {
    errors.push("sequence frame count must match recipe duration and fps.");
  }

  if (!Array.isArray(sequence.frames)) {
    errors.push("frames must be an array.");
    return { valid: false, errors };
  }
  if (sequence.frames.length !== sequence.totalFrames) {
    errors.push("frames length must match totalFrames frame count.");
  }

  let firstMimeType: DeterministicFrameMimeType | null = null;
  sequence.frames.forEach((frame, index) => {
    if (!isRecord(frame)) {
      errors.push(`frames[${index}] must be an object.`);
      return;
    }
    if (frame.frameIndex !== index) {
      errors.push(`frames[${index}].frameIndex must be ${index}.`);
    }
    if (
      typeof frame.timeSeconds !== "number" ||
      !Number.isFinite(frame.timeSeconds) ||
      Math.abs(frame.timeSeconds - getCaptureFrameTime(index, sequence.fps)) >
        0.000_001
    ) {
      errors.push(`frames[${index}].timeSeconds must equal frameIndex / fps.`);
    }
    if (frame.width !== sequence.width || frame.height !== sequence.height) {
      errors.push(`frames[${index}] dimensions must match sequence dimensions.`);
    }
    if (!hasReadableBlob(frame.blob)) {
      errors.push(`frames[${index}].blob must contain encoded frame bytes.`);
    }
    if (!isAllowedFrameMimeType(frame.mimeType)) {
      errors.push(`frames[${index}].mimeType must be image/png or image/webp.`);
    } else if (!firstMimeType) {
      firstMimeType = frame.mimeType;
    } else if (frame.mimeType !== firstMimeType) {
      errors.push("all frames must use the same mimeType.");
    }
    if (
      isRecord(frame.blob) &&
      typeof frame.blob.type === "string" &&
      isAllowedFrameMimeType(frame.mimeType) &&
      frame.blob.type &&
      frame.blob.type !== frame.mimeType
    ) {
      errors.push(`frames[${index}].blob type must match frame mimeType.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function buildFfmpegFrameSequenceEncodeArgs({
  preset,
  fps,
  inputPattern,
  outputPath,
}: FfmpegFrameSequenceEncodeArgsOptions): string[] {
  const definition = ENCODE_PRESETS[preset];
  if (!definition) {
    throw new Error(`Unsupported capture video encode preset: ${preset}`);
  }

  const baseArgs = [
    "-hide_banner",
    "-y",
    "-framerate",
    String(fps),
    "-start_number",
    "0",
    "-i",
    inputPattern,
    "-an",
  ];

  if (definition.codec === "h264") {
    return [
      ...baseArgs,
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      String(definition.crf),
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ];
  }

  return [
    ...baseArgs,
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    String(definition.crf),
    "-deadline",
    "good",
    "-cpu-used",
    "2",
    "-row-mt",
    "1",
    "-pix_fmt",
    "yuv420p",
    outputPath,
  ];
}

export function createFfmpegFrameSequenceEncodePlan(
  sequence: DeterministicFrameSequenceResult,
  options: CaptureVideoEncodePlanOptions,
): FfmpegFrameSequenceEncodePlan {
  const validation = validateDeterministicFrameSequenceForEncoding(sequence);
  if (!validation.valid) {
    throw new Error(`Invalid frame sequence: ${validation.errors.join(" ")}`);
  }

  const definition = ENCODE_PRESETS[options.preset];
  if (!definition) {
    throw new Error(`Unsupported capture video encode preset: ${options.preset}`);
  }
  if (definition.codec === "h264" && (sequence.width % 2 || sequence.height % 2)) {
    throw new Error(
      "MP4/H.264 yuv420p output requires even sequence width and height.",
    );
  }

  const virtualDirectory = normalizeVirtualDirectory(options.virtualDirectory);
  const frameBasename = sanitizeBasename(options.frameBasename, "frame");
  const outputBasename = sanitizeBasename(options.outputBasename, "output");
  const extension = frameExtension(sequence.frames[0].mimeType);
  const inputPattern = `${virtualDirectory}/${frameBasename}-%06d.${extension}`;
  const outputFilename = `${outputBasename}.${definition.outputExtension}`;
  const outputPath = `${virtualDirectory}/${outputFilename}`;
  const inputFiles = sequence.frames.map((frame) => ({
    path: `${virtualDirectory}/${frameBasename}-${paddedFrameIndex(
      frame.frameIndex,
    )}.${extension}`,
    frameIndex: frame.frameIndex,
    frame,
  }));

  return {
    preset: definition.preset,
    format: definition.format,
    codec: definition.codec,
    outputMimeType: definition.outputMimeType,
    outputFilename,
    outputPath,
    inputPattern,
    inputFiles,
    args: buildFfmpegFrameSequenceEncodeArgs({
      preset: definition.preset,
      fps: sequence.fps,
      inputPattern,
      outputPath,
    }),
    fps: sequence.fps,
    width: sequence.width,
    height: sequence.height,
    totalFrames: sequence.totalFrames,
  };
}

export async function encodeDeterministicFrameSequenceWithFfmpeg({
  sequence,
  runtime,
  signal,
  cleanupInputFrames = false,
  execTimeoutMs,
  stallTimeoutMs,
  onProgress,
  ...planOptions
}: CaptureVideoEncodeOptions): Promise<CaptureVideoEncodeResult> {
  let plan: FfmpegFrameSequenceEncodePlan | null = null;

  try {
    plan = createFfmpegFrameSequenceEncodePlan(sequence, planOptions);
    onProgress?.({
      phase: "writing-frames",
      framesWritten: 0,
      totalFrames: plan.totalFrames,
      percent: 0,
      message: "Writing frames to encoder.",
    });
    for (const inputFile of plan.inputFiles) {
      throwIfAborted(signal);
      const data = new Uint8Array(await inputFile.frame.blob.arrayBuffer());
      await runtime.writeFile(inputFile.path, data);
      onProgress?.({
        phase: "writing-frames",
        framesWritten: inputFile.frameIndex + 1,
        totalFrames: plan.totalFrames,
        percent: Math.min(0.2, ((inputFile.frameIndex + 1) / plan.totalFrames) * 0.2),
        message: `Writing frame ${inputFile.frameIndex + 1}/${plan.totalFrames} to encoder.`,
      });
    }
    throwIfAborted(signal);
    onProgress?.({
      phase: "encoding",
      framesWritten: plan.totalFrames,
      totalFrames: plan.totalFrames,
      percent: 0.2,
      message: "Encoding video. No file has been saved yet.",
    });
    const activePlan = plan;
    await runEncodingWithWatchdog({
      signal,
      execTimeoutMs: normalizeEncodeTimeout(
        execTimeoutMs,
        DEFAULT_ENCODE_EXEC_TIMEOUT_MS,
      ),
      stallTimeoutMs: normalizeEncodeTimeout(
        stallTimeoutMs,
        DEFAULT_ENCODE_STALL_TIMEOUT_MS,
      ),
      onProgress,
      operation: (markProgress) =>
        runtime.exec(activePlan.args, {
          signal,
          timeoutMs: normalizeEncodeTimeout(
            execTimeoutMs,
            DEFAULT_ENCODE_EXEC_TIMEOUT_MS,
          ),
          onProgress: (progress) => {
            markProgress();
            onProgress?.({
              ...progress,
              phase: "encoding",
              framesWritten: plan?.totalFrames,
              totalFrames: plan?.totalFrames,
              percent:
                typeof progress.percent === "number"
                  ? Math.max(0.2, Math.min(0.98, 0.2 + progress.percent * 0.78))
                  : typeof progress.ffmpegProgress === "number"
                    ? Math.max(
                        0.2,
                        Math.min(0.98, 0.2 + progress.ffmpegProgress * 0.78),
                      )
                    : progress.percent,
              message: progress.message ?? "Encoding video. No file has been saved yet.",
            });
          },
        }),
    });
    throwIfAborted(signal);
    onProgress?.({
      phase: "finalizing",
      framesWritten: plan.totalFrames,
      totalFrames: plan.totalFrames,
      percent: 0.99,
      message: "Reading encoded video output.",
    });
    const outputData = await runtime.readFile(plan.outputPath);
    const outputBuffer = new ArrayBuffer(outputData.byteLength);
    new Uint8Array(outputBuffer).set(outputData);
    const blob = new Blob([outputBuffer], { type: plan.outputMimeType });
    if (blob.size <= 0) {
      throw new Error("Frame-sequence video encoder produced no video data.");
    }
    const url = URL.createObjectURL(blob);
    onProgress?.({
      phase: "complete",
      framesWritten: plan.totalFrames,
      totalFrames: plan.totalFrames,
      percent: 1,
      message: "Video encoding complete.",
    });

    return {
      plan,
      blob,
      url,
      mimeType: plan.outputMimeType,
      filename: plan.outputFilename,
      cleanup() {
        URL.revokeObjectURL(url);
      },
    };
  } finally {
    if (plan) {
      await deleteVirtualFiles(runtime, [
        ...plan.inputFiles.map((file) => file.path),
        plan.outputPath,
      ]);
    }
    if (cleanupInputFrames) {
      sequence.cleanup();
    }
  }
}
