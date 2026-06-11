import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("terrain camera LOD is selected once and rendered as one continuous mesh", () => {
  const source = readSource("src", "loaders", "loadTerrain.ts");

  assert.match(
    source,
    /function selectUniformTerrainLodTier\(/,
    "Terrain loader should centralize one global LOD tier decision.",
  );
  assert.match(
    source,
    /terrainCentroid\.distanceTo\(cameraPosition\)/,
    "Uniform terrain LOD should use camera distance to the terrain centroid.",
  );
  assert.match(
    source,
    /function fillTerrainNoData\(/,
    "Terrain loader should fill DEM nodata before building geometry.",
  );
  assert.doesNotMatch(
    source,
    /const z = nodata !== null && raw === nodata \? fallbackElevation : raw/,
    "Terrain nodata should not become a zero-elevation wall in rendered geometry.",
  );
  assert.match(
    source,
    /terrainLodTierVertexEstimate\(\s*tiles,\s*lodSteps\[/,
    "Budget checks should estimate one shared tier across all terrain tiles.",
  );
  assert.match(
    source,
    /terrainMesh\.name\s*=\s*"terrain-surface"/,
    "Terrain should render through one continuous mesh so internal tile seams cannot show.",
  );
  assert.match(
    source,
    /tile:\s*fullTerrainTile/,
    "Rendered terrain geometry should cover the full source extent for the selected tier.",
  );
  assert.doesNotMatch(
    source,
    /terrain-tile-\$\{/,
    "Internal accounting tiles should not be rendered as separate mesh draw calls.",
  );
  assert.doesNotMatch(
    source,
    /new Map<TerrainTileRecord,\s*TerrainLodTierName>/,
    "Per-tile LOD tier maps can reintroduce adjacent T-junction cracks.",
  );
  assert.doesNotMatch(
    source,
    /desired\.set\(\s*tile,\s*distance < 65_000/s,
    "Camera distance should not assign independent tiers per tile.",
  );
  assert.match(
    source,
    /lodTierCounts\[tile\.tier\]\s*\+=\s*1/,
    "Existing debug state should still publish per-tier tile counts.",
  );
});

test("NAIP generator supports a regional COG source and validates CRS plus bounds", () => {
  const source = readSource("tools", "generate-naip-regional-overview-assets.py");

  for (const county of [
    "beaver",
    "garfield",
    "iron",
    "kane",
    "millard",
    "piute",
    "sanpete",
    "sevier",
    "wayne",
  ]) {
    assert.match(
      source,
      new RegExp(`"id": "${county}",[\\s\\S]*?"ties": \\[\\]`),
      `${county} should keep identity ties against zero-rotation source imagery.`,
    );
  }
  for (const label of [
    "NAIP2024_Garfield",
    "NAIP2024_Kane",
    "NAIP2024_Piute",
    "NAIP2024_Wayne",
  ]) {
    assert.match(
      source,
      new RegExp(`"label": "${label}"`),
      `${label} should be included in the regional source catalog.`,
    );
  }
  assert.match(
    source,
    /DEFAULT_REGIONAL_COG_PATH/,
    "Generator should declare a canonical pre-merged regional COG path.",
  );
  assert.match(
    source,
    /"--source-mode"/,
    "Generator should expose source-mode selection for county, COG, or auto input.",
  );
  assert.match(
    source,
    /EXPECTED_SOURCE_EPSG\s*=\s*26912/,
    "Generator should declare the required NAIP source CRS.",
  );
  assert.match(
    source,
    /def assert_sources_epsg_26912\(/,
    "Generator should validate every county SID before mosaic construction.",
  );
  assert.match(
    source,
    /gdalinfo[\s\S]*-json/,
    "CRS validation should inspect GDAL JSON metadata.",
  );
  assert.match(
    source,
    /def assert_vrt_bounds_match_region\(/,
    "Generator should validate the VRT union extent against regional_bounds().",
  );
  assert.match(
    source,
    /def qgis_gdal_translate_cog\(/,
    "Generator should be able to build a tiled regional COG from the county VRT.",
  );
  assert.match(
    source,
    /def build_regional_cog\(/,
    "Generator should provide an explicit regional COG build path.",
  );
  assert.match(
    source,
    /"--cog-only"/,
    "Generator should allow building or validating the COG without replacing WebP outputs.",
  );
  assert.match(
    source,
    /def resolve_webp_source\(/,
    "WebP generation should resolve either the pre-merged COG or county VRT source.",
  );
  assert.match(
    source,
    /assert_sources_epsg_26912\(qgis_bat,\s*catalog\)/,
    "County-source builds should run the CRS guard before aligned sources are mosaicked.",
  );
  assert.match(
    source,
    /assert_vrt_bounds_match_region\(vrt_path,\s*bounds\)/,
    "Main should reject VRT bounds that differ from regional_bounds().",
  );
  assert.match(
    source,
    /update_naip_manifest_metadata_and_cache_versions\(/,
    "Manifest provenance, AOI bounds, dimensions, and cache keys should stay catalog-driven.",
  );
  assert.match(
    source,
    /NAIP_DIAGNOSTIC_LAYER_ID\s*=\s*"naip-2024-tile-diagnostics"/,
    "County diagnostic overlay updates should target the NAIP tile layer explicitly.",
  );
  assert.match(
    source,
    /def update_project_naip_metadata_refs\(/,
    "Project NAIP material bounds and diagnostic tiles should update with the source catalog.",
  );
  assert.match(
    source,
    /def ensure_naip_diagnostic_crs_registration\(/,
    "NAIP diagnostic regeneration should preserve or create CRS registration metadata.",
  );
  assert.match(
    source,
    /metadata\["crsRegistration"\]\s*=/,
    "NAIP diagnostic metadata refresh should write CRS registration when it is missing.",
  );
  assert.match(
    source,
    /update_project_naip_metadata_refs\(SOURCE_CATALOG,\s*bounds\)/,
    "Main should refresh project NAIP bounds before cache references are updated.",
  );
  assert.match(
    source,
    /assert_raster_bounds_match_region\(qgis_bat,\s*regional_cog,\s*bounds\)/,
    "COG-source builds should validate the COG CRS and bounds before use.",
  );
  assert.match(
    source,
    /build_best_interior_composite\(/,
    "Default county-source builds should composite valid county pixels by best interior coverage.",
  );
  assert.match(
    source,
    /else resolve_webp_source\(args,\s*qgis_bat,\s*temp_dir,\s*bounds\)/,
    "VRT and COG modes should still generate WebP outputs from a resolved source path.",
  );
});

test("ortho drape bounds are computed once globally without the corner-pick heuristic", () => {
  const source = readSource("src", "topoMap", "surfaceRuntime.ts");

  assert.match(
    source,
    /imageMinX - \(terrainMinX - sceneMinX\)/,
    "Ortho mapping should use the direct terrain-min to scene-min offset.",
  );
  assert.doesNotMatch(
    source,
    /Math\.abs\(terrainMinX - sceneMinX\)/,
    "Corner-pick mapping heuristic should be removed.",
  );
  assert.match(
    source,
    /private terrainSceneBounds\(/,
    "Shared terrain scene bounds should be resolved once from the shared handle.",
  );
  const applyMatch = source.match(
    /private applyOrthoPhotoBounds\([\s\S]*?\n  \}/,
  );
  assert.ok(applyMatch, "applyOrthoPhotoBounds should exist.");
  assert.doesNotMatch(
    applyMatch[0],
    /terrainGroup\?\.traverse/,
    "Ortho photo bounds should not be written once per terrain mesh.",
  );
  assert.match(
    applyMatch[0],
    /handle\.setOrthoPhotoBounds\(/,
    "Ortho photo bounds should still update the shared terrain material handle.",
  );
});
