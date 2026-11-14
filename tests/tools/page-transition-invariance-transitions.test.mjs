import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

// #19. Pure classifier/plan/section/commit-graph tests, plus explicitly marked
// source-level RED observability assertion. No browser, renderer, preview or user data.
const root = process.cwd();
const source = (relative) => readFileSync(join(root, relative), "utf8");
const fixture = JSON.parse(source("tests/fixtures/page-transition-invariance/synthetic-project.json"));
assert.equal(fixture._scope, "SYNTHETIC_ONLY_NO_REAL_GEODE_PROJECT_OR_DATA");
const compilerOptions = { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 };

function compiled(relative, rewrite = (s) => s) {
  return rewrite(ts.transpileModule(source(relative), { compilerOptions }).outputText);
}
function dataUrl(js) {
  return "data:text/javascript;base64," + Buffer.from(js).toString("base64");
}
const easingUrl = dataUrl(compiled("src/scene/transitions/transitionEasing.ts"));
const policy = await import(dataUrl(compiled("src/scene/transitions/transitionEntityPolicy.ts")));
const section = await import(dataUrl(compiled("src/scene/transitions/sceneSectionFrameSignature.ts")));
const commit = await import(dataUrl(compiled("src/scene/transitions/transitionCommitGate.ts")));
const planSource = compiled("src/scene/transitions/transitionExecutionPlan.ts", (js) =>
  js.replace(/(["'])\.\/transitionEasing\1/g, JSON.stringify(easingUrl))
);
assert.ok(planSource.includes(easingUrl), "Plan must load the actual, isolated production easing helper");
const planApi = await import(dataUrl(planSource));

function channel(key, channelClass, capability, value) {
  return { key, channelClass, capability, value };
}
function entity(state, metadata = {}) {
  return {
    entityKey: "layer:synthetic-survey",
    representationKey: "pointcloud",
    presenceState: "visible",
    readinessState: "ready",
    sourceStateOrigin: "live-runtime",
    channels: [
      channel("opacity", "continuous-scalar", "interpolate", state.opacity),
      channel("scalar:min", "continuous-scalar", "interpolate", state.scalarMin),
      channel("material:color", "color-material", "discrete-commit", state.color),
    ],
    metadata,
  };
}
function assignmentsFor(sourceState, targetState, fromInfo = {}, toInfo = {}) {
  return policy.classifyTransitionRenderGraphs({
    source: [entity(sourceState, fromInfo)],
    target: [entity(targetState, toInfo)],
  });
}
function planFor(assignments) {
  return planApi.buildTransitionExecutionPlan({
    assignments, startMs: 0, durationMs: 1000, easing: "linear"
  });
}
function assignmentOf(entities) {
  assert.equal(entities.length, 1);
  return entities[0];
}

test("TR-identity PASS: three arbitrary page ID/title/order permutations produce identical policy, plan and frames", () => {
  const from = fixture.states.from;
  const to = fixture.states.to;
  const base = assignmentsFor(from, to, { pageId: "01_page", pageOrder: 0, title: "A" }, { pageId: "02_page", pageOrder: 1, title: "B" });
  const baselinePlan = planFor(base);
  const baselineFrames = planApi.evaluateTransitionExecutionPlan(baselinePlan, 500);
  const permutations = [
    [{pageId:"arbitrary-Z",pageOrder:41,title:"Renamed!"},{pageId:"unknown-Q",pageOrder:0,title:"Unrelated"}],
    [{pageId:"5c7d1b99",pageOrder:999,title:"Any"},{pageId:"19e310c1",pageOrder:2,title:"Any other"}],
    [{pageId:"03_page",pageOrder:2,title:"C"},{pageId:"01_page",pageOrder:0,title:"A"}],
  ];
  for (const [a,b] of permutations) {
    const nextAssignments = assignmentsFor(from,to,a,b);
    assert.deepEqual(nextAssignments, base);
    const nextPlan = planFor(nextAssignments);
    assert.deepEqual(nextPlan, baselinePlan);
    assert.deepEqual(planApi.evaluateTransitionExecutionPlan(nextPlan,500), baselineFrames);
  }
});

test("TR-scalar PASS: same entity retains continuous scalar and opacity diffs", () => {
  const result = assignmentOf(assignmentsFor(fixture.states.from, fixture.states.to));
  assert.equal(result.assignment, "preserve-interpolate");
  assert.equal(result.compatibility, "compatible");
  assert.deepEqual(result.changedChannels.map((x) => x.key).sort(), ["material:color", "opacity", "scalar:min"]);
  assert.equal(result.changedChannels.find((x) => x.key === "scalar:min").sourceValue, 10);
  assert.equal(result.changedChannels.find((x) => x.key === "scalar:min").targetValue, 50);
});

test("TR-DEC-163 PASS: discrete material color alone commits rather than interpolates", () => {
  const from = entity(fixture.states.from);
  const to = entity({ ...fixture.states.from, color: "#abcdef" });
  const result = policy.classifyTransitionEntityPair({ source: from, target: to });
  assert.equal(result.assignment, "discrete-commit");
  assert.equal(result.executionMode, "commit-discrete");
});

test("TR-visibility PASS: a disappearing entity gets an exit, not an authored-page special case", () => {
  const from = entity(fixture.states.from);
  const to = { ...entity(fixture.states.to), presenceState: "hidden" };
  const result = policy.classifyTransitionEntityPair({ source: from, target: to });
  assert.equal(result.assignment, "exit");
});

test("TR-DEC-164 PASS: compatible section-frame geometry moves even if another frame is removed", () => {
  const fromStyle = { sceneSectionEnabled: true, sceneSectionPlanes: {
    x: { enabled: true, positionM: 100 },
    y: { enabled: true, positionM: 50 },
  }};
  const toStyle = { sceneSectionEnabled: true, sceneSectionPlanes: {
    x: { enabled: true, positionM: 200 },
    y: { enabled: false, positionM: 50 },
  }};
  const p = section.sceneSectionFramePartition(fromStyle, toStyle);
  assert.deepEqual([...p.movingFrameIds], ["axis:x"]);
  assert.deepEqual([...p.dissolveFrameIds], ["axis:y"]);
});

test("TR-section PASS: incompatible coordinate frame dissolves the section entity", () => {
  const from = { sceneSectionPlanes: { x: { enabled: true, positionM: 100 } },
    sceneSectionFrameByAxis: { x: { axisDatum: "utm" } } };
  const to = { sceneSectionPlanes: { x: { enabled: true, positionM: 200 } },
    sceneSectionFrameByAxis: { x: { axisDatum: "local", axisDatumOriginEastingM: 0, axisDatumOriginNorthingM: 0 } } };
  const p = section.sceneSectionFramePartition(from, to);
  assert.deepEqual([...p.movingFrameIds], []);
  assert.deepEqual([...p.dissolveFrameIds], ["axis:x"]);
});

test("TR-Section-ISO PASS: derived Section ISO root keeps follow-source dependency and executor family", () => {
  const iso = (value) => ({
    entityKey: "layer:synthetic-section:derived:iso",
    representationKey: "derived:section-iso-band",
    presenceState: "visible", readinessState: "ready",
    derivedFromEntityKey: "layer:synthetic-section",
    channels: [channel("opacity", "continuous-scalar", "interpolate", value)]
  });
  const ass = policy.classifyTransitionEntityPair({ source: iso(0.15), target: iso(0.85) });
  assert.equal(ass.dependencyPolicy, "follow-source");
  const p = planFor([ass]);
  assert.equal(p.operations[0].executorKind, "section-iso-root");
});

test("TR-readiness PASS: delayed target holds source until ready and replans its own envelope", () => {
  const from = entity(fixture.states.from);
  const to = { ...entity(fixture.states.to), readinessState: "loading" };
  const ass = policy.classifyTransitionEntityPair({ source: from, target: to });
  assert.equal(ass.assignment, "hold-until-ready");
  const p = planFor([ass]);
  assert.equal(p.operations[0].holdUntilReady, true);
  const keys = planApi.replanTransitionEntityReadiness(p, new Set([ass.entityKey]), 350, 650);
  assert.deepEqual(keys, [ass.entityKey]);
  assert.equal(p.operations[0].holdUntilReady, false);
  assert.equal(p.operations[0].startMsOverride, 350);
  const frame = planApi.evaluateTransitionExecutionPlan(p, 350)[0];
  assert.equal(frame.enteringOpacityFactor, 0);
});

test("TR-01 contract PASS only: pure classifier consumes supplied mid-transition LIVE opacity at 20/50/80%", () => {
  // Does NOT establish that PageController supplied the actual live scene graph.
  const from = fixture.states.from;
  const to = fixture.states.to;
  for (const fraction of [0.2, 0.5, 0.8]) {
    const live = { ...from, opacity: from.opacity + (to.opacity-from.opacity)*fraction };
    const result = assignmentOf(assignmentsFor(live, { ...to, opacity: 0.4 }));
    const diff = result.changedChannels.find((x) => x.key === "opacity");
    assert.equal(diff.sourceValue, live.opacity);
    assert.equal(result.sourceStateOrigin, "live-runtime");
  }
});

test("TR-01 source receipt: interrupted controller resolves previous TARGET page even when camera is sampled live", () => {
  const controller = source("src/pages/PageController.tsx");
  assert.match(controller, /const sourceIndex = wasTransitioning\s*\?\s*activeTargetIndex/);
  assert.match(controller, /const sourceResolved = resolvePresentationState\(source\)/);
  assert.match(controller, /const currentPose: Pose =/);
  // This is the mixed-source risk, NOT a visual discontinuity reproduction.
});

test("TR-02 comparator PASS: measured final graph detects an injected opacity mismatch", () => {
  const target = { entities: [{ entityKey: "layer:synthetic-survey", representationKey: "pointcloud",
    presenceState: "visible", channels: { opacity: {value:0.8, coverage:"known"} } }] };
  const measured = { entities: [{ entityKey: "layer:synthetic-survey", representationKey: "pointcloud",
    presenceState: "visible", channels: { opacity: {value:0.32, coverage:"known"} } }] };
  const result = commit.compareTransitionCommitGraphs({
    terminalTransitionGraph: target, resolvedTargetGraph: target, committedGraph: measured
  });
  assert.ok(result.visibleDeltaCount > 0);
  assert.ok(result.visibleDeltas.some((x) => x.phase === "committed-target" && x.channelKey === "opacity"));
});

test("TR-02 comparator PASS: unknown terminal channel is unresolved, not a measured successful commit", () => {
  const expected = { entities: [{ entityKey: "synthetic:iso", presenceState:"visible",
    channels: {opacity:{value:0.8,coverage:"known"}} }] };
  const unknown = { entities: [{ entityKey: "synthetic:iso", presenceState:"visible",
    channels: {opacity:{value:0.8,coverage:"unknown"}} }] };
  const result = commit.compareTransitionCommitGraphs({
    terminalTransitionGraph: unknown, resolvedTargetGraph: expected, committedGraph: unknown
  });
  assert.ok(result.unresolvedCoverage.length > 0);
});

test("TR-02 RED source: post-commit comparison must not reuse expected terminal graph as measured committed graph", () => {
  const manager = source("src/scene/SceneManager.ts");
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
