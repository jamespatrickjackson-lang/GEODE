import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readSource(path) {
  return readFileSync(path, "utf8");
}

function assertOrder(source, labels) {
  let previousIndex = -1;
  for (const label of labels) {
    const index = source.indexOf(label);
    assert.notEqual(index, -1, `expected source to contain ${label}`);
    assert.ok(
      index > previousIndex,
      `expected ${label} after previous seismic container`,
    );
    previousIndex = index;
  }
}

test("seismic browser page override fields preserve per-product state", () => {
  const configSource = readSource(
    "src/editor/layerControls/layerPanelConfig.ts",
  );
  const fieldsStart = configSource.indexOf("export const SEISMIC_BROWSER_FIELDS");
  const fieldsEnd = configSource.indexOf(
    "] as const satisfies readonly (keyof EditableStyle)[];",
    fieldsStart,
  );
  assert.ok(fieldsStart >= 0, "SEISMIC_BROWSER_FIELDS should exist");
  assert.ok(fieldsEnd > fieldsStart, "SEISMIC_BROWSER_FIELDS should close");
  const fieldBlock = configSource.slice(fieldsStart, fieldsEnd);

  assert.match(
    fieldBlock,
    /"seismicProductStates"/,
    "page override clearing should include per-product seismic display states",
  );
  for (const field of [
    "seismicVerticalDatumMode",
    "seismicFigureAnnotationsVisible",
    "seismicFigureTitle",
    "seismicFigureCaption",
    "seismicFigureScaleLabel",
    "seismicFigureTextColor",
    "seismicFigureAxisColor",
    "seismicFigureCaptionBoxColor",
    "seismicFigureCaptionBoxOpacity",
    "seismicFigureOutsideOffsetM",
    "seismicFigureLabelSizeM",
    "seismicFigureWellVisible",
    "seismicFigureWellLabel",
    "seismicFigureWellPosition",
    "seismicFigureWellColor",
    "seismicFigureHorizonVisible",
    "seismicFigureHorizonPoints",
    "seismicFigureHorizonColor",
  ]) {
    assert.match(
      fieldBlock,
      new RegExp(`"${field}"`),
      `page override clearing should include ${field}`,
    );
  }

  const patchSource = readSource(
    "src/editor/layerControls/seismic/seismicModel.ts",
  );
  const patchStart = patchSource.indexOf("export function seismicBrowserPatchFromStyle");
  assert.notEqual(patchStart, -1, "seismicBrowserPatchFromStyle should exist");
  const patchBlock = patchSource.slice(patchStart);
  for (const field of [
    "seismicFigureAnnotationsVisible",
    "seismicFigureTitle",
    "seismicFigureCaption",
    "seismicFigureScaleLabel",
    "seismicFigureTextColor",
    "seismicFigureAxisColor",
    "seismicFigureCaptionBoxColor",
    "seismicFigureCaptionBoxOpacity",
    "seismicFigureOutsideOffsetM",
    "seismicFigureLabelSizeM",
    "seismicFigureWellVisible",
    "seismicFigureWellLabel",
    "seismicFigureWellPosition",
    "seismicFigureWellColor",
    "seismicFigureHorizonVisible",
    "seismicFigureHorizonPoints",
    "seismicFigureHorizonColor",
  ]) {
    assert.match(
      patchBlock,
      new RegExp(`${field}:`),
      `seismicBrowserPatchFromStyle should preserve ${field}`,
    );
  }
});

test("seismic analysis group promotes capability containers over legacy layer row", () => {
  const groupSource = readSource("src/editor/LayerPanelGroups.tsx");
  const specialCaseStart = groupSource.indexOf(
    'devSource="src/editor/LayerPanelGroups.tsx:seismic-analysis"',
  );
  assert.notEqual(
    specialCaseStart,
    -1,
    "LayerPanelGroups should special-case the Seismic analysis group",
  );
  const specialCaseEnd = groupSource.indexOf(
    'group.title === "Site Details"',
    specialCaseStart,
  );
  assert.ok(
    specialCaseEnd > specialCaseStart,
    "seismic group special case should appear before Site Details",
  );
  const specialCase = groupSource.slice(specialCaseStart, specialCaseEnd);

  assert.match(
    specialCase,
    /<SeismicCapabilityLayerContainers/,
    "promoted seismic group should render the capability container stack",
  );
  assert.doesNotMatch(
    specialCase,
    /renderedLayers\.map\(renderLayer\)/,
    "promoted seismic group should not lead with the legacy physical layer row",
  );
  assert.match(
    specialCase,
    /onToggleOverride=/,
    "promoted seismic group should keep page override toggle wiring",
  );
  assert.doesNotMatch(
    specialCase,
    /<SeismicSurveyGeometryControls/,
    "survey geometry should move out of Seismic analysis",
  );
});

test("site details composes seismic survey geometry as a separate container", () => {
  const groupSource = readSource("src/editor/LayerPanelGroups.tsx");
  const siteDetailsStart = groupSource.indexOf('group.title === "Site Details"');
  assert.notEqual(
    siteDetailsStart,
    -1,
    "LayerPanelGroups should special-case the Site Details group",
  );
  const siteDetailsEnd = groupSource.indexOf(
    'section === "sectionsCropping"',
    siteDetailsStart,
  );
  assert.ok(siteDetailsEnd > siteDetailsStart, "Site Details branch should close");
  const siteDetailsBranch = groupSource.slice(siteDetailsStart, siteDetailsEnd);

  assert.match(
    siteDetailsBranch,
    /<SeismicSurveyGeometryContainer/,
    "Site Details should render the seismic survey geometry container",
  );
  assert.match(
    siteDetailsBranch,
    /seismicSurveyGeometry=/,
    "Site Details panel should receive survey geometry as a separate slot",
  );

  const siteDetailsSource = readSource("src/editor/SiteDetailsPanel.tsx");
  assert.match(
    siteDetailsSource,
    /seismicSurveyGeometry\?: React\.ReactNode/,
    "SiteDetailsPanel should expose a separate survey geometry slot",
  );
  assert.match(
    siteDetailsSource,
    /\{seismicSurveyGeometry \?\? null\}/,
    "SiteDetailsPanel should render survey geometry separately from Source Locations",
  );
});

test("seismic capability containers follow MT-like data to display order", () => {
  const containerSource = readSource(
    "src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx",
  );
  const graphControlsSource = readSource(
    "src/editor/layerControls/seismic/SectionGraphOptionsControls.tsx",
  );
  const seismicModelSource = readSource(
    "src/editor/layerControls/seismic/seismicModel.ts",
  );

  assert.match(
    containerSource,
    /title="Isobands"/,
    "seismic section ISO controls should live in a dedicated Isobands container",
  );
  assert.match(
    containerSource,
    /sceneSectionStyle=\{sceneSectionStyle\}/,
    "Isobands should preserve seismic section ISO controls",
  );
  assert.match(
    containerSource,
    /testId="seismic-capability-depth-window"/,
    "seismic editor should expose a depth-window shortcut container",
  );
  assert.match(
    containerSource,
    /data-testid=\{`seismic-capability-depth-window-preset-\$\{preset\.id\}`\}/,
    "seismic editor should expose metadata-driven depth-window presets",
  );
  assert.match(
    containerSource,
    /linkedLayerStylePatches\?\.\[UTAH_FORGE_SCENE_SECTION_LAYER_ID\]/,
    "depth-window shortcut should be discovered from linked scene-section preset metadata",
  );
  assert.match(
    containerSource,
    /const seismicDepthWindowSceneSectionPatch[\s\S]*sceneSectionTargetLayerIds[\s\S]*layerId[\s\S]*sceneSectionTargetProductIds[\s\S]*productId/,
    "depth-window toggles should target the active seismic layer/product instead of reviving a generic Y window.",
  );
  assert.match(
    containerSource,
    /sceneSectionActiveFrameId:\s*activeFrameId/,
    "depth-window toggles should preserve an existing Y/source frame id.",
  );
  assert.match(
    containerSource,
    /commitSceneSectionStyle\(seismicDepthWindowSceneSectionPatch\(visible\)\)/,
    "depth-window visibility toggles should use the source-aware scene-section patch.",
  );
  assert.match(
    seismicModelSource,
    /linkedLayerStylePatches/,
    "seismic model should preserve linked layer patch metadata from capability presets",
  );
  assert.match(
    seismicModelSource,
    /verticalDatumMode/,
    "seismic model should preserve preset-owned vertical datum mode",
  );
  assert.doesNotMatch(
    containerSource,
    /title="Display"/,
    "Display should be renamed to Seismic rendering",
  );
  assert.doesNotMatch(
    containerSource,
    /title="Survey geometry"/,
    "survey geometry should not remain in Seismic analysis",
  );
  const mainComponentStart = containerSource.indexOf(
    "export function SeismicCapabilityLayerContainers",
  );
  assert.notEqual(
    mainComponentStart,
    -1,
    "capability container component should exist",
  );
  const returnStart = containerSource.indexOf("return (", mainComponentStart);
  assert.notEqual(returnStart, -1, "capability container should render markup");
  const returnSource = containerSource.slice(returnStart);

  assertOrder(returnSource, [
    "<SeismicSourceAndRegistrationControls",
    "<SectionGraphOptionsControls",
    'title="Seismic rendering"',
    'title="Depth window"',
    'title="Isobands"',
    'title="Source-gated products"',
  ]);
  assert.match(
    returnSource,
    /<SectionGraphOptionsControls/,
    "seismic product, comparison, integrated geophysics, survey, and figure controls should live in shared Section Options",
  );
  assert.match(
    graphControlsSource,
    /testId="seismic-section-options"/,
    "section graph controls should expose their own container test id",
  );
  assert.match(
    graphControlsSource,
    /section-graph-option-\$\{option\.id\}/,
    "section graph controls should expose option-derived test ids",
  );
  assertOrder(seismicModelSource, [
    '"3D Volume"',
    '"3D Section Plane"',
    '"2D Section Line"',
    '"Processing Comparison"',
    '"Integrated Geophysics"',
    '"Survey Geometry"',
    '"Figure Annotation"',
  ]);
  for (const label of [
    "Line 301 depth sections",
    "Line 302 time sections",
    "Line L5 velocity section",
    "Line L11 depth sections",
  ]) {
    assert.match(
      seismicModelSource,
      new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `section graph controls should expose ${label}`,
    );
  }
  assert.doesNotMatch(
    seismicModelSource,
    /id: "all-2d-sections"|id: "survey-plus-2d-sections"|id: "hide-2d-sections"/,
    "section graph controls should not expose old bulk 2D shortcut actions",
  );
  assert.doesNotMatch(
    returnSource,
    /<SeismicProductVisibilityControls|title="3D products"|title="2D product details"|title="2D sections"|title="Integrated geophysics"|title="Processing comparison"|title="Figure annotations"/,
    "legacy scattered seismic option containers should be replaced by shared Section Options",
  );

  const renderingStart = returnSource.indexOf('title="Seismic rendering"');
  const renderingEnd = returnSource.indexOf('title="Depth window"', renderingStart);
  assert.ok(renderingStart >= 0 && renderingEnd > renderingStart);
  const renderingContainer = returnSource.slice(renderingStart, renderingEnd);
  assert.doesNotMatch(
    renderingContainer,
    /layer-isobands-controls|seismic-navigation-visible/,
    "Seismic rendering should not contain isobands or survey navigation",
  );
});
