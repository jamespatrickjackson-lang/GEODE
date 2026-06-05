import * as THREE from "three";
import type {
  EasingName,
  SceneProperties,
} from "../../pages/types";
import { easeProgress } from "./transitionStyles";

const DARK_MODE_BG = "#23252a";
const LIGHT_MODE_BG = "#a0a0a0";
const DEFAULT_SCENE_FOG_DENSITY = 0.00018;

export interface EnvironmentBackgroundFogState {
  backgroundHex: string;
  fogHex: string;
  fogDensity: number;
  fogEnabled: boolean;
}

export interface EnvironmentSceneTransitionRuntime {
  sourcePageId: string;
  targetPageId: string;
  sourceState: EnvironmentBackgroundFogState;
  targetState: EnvironmentBackgroundFogState;
  startMs: number;
  durationMs: number;
  easing: EasingName;
}

export interface EnvironmentSceneTransitionFrame
  extends EnvironmentBackgroundFogState {
  progress: number;
  done: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function finiteDensity(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : DEFAULT_SCENE_FOG_DENSITY;
}

function safeHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toLowerCase()}`;
  return fallback;
}

function blendHexColor(from: string, to: string, progress: number): string {
  const color = new THREE.Color(from).lerp(new THREE.Color(to), progress);
  return `#${color.getHexString()}`;
}

function lerp(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function transitionProgress(
  transition: Pick<
    EnvironmentSceneTransitionRuntime,
    "durationMs" | "easing" | "startMs"
  >,
  nowMs: number,
): { progress: number; done: boolean } {
  const raw =
    transition.durationMs <= 0
      ? 1
      : (nowMs - transition.startMs) / transition.durationMs;
  const done = raw >= 1;
  return {
    progress: done ? 1 : easeProgress(clamp01(raw), transition.easing),
    done,
  };
}

export function resolveBackgroundFogState(
  scene: SceneProperties,
): EnvironmentBackgroundFogState {
  const lightMode = scene.lightMode === true;
  const darkBgHex = safeHex(scene.background, DARK_MODE_BG);
  const lightBgHex = safeHex(scene.lightModeBackground, LIGHT_MODE_BG);
  const backgroundHex = lightMode ? lightBgHex : darkBgHex;
  const fogHex = safeHex(
    lightMode
      ? (scene.fog?.lightModeColor ?? lightBgHex)
      : (scene.fog?.color ?? darkBgHex),
    backgroundHex,
  );
  const fogEnabled = scene.fog?.enabled !== false;
  const authoredDensity = finiteDensity(scene.fog?.density);
  return {
    backgroundHex,
    fogHex,
    fogDensity: fogEnabled ? authoredDensity : 0,
    fogEnabled,
  };
}

export function createEnvironmentSceneTransition({
  sourcePageId,
  targetPageId,
  sourceScene,
  targetScene,
  durationMs,
  easing,
  startMs,
}: {
  sourcePageId: string;
  targetPageId: string;
  sourceScene: SceneProperties;
  targetScene: SceneProperties;
  durationMs: number;
  easing: EasingName;
  startMs: number;
}): EnvironmentSceneTransitionRuntime {
  return {
    sourcePageId,
    targetPageId,
    sourceState: resolveBackgroundFogState(sourceScene),
    targetState: resolveBackgroundFogState(targetScene),
    startMs,
    durationMs: Math.max(0, durationMs),
    easing,
  };
}

export function blendEnvironmentSceneTransitionFrame(
  transition: EnvironmentSceneTransitionRuntime,
  nowMs: number,
): EnvironmentSceneTransitionFrame {
  const { progress, done } = transitionProgress(transition, nowMs);
  const source = transition.sourceState;
  const target = transition.targetState;
  return {
    backgroundHex: blendHexColor(
      source.backgroundHex,
      target.backgroundHex,
      progress,
    ),
    fogHex: blendHexColor(source.fogHex, target.fogHex, progress),
    fogDensity: lerp(source.fogDensity, target.fogDensity, progress),
    fogEnabled: !done
      ? source.fogEnabled || target.fogEnabled
      : target.fogEnabled,
    progress,
    done,
  };
}

export function syntheticSceneForEnvironmentFrame(
  frame: EnvironmentSceneTransitionFrame,
): SceneProperties {
  return {
    background: frame.backgroundHex,
    lightMode: false,
    lightModeBackground: frame.backgroundHex,
    fog: {
      enabled: frame.fogEnabled,
      color: frame.fogHex,
      lightModeColor: frame.fogHex,
      density: frame.fogDensity,
    },
  };
}
