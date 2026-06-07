import type { CaptureFps } from "./captureTypes";

export type CaptureScope = "current-page" | "page-range";

export type CapturePageRangeTiming = "authored" | "equal-holds";

export interface CapturePageRangePage {
  id: string;
  title: string;
  hidden?: boolean;
  transition?: {
    duration?: number;
    easing?: string;
  };
  holdDuration?: number;
}

export interface CapturePageRangeState {
  captureScope: CaptureScope;
  pageRangeStartId: string | null;
  pageRangeEndId: string | null;
  pageRangeTiming: CapturePageRangeTiming;
  equalHoldSeconds: number | null;
}

export interface CapturePageRangeResolution {
  valid: boolean;
  errors: string[];
  pages: CapturePageRangePage[];
  pageIds: string[];
  durationSeconds: number;
  totalFrames: number;
  segmentDurationsSeconds: number[];
}

export const CAPTURE_SCOPE_LABELS: Record<CaptureScope, string> = {
  "current-page": "Current Page",
  "page-range": "Page Range",
};

export const CAPTURE_PAGE_RANGE_TIMING_LABELS: Record<
  CapturePageRangeTiming,
  string
> = {
  authored: "Authored Timing",
  "equal-holds": "Equal Holds",
};

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function durationMs(value: unknown): number {
  return finiteNonNegative(value) ? value : 0;
}

function authoredSegmentDurationSeconds(
  page: CapturePageRangePage,
  index: number,
): number {
  const holdMs = durationMs(page.holdDuration);
  const transitionMs = index === 0 ? 0 : durationMs(page.transition?.duration);
  return (transitionMs + holdMs) / 1000;
}

export function visibleCapturePages(
  pages: readonly CapturePageRangePage[],
): CapturePageRangePage[] {
  return pages.filter((page) => page.hidden !== true);
}

export function resolveCapturePageRange({
  pages,
  currentPageId,
  captureScope,
  pageRangeStartId,
  pageRangeEndId,
  pageRangeTiming,
  equalHoldSeconds,
  fps,
  currentPageDurationSeconds,
}: CapturePageRangeState & {
  pages: readonly CapturePageRangePage[];
  currentPageId: string | null;
  fps: CaptureFps;
  currentPageDurationSeconds: number;
}): CapturePageRangeResolution {
  const errors: string[] = [];
  const visiblePages = visibleCapturePages(pages);
  const visibleIds = visiblePages.map((page) => page.id);

  if (captureScope !== "current-page" && captureScope !== "page-range") {
    errors.push("captureScope must be current-page or page-range.");
  }
  if (pageRangeTiming !== "authored" && pageRangeTiming !== "equal-holds") {
    errors.push("pageRangeTiming must be authored or equal-holds.");
  }
  if (
    equalHoldSeconds !== null &&
    (!Number.isFinite(equalHoldSeconds) || equalHoldSeconds <= 0)
  ) {
    errors.push("equalHoldSeconds must be greater than zero when provided.");
  }

  if (captureScope === "current-page") {
    const current =
      visiblePages.find((page) => page.id === currentPageId) ?? visiblePages[0];
    const durationSeconds =
      Number.isFinite(currentPageDurationSeconds) && currentPageDurationSeconds > 0
        ? currentPageDurationSeconds
        : 0;
    const totalFrames = Math.max(1, Math.ceil(durationSeconds * fps));
    return {
      valid: errors.length === 0 && !!current,
      errors: current ? errors : [...errors, "A visible current page is required."],
      pages: current ? [current] : [],
      pageIds: current ? [current.id] : [],
      durationSeconds,
      totalFrames,
      segmentDurationsSeconds: current ? [durationSeconds] : [],
    };
  }

  if (!pageRangeStartId || !visibleIds.includes(pageRangeStartId)) {
    errors.push("pageRangeStartId must reference a visible presentation page.");
  }
  if (!pageRangeEndId || !visibleIds.includes(pageRangeEndId)) {
    errors.push("pageRangeEndId must reference a visible presentation page.");
  }

  const startIndex = pageRangeStartId ? visibleIds.indexOf(pageRangeStartId) : -1;
  const endIndex = pageRangeEndId ? visibleIds.indexOf(pageRangeEndId) : -1;
  if (startIndex >= 0 && endIndex >= 0 && startIndex > endIndex) {
    errors.push("Page Range start must be before or equal to the end page.");
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      pages: [],
      pageIds: [],
      durationSeconds: 0,
      totalFrames: 0,
      segmentDurationsSeconds: [],
    };
  }

  const rangePages = visiblePages.slice(startIndex, endIndex + 1);
  const segmentDurationsSeconds =
    pageRangeTiming === "equal-holds"
      ? rangePages.map(() => equalHoldSeconds ?? 1)
      : rangePages.map(authoredSegmentDurationSeconds);
  const durationSeconds = segmentDurationsSeconds.reduce(
    (total, duration) => total + duration,
    0,
  );
  const totalFrames = segmentDurationsSeconds.reduce(
    (total, duration) => total + Math.max(1, Math.ceil(duration * fps)),
    0,
  );

  return {
    valid: true,
    errors: [],
    pages: rangePages,
    pageIds: rangePages.map((page) => page.id),
    durationSeconds,
    totalFrames,
    segmentDurationsSeconds,
  };
}
