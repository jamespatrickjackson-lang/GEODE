// Pure plan-math for the Capture Director scroll/Page-Bar runtime drive.
//
// Extracted from `buildScrollRecordPlan` so the decisions that gate Page Bar
// runtime drive are unit-testable and page-agnostic (DEC-175):
//
// - PREVIEW/drive works with or without a Camera Path. Its clock is the Camera
//   Path duration when a valid path exists, otherwise the Page Bar duration, so
//   a path-free Page Bar drives the full page sequence. Camera authority is the
//   Camera Path when valid, else the current/live camera (page cameras never
//   drive in this workflow).
// - EXPORT/record stays camera-spine-led: its clock is bound to the Camera Path
//   duration. A Page Bar longer than the path is CLIPPED to the clock (tail
//   clips dropped/trimmed) rather than rejected.
//
// `clipScrollClipsToClock` keeps `validateCaptureScrollTimeline` satisfied
// (which rejects clips extending past `durationSeconds`) while realizing the
// clip-not-reject behavior.

export type CaptureScrollPlanIntent = "preview" | "export";

export const MIN_SCROLL_PLAN_DURATION_SECONDS = 0.1;

export interface ScrollPlanClockInput {
  intent: CaptureScrollPlanIntent;
  hasValidPath: boolean;
  /** Camera Path timeline duration; 0 when there is no valid path. */
  pathDurationSeconds: number;
  /** Max enabled Page Bar clip end; 0 when there are no enabled clips. */
  pageBarDurationSeconds: number;
}

export interface ScrollPlanClock {
  durationSeconds: number;
  cameraMode: "camera-path" | "current-camera";
}

function safeSeconds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Resolve the scroll clock duration and the camera source mode for a plan
 * intent. Preview uses the Page Bar clock when no valid path exists; export is
 * always bound to the Camera Path.
 */
export function resolveScrollPlanClock(input: ScrollPlanClockInput): ScrollPlanClock {
  const pathDuration = safeSeconds(input.pathDurationSeconds);
  const pageBarDuration = safeSeconds(input.pageBarDurationSeconds);
  if (input.intent === "export") {
    return {
      durationSeconds: Math.max(MIN_SCROLL_PLAN_DURATION_SECONDS, pathDuration),
      cameraMode: "camera-path",
    };
  }
  return {
    durationSeconds: Math.max(
      MIN_SCROLL_PLAN_DURATION_SECONDS,
      input.hasValidPath ? pathDuration : pageBarDuration,
    ),
    cameraMode: input.hasValidPath ? "camera-path" : "current-camera",
  };
}

/**
 * Whether a plan has anything to drive/render. Preview needs clips or a valid
 * path; export is camera-spine-led and needs a valid path (clips optional —
 * empty clips fall back to current-page capture).
 */
export function scrollPlanHasContent(input: {
  intent: CaptureScrollPlanIntent;
  hasEnabledClips: boolean;
  hasValidPath: boolean;
}): boolean {
  return input.intent === "export"
    ? input.hasValidPath
    : input.hasEnabledClips || input.hasValidPath;
}

/**
 * Clip Page Bar clips to the scroll clock so none extend past `durationSeconds`.
 * Clips starting at/after the clock end are dropped; a clip straddling the end
 * has its transition then hold trimmed so it ends exactly at the clock. Clips
 * fully inside the clock pass through unchanged. This realizes the
 * clip-not-reject contract while keeping the timeline valid.
 */
export function clipScrollClipsToClock<
  T extends { startSeconds: number; transitionSeconds: number; holdSeconds: number },
>(clips: readonly T[], durationSeconds: number): T[] {
  const limit = Math.max(0, durationSeconds);
  const out: T[] = [];
  for (const clip of clips) {
    if (!Number.isFinite(clip.startSeconds) || clip.startSeconds >= limit - 1e-6) {
      continue;
    }
    const room = limit - clip.startSeconds;
    const transitionSeconds = Math.max(0, Math.min(safeSeconds(clip.transitionSeconds), room));
    const holdSeconds = Math.max(
      0,
      Math.min(safeSeconds(clip.holdSeconds), room - transitionSeconds),
    );
    out.push({ ...clip, transitionSeconds, holdSeconds });
  }
  return out;
}
