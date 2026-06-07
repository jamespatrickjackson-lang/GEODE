import type { Pose } from "../pages/types";
import type { CapturePageRangeTiming } from "./capturePageRange";
import {
  poseFromCaptureCameraPathKeyframe,
  sampleCaptureCameraPath,
  type CaptureCameraPathV1,
} from "./captureCameraPath";
import {
  sampleCaptureCameraPathV2,
  type CaptureCameraPathV2,
} from "./captureCameraPathV2";
import {
  sampleCaptureCameraPathV3,
  type CaptureCameraPathV3,
} from "./captureCameraPathV3";

export type CaptureTimelineClipKind =
  | "page"
  | "camera-hold"
  | "camera-transition";

export type CaptureTimelineTrack = "pages" | "camera-path" | "time-graph";

export type CaptureTimelineTransitionEasing = "linear" | "ease-in-out";

export interface CaptureTimelinePageSource {
  id: string;
  title?: string;
  name?: string;
  hidden?: boolean;
  camera?: Pose;
  transition?: {
    duration?: number;
    easing?: string;
  };
  holdDuration?: number;
}

export interface CaptureTimelinePageClip {
  id: string;
  pageId: string;
  label: string;
  enabled: boolean;
  locked: boolean;
  startSeconds: number;
  holdSeconds: number;
  transitionSeconds: number;
  transitionEasing: CaptureTimelineTransitionEasing;
}

export interface CaptureTimelineState {
  version: 1;
  pageClips: CaptureTimelinePageClip[];
  selectedPageClipId: string | null;
  diagnosticsVisible: boolean;
}

export interface CaptureTimelineSample {
  timeSeconds: number;
  page: {
    clipId: string | null;
    pageId: string | null;
    localTimeSeconds: number;
    transitionProgress: number;
    transitionEasing: CaptureTimelineTransitionEasing;
  };
  camera: {
    source: "camera-path" | "page-camera" | "current-camera";
    pose: Pose | null;
  };
}

export interface CaptureTimelinePageClipLayout extends CaptureTimelinePageClip {
  endSeconds: number;
  durationSeconds: number;
  leftPercent: number;
  widthPercent: number;
}

export interface CaptureTimelineLayout {
  durationSeconds: number;
  pageClips: CaptureTimelinePageClipLayout[];
}

export interface CaptureTimelineValidationResult {
  valid: boolean;
  errors: string[];
}

export type CaptureTimelineCameraPath =
  | CaptureCameraPathV1
  | CaptureCameraPathV2
  | CaptureCameraPathV3;

const MIN_PAGE_HOLD_SECONDS = 0;
const MIN_PAGE_TRANSITION_SECONDS = 0.1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeEasing(value: unknown): CaptureTimelineTransitionEasing {
  return value === "linear" ? "linear" : "ease-in-out";
}

function pageLabel(page: CaptureTimelinePageSource): string {
  const label = page.title ?? page.name ?? page.id;
  return label.trim() || page.id;
}

function pageHoldSeconds(
  page: CaptureTimelinePageSource,
  timing: CapturePageRangeTiming,
  equalHoldSeconds?: number | null,
): number {
  if (timing === "equal-holds") {
    return Math.max(MIN_PAGE_HOLD_SECONDS, equalHoldSeconds ?? 1);
  }
  return Math.max(MIN_PAGE_HOLD_SECONDS, finiteNumber(page.holdDuration, 0) / 1000);
}

function pageTransitionSeconds(
  page: CaptureTimelinePageSource,
  timing: CapturePageRangeTiming,
): number {
  if (timing === "equal-holds") return MIN_PAGE_TRANSITION_SECONDS;
  const authored = finiteNumber(page.transition?.duration, 0) / 1000;
  return authored > 0 ? Math.max(MIN_PAGE_TRANSITION_SECONDS, authored) : 0;
}

function clipDuration(clip: CaptureTimelinePageClip): number {
  return Math.max(0, clip.transitionSeconds) + Math.max(0, clip.holdSeconds);
}

function visiblePages(
  pages: readonly CaptureTimelinePageSource[],
): CaptureTimelinePageSource[] {
  return pages.filter((page) => page.hidden !== true);
}

function normalizePageClips(
  clips: readonly Partial<CaptureTimelinePageClip>[],
): CaptureTimelinePageClip[] {
  let cursor = 0;
  return clips.map((clip, index) => {
    const pageId =
      typeof clip.pageId === "string" && clip.pageId.trim()
        ? clip.pageId.trim()
        : `page-${index + 1}`;
    const transitionSeconds = Math.max(
      0,
      finiteNumber(clip.transitionSeconds, 0),
    );
    const holdSeconds = Math.max(
      MIN_PAGE_HOLD_SECONDS,
      finiteNumber(clip.holdSeconds, 1),
    );
    const normalized: CaptureTimelinePageClip = {
      id:
        typeof clip.id === "string" && clip.id.trim()
          ? clip.id.trim()
          : `page:${pageId}:${index + 1}`,
      pageId,
      label:
        typeof clip.label === "string" && clip.label.trim()
          ? clip.label.trim()
          : pageId,
      enabled: clip.enabled !== false,
      locked: clip.locked === true,
      startSeconds: cursor,
      transitionSeconds,
      holdSeconds,
      transitionEasing: normalizeEasing(clip.transitionEasing),
    };
    cursor += clipDuration(normalized);
    return normalized;
  });
}

export function createPageClipFromPresentationPage(
  page: CaptureTimelinePageSource,
  options: {
    startSeconds?: number;
    timing?: CapturePageRangeTiming;
    equalHoldSeconds?: number | null;
    id?: string;
    index?: number;
  } = {},
): CaptureTimelinePageClip {
  const timing = options.timing ?? "authored";
  return {
    id:
      options.id ??
      `page:${page.id}:${Math.max(0, Math.round((options.startSeconds ?? 0) * 1000))}`,
    pageId: page.id,
    label: pageLabel(page),
    enabled: true,
    locked: false,
    startSeconds: Math.max(0, options.startSeconds ?? 0),
    holdSeconds: pageHoldSeconds(page, timing, options.equalHoldSeconds),
    transitionSeconds: pageTransitionSeconds(page, timing),
    transitionEasing: normalizeEasing(page.transition?.easing),
  };
}

export function createPageClipsFromRange(
  pages: readonly CaptureTimelinePageSource[],
  startId: string,
  endId: string,
  options: {
    timing?: CapturePageRangeTiming;
    equalHoldSeconds?: number | null;
  } = {},
): CaptureTimelinePageClip[] {
  const ordered = visiblePages(pages);
  const startIndex = ordered.findIndex((page) => page.id === startId);
  const endIndex = ordered.findIndex((page) => page.id === endId);
  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) return [];
  let cursor = 0;
  return ordered.slice(startIndex, endIndex + 1).map((page, index) => {
    const clip = createPageClipFromPresentationPage(page, {
      timing: options.timing ?? "authored",
      equalHoldSeconds: options.equalHoldSeconds,
      startSeconds: cursor,
      id: `page:${page.id}:${index + 1}`,
      index,
    });
    cursor += clipDuration(clip);
    return clip;
  });
}

export function normalizeCaptureTimelineState(
  input: unknown,
): CaptureTimelineState {
  const record = isRecord(input) ? input : {};
  const pageClips = Array.isArray(record.pageClips)
    ? normalizePageClips(record.pageClips as Partial<CaptureTimelinePageClip>[])
    : [];
  const selectedPageClipId =
    typeof record.selectedPageClipId === "string" &&
    pageClips.some((clip) => clip.id === record.selectedPageClipId)
      ? record.selectedPageClipId
      : null;
  return {
    version: 1,
    pageClips,
    selectedPageClipId,
    diagnosticsVisible: record.diagnosticsVisible === true,
  };
}

export function validateCaptureTimelineState(
  state: CaptureTimelineState,
  pages: readonly CaptureTimelinePageSource[],
): CaptureTimelineValidationResult {
  const errors: string[] = [];
  const visibleIds = new Set(visiblePages(pages).map((page) => page.id));
  const seenIds = new Set<string>();
  for (const [index, clip] of state.pageClips.entries()) {
    if (seenIds.has(clip.id)) {
      errors.push(`pageClips[${index}].id must be unique.`);
    }
    seenIds.add(clip.id);
    if (!visibleIds.has(clip.pageId)) {
      errors.push(`pageClips[${index}].pageId must reference a visible page.`);
    }
    if (!Number.isFinite(clip.startSeconds) || clip.startSeconds < 0) {
      errors.push(`pageClips[${index}].startSeconds must be non-negative.`);
    }
    if (!Number.isFinite(clip.holdSeconds) || clip.holdSeconds < 0) {
      errors.push(`pageClips[${index}].holdSeconds must be non-negative.`);
    }
    if (!Number.isFinite(clip.transitionSeconds) || clip.transitionSeconds < 0) {
      errors.push(`pageClips[${index}].transitionSeconds must be non-negative.`);
    }
    if (
      clip.transitionEasing !== "linear" &&
      clip.transitionEasing !== "ease-in-out"
    ) {
      errors.push(`pageClips[${index}].transitionEasing is not supported.`);
    }
  }
  if (
    state.selectedPageClipId !== null &&
    !state.pageClips.some((clip) => clip.id === state.selectedPageClipId)
  ) {
    errors.push("selectedPageClipId must reference an existing page clip.");
  }
  return { valid: errors.length === 0, errors };
}

export function resolveCaptureTimelineLayout(
  state: CaptureTimelineState,
): CaptureTimelineLayout {
  const pageClips = normalizePageClips(state.pageClips).map((clip) => ({
    ...clip,
    durationSeconds: clipDuration(clip),
    endSeconds: clip.startSeconds + clipDuration(clip),
    leftPercent: 0,
    widthPercent: 0,
  }));
  const durationSeconds = pageClips.reduce(
    (max, clip) => Math.max(max, clip.endSeconds),
    0,
  );
  const safeDuration = Math.max(0.1, durationSeconds);
  return {
    durationSeconds,
    pageClips: pageClips.map((clip) => ({
      ...clip,
      leftPercent: (clip.startSeconds / safeDuration) * 100,
      widthPercent: Math.max(0.6, (clip.durationSeconds / safeDuration) * 100),
    })),
  };
}

function pageClipAtTime(
  state: CaptureTimelineState,
  timeSeconds: number,
): CaptureTimelinePageClip | null {
  const enabled = normalizePageClips(state.pageClips).filter(
    (clip) => clip.enabled,
  );
  if (enabled.length === 0) return null;
  const clampedTime = Math.max(0, timeSeconds);
  return (
    enabled.find((clip) => {
      const start = clip.startSeconds;
      const end = start + clipDuration(clip);
      return clampedTime >= start && clampedTime < end;
    }) ?? enabled[enabled.length - 1]
  );
}

function clonePose(pose: Pose | null | undefined): Pose | null {
  if (!pose) return null;
  return {
    position: [...pose.position],
    target: [...pose.target],
    up: [...pose.up],
    fov: pose.fov,
  };
}

function sampleCameraPathPose(
  path: CaptureTimelineCameraPath | null,
  timeSeconds: number,
): Pose | null {
  if (!path) return null;
  if (path.version === 1) {
    return poseFromCaptureCameraPathKeyframe(
      sampleCaptureCameraPath(path, timeSeconds),
    );
  }
  if (path.version === 2) {
    return poseFromCaptureCameraPathKeyframe(
      sampleCaptureCameraPathV2(path, timeSeconds),
    );
  }
  return poseFromCaptureCameraPathKeyframe(
    sampleCaptureCameraPathV3(path, timeSeconds),
  );
}

function findInternalPageBoundary(
  clips: readonly CaptureTimelinePageClip[],
  boundaryId: string,
): { leftIndex: number; rightIndex: number } | null {
  for (let index = 0; index < clips.length - 1; index += 1) {
    const left = clips[index];
    const right = clips[index + 1];
    if (boundaryId === `page:${left.id}:${right.id}`) {
      return { leftIndex: index, rightIndex: index + 1 };
    }
  }
  return null;
}

export function sampleCaptureTimeline({
  state,
  pages,
  cameraPath,
  currentPage,
  currentCamera,
  timeSeconds,
}: {
  state: CaptureTimelineState;
  pages: readonly CaptureTimelinePageSource[];
  cameraPath: CaptureTimelineCameraPath | null;
  currentPage: CaptureTimelinePageSource | null;
  currentCamera: Pose | null;
  timeSeconds: number;
}): CaptureTimelineSample {
  const normalized = normalizeCaptureTimelineState(state);
  const clip = pageClipAtTime(normalized, timeSeconds);
  const page =
    clip && clip.enabled
      ? pages.find((entry) => entry.id === clip.pageId) ?? null
      : currentPage;
  const localTimeSeconds = clip
    ? Math.max(0, timeSeconds - clip.startSeconds)
    : Math.max(0, timeSeconds);
  const transitionProgress =
    clip && clip.transitionSeconds > 0
      ? clamp(localTimeSeconds / clip.transitionSeconds, 0, 1)
      : 1;
  const pathPose = sampleCameraPathPose(cameraPath, timeSeconds);
  return {
    timeSeconds,
    page: {
      clipId: clip?.id ?? null,
      pageId: page?.id ?? null,
      localTimeSeconds,
      transitionProgress,
      transitionEasing: clip?.transitionEasing ?? "ease-in-out",
    },
    camera: pathPose
      ? { source: "camera-path", pose: pathPose }
      : page?.camera
        ? { source: "page-camera", pose: clonePose(page.camera) }
        : { source: "current-camera", pose: clonePose(currentCamera) },
  };
}

export function resizeCaptureTimelineBoundary({
  state,
  boundaryId,
  deltaSeconds,
}: {
  state: CaptureTimelineState;
  boundaryId: string;
  deltaSeconds: number;
}): CaptureTimelineState {
  const normalized = normalizeCaptureTimelineState(state);
  if (!Number.isFinite(deltaSeconds) || deltaSeconds === 0) return normalized;
  const clips = normalized.pageClips.map((clip) => ({ ...clip }));

  if (boundaryId.startsWith("page-end:")) {
    const clipId = boundaryId.slice("page-end:".length);
    const index = clips.findIndex((clip) => clip.id === clipId);
    if (index < 0 || clips[index].locked) return normalized;
    const clip = clips[index];
    const nextTotal = Math.max(
      clip.transitionSeconds + MIN_PAGE_HOLD_SECONDS,
      clipDuration(clip) + deltaSeconds,
    );
    clip.holdSeconds = Math.max(
      MIN_PAGE_HOLD_SECONDS,
      nextTotal - clip.transitionSeconds,
    );
    return normalizeCaptureTimelineState({ ...normalized, pageClips: clips });
  }

  const boundary = findInternalPageBoundary(clips, boundaryId);
  if (!boundary) return normalized;
  const { leftIndex, rightIndex } = boundary;
  if (
    leftIndex < 0 ||
    rightIndex < 0 ||
    clips[leftIndex].locked ||
    clips[rightIndex].locked
  ) {
    return normalized;
  }
  const left = clips[leftIndex];
  const right = clips[rightIndex];
  const leftMin = left.transitionSeconds + MIN_PAGE_HOLD_SECONDS;
  const rightMin = right.transitionSeconds + MIN_PAGE_HOLD_SECONDS;
  const leftTotal = clipDuration(left);
  const rightTotal = clipDuration(right);
  const pairTotal = leftTotal + rightTotal;
  const nextLeftTotal = clamp(
    leftTotal + deltaSeconds,
    leftMin,
    Math.max(leftMin, pairTotal - rightMin),
  );
  const nextRightTotal = pairTotal - nextLeftTotal;
  left.holdSeconds = Math.max(MIN_PAGE_HOLD_SECONDS, nextLeftTotal - left.transitionSeconds);
  right.holdSeconds = Math.max(
    MIN_PAGE_HOLD_SECONDS,
    nextRightTotal - right.transitionSeconds,
  );
  return normalizeCaptureTimelineState({ ...normalized, pageClips: clips });
}
