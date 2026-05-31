import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.GEOSEE_BASE_URL ?? "http://127.0.0.1:5173";
const PROJECT_PATH = "/?project=utah-forge";
const VIEWPORT = { width: 1280, height: 900 };
const TRACE_MAX_DURATION_MS = Number.parseInt(
  process.env.TRANSITION_TRACE_MAX_MS ?? "4500",
  10,
);
const TRACE_SAMPLE_INTERVAL_MS = Number.parseInt(
  process.env.TRANSITION_TRACE_SAMPLE_MS ?? "100",
  10,
);
const OUTPUT_ROOT =
  process.env.TRANSITION_MATRIX_OUT ??
  path.join(
    "test-results",
    `transition-matrix-debug-${new Date().toISOString().replace(/[:.]/g, "-")}`,
  );
const PROJECT_MANIFEST = JSON.parse(
  readFileSync(path.join("projects", "utah-forge", "project.json"), "utf8"),
);
const PAGE_IDS = PROJECT_MANIFEST.pageOrder ?? [];

const ADJACENT_SURFACE_NOTES = new Map([
  [
    0,
    "full-density point cloud, MT volume, threshold surfaces, seismic context, dynamic camera",
  ],
  [
    7,
    "scalar volume to 2D resistivity slices, scalar legend, transparency, page overlay",
  ],
  [
    8,
    "slice-to-section transition, section/crop/window translation risk, ISO line/band state",
  ],
  [
    9,
    "section panels to MT isosurfaces, opacity handoff, legend/source mismatch risk",
  ],
  [
    24,
    "reported camera stall/jump, scene-section ground trace snap, MT section ISO overlay opacity snap",
  ],
]);

const ALL_ADJACENT_MATRIX = PAGE_IDS.slice(0, -1).map((sourcePageId, index) => {
  const targetPageId = PAGE_IDS[index + 1];
  return {
    id: `A${String(index + 1).padStart(2, "0")}`,
    name: `adjacent-${sourcePageId}-to-${targetPageId}`,
    fromIndex: index,
    toIndex: index + 1,
    caseGroup: "all-adjacent",
    generated: true,
    probeLateReapply: index === 0,
    surfaces:
      ADJACENT_SURFACE_NOTES.get(index) ??
      "generated all-adjacent page transition coverage: camera, data layers, overlays, legends, labels, assays, scene sections, ISO overlays",
  };
});

const SUPPLEMENTAL_MATRIX = [
  {
    id: "S01",
    name: "section-frame-overlay-pages-non-adjacent",
    fromIndex: 22,
    toIndex: 24,
    caseGroup: "supplemental-stress",
    surfaces:
      "section-frame overlay pages, duplicate/unresolved pages, overlay source/target behavior",
  },
];

const TRANSITION_MATRIX = [...ALL_ADJACENT_MATRIX, ...SUPPLEMENTAL_MATRIX];

const INTERRUPTION_CASE = {
  id: "06",
  name: "rapid-interruption-mt-volume-low-high",
  fromIndex: 0,
  firstTargetIndex: 1,
  finalTargetIndex: 2,
  caseGroup: "interruption",
  surfaces:
    "rapid interruption, promoted source page risk, skipped old camera completion cleanup",
};

function artifactPath(...parts) {
  return path.join(OUTPUT_ROOT, ...parts);
}

function url(pathname = PROJECT_PATH) {
  return new URL(pathname, BASE_URL).toString();
}

function sanitize(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-|-$/g, "");
}

async function jsonFile(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function pageState(page) {
  return page.evaluate(() => {
    const controller = window.__pageController;
    return controller?.getState?.() ?? null;
  });
}

async function pageIds(page) {
  return page.evaluate(() => {
    const controller = window.__pageController;
    const state = controller?.getState?.();
    return {
      currentPageId: state?.currentPageId ?? null,
      targetPageId: state?.targetPageId ?? null,
    };
  });
}

async function captureStep(page, caseDir, stepName, metadata) {
  const state = await pageState(page);
  const screenshotPath = path.join(caseDir, `${stepName}.png`);
  const statePath = path.join(caseDir, `${stepName}.json`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await jsonFile(statePath, {
    ...metadata,
    capturedAt: new Date().toISOString(),
    state,
  });
  return {
    step: stepName,
    screenshot: path.relative(OUTPUT_ROOT, screenshotPath).replaceAll("\\", "/"),
    stateJson: path.relative(OUTPUT_ROOT, statePath).replaceAll("\\", "/"),
    stateSummary: summarizeState(state),
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function transitionTraceSample(page, elapsedMs) {
  return page.evaluate((elapsed) => {
    const clamp01 = (value) => Math.max(0, Math.min(1, value));
    const rounded = (value, decimals = 3) =>
      typeof value === "number" && Number.isFinite(value)
        ? Number(value.toFixed(decimals))
        : null;
    const vector = (value) =>
      value
        ? {
            x: rounded(value.x),
            y: rounded(value.y),
            z: rounded(value.z),
          }
        : null;
    const materialOpacity = (material) => {
      const shaderOpacity = material?.uniforms?.uOpacity?.value;
      if (typeof shaderOpacity === "number" && Number.isFinite(shaderOpacity)) {
        return shaderOpacity;
      }
      return typeof material?.opacity === "number" &&
        Number.isFinite(material.opacity)
        ? material.opacity
        : null;
    };
    const treeOpacity = (root, fallback) => {
      if (!root?.visible) return 0;
      let opacity = null;
      root.traverse?.((object) => {
        if (!object.visible) return;
        const material = object.material;
        if (!material) return;
        const materials = Array.isArray(material) ? material : [material];
        for (const item of materials) {
          const next = materialOpacity(item);
          if (next === null) continue;
          opacity = Math.max(opacity ?? 0, next);
        }
      });
      return clamp01(opacity ?? fallback ?? 0);
    };
    const layerOpacity = (manager, product) => {
      const layerId = product?.layerId;
      if (!layerId) {
        return { currentOpacity: null, snapshotOpacity: null };
      }
      const fallback =
        product.targetVisible === true
          ? (typeof product.targetOpacity === "number" ? product.targetOpacity : 1)
          : 0;
      const group = manager?.layers?.get?.(layerId);
      const groupOpacity = group ? treeOpacity(group, fallback) : fallback;
      const snapshot = manager?.layerTransitionSnapshots?.get?.(layerId);
      const snapshotOpacity = snapshot?.group
        ? treeOpacity(snapshot.group, snapshot.from ?? 0)
        : 0;
      return {
        currentOpacity: rounded(Math.max(groupOpacity, snapshotOpacity)),
        snapshotOpacity: rounded(snapshotOpacity),
      };
    };
    const summarizeProductPolicy = (product) => ({
      layerId: product?.layerId ?? null,
      family: product?.family ?? null,
      policy: product?.policy ?? null,
      transitionKind: product?.transitionKind ?? null,
      stateSource: product?.stateSource ?? null,
      loadedAtStart: product?.loadedAtStart ?? null,
      sourceVisible: product?.sourceVisible ?? null,
      targetVisible: product?.targetVisible ?? null,
      sourceOpacity: rounded(product?.sourceOpacity ?? null),
      targetOpacity: rounded(product?.targetOpacity ?? null),
    });
    const summarizeWatchedProduct = (product) => ({
      ...summarizeProductPolicy(product),
    });
    const shouldWatchProduct = (product) =>
      Boolean(product?.layerId) &&
      (product.sourceVisible === true ||
        product.targetVisible === true ||
        product.policy !== "preserve" ||
        product.family === "scene-section-helpers" ||
        product.family === "scalar-volume" ||
        product.family === "seismic-volume" ||
        product.family === "mt-isosurfaces");
    const summarizeConsumerDebug = (run) => {
      const debug = run?.consumerDebug ?? {};
      return {
        presenterOverlay: debug.presenterOverlay
          ? {
              policy: debug.presenterOverlay.policy ?? null,
              active: debug.presenterOverlay.active ?? null,
              sourcePageId: debug.presenterOverlay.sourcePageId ?? null,
              targetPageId: debug.presenterOverlay.targetPageId ?? null,
            }
          : null,
        sceneOverlays: debug.sceneOverlays
          ? {
              policy: debug.sceneOverlays.policy ?? null,
              activeTweenCount: debug.sceneOverlays.activeTweenCount ?? null,
              lastPhase: debug.sceneOverlays.lastPhase ?? null,
              lastPageId: debug.sceneOverlays.lastPageId ?? null,
            }
          : null,
        labels: debug.labels
          ? {
              policy: debug.labels.policy ?? null,
              activePageId: debug.labels.activePageId ?? null,
            }
          : null,
        assays: debug.assays
          ? {
              policy: debug.assays.policy ?? null,
              activePageId: debug.assays.activePageId ?? null,
            }
          : null,
        legends: debug.legends
          ? {
              stackPolicy: debug.legends.stackPolicy ?? null,
              sourcePageId: debug.legends.sourcePageId ?? null,
              targetPageId: debug.legends.targetPageId ?? null,
            }
          : null,
      };
    };

    const controller = window.__pageController;
    const scene = window.__scene;
    const state = controller?.getState?.();
    const run = state?.transitionRun ?? state?.lastTransitionRun ?? null;
    const activeRun = state?.transitionRun ?? null;
    const products = run?.sceneTransition?.productFamilies ?? [];
    const productFamilies = products.map((product) =>
      summarizeProductPolicy(product),
    );
    const watchedProducts = products.filter(shouldWatchProduct);
    const active =
      activeRun?.status === "active" || state?.isTransitioning === true;
    const settled = state?.isTransitioning === false && activeRun === null;

    return {
      active,
      settled,
      productFamilies,
      sample: {
        elapsedMs: rounded(elapsed, 2),
        currentPageId: state?.currentPageId ?? null,
        targetPageId: state?.targetPageId ?? null,
        transitionProgress: rounded(state?.transitionProgress ?? null),
        isTransitioning: state?.isTransitioning ?? null,
        runId: run?.runId ?? null,
        runStatus: run?.status ?? null,
        runSourcePageId: run?.sourcePageId ?? null,
        runTargetPageId: run?.targetPageId ?? null,
        runRawProgress: rounded(run?.rawProgress ?? null),
        runEasedProgress: rounded(run?.easedProgress ?? null),
        sceneSourcePageId: run?.sceneTransition?.sourcePageId ?? null,
        sceneTargetPageId: run?.sceneTransition?.targetPageId ?? null,
        cameraPosition: vector(scene?.camera?.position),
        cameraTarget: vector(scene?.controls?.target),
        consumerDebug: summarizeConsumerDebug(run),
        watchedLayers: watchedProducts.map((product) =>
          summarizeWatchedProduct(product),
        ),
      },
    };
  }, elapsedMs);
}

function startTransitionTrace(page, metadata) {
  const startedAtMs = Date.now();
  const trace = {
    metadata,
    startedAt: new Date(startedAtMs).toISOString(),
    maxDurationMs: TRACE_MAX_DURATION_MS,
    sampleIntervalMs: TRACE_SAMPLE_INTERVAL_MS,
    sampling: "node-interval",
    productFamilies: [],
    samples: [],
    sampleErrors: [],
    seenActiveTransition: false,
    completed: false,
    stoppedReason: null,
    endedAt: null,
  };

  const done = (async () => {
    while (!trace.completed) {
      const elapsedMs = Date.now() - startedAtMs;
      try {
        const capture = await transitionTraceSample(page, elapsedMs);
        if (capture.active) {
          trace.seenActiveTransition = true;
        }
        if (
          trace.productFamilies.length === 0 &&
          capture.productFamilies.length > 0
        ) {
          trace.productFamilies = capture.productFamilies;
        }
        trace.samples.push(capture.sample);
        if (
          elapsedMs >= TRACE_MAX_DURATION_MS ||
          (trace.seenActiveTransition && capture.settled)
        ) {
          trace.completed = true;
          trace.stoppedReason =
            trace.seenActiveTransition && capture.settled
              ? "settled"
              : "max-duration";
          break;
        }
      } catch (error) {
        trace.sampleErrors.push({
          elapsedMs,
          message: error instanceof Error ? error.message : String(error),
        });
        if (trace.sampleErrors.length >= 3) {
          trace.completed = true;
          trace.stoppedReason = "sample-error";
          break;
        }
      }
      await delay(TRACE_SAMPLE_INTERVAL_MS);
    }
    trace.endedAt = new Date().toISOString();
  })();

  return {
    async finish(caseDir) {
      await done;
      const tracePath = path.join(caseDir, "trace.json");
      await jsonFile(tracePath, trace);
      return path.relative(OUTPUT_ROOT, tracePath).replaceAll("\\", "/");
    },
  };
}

async function captureTransitionTraceReplay(
  page,
  caseDir,
  metadata,
  triggerTransition,
  targetIndex,
) {
  const startResult = await page.evaluate(
    ({ traceMetadata, maxDurationMs, sampleIntervalMs }) => {
      const controller = window.__pageController;
      const startSmoothnessTrace = controller?.startSmoothnessTrace;
      if (typeof startSmoothnessTrace !== "function") {
        return {
          ok: false,
          reason: "window.__pageController.startSmoothnessTrace missing",
        };
      }
      const trace = startSmoothnessTrace(
        {
          ...traceMetadata,
          replay: true,
          replayPurpose:
            "Dense smoothness sampling inside the app render tick without Playwright round trips.",
        },
        { maxDurationMs, sampleIntervalMs },
      );
      return {
        ok: true,
        traceId: trace?.traceId ?? null,
        sampling: trace?.sampling ?? null,
      };
    },
    {
      traceMetadata: metadata,
      maxDurationMs: TRACE_MAX_DURATION_MS,
      sampleIntervalMs: 0,
    },
  );
  if (!startResult.ok) {
    throw new Error(`Smoothness trace start failed: ${startResult.reason}`);
  }

  await triggerTransition();
  await waitForTransitionRun(page, targetIndex);
  await waitForSettle(page, targetIndex);

  const trace = await page.evaluate(() => {
    const controller = window.__pageController;
    return controller?.stopSmoothnessTrace?.("settled") ?? null;
  });
  if (!trace) {
    throw new Error("Smoothness trace stop failed: no trace returned");
  }
  const tracePath = path.join(caseDir, "trace.json");
  await jsonFile(tracePath, trace);
  return path.relative(OUTPUT_ROOT, tracePath).replaceAll("\\", "/");
}

function summarizeState(state) {
  const run = state?.transitionRun ?? state?.lastTransitionRun ?? null;
  return {
    currentPageId: state?.currentPageId ?? null,
    targetPageId: state?.targetPageId ?? null,
    transitionProgress: state?.transitionProgress ?? null,
    isTransitioning: state?.isTransitioning ?? null,
    runId: run?.runId ?? null,
    runMode: run?.mode ?? null,
    runStatus: run?.status ?? null,
    runSourcePageId: run?.sourcePageId ?? null,
    runTargetPageId: run?.targetPageId ?? null,
    runReason: run?.reason ?? null,
    runRawProgress: run?.rawProgress ?? null,
    runEasedProgress: run?.easedProgress ?? null,
    interruptedRunIds: run?.interruptedRunIds ?? [],
    sceneSourcePageId: run?.sceneTransition?.sourcePageId ?? null,
    sceneTargetPageId: run?.sceneTransition?.targetPageId ?? null,
    productFamilies: run?.sceneTransition?.productFamilies ?? [],
    presenterOverlay:
      run?.consumerDebug?.presenterOverlay ?? null,
    labels: run?.consumerDebug?.labels ?? null,
    assays: run?.consumerDebug?.assays ?? null,
    legends: run?.consumerDebug?.legends ?? null,
    sceneOverlays: run?.consumerDebug?.sceneOverlays
      ? {
          policy: run.consumerDebug.sceneOverlays.policy,
          fadeDurationMs: run.consumerDebug.sceneOverlays.fadeDurationMs,
          registeredHandleCount:
            run.consumerDebug.sceneOverlays.registeredHandleCount,
          activeTweenCount: run.consumerDebug.sceneOverlays.activeTweenCount,
          lastPhase: run.consumerDebug.sceneOverlays.lastPhase,
          lastPageId: run.consumerDebug.sceneOverlays.lastPageId,
        }
      : null,
    lateReapply: run?.consumerDebug?.lateReapply
      ? {
          totalCount: run.consumerDebug.lateReapply.totalCount,
          duringTransitionCount:
            run.consumerDebug.lateReapply.duringTransitionCount,
          events: (run.consumerDebug.lateReapply.events ?? []).map((event) => ({
            sequence: event.sequence ?? null,
            reason: event.reason ?? null,
            action: event.action ?? null,
            pageId: event.pageId ?? null,
            duringTransition: event.duringTransition ?? null,
            transitionSourcePageId: event.transitionSourcePageId ?? null,
            transitionTargetPageId: event.transitionTargetPageId ?? null,
            transitionReason: event.transitionReason ?? null,
            transitionProgress: event.transitionProgress ?? null,
          })),
        }
      : null,
  };
}

async function waitForApp(page) {
  await page.goto(url(), { waitUntil: "networkidle" });
  await page.locator("body").filter({ hasText: "Utah FORGE" }).waitFor({
    timeout: 90_000,
  });
  await page.locator("canvas").waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean(window.__pageController?.getState));
}

async function gotoAndSettle(page, index) {
  await page.evaluate((pageIndex) => window.__pageController?.goto?.(pageIndex), index);
  await page.waitForFunction(
    (pageIndex) => {
      const state = window.__pageController?.getState?.();
      return (
        state?.currentIndex === pageIndex &&
        state?.targetIndex === null &&
        state?.isTransitioning === false
      );
    },
    index,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(250);
}

async function waitForTransitionRun(page, targetIndex) {
  await page.waitForFunction(
    (pageIndex) => {
      const state = window.__pageController?.getState?.();
      return (
        state?.targetIndex === pageIndex &&
        state?.transitionRun?.status === "active"
      );
    },
    targetIndex,
    { timeout: 10_000 },
  );
}

async function waitForProgress(page, minProgress, targetIndex = null) {
  await page.waitForFunction(
    ({ progress, pageIndex }) => {
      const state = window.__pageController?.getState?.();
      const run = state?.transitionRun;
      const lastRun = state?.lastTransitionRun;
      const runTargetMatches =
        pageIndex === null ||
        state?.targetIndex === pageIndex ||
        run?.targetIndex === pageIndex ||
        lastRun?.targetIndex === pageIndex ||
        state?.currentIndex === pageIndex;

      if (!runTargetMatches) {
        return false;
      }

      if (
        pageIndex !== null &&
        state?.currentIndex === pageIndex &&
        state?.targetIndex === null &&
        state?.isTransitioning === false
      ) {
        return true;
      }

      const uiProgress =
        typeof state.transitionProgress === "number" ? state.transitionProgress : 0;
      const activeProgress =
        typeof run?.rawProgress === "number"
          ? run.rawProgress
          : typeof run?.easedProgress === "number"
            ? run.easedProgress
            : uiProgress;
      const completedRawProgress =
        typeof lastRun?.rawProgress === "number"
          ? lastRun.rawProgress
          : 0;
      const completedEasedProgress =
        typeof lastRun?.easedProgress === "number"
          ? lastRun.easedProgress
          : 0;

      return (
        (run?.status === "active" && activeProgress >= progress) ||
        (lastRun?.status === "completed" &&
          Math.max(uiProgress, completedRawProgress, completedEasedProgress) >=
            progress)
      );
    },
    { progress: minProgress, pageIndex: targetIndex },
    { timeout: 15_000 },
  );
}

async function triggerLateReapplyProbe(page) {
  const probe = await page.evaluate(() => {
    const controller = window.__pageController;
    const manager = window.__scene?.manager;
    const beforeState = controller?.getState?.();
    const beforeRun = beforeState?.transitionRun ?? null;
    const beforeLateReapply = beforeRun?.consumerDebug?.lateReapply ?? null;
    const beforeDuringTransitionCount =
      beforeLateReapply?.duringTransitionCount ?? 0;
    if (
      beforeRun?.status !== "active" ||
      beforeRun?.mode !== "page" ||
      typeof manager?.reapplyCurrentPageState !== "function"
    ) {
      return {
        ok: false,
        reason: "active page transition or scene manager reapply hook missing",
        beforeRunStatus: beforeRun?.status ?? null,
        beforeRunMode: beforeRun?.mode ?? null,
      };
    }

    manager.reapplyCurrentPageState();

    const afterState = controller?.getState?.();
    const afterRun = afterState?.transitionRun ?? null;
    const afterLateReapply = afterRun?.consumerDebug?.lateReapply ?? null;
    const afterEvents = afterLateReapply?.events ?? [];
    const lastEvent = afterEvents[afterEvents.length - 1] ?? null;
    const afterDuringTransitionCount =
      afterLateReapply?.duringTransitionCount ?? 0;
    return {
      ok:
        afterRun?.status === "active" &&
        afterRun?.sourcePageId === beforeRun.sourcePageId &&
        afterRun?.targetPageId === beforeRun.targetPageId &&
        afterDuringTransitionCount > beforeDuringTransitionCount &&
        lastEvent?.action === "transition-aware-current-page-state" &&
        lastEvent?.duringTransition === true,
      beforeDuringTransitionCount,
      afterDuringTransitionCount,
      beforeRunId: beforeRun.runId ?? null,
      afterRunId: afterRun?.runId ?? null,
      sourcePageId: afterRun?.sourcePageId ?? null,
      targetPageId: afterRun?.targetPageId ?? null,
      lastEvent,
    };
  });
  if (!probe.ok) {
    throw new Error(
      `Late reapply matrix probe failed: ${JSON.stringify(probe)}`,
    );
  }
  return probe;
}

async function waitForSettle(page, index) {
  await page.waitForFunction(
    (pageIndex) => {
      const state = window.__pageController?.getState?.();
      return (
        state?.currentIndex === pageIndex &&
        state?.targetIndex === null &&
        state?.isTransitioning === false &&
        state?.lastTransitionRun?.status === "completed"
      );
    },
    index,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(250);
}

async function captureTransitionCase(page, item) {
  const caseDir = artifactPath(`${item.id}-${sanitize(item.name)}`);
  await mkdir(caseDir, { recursive: true });
  await gotoAndSettle(page, item.fromIndex);

  const sourceState = await pageState(page);
  const sourcePageId = sourceState?.currentPageId ?? null;
  const targetPageId = PAGE_IDS[item.toIndex] ?? null;

  const artifacts = [];
  artifacts.push(
    await captureStep(page, caseDir, "source", {
      caseId: item.id,
      caseName: item.name,
      surfaces: item.surfaces,
      phase: "source",
      fromIndex: item.fromIndex,
      toIndex: item.toIndex,
      sourcePageId,
      targetPageId,
    }),
  );

  await page.evaluate((index) => window.__pageController?.goto?.(index), item.toIndex);
  await waitForTransitionRun(page, item.toIndex);
  const lateReapplyProbe = item.probeLateReapply
    ? await triggerLateReapplyProbe(page)
    : null;
  await waitForProgress(page, 0.45, item.toIndex);
  artifacts.push(
    await captureStep(page, caseDir, "mid", {
      caseId: item.id,
      caseName: item.name,
      surfaces: item.surfaces,
      phase: "mid",
      fromIndex: item.fromIndex,
      toIndex: item.toIndex,
      sourcePageId,
      targetPageId,
      lateReapplyProbe,
    }),
  );

  await waitForSettle(page, item.toIndex);
  artifacts.push(
    await captureStep(page, caseDir, "end", {
      caseId: item.id,
      caseName: item.name,
      surfaces: item.surfaces,
      phase: "end",
      fromIndex: item.fromIndex,
      toIndex: item.toIndex,
      sourcePageId,
      targetPageId,
    }),
  );
  return {
    ...item,
    sourcePageId,
    targetPageId,
    artifacts,
    traceJson: null,
  };
}

async function captureInterruptionCase(page, item) {
  const caseDir = artifactPath(`${item.id}-${sanitize(item.name)}`);
  await mkdir(caseDir, { recursive: true });
  await gotoAndSettle(page, item.fromIndex);

  const sourceState = await pageState(page);
  const sourcePageId = sourceState?.currentPageId ?? null;
  const firstTargetPageId = PAGE_IDS[item.firstTargetIndex] ?? null;
  const finalTargetPageId = PAGE_IDS[item.finalTargetIndex] ?? null;

  const artifacts = [];
  artifacts.push(
    await captureStep(page, caseDir, "source", {
      caseId: item.id,
      caseName: item.name,
      surfaces: item.surfaces,
      phase: "source",
      fromIndex: item.fromIndex,
      firstTargetIndex: item.firstTargetIndex,
      finalTargetIndex: item.finalTargetIndex,
      sourcePageId,
      firstTargetPageId,
      finalTargetPageId,
    }),
  );

  await page.evaluate(
    ({ firstIndex, finalIndex }) => {
      const controller = window.__pageController;
      controller?.goto?.(firstIndex);
      controller?.goto?.(finalIndex);
    },
    {
      firstIndex: item.firstTargetIndex,
      finalIndex: item.finalTargetIndex,
    },
  );
  await waitForTransitionRun(page, item.finalTargetIndex);
  artifacts.push(
    await captureStep(page, caseDir, "interrupted-start", {
      caseId: item.id,
      caseName: item.name,
      surfaces: item.surfaces,
      phase: "interrupted-start",
      fromIndex: item.fromIndex,
      firstTargetIndex: item.firstTargetIndex,
      finalTargetIndex: item.finalTargetIndex,
      sourcePageId,
      firstTargetPageId,
      finalTargetPageId,
      note: "First and final navigation were issued in the same browser evaluation to force the interruption path before screenshot readback can settle the first run.",
    }),
  );
  await waitForProgress(page, 0.35, item.finalTargetIndex);
  artifacts.push(
    await captureStep(page, caseDir, "interrupted-mid", {
      caseId: item.id,
      caseName: item.name,
      surfaces: item.surfaces,
      phase: "interrupted-mid",
      fromIndex: item.fromIndex,
      firstTargetIndex: item.firstTargetIndex,
      finalTargetIndex: item.finalTargetIndex,
      sourcePageId,
      firstTargetPageId,
      finalTargetPageId,
    }),
  );

  await waitForSettle(page, item.finalTargetIndex);
  artifacts.push(
    await captureStep(page, caseDir, "end", {
      caseId: item.id,
      caseName: item.name,
      surfaces: item.surfaces,
      phase: "end",
      fromIndex: item.fromIndex,
      firstTargetIndex: item.firstTargetIndex,
      finalTargetIndex: item.finalTargetIndex,
      sourcePageId,
      firstTargetPageId,
      finalTargetPageId,
    }),
  );
  return {
    ...item,
    sourcePageId,
    firstTargetPageId,
    finalTargetPageId,
    artifacts,
    traceJson: null,
  };
}

async function captureTraceReplayForCase(page, item) {
  const caseDir = artifactPath(`${item.id}-${sanitize(item.name)}`);
  if (typeof item.finalTargetIndex === "number") {
    await gotoAndSettle(page, item.fromIndex);
    return captureTransitionTraceReplay(
      page,
      caseDir,
      {
        caseId: item.id,
        caseName: item.name,
        fromIndex: item.fromIndex,
        firstTargetIndex: item.firstTargetIndex,
        finalTargetIndex: item.finalTargetIndex,
        sourcePageId: item.sourcePageId,
        firstTargetPageId: item.firstTargetPageId,
        finalTargetPageId: item.finalTargetPageId,
      },
      async () => {
        await page.evaluate(
          ({ firstIndex, finalIndex }) => {
            const controller = window.__pageController;
            controller?.goto?.(firstIndex);
            controller?.goto?.(finalIndex);
          },
          {
            firstIndex: item.firstTargetIndex,
            finalIndex: item.finalTargetIndex,
          },
        );
      },
      item.finalTargetIndex,
    );
  }
  await gotoAndSettle(page, item.fromIndex);
  return captureTransitionTraceReplay(
    page,
    caseDir,
    {
      caseId: item.id,
      caseName: item.name,
      fromIndex: item.fromIndex,
      toIndex: item.toIndex,
      sourcePageId: item.sourcePageId,
      targetPageId: item.targetPageId,
    },
    async () => {
      await page.evaluate(
        (index) => window.__pageController?.goto?.(index),
        item.toIndex,
      );
    },
    item.toIndex,
  );
}

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  await mkdir(artifactPath("videos"), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: {
      dir: artifactPath("videos"),
      size: VIEWPORT,
    },
  });
  const page = await context.newPage();
  const video = page.video();
  let contextClosed = false;
  const consoleMessages = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push({
        type: message.type(),
        text: message.text(),
      });
    }
  });
  page.on("pageerror", (error) => {
    consoleMessages.push({ type: "pageerror", text: error.message });
  });

  const captured = [];
  try {
    await waitForApp(page);
    const ids = await pageIds(page);
    for (const item of TRANSITION_MATRIX) {
      captured.push(await captureTransitionCase(page, item));
    }
    captured.push(await captureInterruptionCase(page, INTERRUPTION_CASE));
    for (const item of captured) {
      item.traceJson = await captureTraceReplayForCase(page, item);
    }
    await context.close();
    contextClosed = true;
    const videoPath = video
      ? path.relative(OUTPUT_ROOT, await video.path()).replaceAll("\\", "/")
      : null;

    const manifest = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      route: PROJECT_PATH,
      viewport: VIEWPORT,
      outputRoot: OUTPUT_ROOT,
      pageIds: PAGE_IDS,
      matrixScope: {
        mode: "all-adjacent-plus-supplemental",
        pageOrderSource: "projects/utah-forge/project.json:pageOrder",
        generatedAdjacentCaseCount: ALL_ADJACENT_MATRIX.length,
        supplementalCaseCount: SUPPLEMENTAL_MATRIX.length,
        interruptionCaseCount: 1,
      },
      initialPageState: ids,
      video: videoPath,
      cases: captured,
      consoleMessages,
      notes: [
        "The first mid-transition capture triggers a transition-aware late-reapply probe; authored visual policy should remain unchanged.",
        "All adjacent pageOrder handoffs are generated from the project manifest so coverage follows page additions, removals, and renames.",
        "Supplemental cases are reserved for non-adjacent or interruption stress paths that exercise base transition rules without treating pages as durable fixtures.",
        "Each JSON artifact includes the full PageController debug state for that capture phase.",
        "Each case includes trace.json from a post-screenshot replay captured inside PageController's app tick, with transition progress, camera pose, consumer timing, and product policy rows; this avoids Playwright round trips during smoothness sampling.",
        "The manifest video field points to a WebM recording of the full matrix capture and replay pass for human smoothness review.",
        "Screenshots are headless Chromium captures and should be reviewed alongside transitionRun summaries.",
      ],
    };
    await jsonFile(artifactPath("manifest.json"), manifest);
    console.log(`Transition matrix captured: ${OUTPUT_ROOT}`);
    console.log(`Cases: ${captured.length}`);
    console.log(`Console warnings/errors recorded: ${consoleMessages.length}`);
  } finally {
    if (!contextClosed) {
      await context.close().catch(() => undefined);
    }
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
