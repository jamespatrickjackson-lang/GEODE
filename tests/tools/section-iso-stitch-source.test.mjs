import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("section ISO segment stitching avoids front-of-array insertion", () => {
  const source = fs.readFileSync(
    new URL("../../src/scene/isoOverlays/sectionIsoOverlay.ts", import.meta.url),
    "utf8",
  );
  const stitchStart = source.indexOf("function stitchSectionIsoSegments");
  const stitchEnd = source.indexOf("function appendSectionIsoRibbonSegment");
  assert.notEqual(stitchStart, -1);
  assert.notEqual(stitchEnd, -1);
  const stitchSource = source.slice(stitchStart, stitchEnd);

  assert.doesNotMatch(stitchSource, /\.unshift\s*\(/);
});

test("section ISO segment stitching avoids full segment record cloning", () => {
  const source = fs.readFileSync(
    new URL("../../src/scene/isoOverlays/sectionIsoOverlay.ts", import.meta.url),
    "utf8",
  );
  const stitchStart = source.indexOf("function stitchSectionIsoSegments");
  const stitchEnd = source.indexOf("function appendSectionIsoRibbonSegment");
  assert.notEqual(stitchStart, -1);
  assert.notEqual(stitchEnd, -1);
  const stitchSource = source.slice(stitchStart, stitchEnd);

  assert.doesNotMatch(stitchSource, /\.\.\.segment\b/);
});

test("section ISO point hashing avoids array allocation in the hot path", () => {
  const source = fs.readFileSync(
    new URL("../../src/scene/isoOverlays/sectionIsoOverlay.ts", import.meta.url),
    "utf8",
  );
  const keyStart = source.indexOf("function sectionIsoPointHash");
  const keyEnd = source.indexOf("function sectionIsoPolylineLength");
  assert.notEqual(keyStart, -1);
  assert.notEqual(keyEnd, -1);
  const keySource = source.slice(keyStart, keyEnd);

  assert.doesNotMatch(keySource, /\.join\s*\(/);
});

test("section ISO stitching avoids string-key records in the hot path", () => {
  const source = fs.readFileSync(
    new URL("../../src/scene/isoOverlays/sectionIsoOverlay.ts", import.meta.url),
    "utf8",
  );
  const stitchStart = source.indexOf("function stitchSectionIsoSegments");
  const stitchEnd = source.indexOf("function appendSectionIsoRibbonSegment");
  assert.notEqual(stitchStart, -1);
  assert.notEqual(stitchEnd, -1);
  const stitchSource = source.slice(stitchStart, stitchEnd);

  assert.doesNotMatch(stitchSource, /Map<string,\s*SectionIsoContourNode>/);
  assert.doesNotMatch(stitchSource, /\b[ab]Key:\s*string\b/);
});
