import {
  normalizeCaptureRecipe,
  validateCaptureRecipe,
  type CaptureRecipeV1,
} from "./captureRecipe";
import {
  captureStillExtension,
  captureStillFilename,
  normalizeCaptureStillQuality,
  type CaptureStillImageType,
  type CaptureStillSaveOptions,
} from "./screenCaptureSaveOptions";

export const CAPTURE_STILL_RENDER_JOB_SCHEMA = "CaptureStillRenderJobV1";
export const CAPTURE_STILL_TILE_RESULT_SCHEMA = "CaptureStillTileRenderResultV1";

// Per-tile render overlap (px each side) so sampling-based lens FX tile seamlessly.
export const DEFAULT_STILL_TILE_OVERLAP_PIXELS = 64;

export interface CaptureStillTileSpec {
  id: string;
  row: number;
  column: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureStillRenderJobV1 {
  schema: "CaptureStillRenderJobV1";
  version: 1;
  jobId: string;
  projectSlug: string;
  pageId: string | null;
  app: {
    url: string;
    projectSlug: string;
  };
  recipe: CaptureRecipeV1;
  still: {
    width: number;
    height: number;
    type: CaptureStillImageType;
    quality?: number;
    filename: string;
  };
  tile: {
    width: number;
    height: number;
    // Each tile renders this many extra pixels on every side (clamped to the full
    // bounds) and crops them off, so sampling-based screen-space FX (distortion /
    // chromatic aberration) have neighbour pixels and tile seamlessly. 0 = legacy
    // exact tiles.
    overlapPixels: number;
  };
  fidelity: "max-detail-render";
  failureReason: string;
  createdAt: string;
}

export type ExternalStillRenderJobV1 = CaptureStillRenderJobV1;

export interface CaptureStillTileRenderResult {
  schema: "CaptureStillTileRenderResultV1";
  tileId: string;
  width: number;
  height: number;
  x: number;
  y: number;
  imageType: "png";
  imageBase64: string;
  byteLength: number;
  diagnostics: {
    projectionOffset: {
      fullWidth: number;
      fullHeight: number;
      x: number;
      y: number;
      width: number;
      height: number;
    };
    frameIndex: number;
    timeSeconds: number;
    maxDetail: boolean;
    overlayComposited: boolean;
  };
}

export interface CaptureStillHeadlessCapabilities {
  maxTextureSize: number;
  maxRenderbufferSize: number;
  supportsViewOffsetTiles: boolean;
}

export interface CreateExternalStillRenderJobInput {
  recipe: CaptureRecipeV1;
  stillOptions: CaptureStillSaveOptions;
  failureReason: string;
  appUrl?: string | null;
  tileWidth?: number;
  tileHeight?: number;
  createdAt?: string;
}

export interface ExternalStillRenderJobValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ParseExternalStillRenderJobResult {
  job: CaptureStillRenderJobV1 | null;
  validation: ExternalStillRenderJobValidationResult;
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

function normalizeTileDimension(value: number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return Math.min(4096, value);
  }
  return fallback;
}

function normalizeStillFilename(
  recipe: CaptureRecipeV1,
  type: CaptureStillImageType,
  createdAt: string,
): string {
  const project = stableIdPart(recipe.projectSlug || "geosee");
  const page = stableIdPart(recipe.pageId || "current-page");
  const resolution = stableIdPart(recipe.resolution.label || "render");
  return captureStillFilename(
    `${project}-${page}-${resolution}-external-still-${timestampForFilename(createdAt)}`,
    type,
  );
}

export function createExternalStillRenderJob({
  recipe,
  stillOptions,
  failureReason,
  appUrl,
  tileWidth,
  tileHeight,
  createdAt = new Date().toISOString(),
}: CreateExternalStillRenderJobInput): CaptureStillRenderJobV1 {
  const normalizedRecipe = normalizeCaptureRecipe(recipe);
  const type = stillOptions.type ?? "png";
  const quality = normalizeCaptureStillQuality(type, stillOptions.quality);
  const filename = normalizeStillFilename(normalizedRecipe, type, createdAt);
  const projectSlug = normalizedRecipe.projectSlug || "geosee";
  // The external tiled still renderer renders exact size (no still superscale in
  // scope), and the job validator requires `supersampleScale === 1`. Normalize
  // here so a fallback published from a recipe whose effective in-browser
  // supersample is 2 (e.g. 4K that exceeded a single GPU surface) is still valid.
  const headlessRecipe: CaptureRecipeV1 = {
    ...normalizedRecipe,
    supersampleScale: 1,
  };
  return {
    schema: CAPTURE_STILL_RENDER_JOB_SCHEMA,
    version: 1,
    jobId: `${stableIdPart(projectSlug)}-${timestampForFilename(createdAt)}`,
    projectSlug,
    pageId: normalizedRecipe.pageId ?? null,
    app: {
      url: appUrl || currentAppUrl(projectSlug),
      projectSlug,
    },
    recipe: headlessRecipe,
    still: {
      width: normalizedRecipe.resolution.width,
      height: normalizedRecipe.resolution.height,
      type,
      ...(quality === undefined ? {} : { quality }),
      filename,
    },
    tile: {
      width: normalizeTileDimension(tileWidth, 1920),
      height: normalizeTileDimension(tileHeight, 1080),
      overlapPixels: DEFAULT_STILL_TILE_OVERLAP_PIXELS,
    },
    fidelity: "max-detail-render",
    failureReason,
    createdAt,
  };
}

export function validateExternalStillRenderJob(
  job: unknown,
): ExternalStillRenderJobValidationResult {
  const errors: string[] = [];
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    return { valid: false, errors: ["job must be an object."] };
  }
  const candidate = job as Partial<CaptureStillRenderJobV1>;
  if (candidate.schema !== CAPTURE_STILL_RENDER_JOB_SCHEMA) {
    errors.push(`schema must be ${CAPTURE_STILL_RENDER_JOB_SCHEMA}.`);
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
      errors.push("recipe.mode full-ui is not supported by external still jobs.");
    }
    if (candidate.recipe.mode === "off") {
      errors.push("recipe.mode off is not supported by external still jobs.");
    }
    if (candidate.recipe.supersampleScale !== 1) {
      errors.push("recipe.supersampleScale must be 1 for no-downsampling still jobs.");
    }
  }
  if (!candidate.still || typeof candidate.still !== "object") {
    errors.push("still is required.");
  } else {
    positiveInteger(candidate.still.width, "still.width", errors);
    positiveInteger(candidate.still.height, "still.height", errors);
    if (
      candidate.still.type !== "png" &&
      candidate.still.type !== "webp" &&
      candidate.still.type !== "jpeg"
    ) {
      errors.push("still.type must be png, webp, or jpeg.");
    }
    if (
      candidate.still.type !== "png" &&
      (typeof candidate.still.quality !== "number" ||
        !Number.isFinite(candidate.still.quality) ||
        candidate.still.quality < 0.01 ||
        candidate.still.quality > 1)
    ) {
      errors.push("still.quality must be between 0.01 and 1.");
    }
    if (typeof candidate.still.filename !== "string" || candidate.still.filename.length === 0) {
      errors.push("still.filename must be a non-empty string.");
    }
  }
  if (!candidate.tile || typeof candidate.tile !== "object") {
    errors.push("tile is required.");
  } else {
    positiveInteger(candidate.tile.width, "tile.width", errors);
    positiveInteger(candidate.tile.height, "tile.height", errors);
    if (
      !Number.isInteger(candidate.tile.overlapPixels) ||
      candidate.tile.overlapPixels < 0
    ) {
      errors.push("tile.overlapPixels must be a non-negative integer.");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function serializeExternalStillRenderJob(
  job: CaptureStillRenderJobV1,
): string {
  return `${JSON.stringify(job, null, 2)}\n`;
}

export function parseExternalStillRenderJobJson(
  json: string,
): ParseExternalStillRenderJobResult {
  try {
    const parsed = JSON.parse(json);
    const validation = validateExternalStillRenderJob(parsed);
    return {
      job: validation.valid ? (parsed as CaptureStillRenderJobV1) : null,
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

export function externalStillRenderJobFilename(
  job: CaptureStillRenderJobV1,
): string {
  const project = sanitizeFilenamePart(job.projectSlug || "geosee");
  const page = sanitizeFilenamePart(job.pageId || "current-page");
  const resolution = sanitizeFilenamePart(job.recipe.resolution.label || "render");
  return `${project}-${page}-${resolution}-external-still-${timestampForFilename(
    job.createdAt,
  )}.json`;
}

export function externalStillRenderCommand(jobFilename: string, job: CaptureStillRenderJobV1): string {
  const extension = captureStillExtension(job.still.type);
  const output = job.still.filename || `geosee-external-still.${extension}`;
  return `node tools\\render-capture-still-job.mjs --job ${jobFilename} --out ${output}`;
}
