import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import * as esbuild from "esbuild";

const repoRoot = process.cwd();
const outdir = join(repoRoot, ".tmp", "tests");
const outfile = join(outdir, "loadUtahForgeBoreholeLogs.geometry.mjs");

async function importLoader() {
  await mkdir(outdir, { recursive: true });
  await esbuild.build({
    entryPoints: [join(repoRoot, "src", "loaders", "loadUtahForgeBoreholeLogs.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    external: ["three", "three/examples/jsm/lines/Line2.js", "three/examples/jsm/lines/LineGeometry.js", "three/examples/jsm/lines/LineMaterial.js"],
  });
  return import(`${pathToFileURL(outfile).href}?v=${Date.now()}`);
}

const doglegTrajectory = [
  { mdFt: 0, scene: [0, 0, 100] },
  { mdFt: 100, scene: [0, 0, 0] },
  { mdFt: 200, scene: [50, 0, -100] },
  { mdFt: 300, scene: [50, 50, -200] },
];

const gammaTrack = {
  id: "test-hcgr",
  kind: "gamma",
  mnemonic: "HCGR",
  unit: "API",
  renderStatus: "renderable",
  samples: [
    { mdFt: 0, value: 0 },
    { mdFt: 100, value: 75 },
    { mdFt: 200, value: 150 },
    { mdFt: 300, value: 300 },
  ],
};

const style = {
  boreholeLogTrackOffsetM: 24,
  boreholeLogTrackWidthM: 36,
  boreholeLogGammaScaleApi: 150,
  boreholeLogCurveFillCutoff: 0,
  boreholeLogDepthMinFt: 0,
  boreholeLogDepthMaxFt: 1000,
  boreholeLogVerticalExaggeration: 1,
};

function displacementAt(ribbon, index) {
  return ribbon.curve[index].clone().sub(ribbon.baseline[index]);
}

test("borehole log tracks use one fixed UTM lane across doglegs", async () => {
  const loader = await importLoader();
  assert.equal(typeof loader.computeBoreholeLogLaneFrame, "function");
  assert.equal(typeof loader.buildTrackRibbonGeometry, "function");

  const frame = loader.computeBoreholeLogLaneFrame(doglegTrajectory);
  const ribbon = loader.buildTrackRibbonGeometry(
    doglegTrajectory,
    gammaTrack,
    style,
    0,
    frame,
  );

  assert.equal(ribbon.baseline.length, gammaTrack.samples.length);
  assert.equal(ribbon.curve.length, gammaTrack.samples.length);
  for (let index = 0; index < ribbon.baseline.length; index += 1) {
    const displacement = displacementAt(ribbon, index);
    assert.ok(displacement.length() >= 23.99 && displacement.length() <= 60.01);
    assert.ok(Math.abs(displacement.z) < 1e-9, "lane displacement must stay horizontal");
    assert.ok(
      Math.abs(displacement.clone().normalize().dot(frame.laneAxis) - 1) < 1e-9,
      "all dogleg displacements must stay parallel to the same lane axis",
    );
    assert.equal(ribbon.curve[index].z, ribbon.baseline[index].z);
  }
});

test("borehole log tracks build a paired ribbon mesh instead of a lone line", async () => {
  const loader = await importLoader();
  const frame = loader.computeBoreholeLogLaneFrame(doglegTrajectory);
  const ribbon = loader.buildTrackRibbonGeometry(
    doglegTrajectory,
    gammaTrack,
    style,
    0,
    frame,
  );

  assert.equal(ribbon.positions.length, gammaTrack.samples.length * 2 * 3);
  assert.equal(ribbon.indices.length, (gammaTrack.samples.length - 1) * 6);
  assert.deepEqual(ribbon.indices.slice(0, 6), [0, 2, 1, 1, 2, 3]);
});

test("multiple gamma mnemonics get parallel separated lanes", async () => {
  const loader = await importLoader();
  const frame = loader.computeBoreholeLogLaneFrame(doglegTrajectory);
  const first = loader.buildTrackRibbonGeometry(
    doglegTrajectory,
    gammaTrack,
    style,
    0,
    frame,
  );
  const second = loader.buildTrackRibbonGeometry(
    doglegTrajectory,
    { ...gammaTrack, id: "test-hsgr", mnemonic: "HSGR" },
    style,
    1,
    frame,
  );

  const firstBase = displacementAt(first, 0).length();
  const secondBase = displacementAt(second, 0).length();
  assert.ok(Math.abs(firstBase - 24) < 1e-9);
  assert.ok(Math.abs(secondBase - 72) < 1e-9);
  assert.ok(Math.abs(secondBase - firstBase - 48) < 1e-9);
});

test("lithology intervals render on the trajectory path, not as wiggles", async () => {
  const loader = await importLoader();
  assert.equal(typeof loader.buildLithologyColumnGeometry, "function");
  const column = loader.buildLithologyColumnGeometry(
    doglegTrajectory,
    { fromMdFt: 100, toMdFt: 200, lithology: "granite", renderStatus: "renderable" },
    style,
  );

  assert.deepEqual(column.positions, [0, 0, 0, 50, 0, -100]);
});
