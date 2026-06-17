import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(read(relPath));
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

const typesSource = read("src/pages/types.ts");
assert.match(typesSource, /"atmosphere-volume"/, "ProjectLayerSpec registers atmosphere-volume");
for (const field of [
  "atmosphereSubtype",
  "atmosphereBoundsMode",
  "atmosphereBoundsCenterX",
  "atmosphereBoundsCenterY",
  "atmosphereBoundsCenterZ",
  "atmosphereBoundsSizeX",
  "atmosphereBoundsSizeY",
  "atmosphereBoundsSizeZ",
  "atmosphereDensity",
  "atmosphereSoftness",
  "atmospherePuffCount",
  "atmospherePuffScaleM",
  "atmosphereScaleJitter",
  "atmosphereVerticalFalloff",
  "atmosphereEdgeFade",
  "atmosphereSeed",
  "atmosphereDriftEnabled",
  "atmosphereDriftSpeedMps",
  "atmosphereDriftDirectionX",
  "atmosphereDriftDirectionY",
  "atmosphereDriftDirectionZ",
  "atmosphereDepthTest",
  "atmosphereRenderOrder",
]) {
  assert.match(typesSource, new RegExp(`${field}\\??:`), `EditableStyle includes ${field}`);
}
assert.match(typesSource, /"environmental"/, "scene overlay classifications include environmental");

const editorTypesSource = read("src/editor/types.ts");
assert.match(editorTypesSource, /"environmental"/, "editor provenance types include environmental");

const layerPanelConfigSource = read("src/editor/layerControls/layerPanelConfig.ts");
assert.match(layerPanelConfigSource, /"environmental"/, "layer panel classification options include environmental");

assert.equal(
  exists("src/editor/layerControls/atmosphere/AtmosphereVolumeControls.tsx"),
  true,
  "atmosphere editor controls exist",
);
const atmosphereControlsSource = read(
  "src/editor/layerControls/atmosphere/AtmosphereVolumeControls.tsx",
);
for (const testId of [
  "atmosphere-volume-subtype",
  "atmosphere-volume-color",
  "atmosphere-volume-opacity",
  "atmosphere-volume-density",
  "atmosphere-volume-softness",
  "atmosphere-volume-puff-count",
  "atmosphere-volume-puff-scale-m",
  "atmosphere-volume-bounds-mode",
  "atmosphere-volume-bounds-center-x",
  "atmosphere-volume-bounds-center-y",
  "atmosphere-volume-bounds-center-z",
  "atmosphere-volume-bounds-size-x",
  "atmosphere-volume-bounds-size-y",
  "atmosphere-volume-bounds-size-z",
  "atmosphere-volume-edge-fade",
  "atmosphere-volume-vertical-falloff",
  "atmosphere-volume-seed",
  "atmosphere-volume-drift-enabled",
  "atmosphere-volume-drift-speed-mps",
  "atmosphere-volume-drift-direction-x",
  "atmosphere-volume-drift-direction-y",
  "atmosphere-volume-drift-direction-z",
  "atmosphere-volume-depth-test",
  "atmosphere-volume-render-order",
]) {
  assert.match(atmosphereControlsSource, new RegExp(testId), `control exposes ${testId}`);
}

assert.equal(
  exists("src/scene/atmosphere/localAtmosphereVolume.ts"),
  true,
  "runtime atmosphere volume module exists",
);
const localAtmosphereSources = [
  "src/scene/atmosphere/localAtmosphereVolume.ts",
  "src/scene/atmosphere/createMistTexture.ts",
  "src/scene/atmosphere/localAtmosphereDefaults.ts",
  "src/scene/styles/atmosphereVolumeStyle.ts",
].map(read);
const runtimeSource = localAtmosphereSources.join("\n");
assert.match(runtimeSource, /THREE\.Sprite/, "runtime uses sprite puffs");
assert.match(runtimeSource, /generated-canvas/, "runtime declares generated-canvas texture source");
assert.match(runtimeSource, /local-atmosphere:\$\{layerId\}/, "runtime publishes local atmosphere cache key");
assert.match(
  runtimeSource,
  /resolved\.puffCount\s*===\s*1/,
  "runtime explicitly handles one-puff clouds as a visible centered cloud",
);
assert.match(
  runtimeSource,
  /singlePuff[\s\S]*resolved\.bounds\.center/,
  "runtime places one-puff clouds at the resolved bounds center",
);
assert.match(
  runtimeSource,
  /preserveMaterialOpacity/,
  "runtime preserves per-puff base opacity so transition opacity can compose",
);
assert.doesNotMatch(runtimeSource, /Data3DTexture/, "runtime does not use Data3DTexture");
assert.doesNotMatch(runtimeSource, /scene\.fog/, "runtime does not mutate global scene fog");
assert.doesNotMatch(runtimeSource, /utah[-_ ]forge/i, "runtime has no Utah-specific branch");

const loaderSource = read("src/scene/layerLoaders.ts");
assert.match(loaderSource, /createLocalAtmosphereVolume/, "layer loader imports atmosphere loader");
assert.match(
  loaderSource,
  /spec\.type\s*===\s*"atmosphere-volume"|isLocalAtmosphereLayerSpec/,
  "layer loader matches atmosphere-volume",
);

const applyStyleSource = read("src/scene/styles/applyLayerStyle.ts");
assert.match(
  applyStyleSource,
  /applyLocalAtmosphereVolumeStyle/,
  "applyLayerStyle delegates to atmosphere style applicator",
);

const sceneManagerSource = read("src/scene/SceneManager.ts");
assert.match(
  sceneManagerSource,
  /updateLocalAtmosphereVolumes|tickLocalAtmosphereVolumeLayers/,
  "SceneManager ticks atmosphere drift",
);
assert.match(
  sceneManagerSource,
  /preserveMaterialOpacity[\s\S]*(?:material\.opacity|rawOpacity)\s*\/\s*productBase/,
  "SceneManager captures cloud layer opacity without multiplying puff base opacity twice",
);

const transitionSource = read("src/scene/transitions/transitionEffectiveLayersForPage.ts");
const transitionStylesSource = read("src/scene/transitions/transitionStyles.ts");
for (const field of [
  "atmosphereBoundsCenterX",
  "atmosphereBoundsCenterY",
  "atmosphereBoundsCenterZ",
  "atmosphereBoundsSizeX",
  "atmosphereBoundsSizeY",
  "atmosphereBoundsSizeZ",
]) {
  assert.match(
    transitionSource,
    new RegExp(`"${field}"`),
    `transition spatial channels include ${field}`,
  );
}
// DEC-166: atmosphere puff/texture fields are baked into per-puff geometry and
// the mist texture at build time (every one participates in
// localAtmosphereStructuralKey), so they are declared discrete crossfade in
// LOCAL_ATMOSPHERE_DISCRETE_STYLE_FIELDS, not interpolable scalar channels.
// Drift speed/direction and render order are live-applied at transition start
// (continuous motion / sort order) and are intentionally not transition
// channels at all.
for (const field of [
  "atmosphereDensity",
  "atmosphereSoftness",
  "atmospherePuffCount",
  "atmospherePuffScaleM",
  "atmosphereScaleJitter",
  "atmosphereVerticalFalloff",
  "atmosphereEdgeFade",
  "atmosphereSeed",
]) {
  assert.match(
    transitionStylesSource,
    new RegExp(`"${field}"`),
    `atmosphere discrete crossfade channels include ${field}`,
  );
}
for (const field of [
  "atmosphereSubtype",
  "atmosphereBoundsMode",
  "atmosphereDriftEnabled",
  "atmosphereDepthTest",
  "atmosphereBoundsHelperVisible",
]) {
  assert.match(
    transitionSource,
    new RegExp(`"${field}"`),
    `transition categorical channels include ${field}`,
  );
}
assert.match(
  transitionSource,
  /this\.applyStyle\(\s*id,[\s\S]*shouldTweenScalarStyle\s*\|\|\s*shouldPreserveScalarVolumeExitStyle[\s\S]*\?\s*fromStyle[\s\S]*:\s*targetStyle/,
  "page transition setup applies cloud target styles through the shared style path except the scoped MT volume exit preservation branch",
);
assert.match(
  transitionSource,
  /const shouldPreserveScalarVolumeExitStyle\s*=[\s\S]*id === UTAH_FORGE_MT_RESISTIVITY_VOLUME_LAYER_ID/,
  "the source-style exit preservation branch should stay scoped to the MT scalar volume, not atmosphere clouds",
);
assert.match(
  transitionSource,
  /applyLayerTransitionRenderOpacity/,
  "page transition setup composes transition opacity onto cloud sprite materials",
);

const baseProject = readJson("projects/base-gui/project.json");
const mistLayer = baseProject.layers.find(
  (layer) => layer.id === "base-gui-local-mist-volume",
);
assert.ok(mistLayer, "Base GUI declares local mist layer");
assert.equal(mistLayer.type, "atmosphere-volume", "Base GUI mist layer has atmosphere-volume type");
assert.equal(
  mistLayer.metadata?.classification,
  "environmental",
  "Base GUI mist layer classification is environmental",
);
assert.ok(
  mistLayer.metadata?.localAtmosphereVolume?.bounds,
  "Base GUI mist layer stores immutable local atmosphere bounds metadata",
);

const baseEnvironment = readJson("projects/base-gui/environment.json");
assert.ok(
  baseEnvironment.defaultVisibleLayers.includes("base-gui-local-mist-volume"),
  "Base GUI mist layer is visible by default",
);
assert.ok(
  baseEnvironment.layerStyles["base-gui-local-mist-volume"],
  "Base GUI mist layer has environment layer style",
);

for (const docPath of [
  "docs/schemas/project.json.md",
  "docs/schemas/page.json.md",
  "docs/schemas/sources.json.md",
  "docs/tool-manifest.md",
]) {
  const doc = read(docPath);
  assert.match(doc, /atmosphere-volume/, `${docPath} mentions atmosphere-volume`);
  assert.match(doc, /environmental/, `${docPath} mentions environmental provenance`);
}

const styleOwnershipDocs = [
  read("docs/schemas/project.json.md"),
  read("docs/schemas/page.json.md"),
  read("docs/tool-manifest.md"),
].join("\n");
assert.match(
  styleOwnershipDocs,
  /environment\.layerStyles[\s\S]*page(?:-local|-specific)?\s+`?layerOverrides`?|page(?:-local|-specific)?\s+`?layerOverrides`?[\s\S]*environment\.layerStyles/i,
  "docs route mutable layer style to environment.layerStyles and page-local layerOverrides",
);

console.log("local-atmosphere-volume source guard passed");
