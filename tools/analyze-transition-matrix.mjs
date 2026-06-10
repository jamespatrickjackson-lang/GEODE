// DECK-STATE TOOL ONLY.
// This tool may inspect live project pageOrder as presentation/deck evidence.
// Its output is not app-behavior proof and must not be used to justify
// page-id, page-index, page-title, or page-pair runtime fixes.
// App behavior must be tested with synthetic fixtures or fixture builders.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_RESULTS_DIR = path.join(
  "docs",
  "dev-context",
  "artifacts",
  "transition-matrix",
);
const DEFAULT_OPACITY_JUMP_THRESHOLD = 0.25;
const MAX_DETAIL_ROWS = 24;
const MIN_ACTIVE_TRACE_SAMPLES = 12;
const MAX_ACTIVE_TRACE_GAP_MS = 150;
const SCENE_SECTION_GROUND_TRACE_SNAPSHOT_POLICY =
  "mirror-delayed-ground-trace-into-helper-snapshot";

function isReadPixelsWarning(message) {
  return /ReadPixels/i.test(message?.text ?? "");
}

function stableLayerKey(entry) {
  return [
    entry.layerId,
    entry.family,
    entry.policy,
    entry.transitionKind,
    entry.stateSource,
    entry.sourceVisible,
    entry.targetVisible,
  ].join("|");
}

function summarizeRows(rows, maxRows = MAX_DETAIL_ROWS) {
  const seen = new Set();
  const summarized = [];
  for (const row of rows) {
    const key = stableLayerKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    summarized.push(row);
    if (summarized.length >= maxRows) break;
  }
  return summarized;
}

function artifactRows(manifest) {
  const rows = [];
  for (const item of manifest?.cases ?? []) {
    for (const artifact of item.artifacts ?? []) {
      rows.push({
        caseId: item.id ?? null,
        caseName: item.name ?? null,
        step: artifact.step ?? null,
        summary: artifact.stateSummary ?? {},
      });
    }
  }
  return rows;
}

function productRows(manifest) {
  const rows = [];
  for (const row of artifactRows(manifest)) {
    for (const product of row.summary.productFamilies ?? []) {
      rows.push({
        caseId: row.caseId,
        caseName: row.caseName,
        step: row.step,
        runStatus: row.summary.runStatus ?? null,
        runReason: row.summary.runReason ?? null,
        runSourcePageId: row.summary.runSourcePageId ?? null,
        runTargetPageId: row.summary.runTargetPageId ?? null,
        sceneSourcePageId: row.summary.sceneSourcePageId ?? null,
        sceneTargetPageId: row.summary.sceneTargetPageId ?? null,
        sceneSectionHelpers: row.summary.sceneSectionHelpers ?? null,
        ...product,
      });
    }
  }
  return rows;
}

function readTraceForCase(manifest, item) {
  if (item?.trace?.samples) return item.trace;
  if (!item?.traceJson || !manifest?.outputRoot) return null;
  const tracePath = path.join(manifest.outputRoot, item.traceJson);
  if (!existsSync(tracePath)) return null;
  try {
    return JSON.parse(readFileSync(tracePath, "utf8"));
  } catch {
    return null;
  }
}

function traceRows(manifest) {
  const rows = [];
  for (const item of manifest?.cases ?? []) {
    const trace = readTraceForCase(manifest, item);
    if (!trace?.samples?.length) continue;
    rows.push({
      caseId: item.id ?? trace.metadata?.caseId ?? null,
      caseName: item.name ?? trace.metadata?.caseName ?? null,
      sourcePageId: item.sourcePageId ?? trace.metadata?.sourcePageId ?? null,
      targetPageId: item.targetPageId ?? trace.metadata?.targetPageId ?? null,
      traceJson: item.traceJson ?? null,
      sampling: trace.sampling ?? null,
      sampleIntervalMs: trace.sampleIntervalMs ?? null,
      stoppedReason: trace.stoppedReason ?? null,
      maxDurationMs: trace.maxDurationMs ?? null,
      samples: trace.samples,
    });
  }
  return rows;
}

function adjacentCoverageGaps(manifest) {
  if (manifest?.matrixScope?.mode === "selected-cases") return [];
  const pageIds = manifest?.pageIds ?? [];
  if (!Array.isArray(pageIds) || pageIds.length < 2) return [];
  const coveredPairs = new Set();
  for (const item of manifest?.cases ?? []) {
    if (Number.isInteger(item?.fromIndex) && Number.isInteger(item?.toIndex)) {
      coveredPairs.add(`${item.fromIndex}:${item.toIndex}`);
    }
  }
  const gaps = [];
  for (let index = 0; index < pageIds.length - 1; index += 1) {
    const key = `${index}:${index + 1}`;
    if (coveredPairs.has(key)) continue;
    gaps.push({
      fromIndex: index,
      toIndex: index + 1,
      sourcePageId: pageIds[index] ?? null,
      targetPageId: pageIds[index + 1] ?? null,
      classification: "uncaptured-adjacent-transition",
      visualPolicy: "add-targeted-matrix-case-before-visual-fix",
      risk: "coverage-gap",
      classificationReason:
        "Adjacent page transition is not directly represented by a normal matrix case.",
    });
  }
  return gaps;
}

function matrixCaptureFailures(manifest) {
  const rows = [];
  const pageIds = manifest?.pageIds ?? [];
  for (const item of manifest?.cases ?? []) {
    if (item?.failed) {
      rows.push({
        caseId: item.id ?? null,
        caseName: item.name ?? null,
        caseGroup: item.caseGroup ?? null,
        fromIndex: item.fromIndex ?? null,
        toIndex: item.toIndex ?? null,
        sourcePageId:
          pageIds[item.fromIndex] ??
          item.failure?.sourcePageId ??
          item.sourcePageId ??
          null,
        targetPageId:
          pageIds[item.toIndex] ??
          item.failure?.targetPageId ??
          item.targetPageId ??
          null,
        observedCurrentPageId:
          item.failure?.observedCurrentPageId ??
          item.failure?.state?.currentPageId ??
          null,
        observedTargetPageId:
          item.failure?.observedTargetPageId ??
          item.failure?.state?.targetPageId ??
          null,
        failureKind: "capture-failure",
        matrixPhase: item.failure?.error?.matrixPhase ?? null,
        message: item.failure?.error?.message ?? null,
        screenshot: item.failure?.screenshot ?? null,
      });
    }
    if (item?.traceFailure) {
      rows.push({
        caseId: item.id ?? null,
        caseName: item.name ?? null,
        caseGroup: item.caseGroup ?? null,
        fromIndex: item.fromIndex ?? null,
        toIndex: item.toIndex ?? null,
        sourcePageId: item.sourcePageId ?? null,
        targetPageId: item.targetPageId ?? item.finalTargetPageId ?? null,
        failureKind: "trace-replay-failure",
        matrixPhase: item.traceFailure?.error?.matrixPhase ?? null,
        message: item.traceFailure?.error?.message ?? null,
        screenshot: null,
      });
    }
  }
  return rows;
}

function isPolicyMismatch(product) {
  const policy = product.policy;
  const kind = product.transitionKind;
  if (policy === "preserve") return kind !== "none";
  if (policy === "state-source-only") {
    return product.sourceVisible === true || product.targetVisible === true;
  }
  if (policy === "fade-opacity") {
    const visibilityChanged = product.sourceVisible !== product.targetVisible;
    const opacityChanged =
      Math.abs(opacityValue(product.targetOpacity) - opacityValue(product.sourceOpacity)) >
      0.001;
    return !visibilityChanged && !opacityChanged;
  }
  if (policy === "crossfade-discrete") {
    return kind !== "discrete-crossfade";
  }
  if (policy === "interpolate-style") return kind !== "continuous";
  if (policy === "interpolate-full-density-scalar") {
    return kind !== "full-density-scalar";
  }
  return false;
}

function familyCount(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = `${row.family ?? "unknown"} / ${row.policy ?? "unknown"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort());
}

function sourceTargetDivergences(manifest) {
  const rows = [];
  for (const row of artifactRows(manifest)) {
    const summary = row.summary;
    const runSource = summary.runSourcePageId ?? null;
    const runTarget = summary.runTargetPageId ?? null;
    const sceneSource = summary.sceneSourcePageId ?? null;
    const sceneTarget = summary.sceneTargetPageId ?? null;
    if (!runSource || !runTarget || !sceneSource || !sceneTarget) continue;
    if (runSource !== sceneSource || runTarget !== sceneTarget) {
      rows.push({
        caseId: row.caseId,
        caseName: row.caseName,
        step: row.step,
        runReason: summary.runReason ?? null,
        runSourcePageId: runSource,
        runTargetPageId: runTarget,
        sceneSourcePageId: sceneSource,
        sceneTargetPageId: sceneTarget,
      });
    }
  }
  return rows;
}

function opacityValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function cameraPoint(sample, field) {
  const value = sample?.[field];
  if (!value) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return null;
  }
  return { x, y, z };
}

function distance3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function rounded(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : 0;
}

function classifyHiddenProductState(product) {
  const sourceOpacity = opacityValue(product.sourceOpacity);
  const targetOpacity = opacityValue(product.targetOpacity);
  const dormant =
    product.policy === "state-source-only" &&
    product.sourceVisible !== true &&
    product.targetVisible !== true &&
    sourceOpacity <= 0.001 &&
    targetOpacity <= 0.001 &&
    product.transitionKind === "none";
  if (dormant) {
    return {
      ...product,
      classification: "intentional-dormant-authored-state",
      visualPolicy: "preserve-hidden-no-interpolation",
      risk: "low",
      classificationReason:
        "State is authored on source/target pages, but the product is hidden at both ends with zero opacity and no transition kind.",
    };
  }
  return {
    ...product,
    classification: "unresolved-hidden-transition-risk",
    visualPolicy: "review-before-visual-smoothing",
    risk: "medium",
    classificationReason:
      "Hidden product state has non-dormant visibility, opacity, or transition metadata and needs review before smoothing.",
  };
}

function classifyLoadedAtStartFalse(product) {
  const sourceOpacity = opacityValue(product.sourceOpacity);
  const targetOpacity = opacityValue(product.targetOpacity);
  const dormantSceneSectionHelper =
    product.family === "scene-section-helpers" &&
    product.policy === "state-source-only" &&
    product.stateSource === "authored-layer" &&
    product.sourceVisible !== true &&
    product.targetVisible !== true &&
    sourceOpacity <= 0.001 &&
    targetOpacity <= 0.001 &&
    product.transitionKind === "none";
  if (dormantSceneSectionHelper) {
    return {
      ...product,
      classification: "debug-only-unloaded-helper-state",
      visualPolicy: "preserve-hidden-helper-state-no-load",
      risk: "low",
      classificationReason:
        "Scene-section helper state is authored while hidden and no helper needs to be loaded for the transition frame.",
    };
  }
  return {
    ...product,
    classification: "unresolved-unloaded-transition-risk",
    visualPolicy: "review-late-load-before-visual-smoothing",
    risk: "medium",
    classificationReason:
      "Unloaded authored state could affect a visible handoff or require a family-specific late-load policy.",
  };
}

function classifyOpacityJump(product) {
  const policy = product.policy;
  if (policy === "fade-opacity") {
    return {
      ...product,
      classification: "policy-covered-opacity-fade",
      visualPolicy: "fade-opacity",
      risk: "low",
      classificationReason:
        "Visibility or opacity handoff is already represented as an opacity fade policy.",
    };
  }
  if (policy === "crossfade-discrete") {
    return {
      ...product,
      classification: "policy-covered-discrete-crossfade",
      visualPolicy: "crossfade-discrete",
      risk: "low",
      classificationReason:
        "Discrete data/style handoff is already represented as a snapshot crossfade policy.",
    };
  }
  if (policy === "translate-section-helpers") {
    return {
      ...product,
      classification: "policy-covered-section-helper-translation",
      visualPolicy: "translate-section-helpers",
      risk: "low",
      classificationReason:
        "Scene-section helper handoff is represented by the helper translation/style tween path.",
    };
  }
  if (policy === "preserve") {
    return {
      ...product,
      classification: "unresolved-preserve-opacity-delta",
      visualPolicy: "make-opacity-fade-policy-explicit",
      risk: "medium",
      classificationReason:
        "Source and target are both visible but opacity changes while the product policy still says preserve.",
    };
  }
  return {
    ...product,
    classification: "unresolved-opacity-jump-policy",
    visualPolicy: "review-before-visual-smoothing",
    risk: "medium",
    classificationReason:
      "Visible opacity jump does not map to a known policy-covered handoff.",
  };
}

function sectionIsoRenderOpacityRisks(products) {
  return products
    .filter((product) => {
      if (product.family !== "scalar-volume") return false;
      if (product.sourceVisible !== true || product.targetVisible !== true) {
        return false;
      }
      const sourceOpacity = opacityValue(product.sourceOpacity);
      const targetOpacity = opacityValue(product.targetOpacity);
      return (
        sourceOpacity >= 0.85 &&
        targetOpacity >= 0.2 &&
        targetOpacity <= 0.7 &&
        sourceOpacity - targetOpacity >= 0.25 &&
        /mt-resistivity-volume|section|iso|volume/i.test(
          `${product.layerId ?? ""} ${product.reason ?? ""}`,
        )
      );
    })
    .map((product) => ({
      ...product,
      classification: "probable-section-iso-render-opacity-mismatch",
      visualPolicy: "split-section-iso-overlay-opacity-from-layer-opacity",
      risk: "high",
      classificationReason:
        "Source opacity appears to come from rendered section ISO overlay material opacity, while target opacity appears to come from scalar-volume layer style opacity.",
    }));
}

function isSceneSectionGroundTraceHandoff(product) {
  return (
    product.family === "scene-section-helpers" &&
    product.policy === "translate-section-helpers" &&
    product.sourceVisible === true &&
    product.targetVisible === false &&
    opacityValue(product.sourceOpacity) > 0.5 &&
    opacityValue(product.targetOpacity) <= 0.001
  );
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function classifySceneSectionGroundTraceHandoff(product) {
  const helpers = product.sceneSectionHelpers ?? {};
  const snapshotGroundTraceCount =
    numberOrNull(helpers.snapshotGroundTraceCount) ?? 0;
  const covered =
    helpers.groundTracePolicy === SCENE_SECTION_GROUND_TRACE_SNAPSHOT_POLICY &&
    snapshotGroundTraceCount > 0;
  return {
    ...product,
    groundTracePolicy: helpers.groundTracePolicy ?? null,
    liveGroundTraceCount: numberOrNull(helpers.liveGroundTraceCount),
    snapshotGroundTraceCount,
    snapshotActive: helpers.snapshotActive === true,
    transitionOpacity: numberOrNull(helpers.transitionOpacity),
    classification: covered
      ? "scene-section-ground-trace-snapshot-covered"
      : "scene-section-ground-trace-disable-risk",
    visualPolicy: "hold-or-snapshot-ground-trace-through-helper-fade",
    risk: covered ? "low" : "high",
    classificationReason: covered
      ? "Source section helpers are being disabled, but delayed ground-trace geometry is mirrored into the active helper fade snapshot."
      : "Source section helpers are visible and target helpers are disabled; async ground-trace geometry may not be represented by the fade snapshot.",
  };
}

function sceneSectionGroundTraceHandoffs(products) {
  return products
    .filter(isSceneSectionGroundTraceHandoff)
    .map(classifySceneSectionGroundTraceHandoff);
}

function cameraPathRisks(manifest) {
  const risks = [];
  for (const trace of traceRows(manifest)) {
    const activeSamples = trace.samples.filter(
      (sample) => sample.runStatus === "active" || sample.isTransitioning === true,
    );
    if (activeSamples.length < 2) continue;
    const cameraSamples = activeSamples
      .map((sample) => ({
        sample,
        position: cameraPoint(sample, "cameraPosition"),
        target: cameraPoint(sample, "cameraTarget"),
      }))
      .filter((entry) => entry.position && entry.target);
    if (cameraSamples.length < 2) continue;

    const first = cameraSamples[0];
    const last = cameraSamples[cameraSamples.length - 1];
    const positionDistance = distance3(first.position, last.position);
    const targetDistance = distance3(first.target, last.target);
    let maxFramePositionDistance = 0;
    let maxFrameElapsedMs = 0;
    for (let index = 1; index < cameraSamples.length; index += 1) {
      const prev = cameraSamples[index - 1];
      const next = cameraSamples[index];
      const stepDistance = distance3(prev.position, next.position);
      if (stepDistance > maxFramePositionDistance) {
        maxFramePositionDistance = stepDistance;
        maxFrameElapsedMs = Math.max(
          0,
          (next.sample.elapsedMs ?? 0) - (prev.sample.elapsedMs ?? 0),
        );
      }
    }
    if (positionDistance < 500000 && maxFramePositionDistance < 300000) {
      continue;
    }
    risks.push({
      caseId: trace.caseId,
      caseName: trace.caseName,
      sourcePageId:
        first.sample.runSourcePageId ??
        first.sample.sceneSourcePageId ??
        trace.sourcePageId,
      targetPageId:
        first.sample.runTargetPageId ??
        first.sample.sceneTargetPageId ??
        trace.targetPageId,
      traceJson: trace.traceJson,
      sampleCount: cameraSamples.length,
      positionDistance: rounded(positionDistance),
      targetDistance: rounded(targetDistance),
      maxFramePositionDistance: rounded(maxFramePositionDistance),
      maxFrameElapsedMs: rounded(maxFrameElapsedMs),
      classification: "large-static-camera-path-risk",
      visualPolicy: "adaptive-camera-path-or-authoring-review",
      risk: "high",
      classificationReason:
        "The sampled camera path covers a very large distance during a single page transition, which can read as a stall or jump even when easing is mathematically continuous.",
    });
  }
  return risks;
}

function smoothnessTraceQualityRisks(manifest) {
  const risks = [];
  for (const trace of traceRows(manifest)) {
    const activeSamples = trace.samples.filter(
      (sample) => sample.runStatus === "active" || sample.isTransitioning === true,
    );
    const gaps = [];
    for (let index = 1; index < activeSamples.length; index += 1) {
      gaps.push(
        Math.max(
          0,
          (activeSamples[index].elapsedMs ?? 0) -
            (activeSamples[index - 1].elapsedMs ?? 0),
        ),
      );
    }
    const maxActiveGapMs = gaps.length > 0 ? Math.max(...gaps) : 0;
    const activeSpanMs =
      activeSamples.length > 1
        ? Math.max(
            0,
            (activeSamples[activeSamples.length - 1].elapsedMs ?? 0) -
              (activeSamples[0].elapsedMs ?? 0),
          )
        : 0;
    const activeSamplesPerSecond =
      activeSpanMs > 0
        ? Number(((activeSamples.length - 1) / (activeSpanMs / 1000)).toFixed(2))
        : activeSamples.length;

    const tooSparse = activeSamples.length < MIN_ACTIVE_TRACE_SAMPLES;
    const hasLongGap = maxActiveGapMs > MAX_ACTIVE_TRACE_GAP_MS;
    if (!tooSparse && !hasLongGap) continue;

    risks.push({
      caseId: trace.caseId,
      caseName: trace.caseName,
      sourcePageId: trace.sourcePageId,
      targetPageId: trace.targetPageId,
      traceJson: trace.traceJson,
      sampling: trace.sampling,
      sampleIntervalMs: trace.sampleIntervalMs,
      stoppedReason: trace.stoppedReason,
      sampleCount: trace.samples.length,
      activeSampleCount: activeSamples.length,
      activeSpanMs: rounded(activeSpanMs),
      activeSamplesPerSecond,
      maxActiveGapMs: rounded(maxActiveGapMs),
      classification: tooSparse
        ? "insufficient-active-smoothness-samples"
        : "long-active-smoothness-sample-gap",
      visualPolicy: "capture-denser-smoothness-evidence-before-visual-fix",
      risk: "high",
      classificationReason:
        "Trace samples are app-side, but active transition coverage is too sparse or has long gaps for judging visual smoothness/elegance.",
    });
  }
  return risks;
}

function numericDelta(after, before) {
  if (typeof after !== "number" || typeof before !== "number") return 0;
  if (!Number.isFinite(after) || !Number.isFinite(before)) return 0;
  return after - before;
}

function familyCountsDelta(after = {}, before = {}) {
  const keys = new Set([...Object.keys(after), ...Object.keys(before)]);
  const deltas = {};
  for (const key of keys) {
    const delta = (after[key] ?? 0) - (before[key] ?? 0);
    if (delta !== 0) deltas[key] = delta;
  }
  return deltas;
}

function compactSourceUrl(sourceUrl) {
  if (typeof sourceUrl !== "string" || sourceUrl.length === 0) return null;
  try {
    const parsed = new URL(sourceUrl);
    return parsed.pathname.replace(/^\/+/, "") || sourceUrl;
  } catch {
    const normalized = sourceUrl.replace(/\\/g, "/");
    for (const marker of ["src/", "tools/", "tests/", "node_modules/"]) {
      const markerIndex = normalized.indexOf(marker);
      if (markerIndex >= 0) return normalized.slice(markerIndex);
    }
    return normalized;
  }
}

function topAnimationFrameScript(scripts) {
  if (!Array.isArray(scripts) || scripts.length === 0) return {};
  return scripts
    .filter((script) => script && typeof script === "object")
    .slice()
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0] ?? {};
}

function topRenderLoopTicker(tickers) {
  if (!Array.isArray(tickers) || tickers.length === 0) return {};
  return tickers
    .filter((ticker) => ticker && typeof ticker === "object")
    .slice()
    .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0))[0] ?? {};
}

function animationFrameWorkSource(row) {
  const source = row.animationFrameTopScriptSourceAfter ?? "";
  const scriptFunction = row.animationFrameTopScriptFunctionAfter ?? "";
  const invoker = row.animationFrameTopScriptInvokerAfter ?? "";
  if (
    scriptFunction === "performWorkUntilDeadline" ||
    invoker === "MessagePort.onmessage" ||
    source.includes("node_modules/.vite/deps/")
  ) {
    return row.controllerTickProgressStateUpdatedAfter
      ? "react-scheduler-transition-state-update"
      : "react-scheduler";
  }
  if (
    source === "src/scene.ts" ||
    scriptFunction === "tick" ||
    invoker === "FrameRequestCallback"
  ) {
    if (row.renderLoopTopTickerNameAfter === "PageController.transitionTick") {
      return "scene-render-loop-page-controller-transition-tick";
    }
    if (row.renderLoopRenderMsAfter >= row.renderLoopTickersMsAfter) {
      return "scene-render-loop-render-submit";
    }
    return "scene-render-loop";
  }
  if (row.animationFrameSupportedAfter) return "animation-frame-attributed";
  return "unknown";
}

function gapClassification(row) {
  if (row.lateReapplyDelta > 0) return "long-gap-with-late-reapply";
  if (
    row.renderLoopRafDeltaMsAfter > MAX_ACTIVE_TRACE_GAP_MS ||
    row.renderLoopWallDeltaMsAfter > MAX_ACTIVE_TRACE_GAP_MS
  ) {
    if (row.timerIntervalMsAfter > 0 && row.timerExpectedTicksDuringGap > 0) {
      const minimumContinuedTicks = Math.max(
        2,
        row.timerExpectedTicksDuringGap * 0.5,
      );
      const maximumStalledTicks = Math.max(
        1,
        row.timerExpectedTicksDuringGap * 0.25,
      );
      if (
        row.timerTicksDuringGap >= minimumContinuedTicks &&
        row.timerDeltaMsAfter <= MAX_ACTIVE_TRACE_GAP_MS
      ) {
        return "long-gap-with-raf-only-cadence-loss";
      }
      if (
        row.timerTicksDuringGap <= maximumStalledTicks ||
        row.timerDeltaMsAfter > MAX_ACTIVE_TRACE_GAP_MS
      ) {
        if (
          row.animationFrameSupportedAfter &&
          row.animationFrameCountSinceLastSampleAfter > 0 &&
          (row.animationFrameTopScriptDurationMsAfter > 0 ||
            row.animationFrameBlockingDurationSinceLastSampleMsAfter >
              MAX_ACTIVE_TRACE_GAP_MS)
        ) {
          return "long-gap-with-animation-frame-script";
        }
        if (row.longTaskSupportedAfter) {
          if (
            row.longTaskCountSinceLastSampleAfter > 0 ||
            row.longTaskDurationSinceLastSampleMsAfter > MAX_ACTIVE_TRACE_GAP_MS ||
            row.longTaskMaxDurationSinceLastSampleMsAfter > MAX_ACTIVE_TRACE_GAP_MS
          ) {
            return "long-gap-with-main-thread-longtask";
          }
          return "long-gap-with-unattributed-timer-starvation";
        }
        return "long-gap-with-raf-and-timer-cadence-loss";
      }
    }
    return "long-gap-with-raf-cadence-loss";
  }
  if (row.activeDataTransitionCountAfter > 0 || row.activeDataTransitionCountBefore > 0) {
    return "long-gap-with-active-data-transitions";
  }
  if (row.cameraPositionStepDistance > 300000) return "long-gap-camera-step";
  return "long-gap-unclassified";
}

function longActiveTraceGapDiagnostics(manifest) {
  const rows = [];
  for (const trace of traceRows(manifest)) {
    const activeSamples = trace.samples.filter(
      (sample) => sample.runStatus === "active" || sample.isTransitioning === true,
    );
    for (let index = 1; index < activeSamples.length; index += 1) {
      const before = activeSamples[index - 1];
      const after = activeSamples[index];
      const gapMs =
        typeof after.dtMs === "number" && Number.isFinite(after.dtMs)
          ? after.dtMs
          : Math.max(0, (after.elapsedMs ?? 0) - (before.elapsedMs ?? 0));
      if (gapMs <= MAX_ACTIVE_TRACE_GAP_MS) continue;

      const beforePosition = cameraPoint(before, "cameraPosition");
      const afterPosition = cameraPoint(after, "cameraPosition");
      const beforeTarget = cameraPoint(before, "cameraTarget");
      const afterTarget = cameraPoint(after, "cameraTarget");
      const sceneBefore = before.sceneDebug ?? {};
      const sceneAfter = after.sceneDebug ?? {};
      const frameAfter = sceneAfter.frameUpdate ?? {};
      const tickAfter = sceneAfter.layerTweenTick ?? {};
      const sceneSectionApplyAfter = tickAfter.sceneSectionApply ?? {};
      const mtCutIsoUpdateAfter =
        sceneSectionApplyAfter.mtCutIsoUpdate ?? {};
      const mtCutIsoOverlayAfter =
        mtCutIsoUpdateAfter.overlayDebug ?? {};
      const mtCutIsoLineAfter =
        mtCutIsoOverlayAfter.lineGeometryDebug ?? {};
      const mtCutIsoLineAccountedMs =
        (mtCutIsoLineAfter.setupMs ?? 0) +
        (mtCutIsoLineAfter.contourPassMs ?? 0) +
        (mtCutIsoLineAfter.triangleScanMs ?? 0) +
        (mtCutIsoLineAfter.triangleIntersectionMs ?? 0) +
        (mtCutIsoLineAfter.segmentRecordMs ?? 0) +
        (mtCutIsoLineAfter.segmentStitchMs ?? 0) +
        (mtCutIsoLineAfter.polylineSimplifyMs ?? 0) +
        (mtCutIsoLineAfter.ribbonExtrudeMs ?? 0) +
        (mtCutIsoLineAfter.geometryCreateMs ?? 0);
      const renderLoopAfter = sceneAfter.renderLoop ?? {};
      const timerBefore = before.timerDebug ?? {};
      const timerAfter = after.timerDebug ?? {};
      const timerIntervalMsAfter =
        typeof timerAfter.intervalMs === "number" &&
        Number.isFinite(timerAfter.intervalMs) &&
        timerAfter.intervalMs > 0
          ? timerAfter.intervalMs
          : 0;
      const timerTickIndexBefore =
        typeof timerBefore.tickIndex === "number" &&
        Number.isFinite(timerBefore.tickIndex)
          ? timerBefore.tickIndex
          : 0;
      const timerTickIndexAfter =
        typeof timerAfter.tickIndex === "number" &&
        Number.isFinite(timerAfter.tickIndex)
          ? timerAfter.tickIndex
          : 0;
      const longTaskAfter = after.longTaskDebug ?? {};
      const animationFrameAfter = after.animationFrameDebug ?? {};
      const animationFrameTopScript = topAnimationFrameScript(
        animationFrameAfter.scriptsSinceLastSample,
      );
      const renderLoopTopTicker = topRenderLoopTicker(
        renderLoopAfter.tickerDurations,
      );
      const controllerAfter = after.controllerDebug ?? {};
      const controllerTickAfter = controllerAfter.transitionTick ?? {};
      const row = {
        caseId: trace.caseId,
        caseName: trace.caseName,
        sourcePageId:
          after.runSourcePageId ??
          after.sceneSourcePageId ??
          trace.sourcePageId,
        targetPageId:
          after.runTargetPageId ??
          after.sceneTargetPageId ??
          trace.targetPageId,
        traceJson: trace.traceJson,
        fromElapsedMs: rounded(before.elapsedMs ?? 0),
        toElapsedMs: rounded(after.elapsedMs ?? 0),
        gapMs: rounded(gapMs),
        progressDelta: rounded(
          numericDelta(after.transitionProgress, before.transitionProgress),
          3,
        ),
        rawProgressDelta: rounded(
          numericDelta(after.runRawProgress, before.runRawProgress),
          3,
        ),
        easedProgressDelta: rounded(
          numericDelta(after.runEasedProgress, before.runEasedProgress),
          3,
        ),
        cameraPositionStepDistance:
          beforePosition && afterPosition
            ? rounded(distance3(beforePosition, afterPosition))
            : 0,
        cameraTargetStepDistance:
          beforeTarget && afterTarget
            ? rounded(distance3(beforeTarget, afterTarget))
            : 0,
        cameraDistanceToTargetAfter: rounded(
          after.cameraTransition?.positionDistanceToTarget ?? 0,
        ),
        cameraPathDistance: rounded(after.cameraTransition?.pathDistance ?? 0),
        activeDataTransitionCountBefore:
          sceneBefore.activeDataTransitionCount ?? 0,
        activeDataTransitionCountAfter:
          sceneAfter.activeDataTransitionCount ?? 0,
        layerTweenCountAfter: sceneAfter.layerTweenCount ?? 0,
        scalarTweenCountAfter: sceneAfter.scalarTweenCount ?? 0,
        snapshotCountAfter: sceneAfter.snapshotCount ?? 0,
        workingAreaFocusTweenActiveAfter:
          sceneAfter.workingAreaFocusTweenActive === true,
        sceneSectionStyleTweenActiveAfter:
          sceneAfter.sceneSectionStyleTweenActive === true,
        sceneSectionHelperSnapshotActiveAfter:
          sceneAfter.sceneSectionHelperTransitionSnapshotActive === true,
        sceneSectionHelperOpacityBefore:
          sceneBefore.sceneSectionHelperTransitionOpacity ?? null,
        sceneSectionHelperOpacityAfter:
          sceneAfter.sceneSectionHelperTransitionOpacity ?? null,
        frameTotalMsAfter: rounded(frameAfter.totalMs ?? 0, 3),
        frameLayerTweensMsAfter: rounded(frameAfter.layerTweensMs ?? 0, 3),
        frameSectionIsoThresholdOcclusionMsAfter: rounded(
          frameAfter.sectionIsoThresholdOcclusionMs ?? 0,
          3,
        ),
        frameSceneOverlayTickMsAfter: rounded(
          frameAfter.sceneOverlayTickMs ?? 0,
          3,
        ),
        tickTotalMsAfter: rounded(tickAfter.totalMs ?? 0, 3),
        tickSceneSectionMsAfter: rounded(tickAfter.sceneSectionMs ?? 0, 3),
        tickSceneSectionBoundsMsAfter: rounded(
          sceneSectionApplyAfter.boundsMs ?? 0,
          3,
        ),
        tickSceneSectionFrameResolveMsAfter: rounded(
          sceneSectionApplyAfter.frameResolveMs ?? 0,
          3,
        ),
        tickSceneSectionMaterialApplyMsAfter: rounded(
          sceneSectionApplyAfter.materialApplyMs ?? 0,
          3,
        ),
        tickSceneSectionHelperRebuildMsAfter: rounded(
          sceneSectionApplyAfter.helperRebuildMs ?? 0,
          3,
        ),
        tickSceneSectionHelperOpacityMsAfter: rounded(
          sceneSectionApplyAfter.helperOpacityMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMsAfter: rounded(
          sceneSectionApplyAfter.mtCutIsoMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoPolicyAfter:
          mtCutIsoUpdateAfter.policy ?? null,
        tickSceneSectionMtCutIsoClearMsAfter: rounded(
          mtCutIsoUpdateAfter.clearMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoSetupMsAfter: rounded(
          mtCutIsoUpdateAfter.setupMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildMsAfter: rounded(
          mtCutIsoUpdateAfter.meshBuildMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildSetupMsAfter: rounded(
          mtCutIsoUpdateAfter.meshBuildSetupMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildFrameRangeMsAfter: rounded(
          mtCutIsoUpdateAfter.meshBuildFrameRangeMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildBufferAllocMsAfter: rounded(
          mtCutIsoUpdateAfter.meshBuildBufferAllocMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildGridSampleMsAfter: rounded(
          mtCutIsoUpdateAfter.meshBuildGridSampleMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildIndexMsAfter: rounded(
          mtCutIsoUpdateAfter.meshBuildIndexMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildGeometryMsAfter: rounded(
          mtCutIsoUpdateAfter.meshBuildGeometryMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildMaterialMsAfter: rounded(
          mtCutIsoUpdateAfter.meshBuildMaterialMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildMeshObjectMsAfter: rounded(
          mtCutIsoUpdateAfter.meshBuildMeshObjectMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoMeshBuildVerticesAfter:
          mtCutIsoUpdateAfter.meshBuildVertexCount ?? 0,
        tickSceneSectionMtCutIsoMeshBuildIndicesAfter:
          mtCutIsoUpdateAfter.meshBuildIndexCount ?? 0,
        tickSceneSectionMtCutIsoOverlayUpdateMsAfter: rounded(
          mtCutIsoUpdateAfter.overlayUpdateMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoOverlayTotalMsAfter: rounded(
          mtCutIsoOverlayAfter.totalMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoOverlayDisposeMsAfter: rounded(
          mtCutIsoOverlayAfter.disposeMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoOverlayRootCreateMsAfter: rounded(
          mtCutIsoOverlayAfter.rootCreateMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoOverlayBandMeshMsAfter: rounded(
          mtCutIsoOverlayAfter.bandMeshMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoOverlayLineGeometryMsAfter: rounded(
          mtCutIsoOverlayAfter.lineGeometryMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineTotalMsAfter: rounded(
          mtCutIsoLineAfter.totalMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineSetupMsAfter: rounded(
          mtCutIsoLineAfter.setupMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineTimingModeAfter:
          mtCutIsoLineAfter.timingMode ?? null,
        tickSceneSectionMtCutIsoLineContourPassMsAfter: rounded(
          mtCutIsoLineAfter.contourPassMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineTriangleScanMsAfter: rounded(
          mtCutIsoLineAfter.triangleScanMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineIntersectionMsAfter: rounded(
          mtCutIsoLineAfter.triangleIntersectionMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineStitchMsAfter: rounded(
          mtCutIsoLineAfter.segmentStitchMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineStitchNodeBuildMsAfter: rounded(
          mtCutIsoLineAfter.stitchNodeBuildMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineStitchTraversalMsAfter: rounded(
          mtCutIsoLineAfter.stitchTraversalMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineStitchPointAssemblyMsAfter: rounded(
          mtCutIsoLineAfter.stitchPointAssemblyMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineStitchLengthFilterMsAfter: rounded(
          mtCutIsoLineAfter.stitchLengthFilterMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineStitchNormalMsAfter: rounded(
          mtCutIsoLineAfter.stitchNormalMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineSegmentRecordMsAfter: rounded(
          mtCutIsoLineAfter.segmentRecordMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineSimplifyMsAfter: rounded(
          mtCutIsoLineAfter.polylineSimplifyMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineRibbonMsAfter: rounded(
          mtCutIsoLineAfter.ribbonExtrudeMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineGeometryCreateMsAfter: rounded(
          mtCutIsoLineAfter.geometryCreateMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoLineOtherMsAfter: rounded(
          Math.max(0, (mtCutIsoLineAfter.totalMs ?? 0) - mtCutIsoLineAccountedMs),
          3,
        ),
        tickSceneSectionMtCutIsoLineTrianglesAfter:
          mtCutIsoLineAfter.triangleCount ?? 0,
        tickSceneSectionMtCutIsoLineMaskedTrianglesAfter:
          mtCutIsoLineAfter.maskedTriangleCount ?? 0,
        tickSceneSectionMtCutIsoLineInvalidTrianglesAfter:
          mtCutIsoLineAfter.invalidTriangleCount ?? 0,
        tickSceneSectionMtCutIsoLineDegenerateTrianglesAfter:
          mtCutIsoLineAfter.degenerateTriangleCount ?? 0,
        tickSceneSectionMtCutIsoLineLevelCandidatesAfter:
          mtCutIsoLineAfter.levelCandidateCount ?? 0,
        tickSceneSectionMtCutIsoLineIntersectionAttemptsAfter:
          mtCutIsoLineAfter.intersectionAttemptCount ?? 0,
        tickSceneSectionMtCutIsoOverlayLineMaterialMsAfter: rounded(
          mtCutIsoOverlayAfter.lineMaterialMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoOverlayAttachMsAfter: rounded(
          mtCutIsoOverlayAfter.attachMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoOverlayBandMeshesAfter:
          mtCutIsoOverlayAfter.bandMeshCount ?? 0,
        tickSceneSectionMtCutIsoOverlayLineMeshesAfter:
          mtCutIsoOverlayAfter.lineMeshCount ?? 0,
        tickSceneSectionMtCutIsoOverlayLineSourceSegmentsAfter:
          mtCutIsoOverlayAfter.lineSourceSegmentCount ?? 0,
        tickSceneSectionMtCutIsoOverlayLineTinySegmentsAfter:
          mtCutIsoOverlayAfter.lineTinySegmentCount ?? 0,
        tickSceneSectionMtCutIsoOverlayLinePolylinesAfter:
          mtCutIsoOverlayAfter.linePolylineCount ?? 0,
        tickSceneSectionMtCutIsoOverlayLineSimplifiedPointsAfter:
          mtCutIsoOverlayAfter.lineSimplifiedPointCount ?? 0,
        tickSceneSectionMtCutIsoOverlayLineRibbonSegmentsAfter:
          mtCutIsoOverlayAfter.lineRibbonSegmentCount ?? 0,
        tickSceneSectionMtCutIsoOverlayLineSnapToleranceMAfter: rounded(
          mtCutIsoOverlayAfter.lineSnapToleranceM ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoOverlaySkippedAfter:
          mtCutIsoOverlayAfter.skippedReason ?? null,
        tickSceneSectionMtCutIsoAttachMsAfter: rounded(
          mtCutIsoUpdateAfter.attachMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoDisposeMsAfter: rounded(
          mtCutIsoUpdateAfter.disposeMs ?? 0,
          3,
        ),
        tickSceneSectionMtCutIsoPlanesAfter:
          mtCutIsoUpdateAfter.planesCount ?? 0,
        tickSceneSectionMtCutIsoSelectedPlanesAfter:
          mtCutIsoUpdateAfter.selectedPlaneCount ?? 0,
        tickSceneSectionMtCutIsoCutsBuiltAfter:
          mtCutIsoUpdateAfter.cutsBuiltCount ?? 0,
        tickSceneSectionMtCutIsoOverlayRootsAfter:
          mtCutIsoUpdateAfter.overlayRootCount ?? 0,
        tickSceneSectionMtCutIsoGridSizeAfter:
          mtCutIsoUpdateAfter.gridSize ?? null,
        tickSceneSectionMtCutIsoSkippedReasonAfter:
          mtCutIsoUpdateAfter.skippedReason ?? null,
        tickSceneSectionSeismicCutIsoMsAfter: rounded(
          sceneSectionApplyAfter.seismicCutIsoMs ?? 0,
          3,
        ),
        tickSceneSectionTraversedObjectCountAfter:
          sceneSectionApplyAfter.traversedObjectCount ?? 0,
        tickSceneSectionMaterialApplyCountAfter:
          sceneSectionApplyAfter.materialApplyCount ?? 0,
        tickSceneSectionHelperObjectCountAfter:
          sceneSectionApplyAfter.helperObjectCount ?? 0,
        tickLayerMsAfter: rounded(tickAfter.layerMs ?? 0, 3),
        tickSnapshotMsAfter: rounded(tickAfter.snapshotMs ?? 0, 3),
        tickHelperSnapshotMsAfter: rounded(
          tickAfter.helperSnapshotMs ?? 0,
          3,
        ),
        tickEnvelopeMsAfter: rounded(tickAfter.envelopeMs ?? 0, 3),
        renderLoopFrameIndexAfter: renderLoopAfter.frameIndex ?? 0,
        renderLoopRafDeltaMsAfter: rounded(renderLoopAfter.rafDeltaMs ?? 0, 3),
        renderLoopWallDeltaMsAfter: rounded(
          renderLoopAfter.wallDeltaMs ?? 0,
          3,
        ),
        renderLoopIdleGapMsAfter: rounded(renderLoopAfter.idleGapMs ?? 0, 3),
        renderLoopTotalMsAfter: rounded(renderLoopAfter.totalMs ?? 0, 3),
        renderLoopTickersMsAfter: rounded(renderLoopAfter.tickersMs ?? 0, 3),
        renderLoopControlsUpdateMsAfter: rounded(
          renderLoopAfter.controlsUpdateMs ?? 0,
          3,
        ),
        renderLoopManagerFrameUpdateMsAfter: rounded(
          renderLoopAfter.managerFrameUpdateMs ?? 0,
          3,
        ),
        renderLoopRenderMsAfter: rounded(renderLoopAfter.renderMs ?? 0, 3),
        renderLoopTickerCountAfter: renderLoopAfter.tickerCount ?? 0,
        renderLoopTopTickerNameAfter: renderLoopTopTicker.name ?? null,
        renderLoopTopTickerMsAfter: rounded(
          renderLoopTopTicker.durationMs ?? 0,
          3,
        ),
        controllerTraceSampleMsAfter: rounded(
          controllerAfter.traceSampleMs ?? 0,
          3,
        ),
        controllerTickTotalMsAfter: rounded(
          controllerTickAfter.totalMs ?? 0,
          3,
        ),
        controllerTickTweenerMsAfter: rounded(
          controllerTickAfter.tweenerMs ?? 0,
          3,
        ),
        controllerTickPageTransitionProgressMsAfter: rounded(
          controllerTickAfter.pageTransitionProgressMs ?? 0,
          3,
        ),
        controllerTickTransitionDynamicCameraMsAfter: rounded(
          controllerTickAfter.transitionDynamicCameraMs ?? 0,
          3,
        ),
        controllerTickDynamicCameraMsAfter: rounded(
          controllerTickAfter.dynamicCameraMs ?? 0,
          3,
        ),
        controllerTickLockedCameraFocusMsAfter: rounded(
          controllerTickAfter.lockedCameraFocusMs ?? 0,
          3,
        ),
        controllerTickSmoothnessSampleMsAfter: rounded(
          controllerTickAfter.smoothnessSampleMs ?? 0,
          3,
        ),
        controllerTickProgressStateUpdatedAfter:
          controllerTickAfter.progressStateUpdated === true,
        timerIntervalMsAfter: rounded(timerIntervalMsAfter, 3),
        timerTickIndexBefore,
        timerTickIndexAfter,
        timerTicksDuringGap: Math.max(
          0,
          timerTickIndexAfter - timerTickIndexBefore,
        ),
        timerExpectedTicksDuringGap:
          timerIntervalMsAfter > 0 ? rounded(gapMs / timerIntervalMsAfter, 3) : 0,
        timerDeltaMsAfter: rounded(timerAfter.deltaMs ?? 0, 3),
        timerMaxDeltaMsAfter: rounded(timerAfter.maxDeltaMs ?? 0, 3),
        timerAgeMsAfter: rounded(timerAfter.ageMs ?? 0, 3),
        timerTicksSinceLastSampleAfter: Math.max(
          0,
          timerAfter.ticksSinceLastSample ?? 0,
        ),
        longTaskSupportedAfter: longTaskAfter.supported === true,
        longTaskTotalCountAfter: Math.max(0, longTaskAfter.totalCount ?? 0),
        longTaskTotalDurationMsAfter: rounded(
          longTaskAfter.totalDurationMs ?? 0,
          3,
        ),
        longTaskMaxDurationMsAfter: rounded(longTaskAfter.maxDurationMs ?? 0, 3),
        longTaskLastStartMsAfter: rounded(longTaskAfter.lastStartMs ?? 0, 3),
        longTaskLastDurationMsAfter: rounded(
          longTaskAfter.lastDurationMs ?? 0,
          3,
        ),
        longTaskAgeMsAfter: rounded(longTaskAfter.ageMs ?? 0, 3),
        longTaskCountSinceLastSampleAfter: Math.max(
          0,
          longTaskAfter.countSinceLastSample ?? 0,
        ),
        longTaskDurationSinceLastSampleMsAfter: rounded(
          longTaskAfter.durationSinceLastSampleMs ?? 0,
          3,
        ),
        longTaskMaxDurationSinceLastSampleMsAfter: rounded(
          longTaskAfter.maxDurationSinceLastSampleMs ?? 0,
          3,
        ),
        animationFrameSupportedAfter: animationFrameAfter.supported === true,
        animationFrameTotalCountAfter: Math.max(
          0,
          animationFrameAfter.totalCount ?? 0,
        ),
        animationFrameTotalDurationMsAfter: rounded(
          animationFrameAfter.totalDurationMs ?? 0,
          3,
        ),
        animationFrameMaxDurationMsAfter: rounded(
          animationFrameAfter.maxDurationMs ?? 0,
          3,
        ),
        animationFrameTotalBlockingDurationMsAfter: rounded(
          animationFrameAfter.totalBlockingDurationMs ?? 0,
          3,
        ),
        animationFrameMaxBlockingDurationMsAfter: rounded(
          animationFrameAfter.maxBlockingDurationMs ?? 0,
          3,
        ),
        animationFrameCountSinceLastSampleAfter: Math.max(
          0,
          animationFrameAfter.countSinceLastSample ?? 0,
        ),
        animationFrameDurationSinceLastSampleMsAfter: rounded(
          animationFrameAfter.durationSinceLastSampleMs ?? 0,
          3,
        ),
        animationFrameBlockingDurationSinceLastSampleMsAfter: rounded(
          animationFrameAfter.blockingDurationSinceLastSampleMs ?? 0,
          3,
        ),
        animationFrameMaxBlockingDurationSinceLastSampleMsAfter: rounded(
          animationFrameAfter.maxBlockingDurationSinceLastSampleMs ?? 0,
          3,
        ),
        animationFrameTopScriptSourceAfter: compactSourceUrl(
          animationFrameTopScript.sourceUrl,
        ),
        animationFrameTopScriptFunctionAfter:
          animationFrameTopScript.functionName ?? null,
        animationFrameTopScriptInvokerAfter:
          animationFrameTopScript.invoker ?? null,
        animationFrameTopScriptInvokerTypeAfter:
          animationFrameTopScript.invokerType ?? null,
        animationFrameTopScriptWindowAttributionAfter:
          animationFrameTopScript.windowAttribution ?? null,
        animationFrameTopScriptDurationMsAfter: rounded(
          animationFrameTopScript.durationMs ?? 0,
          3,
        ),
        animationFrameTopScriptExecutionStartMsAfter: rounded(
          animationFrameTopScript.executionStartMs ?? 0,
          3,
        ),
        animationFrameTopScriptForcedStyleAndLayoutMsAfter: rounded(
          animationFrameTopScript.forcedStyleAndLayoutDurationMs ?? 0,
          3,
        ),
        animationFrameTopScriptPauseMsAfter: rounded(
          animationFrameTopScript.pauseDurationMs ?? 0,
          3,
        ),
        tickLayerTweenIds: Array.isArray(tickAfter.layerTweenIds)
          ? tickAfter.layerTweenIds.slice(0, 8)
          : [],
        tickScalarTweenIds: Array.isArray(tickAfter.scalarTweenIds)
          ? tickAfter.scalarTweenIds.slice(0, 8)
          : [],
        tickSnapshotIds: Array.isArray(tickAfter.snapshotIds)
          ? tickAfter.snapshotIds.slice(0, 8)
          : [],
        lateReapplyDelta: Math.max(
          0,
          (sceneAfter.lateReapplyTotalCount ?? 0) -
            (sceneBefore.lateReapplyTotalCount ?? 0),
        ),
        lateReapplyDuringTransitionDelta: Math.max(
          0,
          (sceneAfter.lateReapplyDuringTransitionCount ?? 0) -
            (sceneBefore.lateReapplyDuringTransitionCount ?? 0),
        ),
        latestLateReapplyAction: sceneAfter.latestLateReapplyAction ?? null,
        latestLateReapplyReason: sceneAfter.latestLateReapplyReason ?? null,
        productFamilyCountDelta: familyCountsDelta(
          sceneAfter.productFamilyCounts,
          sceneBefore.productFamilyCounts,
        ),
        visualPolicy: "classify-root-clock-before-visual-fix",
        risk: "high",
      };
      row.animationFrameWorkSourceAfter = animationFrameWorkSource(row);
      row.classification = gapClassification(row);
      row.classificationReason =
        "A transition-active app-side sample gap exceeded the smoothness threshold; inspect associated camera movement, data tween counts, and late reapply deltas before changing visual policy.";
      rows.push(row);
    }
  }
  return rows.sort((a, b) => b.gapMs - a.gapMs);
}

function lateReapplyRows(manifest) {
  const rows = [];
  const seenEvents = new Set();
  for (const row of artifactRows(manifest)) {
    const lateReapply = row.summary.lateReapply ?? {};
    const events = (lateReapply.events ?? []).filter(
      (event) => event?.duringTransition === true,
    );
    for (const event of events) {
      const key = [
        event.sequence ?? "unknown-sequence",
        event.action ?? "unknown-action",
        event.transitionSourcePageId ?? "unknown-source",
        event.transitionTargetPageId ?? "unknown-target",
      ].join("|");
      if (seenEvents.has(key)) continue;
      seenEvents.add(key);
      rows.push({
        caseId: row.caseId,
        caseName: row.caseName,
        step: row.step,
        totalCount: lateReapply.totalCount ?? 0,
        duringTransitionCount: 1,
        events: [event],
      });
    }
    if (events.length === 0 && (lateReapply.duringTransitionCount ?? 0) > 0) {
      rows.push({
        caseId: row.caseId,
        caseName: row.caseName,
        step: row.step,
        totalCount: lateReapply.totalCount ?? 0,
        duringTransitionCount: lateReapply.duringTransitionCount ?? 0,
        events: [],
      });
    }
  }
  return rows;
}

function analyzeManifest(manifest, options = {}) {
  const opacityJumpThreshold =
    options.opacityJumpThreshold ?? DEFAULT_OPACITY_JUMP_THRESHOLD;
  const products = productRows(manifest);
  const stateSourceOnly = products.filter(
    (product) => product.policy === "state-source-only",
  );
  const loadedAtStartFalse = products
    .filter((product) => product.loadedAtStart === false)
    .map(classifyLoadedAtStartFalse);
  const unloadedDormantHelperState = loadedAtStartFalse.filter(
    (product) => product.classification === "debug-only-unloaded-helper-state",
  );
  const unloadedUnresolvedState = loadedAtStartFalse.filter(
    (product) => product.classification === "unresolved-unloaded-transition-risk",
  );
  const opacityJumps = products
    .filter((product) => {
      if (product.sourceVisible !== true && product.targetVisible !== true) {
        return false;
      }
      const sourceOpacity = opacityValue(product.sourceOpacity);
      const targetOpacity = opacityValue(product.targetOpacity);
      return Math.abs(targetOpacity - sourceOpacity) >= opacityJumpThreshold;
    })
    .map(classifyOpacityJump);
  const opacityJumpCovered = opacityJumps.filter((product) =>
    product.classification?.startsWith("policy-covered-"),
  );
  const opacityJumpUnresolved = opacityJumps.filter((product) =>
    product.classification?.startsWith("unresolved-"),
  );
  const policyMismatches = products.filter(isPolicyMismatch);
  const hiddenProductState = stateSourceOnly
    .filter((product) =>
      /seismic|mt-isosurfaces|threshold|iso/i.test(
        `${product.family ?? ""} ${product.layerId ?? ""}`,
      ),
    )
    .map(classifyHiddenProductState);
  const hiddenDormantState = hiddenProductState.filter(
    (product) =>
      product.classification === "intentional-dormant-authored-state",
  );
  const hiddenUnresolvedState = hiddenProductState.filter(
    (product) => product.classification === "unresolved-hidden-transition-risk",
  );
  const sectionIsoEntries = products.filter(
    (product) => product.family === "section-iso-overlays",
  );
  const sectionIsoRenderOpacityMismatch =
    sectionIsoRenderOpacityRisks(products);
  const sceneSectionGroundTraceHandoffsRows =
    sceneSectionGroundTraceHandoffs(products);
  const sceneSectionGroundTraceRisk =
    sceneSectionGroundTraceHandoffsRows.filter(
      (row) => row.classification === "scene-section-ground-trace-disable-risk",
    );
  const sceneSectionGroundTraceCovered =
    sceneSectionGroundTraceHandoffsRows.filter(
      (row) =>
        row.classification === "scene-section-ground-trace-snapshot-covered",
    );
  const cameraPathRisk = cameraPathRisks(manifest);
  const smoothnessTraceQualityRisk = smoothnessTraceQualityRisks(manifest);
  const longActiveTraceGaps = longActiveTraceGapDiagnostics(manifest);
  const adjacentTransitionCoverageGaps = adjacentCoverageGaps(manifest);
  const captureFailures = matrixCaptureFailures(manifest);
  const interruptionDivergences = sourceTargetDivergences(manifest);
  const lateReapply = lateReapplyRows(manifest);
  const unexpectedConsole = (manifest.consoleMessages ?? []).filter(
    (message) => !isReadPixelsWarning(message),
  );
  const expectedReadPixelsWarnings = (manifest.consoleMessages ?? []).filter(
    isReadPixelsWarning,
  );

  return {
    outputRoot: manifest.outputRoot ?? null,
    generatedAt: manifest.generatedAt ?? null,
    traceStatus: manifest.traceStatus ?? "unknown",
    caseCount: manifest.cases?.length ?? 0,
    productFamilies: familyCount(products),
    counts: {
      productEntries: products.length,
      traceReplayDisabled: manifest.traceStatus === "disabled" ? 1 : 0,
      stateSourceOnly: stateSourceOnly.length,
      loadedAtStartFalse: loadedAtStartFalse.length,
      unloadedDormantHelperState: unloadedDormantHelperState.length,
      unloadedUnresolvedState: unloadedUnresolvedState.length,
      opacityJumps: opacityJumps.length,
      opacityJumpCovered: opacityJumpCovered.length,
      opacityJumpUnresolved: opacityJumpUnresolved.length,
      policyMismatches: policyMismatches.length,
      hiddenProductState: hiddenProductState.length,
      hiddenDormantState: hiddenDormantState.length,
      hiddenUnresolvedState: hiddenUnresolvedState.length,
      sectionIsoEntries: sectionIsoEntries.length,
      sectionIsoRenderOpacityMismatch: sectionIsoRenderOpacityMismatch.length,
      sceneSectionGroundTraceRisk: sceneSectionGroundTraceRisk.length,
      sceneSectionGroundTraceCovered: sceneSectionGroundTraceCovered.length,
      cameraPathRisk: cameraPathRisk.length,
      smoothnessTraceQualityRisk: smoothnessTraceQualityRisk.length,
      longActiveTraceGaps: longActiveTraceGaps.length,
      adjacentTransitionCoverageGaps: adjacentTransitionCoverageGaps.length,
      matrixCaptureFailures: captureFailures.length,
      interruptionDivergences: interruptionDivergences.length,
      lateReapplyDuringTransition: lateReapply.reduce(
        (total, row) => total + row.duringTransitionCount,
        0,
      ),
      unexpectedConsole: unexpectedConsole.length,
      expectedReadPixelsWarnings: expectedReadPixelsWarnings.length,
    },
    console: {
      unexpected: unexpectedConsole,
      expectedReadPixelsWarnings,
    },
    stateSourceOnly: summarizeRows(stateSourceOnly),
    loadedAtStartFalse: summarizeRows(loadedAtStartFalse),
    opacityJumps: summarizeRows(opacityJumps),
    policyMismatches: summarizeRows(policyMismatches),
    hiddenProductState: summarizeRows(hiddenProductState),
    sectionIsoEntries: summarizeRows(sectionIsoEntries),
    sectionIsoRenderOpacityMismatch: summarizeRows(
      sectionIsoRenderOpacityMismatch,
    ),
    sceneSectionGroundTraceRisk: summarizeRows(sceneSectionGroundTraceRisk),
    sceneSectionGroundTraceCovered: summarizeRows(sceneSectionGroundTraceCovered),
    cameraPathRisk: cameraPathRisk.slice(0, MAX_DETAIL_ROWS),
    smoothnessTraceQualityRisk: smoothnessTraceQualityRisk.slice(
      0,
      MAX_DETAIL_ROWS,
    ),
    longActiveTraceGaps: longActiveTraceGaps.slice(0, MAX_DETAIL_ROWS),
    adjacentTransitionCoverageGaps: adjacentTransitionCoverageGaps.slice(
      0,
      MAX_DETAIL_ROWS,
    ),
    matrixCaptureFailures: captureFailures.slice(0, MAX_DETAIL_ROWS),
    interruptionDivergences: interruptionDivergences.slice(0, MAX_DETAIL_ROWS),
    lateReapply: lateReapply.slice(0, MAX_DETAIL_ROWS),
    recommendations: recommendationsFor({
      unexpectedConsole,
      interruptionDivergences,
      loadedAtStartFalse,
      unloadedDormantHelperState,
      unloadedUnresolvedState,
      stateSourceOnly,
      opacityJumps,
      opacityJumpCovered,
      opacityJumpUnresolved,
      policyMismatches,
      hiddenProductState,
      hiddenDormantState,
      hiddenUnresolvedState,
      sectionIsoEntries,
      sectionIsoRenderOpacityMismatch,
      sceneSectionGroundTraceRisk,
      sceneSectionGroundTraceCovered,
      cameraPathRisk,
      smoothnessTraceQualityRisk,
      longActiveTraceGaps,
      adjacentTransitionCoverageGaps,
      matrixCaptureFailures: captureFailures,
      lateReapply,
      traceStatus: manifest.traceStatus ?? "unknown",
    }),
  };
}

function recommendationsFor(input) {
  const recommendations = [];
  if (input.matrixCaptureFailures.length > 0) {
    recommendations.push(
      "Treat matrix capture failures as blocking audit evidence; classify whether each failure is a bad throwaway page fixture or a base transition settle/recovery rule bug before visual smoothing.",
    );
  }
  if (input.traceStatus === "disabled") {
    recommendations.push(
      "Trace replay is disabled for this matrix; use it for policy/source-target classification only, not camera or smoothness timing conclusions.",
    );
  }
  if (input.unexpectedConsole.length > 0) {
    recommendations.push(
      "Stop visual changes until unexpected matrix console errors are resolved.",
    );
  }
  if (input.interruptionDivergences.length > 0) {
    recommendations.push(
      "Stop and repair run/scene source-target divergence before smoothing.",
    );
  }
  if (input.smoothnessTraceQualityRisk.length > 0) {
    recommendations.push(
      "Do not make runtime visual smoothing changes until trace/video evidence has enough active-frame density to judge smoothness.",
    );
  }
  if (input.longActiveTraceGaps.length > 0) {
    recommendations.push(
      "Inspect long active trace gaps with source/target, camera, data-tween, scene-section, and late-reapply diagnostics before changing base transition rules.",
    );
  }
  if (input.sectionIsoEntries.length > 0) {
    recommendations.push(
      "Prioritize section ISO overlays and section helper transitions before broader polish.",
    );
  }
  if (input.sectionIsoRenderOpacityMismatch.length > 0) {
    recommendations.push(
      "Split section ISO overlay opacity from scalar-volume layer opacity before runtime visual smoothing.",
    );
  }
  if (input.sceneSectionGroundTraceRisk.length > 0) {
    recommendations.push(
      "Fix scene-section helper/ground-trace disable handoffs before camera-only smoothing.",
    );
  } else if (input.sceneSectionGroundTraceCovered.length > 0) {
    recommendations.push(
      "Scene-section helper/ground-trace disable handoffs are snapshot-covered; preserve this policy while reducing continuous scene-section plane cost.",
    );
  }
  if (input.cameraPathRisk.length > 0) {
    recommendations.push(
      "Review large camera-path transitions separately; consider authoring, adaptive duration, or path-aware camera handoff after visual-layer snaps are isolated.",
    );
  }
  if (input.adjacentTransitionCoverageGaps.length > 0) {
    recommendations.push(
      "Add targeted matrix cases for high-risk adjacent page transitions before assuming transition coverage is complete.",
    );
  }
  if (input.loadedAtStartFalse.length > 0 && input.lateReapply.length === 0) {
    recommendations.push(
      "Add transition-aware late-load reapply for authored product layers that are not loaded at run start.",
    );
  } else if (input.loadedAtStartFalse.length > 0) {
    recommendations.push(
      "Late-load reapply is covered by the matrix probe; inspect remaining loadedAtStart=false entries for family-specific visual policy.",
    );
  }
  if (input.unloadedUnresolvedState.length > 0) {
    recommendations.push(
      "Resolve unresolved loadedAtStart=false product state before visual smoothing.",
    );
  } else if (input.unloadedDormantHelperState.length > 0) {
    recommendations.push(
      "Unloaded scene-section helper state is classified as debug-only; preserve hidden helper state unless it becomes visible.",
    );
  }
  if (input.hiddenUnresolvedState.length > 0) {
    recommendations.push(
      "Resolve unresolved hidden seismic/MT authored state before changing visible handoff behavior.",
    );
  } else if (input.hiddenDormantState.length > 0) {
    recommendations.push(
      "Hidden seismic/MT authored state is classified as dormant; preserve it without visual interpolation until it becomes visible.",
    );
  }
  if (input.opacityJumpUnresolved.length > 0) {
    recommendations.push(
      "Resolve visible opacity-jump policy coverage before changing visual smoothing behavior.",
    );
  } else if (input.opacityJumps.length > 0) {
    recommendations.push(
      "Visible opacity jumps are policy-classified; review screenshots/video before changing covered runtime behavior.",
    );
  }
  if (input.policyMismatches.length > 0) {
    recommendations.push(
      "Resolve policy/transitionKind mismatches in debug before treating the registry as a repair contract.",
    );
  }
  if (input.lateReapply.length > 0) {
    recommendations.push(
      "Inspect late reapply rows before changing heavy product transitions.",
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "No blocking divergence found; proceed to the first scoped visual smoothing fix.",
    );
  }
  return recommendations;
}

function countDelta(current, previous) {
  if (!previous) return null;
  const delta = {};
  for (const [key, value] of Object.entries(current.counts)) {
    delta[key] = value - (previous.counts[key] ?? 0);
  }
  return delta;
}

function formatLayerRow(row) {
  const delta =
    typeof row.sourceOpacity === "number" && typeof row.targetOpacity === "number"
      ? `, opacity ${row.sourceOpacity} -> ${row.targetOpacity}`
      : "";
  const helper =
    typeof row.snapshotGroundTraceCount === "number"
      ? `, groundTrace snapshot=${row.snapshotGroundTraceCount}, live=${row.liveGroundTraceCount ?? "n/a"}, policy=${row.groundTracePolicy ?? "none"}`
      : "";
  const classification = row.classification
    ? `, classification=${row.classification}, visualPolicy=${row.visualPolicy}${helper}`
    : "";
  return `- ${row.caseId}/${row.step}: ${row.layerId} (${row.family}, ${row.policy}, ${row.transitionKind}, ${row.stateSource}, loaded=${row.loadedAtStart}${delta}${classification})`;
}

function section(title, rows, formatter = formatLayerRow) {
  if (!rows.length) return `### ${title}\n\nNone.\n`;
  return [`### ${title}`, "", ...rows.map(formatter), ""].join("\n");
}

function formatAnalysisMarkdown(analysis, previousAnalysis = null) {
  const delta = countDelta(analysis, previousAnalysis);
  const lines = [
    "## Transition Matrix Divergence Report",
    "",
    `- Matrix: \`${analysis.outputRoot ?? "unknown"}\``,
    `- Generated: ${analysis.generatedAt ?? "unknown"}`,
    `- Trace replay: ${analysis.traceStatus ?? "unknown"}`,
    `- Cases: ${analysis.caseCount}`,
    previousAnalysis
      ? `- Compared against: \`${previousAnalysis.outputRoot ?? "unknown"}\``
      : "- Compared against: no previous matrix manifest available on disk",
    "- Fixture boundary: source/target page ids and case positions are evidence only; remediation must target global transition families.",
    "",
    "### Counts",
    "",
    "| Metric | Count | Delta |",
    "| --- | ---: | ---: |",
  ];
  for (const [key, value] of Object.entries(analysis.counts)) {
    lines.push(
      `| ${key} | ${value} | ${delta ? delta[key] : "n/a"} |`,
    );
  }
  lines.push(
    "",
    "### Recommendations",
    "",
    ...analysis.recommendations.map((item) => `- ${item}`),
    "",
  );
  lines.push(section("State-Source-Only Product Entries", analysis.stateSourceOnly));
  lines.push(section("Loaded-At-Start False Entries", analysis.loadedAtStartFalse));
  lines.push(section("Visible Opacity Jumps", analysis.opacityJumps));
  lines.push(section("Policy / Transition Kind Mismatches", analysis.policyMismatches));
  lines.push(section("Hidden Seismic / MT Product State", analysis.hiddenProductState));
  lines.push(section("Section ISO Entries", analysis.sectionIsoEntries));
  lines.push(
    section(
      "Section ISO Render-Opacity Mismatch Risks",
      analysis.sectionIsoRenderOpacityMismatch,
    ),
  );
  lines.push(
    section(
      "Scene-Section Ground-Trace Handoff Risks",
      analysis.sceneSectionGroundTraceRisk,
    ),
  );
  lines.push(
    section(
      "Scene-Section Ground-Trace Covered Handoffs",
      analysis.sceneSectionGroundTraceCovered,
    ),
  );
  lines.push(
    section(
      "Camera Path Risks",
      analysis.cameraPathRisk,
      (row) =>
        `- ${row.caseId}: ${row.sourcePageId} -> ${row.targetPageId} (${row.classification}, ${row.visualPolicy}, samples=${row.sampleCount}, positionDistance=${row.positionDistance}, targetDistance=${row.targetDistance}, maxFramePositionDistance=${row.maxFramePositionDistance} over ${row.maxFrameElapsedMs}ms, trace=${row.traceJson ?? "inline"})`,
    ),
  );
  lines.push(
    section(
      "Smoothness Trace Quality Risks",
      analysis.smoothnessTraceQualityRisk,
      (row) =>
        `- ${row.caseId}: ${row.sourcePageId} -> ${row.targetPageId} (${row.classification}, ${row.visualPolicy}, activeSamples=${row.activeSampleCount}, activeSpanMs=${row.activeSpanMs}, activeSamplesPerSecond=${row.activeSamplesPerSecond}, maxActiveGapMs=${row.maxActiveGapMs}, stopped=${row.stoppedReason ?? "unknown"}, trace=${row.traceJson ?? "inline"})`,
    ),
  );
  lines.push(
    section(
      "Long Active Trace Gap Diagnostics",
      analysis.longActiveTraceGaps,
      (row) =>
        `- ${row.caseId}: ${row.sourcePageId} -> ${row.targetPageId} (${row.classification}, workSource=${row.animationFrameWorkSourceAfter}, gapMs=${row.gapMs}, progressDelta=${row.progressDelta}, cameraStep=${row.cameraPositionStepDistance}, cameraTargetStep=${row.cameraTargetStepDistance}, activeData=${row.activeDataTransitionCountBefore}->${row.activeDataTransitionCountAfter}, tweens layer/scalar/snapshot=${row.layerTweenCountAfter}/${row.scalarTweenCountAfter}/${row.snapshotCountAfter}, workingArea=${row.workingAreaFocusTweenActiveAfter}, sceneSectionTween=${row.sceneSectionStyleTweenActiveAfter}, helperSnapshot=${row.sceneSectionHelperSnapshotActiveAfter}, helperOpacity=${row.sceneSectionHelperOpacityBefore ?? "n/a"}->${row.sceneSectionHelperOpacityAfter ?? "n/a"}, frameMs=${row.frameTotalMsAfter}, frameLayerTweensMs=${row.frameLayerTweensMsAfter}, frameSectionIsoMs=${row.frameSectionIsoThresholdOcclusionMsAfter}, tickMs=${row.tickTotalMsAfter}, tickSceneSectionMs=${row.tickSceneSectionMsAfter}, tickSceneSectionBoundsMs=${row.tickSceneSectionBoundsMsAfter}, tickSceneSectionFrameResolveMs=${row.tickSceneSectionFrameResolveMsAfter}, tickSceneSectionMaterialApplyMs=${row.tickSceneSectionMaterialApplyMsAfter}, tickSceneSectionHelperRebuildMs=${row.tickSceneSectionHelperRebuildMsAfter}, tickSceneSectionHelperOpacityMs=${row.tickSceneSectionHelperOpacityMsAfter}, tickSceneSectionMtCutIsoMs=${row.tickSceneSectionMtCutIsoMsAfter}, tickSceneSectionMtCutIsoPolicy=${row.tickSceneSectionMtCutIsoPolicyAfter ?? "none"}, tickSceneSectionMtCutIsoClearMs=${row.tickSceneSectionMtCutIsoClearMsAfter}, tickSceneSectionMtCutIsoSetupMs=${row.tickSceneSectionMtCutIsoSetupMsAfter}, tickSceneSectionMtCutIsoMeshBuildMs=${row.tickSceneSectionMtCutIsoMeshBuildMsAfter}, tickSceneSectionMtCutIsoOverlayUpdateMs=${row.tickSceneSectionMtCutIsoOverlayUpdateMsAfter}, tickSceneSectionMtCutIsoOverlayBandMeshMs=${row.tickSceneSectionMtCutIsoOverlayBandMeshMsAfter}, tickSceneSectionMtCutIsoOverlayLineGeometryMs=${row.tickSceneSectionMtCutIsoOverlayLineGeometryMsAfter}, tickSceneSectionMtCutIsoLineTimingMode=${row.tickSceneSectionMtCutIsoLineTimingModeAfter ?? "none"}, tickSceneSectionMtCutIsoLineContourPassMs=${row.tickSceneSectionMtCutIsoLineContourPassMsAfter}, tickSceneSectionMtCutIsoLineTriangleScanMs=${row.tickSceneSectionMtCutIsoLineTriangleScanMsAfter}, tickSceneSectionMtCutIsoLineIntersectionMs=${row.tickSceneSectionMtCutIsoLineIntersectionMsAfter}, tickSceneSectionMtCutIsoLineSegmentRecordMs=${row.tickSceneSectionMtCutIsoLineSegmentRecordMsAfter}, tickSceneSectionMtCutIsoLineStitchMs=${row.tickSceneSectionMtCutIsoLineStitchMsAfter}, tickSceneSectionMtCutIsoLineStitchNodeBuildMs=${row.tickSceneSectionMtCutIsoLineStitchNodeBuildMsAfter}, tickSceneSectionMtCutIsoLineStitchTraversalMs=${row.tickSceneSectionMtCutIsoLineStitchTraversalMsAfter}, tickSceneSectionMtCutIsoLineStitchPointAssemblyMs=${row.tickSceneSectionMtCutIsoLineStitchPointAssemblyMsAfter}, tickSceneSectionMtCutIsoLineStitchLengthFilterMs=${row.tickSceneSectionMtCutIsoLineStitchLengthFilterMsAfter}, tickSceneSectionMtCutIsoLineStitchNormalMs=${row.tickSceneSectionMtCutIsoLineStitchNormalMsAfter}, tickSceneSectionMtCutIsoLineSimplifyMs=${row.tickSceneSectionMtCutIsoLineSimplifyMsAfter}, tickSceneSectionMtCutIsoLineRibbonMs=${row.tickSceneSectionMtCutIsoLineRibbonMsAfter}, tickSceneSectionMtCutIsoLineGeometryCreateMs=${row.tickSceneSectionMtCutIsoLineGeometryCreateMsAfter}, tickSceneSectionMtCutIsoLineOtherMs=${row.tickSceneSectionMtCutIsoLineOtherMsAfter}, tickSceneSectionMtCutIsoLineTriangles=${row.tickSceneSectionMtCutIsoLineTrianglesAfter}, tickSceneSectionMtCutIsoLineMaskedTriangles=${row.tickSceneSectionMtCutIsoLineMaskedTrianglesAfter}, tickSceneSectionMtCutIsoLineInvalidTriangles=${row.tickSceneSectionMtCutIsoLineInvalidTrianglesAfter}, tickSceneSectionMtCutIsoLineDegenerateTriangles=${row.tickSceneSectionMtCutIsoLineDegenerateTrianglesAfter}, tickSceneSectionMtCutIsoLineLevelCandidates=${row.tickSceneSectionMtCutIsoLineLevelCandidatesAfter}, tickSceneSectionMtCutIsoLineIntersectionAttempts=${row.tickSceneSectionMtCutIsoLineIntersectionAttemptsAfter}, tickSceneSectionMtCutIsoOverlayLineMaterialMs=${row.tickSceneSectionMtCutIsoOverlayLineMaterialMsAfter}, tickSceneSectionMtCutIsoOverlayAttachMs=${row.tickSceneSectionMtCutIsoOverlayAttachMsAfter}, tickSceneSectionMtCutIsoOverlayDisposeMs=${row.tickSceneSectionMtCutIsoOverlayDisposeMsAfter}, tickSceneSectionMtCutIsoOverlayMeshes=${row.tickSceneSectionMtCutIsoOverlayBandMeshesAfter}/${row.tickSceneSectionMtCutIsoOverlayLineMeshesAfter}, tickSceneSectionMtCutIsoOverlaySegments=${row.tickSceneSectionMtCutIsoOverlayLineSourceSegmentsAfter}, tickSceneSectionMtCutIsoOverlayTinySegments=${row.tickSceneSectionMtCutIsoOverlayLineTinySegmentsAfter}, tickSceneSectionMtCutIsoOverlayPolylines=${row.tickSceneSectionMtCutIsoOverlayLinePolylinesAfter}, tickSceneSectionMtCutIsoOverlaySimplifiedPoints=${row.tickSceneSectionMtCutIsoOverlayLineSimplifiedPointsAfter}, tickSceneSectionMtCutIsoOverlayRibbonSegments=${row.tickSceneSectionMtCutIsoOverlayLineRibbonSegmentsAfter}, tickSceneSectionMtCutIsoOverlaySnapToleranceM=${row.tickSceneSectionMtCutIsoOverlayLineSnapToleranceMAfter}, tickSceneSectionMtCutIsoOverlaySkipped=${row.tickSceneSectionMtCutIsoOverlaySkippedAfter ?? "none"}, tickSceneSectionMtCutIsoAttachMs=${row.tickSceneSectionMtCutIsoAttachMsAfter}, tickSceneSectionMtCutIsoDisposeMs=${row.tickSceneSectionMtCutIsoDisposeMsAfter}, tickSceneSectionMtCutIsoPlanes=${row.tickSceneSectionMtCutIsoSelectedPlanesAfter}/${row.tickSceneSectionMtCutIsoPlanesAfter}, tickSceneSectionMtCutIsoCuts=${row.tickSceneSectionMtCutIsoCutsBuiltAfter}, tickSceneSectionMtCutIsoRoots=${row.tickSceneSectionMtCutIsoOverlayRootsAfter}, tickSceneSectionMtCutIsoGrid=${row.tickSceneSectionMtCutIsoGridSizeAfter ?? "n/a"}, tickSceneSectionMtCutIsoSkipped=${row.tickSceneSectionMtCutIsoSkippedReasonAfter ?? "none"}, tickSceneSectionSeismicCutIsoMs=${row.tickSceneSectionSeismicCutIsoMsAfter}, tickSceneSectionObjects=${row.tickSceneSectionTraversedObjectCountAfter}, tickSceneSectionMaterials=${row.tickSceneSectionMaterialApplyCountAfter}, tickSceneSectionHelpers=${row.tickSceneSectionHelperObjectCountAfter}, tickLayerMs=${row.tickLayerMsAfter}, tickSnapshotMs=${row.tickSnapshotMsAfter}, tickHelperSnapshotMs=${row.tickHelperSnapshotMsAfter}, tickEnvelopeMs=${row.tickEnvelopeMsAfter}, renderLoopFrame=${row.renderLoopFrameIndexAfter}, renderLoopRafDeltaMs=${row.renderLoopRafDeltaMsAfter}, renderLoopWallDeltaMs=${row.renderLoopWallDeltaMsAfter}, renderLoopIdleGapMs=${row.renderLoopIdleGapMsAfter}, renderLoopMs=${row.renderLoopTotalMsAfter}, renderLoopTickersMs=${row.renderLoopTickersMsAfter}, renderLoopTopTicker=${row.renderLoopTopTickerNameAfter ?? "none"}, renderLoopTopTickerMs=${row.renderLoopTopTickerMsAfter}, renderLoopManagerMs=${row.renderLoopManagerFrameUpdateMsAfter}, renderLoopRenderMs=${row.renderLoopRenderMsAfter}, renderLoopTickerCount=${row.renderLoopTickerCountAfter}, controllerTraceSampleMs=${row.controllerTraceSampleMsAfter}, controllerTickMs=${row.controllerTickTotalMsAfter}, controllerProgressMs=${row.controllerTickPageTransitionProgressMsAfter}, controllerDynamicCameraMs=${row.controllerTickDynamicCameraMsAfter}, controllerTransitionDynamicCameraMs=${row.controllerTickTransitionDynamicCameraMsAfter}, controllerSmoothnessSampleMs=${row.controllerTickSmoothnessSampleMsAfter}, controllerProgressStateUpdated=${row.controllerTickProgressStateUpdatedAfter}, timerIntervalMs=${row.timerIntervalMsAfter}, timerTicks=${row.timerTicksDuringGap}/${row.timerExpectedTicksDuringGap}, timerDeltaMs=${row.timerDeltaMsAfter}, timerMaxDeltaMs=${row.timerMaxDeltaMsAfter}, timerAgeMs=${row.timerAgeMsAfter}, longTaskSupported=${row.longTaskSupportedAfter}, longTaskCount=${row.longTaskCountSinceLastSampleAfter}, longTaskDurationMs=${row.longTaskDurationSinceLastSampleMsAfter}, longTaskMaxMs=${row.longTaskMaxDurationSinceLastSampleMsAfter}, animationFrameSupported=${row.animationFrameSupportedAfter}, animationFrameCount=${row.animationFrameCountSinceLastSampleAfter}, animationFrameDurationMs=${row.animationFrameDurationSinceLastSampleMsAfter}, animationFrameBlockingMs=${row.animationFrameBlockingDurationSinceLastSampleMsAfter}, animationFrameMaxBlockingMs=${row.animationFrameMaxBlockingDurationSinceLastSampleMsAfter}, animationFrameTopScript=${row.animationFrameTopScriptSourceAfter ?? "none"}, animationFrameTopInvoker=${row.animationFrameTopScriptInvokerAfter ?? "none"}, animationFrameTopFunction=${row.animationFrameTopScriptFunctionAfter ?? "none"}, animationFrameTopDurationMs=${row.animationFrameTopScriptDurationMsAfter}, tickLayerIds=${row.tickLayerTweenIds?.join(",") || "none"}, tickSnapshotIds=${row.tickSnapshotIds?.join(",") || "none"}, lateReapplyDelta=${row.lateReapplyDelta}, latestLateReapply=${row.latestLateReapplyAction ?? "none"}, trace=${row.traceJson ?? "inline"})`,
    ),
  );
  lines.push(
    section(
      "MT Cut Mesh Build Diagnostics",
      analysis.longActiveTraceGaps.filter(
        (row) => (row.tickSceneSectionMtCutIsoMeshBuildMsAfter ?? 0) > 0,
      ),
      (row) =>
        `- ${row.caseId}: ${row.sourcePageId} -> ${row.targetPageId} (meshBuildMs=${row.tickSceneSectionMtCutIsoMeshBuildMsAfter}, setupMs=${row.tickSceneSectionMtCutIsoMeshBuildSetupMsAfter}, frameRangeMs=${row.tickSceneSectionMtCutIsoMeshBuildFrameRangeMsAfter}, bufferAllocMs=${row.tickSceneSectionMtCutIsoMeshBuildBufferAllocMsAfter}, gridSampleMs=${row.tickSceneSectionMtCutIsoMeshBuildGridSampleMsAfter}, indexMs=${row.tickSceneSectionMtCutIsoMeshBuildIndexMsAfter}, geometryMs=${row.tickSceneSectionMtCutIsoMeshBuildGeometryMsAfter}, materialMs=${row.tickSceneSectionMtCutIsoMeshBuildMaterialMsAfter}, meshObjectMs=${row.tickSceneSectionMtCutIsoMeshBuildMeshObjectMsAfter}, vertices=${row.tickSceneSectionMtCutIsoMeshBuildVerticesAfter}, indices=${row.tickSceneSectionMtCutIsoMeshBuildIndicesAfter}, mtCutIsoMs=${row.tickSceneSectionMtCutIsoMsAfter}, trace=${row.traceJson ?? "inline"})`,
    ),
  );
  lines.push(
    section(
      "Adjacent Transition Coverage Gaps",
      analysis.adjacentTransitionCoverageGaps,
      (row) =>
        `- ${row.fromIndex + 1} -> ${row.toIndex + 1}: ${row.sourcePageId} -> ${row.targetPageId} (${row.classification}, ${row.visualPolicy})`,
    ),
  );
  lines.push(
    section(
      "Matrix Capture / Trace Failures",
      analysis.matrixCaptureFailures,
      (row) =>
        `- ${row.caseId}: ${row.sourcePageId} -> ${row.targetPageId} (${row.failureKind}, phase=${row.matrixPhase ?? "unknown"}, observed=${row.observedCurrentPageId ?? "unknown"} -> ${row.observedTargetPageId ?? "unknown"}, message=${row.message ?? "unknown"}${row.screenshot ? `, screenshot=${row.screenshot}` : ""})`,
    ),
  );
  lines.push(
    section(
      "Run / Scene Source-Target Divergences",
      analysis.interruptionDivergences,
      (row) =>
        `- ${row.caseId}/${row.step}: run ${row.runSourcePageId} -> ${row.runTargetPageId}; scene ${row.sceneSourcePageId} -> ${row.sceneTargetPageId}; reason=${row.runReason}`,
    ),
  );
  lines.push(
    section(
      "Late Reapply During Transition",
      analysis.lateReapply,
      (row) =>
        `- ${row.caseId}/${row.step}: during=${row.duringTransitionCount}, total=${row.totalCount}${
          row.events.length
            ? `, events=${row.events
                .map((event) => {
                  const progress =
                    typeof event.transitionProgress === "number"
                      ? `@${event.transitionProgress.toFixed(3)}`
                      : "";
                  return `${event.action ?? "unknown"}${progress}`;
                })
                .join(", ")}`
            : ""
        }`,
    ),
  );
  if (analysis.console.unexpected.length) {
    lines.push("### Unexpected Console Messages", "");
    for (const message of analysis.console.unexpected.slice(0, MAX_DETAIL_ROWS)) {
      lines.push(`- ${message.type}: ${message.text}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

function parseArgs(argv) {
  const options = {
    resultsDir: DEFAULT_RESULTS_DIR,
    manifestPath: null,
    previousPath: null,
    write: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") {
      options.manifestPath = argv[++index] ?? null;
    } else if (arg === "--previous") {
      options.previousPath = argv[++index] ?? null;
    } else if (arg === "--results-dir") {
      options.resultsDir = argv[++index] ?? DEFAULT_RESULTS_DIR;
    } else if (arg === "--write") {
      options.write = true;
    }
  }
  return options;
}

function matrixManifestPaths(resultsDir) {
  if (!existsSync(resultsDir)) return [];
  return readdirSync(resultsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith("transition-matrix-debug-"))
    .sort()
    .map((name) => path.join(resultsDir, name, "manifest.json"))
    .filter((manifestPath) => existsSync(manifestPath));
}

function readManifest(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const manifests = matrixManifestPaths(options.resultsDir);
  const manifestPath = options.manifestPath ?? manifests.at(-1);
  const previousPath =
    options.previousPath ??
    (manifestPath && manifests.length >= 2
      ? manifests.filter((item) => item !== manifestPath).at(-1)
      : null);
  if (!manifestPath) {
    throw new Error(`No transition matrix manifest found in ${options.resultsDir}`);
  }
  const manifest = readManifest(manifestPath);
  const previousManifest =
    previousPath && existsSync(previousPath) ? readManifest(previousPath) : null;
  const analysis = analyzeManifest(manifest);
  const previousAnalysis = previousManifest
    ? analyzeManifest(previousManifest)
    : null;
  const markdown = formatAnalysisMarkdown(analysis, previousAnalysis);
  console.log(markdown);
  if (options.write) {
    const outDir = path.dirname(manifestPath);
    await writeFile(
      path.join(outDir, "transition-analysis.json"),
      `${JSON.stringify({ analysis, previousAnalysis }, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      path.join(outDir, "transition-analysis.md"),
      markdown,
      "utf8",
    );
  }
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFile) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { analyzeManifest, formatAnalysisMarkdown };

