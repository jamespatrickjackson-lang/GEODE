import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { reviewTest } from "./reviewFlag.mjs";

function readSource(...segments) {
  return readFileSync(join(...segments), "utf8");
}

test("seismic legend renders figure and source-domain axis metadata from the shared model", () => {
  const source = readSource("src", "ui", "SeismicVolumeLegend.tsx");

  assert.match(source, /buildSeismicFigureModel/);
  assert.match(source, /data-testid="seismic-figure-box"/);
  assert.match(source, /data-testid="seismic-primary-axis"/);
  assert.match(source, /figureModel\.figureLines/);
  assert.match(source, /figureModel\.primaryAxis\.ticks/);
  assert.match(source, /background:\s*"rgba\(0,\s*0,\s*0,\s*0\.32\)"/);
});

reviewTest("SOURCE-CONTRACT-RISK", "MT resistivity legend renders slice figure metadata from static slice product extents", () => {
  const legend = readSource("src", "ui", "ResistivityLegend.tsx");
  const sliceProducts = readSource("src", "mtResistivity", "sliceProducts.ts");

  assert.match(legend, /buildMtResistivityFigureModel/);
  assert.match(legend, /mtResistivitySliceById/);
  assert.match(legend, /data-testid=\{testId\("resistivity-figure-box"\)\}/);
  assert.match(legend, /data-testid=\{testId\("resistivity-primary-axis"\)\}/);
  assert.match(legend, /background:\s*"rgba\(0,\s*0,\s*0,\s*0\.32\)"/);
  assert.match(sliceProducts, /sourceWindowM/);
  assert.match(sliceProducts, /sectionLine/);
});
