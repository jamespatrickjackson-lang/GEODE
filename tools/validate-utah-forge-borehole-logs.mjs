import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_MANIFEST =
  "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/borehole_logs/borehole_logs_manifest.json";

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertSource(source, context) {
  assert.ok(source && typeof source === "object", `${context} source`);
  assert.equal(typeof source.submission, "string", `${context} source submission`);
  assert.ok(source.submission.length > 0, `${context} source submission`);
  assert.equal(typeof source.file, "string", `${context} source file`);
  assert.ok(source.file.length > 0, `${context} source file`);
}

export function validateBoreholeLogManifest(manifest) {
  assert.equal(manifest.schema, "geosee.utah-forge.borehole-logs.v1");
  assert.equal(manifest.crs?.horizontalCrs, "EPSG:26912");
  assert.ok(Array.isArray(manifest.wells), "manifest wells");

  for (const well of manifest.wells) {
    assert.equal(typeof well.id, "string", "well id");
    assert.ok(well.id.length > 0, "well id");
    assert.ok(well.trajectory && typeof well.trajectory === "object", `${well.id} trajectory`);
    assert.ok(Array.isArray(well.tracks), `${well.id} tracks`);
    assert.ok(Array.isArray(well.lithologyIntervals), `${well.id} lithology intervals`);

    const trajectoryAvailable = well.trajectory.status === "available";
    if (well.renderStatus === "renderable" && !trajectoryAvailable) {
      throw new Error(`${well.id} renderable tracks require a validated trajectory`);
    }

    for (const [index, track] of well.tracks.entries()) {
      const context = `${well.id} track ${index + 1}`;
      assert.match(track.kind, /^(gamma|resistivity)$/u, `${context} kind`);
      assert.equal(typeof track.unit, "string", `${context} unit`);
      assert.ok(track.unit.length > 0, `${context} unit`);
      assert.equal(typeof track.depthUnit, "string", `${context} depthUnit`);
      assert.ok(track.depthUnit.length > 0, `${context} depthUnit`);
      assertSource(track.source, context);
      assert.ok(track.sampleSpacing && typeof track.sampleSpacing === "object", `${context} sampleSpacing`);
      assert.ok(
        Number.isFinite(track.sampleSpacing.nominalFt),
        `${context} sampleSpacing nominalFt`,
      );
      assert.ok(Array.isArray(track.samples), `${context} samples`);
      assert.ok(track.samples.length > 0, `${context} samples`);
      if (track.renderStatus === "renderable" && !trajectoryAvailable) {
        throw new Error(`${context} renderable status requires validated trajectory`);
      }
      for (const sample of track.samples) {
        assert.equal(Number.isFinite(sample.mdFt), true, `${context} sample mdFt`);
        assert.equal(Number.isFinite(sample.value), true, `${context} sample value`);
      }
    }

    for (const [index, interval] of well.lithologyIntervals.entries()) {
      const context = `${well.id} lithology ${index + 1}`;
      assert.equal(Number.isFinite(interval.fromMdFt), true, `${context} fromMdFt`);
      assert.equal(Number.isFinite(interval.toMdFt), true, `${context} toMdFt`);
      assert.ok(interval.toMdFt > interval.fromMdFt, `${context} ordered depth interval`);
      assert.equal(typeof interval.lithology, "string", `${context} lithology`);
      assert.ok(interval.lithology.length > 0, `${context} lithology`);
      assertSource(interval.source, context);
      assert.ok(interval.sampleSpacing && typeof interval.sampleSpacing === "object", `${context} sampleSpacing`);
      assert.equal(
        Number.isFinite(interval.sampleSpacing.sourceIntervalFt),
        true,
        `${context} sourceIntervalFt`,
      );
      if (interval.renderStatus === "renderable" && !trajectoryAvailable) {
        throw new Error(`${context} renderable status requires validated trajectory`);
      }
    }
  }
}

function validateProjectWiring(manifestPath) {
  if (manifestPath !== DEFAULT_MANIFEST) return;
  const project = readJson("projects/utah-forge/project.json");
  const layer = project.layers.find((candidate) => candidate.id === "utah-forge-borehole-logs");
  assert.ok(layer, "project should include utah-forge-borehole-logs layer");
  assert.equal(layer.files?.manifest, DEFAULT_MANIFEST, "borehole logs layer manifest path");
  assert.equal(existsSync(join(process.cwd(), DEFAULT_MANIFEST)), true, "default borehole logs manifest should exist");
}

function main() {
  const manifestPath = argValue("--manifest", DEFAULT_MANIFEST);
  const manifest = readJson(manifestPath);
  validateBoreholeLogManifest(manifest);
  validateProjectWiring(manifestPath);
  console.log(
    JSON.stringify(
      {
        ok: true,
        manifest: manifestPath,
        wells: manifest.wells.length,
        renderableWells: manifest.wells.filter((well) => well.renderStatus === "renderable").length,
      },
      null,
      2,
    ),
  );
}

main();
