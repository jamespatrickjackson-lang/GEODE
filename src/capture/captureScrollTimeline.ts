import type { CaptureValidationResult } from "./captureTypes";
import type { CaptureTimelineTransitionEasing } from "./captureTimeline";

export const DEFAULT_CAPTURE_SCROLL_FPS = 60;
export const CAPTURE_SCROLL_FPS_OPTIONS = [30, 60] as const;
export type CaptureScrollFps = (typeof CAPTURE_SCROLL_FPS_OPTIONS)[number];

export const CAPTURE_SCROLL_OUTPUT_FORMATS = [
  "mp4",
  "webm",
  "scroll-friendly-video",
  "png-sequence",
] as const;
export type CaptureScrollRecordFormat =
  (typeof CAPTURE_SCROLL_OUTPUT_FORMATS)[number];

export const CAPTURE_SCROLL_QUALITY_PRESETS = {
  "1080p": { preset: "1080p", width: 1920, height: 1080 },
  "1440p": { preset: "1440p", width: 2560, height: 1440 },
  "4k": { preset: "4k", width: 3840, height: 2160 },
  "6k": { preset: "6k", width: 6144, height: 3456 },
  "8k": { preset: "8k", width: 7680, height: 4320 },
} as const;

export type CaptureScrollQualityPreset =
  keyof typeof CAPTURE_SCROLL_QUALITY_PRESETS;

export type CaptureScrollRenderRouteIntent =
  | "browser-inline"
  | "local-external"
  | "manual-fallback";

export type CaptureScrollFrameRange =
  | { mode: "full" }
  | { mode: "frame-range"; startFrame: number; endFrame: number };

export interface CaptureScrollTimelinePageSourceClip {
  id: string;
  pageId: string;
  label: string;
  enabled: boolean;
  locked: boolean;
  startSeconds: number;
  transitionSeconds: number;
  holdSeconds: number;
  transitionEasing: CaptureTimelineTransitionEasing;
}

export interface CaptureScrollTimelinePageSource {
  mode: "page-bar" | "current-page";
  fallback: "current-page" | "none";
  clips: CaptureScrollTimelinePageSourceClip[];
}

export interface CaptureScrollRecordQuality {
  preset: CaptureScrollQualityPreset;
  width: number;
  height: number;
}

export interface CaptureScrollRecordRequestV1 {
  schema: "CaptureScrollRecordRequestV1";
  version: 1;
  timeline: CaptureScrollTimelineV1;
  /**
   * Primary output format. Derived from `formats` by render priority and kept
   * for back-compat with single-format render/encode paths.
   */
  format: CaptureScrollRecordFormat;
  /** Every operator-selected output format. The package produces one per entry. */
  formats: CaptureScrollRecordFormat[];
  quality: CaptureScrollRecordQuality;
  frameRange: CaptureScrollResolvedFrameRange;
  destination: string;
  packageName: string;
  cleanRender: boolean;
  renderRouteIntent: CaptureScrollRenderRouteIntent;
  advancedOptions: Record<string, unknown>;
  createdAt: string;
}

export interface CreateScrollRecordRequestInput {
  timeline: Partial<CaptureScrollTimelineV1>;
  format?: unknown;
  formats?: unknown;
  quality: unknown;
  destination: unknown;
  packageName: unknown;
  cleanRender?: unknown;
  renderRouteIntent?: unknown;
  advancedOptions?: unknown;
  createdAt?: unknown;
  now?: () => Date;
}

export interface CaptureScrollTimelineV1 {
  version: 1;
  fps: CaptureScrollFps;
  durationSeconds: number;
  range: CaptureScrollFrameRange;
  pageSource: CaptureScrollTimelinePageSource;
  cameraSource: { mode: "camera-path" | "current-camera"; pathId: string | null };
  anchors: Array<{ id: string; label: string; progress: number; posterFrame?: number | null }>;
  outputProfileId: string;
}

export interface CaptureScrollResolvedFrameRange {
  startFrame: number;
  endFrame: number;
  totalFrames: number;
}

export interface CaptureScrollTimelinePageSample {
  clipId: string | null;
  pageId: string | null;
  sourcePageId: string | null;
  targetPageId: string | null;
  localTimeSeconds: number;
  transitionProgress: number;
  transitionEasing: CaptureTimelineTransitionEasing;
  fallbackMode: "current-page" | "none";
}

export interface CaptureScrollTimelineSample {
  frameIndex: number;
  clampedFrameIndex: number;
  timeSeconds: number;
  normalizedProgress: number;
  rangeProgress: number;
  page: CaptureScrollTimelinePageSample;
}

function normalizeFrameMathFps(fps: unknown): number {
  return typeof fps === "number" && Number.isFinite(fps) && fps > 0
    ? Math.round(fps)
    : DEFAULT_CAPTURE_SCROLL_FPS;
}

export function captureScrollFrameForSeconds(
  seconds: number,
  fps: number = DEFAULT_CAPTURE_SCROLL_FPS,
): number {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  return Math.max(0, Math.round(safeSeconds * normalizeFrameMathFps(fps)));
}

export function captureScrollSecondsForFrame(
  frameIndex: number,
  fps: number = DEFAULT_CAPTURE_SCROLL_FPS,
): number {
  const safeFrame = Number.isFinite(frameIndex)
    ? Math.max(0, Math.round(frameIndex))
    : 0;
  return safeFrame / normalizeFrameMathFps(fps);
}

export function clampCaptureScrollFrameToRange(
  frameIndex: number,
  range: CaptureScrollResolvedFrameRange,
): number {
  const safeFrame = Number.isFinite(frameIndex)
    ? Math.max(0, Math.round(frameIndex))
    : range.startFrame;
  return Math.max(range.startFrame, Math.min(safeFrame, range.endFrame));
}

export function resolveCaptureScrollPlayStartFrame(
  currentFrame: number,
  range: CaptureScrollResolvedFrameRange,
): number {
  const safeFrame = Number.isFinite(currentFrame)
    ? Math.max(0, Math.round(currentFrame))
    : range.startFrame;
  return safeFrame >= range.startFrame && safeFrame <= range.endFrame
    ? safeFrame
    : range.startFrame;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCaptureScrollFps(value: unknown): value is CaptureScrollFps {
  return CAPTURE_SCROLL_FPS_OPTIONS.includes(value as CaptureScrollFps);
}

function isCaptureScrollFormat(value: unknown): value is CaptureScrollRecordFormat {
  return CAPTURE_SCROLL_OUTPUT_FORMATS.includes(value as CaptureScrollRecordFormat);
}

/**
 * Render priority used to pick the single "primary" format that the
 * render-once + encode-each pipeline encodes first. Video formats win over the
 * frames-only PNG sequence so a shared frame render always drives a video out.
 */
const CAPTURE_SCROLL_FORMAT_PRIORITY: readonly CaptureScrollRecordFormat[] = [
  "mp4",
  "scroll-friendly-video",
  "webm",
  "png-sequence",
];

export function resolvePrimaryScrollFormat(
  formats: readonly CaptureScrollRecordFormat[],
): CaptureScrollRecordFormat {
  for (const candidate of CAPTURE_SCROLL_FORMAT_PRIORITY) {
    if (formats.includes(candidate)) return candidate;
  }
  return "mp4";
}

/**
 * Normalize a requested format selection into an ordered, de-duplicated list of
 * supported formats. Accepts an array (`formats`) and/or a single `format`
 * fallback so older single-format callers keep working.
 */
export function normalizeScrollFormats(
  formats: unknown,
  fallbackFormat?: unknown,
): CaptureScrollRecordFormat[] {
  const candidates: unknown[] = Array.isArray(formats)
    ? formats
    : fallbackFormat !== undefined
      ? [fallbackFormat]
      : [];
  const seen = new Set<CaptureScrollRecordFormat>();
  const ordered: CaptureScrollRecordFormat[] = [];
  for (const value of candidates) {
    if (isCaptureScrollFormat(value) && !seen.has(value)) {
      seen.add(value);
      ordered.push(value);
    }
  }
  return ordered;
}

function isCaptureTimelineTransitionEasing(
  value: unknown,
): value is CaptureTimelineTransitionEasing {
  return value === "linear" || value === "ease-in-out";
}

function isCaptureScrollQualityPreset(
  value: unknown,
): value is CaptureScrollQualityPreset {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CAPTURE_SCROLL_QUALITY_PRESETS, value)
  );
}

function isCaptureScrollRenderRouteIntent(
  value: unknown,
): value is CaptureScrollRenderRouteIntent {
  return (
    value === "browser-inline" ||
    value === "local-external" ||
    value === "manual-fallback"
  );
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function timelineDurationFrames(timeline: Pick<CaptureScrollTimelineV1, "durationSeconds" | "fps">): number {
  return Math.ceil(timeline.durationSeconds * timeline.fps);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function safeRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

function normalizePackageName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pathSegments(value: string): string[] {
  return value.split(/[\\/]+/).filter((part) => part.length > 0 && part !== ".");
}

function isSafeDestinationPath(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  const trimmed = value.trim();
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(trimmed)) return false;
  if (/^[\\/]/.test(trimmed)) return false;
  const segments = pathSegments(trimmed);
  if (segments.length === 0) return false;
  if (segments.includes("..")) return false;
  return segments[0]?.toLowerCase() !== "projects";
}

function isSafePackageName(value: string): boolean {
  if (!nonEmptyString(value)) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  if (/[\\/]/.test(value)) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) return false;
  const windowsBasename = value.split(".")[0]?.toUpperCase();
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(windowsBasename)) {
    return false;
  }
  return !pathSegments(value).includes("..");
}

function isFourKOrHigher(quality: Pick<CaptureScrollRecordQuality, "width" | "height">): boolean {
  return quality.width >= 3840 || quality.height >= 2160;
}

function isExactEightK(quality: Pick<CaptureScrollRecordQuality, "width" | "height">): boolean {
  return quality.width === 7680 && quality.height === 4320;
}

function touchesEightK(quality: Pick<CaptureScrollRecordQuality, "width" | "height">): boolean {
  return quality.width >= 7680 || quality.height >= 4320;
}

function normalizeScrollRecordQuality(value: unknown): CaptureScrollRecordQuality {
  const record = isRecord(value) ? value : {};
  const preset = isCaptureScrollQualityPreset(record.preset)
    ? record.preset
    : (record.preset as CaptureScrollQualityPreset);
  return {
    preset,
    width: finiteNumber(record.width) ? record.width : Number.NaN,
    height: finiteNumber(record.height) ? record.height : Number.NaN,
  };
}

function fallbackResolvedFrameRange(
  timeline: CaptureScrollTimelineV1,
): CaptureScrollResolvedFrameRange {
  if (
    timeline.range.mode === "frame-range" &&
    nonNegativeInteger(timeline.range.startFrame) &&
    nonNegativeInteger(timeline.range.endFrame)
  ) {
    return {
      startFrame: timeline.range.startFrame,
      endFrame: timeline.range.endFrame,
      totalFrames: timeline.range.endFrame - timeline.range.startFrame + 1,
    };
  }
  const validatedFps = isCaptureScrollFps(timeline.fps) ? timeline.fps : 0;
  const validatedDurationSeconds =
    validatedFps > 0 &&
    finiteNumber(timeline.durationSeconds) &&
    timeline.durationSeconds > 0
      ? timeline.durationSeconds
      : 0;
  const durationFrames =
    validatedDurationSeconds > 0
      ? Math.ceil(validatedDurationSeconds * validatedFps)
      : 0;
  return {
    startFrame: 0,
    endFrame: Math.max(0, durationFrames - 1),
    totalFrames: durationFrames,
  };
}

function requestFrameRange(
  timeline: CaptureScrollTimelineV1,
): CaptureScrollResolvedFrameRange {
  const validation = validateCaptureScrollTimeline(timeline);
  if (validation.valid) return resolveCaptureScrollFrameRange(timeline);
  return fallbackResolvedFrameRange(timeline);
}

function invalidFrameRange(): CaptureScrollFrameRange {
  return { mode: "frame-range", startFrame: Number.NaN, endFrame: Number.NaN };
}

function normalizeFrameRange(value: unknown, supplied: boolean): CaptureScrollFrameRange {
  if (!isRecord(value)) return supplied ? invalidFrameRange() : { mode: "full" };
  if (value.mode === "frame-range") {
    return {
      mode: "frame-range",
      startFrame: finiteNumber(value.startFrame) ? value.startFrame : Number.NaN,
      endFrame: finiteNumber(value.endFrame) ? value.endFrame : Number.NaN,
    };
  }
  if (value.mode !== "full") return invalidFrameRange();
  return { mode: "full" };
}

function normalizePageSourceClips(
  value: unknown,
): CaptureScrollTimelinePageSourceClip[] {
  if (!Array.isArray(value)) return [];
  return value.map((clip, index) => {
    if (!isRecord(clip)) {
      return {
        id: "",
        pageId: "",
        label: "",
        enabled: true,
        locked: false,
        startSeconds: Number.NaN,
        transitionSeconds: Number.NaN,
        holdSeconds: Number.NaN,
        transitionEasing: "ease-in-out",
      };
    }
    return {
      id: nonEmptyString(clip.id) ? clip.id : `clip-${index + 1}`,
      pageId: nonEmptyString(clip.pageId) ? clip.pageId : "",
      label: typeof clip.label === "string" ? clip.label : "",
      enabled: clip.enabled !== false,
      locked: clip.locked === true,
      startSeconds:
        typeof clip.startSeconds === "number" ? clip.startSeconds : Number.NaN,
      transitionSeconds:
        typeof clip.transitionSeconds === "number"
          ? clip.transitionSeconds
          : Number.NaN,
      holdSeconds:
        typeof clip.holdSeconds === "number" ? clip.holdSeconds : Number.NaN,
      transitionEasing: isCaptureTimelineTransitionEasing(clip.transitionEasing)
        ? clip.transitionEasing
        : "ease-in-out",
    };
  });
}

export function normalizeCaptureScrollTimeline(
  timeline: Partial<CaptureScrollTimelineV1>,
): CaptureScrollTimelineV1 {
  const fpsSupplied = hasOwn(timeline, "fps");
  const fps = fpsSupplied
    ? isCaptureScrollFps(timeline.fps)
      ? timeline.fps
      : (timeline.fps as unknown as CaptureScrollFps)
    : DEFAULT_CAPTURE_SCROLL_FPS;
  const durationSupplied = hasOwn(timeline, "durationSeconds");
  const durationSeconds = durationSupplied
    ? typeof timeline.durationSeconds === "number"
      ? timeline.durationSeconds
      : Number.NaN
    : 1;
  const pageSource: Record<string, unknown> = isRecord(timeline.pageSource)
    ? timeline.pageSource
    : {};
  const cameraSource: Record<string, unknown> = isRecord(timeline.cameraSource)
    ? timeline.cameraSource
    : {};
  const rangeSupplied = hasOwn(timeline, "range");

  return {
    version: 1,
    fps,
    durationSeconds,
    range: normalizeFrameRange(timeline.range, rangeSupplied),
    pageSource: {
      mode: pageSource.mode === "current-page" ? "current-page" : "page-bar",
      fallback: pageSource.fallback === "none" ? "none" : "current-page",
      clips: normalizePageSourceClips(pageSource.clips),
    },
    cameraSource: {
      mode: cameraSource.mode === "current-camera" ? "current-camera" : "camera-path",
      pathId: nonEmptyString(cameraSource.pathId) ? cameraSource.pathId : null,
    },
    anchors: Array.isArray(timeline.anchors)
      ? timeline.anchors.map((anchor, index) => {
          if (!isRecord(anchor)) {
            return {
              id: "",
              label: "",
              progress: Number.NaN,
              posterFrame: null,
            };
          }
          const progress = hasOwn(anchor, "progress")
            ? typeof anchor.progress === "number"
              ? anchor.progress
              : Number.NaN
            : 0;
          const posterFrame = hasOwn(anchor, "posterFrame")
            ? anchor.posterFrame === null
              ? null
              : typeof anchor.posterFrame === "number"
                ? anchor.posterFrame
                : Number.NaN
            : null;
          return {
            id: nonEmptyString(anchor.id) ? anchor.id : `anchor-${index + 1}`,
            label: typeof anchor.label === "string" ? anchor.label : "",
            progress,
            posterFrame,
          };
        })
      : [],
    outputProfileId: nonEmptyString(timeline.outputProfileId)
      ? timeline.outputProfileId
      : "default",
  };
}

export function captureScrollQualityForPreset(
  preset: CaptureScrollQualityPreset,
): CaptureScrollRecordQuality {
  return { ...CAPTURE_SCROLL_QUALITY_PRESETS[preset] };
}

export function createScrollRecordRequest(
  input: CreateScrollRecordRequestInput,
): CaptureScrollRecordRequestV1 {
  const timeline = normalizeCaptureScrollTimeline(input.timeline);
  const now = input.now ?? (() => new Date());
  const createdAt =
    typeof input.createdAt === "string" ? input.createdAt : now().toISOString();
  const formats = normalizeScrollFormats(input.formats, input.format);
  const primaryFormat =
    formats.length > 0
      ? resolvePrimaryScrollFormat(formats)
      : isCaptureScrollFormat(input.format)
        ? input.format
        : (input.format as CaptureScrollRecordFormat);
  return {
    schema: "CaptureScrollRecordRequestV1",
    version: 1,
    timeline,
    format: primaryFormat,
    formats,
    quality: normalizeScrollRecordQuality(input.quality),
    frameRange: requestFrameRange(timeline),
    destination: typeof input.destination === "string" ? input.destination.trim() : "",
    packageName: normalizePackageName(input.packageName),
    cleanRender: input.cleanRender === true,
    renderRouteIntent: isCaptureScrollRenderRouteIntent(input.renderRouteIntent)
      ? input.renderRouteIntent
      : (input.renderRouteIntent as CaptureScrollRenderRouteIntent),
    advancedOptions: safeRecord(input.advancedOptions),
    createdAt,
  };
}

export function validateScrollRecordRequest(
  request: unknown,
): CaptureValidationResult {
  const errors: string[] = [];
  if (!isRecord(request)) {
    return { valid: false, errors: ["request must be an object."] };
  }

  if (request.schema !== "CaptureScrollRecordRequestV1") {
    errors.push("request.schema must be CaptureScrollRecordRequestV1.");
  }
  if (request.version !== 1) errors.push("request.version must be 1.");

  const timelineValidation = validateCaptureScrollTimeline(request.timeline);
  if (!timelineValidation.valid) {
    errors.push(...timelineValidation.errors);
  }

  if (!isCaptureScrollFormat(request.format)) {
    errors.push("request.format is not supported.");
  }

  if (!Array.isArray(request.formats) || request.formats.length === 0) {
    errors.push("request.formats must list at least one output format.");
  } else {
    const seen = new Set<unknown>();
    for (const candidate of request.formats) {
      if (!isCaptureScrollFormat(candidate)) {
        errors.push(`request.formats includes an unsupported format: ${String(candidate)}.`);
      } else if (seen.has(candidate)) {
        errors.push(`request.formats has a duplicate format: ${candidate}.`);
      } else {
        seen.add(candidate);
      }
    }
    if (
      isCaptureScrollFormat(request.format) &&
      !request.formats.includes(request.format)
    ) {
      errors.push("request.format must be one of request.formats.");
    }
  }

  if (!isRecord(request.quality)) {
    errors.push("request.quality must be an object.");
  } else {
    if (!isCaptureScrollQualityPreset(request.quality.preset)) {
      errors.push("request.quality.preset is not supported.");
    }
    if (!positiveInteger(request.quality.width)) {
      errors.push("request.quality.width must be a positive integer.");
    }
    if (!positiveInteger(request.quality.height)) {
      errors.push("request.quality.height must be a positive integer.");
    }
    if (
      positiveInteger(request.quality.width) &&
      positiveInteger(request.quality.height)
    ) {
      const quality = {
        width: request.quality.width,
        height: request.quality.height,
      };
      if (isCaptureScrollQualityPreset(request.quality.preset)) {
        const expected = CAPTURE_SCROLL_QUALITY_PRESETS[request.quality.preset];
        if (quality.width !== expected.width || quality.height !== expected.height) {
          errors.push("request.quality dimensions must match the selected preset.");
        }
      }
      if (
        (request.quality.preset === "8k" || touchesEightK(quality)) &&
        !isExactEightK(quality)
      ) {
        errors.push("8K scroll record requests must be exactly 7680 x 4320.");
      }
      if (isFourKOrHigher(quality)) {
        const explicitManualFallback =
          request.renderRouteIntent === "manual-fallback" &&
          isRecord(request.advancedOptions) &&
          request.advancedOptions.manualFallbackAccepted === true;
        if (
          request.renderRouteIntent !== "local-external" &&
          !explicitManualFallback
        ) {
          errors.push(
            "4K and higher scroll record requests require local-external routing or explicit manual fallback.",
          );
        }
      }
    }
  }

  if (!isRecord(request.frameRange)) {
    errors.push("request.frameRange must be an object.");
  } else {
    const { startFrame, endFrame, totalFrames } = request.frameRange;
    if (!nonNegativeInteger(startFrame)) {
      errors.push("request.frameRange.startFrame must be a zero-based integer.");
    }
    if (!nonNegativeInteger(endFrame)) {
      errors.push("request.frameRange.endFrame must be a zero-based integer.");
    }
    if (!positiveInteger(totalFrames)) {
      errors.push("request.frameRange.totalFrames must be greater than zero.");
    }
    if (
      nonNegativeInteger(startFrame) &&
      nonNegativeInteger(endFrame) &&
      startFrame > endFrame
    ) {
      errors.push("request.frameRange.startFrame must be before or equal to endFrame.");
    }
    if (
      nonNegativeInteger(startFrame) &&
      nonNegativeInteger(endFrame) &&
      positiveInteger(totalFrames) &&
      totalFrames !== endFrame - startFrame + 1
    ) {
      errors.push("request.frameRange.totalFrames must match the inclusive range.");
    }
  }

  if (!isSafeDestinationPath(request.destination)) {
    errors.push(
      "request.destination must be a relative non-project path without URI schemes or parent segments.",
    );
  }

  if (typeof request.packageName !== "string" || !isSafePackageName(request.packageName)) {
    errors.push("request.packageName must be a non-empty file-safe package name.");
  }

  if (typeof request.cleanRender !== "boolean") {
    errors.push("request.cleanRender must be boolean.");
  }

  if (!isCaptureScrollRenderRouteIntent(request.renderRouteIntent)) {
    errors.push("request.renderRouteIntent is not supported.");
  }

  if (!isRecord(request.advancedOptions)) {
    errors.push("request.advancedOptions must be an object.");
  }

  if (
    typeof request.createdAt !== "string" ||
    Number.isNaN(Date.parse(request.createdAt))
  ) {
    errors.push("request.createdAt must be an ISO date.");
  }

  if (
    timelineValidation.valid &&
    isRecord(request.frameRange) &&
    nonNegativeInteger(request.frameRange.startFrame) &&
    nonNegativeInteger(request.frameRange.endFrame) &&
    positiveInteger(request.frameRange.totalFrames)
  ) {
    const resolved = resolveCaptureScrollFrameRange(
      request.timeline as CaptureScrollTimelineV1,
    );
    if (
      request.frameRange.startFrame !== resolved.startFrame ||
      request.frameRange.endFrame !== resolved.endFrame ||
      request.frameRange.totalFrames !== resolved.totalFrames
    ) {
      errors.push("request.frameRange must match the timeline range.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function resolveCaptureScrollFrameRange(
  timeline: CaptureScrollTimelineV1,
): CaptureScrollResolvedFrameRange {
  const validation = validateCaptureScrollTimeline(timeline);
  if (!validation.valid) {
    throw new Error(`Invalid capture scroll timeline: ${validation.errors.join(" ")}`);
  }

  const durationFrames = timelineDurationFrames(timeline);
  if (timeline.range.mode === "full") {
    return {
      startFrame: 0,
      endFrame: durationFrames - 1,
      totalFrames: durationFrames,
    };
  }

  return {
    startFrame: timeline.range.startFrame,
    endFrame: timeline.range.endFrame,
    totalFrames: timeline.range.endFrame - timeline.range.startFrame + 1,
  };
}

function pageClipDuration(clip: CaptureScrollTimelinePageSourceClip): number {
  return Math.max(0, clip.transitionSeconds) + Math.max(0, clip.holdSeconds);
}

function enabledPageSourceClips(
  timeline: CaptureScrollTimelineV1,
): CaptureScrollTimelinePageSourceClip[] {
  if (timeline.pageSource.mode !== "page-bar") return [];
  return timeline.pageSource.clips
    .filter((clip) => clip.enabled)
    .sort((left, right) => left.startSeconds - right.startSeconds);
}

function fallbackPageSample(
  timeline: CaptureScrollTimelineV1,
  timeSeconds: number,
): CaptureScrollTimelinePageSample {
  return {
    clipId: null,
    pageId: null,
    sourcePageId: null,
    targetPageId: null,
    localTimeSeconds: Math.max(0, timeSeconds),
    transitionProgress: 1,
    transitionEasing: "ease-in-out",
    fallbackMode: timeline.pageSource.fallback,
  };
}

function sampleScrollPageSource(
  timeline: CaptureScrollTimelineV1,
  timeSeconds: number,
): CaptureScrollTimelinePageSample {
  const clips = enabledPageSourceClips(timeline);
  if (clips.length === 0) return fallbackPageSample(timeline, timeSeconds);

  const clampedTimeSeconds = Math.max(0, timeSeconds);
  let clipIndex = clips.findIndex((clip) => {
    const start = clip.startSeconds;
    const end = start + pageClipDuration(clip);
    return clampedTimeSeconds >= start && clampedTimeSeconds < end;
  });
  if (clipIndex < 0 && clampedTimeSeconds >= clips[clips.length - 1].startSeconds) {
    clipIndex = clips.length - 1;
  }
  if (clipIndex < 0) return fallbackPageSample(timeline, timeSeconds);

  const clip = clips[clipIndex];
  const previousClip = clips[clipIndex - 1] ?? null;
  const localTimeSeconds = Math.max(0, clampedTimeSeconds - clip.startSeconds);
  const transitionProgress =
    clip.transitionSeconds > 0
      ? clamp01(localTimeSeconds / clip.transitionSeconds)
      : 1;
  const targetPageId =
    previousClip &&
    previousClip.pageId !== clip.pageId &&
    transitionProgress < 1
      ? clip.pageId
      : null;
  return {
    clipId: clip.id,
    pageId: clip.pageId,
    sourcePageId: targetPageId ? previousClip?.pageId ?? clip.pageId : clip.pageId,
    targetPageId,
    localTimeSeconds,
    transitionProgress,
    transitionEasing: clip.transitionEasing,
    fallbackMode: "none",
  };
}

export function sampleCaptureScrollTimeline(
  timeline: CaptureScrollTimelineV1,
  frameIndex: number,
): CaptureScrollTimelineSample {
  if (!nonNegativeInteger(frameIndex)) {
    throw new Error("frameIndex must be a non-negative finite integer.");
  }
  const range = resolveCaptureScrollFrameRange(timeline);
  const durationFrames = timelineDurationFrames(timeline);
  const maxFrame = Math.max(0, durationFrames - 1);
  const clampedFrameIndex = Math.min(Math.max(0, frameIndex), maxFrame);
  const rangeDuration = Math.max(1, range.totalFrames - 1);
  const normalizedProgress =
    clampedFrameIndex >= maxFrame ? 1 : clamp01(clampedFrameIndex / durationFrames);

  return {
    frameIndex,
    clampedFrameIndex,
    timeSeconds: clampedFrameIndex / timeline.fps,
    normalizedProgress,
    rangeProgress: clamp01((clampedFrameIndex - range.startFrame) / rangeDuration),
    page: sampleScrollPageSource(timeline, clampedFrameIndex / timeline.fps),
  };
}

export function validateCaptureScrollTimeline(
  timeline: unknown,
): CaptureValidationResult {
  const errors: string[] = [];
  if (!isRecord(timeline)) {
    return { valid: false, errors: ["timeline must be an object."] };
  }

  if (timeline.version !== 1) errors.push("timeline.version must be 1.");
  if (!isCaptureScrollFps(timeline.fps)) {
    errors.push("timeline.fps must be 30 or 60.");
  }
  if (!finiteNumber(timeline.durationSeconds) || timeline.durationSeconds <= 0) {
    errors.push("timeline.durationSeconds must be greater than zero.");
  }

  const validatedFps = isCaptureScrollFps(timeline.fps) ? timeline.fps : 0;
  const validatedDurationSeconds =
    validatedFps > 0 &&
    finiteNumber(timeline.durationSeconds) &&
    timeline.durationSeconds > 0
      ? timeline.durationSeconds
      : 0;
  const durationFrames =
    validatedDurationSeconds > 0
      ? Math.ceil(validatedDurationSeconds * validatedFps)
      : 0;

  if (!isRecord(timeline.range)) {
    errors.push("timeline.range must be an object.");
  } else if (timeline.range.mode === "frame-range") {
    const { startFrame, endFrame } = timeline.range;
    if (!nonNegativeInteger(startFrame)) {
      errors.push("timeline.range.startFrame must be a zero-based integer.");
    }
    if (!nonNegativeInteger(endFrame)) {
      errors.push("timeline.range.endFrame must be a zero-based integer.");
    }
    if (nonNegativeInteger(startFrame) && nonNegativeInteger(endFrame) && startFrame > endFrame) {
      errors.push("timeline.range.startFrame must be before or equal to endFrame.");
    }
    if (durationFrames > 0 && nonNegativeInteger(endFrame) && endFrame >= durationFrames) {
      errors.push("timeline.range.endFrame must be inside the timeline duration.");
    }
  } else if (timeline.range.mode !== "full") {
    errors.push("timeline.range.mode must be full or frame-range.");
  }

  if (!isRecord(timeline.pageSource)) {
    errors.push("timeline.pageSource must be an object.");
  } else {
    if (timeline.pageSource.mode !== "page-bar" && timeline.pageSource.mode !== "current-page") {
      errors.push("timeline.pageSource.mode must be page-bar or current-page.");
    }
    if (
      timeline.pageSource.fallback !== "current-page" &&
      timeline.pageSource.fallback !== "none"
    ) {
      errors.push("timeline.pageSource.fallback must be current-page or none.");
    }
    if (
      timeline.pageSource.clips !== undefined &&
      !Array.isArray(timeline.pageSource.clips)
    ) {
      errors.push("timeline.pageSource.clips must be an array.");
    }
    if (Array.isArray(timeline.pageSource.clips)) {
      timeline.pageSource.clips.forEach((clip, index) => {
        if (!isRecord(clip)) {
          errors.push(`timeline.pageSource.clips[${index}] must be an object.`);
          return;
        }
        if (!nonEmptyString(clip.id)) {
          errors.push(`timeline.pageSource.clips[${index}].id is required.`);
        }
        if (!nonEmptyString(clip.pageId)) {
          errors.push(`timeline.pageSource.clips[${index}].pageId is required.`);
        }
        if (typeof clip.label !== "string") {
          errors.push(`timeline.pageSource.clips[${index}].label must be a string.`);
        }
        if (typeof clip.enabled !== "boolean") {
          errors.push(`timeline.pageSource.clips[${index}].enabled must be boolean.`);
        }
        if (typeof clip.locked !== "boolean") {
          errors.push(`timeline.pageSource.clips[${index}].locked must be boolean.`);
        }
        for (const key of [
          "startSeconds",
          "transitionSeconds",
          "holdSeconds",
        ] as const) {
          const value = clip[key];
          if (!finiteNumber(value) || value < 0) {
            errors.push(
              `timeline.pageSource.clips[${index}].${key} must be a non-negative number.`,
            );
          }
        }
        if (!isCaptureTimelineTransitionEasing(clip.transitionEasing)) {
          errors.push(
            `timeline.pageSource.clips[${index}].transitionEasing must be linear or ease-in-out.`,
          );
        }
        if (
          durationFrames > 0 &&
          finiteNumber(clip.startSeconds) &&
          finiteNumber(clip.transitionSeconds) &&
          finiteNumber(clip.holdSeconds)
        ) {
          const clipEndSeconds =
            clip.startSeconds + clip.transitionSeconds + clip.holdSeconds;
          if (clipEndSeconds > validatedDurationSeconds + 0.000_001) {
            errors.push(
              `Page Bar clip timing must stay inside the scroll timeline duration: ${clip.id}.`,
            );
          }
        }
      });
    }
  }

  if (!isRecord(timeline.cameraSource)) {
    errors.push("timeline.cameraSource must be an object.");
  } else {
    if (
      timeline.cameraSource.mode !== "camera-path" &&
      timeline.cameraSource.mode !== "current-camera"
    ) {
      errors.push("timeline.cameraSource.mode must be camera-path or current-camera.");
    }
    if (
      timeline.cameraSource.mode === "camera-path" &&
      !nonEmptyString(timeline.cameraSource.pathId)
    ) {
      errors.push("timeline.cameraSource.pathId is required for camera-path mode.");
    }
    if (
      timeline.cameraSource.pathId !== null &&
      typeof timeline.cameraSource.pathId !== "string"
    ) {
      errors.push("timeline.cameraSource.pathId must be a string or null.");
    }
  }

  if (!Array.isArray(timeline.anchors)) {
    errors.push("timeline.anchors must be an array.");
  } else {
    timeline.anchors.forEach((anchor, index) => {
      if (!isRecord(anchor)) {
        errors.push(`timeline.anchors[${index}] must be an object.`);
        return;
      }
      if (!nonEmptyString(anchor.id)) errors.push(`timeline.anchors[${index}].id is required.`);
      if (typeof anchor.label !== "string") {
        errors.push(`timeline.anchors[${index}].label must be a string.`);
      }
      if (!finiteNumber(anchor.progress)) {
        errors.push(`timeline.anchors[${index}].progress must be a number.`);
      } else if (anchor.progress < 0 || anchor.progress > 1) {
        errors.push(`timeline.anchors[${index}].progress must be between 0 and 1.`);
      }
      if (
        anchor.posterFrame !== undefined &&
        anchor.posterFrame !== null &&
        !nonNegativeInteger(anchor.posterFrame)
      ) {
        errors.push(`timeline.anchors[${index}].posterFrame must be a zero-based integer.`);
      }
      if (
        durationFrames > 0 &&
        nonNegativeInteger(anchor.posterFrame) &&
        anchor.posterFrame >= durationFrames
      ) {
        errors.push(`timeline.anchors[${index}].posterFrame must be inside the timeline duration.`);
      }
    });
  }

  if (!nonEmptyString(timeline.outputProfileId)) {
    errors.push("timeline.outputProfileId is required.");
  }

  return { valid: errors.length === 0, errors };
}
