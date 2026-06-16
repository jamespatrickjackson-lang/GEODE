import type { CaptureValidationResult } from "./captureTypes";

export const DEFAULT_CAPTURE_SCROLL_FPS = 60;
export const CAPTURE_SCROLL_FPS_OPTIONS = [30, 60, 120] as const;
export type CaptureScrollFps = (typeof CAPTURE_SCROLL_FPS_OPTIONS)[number];

export type CaptureScrollFrameRange =
  | { mode: "full" }
  | { mode: "frame-range"; startFrame: number; endFrame: number };

export interface CaptureScrollTimelineV1 {
  version: 1;
  fps: CaptureScrollFps;
  durationSeconds: number;
  range: CaptureScrollFrameRange;
  pageSource: { mode: "page-bar" | "current-page"; fallback: "current-page" | "none" };
  cameraSource: { mode: "camera-path" | "current-camera"; pathId: string | null };
  anchors: Array<{ id: string; label: string; progress: number; posterFrame?: number | null }>;
  outputProfileId: string;
}

export interface CaptureScrollResolvedFrameRange {
  startFrame: number;
  endFrame: number;
  totalFrames: number;
}

export interface CaptureScrollTimelineSample {
  frameIndex: number;
  clampedFrameIndex: number;
  timeSeconds: number;
  normalizedProgress: number;
  rangeProgress: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCaptureScrollFps(value: unknown): value is CaptureScrollFps {
  return CAPTURE_SCROLL_FPS_OPTIONS.includes(value as CaptureScrollFps);
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
    errors.push("timeline.fps must be 30, 60, or 120.");
  }
  if (!finiteNumber(timeline.durationSeconds) || timeline.durationSeconds <= 0) {
    errors.push("timeline.durationSeconds must be greater than zero.");
  }

  const durationFrames =
    isCaptureScrollFps(timeline.fps) &&
    finiteNumber(timeline.durationSeconds) &&
    timeline.durationSeconds > 0
      ? Math.ceil(timeline.durationSeconds * timeline.fps)
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
