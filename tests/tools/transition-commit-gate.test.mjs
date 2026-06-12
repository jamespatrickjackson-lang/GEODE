import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

async function loadCommitGateModule() {
  const tempRoot = join(
    tmpdir(),
    `geosee-transition-commit-gate-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const source = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionCommitGate.ts"),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  writeFileSync(join(tempRoot, "transitionCommitGate.mjs"), output);
  return import(pathToFileURL(join(tempRoot, "transitionCommitGate.mjs")).href);
}

const {
  compareTransitionCommitGraphs,
  createTransitionCommitGate,
  reapplyReasonBypassesPostCommitSuppression,
} = await loadCommitGateModule();

function graph(entities = []) {
  return { entities };
}

function entity(entityKey, overrides = {}) {
  return {
    entityKey,
    representationKey: "mesh",
    presenceState: "visible",
    visible: true,
    channels: {
      opacity: {
        channelClass: "continuous-scalar",
        value: 0.5,
        coverage: "known",
      },
      color: {
        channelClass: "color-material",
        value: "#ffffff",
        coverage: "known",
      },
    },
    ...overrides,
  };
}

function makeGate(overrides = {}) {
  return createTransitionCommitGate({
    transitionId: "transition-1",
    sourcePageId: "fixture-source",
    targetPageId: "fixture-target",
    sourcePageIndex: 1,
    targetPageIndex: 2,
    projectSlug: "fixture-project",
    route: "fixture-source->fixture-target",
    commitOwner: "SceneManager",
    ...overrides,
  });
}

test("final commit runs once per transition id", () => {
  const gate = makeGate();
  const targetGraph = graph([entity("entity:a")]);
  const first = gate.recordCommitAttempt({
    phase: "final-commit",
    attemptedBy: "PageController.transition-complete",
    terminalTransitionGraph: targetGraph,
    resolvedTargetGraph: targetGraph,
    committedGraph: targetGraph,
  });
  const second = gate.recordCommitAttempt({
    phase: "duplicate-target-assertion",
    attemptedBy: "PageController.selection-effect",
    resolvedTargetGraph: targetGraph,
  });

  assert.equal(first.allowed, true);
  assert.equal(first.suppressed, false);
  assert.equal(second.allowed, false);
  assert.equal(second.suppressed, true);
  assert.equal(gate.state.hasFinalized, true);
  assert.equal(gate.state.suppressedDuplicateAssertions, 1);
});

test("duplicate target assertion after finalization is trace-only", () => {
  const gate = makeGate();
  const targetGraph = graph([entity("entity:a")]);
  gate.recordCommitAttempt({
    phase: "final-commit",
    attemptedBy: "SceneManager",
    terminalTransitionGraph: targetGraph,
    resolvedTargetGraph: targetGraph,
    committedGraph: targetGraph,
  });
  const duplicate = gate.recordCommitAttempt({
    phase: "duplicate-target-assertion",
    attemptedBy: "SceneManager.applyPageScene",
    resolvedTargetGraph: targetGraph,
  });

  assert.equal(duplicate.allowed, false);
  assert.equal(duplicate.suppressed, true);
  assert.match(duplicate.reason, /already finalized/i);
  assert.equal(gate.state.commitTraces.at(-1), duplicate);
});

test("tween completion cannot produce a second visible commit", () => {
  const gate = makeGate();
  const targetGraph = graph([entity("entity:a")]);
  gate.recordCommitAttempt({
    phase: "final-commit",
    attemptedBy: "SceneManager",
    terminalTransitionGraph: targetGraph,
    resolvedTargetGraph: targetGraph,
    committedGraph: targetGraph,
  });
  const tweenCompletion = gate.recordCommitAttempt({
    phase: "tween-completion",
    attemptedBy: "layerTweenRuntime",
    resolvedTargetGraph: targetGraph,
  });

  assert.equal(tweenCompletion.allowed, false);
  assert.equal(tweenCompletion.suppressed, true);
});

test("overlay end application cannot produce a second visible commit", () => {
  const gate = makeGate();
  const targetGraph = graph([entity("entity:a")]);
  gate.recordCommitAttempt({
    phase: "final-commit",
    attemptedBy: "SceneManager",
    terminalTransitionGraph: targetGraph,
    resolvedTargetGraph: targetGraph,
    committedGraph: targetGraph,
  });
  const overlayEnd = gate.recordCommitAttempt({
    phase: "overlay-end-application",
    attemptedBy: "SceneManager.applySceneOverlaysAtTransitionEnd",
    resolvedTargetGraph: targetGraph,
  });

  assert.equal(overlayEnd.allowed, false);
  assert.equal(overlayEnd.suppressed, true);
});

test("deferred editor reapply cannot visibly reassert stale target state after finalization", () => {
  const gate = makeGate();
  const targetGraph = graph([entity("entity:a")]);
  gate.recordCommitAttempt({
    phase: "final-commit",
    attemptedBy: "SceneManager",
    terminalTransitionGraph: targetGraph,
    resolvedTargetGraph: targetGraph,
    committedGraph: targetGraph,
  });
  const deferredReapply = gate.recordCommitAttempt({
    phase: "editor-deferred-reapply",
    attemptedBy: "EditorChrome.reapplyCurrentPageState",
    resolvedTargetGraph: targetGraph,
  });

  assert.equal(deferredReapply.allowed, false);
  assert.equal(deferredReapply.suppressed, true);
});

test("reapply suppression policy only admits async resolves and editor deferred flushes", () => {
  assert.equal(
    reapplyReasonBypassesPostCommitSuppression("async-layer-resolve"),
    true,
  );
  assert.equal(
    reapplyReasonBypassesPostCommitSuppression("editor-deferred-flush"),
    true,
  );
  assert.equal(
    reapplyReasonBypassesPostCommitSuppression("state-reapply"),
    false,
  );
  assert.equal(
    reapplyReasonBypassesPostCommitSuppression("duplicate-final-commit"),
    false,
  );
});

test("commit behavior is unchanged by fixture evidence metadata", () => {
  const targetGraph = graph([entity("entity:a")]);
  const base = makeGate({
    transitionId: "transition-stable",
    sourcePageId: "page-23",
    targetPageId: "page-24",
    sourcePageIndex: 23,
    targetPageIndex: 24,
    projectSlug: "utah-forge",
    route: "23->24",
    fixtureName: "A20",
    toolLabel: "Tool A",
  });
  const relabeled = makeGate({
    transitionId: "transition-stable",
    sourcePageId: "random-source",
    targetPageId: "random-target",
    sourcePageIndex: 1000,
    targetPageIndex: 2,
    projectSlug: "random-project",
    route: "randomized",
    fixtureName: "random-fixture",
    toolLabel: "Renamed Tool",
  });

  const baseTrace = base.recordCommitAttempt({
    phase: "final-commit",
    attemptedBy: "SceneManager",
    terminalTransitionGraph: targetGraph,
    resolvedTargetGraph: targetGraph,
    committedGraph: targetGraph,
  });
  const relabeledTrace = relabeled.recordCommitAttempt({
    phase: "final-commit",
    attemptedBy: "SceneManager",
    terminalTransitionGraph: targetGraph,
    resolvedTargetGraph: targetGraph,
    committedGraph: targetGraph,
  });

  assert.deepEqual(
    {
      allowed: relabeledTrace.allowed,
      suppressed: relabeledTrace.suppressed,
      phase: relabeledTrace.phase,
      visibleDeltaCount: relabeledTrace.visibleDeltaCount,
      unresolvedCoverage: relabeledTrace.unresolvedCoverage,
    },
    {
      allowed: baseTrace.allowed,
      suppressed: baseTrace.suppressed,
      phase: baseTrace.phase,
      visibleDeltaCount: baseTrace.visibleDeltaCount,
      unresolvedCoverage: baseTrace.unresolvedCoverage,
    },
  );
});

test("terminal target committed graph comparison reports visible deltas and unknown coverage", () => {
  const comparison = compareTransitionCommitGraphs({
    terminalTransitionGraph: graph([
      entity("entity:a", {
        channels: {
          opacity: {
            channelClass: "continuous-scalar",
            value: 0.5,
            coverage: "known",
          },
          "frame-x": {
            channelClass: "spatial-transform",
            coverage: "unknown",
          },
        },
      }),
    ]),
    resolvedTargetGraph: graph([
      entity("entity:a", {
        channels: {
          opacity: {
            channelClass: "continuous-scalar",
            value: 0.8,
            coverage: "known",
          },
          "frame-x": {
            channelClass: "spatial-transform",
            value: 10,
            coverage: "known",
          },
        },
      }),
    ]),
    committedGraph: graph([
      entity("entity:a", {
        channels: {
          opacity: {
            channelClass: "continuous-scalar",
            value: 0.8,
            coverage: "known",
          },
          "frame-x": {
            channelClass: "spatial-transform",
            coverage: "unknown",
          },
        },
      }),
    ]),
  });

  assert.equal(comparison.visibleDeltaCount, 1);
  assert.deepEqual(
    comparison.visibleDeltas.map((delta) => delta.channelKey),
    ["opacity"],
  );
  assert.match(comparison.unresolvedCoverage.join(" "), /frame-x/);
});

test("commit trace exposes the required debug shape", () => {
  const gate = makeGate();
  const targetGraph = graph([entity("entity:a")]);
  const trace = gate.recordCommitAttempt({
    phase: "final-commit",
    attemptedBy: "SceneManager",
    terminalTransitionGraph: targetGraph,
    resolvedTargetGraph: targetGraph,
    committedGraph: targetGraph,
  });

  assert.deepEqual(Object.keys(trace).sort(), [
    "allowed",
    "attemptedBy",
    "committedGraphEntityCount",
    "owner",
    "phase",
    "reason",
    "resolvedTargetGraphEntityCount",
    "suppressed",
    "targetGraphEntityCount",
    "terminalGraphEntityCount",
    "transitionId",
    "unresolvedCoverage",
    "visibleDeltaCount",
    "visibleDeltas",
  ]);
});

test("runtime source routes final target assertions through the commit gate", () => {
  const pageControllerSource = readFileSync(
    join(process.cwd(), "src", "pages", "PageController.tsx"),
    "utf8",
  );
  const sceneManagerSource = readFileSync(
    join(process.cwd(), "src", "scene", "SceneManager.ts"),
    "utf8",
  );
  const tweenRuntimeSource = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "layerTweenRuntime.ts"),
    "utf8",
  );
  const stylesSource = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionStyles.ts"),
    "utf8",
  );

  assert.match(sceneManagerSource, /finalizePageTransitionCommit/);
  assert.match(sceneManagerSource, /commitTraces/);
  assert.match(stylesSource, /commitState/);
  assert.match(pageControllerSource, /finalizePageTransitionCommit/);
  assert.match(pageControllerSource, /suppressPostCommitTargetAssertion/);
  assert.doesNotMatch(
    pageControllerSource,
    /manager\.applySceneOverlaysAtTransitionEnd/,
  );
  assert.match(tweenRuntimeSource, /phase:\s*"tween-completion"/);
  assert.match(tweenRuntimeSource, /commitState\?\.\s*hasFinalized/);
  assert.match(sceneManagerSource, /phase:\s*"overlay-end-application"/);
  assert.match(sceneManagerSource, /phase:\s*"editor-deferred-reapply"/);
  assert.match(sceneManagerSource, /suppressPostCommitTargetAssertion/);
});

test("post-commit async layer reapply is distinct from duplicate target assertions", () => {
  const sceneManagerSource = readFileSync(
    join(process.cwd(), "src", "scene", "SceneManager.ts"),
    "utf8",
  );
  const layerLoadersSource = readFileSync(
    join(process.cwd(), "src", "scene", "layerLoaders.ts"),
    "utf8",
  );
  const editorChromeSource = readFileSync(
    join(process.cwd(), "src", "editor", "EditorChrome.tsx"),
    "utf8",
  );
  const pageControllerSource = readFileSync(
    join(process.cwd(), "src", "pages", "PageController.tsx"),
    "utf8",
  );

  assert.match(sceneManagerSource, /type ReapplyCurrentPageStateReason/);
  assert.match(
    sceneManagerSource,
    /reapplyCurrentPageState\(\s*reason:\s*ReapplyCurrentPageStateReason\s*=\s*"state-reapply"/,
  );
  assert.match(sceneManagerSource, /reason === "async-layer-resolve"/);
  assert.match(sceneManagerSource, /reason === "editor-deferred-flush"/);
  assert.match(
    sceneManagerSource,
    /!reapplyReasonBypassesPostCommitSuppression\(reason\)[\s\S]*suppressDuplicatePostCommitReapply\(page\)/,
  );
  assert.match(
    sceneManagerSource,
    /preserveRunningLayerTweens[\s\S]*isAsyncLayerResolve[\s\S]*isEditorDeferredFlush/,
  );
  assert.match(
    layerLoadersSource,
    /reapplyCurrentPageState\("async-layer-resolve"\)/,
  );
  assert.doesNotMatch(
    editorChromeSource,
    /reapplyCurrentPageState\("async-layer-resolve"\)/,
  );
  assert.doesNotMatch(
    pageControllerSource,
    /reapplyCurrentPageState\("async-layer-resolve"\)/,
  );
  assert.match(
    editorChromeSource,
    /reapplyCurrentPageState\("editor-deferred-flush"\)/,
  );
  assert.match(
    pageControllerSource,
    /reapplyReasonBypassesPostCommitSuppression\(reason\)/,
  );
});
