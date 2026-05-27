import type { EasingName, EnvironmentSetup, PresentationPage } from "../../pages/types";
import { effectiveStyle, effectiveVisibility } from "../../pages/effective";
import { CASE_STUDY_B_DEMO_LAYER_ALIASES } from "../../projectModules/caseStudyB/demoLayerAliases";
import { UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID, UTAH_FORGE_SCENE_SECTION_LAYER_ID } from "../../projectModules/utahForge/layerIds";
import {
  SCENE_SECTION_AFFECTED_LAYER_IDS,
  forgeDiscreteDataStyleChanged,
  scalarTransitionStyleChanged,
  sceneSectionDiscreteStyleChanged,
  sceneSectionTransitionStyleChanged,
  type LayerTransitionKind,
  type NavigationReason,
} from "./transitionStyles";

const DEFAULT_LAYER_FADE_MS = 800;

export function transitionEffectiveLayersForPage(this: any, 
  environment: EnvironmentSetup,
  fromPage: PresentationPage,
  toPage: PresentationPage,
  durationMs: number = DEFAULT_LAYER_FADE_MS,
  easing: EasingName = "easeInOutCubic",
  scalarStyleDurationMs: number = durationMs,
  scalarStyleEasing: EasingName = easing,
  reason: NavigationReason = "programmatic",
): void {
  const layerIds = new Set<string>([
    ...this.layers.keys(),
    ...Object.keys(CASE_STUDY_B_DEMO_LAYER_ALIASES),
  ]);
  const sourceLayers = this.captureLayerRenderStates(
    environment,
    fromPage,
    layerIds,
  );
  this.layerTweens.clear();
  this.scalarStyleTweens.clear();
  this.workingAreaFocusTween = null;
  this.sceneSectionStyleTween = null;
  this.sceneSectionHelperTransitionOpacity = 1;
  this.clearLayerTransitionSnapshots();
  this.lastEffectiveEnv = environment;
  this.lastEffectivePage = toPage;

  const toVisible = effectiveVisibility(environment, toPage);
  this.currentVisibleLayerIds = toVisible;
  const sourceVisibleLayerIds = new Set<string>();
  for (const [id, state] of sourceLayers) {
    if (state.visible && state.opacity > 0.001) {
      sourceVisibleLayerIds.add(id);
    }
  }
  const now = performance.now();
  const duration = Math.max(0, durationMs);
  const terrainOverrides = new Map<string, number>();
  const layerKinds: Record<string, LayerTransitionKind> = {};
  this.activeSceneTransitionContext = {
    sourcePageId: fromPage.id,
    targetPageId: toPage.id,
    reason,
    startMs: now,
    durationMs: duration,
    easing,
    layerKinds,
    sourceLayers,
    sourceVisibleLayerIds,
    targetVisibleLayerIds: new Set(toVisible),
    warnedUnexpectedVisibleLayerIds: new Set(),
  };

  const fromSceneSectionStyle = effectiveStyle(
    environment,
    fromPage,
    UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  );
  const targetSceneSectionStyle = effectiveStyle(
    environment,
    toPage,
    UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  );
  const sceneSectionStyleChanged = sceneSectionTransitionStyleChanged(
    fromSceneSectionStyle,
    targetSceneSectionStyle,
  );
  const sceneSectionDiscreteChanged =
    sceneSectionStyleChanged &&
    sceneSectionDiscreteStyleChanged(
      fromSceneSectionStyle,
      targetSceneSectionStyle,
    );
  if (sceneSectionStyleChanged && duration > 0) {
    this.sceneSectionStyleTween = {
      fromStyle: fromSceneSectionStyle,
      toStyle: targetSceneSectionStyle,
      startMs: now,
      durationMs: duration,
      easing,
      discreteChanged: sceneSectionDiscreteChanged,
    };
    this.sceneSectionHelperTransitionOpacity =
      this.sceneSectionHelperOpacityForTween(this.sceneSectionStyleTween, 0);
  }

  this.sceneSectionReapplySuspended = true;
  try {
    for (const id of layerIds) {
      const sourceState = sourceLayers.get(id);
      const fromOpacity = sourceState?.opacity ?? 0;
      const toOpacity = toVisible.has(id)
        ? this.targetOpacityForLayer(environment, toPage, id)
        : 0;
      const fromStyle =
        sourceState?.style ?? effectiveStyle(environment, fromPage, id);
      const targetStyle = effectiveStyle(environment, toPage, id);
      const group = this.layers.get(id);
      if (group) group.visible = fromOpacity > 0.001 || toOpacity > 0.001;
      const shouldCrossfadeDiscreteData =
        !!group &&
        duration > 0 &&
        fromOpacity > 0.001 &&
        forgeDiscreteDataStyleChanged(
          id,
          fromStyle,
          targetStyle,
          this.layerSpecFor(id),
        );
      const shouldCrossfadeSceneSection =
        !!group &&
        duration > 0 &&
        sceneSectionDiscreteChanged &&
        fromOpacity > 0.001 &&
        SCENE_SECTION_AFFECTED_LAYER_IDS.has(id);
      const shouldTweenScalarStyle =
        !!group &&
        !shouldCrossfadeDiscreteData &&
        !shouldCrossfadeSceneSection &&
        scalarStyleDurationMs > 0 &&
        fromOpacity > 0.001 &&
        toOpacity > 0.001 &&
        this.layerSupportsScalarStyleTween(id, group) &&
        scalarTransitionStyleChanged(fromStyle, targetStyle);
      const shouldCrossfadeScalarStyle =
        !!group &&
        duration > 0 &&
        fromOpacity > 0.001 &&
        this.layerHasScalarPreviewData(group) &&
        !toVisible.has(id);
      const transitionSnapshot =
        shouldCrossfadeDiscreteData ||
        shouldCrossfadeScalarStyle ||
        shouldCrossfadeSceneSection
          ? this.cloneLayerTransitionSnapshot(id, group)
          : null;
      const transitionKind: LayerTransitionKind =
        shouldCrossfadeDiscreteData ||
        shouldCrossfadeScalarStyle ||
        shouldCrossfadeSceneSection
          ? "discrete-crossfade"
          : shouldTweenScalarStyle
            ? id === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID
              ? "full-density-scalar"
              : "continuous"
            : "none";
      layerKinds[id] = transitionKind;

      // Apply target page colour/provenance-style immediately, but restore the
      // visual opacity to the old page value before the fade begins.
      this.applyStyle(id, shouldTweenScalarStyle ? fromStyle : targetStyle);
      if (shouldTweenScalarStyle) {
        this.scalarStyleTweens.set(id, {
          id,
          from: 0,
          to: 1,
          fromStyle,
          toStyle: targetStyle,
          startMs: now,
          durationMs: Math.max(0, scalarStyleDurationMs),
          easing: scalarStyleEasing,
        });
      }
      if (transitionSnapshot) {
        this.applyRenderOpacityToTree(transitionSnapshot, fromOpacity);
        this.applyLayerRenderOpacity(id, 0);
        this.layerTweens.set(id, {
          from: 0,
          to: toOpacity,
          startMs: now,
          durationMs: duration,
          easing,
        });
        this.layerTransitionSnapshots.set(id, {
          id,
          group: transitionSnapshot,
          from: fromOpacity,
          to: 0,
          style: fromStyle,
          startMs: now,
          durationMs: duration,
          easing,
        });
        terrainOverrides.set(id, 0);
        continue;
      }
      this.applyLayerRenderOpacity(id, fromOpacity);
      terrainOverrides.set(id, fromOpacity);

      if (duration <= 0 || Math.abs(fromOpacity - toOpacity) < 0.001) {
        this.applyLayerRenderOpacity(id, toOpacity);
        terrainOverrides.set(id, toOpacity);
        continue;
      }

      this.layerTweens.set(id, {
        from: fromOpacity,
        to: toOpacity,
        startMs: now,
        durationMs: duration,
        easing,
      });
    }
  } finally {
    this.sceneSectionReapplySuspended = false;
  }
  this.reapplySceneSectionPlanes();

  this.transitionWorkingAreaFocusForPage(
    environment,
    fromPage,
    toPage,
    duration,
    easing,
  );

  // Terrain-composite layers (lakes, targets, claims, geology, forest cover)
  // render part of their visual fill through terrain uniforms, not just group
  // materials.
  // This call sets their target colours while preserving old-page opacities;
  // frameUpdate then fades the same uniforms alongside regular materials.
  this.applyLakesToTerrain(environment, toPage, terrainOverrides);
}
