import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const WORK_DIR = join(".tmp", "test-utah-borehole-logs");
const SOURCE_DIR = join(WORK_DIR, "source");
const MANIFEST_PATH = join(WORK_DIR, "borehole_logs_manifest.json");
const INVENTORY_PATH = join(WORK_DIR, "inventory.json");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    ...options,
  });
}

function resetFixture() {
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(SOURCE_DIR, { recursive: true });
  writeFileSync(
    join(SOURCE_DIR, "16A78-32 Final Mud Log.las"),
    [
      "~Version",
      " VERS. 2.0: CWLS LOG ASCII STANDARD",
      "~Well",
      " WELL. 16A(78)-32: Utah FORGE injection well",
      " NULL. -999.25: Null value",
      "~Curve",
      " DEPT.FT: Measured depth",
      " GR.API: Gamma ray",
      " RESD.OHMM: Deep resistivity",
      "~A",
      "0 42.0 110.0",
      "10 45.5 125.0",
      "20 -999.25 132.0",
      "30 49.0 -999.25",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(SOURCE_DIR, "68-32 cuttings lithology.csv"),
    [
      "well,from_ft,to_ft,lithology,source_note",
      "68-32,0,10,basin fill,synthetic 10 ft cuttings",
      "68-32,10,20,granitoid basement,synthetic 10 ft cuttings",
      "",
    ].join("\n"),
  );
  const python = run("python", [
    "-c",
    [
      "from pathlib import Path",
      "from zipfile import ZipFile",
      "from openpyxl import Workbook",
      `root = Path(${JSON.stringify(SOURCE_DIR)})`,
      "wb = Workbook()",
      "ws = wb.active",
      "ws.title = 'Lithology'",
      "ws.append(['well', 'from_ft', 'to_ft', 'lithology'])",
      "ws.append(['78-32', 0, 10, 'basin fill'])",
      "ws.append(['78-32', 10, 20, 'granitoid basement'])",
      "wb.save(root / '78-32 cuttings lithology.xlsx')",
      "with ZipFile(root / 'nested-log-package.zip', 'w') as archive:",
      "    archive.writestr('nested/16A-extra.las', '~Well\\n WELL. 16A(78)-32:\\n NULL. -999.25:\\n~Curve\\n DEPT.FT:\\n CGR.API:\\n AT90.OHMM:\\n~A\\n0 40 95\\n10 41 97\\n')",
    ].join("\n"),
  ]);
  assert.equal(python.status, 0, python.stderr);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("Utah FORGE borehole log ingest parses LAS curves, cuttings tables, and nested archives", () => {
  resetFixture();

  const result = run("python", [
    "tools/ingest-utah-forge-borehole-logs.py",
    "--source-root",
    SOURCE_DIR,
    "--inventory-out",
    INVENTORY_PATH,
    "--out",
    MANIFEST_PATH,
    "--well",
    "16A",
    "--well",
    "68-32",
    "--well",
    "78-32",
  ]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(MANIFEST_PATH), true);
  assert.equal(existsSync(INVENTORY_PATH), true);

  const inventory = readJson(INVENTORY_PATH);
  assert.ok(
    inventory.entries.some(
      (entry) =>
        entry.kind === "zip-member" &&
        entry.virtualPath.endsWith("nested-log-package.zip::nested/16A-extra.las"),
    ),
    "nested LAS members should be inventoried without extracting archive paths",
  );
  assert.ok(inventory.entries.some((entry) => entry.extension === ".xlsx"));

  const manifest = readJson(MANIFEST_PATH);
  assert.equal(manifest.schema, "geosee.utah-forge.borehole-logs.v1");
  assert.equal(manifest.crs.horizontalCrs, "EPSG:26912");

  const well16a = manifest.wells.find((well) => well.id === "16A(78)-32");
  assert.ok(well16a, "16A well should be normalized into the manifest");
  assert.equal(well16a.trajectory.status, "available");
  assert.equal(well16a.renderStatus, "renderable");

  const gamma = well16a.tracks.find((track) => track.kind === "gamma");
  assert.ok(gamma, "gamma track should be parsed from LAS");
  assert.equal(gamma.unit, "API");
  assert.equal(gamma.depthUnit, "ft");
  assert.equal(gamma.sampleSpacing.nominalFt, 10);
  assert.equal(gamma.samples.some((sample) => sample.value === -999.25), false);

  const resistivity = well16a.tracks.find((track) => track.kind === "resistivity");
  assert.ok(resistivity, "resistivity track should be parsed from LAS");
  assert.equal(resistivity.unit, "OHMM");
  assert.equal(resistivity.axisScale, "log10");

  const well68 = manifest.wells.find((well) => well.id === "68-32");
  assert.ok(well68, "68-32 cuttings-only well should be present");
  assert.equal(well68.lithologyIntervals.length, 2);
  assert.equal(well68.lithologyIntervals[0].sampleSpacing.sourceIntervalFt, 10);
  assert.equal(well68.renderStatus, "source-blocked:no-validated-trajectory");

  const well78 = manifest.wells.find((well) => well.id === "78-32");
  assert.ok(well78, "78-32 XLSX cuttings well should be present");
  assert.equal(well78.lithologyIntervals.length, 2);
});

test("Utah FORGE borehole log validation rejects renderable tracks without trajectory support", () => {
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });
  const invalidManifest = join(WORK_DIR, "invalid_manifest.json");
  writeFileSync(
    invalidManifest,
    JSON.stringify(
      {
        schema: "geosee.utah-forge.borehole-logs.v1",
        crs: { horizontalCrs: "EPSG:26912" },
        wells: [
          {
            id: "58-32",
            trajectory: { status: "missing" },
            renderStatus: "renderable",
            tracks: [
              {
                id: "58-32-gr",
                kind: "gamma",
                unit: "API",
                depthUnit: "ft",
                source: { submission: "GDR 1006", file: "synthetic.las" },
                sampleSpacing: { nominalFt: 10 },
                samples: [{ mdFt: 0, value: 42 }],
              },
            ],
            lithologyIntervals: [],
          },
        ],
      },
      null,
      2,
    ),
  );

  const result = run("node", [
    "tools/validate-utah-forge-borehole-logs.mjs",
    "--manifest",
    invalidManifest,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /renderable.*validated trajectory/i);
});
