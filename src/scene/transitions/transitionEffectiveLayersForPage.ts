import type { EasingName, EnvironmentSetup, PresentationPage } from "../../pages/types";
import { effectiveStyle, effectiveVisibility } from "../../pages/effective";
import { CASE_STUDY_B_DEMO_LAYER_ALIASES } from "../../projectModules/caseStudyB/demoLayerAliases";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import {
  productTransitionDecisionsForLayer,
  sceneSectionHelperDecision,
} from "./productFamilyRegistry";
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

export function transitionEffectiveLayersForPage(
  this: any,
  fromEnvironment: EnvironmentSetup,
  toEnvironment: EnvironmentSetup,
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
  const fromVisible = effectiveVisibility(fromEnvironment, fromPage);
  const toVisible = effectiveVisibility(toEnvironment, toPage);
  const authoredProductLayerIds = new Set<string>();
  for (const record of [
    fromPage.layerOverrides,
    toPage.layerOverrides,
    fromPage.visibilityOverrides,
    toPage.visibilityOverrides,
  ]) {
    for (const id of Object.keys(record ?? {})) {
      authoredProductLayerIds.add(id);
    }
  }
  const productFamilyLayerIds = new Set<string>([
    ...layerIds,
    ...fromVisible,
    ...toVisible,
    ...authoredProductLayerIds,
  ]);
  const sourceLayers = this.captureLayerRenderStates(
    fromEnvironment,
    fromPage,
    layerIds,
  );
  this.layerTweens.clear();
  this.scalarStyleTweens.clear();
  this.workingAreaFocusTween = null;
  this.sceneSectionStyleTween = null;
  this.sceneSectionHelperTransitionOpacity = 1;
  this.clearLayerTransitionSnapshots();
  this.lastEffectiveEnv = toEnvironment;
  this.lastEffectivePage = toPage;

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
    productFamilies: [],
    sourceLayers,
    sourceVisibleLayerIds,
    targetVisibleLayerIds: new Set(toVisible),
    warnedUnexpectedVisibleLayerIds: new Set(),
  };
  const recordedProductLayerIds = new Set<string>();
  const recordProductFamily = (
    id: string,
    fromStyle: ReturnType<typeof effectiveStyle>,
    targetStyle: ReturnType<typeof effectiveStyle>,
    transitionKind: LayerTransitionKind,
    sourceVisible: boolean,
    targetVisible: boolean,
    sourceOpacity: number,
    targetOpacity: number,
    loadedAtStart: boolean,
  ) => {
    recordedProductLayerIds.add(id);
    this.activeSceneTransitionContext.productFamilies.push(
      ...productTransitionDecisionsForLayer({
        layerId: id,
        layerSpec: this.layerSpecFor(id),
        fromStyle,
        toStyle: targetStyle,
        transitionKind,
        sourceVisible,
        targetVisible,
        sourceOpacity,
        targetOpacity,
        loadedAtStart,
        stateSource: loadedAtStart ? "loaded-layer" : "authored-layer",
        includeStateSource: authoredProductLayerIds.has(id),
      }),
    );
  };
  const authoredProductTransitionKind = (
    id: string,
    fromStyle: ReturnType<typeof effectiveStyle>,
    targetStyle: ReturnType<typeof effectiveStyle>,
    sourceVisible: boolean,
    targetVisible: boolean,
  ): LayerTransitionKind => {
    if (
      duration > 0 &&
      forgeDiscreteDataStyleChanged(
        id,
        fromStyle,
        targetStyle,
        this.layerSpecFor(id),
      )
    ) {
      return "discrete-crossfade";
    }
    if (
      duration > 0 &&
      sourceVisible &&
      targetVisible &&
      scalarTransitionStyleChanged(fromStyle, targetStyle)
    ) {
      return id === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID
        ? "full-density-scalar"
        : "continuous";
    }
    return "none";
  };

  const fromSceneSectionStyle = effectiveStyle(
    fromEnvironment,
    fromPage,
    UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  );
  const targetSceneSectionStyle = effectiveStyle(
    toEnvironment,
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
    if (sceneSectionDiscreteChanged) {
      this.beginSceneSectionHelperTransitionSnapshot?.(now, duration, easing);
    }
    this.activeSceneTransitionContext.productFamilies.push(
      sceneSectionHelperDecision({
        layerId: UTAH_FORGE_SCENE_SECTION_LAYER_ID,
        sourceVisible: fromSceneSectionStyle.sceneSectionEnabled === true,
        targetVisible: targetSceneSectionStyle.sceneSectionEnabled === true,
        sourceOpacity: fromSceneSectionStyle.sceneSectionEnabled === true ? 1 : 0,
        targetOpacity:
          targetSceneSectionStyle.sceneSectionEnabled === true ? 1 : 0,
      }),
    );
  }

  this.sceneSectionReapplySuspended = true;
  try {
    for (const id of layerIds) {
      const sourceState = sourceLayers.get(id);
      const fromOpacity = sourceState?.opacity ?? 0;
      const toOpacity = toVisible.has(id)
        ? this.targetOpacityForLayer(toEnvironment, toPage, id)
        : 0;
      const fromStyle =
        sourceState?.style ?? effectiveStyle(fromEnvironment, fromPage, id);
      const targetStyle = effectiveStyle(toEnvironment, toPage, id);
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
      recordProductFamily(
        id,
        fromStyle,
        targetStyle,
        transitionKind,
        fromOpacity > 0.001,
        toOpacity > 0.001,
        fromOpacity,
        toOpacity,
        !!group,
      );

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
    for (const id of productFamilyLayerIds) {
      if (recordedProductLayerIds.has(id)) continue;
      const fromStyle = effectiveStyle(fromEnvironment, fromPage, id);
      const targetStyle = effectiveStyle(toEnvironment, toPage, id);
      const fromOpacity = fromVisible.has(id)
        ? this.targetOpacityForLayer(fromEnvironment, fromPage, id)
        : 0;
      const toOpacity = toVisible.has(id)
        ? this.targetOpacityForLayer(toEnvironment, toPage, id)
        : 0;
      const sourceVisible = fromOpacity > 0.001;
      const targetVisible = toOpacity > 0.001;
      const transitionKind = authoredProductTransitionKind(
        id,
        fromStyle,
        targetStyle,
        sourceVisible,
        targetVisible,
      );
      recordProductFamily(
        id,
        fromStyle,
        targetStyle,
        transitionKind,
        sourceVisible,
        targetVisible,
        fromOpacity,
        toOpacity,
        this.layers.has(id),
      );
    }
  } finally {
    this.sceneSectionReapplySuspended = false;
  }
  this.reapplySceneSectionPlanes();

  this.transitionWorkingAreaFocusForPage(
    fromEnvironment,
    toEnvironment,
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
  this.applyLakesToTerrain(toEnvironment, toPage, terrainOverrides);
}
