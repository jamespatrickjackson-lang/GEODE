// Behavior contract for the shared quick-legend landed gate
// (src/ui/legendAuthoringTarget.ts, review finding 8.1 / DEC-163).
// Synthetic fixtures only; no live pageOrder coupling.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

async function loadGateModule() {
  const tempRoot = join(
    tmpdir(),
    `geosee-legend-gate-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const source = readFileSync(
    join(process.cwd(), "src", "ui", "legendAuthoringTarget.ts"),
    "utf8",
  );
  // The gate function is pure; strip the editor-state import used only by
  // selectedLegendAuthoringPage so the module loads standalone.
  const standalone = source
    .replace(/import \{ selectedAuthoringPage \}[^;]+;/, "")
    .replace(/import type[^;]+;/g, "")
    .replace(
      /export function selectedLegendAuthoringPage[\s\S]*?\n\}/,
      "",
    );
  const output = ts.transpileModule(standalone, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const modulePath = join(tempRoot, "legendAuthoringTarget.mjs");
  writeFileSync(modulePath, output);
  return import(pathToFileURL(modulePath).href);
}

const { legendWritesLanded } = await loadGateModule();

const pageA = { id: "fixture-page-a" };
const pageB = { id: "fixture-page-b" };

test("writes blocked while a page transition is active", () => {
  assert.equal(
    legendWritesLanded({
      transitionActive: true,
      targetIndex: null,
      authoringPage: pageA,
      displayedPage: pageA,
      editingEnvironment: false,
    }),
    false,
  );
});

test("writes blocked while a navigation target is pending", () => {
  assert.equal(
    legendWritesLanded({
      transitionActive: false,
      targetIndex: 3,
      authoringPage: pageA,
      displayedPage: pageA,
      editingEnvironment: false,
    }),
    false,
  );
});

test("environment scope only requires a settled transition", () => {
  assert.equal(
    legendWritesLanded({
      transitionActive: false,
      targetIndex: null,
      authoringPage: null,
      displayedPage: null,
      editingEnvironment: true,
    }),
    true,
  );
});

test("no sidebar selection writes to the displayed page", () => {
  assert.equal(
    legendWritesLanded({
      transitionActive: false,
      targetIndex: null,
      authoringPage: null,
      displayedPage: pageA,
      editingEnvironment: false,
    }),
    true,
  );
});

test("landed selection matching the displayed page may write", () => {
  assert.equal(
    legendWritesLanded({
      transitionActive: false,
      targetIndex: null,
      authoringPage: pageA,
      displayedPage: pageA,
      editingEnvironment: false,
    }),
    true,
  );
});

test("selection differing from the displayed page is read-only", () => {
  assert.equal(
    legendWritesLanded({
      transitionActive: false,
      targetIndex: null,
      authoringPage: pageA,
      displayedPage: pageB,
      editingEnvironment: false,
    }),
    false,
  );
});
