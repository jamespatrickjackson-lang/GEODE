import type { CaptureCameraPathV2Timeline } from "./captureCameraPathV2";

export type CapturePathTimeCurveMode =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "custom-ramp";

export type CapturePathContinuity = "G0" | "G1" | "G2" | "G3";

export type CapturePathFocusMode =
  | "free-direction"
  | "follow-path-tangent"
  | "focus-point-lock"
  | "target-blend";

export interface CapturePathTimeCurvePoint {
  t: number;
  value: number;
}

export interface CapturePathTimeCurve {
  mode: CapturePathTimeCurveMode;
  ramp?: CapturePathTimeCurvePoint[];
}

export interface CapturePathTimelineBlockLayout {
  id: string;
  kind: "hold" | "transition";
  leftPercent: number;
  widthPercent: number;
  startSeconds: number;
  durationSeconds: number;
  timeCurve: CapturePathTimeCurve;
  continuity: CapturePathContinuity;
  gdStartPercent: number;
  gdEndPercent: number;
  focusMode: CapturePathFocusMode;
  equationVisible: boolean;
  nodeId?: string;
  segmentId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function clampPercent(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : fallback;
}

function normalizeContinuity(value: unknown): CapturePathContinuity {
  return value === "G0" || value === "G2" || value === "G3" ? value : "G1";
}

function normalizeFocusMode(value: unknown): CapturePathFocusMode {
  return value === "follow-path-tangent" ||
    value === "focus-point-lock" ||
    value === "target-blend"
    ? value
    : "free-direction";
}

function normalizeTimeCurve(
  value: unknown,
  easing: unknown,
): CapturePathTimeCurve {
  const fallbackMode = easing === "ease-in-out" ? "ease-in-out" : "linear";
  if (!isRecord(value)) return { mode: fallbackMode };
  const mode =
    value.mode === "linear" ||
    value.mode === "ease-in" ||
    value.mode === "ease-out" ||
    value.mode === "ease-in-out" ||
    value.mode === "custom-ramp"
      ? value.mode
      : fallbackMode;
  const ramp = Array.isArray(value.ramp)
    ? value.ramp
        .filter(isRecord)
        .map((point) => ({
          t: clampPercent(
            typeof point.t === "number" ? point.t * 100 : point.t,
            0,
          ) / 100,
          value:
            typeof point.value === "number" && Number.isFinite(point.value)
              ? Math.max(0, Math.min(1, point.value))
              : 0,
        }))
        .sort((a, b) => a.t - b.t)
    : undefined;
  return ramp && ramp.length > 0 ? { mode, ramp } : { mode };
}

export function layoutCapturePathTimeline({
  minBlockPercent = 0.8,
  timeline,
}: {
  timeline: CaptureCameraPathV2Timeline;
  minBlockPercent?: number;
}): CapturePathTimelineBlockLayout[] {
  const duration = Math.max(0.1, timeline.durationSeconds);
  return timeline.entries.map((entry, index) => {
    const id =
      entry.kind === "hold"
        ? `hold:${entry.nodeId ?? index}`
        : `transition:${entry.segmentId ?? index}`;
    const leftPercent = Math.max(0, Math.min(100, (entry.startSeconds / duration) * 100));
    const naturalWidth = Math.max(0, (entry.durationSeconds / duration) * 100);
    const metadata = entry as unknown as Record<string, unknown>;
    const pathFairing = isRecord(metadata.pathFairing) ? metadata.pathFairing : {};
    const aimGeometry = isRecord(metadata.aimGeometry) ? metadata.aimGeometry : {};
    const equationOptions = isRecord(metadata.equationOptions)
      ? metadata.equationOptions
      : {};
    const gdStartPercent = clampPercent(metadata.gdStartPercent, 0);
    const gdEndPercent = clampPercent(metadata.gdEndPercent, 100);
    return {
      id,
      kind: entry.kind,
      leftPercent,
      widthPercent: Math.min(100 - leftPercent, Math.max(minBlockPercent, naturalWidth)),
      startSeconds: entry.startSeconds,
      durationSeconds: entry.durationSeconds,
      timeCurve: normalizeTimeCurve(metadata.timeCurve, entry.easing),
      continuity: normalizeContinuity(metadata.continuity ?? pathFairing.continuity),
      gdStartPercent: Math.min(gdStartPercent, gdEndPercent),
      gdEndPercent: Math.max(gdStartPercent, gdEndPercent),
      focusMode: normalizeFocusMode(
        metadata.focusMode ?? aimGeometry.mode ?? metadata.lookMode,
      ),
      equationVisible:
        metadata.equationVisible === true || equationOptions.visible === true,
      nodeId: entry.nodeId,
      segmentId: entry.segmentId,
    };
  });
}
