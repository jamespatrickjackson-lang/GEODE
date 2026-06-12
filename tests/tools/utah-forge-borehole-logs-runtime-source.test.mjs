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
  assert.equal(style.boreholeLogHcgrColor, "#ffe26d");
  assert.equal(style.boreholeLogHsgrColor, "#ff9f43");
  assert.equal(style.boreholeLogResistivityColor, "#4dd6ff");
  assert.equal(style.boreholeLogBaselineColor, "#eef7f2");
  assert.equal(style.boreholeLogLegendVisible, true);
  assert.deepEqual(style.boreholeLogTrackSelection, {
    gamma: true,
    hcgr: true,
    hsgr: true,
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
  assert.match(source, /export function boreholeLogTrackColor/);
  assert.match(source, /export function buildTrackRibbonGeometry/);
  assert.match(source, /new THREE\.Mesh\(new THREE\.BufferGeometry\(\), makeRibbonMaterial/);
  assert.match(source, /boreholeLogPart: "lane-baseline"/);
  assert.match(source, /baselinePositions/);
  assert.match(source, /boreholeLogMnemonicVisible/);
  assert.match(source, /meshMaterial\.color\.set\(color\)/);
  assert.match(source, /edgeMaterial\.color\.set\(color\)/);
  assert.match(source, /baselineMaterial\.color\.set\(/);
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

test("GDR 1292 HCGR and HSGR tracks are loaded as distinct source curves", () => {
  const manifest = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "borehole_logs",
    "borehole_logs_manifest.json",
  );
  const well = manifest.wells.find((candidate) => candidate.id === "16A(78)-32");
  assert.ok(well, "16A(78)-32 well should be present");
  const hcgr = well.tracks.find((track) => track.mnemonic === "HCGR");
  const hsgr = well.tracks.find((track) => track.mnemonic === "HSGR");
  assert.ok(hcgr, "HCGR track should be parsed");
  assert.ok(hsgr, "HSGR track should be parsed");
  assert.equal(hcgr.samples.length, 4334);
  assert.equal(hsgr.samples.length, 4334);

  let exactSame = 0;
  let differenceSum = 0;
  let pairCount = 0;
  for (let index = 0; index < Math.min(hcgr.samples.length, hsgr.samples.length); index += 1) {
    const hcgrSample = hcgr.samples[index];
    const hsgrSample = hsgr.samples[index];
    assert.equal(hcgrSample.mdFt, hsgrSample.mdFt);
    const difference = Math.abs(hcgrSample.value - hsgrSample.value);
    if (difference === 0) exactSame += 1;
    differenceSum += difference;
    pairCount += 1;
  }

  assert.equal(exactSame, 0, "paired HCGR/HSGR source samples should not be duplicated");
  assert.ok(differenceSum / pairCount > 10, "paired HCGR/HSGR curves should differ visibly in source values");
});

test("Utah FORGE borehole logs are registered with loader and style pipelines", () => {
  const layerLoaders = readText("src", "scene", "layerLoaders.ts");
  const layerIds = readText("src", "projectModules", "utahForge", "layerIds.ts");
  const styleSource = readText("src", "scene", "styles", "siteDetailStyles.ts");
  const sceneManager = readText("src", "scene", "SceneManager.ts");
  const layerPanel = readText("src", "editor", "LayerPanel.tsx");
  const editorChrome = readText("src", "editor", "EditorChrome.tsx");
  const legendSource = readText("src", "ui", "BoreholeLogsLegend.tsx");
  const transitionSource = readText(
    "src",
    "scene",
    "transitions",
    "transitionEffectiveLayersForPage.ts",
  );
  const transitionStyles = readText(
    "src",
    "scene",
    "transitions",
    "transitionStyles.ts",
  );
  const manifest = readText("docs", "dev-context", "editor-control-manifest.json");

  assert.match(layerIds, /UTAH_FORGE_BOREHOLE_LOGS_LAYER_ID/);
  assert.match(layerLoaders, /loadUtahForgeBoreholeLogs/);
  assert.match(styleSource, /applyUtahForgeBoreholeLogStyle/);
  assert.match(sceneManager, /applyUtahForgeBoreholeLogStyle/);
  assert.match(layerPanel, /BoreholeLogsControls/);
  assert.match(layerPanel, /boreholeLogPatchFromStyle/);
  assert.match(editorChrome, /BoreholeLogsLegend/);
  assert.match(editorChrome, /"borehole-logs"/);
  assert.match(editorChrome, /boreholeLogLegendVisible/);
  const legendStackZ = /const utahForgeLegendStackStyle[\s\S]*?zIndex:\s*(\d+)/.exec(
    editorChrome,
  );
  assert.ok(legendStackZ, "Utah legend stack z-index should be declared");
  assert.ok(
    Number(legendStackZ[1]) > 20,
    "Utah quick legends should sit above presenter overlays so buttons remain clickable",
  );
  assert.match(legendSource, /compactQuickLegendPrimaryButtonBaseStyle/);
  assert.match(legendSource, /function TrackIcon/);
  assert.match(legendSource, /boreholeLogTrackSelection/);
  assert.match(legendSource, /sceneHandle\.manager\.applyStyle/);
  for (const field of [
    "boreholeLogHcgrColor",
    "boreholeLogHsgrColor",
    "boreholeLogResistivityColor",
    "boreholeLogBaselineColor",
  ]) {
    assert.match(transitionSource, new RegExp(`"${field}"`));
  }
  for (const field of [
    "boreholeLogTrackOffsetM",
    "boreholeLogTrackWidthM",
    "boreholeLogGammaScaleApi",
    "boreholeLogCurveOpacity",
    "boreholeLogCurveLineWidthPx",
  ]) {
    assert.match(transitionStyles, new RegExp(`"${field}"`));
  }
  assert.match(transitionSource, /boreholeLogTrackSelection/);
  assert.match(transitionSource, /boreholeLogLegendVisible/);
  assert.match(manifest, /borehole-logs\.active-well/);
  assert.match(manifest, /borehole-logs\.track-selection/);
  assert.match(manifest, /borehole-logs\.track-colors/);
  assert.match(manifest, /borehole-logs\.legend/);
  assert.match(manifest, /borehole-logs\.depth-window/);
});
