import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analyzeManifest,
  formatAnalysisMarkdown,
} from "../../tools/analyze-transition-matrix.mjs";

test("analyzeManifest summarizes transition divergence categories", () => {
  const manifest = {
    outputRoot: "test-results/transition-matrix-debug-sample",
    traceStatus: "complete",
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
          {
            step: "mid-covered",
            stateSummary: {
              runReason: "page-click",
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              sceneSourcePageId: "source-page",
              sceneTargetPageId: "target-page",
              sceneSectionHelpers: {
                groundTracePolicy:
                  "mirror-delayed-ground-trace-into-helper-snapshot",
                liveGroundTraceCount: 0,
                snapshotGroundTraceCount: 1,
                snapshotActive: true,
                transitionOpacity: 0.42,
              },
              productFamilies: [
                {
                  layerId: "scene-section-covered",
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
            },
          },
        ],
        trace: {
          samples: [
            {
              elapsedMs: 0,
              dtMs: null,
              isTransitioning: true,
              transitionProgress: 0,
              runStatus: "active",
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              runRawProgress: 0,
              runEasedProgress: 0,
              sceneSourcePageId: "source-page",
              sceneTargetPageId: "target-page",
              cameraPosition: { x: 0, y: 0, z: 0 },
              cameraTarget: { x: 0, y: 0, z: 0 },
              cameraTransition: {
                pathDistance: 900000,
                positionDistanceToTarget: 900000,
              },
              sceneDebug: {
                activeDataTransitionCount: 2,
                layerTweenCount: 1,
                scalarTweenCount: 1,
                snapshotCount: 0,
                workingAreaFocusTweenActive: true,
                sceneSectionStyleTweenActive: false,
                sceneSectionHelperTransitionSnapshotActive: false,
                sceneSectionHelperTransitionOpacity: 1,
                frameUpdate: {
                  totalMs: 1.5,
                  layerTweensMs: 0.9,
                  sectionIsoThresholdOcclusionMs: 0.1,
                  sceneOverlayTickMs: 0.2,
                },
                layerTweenTick: {
                  totalMs: 0.8,
                  sceneSectionMs: 0,
                  layerMs: 0.4,
                  snapshotMs: 0,
                  helperSnapshotMs: 0,
                  envelopeMs: 0.2,
                  layerTweenIds: ["mt-volume"],
                  scalarTweenIds: ["mt-volume"],
                  snapshotIds: [],
                },
                lateReapplyTotalCount: 3,
                lateReapplyDuringTransitionCount: 2,
                latestLateReapplyAction: "transition-aware-current-page-state",
                latestLateReapplyReason: "async-layer-resolve",
                productFamilyCounts: {
                  "scalar-volume": 1,
                },
              },
            },
            {
              elapsedMs: 1000,
              dtMs: 1000,
              isTransitioning: true,
              transitionProgress: 0.72,
              runStatus: "active",
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              runRawProgress: 0.72,
              runEasedProgress: 0.72,
              sceneSourcePageId: "source-page",
              sceneTargetPageId: "target-page",
              cameraPosition: { x: 650000, y: 0, z: 0 },
              cameraTarget: { x: 12000, y: 0, z: 0 },
              cameraTransition: {
                pathDistance: 900000,
                positionDistanceToTarget: 250000,
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                layerTweenCount: 1,
                scalarTweenCount: 0,
                snapshotCount: 1,
                workingAreaFocusTweenActive: true,
                sceneSectionStyleTweenActive: true,
                sceneSectionHelperTransitionSnapshotActive: false,
                sceneSectionHelperTransitionOpacity: 0.42,
                frameUpdate: {
                  totalMs: 6.25,
                  layerTweensMs: 4.5,
                  sectionIsoThresholdOcclusionMs: 0.75,
                  sceneOverlayTickMs: 0.25,
                },
                renderLoop: {
                  frameIndex: 24,
                  rafDeltaMs: 1000,
                  wallDeltaMs: 1000,
                  idleGapMs: 993.75,
                  totalMs: 20,
                  tickersMs: 8,
                  controlsUpdateMs: 0.5,
                  managerFrameUpdateMs: 6.25,
                  renderMs: 5.25,
                  tickerCount: 5,
                },
                layerTweenTick: {
                  totalMs: 4.1,
                  sceneSectionMs: 2.2,
                  sceneSectionApply: {
                    totalMs: 2.2,
                    boundsMs: 0.3,
                    frameResolveMs: 0.2,
                    materialApplyMs: 0.8,
                    helperRebuildMs: 0.6,
                    helperOpacityMs: 0.1,
                    mtCutIsoMs: 0.1,
                    mtCutIsoUpdate: {
                      policy: "full-rebuild",
                      totalMs: 1.2,
                      clearMs: 0.1,
                      setupMs: 0.2,
                      meshBuildMs: 0.5,
                      meshBuildSetupMs: 0.031,
                      meshBuildFrameRangeMs: 0.041,
                      meshBuildBufferAllocMs: 0.052,
                      meshBuildGridSampleMs: 0.243,
                      meshBuildIndexMs: 0.061,
                      meshBuildGeometryMs: 0.071,
                      meshBuildMaterialMs: 0.008,
                      meshBuildMeshObjectMs: 0.009,
                      meshBuildVertexCount: 9216,
                      meshBuildIndexCount: 54150,
                      overlayUpdateMs: 0.3,
                      overlayDebug: {
                        totalMs: 0.3,
                        disposeMs: 0.01,
                        rootCreateMs: 0.02,
                        bandMeshMs: 0.04,
                        lineGeometryMs: 0.18,
                        lineMaterialMs: 0.03,
                        attachMs: 0.02,
                        lineGeometryDebug: {
                          timingMode: "coarse-pass",
                          totalMs: 0.18,
                          setupMs: 0.005,
                          contourPassMs: 0.105,
                          triangleScanMs: 0,
                          triangleIntersectionMs: 0,
                          segmentRecordMs: 0,
                          segmentStitchMs: 0.03,
                          stitchNodeBuildMs: 0.011,
                          stitchTraversalMs: 0.009,
                          stitchPointAssemblyMs: 0.004,
                          stitchLengthFilterMs: 0.003,
                          stitchNormalMs: 0.002,
                          polylineSimplifyMs: 0.02,
                          ribbonExtrudeMs: 0.015,
                          geometryCreateMs: 0.005,
                          triangleCount: 7,
                          maskedTriangleCount: 1,
                          invalidTriangleCount: 2,
                          degenerateTriangleCount: 1,
                          levelCandidateCount: 13,
                          intersectionAttemptCount: 9,
                        },
                        bandMeshCount: 1,
                        lineMeshCount: 1,
                        lineSourceSegmentCount: 11,
                        lineTinySegmentCount: 2,
                        linePolylineCount: 3,
                        lineSimplifiedPointCount: 44,
                        lineRibbonSegmentCount: 55,
                        lineSnapToleranceM: 0.125,
                        skippedReason: null,
                      },
                      attachMs: 0.08,
                      disposeMs: 0.02,
                      planesCount: 2,
                      selectedPlaneCount: 1,
                      cutsBuiltCount: 1,
                      overlayRootCount: 1,
                      gridSize: 96,
                      skippedReason: null,
                    },
                    seismicCutIsoMs: 0.1,
                    traversedObjectCount: 12,
                    materialApplyCount: 4,
                    helperObjectCount: 3,
                  },
                  layerMs: 0.6,
                  snapshotMs: 0.4,
                  helperSnapshotMs: 0,
                  envelopeMs: 0.3,
                  layerTweenIds: ["scene-section"],
                  scalarTweenIds: [],
                  snapshotIds: ["scene-section"],
                },
                lateReapplyTotalCount: 4,
                lateReapplyDuringTransitionCount: 3,
                latestLateReapplyAction: "transition-aware-current-page-state",
                latestLateReapplyReason: "async-layer-resolve",
                productFamilyCounts: {
                  "scalar-volume": 1,
                  "scene-section-helpers": 1,
                },
              },
            },
          ],
        },
        traceFailure: {
          error: {
            matrixPhase: "trace-source-settle",
            message: "timeout while settling source page",
          },
        },
      },
    ],
  };

  const analysis = analyzeManifest(manifest);

  assert.equal(analysis.console.unexpected.length, 1);
  assert.equal(analysis.counts.traceReplayDisabled, 0);
  assert.equal(analysis.counts.stateSourceOnly, 3);
  assert.equal(analysis.counts.loadedAtStartFalse, 1);
  assert.equal(analysis.counts.opacityJumps, 4);
  assert.equal(analysis.counts.policyMismatches, 1);
  assert.equal(analysis.counts.sectionIsoEntries, 1);
  assert.equal(analysis.counts.sectionIsoRenderOpacityMismatch, 1);
  assert.equal(analysis.counts.sceneSectionGroundTraceRisk, 1);
  assert.equal(analysis.counts.sceneSectionGroundTraceCovered, 1);
  assert.equal(analysis.counts.cameraPathRisk, 1);
  assert.equal(analysis.counts.smoothnessTraceQualityRisk, 1);
  assert.equal(analysis.counts.longActiveTraceGaps, 1);
  assert.equal(analysis.counts.adjacentTransitionCoverageGaps, 1);
  assert.equal(analysis.counts.matrixCaptureFailures, 1);
  assert.equal(analysis.counts.interruptionDivergences, 1);
  assert.equal(analysis.counts.lateReapplyDuringTransition, 1);
  assert.equal(analysis.counts.hiddenDormantState, 2);
  assert.equal(analysis.counts.hiddenUnresolvedState, 0);
  assert.equal(analysis.counts.unloadedDormantHelperState, 1);
  assert.equal(analysis.counts.unloadedUnresolvedState, 0);
  assert.equal(analysis.counts.opacityJumpCovered, 3);
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
    analysis.sceneSectionGroundTraceCovered[0].classification,
    "scene-section-ground-trace-snapshot-covered",
  );
  assert.equal(
    analysis.sceneSectionGroundTraceCovered[0].snapshotGroundTraceCount,
    1,
  );
  assert.equal(
    analysis.cameraPathRisk[0].classification,
    "large-static-camera-path-risk",
  );
  assert.equal(
    analysis.smoothnessTraceQualityRisk[0].classification,
    "insufficient-active-smoothness-samples",
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].classification,
    "long-gap-with-late-reapply",
  );
  assert.equal(analysis.longActiveTraceGaps[0].lateReapplyDelta, 1);
  assert.equal(
    analysis.longActiveTraceGaps[0].workingAreaFocusTweenActiveAfter,
    true,
  );
  assert.equal(analysis.longActiveTraceGaps[0].frameLayerTweensMsAfter, 4.5);
  assert.equal(analysis.longActiveTraceGaps[0].tickSceneSectionMsAfter, 2.2);
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMaterialApplyMsAfter,
    0.8,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionHelperRebuildMsAfter,
    0.6,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionTraversedObjectCountAfter,
    12,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoPolicyAfter,
    "full-rebuild",
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildMsAfter,
    0.5,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildSetupMsAfter,
    0.031,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildFrameRangeMsAfter,
    0.041,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildBufferAllocMsAfter,
    0.052,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildGridSampleMsAfter,
    0.243,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildIndexMsAfter,
    0.061,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildGeometryMsAfter,
    0.071,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildMaterialMsAfter,
    0.008,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildMeshObjectMsAfter,
    0.009,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildVerticesAfter,
    9216,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoMeshBuildIndicesAfter,
    54150,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoOverlayUpdateMsAfter,
    0.3,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoOverlayLineGeometryMsAfter,
    0.18,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineTimingModeAfter,
    "coarse-pass",
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineContourPassMsAfter,
    0.105,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineTriangleScanMsAfter,
    0,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineIntersectionMsAfter,
    0,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineSegmentRecordMsAfter,
    0,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineStitchMsAfter,
    0.03,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineStitchNodeBuildMsAfter,
    0.011,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineStitchTraversalMsAfter,
    0.009,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineStitchPointAssemblyMsAfter,
    0.004,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineStitchLengthFilterMsAfter,
    0.003,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineStitchNormalMsAfter,
    0.002,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineRibbonMsAfter,
    0.015,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineSimplifyMsAfter,
    0.02,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineOtherMsAfter,
    0,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineTrianglesAfter,
    7,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineLevelCandidatesAfter,
    13,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoLineIntersectionAttemptsAfter,
    9,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoOverlayBandMeshMsAfter,
    0.04,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoOverlayLineRibbonSegmentsAfter,
    55,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoOverlaySkippedAfter,
    null,
  );
  assert.equal(
    analysis.longActiveTraceGaps[0].tickSceneSectionMtCutIsoCutsBuiltAfter,
    1,
  );
  assert.equal(analysis.longActiveTraceGaps[0].renderLoopRafDeltaMsAfter, 1000);
  assert.equal(analysis.longActiveTraceGaps[0].renderLoopIdleGapMsAfter, 993.75);
  assert.deepEqual(analysis.longActiveTraceGaps[0].tickLayerTweenIds, [
    "scene-section",
  ]);
  assert.equal(
    analysis.adjacentTransitionCoverageGaps[0].classification,
    "uncaptured-adjacent-transition",
  );
  assert.equal(
    analysis.matrixCaptureFailures[0].failureKind,
    "trace-replay-failure",
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
      /enough active-frame density/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Inspect long active trace gaps/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Add targeted matrix cases/.test(item),
    ),
  );
  assert.ok(
    analysis.recommendations.some((item) =>
      /Treat matrix capture failures/.test(item),
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
  assert.match(markdown, /scene-section-covered/);
  assert.match(markdown, /scene-section-ground-trace-snapshot-covered/);
  assert.match(markdown, /large-static-camera-path-risk/);
  assert.match(markdown, /insufficient-active-smoothness-samples/);
  assert.match(markdown, /long-gap-with-late-reapply/);
  assert.match(markdown, /uncaptured-adjacent-transition/);
  assert.match(markdown, /trace-replay-failure/);
  assert.match(markdown, /wrong-source/);
  assert.match(markdown, /transition-aware-current-page-state/);
});

test("selected-case matrices do not report full adjacent coverage gaps", () => {
  const analysis = analyzeManifest({
    outputRoot: "test-results/transition-matrix-debug-selected",
    traceStatus: "complete",
    pageIds: ["source-page", "target-page", "other-page"],
    matrixScope: {
      mode: "selected-cases",
      selectedCaseIds: ["A01"],
    },
    cases: [
      {
        id: "A01",
        name: "selected-source-to-target",
        fromIndex: 0,
        toIndex: 1,
        artifacts: [
          {
            step: "mid",
            stateSummary: {
              productFamilies: [],
            },
          },
        ],
      },
    ],
  });

  assert.equal(analysis.counts.adjacentTransitionCoverageGaps, 0);
});

test("long trace gaps are classified as RAF cadence loss when render loop cadence slips", () => {
  const analysis = analyzeManifest({
    outputRoot: "test-results/transition-matrix-debug-raf-gap",
    traceStatus: "complete",
    pageIds: ["source-page", "target-page"],
    matrixScope: {
      mode: "selected-cases",
      selectedCaseIds: ["A01"],
    },
    cases: [
      {
        id: "A01",
        name: "selected-source-to-target",
        fromIndex: 0,
        toIndex: 1,
        trace: {
          samples: [
            {
              elapsedMs: 0,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
              },
            },
            {
              elapsedMs: 1000,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0.4,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
                renderLoop: {
                  frameIndex: 42,
                  rafDeltaMs: 1000,
                  wallDeltaMs: 1000,
                  idleGapMs: 930,
                  totalMs: 70,
                  tickersMs: 20,
                  controlsUpdateMs: 1,
                  managerFrameUpdateMs: 15,
                  renderMs: 34,
                  tickerCount: 5,
                  tickerDurations: [
                    {
                      name: "PageController.transitionTick",
                      durationMs: 16,
                    },
                    {
                      name: "SceneLabels",
                      durationMs: 4,
                    },
                  ],
                },
              },
              controllerDebug: {
                traceSampleMs: 6,
                transitionTick: {
                  totalMs: 31,
                  tweenerMs: 4,
                  pageTransitionProgressMs: 7,
                  transitionDynamicCameraMs: 3,
                  dynamicCameraMs: 2,
                  lockedCameraFocusMs: 1,
                  smoothnessSampleMs: 6,
                  progressStateUpdated: true,
                },
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(analysis.counts.longActiveTraceGaps, 1);
  assert.equal(
    analysis.longActiveTraceGaps[0].classification,
    "long-gap-with-raf-cadence-loss",
  );
  assert.equal(analysis.longActiveTraceGaps[0].renderLoopFrameIndexAfter, 42);
  assert.equal(analysis.longActiveTraceGaps[0].renderLoopRafDeltaMsAfter, 1000);
});

test("long trace gaps are classified as RAF-only when the independent timer continues", () => {
  const analysis = analyzeManifest({
    outputRoot: "test-results/transition-matrix-debug-raf-only-gap",
    traceStatus: "complete",
    pageIds: ["source-page", "target-page"],
    matrixScope: {
      mode: "selected-cases",
      selectedCaseIds: ["A01"],
    },
    cases: [
      {
        id: "A01",
        name: "selected-source-to-target",
        fromIndex: 0,
        toIndex: 1,
        trace: {
          samples: [
            {
              elapsedMs: 0,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 10,
                deltaMs: 50,
                maxDeltaMs: 60,
                ageMs: 5,
                ticksSinceLastSample: 0,
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
              },
            },
            {
              elapsedMs: 1000,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0.4,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 28,
                deltaMs: 50,
                maxDeltaMs: 60,
                ageMs: 4,
                ticksSinceLastSample: 18,
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
                renderLoop: {
                  frameIndex: 42,
                  rafDeltaMs: 1000,
                  wallDeltaMs: 1000,
                  idleGapMs: 930,
                  totalMs: 70,
                  tickersMs: 20,
                  controlsUpdateMs: 1,
                  managerFrameUpdateMs: 15,
                  renderMs: 34,
                  tickerCount: 5,
                  tickerDurations: [
                    {
                      name: "PageController.transitionTick",
                      durationMs: 16,
                    },
                    {
                      name: "SceneLabels",
                      durationMs: 4,
                    },
                  ],
                },
              },
              controllerDebug: {
                traceSampleMs: 6,
                transitionTick: {
                  totalMs: 31,
                  tweenerMs: 4,
                  pageTransitionProgressMs: 7,
                  transitionDynamicCameraMs: 3,
                  dynamicCameraMs: 2,
                  lockedCameraFocusMs: 1,
                  smoothnessSampleMs: 6,
                  progressStateUpdated: true,
                },
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(
    analysis.longActiveTraceGaps[0].classification,
    "long-gap-with-raf-only-cadence-loss",
  );
  assert.equal(analysis.longActiveTraceGaps[0].timerTicksDuringGap, 18);
  assert.equal(analysis.longActiveTraceGaps[0].timerMaxDeltaMsAfter, 60);
});

test("long trace gaps are classified as timer cadence loss when both clocks stall", () => {
  const analysis = analyzeManifest({
    outputRoot: "test-results/transition-matrix-debug-timer-gap",
    traceStatus: "complete",
    pageIds: ["source-page", "target-page"],
    matrixScope: {
      mode: "selected-cases",
      selectedCaseIds: ["A01"],
    },
    cases: [
      {
        id: "A01",
        name: "selected-source-to-target",
        fromIndex: 0,
        toIndex: 1,
        trace: {
          samples: [
            {
              elapsedMs: 0,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 10,
                deltaMs: 50,
                maxDeltaMs: 60,
                ageMs: 5,
                ticksSinceLastSample: 0,
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
              },
            },
            {
              elapsedMs: 1000,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0.4,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 11,
                deltaMs: 980,
                maxDeltaMs: 980,
                ageMs: 4,
                ticksSinceLastSample: 1,
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
                renderLoop: {
                  frameIndex: 42,
                  rafDeltaMs: 1000,
                  wallDeltaMs: 1000,
                  idleGapMs: 930,
                  totalMs: 70,
                  tickersMs: 20,
                  controlsUpdateMs: 1,
                  managerFrameUpdateMs: 15,
                  renderMs: 34,
                  tickerCount: 5,
                  tickerDurations: [
                    {
                      name: "PageController.transitionTick",
                      durationMs: 16,
                    },
                    {
                      name: "SceneLabels",
                      durationMs: 4,
                    },
                  ],
                },
              },
              controllerDebug: {
                traceSampleMs: 6,
                transitionTick: {
                  totalMs: 31,
                  tweenerMs: 4,
                  pageTransitionProgressMs: 7,
                  transitionDynamicCameraMs: 3,
                  dynamicCameraMs: 2,
                  lockedCameraFocusMs: 1,
                  smoothnessSampleMs: 6,
                  progressStateUpdated: true,
                },
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(
    analysis.longActiveTraceGaps[0].classification,
    "long-gap-with-raf-and-timer-cadence-loss",
  );
  assert.equal(analysis.longActiveTraceGaps[0].timerTicksDuringGap, 1);
  assert.equal(analysis.longActiveTraceGaps[0].timerDeltaMsAfter, 980);
});

test("timer-starved trace gaps are classified as long-task backed when observed", () => {
  const analysis = analyzeManifest({
    outputRoot: "test-results/transition-matrix-debug-longtask-gap",
    traceStatus: "complete",
    pageIds: ["source-page", "target-page"],
    matrixScope: {
      mode: "selected-cases",
      selectedCaseIds: ["A01"],
    },
    cases: [
      {
        id: "A01",
        name: "selected-source-to-target",
        fromIndex: 0,
        toIndex: 1,
        trace: {
          samples: [
            {
              elapsedMs: 0,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 10,
                deltaMs: 50,
                maxDeltaMs: 60,
                ageMs: 5,
                ticksSinceLastSample: 0,
              },
              longTaskDebug: {
                supported: true,
                totalCount: 0,
                totalDurationMs: 0,
                maxDurationMs: 0,
                lastStartMs: null,
                lastDurationMs: null,
                ageMs: null,
                countSinceLastSample: 0,
                durationSinceLastSampleMs: 0,
                maxDurationSinceLastSampleMs: 0,
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
              },
            },
            {
              elapsedMs: 1000,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0.4,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 11,
                deltaMs: 980,
                maxDeltaMs: 980,
                ageMs: 4,
                ticksSinceLastSample: 1,
              },
              longTaskDebug: {
                supported: true,
                totalCount: 1,
                totalDurationMs: 820,
                maxDurationMs: 820,
                lastStartMs: 100,
                lastDurationMs: 820,
                ageMs: 80,
                countSinceLastSample: 1,
                durationSinceLastSampleMs: 820,
                maxDurationSinceLastSampleMs: 820,
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
                renderLoop: {
                  frameIndex: 42,
                  rafDeltaMs: 1000,
                  wallDeltaMs: 1000,
                  idleGapMs: 930,
                  totalMs: 70,
                  tickersMs: 20,
                  controlsUpdateMs: 1,
                  managerFrameUpdateMs: 15,
                  renderMs: 34,
                  tickerCount: 5,
                },
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(
    analysis.longActiveTraceGaps[0].classification,
    "long-gap-with-main-thread-longtask",
  );
  assert.equal(analysis.longActiveTraceGaps[0].longTaskCountSinceLastSampleAfter, 1);
  assert.equal(
    analysis.longActiveTraceGaps[0].longTaskDurationSinceLastSampleMsAfter,
    820,
  );
});

test("timer-starved trace gaps prefer animation-frame script attribution", () => {
  const analysis = analyzeManifest({
    outputRoot: "test-results/transition-matrix-debug-animation-frame-gap",
    traceStatus: "complete",
    pageIds: ["source-page", "target-page"],
    matrixScope: {
      mode: "selected-cases",
      selectedCaseIds: ["A01"],
    },
    cases: [
      {
        id: "A01",
        name: "selected-source-to-target",
        fromIndex: 0,
        toIndex: 1,
        trace: {
          samples: [
            {
              elapsedMs: 0,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 10,
                deltaMs: 50,
                maxDeltaMs: 60,
                ageMs: 5,
                ticksSinceLastSample: 0,
              },
              longTaskDebug: {
                supported: true,
                totalCount: 0,
                totalDurationMs: 0,
                maxDurationMs: 0,
                lastStartMs: null,
                lastDurationMs: null,
                ageMs: null,
                countSinceLastSample: 0,
                durationSinceLastSampleMs: 0,
                maxDurationSinceLastSampleMs: 0,
              },
              animationFrameDebug: {
                supported: true,
                totalCount: 0,
                totalDurationMs: 0,
                maxDurationMs: 0,
                totalBlockingDurationMs: 0,
                maxBlockingDurationMs: 0,
                countSinceLastSample: 0,
                durationSinceLastSampleMs: 0,
                blockingDurationSinceLastSampleMs: 0,
                maxBlockingDurationSinceLastSampleMs: 0,
                scriptsSinceLastSample: [],
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
              },
            },
            {
              elapsedMs: 1000,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0.4,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 11,
                deltaMs: 980,
                maxDeltaMs: 980,
                ageMs: 4,
                ticksSinceLastSample: 1,
              },
              longTaskDebug: {
                supported: true,
                totalCount: 1,
                totalDurationMs: 820,
                maxDurationMs: 820,
                lastStartMs: 100,
                lastDurationMs: 820,
                ageMs: 80,
                countSinceLastSample: 1,
                durationSinceLastSampleMs: 820,
                maxDurationSinceLastSampleMs: 820,
              },
              animationFrameDebug: {
                supported: true,
                totalCount: 1,
                totalDurationMs: 900,
                maxDurationMs: 900,
                totalBlockingDurationMs: 840,
                maxBlockingDurationMs: 840,
                countSinceLastSample: 1,
                durationSinceLastSampleMs: 900,
                blockingDurationSinceLastSampleMs: 840,
                maxBlockingDurationSinceLastSampleMs: 840,
                scriptsSinceLastSample: [
                  {
                    sourceUrl: "http://127.0.0.1:5173/src/scene.ts",
                    functionName: "renderScene",
                    invoker: "requestAnimationFrame",
                    invokerType: "event-listener",
                    windowAttribution: "self",
                    durationMs: 780,
                    executionStartMs: 120,
                    forcedStyleAndLayoutDurationMs: 18,
                    pauseDurationMs: 0,
                  },
                ],
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
                renderLoop: {
                  frameIndex: 42,
                  rafDeltaMs: 1000,
                  wallDeltaMs: 1000,
                  idleGapMs: 930,
                  totalMs: 70,
                  tickersMs: 20,
                  controlsUpdateMs: 1,
                  managerFrameUpdateMs: 15,
                  renderMs: 34,
                  tickerCount: 5,
                  tickerDurations: [
                    {
                      name: "PageController.transitionTick",
                      durationMs: 16,
                    },
                    {
                      name: "SceneLabels",
                      durationMs: 4,
                    },
                  ],
                },
              },
              controllerDebug: {
                traceSampleMs: 6,
                transitionTick: {
                  totalMs: 31,
                  tweenerMs: 4,
                  pageTransitionProgressMs: 7,
                  transitionDynamicCameraMs: 3,
                  dynamicCameraMs: 2,
                  lockedCameraFocusMs: 1,
                  smoothnessSampleMs: 6,
                  progressStateUpdated: true,
                },
              },
            },
          ],
        },
      },
    ],
  });

  const gap = analysis.longActiveTraceGaps[0];
  assert.equal(gap.classification, "long-gap-with-animation-frame-script");
  assert.equal(gap.animationFrameSupportedAfter, true);
  assert.equal(gap.animationFrameCountSinceLastSampleAfter, 1);
  assert.equal(gap.animationFrameBlockingDurationSinceLastSampleMsAfter, 840);
  assert.equal(gap.animationFrameTopScriptSourceAfter, "src/scene.ts");
  assert.equal(gap.animationFrameTopScriptFunctionAfter, "renderScene");
  assert.equal(gap.animationFrameTopScriptInvokerAfter, "requestAnimationFrame");
  assert.equal(gap.animationFrameTopScriptDurationMsAfter, 780);
  assert.equal(
    gap.animationFrameWorkSourceAfter,
    "scene-render-loop-page-controller-transition-tick",
  );
  assert.equal(gap.renderLoopTopTickerNameAfter, "PageController.transitionTick");
  assert.equal(gap.renderLoopTopTickerMsAfter, 16);
  assert.equal(gap.controllerTickTotalMsAfter, 31);
  assert.equal(gap.controllerTickPageTransitionProgressMsAfter, 7);
  assert.equal(gap.controllerTraceSampleMsAfter, 6);
  assert.equal(gap.controllerTickProgressStateUpdatedAfter, true);
});

test("timer-starved trace gaps with no long task remain unattributed", () => {
  const analysis = analyzeManifest({
    outputRoot: "test-results/transition-matrix-debug-unattributed-gap",
    traceStatus: "complete",
    pageIds: ["source-page", "target-page"],
    matrixScope: {
      mode: "selected-cases",
      selectedCaseIds: ["A01"],
    },
    cases: [
      {
        id: "A01",
        name: "selected-source-to-target",
        fromIndex: 0,
        toIndex: 1,
        trace: {
          samples: [
            {
              elapsedMs: 0,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 10,
                deltaMs: 50,
                maxDeltaMs: 60,
                ageMs: 5,
                ticksSinceLastSample: 0,
              },
              longTaskDebug: {
                supported: true,
                totalCount: 0,
                totalDurationMs: 0,
                maxDurationMs: 0,
                lastStartMs: null,
                lastDurationMs: null,
                ageMs: null,
                countSinceLastSample: 0,
                durationSinceLastSampleMs: 0,
                maxDurationSinceLastSampleMs: 0,
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
              },
            },
            {
              elapsedMs: 1000,
              isTransitioning: true,
              runStatus: "active",
              transitionProgress: 0.4,
              runSourcePageId: "source-page",
              runTargetPageId: "target-page",
              timerDebug: {
                intervalMs: 50,
                tickIndex: 11,
                deltaMs: 980,
                maxDeltaMs: 980,
                ageMs: 4,
                ticksSinceLastSample: 1,
              },
              longTaskDebug: {
                supported: true,
                totalCount: 0,
                totalDurationMs: 0,
                maxDurationMs: 0,
                lastStartMs: null,
                lastDurationMs: null,
                ageMs: null,
                countSinceLastSample: 0,
                durationSinceLastSampleMs: 0,
                maxDurationSinceLastSampleMs: 0,
              },
              sceneDebug: {
                activeDataTransitionCount: 1,
                productFamilyCounts: {},
                lateReapplyTotalCount: 0,
                renderLoop: {
                  frameIndex: 42,
                  rafDeltaMs: 1000,
                  wallDeltaMs: 1000,
                  idleGapMs: 930,
                  totalMs: 70,
                  tickersMs: 20,
                  controlsUpdateMs: 1,
                  managerFrameUpdateMs: 15,
                  renderMs: 34,
                  tickerCount: 5,
                },
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(
    analysis.longActiveTraceGaps[0].classification,
    "long-gap-with-unattributed-timer-starvation",
  );
  assert.equal(analysis.longActiveTraceGaps[0].longTaskSupportedAfter, true);
  assert.equal(analysis.longActiveTraceGaps[0].longTaskCountSinceLastSampleAfter, 0);
});
