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
  const materialAuthority = readSource("src", "topoMap", "materialAuthority.ts");
  const layerPanelGroups = readSource("src", "editor", "LayerPanelGroups.tsx");
  const environment = readJson("projects", "utah-forge", "environment.json");

  for (const field of [
    "orthoPhotoEdgeClipInsetM",
    "orthoPhotoEdgeFadeDistanceM",
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
    assert.match(
      materialAuthority,
      new RegExp(`"${field}"`),
      `Topo material authority should preserve ${field}.`,
    );
  }

  assert.match(
    terrainMaterial,
    /uniform float uOrthoPhotoEdgeClipInset;[\s\S]*uniform float uOrthoPhotoEdgeFadeDistance;/,
    "Terrain shader should expose satellite edge clip and edge gradient uniforms.",
  );
  assert.match(
    terrainMaterial,
    /float orthoPhotoEdgeWeight[\s\S]*uOrthoPhotoEdgeClipInset[\s\S]*uOrthoPhotoEdgeFadeDistance/,
    "Terrain shader should calculate satellite image alpha from clipped edge distance.",
  );
  assert.match(
    terrainMaterial,
    /uOrthoPhotoOpacity \* orthoSample\.a \* edgeWeight/,
    "Satellite image alpha should be multiplied by the edge opacity gradient.",
  );
  assert.match(
    topoPanel,
    /label="Satellite image"[\s\S]*testId="topo-ortho-photo-edge-clip-inset"[\s\S]*testId="topo-ortho-photo-edge-fade"[\s\S]*label="Image adjustment"/,
    "Satellite image controls should expose edge clipping and opacity gradient before image adjustment.",
  );
  assert.match(
    topoPanel,
    /type TopoMapPanelSection =[\s\S]*\| "satellite"/,
    "TopoMapPanel should expose a dedicated satellite section.",
  );
  assert.match(
    topoPanel,
    /section === "satellite"/,
    "TopoMapPanel should render satellite controls from a dedicated section switch.",
  );
  assert.match(
    layerPanelGroups,
    /title="Satellite image settings"[\s\S]*section="satellite"/,
    "Topo editor should expose Satellite image settings as a peer group.",
  );
  assert.match(
    topoPanel,
    /Outside image surface/,
    "Topo editor should expose a dedicated outside-image surface section.",
  );
  assert.match(
    topoPanel,
    /Surface mode[\s\S]*Topo ramp[\s\S]*Solid fill/,
    "Outside image surface controls should choose between topo ramp and solid fill.",
  );
  assert.match(
    terrainMaterial,
    /uOrthoPhotoOutsideSurfaceMode[\s\S]*topoOutsideSurface/,
    "Terrain shader should expose an outside-image topo surface mode.",
  );
  assert.equal(
    environment.scene?.terrain?.orthoPhotoOutsideFillEnabled,
    true,
    "Utah FORGE satellite diff should enable outside image surface authoring.",
  );
  assert.equal(
    environment.scene?.terrain?.orthoPhotoOutsideSurfaceMode,
    "topo",
    "Utah FORGE satellite diff should default the outside image surface to topo ramp.",
  );
  assert.ok(
    (environment.scene?.terrain?.orthoPhotoOutsideOpacity ?? 0) > 0,
    "Utah FORGE outside image surface should be visible.",
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
  const clipControlsStart = topoPanel.indexOf("function TopoSurfaceClipControls");
  const edgeControlsStart = topoPanel.indexOf("function TopoMapEdgeControls");
  assert.notStrictEqual(
    clipControlsStart,
    -1,
    "TopoSurfaceClipControls should exist.",
  );
  assert.notStrictEqual(
    edgeControlsStart,
    -1,
    "TopoMapEdgeControls should exist.",
  );
  assert.ok(
    clipControlsStart < edgeControlsStart,
    "TopoSurfaceClipControls should be isolated before TopoMapEdgeControls.",
  );
  const clipControlsSource = topoPanel.slice(
    clipControlsStart,
    edgeControlsStart,
  );
  assert.doesNotMatch(
    clipControlsSource,
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
    /export function topoImageMaterialDefaultPatch[\s\S]*?\n}\n/,
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
