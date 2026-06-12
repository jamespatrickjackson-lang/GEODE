import * as THREE from "three";
import type { EnvironmentSetup, PresentationPage, SceneOverlayDef } from "../../pages/types";
import { effectiveSceneOverlays } from "../../pages/effective";
import {
  OUTLINE_VISIBLE_ALPHA,
  disposeSceneOverlay,
  fadeSceneOverlayTo,
  loadSingleSceneOverlay,
  rebuildSceneOverlayGeometry,
  setSceneOverlayTint,
  tickSceneOverlayTweens,
  type SceneOverlayHandle,
} from "../../loaders/loadSceneOverlays";
import { debugLog } from "../../utils/debugLog";
import { getHeightSampler } from "../heightSampler";

export const SCENE_OVERLAY_FADE_MS = 800;
const SCENE_OVERLAY_END_CLAMP_MIN_MS = 150;

/**
 * Page-transition clock for overlay fades (review finding 5.1). When
 * provided, overlay fades ride the transition's duration instead of the
 * fixed 800ms editor fade, so overlays settle when the camera lands.
 */
export interface SceneOverlayTransitionClock {
  durationMs: number;
  startMs?: number;
}

type SceneOverlayApplyPhase =
  | "page"
  | "transition-start"
  | "transition-end";

interface SceneOverlayApplyDebug {
  phase: SceneOverlayApplyPhase;
  pageId: string;
  resolvedCount: number;
  appliedAtMs: number;
}

export interface SceneOverlayDebugState {
  policy: "fixed-duration-linear-fade" | "transition-clock-linear-fade";
  fadeDurationMs: number;
  lastTransitionClockDurationMs: number | null;
  registeredHandleCount: number;
  activeTweenCount: number;
  activeOutlineTweenCount: number;
  visibleHandleCount: number;
  lastPhase: SceneOverlayApplyPhase | null;
  lastPageId: string | null;
  lastResolvedCount: number;
  handles: Array<{
    id: string;
    opacity: number;
    targetOpacity: number;
    tweenActive: boolean;
    outlineOpacity: number;
    outlineTargetOpacity: number;
    outlineTweenActive: boolean;
  }>;
}

export class SceneOverlaysController {
  private sceneOverlays = new Map<string, SceneOverlayHandle>();
  private sceneOverlayGroup: THREE.Group | null = null;
  private lastOverlayPage: PresentationPage | null = null;
  private lastOverlayEnv: EnvironmentSetup | null = null;
  private overlayResolveAssetPath: (rel: string) => string = (p) => "/" + p;
  private overlayMaxAnisotropy = 1;
  private hoveredOverlayId: string | null = null;
  private lastApplyDebug: SceneOverlayApplyDebug | null = null;
  private lastTransitionClockDurationMs: number | null = null;

  constructor(private readonly scene: THREE.Scene) {}

  resolveAssetPath(path: string): string {
    return this.overlayResolveAssetPath(path);
  }

  getMaxAnisotropy(): number {
    return this.overlayMaxAnisotropy;
  }

  tick(nowMs: number): void {
    if (this.sceneOverlays.size > 0) {
      tickSceneOverlayTweens(this.sceneOverlays.values(), nowMs);
    }
  }

  notifyResize(width: number, height: number): void {
    for (const handle of this.sceneOverlays.values()) {
      handle.outlineMaterial.resolution.set(width, height);
    }
  }

  registerSceneOverlays(handles: Map<string, SceneOverlayHandle>): void {
  this.ensureSceneOverlayGroup();
  for (const handle of handles.values()) {
    this.sceneOverlays.set(handle.id, handle);
    this.sceneOverlayGroup!.add(handle.mesh);
    this.sceneOverlayGroup!.add(handle.outlineMesh);
  }
  // Replay any apply that landed before the loader resolved. Without
  // this, freshly-registered handles stay at their construction-time
  // opacity 0 because PageController's mount-time apply found an
  // empty registry and silently no-op'd.
  if (this.lastOverlayEnv && this.lastOverlayPage) {
    this.applySceneOverlaysForPage(this.lastOverlayEnv, this.lastOverlayPage);
  }
}

  private ensureSceneOverlayGroup(): void {
  if (this.sceneOverlayGroup) return;
  this.sceneOverlayGroup = new THREE.Group();
  this.sceneOverlayGroup.name = "__scene_overlays__";
  this.scene.add(this.sceneOverlayGroup);
}

  setSceneOverlayLoaderHooks(opts: {
  resolveAssetPath: (rel: string) => string;
  maxAnisotropy: number;
}): void {
  this.overlayResolveAssetPath = opts.resolveAssetPath;
  this.overlayMaxAnisotropy = opts.maxAnisotropy;
}

  async addSceneOverlay(id: string, def: SceneOverlayDef): Promise<void> {
  if (this.sceneOverlays.has(id)) {
    console.warn(`[SceneManager] addSceneOverlay: ${id} already exists`);
    return;
  }
  const handle = await loadSingleSceneOverlay(
    id,
    def,
    this.overlayResolveAssetPath,
    this.overlayMaxAnisotropy,
  );
  if (!handle) return;
  this.ensureSceneOverlayGroup();
  this.sceneOverlays.set(id, handle);
  this.sceneOverlayGroup!.add(handle.mesh);
  this.sceneOverlayGroup!.add(handle.outlineMesh);
  if (this.lastOverlayEnv && this.lastOverlayPage) {
    this.applySceneOverlaysForPage(this.lastOverlayEnv, this.lastOverlayPage);
  }
}

removeSceneOverlay(id: string): void {
  const handle = this.sceneOverlays.get(id);
  if (!handle) return;
  if (this.hoveredOverlayId === id) this.hoveredOverlayId = null;
  handle.mesh.parent?.remove(handle.mesh);
  handle.outlineMesh.parent?.remove(handle.outlineMesh);
  disposeSceneOverlay(handle);
  this.sceneOverlays.delete(id);
}

async rebuildSceneOverlayBounds(
  id: string,
  newBounds: SceneOverlayDef["bounds"],
): Promise<void> {
  const handle = this.sceneOverlays.get(id);
  if (!handle) return;
  const sample = await getHeightSampler();
  rebuildSceneOverlayGeometry(handle, newBounds, sample);
}

getSceneOverlay(id: string): SceneOverlayHandle | undefined {
  return this.sceneOverlays.get(id);
}

setHoveredSceneOverlay(id: string | null): void {
  if (id === this.hoveredOverlayId) return;
  const prev = this.hoveredOverlayId
    ? this.sceneOverlays.get(this.hoveredOverlayId)
    : null;
  if (prev && !prev.outlineTween) {
    prev.outlineMaterial.opacity = prev.outlineTarget;
  }
  this.hoveredOverlayId = id;
  if (id) {
    const handle = this.sceneOverlays.get(id);
    if (handle && handle.outlineTarget > 0) {
      handle.outlineMaterial.opacity = Math.min(
        1,
        handle.outlineTarget + 0.3,
      );
    }
  }
}

listSceneOverlays(): SceneOverlayHandle[] {
  return Array.from(this.sceneOverlays.values());
}

getDebugState(): SceneOverlayDebugState {
  const handles = Array.from(this.sceneOverlays.values()).map((handle) => ({
    id: handle.id,
    opacity: handle.material.opacity,
    targetOpacity: handle.target,
    tweenActive: handle.tween !== null,
    outlineOpacity: handle.outlineMaterial.opacity,
    outlineTargetOpacity: handle.outlineTarget,
    outlineTweenActive: handle.outlineTween !== null,
  }));
  return {
    policy:
      this.lastTransitionClockDurationMs !== null
        ? "transition-clock-linear-fade"
        : "fixed-duration-linear-fade",
    fadeDurationMs: SCENE_OVERLAY_FADE_MS,
    lastTransitionClockDurationMs: this.lastTransitionClockDurationMs,
    registeredHandleCount: handles.length,
    activeTweenCount: handles.filter((handle) => handle.tweenActive).length,
    activeOutlineTweenCount: handles.filter((handle) => handle.outlineTweenActive)
      .length,
    visibleHandleCount: handles.filter((handle) => handle.targetOpacity > 0)
      .length,
    lastPhase: this.lastApplyDebug?.phase ?? null,
    lastPageId: this.lastApplyDebug?.pageId ?? null,
    lastResolvedCount: this.lastApplyDebug?.resolvedCount ?? 0,
    handles,
  };
}

applySceneOverlaysForPage(
  environment: EnvironmentSetup,
  page: PresentationPage,
): void {
  // Cache BEFORE the early-return so a mount-time apply that lands
  // before the loader resolves still gets replayed once handles
  // register. Without this, the race in the original Week 5 wiring
  // left overlays stuck at opacity 0.
  this.lastOverlayEnv = environment;
  this.lastOverlayPage = page;
  const resolved = effectiveSceneOverlays(environment, page);
  this.lastApplyDebug = {
    phase: "page",
    pageId: page.id,
    resolvedCount: resolved.length,
    appliedAtMs: performance.now(),
  };
  if (this.sceneOverlays.size === 0) {
    debugLog(
      `[applySceneOverlaysForPage:${page.id}] no handles registered yet, caching for later replay`,
    );
    return;
  }
  debugLog(
    `[applySceneOverlaysForPage:${page.id}] resolved:`,
    resolved.map((r) => ({
      id: r.id,
      visible: r.visible,
      opacity: r.opacity,
      tint: r.tint,
      enabled: r.def.enabled,
    })),
  );
  const now = performance.now();
  for (const r of resolved) {
    const handle = this.sceneOverlays.get(r.id);
    if (!handle) continue;
    setSceneOverlayTint(handle, r.tint);
    fadeSceneOverlayTo(handle, r.opacity, now, SCENE_OVERLAY_FADE_MS);
  }
}

private applySceneOverlayOpacityNow(
  handle: SceneOverlayHandle,
  opacity: number,
): void {
  handle.tween = null;
  handle.target = opacity;
  handle.material.opacity = opacity;
  handle.mesh.visible = opacity > 0.001;
  const outlineTo = opacity > 0 ? OUTLINE_VISIBLE_ALPHA : 0;
  handle.outlineTween = null;
  handle.outlineTarget = outlineTo;
  handle.outlineMaterial.opacity = outlineTo;
  handle.outlineMesh.visible = outlineTo > 0.001;
}

applySceneOverlaysAtTransitionStart(
  environment: EnvironmentSetup,
  nextPage: PresentationPage,
  clock?: SceneOverlayTransitionClock,
): void {
  // Cache the target page so a registration during the tween replays
  // the correct end-state instead of the previous page's.
  this.lastOverlayEnv = environment;
  this.lastOverlayPage = nextPage;
  const resolved = effectiveSceneOverlays(environment, nextPage);
  const now = performance.now();
  this.lastApplyDebug = {
    phase: "transition-start",
    pageId: nextPage.id,
    resolvedCount: resolved.length,
    appliedAtMs: now,
  };
  this.lastTransitionClockDurationMs = clock ? clock.durationMs : null;
  if (this.sceneOverlays.size === 0) return;
  // Both decreases and increases ride the page-transition clock so
  // overlays settle when the camera lands instead of running a second
  // 800ms wave after commit (finding 5.1).
  const durationMs = clock ? clock.durationMs : SCENE_OVERLAY_FADE_MS;
  for (const r of resolved) {
    const handle = this.sceneOverlays.get(r.id);
    if (!handle) continue;
    if (durationMs <= 0) {
      setSceneOverlayTint(handle, r.tint);
      this.applySceneOverlayOpacityNow(handle, r.opacity);
      continue;
    }
    fadeSceneOverlayTo(handle, r.opacity, clock?.startMs ?? now, durationMs);
  }
}

applySceneOverlaysAtTransitionEnd(
  environment: EnvironmentSetup,
  nextPage: PresentationPage,
  clock?: SceneOverlayTransitionClock,
): void {
  this.lastOverlayEnv = environment;
  this.lastOverlayPage = nextPage;
  const resolved = effectiveSceneOverlays(environment, nextPage);
  const now = performance.now();
  this.lastApplyDebug = {
    phase: "transition-end",
    pageId: nextPage.id,
    resolvedCount: resolved.length,
    appliedAtMs: now,
  };
  if (this.sceneOverlays.size === 0) return;
  // The end phase is a clamp, not a second fade: handles still off
  // target (registration raced the tween, or an editor change landed
  // mid-transition) finish over the remaining transition time, floored
  // so the catch-up never degenerates into a one-frame pop.
  const remainingMs = clock
    ? Math.max(
        (clock.startMs ?? now) + clock.durationMs - now,
        clock.durationMs <= 0 ? 0 : SCENE_OVERLAY_END_CLAMP_MIN_MS,
      )
    : SCENE_OVERLAY_END_CLAMP_MIN_MS;
  for (const r of resolved) {
    const handle = this.sceneOverlays.get(r.id);
    if (!handle) continue;
    // Tint is direct (no tween) so apply unconditionally.
    setSceneOverlayTint(handle, r.tint);
    if (r.opacity === handle.target && !handle.tween) continue;
    if (remainingMs <= 0) {
      this.applySceneOverlayOpacityNow(handle, r.opacity);
      continue;
    }
    fadeSceneOverlayTo(handle, r.opacity, now, remainingMs);
  }
}
}
