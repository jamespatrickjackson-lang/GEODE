import assert from "node:assert/strict";
import { assertSubset, readJson, runValidation } from "./lib/validation.mjs";

function layerOverride(pageId, layerId) {
  const page = readJson(`projects/utah-forge/pages/${pageId}.json`);
  return page.layerOverrides?.[layerId];
}

function pageVisibility(pageId, layerId) {
  const page = readJson(`projects/utah-forge/pages/${pageId}.json`);
  return page.visibilityOverrides?.[layerId];
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

  assertSubset(
    environment.layerStyles["utah-forge-mt-resistivity-threshold-surfaces"],
    {
      opacity: 0.86,
      mtThresholdSurfaceRoughness: 0.64,
      mtThresholdSurfaceMetalness: 0,
      mtThresholdSurfaceSide: "double",
      mtThresholdSurfaceSmoothNormals: true,
      mtThresholdSurfaceEmissiveBoost: 0.08,
      mtThresholdSurfaceWireframe: false,
    },
    "MT threshold surface style",
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
    assert.equal(
      pageVisibility(pageId, "utah-forge-phase3-seismic-browser"),
      false,
      `${pageId} seismic hidden`,
    );
    assertSubset(
      layerOverride(pageId, "utah-forge-phase3-seismic-browser"),
      {
        opacity: 0,
        seismicLegendVisible: false,
      },
      `${pageId} seismic disabled override`,
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
    layerOverride("53_mt_product_stack_demo", "utah-forge-mt-top-surface"),
    {
      opacity: 0.64,
      meshWireframe: false,
      meshRoughness: 0.7,
    },
    "53 top envelope override",
  );

  const mtLayers = [
    "utah-forge-mt-stations",
    "utah-forge-mt-resistivity-preview",
    "utah-forge-mt-resistivity-full-density",
    "utah-forge-mt-resistivity-volume",
    "utah-forge-mt-resistivity-threshold-surfaces",
    "utah-forge-mt-top-surface",
    "utah-forge-mt-top-contact-surface",
    "utah-forge-mt-resistivity-slices",
  ];
  const standaloneStart = 5;
  const seismicPages = new Set([
    "47_seismic_footprint_velocity_support",
    "49_seismic_fence_panels",
  ]);
  for (const pageId of project.pageOrder.slice(standaloneStart)) {
    if (pageId === "99_unresolved_missing_tools") continue;
    const activeMtLayers = mtLayers.filter(
      (layerId) => pageVisibility(pageId, layerId) === true,
    );
    const seismicVisible =
      pageVisibility(pageId, "utah-forge-phase3-seismic-browser") === true;
    if (seismicPages.has(pageId)) {
      assert.equal(seismicVisible, true, `${pageId} seismic page active`);
      assert.equal(activeMtLayers.length, 0, `${pageId} has no active MT`);
    } else {
      assert.equal(seismicVisible, false, `${pageId} has no active seismic`);
      assert.ok(
        activeMtLayers.length <= 1,
        `${pageId} has at most one active MT product`,
      );
    }
  }
}

runValidation("Utah FORGE presentation snapshot", () => {
  validateEnvironment();
  validatePages();
});
