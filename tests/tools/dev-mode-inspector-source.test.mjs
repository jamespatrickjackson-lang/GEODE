import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();
const devModeInspectorSource = readFileSync(
  join(repoRoot, "src", "editor", "DevModeInspector.tsx"),
  "utf8",
);
const editorRootSource = readFileSync(
  join(repoRoot, "src", "editor", "EditorRoot.tsx"),
  "utf8",
);
const environmentPanelSource = readFileSync(
  join(repoRoot, "src", "editor", "EnvironmentScenePanel.tsx"),
  "utf8",
);
const typesSource = readFileSync(
  join(repoRoot, "src", "pages", "types.ts"),
  "utf8",
);

function assertBefore(first, second) {
  const firstIndex = devModeInspectorSource.indexOf(first);
  const secondIndex = devModeInspectorSource.indexOf(second);
  assert.notEqual(firstIndex, -1, `Missing source marker: ${first}`);
  assert.notEqual(secondIndex, -1, `Missing source marker: ${second}`);
  assert.ok(
    firstIndex < secondIndex,
    `Expected ${first} before ${second}`,
  );
}

test("dev mode text controls are followed by padding and alignment before low-level controls", () => {
  assertBefore("<DevTextControls info={info} />", '<DevControlGroup title="Padding - bars">');
  assertBefore('<DevControlGroup title="Padding - bars">', '<DevControlGroup title="Padding - body">');
  assertBefore('<DevControlGroup title="Padding - body">', '<DevControlGroup title="Alignment">');
  assertBefore('<DevControlGroup title="Alignment">', "Low-level chrome");
  assertBefore("Low-level chrome", '<DevControlGroup title="Panel">');
  assertBefore("Low-level chrome", '<DevControlGroup title="Header">');
  assertBefore("Low-level chrome", '<DevControlGroup title="Sliders">');
});

test("editor stack and save footer spacing are selectable dev containers", () => {
  for (const required of [
    "saveFooterGapPx?: number",
    "editorSaveFooterGap",
    "editorChromeSettings.saveFooterGapPx",
    "data-dev-container-type=\"editor-section-stack\"",
    "data-dev-container-name=\"Section stack\"",
    "data-dev-container-scope=\"EditorRoot / stackStyle / scrollEndPaddingPx\"",
    "data-dev-container-type=\"editor-save-footer\"",
    "data-dev-container-name=\"Save footer\"",
    "data-dev-container-scope=\"EditorRoot / saveFooterStyle / saveFooterGapPx\"",
  ]) {
    const source =
      required === "saveFooterGapPx?: number" ? typesSource : editorRootSource;
    assert.ok(source.includes(required), `Missing selectable spacing marker: ${required}`);
  }

  assert.ok(
    devModeInspectorSource.includes("saveFooterGapPx ?? 8") &&
      devModeInspectorSource.includes("onPatch({ saveFooterGapPx: value })"),
    "DevModeInspector should expose Save footer gap control",
  );
  assert.ok(
    devModeInspectorSource.includes("scrollEndPaddingPx ?? 4") &&
      environmentPanelSource.includes("scrollEndPaddingPx ?? 4"),
    "Scroll end fallback should keep the footer boundary symmetric with the first section inset",
  );
  assert.ok(
    environmentPanelSource.includes("Footer gap") &&
      environmentPanelSource.includes("saveFooterGapPx"),
    "Cinematics editor should expose Save footer gap control",
  );
});
