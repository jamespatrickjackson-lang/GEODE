import { useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type {
  CaptureCameraPathV2,
  CaptureCameraPathV2Timeline,
} from "./captureCameraPathV2";
import type {
  CaptureCameraPathV3,
  CaptureCameraPathV3Timeline,
} from "./captureCameraPathV3";
import { layoutCapturePathTimeline } from "./cameraPathTimelineLayout";
import {
  resolveCaptureTimelineLayout,
  type CaptureTimelineState,
  type CaptureTimelineTrack,
} from "./captureTimeline";

const rootStyle: CSSProperties = {
  position: "absolute",
  left: 24,
  right: 86,
  bottom: 18,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  gap: 10,
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(12, 15, 19, 0.68)",
  boxShadow: "0 18px 54px rgba(0,0,0,0.34)",
  backdropFilter: "blur(18px) saturate(150%)",
  pointerEvents: "none",
  zIndex: 36,
};

const spineShellStyle: CSSProperties = {
  position: "relative",
  height: 18,
  display: "flex",
  alignItems: "center",
  minWidth: 0,
};

const spineTrackStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: 10,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.28)",
  background: "rgba(232,235,236,0.72)",
  boxShadow: "inset 0 1px 1px rgba(255,255,255,0.22)",
  overflow: "hidden",
};

const spineProgressStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  background: "rgba(39,42,47,0.22)",
};

const spineThumbStyle: CSSProperties = {
  position: "absolute",
  top: 1,
  width: 24,
  height: 8,
  borderRadius: 3,
  background: "rgba(80,82,86,0.42)",
  transform: "translateX(-50%)",
  pointerEvents: "none",
};

const spineRangeInputStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: 18,
  opacity: 0,
  cursor: "pointer",
};

const buttonStyle: CSSProperties = {
  height: 30,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.94)",
  padding: "0 11px",
  fontWeight: 680,
  fontSize: 12,
  cursor: "pointer",
};

const addCameraIconStyle: CSSProperties = {
  color: "rgba(255,255,255,0.94)",
  fontSize: 18,
  fontWeight: 760,
  lineHeight: 1,
  transform: "translateY(-1px)",
};

const timelinePlayIconStyle: CSSProperties = {
  width: 0,
  height: 0,
  borderTop: "6px solid transparent",
  borderBottom: "6px solid transparent",
  borderLeft: "9px solid rgba(255,255,255,0.94)",
  marginLeft: 2,
};

const timelinePauseIconStyle: CSSProperties = {
  width: 10,
  height: 12,
  borderLeft: "4px solid rgba(255,255,255,0.94)",
  borderRight: "4px solid rgba(255,255,255,0.94)",
};

const pageLaneContentOffsetPx = 36;

const pageLaneAddButtonStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: pageLaneContentOffsetPx,
  border: 0,
  borderRight: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "6px 0 0 6px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
  color: "rgba(255,255,255,0.94)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  cursor: "pointer",
};

const pageLaneContentStyle: CSSProperties = {
  position: "absolute",
  left: pageLaneContentOffsetPx,
  right: 0,
  top: 0,
  bottom: 0,
  overflow: "hidden",
};

const pageAddMenuStyle: CSSProperties = {
  position: "absolute",
  left: pageLaneContentOffsetPx + 6,
  top: 3,
  zIndex: 4,
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "2px 5px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(18,22,26,0.9)",
  boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
};

const pageAddMenuButtonStyle: CSSProperties = {
  ...buttonStyle,
  height: 22,
  padding: "0 8px",
  fontSize: 11,
};

const cameraPathLaneContentOffsetPx = 36;

const cameraPathLaneAddButtonStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  width: cameraPathLaneContentOffsetPx,
  border: 0,
  borderRight: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "6px 0 0 6px",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
  color: "rgba(255,255,255,0.94)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  cursor: "pointer",
};

const cameraPathLaneContentStyle: CSSProperties = {
  position: "absolute",
  left: cameraPathLaneContentOffsetPx,
  right: 0,
  top: 0,
  bottom: 0,
  overflow: "hidden",
};

const timelineSpinePlayButtonStyle: CSSProperties = {
  ...cameraPathLaneAddButtonStyle,
  borderRadius: 6,
};

const trackBaseStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
  pointerEvents: "auto",
};

const spineLaneStyle: CSSProperties = {
  position: "relative",
  minHeight: 20,
  borderRadius: 6,
};

const timelineRailOffsetStyle: CSSProperties = {
  marginLeft: pageLaneContentOffsetPx,
  width: `calc(100% - ${pageLaneContentOffsetPx}px)`,
  boxSizing: "border-box",
};

const scaleLabelStyle: CSSProperties = {
  position: "absolute",
  top: 12,
  transform: "translateX(-50%)",
  color: "rgba(228,235,238,0.66)",
  fontSize: 10,
  fontVariantNumeric: "tabular-nums",
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

const laneStyle: CSSProperties = {
  position: "relative",
  minHeight: 20,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.055)",
  overflow: "hidden",
};

const laneLabelStyle: CSSProperties = {
  position: "absolute",
  left: 8,
  top: 3,
  color: "rgba(220,228,232,0.62)",
  fontSize: 11,
  pointerEvents: "none",
};

const playheadStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  bottom: 0,
  width: 2,
  background: "rgba(248,250,252,0.88)",
  boxShadow: "0 0 0 1px rgba(0,0,0,0.24)",
  transform: "translateX(-1px)",
  pointerEvents: "none",
};

const cameraScrubMarkerStyle: CSSProperties = {
  position: "absolute",
  top: -3,
  bottom: -3,
  width: 2,
  background: "rgba(255,119,64,0.96)",
  boxShadow: "0 0 0 1px rgba(22,24,28,0.46), 0 0 12px rgba(255,119,64,0.48)",
  transform: "translateX(-1px)",
  pointerEvents: "none",
  zIndex: 3,
};

const cameraScrubMarkerDotStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: -5,
  width: 9,
  height: 9,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.86)",
  background: "rgba(255,85,54,0.98)",
  transform: "translateX(-50%)",
};

function formatElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function timelinePercentValue(seconds: number, duration: number): number {
  return Math.max(0, Math.min(100, (seconds / Math.max(0.1, duration)) * 100));
}

function timelinePercent(seconds: number, duration: number): string {
  return `${timelinePercentValue(seconds, duration)}%`;
}

function timelineScaleForDuration(duration: number): {
  minorStepSeconds: number;
  majorStepSeconds: number;
  labelStepSeconds: number;
} {
  if (duration <= 8) {
    return {
      minorStepSeconds: 0.25,
      majorStepSeconds: 1,
      labelStepSeconds: 1,
    };
  }
  if (duration <= 20) {
    return {
      minorStepSeconds: 0.5,
      majorStepSeconds: 2,
      labelStepSeconds: 2,
    };
  }
  if (duration <= 60) {
    return {
      minorStepSeconds: 1,
      majorStepSeconds: 5,
      labelStepSeconds: 5,
    };
  }
  if (duration <= 180) {
    return {
      minorStepSeconds: 2,
      majorStepSeconds: 10,
      labelStepSeconds: 20,
    };
  }
  return {
    minorStepSeconds: 5,
    majorStepSeconds: 30,
    labelStepSeconds: 60,
  };
}

function timelineSnapSeconds(duration: number): number {
  return timelineScaleForDuration(duration).minorStepSeconds;
}

function snapTimelineSeconds(seconds: number, duration: number): number {
  const step = timelineSnapSeconds(duration);
  return Math.max(
    0,
    Math.min(duration, Math.round(seconds / step) * step),
  );
}

function snapTimelineDeltaSeconds(seconds: number, duration: number): number {
  const step = timelineSnapSeconds(duration);
  return Math.round(seconds / step) * step;
}

function snapTimelinePercent(seconds: number, duration: number): string {
  return `${timelinePercentValue(snapTimelineSeconds(seconds, duration), duration)}%`;
}

function snapTimelineBlockPercent(
  startSeconds: number,
  durationSeconds: number,
  timelineDuration: number,
): string {
  const snappedStart = snapTimelineSeconds(startSeconds, timelineDuration);
  const snappedEnd = snapTimelineSeconds(
    startSeconds + Math.max(0, durationSeconds),
    timelineDuration,
  );
  const width = Math.max(
    0,
    timelinePercentValue(snappedEnd - snappedStart, timelineDuration),
  );
  return `${width}%`;
}

function formatTimelineScaleLabel(seconds: number): string {
  if (seconds < 60) {
    return seconds % 1 === 0
      ? `${seconds.toFixed(0)}s`
      : `${seconds.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}s`;
  }
  return formatElapsed(seconds);
}

function timelineGraduations(duration: number): Array<{
  seconds: number;
  leftPercent: string;
  major: boolean;
  label: string | null;
}> {
  const scale = timelineScaleForDuration(duration);
  const step = scale.minorStepSeconds;
  const count = Math.max(1, Math.floor(duration / step));
  return Array.from({ length: count + 1 }, (_, index) => {
    const seconds = Math.min(duration, index * step);
    const isEnd = Math.abs(seconds - duration) < 0.001;
    const major =
      Math.abs(seconds % scale.majorStepSeconds) < 0.001 || isEnd;
    const showLabel =
      Math.abs(seconds % scale.labelStepSeconds) < 0.001 || isEnd;
    return {
      seconds,
      leftPercent: snapTimelinePercent(seconds, duration),
      major,
      label: showLabel ? formatTimelineScaleLabel(seconds) : null,
    };
  });
}

function aimLabel(mode: string): string {
  if (mode === "follow-path-tangent") return "T";
  if (mode === "focus-point-lock") return "D";
  if (mode === "target-blend") return "A/D";
  return "A";
}

function nodeAimMode(
  node: CaptureCameraPathV2["nodes"][number] | CaptureCameraPathV3["nodes"][number],
): string {
  return "aimGeometry" in node ? node.aimGeometry.mode : node.lookMode;
}

export function CameraPathTimeline({
  canPlay,
  isPlaying,
  onPlay,
  onPause,
  onScrub,
  onSelectNode,
  onSelectSegment,
  onSelectTimelineTrack,
  onSetNodeHoldSeconds,
  onSetPageClipEnabled,
  onSetPageClipLocked,
  onSetSegmentTransitionSeconds,
  path,
  captureTimeline,
  onAddCurrentCamera,
  onAddCurrentPageClip,
  onAddPageClip,
  onAddPageRangeClips,
  onClearPageClips,
  onResizeTimelineBoundary,
  onSelectPageClip,
  selectedNodeId,
  selectedSegmentId,
  selectedTimelineTrack,
  scrubSeconds,
  timeline,
}: {
  path: CaptureCameraPathV2 | CaptureCameraPathV3;
  timeline: CaptureCameraPathV2Timeline | CaptureCameraPathV3Timeline;
  captureTimeline: CaptureTimelineState;
  selectedTimelineTrack: CaptureTimelineTrack;
  scrubSeconds: number;
  canPlay: boolean;
  isPlaying: boolean;
  onScrub(seconds: number): void;
  onPlay(): void;
  onPause(): void;
  onAddCurrentCamera(): void;
  onAddCurrentPageClip(): void;
  onAddPageClip(): void;
  onAddPageRangeClips(): void;
  onClearPageClips(): void;
  onSelectNode(id: string): void;
  onSelectSegment(id: string, nodeId?: string): void;
  onSelectPageClip(id: string | null): void;
  onSelectTimelineTrack(track: CaptureTimelineTrack): void;
  selectedNodeId: string | null;
  selectedSegmentId: string | null;
  onSetNodeHoldSeconds(id: string, seconds: number): void;
  onSetSegmentTransitionSeconds(id: string, seconds: number): void;
  onSetPageClipEnabled(id: string, enabled: boolean): void;
  onSetPageClipLocked(id: string, locked: boolean): void;
  onResizeTimelineBoundary(boundaryId: string, deltaSeconds: number): void;
}) {
  const [pageAddMenuOpen, setPageAddMenuOpen] = useState(false);
  const pageLayout = resolveCaptureTimelineLayout(captureTimeline);
  const duration = Math.max(0.1, timeline.durationSeconds, pageLayout.durationSeconds);
  const blocks = layoutCapturePathTimeline({ timeline });
  const scrubPercent = Math.max(
    0,
    Math.min(100, (scrubSeconds / duration) * 100),
  );
  const playheadLeft = snapTimelinePercent(scrubSeconds, duration);
  const timelineScale = timelineScaleForDuration(duration);
  const graduations = timelineGraduations(duration);
  const diagnosticsVisible = captureTimeline.diagnosticsVisible;
  const trackStyle: CSSProperties = {
    ...trackBaseStyle,
    gridTemplateRows: diagnosticsVisible
      ? "30px 34px 20px 28px 20px 20px 20px 20px 20px"
      : "30px 34px 20px 28px",
  };
  const blocksLaneRef = useRef<HTMLDivElement | null>(null);
  const pageLaneRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    blockId: string;
    kind: "hold" | "transition";
    nodeId?: string;
    segmentId?: string;
    startX: number;
    startDuration: number;
    pointerId: number;
  } | null>(null);
  const pageBoundaryDragRef = useRef<{
    boundaryId: string;
    startX: number;
    pointerId: number;
    laneWidth: number;
    appliedDeltaSeconds: number;
  } | null>(null);

  const updateBlockDurationFromPointer = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const drag = dragRef.current;
    const lane = blocksLaneRef.current;
    if (!drag || !lane) return;
    const laneWidth = Math.max(1, lane.getBoundingClientRect().width);
    const deltaSeconds = ((event.clientX - drag.startX) / laneWidth) * duration;
    const nextDuration =
      drag.startDuration + snapTimelineDeltaSeconds(deltaSeconds, duration);
    if (drag.kind === "hold" && drag.nodeId) {
      onSetNodeHoldSeconds(drag.nodeId, Math.max(0, nextDuration));
      return;
    }
    if (drag.kind === "transition" && drag.segmentId) {
      onSetSegmentTransitionSeconds(drag.segmentId, Math.max(0.1, nextDuration));
    }
  };

  const beginBlockResize = (
    event: ReactPointerEvent<HTMLElement>,
    block: (typeof blocks)[number],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = {
      blockId: block.id,
      kind: block.kind,
      nodeId: block.nodeId,
      segmentId: block.segmentId,
      startX: event.clientX,
      startDuration: block.durationSeconds,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const endBlockResize = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    updateBlockDurationFromPointer(event);
    if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }
    dragRef.current = null;
  };

  const updatePageBoundaryFromPointer = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const drag = pageBoundaryDragRef.current;
    if (!drag) return;
    const totalDeltaSeconds =
      ((event.clientX - drag.startX) / Math.max(1, drag.laneWidth)) * duration;
    const snappedTotalDeltaSeconds = snapTimelineDeltaSeconds(
      totalDeltaSeconds,
      duration,
    );
    const incrementalDeltaSeconds =
      snappedTotalDeltaSeconds - drag.appliedDeltaSeconds;
    if (Math.abs(incrementalDeltaSeconds) < 0.01) return;
    onResizeTimelineBoundary(drag.boundaryId, incrementalDeltaSeconds);
    drag.appliedDeltaSeconds += incrementalDeltaSeconds;
  };

  const beginPageBoundaryResize = (
    event: ReactPointerEvent<HTMLElement>,
    boundaryId: string,
  ) => {
    const lane = pageLaneRef.current;
    if (!lane) return;
    event.preventDefault();
    event.stopPropagation();
    pageBoundaryDragRef.current = {
      boundaryId,
      startX: event.clientX,
      pointerId: event.pointerId,
      laneWidth: lane.getBoundingClientRect().width,
      appliedDeltaSeconds: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const endPageBoundaryResize = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = pageBoundaryDragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    updatePageBoundaryFromPointer(event);
    if (event.currentTarget.hasPointerCapture(drag.pointerId)) {
      event.currentTarget.releasePointerCapture(drag.pointerId);
    }
    pageBoundaryDragRef.current = null;
  };

  const selectTimelineCameraBlock = (
    event: ReactMouseEvent<HTMLButtonElement>,
    block: (typeof blocks)[number],
  ) => {
    event.stopPropagation();
    onSelectTimelineTrack("camera-path");
    onScrub(block.startSeconds);
    if (block.kind === "hold" && block.nodeId) {
      const forwardBlock = blocks.find(
        (candidate) =>
          candidate.kind === "transition" &&
          candidate.fromNodeId === block.nodeId &&
          !!candidate.segmentId,
      );
      if (forwardBlock?.segmentId) {
        onSelectSegment(forwardBlock.segmentId, block.nodeId);
        return;
      }
      onSelectNode(block.nodeId);
      return;
    }
    if (!block.segmentId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = bounds.width > 0 ? event.clientX - bounds.left : 0;
    const nodeId =
      localX <= bounds.width / 2
        ? block.fromNodeId ?? block.toNodeId
        : block.toNodeId ?? block.fromNodeId;
    onSelectSegment(block.segmentId, nodeId);
  };

  return (
    <div
      data-testid="capture-timeline-bar"
      data-capture-legacy-id="capture-path-lower-timeline"
      data-selected-track={selectedTimelineTrack}
      style={rootStyle}
    >
      <div data-testid="capture-timeline-keyframe-track" style={trackStyle}>
        <div
          data-testid="capture-timeline-pages-lane"
          ref={pageLaneRef}
          style={{ ...laneStyle, gridRow: 1 }}
          onClick={() => onSelectTimelineTrack("pages")}
        >
          <button
            data-testid="capture-timeline-page-add-button"
            aria-label="Open page add options"
            title="Add pages"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectTimelineTrack("pages");
              setPageAddMenuOpen((open) => !open);
            }}
            style={pageLaneAddButtonStyle}
          >
            <span aria-hidden="true" style={addCameraIconStyle}>
              +
            </span>
          </button>
          {pageAddMenuOpen && (
            <div
              data-testid="capture-timeline-page-add-menu"
              data-capture-legacy-id="capture-timeline-add-group"
              style={pageAddMenuStyle}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                data-testid="capture-timeline-add-current-page"
                type="button"
                onClick={() => {
                  onAddCurrentPageClip();
                  setPageAddMenuOpen(false);
                }}
                style={pageAddMenuButtonStyle}
              >
                Current
              </button>
              <button
                data-testid="capture-timeline-add-page"
                type="button"
                onClick={() => {
                  onAddPageClip();
                  setPageAddMenuOpen(false);
                }}
                style={pageAddMenuButtonStyle}
              >
                Page
              </button>
              <button
                data-testid="capture-timeline-add-page-range"
                type="button"
                onClick={() => {
                  onAddPageRangeClips();
                  setPageAddMenuOpen(false);
                }}
                style={pageAddMenuButtonStyle}
              >
                Range
              </button>
              <button
                data-testid="capture-timeline-clear-pages"
                type="button"
                onClick={() => {
                  onClearPageClips();
                  setPageAddMenuOpen(false);
                }}
                style={pageAddMenuButtonStyle}
              >
                Clear
              </button>
            </div>
          )}
          <div
            data-testid="capture-timeline-pages-content"
            style={pageLaneContentStyle}
          >
          <span style={laneLabelStyle}>Pages</span>
          {pageLayout.pageClips.map((clip, index) => {
            const selected = captureTimeline.selectedPageClipId === clip.id;
            const next = pageLayout.pageClips[index + 1];
            const boundaryId = next
              ? `page:${clip.id}:${next.id}`
              : `page-end:${clip.id}`;
            return (
              <button
                key={clip.id}
                type="button"
                data-testid="capture-timeline-page-clip"
                data-page-id={clip.pageId}
                data-selected={selected ? "true" : "false"}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectPageClip(clip.id);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onSetPageClipEnabled(clip.id, !clip.enabled);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSetPageClipLocked(clip.id, !clip.locked);
                }}
                style={{
                  position: "absolute",
                  left: snapTimelinePercent(clip.startSeconds, duration),
                  top: 5,
                  width: snapTimelineBlockPercent(
                    clip.startSeconds,
                    clip.durationSeconds,
                    duration,
                  ),
                  minWidth: 20,
                  height: 20,
                  borderRadius: 5,
                  border: selected
                    ? "1px solid rgba(120,218,196,0.72)"
                    : "1px solid rgba(255,255,255,0.16)",
                  background: clip.enabled
                    ? "rgba(120,218,196,0.2)"
                    : "rgba(255,255,255,0.08)",
                  color: "rgba(244,248,250,0.94)",
                  fontSize: 11,
                  fontWeight: 720,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  padding: "0 18px 0 7px",
                  cursor: "pointer",
                }}
                title={`${clip.label} / ${formatElapsed(clip.transitionSeconds + clip.holdSeconds)}`}
              >
                {clip.locked ? "Lock " : ""}
                {clip.label}
                <span
                  data-testid="capture-timeline-page-boundary"
                  role="slider"
                  aria-label="Resize page clip boundary"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onPointerDown={(event) =>
                    beginPageBoundaryResize(event, boundaryId)
                  }
                  onPointerMove={(event) => {
                    if (
                      pageBoundaryDragRef.current?.boundaryId !== boundaryId
                    ) {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    updatePageBoundaryFromPointer(event);
                  }}
                  onPointerUp={endPageBoundaryResize}
                  onPointerCancel={endPageBoundaryResize}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    background: "rgba(255,255,255,0.18)",
                    cursor: clip.locked ? "not-allowed" : "ew-resize",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        ((clip.transitionSeconds || 0) /
                          Math.max(0.1, clip.durationSeconds)) *
                          100,
                      ),
                    )}%`,
                    background: "rgba(147,197,253,0.22)",
                    pointerEvents: "none",
                  }}
                />
              </button>
            );
          })}
          </div>
        </div>
        <div
          data-testid="capture-timeline-spine-bar"
          data-scale-step={timelineScale.minorStepSeconds}
          data-scale-major-step={timelineScale.majorStepSeconds}
          data-scale-label-step={timelineScale.labelStepSeconds}
          style={{ ...spineLaneStyle, gridRow: 3 }}
        >
          <button
            data-testid="capture-timeline-spine-play"
            aria-label={isPlaying ? "Pause timeline from spine" : "Play timeline from spine"}
            title={isPlaying ? "Pause timeline" : "Play timeline"}
            type="button"
            disabled={!canPlay}
            onClick={(event) => {
              event.stopPropagation();
              if (isPlaying) {
                onPause();
                return;
              }
              onPlay();
            }}
            style={timelineSpinePlayButtonStyle}
          >
            <span
              data-testid={
                isPlaying
                  ? "capture-timeline-spine-icon-pause"
                  : "capture-timeline-spine-icon-play"
              }
              aria-hidden="true"
              style={isPlaying ? timelinePauseIconStyle : timelinePlayIconStyle}
            />
          </button>
          <div style={{ ...spineShellStyle, ...timelineRailOffsetStyle }}>
            <div style={spineTrackStyle}>
              <span
                aria-hidden="true"
                style={{ ...spineProgressStyle, width: `${scrubPercent}%` }}
              />
              {graduations.map((graduation) => (
                <span
                  key={`${graduation.seconds}`}
                  data-testid="capture-timeline-spine-graduation"
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: graduation.leftPercent,
                    top: graduation.major ? 0 : 2,
                    bottom: graduation.major ? 0 : 2,
                    width: graduation.major ? 2 : 1,
                    background: graduation.major
                      ? "rgba(28,31,35,0.34)"
                      : "rgba(28,31,35,0.18)",
                    transform: "translateX(-50%)",
                    pointerEvents: "none",
                  }}
                />
              ))}
              <span
                data-testid="capture-timeline-spine-thumb"
                aria-hidden="true"
                style={{ ...spineThumbStyle, left: playheadLeft }}
              />
            </div>
            <input
              data-testid="capture-timeline-scrubber"
              data-capture-legacy-id="capture-path-timeline-scrub"
              aria-label="Capture timeline spine scrubber"
              type="range"
              min={0}
              max={duration}
              step={timelineSnapSeconds(duration)}
              value={snapTimelineSeconds(scrubSeconds, duration)}
              onChange={(event) => onScrub(Number(event.currentTarget.value))}
              style={spineRangeInputStyle}
            />
          </div>
        </div>
        <div
          data-testid="capture-timeline-time-axis"
          data-scale-step={timelineScale.minorStepSeconds}
          data-scale-major-step={timelineScale.majorStepSeconds}
          data-scale-label-step={timelineScale.labelStepSeconds}
          style={{
            ...timelineRailOffsetStyle,
            position: "relative",
            gridRow: 4,
            minHeight: 28,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            pointerEvents: "none",
          }}
        >
          <div
            data-testid="capture-timeline-time-scale"
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          >
            {graduations.map((graduation) => (
              <span
                key={`axis:${graduation.seconds}`}
                data-testid="capture-timeline-time-axis-tick"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: graduation.leftPercent,
                  top: 0,
                  width: graduation.major ? 2 : 1,
                  height: graduation.major ? 10 : 5,
                  background: graduation.major
                    ? "rgba(228,235,238,0.48)"
                    : "rgba(228,235,238,0.24)",
                  transform: "translateX(-50%)",
                }}
              />
            ))}
            {graduations
              .filter((graduation) => graduation.label)
              .map((graduation) => (
                <span
                  key={`label:${graduation.seconds}`}
                  data-testid="capture-timeline-time-scale-label"
                  style={{
                    ...scaleLabelStyle,
                    left: graduation.leftPercent,
                  }}
                >
                  {graduation.label}
                </span>
              ))}
          </div>
        </div>
        <div
          ref={blocksLaneRef}
          data-testid="capture-timeline-camera-path-lane"
          style={{ ...laneStyle, gridRow: 2 }}
          onClick={() => onSelectTimelineTrack("camera-path")}
        >
          <button
            data-testid="capture-timeline-add-current-camera"
            aria-label="Add current camera"
            title="Add current camera"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectTimelineTrack("camera-path");
              onAddCurrentCamera();
            }}
            style={cameraPathLaneAddButtonStyle}
          >
            <span
              data-testid="capture-timeline-icon-add-camera"
              aria-hidden="true"
              style={addCameraIconStyle}
            >
              +
            </span>
          </button>
          <div
            data-testid="capture-timeline-camera-path-content"
            style={cameraPathLaneContentStyle}
          >
          <span style={{ ...laneLabelStyle, left: 8 }}>Camera Path</span>
          {blocks.map((block) => {
            const selectedHold =
              block.kind === "hold" && block.nodeId === selectedNodeId;
            const selectedTransition =
              block.kind === "transition" &&
              (block.segmentId === selectedSegmentId ||
                (!!selectedNodeId && block.fromNodeId === selectedNodeId));
            const selected = selectedHold || selectedTransition;
            const style: CSSProperties = {
              position: "absolute",
              left: snapTimelinePercent(block.startSeconds, duration),
              top: 5,
              height: 22,
              width: snapTimelineBlockPercent(
                block.startSeconds,
                block.durationSeconds,
                duration,
              ),
              minWidth: 7,
              borderRadius: 5,
              border:
                selected
                  ? "1px solid rgba(255,255,255,0.88)"
                  : block.kind === "hold"
                  ? "1px solid rgba(120,218,196,0.68)"
                  : "1px solid rgba(147,197,253,0.62)",
              background:
                selected
                  ? block.kind === "hold"
                    ? "rgba(120,218,196,0.44)"
                    : "rgba(255,168,76,0.34)"
                  : block.kind === "hold"
                  ? "rgba(120,218,196,0.28)"
                  : "rgba(147,197,253,0.24)",
              boxShadow: selected
                ? "0 0 0 1px rgba(255,255,255,0.16), 0 0 12px rgba(255,168,76,0.22)"
                : undefined,
              cursor: "pointer",
            };
            return (
              <button
                key={block.id}
                data-testid={block.kind === "hold" ? "capture-timeline-hold-block" : "capture-timeline-transition-block"}
                data-block-id={block.id}
                data-block-kind={block.kind}
                data-selected={selected ? "true" : "false"}
                data-forward-selected={
                  selectedTransition && block.segmentId !== selectedSegmentId
                    ? "true"
                    : "false"
                }
                type="button"
                style={style}
                onClick={(event) => selectTimelineCameraBlock(event, block)}
              >
                <span
                  data-testid="capture-timeline-block-handle"
                  role="slider"
                  aria-label={`Resize ${block.kind} duration`}
                  aria-valuemin={block.kind === "hold" ? 0 : 0.1}
                  aria-valuemax={600}
                  aria-valuenow={block.durationSeconds}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => beginBlockResize(event, block)}
                  onPointerMove={(event) => {
                    if (dragRef.current?.blockId !== block.id) return;
                    event.preventDefault();
                    event.stopPropagation();
                    updateBlockDurationFromPointer(event);
                  }}
                  onPointerUp={endBlockResize}
                  onPointerCancel={endBlockResize}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    background: "rgba(255,255,255,0.18)",
                    cursor: "ew-resize",
                    touchAction: "none",
                  }}
                />
              </button>
            );
          })}
          <span
            data-testid="capture-timeline-camera-scrub-marker"
            aria-hidden="true"
            style={{ ...cameraScrubMarkerStyle, left: playheadLeft }}
          >
            <span
              data-testid="capture-timeline-camera-scrub-marker-dot"
              aria-hidden="true"
              style={cameraScrubMarkerDotStyle}
            />
          </span>
          <span data-testid="capture-timeline-playhead" style={{ ...playheadStyle, left: playheadLeft }} />
          </div>
        </div>
        {diagnosticsVisible && (
          <>
        <div data-testid="capture-timeline-position-lane" style={laneStyle}>
          <span style={laneLabelStyle}>Position</span>
          {path.nodes.map((node, index) => (
            <span
              key={node.id}
              data-testid="capture-timeline-node-marker"
              style={{
                position: "absolute",
                left: timelinePercent(timeline.nodeTimeSeconds[node.id] ?? 0, duration),
                top: 3,
                width: 7,
                height: 14,
                borderRadius: 4,
                background: node.enabled === false ? "rgba(255,255,255,0.22)" : "rgba(120,218,196,0.48)",
                transform: "translateX(-50%)",
              }}
              title={`${index + 1}`}
            />
          ))}
        </div>
        <div data-testid="capture-timeline-continuity-lane" style={laneStyle}>
          <span style={laneLabelStyle}>G</span>
          {blocks
            .filter((block) => block.kind === "transition")
            .map((block) => (
              <span
                key={`continuity:${block.id}`}
                data-testid="capture-timeline-continuity-marker"
                data-block-id={block.id}
                style={{
                  position: "absolute",
                  left: `${block.leftPercent + block.widthPercent / 2}%`,
                  top: 3,
                  minWidth: 18,
                  height: 14,
                  borderRadius: 4,
                  border: "1px solid rgba(147,197,253,0.46)",
                  background: "rgba(147,197,253,0.18)",
                  color: "#dbeafe",
                  fontSize: 10,
                  fontWeight: 760,
                  lineHeight: "13px",
                  textAlign: "center",
                  transform: "translateX(-50%)",
                }}
              >
                {block.continuity}
              </span>
            ))}
        </div>
        <div data-testid="capture-timeline-gd-lane" style={laneStyle}>
          <span style={laneLabelStyle}>Gd</span>
          {blocks
            .filter((block) => block.kind === "transition")
            .map((block) => {
              const left =
                block.leftPercent +
                block.widthPercent * (block.gdStartPercent / 100);
              const width =
                block.widthPercent *
                Math.max(0, (block.gdEndPercent - block.gdStartPercent) / 100);
              return (
                <span
                  key={`gd:${block.id}`}
                  data-testid="capture-timeline-gd-zone"
                  data-block-id={block.id}
                  style={{
                    position: "absolute",
                    left: `${left}%`,
                    top: 4,
                    width: `${Math.max(0.6, width)}%`,
                    height: 10,
                    borderRadius: 5,
                    background: "rgba(250,204,21,0.26)",
                    border: "1px solid rgba(250,204,21,0.36)",
                  }}
                />
              );
            })}
        </div>
        <div data-testid="capture-timeline-look-lane" style={laneStyle}>
          <span style={laneLabelStyle}>Aim</span>
          {path.nodes.map((node) => (
            (() => {
              const mode = nodeAimMode(node);
              return (
            <span
              key={node.id}
              data-testid="capture-timeline-aim-marker"
              style={{
                position: "absolute",
                left: timelinePercent(timeline.nodeTimeSeconds[node.id] ?? 0, duration),
                top: 3,
                minWidth: 14,
                height: 14,
                borderRadius: 4,
                background: mode === "follow-path-tangent" ? "#93c5fd" : "#7dd3fc",
                color: "rgba(5,12,16,0.86)",
                fontSize: 9,
                fontWeight: 800,
                lineHeight: "14px",
                textAlign: "center",
                transform: "translateX(-50%)",
              }}
            >
              {aimLabel(mode)}
            </span>
              );
            })()
          ))}
        </div>
        <div data-testid="capture-timeline-focus-lane" style={laneStyle}>
          <span style={laneLabelStyle}>Focus</span>
          {path.nodes
            .filter((node) => nodeAimMode(node) === "focus-point-lock")
            .map((node) => (
              <span
                key={node.id}
                data-testid="capture-timeline-focus-marker"
                style={{
                  position: "absolute",
                  left: timelinePercent(timeline.nodeTimeSeconds[node.id] ?? 0, duration),
                  top: 4,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  background: "#facc15",
                  transform: "translateX(-50%)",
                }}
              />
            ))}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
