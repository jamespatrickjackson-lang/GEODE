import assert from "node:assert/strict";
import {
  assertArrayContainsAll,
  assertCloseTo,
  assertFileExists,
  assertGreaterThan,
  assertGreaterThanOrEqual,
  assertNotContains,
  fileSize,
  readJson,
  runValidation,
} from "./lib/validation.mjs";

const SEISMIC_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_manifest.json";
const SEISMIC_INVENTORY_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/inventory/seismic_source_inventory.json";
const SEISMIC_NAVIGATION_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/navigation/seismic_navigation.geojson";
const SEISMIC_DEMO_RECIPES_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser/seismic_demo_recipes.json";
const SEISMIC_BROWSER_DIR =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/seismic_analysis/browser";
const MT_VOLUME_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/mt_volume_manifest.json";
const MT_FULL_DENSITY_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/full_density/manifest.json";
const MT_TOP_SURFACE_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_surface/manifest.json";
const MT_TOP_SURFACE_MESH_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_surface/mt_top_surface_mesh_preview.json";
const MT_THRESHOLD_SURFACES_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json";
const MT_STATION_QC_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/stations/mt_station_response_qc.json";
const PUBLIC_CONTEXT_DIR =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context";
const PUBLIC_CONTEXT_MANIFEST_PATH = `${PUBLIC_CONTEXT_DIR}/manifest.json`;

function layerById(project, id) {
  const layer = project.layers.find((candidate) => candidate.id === id);
  assert.ok(layer, `Utah FORGE layer should exist: ${id}`);
  return layer;
}

function validateProjectLayerWiring(project) {
  const seismicLayer = layerById(project, "utah-forge-phase3-seismic-browser");
  const mtVolumeLayer = layerById(project, "utah-forge-mt-resistivity-volume");
  const mtFullDensityLayer = layerById(
    project,
    "utah-forge-mt-resistivity-full-density",
  );
  const mtThresholdLayer = layerById(
    project,
    "utah-forge-mt-resistivity-threshold-surfaces",
  );
  const mtTopSurfaceLayer = layerById(project, "utah-forge-mt-top-surface");
  const workingAreaLayer = layerById(project, "utah-forge-phase3-working-area");
  const publicTerrainLayer = layerById(project, "terrain");
  const publicRoadsLayer = layerById(project, "transport-roads");
  const publicStreamsLayer = layerById(project, "hydrography-streams");
  const publicWaterLayer = layerById(project, "hydrography-lakes");

  assert.equal(seismicLayer.type, "seismic");
  assert.equal(seismicLayer.previewFiles?.seismicManifest, SEISMIC_MANIFEST_PATH);
  assert.equal(
    seismicLayer.previewFiles?.seismicDemoRecipes,
    SEISMIC_DEMO_RECIPES_PATH,
  );
  assert.equal(workingAreaLayer.type, "line");
  assert.equal(publicTerrainLayer.type, "geotiff");
  assert.equal(
    publicTerrainLayer.files?.raster,
    `${PUBLIC_CONTEXT_DIR}/terrain_public_context_1000m.tif`,
  );
  assert.equal(publicRoadsLayer.type, "line");
  assert.equal(
    publicRoadsLayer.files?.geojson,
    `${PUBLIC_CONTEXT_DIR}/roads.geojson`,
  );
  assert.equal(publicStreamsLayer.type, "line");
  assert.equal(
    publicStreamsLayer.files?.geojson,
    `${PUBLIC_CONTEXT_DIR}/hydrography_streams.geojson`,
  );
  assert.equal(
    publicStreamsLayer.files?.lakesGeojson,
    `${PUBLIC_CONTEXT_DIR}/hydrography_lakes.geojson`,
  );
  assert.equal(publicWaterLayer.type, "polygon");
  assert.equal(
    publicWaterLayer.files?.geojson,
    `${PUBLIC_CONTEXT_DIR}/hydrography_lakes.geojson`,
  );

  for (const layer of [
    publicTerrainLayer,
    publicRoadsLayer,
    publicStreamsLayer,
    publicWaterLayer,
  ]) {
    const geoTransform = layer.metadata?.geoTransform;
    assert.equal(geoTransform?.sourceCrs, "EPSG:26912");
    assertCloseTo(
      geoTransform?.sceneOriginUtm?.easting_m,
      341467.35,
      2,
      `${layer.id} origin easting`,
    );
    assertCloseTo(
      geoTransform?.sceneOriginUtm?.northing_m,
      4273374.5,
      2,
      `${layer.id} origin northing`,
    );
    assert.deepEqual(geoTransform?.bounds?.min?.slice(0, 2), [-356385.9, 3703652]);
    assert.deepEqual(geoTransform?.bounds?.max?.slice(0, 2), [1039320.6, 4843097]);
  }

  const workingArea = workingAreaLayer.metadata?.phase3WorkingArea;
  assert.equal(workingArea?.footprintWidthM, 4200);
  assert.equal(workingArea?.footprintHeightM, 4200);
  assert.deepEqual(workingArea?.sceneBounds?.min, [-8041.4, -12617.6, -6200]);
  assert.deepEqual(workingArea?.sceneBounds?.max, [-3841.4, -8417.6, 2045.3]);
  assert.equal(workingArea?.source3dNavigationEnvelope?.pointCount, 1386);

  assert.equal(mtVolumeLayer.type, "volume");
  assert.equal(
    mtVolumeLayer.previewFiles?.scalarVolumeManifest,
    MT_VOLUME_MANIFEST_PATH,
  );
  assert.equal(mtFullDensityLayer.type, "pointcloud");
  assert.equal(
    mtFullDensityLayer.previewFiles?.previewTiles,
    MT_FULL_DENSITY_MANIFEST_PATH,
  );
  assert.equal(mtThresholdLayer.type, "mesh");
  assert.equal(mtThresholdLayer.previewFiles?.meshPreview, MT_THRESHOLD_SURFACES_PATH);
  assert.equal(mtTopSurfaceLayer.type, "mesh");
  assert.equal(mtTopSurfaceLayer.previewFiles?.meshPreview, MT_TOP_SURFACE_MESH_PATH);

  for (const layer of project.layers) {
    for (const target of Object.values(layer.previewFiles ?? {})) {
      assertNotContains(target, "client_preprocessed", `${layer.id} preview file`);
      assertFileExists(target, `${layer.id} preview file`);
    }
  }

  for (const product of seismicLayer.metadata?.seismicProducts ?? []) {
    assert.doesNotMatch(product.label ?? "", /Forge\s*3D|Forge3d/i);
  }

  return seismicLayer;
}

function validatePublicContext() {
  for (const path of [
    `${PUBLIC_CONTEXT_DIR}/terrain_public_context_1000m.tif`,
    `${PUBLIC_CONTEXT_DIR}/roads.geojson`,
    `${PUBLIC_CONTEXT_DIR}/hydrography_streams.geojson`,
    `${PUBLIC_CONTEXT_DIR}/hydrography_lakes.geojson`,
    PUBLIC_CONTEXT_MANIFEST_PATH,
  ]) {
    assertFileExists(path);
  }

  const manifest = readJson(PUBLIC_CONTEXT_MANIFEST_PATH);
  assert.equal(manifest.schema, "geosee.utah-forge-public-context.v1");
  assert.equal(manifest.targetCrs, "EPSG:26912");
  assert.deepEqual(manifest.sourceBounds.easting_m, [-356385.9, 1039320.6]);
  assert.deepEqual(manifest.sourceBounds.northing_m, [3703652, 4843097]);
  assert.equal(manifest.terrain.resolutionM, 1000);
  assertGreaterThan(manifest.terrain.width, 1000, "public terrain width");
  assertGreaterThan(manifest.terrain.height, 900, "public terrain height");
  assertGreaterThan(manifest.vectors.roads.renderFeatureCount, 0, "roads features");
  assertGreaterThan(manifest.vectors.streams.renderFeatureCount, 0, "stream features");
  assertGreaterThan(
    manifest.vectors.waterbodies.renderFeatureCount,
    0,
    "waterbody features",
  );
}

function validateMtProducts() {
  const manifest = readJson(MT_VOLUME_MANIFEST_PATH);
  assert.equal(manifest.schema, "geosee.scalar-volume.v1");
  assertArrayContainsAll(
    manifest.products.map((product) => product.id),
    ["mt-resistivity-full-extent-volume", "mt-resistivity-forge-focused-volume"],
    "MT volume products",
  );

  for (const product of manifest.products) {
    assert.match(product.classification, /source-derived/);
    const voxelCount = product.dimensions.reduce((acc, value) => acc * value, 1);
    const volumePath =
      "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/" +
      product.files.volume;
    const maskPath =
      "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/" +
      product.files.mask;

    assertFileExists(volumePath, `${product.id} volume`);
    assertFileExists(maskPath, `${product.id} mask`);
    assert.equal(fileSize(volumePath), voxelCount, `${product.id} volume byte count`);
    assert.equal(fileSize(maskPath), voxelCount, `${product.id} mask byte count`);
    assertNotContains(product.files.volume, "client_preprocessed", `${product.id} volume`);
    assertNotContains(product.files.mask, "client_preprocessed", `${product.id} mask`);
  }

  assert.equal(
    manifest.thresholdSurfaces.file,
    "threshold_surfaces/mt_threshold_surfaces_mesh_preview.json",
  );
  assert.equal(manifest.thresholdSurfaces.surfaces.length, 3);
  assertArrayContainsAll(
    manifest.thresholdSurfaces.surfaces.map((surface) => surface.id),
    ["conductive-le-10-ohm-m", "conductive-le-30-ohm-m", "resistive-ge-1000-ohm-m"],
    "MT threshold surfaces",
  );

  const thresholdMesh = readJson(MT_THRESHOLD_SURFACES_PATH);
  assert.equal(thresholdMesh.processing.thresholdSurfaces.length, 3);
  assertGreaterThan(thresholdMesh.vertices.length, 0, "threshold mesh vertices");
  assertGreaterThan(thresholdMesh.indices.length, 0, "threshold mesh indices");

  const stationQc = readJson(MT_STATION_QC_PATH);
  assert.equal(stationQc.schema, "geosee.mt-station-qc.v1");
  assert.equal(stationQc.stationCount, 122);
  assert.equal(stationQc.ediFileCount, 244);
  assert.equal(stationQc.responseCurveStations, 0);
  assert.match(
    stationQc.stations[0].qc.responseCurveStatus,
    /curves unavailable from source EDI/,
  );

  const topSurfaceManifest = readJson(MT_TOP_SURFACE_MANIFEST_PATH);
  assert.match(topSurfaceManifest.classification, /full-density/);
  assert.match(topSurfaceManifest.classification, /top-contact/);
  assert.equal(
    topSurfaceManifest.source?.fullDensityManifest,
    MT_FULL_DENSITY_MANIFEST_PATH,
  );
  assert.equal(
    topSurfaceManifest.outputs?.meshPreview,
    MT_TOP_SURFACE_MESH_PATH,
  );
  assert.equal(topSurfaceManifest.processing?.sourceFullDensityPointCount, 1_094_624);
  assertGreaterThan(
    topSurfaceManifest.processing?.vertexCount,
    2_000,
    "MT top-contact vertices",
  );
  assertGreaterThan(
    topSurfaceManifest.processing?.triangleCount,
    2_000,
    "MT top-contact triangles",
  );

  const topSurfaceMesh = readJson(MT_TOP_SURFACE_MESH_PATH);
  assert.equal(topSurfaceMesh.schema, "geosee.mesh-preview.v1");
  assert.match(topSurfaceMesh.label, /full-density top-contact/);
  assert.equal(
    topSurfaceMesh.source?.fullDensityManifest,
    MT_FULL_DENSITY_MANIFEST_PATH,
  );
  assertGreaterThan(topSurfaceMesh.vertices.length / 3, 2_000, "MT top surface mesh vertices");
  assertGreaterThan(topSurfaceMesh.indices.length / 3, 2_000, "MT top surface mesh triangles");
  assertNotContains(
    JSON.stringify(topSurfaceManifest),
    "resistivity_point_preview",
    "MT top-contact manifest",
  );
  assertNotContains(
    JSON.stringify(topSurfaceMesh),
    "90,000-point",
    "MT top-contact mesh",
  );
}

function validateSeismicProducts(seismicLayer) {
  const manifest = readJson(SEISMIC_MANIFEST_PATH);
  assert.equal(manifest.schema, "geosee.seismic-browser.v1");
  assert.equal(manifest.products.length, 34);
  assert.equal(manifest.navigation.geojson, SEISMIC_NAVIGATION_PATH);
  assertGreaterThan(manifest.navigation.pointCount, 1_000, "seismic navigation point count");
  assert.match(manifest.crs.primarySourceCrs, /EPSG:26912/);
  assert.match(manifest.crs.legacySourceCrs, /EPSG:32043/);
  assert.equal(manifest.products.some((product) => product.surveyKind === "3d"), true);
  assert.equal(
    manifest.products.some((product) => product.surveyKind === "legacy-2d"),
    true,
  );
  assert.equal(
    manifest.products.some((product) => product.sourceSubmission === "GDR 1015"),
    true,
  );
  assert.equal(
    manifest.products.some((product) => product.sourceSubmission === "GDR 1141"),
    true,
  );
  assert.equal(
    manifest.products.some((product) => product.productKind === "velocity"),
    true,
  );
  assert.equal(
    manifest.products.filter((product) => Boolean(product.raymarchVolume)).length,
    4,
  );

  assertArrayContainsAll(
    manifest.displayRecipes?.map((recipe) => recipe.id),
    [
      "investor-story",
      "3d-seismic-showcase",
      "2d-line-theatre",
      "integrated-geophysics",
      "confidence-provenance",
      "regulatory-export-pack",
    ],
    "seismic display recipes",
  );
  assertArrayContainsAll(
    manifest.audiencePresets?.map((preset) => preset.id),
    [
      "investor-overview-volume",
      "line-theatre-301",
      "integrated-geophysics",
      "data-room-inventory",
      "export-line-301-section",
    ],
    "seismic audience presets",
  );
  assertArrayContainsAll(
    manifest.capabilityPresets?.map((preset) => preset.id),
    [
      "3d-volume-psdm-depth",
      "3d-volume-pstm-time",
      "3d-volume-fxydecon",
      "3d-velocity-volume",
      "inline-slice",
      "crossline-slice",
      "time-depth-plane",
      "volume-slice-sync",
      "line-301-theatre",
      "line-302-theatre",
      "legacy-l5-l11-theatre",
      "enhanced-vs-unenhanced",
      "survey-geometry",
      "integrated-geophysics",
    ],
    "seismic capability presets",
  );
  assert.equal(manifest.capabilityPresets.length, 14);

  const velocityProduct = manifest.products.find(
    (product) => product.id === "gdr-1015-forge3d-velo5d-float-01312018",
  );
  assert.equal(velocityProduct?.productKind, "velocity");
  assert.deepEqual(velocityProduct?.raymarchVolume?.dimensions, [19, 19, 64]);
  assertGreaterThan(velocityProduct?.amplitudeStats?.p98, 5_000, "velocity p98");
  const velocityPreset = manifest.capabilityPresets?.find(
    (preset) => preset.id === "3d-velocity-volume",
  );
  assert.equal(velocityPreset?.productId, "gdr-1015-forge3d-velo5d-float-01312018");
  assert.equal(velocityPreset?.renderMode, "raymarch");
  assert.equal(velocityPreset?.colormap, "velocity");

  assert.equal(
    manifest.audiencePresets?.some(
      (preset) =>
        preset.id === "investor-overview-volume" &&
        preset.renderMode === "raymarch" &&
        preset.sliceThroughVolume === true,
    ),
    true,
  );
  assert.equal(
    manifest.audiencePresets?.every((preset) =>
      preset.caveats?.includes("not a mineral resource estimate"),
    ),
    true,
  );
  assert.equal(
    manifest.derivedViews?.every(
      (view) =>
        view.status === "planned-experimental" &&
        view.reviewStatus === "requires-geophysicist-review",
    ),
    true,
  );
  assert.equal(
    manifest.interpretationLayers?.every((layer) => layer.status === "planned"),
    true,
  );
  assert.equal(
    manifest.interpretationLayers?.some((layer) =>
      layer.caveat?.toLowerCase().includes("auto-labeled"),
    ),
    true,
  );
  assert.equal(
    manifest.exportLayouts?.some(
      (layout) =>
        layout.id === "qp-report-support-layout" &&
        layout.includes?.includes("CRS") &&
        layout.caveat?.includes("NI 43-101"),
    ),
    true,
  );

  const productIds = new Set(manifest.products.map((product) => product.id));
  for (const preset of manifest.audiencePresets ?? []) {
    assert.equal(productIds.has(preset.productId), true, `${preset.id} productId`);
    for (const visibleProductId of preset.visibleProductIds ?? []) {
      assert.equal(productIds.has(visibleProductId), true, `${preset.id} visibleProductId`);
    }
  }
  for (const preset of manifest.capabilityPresets ?? []) {
    assert.equal(productIds.has(preset.productId), true, `${preset.id} productId`);
    for (const visibleProductId of preset.visibleProductIds ?? []) {
      assert.equal(productIds.has(visibleProductId), true, `${preset.id} visibleProductId`);
    }
    if (preset.comparisonProductId) {
      assert.equal(
        productIds.has(preset.comparisonProductId),
        true,
        `${preset.id} comparisonProductId`,
      );
    }
  }

  for (const product of manifest.products) {
    assert.doesNotMatch(product.label, /forge/i);
    assert.match(product.label, /^(2D|3D)\b/);
    assert.equal(product.provenance?.sourceFile, product.sourceFile);
    assertGreaterThan(product.sections.length, 0, `${product.id} sections`);
    assertGreaterThan(
      product.amplitudeStats?.max,
      product.amplitudeStats?.min ?? Number.NEGATIVE_INFINITY,
      `${product.id} amplitude max`,
    );
    assertGreaterThan(
      product.amplitudeStats?.p98,
      product.amplitudeStats?.p02 ?? Number.NEGATIVE_INFINITY,
      `${product.id} amplitude p98`,
    );
    assertNotContains(product.sourceFile.toLowerCase(), "raw_shot_gathers", product.id);
    assertNotContains(product.sourceFile.toLowerCase(), "uncorrelated", product.id);
    assertNotContains(product.sourceFile.toLowerCase(), "correlated", product.id);

    for (const section of product.sections) {
      assertGreaterThan(
        section.amplitudeStats?.max,
        section.amplitudeStats?.min ?? Number.NEGATIVE_INFINITY,
        `${product.id} section amplitude max`,
      );
      assertGreaterThan(
        section.amplitudeStats?.p98,
        section.amplitudeStats?.p02 ?? Number.NEGATIVE_INFINITY,
        `${product.id} section amplitude p98`,
      );
      assertFileExists(`${SEISMIC_BROWSER_DIR}/${section.amplitudeFile}`);
    }

    if (product.raymarchVolume) {
      assert.equal(product.raymarchVolume.dimensions.every((dim) => dim > 1), true);
      assertFileExists(`${SEISMIC_BROWSER_DIR}/${product.raymarchVolume.file}`);
    }
  }

  const navigation = readJson(SEISMIC_NAVIGATION_PATH);
  assertGreaterThan(navigation.features.length, 1_000, "seismic navigation features");
  assertGreaterThan(
    navigation.features.filter((feature) => feature.properties?.role === "source").length,
    500,
    "seismic navigation sources",
  );
  assertGreaterThan(
    navigation.features.filter((feature) => feature.properties?.role === "receiver").length,
    400,
    "seismic navigation receivers",
  );
  assertGreaterThan(
    navigation.features.filter((feature) => feature.geometry?.type === "LineString").length,
    10,
    "seismic navigation lines",
  );

  const demoRecipes = readJson(SEISMIC_DEMO_RECIPES_PATH);
  assert.equal(demoRecipes.schema, "geosee.seismic-demo-recipes.v1");
  assert.equal(demoRecipes.productCount, 34);
  assert.equal(demoRecipes.raymarchProductCount, 4);
  assertArrayContainsAll(
    demoRecipes.disclosureLabels,
    [
      "public geothermal demo data",
      "processed seismic product",
      "not a mineral resource estimate",
    ],
    "seismic disclosure labels",
  );
  assertGreaterThanOrEqual(demoRecipes.audiencePresets.length, 8, "audience preset count");
  assert.equal(demoRecipes.capabilityPresets.length, 14);
  assertGreaterThanOrEqual(demoRecipes.exportLayouts.length, 3, "export layout count");

  assertGreaterThanOrEqual(
    seismicLayer.metadata?.seismicAudiencePresets?.length,
    8,
    "project audience presets",
  );
  assert.equal(seismicLayer.metadata?.seismicCapabilityPresets?.length, 14);
  const projectVelocityProduct = seismicLayer.metadata?.seismicProducts?.find(
    (product) => product.id === "gdr-1015-forge3d-velo5d-float-01312018",
  );
  assertGreaterThan(
    projectVelocityProduct?.amplitudeStats?.p98,
    5_000,
    "project velocity p98",
  );
  assert.deepEqual(projectVelocityProduct?.raymarchVolume?.dimensions, [19, 19, 64]);

  const inventory = readJson(SEISMIC_INVENTORY_PATH);
  assertGreaterThan(
    inventory.normalization.skippedRawGatherFileCount,
    0,
    "skipped raw gather count",
  );
}

runValidation("Utah FORGE derived assets", () => {
  const project = readJson("projects/utah-forge/project.json");
  const seismicLayer = validateProjectLayerWiring(project);
  validatePublicContext();
  validateMtProducts();
  validateSeismicProducts(seismicLayer);
});
