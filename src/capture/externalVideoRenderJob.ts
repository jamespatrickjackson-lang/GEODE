import {
  normalizeCaptureRecipe,
  validateCaptureRecipe,
  type CaptureRecipeV1,
} from "./captureRecipe";
import { resolveCaptureEffectiveSupersample } from "./captureResolution";
import type { CaptureDeterministicExportFormat } from "./captureTypes";

export const CAPTURE_VIDEO_RENDER_JOB_SCHEMA = "CaptureVideoRenderJobV1";

export interface CaptureVideoRenderJobV1 {
  schema: "CaptureVideoRenderJobV1";
  version: 1;
  jobId: string;
  projectSlug: string;
  pageId: string | null;
  app: {
    url: string;
    projectSlug: string;
  };
  recipe: CaptureRecipeV1;
  video: {
    width: number;
    height: number;
    format: CaptureDeterministicExportFormat;
    fps: number;
    durationSeconds: number;
    totalFrames: number;
    filename: string;
    sourceFrameStart?: number;
    sourceFrameEnd?: number;
    encodingProfile?: "scroll-friendly-video";
  };
  // Headless render supersample (the tiled renderer's own `--superscale`). The
  // embedded recipe always carries `supersampleScale: 1`; this is the effective
  // output-budget-validated scale the local renderer should use. Optional v1
  // extension: absent => 1 (older jobs render exact size).
  superscale?: number;
  fidelity: "max-detail-render";
  createdAt: string;
}

export interface CreateExternalVideoRenderJobInput {
  recipe: CaptureRecipeV1;
  format: CaptureDeterministicExportFormat;
  appUrl?: string | null;
  createdAt?: string;
}

export interface ExternalVideoRenderJobValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ParseExternalVideoRenderJobResult {
  job: CaptureVideoRenderJobV1 | null;
  validation: ExternalVideoRenderJobValidationResult;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function timestampForFilename(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "unknown-time";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function stableIdPart(value: string): string {
  return sanitizeFilenamePart(value) || "capture";
}

function currentAppUrl(projectSlug: string): string {
  if (typeof window === "undefined") {
    return `http://127.0.0.1:5173/?project=${encodeURIComponent(projectSlug)}`;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("project", projectSlug);
  return url.toString();
}

function positiveInteger(value: unknown, label: string, errors: string[]): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    errors.push(`${label} must be a positive integer.`);
    return 0;
  }
  return Number(value);
}

function normalizeVideoFilename(
  recipe: CaptureRecipeV1,
  format: CaptureDeterministicExportFormat,
  createdAt: string,
): string {
  const project = stableIdPart(recipe.projectSlug || "geosee");
  const page = stableIdPart(recipe.pageId || "current-page");
  const resolution = stableIdPart(recipe.resolution.label || "render");
  const frames = Math.max(1, Math.ceil(recipe.durationSeconds * recipe.fps));
  return `${project}-${page}-${resolution}-${recipe.fps}fps-${frames}f-external-video-${timestampForFilename(
    createdAt,
  )}.${format}`;
}

export function shouldDefaultToExternalVideoRenderJob(
  recipe: Pick<CaptureRecipeV1, "resolution">,
): boolean {
  // Only 4K-class output routes to the external/local renderer; everything
  // below encodes in the browser. Page-range and timeline sequences stay on the
  // browser path until external sequence rendering is added, so resolution is
  // the sole routing input.
  return recipe.resolution.width >= 3840 || recipe.resolution.height >= 2160;
}

export function createExternalVideoRenderJob({
  recipe,
  format,
  appUrl,
  createdAt = new Date().toISOString(),
}: CreateExternalVideoRenderJobInput): CaptureVideoRenderJobV1 {
  const normalizedRecipe = normalizeCaptureRecipe(recipe);
  const projectSlug = normalizedRecipe.projectSlug || "geosee";
  // The headless renderer does its own supersampling via `--superscale`, so the
  // embedded recipe must carry `supersampleScale: 1` (the job validators require
  // it). The UI-requested scale becomes the output-budget-validated `superscale`.
  const { effective: superscale } = resolveCaptureEffectiveSupersample({
    requested: normalizedRecipe.supersampleScale,
    width: normalizedRecipe.resolution.width,
    height: normalizedRecipe.resolution.height,
  });
  const headlessRecipe: CaptureRecipeV1 = {
    ...normalizedRecipe,
    supersampleScale: 1,
  };
  return {
    schema: CAPTURE_VIDEO_RENDER_JOB_SCHEMA,
    version: 1,
    jobId: `${stableIdPart(projectSlug)}-${timestampForFilename(createdAt)}`,
    projectSlug,
    pageId: normalizedRecipe.pageId ?? null,
    app: {
      url: appUrl || currentAppUrl(projectSlug),
      projectSlug,
    },
    recipe: headlessRecipe,
    superscale,
    video: {
      width: normalizedRecipe.resolution.width,
      height: normalizedRecipe.resolution.height,
      format,
      fps: normalizedRecipe.fps,
      durationSeconds: normalizedRecipe.durationSeconds,
      totalFrames: Math.max(
        1,
        Math.ceil(normalizedRecipe.durationSeconds * normalizedRecipe.fps),
      ),
      filename: normalizeVideoFilename(normalizedRecipe, format, createdAt),
    },
    fidelity: "max-detail-render",
    createdAt,
  };
}

export function validateExternalVideoRenderJob(
  job: unknown,
): ExternalVideoRenderJobValidationResult {
  const errors: string[] = [];
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    return { valid: false, errors: ["job must be an object."] };
  }
  const candidate = job as Partial<CaptureVideoRenderJobV1>;
  if (candidate.schema !== CAPTURE_VIDEO_RENDER_JOB_SCHEMA) {
    errors.push(`schema must be ${CAPTURE_VIDEO_RENDER_JOB_SCHEMA}.`);
  }
  if (candidate.version !== 1) {
    errors.push("version must be 1.");
  }
  if (typeof candidate.jobId !== "string" || candidate.jobId.length === 0) {
    errors.push("jobId must be a non-empty string.");
  }
  if (typeof candidate.projectSlug !== "string" || candidate.projectSlug.length === 0) {
    errors.push("projectSlug must be a non-empty string.");
  }
  if (!candidate.app || typeof candidate.app.url !== "string") {
    errors.push("app.url must be a string.");
  }
  if (candidate.fidelity !== "max-detail-render") {
    errors.push("fidelity must be max-detail-render.");
  }
  if (!candidate.recipe) {
    errors.push("recipe is required.");
  } else {
    const recipeValidation = validateCaptureRecipe(candidate.recipe);
    if (!recipeValidation.valid) {
      errors.push(...recipeValidation.errors.map((error) => `recipe.${error}`));
    }
    if (candidate.recipe.mode === "full-ui") {
      errors.push("recipe.mode full-ui is not supported by external video jobs.");
    }
    if (candidate.recipe.mode === "off") {
      errors.push("recipe.mode off is not supported by external video jobs.");
    }
    if (candidate.recipe.supersampleScale !== 1) {
      errors.push("recipe.supersampleScale must be 1 for no-downsampling video jobs.");
    }
  }
  if (!candidate.video || typeof candidate.video !== "object") {
    errors.push("video is required.");
  } else {
    const width = positiveInteger(candidate.video.width, "video.width", errors);
    const height = positiveInteger(candidate.video.height, "video.height", errors);
    positiveInteger(candidate.video.fps, "video.fps", errors);
    positiveInteger(candidate.video.totalFrames, "video.totalFrames", errors);
    const sourceFrameStart = candidate.video.sourceFrameStart;
    const sourceFrameEnd = candidate.video.sourceFrameEnd;
    if (
      sourceFrameStart !== undefined &&
      (!Number.isInteger(sourceFrameStart) || sourceFrameStart < 0)
    ) {
      errors.push("video.sourceFrameStart must be a zero-based integer.");
    }
    if (
      sourceFrameEnd !== undefined &&
      (!Number.isInteger(sourceFrameEnd) || sourceFrameEnd < 0)
    ) {
      errors.push("video.sourceFrameEnd must be a zero-based integer.");
    }
    if (
      Number.isInteger(sourceFrameStart) &&
      Number.isInteger(sourceFrameEnd) &&
      (sourceFrameStart as number) > (sourceFrameEnd as number)
    ) {
      errors.push("video.sourceFrameStart must be before or equal to sourceFrameEnd.");
    }
    if (
      typeof candidate.video.durationSeconds !== "number" ||
      !Number.isFinite(candidate.video.durationSeconds) ||
      candidate.video.durationSeconds <= 0
    ) {
      errors.push("video.durationSeconds must be greater than zero.");
    }
    if (candidate.video.format !== "mp4" && candidate.video.format !== "webm") {
      errors.push("video.format must be mp4 or webm.");
    }
    if (typeof candidate.video.filename !== "string" || candidate.video.filename.length === 0) {
      errors.push("video.filename must be a non-empty string.");
    }
    if (
      candidate.recipe &&
      (width !== candidate.recipe.resolution.width ||
        height !== candidate.recipe.resolution.height)
    ) {
      errors.push("video dimensions must match recipe resolution.");
    }
    // Optional headless superscale (v1 extension; absent => 1). An explicit value
    // must be in [1,4] AND within the per-dimension render budget — reject an
    // over-budget value (e.g. 8K + superscale 2) rather than silently render 1x.
    if (candidate.superscale !== undefined) {
      if (
        !Number.isInteger(candidate.superscale) ||
        candidate.superscale < 1 ||
        candidate.superscale > 4
      ) {
        errors.push("superscale must be an integer between 1 and 4.");
      } else if (width > 0 && height > 0) {
        const { effective } = resolveCaptureEffectiveSupersample({
          requested: candidate.superscale,
          width,
          height,
        });
        if (candidate.superscale !== effective) {
          errors.push(
            `superscale ${candidate.superscale} exceeds the ${width}x${height} render budget (max ${effective}).`,
          );
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function serializeExternalVideoRenderJob(job: CaptureVideoRenderJobV1): string {
  return `${JSON.stringify(job, null, 2)}\n`;
}

export function parseExternalVideoRenderJobJson(
  json: string,
): ParseExternalVideoRenderJobResult {
  try {
    const parsed = JSON.parse(json);
    const validation = validateExternalVideoRenderJob(parsed);
    return {
      job: validation.valid ? (parsed as CaptureVideoRenderJobV1) : null,
      validation,
    };
  } catch (error) {
    return {
      job: null,
      validation: {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      },
    };
  }
}

export function externalVideoRenderJobFilename(job: CaptureVideoRenderJobV1): string {
  const project = sanitizeFilenamePart(job.projectSlug || "geosee");
  const page = sanitizeFilenamePart(job.pageId || "current-page");
  const resolution = sanitizeFilenamePart(job.recipe.resolution.label || "render");
  return `${project}-${page}-${resolution}-external-video-${timestampForFilename(
    job.createdAt,
  )}.json`;
}

export function externalVideoRenderCommand(
  jobFilename: string,
  job: CaptureVideoRenderJobV1,
): string {
  const output = job.video.filename || `geosee-external-video.${job.video.format}`;
  const superscale = job.superscale ?? 1;
  return `node tools\\render-capture-video-job.mjs --job ${jobFilename} --out ${output} --superscale ${superscale}`;
}
