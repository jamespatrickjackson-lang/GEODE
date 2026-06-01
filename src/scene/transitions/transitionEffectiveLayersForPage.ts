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
  buildTransitionRenderGraphTrace,
  type TransitionRenderGraphDerivedEntityState,
  type TransitionRenderGraphLayerState,
} from "./transitionRenderGraphAdapter";
import { createTransitionCommitGate } from "./transitionCommitGate";
import {
  SCENE_SECTION_AFFECTED_LAYER_IDS,
  SCALAR_TRANSITION_STYLE_FIELDS,
  forgeDiscreteDataStyleChanged,
  scalarTransitionStyleChanged,
  sceneSectionDiscreteStyleChanged,
  sceneSectionTransitionStyleChanged,
  type LayerTransitionKind,
  type NavigationReason,
} from "./transitionStyles";

const DEFAULT_LAYER_FADE_MS = 800;
type EffectiveLayerStyle = ReturnType<typeof effectiveStyle>;
type StyleField = keyof EffectiveLayerStyle;

const COLOR_STYLE_FIELDS: readonly StyleField[] = [
  "color",
  "fillColor",
  "outlineColor",
  "centerlineColor",
  "contourPresetColor",
  "surfaceGradientLowColor",
  "surfaceGradientMidColor",
  "surfaceGradientHighColor",
  "scalarColorLow",
  "scalarColorMid",
  "scalarColorHigh",
  "scalarEdgeColor",
  "mtThresholdSurfaceWireframeColor",
  "geochemPaletteLow",
  "geochemPaletteMid",
  "geochemPaletteHigh",
  "labelColor",
  "labelTextColor",
  "labelOutlineColor",
  "labelFillColor",
];

const CATEGORICAL_STYLE_FIELDS: readonly StyleField[] = [
  "scalarInclusionMode",
  "scalarEdgeLineStyle",
  "scalarLegendVisible",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoLineStyle",
  "scalarVolumeProductId",
  "scalarVolumeRenderMode",
  "scalarVolumeTransferMode",
  "scalarVolumeMaskVisible",
  "mtIsosurfaceProductId",
  "mtSurfaceBoundaryMode",
  "mtSurfaceBoundaryOrder",
  "mtSurfaceBoundariesById",
  "mtSurfaceBoundaryLegendVisible",
  "mtThresholdSurfaceVisibility",
  "seismicProductId",
  "seismicProductVisibility",
  "seismicRenderMode",
  "seismicColormap",
  "seismicAudiencePresetId",
  "seismicCapabilityPresetId",
  "seismicDisplayRecipeId",
  "seismicLegendVisible",
  "sceneSectionEnabled",
  "sceneSectionMode",
  "sceneSectionTargetScope",
  "sceneSectionActiveAxis",
  "sceneSectionWindowEnabled",
  "sceneSectionWindowActiveAxis",
  "sceneSectionFrameEnabled",
  "sceneSectionActiveFrameId",
  "sceneSectionGroundTraceVisible",
  "sceneSectionAxesVisible",
];

const SPATIAL_STYLE_FIELDS: readonly StyleField[] = [
  "sceneSectionPlanes",
  "sceneSectionWindowByAxis",
  "sceneSectionFrames",
  "sceneSectionFrameByAxis",
  "sceneSectionObjectVisibilityByAxis",
  "sceneSectionObjectVisibilityByFrameId",
  "workingAreaFocusOutsideOpacityByLayerId",
];

function sectionIsoOverlayVisible(style: ReturnType<typeof effectiveStyle>): boolean {
  if (style.sectionIsoEnabled !== true) return false;
  if (
    style.sectionIsoLinesVisible === false &&
    style.sectionIsoBandsVisible === false
  ) {
    return false;
  }
  const targetIds = style.sectionIsoTargetIds;
  if (
    targetIds &&
    typeof targetIds === "object" &&
    !Array.isArray(targetIds)
  ) {
    const values = Object.values(targetIds);
    if (values.length > 0 && values.every((value) => value === false)) {
      return false;
    }
  }
  return true;
}

function layerRepresentationKey(layerSpec: { type?: string } | undefined): string {
  return `layer:${layerSpec?.type ?? "unknown"}`;
}

function channelRecordFromStyle(
  style: EffectiveLayerStyle,
  fields: readonly StyleField[],
  prefix: string,
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const field of fields) {
    const value = style[field];
    if (value !== undefined) record[`${prefix}:${String(field)}`] = value;
  }
  return record;
}

function graphPresenceState(input: {
  opacity: number;
  loaded: boolean;
  authoredVisible: boolean;
}): TransitionRenderGraphLayerState["presenceState"] {
  if (input.opacity > 0.001) return "visible";
  if (input.loaded) return "hidden";
  return input.authoredVisible ? "loading" : "absent";
}

function graphReadinessState(input: {
  loaded: boolean;
  authoredVisible: boolean;
}): TransitionRenderGraphLayerState["readinessState"] {
  if (input.loaded) return "ready";
  return input.authoredVisible ? "loading" : "unavailable";
}

function derivedPresence(visible: boolean): TransitionRenderGraphLayerState["presenceState"] {
  return visible ? "visible" : "hidden";
}

function sceneSectionDerivedEntities(input: {
  layerId: string;
  style: EffectiveLayerStyle;
  ownerKey: string;
  ownerPriority: number;
  readinessState: TransitionRenderGraphLayerState["readinessState"];
  sourceStateOrigin: TransitionRenderGraphLayerState["sourceStateOrigin"];
}): TransitionRenderGraphDerivedEntityState[] {
  if (input.layerId !== UTAH_FORGE_SCENE_SECTION_LAYER_ID) return [];
  const sectionEnabled = input.style.sceneSectionEnabled === true;
  const frameEnabled = input.style.sceneSectionFrameEnabled === true;
  const groundTraceVisible =
    sectionEnabled && input.style.sceneSectionGroundTraceVisible !== false;
  const axesVisible = sectionEnabled && input.style.sceneSectionAxesVisible !== false;
  const sectionIsoEnabled = sectionIsoOverlayVisible(input.style);
  const lineIsoVisible =
    input.style.sectionIsoEnabled === true &&
    input.style.sectionIsoLinesVisible !== false;
  const bandIsoVisible =
    input.style.sectionIsoEnabled === true &&
    input.style.sectionIsoBandsVisible !== false;
  const spatialChannels = channelRecordFromStyle(
    input.style,
    SPATIAL_STYLE_FIELDS,
    "style",
  );
  const categoricalChannels = channelRecordFromStyle(
    input.style,
    CATEGORICAL_STYLE_FIELDS,
    "style",
  );
  const scalarChannels = channelRecordFromStyle(
    input.style,
    SCALAR_TRANSITION_STYLE_FIELDS,
    "style",
  );
  const base = {
    readinessState: input.readinessState,
    sourceStateOrigin: input.sourceStateOrigin,
    channelOwnerKey: input.ownerKey,
    channelOwnerPriority: input.ownerPriority,
  };
  return [
    {
      ...base,
      entityKey: `layer:${input.layerId}:derived:scene-section-helpers`,
      representationKey: "derived:scene-section-helper",
      presenceState: derivedPresence(sectionEnabled),
      categoricalChannels,
      spatialChannels,
    },
    {
      ...base,
      entityKey: `layer:${input.layerId}:derived:scene-section-frames`,
      representationKey: "derived:scene-section-frame",
      presenceState: derivedPresence(frameEnabled),
      categoricalChannels,
      spatialChannels,
    },
    {
      ...base,
      entityKey: `layer:${input.layerId}:derived:scene-section-ground-traces`,
      representationKey: "derived:ground-trace",
      presenceState: derivedPresence(groundTraceVisible),
      categoricalChannels,
      spatialChannels,
    },
    {
      ...base,
      entityKey: `layer:${input.layerId}:derived:scene-section-axes`,
      representationKey: "derived:axis-lines",
      presenceState: derivedPresence(axesVisible),
      categoricalChannels,
      spatialChannels,
    },
    {
      ...base,
      entityKey: `layer:${input.layerId}:derived:section-iso-lines`,
      representationKey: "derived:section-iso-line",
      presenceState: derivedPresence(sectionIsoEnabled && lineIsoVisible),
      categoricalChannels,
      scalarChannels,
      spatialChannels,
    },
    {
      ...base,
      entityKey: `layer:${input.layerId}:derived:section-iso-bands`,
      representationKey: "derived:section-iso-band",
      presenceState: derivedPresence(sectionIsoEnabled && bandIsoVisible),
      categoricalChannels,
      scalarChannels,
      spatialChannels,
    },
  ];
}

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
  transitionId: string = `transition-${Date.now()}`,
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
  const targetNotReadyLayerIds = new Set<string>();
  const sourceGraphLayers: TransitionRenderGraphLayerState[] = [];
  const targetGraphLayers: TransitionRenderGraphLayerState[] = [];
  for (const id of productFamilyLayerIds) {
    const layerSpec = this.layerSpecFor(id);
    const representationKey = layerRepresentationKey(layerSpec);
    const sourceState = sourceLayers.get(id);
    const sourceLoaded = !!sourceState;
    const targetLoaded = this.layers.has(id);
    const sourceOpacity = sourceState?.opacity ?? 0;
    const targetAuthoredVisible = toVisible.has(id);
    const targetOpacity = targetAuthoredVisible
      ? this.targetOpacityForLayer(toEnvironment, toPage, id)
      : 0;
    const fromStyle =
      sourceState?.style ?? effectiveStyle(fromEnvironment, fromPage, id);
    const targetStyle = effectiveStyle(toEnvironment, toPage, id);
    const sourceOwnerKey = sourceLoaded ? "live-runtime" : "persisted-effective";
    const sourceOwnerPriority = sourceLoaded ? 100 : 10;
    const targetOwnerKey = "target-effective";
    const targetOwnerPriority = 80;
    const sourceReadiness = graphReadinessState({
      loaded: sourceLoaded,
      authoredVisible: fromVisible.has(id),
    });
    const targetReadiness = graphReadinessState({
      loaded: targetLoaded,
      authoredVisible: targetAuthoredVisible,
    });
    if (targetAuthoredVisible && targetReadiness !== "ready") {
      targetNotReadyLayerIds.add(id);
    }
    sourceGraphLayers.push({
      layerId: id,
      representationKey,
      presenceState: graphPresenceState({
        opacity: sourceOpacity,
        loaded: sourceLoaded,
        authoredVisible: fromVisible.has(id),
      }),
      readinessState: sourceReadiness,
      opacity: sourceOpacity,
      opacityOwnerKey: sourceOwnerKey,
      opacityOwnerPriority: sourceOwnerPriority,
      sourceStateOrigin: sourceOwnerKey,
      channelOwnerKey: sourceOwnerKey,
      channelOwnerPriority: sourceOwnerPriority,
      scalarChannels: channelRecordFromStyle(
        fromStyle,
        SCALAR_TRANSITION_STYLE_FIELDS,
        "style",
      ),
      colorChannels: channelRecordFromStyle(fromStyle, COLOR_STYLE_FIELDS, "style"),
      spatialChannels: channelRecordFromStyle(
        fromStyle,
        SPATIAL_STYLE_FIELDS,
        "style",
      ),
      categoricalChannels: channelRecordFromStyle(
        fromStyle,
        CATEGORICAL_STYLE_FIELDS,
        "style",
      ),
      derivedEntities: sceneSectionDerivedEntities({
        layerId: id,
        style: fromStyle,
        ownerKey: sourceOwnerKey,
        ownerPriority: sourceOwnerPriority,
        readinessState: sourceReadiness,
        sourceStateOrigin: sourceOwnerKey,
      }),
      metadata: {
        layerType: layerSpec?.type ?? null,
      },
    });
    targetGraphLayers.push({
      layerId: id,
      representationKey,
      presenceState: graphPresenceState({
        opacity: targetOpacity,
        loaded: targetLoaded,
        authoredVisible: targetAuthoredVisible,
      }),
      readinessState: targetReadiness,
      opacity: targetOpacity,
      opacityOwnerKey: targetOwnerKey,
      opacityOwnerPriority: targetOwnerPriority,
      sourceStateOrigin: "persisted-effective",
      channelOwnerKey: targetOwnerKey,
      channelOwnerPriority: targetOwnerPriority,
      scalarChannels: channelRecordFromStyle(
        targetStyle,
        SCALAR_TRANSITION_STYLE_FIELDS,
        "style",
      ),
      colorChannels: channelRecordFromStyle(
        targetStyle,
        COLOR_STYLE_FIELDS,
        "style",
      ),
      spatialChannels: channelRecordFromStyle(
        targetStyle,
        SPATIAL_STYLE_FIELDS,
        "style",
      ),
      categoricalChannels: channelRecordFromStyle(
        targetStyle,
        CATEGORICAL_STYLE_FIELDS,
        "style",
      ),
      derivedEntities: sceneSectionDerivedEntities({
        layerId: id,
        style: targetStyle,
        ownerKey: targetOwnerKey,
        ownerPriority: targetOwnerPriority,
        readinessState: targetReadiness,
        sourceStateOrigin: "persisted-effective",
      }),
      metadata: {
        layerType: layerSpec?.type ?? null,
      },
    });
  }
  const assignmentTraces = buildTransitionRenderGraphTrace({
    sourceLayers: sourceGraphLayers,
    targetLayers: targetGraphLayers,
    evidence: {
      sourcePageId: fromPage.id,
      targetPageId: toPage.id,
      observedCaseFamily: "layer-visibility-opacity",
    },
  }).assignmentTraces;
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
    targetNotReadyLayerIds,
    sectionIsoStableLayerIds: new Set<string>(),
    warnedUnexpectedVisibleLayerIds: new Set(),
    assignmentTraces,
    commitState: createTransitionCommitGate({
      transitionId,
      sourcePageId: fromPage.id,
      targetPageId: toPage.id,
      commitOwner: "SceneManager",
    }).state,
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
      const sectionIsoStable =
        fromVisible.has(id) &&
        toVisible.has(id) &&
        sectionIsoOverlayVisible(fromStyle) &&
        sectionIsoOverlayVisible(targetStyle);
      if (sectionIsoStable) {
        this.activeSceneTransitionContext.sectionIsoStableLayerIds.add(id);
      }
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
        this.applyRenderOpacityToTree(transitionSnapshot, fromOpacity, 1);
        this.applyLayerTransitionRenderOpacity(id, 0, sectionIsoStable ? 1 : 0);
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
      this.applyLayerTransitionRenderOpacity(
        id,
        fromOpacity,
        sectionIsoStable ? 1 : fromOpacity > 0.001 ? 1 : 0,
      );
      terrainOverrides.set(id, fromOpacity);

      if (duration <= 0 || Math.abs(fromOpacity - toOpacity) < 0.001) {
        this.applyLayerTransitionRenderOpacity(
          id,
          toOpacity,
          toOpacity > 0.001 ? 1 : 0,
        );
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
  if (this.sceneSectionStyleTween?.discreteChanged) {
    this.sceneSectionStyleTween.appliedDiscreteTarget = true;
  }

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
