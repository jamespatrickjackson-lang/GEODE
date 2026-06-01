import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const sceneManagerSource = readFileSync("src/scene/SceneManager.ts", "utf8");
const transitionEffectiveSource = readFileSync(
  "src/scene/transitions/transitionEffectiveLayersForPage.ts",
  "utf8",
);

test("transition source opacity capture includes visible section ISO overlays", () => {
  assert.match(
    transitionEffectiveSource,
    /sectionIsoStableLayerIds/,
    "Transition setup should keep section ISO continuity separate from whole-layer opacity capture.",
  );
  const layerTweenRuntimeSource = readFileSync(
    "src/scene/transitions/layerTweenRuntime.ts",
    "utf8",
  );
  assert.match(
    layerTweenRuntimeSource,
    /sectionIsoStableLayerIds\?\s*\.has\(id\)/,
    "Transition envelopes should preserve section ISO opacity when the overlay is visible on both pages.",
  );
  assert.match(
    sceneManagerSource,
    /root\.visible\s*=\s*next\s*>\s*0\.001\s*\|\|\s*\(sectionIsoEnvelope\s*\?\?\s*0\)\s*>\s*0\.001/,
    "A stable section ISO envelope must keep the layer root visible even when the underlying source mesh opacity is zero.",
  );
});
