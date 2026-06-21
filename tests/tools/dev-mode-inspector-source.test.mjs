import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readDevMode(file) {
  return readFileSync(
    join(repoRoot, "src", "editor", "devMode", file),
    "utf8",
  ).replace(/\r\n/g, "\n");
}
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
// The control panel JSX moved into devMode/ControlPanel.tsx (Phase 2 split).
const controlPanelSource = readDevMode("ControlPanel.tsx");

function assertBefore(first, second) {
  const firstIndex = controlPanelSource.indexOf(first);
  const secondIndex = controlPanelSource.indexOf(second);
  assert.notEqual(firstIndex, -1, `Missing source marker: ${first}`);
  assert.notEqual(secondIndex, -1, `Missing source marker: ${second}`);
  assert.ok(
    firstIndex < secondIndex,
    `Expected ${first} before ${second}`,
  );
}

test("dev mode text controls are followed by padding and alignment before low-level controls", () => {
  assertBefore("<DevTextControls", '<DevControlGroup title="Padding - bars">');
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
    controlPanelSource.includes("saveFooterGapPx ?? 8") &&
      controlPanelSource.includes("onPatch({ saveFooterGapPx: value })"),
    "Dev control panel should expose Save footer gap control",
  );
  assert.ok(
    controlPanelSource.includes("scrollEndPaddingPx ?? 4") &&
      environmentPanelSource.includes("scrollEndPaddingPx ?? 4"),
    "Scroll end fallback should keep the footer boundary symmetric with the first section inset",
  );
  assert.ok(
    environmentPanelSource.includes("Footer gap") &&
      environmentPanelSource.includes("saveFooterGapPx"),
    "Cinematics editor should expose Save footer gap control",
  );
});

const requiredDevModeModules = [
  "constants.ts",
  "types.ts",
  "util.ts",
  "text.ts",
  "boxModel.ts",
  "inspect.ts",
  "styles.ts",
  "controls.tsx",
  "textControls.tsx",
  "labelLayout.ts",
  "containerOutlines.tsx",
  "ControlPanel.tsx",
  "controlRegistry.ts",
  "session.ts",
  "overrideStore.ts",
  "reorder.ts",
  "reorderRegistry.ts",
  "reorderDrag.tsx",
  "ReorderRegistration.tsx",
  "domEditSnapshot.ts",
];

test("phase 0: dev-mode helpers are extracted into src/editor/devMode", () => {
  for (const file of requiredDevModeModules) {
    assert.ok(
      existsSync(join(repoRoot, "src", "editor", "devMode", file)),
      `expected src/editor/devMode/${file} to exist`,
    );
  }
});

test("phase 0: shell imports the extracted modules and no longer defines them inline", () => {
  assert.match(devModeInspectorSource, /from "\.\/devMode\/inspect"/);
  assert.match(devModeInspectorSource, /from "\.\/devMode\/containerOutlines"/);
  assert.match(devModeInspectorSource, /from "\.\/devMode\/styles"/);
  assert.match(devModeInspectorSource, /from "\.\/devMode\/ControlPanel"/);
  // The control primitives + text controls are consumed by the panel module.
  assert.match(controlPanelSource, /from "\.\/controls"/);
  assert.match(controlPanelSource, /from "\.\/textControls"/);

  // Extracted logic must no longer live in the shell.
  assert.doesNotMatch(devModeInspectorSource, /function readBoxModel\(/);
  assert.doesNotMatch(devModeInspectorSource, /function inspectAtPoint\(/);
  assert.doesNotMatch(devModeInspectorSource, /function collectContainerOutlines\(/);
  assert.doesNotMatch(devModeInspectorSource, /function DevContainerControlPanel\(/);

  const lineCount = devModeInspectorSource.split("\n").length;
  assert.ok(
    lineCount < 800,
    `expected the shell to stay under 800 lines, got ${lineCount}`,
  );
});

test("phase 1: container labels are clickable and select their container", () => {
  const outlines = readDevMode("containerOutlines.tsx");
  assert.match(outlines, /<button/);
  assert.match(outlines, /data-dev-mode-control="true"/);
  assert.match(outlines, /onSelect\(outline\.element\)/);
  assert.match(outlines, /aria-label=\{`Inspect container/);

  assert.match(devModeInspectorSource, /ContainerOutlinesLayer/);
  assert.match(
    devModeInspectorSource,
    /inspectElement\(element, \{ lock: true \}\)/,
  );
});

test("phase 1: clickable label style is pointer-active", () => {
  const styles = readDevMode("styles.ts");
  assert.match(styles, /clickableContainerLabelStyle/);
  assert.match(styles, /pointerEvents: "auto"/);
});

test("phase 1: label collision packing is wired into the outline layer", () => {
  const outlines = readDevMode("containerOutlines.tsx");
  assert.match(outlines, /packLabelRects/);
  assert.match(outlines, /packContainerLabels/);
});

test("phase 2: control panel is scoped per container with an inherited heading", () => {
  assert.match(controlPanelSource, /relevantControlGroups/);
  assert.match(controlPanelSource, /resolveInheritedControlSources/);
  assert.match(controlPanelSource, /groupVisible\(/);
  assert.match(controlPanelSource, /Inherited - /);
  assert.match(controlPanelSource, /Show all chrome|Show relevant only/);
});

test("phase 3: dev save/discard session is wired", () => {
  assert.match(devModeInspectorSource, /from "\.\/devMode\/session"/);
  assert.match(devModeInspectorSource, /captureSnapshot/);
  assert.match(devModeInspectorSource, /buildRestorePatch/);
  assert.match(devModeInspectorSource, /saveDevEdits/);
  assert.match(devModeInspectorSource, /discardDevEdits/);
  assert.match(devModeInspectorSource, />\s*Discard\s*<\/button>/);
  assert.match(editorRootSource, /onDevCommit=\{\(\) => void commitPending\(\)\}/);
});

test("phase 4: tag-required text/style persistence", () => {
  assert.match(typesSource, /devTextOverrides\?: Record<string, DevTextOverride>/);
  assert.match(typesSource, /export interface DevTextOverride/);
  const store = readDevMode("overrideStore.ts");
  assert.match(store, /export function overrideKeyForElement/);
  assert.match(store, /export function applyOverridesToDocument/);
  const text = readDevMode("textControls.tsx");
  assert.match(text, /Session only - not persistable/);
  assert.match(text, /if \(overrideKey\) onPersist/);
});

test("phase 5: reorder primitive + registry are present and drag layer is mounted", () => {
  const reorder = readDevMode("reorder.ts");
  assert.match(reorder, /export function computeDropIndex/);
  assert.match(reorder, /export function reorderArray/);
  assert.match(reorder, /export function stepsForMove/);
  const registry = readDevMode("reorderRegistry.ts");
  assert.match(registry, /manifest-guarded/);
  assert.match(devModeInspectorSource, /<ReorderDragLayer enabled=\{enabled\}/);
});

test("phase 6: manifest-governed reorder is guard-blocked", () => {
  const registry = readDevMode("reorderRegistry.ts");
  // A guarded group has no dispatch and commitReorder refuses + warns.
  assert.match(registry, /devModeReorderGuard/);
  assert.match(registry, /return false/);
  const manifest = readFileSync(
    join(repoRoot, "docs", "dev-context", "editor-control-manifest.json"),
    "utf8",
  );
  assert.match(manifest, /devModeReorderGuard/);
});

test("reorder closeout: editor dispatches, registration, and drag guards (UI-only)", () => {
  const editorContext = readFileSync(
    join(repoRoot, "src", "editor", "EditorContext.tsx"),
    "utf8",
  );
  assert.match(editorContext, /case "REORDER_LAYER"/);
  assert.match(editorContext, /case "REORDER_SCENE_OVERLAY"/);
  assert.match(editorContext, /reorderLayer: \(orderedIds/);
  assert.match(editorContext, /reorderSceneOverlay: \(orderedIds/);

  const reg = readDevMode("ReorderRegistration.tsx");
  assert.match(reg, /key: "layers"/);
  assert.match(reg, /key: "scene-overlays"/);
  assert.match(reg, /reorderArray\(/);

  const drag = readDevMode("reorderDrag.tsx");
  assert.match(drag, /export function isReorderDragging/);
  assert.match(drag, /export function isReorderClickSuppressed/);

  assert.match(devModeInspectorSource, /isReorderDragging\(\)/);
  assert.match(devModeInspectorSource, /isReorderClickSuppressed\(\)/);
  assert.match(devModeInspectorSource, /<DevModeReorderRegistration\s*\/>/);
});

test("phase 6: sidebar-structure reorder is a guard-routed proposal emitter", () => {
  const registry = readDevMode("reorderRegistry.ts");
  assert.match(registry, /propose\?:/);
  assert.match(registry, /def\.propose\(commit\)/);

  const reg = readDevMode("ReorderRegistration.tsx");
  assert.match(reg, /key: "sidebar-structure"/);
  assert.match(reg, /kind: "manifest-guarded"/);
  assert.match(reg, /devmode:reorder-proposal/);

  const collapsible = readFileSync(
    join(repoRoot, "src", "editor", "CollapsibleSection.tsx"),
    "utf8",
  );
  assert.match(collapsible, /data-dev-order-group=\{manifestId \? "sidebar-structure"/);
  assert.match(collapsible, /data-dev-order-id=\{manifestId\}/);

  assert.match(devModeInspectorSource, /devmode:reorder-proposal/);
  assert.match(devModeInspectorSource, /proposalToastStyle/);
});

test("polish: discard accumulates per-element DOM snapshots; overrides re-apply on page change", () => {
  const snap = readDevMode("domEditSnapshot.ts");
  assert.match(snap, /export function recordOriginal/);
  assert.match(snap, /export function restoreAllDomEdits/);
  assert.match(snap, /export function clearDomEditSnapshots/);

  const text = readDevMode("textControls.tsx");
  assert.match(text, /recordOriginal\(target\)/);

  // Discard restores DOM edits; save clears; override effect re-applies on page change.
  assert.match(devModeInspectorSource, /restoreAllDomEdits\(\)/);
  assert.match(devModeInspectorSource, /clearDomEditSnapshots\(\)/);
  assert.match(devModeInspectorSource, /selectedPageId/);
  assert.match(
    devModeInspectorSource,
    /\[editorSettings\.devTextOverrides, selectedPageId\]/,
  );

  assert.match(editorRootSource, /selectedPageId=\{String\(state\.selectedPageId\)\}/);
});
