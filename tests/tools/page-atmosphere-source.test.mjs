import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { reviewTest } from "./reviewFlag.mjs";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

reviewTest("SOURCE-CONTRACT-RISK", "topo atmosphere controls can author selected-page scene overrides", () => {
  const layerPanelGroups = readFileSync(
    join(repoRoot, "src", "editor", "LayerPanelGroups.tsx"),
    "utf8",
  );
  const topoPanel = readFileSync(
    join(repoRoot, "src", "editor", "topoMap", "TopoMapPanel.tsx"),
    "utf8",
  );

  assert.match(
    layerPanelGroups,
    /setPageField\(currentPage\.id,\s*\{\s*sceneOverrides:\s*mergeSceneProperties\(currentPage\.sceneOverrides,\s*patch\)/s,
    "Page atmosphere writes should persist into page.sceneOverrides rather than global environment.scene.",
  );
  assert.match(
    layerPanelGroups,
    /sceneHandle\.manager\.applyEnvironment\(nextPageEnvironment\)/,
    "Page atmosphere writes should apply the resolved page environment immediately.",
  );
  assert.match(
    topoPanel,
    /data-testid="topo-environment-controls"[\s\S]*<span>Environment<\/span>/,
    "Topo page controls should expose an Environment section for atmosphere authoring.",
  );
  assert.doesNotMatch(
    topoPanel,
    /Scene fog variables are edited in Global Settings\./,
    "Selected pages should not be blocked from scene fog authoring.",
  );
});

test("fog color is independent from background color", () => {
  const environmentPanel = readFileSync(
    join(repoRoot, "src", "editor", "EnvironmentScenePanel.tsx"),
    "utf8",
  );
  const applyEnvironment = readFileSync(
    join(repoRoot, "src", "scene", "environment", "applyEnvironment.ts"),
    "utf8",
  );

  assert.doesNotMatch(
    environmentPanel,
    /fog:\s*\{\s*\.\.\.\(scene\.fog\s*\?\?\s*\{\}\),\s*color:\s*e\.target\.value\s*\},\s*background:\s*e\.target\.value/s,
    "Fog color control should not overwrite renderer background color.",
  );
  assert.doesNotMatch(
    environmentPanel,
    /\(also background\)/,
    "Fog color UI should not describe fog color as a background write.",
  );
  assert.doesNotMatch(
    applyEnvironment,
    /this\.renderer\.setClearColor\(fogColor\);\s*this\.scene\.background\s*=\s*fogColor;/s,
    "Applying fog should not force clear color and scene background to the fog color.",
  );
});

test("terrain distance fog supports a page-authored gradient curve", () => {
  const pageTypes = readFileSync(
    join(repoRoot, "src", "pages", "types.ts"),
    "utf8",
  );
  const terrainMaterial = readFileSync(
    join(repoRoot, "src", "scene", "terrainMaterial.ts"),
    "utf8",
  );
  const environmentPanel = readFileSync(
    join(repoRoot, "src", "editor", "EnvironmentScenePanel.tsx"),
    "utf8",
  );

  assert.match(
    pageTypes,
    /fogGradientCurve\?:\s*number/,
    "Scene terrain settings should persist a fog gradient curve value.",
  );
  assert.match(
    terrainMaterial,
    /uFogGradientCurve/,
    "Terrain shader should expose a fog gradient curve uniform.",
  );
  assert.match(
    terrainMaterial,
    /pow\(\s*fogF\s*,\s*uFogGradientCurve\s*\)/,
    "Terrain shader should shape distance fog with the gradient curve.",
  );
  assert.match(
    readFileSync(
      join(repoRoot, "src", "editor", "topoMap", "TopoMapPanel.tsx"),
      "utf8",
    ),
    /Fog gradient/,
    "Atmosphere editor should expose a fog gradient control.",
  );
});
