import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const loader = readFileSync(
  "src/loaders/loadUtahForgeDemoBoreholes.ts",
  "utf8",
);
const panel = readFileSync("src/editor/SiteDetailsPanel.tsx", "utf8");
const pointMarkerControls = readFileSync(
  "src/editor/layerControls/scalar/PointMarkerControls.tsx",
  "utf8",
);
const styles = readFileSync("src/scene/styles/siteDetailStyles.ts", "utf8");
const mtStyles = readFileSync("src/scene/styles/mtResistivityStyles.ts", "utf8");
const types = readFileSync("src/pages/types.ts", "utf8");
const renderPresets = readFileSync("src/pages/renderPresets.ts", "utf8");
const terrainStyleController = readFileSync(
  "src/scene/terrain/terrainStyleController.ts",
  "utf8",
);
const applyEnvironment = readFileSync(
  "src/scene/environment/applyEnvironment.ts",
  "utf8",
);
const sceneManager = readFileSync("src/scene/SceneManager.ts", "utf8");
const environment = JSON.parse(
  readFileSync("projects/utah-forge/environment.json", "utf8"),
);

test("site details exposes overlay and source-label style fields", () => {
  assert.match(types, /siteDetailsAlwaysOnTop\?: boolean/);
  assert.match(types, /labelVisible\?: boolean/);
  assert.match(panel, /testId="site-details-always-on-top"/);
  assert.match(panel, /id: `source-\$\{siteDetailsRowId\(row\.id\)\}`/);
});

test("source-location labels carry source ids and runtime label visibility", () => {
  assert.match(
    loader,
    /labelRole === "source-location"[\s\S]*demoBoreholeSourceLocationId: ownerId/,
  );
  assert.match(styles, /sourceLocationItemLabelVisible/);
  assert.match(
    styles,
    /boreholeElementVisible\(obj\) &&\s*sourceLocationItemLabelVisible\(obj\)/,
  );
});

test("site details overlay render policy preserves and overrides depth state", () => {
  assert.match(styles, /SITE_DETAILS_ALWAYS_ON_TOP_RENDER_ORDER/);
  assert.match(styles, /siteDetailsBaseDepthTest/);
  assert.match(styles, /material\.depthTest = alwaysOnTop/);
  assert.match(styles, /applySiteDetailsRenderPolicy\(obj, alwaysOnTop\)/);
});

test("site details and GDR 1255 stations expose independent topo alignment controls", () => {
  assert.match(types, /siteDetailsAlignToTopo\?: boolean/);
  assert.match(types, /pointMarkerAlignToTopo\?: boolean/);
  assert.match(renderPresets, /"siteDetailsAlignToTopo"/);
  assert.match(renderPresets, /"pointMarkerAlignToTopo"/);
  assert.match(panel, /testId="site-details-align-to-topo"/);
  assert.match(pointMarkerControls, /field="pointMarkerAlignToTopo"/);
  assert.match(pointMarkerControls, /testId="point-marker-align-to-topo"/);
  assert.equal(
    environment.layerStyles["utah-forge-phase3-demo-boreholes"]
      .siteDetailsAlignToTopo,
    true,
  );
  assert.equal(
    environment.layerStyles["utah-forge-mt-stations"].pointMarkerAlignToTopo,
    true,
  );
});

test("topo alignment samples rendered terrain and reapplies dependent overlays", () => {
  assert.match(sceneManager, /renderedTopoSurfaceZ/);
  assert.match(sceneManager, /reapplyTopoAlignedOverlays/);
  assert.match(styles, /siteDetailsAlignToTopo/);
  assert.match(styles, /renderedTopoSurfaceZ/);
  assert.match(mtStyles, /pointMarkerAlignToTopo/);
  assert.match(mtStyles, /renderedTopoSurfaceZ/);
});

test("site boundary guide lines follow the rendered elevated topo surface", () => {
  assert.match(
    terrainStyleController,
    /renderedTopoSurfaceZ\?\.\(x,\s*y\)/,
    "Site guide line and fill Z should prefer rendered topo elevation, including terrain lift and vertical scale.",
  );
  assert.match(
    applyEnvironment,
    /reapplySiteSurfaceGuides\?\.\(\)/,
    "Changing the topo environment should refresh draped site boundary guide geometry.",
  );
  assert.match(
    sceneManager,
    /reapplySiteSurfaceGuides\(\):\s*void/,
    "SceneManager should expose a site-surface guide refresh hook for environment-driven topo changes.",
  );
});
