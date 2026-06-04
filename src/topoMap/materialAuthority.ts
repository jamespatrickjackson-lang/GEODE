import type { SceneProperties } from "../pages/types";

type TerrainSettings = NonNullable<SceneProperties["terrain"]>;

export const TOPO_MATERIAL_AUTHORITY_TERRAIN_FIELDS = [
  "materialPreset",
  "topoImageMaterialSources",
  "orthoPhotoTextureBudget",
  "orthoPhotoPath",
  "orthoPhotoTexture4096Path",
  "orthoPhotoTexture8192Path",
  "orthoPhotoBounds",
  "orthoPhotoOpacity",
  "orthoPhotoEdgeClipInsetM",
  "orthoPhotoEdgeFadeDistanceM",
  "orthoPhotoHillshadeBlend",
  "orthoPhotoBrightness",
  "orthoPhotoContrast",
  "orthoPhotoSaturation",
  "orthoPhotoOutsideFillEnabled",
  "orthoPhotoOutsideSurfaceMode",
  "orthoPhotoOutsideColor",
  "orthoPhotoOutsideOpacity",
  "orthoPhotoShadowStrength",
  "orthoPhotoShadowFloor",
  "orthoPhotoShadowTint",
  "projectedMapShadowsEnabled",
  "projectedMapShadowOpacity",
  "projectedMapShadowSoftness",
  "projectedMapShadowBias",
  "surfaceElevationEnabled",
  "surfaceElevationLegendVisible",
  "surfaceElevationMinM",
  "surfaceElevationMaxM",
  "surfaceElevationColors",
  "surfaceElevationColorPositions",
  "surfaceElevationMidpoints",
  "surfaceElevationTransitionSoftness",
  "surfaceElevationColorBlend",
  "surfaceElevationReverse",
  "verticalExaggeration",
  "edgeFadeDistanceM",
  "edgeFadeShape",
  "edgeFadeInsetM",
  "edgeFadeCornerRadiusM",
  "edgeOutlineEnabled",
  "edgeOutlineOffsetM",
  "edgeOutlineThicknessM",
  "edgeOutlineColor",
  "edgeOutlineOpacity",
  "edgeTopShine",
  "edgeCornerShine",
  "edgeBottomShine",
  "topoMapBranding",
] as const satisfies readonly (keyof TerrainSettings)[];

export function topoMaterialAuthorityPatch(
  terrain: TerrainSettings | undefined,
): TerrainSettings | undefined {
  if (!terrain) return undefined;
  const patch: TerrainSettings = {};
  for (const field of TOPO_MATERIAL_AUTHORITY_TERRAIN_FIELDS) {
    if (terrain[field] !== undefined) {
      patch[field] = terrain[field] as never;
    }
  }
  return Object.keys(patch).length > 0 ? patch : undefined;
}

export function applyTopoMaterialAuthority(
  terrain: TerrainSettings | undefined,
  authority: TerrainSettings | undefined,
): TerrainSettings | undefined {
  const patch = topoMaterialAuthorityPatch(authority);
  if (!terrain && !patch) return undefined;
  return {
    ...(terrain ?? {}),
    ...(patch ?? {}),
  };
}

export function stripTopoMaterialAuthorityFromTerrain(
  terrain: TerrainSettings | undefined,
): TerrainSettings | undefined {
  if (!terrain) return undefined;
  const next: TerrainSettings = { ...terrain };
  for (const field of TOPO_MATERIAL_AUTHORITY_TERRAIN_FIELDS) {
    delete next[field];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function stripTopoMaterialAuthorityFromScenePatch(
  patch: Partial<SceneProperties>,
): Partial<SceneProperties> {
  if (!patch.terrain) return patch;
  const terrain = stripTopoMaterialAuthorityFromTerrain(patch.terrain);
  const next: Partial<SceneProperties> = { ...patch };
  if (terrain) {
    next.terrain = terrain;
  } else {
    delete next.terrain;
  }
  return next;
}
