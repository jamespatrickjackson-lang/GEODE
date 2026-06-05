import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const seismicLoaderSource = readFileSync(
  "src/loaders/loadSeismicBrowser.ts",
  "utf8",
);
const seismicStyleSource = readFileSync(
  "src/scene/styles/seismicBrowserStyle.ts",
  "utf8",
);
const sceneManagerSource = readFileSync("src/scene/SceneManager.ts", "utf8");
const decisionsSource = readFileSync("docs/03-decisions.md", "utf8");

test("seismic browser does not preload heavy product payloads while hidden", () => {
  assert.doesNotMatch(
    seismicLoaderSource,
    /await\s+group\.userData\.seismicEnsureProductsLoaded\(\s*\[\s*manifest\.defaultProductId\s*\]/,
    "loader should return manifest/navigation runtime without forcing default product payloads.",
  );
  assert.match(
    seismicLoaderSource,
    /seismicProductPayloadPolicy:\s*"visible-style-request-only"/,
    "loader should publish the lazy product payload policy.",
  );
});

test("seismic style requests product payloads only for visible enabled products", () => {
  assert.match(
    seismicStyleSource,
    /const layerVisible = group\.visible === true;/,
    "style should know whether the parent layer is effectively visible.",
  );
  assert.match(
    seismicStyleSource,
    /if \(layerVisible && productEnabled\(productId\)\) \{\s*requestedLoadProductIds\.add\(productId\);/s,
    "selected product should only load when it is enabled and the layer is visible.",
  );
  assert.match(
    seismicStyleSource,
    /if \(\s*layerVisible &&\s*requestedLoadProductIds\.size > 0 &&\s*typeof ensureProductsLoaded === "function"\s*\)/s,
    "payload loader should not run for hidden layers or empty visible product sets.",
  );
});

test("seismic frame LOD requests respect hidden layers and explicit empty visibility", () => {
  assert.match(
    sceneManagerSource,
    /if \(group\.visible !== true\) \{[\s\S]{0,240}continue;\s*\}/,
    "frame LOD updater should not request product payloads for hidden seismic layers.",
  );
  assert.match(
    sceneManagerSource,
    /const hasVisibleProductIdsState = Array\.isArray\(\s*root\.userData\.seismicVisibleProductIds,\s*\);/s,
    "frame LOD updater should distinguish explicit empty visibility from missing visibility state.",
  );
  assert.match(
    sceneManagerSource,
    /!\s*hasVisibleProductIdsState\s*&&\s*selectedProductId\s*\?\s*\[selectedProductId\]/,
    "selected/default fallback should not run after style explicitly disables every product.",
  );
});

test("decision log records hidden seismic payload load guard", () => {
  assert.match(
    decisionsSource,
    /DEC-103 - Hidden seismic layers do not load product payloads/,
    "decision log should document the hidden-layer payload guard.",
  );
  assert.match(
    decisionsSource,
    /visible-style-request-only/,
    "decision should name the runtime payload policy.",
  );
});
