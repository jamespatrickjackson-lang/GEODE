import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const repoRoot = process.cwd();

function readSource(...parts) {
  return readFileSync(join(repoRoot, ...parts), "utf8");
}

const editorRoot = readSource("src", "editor", "EditorRoot.tsx");
const collapsibleSection = readSource(
  "src",
  "editor",
  "CollapsibleSection.tsx",
);
const environmentPanel = readSource(
  "src",
  "editor",
  "EnvironmentScenePanel.tsx",
);
const devModeInspector = readSource(
  "src",
  "editor",
  "DevModeInspector.tsx",
);
// The dev-mode control panel + slider primitives were split out of
// DevModeInspector.tsx into devMode/ (refactor); read them at their new homes.
const devControlPanel = readSource(
  "src",
  "editor",
  "devMode",
  "ControlPanel.tsx",
);
const devControls = readSource("src", "editor", "devMode", "controls.tsx");
const styleControls = readSource("src", "editor", "styleControls.tsx");
const sceneOverlayControls = readSource(
  "src",
  "editor",
  "layerControls",
  "overlays",
  "SceneOverlayControls.tsx",
);
const typesSource = readSource("src", "pages", "types.ts");

test("save button is icon-only chrome with active count and configurable icon size", () => {
  assert.match(
    typesSource,
    /saveIconSizePx\?:\s*number/,
    "EditorChromeSettings should expose saveIconSizePx.",
  );
  assert.match(
    editorRoot,
    /const\s+editorSaveIconSize\s*=\s*clampEditorNumber\(\s*editorChromeSettings\.saveIconSizePx/s,
    "EditorRoot should resolve the save icon size from editor chrome settings.",
  );
  assert.match(
    editorRoot,
    /<SaveButton\s+iconSizePx=\{editorSaveIconSize\}/,
    "SaveButton should receive the configurable icon size.",
  );
  assert.match(
    editorRoot,
    /dirtyCount\s*>\s*0\s*&&\s*\(/,
    "Save dirty count should render only while there are pending edits.",
  );
  assert.doesNotMatch(
    editorRoot,
    /background:\s*hasUnsaved\s*\?[\s\S]*rgba\(255,\s*111,\s*127/,
    "Save button should not use an active button-fill background.",
  );
  assert.match(
    editorRoot,
    /background:\s*"transparent"/,
    "Save button background should be transparent.",
  );
  assert.match(
    editorRoot,
    /function\s+SaveDiskIcon\(\{\s*sizePx\s*\}/,
    "SaveDiskIcon should render at the configured size.",
  );
  assert.match(
    environmentPanel,
    /<Row label="Save icon">[\s\S]*saveIconSizePx/,
    "Cinematics Editor controls should expose Save icon size.",
  );
  assert.match(
    devControlPanel,
    /label="Save icon"[\s\S]*saveIconSizePx/,
    "Dev control panel should expose Save icon size.",
  );
});

test("top-level sections have a body container separate from heading alignment", () => {
  assert.match(
    collapsibleSection,
    /data-dev-container-type="top-level-section-body"/,
    "CollapsibleSection should expose a selectable body container.",
  );
  assert.match(
    collapsibleSection,
    /panelStyles\.collapsibleBodyFrame/,
    "Top-level children should render inside their own body frame.",
  );
  assert.match(
    readSource("src", "editor", "styles.ts"),
    /collapsibleBodyFrame:\s*\{[\s\S]*var\(--editor-container-body-indent/,
    "Body frame should use the body-indent variable independently of heading padding.",
  );
});

test("sliders use a transient cursor pill instead of persistent trailing numbers", () => {
  const transientSlider = readSource("src", "editor", "TransientSlider.tsx");
  const rangeCursorValueOverlay = readSource(
    "src",
    "editor",
    "RangeCursorValueOverlay.tsx",
  );
  assert.match(
    transientSlider,
    /onPointerDown=\{showPill\}/,
    "Slider should show its value pill on pointer down.",
  );
  assert.match(
    transientSlider,
    /onPointerUp=\{hidePill\}/,
    "Slider should hide its value pill on pointer up.",
  );
  assert.match(
    transientSlider,
    /position:\s*"fixed"/,
    "Slider value pill should render as a cursor-following fixed pill.",
  );
  assert.match(
    transientSlider,
    /cursor:\s*pill\s*\?\s*"none"/,
    "Slider cursor should disappear while the value pill is active.",
  );
  assert.match(
    editorRoot,
    /<RangeCursorValueOverlay\s*\/>/,
    "Editor root should install the fallback cursor pill for legacy native range inputs.",
  );
  assert.match(
    rangeCursorValueOverlay,
    /target\.type\s*!==\s*"range"/,
    "Fallback cursor pill should target native range inputs.",
  );
  assert.match(
    rangeCursorValueOverlay,
    /target\.dataset\.transientSlider\s*===\s*"true"/,
    "Fallback cursor pill should skip sliders that already render their own transient pill.",
  );
  assert.match(
    rangeCursorValueOverlay,
    /target\.style\.cursor\s*=\s*"none"/,
    "Fallback cursor pill should hide the cursor while active.",
  );
  assert.match(
    rangeCursorValueOverlay,
    /data-dev-slider-value-pill="true"/,
    "Fallback cursor pill should expose a stable dev/test selector.",
  );

  assert.doesNotMatch(
    environmentPanel,
    /environmentNumberReadoutStyle/,
    "Cinematics sliders should not render persistent number readouts.",
  );
  assert.doesNotMatch(
    styleControls,
    /sliderNumberReadoutStyle|safeValue\.toFixed\(decimals\)/,
    "Layer style sliders should not render persistent trailing numbers.",
  );
  assert.doesNotMatch(
    devControls,
    /<span style=\{devControlValueStyle\}>\{format\(value\)\}<\/span>/,
    "Dev inspector sliders should not render persistent trailing numbers.",
  );
  assert.doesNotMatch(
    sceneOverlayControls,
    /<span style=\{panelStyles\.numberReadout\}>/,
    "Scene overlay sliders should not render persistent trailing numbers.",
  );
});
