import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

test("topo panel groups atmospheric tools under Environment with cloud controls", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");
  const layerPanelGroups = readSource("src", "editor", "LayerPanelGroups.tsx");

  assert.match(
    topoPanel,
    /function CloudIcon\(/,
    "Topo Environment heading should include a local cloud icon component.",
  );
  assert.match(
    topoPanel,
    /summary[^]*CloudIcon[^]*Environment/,
    "Topo panel should expose an Environment heading with the cloud icon.",
  );
  assert.match(
    topoPanel,
    /label="Clouds"[^]*AtmosphereVolumeControls/,
    "Clouds should reuse atmosphere-volume controls inside Topo Environment.",
  );
  assert.match(
    topoPanel,
    /label="Fog"[^]*label="Scene fog"[^]*label="Map fog"/,
    "Scene fog and map fog should live under the Topo Environment/Fog section.",
  );
  assert.match(
    layerPanelGroups,
    /atmosphereLayers:\s*state\.manifest\.layers\.filter/,
    "Topo panel props should receive atmosphere-volume layers from the manifest.",
  );
});

test("topo environment exposes sun, fog, and map atmosphere controls", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");

  for (const label of [
    "Light source",
    "Sky image",
    "Source marker",
    "Sun azimuth",
    "Sun elevation",
    "Camera lock",
    "Orb color",
    "Orb opacity",
    "Orb size",
    "Orb distance",
    "Edge blur",
    "Halo color",
    "Halo opacity",
    "Halo scale",
    "Marker opacity",
    "Light color",
    "Light intensity",
    "Relief strength",
    "Shadow edge",
    "Facet highlight",
    "Shadow tint",
    "Projected shadows",
    "Shadow opacity",
    "Shadow softness",
    "Shadow bias",
    "Light mode",
    "Dark background",
    "Dark fog",
    "Light background",
    "Light fog",
    "Scene fog",
    "Fog dens.",
    "Fog reach",
    "Fog gradient",
    "Map fog",
  ]) {
    assert.match(
      topoPanel,
      new RegExp(`label="${label}"`),
      `Topo Environment should expose ${label}.`,
    );
  }
});

test("topo sun controls include light, sky, relief, and shadow controls", () => {
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");

  assert.match(
    topoPanel,
    /label="Sun"[\s\S]*label="Light source"[\s\S]*label="Sky image"[\s\S]*label="Source marker"[\s\S]*label="Orb color"[\s\S]*label="Halo color"[\s\S]*label="Relief strength"[\s\S]*label="Projected shadows"/,
    "Sun controls should include light source, sky image, marker, orb/halo, relief, and projected shadow rows.",
  );
});

test("scene sun model separates light source from visible sky image", () => {
  const pageTypes = readSource("src", "pages", "types.ts");
  const applyEnvironment = readSource(
    "src",
    "scene",
    "environment",
    "applyEnvironment.ts",
  );
  const topoPanel = readSource("src", "editor", "topoMap", "TopoMapPanel.tsx");

  for (const field of [
    "lightEnabled",
    "orbVisible",
    "orbColor",
    "orbOpacity",
    "orbSizeM",
    "orbDistanceM",
    "orbEdgeSoftness",
    "orbHaloColor",
    "orbHaloOpacity",
    "orbHaloScale",
    "sourceMarkerVisible",
  ]) {
    assert.match(
      pageTypes,
      new RegExp(`${field}\\?:`),
      `Scene sun settings should persist ${field}.`,
    );
  }

  assert.match(
    applyEnvironment,
    /sunLightEnabled\s*=\s*sp\.sun\?\.lightEnabled\s*!==\s*false/,
    "Key light should be controlled independently from the visual sun orb.",
  );
  assert.match(
    applyEnvironment,
    /applyEnvironmentSunVisual/,
    "Environment runtime should apply the generated sky sun visual.",
  );
  assert.match(
    topoPanel,
    /label="Sky image"[^]*orbVisible/,
    "Topo Sun controls should expose the visible sky image toggle.",
  );
  assert.match(
    topoPanel,
    /label="Light source"[^]*lightEnabled/,
    "Topo Sun controls should expose the light-source toggle.",
  );
});

test("sun visual runtime uses generated canvas sprites and exposes debug state", () => {
  const sunVisual = readSource(
    "src",
    "scene",
    "environment",
    "sunVisual.ts",
  );
  const sceneManager = readSource("src", "scene", "SceneManager.ts");

  assert.match(
    sunVisual,
    /textureSource:\s*"generated-canvas"/,
    "Sun visual should use a generated-canvas texture source.",
  );
  assert.match(
    sunVisual,
    /THREE\.SpriteMaterial/,
    "Sun visual should render as transparent sprite materials.",
  );
  assert.match(
    sunVisual,
    /environmentSunVisualDebug/,
    "Sun visual should expose debug metadata for browser tests.",
  );
  assert.doesNotMatch(
    sunVisual,
    /Data3DTexture|raymarch/i,
    "Sun visual should not use volumetric textures or raymarching.",
  );
  assert.match(
    sceneManager,
    /updateEnvironmentSunVisualDirection/,
    "Camera-locked sun changes should update the visible sun direction.",
  );
});
