# Report ID

PHASE1-SYNTHESIS-TRANSITION-DEFECT-INVENTORY-20260613T132218

Scope: coordinator synthesis across Agent A scene-section, Agent B MT, Agent C seismic/entities, Agent D camera/environment/commit, local static guards, and coordinator deck-state matrix evidence.

Status: read-only Phase 1 diagnosis. Runtime/source/page/project JSON changes: none. Writes were limited to Markdown reports and evidence artifacts under `Transition Architecture/Phase_1_Diagnosis/`.

# Summary Verdict

Recommendation: harden incrementally. A transition rewrite is not justified by the Phase 1 evidence.

Reasoning:

- The current failures cluster around bounded ownership gaps: scene-section helper exit snapshots, MT product settled visibility, preview-environment page navigation state, stale guard/doc contracts, and incomplete exact-key migration coverage.
- Already-landed invariants mostly held: DEC-164 per-frame section partition, DEC-165 helper orientation, helper rebuild stability, environment/fog transition ownership, camera orbit clamp, legend landed gate, commit gate, interruption lineage, and exact-key seismic survey/figure execution.
- No evidence showed multiple unrelated families bypassing the render-graph assignment model in a way that current executor/registry seams cannot own.

Open item count by family:

| Family | Count | Open IDs |
| --- | ---: | --- |
| Scene-section helper lifecycle | 1 | `SYN-001` |
| MT full-density/product visibility/contracts/test net | 4 | `SYN-002`, `SYN-003`, `SYN-004`, `SYN-009` |
| Seismic/product/entity migration and evidence state | 4 | `SYN-005`, `SYN-006`, `SYN-007`, `SYN-008` |
| Camera/environment/overlays/commit/interruption | 0 | none |
| Evidence quality/performance risks | 1 method risk | `RISK-001` |

Visual status: ready for visual check. Headless runtime introspection and matrix captures were collected, but no human visual acceptance pass was performed.

# Defect Inventory

## SYN-001 - Active-to-inactive scene-section helper exit snapshot violates target-inactive no-bleed contract

Source report: `REPORT-agent-a-scene-section-phase1-20260613T132218.md` (`A-SCENE-001`).

Behavior family: scene-section helper lifecycle, target-active gating, active-to-inactive transition.

Reproduction and evidence:

- Deck-state evidence only: page-controller transition from index `11` (`172_page`) to index `28` (`163_page`).
- At `t+80ms`, live evidence reported `sceneSectionStyleTweenActive: false`, `sectionIsoTransition: null`, `sceneSectionHelperTransitionSnapshotActive: true`, and helper snapshot opacity `0.6373333333333333`.
- At `t+950ms`, helper snapshot still existed with opacity `0.18103333333320915`.
- Coordinator matrix core analysis independently flagged `sceneSectionGroundTraceRisk: 1` on the rapid-interruption handoff and showed `policy=mirror-delayed-ground-trace-into-helper-snapshot`.

Expected vs observed:

- Expected: DEC-100/TRD-012 target-inactive transitions suppress source helper snapshots and discard Section ISO transition roots at transition start.
- Observed: live helpers are suppressed, but an exit snapshot remains visible through the transition.

Severity/frequency: visible glitch / contract violation. Expected wherever an active source helper transitions to inactive target section state and `sceneSectionHelperExitSnapshotNeeded` returns true.

Suspected owner:

- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/SceneManager.ts`
- `src/scene/section/sceneSectionController.ts`

Coverage status:

- `scene-section-transition-behavior-source.test.mjs` supports immediate inactive target state.
- `scene-section-helper-transition-source.test.mjs` still asserts active-to-inactive helper exit snapshots.
- Contract and test disagree; resolve the decision before code work.

Relationship to already-landed fixes: not a DEC-164 or DEC-165 regression.

## SYN-002 - Authored MT slice and threshold pages settle with product groups hidden

Source report: `REPORT-agent-b-mt-phase1-20260613T132218.md` (`B-MT-002`).

Behavior family: MT slices, MT threshold surfaces, effective page visibility, product layer application.

Reproduction and evidence:

- Direct page-controller navigation to `43_resistivity_depth_elevation_slices` and `08_mt_threshold_surfaces`.
- Authored page state sets the relevant product layer visibility to `true`.
- Runtime evidence `mt-product-visibility-resolution.json` reports corresponding manager groups hidden after settled navigation.
- Full-density point cloud still renders and receives authored opacity, so the problem is not a total page navigation failure.

Expected vs observed:

- Expected: authored-visible MT product layers become visible after settled page application.
- Observed: slice and threshold product groups remain hidden after settle.

Severity/frequency: high for MT product pages. Deterministic in the sampled direct-index probes.

Suspected owner: reusable effective visibility application between page `visibilityOverrides`, effective layer state, and `SceneManager` group/material visibility synchronization.

Coverage status: no current synthetic app-health fixture catches this settled product visibility failure.

Relationship to already-landed fixes: not closed by protected full-density scalar path coverage.

## SYN-003 - Global Settings MT full-density baseline mismatch

Source report: `REPORT-agent-b-mt-phase1-20260613T132218.md` (`B-MT-001`).

Behavior family: MT full-density scalar cloud authoring baseline and source guard.

Reproduction and evidence:

- Command: `node --test tests/tools/mt-full-density-page-authoring-source.test.mjs tests/tools/mt-resistivity-legend-cloud-toggle-source.test.mjs tests/tools/mt-threshold-boundary-visibility-source.test.mjs`.
- Result: 11 pass, 1 fail.
- Failing assertion expected Global Settings MT full-density opacity `0.48`; current `projects/utah-forge/environment.json` carries `0.05`.
- Pages `156_page`, `157_page`, and `158_page` still carry `0.48`, and live `156_page -> 157_page` evidence preserved full-density opacity `0.48`.

Expected vs observed:

- Expected by source guard: Global Settings matches the intro-page full-density baseline.
- Observed: Global Settings baseline differs from page-authored baseline.

Severity/frequency: medium deterministic source-guard failure. No live page-transition breakage reproduced for the protected full-density path.

Suspected owner: authoring baseline contract or `tests/tools/mt-full-density-page-authoring-source.test.mjs`.

Coverage status: existing guard catches the mismatch, but the guard may mix deck baseline expectations with reusable runtime health.

## SYN-004 - MT threshold all-off guard/docs still assert superseded DEC-113 behavior

Source report: `REPORT-agent-b-mt-phase1-20260613T132218.md` (`B-MT-003`).

Behavior family: MT threshold boundary visibility authority, source guard, durable docs.

Reproduction and evidence:

- Runtime source implements DEC-145: explicit `visible` flags remain authoritative, including deliberate all-off maps.
- `tests/tools/mt-threshold-boundary-visibility-source.test.mjs` still asserts stale all-off-is-empty DEC-113 wording.
- `docs/dev-context/UI-Visual-Standards.md` still contains stale all-off fallback wording.
- The test passes because regexes match stale names/text, not the active DEC-145 contract.

Expected vs observed:

- Expected: tests/docs enforce DEC-145.
- Observed: tests/docs preserve superseded DEC-113 expectations.

Severity/frequency: high regression-risk gap. Deterministic on every guard/doc review.

Suspected owner:

- `tests/tools/mt-threshold-boundary-visibility-source.test.mjs`
- `docs/dev-context/UI-Visual-Standards.md`

Coverage status: runtime behavior appears aligned; guard/doc contract is stale.

## SYN-005 - Global Settings preview strips page product visibility during page-controller navigation

Source report: `REPORT-agent-c-seismic-entities-phase1-20260613T132218.md` (`C-SEIS-001`).

Behavior family: seismic products, boreholes, page-controller navigation, preview environment state.

Reproduction and evidence:

- Base URL: `http://127.0.0.1:5173/?project=utah-forge`.
- Representative page-controller navigation to indices `44`, `45`, `47`, `63`, and `168`.
- Settled readback showed product layer groups hidden while selected/visible product metadata existed.
- Evidence artifacts: `live-runtime-diagnostics.json` and `settled-layer-visibility-summary.json`.

Expected vs observed:

- Expected: live diagnosis at base URL renders target product families for page evidence or explicitly marks preview-stripped state.
- Observed: Global Settings preview stripping makes page-controller product visibility evidence unreliable and may leave product families hidden.

Severity/frequency: diagnosis blocker and possible visible authoring-mode defect. Reproduced on sampled product-navigation targets under `previewEnvironmentBase`.

Suspected owner:

- `src/editor/EditorChrome.tsx`
- `src/pages/PageController.tsx`
- `src/scene/SceneManager.ts`

Coverage status: no focused guard covers `previewEnvironmentBase` plus page-controller transition navigation.

## SYN-006 - Seismic sections and volumes are planned as `seismic-entity` operations but not materialized by exact-key opacity executor

Source report: `REPORT-agent-c-seismic-entities-phase1-20260613T132218.md` (`C-SEIS-002`).

Behavior family: seismic sections, seismic volumes, product opacity composition, exact entity execution migration.

Reproduction and evidence:

- `transitionExecutionPlan.ts` maps seismic representations to `seismic-entity`.
- `transitionEffectiveLayersForPage.ts` builds object entity keys for seismic section/volume graph objects.
- `seismicGraphTransitionExecutor.ts` materializes only `survey-geometry` and `figure-annotation`.
- Section, volume, comparison, and unknown object kinds are skipped.

Expected vs observed:

- Expected: planned `seismic-entity` operations either materialize through a registered executor or declare a tested legacy owner.
- Observed: section/volume operations are planned into the bucket but skipped by the current executor.

Severity/frequency: open migration gap and visible glitch risk. No live product-geometry snap was reproduced because SYN-005 kept sampled products hidden.

Suspected owner:

- `src/scene/transitions/seismicGraphTransitionExecutor.ts`
- `src/loaders/loadSeismicBrowser.ts`
- `src/scene/transitions/transitionExecutionPlan.ts`

Coverage status: current tests cover survey geometry and figure annotations, not section/volume materialization or explicit legacy ownership.

## SYN-007 - Borehole, point-cloud, and point-marker families lack object-level exact transition keys

Source report: `REPORT-agent-c-seismic-entities-phase1-20260613T132218.md` (`C-SEIS-003`).

Behavior family: boreholes, point clouds, point markers, product opacity composition, entity identity.

Reproduction and evidence:

- Targeted loader searches found no `transitionEntityKey`, `transitionRepresentationKey`, or `transitionObjectKind` assignments in borehole and point-cloud loaders.
- Live readback found demo boreholes, borehole logs, and full-density point clouds without exact transition tags.

Expected vs observed:

- Expected: families needing object-level continuity expose stable exact keys, or layer-level ownership is explicitly declared and guarded.
- Observed: exact keys are absent, and layer-level ownership is not encoded as a durable transition contract for these families.

Severity/frequency: migration/test-net gap. No object-level visual defect reproduced in this scope.

Suspected owner: loader tagging and product-family transition ownership tests.

Coverage status: borehole runtime source test passed, but exact-key identity coverage is missing.

## SYN-008 - Geophysics figure legend source command fails one MT figure-model assertion

Source report: `REPORT-agent-c-seismic-entities-phase1-20260613T132218.md` (`C-SEIS-004`).

Behavior family: figure annotations and legend/source test net.

Reproduction and evidence:

- Command: `node --test tests/tools/seismic-section-display-texture-source.test.mjs tests/tools/seismic-hidden-product-load-guard-source.test.mjs tests/tools/geophysics-figure-legend-source.test.mjs`.
- Result: 6 pass, 1 fail.
- Failing subtest: `MT resistivity legend renders slice figure metadata from static slice product extents`.
- Failure expected `/buildMtResistivityFigureModel/` in `src/ui/ResistivityLegend.tsx`.

Expected vs observed:

- Expected: required source guard command exits cleanly.
- Observed: MT resistivity figure model assertion fails.

Severity/frequency: medium test-net failure, likely separate from seismic execution-layer migration.

Suspected owner: MT resistivity legend source guard or `src/ui/ResistivityLegend.tsx` model wiring.

Coverage status: direct failing guard exists.

## SYN-009 - MT transition test net lacks product-level synthetic coverage

Source report: `REPORT-agent-b-mt-phase1-20260613T132218.md` (`B-MT-004`).

Behavior family: MT volume, slices, threshold surfaces, product identity, object readiness.

Evidence:

- Current tests cover generic render graph behavior, seismic derived entities, Section ISO guards, and full-density scalar path.
- No synthetic test asserts manager group visibility, product object readiness, or material opacity for MT volume/slices/threshold transitions.
- Live deck samples are useful evidence but cannot substitute for app-health proof.

Severity/frequency: medium-high hardening gap affecting future MT product transition work.

Suspected owner: transition render graph adapter tests and MT product transition source guards.

# Method Risk

## RISK-001 - Coordinator matrix trace density is insufficient for visual-smoothing claims

Source: coordinator matrix core analysis.

Evidence:

- Matrix core cases: `scene-section-frame-change` and `rapid-interruption-feature-handoff`.
- Trace replay completed; cases `2`; unexpected console `0`; expected ReadPixels warnings `4`.
- Smoothness trace quality risk count `2`; long active trace gap diagnostics count `11`.
- Max active gaps reached `966.6ms` and `1133.4ms` in the two core cases.

Interpretation:

- This is an evidence-quality and performance investigation risk, not a standalone transition semantics defect.
- No camera path risk, interruption divergence, policy mismatch, late reapply during transition, or unresolved opacity jump was reported in this matrix.

Next evidence step: capture denser smoothness/video evidence before any visual smoothing changes.

# Clean List

- Page-agnostic transition source guard passed: 3/3 subtests.
- DEC-164 per-frame scene-section partition passed source tests and live evidence. Surviving X frame moved while toggled Y frame dissolved in Agent A evidence.
- DEC-165 helper orientation passed source tests and live settled Y-helper determinant/bounds evidence.
- Helper rebuild stability held in sampled transitions: live frames reported `helperRebuildMs: 0`.
- Section ISO opacity mismatch was not reproduced. Source guard passed; sampled matrix reported `sectionIsoRenderOpacityMismatch: 0`.
- Protected MT full-density scalar transition path did not reproduce a live transition defect for `156_page -> 157_page`.
- MT Log10/All Valid local slider source contract passed; final persistence remains scoped to `scalarLegendVisible` plus `scalarInclusionMode`.
- Exact-key seismic survey geometry and figure annotation opacity path passed required tests and source review.
- Hidden seismic product load guard passed.
- Environment-scene background/fog owner passed source and live frame evidence.
- Dynamic camera orbit clamp passed source and live finite-pose evidence.
- Legend landed gate passed source guard and live consumer-policy evidence.
- Commit gate passed; live samples showed one final commit and later duplicate suppression with visible delta count `0`.
- Interruption/replan lineage passed live readback; canceled run id carried into replacement run.
- Late reapply during sampled transitions remained `0`.
- Coordinator matrix core reported no policy mismatches, no matrix capture failures, no run/source target divergences, no unexpected console warnings/errors, and no active-transition late reapply.

# Recommendation

Harden incrementally.

Ordered hardening path:

1. Resolve the active-to-inactive scene-section helper contract before code work. Either remove inactive-target helper exit snapshots or record a new decision that explicitly supersedes DEC-100/TRD-012 for a narrow helper-exit exception. Add a guard that checks no section style tween, no Section ISO transition, and no source helper snapshot for inactive targets.
2. Fix reusable effective visibility application for authored-visible MT slice and threshold product groups. Add synthetic app-health fixtures that avoid Utah page ids/titles/order and assert settled group visibility plus material opacity.
3. Resolve Global Settings MT full-density baseline policy. Either restore the intended baseline or narrow the guard to page-authored baseline behavior.
4. Update MT threshold boundary guard/docs to DEC-145 and remove stale DEC-113 all-off fallback expectations.
5. Add `previewEnvironmentBase` plus page-controller navigation coverage. Diagnostics should distinguish preview-stripped graphs from product render evidence, or target page visibility should be preserved for visual navigation.
6. Complete or explicitly declare seismic section/volume ownership. `seismic:2d-section-line` and `seismic:3d-volume` operations should materialize through an executor or carry a guarded legacy owner.
7. Decide object-level ownership for borehole, point-cloud, and point-marker families. Add exact keys if per-object continuity is required; otherwise encode layer-level ownership in tests and diagnostics.
8. Resolve the geophysics figure legend source failure separately from transition execution-layer work.
9. Add missing synthetic coverage: MT product transitions, populated Section ISO roots, working-area focus, loaded scene-overlay handles, readiness/attach, and product-level transition debug coverage.
10. Capture denser smoothness/video evidence only after semantic ownership defects are addressed.

Rewrite threshold result:

- Threshold not met. Open items map to narrow owners and missing guards. No current evidence proves the existing render-graph/executor architecture is insufficient.

# Verification And Method Notes

Coordinator commands:

```powershell
git status --short
node -e "await import('./tests/tools/transition-page-agnostic-source.test.mjs')"
node --test tests/tools/scene-section-frame-partition-source.test.mjs tests/tools/scene-section-frame-orientation-source.test.mjs
node --test tests/tools/transition-render-graph-adapter.test.mjs tests/tools/transition-execution-plan.test.mjs tests/tools/transition-entity-opacity-executor.test.mjs
node --test tests/tools/legend-authoring-gate.test.mjs tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs
npx tsc --noEmit --pretty false
node tools/validate-project-pages.mjs
npm run check:workspace
```

Coordinator results:

- Page-agnostic guard: pass, 3/3.
- DEC-164/DEC-165 guard batch: pass, 13/13.
- Transition render graph / execution plan / entity opacity batch: pass, 35/35.
- Legend gate / dynamic camera clamp batch: pass, 11/11.
- Typecheck: exit code 0.
- Project page validation: `Project page wiring OK`.
- Workspace guard: exit code 0; reported pre-existing tracked/untracked local sketch state and passed editor control manifest guard.

Coordinator matrix:

```powershell
$env:TRANSITION_MATRIX_VIDEO='0'
$env:TRANSITION_MATRIX_CASES='scene-section-frame-change,rapid-interruption-feature-handoff'
$env:TRANSITION_MATRIX_OUT='C:\GeoSee\GeoSee_Dev\Transition Architecture\Phase_1_Diagnosis\evidence-coordinator-matrix-core-20260613T132218'
node tools/capture-transition-matrix.mjs
node tools/analyze-transition-matrix.mjs --manifest 'C:\GeoSee\GeoSee_Dev\Transition Architecture\Phase_1_Diagnosis\evidence-coordinator-matrix-core-20260613T132218\manifest.json' --write
```

Coordinator matrix result:

- Capture: complete, 2 cases.
- Analysis: complete, wrote `transition-analysis.md` and `transition-analysis.json`.
- Console: 4 expected Chromium ReadPixels warnings, 0 unexpected console warnings/errors.

Incomplete broad matrix note:

- Initial broad matrix capture exceeded the 10-minute command limit and left partial case directories under `evidence-coordinator-matrix-20260613T132218` without a manifest. The stale `tools/capture-transition-matrix.mjs` process was stopped by exact process id. This partial folder is not used as evidence.

Agent reports:

- `REPORT-agent-a-scene-section-phase1-20260613T132218.md`
- `REPORT-agent-b-mt-phase1-20260613T132218.md`
- `REPORT-agent-c-seismic-entities-phase1-20260613T132218.md`
- `REPORT-agent-d-camera-env-commit-phase1-20260613T132218.md`

Evidence directories:

- `evidence-agent-a-scene-section-20260613T132218/`
- `evidence-agent-b-mt-20260613T132218/`
- `evidence-agent-c-seismic-20260613T132218/`
- `evidence-agent-d-camera-env-20260613T132218/`
- `evidence-coordinator-matrix-core-20260613T132218/`

Working tree scope:

- Pre-existing dirty Utah FORGE page/project files, `src/pages/dynamicCameraPose.ts`, and untracked `tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs` existed before this pass.
- Diagnosis writes were limited to `Transition Architecture/Phase_1_Diagnosis/`.
- No staging, commits, source edits, runtime edits, page edits, or project JSON edits were performed.
