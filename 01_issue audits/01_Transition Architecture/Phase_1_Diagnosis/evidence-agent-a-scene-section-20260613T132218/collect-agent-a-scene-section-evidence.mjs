import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const repoRoot = process.cwd();
const evidenceDir = path.join(
  repoRoot,
  "Transition Architecture",
  "Phase_1_Diagnosis",
  "evidence-agent-a-scene-section-20260613T132218",
);
const outputPath = path.join(evidenceDir, "live-scene-section-evidence.json");
const baseUrl = "http://127.0.0.1:5173/?project=utah-forge";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

const project = readJson(path.join(repoRoot, "projects", "utah-forge", "project.json"));

function pageSummary(index) {
  const pageId = project.pageOrder[index];
  const pagePath = path.join(repoRoot, "projects", "utah-forge", "pages", `${pageId}.json`);
  const page = readJson(pagePath);
  const styles = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.layerOverrides && typeof value.layerOverrides === "object") {
      for (const [layerId, style] of Object.entries(value.layerOverrides)) {
        styles.push({ layerId, style });
      }
    }
    if (value.visibilityOverrides && typeof value.visibilityOverrides === "object") {
      for (const [layerId, style] of Object.entries(value.visibilityOverrides)) {
        styles.push({ layerId, style });
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "layerOverrides" || key === "visibilityOverrides") continue;
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(page);
  const sectionStyle =
    styles.find(({ style }) => style && typeof style === "object" && "sceneSectionEnabled" in style)?.style ?? {};
  const enabledAxes = Object.entries(sectionStyle.sceneSectionPlanes ?? {})
    .filter(([, plane]) => plane?.enabled === true)
    .map(([axis, plane]) => ({
      axis,
      positionM: plane.positionM ?? null,
      invert: plane.invert === true,
    }));
  return {
    index,
    pageId,
    title: page.title ?? null,
    sceneSectionEnabled: sectionStyle.sceneSectionEnabled === true,
    sceneSectionFrameEnabled: sectionStyle.sceneSectionFrameEnabled === true,
    enabledAxes,
    sectionIsoEnabled: styles.some(({ style }) => style?.sectionIsoEnabled === true),
    workingAreaFocusEnabled: styles.some(({ style }) => style?.workingAreaFocusEnabled === true),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const consoleMessages = [];
page.on("console", (message) => {
  const type = message.type();
  if (type === "error" || type === "warning") {
    consoleMessages.push({
      type,
      text: message.text().slice(0, 300),
    });
  }
});

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForFunction(
  () => window.__pageController && window.__GEOVOX_DIAGNOSTICS__?.getSceneHandle?.()?.manager,
  null,
  { timeout: 60_000 },
);

async function gotoIndex(index, settleMs = 3600) {
  await page.evaluate((targetIndex) => window.__pageController.goto(targetIndex), index);
  await page.waitForFunction(
    (targetIndex) => {
      const state = window.__pageController?.getState?.();
      const debug = window.__GEOVOX_DIAGNOSTICS__?.getSceneHandle?.()?.manager?.getTransitionDebugState?.();
      return (
        state?.currentIndex === targetIndex &&
        state?.targetIndex === null &&
        state?.isTransitioning === false &&
        debug?.active === false
      );
    },
    index,
    { timeout: Math.max(12_000, settleMs + 8_000) },
  );
  await delay(100);
}

async function snapshot(label) {
  return await page.evaluate((snapshotLabel) => {
    const manager = window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager;
    const controllerState = window.__pageController.getState();
    const debug = manager.getTransitionDebugState?.() ?? null;
    const tween = manager.sceneSectionStyleTween ?? null;
    const isoTransition = manager.sectionIsoOverlayTransition ?? null;
    const helperSnapshot = manager.sceneSectionHelperTransitionSnapshot ?? null;
    const workingArea = manager.getWorkingAreaFocusDebugState?.() ?? null;
    return {
      label: snapshotLabel,
      controllerState: {
        currentIndex: controllerState.currentIndex,
        currentPageId: controllerState.currentPageId,
        targetIndex: controllerState.targetIndex,
        targetPageId: controllerState.targetPageId,
        isTransitioning: controllerState.isTransitioning,
        transitionProgress: controllerState.transitionProgress,
        transitionFrame: controllerState.transitionFrame,
      },
      transitionDebug: debug
        ? {
            active: debug.active,
            sourcePageId: debug.sourcePageId,
            targetPageId: debug.targetPageId,
            activeDataTransitionCount: debug.activeDataTransitionCount,
            snapshotCount: debug.snapshotCount,
            scalarTweenCount: debug.scalarTweenCount,
            layerTweenCount: debug.layerTweenCount,
            workingAreaFocusTweenActive: debug.workingAreaFocusTweenActive,
            sceneSectionStyleTweenActive: debug.sceneSectionStyleTweenActive,
            sceneSectionHelperTransitionSnapshotActive:
              debug.sceneSectionHelperTransitionSnapshotActive,
            sceneSectionHelperTransitionOpacity: debug.sceneSectionHelperTransitionOpacity,
            layerTweenTick: debug.layerTweenTick
              ? {
                  sceneSectionApplyMode: debug.layerTweenTick.sceneSectionApplyMode,
                  sceneSectionApply: debug.layerTweenTick.sceneSectionApply,
                  layerTweenIds: debug.layerTweenTick.layerTweenIds,
                  scalarTweenIds: debug.layerTweenTick.scalarTweenIds,
                  snapshotIds: debug.layerTweenTick.snapshotIds,
                  sceneSectionStyleTweenActiveBefore:
                    debug.layerTweenTick.sceneSectionStyleTweenActiveBefore,
                  helperSnapshotActiveBefore: debug.layerTweenTick.helperSnapshotActiveBefore,
                  workingAreaFocusTweenActiveBefore:
                    debug.layerTweenTick.workingAreaFocusTweenActiveBefore,
                }
              : null,
            sectionIsoOverlays: debug.sectionIsoOverlays,
            sceneSectionHelpers: debug.sceneSectionHelpers,
            productFamilies: Array.isArray(debug.productFamilies)
              ? debug.productFamilies.filter((entry) =>
                  /scene-section|working|iso|section/i.test(
                    `${entry.family} ${entry.layerId} ${entry.reason}`,
                  ),
                )
              : [],
            lateReapply: debug.lateReapply
              ? {
                  totalCount: debug.lateReapply.totalCount,
                  duringTransitionCount: debug.lateReapply.duringTransitionCount,
                  transitionEvents: (debug.lateReapply.events ?? []).filter(
                    (event) => event.duringTransition,
                  ),
                }
              : null,
            transitionCommit: debug.transitionCommit,
          }
        : null,
      internalTween: tween
        ? {
            maskMode: tween.maskMode,
            discreteChanged: tween.discreteChanged,
            movingFrameIds: Array.from(tween.movingFrameIds ?? []),
            dissolveFrameIds: Array.from(tween.dissolveFrameIds ?? []),
            helperOpacity: manager.sceneSectionHelperTransitionOpacity,
          }
        : null,
      sectionIsoTransition: isoTransition
        ? {
            sourceRootCount: isoTransition.sourceRoots?.length ?? 0,
            targetRootCount: isoTransition.targetRoots?.length ?? 0,
            targetOpacity: isoTransition.targetOpacity,
            sourceRoles: (isoTransition.sourceRoots ?? []).map((root) => ({
              kind: root.kind,
              layerId: root.layerId,
              role: root.role,
            })),
            targetRoles: (isoTransition.targetRoots ?? []).map((root) => ({
              kind: root.kind,
              layerId: root.layerId,
              role: root.role,
            })),
          }
        : null,
      helperSnapshot: helperSnapshot
        ? {
            id: helperSnapshot.id,
            from: helperSnapshot.from,
            to: helperSnapshot.to,
            opacityNow:
              helperSnapshot.durationMs <= 0
                ? helperSnapshot.to
                : helperSnapshot.from +
                  (helperSnapshot.to - helperSnapshot.from) *
                    Math.min(
                      1,
                      Math.max(0, (performance.now() - helperSnapshot.startMs) / helperSnapshot.durationMs),
                    ),
          }
        : null,
      workingArea,
    };
  }, label);
}

async function sampleTransition(name, fromIndex, toIndex, sampleMs) {
  await gotoIndex(fromIndex);
  await page.evaluate((targetIndex) => window.__pageController.goto(targetIndex), toIndex);
  const samples = [];
  let elapsed = 0;
  for (const ms of sampleMs) {
    await delay(Math.max(0, ms - elapsed));
    elapsed = ms;
    samples.push(await snapshot(`${name}:t+${ms}ms`));
  }
  await delay(Math.max(0, 4200 - elapsed));
  samples.push(await snapshot(`${name}:settled`));
  return {
    name,
    from: pageSummary(fromIndex),
    to: pageSummary(toIndex),
    samples,
  };
}

async function settledOrientation(index) {
  await gotoIndex(index, 4200);
  const orientation = await page.evaluate(() => {
    const manager = window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager;
    const runtime = manager.sceneSectionRuntime;
    const rows = [];
    const bboxFor = (obj) => {
      const geometry = obj.geometry;
      const position = geometry?.attributes?.position;
      if (!position || typeof position.count !== "number") return null;
      obj.updateWorldMatrix?.(true, false);
      const vector = obj.position.clone();
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < position.count; i += 1) {
        vector.set(position.getX(i), position.getY(i), position.getZ(i));
        vector.applyMatrix4(obj.matrixWorld);
        min[0] = Math.min(min[0], vector.x);
        min[1] = Math.min(min[1], vector.y);
        min[2] = Math.min(min[2], vector.z);
        max[0] = Math.max(max[0], vector.x);
        max[1] = Math.max(max[1], vector.y);
        max[2] = Math.max(max[2], vector.z);
      }
      return {
        min: min.map((value) => Number(value.toFixed(3))),
        max: max.map((value) => Number(value.toFixed(3))),
        extent: max.map((value, axis) => Number((value - min[axis]).toFixed(3))),
      };
    };
    if (runtime?.group) {
      runtime.group.updateWorldMatrix?.(true, true);
      runtime.group.traverse((obj) => {
        const userData = obj.userData ?? {};
        if (
          userData.sceneSectionFrameId === "axis:y" &&
          (userData.sceneSectionFrameOutline === true ||
            userData.sceneSectionPlaneHandle === true ||
            /Y Section frame/.test(obj.name ?? ""))
        ) {
          rows.push({
            name: obj.name,
            type: obj.type,
            visible: obj.visible,
            sceneSectionAxis: userData.sceneSectionAxis ?? null,
            sceneSectionFrameId: userData.sceneSectionFrameId ?? null,
            matrixWorldDeterminant:
              typeof obj.matrixWorld?.determinant === "function"
                ? Number(obj.matrixWorld.determinant().toFixed(6))
                : null,
            position: obj.position?.toArray?.().map((value) => Number(value.toFixed(3))) ?? null,
            bbox: bboxFor(obj),
          });
        }
      });
    }
    return {
      state: window.__pageController.getState(),
      debug: manager.getTransitionDebugState?.(),
      yFrameRows: rows,
    };
  });
  return {
    name: "settled-y-helper-orientation",
    page: pageSummary(index),
    orientation,
  };
}

const evidence = {
  reportId: "PHASE1-A-SCENE-SECTION-20260613T132218",
  baseUrl,
  collectedAt: new Date().toISOString(),
  method: {
    browser: "standalone Playwright chromium",
    viewport: { width: 1280, height: 720 },
    deckStateOnly: true,
  },
  cases: [
    await sampleTransition("dec164-active-active-section-iso", 11, 12, [80, 450, 950, 1600]),
    await sampleTransition("active-section-to-inactive-working-area", 11, 28, [80, 450, 950, 1600]),
    await sampleTransition("inactive-working-area-to-active-section-iso", 28, 8, [80, 450, 950, 1600]),
    await settledOrientation(110),
  ],
  consoleMessages,
};

fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(outputPath);

await browser.close();
