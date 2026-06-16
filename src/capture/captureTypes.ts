import type { SceneHandle } from "../scene";

export type CaptureMode =
  | "off"
  | "scene-only"
  | "scene-annotations"
  | "presentation-ui"
  | "full-ui";

export type ActiveCaptureMode = Exclude<CaptureMode, "off">;

export type CaptureDirectorPanel =
  | "closed"
  | "realtime"
  | "render-out"
  | "still-capture"
  | "camera-path";

export type CaptureStillType = "png" | "webp" | "jpeg";

export type CaptureRenderFidelityMode =
  | "live-preview"
  | "max-detail-render";

export type CaptureSaveDestination =
  | "browser-picker"
  | "download-link"
  | "external-job";

export type CaptureVisibilityGroup =
  | "sceneCanvas"
  | "captureNativeAnnotations"
  | "presenterOverlay"
  | "sceneLabels"
  | "legends"
  | "logo"
  | "navControls"
  | "editorSidebar"
  | "authoringControls"
  | "debugPanels"
  | "fullChrome";

export type CaptureVisibilityProfile = Record<CaptureVisibilityGroup, boolean>;

export type CapturePreviewResolutionPresetId =
  | "preview-1080"
  | "sharp-1440"
  | "marketing-4k";

export type CaptureRenderResolutionPresetId =
  | CapturePreviewResolutionPresetId
  | "render-8k";

export type CaptureResolutionPresetId = CaptureRenderResolutionPresetId;

export type CaptureFps = 24 | 30 | 60;

export interface CaptureResolution {
  id?: CaptureResolutionPresetId | "custom";
  label: string;
  width: number;
  height: number;
  defaultFps: CaptureFps;
  qualityPreset: CaptureQualityPreset;
}

export type CaptureQualityPreset =
  | "preview"
  | "sharp-1440"
  | "marketing"
  | "render-8k";

export type CaptureRecordingStatus =
  | "idle"
  | "preparing"
  | "recording"
  | "stopping"
  | "complete";

export type CaptureDeterministicExportStatus =
  | "idle"
  | "rendering"
  | "encoding"
  | "complete";

export type CaptureScreenCaptureStatus =
  | "idle"
  | "rendering"
  | "complete";

export type CaptureDeterministicExportFormat = "mp4" | "webm";

export interface CaptureDeterministicExportProgress {
  renderedFrames: number;
  totalFrames: number;
}

export interface CaptureFeatureAvailability {
  mediaRecorder: boolean;
  canvasCaptureStream: boolean;
  displayCapture: boolean;
  supportedMimeType: string | null;
}

export interface CaptureValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CaptureLegendItem {
  label: string;
  color?: string;
  value?: string;
}

export interface CaptureOverlayFrameContext {
  mode: ActiveCaptureMode;
  width: number;
  height: number;
  title?: string | null;
  subtitle?: string | null;
  projectName?: string | null;
  pageTitle?: string | null;
  pageLabel?: string | null;
  brandLabel?: string | null;
  legendItems?: readonly CaptureLegendItem[];
  elapsedSeconds?: number;
}

export interface CaptureRecorderResult {
  blob: Blob;
  url: string;
  mimeType: string;
  byteLength: number;
  diagnostics: CaptureRecorderDiagnostics;
}

export interface CaptureRecorderDiagnostics {
  chunkCount: number;
  emptyChunkCount: number;
  byteLength: number;
  requestDataSupported: boolean;
}

export interface CaptureRecorderOutputContext {
  mode?: ActiveCaptureMode;
  width?: number;
  height?: number;
  fps?: number;
}

export interface CaptureRecorderController {
  readonly mimeType: string;
  stop(): Promise<CaptureRecorderResult>;
}

export interface CaptureRecorderStartOptions {
  fps: CaptureFps;
  mimeType: string;
  outputContext?: CaptureRecorderOutputContext;
  onUnexpectedStop?: (result: CaptureRecorderResult) => void;
  onRecorderError?: (error: Error) => void;
}

export interface CanvasPreviewRecorderOptions extends CaptureRecorderStartOptions {
  canvas: HTMLCanvasElement;
  onAfterRender?: (callback: () => void) => () => void;
  frameRequestIntervalMs?: number;
}

export interface DisplayPreviewRecorderOptions extends CaptureRecorderStartOptions {
  video?: true;
  audio?: false;
}

export interface CompositedCaptureRecorderOptions extends CaptureRecorderStartOptions {
  sceneHandle: SceneHandle;
  width: number;
  height: number;
  overlayContext: () => CaptureOverlayFrameContext;
  onDrawError?: (error: Error) => void;
}

export const CAPTURE_MODE_LABELS: Record<ActiveCaptureMode, string> = {
  "scene-only": "Scene Only",
  "scene-annotations": "Scene + Annotations",
  "presentation-ui": "Presentation UI",
  "full-ui": "Full UI",
};
