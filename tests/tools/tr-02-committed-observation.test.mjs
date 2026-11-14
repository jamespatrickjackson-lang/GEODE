import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Ported unchanged in substance from PR #22's single TR-02 RED regression.
// No PI-004 tests, browser, writer, authored pages or geoscience assets.
const manager = readFileSync(join(process.cwd(), "src/scene/SceneManager.ts"), "utf8");

test("TR-02 RED source: post-commit comparison must not reuse expected terminal graph as measured committed graph", () => {
  const finalizerStart = manager.indexOf("finalizePageTransitionCommit(");
  const post = manager.indexOf('phase: "post-commit-graph-check"', finalizerStart);
  assert.ok(finalizerStart >= 0 && post > finalizerStart);
  const check = manager.slice(post, post + 350);
  assert.doesNotMatch(
    check,
    /committedGraph:\s*terminalTransitionGraph/,
    "TR-02: post-commit data is still an unmeasured projection from expected target assignments"
  );
});

import ts from "typescript";

const options = { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 };
async function loadProduction(relative) {
  const sourceText = readFileSync(join(process.cwd(), relative), "utf8");
  const compiled = ts.transpileModule(sourceText, { compilerOptions: options }).outputText;
  return import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
}
const observer = await loadProduction("src/scene/transitions/transitionCommitObserver.ts");
const gate = await loadProduction("src/scene/transitions/transitionCommitGate.ts");
function target(key = "layer:synthetic-survey") {
  return { entities: [{
    entityKey: key, representationKey: "pointcloud",
    presenceState: "visible", visible: true, readinessState: "ready",
    channels: {
      opacity: {value: 0.8, coverage: "known"},
      "scalar:min": {value: 10, coverage: "known"},
    },
  }] };
}

test("TR-02 observed actual opacity mismatch is reported, not projected as passing", () => {
  const expected = target();
  const measured = observer.observeTransitionCommitGraph(expected, () =>
    ({attached:true, visible:true, opacity:0.32}));
  assert.equal(measured.entities[0].channels.opacity.value, 0.32);
  const comparison = gate.compareTransitionCommitGraphs({
    resolvedTargetGraph: expected, committedGraph: measured,
  });
  assert.ok(comparison.visibleDeltas.some(
    (delta) => delta.phase === "committed-target" &&
      delta.channelKey === "opacity" && delta.committedValue === 0.32
  ));
  assert.ok(comparison.unresolvedCoverage.includes("committed:layer:synthetic-survey:scalar:min"));
});

test("TR-02 matching measured root opacity is known, but unmeasured channels are not PASS", () => {
  const expected = target();
  const measured = observer.observeTransitionCommitGraph(expected, () =>
    ({attached:true, visible:true, opacity:0.8}));
  const comparison = gate.compareTransitionCommitGraphs({
    resolvedTargetGraph: expected, committedGraph: measured,
  });
  assert.equal(comparison.visibleDeltaCount, 0);
  assert.equal(measured.entities[0].channels.opacity.coverage, "known");
  assert.equal(measured.entities[0].channels["scalar:min"].coverage, "unknown");
  assert.equal(measured.entities[0].channels["scalar:min"].value, undefined);
  assert.ok(comparison.unresolvedCoverage.includes("committed:layer:synthetic-survey:representation"));
  assert.ok(comparison.unresolvedCoverage.includes("committed:layer:synthetic-survey:readiness"));
  assert.ok(comparison.unresolvedCoverage.includes("committed:layer:synthetic-survey:scalar:min"));
});

test("TR-02 unmeasurable opacity and derived Section ISO do not inherit expected values", () => {
  const expected = {entities: [
    ...target().entities,
    ...target("layer:synthetic-survey:derived:section-iso").entities,
  ]};
  let calls = 0;
  const measured = observer.observeTransitionCommitGraph(expected, () => {
    calls += 1;
    return { attached:true, visible:true, opacity:null };
  });
  assert.equal(calls, 1, "derived keys must not sample the parent as if equivalent");
  for (const entity of measured.entities) {
    assert.equal(entity.channels.opacity.coverage, "unknown");
    assert.equal(entity.channels.opacity.value, undefined);
    assert.notEqual(entity.representationKey, "pointcloud");
  }
  assert.equal(measured.entities[1].visibilityCoverage, "unknown");
  const comparison = gate.compareTransitionCommitGraphs({
    resolvedTargetGraph: expected, committedGraph: measured,
  });
  assert.equal(comparison.visibleDeltaCount, 0, "unknown is not a fabricated mismatch or pass");
  assert.ok(comparison.unresolvedCoverage.includes(
    "committed:layer:synthetic-survey:derived:section-iso:visibility"));
  assert.ok(comparison.unresolvedCoverage.includes("committed:layer:synthetic-survey:opacity"));
});

test("TR-02 absent runtime root produces a known visibility mismatch", () => {
  const expected = target();
  const measured = observer.observeTransitionCommitGraph(expected, () =>
    ({attached:false, visible:false, opacity:null}));
  const comparison = gate.compareTransitionCommitGraphs({
    resolvedTargetGraph: expected, committedGraph: measured,
  });
  assert.ok(comparison.visibleDeltas.some(
    (delta) => delta.property === "visibility" && delta.committedValue === false
  ));
  assert.equal(measured.entities[0].channels.opacity.coverage, "unknown");
});

test("TR-02 SceneManager samples runtime scene roots after actual final scene writers", () => {
  const finalizer = manager.slice(manager.indexOf("finalizePageTransitionCommit("));
  const finalCommitAt = finalizer.indexOf('phase: "final-commit"');
  const applyAt = finalizer.indexOf("this.applyPageScene(nextPage)");
  const observeAt = finalizer.indexOf(
    "const committedGraph = this.observeTransitionCommitGraph(resolvedTargetGraph)"
  );
  const postAt = finalizer.indexOf('phase: "post-commit-graph-check"');
  assert.ok(finalCommitAt >= 0 && applyAt > finalCommitAt);
  assert.ok(observeAt > applyAt && postAt > observeAt);
  assert.match(manager, /this\.layers\.get\(layerId\)/);
  assert.match(manager, /this\.currentRenderOpacityForTree\(group, Number\.NaN\)/);
  assert.doesNotMatch(finalizer.slice(finalCommitAt,applyAt),
    /committedGraph:\s*terminalTransitionGraph/);
});
