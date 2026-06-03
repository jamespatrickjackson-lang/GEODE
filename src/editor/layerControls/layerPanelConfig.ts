import type { EditableStyle, ProjectLayerSpec } from "../../pages/types";
import {
  UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_SITE_BOUNDARY_LAYER_ID,
} from "../../projectModules/utahForge/layerIds";
import { isTopoMapLayer } from "../../topoMap/settings";

export const CLASSIFICATIONS = [
  "observation",
  "interpretation",
  "environmental",
  "narrative",
  "planned",
] as const;

export const CONFIDENTIALITIES = ["public", "private"] as const;

export type LayerDataSection =
  | "public"
  | "publicTopo"
  | "sectionsCropping"
  | "customer";

export const SURFACE_GRADIENT_FIELDS = [
  "surfaceGradientLowColor",
  "surfaceGradientMidColor",
  "surfaceGradientHighColor",
  "surfaceGradientMidpoint",
  "surfaceGradientContrast",
] as const satisfies readonly (keyof EditableStyle)[];

export const CONTOUR_DISTANCE_STYLE_CONTROLS = [
  {
    field: "contourDistanceFadeNearM",
    label: "Shrink near",
    fallback: 80,
    min: 5,
    max: 500,
    step: 5,
    decimals: 0,
  },
  {
    field: "contourDistanceFadeFarM",
    label: "Shrink far",
    fallback: 420,
    min: 20,
    max: 1200,
    step: 10,
    decimals: 0,
  },
  {
    field: "contourFarLineScale",
    label: "Far scale",
    fallback: 0.28,
    min: 0.03,
    max: 1,
    step: 0.01,
    decimals: 2,
  },
  {
    field: "contourFarOpacity",
    label: "Far opacity",
    fallback: 0.72,
    min: 0.05,
    max: 1,
    step: 0.01,
    decimals: 2,
  },
  {
    field: "contourLiftM",
    label: "Surface lift",
    fallback: 0,
    min: 0,
    max: 8,
    step: 0.05,
    decimals: 2,
  },
] as const satisfies readonly {
  field: keyof EditableStyle;
  label: string;
  fallback: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
}[];

export interface LayerGroupDef {
  title: string;
  ids: readonly string[];
}

export const PUBLIC_LAYER_GROUPS = [
  {
    title: "Topo map tile",
    ids: ["terrain", "bedrock-geology"],
  },
  {
    title: "Topo details",
    ids: [
      "hydrography-lakes",
      "hydrography-streams",
      "transport-roads",
      "power-lines",
      "property-neighbors",
      "trees-vri",
    ],
  },
] as const;

export const CUSTOMER_LAYER_GROUPS = [
  {
    title: "Drilling",
    ids: ["drillholes-2023", "drillholes-2024-tf"],
  },
  {
    title: "Assay Samples",
    ids: ["assay-samples"],
  },
  {
    title: "Geochemical Data",
    ids: ["geochem-soils-2024"],
  },
  {
    title: "Geophysical Data",
    ids: ["ip-survey-lines-2024"],
  },
  {
    title: "Hyperspectral",
    ids: ["hyperspectral-coverage-2024"],
  },
  {
    title: "Imagery Data",
    ids: ["imagery-lidar-aoi-2024"],
  },
  {
    title: "EZ Gamma",
    ids: ["ez-gamma-2024"],
  },
  {
    title: "Targets & Tenure",
    ids: [
      "megaton-dcip-anomaly",
      "three-firs-target",
      "great-plains-target",
      "claim-boundary",
    ],
  },
  {
    title: "Area Outlines",
    ids: ["area-outlines"],
  },
] as const;

export const CASE_STUDY_B_PUBLIC_LAYER_GROUPS = [
  {
    title: "Quarry base",
    ids: [
      "case-study-b-demo-shell",
      "quarry-imagery-base",
      "quarry-lidar-surface",
      "shahbazi-tls-subzone",
      "shahbazi-tls-tiled-preview",
      "shahbazi-tls-surface-preview",
      "shahbazi-photo-overlay-preview",
      "shahbazi-tls-contours",
    ],
  },
  {
    title: "Photogrammetry QA",
    ids: [
      "shahbazi-ground-control",
      "shahbazi-camera-poses",
      "shahbazi-camera-frustums",
      "shahbazi-dense-matching-links",
      "shahbazi-object-points",
      "shahbazi-tie-point-support-isolines",
    ],
  },
] as const satisfies readonly LayerGroupDef[];

export const CASE_STUDY_B_CUSTOMER_LAYER_GROUPS = [
  {
    title: "Demo technical overlays",
    ids: [
      "bench-conformance-overlay",
      "haul-route-equipment-demo",
      "stockpile-volume-zones",
      "quarry-drill-traces",
      "quarry-ore-grade-heatmap",
      "slope-stability-anomaly",
      "erosion-runoff-planning",
      "restoration-preview",
      "public-viewshed-overlay",
    ],
  },
] as const satisfies readonly LayerGroupDef[];

export const UTAH_FORGE_SCALAR_LAYER_IDS = new Set<string>([
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
]);

export function scalarControlTargetLabel(layerId: string): string {
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID) {
    return "MT full-density points";
  }
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    return "MT volume";
  }
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID) {
    return "MT authored slices";
  }
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID) {
    return "MT point preview";
  }
  return "this scalar layer";
}

export const SCALAR_RAMP_FIELDS = [
  "scalarColorLow",
  "scalarColorMid",
  "scalarColorHigh",
  "scalarBlendMin",
  "scalarBlendMax",
  "scalarDisplayMin",
  "scalarDisplayMax",
  "scalarFocusMin",
  "scalarFocusMax",
  "scalarInclusionMode",
  "scalarMidpoint",
  "scalarContrast",
  "scalarEdgeHighlight",
  "scalarEdgeColor",
  "scalarEdgeLowerValue",
  "scalarEdgeUpperValue",
  "scalarEdgeLineWidth",
  "scalarEdgeAverage",
  "scalarEdgeFillOffset",
  "scalarEdgeLineStyle",
  "scalarNoiseThreshold",
  "scalarSurfaceMaskEnabled",
  "scalarSurfaceMaskDepthM",
  "scalarSurfaceMaskFeatherM",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoLineStyle",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
] as const satisfies readonly (keyof EditableStyle)[];
export const SCALAR_LEGEND_FIELD =
  "scalarLegendVisible" as const satisfies keyof EditableStyle;
export const MT_TOP_SURFACE_FIELDS = [
  "meshSurfaceLiftM",
  "meshWireframe",
  "meshRoughness",
  "meshMetalness",
] as const satisfies readonly (keyof EditableStyle)[];
export const MT_VOLUME_FIELDS = [
  "scalarVolumeProductId",
  "scalarVolumeRenderMode",
  "scalarVolumeOpacity",
  "scalarVolumeDensity",
  "scalarVolumeSampleSteps",
  "scalarVolumeTransferMode",
  "scalarVolumeThresholdMin",
  "scalarVolumeThresholdMax",
  "scalarVolumeMaskVisible",
  "scalarColorLow",
  "scalarColorMid",
  "scalarColorHigh",
  "scalarBlendMin",
  "scalarBlendMax",
  "scalarDisplayMin",
  "scalarDisplayMax",
  "scalarFocusMin",
  "scalarFocusMax",
  "scalarMidpoint",
  "scalarContrast",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoLineStyle",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
  "scalarLegendVisible",
  "opacity",
] as const satisfies readonly (keyof EditableStyle)[];
export const ATMOSPHERE_VOLUME_FIELDS = [
  "atmosphereSubtype",
  "atmosphereBoundsMode",
  "atmosphereBoundsCenterX",
  "atmosphereBoundsCenterY",
  "atmosphereBoundsCenterZ",
  "atmosphereBoundsSizeX",
  "atmosphereBoundsSizeY",
  "atmosphereBoundsSizeZ",
  "atmosphereDensity",
  "atmosphereSoftness",
  "atmospherePuffCount",
  "atmospherePuffScaleM",
  "atmosphereScaleJitter",
  "atmosphereVerticalFalloff",
  "atmosphereEdgeFade",
  "atmosphereSeed",
  "atmosphereDriftEnabled",
  "atmosphereDriftSpeedMps",
  "atmosphereDriftDirectionX",
  "atmosphereDriftDirectionY",
  "atmosphereDriftDirectionZ",
  "atmosphereDepthTest",
  "atmosphereRenderOrder",
  "atmosphereBoundsHelperVisible",
  "color",
  "opacity",
] as const satisfies readonly (keyof EditableStyle)[];
export const MT_THRESHOLD_SURFACE_FIELDS = [
  "mtIsosurfaceProductId",
  "mtSurfaceBoundaryMode",
  "mtSurfaceBoundaryOrder",
  "mtSurfaceBoundariesById",
  "mtSurfaceBoundaryLegendVisible",
  "mtThresholdSurfaceVisibility",
  "mtThresholdSurfaceWireframe",
  "mtThresholdSurfaceRoughness",
  "mtThresholdSurfaceMetalness",
  "mtThresholdSurfaceSide",
  "mtThresholdSurfaceSmoothNormals",
  "mtThresholdSurfaceEmissiveBoost",
  "mtThresholdSurfaceWireframeColor",
  "mtThresholdSurfaceWireframeOpacity",
  "opacity",
] as const satisfies readonly (keyof EditableStyle)[];
export const SEISMIC_BROWSER_FIELDS = [
  "seismicAudienceMode",
  "seismicAudiencePresetId",
  "seismicCapabilityPresetId",
  "seismicDisplayRecipeId",
  "seismicProductId",
  "seismicProductVisibility",
  "seismicRenderMode",
  "seismicSliceAxis",
  "seismicSliceFraction",
  "seismicAmplitudeMin",
  "seismicAmplitudeMax",
  "seismicAmplitudeGamma",
  "seismicColormap",
  "seismicRemoveBackground",
  "seismicBackgroundCutoff",
  "seismicVolumeSampleSteps",
  "seismicTimeScale",
  "seismicNavigationVisible",
  "seismicSliceThroughVolume",
  "seismicComparisonProductId",
  "seismicComparisonMode",
  "seismicComparisonSpacingM",
  "seismicExportLayoutId",
  "seismicMtCoRender",
  "seismicNavigationRoleVisibility",
  "seismicLegendVisible",
  "sectionIsoEnabled",
  "sectionIsoLinesVisible",
  "sectionIsoBandsVisible",
  "sectionIsoTargetIds",
  "sectionIsoMin",
  "sectionIsoMax",
  "sectionIsoLevelCount",
  "sectionIsoLineWidth",
  "sectionIsoLineStyle",
  "sectionIsoBandOpacity",
  "sectionIsoFillOffset",
  "sectionIsoSourceOpacity",
  "opacity",
] as const satisfies readonly (keyof EditableStyle)[];
export const UTAH_FORGE_PUBLIC_LAYER_GROUPS = [
  {
    title: "Site Details",
    ids: [UTAH_FORGE_SITE_BOUNDARY_LAYER_ID],
  },
  {
    title: "Bore Holes",
    ids: [UTAH_FORGE_DEMO_BOREHOLES_LAYER_ID],
  },
  {
    title: "Seismic analysis",
    ids: [UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID],
  },
  {
    title: "MT resistivity",
    ids: [
      UTAH_FORGE_MT_STATIONS_LAYER_ID,
      UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
      UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
      UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
      UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
      UTAH_FORGE_MT_TOP_CONTACT_SURFACE_LAYER_ID,
      UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
      UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
    ],
  },
  {
    title: "Foundation",
    ids: ["utah-forge-reference-stage"],
  },
] as const satisfies readonly LayerGroupDef[];
export const UTAH_FORGE_SECTIONS_CROPPING_LAYER_GROUPS = [
  {
    title: "Working area",
    ids: [UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID],
  },
] as const satisfies readonly LayerGroupDef[];
export const PUBLIC_TOPO_LAYER_GROUP_TITLE = "Topo Settings";
export const UTAH_FORGE_CUSTOMER_LAYER_GROUPS =
  [] as const satisfies readonly LayerGroupDef[];

export const PUBLIC_LAYER_IDS: Set<string> = new Set(
  [
    ...PUBLIC_LAYER_GROUPS,
    ...CASE_STUDY_B_PUBLIC_LAYER_GROUPS,
    ...UTAH_FORGE_PUBLIC_LAYER_GROUPS,
  ].flatMap((group) => group.ids),
);
export const CUSTOMER_LAYER_IDS: Set<string> = new Set(
  [
    ...CUSTOMER_LAYER_GROUPS,
    ...CASE_STUDY_B_CUSTOMER_LAYER_GROUPS,
    ...UTAH_FORGE_CUSTOMER_LAYER_GROUPS,
  ].flatMap((group) => group.ids),
);
export const SECTIONS_CROPPING_LAYER_IDS: Set<string> = new Set(
  UTAH_FORGE_SECTIONS_CROPPING_LAYER_GROUPS.flatMap((group) => group.ids),
);

export const LINE_WIDTH_LAYER_DEFAULTS: Record<string, number> = {
  "hydrography-lakes": 1,
  "hydrography-streams": 1,
  "transport-roads": 2,
  "power-lines": 4,
  "shahbazi-camera-poses": 1.6,
  "shahbazi-camera-frustums": 1.1,
  "shahbazi-dense-matching-links": 1.15,
  "shahbazi-tls-contours": 1.35,
  "shahbazi-tie-point-support-isolines": 1.35,
  "ez-gamma-2024": 2.4,
  "ip-survey-lines-2024": 3.2,
  "imagery-lidar-aoi-2024": 3,
  [UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID]: 2.4,
  [UTAH_FORGE_SITE_BOUNDARY_LAYER_ID]: 3.2,
};

export const DEFAULT_FOG_DENSITY = 0.00018;
export const FOG_DENSITY_UI_MIN = 0.02;
export const FOG_DENSITY_UI_MAX = 6;
export const FOG_DENSITY_UI_STEP = 0.05;

export function layerStyleOpacityForActiveState(
  layerId: string,
  style: EditableStyle,
): number {
  const genericOpacity =
    typeof style.opacity === "number" && Number.isFinite(style.opacity)
      ? style.opacity
      : 1;
  if (layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID) {
    const volumeOpacity =
      typeof style.scalarVolumeOpacity === "number" &&
      Number.isFinite(style.scalarVolumeOpacity)
        ? style.scalarVolumeOpacity
        : 1;
    return Math.min(genericOpacity, volumeOpacity);
  }
  return genericOpacity;
}

export const LAND_TITLE_LABEL_TEXT_DEFAULT = "#fff4e6";
export const LAND_TITLE_LABEL_FILL_DEFAULT = "#2a2118";
export const LAND_TITLE_LABEL_OUTLINE_OPACITY_DEFAULT = 0.34;
export const LAND_TITLE_LABEL_FILL_OPACITY_DEFAULT = 0.82;

export function labelTextControlValue(style: EditableStyle): string {
  return (
    (style.labelTextColor as string | undefined) ??
    (style.labelKind === "landTitle"
      ? LAND_TITLE_LABEL_TEXT_DEFAULT
      : ((style.labelColor as string | undefined) ??
        (style.color as string | undefined) ??
        "#e6e2dc"))
  );
}

export function normalizeLabelKind(
  value: EditableStyle["labelKind"] | undefined,
): NonNullable<EditableStyle["labelKind"]> {
  return value === "landTitle" || value === "area" || value === "anomaly"
    ? value
    : "siteElement";
}

export function labelOutlineColorControlValue(style: EditableStyle): string {
  return (
    (style.labelOutlineColor as string | undefined) ??
    (style.labelColor as string | undefined) ??
    (style.color as string | undefined) ??
    "#e6e2dc"
  );
}

export function labelFillColorControlValue(style: EditableStyle): string {
  return (
    (style.labelFillColor as string | undefined) ??
    (style.labelKind === "landTitle"
      ? LAND_TITLE_LABEL_FILL_DEFAULT
      : "#14161c")
  );
}

export function labelOutlineOpacityControlValue(style: EditableStyle): number {
  return (
    (style.labelOutlineOpacity as number | undefined) ??
    (style.labelKind === "landTitle"
      ? LAND_TITLE_LABEL_OUTLINE_OPACITY_DEFAULT
      : 1)
  );
}

export function labelFillOpacityControlValue(style: EditableStyle): number {
  return (
    (style.labelFillOpacity as number | undefined) ??
    (style.labelKind === "landTitle"
      ? LAND_TITLE_LABEL_FILL_OPACITY_DEFAULT
      : 0.72)
  );
}

export function labelPointerVisibleControlValue(style: EditableStyle): boolean {
  return style.labelPointerVisible !== false;
}

export function layerDataSection(layer: ProjectLayerSpec): LayerDataSection {
  if (isTopoMapLayer(layer)) return "publicTopo";
  if (SECTIONS_CROPPING_LAYER_IDS.has(layer.id)) return "sectionsCropping";
  if (PUBLIC_LAYER_IDS.has(layer.id)) return "public";
  if (CUSTOMER_LAYER_IDS.has(layer.id)) return "customer";

  const metadata = layer.metadata as Record<string, unknown>;
  const text = [
    layer.id,
    layer.label,
    metadata.sourceOrigin,
    metadata.sourceFile,
    metadata.classification,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (
    text.includes("vizsla") ||
    text.includes("geosee internal") ||
    text.includes("target") ||
    text.includes("drill") ||
    text.includes("claim") ||
    text.includes("tenure") ||
    text.includes("anomaly") ||
    text.includes("interpretation")
  ) {
    return "customer";
  }
  return "public";
}
