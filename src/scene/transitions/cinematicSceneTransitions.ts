import type {
  EasingName,
  EnvironmentSetup,
  PresentationPage,
  SceneProperties,
  Vec3,
} from "../../pages/types";
import { mergeSceneProperties } from "../../pages/effective";
import {
  activeRenderPresetIdForPage,
  projectRenderPresets,
  scenePatchForRenderPreset,
} from "../../pages/renderPresets";
import { clamp01 } from "../styles/styleUtils";
import { easeProgress } from "./transitionStyles";

export type CinematicSceneTransitionKind =
  | "continuous"
  | "discrete"
  | "timed-shot";

export interface CinematicSceneTransitionPolicy {
  key: string;
  transitionKind: CinematicSceneTransitionKind;
  owner: "cinematic-post" | "camera-runtime" | "editor-overlay";
  channelClass:
    | "post-scalar"
    | "post-color"
    | "post-toggle"
    | "camera-motion";
}

export const CINEMATIC_SCENE_TRANSITION_CHANNELS: readonly CinematicSceneTransitionPolicy[] =
  [
    {
      key: "colorGrade",
      transitionKind: "continuous",
      owner: "cinematic-post",
      channelClass: "post-color",
    },
    {
      key: "vignette",
      transitionKind: "continuous",
      owner: "cinematic-post",
      channelClass: "post-scalar",
    },
    {
      key: "depthOfField",
      transitionKind: "continuous",
      owner: "cinematic-post",
      channelClass: "post-scalar",
    },
    {
      key: "tiltShift",
      transitionKind: "continuous",
      owner: "cinematic-post",
      channelClass: "post-scalar",
    },
    {
      key: "lensEffects",
      transitionKind: "continuous",
      owner: "cinematic-post",
      channelClass: "post-scalar",
    },
    {
      key: "motionTrails",
      transitionKind: "continuous",
      owner: "cinematic-post",
      channelClass: "post-scalar",
    },
    {
      key: "presentationFrame",
      transitionKind: "continuous",
      owner: "cinematic-post",
      channelClass: "post-scalar",
    },
    {
      key: "compositionGuides",
      transitionKind: "continuous",
      owner: "cinematic-post",
      channelClass: "post-scalar",
    },
    {
      key: "camera.lensPreset",
      transitionKind: "discrete",
      owner: "camera-runtime",
      channelClass: "camera-motion",
    },
    {
      key: "dynamicCamera.dolly",
      transitionKind: "timed-shot",
      owner: "camera-runtime",
      channelClass: "camera-motion",
    },
    {
      key: "dynamicCamera.truck",
      transitionKind: "timed-shot",
      owner: "camera-runtime",
      channelClass: "camera-motion",
    },
    {
      key: "dynamicCamera.crane",
      transitionKind: "timed-shot",
      owner: "camera-runtime",
      channelClass: "camera-motion",
    },
    {
      key: "dynamicCamera.handheld",
      transitionKind: "timed-shot",
      owner: "camera-runtime",
      channelClass: "camera-motion",
    },
  ];

interface CinematicPageMood {
  cinematicExposure: number;
  bloomBoost: number;
}

export interface CinematicSceneTransitionRuntime {
  sourcePageId: string;
  targetPageId: string;
  sourcePage: PresentationPage;
  targetPage: PresentationPage;
  sourceScene: SceneProperties;
  targetScene: SceneProperties;
  sourceMood: CinematicPageMood;
  targetMood: CinematicPageMood;
  startMs: number;
  durationMs: number;
  easing: EasingName;
}

export interface CinematicSceneTransitionFrame {
  scene: SceneProperties;
  page: Pick<PresentationPage, "bloomBoost" | "camera" | "cinematicExposure">;
  progress: number;
  done: boolean;
}

export interface CinematicSceneTransitionDebugState {
  active: boolean;
  transitionKind: "continuous-post";
  sourcePageId: string | null;
  targetPageId: string | null;
  progress: number | null;
  policyCount: number;
  channelPolicies: Array<{
    key: string;
    transitionKind: CinematicSceneTransitionKind;
  }>;
}

const POST_NUMERIC_DEFAULTS: Record<string, number> = {
  exposure: 1,
  contrast: 1.06,
  saturation: 1.06,
  vibrancy: 1,
  tintStrength: 0.04,
  temperature: 0,
  blackPoint: 0,
  whitePoint: 1,
  lift: 0,
  gamma: 1,
  gain: 1,
  splitToneAmount: 0,
  filterIntensity: 0,
  strength: 0,
  radius: 0.7,
  threshold: 0.82,
  smoothness: 0.75,
  focusDistanceM: 1000,
  aperture: 0.00002,
  maxBlur: 0.004,
  debugFocusPlaneOpacity: 0.16,
  debugFocusPlaneScale: 1,
  centerX: 0.5,
  centerY: 0.5,
  angleDeg: 0,
  bandSize: 0.28,
  feather: 0.2,
  blur: 0,
  grain: 0,
  grainSize: 1,
  distortion: 0,
  chromaticAberration: 0,
  sharpen: 0,
  diffusion: 0,
  halation: 0,
  anamorphicStreak: 0,
  anamorphicStreakLength: 0.45,
  anamorphicStreakThreshold: 0.82,
  amount: 0,
  matteOpacity: 0.72,
  cornerFade: 0,
  gateWeave: 0,
  minDistance: 0.004,
  maxDistance: 0.12,
  lineThickness: 0.25,
};

const COLOR_FIELDS = new Set([
  "tint",
  "splitShadowColor",
  "splitHighlightColor",
  "matteColor",
]);

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pickMid<T>(from: T | undefined, to: T | undefined, t: number): T | undefined {
  return t < 0.5 ? (from ?? to) : (to ?? from);
}

function boolAtMid(
  from: boolean | undefined,
  to: boolean | undefined,
  t: number,
): boolean | undefined {
  return pickMid(from, to, t);
}

function activeDuringBlend(
  from: boolean | undefined,
  to: boolean | undefined,
  t: number,
): boolean | undefined {
  if (from === true || to === true) return t < 1 ? true : to === true;
  return to ?? from;
}

function blendNumberField(
  from: Record<string, unknown> | undefined,
  to: Record<string, unknown> | undefined,
  key: string,
  t: number,
  fallback = POST_NUMERIC_DEFAULTS[key] ?? 0,
): number | undefined {
  const fromValue = from?.[key];
  const toValue = to?.[key];
  const hasFrom = typeof fromValue === "number" && Number.isFinite(fromValue);
  const hasTo = typeof toValue === "number" && Number.isFinite(toValue);
  if (!hasFrom && !hasTo) return undefined;
  const a = hasFrom ? Number(fromValue) : fallback;
  const b = hasTo ? Number(toValue) : fallback;
  return lerp(a, b, t);
}

function hexToRgb(value: unknown): [number, number, number] | null {
  if (typeof value !== "string") return null;
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb: [number, number, number]): string {
  const n =
    (Math.round(rgb[0]) << 16) |
    (Math.round(rgb[1]) << 8) |
    Math.round(rgb[2]);
  return `#${n.toString(16).padStart(6, "0")}`;
}

function blendHexColor(
  from: unknown,
  to: unknown,
  t: number,
): string | undefined {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  if (!a && !b) return undefined;
  if (!a) return typeof to === "string" ? to : undefined;
  if (!b) return typeof from === "string" ? from : undefined;
  return rgbToHex([
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ]);
}

function blendRecord(
  from: Record<string, unknown> | undefined,
  to: Record<string, unknown> | undefined,
  t: number,
  numericKeys: readonly string[],
): Record<string, unknown> | undefined {
  if (!from && !to) return undefined;
  const next: Record<string, unknown> = { ...(from ?? {}), ...(to ?? {}) };
  for (const key of numericKeys) {
    const value = blendNumberField(from, to, key, t);
    if (value !== undefined) next[key] = value;
  }
  for (const key of COLOR_FIELDS) {
    const value = blendHexColor(from?.[key], to?.[key], t);
    if (value !== undefined) next[key] = value;
  }
  return next;
}

function blendEffectNumber(
  from: Record<string, unknown> | undefined,
  to: Record<string, unknown> | undefined,
  key: string,
  t: number,
  fromEnabled: boolean,
  toEnabled: boolean,
  enabledFallback: number,
): number {
  const fromValue = fromEnabled ? finiteNumber(from?.[key], enabledFallback) : 0;
  const toValue = toEnabled ? finiteNumber(to?.[key], enabledFallback) : 0;
  return lerp(fromValue, toValue, t);
}

function blendVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function transitionProgress(
  transition: CinematicSceneTransitionRuntime,
  nowMs: number,
): { progress: number; done: boolean } {
  const raw =
    transition.durationMs <= 0
      ? 1
      : (nowMs - transition.startMs) / transition.durationMs;
  const done = raw >= 1;
  const progress = done ? 1 : easeProgress(clamp01(raw), transition.easing);
  return { progress, done };
}

function pageMood(page: PresentationPage): CinematicPageMood {
  return {
    cinematicExposure: page.cinematicExposure ?? 1,
    bloomBoost: page.bloomBoost ?? 1,
  };
}

export function resolveCinematicSceneForTransition(
  environment: EnvironmentSetup,
  page: PresentationPage,
): SceneProperties {
  const presetId = activeRenderPresetIdForPage(environment, page);
  const presetPatch = scenePatchForRenderPreset(
    presetId,
    projectRenderPresets(environment),
  );
  const sceneWithPreset = mergeSceneProperties(
    environment.scene,
    presetPatch ?? undefined,
  );
  return mergeSceneProperties(sceneWithPreset, page.sceneOverrides ?? undefined);
}

export function createCinematicSceneTransition(
  fromEnvironment: EnvironmentSetup,
  toEnvironment: EnvironmentSetup,
  fromPage: PresentationPage,
  toPage: PresentationPage,
  durationMs: number,
  easing: EasingName,
  startMs: number,
): CinematicSceneTransitionRuntime {
  return {
    sourcePageId: fromPage.id,
    targetPageId: toPage.id,
    sourcePage: fromPage,
    targetPage: toPage,
    sourceScene: resolveCinematicSceneForTransition(fromEnvironment, fromPage),
    targetScene: resolveCinematicSceneForTransition(toEnvironment, toPage),
    sourceMood: pageMood(fromPage),
    targetMood: pageMood(toPage),
    startMs,
    durationMs: Math.max(0, durationMs),
    easing,
  };
}

export function blendCinematicSceneForTransition(
  transition: CinematicSceneTransitionRuntime,
  nowMs: number,
): CinematicSceneTransitionFrame {
  const { progress, done } = transitionProgress(transition, nowMs);
  const t = progress;
  const from = transition.sourceScene;
  const to = transition.targetScene;
  const scene: SceneProperties = { ...to };

  const exposure = blendNumberField(from, to, "exposure", t, 1);
  if (exposure !== undefined) scene.exposure = exposure;

  scene.bloom = blendRecord(from.bloom, to.bloom, t, [
    "strength",
    "radius",
    "threshold",
  ]) as SceneProperties["bloom"];
  scene.ambientOcclusion = {
    ...(blendRecord(from.ambientOcclusion, to.ambientOcclusion, t, [
      "radius",
      "minDistance",
      "maxDistance",
    ]) as NonNullable<SceneProperties["ambientOcclusion"]>),
    enabled: boolAtMid(
      from.ambientOcclusion?.enabled,
      to.ambientOcclusion?.enabled,
      t,
    ),
  };
  scene.vignette = blendRecord(from.vignette, to.vignette, t, [
    "strength",
    "smoothness",
  ]) as SceneProperties["vignette"];
  scene.colorGrade = blendRecord(from.colorGrade, to.colorGrade, t, [
    "contrast",
    "saturation",
    "vibrancy",
    "tintStrength",
    "temperature",
    "blackPoint",
    "whitePoint",
    "lift",
    "gamma",
    "gain",
    "splitToneAmount",
    "filterIntensity",
  ]) as SceneProperties["colorGrade"];

  const fromDof = from.depthOfField as Record<string, unknown> | undefined;
  const toDof = to.depthOfField as Record<string, unknown> | undefined;
  const fromDofEnabled = from.depthOfField?.enabled === true;
  const toDofEnabled = to.depthOfField?.enabled === true;
  scene.depthOfField = {
    ...(from.depthOfField ?? {}),
    ...(to.depthOfField ?? {}),
    enabled: activeDuringBlend(
      from.depthOfField?.enabled,
      to.depthOfField?.enabled,
      t,
    ),
    focusMode: pickMid(from.depthOfField?.focusMode, to.depthOfField?.focusMode, t),
    focusDistanceM: blendNumberField(fromDof, toDof, "focusDistanceM", t, 1000),
    focusOffsetM: blendNumberField(fromDof, toDof, "focusOffsetM", t, 0),
    debugFocusPlaneOpacity: blendNumberField(
      fromDof,
      toDof,
      "debugFocusPlaneOpacity",
      t,
      0.16,
    ),
    debugFocusPlaneScale: blendNumberField(
      fromDof,
      toDof,
      "debugFocusPlaneScale",
      t,
      1,
    ),
    focusPoint:
      from.depthOfField?.focusPoint && to.depthOfField?.focusPoint
        ? blendVec3(from.depthOfField.focusPoint, to.depthOfField.focusPoint, t)
        : pickMid(from.depthOfField?.focusPoint, to.depthOfField?.focusPoint, t),
    debugFocusPlane: boolAtMid(
      from.depthOfField?.debugFocusPlane,
      to.depthOfField?.debugFocusPlane,
      t,
    ),
    aperture: blendEffectNumber(
      fromDof,
      toDof,
      "aperture",
      t,
      fromDofEnabled,
      toDofEnabled,
      0.00002,
    ),
    maxBlur: blendEffectNumber(
      fromDof,
      toDof,
      "maxBlur",
      t,
      fromDofEnabled,
      toDofEnabled,
      0.004,
    ),
  };

  const fromTilt = from.tiltShift as Record<string, unknown> | undefined;
  const toTilt = to.tiltShift as Record<string, unknown> | undefined;
  const fromTiltEnabled = from.tiltShift?.enabled === true;
  const toTiltEnabled = to.tiltShift?.enabled === true;
  scene.tiltShift = {
    ...(blendRecord(from.tiltShift, to.tiltShift, t, [
      "centerX",
      "centerY",
      "angleDeg",
      "bandSize",
      "feather",
    ]) as NonNullable<SceneProperties["tiltShift"]>),
    enabled: activeDuringBlend(
      from.tiltShift?.enabled,
      to.tiltShift?.enabled,
      t,
    ),
    blur: blendEffectNumber(
      fromTilt,
      toTilt,
      "blur",
      t,
      fromTiltEnabled,
      toTiltEnabled,
      0,
    ),
  };

  scene.lensEffects = blendRecord(from.lensEffects, to.lensEffects, t, [
    "grain",
    "grainSize",
    "distortion",
    "chromaticAberration",
    "sharpen",
    "diffusion",
    "halation",
    "anamorphicStreak",
    "anamorphicStreakLength",
    "anamorphicStreakThreshold",
  ]) as SceneProperties["lensEffects"];

  const fromTrails = from.motionTrails as Record<string, unknown> | undefined;
  const toTrails = to.motionTrails as Record<string, unknown> | undefined;
  const fromTrailsEnabled = from.motionTrails?.enabled === true;
  const toTrailsEnabled = to.motionTrails?.enabled === true;
  scene.motionTrails = {
    enabled: activeDuringBlend(
      from.motionTrails?.enabled,
      to.motionTrails?.enabled,
      t,
    ),
    amount: blendEffectNumber(
      fromTrails,
      toTrails,
      "amount",
      t,
      fromTrailsEnabled,
      toTrailsEnabled,
      0,
    ),
  };

  const frame = blendRecord(from.presentationFrame, to.presentationFrame, t, [
    "matteOpacity",
    "cornerFade",
    "gateWeave",
  ]) as NonNullable<SceneProperties["presentationFrame"]>;
  scene.presentationFrame = {
    ...frame,
    letterbox: activeDuringBlend(
      from.presentationFrame?.letterbox,
      to.presentationFrame?.letterbox,
      t,
    ),
    aspectRatio: pickMid(
      from.presentationFrame?.aspectRatio,
      to.presentationFrame?.aspectRatio,
      t,
    ),
  };
  const fromGuides = from.compositionGuides as Record<string, unknown> | undefined;
  const toGuides = to.compositionGuides as Record<string, unknown> | undefined;
  if (fromGuides || toGuides) {
    const lineThickness = blendNumberField(
      fromGuides,
      toGuides,
      "lineThickness",
      t,
      0.25,
    );
    scene.compositionGuides = {
      ...(pickMid(from.compositionGuides, to.compositionGuides, t) ?? {}),
      enabled: boolAtMid(
        from.compositionGuides?.enabled,
        to.compositionGuides?.enabled,
        t,
      ),
      ruleOfThirds: boolAtMid(
        from.compositionGuides?.ruleOfThirds,
        to.compositionGuides?.ruleOfThirds,
        t,
      ),
      centerCross: boolAtMid(
        from.compositionGuides?.centerCross,
        to.compositionGuides?.centerCross,
        t,
      ),
      safeFrame: boolAtMid(
        from.compositionGuides?.safeFrame,
        to.compositionGuides?.safeFrame,
        t,
      ),
      aspectMask: pickMid(
        from.compositionGuides?.aspectMask,
        to.compositionGuides?.aspectMask,
        t,
      ),
    };
    if (lineThickness !== undefined) {
      scene.compositionGuides.lineThickness = lineThickness;
    }
  }

  const sourceTarget = transition.sourcePage.camera.target;
  const targetTarget = transition.targetPage.camera.target;
  const page: CinematicSceneTransitionFrame["page"] = {
    ...transition.targetPage,
    camera: {
      ...transition.targetPage.camera,
      target: blendVec3(sourceTarget, targetTarget, t),
    },
    cinematicExposure: lerp(
      transition.sourceMood.cinematicExposure,
      transition.targetMood.cinematicExposure,
      t,
    ),
    bloomBoost: lerp(transition.sourceMood.bloomBoost, transition.targetMood.bloomBoost, t),
  };

  return { scene, page, progress, done };
}

export function inactiveCinematicSceneTransitionDebugState(): CinematicSceneTransitionDebugState {
  return {
    active: false,
    transitionKind: "continuous-post",
    sourcePageId: null,
    targetPageId: null,
    progress: null,
    policyCount: CINEMATIC_SCENE_TRANSITION_CHANNELS.length,
    channelPolicies: CINEMATIC_SCENE_TRANSITION_CHANNELS.map((policy) => ({
      key: policy.key,
      transitionKind: policy.transitionKind,
    })),
  };
}

export function cinematicSceneTransitionDebugState(
  transition: CinematicSceneTransitionRuntime,
  progress: number,
): CinematicSceneTransitionDebugState {
  return {
    active: true,
    transitionKind: "continuous-post",
    sourcePageId: transition.sourcePageId,
    targetPageId: transition.targetPageId,
    progress,
    policyCount: CINEMATIC_SCENE_TRANSITION_CHANNELS.length,
    channelPolicies: CINEMATIC_SCENE_TRANSITION_CHANNELS.map((policy) => ({
      key: policy.key,
      transitionKind: policy.transitionKind,
    })),
  };
}
