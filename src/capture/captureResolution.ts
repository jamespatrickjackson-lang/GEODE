import type {
  CaptureFps,
  CapturePreviewResolutionPresetId,
  CaptureResolution,
  CaptureResolutionPresetId,
  CaptureRenderResolutionPresetId,
} from "./captureTypes";

export const CAPTURE_REALTIME_FPS_OPTIONS: readonly CaptureFps[] = [
  30,
  60,
] as const;

export const CAPTURE_RENDER_FPS_OPTIONS: readonly CaptureFps[] = [
  24,
  30,
  60,
] as const;

export const CAPTURE_FPS_OPTIONS = CAPTURE_RENDER_FPS_OPTIONS;

export const CAPTURE_RESOLUTION_PRESETS: Record<
  CaptureRenderResolutionPresetId,
  CaptureResolution
> = {
  "preview-1080": {
    id: "preview-1080",
    label: "1080p",
    width: 1920,
    height: 1080,
    defaultFps: 30,
    qualityPreset: "preview",
  },
  "sharp-1440": {
    id: "sharp-1440",
    label: "1440p",
    width: 2560,
    height: 1440,
    defaultFps: 60,
    qualityPreset: "sharp-1440",
  },
  "marketing-4k": {
    id: "marketing-4k",
    label: "4K",
    width: 3840,
    height: 2160,
    defaultFps: 60,
    qualityPreset: "marketing",
  },
  "render-8k": {
    id: "render-8k",
    label: "8K",
    width: 7680,
    height: 4320,
    defaultFps: 30,
    qualityPreset: "render-8k",
  },
};

export const CAPTURE_PREVIEW_RESOLUTION_PRESET_ORDER: readonly CapturePreviewResolutionPresetId[] = [
  "preview-1080",
  "sharp-1440",
  "marketing-4k",
];

export const CAPTURE_RENDER_RESOLUTION_PRESET_ORDER: readonly CaptureRenderResolutionPresetId[] = [
  "preview-1080",
  "sharp-1440",
  "marketing-4k",
  "render-8k",
];

export const CAPTURE_RESOLUTION_PRESET_ORDER = CAPTURE_PREVIEW_RESOLUTION_PRESET_ORDER;

export function captureResolutionPresetById(
  id: CaptureResolutionPresetId,
): CaptureResolution {
  return CAPTURE_RESOLUTION_PRESETS[id];
}

export function capturePreviewResolutionPresetById(
  id: CapturePreviewResolutionPresetId,
): CaptureResolution {
  return CAPTURE_RESOLUTION_PRESETS[id];
}

export function captureRenderResolutionPresetById(
  id: CaptureRenderResolutionPresetId,
): CaptureResolution {
  return CAPTURE_RESOLUTION_PRESETS[id];
}

export function captureResolutionPresetIdForResolution(
  resolution: Pick<CaptureResolution, "width" | "height">,
): CaptureRenderResolutionPresetId | null {
  for (const id of CAPTURE_RENDER_RESOLUTION_PRESET_ORDER) {
    const preset = CAPTURE_RESOLUTION_PRESETS[id];
    if (preset.width === resolution.width && preset.height === resolution.height) {
      return id;
    }
  }
  return null;
}

export function validateCaptureResolution(
  resolution: Pick<CaptureResolution, "width" | "height">,
): boolean {
  return (
    Number.isFinite(resolution.width) &&
    Number.isFinite(resolution.height) &&
    Number.isInteger(resolution.width) &&
    Number.isInteger(resolution.height) &&
    resolution.width >= 320 &&
    resolution.height >= 180 &&
    resolution.width <= 7680 &&
    resolution.height <= 4320
  );
}

export function validateCaptureFps(fps: number): fps is CaptureFps {
  return CAPTURE_FPS_OPTIONS.includes(fps as CaptureFps);
}

export interface CaptureRenderResolutionValidationInput {
  resolution: Pick<CaptureResolution, "width" | "height" | "label">;
  supersampleScale: number;
  maxTextureSize?: number | null;
  maxRenderbufferSize?: number | null;
}

export interface CaptureCapabilityLimits {
  maxTextureSize?: number | null;
  maxRenderbufferSize?: number | null;
}

// Combine capability sources into the STRICTER limit per dimension so a
// caller-supplied (preflight) budget can never be relaxed by a more permissive
// raw GL report inside an exporter. A non-finite value means "no limit from this
// source" and yields to the other. This keeps the exporter's in-browser render
// gate identical to the provider preflight, so a device that cannot render the
// requested size never starts a doomed render that churns the main thread.
export function resolveEffectiveCaptureCapabilities(
  ...sources: Array<CaptureCapabilityLimits | null | undefined>
): { maxTextureSize: number | null; maxRenderbufferSize: number | null } {
  const stricter = (a: number | null, b: number | null | undefined): number | null => {
    const av = typeof a === "number" && Number.isFinite(a) ? a : null;
    const bv = typeof b === "number" && Number.isFinite(b) ? b : null;
    if (av === null) return bv;
    if (bv === null) return av;
    return Math.min(av, bv);
  };
  let maxTextureSize: number | null = null;
  let maxRenderbufferSize: number | null = null;
  for (const source of sources) {
    if (!source) continue;
    maxTextureSize = stricter(maxTextureSize, source.maxTextureSize);
    maxRenderbufferSize = stricter(maxRenderbufferSize, source.maxRenderbufferSize);
  }
  return { maxTextureSize, maxRenderbufferSize };
}

export interface CaptureRenderResolutionValidationResult {
  valid: boolean;
  errors: string[];
  renderWidth: number;
  renderHeight: number;
}

// Memory-safe internal render budget. 7680x4320 is the proven single-surface
// capture render size; supersampling renders up to this and downscales.
export const CAPTURE_MAX_RENDER_WIDTH = 7680;
export const CAPTURE_MAX_RENDER_HEIGHT = 4320;

/**
 * Clamp the requested supersample factor so the internal render
 * (outputWidth*scale x outputHeight*scale) never exceeds the safe render budget.
 * 4K -> 2x (renders 7680x4320), 8K -> 1x (already at budget), 1080p -> up to 4x.
 * Returns an integer >= 1. Rendering beyond this budget produces a black frame
 * (GPU memory), so the clamp is silent and safe rather than an error.
 *
 * The budget is per-dimension (width<=7680 AND height<=4320), NOT long/short
 * edge: a long/short clamp passes an over-budget portrait/ultrawide (e.g.
 * 2160x3840 at 2x => 4320x7680, height 7680 > 4320).
 */
export function clampCaptureSupersampleScale(
  requested: number,
  outputWidth: number,
  outputHeight: number,
): number {
  const safeRequested =
    Number.isFinite(requested) && requested >= 1
      ? Math.min(4, Math.floor(requested))
      : 1;
  if (
    !Number.isFinite(outputWidth) ||
    !Number.isFinite(outputHeight) ||
    outputWidth <= 0 ||
    outputHeight <= 0
  ) {
    return 1;
  }
  const maxScale = Math.max(
    1,
    Math.min(
      Math.floor(CAPTURE_MAX_RENDER_WIDTH / outputWidth),
      Math.floor(CAPTURE_MAX_RENDER_HEIGHT / outputHeight),
    ),
  );
  return Math.max(1, Math.min(safeRequested, maxScale));
}

export interface CaptureEffectiveSupersampleInput {
  requested: number;
  width: number;
  height: number;
}

export interface CaptureEffectiveSupersample {
  requested: number;
  effective: number;
  renderWidth: number;
  renderHeight: number;
}

/**
 * Single budget-math entry point used by the provider recipe builders, the
 * external job builder, job validation, and tests. `effective` is the requested
 * scale clamped to the per-dimension render budget, and `renderWidth/renderHeight`
 * are guaranteed `<= CAPTURE_MAX_RENDER_WIDTH/HEIGHT`.
 */
export function resolveCaptureEffectiveSupersample({
  requested,
  width,
  height,
}: CaptureEffectiveSupersampleInput): CaptureEffectiveSupersample {
  const safeRequested =
    Number.isFinite(requested) && requested >= 1
      ? Math.min(4, Math.floor(requested))
      : 1;
  const effective = clampCaptureSupersampleScale(safeRequested, width, height);
  return {
    requested: safeRequested,
    effective,
    renderWidth: Math.round(width * effective),
    renderHeight: Math.round(height * effective),
  };
}

export function validateRenderResolutionRequest({
  resolution,
  supersampleScale,
  maxTextureSize,
  maxRenderbufferSize,
}: CaptureRenderResolutionValidationInput): CaptureRenderResolutionValidationResult {
  const errors: string[] = [];
  const safeScale = Number.isFinite(supersampleScale) ? supersampleScale : 0;
  const renderWidth = Math.round(resolution.width * safeScale);
  const renderHeight = Math.round(resolution.height * safeScale);

  if (!validateCaptureResolution(resolution)) {
    errors.push("render resolution must be a valid bounded capture size.");
  }
  if (!Number.isFinite(supersampleScale) || supersampleScale < 1 || supersampleScale > 4) {
    errors.push("supersampleScale must be between 1 and 4.");
  }
  // The OUTPUT image is capped to <=7680x4320 by validateCaptureResolution above.
  // The internal RENDER size (output x supersampleScale) is capped to the same
  // 7680x4320 budget: this is the proven-safe single-surface render size
  // (HalfFloat composer + post passes). Rendering larger (e.g. 8K x 2 = 15360,
  // or 8K + MSAA) exceeds GPU memory and produces a black frame. Callers clamp
  // the effective supersample with clampCaptureSupersampleScale so this is a
  // backstop, not the normal path.
  if (renderWidth > CAPTURE_MAX_RENDER_WIDTH || renderHeight > CAPTURE_MAX_RENDER_HEIGHT) {
    errors.push(
      `${resolution.label} at ${supersampleScale}x supersampling exceeds the ${CAPTURE_MAX_RENDER_WIDTH}x${CAPTURE_MAX_RENDER_HEIGHT} capture render budget.`,
    );
  }

  const textureLimit =
    typeof maxTextureSize === "number" && Number.isFinite(maxTextureSize)
      ? maxTextureSize
      : null;
  const renderbufferLimit =
    typeof maxRenderbufferSize === "number" && Number.isFinite(maxRenderbufferSize)
      ? maxRenderbufferSize
      : textureLimit;
  const maxDimensionLimit =
    textureLimit && renderbufferLimit
      ? Math.min(textureLimit, renderbufferLimit)
      : textureLimit ?? renderbufferLimit;
  if (
    maxDimensionLimit &&
    (renderWidth > maxDimensionLimit || renderHeight > maxDimensionLimit)
  ) {
    errors.push(
      `${resolution.label} at ${supersampleScale}x supersampling exceeds this browser/GPU limit of ${maxDimensionLimit}px.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    renderWidth,
    renderHeight,
  };
}
