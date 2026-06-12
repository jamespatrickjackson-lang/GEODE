import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

async function loadExecutorModule() {
  const tempRoot = join(
    tmpdir(),
    `geosee-transition-entity-opacity-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const source = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionEntityOpacityExecutor.ts"),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const modulePath = join(tempRoot, "transitionEntityOpacityExecutor.mjs");
  writeFileSync(modulePath, output);
  return import(pathToFileURL(modulePath).href);
}

const {
  collectTransitionEntityObjects,
  applyTransitionEntityOpacityFrames,
} = await loadExecutorModule();

function material(opacity, userData = {}) {
  return {
    opacity,
    transparent: opacity < 1,
    userData: { ...userData },
    needsUpdate: false,
  };
}

function node(name, userData = {}, mat = null, children = []) {
  const object = {
    name,
    userData: { ...userData },
    visible: true,
    material: mat ?? undefined,
    children,
    traverse(callback) {
      callback(object);
      for (const child of children) child.traverse(callback);
    },
  };
  return object;
}

test("collector resolves only exact transitionEntityKey matches", () => {
  const a = node("figure a", {
    transitionEntityKey: "entity:figure:a",
    transitionRepresentationKey: "seismic:figure-annotation",
    transitionParentLayerId: "seismic-layer",
    transitionObjectKind: "figure-annotation",
  });
  const b = node("figure b", {
    transitionEntityKey: "entity:figure:b",
    transitionRepresentationKey: "seismic:figure-annotation",
    transitionParentLayerId: "seismic-layer",
    transitionObjectKind: "figure-annotation",
  });
  const root = node("root", {}, null, [a, b]);

  const collected = collectTransitionEntityObjects(root);

  assert.deepEqual(
    Array.from(collected.keys()).sort(),
    ["entity:figure:a", "entity:figure:b"],
  );
  assert.deepEqual(collected.get("entity:figure:a"), [a]);
  assert.deepEqual(collected.get("entity:figure:b"), [b]);
  assert.equal(collected.get("seismic:figure-annotation"), undefined);
});

test("entity opacity composes base material opacity, parent layer opacity, and entity factor", () => {
  const mat = material(0.82);
  const target = node(
    "survey lines",
    {
      transitionEntityKey: "entity:survey:lines",
      transitionRepresentationKey: "seismic:survey-geometry",
      transitionParentLayerId: "seismic-layer",
      transitionObjectKind: "survey-geometry",
      transitionRole: "lines",
    },
    mat,
  );
  const untouchedMat = material(0.78);
  const untouched = node(
    "survey sources",
    {
      transitionEntityKey: "entity:survey:sources",
      transitionRepresentationKey: "seismic:survey-geometry",
      transitionParentLayerId: "seismic-layer",
      transitionObjectKind: "survey-geometry",
      transitionRole: "sources",
    },
    untouchedMat,
  );
  const root = node("root", {}, null, [target, untouched]);

  applyTransitionEntityOpacityFrames(root, [
    {
      entityKey: "entity:survey:lines",
      parentLayerId: "seismic-layer",
      opacityFactor: 0.25,
    },
  ], {
    parentOpacityForLayer: () => 0.5,
  });

  assert.ok(Math.abs(mat.opacity - 0.82 * 0.5 * 0.25) < 1e-9);
  assert.equal(mat.transparent, true);
  assert.equal(mat.needsUpdate, true);
  assert.equal(untouchedMat.opacity, 0.78);
});

test("same-kind figure roots fade independently by entity key", () => {
  const aMaterial = material(0.6);
  const bMaterial = material(0.7);
  const root = node("root", {}, null, [
    node(
      "figure a",
      {
        transitionEntityKey: "entity:figure:a",
        transitionRepresentationKey: "seismic:figure-annotation",
        transitionParentLayerId: "seismic-layer",
        transitionObjectKind: "figure-annotation",
      },
      aMaterial,
    ),
    node(
      "figure b",
      {
        transitionEntityKey: "entity:figure:b",
        transitionRepresentationKey: "seismic:figure-annotation",
        transitionParentLayerId: "seismic-layer",
        transitionObjectKind: "figure-annotation",
      },
      bMaterial,
    ),
  ]);

  applyTransitionEntityOpacityFrames(root, [
    {
      entityKey: "entity:figure:a",
      parentLayerId: "seismic-layer",
      opacityFactor: 0.4,
    },
  ]);

  assert.ok(Math.abs(aMaterial.opacity - 0.24) < 1e-9);
  assert.equal(bMaterial.opacity, 0.7);
});

test("survey role frames fade only the matching role entity", () => {
  const lineMaterial = material(0.82);
  const sourceMaterial = material(0.78);
  const receiverMaterial = material(0.78);
  const root = node("root", {}, null, [
    node(
      "survey lines",
      {
        transitionEntityKey: "entity:survey:lines",
        transitionRepresentationKey: "seismic:survey-geometry",
        transitionParentLayerId: "seismic-layer",
        transitionObjectKind: "survey-geometry",
        transitionRole: "lines",
      },
      lineMaterial,
    ),
    node(
      "survey sources",
      {
        transitionEntityKey: "entity:survey:sources",
        transitionRepresentationKey: "seismic:survey-geometry",
        transitionParentLayerId: "seismic-layer",
        transitionObjectKind: "survey-geometry",
        transitionRole: "sources",
      },
      sourceMaterial,
    ),
    node(
      "survey receivers",
      {
        transitionEntityKey: "entity:survey:receivers",
        transitionRepresentationKey: "seismic:survey-geometry",
        transitionParentLayerId: "seismic-layer",
        transitionObjectKind: "survey-geometry",
        transitionRole: "receivers",
      },
      receiverMaterial,
    ),
  ]);

  applyTransitionEntityOpacityFrames(root, [
    {
      entityKey: "entity:survey:lines",
      parentLayerId: "seismic-layer",
      opacityFactor: 0,
    },
  ]);

  assert.equal(lineMaterial.opacity, 0);
  assert.equal(sourceMaterial.opacity, 0.78);
  assert.equal(receiverMaterial.opacity, 0.78);
});
