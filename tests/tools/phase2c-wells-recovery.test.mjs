import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();
const fixtureRoot = join(repoRoot, "tests", "fixtures", "phase2c-wells");
const tmpRoot = join(repoRoot, ".tmp", "phase2c-wells-tests");

function runAudit(fixtureName) {
  mkdirSync(tmpRoot, { recursive: true });
  const outPath = join(tmpRoot, `${fixtureName}.json`);
  execFileSync(
    "python",
    [
      "tools/audit-utah-phase2c-wells-shapefile.py",
      "--input",
      join(fixtureRoot, fixtureName),
      "--out",
      outPath,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return JSON.parse(readFileSync(outPath, "utf8"));
}

function runAuditInputExpectFailure(inputPath, expectedMessage) {
  const result = spawnSync(
    "python",
    [
      "tools/audit-utah-phase2c-wells-shapefile.py",
      "--input",
      inputPath,
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.notEqual(result.status, 0, `${inputPath} should fail validation`);
  assert.match(`${result.stdout}\n${result.stderr}`, expectedMessage);
}

function runAuditExpectFailure(fixtureName, expectedMessage) {
  runAuditInputExpectFailure(join(fixtureRoot, fixtureName), expectedMessage);
}

function temporaryFixtureCopy(name) {
  const target = join(tmpRoot, `${name}-copy`);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(tmpRoot, { recursive: true });
  cpSync(join(fixtureRoot, name), target, { recursive: true });
  return target;
}

function runRecoverySnippet(fixtureName) {
  const script = `
import importlib.util
import json
from pathlib import Path

repo = Path(r"${repoRoot.replaceAll("\\", "\\\\")}")
spec = importlib.util.spec_from_file_location("phase2c_generator", repo / "tools" / "generate-utah-forge-demo-boreholes.py")
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)

records = module.load_phase2c_identity_records(repo / "tests" / "fixtures" / "phase2c-wells" / "${fixtureName}")
candidates = [
    {
        "id": "BOR1",
        "sourceFile": "Utah FORGE Well and Seismic Locations.csv",
        "utm": [335037.4976, 4261314.18, 1694.5918],
    }
]
print(json.dumps(module.recover_phase2c_candidate_identities(candidates, records), sort_keys=True))
`;
  return JSON.parse(execFileSync("python", ["-c", script], { cwd: repoRoot, encoding: "utf8" }));
}

test("Phase2C wells shapefile audit reads valid binary sidecars", () => {
  const audit = runAudit("valid");

  assert.equal(audit.sourceCrs, "EPSG:26912 / NAD83 UTM Zone 12N");
  assert.deepEqual(
    audit.components.map((component) => component.extension).sort(),
    [".cpg", ".dbf", ".prj", ".shp", ".shx"],
  );
  assert.deepEqual(
    audit.dbf.fields.map((field) => field.name),
    ["WELL_NAME", "TYPE"],
  );
  assert.equal(audit.recordCount, 3);
  assert.equal(audit.records[0].identity.name, "Seismic Monitor One");
  assert.equal(audit.records[0].geometry.easting_m, 335037.8);
  assert.equal(audit.records[0].geometry.northing_m, 4261314.3);
});

test("Phase2C wells shapefile audit rejects missing attribute table", () => {
  runAuditExpectFailure("missing-dbf", /attribute table missing/i);
});

test("Phase2C wells shapefile audit rejects missing codepage sidecar", () => {
  const target = temporaryFixtureCopy("valid");
  rmSync(join(target, "Utah_FORGE_Phase2C_wells.cpg"), { force: true });
  runAuditInputExpectFailure(target, /missing \.cpg codepage component/i);
});

test("Phase2C wells shapefile audit rejects text-mode damaged binary components", () => {
  runAuditExpectFailure(
    "corrupt-text-transfer",
    /invalid SHP file code|invalid SHX file code|too small to be a valid shapefile component/i,
  );
});

test("Phase2C wells shapefile audit rejects ambiguous identity fields", () => {
  runAuditExpectFailure("ambiguous-name", /ambiguous identity fields/i);
});

test("Phase2C identity recovery names only unique coordinate matches", () => {
  const recovered = runRecoverySnippet("valid");
  assert.equal(recovered[0].id, "BOR1");
  assert.equal(recovered[0].label, "Seismic Monitor One");
  assert.equal(recovered[0].identityRecovery.status, "matched");
  assert.equal(recovered[0].identityRecovery.source, "Utah_FORGE_Phase2C_wells");
  assert.ok(recovered[0].identityRecovery.distanceM < 0.5);
});

test("Phase2C identity recovery preserves candidates outside tolerance", () => {
  const recovered = runRecoverySnippet("far-match");
  assert.equal(recovered[0].id, "BOR1");
  assert.equal(recovered[0].label, undefined);
  assert.equal(recovered[0].identityRecovery.status, "unmatched");
  assert.equal(recovered[0].identityRecovery.reason, "no-unique-coordinate-match");
});

test("Phase2C identity recovery preserves candidates with ambiguous coordinate matches", () => {
  const recovered = runRecoverySnippet("ambiguous-match");
  assert.equal(recovered[0].id, "BOR1");
  assert.equal(recovered[0].label, undefined);
  assert.equal(recovered[0].identityRecovery.status, "unmatched");
  assert.equal(recovered[0].identityRecovery.reason, "ambiguous-coordinate-match");
  assert.equal(recovered[0].identityRecovery.matchCount, 2);
});
