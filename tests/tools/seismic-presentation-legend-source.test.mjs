import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

function readJson(...parts) {
  return JSON.parse(readSource(...parts));
}

function readSourceIfExists(...parts) {
  const filePath = join(repoRoot, ...parts);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

const SEISMIC_LAYER_ID = "utah-forge-phase3-seismic-browser";
const TIE_PAGE_ID = "61_psdm_mt_58_32_source_location_tie";
const PSDM_SURROGATE_PRESET_ID = "psdm-depth-surrogate-showcase";
const PSDM_TIE_PRESET_ID = "psdm-mt-58-32-source-location-tie";
const UNENHANCED_PRODUCT_ID = "gdr-1141-forge3d-ani-psdm-stack-unenh";
const ENHANCED_PRODUCT_ID = "gdr-1141-forge3d-ani-psdm-stack-enh";
const VELOCITY_PRODUCT_ID = "gdr-1015-forge3d-velo5d-float-01312018";

test("seismic presentation bar has a stored style flag and editor toggle", () => {
  const typesSource = readSource("src", "pages", "types.ts");
  const displayControlsSource = readSource(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SeismicDisplayTuningControls.tsx",
  );
  const previewFieldsSource = readSource(
    "src",
    "projectModules",
    "utahForge",
    "editorPreviewFields.ts",
  );
  const manifest = readJson(
    "docs",
    "dev-context",
    "editor-control-manifest.json",
  );

  assert.match(
    typesSource,
    /seismicPresentationBarVisible\?: boolean/,
    "EditableStyle should include the presentation bar visibility flag",
  );
  assert.match(
    displayControlsSource,
    /data-testid="seismic-presentation-bar-visible"/,
    "seismic editor should expose a stable Presentation bar toggle",
  );
  assert.match(
    displayControlsSource,
    /seismicPresentationBarVisible: e\.target\.checked/,
    "Presentation bar toggle should write the dedicated style field",
  );
  assert.match(
    previewFieldsSource,
    /"seismicPresentationBarVisible"/,
    "Utah FORGE page-preview field map should preserve the presentation bar flag",
  );
  assert.ok(
    manifest.entries.some(
      (entry) =>
        entry.id === "seismic.display.presentation-bar" &&
        entry.sourceAnchor === 'data-testid="seismic-presentation-bar-visible"' &&
        entry.backedBy.includes("seismicPresentationBarVisible") &&
        entry.status === "active",
    ),
    "editor control manifest should register the Presentation bar toggle",
  );
});

test("seismic presentation bar model is claim-safe and uses companion velocity scale", () => {
  const modelSource = readSourceIfExists(
    "src",
    "ui",
    "seismicPresentationLegendModel.ts",
  );
  const componentSource = readSourceIfExists(
    "src",
    "ui",
    "SeismicPresentationLegendBar.tsx",
  );
  const editorChromeSource = readSource("src", "editor", "EditorChrome.tsx");
  const project = readJson("projects", "utah-forge", "project.json");
  const seismicLayer = project.layers.find((layer) => layer.id === SEISMIC_LAYER_ID);
  const products = seismicLayer?.metadata?.seismicProducts ?? [];
  const velocityProduct = products.find((product) => product.id === VELOCITY_PRODUCT_ID);
  const unenhancedProduct = products.find((product) => product.id === UNENHANCED_PRODUCT_ID);

  assert.match(
    modelSource,
    new RegExp(VELOCITY_PRODUCT_ID),
    "presentation model should explicitly use the GDR 1015 velocity companion",
  );
  assert.match(modelSource, /Velocity reference/);
  assert.match(modelSource, /2,000/);
  assert.match(modelSource, /5,000/);
  assert.match(modelSource, /m\/s/);
  assert.match(modelSource, /source-derived/);
  assert.match(modelSource, /1,800 m/);
  assert.match(modelSource, /VE/);
  assert.match(modelSource, /formatSeismicPresentationSliceReadout/);
  assert.match(modelSource, /inlineRange/);
  assert.match(modelSource, /crosslineRange/);
  assert.match(modelSource, /sampleRange/);
  assert.doesNotMatch(
    modelSource,
    new RegExp(ENHANCED_PRODUCT_ID),
    "presentation model should not use the source-gated enhanced PSDM product",
  );

  assert.match(componentSource, /export function SeismicPresentationLegendBar/);
  assert.match(componentSource, /data-testid="seismic-presentation-legend-bar"/);
  assert.match(componentSource, /data-testid="seismic-presentation-slice-axis"/);
  assert.match(componentSource, /data-testid="seismic-presentation-slice-fraction"/);
  assert.match(componentSource, /seismicSliceAxis/);
  assert.match(componentSource, /seismicSliceFraction/);
  assert.match(componentSource, /seismicPresentationBarVisible/);
  assert.match(componentSource, /seismicLegendVisible/);
  assert.match(componentSource, /resolveTopoMapSettings/);
  assert.match(componentSource, /page\s*\?\s*effectiveVisibility\(pageEnvironment,\s*page\)/);
  assert.doesNotMatch(
    componentSource,
    /editingEnvironment\s*\?\s*new Set\(state\.environment\.defaultVisibleLayers\)/,
    "presentation bar display should follow the active page, not the selected editor panel",
  );

  assert.match(editorChromeSource, /SeismicPresentationLegendBar/);
  assert.match(editorChromeSource, /<SeismicPresentationLegendBar sceneHandle=\{sceneHandle\} \/>/);

  assert.deepEqual(
    velocityProduct?.valueEncoding?.displayRangeMPerS,
    [2000, 5000],
    "velocity companion product should carry the required m/s display range",
  );
  assert.deepEqual(
    [
      unenhancedProduct?.raymarchVolume?.sampleDomain?.min,
      unenhancedProduct?.raymarchVolume?.sampleDomain?.max,
    ],
    [0, 5000],
    "unenhanced PSDM product should carry a 0-5000 m depth sample domain",
  );
});

test("PSDM surrogate presets and 58-32 page opt in to the presentation bar", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const recipes = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_demo_recipes.json",
  );
  const environment = readJson("projects", "utah-forge", "environment.json");
  const tiePage = readJson(
    "projects",
    "utah-forge",
    "pages",
    `${TIE_PAGE_ID}.json`,
  );
  const seismicLayer = project.layers.find((layer) => layer.id === SEISMIC_LAYER_ID);
  const presetCollections = [
    recipes.audiencePresets ?? [],
    recipes.capabilityPresets ?? [],
    seismicLayer?.metadata?.seismicAudiencePresets ?? [],
    seismicLayer?.metadata?.seismicCapabilityPresets ?? [],
  ];

  for (const presetId of [PSDM_SURROGATE_PRESET_ID, PSDM_TIE_PRESET_ID]) {
    for (const presets of presetCollections) {
      const preset = presets.find((candidate) => candidate.id === presetId);
      assert.ok(preset, `${presetId} should exist in generated and project metadata`);
      assert.equal(
        preset.presentationBarVisible,
        true,
        `${presetId} should explicitly enable the presentation bar`,
      );
      assert.equal(preset.productId, UNENHANCED_PRODUCT_ID);
      assert.equal(
        (preset.visibleProductIds ?? []).includes(ENHANCED_PRODUCT_ID),
        false,
        `${presetId} should not render the source-gated enhanced PSDM`,
      );
    }
  }

  const globalSeismicStyle =
    environment.layerStyles?.[SEISMIC_LAYER_ID] ?? {};
  assert.equal(
    globalSeismicStyle.seismicPresentationBarVisible,
    true,
    "global surrogate demo default should show the presentation bar",
  );

  const tieSeismicStyle = tiePage.layerOverrides?.[SEISMIC_LAYER_ID] ?? {};
  assert.equal(
    tieSeismicStyle.seismicPresentationBarVisible,
    true,
    "PSDM + MT + 58-32 page should show the presentation bar",
  );
  assert.equal(tieSeismicStyle.seismicProductId, UNENHANCED_PRODUCT_ID);
  assert.equal(tieSeismicStyle.seismicProductVisibility?.[ENHANCED_PRODUCT_ID], undefined);
});
