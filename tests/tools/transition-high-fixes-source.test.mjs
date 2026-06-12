import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

function readSource(...parts) {
  return readFileSync(join(process.cwd(), ...parts), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("Section ISO opacity has one composed material owner including helper transition factor", () => {
  const sceneManager = readSource("src", "scene", "SceneManager.ts");
  const sceneSectionController = readSource(
    "src",
    "scene",
    "section",
    "sceneSectionController.ts",
  );

  assert.match(sceneManager, /sectionIsoHelperTransitionOpacity/);
  assert.match(
    sceneManager,
    /authoredOpacity\s*\*\s*transitionOpacity\s*\*\s*helperTransitionOpacity\s*\*\s*occlusion/,
  );
  assert.match(sceneManager, /applySectionIsoHelperTransitionOpacity/);
  assert.match(
    sceneSectionController,
    /scalarSectionIsoOverlay[\s\S]*applySectionIsoHelperTransitionOpacity/,
  );
  assert.match(
    sceneSectionController,
    /continue;[\s\S]*const baseOpacity/,
    "ISO helper materials must skip the direct helper opacity writer",
  );
});

test("readiness handoff prunes not-ready ids and guards against double ownership", () => {
  const sceneManager = readSource("src", "scene", "SceneManager.ts");
  const transitionStyles = readSource(
    "src",
    "scene",
    "transitions",
    "transitionStyles.ts",
  );
  const transitionEffectiveLayers = readSource(
    "src",
    "scene",
    "transitions",
    "transitionEffectiveLayersForPage.ts",
  );

  assert.match(sceneManager, /READINESS_ENTER_MIN_REMAINING_MS\s*=\s*150/);
  assert.match(sceneManager, /targetNotReadyLayerIds\.delete\(layerId\)/);
  assert.match(sceneManager, /readinessAttachedLayerIds\.add\(layerId\)/);
  assert.match(sceneManager, /replanTransitionEntityReadiness/);
  assert.match(sceneManager, /layerTweens\.has\(layerId\)/);
  assert.match(sceneManager, /scalarStyleTweens\.has\(layerId\)/);
  assert.match(sceneManager, /layerTransitionSnapshots\.has\(layerId\)/);
  assert.match(sceneManager, /targetVisibleLayerIds\.has\(layerId\)/);
  assert.match(transitionStyles, /readinessAttachedLayerIds:\s*Set<string>/);
  assert.match(
    transitionEffectiveLayers,
    /readinessAttachedLayerIds:\s*new Set<string>\(\)/,
  );
});

test("editor deferred flush has a narrow post-finalize exception that preserves running tweens", () => {
  const sceneManager = readSource("src", "scene", "SceneManager.ts");
  const pageController = readSource("src", "pages", "PageController.tsx");
  const editorChrome = readSource("src", "editor", "EditorChrome.tsx");
  const commitGate = readSource(
    "src",
    "scene",
    "transitions",
    "transitionCommitGate.ts",
  );
  const decisions = readSource("docs", "03-decisions.md");

  assert.match(commitGate, /reapplyReasonBypassesPostCommitSuppression/);
  assert.match(commitGate, /editor-deferred-flush/);
  assert.match(editorChrome, /reapplyCurrentPageState\("editor-deferred-flush"\)/);
  assert.match(pageController, /reapplyReasonBypassesPostCommitSuppression\(reason\)/);
  assert.match(sceneManager, /isEditorDeferredFlush/);
  assert.match(sceneManager, /preserveRunningLayerTweens/);
  assert.match(sceneManager, /mayStartAsyncEnterTweens/);
  assert.match(
    sceneManager,
    /preserveRunningLayerTweens[\s\S]*new Map\(this\.layerTweens\)/,
  );
  assert.match(decisions, /editor-deferred-flush/);
});
