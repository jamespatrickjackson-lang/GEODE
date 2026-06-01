import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const primaryUtahForgeLayerIds = [
  "terrain",
  "utah-forge-phase3-seismic-browser",
  "utah-forge-mt-resistivity-full-density",
  "utah-forge-mt-resistivity-volume",
  "utah-forge-mt-resistivity-threshold-surfaces",
  "utah-forge-mt-top-surface",
  "utah-forge-mt-top-contact-surface",
  "utah-forge-mt-resistivity-slices",
];

const showcasePageIds = [
  "40_geophysics_product_overview",
  "41_mt_station_network_footprint",
  "42_resistivity_volume_overview",
  "43_resistivity_depth_elevation_slices",
  "44_resistivity_cross_sections",
  "45_resistivity_isosurfaces",
  "49_seismic_fence_panels",
  "50_integrated_seismic_resistivity_context",
];

const forbiddenPrimaryLanguage = [
  /low-resolution preview/i,
  /downsampled visual products/i,
  /compact downsampled/i,
  /not engineering-grade/i,
  /not the final sliceable/i,
  /validation\/presentation preview/i,
];

function readText(...segments) {
  return readFileSync(join(...segments), "utf8");
}

function readJson(...segments) {
  return JSON.parse(readText(...segments));
}

function assertNoForbiddenLanguage(text, label) {
  for (const pattern of forbiddenPrimaryLanguage) {
    assert.doesNotMatch(text, pattern, `${label} should not use ${pattern}`);
  }
}

test("primary Utah FORGE visual layers use source-fidelity language", () => {
  const project = readJson("projects", "utah-forge", "project.json");

  for (const layerId of primaryUtahForgeLayerIds) {
    const layer = project.layers.find((candidate) => candidate.id === layerId);
    assert.ok(layer, `primary layer exists: ${layerId}`);
    const userFacingText = JSON.stringify({
      id: layer.id,
      label: layer.label,
      description: layer.description,
      metadata: layer.metadata,
    });
    assertNoForbiddenLanguage(userFacingText, layerId);
  }
});

test("primary Utah FORGE artifacts do not self-label intended visuals as low-grade previews", () => {
  const seismicManifest = readText(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_manifest.json",
  );
  assertNoForbiddenLanguage(seismicManifest, "seismic manifest");

  const docsToCheck = [
    join("projects", "utah-forge", "DATA_LAYER_STATUS.md"),
    join("docs", "tool-manifest.md"),
    join("docs", "dev-context", "Computed-Artifact-Pipeline.md"),
    join("docs", "dev-context", "Layer-Artifact-Classification.md"),
  ];

  for (const path of docsToCheck) {
    const text = readFileSync(path, "utf8");
    assertNoForbiddenLanguage(text, path);
  }
});

test("seismic prep script derives product resolution instead of applying global 128 or 64 caps", () => {
  const source = readText("prep", "build_utah_forge_seismic_browser.py");

  assert.doesNotMatch(source, /^SECTION_WIDTH\s*=\s*128/m);
  assert.doesNotMatch(source, /^SECTION_HEIGHT\s*=\s*128/m);
  assert.doesNotMatch(source, /^VOLUME_DIM\s*=\s*64/m);
  assert.doesNotMatch(source, /trace_grid_shape\(trace_count,\s*VOLUME_DIM,\s*VOLUME_DIM\)/);
  assert.doesNotMatch(source, /selected_sample_indices\(sample_count,\s*SECTION_HEIGHT\)/);
  assert.match(source, /source_aligned_section_shape|section_shape_for_product/);
  assert.match(source, /source_aligned_volume_shape|volume_shape_for_product/);
});

test("3D seismic browser products are capped for interactive source-fidelity rendering", () => {
  const manifest = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_manifest.json",
  );
  const threeDimensionalProducts = manifest.products.filter(
    (product) => product.surveyKind === "3d",
  );

  assert.ok(threeDimensionalProducts.length > 0, "expected 3D seismic products");
  for (const product of threeDimensionalProducts) {
    for (const section of product.sections ?? []) {
      assert.ok(
        Math.max(section.width, section.height) <= 2048,
        `${product.id}/${section.id} should stay within the 2048px browser cap`,
      );
      assert.ok(
        section.width !== 128 || section.height !== 128,
        `${product.id}/${section.id} should not fall back to the old 128x128 preview`,
      );
      assert.ok(section.lods?.coarse, `${product.id}/${section.id} should expose a coarse LOD tier`);
      assert.ok(section.lods?.standard, `${product.id}/${section.id} should expose a standard LOD tier`);
      assert.ok(section.lods?.source, `${product.id}/${section.id} should expose a source LOD tier`);
      assert.ok(
        Math.max(section.lods.coarse.width, section.lods.coarse.height) <=
          Math.max(section.width, section.height),
        `${product.id}/${section.id} coarse tier should not exceed the standard tier`,
      );
    }

    if (product.raymarchVolume) {
      const [nx, ny, nz] = product.raymarchVolume.dimensions;
      assert.ok(
        nx * ny * nz <= 8_388_608,
        `${product.id} raymarch volume should stay within the interactive voxel budget`,
      );
      assert.ok(
        Math.min(nx, ny, nz) > 64 || product.id.includes("velo5d"),
        `${product.id} should not fall back to the old 64-cube preview`,
      );
      assert.ok(product.raymarchVolume.lods?.coarse, `${product.id} should expose a coarse volume tier`);
      assert.ok(product.raymarchVolume.lods?.standard, `${product.id} should expose a standard volume tier`);
      assert.ok(product.raymarchVolume.lods?.source, `${product.id} should expose a source volume tier`);
      const [cx, cy, cz] = product.raymarchVolume.lods.coarse.dimensions;
      assert.ok(
        cx * cy * cz <= nx * ny * nz,
        `${product.id} coarse volume tier should not exceed the standard tier`,
      );
    }
  }
});

test("MT volume prep script derives grid dimensions from source spacing", () => {
  const source = readText("prep", "build_utah_forge_mt_volume_products.mjs");

  assert.doesNotMatch(source, /dimensions:\s*\[80,\s*64,\s*56\]/);
  assert.doesNotMatch(source, /dimensions:\s*\[96,\s*80,\s*64\]/);
  assert.match(source, /deriveSourceFidelityVolumeDimensions/);
});

test("terrain primary artifact is no longer fixed to the 1000 m raster", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const terrain = project.layers.find((layer) => layer.id === "terrain");
  assert.ok(terrain, "terrain layer should exist");
  assert.doesNotMatch(
    terrain.files?.raster ?? "",
    /terrain_public_context_1000m\.tif$/,
  );

  const publicContext = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "public_context",
    "manifest.json",
  );
  assert.notEqual(publicContext.terrain?.resolutionM, 1000);
  assert.match(publicContext.terrain?.file ?? "", /terrain_public_context_200m\.tif$/);
  assert.equal(
    terrain.metadata?.geoTransform?.terrainMaxVertices,
    900000,
    "terrain runtime budget should stay below unsafe full-raster rendering",
  );
});

test("runtime loaders separate source-fidelity artifacts from render budgets", () => {
  const scalarVolume = readText("src", "loaders", "loadScalarVolume.ts");
  const seismicBrowser = readText("src", "loaders", "loadSeismicBrowser.ts");
  const terrainLoader = readText("src", "loaders", "loadTerrain.ts");
  const seismicStyle = readText("src", "scene", "styles", "seismicBrowserStyle.ts");

  assert.doesNotMatch(scalarVolume, /clamp\(uSampleSteps,\s*24\.0,\s*192\.0\)/);
  assert.doesNotMatch(seismicBrowser, /clamp\(uSampleSteps,\s*24\.0,\s*160\.0\)/);
  assert.match(scalarVolume, /SOURCE_FIDELITY_MAX_SAMPLE_STEPS/);
  assert.match(seismicBrowser, /SOURCE_FIDELITY_MAX_SAMPLE_STEPS/);
  assert.match(terrainLoader, /DEFAULT_TERRAIN_MAX_VERTICES\s*=\s*900_000/);
  assert.match(terrainLoader, /terrainLodHandle/);
  assert.match(terrainLoader, /TERRAIN_TILE_COLUMNS/);
  assert.doesNotMatch(
    seismicBrowser,
    /Promise\.all\(\s*manifest\.products\.map/s,
    "seismic loader should not eagerly build every manifest product",
  );
  assert.match(seismicBrowser, /seismicEnsureProductsLoaded/);
  assert.match(seismicBrowser, /seismicRetainProducts/);
  assert.match(seismicBrowser, /seismicActiveLodByProduct/);
  assert.match(seismicStyle, /seismicEnsureProductsLoaded/);
  assert.match(seismicStyle, /seismicRetainProducts/);
  assert.match(seismicBrowser, /new THREE\.DataTexture/);
  assert.match(seismicBrowser, /sampler2D uAmplitudeMap/);
  assert.match(seismicBrowser, /seismicTexturePlane/);
  assert.doesNotMatch(
    seismicBrowser,
    /buildGridIndices\(section\.width,\s*section\.height\)/,
    "seismic section render geometry should no longer allocate per-sample grid indices",
  );
  assert.doesNotMatch(
    seismicBrowser,
    /geometry\.setAttribute\("color"/,
    "seismic section color should be produced by the texture shader, not per-sample vertex colors",
  );
  assert.doesNotMatch(
    seismicBrowser,
    /geometry\.setAttribute\("seismicAlpha"/,
    "seismic section alpha should be produced by the texture shader, not per-sample vertex alpha",
  );
  assert.doesNotMatch(
    seismicStyle,
    /for\s*\(\s*let i = 0;\s*i < Math\.min\(color\.count,\s*values\.length\)/,
    "seismic section style should update shader uniforms instead of recoloring every sample",
  );
  assert.doesNotMatch(
    seismicStyle,
    /sectionIsoAttributeValues/,
    "texture-backed seismic sections should not build v1 section ISO overlays from render attributes",
  );
  assert.match(seismicStyle, /seismicSectionIsoDisabledReason/);
});

test("seismic runtime uses coarse LOD during transient interaction windows", () => {
  const sceneManager = readText("src", "scene", "SceneManager.ts");
  const seismicBrowser = readText("src", "loaders", "loadSeismicBrowser.ts");
  const seismicStyle = readText("src", "scene", "styles", "seismicBrowserStyle.ts");

  assert.match(seismicStyle, /function seismicResolveTargetLodTier/);
  assert.match(seismicStyle, /seismicPendingLodByProduct/);
  assert.match(seismicStyle, /seismicActiveLodByProduct/);
  assert.match(seismicStyle, /seismicTransitionActive/);
  assert.match(seismicStyle, /seismicCameraMoving/);
  assert.match(seismicStyle, /previousProductId\s*&&\s*previousProductId !== productId/);
  assert.match(seismicStyle, /pendingTier === "coarse"/);
  assert.match(seismicStyle, /pendingTier && !activeTier/);
  assert.doesNotMatch(
    seismicStyle,
    /pendingProductIds\.length\s*>\s*0/,
    "settled standard promotion must not be downgraded just because a standard tier is pending",
  );
  assert.match(sceneManager, /updateSeismicTransientLodState/);
  assert.match(sceneManager, /seismicCameraMovingUntilMs/);
  assert.match(sceneManager, /seismicTransientLodReason/);
  assert.match(seismicBrowser, /requestedTier === SEISMIC_COARSE_LOD_TIER/);
});

test("showcase pages do not use the MT QA subset as a primary visual", () => {
  for (const pageId of showcasePageIds) {
    const page = readJson("projects", "utah-forge", "pages", `${pageId}.json`);
    assert.notEqual(
      page.visibilityOverrides?.["utah-forge-mt-resistivity-preview"],
      true,
      `${pageId} should not turn on the 90k MT QA subset as a primary visual`,
    );
  }
});
