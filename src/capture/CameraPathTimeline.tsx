import { useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type {
  CaptureCameraPathV2,
  CaptureCameraPathV2Timeline,
} from "./captureCameraPathV2";
import type {
  CaptureCameraPathV3,
  CaptureCameraPathV3Timeline,
} from "./captureCameraPathV3";
import type { CapturePathTimeCurve } from "./cameraPathTimelineLayout";
import { layoutCapturePathTimeline } from "./cameraPathTimelineLayout";

const rootStyle: CSSProperties = {
  position: "absolute",
  left: 24,
  right: 86,
  bottom: 24,
  minHeight: 136,
  display: "grid",
  gridTemplateColumns: "minmax(160px, 220px) minmax(0, 1fr)",
  gap: 10,
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(12, 15, 19, 0.68)",
  boxShadow: "0 18px 54px rgba(0,0,0,0.34)",
  backdropFilter: "blur(18px) saturate(150%)",
  pointerEvents: "auto",
};

const controlsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  minWidth: 0,
};

const headingStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  fontWeight: 760,
  letterSpacing: 0,
};

const statusStyle: CSSProperties = {
  color: "rgba(228,235,238,0.76)",
  fontVariantNumeric: "tabular-nums",
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

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "rgba(120,218,196,0.5)",
  background:
    "linear-gradient(180deg, rgba(54,158,139,0.9), rgba(30,102,91,0.92))",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
};

const trackStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "20px 20px 34px 20px 20px 20px 20px",
  gap: 6,
  minWidth: 0,
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

function formatElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function timelinePercent(seconds: number, duration: number): string {
  return `${Math.max(0, Math.min(100, (seconds / duration) * 100))}%`;
}

function rampCurvePoints(timeCurve: CapturePathTimeCurve): Array<{ t: number; value: number }> {
  if (timeCurve.ramp && timeCurve.ramp.length > 0) return timeCurve.ramp;
  if (timeCurve.mode === "ease-in") {
    return [
      { t: 0, value: 0 },
      { t: 0.45, value: 0.2 },
      { t: 1, value: 1 },
    ];
  }
  if (timeCurve.mode === "ease-out") {
    return [
      { t: 0, value: 0 },
      { t: 0.55, value: 0.8 },
      { t: 1, value: 1 },
    ];
  }
  if (timeCurve.mode === "ease-in-out") {
    return [
      { t: 0, value: 0 },
      { t: 0.3, value: 0.18 },
      { t: 0.7, value: 0.82 },
      { t: 1, value: 1 },
    ];
  }
  return [
    { t: 0, value: 0 },
    { t: 1, value: 1 },
  ];
}

function rampPolyline(timeCurve: CapturePathTimeCurve): string {
  return rampCurvePoints(timeCurve)
    .map((point) => {
      const x = Math.max(0, Math.min(1, point.t)) * 100;
      const y = 18 - Math.max(0, Math.min(1, point.value)) * 14;
      return `${x},${y}`;
    })
    .join(" ");
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
  onPlay,
  onRecordPreview,
  onScrub,
  onSelectNode,
  onSelectSegment,
  onSetNodeHoldSeconds,
  onSetSegmentTransitionSeconds,
  onStop,
  path,
  equationsSelectedOnly = false,
  selectedSegmentId = null,
  scrubSeconds,
  timeline,
}: {
  path: CaptureCameraPathV2 | CaptureCameraPathV3;
  timeline: CaptureCameraPathV2Timeline | CaptureCameraPathV3Timeline;
  equationsSelectedOnly?: boolean;
  selectedSegmentId?: string | null;
  scrubSeconds: number;
  canPlay: boolean;
  onScrub(seconds: number): void;
  onPlay(): void;
  onStop(): void;
  onRecordPreview(): void;
  onSelectNode(id: string): void;
  onSelectSegment(id: string): void;
  onSetNodeHoldSeconds(id: string, seconds: number): void;
  onSetSegmentTransitionSeconds(id: string, seconds: number): void;
}) {
  const duration = Math.max(0.1, timeline.durationSeconds);
  const blocks = layoutCapturePathTimeline({ timeline });
  const blockEquationVisible = (block: (typeof blocks)[number]): boolean =>
    block.equationVisible &&
    (!equationsSelectedOnly || block.segmentId === selectedSegmentId);
  const playheadLeft = `${Math.max(0, Math.min(100, (scrubSeconds / duration) * 100))}%`;
  const blocksLaneRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    blockId: string;
    kind: "hold" | "transition";
    nodeId?: string;
    segmentId?: string;
    startX: number;
    startDuration: number;
    pointerId: number;
  } | null>(null);

  const updateBlockDurationFromPointer = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    const drag = dragRef.current;
    const lane = blocksLaneRef.current;
    if (!drag || !lane) return;
    const laneWidth = Math.max(1, lane.getBoundingClientRect().width);
    const deltaSeconds = ((event.clientX - drag.startX) / laneWidth) * duration;
    const nextDuration = drag.startDuration + deltaSeconds;
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

  return (
    <div data-testid="capture-timeline-bar" data-capture-legacy-id="capture-path-lower-timeline" style={rootStyle}>
      <div style={controlsStyle}>
        <div style={headingStyle}>
          <span>Camera Path</span>
          <span data-testid="capture-timeline-timecode" style={statusStyle}>
            {formatElapsed(scrubSeconds)}
          </span>
        </div>
        <input
          data-testid="capture-timeline-scrubber"
          data-capture-legacy-id="capture-path-timeline-scrub"
          aria-label="Camera path timeline scrubber"
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={Math.max(0, Math.min(duration, scrubSeconds))}
          onChange={(event) => onScrub(Number(event.currentTarget.value))}
        />
        <div style={rowStyle}>
          <button data-testid="capture-timeline-play" type="button" disabled={!canPlay} onClick={onPlay} style={buttonStyle}>
            Play
          </button>
          <button data-testid="capture-timeline-pause" type="button" onClick={onStop} style={buttonStyle}>
            Pause
          </button>
          <button data-testid="capture-timeline-record-preview" type="button" disabled={!canPlay} onClick={onRecordPreview} style={primaryButtonStyle}>
            Record Preview
          </button>
        </div>
        <span data-testid="capture-timeline-duration" style={statusStyle}>
          Duration {formatElapsed(duration)}
        </span>
      </div>
      <div data-testid="capture-timeline-keyframe-track" style={trackStyle}>
        <div data-testid="capture-timeline-ruler" style={laneStyle}>
          <span style={laneLabelStyle}>Ruler</span>
        </div>
        <div data-testid="capture-timeline-ramp-lane" style={laneStyle}>
          <span style={laneLabelStyle}>Ramp</span>
          {blocks
            .filter((block) => block.kind === "transition")
            .map((block) => (
              <svg
                key={`ramp:${block.id}`}
                data-testid="capture-timeline-ramp-curve"
                data-block-id={block.id}
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  left: `${block.leftPercent}%`,
                  top: 0,
                  width: `${block.widthPercent}%`,
                  height: 20,
                  overflow: "visible",
                }}
              >
                <polyline
                  points={rampPolyline(block.timeCurve)}
                  fill="none"
                  stroke={blockEquationVisible(block) ? "#f8fafc" : "#93c5fd"}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ))}
          {blocks
            .filter((block) => block.kind === "transition" && blockEquationVisible(block))
            .map((block) => (
              <span
                key={`equation:${block.id}`}
                data-testid="capture-timeline-equation-marker"
                data-block-id={block.id}
                style={{
                  position: "absolute",
                  left: `${block.leftPercent + block.widthPercent / 2}%`,
                  top: 2,
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: "rgba(248,250,252,0.18)",
                  color: "#f8fafc",
                  fontSize: 10,
                  fontWeight: 760,
                  lineHeight: "16px",
                  textAlign: "center",
                  transform: "translateX(-50%)",
                }}
              >
                E
              </span>
            ))}
        </div>
        <div ref={blocksLaneRef} style={laneStyle}>
          <span style={laneLabelStyle}>Blocks</span>
          {blocks.map((block) => {
            const style: CSSProperties = {
              position: "absolute",
              left: `${block.leftPercent}%`,
              top: 5,
              height: 22,
              width: `${block.widthPercent}%`,
              minWidth: 7,
              borderRadius: 5,
              border:
                block.kind === "hold"
                  ? "1px solid rgba(120,218,196,0.68)"
                  : "1px solid rgba(147,197,253,0.62)",
              background:
                block.kind === "hold"
                  ? "rgba(120,218,196,0.28)"
                  : "rgba(147,197,253,0.24)",
              cursor: "pointer",
            };
            return (
              <button
                key={block.id}
                data-testid={block.kind === "hold" ? "capture-timeline-hold-block" : "capture-timeline-transition-block"}
                data-block-id={block.id}
                data-block-kind={block.kind}
                type="button"
                style={style}
                onClick={() =>
                  block.kind === "hold" && block.nodeId
                    ? onSelectNode(block.nodeId)
                    : block.segmentId
                      ? onSelectSegment(block.segmentId)
                      : undefined
                }
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
          <span data-testid="capture-timeline-playhead" style={{ ...playheadStyle, left: playheadLeft }} />
        </div>
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
      </div>
    </div>
  );
}
