import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analyzeManifest,
  formatAnalysisMarkdown,
} from "../../tools/analyze-transition-matrix.mjs";

test("analyzeManifest summarizes transition divergence categories", () => {
  const manifest = {
    outputRoot: "test-results/transition-matrix-debug-sample",
    pageIds: ["source-page", "target-page", "uncovered-page"],
    consoleMessages: [
      {
        type: "warning",
        text: "GPU stall due to ReadPixels",
      },
      {
        type: "error",
        text: "application error",
      },
    ],
    cases: [
      {
        id: "01",
        name: "sample-visible-case",
        fromIndex: 0,
        toIndex: 1,
        artifacts: [
          {
            step: "mid",
            stateSummary: {
              runReason: "page-click",
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              sceneSourcePageId: "wrong-source",
              sceneTargetPageId: "target-page",
              productFamilies: [
                {
                  layerId: "hidden-seismic",
                  family: "seismic-volume",
                  policy: "state-source-only",
                  transitionKind: "none",
                  stateSource: "authored-layer",
                  loadedAtStart: true,
                  sourceVisible: false,
                  targetVisible: false,
                  sourceOpacity: 0,
                  targetOpacity: 0,
                  reason: "hidden product state changed",
                },
                {
                  layerId: "hidden-mt-threshold",
                  family: "mt-isosurfaces",
                  policy: "state-source-only",
                  transitionKind: "none",
                  stateSource: "authored-layer",
                  loadedAtStart: true,
                  sourceVisible: false,
                  targetVisible: false,
                  sourceOpacity: 0,
                  targetOpacity: 0,
                  reason: "hidden product state changed",
                },
                {
                  layerId: "scene-section-helper",
                  family: "scene-section-helpers",
                  policy: "state-source-only",
                  transitionKind: "none",
                  stateSource: "authored-layer",
                  loadedAtStart: false,
                  sourceVisible: false,
                  targetVisible: false,
                  sourceOpacity: 0,
                  targetOpacity: 0,
                  reason: "hidden helper state is authored",
                },
                {
                  layerId: "visible-volume",
                  family: "scalar-volume",
                  policy: "preserve",
                  transitionKind: "continuous",
                  stateSource: "loaded-layer",
                  loadedAtStart: true,
                  sourceVisible: true,
                  targetVisible: true,
                  sourceOpacity: 0.1,
                  targetOpacity: 0.9,
                  reason: "style changed",
                },
                {
                  layerId: "section-layer",
                  family: "section-iso-overlays",
                  policy: "follow-section-iso-style",
                  transitionKind: "continuous",
                  stateSource: "loaded-layer",
                  loadedAtStart: true,
                  sourceVisible: true,
                  targetVisible: true,
                  sourceOpacity: 0.5,
                  targetOpacity: 0.5,
                  reason: "section ISO authored",
                },
                {
                  layerId: "mt-volume-iso",
                  family: "scalar-volume",
                  policy: "crossfade-discrete",
                  transitionKind: "discrete-crossfade",
                  stateSource: "loaded-layer",
                  loadedAtStart: true,
                  sourceVisible: true,
                  targetVisible: true,
                  sourceOpacity: 0.96,
                  targetOpacity: 0.48,
                  reason: "discrete section ISO data/style changed",
                },
                {
                  layerId: "scene-section-visible",
                  family: "scene-section-helpers",
                  policy: "translate-section-helpers",
                  transitionKind: "continuous",
                  stateSource: "scene-section-helper",
                  loadedAtStart: true,
                  sourceVisible: true,
                  targetVisible: false,
                  sourceOpacity: 1,
                  targetOpacity: 0,
                  reason: "scene section plane/window/frame style changed",
                },
              ],
              lateReapply: {
                totalCount: 3,
                duringTransitionCount: 2,
                events: [
                  {
                    sequence: 3,
                    action: "transition-aware-current-page-state",
                    duringTransition: true,
                    transitionSourcePageId: "source-page",
                    transitionTargetPageId: "target-page",
                    transitionProgress: 0.48,
                  },
                ],
              },
            },
          },
        ],
        trace: {
          samples: [
            {
              elapsedMs: 0,
              isTransitioning: true,
              runStatus: "active",
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              cameraPosition: { x: 0, y: 0, z: 0 },
              cameraTarget: { x: 0, y: 0, z: 0 },
            },
            {
              elapsedMs: 1000,
              isTransitioning: true,
              runStatus: "active",
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              cameraPosition: { x: 650000, y: 0, z: 0 },
              cameraTarget: { x: 12000, y: 0, z: 0 },
            },
          ],
        },
      },
    ],
  };

  const analysis = analyzeManifest(manifest);

  assert.equal(analysis.console.unexpected.length, 1);
  assert.equal(analysis.counts.stateSourceOnly, 3);
  assert.equal(analysis.counts.loadedAtStartFalse, 1);
  assert.equal(analysis.counts.opacityJumps, 3);
  assert.equal(analysis.counts.policyMismatches, 1);
  assert.equal(analysis.counts.sectionIsoEntries, 1);
  assert.equal(analysis.counts.sectionIsoRenderOpacityMismatch, 1);
  assert.equal(analysis.counts.sceneSectionGroundTraceRisk, 1);
  assert.equal(analysis.counts.cameraPathRisk, 1);
  assert.equal(analysis.counts.adjacentTransitionCoverageGaps, 1);
  assert.equal(analysis.counts.interruptionDivergences, 1);
  assert.equal(analysis.counts.lateReapplyDuringTransition, 1);
  assert.equal(analysis.counts.hiddenDormantState, 2);
  assert.equal(analysis.counts.hiddenUnresolvedState, 0);
  assert.equal(analysis.counts.unloadedDormantHelperState, 1);
  assert.equal(analysis.counts.unloadedUnresolvedState, 0);
  assert.equal(analysis.counts.opacityJumpCovered, 2);
  assert.equal(analysis.counts.opacityJumpUnresolved, 1);
  assert.equal(
    analysis.lateReapply[0].events[0].action,
    "transition-aware-current-page-state",
  );
  assert.equal(analysis.lateReapply[0].events[0].transitionProgress, 0.48);
  assert.ok(
    analysis.recommendations.some((item) =>
      /Late-load reapply is covered/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.every(
      (item) => !/Add transition-aware late-load reapply/.test(item),
    ),
  );
  assert.equal(analysis.stateSourceOnly[0].layerId, "hidden-seismic");
  assert.equal(
    analysis.hiddenProductState[0].classification,
    "intentional-dormant-authored-state",
  );
  assert.equal(
    analysis.hiddenProductState[0].visualPolicy,
    "preserve-hidden-no-interpolation",
  );
  assert.equal(
    analysis.loadedAtStartFalse[0].classification,
    "debug-only-unloaded-helper-state",
  );
  assert.equal(
    analysis.loadedAtStartFalse[0].visualPolicy,
    "preserve-hidden-helper-state-no-load",
  );
  assert.equal(analysis.opacityJumps[0].layerId, "visible-volume");
  assert.equal(
    analysis.opacityJumps[0].classification,
    "unresolved-preserve-opacity-delta",
  );
  assert.equal(
    analysis.opacityJumps[0].visualPolicy,
    "make-opacity-fade-policy-explicit",
  );
  assert.equal(
    analysis.sectionIsoRenderOpacityMismatch[0].classification,
    "probable-section-iso-render-opacity-mismatch",
  );
  assert.equal(
    analysis.sceneSectionGroundTraceRisk[0].classification,
    "scene-section-ground-trace-disable-risk",
  );
  assert.equal(
    analysis.cameraPathRisk[0].classification,
    "large-static-camera-path-risk",
  );
  assert.equal(
    analysis.adjacentTransitionCoverageGaps[0].classification,
    "uncaptured-adjacent-transition",
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Hidden seismic\/MT authored state is classified as dormant/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.every(
      (item) => !/Classify hidden seismic and MT isosurface authored state/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Unloaded scene-section helper state is classified as debug-only/.test(
        item,
      ),
    ),
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Resolve visible opacity-jump policy coverage/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Split section ISO overlay opacity/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Fix scene-section helper\/ground-trace disable/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Review large camera-path transitions/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Add targeted matrix cases/.test(item),
    ),
  );

  const markdown = formatAnalysisMarkdown(analysis);
  assert.match(markdown, /hidden-seismic/);
  assert.match(markdown, /intentional-dormant-authored-state/);
  assert.match(markdown, /debug-only-unloaded-helper-state/);
  assert.match(markdown, /unresolved-preserve-opacity-delta/);
  assert.match(markdown, /visible-volume/);
  assert.match(markdown, /mt-volume-iso/);
  assert.match(markdown, /scene-section-visible/);
  assert.match(markdown, /large-static-camera-path-risk/);
  assert.match(markdown, /uncaptured-adjacent-transition/);
  assert.match(markdown, /wrong-source/);
  assert.match(markdown, /transition-aware-current-page-state/);
});
