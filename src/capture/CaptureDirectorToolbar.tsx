import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
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
  type CaptureScrollOutputFormat,
  type CaptureScrollQualityPreset,
  type CaptureScrollRangeMode,
} from "./captureTypes";
import {
  CAPTURE_PAGE_RANGE_TIMING_LABELS,
  CAPTURE_SCOPE_LABELS,
  type CapturePageRangeTiming,
  type CaptureScope,
} from "./capturePageRange";
import { DEFAULT_CAPTURE_SCROLL_FPS } from "./captureScrollTimeline";
import { scrollPackageOutputUrl } from "./localScrollPackageRunner";
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
import type { CaptureCameraPathNodeKindV2 } from "./captureCameraPathV2";
import { captureJobProgressPercent } from "./captureJobRuntime";
import {
  EDITOR_HEADING_BAR_BACKGROUND,
  EDITOR_PANEL_OUTER_RADIUS_PX,
  FROSTED_PANEL_OUTLINE,
  FROSTED_PANEL_SHADOW,
  TECHNICAL_MONO_FONT,
  vibrancyLabel,
  vibrancySecondaryLabel,
} from "../editor/styles";
import { CaptureSectionIcon, type CaptureIconName } from "./CaptureSectionIcons";

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
  color: vibrancyLabel,
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
  fontFamily: TECHNICAL_MONO_FONT,
  fontSize: 12,
  color: vibrancyLabel,
};

const dockStyle: CSSProperties = {
  position: "absolute",
  left: 24,
  top: 76,
  width: "min(420px, calc(100vw - 48px))",
  boxSizing: "border-box",
  maxHeight: "calc(100vh - 286px)",
  overflowY: "auto",
  overflowX: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  borderRadius: EDITOR_PANEL_OUTER_RADIUS_PX,
  border: FROSTED_PANEL_OUTLINE,
  background: EDITOR_HEADING_BAR_BACKGROUND,
  boxShadow: "none",
  backdropFilter: "blur(20px) saturate(145%)",
  WebkitBackdropFilter: "blur(20px) saturate(145%)",
  pointerEvents: "auto",
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
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
};

// Editor-style pill header: rounded ends, editor heading material, title + icon
// on the left, disclosure chevron at the right end, no trailing status text.
const barHeaderButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 38,
  border: "1px solid transparent",
  borderRadius: 999,
  background: EDITOR_HEADING_BAR_BACKGROUND,
  color: vibrancyLabel,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "0 18px",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0,
  cursor: "pointer",
};

const barHeaderRowStyle: CSSProperties = {
  width: "100%",
  minHeight: 38,
  border: "1px solid transparent",
  borderRadius: 999,
  background: EDITOR_HEADING_BAR_BACKGROUND,
  color: vibrancyLabel,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "0 14px 0 18px",
  boxSizing: "border-box",
};

const barHeaderToggleButtonStyle: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
  minHeight: 34,
  border: 0,
  borderRadius: 0,
  background: "transparent",
  color: vibrancyLabel,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: 0,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 0,
  cursor: "pointer",
};

const barHeaderTitleStyle: CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const barHeaderActionsStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  flex: "0 0 auto",
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
  color: vibrancySecondaryLabel,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0,
  textTransform: "uppercase",
};

const headingStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  fontWeight: 600,
  letterSpacing: 0,
};

const labelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  color: vibrancySecondaryLabel,
  whiteSpace: "nowrap",
};

const fieldStyle: CSSProperties = {
  height: 30,
  minWidth: 74,
  borderRadius: 8,
  border: "1px solid rgba(255, 255, 255, 0.1)",
  background: "rgba(18, 21, 24, 0.4)",
  color: vibrancyLabel,
  padding: "0 26px 0 9px",
  fontSize: 12,
  fontFamily: TECHNICAL_MONO_FONT,
  colorScheme: "dark",
};

const buttonStyle: CSSProperties = {
  height: 30,
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.06)",
  color: vibrancyLabel,
  padding: "0 13px",
  fontWeight: 600,
  fontSize: 12,
  fontFamily: TECHNICAL_MONO_FONT,
  cursor: "pointer",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "rgba(120, 218, 196, 0.5)",
  background: "rgba(54, 158, 139, 0.32)",
};

const cameraAddKindPopoverStyle: CSSProperties = {
  position: "fixed",
  zIndex: 80,
  display: "grid",
  gap: 6,
  minWidth: 142,
};

const renderButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "rgba(147, 197, 253, 0.42)",
  background: "rgba(39, 86, 141, 0.34)",
};

const stopButtonStyle: CSSProperties = {
  ...buttonStyle,
  borderColor: "rgba(255, 131, 112, 0.52)",
  background: "rgba(194, 71, 55, 0.34)",
};

const statusStyle: CSSProperties = {
  color: vibrancySecondaryLabel,
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

const summaryValueStyle: CSSProperties = {
  ...statusStyle,
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const progressTrackStyle: CSSProperties = {
  position: "relative",
  flex: "1 1 160px",
  minWidth: 120,
  height: 7,
  overflow: "hidden",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.09)",
};

const progressBarStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: 0,
  borderRadius: 999,
  background: "linear-gradient(90deg, rgba(120, 218, 196, 0.95), rgba(147, 197, 253, 0.95))",
};

const fieldHelpStyle: CSSProperties = {
  color: "rgba(226, 232, 240, 0.58)",
  fontSize: 11,
  lineHeight: 1.35,
};

const popoutBackdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 49,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  pointerEvents: "auto",
  background: "rgba(4, 7, 10, 0.34)",
};

const recordPopoutStyle: CSSProperties = {
  width: "min(620px, calc(100vw - 48px))",
  maxHeight: "calc(100vh - 96px)",
  overflowY: "auto",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 14,
  borderRadius: EDITOR_PANEL_OUTER_RADIUS_PX,
  border: FROSTED_PANEL_OUTLINE,
  background: EDITOR_HEADING_BAR_BACKGROUND,
  boxShadow: FROSTED_PANEL_SHADOW,
  backdropFilter: "blur(20px) saturate(145%)",
  WebkitBackdropFilter: "blur(20px) saturate(145%)",
  color: vibrancyLabel,
  fontFamily: TECHNICAL_MONO_FONT,
};

const popoutGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
};

const popoutFieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  minWidth: 0,
};

const recipeActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  minWidth: 0,
};

const bottomActionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  paddingTop: 2,
  minWidth: 0,
};

const recipeIconButtonStyle: CSSProperties = {
  ...buttonStyle,
  width: 32,
  minWidth: 32,
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const recipeIconLinkStyle: CSSProperties = {
  ...recipeIconButtonStyle,
  textDecoration: "none",
};

const transportActionsStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 7,
  flex: "0 0 auto",
};

const transportButtonStyle: CSSProperties = {
  ...recipeIconButtonStyle,
};

const transportPrimaryButtonStyle: CSSProperties = {
  ...transportButtonStyle,
  borderColor: "rgba(120, 218, 196, 0.5)",
  background: "rgba(54, 158, 139, 0.32)",
};

const playIconStyle: CSSProperties = {
  width: 0,
  height: 0,
  borderTop: "6px solid transparent",
  borderBottom: "6px solid transparent",
  borderLeft: "9px solid rgba(255,255,255,0.94)",
  marginLeft: 2,
};

const pauseIconStyle: CSSProperties = {
  width: 10,
  height: 12,
  borderLeft: "4px solid rgba(255,255,255,0.94)",
  borderRight: "4px solid rgba(255,255,255,0.94)",
};

const recordIconStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 999,
  background: "#ff3b3b",
  boxShadow: "0 0 0 2px rgba(255,255,255,0.16)",
};

const stopIconStyle: CSSProperties = {
  width: 11,
  height: 11,
  borderRadius: 2,
  background: "rgba(255,255,255,0.94)",
};

const TRANSPORT_ICON_STYLE: Record<
  "play" | "pause" | "record" | "stop",
  CSSProperties
> = {
  play: playIconStyle,
  pause: pauseIconStyle,
  record: recordIconStyle,
  stop: stopIconStyle,
};

// Shared compact transport control. All container transports (Play / Pause /
// Record / Stop) render as icon buttons; Stop sits at the end.
function TransportIconButton({
  testId,
  label,
  icon,
  onClick,
  disabled,
  primary,
}: {
  testId: string;
  label: string;
  icon: "play" | "pause" | "record" | "stop";
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      data-testid={testId}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...(primary ? transportPrimaryButtonStyle : transportButtonStyle),
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <span aria-hidden="true" style={TRANSPORT_ICON_STYLE[icon]} />
    </button>
  );
}

const previewMonitorPanelStyle: CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(12,15,19,0.72)",
  boxShadow: "0 12px 34px rgba(0,0,0,0.24)",
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

type ScrollQualityOption = {
  id: CaptureScrollQualityPreset;
  label: string;
  width: number;
  height: number;
};

const scrollFormatOptions: Array<{ id: CaptureScrollOutputFormat; label: string }> = [
  { id: "mp4", label: "MP4" },
  { id: "webm", label: "WebM" },
  { id: "scroll-friendly-video", label: "Scroll-Friendly Video" },
  { id: "png-sequence", label: "PNG Sequence" },
];

const scrollQualityOptions: readonly ScrollQualityOption[] = [
  { id: "1080p", label: "1080p", width: 1920, height: 1080 },
  { id: "1440p", label: "1440p", width: 2560, height: 1440 },
  { id: "4k", label: "4K", width: 3840, height: 2160 },
  { id: "6k", label: "6K", width: 6144, height: 3456 },
  { id: "8k", label: "8K", width: 7680, height: 4320 },
];

type CaptureDirectorSectionId =
  | "realtime"
  | "render"
  | "still"
  | "scroll-animation"
  | "camera-path";

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

function RecipeActionIcon({
  kind,
  testId,
}: {
  kind: "save" | "load" | "trash" | "download";
  testId: string;
}) {
  const path =
    kind === "save"
      ? "M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-6h8v6"
      : kind === "load"
        ? "M12 4v11m0 0-4-4m4 4 4-4M5 20h14"
        : kind === "trash"
          ? "M6 7h12M9 7V5h6v2m-7 0 1 13h6l1-13M10 10v7m4-7v7"
          : "M12 4v11m0 0 4-4m-4 4-4-4M5 20h14";
  return (
    <svg
      data-testid={testId}
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

function captureSectionIconName(title: string): CaptureIconName {
  const t = title.toLowerCase();
  if (t.includes("realtime")) return "realtime";
  if (t.includes("render")) return "render";
  if (t.includes("still")) return "still";
  if (t.includes("scroll")) return "timeline";
  if (t.includes("camera path") || t.includes("path")) return "camera-path";
  if (t.includes("timeline")) return "timeline";
  return "render";
}

const barHeadingStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontWeight: 600,
};

const barChevronStyle: CSSProperties = {
  width: 7,
  height: 7,
  borderRight: "2px solid rgba(244, 240, 232, 0.7)",
  borderBottom: "2px solid rgba(244, 240, 232, 0.7)",
  transformOrigin: "center",
  transition: "transform 160ms ease",
  flex: "none",
};

function CaptureBarHeading({ title }: { title: string }) {
  return (
    <span style={barHeadingStyle}>
      <CaptureSectionIcon name={captureSectionIconName(title)} />
      {title}
    </span>
  );
}

function CaptureBarChevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        ...barChevronStyle,
        transform: expanded ? "rotate(45deg)" : "rotate(-45deg)",
      }}
    />
  );
}

function CollapsibleCaptureSection({
  children,
  expanded,
  headerActions,
  headerTestId,
  onToggle,
  panelTestId,
  title,
}: {
  children: ReactNode;
  expanded: boolean;
  headerActions?: ReactNode;
  headerTestId: string;
  onToggle(): void;
  panelTestId: string;
  status?: ReactNode;
  title: string;
}) {
  return (
    <section data-testid={panelTestId} style={barStyle}>
      {headerActions ? (
        <div style={barHeaderRowStyle}>
          <button
            data-testid={headerTestId}
            type="button"
            aria-expanded={expanded}
            onClick={onToggle}
            style={barHeaderToggleButtonStyle}
          >
            <span style={barHeaderTitleStyle}>
              <CaptureBarHeading title={title} />
            </span>
            <CaptureBarChevron expanded={expanded} />
          </button>
          <div style={barHeaderActionsStyle}>{headerActions}</div>
        </div>
      ) : (
        <button
          data-testid={headerTestId}
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          style={barHeaderButtonStyle}
        >
          <CaptureBarHeading title={title} />
          <CaptureBarChevron expanded={expanded} />
        </button>
      )}
      {expanded && <div style={barContentStyle}>{children}</div>}
    </section>
  );
}

function getScrollDialogFocusableElements(dialog: HTMLElement | null) {
  if (!dialog) {
    return [];
  }
  const selectors = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  return Array.from(dialog.querySelectorAll<HTMLElement>(selectors)).filter(
    (element) =>
      element.tabIndex >= 0 && element.getAttribute("aria-disabled") !== "true",
  );
}

export function CaptureDirectorToolbar() {
  const { state: editorState } = useEditor();
  const recipeFileInputRef = useRef<HTMLInputElement | null>(null);
  const pathFileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollPopoutDialogRef = useRef<HTMLDivElement | null>(null);
  const scrollPopoutRestoreFocusRef = useRef<HTMLElement | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<CaptureDirectorSectionId, boolean>
  >({
    realtime: false,
    render: false,
    still: false,
    "scroll-animation": false,
    "camera-path": false,
  });
  const [cameraAddKindPopover, setCameraAddKindPopover] = useState<{
    x: number;
    y: number;
    source: "panel" | "timeline";
  } | null>(null);
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
    captureTimeline,
    selectedTimelineTrack,
    setSelectedTimelineTrack,
    addCurrentPageClip,
    addPageClip,
    addPageRangeClips,
    replacePageClipPage,
    removePageClip,
    clearPageClips,
    editPageClipFrames,
    setPageClipLocked,
    selectPageClip,
    resizeTimelineBoundary,
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
    setScrollPlayheadSeconds,
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
    addCurrentCameraAsKind,
    addCameraPathTransitionNode,
    addCameraPathOrbit360,
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
    saveCameraPathPreviewStill,
    externalVideoJobUrl,
    externalVideoJobFilename,
    externalVideoJobCommand,
    captureJobs,
    pathRenderStatus,
    pathRenderOutputUrl,
    pathRenderOutputFilename,
    pathRenderProgress,
    pathRenderSaveMessage,
    scrollOutputFormats,
    toggleScrollOutputFormat,
    scrollQualityPreset,
    setScrollQualityPreset,
    scrollRangeMode,
    setScrollRangeMode,
    scrollStartFrame,
    setScrollStartFrame,
    scrollEndFrame,
    setScrollEndFrame,
    scrollSaveDestination,
    setScrollSaveDestination,
    scrollOutputPackageName,
    setScrollOutputPackageName,
    scrollAdvancedOpen,
    setScrollAdvancedOpen,
    scrollAdvancedBitrateMbps,
    setScrollAdvancedBitrateMbps,
    scrollAdvancedKeyframeInterval,
    setScrollAdvancedKeyframeInterval,
    scrollAdvancedAllKeyframe,
    setScrollAdvancedAllKeyframe,
    scrollPreviewTrace,
    playScrollPreview,
    pauseScrollPreview,
    stopScrollPreview,
    scrollRecordPopoutOpen,
    setScrollRecordPopoutOpen,
    lastScrollPackagePath,
    lastScrollManifestPath,
    scrollRecordValidationErrors,
    acceptScrollRenderShell,
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

  const closeScrollRecordPopout = useCallback(() => {
    setScrollRecordPopoutOpen(false);
  }, [setScrollRecordPopoutOpen]);

  const openScrollRecordPopout = useCallback(() => {
    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;
      scrollPopoutRestoreFocusRef.current =
        activeElement instanceof HTMLElement ? activeElement : null;
    }
    setScrollRecordPopoutOpen(true);
  }, [setScrollRecordPopoutOpen]);

  const openCameraAddKindPopover = useCallback(
    (
      event: ReactMouseEvent<HTMLElement>,
      source: "panel" | "timeline" = "panel",
    ) => {
      event.preventDefault();
      event.stopPropagation();
      setCameraAddKindPopover({
        x: Math.min(window.innerWidth - 168, Math.max(8, event.clientX + 8)),
        y: Math.min(window.innerHeight - 94, Math.max(8, event.clientY + 8)),
        source,
      });
    },
    [],
  );

  const addCameraFromKindPopover = useCallback(
    (kind: CaptureCameraPathNodeKindV2) => {
      addCurrentCameraAsKind(kind);
      setCameraAddKindPopover(null);
    },
    [addCurrentCameraAsKind],
  );

  useEffect(() => {
    if (!scrollRecordPopoutOpen) {
      return undefined;
    }

    const focusableElements = getScrollDialogFocusableElements(
      scrollPopoutDialogRef.current,
    );
    (focusableElements[0] ?? scrollPopoutDialogRef.current)?.focus();

    const handleScrollPopoutKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeScrollRecordPopout();
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      const dialog = scrollPopoutDialogRef.current;
      const dialogFocusableElements = getScrollDialogFocusableElements(dialog);
      if (dialogFocusableElements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const firstFocusableElement = dialogFocusableElements[0];
      const lastFocusableElement =
        dialogFocusableElements[dialogFocusableElements.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && activeElement === firstFocusableElement) {
        event.preventDefault();
        lastFocusableElement.focus();
      } else if (!event.shiftKey && activeElement === lastFocusableElement) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    };

    document.addEventListener("keydown", handleScrollPopoutKeyDown);
    return () => {
      document.removeEventListener("keydown", handleScrollPopoutKeyDown);
      const restoreFocusElement = scrollPopoutRestoreFocusRef.current;
      scrollPopoutRestoreFocusRef.current = null;
      if (restoreFocusElement && document.contains(restoreFocusElement)) {
        restoreFocusElement.focus();
      }
    };
  }, [closeScrollRecordPopout, scrollRecordPopoutOpen]);

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
  const deterministicVideoJob = [...captureJobs]
    .reverse()
    .find((job) => job.kind === "deterministic-video");
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
  const scrollQuality =
    scrollQualityOptions.find((option) => option.id === scrollQualityPreset) ??
    scrollQualityOptions[2];
  const scrollFrameStart = Math.max(0, Math.floor(scrollStartFrame));
  const scrollFrameEnd = Math.max(scrollFrameStart, Math.floor(scrollEndFrame));
  const scrollPageClips = captureTimeline.pageClips.filter((clip) => clip.enabled);
  const scrollPageBarDurationSeconds = scrollPageClips.reduce(
    (duration, clip) =>
      Math.max(
        duration,
        clip.startSeconds + clip.transitionSeconds + clip.holdSeconds,
      ),
    0,
  );
  const scrollTimelineDurationSeconds =
    scrollPageClips.length > 0
      ? Math.max(0.1, scrollPageBarDurationSeconds)
      : deterministicDurationSeconds;
  const scrollFullFrameCount = Math.max(
    1,
    Math.ceil(scrollTimelineDurationSeconds * DEFAULT_CAPTURE_SCROLL_FPS),
  );
  const scrollEstimatedFrameCount =
    scrollRangeMode === "frame-range"
      ? scrollFrameEnd - scrollFrameStart + 1
      : scrollFullFrameCount;
  const scrollRenderSizeLabel = `${scrollQuality.width} x ${scrollQuality.height}`;
  const scrollOutputReady = Boolean(lastScrollPackagePath || lastScrollManifestPath);
  const scrollPackageJob = [...captureJobs]
    .reverse()
    .find((job) => job.kind === "scroll-package");
  const scrollPackagePercent = captureJobProgressPercent(scrollPackageJob);
  const scrollPackageRenderedFrames =
    scrollPackageJob?.progress.renderedFrames ?? 0;
  const scrollPackageTotalFrames =
    scrollPackageJob?.progress.totalFrames ?? scrollEstimatedFrameCount;
  const scrollPackageStatusLabel =
    scrollPackageJob?.status === "complete"
      ? "Complete"
      : scrollPackageJob?.status === "failed"
        ? "Failed"
        : scrollPackageJob?.status === "cancelled"
          ? "Cancelled"
          : scrollPackageJob?.status === "encoding" ||
              scrollPackageJob?.progress.phase === "encoding"
            ? "Encoding"
            : scrollPackageJob?.status === "rendering"
              ? "Rendering"
              : scrollPackageJob
                ? "Preparing"
                : "Idle";
  const scrollPackageProgressLabel = scrollPackageJob
    ? scrollPackageJob.progress.message ??
      `${scrollPackageStatusLabel} ${scrollPackageRenderedFrames}/${scrollPackageTotalFrames} frames`
    : null;
  const scrollPackageDiagnostics = scrollPackageJob?.diagnostics ?? {};
  const scrollPackageRunId =
    typeof scrollPackageDiagnostics.localScrollPackageRunId === "string"
      ? scrollPackageDiagnostics.localScrollPackageRunId
      : null;
  const scrollManifestUrl =
    typeof scrollPackageDiagnostics.manifestUrl === "string"
      ? scrollPackageDiagnostics.manifestUrl
      : scrollPackageRunId
        ? scrollPackageOutputUrl(scrollPackageRunId, "manifest")
        : null;
  const scrollDiagnosticsUrl = scrollPackageRunId
    ? scrollPackageOutputUrl(scrollPackageRunId, "diagnostics")
    : null;
  const scrollMediaUrl =
    typeof scrollPackageDiagnostics.outputUrl === "string"
      ? scrollPackageDiagnostics.outputUrl
      : null;
  const scrollContactSheetUrl =
    typeof scrollPackageDiagnostics.contactSheetUrl === "string"
      ? scrollPackageDiagnostics.contactSheetUrl
      : null;
  const scrollReadmeUrl =
    typeof scrollPackageDiagnostics.readmeUrl === "string"
      ? scrollPackageDiagnostics.readmeUrl
      : null;
  const scrollPackageArtifactLinks = [
    { label: "Manifest", url: scrollManifestUrl },
    { label: "Diagnostics", url: scrollDiagnosticsUrl },
    { label: "Media", url: scrollMediaUrl },
    { label: "Contact Sheet", url: scrollContactSheetUrl },
    { label: "README", url: scrollReadmeUrl },
  ].filter((link): link is { label: string; url: string } => Boolean(link.url));
  const scrollRenderProgressLabel =
    scrollPackageProgressLabel ?? `Ready 0/${scrollEstimatedFrameCount} frames`;
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
  const recipeActions = (
    <div data-testid="capture-recipe-actions" style={recipeActionsStyle}>
      <button
        data-testid="capture-path-preview-save-4k"
        aria-label="Save Camera Path preview at 4K"
        title="Save Camera Path preview at 4K"
        type="button"
        disabled={!cameraPathPreviewMonitor.visible || screenCaptureStatus === "rendering"}
        onClick={() => void saveCameraPathPreviewStill()}
        style={{
          ...recipeIconButtonStyle,
          opacity:
            cameraPathPreviewMonitor.visible && screenCaptureStatus !== "rendering"
              ? 1
              : 0.45,
          cursor:
            cameraPathPreviewMonitor.visible && screenCaptureStatus !== "rendering"
              ? "pointer"
              : "not-allowed",
        }}
      >
        <RecipeActionIcon kind="save" testId="capture-path-preview-icon-save-4k" />
      </button>
      <button
        data-testid="capture-save-recipe"
        aria-label="Save recipe"
        title="Save recipe"
        type="button"
        onClick={saveRecipe}
        style={recipeIconButtonStyle}
      >
        <RecipeActionIcon kind="save" testId="capture-recipe-icon-save" />
      </button>
      <button
        data-testid="capture-load-recipe"
        aria-label="Load recipe"
        title="Load recipe"
        type="button"
        onClick={() => recipeFileInputRef.current?.click()}
        style={recipeIconButtonStyle}
      >
        <RecipeActionIcon kind="load" testId="capture-recipe-icon-load" />
      </button>
      <button
        data-testid="capture-clear-recipe"
        aria-label="Clear recipe"
        title="Clear recipe"
        type="button"
        onClick={clearLoadedRecipe}
        style={recipeIconButtonStyle}
      >
        <RecipeActionIcon kind="trash" testId="capture-recipe-icon-trash" />
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
      {recipeOutputUrl && (
        <a
          data-testid="capture-recipe-download"
          aria-label="Download recipe"
          title="Download recipe"
          href={recipeOutputUrl}
          download={recipeOutputFilename ?? "geosee-capture.capture.json"}
          style={recipeIconLinkStyle}
        >
          <RecipeActionIcon
            kind="download"
            testId="capture-recipe-icon-download"
          />
        </a>
      )}
    </div>
  );
  const timelineTransportActions = (
    <div
      data-testid="capture-timeline-transport-actions"
      style={transportActionsStyle}
    >
      <button
        data-testid="capture-timeline-play"
        aria-label="Play scroll timeline"
        title="Play scroll timeline"
        type="button"
        disabled={!cameraPathPlaybackValidation.valid}
        onClick={playScrollPreview}
        style={transportButtonStyle}
      >
        <span
          data-testid="capture-timeline-icon-play"
          aria-hidden="true"
          style={playIconStyle}
        />
      </button>
      <button
        data-testid="capture-timeline-pause"
        aria-label="Pause scroll timeline"
        title="Pause scroll timeline"
        type="button"
        onClick={pauseScrollPreview}
        style={transportButtonStyle}
      >
        <span
          data-testid="capture-timeline-icon-pause"
          aria-hidden="true"
          style={pauseIconStyle}
        />
      </button>
      <button
        data-testid="capture-timeline-record-preview"
        aria-label="Open scroll record"
        title="Open scroll record"
        type="button"
        disabled={!cameraPathPlaybackValidation.valid}
        onClick={openScrollRecordPopout}
        style={transportPrimaryButtonStyle}
      >
        <span
          data-testid="capture-timeline-icon-record"
          aria-hidden="true"
          style={recordIconStyle}
        />
      </button>
    </div>
  );

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

      {cameraAddKindPopover && (
        <div
          data-testid={
            cameraAddKindPopover.source === "timeline"
              ? "capture-timeline-add-camera-kind-popover"
              : "capture-camera-add-kind-popover"
          }
          style={{
            ...cameraAddKindPopoverStyle,
            left: cameraAddKindPopover.x,
            top: cameraAddKindPopover.y,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            data-testid="capture-camera-add-kind-keyframe"
            type="button"
            onClick={() => addCameraFromKindPopover("keyframe")}
            style={buttonStyle}
          >
            Keyframe
          </button>
          <button
            data-testid="capture-camera-add-kind-transition"
            type="button"
            onClick={() => addCameraFromKindPopover("transition")}
            style={buttonStyle}
          >
            Transition
          </button>
        </div>
      )}

      {open && (
        <div
          data-testid="capture-director-toolbar"
          aria-label="Capture Director"
          style={toolbarRootStyle}
        >
          <div data-testid="capture-director-dock" style={dockStyle}>
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
                <TransportIconButton
                  testId="capture-start"
                  label="Start realtime recording"
                  icon="record"
                  primary
                  disabled={isRecording || !canStart}
                  onClick={() => void startRecording()}
                />
                <TransportIconButton
                  testId="capture-stop"
                  label="Stop realtime recording"
                  icon="stop"
                  disabled={!isRecording}
                  onClick={() => void stopRecording()}
                />
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
                title="Video Capture"
                expanded={expandedSections.render}
                onToggle={() => updateSectionExpanded("render")}
                status={
                  <span data-testid="capture-export-state" style={statusStyle}>
                  {deterministicExportStatus === "rendering"
                    ? deterministicVideoJob?.progress.message ??
                      `Rendering ${deterministicExportProgress.renderedFrames}/${deterministicExportProgress.totalFrames}`
                    : deterministicExportStatus === "encoding"
                      ? deterministicVideoJob?.progress.message ?? "Encoding"
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
                {externalVideoJobUrl && (
                  <a
                    data-testid="capture-external-video-job-download"
                    href={externalVideoJobUrl}
                    download={externalVideoJobFilename ?? "geosee-external-video-job.json"}
                    style={outputLinkStyle}
                  >
                    External Video Job
                  </a>
                )}
                {externalVideoJobCommand && (
                  <code
                    data-testid="capture-external-video-job-command"
                    style={{
                      maxWidth: 390,
                      overflowWrap: "anywhere",
                      color: "rgba(226, 232, 240, 0.82)",
                      fontSize: 11,
                      lineHeight: 1.45,
                    }}
                  >
                    {externalVideoJobCommand}
                  </code>
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

              <section data-testid="capture-scroll-panel" style={barStyle}>
                <button
                  data-testid="capture-scroll-header"
                  type="button"
                  aria-expanded={expandedSections["scroll-animation"]}
                  onClick={() => {
                    setDirectorPanel("scroll-animation");
                    updateSectionExpanded("scroll-animation");
                  }}
                  style={barHeaderButtonStyle}
                >
                  <CaptureBarHeading title="Scroll Animation" />
                  <CaptureBarChevron
                    expanded={expandedSections["scroll-animation"]}
                  />
                </button>
                {expandedSections["scroll-animation"] && (
                  <div style={barContentStyle}>
                    <div style={rowStyle}>
                      <TransportIconButton
                        testId="capture-scroll-play"
                        label="Play scroll preview"
                        icon="play"
                        onClick={playScrollPreview}
                      />
                      <TransportIconButton
                        testId="capture-scroll-pause"
                        label="Pause scroll preview"
                        icon="pause"
                        onClick={pauseScrollPreview}
                      />
                      <TransportIconButton
                        testId="capture-scroll-record"
                        label="Record scroll animation"
                        icon="record"
                        primary
                        onClick={openScrollRecordPopout}
                      />
                      <TransportIconButton
                        testId="capture-scroll-stop"
                        label="Stop scroll preview"
                        icon="stop"
                        onClick={stopScrollPreview}
                      />
                    </div>
                    <div style={sectionStyle}>
                      <span style={sectionLabelStyle}>Range</span>
                      <span style={statusStyle}>
                        {scrollRangeMode === "frame-range"
                          ? `Frame range ${scrollFrameStart}-${scrollFrameEnd}`
                          : `Full video, ${scrollEstimatedFrameCount} frames`}
                      </span>
                      <span style={sectionLabelStyle}>Render size</span>
                      <span style={statusStyle}>{scrollRenderSizeLabel}</span>
                      <span style={sectionLabelStyle}>Destination</span>
                      <span
                        data-testid="capture-scroll-destination-summary"
                        title={scrollSaveDestination}
                        style={summaryValueStyle}
                      >
                        {scrollSaveDestination}
                      </span>
                      <span style={sectionLabelStyle}>Package</span>
                      <span
                        data-testid="capture-scroll-package-summary"
                        title={scrollOutputPackageName}
                        style={summaryValueStyle}
                      >
                        {scrollOutputPackageName}
                      </span>
                      {scrollOutputReady && (
                        <button
                          data-testid="capture-scroll-open-output"
                          type="button"
                          title={
                            lastScrollPackagePath ??
                            lastScrollManifestPath ??
                            "Scroll output placeholder"
                          }
                          onClick={openScrollRecordPopout}
                          style={outputLinkStyle}
                        >
                          Open Output
                        </button>
                      )}
                    </div>
                    <div
                      data-testid="capture-scroll-render-progress"
                      style={sectionStyle}
                    >
                      <span style={sectionLabelStyle}>Render</span>
                      <span
                        data-testid="capture-scroll-render-progress-label"
                        style={statusStyle}
                      >
                        {scrollRenderProgressLabel}
                      </span>
                      <div
                        role="progressbar"
                        aria-label="Scroll package render progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(scrollPackagePercent * 100)}
                        style={progressTrackStyle}
                      >
                        <div
                          data-testid="capture-scroll-render-progress-bar"
                          style={{
                            ...progressBarStyle,
                            width: `${Math.round(scrollPackagePercent * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

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
                <button data-testid="capture-keyframe-add" type="button" onClick={(event) => openCameraAddKindPopover(event, "panel")} style={buttonStyle}>
                  Add Current Camera
                </button>
                <button data-testid="capture-path-add-transition" type="button" onClick={() => addCameraPathTransitionNode(selectedCameraPathSegmentId)} style={buttonStyle}>
                  Add Transition Node
                </button>
                <button
                  data-testid="capture-path-orbit-360"
                  type="button"
                  disabled={
                    !selectedCameraPathNodeId ||
                    captureCameraPathV2.nodes.find((node) => node.id === selectedCameraPathNodeId)?.kind !== "keyframe"
                  }
                  onClick={() => addCameraPathOrbit360(selectedCameraPathNodeId)}
                  style={buttonStyle}
                >
                  Orbit 360
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
                <TransportIconButton
                  testId="capture-path-play"
                  label="Play camera path"
                  icon="play"
                  disabled={!cameraPathPlaybackValidation.valid}
                  onClick={playCameraPath}
                />
                <TransportIconButton
                  testId="capture-path-pause"
                  label="Pause camera path"
                  icon="pause"
                  onClick={stopCameraPathPlayback}
                />
                <TransportIconButton
                  testId="capture-path-record-start"
                  label="Record camera path video"
                  icon="record"
                  primary
                  disabled={!cameraPathPlaybackValidation.valid}
                  onClick={() => void startCameraPathPreviewRecording()}
                />
                <TransportIconButton
                  testId="capture-path-record-stop"
                  label="Stop camera path video"
                  icon="stop"
                  disabled={!isRecording}
                  onClick={() => {
                    stopCameraPathPlayback();
                    void stopRecording();
                  }}
                />
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
                    ? pathRenderProgress.message ??
                      `Rendering ${pathRenderProgress.renderedFrames ?? 0}/${pathRenderProgress.totalFrames ?? 0}`
                    : pathRenderStatus === "encoding"
                      ? pathRenderProgress.message ?? "Encoding path video. No file has been saved yet."
                      : pathRenderStatus === "complete"
                        ? externalVideoJobUrl && !pathRenderOutputUrl
                          ? "External path video job ready"
                          : "Rendered path video ready"
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
                {externalVideoJobUrl && (
                  <a
                    data-testid="capture-path-render-external-job-download"
                    href={externalVideoJobUrl}
                    download={externalVideoJobFilename ?? "geosee-external-video-job.json"}
                    style={outputLinkStyle}
                  >
                    External Path Video Job
                  </a>
                )}
                {externalVideoJobCommand && (
                  <code
                    data-testid="capture-path-render-external-job-command"
                    style={{
                      maxWidth: 390,
                      overflowWrap: "anywhere",
                      color: "rgba(226, 232, 240, 0.82)",
                      fontSize: 11,
                      lineHeight: 1.45,
                    }}
                  >
                    {externalVideoJobCommand}
                  </code>
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
                    uses fixed frame time from the current Camera Path. Browser output is not written to disk during rendering or encoding; for 4K final video, run the external job command to write the file outside the browser.
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
            </div>
            <div
              data-testid="capture-director-panel-body"
              style={{ display: "contents" }}
            >
            {error && (
              <span data-testid="capture-error" title={error} style={errorStyle}>
                {error}
              </span>
            )}
            {cameraPathPreviewMonitor.visible && (
              <aside
                data-testid="capture-path-preview-monitor"
                style={previewMonitorPanelStyle}
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
            <div
              data-testid="capture-director-bottom-actions"
              style={bottomActionRowStyle}
            >
              {timelineTransportActions}
              {recipeActions}
            </div>
            </div>
          </div>
          {scrollRecordPopoutOpen && (
            <div
              data-testid="capture-scroll-record-popout-shell"
              style={popoutBackdropStyle}
            >
              <div
                ref={scrollPopoutDialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Scroll Animation record options"
                tabIndex={-1}
                style={recordPopoutStyle}
              >
                <div style={headingStyle}>
                  <span>Scroll Animation</span>
                  <button
                    type="button"
                    onClick={closeScrollRecordPopout}
                    style={buttonStyle}
                  >
                    Close
                  </button>
                </div>
                <div style={popoutGridStyle}>
                  <div
                    data-testid="capture-scroll-format-checklist"
                    style={popoutFieldStyle}
                  >
                    <span>Formats</span>
                    <div
                      role="group"
                      aria-label="Scroll output formats"
                      style={{ display: "flex", flexDirection: "column", gap: 3 }}
                    >
                      {scrollFormatOptions.map((option) => (
                        <label
                          key={option.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            data-testid={`capture-scroll-format-${option.id}`}
                            checked={scrollOutputFormats.includes(option.id)}
                            onChange={() => toggleScrollOutputFormat(option.id)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                    <span style={fieldHelpStyle}>
                      Tick every delivery type to produce. Each renders from one
                      shared frame pass into the same package.
                    </span>
                  </div>
                  <label style={popoutFieldStyle}>
                    <span>Quality</span>
                    <select
                      data-testid="capture-scroll-quality-select"
                      value={scrollQualityPreset}
                      onChange={(event) =>
                        setScrollQualityPreset(
                          event.currentTarget.value as CaptureScrollQualityPreset,
                        )
                      }
                      style={{ ...fieldStyle, width: "100%" }}
                    >
                      {scrollQualityOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <span style={fieldHelpStyle}>
                      Size preset used by the scroll package render.
                    </span>
                  </label>
                  <label style={popoutFieldStyle}>
                    <span>Range</span>
                    <select
                      data-testid="capture-scroll-range-select"
                      value={scrollRangeMode}
                      onChange={(event) =>
                        setScrollRangeMode(
                          event.currentTarget.value as CaptureScrollRangeMode,
                        )
                      }
                      style={{ ...fieldStyle, width: "100%" }}
                    >
                      <option value="full-video">Full video</option>
                      <option value="frame-range">Frame range</option>
                    </select>
                    <span style={fieldHelpStyle}>
                      Full video uses duration; frame range uses inclusive frames.
                    </span>
                  </label>
                  <label style={popoutFieldStyle}>
                    <span>Save destination</span>
                    <input
                      data-testid="capture-scroll-save-destination"
                      type="text"
                      value={scrollSaveDestination}
                      onChange={(event) =>
                        setScrollSaveDestination(event.currentTarget.value)
                      }
                      style={{ ...fieldStyle, width: "100%", paddingRight: 9 }}
                    />
                    <span style={fieldHelpStyle}>
                      Relative folder where the package is written.
                    </span>
                  </label>
                  <label style={popoutFieldStyle}>
                    <span>Output package name</span>
                    <input
                      data-testid="capture-scroll-output-package-name"
                      type="text"
                      value={scrollOutputPackageName}
                      onChange={(event) =>
                        setScrollOutputPackageName(event.currentTarget.value)
                      }
                      style={{ ...fieldStyle, width: "100%", paddingRight: 9 }}
                    />
                    <span style={fieldHelpStyle}>
                      Base folder name for manifest, media, frames, and diagnostics.
                    </span>
                  </label>
                  {scrollRangeMode === "frame-range" && (
                    <>
                      <label style={popoutFieldStyle}>
                        <span>Start frame</span>
                        <input
                          data-testid="capture-scroll-start-frame"
                          type="number"
                          min={0}
                          step={1}
                          value={scrollStartFrame}
                          onChange={(event) =>
                            setScrollStartFrame(Number(event.currentTarget.value))
                          }
                          style={{ ...fieldStyle, width: "100%", paddingRight: 9 }}
                        />
                        <span style={fieldHelpStyle}>
                          First inclusive frame in the selected range.
                        </span>
                      </label>
                      <label style={popoutFieldStyle}>
                        <span>End frame</span>
                        <input
                          data-testid="capture-scroll-end-frame"
                          type="number"
                          min={0}
                          step={1}
                          value={scrollEndFrame}
                          onChange={(event) =>
                            setScrollEndFrame(Number(event.currentTarget.value))
                          }
                          style={{ ...fieldStyle, width: "100%", paddingRight: 9 }}
                        />
                        <span style={fieldHelpStyle}>
                          Last inclusive frame in the selected range.
                        </span>
                      </label>
                    </>
                  )}
                </div>
                <div style={sectionStyle}>
                  <span style={sectionLabelStyle}>Estimated frame count</span>
                  <span style={statusStyle}>{scrollEstimatedFrameCount}</span>
                  <span style={sectionLabelStyle}>Render size</span>
                  <span style={statusStyle}>{scrollRenderSizeLabel}</span>
                  <button
                    data-testid="capture-scroll-advanced-toggle"
                    type="button"
                    aria-expanded={scrollAdvancedOpen}
                    onClick={() => setScrollAdvancedOpen(!scrollAdvancedOpen)}
                    style={buttonStyle}
                  >
                    Advanced
                  </button>
                </div>
                {scrollAdvancedOpen && (
                  <div data-testid="capture-scroll-advanced-fields" style={sectionStyle}>
                    {(scrollOutputFormats.includes("mp4") ||
                      scrollOutputFormats.includes("webm") ||
                      scrollOutputFormats.includes("scroll-friendly-video")) && (
                      <>
                        <label style={popoutFieldStyle}>
                          <span>Video bitrate (Mbps)</span>
                          <input
                            data-testid="capture-scroll-advanced-bitrate"
                            type="number"
                            min={0}
                            step={1}
                            value={scrollAdvancedBitrateMbps}
                            onChange={(event) =>
                              setScrollAdvancedBitrateMbps(
                                Math.max(0, Number(event.currentTarget.value) || 0),
                              )
                            }
                            style={{ ...fieldStyle, width: "100%", paddingRight: 9 }}
                          />
                          <span style={fieldHelpStyle}>
                            0 keeps the high-quality CRF default; a positive value targets
                            that bitrate for every selected video format.
                          </span>
                        </label>
                        <label style={popoutFieldStyle}>
                          <span>Keyframe interval (frames)</span>
                          <input
                            data-testid="capture-scroll-advanced-keyframe-interval"
                            type="number"
                            min={0}
                            step={1}
                            value={scrollAdvancedKeyframeInterval}
                            onChange={(event) =>
                              setScrollAdvancedKeyframeInterval(
                                Math.max(0, Number(event.currentTarget.value) || 0),
                              )
                            }
                            style={{ ...fieldStyle, width: "100%", paddingRight: 9 }}
                          />
                          <span style={fieldHelpStyle}>
                            0 uses scene-cut keyframes (5 for Scroll-Friendly). Lower values
                            seek more smoothly under scroll control.
                          </span>
                        </label>
                      </>
                    )}
                    {scrollOutputFormats.includes("scroll-friendly-video") && (
                      <label style={popoutFieldStyle}>
                        <span>All keyframes</span>
                        <input
                          data-testid="capture-scroll-advanced-all-keyframe"
                          type="checkbox"
                          checked={scrollAdvancedAllKeyframe}
                          onChange={(event) =>
                            setScrollAdvancedAllKeyframe(event.currentTarget.checked)
                          }
                        />
                        <span style={fieldHelpStyle}>
                          Encode every frame as a keyframe for frame-exact scroll seeking
                          (larger files).
                        </span>
                      </label>
                    )}
                    {scrollOutputFormats.includes("png-sequence") && (
                      <label style={popoutFieldStyle}>
                        <span>PNG sequence</span>
                        <input
                          type="text"
                          value="lossless · frame-%06d.png"
                          readOnly
                          style={{ ...fieldStyle, width: "100%", paddingRight: 9 }}
                        />
                        <span style={fieldHelpStyle}>
                          One lossless PNG per frame, six-digit zero-padded names.
                        </span>
                      </label>
                    )}
                  </div>
                )}
                <div style={rowStyle}>
                  {scrollRecordValidationErrors.length > 0 && (
                    <span
                      data-testid="capture-scroll-record-validation-errors"
                      role="alert"
                      title={scrollRecordValidationErrors.join(" ")}
                      style={{ ...errorStyle, flexBasis: "100%" }}
                    >
                      {scrollRecordValidationErrors.join(" ")}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={acceptScrollRenderShell}
                    style={primaryButtonStyle}
                  >
                    Accept and Render
                  </button>
                  {scrollOutputReady && (
                    <button
                      type="button"
                      title={
                        lastScrollPackagePath ??
                        lastScrollManifestPath ??
                        "Scroll output placeholder"
                      }
                      onClick={closeScrollRecordPopout}
                      style={outputLinkStyle}
                    >
                      Open Output
                    </button>
                  )}
                </div>
                {(lastScrollPackagePath || lastScrollManifestPath) && (
                  <span data-testid="capture-scroll-output-paths" style={statusStyle}>
                    {lastScrollPackagePath ?? "Package path pending"} /{" "}
                    {lastScrollManifestPath ?? "Manifest path pending"}
                  </span>
                )}
                {scrollPackageArtifactLinks.length > 0 && (
                  <div
                    data-testid="capture-scroll-package-artifact-links"
                    style={{ ...rowStyle, gap: 6 }}
                  >
                    {scrollPackageArtifactLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        download
                        style={outputLinkStyle}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {import.meta.env.DEV && (
            <pre
              data-testid="capture-scroll-preview-trace"
              hidden
              aria-hidden="true"
            >
              {JSON.stringify(scrollPreviewTrace)}
            </pre>
          )}
          <CameraPathTimeline
            path={captureCameraPathV3}
            timeline={cameraPathTimeline}
            captureTimeline={captureTimeline}
            selectedTimelineTrack={selectedTimelineTrack}
            selectedNodeId={selectedCameraPathNodeId ?? selectedCameraPathKeyframeId}
            selectedSegmentId={selectedCameraPathSegmentId}
            scrubSeconds={timelineScrubSeconds}
            onScrub={setCameraPathScrubTimeSeconds}
            onSetScrollPlayheadSeconds={setScrollPlayheadSeconds}
            onAddCurrentCamera={openCameraAddKindPopover}
            onAddCurrentPageClip={addCurrentPageClip}
            pageOptions={capturePageOptions}
            onAddPageClip={addPageClip}
            onReplacePageClipPage={replacePageClipPage}
            onRemovePageClip={removePageClip}
            onEditPageClipFrames={editPageClipFrames}
            onAddPageRangeClips={() => {
              const startId = pageRangeStartId ?? capturePageOptions[0]?.id;
              const endId = pageRangeEndId ?? startId;
              if (startId && endId) addPageRangeClips(startId, endId);
            }}
            onClearPageClips={clearPageClips}
            onSelectNode={(id) => {
              setSelectedCameraPathNodeId(id);
              setSelectedCameraPathKeyframeId(id);
              setSelectedCameraPathSegmentId(null);
            }}
            onSelectSegment={(id, nodeId) => {
              setSelectedCameraPathSegmentId(id);
              setSelectedCameraPathNodeId(nodeId ?? null);
              setSelectedCameraPathKeyframeId(nodeId ?? null);
            }}
            onSelectPageClip={selectPageClip}
            onSelectTimelineTrack={setSelectedTimelineTrack}
            onSetNodeHoldSeconds={setCameraPathNodeHoldSecondsAfter}
            onOpenCameraNodeKindPicker={setCameraPathNodeKind}
            onSetSegmentTransitionSeconds={setCameraPathSegmentTransitionSeconds}
            onSetPageClipLocked={setPageClipLocked}
            onResizeTimelineBoundary={resizeTimelineBoundary}
          />
        </div>
      )}
    </>
  );
}
