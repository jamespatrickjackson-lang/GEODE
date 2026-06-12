import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const settingsSource = readFileSync("src/topoMap/settings.ts", "utf8");
const transitionStylesSource = readFileSync(
  "src/scene/transitions/transitionStyles.ts",
  "utf8",
);
const sceneManagerSource = readFileSync("src/scene/SceneManager.ts", "utf8");

test("numeric public-surface clip fields are continuous transition channels", () => {
  assert.match(
    settingsSource,
    /export const TOPO_MAP_PUBLIC_SURFACE_CLIP_NUMERIC_STYLE_FIELDS\s*=\s*\[[\s\S]*"publicSurfaceClipCenterX"[\s\S]*"publicSurfaceClipCenterY"[\s\S]*"publicSurfaceClipCenterZ"[\s\S]*"publicSurfaceClipSizeX"[\s\S]*"publicSurfaceClipSizeY"[\s\S]*"publicSurfaceClipSizeZ"[\s\S]*"publicSurfaceClipRotationZDeg"[\s\S]*\]/,
    "Topo numeric clip bounds should be named separately from categorical clip fields.",
  );
  assert.match(
    transitionStylesSource,
    /SCALAR_TRANSITION_STYLE_FIELDS[\s\S]*\.\.\.TOPO_MAP_PUBLIC_SURFACE_CLIP_NUMERIC_STYLE_FIELDS/,
    "Numeric public-surface clip bounds should ride the existing page-clock style tween path.",
  );
});

test("categorical public-surface clip fields remain discrete", () => {
  assert.match(
    settingsSource,
    /export const TOPO_MAP_PUBLIC_SURFACE_CLIP_DISCRETE_STYLE_FIELDS\s*=\s*\[[\s\S]*"publicSurfaceClipEnabled"[\s\S]*"publicSurfaceClipShape"[\s\S]*"publicSurfaceClipPreviewVisible"[\s\S]*\]/,
    "Enabled, shape, and preview visibility are categorical public-surface clip fields.",
  );
  assert.match(
    transitionStylesSource,
    /styleFieldsChanged\(\s*fromStyle,\s*toStyle,\s*TOPO_MAP_PUBLIC_SURFACE_CLIP_DISCRETE_STYLE_FIELDS,\s*\)/,
    "Discrete topo classification should not use the full public-surface clip field list.",
  );
}
);

test("topo surface layers can run continuous style tweens", () => {
  assert.match(
    sceneManagerSource,
    /layerSupportsScalarStyleTween\([\s\S]*this\.isTopoSurfaceLayerId\(id\)/,
    "Topo surface layers should opt into continuous style tweens for numeric clip movement.",
  );
});
