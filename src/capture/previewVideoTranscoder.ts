import type { FfmpegFrameSequenceRuntime } from "./frameSequenceVideoEncoder";
import {
  captureVideoFilename,
  validateCaptureVideoBlob,
} from "./captureVideoSaveOptions";

export interface PreviewVideoTranscodePlanOptions {
  outputBasename?: string;
  virtualDirectory?: string;
  inputFilename?: string;
}

export interface PreviewVideoTranscodePlan {
  inputPath: string;
  outputPath: string;
  outputFilename: string;
  args: string[];
}

export interface PreviewVideoTranscodeOptions
  extends PreviewVideoTranscodePlanOptions {
  inputBlob: Blob;
  runtime: FfmpegFrameSequenceRuntime;
  signal?: AbortSignal;
}

export interface PreviewVideoTranscodeResult {
  plan: PreviewVideoTranscodePlan;
  blob: Blob;
  url: string;
  mimeType: "video/mp4";
  filename: string;
  cleanup(): void;
}

function normalizeVirtualDirectory(directory: string | undefined): string {
  const candidate = (directory ?? "/geosee-preview-transcode")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
  if (!candidate || candidate === ".") return "/geosee-preview-transcode";
  return candidate.startsWith("/") ? candidate : `/${candidate}`;
}

function sanitizeBasename(value: string | undefined, fallback: string): string {
  const sanitized = (value ?? fallback)
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  throw new DOMException("Preview video MP4 conversion was aborted.", "AbortError");
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

export function createPreviewVideoTranscodePlan({
  outputBasename,
  virtualDirectory,
  inputFilename,
}: PreviewVideoTranscodePlanOptions = {}): PreviewVideoTranscodePlan {
  const directory = normalizeVirtualDirectory(virtualDirectory);
  const inputBase = sanitizeBasename(inputFilename, "input");
  const outputBase = sanitizeBasename(outputBasename, "geosee-path-preview");
  const inputPath = `${directory}/${captureVideoFilename(inputBase, "webm")}`;
  const outputFilename = captureVideoFilename(outputBase, "mp4");
  const outputPath = `${directory}/${outputFilename}`;
  return {
    inputPath,
    outputPath,
    outputFilename,
    args: [
      "-hide_banner",
      "-y",
      "-i",
      inputPath,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ],
  };
}

export async function transcodePreviewVideoToMp4({
  inputBlob,
  runtime,
  signal,
  ...planOptions
}: PreviewVideoTranscodeOptions): Promise<PreviewVideoTranscodeResult> {
  validateCaptureVideoBlob(inputBlob, "Preview WebM");
  const plan = createPreviewVideoTranscodePlan(planOptions);
  try {
    throwIfAborted(signal);
    await runtime.writeFile(
      plan.inputPath,
      new Uint8Array(await inputBlob.arrayBuffer()),
    );
    throwIfAborted(signal);
    await runtime.exec(plan.args);
    throwIfAborted(signal);
    const outputData = await runtime.readFile(plan.outputPath);
    const outputBuffer = new ArrayBuffer(outputData.byteLength);
    new Uint8Array(outputBuffer).set(outputData);
    const blob = new Blob([outputBuffer], { type: "video/mp4" });
    validateCaptureVideoBlob(blob, "Preview MP4 conversion");
    const url = URL.createObjectURL(blob);
    return {
      plan,
      blob,
      url,
      mimeType: "video/mp4",
      filename: plan.outputFilename,
      cleanup() {
        URL.revokeObjectURL(url);
      },
    };
  } finally {
    await deleteVirtualFiles(runtime, [plan.inputPath, plan.outputPath]);
  }
}
