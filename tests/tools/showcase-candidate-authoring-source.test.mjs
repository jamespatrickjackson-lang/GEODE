import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const candidatePageIds = [
  "40_geophysics_product_overview",
  "41_mt_station_network_footprint",
  "42_resistivity_volume_overview",
  "43_resistivity_depth_elevation_slices",
  "44_resistivity_cross_sections",
  "45_resistivity_isosurfaces",
  "49_seismic_fence_panels",
  "50_integrated_seismic_resistivity_context",
];

test("showcase candidate pages author text overlay cards", () => {
  for (const pageId of candidatePageIds) {
    const page = JSON.parse(
      readFileSync(
        join("projects", "utah-forge", "pages", `${pageId}.json`),
        "utf8",
      ),
    );

    assert.deepEqual(
      page.overlay?.contentFile,
      `overlays/${pageId}/text.md`,
      `${pageId} should render its overlay text as an authored card.`,
    );
    assert.equal(
      page.overlay?.position,
      "left",
      `${pageId} should use the standard left overlay card position.`,
    );
    assert.ok(
      page.overlayLayout &&
        typeof page.overlayLayout.x === "number" &&
        typeof page.overlayLayout.y === "number" &&
        typeof page.overlayLayout.width === "number",
      `${pageId} should have an overlay box layout.`,
    );
  }
});

test("showcase candidate pages keep terrain visible for topo material review", () => {
  for (const pageId of candidatePageIds) {
    const page = JSON.parse(
      readFileSync(
        join("projects", "utah-forge", "pages", `${pageId}.json`),
        "utf8",
      ),
    );

    assert.equal(
      page.visibilityOverrides?.terrain,
      true,
      `${pageId} should show terrain so topo material changes are visible.`,
    );
  }
});

test("topo material controls are not Global Settings-only in the editor source", () => {
  const source = readFileSync(
    join("src", "editor", "topoMap", "TopoMapPanel.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /testId="topo-material-preset"/,
    "Topo material preset select should remain present.",
  );
  assert.match(
    source,
    /testId="topo-surface-elevation-enabled"/,
    "Topo surface variables should remain present.",
  );
  assert.doesNotMatch(
    source,
    /Topo surface variables are edited in Global Settings\./,
    "Topo material and surface variables must be visible/selectable outside Global Settings.",
  );
  assert.doesNotMatch(
    source,
    /const setTerrain = \(patch: TerrainSettings\) => \{\s*if \(!isEnv\) return;/s,
    "Topo material changes must not be dropped on presentation pages.",
  );
});

test("topo material edits persist to the resolved authoring environment", () => {
  const layerPanelGroups = readFileSync(
    join("src", "editor", "LayerPanelGroups.tsx"),
    "utf8",
  );
  const editorTypes = readFileSync(join("src", "editor", "types.ts"), "utf8");

  assert.match(
    layerPanelGroups,
    /topoAuthoringEnvironment/,
    "Topo controls should use an explicit authoring environment, not an accidental display-only environment.",
  );
  assert.match(
    layerPanelGroups,
    /scene:\s*topoAuthoringEnvironment\.scene\s*\?\?\s*\{\}/,
    "Topo scene controls should read from the same environment scope they write.",
  );
  assert.match(
    layerPanelGroups,
    /setTopoAuthoringScene/,
    "Topo scene writes should route through a scoped persistence bridge.",
  );
  assert.match(
    editorTypes,
    /"envSnapshot"/,
    "Sub Master topo scene edits must be legal page writes so manual save persists them.",
  );
});

test("page scene edits persist as page-local overrides", () => {
  const layerPanelGroups = readFileSync(
    join("src", "editor", "LayerPanelGroups.tsx"),
    "utf8",
  );
  const layerPanel = readFileSync(join("src", "editor", "LayerPanel.tsx"), "utf8");
  const pageTypes = readFileSync(join("src", "pages", "types.ts"), "utf8");
  const effective = readFileSync(join("src", "pages", "effective.ts"), "utf8");

  assert.match(
    pageTypes,
    /sceneOverrides\?:\s*Partial<SceneProperties>/,
    "Pages need a dedicated scene override field; envSnapshot is Sub Master inheritance, not normal page authoring.",
  );
  assert.match(
    effective,
    /sceneOverrides/,
    "Effective page state should merge page scene overrides over the resolved environment.",
  );
  assert.match(
    layerPanelGroups,
    /setPageField\(currentPage\.id,\s*\{\s*sceneOverrides:/s,
    "Topo scene controls should save selected-page terrain/material variables into page-local sceneOverrides.",
  );
  assert.doesNotMatch(
    layerPanelGroups,
    /topoAuthoringPage\?\.envSnapshot\s*\?\?\s*state\.environment/,
    "Topo controls must not fall back to global environment while editing a selected page.",
  );
  assert.match(
    layerPanel,
    /sceneOverrides.*areaOutlines/s,
    "Area outline infill changes should read/write page-local sceneOverrides when a page is selected.",
  );
});

test("transition final commit applies page-local scene overrides", () => {
  const sceneManager = readFileSync(
    join("src", "scene", "SceneManager.ts"),
    "utf8",
  );
  const finalizeMatch = sceneManager.match(
    /finalizePageTransitionCommit\([\s\S]*?\n  \}\n\n  private transitionTweenEasedProgress/,
  );

  assert.ok(finalizeMatch, "SceneManager final commit method should exist.");
  assert.match(
    finalizeMatch[0],
    /this\.applyEnvironment\(environment\)/,
    "Final commit must apply the resolved target environment so page-local topo material overrides land after navigation.",
  );
  assert.match(
    finalizeMatch[0],
    /this\.applyPageScene\(nextPage\)/,
    "Final commit must apply page scene state through the same owner, not rely on suppressed post-commit reapply.",
  );
});
