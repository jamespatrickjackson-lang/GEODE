import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

function readSource(path) {
  return readFileSync(path, "utf8");
}

const legendSource = readSource("src/ui/SceneSectionLegend.tsx");
const editorSource = readSource(
  "src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx",
);
const controllerSource = readSource(
  "src/scene/section/sceneSectionController.ts",
);
const typesSource = readSource("src/pages/types.ts");

test("section legend exposes the same per-axis controls as the editor header", () => {
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-show/,
    "Quick legend should expose a per-axis Show checkbox.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-flip/,
    "Quick legend should expose a per-axis Flip checkbox.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-controls/,
    "Quick legend should expose a per-axis Controls checkbox.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-ground-trace-visible/,
    "Quick legend should expose Ground trace for supported axes.",
  );
  assert.match(
    legendSource,
    /scene-section-legend-\$\{axis\}-axes-visible/,
    "Quick legend should expose Scale axes per axis.",
  );
  assert.match(
    legendSource,
    /axis\s*!==\s*"z"[\s\S]{0,900}Ground trace/,
    "Z section rows should not render a ground-trace toggle.",
  );
  assert.doesNotMatch(
    legendSource,
    /P Controle|scene-section-legend-helper-visible/,
    "Quick legend should not keep the global P Controle helper toggle.",
  );
});

test("editor section frame header uses Show and Controls as separate fields", () => {
  assert.match(
    editorSource,
    /scene-section-plane-\$\{controlKey\}-enabled[\s\S]{0,900}<span>Show<\/span>/,
    "Editor frame header should label the plane enabled checkbox as Show.",
  );
  assert.match(
    editorSource,
    /scene-section-plane-\$\{controlKey\}-controls[\s\S]{0,900}<span>Controls<\/span>/,
    "Editor frame header should write per-axis Controls.",
  );
  assert.doesNotMatch(
    editorSource,
    /data-testid="scene-section-helper-visible"|<span style=\{nestedFieldLabelStyle\}>Gizmo<\/span>/,
    "The global Gizmo checkbox should be removed.",
  );
});

test("scene section controlsVisible gates helpers without using legendVisible", () => {
  assert.match(
    typesSource,
    /controlsVisible\?: boolean/,
    "SceneSectionFrameState should carry per-axis Controls visibility.",
  );
  assert.match(
    controllerSource,
    /controlsVisible/,
    "Runtime helper visibility should read controlsVisible.",
  );
  assert.doesNotMatch(
    controllerSource,
    /frameHelperVisible\s*=\s*frame\?\.legendVisible/,
    "Runtime helpers should not be gated by the stale legendVisible field.",
  );
});
