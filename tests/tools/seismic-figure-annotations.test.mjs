import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const outDir = path.join(repoRoot, ".tmp", "test-seismic-figure-annotations");
const tscBin = path.join(repoRoot, "node_modules", "typescript", "bin", "tsc");

function readSource(...parts) {
  return readFileSync(path.join(repoRoot, ...parts), "utf8");
}

async function loadAnnotationModelModule() {
  execSync(
    [
      JSON.stringify(process.execPath),
      JSON.stringify(tscBin),
      "src/geophysics/seismicFigureAnnotationModel.ts",
      "--target ES2022",
      "--module ES2022",
      "--moduleResolution bundler",
      "--skipLibCheck",
      `--outDir ${JSON.stringify(outDir)}`,
    ].join(" "),
    { cwd: repoRoot, stdio: "inherit" },
  );
  return import(
    pathToFileURL(
      path.join(outDir, "seismicFigureAnnotationModel.js"),
    ).href
  );
}

{
  const {
    buildSeismicFigureAnnotationModel,
  } = await loadAnnotationModelModule();

  const model = buildSeismicFigureAnnotationModel({
    productLabel: "2D Line 301 migrated depth section",
    lineLabel: "Line 301",
    sourceSubmission: "GDR 1015",
    sampleDomain: {
      kind: "depth",
      unit: "m",
      min: 0,
      max: 8165.080078,
      verticalScaleMPerUnit: 1,
    },
    datumM: 1800,
    sectionStart: [-8343.049999999988, -8986.299999999814, 1590.9],
    sectionEnd: [-12187.449999999953, -8059.5, 1512.6],
    navigationStatus:
      "Delivered navigation present; precise registration requires validation evidence.",
  });

  assert.equal(model.title, "2D Line 301 migrated depth section");
  assert.equal(model.axis.heading, "Depth below seismic datum (m)");
  assert.equal(model.axis.sideHeading, "Elevation (m ASL)");
  assert.equal(model.axis.unit, "m");
  assert.equal(model.axis.ticks[0].value, 0);
  assert.equal(model.axis.ticks[0].secondaryLabel, "Elevation 1,800 m ASL");
  assert.equal(model.axis.ticks.at(-1).value, 8165.080078);
  assert.equal(model.scaleBar.label, "1 km");
  assert.deepEqual(model.directionLabels, { start: "E", end: "W" });
  assert.match(model.caption, /GDR 1015/);
  assert.match(model.caption, /Delivered navigation present/);
  assert.equal(model.wellTrace, null);
  assert.deepEqual(model.horizonPolyline, []);
  assert.doesNotMatch(JSON.stringify(model), /Inline 93|58-32|1 KILOMETER/);
}

{
  const {
    buildSeismicFigureAnnotationModel,
  } = await loadAnnotationModelModule();

  const model = buildSeismicFigureAnnotationModel({
    productLabel: "2D Line 301 unmigrated time stack",
    lineLabel: "Line 301",
    sampleDomain: {
      kind: "time",
      unit: "ms",
      min: 0,
      max: 2100,
      verticalScaleMPerUnit: 2,
    },
    sectionStart: [0, 0, 1800],
    sectionEnd: [3200, 0, 1800],
  });

  assert.equal(model.axis.heading, "Two-way travel time (TWT, ms)");
  assert.equal(model.axis.unit, "ms");
  assert.equal(model.axis.ticks[0].label, "0");
  assert.equal(model.axis.ticks.at(-1).label, "2100");
}

{
  const typesSource = readSource("src", "pages", "types.ts");
  assert.match(typesSource, /seismicFigureAnnotationsVisible\?: boolean/);
  assert.match(typesSource, /seismicFigureTextColor\?: string/);
  assert.match(typesSource, /seismicFigureAxisColor\?: string/);
  assert.match(typesSource, /seismicFigureCaptionBoxColor\?: string/);
  assert.match(typesSource, /seismicFigureHorizonPoints\?: Array<\[number, number\]>/);

  const editorSource = readSource(
    "src",
    "editor",
    "layerControls",
    "seismic",
    "SectionGraphOptionsControls.tsx",
  );
  assert.match(editorSource, /seismic-figure-annotations-visible/);
  assert.match(editorSource, /seismic-figure-title/);
  assert.match(editorSource, /seismic-figure-caption/);
  assert.match(editorSource, /seismic-figure-axis-color/);
  assert.match(editorSource, /seismic-figure-horizon-points/);

  const styleSource = readSource(
    "src",
    "scene",
    "styles",
    "seismicBrowserStyle.ts",
  );
  assert.match(styleSource, /updateSeismicFigureAnnotations/);
  assert.match(styleSource, /disposeSeismicFigureAnnotations/);
  assert.doesNotMatch(styleSource, /Inline 93|1 KILOMETER/);
}

{
  const figureStyleSource = readSource(
    "src",
    "scene",
    "styles",
    "seismicFigureAnnotations.ts",
  );

  assert.match(
    figureStyleSource,
    /function makeTextPlane[\s\S]*\): THREE\.Mesh/,
    "figure text should render as mesh planes, not camera-facing sprites",
  );
  assert.match(
    figureStyleSource,
    /const geometry = makePlaneGeometry\(center, widthVec, heightVec\)/,
    "figure text should use the same section-plane basis as axes and caption boxes",
  );
  assert.doesNotMatch(
    figureStyleSource,
    /new THREE\.SpriteMaterial|new THREE\.Sprite/,
    "figure text must not billboard toward the camera",
  );
  assert.match(
    figureStyleSource,
    /gl_FrontFacing[\s\S]*1\.0 - vUv\.x/,
    "back-facing figure text should flip its U coordinate so the camera never sees reversed text",
  );
  assert.match(
    figureStyleSource,
    /seismicFigureBaseOpacity/,
    "figure materials should preserve their base opacity under layer transitions",
  );
  assert.match(
    figureStyleSource,
    /seismicGraphEntityKey/,
    "figure roots and materials should carry stable graph entity identity metadata",
  );
  assert.match(
    figureStyleSource,
    /seismicGraphBasisKind/,
    "figure roots and materials should expose the basis kind used to construct axes",
  );
  assert.match(
    figureStyleSource,
    /resolveGraphAnnotationProfile/,
    "figure annotations should resolve target-scoped graph annotation profiles",
  );
  assert.match(
    figureStyleSource,
    /graphAnnotationTargetKeyFromBasis/,
    "figure annotations should derive profile targets from graph basis metadata",
  );
  assert.match(
    figureStyleSource,
    /graphAnnotationTargetKey/,
    "figure roots and materials should carry target-scoped annotation identity",
  );
}
