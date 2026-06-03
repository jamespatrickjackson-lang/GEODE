import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

function readJson(...segments) {
  return JSON.parse(readFileSync(join(...segments), "utf8"));
}

async function loadFigureModelModule() {
  const source = readFileSync(
    join(process.cwd(), "src", "geophysics", "geophysicsFigureModel.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString(
    "base64",
  )}`;
  return import(dataUrl);
}

test("seismic figure model exposes TWT side-axis numbers and source figure text for unmigrated time products", async () => {
  const { buildSeismicFigureModel } = await loadFigureModelModule();
  const manifest = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_manifest.json",
  );
  const product = manifest.products.find(
    (candidate) => candidate.id === "gdr-1141-line-301-unmigrated-stack",
  );

  const model = buildSeismicFigureModel({
    product,
    renderMode: "slice",
    sliceAxis: "line",
  });

  assert.equal(model.artifactFamily, "seismic");
  assert.equal(model.primaryAxis.heading, "Two-way travel time (TWT)");
  assert.equal(model.primaryAxis.unit, "ms");
  assert.deepEqual(
    model.primaryAxis.ticks.map((tick) => tick.label),
    ["0", "1,000", "2,000", "3,000", "4,000"],
  );
  assert.match(model.figureLines.join("\n"), /2D Line 301 unmigrated time stack/);
  assert.match(model.figureLines.join("\n"), /Datum: 1,800 m ASL/);
  assert.match(model.figureLines.join("\n"), /Source: GDR 1141/);
  assert.match(model.figureLines.join("\n"), /Delivered navigation present/);
  assert.match(model.primaryAxis.caveat, /display-derived/i);
});

test("seismic figure model keeps depth and velocity products in their source units", async () => {
  const { buildSeismicFigureModel } = await loadFigureModelModule();
  const manifest = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "seismic_analysis",
    "browser",
    "seismic_manifest.json",
  );
  const depthProduct = manifest.products.find(
    (candidate) => candidate.id === "gdr-1141-line-301-pdm-enh",
  );
  const velocityProduct = manifest.products.find(
    (candidate) => candidate.id === "gdr-1141-line-301-psdm-interval-velocity",
  );

  const depthModel = buildSeismicFigureModel({ product: depthProduct });
  const velocityModel = buildSeismicFigureModel({ product: velocityProduct });

  assert.equal(depthModel.primaryAxis.heading, "Depth below seismic datum");
  assert.equal(depthModel.primaryAxis.unit, "m");
  assert.deepEqual(
    depthModel.primaryAxis.ticks.map((tick) => tick.label),
    ["0", "1,500", "3,000", "4,500", "6,000"],
  );
  assert.ok(
    depthModel.primaryAxis.ticks.some((tick) =>
      /Elevation -1,200 m ASL/.test(tick.secondaryLabel ?? ""),
    ),
    "depth ticks should expose absolute elevation side labels",
  );
  assert.equal(velocityModel.valueAxis?.heading, "Interval velocity");
  assert.equal(velocityModel.valueAxis?.unit, "m/s");
  assert.deepEqual(
    velocityModel.valueAxis?.ticks.map((tick) => tick.label),
    ["2,000", "2,750", "3,500", "4,250", "5,000"],
  );
});

test("MT figure model exposes slice elevation, section distance, and source-window text", async () => {
  const { buildMtResistivityFigureModel } = await loadFigureModelModule();
  const manifest = readJson(
    "projects",
    "utah-forge",
    "data",
    "geosee_processed",
    "utah_forge_phase_3",
    "electrical_resistivity",
    "resistivity_model",
    "slices",
    "manifest.json",
  );
  const horizontalSlice = manifest.slices.find(
    (candidate) => candidate.id === "horizontal_elev_1500m",
  );
  const verticalSection = manifest.slices.find(
    (candidate) => candidate.id === "vertical_ew_station_centroid",
  );

  const horizontalModel = buildMtResistivityFigureModel({
    slice: horizontalSlice,
    sourceOrigin: "Utah FORGE GDR submission 1255 updated MT model",
  });
  const verticalModel = buildMtResistivityFigureModel({
    slice: verticalSection,
    sourceOrigin: "Utah FORGE GDR submission 1255 updated MT model",
  });

  assert.equal(horizontalModel.primaryAxis.heading, "Elevation");
  assert.equal(horizontalModel.primaryAxis.unit, "m ASL");
  assert.deepEqual(
    horizontalModel.primaryAxis.ticks.map((tick) => tick.label),
    ["1,500"],
  );
  assert.match(horizontalModel.figureLines.join("\n"), /Window: \+\/-180 m/);
  assert.equal(verticalModel.primaryAxis.heading, "Elevation");
  assert.equal(verticalModel.horizontalAxis?.heading, "East-west distance");
  assert.deepEqual(
    verticalModel.horizontalAxis?.ticks.map((tick) => tick.label),
    ["-139,571", "-69,785", "0", "69,785", "139,571"],
  );
  assert.match(verticalModel.figureLines.join("\n"), /Window: \+\/-4,500 m/);
});

test("MT figure model accepts the static browser slice product shape", async () => {
  const { buildMtResistivityFigureModel } = await loadFigureModelModule();

  const model = buildMtResistivityFigureModel({
    slice: {
      id: "horizontal_elev_minus5000m",
      label: "-5000 m horizontal",
      kind: "horizontal-slice",
      elevationM: -5000,
      sourceWindowM: 1300,
    },
    sourceOrigin: "Utah FORGE GDR submission 1255 updated MT model",
  });

  assert.equal(model.primaryAxis.heading, "Elevation");
  assert.deepEqual(
    model.primaryAxis.ticks.map((tick) => tick.label),
    ["-5,000"],
  );
  assert.match(model.figureLines.join("\n"), /Window: \+\/-1,300 m/);
});
