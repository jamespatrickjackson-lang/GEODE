import assert from "node:assert/strict";
import { assertSubset, readJson, runValidation } from "./lib/validation.mjs";

function layerOverride(pageId, layerId) {
  const page = readJson(`projects/utah-forge/pages/${pageId}.json`);
  return page.layerOverrides?.[layerId];
}

function validateEnvironment() {
  const environment = readJson("projects/utah-forge/environment.json");
  assert.equal(environment.renderPreset, "user-3");
  assert.deepEqual(environment.defaultVisibleLayers, [
    "utah-forge-topo-graticule",
    "utah-forge-site-boundary",
    "utah-forge-phase3-demo-boreholes",
    "utah-forge-mt-resistivity-full-density",
    "terrain",
    "utah-forge-phase3-working-area",
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
      color: "#adadad",
      opacity: 0.95,
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
  const project = readJson("projects/utah-forge/project.json");
  const demoPageOrderIndex = project.pageOrder.indexOf(
    "51_mt_marching_cubes_focused",
  );
  assert.ok(demoPageOrderIndex > -1, "focused Marching Cubes demo page exists");
  assert.deepEqual(
    project.pageOrder.slice(demoPageOrderIndex, demoPageOrderIndex + 3),
    [
      "51_mt_marching_cubes_focused",
      "52_mt_marching_cubes_full_extent",
      "53_mt_product_stack_demo",
    ],
  );

  for (const [pageId, focusMin, focusMax, blendMin, blendMax] of [
    [
      "04_mt_high_resistivity_seismic",
      3.706814235494493,
      4.5,
      3.706814235494493,
      4.5,
    ],
    [
      "05_mt_threshold_focus",
      2.3676704614943205,
      3.315372172975416,
      2.3676704614943205,
      3.315372172975416,
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
    7748.442847693308,
    -80291.83550412979,
    28013.273246632307,
  ]);
  assertSubset(
    page05.dynamicCamera,
    {
      orbitSpeedDegPerSec: 5,
      orbitRadius: 47950,
      pathAwareBlend: true,
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

  assertSubset(
    layerOverride(
      "51_mt_marching_cubes_focused",
      "utah-forge-mt-resistivity-threshold-surfaces",
    ),
    {
      mtIsosurfaceProductId: "mt-isosurface-forge-focused",
      mtThresholdSurfaceVisibility: {
        "conductive-le-10-ohm-m": true,
        "conductive-le-30-ohm-m": true,
        "resistive-ge-1000-ohm-m": false,
      },
    },
    "51 focused isosurface override",
  );
  assertSubset(
    layerOverride(
      "52_mt_marching_cubes_full_extent",
      "utah-forge-mt-resistivity-threshold-surfaces",
    ),
    {
      mtIsosurfaceProductId: "mt-isosurface-full-extent",
      mtThresholdSurfaceVisibility: {
        "conductive-le-10-ohm-m": true,
        "conductive-le-30-ohm-m": true,
        "resistive-ge-1000-ohm-m": true,
      },
    },
    "52 full-extent isosurface override",
  );
  assertSubset(
    layerOverride("53_mt_product_stack_demo", "utah-forge-mt-resistivity-volume"),
    {
      scalarVolumeProductId: "mt-resistivity-forge-focused-volume",
      scalarVolumeTransferMode: "balanced",
      scalarLegendVisible: true,
    },
    "53 product stack volume override",
  );
  assertSubset(
    layerOverride(
      "53_mt_product_stack_demo",
      "utah-forge-mt-resistivity-slices",
    ),
    {
      resistivityHorizontalSlicesVisible: true,
      resistivityVerticalSectionsVisible: true,
      scalarLegendVisible: true,
    },
    "53 product stack slice override",
  );
}

runValidation("Utah FORGE presentation snapshot", () => {
  validateEnvironment();
  validatePages();
});
