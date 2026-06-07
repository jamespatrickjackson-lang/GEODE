import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  CAPTURE_PREVIEW_RESOLUTION_PRESET_ORDER,
  CAPTURE_REALTIME_FPS_OPTIONS,
  CAPTURE_RENDER_FPS_OPTIONS,
  CAPTURE_RENDER_RESOLUTION_PRESET_ORDER,
  CAPTURE_RESOLUTION_PRESETS,
} from "./captureResolution";
import {
  CAPTURE_MODE_LABELS,
  type ActiveCaptureMode,
  type CaptureDeterministicExportFormat,
  type CaptureFps,
  type CapturePreviewResolutionPresetId,
  type CaptureRenderResolutionPresetId,
} from "./captureTypes";
import {
  CAPTURE_PAGE_RANGE_TIMING_LABELS,
  CAPTURE_SCOPE_LABELS,
  type CapturePageRangeTiming,
  type CaptureScope,
} from "./capturePageRange";
import type { CaptureStillImageType } from "./screenCaptureSaveOptions";
import { useEditor } from "../editor/EditorContext";
import { useCaptureDirector } from "./CaptureDirectorProvider";
import { CameraPathLineItemEditor } from "./CameraPathLineItemEditor";
import { CameraPathTimeline } from "./CameraPathTimeline";
import { CameraPathTransitionEditor } from "./CameraPathTransitionEditor";
import {
  resolveCaptureCameraPathBezierSegment,
  resolveCaptureCameraPathV3Timeline,
} from "./captureCameraPathV3";

const CONTROL_BUTTON_SIZE_PX = 36;
const CONTROL_BUTTON_GAP_PX = 8;
const CONTROL_STACK_WIDTH_PX = CONTROL_BUTTON_SIZE_PX * 3 + CONTROL_BUTTON_GAP_PX * 2;
const CONTROL_STACK_GAP_PX = CONTROL_BUTTON_GAP_PX;

const launcherStyle: CSSProperties = {
  position: "absolute",
  zIndex: 48,
  width: CONTROL_BUTTON_SIZE_PX,
  height: CONTROL_BUTTON_SIZE_PX,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.24)",
  background: "rgba(18, 22, 26, 0.64)",
  color: "rgba(255,255,255,0.94)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  cursor: "pointer",
  boxShadow: "0 14px 42px rgba(0,0,0,0.28)",
  backdropFilter: "blur(18px) saturate(150%)",
};

const dotStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  background: "#ff453a",
  boxShadow: "0 0 0 4px rgba(255,69,58,0.18)",
};

const toolbarRootStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 47,
  pointerEvents: "none",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  fontSize: 12,
  color: "rgba(245,248,250,0.94)",
};

const dockStyle: CSSProperties = {
  position: "absolute",
  right: 24,
  top: 76,
  width: "min(420px, calc(100vw - 48px))",
  maxHeight: "calc(100vh - 178px)",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(12, 15, 19, 0.64)",
  boxShadow: "0 22px 68px rgba(0,0,0,0.34)",
  backdropFilter: "blur(18px) saturate(150%)",
  pointerEvents: "auto",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "0 2px 2px",
};

const sectionStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const barStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(22,26,31,0.76), rgba(12,15,19,0.58))",
  overflow: "hidden",
};

const barHeaderButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 34,
  border: 0,
  borderRadius: 0,
  background: "rgba(255,255,255,0.05)",
  color: "rgba(245,248,250,0.94)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "0 10px",
  fontSize: 12,
  fontWeight: 760,
  letterSpacing: 0,
  cursor: "pointer",
};

const barContentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  flexWrap: "wrap",
};

const sectionStyle: CSSProperties = {
  ...rowStyle,
  paddingTop: 7,
  borderTop: "1px solid rgba(255,255,255,0.08)",
};

const sectionLabelStyle: CSSProperties = {
  color: "rgba(236,242,246,0.84)",
  fontSize: 11,
  fontWeight: 720,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const headingStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  fontWeight: 760,
  letterSpacing: 0,
};

const labelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: "rgba(220,228,232,0.74)",
  whiteSpace: "nowrap",
};

const fieldStyle: CSSProperties = {
  height: 30,
  minWidth: 74,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.94)",
  padding: "0 26px 0 9px",
  fontSize: 12,
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

const renderButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "rgba(147,197,253,0.42)",
  background:
    "linear-gradient(180deg, rgba(39,86,141,0.84), rgba(26,52,88,0.88))",
};

const stopButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "rgba(255,131,112,0.52)",
  background:
    "linear-gradient(180deg, rgba(194,71,55,0.9), rgba(118,42,36,0.92))",
};

const statusStyle: CSSProperties = {
  color: "rgba(228,235,238,0.76)",
  fontVariantNumeric: "tabular-nums",
};

const errorStyle: CSSProperties = {
  color: "rgba(255,190,170,0.92)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const outputLinkStyle: CSSProperties = {
  ...buttonStyle,
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none",
};

const previewMonitorStyle: CSSProperties = {
  position: "absolute",
  left: 24,
  bottom: 148,
  width: 280,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(12,15,19,0.72)",
  boxShadow: "0 18px 54px rgba(0,0,0,0.34)",
  backdropFilter: "blur(18px) saturate(150%)",
  overflow: "hidden",
  pointerEvents: "auto",
};

const previewMonitorImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  aspectRatio: "16 / 9",
  objectFit: "cover",
  background: "rgba(255,255,255,0.06)",
};

const modeOptions: readonly ActiveCaptureMode[] = [
  "scene-only",
  "scene-annotations",
  "presentation-ui",
  "full-ui",
];

type CaptureDirectorSectionId = "realtime" | "render" | "still" | "camera-path";

function formatElapsed(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function formatSeconds(seconds: number): string {
  return `${Number.isFinite(seconds) ? seconds.toFixed(seconds >= 10 ? 0 : 1) : "0.0"}s`;
}

function pickerAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as Window & { showSaveFilePicker?: unknown })
      .showSaveFilePicker === "function"
  );
}

function CollapsibleCaptureSection({
  children,
  expanded,
  headerTestId,
  onToggle,
  panelTestId,
  status,
  title,
}: {
  children: ReactNode;
  expanded: boolean;
  headerTestId: string;
  onToggle(): void;
  panelTestId: string;
  status: ReactNode;
  title: string;
}) {
  return (
    <section data-testid={panelTestId} style={barStyle}>
      <button
        data-testid={headerTestId}
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        style={barHeaderButtonStyle}
      >
        <span>{expanded ? "v" : ">"} {title}</span>
        <span style={statusStyle}>{status}</span>
      </button>
      {expanded && <div style={barContentStyle}>{children}</div>}
    </section>
  );
}

export function CaptureDirectorToolbar() {
  const { state: editorState } = useEditor();
  const recipeFileInputRef = useRef<HTMLInputElement | null>(null);
  const pathFileInputRef = useRef<HTMLInputElement | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<CaptureDirectorSectionId, boolean>
  >({
    realtime: true,
    render: true,
    still: true,
    "camera-path": true,
  });
  const {
    directorPanel,
    setDirectorPanel,
    armedMode,
    setArmedMode,
    previewResolutionPresetId,
    setPreviewResolutionPresetId,
    renderResolutionPresetId,
    setRenderResolutionPresetId,
    renderResolution,
    fps,
    setFps,
    deterministicDurationSeconds,
    setDeterministicDurationSeconds,
    captureScope,
    setCaptureScope,
    pageRangeStartId,
    setPageRangeStartId,
    pageRangeEndId,
    setPageRangeEndId,
    pageRangeTiming,
    setPageRangeTiming,
    equalHoldSeconds,
    setEqualHoldSeconds,
    capturePageOptions,
    capturePageRange,
    captureCameraPathV2,
    captureCameraPathV3,
    cameraPathEquationOverlayOptions,
    cameraPathDisplayOptions,
    setCameraPathDisplayOptions,
    setCameraPathEquationOverlayOptions,
    cameraPathPreviewMonitor,
    selectedCameraPathKeyframeId,
    setSelectedCameraPathKeyframeId,
    selectedCameraPathNodeId,
    setSelectedCameraPathNodeId,
    selectedCameraPathSegmentId,
    setSelectedCameraPathSegmentId,
    cameraPathFocusPickNodeId,
    beginCameraPathFocusPick,
    cameraPathScrubTimeSeconds,
    setCameraPathScrubTimeSeconds,
    cameraPathVisible,
    setCameraPathVisible,
    cameraPathPlaying,
    cameraPathPlaybackValidation,
    cameraPathOutputUrl,
    cameraPathOutputFilename,
    saveCameraPath,
    loadCameraPathFromFile,
    playCameraPath,
    stopCameraPathPlayback,
    startCameraPathPreviewRecording,
    addCurrentCameraKeyframe,
    addCameraPathTransitionNode,
    setCameraPathNodeKind,
    setCameraPathNodeEnabled,
    setCameraPathNodeHidden,
    setCameraPathNodeHoldSecondsAfter,
    setCameraPathNodeLookMode,
    setCameraPathNodeSplineContinuity,
    setCameraPathNodeSplineCoupling,
    setCameraPathNodeSplineHandleLength,
    setCameraPathNodeSplineHandleMode,
    bindCameraPathFocusPoint,
    setCameraPathSegmentTransitionSeconds,
    setCameraPathSegmentEnabled,
    setCameraPathSegmentHidden,
    setCameraPathSegmentEasing,
    setCameraPathSegmentTimeCurve,
    setCameraPathSegmentContinuity,
    setCameraPathSegmentTension,
    setCameraPathSegmentBias,
    setCameraPathSegmentInfluence,
    setCameraPathSegmentAutoHandles,
    setCameraPathNodeAimGeometry,
    replaceCameraKeyframePose,
    jumpToCameraKeyframe,
    removeCameraKeyframe,
    clearCameraKeyframes,
    loadedRecipeFilename,
    recipeOutputUrl,
    recipeOutputFilename,
    saveRecipe,
    loadRecipeFromFile,
    clearLoadedRecipe,
    recordingStatus,
    isRecording,
    elapsedSeconds,
    outputUrl,
    outputFilename,
    pathPreviewMp4Status,
    pathPreviewMp4OutputUrl,
    pathPreviewMp4OutputFilename,
    pathPreviewMp4Progress,
    pathPreviewVideoSaveMessage,
    deterministicExportStatus,
    isDeterministicExporting,
    deterministicOutputUrl,
    deterministicOutputFilename,
    deterministicExportFormat,
    setDeterministicExportFormat,
    deterministicExportProgress,
    screenCaptureStatus,
    screenCaptureOptionsOpen,
    setScreenCaptureOptionsOpen,
    screenCaptureType,
    setScreenCaptureType,
    screenCaptureQuality,
    setScreenCaptureQuality,
    screenCaptureSaveMessage,
    screenCaptureOutputUrl,
    screenCaptureOutputFilename,
    externalStillJobUrl,
    externalStillJobFilename,
    externalStillJobCommand,
    pathRenderStatus,
    pathRenderOutputUrl,
    pathRenderOutputFilename,
    pathRenderProgress,
    pathRenderSaveMessage,
    error,
    availability,
    startRecording,
    stopRecording,
    startPathPreviewMp4Transcode,
    cancelPathPreviewMp4Transcode,
    savePathPreviewVideo,
    savePathPreviewMp4,
    startDeterministicExport,
    startPathDeterministicRender,
    cancelPathDeterministicRender,
    savePathRenderVideo,
    startScreenCapture,
    cancelDeterministicExport,
    resetRecording,
  } = useCaptureDirector();

  const open = directorPanel !== "closed";
  const gui = editorState.environment.scene?.gui ?? {};
  const navigator = gui.navigator ?? {};
  const navigatorOverride = navigator.useOverride === true;
  const navBottom = navigatorOverride ? navigator.bottom ?? 16 : 16;
  const launcherRight = editorState.presenterMode
    ? navBottom + CONTROL_BUTTON_SIZE_PX + CONTROL_BUTTON_GAP_PX
    : navBottom + CONTROL_STACK_WIDTH_PX + CONTROL_STACK_GAP_PX;
  const canStart =
    availability.mediaRecorder &&
    availability.supportedMimeType !== null &&
    (armedMode === "full-ui"
      ? availability.displayCapture
      : availability.canvasCaptureStream);
  const rangeValid = captureScope === "current-page" || capturePageRange.valid;
  const canExport =
    armedMode !== "full-ui" &&
    !isRecording &&
    !isDeterministicExporting &&
    rangeValid;
  const pageRangeSummary =
    captureScope === "page-range"
      ? capturePageRange.valid
        ? `${capturePageRange.pages.length} pages, ${formatSeconds(
            capturePageRange.durationSeconds,
          )}, ${capturePageRange.totalFrames} frames`
        : capturePageRange.errors.join(" ")
      : `Current page, ${formatSeconds(deterministicDurationSeconds)}, ${Math.max(
          1,
          Math.ceil(deterministicDurationSeconds * fps),
        )} frames`;
  const stillQualityDisabled = screenCaptureType === "png";
  const cameraPathTimeline = useMemo(
    () => resolveCaptureCameraPathV3Timeline(captureCameraPathV3),
    [captureCameraPathV3],
  );
  const timelineScrubSeconds = Math.min(
    Math.max(0, cameraPathScrubTimeSeconds),
    Math.max(0.1, cameraPathTimeline.durationSeconds || deterministicDurationSeconds),
  );
  const cameraPathRows = captureCameraPathV2.nodes;
  const cameraPathSegmentsByFromId = useMemo(
    () => new Map(captureCameraPathV2.segments.map((segment) => [segment.fromNodeId, segment])),
    [captureCameraPathV2.segments],
  );
  const cameraPathV3SegmentsById = useMemo(
    () => new Map(captureCameraPathV3.segments.map((segment) => [segment.id, segment])),
    [captureCameraPathV3.segments],
  );
  const cameraPathV3NodesById = useMemo(
    () => new Map(captureCameraPathV3.nodes.map((node) => [node.id, node])),
    [captureCameraPathV3.nodes],
  );
  const updateSectionExpanded = (sectionId: CaptureDirectorSectionId) => {
    setExpandedSections((sections) => ({
      ...sections,
      [sectionId]: !sections[sectionId],
    }));
  };
  const selectedNode =
    captureCameraPathV2.nodes.find((node) => node.id === selectedCameraPathNodeId) ??
    captureCameraPathV2.nodes.find((node) => node.id === selectedCameraPathKeyframeId) ??
    null;

  return (
    <>
      <button
        data-testid="capture-director-launcher"
        type="button"
        aria-label={open ? "Close Capture Director" : "Open Capture Director"}
        title={open ? "Close Capture Director" : "Open Capture Director"}
        onClick={() => setDirectorPanel(open ? "closed" : "realtime")}
        style={{ ...launcherStyle, right: launcherRight, bottom: navBottom }}
      >
        <span data-testid="capture-director-launcher-dot" style={dotStyle} />
      </button>

      {open && (
        <div
          data-testid="capture-director-toolbar"
          aria-label="Capture Director"
          style={toolbarRootStyle}
        >
          <div data-testid="capture-director-dock" style={dockStyle}>
            <div data-testid="capture-director-panel" style={headerStyle}>
              <span style={{ fontWeight: 780 }}>Capture Director</span>
              <span style={statusStyle}>
                {armedMode === "full-ui"
                  ? "Full UI tutorial capture"
                  : "App-owned marketing capture"}
              </span>
            </div>

            <div
              data-testid="capture-director-section-stack"
              style={sectionStackStyle}
            >
              <CollapsibleCaptureSection
                panelTestId="capture-realtime-panel"
                headerTestId="capture-realtime-header"
                title="Realtime Capture"
                expanded={expandedSections.realtime}
                onToggle={() => updateSectionExpanded("realtime")}
                status={
                  <span data-testid="capture-recording-state" style={statusStyle}>
                  {recordingStatus === "recording"
                    ? `Recording ${formatElapsed(elapsedSeconds)}`
                    : recordingStatus === "stopping"
                      ? "Stopping"
                      : recordingStatus === "complete"
                        ? "Ready"
                        : "Idle"}
                  </span>
                }
              >
              <div style={rowStyle}>
                <label style={labelStyle}>
                  <span>Mode</span>
                  <select
                    data-testid="capture-mode-select"
                    value={armedMode}
                    disabled={isRecording}
                    onChange={(event) => {
                      resetRecording();
                      setArmedMode(event.currentTarget.value as ActiveCaptureMode);
                    }}
                    style={fieldStyle}
                  >
                    {modeOptions.map((mode) => (
                      <option key={mode} value={mode}>
                        {CAPTURE_MODE_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Preview</span>
                  <select
                    data-testid="capture-preview-resolution-select"
                    value={previewResolutionPresetId}
                    disabled={isRecording}
                    onChange={(event) => {
                      const nextId =
                        event.currentTarget.value as CapturePreviewResolutionPresetId;
                      resetRecording();
                      setPreviewResolutionPresetId(nextId);
                      setFps(
                        nextId === "marketing-4k"
                          ? 30
                          : CAPTURE_RESOLUTION_PRESETS[nextId].defaultFps,
                      );
                    }}
                    style={fieldStyle}
                  >
                    {CAPTURE_PREVIEW_RESOLUTION_PRESET_ORDER.map((id) => (
                      <option key={id} value={id}>
                        {CAPTURE_RESOLUTION_PRESETS[id].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>FPS</span>
                  <select
                    data-testid="capture-fps-select"
                    value={fps}
                    disabled={isRecording}
                    onChange={(event) =>
                      setFps(Number(event.currentTarget.value) as CaptureFps)
                    }
                    style={fieldStyle}
                  >
                    {CAPTURE_REALTIME_FPS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={rowStyle}>
                <button
                  data-testid="capture-start"
                  type="button"
                  disabled={isRecording || !canStart}
                  onClick={() => void startRecording()}
                  style={{
                    ...primaryButtonStyle,
                    opacity: !isRecording && canStart ? 1 : 0.48,
                  }}
                >
                  Start Recording
                </button>
                <button
                  data-testid="capture-stop"
                  type="button"
                  disabled={!isRecording}
                  onClick={() => void stopRecording()}
                  style={{
                    ...stopButtonStyle,
                    opacity: isRecording ? 1 : 0.48,
                  }}
                >
                  Stop Recording
                </button>
                {outputUrl && (
                  <a
                    data-testid="capture-download"
                    href={outputUrl}
                    download={outputFilename ?? `geosee-capture-${armedMode}.webm`}
                    style={outputLinkStyle}
                  >
                    Download Preview
                  </a>
                )}
              </div>
              </CollapsibleCaptureSection>

              <CollapsibleCaptureSection
                panelTestId="capture-render-panel"
                headerTestId="capture-render-header"
                title="Render Out"
                expanded={expandedSections.render}
                onToggle={() => updateSectionExpanded("render")}
                status={
                  <span data-testid="capture-export-state" style={statusStyle}>
                  {deterministicExportStatus === "rendering"
                    ? `Rendering ${deterministicExportProgress.renderedFrames}/${deterministicExportProgress.totalFrames}`
                    : deterministicExportStatus === "encoding"
                      ? "Encoding"
                      : deterministicExportStatus === "complete"
                        ? "Ready"
                        : "Idle"}
                  </span>
                }
              >
              <div style={rowStyle}>
                <label style={labelStyle}>
                  <span>Mode</span>
                  <select
                    data-testid="capture-render-mode-select"
                    value={armedMode}
                    disabled={isRecording || isDeterministicExporting}
                    onChange={(event) => {
                      resetRecording();
                      setArmedMode(event.currentTarget.value as ActiveCaptureMode);
                    }}
                    style={fieldStyle}
                  >
                    {modeOptions.map((mode) => (
                      <option key={mode} value={mode}>
                        {CAPTURE_MODE_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Render</span>
                  <select
                    data-testid="capture-render-resolution-select"
                    value={renderResolutionPresetId}
                    disabled={isRecording || isDeterministicExporting}
                    onChange={(event) =>
                      setRenderResolutionPresetId(
                        event.currentTarget.value as CaptureRenderResolutionPresetId,
                      )
                    }
                    style={fieldStyle}
                  >
                    {CAPTURE_RENDER_RESOLUTION_PRESET_ORDER.map((id) => (
                      <option key={id} value={id}>
                        {CAPTURE_RESOLUTION_PRESETS[id].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>FPS</span>
                  <select
                    data-testid="capture-render-fps-select"
                    value={fps}
                    disabled={isRecording || isDeterministicExporting}
                    onChange={(event) =>
                      setFps(Number(event.currentTarget.value) as CaptureFps)
                    }
                    style={fieldStyle}
                  >
                    {CAPTURE_RENDER_FPS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Format</span>
                  <select
                    data-testid="capture-export-format-select"
                    value={deterministicExportFormat}
                    disabled={isRecording || isDeterministicExporting}
                    onChange={(event) =>
                      setDeterministicExportFormat(
                        event.currentTarget.value as CaptureDeterministicExportFormat,
                      )
                    }
                    style={fieldStyle}
                  >
                    <option value="mp4">MP4</option>
                    <option value="webm">WebM</option>
                  </select>
                </label>
              </div>
              <div style={sectionStyle}>
                <strong>Max Detail</strong>
                <span data-testid="capture-render-warning" style={statusStyle}>
                  No downsampling, exact {renderResolution.width}x{renderResolution.height}
                </span>
              </div>
              <div style={sectionStyle}>
                <span style={sectionLabelStyle}>Capture Scope</span>
                <label style={labelStyle}>
                  <span>Scope</span>
                  <select
                    data-testid="capture-scope-select"
                    value={captureScope}
                    disabled={isRecording || isDeterministicExporting}
                    onChange={(event) =>
                      setCaptureScope(event.currentTarget.value as CaptureScope)
                    }
                    style={fieldStyle}
                  >
                    <option value="current-page">{CAPTURE_SCOPE_LABELS["current-page"]}</option>
                    <option value="page-range">{CAPTURE_SCOPE_LABELS["page-range"]}</option>
                  </select>
                </label>
                {captureScope === "current-page" ? (
                  <label style={labelStyle}>
                    <span>Duration</span>
                    <input
                      data-testid="capture-duration-input"
                      type="number"
                      min={0.1}
                      max={600}
                      step={0.1}
                      value={deterministicDurationSeconds}
                      disabled={isRecording || isDeterministicExporting}
                      onChange={(event) =>
                        setDeterministicDurationSeconds(Number(event.currentTarget.value))
                      }
                      style={{ ...fieldStyle, width: 78, paddingRight: 9 }}
                    />
                  </label>
                ) : (
                  <>
                    <label style={labelStyle}>
                      <span>From</span>
                      <select
                        data-testid="capture-page-range-start"
                        value={pageRangeStartId ?? ""}
                        disabled={isRecording || isDeterministicExporting}
                        onChange={(event) => setPageRangeStartId(event.currentTarget.value)}
                        style={{ ...fieldStyle, maxWidth: 190 }}
                      >
                        {capturePageOptions.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={labelStyle}>
                      <span>To</span>
                      <select
                        data-testid="capture-page-range-end"
                        value={pageRangeEndId ?? ""}
                        disabled={isRecording || isDeterministicExporting}
                        onChange={(event) => setPageRangeEndId(event.currentTarget.value)}
                        style={{ ...fieldStyle, maxWidth: 190 }}
                      >
                        {capturePageOptions.map((page) => (
                          <option key={page.id} value={page.id}>
                            {page.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={labelStyle}>
                      <span>Timing</span>
                      <select
                        data-testid="capture-page-range-timing"
                        value={pageRangeTiming}
                        disabled={isRecording || isDeterministicExporting}
                        onChange={(event) =>
                          setPageRangeTiming(
                            event.currentTarget.value as CapturePageRangeTiming,
                          )
                        }
                        style={fieldStyle}
                      >
                        <option value="authored">
                          {CAPTURE_PAGE_RANGE_TIMING_LABELS.authored}
                        </option>
                        <option value="equal-holds">
                          {CAPTURE_PAGE_RANGE_TIMING_LABELS["equal-holds"]}
                        </option>
                      </select>
                    </label>
                    {pageRangeTiming === "equal-holds" && (
                      <label style={labelStyle}>
                        <span>Hold</span>
                        <input
                          data-testid="capture-page-range-equal-hold"
                          type="number"
                          min={0.1}
                          max={600}
                          step={0.1}
                          value={equalHoldSeconds}
                          disabled={isRecording || isDeterministicExporting}
                          onChange={(event) =>
                            setEqualHoldSeconds(Number(event.currentTarget.value))
                          }
                          style={{ ...fieldStyle, width: 72, paddingRight: 9 }}
                        />
                      </label>
                    )}
                  </>
                )}
                <span data-testid="capture-page-range-summary" style={statusStyle}>
                  {pageRangeSummary}
                </span>
              </div>
              <div style={sectionStyle}>
                <button
                  data-testid="capture-export-mp4"
                  type="button"
                  disabled={!canExport}
                  onClick={() => void startDeterministicExport()}
                  style={{ ...renderButtonStyle, opacity: canExport ? 1 : 0.48 }}
                >
                  {deterministicExportFormat === "webm" ? "Render WebM" : "Render MP4"}
                </button>
                {isDeterministicExporting && (
                  <button
                    data-testid="capture-cancel-export"
                    type="button"
                    onClick={cancelDeterministicExport}
                    style={stopButtonStyle}
                  >
                    Cancel Export
                  </button>
                )}
                {deterministicOutputUrl && (
                  <a
                    data-testid="capture-deterministic-download"
                    href={deterministicOutputUrl}
                    download={
                      deterministicOutputFilename ??
                      `geosee-capture-${armedMode}.${deterministicExportFormat}`
                    }
                    style={outputLinkStyle}
                  >
                    {deterministicExportFormat === "webm" ? "Download WebM" : "Download MP4"}
                  </a>
                )}
              </div>
              </CollapsibleCaptureSection>

              <CollapsibleCaptureSection
                panelTestId="capture-still-panel"
                headerTestId="capture-still-header"
                title="Still Capture"
                expanded={expandedSections.still}
                onToggle={() => updateSectionExpanded("still")}
                status={
                  <span style={statusStyle}>
                  {screenCaptureStatus === "rendering"
                    ? "Rendering"
                    : screenCaptureStatus === "complete"
                      ? "Ready"
                      : "Idle"}
                  </span>
                }
              >
              <div style={rowStyle}>
                <label style={labelStyle}>
                  <span>Still</span>
                  <select
                    data-testid="capture-still-resolution-select"
                    value={renderResolutionPresetId}
                    disabled={screenCaptureStatus === "rendering"}
                    onChange={(event) =>
                      setRenderResolutionPresetId(
                        event.currentTarget.value as CaptureRenderResolutionPresetId,
                      )
                    }
                    style={fieldStyle}
                  >
                    {CAPTURE_RENDER_RESOLUTION_PRESET_ORDER.map((id) => (
                      <option key={id} value={id}>
                        {CAPTURE_RESOLUTION_PRESETS[id].label}
                      </option>
                    ))}
                  </select>
                </label>
                <span style={statusStyle}>
                  Max Detail: On. No downsampling.
                </span>
                <button
                  data-testid="capture-screen-capture"
                  type="button"
                  disabled={
                    isRecording ||
                    isDeterministicExporting ||
                    screenCaptureStatus === "rendering"
                  }
                  onClick={() => setScreenCaptureOptionsOpen(!screenCaptureOptionsOpen)}
                  style={buttonStyle}
                >
                  Screen Capture
                </button>
              </div>
              {screenCaptureOptionsOpen && (
                <div data-testid="capture-screen-capture-options" style={sectionStyle}>
                  <label style={labelStyle}>
                    <span>Type</span>
                    <select
                      data-testid="capture-screen-type-select"
                      value={screenCaptureType}
                      onChange={(event) =>
                        setScreenCaptureType(
                          event.currentTarget.value as CaptureStillImageType,
                        )
                      }
                      style={fieldStyle}
                    >
                      <option value="png">PNG</option>
                      <option value="webp">WebP</option>
                      <option value="jpeg">JPEG</option>
                    </select>
                  </label>
                  <label style={labelStyle}>
                    <span>Quality</span>
                    <input
                      data-testid="capture-screen-quality-input"
                      type="number"
                      min={0.01}
                      max={1}
                      step={0.01}
                      value={screenCaptureQuality}
                      disabled={stillQualityDisabled}
                      onChange={(event) =>
                        setScreenCaptureQuality(Number(event.currentTarget.value))
                      }
                      style={{ ...fieldStyle, width: 76, paddingRight: 9 }}
                    />
                  </label>
                  <span data-testid="capture-screen-location" style={statusStyle}>
                    {pickerAvailable() ? "Location: save dialog" : "Location: download link"}
                  </span>
                  <button
                    data-testid="capture-screen-capture-run"
                    type="button"
                    onClick={() => void startScreenCapture()}
                    style={primaryButtonStyle}
                  >
                    Save Still
                  </button>
                  <button
                    data-testid="capture-screen-capture-cancel"
                    type="button"
                    onClick={() => setScreenCaptureOptionsOpen(false)}
                    style={buttonStyle}
                  >
                    Close
                  </button>
                </div>
              )}
              <div style={rowStyle}>
                {screenCaptureOutputUrl && (
                  <a
                    data-testid="capture-screen-download"
                    href={screenCaptureOutputUrl}
                    download={screenCaptureOutputFilename ?? "geosee-screen-capture.png"}
                    style={outputLinkStyle}
                  >
                    Download Still
                  </a>
                )}
                {externalStillJobUrl && (
                  <a
                    data-testid="capture-external-still-job-download"
                    href={externalStillJobUrl}
                    download={externalStillJobFilename ?? "geosee-external-still-job.json"}
                    style={outputLinkStyle}
                  >
                    External Still Job
                  </a>
                )}
                {externalStillJobCommand && (
                  <code
                    data-testid="capture-external-still-job-command"
                    style={{
                      maxWidth: 390,
                      overflowWrap: "anywhere",
                      color: "rgba(226, 232, 240, 0.82)",
                      fontSize: 11,
                      lineHeight: 1.45,
                    }}
                  >
                    {externalStillJobCommand}
                  </code>
                )}
                {screenCaptureSaveMessage && (
                  <span data-testid="capture-screen-save-message" style={statusStyle}>
                    {screenCaptureSaveMessage}
                  </span>
                )}
              </div>
              </CollapsibleCaptureSection>

              <CollapsibleCaptureSection
                panelTestId="capture-camera-path-panel"
                headerTestId="capture-camera-path-header"
                title="Camera Path"
                expanded={expandedSections["camera-path"]}
                onToggle={() => updateSectionExpanded("camera-path")}
                status={
                  <span style={statusStyle}>
                  {cameraPathPlaying ? "Playing" : `${captureCameraPathV2.nodes.length} views`}
                  </span>
                }
              >
              <section style={sectionStyle}>
                <span style={sectionLabelStyle}>Path Controls</span>
                <label style={labelStyle}>
                  <input
                    type="checkbox"
                    checked={cameraPathVisible}
                    onChange={(event) => setCameraPathVisible(event.currentTarget.checked)}
                  />
                  <span>Show Path</span>
                </label>
                <button data-testid="capture-keyframe-add" type="button" onClick={addCurrentCameraKeyframe} style={buttonStyle}>
                  Add Current Camera
                </button>
                <button data-testid="capture-path-add-transition" type="button" onClick={() => addCameraPathTransitionNode(selectedCameraPathSegmentId)} style={buttonStyle}>
                  Add Transition Node
                </button>
                <button data-testid="capture-keyframe-clear" type="button" onClick={clearCameraKeyframes} style={buttonStyle}>
                  Clear
                </button>
                <label style={labelStyle}>
                  <span>Path video</span>
                  <select
                    data-testid="capture-path-preview-resolution"
                    value={previewResolutionPresetId}
                    disabled={isRecording}
                    onChange={(event) => {
                      const nextId =
                        event.currentTarget.value as CapturePreviewResolutionPresetId;
                      resetRecording();
                      setPreviewResolutionPresetId(nextId);
                      setFps(
                        nextId === "marketing-4k"
                          ? 30
                          : CAPTURE_RESOLUTION_PRESETS[nextId].defaultFps,
                      );
                    }}
                    style={fieldStyle}
                  >
                    {CAPTURE_PREVIEW_RESOLUTION_PRESET_ORDER.map((id) => (
                      <option key={id} value={id}>
                        {CAPTURE_RESOLUTION_PRESETS[id].label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>FPS</span>
                  <select
                    data-testid="capture-path-preview-fps"
                    value={fps}
                    disabled={isRecording}
                    onChange={(event) =>
                      setFps(Number(event.currentTarget.value) as CaptureFps)
                    }
                    style={fieldStyle}
                  >
                    {CAPTURE_REALTIME_FPS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <button data-testid="capture-path-play" type="button" disabled={!cameraPathPlaybackValidation.valid} onClick={playCameraPath} style={buttonStyle}>
                  Play Path
                </button>
                <button data-testid="capture-path-pause" type="button" onClick={stopCameraPathPlayback} style={buttonStyle}>
                  Pause
                </button>
                <button data-testid="capture-path-record-start" type="button" disabled={!cameraPathPlaybackValidation.valid} onClick={() => void startCameraPathPreviewRecording()} style={primaryButtonStyle}>
                  Record Path Video
                </button>
                <button
                  data-testid="capture-path-record-stop"
                  type="button"
                  disabled={!isRecording}
                  onClick={() => {
                    stopCameraPathPlayback();
                    void stopRecording();
                  }}
                  style={buttonStyle}
                >
                  Stop Video
                </button>
                <span data-testid="capture-path-record-status" style={statusStyle}>
                  {isRecording
                    ? `Recording ${formatElapsed(elapsedSeconds)}`
                    : recordingStatus === "complete"
                      ? "Path video ready"
                      : "Path video idle"}
                </span>
                {outputUrl && (
                  <a
                    data-testid="capture-path-video-download"
                    href={outputUrl}
                    download={outputFilename ?? "geosee-camera-path-preview.webm"}
                    style={outputLinkStyle}
                  >
                    Download Preview WebM
                  </a>
                )}
                {outputUrl && (
                  <button
                    data-testid="capture-path-video-save-webm"
                    type="button"
                    onClick={() => void savePathPreviewVideo("webm")}
                    style={buttonStyle}
                  >
                    Save Preview WebM
                  </button>
                )}
                {outputUrl && pathPreviewMp4Status !== "complete" && (
                  <button
                    data-testid="capture-path-video-convert-mp4"
                    type="button"
                    disabled={
                      pathPreviewMp4Status === "encoding" ||
                      pathPreviewMp4Status === "preparing"
                    }
                    onClick={() => void startPathPreviewMp4Transcode()}
                    style={buttonStyle}
                  >
                    Convert Preview to MP4
                  </button>
                )}
                {pathPreviewMp4Status === "encoding" && (
                  <button
                    data-testid="capture-path-video-convert-cancel"
                    type="button"
                    onClick={cancelPathPreviewMp4Transcode}
                    style={buttonStyle}
                  >
                    Cancel MP4 Convert
                  </button>
                )}
                {pathPreviewMp4OutputUrl && (
                  <a
                    data-testid="capture-path-video-download-mp4"
                    href={pathPreviewMp4OutputUrl}
                    download={
                      pathPreviewMp4OutputFilename ??
                      "geosee-camera-path-preview.mp4"
                    }
                    style={outputLinkStyle}
                  >
                    Download Preview MP4
                  </a>
                )}
                {pathPreviewMp4OutputUrl && (
                  <button
                    data-testid="capture-path-video-save-mp4"
                    type="button"
                    onClick={() => void savePathPreviewMp4()}
                    style={buttonStyle}
                  >
                    Save Preview MP4
                  </button>
                )}
                {(pathPreviewVideoSaveMessage || pathPreviewMp4Progress.message) && (
                  <span data-testid="capture-path-video-save-status" style={statusStyle}>
                    {pathPreviewVideoSaveMessage ?? pathPreviewMp4Progress.message}
                  </span>
                )}
                {!cameraPathPlaybackValidation.valid && (
                  <span data-testid="capture-path-playback-warning" style={statusStyle}>
                    {cameraPathPlaybackValidation.errors[0]}
                  </span>
                )}
                <span style={sectionLabelStyle}>Render Path Video</span>
                <span style={statusStyle}>
                  Final deterministic render, {renderResolution.label},{" "}
                  {deterministicExportFormat === "webm" ? "WebM" : "MP4"}
                </span>
                <button
                  data-testid="capture-path-render-start"
                  type="button"
                  disabled={
                    !cameraPathPlaybackValidation.valid ||
                    isRecording ||
                    isDeterministicExporting ||
                    pathRenderStatus === "rendering" ||
                    pathRenderStatus === "encoding" ||
                    armedMode === "full-ui"
                  }
                  onClick={() => void startPathDeterministicRender()}
                  style={primaryButtonStyle}
                >
                  Render Path Video
                </button>
                <button
                  data-testid="capture-path-render-cancel"
                  type="button"
                  disabled={
                    pathRenderStatus !== "rendering" &&
                    pathRenderStatus !== "encoding"
                  }
                  onClick={cancelPathDeterministicRender}
                  style={buttonStyle}
                >
                  Cancel Path Render
                </button>
                <span data-testid="capture-path-render-status" style={statusStyle}>
                  {pathRenderStatus === "rendering"
                    ? `Rendering ${pathRenderProgress.renderedFrames ?? 0}/${pathRenderProgress.totalFrames ?? 0}`
                    : pathRenderStatus === "encoding"
                      ? pathRenderProgress.message ?? "Encoding path video. No file has been saved yet."
                      : pathRenderStatus === "complete"
                        ? "Rendered path video ready"
                        : pathRenderStatus === "failed"
                          ? "Path render failed"
                          : pathRenderStatus === "cancelled"
                            ? "Path render cancelled"
                            : "Path render idle"}
                </span>
                {(pathRenderStatus === "rendering" ||
                  pathRenderStatus === "encoding") && (
                  <span data-testid="capture-path-render-save-pending" style={statusStyle}>
                    No file has been saved yet. Save and download controls appear after encoding completes.
                  </span>
                )}
                {pathRenderOutputUrl && (
                  <button
                    data-testid="capture-path-render-save"
                    type="button"
                    onClick={() => void savePathRenderVideo()}
                    style={buttonStyle}
                  >
                    Save Rendered Video
                  </button>
                )}
                {pathRenderOutputUrl && (
                  <a
                    data-testid="capture-path-render-download"
                    href={pathRenderOutputUrl}
                    download={
                      pathRenderOutputFilename ??
                      `geosee-rendered-path.${deterministicExportFormat}`
                    }
                    style={outputLinkStyle}
                  >
                    Download Rendered Path Video
                  </a>
                )}
                {pathRenderSaveMessage && (
                  <span data-testid="capture-path-render-save-status" style={statusStyle}>
                    {pathRenderSaveMessage}
                  </span>
                )}
                <details data-testid="capture-path-render-details" style={statusStyle}>
                  <summary>Details</summary>
                  <span>
                    {deterministicExportFormat === "webm"
                      ? "Rendered WebM"
                      : "Rendered MP4"}{" "}
                    uses fixed frame time from the current Camera Path. Output is not written to disk during rendering or encoding; use Save Rendered Video or the download link after completion.
                  </span>
                </details>
              </section>
              <section data-testid="capture-keyframe-list" style={{ ...sectionStyle, alignItems: "stretch" }}>
                <span style={sectionLabelStyle}>Camera Views</span>
                {cameraPathRows.length === 0 ? (
                  <span style={statusStyle}>No camera views</span>
                ) : (
                  cameraPathRows.map((node, index) => {
                    const selected = node.id === (selectedCameraPathNodeId ?? selectedCameraPathKeyframeId);
                    const nextSegment = cameraPathSegmentsByFromId.get(node.id);
                    const nextNode = nextSegment
                      ? captureCameraPathV2.nodes.find((candidate) => candidate.id === nextSegment.toNodeId)
                      : null;
                    const nextV3Segment = nextSegment
                      ? cameraPathV3SegmentsById.get(nextSegment.id) ?? null
                      : null;
                    const nextV3FromNode = nextV3Segment
                      ? cameraPathV3NodesById.get(nextV3Segment.fromNodeId) ?? null
                      : null;
                    return (
                      <div key={node.id} style={{ display: "contents" }}>
                        <CameraPathLineItemEditor
                          index={index + 1}
                          node={node}
                          v3Node={cameraPathV3NodesById.get(node.id) ?? null}
                          selected={selected}
                          compatibilityIds={index === 0}
                          onSelect={(id) => {
                            setSelectedCameraPathNodeId(id);
                            setSelectedCameraPathKeyframeId(id);
                            setSelectedCameraPathSegmentId(null);
                          }}
                          onEnabledChange={setCameraPathNodeEnabled}
                          onHiddenChange={setCameraPathNodeHidden}
                          onKindChange={setCameraPathNodeKind}
                          onHoldChange={setCameraPathNodeHoldSecondsAfter}
                          onLookModeChange={(id, mode) => {
                            if (mode === "focus-point-lock") {
                              const target = captureCameraPathV2.nodes.find((candidate) => candidate.id === id)?.target;
                              if (target) bindCameraPathFocusPoint(id, `focus-${id}`, target);
                              else setCameraPathNodeLookMode(id, mode);
                              return;
                            }
                            setCameraPathNodeLookMode(id, mode);
                          }}
                          onSplineCouplingChange={setCameraPathNodeSplineCoupling}
                          onSplineHandleModeChange={setCameraPathNodeSplineHandleMode}
                          onSplineContinuityChange={setCameraPathNodeSplineContinuity}
                          onSplineHandleLengthChange={setCameraPathNodeSplineHandleLength}
                          onPickFocus={(id) => {
                            beginCameraPathFocusPick(id);
                          }}
                          onJump={(id) => {
                            const targetIndex = captureCameraPathV2.nodes.findIndex((candidate) => candidate.id === id);
                            const nodeTime = captureCameraPathV2.nodes[targetIndex]?.timeSeconds ?? 0;
                            setCameraPathScrubTimeSeconds(nodeTime);
                            if (targetIndex >= 0) jumpToCameraKeyframe(targetIndex);
                          }}
                          onUpdatePose={(id) => {
                            const targetIndex = captureCameraPathV2.nodes.findIndex((candidate) => candidate.id === id);
                            if (targetIndex >= 0) replaceCameraKeyframePose(targetIndex);
                          }}
                          onDelete={(id) => {
                            const targetIndex = captureCameraPathV2.nodes.findIndex((candidate) => candidate.id === id);
                            if (targetIndex >= 0) removeCameraKeyframe(targetIndex);
                          }}
                        />
                        {nextSegment && nextNode && (
                          <CameraPathTransitionEditor
                            displayIndex={index + 1}
                            fromIndex={index + 1}
                            toIndex={captureCameraPathV2.nodes.findIndex((candidate) => candidate.id === nextNode.id) + 1}
                            segment={nextSegment}
                            v3Segment={nextV3Segment}
                            fairingDiagnostics={
                              nextV3Segment
                                ? resolveCaptureCameraPathBezierSegment(
                                    captureCameraPathV3,
                                    nextV3Segment,
                                  ).diagnostics
                                : null
                            }
                            lensMode={nextV3FromNode?.aimGeometry.lensMode}
                            dollyZoomStrength={
                              nextV3FromNode?.aimGeometry.dollyZoomStrength ?? 0
                            }
                            selected={nextSegment.id === selectedCameraPathSegmentId}
                            onSelect={(id) => {
                              setSelectedCameraPathSegmentId(id);
                              setSelectedCameraPathNodeId(null);
                              setSelectedCameraPathKeyframeId(null);
                            }}
                            onEnabledChange={setCameraPathSegmentEnabled}
                            onHiddenChange={setCameraPathSegmentHidden}
                            onDurationChange={setCameraPathSegmentTransitionSeconds}
                            onEasingChange={setCameraPathSegmentEasing}
                            onTimeCurveChange={setCameraPathSegmentTimeCurve}
                            onContinuityChange={setCameraPathSegmentContinuity}
                            onTensionChange={setCameraPathSegmentTension}
                            onBiasChange={setCameraPathSegmentBias}
                            onInfluenceChange={setCameraPathSegmentInfluence}
                            onAutoHandlesChange={setCameraPathSegmentAutoHandles}
                            onLensModeChange={(id, lensMode) => {
                              const segment = cameraPathV3SegmentsById.get(id);
                              if (!segment) return;
                              setCameraPathNodeAimGeometry(segment.fromNodeId, {
                                lensMode,
                              });
                            }}
                            onDollyStrengthChange={(id, dollyZoomStrength) => {
                              const segment = cameraPathV3SegmentsById.get(id);
                              if (!segment) return;
                              setCameraPathNodeAimGeometry(segment.fromNodeId, {
                                dollyZoomStrength,
                              });
                            }}
                            onEquationSelectedChange={(id, checked) => {
                              setSelectedCameraPathSegmentId(checked ? id : null);
                              setCameraPathEquationOverlayOptions({
                                visible: checked,
                                selectedTransitionOnly: true,
                              });
                            }}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </section>
              {selectedNode && (
                <section style={sectionStyle}>
                  <span style={sectionLabelStyle}>Look And Focus</span>
                  <span style={statusStyle}>
                    Selected {selectedNode.kind} {selectedNode.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      beginCameraPathFocusPick(selectedNode.id);
                    }}
                    style={buttonStyle}
                  >
                    Pick Focus Point
                  </button>
                  {cameraPathFocusPickNodeId === selectedNode.id && (
                    <span style={statusStyle}>Click the scene to set focus</span>
                  )}
                  <label style={labelStyle}>
                    <input
                      data-testid="capture-timeline-tie-toggle"
                      type="checkbox"
                      checked
                      readOnly
                    />
                    <span>Tie lanes</span>
                  </label>
                </section>
              )}
              <section data-testid="capture-path-options-panel" style={sectionStyle}>
                <span style={sectionLabelStyle}>Camera Path Options</span>
                <label style={labelStyle}>
                  <span>Track</span>
                  <input
                    data-testid="capture-path-track-color"
                    aria-label="Camera path track color"
                    type="color"
                    value={cameraPathDisplayOptions.trackColor}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        trackColor: event.currentTarget.value,
                      })
                    }
                    style={{ ...fieldStyle, width: 44, minWidth: 44, padding: 2 }}
                  />
                </label>
                <label style={labelStyle}>
                  <span>Selected</span>
                  <input
                    data-testid="capture-path-selected-color"
                    aria-label="Camera path selected color"
                    type="color"
                    value={cameraPathDisplayOptions.selectedColor}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        selectedColor: event.currentTarget.value,
                      })
                    }
                    style={{ ...fieldStyle, width: 44, minWidth: 44, padding: 2 }}
                  />
                </label>
                <label style={labelStyle}>
                  <span>Target</span>
                  <input
                    data-testid="capture-path-target-color"
                    aria-label="Camera path target color"
                    type="color"
                    value={cameraPathDisplayOptions.targetColor}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        targetColor: event.currentTarget.value,
                      })
                    }
                    style={{ ...fieldStyle, width: 44, minWidth: 44, padding: 2 }}
                  />
                </label>
                <label style={labelStyle}>
                  <span>Focus</span>
                  <input
                    data-testid="capture-path-focus-color"
                    aria-label="Camera path focus color"
                    type="color"
                    value={cameraPathDisplayOptions.focusColor}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        focusColor: event.currentTarget.value,
                      })
                    }
                    style={{ ...fieldStyle, width: 44, minWidth: 44, padding: 2 }}
                  />
                </label>
                <label style={labelStyle}>
                  <span>Line</span>
                  <input
                    data-testid="capture-path-line-size"
                    aria-label="Camera path line size"
                    type="number"
                    min={1}
                    max={12}
                    step={1}
                    value={cameraPathDisplayOptions.trackLineSize}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        trackLineSize: Number(event.currentTarget.value),
                      })
                    }
                    style={{ ...fieldStyle, width: 60, minWidth: 60, paddingRight: 9 }}
                  />
                </label>
                <label style={labelStyle}>
                  <span>Handles</span>
                  <input
                    data-testid="capture-path-handle-scale"
                    aria-label="Camera path handle size"
                    type="number"
                    min={24}
                    max={360}
                    step={6}
                    value={cameraPathDisplayOptions.handleScale}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        handleScale: Number(event.currentTarget.value),
                      })
                    }
                    style={{ ...fieldStyle, width: 72, minWidth: 72, paddingRight: 9 }}
                  />
                </label>
                <label style={labelStyle}>
                  <span>Ray</span>
                  <input
                    data-testid="capture-path-direction-ray-length"
                    aria-label="Camera path direction ray length"
                    type="number"
                    min={0.25}
                    max={12}
                    step={0.25}
                    value={cameraPathDisplayOptions.directionRayLength}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        directionRayLength: Number(event.currentTarget.value),
                      })
                    }
                    style={{ ...fieldStyle, width: 62, minWidth: 62, paddingRight: 9 }}
                  />
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-frustum"
                    type="checkbox"
                    checked={cameraPathDisplayOptions.showCameraFrustum}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        showCameraFrustum: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Frustum</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-look-rays"
                    type="checkbox"
                    checked={cameraPathDisplayOptions.showLookRays}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        showLookRays: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Look rays</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-focus-rays"
                    type="checkbox"
                    checked={cameraPathDisplayOptions.showFocusLockRays}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        showFocusLockRays: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Focus rays</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-node-labels"
                    type="checkbox"
                    checked={cameraPathDisplayOptions.showNodeLabels}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        showNodeLabels: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Labels</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-timeline-ghost"
                    type="checkbox"
                    checked={cameraPathDisplayOptions.showTimelineGhost}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        showTimelineGhost: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Ghost</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-spline-controls"
                    type="checkbox"
                    checked={cameraPathDisplayOptions.showSplineControls}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        showSplineControls: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Spline controls</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-xyz-handles"
                    type="checkbox"
                    checked={cameraPathDisplayOptions.showXyzHandles}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        showXyzHandles: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>XYZ handles</span>
                </label>
                <label style={labelStyle}>
                  <span>Default handles</span>
                  <select
                    data-testid="capture-path-default-spline-coupling"
                    value={cameraPathDisplayOptions.defaultSplineCoupling}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        defaultSplineCoupling: event.currentTarget.value as
                          | "tangent"
                          | "non-tangent",
                      })
                    }
                    style={fieldStyle}
                  >
                    <option value="tangent">Tangent</option>
                    <option value="non-tangent">Non-tangent</option>
                  </select>
                </label>
                <label style={labelStyle}>
                  <span>Monitor</span>
                  <select
                    data-testid="capture-path-preview-monitor-mode"
                    aria-label="Camera monitor mode"
                    value={cameraPathDisplayOptions.previewMonitorMode}
                    onChange={(event) =>
                      setCameraPathDisplayOptions({
                        previewMonitorMode: event.currentTarget.value as
                          | "off"
                          | "selected-node"
                          | "scrub-time"
                          | "while-editing",
                      })
                    }
                    style={fieldStyle}
                  >
                    <option value="off">Off</option>
                    <option value="selected-node">Selected</option>
                    <option value="scrub-time">Scrub</option>
                    <option value="while-editing">Editing</option>
                  </select>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-equations"
                    type="checkbox"
                    checked={cameraPathEquationOverlayOptions.visible}
                    onChange={(event) =>
                      setCameraPathEquationOverlayOptions({
                        visible: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Equations</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-equations-selected-only"
                    type="checkbox"
                    checked={cameraPathEquationOverlayOptions.selectedTransitionOnly}
                    onChange={(event) =>
                      setCameraPathEquationOverlayOptions({
                        selectedTransitionOnly: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Selected only</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-stack-labels"
                    type="checkbox"
                    checked={cameraPathEquationOverlayOptions.showStackLabels}
                    onChange={(event) =>
                      setCameraPathEquationOverlayOptions({
                        showStackLabels: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Stack labels</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-temporal-ramp"
                    type="checkbox"
                    checked={cameraPathEquationOverlayOptions.showTemporalRamp}
                    onChange={(event) =>
                      setCameraPathEquationOverlayOptions({
                        showTemporalRamp: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Temporal ramp</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-tangents"
                    type="checkbox"
                    checked={cameraPathEquationOverlayOptions.showTangents}
                    onChange={(event) =>
                      setCameraPathEquationOverlayOptions({
                        showTangents: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Tangents</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-influence-handles"
                    type="checkbox"
                    checked={cameraPathEquationOverlayOptions.showInfluenceHandles}
                    onChange={(event) =>
                      setCameraPathEquationOverlayOptions({
                        showInfluenceHandles: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Influence handles</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-curvature-comb"
                    type="checkbox"
                    checked={cameraPathEquationOverlayOptions.showCurvatureComb}
                    onChange={(event) =>
                      setCameraPathEquationOverlayOptions({
                        showCurvatureComb: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Curvature comb</span>
                </label>
                <label style={labelStyle}>
                  <input
                    data-testid="capture-path-show-focus-distance"
                    type="checkbox"
                    checked={cameraPathEquationOverlayOptions.showFocusDistance}
                    onChange={(event) =>
                      setCameraPathEquationOverlayOptions({
                        showFocusDistance: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Focus distance</span>
                </label>
              </section>
              <section style={sectionStyle}>
                <span style={sectionLabelStyle}>Path Files</span>
                <button
                  data-testid="capture-path-save"
                  type="button"
                  onClick={saveCameraPath}
                  style={buttonStyle}
                >
                  Save Path
                </button>
                <button
                  data-testid="capture-path-load"
                  type="button"
                  onClick={() => pathFileInputRef.current?.click()}
                  style={buttonStyle}
                >
                  Load Path
                </button>
                <input
                  ref={pathFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void loadCameraPathFromFile(file);
                    event.currentTarget.value = "";
                  }}
                />
                {cameraPathOutputUrl && (
                  <a
                    href={cameraPathOutputUrl}
                    download={cameraPathOutputFilename ?? "geosee-camera-path.json"}
                    style={outputLinkStyle}
                  >
                    Download Path
                  </a>
                )}
              </section>
              </CollapsibleCaptureSection>

              <section data-testid="capture-recipe-panel" style={barStyle}>
                <div style={barHeaderButtonStyle}>
                  <span>Recipe</span>
                  <span style={statusStyle}>{loadedRecipeFilename ?? "Current scene"}</span>
                </div>
                <div style={barContentStyle}>
                  <div style={rowStyle}>
                <button
                  data-testid="capture-save-recipe"
                  type="button"
                  onClick={saveRecipe}
                  style={buttonStyle}
                >
                  Save Recipe
                </button>
                <button
                  data-testid="capture-load-recipe"
                  type="button"
                  onClick={() => recipeFileInputRef.current?.click()}
                  style={buttonStyle}
                >
                  Load Recipe
                </button>
                <button
                  data-testid="capture-clear-recipe"
                  type="button"
                  onClick={clearLoadedRecipe}
                  style={buttonStyle}
                >
                  Clear Recipe
                </button>
                <input
                  data-testid="capture-recipe-file-input"
                  ref={recipeFileInputRef}
                  type="file"
                  accept="application/json,.json"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void loadRecipeFromFile(file);
                    event.currentTarget.value = "";
                  }}
                />
                {loadedRecipeFilename && (
                  <span data-testid="capture-recipe-status" style={statusStyle}>
                    {loadedRecipeFilename}
                  </span>
                )}
                {recipeOutputUrl && (
                  <a
                    data-testid="capture-recipe-download"
                    href={recipeOutputUrl}
                    download={recipeOutputFilename ?? "geosee-capture.capture.json"}
                    style={outputLinkStyle}
                  >
                    Download Recipe
                  </a>
                )}
                  </div>
                </div>
              </section>
            </div>
            {error && (
              <span data-testid="capture-error" title={error} style={errorStyle}>
                {error}
              </span>
            )}
          </div>
          {cameraPathPreviewMonitor.visible && (
            <aside
              data-testid="capture-path-preview-monitor"
              style={previewMonitorStyle}
            >
              {cameraPathPreviewMonitor.imageUrl ? (
                <img
                  alt="Camera path preview"
                  src={cameraPathPreviewMonitor.imageUrl}
                  style={previewMonitorImageStyle}
                />
              ) : (
                <div style={previewMonitorImageStyle} />
              )}
              <div style={{ ...barContentStyle, gap: 5, padding: 8 }}>
                <div style={headingStyle}>
                  <span>{cameraPathPreviewMonitor.label ?? "Camera Preview"}</span>
                  <span style={statusStyle}>
                    {formatElapsed(cameraPathPreviewMonitor.timeSeconds)}
                  </span>
                </div>
                <span style={statusStyle}>
                  {cameraPathPreviewMonitor.lookMode ?? "free-direction"}
                  {cameraPathPreviewMonitor.focusLocked ? " / focus locked" : ""}
                </span>
              </div>
            </aside>
          )}
          <CameraPathTimeline
            path={captureCameraPathV3}
            timeline={cameraPathTimeline}
            selectedSegmentId={selectedCameraPathSegmentId}
            equationsSelectedOnly={
              cameraPathEquationOverlayOptions.selectedTransitionOnly
            }
            scrubSeconds={timelineScrubSeconds}
            canPlay={cameraPathPlaybackValidation.valid}
            onScrub={setCameraPathScrubTimeSeconds}
            onPlay={playCameraPath}
            onStop={stopCameraPathPlayback}
            onRecordPreview={() => void startCameraPathPreviewRecording()}
            onSelectNode={(id) => {
              setSelectedCameraPathNodeId(id);
              setSelectedCameraPathKeyframeId(id);
              setSelectedCameraPathSegmentId(null);
            }}
            onSelectSegment={(id) => {
              setSelectedCameraPathSegmentId(id);
              setSelectedCameraPathNodeId(null);
              setSelectedCameraPathKeyframeId(null);
            }}
            onSetNodeHoldSeconds={setCameraPathNodeHoldSecondsAfter}
            onSetSegmentTransitionSeconds={setCameraPathSegmentTransitionSeconds}
          />
        </div>
      )}
    </>
  );
}
