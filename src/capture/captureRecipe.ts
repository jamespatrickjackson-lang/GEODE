import type { Pose } from "../pages/types";
import type {
  CaptureFps,
  CaptureGradeMode,
  CaptureMode,
  CaptureQualityPreset,
  CaptureRenderFidelityMode,
  CaptureResolution,
} from "./captureTypes";
import { validateCaptureFps, validateCaptureResolution } from "./captureResolution";
import type { CapturePageRangeTiming, CaptureScope } from "./capturePageRange";
import {
  cameraPathToRecipeKeyframes,
  normalizeCaptureCameraPath,
  recipeKeyframesToCameraPath,
  validateCaptureCameraPath,
  type CaptureCameraPathV1,
} from "./captureCameraPath";
import {
  captureCameraPathV2Renderable,
  captureCameraPathV2ToLegacyKeyframes,
  normalizeCaptureCameraPathV2,
  resolveCaptureCameraPathV2Timeline,
  upgradeCaptureCameraPathV1ToV2,
  validateCaptureCameraPathV2,
  type CaptureCameraPathV2,
} from "./captureCameraPathV2";
import {
  captureCameraPathV3Renderable,
  cameraPathV3ToRecipeKeyframes,
  normalizeCaptureCameraPathV3,
  resolveCaptureCameraPathV3Timeline,
  validateCaptureCameraPathV3,
  type CaptureCameraPathV3,
} from "./captureCameraPathV3";
import {
  normalizeCaptureTimelineState,
  type CaptureTimelineState,
} from "./captureTimeline";

const CAPTURE_RECIPE_MODES = new Set<CaptureMode>([
  "off",
  "scene-only",
  "scene-annotations",
  "presentation-ui",
  "full-ui",
]);

const CAPTURE_RECIPE_QUALITY_PRESETS = new Set<CaptureQualityPreset>([
  "preview",
  "sharp-1440",
  "marketing",
  "render-8k",
]);

export interface CaptureCameraKeyframe {
  frameIndex?: number;
  timeSeconds: number;
  camera: Pose;
  easing?: "linear" | "ease-in-out";
}

export type CaptureCameraPathRecipe =
  | CaptureCameraPathV1
  | CaptureCameraPathV2
  | CaptureCameraPathV3;

export interface CaptureCameraTimelineMetadata {
  version: 1 | 2 | 3;
  fps: CaptureFps;
  durationFrames: number;
  durationSeconds: number;
  keyframeCount: number;
}

export interface CaptureRecipeV1 {
  version: 1;
  projectSlug: string;
  pageId: string | null;
  mode: CaptureMode;
  resolution: Pick<CaptureResolution, "width" | "height" | "label">;
  previewResolution?: Pick<CaptureResolution, "width" | "height" | "label"> | null;
  fps: CaptureFps;
  durationSeconds: number;
  camera: Pose | null;
  cameraKeyframes: CaptureCameraKeyframe[];
  cameraPath?: CaptureCameraPathRecipe | null;
  cameraTimeline?: CaptureCameraTimelineMetadata | null;
  layerVisibility: Record<string, boolean>;
  layerStyles: Record<string, unknown>;
  environmentState: unknown;
  visualPreset: string | null;
  supersampleScale: number;
  captureGradeMode: CaptureGradeMode;
  qualityPreset: CaptureQualityPreset;
  renderFidelity: CaptureRenderFidelityMode;
  createdAt: string;
  captureScope?: CaptureScope;
  pageRangeStartId?: string | null;
  pageRangeEndId?: string | null;
  pageRangeTiming?: CapturePageRangeTiming;
  equalHoldSeconds?: number | null;
  captureTimeline?: CaptureTimelineState | null;
}

export interface CaptureRecipeCreateInput {
  projectSlug: string;
  pageId?: string | null;
  mode: CaptureMode;
  resolution: Pick<CaptureResolution, "width" | "height" | "label" | "qualityPreset">;
  previewResolution?: Pick<CaptureResolution, "width" | "height" | "label"> | null;
  fps: CaptureFps;
  durationSeconds: number;
  camera?: Pose | null;
  cameraKeyframes?: CaptureCameraKeyframe[];
  cameraPath?: CaptureCameraPathRecipe | null;
  layerVisibility?: Record<string, boolean>;
  layerStyles?: Record<string, unknown>;
  environmentState?: unknown;
  visualPreset?: string | null;
  supersampleScale?: number;
  captureGradeMode?: CaptureGradeMode;
  qualityPreset?: CaptureQualityPreset;
  renderFidelity?: CaptureRenderFidelityMode;
  createdAt?: string;
  captureScope?: CaptureScope;
  pageRangeStartId?: string | null;
  pageRangeEndId?: string | null;
  pageRangeTiming?: CapturePageRangeTiming;
  equalHoldSeconds?: number | null;
  captureTimeline?: CaptureTimelineState | null;
}

export interface CaptureRecipeValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CaptureRecipeParseResult {
  recipe: CaptureRecipeV1 | null;
  validation: CaptureRecipeValidationResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVec3(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => isFiniteNumber(entry))
  );
}

function isPose(value: unknown): value is Pose {
  return (
    isRecord(value) &&
    isVec3(value.position) &&
    isVec3(value.target) &&
    isVec3(value.up) &&
    isFiniteNumber(value.fov) &&
    value.fov > 0
  );
}

function clonePose(pose: Pose): Pose {
  return {
    position: [...pose.position],
    target: [...pose.target],
    up: [...pose.up],
    fov: pose.fov,
  };
}

function cloneKeyframe(keyframe: CaptureCameraKeyframe): CaptureCameraKeyframe {
  return {
    timeSeconds: keyframe.timeSeconds,
    camera: clonePose(keyframe.camera),
    ...(typeof keyframe.frameIndex === "number"
      ? { frameIndex: keyframe.frameIndex }
      : {}),
    ...(keyframe.easing ? { easing: keyframe.easing } : {}),
  };
}

function isCaptureCameraPathV2(value: unknown): value is CaptureCameraPathV2 {
  return isRecord(value) && value.version === 2;
}

export function isCaptureCameraPathV3(value: unknown): value is CaptureCameraPathV3 {
  return isRecord(value) && value.version === 3;
}

export function normalizeCaptureCameraPathForRecipe(
  path: CaptureCameraPathRecipe,
): CaptureCameraPathRecipe {
  if (isCaptureCameraPathV3(path)) {
    return normalizeCaptureCameraPathV3(path);
  }
  if (isCaptureCameraPathV2(path)) {
    return normalizeCaptureCameraPathV2(path);
  }
  return upgradeCaptureCameraPathV1ToV2(normalizeCaptureCameraPath(path));
}

export function captureCameraPathToRecipeKeyframes(
  path: CaptureCameraPathRecipe,
  fps: CaptureFps,
): CaptureCameraKeyframe[] {
  if (isCaptureCameraPathV3(path)) {
    return cameraPathV3ToRecipeKeyframes(path, fps).map((keyframe) => ({
      ...keyframe,
      camera: clonePose(keyframe.camera),
    }));
  }
  if (isCaptureCameraPathV2(path)) {
    return captureCameraPathV2ToLegacyKeyframes(path).map((keyframe) => ({
      ...keyframe,
      frameIndex: Math.round(keyframe.timeSeconds * fps),
      camera: clonePose(keyframe.camera),
    }));
  }
  return cameraPathToRecipeKeyframes(path).map((keyframe) => ({
    ...keyframe,
    frameIndex: Math.round(keyframe.timeSeconds * fps),
  }));
}

function cameraTimelineMetadata(
  path: CaptureCameraPathRecipe | null,
  options: { durationSeconds: number; fps: CaptureFps },
): CaptureCameraTimelineMetadata | null {
  if (!path) return null;
  const timeline = isCaptureCameraPathV3(path)
    ? resolveCaptureCameraPathV3Timeline(path)
    : isCaptureCameraPathV2(path)
      ? resolveCaptureCameraPathV2Timeline(path)
      : null;
  const durationSeconds = timeline?.durationSeconds || options.durationSeconds;
  return {
    version: path.version,
    fps: options.fps,
    durationFrames: Math.round(durationSeconds * options.fps),
    durationSeconds,
    keyframeCount:
      isCaptureCameraPathV3(path) || isCaptureCameraPathV2(path)
        ? path.nodes.filter((node) => node.kind === "keyframe").length
        : path.keyframes.length,
  };
}

export function normalizeCaptureCameraKeyframes(
  keyframes: readonly CaptureCameraKeyframe[] = [],
): CaptureCameraKeyframe[] {
  return [...keyframes]
    .map(cloneKeyframe)
    .sort((a, b) => a.timeSeconds - b.timeSeconds);
}

export function createCaptureRecipeFromCurrentState(
  input: CaptureRecipeCreateInput,
): CaptureRecipeV1 {
  const rawCameraPath = input.cameraPath
    ? normalizeCaptureCameraPathForRecipe(input.cameraPath)
    : null;
  const normalizedCameraPath =
    rawCameraPath && isCaptureCameraPathV3(rawCameraPath)
      ? captureCameraPathV3Renderable(rawCameraPath)
        ? rawCameraPath
        : null
      : rawCameraPath && isCaptureCameraPathV2(rawCameraPath)
        ? captureCameraPathV2Renderable(rawCameraPath)
        ? rawCameraPath
        : null
        : rawCameraPath;
  const normalizedCameraKeyframes = normalizedCameraPath
    ? captureCameraPathToRecipeKeyframes(normalizedCameraPath, input.fps)
    : normalizeCaptureCameraKeyframes(input.cameraKeyframes ?? []);
  const normalizedCameraTimeline = cameraTimelineMetadata(normalizedCameraPath, {
    durationSeconds: input.durationSeconds,
    fps: input.fps,
  });
  const durationSeconds =
    normalizedCameraTimeline?.durationSeconds ?? input.durationSeconds;
  return {
    version: 1,
    projectSlug: input.projectSlug,
    pageId: input.pageId ?? null,
    mode: input.mode,
    resolution: {
      width: input.resolution.width,
      height: input.resolution.height,
      label: input.resolution.label,
    },
    previewResolution: input.previewResolution
      ? {
          width: input.previewResolution.width,
          height: input.previewResolution.height,
          label: input.previewResolution.label,
        }
      : null,
    fps: input.fps,
    durationSeconds,
    camera: input.camera ?? null,
    cameraKeyframes: normalizedCameraKeyframes,
    cameraPath:
      normalizedCameraPath ??
      (normalizedCameraKeyframes.length > 0
        ? recipeKeyframesToCameraPath(
            {
              cameraKeyframes: normalizedCameraKeyframes,
              durationSeconds,
            },
            { id: "capture-camera-path", name: "Camera Path" },
          )
        : null),
    cameraTimeline: normalizedCameraTimeline,
    layerVisibility: input.layerVisibility ?? {},
    layerStyles: input.layerStyles ?? {},
    environmentState: input.environmentState ?? null,
    visualPreset: input.visualPreset ?? null,
    supersampleScale: input.supersampleScale ?? 1,
    captureGradeMode: input.captureGradeMode ?? "clean",
    qualityPreset: input.qualityPreset ?? input.resolution.qualityPreset,
    renderFidelity: input.renderFidelity ?? "max-detail-render",
    createdAt: input.createdAt ?? new Date().toISOString(),
    captureScope: input.captureScope ?? "current-page",
    pageRangeStartId:
      input.captureScope === "page-range" ? (input.pageRangeStartId ?? null) : null,
    pageRangeEndId:
      input.captureScope === "page-range" ? (input.pageRangeEndId ?? null) : null,
    pageRangeTiming: input.pageRangeTiming ?? "authored",
    equalHoldSeconds: input.equalHoldSeconds ?? null,
    captureTimeline: input.captureTimeline
      ? normalizeCaptureTimelineState(input.captureTimeline)
      : null,
  };
}

export function validateCaptureCameraKeyframes(
  keyframes: readonly CaptureCameraKeyframe[],
  options: { durationSeconds: number; fps: CaptureFps },
): CaptureRecipeValidationResult {
  const errors: string[] = [];
  const seenTimes = new Set<string>();
  keyframes.forEach((keyframe, index) => {
    if (!isRecord(keyframe)) {
      errors.push(`cameraKeyframes[${index}] must be an object.`);
      return;
    }
    if (!isFiniteNumber(keyframe.timeSeconds) || keyframe.timeSeconds < 0) {
      errors.push(`cameraKeyframes[${index}].timeSeconds must be non-negative.`);
    } else {
      if (keyframe.timeSeconds > options.durationSeconds) {
        errors.push(
          `cameraKeyframes[${index}].timeSeconds must not exceed durationSeconds.`,
        );
      }
      const timeKey = keyframe.timeSeconds.toFixed(6);
      if (seenTimes.has(timeKey)) {
        errors.push("camera keyframe times must be unique.");
      }
      seenTimes.add(timeKey);
    }
    if (!isPose(keyframe.camera)) {
      errors.push(`cameraKeyframes[${index}].camera must be a valid pose.`);
    }
    if (
      keyframe.easing !== undefined &&
      keyframe.easing !== "linear" &&
      keyframe.easing !== "ease-in-out"
    ) {
      errors.push(`cameraKeyframes[${index}].easing is not supported.`);
    }
    if (
      keyframe.frameIndex !== undefined &&
      (!Number.isInteger(keyframe.frameIndex) || keyframe.frameIndex < 0)
    ) {
      errors.push(`cameraKeyframes[${index}].frameIndex must be non-negative.`);
    } else if (
      typeof keyframe.frameIndex === "number" &&
      isFiniteNumber(keyframe.timeSeconds)
    ) {
      const expected = Math.round(keyframe.timeSeconds * options.fps);
      if (keyframe.frameIndex !== expected) {
        errors.push(
          `cameraKeyframes[${index}].frameIndex must match timeSeconds * fps.`,
        );
      }
    }
  });
  return { valid: errors.length === 0, errors };
}

export function validateCaptureRecipe(
  recipe: Partial<CaptureRecipeV1> | null | undefined,
): CaptureRecipeValidationResult {
  const errors: string[] = [];
  if (!recipe) {
    return { valid: false, errors: ["Recipe is missing."] };
  }
  if (recipe.version !== 1) errors.push("Recipe version must be 1.");
  if (!recipe.projectSlug) errors.push("projectSlug is required.");
  if (recipe.projectSlug !== undefined && typeof recipe.projectSlug !== "string") {
    errors.push("projectSlug must be a string.");
  }
  if (
    recipe.pageId !== null &&
    recipe.pageId !== undefined &&
    typeof recipe.pageId !== "string"
  ) {
    errors.push("pageId must be a string or null.");
  }
  if (!recipe.mode) {
    errors.push("mode is required.");
  } else if (!CAPTURE_RECIPE_MODES.has(recipe.mode)) {
    errors.push("mode is not supported.");
  }
  if (!recipe.resolution || !validateCaptureResolution(recipe.resolution)) {
    errors.push("resolution must be a valid bounded capture size.");
  } else if (
    typeof recipe.resolution.label !== "string" ||
    recipe.resolution.label.trim() === ""
  ) {
    errors.push("resolution.label is required.");
  }
  if (
    recipe.previewResolution !== undefined &&
    recipe.previewResolution !== null &&
    !validateCaptureResolution(recipe.previewResolution)
  ) {
    errors.push("previewResolution must be a valid bounded capture size.");
  } else if (
    recipe.previewResolution &&
    (typeof recipe.previewResolution.label !== "string" ||
      recipe.previewResolution.label.trim() === "")
  ) {
    errors.push("previewResolution.label is required.");
  }
  if (typeof recipe.fps !== "number" || !validateCaptureFps(recipe.fps)) {
    errors.push("fps must be 30 or 60.");
  }
  if (
    typeof recipe.durationSeconds !== "number" ||
    !Number.isFinite(recipe.durationSeconds) ||
    recipe.durationSeconds <= 0
  ) {
    errors.push("durationSeconds must be greater than zero.");
  } else if (recipe.durationSeconds > 600) {
    errors.push("durationSeconds must be 600 seconds or less.");
  }
  if (
    typeof recipe.supersampleScale !== "number" ||
    !Number.isFinite(recipe.supersampleScale) ||
    recipe.supersampleScale < 1 ||
    recipe.supersampleScale > 4
  ) {
    errors.push("supersampleScale must be between 1 and 4.");
  }
  // Newly added field (DEC-176): tolerate older saved recipes that predate it
  // (missing => treated as "clean" downstream). Reject only an explicit bad value.
  if (
    recipe.captureGradeMode !== undefined &&
    recipe.captureGradeMode !== "clean" &&
    recipe.captureGradeMode !== "baked"
  ) {
    errors.push('captureGradeMode must be "clean" or "baked".');
  }
  if (!recipe.createdAt || Number.isNaN(Date.parse(recipe.createdAt))) {
    errors.push("createdAt must be an ISO date.");
  }
  if (
    recipe.renderFidelity !== undefined &&
    recipe.renderFidelity !== "max-detail-render"
  ) {
    errors.push("renderFidelity must be max-detail-render.");
  }
  const captureScope = recipe.captureScope ?? "current-page";
  if (captureScope !== "current-page" && captureScope !== "page-range") {
    errors.push("captureScope must be current-page or page-range.");
  }
  const pageRangeTiming = recipe.pageRangeTiming ?? "authored";
  if (pageRangeTiming !== "authored" && pageRangeTiming !== "equal-holds") {
    errors.push("pageRangeTiming must be authored or equal-holds.");
  }
  if (captureScope === "page-range") {
    if (
      typeof recipe.pageRangeStartId !== "string" ||
      recipe.pageRangeStartId.trim() === ""
    ) {
      errors.push("pageRangeStartId is required for page-range capture.");
    }
    if (
      typeof recipe.pageRangeEndId !== "string" ||
      recipe.pageRangeEndId.trim() === ""
    ) {
      errors.push("pageRangeEndId is required for page-range capture.");
    }
  }
  if (
    recipe.equalHoldSeconds !== undefined &&
    recipe.equalHoldSeconds !== null &&
    (typeof recipe.equalHoldSeconds !== "number" ||
      !Number.isFinite(recipe.equalHoldSeconds) ||
      recipe.equalHoldSeconds <= 0)
  ) {
    errors.push("equalHoldSeconds must be greater than zero when provided.");
  }
  if (recipe.captureTimeline !== undefined && recipe.captureTimeline !== null) {
    const timeline = normalizeCaptureTimelineState(recipe.captureTimeline);
    if (timeline.version !== 1) {
      errors.push("captureTimeline.version must be 1.");
    }
    for (const [index, clip] of timeline.pageClips.entries()) {
      if (!clip.pageId) errors.push(`captureTimeline.pageClips[${index}].pageId is required.`);
      if (clip.transitionSeconds < 0) {
        errors.push(`captureTimeline.pageClips[${index}].transitionSeconds must be non-negative.`);
      }
      if (clip.holdSeconds < 0) {
        errors.push(`captureTimeline.pageClips[${index}].holdSeconds must be non-negative.`);
      }
    }
  }
  if (
    recipe.qualityPreset === undefined ||
    !CAPTURE_RECIPE_QUALITY_PRESETS.has(recipe.qualityPreset)
  ) {
    errors.push("qualityPreset is not supported.");
  }
  if (
    recipe.visualPreset !== null &&
    recipe.visualPreset !== undefined &&
    typeof recipe.visualPreset !== "string"
  ) {
    errors.push("visualPreset must be a string or null.");
  }
  if (recipe.camera !== null && recipe.camera !== undefined && !isPose(recipe.camera)) {
    errors.push("camera must be a valid pose or null.");
  }
  if (!Array.isArray(recipe.cameraKeyframes)) {
    errors.push("cameraKeyframes must be an array.");
  } else if (recipe.fps && validateCaptureFps(recipe.fps)) {
    errors.push(
      ...validateCaptureCameraKeyframes(recipe.cameraKeyframes, {
        durationSeconds:
          typeof recipe.durationSeconds === "number" &&
          Number.isFinite(recipe.durationSeconds)
            ? recipe.durationSeconds
            : 0,
        fps: recipe.fps,
      }).errors,
    );
  }
  if (recipe.cameraPath !== undefined && recipe.cameraPath !== null) {
    const pathValidation = isCaptureCameraPathV3(recipe.cameraPath)
      ? validateCaptureCameraPathV3(recipe.cameraPath)
      : isCaptureCameraPathV2(recipe.cameraPath)
        ? validateCaptureCameraPathV2(recipe.cameraPath)
        : validateCaptureCameraPath(
            recipe.cameraPath,
            typeof recipe.durationSeconds === "number" &&
              Number.isFinite(recipe.durationSeconds)
              ? recipe.durationSeconds
              : 0,
          );
    errors.push(...pathValidation.errors);
  }
  if (!isRecord(recipe.layerVisibility)) {
    errors.push("layerVisibility must be an object.");
  } else {
    for (const [layerId, visible] of Object.entries(recipe.layerVisibility)) {
      if (typeof visible !== "boolean") {
        errors.push(`layerVisibility.${layerId} must be boolean.`);
      }
    }
  }
  if (!isRecord(recipe.layerStyles)) {
    errors.push("layerStyles must be an object.");
  } else {
    for (const [layerId, style] of Object.entries(recipe.layerStyles)) {
      if (!isRecord(style)) {
        errors.push(`layerStyles.${layerId} must be an object.`);
      }
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function normalizeCaptureRecipe(recipe: CaptureRecipeV1): CaptureRecipeV1 {
  const rawCameraPath = recipe.cameraPath
    ? normalizeCaptureCameraPathForRecipe(recipe.cameraPath)
    : Array.isArray(recipe.cameraKeyframes) && recipe.cameraKeyframes.length > 0
      ? recipeKeyframesToCameraPath(
          {
            cameraKeyframes: normalizeCaptureCameraKeyframes(recipe.cameraKeyframes),
            durationSeconds: recipe.durationSeconds,
          },
          { id: "capture-camera-path", name: "Camera Path" },
        )
      : null;
  const cameraPath =
    rawCameraPath && isCaptureCameraPathV3(rawCameraPath)
      ? captureCameraPathV3Renderable(rawCameraPath)
        ? rawCameraPath
        : null
      : rawCameraPath && isCaptureCameraPathV2(rawCameraPath)
        ? captureCameraPathV2Renderable(rawCameraPath)
        ? rawCameraPath
        : null
        : rawCameraPath;
  return {
    ...recipe,
    camera: recipe.camera ? clonePose(recipe.camera) : null,
    resolution: { ...recipe.resolution },
    previewResolution: recipe.previewResolution
      ? { ...recipe.previewResolution }
      : null,
    captureScope: recipe.captureScope ?? "current-page",
    pageRangeStartId:
      (recipe.captureScope ?? "current-page") === "page-range"
        ? (recipe.pageRangeStartId ?? null)
        : null,
    pageRangeEndId:
      (recipe.captureScope ?? "current-page") === "page-range"
        ? (recipe.pageRangeEndId ?? null)
        : null,
    pageRangeTiming: recipe.pageRangeTiming ?? "authored",
    equalHoldSeconds: recipe.equalHoldSeconds ?? null,
    captureTimeline: recipe.captureTimeline
      ? normalizeCaptureTimelineState(recipe.captureTimeline)
      : null,
    cameraPath,
    cameraTimeline: cameraTimelineMetadata(cameraPath, {
      durationSeconds: recipe.durationSeconds,
      fps: recipe.fps,
    }),
    cameraKeyframes: cameraPath
      ? captureCameraPathToRecipeKeyframes(cameraPath, recipe.fps)
      : normalizeCaptureCameraKeyframes(recipe.cameraKeyframes),
    renderFidelity: recipe.renderFidelity ?? "max-detail-render",
    layerVisibility: { ...recipe.layerVisibility },
    layerStyles: { ...recipe.layerStyles },
  };
}

export function serializeCaptureRecipe(recipe: CaptureRecipeV1): string {
  return `${JSON.stringify(normalizeCaptureRecipe(recipe), null, 2)}\n`;
}

export function parseCaptureRecipeJson(text: string): CaptureRecipeParseResult {
  try {
    const parsed = JSON.parse(text) as CaptureRecipeV1;
    const validation = validateCaptureRecipe(parsed);
    if (!validation.valid) {
      return { recipe: null, validation };
    }
    return {
      recipe: normalizeCaptureRecipe(parsed),
      validation,
    };
  } catch (error) {
    return {
      recipe: null,
      validation: {
        valid: false,
        errors: [
          error instanceof Error
            ? `Recipe JSON could not be parsed: ${error.message}`
            : "Recipe JSON could not be parsed.",
        ],
      },
    };
  }
}

function safeFilenamePart(value: string | null | undefined, fallback: string): string {
  const sanitized = (value ?? fallback)
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return sanitized || fallback;
}

export function captureRecipeFilename(recipe: CaptureRecipeV1): string {
  const created = new Date(recipe.createdAt);
  const stamp = Number.isNaN(created.getTime())
    ? "unknown-date"
    : created.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `geosee-${safeFilenamePart(recipe.projectSlug, "project")}-${safeFilenamePart(
    recipe.pageId,
    "scene",
  )}-${safeFilenamePart(recipe.resolution.label, "render")}-${stamp}.capture.json`;
}

export function getCaptureFrameTime(frameIndex: number, fps: number): number {
  if (!Number.isInteger(frameIndex) || frameIndex < 0) {
    throw new Error("frameIndex must be a non-negative integer.");
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error("fps must be greater than zero.");
  }
  return frameIndex / fps;
}
