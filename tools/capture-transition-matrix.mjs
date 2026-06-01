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
const RECORD_VIDEO = process.env.TRANSITION_MATRIX_VIDEO !== "0";
const ENABLE_TRACE_REPLAY = process.env.TRANSITION_MATRIX_TRACE !== "0";
const SELECTED_CASE_IDS = new Set(
  (process.env.TRANSITION_MATRIX_CASES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const DEFAULT_OUTPUT_ROOT = path.join(
  "docs",
  "dev-context",
  "artifacts",
  "transition-matrix",
  `transition-matrix-debug-${new Date().toISOString().replace(/[:.]/g, "-")}`,
);
const OUTPUT_ROOT =
  process.env.TRANSITION_MATRIX_OUT ?? DEFAULT_OUTPUT_ROOT;
const PROJECT_MANIFEST = JSON.parse(
  readFileSync(path.join("projects", "utah-forge", "project.json"), "utf8"),
);
const PAGE_IDS = PROJECT_MANIFEST.pageOrder ?? [];
const PROJECT_ENVIRONMENT = JSON.parse(
  readFileSync(path.join("projects", "utah-forge", "environment.json"), "utf8"),
);

const LAYERS = {
  mtVolume: "utah-forge-mt-resistivity-volume",
  mtBoundaries: "utah-forge-mt-resistivity-threshold-surfaces",
  mtFullDensity: "utah-forge-mt-resistivity-full-density",
  mtSlices: "utah-forge-mt-resistivity-slices",
  sceneSection: "utah-forge-scene-section-planes",
};

function readPageSpec(pageId) {
  return JSON.parse(
    readFileSync(path.join("projects", "utah-forge", "pages", `${pageId}.json`), "utf8"),
  );
}

const PAGE_SPECS = new Map(PAGE_IDS.map((pageId) => [pageId, readPageSpec(pageId)]));

function pageLayerStyle(pageId, layerId) {
  return PAGE_SPECS.get(pageId)?.layerOverrides?.[layerId] ?? {};
}

function pageLayerVisible(pageId, layerId) {
  const override = PAGE_SPECS.get(pageId)?.visibilityOverrides?.[layerId];
  if (typeof override === "boolean") return override;
  return PROJECT_ENVIRONMENT.defaultVisibleLayers?.includes(layerId) ?? false;
}

function hasAnyTrueRecordValue(record) {
  return Object.values(record ?? {}).some((value) => {
    if (typeof value === "boolean") return value;
    if (value && typeof value === "object" && "visible" in value) {
      return value.visible === true;
    }
    return false;
  });
}

function pageFeatureSummary(pageId) {
  const page = PAGE_SPECS.get(pageId) ?? {};
  const sceneStyle = pageLayerStyle(pageId, LAYERS.sceneSection);
  const mtBoundaryStyle = pageLayerStyle(pageId, LAYERS.mtBoundaries);
  const mtVolumeStyle = pageLayerStyle(pageId, LAYERS.mtVolume);
  const hasSceneSection =
    sceneStyle.sceneSectionEnabled === true ||
    sceneStyle.sceneSectionFrameEnabled === true ||
    sceneStyle.sceneSectionFrameByAxis !== undefined ||
    sceneStyle.sceneSectionPlanes !== undefined ||
    sceneStyle.sceneSectionHelperVisible !== undefined ||
    sceneStyle.sceneSectionGroundTraceVisible !== undefined ||
    sceneStyle.sceneSectionAxesVisible !== undefined;
  const hasSceneFrame =
    sceneStyle.sceneSectionFrameEnabled === true ||
    sceneStyle.sceneSectionFrameByAxis !== undefined ||
    sceneStyle.sceneSectionWindowByAxis !== undefined;
  const hasMtBoundaries =
    hasAnyTrueRecordValue(mtBoundaryStyle.mtSurfaceBoundariesById) ||
    hasAnyTrueRecordValue(mtBoundaryStyle.mtThresholdSurfaceVisibility) ||
    pageLayerVisible(pageId, LAYERS.mtBoundaries);
  const hasMtVolume =
    pageLayerVisible(pageId, LAYERS.mtVolume) ||
    mtVolumeStyle.scalarVolumeProductId !== undefined ||
    mtVolumeStyle.scalarVolumeRenderMode !== undefined;
  const hasSectionIso =
    hasSceneSection &&
    (hasMtVolume ||
      sceneStyle.sceneSectionTargetLayerIds?.includes?.(LAYERS.mtVolume) ||
      sceneStyle.sceneSectionTargetLayerIds?.includes?.(LAYERS.mtSlices));
  const hasPointCloud =
    pageLayerVisible(pageId, LAYERS.mtFullDensity) ||
    page.layerOverrides?.[LAYERS.mtFullDensity] !== undefined;
  const hasSeismic = Object.keys({
    ...(page.layerOverrides ?? {}),
    ...(page.visibilityOverrides ?? {}),
  }).some((layerId) => layerId.includes("seismic"));
  const hasOverlays =
    Array.isArray(page.overlays) ||
    page.overlayFile !== undefined ||
    page.presenterOverlay !== undefined;

  return {
    pageId,
    sceneAxis: sceneStyle.sceneSectionActiveAxis ?? null,
    sceneWindowAxis: sceneStyle.sceneSectionWindowActiveAxis ?? null,
    sceneHelperVisible: sceneStyle.sceneSectionHelperVisible ?? null,
    sceneGroundTraceVisible: sceneStyle.sceneSectionGroundTraceVisible ?? null,
    hasSceneSection,
    hasSceneFrame,
    hasMtBoundaries,
    hasMtVolume,
    hasSectionIso,
    hasPointCloud,
    hasSeismic,
    hasOverlays,
  };
}

const PAGE_FEATURES = new Map(
  PAGE_IDS.map((pageId) => [pageId, pageFeatureSummary(pageId)]),
);

function featuresFor(pageId) {
  return PAGE_FEATURES.get(pageId) ?? pageFeatureSummary(pageId);
}

function transitionFamilyFor(sourcePageId, targetPageId) {
  const source = featuresFor(sourcePageId);
  const target = featuresFor(targetPageId);
  if (source.hasSceneSection || target.hasSceneSection) {
    return source.hasSectionIso || target.hasSectionIso
      ? "scene-section-section-iso"
      : "scene-section-frame";
  }
  if (source.hasMtVolume || target.hasMtVolume) {
    return source.hasMtBoundaries || target.hasMtBoundaries
      ? "mt-volume-boundary"
      : "mt-volume";
  }
  if (source.hasMtBoundaries || target.hasMtBoundaries) return "mt-boundary";
  if (source.hasPointCloud || target.hasPointCloud) return "point-cloud";
  if (source.hasSeismic || target.hasSeismic) return "seismic-products";
  if (source.hasOverlays || target.hasOverlays) return "overlays";
  return "generic-page-state";
}

function transitionSurfaceSummary(sourcePageId, targetPageId) {
  const source = featuresFor(sourcePageId);
  const target = featuresFor(targetPageId);
  const families = [
    ["MT volume", source.hasMtVolume || target.hasMtVolume],
    ["MT boundaries", source.hasMtBoundaries || target.hasMtBoundaries],
    ["scene sections", source.hasSceneSection || target.hasSceneSection],
    ["scene-section frames", source.hasSceneFrame || target.hasSceneFrame],
    ["section ISO overlays", source.hasSectionIso || target.hasSectionIso],
    ["point clouds", source.hasPointCloud || target.hasPointCloud],
    ["seismic products", source.hasSeismic || target.hasSeismic],
    ["overlays", source.hasOverlays || target.hasOverlays],
  ]
    .filter(([, active]) => active)
    .map(([label]) => label);
  return `feature-family coverage: ${
    families.length > 0 ? families.join(", ") : "generic page state"
  }. Page ids are disposable fixture evidence; remediation must target the shared transition rule.`;
}

const ALL_ADJACENT_MATRIX = PAGE_IDS.slice(0, -1).map((sourcePageId, index) => {
  const targetPageId = PAGE_IDS[index + 1];
  const family = transitionFamilyFor(sourcePageId, targetPageId);
  return {
    id: `adjacent-${family}-${String(index + 1).padStart(2, "0")}`,
    name: `adjacent-${family}`,
    fromIndex: index,
    toIndex: index + 1,
    caseGroup: "all-adjacent",
    transitionFamily: family,
    generated: true,
    probeLateReapply: index === 0,
    surfaces: transitionSurfaceSummary(sourcePageId, targetPageId),
  };
});

function findBestPair(predicate, score) {
  const candidates = [];
  for (let fromIndex = 0; fromIndex < PAGE_IDS.length; fromIndex += 1) {
    for (let toIndex = 0; toIndex < PAGE_IDS.length; toIndex += 1) {
      if (fromIndex === toIndex || Math.abs(fromIndex - toIndex) <= 1) continue;
      const sourcePageId = PAGE_IDS[fromIndex];
      const targetPageId = PAGE_IDS[toIndex];
      const source = featuresFor(sourcePageId);
      const target = featuresFor(targetPageId);
      if (!predicate(source, target)) continue;
      candidates.push({
        fromIndex,
        toIndex,
        sourcePageId,
        targetPageId,
        score: score(source, target),
      });
    }
  }
  return candidates.sort((left, right) => right.score - left.score)[0] ?? null;
}

function selectSupplementalCases() {
  const sceneFramePair = findBestPair(
    (source, target) =>
      source.hasSceneSection &&
      target.hasSceneSection &&
      source.hasSceneFrame &&
      target.hasSceneFrame &&
      (source.sceneAxis !== target.sceneAxis ||
        source.sceneHelperVisible !== target.sceneHelperVisible ||
        source.sceneGroundTraceVisible !== target.sceneGroundTraceVisible),
    (source, target) =>
      Number(source.hasSectionIso) +
      Number(target.hasSectionIso) +
      Number(source.hasMtVolume) +
      Number(target.hasMtVolume) +
      Number(source.sceneAxis !== target.sceneAxis) +
      Number(source.sceneHelperVisible !== target.sceneHelperVisible) +
      Number(source.sceneGroundTraceVisible !== target.sceneGroundTraceVisible),
  );
  if (!sceneFramePair) return [];
  return [
    {
      id: "scene-section-frame-change",
      name: "feature-scene-section-frame-change",
      fromIndex: sceneFramePair.fromIndex,
      toIndex: sceneFramePair.toIndex,
      caseGroup: "supplemental-feature-stress",
      transitionFamily: "scene-section-frame",
      generated: true,
      surfaces: transitionSurfaceSummary(
        sceneFramePair.sourcePageId,
        sceneFramePair.targetPageId,
      ),
    },
  ];
}

const SUPPLEMENTAL_MATRIX = selectSupplementalCases();

const TRANSITION_MATRIX = [...ALL_ADJACENT_MATRIX, ...SUPPLEMENTAL_MATRIX];
const ACTIVE_TRANSITION_MATRIX =
  SELECTED_CASE_IDS.size > 0
    ? TRANSITION_MATRIX.filter(
        (item) => SELECTED_CASE_IDS.has(item.id) || SELECTED_CASE_IDS.has(item.name),
      )
    : TRANSITION_MATRIX;

function selectInterruptionCase() {
  for (let fromIndex = 0; fromIndex < PAGE_IDS.length - 2; fromIndex += 1) {
    const firstTargetIndex = fromIndex + 1;
    const finalTargetIndex = fromIndex + 2;
    const source = featuresFor(PAGE_IDS[fromIndex]);
    const first = featuresFor(PAGE_IDS[firstTargetIndex]);
    const final = featuresFor(PAGE_IDS[finalTargetIndex]);
    const exercisesMtHandoff =
      source.hasMtVolume ||
      first.hasMtVolume ||
      final.hasMtVolume ||
      source.hasMtBoundaries ||
      first.hasMtBoundaries ||
      final.hasMtBoundaries;
    if (!exercisesMtHandoff) continue;
    return {
      id: "rapid-interruption-feature-handoff",
      name: "feature-rapid-interruption-handoff",
      fromIndex,
      firstTargetIndex,
      finalTargetIndex,
      caseGroup: "interruption",
      transitionFamily: "interruption-feature-handoff",
      generated: true,
      surfaces:
        "feature-family rapid interruption coverage: promoted source page risk and skipped old camera completion cleanup. Page ids are disposable fixture evidence; remediation must target the shared transition rule.",
    };
  }
  return null;
}

const INTERRUPTION_CASE = selectInterruptionCase();
const ACTIVE_INTERRUPTION_CASE =
  INTERRUPTION_CASE &&
  (SELECTED_CASE_IDS.size === 0 ||
    SELECTED_CASE_IDS.has(INTERRUPTION_CASE.id) ||
    SELECTED_CASE_IDS.has(INTERRUPTION_CASE.name))
    ? INTERRUPTION_CASE
    : null;

if (SELECTED_CASE_IDS.size > 0 && ACTIVE_TRANSITION_MATRIX.length === 0 && !ACTIVE_INTERRUPTION_CASE) {
  throw new Error(
    `TRANSITION_MATRIX_CASES did not match any case id/name: ${[
      ...SELECTED_CASE_IDS,
    ].join(", ")}`,
  );
}

function artifactPath(...parts) {
  return path.join(OUTPUT_ROOT, ...parts);
}

function url(pathname = PROJECT_PATH) {
  return new URL(pathname, BASE_URL).toString();
}

function sanitize(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-|-$/g, "");
}

function errorSummary(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
    matrixPhase: error?.matrixPhase ?? null,
  };
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
    const summarizeSceneSectionHelpers = (run) => {
      const helpers = run?.sceneTransition?.sceneSectionHelpers;
      return helpers
        ? {
            groundTracePolicy: helpers.groundTracePolicy ?? null,
            liveGroundTraceCount: helpers.liveGroundTraceCount ?? null,
            snapshotGroundTraceCount: helpers.snapshotGroundTraceCount ?? null,
            snapshotActive: helpers.snapshotActive ?? null,
            transitionOpacity: rounded(helpers.transitionOpacity ?? null),
          }
        : null;
    };
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
        sceneSectionHelpers: summarizeSceneSectionHelpers(run),
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
    sceneSectionHelpers: run?.sceneTransition?.sceneSectionHelpers
      ? {
          groundTracePolicy:
            run.sceneTransition.sceneSectionHelpers.groundTracePolicy ?? null,
          liveGroundTraceCount:
            run.sceneTransition.sceneSectionHelpers.liveGroundTraceCount ?? null,
          snapshotGroundTraceCount:
            run.sceneTransition.sceneSectionHelpers.snapshotGroundTraceCount ?? null,
          snapshotActive:
            run.sceneTransition.sceneSectionHelpers.snapshotActive ?? null,
          transitionOpacity:
            run.sceneTransition.sceneSectionHelpers.transitionOpacity ?? null,
        }
      : null,
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
  const result = await page.evaluate((pageIndex) => {
    const controller = window.__pageController;
    const before = controller?.getState?.() ?? null;
    if (typeof controller?.goto !== "function") {
      return {
        ok: false,
        reason: "page-controller-goto-missing",
        before,
      };
    }
    controller.goto(pageIndex);
    const after = controller.getState?.() ?? null;
    return {
      ok: true,
      before,
      after,
    };
  }, index);
  if (!result.ok) {
    const error = new Error(
      `Page controller goto unavailable: ${JSON.stringify(result)}`,
    );
    error.matrixPhase = "source-goto";
    throw error;
  }
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
  let matrixPhase = "source-settle";
  try {
    await gotoAndSettle(page, item.fromIndex);

    matrixPhase = "source-state";
    const sourceState = await pageState(page);
    const sourcePageId = sourceState?.currentPageId ?? null;
    const targetPageId = PAGE_IDS[item.toIndex] ?? null;

    const artifacts = [];
    matrixPhase = "source-capture";
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

    matrixPhase = "target-start";
    await page.evaluate(
      (index) => window.__pageController?.goto?.(index),
      item.toIndex,
    );
    await waitForTransitionRun(page, item.toIndex);
    const lateReapplyProbe = item.probeLateReapply
      ? await triggerLateReapplyProbe(page)
      : null;
    matrixPhase = "mid-wait";
    await waitForProgress(page, 0.45, item.toIndex);
    matrixPhase = "mid-capture";
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

    matrixPhase = "end-wait";
    await waitForSettle(page, item.toIndex);
    matrixPhase = "end-capture";
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
  } catch (error) {
    error.matrixPhase = error.matrixPhase ?? matrixPhase;
    throw error;
  }
}

async function captureFailedTransitionCase(page, item, error) {
  const caseDir = artifactPath(`${item.id}-${sanitize(item.name)}`);
  await mkdir(caseDir, { recursive: true });
  let state = null;
  let stateError = null;
  let screenshot = null;
  let screenshotError = null;
  try {
    state = await pageState(page);
  } catch (stateReadError) {
    stateError = errorSummary(stateReadError);
  }
  try {
    const screenshotPath = path.join(caseDir, "failure.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    screenshot = path.relative(OUTPUT_ROOT, screenshotPath).replaceAll("\\", "/");
  } catch (captureError) {
    screenshotError = errorSummary(captureError);
  }
  const failure = {
    ...item,
    failed: true,
    sourcePageId: PAGE_IDS[item.fromIndex] ?? null,
    targetPageId: PAGE_IDS[item.toIndex] ?? null,
    traceJson: null,
    artifacts: [],
    failure: {
      capturedAt: new Date().toISOString(),
      caseId: item.id,
      caseName: item.name,
      fromIndex: item.fromIndex,
      toIndex: item.toIndex,
      sourcePageId: PAGE_IDS[item.fromIndex] ?? null,
      targetPageId: PAGE_IDS[item.toIndex] ?? null,
      observedCurrentPageId: state?.currentPageId ?? null,
      observedTargetPageId: state?.targetPageId ?? null,
      screenshot,
      state,
      stateError,
      screenshotError,
      error: errorSummary(error),
    },
  };
  await jsonFile(path.join(caseDir, "failure.json"), failure.failure);
  return failure;
}

async function recoverAfterCaseFailure(page) {
  await waitForApp(page);
  await page.waitForTimeout(250);
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
  if (item.failed) return null;
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
  if (RECORD_VIDEO) {
    await mkdir(artifactPath("videos"), { recursive: true });
  }
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-features=CalculateNativeWinOcclusion",
      "--disable-renderer-backgrounding",
    ],
  });
  const contextOptions = { viewport: VIEWPORT };
  if (RECORD_VIDEO) {
    contextOptions.recordVideo = {
      dir: artifactPath("videos"),
      size: VIEWPORT,
    };
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const video = RECORD_VIDEO ? page.video() : null;
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
    const writeManifest = async (
      videoPath,
      videoStatus,
      traceStatus = "complete",
    ) => {
      const manifest = {
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        route: PROJECT_PATH,
        viewport: VIEWPORT,
        outputRoot: OUTPUT_ROOT,
        pageIds: PAGE_IDS,
        matrixScope: {
          mode:
            SELECTED_CASE_IDS.size > 0
              ? "selected-cases"
              : "all-adjacent-plus-supplemental",
          pageOrderSource: "projects/utah-forge/project.json:pageOrder",
          generatedAdjacentCaseCount: ALL_ADJACENT_MATRIX.length,
          supplementalCaseCount: SUPPLEMENTAL_MATRIX.length,
          interruptionCaseCount: INTERRUPTION_CASE ? 1 : 0,
          selectedCaseIds:
            SELECTED_CASE_IDS.size > 0 ? [...SELECTED_CASE_IDS].sort() : [],
          activeCaseCount:
            ACTIVE_TRANSITION_MATRIX.length + (ACTIVE_INTERRUPTION_CASE ? 1 : 0),
        },
        initialPageState: ids,
        video: videoPath,
        videoStatus,
        traceStatus,
        cases: captured,
        consoleMessages,
        notes: [
          "The first mid-transition capture triggers a transition-aware late-reapply probe; authored visual policy should remain unchanged.",
          "All adjacent pageOrder handoffs are generated from the project manifest so coverage follows page additions, removals, and renames.",
          "Supplemental cases are reserved for non-adjacent or interruption stress paths that exercise base transition rules without treating pages as durable fixtures.",
          "Each JSON artifact includes the full PageController debug state for that capture phase.",
          "Each case includes trace.json from a post-screenshot replay captured inside PageController's app tick, with transition progress, camera pose, consumer timing, and product policy rows; this avoids Playwright round trips during smoothness sampling.",
          "If TRANSITION_MATRIX_TRACE=0 is set, trace replay is skipped and traceStatus is disabled; screenshots and state summaries remain valid for policy classification but not smoothness timing.",
          "The manifest video field points to a WebM recording of the full matrix capture and replay pass for human smoothness review when video recording is enabled.",
          "Screenshots are headless Chromium captures and should be reviewed alongside transitionRun summaries.",
        ],
      };
      await jsonFile(artifactPath("manifest.json"), manifest);
      return manifest;
    };

    for (const item of ACTIVE_TRANSITION_MATRIX) {
      try {
        captured.push(await captureTransitionCase(page, item));
      } catch (error) {
        const failedCase = await captureFailedTransitionCase(page, item, error);
        captured.push(failedCase);
        console.warn(
          `Transition matrix case failed: ${item.id} ${item.name} (${failedCase.failure.error.matrixPhase})`,
        );
        await recoverAfterCaseFailure(page);
      }
    }
    if (ACTIVE_INTERRUPTION_CASE) {
      captured.push(await captureInterruptionCase(page, ACTIVE_INTERRUPTION_CASE));
    }
    await writeManifest(
      null,
      video ? "pending-video-finalization" : "disabled",
      ENABLE_TRACE_REPLAY ? "pending-trace-replay" : "disabled",
    );
    if (ENABLE_TRACE_REPLAY) {
      for (const item of captured) {
        if (item.failed) continue;
        try {
          item.traceJson = await captureTraceReplayForCase(page, item);
        } catch (error) {
          item.traceFailure = {
            capturedAt: new Date().toISOString(),
            error: errorSummary(error),
          };
          await jsonFile(
            path.join(
              artifactPath(`${item.id}-${sanitize(item.name)}`),
              "trace-failure.json",
            ),
            item.traceFailure,
          );
          console.warn(
            `Transition matrix trace failed: ${item.id} ${item.name} (${item.traceFailure.error.matrixPhase})`,
          );
          await recoverAfterCaseFailure(page);
        }
        await writeManifest(
          null,
          video ? "pending-video-finalization" : "disabled",
          "partial-trace-replay",
        );
      }
    }
    await writeManifest(
      null,
      video ? "pending-video-finalization" : "disabled",
      ENABLE_TRACE_REPLAY ? "complete" : "disabled",
    );
    await context.close();
    contextClosed = true;
    const videoPath = video
      ? path.relative(OUTPUT_ROOT, await video.path()).replaceAll("\\", "/")
      : null;
    await writeManifest(
      videoPath,
      video ? "ready" : "disabled",
      ENABLE_TRACE_REPLAY ? "complete" : "disabled",
    );
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
