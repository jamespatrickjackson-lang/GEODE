import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

// Phase 2 of the transition execution layer (TRD-013 / DEC-152). Validates the
// pure executor-kind -> bucket routing and operation grouping.

async function loadRegistryModule() {
  const source = readFileSync(
    join(
      process.cwd(),
      "src",
      "scene",
      "transitions",
      "transitionExecutorRegistry.ts",
    ),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const filePath = join(
    tmpdir(),
    `geosee-transition-executor-registry-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`,
  );
  writeFileSync(filePath, output);
  return import(pathToFileURL(filePath).href);
}

const {
  executorBucketForKind,
  TRANSITION_EXECUTOR_DISPATCH_ORDER,
  transitionOperationBucket,
  groupTransitionOperationsByBucket,
} = await loadRegistryModule();

const KIND_TO_BUCKET = {
  "layer-opacity": "layer-opacity",
  enter: "layer-opacity",
  exit: "layer-opacity",
  "scalar-style": "scalar-style",
  "scene-section-mask": "scene-section",
  "section-iso-root": "section-iso",
  "discrete-crossfade": "snapshot-crossfade",
  "seismic-entity": "seismic-entity",
  "environment-scene": "environment-scene",
  "working-area": "working-area",
  none: "none",
};

test("every executor kind maps to its runtime bucket", () => {
  for (const [kind, bucket] of Object.entries(KIND_TO_BUCKET)) {
    assert.equal(executorBucketForKind(kind), bucket, kind);
  }
});

test("enter and exit share the layer-opacity bucket", () => {
  assert.equal(executorBucketForKind("enter"), "layer-opacity");
  assert.equal(executorBucketForKind("exit"), "layer-opacity");
});

test("dispatch order places scene-section first and seismic before environment", () => {
  const order = TRANSITION_EXECUTOR_DISPATCH_ORDER;
  assert.equal(order[0], "scene-section");
  assert.ok(
    order.indexOf("seismic-entity") < order.indexOf("environment-scene"),
  );
  // scene-section sets clip uniforms read by later layer/scalar work.
  assert.ok(order.indexOf("scene-section") < order.indexOf("layer-opacity"));
  assert.ok(order.indexOf("scalar-style") < order.indexOf("layer-opacity"));
});

test("dispatch order has no duplicates and excludes none", () => {
  const order = TRANSITION_EXECUTOR_DISPATCH_ORDER;
  assert.equal(new Set(order).size, order.length);
  assert.equal(order.includes("none"), false);
});

function op(kind, entityKey) {
  return { entityKey, executorKind: kind };
}

test("operations are grouped by bucket and none is dropped", () => {
  const plan = {
    startMs: 0,
    operations: [
      op("seismic-entity", "a"),
      op("seismic-entity", "b"),
      op("scalar-style", "c"),
      op("enter", "d"),
      op("exit", "e"),
      op("none", "f"),
    ],
  };
  const grouped = groupTransitionOperationsByBucket(plan);
  assert.equal(grouped.get("seismic-entity").length, 2);
  assert.equal(grouped.get("scalar-style").length, 1);
  assert.equal(grouped.get("layer-opacity").length, 2); // enter + exit
  assert.equal(grouped.has("none"), false);
});

test("transitionOperationBucket matches executorBucketForKind", () => {
  assert.equal(
    transitionOperationBucket(op("section-iso-root", "x")),
    "section-iso",
  );
});
