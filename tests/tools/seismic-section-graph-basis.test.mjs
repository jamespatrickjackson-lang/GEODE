import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();

async function loadBasisModule() {
  const tempRoot = join(
    repoRoot,
    ".tmp",
    `test-seismic-section-graph-basis-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const sourcePath = join(
    repoRoot,
    "src",
    "geophysics",
    "seismicSectionGraphBasis.ts",
  );
  const source = readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const modulePath = join(tempRoot, "seismicSectionGraphBasis.mjs");
  writeFileSync(modulePath, output);
  return import(pathToFileURL(modulePath).href);
}

test("trace path curtain basis uses full path distance and datum sample transform", async () => {
  const {
    buildSeismicSectionGraphBasis,
    distanceAlongTracePath,
    sampleToSceneZ,
  } = await loadBasisModule();
  const path = [
    [0, 0, 1800],
    [3000, 4000, 1800],
    [6000, 4000, 1800],
  ];
  assert.equal(distanceAlongTracePath(path), 8000);
  assert.equal(sampleToSceneZ(2000, 1800, 1, 50), -150);

  const basis = buildSeismicSectionGraphBasis(
    {
      id: "line-301-depth",
      axis: "line",
      path,
      sampleDomain: {
        kind: "depth",
        unit: "m",
        min: 0,
        max: 2500,
        verticalScaleMPerUnit: 1,
      },
      datumM: 1800,
    },
    {
      id: "gdr-1015-line-301",
      domainKind: "depth",
      domainUnit: "m",
      surveyKind: "2d",
    },
    {
      layerId: "utah-forge-phase3-seismic-browser",
      objectKind: "2d-section-line",
      objectId: "line-301-depth",
      verticalDatumMode: "source",
      verticalDatumOffsetM: 0,
    },
  );

  assert.equal(basis.kind, "trace-path-curtain");
  assert.equal(basis.productId, "gdr-1015-line-301");
  assert.equal(basis.objectKind, "2d-section-line");
  assert.equal(basis.entityKey, "layer:utah-forge-phase3-seismic-browser:product:gdr-1015-line-301:object:2d-section-line:line-301-depth");
  assert.equal(basis.representationKey, "seismic:2d-section-line");
  assert.equal(basis.pathDistanceM, 8000);
  assert.deepEqual(basis.pathDistancesM, [0, 5000, 8000]);
  assert.equal(basis.sampleToZ(2500), -700);
  assert.deepEqual(basis.topPolyline[0], [0, 0, 1800]);
  assert.deepEqual(basis.bottomPolyline.at(-1), [6000, 4000, -700]);
});

test("3d inline and crossline path curtains keep item identity separate from pages", async () => {
  const { buildSeismicSectionGraphBasis } = await loadBasisModule();
  for (const axis of ["inline", "crossline"]) {
    const basis = buildSeismicSectionGraphBasis(
      {
        id: `${axis}-slice-053`,
        axis,
        path: [
          [10, 0, 0],
          [10, 500, 0],
        ],
        sampleDomain: {
          kind: "depth",
          unit: "m",
          min: 500,
          max: 1500,
          verticalScaleMPerUnit: 1,
        },
        datumM: 1800,
      },
      {
        id: "gdr-1141-psdm",
        domainKind: "depth",
        domainUnit: "m",
        surveyKind: "3d",
      },
      {
        layerId: "utah-forge-phase3-seismic-browser",
        objectKind: "3d-section-plane",
        objectId: `${axis}-slice-053`,
        verticalDatumMode: "reference-1800m",
        verticalDatumOffsetM: 120,
      },
    );
    assert.equal(basis.kind, "trace-path-curtain");
    assert.equal(basis.representationKey, "seismic:3d-section-plane");
    assert.match(basis.entityKey, /product:gdr-1141-psdm:object:3d-section-plane/);
    assert.doesNotMatch(JSON.stringify(basis), /pageId|pageOrder|pageTitle/);
    assert.equal(basis.verticalDatumMode, "reference-1800m");
    assert.equal(basis.verticalDatumOffsetM, 120);
  }
});

test("survey geometry identity is role-aware and product-agnostic", async () => {
  const { seismicSurveyGeometryEntityKey } = await loadBasisModule();

  assert.equal(
    seismicSurveyGeometryEntityKey({
      layerId: "utah-forge-phase3-seismic-browser",
      role: "navigation",
    }),
    "layer:utah-forge-phase3-seismic-browser:object:survey-geometry:navigation",
  );
  assert.equal(
    seismicSurveyGeometryEntityKey({
      layerId: "utah-forge-phase3-seismic-browser",
      role: "lines",
    }),
    "layer:utah-forge-phase3-seismic-browser:object:survey-geometry:lines",
  );
  assert.doesNotMatch(
    seismicSurveyGeometryEntityKey({
      layerId: "utah-forge-phase3-seismic-browser",
      role: "sources",
    }),
    /product:/,
  );
});

test("figure annotation identity wraps the runtime section graph entity key", async () => {
  const { seismicFigureAnnotationEntityKey } = await loadBasisModule();
  const sectionEntityKey =
    "layer:utah-forge-phase3-seismic-browser:product:gdr-1141:object:3d-section-plane:inline-053";

  assert.equal(
    seismicFigureAnnotationEntityKey({ sectionEntityKey }),
    `${sectionEntityKey}:figure-annotation`,
  );
});

test("sample plane basis accepts fixed sample domains without vertical depth axis", async () => {
  const { buildSeismicSectionGraphBasis } = await loadBasisModule();
  const basis = buildSeismicSectionGraphBasis(
    {
      id: "sample-1800",
      axis: "sample",
      surfaceGrid: {
        corners: {
          sw: [0, 0, 0],
          nw: [0, 1000, 0],
          ne: [2000, 1000, 0],
          se: [2000, 0, 0],
        },
      },
      sampleDomain: {
        kind: "depth",
        unit: "m",
        min: 1800,
        max: 1800,
        verticalScaleMPerUnit: 1,
      },
      datumM: 1800,
    },
    {
      id: "gdr-1141-psdm",
      domainKind: "depth",
      domainUnit: "m",
      surveyKind: "3d",
    },
    {
      layerId: "utah-forge-phase3-seismic-browser",
      objectKind: "3d-section-plane",
      objectId: "sample-1800",
      verticalDatumMode: "terrain-top-preview",
      verticalDatumOffsetM: -35,
    },
  );

  assert.equal(basis.kind, "sample-plane");
  assert.equal(basis.fixedSampleValue, 1800);
  assert.equal(basis.planeElevationM, 0);
  assert.equal(basis.sampleToZ(1800), 0);
  assert.equal(basis.verticalAxis, undefined);
  assert.deepEqual(basis.horizontalFootprintAxes.u, [2000, 0, 0]);
  assert.deepEqual(basis.horizontalFootprintAxes.v, [0, 1000, 0]);
});

test("trace path curtain face frame derives a reusable source plane", async () => {
  const { buildSeismicSectionGraphBasis, sectionFaceFrameFromGraphBasis } =
    await loadBasisModule();
  const basis = buildSeismicSectionGraphBasis(
    {
      id: "inline-50",
      axis: "inline",
      path: [
        [-8630.225, -10497.5, 0],
        [-3331.0375, -10589.5, 0],
      ],
      sampleDomain: {
        kind: "depth",
        unit: "m",
        min: 0,
        max: 5000,
        verticalScaleMPerUnit: 1,
      },
      datumM: 1800,
    },
    {
      id: "gdr-1141-forge3d-ani-psdm-stack-unenh",
      domainKind: "depth",
      domainUnit: "m",
      surveyKind: "3d",
    },
    {
      layerId: "utah-forge-phase3-seismic-browser",
      objectKind: "3d-section-plane",
      objectId: "inline-50",
      verticalDatumMode: "reference-1800m",
      verticalDatumOffsetM: 0,
    },
  );

  const frame = sectionFaceFrameFromGraphBasis(basis);

  assert.equal(frame.sourceKind, "seismic-trace-path");
  assert.equal(frame.frameId, "source:seismic:inline-50");
  assert.equal(frame.axisAHeading, "Trace distance");
  assert.equal(frame.axisBHeading, "Elevation");
  assert.ok(
    Math.abs(Math.abs(frame.normal[1]) - 0.9998493292588663) < 0.000001,
    "inline face normal should be parallel to the source-derived seismic curtain",
  );
  assert.ok(frame.maxAM - frame.minAM > 5200);
  assert.equal(frame.minBM, -3200);
  assert.equal(frame.maxBM, 1800);
  assert.doesNotMatch(JSON.stringify(frame), /pageId|pageOrder|pageTitle/);
});

test("sample plane face frame derives horizontal source plane bounds", async () => {
  const { buildSeismicSectionGraphBasis, sectionFaceFrameFromGraphBasis } =
    await loadBasisModule();
  const basis = buildSeismicSectionGraphBasis(
    {
      id: "sample-1800",
      axis: "sample",
      surfaceGrid: {
        corners: {
          sw: [0, 0, 0],
          nw: [0, 1000, 0],
          ne: [2000, 1000, 0],
          se: [2000, 0, 0],
        },
      },
      sampleDomain: {
        kind: "depth",
        unit: "m",
        min: 1800,
        max: 1800,
        verticalScaleMPerUnit: 1,
      },
      datumM: 1800,
    },
    {
      id: "gdr-1141-psdm",
      domainKind: "depth",
      domainUnit: "m",
      surveyKind: "3d",
    },
    {
      layerId: "utah-forge-phase3-seismic-browser",
      objectKind: "3d-section-plane",
      objectId: "sample-1800",
      verticalDatumMode: "source",
      verticalDatumOffsetM: 0,
    },
  );

  const frame = sectionFaceFrameFromGraphBasis(basis);

  assert.equal(frame.sourceKind, "seismic-sample-plane");
  assert.deepEqual(frame.normal, [0, 0, 1]);
  assert.equal(frame.minAM, 0);
  assert.equal(frame.maxAM, 2000);
  assert.equal(frame.minBM, 0);
  assert.equal(frame.maxBM, 1000);
});

test("runtime source attaches seismic graph basis to section meshes", () => {
  const loaderSource = readFileSync(
    join(repoRoot, "src", "loaders", "loadSeismicBrowser.ts"),
    "utf8",
  );
  const styleSource = readFileSync(
    join(repoRoot, "src", "scene", "styles", "seismicBrowserStyle.ts"),
    "utf8",
  );
  const annotationSource = readFileSync(
    join(repoRoot, "src", "scene", "styles", "seismicFigureAnnotations.ts"),
    "utf8",
  );

  assert.match(loaderSource, /buildSeismicSectionGraphBasis/);
  assert.match(loaderSource, /seismicSectionGraphBasis/);
  assert.match(styleSource, /buildSeismicSectionGraphBasis/);
  assert.match(styleSource, /seismicSectionGraphBasis/);
  assert.match(annotationSource, /seismicSectionGraphBasis/);
  assert.doesNotMatch(
    annotationSource,
    /const topLeft = pointFromAttribute\(position,\s*0\)[\s\S]*const topRight = pointFromAttribute\(position,\s*1\)[\s\S]*const bottomLeft = pointFromAttribute\(position,\s*2\)[\s\S]*const bottomRight = pointFromAttribute\(position,\s*3\)/,
    "normal graph annotations must not derive section corners from first four vertices",
  );
});

test("scene section runtime resolves source-derived face bases before axis fallback", () => {
  const controllerSource = readFileSync(
    join(repoRoot, "src", "scene", "section", "sceneSectionController.ts"),
    "utf8",
  );
  const styleSource = readFileSync(
    join(repoRoot, "src", "scene", "styles", "seismicBrowserStyle.ts"),
    "utf8",
  );

  assert.match(controllerSource, /sectionFaceFrameFromGraphBasis/);
  assert.match(controllerSource, /sceneSectionSourceFaceFrame/);
  assert.match(controllerSource, /seismicSectionSelectedForFace/);
  assert.match(
    controllerSource,
    /seismicSectionSelectedForFace[\s\S]{0,180}selectedBasis = basis[\s\S]{0,180}productTargets\.size > 0/,
    "selected seismic source faces should win before stale product-target filters can force axis fallback",
  );
  assert.match(
    controllerSource,
    /sceneSectionOrthonormalSourceBasis[\s\S]*crossVectors\(normal, axisA\)[\s\S]*sourceBasis\.center\.dot\(sourceBasis\.normal\)/,
    "source-derived helper bases should be normalized and right-handed before helper quaternion construction",
  );
  assert.match(
    controllerSource,
    /function sceneSectionBuiltInAxisForFrameId[\s\S]*\^axis:\(\[xyz\]\)\$/,
    "runtime should be able to identify built-in frame ids by axis.",
  );
  assert.match(
    controllerSource,
    /activeBuiltInAxis && activeBuiltInAxis !== activeAxis[\s\S]*sceneSectionBuiltInFrameId\(activeAxis\)/,
    "runtime source-face resolution must normalize stale built-in active frame ids to the active axis.",
  );
  assert.match(controllerSource, /sourceFaceFrame[\s\S]*sceneSectionResolvedFrameBasis/);
  assert.match(styleSource, /seismicSectionSelectedForFace/);
  assert.doesNotMatch(
    controllerSource,
    /projects\/utah-forge\/pages|pageOrder|pageTitle|61_psdm_mt_58_32_source_location_tie/,
    "source-derived face resolution must not depend on disposable page fixtures",
  );
});
