import type { EditableStyle } from "../../pages/types";
import { clamp01 } from "../styles/styleUtils";
import {
  SCALAR_TRANSITION_STYLE_FIELDS,
  easeProgress,
  scalarStyleNumber,
} from "./transitionStyles";

function transitionDebugMs(value: number): number {
  return Number(Math.max(0, value).toFixed(3));
}

function transitionEnvelopeOpacity(
  from: number,
  to: number,
  current: number,
): number {
  const sourceVisible = from > 0.001;
  const targetVisible = to > 0.001;
  if (sourceVisible && targetVisible) return 1;
  if (sourceVisible) return clamp01(current / Math.max(0.001, from));
  if (targetVisible) return clamp01(current / Math.max(0.001, to));
  return 0;
}

function transitionEnvelopeForLayerFrame(
  this: any,
  id: string,
  current: number,
): number {
  const transition = this.activeSceneTransitionContext;
  if (!transition) return current > 0.001 ? 1 : 0;
  if (transition.sectionIsoStableLayerIds?.has(id)) return 1;
  const from = transition.sourceLayers.get(id)?.opacity ?? 0;
  const to =
    transition.targetVisibleLayerIds.has(id) &&
    !transition.targetNotReadyLayerIds?.has(id) &&
    this.lastEffectiveEnv &&
    this.lastEffectivePage
      ? this.targetOpacityForLayer(
          this.lastEffectiveEnv,
          this.lastEffectivePage,
          id,
        )
      : 0;
  return transitionEnvelopeOpacity(from, to, current);
}

export function warnUnexpectedTransitionLayerImpl(this: any, id: string): void {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return;
    if (transition.warnedUnexpectedVisibleLayerIds.has(id)) return;
    transition.warnedUnexpectedVisibleLayerIds.add(id);
    console.warn(
      `[SceneManager] layer "${id}" became visible outside the page-transition envelope`,
      {
        sourcePageId: transition.sourcePageId,
        targetPageId: transition.targetPageId,
        reason: transition.reason,
      },
    );
  }

export function transitionEnvelopeAllowsLayerImpl(this: any, id: string): boolean {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return true;
    return (
      transition.sourceVisibleLayerIds.has(id) ||
      (transition.targetVisibleLayerIds.has(id) &&
        !transition.targetNotReadyLayerIds?.has(id)) ||
      this.layerTransitionSnapshots.has(id)
    );
  }

export function transitionFrameOpacityForLayerImpl(this: any, id: string): number {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return 0;
    const elapsed =
      transition.durationMs <= 0
        ? 1
        : (performance.now() - transition.startMs) / transition.durationMs;
    const t = elapsed >= 1 ? 1 : easeProgress(elapsed, transition.easing);
    const from = transition.sourceLayers.get(id)?.opacity ?? 0;
    const to =
      transition.targetVisibleLayerIds.has(id) &&
      !transition.targetNotReadyLayerIds?.has(id) &&
      this.lastEffectiveEnv &&
      this.lastEffectivePage
        ? this.targetOpacityForLayer(
            this.lastEffectiveEnv,
            this.lastEffectivePage,
            id,
          )
        : 0;
    return from + (to - from) * clamp01(t);
  }

export function enforceTransitionVisibilityEnvelopeImpl(this: any): void {
    const transition = this.activeSceneTransitionContext;
    if (!transition) return;
    for (const [id, group] of this.layers) {
      if (this.transitionEnvelopeAllowsLayer(id)) {
        if (
          !this.layerTweens.has(id) &&
          !this.layerTransitionSnapshots.has(id)
        ) {
          const opacity = this.transitionFrameOpacityForLayer(id);
          this.applyLayerTransitionRenderOpacity(
            id,
            opacity,
            transitionEnvelopeForLayerFrame.call(this, id, opacity),
          );
        }
        continue;
      }
      if (group.visible) this.warnUnexpectedTransitionLayer(id);
      this.applyLayerTransitionRenderOpacity(id, 0, 0);
    }
  }

export function tickLayerTweensImpl(this: any, nowMs: number): void {
    const startedAt = performance.now();
    const layerTweenIdsBefore = Array.from(this.layerTweens.keys());
    const scalarTweenIdsBefore = Array.from(this.scalarStyleTweens.keys());
    const snapshotIdsBefore = Array.from(this.layerTransitionSnapshots.keys());
    const sceneSectionStyleTweenActiveBefore = !!this.sceneSectionStyleTween;
    const helperSnapshotActiveBefore =
      !!this.sceneSectionHelperTransitionSnapshot;
    const workingAreaFocusTweenActiveBefore = !!this.workingAreaFocusTween;
    if (
      this.layerTweens.size === 0 &&
      this.scalarStyleTweens.size === 0 &&
      this.layerTransitionSnapshots.size === 0 &&
      !this.sceneSectionStyleTween &&
      !this.sceneSectionHelperTransitionSnapshot &&
      !this.workingAreaFocusTween &&
      !this.sectionIsoOverlayTransition &&
      !this.activeSceneTransitionContext
    ) {
      this.lastLayerTweenTickDebug = {
        timestampMs: transitionDebugMs(nowMs),
        totalMs: transitionDebugMs(performance.now() - startedAt),
        sceneSectionMs: 0,
        sceneSectionApply: null,
        workingAreaMs: 0,
        scalarMs: 0,
        layerMs: 0,
        snapshotMs: 0,
        helperSnapshotMs: 0,
        envelopeMs: 0,
        activeSceneTransition: false,
        sceneSectionApplyMode: "none",
        layerTweenIds: [],
        scalarTweenIds: [],
        snapshotIds: [],
        layerTweenCountBefore: 0,
        scalarTweenCountBefore: 0,
        snapshotCountBefore: 0,
        sceneSectionStyleTweenActiveBefore: false,
        helperSnapshotActiveBefore: false,
        workingAreaFocusTweenActiveBefore: false,
      };
      return;
    }
    let stageStart = performance.now();
    let sceneSectionApplyMode:
      | "none"
      | "full"
      | "transition-frame"
      | "helper-opacity-only" = "none";
    let sceneSectionApplyDebug = null;
    if (this.sceneSectionStyleTween) {
      const tween = this.sceneSectionStyleTween;
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      // Dual-mask handles the discrete clip difference through blended mask
      // alpha, but compatible numeric channels (same-id plane positions,
      // frame bounds) must still MOVE per DEC-071/DEC-164. sceneSectionTweenStyle
      // interpolates the geometry and holds a moving frame's flip on the source
      // side during the glide (applying the target flip at commit), so the base
      // clip for non-shader/bounds materials matches the dual-mask path.
      const style = done
        ? tween.toStyle
        : this.sceneSectionTweenStyle(tween, eased);
      const maskTransition =
        !done && tween.maskMode === "dual-mask"
          ? this.sceneSectionMaskTransitionForTween(tween, eased)
          : null;
      this.sceneSectionHelperTransitionOpacity = done
        ? 1
        : this.sceneSectionHelperOpacityForTween(tween, eased);
      if (!done) {
        this.tickSectionIsoOverlayTransition(nowMs, eased);
        this.applySceneSectionPlanes(style, {
          transitionFrame: true,
          maskTransition,
        });
        sceneSectionApplyDebug = this.lastSceneSectionApplyDebug ?? null;
        sceneSectionApplyMode = "transition-frame";
        if (tween.discreteChanged) tween.appliedDiscreteTarget = true;
      } else {
        // Let the Section ISO crossfade land on its own clock; forcing
        // eased = 1 here snaps the roots when the clocks diverge.
        this.tickSectionIsoOverlayTransition(nowMs);
        this.applySceneSectionPlanes(style);
        sceneSectionApplyDebug = this.lastSceneSectionApplyDebug ?? null;
        sceneSectionApplyMode = "full";
      }
      if (done) {
        this.commitSectionIsoOverlayTransition();
        this.sceneSectionStyleTween = null;
        this.sceneSectionHelperTransitionOpacity = 1;
      }
    }
    const sceneSectionMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    if (this.workingAreaFocusTween) {
      const tween = this.workingAreaFocusTween;
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      this.applyWorkingAreaFocusStyle(
        done
          ? tween.toStyle
          : this.interpolatedWorkingAreaFocusStyle(
              tween.fromStyle,
              tween.toStyle,
              eased,
            ),
      );
      if (done) this.workingAreaFocusTween = null;
    }
    const workingAreaMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    for (const [id, tween] of this.scalarStyleTweens) {
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      const style = done
        ? tween.toStyle
        : this.interpolatedScalarStyle(tween.fromStyle, tween.toStyle, eased);
      this.applyStyle(id, style);
      if (done) this.scalarStyleTweens.delete(id);
    }
    const scalarMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    for (const [id, tween] of this.layerTweens) {
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      const opacity = tween.from + (tween.to - tween.from) * eased;
      const nextOpacity = done ? tween.to : opacity;
      this.applyLayerTransitionRenderOpacity(
        id,
        nextOpacity,
        transitionEnvelopeForLayerFrame.call(this, id, nextOpacity),
      );
      if (done) this.layerTweens.delete(id);
    }
    const layerMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    for (const [id, snapshot] of this.layerTransitionSnapshots) {
      const t =
        snapshot.durationMs <= 0
          ? 1
          : (nowMs - snapshot.startMs) / snapshot.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, snapshot.easing);
      const opacity = snapshot.from + (snapshot.to - snapshot.from) * eased;
      this.applyRenderOpacityToTree(
        snapshot.group,
        done ? snapshot.to : opacity,
        transitionEnvelopeOpacity(
          snapshot.from,
          snapshot.to,
          done ? snapshot.to : opacity,
        ),
      );
      if (done) this.removeLayerTransitionSnapshot(id);
    }
    const snapshotMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    if (this.sceneSectionHelperTransitionSnapshot) {
      const snapshot = this.sceneSectionHelperTransitionSnapshot;
      const t =
        snapshot.durationMs <= 0
          ? 1
          : (nowMs - snapshot.startMs) / snapshot.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, snapshot.easing);
      const opacity = snapshot.from + (snapshot.to - snapshot.from) * eased;
      this.applyRenderOpacityToTree(
        snapshot.group,
        done ? snapshot.to : opacity,
      );
      if (done) this.removeSceneSectionHelperTransitionSnapshot();
    }
    const helperSnapshotMs = transitionDebugMs(performance.now() - stageStart);
    stageStart = performance.now();

    this.enforceTransitionVisibilityEnvelope();
    this.tickSectionIsoOverlayTransition(nowMs);
    const envelopeMs = transitionDebugMs(performance.now() - stageStart);

    this.lastLayerTweenTickDebug = {
      timestampMs: transitionDebugMs(nowMs),
      totalMs: transitionDebugMs(performance.now() - startedAt),
      sceneSectionMs,
      sceneSectionApply: sceneSectionApplyDebug,
      workingAreaMs,
      scalarMs,
      layerMs,
      snapshotMs,
      helperSnapshotMs,
      envelopeMs,
      activeSceneTransition: this.activeSceneTransitionContext !== null,
      sceneSectionApplyMode,
      layerTweenIds: layerTweenIdsBefore.slice(0, 16),
      scalarTweenIds: scalarTweenIdsBefore.slice(0, 16),
      snapshotIds: snapshotIdsBefore.slice(0, 16),
      layerTweenCountBefore: layerTweenIdsBefore.length,
      scalarTweenCountBefore: scalarTweenIdsBefore.length,
      snapshotCountBefore: snapshotIdsBefore.length,
      sceneSectionStyleTweenActiveBefore,
      helperSnapshotActiveBefore,
      workingAreaFocusTweenActiveBefore,
    };

    if (
      this.layerTweens.size === 0 &&
      this.scalarStyleTweens.size === 0 &&
      this.layerTransitionSnapshots.size === 0 &&
      !this.sceneSectionStyleTween &&
      !this.sceneSectionHelperTransitionSnapshot &&
      !this.workingAreaFocusTween
    ) {
      const transition = this.activeSceneTransitionContext;
      const transitionDone =
        !transition ||
        transition.durationMs <= 0 ||
        performance.now() - transition.startMs >= transition.durationMs;
      // Section ISO root crossfades land on their own clock; committing
      // before they finish snaps the roots to full opacity in one frame.
      const isoTransition = this.sectionIsoOverlayTransition;
      const isoTransitionDone =
        !isoTransition ||
        isoTransition.durationMs <= 0 ||
        performance.now() - isoTransition.startMs >= isoTransition.durationMs;
      if (transitionDone && isoTransitionDone) {
        this.commitSectionIsoOverlayTransition?.();
        this.recordTransitionCommitAttempt?.({
          phase: "tween-completion",
          attemptedBy: "layerTweenRuntime.tickLayerTweens",
        });
        if (!transition || transition.commitState?.hasFinalized) {
          this.activeSceneTransitionContext = null;
        }
      }
    }
  }

export function interpolatedScalarStyleImpl(this: any, fromStyle: EditableStyle, toStyle: EditableStyle, amount: number): EditableStyle {
    const t = clamp01(amount);
    const next: EditableStyle = { ...toStyle };
    if (
      typeof fromStyle.opacity === "number" &&
      Number.isFinite(fromStyle.opacity) &&
      typeof toStyle.opacity === "number" &&
      Number.isFinite(toStyle.opacity)
    ) {
      next.opacity = fromStyle.opacity + (toStyle.opacity - fromStyle.opacity) * t;
    }
    if (fromStyle.mtSurfaceBoundariesById && toStyle.mtSurfaceBoundariesById) {
      const nextBoundaries = { ...toStyle.mtSurfaceBoundariesById };
      for (const [id, toBoundary] of Object.entries(toStyle.mtSurfaceBoundariesById)) {
        const fromBoundary = fromStyle.mtSurfaceBoundariesById[id];
        if (
          fromBoundary &&
          typeof fromBoundary.opacity === "number" &&
          Number.isFinite(fromBoundary.opacity) &&
          typeof toBoundary.opacity === "number" &&
          Number.isFinite(toBoundary.opacity)
        ) {
          nextBoundaries[id] = {
            ...toBoundary,
            opacity: fromBoundary.opacity + (toBoundary.opacity - fromBoundary.opacity) * t,
          };
        }
      }
      next.mtSurfaceBoundariesById = nextBoundaries;
    }
    for (const field of SCALAR_TRANSITION_STYLE_FIELDS) {
      const from = scalarStyleNumber(fromStyle, field);
      const to = scalarStyleNumber(toStyle, field);
      if (typeof from !== "number" || typeof to !== "number") continue;
      (next as Record<string, unknown>)[field] = from + (to - from) * t;
    }
    return next;
  }
