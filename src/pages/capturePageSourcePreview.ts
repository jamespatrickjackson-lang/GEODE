import type { CaptureTimelineTransitionEasing } from "../capture/captureTimeline";
import type { PresentationPage } from "./types";

export type CapturePageSourcePreviewReason =
  | "capture-scroll-preview"
  | "capture-scroll-record";

export interface CapturePageSourcePreviewSample {
  sourcePageId: string | null;
  targetPageId: string | null;
  transitionProgress: number;
  transitionEasing: CaptureTimelineTransitionEasing;
  reason: CapturePageSourcePreviewReason;
}

export interface CapturePageSourcePreviewDebugState {
  active: boolean;
  reason: CapturePageSourcePreviewReason;
  lastSample: CapturePageSourcePreviewSample | null;
  selectedCurrentPageId: string | null;
  resolvedSourcePageId: string | null;
  resolvedTargetPageId: string | null;
  appliedPageId: string | null;
  transitionActive: boolean;
  transitionProgress: number;
  transitionEasing: CaptureTimelineTransitionEasing;
  fallbackMode: "current-page" | "none";
  missingPageIds: string[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pageById(
  pages: PresentationPage[],
  pageId: string | null,
): PresentationPage | null {
  if (!pageId) return null;
  return pages.find((page) => page.id === pageId) ?? null;
}

export function resolveCapturePageSourcePreview({
  sample,
  pages,
  currentIndex,
}: {
  sample: CapturePageSourcePreviewSample;
  pages: PresentationPage[];
  currentIndex: number;
}): CapturePageSourcePreviewDebugState {
  const selectedCurrentPage = pages[currentIndex] ?? null;
  const sourcePage = pageById(pages, sample.sourcePageId);
  const targetPage = pageById(pages, sample.targetPageId);
  const missingPageIds = [sample.sourcePageId, sample.targetPageId].filter(
    (pageId): pageId is string =>
      typeof pageId === "string" &&
      pageId.length > 0 &&
      !pageById(pages, pageId),
  );
  const transitionProgress = clamp01(sample.transitionProgress);
  const transitionActive =
    Boolean(sourcePage && targetPage && sourcePage.id !== targetPage.id) &&
    transitionProgress < 1;
  const appliedPage = transitionActive
    ? sourcePage
    : targetPage ?? sourcePage ?? selectedCurrentPage;
  const resolvedSample: CapturePageSourcePreviewSample = {
    ...sample,
    transitionProgress,
  };

  return {
    active: true,
    reason: sample.reason,
    lastSample: resolvedSample,
    selectedCurrentPageId: selectedCurrentPage?.id ?? null,
    resolvedSourcePageId: sourcePage?.id ?? null,
    resolvedTargetPageId: targetPage?.id ?? null,
    appliedPageId: appliedPage?.id ?? null,
    transitionActive,
    transitionProgress,
    transitionEasing: sample.transitionEasing,
    fallbackMode:
      sample.sourcePageId || sample.targetPageId ? "none" : "current-page",
    missingPageIds,
  };
}

export function clearCapturePageSourcePreviewDebugState(
  previous: CapturePageSourcePreviewDebugState | null,
  selectedCurrentPageId: string | null,
): CapturePageSourcePreviewDebugState {
  return {
    active: false,
    reason: previous?.reason ?? "capture-scroll-preview",
    lastSample: previous?.lastSample ?? null,
    selectedCurrentPageId,
    resolvedSourcePageId: previous?.resolvedSourcePageId ?? null,
    resolvedTargetPageId: previous?.resolvedTargetPageId ?? null,
    appliedPageId: selectedCurrentPageId,
    transitionActive: false,
    transitionProgress: previous?.transitionProgress ?? 1,
    transitionEasing: previous?.transitionEasing ?? "ease-in-out",
    fallbackMode: previous?.fallbackMode ?? "current-page",
    missingPageIds: previous?.missingPageIds ?? [],
  };
}
