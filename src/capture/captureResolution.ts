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

export interface CaptureRenderResolutionValidationResult {
  valid: boolean;
  errors: string[];
  renderWidth: number;
  renderHeight: number;
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
  if (renderWidth > 7680 || renderHeight > 4320) {
    errors.push(
      `${resolution.label} at ${supersampleScale}x supersampling exceeds the 7680x4320 render-output cap.`,
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
