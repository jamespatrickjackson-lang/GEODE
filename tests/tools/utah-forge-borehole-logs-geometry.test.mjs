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

function scenePointAt(index) {
  const [x, y, z] = doglegTrajectory[index].scene;
  return { x, y, z };
}

function offsetFromPath(point, index) {
  const path = scenePointAt(index);
  return point.clone().sub({
    x: path.x,
    y: path.y,
    z: path.z,
    isVector3: true,
  });
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
    const baselineOffset = offsetFromPath(ribbon.baseline[index], index);
    assert.ok(Math.abs(baselineOffset.length() - 24) < 1e-9);
    assert.ok(Math.abs(baselineOffset.z) < 1e-9, "lane baseline must stay horizontal");
    assert.ok(
      Math.abs(baselineOffset.clone().normalize().dot(frame.laneAxis) - 1) < 1e-9,
      "all lane baselines must stay parallel to the same lane axis",
    );

    const amplitudeOffset = displacementAt(ribbon, index);
    assert.ok(amplitudeOffset.length() >= -1e-9 && amplitudeOffset.length() <= 36.01);
    assert.ok(Math.abs(amplitudeOffset.z) < 1e-9, "amplitude displacement must stay horizontal");
    if (amplitudeOffset.length() > 1e-9) {
      assert.ok(
        Math.abs(amplitudeOffset.clone().normalize().dot(frame.laneAxis) - 1) < 1e-9,
        "all dogleg displacements must stay parallel to the same lane axis",
      );
    }
    assert.ok(
      Math.abs(ribbon.curve[index].z - ribbon.baseline[index].z) < 1e-9,
      "curve and baseline stay in the same vertical curtain",
    );
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

  const firstBase = offsetFromPath(first.baseline[0], 0).length();
  const secondBase = offsetFromPath(second.baseline[0], 0).length();
  const firstFullScaleCurve = offsetFromPath(first.curve[2], 2).length();
  assert.ok(Math.abs(firstBase - 24) < 1e-9);
  assert.ok(Math.abs(secondBase - 78) < 1e-9);
  assert.ok(Math.abs(secondBase - firstBase - 54) < 1e-9);
  assert.ok(
    Math.abs(secondBase - firstFullScaleCurve - 18) < 1e-9,
    "adjacent filled ribbon lanes should have a clear gap instead of overlap",
  );
});

test("borehole log track colors use authored style overrides", async () => {
  const loader = await importLoader();
  assert.equal(typeof loader.boreholeLogTrackColor, "function");

  assert.equal(
    loader.boreholeLogTrackColor(gammaTrack, {
      boreholeLogHcgrColor: "#abcdef",
    }),
    "#abcdef",
  );
  assert.equal(
    loader.boreholeLogTrackColor(
      { ...gammaTrack, id: "test-hsgr", mnemonic: "HSGR" },
      { boreholeLogHsgrColor: "#123456" },
    ),
    "#123456",
  );
  assert.equal(
    loader.boreholeLogTrackColor(
      {
        ...gammaTrack,
        id: "test-res",
        kind: "resistivity",
        mnemonic: "ILD",
        unit: "Ohm-m",
      },
      { boreholeLogResistivityColor: "#fedcba" },
    ),
    "#fedcba",
  );
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
