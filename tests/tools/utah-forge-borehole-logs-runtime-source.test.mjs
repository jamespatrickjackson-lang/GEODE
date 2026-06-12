import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readText(...segments) {
  return readFileSync(join(...segments), "utf8");
}

function readJson(...segments) {
  return JSON.parse(readText(...segments));
}

test("Utah FORGE project wires borehole logs as a hidden source-derived layer", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const environment = readJson("projects", "utah-forge", "environment.json");
  const layer = project.layers.find(
    (candidate) => candidate.id === "utah-forge-borehole-logs",
  );

  assert.ok(layer, "borehole log layer should be present");
  assert.equal(layer.type, "mesh");
  assert.equal(
    layer.files?.manifest,
    "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/borehole_logs/borehole_logs_manifest.json",
  );
  assert.match(layer.metadata?.classification ?? "", /source-derived/);
  assert.equal(
    environment.defaultVisibleLayers.includes("utah-forge-borehole-logs"),
    false,
    "borehole log layer should be default hidden",
  );

  const style = environment.layerStyles["utah-forge-borehole-logs"];
  assert.ok(style, "borehole log layer should have default style controls");
  assert.equal(style.boreholeLogVerticalExaggeration, 1);
  assert.equal(style.boreholeLogTrackOffsetM, 24);
  assert.equal(style.boreholeLogTrackWidthM, 36);
  assert.equal(style.boreholeLogGammaScaleApi, 150);
  assert.deepEqual(style.boreholeLogTrackSelection, {
    gamma: true,
    resistivity: true,
    lithology: true,
  });
});

test("Utah FORGE borehole log loader maps samples onto trajectories without vertical fallback", () => {
  const loaderPath = join("src", "loaders", "loadUtahForgeBoreholeLogs.ts");
  assert.equal(existsSync(loaderPath), true, "loader source should exist");
  const source = readText(loaderPath);

  assert.match(source, /export function interpolateTrajectoryByMdFt/);
  assert.match(source, /export function computeBoreholeLogLaneFrame/);
  assert.match(source, /export function buildTrackRibbonGeometry/);
  assert.match(source, /new THREE\.Mesh\(new THREE\.BufferGeometry\(\), makeRibbonMaterial/);
  assert.match(source, /indices\.push\(a, c, b, b, c, d\)/);
  assert.match(source, /userData\.utahForgeBoreholeLogTrack/);
  assert.match(source, /kind: "gamma"/);
  assert.match(source, /kind: "resistivity"/);
  assert.match(source, /kind: "lithology"/);
  assert.doesNotMatch(source, /function lateralNormal/);
  assert.doesNotMatch(source, /function tangentAtMdFt/);
  assert.doesNotMatch(source, /vertical projection/i);
  assert.doesNotMatch(source, /new THREE\.Vector3\([^)]*0,\s*0,\s*-depth/i);
});

test("Utah FORGE borehole logs are registered with loader and style pipelines", () => {
  const layerLoaders = readText("src", "scene", "layerLoaders.ts");
  const layerIds = readText("src", "projectModules", "utahForge", "layerIds.ts");
  const styleSource = readText("src", "scene", "styles", "siteDetailStyles.ts");
  const sceneManager = readText("src", "scene", "SceneManager.ts");
  const layerPanel = readText("src", "editor", "LayerPanel.tsx");
  const manifest = readText("docs", "dev-context", "editor-control-manifest.json");

  assert.match(layerIds, /UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID/);
  assert.match(layerLoaders, /loadUtahForgeBoreholeLogs/);
  assert.match(styleSource, /applyUtahForgeBoreholeLogStyle/);
  assert.match(sceneManager, /applyUtahForgeBoreholeLogStyle/);
  assert.match(layerPanel, /BoreholeLogsControls/);
  assert.match(manifest, /borehole-logs\.active-well/);
  assert.match(manifest, /borehole-logs\.track-selection/);
  assert.match(manifest, /borehole-logs\.depth-window/);
});
