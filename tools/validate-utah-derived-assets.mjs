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
const MT_TOP_CONTACT_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_contact_surface/manifest.json";
const MT_TOP_CONTACT_MESH_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_contact_surface/mt_top_contact_surface_mesh_preview.json";
const MT_TOP_ENVELOPE_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_envelope_surface/manifest.json";
const MT_TOP_ENVELOPE_MESH_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_envelope_surface/mt_top_envelope_surface_mesh_preview.json";
const MT_TOP_ENVELOPE_STATS_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/top_envelope_surface/stats.json";
const MT_THRESHOLD_SURFACES_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json";
const MT_STATION_QC_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/stations/mt_station_response_qc.json";
const PUBLIC_CONTEXT_DIR =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context";
const PUBLIC_CONTEXT_MANIFEST_PATH = `${PUBLIC_CONTEXT_DIR}/manifest.json`;

function stripAssetQuery(assetPath) {
  return String(assetPath).split("?")[0];
}

function layerById(project, id) {
  const layer = project.layers.find((candidate) => candidate.id === id);
  assert.ok(layer, `Utah FORGE layer should exist: ${id}`);
  return layer;
}

const REGISTRATION_FIELD_NAMES = [
  "horizontalCrs",
  "verticalDatum",
  "units",
  "coordinateBasis",
  "origin",
  "rotationDeg",
  "registrationStatus",
];

const REGISTRATION_COORDINATE_BASES = new Set([
  "utm",
  "latlon",
  "local-mesh",
  "model-origin",
]);

const REGISTRATION_STATUSES = new Set(["unverified", "validated"]);
const NAVIGATION_SOURCES = new Set(["delivered", "digitized", "fallback"]);
const PLACEMENT_ACCURACY_VALUES = new Set(["validated", "approximate", "unknown"]);

function validateRegistrationMetadata(context, registration) {
  assert.ok(registration && typeof registration === "object", `${context} registration`);
  for (const field of REGISTRATION_FIELD_NAMES) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(registration, field),
      `${context} registration missing ${field}`,
    );
  }
  assert.equal(typeof registration.horizontalCrs, "string", `${context} horizontal CRS`);
  assert.ok(registration.horizontalCrs.length > 0, `${context} horizontal CRS`);
  assert.equal(typeof registration.verticalDatum, "string", `${context} vertical datum`);
  assert.ok(registration.verticalDatum.length > 0, `${context} vertical datum`);
  assert.equal(registration.units, "m", `${context} units`);
  assert.equal(
    REGISTRATION_COORDINATE_BASES.has(registration.coordinateBasis),
    true,
    `${context} coordinate basis`,
  );
  assert.ok(registration.origin && typeof registration.origin === "object", `${context} origin`);
  assert.equal(typeof registration.rotationDeg, "number", `${context} rotationDeg`);
  assert.equal(
    REGISTRATION_STATUSES.has(registration.registrationStatus),
    true,
    `${context} registration status`,
  );
  if (registration.registrationStatus === "validated") {
    assert.ok(
      Array.isArray(registration.controlPoints) && registration.controlPoints.length > 0,
      `${context} validated registration requires control points`,
    );
  }
  if (
    registration.coordinateBasis === "local-mesh" ||
    registration.coordinateBasis === "model-origin"
  ) {
    assert.ok(registration.origin, `${context} local/model registration requires origin`);
    assert.equal(typeof registration.rotationDeg, "number", `${context} local/model rotation`);
  }
}

function validateProjectRegistration(project) {
  validateRegistrationMetadata("project registrationFrame", project.registrationFrame);
  for (const layer of project.layers) {
    validateRegistrationMetadata(
      `layer ${layer.id}`,
      layer.metadata?.crsRegistration,
    );
  }
}

function validateSeismicNavigationPlacement(context, placement) {
  assert.ok(placement && typeof placement === "object", `${context} navigation placement`);
  assert.equal(
    NAVIGATION_SOURCES.has(placement.navigationSource),
    true,
    `${context} navigation source`,
  );
  assert.equal(
    PLACEMENT_ACCURACY_VALUES.has(placement.placementAccuracy),
    true,
    `${context} placement accuracy`,
  );
  assert.equal(
    typeof placement.canClaimPreciseRegistration,
    "boolean",
    `${context} precise-registration flag`,
  );
  if (placement.navigationSource === "fallback") {
    assert.notEqual(placement.placementAccuracy, "validated", `${context} fallback not validated`);
    assert.equal(
      placement.canClaimPreciseRegistration,
      false,
      `${context} fallback cannot claim precise registration`,
    );
    assert.notEqual(
      placement.placementAccuracy,
      "validated",
      `${context} fallback placement must not be validated`,
    );
    assert.match(
      placement.statusLabel ?? "",
      /Approximate legacy line placement/,
      `${context} fallback status label`,
    );
    assert.ok(
      Array.isArray(placement.validationPath) && placement.validationPath.length > 0,
      `${context} fallback validation path`,
    );
  }
}

function validateProjectLayerWiring(project) {
  validateProjectRegistration(project);

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
  const mtTopContactLayer = layerById(project, "utah-forge-mt-top-contact-surface");
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
  assert.deepEqual(workingArea?.sceneBounds?.max, [-3841.4, -8417.6, 1800]);
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
  assert.equal(mtTopSurfaceLayer.previewFiles?.meshPreview, MT_TOP_ENVELOPE_MESH_PATH);
  assert.equal(mtTopSurfaceLayer.supportFiles?.manifest, MT_TOP_ENVELOPE_MANIFEST_PATH);
  assert.equal(mtTopSurfaceLayer.supportFiles?.stats, MT_TOP_ENVELOPE_STATS_PATH);
  assert.match(mtTopSurfaceLayer.metadata?.classification ?? "", /observed top-envelope/);
  assert.match(mtTopSurfaceLayer.metadata?.notes ?? "", /observed full-density MT top-envelope/);
  assert.match(mtTopSurfaceLayer.metadata?.notes ?? "", /fidelity coarsens/);
  assert.equal(mtTopContactLayer.type, "mesh");
  assert.equal(mtTopContactLayer.previewFiles?.meshPreview, MT_TOP_CONTACT_MESH_PATH);

  for (const layer of project.layers) {
    for (const target of Object.values(layer.previewFiles ?? {})) {
      assertNotContains(target, "client_preprocessed", `${layer.id} preview file`);
      assertFileExists(target, `${layer.id} preview file`);
    }
  }

  for (const product of seismicLayer.metadata?.seismicProducts ?? []) {
    assert.doesNotMatch(product.label ?? "", /Forge\s*3D|Forge3d/i);
    validateSeismicNavigationPlacement(
      `project seismic product ${product.id}`,
      product.navigationPlacement,
    );
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
  assert.equal(manifest.terrain.file, "terrain_public_context_1000m.tif");
  assert.equal(manifest.terrain.resolutionM, 1000);
  assert.equal(manifest.terrain.width, 1396);
  assert.equal(manifest.terrain.height, 1140);
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
  assert.equal(
    manifest.thresholdSurfaces.defaultProductId,
    "mt-isosurface-forge-focused",
  );
  assertArrayContainsAll(
    manifest.thresholdSurfaces.products.map((product) => product.id),
    ["mt-isosurface-full-extent", "mt-isosurface-forge-focused"],
    "MT isosurface products",
  );
  const expectedPerProductBoundaryCount = 23;
  assert.equal(manifest.thresholdSurfaces.surfaces.length, expectedPerProductBoundaryCount * 2);
  assertArrayContainsAll(
    manifest.thresholdSurfaces.surfaces.map((surface) => surface.id),
    ["conductive-le-10-ohm-m", "conductive-le-30-ohm-m", "resistive-ge-1000-ohm-m"],
    "MT threshold surfaces",
  );

  const thresholdMesh = readJson(MT_THRESHOLD_SURFACES_PATH);
  assert.equal(
    thresholdMesh.processing.extractionMethod,
    "mask-aware-marching-cubes",
  );
  assert.equal(
    thresholdMesh.processing.boundaryBank?.intervalCount,
    20,
    "MT precomputed boundary bank count",
  );
  assert.equal(
    thresholdMesh.processing.thresholdSurfaces.length,
    expectedPerProductBoundaryCount * 2,
  );
  assertArrayContainsAll(
    thresholdMesh.processing.isosurfaceProducts.map((product) => product.id),
    ["mt-isosurface-full-extent", "mt-isosurface-forge-focused"],
    "MT threshold mesh products",
  );
  for (const surface of thresholdMesh.processing.thresholdSurfaces) {
    assert.equal(surface.extractionMethod, "mask-aware-marching-cubes");
    assertFileExists(
      "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/" +
        surface.assetFile,
      `${surface.meshId} boundary asset`,
    );
    assertGreaterThan(surface.marchingCubes?.triangleCount, 0, `${surface.meshId} triangles`);
    assertGreaterThan(surface.marchingCubes?.vertexCount, 0, `${surface.meshId} vertices`);
    assert.equal(surface.smoothing?.method, "taubin-laplacian");
    assert.equal(surface.normalPolicy, "runtime-computed-smooth-vertex-normals");
  }
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

  const retainedPreviewGroundCapManifest = readJson(MT_TOP_SURFACE_MANIFEST_PATH);
  assert.match(retainedPreviewGroundCapManifest.classification, /preview ground cap/);
  assert.equal(
    retainedPreviewGroundCapManifest.source?.sourcePreview,
    "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/resistivity_point_preview.json",
  );
  assert.equal(retainedPreviewGroundCapManifest.processing?.sourcePreviewPointCount, 90_000);
  assert.equal(retainedPreviewGroundCapManifest.processing?.vertexCount, 1_135);
  assert.equal(retainedPreviewGroundCapManifest.processing?.triangleCount, 1_844);
  assert.equal(
    retainedPreviewGroundCapManifest.outputs?.meshPreview,
    MT_TOP_SURFACE_MESH_PATH,
  );

  const topContactManifest = readJson(MT_TOP_CONTACT_MANIFEST_PATH);
  assert.match(topContactManifest.classification, /full-density/);
  assert.match(topContactManifest.classification, /top-contact/);
  assert.equal(
    topContactManifest.source?.fullDensityManifest,
    MT_FULL_DENSITY_MANIFEST_PATH,
  );
  assert.equal(
    topContactManifest.outputs?.meshPreview,
    MT_TOP_CONTACT_MESH_PATH,
  );
  assert.equal(topContactManifest.processing?.sourceFullDensityPointCount, 1_094_624);
  assert.equal(topContactManifest.processing?.supportGridColumns, 113);
  assert.equal(topContactManifest.processing?.supportGridRows, 93);
  assert.equal(topContactManifest.processing?.observedSupportNodeCount, 2_164);
  assert.equal(topContactManifest.processing?.inferredSupportNodeCount, 8_345);
  assertGreaterThan(
    topContactManifest.processing?.vertexCount,
    10_000,
    "MT top-contact vertices",
  );
  assertGreaterThan(
    topContactManifest.processing?.triangleCount,
    20_000,
    "MT top-contact triangles",
  );
  assert.match(topContactManifest.processing?.topologyInference, /full-density data-point XY extent/);
  assert.match(topContactManifest.processing?.notes?.join("\n") ?? "", /quality and confidence reduce/);

  const topContactMesh = readJson(MT_TOP_CONTACT_MESH_PATH);
  assert.equal(topContactMesh.schema, "geosee.mesh-preview.v1");
  assert.match(topContactMesh.label, /full-density top-contact/);
  assert.equal(
    topContactMesh.source?.fullDensityManifest,
    MT_FULL_DENSITY_MANIFEST_PATH,
  );
  assertGreaterThan(
    topContactMesh.vertices.length / 3,
    10_000,
    "MT top-contact mesh vertices",
  );
  assertGreaterThan(
    topContactMesh.indices.length / 3,
    20_000,
    "MT top-contact mesh triangles",
  );
  assertNotContains(
    JSON.stringify(topContactManifest),
    "resistivity_point_preview",
    "MT top-contact manifest",
  );
  assertNotContains(
    JSON.stringify(topContactMesh),
    "90,000-point",
    "MT top-contact mesh",
  );

  const topEnvelopeManifest = readJson(MT_TOP_ENVELOPE_MANIFEST_PATH);
  assert.match(topEnvelopeManifest.classification, /observed top-envelope/);
  assert.equal(
    topEnvelopeManifest.source?.fullDensityManifest,
    MT_FULL_DENSITY_MANIFEST_PATH,
  );
  assert.equal(
    topEnvelopeManifest.outputs?.meshPreview,
    MT_TOP_ENVELOPE_MESH_PATH,
  );
  assert.equal(topEnvelopeManifest.processing?.sourceFullDensityPointCount, 1_094_624);
  assert.equal(topEnvelopeManifest.processing?.observedTopPointCount, 24_332);
  assert.equal(topEnvelopeManifest.processing?.renderedVertexCount, 23_811);
  assert.equal(topEnvelopeManifest.processing?.unusedObservedTopPointCount, 521);
  assert.equal(topEnvelopeManifest.processing?.retainedTriangleCount, 46_283);
  assert.equal(topEnvelopeManifest.processing?.droppedBridgeTriangleCount, 2_361);
  assert.equal(topEnvelopeManifest.processing?.maxBridgeEdgeM, 10_000);
  assert.ok(
    topEnvelopeManifest.processing?.edgeStats?.retainedEdgeLengthM?.max <= 10_000,
    "MT top-envelope retained edges should stay inside bridge cutoff",
  );
  assert.match(topEnvelopeManifest.processing?.topology ?? "", /observed top points only/);
  assert.match(topEnvelopeManifest.processing?.topology ?? "", /No rectangular support grid/);
  assert.match(topEnvelopeManifest.processing?.notes?.join("\n") ?? "", /fidelity follows observed MT top-point support/);

  const topEnvelopeStats = readJson(MT_TOP_ENVELOPE_STATS_PATH);
  assert.equal(topEnvelopeStats.source?.fullDensityPointCount, 1_094_624);
  assert.equal(topEnvelopeStats.processing?.observedTopPointCount, 24_332);
  assert.equal(topEnvelopeStats.processing?.renderedVertexCount, 23_811);
  assert.equal(topEnvelopeStats.processing?.retainedTriangleCount, 46_283);
  assert.equal(topEnvelopeStats.processing?.droppedBridgeTriangleCount, 2_361);
  assert.equal(topEnvelopeStats.processing?.elevationColorRamp?.minM, 1500);
  assert.equal(topEnvelopeStats.processing?.elevationColorRamp?.maxM, 3500);

  const topEnvelopeMesh = readJson(MT_TOP_ENVELOPE_MESH_PATH);
  assert.equal(topEnvelopeMesh.schema, "geosee.mesh-preview.v1");
  assert.match(topEnvelopeMesh.label, /observed top-envelope/);
  assert.equal(topEnvelopeMesh.material?.flatShading, true);
  assert.equal(
    topEnvelopeMesh.source?.fullDensityManifest,
    MT_FULL_DENSITY_MANIFEST_PATH,
  );
  assert.equal(topEnvelopeMesh.vertices.length / 3, 23_811);
  assert.equal(topEnvelopeMesh.indices.length / 3, 46_283);
  assert.equal(topEnvelopeMesh.attributes?.scalarValues?.length, 23_811);
  assert.equal(topEnvelopeMesh.attributes?.columnPointCounts?.length, 23_811);
  assert.equal(topEnvelopeMesh.processing?.elevationColorRamp?.minM, 1500);
  assert.equal(topEnvelopeMesh.processing?.elevationColorRamp?.maxM, 3500);
  assert.match(topEnvelopeMesh.processing?.topology ?? "", /No rectangular support grid/);
}

function validateSeismicProducts(seismicLayer) {
  const manifest = readJson(SEISMIC_MANIFEST_PATH);
  assert.equal(manifest.schema, "geosee.seismic-browser.v1");
  assert.equal(manifest.products.length, 34);
  assert.equal(manifest.navigation.geojson, SEISMIC_NAVIGATION_PATH);
  assertGreaterThan(manifest.navigation.pointCount, 1_000, "seismic navigation point count");
  assert.match(manifest.crs.primarySourceCrs, /EPSG:26912/);
  assert.match(manifest.crs.legacySourceCrs, /EPSG:32043/);
  assert.equal(manifest.crs.registrationStatus, "unverified");
  validateRegistrationMetadata("seismic manifest crs", manifest.crs.registration);
  validateRegistrationMetadata("seismic manifest navigation", manifest.navigation.registration);
  assertArrayContainsAll(
    manifest.crs.transformPipeline ?? [],
    [
      "source coordinates require declared source CRS",
      "source coordinates are transformed into EPSG:26912 before scene-local conversion",
      "GeoSee project origin is subtracted after CRS transformation",
    ],
    "seismic manifest CRS transform pipeline",
  );
  assert.equal(manifest.sampleDomain?.referenceDatumM, 1800);
  assert.equal(manifest.verticalReference?.referenceDatumM, 1800);
  assert.match(manifest.verticalReference?.transform ?? "", /datumM - sample/);
  assert.equal(
    manifest.verticalReference?.calibration?.expectedDepthConversionErrorM,
    20,
  );
  assert.deepEqual(
    manifest.valueEncoding?.velocity?.displayRangeMPerS,
    [2000, 5000],
  );
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
  const baseSeismicCapabilityIds = [
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
  ];
  const requiredLineCatalogPresetIds = manifest.products
    .filter((product) => ["301", "302", "L11", "L5"].includes(product.lineId))
    .map((product) => `seismic-product-${product.id}`);
  assertArrayContainsAll(
    manifest.capabilityPresets?.map((preset) => preset.id),
    [...baseSeismicCapabilityIds, ...requiredLineCatalogPresetIds],
    "seismic capability presets",
  );
  assertGreaterThanOrEqual(
    manifest.capabilityPresets.length,
    baseSeismicCapabilityIds.length + requiredLineCatalogPresetIds.length,
    "seismic capability preset count",
  );

  const velocityProduct = manifest.products.find(
    (product) => product.id === "gdr-1015-forge3d-velo5d-float-01312018",
  );
  assert.equal(velocityProduct?.productKind, "velocity");
  assert.deepEqual(velocityProduct?.raymarchVolume?.dimensions?.slice(0, 2), [19, 19]);
  assert.equal(
    velocityProduct?.raymarchVolume?.dimensions?.[2],
    velocityProduct?.sampleCount,
    "velocity raymarch sample axis should preserve source sample count",
  );
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
    assert.equal(product.verticalReference?.sourceDatumM, product.datumM, `${product.id} datum`);
    validateSeismicNavigationPlacement(
      `manifest seismic product ${product.id}`,
      product.navigationPlacement,
    );
    assert.equal(product.verticalReference?.referenceDatumM, 1800, `${product.id} reference datum`);
    assert.match(
      product.verticalReference?.transform ?? "",
      /datumM - sample/,
      `${product.id} vertical transform`,
    );
    if (product.domainKind === "depth") {
      assert.equal(product.datumM, 1800, `${product.id} depth datum`);
    }
    if (product.productKind === "velocity") {
      assert.deepEqual(
        product.valueEncoding?.displayRangeMPerS,
        [2000, 5000],
        `${product.id} velocity display range`,
      );
    }

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
      assertFileExists(`${SEISMIC_BROWSER_DIR}/${stripAssetQuery(section.amplitudeFile)}`);
      assert.equal(section.datumM, product.datumM, `${product.id}/${section.id} datum`);
      assert.equal(
        section.verticalReference?.sourceDatumM,
        product.datumM,
        `${product.id}/${section.id} source datum`,
      );
      validateSeismicNavigationPlacement(
        `manifest seismic section ${product.id}/${section.id}`,
        section.navigationPlacement,
      );
    }

    if (product.raymarchVolume) {
      assert.equal(product.raymarchVolume.dimensions.every((dim) => dim > 1), true);
      assertFileExists(`${SEISMIC_BROWSER_DIR}/${stripAssetQuery(product.raymarchVolume.file)}`);
      assert.equal(
        product.raymarchVolume.verticalReference?.sourceDatumM,
        product.datumM,
        `${product.id} raymarch source datum`,
      );
    }
  }

  const navigation = readJson(SEISMIC_NAVIGATION_PATH);
  validateRegistrationMetadata("seismic navigation GeoJSON", navigation.properties?.registration);
  assert.equal(navigation.properties?.registrationStatus, "unverified");
  assert.equal(navigation.properties?.horizontalCrs, "EPSG:26912");
  assert.equal(navigation.properties?.coordinateBasis, "utm");
  assertArrayContainsAll(
    navigation.properties?.transformPipeline ?? [],
    [
      "parse declared SP1 coordinates",
      "transform source CRS into EPSG:26912 project frame with pyproj.Transformer",
      "subtract GeoSee project origin",
    ],
    "seismic navigation transform pipeline",
  );
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
  assertGreaterThanOrEqual(
    demoRecipes.capabilityPresets.length,
    baseSeismicCapabilityIds.length + requiredLineCatalogPresetIds.length,
    "demo recipe capability presets",
  );
  assertGreaterThanOrEqual(demoRecipes.exportLayouts.length, 3, "export layout count");

  assertGreaterThanOrEqual(
    seismicLayer.metadata?.seismicAudiencePresets?.length,
    8,
    "project audience presets",
  );
  assertGreaterThanOrEqual(
    seismicLayer.metadata?.seismicCapabilityPresets?.length,
    baseSeismicCapabilityIds.length + requiredLineCatalogPresetIds.length,
    "project seismic capability presets",
  );
  assert.equal(seismicLayer.metadata?.seismicVerticalReference?.referenceDatumM, 1800);
  assert.deepEqual(
    seismicLayer.metadata?.seismicValueEncoding?.velocity?.displayRangeMPerS,
    [2000, 5000],
  );
  const projectVelocityProduct = seismicLayer.metadata?.seismicProducts?.find(
    (product) => product.id === "gdr-1015-forge3d-velo5d-float-01312018",
  );
  assert.equal(projectVelocityProduct?.datumM, 1800, "project velocity datum");
  assert.deepEqual(
    projectVelocityProduct?.valueEncoding?.displayRangeMPerS,
    [2000, 5000],
    "project velocity display range",
  );
  assertGreaterThan(
    projectVelocityProduct?.amplitudeStats?.p98,
    5_000,
    "project velocity p98",
  );
  assert.deepEqual(projectVelocityProduct?.raymarchVolume?.dimensions?.slice(0, 2), [19, 19]);
  assert.equal(
    projectVelocityProduct?.raymarchVolume?.dimensions?.[2],
    velocityProduct?.sampleCount,
    "project velocity raymarch sample axis should preserve source sample count",
  );

  const inventory = readJson(SEISMIC_INVENTORY_PATH);
  if (inventory.normalization.sourceRootRole === "archive-normalized-source-fallback") {
    assertGreaterThan(
      inventory.normalization.normalizedFiles?.length,
      0,
      "archived normalized seismic source file count",
    );
  } else {
    assertGreaterThan(
      inventory.normalization.skippedRawGatherFileCount,
      0,
      "skipped raw gather count",
    );
  }
}

runValidation("Utah FORGE derived assets", () => {
  const project = readJson("projects/utah-forge/project.json");
  const seismicLayer = validateProjectLayerWiring(project);
  validatePublicContext();
  validateMtProducts();
  validateSeismicProducts(seismicLayer);
});
