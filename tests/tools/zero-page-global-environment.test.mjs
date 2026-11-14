import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Mission B: synthetic zero-page contract, source only. No live writer or real project.
const loader = readFileSync("src/pages/loadPages.ts", "utf8");
const editor = readFileSync("src/editor/EditorContext.tsx", "utf8");
const controller = readFileSync("src/pages/PageController.tsx", "utf8");
const panel = readFileSync("src/editor/PagePanel.tsx", "utf8");

test("PI-005: zero authored pages load without inventing a page", () => {
  assert.doesNotMatch(loader, /throw new Error\("loadProject: no pages resolved from pageOrder"\)/);
  assert.match(loader, /const pages = pagesFromResults\(pageOrder, pageResults/);
  assert.doesNotMatch(loader, /pages\.push\(\s*\{\s*id:/);
});

test("PI-005: Global Settings is a transient non-persisted environment view", async () => {
  const match = controller.match(/function globalEnvironmentView\([^\n]+\)[^{]*\{[\s\S]*?\n\}/);
  assert.ok(match, "Expected pure environment view adapter (never an authored page)");
  const transpiled = ts.transpileModule(
    'const ENVIRONMENT_SENTINEL = "environment";\n' + match[0] + "\nexport { globalEnvironmentView };",
    { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const { globalEnvironmentView } = await import("data:text/javascript;base64," +
    Buffer.from(transpiled).toString("base64"));
  const layers = [{ id: "scientific-layer", files: { data: "synthetic/source.geojson" } }];
  const environment = {
    id: "environment", layerStyles: { "scientific-layer": { color: "#e1e1e1" } },
    defaultVisibleLayers: ["scientific-layer"],
    sceneOverlays: { synthetic: { path: "synthetic/overlay.png", enabled: true }, disabled: { enabled: false } },
    scene: { camera: { fov: 45 } },
  };
  const pose = { position: [5, 6, 7], target: [0, 0, 0], up: [0, 0, 1], fov: 45 };
  const before = JSON.stringify({ environment, layers });
  const view = globalEnvironmentView(environment, pose);
  assert.equal(view.id, "environment");
  assert.deepEqual(view.camera, pose);
  assert.deepEqual(view.sceneOverlays, [{ id: "synthetic", visible: true }]);
  assert.equal(view.visibilityOverrides, undefined);
  assert.equal(view.sceneOverrides, undefined);
  assert.equal(JSON.stringify({ environment, layers }), before);
});

test("PI-005: deleting last active page returns selection to existing Global Settings", () => {
  const a = editor.indexOf('case "DELETE_PAGE": {'), b = editor.indexOf('case "REORDER_PAGE":', a);
  const source = editor.slice(a, b);
  assert.ok(a > 0 && b > a);
  assert.doesNotMatch(source, /activeTarget && state\.pages\.length <= 1/);
  assert.match(source, /pages\[0\]\?\.id \?\? ENVIRONMENT_SENTINEL/);
  const callback = editor.slice(editor.indexOf("const deletePageById = useCallback"), editor.indexOf("const reorderPage ="));
  assert.doesNotMatch(callback, /activeTarget && cur\.pages\.length <= 1/);
  assert.match(callback, /findEditablePage\(cur, pageId\)/);
});

test("PI-005: PageController initializes from global environment and reapplies even with no pages", () => {
  const init = controller.slice(controller.indexOf("// One-time wiring against the scene handle."),
    controller.indexOf("const readCurrentPose", controller.indexOf("// One-time wiring against the scene handle.")));
  assert.match(init, /globalEnvironmentView\(/);
  assert.match(init, /previewEnvironmentBase/);
  const reapply = controller.slice(controller.indexOf("const reapplyCurrentPageState = useCallback"),
    controller.indexOf("const applyCapturePageSourceNow = useCallback"));
  assert.match(reapply, /if \(!page\)/);
  assert.match(reapply, /globalEnvironmentView\(/);
  assert.match(reapply, /applySceneOverlaysForPage/);
  assert.match(reapply, /applyEffectiveStylesForPage/);
  assert.match(reapply, /applyEffectiveVisibilityForPage/);
});

test("PI-005: UI does not disable final page deletion and supports later addition", () => {
  assert.doesNotMatch(panel, /selectedActionPageIsActive && state\.pages\.length <= 1/);
  assert.match(editor, /const addPage = useCallback/);
  assert.match(editor, /case "ADD_PAGE": \{/);
  assert.match(editor, /const selectPage = useCallback/);
});
