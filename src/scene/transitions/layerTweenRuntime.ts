import type { EditableStyle } from "../../pages/types";
import { clamp01 } from "../styles/styleUtils";
import {
  SCALAR_TRANSITION_STYLE_FIELDS,
  easeProgress,
  scalarStyleNumber,
} from "./transitionStyles";

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
      transition.targetVisibleLayerIds.has(id) ||
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
          this.applyLayerRenderOpacity(
            id,
            this.transitionFrameOpacityForLayer(id),
          );
        }
        continue;
      }
      if (group.visible) this.warnUnexpectedTransitionLayer(id);
      this.applyLayerRenderOpacity(id, 0);
    }
  }

export function tickLayerTweensImpl(this: any, nowMs: number): void {
    if (
      this.layerTweens.size === 0 &&
      this.scalarStyleTweens.size === 0 &&
      this.layerTransitionSnapshots.size === 0 &&
      !this.sceneSectionStyleTween &&
      !this.sceneSectionHelperTransitionSnapshot &&
      !this.workingAreaFocusTween &&
      !this.activeSceneTransitionContext
    ) {
      return;
    }
    if (this.sceneSectionStyleTween) {
      const tween = this.sceneSectionStyleTween;
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      const style = done
        ? tween.toStyle
        : tween.discreteChanged
          ? tween.toStyle
          : this.interpolatedSceneSectionStyle(
              tween.fromStyle,
              tween.toStyle,
              eased,
            );
      this.sceneSectionHelperTransitionOpacity = done
        ? 1
        : this.sceneSectionHelperOpacityForTween(tween, eased);
      this.applySceneSectionPlanes(style);
      if (done) {
        this.sceneSectionStyleTween = null;
        this.sceneSectionHelperTransitionOpacity = 1;
      }
    }
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
    for (const [id, tween] of this.layerTweens) {
      const t =
        tween.durationMs <= 0 ? 1 : (nowMs - tween.startMs) / tween.durationMs;
      const done = t >= 1;
      const eased = done ? 1 : easeProgress(t, tween.easing);
      const opacity = tween.from + (tween.to - tween.from) * eased;
      this.applyLayerRenderOpacity(id, done ? tween.to : opacity);
      if (done) this.layerTweens.delete(id);
    }
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
      );
      if (done) this.removeLayerTransitionSnapshot(id);
    }
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
    this.enforceTransitionVisibilityEnvelope();
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
      if (transitionDone) {
        this.activeSceneTransitionContext = null;
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
