import assert from "node:assert/strict";
import { assertSubset, readJson, runValidation } from "./lib/validation.mjs";

function layerOverride(pageId, layerId) {
  const page = readJson(`projects/utah-forge/pages/${pageId}.json`);
  return page.layerOverrides?.[layerId];
}

function validateEnvironment() {
  const environment = readJson("projects/utah-forge/environment.json");
  assert.equal(environment.renderPreset, "utah-forge-reference-cinematic-dark");
  assert.deepEqual(environment.defaultVisibleLayers, [
    "utah-forge-mt-resistivity-full-density",
    "utah-forge-phase3-seismic-browser",
  ]);
  assertSubset(
    environment.scene,
    {
      background: "#383838",
      exposure: 1.08,
      fog: { enabled: true, color: "#383838", density: 0.00008 },
      bloom: { strength: 0, radius: 0.55, threshold: 0.86 },
      vignette: { strength: 0.95, smoothness: 0.65 },
      ambientOcclusion: { enabled: true },
    },
    "Utah scene",
  );

  const referencePreset = environment.customRenderPresets?.find(
    (preset) => preset.id === "utah-forge-reference-cinematic-dark",
  );
  assertSubset(
    referencePreset,
    {
      label: "Utah FORGE Reference Cinematic Dark",
      source: "user",
      scenePatch: {
        background: "#383838",
        exposure: 1.08,
        fog: { enabled: true, color: "#383838", density: 0.00008 },
        bloom: { strength: 0, radius: 0.55, threshold: 0.86 },
        vignette: { strength: 0.95, smoothness: 0.65 },
        ambientOcclusion: { enabled: true },
      },
    },
    "Utah reference preset",
  );

  assertSubset(
    environment.layerStyles["utah-forge-phase3-working-area"],
    {
      color: "#ffffff",
      opacity: 0.92,
      lineWidth: 2.4,
      affectedByFog: false,
    },
    "working area style",
  );
  assertSubset(
    environment.layerStyles["utah-forge-scene-section-planes"],
    {
      sceneSectionEnabled: false,
      sceneSectionMode: "cutaway",
      sceneSectionTargetScope: "selected-targets",
    },
    "scene section style",
  );
  assert.deepEqual(
    environment.layerStyles["utah-forge-scene-section-planes"]
      .sceneSectionTargetLayerIds,
    ["utah-forge-mt-resistivity-volume"],
  );
  assertSubset(
    environment.layerStyles["utah-forge-mt-resistivity-volume"],
    {
      scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
      scalarVolumeRenderMode: "raymarch",
      scalarVolumeMaskVisible: true,
    },
    "MT volume style",
  );

  const fullDensityStyle =
    environment.layerStyles["utah-forge-mt-resistivity-full-density"];
  assertSubset(
    fullDensityStyle,
    {
      opacity: 0.3,
      pointSizePx: 1,
      scalarBlendMin: 0.139879,
      scalarBlendMax: 3.937122,
      scalarDisplayMin: 0.139879,
      scalarDisplayMax: 3.937122,
      scalarFocusMin: -2,
      scalarFocusMax: 4.5,
      scalarContrast: 1.05,
      scalarDistanceLightStrength: 0.35,
    },
    "MT full-density style",
  );
  assert.equal(fullDensityStyle.scalarInclusionMode, undefined);
}

function validatePages() {
  for (const [pageId, focusMin, focusMax, blendMin, blendMax] of [
    [
      "04_mt_high_resistivity_seismic",
      2.694444193332294,
      4.5,
      3.619791464880117,
      4.5,
    ],
    [
      "05_mt_threshold_focus",
      3.0555553761897336,
      4.5,
      3.0555553761897336,
      4.5,
    ],
    [
      "06_mt_low_resistivity_seismic",
      1.3177084813101363,
      2.2656248520231967,
      1.3177084813101363,
      2.2656248520231967,
    ],
  ]) {
    const override = layerOverride(pageId, "utah-forge-mt-resistivity-full-density");
    assertSubset(
      override,
      {
        scalarFocusMin: focusMin,
        scalarFocusMax: focusMax,
        scalarBlendMin: blendMin,
        scalarBlendMax: blendMax,
        scalarInclusionMode: "thresholded",
      },
      `${pageId} full-density override`,
    );
    assert.equal(override.opacity, undefined);
    assert.equal(override.pointSizePx, undefined);
  }

  assert.equal(
    layerOverride("08_mt_threshold_surfaces", "utah-forge-mt-resistivity-full-density"),
    undefined,
  );

  const page05 = readJson("projects/utah-forge/pages/05_mt_threshold_focus.json");
  assert.deepEqual(page05.camera.position, [
    -28879.73795742467,
    -32469.208165290154,
    11845.116116638794,
  ]);
  assertSubset(
    page05.dynamicCamera,
    {
      orbitSpeedDegPerSec: 4,
      orbitRadius: 34868,
      pathAwareBlend: false,
    },
    "05_mt_threshold_focus dynamic camera",
  );

  for (const pageId of [
    "04_mt_high_resistivity_seismic",
    "06_mt_low_resistivity_seismic",
  ]) {
    assertSubset(
      layerOverride(pageId, "utah-forge-phase3-seismic-browser"),
      {
        opacity: 0.42,
        seismicProductId: "gdr-1015-forge3d-velo5d-float-01312018",
        seismicProductVisibility: {
          "gdr-1015-forge3d-velo5d-float-01312018": true,
        },
        seismicRenderMode: "raymarch",
        seismicSliceAxis: "inline",
        seismicSliceThroughVolume: false,
        seismicColormap: "velocity",
      },
      `${pageId} seismic override`,
    );
  }

  assertSubset(
    layerOverride("12_mt_volume_overview", "utah-forge-mt-resistivity-full-density"),
    {
      opacity: 0.48,
      pointSizePx: 1.25,
      scalarInclusionMode: "all-valid",
    },
    "12_mt_volume_overview full-density override",
  );
  assertSubset(
    layerOverride("12_mt_volume_overview", "utah-forge-mt-resistivity-volume"),
    {
      opacity: 0.28,
      scalarVolumeOpacity: 0.28,
      scalarVolumeDensity: 0.42,
      scalarVolumeSampleSteps: 96,
    },
    "12_mt_volume_overview volume override",
  );
}

runValidation("Utah FORGE presentation snapshot", () => {
  validateEnvironment();
  validatePages();
});
