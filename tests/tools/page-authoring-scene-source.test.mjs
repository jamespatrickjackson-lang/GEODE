import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

const editorContext = readSource("src", "editor", "EditorContext.tsx");
const pageController = readSource("src", "pages", "PageController.tsx");
const layerPanel = readSource("src", "editor", "LayerPanel.tsx");
const layerPanelGroups = readSource("src", "editor", "LayerPanelGroups.tsx");
const pagePanel = readSource("src", "editor", "PagePanel.tsx");

test("active page selection after archived preview applies the active page even when index is unchanged", () => {
  assert.match(
    pageController,
    /authoringPreviewPageIdRef/,
    "PageController should keep a ref for archived preview state so goto can make synchronous no-op decisions.",
  );
  assert.match(
    pageController,
    /applyAuthoringPageNow/,
    "PageController should share immediate page application between archived preview and same-index active selection.",
  );
  assert.match(
    pageController,
    /index === currentIndexRef\.current[\s\S]{0,400}applyAuthoringPageNow\(\s*target[\s\S]{0,120}setPreviewId:\s*null/,
    "goto should apply the active page before returning when clearing an archived preview at the same active index.",
  );
});

test("authoring scene writes are scoped to global, Sub Master snapshots, or page overrides", () => {
  assert.match(
    editorContext,
    /setAuthoringScene:/,
    "EditorContext should expose a single authoring scene writer.",
  );
  assert.match(
    editorContext,
    /isSubMasterPage\(page\)[\s\S]{0,900}envSnapshot[\s\S]{0,400}mergeSceneEdit/,
    "Sub Master scene edits should update envSnapshot.scene so children inherit the change.",
  );
  assert.match(
    editorContext,
    /sceneOverrides:\s*mergeSceneEdit\(page\.sceneOverrides,\s*patch\)/,
    "Normal page and child scene edits should write page.sceneOverrides only.",
  );
});

test("page-scoped scene panels use the authoring scene writer instead of raw global scene writes", () => {
  for (const [name, source] of [
    ["LayerPanel", layerPanel],
    ["LayerPanelGroups", layerPanelGroups],
    ["PagePanel", pagePanel],
  ]) {
    assert.match(
      source,
      /setAuthoringScene/,
      `${name} should route page-scoped scene controls through setAuthoringScene.`,
    );
  }
});
