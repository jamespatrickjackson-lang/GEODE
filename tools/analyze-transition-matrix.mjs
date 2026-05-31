import { existsSync, readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_RESULTS_DIR = "test-results";
const DEFAULT_OPACITY_JUMP_THRESHOLD = 0.25;
const MAX_DETAIL_ROWS = 24;

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
      samples: trace.samples,
    });
  }
  return rows;
}

function adjacentCoverageGaps(manifest) {
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

function sceneSectionGroundTraceRisks(products) {
  return products
    .filter(
      (product) =>
        product.family === "scene-section-helpers" &&
        product.policy === "translate-section-helpers" &&
        product.sourceVisible === true &&
        product.targetVisible === false &&
        opacityValue(product.sourceOpacity) > 0.5 &&
        opacityValue(product.targetOpacity) <= 0.001,
    )
    .map((product) => ({
      ...product,
      classification: "scene-section-ground-trace-disable-risk",
      visualPolicy: "hold-or-snapshot-ground-trace-through-helper-fade",
      risk: "high",
      classificationReason:
        "Source section helpers are visible and target helpers are disabled; async ground-trace geometry may not be represented by the fade snapshot.",
    }));
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
  const sceneSectionGroundTraceRisk = sceneSectionGroundTraceRisks(products);
  const cameraPathRisk = cameraPathRisks(manifest);
  const adjacentTransitionCoverageGaps = adjacentCoverageGaps(manifest);
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
    caseCount: manifest.cases?.length ?? 0,
    productFamilies: familyCount(products),
    counts: {
      productEntries: products.length,
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
      cameraPathRisk: cameraPathRisk.length,
      adjacentTransitionCoverageGaps: adjacentTransitionCoverageGaps.length,
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
    cameraPathRisk: cameraPathRisk.slice(0, MAX_DETAIL_ROWS),
    adjacentTransitionCoverageGaps: adjacentTransitionCoverageGaps.slice(
      0,
      MAX_DETAIL_ROWS,
    ),
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
      cameraPathRisk,
      adjacentTransitionCoverageGaps,
      lateReapply,
    }),
  };
}

function recommendationsFor(input) {
  const recommendations = [];
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
  const classification = row.classification
    ? `, classification=${row.classification}, visualPolicy=${row.visualPolicy}`
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
    `- Cases: ${analysis.caseCount}`,
    previousAnalysis
      ? `- Compared against: \`${previousAnalysis.outputRoot ?? "unknown"}\``
      : "- Compared against: no previous matrix manifest available on disk",
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
      "Camera Path Risks",
      analysis.cameraPathRisk,
      (row) =>
        `- ${row.caseId}: ${row.sourcePageId} -> ${row.targetPageId} (${row.classification}, ${row.visualPolicy}, samples=${row.sampleCount}, positionDistance=${row.positionDistance}, targetDistance=${row.targetDistance}, maxFramePositionDistance=${row.maxFramePositionDistance} over ${row.maxFrameElapsedMs}ms, trace=${row.traceJson ?? "inline"})`,
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
