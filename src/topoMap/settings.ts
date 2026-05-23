import { effectiveStyle } from "../pages/effective";
import type {
  EditableStyle,
  EnvironmentSetup,
  PresentationPage,
  ProjectLayerSpec,
  ProjectManifest,
  SceneProperties,
} from "../pages/types";

export const TOPO_MAP_TOOL_ID = "topo-map";
export const TOPO_MAP_SURFACE_LABEL = "Topo Surface";
export const TOPO_MAP_DEFAULT_SURFACE_LAYER_ID = "terrain";
export const TOPO_MAP_DEFAULT_REFERENCE_LAYER_IDS = [
  "transport-roads",
  "hydrography-streams",
  "hydrography-lakes",
] as const;

export type TopoMapToolRole = "surface" | "graticule" | "reference";
export type PublicTopoMaterialPresetId =
  | "custom"
  | "soft-topo"
  | "surface-elevation"
  | "ortho-photo"
  | "desert-relief"
  | "paper-map"
  | "grey-relief"
  | "high-contrast";
export type OrthoPhotoTextureBudgetId = "4096" | "8192";

export interface TopoMapToolMetadata {
  id?: string;
  toolId?: string;
  role?: TopoMapToolRole;
  surfaceLayerId?: string;
  settingsScope?: "scene" | "layer" | "mixed";
}

export interface ResolvedTopoMapSettings {
  surfaceLayer: ProjectLayerSpec | null;
  surfaceLayerId: string;
  graticuleLayers: ProjectLayerSpec[];
  referenceLayers: ProjectLayerSpec[];
  surfaceStyle: EditableStyle;
  terrain: NonNullable<SceneProperties["terrain"]>;
  materialPreset: PublicTopoMaterialPresetId;
}

export const SURFACE_ELEVATION_DEFAULT_MIN_M = 1500;
export const SURFACE_ELEVATION_DEFAULT_MAX_M = 3500;
export const SURFACE_ELEVATION_DEFAULT_COLORS = [
  "#5147b8",
  "#2e8fd8",
  "#4fc3c7",
  "#93d66b",
  "#fff24d",
] as const;
export const SURFACE_ELEVATION_DEFAULT_POSITIONS = [
  0,
  0.25,
  0.5,
  0.75,
  1,
] as const;
export const SURFACE_ELEVATION_DEFAULT_MIDPOINTS = [
  0.5,
  0.5,
  0.5,
  0.5,
] as const;
export const SURFACE_ELEVATION_DEFAULT_SOFTNESS = 1;
export const SURFACE_ELEVATION_DEFAULT_BLEND = 1;
export const SURFACE_ELEVATION_STOP_GAP = 0.01;

export const SURFACE_ELEVATION_PRESET_PALETTES = {
  softTopo: ["#4d5a4e", "#758067", "#a99a76", "#d0bd8f", "#f1e2ad"],
  surfaceElevation: ["#5147b8", "#2e8fd8", "#4fc3c7", "#93d66b", "#fff24d"],
  desertRelief: ["#5b4130", "#8b6240", "#bf8f54", "#dec37a", "#f4e6aa"],
  paperMap: ["#716b5b", "#928c74", "#b7ad8a", "#d8cfa7", "#efe6c6"],
  greyRelief: ["#3f4243", "#666b6c", "#909494", "#b8b8b2", "#dedbd2"],
  highContrast: ["#251b2f", "#5d2e54", "#9d5544", "#d89a42", "#fff0a3"],
} as const;

export const ORTHO_PHOTO_TEXTURE_BUDGETS: readonly {
  value: OrthoPhotoTextureBudgetId;
  label: string;
}[] = [
  { value: "4096", label: "4096 px" },
  { value: "8192", label: "8192 px" },
];

export const TOPO_MAP_BRANDING_DEFAULT_ANCHOR = "south-east";
export const TOPO_MAP_BRANDING_DEFAULT_OFFSET_X_M = 0;
export const TOPO_MAP_BRANDING_DEFAULT_OFFSET_Y_M = -85_000;

export const TOPO_MAP_GRATICULE_EDGE_STYLE_FIELDS = [
  "graticuleEdgeFadeAware",
  "graticuleEdgeFadeStrength",
  "graticuleEdgeLineColor",
  "graticuleEdgeLineWidth",
  "graticuleEdgeLabelColor",
  "graticuleEdgeLabelVisible",
  "graticuleEdgeLabelOffsetM",
  "graticuleEdgeLabelGapM",
] as const satisfies readonly (keyof EditableStyle)[];

export function topoMapToolMetadata(
  layer: ProjectLayerSpec | undefined,
): TopoMapToolMetadata | null {
  const raw = layer?.metadata?.geoSeeTool;
  if (!raw || typeof raw !== "object") return null;
  const tool = raw as Record<string, unknown>;
  const id =
    typeof tool.id === "string"
      ? tool.id
      : typeof tool.toolId === "string"
        ? tool.toolId
        : undefined;
  if (id !== TOPO_MAP_TOOL_ID) return null;
  const role =
    tool.role === "surface" ||
    tool.role === "graticule" ||
    tool.role === "reference"
      ? tool.role
      : undefined;
  const settingsScope =
    tool.settingsScope === "scene" ||
    tool.settingsScope === "layer" ||
    tool.settingsScope === "mixed"
      ? tool.settingsScope
      : undefined;
  return {
    id,
    toolId: id,
    role,
    surfaceLayerId:
      typeof tool.surfaceLayerId === "string" ? tool.surfaceLayerId : undefined,
    settingsScope,
  };
}

export function isTopoMapSurfaceLayer(layer: ProjectLayerSpec): boolean {
  const tool = topoMapToolMetadata(layer);
  if (tool?.role === "surface") return true;
  return layer.id === TOPO_MAP_DEFAULT_SURFACE_LAYER_ID && layer.type === "geotiff";
}

export function isTopoMapGraticuleLayer(layer: ProjectLayerSpec): boolean {
  const tool = topoMapToolMetadata(layer);
  if (tool?.role === "graticule") return true;
  return Boolean(layer.metadata?.topoGraticule);
}

export function isTopoMapReferenceLayer(layer: ProjectLayerSpec): boolean {
  if (topoMapToolMetadata(layer)?.role === "reference") return true;
  return (TOPO_MAP_DEFAULT_REFERENCE_LAYER_IDS as readonly string[]).includes(
    layer.id,
  );
}

export function isTopoMapLayer(layer: ProjectLayerSpec): boolean {
  return (
    isTopoMapSurfaceLayer(layer) ||
    isTopoMapGraticuleLayer(layer) ||
    isTopoMapReferenceLayer(layer)
  );
}

export function topoMapSurfaceLayerIdFor(
  layer: ProjectLayerSpec | undefined,
): string {
  return (
    topoMapToolMetadata(layer)?.surfaceLayerId ?? TOPO_MAP_DEFAULT_SURFACE_LAYER_ID
  );
}

export function findTopoMapSurfaceLayer(
  layers: readonly ProjectLayerSpec[],
): ProjectLayerSpec | undefined {
  return layers.find(isTopoMapSurfaceLayer);
}

export function topoMapLayerIds(
  layers: readonly ProjectLayerSpec[],
): string[] {
  const ids = new Set<string>();
  const surface = findTopoMapSurfaceLayer(layers);
  if (surface) ids.add(surface.id);
  for (const layer of layers) {
    if (isTopoMapGraticuleLayer(layer) || isTopoMapReferenceLayer(layer)) {
      ids.add(layer.id);
    }
  }
  return [...ids];
}

export function topoMapLayerLabel(layer: ProjectLayerSpec): string | null {
  if (isTopoMapSurfaceLayer(layer)) return TOPO_MAP_SURFACE_LABEL;
  return null;
}

export function surfaceElevationPresetGradientPatch(
  colors: readonly string[],
): NonNullable<SceneProperties["terrain"]> {
  return {
    surfaceElevationEnabled: true,
    surfaceElevationLegendVisible: true,
    surfaceElevationMinM: SURFACE_ELEVATION_DEFAULT_MIN_M,
    surfaceElevationMaxM: SURFACE_ELEVATION_DEFAULT_MAX_M,
    surfaceElevationColors: [...colors],
    surfaceElevationColorPositions: [...SURFACE_ELEVATION_DEFAULT_POSITIONS],
    surfaceElevationMidpoints: [...SURFACE_ELEVATION_DEFAULT_MIDPOINTS],
    surfaceElevationTransitionSoftness: SURFACE_ELEVATION_DEFAULT_SOFTNESS,
    surfaceElevationColorBlend: SURFACE_ELEVATION_DEFAULT_BLEND,
    surfaceElevationReverse: false,
  };
}

export function surfaceElevationDefaultPatch(): NonNullable<
  SceneProperties["terrain"]
> {
  return {
    materialPreset: "surface-elevation",
    ...surfaceElevationPresetGradientPatch(
      SURFACE_ELEVATION_PRESET_PALETTES.surfaceElevation,
    ),
    edgeFadeShape: "square",
    edgeFadeInsetM: 0,
    edgeFadeCornerRadiusM: 0,
  };
}

function proceduralPresetPatch(
  materialPreset: Exclude<
    PublicTopoMaterialPresetId,
    "custom" | "ortho-photo"
  >,
  colors: readonly string[],
  patch: NonNullable<SceneProperties["terrain"]>,
): NonNullable<SceneProperties["terrain"]> {
  return {
    materialPreset,
    ...patch,
    ...surfaceElevationPresetGradientPatch(colors),
    orthoPhotoOpacity: 0,
  };
}

export function orthoPhotoPathForBudget(
  terrain: NonNullable<SceneProperties["terrain"]>,
  budget: OrthoPhotoTextureBudgetId,
): string | undefined {
  if (budget === "8192") {
    return terrain.orthoPhotoTexture8192Path ?? terrain.orthoPhotoPath;
  }
  return terrain.orthoPhotoTexture4096Path ?? terrain.orthoPhotoPath;
}

export function orthoPhotoDefaultPatch(
  terrain: NonNullable<SceneProperties["terrain"]> = {},
  budget: OrthoPhotoTextureBudgetId = "4096",
): NonNullable<SceneProperties["terrain"]> {
  const nextBudget = budget === "8192" ? 8192 : 4096;
  const orthoPhotoPath = orthoPhotoPathForBudget(terrain, budget);
  return {
    materialPreset: "ortho-photo",
    orthoPhotoTextureBudget: nextBudget,
    ...(orthoPhotoPath ? { orthoPhotoPath } : {}),
    ...(terrain.orthoPhotoTexture4096Path
      ? { orthoPhotoTexture4096Path: terrain.orthoPhotoTexture4096Path }
      : {}),
    ...(terrain.orthoPhotoTexture8192Path
      ? { orthoPhotoTexture8192Path: terrain.orthoPhotoTexture8192Path }
      : {}),
    ...(terrain.orthoPhotoBounds
      ? { orthoPhotoBounds: terrain.orthoPhotoBounds }
      : {}),
    orthoPhotoOpacity: 1,
    orthoPhotoHillshadeBlend: 0.45,
    orthoPhotoBrightness: 0,
    orthoPhotoContrast: 1,
    orthoPhotoSaturation: 1,
    surfaceElevationEnabled: false,
  };
}

export function topoMapPresetPatch(
  preset: PublicTopoMaterialPresetId,
  terrain: NonNullable<SceneProperties["terrain"]> = {},
): NonNullable<SceneProperties["terrain"]> | null {
  switch (preset) {
    case "custom":
      return null;
    case "soft-topo":
      return proceduralPresetPatch(
        "soft-topo",
        SURFACE_ELEVATION_PRESET_PALETTES.softTopo,
        {
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
        },
      );
    case "surface-elevation":
      return proceduralPresetPatch(
        "surface-elevation",
        SURFACE_ELEVATION_PRESET_PALETTES.surfaceElevation,
        {
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
        },
      );
    case "ortho-photo":
      return {
        ...orthoPhotoDefaultPatch(
          terrain,
          terrain.orthoPhotoTextureBudget === 8192 ? "8192" : "4096",
        ),
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
      };
    case "desert-relief":
      return proceduralPresetPatch(
        "desert-relief",
        SURFACE_ELEVATION_PRESET_PALETTES.desertRelief,
        {
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
        },
      );
    case "paper-map":
      return proceduralPresetPatch(
        "paper-map",
        SURFACE_ELEVATION_PRESET_PALETTES.paperMap,
        {
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
        },
      );
    case "grey-relief":
      return proceduralPresetPatch(
        "grey-relief",
        SURFACE_ELEVATION_PRESET_PALETTES.greyRelief,
        {
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
        },
      );
    case "high-contrast":
      return proceduralPresetPatch(
        "high-contrast",
        SURFACE_ELEVATION_PRESET_PALETTES.highContrast,
        {
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
        },
      );
  }
}

export const PUBLIC_TOPO_MATERIAL_PRESETS: readonly {
  value: PublicTopoMaterialPresetId;
  label: string;
}[] = [
  { value: "custom", label: "Custom" },
  { value: "soft-topo", label: "Soft topo" },
  { value: "surface-elevation", label: "Surface elevation" },
  { value: "ortho-photo", label: "Ortho photo" },
  { value: "desert-relief", label: "Desert relief" },
  { value: "paper-map", label: "Paper map" },
  { value: "grey-relief", label: "Grey relief" },
  { value: "high-contrast", label: "High contrast" },
];

export function publicTopoMaterialPresetId(
  value: unknown,
): PublicTopoMaterialPresetId {
  return PUBLIC_TOPO_MATERIAL_PRESETS.some((preset) => preset.value === value)
    ? (value as PublicTopoMaterialPresetId)
    : "custom";
}

export function surfaceElevationColorsFromTerrain(
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

export function surfaceElevationPositionsFromTerrain(
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

export function surfaceElevationMidpointsFromTerrain(
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

export function surfaceElevationTickLabel(
  minM: number,
  maxM: number,
  index: number,
): string {
  return Math.round(minM + ((maxM - minM) * index) / 4).toLocaleString();
}

export function surfaceElevationGradientCss(
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

export function resolveTopoMapSettings({
  manifest,
  environment,
  page,
  surfaceLayer,
}: {
  manifest: ProjectManifest;
  environment: EnvironmentSetup;
  page?: PresentationPage | null;
  surfaceLayer?: ProjectLayerSpec;
}): ResolvedTopoMapSettings {
  const layers = manifest.layers;
  const resolvedSurfaceLayer = surfaceLayer ?? findTopoMapSurfaceLayer(layers);
  const surfaceLayerId =
    resolvedSurfaceLayer?.id ?? TOPO_MAP_DEFAULT_SURFACE_LAYER_ID;
  const legacyTerrain = environment.scene?.terrain ?? {};
  const materialPreset = publicTopoMaterialPresetId(legacyTerrain.materialPreset);
  const presetPatch =
    materialPreset === "custom"
      ? null
      : topoMapPresetPatch(materialPreset, legacyTerrain);
  return {
    surfaceLayer: resolvedSurfaceLayer ?? null,
    surfaceLayerId,
    graticuleLayers: layers.filter(isTopoMapGraticuleLayer),
    referenceLayers: layers.filter(isTopoMapReferenceLayer),
    surfaceStyle: page
      ? effectiveStyle(environment, page, surfaceLayerId)
      : (environment.layerStyles[surfaceLayerId] ?? {}),
    terrain: {
      ...(presetPatch ?? {}),
      ...legacyTerrain,
    },
    materialPreset,
  };
}
