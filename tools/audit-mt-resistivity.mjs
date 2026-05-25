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
  assertArrayContainsAll(
    manifest.products.map((product) => product.id),
    ["mt-resistivity-full-extent-volume", "mt-resistivity-forge-focused-volume"],
    "MT scalar volume products",
  );

  const fullExtent = manifest.products.find(
    (product) => product.id === "mt-resistivity-full-extent-volume",
  );
  const focused = manifest.products.find(
    (product) => product.id === "mt-resistivity-forge-focused-volume",
  );
  assert.match(fullExtent.description, /Uncropped/i);
  assert.match(focused.description, /cropped/i);
  assertGreaterThanOrEqual(
    fullExtent.sourceRowsInBounds,
    positiveSourceCount(stats) - 100,
    "full-extent volume should retain effectively all positive rows",
  );
  assertGreaterThan(
    positiveSourceCount(stats),
    focused.sourceRowsInBounds,
    "focused volume should be explicitly cropped",
  );

  for (const product of manifest.products) {
    const voxelCount = product.dimensions.reduce((sum, value) => sum * value, 1);
    const volumePath = manifestRelativePath(VOLUME_MANIFEST_PATH, product.files.volume);
    const maskPath = manifestRelativePath(VOLUME_MANIFEST_PATH, product.files.mask);
    assertFileExists(volumePath, `${product.id} volume`);
    assertFileExists(maskPath, `${product.id} mask`);
    assert.equal(fileSize(volumePath), voxelCount, `${product.id} volume bytes`);
    assert.equal(fileSize(maskPath), voxelCount, `${product.id} mask bytes`);
  }

  assert.equal(thresholdMesh.schema, "geosee.scalar-grid-mesh-preview.v1");
  assert.equal(
    thresholdMesh.processing.sourceProductId,
    "mt-resistivity-forge-focused-volume",
  );
  assert.equal(
    thresholdProvenance.sourceProductId,
    "mt-resistivity-forge-focused-volume",
  );
  assert.equal(thresholdMesh.processing.thresholdSurfaces.length, 3);
  assertArrayContainsAll(
    thresholdMesh.processing.thresholdSurfaces.map((surface) => surface.id),
    ["conductive-le-10-ohm-m", "conductive-le-30-ohm-m", "resistive-ge-1000-ohm-m"],
    "threshold surfaces",
  );
  assertGreaterThan(thresholdMesh.vertices.length, 0, "threshold vertices");
  assertGreaterThan(thresholdMesh.indices.length, 0, "threshold indices");
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
