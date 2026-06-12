import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

// Phase 4 of the transition execution layer (TRD-013 / DEC-152). Validates the
// pure seismic-entity frame derivation: survey-geometry and figure-annotation
// fade, section/volume/comparison continuity is left to the layer envelope.
// Synthetic assignments only; no live Utah pages or page pairs.

async function loadModules() {
  const tempRoot = join(
    tmpdir(),
    `geosee-seismic-graph-exec-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  };
  const transpile = (relPath, rewrites = []) => {
    let out = ts.transpileModule(
      readFileSync(join(process.cwd(), ...relPath.split("/")), "utf8"),
      { compilerOptions },
    ).outputText;
    for (const [from, to] of rewrites) out = out.replaceAll(from, to);
    return out;
  };
  writeFileSync(
    join(tempRoot, "transitionEasing.mjs"),
    transpile("src/scene/transitions/transitionEasing.ts"),
  );
  writeFileSync(
    join(tempRoot, "transitionExecutionPlan.mjs"),
    transpile("src/scene/transitions/transitionExecutionPlan.ts", [
      ['from "./transitionEasing"', 'from "./transitionEasing.mjs"'],
    ]),
  );
  writeFileSync(
    join(tempRoot, "transitionEntityOpacityExecutor.mjs"),
    transpile("src/scene/transitions/transitionEntityOpacityExecutor.ts"),
  );
  writeFileSync(
    join(tempRoot, "seismicGraphTransitionExecutor.mjs"),
    transpile("src/scene/transitions/seismicGraphTransitionExecutor.ts", [
      ['from "./transitionExecutionPlan"', 'from "./transitionExecutionPlan.mjs"'],
      [
        'from "./transitionEntityOpacityExecutor"',
        'from "./transitionEntityOpacityExecutor.mjs"',
      ],
    ]),
  );
  const plan = await import(
    pathToFileURL(join(tempRoot, "transitionExecutionPlan.mjs")).href
  );
  const executor = await import(
    pathToFileURL(join(tempRoot, "seismicGraphTransitionExecutor.mjs")).href
  );
  return { plan, executor };
}

const { plan: planModule, executor } = await loadModules();
const { buildTransitionExecutionPlan } = planModule;
const {
  seismicEntityObjectKind,
  planSeismicEntityFrames,
  planHasSeismicFadeEntities,
  SEISMIC_ENTITY_FADE_OBJECT_KINDS,
} = executor;

function seismicAssignment(rep, mode, overrides = {}) {
  const presence = {
    enter: { source: "hidden", target: "visible" },
    exit: { source: "visible", target: "hidden" },
    "preserve-interpolate": { source: "visible", target: "visible" },
  }[mode] ?? { source: "visible", target: "visible" };
  return {
    entityKey: `layer:utah-forge-seismic-browser:product:p:object:${rep}:o`,
    sourceEntityKey: "s",
    targetEntityKey: "t",
    sourcePresence: presence.source,
    targetPresence: presence.target,
    sourceReadiness: "ready",
    targetReadiness: "ready",
    sourceRepresentation: rep,
    targetRepresentation: rep,
    compatibility: "compatible",
    derivedFromEntityKey: "layer:utah-forge-seismic-browser",
    dependencyPolicy: "follow-source",
    changedChannels: [],
    assignment:
      mode === "enter" ? "enter" : mode === "exit" ? "exit" : "preserve-interpolate",
    executionMode: mode,
    finalCommitPolicy: "visually-idempotent-target",
    fallbackReason: null,
    traceReasons: [],
    sourceStateOrigin: "live-runtime",
    ...overrides,
  };
}

function buildPlan(assignments) {
  return buildTransitionExecutionPlan({
    assignments,
    startMs: 1000,
    durationMs: 800,
    easing: "linear",
  });
}

test("object kind maps each seismic representation", () => {
  assert.equal(seismicEntityObjectKind("seismic:survey-geometry"), "survey-geometry");
  assert.equal(seismicEntityObjectKind("seismic:figure-annotation"), "figure-annotation");
  assert.equal(seismicEntityObjectKind("seismic:comparison"), "comparison");
  assert.equal(seismicEntityObjectKind("seismic:2d-section-line"), "section");
  assert.equal(seismicEntityObjectKind("seismic:3d-section-plane"), "section");
  assert.equal(seismicEntityObjectKind("seismic:3d-volume"), "section");
  assert.equal(seismicEntityObjectKind("layer:pointcloud"), "unknown");
});

test("only survey-geometry and figure-annotation are fade kinds", () => {
  assert.equal(SEISMIC_ENTITY_FADE_OBJECT_KINDS.has("survey-geometry"), true);
  assert.equal(SEISMIC_ENTITY_FADE_OBJECT_KINDS.has("figure-annotation"), true);
  assert.equal(SEISMIC_ENTITY_FADE_OBJECT_KINDS.has("section"), false);
  assert.equal(SEISMIC_ENTITY_FADE_OBJECT_KINDS.has("comparison"), false);
});

test("survey-geometry exit ramps opacity 1 -> 0", () => {
  const plan = buildPlan([
    seismicAssignment("seismic:survey-geometry", "exit"),
  ]);
  const start = planSeismicEntityFrames(plan, 1000)[0];
  const mid = planSeismicEntityFrames(plan, 1400)[0];
  const end = planSeismicEntityFrames(plan, 1800)[0];
  assert.equal(start.objectKind, "survey-geometry");
  assert.ok(Math.abs(start.opacityFactor - 1) < 1e-9);
  assert.ok(Math.abs(mid.opacityFactor - 0.5) < 1e-9);
  assert.ok(Math.abs(end.opacityFactor - 0) < 1e-9);
  assert.equal(end.done, true);
});

test("figure-annotation enter ramps opacity 0 -> 1", () => {
  const plan = buildPlan([
    seismicAssignment("seismic:figure-annotation", "enter"),
  ]);
  const start = planSeismicEntityFrames(plan, 1000)[0];
  const mid = planSeismicEntityFrames(plan, 1400)[0];
  assert.equal(start.objectKind, "figure-annotation");
  assert.ok(Math.abs(start.opacityFactor - 0) < 1e-9);
  assert.ok(Math.abs(mid.opacityFactor - 0.5) < 1e-9);
});

test("section continuity produces no fade frame", () => {
  const plan = buildPlan([
    seismicAssignment("seismic:3d-section-plane", "preserve-interpolate"),
  ]);
  assert.equal(planSeismicEntityFrames(plan, 1400).length, 0);
});

test("survey preserve frames do not emit entity opacity writes", () => {
  const plan = buildPlan([
    seismicAssignment("seismic:survey-geometry", "preserve-interpolate"),
  ]);
  assert.equal(planSeismicEntityFrames(plan, 1400).length, 0);
});

test("target-only unready seismic entity stays hidden instead of flashing target", () => {
  const plan = buildPlan([
    seismicAssignment("seismic:figure-annotation", "hold-source", {
      assignment: "hold-until-ready",
      executionMode: "hold-source",
      sourcePresence: null,
      sourceReadiness: null,
      targetPresence: "visible",
      targetReadiness: "loading",
    }),
  ]);
  const frame = planSeismicEntityFrames(plan, 1400)[0];
  assert.equal(frame.objectKind, "figure-annotation");
  assert.equal(frame.opacityFactor, 0);
});

test("comparison entity is excluded from fade frames", () => {
  const plan = buildPlan([
    seismicAssignment("seismic:comparison", "enter"),
  ]);
  assert.equal(planSeismicEntityFrames(plan, 1400).length, 0);
});

test("non-seismic operations yield no seismic frames", () => {
  const plan = buildPlan([
    {
      ...seismicAssignment("layer:pointcloud", "enter"),
      entityKey: "layer:mt-density",
      derivedFromEntityKey: null,
      dependencyPolicy: "independent",
    },
  ]);
  assert.equal(planSeismicEntityFrames(plan, 1400).length, 0);
});

test("planHasSeismicFadeEntities reflects fade work", () => {
  assert.equal(
    planHasSeismicFadeEntities(
      buildPlan([seismicAssignment("seismic:survey-geometry", "exit")]),
    ),
    true,
  );
  assert.equal(
    planHasSeismicFadeEntities(
      buildPlan([
        seismicAssignment("seismic:3d-section-plane", "preserve-interpolate"),
      ]),
    ),
    false,
  );
  assert.equal(
    planHasSeismicFadeEntities(
      buildPlan([seismicAssignment("seismic:figure-annotation", "enter")]),
    ),
    true,
  );
});

test("mixed plan only fades survey and figure, leaving section continuity", () => {
  const plan = buildPlan([
    seismicAssignment("seismic:3d-section-plane", "preserve-interpolate"),
    seismicAssignment("seismic:survey-geometry", "exit"),
    seismicAssignment("seismic:figure-annotation", "enter"),
  ]);
  const frames = planSeismicEntityFrames(plan, 1400);
  const kinds = frames.map((f) => f.objectKind).sort();
  assert.deepEqual(kinds, ["figure-annotation", "survey-geometry"]);
});
