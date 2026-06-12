import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

// Phase 1 of the transition execution layer (TRD-013 / DEC-152). Validates the
// pure plan builder + frame evaluator against synthetic classifier assignments.
// No live Utah pages, page ids, page order, or fixture pairs are used.

async function loadExecutionPlanModule() {
  const tempRoot = join(
    tmpdir(),
    `geosee-transition-exec-plan-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  };
  const easingSource = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionEasing.ts"),
    "utf8",
  );
  writeFileSync(
    join(tempRoot, "transitionEasing.mjs"),
    ts.transpileModule(easingSource, { compilerOptions }).outputText,
  );
  const planSource = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionExecutionPlan.ts"),
    "utf8",
  );
  const planOutput = ts
    .transpileModule(planSource, { compilerOptions })
    .outputText.replace(
      /from "\.\/transitionEasing"/g,
      'from "./transitionEasing.mjs"',
    );
  writeFileSync(join(tempRoot, "transitionExecutionPlan.mjs"), planOutput);
  return import(
    pathToFileURL(join(tempRoot, "transitionExecutionPlan.mjs")).href
  );
}

const {
  buildTransitionExecutionPlan,
  evaluateTransitionExecutionPlan,
  replanTransitionEntityReadiness,
  transitionExecutionPlanComplete,
} = await loadExecutionPlanModule();

function assignment(overrides = {}) {
  return {
    entityKey: "layer:mt-density",
    sourceEntityKey: "layer:mt-density",
    targetEntityKey: "layer:mt-density",
    sourcePresence: "visible",
    targetPresence: "visible",
    sourceReadiness: "ready",
    targetReadiness: "ready",
    sourceRepresentation: "layer:pointcloud",
    targetRepresentation: "layer:pointcloud",
    compatibility: "compatible",
    derivedFromEntityKey: null,
    dependencyPolicy: "independent",
    changedChannels: [],
    assignment: "preserve-interpolate",
    executionMode: "interpolate-channels",
    finalCommitPolicy: "visually-idempotent-target",
    fallbackReason: null,
    traceReasons: [],
    sourceStateOrigin: "live-runtime",
    ...overrides,
  };
}

function planInput(assignments, overrides = {}) {
  return {
    assignments,
    startMs: 1000,
    durationMs: 800,
    easing: "linear",
    ...overrides,
  };
}

test("skip assignments produce no operations", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({
        assignment: "skip",
        executionMode: "none",
        sourcePresence: "hidden",
        targetPresence: "hidden",
      }),
    ]),
  );
  assert.equal(plan.operations.length, 0);
});

test("scalar style change maps to scalar-style executor and scalar timing", () => {
  const plan = buildTransitionExecutionPlan(
    planInput(
      [
        assignment({
          changedChannels: [
            {
              key: "style:scalarRangeMin",
              channelClass: "continuous-scalar",
              capability: "interpolate",
              ownerKey: "live-runtime",
              ownerPriority: 100,
              sourceOwnerKey: "live-runtime",
              targetOwnerKey: "target-effective",
              sourceValue: 1,
              targetValue: 2,
            },
          ],
        }),
      ],
      { scalarStyleDurationMs: 1500, scalarStyleEasing: "easeOutCubic" },
    ),
  );
  assert.equal(plan.operations.length, 1);
  assert.equal(plan.operations[0].executorKind, "scalar-style");
  assert.equal(plan.operations[0].durationMs, 1500);
  assert.equal(plan.operations[0].easing, "easeOutCubic");
});

test("opacity-only interpolation maps to layer-opacity", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({
        changedChannels: [
          {
            key: "opacity",
            channelClass: "continuous-scalar",
            capability: "interpolate",
            ownerKey: "live-runtime",
            ownerPriority: 100,
            sourceOwnerKey: "live-runtime",
            targetOwnerKey: "target-effective",
            sourceValue: 0.4,
            targetValue: 0.8,
          },
        ],
      }),
    ]),
  );
  assert.equal(plan.operations[0].executorKind, "layer-opacity");
});

test("seismic representation maps to seismic-entity regardless of mode", () => {
  for (const rep of [
    "seismic:2d-section-line",
    "seismic:figure-annotation",
    "seismic:survey-geometry",
    "seismic:comparison",
  ]) {
    const plan = buildTransitionExecutionPlan(
      planInput([
        assignment({
          entityKey: `layer:utah-forge-seismic-browser:product:p:object:k:o`,
          sourceRepresentation: rep,
          targetRepresentation: rep,
          executionMode: "enter",
          assignment: "enter",
          sourcePresence: "hidden",
        }),
      ]),
    );
    assert.equal(plan.operations[0].executorKind, "seismic-entity", rep);
    assert.equal(
      plan.operations[0].parentLayerId,
      "utah-forge-seismic-browser",
    );
  }
});

test("section-iso derived representation maps to section-iso-root", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({
        entityKey: "layer:scene-section:derived:section-iso-band",
        sourceRepresentation: "derived:section-iso-band",
        targetRepresentation: "derived:section-iso-band",
      }),
    ]),
  );
  assert.equal(plan.operations[0].executorKind, "section-iso-root");
});

test("scene-section derived representation maps to scene-section-mask", () => {
  for (const rep of [
    "derived:scene-section-helper",
    "derived:scene-section-frame",
    "derived:ground-trace",
    "derived:axis-lines",
  ]) {
    const plan = buildTransitionExecutionPlan(
      planInput([
        assignment({
          entityKey: `layer:scene-section:derived:x`,
          sourceRepresentation: rep,
          targetRepresentation: rep,
        }),
      ]),
    );
    assert.equal(plan.operations[0].executorKind, "scene-section-mask", rep);
  }
});

test("incompatible crossfade maps to discrete-crossfade", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({
        compatibility: "incompatible",
        executionMode: "crossfade",
        assignment: "crossfade",
      }),
    ]),
  );
  assert.equal(plan.operations[0].executorKind, "discrete-crossfade");
});

test("resolveExecutorKind override wins over generic mapping", () => {
  const plan = buildTransitionExecutionPlan({
    ...planInput([assignment()]),
    resolveExecutorKind: () => "discrete-crossfade",
  });
  assert.equal(plan.operations[0].executorKind, "discrete-crossfade");
});

test("override returning null falls back to generic mapping", () => {
  const plan = buildTransitionExecutionPlan({
    ...planInput([
      assignment({
        sourceRepresentation: "seismic:3d-volume",
        targetRepresentation: "seismic:3d-volume",
      }),
    ]),
    resolveExecutorKind: () => null,
  });
  assert.equal(plan.operations[0].executorKind, "seismic-entity");
});

test("enter ramps target in; exit ramps source out; midpoint is partial", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({
        entityKey: "layer:enter",
        executionMode: "enter",
        assignment: "enter",
        sourcePresence: "hidden",
      }),
      assignment({
        entityKey: "layer:exit",
        executionMode: "exit",
        assignment: "exit",
        targetPresence: "hidden",
      }),
    ]),
  );
  const mid = evaluateTransitionExecutionPlan(plan, 1400); // 400/800 = 0.5
  const enter = mid.find((f) => f.entityKey === "layer:enter");
  const exit = mid.find((f) => f.entityKey === "layer:exit");
  assert.ok(Math.abs(enter.enteringOpacityFactor - 0.5) < 1e-9);
  assert.ok(Math.abs(exit.exitingOpacityFactor - 0.5) < 1e-9);
  assert.equal(enter.done, false);
  assert.equal(exit.active, true);
});

test("hold-until-ready does not ramp target in", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({
        entityKey: "layer:holding",
        executionMode: "hold-source",
        assignment: "hold-until-ready",
        targetReadiness: "loading",
      }),
    ]),
  );
  const frame = evaluateTransitionExecutionPlan(plan, 1400)[0];
  assert.equal(frame.enteringOpacityFactor, 1); // not an enter; stays full
  const op = plan.operations[0];
  assert.equal(op.holdUntilReady, true);
});

test("readiness replan converts matching held layer operation into current-time enter", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({
        entityKey: "layer:late-layer",
        executionMode: "hold-source",
        assignment: "hold-until-ready",
        targetReadiness: "loading",
        traceReasons: ["assignment:hold-until-ready"],
      }),
      assignment({
        entityKey: "layer:other-late-layer",
        executionMode: "hold-source",
        assignment: "hold-until-ready",
        targetReadiness: "loading",
      }),
    ]),
  );

  const replanned = replanTransitionEntityReadiness(
    plan,
    new Set(["layer:late-layer", "late-layer"]),
    1300,
    500,
  );

  assert.deepEqual(replanned, ["layer:late-layer"]);
  const readyOp = plan.operations.find((op) => op.entityKey === "layer:late-layer");
  const untouchedOp = plan.operations.find(
    (op) => op.entityKey === "layer:other-late-layer",
  );
  assert.equal(readyOp.holdUntilReady, false);
  assert.equal(readyOp.executionMode, "enter");
  assert.equal(readyOp.assignment, "enter");
  assert.equal(readyOp.startMsOverride, 1300);
  assert.equal(readyOp.durationMs, 500);
  assert.ok(
    readyOp.traceReasons.includes(
      "readiness-replan:hold-source->enter",
    ),
  );
  assert.equal(untouchedOp.holdUntilReady, true);

  const atAttach = evaluateTransitionExecutionPlan(plan, 1300).find(
    (frame) => frame.entityKey === "layer:late-layer",
  );
  const half = evaluateTransitionExecutionPlan(plan, 1550).find(
    (frame) => frame.entityKey === "layer:late-layer",
  );
  assert.equal(atAttach.enteringOpacityFactor, 0);
  assert.equal(half.enteringOpacityFactor, 0.5);
});

test("readiness replan uses a floor for short remaining durations and leaves nonmatching derived roots alone", () => {
  const plan = {
    startMs: 1000,
    operations: [
      {
        entityKey: "layer:late-layer",
        parentLayerId: "late-layer",
        representationKey: "layer:pointcloud",
        executorKind: "layer-opacity",
        executionMode: "hold-source",
        assignment: "hold-until-ready",
        derivedFromEntityKey: null,
        dependencyPolicy: "independent",
        holdUntilReady: true,
        durationMs: 800,
        easing: "linear",
        channels: [],
        sourcePresence: "visible",
        targetPresence: "visible",
        sourceReadiness: "ready",
        targetReadiness: "loading",
        traceReasons: [],
      },
      {
        entityKey: "layer:late-layer:derived:section-iso-root",
        parentLayerId: "late-layer",
        representationKey: "derived:section-iso-band",
        executorKind: "section-iso-root",
        executionMode: "hold-source",
        assignment: "hold-until-ready",
        derivedFromEntityKey: "layer:late-layer",
        dependencyPolicy: "dependent",
        holdUntilReady: true,
        durationMs: 800,
        easing: "linear",
        channels: [],
        sourcePresence: "visible",
        targetPresence: "visible",
        sourceReadiness: "ready",
        targetReadiness: "loading",
        traceReasons: [],
      },
    ],
  };

  const replanned = replanTransitionEntityReadiness(
    plan,
    new Set(["layer:late-layer", "late-layer"]),
    1780,
    20,
  );

  assert.deepEqual(replanned, ["layer:late-layer"]);
  assert.equal(plan.operations[0].durationMs, 150);
  assert.equal(plan.operations[1].holdUntilReady, true);
  assert.equal(plan.operations[1].executionMode, "hold-source");
});

test("crossfade frame splits source-out and target-in alphas", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({
        compatibility: "incompatible",
        executionMode: "crossfade",
        assignment: "crossfade",
      }),
    ]),
  );
  const frame = evaluateTransitionExecutionPlan(plan, 1600)[0]; // 600/800 = 0.75
  assert.ok(Math.abs(frame.crossfadeSourceAlpha - 0.25) < 1e-9);
  assert.ok(Math.abs(frame.crossfadeTargetAlpha - 0.75) < 1e-9);
});

test("terminal frame is complete and idempotent", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({ entityKey: "layer:a" }),
      assignment({
        entityKey: "layer:b",
        executionMode: "enter",
        assignment: "enter",
        sourcePresence: "hidden",
      }),
    ]),
  );
  assert.equal(transitionExecutionPlanComplete(plan, 1800), true);
  const end = evaluateTransitionExecutionPlan(plan, 5000);
  for (const frame of end) {
    assert.equal(frame.done, true);
    assert.equal(frame.active, false);
    assert.equal(frame.progress, 1);
  }
});

test("zero-duration plan completes immediately", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([assignment()], { durationMs: 0 }),
  );
  assert.equal(transitionExecutionPlanComplete(plan, 1000), true);
});

test("operations carry parent layer id and trace reasons", () => {
  const plan = buildTransitionExecutionPlan(
    planInput([
      assignment({
        entityKey: "layer:mt-density",
        traceReasons: ["assignment:preserve-interpolate", "compatibility:compatible"],
      }),
    ]),
  );
  assert.equal(plan.operations[0].parentLayerId, "mt-density");
  assert.deepEqual(plan.operations[0].traceReasons, [
    "assignment:preserve-interpolate",
    "compatibility:compatible",
  ]);
});
