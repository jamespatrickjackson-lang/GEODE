import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readSource(path) {
  return readFileSync(path, "utf8");
}

test("seismic capability containers start collapsed and toggle from heading", () => {
  const source = readSource(
    "src/editor/layerControls/seismic/SeismicCapabilityLayerItem.tsx",
  );

  assert.match(
    source,
    /const \[open, setOpen\] = useState\(false\)/,
    "seismic capability containers should start collapsed",
  );
  assert.match(
    source,
    /<button[\s\S]*aria-expanded=\{open\}[\s\S]*onClick=\{\(\) => setOpen\(\(value\) => !value\)\}/,
    "seismic capability headings should toggle collapsed state",
  );
  assert.match(
    source,
    /appearance: "none"[\s\S]*background: "transparent"/,
    "seismic capability heading buttons should not render browser-default light button chrome",
  );
  assert.match(
    source,
    /<EditorEyeButton[\s\S]*onClick=\{\(event\) => \{[\s\S]*event\.stopPropagation\(\);[\s\S]*onVisibleChange\(!visible\);[\s\S]*\}\}/,
    "seismic capability headings should use a separate functional show/hide eye",
  );
  assert.doesNotMatch(
    source,
    /panelStyles\.layerType/,
    "seismic capability headings should not render far-right type words",
  );
  assert.match(
    source,
    /\{open \? <div style=\{layerControlsStyle\}>\{children\}<\/div> : null\}/,
    "seismic capability children should render only while open",
  );
});

test("editor show/hide eye controls stay transparent", () => {
  const sharedEyeSource = readSource("src/editor/styleControls.tsx");
  const legacyLayerEyeSource = readSource("src/editor/LayerPanel.tsx");

  assert.match(
    sharedEyeSource,
    /export function editorEyeButtonStyle[\s\S]*background: "transparent"[\s\S]*boxShadow: "none"/,
    "shared editor eye buttons should not have filled backgrounds",
  );
  assert.doesNotMatch(
    sharedEyeSource,
    /background:\s*visible\s*\?/,
    "shared editor eye buttons should not color their background by visible state",
  );
  assert.match(
    legacyLayerEyeSource,
    /function layerVisibilityButtonStyle[\s\S]*background: "transparent"[\s\S]*boxShadow: "none"/,
    "legacy layer eye buttons should not have filled backgrounds",
  );
  assert.doesNotMatch(
    legacyLayerEyeSource,
    /background:\s*visible\s*\?/,
    "legacy layer eye buttons should not color their background by visible state",
  );
});

test("seismic isobands does not add a redundant nested dropdown", () => {
  const sharedIsobandsSource = readSource(
    "src/editor/layerControls/mt/IsobandControls.tsx",
  );
  const seismicSource = readSource(
    "src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx",
  );

  assert.match(
    sharedIsobandsSource,
    /nestedContainer = true/,
    "shared IsobandControls should allow callers to suppress its wrapper details",
  );
  assert.match(
    seismicSource,
    /<IsobandControls[\s\S]*nestedContainer=\{false\}/,
    "seismic Isobands should render controls directly inside the peer container",
  );
});

test("editor details containers do not opt into open-by-default behavior", () => {
  const checkedFiles = [
    "src/editor/LayerPanel.tsx",
    "src/editor/SiteDetailsPanel.tsx",
    "src/editor/topoMap/TopoMapPanel.tsx",
    "src/editor/layerControls/atmosphere/AtmosphereVolumeControls.tsx",
    "src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx",
  ];

  for (const path of checkedFiles) {
    const source = readSource(path);
    assert.doesNotMatch(
      source,
      /defaultOpen\s*=\s*true/,
      `${path} should not default containers open`,
    );
    assert.doesNotMatch(
      source,
      /<details\b[^>]*\sopen(?:\s|>|=\{true\})/,
      `${path} should not hard-code details open`,
    );
  }

  const siteDetailsSource = readSource("src/editor/SiteDetailsPanel.tsx");
  assert.doesNotMatch(
    siteDetailsSource,
    /<AutoOpenDetails[^>]*\bdefaultOpen\b/,
    "Site Details nested containers should not request defaultOpen",
  );
});

test("layer groups are not opened by active visible layers on startup", () => {
  const source = readSource("src/editor/LayerPanelGroups.tsx");

  assert.match(
    source,
    /const resolvedGroupOpenSignal = revealGroupOpenSignal;/,
    "regular layer groups should only use reveal signals for automatic expansion",
  );
  assert.doesNotMatch(
    source,
    /const groupOpenSignal = activeLayerOpenSignal/,
    "active visible layers should not open groups during startup",
  );
  assert.doesNotMatch(
    source,
    /const sceneSectionOpenSignal =/,
    "scene section groups should not auto-open from active scene-section state",
  );
  assert.doesNotMatch(
    source,
    /const workingAreaFocusOpenSignal =/,
    "working-area groups should not auto-open from active focus state",
  );
});
