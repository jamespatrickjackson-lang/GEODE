import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import * as esbuild from "esbuild";

const repoRoot = process.cwd();

async function importBundled(entryPoint) {
  const dir = await mkdtemp(join(tmpdir(), "geosee-camera-path-v31-test-"));
  const outfile = join(dir, "bundle.mjs");
  await esbuild.build({
    entryPoints: [join(repoRoot, entryPoint)],
    bundle: true,
    format: "esm",
    platform: "browser",
    outfile,
    logLevel: "silent",
  });
  return import(pathToFileURL(outfile).href);
}

function displayOptions() {
  return {
    trackColor: "#ff6b4a",
    selectedColor: "#f8fafc",
    targetColor: "#7dd3fc",
    focusColor: "#facc15",
    trackLineSize: 3,
    directionRayLength: 1.5,
    handleScale: 120,
    showCameraFrustum: true,
    showLookRays: true,
    showFocusLockRays: true,
    showNodeLabels: false,
    showTimelineGhost: true,
    showSplineControls: true,
    showXyzHandles: true,
    defaultSplineCoupling: "tangent",
    previewMonitorMode: "while-editing",
  };
}

function node(id, position) {
  return {
    id,
    kind: "keyframe",
    enabled: true,
    hidden: false,
    timeSeconds: 0,
    position,
    target: [position[0], position[1] + 1, position[2]],
    up: [0, 0, 1],
    fov: 50,
    holdSecondsAfter: 0,
    aimGeometry: {
      mode: "free-direction",
      tangentForwardDistance: 1,
      lensMode: "fixed-fov",
      dollyZoomStrength: 0,
    },
  };
}

function segment(id, fromNodeId, toNodeId) {
  return {
    id,
    fromNodeId,
    toNodeId,
    enabled: true,
    hidden: false,
    transitionSeconds: 2,
    timeCurve: { mode: "linear" },
    pathFairing: {
      continuity: "G1",
      tension: 0.35,
      bias: 0,
      fromInfluenceOut: "auto",
      toInfluenceIn: "auto",
      autoHandles: true,
    },
  };
}

function validPathV3(overrides = {}) {
  return {
    version: 3,
    id: "path-v31",
    name: "Path v3.1",
    loop: false,
    timeline: { durationSeconds: 4 },
    displayOptions: displayOptions(),
    equationOverlayOptions: {
      visible: false,
      selectedTransitionOnly: true,
      showStackLabels: true,
      showTemporalRamp: true,
      showTangents: true,
      showInfluenceHandles: true,
      showCurvatureComb: true,
      showFocusDistance: true,
    },
    focusPoints: [],
    nodes: [node("a", [0, 0, 0]), node("b", [10, 0, 0]), node("c", [10, 10, 0])],
    segments: [segment("a-b", "a", "b"), segment("b-c", "b", "c")],
    ...overrides,
  };
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]);
  return length > 0 ? [v[0] / length, v[1] / length, v[2] / length] : [0, 0, 0];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v, factor) {
  return [v[0] * factor, v[1] * factor, v[2] * factor];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function cubicDerivative(bezier, t) {
  const inv = 1 - t;
  return add(
    add(
      scale(subtract(bezier.p1, bezier.p0), 3 * inv * inv),
      scale(subtract(bezier.p2, bezier.p1), 6 * inv * t),
    ),
    scale(subtract(bezier.p3, bezier.p2), 3 * t * t),
  );
}

function cubicSecondDerivative(bezier, t) {
  return add(
    scale(add(subtract(bezier.p2, scale(bezier.p1, 2)), bezier.p0), 6 * (1 - t)),
    scale(add(subtract(bezier.p3, scale(bezier.p2, 2)), bezier.p1), 6 * t),
  );
}

function curvature(bezier, t) {
  const first = cubicDerivative(bezier, t);
  const second = cubicSecondDerivative(bezier, t);
  const speed = Math.max(0.000001, Math.hypot(first[0], first[1], first[2]));
  return Math.hypot(...cross(first, second)) / (speed * speed * speed);
}

function curvatureJump(leftBezier, rightBezier) {
  return Math.abs(curvature(leftBezier, 1) - curvature(rightBezier, 0));
}

function curvatureFlowSpike(beziers) {
  const samples = [];
  for (const bezier of beziers) {
    for (const t of [0.2, 0.5, 0.8]) {
      samples.push(curvature(bezier, t));
    }
  }
  let spike = 0;
  for (let index = 1; index < samples.length; index += 1) {
    spike = Math.max(spike, Math.abs(samples[index] - samples[index - 1]));
  }
  return spike;
}

function withContinuity(path, continuity) {
  return {
    ...path,
    nodes: path.nodes.map((entry) => ({
      ...entry,
      splineControls: {
        ...entry.splineControls,
        continuity,
        handleMode: continuity === "G0" ? "vector" : "auto",
        coupling: continuity === "G0" ? "non-tangent" : "tangent",
      },
    })),
    segments: path.segments.map((entry) => ({
      ...entry,
      pathFairing: { ...entry.pathFairing, continuity },
    })),
  };
}

test("V3.1 normalizes node-owned spline controls and preserves authored node positions", async () => {
  const {
    normalizeCaptureCameraPathV3,
    resolveCaptureCameraPathBezierSegment,
    validateCaptureCameraPathV3,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const path = normalizeCaptureCameraPathV3(validPathV3());
  assert.equal(validateCaptureCameraPathV3(path).valid, true);
  assert.equal(path.nodes[1].splineControls.enabled, true);
  assert.equal(path.nodes[1].splineControls.coupling, "tangent");
  assert.equal(path.nodes[1].splineControls.in.length, "auto");
  assert.equal(path.nodes[1].splineControls.out.length, "auto");

  const bezier = resolveCaptureCameraPathBezierSegment(path, path.segments[0]);
  assert.deepEqual(bezier.p0, [0, 0, 0]);
  assert.deepEqual(bezier.p3, [10, 0, 0]);
  assert.deepEqual(path.nodes[1].position, [10, 0, 0]);
});

test("V3.1 auto tangent handles relax shared-node corners until minimum radius is needed", async () => {
  const {
    normalizeCaptureCameraPathV3,
    resolveCaptureCameraPathBezierSegment,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const path = withContinuity(
    normalizeCaptureCameraPathV3(
      validPathV3({
        nodes: [
          node("a", [0, 0, 0]),
          node("b", [0, 10, 0]),
          node("c", [10, 10, 0]),
        ],
        segments: [
          segment("a-b", "a", "b"),
          segment("b-c", "b", "c"),
        ],
      }),
    ),
    "G1",
  );
  const incoming = resolveCaptureCameraPathBezierSegment(path, path.segments[0]);
  const outgoing = resolveCaptureCameraPathBezierSegment(path, path.segments[1]);

  assert.ok(
    distance(incoming.p2, incoming.p3) >= 3.2,
    "incoming auto handle should keep enough reach to round the corner",
  );
  assert.ok(
    distance(outgoing.p1, outgoing.p0) >= 3.2,
    "outgoing auto handle should keep enough reach to round the corner",
  );
  assert.ok(
    distance(incoming.p2, incoming.p3) <= 3.9,
    "ordinary 90-degree corners should stay relaxed instead of using oversized handles",
  );
  assert.ok(
    distance(outgoing.p1, outgoing.p0) <= 3.9,
    "ordinary 90-degree corners should stay relaxed instead of using oversized handles",
  );
  assert.deepEqual(path.nodes.map((entry) => entry.position), [
    [0, 0, 0],
    [0, 10, 0],
    [10, 10, 0],
  ]);
});

test("V3.1 auto tangent handle reach follows bend angle and minimum radius", async () => {
  const {
    normalizeCaptureCameraPathV3,
    resolveCaptureCameraPathBezierSegment,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const nearlyTangent = withContinuity(
    normalizeCaptureCameraPathV3(
      validPathV3({
        nodes: [
          node("a", [0, 0, 0]),
          node("b", [10, 0, 0]),
          node("c", [20, 1, 0]),
        ],
        segments: [
          segment("a-b", "a", "b"),
          segment("b-c", "b", "c"),
        ],
      }),
    ),
    "G1",
  );
  const tangentIncoming = resolveCaptureCameraPathBezierSegment(
    nearlyTangent,
    nearlyTangent.segments[0],
  );
  const tangentReach = distance(tangentIncoming.p2, tangentIncoming.p3);
  assert.ok(
    tangentReach < 2,
    `near-tangent bend should reduce handle reach below nominal auto scale, got ${tangentReach}`,
  );

  const squareTurn = withContinuity(
    normalizeCaptureCameraPathV3(
      validPathV3({
        nodes: [
          node("a", [0, 0, 0]),
          node("b", [0, 10, 0]),
          node("c", [10, 10, 0]),
        ],
        segments: [
          segment("a-b", "a", "b"),
          segment("b-c", "b", "c"),
        ],
      }),
    ),
    "G1",
  );
  const squareIncoming = resolveCaptureCameraPathBezierSegment(
    squareTurn,
    squareTurn.segments[0],
  );
  const squareReach = distance(squareIncoming.p2, squareIncoming.p3);
  assert.ok(
    squareReach >= 3.2 && squareReach <= 3.9,
    `90-degree bend should stay near relaxed auto reach unless the radius guard is needed, got ${squareReach}`,
  );

  const sharpTurn = withContinuity(
    normalizeCaptureCameraPathV3(
      validPathV3({
        nodes: [
          node("a", [0, 0, 0]),
          node("b", [10, 0, 0]),
          node("c", [3, 7, 0]),
        ],
        segments: [
          segment("a-b", "a", "b"),
          segment("b-c", "b", "c"),
        ],
      }),
    ),
    "G1",
  );
  const sharpIncoming = resolveCaptureCameraPathBezierSegment(
    sharpTurn,
    sharpTurn.segments[0],
  );
  const sharpReach = distance(sharpIncoming.p2, sharpIncoming.p3);
  assert.ok(
    sharpReach > squareReach,
    `sharp bends should expand the handle only when the minimum-radius guard is active, got ${sharpReach} vs ${squareReach}`,
  );
});

test("V3.1 tangent handle edits on a shared node affect both adjacent curve sides", async () => {
  const {
    moveCaptureCameraPathSplineHandle,
    normalizeCaptureCameraPathV3,
    sampleCaptureCameraPathV3,
    setCaptureCameraPathNodeSplineCoupling,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const base = setCaptureCameraPathNodeSplineCoupling(
    normalizeCaptureCameraPathV3(validPathV3()),
    "b",
    "tangent",
  );
  const moved = moveCaptureCameraPathSplineHandle(base, "b", "out", [16, 0, 0]);

  assert.deepEqual(moved.nodes.find((entry) => entry.id === "b").position, [10, 0, 0]);
  const beforeLeft = sampleCaptureCameraPathV3(base, 1).position;
  const beforeRight = sampleCaptureCameraPathV3(base, 3).position;
  const afterLeft = sampleCaptureCameraPathV3(moved, 1).position;
  const afterRight = sampleCaptureCameraPathV3(moved, 3).position;
  assert.ok(distance(beforeLeft, afterLeft) > 0.05, "incoming side should respond");
  assert.ok(distance(beforeRight, afterRight) > 0.05, "outgoing side should respond");

  const controls = moved.nodes.find((entry) => entry.id === "b").splineControls;
  assert.ok(dot(normalize(controls.in.direction), normalize(controls.out.direction)) < -0.99);
});

test("V3.1 non-tangent handle edits affect only the edited side", async () => {
  const {
    moveCaptureCameraPathSplineHandle,
    normalizeCaptureCameraPathV3,
    sampleCaptureCameraPathV3,
    setCaptureCameraPathNodeSplineCoupling,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const base = setCaptureCameraPathNodeSplineCoupling(
    normalizeCaptureCameraPathV3(validPathV3()),
    "b",
    "non-tangent",
  );
  const moved = moveCaptureCameraPathSplineHandle(base, "b", "out", [16, 6, 0]);

  const beforeLeft = sampleCaptureCameraPathV3(base, 1).position;
  const beforeRight = sampleCaptureCameraPathV3(base, 3).position;
  const afterLeft = sampleCaptureCameraPathV3(moved, 1).position;
  const afterRight = sampleCaptureCameraPathV3(moved, 3).position;
  assert.ok(distance(beforeLeft, afterLeft) < 0.001, "incoming side remains stable");
  assert.ok(distance(beforeRight, afterRight) > 0.05, "outgoing side responds");
});

test("V3.1 loopback guard clamps unsafe manual handles without changing timing", async () => {
  const {
    moveCaptureCameraPathSplineHandle,
    normalizeCaptureCameraPathV3,
    resolveCaptureCameraPathBezierSegment,
    resolveCaptureCameraPathV3Timeline,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const base = normalizeCaptureCameraPathV3(
    validPathV3({
      nodes: [node("a", [0, 0, 0]), node("b", [12, 0, 0]), node("c", [12, 4, 0])],
      segments: [segment("a-b", "a", "b"), segment("b-c", "b", "c")],
    }),
  );
  const moved = moveCaptureCameraPathSplineHandle(base, "a", "out", [1000, 1000, 0]);
  const bezier = resolveCaptureCameraPathBezierSegment(moved, moved.segments[0]);
  assert.equal(resolveCaptureCameraPathV3Timeline(moved).durationSeconds, 4);
  assert.equal(bezier.diagnostics.loopbackGuardApplied, true);
  assert.ok(distance(bezier.p0, bezier.p1) <= 20.001);
});

test("V3.1 G2 preserves the angle-derived bend-radius reach without moving authored nodes", async () => {
  const {
    normalizeCaptureCameraPathV3,
    resolveCaptureCameraPathBezierSegment,
    resolveCaptureCameraPathV3Timeline,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const base = normalizeCaptureCameraPathV3(
    validPathV3({
      nodes: [node("a", [0, 0, 0]), node("b", [12, 0, 0]), node("c", [12, 4, 0])],
      segments: [segment("a-b", "a", "b"), segment("b-c", "b", "c")],
    }),
  );
  const g1Path = withContinuity(base, "G1");
  const g2Path = withContinuity(base, "G2");
  const g1Left = resolveCaptureCameraPathBezierSegment(g1Path, g1Path.segments[0]);
  const g1Right = resolveCaptureCameraPathBezierSegment(g1Path, g1Path.segments[1]);
  const g2Left = resolveCaptureCameraPathBezierSegment(g2Path, g2Path.segments[0]);
  const g2Right = resolveCaptureCameraPathBezierSegment(g2Path, g2Path.segments[1]);

  assert.ok(
    curvatureJump(g2Left, g2Right) <= curvatureJump(g1Left, g1Right) + 0.000001,
    "G2 should not reintroduce curvature discontinuity after G1 reaches the radius floor",
  );
  assert.ok(
    distance(g2Left.p2, g2Left.p3) >= distance(g1Left.p2, g1Left.p3) - 0.000001,
    "G2 should not tighten the incoming handle below the angle-derived radius reach",
  );
  assert.ok(
    distance(g2Right.p1, g2Right.p0) >= distance(g1Right.p1, g1Right.p0) - 0.000001,
    "G2 should not tighten the outgoing handle below the angle-derived radius reach",
  );
  assert.deepEqual(g2Path.nodes.map((entry) => entry.position), base.nodes.map((entry) => entry.position));
  assert.equal(resolveCaptureCameraPathV3Timeline(g2Path).durationSeconds, 4);
  assert.equal(g2Left.diagnostics.requestedContinuity, "G2");
  assert.equal(g2Left.diagnostics.effectiveContinuity, "G2");
});

test("V3.1 G3 preserves bend-radius reach across a longer rail", async () => {
  const {
    normalizeCaptureCameraPathV3,
    resolveCaptureCameraPathBezierSegment,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const longPath = normalizeCaptureCameraPathV3(
    validPathV3({
      timeline: { durationSeconds: 8 },
      nodes: [
        node("a", [0, 0, 0]),
        node("b", [7, 2, 0]),
        node("c", [14, -3, 0]),
        node("d", [21, 5, 0]),
        node("e", [28, 0, 0]),
      ],
      segments: [
        segment("a-b", "a", "b"),
        segment("b-c", "b", "c"),
        segment("c-d", "c", "d"),
        segment("d-e", "d", "e"),
      ],
    }),
  );
  const g2Path = withContinuity(longPath, "G2");
  const g3Path = withContinuity(longPath, "G3");
  const g2Beziers = g2Path.segments.map((entry) => resolveCaptureCameraPathBezierSegment(g2Path, entry));
  const g3Beziers = g3Path.segments.map((entry) => resolveCaptureCameraPathBezierSegment(g3Path, entry));

  assert.ok(
    Number.isFinite(curvatureFlowSpike(g3Beziers)),
    "G3 should keep a finite curvature-flow score after bend-radius fairing",
  );
  for (let index = 0; index < g3Beziers.length; index += 1) {
    assert.ok(
      distance(g3Beziers[index].p1, g3Beziers[index].p0) > 0,
      "G3 should keep a positive outgoing handle reach",
    );
    assert.ok(
      distance(g3Beziers[index].p2, g3Beziers[index].p3) > 0,
      "G3 should keep a positive incoming handle reach",
    );
  }
  assert.deepEqual(g3Path.nodes.map((entry) => entry.position), longPath.nodes.map((entry) => entry.position));
  assert.equal(g3Beziers[1].diagnostics.requestedContinuity, "G3");
});

test("V3.1 unsafe Gx handles damp, downgrade, and report guard diagnostics", async () => {
  const {
    moveCaptureCameraPathSplineHandle,
    normalizeCaptureCameraPathV3,
    resolveCaptureCameraPathBezierSegment,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const base = withContinuity(normalizeCaptureCameraPathV3(validPathV3()), "G3");
  const pulled = moveCaptureCameraPathSplineHandle(base, "a", "out", [-200, 260, 0]);
  const bezier = resolveCaptureCameraPathBezierSegment(pulled, pulled.segments[0]);

  assert.equal(bezier.diagnostics.requestedContinuity, "G3");
  assert.ok(
    bezier.diagnostics.derivativeGuardApplied ||
      bezier.diagnostics.envelopeGuardApplied ||
      bezier.diagnostics.loopbackGuardApplied,
    "extreme handles should trigger at least one Gx guard",
  );
  assert.ok(bezier.diagnostics.warnings.length > 0, "guarded handles should explain the repair");
  assert.ok(
    ["G1", "G2", "G3"].includes(bezier.diagnostics.effectiveContinuity),
    "effective continuity should remain a supported continuity class",
  );
  assert.ok(
    bezier.diagnostics.fallbackApplied ||
      distance(bezier.p0, bezier.p1) < distance([0, 0, 0], [-200, 260, 0]),
    "unsafe handles should be damped or downgraded",
  );
  assert.deepEqual(pulled.nodes.find((entry) => entry.id === "a").position, [0, 0, 0]);
});

test("V3.1 time easing changes progress only, not effective Bezier controls", async () => {
  const {
    normalizeCaptureCameraPathV3,
    resolveCaptureCameraPathBezierSegment,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const base = normalizeCaptureCameraPathV3(validPathV3());
  const eased = normalizeCaptureCameraPathV3({
    ...base,
    segments: base.segments.map((entry) => ({
      ...entry,
      timeCurve: { mode: "ease-in-out" },
    })),
  });
  const baseBezier = resolveCaptureCameraPathBezierSegment(base, base.segments[0]);
  const easedBezier = resolveCaptureCameraPathBezierSegment(eased, eased.segments[0]);

  assert.deepEqual(easedBezier.p0, baseBezier.p0);
  assert.deepEqual(easedBezier.p1, baseBezier.p1);
  assert.deepEqual(easedBezier.p2, baseBezier.p2);
  assert.deepEqual(easedBezier.p3, baseBezier.p3);
});

test("V3.1 sampled overlay rail ignores hold plateaus to avoid visual spline jank", async () => {
  const {
    captureCameraPathV3SampledPoints,
    normalizeCaptureCameraPathV3,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const path = normalizeCaptureCameraPathV3(
    validPathV3({
      timeline: { durationSeconds: 12 },
      nodes: [
        { ...node("a", [0, 0, 0]), holdSecondsAfter: 6 },
        { ...node("b", [8, 0, 0]), holdSecondsAfter: 4 },
        node("c", [12, 5, 0]),
      ],
      segments: [
        { ...segment("a-b", "a", "b"), transitionSeconds: 1 },
        { ...segment("b-c", "b", "c"), transitionSeconds: 1 },
      ],
    }),
  );

  const points = captureCameraPathV3SampledPoints(path, 24);
  assert.ok(points.length >= 32, "spatial rail should stay sufficiently sampled");
  assert.deepEqual(points[0], [0, 0, 0]);
  assert.deepEqual(points[points.length - 1], [12, 5, 0]);
  for (let index = 1; index < points.length; index += 1) {
    assert.ok(
      distance(points[index - 1], points[index]) > 0.0001,
      "spatial rail samples should not repeat held camera positions",
    );
  }
});

test("V3.1 mixed continuity equations keep preview travel smooth through handoff nodes", async () => {
  const {
    normalizeCaptureCameraPathV3,
    sampleCaptureCameraPathV3,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const base = normalizeCaptureCameraPathV3(
    validPathV3({
      timeline: { durationSeconds: 4 },
      nodes: [
        node("a", [0, 0, 0]),
        node("b", [12, 0, 0]),
        node("c", [15, 12, 0]),
      ],
      segments: [
        {
          ...segment("a-b", "a", "b"),
          pathFairing: { ...segment("a-b", "a", "b").pathFairing, continuity: "G1" },
          timeCurve: { mode: "ease-out" },
        },
        {
          ...segment("b-c", "b", "c"),
          pathFairing: { ...segment("b-c", "b", "c").pathFairing, continuity: "G3" },
          timeCurve: { mode: "ease-in" },
        },
      ],
    }),
  );
  const path = {
    ...base,
    nodes: base.nodes.map((entry) => ({
      ...entry,
      splineControls: {
        ...entry.splineControls,
        continuity: entry.id === "a" ? "G0" : entry.id === "b" ? "G1" : "G3",
      },
    })),
  };

  const samples = Array.from({ length: 17 }, (_value, index) =>
    sampleCaptureCameraPathV3(path, 1.2 + index * 0.1).position,
  );
  const distances = samples.slice(1).map((sample, index) => distance(sample, samples[index]));
  const largest = Math.max(...distances);
  const smallest = Math.min(...distances.filter((entry) => entry > 0.000_001));

  assert.ok(
    largest / smallest <= 2.1,
    `mixed equation handoff should not create a visible travel-speed spike, got ratio ${largest / smallest}`,
  );
});

test("V3.1 XYZ node movement translates manual handles only through explicit node move", async () => {
  const {
    moveCaptureCameraPathNodeAxis,
    moveCaptureCameraPathSplineHandle,
    normalizeCaptureCameraPathV3,
  } = await importBundled("src/capture/captureCameraPathV3.ts");

  const path = moveCaptureCameraPathSplineHandle(
    normalizeCaptureCameraPathV3(validPathV3()),
    "b",
    "out",
    [15, 0, 0],
  );
  const before = path.nodes.find((entry) => entry.id === "b");
  const moved = moveCaptureCameraPathNodeAxis(path, "b", "x", 2);
  const after = moved.nodes.find((entry) => entry.id === "b");

  assert.deepEqual(after.position, [12, 0, 0]);
  assert.equal(after.splineControls.out.mode, "manual");
  assert.deepEqual(after.splineControls.out.position, [
    before.splineControls.out.position[0] + 2,
    before.splineControls.out.position[1],
    before.splineControls.out.position[2],
  ]);
});
