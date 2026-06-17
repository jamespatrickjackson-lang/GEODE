import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
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
  CAPTURE_TIMELINE_DEFAULT_FPS,
  captureTimelineClipFrameBounds,
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

const pageLaneContentOffsetPx = 36;

const emptyLaneAddButtonStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  bottom: 0,
  border: 0,
  borderRight: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "6px 0 0 6px",
  background: "rgba(255,255,255,0.055)",
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

const pagePickerStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 46,
  width: 360,
  maxWidth: "min(360px, calc(100vw - 32px))",
  maxHeight: "min(460px, calc(100vh - 240px))",
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr)",
  gap: 6,
  padding: 8,
  overflow: "hidden",
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(14,18,22,0.96)",
  boxShadow: "0 18px 42px rgba(0,0,0,0.34)",
};

const pagePickerSearchStyle: CSSProperties = {
  height: 26,
  borderRadius: 5,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(244,248,250,0.94)",
  padding: "0 8px",
  fontSize: 12,
  outline: "none",
};

const pagePickerOptionStyle: CSSProperties = {
  height: 24,
  borderRadius: 5,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.07)",
  color: "rgba(244,248,250,0.94)",
  textAlign: "left",
  padding: "0 8px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const nodeKindPickerStyle: CSSProperties = {
  position: "fixed",
  zIndex: 47,
  display: "grid",
  gap: 5,
  minWidth: 128,
  padding: 7,
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(14,18,22,0.96)",
  boxShadow: "0 14px 32px rgba(0,0,0,0.3)",
};

const nodeKindPickerButtonStyle: CSSProperties = {
  height: 24,
  borderRadius: 5,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(244,248,250,0.94)",
  fontSize: 11,
  fontWeight: 720,
  cursor: "pointer",
};

const pageLaneAddButtonStyle: CSSProperties = {
  ...emptyLaneAddButtonStyle,
  width: pageLaneContentOffsetPx,
};

const nodeKindMarkerButtonStyle: CSSProperties = {
  position: "absolute",
  top: -4,
  width: 18,
  height: 18,
  padding: 0,
  border: 0,
  background: "transparent",
  transform: "translateX(-50%)",
  cursor: "pointer",
  zIndex: 5,
};

const pagePickerListStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minHeight: 0,
  maxHeight: "min(340px, calc(100vh - 260px))",
  overflowY: "auto",
  paddingRight: 2,
};

const clipFrameLabelStyle: CSSProperties = {
  position: "absolute",
  top: 2,
  fontSize: 9,
  lineHeight: "10px",
  fontWeight: 760,
  fontVariantNumeric: "tabular-nums",
  color: "rgba(226,240,246,0.8)",
  zIndex: 2,
};

const clipCenterLabelStyle: CSSProperties = {
  position: "absolute",
  left: 42,
  right: 42,
  top: 3,
  display: "flex",
  justifyContent: "center",
  gap: 6,
  minWidth: 0,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  zIndex: 2,
};

const frameEditorInputStyle: CSSProperties = {
  width: 54,
  height: 16,
  borderRadius: 4,
  border: "1px solid rgba(120,218,196,0.72)",
  background: "rgba(5,10,12,0.96)",
  color: "rgba(244,248,250,0.96)",
  fontSize: 10,
  fontWeight: 760,
  padding: "0 4px",
  outline: "none",
  fontVariantNumeric: "tabular-nums",
};

const frameEditorErrorStyle: CSSProperties = {
  position: "absolute",
  left: 42,
  right: 42,
  bottom: 1,
  color: "rgba(251,146,60,0.92)",
  fontSize: 9,
  textAlign: "center",
  pointerEvents: "none",
};

const cameraPathLaneContentOffsetPx = 36;

const cameraPathLaneAddButtonStyle: CSSProperties = {
  ...emptyLaneAddButtonStyle,
  width: cameraPathLaneContentOffsetPx,
};

const cameraPathLaneContentStyle: CSSProperties = {
  position: "absolute",
  left: cameraPathLaneContentOffsetPx,
  right: 0,
  top: 0,
  bottom: 0,
  overflow: "hidden",
};

const trackBaseStyle: CSSProperties = {
  position: "relative",
  display: "grid",
  gap: 6,
  minWidth: 0,
  pointerEvents: "auto",
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

const globalPlayheadStyle: CSSProperties = {
  ...playheadStyle,
  top: 0,
  bottom: 0,
  zIndex: 5,
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
      minorStepSeconds: 0.1,
      majorStepSeconds: 1,
      labelStepSeconds: 1,
    };
  }
  if (duration <= 20) {
    return {
      minorStepSeconds: 0.1,
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

function timelineFrameSeconds(
  seconds: number,
  duration: number,
  fps = CAPTURE_TIMELINE_DEFAULT_FPS,
): number {
  const safeFps = Math.max(1, Math.round(fps));
  const safeSeconds = Number.isFinite(seconds)
    ? Math.max(0, Math.min(duration, seconds))
    : 0;
  return Math.round(safeSeconds * safeFps) / safeFps;
}

function timelineSecondsFromPointerEvent(
  event: ReactMouseEvent<HTMLElement>,
  element: HTMLElement,
  duration: number,
): number {
  const bounds = element.getBoundingClientRect();
  const localX = bounds.width > 0 ? event.clientX - bounds.left : 0;
  const progress = Math.max(0, Math.min(1, localX / Math.max(1, bounds.width)));
  return timelineFrameSeconds(progress * duration, duration);
}

function formatTimelineScaleLabel(seconds: number): string {
  if (seconds < 60) {
    return seconds % 1 === 0
      ? `${seconds.toFixed(0)}s`
      : `${seconds.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}s`;
  }
  return formatElapsed(seconds);
}

function timelineFrameStep(duration: number, fps: number): number {
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  const tenthSecondStep = Math.max(1, Math.round(fps / 10));
  if (duration <= 20) return tenthSecondStep;
  for (const step of [15, 30, 60, 120, 300, 600, 1200]) {
    if (totalFrames / step <= 18) return step;
  }
  return 2400;
}

function formatFrameDurationLabel(frames: number, fps: number): string {
  const safeFps = Math.max(1, Math.round(fps));
  return `${frames} (${(frames / safeFps).toFixed(2)} s)`;
}

function timelineTrackPercentStyle(leftPercent: string): string {
  const numericPercent = Number.parseFloat(leftPercent);
  const safePercent = Number.isFinite(numericPercent)
    ? Math.max(0, Math.min(100, numericPercent))
    : 0;
  return `calc(${pageLaneContentOffsetPx}px + (100% - ${pageLaneContentOffsetPx}px) * ${
    safePercent / 100
  })`;
}

function timelineFrameGraduations(duration: number, fps: number): Array<{
  frame: number;
  leftPercent: string;
  major: boolean;
}> {
  const safeFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(1, Math.ceil(duration * safeFps));
  const step = timelineFrameStep(duration, safeFps);
  const ticks: Array<{
    frame: number;
    leftPercent: string;
    major: boolean;
  }> = [];
  for (let frame = 0; frame <= totalFrames; frame += step) {
    ticks.push({
      frame,
      leftPercent: `${timelinePercentValue(frame / safeFps, duration)}%`,
      major: frame % safeFps === 0 || frame === 0,
    });
  }
  if (ticks[ticks.length - 1]?.frame !== totalFrames) {
    ticks.push({
      frame: totalFrames,
      leftPercent: "100%",
      major: true,
    });
  }
  return ticks;
}

function isEditableTimelineTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
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
  onScrub,
  onSetScrollPlayheadSeconds,
  onSelectNode,
  onSelectSegment,
  onSelectTimelineTrack,
  onSetNodeHoldSeconds,
  onOpenCameraNodeKindPicker,
  onSetPageClipLocked,
  onSetSegmentTransitionSeconds,
  path,
  captureTimeline,
  onAddCurrentCamera,
  onAddCurrentPageClip,
  onAddPageClip,
  onAddPageRangeClips,
  onClearPageClips,
  onEditPageClipFrames,
  onRemovePageClip,
  onReplacePageClipPage,
  onResizeTimelineBoundary,
  onSelectPageClip,
  selectedNodeId,
  selectedSegmentId,
  selectedTimelineTrack,
  pageOptions,
  scrubSeconds,
  timeline,
}: {
  path: CaptureCameraPathV2 | CaptureCameraPathV3;
  timeline: CaptureCameraPathV2Timeline | CaptureCameraPathV3Timeline;
  captureTimeline: CaptureTimelineState;
  pageOptions: Array<{ id: string; label: string }>;
  selectedTimelineTrack: CaptureTimelineTrack;
  scrubSeconds: number;
  onScrub(seconds: number): void;
  onSetScrollPlayheadSeconds(seconds: number): void;
  onAddCurrentCamera(
    event: ReactMouseEvent<HTMLElement>,
    source: "timeline",
  ): void;
  onAddCurrentPageClip(): void;
  onAddPageClip(pageId: string): void;
  onAddPageRangeClips(): void;
  onClearPageClips(): void;
  onReplacePageClipPage(clipId: string, pageId: string): void;
  onRemovePageClip(clipId: string): void;
  onEditPageClipFrames(
    clipId: string,
    edit: {
      startFrame?: number | null;
      endFrame?: number | null;
      durationFrames?: number | null;
    },
  ): void;
  onSelectNode(id: string): void;
  onSelectSegment(id: string, nodeId?: string): void;
  onSelectPageClip(id: string | null): void;
  onSelectTimelineTrack(track: CaptureTimelineTrack): void;
  selectedNodeId: string | null;
  selectedSegmentId: string | null;
  onSetNodeHoldSeconds(id: string, seconds: number): void;
  onOpenCameraNodeKindPicker(
    id: string,
    kind: "keyframe" | "transition",
  ): void;
  onSetSegmentTransitionSeconds(id: string, seconds: number): void;
  onSetPageClipLocked(id: string, locked: boolean): void;
  onResizeTimelineBoundary(boundaryId: string, deltaSeconds: number): void;
}) {
  const [pageAddMenuOpen, setPageAddMenuOpen] = useState(false);
  const [pagePickerState, setPagePickerState] = useState<{
    mode: "add" | "replace";
    clipId: string | null;
    query: string;
  } | null>(null);
  const [nodeKindPicker, setNodeKindPicker] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [frameEditor, setFrameEditor] = useState<{
    clipId: string;
    field: "startFrame" | "endFrame" | "durationFrames";
    value: string;
  } | null>(null);
  const [frameEditorError, setFrameEditorError] = useState<string | null>(null);
  const pageLayout = resolveCaptureTimelineLayout(captureTimeline);
  const duration = Math.max(0.1, timeline.durationSeconds, pageLayout.durationSeconds);
  const blocks = layoutCapturePathTimeline({ timeline });
  const playheadLeft = snapTimelinePercent(scrubSeconds, duration);
  const timelineScale = timelineScaleForDuration(duration);
  const frameStepSeconds =
    timelineFrameStep(duration, CAPTURE_TIMELINE_DEFAULT_FPS) /
    CAPTURE_TIMELINE_DEFAULT_FPS;
  const frameGraduations = timelineFrameGraduations(
    duration,
    CAPTURE_TIMELINE_DEFAULT_FPS,
  );
  const selectedPageClipId = captureTimeline.selectedPageClipId;
  const pagePickerQuery = pagePickerState?.query.trim().toLowerCase() ?? "";
  const filteredPageOptions = pageOptions.filter((page) =>
    pagePickerQuery
      ? `${page.label} ${page.id}`.toLowerCase().includes(pagePickerQuery)
      : true,
  );
  const diagnosticsVisible = captureTimeline.diagnosticsVisible;
  const trackStyle: CSSProperties = {
    ...trackBaseStyle,
    gridTemplateRows: diagnosticsVisible
      ? "34px 34px 28px 20px 20px 20px 20px 20px"
      : "34px 34px 28px",
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

  const onOpenPagePicker = (mode: "add" | "replace", clipId: string | null = null) => {
    setPageAddMenuOpen(false);
    setFrameEditor(null);
    setFrameEditorError(null);
    setPagePickerState({ mode, clipId, query: "" });
  };

  const commitPagePicker = (pageId: string) => {
    const picker = pagePickerState;
    if (!picker) return;
    if (picker.mode === "replace" && picker.clipId) {
      onReplacePageClipPage(picker.clipId, pageId);
    } else {
      onAddPageClip(pageId);
    }
    setPagePickerState(null);
  };

  const openCameraNodeKindPicker = (
    event: ReactMouseEvent<HTMLElement>,
    nodeId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setNodeKindPicker({
      nodeId,
      x: Math.min(window.innerWidth - 152, Math.max(8, event.clientX + 8)),
      y: Math.min(window.innerHeight - 86, Math.max(8, event.clientY + 8)),
    });
  };

  const commitNodeKindPicker = (kind: "keyframe" | "transition") => {
    if (!nodeKindPicker) return;
    onOpenCameraNodeKindPicker(nodeKindPicker.nodeId, kind);
    setNodeKindPicker(null);
  };

  const handlePageLaneKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isEditableTimelineTarget(event.target)) return;
    if (
      selectedTimelineTrack === "pages" &&
      selectedPageClipId &&
      (event.key === "Delete" || event.key === "Backspace")
    ) {
      event.preventDefault();
      event.stopPropagation();
      onRemovePageClip(selectedPageClipId);
      return;
    }
    if (event.key === "Escape") {
      setPagePickerState(null);
      setFrameEditor(null);
      setFrameEditorError(null);
    }
  };

  const startFrameEdit = (
    field: "startFrame" | "endFrame" | "durationFrames",
    clipId: string,
    value: number,
  ) => {
    onSelectPageClip(clipId);
    setPagePickerState(null);
    setFrameEditor({ clipId, field, value: `${value}` });
    setFrameEditorError(null);
  };

  const commitFrameEditor = () => {
    if (!frameEditor) return;
    const parsed = Number.parseInt(frameEditor.value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFrameEditorError("Enter a whole frame");
      return;
    }
    onEditPageClipFrames(frameEditor.clipId, {
      [frameEditor.field]: parsed,
    });
    setFrameEditor(null);
    setFrameEditorError(null);
  };

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

  const placeScrollPlayheadFromPointer = (
    event: ReactMouseEvent<HTMLElement>,
    clip?: (typeof pageLayout.pageClips)[number],
  ) => {
    if (isEditableTimelineTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    const nextSeconds = clip
      ? (() => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const localX = bounds.width > 0 ? event.clientX - bounds.left : 0;
          const progress = Math.max(
            0,
            Math.min(1, localX / Math.max(1, bounds.width)),
          );
          return timelineFrameSeconds(
            clip.startSeconds + progress * clip.durationSeconds,
            duration,
          );
        })()
      : timelineSecondsFromPointerEvent(event, event.currentTarget, duration);
    onSetScrollPlayheadSeconds(nextSeconds);
  };

  const pagePicker =
    pagePickerState && typeof document !== "undefined"
      ? createPortal(
          <div
            data-testid="capture-timeline-page-picker"
            data-mode={pagePickerState.mode}
            style={pagePickerStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              data-testid="capture-timeline-page-picker-search"
              aria-label="Search pages"
              type="search"
              value={pagePickerState.query}
              onChange={(event) =>
                setPagePickerState((previous) =>
                  previous
                    ? { ...previous, query: event.currentTarget.value }
                    : previous,
                )
              }
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape") {
                  setPagePickerState(null);
                }
              }}
              style={pagePickerSearchStyle}
              autoFocus
            />
            <div style={pagePickerListStyle}>
              {filteredPageOptions.map((page) => (
                <button
                  key={page.id}
                  data-testid="capture-timeline-page-picker-option"
                  data-page-id={page.id}
                  type="button"
                  onClick={() => commitPagePicker(page.id)}
                  style={pagePickerOptionStyle}
                  title={page.label}
                >
                  {page.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  const nodeKindPickerPopover =
    nodeKindPicker && typeof document !== "undefined"
      ? createPortal(
          <div
            data-testid="capture-timeline-node-kind-popover"
            style={{
              ...nodeKindPickerStyle,
              left: nodeKindPicker.x,
              top: nodeKindPicker.y,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => commitNodeKindPicker("keyframe")}
              style={nodeKindPickerButtonStyle}
            >
              Keyframe
            </button>
            <button
              type="button"
              onClick={() => commitNodeKindPicker("transition")}
              style={nodeKindPickerButtonStyle}
            >
              Transition
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      data-testid="capture-timeline-bar"
      data-capture-legacy-id="capture-path-lower-timeline"
      data-selected-track={selectedTimelineTrack}
      style={rootStyle}
    >
      {pagePicker}
      {nodeKindPickerPopover}
      <div data-testid="capture-timeline-keyframe-track" style={trackStyle}>
        <div
          data-testid="capture-timeline-frame-grid"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: pageLaneContentOffsetPx,
            right: 0,
            top: 0,
            bottom: 0,
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          {frameGraduations.map((graduation) => (
            <span
              key={`grid:${graduation.frame}`}
              data-testid="capture-timeline-frame-grid-tick"
              data-frame={graduation.frame}
              style={{
                position: "absolute",
                left: graduation.leftPercent,
                top: 0,
                bottom: 0,
                width: 1,
                background: graduation.major
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(255,255,255,0.055)",
              }}
            />
          ))}
        </div>
        <span
          data-testid="capture-timeline-playhead"
          aria-hidden="true"
          style={{
            ...globalPlayheadStyle,
            left: timelineTrackPercentStyle(playheadLeft),
          }}
        />
        <div
          data-testid="capture-timeline-pages-lane"
          ref={pageLaneRef}
          tabIndex={0}
          aria-label="Page Bar timeline lane"
          style={{ ...laneStyle, gridRow: 1, overflow: "visible" }}
          onClick={(event) => {
            onSelectTimelineTrack("pages");
            event.currentTarget.focus();
          }}
          onKeyDown={handlePageLaneKeyDown}
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
                  onOpenPagePicker("add");
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
            onClick={(event) => {
              onSelectTimelineTrack("pages");
              pageLaneRef.current?.focus();
              placeScrollPlayheadFromPointer(event);
            }}
          >
          <span style={laneLabelStyle}>Pages</span>
          <div
            data-testid="capture-timeline-frame-ruler"
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          >
            {frameGraduations.map((graduation) => (
              <span
                key={`frame:${graduation.frame}`}
                data-testid="capture-timeline-frame-ruler-tick"
                data-frame={graduation.frame}
                style={{
                  position: "absolute",
                  left: graduation.leftPercent,
                  top: graduation.major ? 0 : 3,
                  bottom: graduation.major ? 0 : 4,
                  width: 1,
                  background: "transparent",
                }}
              >
              </span>
            ))}
          </div>
          {pageLayout.pageClips.map((clip, index) => {
            const selected = captureTimeline.selectedPageClipId === clip.id;
            const next = pageLayout.pageClips[index + 1];
            const boundaryId = next
              ? `page:${clip.id}:${next.id}`
              : `page-end:${clip.id}`;
            const frameBounds = captureTimelineClipFrameBounds(
              clip,
              CAPTURE_TIMELINE_DEFAULT_FPS,
            );
            const matchingEditor =
              frameEditor?.clipId === clip.id ? frameEditor : null;
            const renderFrameValue = (
              field: "startFrame" | "endFrame" | "durationFrames",
              value: number,
              testId: string,
              style: CSSProperties,
              displayValue = `${value}`,
            ) =>
              matchingEditor?.field === field ? (
                <input
                  data-testid="capture-timeline-frame-editor"
                  aria-label={`Edit ${field}`}
                  aria-invalid={frameEditorError ? "true" : "false"}
                  type="number"
                  min={0}
                  value={matchingEditor.value}
                  onChange={(event) => {
                    setFrameEditor({ ...matchingEditor, value: event.currentTarget.value });
                    setFrameEditorError(null);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      commitFrameEditor();
                    }
                    if (event.key === "Escape") {
                      setFrameEditor(null);
                      setFrameEditorError(null);
                    }
                  }}
                  onBlur={commitFrameEditor}
                  style={{ ...frameEditorInputStyle, ...style }}
                  autoFocus
                />
              ) : (
                <span
                  data-testid={testId}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    startFrameEdit(field, clip.id, value);
                  }}
                  style={style}
                  title={displayValue === `${value}` ? `Frame ${value}` : displayValue}
                >
                  {displayValue}
                </span>
              );
            return (
              <div
                key={clip.id}
                role="button"
                tabIndex={0}
                data-testid="capture-timeline-page-clip"
                data-page-id={clip.pageId}
                data-selected={selected ? "true" : "false"}
                onClick={(event) => {
                  pageLaneRef.current?.focus();
                  onSelectPageClip(clip.id);
                  placeScrollPlayheadFromPointer(event, clip);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectPageClip(clip.id);
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSetPageClipLocked(clip.id, !clip.locked);
                }}
                style={{
                  position: "absolute",
                  left: snapTimelinePercent(clip.startSeconds, duration),
                  top: 1,
                  bottom: 1,
                  width: snapTimelineBlockPercent(
                    clip.startSeconds,
                    clip.durationSeconds,
                    duration,
                  ),
                  minWidth: 20,
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
                  boxSizing: "border-box",
                  padding: "0 18px 0 7px",
                  cursor: "pointer",
                }}
                title={`${clip.label} / ${formatElapsed(clip.transitionSeconds + clip.holdSeconds)} / frames ${frameBounds.startFrame}-${frameBounds.endFrame}`}
              >
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
                {renderFrameValue("startFrame", frameBounds.startFrame, "capture-timeline-page-frame-start", {
                  ...clipFrameLabelStyle,
                  left: 6,
                })}
                {renderFrameValue("endFrame", frameBounds.endFrame, "capture-timeline-page-frame-end", {
                  ...clipFrameLabelStyle,
                  right: 11,
                })}
                <span style={clipCenterLabelStyle}>
                  <span
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenPagePicker("replace", clip.id);
                    }}
                    title="Change page"
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {clip.locked ? "Lock " : ""}
                    {clip.label}
                  </span>
                  {renderFrameValue(
                    "durationFrames",
                    frameBounds.durationFrames,
                    "capture-timeline-page-duration",
                    {
                      color: "rgba(226,240,246,0.72)",
                      fontSize: 10,
                      fontVariantNumeric: "tabular-nums",
                      flex: "0 0 auto",
                    },
                    formatFrameDurationLabel(
                      frameBounds.durationFrames,
                      CAPTURE_TIMELINE_DEFAULT_FPS,
                    ),
                  )}
                </span>
                {matchingEditor && frameEditorError && (
                  <span style={frameEditorErrorStyle}>{frameEditorError}</span>
                )}
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
              </div>
            );
          })}
          </div>
        </div>
        <div
          data-testid="capture-timeline-time-axis"
          data-scale-step={frameStepSeconds}
          data-scale-major-step={timelineScale.majorStepSeconds}
          data-scale-label-step={timelineScale.labelStepSeconds}
          onClick={(event) => {
            onSelectTimelineTrack(selectedTimelineTrack);
            placeScrollPlayheadFromPointer(event);
          }}
          style={{
            ...timelineRailOffsetStyle,
            position: "relative",
            gridRow: 3,
            minHeight: 28,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            pointerEvents: "auto",
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
            {frameGraduations.map((graduation) => (
              <span
                key={`axis:${graduation.frame}`}
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
            {frameGraduations
              .filter((graduation) => graduation.major)
              .map((graduation) => (
                <span
                  key={`label:${graduation.frame}`}
                  data-testid="capture-timeline-time-scale-label"
                  style={{
                    ...scaleLabelStyle,
                    left: graduation.leftPercent,
                  }}
                >
                  {formatTimelineScaleLabel(
                    graduation.frame / CAPTURE_TIMELINE_DEFAULT_FPS,
                  )}
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
              onAddCurrentCamera(event, "timeline");
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
            onClick={(event) => {
              onSelectTimelineTrack("camera-path");
              placeScrollPlayheadFromPointer(event);
            }}
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
          {path.nodes.map((node) => {
            const markerLeft = snapTimelinePercent(
              timeline.nodeTimeSeconds[node.id] ?? 0,
              duration,
            );
            const selected = node.id === selectedNodeId;
            const markerShape = node.kind === "keyframe" ? "triangle" : "circle";
            return (
              <button
                key={`kind:${node.id}`}
                data-testid="capture-timeline-node-kind-marker"
                data-node-kind={node.kind}
                data-marker-shape={markerShape}
                type="button"
                title={`${node.kind === "keyframe" ? "Keyframe" : "Transition"} node`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectNode(node.id);
                  onSelectTimelineTrack("camera-path");
                }}
                onDoubleClick={(event) => openCameraNodeKindPicker(event, node.id)}
                style={{
                  ...nodeKindMarkerButtonStyle,
                  left: markerLeft,
                }}
              >
                <span
                  data-testid={
                    node.kind === "keyframe"
                      ? "capture-timeline-node-kind-keyframe"
                      : "capture-timeline-node-kind-transition"
                  }
                  aria-hidden="true"
                  style={
                    node.kind === "keyframe"
                      ? {
                          display: "block",
                          width: 0,
                          height: 0,
                          margin: "1px auto 0",
                          borderLeft: "6px solid transparent",
                          borderRight: "6px solid transparent",
                          borderBottom: selected
                            ? "12px solid rgba(255,255,255,1)"
                            : "12px solid rgba(255,255,255,0.86)",
                          filter: selected
                            ? "drop-shadow(0 0 8px rgba(255,255,255,0.5))"
                            : undefined,
                        }
                      : {
                          display: "block",
                          width: 11,
                          height: 11,
                          margin: "3px auto 0",
                          borderRadius: "50%",
                          background: selected
                            ? "rgba(255,255,255,1)"
                            : "rgba(255,255,255,0.86)",
                          boxShadow: selected
                            ? "0 0 8px rgba(255,255,255,0.48)"
                            : undefined,
                        }
                  }
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
