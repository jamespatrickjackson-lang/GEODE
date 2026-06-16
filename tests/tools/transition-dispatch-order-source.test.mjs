import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

// Review success-factor A6 - dispatch-order drift guard.
// TRANSITION_EXECUTOR_DISPATCH_ORDER (transitionExecutorRegistry.ts) documents
// the intended per-frame application order: scene-section masks first (they set
// clip uniforms other layers read), then working-area, scalar style, layer
// opacity, snapshot crossfades, and the standalone Section ISO pass. The actual
// order is a hand-maintained imperative sequence in tickLayerTweensImpl. Nothing
// tied them together, so a future edit that reorders a tick stage could silently
// invalidate the registry's documented invariant and produce one-frame
// uniform/opacity inconsistency that reads as flicker. This guard fails if the
// two drift apart.

const registrySource = readFileSync(
  "src/scene/transitions/transitionExecutorRegistry.ts",
  "utf8",
);
const runtimeSource = readFileSync(
  "src/scene/transitions/layerTweenRuntime.ts",
  "utf8",
);

function dispatchOrder(source) {
  const m = source.match(
    /TRANSITION_EXECUTOR_DISPATCH_ORDER[^=]*=\s*\[([\s\S]*?)\]/,
  );
  assert.ok(m, "TRANSITION_EXECUTOR_DISPATCH_ORDER array must exist");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const order = dispatchOrder(registrySource);

test("dispatch order constant is the documented sequence", () => {
  assert.deepEqual(order, [
    "scene-section",
    "working-area",
    "scalar-style",
    "layer-opacity",
    "snapshot-crossfade",
    "section-iso",
    "seismic-entity",
    "environment-scene",
  ]);
});

// Each dispatch bucket that the per-frame tick materializes maps to a stage
// timing marker emitted immediately after that stage. Buckets handled outside
// this tick (the seismic entity executor and the environment-scene transition
// run in their own stages) have no marker here.
const STAGE_MARKER = {
  "scene-section": "const sceneSectionMs =",
  "working-area": "const workingAreaMs =",
  "scalar-style": "const scalarMs =",
  "layer-opacity": "const layerMs =",
  "snapshot-crossfade": "const snapshotMs =",
  // The standalone Section ISO crossfade tick runs in the envelope stage, after
  // the snapshot stage, matching its dispatch position.
  "section-iso": "const envelopeMs =",
};

function tickBody(source) {
  const start = source.indexOf("export function tickLayerTweensImpl");
  assert.notEqual(start, -1, "tickLayerTweensImpl must exist");
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error("unterminated tickLayerTweensImpl body");
}

const body = tickBody(runtimeSource);

test("per-frame tick stages run in TRANSITION_EXECUTOR_DISPATCH_ORDER", () => {
  let prevIndex = -1;
  let prevBucket = null;
  for (const bucket of order) {
    const marker = STAGE_MARKER[bucket];
    if (!marker) continue; // bucket materialized outside this tick
    const idx = body.indexOf(marker);
    assert.notEqual(
      idx,
      -1,
      `tickLayerTweensImpl must contain the ${bucket} stage marker "${marker}"`,
    );
    assert.ok(
      idx > prevIndex,
      `${bucket} stage must run after ${prevBucket} per TRANSITION_EXECUTOR_DISPATCH_ORDER`,
    );
    prevIndex = idx;
    prevBucket = bucket;
  }
});
