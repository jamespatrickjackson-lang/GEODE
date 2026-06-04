import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

function readJson(...parts) {
  return JSON.parse(readSource(...parts));
}

test("topo satellite image exposes outside fill and image shadow authoring fields", () => {
  const pageTypes = readSource("src", "pages", "types.ts");
  const terrainMaterial = readSource("src", "scene", "terrainMaterial.ts");
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");

  for (const field of [
    "orthoPhotoOutsideFillEnabled",
    "orthoPhotoOutsideSurfaceMode",
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
    /Outside image surface/,
    "Topo editor should expose a dedicated outside-image surface section.",
  );
  assert.match(
    topoPanel,
    /Surface mode/,
    "Outside image surface should expose a mode selector.",
  );
  for (const label of ["Topo ramp", "Solid fill"]) {
    assert.match(
      topoPanel,
      new RegExp(label),
      `Outside image surface should expose ${label}.`,
    );
  }
  assert.match(
    topoPanel,
    /Photo sun relief/,
    "Topo editor should name satellite hillshade as photo sun relief.",
  );
});

test("topo editor exposes height-map and footprint controls backed by public clip fields", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");
  const layerPanelGroups = readSource("src", "editor", "LayerPanelGroups.tsx");

  for (const label of [
    "Height map",
    "Map footprint / clipping",
    "Full height map",
    "Fit satellite image",
    "Custom edge",
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
  assert.match(
    topoPanel,
    /type TopoMapPanelSection[\s\S]*\| "extents"/,
    "Topo panel should expose a dedicated extents section.",
  );
  assert.match(
    topoPanel,
    /const showExtents = section === "all" \|\| section === "extents"/,
    "Topo panel should gate footprint controls through the extents section.",
  );
  assert.match(
    layerPanelGroups,
    /title="Extents"[\s\S]*section="extents"/,
    "Layer panel should render a peer Extents group for map clipping controls.",
  );
});

test("topo material controls are split by source, image adjustment, and sun response", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");

  assert.match(
    topoPanel,
    /label="Satellite image"[\s\S]*label="Image adjustment"[\s\S]*label="Image sun response"[\s\S]*label="Outside image surface"/,
    "Satellite controls should separate source, color adjustment, sun response, and outside surface.",
  );
  assert.equal(
    (topoPanel.match(/testId="topo-map-hillshade-strength"/g) ?? []).length,
    1,
    "Terrain hillshade strength should have one editor control to avoid conflicting writes.",
  );
});

test("satellite opacity fades to outside image surface instead of base fill", () => {
  const terrainMaterial = readSource("src", "scene", "terrainMaterial.ts");

  assert.match(
    terrainMaterial,
    /float photoCoverage = 0\.0;[\s\S]*surface = mix\(surface, outsideSurface, outsideSurfaceAlpha\);[\s\S]*surface = mix\(\s*surface,\s*topoImageSurface\(orthoSample, litAmount\),\s*photoCoverage\s*\)/,
    "Terrain shader should place outside image surface under partial satellite coverage.",
  );
  assert.doesNotMatch(
    terrainMaterial,
    /}\s*else if\s*\(\s*uOrthoPhotoOutsideFillEnabled/,
    "Outside image surface must not be gated behind the old inside-image else branch.",
  );
  assert.match(
    terrainMaterial,
    /uOrthoPhotoOutsideSurfaceMode[\s\S]*topoRampSurface/,
    "Outside image surface should support topo ramp mode independent of global surface elevation.",
  );
});

test("topo panel exposes terrain grid and underside shader controls", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");

  for (const label of [
    "Mesh grid and underside",
    "Grid color",
    "Grid opacity",
    "Grid spacing",
    "Grid line width",
    "Underside opacity",
  ]) {
    assert.match(
      topoPanel,
      new RegExp(`label="${label}"`),
      `Topo panel should expose ${label}.`,
    );
  }

  for (const field of [
    "gridEnabled",
    "gridColor",
    "gridOpacity",
    "gridSpacingM",
    "gridLineWidthM",
    "undersideOpacity",
  ]) {
    assert.match(
      topoPanel,
      new RegExp(field),
      `Topo panel should author terrain.${field}.`,
    );
  }
});

test("topo edge controls are sibling subsections under topo, not inside map footprint", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");
  const clipControlsMatch = topoPanel.match(
    /function TopoSurfaceClipControls[\s\S]*?\r?\n}\r?\n\r?\nfunction /,
  );
  assert.ok(clipControlsMatch, "TopoSurfaceClipControls should be isolated.");
  assert.doesNotMatch(
    clipControlsMatch[0],
    /Material edge opacity fade|Material edge outline|Public surface clip/,
    "Map footprint controls should not contain the lower topo edge subsections.",
  );
  assert.match(
    topoPanel,
    /function TopoMapEdgeControls/,
    "Topo edge subsections should be rendered by a sibling topo edge controls component.",
  );
});

test("image-backed topo materials do not author map-footprint clipping", () => {
  const topoSettings = readSource("src", "topoMap", "settings.ts");
  const imagePatchMatch = topoSettings.match(
    /export function topoImageMaterialDefaultPatch[\s\S]*?\r?\n}\r?\n/,
  );

  assert.ok(imagePatchMatch, "topoImageMaterialDefaultPatch should exist.");
  assert.doesNotMatch(
    imagePatchMatch[0],
    /publicSurfaceClip/,
    "Selecting a satellite material should update image coverage, not map-edge clipping.",
  );
});

test("Utah FORGE persists full height-map footprint as map-edge defaults", () => {
  const project = readJson("projects", "utah-forge", "project.json");
  const environment = readJson("projects", "utah-forge", "environment.json");
  const terrainLayer = project.layers.find((layer) => layer.id === "terrain");
  const bounds = terrainLayer?.metadata?.geoTransform?.bounds;
  const origin = terrainLayer?.metadata?.geoTransform?.sceneOriginUtm;
  assert.ok(bounds && origin, "terrain layer should expose height-map bounds.");

  const expected = {
    publicSurfaceClipEnabled: true,
    publicSurfaceClipCenterX: (bounds.min[0] + bounds.max[0]) / 2 - origin.easting_m,
    publicSurfaceClipCenterY:
      (bounds.min[1] + bounds.max[1]) / 2 - origin.northing_m,
    publicSurfaceClipCenterZ: 2000,
    publicSurfaceClipSizeX: bounds.max[0] - bounds.min[0],
    publicSurfaceClipSizeY: bounds.max[1] - bounds.min[1],
    publicSurfaceClipSizeZ: 12600,
    publicSurfaceClipRotationZDeg: 0,
    publicSurfaceClipShape: "box",
  };
  const topoLayerIds = [
    "terrain",
    "utah-forge-topo-graticule",
    "transport-roads",
    "hydrography-streams",
    "hydrography-lakes",
  ];
  const assertFullFootprint = (style, label) => {
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(style?.[key], value, `${label} should persist ${key}.`);
    }
  };

  for (const layerId of topoLayerIds) {
    assertFullFootprint(environment.layerStyles?.[layerId], `environment ${layerId}`);
  }
  for (const pageFile of ["152_page.json", "153_page.json", "154_page.json"]) {
    const page = readJson("projects", "utah-forge", "pages", pageFile);
    for (const layerId of topoLayerIds) {
      assertFullFootprint(page.layerOverrides?.[layerId], `${pageFile} ${layerId}`);
    }
  }

  assert.notDeepEqual(
    environment.scene?.terrain?.orthoPhotoBounds,
    [bounds.min[0], bounds.min[1], bounds.max[0], bounds.max[1]],
    "Satellite coverage bounds should remain separate from full map-edge bounds.",
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

test("runtime asset validator accepts cache-busted generated texture URLs", () => {
  const validator = readSource("tools", "validate-runtime-assets.mjs");

  assert.match(
    validator,
    /function stripAssetQuery\(/,
    "Runtime asset validator should strip URL query strings before filesystem checks.",
  );
  assert.match(
    validator,
    /target\.split\("\?"\)\[0\]/,
    "Generated texture cache-busting ?v= values should not become part of the filesystem path.",
  );
});
