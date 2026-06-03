import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("topo satellite image exposes outside fill and image shadow authoring fields", () => {
  const pageTypes = readSource("src", "pages", "types.ts");
  const terrainMaterial = readSource("src", "scene", "terrainMaterial.ts");
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");

  for (const field of [
    "orthoPhotoOutsideFillEnabled",
    "orthoPhotoOutsideColor",
    "orthoPhotoOutsideOpacity",
    "orthoPhotoShadowStrength",
    "orthoPhotoShadowFloor",
    "orthoPhotoShadowTint",
  ]) {
    assert.match(
      pageTypes,
      new RegExp(`${field}\\?:`),
      `Scene terrain settings should persist ${field}.`,
    );
    assert.match(
      terrainMaterial,
      new RegExp(field),
      `Terrain shader pipeline should consume ${field}.`,
    );
  }

  assert.match(
    topoPanel,
    /Outside image fill/,
    "Topo editor should expose a dedicated outside-image fill section.",
  );
  assert.match(
    topoPanel,
    /Photo sun relief/,
    "Topo editor should name satellite hillshade as photo sun relief.",
  );
});

test("topo editor exposes height-map and footprint controls backed by public clip fields", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");

  for (const label of [
    "Height map",
    "Map footprint / clipping",
    "Full height map",
    "Fit satellite image",
    "Custom size",
  ]) {
    assert.match(
      topoPanel,
      new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `Topo editor should expose ${label}.`,
    );
  }

  assert.match(
    topoPanel,
    /publicSurfaceClipSizeX/,
    "Footprint controls should keep writing existing public surface clip size fields.",
  );
  assert.match(
    topoPanel,
    /terrainMeta[\s\S]*bounds/,
    "Height-map footprint should be derived from terrain layer metadata bounds.",
  );
});

test("projected topo map shadows are opt-in instead of globally forced off", () => {
  const pageTypes = readSource("src", "pages", "types.ts");
  const applyEnvironment = readSource(
    "src",
    "scene",
    "environment",
    "applyEnvironment.ts",
  );
  const loadTerrain = readSource("src", "loaders", "loadTerrain.ts");

  for (const field of [
    "projectedMapShadowsEnabled",
    "projectedMapShadowOpacity",
    "projectedMapShadowSoftness",
    "projectedMapShadowBias",
  ]) {
    assert.match(
      pageTypes,
      new RegExp(`${field}\\?:`),
      `Scene terrain settings should persist ${field}.`,
    );
  }

  assert.doesNotMatch(
    applyEnvironment,
    /k\.castShadow\s*=\s*false;\s*this\.scene\.add\(k\)/s,
    "Key light shadows should not be unconditionally forced off.",
  );
  assert.doesNotMatch(
    applyEnvironment,
    /this\.renderer\.shadowMap\.enabled\s*=\s*false;/,
    "Renderer shadow map should not be unconditionally disabled.",
  );
  assert.doesNotMatch(
    loadTerrain,
    /terrainMesh\.receiveShadow\s*=\s*false;/,
    "Terrain mesh receiver state should not be hard-coded false.",
  );
});
