import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

function read(path) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("visual QA has a named snapshot-sensitive cleanliness command", () => {
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(
    packageJson.scripts["check:visual-qa-clean"],
    "node tools/check-workspace-state.mjs --broad",
  );
});

test("workspace broad policy fails on disposable page and overlay state", () => {
  const workspaceCheck = read("tools/check-workspace-state.mjs");

  assert.ok(
    workspaceCheck.includes("/^projects\\/[^/]+\\/pages\\//.test(path)"),
    "page JSON changes should be snapshot-sensitive",
  );
  assert.ok(
    workspaceCheck.includes("/^projects\\/[^/]+\\/overlays\\//.test(path)"),
    "page overlay changes should be snapshot-sensitive",
  );
  assert.match(
    workspaceCheck,
    /function evaluateBroadPolicy[\s\S]*snapshotEntries\.length > 0[\s\S]*process\.exitCode = 1/,
    "broad policy should fail when snapshot-sensitive files are dirty",
  );
});

test("verification routing requires before and after visual QA cleanliness checks", () => {
  const routing = read("docs/dev-context/Verification-Routing.md");

  assert.match(routing, /npm run check:visual-qa-clean/);
  assert.match(routing, /before opening the app and again after closing the app/);
  assert.match(routing, /snapshot-sensitive files/);
  assert.match(routing, /disposable page or overlay state/);
});
