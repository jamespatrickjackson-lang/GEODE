export type CaptureValidationResult = { valid: boolean; errors: string[] };

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

export interface CaptureScrollTimelineV1 {
  version: 1;
  fps: 30 | 60;
  durationSeconds: number;
  range:
    | { mode: "full" }
    | { mode: "frame-range"; startFrame: number; endFrame: number };
  pageSource: { mode: "page-bar" | "current-page"; fallback: "current-page" | "none" };
  cameraSource: { mode: "camera-path" | "current-camera"; pathId: string | null };
  anchors: Array<{ id: string; label: string; progress: number; posterFrame?: number | null }>;
  outputProfileId: string;
}

export interface CaptureScrollRecordRequestV1 {
  schema: "CaptureScrollRecordRequestV1";
  version: 1;
  timeline: CaptureScrollTimelineV1;
  format: CaptureScrollRecordFormat;
  formats: CaptureScrollRecordFormat[];
  quality: {
    preset: CaptureScrollQualityPreset;
    width: number;
    height: number;
  };
  frameRange: { startFrame: number; endFrame: number; totalFrames: number };
  destination: string;
  packageName: string;
  cleanRender: boolean;
  renderRouteIntent: CaptureScrollRenderRouteIntent;
  advancedOptions: Record<string, unknown>;
  createdAt: string;
}

export interface ScrollRenderJobVideoV1 {
  format?: "mp4" | "webm";
  fps?: number;
  totalFrames?: number;
  durationSeconds?: number;
  sourceFrameStart?: number;
  sourceFrameEnd?: number;
  encodingProfile?: string;
  videoBitrateMbps?: number;
  keyframeInterval?: number;
  allKeyframe?: boolean;
}

export interface ScrollRenderJobV1 {
  video?: ScrollRenderJobVideoV1;
  app?: { url?: string };
}

export type ScrollHandoffPackageStatus =
  | "complete"
  | "partial"
  | "cancelled"
  | "failed";

export type CaptureVisibilityGroup =
  | "sceneCanvas"
  | "captureNativeAnnotations"
  | "presenterOverlay"
  | "sceneLabels"
  | "legends"
  | "logo"
  | "navControls"
  | "editorSidebar"
  | "authoringControls"
  | "debugPanels"
  | "fullChrome";

export interface ScrollCleanRenderSettingsV1 {
  enabled: boolean;
  mode: "scene-only";
  hiddenGroups: CaptureVisibilityGroup[];
  exportOverlay: { enabled: boolean; mode: string | null };
}

export interface ScrollPosterFrameSpec {
  anchorId: string;
  frame: number;
}

export interface ScrollContactSheetFrameSpec {
  id: string;
  frame: number;
}

export interface ScrollHandoffPackageV1 {
  schema: "ScrollHandoffPackageV1";
  version: 1;
  packageId: string;
  status: ScrollHandoffPackageStatus;
  createdAt: string;
  outputProfileId: string;
  fps: number;
  durationSeconds: number;
  frameRange: { startFrame: number; endFrame: number; totalFrames: number };
  media: Array<{
    role: "primary" | "delivery" | "scroll-friendly";
    path: string;
    mimeType: string;
    byteLength?: number;
  }>;
  frames: { directory: string | null; pattern: string | null; count: number };
  posters: Array<{ anchorId: string; frame: number; path: string }>;
  contactSheetPath: string | null;
  cleanRender: ScrollCleanRenderSettingsV1;
  sourceContract: Record<string, unknown>;
  diagnosticsPath: string | null;
  readmePath: string | null;
  hashes: Array<{ path: string; sha256: string }>;
  warnings: string[];
}

type CreateScrollHandoffManifestInput = Omit<
  ScrollHandoffPackageV1,
  | "schema"
  | "version"
  | "media"
  | "frames"
  | "posters"
  | "contactSheetPath"
  | "cleanRender"
  | "diagnosticsPath"
  | "readmePath"
  | "hashes"
  | "warnings"
> &
  Partial<
    Pick<
      ScrollHandoffPackageV1,
      | "media"
      | "frames"
      | "posters"
      | "contactSheetPath"
      | "cleanRender"
      | "diagnosticsPath"
      | "readmePath"
      | "hashes"
      | "warnings"
    >
  >;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

const SCENE_ONLY_CAPTURE_VISIBILITY_PROFILE: Record<CaptureVisibilityGroup, boolean> = {
  sceneCanvas: true,
  captureNativeAnnotations: false,
  presenterOverlay: false,
  sceneLabels: false,
  legends: false,
  logo: false,
  navControls: false,
  editorSidebar: false,
  authoringControls: false,
  debugPanels: false,
  fullChrome: false,
};

function hiddenGroupsForSceneOnly(): CaptureVisibilityGroup[] {
  return (Object.entries(SCENE_ONLY_CAPTURE_VISIBILITY_PROFILE) as Array<
    [CaptureVisibilityGroup, boolean]
  >)
    .filter(([, visible]) => visible === false)
    .map(([group]) => group);
}

export function scrollCleanRenderSettingsForRequest(
  request: Pick<CaptureScrollRecordRequestV1, "cleanRender">,
): ScrollCleanRenderSettingsV1 {
  return {
    enabled: request.cleanRender === true,
    mode: "scene-only",
    hiddenGroups: hiddenGroupsForSceneOnly(),
    exportOverlay: { enabled: false, mode: null },
  };
}

function frameInsideRange(
  frame: number,
  frameRange: ScrollHandoffPackageV1["frameRange"],
): boolean {
  return frame >= frameRange.startFrame && frame <= frameRange.endFrame;
}

function middleFrame(frameRange: ScrollHandoffPackageV1["frameRange"]): number {
  return Math.floor((frameRange.startFrame + frameRange.endFrame) / 2);
}

export function selectScrollPosterFrames(
  timeline: Pick<CaptureScrollTimelineV1, "anchors">,
  frameRange: ScrollHandoffPackageV1["frameRange"],
): ScrollPosterFrameSpec[] {
  const anchorFrames = timeline.anchors
    .filter(
      (anchor) =>
        Number.isInteger(anchor.posterFrame) &&
        frameInsideRange(anchor.posterFrame as number, frameRange),
    )
    .map((anchor) => ({
      anchorId: anchor.id,
      frame: anchor.posterFrame as number,
    }));
  if (anchorFrames.length > 0) return anchorFrames;
  return [
    { anchorId: "first", frame: frameRange.startFrame },
    { anchorId: "middle", frame: middleFrame(frameRange) },
    { anchorId: "last", frame: frameRange.endFrame },
  ];
}

export function selectScrollContactSheetFrames(
  timeline: Pick<CaptureScrollTimelineV1, "anchors">,
  frameRange: ScrollHandoffPackageV1["frameRange"],
): ScrollContactSheetFrameSpec[] {
  const candidates: ScrollContactSheetFrameSpec[] = [
    { id: "first", frame: frameRange.startFrame },
    ...timeline.anchors
      .filter((anchor) => Number.isInteger(anchor.posterFrame))
      .map((anchor) => ({ id: anchor.id, frame: anchor.posterFrame as number })),
    { id: "middle", frame: middleFrame(frameRange) },
    { id: "last", frame: frameRange.endFrame },
  ];
  const selected: ScrollContactSheetFrameSpec[] = [];
  const seen = new Set<number>();
  for (const { id, frame } of candidates.sort((a, b) => a.frame - b.frame)) {
    if (!Number.isInteger(frame) || !frameInsideRange(frame, frameRange)) continue;
    if (seen.has(frame)) continue;
    seen.add(frame);
    selected.push({ id, frame });
  }
  return selected;
}

function isCaptureScrollFps(value: unknown): value is CaptureScrollTimelineV1["fps"] {
  return value === 30 || value === 60;
}

function isCaptureScrollFormat(value: unknown): value is CaptureScrollRecordFormat {
  return CAPTURE_SCROLL_OUTPUT_FORMATS.includes(value as CaptureScrollRecordFormat);
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

function isFourKOrHigher(quality: { width: number; height: number }): boolean {
  return quality.width >= 3840 || quality.height >= 2160;
}

function isExactEightK(quality: { width: number; height: number }): boolean {
  return quality.width === 7680 && quality.height === 4320;
}

function touchesEightK(quality: { width: number; height: number }): boolean {
  return quality.width >= 7680 || quality.height >= 4320;
}

function timelineDurationFrames(
  timeline: Pick<CaptureScrollTimelineV1, "durationSeconds" | "fps">,
): number {
  return Math.ceil(timeline.durationSeconds * timeline.fps);
}

function resolveCaptureScrollFrameRange(
  timeline: CaptureScrollTimelineV1,
): CaptureScrollRecordRequestV1["frameRange"] {
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

function validateCaptureScrollTimeline(timeline: unknown): CaptureValidationResult {
  const errors: string[] = [];
  if (!isRecord(timeline)) return { valid: false, errors: ["timeline must be an object."] };

  if (timeline.version !== 1) errors.push("timeline.version must be 1.");
  if (!isCaptureScrollFps(timeline.fps)) {
    errors.push("timeline.fps must be 30 or 60.");
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

export function validateScrollRecordRequest(request: unknown): CaptureValidationResult {
  const errors: string[] = [];
  if (!isRecord(request)) return { valid: false, errors: ["request must be an object."] };

  if (request.schema !== "CaptureScrollRecordRequestV1") {
    errors.push("request.schema must be CaptureScrollRecordRequestV1.");
  }
  if (request.version !== 1) errors.push("request.version must be 1.");

  const timelineValidation = validateCaptureScrollTimeline(request.timeline);
  if (!timelineValidation.valid) errors.push(...timelineValidation.errors);

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
    if (positiveInteger(request.quality.width) && positiveInteger(request.quality.height)) {
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
    if (nonNegativeInteger(startFrame) && nonNegativeInteger(endFrame) && startFrame > endFrame) {
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

function isPackageRelativePath(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  if (/^[\\/]/.test(value)) return false;
  return !value.split(/[\\/]+/).includes("..");
}

function validateNullablePackagePath(
  value: unknown,
  label: string,
  errors: string[],
): void {
  if (value === null) return;
  if (!isPackageRelativePath(value)) {
    errors.push(`${label} must be package-relative.`);
  }
}

function createScrollHandoffManifest(
  input: CreateScrollHandoffManifestInput,
): ScrollHandoffPackageV1 {
  return {
    media: [],
    frames: { directory: null, pattern: null, count: 0 },
    posters: [],
    contactSheetPath: null,
    cleanRender: scrollCleanRenderSettingsForRequest({ cleanRender: false }),
    diagnosticsPath: null,
    readmePath: null,
    hashes: [],
    warnings: [],
    ...input,
    schema: "ScrollHandoffPackageV1",
    version: 1,
  };
}

function mediaForScrollRequest(
  request: CaptureScrollRecordRequestV1,
): ScrollHandoffPackageV1["media"] {
  const mediaByFormat: Record<
    Exclude<CaptureScrollRecordFormat, "png-sequence">,
    { role: ScrollHandoffPackageV1["media"][number]["role"]; path: string; mimeType: string }
  > = {
    mp4: { role: "primary", path: "media/scroll-master.mp4", mimeType: "video/mp4" },
    webm: { role: "delivery", path: "media/scroll-master.webm", mimeType: "video/webm" },
    "scroll-friendly-video": {
      role: "scroll-friendly",
      path: "media/scroll-friendly.mp4",
      mimeType: "video/mp4",
    },
  };
  const formats =
    Array.isArray(request.formats) && request.formats.length > 0
      ? request.formats
      : [request.format];
  const media: ScrollHandoffPackageV1["media"] = [];
  const seenRoles = new Set<ScrollHandoffPackageV1["media"][number]["role"]>();
  for (const format of formats) {
    if (format === "png-sequence") continue;
    const spec = mediaByFormat[format];
    if (!spec || seenRoles.has(spec.role)) continue;
    seenRoles.add(spec.role);
    media.push({ role: spec.role, path: spec.path, mimeType: spec.mimeType });
  }
  return media;
}

/**
 * Package-relative media paths for the selected scroll formats, in render
 * order. The first entry is the primary encode produced inline by the renderer;
 * remaining video formats are encoded from the shared frame render.
 */
export function scrollMediaTargetsForRequest(
  request: CaptureScrollRecordRequestV1,
): Array<{ format: CaptureScrollRecordFormat; path: string; mimeType: string }> {
  const mediaByFormat: Record<
    Exclude<CaptureScrollRecordFormat, "png-sequence">,
    { path: string; mimeType: string }
  > = {
    mp4: { path: "media/scroll-master.mp4", mimeType: "video/mp4" },
    webm: { path: "media/scroll-master.webm", mimeType: "video/webm" },
    "scroll-friendly-video": { path: "media/scroll-friendly.mp4", mimeType: "video/mp4" },
  };
  const formats =
    Array.isArray(request.formats) && request.formats.length > 0
      ? request.formats
      : [request.format];
  const ordered = [
    request.format,
    ...formats.filter((format) => format !== request.format),
  ];
  const targets: Array<{ format: CaptureScrollRecordFormat; path: string; mimeType: string }> = [];
  const seenPaths = new Set<string>();
  for (const format of ordered) {
    if (format === "png-sequence") continue;
    const spec = mediaByFormat[format];
    if (!spec || seenPaths.has(spec.path)) continue;
    seenPaths.add(spec.path);
    targets.push({ format, path: spec.path, mimeType: spec.mimeType });
  }
  return targets;
}

export function createPendingScrollHandoffManifest(
  request: CaptureScrollRecordRequestV1,
): ScrollHandoffPackageV1 {
  const validation = validateScrollRecordRequest(request);
  if (!validation.valid) {
    throw new Error(`Invalid scroll record request: ${validation.errors.join(" ")}`);
  }
  return createScrollHandoffManifest({
    packageId: request.packageName,
    status: "partial",
    createdAt: request.createdAt,
    outputProfileId: request.timeline.outputProfileId,
    fps: request.timeline.fps,
    durationSeconds: request.timeline.durationSeconds,
    frameRange: request.frameRange,
    media: mediaForScrollRequest(request),
    frames: {
      directory: "frames",
      pattern: "frame-%06d.png",
      count: request.frameRange.totalFrames,
    },
    cleanRender: scrollCleanRenderSettingsForRequest(request),
    diagnosticsPath: `diagnostics/${request.packageName}.json`,
    sourceContract: { request },
  });
}

export function createFinalScrollHandoffManifest({
  manifest,
  status,
  media,
  frames,
  posters,
  contactSheetPath,
  cleanRender,
  diagnosticsPath,
  readmePath,
  hashes,
  warnings,
}: {
  manifest: ScrollHandoffPackageV1;
  status: Exclude<ScrollHandoffPackageStatus, "partial">;
  media?: ScrollHandoffPackageV1["media"];
  frames?: ScrollHandoffPackageV1["frames"];
  posters?: ScrollHandoffPackageV1["posters"];
  contactSheetPath?: string | null;
  cleanRender?: ScrollHandoffPackageV1["cleanRender"];
  diagnosticsPath?: string | null;
  readmePath?: string | null;
  hashes?: ScrollHandoffPackageV1["hashes"];
  warnings?: string[];
}): ScrollHandoffPackageV1 {
  return createScrollHandoffManifest({
    ...manifest,
    status,
    media: media ?? manifest.media,
    frames: frames ?? manifest.frames,
    posters: posters ?? manifest.posters,
    contactSheetPath:
      contactSheetPath === undefined ? manifest.contactSheetPath : contactSheetPath,
    cleanRender: cleanRender ?? manifest.cleanRender,
    diagnosticsPath:
      diagnosticsPath === undefined ? manifest.diagnosticsPath : diagnosticsPath,
    readmePath: readmePath === undefined ? manifest.readmePath : readmePath,
    hashes: hashes ?? manifest.hashes,
    warnings: warnings ?? manifest.warnings,
  });
}

export function validateScrollHandoffManifest(
  manifest: unknown,
): CaptureValidationResult {
  const errors: string[] = [];
  if (!isRecord(manifest)) {
    return { valid: false, errors: ["manifest must be an object."] };
  }

  if (manifest.schema !== "ScrollHandoffPackageV1") {
    errors.push("manifest.schema must be ScrollHandoffPackageV1.");
  }
  if (manifest.version !== 1) errors.push("manifest.version must be 1.");
  if (!nonEmptyString(manifest.packageId)) errors.push("manifest.packageId is required.");
  if (
    manifest.status !== "complete" &&
    manifest.status !== "partial" &&
    manifest.status !== "cancelled" &&
    manifest.status !== "failed"
  ) {
    errors.push("manifest.status must be complete, partial, cancelled, or failed.");
  }
  if (!nonEmptyString(manifest.createdAt) || Number.isNaN(Date.parse(manifest.createdAt))) {
    errors.push("manifest.createdAt must be an ISO date.");
  }
  if (!nonEmptyString(manifest.outputProfileId)) {
    errors.push("manifest.outputProfileId is required.");
  }
  if (typeof manifest.fps !== "number" || !Number.isFinite(manifest.fps) || manifest.fps <= 0) {
    errors.push("manifest.fps must be greater than zero.");
  }
  if (
    typeof manifest.durationSeconds !== "number" ||
    !Number.isFinite(manifest.durationSeconds) ||
    manifest.durationSeconds <= 0
  ) {
    errors.push("manifest.durationSeconds must be greater than zero.");
  }

  if (!isRecord(manifest.frameRange)) {
    errors.push("manifest.frameRange is required.");
  } else {
    const { startFrame, endFrame, totalFrames } = manifest.frameRange;
    if (!nonNegativeInteger(startFrame)) {
      errors.push("manifest.frameRange.startFrame must be a zero-based integer.");
    }
    if (!nonNegativeInteger(endFrame)) {
      errors.push("manifest.frameRange.endFrame must be a zero-based integer.");
    }
    if (!positiveInteger(totalFrames)) {
      errors.push("manifest.frameRange.totalFrames must be greater than zero.");
    }
    if (nonNegativeInteger(startFrame) && nonNegativeInteger(endFrame) && startFrame > endFrame) {
      errors.push("manifest.frameRange.startFrame must be before or equal to endFrame.");
    }
    if (
      nonNegativeInteger(startFrame) &&
      nonNegativeInteger(endFrame) &&
      positiveInteger(totalFrames) &&
      totalFrames !== endFrame - startFrame + 1
    ) {
      errors.push("manifest.frameRange.totalFrames must match the inclusive frame range.");
    }
  }

  if (!Array.isArray(manifest.media)) {
    errors.push("manifest.media must be an array.");
  } else {
    manifest.media.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`manifest.media[${index}] must be an object.`);
        return;
      }
      if (
        item.role !== "primary" &&
        item.role !== "delivery" &&
        item.role !== "scroll-friendly"
      ) {
        errors.push(`manifest.media[${index}].role is not supported.`);
      }
      if (!isPackageRelativePath(item.path)) {
        errors.push(`manifest.media[${index}].path must be package-relative.`);
      }
      if (!nonEmptyString(item.mimeType)) {
        errors.push(`manifest.media[${index}].mimeType is required.`);
      }
      if (
        item.byteLength !== undefined &&
        !nonNegativeInteger(item.byteLength)
      ) {
        errors.push(`manifest.media[${index}].byteLength must be a non-negative integer.`);
      }
    });
  }

  if (!isRecord(manifest.frames)) {
    errors.push("manifest.frames is required.");
  } else {
    validateNullablePackagePath(manifest.frames.directory, "manifest.frames.directory", errors);
    validateNullablePackagePath(manifest.frames.pattern, "manifest.frames.pattern", errors);
    const frameCount = manifest.frames.count;
    if (!nonNegativeInteger(frameCount)) {
      errors.push("manifest.frames.count must be a non-negative integer.");
    }
    const hasFrameSequence =
      manifest.frames.directory !== null ||
      manifest.frames.pattern !== null ||
      (nonNegativeInteger(frameCount) && frameCount > 0);
    if (
      hasFrameSequence &&
      (!isPackageRelativePath(manifest.frames.directory) ||
        !isPackageRelativePath(manifest.frames.pattern) ||
        !positiveInteger(frameCount))
    ) {
      errors.push("manifest.frames must include directory, pattern, and count for a sequence.");
    }
  }

  if (!Array.isArray(manifest.posters)) {
    errors.push("manifest.posters must be an array.");
  } else {
    manifest.posters.forEach((poster, index) => {
      if (!isRecord(poster)) {
        errors.push(`manifest.posters[${index}] must be an object.`);
        return;
      }
      if (!nonEmptyString(poster.anchorId)) {
        errors.push(`manifest.posters[${index}].anchorId is required.`);
      }
      if (!nonNegativeInteger(poster.frame)) {
        errors.push(`manifest.posters[${index}].frame must be a zero-based integer.`);
      }
      if (!isPackageRelativePath(poster.path)) {
        errors.push(`manifest.posters[${index}].path must be package-relative.`);
      }
    });
  }

  validateNullablePackagePath(manifest.contactSheetPath, "manifest.contactSheetPath", errors);
  if (!isRecord(manifest.cleanRender)) {
    errors.push("manifest.cleanRender must be an object.");
  } else {
    if (typeof manifest.cleanRender.enabled !== "boolean") {
      errors.push("manifest.cleanRender.enabled must be boolean.");
    }
    if (manifest.cleanRender.mode !== "scene-only") {
      errors.push("manifest.cleanRender.mode must be scene-only.");
    }
    if (!Array.isArray(manifest.cleanRender.hiddenGroups)) {
      errors.push("manifest.cleanRender.hiddenGroups must be an array.");
    } else {
      manifest.cleanRender.hiddenGroups.forEach((group, index) => {
        if (!nonEmptyString(group)) {
          errors.push(`manifest.cleanRender.hiddenGroups[${index}] is required.`);
        }
      });
    }
    if (!isRecord(manifest.cleanRender.exportOverlay)) {
      errors.push("manifest.cleanRender.exportOverlay must be an object.");
    } else {
      if (typeof manifest.cleanRender.exportOverlay.enabled !== "boolean") {
        errors.push("manifest.cleanRender.exportOverlay.enabled must be boolean.");
      }
      if (
        manifest.cleanRender.exportOverlay.mode !== null &&
        typeof manifest.cleanRender.exportOverlay.mode !== "string"
      ) {
        errors.push("manifest.cleanRender.exportOverlay.mode must be a string or null.");
      }
    }
  }
  validateNullablePackagePath(manifest.diagnosticsPath, "manifest.diagnosticsPath", errors);
  validateNullablePackagePath(manifest.readmePath, "manifest.readmePath", errors);

  if (!isRecord(manifest.sourceContract)) {
    errors.push("manifest.sourceContract must be an object.");
  }
  if (!Array.isArray(manifest.hashes)) {
    errors.push("manifest.hashes must be an array.");
  } else {
    manifest.hashes.forEach((hash, index) => {
      if (!isRecord(hash)) {
        errors.push(`manifest.hashes[${index}] must be an object.`);
        return;
      }
      if (!isPackageRelativePath(hash.path)) {
        errors.push(`manifest.hashes[${index}].path must be package-relative.`);
      }
      if (!nonEmptyString(hash.sha256)) {
        errors.push(`manifest.hashes[${index}].sha256 is required.`);
      }
    });
  }

  if (!Array.isArray(manifest.warnings)) {
    errors.push("manifest.warnings must be an array.");
  } else if (manifest.warnings.some((warning) => typeof warning !== "string")) {
    errors.push("manifest.warnings must contain only strings.");
  }

  if (manifest.status === "complete") {
    const mediaCount = Array.isArray(manifest.media) ? manifest.media.length : 0;
    const hasFrameSequence =
      isRecord(manifest.frames) &&
      isPackageRelativePath(manifest.frames.directory) &&
      isPackageRelativePath(manifest.frames.pattern) &&
      positiveInteger(manifest.frames.count);
    if (mediaCount === 0 && !hasFrameSequence) {
      errors.push("complete scroll handoff packages require media or a frame sequence.");
    }
  }

  return { valid: errors.length === 0, errors };
}
