import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readSource(path) {
  return readFileSync(path, "utf8");
}

function assertContainsAll(source, labels, messagePrefix) {
  for (const label of labels) {
    assert.match(
      source,
      new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `${messagePrefix}: expected ${label}`,
    );
  }
}

const componentPath =
  "src/editor/layerControls/seismic/SectionGraphOptionsControls.tsx";
const componentSource = existsSync(componentPath) ? readSource(componentPath) : "";
const modelSource = readSource("src/editor/layerControls/seismic/seismicModel.ts");
const containerSource = readSource(
  "src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx",
);
const legendSource = readSource("src/ui/SceneSectionLegend.tsx");

const sectionOptionHeadings = [
  "3D Volume",
  "3D Section Plane",
  "2D Section Line",
  "Processing Comparison",
  "Integrated Geophysics",
  "Survey Geometry",
  "Figure Annotation",
];

const selectableLabels = [
  "PSDM depth volume",
  "Presentation-enhanced PSDM surrogate",
  "PSTM time volume",
  "FXY decon time volume",
  "Velocity model",
  "Inline slice",
  "Crossline slice",
  "Time/depth plane",
  "Volume + synced slice",
  "Line 301 depth sections",
  "Line 301 time sections",
  "Line 301 velocity section",
  "Line 302 depth sections",
  "Line 302 time sections",
  "Line 302 velocity section",
  "Line L5 depth sections",
  "Line L5 time sections",
  "Line L5 velocity section",
  "Line L11 depth sections",
  "Line L11 time sections",
  "Line L11 velocity section",
  "Line 301 enhanced vs unenhanced",
  "Line 302 enhanced vs unenhanced",
  "Line L5 enhanced vs unenhanced",
  "Line L11 enhanced vs unenhanced",
  "Overlay mode",
  "Side-by-side mode",
  "Side-by-side spacing",
  "Seismic only",
  "MT only",
  "Seismic + MT",
  "PSDM + MT + 58-32 tie",
  "Isoband source: seismic amplitude",
  "Isoband source: MT resistivity",
  "Sources",
  "Receivers",
  "Navigation lines",
  "Show survey geometry",
  "Frame",
  "Title",
  "Caption",
  "Scale label / scale bar",
  "Axis ticks and depth/time heading",
  "Direction labels",
  "Caption box",
  "Well trace and well label",
  "Horizon polyline",
  "Text size",
  "Outside offset",
  "Text, axis, caption box, horizon, and well colors",
];

test("Section Options graph selector has one shared editor and legend component", () => {
  assert.equal(
    existsSync(componentPath),
    true,
    "shared SectionGraphOptionsControls component should exist",
  );
  assert.match(
    componentSource,
    /export function SectionGraphOptionsControls/,
    "shared component should be exported",
  );
  assert.match(
    containerSource,
    /<SectionGraphOptionsControls/,
    "editor seismic Section Options should use the shared component",
  );
  assert.match(
    legendSource,
    /<SectionGraphOptionsControls/,
    "quick legend popout should use the shared component",
  );
});

test("Section Options model exposes all requested headings and selectable labels", () => {
  assert.match(
    modelSource,
    /SEISMIC_SECTION_GRAPH_HEADINGS/,
    "seismic model should expose Section Options headings",
  );
  assert.match(
    modelSource,
    /seismicSectionGraphOptionGroups/,
    "seismic model should expose grouped Section Options",
  );
  assertContainsAll(modelSource, sectionOptionHeadings, "model headings");
  assertContainsAll(
    `${modelSource}\n${componentSource}`,
    selectableLabels,
    "section option selectable labels",
  );
});

test("Section Options selectable types patch existing seismic style fields", () => {
  const helperStart = modelSource.indexOf("export function seismicSectionGraphOptionGroups");
  assert.notEqual(helperStart, -1, "graph option grouping helper should exist");
  const helperSource = modelSource.slice(helperStart);
  assert.match(modelSource, /function seismicCapabilityPresetPatch|export function seismicCapabilityPresetPatch/);
  assert.match(helperSource, /optionFromPreset/);
  assert.match(helperSource, /seismicProductId/);
  assert.match(helperSource, /seismicProductVisibility/);
  assert.match(helperSource, /seismicRenderMode/);
  assert.match(helperSource, /seismicSliceAxis:\s*"inline"/);
  assert.match(helperSource, /seismicSliceAxis:\s*"crossline"/);
  assert.match(helperSource, /seismicSliceAxis:\s*"sample"/);
  assert.match(helperSource, /seismicSliceThroughVolume:\s*true/);
  assert.match(helperSource, /seismicComparisonProductId/);
  assert.match(helperSource, /seismicComparisonMode/);
  assert.match(helperSource, /seismicMtCoRender/);
  assert.match(helperSource, /seismicIsoSource/);
  assert.match(helperSource, /seismicNavigationRoleVisibility/);
});

test("Section Options surface excludes Presentation Presets and export layout UI", () => {
  const sectionOptionsSource = `${componentSource}\n${legendSource}`;
  assert.doesNotMatch(sectionOptionsSource, /Presentation Presets/i);
  assert.doesNotMatch(sectionOptionsSource, /seismicAudiencePresetId/);
  assert.doesNotMatch(sectionOptionsSource, /seismicExportLayoutId/);
  assert.doesNotMatch(sectionOptionsSource, /seismicAudiencePresets/);
  assert.doesNotMatch(sectionOptionsSource, /seismicExportLayouts/);
});
