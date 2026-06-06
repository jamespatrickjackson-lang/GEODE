import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

function readSource(path) {
  return readFileSync(path, "utf8");
}

const boundarySource = readSource(
  "src/projectModules/utahForge/mtSurfaceBoundaries.ts",
);
const decisionsSource = readSource("docs/03-decisions.md");
const uiStandardsSource = readSource("docs/dev-context/UI-Visual-Standards.md");
const agentsSource = readSource("AGENTS.md");
const claudeSource = readSource("CLAUDE.md");

test("MT threshold boundary resolver treats all-off maps as empty visibility state", () => {
  assert.match(
    boundarySource,
    /const canonicalHasVisibleBoundary = Object\.values\(authored\)\.some/,
    "Resolver should detect whether canonical boundary records contain any visible boundary.",
  );
  assert.match(
    boundarySource,
    /const legacyHasVisibleBoundary = Object\.values\(legacyVisibility\)\.some/,
    "Resolver should detect whether legacy boundary visibility contains any visible boundary.",
  );
  assert.match(
    boundarySource,
    /canonicalHasVisibleBoundary && typeof override\.visible === "boolean"[\s\S]{0,180}legacyHasVisibleBoundary && typeof legacyVisibility\[id\] === "boolean"[\s\S]{0,180}visibleDefault/,
    "All-off canonical and legacy maps should fall back to default/environment visibility rather than suppressing every boundary on a visible layer.",
  );
  assert.doesNotMatch(
    boundarySource,
    /typeof override\.visible === "boolean"\s*\?\s*override\.visible\s*:\s*typeof legacyVisibility\[id\] === "boolean"/,
    "Canonical false records must not always override legacy/default visibility.",
  );
});

test("docs and directives guard MT threshold boundary visibility at app level", () => {
  assert.match(
    decisionsSource,
    /DEC-113 - MT threshold boundary all-off maps inherit default visibility/,
    "Decision log should record the all-off boundary visibility resolver rule.",
  );
  for (const [name, source] of [
    ["UI standards", uiStandardsSource],
    ["AGENTS.md", agentsSource],
    ["CLAUDE.md", claudeSource],
  ]) {
    assert.match(
      source,
      /MT threshold boundary[\s\S]*all-off[\s\S]*(default|inherit)/i,
      `${name} should explain the app-level all-off boundary visibility guard.`,
    );
    assert.match(
      source,
      /Do not edit `projects\/\*\/pages\/\*\*`|page fixture|page-level/i,
      `${name} should keep the no page-fixture implementation guard.`,
    );
  }
});
