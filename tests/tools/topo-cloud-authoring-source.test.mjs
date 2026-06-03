import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("topo environment clouds can create and manage cloud volumes", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");
  const layerPanelGroups = readSource("src", "editor", "LayerPanelGroups.tsx");
  const editorContext = readSource("src", "editor", "EditorContext.tsx");

  assert.match(
    topoPanel,
    /data-testid="topo-cloud-add"/,
    "Clouds panel should expose an Add cloud button.",
  );
  assert.match(
    topoPanel,
    /data-testid="topo-cloud-duplicate"/,
    "Clouds panel should expose a Duplicate cloud button.",
  );
  assert.match(
    topoPanel,
    /data-testid="topo-cloud-delete"/,
    "Clouds panel should expose a Delete cloud button.",
  );
  assert.match(
    topoPanel,
    /data-testid="topo-cloud-layer-select"/,
    "Clouds panel should expose a selector for multiple cloud volumes.",
  );
  assert.match(
    layerPanelGroups,
    /addAtmosphereLayer/,
    "LayerPanelGroups should pass atmosphere add callbacks into TopoMapPanel.",
  );
  assert.match(
    layerPanelGroups,
    /function isTopoEnvironmentCloudLayer/,
    "Topo Clouds should identify atmosphere layers that belong to the topo environment cloud tool.",
  );
  assert.match(
    layerPanelGroups,
    /atmosphereLayers:\s*state\.manifest\.layers\.filter\(\s*isTopoEnvironmentCloudLayer\s*,?\s*\)/,
    "Topo Clouds should only manage topo environment cloud layers.",
  );
  assert.match(
    editorContext,
    /ADD_PROJECT_LAYER/,
    "EditorContext should persist newly authored atmosphere layers in project.json.",
  );
});

test("topo environment is a peer group under Topo, not buried in surface settings", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");
  const layerPanelGroups = readSource("src", "editor", "LayerPanelGroups.tsx");

  assert.match(
    topoPanel,
    /type TopoMapPanelSection =[\s\S]*\| "surface"[\s\S]*\| "environment"[\s\S]*\| "graticule"[\s\S]*\| "title"/,
    "TopoMapPanel should expose a dedicated environment section.",
  );
  assert.match(
    topoPanel,
    /section === "environment"/,
    "TopoMapPanel should render the Environment controls as their own section.",
  );
  assert.match(
    layerPanelGroups,
    /title="Environment"/,
    "Topo should include a peer Environment group.",
  );
  assert.match(
    layerPanelGroups,
    /section="environment"/,
    "The peer Environment group should render the Topo environment section.",
  );
  assert.match(
    topoPanel,
    /<CloudIcon \/>[\s\S]*<span>Environment<\/span>/,
    "The Environment heading should keep the cloud icon.",
  );
  assert.doesNotMatch(
    layerPanelGroups,
    /\{section === "publicTopo" &&[\s\S]*?<TopoMapPanel\s+settings={publicTopoSettings}/,
    "LayerPanelGroups should not keep a stale direct TopoMapPanel render path after the peer groups return.",
  );
});

test("utah forge registers a default editable cloud layer", () => {
  const project = JSON.parse(
    readSource("projects", "utah-forge", "project.json"),
  );
  const environment = JSON.parse(
    readSource("projects", "utah-forge", "environment.json"),
  );
  const mtOverviewPage = JSON.parse(
    readSource(
      "projects",
      "utah-forge",
      "pages",
      "12_mt_volume_overview.json",
    ),
  );
  const layer = project.layers.find(
    (candidate) => candidate.id === "utah-forge-topo-clouds",
  );

  assert.equal(layer?.type, "atmosphere-volume");
  assert.equal(layer?.metadata?.classification, "environmental");
  assert.equal(
    layer?.metadata?.localAtmosphereVolume?.renderingRole,
    "topo-environment-cloud-impostor",
  );
  assert.ok(
    environment.layerStyles?.["utah-forge-topo-clouds"],
    "Default Utah cloud layer should have environment layerStyles.",
  );
  const style = environment.layerStyles?.["utah-forge-topo-clouds"];
  assert.equal(
    style?.atmospherePuffCount,
    1,
    "Default Utah cloud layer should start as one obvious test cloud.",
  );
  assert.ok(
    style?.atmosphereBoundsCenterZ >= 6000,
    "Default Utah test cloud should sit above high topo so depth does not hide it.",
  );
  assert.ok(
    style?.atmospherePuffScaleM >= 4000,
    "Default Utah test cloud should be large enough to see from the topo camera.",
  );
  assert.ok(
    style?.opacity >= 0.75 && style?.atmosphereDensity >= 0.85,
    "Default Utah test cloud should be visually strong enough for QA.",
  );
  assert.equal(
    style?.atmosphereScaleJitter,
    0,
    "A single default test cloud should not jitter away from its bounds center.",
  );
  assert.equal(
    style?.atmosphereDepthTest,
    false,
    "Default Utah test cloud should not be hidden behind the topo mesh.",
  );
  assert.equal(
    style?.affectedByFog,
    false,
    "Default Utah test cloud should not disappear into scene fog.",
  );
  assert.ok(
    environment.defaultVisibleLayers?.includes("utah-forge-topo-clouds"),
    "Default Utah cloud layer should be visible in the environment.",
  );
  assert.equal(
    mtOverviewPage.visibilityOverrides?.["utah-forge-topo-clouds"],
    true,
    "MT Volume Overview should explicitly turn on the test cloud.",
  );
});

test("cloud settings are grouped into their own nested containers", () => {
  const controls = readSource(
    "src",
    "editor",
    "layerControls",
    "atmosphere",
    "AtmosphereVolumeControls.tsx",
  );

  for (const id of [
    "atmosphere-volume-appearance-container",
    "atmosphere-volume-puffs-container",
    "atmosphere-volume-bounds-container",
    "atmosphere-volume-falloff-container",
    "atmosphere-volume-drift-container",
    "atmosphere-volume-render-container",
  ]) {
    assert.match(
      controls,
      new RegExp(`(?:data-testid|testId)="${id}"`),
      `Expected grouped cloud container ${id}.`,
    );
  }
  assert.match(
    controls,
    /(?:data-testid|testId)="atmosphere-volume-handles-visible"/,
    "Cloud bounds settings should include an on-screen handles toggle.",
  );
});

test("local atmosphere runtime exposes editor move and size handles", () => {
  const pageTypes = readSource("src", "pages", "types.ts");
  const runtime = readSource(
    "src",
    "scene",
    "atmosphere",
    "localAtmosphereVolume.ts",
  );
  const scene = readSource("src", "scene.ts");
  const sceneManager = readSource("src", "scene", "SceneManager.ts");

  assert.match(
    pageTypes,
    /atmosphereBoundsHelperVisible\?:\s*boolean/,
    "EditableStyle should persist the cloud on-screen handles toggle.",
  );
  assert.match(
    runtime,
    /localAtmosphereEditorHandle/,
    "Runtime should mark pickable local-atmosphere editor handles.",
  );
  assert.match(
    runtime,
    /getLocalAtmospherePreview/,
    "Runtime should expose a bounds preview patch for commits.",
  );
  assert.match(
    runtime,
    /resolved\.puffCount\s*===\s*1/,
    "Runtime should special-case one-puff clouds instead of randomizing them into an invisible first pass.",
  );
  assert.match(
    runtime,
    /singlePuff[\s\S]*resolved\.bounds\.center/,
    "Single-puff clouds should be placed at the resolved bounds center.",
  );
  assert.match(
    sceneManager,
    /listLocalAtmospherePickables/,
    "SceneManager should list local-atmosphere handle pickables.",
  );
  assert.match(
    scene,
    /setLocalAtmosphereCommitHandler/,
    "scene.ts should bridge local-atmosphere drag commits to EditorContext.",
  );
});
