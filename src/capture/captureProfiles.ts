import type {
  CaptureMode,
  CaptureVisibilityGroup,
  CaptureVisibilityProfile,
} from "./captureTypes";

const allVisible: CaptureVisibilityProfile = {
  sceneCanvas: true,
  captureNativeAnnotations: false,
  presenterOverlay: true,
  sceneLabels: true,
  legends: true,
  logo: true,
  navControls: true,
  editorSidebar: true,
  authoringControls: true,
  debugPanels: true,
  fullChrome: true,
};

export const CAPTURE_VISIBILITY_PROFILES: Record<
  CaptureMode,
  CaptureVisibilityProfile
> = {
  off: allVisible,
  "scene-only": {
    sceneCanvas: true,
    captureNativeAnnotations: false,
    presenterOverlay: false,
    sceneLabels: false,
    legends: false,
    logo: false,
    navControls: false,
    editorSidebar: false,
    authoringControls: false,
    debugPanels: false,
    fullChrome: false,
  },
  "scene-annotations": {
    sceneCanvas: true,
    captureNativeAnnotations: true,
    presenterOverlay: false,
    sceneLabels: false,
    legends: false,
    logo: false,
    navControls: false,
    editorSidebar: false,
    authoringControls: false,
    debugPanels: false,
    fullChrome: false,
  },
  "presentation-ui": {
    sceneCanvas: true,
    captureNativeAnnotations: true,
    presenterOverlay: false,
    sceneLabels: false,
    legends: false,
    logo: false,
    navControls: false,
    editorSidebar: false,
    authoringControls: false,
    debugPanels: false,
    fullChrome: false,
  },
  "full-ui": {
    sceneCanvas: true,
    captureNativeAnnotations: false,
    presenterOverlay: true,
    sceneLabels: true,
    legends: true,
    logo: true,
    navControls: true,
    editorSidebar: true,
    authoringControls: true,
    debugPanels: true,
    fullChrome: true,
  },
};

export function captureVisibilityProfileForMode(
  mode: CaptureMode,
): CaptureVisibilityProfile {
  return CAPTURE_VISIBILITY_PROFILES[mode] ?? CAPTURE_VISIBILITY_PROFILES.off;
}

export function isCaptureGroupVisible(
  mode: CaptureMode,
  group: CaptureVisibilityGroup,
): boolean {
  return captureVisibilityProfileForMode(mode)[group] !== false;
}
