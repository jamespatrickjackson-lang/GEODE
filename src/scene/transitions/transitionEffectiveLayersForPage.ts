import type { EasingName, EnvironmentSetup, PresentationPage } from "../../pages/types";
import { effectiveStyle, effectiveVisibility } from "../../pages/effective";
import {
  seismicFigureAnnotationEntityKey,
  seismicGraphEntityKey,
  seismicSurveyGeometryEntityKey,
  type SeismicSurveyGeometryRole,
} from "../../geophysics/seismicSectionGraphBasis";
import { CASE_STUDY_B_DEMO_LAYER_ALIASES } from "../../projectModules/caseStudyB/demoLayerAliases";
import {
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
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
import { buildTransitionExecutionPlan } from "./transitionExecutionPlan";
import { createTransitionCommitGate } from "./transitionCommitGate";
import { DEFAULT_DETACHED_FADE_MS } from "./transitionDefaults";
import {
  SCENE_SECTION_AFFECTED_LAYER_IDS,
  SCALAR_TRANSITION_STYLE_FIELDS,
  forgeDiscreteDataStyleChanged,
  scalarTransitionStyleChanged,
  sceneSectionDiscreteStyleChanged,
  sceneSectionFramePartition,
  sceneSectionTransitionStyleChanged,
  type LayerTransitionKind,
  type NavigationReason,
} from "./transitionStyles";
import {
  applyEntityOpacityFade,
  setupEntityBehaviorTransition,
} from "./entityBehaviorApplier";

const DEFAULT_LAYER_FADE_MS = DEFAULT_DETACHED_FADE_MS;
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
  "seismicFigureTextColor",
  "seismicFigureAxisColor",
  "seismicFigureCaptionBoxColor",
  "seismicFigureHorizonColor",
  "seismicFigureWellColor",
  "boreholeLogHcgrColor",
  "boreholeLogHsgrColor",
  "boreholeLogResistivityColor",
  "boreholeLogBaselineColor",
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
  "seismicPresentationBarVisible",
  "seismicVerticalDatumMode",
  "seismicFigureAnnotationsVisible",
  "seismicFigureWellVisible",
  "seismicFigureHorizonVisible",
  "graphAnnotationSelectedTargetKey",
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
  "atmosphereSubtype",
  "atmosphereBoundsMode",
  "atmosphereDriftEnabled",
  "atmosphereDepthTest",
  "atmosphereBoundsHelperVisible",
  "boreholeLogActiveWell",
  "boreholeLogTrackSelection",
  "boreholeLogLegendVisible",
  "boreholeLogProvenanceVisible",
  "boreholeLogReadoutVisible",
];

const SEISMIC_GRAPH_SCALAR_STYLE_FIELDS: readonly StyleField[] = [
  "seismicSliceFraction",
  "seismicFigureCaptionBoxOpacity",
  "seismicFigureOutsideOffsetM",
  "seismicFigureLabelSizeM",
  "seismicFigureWellPosition",
];

const SEISMIC_GRAPH_CROSSFADE_STYLE_FIELDS: readonly StyleField[] = [
  "seismicFigureTitle",
  "seismicFigureCaption",
  "seismicFigureScaleLabel",
  "seismicFigureHorizonPoints",
  "graphAnnotationDefaults",
  "graphAnnotationProfiles",
];

const SPATIAL_STYLE_FIELDS: readonly StyleField[] = [
  "sceneSectionPlanes",
  "sceneSectionWindowByAxis",
  "sceneSectionFrames",
  "sceneSectionFrameByAxis",
  "sceneSectionObjectVisibilityByAxis",
  "sceneSectionObjectVisibilityByFrameId",
  "workingAreaFocusOutsideOpacityByLayerId",
  "atmosphereBoundsCenterX",
  "atmosphereBoundsCenterY",
  "atmosphereBoundsCenterZ",
  "atmosphereBoundsSizeX",
  "atmosphereBoundsSizeY",
  "atmosphereBoundsSizeZ",
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

function graphAnnotationProfileVisible(style: EffectiveLayerStyle): boolean {
  if (style.seismicFigureAnnotationsVisible === true) return true;
  if (style.graphAnnotationDefaults?.frameVisible === true) return true;
  const selectedTargetKey =
    typeof style.graphAnnotationSelectedTargetKey === "string"
      ? style.graphAnnotationSelectedTargetKey
      : null;
  if (
    selectedTargetKey &&
    style.graphAnnotationProfiles?.[selectedTargetKey]?.frameVisible === true
  ) {
    return true;
  }
  return Object.values(style.graphAnnotationProfiles ?? {}).some(
    (profile) => profile?.frameVisible === true,
  );
}

function sceneSectionTransitionActiveForStyle(
  style: EffectiveLayerStyle,
): boolean {
  return style.sceneSectionEnabled === true;
}

function sceneSectionBuiltInFrameEntry(
  style: EffectiveLayerStyle,
  axis: "x" | "y" | "z",
) {
  return Array.isArray(style.sceneSectionFrames)
    ? style.sceneSectionFrames.find((entry) => entry?.id === `axis:${axis}`)
    : null;
}

function sceneSectionFrameState(
  style: EffectiveLayerStyle,
  axis: "x" | "y" | "z",
) {
  const entry = sceneSectionBuiltInFrameEntry(style, axis);
  return {
    ...(style.sceneSectionFrameByAxis?.[axis] ?? {}),
    ...(entry?.frame ?? {}),
  };
}

function sceneSectionPlaneShown(
  style: EffectiveLayerStyle,
  axis: "x" | "y" | "z",
): boolean {
  const entry = sceneSectionBuiltInFrameEntry(style, axis);
  const plane = {
    ...(entry?.plane ?? {}),
    ...(style.sceneSectionPlanes?.[axis] ?? {}),
  };
  return plane.enabled === true;
}

function sceneSectionAnyFrameBoolean(
  style: EffectiveLayerStyle,
  key: "groundTraceVisible" | "axesVisible",
  fallback: boolean,
): boolean {
  return (["x", "y", "z"] as const).some((axis) => {
    if (!sceneSectionPlaneShown(style, axis)) return false;
    const frame = sceneSectionFrameState(style, axis);
    const value = frame[key];
    return typeof value === "boolean" ? value : fallback;
  });
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
  const frameEnabled =
    sectionEnabled && input.style.sceneSectionFrameEnabled === true;
  const groundTraceVisible =
    sectionEnabled &&
    sceneSectionAnyFrameBoolean(
      input.style,
      "groundTraceVisible",
      input.style.sceneSectionGroundTraceVisible !== false,
    );
  const axesVisible =
    sectionEnabled &&
    sceneSectionAnyFrameBoolean(
      input.style,
      "axesVisible",
      input.style.sceneSectionAxesVisible !== false,
    );
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

function styleStringValue(style: EffectiveLayerStyle, field: StyleField): string | null {
  const value = style[field];
  return typeof value === "string" && value.trim() ? value : null;
}

type SeismicGraphRuntimeSection = {
  userData?: Record<string, unknown>;
};

type SeismicGraphRuntimeIndex = {
  productSummaries: Array<{
    id: string;
    surveyKind?: string;
    raymarchCapable?: boolean;
  }>;
  sectionsByProduct: Map<string, SeismicGraphRuntimeSection[]>;
};

function seismicGraphObjectKindForRuntimeSection(
  section: SeismicGraphRuntimeSection,
  surveyKind: string | undefined,
): "2d-section-line" | "3d-section-plane" {
  const axis = section.userData?.seismicSectionAxis;
  return surveyKind === "2d" || surveyKind === "legacy-2d" || axis === "line"
    ? "2d-section-line"
    : "3d-section-plane";
}

function selectedSeismicRuntimeSection(input: {
  style: EffectiveLayerStyle;
  runtimeIndex: SeismicGraphRuntimeIndex;
  productId: string;
  renderMode: "slice" | "raymarch";
  sliceAxis: "inline" | "crossline" | "sample" | "line";
  sliceFraction: number;
}): SeismicGraphRuntimeSection | null {
  if (input.renderMode === "raymarch") return null;
  const summary = input.runtimeIndex.productSummaries.find(
    (product) => product.id === input.productId,
  );
  const sections = input.runtimeIndex.sectionsByProduct.get(input.productId) ?? [];
  if (sections.length === 0) return null;
  const lineSections = sections.filter(
    (section) => section.userData?.seismicSectionAxis === "line",
  );
  if (summary?.surveyKind !== "3d") {
    return lineSections[0] ?? sections[0] ?? null;
  }
  const sliceAxis = input.sliceAxis === "line" ? "inline" : input.sliceAxis;
  let axisSections = sections.filter(
    (section) => section.userData?.seismicSectionAxis === sliceAxis,
  );
  if (axisSections.length === 0) {
    axisSections = sections.filter(
      (section) => section.userData?.seismicSectionAxis === "inline",
    );
  }
  let closest: SeismicGraphRuntimeSection | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const section of axisSections) {
    const fraction =
      typeof section.userData?.seismicSectionFraction === "number" &&
      Number.isFinite(section.userData.seismicSectionFraction)
        ? section.userData.seismicSectionFraction
        : 0.5;
    const distance = Math.abs(fraction - input.sliceFraction);
    if (distance < closestDistance) {
      closest = section;
      closestDistance = distance;
    }
  }
  return closest;
}

function seismicGraphObjectStateForRuntime(
  style: EffectiveLayerStyle,
  runtimeIndex: SeismicGraphRuntimeIndex | null,
): {
  productId: string;
  objectKind: "2d-section-line" | "3d-section-plane" | "3d-volume";
  objectId: string;
  representationKey:
    | "seismic:2d-section-line"
    | "seismic:3d-section-plane"
    | "seismic:3d-volume";
} {
  const requestedProductId =
    styleStringValue(style, "seismicProductId") ?? "default-product";
  const runtimeProductIds = new Set(
    runtimeIndex?.productSummaries.map((product) => product.id) ?? [],
  );
  const productId =
    runtimeProductIds.size === 0 || runtimeProductIds.has(requestedProductId)
      ? requestedProductId
      : (runtimeIndex?.productSummaries[0]?.id ?? requestedProductId);
  const renderMode = style.seismicRenderMode === "raymarch" ? "raymarch" : "slice";
  const sliceAxis =
    style.seismicSliceAxis === "crossline" ||
    style.seismicSliceAxis === "sample" ||
    style.seismicSliceAxis === "line"
      ? style.seismicSliceAxis
      : "inline";
  const fraction =
    typeof style.seismicSliceFraction === "number" &&
    Number.isFinite(style.seismicSliceFraction)
      ? style.seismicSliceFraction
      : 0.5;
  if (renderMode === "raymarch") {
    return {
      productId,
      objectKind: "3d-volume",
      objectId: "volume",
      representationKey: "seismic:3d-volume",
    };
  }
  if (runtimeIndex) {
    const section = selectedSeismicRuntimeSection({
      style,
      runtimeIndex,
      productId,
      renderMode,
      sliceAxis,
      sliceFraction: fraction,
    });
    const runtimeObjectId = section?.userData?.seismicSectionId;
    if (section && typeof runtimeObjectId === "string" && runtimeObjectId.trim()) {
      const objectKind = seismicGraphObjectKindForRuntimeSection(
        section,
        runtimeIndex.productSummaries.find((product) => product.id === productId)
          ?.surveyKind,
      );
      return {
        productId,
        objectKind,
        objectId: runtimeObjectId,
        representationKey:
          objectKind === "2d-section-line"
            ? "seismic:2d-section-line"
            : "seismic:3d-section-plane",
      };
    }
  }
  const objectKind = sliceAxis === "line" ? "2d-section-line" : "3d-section-plane";
  return {
    productId,
    objectKind,
    objectId: `${sliceAxis}:${fraction.toFixed(3)}`,
    representationKey:
      objectKind === "2d-section-line"
        ? "seismic:2d-section-line"
        : "seismic:3d-section-plane",
  };
}

function seismicGraphDerivedEntities(input: {
  layerId: string;
  style: EffectiveLayerStyle;
  runtimeIndex?: SeismicGraphRuntimeIndex | null;
  ownerKey: string;
  ownerPriority: number;
  readinessState: TransitionRenderGraphLayerState["readinessState"];
  sourceStateOrigin: TransitionRenderGraphLayerState["sourceStateOrigin"];
}): TransitionRenderGraphDerivedEntityState[] {
  if (input.layerId !== UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID) return [];
  const objectState = seismicGraphObjectStateForRuntime(
    input.style,
    input.runtimeIndex ?? null,
  );
  const objectEntityKey = seismicGraphEntityKey({
    layerId: input.layerId,
    productId: objectState.productId,
    objectKind: objectState.objectKind,
    objectId: objectState.objectId,
  });
  const figureEntityKey = seismicFigureAnnotationEntityKey({
    sectionEntityKey: objectEntityKey,
  });
  const comparisonEntityKey = seismicGraphEntityKey({
    layerId: input.layerId,
    productId: objectState.productId,
    objectKind: "comparison",
    objectId:
      styleStringValue(input.style, "seismicComparisonProductId") ??
      "single-product",
  });
  const base = {
    readinessState: input.readinessState,
    sourceStateOrigin: input.sourceStateOrigin,
    channelOwnerKey: input.ownerKey,
    channelOwnerPriority: input.ownerPriority,
  };
  const categoricalChannels = channelRecordFromStyle(
    input.style,
    CATEGORICAL_STYLE_FIELDS,
    "style",
  );
  const scalarChannels = {
    ...channelRecordFromStyle(
      input.style,
      SCALAR_TRANSITION_STYLE_FIELDS,
      "style",
    ),
    ...channelRecordFromStyle(
      input.style,
      SEISMIC_GRAPH_SCALAR_STYLE_FIELDS,
      "style",
    ),
  };
  const colorChannels = channelRecordFromStyle(
    input.style,
    COLOR_STYLE_FIELDS,
    "style",
  );
  const crossfadeChannels = channelRecordFromStyle(
    input.style,
    SEISMIC_GRAPH_CROSSFADE_STYLE_FIELDS,
    "style",
  );
  const navigationVisible = input.style.seismicNavigationVisible !== false;
  const navigationRoleVisibility =
    typeof input.style.seismicNavigationRoleVisibility === "object" &&
    input.style.seismicNavigationRoleVisibility !== null
      ? input.style.seismicNavigationRoleVisibility
      : {};
  const surveyRoles: readonly SeismicSurveyGeometryRole[] = [
    "navigation",
    "lines",
    "sources",
    "receivers",
  ];
  const surveyEntities = surveyRoles.map((role) => {
    const roleVisible =
      role === "navigation"
        ? navigationVisible
        : navigationVisible && navigationRoleVisibility[role] !== false;
    return {
      ...base,
      entityKey: seismicSurveyGeometryEntityKey({
        layerId: input.layerId,
        role,
      }),
      representationKey: "seismic:survey-geometry",
      presenceState: derivedPresence(roleVisible),
      categoricalChannels,
      colorChannels,
      metadata: {
        objectKind: "survey-geometry",
        objectId: role,
        role,
      },
    } satisfies TransitionRenderGraphDerivedEntityState;
  });
  return [
    {
      ...base,
      entityKey: objectEntityKey,
      representationKey: objectState.representationKey,
      presenceState: derivedPresence(true),
      categoricalChannels,
      scalarChannels,
      colorChannels,
      metadata: {
        productId: objectState.productId,
        objectKind: objectState.objectKind,
        objectId: objectState.objectId,
      },
    },
    {
      ...base,
      entityKey: figureEntityKey,
      representationKey: "seismic:figure-annotation",
      derivedFromEntityKey: objectEntityKey,
      presenceState: derivedPresence(graphAnnotationProfileVisible(input.style)),
      categoricalChannels,
      scalarChannels,
      colorChannels,
      crossfadeChannels,
      metadata: {
        productId: objectState.productId,
        objectKind: "figure-annotation",
        objectId: objectState.objectId,
      },
    },
    ...surveyEntities,
    {
      ...base,
      entityKey: comparisonEntityKey,
      representationKey: "seismic:comparison",
      presenceState: derivedPresence(
        input.style.seismicComparisonMode === "side-by-side" ||
          !!styleStringValue(input.style, "seismicComparisonProductId"),
      ),
      categoricalChannels,
      scalarChannels,
      metadata: {
        productId: objectState.productId,
        objectKind: "comparison",
      },
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
  startMs: number = performance.now(),
): void {
  // Per-entity behavior pipeline (Phase 2) setup chokepoint. When the runtime
  // flag is on and the applier fully owns setup for migrated owners, skip the
  // legacy setup; otherwise fall through unchanged. F0: applier returns false.
  if (
    (this as any).perEntityBehaviorActive === true &&
    setupEntityBehaviorTransition(this as never)
  ) {
    return;
  }
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
  this.visibilityToggleFades?.clear();
  this.workingAreaFocusTween = null;
  this.sceneSectionStyleTween = null;
  this.sceneSectionHelperTransitionOpacity = 1;
  this.discardSectionIsoOverlayTransition?.();
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
  const now = startMs;
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
    let targetLoaded = this.layers.has(id);
    const group = this.layers.get(id);
    const seismicRuntimeIndex =
      id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID &&
      group &&
      typeof this.seismicBrowserRuntimeIndex === "function"
        ? (this.seismicBrowserRuntimeIndex(group) as SeismicGraphRuntimeIndex | null)
        : null;
    const sourceOpacity = sourceState?.opacity ?? 0;
    const targetAuthoredVisible = toVisible.has(id);
    const targetOpacity = targetAuthoredVisible
      ? this.targetOpacityForLayer(toEnvironment, toPage, id)
      : 0;
    const fromStyle =
      sourceState?.style ?? effectiveStyle(fromEnvironment, fromPage, id);
    const targetStyle = effectiveStyle(toEnvironment, toPage, id);
    if (
      targetLoaded &&
      targetAuthoredVisible &&
      id === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID &&
      group?.userData?.mtThresholdSurfaceLazy === true &&
      typeof this.mtThresholdLayerGeometryReady === "function"
    ) {
      // Lazy MT surfaces: the group exists immediately, but boundary geometry is
      // fetched on demand. Report "loading" until the target's visible
      // boundaries are attached so the transition holds source / enters target
      // on the transition clock instead of popping in at full opacity.
      targetLoaded = this.mtThresholdLayerGeometryReady(id, targetStyle);
    }
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
      derivedEntities: [
        ...sceneSectionDerivedEntities({
          layerId: id,
          style: fromStyle,
          ownerKey: sourceOwnerKey,
          ownerPriority: sourceOwnerPriority,
          readinessState: sourceReadiness,
          sourceStateOrigin: sourceOwnerKey,
        }),
        ...seismicGraphDerivedEntities({
          layerId: id,
          style: fromStyle,
          runtimeIndex: seismicRuntimeIndex,
          ownerKey: sourceOwnerKey,
          ownerPriority: sourceOwnerPriority,
          readinessState: sourceReadiness,
          sourceStateOrigin: sourceOwnerKey,
        }),
      ],
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
      derivedEntities: [
        ...sceneSectionDerivedEntities({
          layerId: id,
          style: targetStyle,
          ownerKey: targetOwnerKey,
          ownerPriority: targetOwnerPriority,
          readinessState: targetReadiness,
          sourceStateOrigin: "persisted-effective",
        }),
        ...seismicGraphDerivedEntities({
          layerId: id,
          style: targetStyle,
          runtimeIndex: seismicRuntimeIndex,
          ownerKey: targetOwnerKey,
          ownerPriority: targetOwnerPriority,
          readinessState: targetReadiness,
          sourceStateOrigin: "persisted-effective",
        }),
      ],
      metadata: {
        layerType: layerSpec?.type ?? null,
      },
    });
  }
  const renderGraphTrace = buildTransitionRenderGraphTrace({
    sourceLayers: sourceGraphLayers,
    targetLayers: targetGraphLayers,
    evidence: {
      sourcePageId: fromPage.id,
      targetPageId: toPage.id,
      observedCaseFamily: "layer-visibility-opacity",
    },
  });
  const assignmentTraces = renderGraphTrace.assignmentTraces;
  // Execution layer (TRD-013 / DEC-152): turn the classifier assignments into a
  // plan of per-entity operations. The seismic entity executor owns the
  // `seismic-entity` operations; protected/existing channels keep their guarded
  // materialization kernels below and are classified here for trace fidelity.
  const executionPlan = buildTransitionExecutionPlan({
    assignments: renderGraphTrace.assignments,
    startMs: now,
    durationMs: duration,
    easing,
    scalarStyleDurationMs: Math.max(0, scalarStyleDurationMs),
    scalarStyleEasing,
  });
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
    readinessAttachedLayerIds: new Set<string>(),
    sectionIsoStableLayerIds: new Set<string>(),
    warnedUnexpectedVisibleLayerIds: new Set(),
    assignmentTraces,
    executionPlan,
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
  const sourceSceneSectionTransitionActive =
    sceneSectionTransitionActiveForStyle(fromSceneSectionStyle);
  const targetSceneSectionTransitionActive =
    sceneSectionTransitionActiveForStyle(targetSceneSectionStyle);
  // Section ISO roots crossfade only when their resolved state actually
  // changes. Matched cut identity with unchanged section masks and unchanged
  // overlay style must stay continuous (no self-crossfade dip); the live
  // roots are protected through the sectionIsoStable envelope instead.
  const sectionIsoRootSourceLayerIds = [
    UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
    UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  ];
  const sectionIsoRootStates = sectionIsoRootSourceLayerIds.map((id) => {
    const fromStyle = effectiveStyle(fromEnvironment, fromPage, id);
    const toStyle = effectiveStyle(toEnvironment, toPage, id);
    const fromOn =
      sourceSceneSectionTransitionActive &&
      fromVisible.has(id) &&
      sectionIsoOverlayVisible(fromStyle);
    const toOn =
      targetSceneSectionTransitionActive &&
      toVisible.has(id) &&
      sectionIsoOverlayVisible(toStyle);
    let changed = fromOn !== toOn;
    if (!changed && toOn) {
      changed = scalarTransitionStyleChanged(fromStyle, toStyle);
    }
    if (
      !changed &&
      toOn &&
      ((fromStyle.sectionIsoLinesVisible !== false) !==
        (toStyle.sectionIsoLinesVisible !== false) ||
        (fromStyle.sectionIsoBandsVisible !== false) !==
          (toStyle.sectionIsoBandsVisible !== false))
    ) {
      changed = true;
    }
    if (
      !changed &&
      toOn &&
      JSON.stringify(fromStyle.sectionIsoTargetIds ?? null) !==
      JSON.stringify(toStyle.sectionIsoTargetIds ?? null)
    ) {
      changed = true;
    }
    return { id, fromStyle, toStyle, fromOn, toOn, changed };
  });
  const sectionIsoRootStateChanged = sectionIsoRootStates.some(
    (state) => state.changed,
  );
  const sectionIsoMoveFollowSourceStyles = new Map<
    string,
    ReturnType<typeof effectiveStyle>
  >();
  let sectionIsoRootStateChangedForTransition = sectionIsoRootStateChanged;
  let sectionIsoOverlayTransitionStarted = false;
  let sectionHasDissolveForTransition = false;
  let applyInactiveTargetSceneSectionAfterLayerSnapshots = false;
  if (
    sceneSectionStyleChanged &&
    duration > 0 &&
    targetSceneSectionTransitionActive
  ) {
    // DEC-164: partition frames per stable id. Surviving frames move; only
    // changed frames dissolve. Non-geometric section differences (target scope,
    // controls, flip commit state) must not erase moving-frame ownership; layer
    // and ISO owners handle their own internal fades while the section moves.
    const sectionPartition = sceneSectionFramePartition(
      fromSceneSectionStyle,
      targetSceneSectionStyle,
    );
    const movingFrameIds = sectionPartition.movingFrameIds;
    const dissolveFrameIds = sectionPartition.dissolveFrameIds;
    const sectionHasDissolve = dissolveFrameIds.size > 0;
    sectionHasDissolveForTransition = sectionHasDissolve;
    if (!sectionHasDissolve) {
      const sectionHasCompatibleMove = movingFrameIds.size > 0;
      for (const state of sectionIsoRootStates) {
        const { id, fromStyle, fromOn, toOn } = state;
        if (fromOn && !toOn) {
          sectionIsoMoveFollowSourceStyles.set(id, fromStyle);
        }
      }
      sectionIsoRootStateChangedForTransition = sectionIsoRootStates.some(
        (state) => {
          if (!state.changed) return false;
          if (sectionIsoMoveFollowSourceStyles.has(state.id)) return false;
          if (sectionHasCompatibleMove && state.fromOn && state.toOn) {
            return false;
          }
          return true;
        },
      );
    }
    this.sceneSectionStyleTween = {
      fromStyle: fromSceneSectionStyle,
      toStyle: targetSceneSectionStyle,
      startMs: now,
      durationMs: duration,
      easing,
      discreteChanged: sceneSectionDiscreteChanged,
      maskMode: sectionHasDissolve ? "dual-mask" : "interpolated",
      movingFrameIds,
      dissolveFrameIds,
      sectionIsoMoveFollowSourceStyles:
        sectionIsoMoveFollowSourceStyles.size > 0
          ? sectionIsoMoveFollowSourceStyles
          : undefined,
    };
    this.sceneSectionHelperTransitionOpacity =
      this.sceneSectionHelperOpacityForTween(this.sceneSectionStyleTween, 0);
    if (
      (sceneSectionDiscreteChanged &&
        this.sceneSectionHelperSnapshotAllowedForTween?.(
          this.sceneSectionStyleTween,
        )) ||
      this.sceneSectionHelperExitSnapshotNeeded?.(
        fromSceneSectionStyle,
        targetSceneSectionStyle,
      )
    ) {
      this.beginSceneSectionHelperTransitionSnapshot?.(now, duration, easing);
    }
  } else if (sceneSectionStyleChanged && !targetSceneSectionTransitionActive) {
    this.sceneSectionStyleTween = null;
    this.sceneSectionHelperTransitionOpacity = 0;
    // The live runtime applies inactive target section state on the first
    // transition setup pass (section rules: no source carry), but only after
    // source visual layer snapshots clone their already-visible masks. That
    // keeps outgoing clipped surfaces clipped while they fade to zero.
    if (duration > 0 && sectionIsoRootStateChanged) {
      this.beginSectionIsoOverlayTransition(
        fromSceneSectionStyle,
        targetSceneSectionStyle,
        now,
        duration,
        easing,
      );
      sectionIsoOverlayTransitionStarted = true;
    }
    if (
      duration > 0 &&
      this.sceneSectionHelperExitSnapshotNeeded?.(
        fromSceneSectionStyle,
        targetSceneSectionStyle,
      )
    ) {
      this.beginSceneSectionHelperTransitionSnapshot?.(now, duration, easing);
    }
    applyInactiveTargetSceneSectionAfterLayerSnapshots = true;
  }
  if (sceneSectionStyleChanged) {
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
  // Crossfade the Section ISO overlay only when the section has real dissolved
  // frames or when ISO roots change incompatibly. Compatible section moves keep
  // live overlays on the interpolated cut; scalar/style owners can then fade or
  // tween internals without fixed roots being left behind.
  if (
    !sectionIsoOverlayTransitionStarted &&
    (sectionHasDissolveForTransition || sectionIsoRootStateChangedForTransition)
  ) {
    this.beginSectionIsoOverlayTransition(
      fromSceneSectionStyle,
      targetSceneSectionStyle,
      now,
      duration,
      easing,
    );
  } else if (!sectionIsoOverlayTransitionStarted) {
    this.discardSectionIsoOverlayTransition?.();
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
        sourceSceneSectionTransitionActive &&
        targetSceneSectionTransitionActive &&
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
      // A discrete section change alone must not crossfade a layer whose own
      // resolved state is unchanged: crossfading two identical translucent
      // copies dips composite alpha mid-fade and shimmers (threshold-surface
      // "ghosting"). The TRD-010 dual-mask path owns the clip-difference fade
      // on material uniforms; the layer snapshot crossfade is reserved for
      // layers whose own presentation state also changes.
      const sectionAffectedLayerStateUnchanged =
        Math.abs(fromOpacity - toOpacity) < 0.001 &&
        !forgeDiscreteDataStyleChanged(
          id,
          fromStyle,
          targetStyle,
          this.layerSpecFor(id),
        ) &&
        !scalarTransitionStyleChanged(fromStyle, targetStyle);
      const shouldCrossfadeSceneSection =
        !!group &&
        duration > 0 &&
        sceneSectionDiscreteChanged &&
        sectionHasDissolveForTransition &&
        targetSceneSectionTransitionActive &&
        fromOpacity > 0.001 &&
        SCENE_SECTION_AFFECTED_LAYER_IDS.has(id) &&
        !sectionAffectedLayerStateUnchanged;
      const shouldTweenFullDensityScalarStyle =
        id === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID &&
        scalarTransitionStyleChanged(fromStyle, targetStyle);
      const shouldTweenScalarStyle =
        !!group &&
        !shouldCrossfadeDiscreteData &&
        !shouldCrossfadeSceneSection &&
        scalarStyleDurationMs > 0 &&
        fromOpacity > 0.001 &&
        toOpacity > 0.001 &&
        (this.layerSupportsScalarStyleTween(id, group) ||
          shouldTweenFullDensityScalarStyle) &&
        scalarTransitionStyleChanged(fromStyle, targetStyle);
      const shouldCrossfadeScalarStyle =
        !!group &&
        duration > 0 &&
        fromOpacity > 0.001 &&
        this.layerHasScalarPreviewData(group) &&
        !toVisible.has(id);
      const shouldPreserveScalarVolumeExitStyle =
        id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID &&
        !!group &&
        duration > 0 &&
        fromOpacity > 0.001 &&
        toOpacity <= 0.001;
      const shouldSnapshotScalarVolumeSectionExit =
        shouldPreserveScalarVolumeExitStyle &&
        sourceSceneSectionTransitionActive &&
        !targetSceneSectionTransitionActive;
      const exitHoldOwnedByPipeline =
        (this as any).perEntityBehaviorActive === true &&
        shouldSnapshotScalarVolumeSectionExit;
      const shouldTweenScalarVolumeExitStyle =
        id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID &&
        !!group &&
        duration > 0 &&
        scalarStyleDurationMs > 0 &&
        fromOpacity > 0.001 &&
        toOpacity <= 0.001 &&
        this.layerSupportsScalarStyleTween(id, group) &&
        // F4 clip-hold-on-exit (flag ON): when the held-clip source snapshot owns
        // the sectioned exit, suppress the live scalar tween so the live (now
        // inactive-target, un-clipped) volume does not render its exterior while
        // fading — only the clipped snapshot fades. The two exit owners are
        // mutually exclusive (the L2 fix), gated behind the pipeline flag.
        !exitHoldOwnedByPipeline;
      if (exitHoldOwnedByPipeline) {
        (this as any).noteEntityBehaviorExitHoldOwned();
      }
      const scalarVolumeExitSourceStyle = shouldTweenScalarVolumeExitStyle
        ? {
            ...fromStyle,
            scalarVolumeOpacity:
              typeof fromStyle.scalarVolumeOpacity === "number" &&
              Number.isFinite(fromStyle.scalarVolumeOpacity)
                ? fromStyle.scalarVolumeOpacity
                : typeof fromStyle.opacity === "number" &&
                    Number.isFinite(fromStyle.opacity)
                  ? fromStyle.opacity
                  : fromOpacity,
          }
        : fromStyle;
      const scalarVolumeExitTargetStyle = shouldTweenScalarVolumeExitStyle
        ? {
            ...targetStyle,
            scalarVolumeOpacity: 0,
          }
        : targetStyle;
      const transitionSnapshot =
        shouldCrossfadeDiscreteData ||
        shouldCrossfadeScalarStyle ||
        shouldCrossfadeSceneSection ||
        shouldSnapshotScalarVolumeSectionExit
          ? this.cloneLayerTransitionSnapshot(id, group)
          : null;
      const transitionKind: LayerTransitionKind =
        shouldCrossfadeDiscreteData ||
        shouldCrossfadeScalarStyle ||
        shouldCrossfadeSceneSection ||
        shouldSnapshotScalarVolumeSectionExit
          ? "discrete-crossfade"
          : shouldTweenScalarStyle || shouldTweenScalarVolumeExitStyle
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
      this.applyStyle(
        id,
          shouldTweenScalarStyle || shouldPreserveScalarVolumeExitStyle
            ? fromStyle
            : targetStyle,
      );
      if (shouldTweenScalarStyle || shouldTweenScalarVolumeExitStyle) {
        this.scalarStyleTweens.set(id, {
          id,
          from: 0,
          to: 1,
          fromStyle: shouldTweenScalarVolumeExitStyle
            ? scalarVolumeExitSourceStyle
            : fromStyle,
          toStyle: shouldTweenScalarVolumeExitStyle
            ? scalarVolumeExitTargetStyle
            : targetStyle,
          startMs: now,
          durationMs: Math.max(0, scalarStyleDurationMs),
          easing: scalarStyleEasing,
        });
      }
      if (transitionSnapshot) {
        this.applyRenderOpacityToTree(transitionSnapshot, fromOpacity, 1);
        this.applyLayerTransitionRenderOpacity(id, 0, sectionIsoStable ? 1 : 0);
        // F2: snapshot-path live-layer opacity owner through the pipeline
        // (parity). Flag ON && applier-handled -> applier owns; else legacy.
        if (
          (this as any).perEntityBehaviorActive === true &&
          applyEntityOpacityFade(this, id, 0, toOpacity, now, duration, easing)
        ) {
          // applier set the tween
        } else {
          this.layerTweens.set(id, {
            from: 0,
            to: toOpacity,
            startMs: now,
            durationMs: duration,
            easing,
          });
        }
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

      // F1: opacity owner migration (parity). When the pipeline flag is on, the
      // single applier owns this layer's generic fade tween (mutual exclusion —
      // the legacy assignment below is skipped). Endpoints are identical, so flag
      // ON == flag OFF.
      if (
        (this as any).perEntityBehaviorActive === true &&
        applyEntityOpacityFade(this, id, fromOpacity, toOpacity, now, duration, easing)
      ) {
        // applier set the tween
      } else {
        this.layerTweens.set(id, {
          from: fromOpacity,
          to: toOpacity,
          startMs: now,
          durationMs: duration,
          easing,
        });
      }
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
  if (this.sceneSectionStyleTween?.maskMode === "dual-mask") {
    // Build the initial dual-mask state with compatible numeric channels at
    // their SOURCE values (eased 0); applying raw toStyle here parked plane
    // and frame positions at the target before the tween ever ticked.
    this.applySceneSectionPlanes(
      this.interpolatedSceneSectionStyle(
        this.sceneSectionStyleTween.fromStyle,
        this.sceneSectionStyleTween.toStyle,
        0,
      ),
      {
        maskTransition: this.sceneSectionMaskTransitionForTween(
          this.sceneSectionStyleTween,
          0,
        ),
      },
    );
  } else if (this.sceneSectionStyleTween) {
    this.applySceneSectionPlanes(
      this.sceneSectionTweenStyle(this.sceneSectionStyleTween, 0),
      { transitionFrame: true },
    );
  } else if (applyInactiveTargetSceneSectionAfterLayerSnapshots) {
    this.applySceneSectionPlanes(targetSceneSectionStyle);
  } else {
    this.reapplySceneSectionPlanes();
  }
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
