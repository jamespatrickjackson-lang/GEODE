import type {
  EditableStyle,
  EnvironmentSetup,
  GuiLabelSettings,
  PresentationPage,
  RenderPreset,
  RenderPresetId,
  SceneProperties,
  UserRenderPreset,
} from "./types";

export const RENDER_PRESET_IDS = [
  "cinematic-dark",
  "survey-daylight",
  "boardroom",
  "data-room",
  "night-ops",
] as const satisfies readonly RenderPresetId[];

export const DEFAULT_CINEMATIC_RENDER_PRESETS = [
  {
    id: "cinematic-dark",
    label: "Cinematic Dark",
    background: "#14171b",
    terrainMode: "relief",
    contourMode: "presentation",
    publicDataMode: "standard",
    labelDensity: "low",
    fog: { enabled: true, color: "#14171b", density: 0.000025 },
    lighting: {
      ambientIntensity: 0.62,
      sunIntensity: 1.18,
      rimIntensity: 0.42,
      lockSunToCamera: false,
    },
    effects: { dataGlow: 0.3, lineHalo: 0.22, atmosphere: 0.7 },
  },
  {
    id: "survey-daylight",
    label: "Survey Daylight",
    background: "#d7dde0",
    terrainMode: "relief",
    contourMode: "subtle",
    publicDataMode: "high-contrast",
    labelDensity: "medium",
    fog: { enabled: true, color: "#d7dde0", density: 0.000012 },
    lighting: {
      ambientIntensity: 0.78,
      sunIntensity: 1.22,
      rimIntensity: 0.14,
      lockSunToCamera: false,
    },
    effects: { dataGlow: 0.12, lineHalo: 0.08, atmosphere: 0.28 },
  },
  {
    id: "boardroom",
    label: "Boardroom",
    background: "#26292d",
    terrainMode: "matte",
    contourMode: "subtle",
    publicDataMode: "standard",
    labelDensity: "low",
    fog: { enabled: true, color: "#26292d", density: 0.000018 },
    lighting: {
      ambientIntensity: 0.7,
      sunIntensity: 1.05,
      rimIntensity: 0.24,
      lockSunToCamera: true,
    },
    effects: { dataGlow: 0.18, lineHalo: 0.14, atmosphere: 0.48 },
  },
  {
    id: "data-room",
    label: "Data Room",
    background: "#1f2428",
    terrainMode: "relief",
    contourMode: "technical",
    publicDataMode: "high-contrast",
    labelDensity: "medium",
    fog: { enabled: true, color: "#1f2428", density: 0.000016 },
    lighting: {
      ambientIntensity: 0.66,
      sunIntensity: 1,
      rimIntensity: 0.2,
      lockSunToCamera: false,
    },
    effects: { dataGlow: 0.2, lineHalo: 0.18, atmosphere: 0.4 },
  },
  {
    id: "night-ops",
    label: "Night Ops",
    background: "#0d1117",
    terrainMode: "ghost",
    contourMode: "glow",
    publicDataMode: "subtle",
    labelDensity: "low",
    fog: { enabled: true, color: "#0d1117", density: 0.00003 },
    lighting: {
      ambientIntensity: 0.48,
      sunIntensity: 0.82,
      rimIntensity: 0.5,
      lockSunToCamera: true,
    },
    effects: { dataGlow: 0.35, lineHalo: 0.28, atmosphere: 0.82 },
  },
] as const satisfies readonly RenderPreset[];

const CINEMATIC_SCENE_PATCH_KEYS = [
  "background",
  "fog",
  "sun",
  "lighting",
  "terrain",
  "topoDetails",
  "lightMode",
  "toneMapping",
  "exposure",
  "bloom",
  "ambientOcclusion",
  "vignette",
  "colorGrade",
  "gui",
] as const satisfies readonly (keyof SceneProperties)[];

const CINEMATIC_LAYER_STYLE_PATCH_KEYS = [
  "color",
  "outlineColor",
  "fillOpacity",
  "opacity",
  "lineWidth",
  "contourDistanceFadeNearM",
  "contourDistanceFadeFarM",
  "contourFarLineScale",
  "contourFarOpacity",
  "contourLiftM",
  "affectedByFog",
  "fogDensity",
  "terrainShadowInfluence",
  "showLabels",
  "labelColor",
  "labelTextColor",
  "labelOutlineColor",
  "labelFillColor",
  "labelTextOpacity",
  "labelOutlineOpacity",
  "labelFillOpacity",
] as const satisfies readonly (keyof EditableStyle)[];

export function findRenderPreset(
  id: RenderPresetId | string | null | undefined,
  projectPresets?: readonly RenderPreset[],
): RenderPreset | null {
  if (!id) return null;
  return (
    projectPresets?.find((preset) => preset.id === id) ??
    DEFAULT_CINEMATIC_RENDER_PRESETS.find((preset) => preset.id === id) ??
    null
  );
}

export function projectRenderPresets(
  environment: EnvironmentSetup,
): readonly RenderPreset[] {
  return [
    ...(environment.scene?.renderPresets ?? []),
    ...(environment.customRenderPresets ?? []),
  ];
}

export function renderPresetOptionsForEnvironment(
  environment: EnvironmentSetup,
): Array<{ value: string; label: string; source?: RenderPreset["source"] }> {
  return [
    ...DEFAULT_CINEMATIC_RENDER_PRESETS.map((preset) => ({
      value: preset.id,
      label: preset.label,
      source: "built-in" as const,
    })),
    ...(environment.customRenderPresets ?? []).map((preset) => ({
      value: preset.id,
      label: preset.label,
      source: preset.source,
    })),
  ];
}

export function isUserRenderPreset(
  preset: RenderPreset | null | undefined,
): preset is UserRenderPreset {
  return preset?.source === "user";
}

export function isUserRenderPresetId(
  environment: EnvironmentSetup,
  id: string | null | undefined,
): boolean {
  return (
    !!id &&
    (environment.customRenderPresets ?? []).some((preset) => preset.id === id)
  );
}

export function createUserRenderPresetFromEnvironment(
  environment: EnvironmentSetup,
  createdAt = new Date().toISOString(),
): UserRenderPreset {
  const index = nextUserPresetIndex(environment.customRenderPresets ?? []);
  const id = `user-${index}` as const;
  return buildUserRenderPreset({
    id,
    label: `User ${index}`,
    createdAt,
    scenePatch: captureCinematicScenePatch(environment.scene),
    layerStylePatchesByLayerId: captureCinematicLayerStylePatches(environment),
  });
}

export function updateUserRenderPresetFromEnvironment(
  environment: EnvironmentSetup,
  id: string,
  updatedAt = new Date().toISOString(),
): UserRenderPreset | null {
  const current = (environment.customRenderPresets ?? []).find(
    (preset) => preset.id === id && preset.source === "user",
  );
  if (!current) return null;
  return buildUserRenderPreset({
    ...current,
    updatedAt,
    scenePatch: captureCinematicScenePatch(environment.scene),
    layerStylePatchesByLayerId: captureCinematicLayerStylePatches(environment),
  });
}

export function scenePatchForRenderPreset(
  id: RenderPresetId | string | null | undefined,
  projectPresets?: readonly RenderPreset[],
): Partial<SceneProperties> | null {
  const preset = findRenderPreset(id, projectPresets);
  if (!preset) return null;
  if (isUserRenderPreset(preset)) return preset.scenePatch;
  // Runtime application is intentionally narrower than the full preset model:
  // this patch handles only the scene-level world-building fields. Public
  // context and label density are applied through their existing style paths;
  // technical MT/scalar/seismic renderers stay outside the preset layer.
  return {
    background: preset.background,
    fog: {
      enabled: preset.fog.enabled,
      color: preset.fog.color,
      density: fogDensityForPreset(preset),
    },
    sun: { lockToCamera: preset.lighting.lockSunToCamera },
    lighting: {
      hemisphere: { intensity: preset.lighting.ambientIntensity },
      directional: { intensity: preset.lighting.sunIntensity },
      rim: { intensity: preset.lighting.rimIntensity },
    },
    terrain: terrainPatchForMode(preset.terrainMode),
  };
}

export function activeRenderPresetIdForPage(
  environment: EnvironmentSetup,
  page?: PresentationPage | null,
): RenderPresetId | string | null {
  return (
    page?.renderPreset ??
    page?.renderPresetId ??
    environment.renderPreset ??
    environment.scene?.activeRenderPresetId ??
    null
  );
}

export function publicContextStylePatchForLayer(
  layerId: string,
  id: RenderPresetId | string | null | undefined,
  projectPresets?: readonly RenderPreset[],
): Partial<EditableStyle> | null {
  const preset = findRenderPreset(id, projectPresets);
  const family = publicContextFamilyForLayer(layerId);
  if (!preset || !family) return null;
  if (isUserRenderPreset(preset)) {
    return preset.layerStylePatchesByLayerId?.[layerId] ?? null;
  }
  return patchForPublicContextMode(preset.publicDataMode, family);
}

export function contourStylePatchForLayer(
  layerId: string,
  id: RenderPresetId | string | null | undefined,
  projectPresets?: readonly RenderPreset[],
): Partial<EditableStyle> | null {
  const preset = findRenderPreset(id, projectPresets);
  if (!preset || !isContourLikeLayer(layerId)) return null;
  if (isUserRenderPreset(preset)) {
    return preset.layerStylePatchesByLayerId?.[layerId] ?? null;
  }
  return patchForContourMode(preset.contourMode);
}

export function labelSettingsPatchForRenderPreset(
  id: RenderPresetId | string | null | undefined,
  projectPresets?: readonly RenderPreset[],
): Partial<GuiLabelSettings> | null {
  const preset = findRenderPreset(id, projectPresets);
  if (!preset) return null;
  if (isUserRenderPreset(preset)) {
    return preset.scenePatch.gui?.labels ?? null;
  }
  switch (preset.labelDensity) {
    case "off":
      return {
        enabled: false,
        maxSiteLabelsDesktop: 0,
        maxSiteLabelsMobile: 0,
      };
    case "low":
      return {
        enabled: true,
        maxSiteLabelsDesktop: 8,
        maxSiteLabelsMobile: 4,
        fadeNearM: 8_000,
        fadeFarM: 22_000,
      };
    case "medium":
      return {
        enabled: true,
        maxSiteLabelsDesktop: 16,
        maxSiteLabelsMobile: 8,
        fadeNearM: 10_000,
        fadeFarM: 32_000,
      };
    case "high":
      return {
        enabled: true,
        maxSiteLabelsDesktop: 34,
        maxSiteLabelsMobile: 18,
        fadeNearM: 15_000,
        fadeFarM: 45_000,
      };
  }
}

function nextUserPresetIndex(presets: readonly RenderPreset[]): number {
  const used = new Set<number>();
  for (const preset of presets) {
    const idMatch = /^user-(\d+)$/.exec(preset.id);
    if (idMatch) used.add(Number(idMatch[1]));
    const labelMatch = /^User\s+(\d+)$/i.exec(preset.label);
    if (labelMatch) used.add(Number(labelMatch[1]));
  }
  let index = 1;
  while (used.has(index)) index += 1;
  return index;
}

function buildUserRenderPreset(
  input: Pick<UserRenderPreset, "id" | "label" | "createdAt"> &
    Partial<UserRenderPreset>,
): UserRenderPreset {
  const scenePatch = input.scenePatch ?? {};
  const fog = scenePatch.fog ?? {};
  const lighting = scenePatch.lighting ?? {};
  return {
    id: input.id,
    label: input.label,
    source: "user",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    background: scenePatch.background ?? "#23252a",
    terrainMode: terrainModeFromScenePatch(scenePatch),
    contourMode: "subtle",
    publicDataMode: "standard",
    labelDensity: "medium",
    fog: {
      enabled: fog.enabled ?? false,
      color: fog.color ?? scenePatch.background ?? "#23252a",
      density: fog.density,
    },
    lighting: {
      ambientIntensity:
        lighting.hemisphere?.intensity ??
        lighting.fill?.intensity ??
        0.7,
      sunIntensity: lighting.directional?.intensity ?? 1,
      rimIntensity: lighting.rim?.intensity ?? 0,
      lockSunToCamera: scenePatch.sun?.lockToCamera === true,
    },
    effects: {
      dataGlow: 0,
      lineHalo: 0,
      atmosphere: typeof fog.density === "number" ? fog.density : 0,
    },
    scenePatch,
    layerStylePatchesByLayerId: input.layerStylePatchesByLayerId,
  };
}

function captureCinematicScenePatch(
  scene: SceneProperties | undefined,
): Partial<SceneProperties> {
  if (!scene) return {};
  const patch: Partial<SceneProperties> = {};
  for (const key of CINEMATIC_SCENE_PATCH_KEYS) {
    const value = scene[key];
    if (value !== undefined) {
      (patch as Record<string, unknown>)[key] = cloneJson(value);
    }
  }
  return patch;
}

function captureCinematicLayerStylePatches(
  environment: EnvironmentSetup,
): Record<string, Partial<EditableStyle>> | undefined {
  const patches: Record<string, Partial<EditableStyle>> = {};
  for (const [layerId, style] of Object.entries(environment.layerStyles ?? {})) {
    if (!publicContextFamilyForLayer(layerId) && !isContourLikeLayer(layerId)) {
      continue;
    }
    const patch = captureSafeLayerStylePatch(style);
    if (Object.keys(patch).length > 0) {
      patches[layerId] = patch;
    }
  }
  return Object.keys(patches).length > 0 ? patches : undefined;
}

function captureSafeLayerStylePatch(
  style: EditableStyle,
): Partial<EditableStyle> {
  const patch: Partial<EditableStyle> = {};
  for (const key of CINEMATIC_LAYER_STYLE_PATCH_KEYS) {
    const value = style[key];
    if (value !== undefined) {
      (patch as Record<string, unknown>)[key] = cloneJson(value);
    }
  }
  return patch;
}

function terrainModeFromScenePatch(
  scenePatch: Partial<SceneProperties>,
): RenderPreset["terrainMode"] {
  const preset = scenePatch.terrain?.materialPreset;
  if (preset === "matte" || preset === "relief" || preset === "ghost") {
    return preset;
  }
  return "matte";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isContourLikeLayer(layerId: string): boolean {
  const id = layerId.toLowerCase();
  return id.includes("contour") || id.includes("isoline");
}

function patchForContourMode(
  mode: RenderPreset["contourMode"],
): Partial<EditableStyle> {
  return CONTOUR_MODE_PATCHES[mode];
}

type PublicContextFamily =
  | "roads"
  | "hydrography"
  | "power"
  | "boundary"
  | "infrastructure";

function publicContextFamilyForLayer(layerId: string): PublicContextFamily | null {
  const id = layerId.toLowerCase();
  if (
    id.includes("hydrography") ||
    id.includes("stream") ||
    id.includes("lake") ||
    id.includes("water")
  ) {
    return "hydrography";
  }
  if (id.includes("power-line") || id.includes("power_lines")) {
    return "power";
  }
  if (
    id.includes("claim") ||
    id.includes("property") ||
    id.includes("boundary") ||
    id.includes("working-area")
  ) {
    return "boundary";
  }
  if (id.includes("transport-roads") || id.includes("road")) {
    return "roads";
  }
  if (id.includes("infrastructure")) {
    return "infrastructure";
  }
  return null;
}

function patchForPublicContextMode(
  mode: RenderPreset["publicDataMode"],
  family: PublicContextFamily,
): Partial<EditableStyle> {
  const byMode = PUBLIC_CONTEXT_PATCHES[mode];
  return byMode[family] ?? {};
}

const PUBLIC_CONTEXT_PATCHES: Record<
  RenderPreset["publicDataMode"],
  Record<PublicContextFamily, Partial<EditableStyle>>
> = {
  minimal: {
    roads: {
      color: "#686159",
      opacity: 0.18,
      lineWidth: 0.8,
      affectedByFog: true,
    },
    hydrography: {
      color: "#4f7884",
      outlineColor: "#5f93a2",
      opacity: 0.12,
      fillOpacity: 0.06,
      lineWidth: 0.75,
      affectedByFog: true,
    },
    power: {
      color: "#7b7467",
      opacity: 0.18,
      lineWidth: 0.8,
      affectedByFog: true,
    },
    boundary: {
      color: "#d9d1bf",
      outlineColor: "#d9d1bf",
      opacity: 0.38,
      lineWidth: 1.1,
      affectedByFog: false,
    },
    infrastructure: {
      color: "#9b9587",
      opacity: 0.28,
      lineWidth: 1,
      affectedByFog: true,
    },
  },
  subtle: {
    roads: {
      color: "#756c60",
      opacity: 0.32,
      lineWidth: 1,
      affectedByFog: true,
    },
    hydrography: {
      color: "#57899a",
      outlineColor: "#76afc1",
      opacity: 0.2,
      fillOpacity: 0.1,
      lineWidth: 0.9,
      affectedByFog: true,
    },
    power: {
      color: "#8c826f",
      opacity: 0.3,
      lineWidth: 1,
      affectedByFog: true,
    },
    boundary: {
      color: "#ece1c5",
      outlineColor: "#ece1c5",
      opacity: 0.58,
      lineWidth: 1.45,
      affectedByFog: false,
    },
    infrastructure: {
      color: "#b0a791",
      opacity: 0.4,
      lineWidth: 1.2,
      affectedByFog: true,
    },
  },
  standard: {
    roads: {
      color: "#877864",
      opacity: 0.46,
      lineWidth: 1.35,
      affectedByFog: true,
    },
    hydrography: {
      color: "#5ea2b8",
      outlineColor: "#8bd0e3",
      opacity: 0.34,
      fillOpacity: 0.16,
      lineWidth: 1.1,
      affectedByFog: true,
    },
    power: {
      color: "#a89777",
      opacity: 0.42,
      lineWidth: 1.25,
      affectedByFog: true,
    },
    boundary: {
      color: "#fff0cf",
      outlineColor: "#fff0cf",
      opacity: 0.78,
      lineWidth: 1.8,
      affectedByFog: false,
    },
    infrastructure: {
      color: "#c7b58e",
      opacity: 0.52,
      lineWidth: 1.45,
      affectedByFog: true,
    },
  },
  "high-contrast": {
    roads: {
      color: "#c4a56f",
      opacity: 0.62,
      lineWidth: 1.7,
      affectedByFog: false,
    },
    hydrography: {
      color: "#75d6f2",
      outlineColor: "#b5eeff",
      opacity: 0.58,
      fillOpacity: 0.28,
      lineWidth: 1.55,
      affectedByFog: false,
    },
    power: {
      color: "#e6c077",
      opacity: 0.58,
      lineWidth: 1.55,
      affectedByFog: false,
    },
    boundary: {
      color: "#ffffff",
      outlineColor: "#ffffff",
      opacity: 0.94,
      lineWidth: 2.35,
      affectedByFog: false,
    },
    infrastructure: {
      color: "#f0d18f",
      opacity: 0.68,
      lineWidth: 1.85,
      affectedByFog: false,
    },
  },
};

const CONTOUR_MODE_PATCHES: Record<
  RenderPreset["contourMode"],
  Partial<EditableStyle>
> = {
  off: {
    contourPresetMode: "off",
    contourPresetOpacity: 0,
    contourPresetLineWidth: 0.5,
    contourFarOpacity: 0,
    affectedByFog: true,
  },
  subtle: {
    contourPresetMode: "subtle",
    contourPresetColor: "#8b938f",
    contourPresetOpacity: 0.34,
    contourPresetLineWidth: 0.9,
    contourDistanceFadeNearM: 260,
    contourDistanceFadeFarM: 900,
    contourFarLineScale: 0.28,
    contourFarOpacity: 0.16,
    affectedByFog: true,
  },
  technical: {
    contourPresetMode: "technical",
    contourPresetColor: "#a7e8ff",
    contourPresetOpacity: 0.82,
    contourPresetLineWidth: 1.35,
    contourDistanceFadeNearM: 360,
    contourDistanceFadeFarM: 1250,
    contourFarLineScale: 0.42,
    contourFarOpacity: 0.42,
    affectedByFog: false,
  },
  presentation: {
    contourPresetMode: "presentation",
    contourPresetColor: "#ffe8ad",
    contourPresetOpacity: 0.78,
    contourPresetLineWidth: 1.65,
    contourDistanceFadeNearM: 380,
    contourDistanceFadeFarM: 1400,
    contourFarLineScale: 0.46,
    contourFarOpacity: 0.46,
    contourLiftM: 0.32,
    affectedByFog: false,
  },
  glow: {
    contourPresetMode: "glow",
    contourPresetColor: "#68eaff",
    contourPresetOpacity: 0.94,
    contourPresetLineWidth: 2.1,
    contourDistanceFadeNearM: 450,
    contourDistanceFadeFarM: 1800,
    contourFarLineScale: 0.52,
    contourFarOpacity: 0.58,
    contourLiftM: 0.36,
    affectedByFog: false,
  },
};

function fogDensityForPreset(preset: RenderPreset): number | undefined {
  if (typeof preset.fog.density === "number") return preset.fog.density;
  if (typeof preset.fog.far === "number" && preset.fog.far > 0) {
    return 3 / preset.fog.far;
  }
  return undefined;
}

function terrainPatchForMode(
  mode: RenderPreset["terrainMode"],
): NonNullable<SceneProperties["terrain"]> {
  switch (mode) {
    case "matte":
      return {
        materialPreset: "matte",
        hillshadeIntensity: 0.58,
        rockHueVariance: 0.018,
        shadowSharpness: 0.24,
        facetStrength: 0.015,
        gridEnabled: false,
      };
    case "relief":
      return {
        materialPreset: "relief",
        hillshadeIntensity: 1.08,
        rockHueVariance: 0.052,
        shadowSharpness: 0.55,
        facetStrength: 0.08,
      };
    case "ghost":
      return {
        materialPreset: "ghost",
        rampLow: "#334049",
        rampMid: "#586772",
        rampHigh: "#a9b5bd",
        hillshadeIntensity: 0.32,
        rockHueVariance: 0.01,
        shadowSharpness: 0.16,
        facetStrength: 0.01,
        gridEnabled: false,
        undersideOpacity: 0,
      };
  }
}
