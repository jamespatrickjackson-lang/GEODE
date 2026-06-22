import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  assertArrayContainsAll,
  assertFileExists,
  assertGreaterThan,
  assertGreaterThanOrEqual,
  assertNotContains,
  fileSize,
  readJson,
  repoPath,
  runValidation,
} from "./lib/validation.mjs";

const MODEL_STATS_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/model_stats.json";
const FULL_DENSITY_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/full_density/manifest.json";
const FULL_DENSITY_PROVENANCE_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/full_density/provenance.json";
const SLICES_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/slices/manifest.json";
const SLICES_MESH_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/slices/resistivity_slices_mesh_preview.json";
const SLICES_PROVENANCE_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/slices/resistivity_slices.provenance.json";
const VOLUME_MANIFEST_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/mt_volume_manifest.json";
const THRESHOLD_MESH_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json";
const THRESHOLD_PROVENANCE_PATH =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/volume/threshold_surfaces/provenance.json";
const ACTIVE_SOURCE_ZIP =
  "projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity/mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip";
const ARCHIVE_SOURCE_ZIP =
  "C:/GeoSee/GeoSee_Archive/projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity/mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip";

const SOURCE_PREP_SCRIPTS = [
  "prep/build_utah_forge_mt_resistivity_full_density.mjs",
  "prep/build_utah_forge_mt_resistivity_slices.mjs",
  "prep/build_utah_forge_mt_volume_products.mjs",
];

function positiveSourceCount(stats) {
  return stats.positiveResistivityRowCount;
}

function maskedSourceCount(stats) {
  return stats.zeroOrNegativeResistivityRowCount;
}

function totalTilePoints(manifest) {
  return (manifest.tiles ?? []).reduce(
    (sum, tile) => sum + (Number.isFinite(tile.pointCount) ? tile.pointCount : 0),
    0,
  );
}

function manifestRelativePath(manifestPath, file) {
  return join(dirname(manifestPath), file).replaceAll("\\", "/");
}

function assertSourceCounts(label, value, stats) {
  assert.equal(
    value.sourceRows ?? value.rowCount,
    stats.rowCount,
    `${label} source row count`,
  );
  assert.equal(
    value.positiveRows ?? value.positiveResistivityRows ?? value.emittedPoints,
    positiveSourceCount(stats),
    `${label} positive row count`,
  );
  assert.equal(
    value.maskedRows ??
      value.zeroOrNegativeResistivityRows ??
      value.zeroOrNegativeRows,
    maskedSourceCount(stats),
    `${label} masked row count`,
  );
}

function validateSourceModel(stats) {
  assert.equal(stats.source?.crs, "EPSG:26912 NAD83 / UTM Zone 12N");
  assert.equal(stats.rowCount, 1_094_940);
  assert.equal(positiveSourceCount(stats), 1_094_624);
  assert.equal(maskedSourceCount(stats), 316);
  assert.equal(stats.resistivityOhmM.minPositive > 0, true);
  assert.equal(stats.log10Resistivity.min, -2);
  assert.equal(stats.log10Resistivity.max, 4.5);
  assert.deepEqual(stats.sourceBounds.easting_m, [201896.7, 481038]);
  assert.deepEqual(stats.sceneBounds.x_m, [-139570.65, 139570.65]);
  assert.equal(
    existsSync(repoPath(ACTIVE_SOURCE_ZIP)) || existsSync(ARCHIVE_SOURCE_ZIP),
    true,
    "authoritative MT source zip should exist in active project or archive",
  );
}

function validateFullDensity(stats) {
  const manifest = readJson(FULL_DENSITY_MANIFEST_PATH);
  const provenance = readJson(FULL_DENSITY_PROVENANCE_PATH);
  assert.equal(manifest.schema, "geosee.tiled-pointcloud-preview.v1");
  assert.equal(manifest.scenePlacement.cropApplied, false);
  assertSourceCounts("full-density provenance", provenance.processing, stats);
  assert.equal(totalTilePoints(manifest), positiveSourceCount(stats));
  assert.equal(manifest.tiles.length, 11);

  for (const tile of manifest.tiles) {
    const positionPath = manifestRelativePath(FULL_DENSITY_MANIFEST_PATH, tile.file);
    const scalarPath = manifestRelativePath(
      FULL_DENSITY_MANIFEST_PATH,
      tile.scalarFile,
    );
    assertFileExists(positionPath, `${tile.id} positions`);
    assertFileExists(scalarPath, `${tile.id} scalars`);
    assert.equal(
      fileSize(positionPath),
      tile.pointCount * 3 * 4,
      `${tile.id} position float32 byte count`,
    );
    assert.equal(
      fileSize(scalarPath),
      tile.pointCount * 4,
      `${tile.id} scalar float32 byte count`,
    );
  }
}

function validateSlices(stats) {
  const manifest = readJson(SLICES_MANIFEST_PATH);
  const mesh = readJson(SLICES_MESH_PATH);
  const provenance = readJson(SLICES_PROVENANCE_PATH);
  assert.equal(mesh.schema, "geosee.scalar-grid-mesh-preview.v1");
  assert.equal(manifest.transform.cropApplied, false);
  assertSourceCounts("slice manifest", manifest.source, stats);
  assertSourceCounts("slice mesh", mesh.processing, stats);
  assertSourceCounts("slice provenance", provenance.processing, stats);
  assert.equal(mesh.processing.slices.length, 8);
  assert.equal(
    mesh.processing.slices.filter(
      (slice) =>
        slice.kind === "horizontal-slice" ||
        slice.kind === "horizontal-elevation-slice",
    )
      .length,
    6,
  );
  assert.equal(
    mesh.processing.slices.filter((slice) => slice.kind === "vertical-section")
      .length,
    2,
  );

  for (const slice of mesh.processing.slices) {
    assert.equal(typeof slice.id, "string", "slice id");
    assert.equal(typeof slice.label, "string", `${slice.id} label`);
    assertGreaterThan(slice.grid?.validCells, 0, `${slice.id} valid cells`);
    assertGreaterThan(slice.grid?.triangles, 0, `${slice.id} triangles`);
    if (
      slice.kind === "horizontal-slice" ||
      slice.kind === "horizontal-elevation-slice"
    ) {
      assert.equal(
        Number.isFinite(slice.elevationM ?? slice.targetElevationM),
        true,
        `${slice.id} elevation`,
      );
      assertGreaterThan(
        slice.sourceWindow?.halfWindowM,
        0,
        `${slice.id} elevation band`,
      );
    }
    if (slice.kind === "vertical-section") {
      assert.equal(
        typeof slice.sectionLine?.orientation,
        "string",
        `${slice.id} section orientation`,
      );
      assertGreaterThan(
        slice.sourceWindow?.halfWidthM,
        0,
        `${slice.id} section source band`,
      );
    }
  }
}

function validateVolumesAndSurfaces(stats) {
  const manifest = readJson(VOLUME_MANIFEST_PATH);
  const thresholdMesh = readJson(THRESHOLD_MESH_PATH);
  const thresholdProvenance = readJson(THRESHOLD_PROVENANCE_PATH);
  assert.equal(manifest.schema, "geosee.scalar-volume.v1");
  assertSourceCounts("volume manifest", manifest.rowCounts, stats);

  // Single uncropped product (DEC supersede: focused/full-extent duality removed).
  assert.equal(manifest.products.length, 1, "single MT scalar volume product");
  const product = manifest.products[0];
  assert.equal(product.id, "mt-resistivity-full-extent-volume");
  assert.match(product.description, /uncropped/i);

  const voxelCount = product.dimensions.reduce((sum, value) => sum * value, 1);
  const volumePath = manifestRelativePath(VOLUME_MANIFEST_PATH, product.files.volume);
  const maskPath = manifestRelativePath(VOLUME_MANIFEST_PATH, product.files.mask);
  assertFileExists(volumePath, `${product.id} volume`);
  assertFileExists(maskPath, `${product.id} mask`);
  assert.equal(fileSize(volumePath), voxelCount, `${product.id} volume bytes`);
  assert.equal(fileSize(maskPath), voxelCount, `${product.id} mask bytes`);

  // Resolution floor: grid no coarser than ~source core density (guards the
  // "invisible to check:*" gap — a coarse regression now fails the build).
  const isoProduct = manifest.thresholdSurfaces.products[0];
  for (const axis of ["x_m", "y_m", "z_m"]) {
    assertGreaterThanOrEqual(
      800,
      isoProduct.voxelSpacingM[axis],
      `voxel spacing floor ${axis}`,
    );
  }

  // No overshoot: reconstructed values stay inside the source range, even where
  // the continuity reconstruction extrapolates across data gaps.
  const productStats = readJson(
    manifestRelativePath(VOLUME_MANIFEST_PATH, product.files.stats),
  );
  assertGreaterThanOrEqual(
    productStats.log10Resistivity.min,
    stats.log10Resistivity.min,
    "no overshoot below source min",
  );
  assertGreaterThanOrEqual(
    stats.log10Resistivity.max,
    productStats.log10Resistivity.max,
    "no overshoot above source max",
  );

  // Continuity reconstruction metadata recorded (not nearest-bin).
  assert.equal(
    productStats.reconstruction?.method,
    "gaussian-blend-bounded-extrapolation",
  );
  assert.equal(productStats.reconstruction?.inRangeClamped, true);
  assertGreaterThan(
    productStats.reconstruction?.extrapolatedVoxelCount,
    0,
    "continuity extrapolation occurred",
  );

  // Slim, lazy preview: geometry is fetched per boundary at runtime.
  assert.equal(thresholdMesh.schema, "geosee.scalar-grid-mesh-preview.v1");
  assert.equal(thresholdMesh.lazyBoundaries, true, "slim lazy preview");
  assert.equal(thresholdMesh.vertices.length, 0, "preview geometry is lazy (empty)");
  assert.equal(
    thresholdMesh.processing.extractionMethod,
    "mask-aware-marching-cubes",
  );
  assert.equal(thresholdProvenance.extractionMethod, "mask-aware-marching-cubes");
  assert.equal(
    manifest.thresholdSurfaces.defaultProductId,
    "mt-isosurface-full-extent",
  );
  assert.equal(
    manifest.thresholdSurfaces.products.length,
    1,
    "single isosurface product",
  );
  assert.equal(manifest.thresholdSurfaces.products[0].id, "mt-isosurface-full-extent");

  const isoProducts = thresholdMesh.processing.isosurfaceProducts ?? [];
  assert.equal(isoProducts.length, 1, "single threshold-mesh isosurface product");
  assert.equal(isoProducts[0].id, "mt-isosurface-full-extent");
  assert.equal(isoProducts[0].sourceProductId, "mt-resistivity-full-extent-volume");
  assert.equal(isoProducts[0].cropStatus, "full-source");

  const expectedBoundaryCount = 23;
  assert.equal(
    thresholdMesh.processing.boundaryBank?.intervalCount,
    20,
    "precomputed bank interval count",
  );
  assert.equal(
    thresholdMesh.processing.thresholdSurfaces.length,
    expectedBoundaryCount,
    "single-product threshold count",
  );
  assertArrayContainsAll(
    thresholdMesh.processing.thresholdSurfaces.map((surface) => surface.id),
    ["conductive-le-10-ohm-m", "conductive-le-30-ohm-m", "resistive-ge-1000-ohm-m"],
    "threshold surfaces",
  );
  for (const surface of thresholdMesh.processing.thresholdSurfaces) {
    assert.equal(surface.extractionMethod, "mask-aware-marching-cubes");
    assert.equal(
      surface.isoProductId,
      "mt-isosurface-full-extent",
      `${surface.meshId} product id`,
    );
    assert.match(
      surface.assetFile,
      /^threshold_surfaces\/boundaries\//,
      `${surface.meshId} lazy boundary asset`,
    );
    const assetPath = manifestRelativePath(VOLUME_MANIFEST_PATH, surface.assetFile);
    assertFileExists(assetPath, `${surface.meshId} lazy boundary asset`);
    assertGreaterThan(fileSize(assetPath), 0, `${surface.meshId} boundary asset non-empty`);
    assert.equal(surface.smoothing?.method, "taubin-laplacian");
    assertGreaterThan(
      surface.smoothing?.smoothedVertexCount,
      0,
      `${surface.meshId} smoothed vertices`,
    );
    assertGreaterThan(
      surface.vertexWelding?.inputVertexCount,
      surface.vertexWelding?.weldedVertexCount,
      `${surface.meshId} welded vertices`,
    );
    assert.equal(surface.normalPolicy, "precomputed-field-gradient-normals");
    assert.equal(
      surface.marchingCubes?.normalSource,
      "field-gradient",
      `${surface.meshId} normal source`,
    );
    assert.equal(surface.decimation, "none");
    assert.equal(surface.candidateBoundaryFaceCount, undefined);
    assert.equal(surface.decimationStride, undefined);
    assertGreaterThan(surface.marchingCubes?.triangleCount, 0, `${surface.meshId} triangles`);
    assertGreaterThan(surface.marchingCubes?.vertexCount, 0, `${surface.meshId} vertices`);
    // R1: surfaces are extracted from a tricubic-supersampled field (smooth,
    // grid-independent — no lattice terracing), replacing mesh subdivision.
    assert.equal(
      surface.reconstruction,
      "tricubic-supersample",
      `${surface.meshId} reconstruction`,
    );
    assert.equal(
      surface.marchingCubes?.reconstruction,
      "tricubic-supersample",
      `${surface.meshId} marchingCubes reconstruction`,
    );
    assertGreaterThanOrEqual(
      surface.supersampleFactor,
      2,
      `${surface.meshId} supersample factor`,
    );
  }
  // Deep-check one boundary asset: precomputed gradient normals are present and
  // match the vertex count (full per-asset read would stream ~hundreds of MB).
  const probeSurface = thresholdMesh.processing.thresholdSurfaces.find(
    (surface) => surface.id === "conductive-le-10-ohm-m",
  );
  if (probeSurface) {
    const probe = readJson(
      manifestRelativePath(VOLUME_MANIFEST_PATH, probeSurface.assetFile),
    );
    assertGreaterThan(
      (probe.normals ?? []).length,
      0,
      "boundary asset normals present",
    );
    assert.equal(
      probe.normals.length,
      probe.vertices.length,
      "boundary asset normals length matches vertices",
    );
  }
  assert.equal(
    thresholdMesh.processing.thresholdSurfaces.filter(
      (surface) => surface.boundarySource === "precomputed-bank",
    ).length,
    20,
    "precomputed bank count",
  );
}

function validatePrepScripts() {
  for (const scriptPath of SOURCE_PREP_SCRIPTS) {
    const source = readFileSync(repoPath(scriptPath), "utf8");
    assert.match(source, /streamModelRows/, `${scriptPath} should stream source rows`);
    assertNotContains(
      source,
      "resistivity_point_preview",
      `${scriptPath} computational input`,
    );
    assertNotContains(source, "MAX_FACES_PER_THRESHOLD", `${scriptPath} old isosurface decimation`);
    assertNotContains(source, "candidateBoundaryFaceCount", `${scriptPath} old boundary shells`);
    assertNotContains(source, "decimationStride", `${scriptPath} old boundary-shell stride`);
    assertNotContains(source, "Math.random", `${scriptPath} deterministic build`);
  }
}

runValidation("MT resistivity full-source fidelity", () => {
  const stats = readJson(MODEL_STATS_PATH);
  validateSourceModel(stats);
  validateFullDensity(stats);
  validateSlices(stats);
  validateVolumesAndSurfaces(stats);
  validatePrepScripts();
});
