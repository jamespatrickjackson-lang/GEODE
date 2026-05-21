import { useEffect, useRef, useState } from "react";
import { useEditor } from "./EditorContext";
import { usePageController } from "../pages/PageController";
import { ENVIRONMENT_SENTINEL } from "./types";
import {
  FROSTED_HAIRLINE,
  frostedSubheading,
  globalSettingsAccent,
  pageAccentForPage,
  panelStyles,
  thinLightMaterial,
  vibrancyLabel,
  vibrancySecondaryLabel,
  vibrancyTertiaryLabel,
} from "./styles";
import { convertBrandingAsset, writeFile } from "./save";
import {
  effectiveStyle,
  isStyleFieldOverridden,
  isVisibilityOverridden,
} from "../pages/effective";
import { renderPresetOptionsForEnvironment } from "../pages/renderPresets";
import type {
  EditableStyle,
  AreaOutlineDef,
  EnvironmentSetup,
  PresentationPage,
  ProjectLayerSpec,
  RenderPresetId,
  SceneProperties,
  SceneOverlayDef,
} from "../pages/types";
import type { SceneHandle } from "../scene";
import { DEFAULT_ASSAY_COLOR_STOPS } from "../loaders/assayPalette";
import { SCENE_ORIGIN } from "../constants";
import { appAssetUrl } from "../projects/projectPathsRuntime";
import {
  UTAH_FORGE_MT_STATIONS_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
  UTAH_FORGE_SCENE_SECTION_LAYER_ID,
  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
  UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
  UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
} from "../projectModules/utahForge/layerIds";

const CLASSIFICATIONS = [
  "observation",
  "interpretation",
  "narrative",
  "planned",
] as const;

const CONFIDENTIALITIES = ["public", "private"] as const;

type LayerDataSection = "public" | "publicTopo" | "customer";

const SHAHBAZI_GROUND_SURFACE_LAYER_ID = "shahbazi-tls-surface-preview";
const SHAHBAZI_GROUND_CONTOUR_LAYER_ID = "shahbazi-tls-contours";
const SURFACE_GRADIENT_DEFAULT_LOW = "#2cc9ff";
const SURFACE_GRADIENT_DEFAULT_MID = "#69f0b4";
const SURFACE_GRADIENT_DEFAULT_HIGH = "#f8dd6d";
const SURFACE_GRADIENT_FIELDS = [
  "surfaceGradientLowColor",
  "surfaceGradientMidColor",
  "surfaceGradientHighColor",
  "surfaceGradientMidpoint",
  "surfaceGradientContrast",
] as const satisfies readonly (keyof EditableStyle)[];

const CONTOUR_DISTANCE_STYLE_CONTROLS = [
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

interface LayerGroupDef {
  title: string;
  ids: readonly string[];
}

const PUBLIC_LAYER_GROUPS = [
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

const CUSTOMER_LAYER_GROUPS = [
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

const CASE_STUDY_B_PUBLIC_LAYER_GROUPS = [
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

const CASE_STUDY_B_CUSTOMER_LAYER_GROUPS = [
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

const WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY = 0.15;
const WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS = [
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
  UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
] as const;
const UTAH_FORGE_SCALAR_LAYER_IDS = new Set<string>([
  UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
  UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
]);

function scalarControlTargetLabel(layerId: string): string {
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

const SCALAR_RAMP_FIELDS = [
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
const SCALAR_LEGEND_FIELD =
  "scalarLegendVisible" as const satisfies keyof EditableStyle;
const MT_TOP_SURFACE_FIELDS = [
  "meshSurfaceLiftM",
  "meshWireframe",
  "meshRoughness",
  "meshMetalness",
] as const satisfies readonly (keyof EditableStyle)[];
const MT_VOLUME_FIELDS = [
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
const MT_THRESHOLD_SURFACE_FIELDS = [
  "mtThresholdSurfaceVisibility",
  "mtThresholdSurfaceWireframe",
  "opacity",
] as const satisfies readonly (keyof EditableStyle)[];
const SEISMIC_BROWSER_FIELDS = [
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
const SCALAR_SOURCE_MIN = -2;
const SCALAR_SOURCE_MAX = 4.5;
const UTAH_FORGE_PUBLIC_LAYER_GROUPS = [
  {
    title: "Working area",
    ids: [UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID],
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
      UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
      UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
    ],
  },
  {
    title: "Foundation",
    ids: ["utah-forge-reference-stage"],
  },
] as const satisfies readonly LayerGroupDef[];
const UTAH_FORGE_PUBLIC_TOPO_LAYER_GROUPS = [
  {
    title: "Topo layers",
    ids: [
      "terrain",
      UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
      "transport-roads",
      "hydrography-streams",
      "hydrography-lakes",
    ],
  },
] as const satisfies readonly LayerGroupDef[];
const UTAH_FORGE_CUSTOMER_LAYER_GROUPS =
  [] as const satisfies readonly LayerGroupDef[];

const UTAH_FORGE_RESISTIVITY_SLICE_OPTIONS = [
  { id: "horizontal_elev_1500m", label: "+1500 m horizontal" },
  { id: "horizontal_elev_0m", label: "0 m horizontal" },
  { id: "horizontal_elev_minus2500m", label: "-2500 m horizontal" },
  { id: "horizontal_elev_minus5000m", label: "-5000 m horizontal" },
  { id: "horizontal_elev_minus10000m", label: "-10000 m horizontal" },
  { id: "horizontal_elev_minus25000m", label: "-25000 m horizontal" },
  { id: "vertical_ew_station_centroid", label: "E-W centroid section" },
  { id: "vertical_ns_station_centroid", label: "N-S centroid section" },
] as const;

const CASE_STUDY_B_CONTROL_LAYER_IDS = new Set<string>([
  "case-study-b-demo-shell",
  "quarry-imagery-base",
  "quarry-lidar-surface",
  "bench-conformance-overlay",
  "haul-route-equipment-demo",
  "stockpile-volume-zones",
  "quarry-drill-traces",
  "quarry-ore-grade-heatmap",
  "slope-stability-anomaly",
  "erosion-runoff-planning",
  "restoration-preview",
  "public-viewshed-overlay",
]);

function layerHasRenderableControl(layer: ProjectLayerSpec): boolean {
  if ((layer as { disabled?: boolean }).disabled !== true) return true;
  return CASE_STUDY_B_CONTROL_LAYER_IDS.has(layer.id);
}

function layerIsPlaceholder(layer: ProjectLayerSpec): boolean {
  const metadata = layer.metadata as Record<string, unknown>;
  if (metadata.placeholder === true) return true;
  const text = [
    layer.label,
    metadata.sourceOrigin,
    metadata.sourceFile,
    metadata.notes,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return text.includes("placeholder") || text.includes("synthetic");
}

function stripForgeTerms(label: string): string {
  return label
    .replace(/\bUtah\s+FORGE\s+Phase\s*3\b/gi, "")
    .replace(/\bUtah\s+FORGE\b/gi, "")
    .replace(/\bFORGE[-\s]*/gi, "")
    .replace(/\bUtah\b/gi, "")
    .replace(/\bPhase\s*3\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function prefixMtDimension(label: string, dimension: "2D" | "3D"): string {
  const cleaned = stripForgeTerms(label);
  if (/^(2D|3D)\b/i.test(cleaned)) return cleaned;
  return `${dimension} ${cleaned}`;
}

function editorLayerLabel(layer: ProjectLayerSpec): string {
  const mtLabels: Record<string, string> = {
    [UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID]: "Phase 3 working area",
    [UTAH_FORGE_MT_STATIONS_LAYER_ID]: "2D MT station locations",
    [UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID]:
      "3D MT resistivity full-density model",
    [UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID]: "3D MT top surface",
    [UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID]: "3D MT resistivity preview",
    [UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID]: "2D MT resistivity slices",
    [UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID]: "3D MT resistivity volume",
    [UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID]: "3D MT threshold surfaces",
  };
  const label =
    layer.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID
      ? "Seismic browser"
      : (mtLabels[layer.id] ?? stripForgeTerms(layer.label.trim()));
  if (!layerIsPlaceholder(layer) || /\(placeholder\)$/i.test(label)) {
    return label;
  }
  return `${label} (placeholder)`;
}

const PUBLIC_LAYER_IDS: Set<string> = new Set(
  [
    ...PUBLIC_LAYER_GROUPS,
    ...CASE_STUDY_B_PUBLIC_LAYER_GROUPS,
    ...UTAH_FORGE_PUBLIC_LAYER_GROUPS,
    ...UTAH_FORGE_PUBLIC_TOPO_LAYER_GROUPS,
  ].flatMap((group) => group.ids),
);
const PUBLIC_SURFACE_CONTEXT_LAYER_IDS: Set<string> = new Set([
  "terrain",
  UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
  "transport-roads",
  "hydrography-streams",
  "hydrography-lakes",
]);
const PUBLIC_SURFACE_LAYER_IDS = [
  "terrain",
  UTAH_FORGE_TOPO_GRATICULE_LAYER_ID,
  "transport-roads",
  "hydrography-streams",
  "hydrography-lakes",
] as const;
const SURFACE_ELEVATION_DEFAULT_MIN_M = 1500;
const SURFACE_ELEVATION_DEFAULT_MAX_M = 3500;
const SURFACE_ELEVATION_DEFAULT_COLORS = [
  "#5147b8",
  "#2e8fd8",
  "#4fc3c7",
  "#93d66b",
  "#fff24d",
] as const;
const SURFACE_ELEVATION_DEFAULT_POSITIONS = [0, 0.25, 0.5, 0.75, 1] as const;
const SURFACE_ELEVATION_DEFAULT_MIDPOINTS = [0.5, 0.5, 0.5, 0.5] as const;
const SURFACE_ELEVATION_DEFAULT_SOFTNESS = 1;
const SURFACE_ELEVATION_DEFAULT_BLEND = 1;
const SURFACE_ELEVATION_STOP_GAP = 0.01;
const TOPO_MAP_BRANDING_DEFAULT_ANCHOR = "south-east";
const TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M = 0;
const TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M = -85_000;
const TITLE_BLOCK_UPLOAD_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.gif,.svg,.pdf,.eps,image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf,application/postscript";
const TITLE_BLOCK_DIRECT_IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
]);
const TITLE_BLOCK_CONVERTED_EXTENSIONS = new Set(["pdf", "eps"]);
type PublicTopoMaterialPresetId =
  | "custom"
  | "soft-topo"
  | "surface-elevation"
  | "desert-relief"
  | "paper-map"
  | "grey-relief"
  | "high-contrast";
const PUBLIC_TOPO_MATERIAL_PRESETS: readonly {
  value: PublicTopoMaterialPresetId;
  label: string;
  patch?: NonNullable<SceneProperties["terrain"]>;
}[] = [
  { value: "custom", label: "Custom" },
  {
    value: "soft-topo",
    label: "Soft topo",
    patch: {
      materialPreset: "soft-topo",
      rampLow: "#575145",
      rampMid: "#958a72",
      rampHigh: "#d9cba3",
      elevLowM: 0,
      elevHighM: 180,
      hillshadeIntensity: 0.86,
      shadowSharpness: 0.28,
      facetStrength: 0.04,
      edgeFadeDistanceM: 90_000,
      edgeFadeShape: "square",
      edgeFadeInsetM: 0,
      edgeFadeCornerRadiusM: 0,
      rockHueVariance: 0.03,
      shadowTint: "#3f4650",
      surfaceElevationEnabled: false,
    },
  },
  {
    value: "surface-elevation",
    label: "Surface elevation",
    patch: {
      materialPreset: "surface-elevation",
      rampLow: "#575145",
      rampMid: "#958a72",
      rampHigh: "#d9cba3",
      elevLowM: 0,
      elevHighM: 180,
      hillshadeIntensity: 0.86,
      shadowSharpness: 0.34,
      facetStrength: 0.04,
      edgeFadeDistanceM: 90_000,
      edgeFadeShape: "square",
      edgeFadeInsetM: 0,
      edgeFadeCornerRadiusM: 0,
      rockHueVariance: 0,
      shadowTint: "#303640",
      surfaceElevationEnabled: true,
      surfaceElevationLegendVisible: true,
      surfaceElevationMinM: SURFACE_ELEVATION_DEFAULT_MIN_M,
      surfaceElevationMaxM: SURFACE_ELEVATION_DEFAULT_MAX_M,
      surfaceElevationColors: [...SURFACE_ELEVATION_DEFAULT_COLORS],
      surfaceElevationColorPositions: [...SURFACE_ELEVATION_DEFAULT_POSITIONS],
      surfaceElevationMidpoints: [...SURFACE_ELEVATION_DEFAULT_MIDPOINTS],
      surfaceElevationTransitionSoftness: SURFACE_ELEVATION_DEFAULT_SOFTNESS,
      surfaceElevationColorBlend: SURFACE_ELEVATION_DEFAULT_BLEND,
      surfaceElevationReverse: false,
    },
  },
  {
    value: "desert-relief",
    label: "Desert relief",
    patch: {
      materialPreset: "desert-relief",
      rampLow: "#4f4a40",
      rampMid: "#8a7e68",
      rampHigh: "#d7c69e",
      elevLowM: 0,
      elevHighM: 120,
      hillshadeIntensity: 1.05,
      shadowSharpness: 0.5,
      facetStrength: 0.12,
      edgeFadeDistanceM: 80_000,
      edgeFadeShape: "square",
      edgeFadeInsetM: 0,
      edgeFadeCornerRadiusM: 0,
      rockHueVariance: 0.05,
      shadowTint: "#303640",
      surfaceElevationEnabled: false,
    },
  },
  {
    value: "paper-map",
    label: "Paper map",
    patch: {
      materialPreset: "paper-map",
      rampLow: "#706a5b",
      rampMid: "#aea282",
      rampHigh: "#e4d8b1",
      elevLowM: -100,
      elevHighM: 250,
      hillshadeIntensity: 0.72,
      shadowSharpness: 0.18,
      facetStrength: 0.02,
      edgeFadeDistanceM: 120_000,
      edgeFadeShape: "square",
      edgeFadeInsetM: 0,
      edgeFadeCornerRadiusM: 0,
      rockHueVariance: 0.015,
      shadowTint: "#56524a",
      surfaceElevationEnabled: false,
    },
  },
  {
    value: "grey-relief",
    label: "Grey relief",
    patch: {
      materialPreset: "grey-relief",
      rampLow: "#515151",
      rampMid: "#9a9a93",
      rampHigh: "#dad8cf",
      elevLowM: -100,
      elevHighM: 300,
      hillshadeIntensity: 0.92,
      shadowSharpness: 0.38,
      facetStrength: 0.06,
      edgeFadeDistanceM: 85_000,
      edgeFadeShape: "square",
      edgeFadeInsetM: 0,
      edgeFadeCornerRadiusM: 0,
      rockHueVariance: 0.005,
      shadowTint: "#3f464f",
      surfaceElevationEnabled: false,
    },
  },
  {
    value: "high-contrast",
    label: "High contrast",
    patch: {
      materialPreset: "high-contrast",
      rampLow: "#423b31",
      rampMid: "#8f7f5f",
      rampHigh: "#f0ddaa",
      elevLowM: -100,
      elevHighM: 220,
      hillshadeIntensity: 1.35,
      shadowSharpness: 0.72,
      facetStrength: 0.22,
      edgeFadeDistanceM: 70_000,
      edgeFadeShape: "square",
      edgeFadeInsetM: 0,
      edgeFadeCornerRadiusM: 0,
      rockHueVariance: 0.07,
      shadowTint: "#262b34",
      surfaceElevationEnabled: false,
    },
  },
];
const CUSTOMER_LAYER_IDS: Set<string> = new Set(
  [
    ...CUSTOMER_LAYER_GROUPS,
    ...CASE_STUDY_B_CUSTOMER_LAYER_GROUPS,
    ...UTAH_FORGE_CUSTOMER_LAYER_GROUPS,
  ].flatMap((group) => group.ids),
);

const LINE_WIDTH_LAYER_DEFAULTS: Record<string, number> = {
  [UTAH_FORGE_TOPO_GRATICULE_LAYER_ID]: 1.15,
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
};

const DEFAULT_FOG_DENSITY = 0.00018;
const FOG_DENSITY_UI_MIN = 0.02;
const FOG_DENSITY_UI_MAX = 6;
const FOG_DENSITY_UI_STEP = 0.05;

const LABEL_KIND_OPTIONS = [
  { value: "siteElement", label: "Site element" },
  { value: "landTitle", label: "Land title" },
  { value: "area", label: "Area" },
  { value: "anomaly", label: "Anomaly" },
] as const;

const LABEL_POINTER_SIDE_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
] as const;

const AREA_OUTLINE_MODE_OPTIONS = [
  { value: "terrain3d", label: "3D terrain" },
  { value: "flat2d", label: "2D flat" },
] as const;

const GEOCHEM_ELEMENT_OPTIONS = [
  { value: "cu_ppm", label: "Cu ppm" },
  { value: "au_ppm", label: "Au ppm" },
  { value: "mo_ppm", label: "Mo ppm" },
  { value: "ag_ppm", label: "Ag ppm" },
  { value: "as_ppm", label: "As ppm" },
  { value: "zn_ppm", label: "Zn ppm" },
  { value: "pb_ppm", label: "Pb ppm" },
  { value: "ni_ppm", label: "Ni ppm" },
] as const;

const LAND_TITLE_LABEL_TEXT_DEFAULT = "#fff4e6";
const LAND_TITLE_LABEL_FILL_DEFAULT = "#2a2118";
const LAND_TITLE_LABEL_OUTLINE_OPACITY_DEFAULT = 0.34;
const LAND_TITLE_LABEL_FILL_OPACITY_DEFAULT = 0.82;

function labelTextControlValue(style: EditableStyle): string {
  return (
    (style.labelTextColor as string | undefined) ??
    (style.labelKind === "landTitle"
      ? LAND_TITLE_LABEL_TEXT_DEFAULT
      : ((style.labelColor as string | undefined) ??
        (style.color as string | undefined) ??
        "#e6e2dc"))
  );
}

function normalizeLabelKind(
  value: EditableStyle["labelKind"] | undefined,
): NonNullable<EditableStyle["labelKind"]> {
  return value === "landTitle" || value === "area" || value === "anomaly"
    ? value
    : "siteElement";
}

function labelOutlineColorControlValue(style: EditableStyle): string {
  return (
    (style.labelOutlineColor as string | undefined) ??
    (style.labelColor as string | undefined) ??
    (style.color as string | undefined) ??
    "#e6e2dc"
  );
}

function labelFillColorControlValue(style: EditableStyle): string {
  return (
    (style.labelFillColor as string | undefined) ??
    (style.labelKind === "landTitle"
      ? LAND_TITLE_LABEL_FILL_DEFAULT
      : "#14161c")
  );
}

function labelOutlineOpacityControlValue(style: EditableStyle): number {
  return (
    (style.labelOutlineOpacity as number | undefined) ??
    (style.labelKind === "landTitle"
      ? LAND_TITLE_LABEL_OUTLINE_OPACITY_DEFAULT
      : 1)
  );
}

function labelFillOpacityControlValue(style: EditableStyle): number {
  return (
    (style.labelFillOpacity as number | undefined) ??
    (style.labelKind === "landTitle"
      ? LAND_TITLE_LABEL_FILL_OPACITY_DEFAULT
      : 0.72)
  );
}

function labelPointerVisibleControlValue(style: EditableStyle): boolean {
  return style.labelPointerVisible !== false;
}

function layerDataSection(layer: ProjectLayerSpec): LayerDataSection {
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

// LayerPanel has two modes driven by selectedPageId:
//   "environment"      -> editing the base; controls write env.layerStyles
//                         and env.defaultVisibleLayers directly. No
//                         inherited/overridden state.
//   "<page id>"        -> editing a presentation page. Each control has a
//                         small override checkbox; if off, the row shows
//                         the inherited value (greyed); if on, the control
//                         is active and edits page.layerOverrides.

export function LayerPanel({
  section = "customer",
}: {
  section?: LayerDataSection;
}) {
  const {
    state,
    sceneHandle,
    setEnvLayerStyle,
    toggleEnvDefaultVisible,
    setLayerProvenance,
    setPageLayerOverride,
    clearPageLayerOverride,
    setPageVisibilityOverride,
    clearPageVisibilityOverride,
    setPageField,
    setEnvScene,
  } = useEditor();

  const isEnv = state.selectedPageId === ENVIRONMENT_SENTINEL;
  const currentPage = isEnv
    ? null
    : (state.pages.find((p) => p.id === state.selectedPageId) ?? null);
  const { currentIndex, isTransitioning, targetIndex } = usePageController();
  const selectedPageIndex = currentPage
    ? state.pages.findIndex((p) => p.id === currentPage.id)
    : -1;
  const selectedPageHasLanded =
    selectedPageIndex >= 0 &&
    selectedPageIndex === currentIndex &&
    !isTransitioning &&
    targetIndex === null;
  const selectedPageAccent =
    selectedPageIndex >= 0
      ? pageAccentForPage(
          currentPage!,
          selectedPageIndex,
          selectedPageHasLanded ? 0.62 : 0.24,
        )
      : isEnv
        ? globalSettingsAccent
        : null;

  const renderLayer = (layer: ProjectLayerSpec, index = 0) => {
    const meta = layer.metadata as Record<string, string | undefined>;
    const envStyle = state.environment.layerStyles[layer.id] ?? {};
    const envVisible = state.environment.defaultVisibleLayers.includes(
      layer.id,
    );
    const effectiveLayerVisible = currentPage
      ? isVisibilityOverridden(currentPage, layer.id)
        ? currentPage.visibilityOverrides?.[layer.id] === true
        : envVisible
      : envVisible;
    const isGeology = layer.id === "bedrock-geology";
    const isTrees = layer.id === "trees-vri";
    const isEzGamma = layer.id === "ez-gamma-2024";
    const isGeochem = layer.id === "geochem-soils-2024";
    const isHyperspectral = layer.id === "hyperspectral-coverage-2024";
    const isImageryLidar = layer.id === "imagery-lidar-aoi-2024";
    const isAreaOutlines = layer.id === "area-outlines";
    const isShahbaziGroundSurface =
      layer.id === SHAHBAZI_GROUND_SURFACE_LAYER_ID;
    const isShahbaziGroundContours =
      layer.id === SHAHBAZI_GROUND_CONTOUR_LAYER_ID;
    const isPointCloud = layer.type === "pointcloud";
    const isUtahForgeStationMarkers =
      layer.id === UTAH_FORGE_MT_STATIONS_LAYER_ID;
    const isUtahForgeScalarLayer = UTAH_FORGE_SCALAR_LAYER_IDS.has(layer.id);
    const isUtahForgeFullDensityScalarLayer =
      layer.id === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID;
    const isUtahForgeTopSurface =
      layer.id === UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID;
    const isUtahForgeResistivitySlices =
      layer.id === UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID;
    const isUtahForgeMtVolume =
      layer.id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID;
    const isUtahForgeMtThresholdSurfaces =
      layer.id === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID;
    const isUtahForgeSeismicBrowser =
      layer.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID;
    const isUtahForgeTopoGraticule =
      layer.id === UTAH_FORGE_TOPO_GRATICULE_LAYER_ID;
    const isPublicTerrainSurface = layer.id === "terrain";
    const isPublicSurfaceContextLayer = PUBLIC_SURFACE_CONTEXT_LAYER_IDS.has(
      layer.id,
    );
    const isLakes = layer.id === "hydrography-lakes";
    const hasInfillAndOutline = isLakes || isImageryLidar;
    const isStreams = layer.id === "hydrography-streams";
    const lineWidthDefault = LINE_WIDTH_LAYER_DEFAULTS[layer.id];
    const supportsLineWidth = lineWidthDefault !== undefined;
    const globalFogDensity =
      state.environment.scene?.fog?.density ?? DEFAULT_FOG_DENSITY;
    const envAffectedByFog = envStyle.affectedByFog !== false;
    const effectiveLayerStyle = currentPage
      ? effectiveStyle(state.environment, currentPage, layer.id)
      : envStyle;
    const effectiveSceneSectionStyle = currentPage
      ? effectiveStyle(
          state.environment,
          currentPage,
          UTAH_FORGE_SCENE_SECTION_LAYER_ID,
        )
      : (state.environment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID] ??
        {});
    const effectiveAffectedByFog = effectiveLayerStyle.affectedByFog !== false;
    const surfaceGradientOverridden =
      currentPage !== null &&
      SURFACE_GRADIENT_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const scalarRampOverridden =
      currentPage !== null &&
      SCALAR_RAMP_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const mtTopSurfaceOverridden =
      currentPage !== null &&
      MT_TOP_SURFACE_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const mtVolumeOverridden =
      currentPage !== null &&
      MT_VOLUME_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const mtThresholdSurfaceOverridden =
      currentPage !== null &&
      MT_THRESHOLD_SURFACE_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );
    const seismicBrowserOverridden =
      currentPage !== null &&
      SEISMIC_BROWSER_FIELDS.some((field) =>
        isStyleFieldOverridden(currentPage, layer.id, field),
      );

    return (
      <div
        key={layer.id}
        data-dev-source="src/editor/LayerPanel.tsx:937"
        data-dev-note="layerItemStyle controls spacing and separators for individual layer rows."
        style={{
          ...layerItemStyle,
          ...(index === 0 ? firstLayerItemStyle : {}),
        }}
      >
        <div style={panelStyles.sectionHeader}>
          <div
            style={panelStyles.checkboxRow}
            data-dev-source="src/editor/styles.ts:82"
            data-dev-note="panelStyles.checkboxRow controls layer-title row alignment."
          >
            <span
              style={{
                ...panelStyles.layerLabel,
                color: effectiveLayerVisible
                  ? vibrancyLabel
                  : vibrancyTertiaryLabel,
              }}
              data-dev-text-source="src/editor/LayerPanel.tsx:116"
            >
              {editorLayerLabel(layer)}
            </span>
          </div>
          <span
            style={{
              ...panelStyles.layerType,
              color: effectiveLayerVisible
                ? vibrancySecondaryLabel
                : vibrancyTertiaryLabel,
            }}
          >
            {layer.type}
          </span>
        </div>

        <div
          style={layerControlsStyle}
          data-dev-source="src/editor/LayerPanel.tsx:946"
          data-dev-note="layerControlsStyle controls indentation of Visible, Appearance, Labels, and Provenance under each layer."
        >
          {isTrees && isEnv ? (
            <EnvTreeVisibilityToggle
              visible={envVisible}
              onToggle={() => toggleEnvDefaultVisible(layer.id)}
            />
          ) : isTrees && currentPage ? (
            <PageTreeVisibilityToggle
              page={currentPage}
              layerId={layer.id}
              envVisible={envVisible}
              onSet={(v) =>
                setPageVisibilityOverride(currentPage.id, layer.id, v)
              }
              onClear={() =>
                clearPageVisibilityOverride(currentPage.id, layer.id)
              }
            />
          ) : isEnv ? (
            <EnvVisibilityRow
              visible={envVisible}
              onToggle={() => toggleEnvDefaultVisible(layer.id)}
            />
          ) : currentPage ? (
            <PageVisibilityRow
              page={currentPage}
              layerId={layer.id}
              envVisible={envVisible}
              onSet={(v) =>
                setPageVisibilityOverride(currentPage.id, layer.id, v)
              }
              onClear={() =>
                clearPageVisibilityOverride(currentPage.id, layer.id)
              }
            />
          ) : null}

          {effectiveLayerVisible ? (
            <>
              {!isAreaOutlines ? (
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Appearance</summary>
                  <div style={detailsContentStyle}>
                    {!isUtahForgeSeismicBrowser &&
                    !isPublicTerrainSurface &&
                    isEnv ? (
                      <EnvStyleRow
                        label={hasInfillAndOutline ? "Infill color" : "Color"}
                        inputType="color"
                        value={(envStyle.color as string) ?? "#cccccc"}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, { color: v })
                        }
                      />
                    ) : !isUtahForgeSeismicBrowser &&
                      !isPublicTerrainSurface &&
                      currentPage ? (
                      <PageStyleRow
                        label={hasInfillAndOutline ? "Infill color" : "Color"}
                        inputType="color"
                        inheritedValue={
                          effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).color as string | undefined
                        }
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "color",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]?.color as
                            | string
                            | undefined
                        }
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            color: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "color",
                          )
                        }
                      />
                    ) : null}

                    {hasInfillAndOutline && isEnv ? (
                      <EnvStyleRow
                        label="Infill opacity"
                        inputType="range"
                        value={String(
                          (envStyle.fillOpacity as number | undefined) ??
                            (envStyle.opacity as number | undefined) ??
                            1,
                        )}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            fillOpacity: parseFloat(v),
                          })
                        }
                      />
                    ) : hasInfillAndOutline && currentPage ? (
                      <PageStyleRow
                        label="Infill opacity"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).fillOpacity as number | undefined) ??
                            (effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).opacity as number | undefined) ??
                            1,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "fillOpacity",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.fillOpacity !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .fillOpacity,
                              )
                            : undefined
                        }
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            fillOpacity: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "fillOpacity",
                          )
                        }
                      />
                    ) : null}

                    {hasInfillAndOutline && isEnv ? (
                      <EnvStyleRow
                        label="Outline color"
                        inputType="color"
                        value={
                          (envStyle.outlineColor as string | undefined) ??
                          (envStyle.color as string | undefined) ??
                          "#111111"
                        }
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, { outlineColor: v })
                        }
                      />
                    ) : hasInfillAndOutline && currentPage ? (
                      <PageStyleRow
                        label="Outline color"
                        inputType="color"
                        inheritedValue={
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).outlineColor as string | undefined) ??
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).color as string | undefined)
                        }
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "outlineColor",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.outlineColor as string | undefined
                        }
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            outlineColor: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "outlineColor",
                          )
                        }
                      />
                    ) : null}

                    {isEnv ? (
                      <EnvStyleRow
                        label={
                          hasInfillAndOutline ? "Outline opacity" : "Opacity"
                        }
                        inputType="range"
                        value={String(
                          (envStyle.opacity as number | undefined) ?? 1,
                        )}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, { opacity: parseFloat(v) })
                        }
                      />
                    ) : currentPage ? (
                      <PageStyleRow
                        label={
                          hasInfillAndOutline ? "Outline opacity" : "Opacity"
                        }
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).opacity as number | undefined) ?? 1,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "opacity",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]?.opacity !==
                          undefined
                            ? String(
                                currentPage.layerOverrides[layer.id].opacity,
                              )
                            : undefined
                        }
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            opacity: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "opacity",
                          )
                        }
                      />
                    ) : null}

                    {isShahbaziGroundSurface ? (
                      <SurfaceGradientControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        disabled={!isEnv && !surfaceGradientOverridden}
                        isPageOverride={!isEnv}
                        overridden={surfaceGradientOverridden}
                        onToggleOverride={
                          currentPage
                            ? (enabled) => {
                                if (enabled) {
                                  setPageLayerOverride(
                                    currentPage.id,
                                    layer.id,
                                    surfaceGradientPatchFromStyle(
                                      effectiveLayerStyle,
                                    ),
                                  );
                                } else {
                                  for (const field of SURFACE_GRADIENT_FIELDS) {
                                    clearPageLayerOverride(
                                      currentPage.id,
                                      layer.id,
                                      field,
                                    );
                                  }
                                }
                              }
                            : undefined
                        }
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isUtahForgeScalarLayer ? (
                      <ScalarRampControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        targetLabel={scalarControlTargetLabel(layer.id)}
                        fullDensityMode={isUtahForgeFullDensityScalarLayer}
                        disabled={!isEnv && !scalarRampOverridden}
                        isPageOverride={!isEnv}
                        overridden={scalarRampOverridden}
                        volumeThresholdMode={isUtahForgeMtVolume}
                        onToggleOverride={
                          currentPage
                            ? (enabled) => {
                                if (enabled) {
                                  setPageLayerOverride(
                                    currentPage.id,
                                    layer.id,
                                    scalarRampPatchFromStyle(
                                      effectiveLayerStyle,
                                    ),
                                  );
                                } else {
                                  for (const field of SCALAR_RAMP_FIELDS) {
                                    clearPageLayerOverride(
                                      currentPage.id,
                                      layer.id,
                                      field,
                                    );
                                  }
                                }
                              }
                            : undefined
                        }
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isUtahForgeTopSurface ? (
                      <MtTopSurfaceControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        disabled={!isEnv && !mtTopSurfaceOverridden}
                        isPageOverride={!isEnv}
                        overridden={mtTopSurfaceOverridden}
                        onToggleOverride={
                          currentPage
                            ? (enabled) => {
                                if (enabled) {
                                  setPageLayerOverride(
                                    currentPage.id,
                                    layer.id,
                                    mtTopSurfacePatchFromStyle(
                                      effectiveLayerStyle,
                                    ),
                                  );
                                } else {
                                  for (const field of MT_TOP_SURFACE_FIELDS) {
                                    clearPageLayerOverride(
                                      currentPage.id,
                                      layer.id,
                                      field,
                                    );
                                  }
                                }
                              }
                            : undefined
                        }
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isUtahForgeScalarLayer ? (
                      <LayerBooleanStyleControl
                        label="Value legend"
                        field={SCALAR_LEGEND_FIELD}
                        fallback={true}
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        isEnv={isEnv}
                        currentPage={currentPage}
                        layerId={layer.id}
                        setEnvLayerStyle={setEnvLayerStyle}
                        setPageLayerOverride={setPageLayerOverride}
                        clearPageLayerOverride={clearPageLayerOverride}
                      />
                    ) : null}

                    {isUtahForgeFullDensityScalarLayer ? (
                      <LayerNumberStyleControl
                        label="Distance light"
                        field="scalarDistanceLightStrength"
                        fallback={0.35}
                        min={0}
                        max={1}
                        step={0.01}
                        decimals={2}
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        isEnv={isEnv}
                        currentPage={currentPage}
                        layerId={layer.id}
                        setEnvLayerStyle={setEnvLayerStyle}
                        setPageLayerOverride={setPageLayerOverride}
                        clearPageLayerOverride={clearPageLayerOverride}
                      />
                    ) : null}

                    {isUtahForgeFullDensityScalarLayer ? (
                      <ScalarPointDrawReadout
                        sceneHandle={sceneHandle}
                        layerId={layer.id}
                        inclusionMode={
                          effectiveLayerStyle.scalarInclusionMode ===
                          "thresholded"
                            ? "thresholded"
                            : "all-valid"
                        }
                      />
                    ) : null}

                    {isUtahForgeStationMarkers ? (
                      <>
                        <PointMarkerControls
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <MtStationQcControls
                          layer={layer}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                      </>
                    ) : null}

                    {isPointCloud && isEnv ? (
                      <EnvStyleRow
                        label="Point size"
                        inputType="range"
                        value={String(
                          (envStyle.pointSizePx as number | undefined) ?? 4,
                        )}
                        min={1}
                        max={12}
                        step={0.25}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            pointSizePx: parseFloat(v),
                          })
                        }
                      />
                    ) : isPointCloud && currentPage ? (
                      <PageStyleRow
                        label="Point size"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).pointSizePx as number | undefined) ?? 4,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "pointSizePx",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.pointSizePx !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .pointSizePx,
                              )
                            : undefined
                        }
                        min={1}
                        max={12}
                        step={0.25}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            pointSizePx: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "pointSizePx",
                          )
                        }
                      />
                    ) : null}

                    {isTrees && isEnv ? (
                      <EnvStyleRow
                        label="Edge cut"
                        inputType="range"
                        value={String(
                          (envStyle.forestEdgeThreshold as
                            | number
                            | undefined) ?? 0.5,
                        )}
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            forestEdgeThreshold: parseFloat(v),
                          })
                        }
                      />
                    ) : isTrees && currentPage ? (
                      <PageStyleRow
                        label="Edge cut"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.forestEdgeThreshold as
                            | number
                            | undefined) ?? 0.5,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "forestEdgeThreshold",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.forestEdgeThreshold !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .forestEdgeThreshold,
                              )
                            : undefined
                        }
                        fallbackValue="0.5"
                        min={0.05}
                        max={0.95}
                        step={0.01}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            forestEdgeThreshold: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "forestEdgeThreshold",
                          )
                        }
                      />
                    ) : null}

                    {isTrees && isEnv ? (
                      <EnvStyleRow
                        label="Edge soft"
                        inputType="range"
                        value={String(
                          (envStyle.forestEdgeSoftness as number | undefined) ??
                            0.035,
                        )}
                        min={0}
                        max={0.25}
                        step={0.005}
                        decimals={3}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            forestEdgeSoftness: parseFloat(v),
                          })
                        }
                      />
                    ) : isTrees && currentPage ? (
                      <PageStyleRow
                        label="Edge soft"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.forestEdgeSoftness as
                            | number
                            | undefined) ?? 0.035,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "forestEdgeSoftness",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.forestEdgeSoftness !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .forestEdgeSoftness,
                              )
                            : undefined
                        }
                        fallbackValue="0.035"
                        min={0}
                        max={0.25}
                        step={0.005}
                        decimals={3}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            forestEdgeSoftness: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "forestEdgeSoftness",
                          )
                        }
                      />
                    ) : null}

                    {!isPublicSurfaceContextLayer && isEnv ? (
                      <EnvAffectedByFogRow
                        value={envAffectedByFog}
                        onToggle={() =>
                          setEnvLayerStyle(layer.id, {
                            affectedByFog: !envAffectedByFog,
                          })
                        }
                      />
                    ) : !isPublicSurfaceContextLayer && currentPage ? (
                      <PageAffectedByFogRow
                        page={currentPage}
                        layerId={layer.id}
                        envValue={envStyle.affectedByFog !== false}
                        onSet={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            affectedByFog: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "affectedByFog",
                          )
                        }
                      />
                    ) : null}

                    {!isPublicSurfaceContextLayer &&
                    envAffectedByFog &&
                    isEnv ? (
                      <EnvStyleRow
                        label="Fog dens."
                        inputType="range"
                        value={String(
                          ((envStyle.fogDensity as number | undefined) ??
                            globalFogDensity) * 10000,
                        )}
                        min={FOG_DENSITY_UI_MIN}
                        max={FOG_DENSITY_UI_MAX}
                        step={FOG_DENSITY_UI_STEP}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            fogDensity: parseFloat(v) / 10000,
                          })
                        }
                      />
                    ) : !isPublicSurfaceContextLayer &&
                      effectiveAffectedByFog &&
                      currentPage ? (
                      <PageStyleRow
                        label="Fog dens."
                        inputType="range"
                        inheritedValue={String(
                          ((effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).fogDensity as number | undefined) ??
                            globalFogDensity) * 10000,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "fogDensity",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]?.fogDensity !==
                          undefined
                            ? String(
                                (currentPage.layerOverrides[layer.id]
                                  .fogDensity as number) * 10000,
                              )
                            : undefined
                        }
                        fallbackValue={String(globalFogDensity * 10000)}
                        min={FOG_DENSITY_UI_MIN}
                        max={FOG_DENSITY_UI_MAX}
                        step={FOG_DENSITY_UI_STEP}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            fogDensity: parseFloat(v) / 10000,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "fogDensity",
                          )
                        }
                      />
                    ) : null}

                    {supportsLineWidth && !isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Line width"
                        inputType="range"
                        value={String(
                          (envStyle.lineWidth as number | undefined) ??
                            lineWidthDefault,
                        )}
                        min={0.5}
                        max={6}
                        step={0.25}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            lineWidth: parseFloat(v),
                          })
                        }
                      />
                    ) : supportsLineWidth && !isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Line width"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).lineWidth as number | undefined) ??
                            lineWidthDefault,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "lineWidth",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]?.lineWidth !==
                          undefined
                            ? String(
                                currentPage.layerOverrides[layer.id].lineWidth,
                              )
                            : undefined
                        }
                        fallbackValue={String(lineWidthDefault)}
                        min={0.5}
                        max={6}
                        step={0.25}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            lineWidth: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "lineWidth",
                          )
                        }
                      />
                    ) : null}

                    {isUtahForgeTopoGraticule ? (
                      <>
                        <LayerBooleanStyleControl
                          label="Labels"
                          field="graticuleLabelVisible"
                          fallback={true}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerNumberStyleControl
                          label="Label size"
                          field="graticuleLabelSizeM"
                          fallback={9000}
                          min={1500}
                          max={60000}
                          step={500}
                          decimals={0}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerNumberStyleControl
                          label="Surface lift"
                          field="graticuleLiftM"
                          fallback={24}
                          min={0}
                          max={500}
                          step={4}
                          decimals={0}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerBooleanStyleControl
                          label="Edge fade aware"
                          field="graticuleEdgeFadeAware"
                          fallback={true}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerNumberStyleControl
                          label="Edge strength"
                          field="graticuleEdgeFadeStrength"
                          fallback={1}
                          min={0}
                          max={1}
                          step={0.05}
                          decimals={2}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-strength"
                        />
                        <LayerColorStyleControl
                          label="Edge line"
                          field="graticuleEdgeLineColor"
                          fallback="#ffffff"
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-line-color"
                        />
                        <LayerNumberStyleControl
                          label="Edge line weight"
                          field="graticuleEdgeLineWidth"
                          fallback={4.75}
                          min={0.1}
                          max={32}
                          step={0.25}
                          decimals={2}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-line-width"
                        />
                        <LayerColorStyleControl
                          label="Edge label"
                          field="graticuleEdgeLabelColor"
                          fallback="#ffffff"
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-label-color"
                        />
                        <LayerBooleanStyleControl
                          label="Fade labels"
                          field="graticuleEdgeLabelVisible"
                          fallback={true}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                        />
                        <LayerNumberStyleControl
                          label="Label offset"
                          field="graticuleEdgeLabelOffsetM"
                          fallback={90000}
                          min={0}
                          max={160000}
                          step={1000}
                          decimals={0}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-label-offset"
                        />
                        <LayerNumberStyleControl
                          label="Label gap"
                          field="graticuleEdgeLabelGapM"
                          fallback={22000}
                          min={-100000}
                          max={100000}
                          step={1000}
                          decimals={0}
                          style={isEnv ? envStyle : effectiveLayerStyle}
                          isEnv={isEnv}
                          currentPage={currentPage}
                          layerId={layer.id}
                          setEnvLayerStyle={setEnvLayerStyle}
                          setPageLayerOverride={setPageLayerOverride}
                          clearPageLayerOverride={clearPageLayerOverride}
                          testId="topo-graticule-edge-label-gap"
                        />
                      </>
                    ) : null}

                    {isShahbaziGroundContours
                      ? CONTOUR_DISTANCE_STYLE_CONTROLS.map((control) =>
                          isEnv ? (
                            <EnvStyleRow
                              key={control.field}
                              label={control.label}
                              inputType="range"
                              value={String(
                                styleNumber(
                                  envStyle,
                                  control.field,
                                  control.fallback,
                                ),
                              )}
                              min={control.min}
                              max={control.max}
                              step={control.step}
                              decimals={control.decimals}
                              onChange={(v) =>
                                setEnvLayerStyle(layer.id, {
                                  [control.field]: parseFloat(v),
                                } as Partial<EditableStyle>)
                              }
                            />
                          ) : currentPage ? (
                            <PageStyleRow
                              key={control.field}
                              label={control.label}
                              inputType="range"
                              inheritedValue={String(
                                styleNumber(
                                  effectiveLayerStyle,
                                  control.field,
                                  control.fallback,
                                ),
                              )}
                              isOverridden={isStyleFieldOverridden(
                                currentPage,
                                layer.id,
                                control.field,
                              )}
                              overrideValue={
                                currentPage.layerOverrides?.[layer.id]?.[
                                  control.field
                                ] !== undefined
                                  ? String(
                                      currentPage.layerOverrides[layer.id][
                                        control.field
                                      ],
                                    )
                                  : undefined
                              }
                              fallbackValue={String(control.fallback)}
                              min={control.min}
                              max={control.max}
                              step={control.step}
                              decimals={control.decimals}
                              onOverride={(v) =>
                                setPageLayerOverride(currentPage.id, layer.id, {
                                  [control.field]: parseFloat(v),
                                } as Partial<EditableStyle>)
                              }
                              onClear={() =>
                                clearPageLayerOverride(
                                  currentPage.id,
                                  layer.id,
                                  control.field,
                                )
                              }
                            />
                          ) : null,
                        )
                      : null}

                    {isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Track offset"
                        inputType="range"
                        value={String(
                          (envStyle.gammaTrackOffsetM as number | undefined) ??
                            36,
                        )}
                        min={0}
                        max={220}
                        step={5}
                        decimals={0}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            gammaTrackOffsetM: parseFloat(v),
                          })
                        }
                      />
                    ) : isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Track offset"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.gammaTrackOffsetM as
                            | number
                            | undefined) ?? 36,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "gammaTrackOffsetM",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.gammaTrackOffsetM !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .gammaTrackOffsetM,
                              )
                            : undefined
                        }
                        fallbackValue="36"
                        min={0}
                        max={220}
                        step={5}
                        decimals={0}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            gammaTrackOffsetM: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "gammaTrackOffsetM",
                          )
                        }
                      />
                    ) : null}

                    {isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Track width"
                        inputType="range"
                        value={String(
                          (envStyle.gammaTrackWidthM as number | undefined) ??
                            78,
                        )}
                        min={20}
                        max={220}
                        step={5}
                        decimals={0}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            gammaTrackWidthM: parseFloat(v),
                          })
                        }
                      />
                    ) : isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Track width"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.gammaTrackWidthM as
                            | number
                            | undefined) ?? 78,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "gammaTrackWidthM",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.gammaTrackWidthM !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .gammaTrackWidthM,
                              )
                            : undefined
                        }
                        fallbackValue="78"
                        min={20}
                        max={220}
                        step={5}
                        decimals={0}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            gammaTrackWidthM: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "gammaTrackWidthM",
                          )
                        }
                      />
                    ) : null}

                    {isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Depth scale"
                        inputType="range"
                        value={String(
                          (envStyle.gammaDepthScale as number | undefined) ?? 1,
                        )}
                        min={0.2}
                        max={1.8}
                        step={0.05}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            gammaDepthScale: parseFloat(v),
                          })
                        }
                      />
                    ) : isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Depth scale"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.gammaDepthScale as
                            | number
                            | undefined) ?? 1,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "gammaDepthScale",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.gammaDepthScale !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .gammaDepthScale,
                              )
                            : undefined
                        }
                        fallbackValue="1"
                        min={0.2}
                        max={1.8}
                        step={0.05}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            gammaDepthScale: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "gammaDepthScale",
                          )
                        }
                      />
                    ) : null}

                    {isEzGamma && isEnv ? (
                      <EnvStyleRow
                        label="Panel opacity"
                        inputType="range"
                        value={String(
                          (envStyle.gammaPanelOpacity as number | undefined) ??
                            0,
                        )}
                        min={0}
                        max={1}
                        step={0.05}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            gammaPanelOpacity: parseFloat(v),
                          })
                        }
                      />
                    ) : isEzGamma && currentPage ? (
                      <PageStyleRow
                        label="Panel opacity"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.gammaPanelOpacity as
                            | number
                            | undefined) ?? 0,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "gammaPanelOpacity",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.gammaPanelOpacity !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .gammaPanelOpacity,
                              )
                            : undefined
                        }
                        fallbackValue="0"
                        min={0}
                        max={1}
                        step={0.05}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            gammaPanelOpacity: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "gammaPanelOpacity",
                          )
                        }
                      />
                    ) : null}

                    {isEzGamma ? (
                      <EzGammaStyleControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isGeochem ? (
                      <GeochemStyleControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isHyperspectral ? (
                      <HyperspectralStyleControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isImageryLidar ? (
                      <ImageryLidarStyleControls
                        style={isEnv ? envStyle : effectiveLayerStyle}
                        onChange={(patch) => {
                          if (isEnv) {
                            setEnvLayerStyle(layer.id, patch);
                          } else if (currentPage) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              patch,
                            );
                          }
                        }}
                      />
                    ) : null}

                    {isAreaOutlines && isEnv ? (
                      <AreaOutlinesControls
                        outlines={state.environment.scene?.areaOutlines ?? []}
                        viewCenter={[
                          Math.round(
                            sceneHandle.controls.target.x +
                              SCENE_ORIGIN.easting,
                          ),
                          Math.round(
                            sceneHandle.controls.target.y +
                              SCENE_ORIGIN.northing,
                          ),
                        ]}
                        onChange={(outlines) =>
                          setEnvScene({
                            areaOutlines: outlines,
                          })
                        }
                      />
                    ) : null}

                    {isStreams && isEnv ? (
                      <EnvStyleRow
                        label="Terrain shade"
                        inputType="range"
                        value={String(
                          (envStyle.terrainShadowInfluence as
                            | number
                            | undefined) ?? 0.09,
                        )}
                        min={0}
                        max={1}
                        step={0.05}
                        decimals={2}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            terrainShadowInfluence: parseFloat(v),
                          })
                        }
                      />
                    ) : isStreams && currentPage ? (
                      <PageStyleRow
                        label="Terrain shade"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveStyle(
                            state.environment,
                            currentPage,
                            layer.id,
                          ).terrainShadowInfluence as number | undefined) ??
                            0.09,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "terrainShadowInfluence",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.terrainShadowInfluence !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .terrainShadowInfluence,
                              )
                            : undefined
                        }
                        fallbackValue="0.09"
                        min={0}
                        max={1}
                        step={0.05}
                        decimals={2}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            terrainShadowInfluence: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "terrainShadowInfluence",
                          )
                        }
                      />
                    ) : null}
                  </div>
                </details>
              ) : (
                <div style={detailsContentStyle}>
                  {isEnv ? (
                    <AreaOutlinesControls
                      outlines={state.environment.scene?.areaOutlines ?? []}
                      viewCenter={[
                        Math.round(
                          sceneHandle.controls.target.x + SCENE_ORIGIN.easting,
                        ),
                        Math.round(
                          sceneHandle.controls.target.y + SCENE_ORIGIN.northing,
                        ),
                      ]}
                      onChange={(outlines) =>
                        setEnvScene({
                          areaOutlines: outlines,
                        })
                      }
                    />
                  ) : null}
                </div>
              )}

              {isUtahForgeResistivitySlices ? (
                <ResistivitySliceControls
                  style={isEnv ? envStyle : effectiveLayerStyle}
                  isEnv={isEnv}
                  currentPage={currentPage}
                  layerId={layer.id}
                  setEnvLayerStyle={setEnvLayerStyle}
                  setPageLayerOverride={setPageLayerOverride}
                  clearPageLayerOverride={clearPageLayerOverride}
                />
              ) : null}

              {isUtahForgeMtVolume ? (
                <MtVolumeControls
                  layer={layer}
                  style={isEnv ? envStyle : effectiveLayerStyle}
                  disabled={!isEnv && !mtVolumeOverridden}
                  isEnv={isEnv}
                  currentPage={currentPage}
                  layerId={layer.id}
                  sceneSectionStyle={effectiveSceneSectionStyle}
                  sceneHandle={sceneHandle}
                  setEnvLayerStyle={setEnvLayerStyle}
                  setPageLayerOverride={setPageLayerOverride}
                  clearPageLayerOverride={clearPageLayerOverride}
                  onToggleOverride={
                    currentPage
                      ? (enabled) => {
                          if (enabled) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              mtVolumePatchFromStyle(effectiveLayerStyle),
                            );
                          } else {
                            for (const field of MT_VOLUME_FIELDS) {
                              clearPageLayerOverride(
                                currentPage.id,
                                layer.id,
                                field,
                              );
                            }
                          }
                        }
                      : undefined
                  }
                />
              ) : null}

              {isUtahForgeMtThresholdSurfaces ? (
                <MtThresholdSurfaceControls
                  layer={layer}
                  style={isEnv ? envStyle : effectiveLayerStyle}
                  disabled={!isEnv && !mtThresholdSurfaceOverridden}
                  isEnv={isEnv}
                  currentPage={currentPage}
                  layerId={layer.id}
                  setEnvLayerStyle={setEnvLayerStyle}
                  setPageLayerOverride={setPageLayerOverride}
                  clearPageLayerOverride={clearPageLayerOverride}
                  onToggleOverride={
                    currentPage
                      ? (enabled) => {
                          if (enabled) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              mtThresholdSurfacePatchFromStyle(
                                effectiveLayerStyle,
                              ),
                            );
                          } else {
                            for (const field of MT_THRESHOLD_SURFACE_FIELDS) {
                              clearPageLayerOverride(
                                currentPage.id,
                                layer.id,
                                field,
                              );
                            }
                          }
                        }
                      : undefined
                  }
                />
              ) : null}

              {isUtahForgeSeismicBrowser ? (
                <SeismicBrowserControls
                  layer={layer}
                  style={isEnv ? envStyle : effectiveLayerStyle}
                  disabled={!isEnv && currentPage === null}
                  isEnv={isEnv}
                  currentPage={currentPage}
                  layerId={layer.id}
                  overridden={seismicBrowserOverridden}
                  sceneSectionStyle={effectiveSceneSectionStyle}
                  sceneHandle={sceneHandle}
                  onToggleOverride={
                    currentPage
                      ? (enabled) => {
                          if (enabled) {
                            setPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              seismicBrowserPatchFromStyle(
                                effectiveLayerStyle,
                                layer,
                              ),
                            );
                          } else {
                            for (const field of SEISMIC_BROWSER_FIELDS) {
                              clearPageLayerOverride(
                                currentPage.id,
                                layer.id,
                                field,
                              );
                            }
                          }
                        }
                      : undefined
                  }
                  setEnvLayerStyle={setEnvLayerStyle}
                  setPageLayerOverride={setPageLayerOverride}
                />
              ) : null}

              {isTrees ? (
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Emboss</summary>
                  <div style={detailsContentStyle}>
                    {isEnv ? (
                      <EnvStyleRow
                        label="Height"
                        inputType="range"
                        value={String(
                          (envStyle.forestEmbossHeight as number | undefined) ??
                            0,
                        )}
                        min={0}
                        max={100}
                        step={1}
                        decimals={0}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, {
                            forestEmbossHeight: parseFloat(v),
                          })
                        }
                      />
                    ) : currentPage ? (
                      <PageStyleRow
                        label="Height"
                        inputType="range"
                        inheritedValue={String(
                          (effectiveLayerStyle.forestEmbossHeight as
                            | number
                            | undefined) ?? 0,
                        )}
                        isOverridden={isStyleFieldOverridden(
                          currentPage,
                          layer.id,
                          "forestEmbossHeight",
                        )}
                        overrideValue={
                          currentPage.layerOverrides?.[layer.id]
                            ?.forestEmbossHeight !== undefined
                            ? String(
                                currentPage.layerOverrides[layer.id]
                                  .forestEmbossHeight,
                              )
                            : undefined
                        }
                        fallbackValue="0"
                        min={0}
                        max={100}
                        step={1}
                        decimals={0}
                        onOverride={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            forestEmbossHeight: parseFloat(v),
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "forestEmbossHeight",
                          )
                        }
                      />
                    ) : null}
                  </div>
                </details>
              ) : null}

              {!isAreaOutlines ? (
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Labels</summary>
                  <div style={detailsContentStyle}>
                    {isEnv ? (
                      <>
                        <EnvStyleRow
                          label="Text color"
                          inputType="color"
                          value={labelTextControlValue(envStyle)}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, { labelTextColor: v })
                          }
                        />
                        <EnvStyleRow
                          label="Text opacity"
                          inputType="range"
                          value={String(
                            (envStyle.labelTextOpacity as number | undefined) ??
                              1,
                          )}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, {
                              labelTextOpacity: parseFloat(v),
                            })
                          }
                        />
                        <EnvStyleRow
                          label="Outline color"
                          inputType="color"
                          value={labelOutlineColorControlValue(envStyle)}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, { labelOutlineColor: v })
                          }
                        />
                        <EnvStyleRow
                          label="Outline opacity"
                          inputType="range"
                          value={String(
                            labelOutlineOpacityControlValue(envStyle),
                          )}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, {
                              labelOutlineOpacity: parseFloat(v),
                            })
                          }
                        />
                        <EnvStyleRow
                          label="Fill color"
                          inputType="color"
                          value={labelFillColorControlValue(envStyle)}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, { labelFillColor: v })
                          }
                        />
                        <EnvStyleRow
                          label="Fill opacity"
                          inputType="range"
                          value={String(labelFillOpacityControlValue(envStyle))}
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, {
                              labelFillOpacity: parseFloat(v),
                            })
                          }
                        />
                      </>
                    ) : currentPage ? (
                      <>
                        <PageStyleRow
                          label="Text color"
                          inputType="color"
                          inheritedValue={labelTextControlValue(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelTextColor",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelTextColor as string | undefined
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelTextColor: v,
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelTextColor",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Text opacity"
                          inputType="range"
                          inheritedValue={String(
                            (effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelTextOpacity as number | undefined) ?? 1,
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelTextOpacity",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelTextOpacity !== undefined
                              ? String(
                                  currentPage.layerOverrides[layer.id]
                                    .labelTextOpacity,
                                )
                              : undefined
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelTextOpacity: parseFloat(v),
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelTextOpacity",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Outline color"
                          inputType="color"
                          inheritedValue={labelOutlineColorControlValue(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelOutlineColor",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelOutlineColor as string | undefined
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelOutlineColor: v,
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelOutlineColor",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Outline opacity"
                          inputType="range"
                          inheritedValue={String(
                            labelOutlineOpacityControlValue(
                              effectiveStyle(
                                state.environment,
                                currentPage,
                                layer.id,
                              ),
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelOutlineOpacity",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelOutlineOpacity !== undefined
                              ? String(
                                  currentPage.layerOverrides[layer.id]
                                    .labelOutlineOpacity,
                                )
                              : undefined
                          }
                          fallbackValue={
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelKind === "landTitle"
                              ? String(LAND_TITLE_LABEL_OUTLINE_OPACITY_DEFAULT)
                              : "1"
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelOutlineOpacity: parseFloat(v),
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelOutlineOpacity",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Fill color"
                          inputType="color"
                          inheritedValue={labelFillColorControlValue(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelFillColor",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelFillColor as string | undefined
                          }
                          fallbackValue={
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelKind === "landTitle"
                              ? LAND_TITLE_LABEL_FILL_DEFAULT
                              : "#14161c"
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelFillColor: v,
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelFillColor",
                            )
                          }
                        />
                        <PageStyleRow
                          label="Fill opacity"
                          inputType="range"
                          inheritedValue={String(
                            labelFillOpacityControlValue(
                              effectiveStyle(
                                state.environment,
                                currentPage,
                                layer.id,
                              ),
                            ),
                          )}
                          isOverridden={isStyleFieldOverridden(
                            currentPage,
                            layer.id,
                            "labelFillOpacity",
                          )}
                          overrideValue={
                            currentPage.layerOverrides?.[layer.id]
                              ?.labelFillOpacity !== undefined
                              ? String(
                                  currentPage.layerOverrides[layer.id]
                                    .labelFillOpacity,
                                )
                              : undefined
                          }
                          fallbackValue={
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelKind === "landTitle"
                              ? String(LAND_TITLE_LABEL_FILL_OPACITY_DEFAULT)
                              : "0.72"
                          }
                          onOverride={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelFillOpacity: parseFloat(v),
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelFillOpacity",
                            )
                          }
                        />
                      </>
                    ) : null}

                    {isEnv ? (
                      <EnvLabelKindRow
                        value={normalizeLabelKind(envStyle.labelKind)}
                        onChange={(v) =>
                          setEnvLayerStyle(layer.id, { labelKind: v })
                        }
                      />
                    ) : currentPage ? (
                      <PageLabelKindRow
                        page={currentPage}
                        layerId={layer.id}
                        envValue={normalizeLabelKind(envStyle.labelKind)}
                        onSet={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            labelKind: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "labelKind",
                          )
                        }
                      />
                    ) : null}

                    {isEnv ? (
                      <EnvLabelPointerVisibleRow
                        value={labelPointerVisibleControlValue(envStyle)}
                        onToggle={() =>
                          setEnvLayerStyle(layer.id, {
                            labelPointerVisible:
                              !labelPointerVisibleControlValue(envStyle),
                          })
                        }
                      />
                    ) : currentPage ? (
                      <PageLabelPointerVisibleRow
                        page={currentPage}
                        layerId={layer.id}
                        envValue={labelPointerVisibleControlValue(envStyle)}
                        onSet={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            labelPointerVisible: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "labelPointerVisible",
                          )
                        }
                      />
                    ) : null}

                    {(
                      isEnv
                        ? normalizeLabelKind(envStyle.labelKind) ===
                            "landTitle" &&
                          labelPointerVisibleControlValue(envStyle)
                        : currentPage &&
                          normalizeLabelKind(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ).labelKind,
                          ) === "landTitle" &&
                          labelPointerVisibleControlValue(
                            effectiveStyle(
                              state.environment,
                              currentPage,
                              layer.id,
                            ),
                          )
                    ) ? (
                      isEnv ? (
                        <EnvLabelPointerSideRow
                          value={
                            envStyle.labelPointerSide === "left" ||
                            envStyle.labelPointerSide === "right"
                              ? envStyle.labelPointerSide
                              : "auto"
                          }
                          onChange={(v) =>
                            setEnvLayerStyle(layer.id, { labelPointerSide: v })
                          }
                        />
                      ) : currentPage ? (
                        <PageLabelPointerSideRow
                          page={currentPage}
                          layerId={layer.id}
                          envValue={
                            envStyle.labelPointerSide === "left" ||
                            envStyle.labelPointerSide === "right"
                              ? envStyle.labelPointerSide
                              : "auto"
                          }
                          onSet={(v) =>
                            setPageLayerOverride(currentPage.id, layer.id, {
                              labelPointerSide: v,
                            })
                          }
                          onClear={() =>
                            clearPageLayerOverride(
                              currentPage.id,
                              layer.id,
                              "labelPointerSide",
                            )
                          }
                        />
                      ) : null
                    ) : null}

                    {isEnv ? (
                      <EnvShowLabelsRow
                        value={envStyle.showLabels === true}
                        onToggle={() =>
                          setEnvLayerStyle(layer.id, {
                            showLabels: !(envStyle.showLabels === true),
                          })
                        }
                      />
                    ) : currentPage ? (
                      <PageShowLabelsRow
                        page={currentPage}
                        layerId={layer.id}
                        envValue={envStyle.showLabels === true}
                        onSet={(v) =>
                          setPageLayerOverride(currentPage.id, layer.id, {
                            showLabels: v,
                          })
                        }
                        onClear={() =>
                          clearPageLayerOverride(
                            currentPage.id,
                            layer.id,
                            "showLabels",
                          )
                        }
                      />
                    ) : null}
                  </div>
                </details>
              ) : null}

              <details style={nestedDetailsStyle}>
                <summary style={panelStyles.summary}>Provenance</summary>
                <div style={detailsContentStyle}>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Source file</label>
                    <input
                      type="text"
                      value={meta.sourceFile ?? ""}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          sourceFile: e.target.value,
                        })
                      }
                      style={panelStyles.textInput}
                    />
                  </div>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Source date</label>
                    <input
                      type="text"
                      value={meta.sourceDate ?? ""}
                      placeholder="YYYY-MM-DD or source range"
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          sourceDate: e.target.value,
                        })
                      }
                      style={panelStyles.textInput}
                    />
                  </div>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Origin</label>
                    <input
                      type="text"
                      value={meta.sourceOrigin ?? ""}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          sourceOrigin: e.target.value,
                        })
                      }
                      style={panelStyles.textInput}
                    />
                  </div>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Classification</label>
                    <select
                      value={meta.classification ?? "observation"}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          classification: e.target.value,
                        })
                      }
                    >
                      {CLASSIFICATIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={nestedControlRowStyle}>
                    <label style={nestedFieldLabelStyle}>Confidentiality</label>
                    <select
                      value={meta.confidentiality ?? "public"}
                      onChange={(e) =>
                        setLayerProvenance(layer.id, {
                          confidentiality: e.target.value,
                        })
                      }
                    >
                      {CONFIDENTIALITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </details>

              {isGeology && isEnv && (
                <GeologySubUnitsPanel layerStyle={envStyle} />
              )}
            </>
          ) : null}
        </div>
      </div>
    );
  };

  const byId = new Map(state.manifest.layers.map((layer) => [layer.id, layer]));
  const projectPublicLayerGroups =
    state.projectSlug === "case-study-b"
      ? CASE_STUDY_B_PUBLIC_LAYER_GROUPS
      : state.projectSlug === "utah-forge"
        ? UTAH_FORGE_PUBLIC_LAYER_GROUPS
        : PUBLIC_LAYER_GROUPS;
  const projectPublicTopoLayerGroups =
    state.projectSlug === "utah-forge"
      ? UTAH_FORGE_PUBLIC_TOPO_LAYER_GROUPS
      : ([] as const satisfies readonly LayerGroupDef[]);
  const projectCustomerLayerGroups =
    state.projectSlug === "case-study-b"
      ? CASE_STUDY_B_CUSTOMER_LAYER_GROUPS
      : state.projectSlug === "utah-forge"
        ? UTAH_FORGE_CUSTOMER_LAYER_GROUPS
        : CUSTOMER_LAYER_GROUPS;
  const projectLayerGroups = [
    ...projectPublicLayerGroups,
    ...projectPublicTopoLayerGroups,
    ...projectCustomerLayerGroups,
  ];
  const layerGroups =
    section === "public"
      ? projectPublicLayerGroups
      : section === "publicTopo"
        ? projectPublicTopoLayerGroups
        : projectCustomerLayerGroups;
  const groupedIds = new Set<string>(
    projectLayerGroups.flatMap((group) => group.ids),
  );
  const otherLayers = state.manifest.layers.filter(
    (layer) =>
      layerHasRenderableControl(layer) &&
      !groupedIds.has(layer.id) &&
      layerDataSection(layer) === section,
  );
  const utahForgeSeismicLayer =
    state.projectSlug === "utah-forge"
      ? byId.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
      : undefined;
  const sceneSectionStyle =
    state.projectSlug === "utah-forge"
      ? isEnv
        ? (state.environment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID] ??
          {})
        : currentPage
          ? effectiveStyle(
              state.environment,
              currentPage,
              UTAH_FORGE_SCENE_SECTION_LAYER_ID,
            )
          : (state.environment.layerStyles[UTAH_FORGE_SCENE_SECTION_LAYER_ID] ??
            {})
      : {};
  const sceneSectionDisabled =
    state.projectSlug === "utah-forge" && !isEnv && currentPage === null;
  const workingAreaFocusStyle =
    state.projectSlug === "utah-forge"
      ? isEnv
        ? (state.environment.layerStyles[
            UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID
          ] ?? {})
        : currentPage
          ? effectiveStyle(
              state.environment,
              currentPage,
              UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
            )
          : (state.environment.layerStyles[
              UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID
            ] ?? {})
      : {};
  const workingAreaFocusDisabled =
    state.projectSlug === "utah-forge" && !isEnv && currentPage === null;

  return (
    <div
      style={panelStyles.body}
      data-dev-source="src/editor/LayerPanel.tsx:398"
      data-dev-note="LayerPanel renders either Public Data or Customer Data layer controls, depending on its section prop."
    >
      {!isEnv && !currentPage && (
        <div style={panelStyles.muted}>
          Select Global Settings or a page in the Page Manager.
        </div>
      )}
      {section === "customer" && currentPage && (
        <PageEnvironmentOverridePanel
          page={currentPage}
          setPageField={setPageField}
          accentColor={selectedPageAccent}
        />
      )}
      {state.projectSlug === "utah-forge" && section === "public" ? (
        <LayerGroup
          title="Scene section planes"
          devSource="src/editor/LayerPanel.tsx:scene-section"
          devNote="Scene section planes are a virtual FORGE Data tool; controls patch a virtual layer style and SceneManager applies it across targeted visible scene objects."
          accentColor={selectedPageAccent}
        >
          <SceneSectionPlanesContainer
            seismicLayer={utahForgeSeismicLayer}
            allLayers={state.manifest.layers}
            style={sceneSectionStyle}
            disabled={sceneSectionDisabled}
            isEnv={isEnv}
            currentPage={currentPage}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            sceneHandle={sceneHandle}
          />
        </LayerGroup>
      ) : null}
      {layerGroups.map((group) => {
        const layers = group.ids
          .map((id) => byId.get(id))
          .filter(
            (layer): layer is ProjectLayerSpec =>
              !!layer && layerHasRenderableControl(layer),
          );
        const seismicLayer =
          state.projectSlug === "utah-forge" &&
          section === "public" &&
          group.title === "Seismic analysis"
            ? byId.get(UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID)
            : undefined;
        const seismicLayerStyle = seismicLayer
          ? isEnv
            ? (state.environment.layerStyles[seismicLayer.id] ?? {})
            : currentPage
              ? effectiveStyle(state.environment, currentPage, seismicLayer.id)
              : (state.environment.layerStyles[seismicLayer.id] ?? {})
          : {};
        const seismicCapabilityDisabled = !isEnv && currentPage === null;
        if (layers.length === 0) return null;
        return (
          <LayerGroup
            key={group.title}
            title={group.title}
            devSource="src/editor/LayerPanel.tsx:880"
            devNote="layerGroupSummaryStyle controls layer-category subheading pills like Topo map tile and Drilling."
            accentColor={selectedPageAccent}
          >
            {group.title !== "Topo layers" ? (
              <LayerGroupFogControl
                layerIds={layers.map((layer) => layer.id)}
                isEnv={isEnv}
                currentPage={currentPage}
                environment={state.environment}
                globalFogDensity={
                  state.environment.scene?.fog?.density ?? DEFAULT_FOG_DENSITY
                }
                onSetEnv={(layerId, affectedByFog) =>
                  setEnvLayerStyle(layerId, { affectedByFog })
                }
                onSetPage={(pageId, layerId, affectedByFog) =>
                  setPageLayerOverride(pageId, layerId, { affectedByFog })
                }
                onSetEnvDensity={(layerId, fogDensity) =>
                  setEnvLayerStyle(layerId, { fogDensity })
                }
                onSetPageDensity={(pageId, layerId, fogDensity) =>
                  setPageLayerOverride(pageId, layerId, { fogDensity })
                }
              />
            ) : null}
            {state.projectSlug === "utah-forge" &&
            section === "public" &&
            group.title === "Working area" ? (
              <WorkingAreaFocusContainer
                allLayers={state.manifest.layers}
                style={workingAreaFocusStyle}
                disabled={workingAreaFocusDisabled}
                isEnv={isEnv}
                currentPage={currentPage}
                setEnvLayerStyle={setEnvLayerStyle}
                setPageLayerOverride={setPageLayerOverride}
                sceneHandle={sceneHandle}
              />
            ) : null}
            {state.projectSlug === "utah-forge" &&
            section === "publicTopo" &&
            group.title === "Topo layers" ? (
              <PublicSurfaceGroupControls
                style={
                  currentPage
                    ? effectiveStyle(state.environment, currentPage, "terrain")
                    : (state.environment.layerStyles.terrain ?? {})
                }
                scene={state.environment.scene ?? {}}
                isEnv={isEnv}
                currentPage={currentPage}
                setEnvLayerStyle={setEnvLayerStyle}
                setPageLayerOverride={setPageLayerOverride}
                clearPageLayerOverride={clearPageLayerOverride}
                setEnvScene={setEnvScene}
                projectRoot={state.projectRoot}
              />
            ) : null}
            {group.title === "Topo layers" && (
              <TopoDetailDistancePanel
                scene={state.environment.scene ?? {}}
                setEnvScene={setEnvScene}
              />
            )}
            {group.title === "Assay Samples" && isEnv && (
              <DrillingAssayPanel
                scene={state.environment.scene ?? {}}
                setEnvScene={setEnvScene}
              />
            )}
            {group.title === "Topo details" && (
              <TopoDetailDistancePanel
                scene={state.environment.scene ?? {}}
                setEnvScene={setEnvScene}
              />
            )}
            {layers.map(renderLayer)}
            {seismicLayer && layerHasRenderableControl(seismicLayer) ? (
              <SeismicCapabilityLayerContainers
                layer={seismicLayer}
                style={seismicLayerStyle}
                disabled={seismicCapabilityDisabled}
                isEnv={isEnv}
                currentPage={currentPage}
                layerId={seismicLayer.id}
                setEnvLayerStyle={setEnvLayerStyle}
                setPageLayerOverride={setPageLayerOverride}
                sceneHandle={sceneHandle}
              />
            ) : null}
          </LayerGroup>
        );
      })}
      {section === "customer" && (
        <SceneOverlaysReadOnly
          currentPage={currentPage}
          accentColor={selectedPageAccent}
        />
      )}
      {otherLayers.length > 0 && (
        <LayerGroup
          title="Other"
          devSource="src/editor/LayerPanel.tsx:880"
          devNote="layerGroupSummaryStyle controls layer-category subheading pills."
          accentColor={selectedPageAccent}
        >
          {otherLayers.map(renderLayer)}
        </LayerGroup>
      )}
    </div>
  );
}

function LayerGroup({
  title,
  children,
  defaultOpen = false,
  devSource = "src/editor/LayerPanel.tsx:423",
  devNote,
  accentColor,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  devSource?: string;
  devNote?: string;
  accentColor?: string | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const summaryStyle: React.CSSProperties = accentColor
    ? {
        ...layerGroupSummaryStyle,
        border: `3px solid ${accentColor}`,
        boxShadow: "none",
      }
    : layerGroupSummaryStyle;
  return (
    <div
      style={layerGroupStyle}
      data-dev-source="src/editor/LayerPanel.tsx:862"
      data-dev-note="layerGroupStyle controls the left inset and spacing around each Layers subheading."
    >
      <button
        type="button"
        style={summaryStyle}
        data-dev-source={devSource}
        data-dev-padding-source="src/editor/LayerPanel.tsx:888"
        data-dev-note={
          devNote ??
          "layerGroupSummaryStyle controls this subheading pill, including padding, width, and chevron alignment."
        }
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          style={layerGroupTitleStyle}
          data-dev-text-source="src/editor/LayerPanel.tsx:469"
        >
          {title}
        </span>
        <span style={layerGroupDisclosureStyle} aria-hidden="true">
          <span
            style={{
              ...layerGroupChevronStyle,
              transform: open ? "rotate(45deg)" : "rotate(-45deg)",
            }}
          />
        </span>
      </button>
      {open && <div style={layerGroupBodyStyle}>{children}</div>}
    </div>
  );
}

function LayerGroupFogControl({
  layerIds,
  isEnv,
  currentPage,
  environment,
  globalFogDensity,
  onSetEnv,
  onSetPage,
  onSetEnvDensity,
  onSetPageDensity,
}: {
  layerIds: string[];
  isEnv: boolean;
  currentPage: PresentationPage | null;
  environment: EnvironmentSetup;
  globalFogDensity: number;
  onSetEnv: (layerId: string, affectedByFog: boolean) => void;
  onSetPage: (pageId: string, layerId: string, affectedByFog: boolean) => void;
  onSetEnvDensity: (layerId: string, fogDensity: number) => void;
  onSetPageDensity: (
    pageId: string,
    layerId: string,
    fogDensity: number,
  ) => void;
}) {
  if (layerIds.length === 0) return null;
  const styles = layerIds.map((id) =>
    currentPage
      ? effectiveStyle(environment, currentPage, id)
      : (environment.layerStyles[id] ?? {}),
  );
  const values = styles.map((style) => style.affectedByFog !== false);
  const allOn = values.every(Boolean);
  const allOff = values.every((v) => !v);
  const mixed = !allOn && !allOff;
  const next = !allOn;
  const disabled = !isEnv && !currentPage;
  const densityValues = styles.map((style) =>
    typeof style.fogDensity === "number" ? style.fogDensity : globalFogDensity,
  );
  const densityAvg =
    densityValues.reduce((sum, value) => sum + value, 0) / densityValues.length;
  const densityMixed = densityValues.some(
    (value) => Math.abs(value - densityAvg) > 0.0000025,
  );
  const densityUi = densityAvg * 10000;
  const setDensity = (value: number) => {
    const fogDensity = value / 10000;
    if (isEnv) {
      for (const id of layerIds) onSetEnvDensity(id, fogDensity);
    } else if (currentPage) {
      for (const id of layerIds) {
        onSetPageDensity(currentPage.id, id, fogDensity);
      }
    }
  };

  return (
    <div style={layerGroupFogControlStyle}>
      <div style={layerGroupFogControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Use fog</label>
        <ToggleButton
          active={allOn}
          title="Toggle fog for every layer in this section"
          onClick={() => {
            if (disabled) return;
            if (isEnv) {
              for (const id of layerIds) onSetEnv(id, next);
            } else if (currentPage) {
              for (const id of layerIds) onSetPage(currentPage.id, id, next);
            }
          }}
        />
        <span style={mixed ? overrideTagActiveStyle : overrideTagStyle}>
          {mixed ? "mixed" : allOn ? "included" : "excluded"}
        </span>
      </div>
      <div style={layerGroupFogControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Fog dens.</label>
        <input
          type="range"
          min={FOG_DENSITY_UI_MIN}
          max={FOG_DENSITY_UI_MAX}
          step={FOG_DENSITY_UI_STEP}
          value={densityUi}
          disabled={allOff || disabled}
          onChange={(e) => setDensity(parseFloat(e.target.value))}
          style={
            {
              flex: 1,
              opacity: allOff || disabled ? 0.42 : 1,
              "--editor-slider-fill": `${
                ((densityUi - FOG_DENSITY_UI_MIN) /
                  (FOG_DENSITY_UI_MAX - FOG_DENSITY_UI_MIN)) *
                100
              }%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{densityUi.toFixed(2)}</span>
        <span style={densityMixed ? overrideTagActiveStyle : overrideTagStyle}>
          {densityMixed ? "mixed" : "density"}
        </span>
      </div>
    </div>
  );
}

function TopoDetailDistancePanel({
  scene,
  setEnvScene,
}: {
  scene: SceneProperties;
  setEnvScene: (patch: Partial<SceneProperties>) => void;
}) {
  const topo = scene.topoDetails ?? {};
  const near = topo.distanceFadeNear ?? 5000;
  const far = topo.distanceFadeFar ?? 19000;
  const farLineScale = topo.farLineScale ?? 0.67;
  const farOpacity = topo.farOpacity ?? 0.2;
  const setTopo = (patch: NonNullable<SceneProperties["topoDetails"]>) => {
    setEnvScene({
      topoDetails: {
        ...topo,
        ...patch,
      },
    });
  };

  return (
    <details
      style={drillingAssayDetailsStyle}
      data-dev-source="src/editor/LayerPanel.tsx:632"
      data-dev-note="TopoDetailDistancePanel controls global distance thinning/fade for roads, streams, and power lines."
      open
    >
      <summary style={drillingAssaySummaryStyle}>Distance fade</summary>
      <div style={detailsContentStyle}>
        <TopoDistanceSlider
          label="Fade start"
          value={near}
          min={0}
          max={500000}
          step={5000}
          decimals={0}
          suffix="m"
          onChange={(v) => setTopo({ distanceFadeNear: v })}
        />
        <TopoDistanceSlider
          label="Fade end"
          value={far}
          min={1000}
          max={750000}
          step={5000}
          decimals={0}
          suffix="m"
          onChange={(v) => setTopo({ distanceFadeFar: v })}
        />
        <TopoDistanceSlider
          label="Far width"
          value={farLineScale}
          min={0.01}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(v) => setTopo({ farLineScale: v })}
        />
        <TopoDistanceSlider
          label="Far opacity"
          value={farOpacity}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          onChange={(v) => setTopo({ farOpacity: v })}
        />
        <div style={drillingAssayHintStyle}>
          Global controls for roads, streams, and power lines. Start/end are
          camera distance; far width and opacity are what remains at the end.
        </div>
      </div>
    </details>
  );
}

function TopoDistanceSlider({
  label,
  value,
  min,
  max,
  step,
  decimals,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const fill = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={
          {
            flex: 1,
            "--editor-slider-fill": `${fill}%`,
          } as React.CSSProperties
        }
      />
      <span style={sliderNumberReadoutStyle}>
        {value.toFixed(decimals)}
        {suffix}
      </span>
    </div>
  );
}

function AssayToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
      <span style={nestedFieldLabelStyle}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function AssayColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={assayOutlineColorInputStyle}
      />
    </div>
  );
}

function DrillingAssayPanel({
  scene,
  setEnvScene,
}: {
  scene: SceneProperties;
  setEnvScene: (patch: Partial<SceneProperties>) => void;
}) {
  const drilling = scene.drilling ?? {};
  const assays = drilling.assays ?? {};
  const traceMode = assays.traceMode ?? "assay";
  const showBoreLine = assays.showBoreLine ?? true;
  const boreLineColor = assays.boreLineColor ?? "#e7dcc4";
  const boreWidth = assays.boreLineWidthPx ?? 3.25;
  const boreLineOpacity = assays.boreLineOpacity ?? 0.72;
  const boreLineRenderOrder = assays.boreLineRenderOrder ?? 6.8;
  const showBoreTube = assays.showBoreTube ?? true;
  const boreTubeColor = assays.boreTubeColor ?? "#d8ccb2";
  const boreTubeOpacity = assays.boreTubeOpacity ?? 0.88;
  const boreTubeRoughness = assays.boreTubeRoughness ?? 0.64;
  const boreTubeMetalness = assays.boreTubeMetalness ?? 0.08;
  const boreTubeEmissiveColor = assays.boreTubeEmissiveColor ?? "#8d826f";
  const boreTubeEmissive = assays.boreTubeEmissive ?? 0.012;
  const boreTubeRenderOrder = assays.boreTubeRenderOrder ?? 5.4;
  const assayMultiplier = assays.assayWidthMultiplier ?? 2.6;
  const lithologyMultiplier = assays.lithologyWidthMultiplier ?? 2.45;
  const assayWidth = boreWidth * assayMultiplier;
  const lithologyWidth = boreWidth * lithologyMultiplier;
  const lithologyOpacity = assays.lithologyOpacity ?? 0.56;
  const showAssaySides = assays.showAssaySides ?? true;
  const showAssayCaps = assays.showAssayCaps ?? true;
  const assaySideOpacity = assays.assaySideOpacity ?? 1;
  const assayCapOpacity = assays.assayCapOpacity ?? 1;
  const capThicknessM = assays.assayCapThicknessM ?? 1.6;
  const sideRoughness = assays.assaySideRoughness ?? 0.46;
  const capRoughness = assays.assayCapRoughness ?? 0.74;
  const metalness = assays.assayMetalness ?? 0.02;
  const sideEmissive = assays.assaySideEmissive ?? 0.018;
  const capEmissive = assays.assayCapEmissive ?? 0.012;
  const sideRenderOrder = assays.assaySideRenderOrder ?? 7.4;
  const capRenderOrder = assays.assayCapRenderOrder ?? 8;
  const showBoreLens = assays.showBoreLens ?? true;
  const boreLensColor = assays.boreLensColor ?? "#e9dec4";
  const boreLensOpacity = assays.boreLensOpacity ?? 0.16;
  const colorStopMap = new Map(
    DEFAULT_ASSAY_COLOR_STOPS.map((stop) => [stop.id, stop]),
  );
  for (const stop of assays.colorStops ?? []) {
    colorStopMap.set(stop.id, stop);
  }
  const colorStops = DEFAULT_ASSAY_COLOR_STOPS.map(
    (stop) => colorStopMap.get(stop.id) ?? stop,
  );
  const setAssays = (
    patch: NonNullable<NonNullable<SceneProperties["drilling"]>["assays"]>,
  ) => {
    setEnvScene({
      drilling: {
        ...drilling,
        assays: { ...assays, ...patch },
      },
    });
  };
  const updateColorStop = (
    id: string,
    patch: Partial<{ label: string; color: string }>,
  ) => {
    setAssays({
      colorStops: colorStops.map((stop) =>
        stop.id === id ? { ...stop, ...patch } : stop,
      ),
    });
  };

  return (
    <details
      style={drillingAssayDetailsStyle}
      data-dev-source="src/editor/LayerPanel.tsx:529"
      data-dev-note="DrillingAssayPanel captures render variables for 2023 downhole assay display under the Assay Samples layer group."
    >
      <summary style={drillingAssaySummaryStyle}>Assays</summary>
      <div style={detailsContentStyle}>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Trace view</label>
          <select
            value={traceMode}
            onChange={(e) =>
              setAssays({
                traceMode: e.target.value as "assay" | "lithology" | "both",
              })
            }
            style={panelStyles.textInput}
          >
            <option value="assay">Assay grade</option>
            <option value="lithology">Lithology</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Bore line / outline</div>
          <AssayToggle
            label="Line"
            checked={showBoreLine}
            onChange={(checked) => setAssays({ showBoreLine: checked })}
          />
          <AssayColorControl
            label="Color"
            value={boreLineColor}
            onChange={(color) => setAssays({ boreLineColor: color })}
          />
          <TopoDistanceSlider
            label="Opacity"
            value={boreLineOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreLineOpacity: value })}
          />
          <TopoDistanceSlider
            label="Order"
            value={boreLineRenderOrder}
            min={0}
            max={12}
            step={0.1}
            decimals={1}
            onChange={(value) => setAssays({ boreLineRenderOrder: value })}
          />
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Bore tube</div>
          <AssayToggle
            label="Tube"
            checked={showBoreTube}
            onChange={(checked) => setAssays({ showBoreTube: checked })}
          />
          <AssayColorControl
            label="Color"
            value={boreTubeColor}
            onChange={(color) => setAssays({ boreTubeColor: color })}
          />
          <AssayColorControl
            label="Glow color"
            value={boreTubeEmissiveColor}
            onChange={(color) => setAssays({ boreTubeEmissiveColor: color })}
          />
          <TopoDistanceSlider
            label="Opacity"
            value={boreTubeOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreTubeOpacity: value })}
          />
          <TopoDistanceSlider
            label="Rough"
            value={boreTubeRoughness}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreTubeRoughness: value })}
          />
          <TopoDistanceSlider
            label="Metal"
            value={boreTubeMetalness}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreTubeMetalness: value })}
          />
          <TopoDistanceSlider
            label="Glow"
            value={boreTubeEmissive}
            min={0}
            max={0.4}
            step={0.005}
            decimals={3}
            onChange={(value) => setAssays({ boreTubeEmissive: value })}
          />
          <TopoDistanceSlider
            label="Order"
            value={boreTubeRenderOrder}
            min={0}
            max={12}
            step={0.1}
            decimals={1}
            onChange={(value) => setAssays({ boreTubeRenderOrder: value })}
          />
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Bore width</label>
          <input
            type="range"
            min={0.5}
            max={6}
            step={0.5}
            value={boreWidth}
            onChange={(e) =>
              setAssays({ boreLineWidthPx: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${((boreWidth - 0.5) / 5.5) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{boreWidth.toFixed(1)}</span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Assay width</label>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={assayMultiplier}
            onChange={(e) =>
              setAssays({ assayWidthMultiplier: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${((assayMultiplier - 1) / 7) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{assayWidth.toFixed(1)}</span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Lith width</label>
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={lithologyMultiplier}
            onChange={(e) =>
              setAssays({
                lithologyWidthMultiplier: parseFloat(e.target.value),
              })
            }
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${((lithologyMultiplier - 1) / 9) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {lithologyWidth.toFixed(1)}
          </span>
        </div>
        <TopoDistanceSlider
          label="Lith opacity"
          value={lithologyOpacity}
          min={0}
          max={1}
          step={0.01}
          decimals={2}
          onChange={(value) => setAssays({ lithologyOpacity: value })}
        />
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Assay tuning</div>
          <AssayToggle
            label="Sides"
            checked={showAssaySides}
            onChange={(checked) => setAssays({ showAssaySides: checked })}
          />
          <AssayToggle
            label="Caps"
            checked={showAssayCaps}
            onChange={(checked) => setAssays({ showAssayCaps: checked })}
          />
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap thick</label>
            <input
              type="range"
              min={0.2}
              max={20}
              step={0.2}
              value={capThicknessM}
              onChange={(e) =>
                setAssays({ assayCapThicknessM: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${((capThicknessM - 0.2) / 19.8) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {capThicknessM.toFixed(1)}m
            </span>
          </div>
          <TopoDistanceSlider
            label="Side alpha"
            value={assaySideOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ assaySideOpacity: value })}
          />
          <TopoDistanceSlider
            label="Cap alpha"
            value={assayCapOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ assayCapOpacity: value })}
          />
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Side rough</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sideRoughness}
              onChange={(e) =>
                setAssays({ assaySideRoughness: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${sideRoughness * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sideRoughness.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap rough</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={capRoughness}
              onChange={(e) =>
                setAssays({ assayCapRoughness: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${capRoughness * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {capRoughness.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Metal</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={metalness}
              onChange={(e) =>
                setAssays({ assayMetalness: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${metalness * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{metalness.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Side lift</label>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.005}
              value={sideEmissive}
              onChange={(e) =>
                setAssays({ assaySideEmissive: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${(sideEmissive / 0.4) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sideEmissive.toFixed(3)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap lift</label>
            <input
              type="range"
              min={0}
              max={0.4}
              step={0.005}
              value={capEmissive}
              onChange={(e) =>
                setAssays({ assayCapEmissive: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${(capEmissive / 0.4) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {capEmissive.toFixed(3)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Side order</label>
            <input
              type="range"
              min={6}
              max={10}
              step={0.1}
              value={sideRenderOrder}
              onChange={(e) =>
                setAssays({ assaySideRenderOrder: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${((sideRenderOrder - 6) / 4) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sideRenderOrder.toFixed(1)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cap order</label>
            <input
              type="range"
              min={6}
              max={10}
              step={0.1}
              value={capRenderOrder}
              onChange={(e) =>
                setAssays({ assayCapRenderOrder: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${((capRenderOrder - 6) / 4) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {capRenderOrder.toFixed(1)}
            </span>
          </div>
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Cap lens</div>
          <AssayToggle
            label="Lens"
            checked={showBoreLens}
            onChange={(checked) => setAssays({ showBoreLens: checked })}
          />
          <AssayColorControl
            label="Color"
            value={boreLensColor}
            onChange={(color) => setAssays({ boreLensColor: color })}
          />
          <TopoDistanceSlider
            label="Opacity"
            value={boreLensOpacity}
            min={0}
            max={1}
            step={0.01}
            decimals={2}
            onChange={(value) => setAssays({ boreLensOpacity: value })}
          />
        </div>
        <div style={drillingAssayPaletteStyle}>
          <div style={drillingAssayPaletteTitleStyle}>Assay colors</div>
          {colorStops.map((stop) => (
            <div key={stop.id} style={drillingAssayColorRowStyle}>
              <input
                type="color"
                value={stop.color}
                onChange={(e) =>
                  updateColorStop(stop.id, { color: e.target.value })
                }
                style={assayOutlineColorInputStyle}
                title={stop.label}
              />
              <input
                type="text"
                value={stop.label}
                onChange={(e) =>
                  updateColorStop(stop.id, { label: e.target.value })
                }
                style={drillingAssayColorNameStyle}
              />
            </div>
          ))}
        </div>
        <div style={drillingAssayHintStyle}>
          Assay intervals are loaded from drillhole_assays.json; lithology bands
          are loaded from drillhole_lithology.json.
        </div>
      </div>
    </details>
  );
}

function PageEnvironmentOverridePanel({
  page,
  setPageField,
  accentColor,
}: {
  page: PresentationPage;
  setPageField: (
    pageId: string,
    patch: Partial<
      Pick<
        PresentationPage,
        | "cinematicExposure"
        | "bloomBoost"
        | "sunLockToCamera"
        | "renderPreset"
        | "renderPresetId"
      >
    >,
  ) => void;
  accentColor?: string | null;
}) {
  return (
    <LayerGroup
      title="Page Render Preset Override"
      devSource="src/editor/LayerPanel.tsx:704"
      devNote="PageEnvironmentOverridePanel controls per-page Exposure and Bloom overrides."
      accentColor={accentColor}
    >
      <PageRenderPresetOverrideRow
        value={page.renderPreset ?? page.renderPresetId ?? ""}
        onChange={(value) =>
          setPageField(page.id, {
            renderPreset: value ? (value as RenderPresetId) : undefined,
            renderPresetId: undefined,
          })
        }
      />
      <div style={pageRenderPresetHelpStyle}>
        Overrides the project render preset for this page only.
      </div>
      <PageMoodOverrideRow
        label="Exposure"
        value={page.cinematicExposure ?? 1}
        min={0.4}
        max={2}
        step={0.05}
        overridden={page.cinematicExposure !== undefined}
        onEnable={() => setPageField(page.id, { cinematicExposure: 1 })}
        onClear={() => setPageField(page.id, { cinematicExposure: undefined })}
        onChange={(value) =>
          setPageField(page.id, { cinematicExposure: value })
        }
      />
      <PageMoodOverrideRow
        label="Bloom"
        value={page.bloomBoost ?? 1}
        min={0}
        max={3}
        step={0.05}
        overridden={page.bloomBoost !== undefined}
        onEnable={() => setPageField(page.id, { bloomBoost: 1 })}
        onClear={() => setPageField(page.id, { bloomBoost: undefined })}
        onChange={(value) => setPageField(page.id, { bloomBoost: value })}
      />
      <PageBooleanOverrideRow
        label="Sun follows camera"
        value={page.sunLockToCamera === true}
        overridden={page.sunLockToCamera !== undefined}
        onEnable={() => setPageField(page.id, { sunLockToCamera: true })}
        onClear={() => setPageField(page.id, { sunLockToCamera: undefined })}
        onChange={(value) => setPageField(page.id, { sunLockToCamera: value })}
      />
    </LayerGroup>
  );
}

function PageRenderPresetOverrideRow({
  value,
  onChange,
}: {
  value: RenderPresetId | "";
  onChange: (value: RenderPresetId | "") => void;
}) {
  const { state } = useEditor();
  const renderPresetOptions = renderPresetOptionsForEnvironment(
    state.environment,
  );
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>Render preset</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RenderPresetId | "")}
        style={{ ...panelStyles.textInput, flex: 1, minWidth: 0 }}
        title="Override the project render preset for this page"
      >
        <option value="">Inherit project preset</option>
        {renderPresetOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span style={value ? overrideTagActiveStyle : overrideTagStyle}>
        {value ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function PageBooleanOverrideRow({
  label,
  value,
  overridden,
  onEnable,
  onClear,
  onChange,
}: {
  label: string;
  value: boolean;
  overridden: boolean;
  onEnable: () => void;
  onClear: () => void;
  onChange: (value: boolean) => void;
}) {
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>{label}</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onEnable();
          else onClear();
        }}
        title="Override environment setup for this page"
      />
      <input
        type="checkbox"
        checked={value}
        disabled={!overridden}
        onChange={(e) => onChange(e.target.checked)}
        title="Force this page on or off"
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function PageMoodOverrideRow({
  label,
  value,
  min,
  max,
  step,
  overridden,
  onEnable,
  onClear,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  overridden: boolean;
  onEnable: () => void;
  onClear: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>{label}</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onEnable();
          else onClear();
        }}
        title="Override environment setup for this page"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={!overridden}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={
          {
            flex: 1,
            opacity: overridden ? 1 : 0.4,
            "--editor-slider-fill": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
      <span style={sliderNumberReadoutStyle}>{value.toFixed(2)}</span>
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

const sliderNumberReadoutStyle: React.CSSProperties = {
  ...panelStyles.numberReadout,
  width: 44,
  marginLeft: 0,
  textAlign: "left",
};

const layerGroupStyle: React.CSSProperties = {
  marginBottom: 16,
  paddingLeft: 12,
};

// DEV NOTES: layer subheading bars
// --------------------------------
// These are the second-level bars inside the Layers panel:
// Environment, Topo map tile, Drilling, Targets & Tenure, Water, Topo overlays,
// Other.
//
// Material and full pill rounding come from `frostedSubheading` in styles.ts.
// Change this object when you want to adjust:
// - subheading height: padding / minHeight
// - text-to-chevron alignment: justifyContent / gap
// - distance from lower rows: padding and layerGroupStyle.marginBottom
//
// The layer rows below are intentionally plain. If Topography/Bedrock gets a
// heavier rounded white box again, look at layerGroupBodyStyle first.
const layerGroupSummaryStyle: React.CSSProperties = {
  ...frostedSubheading,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  width: "100%",
  minHeight: 42,
  padding: "0 18px",
  cursor: "pointer",
  userSelect: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "left",
  appearance: "none",
};

// Single-line title text in the subheading pill. Descriptive second-line text
// was intentionally removed, so group titles should stay short: Topo map tile,
// Drilling, Targets & Tenure, Water.
const layerGroupTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
  color: vibrancySecondaryLabel,
  minWidth: 0,
};

const layerGroupDisclosureStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
};

const layerGroupChevronStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRight: "2px solid rgba(0, 0, 0, 0.74)",
  borderBottom: "2px solid rgba(0, 0, 0, 0.74)",
  transformOrigin: "center",
  transition: "transform 160ms ease",
};

// DEV NOTES: layer group contents
// -------------------------------
// This is the plain list area below a subheading bar. It controls indentation,
// not material. Keep it lighter than the subheading bar unless you explicitly
// want the content rows boxed.
const layerGroupBodyStyle: React.CSSProperties = {
  padding: "8px 0 8px 28px",
};

const layerGroupFogControlStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: "0 12px 9px 0",
  marginBottom: 4,
  borderBottom: FROSTED_HAIRLINE,
};

const layerGroupFogControlRowStyle: React.CSSProperties = {
  ...panelStyles.row,
};

// Individual layer rows, for example Topography, Bedrock geology, or drillhole
// layers. The borderTop is the row separator inside a group.
const layerItemStyle: React.CSSProperties = {
  padding: "10px 12px 11px 0",
  borderTop: FROSTED_HAIRLINE,
};

const firstLayerItemStyle: React.CSSProperties = {
  borderTop: "none",
};

const layerControlsStyle: React.CSSProperties = {
  paddingLeft: 2,
};

const nestedDetailsStyle: React.CSSProperties = {
  marginTop: 7,
  paddingLeft: 10,
  boxSizing: "border-box",
};

const detailsContentStyle: React.CSSProperties = {
  padding: "4px 0 0 14px",
};

const miniInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72px minmax(0, 1fr)",
  gap: "4px 8px",
  alignItems: "baseline",
  margin: "6px 0",
  color: vibrancyTertiaryLabel,
  fontSize: 11,
  lineHeight: 1.25,
};

const compactCheckboxRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "18px minmax(0, 1fr)",
  alignItems: "center",
  gap: 7,
  color: vibrancySecondaryLabel,
  fontSize: 11,
  lineHeight: 1.25,
  margin: "4px 0",
};

const miniGroupTitleStyle: React.CSSProperties = {
  marginTop: 7,
  marginBottom: 4,
  color: vibrancyTertiaryLabel,
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0,
};

const smallActionButtonStyle: React.CSSProperties = {
  ...panelStyles.button,
  width: "100%",
  minHeight: 24,
  padding: "4px 8px",
  fontSize: 11,
};

const drillingAssayDetailsStyle: React.CSSProperties = {
  marginBottom: 10,
  padding: "6px 12px 8px 0",
  borderBottom: FROSTED_HAIRLINE,
};

const drillingAssaySummaryStyle: React.CSSProperties = {
  ...panelStyles.summary,
  fontWeight: 700,
  color: vibrancySecondaryLabel,
  marginBottom: 8,
};

const drillingAssayHintStyle: React.CSSProperties = {
  fontSize: 11,
  color: vibrancyTertiaryLabel,
  marginTop: 4,
  paddingLeft: 66,
  lineHeight: 1.3,
};

const drillingAssayPaletteStyle: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 8,
  paddingLeft: 66,
};

const drillingAssayPaletteTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: vibrancySecondaryLabel,
  marginBottom: 6,
};

const ezGammaControlsStyle: React.CSSProperties = {
  marginTop: 10,
};

const areaOutlineButtonStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  margin: "6px 0 10px",
};

const drillingAssayColorRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};

const drillingAssayColorNameStyle: React.CSSProperties = {
  ...panelStyles.textInput,
  minWidth: 0,
  height: 24,
  padding: "3px 10px",
  borderRadius: 999,
};

const assayOutlineColorInputStyle: React.CSSProperties = {
  width: 74,
  height: 24,
  border: "0",
  borderRadius: 999,
  padding: 0,
  overflow: "hidden",
  background: "transparent",
  cursor: "pointer",
};

const treeToggleButtonStyle: React.CSSProperties = {
  position: "relative",
  width: 62,
  height: 26,
  borderRadius: 999,
  border: FROSTED_HAIRLINE,
  padding: 0,
  flex: "0 0 auto",
  cursor: "pointer",
  font: "inherit",
  overflow: "hidden",
  transition: "background 160ms ease, border-color 160ms ease",
};

const treeToggleButtonActiveStyle: React.CSSProperties = {
  background: "rgba(25, 53, 37, 0.7)",
  borderColor: "rgba(25, 53, 37, 0.28)",
  color: "rgba(255, 255, 255, 0.92)",
};

const treeToggleButtonInactiveStyle: React.CSSProperties = {
  ...thinLightMaterial,
  background: "rgba(18, 21, 24, 0.38)",
  color: vibrancySecondaryLabel,
};

const treeToggleThumbStyle: React.CSSProperties = {
  position: "absolute",
  left: 3,
  top: 3,
  width: 20,
  height: 20,
  borderRadius: 999,
  background: "rgba(244, 240, 232, 0.86)",
  boxShadow: "none",
  transition: "transform 160ms ease",
};

const treeToggleTextStyle: React.CSSProperties = {
  position: "absolute",
  left: 25,
  right: 8,
  top: 5,
  fontSize: 11,
  fontWeight: 700,
  textAlign: "center",
  lineHeight: "16px",
};

const nestedControlRowStyle: React.CSSProperties = {
  ...panelStyles.row,
};

const nestedFieldLabelStyle: React.CSSProperties = {
  ...panelStyles.fieldLabel,
  width: 92,
  flex: "none",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

// ----- scene overlays (authoring) ------------------------------------------
//
// Mode-aware authoring controls -- env mode edits the registry entries
// (enabled flag, default opacity, provenance), page mode edits the
// per-page reference (presence + opacity override). Edits dispatch
// through the existing reducer pattern; live scene applies happen
// inside the dispatchers (see EditorContext) so the 3D viewport
// reflects the change before React re-renders.

const CLASSIFICATIONS_OVERLAY = [
  "observation",
  "interpretation",
  "narrative",
  "planned",
] as const;

function SceneOverlaysReadOnly({
  currentPage,
  accentColor,
}: {
  currentPage: PresentationPage | null;
  accentColor?: string | null;
}) {
  const { state } = useEditor();
  const overlays = state.environment.sceneOverlays ?? {};
  const ids = Object.keys(overlays);
  if (ids.length === 0) return null;
  const isEnv = state.selectedPageId === ENVIRONMENT_SENTINEL;
  return (
    <LayerGroup
      title="Topo overlays"
      devSource="src/editor/LayerPanel.tsx:1039"
      devNote="Topo overlays groups environment-registered scene overlay controls under a Layers subheading."
      accentColor={accentColor}
    >
      {ids.map((id) => (
        <SceneOverlayRow
          key={id}
          id={id}
          isEnv={isEnv}
          currentPage={currentPage}
        />
      ))}
      {isEnv && <AddSceneOverlayForm />}
    </LayerGroup>
  );
}

function SceneOverlayRow({
  id,
  isEnv,
  currentPage,
}: {
  id: string;
  isEnv: boolean;
  currentPage: PresentationPage | null;
}) {
  const {
    state,
    setEnvSceneOverlayField,
    setEnvSceneOverlayProvenance,
    setPageSceneOverlay,
    removePageSceneOverlay,
    removeEnvSceneOverlay,
  } = useEditor();
  const def = state.environment.sceneOverlays?.[id];
  if (!def) return null;
  const enabled = def.enabled !== false;
  const envDefault = def.defaultOpacity ?? 0.85;
  const envTint = def.tint ?? "#ffffff";
  const ref = currentPage?.sceneOverlays?.find((r) => r.id === id);
  const onThisPage = !!ref && ref.visible !== false;
  const hasOpacityOverride = !!ref && typeof ref.opacity === "number";
  const hasTintOverride = !!ref && typeof ref.tint === "string";
  const effOpacity = ref?.opacity ?? envDefault;
  const effTint = ref?.tint ?? envTint;

  return (
    <div style={panelStyles.section}>
      <div style={panelStyles.sectionHeader}>
        <span style={panelStyles.layerLabel}>{def.label}</span>
        <span style={panelStyles.layerType}>
          {def.provenance.classification}
        </span>
        {isEnv && (
          <button
            style={{
              ...panelStyles.iconButton,
              marginLeft: 6,
            }}
            onClick={() => {
              if (
                confirm(
                  `Remove scene overlay "${def.label}"? Page references will be stripped.`,
                )
              ) {
                removeEnvSceneOverlay(id);
              }
            }}
            title="Remove this scene overlay from the environment"
          >
            ×
          </button>
        )}
      </div>

      {/* Visibility row */}
      <div style={panelStyles.row}>
        <label
          style={{
            ...panelStyles.checkboxRow,
            cursor: !isEnv && !currentPage ? "default" : "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={isEnv ? enabled : onThisPage}
            disabled={!isEnv && !currentPage}
            onChange={(e) => {
              if (isEnv) {
                setEnvSceneOverlayField(id, { enabled: e.target.checked });
              } else if (currentPage) {
                if (e.target.checked) {
                  setPageSceneOverlay(currentPage.id, id, { visible: true });
                } else {
                  removePageSceneOverlay(currentPage.id, id);
                }
              }
            }}
          />
          <span style={panelStyles.fieldLabel}>
            {isEnv ? "Enabled" : "Show on this page"}
          </span>
        </label>
      </div>

      {/* Opacity row */}
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Opacity</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isEnv ? envDefault : effOpacity}
          disabled={isEnv ? !enabled : !onThisPage}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (isEnv) {
              setEnvSceneOverlayField(id, { defaultOpacity: v });
            } else if (currentPage) {
              setPageSceneOverlay(currentPage.id, id, { opacity: v });
            }
          }}
          style={{ flex: 1 }}
        />
        <span style={panelStyles.numberReadout}>
          {(isEnv ? envDefault : effOpacity).toFixed(2)}
        </span>
      </div>

      {/* Page mode: env-default hint + revert affordance */}
      {!isEnv && currentPage && onThisPage && (
        <div
          style={{
            ...panelStyles.muted,
            fontSize: 11,
            marginTop: -4,
            marginBottom: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>env default: {envDefault.toFixed(2)}</span>
          {hasOpacityOverride && (
            <button
              style={{
                ...panelStyles.iconButton,
                width: "auto",
                padding: "0 8px",
                fontSize: 11,
              }}
              onClick={() =>
                setPageSceneOverlay(currentPage.id, id, {
                  opacity: undefined,
                })
              }
              title="Drop the per-page opacity override"
            >
              revert
            </button>
          )}
        </div>
      )}

      {/* Tint row -- multiplies against the texture in the shader.
          White = no tint. Env mode edits def.tint; page mode edits
          ref.tint with revert-to-env affordance. */}
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Tint</label>
        <input
          type="color"
          value={isEnv ? envTint : effTint}
          disabled={isEnv ? !enabled : !onThisPage}
          onChange={(e) => {
            const v = e.target.value;
            if (isEnv) {
              setEnvSceneOverlayField(id, { tint: v });
            } else if (currentPage) {
              setPageSceneOverlay(currentPage.id, id, { tint: v });
            }
          }}
        />
        {!isEnv && currentPage && onThisPage && hasTintOverride && (
          <button
            style={{
              ...panelStyles.iconButton,
              width: "auto",
              padding: "0 8px",
              fontSize: 11,
              marginLeft: 6,
            }}
            onClick={() =>
              setPageSceneOverlay(currentPage.id, id, { tint: undefined })
            }
            title="Drop the per-page tint override"
          >
            revert
          </button>
        )}
      </div>

      {/* Env mode: provenance details */}
      {isEnv && (
        <details style={{ marginTop: 4 }}>
          <summary style={{ ...panelStyles.muted, cursor: "pointer" }}>
            Provenance
          </summary>
          <div style={{ marginTop: 6 }}>
            <div style={panelStyles.row}>
              <label style={panelStyles.fieldLabel}>Source</label>
              <input
                type="text"
                value={def.provenance.source}
                onChange={(e) =>
                  setEnvSceneOverlayProvenance(id, {
                    source: e.target.value,
                  })
                }
                style={panelStyles.textInput}
              />
            </div>
            <div style={panelStyles.row}>
              <label style={panelStyles.fieldLabel}>Classification</label>
              <select
                value={def.provenance.classification}
                onChange={(e) =>
                  setEnvSceneOverlayProvenance(id, {
                    classification: e.target
                      .value as (typeof CLASSIFICATIONS_OVERLAY)[number],
                  })
                }
              >
                {CLASSIFICATIONS_OVERLAY.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div style={panelStyles.row}>
              <label style={panelStyles.fieldLabel}>Notes</label>
              <textarea
                value={def.provenance.notes ?? ""}
                onChange={(e) =>
                  setEnvSceneOverlayProvenance(id, { notes: e.target.value })
                }
                style={{ ...panelStyles.textInput, minHeight: 60 }}
              />
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

// ----- env-mode rows --------------------------------------------------------

function EnvVisibilityRow({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>Visible (default)</label>
      <input type="checkbox" checked={visible} onChange={onToggle} />
    </div>
  );
}

function EnvTreeVisibilityToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>Visible (default)</label>
      <ToggleButton active={visible} onClick={onToggle} />
    </div>
  );
}

function PageTreeVisibilityToggle({
  page,
  layerId,
  envVisible,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envVisible: boolean;
  onSet: (v: boolean) => void;
  onClear: () => void;
}) {
  const overridden = isVisibilityOverridden(page, layerId);
  const overrideVal = page.visibilityOverrides?.[layerId];
  const effective = overridden ? !!overrideVal : envVisible;

  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>Visible</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(effective);
          else onClear();
        }}
        title="Override environment default for this page"
      />
      <ToggleButton
        active={effective}
        onClick={() => onSet(!effective)}
        title={
          overridden
            ? "Toggle forest cover for this page"
            : "Toggle forest cover and create a page override"
        }
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  title,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onClick}
      title={title}
      style={{
        ...treeToggleButtonStyle,
        ...(active
          ? treeToggleButtonActiveStyle
          : treeToggleButtonInactiveStyle),
      }}
    >
      <span
        style={{
          ...treeToggleThumbStyle,
          transform: active ? "translateX(36px)" : "translateX(0)",
        }}
      />
      <span
        style={{
          ...treeToggleTextStyle,
          left: active ? 8 : 29,
          right: active ? 29 : 8,
        }}
      >
        {active ? "On" : "Off"}
      </span>
    </button>
  );
}

function EnvShowLabelsRow({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Show labels</label>
      <input type="checkbox" checked={value} onChange={onToggle} />
    </div>
  );
}

function EnvAffectedByFogRow({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Use fog</label>
      <ToggleButton
        active={value}
        onClick={onToggle}
        title="Include this layer in scene fog"
      />
    </div>
  );
}

function EnvLabelKindRow({
  value,
  onChange,
}: {
  value: NonNullable<EditableStyle["labelKind"]>;
  onChange: (v: NonNullable<EditableStyle["labelKind"]>) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Label type</label>
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value as NonNullable<EditableStyle["labelKind"]>)
        }
        style={panelStyles.textInput}
      >
        {LABEL_KIND_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PageLabelKindRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: NonNullable<EditableStyle["labelKind"]>;
  onSet: (v: NonNullable<EditableStyle["labelKind"]>) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(page, layerId, "labelKind");
  const overrideVal = page.layerOverrides?.[layerId]?.labelKind;
  const effective =
    overridden && (overrideVal === "landTitle" || overrideVal === "siteElement")
      ? overrideVal
      : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Label type</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment label type for this page"
      />
      <select
        value={effective}
        disabled={!overridden}
        onChange={(e) =>
          onSet(e.target.value as NonNullable<EditableStyle["labelKind"]>)
        }
        style={{
          ...panelStyles.textInput,
          flex: 1,
          opacity: overridden ? 1 : 0.4,
        }}
      >
        {LABEL_KIND_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function EnvLabelPointerVisibleRow({
  value,
  onToggle,
}: {
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Show pointer</label>
      <ToggleButton
        active={value}
        onClick={onToggle}
        title="Show or hide the connector from the label to its element"
      />
    </div>
  );
}

function PageLabelPointerVisibleRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: boolean;
  onSet: (v: boolean) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(
    page,
    layerId,
    "labelPointerVisible",
  );
  const overrideVal =
    page.layerOverrides?.[layerId]?.labelPointerVisible !== false;
  const effective = overridden ? overrideVal : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Show pointer</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment label pointer for this page"
      />
      <ToggleButton
        active={effective}
        onClick={() => onSet(!effective)}
        title={
          overridden
            ? "Toggle the label pointer for this page"
            : "Toggle the label pointer and create a page override"
        }
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function EnvLabelPointerSideRow({
  value,
  onChange,
}: {
  value: NonNullable<EditableStyle["labelPointerSide"]>;
  onChange: (v: NonNullable<EditableStyle["labelPointerSide"]>) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Pointer side</label>
      <select
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value as NonNullable<EditableStyle["labelPointerSide"]>,
          )
        }
        style={panelStyles.textInput}
      >
        {LABEL_POINTER_SIDE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PageLabelPointerSideRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: NonNullable<EditableStyle["labelPointerSide"]>;
  onSet: (v: NonNullable<EditableStyle["labelPointerSide"]>) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(page, layerId, "labelPointerSide");
  const overrideVal = page.layerOverrides?.[layerId]?.labelPointerSide;
  const effective =
    overridden &&
    (overrideVal === "left" ||
      overrideVal === "right" ||
      overrideVal === "auto")
      ? overrideVal
      : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Pointer side</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment pointer side for this page"
      />
      <select
        value={effective}
        disabled={!overridden}
        onChange={(e) =>
          onSet(
            e.target.value as NonNullable<EditableStyle["labelPointerSide"]>,
          )
        }
        style={{
          ...panelStyles.textInput,
          flex: 1,
          opacity: overridden ? 1 : 0.4,
        }}
      >
        {LABEL_POINTER_SIDE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function PageShowLabelsRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: boolean;
  onSet: (v: boolean) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(page, layerId, "showLabels");
  const overrideVal = page.layerOverrides?.[layerId]?.showLabels === true;
  const effective = overridden ? overrideVal : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Show labels</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment default for this page"
      />
      <input
        type="checkbox"
        checked={effective}
        disabled={!overridden}
        onChange={(e) => onSet(e.target.checked)}
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function PageAffectedByFogRow({
  page,
  layerId,
  envValue,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envValue: boolean;
  onSet: (v: boolean) => void;
  onClear: () => void;
}) {
  const overridden = isStyleFieldOverridden(page, layerId, "affectedByFog");
  const overrideVal = page.layerOverrides?.[layerId]?.affectedByFog !== false;
  const effective = overridden ? overrideVal : envValue;
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Use fog</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) onSet(envValue);
          else onClear();
        }}
        title="Override environment fog behavior for this page"
      />
      <ToggleButton
        active={effective}
        onClick={() => onSet(!effective)}
        title={
          overridden
            ? "Toggle fog for this page"
            : "Toggle fog and create a page override"
        }
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function EnvStyleRow({
  label,
  inputType,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  decimals = 2,
  testId,
  onChange,
}: {
  label: string;
  inputType: "color" | "range" | "number";
  value: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  testId?: string;
  onChange: (v: string) => void;
}) {
  const rangeValue = parseFloat(value);
  const safeValue = Number.isFinite(rangeValue) ? rangeValue : min;
  const fill = Math.max(
    0,
    Math.min(100, ((safeValue - min) / (max - min)) * 100),
  );
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      {inputType === "range" ? (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            data-testid={testId}
            onChange={(e) => onChange(e.target.value)}
            style={
              {
                flex: 1,
                "--editor-slider-fill": `${fill}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {safeValue.toFixed(decimals)}
          </span>
        </>
      ) : inputType === "number" ? (
        <input
          type="number"
          value={value}
          step={step}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
      ) : (
        <input
          type="color"
          value={value}
          data-testid={testId}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function surfaceGradientPatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    surfaceGradientLowColor: styleString(
      style,
      "surfaceGradientLowColor",
      SURFACE_GRADIENT_DEFAULT_LOW,
    ),
    surfaceGradientMidColor: styleString(
      style,
      "surfaceGradientMidColor",
      SURFACE_GRADIENT_DEFAULT_MID,
    ),
    surfaceGradientHighColor: styleString(
      style,
      "surfaceGradientHighColor",
      SURFACE_GRADIENT_DEFAULT_HIGH,
    ),
    surfaceGradientMidpoint: styleNumber(style, "surfaceGradientMidpoint", 0.5),
    surfaceGradientContrast: styleNumber(style, "surfaceGradientContrast", 1),
  };
}

function scalarRampPatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    ...sectionIsoPatchFromStyle(style),
    scalarColorLow: styleString(style, "scalarColorLow", "#2cc9ff"),
    scalarColorMid: styleString(style, "scalarColorMid", "#f8dd6d"),
    scalarColorHigh: styleString(style, "scalarColorHigh", "#ff637a"),
    scalarBlendMin: styleNumber(
      style,
      "scalarBlendMin",
      styleNumber(style, "scalarDisplayMin", 0.139879),
    ),
    scalarBlendMax: styleNumber(
      style,
      "scalarBlendMax",
      styleNumber(style, "scalarDisplayMax", 3.937122),
    ),
    scalarDisplayMin: styleNumber(
      style,
      "scalarDisplayMin",
      styleNumber(style, "scalarDisplayMin", 0.139879),
    ),
    scalarDisplayMax: styleNumber(
      style,
      "scalarDisplayMax",
      styleNumber(style, "scalarDisplayMax", 3.937122),
    ),
    scalarFocusMin: styleNumber(style, "scalarFocusMin", SCALAR_SOURCE_MIN),
    scalarFocusMax: styleNumber(style, "scalarFocusMax", SCALAR_SOURCE_MAX),
    scalarInclusionMode:
      style.scalarInclusionMode === "thresholded" ? "thresholded" : "all-valid",
    scalarMidpoint: styleNumber(style, "scalarMidpoint", 0.5),
    scalarContrast: styleNumber(style, "scalarContrast", 1),
  };
}

function sectionIsoPatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    sectionIsoEnabled: styleBoolean(style, "sectionIsoEnabled", false),
    sectionIsoLinesVisible: styleBoolean(style, "sectionIsoLinesVisible", true),
    sectionIsoBandsVisible: styleBoolean(style, "sectionIsoBandsVisible", true),
    sectionIsoTargetIds:
      typeof style.sectionIsoTargetIds === "object" &&
      style.sectionIsoTargetIds !== null
        ? { ...(style.sectionIsoTargetIds as Record<string, boolean>) }
        : {},
    sectionIsoMin: styleNumber(style, "sectionIsoMin", SCALAR_SOURCE_MIN),
    sectionIsoMax: styleNumber(style, "sectionIsoMax", SCALAR_SOURCE_MAX),
    sectionIsoLevelCount: Math.max(
      2,
      Math.min(32, Math.round(styleNumber(style, "sectionIsoLevelCount", 32))),
    ),
    sectionIsoLineWidth: styleNumber(style, "sectionIsoLineWidth", 2.6),
    sectionIsoLineStyle:
      style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid",
    sectionIsoBandOpacity: styleNumber(style, "sectionIsoBandOpacity", 0.32),
    sectionIsoFillOffset: styleNumber(style, "sectionIsoFillOffset", 0),
    sectionIsoSourceOpacity: styleNumber(style, "sectionIsoSourceOpacity", 0),
  };
}

function mtTopSurfacePatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    meshSurfaceLiftM: styleNumber(style, "meshSurfaceLiftM", 0),
    meshWireframe: styleBoolean(style, "meshWireframe", false),
    meshRoughness: styleNumber(style, "meshRoughness", 0.72),
    meshMetalness: styleNumber(style, "meshMetalness", 0.02),
  };
}

function mtVolumePatchFromStyle(style: EditableStyle): Partial<EditableStyle> {
  return {
    ...scalarRampPatchFromStyle(style),
    scalarVolumeProductId:
      typeof style.scalarVolumeProductId === "string"
        ? style.scalarVolumeProductId
        : "mt-resistivity-forge-focused-volume",
    scalarVolumeRenderMode: "raymarch",
    scalarVolumeOpacity: styleNumber(
      style,
      "scalarVolumeOpacity",
      styleNumber(style, "opacity", 0.48),
    ),
    scalarVolumeDensity: styleNumber(style, "scalarVolumeDensity", 0.72),
    scalarVolumeSampleSteps: styleNumber(style, "scalarVolumeSampleSteps", 112),
    scalarVolumeTransferMode:
      style.scalarVolumeTransferMode === "soft" ||
      style.scalarVolumeTransferMode === "dense"
        ? style.scalarVolumeTransferMode
        : "balanced",
    scalarVolumeThresholdMin: styleNumber(
      style,
      "scalarVolumeThresholdMin",
      SCALAR_SOURCE_MIN,
    ),
    scalarVolumeThresholdMax: styleNumber(
      style,
      "scalarVolumeThresholdMax",
      SCALAR_SOURCE_MAX,
    ),
    scalarVolumeMaskVisible: styleBoolean(
      style,
      "scalarVolumeMaskVisible",
      true,
    ),
    scalarLegendVisible: styleBoolean(style, "scalarLegendVisible", true),
    opacity: styleNumber(style, "opacity", 0.48),
  };
}

function mtThresholdSurfacePatchFromStyle(
  style: EditableStyle,
): Partial<EditableStyle> {
  return {
    mtThresholdSurfaceVisibility:
      typeof style.mtThresholdSurfaceVisibility === "object" &&
      style.mtThresholdSurfaceVisibility !== null
        ? { ...(style.mtThresholdSurfaceVisibility as Record<string, boolean>) }
        : {
            "conductive-le-10-ohm-m": false,
            "conductive-le-30-ohm-m": true,
            "resistive-ge-1000-ohm-m": true,
          },
    mtThresholdSurfaceWireframe: styleBoolean(
      style,
      "mtThresholdSurfaceWireframe",
      false,
    ),
    opacity: styleNumber(style, "opacity", 0.42),
  };
}

interface SeismicProductOption {
  id: string;
  label: string;
  surveyKind?: string;
  productKind?: string;
  domainKind?: string;
  domainUnit?: string;
  sourceSubmission?: string;
  amplitudeStats?: {
    min?: number;
    max?: number;
    p02?: number;
    p98?: number;
    mean?: number;
  };
  raymarchCapable?: boolean;
}

interface SeismicAudiencePresetOption {
  id: string;
  label: string;
  audienceMode?: EditableStyle["seismicAudienceMode"];
  summary?: string;
  displayRecipeId?: string;
  productId?: string;
  visibleProductIds?: string[];
  renderMode?: EditableStyle["seismicRenderMode"];
  sliceAxis?: EditableStyle["seismicSliceAxis"];
  sliceFraction?: number;
  opacity?: number;
  amplitudeMin?: number;
  amplitudeMax?: number;
  amplitudeGamma?: number;
  colormap?: EditableStyle["seismicColormap"];
  removeBackground?: boolean;
  backgroundCutoff?: number;
  volumeSampleSteps?: number;
  timeScale?: number;
  navigationVisible?: boolean;
  navigationRoleVisibility?: EditableStyle["seismicNavigationRoleVisibility"];
  sliceThroughVolume?: boolean;
  comparisonProductId?: string;
  comparisonMode?: EditableStyle["seismicComparisonMode"];
  mtCoRender?: EditableStyle["seismicMtCoRender"];
  mtStylePatch?: Partial<EditableStyle>;
  exportLayoutId?: string;
  capabilityGroup?: string;
  cameraShot?: string;
  badges?: string[];
  caveats?: string[];
}

interface SeismicExportLayoutOption {
  id: string;
  label: string;
  output?: string;
  includes?: string[];
  caveat?: string;
}

const SEISMIC_AUDIENCE_MODE_OPTIONS = [
  { value: "investor", label: "Investor" },
  { value: "technical", label: "Technical" },
  { value: "data-room", label: "Data room" },
  { value: "export", label: "Export" },
] as const satisfies readonly {
  value: NonNullable<EditableStyle["seismicAudienceMode"]>;
  label: string;
}[];

const SEISMIC_DEMO_DISCLOSURE_LABELS = [
  "public geothermal demo data",
  "processed seismic product",
  "not a mineral resource estimate",
];

function seismicIndustryLabel(label: string): string {
  return label
    .replace(/\bUtah\s+FORGE\b/gi, "")
    .replace(/\bUtah\b/gi, "")
    .replace(/\bFORGE\s*3D\b/gi, "3D")
    .replace(/\bForge\s*3d\b/gi, "3D")
    .replace(/\bForge3D\b/g, "3D")
    .replace(/\bForge3d\b/g, "3D")
    .replace(/\bFORGE[-\s]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function seismicColormapFromValue(
  value: unknown,
): NonNullable<EditableStyle["seismicColormap"]> {
  return value === "grayscale" || value === "velocity"
    ? value
    : "blue-white-red";
}

function isVelocityProduct(product: SeismicProductOption | undefined): boolean {
  return (
    product?.productKind === "velocity" ||
    product?.domainKind === "velocity-time"
  );
}

function seismicWindowValueLabel(
  product: SeismicProductOption | undefined,
  normalized: number,
): string {
  if (!isVelocityProduct(product)) return normalized.toFixed(2);
  const stats = product?.amplitudeStats;
  const min = typeof stats?.p02 === "number" ? stats.p02 : stats?.min;
  const max = typeof stats?.p98 === "number" ? stats.p98 : stats?.max;
  if (typeof min !== "number" || typeof max !== "number" || max <= min) {
    return `${normalized.toFixed(2)} window`;
  }
  return `${Math.round(min + (max - min) * normalized).toLocaleString()} m/s`;
}

function seismicProductOptions(
  layer: ProjectLayerSpec,
): SeismicProductOption[] {
  const rawProducts = (layer.metadata as Record<string, unknown>)
    .seismicProducts;
  if (!Array.isArray(rawProducts)) return [];
  return rawProducts
    .map((raw): SeismicProductOption | null => {
      if (!raw || typeof raw !== "object") return null;
      const product = raw as Record<string, unknown>;
      if (typeof product.id !== "string" || typeof product.label !== "string") {
        return null;
      }
      return {
        id: product.id,
        label: seismicIndustryLabel(product.label),
        surveyKind:
          typeof product.surveyKind === "string"
            ? product.surveyKind
            : undefined,
        productKind:
          typeof product.productKind === "string"
            ? product.productKind
            : undefined,
        domainKind:
          typeof product.domainKind === "string"
            ? product.domainKind
            : undefined,
        domainUnit:
          typeof product.domainUnit === "string"
            ? product.domainUnit
            : undefined,
        sourceSubmission:
          typeof product.sourceSubmission === "string"
            ? product.sourceSubmission
            : undefined,
        amplitudeStats:
          product.amplitudeStats &&
          typeof product.amplitudeStats === "object" &&
          !Array.isArray(product.amplitudeStats)
            ? (product.amplitudeStats as SeismicProductOption["amplitudeStats"])
            : undefined,
        raymarchCapable: product.raymarchCapable === true,
      };
    })
    .filter((product): product is SeismicProductOption => product !== null);
}

function seismicAudiencePresets(
  layer: ProjectLayerSpec,
): SeismicAudiencePresetOption[] {
  const rawPresets = (layer.metadata as Record<string, unknown>)
    .seismicAudiencePresets;
  if (!Array.isArray(rawPresets)) return [];
  return rawPresets
    .map((raw): SeismicAudiencePresetOption | null => {
      if (!raw || typeof raw !== "object") return null;
      const preset = raw as Record<string, unknown>;
      if (typeof preset.id !== "string" || typeof preset.label !== "string") {
        return null;
      }
      const audienceMode =
        preset.audienceMode === "investor" ||
        preset.audienceMode === "technical" ||
        preset.audienceMode === "data-room" ||
        preset.audienceMode === "export"
          ? preset.audienceMode
          : undefined;
      const mtCoRender =
        preset.mtCoRender === "seismic" ||
        preset.mtCoRender === "mt" ||
        preset.mtCoRender === "integrated"
          ? preset.mtCoRender
          : undefined;
      const mtStylePatch =
        preset.mtStylePatch &&
        typeof preset.mtStylePatch === "object" &&
        !Array.isArray(preset.mtStylePatch)
          ? (preset.mtStylePatch as Partial<EditableStyle>)
          : undefined;
      const navigationRoleVisibility =
        preset.navigationRoleVisibility &&
        typeof preset.navigationRoleVisibility === "object" &&
        !Array.isArray(preset.navigationRoleVisibility)
          ? (preset.navigationRoleVisibility as EditableStyle["seismicNavigationRoleVisibility"])
          : undefined;
      return {
        id: preset.id,
        label: preset.label,
        audienceMode,
        summary:
          typeof preset.summary === "string" ? preset.summary : undefined,
        displayRecipeId:
          typeof preset.displayRecipeId === "string"
            ? preset.displayRecipeId
            : undefined,
        productId:
          typeof preset.productId === "string" ? preset.productId : undefined,
        visibleProductIds: Array.isArray(preset.visibleProductIds)
          ? preset.visibleProductIds.filter(
              (id): id is string => typeof id === "string",
            )
          : undefined,
        renderMode: preset.renderMode === "raymarch" ? "raymarch" : "slice",
        sliceAxis:
          preset.sliceAxis === "crossline" ||
          preset.sliceAxis === "sample" ||
          preset.sliceAxis === "line"
            ? preset.sliceAxis
            : "inline",
        sliceFraction:
          typeof preset.sliceFraction === "number"
            ? preset.sliceFraction
            : undefined,
        opacity:
          typeof preset.opacity === "number" ? preset.opacity : undefined,
        amplitudeMin:
          typeof preset.amplitudeMin === "number"
            ? preset.amplitudeMin
            : undefined,
        amplitudeMax:
          typeof preset.amplitudeMax === "number"
            ? preset.amplitudeMax
            : undefined,
        amplitudeGamma:
          typeof preset.amplitudeGamma === "number"
            ? preset.amplitudeGamma
            : undefined,
        colormap: seismicColormapFromValue(preset.colormap),
        removeBackground: preset.removeBackground === true,
        backgroundCutoff:
          typeof preset.backgroundCutoff === "number"
            ? preset.backgroundCutoff
            : undefined,
        volumeSampleSteps:
          typeof preset.volumeSampleSteps === "number"
            ? preset.volumeSampleSteps
            : undefined,
        timeScale:
          typeof preset.timeScale === "number" ? preset.timeScale : undefined,
        navigationVisible:
          typeof preset.navigationVisible === "boolean"
            ? preset.navigationVisible
            : undefined,
        navigationRoleVisibility,
        sliceThroughVolume: preset.sliceThroughVolume === true,
        comparisonProductId:
          typeof preset.comparisonProductId === "string"
            ? preset.comparisonProductId
            : undefined,
        comparisonMode:
          preset.comparisonMode === "side-by-side" ? "side-by-side" : "overlay",
        mtCoRender,
        mtStylePatch,
        exportLayoutId:
          typeof preset.exportLayoutId === "string"
            ? preset.exportLayoutId
            : undefined,
        capabilityGroup:
          typeof preset.capabilityGroup === "string"
            ? preset.capabilityGroup
            : undefined,
        cameraShot:
          typeof preset.cameraShot === "string" ? preset.cameraShot : undefined,
        badges: Array.isArray(preset.badges)
          ? preset.badges.filter(
              (badge): badge is string => typeof badge === "string",
            )
          : undefined,
        caveats: Array.isArray(preset.caveats)
          ? preset.caveats.filter(
              (caveat): caveat is string => typeof caveat === "string",
            )
          : undefined,
      };
    })
    .filter((preset): preset is SeismicAudiencePresetOption => preset !== null);
}

function seismicCapabilityPresets(
  layer: ProjectLayerSpec,
): SeismicAudiencePresetOption[] {
  const rawPresets = (layer.metadata as Record<string, unknown>)
    .seismicCapabilityPresets;
  if (!Array.isArray(rawPresets)) return [];
  return seismicAudiencePresets({
    ...layer,
    metadata: {
      ...(layer.metadata as Record<string, unknown>),
      seismicAudiencePresets: rawPresets,
    },
  });
}

function seismicExportLayouts(
  layer: ProjectLayerSpec,
): SeismicExportLayoutOption[] {
  const rawLayouts = (layer.metadata as Record<string, unknown>)
    .seismicExportLayouts;
  if (!Array.isArray(rawLayouts)) return [];
  return rawLayouts
    .map((raw): SeismicExportLayoutOption | null => {
      if (!raw || typeof raw !== "object") return null;
      const layout = raw as Record<string, unknown>;
      if (typeof layout.id !== "string" || typeof layout.label !== "string") {
        return null;
      }
      return {
        id: layout.id,
        label: layout.label,
        output: typeof layout.output === "string" ? layout.output : undefined,
        includes: Array.isArray(layout.includes)
          ? layout.includes.filter(
              (item): item is string => typeof item === "string",
            )
          : undefined,
        caveat: typeof layout.caveat === "string" ? layout.caveat : undefined,
      };
    })
    .filter((layout): layout is SeismicExportLayoutOption => layout !== null);
}

function seismicAudienceModeFromStyle(
  style: EditableStyle,
): NonNullable<EditableStyle["seismicAudienceMode"]> {
  return style.seismicAudienceMode === "technical" ||
    style.seismicAudienceMode === "data-room" ||
    style.seismicAudienceMode === "export"
    ? style.seismicAudienceMode
    : "investor";
}

function seismicPresetPatch(
  preset: SeismicAudiencePresetOption,
  products: SeismicProductOption[],
  fallbackProductId: string,
): Partial<EditableStyle> {
  const productIds = new Set(products.map((product) => product.id));
  const productId =
    preset.productId && productIds.has(preset.productId)
      ? preset.productId
      : fallbackProductId;
  const visibleIds = new Set(
    (preset.visibleProductIds ?? [productId]).filter((id) =>
      productIds.has(id),
    ),
  );
  if (visibleIds.size === 0 && productId) visibleIds.add(productId);
  const product = products.find((candidate) => candidate.id === productId);
  const renderMode =
    preset.renderMode === "raymarch" && product?.raymarchCapable
      ? "raymarch"
      : "slice";
  const sliceAxis =
    product?.surveyKind !== "3d"
      ? "line"
      : preset.sliceAxis === "crossline" || preset.sliceAxis === "sample"
        ? preset.sliceAxis
        : "inline";
  return {
    seismicAudienceMode: preset.audienceMode ?? "investor",
    seismicAudiencePresetId: preset.capabilityGroup ? undefined : preset.id,
    seismicCapabilityPresetId: preset.capabilityGroup ? preset.id : undefined,
    seismicDisplayRecipeId: preset.displayRecipeId,
    seismicProductId: productId,
    seismicProductVisibility: Object.fromEntries(
      products.map((candidate) => [candidate.id, visibleIds.has(candidate.id)]),
    ),
    seismicRenderMode: renderMode,
    seismicSliceAxis: sliceAxis,
    seismicSliceFraction:
      typeof preset.sliceFraction === "number" ? preset.sliceFraction : 0.5,
    seismicAmplitudeMin:
      typeof preset.amplitudeMin === "number" ? preset.amplitudeMin : 0.08,
    seismicAmplitudeMax:
      typeof preset.amplitudeMax === "number" ? preset.amplitudeMax : 0.92,
    seismicAmplitudeGamma:
      typeof preset.amplitudeGamma === "number" ? preset.amplitudeGamma : 1,
    seismicColormap: seismicColormapFromValue(preset.colormap),
    seismicRemoveBackground: preset.removeBackground === true,
    seismicBackgroundCutoff:
      typeof preset.backgroundCutoff === "number"
        ? preset.backgroundCutoff
        : 0.16,
    seismicVolumeSampleSteps:
      typeof preset.volumeSampleSteps === "number"
        ? preset.volumeSampleSteps
        : 96,
    seismicTimeScale:
      typeof preset.timeScale === "number" ? preset.timeScale : 2,
    seismicNavigationVisible:
      typeof preset.navigationVisible === "boolean"
        ? preset.navigationVisible
        : true,
    seismicNavigationRoleVisibility: preset.navigationRoleVisibility ?? {
      sources: true,
      receivers: true,
      lines: true,
    },
    seismicSliceThroughVolume:
      preset.sliceThroughVolume === true && product?.raymarchCapable === true,
    seismicComparisonProductId: preset.comparisonProductId,
    seismicComparisonMode:
      preset.comparisonMode === "side-by-side" ? "side-by-side" : "overlay",
    seismicExportLayoutId: preset.exportLayoutId,
    seismicMtCoRender: preset.mtCoRender,
    opacity: typeof preset.opacity === "number" ? preset.opacity : 0.62,
  };
}

function seismicDefaultProductId(layer: ProjectLayerSpec): string {
  const metadata = layer.metadata as Record<string, unknown>;
  if (typeof metadata.defaultSeismicProductId === "string") {
    return metadata.defaultSeismicProductId;
  }
  return seismicProductOptions(layer)[0]?.id ?? "";
}

function seismicProductVisibilityFromStyle(
  style: EditableStyle,
  products: SeismicProductOption[],
  selectedProductId: string,
): Record<string, boolean> {
  const rawVisibility =
    typeof style.seismicProductVisibility === "object" &&
    style.seismicProductVisibility !== null
      ? style.seismicProductVisibility
      : {};
  const hasExplicitVisibility = Object.keys(rawVisibility).length > 0;
  return Object.fromEntries(
    products.map((product) => [
      product.id,
      hasExplicitVisibility
        ? rawVisibility[product.id] === true
        : product.id === selectedProductId,
    ]),
  );
}

function seismicBrowserPatchFromStyle(
  style: EditableStyle,
  layer: ProjectLayerSpec,
): Partial<EditableStyle> {
  const products = seismicProductOptions(layer);
  const defaultProductId = seismicDefaultProductId(layer);
  const rawProductId = styleString(style, "seismicProductId", defaultProductId);
  const productId = products.some((product) => product.id === rawProductId)
    ? rawProductId
    : defaultProductId;
  return {
    ...sectionIsoPatchFromStyle(style),
    seismicAudienceMode: seismicAudienceModeFromStyle(style),
    seismicAudiencePresetId:
      typeof style.seismicAudiencePresetId === "string"
        ? style.seismicAudiencePresetId
        : undefined,
    seismicCapabilityPresetId:
      typeof style.seismicCapabilityPresetId === "string"
        ? style.seismicCapabilityPresetId
        : undefined,
    seismicDisplayRecipeId:
      typeof style.seismicDisplayRecipeId === "string"
        ? style.seismicDisplayRecipeId
        : undefined,
    seismicProductId: productId,
    seismicProductVisibility: seismicProductVisibilityFromStyle(
      style,
      products,
      productId,
    ),
    seismicRenderMode:
      style.seismicRenderMode === "raymarch" ? "raymarch" : "slice",
    seismicSliceAxis:
      style.seismicSliceAxis === "crossline" ||
      style.seismicSliceAxis === "sample" ||
      style.seismicSliceAxis === "line"
        ? style.seismicSliceAxis
        : "inline",
    seismicSliceFraction: styleNumber(style, "seismicSliceFraction", 0.5),
    seismicAmplitudeMin: styleNumber(style, "seismicAmplitudeMin", 0.08),
    seismicAmplitudeMax: styleNumber(style, "seismicAmplitudeMax", 0.92),
    seismicAmplitudeGamma: styleNumber(style, "seismicAmplitudeGamma", 1),
    seismicColormap: seismicColormapFromValue(style.seismicColormap),
    seismicRemoveBackground: styleBoolean(
      style,
      "seismicRemoveBackground",
      false,
    ),
    seismicBackgroundCutoff: styleNumber(
      style,
      "seismicBackgroundCutoff",
      0.16,
    ),
    seismicVolumeSampleSteps: styleNumber(
      style,
      "seismicVolumeSampleSteps",
      96,
    ),
    seismicTimeScale: styleNumber(style, "seismicTimeScale", 2),
    seismicNavigationVisible: styleBoolean(
      style,
      "seismicNavigationVisible",
      true,
    ),
    seismicNavigationRoleVisibility:
      typeof style.seismicNavigationRoleVisibility === "object" &&
      style.seismicNavigationRoleVisibility !== null
        ? style.seismicNavigationRoleVisibility
        : { sources: true, receivers: true, lines: true },
    seismicSliceThroughVolume: styleBoolean(
      style,
      "seismicSliceThroughVolume",
      false,
    ),
    seismicComparisonProductId:
      typeof style.seismicComparisonProductId === "string"
        ? style.seismicComparisonProductId
        : undefined,
    seismicComparisonMode:
      style.seismicComparisonMode === "side-by-side"
        ? "side-by-side"
        : "overlay",
    seismicComparisonSpacingM: styleNumber(
      style,
      "seismicComparisonSpacingM",
      650,
    ),
    seismicExportLayoutId:
      typeof style.seismicExportLayoutId === "string"
        ? style.seismicExportLayoutId
        : undefined,
    seismicMtCoRender:
      style.seismicMtCoRender === "mt" ||
      style.seismicMtCoRender === "integrated"
        ? style.seismicMtCoRender
        : "seismic",
    seismicLegendVisible: styleBoolean(style, "seismicLegendVisible", true),
    sectionIsoMin: styleNumber(
      style,
      "sectionIsoMin",
      styleNumber(style, "seismicAmplitudeMin", 0.08),
    ),
    sectionIsoMax: styleNumber(
      style,
      "sectionIsoMax",
      styleNumber(style, "seismicAmplitudeMax", 0.92),
    ),
    opacity: styleNumber(style, "opacity", 0.62),
  };
}

function SeismicCapabilityLayerItem({
  title,
  type,
  testId,
  inactive = false,
  children,
}: {
  title: string;
  type: string;
  testId: string;
  inactive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      style={layerItemStyle}
      data-dev-note="Virtual seismic capability container. Controls patch the one real Utah FORGE seismic layer."
    >
      <div style={panelStyles.sectionHeader}>
        <div style={panelStyles.checkboxRow}>
          <span
            style={{
              ...panelStyles.layerLabel,
              color: inactive ? vibrancyTertiaryLabel : vibrancyLabel,
            }}
          >
            {title}
          </span>
        </div>
        <span
          style={{
            ...panelStyles.layerType,
            color: inactive ? vibrancyTertiaryLabel : vibrancySecondaryLabel,
          }}
        >
          {type}
        </span>
      </div>
      <div style={layerControlsStyle}>{children}</div>
    </div>
  );
}

type WorkingAreaFocusCapability = "two-zone" | "fallback" | "unsupported";

interface WorkingAreaFocusLayerOption {
  id: string;
  label: string;
  capability: WorkingAreaFocusCapability;
  capabilityLabel: string;
}

function workingAreaFocusCapabilityForLayer(
  layerId: string,
): Pick<WorkingAreaFocusLayerOption, "capability" | "capabilityLabel"> {
  if (layerId === UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID) {
    return {
      capability: "unsupported",
      capabilityLabel: "boundary only",
    };
  }
  if (
    layerId === UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID ||
    layerId === UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID ||
    layerId === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID ||
    layerId === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID
  ) {
    return {
      capability: "two-zone",
      capabilityLabel: "two-zone",
    };
  }
  return {
    capability: "fallback",
    capabilityLabel: "material fallback",
  };
}

function workingAreaFocusLayerOptions(
  allLayers: ProjectLayerSpec[],
): WorkingAreaFocusLayerOption[] {
  const byId = new Map(allLayers.map((layer) => [layer.id, layer]));
  return [
    UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_PREVIEW_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
    UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
    UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
    UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
    UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
    UTAH_FORGE_MT_STATIONS_LAYER_ID,
    "utah-forge-reference-stage",
    "terrain",
    "transport-roads",
    "hydrography-streams",
    "hydrography-lakes",
  ]
    .map((id) => {
      const layer = byId.get(id);
      if (!layer) return null;
      const capability = workingAreaFocusCapabilityForLayer(id);
      return {
        id,
        label:
          id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID
            ? "Seismic browser / survey geometry"
            : editorLayerLabel(layer),
        ...capability,
      };
    })
    .filter((layer): layer is WorkingAreaFocusLayerOption => layer !== null);
}

function workingAreaFocusDefaultTargets(
  options: WorkingAreaFocusLayerOption[],
): string[] {
  const optionIds = new Set(options.map((option) => option.id));
  return WORKING_AREA_FOCUS_DEFAULT_TARGET_LAYER_IDS.filter((id) =>
    optionIds.has(id),
  );
}

function workingAreaFocusTargetSet(
  style: EditableStyle,
  options: WorkingAreaFocusLayerOption[],
): Set<string> {
  const configured = Array.isArray(style.workingAreaFocusTargetLayerIds)
    ? style.workingAreaFocusTargetLayerIds.filter(
        (id) => typeof id === "string",
      )
    : workingAreaFocusDefaultTargets(options);
  const supportedIds = new Set(
    options
      .filter((option) => option.capability !== "unsupported")
      .map((option) => option.id),
  );
  return new Set(configured.filter((id) => supportedIds.has(id)));
}

function workingAreaFocusOpacityForLayer(
  style: EditableStyle,
  layerId: string,
): number {
  const value = style.workingAreaFocusOutsideOpacityByLayerId?.[layerId];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : WORKING_AREA_FOCUS_DEFAULT_OUTSIDE_OPACITY;
}

function completeWorkingAreaFocusOpacityMap(
  style: EditableStyle,
  options: WorkingAreaFocusLayerOption[],
  patch: Record<string, number> = {},
): Record<string, number> {
  return Object.fromEntries(
    options
      .filter((option) => option.capability !== "unsupported")
      .map((option) => [
        option.id,
        Math.max(
          0,
          Math.min(
            1,
            typeof patch[option.id] === "number"
              ? patch[option.id]
              : workingAreaFocusOpacityForLayer(style, option.id),
          ),
        ),
      ]),
  );
}

function WorkingAreaFocusContainer({
  allLayers,
  style,
  disabled,
  isEnv,
  currentPage,
  setEnvLayerStyle,
  setPageLayerOverride,
  sceneHandle,
}: {
  allLayers: ProjectLayerSpec[];
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  sceneHandle: SceneHandle;
}) {
  const layerOptions = workingAreaFocusLayerOptions(allLayers);
  const targetLayerIds = workingAreaFocusTargetSet(style, layerOptions);
  const enabled = styleBoolean(style, "workingAreaFocusEnabled", false);
  const mode =
    style.workingAreaFocusMode === "inside-only"
      ? "inside-only"
      : "outside-context";
  const helperVisible = styleBoolean(
    style,
    "workingAreaFocusHelperVisible",
    true,
  );
  const liveStyleRef = useRef(style);
  useEffect(() => {
    liveStyleRef.current = style;
  }, [style]);

  const commit = (patch: Partial<EditableStyle>) => {
    if (disabled) return;
    const base = liveStyleRef.current;
    const merged = {
      ...base,
      workingAreaFocusBoundsLayerId:
        base.workingAreaFocusBoundsLayerId ??
        UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
      workingAreaFocusOutsideOpacityByLayerId:
        completeWorkingAreaFocusOpacityMap(base, layerOptions),
      ...patch,
    };
    liveStyleRef.current = merged;
    sceneHandle.manager.applyStyle(
      UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
      merged,
    );
    if (isEnv) {
      setEnvLayerStyle(UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID, patch);
    } else if (currentPage) {
      setPageLayerOverride(
        currentPage.id,
        UTAH_FORGE_WORKING_AREA_FOCUS_LAYER_ID,
        patch,
      );
    }
  };

  const commitTargetLayerIds = (nextTargets: Set<string>) => {
    commit({
      workingAreaFocusTargetLayerIds: Array.from(nextTargets),
      workingAreaFocusOutsideOpacityByLayerId:
        completeWorkingAreaFocusOpacityMap(liveStyleRef.current, layerOptions),
    });
  };

  const toggleLayerTarget = (id: string, checked: boolean) => {
    const next = new Set(targetLayerIds);
    if (checked) next.add(id);
    else next.delete(id);
    commitTargetLayerIds(next);
  };

  const updateOutsideOpacity = (id: string, value: number) => {
    commit({
      workingAreaFocusOutsideOpacityByLayerId:
        completeWorkingAreaFocusOpacityMap(liveStyleRef.current, layerOptions, {
          [id]: value,
        }),
    });
  };

  return (
    <SeismicCapabilityLayerItem
      title="Working area focus"
      type="clip"
      testId="working-area-focus-container"
      inactive={!enabled}
    >
      <div style={detailsContentStyle}>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Enable focus</span>
          <input
            data-testid="working-area-focus-enabled"
            type="checkbox"
            disabled={disabled}
            checked={enabled}
            onChange={(event) =>
              commit({
                workingAreaFocusEnabled: event.target.checked,
                workingAreaFocusMode: mode,
                workingAreaFocusBoundsLayerId:
                  UTAH_FORGE_PHASE3_WORKING_AREA_LAYER_ID,
                workingAreaFocusTargetLayerIds: Array.from(targetLayerIds),
                workingAreaFocusOutsideOpacityByLayerId:
                  completeWorkingAreaFocusOpacityMap(
                    liveStyleRef.current,
                    layerOptions,
                  ),
              })
            }
          />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Mode</label>
          <select
            data-testid="working-area-focus-mode"
            disabled={disabled}
            value={mode}
            onChange={(event) =>
              commit({
                workingAreaFocusMode:
                  event.target.value === "inside-only"
                    ? "inside-only"
                    : "outside-context",
                workingAreaFocusOutsideOpacityByLayerId:
                  completeWorkingAreaFocusOpacityMap(
                    liveStyleRef.current,
                    layerOptions,
                  ),
              })
            }
            style={{ flex: 1 }}
          >
            <option value="outside-context">Dim outside</option>
            <option value="inside-only">Hide outside</option>
          </select>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Show box</span>
          <input
            data-testid="working-area-focus-helper-visible"
            type="checkbox"
            disabled={disabled}
            checked={helperVisible}
            onChange={(event) =>
              commit({ workingAreaFocusHelperVisible: event.target.checked })
            }
          />
        </label>
        <details open style={nestedDetailsStyle}>
          <summary style={panelStyles.summary}>Affected layers</summary>
          <div style={detailsContentStyle}>
            {layerOptions.map((layer) => {
              const supported = layer.capability !== "unsupported";
              const checked = supported && targetLayerIds.has(layer.id);
              const opacity = workingAreaFocusOpacityForLayer(style, layer.id);
              const sliderDisabled =
                disabled || !supported || !checked || mode === "inside-only";
              return (
                <div
                  key={layer.id}
                  style={{
                    marginBottom: 6,
                    opacity: supported ? 1 : 0.48,
                  }}
                >
                  <label
                    style={{
                      ...compactCheckboxRowStyle,
                      cursor: supported ? "pointer" : "not-allowed",
                    }}
                  >
                    <input
                      data-testid={`working-area-focus-target-${layer.id}`}
                      type="checkbox"
                      disabled={disabled || !supported}
                      checked={checked}
                      onChange={(event) =>
                        toggleLayerTarget(layer.id, event.target.checked)
                      }
                    />
                    <span>
                      {layer.label}
                      <span style={{ color: vibrancyTertiaryLabel }}>
                        {" "}
                        {layer.capabilityLabel}
                      </span>
                    </span>
                  </label>
                  {supported ? (
                    <div style={{ ...nestedControlRowStyle, paddingLeft: 18 }}>
                      <label style={nestedFieldLabelStyle}>Outside</label>
                      <input
                        data-testid={`working-area-focus-opacity-${layer.id}`}
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={sliderDisabled}
                        value={opacity}
                        onChange={(event) =>
                          updateOutsideOpacity(
                            layer.id,
                            parseFloat(event.target.value),
                          )
                        }
                        style={
                          {
                            flex: 1,
                            opacity: sliderDisabled ? 0.45 : 1,
                            "--editor-slider-fill": `${opacity * 100}%`,
                          } as React.CSSProperties
                        }
                      />
                      <span style={sliderNumberReadoutStyle}>
                        {mode === "inside-only" ? "0.00" : opacity.toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </SeismicCapabilityLayerItem>
  );
}

function SceneSectionPlanesContainer({
  seismicLayer,
  allLayers,
  style,
  disabled,
  isEnv,
  currentPage,
  setEnvLayerStyle,
  setPageLayerOverride,
  sceneHandle,
}: {
  seismicLayer?: ProjectLayerSpec;
  allLayers: ProjectLayerSpec[];
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  sceneHandle: SceneHandle;
}) {
  const products = seismicLayer ? seismicProductOptions(seismicLayer) : [];
  const defaultProductId = seismicLayer
    ? seismicDefaultProductId(seismicLayer)
    : (products[0]?.id ?? "");
  const enabled = styleBoolean(style, "sceneSectionEnabled", false);
  const mode = "cutaway";
  const targetScope =
    style.sceneSectionTargetScope === "all-visible" ||
    style.sceneSectionTargetScope === "active-selection"
      ? style.sceneSectionTargetScope
      : "selected-targets";
  const activeAxis =
    style.sceneSectionActiveAxis === "x" ||
    style.sceneSectionActiveAxis === "y" ||
    style.sceneSectionActiveAxis === "z"
      ? style.sceneSectionActiveAxis
      : "z";
  const planes = style.sceneSectionPlanes ?? {};
  const targetLayerIds = new Set(
    Array.isArray(style.sceneSectionTargetLayerIds)
      ? style.sceneSectionTargetLayerIds
      : [
          UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
          UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        ],
  );
  const targetProductIds = new Set(
    Array.isArray(style.sceneSectionTargetProductIds)
      ? style.sceneSectionTargetProductIds
      : defaultProductId
        ? [defaultProductId]
        : [],
  );
  const helperVisible = styleBoolean(style, "sceneSectionHelperVisible", true);
  const legendVisible = styleBoolean(style, "sceneSectionLegendVisible", true);
  const liveStyleRef = useRef(style);
  useEffect(() => {
    liveStyleRef.current = style;
  }, [style]);
  const commit = (patch: Partial<EditableStyle>) => {
    if (disabled) return;
    const merged = { ...liveStyleRef.current, ...patch };
    liveStyleRef.current = merged;
    sceneHandle.manager.applyStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, merged);
    if (isEnv) {
      setEnvLayerStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, patch);
    } else if (currentPage) {
      setPageLayerOverride(
        currentPage.id,
        UTAH_FORGE_SCENE_SECTION_LAYER_ID,
        patch,
      );
    }
  };
  const setPlanePatch = (
    axis: "x" | "y" | "z",
    patch: { enabled?: boolean; positionM?: number; invert?: boolean },
  ) => {
    commit({
      sceneSectionActiveAxis: axis,
      sceneSectionPlanes: {
        ...planes,
        [axis]: {
          ...(planes[axis] ?? {}),
          ...patch,
        },
      },
    });
  };
  const toggleLayerTarget = (id: string, checked: boolean) => {
    const next = new Set(targetLayerIds);
    if (checked) next.add(id);
    else next.delete(id);
    commit({ sceneSectionTargetLayerIds: Array.from(next) });
  };
  const toggleProductTarget = (id: string, checked: boolean) => {
    const next = new Set(targetProductIds);
    if (checked) next.add(id);
    else next.delete(id);
    commit({ sceneSectionTargetProductIds: Array.from(next) });
  };
  const layerOptions = allLayers
    .filter((layer) =>
      [
        UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID,
        UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        UTAH_FORGE_MT_RESISTIVITY_SLICES_LAYER_ID,
        UTAH_FORGE_MT_TOP_SURFACE_LAYER_ID,
        UTAH_FORGE_MT_STATIONS_LAYER_ID,
        "utah-forge-reference-stage",
      ].includes(layer.id),
    )
    .map((layer) => ({
      id: layer.id,
      label:
        layer.id === UTAH_FORGE_SEISMIC_BROWSER_LAYER_ID
          ? "Seismic browser / survey geometry"
          : layer.id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID
            ? "3D MT resistivity volume"
            : layer.id === UTAH_FORGE_MT_THRESHOLD_SURFACES_LAYER_ID
              ? "3D MT threshold surfaces"
              : editorLayerLabel(layer),
      supported:
        layer.id !== UTAH_FORGE_MT_STATIONS_LAYER_ID ||
        targetScope === "all-visible",
    }));
  const axisRanges = {
    x: { min: -140000, max: 140000, label: "X Section" },
    y: { min: -115000, max: 115000, label: "Y Section" },
    z: { min: -122000, max: 4000, label: "Z Section" },
  } as const;
  const controlDisabled = disabled || !enabled;

  const renderAxis = (axis: "x" | "y" | "z") => {
    const plane = planes[axis] ?? {};
    const range = axisRanges[axis];
    const isActiveAxis = axis === activeAxis;
    const planeEnabled = plane.enabled === true;
    const position =
      typeof plane.positionM === "number" && Number.isFinite(plane.positionM)
        ? plane.positionM
        : axis === "x"
          ? -6000
          : axis === "y"
            ? -10300
            : -2200;
    const fill =
      ((position - range.min) / Math.max(1, range.max - range.min)) * 100;
    return (
      <details
        key={axis}
        style={nestedDetailsStyle}
        data-testid={`scene-section-plane-${axis}`}
      >
        <summary
          style={{
            ...panelStyles.summary,
            color: isActiveAxis
              ? vibrancySecondaryLabel
              : panelStyles.summary.color,
          }}
        >
          {range.label}
          {isActiveAxis ? " active" : ""}
        </summary>
        <div style={detailsContentStyle}>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Enabled</span>
            <input
              data-testid={`scene-section-plane-${axis}-enabled`}
              type="checkbox"
              disabled={disabled}
              checked={planeEnabled}
              onChange={(e) =>
                commit({
                  sceneSectionMode: "cutaway",
                  sceneSectionActiveAxis: axis,
                  sceneSectionPlanes: {
                    ...planes,
                    [axis]: {
                      ...(planes[axis] ?? {}),
                      enabled: e.target.checked,
                    },
                  },
                })
              }
            />
          </label>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Cut position</label>
            <input
              data-testid={`scene-section-plane-${axis}-position`}
              type="range"
              min={range.min}
              max={range.max}
              step={25}
              disabled={controlDisabled || !planeEnabled}
              value={position}
              onChange={(e) =>
                setPlanePatch(axis, { positionM: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  "--editor-slider-fill": `${Math.max(0, Math.min(100, fill))}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {Math.round(position)} m
            </span>
          </div>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Flip side</span>
            <input
              data-testid={`scene-section-plane-${axis}-invert`}
              type="checkbox"
              disabled={controlDisabled || !planeEnabled}
              checked={plane.invert === true}
              onChange={(e) =>
                setPlanePatch(axis, { invert: e.target.checked })
              }
            />
          </label>
          <button
            type="button"
            data-testid={`scene-section-plane-${axis}-active`}
            disabled={disabled}
            onClick={() => commit({ sceneSectionActiveAxis: axis })}
            style={smallActionButtonStyle}
          >
            Make active handle
          </button>
        </div>
      </details>
    );
  };

  return (
    <SeismicCapabilityLayerItem
      title="Scene section planes"
      type="section"
      testId="scene-section-planes-container"
    >
      <div style={detailsContentStyle}>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Enabled</span>
          <input
            data-testid="scene-section-enabled"
            type="checkbox"
            disabled={disabled}
            checked={enabled}
            onChange={(e) =>
              commit({
                sceneSectionEnabled: e.target.checked,
                sceneSectionMode: "cutaway",
              })
            }
          />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Type</label>
          <select
            data-testid="scene-section-mode"
            disabled={disabled}
            value={mode}
            onChange={() =>
              commit({
                sceneSectionMode: "cutaway",
              })
            }
            style={{ flex: 1 }}
          >
            <option value="cutaway">Cutaway clip</option>
          </select>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Targets</label>
          <select
            data-testid="scene-section-target-scope"
            disabled={disabled}
            value={targetScope}
            onChange={(e) =>
              commit({
                sceneSectionTargetScope:
                  e.target.value === "all-visible"
                    ? "all-visible"
                    : e.target.value === "active-selection"
                      ? "active-selection"
                      : "selected-targets",
              })
            }
            style={{ flex: 1 }}
          >
            <option value="selected-targets">Selected targets</option>
            <option value="all-visible">All visible</option>
            <option value="active-selection">Active selection</option>
          </select>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Gizmo</span>
          <input
            data-testid="scene-section-helper-visible"
            type="checkbox"
            disabled={disabled}
            checked={helperVisible}
            onChange={(e) =>
              commit({ sceneSectionHelperVisible: e.target.checked })
            }
          />
        </label>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Legend</span>
          <input
            data-testid="scene-section-legend-visible"
            type="checkbox"
            disabled={disabled}
            checked={legendVisible}
            onChange={(e) =>
              commit({ sceneSectionLegendVisible: e.target.checked })
            }
          />
        </label>
        {(["x", "y", "z"] as const).map(renderAxis)}
        <details style={nestedDetailsStyle}>
          <summary style={panelStyles.summary}>Target checklist</summary>
          <div style={detailsContentStyle}>
            <div style={miniGroupTitleStyle}>Volume products</div>
            {products
              .filter((product) => product.raymarchCapable)
              .map((product) => (
                <label
                  key={product.id}
                  style={{ ...compactCheckboxRowStyle, cursor: "pointer" }}
                >
                  <input
                    data-testid={`scene-section-target-product-${product.id}`}
                    type="checkbox"
                    disabled={disabled || targetScope === "all-visible"}
                    checked={
                      targetScope === "all-visible" ||
                      targetProductIds.has(product.id)
                    }
                    onChange={(e) =>
                      toggleProductTarget(product.id, e.target.checked)
                    }
                  />
                  <span>{product.label}</span>
                </label>
              ))}
            <div style={miniGroupTitleStyle}>Scene layers</div>
            {layerOptions.map((layer) => (
              <label
                key={layer.id}
                style={{
                  ...compactCheckboxRowStyle,
                  cursor: layer.supported ? "pointer" : "not-allowed",
                  opacity: layer.supported ? 1 : 0.45,
                }}
              >
                <input
                  data-testid={`scene-section-target-layer-${layer.id}`}
                  type="checkbox"
                  disabled={
                    disabled ||
                    targetScope === "all-visible" ||
                    !layer.supported
                  }
                  checked={
                    targetScope === "all-visible" ||
                    targetLayerIds.has(layer.id)
                  }
                  onChange={(e) =>
                    toggleLayerTarget(layer.id, e.target.checked)
                  }
                />
                <span>{layer.label}</span>
              </label>
            ))}
          </div>
        </details>
      </div>
    </SeismicCapabilityLayerItem>
  );
}

function SeismicCapabilityLayerContainers({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  sceneHandle,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  sceneHandle: SceneHandle;
}) {
  const products = seismicProductOptions(layer);
  const capabilityPresets = seismicCapabilityPresets(layer);
  const defaultProductId = seismicDefaultProductId(layer);
  const rawProductId = styleString(style, "seismicProductId", defaultProductId);
  const productId = products.some((product) => product.id === rawProductId)
    ? rawProductId
    : defaultProductId;
  const selectedProduct = products.find((product) => product.id === productId);
  const productVisibility = seismicProductVisibilityFromStyle(
    style,
    products,
    productId,
  );
  const requestedRenderMode =
    style.seismicRenderMode === "raymarch" ? "raymarch" : "slice";
  const renderMode =
    requestedRenderMode === "raymarch" && selectedProduct?.raymarchCapable
      ? "raymarch"
      : "slice";
  const sliceAxis =
    selectedProduct?.surveyKind !== "3d"
      ? "line"
      : style.seismicSliceAxis === "crossline" ||
          style.seismicSliceAxis === "sample"
        ? style.seismicSliceAxis
        : "inline";
  const sliceFraction = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicSliceFraction", 0.5)),
  );
  const amplitudeMin = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicAmplitudeMin", 0.08)),
  );
  const amplitudeMax = Math.max(
    amplitudeMin + 0.01,
    Math.min(1, styleNumber(style, "seismicAmplitudeMax", 0.92)),
  );
  const amplitudeGamma = Math.max(
    0.35,
    Math.min(2.5, styleNumber(style, "seismicAmplitudeGamma", 1)),
  );
  const backgroundCutoff = Math.max(
    0,
    Math.min(0.45, styleNumber(style, "seismicBackgroundCutoff", 0.16)),
  );
  const volumeSampleSteps = Math.round(
    Math.max(
      24,
      Math.min(160, styleNumber(style, "seismicVolumeSampleSteps", 96)),
    ),
  );
  const seismicOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "opacity", 0.62)),
  );
  const timeScale = Math.max(
    0.25,
    Math.min(8, styleNumber(style, "seismicTimeScale", 2)),
  );
  const colormap = seismicColormapFromValue(style.seismicColormap);
  const removeBackground = styleBoolean(
    style,
    "seismicRemoveBackground",
    false,
  );
  const comparisonMode =
    style.seismicComparisonMode === "side-by-side" ? "side-by-side" : "overlay";
  const comparisonSpacingM = Math.max(
    0,
    Math.min(3000, styleNumber(style, "seismicComparisonSpacingM", 650)),
  );
  const navigationVisible = styleBoolean(
    style,
    "seismicNavigationVisible",
    true,
  );
  const navigationRoleVisibility =
    typeof style.seismicNavigationRoleVisibility === "object" &&
    style.seismicNavigationRoleVisibility !== null
      ? style.seismicNavigationRoleVisibility
      : {};
  const navigationSourcesVisible = navigationRoleVisibility.sources !== false;
  const navigationReceiversVisible =
    navigationRoleVisibility.receivers !== false;
  const navigationLinesVisible = navigationRoleVisibility.lines !== false;
  const currentCapabilityPresetId =
    typeof style.seismicCapabilityPresetId === "string"
      ? style.seismicCapabilityPresetId
      : "";
  const controlOpacity = disabled ? 0.4 : 1;
  const liveSeismicStyleRef = useRef(style);
  useEffect(() => {
    liveSeismicStyleRef.current = style;
  }, [style]);

  const commitLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    if (disabled) return;
    if (targetLayerId === layerId) {
      const merged = { ...liveSeismicStyleRef.current, ...patch };
      liveSeismicStyleRef.current = merged;
      sceneHandle.manager.applyStyle(targetLayerId, merged);
    }
    if (isEnv) {
      setEnvLayerStyle(targetLayerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, targetLayerId, patch);
    }
  };
  const commit = (patch: Partial<EditableStyle>) => {
    commitLayerStyle(layerId, patch);
  };
  const selectedOnlyVisibility = (id: string) =>
    Object.fromEntries(
      products.map((product) => [product.id, product.id === id]),
    );
  const setProductVisible = (id: string, visible: boolean) => {
    commit({
      seismicProductVisibility: {
        ...productVisibility,
        [id]: visible,
      },
    });
  };
  const setCapabilityForProduct = (
    product: SeismicProductOption,
    mode: "slice" | "raymarch",
    syncSlice: boolean,
  ) => {
    const nextRenderMode =
      mode === "raymarch" && product.raymarchCapable ? "raymarch" : "slice";
    commit({
      seismicCapabilityPresetId: `${product.id}-${nextRenderMode}${
        syncSlice ? "-sync" : ""
      }`,
      seismicProductId: product.id,
      seismicProductVisibility: selectedOnlyVisibility(product.id),
      seismicRenderMode: nextRenderMode,
      seismicColormap: isVelocityProduct(product) ? "velocity" : colormap,
      seismicSliceAxis:
        product.surveyKind === "3d"
          ? sliceAxis === "line"
            ? "inline"
            : sliceAxis
          : "line",
      seismicSliceThroughVolume:
        nextRenderMode === "raymarch" &&
        syncSlice &&
        product.raymarchCapable === true,
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: true,
        receivers: true,
        lines: true,
      },
    });
  };
  const applyCapabilityPreset = (presetId: string) => {
    const preset = capabilityPresets.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) return;
    commit(seismicPresetPatch(preset, products, productId));
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
  };
  const setMtCoRender = (
    value: NonNullable<EditableStyle["seismicMtCoRender"]>,
  ) => {
    const mtPatch: Partial<EditableStyle> =
      value === "integrated"
        ? { opacity: 0.36, scalarLegendVisible: true }
        : value === "mt"
          ? { opacity: 0.48, scalarLegendVisible: true }
          : { opacity: 0.06, scalarLegendVisible: false };
    const seismicPatch: Partial<EditableStyle> = { seismicMtCoRender: value };
    if (value === "mt") {
      seismicPatch.seismicProductVisibility = Object.fromEntries(
        products.map((product) => [product.id, false]),
      );
    } else if (productId) {
      seismicPatch.seismicProductVisibility = {
        ...productVisibility,
        [productId]: true,
      };
    }
    commit(seismicPatch);
    commitLayerStyle(UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID, mtPatch);
  };
  const setNavigationRoleVisible = (
    role: "sources" | "receivers" | "lines",
    visible: boolean,
  ) => {
    commit({
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: navigationSourcesVisible,
        receivers: navigationReceiversVisible,
        lines: navigationLinesVisible,
        [role]: visible,
      },
    });
  };
  const comparisonActions = [
    {
      label: "301",
      primary: "gdr-1141-line-301-pdm-enh",
      compare: "gdr-1141-line-301-psdm-unenh",
    },
    {
      label: "302",
      primary: "gdr-1141-line-302-psdm-enh",
      compare: "gdr-1141-line-302-psdm-unenh",
    },
    {
      label: "L5",
      primary: "gdr-1141-line-l5-psdm-enh",
      compare: "gdr-1141-line-l5-psdm-unenh",
    },
    {
      label: "L11",
      primary: "gdr-1141-line-l11-psdm-enh",
      compare: "gdr-1141-line-l11-psdm-unenh",
    },
  ].filter(
    (action) =>
      products.some((product) => product.id === action.primary) &&
      products.some((product) => product.id === action.compare),
  );
  const raymarchProducts = products.filter(
    (product) => product.raymarchCapable === true,
  );
  const productControlActive = (product: SeismicProductOption) =>
    product.id === productId;

  const renderProductDisplayVariables = (product: SeismicProductOption) => {
    const windowMinLabel = isVelocityProduct(product) ? "Vel min" : "Amp min";
    const windowMaxLabel = isVelocityProduct(product) ? "Vel max" : "Amp max";
    return (
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>Product variables</summary>
        <div style={detailsContentStyle}>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Slice</label>
            <select
              data-testid={`seismic-capability-slice-axis-${product.id}`}
              value={productControlActive(product) ? sliceAxis : "inline"}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({
                  seismicSliceAxis: e.target.value as NonNullable<
                    EditableStyle["seismicSliceAxis"]
                  >,
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="inline">Inline</option>
              <option value="crossline">Crossline</option>
              <option value="sample">Time/depth plane</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Position</label>
            <input
              data-testid={`seismic-capability-slice-position-${product.id}`}
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sliceFraction}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicSliceFraction: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${sliceFraction * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sliceFraction.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Opacity</label>
            <input
              data-testid={`seismic-capability-opacity-${product.id}`}
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={seismicOpacity}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) => commit({ opacity: parseFloat(e.target.value) })}
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${seismicOpacity * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicOpacity.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>{windowMinLabel}</label>
            <input
              data-testid={`seismic-capability-amplitude-min-${product.id}`}
              type="range"
              min={0}
              max={0.98}
              step={0.01}
              value={amplitudeMin}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${amplitudeMin * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(product, amplitudeMin)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>{windowMaxLabel}</label>
            <input
              data-testid={`seismic-capability-amplitude-max-${product.id}`}
              type="range"
              min={0.02}
              max={1}
              step={0.01}
              value={amplitudeMax}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${amplitudeMax * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(product, amplitudeMax)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Gain curve</label>
            <input
              data-testid={`seismic-capability-amplitude-gamma-${product.id}`}
              type="range"
              min={0.35}
              max={2.5}
              step={0.05}
              value={amplitudeGamma}
              disabled={disabled || !productControlActive(product)}
              onInput={(e) =>
                commit({
                  seismicAmplitudeGamma: parseFloat(
                    (e.currentTarget as HTMLInputElement).value,
                  ),
                })
              }
              onChange={(e) =>
                commit({ seismicAmplitudeGamma: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${((amplitudeGamma - 0.35) / 2.15) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {amplitudeGamma.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Palette</label>
            <select
              data-testid={`seismic-capability-colormap-${product.id}`}
              value={colormap}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({
                  seismicColormap: seismicColormapFromValue(e.target.value),
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="blue-white-red">Blue-white-red</option>
              <option value="grayscale">Grayscale</option>
              <option value="velocity">Velocity</option>
            </select>
          </div>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>White bg</span>
            <input
              data-testid={`seismic-capability-remove-background-${product.id}`}
              type="checkbox"
              checked={removeBackground}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicRemoveBackground: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              remove neutral fill
            </span>
          </label>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Zero mute</label>
            <input
              data-testid={`seismic-capability-background-cutoff-${product.id}`}
              type="range"
              min={0}
              max={0.45}
              step={0.01}
              value={backgroundCutoff}
              disabled={
                disabled || !productControlActive(product) || !removeBackground
              }
              onChange={(e) =>
                commit({ seismicBackgroundCutoff: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity:
                    productControlActive(product) && removeBackground
                      ? controlOpacity
                      : 0.35,
                  "--editor-slider-fill": `${(backgroundCutoff / 0.45) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {backgroundCutoff.toFixed(2)}
            </span>
          </div>
          {product.raymarchCapable ? (
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Ray steps</label>
              <input
                data-testid={`seismic-capability-volume-sample-steps-${product.id}`}
                type="range"
                min={24}
                max={160}
                step={8}
                value={volumeSampleSteps}
                disabled={disabled || !productControlActive(product)}
                onInput={(e) =>
                  commit({
                    seismicVolumeSampleSteps: parseFloat(
                      (e.currentTarget as HTMLInputElement).value,
                    ),
                  })
                }
                onChange={(e) =>
                  commit({
                    seismicVolumeSampleSteps: parseFloat(e.target.value),
                  })
                }
                style={
                  {
                    flex: 1,
                    opacity: productControlActive(product)
                      ? controlOpacity
                      : 0.35,
                    "--editor-slider-fill": `${((volumeSampleSteps - 24) / 136) * 100}%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
            </div>
          ) : null}
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Time scale</label>
            <input
              data-testid={`seismic-capability-time-scale-${product.id}`}
              type="range"
              min={0.25}
              max={8}
              step={0.25}
              value={timeScale}
              disabled={disabled || !productControlActive(product)}
              onChange={(e) =>
                commit({ seismicTimeScale: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: productControlActive(product)
                    ? controlOpacity
                    : 0.35,
                  "--editor-slider-fill": `${((timeScale - 0.25) / 7.75) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{timeScale.toFixed(2)}</span>
          </div>
        </div>
      </details>
    );
  };

  return (
    <>
      {raymarchProducts.map((product) => {
        const productVisible = productVisibility[product.id] === true;
        return (
          <SeismicCapabilityLayerItem
            key={product.id}
            testId={`seismic-capability-product-${product.id}`}
            title={product.label}
            type={isVelocityProduct(product) ? "3D velocity" : "3D seismic"}
            inactive={!productVisible}
          >
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Visible</span>
              <input
                data-testid={`seismic-capability-product-visible-${product.id}`}
                type="checkbox"
                checked={productVisible}
                disabled={disabled}
                onChange={(e) =>
                  setProductVisible(product.id, e.target.checked)
                }
                style={{ opacity: controlOpacity }}
              />
              <span
                style={{
                  flex: 1,
                  color: vibrancyTertiaryLabel,
                  fontSize: 11,
                  opacity: controlOpacity,
                }}
              >
                {productVisible
                  ? productControlActive(product)
                    ? renderMode === "raymarch"
                      ? "active volume"
                      : "active slice"
                    : (product.domainKind ?? "processed product")
                  : "inactive"}
              </span>
            </label>
            {productVisible ? (
              <>
                <details style={nestedDetailsStyle}>
                  <summary style={panelStyles.summary}>Render</summary>
                  <div style={detailsContentStyle}>
                    <div
                      style={{
                        ...nestedControlRowStyle,
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <label style={nestedFieldLabelStyle}>Mode</label>
                      {[
                        {
                          label: "Volume",
                          testId: `seismic-capability-volume-${product.id}`,
                          onClick: () =>
                            setCapabilityForProduct(product, "raymarch", false),
                        },
                        {
                          label: "Slice",
                          testId: `seismic-capability-slice-${product.id}`,
                          onClick: () =>
                            setCapabilityForProduct(product, "slice", false),
                        },
                        {
                          label: "Sync",
                          testId: `seismic-capability-sync-${product.id}`,
                          onClick: () =>
                            setCapabilityForProduct(product, "raymarch", true),
                        },
                      ].map((action) => (
                        <button
                          key={action.testId}
                          type="button"
                          data-testid={action.testId}
                          disabled={disabled}
                          onClick={action.onClick}
                          style={{
                            ...panelStyles.iconButton,
                            width: "auto",
                            padding: "3px 7px",
                            fontSize: 10,
                            opacity: controlOpacity,
                          }}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
                {renderProductDisplayVariables(product)}
              </>
            ) : null}
          </SeismicCapabilityLayerItem>
        );
      })}

      <SeismicCapabilityLayerItem
        testId="seismic-capability-line-theatre"
        title="2D / legacy section theatre"
        type="section"
      >
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>Curtain</label>
          {[
            { id: "line-301-theatre", label: "Line 301" },
            { id: "line-302-theatre", label: "Line 302" },
            { id: "legacy-l5-l11-theatre", label: "L5 + L11" },
          ].map((action) => (
            <button
              key={action.id}
              type="button"
              data-testid={`seismic-capability-${action.id}`}
              disabled={disabled}
              onClick={() => applyCapabilityPreset(action.id)}
              style={{
                ...panelStyles.iconButton,
                width: "auto",
                padding: "3px 7px",
                fontSize: 10,
                opacity: controlOpacity,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-processing-comparison"
        title="Processing comparison"
        type="comparison"
      >
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Mode</label>
          <select
            data-testid="seismic-comparison-mode-select"
            value={comparisonMode}
            disabled={disabled}
            onChange={(e) =>
              commit({
                seismicComparisonMode:
                  e.target.value === "side-by-side"
                    ? "side-by-side"
                    : "overlay",
              })
            }
            style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
          >
            <option value="overlay">Overlay</option>
            <option value="side-by-side">Side-by-side</option>
          </select>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Spacing</label>
          <input
            data-testid="seismic-comparison-spacing"
            type="range"
            min={0}
            max={3000}
            step={50}
            value={comparisonSpacingM}
            disabled={disabled || comparisonMode !== "side-by-side"}
            onChange={(e) =>
              commit({ seismicComparisonSpacingM: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity:
                  comparisonMode === "side-by-side" ? controlOpacity : 0.35,
                "--editor-slider-fill": `${(comparisonSpacingM / 3000) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {comparisonSpacingM.toFixed(0)} m
          </span>
        </div>
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>Pair</label>
          {comparisonActions.map((action) => (
            <button
              key={action.label}
              type="button"
              data-testid={`seismic-comparison-pair-${action.label.toLowerCase()}`}
              disabled={disabled}
              onClick={() =>
                commit({
                  seismicCapabilityPresetId:
                    action.label === "301"
                      ? "enhanced-vs-unenhanced"
                      : `enhanced-vs-unenhanced-${action.label.toLowerCase()}`,
                  seismicProductId: action.primary,
                  seismicProductVisibility: Object.fromEntries(
                    products.map((product) => [
                      product.id,
                      product.id === action.primary ||
                        product.id === action.compare,
                    ]),
                  ),
                  seismicRenderMode: "slice",
                  seismicSliceAxis: "line",
                  seismicComparisonProductId: action.compare,
                  seismicComparisonMode: comparisonMode,
                })
              }
              style={{
                ...panelStyles.iconButton,
                width: "auto",
                padding: "3px 7px",
                fontSize: 10,
                opacity: controlOpacity,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-display-cleanup"
        title="Display cleanup"
        type="display"
      >
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Opacity</label>
          <input
            data-testid="seismic-capability-opacity"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={seismicOpacity}
            disabled={disabled}
            onChange={(e) => commit({ opacity: parseFloat(e.target.value) })}
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${seismicOpacity * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {seismicOpacity.toFixed(2)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Palette</label>
          <select
            data-testid="seismic-capability-colormap-select"
            value={colormap}
            disabled={disabled}
            onChange={(e) =>
              commit({
                seismicColormap: seismicColormapFromValue(e.target.value),
              })
            }
            style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
          >
            <option value="blue-white-red">Blue-white-red</option>
            <option value="grayscale">Grayscale</option>
            <option value="velocity">Velocity</option>
          </select>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Gain curve</label>
          <input
            data-testid="seismic-capability-amplitude-gamma"
            type="range"
            min={0.35}
            max={2.5}
            step={0.05}
            value={amplitudeGamma}
            disabled={disabled}
            onChange={(e) =>
              commit({ seismicAmplitudeGamma: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${((amplitudeGamma - 0.35) / 2.15) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {amplitudeGamma.toFixed(2)}
          </span>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>White bg</span>
          <input
            data-testid="seismic-capability-remove-background"
            type="checkbox"
            checked={removeBackground}
            disabled={disabled}
            onChange={(e) =>
              commit({ seismicRemoveBackground: e.target.checked })
            }
            style={{ opacity: controlOpacity }}
          />
          <span
            style={{
              flex: 1,
              color: vibrancyTertiaryLabel,
              fontSize: 11,
              opacity: controlOpacity,
            }}
          >
            remove neutral fill
          </span>
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Zero mute</label>
          <input
            data-testid="seismic-capability-background-cutoff"
            type="range"
            min={0}
            max={0.45}
            step={0.01}
            value={backgroundCutoff}
            disabled={disabled || !removeBackground}
            onChange={(e) =>
              commit({ seismicBackgroundCutoff: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: removeBackground ? controlOpacity : 0.35,
                "--editor-slider-fill": `${(backgroundCutoff / 0.45) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {backgroundCutoff.toFixed(2)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Ray steps</label>
          <input
            data-testid="seismic-capability-volume-sample-steps"
            type="range"
            min={24}
            max={160}
            step={8}
            value={volumeSampleSteps}
            disabled={disabled || !selectedProduct?.raymarchCapable}
            onChange={(e) =>
              commit({ seismicVolumeSampleSteps: parseFloat(e.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: selectedProduct?.raymarchCapable
                  ? controlOpacity
                  : 0.35,
                "--editor-slider-fill": `${((volumeSampleSteps - 24) / 136) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
        </div>
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-survey-geometry"
        title="Survey geometry"
        type="navigation"
      >
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Navigation</span>
          <input
            data-testid="seismic-navigation-visible-capability"
            type="checkbox"
            checked={navigationVisible}
            disabled={disabled}
            onChange={(e) =>
              commit({ seismicNavigationVisible: e.target.checked })
            }
            style={{ opacity: controlOpacity }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>Preset</label>
          <button
            type="button"
            data-testid="seismic-capability-survey-geometry-preset"
            disabled={disabled}
            onClick={() => applyCapabilityPreset("survey-geometry")}
            style={{
              ...panelStyles.iconButton,
              width: "auto",
              padding: "3px 7px",
              fontSize: 10,
              opacity: controlOpacity,
            }}
          >
            Show survey
          </button>
        </div>
        {[
          {
            role: "sources" as const,
            label: "Sources",
            checked: navigationSourcesVisible,
          },
          {
            role: "receivers" as const,
            label: "Receivers",
            checked: navigationReceiversVisible,
          },
          {
            role: "lines" as const,
            label: "Lines",
            checked: navigationLinesVisible,
          },
        ].map((item) => (
          <label
            key={item.role}
            style={{ ...nestedControlRowStyle, cursor: "pointer" }}
          >
            <span style={nestedFieldLabelStyle}>{item.label}</span>
            <input
              data-testid={`seismic-navigation-role-${item.role}`}
              type="checkbox"
              checked={item.checked}
              disabled={disabled}
              onChange={(e) =>
                setNavigationRoleVisible(item.role, e.target.checked)
              }
              style={{ opacity: controlOpacity }}
            />
            <span style={{ flex: 1 }} />
          </label>
        ))}
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-integrated-geophysics"
        title="Integrated geophysics"
        type="preset"
      >
        <div style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}>
          <label style={nestedFieldLabelStyle}>View</label>
          {[
            {
              label: "Seismic",
              testId: "seismic-capability-seismic-only",
              onClick: () => setMtCoRender("seismic"),
            },
            {
              label: "MT",
              testId: "seismic-capability-mt-only",
              onClick: () => setMtCoRender("mt"),
            },
            {
              label: "Integrated",
              testId: "seismic-capability-integrated",
              onClick: () => applyCapabilityPreset("integrated-geophysics"),
            },
          ].map((action) => (
            <button
              key={action.testId}
              type="button"
              data-testid={action.testId}
              disabled={disabled}
              onClick={action.onClick}
              style={{
                ...panelStyles.iconButton,
                width: "auto",
                padding: "3px 7px",
                fontSize: 10,
                opacity: controlOpacity,
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </SeismicCapabilityLayerItem>

      <SeismicCapabilityLayerItem
        testId="seismic-capability-data-confidence"
        title="Data confidence"
        type="metadata"
      >
        <div
          style={{
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            lineHeight: 1.35,
          }}
        >
          <div>Products: {products.length} processed GUI products</div>
          <div>3D raymarch-capable: {raymarchProducts.length}</div>
          <div>
            Active capability: {currentCapabilityPresetId || "manual controls"}
          </div>
          <div>{SEISMIC_DEMO_DISCLOSURE_LABELS.join(" / ")}</div>
        </div>
      </SeismicCapabilityLayerItem>
    </>
  );
}

function SurfaceGradientControls({
  style,
  disabled,
  isPageOverride,
  overridden,
  onToggleOverride,
  onChange,
}: {
  style: EditableStyle;
  disabled: boolean;
  isPageOverride: boolean;
  overridden: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const lowColor = styleString(
    style,
    "surfaceGradientLowColor",
    SURFACE_GRADIENT_DEFAULT_LOW,
  );
  const midColor = styleString(
    style,
    "surfaceGradientMidColor",
    SURFACE_GRADIENT_DEFAULT_MID,
  );
  const highColor = styleString(
    style,
    "surfaceGradientHighColor",
    SURFACE_GRADIENT_DEFAULT_HIGH,
  );
  const midpoint = Math.max(
    0.05,
    Math.min(0.95, styleNumber(style, "surfaceGradientMidpoint", 0.5)),
  );
  const contrast = Math.max(
    0.35,
    Math.min(2.5, styleNumber(style, "surfaceGradientContrast", 1)),
  );
  const midpointFill = Math.max(0, Math.min(100, midpoint * 100));
  const contrastFill = Math.max(
    0,
    Math.min(100, ((contrast - 0.35) / (2.5 - 0.35)) * 100),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const gradientBackground = `linear-gradient(90deg, ${lowColor} 0%, ${midColor} ${midpointFill.toFixed(
    1,
  )}%, ${highColor} 100%)`;

  return (
    <>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Gradient</label>
        {isPageOverride ? (
          <input
            type="checkbox"
            checked={overridden}
            onChange={(e) => onToggleOverride?.(e.target.checked)}
            title="Override environment surface gradient for this page"
          />
        ) : null}
        <div
          style={{
            flex: 1,
            height: 14,
            borderRadius: 999,
            border: FROSTED_HAIRLINE,
            background: gradientBackground,
            opacity: controlOpacity,
          }}
        />
        {isPageOverride ? (
          <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
            {overridden ? "overridden" : "inherited"}
          </span>
        ) : null}
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Colors</label>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          <SurfaceGradientColorInput
            label="Low"
            value={lowColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ surfaceGradientLowColor: value })}
          />
          <SurfaceGradientColorInput
            label="Mid"
            value={midColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ surfaceGradientMidColor: value })}
          />
          <SurfaceGradientColorInput
            label="High"
            value={highColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ surfaceGradientHighColor: value })}
          />
        </div>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Midpoint</label>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={midpoint}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              surfaceGradientMidpoint: parseFloat(e.target.value),
            })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${midpointFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{midpoint.toFixed(2)}</span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Nuance</label>
        <input
          type="range"
          min={0.35}
          max={2.5}
          step={0.05}
          value={contrast}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              surfaceGradientContrast: parseFloat(e.target.value),
            })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${contrastFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{contrast.toFixed(2)}</span>
      </div>
    </>
  );
}

function MtTopSurfaceControls({
  style,
  disabled,
  isPageOverride,
  overridden,
  onToggleOverride,
  onChange,
}: {
  style: EditableStyle;
  disabled: boolean;
  isPageOverride: boolean;
  overridden: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const lift = Math.max(
    -3000,
    Math.min(3000, styleNumber(style, "meshSurfaceLiftM", 0)),
  );
  const wireframe = styleBoolean(style, "meshWireframe", false);
  const roughness = Math.max(
    0,
    Math.min(1, styleNumber(style, "meshRoughness", 0.72)),
  );
  const metalness = Math.max(
    0,
    Math.min(1, styleNumber(style, "meshMetalness", 0.02)),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const liftFill = ((lift + 3000) / 6000) * 100;

  return (
    <>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Top surface</label>
        {isPageOverride ? (
          <input
            type="checkbox"
            checked={overridden}
            onChange={(e) => onToggleOverride?.(e.target.checked)}
            title="Override environment top-surface variables for this page"
          />
        ) : null}
        <span
          style={{
            flex: 1,
            color: vibrancyTertiaryLabel,
            fontSize: 11,
            opacity: controlOpacity,
          }}
        >
          inferred MT topology
        </span>
        {isPageOverride ? (
          <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
            {overridden ? "overridden" : "inherited"}
          </span>
        ) : null}
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Surface lift</label>
        <input
          type="range"
          min={-3000}
          max={3000}
          step={25}
          value={lift}
          disabled={disabled}
          onChange={(e) =>
            onChange({ meshSurfaceLiftM: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${liftFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{lift.toFixed(0)} m</span>
      </div>
      <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
        <span style={nestedFieldLabelStyle}>Wireframe</span>
        <input
          type="checkbox"
          checked={wireframe}
          disabled={disabled}
          onChange={(e) => onChange({ meshWireframe: e.target.checked })}
          style={{ opacity: controlOpacity }}
        />
        <span style={{ flex: 1 }} />
      </label>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Roughness</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={roughness}
          disabled={disabled}
          onChange={(e) =>
            onChange({ meshRoughness: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${roughness * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{roughness.toFixed(2)}</span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Metalness</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={metalness}
          disabled={disabled}
          onChange={(e) =>
            onChange({ meshMetalness: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${metalness * 100}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{metalness.toFixed(2)}</span>
      </div>
    </>
  );
}

interface MtVolumeProductOption {
  id: string;
  label: string;
  description?: string;
}

function mtVolumeProductOptions(
  layer: ProjectLayerSpec,
): MtVolumeProductOption[] {
  const raw = (layer.metadata as { volumeProducts?: unknown }).volumeProducts;
  if (Array.isArray(raw)) {
    const options: MtVolumeProductOption[] = [];
    for (const item of raw) {
      const product = item as {
        id?: unknown;
        label?: unknown;
        description?: unknown;
      };
      if (typeof product.id !== "string") continue;
      options.push({
        id: product.id,
        label:
          typeof product.label === "string"
            ? prefixMtDimension(product.label, "3D")
            : prefixMtDimension(product.id, "3D"),
        description:
          typeof product.description === "string"
            ? product.description
            : undefined,
      });
    }
    if (options.length > 0) return options;
  }
  return [
    {
      id: "mt-resistivity-forge-focused-volume",
      label: "3D MT resistivity focused volume",
    },
    {
      id: "mt-resistivity-full-extent-volume",
      label: "3D MT resistivity full-extent volume",
    },
  ];
}

type IsobandRangeKind = "mt" | "seismic";

function isobandAxisRange(axis: "x" | "y" | "z") {
  if (axis === "x") return { min: -140000, max: 140000, label: "X plane" };
  if (axis === "y") return { min: -115000, max: 115000, label: "Y plane" };
  return { min: -122000, max: 4000, label: "Z plane" };
}

function isobandDefaultPlanePosition(axis: "x" | "y" | "z"): number {
  return axis === "x" ? -6000 : axis === "y" ? -10300 : -2200;
}

function IsobandControls({
  title = "Isobands",
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  rangeKind,
  volumePlanes,
  sceneSectionStyle,
  sceneHandle,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  title?: string;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  rangeKind: IsobandRangeKind;
  volumePlanes?: boolean;
  sceneSectionStyle?: EditableStyle;
  sceneHandle?: SceneHandle;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
}) {
  const enabled = styleBoolean(style, "sectionIsoEnabled", false);
  const linesVisible = styleBoolean(style, "sectionIsoLinesVisible", true);
  const bandsVisible = styleBoolean(style, "sectionIsoBandsVisible", true);
  const sourceOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "sectionIsoSourceOpacity", 0)),
  );
  const bandCount = Math.max(
    2,
    Math.min(32, Math.round(styleNumber(style, "sectionIsoLevelCount", 32))),
  );
  const lineWidth = Math.max(
    0,
    Math.min(12, styleNumber(style, "sectionIsoLineWidth", 2.6)),
  );
  const bandOpacity = Math.max(
    0,
    Math.min(0.85, styleNumber(style, "sectionIsoBandOpacity", 0.32)),
  );
  const fillOffset = Math.max(
    -1,
    Math.min(1, styleNumber(style, "sectionIsoFillOffset", 0)),
  );
  const lineStyle = style.sectionIsoLineStyle === "dashed" ? "dashed" : "solid";
  const sourceMin = rangeKind === "seismic" ? 0 : SCALAR_SOURCE_MIN;
  const sourceMax = rangeKind === "seismic" ? 1 : SCALAR_SOURCE_MAX;
  const fallbackMin =
    rangeKind === "seismic"
      ? styleNumber(style, "seismicAmplitudeMin", 0.08)
      : sourceMin;
  const fallbackMax =
    rangeKind === "seismic"
      ? styleNumber(style, "seismicAmplitudeMax", 0.92)
      : sourceMax;
  const isoMin = Math.max(
    sourceMin,
    Math.min(
      sourceMax - 0.001,
      styleNumber(style, "sectionIsoMin", fallbackMin),
    ),
  );
  const isoMax = Math.max(
    isoMin + 0.001,
    Math.min(sourceMax, styleNumber(style, "sectionIsoMax", fallbackMax)),
  );
  const sceneStyle = sceneSectionStyle ?? {};
  const scenePlanes = sceneStyle.sceneSectionPlanes ?? {};
  const activeAxis =
    sceneStyle.sceneSectionActiveAxis === "x" ||
    sceneStyle.sceneSectionActiveAxis === "y" ||
    sceneStyle.sceneSectionActiveAxis === "z"
      ? sceneStyle.sceneSectionActiveAxis
      : "z";
  const activePlane = scenePlanes[activeAxis] ?? {};
  const axisRange = isobandAxisRange(activeAxis);
  const planePosition =
    typeof activePlane.positionM === "number" &&
    Number.isFinite(activePlane.positionM)
      ? activePlane.positionM
      : isobandDefaultPlanePosition(activeAxis);
  const controlOpacity = disabled ? 0.4 : 1;
  const rangeSpan = sourceMax - sourceMin;
  const rangeFill = (value: number) =>
    `${Math.max(0, Math.min(100, ((value - sourceMin) / rangeSpan) * 100))}%`;
  const planeFill = Math.max(
    0,
    Math.min(
      100,
      ((planePosition - axisRange.min) /
        Math.max(1, axisRange.max - axisRange.min)) *
        100,
    ),
  );
  const commit = (patch: Partial<EditableStyle>) => {
    if (disabled) return;
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const commitScene = (patch: Partial<EditableStyle>) => {
    if (disabled || !volumePlanes || !sceneHandle) return;
    const merged = { ...sceneStyle, ...patch };
    sceneHandle.manager.applyStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, merged);
    if (isEnv) {
      setEnvLayerStyle(UTAH_FORGE_SCENE_SECTION_LAYER_ID, patch);
    } else if (currentPage) {
      setPageLayerOverride(
        currentPage.id,
        UTAH_FORGE_SCENE_SECTION_LAYER_ID,
        patch,
      );
    }
  };
  const ensureScenePlane = (axis: "x" | "y" | "z") => {
    const targetLayerIds = new Set(
      Array.isArray(sceneStyle.sceneSectionTargetLayerIds)
        ? sceneStyle.sceneSectionTargetLayerIds
        : [],
    );
    targetLayerIds.add(layerId);
    commitScene({
      sceneSectionEnabled: true,
      sceneSectionMode: "cutaway",
      sceneSectionActiveAxis: axis,
      sceneSectionTargetScope: "selected-targets",
      sceneSectionTargetLayerIds: Array.from(targetLayerIds),
      sceneSectionHelperVisible: true,
      sceneSectionLegendVisible: true,
      sceneSectionPlanes: {
        ...scenePlanes,
        [axis]: {
          ...(scenePlanes[axis] ?? {}),
          enabled: true,
          positionM:
            typeof scenePlanes[axis]?.positionM === "number"
              ? scenePlanes[axis]?.positionM
              : isobandDefaultPlanePosition(axis),
        },
      },
    });
  };
  const setEnabled = (checked: boolean) => {
    if (checked && volumePlanes) ensureScenePlane(activeAxis);
    commit(
      checked
        ? {
            sectionIsoEnabled: true,
            sectionIsoBandsVisible: true,
            sectionIsoLinesVisible: true,
            sectionIsoLevelCount: 32,
            sectionIsoSourceOpacity: 0,
            sectionIsoMin: fallbackMin,
            sectionIsoMax: Math.max(fallbackMin + 0.001, fallbackMax),
          }
        : { sectionIsoEnabled: false },
    );
  };

  return (
    <details style={nestedDetailsStyle} data-testid="layer-isobands-controls">
      <summary style={panelStyles.summary}>{title}</summary>
      <div style={detailsContentStyle}>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>View</span>
          <input
            data-testid="layer-isobands-enabled"
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(event) => setEnabled(event.target.checked)}
            style={{ opacity: controlOpacity }}
          />
          <span
            style={{
              flex: 1,
              color: vibrancyTertiaryLabel,
              fontSize: 11,
              opacity: controlOpacity,
            }}
          >
            {volumePlanes ? "section plane bands" : "slice overlay bands"}
          </span>
        </label>

        {volumePlanes ? (
          <>
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Plane</label>
              <select
                data-testid="layer-isobands-volume-axis"
                value={activeAxis}
                disabled={disabled}
                onChange={(event) =>
                  ensureScenePlane(event.target.value as "x" | "y" | "z")
                }
                style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
              >
                <option value="x">X</option>
                <option value="y">Y</option>
                <option value="z">Z</option>
              </select>
            </div>
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Plane pos.</label>
              <input
                data-testid="layer-isobands-volume-position"
                type="range"
                min={axisRange.min}
                max={axisRange.max}
                step={25}
                value={planePosition}
                disabled={disabled}
                onChange={(event) =>
                  commitScene({
                    sceneSectionEnabled: true,
                    sceneSectionActiveAxis: activeAxis,
                    sceneSectionPlanes: {
                      ...scenePlanes,
                      [activeAxis]: {
                        ...(scenePlanes[activeAxis] ?? {}),
                        enabled: true,
                        positionM: parseFloat(event.target.value),
                      },
                    },
                  })
                }
                style={
                  {
                    flex: 1,
                    opacity: controlOpacity,
                    "--editor-slider-fill": `${planeFill}%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>
                {Math.round(planePosition)} m
              </span>
            </div>
          </>
        ) : null}

        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Original</label>
          <input
            data-testid="layer-isobands-source-opacity"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={sourceOpacity}
            disabled={disabled || !enabled}
            onChange={(event) =>
              commit({
                sectionIsoSourceOpacity: parseFloat(event.target.value),
              })
            }
            style={
              {
                flex: 1,
                opacity: enabled ? controlOpacity : 0.35,
                "--editor-slider-fill": `${sourceOpacity * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {sourceOpacity.toFixed(2)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Bands</label>
          <input
            data-testid="layer-isobands-count"
            type="range"
            min={2}
            max={32}
            step={1}
            value={bandCount}
            disabled={disabled || !enabled}
            onChange={(event) =>
              commit({
                sectionIsoLevelCount: Math.round(
                  parseFloat(event.target.value),
                ),
              })
            }
            style={
              {
                flex: 1,
                opacity: enabled ? controlOpacity : 0.35,
                "--editor-slider-fill": `${((bandCount - 2) / 30) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{bandCount}</span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Min</label>
          <input
            data-testid="layer-isobands-min"
            type="range"
            min={sourceMin}
            max={sourceMax}
            step={rangeKind === "seismic" ? 0.01 : 0.01}
            value={isoMin}
            disabled={disabled || !enabled}
            onChange={(event) => {
              const next = parseFloat(event.target.value);
              commit({
                sectionIsoMin: next,
                sectionIsoMax: Math.max(isoMax, next + 0.001),
              });
            }}
            style={
              {
                flex: 1,
                opacity: enabled ? controlOpacity : 0.35,
                "--editor-slider-fill": rangeFill(isoMin),
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {rangeKind === "seismic" ? isoMin.toFixed(2) : isoMin.toFixed(2)}
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Max</label>
          <input
            data-testid="layer-isobands-max"
            type="range"
            min={sourceMin}
            max={sourceMax}
            step={0.01}
            value={isoMax}
            disabled={disabled || !enabled}
            onChange={(event) => {
              const next = parseFloat(event.target.value);
              commit({
                sectionIsoMin: Math.min(isoMin, next - 0.001),
                sectionIsoMax: next,
              });
            }}
            style={
              {
                flex: 1,
                opacity: enabled ? controlOpacity : 0.35,
                "--editor-slider-fill": rangeFill(isoMax),
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{isoMax.toFixed(2)}</span>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Fill</span>
          <input
            data-testid="layer-isobands-bands-visible"
            type="checkbox"
            checked={bandsVisible}
            disabled={disabled || !enabled}
            onChange={(event) =>
              commit({ sectionIsoBandsVisible: event.target.checked })
            }
            style={{ opacity: enabled ? controlOpacity : 0.35 }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Fill alpha</label>
          <input
            data-testid="layer-isobands-band-opacity"
            type="range"
            min={0}
            max={0.85}
            step={0.01}
            value={bandOpacity}
            disabled={disabled || !enabled || !bandsVisible}
            onChange={(event) =>
              commit({ sectionIsoBandOpacity: parseFloat(event.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: enabled && bandsVisible ? controlOpacity : 0.35,
                "--editor-slider-fill": `${(bandOpacity / 0.85) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {Math.round(bandOpacity * 100)}%
          </span>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Fill offset</label>
          <input
            data-testid="layer-isobands-fill-offset"
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={fillOffset}
            disabled={disabled || !enabled || !bandsVisible}
            onChange={(event) =>
              commit({ sectionIsoFillOffset: parseFloat(event.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: enabled && bandsVisible ? controlOpacity : 0.35,
                "--editor-slider-fill": `${((fillOffset + 1) / 2) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {Math.round(fillOffset * 100)}%
          </span>
        </div>
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Lines</span>
          <input
            data-testid="layer-isobands-lines-visible"
            type="checkbox"
            checked={linesVisible}
            disabled={disabled || !enabled}
            onChange={(event) =>
              commit({ sectionIsoLinesVisible: event.target.checked })
            }
            style={{ opacity: enabled ? controlOpacity : 0.35 }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Line style</label>
          <select
            data-testid="layer-isobands-line-style"
            value={lineStyle}
            disabled={disabled || !enabled || !linesVisible}
            onChange={(event) =>
              commit({
                sectionIsoLineStyle:
                  event.target.value === "dashed" ? "dashed" : "solid",
              })
            }
            style={{
              flex: 1,
              minWidth: 0,
              opacity: enabled && linesVisible ? controlOpacity : 0.35,
            }}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
          </select>
        </div>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Line width</label>
          <input
            data-testid="layer-isobands-line-width"
            type="range"
            min={0}
            max={12}
            step={0.1}
            value={lineWidth}
            disabled={disabled || !enabled || !linesVisible}
            onChange={(event) =>
              commit({ sectionIsoLineWidth: parseFloat(event.target.value) })
            }
            style={
              {
                flex: 1,
                opacity: enabled && linesVisible ? controlOpacity : 0.35,
                "--editor-slider-fill": `${(lineWidth / 12) * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{lineWidth.toFixed(1)}</span>
        </div>
      </div>
    </details>
  );
}

function MtVolumeControls({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  sceneSectionStyle,
  sceneHandle,
  onToggleOverride,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  sceneSectionStyle: EditableStyle;
  sceneHandle: SceneHandle;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const options = mtVolumeProductOptions(layer);
  const fallbackProduct =
    options[0]?.id ?? "mt-resistivity-forge-focused-volume";
  const selected = options.some(
    (option) => option.id === style.scalarVolumeProductId,
  )
    ? (style.scalarVolumeProductId as string)
    : fallbackProduct;
  const opacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "scalarVolumeOpacity", 0.48)),
  );
  const density = Math.max(
    0,
    Math.min(2, styleNumber(style, "scalarVolumeDensity", 0.72)),
  );
  const sampleSteps = Math.max(
    24,
    Math.min(192, styleNumber(style, "scalarVolumeSampleSteps", 112)),
  );
  const transferMode =
    style.scalarVolumeTransferMode === "soft" ||
    style.scalarVolumeTransferMode === "dense"
      ? style.scalarVolumeTransferMode
      : "balanced";
  const thresholdMin = Math.max(
    SCALAR_SOURCE_MIN,
    Math.min(
      SCALAR_SOURCE_MAX - 0.01,
      styleNumber(style, "scalarVolumeThresholdMin", SCALAR_SOURCE_MIN),
    ),
  );
  const thresholdMax = Math.max(
    thresholdMin + 0.01,
    Math.min(
      SCALAR_SOURCE_MAX,
      styleNumber(style, "scalarVolumeThresholdMax", SCALAR_SOURCE_MAX),
    ),
  );
  const maskVisible = styleBoolean(style, "scalarVolumeMaskVisible", true);
  const controlOpacity = disabled ? 0.4 : 1;
  const commit = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  const range = SCALAR_SOURCE_MAX - SCALAR_SOURCE_MIN;
  const fill = (value: number) =>
    `${Math.max(0, Math.min(100, ((value - SCALAR_SOURCE_MIN) / range) * 100))}%`;

  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>3D volume products</summary>
        <div style={detailsContentStyle}>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Volume</label>
            {!isEnv ? (
              <input
                type="checkbox"
                checked={!disabled}
                onChange={(e) => onToggleOverride?.(e.target.checked)}
                title="Override environment MT volume controls for this page"
              />
            ) : null}
            <select
              data-testid="mt-volume-product-select"
              value={selected}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  scalarVolumeProductId: e.target.value,
                  scalarVolumeRenderMode: "raymarch",
                })
              }
              style={{ flex: 1, opacity: controlOpacity }}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Opacity</label>
            <input
              data-testid="mt-volume-opacity"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={opacity}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  scalarVolumeOpacity: parseFloat(e.target.value),
                  opacity: parseFloat(e.target.value),
                })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${opacity * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{opacity.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Density</label>
            <input
              data-testid="mt-volume-density"
              type="range"
              min={0}
              max={2}
              step={0.01}
              value={density}
              disabled={disabled}
              onChange={(e) =>
                commit({ scalarVolumeDensity: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${(density / 2) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{density.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Samples</label>
            <input
              data-testid="mt-volume-samples"
              type="range"
              min={24}
              max={192}
              step={4}
              value={sampleSteps}
              disabled={disabled}
              onChange={(e) =>
                commit({ scalarVolumeSampleSteps: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${((sampleSteps - 24) / (192 - 24)) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sampleSteps.toFixed(0)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Transfer</label>
            <select
              data-testid="mt-volume-transfer"
              value={transferMode}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  scalarVolumeTransferMode: e.target
                    .value as EditableStyle["scalarVolumeTransferMode"],
                })
              }
              style={{ flex: 1, opacity: controlOpacity }}
            >
              <option value="soft">Soft</option>
              <option value="balanced">Balanced</option>
              <option value="dense">Dense</option>
            </select>
          </div>
          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Mask</span>
            <input
              data-testid="mt-volume-mask-visible"
              type="checkbox"
              checked={maskVisible}
              disabled={disabled}
              onChange={(e) =>
                commit({ scalarVolumeMaskVisible: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{ flex: 1, color: vibrancyTertiaryLabel, fontSize: 11 }}
            >
              hide empty voxels
            </span>
          </label>
        </div>
      </details>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>3D cut window</summary>
        <div style={detailsContentStyle}>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Min log10</label>
            <input
              data-testid="mt-volume-threshold-min"
              type="range"
              min={SCALAR_SOURCE_MIN}
              max={SCALAR_SOURCE_MAX}
              step={0.01}
              value={thresholdMin}
              disabled={disabled}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                commit({
                  scalarVolumeThresholdMin: next,
                  scalarVolumeThresholdMax: Math.max(thresholdMax, next + 0.01),
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": fill(thresholdMin),
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {thresholdMin.toFixed(2)}
            </span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Max log10</label>
            <input
              data-testid="mt-volume-threshold-max"
              type="range"
              min={SCALAR_SOURCE_MIN}
              max={SCALAR_SOURCE_MAX}
              step={0.01}
              value={thresholdMax}
              disabled={disabled}
              onChange={(e) => {
                const next = parseFloat(e.target.value);
                commit({
                  scalarVolumeThresholdMin: Math.min(thresholdMin, next - 0.01),
                  scalarVolumeThresholdMax: next,
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": fill(thresholdMax),
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {thresholdMax.toFixed(2)}
            </span>
          </div>
        </div>
      </details>
      <IsobandControls
        title="3D isobands"
        style={style}
        disabled={disabled}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        rangeKind="mt"
        volumePlanes
        sceneSectionStyle={sceneSectionStyle}
        sceneHandle={sceneHandle}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
      />
    </>
  );
}

interface MtThresholdSurfaceOption {
  id: string;
  label: string;
}

function mtThresholdSurfaceOptions(
  layer: ProjectLayerSpec,
): MtThresholdSurfaceOption[] {
  const raw = (layer.metadata as { thresholdSurfaces?: unknown })
    .thresholdSurfaces;
  if (Array.isArray(raw)) {
    const options = raw
      .map((item) => {
        const surface = item as { id?: unknown; label?: unknown };
        return typeof surface.id === "string"
          ? {
              id: surface.id,
              label:
                typeof surface.label === "string" ? surface.label : surface.id,
            }
          : null;
      })
      .filter((item): item is MtThresholdSurfaceOption => item !== null);
    if (options.length > 0) return options;
  }
  return [
    { id: "conductive-le-10-ohm-m", label: "Conductive shell <=10 Ohm-m" },
    { id: "conductive-le-30-ohm-m", label: "Conductive shell <=30 Ohm-m" },
    { id: "resistive-ge-1000-ohm-m", label: "Resistive shell >=1000 Ohm-m" },
  ];
}

function MtThresholdSurfaceControls({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  onToggleOverride,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const options = mtThresholdSurfaceOptions(layer);
  const visibility =
    typeof style.mtThresholdSurfaceVisibility === "object" &&
    style.mtThresholdSurfaceVisibility !== null
      ? (style.mtThresholdSurfaceVisibility as Record<string, boolean>)
      : {};
  const opacity = Math.max(0, Math.min(1, styleNumber(style, "opacity", 0.42)));
  const wireframe = styleBoolean(style, "mtThresholdSurfaceWireframe", false);
  const controlOpacity = disabled ? 0.4 : 1;
  const commit = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };
  return (
    <details style={nestedDetailsStyle}>
      <summary style={panelStyles.summary}>3D MT threshold surfaces</summary>
      <div style={detailsContentStyle}>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Surfaces</label>
          {!isEnv ? (
            <input
              type="checkbox"
              checked={!disabled}
              onChange={(e) => onToggleOverride?.(e.target.checked)}
              title="Override environment threshold-surface controls for this page"
            />
          ) : null}
          <span
            style={{
              flex: 1,
              color: vibrancyTertiaryLabel,
              fontSize: 11,
              opacity: controlOpacity,
            }}
          >
            source-derived iso-resistivity
          </span>
        </div>
        {options.map((option) => (
          <label
            key={option.id}
            style={{ ...nestedControlRowStyle, cursor: "pointer" }}
          >
            <span style={nestedFieldLabelStyle}>{option.label}</span>
            <input
              data-testid={`mt-threshold-${option.id}`}
              type="checkbox"
              checked={visibility[option.id] !== false}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  mtThresholdSurfaceVisibility: {
                    ...visibility,
                    [option.id]: e.target.checked,
                  },
                })
              }
              style={{ opacity: controlOpacity }}
            />
          </label>
        ))}
        <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
          <span style={nestedFieldLabelStyle}>Wireframe</span>
          <input
            type="checkbox"
            checked={wireframe}
            disabled={disabled}
            onChange={(e) =>
              commit({ mtThresholdSurfaceWireframe: e.target.checked })
            }
            style={{ opacity: controlOpacity }}
          />
          <span style={{ flex: 1 }} />
        </label>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Opacity</label>
          <input
            data-testid="mt-threshold-opacity"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            disabled={disabled}
            onChange={(e) => commit({ opacity: parseFloat(e.target.value) })}
            style={
              {
                flex: 1,
                opacity: controlOpacity,
                "--editor-slider-fill": `${opacity * 100}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>{opacity.toFixed(2)}</span>
        </div>
      </div>
    </details>
  );
}

function SeismicBrowserControls({
  layer,
  style,
  disabled,
  isEnv,
  currentPage,
  layerId,
  overridden,
  sceneSectionStyle,
  sceneHandle,
  onToggleOverride,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  disabled: boolean;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  overridden: boolean;
  sceneSectionStyle: EditableStyle;
  sceneHandle: SceneHandle;
  onToggleOverride?: (enabled: boolean) => void;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
}) {
  const products = seismicProductOptions(layer);
  const presets = seismicAudiencePresets(layer);
  const capabilityPresets = seismicCapabilityPresets(layer);
  const exportLayouts = seismicExportLayouts(layer);
  const defaultProductId = seismicDefaultProductId(layer);
  const rawProductId = styleString(style, "seismicProductId", defaultProductId);
  const productId = products.some((product) => product.id === rawProductId)
    ? rawProductId
    : defaultProductId;
  const selectedProduct = products.find((product) => product.id === productId);
  const productVisibility = seismicProductVisibilityFromStyle(
    style,
    products,
    productId,
  );
  const visibleProductCount = products.filter(
    (product) => productVisibility[product.id] === true,
  ).length;
  const audienceMode = seismicAudienceModeFromStyle(style);
  const selectedPreset =
    presets.find((preset) => preset.id === style.seismicAudiencePresetId) ??
    presets.find((preset) => preset.audienceMode === audienceMode) ??
    presets[0];
  const requestedRenderMode =
    style.seismicRenderMode === "raymarch" ? "raymarch" : "slice";
  const renderMode =
    requestedRenderMode === "raymarch" && selectedProduct?.raymarchCapable
      ? "raymarch"
      : "slice";
  const sliceAxis =
    selectedProduct?.surveyKind !== "3d"
      ? "line"
      : style.seismicSliceAxis === "crossline" ||
          style.seismicSliceAxis === "sample"
        ? style.seismicSliceAxis
        : "inline";
  const sliceFraction = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicSliceFraction", 0.5)),
  );
  const amplitudeMin = Math.max(
    0,
    Math.min(1, styleNumber(style, "seismicAmplitudeMin", 0.08)),
  );
  const amplitudeMax = Math.max(
    amplitudeMin + 0.01,
    Math.min(1, styleNumber(style, "seismicAmplitudeMax", 0.92)),
  );
  const amplitudeGamma = Math.max(
    0.35,
    Math.min(2.5, styleNumber(style, "seismicAmplitudeGamma", 1)),
  );
  const backgroundCutoff = Math.max(
    0,
    Math.min(0.45, styleNumber(style, "seismicBackgroundCutoff", 0.16)),
  );
  const volumeSampleSteps = Math.round(
    Math.max(
      24,
      Math.min(160, styleNumber(style, "seismicVolumeSampleSteps", 96)),
    ),
  );
  const timeScale = Math.max(
    0.25,
    Math.min(8, styleNumber(style, "seismicTimeScale", 2)),
  );
  const navigationVisible = styleBoolean(
    style,
    "seismicNavigationVisible",
    true,
  );
  const colormap = seismicColormapFromValue(style.seismicColormap);
  const removeBackground = styleBoolean(
    style,
    "seismicRemoveBackground",
    false,
  );
  const legendVisible = styleBoolean(style, "seismicLegendVisible", true);
  const sliceThroughVolume =
    selectedProduct?.raymarchCapable === true &&
    styleBoolean(style, "seismicSliceThroughVolume", false);
  const selectedProductVisible = productVisibility[productId] === true;
  const seismicOpacity = Math.max(
    0,
    Math.min(1, styleNumber(style, "opacity", 0.62)),
  );
  const controlOpacity = disabled ? 0.4 : 1;
  const exportLayoutId =
    typeof style.seismicExportLayoutId === "string"
      ? style.seismicExportLayoutId
      : selectedPreset?.exportLayoutId;
  const selectedExportLayout = exportLayouts.find(
    (layout) => layout.id === exportLayoutId,
  );
  const disclosureLabels =
    selectedPreset?.badges && selectedPreset.badges.length > 0
      ? selectedPreset.badges
      : SEISMIC_DEMO_DISCLOSURE_LABELS;
  const mtCoRender =
    style.seismicMtCoRender === "mt" || style.seismicMtCoRender === "integrated"
      ? style.seismicMtCoRender
      : selectedPreset?.mtCoRender === "mt" ||
          selectedPreset?.mtCoRender === "integrated"
        ? selectedPreset.mtCoRender
        : "seismic";
  const comparisonProductId =
    typeof style.seismicComparisonProductId === "string"
      ? style.seismicComparisonProductId
      : selectedPreset?.comparisonProductId;
  const comparisonMode =
    style.seismicComparisonMode === "side-by-side" ? "side-by-side" : "overlay";
  const comparisonSpacingM = Math.max(
    0,
    Math.min(3000, styleNumber(style, "seismicComparisonSpacingM", 650)),
  );
  const navigationRoleVisibility =
    typeof style.seismicNavigationRoleVisibility === "object" &&
    style.seismicNavigationRoleVisibility !== null
      ? style.seismicNavigationRoleVisibility
      : {};
  const navigationSourcesVisible = navigationRoleVisibility.sources !== false;
  const navigationReceiversVisible =
    navigationRoleVisibility.receivers !== false;
  const navigationLinesVisible = navigationRoleVisibility.lines !== false;
  const [technicalOpen, setTechnicalOpen] = useState(false);

  const commitLayerStyle = (
    targetLayerId: string,
    patch: Partial<EditableStyle>,
  ) => {
    if (disabled) return;
    if (isEnv) {
      setEnvLayerStyle(targetLayerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, targetLayerId, patch);
    }
  };
  const commit = (patch: Partial<EditableStyle>) => {
    commitLayerStyle(layerId, patch);
  };
  const setProductVisible = (id: string, visible: boolean) => {
    commit({
      seismicProductVisibility: {
        ...productVisibility,
        [id]: visible,
      },
    });
  };
  const setVisibilityForProducts = (
    predicate: (product: SeismicProductOption) => boolean,
  ) => {
    commit({
      seismicProductVisibility: Object.fromEntries(
        products.map((product) => [product.id, predicate(product)]),
      ),
    });
  };
  const setMtCoRender = (
    value: NonNullable<EditableStyle["seismicMtCoRender"]>,
  ) => {
    const mtPatch: Partial<EditableStyle> =
      value === "integrated"
        ? { opacity: 0.36, scalarLegendVisible: true }
        : value === "mt"
          ? { opacity: 0.48, scalarLegendVisible: true }
          : { opacity: 0.06, scalarLegendVisible: false };
    const seismicPatch: Partial<EditableStyle> = { seismicMtCoRender: value };
    if (value === "mt") {
      seismicPatch.seismicProductVisibility = Object.fromEntries(
        products.map((product) => [product.id, false]),
      );
    } else if (visibleProductCount === 0 && productId) {
      seismicPatch.seismicProductVisibility = {
        ...productVisibility,
        [productId]: true,
      };
    }
    commit(seismicPatch);
    commitLayerStyle(UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID, mtPatch);
  };
  const applyPreset = (presetId: string) => {
    const preset = presets.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    commit(seismicPresetPatch(preset, products, productId));
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
  };
  const applyCapabilityPreset = (presetId: string) => {
    const preset = capabilityPresets.find(
      (candidate) => candidate.id === presetId,
    );
    if (!preset) return;
    commit(seismicPresetPatch(preset, products, productId));
    if (preset.mtStylePatch) {
      commitLayerStyle(
        UTAH_FORGE_MT_RESISTIVITY_FULL_DENSITY_LAYER_ID,
        preset.mtStylePatch,
      );
    }
  };
  const selectedOnlyVisibility = (id: string) =>
    Object.fromEntries(
      products.map((product) => [product.id, product.id === id]),
    );
  const setCapabilityForProduct = (
    product: SeismicProductOption,
    mode: "slice" | "raymarch",
    syncSlice: boolean,
  ) => {
    if (!product.id) return;
    const renderMode =
      mode === "raymarch" && product.raymarchCapable ? "raymarch" : "slice";
    commit({
      seismicCapabilityPresetId: `${product.id}-${renderMode}${
        syncSlice ? "-sync" : ""
      }`,
      seismicProductId: product.id,
      seismicProductVisibility: selectedOnlyVisibility(product.id),
      seismicRenderMode: renderMode,
      seismicColormap: isVelocityProduct(product) ? "velocity" : colormap,
      seismicSliceAxis:
        product.surveyKind === "3d"
          ? sliceAxis === "line"
            ? "inline"
            : sliceAxis
          : "line",
      seismicSliceThroughVolume:
        renderMode === "raymarch" &&
        syncSlice &&
        product.raymarchCapable === true,
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: true,
        receivers: true,
        lines: true,
      },
    });
  };
  const applyAudienceMode = (
    value: NonNullable<EditableStyle["seismicAudienceMode"]>,
  ) => {
    const preset = presets.find(
      (candidate) => candidate.audienceMode === value,
    );
    if (preset) {
      applyPreset(preset.id);
      return;
    }
    commit({ seismicAudienceMode: value });
  };
  const selectProduct = (id: string) => {
    const product = products.find((candidate) => candidate.id === id);
    if (!product) return;
    const patch: Partial<EditableStyle> = {
      seismicProductId: id,
      seismicAudiencePresetId: undefined,
      seismicColormap: isVelocityProduct(product) ? "velocity" : colormap,
      seismicProductVisibility: {
        ...productVisibility,
        [id]: true,
      },
    };
    if (!product.raymarchCapable && renderMode === "raymarch") {
      patch.seismicRenderMode = "slice";
      patch.seismicSliceThroughVolume = false;
    }
    if (product.surveyKind !== "3d") {
      patch.seismicSliceAxis = "line";
    } else if (sliceAxis === "line") {
      patch.seismicSliceAxis = "inline";
    }
    commit(patch);
  };
  const setComparisonProduct = (id: string) => {
    if (id === "none") {
      commit({ seismicComparisonProductId: undefined });
      return;
    }
    commit({
      seismicComparisonProductId: id,
      seismicComparisonMode: comparisonMode,
      seismicProductVisibility: {
        ...productVisibility,
        [id]: true,
      },
      seismicRenderMode: "slice",
    });
  };
  const setNavigationRoleVisible = (
    role: "sources" | "receivers" | "lines",
    visible: boolean,
  ) => {
    commit({
      seismicNavigationVisible: true,
      seismicNavigationRoleVisibility: {
        sources: navigationSourcesVisible,
        receivers: navigationReceiversVisible,
        lines: navigationLinesVisible,
        [role]: visible,
      },
    });
  };
  const productKindCounts = products.reduce<Record<string, number>>(
    (counts, product) => {
      const key = product.productKind ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const surveyCounts = products.reduce<Record<string, number>>(
    (counts, product) => {
      const key = product.surveyKind ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const raymarchProducts = products.filter(
    (product) => product.raymarchCapable === true,
  );
  const lineTheatreActions = [
    { id: "line-301-theatre", label: "Line 301" },
    { id: "line-302-theatre", label: "Line 302" },
    { id: "legacy-l5-l11-theatre", label: "L5 + L11" },
  ];
  const comparisonActions = [
    {
      label: "301",
      primary: "gdr-1141-line-301-pdm-enh",
      compare: "gdr-1141-line-301-psdm-unenh",
    },
    {
      label: "302",
      primary: "gdr-1141-line-302-psdm-enh",
      compare: "gdr-1141-line-302-psdm-unenh",
    },
    {
      label: "L5",
      primary: "gdr-1141-line-l5-psdm-enh",
      compare: "gdr-1141-line-l5-psdm-unenh",
    },
    {
      label: "L11",
      primary: "gdr-1141-line-l11-psdm-enh",
      compare: "gdr-1141-line-l11-psdm-unenh",
    },
  ].filter(
    (action) =>
      products.some((product) => product.id === action.primary) &&
      products.some((product) => product.id === action.compare),
  );
  const currentCapabilityPresetId =
    typeof style.seismicCapabilityPresetId === "string"
      ? style.seismicCapabilityPresetId
      : "";
  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>Seismic browser</summary>
        <div style={detailsContentStyle}>
          {presets.length > 0 ? (
            <>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Audience</label>
                <select
                  data-testid="seismic-audience-mode-select"
                  value={audienceMode}
                  disabled={disabled}
                  onChange={(e) =>
                    applyAudienceMode(
                      e.target.value as NonNullable<
                        EditableStyle["seismicAudienceMode"]
                      >,
                    )
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  {SEISMIC_AUDIENCE_MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Preset</label>
                <select
                  data-testid="seismic-audience-preset-select"
                  value={selectedPreset?.id ?? ""}
                  disabled={disabled}
                  onChange={(e) => applyPreset(e.target.value)}
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  {presets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                data-testid="seismic-preset-summary"
                style={{
                  margin: "4px 0 8px 0",
                  padding: "2px 0 4px 0",
                  color: vibrancyTertiaryLabel,
                  fontSize: 11,
                  lineHeight: 1.35,
                  opacity: controlOpacity,
                }}
              >
                <div style={{ color: vibrancySecondaryLabel, fontWeight: 750 }}>
                  {selectedPreset?.summary ?? "Curated seismic demo view"}
                </div>
                <div style={{ marginTop: 4 }}>
                  {disclosureLabels.join(" / ")}
                </div>
                {selectedPreset?.cameraShot ? (
                  <div style={{ marginTop: 4 }}>
                    Camera shot: {selectedPreset.cameraShot}
                  </div>
                ) : null}
                {selectedPreset?.caveats &&
                selectedPreset.caveats.length > 0 ? (
                  <div style={{ marginTop: 4 }}>
                    {selectedPreset.caveats.slice(0, 2).join(" / ")}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Controls</label>
            {!isEnv ? (
              <input
                type="checkbox"
                checked={overridden}
                onChange={(e) => onToggleOverride?.(e.target.checked)}
                title="Override environment seismic browser variables for this page"
              />
            ) : null}
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              {selectedProductVisible
                ? selectedProduct?.raymarchCapable
                  ? "3D volume"
                  : "section curtain"
                : "hidden"}
            </span>
            {!isEnv ? (
              <span
                style={overridden ? overrideTagActiveStyle : overrideTagStyle}
              >
                {overridden ? "overridden" : "inherited"}
              </span>
            ) : null}
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>MT view</label>
            <select
              data-testid="seismic-mt-co-render-select"
              value={mtCoRender}
              disabled={disabled}
              onChange={(e) =>
                setMtCoRender(
                  e.target.value as NonNullable<
                    EditableStyle["seismicMtCoRender"]
                  >,
                )
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="seismic">Seismic only</option>
              <option value="mt">MT only</option>
              <option value="integrated">Integrated</option>
            </select>
          </div>

          {audienceMode === "data-room" ? (
            <div
              data-testid="seismic-data-room-summary"
              style={{
                margin: "4px 0 8px 0",
                padding: "2px 0 4px 0",
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
                opacity: controlOpacity,
              }}
            >
              <div>Products: {products.length}</div>
              <div>
                Survey:{" "}
                {Object.entries(surveyCounts)
                  .map(([key, count]) => `${key} ${count}`)
                  .join(" / ")}
              </div>
              <div>
                Type:{" "}
                {Object.entries(productKindCounts)
                  .map(([key, count]) => `${key} ${count}`)
                  .join(" / ")}
              </div>
              <div>
                Selected: {selectedProduct?.sourceSubmission ?? "source"} /{" "}
                {selectedProduct?.productKind ?? "processed"} /{" "}
                {selectedProduct?.domainUnit ?? "domain"}
              </div>
              <div>
                Confidence: measured navigation / processed seismic product
              </div>
            </div>
          ) : null}

          {audienceMode === "export" ? (
            <div
              data-testid="seismic-export-summary"
              style={{
                margin: "4px 0 8px 0",
                padding: "2px 0 4px 0",
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
                opacity: controlOpacity,
              }}
            >
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Layout</label>
                <select
                  data-testid="seismic-export-layout-select"
                  value={exportLayoutId ?? ""}
                  disabled={disabled || exportLayouts.length === 0}
                  onChange={(e) =>
                    commit({ seismicExportLayoutId: e.target.value })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  {exportLayouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                      {layout.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                {selectedExportLayout?.output ?? "PDF-ready report visual"}
              </div>
              <div>
                {(
                  selectedExportLayout?.includes ?? [
                    "legend",
                    "scale",
                    "CRS",
                    "source",
                  ]
                ).join(" / ")}
              </div>
              <div>
                {selectedExportLayout?.caveat ??
                  "Report-supporting visual, not a compliance certification."}
              </div>
            </div>
          ) : null}
        </div>
      </details>

      {false ? (
        <>
          <details
            data-testid="seismic-capability-3d-products"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>3D volume products</summary>
            <div style={detailsContentStyle}>
              {raymarchProducts.map((product) => (
                <div
                  key={product.id}
                  style={{ ...nestedControlRowStyle, gap: 6 }}
                >
                  <label
                    style={{
                      ...nestedFieldLabelStyle,
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={product.label}
                  >
                    {product.label}
                  </label>
                  {[
                    {
                      label: "Volume",
                      testId: `seismic-capability-volume-${product.id}`,
                      onClick: () =>
                        setCapabilityForProduct(product, "raymarch", false),
                    },
                    {
                      label: "Slice",
                      testId: `seismic-capability-slice-${product.id}`,
                      onClick: () =>
                        setCapabilityForProduct(product, "slice", false),
                    },
                    {
                      label: "Sync",
                      testId: `seismic-capability-sync-${product.id}`,
                      onClick: () =>
                        setCapabilityForProduct(product, "raymarch", true),
                    },
                  ].map((action) => (
                    <button
                      key={action.testId}
                      type="button"
                      data-testid={action.testId}
                      disabled={disabled}
                      onClick={action.onClick}
                      style={{
                        ...panelStyles.iconButton,
                        width: "auto",
                        padding: "3px 7px",
                        fontSize: 10,
                        opacity: controlOpacity,
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </details>

          <details
            data-testid="seismic-capability-slice-planes"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>3D slice planes</summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Plane</label>
                {[
                  { id: "inline-slice", label: "Inline" },
                  { id: "crossline-slice", label: "Crossline" },
                  { id: "time-depth-plane", label: "Time/depth" },
                ].map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    data-testid={`seismic-capability-${action.id}`}
                    disabled={disabled}
                    onClick={() => applyCapabilityPreset(action.id)}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Position</label>
                <input
                  data-testid="seismic-capability-slice-position"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={sliceFraction}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicSliceFraction: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${sliceFraction * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {sliceFraction.toFixed(2)}
                </span>
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-volume-sync"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Volume + slice sync</summary>
            <div style={detailsContentStyle}>
              <div style={{ ...nestedControlRowStyle, gap: 6 }}>
                <label style={nestedFieldLabelStyle}>Synced view</label>
                <button
                  type="button"
                  data-testid="seismic-capability-volume-slice-sync"
                  disabled={disabled}
                  onClick={() => applyCapabilityPreset("volume-slice-sync")}
                  style={{
                    ...panelStyles.iconButton,
                    width: "auto",
                    padding: "3px 7px",
                    fontSize: 10,
                    opacity: controlOpacity,
                  }}
                >
                  Apply
                </button>
                <span
                  style={{
                    flex: 1,
                    color: vibrancyTertiaryLabel,
                    fontSize: 11,
                    opacity: controlOpacity,
                  }}
                >
                  volume plus movable cut plane
                </span>
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-line-theatre"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>
              2D / legacy section theatre
            </summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Curtain</label>
                {lineTheatreActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    data-testid={`seismic-capability-${action.id}`}
                    disabled={disabled}
                    onClick={() => applyCapabilityPreset(action.id)}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-processing-comparison"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Processing comparison</summary>
            <div style={detailsContentStyle}>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Mode</label>
                <select
                  data-testid="seismic-comparison-mode-select"
                  value={comparisonMode}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({
                      seismicComparisonMode:
                        e.target.value === "side-by-side"
                          ? "side-by-side"
                          : "overlay",
                    })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  <option value="overlay">Overlay</option>
                  <option value="side-by-side">Side-by-side</option>
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Spacing</label>
                <input
                  data-testid="seismic-comparison-spacing"
                  type="range"
                  min={0}
                  max={3000}
                  step={50}
                  value={comparisonSpacingM}
                  disabled={disabled || comparisonMode !== "side-by-side"}
                  onChange={(e) =>
                    commit({
                      seismicComparisonSpacingM: parseFloat(e.target.value),
                    })
                  }
                  style={
                    {
                      flex: 1,
                      opacity:
                        comparisonMode === "side-by-side"
                          ? controlOpacity
                          : 0.35,
                      "--editor-slider-fill": `${(comparisonSpacingM / 3000) * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {comparisonSpacingM.toFixed(0)} m
                </span>
              </div>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Pair</label>
                {comparisonActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    data-testid={`seismic-comparison-pair-${action.label.toLowerCase()}`}
                    disabled={disabled}
                    onClick={() =>
                      commit({
                        seismicCapabilityPresetId:
                          action.label === "301"
                            ? "enhanced-vs-unenhanced"
                            : `enhanced-vs-unenhanced-${action.label.toLowerCase()}`,
                        seismicProductId: action.primary,
                        seismicProductVisibility: Object.fromEntries(
                          products.map((product) => [
                            product.id,
                            product.id === action.primary ||
                              product.id === action.compare,
                          ]),
                        ),
                        seismicRenderMode: "slice",
                        seismicSliceAxis: "line",
                        seismicComparisonProductId: action.compare,
                        seismicComparisonMode: comparisonMode,
                      })
                    }
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-display-cleanup"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Display cleanup</summary>
            <div style={detailsContentStyle}>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Opacity</label>
                <input
                  data-testid="seismic-capability-opacity"
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={seismicOpacity}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ opacity: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${seismicOpacity * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {seismicOpacity.toFixed(2)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>
                  {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}
                </label>
                <input
                  data-testid="seismic-capability-amplitude-min"
                  type="range"
                  min={0}
                  max={0.98}
                  step={0.01}
                  value={amplitudeMin}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${amplitudeMin * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {seismicWindowValueLabel(selectedProduct, amplitudeMin)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>
                  {isVelocityProduct(selectedProduct) ? "Vel max" : "Amp max"}
                </label>
                <input
                  data-testid="seismic-capability-amplitude-max"
                  type="range"
                  min={0.02}
                  max={1}
                  step={0.01}
                  value={amplitudeMax}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${amplitudeMax * 100}%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {seismicWindowValueLabel(selectedProduct, amplitudeMax)}
                </span>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Palette</label>
                <select
                  data-testid="seismic-capability-colormap-select"
                  value={colormap}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({
                      seismicColormap: seismicColormapFromValue(e.target.value),
                    })
                  }
                  style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
                >
                  <option value="blue-white-red">Blue-white-red</option>
                  <option value="grayscale">Grayscale</option>
                  <option value="velocity">Velocity</option>
                </select>
              </div>
              <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
                <span style={nestedFieldLabelStyle}>White bg</span>
                <input
                  data-testid="seismic-capability-remove-background"
                  type="checkbox"
                  checked={removeBackground}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicRemoveBackground: e.target.checked })
                  }
                  style={{ opacity: controlOpacity }}
                />
                <span
                  style={{
                    flex: 1,
                    color: vibrancyTertiaryLabel,
                    fontSize: 11,
                    opacity: controlOpacity,
                  }}
                >
                  remove neutral fill
                </span>
              </label>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Time scale</label>
                <input
                  data-testid="seismic-capability-time-scale"
                  type="range"
                  min={0.25}
                  max={8}
                  step={0.25}
                  value={timeScale}
                  disabled={disabled}
                  onChange={(e) =>
                    commit({ seismicTimeScale: parseFloat(e.target.value) })
                  }
                  style={
                    {
                      flex: 1,
                      opacity: controlOpacity,
                      "--editor-slider-fill": `${
                        ((timeScale - 0.25) / 7.75) * 100
                      }%`,
                    } as React.CSSProperties
                  }
                />
                <span style={sliderNumberReadoutStyle}>
                  {timeScale.toFixed(2)}
                </span>
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-survey-geometry"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Survey geometry</summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>Preset</label>
                <button
                  type="button"
                  data-testid="seismic-capability-survey-geometry-preset"
                  disabled={disabled}
                  onClick={() => applyCapabilityPreset("survey-geometry")}
                  style={{
                    ...panelStyles.iconButton,
                    width: "auto",
                    padding: "3px 7px",
                    fontSize: 10,
                    opacity: controlOpacity,
                  }}
                >
                  Show survey
                </button>
              </div>
              {[
                {
                  role: "sources" as const,
                  label: "Sources",
                  checked: navigationSourcesVisible,
                },
                {
                  role: "receivers" as const,
                  label: "Receivers",
                  checked: navigationReceiversVisible,
                },
                {
                  role: "lines" as const,
                  label: "Lines",
                  checked: navigationLinesVisible,
                },
              ].map((item) => (
                <label
                  key={item.role}
                  style={{ ...nestedControlRowStyle, cursor: "pointer" }}
                >
                  <span style={nestedFieldLabelStyle}>{item.label}</span>
                  <input
                    data-testid={`seismic-navigation-role-${item.role}`}
                    type="checkbox"
                    checked={item.checked}
                    disabled={disabled}
                    onChange={(e) =>
                      setNavigationRoleVisible(item.role, e.target.checked)
                    }
                    style={{ opacity: controlOpacity }}
                  />
                  <span style={{ flex: 1 }} />
                </label>
              ))}
            </div>
          </details>

          <details
            data-testid="seismic-capability-integrated-geophysics"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Integrated geophysics</summary>
            <div style={detailsContentStyle}>
              <div
                style={{ ...nestedControlRowStyle, gap: 6, flexWrap: "wrap" }}
              >
                <label style={nestedFieldLabelStyle}>View</label>
                {[
                  {
                    label: "Seismic",
                    testId: "seismic-capability-seismic-only",
                    onClick: () => setMtCoRender("seismic"),
                  },
                  {
                    label: "MT",
                    testId: "seismic-capability-mt-only",
                    onClick: () => setMtCoRender("mt"),
                  },
                  {
                    label: "Integrated",
                    testId: "seismic-capability-integrated",
                    onClick: () =>
                      applyCapabilityPreset("integrated-geophysics"),
                  },
                ].map((action) => (
                  <button
                    key={action.testId}
                    type="button"
                    data-testid={action.testId}
                    disabled={disabled}
                    onClick={action.onClick}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </details>

          <details
            data-testid="seismic-capability-data-confidence"
            style={nestedDetailsStyle}
            open
          >
            <summary style={panelStyles.summary}>Data confidence</summary>
            <div
              style={{
                ...detailsContentStyle,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
              }}
            >
              <div>Products: {products.length} processed GUI products</div>
              <div>3D raymarch-capable: {raymarchProducts.length}</div>
              <div>
                Active capability:{" "}
                {currentCapabilityPresetId || "manual controls"}
              </div>
              <div>{SEISMIC_DEMO_DISCLOSURE_LABELS.join(" / ")}</div>
            </div>
          </details>
        </>
      ) : null}

      <details
        data-testid="seismic-technical-controls"
        style={nestedDetailsStyle}
        open={technicalOpen}
        onToggle={(event) =>
          setTechnicalOpen((event.currentTarget as HTMLDetailsElement).open)
        }
      >
        <summary style={panelStyles.summary}>Technical controls</summary>
        <div style={detailsContentStyle}>
          <details style={nestedDetailsStyle}>
            <summary style={panelStyles.summary}>
              Product visibility ({visibleProductCount}/{products.length})
            </summary>
            <div style={detailsContentStyle}>
              <div
                style={{
                  ...nestedControlRowStyle,
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <label style={nestedFieldLabelStyle}>Visibility</label>
                {[
                  {
                    label: "Show all",
                    testId: "seismic-products-show-all",
                    onClick: () => setVisibilityForProducts(() => true),
                  },
                  {
                    label: "Hide all",
                    testId: "seismic-products-hide-all",
                    onClick: () => setVisibilityForProducts(() => false),
                  },
                  {
                    label: "3D only",
                    testId: "seismic-products-show-3d-only",
                    onClick: () =>
                      setVisibilityForProducts(
                        (product) => product.surveyKind === "3d",
                      ),
                  },
                  {
                    label: "2D only",
                    testId: "seismic-products-show-2d-only",
                    onClick: () =>
                      setVisibilityForProducts(
                        (product) => product.surveyKind !== "3d",
                      ),
                  },
                ].map((action) => (
                  <button
                    key={action.testId}
                    type="button"
                    data-testid={action.testId}
                    disabled={disabled}
                    onClick={action.onClick}
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      padding: "3px 7px",
                      fontSize: 10,
                      opacity: controlOpacity,
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              {products.map((product) => {
                const selected = product.id === productId;
                return (
                  <div
                    key={product.id}
                    style={{
                      ...nestedControlRowStyle,
                      borderRadius: 6,
                      background: selected
                        ? "rgba(244, 240, 232, 0.08)"
                        : "transparent",
                    }}
                  >
                    <input
                      data-testid={`seismic-product-visible-${product.id}`}
                      type="checkbox"
                      checked={productVisibility[product.id] === true}
                      disabled={disabled}
                      onChange={(e) =>
                        setProductVisible(product.id, e.target.checked)
                      }
                      title="Show or hide this product"
                      style={{ opacity: controlOpacity }}
                    />
                    <button
                      type="button"
                      data-testid={`seismic-product-row-${product.id}`}
                      disabled={disabled}
                      onClick={() => selectProduct(product.id)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        appearance: "none",
                        border: "none",
                        background: "transparent",
                        color: selected ? vibrancyLabel : vibrancyTertiaryLabel,
                        font: "inherit",
                        fontSize: 11,
                        fontWeight: selected ? 800 : 650,
                        textAlign: "left",
                        cursor: disabled ? "default" : "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        opacity: controlOpacity,
                      }}
                      title={product.label}
                    >
                      {product.label}
                    </button>
                    <span
                      style={{
                        color: vibrancyTertiaryLabel,
                        fontSize: 11,
                        opacity: controlOpacity,
                        minWidth: 54,
                        textAlign: "right",
                      }}
                    >
                      {product.raymarchCapable
                        ? "3D"
                        : (product.surveyKind ?? "2D")}
                      {product.domainUnit ? ` / ${product.domainUnit}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </details>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Product</label>
            <select
              data-testid="seismic-product-select"
              value={productId}
              disabled={disabled || products.length === 0}
              onChange={(e) => selectProduct(e.target.value)}
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
            </select>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Compare</label>
            <select
              data-testid="seismic-comparison-product-select"
              value={comparisonProductId ?? "none"}
              disabled={disabled}
              onChange={(e) => setComparisonProduct(e.target.value)}
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="none">None</option>
              {products
                .filter((product) => product.id !== productId)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.label}
                  </option>
                ))}
            </select>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Mode</label>
            <select
              data-testid="seismic-render-mode-select"
              value={renderMode}
              disabled={disabled || !selectedProduct?.raymarchCapable}
              onChange={(e) =>
                commit({
                  seismicRenderMode:
                    e.target.value === "raymarch" ? "raymarch" : "slice",
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="slice">Slice</option>
              {selectedProduct?.raymarchCapable ? (
                <option value="raymarch">Raymarch</option>
              ) : null}
            </select>
          </div>

          {selectedProduct?.raymarchCapable ? (
            <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
              <span style={nestedFieldLabelStyle}>Sync slice</span>
              <input
                data-testid="seismic-slice-through-volume"
                type="checkbox"
                checked={sliceThroughVolume}
                disabled={disabled}
                onChange={(e) =>
                  commit({ seismicSliceThroughVolume: e.target.checked })
                }
                style={{ opacity: controlOpacity }}
              />
              <span
                style={{
                  flex: 1,
                  color: vibrancyTertiaryLabel,
                  fontSize: 11,
                  opacity: controlOpacity,
                }}
              >
                through volume
              </span>
            </label>
          ) : null}

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Slice</label>
            <select
              data-testid="seismic-slice-axis-select"
              value={sliceAxis}
              disabled={
                disabled || (renderMode === "raymarch" && !sliceThroughVolume)
              }
              onChange={(e) =>
                commit({
                  seismicSliceAxis: e.target.value as NonNullable<
                    EditableStyle["seismicSliceAxis"]
                  >,
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              {selectedProduct?.surveyKind === "3d" ? (
                <>
                  <option value="inline">Inline</option>
                  <option value="crossline">Crossline</option>
                  <option value="sample">Time/depth plane</option>
                </>
              ) : (
                <option value="line">2D line</option>
              )}
            </select>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Position</label>
            <input
              data-testid="seismic-slice-fraction"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sliceFraction}
              disabled={
                disabled || (renderMode === "raymarch" && !sliceThroughVolume)
              }
              onChange={(e) =>
                commit({ seismicSliceFraction: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${sliceFraction * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {sliceFraction.toFixed(2)}
            </span>
          </div>

          <IsobandControls
            style={style}
            disabled={disabled}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            rangeKind="seismic"
            volumePlanes={
              selectedProduct?.raymarchCapable === true &&
              renderMode === "raymarch"
            }
            sceneSectionStyle={sceneSectionStyle}
            sceneHandle={sceneHandle}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
          />

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {isVelocityProduct(selectedProduct) ? "Vel min" : "Amp min"}
            </label>
            <input
              data-testid="seismic-amplitude-min"
              type="range"
              min={0}
              max={0.98}
              step={0.01}
              value={amplitudeMin}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicAmplitudeMin: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${amplitudeMin * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(selectedProduct, amplitudeMin)}
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {isVelocityProduct(selectedProduct) ? "Vel max" : "Amp max"}
            </label>
            <input
              data-testid="seismic-amplitude-max"
              type="range"
              min={0.02}
              max={1}
              step={0.01}
              value={amplitudeMax}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicAmplitudeMax: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${amplitudeMax * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {seismicWindowValueLabel(selectedProduct, amplitudeMax)}
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Gain curve</label>
            <input
              data-testid="seismic-amplitude-gamma"
              type="range"
              min={0.35}
              max={2.5}
              step={0.05}
              value={amplitudeGamma}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicAmplitudeGamma: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${
                    ((amplitudeGamma - 0.35) / 2.15) * 100
                  }%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {amplitudeGamma.toFixed(2)}
            </span>
          </div>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Palette</label>
            <select
              data-testid="seismic-colormap-select"
              value={colormap}
              disabled={disabled}
              onChange={(e) =>
                commit({
                  seismicColormap: seismicColormapFromValue(e.target.value),
                })
              }
              style={{ flex: 1, minWidth: 0, opacity: controlOpacity }}
            >
              <option value="blue-white-red">Blue-white-red</option>
              <option value="grayscale">Grayscale</option>
              <option value="velocity">Velocity</option>
            </select>
          </div>

          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Legend</span>
            <input
              data-testid="seismic-legend-visible"
              type="checkbox"
              checked={legendVisible}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicLegendVisible: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              amplitude controls
            </span>
          </label>

          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>White bg</span>
            <input
              data-testid="seismic-remove-background"
              type="checkbox"
              checked={removeBackground}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicRemoveBackground: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              remove neutral fill
            </span>
          </label>

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Zero mute</label>
            <input
              data-testid="seismic-background-cutoff"
              type="range"
              min={0}
              max={0.45}
              step={0.01}
              value={backgroundCutoff}
              disabled={disabled || !removeBackground}
              onChange={(e) =>
                commit({ seismicBackgroundCutoff: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: removeBackground ? controlOpacity : 0.35,
                  "--editor-slider-fill": `${(backgroundCutoff / 0.45) * 100}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>
              {backgroundCutoff.toFixed(2)}
            </span>
          </div>

          {selectedProduct?.raymarchCapable ? (
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Ray steps</label>
              <input
                data-testid="seismic-volume-sample-steps"
                type="range"
                min={24}
                max={160}
                step={8}
                value={volumeSampleSteps}
                disabled={disabled}
                onChange={(e) =>
                  commit({
                    seismicVolumeSampleSteps: parseFloat(e.target.value),
                  })
                }
                style={
                  {
                    flex: 1,
                    opacity: controlOpacity,
                    "--editor-slider-fill": `${
                      ((volumeSampleSteps - 24) / 136) * 100
                    }%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>{volumeSampleSteps}</span>
            </div>
          ) : null}

          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Time scale</label>
            <input
              data-testid="seismic-time-scale"
              type="range"
              min={0.25}
              max={8}
              step={0.25}
              value={timeScale}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicTimeScale: parseFloat(e.target.value) })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${
                    ((timeScale - 0.25) / 7.75) * 100
                  }%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{timeScale.toFixed(2)}</span>
          </div>

          <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
            <span style={nestedFieldLabelStyle}>Navigation</span>
            <input
              data-testid="seismic-navigation-visible"
              type="checkbox"
              checked={navigationVisible}
              disabled={disabled}
              onChange={(e) =>
                commit({ seismicNavigationVisible: e.target.checked })
              }
              style={{ opacity: controlOpacity }}
            />
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                opacity: controlOpacity,
              }}
            >
              source/receiver lines
            </span>
          </label>
        </div>
      </details>
    </>
  );
}

function ScalarPointDrawReadout({
  sceneHandle,
  layerId,
  inclusionMode,
}: {
  sceneHandle: SceneHandle;
  layerId: string;
  inclusionMode: "all-valid" | "thresholded";
}) {
  const group = sceneHandle.manager.getLayer(layerId);
  let sourceCount = 0;
  let drawnCount = 0;

  group?.traverse((object) => {
    const geometry = (
      object as {
        geometry?: {
          getAttribute?: (name: string) => { count?: number } | undefined;
          getIndex?: () => { count?: number } | null;
          userData?: Record<string, unknown>;
        };
      }
    ).geometry;
    const positionCount = geometry?.getAttribute?.("position")?.count;
    if (typeof positionCount !== "number" || positionCount <= 0) return;
    if (!geometry?.userData?.scalarValues) return;

    sourceCount += positionCount;
    const indexCount = geometry.getIndex?.()?.count;
    drawnCount += typeof indexCount === "number" ? indexCount : positionCount;
  });

  const hasPoints = sourceCount > 0;
  const allDrawn = hasPoints && sourceCount === drawnCount;

  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>Draw QA</label>
      <span
        style={{
          flex: 1,
          color: allDrawn ? vibrancyLabel : "#ffbf6b",
          fontSize: 11,
          lineHeight: 1.35,
        }}
      >
        {hasPoints
          ? `Drawn ${drawnCount.toLocaleString()} / ${sourceCount.toLocaleString()} points (${inclusionMode})`
          : `Waiting for scalar point tiles (${inclusionMode})`}
      </span>
    </div>
  );
}

function ScalarRampControls({
  style,
  targetLabel,
  fullDensityMode = false,
  disabled,
  isPageOverride,
  overridden,
  volumeThresholdMode = false,
  onToggleOverride,
  onChange,
}: {
  style: EditableStyle;
  targetLabel: string;
  fullDensityMode?: boolean;
  disabled: boolean;
  isPageOverride: boolean;
  overridden: boolean;
  volumeThresholdMode?: boolean;
  onToggleOverride?: (enabled: boolean) => void;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const lowColor = styleString(style, "scalarColorLow", "#2cc9ff");
  const midColor = styleString(style, "scalarColorMid", "#f8dd6d");
  const highColor = styleString(style, "scalarColorHigh", "#ff637a");
  const sourceMin = SCALAR_SOURCE_MIN;
  const sourceMax = SCALAR_SOURCE_MAX;
  const colorMin = Math.max(
    sourceMin,
    Math.min(
      sourceMax - 0.01,
      styleNumber(style, "scalarDisplayMin", 0.139879),
    ),
  );
  const colorMax = Math.min(
    sourceMax,
    Math.max(styleNumber(style, "scalarDisplayMax", 3.937122), colorMin + 0.01),
  );
  const trimMin = Math.max(
    sourceMin,
    Math.min(
      sourceMax - 0.01,
      volumeThresholdMode
        ? styleNumber(
            style,
            "scalarVolumeThresholdMin",
            styleNumber(style, "scalarFocusMin", sourceMin),
          )
        : styleNumber(style, "scalarFocusMin", sourceMin),
    ),
  );
  const trimMax = Math.max(
    trimMin + 0.01,
    Math.min(
      sourceMax,
      volumeThresholdMode
        ? styleNumber(
            style,
            "scalarVolumeThresholdMax",
            styleNumber(style, "scalarFocusMax", sourceMax),
          )
        : styleNumber(style, "scalarFocusMax", sourceMax),
    ),
  );
  const blendMin = Math.max(
    trimMin,
    Math.min(trimMax - 0.01, styleNumber(style, "scalarBlendMin", colorMin)),
  );
  const rawBlendMax = styleNumber(style, "scalarBlendMax", colorMax);
  const blendMax = Math.min(trimMax, Math.max(rawBlendMax, blendMin + 0.01));
  const midpoint = Math.max(
    0.05,
    Math.min(0.95, styleNumber(style, "scalarMidpoint", 0.5)),
  );
  const contrast = Math.max(
    0.35,
    Math.min(3, styleNumber(style, "scalarContrast", 1)),
  );
  const midpointFill = Math.max(0, Math.min(100, midpoint * 100));
  const contrastFill = Math.max(
    0,
    Math.min(100, ((contrast - 0.35) / (3 - 0.35)) * 100),
  );
  const inclusionMode =
    fullDensityMode && style.scalarInclusionMode !== "thresholded"
      ? "all-valid"
      : style.scalarInclusionMode === "thresholded"
        ? "thresholded"
        : "all-valid";
  const thresholdControlsVisible = true;
  const controlOpacity = disabled ? 0.4 : 1;
  const sourceRange = Math.max(0.01, sourceMax - sourceMin);
  const blendMinFill = Math.max(
    0,
    Math.min(100, ((blendMin - sourceMin) / sourceRange) * 100),
  );
  const blendMaxFill = Math.max(
    blendMinFill,
    Math.min(100, ((blendMax - sourceMin) / sourceRange) * 100),
  );
  const colorMinFill = Math.max(
    0,
    Math.min(100, ((colorMin - sourceMin) / sourceRange) * 100),
  );
  const colorMaxFill = Math.max(
    colorMinFill,
    Math.min(100, ((colorMax - sourceMin) / sourceRange) * 100),
  );
  const colorMidFill = colorMinFill + (colorMaxFill - colorMinFill) * midpoint;
  const trimMinFill = Math.max(
    0,
    Math.min(100, ((trimMin - sourceMin) / sourceRange) * 100),
  );
  const trimMaxFill = Math.max(
    trimMinFill,
    Math.min(100, ((trimMax - sourceMin) / sourceRange) * 100),
  );
  const valueFill = (value: number) =>
    `${Math.max(0, Math.min(100, ((value - sourceMin) / sourceRange) * 100))}%`;
  const spectrumBackground = `linear-gradient(90deg, ${lowColor} 0%, ${lowColor} ${colorMinFill.toFixed(
    1,
  )}%, ${midColor} ${colorMidFill.toFixed(1)}%, ${highColor} ${colorMaxFill.toFixed(
    1,
  )}%, ${highColor} 100%)`;

  return (
    <>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Target</label>
        <span
          style={{
            flex: 1,
            color: vibrancyLabel,
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1.3,
            opacity: controlOpacity,
          }}
        >
          Scalar controls target: {targetLabel}
        </span>
      </div>
      {fullDensityMode ? (
        <>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Inclusion</label>
            <select
              value={inclusionMode}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  scalarInclusionMode:
                    e.target.value === "thresholded"
                      ? "thresholded"
                      : "all-valid",
                })
              }
              style={{
                flex: 1,
                opacity: controlOpacity,
              }}
            >
              <option value="all-valid">All valid points</option>
              <option value="thresholded">Threshold/filter points</option>
            </select>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Mode note</label>
            <span
              style={{
                flex: 1,
                color: vibrancyTertiaryLabel,
                fontSize: 11,
                lineHeight: 1.35,
                opacity: controlOpacity,
              }}
            >
              {inclusionMode === "thresholded"
                ? "Trim, feather, and noise can filter drawn points."
                : "Trim, feather, and noise change visual emphasis; all valid points stay drawn."}
            </span>
          </div>
        </>
      ) : null}
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Spectrum</label>
        {isPageOverride ? (
          <input
            type="checkbox"
            checked={overridden}
            onChange={(e) => onToggleOverride?.(e.target.checked)}
            title="Override environment scalar ramp for this page"
          />
        ) : null}
        <div
          style={{
            flex: 1,
            position: "relative",
            height: 22,
            opacity: controlOpacity,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 6,
              height: 14,
              borderRadius: 999,
              border: FROSTED_HAIRLINE,
              background: spectrumBackground,
              overflow: "hidden",
            }}
          >
            {thresholdControlsVisible ? (
              <>
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${trimMinFill}%`,
                    background: "rgba(0, 0, 0, 0.58)",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: `${trimMaxFill}%`,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    background: "rgba(0, 0, 0, 0.58)",
                  }}
                />
                {blendMinFill > trimMinFill ? (
                  <span
                    style={{
                      position: "absolute",
                      left: `${trimMinFill}%`,
                      width: `${blendMinFill - trimMinFill}%`,
                      top: 0,
                      bottom: 0,
                      background:
                        "linear-gradient(90deg, rgba(0, 0, 0, 0.54), rgba(0, 0, 0, 0))",
                    }}
                  />
                ) : null}
                {trimMaxFill > blendMaxFill ? (
                  <span
                    style={{
                      position: "absolute",
                      left: `${blendMaxFill}%`,
                      width: `${trimMaxFill - blendMaxFill}%`,
                      top: 0,
                      bottom: 0,
                      background:
                        "linear-gradient(90deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.54))",
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </div>
          {thresholdControlsVisible
            ? [trimMinFill, blendMinFill, blendMaxFill, trimMaxFill].map(
                (left, index) => (
                  <span
                    key={`${index}-${left.toFixed(1)}`}
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      top: 0,
                      width: index === 0 || index === 3 ? 7 : 5,
                      height: index === 0 || index === 3 ? 18 : 14,
                      borderRadius: 999,
                      transform: "translateX(-50%)",
                      background:
                        index === 0 || index === 3
                          ? "rgba(255, 255, 255, 0.92)"
                          : "rgba(255, 255, 255, 0.42)",
                      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.45)",
                    }}
                  />
                ),
              )
            : null}
        </div>
        {isPageOverride ? (
          <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
            {overridden ? "overridden" : "inherited"}
          </span>
        ) : null}
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Colors</label>
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          <SurfaceGradientColorInput
            label="Low"
            value={lowColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ scalarColorLow: value })}
          />
          <SurfaceGradientColorInput
            label="Mid"
            value={midColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ scalarColorMid: value })}
          />
          <SurfaceGradientColorInput
            label="High"
            value={highColor}
            disabled={disabled}
            opacity={controlOpacity}
            onChange={(value) => onChange({ scalarColorHigh: value })}
          />
        </div>
      </div>
      {thresholdControlsVisible ? (
        <>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {volumeThresholdMode ? "Cut min" : "Trim min"}
            </label>
            <input
              type="range"
              aria-label={
                volumeThresholdMode
                  ? "Scalar volume cut minimum"
                  : "Scalar trim minimum"
              }
              min={sourceMin}
              max={sourceMax}
              step={0.01}
              value={trimMin}
              disabled={disabled}
              onChange={(e) => {
                const next = Math.min(
                  parseFloat(e.target.value),
                  trimMax - 0.01,
                );
                const nextTrimMin = Math.max(sourceMin, next);
                const nextBlendMin = Math.max(blendMin, nextTrimMin);
                const nextBlendMax = Math.min(
                  trimMax,
                  Math.max(blendMax, nextBlendMin + 0.01),
                );
                onChange({
                  scalarFocusMin: nextTrimMin,
                  ...(volumeThresholdMode
                    ? {
                        scalarVolumeThresholdMin: nextTrimMin,
                        scalarVolumeThresholdMax: trimMax,
                      }
                    : {}),
                  scalarBlendMin: nextBlendMin,
                  scalarBlendMax: nextBlendMax,
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${trimMinFill}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{trimMin.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>
              {volumeThresholdMode ? "Cut max" : "Trim max"}
            </label>
            <input
              type="range"
              aria-label={
                volumeThresholdMode
                  ? "Scalar volume cut maximum"
                  : "Scalar trim maximum"
              }
              min={sourceMin}
              max={sourceMax}
              step={0.01}
              value={trimMax}
              disabled={disabled}
              onChange={(e) => {
                const next = Math.max(
                  parseFloat(e.target.value),
                  trimMin + 0.01,
                );
                const nextTrimMax = Math.min(sourceMax, next);
                const nextBlendMax = Math.min(blendMax, nextTrimMax);
                const nextBlendMin = Math.max(
                  trimMin,
                  Math.min(blendMin, nextBlendMax - 0.01),
                );
                onChange({
                  scalarFocusMax: nextTrimMax,
                  ...(volumeThresholdMode
                    ? {
                        scalarVolumeThresholdMin: trimMin,
                        scalarVolumeThresholdMax: nextTrimMax,
                      }
                    : {}),
                  scalarBlendMin: nextBlendMin,
                  scalarBlendMax: nextBlendMax,
                });
              }}
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": `${trimMaxFill}%`,
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{trimMax.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Feather min</label>
            <input
              type="range"
              aria-label="Scalar feather minimum"
              min={sourceMin}
              max={sourceMax}
              step={0.01}
              value={blendMin}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  scalarBlendMin: Math.max(
                    trimMin,
                    Math.min(parseFloat(e.target.value), blendMax - 0.01),
                  ),
                })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": valueFill(blendMin),
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{blendMin.toFixed(2)}</span>
          </div>
          <div style={nestedControlRowStyle}>
            <label style={nestedFieldLabelStyle}>Feather max</label>
            <input
              type="range"
              aria-label="Scalar feather maximum"
              min={sourceMin}
              max={sourceMax}
              step={0.01}
              value={blendMax}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  scalarBlendMax: Math.min(
                    trimMax,
                    Math.max(parseFloat(e.target.value), blendMin + 0.01),
                  ),
                })
              }
              style={
                {
                  flex: 1,
                  opacity: controlOpacity,
                  "--editor-slider-fill": valueFill(blendMax),
                } as React.CSSProperties
              }
            />
            <span style={sliderNumberReadoutStyle}>{blendMax.toFixed(2)}</span>
          </div>
          {fullDensityMode ? (
            <div style={nestedControlRowStyle}>
              <label style={nestedFieldLabelStyle}>Noise</label>
              <input
                type="range"
                aria-label="Scalar noise threshold"
                min={0}
                max={1}
                step={0.01}
                value={styleNumber(style, "scalarNoiseThreshold", 0)}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ scalarNoiseThreshold: parseFloat(e.target.value) })
                }
                style={
                  {
                    flex: 1,
                    opacity: controlOpacity,
                    "--editor-slider-fill": `${Math.round(
                      styleNumber(style, "scalarNoiseThreshold", 0) * 100,
                    )}%`,
                  } as React.CSSProperties
                }
              />
              <span style={sliderNumberReadoutStyle}>
                {Math.round(
                  styleNumber(style, "scalarNoiseThreshold", 0) * 100,
                )}
                %
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Trim</label>
          <span
            style={{
              flex: 1,
              color: vibrancyTertiaryLabel,
              fontSize: 11,
              lineHeight: 1.35,
              opacity: controlOpacity,
            }}
          >
            All-valid mode draws every valid source point. Trim, feather, and
            noise controls are available in Threshold/filter points mode.
          </span>
        </div>
      )}
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Midpoint</label>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={midpoint}
          disabled={disabled}
          onChange={(e) =>
            onChange({ scalarMidpoint: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${midpointFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{midpoint.toFixed(2)}</span>
      </div>
      <div style={nestedControlRowStyle}>
        <label style={nestedFieldLabelStyle}>Nuance</label>
        <input
          type="range"
          min={0.35}
          max={3}
          step={0.05}
          value={contrast}
          disabled={disabled}
          onChange={(e) =>
            onChange({ scalarContrast: parseFloat(e.target.value) })
          }
          style={
            {
              flex: 1,
              opacity: controlOpacity,
              "--editor-slider-fill": `${contrastFill}%`,
            } as React.CSSProperties
          }
        />
        <span style={sliderNumberReadoutStyle}>{contrast.toFixed(2)}</span>
      </div>
    </>
  );
}

type LayerStyleSetter = (
  layerId: string,
  patch: Partial<EditableStyle>,
) => void;
type PageStyleSetter = (
  pageId: string,
  layerId: string,
  patch: Partial<EditableStyle>,
) => void;
type PageStyleClearer = (
  pageId: string,
  layerId: string,
  field: keyof EditableStyle,
) => void;

function LayerNumberStyleControl({
  label,
  field,
  fallback,
  min,
  max,
  step,
  decimals,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
  testId,
}: {
  label: string;
  field: keyof EditableStyle;
  fallback: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
  testId?: string;
}) {
  if (isEnv) {
    return (
      <EnvStyleRow
        label={label}
        inputType="range"
        value={String(styleNumber(style, field, fallback))}
        min={min}
        max={max}
        step={step}
        decimals={decimals}
        testId={testId}
        onChange={(value) =>
          setEnvLayerStyle(layerId, { [field]: parseFloat(value) })
        }
      />
    );
  }
  if (!currentPage) return null;
  return (
    <PageStyleRow
      label={label}
      inputType="range"
      inheritedValue={String(styleNumber(style, field, fallback))}
      isOverridden={isStyleFieldOverridden(currentPage, layerId, field)}
      overrideValue={
        currentPage.layerOverrides?.[layerId]?.[field] !== undefined
          ? String(currentPage.layerOverrides[layerId][field])
          : undefined
      }
      fallbackValue={String(fallback)}
      min={min}
      max={max}
      step={step}
      decimals={decimals}
      onOverride={(value) =>
        setPageLayerOverride(currentPage.id, layerId, {
          [field]: parseFloat(value),
        })
      }
      onClear={() => clearPageLayerOverride(currentPage.id, layerId, field)}
    />
  );
}

function LayerBooleanStyleControl({
  label,
  field,
  fallback,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  label: string;
  field: keyof EditableStyle;
  fallback: boolean;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const checked = styleBoolean(style, field, fallback);
  if (isEnv) {
    return (
      <EzGammaCheckboxRow
        label={label}
        checked={checked}
        onChange={(value) => setEnvLayerStyle(layerId, { [field]: value })}
      />
    );
  }
  if (!currentPage) return null;
  const overridden = isStyleFieldOverridden(currentPage, layerId, field);
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) {
            setPageLayerOverride(currentPage.id, layerId, { [field]: checked });
          } else {
            clearPageLayerOverride(currentPage.id, layerId, field);
          }
        }}
        title="Override environment value for this page"
      />
      <input
        type="checkbox"
        checked={checked}
        disabled={!overridden}
        onChange={(e) =>
          setPageLayerOverride(currentPage.id, layerId, {
            [field]: e.target.checked,
          })
        }
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function LayerColorStyleControl({
  label,
  field,
  fallback,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
  testId,
}: {
  label: string;
  field: keyof EditableStyle;
  fallback: string;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
  testId?: string;
}) {
  const value = styleString(style, field, fallback);
  if (isEnv) {
    return (
      <EnvStyleRow
        label={label}
        inputType="color"
        value={value}
        testId={testId}
        onChange={(next) => setEnvLayerStyle(layerId, { [field]: next })}
      />
    );
  }
  if (!currentPage) return null;
  return (
    <PageStyleRow
      label={label}
      inputType="color"
      inheritedValue={value}
      isOverridden={isStyleFieldOverridden(currentPage, layerId, field)}
      overrideValue={
        currentPage.layerOverrides?.[layerId]?.[field] !== undefined
          ? String(currentPage.layerOverrides[layerId][field])
          : undefined
      }
      fallbackValue={fallback}
      onOverride={(next) =>
        setPageLayerOverride(currentPage.id, layerId, { [field]: next })
      }
      onClear={() => clearPageLayerOverride(currentPage.id, layerId, field)}
    />
  );
}

function surfaceElevationDefaultPatch(): NonNullable<
  SceneProperties["terrain"]
> {
  return {
    materialPreset: "surface-elevation",
    surfaceElevationEnabled: true,
    surfaceElevationLegendVisible: true,
    surfaceElevationMinM: SURFACE_ELEVATION_DEFAULT_MIN_M,
    surfaceElevationMaxM: SURFACE_ELEVATION_DEFAULT_MAX_M,
    surfaceElevationColors: [...SURFACE_ELEVATION_DEFAULT_COLORS],
    surfaceElevationColorPositions: [...SURFACE_ELEVATION_DEFAULT_POSITIONS],
    surfaceElevationMidpoints: [...SURFACE_ELEVATION_DEFAULT_MIDPOINTS],
    surfaceElevationTransitionSoftness: SURFACE_ELEVATION_DEFAULT_SOFTNESS,
    surfaceElevationColorBlend: SURFACE_ELEVATION_DEFAULT_BLEND,
    surfaceElevationReverse: false,
    edgeFadeShape: "square",
    edgeFadeInsetM: 0,
    edgeFadeCornerRadiusM: 0,
  };
}

function surfaceElevationColorsFromTerrain(
  terrain: NonNullable<SceneProperties["terrain"]>,
): string[] {
  const colors = Array.isArray(terrain.surfaceElevationColors)
    ? terrain.surfaceElevationColors
    : [];
  return Array.from(
    { length: 5 },
    (_, index) => colors[index] ?? SURFACE_ELEVATION_DEFAULT_COLORS[index],
  );
}

function surfaceElevationPositionsFromTerrain(
  terrain: NonNullable<SceneProperties["terrain"]>,
): number[] {
  const values = Array.isArray(terrain.surfaceElevationColorPositions)
    ? terrain.surfaceElevationColorPositions
    : [];
  let previous = 0;
  return Array.from({ length: 5 }, (_, index) => {
    const raw =
      typeof values[index] === "number" && Number.isFinite(values[index])
        ? values[index]
        : SURFACE_ELEVATION_DEFAULT_POSITIONS[index];
    const remaining = 4 - index;
    const min = index === 0 ? 0 : previous + SURFACE_ELEVATION_STOP_GAP;
    const max = 1 - remaining * SURFACE_ELEVATION_STOP_GAP;
    const next = Math.min(max, Math.max(min, raw));
    previous = next;
    return next;
  });
}

function surfaceElevationMidpointsFromTerrain(
  terrain: NonNullable<SceneProperties["terrain"]>,
): number[] {
  const values = Array.isArray(terrain.surfaceElevationMidpoints)
    ? terrain.surfaceElevationMidpoints
    : [];
  return Array.from({ length: 4 }, (_, index) => {
    const raw =
      typeof values[index] === "number" && Number.isFinite(values[index])
        ? values[index]
        : SURFACE_ELEVATION_DEFAULT_MIDPOINTS[index];
    return Math.min(0.95, Math.max(0.05, raw));
  });
}

function surfaceElevationTickLabel(
  minM: number,
  maxM: number,
  index: number,
): string {
  return Math.round(minM + ((maxM - minM) * index) / 4).toLocaleString();
}

function surfaceElevationGradientCss(
  colors: string[],
  positions: number[],
  midpoints: number[],
): string {
  const parts: string[] = [];
  for (let index = 0; index < colors.length; index += 1) {
    const position = Math.min(1, Math.max(0, positions[index] ?? index / 4));
    if (index > 0) {
      const left = Math.min(1, Math.max(0, positions[index - 1] ?? 0));
      const midpoint = Math.min(
        0.95,
        Math.max(0.05, midpoints[index - 1] ?? 0.5),
      );
      const hint = left + (position - left) * midpoint;
      parts.push(`${(hint * 100).toFixed(1)}%`);
    }
    parts.push(`${colors[index]} ${(position * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

function PublicSurfaceGroupControls({
  style,
  scene,
  isEnv,
  currentPage,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
  setEnvScene,
  projectRoot,
}: {
  style: EditableStyle;
  scene: SceneProperties;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
  setEnvScene: (patch: Partial<SceneProperties>) => void;
  projectRoot: string;
}) {
  const terrain = scene.terrain ?? {};
  const [brandingUploadError, setBrandingUploadError] = useState<string | null>(
    null,
  );
  const [brandingUploading, setBrandingUploading] = useState(false);
  const layerId = "terrain";
  const setTerrain = (patch: NonNullable<SceneProperties["terrain"]>) => {
    if (!isEnv) return;
    setEnvScene({ terrain: { ...terrain, ...patch } });
  };
  const layerControlProps = {
    style,
    isEnv,
    currentPage,
    layerId,
    setEnvLayerStyle,
    setPageLayerOverride,
    clearPageLayerOverride,
  };
  const sceneFog = scene.fog ?? {};
  const sceneFogEnabled = sceneFog.enabled !== false;
  const sceneFogDensity = sceneFog.density ?? DEFAULT_FOG_DENSITY;
  const sceneFogReachKm = 3 / Math.max(sceneFogDensity, 0.000001) / 1000;
  const topoFogDensity =
    typeof style.fogDensity === "number" ? style.fogDensity : sceneFogDensity;
  const topoFogReachKm = 3 / Math.max(topoFogDensity, 0.000001) / 1000;
  const topoFogIncluded = style.affectedByFog !== false;
  const surfaceElevationMinM =
    typeof terrain.surfaceElevationMinM === "number"
      ? terrain.surfaceElevationMinM
      : SURFACE_ELEVATION_DEFAULT_MIN_M;
  const surfaceElevationMaxM =
    typeof terrain.surfaceElevationMaxM === "number"
      ? terrain.surfaceElevationMaxM
      : SURFACE_ELEVATION_DEFAULT_MAX_M;
  const surfaceElevationColors = surfaceElevationColorsFromTerrain(terrain);
  const surfaceElevationPositions =
    surfaceElevationPositionsFromTerrain(terrain);
  const surfaceElevationMidpoints =
    surfaceElevationMidpointsFromTerrain(terrain);
  const surfaceElevationTransitionSoftness =
    typeof terrain.surfaceElevationTransitionSoftness === "number"
      ? terrain.surfaceElevationTransitionSoftness
      : SURFACE_ELEVATION_DEFAULT_SOFTNESS;
  const surfaceElevationColorBlend =
    typeof terrain.surfaceElevationColorBlend === "number"
      ? terrain.surfaceElevationColorBlend
      : SURFACE_ELEVATION_DEFAULT_BLEND;
  const surfaceElevationGradient = surfaceElevationGradientCss(
    surfaceElevationColors,
    surfaceElevationPositions,
    surfaceElevationMidpoints,
  );
  const edgeFadeShape =
    terrain.edgeFadeShape === "rounded-square" ||
    terrain.edgeFadeShape === "circle"
      ? terrain.edgeFadeShape
      : "square";
  const topoMapBranding = terrain.topoMapBranding ?? {};
  const setTopoMapBranding = (
    patch: NonNullable<NonNullable<SceneProperties["terrain"]>["topoMapBranding"]>,
  ) => {
    setEnvScene({
      terrain: {
        ...terrain,
        topoMapBranding: { ...topoMapBranding, ...patch },
      },
    });
  };
  const onTopoMapBrandingLogoFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const originalName = file.name || "title-block-logo";
    const ext = originalName.split(".").pop()?.toLowerCase() ?? "";
    if (
      !TITLE_BLOCK_DIRECT_IMAGE_EXTENSIONS.has(ext) &&
      !TITLE_BLOCK_CONVERTED_EXTENSIONS.has(ext)
    ) {
      setBrandingUploadError(
        "Choose PNG, JPG, WebP, GIF, SVG, PDF, or EPS.",
      );
      event.target.value = "";
      return;
    }
    setBrandingUploading(true);
    setBrandingUploadError(null);
    try {
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const fileName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (TITLE_BLOCK_CONVERTED_EXTENSIONS.has(ext)) {
        const stem = fileName.replace(/\.[^.]+$/, "") || "title-block-logo";
        const sourcePath = `${projectRoot}/branding/source/${fileName}`;
        const outputPath = `${projectRoot}/branding/generated/${stem}.png`;
        await writeFile(sourcePath, b64, { encoding: "base64" });
        await convertBrandingAsset({
          sourcePath,
          outputPath,
          sourceFormat: ext,
        });
        setTopoMapBranding({
          logoPath: outputPath,
          logoRenderablePath: outputPath,
          logoSourcePath: sourcePath,
          logoSourceFormat: ext,
          visible: true,
        });
      } else {
        const path = `${projectRoot}/branding/${fileName}`;
        await writeFile(path, b64, { encoding: "base64" });
        setTopoMapBranding({
          logoPath: path,
          logoRenderablePath: path,
          logoSourcePath: path,
          logoSourceFormat: ext,
          visible: true,
        });
      }
    } catch (error) {
      setBrandingUploadError(String((error as Error).message ?? error));
    } finally {
      setBrandingUploading(false);
      event.target.value = "";
    }
  };
  const setSurfaceElevationColor = (index: number, value: string) => {
    const nextColors = [...surfaceElevationColors];
    nextColors[index] = value;
    setTerrain({ surfaceElevationColors: nextColors });
  };
  const setSurfaceElevationPosition = (index: number, value: number) => {
    const nextPositions = [...surfaceElevationPositions];
    const lower =
      index === 0 ? 0 : nextPositions[index - 1] + SURFACE_ELEVATION_STOP_GAP;
    const upper =
      index === nextPositions.length - 1
        ? 1
        : nextPositions[index + 1] - SURFACE_ELEVATION_STOP_GAP;
    nextPositions[index] = Math.min(Math.max(value, lower), upper);
    setTerrain({ surfaceElevationColorPositions: nextPositions });
  };
  const setSurfaceElevationMidpoint = (index: number, value: number) => {
    const nextMidpoints = [...surfaceElevationMidpoints];
    nextMidpoints[index] = Math.min(Math.max(value, 0.05), 0.95);
    setTerrain({ surfaceElevationMidpoints: nextMidpoints });
  };
  const selectedPreset: PublicTopoMaterialPresetId =
    PUBLIC_TOPO_MATERIAL_PRESETS.some(
      (preset) => preset.value === terrain.materialPreset,
    )
      ? (terrain.materialPreset as PublicTopoMaterialPresetId)
      : "custom";
  const setPublicTopoLayerStyle = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      for (const id of PUBLIC_SURFACE_LAYER_IDS) setEnvLayerStyle(id, patch);
    } else if (currentPage) {
      for (const id of PUBLIC_SURFACE_LAYER_IDS) {
        setPageLayerOverride(currentPage.id, id, patch);
      }
    }
  };
  const publicSurfaceLayerControlProps = {
    ...layerControlProps,
    setEnvLayerStyle: (_layerId: string, patch: Partial<EditableStyle>) =>
      setPublicTopoLayerStyle(patch),
    setPageLayerOverride: (
      _pageId: string,
      _layerId: string,
      patch: Partial<EditableStyle>,
    ) => setPublicTopoLayerStyle(patch),
    clearPageLayerOverride: (
      pageId: string,
      _layerId: string,
      field: keyof EditableStyle,
    ) => {
      for (const id of PUBLIC_SURFACE_LAYER_IDS) {
        clearPageLayerOverride(pageId, id, field);
      }
    },
  };
  const setSceneFog = (patch: NonNullable<SceneProperties["fog"]>) => {
    if (!isEnv) return;
    setEnvScene({ fog: { ...sceneFog, ...patch } });
  };
  const setTopoMaterialPreset = (value: PublicTopoMaterialPresetId) => {
    const preset = PUBLIC_TOPO_MATERIAL_PRESETS.find(
      (candidate) => candidate.value === value,
    );
    if (!preset?.patch) {
      setTerrain({ materialPreset: "custom" });
      return;
    }
    setTerrain({ surfaceElevationEnabled: false, ...preset.patch });
  };

  return (
    <>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Topo map transform</summary>
        <div style={detailsContentStyle}>
          <LayerNumberStyleControl
            label="Lift +/-"
            field="meshSurfaceLiftM"
            fallback={0}
            min={-5000}
            max={5000}
            step={25}
            decimals={0}
            {...layerControlProps}
          />
        </div>
      </details>
      <PublicSurfaceClipControls {...publicSurfaceLayerControlProps} />
      <details style={drillingAssayDetailsStyle} open>
        <summary style={drillingAssaySummaryStyle}>Title block</summary>
        <div style={detailsContentStyle}>
              <EzGammaCheckboxRow
                label="Visible"
                checked={topoMapBranding.visible === true}
                testId="topo-map-branding-visible"
                onChange={(checked) => setTopoMapBranding({ visible: checked })}
              />
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Logo file</label>
                <input
                  data-testid="topo-map-branding-logo-file"
                  type="file"
                  accept={TITLE_BLOCK_UPLOAD_ACCEPT}
                  disabled={brandingUploading}
                  onChange={onTopoMapBrandingLogoFile}
                  style={{ flex: 1, minWidth: 0, fontSize: 11 }}
                />
              </div>
              {topoMapBranding.logoPath ? (
                <div style={{ ...panelStyles.muted, fontSize: 11 }}>
                  {(
                    topoMapBranding.logoSourcePath ??
                    topoMapBranding.logoPath
                  )
                    .split("/")
                    .at(-1)}
                  <button
                    type="button"
                    onClick={() =>
                      setTopoMapBranding({
                        logoPath: "",
                        logoRenderablePath: "",
                        logoSourcePath: "",
                        logoSourceFormat: "",
                      })
                    }
                    style={{
                      ...panelStyles.iconButton,
                      width: "auto",
                      minHeight: 0,
                      marginLeft: 8,
                      padding: "1px 6px",
                      fontSize: 10,
                    }}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              {brandingUploadError ? (
                <div
                  style={{
                    color: "rgba(255, 111, 127, 0.9)",
                    fontSize: 11,
                  }}
                >
                  {brandingUploadError}
                </div>
              ) : null}
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Heading</label>
                <input
                  data-testid="topo-map-branding-heading"
                  type="text"
                  value={topoMapBranding.heading ?? ""}
                  onChange={(event) =>
                    setTopoMapBranding({ heading: event.currentTarget.value })
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Subheading</label>
                <input
                  data-testid="topo-map-branding-subheading"
                  type="text"
                  value={topoMapBranding.subheading ?? ""}
                  onChange={(event) =>
                    setTopoMapBranding({ subheading: event.currentTarget.value })
                  }
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Layout</label>
                <select
                  data-testid="topo-map-branding-layout"
                  value={topoMapBranding.layout ?? "horizontal"}
                  onChange={(event) =>
                    setTopoMapBranding({
                      layout: event.currentTarget
                        .value as NonNullable<
                        NonNullable<
                          SceneProperties["terrain"]
                        >["topoMapBranding"]
                      >["layout"],
                    })
                  }
                  style={{ flex: 1 }}
                >
                  <option value="horizontal">Horizontal</option>
                  <option value="stacked">Stacked</option>
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Logo pos.</label>
                <select
                  data-testid="topo-map-branding-logo-placement"
                  value={topoMapBranding.logoPlacement ?? "before"}
                  onChange={(event) =>
                    setTopoMapBranding({
                      logoPlacement: event.currentTarget
                        .value as NonNullable<
                        NonNullable<
                          SceneProperties["terrain"]
                        >["topoMapBranding"]
                      >["logoPlacement"],
                    })
                  }
                  style={{ flex: 1 }}
                >
                  <option value="before">Before text</option>
                  <option value="after">After text</option>
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Logo fit</label>
                <select
                  data-testid="topo-map-branding-logo-fit"
                  value={topoMapBranding.logoFit ?? "contain"}
                  onChange={(event) =>
                    setTopoMapBranding({
                      logoFit: event.currentTarget
                        .value as NonNullable<
                        NonNullable<
                          SceneProperties["terrain"]
                        >["topoMapBranding"]
                      >["logoFit"],
                    })
                  }
                  style={{ flex: 1 }}
                >
                  <option value="contain">Contain</option>
                  <option value="cover">Cover</option>
                  <option value="stretch">Stretch</option>
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Font</label>
                <select
                  data-testid="topo-map-branding-font-family"
                  value={topoMapBranding.fontFamily ?? "mono"}
                  onChange={(event) =>
                    setTopoMapBranding({
                      fontFamily: event.currentTarget
                        .value as NonNullable<
                        NonNullable<
                          SceneProperties["terrain"]
                        >["topoMapBranding"]
                      >["fontFamily"],
                    })
                  }
                  style={{ flex: 1 }}
                >
                  <option value="mono">Mono</option>
                  <option value="sans">Sans</option>
                  <option value="serif">Serif</option>
                  <option value="condensed">Condensed</option>
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Text align</label>
                <select
                  data-testid="topo-map-branding-text-align"
                  value={topoMapBranding.textAlign ?? "left"}
                  onChange={(event) =>
                    setTopoMapBranding({
                      textAlign: event.currentTarget
                        .value as NonNullable<
                        NonNullable<
                          SceneProperties["terrain"]
                        >["topoMapBranding"]
                      >["textAlign"],
                    })
                  }
                  style={{ flex: 1 }}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Anchor</label>
                <select
                  data-testid="topo-map-branding-anchor"
                  value={
                    topoMapBranding.anchor ?? TOPO_MAP_BRANDING_DEFAULT_ANCHOR
                  }
                  onChange={(event) =>
                    setTopoMapBranding({
                      anchor: event.currentTarget
                        .value as NonNullable<
                        NonNullable<
                          SceneProperties["terrain"]
                        >["topoMapBranding"]
                      >["anchor"],
                    })
                  }
                  style={{ flex: 1 }}
                >
                  <option value="south-west">South west</option>
                  <option value="south-east">South east</option>
                  <option value="north-west">North west</option>
                  <option value="north-east">North east</option>
                </select>
              </div>
              <EnvStyleRow
                label="Offset X"
                inputType="range"
                value={String(
                  topoMapBranding.offsetXM ??
                    TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M,
                )}
                min={-600000}
                max={600000}
                step={5000}
                decimals={0}
                testId="topo-map-branding-offset-x"
                onChange={(v) =>
                  setTopoMapBranding({ offsetXM: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Offset Y"
                inputType="range"
                value={String(
                  topoMapBranding.offsetYM ??
                    TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M,
                )}
                min={-600000}
                max={600000}
                step={5000}
                decimals={0}
                testId="topo-map-branding-offset-y"
                onChange={(v) =>
                  setTopoMapBranding({ offsetYM: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Rotation"
                inputType="range"
                value={String(topoMapBranding.rotationDeg ?? 0)}
                min={-180}
                max={180}
                step={1}
                decimals={0}
                testId="topo-map-branding-rotation"
                onChange={(v) =>
                  setTopoMapBranding({ rotationDeg: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Lift"
                inputType="range"
                value={String(topoMapBranding.liftM ?? 260)}
                min={0}
                max={2000}
                step={25}
                decimals={0}
                testId="topo-map-branding-lift"
                onChange={(v) => setTopoMapBranding({ liftM: parseFloat(v) })}
              />
              <EnvStyleRow
                label="Logo width"
                inputType="range"
                value={String(topoMapBranding.logoWidthM ?? 46000)}
                min={0}
                max={160000}
                step={1000}
                decimals={0}
                testId="topo-map-branding-logo-width"
                onChange={(v) =>
                  setTopoMapBranding({ logoWidthM: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Logo gap"
                inputType="range"
                value={String(topoMapBranding.logoGapM ?? 16000)}
                min={-50000}
                max={80000}
                step={1000}
                decimals={0}
                testId="topo-map-branding-logo-gap"
                onChange={(v) =>
                  setTopoMapBranding({ logoGapM: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Heading size"
                inputType="range"
                value={String(topoMapBranding.headingSizeM ?? 18000)}
                min={2000}
                max={240000}
                step={1000}
                decimals={0}
                testId="topo-map-branding-heading-size"
                onChange={(v) =>
                  setTopoMapBranding({ headingSizeM: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Subhead size"
                inputType="range"
                value={String(topoMapBranding.subheadingSizeM ?? 10500)}
                min={1500}
                max={180000}
                step={500}
                decimals={0}
                testId="topo-map-branding-subheading-size"
                onChange={(v) =>
                  setTopoMapBranding({ subheadingSizeM: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Head weight"
                inputType="range"
                value={String(topoMapBranding.headingWeight ?? 800)}
                min={100}
                max={900}
                step={100}
                decimals={0}
                testId="topo-map-branding-heading-weight"
                onChange={(v) =>
                  setTopoMapBranding({ headingWeight: parseFloat(v) })
                }
              />
              <EzGammaCheckboxRow
                label="Head italic"
                checked={topoMapBranding.headingItalic === true}
                testId="topo-map-branding-heading-italic"
                onChange={(checked) =>
                  setTopoMapBranding({ headingItalic: checked })
                }
              />
              <EnvStyleRow
                label="Sub weight"
                inputType="range"
                value={String(topoMapBranding.subheadingWeight ?? 500)}
                min={100}
                max={900}
                step={100}
                decimals={0}
                testId="topo-map-branding-subheading-weight"
                onChange={(v) =>
                  setTopoMapBranding({ subheadingWeight: parseFloat(v) })
                }
              />
              <EzGammaCheckboxRow
                label="Sub italic"
                checked={topoMapBranding.subheadingItalic === true}
                testId="topo-map-branding-subheading-italic"
                onChange={(checked) =>
                  setTopoMapBranding({ subheadingItalic: checked })
                }
              />
              <EnvStyleRow
                label="Line gap"
                inputType="range"
                value={String(topoMapBranding.lineGapM ?? 2500)}
                min={-30000}
                max={50000}
                step={500}
                decimals={0}
                testId="topo-map-branding-line-gap"
                onChange={(v) =>
                  setTopoMapBranding({ lineGapM: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Text color"
                inputType="color"
                value={topoMapBranding.textColor ?? "#ffffff"}
                testId="topo-map-branding-text-color"
                onChange={(v) => setTopoMapBranding({ textColor: v })}
              />
              <EnvStyleRow
                label="Block opacity"
                inputType="range"
                value={String(topoMapBranding.opacity ?? 0.92)}
                min={0}
                max={1}
                step={0.02}
                decimals={2}
                testId="topo-map-branding-opacity"
                onChange={(v) =>
                  setTopoMapBranding({ opacity: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Logo opacity"
                inputType="range"
                value={String(topoMapBranding.logoOpacity ?? topoMapBranding.opacity ?? 0.92)}
                min={0}
                max={1}
                step={0.02}
                decimals={2}
                testId="topo-map-branding-logo-opacity"
                onChange={(v) =>
                  setTopoMapBranding({ logoOpacity: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Text opacity"
                inputType="range"
                value={String(topoMapBranding.textOpacity ?? topoMapBranding.opacity ?? 0.92)}
                min={0}
                max={1}
                step={0.02}
                decimals={2}
                testId="topo-map-branding-text-opacity"
                onChange={(v) =>
                  setTopoMapBranding({ textOpacity: parseFloat(v) })
                }
              />
              <EzGammaCheckboxRow
                label="Background"
                checked={topoMapBranding.backgroundEnabled === true}
                testId="topo-map-branding-background-enabled"
                onChange={(checked) =>
                  setTopoMapBranding({ backgroundEnabled: checked })
                }
              />
              <EnvStyleRow
                label="Bg color"
                inputType="color"
                value={topoMapBranding.backgroundColor ?? "#050607"}
                testId="topo-map-branding-background-color"
                onChange={(v) => setTopoMapBranding({ backgroundColor: v })}
              />
              <EnvStyleRow
                label="Bg opacity"
                inputType="range"
                value={String(topoMapBranding.backgroundOpacity ?? 0.36)}
                min={0}
                max={1}
                step={0.02}
                decimals={2}
                testId="topo-map-branding-background-opacity"
                onChange={(v) =>
                  setTopoMapBranding({ backgroundOpacity: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Bg pad X"
                inputType="range"
                value={String(topoMapBranding.backgroundPaddingXM ?? 12000)}
                min={0}
                max={180000}
                step={1000}
                decimals={0}
                testId="topo-map-branding-background-padding-x"
                onChange={(v) =>
                  setTopoMapBranding({ backgroundPaddingXM: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Bg pad Y"
                inputType="range"
                value={String(topoMapBranding.backgroundPaddingYM ?? 8000)}
                min={0}
                max={180000}
                step={1000}
                decimals={0}
                testId="topo-map-branding-background-padding-y"
                onChange={(v) =>
                  setTopoMapBranding({ backgroundPaddingYM: parseFloat(v) })
                }
              />
              <EzGammaCheckboxRow
                label="Outline"
                checked={topoMapBranding.outlineEnabled === true}
                testId="topo-map-branding-outline-enabled"
                onChange={(checked) =>
                  setTopoMapBranding({ outlineEnabled: checked })
                }
              />
              <EnvStyleRow
                label="Outline color"
                inputType="color"
                value={topoMapBranding.outlineColor ?? "#ffffff"}
                testId="topo-map-branding-outline-color"
                onChange={(v) => setTopoMapBranding({ outlineColor: v })}
              />
              <EnvStyleRow
                label="Outline opacity"
                inputType="range"
                value={String(topoMapBranding.outlineOpacity ?? 0.8)}
                min={0}
                max={1}
                step={0.02}
                decimals={2}
                testId="topo-map-branding-outline-opacity"
                onChange={(v) =>
                  setTopoMapBranding({ outlineOpacity: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Outline width"
                inputType="range"
                value={String(topoMapBranding.outlineWidthM ?? 2500)}
                min={250}
                max={50000}
                step={250}
                decimals={0}
                testId="topo-map-branding-outline-width"
                onChange={(v) =>
                  setTopoMapBranding({ outlineWidthM: parseFloat(v) })
                }
              />
        </div>
      </details>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Topo fog</summary>
        <div style={detailsContentStyle}>
          {!isEnv ? (
            <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
              Scene fog variables are edited in Global Settings.
            </div>
          ) : (
            <>
              <EzGammaCheckboxRow
                label="Scene fog"
                checked={sceneFogEnabled}
                onChange={(checked) => setSceneFog({ enabled: checked })}
              />
              <EnvStyleRow
                label="Fog color"
                inputType="color"
                value={sceneFog.color ?? scene.background ?? "#383838"}
                onChange={(v) => setSceneFog({ color: v })}
              />
              <EnvStyleRow
                label="Fog dens."
                inputType="range"
                value={String(sceneFogDensity * 10000)}
                min={0.01}
                max={6}
                step={0.01}
                decimals={2}
                onChange={(v) =>
                  setSceneFog({ density: parseFloat(v) / 10000 })
                }
              />
              <EnvStyleRow
                label="Fog reach"
                inputType="range"
                value={String(sceneFogReachKm)}
                min={5}
                max={3000}
                step={5}
                decimals={0}
                onChange={(v) =>
                  setSceneFog({
                    density: 3 / Math.max(parseFloat(v) * 1000, 1),
                  })
                }
              />
            </>
          )}
          <EzGammaCheckboxRow
            label="Topo fog"
            checked={topoFogIncluded}
            onChange={(checked) =>
              setPublicTopoLayerStyle({ affectedByFog: checked })
            }
          />
          <EnvStyleRow
            label="Layer dens."
            inputType="range"
            value={String(topoFogDensity * 10000)}
            min={0.01}
            max={6}
            step={0.01}
            decimals={2}
            onChange={(v) =>
              setPublicTopoLayerStyle({ fogDensity: parseFloat(v) / 10000 })
            }
          />
          <EnvStyleRow
            label="Layer reach"
            inputType="range"
            value={String(topoFogReachKm)}
            min={5}
            max={3000}
            step={5}
            decimals={0}
            onChange={(v) =>
              setPublicTopoLayerStyle({
                fogDensity: 3 / Math.max(parseFloat(v) * 1000, 1),
              })
            }
          />
        </div>
      </details>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Topo surface style</summary>
        <div style={detailsContentStyle}>
          {!isEnv ? (
            <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
              Topo surface variables are edited in Global Settings.
            </div>
          ) : (
            <>
              <EnvSelectRow<PublicTopoMaterialPresetId>
                label="Material"
                value={selectedPreset}
                options={PUBLIC_TOPO_MATERIAL_PRESETS}
                testId="topo-material-preset"
                onChange={setTopoMaterialPreset}
              />
              <EzGammaCheckboxRow
                label="Surface color"
                checked={terrain.surfaceElevationEnabled === true}
                testId="topo-surface-elevation-enabled"
                onChange={(checked) =>
                  setTerrain({
                    materialPreset: checked
                      ? "surface-elevation"
                      : terrain.materialPreset === "surface-elevation"
                        ? "soft-topo"
                        : terrain.materialPreset,
                    surfaceElevationEnabled: checked,
                    surfaceElevationLegendVisible:
                      checked &&
                      terrain.surfaceElevationLegendVisible !== false,
                    surfaceElevationMinM,
                    surfaceElevationMaxM,
                    surfaceElevationColors,
                    surfaceElevationColorPositions: surfaceElevationPositions,
                    surfaceElevationMidpoints,
                    surfaceElevationTransitionSoftness,
                    surfaceElevationColorBlend,
                    surfaceElevationReverse:
                      terrain.surfaceElevationReverse === true,
                  })
                }
              />
              <EzGammaCheckboxRow
                label="Elev. legend"
                checked={terrain.surfaceElevationLegendVisible !== false}
                testId="topo-surface-elevation-legend-visible"
                onChange={(checked) =>
                  setTerrain({ surfaceElevationLegendVisible: checked })
                }
              />
              <EzGammaCheckboxRow
                label="Reverse ramp"
                checked={terrain.surfaceElevationReverse === true}
                testId="topo-surface-elevation-reverse"
                onChange={(checked) =>
                  setTerrain({ surfaceElevationReverse: checked })
                }
              />
              <div style={nestedControlRowStyle}>
                <span style={nestedFieldLabelStyle}>PDF palette</span>
                <button
                  type="button"
                  data-testid="topo-surface-elevation-reset"
                  onClick={() => setTerrain(surfaceElevationDefaultPatch())}
                  style={{
                    flex: 1,
                    border: "1px solid rgba(255, 255, 255, 0.22)",
                    borderRadius: 6,
                    background: "rgba(255, 255, 255, 0.08)",
                    color: vibrancySecondaryLabel,
                    font: "inherit",
                    padding: "4px 8px",
                    cursor: "pointer",
                  }}
                >
                  Reset 1500-3500 m
                </button>
              </div>
              <EnvStyleRow
                label="Elev. min"
                inputType="range"
                value={String(surfaceElevationMinM)}
                min={-500}
                max={4500}
                step={25}
                decimals={0}
                testId="topo-surface-elevation-min"
                onChange={(v) =>
                  setTerrain({ surfaceElevationMinM: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Elev. max"
                inputType="range"
                value={String(surfaceElevationMaxM)}
                min={0}
                max={5000}
                step={25}
                decimals={0}
                testId="topo-surface-elevation-max"
                onChange={(v) =>
                  setTerrain({ surfaceElevationMaxM: parseFloat(v) })
                }
              />
              <div style={nestedControlRowStyle}>
                <span style={nestedFieldLabelStyle}>Gradient</span>
                <div
                  data-testid="topo-surface-gradient-rail"
                  style={{
                    position: "relative",
                    flex: 1,
                    height: 30,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: "10px 0 7px",
                      borderRadius: 999,
                      background: surfaceElevationGradient,
                      border: "1px solid rgba(255, 255, 255, 0.28)",
                      boxShadow: "inset 0 0 0 1px rgba(0, 0, 0, 0.18)",
                    }}
                  />
                  {surfaceElevationMidpoints.map((midpoint, index) => {
                    const left = surfaceElevationPositions[index];
                    const right = surfaceElevationPositions[index + 1];
                    const position = left + (right - left) * midpoint;
                    return (
                      <span
                        key={`surface-elevation-midpoint-${index}`}
                        data-testid={`topo-surface-gradient-midpoint-${index}`}
                        title={`Transition spread ${index + 1}-${index + 2}`}
                        style={{
                          position: "absolute",
                          left: `${position * 100}%`,
                          top: 5,
                          width: 5,
                          height: 22,
                          borderRadius: 3,
                          transform: "translateX(-50%)",
                          background: "rgba(255, 255, 255, 0.78)",
                          border: "1px solid rgba(17, 20, 24, 0.62)",
                          boxShadow: "0 1px 5px rgba(0, 0, 0, 0.28)",
                        }}
                      />
                    );
                  })}
                  {surfaceElevationColors.map((color, index) => (
                    <span
                      key={`surface-elevation-stop-${index}`}
                      data-testid={`topo-surface-gradient-stop-${index}`}
                      title={`Color stop ${index + 1}`}
                      style={{
                        position: "absolute",
                        left: `${surfaceElevationPositions[index] * 100}%`,
                        top: 2,
                        width: 11,
                        height: 11,
                        transform: "translateX(-50%) rotate(45deg)",
                        borderRadius: 2,
                        background: color,
                        border: "1px solid rgba(255, 255, 255, 0.86)",
                        boxShadow: "0 1px 6px rgba(0, 0, 0, 0.36)",
                      }}
                    />
                  ))}
                </div>
              </div>
              {surfaceElevationPositions.map((position, index) => (
                <EnvStyleRow
                  key={`surface-elevation-position-${index}`}
                  label={`Stop ${index + 1} pos`}
                  inputType="range"
                  value={String(position)}
                  min={0}
                  max={1}
                  step={0.01}
                  decimals={2}
                  testId={`topo-surface-elevation-position-${index}`}
                  onChange={(v) =>
                    setSurfaceElevationPosition(index, parseFloat(v))
                  }
                />
              ))}
              {surfaceElevationMidpoints.map((midpoint, index) => (
                <EnvStyleRow
                  key={`surface-elevation-midpoint-${index}`}
                  label={`Spread ${index + 1}-${index + 2}`}
                  inputType="range"
                  value={String(midpoint)}
                  min={0.05}
                  max={0.95}
                  step={0.01}
                  decimals={2}
                  testId={`topo-surface-elevation-midpoint-${index}`}
                  onChange={(v) =>
                    setSurfaceElevationMidpoint(index, parseFloat(v))
                  }
                />
              ))}
              <EnvStyleRow
                label="Ramp softness"
                inputType="range"
                value={String(surfaceElevationTransitionSoftness)}
                min={0}
                max={1}
                step={0.05}
                decimals={2}
                testId="topo-surface-elevation-softness"
                onChange={(v) =>
                  setTerrain({
                    surfaceElevationTransitionSoftness: parseFloat(v),
                  })
                }
              />
              <EnvStyleRow
                label="Color blend"
                inputType="range"
                value={String(surfaceElevationColorBlend)}
                min={0}
                max={1}
                step={0.05}
                decimals={2}
                testId="topo-surface-elevation-color-blend"
                onChange={(v) =>
                  setTerrain({ surfaceElevationColorBlend: parseFloat(v) })
                }
              />
              {surfaceElevationColors.map((color, index) => (
                <EnvStyleRow
                  key={`surface-elevation-color-${index}`}
                  label={`${surfaceElevationTickLabel(
                    surfaceElevationMinM,
                    surfaceElevationMaxM,
                    index,
                  )} m`}
                  inputType="color"
                  value={color}
                  testId={`topo-surface-elevation-color-${index}`}
                  onChange={(v) => setSurfaceElevationColor(index, v)}
                />
              ))}
              <EnvStyleRow
                label="Ramp low"
                inputType="color"
                value={terrain.rampLow ?? "#4f4a40"}
                onChange={(v) => setTerrain({ rampLow: v })}
              />
              <EnvStyleRow
                label="Ramp mid"
                inputType="color"
                value={terrain.rampMid ?? "#8a7e68"}
                onChange={(v) => setTerrain({ rampMid: v })}
              />
              <EnvStyleRow
                label="Ramp high"
                inputType="color"
                value={terrain.rampHigh ?? "#d7c69e"}
                onChange={(v) => setTerrain({ rampHigh: v })}
              />
              <EnvStyleRow
                label="Elev low"
                inputType="range"
                value={String(terrain.elevLowM ?? 0)}
                min={-2000}
                max={4000}
                step={25}
                decimals={0}
                onChange={(v) => setTerrain({ elevLowM: parseFloat(v) })}
              />
              <EnvStyleRow
                label="Elev high"
                inputType="range"
                value={String(terrain.elevHighM ?? 120)}
                min={-2000}
                max={5000}
                step={25}
                decimals={0}
                onChange={(v) => setTerrain({ elevHighM: parseFloat(v) })}
              />
              <EnvStyleRow
                label="Hillshade"
                inputType="range"
                value={String(terrain.hillshadeIntensity ?? 1.05)}
                min={0}
                max={2}
                step={0.05}
                decimals={2}
                onChange={(v) =>
                  setTerrain({ hillshadeIntensity: parseFloat(v) })
                }
              />
              <EnvStyleRow
                label="Shadow edge"
                inputType="range"
                value={String(terrain.shadowSharpness ?? 0.5)}
                min={0}
                max={1}
                step={0.02}
                decimals={2}
                onChange={(v) => setTerrain({ shadowSharpness: parseFloat(v) })}
              />
              <EnvStyleRow
                label="Tessellation"
                inputType="range"
                value={String(terrain.facetStrength ?? 0.08)}
                min={0}
                max={1}
                step={0.02}
                decimals={2}
                onChange={(v) => setTerrain({ facetStrength: parseFloat(v) })}
              />
              <EnvStyleRow
                label="Edge fade"
                inputType="range"
                value={String(terrain.edgeFadeDistanceM ?? 90_000)}
                min={0}
                max={250_000}
                step={5_000}
                decimals={0}
                onChange={(v) =>
                  setTerrain({ edgeFadeDistanceM: parseFloat(v) })
                }
                testId="topo-edge-fade-distance"
              />
              <div style={nestedControlRowStyle}>
                <label style={nestedFieldLabelStyle}>Edge shape</label>
                <select
                  data-testid="topo-edge-fade-shape"
                  value={edgeFadeShape}
                  onChange={(event) =>
                    setTerrain({
                      edgeFadeShape: event.currentTarget.value as NonNullable<
                        SceneProperties["terrain"]
                      >["edgeFadeShape"],
                    })
                  }
                  style={{ flex: 1 }}
                >
                  <option value="square">Square</option>
                  <option value="rounded-square">Rounded square</option>
                  <option value="circle">Circle</option>
                </select>
              </div>
              <EnvStyleRow
                label="Edge distance"
                inputType="range"
                value={String(terrain.edgeFadeInsetM ?? 0)}
                min={0}
                max={250_000}
                step={5_000}
                decimals={0}
                onChange={(v) => setTerrain({ edgeFadeInsetM: parseFloat(v) })}
                testId="topo-edge-fade-inset"
              />
              <EnvStyleRow
                label="Corner radius"
                inputType="range"
                value={String(terrain.edgeFadeCornerRadiusM ?? 0)}
                min={0}
                max={250_000}
                step={5_000}
                decimals={0}
                onChange={(v) =>
                  setTerrain({ edgeFadeCornerRadiusM: parseFloat(v) })
                }
                testId="topo-edge-fade-corner-radius"
              />
              <EnvStyleRow
                label="Hue variance"
                inputType="range"
                value={String(terrain.rockHueVariance ?? 0.05)}
                min={0}
                max={0.2}
                step={0.005}
                decimals={3}
                onChange={(v) => setTerrain({ rockHueVariance: parseFloat(v) })}
              />
              <EnvStyleRow
                label="Shadow tint"
                inputType="color"
                value={terrain.shadowTint ?? "#303640"}
                onChange={(v) => setTerrain({ shadowTint: v })}
              />
            </>
          )}
        </div>
      </details>
    </>
  );
}

function PublicSurfaceClipControls({
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const numberProps = {
    style,
    isEnv,
    currentPage,
    layerId,
    setEnvLayerStyle,
    setPageLayerOverride,
    clearPageLayerOverride,
  };
  return (
    <details style={drillingAssayDetailsStyle}>
      <summary style={drillingAssaySummaryStyle}>Topo map clipping</summary>
      <div style={detailsContentStyle}>
        <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
          Clips terrain, roads, streams, and waterbodies together.
        </div>
        <LayerBooleanStyleControl
          label="Enabled"
          field="publicSurfaceClipEnabled"
          fallback={false}
          {...numberProps}
        />
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Shape</label>
          <select
            data-testid="public-surface-clip-shape"
            value={style.publicSurfaceClipShape === "circle" ? "circle" : "box"}
            onChange={(event) => {
              const value =
                event.currentTarget.value === "circle" ? "circle" : "box";
              if (isEnv) {
                setEnvLayerStyle(layerId, { publicSurfaceClipShape: value });
              } else if (currentPage) {
                setPageLayerOverride(currentPage.id, layerId, {
                  publicSurfaceClipShape: value,
                });
              }
            }}
            style={{ flex: 1 }}
          >
            <option value="circle">Circle inside box</option>
            <option value="box">Box</option>
          </select>
        </div>
        <LayerNumberStyleControl
          label="X center"
          field="publicSurfaceClipCenterX"
          fallback={0}
          min={-300000}
          max={300000}
          step={250}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Y center"
          field="publicSurfaceClipCenterY"
          fallback={0}
          min={-300000}
          max={300000}
          step={250}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Z center"
          field="publicSurfaceClipCenterZ"
          fallback={2000}
          min={-20000}
          max={30000}
          step={100}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="X size"
          field="publicSurfaceClipSizeX"
          fallback={279150}
          min={100}
          max={500000}
          step={500}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Y size"
          field="publicSurfaceClipSizeY"
          fallback={227900}
          min={100}
          max={500000}
          step={500}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Z size"
          field="publicSurfaceClipSizeZ"
          fallback={8000}
          min={100}
          max={50000}
          step={100}
          decimals={0}
          {...numberProps}
        />
        <LayerNumberStyleControl
          label="Z rotate"
          field="publicSurfaceClipRotationZDeg"
          fallback={0}
          min={-180}
          max={180}
          step={1}
          decimals={0}
          {...numberProps}
        />
      </div>
    </details>
  );
}

function PointMarkerControls({
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  return (
    <>
      <LayerNumberStyleControl
        label="Marker radius"
        field="pointMarkerRadiusM"
        fallback={900}
        min={100}
        max={6000}
        step={50}
        decimals={0}
        style={style}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
        clearPageLayerOverride={clearPageLayerOverride}
      />
      <LayerNumberStyleControl
        label="Marker lift"
        field="pointMarkerLiftM"
        fallback={0}
        min={-3000}
        max={6000}
        step={50}
        decimals={0}
        style={style}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
        clearPageLayerOverride={clearPageLayerOverride}
      />
      <LayerNumberStyleControl
        label="Label lift"
        field="pointMarkerLabelLiftM"
        fallback={1200}
        min={0}
        max={10000}
        step={100}
        decimals={0}
        style={style}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
        clearPageLayerOverride={clearPageLayerOverride}
      />
    </>
  );
}

interface MtStationQcVariant {
  variant: string;
  frequencyHzMin: number | null;
  frequencyHzMax: number | null;
  spectraBlockCount: number;
  directResponseSections?: string[];
  responseCurvesAvailable?: boolean;
}

interface MtStationQcStation {
  stationId: string;
  displayName?: string;
  selectedVariant?: string;
  variants?: MtStationQcVariant[];
  qc?: {
    variantCount?: number;
    spectraBlockCount?: number;
    spectraRowCount?: number;
    frequencyHzMin?: number | null;
    frequencyHzMax?: number | null;
    responseCurvesAvailable?: boolean;
    responseCurveStatus?: string;
  };
}

interface MtStationQcPayload {
  stationCount: number;
  ediFileCount: number;
  spectraStations: number;
  responseCurveStations: number;
  frequencyHzRange: [number, number] | null;
  stations: MtStationQcStation[];
}

function MtStationQcControls({
  layer,
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
}: {
  layer: ProjectLayerSpec;
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const [qc, setQc] = useState<MtStationQcPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const stationQcPath = (layer as { supportFiles?: Record<string, string> })
    .supportFiles?.stationQc;

  useEffect(() => {
    let cancelled = false;
    if (!stationQcPath) {
      setQc(null);
      setLoadError("Station QC artifact is not registered.");
      return;
    }
    fetch(appAssetUrl(stationQcPath))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<MtStationQcPayload>;
      })
      .then((payload) => {
        if (cancelled) return;
        setQc(payload);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setQc(null);
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [stationQcPath]);

  const selectedStationId =
    typeof style.mtStationQcSelectedStationId === "string"
      ? style.mtStationQcSelectedStationId
      : (qc?.stations?.[0]?.stationId ?? "");
  const selected = qc?.stations?.find(
    (station) => station.stationId === selectedStationId,
  );
  const commit = (patch: Partial<EditableStyle>) => {
    if (isEnv) {
      setEnvLayerStyle(layerId, patch);
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, patch);
    }
  };

  return (
    <details style={nestedDetailsStyle}>
      <summary style={panelStyles.summary}>2D MT station response / QC</summary>
      <div style={detailsContentStyle}>
        <div style={nestedControlRowStyle}>
          <label style={nestedFieldLabelStyle}>Station</label>
          <select
            data-testid="mt-station-qc-select"
            value={selectedStationId}
            onChange={(e) =>
              commit({ mtStationQcSelectedStationId: e.target.value })
            }
            style={{ flex: 1 }}
          >
            {(qc?.stations ?? []).map((station) => (
              <option key={station.stationId} value={station.stationId}>
                {station.stationId}
              </option>
            ))}
          </select>
        </div>
        <div style={miniInfoGridStyle}>
          <span>Stations</span>
          <strong>{qc?.stationCount ?? "--"}</strong>
          <span>EDI files</span>
          <strong>{qc?.ediFileCount ?? "--"}</strong>
          <span>Freq. range</span>
          <strong>
            {qc?.frequencyHzRange
              ? `${qc.frequencyHzRange[0].toExponential(2)}-${qc.frequencyHzRange[1].toFixed(2)} Hz`
              : "--"}
          </strong>
          <span>Curves</span>
          <strong>{qc?.responseCurveStations ?? 0}</strong>
        </div>
        {selected ? (
          <div style={miniInfoGridStyle}>
            <span>Selected</span>
            <strong>{selected.stationId}</strong>
            <span>Variants</span>
            <strong>
              {selected.qc?.variantCount ?? selected.variants?.length ?? "--"}
            </strong>
            <span>Spectra</span>
            <strong>{selected.qc?.spectraBlockCount ?? "--"}</strong>
            <span>Coverage</span>
            <strong>
              {selected.qc?.frequencyHzMin && selected.qc?.frequencyHzMax
                ? `${selected.qc.frequencyHzMin.toExponential(2)}-${selected.qc.frequencyHzMax.toFixed(2)} Hz`
                : "--"}
            </strong>
          </div>
        ) : null}
        <div style={{ ...panelStyles.muted, lineHeight: 1.35 }}>
          {selected?.qc?.responseCurveStatus ??
            loadError ??
            "Spectra metadata is parsed; apparent resistivity/phase curves are shown only when directly present in source EDI."}
        </div>
      </div>
    </details>
  );
}

function ResistivitySliceControls({
  style,
  isEnv,
  currentPage,
  layerId,
  setEnvLayerStyle,
  setPageLayerOverride,
  clearPageLayerOverride,
}: {
  style: EditableStyle;
  isEnv: boolean;
  currentPage: PresentationPage | null;
  layerId: string;
  setEnvLayerStyle: LayerStyleSetter;
  setPageLayerOverride: PageStyleSetter;
  clearPageLayerOverride: PageStyleClearer;
}) {
  const visibility =
    typeof style.resistivitySliceVisibility === "object" &&
    style.resistivitySliceVisibility !== null
      ? (style.resistivitySliceVisibility as Record<string, boolean>)
      : {};
  const setSliceVisible = (id: string, checked: boolean) => {
    const next = { ...visibility, [id]: checked };
    if (isEnv) {
      setEnvLayerStyle(layerId, { resistivitySliceVisibility: next });
    } else if (currentPage) {
      setPageLayerOverride(currentPage.id, layerId, {
        resistivitySliceVisibility: next,
      });
    }
  };

  return (
    <>
      <details style={nestedDetailsStyle}>
        <summary style={panelStyles.summary}>2D slice products</summary>
        <div style={detailsContentStyle}>
          <LayerBooleanStyleControl
            label="Horiz. slices"
            field="resistivityHorizontalSlicesVisible"
            fallback={true}
            style={style}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            clearPageLayerOverride={clearPageLayerOverride}
          />
          <LayerBooleanStyleControl
            label="Vertical sections"
            field="resistivityVerticalSectionsVisible"
            fallback={true}
            style={style}
            isEnv={isEnv}
            currentPage={currentPage}
            layerId={layerId}
            setEnvLayerStyle={setEnvLayerStyle}
            setPageLayerOverride={setPageLayerOverride}
            clearPageLayerOverride={clearPageLayerOverride}
          />
          <details style={nestedDetailsStyle}>
            <summary style={panelStyles.summary}>Slice visibility</summary>
            <div style={detailsContentStyle}>
              {UTAH_FORGE_RESISTIVITY_SLICE_OPTIONS.map((option) => (
                <EzGammaCheckboxRow
                  key={option.id}
                  label={option.label}
                  checked={visibility[option.id] !== false}
                  onChange={(checked) => setSliceVisible(option.id, checked)}
                />
              ))}
              {!isEnv && currentPage ? (
                <button
                  type="button"
                  style={panelStyles.secondaryButton}
                  onClick={() =>
                    clearPageLayerOverride(
                      currentPage.id,
                      layerId,
                      "resistivitySliceVisibility",
                    )
                  }
                >
                  Clear page slice override
                </button>
              ) : null}
            </div>
          </details>
        </div>
      </details>
      <IsobandControls
        title="2D isobands"
        style={style}
        disabled={false}
        isEnv={isEnv}
        currentPage={currentPage}
        layerId={layerId}
        rangeKind="mt"
        setEnvLayerStyle={setEnvLayerStyle}
        setPageLayerOverride={setPageLayerOverride}
      />
    </>
  );
}

function SurfaceGradientColorInput({
  label,
  value,
  disabled,
  opacity,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  opacity: number;
  onChange: (value: string) => void;
}) {
  return (
    <label
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        alignItems: "center",
        gap: 4,
        minWidth: 0,
        color: vibrancyTertiaryLabel,
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      <span>{label}</span>
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          minWidth: 24,
          opacity,
        }}
      />
    </label>
  );
}

function EnvTextRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1 }}
      />
    </div>
  );
}

function EnvSelectRow<T extends string>({
  label,
  value,
  options,
  testId,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  testId?: string;
  onChange: (v: T) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <select
        value={value}
        data-testid={testId}
        onChange={(e) => onChange(e.target.value as T)}
        style={{ flex: 1 }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function styleNumber(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: number,
): number {
  const value = style[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function styleString(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: string,
): string {
  const value = style[key];
  return typeof value === "string" ? value : fallback;
}

function styleBoolean(
  style: EditableStyle,
  key: keyof EditableStyle,
  fallback: boolean,
): boolean {
  const value = style[key];
  return typeof value === "boolean" ? value : fallback;
}

function EzGammaCheckboxRow({
  label,
  checked,
  testId,
  onChange,
}: {
  label: string;
  checked: boolean;
  testId?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={{ ...nestedControlRowStyle, cursor: "pointer" }}>
      <span style={nestedFieldLabelStyle}>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        data-testid={testId}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

function EzGammaSelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{ flex: 1, minWidth: 0 }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EzGammaTubeControls({
  title,
  style,
  fields,
  defaults,
  onChange,
}: {
  title: string;
  style: EditableStyle;
  fields: {
    visible: keyof EditableStyle;
    color: keyof EditableStyle;
    opacity: keyof EditableStyle;
    radius: keyof EditableStyle;
    mode: keyof EditableStyle;
  };
  defaults: {
    color: string;
    opacity: number;
    radius: number;
    mode: "solid" | "dashed";
  };
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const mode =
    styleString(style, fields.mode, defaults.mode) === "dashed"
      ? "dashed"
      : "solid";
  return (
    <details style={drillingAssayDetailsStyle}>
      <summary style={drillingAssaySummaryStyle}>{title}</summary>
      <div style={detailsContentStyle}>
        <EzGammaCheckboxRow
          label="Visible"
          checked={styleBoolean(style, fields.visible, true)}
          onChange={(checked) => onChange({ [fields.visible]: checked })}
        />
        <EnvStyleRow
          label="Color"
          inputType="color"
          value={styleString(style, fields.color, defaults.color)}
          onChange={(value) => onChange({ [fields.color]: value })}
        />
        <EnvStyleRow
          label="Opacity"
          inputType="range"
          value={String(styleNumber(style, fields.opacity, defaults.opacity))}
          min={0}
          max={1}
          step={0.02}
          decimals={2}
          onChange={(value) =>
            onChange({ [fields.opacity]: parseFloat(value) })
          }
        />
        <EnvStyleRow
          label="Radius"
          inputType="range"
          value={String(styleNumber(style, fields.radius, defaults.radius))}
          min={0.5}
          max={36}
          step={0.5}
          decimals={1}
          onChange={(value) => onChange({ [fields.radius]: parseFloat(value) })}
        />
        <EzGammaSelectRow
          label="Body"
          value={mode}
          options={[
            { value: "solid", label: "Solid cylinder" },
            { value: "dashed", label: "Dashed cylinder" },
          ]}
          onChange={(value) => onChange({ [fields.mode]: value })}
        />
      </div>
    </details>
  );
}

type GeochemElementValue = (typeof GEOCHEM_ELEMENT_OPTIONS)[number]["value"];

function GeochemStyleControls({
  style,
  onChange,
}: {
  style: EditableStyle;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  const rawElement = styleString(style, "geochemElement", "cu_ppm");
  const element = GEOCHEM_ELEMENT_OPTIONS.some(
    (option) => option.value === rawElement,
  )
    ? (rawElement as GeochemElementValue)
    : "cu_ppm";
  return (
    <div style={ezGammaControlsStyle}>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Graduated symbols</summary>
        <div style={detailsContentStyle}>
          <EzGammaSelectRow
            label="Element"
            value={element}
            options={[...GEOCHEM_ELEMENT_OPTIONS]}
            onChange={(value) => onChange({ geochemElement: value })}
          />
          <EnvStyleRow
            label="Min radius"
            inputType="range"
            value={String(styleNumber(style, "geochemSymbolMinRadiusM", 45))}
            min={5}
            max={300}
            step={5}
            decimals={0}
            onChange={(value) =>
              onChange({ geochemSymbolMinRadiusM: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Max radius"
            inputType="range"
            value={String(styleNumber(style, "geochemSymbolMaxRadiusM", 160))}
            min={20}
            max={600}
            step={5}
            decimals={0}
            onChange={(value) =>
              onChange({ geochemSymbolMaxRadiusM: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Lift"
            inputType="range"
            value={String(styleNumber(style, "geochemLiftM", 24))}
            min={0}
            max={220}
            step={2}
            decimals={0}
            onChange={(value) => onChange({ geochemLiftM: parseFloat(value) })}
          />
          <EnvStyleRow
            label="Thick"
            inputType="range"
            value={String(styleNumber(style, "geochemSymbolThicknessM", 5))}
            min={0.5}
            max={45}
            step={0.5}
            decimals={1}
            onChange={(value) =>
              onChange({ geochemSymbolThicknessM: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Opacity"
            inputType="range"
            value={String(
              styleNumber(
                style,
                "geochemOpacity",
                styleNumber(style, "opacity", 0.92),
              ),
            )}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ geochemOpacity: parseFloat(value) })
            }
          />
          <EzGammaCheckboxRow
            label="Log scale"
            checked={styleBoolean(style, "geochemUseLogScale", true)}
            onChange={(checked) => onChange({ geochemUseLogScale: checked })}
          />
        </div>
      </details>

      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Anomaly palette</summary>
        <div style={detailsContentStyle}>
          <EnvStyleRow
            label="Low"
            inputType="color"
            value={styleString(style, "geochemPaletteLow", "#2b6cb0")}
            onChange={(value) => onChange({ geochemPaletteLow: value })}
          />
          <EnvStyleRow
            label="Mid"
            inputType="color"
            value={styleString(style, "geochemPaletteMid", "#f2cf43")}
            onChange={(value) => onChange({ geochemPaletteMid: value })}
          />
          <EnvStyleRow
            label="High"
            inputType="color"
            value={styleString(style, "geochemPaletteHigh", "#c92a2a")}
            onChange={(value) => onChange({ geochemPaletteHigh: value })}
          />
          <EzGammaCheckboxRow
            label="Outline"
            checked={styleBoolean(style, "geochemShowOutline", true)}
            onChange={(checked) => onChange({ geochemShowOutline: checked })}
          />
          <EnvStyleRow
            label="Outline color"
            inputType="color"
            value={styleString(style, "geochemOutlineColor", "#221f1c")}
            onChange={(value) => onChange({ geochemOutlineColor: value })}
          />
          <EnvStyleRow
            label="Outline opac."
            inputType="range"
            value={String(styleNumber(style, "geochemOutlineOpacity", 0.65))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ geochemOutlineOpacity: parseFloat(value) })
            }
          />
        </div>
      </details>
    </div>
  );
}

function HyperspectralStyleControls({
  style,
  onChange,
}: {
  style: EditableStyle;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  return (
    <div style={ezGammaControlsStyle}>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Coverage sleeves</summary>
        <div style={detailsContentStyle}>
          <EnvStyleRow
            label="Radius"
            inputType="range"
            value={String(styleNumber(style, "hyperspectralRadiusM", 18))}
            min={2}
            max={90}
            step={1}
            decimals={0}
            onChange={(value) =>
              onChange({ hyperspectralRadiusM: parseFloat(value) })
            }
          />
          <EzGammaCheckboxRow
            label="Endpoints"
            checked={styleBoolean(style, "hyperspectralEndpointVisible", true)}
            onChange={(checked) =>
              onChange({ hyperspectralEndpointVisible: checked })
            }
          />
          <EnvStyleRow
            label="End radius"
            inputType="range"
            value={String(
              styleNumber(style, "hyperspectralEndpointRadiusM", 30),
            )}
            min={2}
            max={140}
            step={1}
            decimals={0}
            onChange={(value) =>
              onChange({ hyperspectralEndpointRadiusM: parseFloat(value) })
            }
          />
        </div>
      </details>
    </div>
  );
}

function ImageryLidarStyleControls({
  style,
  onChange,
}: {
  style: EditableStyle;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  return (
    <div style={ezGammaControlsStyle}>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Footprint markers</summary>
        <div style={detailsContentStyle}>
          <EzGammaCheckboxRow
            label="Corners"
            checked={styleBoolean(style, "imageryCornerVisible", true)}
            onChange={(checked) => onChange({ imageryCornerVisible: checked })}
          />
          <EnvStyleRow
            label="Corner radius"
            inputType="range"
            value={String(styleNumber(style, "imageryCornerRadiusM", 95))}
            min={0}
            max={240}
            step={5}
            decimals={0}
            onChange={(value) =>
              onChange({ imageryCornerRadiusM: parseFloat(value) })
            }
          />
        </div>
      </details>
    </div>
  );
}

function AreaOutlinesControls({
  outlines,
  viewCenter,
  onChange,
}: {
  outlines: AreaOutlineDef[];
  viewCenter: [number, number];
  onChange: (outlines: AreaOutlineDef[]) => void;
}) {
  const updateOutline = (id: string, patch: Partial<AreaOutlineDef>) => {
    onChange(
      outlines.map((outline) =>
        outline.id === id ? { ...outline, ...patch } : outline,
      ),
    );
  };
  const addOutline = () => {
    const index = outlines.length + 1;
    const id = `area-outline-${Date.now().toString(36)}`;
    onChange([
      ...outlines,
      {
        id,
        label: `Area outline ${index}`,
        center: viewCenter,
        radiusX: 850,
        radiusY: 520,
        rotationDeg: 0,
        liftMeters: 18,
        fillVisible: true,
        fillColor: "#ff8a3d",
        fillOpacity: 0.18,
        outlineVisible: true,
        outlineColor: "#ff8a3d",
        outlineOpacity: 0.95,
        outlineWidthM: 14,
        dashed: true,
        outlineMode: "terrain3d",
        dashLengthM: 170,
        dashGapM: 90,
        labelKind: "area",
      },
    ]);
  };
  const duplicateOutline = (source: AreaOutlineDef, index: number) => {
    const center = source.center ?? viewCenter;
    onChange([
      ...outlines.slice(0, index + 1),
      {
        ...source,
        id: `area-outline-${Date.now().toString(36)}`,
        label: `${source.label || `Area outline ${index + 1}`} copy`,
        center: [center[0] + 80, center[1] + 80],
      },
      ...outlines.slice(index + 1),
    ]);
  };
  const removeOutline = (id: string) => {
    onChange(outlines.filter((outline) => outline.id !== id));
  };

  return (
    <div style={ezGammaControlsStyle}>
      <div style={areaOutlineButtonStackStyle}>
        <button
          type="button"
          className="editor-action-button"
          style={panelStyles.button}
          onClick={addOutline}
        >
          Add outline
        </button>
      </div>
      {outlines.length === 0 ? (
        <p style={panelStyles.helpText}>
          Add an outline to rough in a boundary as a ground-parallel ellipse.
        </p>
      ) : null}
      {outlines.map((outline, index) => (
        <details key={outline.id} style={drillingAssayDetailsStyle}>
          <summary style={drillingAssaySummaryStyle}>
            {outline.label || `Area outline ${index + 1}`}
          </summary>
          <div style={detailsContentStyle}>
            <EnvTextRow
              label="Name"
              value={outline.label}
              onChange={(value) => updateOutline(outline.id, { label: value })}
            />
            <EnvStyleRow
              label="Center E"
              inputType="number"
              value={String(Math.round(outline.center?.[0] ?? viewCenter[0]))}
              step={10}
              onChange={(value) => {
                const next = [...(outline.center ?? viewCenter)] as [
                  number,
                  number,
                ];
                next[0] = parseFloat(value);
                updateOutline(outline.id, { center: next });
              }}
            />
            <EnvStyleRow
              label="Center N"
              inputType="number"
              value={String(Math.round(outline.center?.[1] ?? viewCenter[1]))}
              step={10}
              onChange={(value) => {
                const next = [...(outline.center ?? viewCenter)] as [
                  number,
                  number,
                ];
                next[1] = parseFloat(value);
                updateOutline(outline.id, { center: next });
              }}
            />
            <div style={areaOutlineButtonStackStyle}>
              <button
                type="button"
                className="editor-action-button"
                style={panelStyles.button}
                onClick={() =>
                  updateOutline(outline.id, { center: viewCenter })
                }
              >
                Move center
              </button>
            </div>
            <EnvStyleRow
              label="Width X"
              inputType="range"
              value={String(outline.radiusX ?? 850)}
              min={50}
              max={5000}
              step={25}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { radiusX: parseFloat(value) })
              }
            />
            <EnvStyleRow
              label="Width Y"
              inputType="range"
              value={String(outline.radiusY ?? 520)}
              min={50}
              max={5000}
              step={25}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { radiusY: parseFloat(value) })
              }
            />
            <EnvStyleRow
              label="Rotation"
              inputType="range"
              value={String(outline.rotationDeg ?? 0)}
              min={-180}
              max={180}
              step={1}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { rotationDeg: parseFloat(value) })
              }
            />
            <EnvStyleRow
              label="Lift"
              inputType="range"
              value={String(outline.liftMeters ?? 18)}
              min={0}
              max={120}
              step={1}
              decimals={0}
              onChange={(value) =>
                updateOutline(outline.id, { liftMeters: parseFloat(value) })
              }
            />
            <EnvSelectRow
              label="Line mode"
              value={outline.outlineMode ?? "terrain3d"}
              options={AREA_OUTLINE_MODE_OPTIONS}
              onChange={(value) =>
                updateOutline(outline.id, { outlineMode: value })
              }
            />

            <details style={drillingAssayDetailsStyle}>
              <summary style={drillingAssaySummaryStyle}>Infill</summary>
              <div style={detailsContentStyle}>
                <EzGammaCheckboxRow
                  label="Visible"
                  checked={outline.fillVisible !== false}
                  onChange={(checked) =>
                    updateOutline(outline.id, { fillVisible: checked })
                  }
                />
                <EnvStyleRow
                  label="Color"
                  inputType="color"
                  value={outline.fillColor ?? "#ff8a3d"}
                  onChange={(value) =>
                    updateOutline(outline.id, { fillColor: value })
                  }
                />
                <EnvStyleRow
                  label="Alpha"
                  inputType="range"
                  value={String(outline.fillOpacity ?? 0.18)}
                  min={0}
                  max={1}
                  step={0.02}
                  decimals={2}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      fillOpacity: parseFloat(value),
                    })
                  }
                />
              </div>
            </details>

            <details style={drillingAssayDetailsStyle}>
              <summary style={drillingAssaySummaryStyle}>Outline</summary>
              <div style={detailsContentStyle}>
                <EzGammaCheckboxRow
                  label="Visible"
                  checked={outline.outlineVisible !== false}
                  onChange={(checked) =>
                    updateOutline(outline.id, { outlineVisible: checked })
                  }
                />
                <EnvStyleRow
                  label="Color"
                  inputType="color"
                  value={outline.outlineColor ?? "#ff8a3d"}
                  onChange={(value) =>
                    updateOutline(outline.id, { outlineColor: value })
                  }
                />
                <EnvStyleRow
                  label="Alpha"
                  inputType="range"
                  value={String(outline.outlineOpacity ?? 0.95)}
                  min={0}
                  max={1}
                  step={0.02}
                  decimals={2}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      outlineOpacity: parseFloat(value),
                    })
                  }
                />
                <EnvStyleRow
                  label="Width"
                  inputType="range"
                  value={String(outline.outlineWidthM ?? 14)}
                  min={1}
                  max={80}
                  step={1}
                  decimals={0}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      outlineWidthM: parseFloat(value),
                    })
                  }
                />
                <EzGammaCheckboxRow
                  label="Dashed"
                  checked={outline.dashed !== false}
                  onChange={(checked) =>
                    updateOutline(outline.id, { dashed: checked })
                  }
                />
                <EnvStyleRow
                  label="Dash len."
                  inputType="range"
                  value={String(outline.dashLengthM ?? 170)}
                  min={10}
                  max={900}
                  step={10}
                  decimals={0}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      dashLengthM: parseFloat(value),
                    })
                  }
                />
                <EnvStyleRow
                  label="Dash gap"
                  inputType="range"
                  value={String(outline.dashGapM ?? 90)}
                  min={0}
                  max={600}
                  step={10}
                  decimals={0}
                  onChange={(value) =>
                    updateOutline(outline.id, {
                      dashGapM: parseFloat(value),
                    })
                  }
                />
              </div>
            </details>

            <EnvSelectRow
              label="Label style"
              value={outline.labelKind ?? "area"}
              options={LABEL_KIND_OPTIONS}
              onChange={(value) =>
                updateOutline(outline.id, {
                  labelKind: value as AreaOutlineDef["labelKind"],
                })
              }
            />
            <div style={areaOutlineButtonStackStyle}>
              <button
                type="button"
                className="editor-action-button"
                style={panelStyles.button}
                onClick={() => duplicateOutline(outline, index)}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="editor-action-button"
                style={panelStyles.button}
                onClick={() => removeOutline(outline.id)}
              >
                Remove
              </button>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function EzGammaStyleControls({
  style,
  onChange,
}: {
  style: EditableStyle;
  onChange: (patch: Partial<EditableStyle>) => void;
}) {
  return (
    <div style={ezGammaControlsStyle}>
      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Collar sphere</summary>
        <div style={detailsContentStyle}>
          <EzGammaCheckboxRow
            label="Visible"
            checked={styleBoolean(style, "gammaCollarVisible", true)}
            onChange={(checked) => onChange({ gammaCollarVisible: checked })}
          />
          <EnvStyleRow
            label="Color"
            inputType="color"
            value={styleString(style, "gammaCollarColor", "#9ee4ac")}
            onChange={(value) => onChange({ gammaCollarColor: value })}
          />
          <EnvStyleRow
            label="Opacity"
            inputType="range"
            value={String(styleNumber(style, "gammaCollarOpacity", 0.94))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaCollarOpacity: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Radius"
            inputType="range"
            value={String(styleNumber(style, "gammaCollarRadiusM", 14))}
            min={2}
            max={60}
            step={1}
            decimals={0}
            onChange={(value) =>
              onChange({ gammaCollarRadiusM: parseFloat(value) })
            }
          />
        </div>
      </details>

      <EzGammaTubeControls
        title="Survey cylinder"
        style={style}
        fields={{
          visible: "gammaSurveyTubeVisible",
          color: "gammaSurveyTubeColor",
          opacity: "gammaSurveyTubeOpacity",
          radius: "gammaSurveyTubeRadiusM",
          mode: "gammaSurveyTubeMode",
        }}
        defaults={{
          color: "#e7ddc7",
          opacity: 0.34,
          radius: 3.6,
          mode: "solid",
        }}
        onChange={onChange}
      />

      <EzGammaTubeControls
        title="Logged overburden"
        style={style}
        fields={{
          visible: "gammaLoggedOverburdenVisible",
          color: "gammaLoggedOverburdenColor",
          opacity: "gammaLoggedOverburdenOpacity",
          radius: "gammaLoggedOverburdenRadiusM",
          mode: "gammaLoggedOverburdenMode",
        }}
        defaults={{
          color: "#d2a35f",
          opacity: 0.42,
          radius: 7.9,
          mode: "solid",
        }}
        onChange={onChange}
      />

      <EzGammaTubeControls
        title="Bedrock cylinder"
        style={style}
        fields={{
          visible: "gammaBedrockIntervalVisible",
          color: "gammaBedrockIntervalColor",
          opacity: "gammaBedrockIntervalOpacity",
          radius: "gammaBedrockIntervalRadiusM",
          mode: "gammaBedrockIntervalMode",
        }}
        defaults={{
          color: "#75c878",
          opacity: 0.46,
          radius: 6.1,
          mode: "solid",
        }}
        onChange={onChange}
      />

      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Contact rings</summary>
        <div style={detailsContentStyle}>
          <EzGammaSelectRow
            label="Shape"
            value={
              styleString(style, "gammaContactShape", "torus") === "coin"
                ? "coin"
                : "torus"
            }
            options={[
              { value: "torus", label: "Torus ring" },
              { value: "coin", label: "Coin disc" },
            ]}
            onChange={(value) => onChange({ gammaContactShape: value })}
          />
          <EzGammaCheckboxRow
            label="Contact 1"
            checked={styleBoolean(style, "gammaContact1Visible", true)}
            onChange={(checked) => onChange({ gammaContact1Visible: checked })}
          />
          <EnvStyleRow
            label="C1 color"
            inputType="color"
            value={styleString(style, "gammaContact1Color", "#fff2bc")}
            onChange={(value) => onChange({ gammaContact1Color: value })}
          />
          <EnvStyleRow
            label="C1 opacity"
            inputType="range"
            value={String(styleNumber(style, "gammaContact1Opacity", 0.86))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaContact1Opacity: parseFloat(value) })
            }
          />
          <EzGammaCheckboxRow
            label="Contact 2"
            checked={styleBoolean(style, "gammaContact2Visible", true)}
            onChange={(checked) => onChange({ gammaContact2Visible: checked })}
          />
          <EnvStyleRow
            label="C2 color"
            inputType="color"
            value={styleString(style, "gammaContact2Color", "#e6d4a2")}
            onChange={(value) => onChange({ gammaContact2Color: value })}
          />
          <EnvStyleRow
            label="C2 opacity"
            inputType="range"
            value={String(styleNumber(style, "gammaContact2Opacity", 0.55))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaContact2Opacity: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Radius"
            inputType="range"
            value={String(styleNumber(style, "gammaContactRadiusM", 42))}
            min={6}
            max={120}
            step={1}
            decimals={0}
            onChange={(value) =>
              onChange({ gammaContactRadiusM: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Thick"
            inputType="range"
            value={String(styleNumber(style, "gammaContactThicknessM", 3.2))}
            min={0.4}
            max={18}
            step={0.2}
            decimals={1}
            onChange={(value) =>
              onChange({ gammaContactThicknessM: parseFloat(value) })
            }
          />
        </div>
      </details>

      <details style={drillingAssayDetailsStyle}>
        <summary style={drillingAssaySummaryStyle}>Gamma traces</summary>
        <div style={detailsContentStyle}>
          <EzGammaCheckboxRow
            label="Traces"
            checked={styleBoolean(style, "gammaTracesVisible", true)}
            onChange={(checked) => onChange({ gammaTracesVisible: checked })}
          />
          <EzGammaCheckboxRow
            label="Mirror side"
            checked={styleBoolean(style, "gammaMirrorTraceVisible", true)}
            onChange={(checked) =>
              onChange({ gammaMirrorTraceVisible: checked })
            }
          />
          <EzGammaCheckboxRow
            label="Red run"
            checked={styleBoolean(style, "gammaRedTraceVisible", true)}
            onChange={(checked) => onChange({ gammaRedTraceVisible: checked })}
          />
          <EnvStyleRow
            label="Red color"
            inputType="color"
            value={styleString(style, "gammaRedTraceColor", "#f04a45")}
            onChange={(value) => onChange({ gammaRedTraceColor: value })}
          />
          <EzGammaCheckboxRow
            label="Blue run"
            checked={styleBoolean(style, "gammaBlueTraceVisible", true)}
            onChange={(checked) => onChange({ gammaBlueTraceVisible: checked })}
          />
          <EnvStyleRow
            label="Blue color"
            inputType="color"
            value={styleString(style, "gammaBlueTraceColor", "#3576ff")}
            onChange={(value) => onChange({ gammaBlueTraceColor: value })}
          />
          <EnvStyleRow
            label="Trace opac."
            inputType="range"
            value={String(styleNumber(style, "gammaTraceOpacity", 0.92))}
            min={0}
            max={1}
            step={0.02}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaTraceOpacity: parseFloat(value) })
            }
          />
          <EnvStyleRow
            label="Trace width"
            inputType="range"
            value={String(
              styleNumber(
                style,
                "gammaTraceWidthPx",
                styleNumber(style, "lineWidth", 2.4),
              ),
            )}
            min={0.25}
            max={14}
            step={0.25}
            decimals={2}
            onChange={(value) =>
              onChange({ gammaTraceWidthPx: parseFloat(value) })
            }
          />
          <EzGammaCheckboxRow
            label="Back panel"
            checked={styleBoolean(style, "gammaPanelVisible", false)}
            onChange={(checked) => onChange({ gammaPanelVisible: checked })}
          />
          <EnvStyleRow
            label="Panel color"
            inputType="color"
            value={styleString(style, "gammaPanelColor", "#1d211a")}
            onChange={(value) => onChange({ gammaPanelColor: value })}
          />
        </div>
      </details>
    </div>
  );
}

// ----- page-mode rows -------------------------------------------------------

const overrideTagStyle: React.CSSProperties = {
  fontSize: 10,
  color: vibrancyTertiaryLabel,
  marginLeft: 4,
};
const overrideTagActiveStyle: React.CSSProperties = {
  ...overrideTagStyle,
  color: vibrancySecondaryLabel,
};

const pageRenderPresetHelpStyle: React.CSSProperties = {
  ...panelStyles.muted,
  margin: "0 0 8px 0",
  lineHeight: 1.35,
};

function PageVisibilityRow({
  page,
  layerId,
  envVisible,
  onSet,
  onClear,
}: {
  page: PresentationPage;
  layerId: string;
  envVisible: boolean;
  onSet: (v: boolean) => void;
  onClear: () => void;
}) {
  const overridden = isVisibilityOverridden(page, layerId);
  const overrideVal = page.visibilityOverrides?.[layerId];
  const effective = overridden ? !!overrideVal : envVisible;

  return (
    <div style={panelStyles.row}>
      <label style={panelStyles.fieldLabel}>Visible</label>
      <input
        type="checkbox"
        checked={overridden}
        onChange={(e) => {
          if (e.target.checked) {
            // Start an override mirroring the inherited value -- least
            // surprising default; user can flip immediately.
            onSet(envVisible);
          } else {
            onClear();
          }
        }}
        title="Override environment default for this page"
      />
      <input
        type="checkbox"
        checked={effective}
        disabled={!overridden}
        onChange={(e) => onSet(e.target.checked)}
      />
      <span style={overridden ? overrideTagActiveStyle : overrideTagStyle}>
        {overridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

function PageStyleRow({
  label,
  inputType,
  inheritedValue,
  isOverridden,
  overrideValue,
  fallbackValue,
  min = 0,
  max = 1,
  step = 0.05,
  decimals = 2,
  onOverride,
  onClear,
}: {
  label: string;
  inputType: "color" | "range";
  inheritedValue: string | undefined;
  isOverridden: boolean;
  overrideValue: string | undefined;
  fallbackValue?: string;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  onOverride: (v: string) => void;
  onClear: () => void;
}) {
  const fallback = fallbackValue ?? (inputType === "range" ? "1" : "#cccccc");
  const value = isOverridden
    ? (overrideValue ?? inheritedValue ?? fallback)
    : (inheritedValue ?? fallback);
  const rangeValue = parseFloat(value);
  const safeValue = Number.isFinite(rangeValue) ? rangeValue : min;
  const fill = Math.max(
    0,
    Math.min(100, ((safeValue - min) / (max - min)) * 100),
  );

  return (
    <div style={nestedControlRowStyle}>
      <label style={nestedFieldLabelStyle}>{label}</label>
      <input
        type="checkbox"
        checked={isOverridden}
        onChange={(e) => {
          if (e.target.checked) {
            // Materialize the inherited value as the starting override.
            onOverride(value);
          } else {
            onClear();
          }
        }}
        title="Override environment value for this page"
      />
      {inputType === "range" ? (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={!isOverridden}
            onChange={(e) => onOverride(e.target.value)}
            style={
              {
                flex: 1,
                opacity: isOverridden ? 1 : 0.4,
                "--editor-slider-fill": `${fill}%`,
              } as React.CSSProperties
            }
          />
          <span style={sliderNumberReadoutStyle}>
            {safeValue.toFixed(decimals)}
          </span>
        </>
      ) : (
        <input
          type="color"
          value={value}
          disabled={!isOverridden}
          onChange={(e) => onOverride(e.target.value)}
          style={{ opacity: isOverridden ? 1 : 0.4 }}
        />
      )}
      <span style={isOverridden ? overrideTagActiveStyle : overrideTagStyle}>
        {isOverridden ? "overridden" : "inherited"}
      </span>
    </div>
  );
}

// Avoid an unused-import lint warning for EditableStyle (kept for future
// fields that take partial-style patches).
export type _Unused = EditableStyle;

// ----- bedrock geology sub-layer panel -------------------------------------
//
// Discovers the loaded distinct units from SceneManager.getGeology() and
// renders one row per unit: visibility checkbox + colour picker. Edits
// dispatch through setEnvLayerStyle by patching the layer's
// `geologyColorMap` and `geologyUnitOverrides` sparse maps. Missing
// keys default to "visible, BCGS canonical colour".

interface GeologyColorMap {
  [code: string]: string;
}
interface GeologyUnitOverrides {
  [code: string]: { visible?: boolean; opacity?: number };
}

function GeologySubUnitsPanel({ layerStyle }: { layerStyle: EditableStyle }) {
  const { sceneHandle, setEnvLayerStyle } = useEditor();
  const [units, setUnits] = useState<
    Array<{ code: string; displayName: string; defaultColor: string }>
  >([]);

  // Geology loads asynchronously; poll until the handle's there.
  useEffect(() => {
    let cancelled = false;
    const tryRead = () => {
      if (cancelled) return;
      const g = sceneHandle.manager.getGeology();
      if (g) {
        setUnits(g.units);
        return;
      }
      window.setTimeout(tryRead, 250);
    };
    tryRead();
    return () => {
      cancelled = true;
    };
  }, [sceneHandle]);

  const colorMap = (layerStyle.geologyColorMap as GeologyColorMap) ?? {};
  const overrides =
    (layerStyle.geologyUnitOverrides as GeologyUnitOverrides) ?? {};

  if (units.length === 0) {
    return (
      <details style={{ marginTop: 8 }}>
        <summary style={{ ...panelStyles.muted, cursor: "pointer" }}>
          Sub-units (loading…)
        </summary>
      </details>
    );
  }

  const setUnitColor = (code: string, hex: string) => {
    const next: GeologyColorMap = { ...colorMap, [code]: hex };
    setEnvLayerStyle("bedrock-geology", { geologyColorMap: next });
  };
  const clearUnitColor = (code: string) => {
    const next: GeologyColorMap = { ...colorMap };
    delete next[code];
    setEnvLayerStyle("bedrock-geology", { geologyColorMap: next });
  };
  const setUnitVisible = (code: string, visible: boolean) => {
    const cur = overrides[code] ?? {};
    const next: GeologyUnitOverrides = {
      ...overrides,
      [code]: { ...cur, visible },
    };
    setEnvLayerStyle("bedrock-geology", { geologyUnitOverrides: next });
  };

  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{ ...panelStyles.muted, cursor: "pointer" }}>
        Sub-units ({units.length})
      </summary>
      <div style={{ marginTop: 6 }}>
        {units.map((u) => {
          const visible = overrides[u.code]?.visible !== false;
          const color = colorMap[u.code] ?? u.defaultColor;
          const overridden = colorMap[u.code] !== undefined;
          return (
            <div
              key={u.code}
              style={{
                ...panelStyles.row,
                gap: 6,
                marginBottom: 3,
              }}
              title={u.displayName}
            >
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setUnitVisible(u.code, e.target.checked)}
              />
              <input
                type="color"
                value={color}
                onChange={(e) => setUnitColor(u.code, e.target.value)}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 11,
                  color: visible
                    ? vibrancySecondaryLabel
                    : vibrancyTertiaryLabel,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {u.displayName}
              </span>
              {overridden && (
                <button
                  style={{
                    ...panelStyles.iconButton,
                    width: "auto",
                    padding: "0 6px",
                    fontSize: 10,
                  }}
                  onClick={() => clearUnitColor(u.code)}
                  title="Revert to BCGS canonical colour"
                >
                  ↺
                </button>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}

// ----- add scene overlay form ----------------------------------------------
//
// Inline expandable form, env-mode only. Drives the full add flow:
//   1. User picks a local image file via <input type="file">.
//   2. We read it as base64 and POST to /api/write-file at
//      projects/<root>/overlays-source/<filename>.
//   3. On success, build a SceneOverlayDef with reasonable defaults
//      (best-guess bounds centred on project origin; user refines via
//      drag or env.json edit), then call addEnvSceneOverlay so the
//      manager hot-loads + the reducer dirties env.

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunk, bytes.length)),
    );
  }
  return btoa(binary);
}

function slugifyId(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "overlay"
  );
}

function AddSceneOverlayForm() {
  const { state, addEnvSceneOverlay } = useEditor();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [classification, setClassification] =
    useState<SceneOverlayDef["provenance"]["classification"]>("interpretation");
  const [source, setSource] = useState("");
  const [bounds, setBounds] = useState({
    minE: "608500",
    minN: "5788170",
    maxE: "613500",
    maxN: "5790830",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setLabel("");
    setSource("");
    setClassification("interpretation");
    setBounds({
      minE: "608500",
      minN: "5788170",
      maxE: "613500",
      maxN: "5790830",
    });
    setError(null);
    setBusy(false);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!label.trim()) {
      setError("Set a label before uploading.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = slugifyId(label);
      if (state.environment.sceneOverlays?.[id]) {
        throw new Error(`an overlay with id "${id}" already exists`);
      }
      const buf = await file.arrayBuffer();
      const b64 = arrayBufferToBase64(buf);
      const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${state.projectRoot}/overlays-source/${fileName}`;
      await writeFile(path, b64, { encoding: "base64" });

      const minE = parseFloat(bounds.minE);
      const minN = parseFloat(bounds.minN);
      const maxE = parseFloat(bounds.maxE);
      const maxN = parseFloat(bounds.maxN);
      if (
        !Number.isFinite(minE) ||
        !Number.isFinite(minN) ||
        !Number.isFinite(maxE) ||
        !Number.isFinite(maxN)
      ) {
        throw new Error("bounds must be four numbers");
      }

      const def: SceneOverlayDef = {
        path,
        bounds: [minE, minN, maxE, maxN],
        liftMeters: 8,
        defaultOpacity: 0.85,
        label: label.trim(),
        provenance: {
          source: source.trim() || label.trim(),
          classification,
          notes: "Added via editor; refine bounds by dragging in 3D viewport.",
        },
      };
      await addEnvSceneOverlay(id, def);
      reset();
      setOpen(false);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
      // Reset the file input so the same file can be re-picked after a fix.
      if (e.target) e.target.value = "";
    }
  };

  if (!open) {
    return (
      <button
        style={{
          ...panelStyles.iconButton,
          width: "auto",
          padding: "6px 12px",
          fontSize: 12,
          marginTop: 8,
        }}
        onClick={() => setOpen(true)}
      >
        + Add scene overlay
      </button>
    );
  }

  return (
    <div style={{ ...panelStyles.section, marginTop: 8 }}>
      <div style={panelStyles.sectionHeader}>
        <span style={panelStyles.layerLabel}>New scene overlay</span>
        <button
          style={panelStyles.iconButton}
          onClick={() => {
            reset();
            setOpen(false);
          }}
          title="Cancel"
        >
          ×
        </button>
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={panelStyles.textInput}
          placeholder="e.g. Vizsla cross-section B-B'"
        />
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Source</label>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={panelStyles.textInput}
          placeholder="e.g. Vizsla Copper investor figure 4"
        />
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Classification</label>
        <select
          value={classification}
          onChange={(e) =>
            setClassification(
              e.target.value as SceneOverlayDef["provenance"]["classification"],
            )
          }
        >
          <option value="observation">observation</option>
          <option value="interpretation">interpretation</option>
          <option value="narrative">narrative</option>
          <option value="planned">planned</option>
        </select>
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Bounds (E,N)</label>
        <input
          type="number"
          value={bounds.minE}
          onChange={(e) => setBounds({ ...bounds, minE: e.target.value })}
          style={{ ...panelStyles.textInput, width: 76 }}
          title="min easting"
        />
        <input
          type="number"
          value={bounds.minN}
          onChange={(e) => setBounds({ ...bounds, minN: e.target.value })}
          style={{ ...panelStyles.textInput, width: 84 }}
          title="min northing"
        />
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>...</label>
        <input
          type="number"
          value={bounds.maxE}
          onChange={(e) => setBounds({ ...bounds, maxE: e.target.value })}
          style={{ ...panelStyles.textInput, width: 76 }}
          title="max easting"
        />
        <input
          type="number"
          value={bounds.maxN}
          onChange={(e) => setBounds({ ...bounds, maxN: e.target.value })}
          style={{ ...panelStyles.textInput, width: 84 }}
          title="max northing"
        />
      </div>
      <div style={panelStyles.row}>
        <label style={panelStyles.fieldLabel}>Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={onFile}
          disabled={busy}
          style={{ color: vibrancySecondaryLabel, fontSize: 12 }}
        />
      </div>
      {busy && (
        <div style={panelStyles.muted}>Uploading + loading texture…</div>
      )}
      {error && (
        <div
          style={{
            ...panelStyles.muted,
            color: vibrancyLabel,
            fontStyle: "normal",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
