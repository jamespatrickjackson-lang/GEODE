import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

async function loadPolicyModule() {
  const source = readFileSync(
    join(process.cwd(), "src", "scene", "transitions", "transitionEntityPolicy.ts"),
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
    `geosee-transition-policy-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.mjs`,
  );
  writeFileSync(filePath, output);
  return import(pathToFileURL(filePath).href);
}

const {
  classifyTransitionEntityPair,
  classifyTransitionRenderGraphs,
} = await loadPolicyModule();

function visibleEntity(overrides = {}) {
  return {
    entityKey: "entity:stable",
    representationKey: "mesh",
    presenceState: "visible",
    readinessState: "ready",
    sourceStateOrigin: "live-runtime",
    channels: [
      {
        key: "opacity",
        channelClass: "continuous-scalar",
        capability: "interpolate",
        value: 0.4,
      },
    ],
    ...overrides,
  };
}

test("matched visible entity with scalar diff preserves and interpolates", () => {
  const result = classifyTransitionEntityPair({
    source: visibleEntity(),
    target: visibleEntity({
      channels: [
        {
          key: "opacity",
          channelClass: "continuous-scalar",
          capability: "interpolate",
          value: 0.9,
        },
      ],
    }),
  });

  assert.equal(result.assignment, "preserve-interpolate");
  assert.deepEqual(
    result.changedChannels.map((channel) => channel.key),
    ["opacity"],
  );
  assert.equal(result.compatibility, "compatible");
});

test("matched visible entity with spatial diff preserves and interpolates", () => {
  const result = classifyTransitionEntityPair({
    source: visibleEntity({
      representationKey: "line",
      channels: [
        {
          key: "frame-position",
          channelClass: "spatial-transform",
          capability: "interpolate",
          value: { x: 10, y: 0 },
        },
      ],
    }),
    target: visibleEntity({
      representationKey: "line",
      channels: [
        {
          key: "frame-position",
          channelClass: "spatial-transform",
          capability: "interpolate",
          value: { x: 20, y: 0 },
        },
      ],
    }),
  });

  assert.equal(result.assignment, "preserve-interpolate");
  assert.equal(result.changedChannels[0]?.channelClass, "spatial-transform");
});

test("source-only visible entity exits from live source state", () => {
  const result = classifyTransitionEntityPair({
    source: visibleEntity({ sourceStateOrigin: "live-runtime" }),
    target: undefined,
  });

  assert.equal(result.assignment, "exit");
  assert.equal(result.sourceStateOrigin, "live-runtime");
});

test("target-only visible entity enters", () => {
  const result = classifyTransitionEntityPair({
    source: undefined,
    target: visibleEntity(),
  });

  assert.equal(result.assignment, "enter");
});

test("incompatible representation uses fallback instead of interpolation", () => {
  const result = classifyTransitionEntityPair({
    source: visibleEntity({ representationKey: "points" }),
    target: visibleEntity({ representationKey: "volume" }),
  });

  assert.equal(result.assignment, "crossfade");
  assert.equal(result.compatibility, "incompatible");
  assert.match(result.fallbackReason ?? "", /representation/i);
});

test("unready target holds source and does not enter partial target", () => {
  const result = classifyTransitionEntityPair({
    source: visibleEntity(),
    target: visibleEntity({ readinessState: "loading" }),
  });

  assert.equal(result.assignment, "hold-until-ready");
  assert.match(result.fallbackReason ?? "", /not ready/i);
});

test("off-to-off remains skipped and hidden", () => {
  const result = classifyTransitionEntityPair({
    source: visibleEntity({ presenceState: "hidden" }),
    target: visibleEntity({ presenceState: "absent" }),
  });

  assert.equal(result.assignment, "skip");
});

test("page ids, page order, and tool labels do not affect graph classification", () => {
  const source = [
    visibleEntity({
      entityKey: "entity:stable",
      metadata: {
        pageId: "23",
        pageOrder: 23,
        toolLabel: "Tool A",
      },
    }),
  ];
  const target = [
    visibleEntity({
      entityKey: "entity:stable",
      channels: [
        {
          key: "opacity",
          channelClass: "continuous-scalar",
          capability: "interpolate",
          value: 0.7,
        },
      ],
      metadata: {
        pageId: "24",
        pageOrder: 24,
        toolLabel: "Tool B",
      },
    }),
  ];
  const renamedSource = [
    {
      ...source[0],
      metadata: {
        pageId: "random-a",
        pageOrder: 4,
        toolLabel: "Renamed Source",
      },
    },
  ];
  const renamedTarget = [
    {
      ...target[0],
      metadata: {
        pageId: "random-b",
        pageOrder: 999,
        toolLabel: "Renamed Target",
      },
    },
  ];

  assert.deepEqual(
    classifyTransitionRenderGraphs({ source, target }),
    classifyTransitionRenderGraphs({
      source: renamedSource,
      target: renamedTarget,
    }),
  );
});

test("channel ownership priority selects the authoritative value before diffing", () => {
  const result = classifyTransitionEntityPair({
    source: visibleEntity({
      channels: [
        {
          key: "opacity",
          ownerKey: "runtime-live",
          ownerPriority: 100,
          channelClass: "continuous-scalar",
          capability: "interpolate",
          value: 0.4,
        },
        {
          key: "opacity",
          ownerKey: "persisted-stale",
          ownerPriority: 1,
          channelClass: "continuous-scalar",
          capability: "interpolate",
          value: 0.1,
        },
      ],
    }),
    target: visibleEntity({
      channels: [
        {
          key: "opacity",
          ownerKey: "target-effective",
          ownerPriority: 100,
          channelClass: "continuous-scalar",
          capability: "interpolate",
          value: 0.8,
        },
      ],
    }),
  });

  assert.equal(result.assignment, "preserve-interpolate");
  assert.equal(result.changedChannels[0]?.sourceValue, 0.4);
  assert.equal(result.changedChannels[0]?.targetValue, 0.8);
  assert.equal(result.changedChannels[0]?.ownerKey, "target-effective");
});

test("derived entities follow their dependency unless promoted", () => {
  const assignments = classifyTransitionRenderGraphs({
    source: [
      visibleEntity({
        entityKey: "entity:section-source",
        channels: [
          {
            key: "frame-position",
            channelClass: "spatial-transform",
            capability: "interpolate",
            value: 10,
          },
        ],
      }),
      visibleEntity({
        entityKey: "entity:section-derived-line",
        derivedFromEntityKey: "entity:section-source",
      }),
    ],
    target: [
      visibleEntity({
        entityKey: "entity:section-source",
        channels: [
          {
            key: "frame-position",
            channelClass: "spatial-transform",
            capability: "interpolate",
            value: 20,
          },
        ],
      }),
      visibleEntity({
        entityKey: "entity:section-derived-line",
        derivedFromEntityKey: "entity:section-source",
      }),
    ],
  });
  const parent = assignments.find(
    (assignment) => assignment.entityKey === "entity:section-source",
  );
  const derived = assignments.find(
    (assignment) => assignment.entityKey === "entity:section-derived-line",
  );

  assert.equal(parent?.assignment, "preserve-interpolate");
  assert.equal(derived?.derivedFromEntityKey, "entity:section-source");
  assert.equal(derived?.dependencyPolicy, "follow-source");
  assert.equal(derived?.assignment, "preserve-interpolate");
});

test("assignments are ordered by dependency depth before entity key", () => {
  const assignments = classifyTransitionRenderGraphs({
    source: [
      visibleEntity({
        entityKey: "entity:a-derived",
        derivedFromEntityKey: "entity:z-parent",
        metadata: {
          pageId: "page-24",
          pageOrder: 24,
          projectName: "fixture-project",
          toolLabel: "Fixture Tool",
        },
      }),
      visibleEntity({
        entityKey: "entity:z-parent",
        metadata: {
          pageId: "page-23",
          pageOrder: 23,
          projectName: "fixture-project",
          toolLabel: "Fixture Tool",
        },
      }),
      visibleEntity({
        entityKey: "entity:b-independent",
      }),
    ],
    target: [
      visibleEntity({
        entityKey: "entity:a-derived",
        derivedFromEntityKey: "entity:z-parent",
        metadata: {
          pageId: "random-target",
          pageOrder: 999,
          projectName: "random-project",
          toolLabel: "Renamed Fixture Tool",
        },
      }),
      visibleEntity({
        entityKey: "entity:z-parent",
      }),
      visibleEntity({
        entityKey: "entity:b-independent",
      }),
    ],
  });

  assert.deepEqual(
    assignments.map((assignment) => assignment.entityKey),
    ["entity:b-independent", "entity:z-parent", "entity:a-derived"],
  );
});

test("target-only unready entity holds instead of entering partial target", () => {
  const result = classifyTransitionEntityPair({
    source: undefined,
    target: visibleEntity({ readinessState: "loading" }),
  });

  assert.equal(result.assignment, "hold-until-ready");
  assert.equal(result.executionMode, "hold-source");
  assert.match(result.fallbackReason ?? "", /not ready/i);
});

test("assignments declare execution and idempotent final commit policy", () => {
  const result = classifyTransitionEntityPair({
    source: visibleEntity(),
    target: visibleEntity({
      channels: [
        {
          key: "opacity",
          channelClass: "continuous-scalar",
          capability: "interpolate",
          value: 0.8,
        },
      ],
    }),
  });

  assert.equal(result.assignment, "preserve-interpolate");
  assert.equal(result.executionMode, "interpolate-channels");
  assert.equal(result.finalCommitPolicy, "visually-idempotent-target");
});

test("classifier output is not wired into scene mutation while contract is draft", () => {
  const runtimeFiles = [
    "src/scene/transitions/transitionEffectiveLayersForPage.ts",
    "src/scene/transitions/layerTweenRuntime.ts",
    "src/scene/SceneManager.ts",
  ];
  for (const file of runtimeFiles) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.doesNotMatch(
      source,
      /transitionEntityPolicy|classifyTransitionEntityPair|classifyTransitionRenderGraphs|transitionAssignmentForLayer/,
      `${file} must not consume classifier assignments before execution-layer contract work`,
    );
  }
});
