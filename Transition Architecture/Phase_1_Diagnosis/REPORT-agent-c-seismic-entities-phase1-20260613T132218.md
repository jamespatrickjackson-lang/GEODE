# 1. Report ID

PHASE1-C-SEISMIC-ENTITIES-20260613T132218

Scope: Agent C seismic products, seismic sections, seismic volumes, figure annotations, point clouds, boreholes, product opacity composition, exact transition entity keys, and execution-layer migration gaps.

Status: read-only diagnosis. Runtime/source/page/project JSON changes: none. Writes limited to this Markdown report and evidence artifacts under `Transition Architecture/Phase_1_Diagnosis/evidence-agent-c-seismic-20260613T132218/`.

# 2. Summary Verdict

Defect count by family:

| Family | Count | Verdict |
| --- | ---: | --- |
| Base-URL live evidence and Global Settings preview state | 1 | Open defect: page-local layer deltas are stripped while navigating with `__pageController`, leaving seismic and borehole product layers hidden in live evidence. |
| Seismic section and volume product entity materialization | 1 | Open migration gap: execution plans classify section/volume entities as `seismic-entity`, but exact-key opacity frames currently materialize only survey geometry and figure annotations. |
| Point cloud, point marker, and borehole object-level entity identity | 1 | Open migration gap: layer-level transition ownership exists, but per-object exact transition keys are absent. |
| Figure/legend source test net | 1 | Open test failure: the required geophysics figure legend source command fails one MT resistivity figure model assertion; seismic legend/source guards pass. |

Recommendation: harden incrementally. A rewrite is not justified by this scope. DEC-152 and DEC-153 execution-layer routing is present and source-tested. The residual issues are boundary and migration gaps: preview-state stripping, unmaterialized section/volume exact-key operations, missing object identity for borehole/point families, and one stale or broken source guard outside the seismic execution spine.

# 3. Defect Inventory

## C-SEIS-001 - Base-URL Global Settings preview strips page product visibility during live page-controller navigation

Behavior family: seismic products, sections, volumes, figure annotations, borehole logs, and live transition evidence state.

Reproduction:

- Evidence type: deck-state evidence only, not app-health proof.
- Base URL: `http://127.0.0.1:5173/?project=utah-forge`.
- Runtime handles: `window.__pageController` and `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager`.
- Representative navigation: page-controller navigation to indices `44`, `45`, `47`, `63`, and `168`, followed by settled layer readback.
- Evidence artifacts:
  - `Transition Architecture/Phase_1_Diagnosis/evidence-agent-c-seismic-20260613T132218/live-runtime-diagnostics.json`
  - `Transition Architecture/Phase_1_Diagnosis/evidence-agent-c-seismic-20260613T132218/settled-layer-visibility-summary.json`

Expected:

- Live diagnosis at the supplied base URL should either render target page product families for deck-state inspection or explicitly expose that Global Settings preview has stripped page layer deltas.
- Target effective visibility and product-layer state should be diagnosable from transition debug state without mistaking preview-stripped state for authored page behavior.

Observed:

- Settled page `54_seismic_product_catalog` reports `utah-forge-phase3-seismic-browser.visible: false`, `currentVisibleLayerIdsHas: false`, selected product `gdr-1015-forge2d-301-migr-depth`, and visible product list containing that same product.
- Settled page `55_line_301_seismic_products` reports the same hidden seismic layer despite selected and visible product state.
- Settled page `57_legacy_line_l11_seismic_products` reports hidden seismic browser state while selected product is `gdr-1141-line-l11-psdm-enh`.
- Settled page `63_borehole_logs_16a_source_ingest` reports `utah-forge-borehole-logs.visible: false`, `currentVisibleLayerIdsHas: false`, and `boreLogs: 9`.
- Live summaries show survey geometry tags on the seismic browser layer but no loaded section, volume, or figure annotation roots in the sampled base-URL state.

Severity/frequency:

- Severity: diagnosis blocker and possible visible authoring-mode defect. Base-URL live probes cannot be treated as product render proof while Global Settings preview is selected.
- Frequency: reproduced on all sampled page-controller navigation targets whose product layers depend on page-local visibility overrides while `previewEnvironmentBase` is active.

Suspected owner:

- `src/editor/EditorChrome.tsx:520` passes `previewEnvironmentBase={state.selectedPageId === ENVIRONMENT_SENTINEL}`.
- `src/pages/PageController.tsx:691` defines `pageWithoutLayerDeltas`.
- `src/pages/PageController.tsx:697` deletes `visibilityOverrides`.
- `src/pages/PageController.tsx:1095` chooses the stripped page when `previewEnvironmentBase` is true.
- `src/pages/PageController.tsx:2758` calls `finalizePageTransitionCommit` after transition completion.
- `src/scene/SceneManager.ts:3089` performs final commit bookkeeping without the direct `applyEffectiveVisibilityForPage` call used by non-transition reapply paths at `src/pages/PageController.tsx:2347` and `src/pages/PageController.tsx:2417`.

Test coverage:

- No focused source or runtime guard was found for Global Settings `previewEnvironmentBase` plus page-controller transition navigation.
- Existing transition execution-plan and registry tests do not cover preview-stripped target graphs.

Relationship to current-cycle execution-layer fixes:

- Open. Not a regression in DEC-152/DEC-153 routing. The execution layer is starved by preview-transformed target state before product evidence can be rendered.

## C-SEIS-002 - Seismic sections and volumes are planned as `seismic-entity` operations but are not materialized by the exact-key opacity executor

Behavior family: seismic sections, seismic volumes, product opacity composition, exact transition entity keys, and execution-layer migration.

Reproduction:

- Source inspection of transition planning and seismic executor routing.
- Live deck-state transition readback from `56_line_302_seismic_products` to `57_legacy_line_l11_seismic_products` and from `158_page` to `168_page`.
- Required source tests: `seismic-graph-transition-executor.test.mjs`, `transition-execution-plan.test.mjs`, and `transition-executor-registry.test.mjs`.

Expected:

- A seismic section or volume entity classified into the `seismic-entity` executor bucket should either be materialized by a registered exact-key runtime executor or have an explicit legacy-owner contract and test coverage proving layer/snapshot ownership.
- Product opacity composition for section and volume enter/exit paths should be attributable to a single owner.

Observed:

- `src/scene/transitions/transitionExecutionPlan.ts:116` maps every representation beginning with `seismic:` to `seismic-entity`.
- `src/scene/transitions/transitionEffectiveLayersForPage.ts:569` builds object entity keys for seismic section/volume graph objects.
- `src/scene/transitions/transitionEffectiveLayersForPage.ts:575` builds figure annotation entity keys from section entity keys.
- `src/scene/transitions/transitionExecutorRegistry.ts:41` routes `seismic-entity` to the seismic entity bucket.
- `src/scene/transitions/seismicGraphTransitionExecutor.ts:33` limits fade object kinds to `survey-geometry` and `figure-annotation`.
- `src/scene/transitions/seismicGraphTransitionExecutor.ts:87` skips every other object kind, including `section`, `volume`, `comparison`, and `unknown`.
- `src/loaders/loadSeismicBrowser.ts:1294` tags survey geometry with exact transition keys. No section or volume mesh transition entity tag match was found in the targeted loader/style search.
- Live transition diagnostics include `seismic:2d-section-line` enter/exit and `seismic:3d-volume` operations, but sampled runtime roots contained only survey geometry exact-key tags in the base-URL state.

Severity/frequency:

- Severity: open migration gap and visible glitch risk. No live product-geometry snap was reproduced because C-SEIS-001 kept sampled products hidden in base-URL evidence.
- Frequency: any seismic section or volume entity requiring per-object enter/exit or product opacity beyond the current layer envelope.

Suspected owner:

- `src/scene/transitions/seismicGraphTransitionExecutor.ts:33` through `src/scene/transitions/seismicGraphTransitionExecutor.ts:87` define the materialized object-kind set.
- `src/loaders/loadSeismicBrowser.ts` currently provides exact transition tags for survey geometry only.
- `src/scene/transitions/transitionExecutionPlan.ts:116` classifies the broader seismic representation family into the same executor bucket.

Test coverage:

- `seismic-graph-transition-executor.test.mjs` passes and intentionally asserts survey geometry and figure annotation fade behavior.
- The same test net explicitly leaves section continuity out of exact-key fade frames.
- No source guard was found requiring a section/volume operation to materialize through a registered executor or to declare a legacy owner.

Relationship to current-cycle execution-layer fixes:

- Open migration gap, not a failed DEC-153 phase gate. DEC-153 scoped the first migrated consumer to exact-key entity opacity for survey geometry and figure annotations. Section and volume migration remains unfinished or undocumented.

## C-SEIS-003 - Borehole, point-cloud, and point-marker families lack object-level exact transition keys

Behavior family: boreholes, borehole logs, point clouds, point markers, product opacity composition, and execution-layer migration.

Reproduction:

- Source search for transition entity tags in existing borehole and point-cloud loaders.
- Live settled layer readback on sampled Utah FORGE deck pages.
- Additional source tests for borehole log runtime/source gates.

Expected:

- If object-level continuity is required for borehole, point-cloud, or point-marker families, runtime objects need stable exact transition keys and representation keys.
- If layer-level fade is the intended owner, that owner should be explicit in source guards and transition debug traces.

Observed:

- Targeted search in `src/loaders/loadUtahForgeBoreholeLogs.ts`, `src/loaders/loadUtahForgeDemoBoreholes.ts`, `src/loaders/loadPointCloudPreview.ts`, and `src/loaders/loadTiledPointCloudPreview.ts` found no `transitionEntityKey`, `transitionRepresentationKey`, or `transitionObjectKind` assignments.
- Live settled readback reports `utah-forge-phase3-demo-boreholes` with `demoBoreholes: 94` and no exact transition tags.
- Live settled readback reports `utah-forge-borehole-logs` with `boreLogs: 9` and no exact transition tags.
- Live settled readback reports `utah-forge-mt-resistivity-full-density` with `pointClouds: 11` and no exact transition tags.
- `src/scene/transitions/productFamilyRegistry.ts:56` through `src/scene/transitions/productFamilyRegistry.ts:86` classifies point markers, point clouds, seismic, and simple geometry at product-family level only.

Severity/frequency:

- Severity: migration/test-net gap. No object-level visual defect was reproduced in this scope.
- Frequency: all borehole, borehole-log, point-cloud, and point-marker object-level transitions if future behavior requires per-object continuity.

Suspected owner:

- Loader tagging for borehole and point-cloud runtime objects.
- Transition product-family registry and render-graph adapter ownership docs/tests for families intentionally left at layer-level opacity.

Test coverage:

- `utah-forge-borehole-logs-runtime-source.test.mjs` passed in the additional read-only command.
- No exact-key entity identity tests were found for boreholes, point clouds, or point markers.

Relationship to current-cycle execution-layer fixes:

- Open migration gap. Not a failure of already-landed exact-key seismic survey/figure coverage.

## C-SEIS-004 - Required geophysics figure legend source command fails one MT resistivity figure-model assertion

Behavior family: figure annotations and legend/source test net.

Reproduction:

- Command: `node --test tests/tools/seismic-section-display-texture-source.test.mjs tests/tools/seismic-hidden-product-load-guard-source.test.mjs tests/tools/geophysics-figure-legend-source.test.mjs`.

Expected:

- Required source guard command exits cleanly.

Observed:

- Command result: 6 passing subtests, 1 failing subtest.
- Failing subtest: `MT resistivity legend renders slice figure metadata from static slice product extents`.
- Failure reason: expected `/buildMtResistivityFigureModel/` in `src/ui/ResistivityLegend.tsx`.
- Seismic display texture source, hidden seismic product load guard, and seismic figure/source-domain legend subtests passed.

Severity/frequency:

- Severity: medium test-net failure. The failure is outside the core seismic execution-layer path but blocks an all-green required command.
- Frequency: deterministic in the required command as run on 2026-06-13.

Suspected owner:

- MT resistivity legend source guard or `src/ui/ResistivityLegend.tsx` model wiring.

Test coverage:

- The failing source test is direct coverage.
- No runtime visual claim follows from this failure in Agent C scope.

Relationship to current-cycle execution-layer fixes:

- Open and likely unrelated to DEC-152/DEC-153 execution-layer migration.

# 4. Clean List

- Exact-key entity opacity executor: clean in this scope. `transitionEntityOpacityExecutor.ts` collects exact `transitionEntityKey` values, preserves base material opacity, composes parent layer opacity and entity factor, writes `uOpacity`, and restores authored invisible children. Required executor tests passed.
- Figure annotation identity: clean in this scope. `seismicFigureAnnotationEntityKey` appends `:figure-annotation` to the section graph entity key, and `seismicFigureAnnotations.ts` tags objects/materials with the exact entity and representation keys. Additional graph-basis and figure-annotation tests passed.
- Survey geometry identity: clean in this scope. `seismicSurveyGeometryEntityKey` is role-aware and page-agnostic, and `loadSeismicBrowser.ts` tags survey navigation, lines, sources, and receivers with exact transition keys. Required seismic graph executor tests passed.
- Hidden seismic product load guard: clean in this scope. Required hidden product load guard source subtests passed.
- Seismic section display texture source: clean in this scope. Required display texture source test passed.
- DEC-152 execution plan and registry path: clean in this scope. Required transition execution plan and executor registry tests passed.
- DEC-153 phase-gated seismic exact-key migration: clean for the declared first migrated consumers, survey geometry and figure annotations. Section/volume and borehole/point families remain open migration gaps, not failed already-landed coverage.
- DEC-163 color/material channel policy: additional transition entity channel policy tests passed, including discrete commit treatment for protected visual channels.
- Console health during live evidence: only known Chromium `GPU stall due to ReadPixels` warnings were captured. No page errors were captured in the live Playwright run.

# 5. Already-Landed Verification

Exact-key entity opacity:

- Source: `src/scene/transitions/transitionEntityOpacityExecutor.ts:67` reads `object.userData.transitionEntityKey`.
- Source: `src/scene/transitions/transitionEntityOpacityExecutor.ts:127` indexes tagged objects by exact key.
- Source: `src/scene/transitions/transitionEntityOpacityExecutor.ts:162` records `transitionParentLayerOpacity`, `transitionEntityOpacityFactor`, and `transitionEffectiveOpacity`.
- Verification: `transition-entity-opacity-executor.test.mjs` passed in the required command.

Figure annotation identity:

- Source: `src/geophysics/seismicSectionGraphBasis.ts:212` defines `seismicFigureAnnotationEntityKey`.
- Source: `src/geophysics/seismicSectionGraphBasis.ts:228` appends `:figure-annotation`.
- Source: `src/scene/styles/seismicFigureAnnotations.ts:92` and `src/scene/styles/seismicFigureAnnotations.ts:131` tag figure objects/materials with exact entity keys.
- Verification: `seismic-section-graph-basis.test.mjs` and `seismic-figure-annotations.test.mjs` passed in the additional read-only command.

Hidden product load guard:

- Verification: `seismic-hidden-product-load-guard-source.test.mjs` passed all hidden product load guard subtests in the required source command.
- Scope note: the guard verifies hidden seismic products do not load merely from project/catalog presence.

DEC-152 and DEC-153 phase gate:

- Source: `src/scene/transitions/transitionExecutionPlan.ts:116` assigns seismic representations to `seismic-entity`.
- Source: `src/scene/transitions/transitionExecutorRegistry.ts:41` maps `seismic-entity` operations to the seismic bucket.
- Source: `src/scene/transitions/transitionExecutorRegistry.ts:65` places `seismic-entity` in dispatch order.
- Source: `src/scene/transitions/seismicGraphTransitionExecutor.ts:33` declares the currently migrated object-kind set: survey geometry and figure annotations.
- Verification: required `transition-execution-plan`, `transition-executor-registry`, and `seismic-graph-transition-executor` tests passed.

# 6. Recommendation And Test-Net Gaps

Recommendation: harden, not rewrite.

Near-term hardening:

- Add a source/runtime guard for `previewEnvironmentBase` plus page-controller transition navigation. The guard should either preserve target page visibility for visual navigation or mark preview-stripped transition graphs explicitly in diagnostics so deck-state evidence cannot be misread as product render evidence.
- Add a synthetic transition landing test around `finalizePageTransitionCommit` and target effective visibility/style landing. The test should avoid live Utah page IDs and use in-memory fixtures.
- Add a section/volume ownership guard. A `seismic:2d-section-line` or `seismic:3d-volume` operation should either materialize through a registered exact-key executor or carry an explicit legacy layer/snapshot owner with source coverage.
- Add borehole, point-cloud, and point-marker object-identity inventory tests if per-object continuity is required. If layer opacity remains authoritative, encode that as a declared owner in product-family tests and transition diagnostics.
- Resolve the MT resistivity figure-model source test mismatch separately from seismic execution-layer work.

Current test-net gaps:

- No automated guard covers Global Settings preview stripping page visibility during page-controller navigation.
- No exact-key materialization guard covers seismic section, seismic volume, or comparison entities.
- No object-level exact-key inventory guard covers boreholes, borehole logs, point clouds, or point markers.
- No live browser fixture was sampled with a normal authored page selected and `previewEnvironmentBase` disabled. Current live evidence remains deck-state evidence and ready for visual check only.
- No human visual confirmation was performed.

# 7. Method Notes And Exact Commands

Required documents read:

- `Transition Architecture/Phase_1_Diagnosis/PROMPT-phase1-transition-defect-inventory.md`
- `CLAUDE.md`
- `docs/dev-context/Active-Build-Context.md`
- `docs/dev-context/Transition-Runtime-Operating-Spec.md`
- `docs/dev-context/Page-Transitions-And-Section-Frames.md`
- `docs/dev-context/Transition-Constitution.md`
- `docs/dev-context/Transition-Continuity-Contract.md`
- `docs/dev-context/Transition-Guardrails.md`
- `docs/03-decisions.md` entries DEC-152, DEC-153, DEC-162, DEC-163, DEC-164, and DEC-165.

Targeted source areas inspected:

- `src/scene/transitions/transitionEntityOpacityExecutor.ts`
- `src/scene/transitions/transitionExecutionPlan.ts`
- `src/scene/transitions/transitionExecutorRegistry.ts`
- `src/scene/transitions/seismicGraphTransitionExecutor.ts`
- `src/scene/transitions/transitionEntityPolicy.ts`
- `src/scene/transitions/transitionRenderGraphAdapter.ts`
- `src/scene/transitions/productFamilyRegistry.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/geophysics/seismicSectionGraphBasis.ts`
- `src/scene/styles/seismicFigureAnnotations.ts`
- `src/loaders/loadSeismicBrowser.ts`
- `src/loaders/loadUtahForgeBoreholeLogs.ts`
- `src/loaders/loadUtahForgeDemoBoreholes.ts`
- `src/loaders/loadPointCloudPreview.ts`
- `src/loaders/loadTiledPointCloudPreview.ts`
- relevant `SceneManager`, `PageController`, and `EditorChrome` transition/preview ranges.

Commands run:

```powershell
node --test tests/tools/seismic-graph-transition-executor.test.mjs tests/tools/transition-entity-opacity-executor.test.mjs tests/tools/transition-execution-plan.test.mjs tests/tools/transition-executor-registry.test.mjs
```

Result: pass, 40/40 subtests.

```powershell
node --test tests/tools/seismic-section-display-texture-source.test.mjs tests/tools/seismic-hidden-product-load-guard-source.test.mjs tests/tools/geophysics-figure-legend-source.test.mjs
```

Result: fail, 6/7 subtests pass. Failing subtest: `MT resistivity legend renders slice figure metadata from static slice product extents`.

```powershell
node --test tests/tools/transition-entity-channel-policy.test.mjs tests/tools/transition-render-graph-adapter.test.mjs tests/tools/seismic-section-graph-basis.test.mjs tests/tools/seismic-figure-annotations.test.mjs tests/tools/utah-forge-borehole-logs-runtime-source.test.mjs
```

Result: pass, 42/42 subtests.

Live evidence method:

- Existing dev server: `http://127.0.0.1:5173/?project=utah-forge`.
- Browser automation: Playwright against the existing server.
- Runtime API: `window.__pageController` for deck-state navigation and `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager` for SceneManager readback.
- Video capture: disabled. No transition matrix video was written.
- Evidence directory: `Transition Architecture/Phase_1_Diagnosis/evidence-agent-c-seismic-20260613T132218/`.
- Evidence artifacts: `live-runtime-diagnostics.json` and `settled-layer-visibility-summary.json`.

Final status:

- Diagnosis report written.
- No runtime/source/page/project JSON edits performed.
- Live runtime evidence remains ready for visual check, not visually confirmed.
