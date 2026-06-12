import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const sceneSectionController = readFileSync(
  "src/scene/section/sceneSectionController.ts",
  "utf8",
);
const sceneSectionPlanesContainer = readFileSync(
  "src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx",
  "utf8",
);
const decisions = readFileSync("docs/03-decisions.md", "utf8");

test("GDR 1255 station locations are supported section object targets", () => {
  assert.doesNotMatch(
    sceneSectionController,
    /addLayer\(\s*UTAH_FORGE_MT_STATIONS_LAYER_ID\s*,\s*false\s*\)/,
    "Runtime section object targets should not hard-disable GDR 1255 stations.",
  );
  assert.doesNotMatch(
    sceneSectionPlanesContainer,
    /supported:\s*layerId\s*!==\s*UTAH_FORGE_MT_STATIONS_LAYER_ID/,
    "Editor fallback section object targets should not hard-disable GDR 1255 stations.",
  );
});

test("section object visibility presents categorized target groups", () => {
  for (const label of [
    "Seismic 3D",
    "Seismic 2D",
    "MT",
    "Station Locations",
    "Reference / Context",
    "Other",
  ]) {
    assert.match(
      sceneSectionPlanesContainer,
      new RegExp(label.replace(/[ /]/g, "[ /]")),
      `Section object visibility should define a '${label}' group.`,
    );
  }
  assert.match(
    sceneSectionPlanesContainer,
    /scene-section-object-visibility-group-\$\{group\.id\}/,
    "Section object visibility group headings should have stable test ids.",
  );
  assert.match(
    sceneSectionPlanesContainer,
    /sceneSectionObjectTargetGroups/,
    "Object visibility targets should be grouped before rendering.",
  );
});

test("seismic section object targets distinguish volume and rendered section images", () => {
  assert.match(
    sceneSectionController,
    /sceneSectionProductObjectId\([^)]*kind:\s*"section"\s*\|\s*"volume"/s,
    "Runtime seismic section target ids should include a representation kind.",
  );
  assert.match(
    sceneSectionController,
    /obj\.userData\?\.seismicRaymarchVolume\s*===\s*true[\s\S]*sceneSectionProductObjectId\([^)]*"volume"/,
    "Raymarch volume meshes should resolve to a volume-specific section object target.",
  );
  assert.match(
    sceneSectionController,
    /obj\.userData\?\.seismicSection\s*===\s*true[\s\S]*sceneSectionProductObjectId\([^)]*"section"/,
    "Rendered seismic section meshes should resolve to a section-image-specific section object target.",
  );
  assert.match(
    sceneSectionController,
    /seismicRaymarchVolume\s*===\s*true[\s\S]*volume[\s\S]*seismicSection\s*===\s*true[\s\S]*section/s,
    "Runtime target discovery should publish separate volume and section-image targets.",
  );
  assert.match(
    sceneSectionPlanesContainer,
    /productObjectId\([^)]*kind:\s*"section"\s*\|\s*"volume"/s,
    "Editor fallback seismic target ids should include the same representation kind.",
  );
  assert.match(
    decisions,
    /DEC-157 - Scene sections target seismic representations separately[\s\S]*`:volume`[\s\S]*`:section`[\s\S]*seismicRenderMode/,
    "Durable decisions should guard representation-specific seismic section targets and quick-legend render-mode ownership.",
  );
});
