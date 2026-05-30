import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import type {
  CameraObjectFocus,
  DynamicCamera,
  DynamicCameraCurve,
  EditableStyle,
  EasingName,
  EnvironmentSetup,
  PresentationPage,
  SceneCameraFocusSettings,
} from "./types";
import type { Pose } from "./types";
import type { SceneHandle, SceneTargetBox, SceneTargetEventDetail } from "../scene";
import { CameraTweener } from "./cameraTween";
import { applyPose } from "./capturePose";
import {
  poseForFocusFit,
  poseForFocusZoom,
  vec3FromArray,
} from "../scene/cameraFocus";

// PageController owns:
//   - which page is "captured" as current (currentIndex)
//   - whether a camera tween is running (isTransitioning)
//   - whether the user has free-looked away from the captured pose
//
// It receives `environment` as a prop and uses it on every page transition
// to compute the effective visibility set and the effective per-layer style
// (env base ∪ page deltas, per #023). Imperative scene work (camera, tween,
// layer diff, style application) happens below the React surface.

interface PageControllerValue {
  pages: PresentationPage[];
  currentIndex: number;
  targetIndex: number | null;
  transitionProgress: number;
  isTransitioning: boolean;
  freelookActive: boolean;
  cameraObjectFocus: CameraObjectFocus | null;
  goto: (index: number, reason?: NavigationReason) => void;
  next: () => void;
  prev: () => void;
  resetToPose: () => void;
  /** Force-tween the camera to an arbitrary pose (used by pose history). */
  tweenToPose: (pose: PresentationPage["camera"]) => void;
}

const PageControllerContext = createContext<PageControllerValue | null>(null);

type NavigationReason =
  | "page-click"
  | "keyboard"
  | "programmatic"
  | "freelook"
  | "interrupted";

interface SceneTransitionContext {
  sourcePageId: string | null;
  targetPageId: string | null;
  reason: NavigationReason;
  startMs: number;
  durationMs: number;
  sourcePose: Pose;
  targetPose: Pose;
}

const DEFAULT_CAMERA_FOCUS_SETTINGS: Required<SceneCameraFocusSettings> = {
  durationMs: 900,
  easing: "easeOutCubic",
  fitPaddingPx: 500,
  sameTargetZoomFactor: 0.7,
  singleClickDelayMs: 250,
  scrollSettleMs: 250,
  pulsePillMs: 600,
  pulseTextMs: 480,
  pulseStaticMs: 1200,
  revealScrollBehavior: "smooth",
  rmbExitDragPx: 0,
};

function clampNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? THREE.MathUtils.clamp(value, min, max)
    : fallback;
}

function resolveCameraFocusSettings(
  settings?: SceneCameraFocusSettings,
): Required<SceneCameraFocusSettings> {
  return {
    durationMs: clampNumber(
      settings?.durationMs,
      DEFAULT_CAMERA_FOCUS_SETTINGS.durationMs,
      0,
      5000,
    ),
    easing: settings?.easing ?? DEFAULT_CAMERA_FOCUS_SETTINGS.easing,
    fitPaddingPx: clampNumber(
      settings?.fitPaddingPx,
      DEFAULT_CAMERA_FOCUS_SETTINGS.fitPaddingPx,
      0,
      2000,
    ),
    sameTargetZoomFactor: clampNumber(
      settings?.sameTargetZoomFactor,
      DEFAULT_CAMERA_FOCUS_SETTINGS.sameTargetZoomFactor,
      0.05,
      1.5,
    ),
    singleClickDelayMs: clampNumber(
      settings?.singleClickDelayMs,
      DEFAULT_CAMERA_FOCUS_SETTINGS.singleClickDelayMs,
      120,
      500,
    ),
    scrollSettleMs: clampNumber(
      settings?.scrollSettleMs,
      DEFAULT_CAMERA_FOCUS_SETTINGS.scrollSettleMs,
      80,
      800,
    ),
    pulsePillMs: clampNumber(
      settings?.pulsePillMs,
      DEFAULT_CAMERA_FOCUS_SETTINGS.pulsePillMs,
      200,
      1600,
    ),
    pulseTextMs: clampNumber(
      settings?.pulseTextMs,
      DEFAULT_CAMERA_FOCUS_SETTINGS.pulseTextMs,
      200,
      1600,
    ),
    pulseStaticMs: clampNumber(
      settings?.pulseStaticMs,
      DEFAULT_CAMERA_FOCUS_SETTINGS.pulseStaticMs,
      400,
      3000,
    ),
    revealScrollBehavior:
      settings?.revealScrollBehavior === "auto"
        ? "auto"
        : DEFAULT_CAMERA_FOCUS_SETTINGS.revealScrollBehavior,
    rmbExitDragPx: clampNumber(
      settings?.rmbExitDragPx,
      DEFAULT_CAMERA_FOCUS_SETTINGS.rmbExitDragPx,
      0,
      24,
    ),
  };
}

function boxFromSceneTargetBox(box: SceneTargetBox | null): THREE.Box3 | null {
  if (!box) return null;
  return new THREE.Box3(vec3FromArray(box.min), vec3FromArray(box.max));
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type PreviewLayerOverrideFields = Readonly<
  Record<string, readonly (keyof EditableStyle)[]>
>;

interface ProviderProps {
  pages: PresentationPage[];
  environment: EnvironmentSetup;
  sceneHandle: SceneHandle;
  allowPageCameraMarker?: boolean;
  previewEnvironmentBase?: boolean;
  previewLayerOverrideFields?: PreviewLayerOverrideFields;
  presentationStateTransform?: (
    environment: EnvironmentSetup,
    page: PresentationPage,
    context: { previewEnvironmentBase: boolean },
  ) => { environment: EnvironmentSetup; page: PresentationPage };
  children: ReactNode;
}

function copyStyleField(
  target: EditableStyle,
  source: EditableStyle,
  field: keyof EditableStyle,
): void {
  const value = source[field];
  if (value !== undefined) {
    (target as Record<string, unknown>)[field] = value;
  }
}

function pageWithoutLayerDeltas(
  page: PresentationPage,
  previewLayerOverrideFields?: PreviewLayerOverrideFields,
): PresentationPage {
  if (!page.layerOverrides && !page.visibilityOverrides) return page;
  const next = { ...page };
  delete next.visibilityOverrides;

  if (!page.layerOverrides || !previewLayerOverrideFields) {
    delete next.layerOverrides;
    return next;
  }

  const preservedLayerOverrides: Record<string, EditableStyle> = {};
  for (const [layerId, fields] of Object.entries(previewLayerOverrideFields)) {
    const source = page.layerOverrides[layerId];
    if (!source || fields.length === 0) continue;
    const preserved: EditableStyle = {};
    for (const field of fields) {
      copyStyleField(preserved, source, field);
    }
    if (Object.keys(preserved).length > 0) {
      preservedLayerOverrides[layerId] = preserved;
    }
  }

  if (Object.keys(preservedLayerOverrides).length > 0) {
    next.layerOverrides = preservedLayerOverrides;
  } else {
    delete next.layerOverrides;
  }
  return next;
}

function poseWithEnvironmentCamera(pose: Pose, environment: EnvironmentSetup): Pose {
  const fov = environment.scene?.camera?.fov;
  if (typeof fov !== "number") return pose;
  return { ...pose, fov };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampTimingMs(
  value: number,
  durationMs: number,
  minMs: number,
  maxMs: number,
): number {
  const duration = Math.max(0, durationMs);
  const upper = Math.min(duration, Math.max(0, maxMs));
  const lower = Math.min(upper, Math.max(0, minMs));
  return Math.max(lower, Math.min(upper, value));
}

function positiveNumber(value: unknown, fallback: number): number {
  const n = finiteNumber(value, fallback);
  return n > 0 ? n : fallback;
}

function poseKey(pose: Pose): string {
  return [
    ...pose.position,
    ...pose.target,
    ...pose.up,
    pose.fov,
  ].join(",");
}

function vec3Distance(a: Pose["position"], b: Pose["position"]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function posePathDistance(from: Pose, to: Pose): number {
  const positionDistance = vec3Distance(from.position, to.position);
  const targetDistance = vec3Distance(from.target, to.target);
  const lensDistance = Math.abs(from.fov - to.fov) * 75;
  return positionDistance + targetDistance * 0.35 + lensDistance;
}

function roundTimingMs(value: number, durationMs: number): number {
  return clampTimingMs(Math.round(value / 50) * 50, durationMs, 0, durationMs);
}

function pathAwareOrbitTimings(
  durationMs: number,
  pathDistance = 0,
): { leadMs: number; exitMs: number; blendMs: number } {
  const distanceFactor = clamp01((pathDistance - 500) / 6500);
  const durationFactor = clamp01((durationMs - 700) / 4300);
  const factor = Math.max(distanceFactor, durationFactor);
  return {
    leadMs: roundTimingMs(
      clampTimingMs(
        durationMs * (0.34 + factor * 0.22),
        durationMs,
        350,
        Math.min(3200, durationMs * 0.74),
      ),
      durationMs,
    ),
    exitMs: roundTimingMs(
      clampTimingMs(
        durationMs * (0.16 + factor * 0.15),
        durationMs,
        250,
        Math.min(1800, durationMs * 0.52),
      ),
      durationMs,
    ),
    blendMs: roundTimingMs(
      clampTimingMs(
        durationMs * (0.36 + factor * 0.24),
        durationMs,
        500,
        Math.min(3600, durationMs * 0.88),
      ),
      durationMs,
    ),
  };
}

function dynamicTransitionLeadMs(
  dynamic: DynamicCamera | undefined,
  durationMs: number,
  pathDistance?: number,
): number {
  if (dynamic?.pathAwareBlend === true) {
    return pathAwareOrbitTimings(durationMs, pathDistance).leadMs;
  }
  const fallback = Math.min(1600, Math.max(350, durationMs * 0.45));
  return Math.min(
    durationMs,
    Math.max(0, finiteNumber(dynamic?.transitionLeadMs, fallback)),
  );
}

function dynamicTransitionExitMs(
  dynamic: DynamicCamera | undefined,
  durationMs: number,
  pathDistance?: number,
): number {
  if (dynamic?.pathAwareBlend === true) {
    return pathAwareOrbitTimings(durationMs, pathDistance).exitMs;
  }
  const fallback = Math.min(900, Math.max(250, durationMs * 0.28));
  return Math.min(
    durationMs,
    Math.max(0, finiteNumber(dynamic?.transitionExitMs, fallback)),
  );
}

function transitionBlendCurve(
  dynamic: DynamicCamera | undefined,
): DynamicCameraCurve {
  return dynamic?.transitionBlendCurve ?? "smooth";
}

function curveEnvelope(
  value: number,
  curve: DynamicCameraCurve,
): number {
  const t = clamp01(value);
  if (curve === "linear") return t;
  if (curve === "cinematic") return easeOutCubic(t);
  return t * t * (3 - 2 * t);
}

function pageTransitionProgress(value: number, easing: PresentationPage["transition"]["easing"]): number {
  const t = clamp01(value);
  switch (easing) {
    case "linear":
      return t;
    case "easeInOutSine":
      return -(Math.cos(Math.PI * t) - 1) / 2;
    case "easeOutQuart":
      return 1 - Math.pow(1 - t, 4);
    case "easeOutCubic":
      return 1 - Math.pow(1 - t, 3);
    case "easeInOutCubic":
    default:
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
}

function dynamicOrbitEnabled(dynamic: DynamicCamera | undefined): boolean {
  return dynamic?.enabled === true && dynamic.orbitEnabled !== false;
}

function dynamicOrbitBlendMs(
  dynamic: DynamicCamera | undefined,
  durationMs: number,
  pathDistance?: number,
): number | undefined {
  if (!dynamicOrbitEnabled(dynamic)) return undefined;
  if (dynamic?.pathAwareBlend === true) {
    return pathAwareOrbitTimings(durationMs, pathDistance).blendMs;
  }
  return Math.max(0, finiteNumber(dynamic?.easeInMs, 1600));
}

function dynamicZoomEnabled(
  dynamic: DynamicCamera | undefined,
  basePose: Pose,
): boolean {
  if (dynamic?.enabled !== true) return false;
  if (dynamic.zoomEnabled === true) return true;
  if (dynamic.zoomEnabled === false) return false;
  return (
    typeof dynamic.zoomFov === "number" &&
    Number.isFinite(dynamic.zoomFov) &&
    Math.abs(dynamic.zoomFov - basePose.fov) > 0.01
  );
}

function computeDynamicPose(
  page: PresentationPage,
  basePose: Pose,
  timeMs: number,
  startMs: number,
  runtime?: { orbitBlendMs?: number },
): Pose {
  const dynamic = page.dynamicCamera;
  if (dynamic?.enabled !== true) return basePose;
  const elapsedMs = Math.max(0, timeMs - startMs);
  const poi = dynamic.poi ?? basePose.target;
  let position = basePose.position;
  let target = basePose.target;

  if (dynamicOrbitEnabled(dynamic)) {
    const easeMs = Math.max(
      0,
      finiteNumber(runtime?.orbitBlendMs, finiteNumber(dynamic.easeInMs, 1600)),
    );
    const blend = easeMs <= 0 ? 1 : easeOutCubic(elapsedMs / easeMs);
    const baseDx = basePose.position[0] - poi[0];
    const baseDy = basePose.position[1] - poi[1];
    const baseRadius = Math.max(1, Math.hypot(baseDx, baseDy));
    const radius = positiveNumber(dynamic.orbitRadius, baseRadius);
    const height = finiteNumber(
      dynamic.orbitHeight,
      basePose.position[2] - poi[2],
    );
    const speedDeg = finiteNumber(dynamic.orbitSpeedDegPerSec, 4);
    const direction = dynamic.orbitDirection === -1 ? -1 : 1;
    const baseAngle = Math.atan2(baseDy, baseDx);
    const angle =
      baseAngle +
      direction * THREE.MathUtils.degToRad(speedDeg) * (elapsedMs / 1000);
    const orbitX = poi[0] + Math.cos(angle) * radius;
    const orbitY = poi[1] + Math.sin(angle) * radius;
    const orbitZ = poi[2] + height;
    position = [
      lerp(basePose.position[0], orbitX, blend),
      lerp(basePose.position[1], orbitY, blend),
      lerp(basePose.position[2], orbitZ, blend),
    ];
    target = [
      lerp(basePose.target[0], poi[0], blend),
      lerp(basePose.target[1], poi[1], blend),
      lerp(basePose.target[2], poi[2], blend),
    ];
  }

  let fov = basePose.fov;
  if (dynamicZoomEnabled(dynamic, basePose)) {
    const start = Math.max(0, finiteNumber(dynamic.zoomStartMs, 0));
    const end = Math.max(start + 1, finiteNumber(dynamic.zoomEndMs, 2500));
    const amount = curveEnvelope(
      (elapsedMs - start) / Math.max(1, end - start),
      dynamic.zoomCurve ?? "smooth",
    );
    const legacyDelta =
      typeof dynamic.zoomFov === "number" && Number.isFinite(dynamic.zoomFov)
        ? dynamic.zoomFov - basePose.fov
        : 0;
    const delta = finiteNumber(dynamic.zoomDeltaFov, legacyDelta);
    const targetFov = Math.max(15, Math.min(90, basePose.fov + delta));
    fov = lerp(basePose.fov, targetFov, amount);
  }

  return {
    position,
    target,
    up: basePose.up,
    fov,
  };
}

function blendPose(from: Pose, to: Pose, amount: number): Pose {
  const t = clamp01(amount);
  return {
    position: [
      lerp(from.position[0], to.position[0], t),
      lerp(from.position[1], to.position[1], t),
      lerp(from.position[2], to.position[2], t),
    ],
    target: [
      lerp(from.target[0], to.target[0], t),
      lerp(from.target[1], to.target[1], t),
      lerp(from.target[2], to.target[2], t),
    ],
    up: [
      lerp(from.up[0], to.up[0], t),
      lerp(from.up[1], to.up[1], t),
      lerp(from.up[2], to.up[2], t),
    ],
    fov: lerp(from.fov, to.fov, t),
  };
}

function pageIsVisible(page: PresentationPage | undefined): boolean {
  return page?.hidden !== true;
}

function findVisiblePageIndex(
  pages: PresentationPage[],
  startIndex: number,
  direction: 1 | -1,
): number {
  if (pages.length === 0) return -1;
  for (let step = 1; step <= pages.length; step += 1) {
    const index =
      (startIndex + direction * step + pages.length) % pages.length;
    if (pageIsVisible(pages[index])) return index;
  }
  return startIndex;
}

function firstVisiblePageIndex(pages: PresentationPage[]): number {
  return pages.findIndex(pageIsVisible);
}

function lastVisiblePageIndex(pages: PresentationPage[]): number {
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    if (pageIsVisible(pages[index])) return index;
  }
  return -1;
}

export function PageControllerProvider({
  pages,
  environment,
  sceneHandle,
  allowPageCameraMarker = true,
  previewEnvironmentBase = false,
  previewLayerOverrideFields,
  presentationStateTransform,
  children,
}: ProviderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [freelookActive, setFreelookActive] = useState(false);
  const [cameraObjectFocus, setCameraObjectFocus] =
    useState<CameraObjectFocus | null>(null);

  const tweenerRef = useRef<CameraTweener | null>(null);
  const arrivalPoseRef = useRef<PresentationPage["camera"] | null>(null);
  const dynamicBasePoseRef = useRef<PresentationPage["camera"] | null>(null);
  const dynamicPageIdRef = useRef<string | null>(null);
  const dynamicStartMsRef = useRef<number | null>(null);
  const dynamicOrbitBlendMsRef = useRef<{
    pageId: string;
    value: number;
  } | null>(null);
  const transitionDynamicRef = useRef<{
    startMs: number;
    durationMs: number;
    from?: {
      page: PresentationPage;
      basePose: Pose;
      startMs: number;
      rampMs: number;
      curve: DynamicCameraCurve;
      orbitBlendMs?: number;
    };
    to?: {
      page: PresentationPage;
      basePose: Pose;
      startMs: number;
      rampMs: number;
      curve: DynamicCameraCurve;
      orbitBlendMs?: number;
    };
  } | null>(null);
  const pageTransitionRef = useRef<{
    startMs: number;
    durationMs: number;
    easing: PresentationPage["transition"]["easing"];
  } | null>(null);
  const activeSceneTransitionRef = useRef<SceneTransitionContext | null>(null);
  const transitionProgressRef = useRef(1);
  const currentCameraKeyRef = useRef<string | null>(null);
  const isTransitioningRef = useRef(false);
  const suppressControlsChangeRef = useRef(false);
  const cameraObjectFocusRef = useRef<CameraObjectFocus | null>(null);
  const focusTweeningRef = useRef(false);
  const focusPreviousPanEnabledRef = useRef<boolean | null>(null);
  const pagesRef = useRef(pages);
  const currentIndexRef = useRef(currentIndex);
  const targetIndexRef = useRef<number | null>(targetIndex);
  const freelookActiveRef = useRef(freelookActive);
  const presentationStateTransformRef = useRef(presentationStateTransform);
  // Mirror env into a ref so the goto closure picks up the latest env
  // without re-binding (which would invalidate cached callbacks).
  const environmentRef = useRef(environment);
  environmentRef.current = environment;
  presentationStateTransformRef.current = presentationStateTransform;
  pagesRef.current = pages;
  currentIndexRef.current = currentIndex;
  targetIndexRef.current = targetIndex;
  freelookActiveRef.current = freelookActive;
  cameraObjectFocusRef.current = cameraObjectFocus;

  const resolvePresentationState = useCallback(
    (
      page: PresentationPage,
      env: EnvironmentSetup = environmentRef.current,
    ): { environment: EnvironmentSetup; page: PresentationPage } => {
      const layerPage = previewEnvironmentBase
        ? pageWithoutLayerDeltas(page, previewLayerOverrideFields)
        : page;
      const transform = presentationStateTransformRef.current;
      return transform
        ? transform(env, layerPage, { previewEnvironmentBase })
        : { environment: env, page: layerPage };
    },
    [previewEnvironmentBase, previewLayerOverrideFields],
  );

  const setFocusState = useCallback((focus: CameraObjectFocus | null) => {
    cameraObjectFocusRef.current = focus;
    setCameraObjectFocus(focus);
  }, []);

  const releaseCameraFocus = useCallback(
    (reason: "rmb" | "navigation" | "pose" | "missing-target") => {
      const hadFocus = cameraObjectFocusRef.current !== null;
      const wasTweening = focusTweeningRef.current;
      if (!hadFocus && !wasTweening) return;
      focusTweeningRef.current = false;
      setFocusState(null);
      if (focusPreviousPanEnabledRef.current !== null) {
        sceneHandle.controls.enablePan = focusPreviousPanEnabledRef.current;
        focusPreviousPanEnabledRef.current = null;
      }
      window.dispatchEvent(
        new CustomEvent("geosee:camera-focus-released", {
          detail: { reason },
        }),
      );
    },
    [sceneHandle.controls, setFocusState],
  );

  const activateCameraFocus = useCallback(
    (focus: CameraObjectFocus) => {
      focusTweeningRef.current = false;
      if (focusPreviousPanEnabledRef.current === null) {
        focusPreviousPanEnabledRef.current = sceneHandle.controls.enablePan;
      }
      sceneHandle.controls.enablePan = false;
      setFocusState(focus);
      freelookActiveRef.current = false;
      setFreelookActive(false);
    },
    [sceneHandle.controls, setFocusState],
  );

  const focusSettings = useCallback(
    () => resolveCameraFocusSettings(environmentRef.current.scene?.cameraFocus),
    [],
  );

  // One-time wiring against the scene handle.
  useEffect(() => {
    const { camera, controls, onTick, manager } = sceneHandle;
    const tweener = new CameraTweener(camera, controls);
    tweenerRef.current = tweener;

    // Snap to first page (the establishing shot per #023): pose, effective
    // visibility, effective styling, per-page mood, scene overlays.
    const first = pages[0];
    const firstResolved = resolvePresentationState(first);
    const firstPose = poseWithEnvironmentCamera(
      firstResolved.page.camera,
      firstResolved.environment,
    );
    applyPose(camera, controls, firstPose);
    arrivalPoseRef.current = firstPose;
    dynamicBasePoseRef.current = firstPose;
    dynamicPageIdRef.current = null;
    dynamicStartMsRef.current = null;
    dynamicOrbitBlendMsRef.current = null;
    currentCameraKeyRef.current = `${first.id}:${poseKey(first.camera)}`;
    manager.applyEffectiveVisibilityForPage(
      firstResolved.environment,
      firstResolved.page,
    );
    manager.applyEffectiveStylesForPage(
      firstResolved.environment,
      firstResolved.page,
    );
    manager.applyPageScene(firstResolved.page);
    manager.applySceneOverlaysForPage(
      firstResolved.environment,
      firstResolved.page,
    );
    if (first.cameraObjectFocus) {
      const resolvedTarget = sceneHandle.resolveSceneTarget(
        first.cameraObjectFocus.targetId,
      );
      if (resolvedTarget) {
        activateCameraFocus(first.cameraObjectFocus);
      } else {
        console.warn(
          `[GeoSee] Saved camera object focus target missing: ${first.cameraObjectFocus.targetId}`,
        );
      }
    }

    const readCurrentPose = (): Pose => ({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [controls.target.x, controls.target.y, controls.target.z],
      up: [camera.up.x, camera.up.y, camera.up.z],
      fov: camera.fov,
    });

    const applyCameraPose = (pose: Pose) => {
      camera.position.set(...pose.position);
      camera.up.set(...pose.up);
      controls.target.set(...pose.target);
      if (camera.fov !== pose.fov) {
        camera.fov = pose.fov;
        camera.updateProjectionMatrix();
      }
      suppressControlsChangeRef.current = true;
      try {
        controls.update();
      } finally {
        suppressControlsChangeRef.current = false;
      }
    };

    const applyDynamicCamera = (timeMs: number) => {
      if (
        isTransitioningRef.current ||
        freelookActiveRef.current ||
        focusTweeningRef.current ||
        cameraObjectFocusRef.current
      ) {
        return;
      }
      const page = pagesRef.current[currentIndexRef.current];
      const dynamic = page?.dynamicCamera;
      if (!page || dynamic?.enabled !== true) {
        dynamicPageIdRef.current = null;
        dynamicStartMsRef.current = null;
        dynamicOrbitBlendMsRef.current = null;
        dynamicBasePoseRef.current = arrivalPoseRef.current;
        return;
      }

      const basePose =
        dynamicBasePoseRef.current ??
        arrivalPoseRef.current ??
        (() => {
          const resolved = resolvePresentationState(page);
          return poseWithEnvironmentCamera(
            resolved.page.camera,
            resolved.environment,
          );
        })();
      if (dynamicPageIdRef.current !== page.id) {
        dynamicPageIdRef.current = page.id;
        dynamicStartMsRef.current = timeMs;
        dynamicBasePoseRef.current = basePose;
      }

      const startMs = dynamicStartMsRef.current ?? timeMs;
      const orbitBlendMs =
        dynamic.pathAwareBlend === true &&
        dynamicOrbitBlendMsRef.current?.pageId === page.id
          ? dynamicOrbitBlendMsRef.current.value
          : undefined;
      applyCameraPose(
        computeDynamicPose(page, basePose, timeMs, startMs, { orbitBlendMs }),
      );
    };

    const applyTransitionDynamicCamera = (timeMs: number) => {
      const transition = transitionDynamicRef.current;
      if (!transition) return;
      const elapsedMs = Math.max(0, timeMs - transition.startMs);
      let pose = readCurrentPose();
      let changed = false;
      if (transition.from && transition.from.rampMs > 0) {
        const amount =
          1 -
          curveEnvelope(
            elapsedMs / Math.max(1, transition.from.rampMs),
            transition.from.curve,
          );
        if (amount > 0.001) {
          const sourcePose = computeDynamicPose(
            transition.from.page,
            transition.from.basePose,
            timeMs,
            transition.from.startMs,
            { orbitBlendMs: transition.from.orbitBlendMs },
          );
          pose = blendPose(pose, sourcePose, amount);
          changed = true;
        }
      }
      if (transition.to && transition.to.rampMs > 0) {
        const leadStartMs = Math.max(
          0,
          transition.durationMs - transition.to.rampMs,
        );
        const amount = curveEnvelope(
          (elapsedMs - leadStartMs) / Math.max(1, transition.to.rampMs),
          transition.to.curve,
        );
        if (amount > 0.001) {
          const targetPose = computeDynamicPose(
            transition.to.page,
            transition.to.basePose,
            timeMs,
            transition.to.startMs,
            { orbitBlendMs: transition.to.orbitBlendMs },
          );
          pose = blendPose(pose, targetPose, amount);
          changed = true;
        }
      }
      if (changed) applyCameraPose(pose);
    };

    const applyPageTransitionProgress = (timeMs: number) => {
      const transition = pageTransitionRef.current;
      if (!transition) return;
      const raw =
        transition.durationMs <= 0
          ? 1
          : (timeMs - transition.startMs) / transition.durationMs;
      const done = raw >= 1;
      const nextProgress = done
        ? 1
        : pageTransitionProgress(raw, transition.easing);
      if (
        done ||
        Math.abs(nextProgress - transitionProgressRef.current) >= 0.003
      ) {
        transitionProgressRef.current = nextProgress;
        setTransitionProgress(nextProgress);
      }
      if (done) pageTransitionRef.current = null;
    };

    const applyLockedCameraFocus = () => {
      const focus = cameraObjectFocusRef.current;
      if (!focus || focusTweeningRef.current) return;
      if (focusPreviousPanEnabledRef.current === null) {
        focusPreviousPanEnabledRef.current = controls.enablePan;
      }
      controls.enablePan = false;
      const point = vec3FromArray(focus.worldPoint);
      if (!controls.target.equals(point)) {
        controls.target.copy(point);
        suppressControlsChangeRef.current = true;
        try {
          controls.update();
        } finally {
          suppressControlsChangeRef.current = false;
        }
      }
    };

    const offTick = onTick((t) => {
      tweener.update(t);
      applyPageTransitionProgress(t);
      applyTransitionDynamicCamera(t);
      applyDynamicCamera(t);
      applyLockedCameraFocus();
    });

    const onChange = () => {
      if (isTransitioningRef.current || suppressControlsChangeRef.current) return;
      setFreelookActive((prev) => prev || true);
    };
    controls.addEventListener("change", onChange);

    return () => {
      offTick();
      controls.removeEventListener("change", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tweenToCameraObjectFocus = useCallback(
    (detail: SceneTargetEventDetail) => {
      const tweener = tweenerRef.current;
      if (!tweener) return;
      const settings = focusSettings();
      const focus: CameraObjectFocus = {
        targetId: detail.targetId,
        worldPoint: detail.worldPoint,
      };
      const focusPoint = vec3FromArray(detail.worldPoint);
      const sameTarget =
        cameraObjectFocusRef.current?.targetId === detail.targetId;
      const viewport = {
        width: sceneHandle.renderer.domElement.clientWidth,
        height: sceneHandle.renderer.domElement.clientHeight,
      };
      const targetPose = sameTarget
        ? poseForFocusZoom({
            camera: sceneHandle.camera,
            focusPoint,
            zoomFactor: settings.sameTargetZoomFactor,
          })
        : poseForFocusFit({
            camera: sceneHandle.camera,
            focusPoint,
            worldBox: boxFromSceneTargetBox(detail.worldBox),
            viewport,
            paddingPx: settings.fitPaddingPx,
          });
      focusTweeningRef.current = true;
      freelookActiveRef.current = false;
      setFreelookActive(false);
      sceneHandle.setRaycastEnabled(false);
      const finish = () => {
        arrivalPoseRef.current = targetPose;
        dynamicBasePoseRef.current = targetPose;
        dynamicPageIdRef.current = null;
        dynamicStartMsRef.current = null;
        dynamicOrbitBlendMsRef.current = null;
        sceneHandle.setRaycastEnabled(true);
        activateCameraFocus(focus);
      };
      if (prefersReducedMotion() || settings.durationMs <= 0) {
        applyPose(sceneHandle.camera, sceneHandle.controls, targetPose);
        finish();
        return;
      }
      tweener.tweenTo(
        targetPose,
        settings.durationMs,
        settings.easing as EasingName,
        finish,
      );
    },
    [activateCameraFocus, focusSettings, sceneHandle],
  );

  useEffect(() => {
    const handleFocus = (event: Event) => {
      const detail = (event as CustomEvent<SceneTargetEventDetail>).detail;
      if (!detail?.targetId) return;
      tweenToCameraObjectFocus(detail);
    };
    const handleReleaseRequest = (event: Event) => {
      const detail = (
        event as CustomEvent<{ distancePx?: number } | undefined>
      ).detail;
      const settings = focusSettings();
      const distancePx =
        typeof detail?.distancePx === "number" ? detail.distancePx : 0;
      if (distancePx > settings.rmbExitDragPx) return;
      releaseCameraFocus("rmb");
    };
    window.addEventListener("geosee:scene-target-focus", handleFocus);
    window.addEventListener(
      "geosee:camera-focus-release-request",
      handleReleaseRequest,
    );
    return () => {
      window.removeEventListener("geosee:scene-target-focus", handleFocus);
      window.removeEventListener(
        "geosee:camera-focus-release-request",
        handleReleaseRequest,
      );
    };
  }, [focusSettings, releaseCameraFocus, tweenToCameraObjectFocus]);

  useEffect(() => {
    isTransitioningRef.current = isTransitioning;
  }, [isTransitioning]);

  // When environment changes (editor edits to base styles, scene chrome,
  // or default visibility), reapply against the currently-displayed page
  // so the live scene reflects the change without waiting for a transition.
  useEffect(() => {
    const page = pages[currentIndex];
    if (!page) return;
    if (isTransitioningRef.current) {
      return;
    }
    const resolved = resolvePresentationState(page, environment);
    // applyEnvironment first so terrain shader uniforms / sun direction
    // are current before styles/visibility evaluate against them.
    sceneHandle.manager.applyEnvironment(resolved.environment);
    sceneHandle.manager.applyEffectiveVisibilityForPage(
      resolved.environment,
      resolved.page,
    );
    sceneHandle.manager.applyEffectiveStylesForPage(
      resolved.environment,
      resolved.page,
    );
    sceneHandle.manager.applyPageScene(resolved.page);
    sceneHandle.manager.applySceneOverlaysForPage(
      resolved.environment,
      resolved.page,
    );
    const pageCameraKey = `${page.id}:${poseKey(page.camera)}`;
    if (
      !isTransitioningRef.current &&
      currentCameraKeyRef.current !== pageCameraKey
    ) {
      const pagePose = poseWithEnvironmentCamera(
        resolved.page.camera,
        resolved.environment,
      );
      arrivalPoseRef.current = pagePose;
      dynamicBasePoseRef.current = pagePose;
      dynamicPageIdRef.current = null;
      dynamicStartMsRef.current = null;
      dynamicOrbitBlendMsRef.current = null;
      currentCameraKeyRef.current = pageCameraKey;
    }
    const envFov = resolved.environment.scene?.camera?.fov;
    if (typeof envFov === "number" && sceneHandle.camera.fov !== envFov) {
      sceneHandle.camera.fov = envFov;
      sceneHandle.camera.updateProjectionMatrix();
      if (arrivalPoseRef.current) {
        arrivalPoseRef.current = { ...arrivalPoseRef.current, fov: envFov };
      }
      if (dynamicBasePoseRef.current) {
        dynamicBasePoseRef.current = {
          ...dynamicBasePoseRef.current,
          fov: envFov,
        };
      }
    }
  }, [
    environment,
    pages,
    currentIndex,
    sceneHandle,
    previewEnvironmentBase,
    presentationStateTransform,
    resolvePresentationState,
  ]);

  const goto = useCallback(
    (index: number, reason: NavigationReason = "page-click") => {
      if (index < 0 || index >= pages.length) return;
      const activeTargetIndex = targetIndexRef.current;
      if (isTransitioningRef.current && index === activeTargetIndex) return;
      if (
        !isTransitioningRef.current &&
        index === currentIndexRef.current &&
        !freelookActiveRef.current
      ) {
        return;
      }
      const target = pages[index];
      const tweener = tweenerRef.current;
      if (!tweener) return;
      if (cameraObjectFocusRef.current || focusTweeningRef.current) {
        releaseCameraFocus("navigation");
      }
      const wasTransitioning = isTransitioningRef.current;
      const wasFreelook = freelookActiveRef.current;
      const sourceIndex = wasTransitioning
        ? activeTargetIndex ?? currentIndexRef.current
        : currentIndexRef.current;
      const source = pages[sourceIndex] ?? pages[currentIndexRef.current];
      const sourceResolved = resolvePresentationState(source);
      const targetResolved = resolvePresentationState(target);
      const targetPose = poseWithEnvironmentCamera(
        targetResolved.page.camera,
        targetResolved.environment,
      );
      const currentPose: Pose = {
        position: [
          sceneHandle.camera.position.x,
          sceneHandle.camera.position.y,
          sceneHandle.camera.position.z,
        ],
        target: [
          sceneHandle.controls.target.x,
          sceneHandle.controls.target.y,
          sceneHandle.controls.target.z,
        ],
        up: [
          sceneHandle.camera.up.x,
          sceneHandle.camera.up.y,
          sceneHandle.camera.up.z,
        ],
        fov: sceneHandle.camera.fov,
      };
      const transitionReason: NavigationReason = wasTransitioning
        ? "interrupted"
        : wasFreelook
          ? "freelook"
          : reason;
      const transitionStartMs = performance.now();
      const transitionDuration = target.transition.duration;

      isTransitioningRef.current = true;
      targetIndexRef.current = index;
      activeSceneTransitionRef.current = {
        sourcePageId: source?.id ?? null,
        targetPageId: target.id,
        reason: transitionReason,
        startMs: transitionStartMs,
        durationMs: transitionDuration,
        sourcePose: currentPose,
        targetPose,
      };
      setIsTransitioning(true);
      setTargetIndex(index);
      setTransitionProgress(0);
      transitionProgressRef.current = 0;
      freelookActiveRef.current = false;
      setFreelookActive(false);
      sceneHandle.setPageCameraMarker(null);

      // Data-layer changes follow the page camera transition. Text overlays
      // keep their own fade timing; scene data uses page timing by default.
      const layerFadeMs = Math.max(0, transitionDuration);
      sceneHandle.manager.transitionEffectiveLayersForPage(
        targetResolved.environment,
        sourceResolved.page,
        targetResolved.page,
        layerFadeMs,
        target.transition.easing,
        transitionDuration,
        target.transition.easing,
        transitionReason,
      );
      // Per-page mood (cinematicExposure / bloomBoost) flips at start too.
      sceneHandle.manager.applyPageScene(targetResolved.page);
      // Scene overlays: fade leaving overlays out NOW (so they're not
      // visible mid-tween over the wrong terrain) but defer fade-ins to
      // the camera-arrival callback below.
      sceneHandle.manager.applySceneOverlaysAtTransitionStart(
        targetResolved.environment,
        targetResolved.page,
      );

      pageTransitionRef.current = {
        startMs: transitionStartMs,
        durationMs: transitionDuration,
        easing: target.transition.easing,
      };
      const transitionPathDistance = posePathDistance(currentPose, targetPose);
      const sourceForDynamic =
        wasTransitioning || wasFreelook ? null : sourceResolved.page;
      const sourceOrbitBlendMs =
        sourceForDynamic?.dynamicCamera?.pathAwareBlend === true &&
        source &&
        dynamicOrbitBlendMsRef.current?.pageId === source.id
          ? dynamicOrbitBlendMsRef.current.value
          : dynamicOrbitBlendMs(
              sourceForDynamic?.dynamicCamera,
              transitionDuration,
              transitionPathDistance,
            );
      const targetOrbitBlendMs = dynamicOrbitBlendMs(
        target.dynamicCamera,
        transitionDuration,
        transitionPathDistance,
      );
      const sourceExitMs =
        sourceForDynamic && dynamicOrbitEnabled(sourceForDynamic.dynamicCamera)
          ? dynamicTransitionExitMs(
              sourceForDynamic.dynamicCamera,
              transitionDuration,
              transitionPathDistance,
            )
          : 0;
      const targetOrbitLeadMs = dynamicOrbitEnabled(target.dynamicCamera)
        ? dynamicTransitionLeadMs(
            target.dynamicCamera,
            transitionDuration,
            transitionPathDistance,
          )
        : 0;
      const targetZoomEnabled = dynamicZoomEnabled(
        target.dynamicCamera,
        targetPose,
      );
      const targetLeadMs =
        targetOrbitLeadMs > 0 || !targetZoomEnabled
          ? targetOrbitLeadMs
          : target.transition.duration;
      const sourceBasePose =
        sourceForDynamic && sourceExitMs > 0
          ? dynamicBasePoseRef.current ??
            arrivalPoseRef.current ??
            poseWithEnvironmentCamera(
              sourceResolved.page.camera,
              sourceResolved.environment,
            )
          : null;
      const sourceStartMs = dynamicStartMsRef.current ?? transitionStartMs;
      dynamicPageIdRef.current = null;
      dynamicStartMsRef.current = null;
      dynamicBasePoseRef.current = null;
      dynamicOrbitBlendMsRef.current = null;
      transitionDynamicRef.current =
        sourceExitMs > 0 || targetLeadMs > 0
          ? {
              startMs: transitionStartMs,
              durationMs: transitionDuration,
              from:
                sourceForDynamic && sourceBasePose && sourceExitMs > 0
                  ? {
                      page: sourceResolved.page,
                      basePose: sourceBasePose,
                      startMs: sourceStartMs,
                      rampMs: sourceExitMs,
                      curve: transitionBlendCurve(
                        sourceForDynamic.dynamicCamera,
                      ),
                      orbitBlendMs: sourceOrbitBlendMs,
                    }
                  : undefined,
              to:
                targetLeadMs > 0
                  ? {
                      page: targetResolved.page,
                      basePose: targetPose,
                      startMs: transitionStartMs,
                      rampMs: targetLeadMs,
                      curve: transitionBlendCurve(target.dynamicCamera),
                      orbitBlendMs: targetOrbitBlendMs,
                    }
                  : undefined,
            }
          : null;
      // Suppress hover-tooltip raycast for the duration of the tween:
      // objects fly past the cursor and any flash of "DH23-..." mid-tween
      // would feel chaotic.
      sceneHandle.setRaycastEnabled(false);
      tweener.tweenTo(
        targetPose,
        target.transition.duration,
        target.transition.easing,
        () => {
          const transitionDynamic = transitionDynamicRef.current;
          if (transitionDynamic?.to) {
            const finishTime =
              transitionDynamic.startMs + transitionDynamic.durationMs;
            const finishPose = computeDynamicPose(
              transitionDynamic.to.page,
              transitionDynamic.to.basePose,
              finishTime,
              transitionDynamic.to.startMs,
              { orbitBlendMs: transitionDynamic.to.orbitBlendMs },
            );
            sceneHandle.camera.position.set(...finishPose.position);
            sceneHandle.camera.up.set(...finishPose.up);
            sceneHandle.controls.target.set(...finishPose.target);
            if (sceneHandle.camera.fov !== finishPose.fov) {
              sceneHandle.camera.fov = finishPose.fov;
              sceneHandle.camera.updateProjectionMatrix();
            }
            suppressControlsChangeRef.current = true;
            try {
              sceneHandle.controls.update();
            } finally {
              suppressControlsChangeRef.current = false;
            }
            dynamicPageIdRef.current = target.id;
            dynamicStartMsRef.current = transitionDynamic.to.startMs;
            dynamicOrbitBlendMsRef.current =
              target.dynamicCamera?.pathAwareBlend === true &&
              typeof transitionDynamic.to.orbitBlendMs === "number"
                ? {
                    pageId: target.id,
                    value: transitionDynamic.to.orbitBlendMs,
                  }
                : null;
          }
          arrivalPoseRef.current = targetPose;
          dynamicBasePoseRef.current = targetPose;
          if (!transitionDynamic?.to) dynamicPageIdRef.current = null;
          if (!transitionDynamic?.to) dynamicStartMsRef.current = null;
          if (!transitionDynamic?.to) dynamicOrbitBlendMsRef.current = null;
          transitionDynamicRef.current = null;
          pageTransitionRef.current = null;
          activeSceneTransitionRef.current = null;
          transitionProgressRef.current = 1;
          setTransitionProgress(1);
          currentCameraKeyRef.current = `${target.id}:${poseKey(target.camera)}`;
          currentIndexRef.current = index;
          targetIndexRef.current = null;
          isTransitioningRef.current = false;
          setCurrentIndex(index);
          setIsTransitioning(false);
          setTargetIndex(null);
          sceneHandle.setRaycastEnabled(true);
          sceneHandle.manager.applySceneOverlaysAtTransitionEnd(
            targetResolved.environment,
            targetResolved.page,
          );
          const savedFocus = target.cameraObjectFocus;
          if (savedFocus) {
            const resolvedTarget = sceneHandle.resolveSceneTarget(
              savedFocus.targetId,
            );
            if (!resolvedTarget) {
              console.warn(
                `[GeoSee] Saved camera object focus target missing: ${savedFocus.targetId}`,
              );
              releaseCameraFocus("missing-target");
            } else {
              activateCameraFocus(savedFocus);
            }
          }
        },
      );
    },
    [
      pages,
      sceneHandle,
      resolvePresentationState,
      releaseCameraFocus,
      activateCameraFocus,
    ],
  );

  const next = useCallback(() => {
    if (pages.length === 0) return;
    const baseIndex = targetIndexRef.current ?? currentIndexRef.current;
    goto(findVisiblePageIndex(pages, baseIndex, 1), "keyboard");
  }, [goto, pages]);
  const prev = useCallback(() => {
    if (pages.length === 0) return;
    const baseIndex = targetIndexRef.current ?? currentIndexRef.current;
    goto(findVisiblePageIndex(pages, baseIndex, -1), "keyboard");
  }, [goto, pages]);

  const tweenToPose = useCallback(
    (pose: PresentationPage["camera"]) => {
      const tweener = tweenerRef.current;
      if (!tweener) return;
      if (cameraObjectFocusRef.current || focusTweeningRef.current) {
        releaseCameraFocus("pose");
      }
      const targetPose = poseWithEnvironmentCamera(pose, environmentRef.current);
      isTransitioningRef.current = true;
      targetIndexRef.current = null;
      activeSceneTransitionRef.current = null;
      freelookActiveRef.current = false;
      setIsTransitioning(true);
      setTargetIndex(null);
      setTransitionProgress(1);
      transitionProgressRef.current = 1;
      setFreelookActive(false);
      sceneHandle.setPageCameraMarker(null);
      dynamicPageIdRef.current = null;
      dynamicStartMsRef.current = null;
      dynamicBasePoseRef.current = null;
      dynamicOrbitBlendMsRef.current = null;
      transitionDynamicRef.current = null;
      pageTransitionRef.current = null;
      sceneHandle.setRaycastEnabled(false);
      tweener.tweenTo(targetPose, 1500, "easeOutCubic", () => {
        arrivalPoseRef.current = targetPose;
        dynamicBasePoseRef.current = targetPose;
        dynamicPageIdRef.current = null;
        dynamicStartMsRef.current = null;
        dynamicOrbitBlendMsRef.current = null;
        const page = pagesRef.current[currentIndexRef.current];
        currentCameraKeyRef.current = page
          ? `${page.id}:${poseKey(page.camera)}`
          : null;
        isTransitioningRef.current = false;
        targetIndexRef.current = null;
        setIsTransitioning(false);
        setTargetIndex(null);
        sceneHandle.setRaycastEnabled(true);
      });
    },
    [releaseCameraFocus, sceneHandle],
  );

  const resetToPose = useCallback(() => {
    const arrival = arrivalPoseRef.current;
    const tweener = tweenerRef.current;
    if (!arrival || !tweener) return;
    if (cameraObjectFocusRef.current || focusTweeningRef.current) {
      releaseCameraFocus("pose");
    }
    isTransitioningRef.current = true;
    targetIndexRef.current = null;
    activeSceneTransitionRef.current = null;
    freelookActiveRef.current = false;
    setIsTransitioning(true);
    setTargetIndex(null);
    setTransitionProgress(1);
    transitionProgressRef.current = 1;
    setFreelookActive(false);
    sceneHandle.setPageCameraMarker(null);
    dynamicPageIdRef.current = null;
    dynamicStartMsRef.current = null;
    dynamicBasePoseRef.current = null;
    dynamicOrbitBlendMsRef.current = null;
    transitionDynamicRef.current = null;
    pageTransitionRef.current = null;
    sceneHandle.setRaycastEnabled(false);
    tweener.tweenTo(arrival, 1500, "easeOutCubic", () => {
      dynamicBasePoseRef.current = arrival;
      dynamicPageIdRef.current = null;
      dynamicStartMsRef.current = null;
      dynamicOrbitBlendMsRef.current = null;
      const page = pagesRef.current[currentIndexRef.current];
      currentCameraKeyRef.current = page
        ? `${page.id}:${poseKey(page.camera)}`
        : null;
      isTransitioningRef.current = false;
      targetIndexRef.current = null;
      setIsTransitioning(false);
      setTargetIndex(null);
      sceneHandle.setRaycastEnabled(true);
    });
  }, [releaseCameraFocus, sceneHandle]);

  useEffect(() => {
    sceneHandle.setPageCameraMarkerClickHandler(resetToPose);
    return () => sceneHandle.setPageCameraMarkerClickHandler(null);
  }, [sceneHandle, resetToPose]);

  useEffect(() => {
    const page = pages[currentIndex];
    if (!allowPageCameraMarker || !page || !freelookActive || isTransitioning) {
      sceneHandle.setPageCameraMarker(null);
      return;
    }
    const resolved = resolvePresentationState(page, environment);
    const pose =
      arrivalPoseRef.current ??
      poseWithEnvironmentCamera(resolved.page.camera, resolved.environment);
    sceneHandle.setPageCameraMarker(pose);
    return () => sceneHandle.setPageCameraMarker(null);
  }, [
    currentIndex,
    allowPageCameraMarker,
    environment,
    freelookActive,
    isTransitioning,
    pages,
    resolvePresentationState,
    sceneHandle,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debugHandle = {
      goto,
      next,
      prev,
      getState: () => ({
        currentIndex: currentIndexRef.current,
        currentPageId: pagesRef.current[currentIndexRef.current]?.id ?? null,
        targetIndex: targetIndexRef.current,
        targetPageId:
          targetIndexRef.current !== null
            ? pagesRef.current[targetIndexRef.current]?.id ?? null
            : null,
        transitionProgress: transitionProgressRef.current,
        isTransitioning: isTransitioningRef.current,
        transitionContext: activeSceneTransitionRef.current,
        sceneTransition:
          typeof sceneHandle.manager.getTransitionDebugState === "function"
            ? sceneHandle.manager.getTransitionDebugState()
            : null,
      }),
    };
    const debugWindow = window as unknown as {
      __pageController?: typeof debugHandle;
    };
    debugWindow.__pageController = debugHandle;
    return () => {
      if (debugWindow.__pageController === debugHandle) {
        delete debugWindow.__pageController;
      }
    };
  }, [goto, next, prev, sceneHandle.manager]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack keys when the user is typing into an editable element.
      // Without this, Home/End/PageUp/PageDown/Arrow inside a textarea or
      // input would navigate pages instead of moving the caret -- which
      // looks to the user like "the overlay save is silently moving my
      // typing to a different page" because subsequent keystrokes target
      // the new page's textarea (now-current selectedPageId).
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const editable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (t?.isContentEditable ?? false);
      if (editable) return;

      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") {
        e.preventDefault();
        const index = firstVisiblePageIndex(pages);
        if (index >= 0) goto(index, "keyboard");
      } else if (e.key === "End") {
        e.preventDefault();
        const index = lastVisiblePageIndex(pages);
        if (index >= 0) goto(index, "keyboard");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, goto, pages]);

  const value = useMemo<PageControllerValue>(
    () => ({
      pages,
      currentIndex,
      targetIndex,
      transitionProgress,
      isTransitioning,
      freelookActive,
      cameraObjectFocus,
      goto,
      next,
      prev,
      resetToPose,
      tweenToPose,
    }),
    [
      pages,
      currentIndex,
      targetIndex,
      transitionProgress,
      isTransitioning,
      freelookActive,
      cameraObjectFocus,
      goto,
      next,
      prev,
      resetToPose,
      tweenToPose,
    ],
  );

  return (
    <PageControllerContext.Provider value={value}>
      {children}
    </PageControllerContext.Provider>
  );
}

export function usePageController(): PageControllerValue {
  const v = useContext(PageControllerContext);
  if (!v) throw new Error("usePageController must be inside PageControllerProvider");
  return v;
}
