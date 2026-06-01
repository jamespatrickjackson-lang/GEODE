import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

async function loadAdapterModule() {
  const tempRoot = join(
    tmpdir(),
    `geosee-transition-render-graph-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`,
  );
  mkdirSync(tempRoot, { recursive: true });
  const policySource = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionEntityPolicy.ts"),
    "utf8",
  );
  const adapterSource = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionRenderGraphAdapter.ts"),
    "utf8",
  );
  const compilerOptions = {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  };
  writeFileSync(
    join(tempRoot, "transitionEntityPolicy.mjs"),
    ts.transpileModule(policySource, { compilerOptions }).outputText,
  );
  const adapterOutput = ts
    .transpileModule(adapterSource, { compilerOptions })
    .outputText.replace(
      /from "\.\/transitionEntityPolicy"/g,
      'from "./transitionEntityPolicy.mjs"',
    );
  writeFileSync(join(tempRoot, "transitionRenderGraphAdapter.mjs"), adapterOutput);
  return import(pathToFileURL(join(tempRoot, "transitionRenderGraphAdapter.mjs")).href);
}

const {
  buildTransitionRenderGraphTrace,
  buildTransitionRenderGraphs,
} = await loadAdapterModule();

function layerState(overrides = {}) {
  return {
    layerId: "mt-density",
    entityKey: "entity:mt-density",
    representationKey: "points",
    presenceState: "visible",
    readinessState: "ready",
    sourceStateOrigin: "live-runtime",
    opacity: 0.4,
    opacityOwnerKey: "live-runtime",
    opacityOwnerPriority: 100,
    metadata: {
      pageId: "page-a",
      pageOrder: 1,
      fixtureName: "fixture-a",
      projectName: "project-a",
      toolLabel: "Tool A",
    },
    ...overrides,
  };
}

function changedChannel(result, key) {
  return result.assignmentTraces
    .flatMap((trace) => trace.changedChannels)
    .find((channel) => channel.key === key);
}

test("adapter builds equivalent graph shape for source and target", () => {
  const result = buildTransitionRenderGraphs({
    sourceLayers: [layerState()],
    targetLayers: [
      layerState({
        sourceStateOrigin: "persisted-effective",
        opacity: 0.8,
        opacityOwnerKey: "target-effective",
        opacityOwnerPriority: 80,
      }),
    ],
  });

  assert.equal(result.sourceGraph.length, 1);
  assert.equal(result.targetGraph.length, 1);
  assert.equal(result.sourceGraph[0].entityKey, result.targetGraph[0].entityKey);
  assert.equal(
    result.sourceGraph[0].representationKey,
    result.targetGraph[0].representationKey,
  );
  assert.equal(result.sourceGraph[0].presenceState, "visible");
  assert.equal(result.targetGraph[0].readinessState, "ready");
});

test("classifier runs from adapter output and emits assignment trace", () => {
  const result = buildTransitionRenderGraphTrace({
    sourceLayers: [layerState()],
    targetLayers: [
      layerState({
        sourceStateOrigin: "persisted-effective",
        opacity: 0.8,
        opacityOwnerKey: "target-effective",
        opacityOwnerPriority: 80,
      }),
    ],
  });

  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignmentTraces.length, 1);
  assert.equal(result.assignmentTraces[0].entityKey, "entity:mt-density");
  assert.equal(result.assignmentTraces[0].assignment, "preserve-interpolate");
  assert.equal(result.assignmentTraces[0].executionMode, "interpolate-channels");
  assert.deepEqual(
    result.assignmentTraces[0].changedChannels.map((channel) => ({
      key: channel.key,
      ownerKey: channel.ownerKey,
      sourceValue: channel.sourceValue,
      targetValue: channel.targetValue,
    })),
    [
      {
        key: "opacity",
        ownerKey: "target-effective",
        sourceValue: 0.4,
        targetValue: 0.8,
      },
    ],
  );
  assert.match(result.assignmentTraces[0].traceReasons.join(" "), /assignment/);
});

test("fixture metadata does not affect assignments", () => {
  const base = buildTransitionRenderGraphTrace({
    sourceLayers: [layerState()],
    targetLayers: [layerState({ opacity: 0.8, opacityOwnerKey: "target-effective" })],
  }).assignments;
  const relabeled = buildTransitionRenderGraphTrace({
    sourceLayers: [
      layerState({
        metadata: {
          pageId: "random-source",
          pageOrder: 200,
          fixtureName: "fixture-random-source",
          projectName: "project-random-source",
          toolLabel: "Renamed Source Tool",
        },
      }),
    ],
    targetLayers: [
      layerState({
        opacity: 0.8,
        opacityOwnerKey: "target-effective",
        metadata: {
          pageId: "random-target",
          pageOrder: 999,
          fixtureName: "fixture-random-target",
          projectName: "project-random-target",
          toolLabel: "Renamed Target Tool",
        },
      }),
    ],
    evidence: {
      sourcePageId: "random-source",
      targetPageId: "random-target",
      fixturePath: "throwaway/random",
      observedCaseFamily: "metadata-only",
      reproductionRoute: "manual",
    },
  }).assignments;

  assert.deepEqual(relabeled, base);
});

test("trace keeps diagnostic evidence outside assignment behavior", () => {
  const result = buildTransitionRenderGraphTrace({
    sourceLayers: [layerState()],
    targetLayers: [layerState({ opacity: 0.8, opacityOwnerKey: "target-effective" })],
    evidence: {
      sourcePageId: "page-001",
      targetPageId: "page-999",
      fixturePath: "projects/example/pages/page-999.json",
      observedCaseFamily: "section-iso-continuity",
      reproductionRoute: "manual-randomized",
    },
  });

  assert.equal(result.evidence.sourcePageId, "page-001");
  assert.equal(result.assignmentTraces[0].sourcePageId, undefined);
  assert.equal(result.assignmentTraces[0].targetPageId, undefined);
  assert.equal(result.assignmentTraces[0].assignment, "preserve-interpolate");
});

test("runtime setup records passive assignment traces without direct classifier wiring", () => {
  const transitionSource = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionEffectiveLayersForPage.ts"),
    "utf8",
  );
  const stylesSource = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionStyles.ts"),
    "utf8",
  );
  const sceneManagerSource = readFileSync(
    join(process.cwd(), "src", "scene", "SceneManager.ts"),
    "utf8",
  );

  assert.match(transitionSource, /buildTransitionRenderGraphTrace/);
  assert.match(transitionSource, /targetNotReadyLayerIds/);
  assert.match(
    readFileSync(
      join(process.cwd(), "src", "scene", "transitions", "layerTweenRuntime.ts"),
      "utf8",
    ),
    /targetNotReadyLayerIds/,
  );
  assert.doesNotMatch(
    transitionSource,
    /classifyTransitionEntityPair|classifyTransitionRenderGraphs/,
  );
  assert.match(stylesSource, /assignmentTraces/);
  assert.match(sceneManagerSource, /assignmentTraces/);
});

test("adapter emits scalar and color channel facts when available", () => {
  const result = buildTransitionRenderGraphTrace({
    sourceLayers: [
      layerState({
        scalarChannels: { "scalar:display-min": -2 },
        colorChannels: { "color:ramp-low": "#123456" },
        channelOwnerKey: "live-runtime",
        channelOwnerPriority: 100,
      }),
    ],
    targetLayers: [
      layerState({
        scalarChannels: { "scalar:display-min": -1 },
        colorChannels: { "color:ramp-low": "#654321" },
        channelOwnerKey: "target-effective",
        channelOwnerPriority: 80,
      }),
    ],
  });

  assert.deepEqual(changedChannel(result, "scalar:display-min"), {
    key: "scalar:display-min",
    channelClass: "continuous-scalar",
    capability: "interpolate",
    ownerKey: "target-effective",
    sourceValue: -2,
    targetValue: -1,
  });
  assert.equal(
    changedChannel(result, "color:ramp-low")?.channelClass,
    "color-material",
  );
});

test("adapter emits spatial channel facts when available", () => {
  const result = buildTransitionRenderGraphTrace({
    sourceLayers: [
      layerState({
        spatialChannels: { "section-frame:x:min": 100 },
        channelOwnerKey: "live-runtime",
        channelOwnerPriority: 100,
      }),
    ],
    targetLayers: [
      layerState({
        spatialChannels: { "section-frame:x:min": 200 },
        channelOwnerKey: "target-effective",
        channelOwnerPriority: 80,
      }),
    ],
  });

  assert.equal(
    changedChannel(result, "section-frame:x:min")?.channelClass,
    "spatial-transform",
  );
  assert.equal(
    changedChannel(result, "section-frame:x:min")?.capability,
    "interpolate",
  );
});

test("adapter emits derived entity links when available", () => {
  const result = buildTransitionRenderGraphTrace({
    sourceLayers: [
      layerState({
        entityKey: "entity:scene-section",
        derivedEntities: [
          {
            entityKey: "entity:scene-section:ground-trace",
            representationKey: "line",
            presenceState: "visible",
            readinessState: "ready",
            spatialChannels: { "ground-trace:path": "source-path" },
          },
        ],
      }),
    ],
    targetLayers: [
      layerState({
        entityKey: "entity:scene-section",
        derivedEntities: [
          {
            entityKey: "entity:scene-section:ground-trace",
            representationKey: "line",
            presenceState: "visible",
            readinessState: "ready",
            spatialChannels: { "ground-trace:path": "target-path" },
          },
        ],
      }),
    ],
  });
  const derivedAssignment = result.assignments.find(
    (assignment) => assignment.entityKey === "entity:scene-section:ground-trace",
  );

  assert.equal(derivedAssignment?.derivedFromEntityKey, "entity:scene-section");
  assert.equal(derivedAssignment?.dependencyPolicy, "follow-source");
  assert.equal(
    result.assignmentTraces.find(
      (trace) => trace.entityKey === "entity:scene-section:ground-trace",
    )?.derivedFromEntityKey,
    "entity:scene-section",
  );
  assert.equal(
    result.assignmentTraces.find(
      (trace) => trace.entityKey === "entity:scene-section:ground-trace",
    )?.changedChannels[0]?.key,
    "ground-trace:path",
  );
});

test("unknown channels remain traceable without changing execution wiring", () => {
  const result = buildTransitionRenderGraphTrace({
    sourceLayers: [
      layerState({
        unknownChannels: { "legend:runtime-state": "source-unknown" },
        channelOwnerKey: "live-runtime",
        channelOwnerPriority: 100,
      }),
    ],
    targetLayers: [
      layerState({
        unknownChannels: { "legend:runtime-state": "target-unknown" },
        channelOwnerKey: "target-effective",
        channelOwnerPriority: 80,
      }),
    ],
  });

  assert.equal(
    changedChannel(result, "legend:runtime-state")?.capability,
    "none",
  );
  assert.equal(result.assignmentTraces[0].assignment, "preserve-interpolate");
});

test("adapter traces generic readiness hold for target-only loading entities", () => {
  const result = buildTransitionRenderGraphTrace({
    sourceLayers: [],
    targetLayers: [
      layerState({
        layerId: "loading-layer",
        entityKey: "entity:loading-layer",
        presenceState: "visible",
        readinessState: "loading",
        opacity: 1,
      }),
    ],
  });

  assert.equal(result.assignmentTraces[0].assignment, "hold-until-ready");
  assert.equal(result.assignmentTraces[0].executionMode, "hold-source");
  assert.match(result.assignmentTraces[0].traceReasons.join(" "), /not ready/i);
});
