# Phase 1 Transition Defect Inventory - Agent B MT Scope

## 1. Report ID

PHASE1-B-MT-20260613T132218

Date: 2026-06-13  
Repo: `C:\GeoSee\GeoSee_Dev`  
Base URL: `http://127.0.0.1:5173/?project=utah-forge`  
Evidence directory: `Transition Architecture\Phase_1_Diagnosis\evidence-agent-b-mt-20260613T132218`

Scope: MT scalar cloud, MT full-density protected path, MT volume, threshold surfaces, slices, Log10/All Valid local slider reference path, and MT transition test-net gaps.

## 2. Summary verdict

Defect count by family:

- Full-density MT scalar cloud authoring baseline: 1 open deck/source-guard mismatch.
- MT product layer settled visibility: 1 open runtime/deck-state defect affecting authored slice and threshold product pages.
- Threshold boundary visibility contract: 1 open test/doc drift gap, with runtime source already aligned to DEC-145.
- MT transition test net: 1 open coverage gap for MT volume, slices, threshold surfaces, and product/object identity.

Harden-vs-rewrite call: harden. Current evidence points to targeted visibility, contract, and test-net gaps rather than a transition architecture rewrite. The protected full-density scalar path, source-level Section ISO transition guards, and local Log10/All Valid slider contract are already guarded. The open product visibility defect should be fixed in reusable page/effective-layer application, not by editing page pairs.

Visual status: ready for visual check. Headless runtime/object inspection was performed, but no human visual acceptance pass occurred.

## 3. Defect inventory

### B-MT-001 - Global Settings MT full-density baseline mismatch

Behavior family: MT scalar cloud / full-density protected path / deck-state authoring guard.

Reproduction:

1. Run `node --test tests/tools/mt-full-density-page-authoring-source.test.mjs tests/tools/mt-resistivity-legend-cloud-toggle-source.test.mjs tests/tools/mt-threshold-boundary-visibility-source.test.mjs`.
2. Observe failure in `Global Settings keeps the MT full-density point cloud page baseline`.
3. Read `projects/utah-forge/environment.json` full-density layer style and compare with pages `156_page`, `157_page`, and `158_page`.

Evidence:

- Test failure: `tests/tools/mt-full-density-page-authoring-source.test.mjs:28` expected opacity `0.48`, actual opacity `0.05`.
- Source guard expectation: `tests/tools/mt-full-density-page-authoring-source.test.mjs:10`, `:24`, `:28`, `:41`, `:50`.
- Targeted project readback: environment full-density style has `opacity: 0.05`, `scalarLegendVisible: true`, `scalarInclusionMode: "all-valid"`, while pages `156_page`, `157_page`, and `158_page` carry `opacity: 0.48`.
- Live runtime at page `156_page` rendered full-density tiles with `PointsMaterial`, opacity `0.48`, and `BufferGeometry` tile position count `100000`.

Expected vs observed:

- Expected by source guard: Global Settings keeps the same page-baseline full-density opacity as the first authored intro pages.
- Observed: Global Settings/environment baseline is lower opacity (`0.05`), while pages still render the protected intro cloud at `0.48`.

Severity/frequency:

- Severity: medium.
- Frequency: deterministic source-guard failure on every run of the MT full-density authoring guard.
- Runtime page-transition breakage was not reproduced for `156_page -> 157_page`.

Suspected owner:

- Project authoring baseline and the source guard contract in `tests/tools/mt-full-density-page-authoring-source.test.mjs`.
- Not a transition runtime code owner based on current evidence.

Test coverage:

- Existing guard catches the mismatch.
- Coverage is deck-state/source-contract coverage, not reusable app-health proof.

Closed/open relationship to current-cycle fixes:

- Open deck/source-guard mismatch.
- Protected runtime path remains functionally covered by current-cycle source and live evidence.

### B-MT-002 - Authored MT slice and threshold pages settle with product groups hidden

Behavior family: MT volume/slices/threshold surfaces / effective page visibility / reusable layer application.

Reproduction:

1. Load `http://127.0.0.1:5173/?project=utah-forge`.
2. Use `window.__pageController.goto(39)` for `43_resistivity_depth_elevation_slices`, `goto(36)` for `08_mt_threshold_surfaces`, or `goto(27)` for hidden deck page `45_resistivity_isosurfaces`.
3. Wait until `window.__pageController.getState().isTransitioning === false` and `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager.getTransitionDebugState().active === false`.
4. Inspect MT layer group visibility through the scene manager.

Evidence:

- `projects/utah-forge/pages/43_resistivity_depth_elevation_slices.json:44-58` authors `utah-forge-mt-resistivity-slices: true`.
- `projects/utah-forge/pages/43_resistivity_depth_elevation_slices.json:70-84` authors slice opacity and individual slice visibility.
- Runtime evidence artifact `mt-product-visibility-resolution.json` settled page index `39` with page id `43_resistivity_depth_elevation_slices`, but manager group `utah-forge-mt-resistivity-slices` had `visible: false`; sampled slice meshes had `visible: false` and material opacity `0`.
- `projects/utah-forge/pages/08_mt_threshold_surfaces.json:27-34` authors `utah-forge-mt-resistivity-threshold-surfaces: true`.
- `projects/utah-forge/pages/08_mt_threshold_surfaces.json:39-56` authors threshold surface visibility, opacity `0.82`, product id, side, normals, and material controls.
- Runtime evidence artifact `mt-product-visibility-resolution.json` settled page index `36` with page id `08_mt_threshold_surfaces`, but manager group `utah-forge-mt-resistivity-threshold-surfaces` had `visible: false`.
- Transition matrix artifact `runtime-mt-diagnostics.json` showed `42_resistivity_volume_overview -> 43_resistivity_depth_elevation_slices` and `43_resistivity_depth_elevation_slices -> 45_resistivity_isosurfaces` settling successfully, but product-family traces classified MT volume and threshold layers as `state-source-only` hidden product state. Scalar tween count stayed `0`, layer tween count stayed `1`, snapshot count stayed `0`.
- Page `45_resistivity_isosurfaces` is hidden in authored deck state, so that page is supporting evidence only. Non-hidden pages `43_resistivity_depth_elevation_slices` and `08_mt_threshold_surfaces` are the primary evidence.

Expected vs observed:

- Expected: product layers authored visible by page state become visible as layer groups after settled navigation, and their product object/material states become visible according to page overrides.
- Observed: authored-visible slice and threshold groups remain hidden at the manager group layer. Full-density point cloud remains visible and receives authored opacity changes, which indicates the failure is not a total page navigation failure.

Severity/frequency:

- Severity: high for MT product pages. Product-authored slices and threshold surfaces fail to appear after settled direct navigation in headless runtime inspection.
- Frequency: deterministic in the direct-index probe for the sampled non-hidden pages.

Suspected owner:

- Reusable effective visibility application for MT non-pointcloud product layer groups, likely between page `visibilityOverrides`, effective layer state, and `SceneManager` group/material visibility synchronization.
- Transition assignment may also need product-level representation hardening, but the settled-state defect is visible outside active transition.
- Page fixture edits are not an appropriate owner because the inspected pages already author the target product layer visibility.

Test coverage:

- Existing tests did not catch this settled product visibility failure.
- Needed coverage: synthetic app-health fixtures for MT slice and threshold product visibility after page apply, plus transition samples that assert manager group visibility and product material opacity for authored-visible MT product layers.

Closed/open relationship to current-cycle fixes:

- Open runtime/deck-state defect.
- Related to current-cycle transition visibility hardening but not closed by full-density scalar protections.

### B-MT-003 - Threshold boundary all-off guard still asserts superseded DEC-113 behavior

Behavior family: threshold surfaces / boundary visibility authority / test-net and doc contract drift.

Reproduction:

1. Inspect `src/projectModules/utahForge/mtSurfaceBoundaries.ts`.
2. Inspect `tests/tools/mt-threshold-boundary-visibility-source.test.mjs`.
3. Inspect `docs/dev-context/UI-Visual-Standards.md`.
4. Run the MT source guard set.

Evidence:

- Runtime source now documents and implements DEC-145 behavior: any explicit canonical or legacy `visible` boolean is authoritative, including all-off maps; only maps with no explicit flags inherit defaults. See `src/projectModules/utahForge/mtSurfaceBoundaries.ts:229-276`.
- Test title still says all-off maps are empty visibility state at `tests/tools/mt-threshold-boundary-visibility-source.test.mjs:17`.
- Test assertion text still expects all-off maps to fall back to defaults at `tests/tools/mt-threshold-boundary-visibility-source.test.mjs:30-31`.
- Test still searches for DEC-113 at `tests/tools/mt-threshold-boundary-visibility-source.test.mjs:43-44`.
- UI standards still say all-off maps are empty/stale and inherit default visibility at `docs/dev-context/UI-Visual-Standards.md:283-286`.
- The test currently passes because regexes match stale variable names and stale docs rather than the active DEC-145 contract.

Expected vs observed:

- Expected: tests and durable docs enforce DEC-145, where explicit all-off maps remain authoritative.
- Observed: the guard passes while asserting the superseded DEC-113 text path.

Severity/frequency:

- Severity: high as a regression-risk gap.
- Frequency: every run of the threshold boundary source guard.

Suspected owner:

- `tests/tools/mt-threshold-boundary-visibility-source.test.mjs`.
- `docs/dev-context/UI-Visual-Standards.md` stale MT threshold entry.

Test coverage:

- Runtime source path is implemented.
- Test coverage is misleading and should be rewritten to assert DEC-145 directly.

Closed/open relationship to current-cycle fixes:

- Runtime/source behavior appears closed by DEC-145 implementation.
- Test/doc contract remains open.

### B-MT-004 - MT transition test net lacks product-level synthetic coverage

Behavior family: MT transition test-net gaps / volume, slices, threshold surfaces / product identity and object readiness.

Reproduction:

1. Inspect render graph adapter and effective-layer transition source.
2. Run `node --test tests/tools/section-iso-transition-source.test.mjs tests/tools/transition-render-graph-adapter.test.mjs`.
3. Compare existing test scope with live MT product page evidence.

Evidence:

- `transitionEffectiveLayersForPage.ts` builds derived entities for scene sections at `src/scene/transitions/transitionEffectiveLayersForPage.ts:293` and seismic graph entities at `:555`; there is no equivalent MT product-derived entity adapter for slice ids, threshold surface ids, MT volume product ids, or top/contact surfaces.
- Product transition classification treats selected MT volume product id and selected threshold product/boundary controls as discrete product fields in `src/scene/transitions/transitionStyles.ts:523-535`.
- Section-affected layer ids include MT volume, slices, threshold surfaces, top surface, and top contact in `src/scene/transitions/transitionStyles.ts:440`.
- Source-level tests passed, but no current synthetic test asserts manager group visibility, product object readiness, or product material opacity for MT volume/slices/threshold transitions.
- Live deck samples are useful deck-state evidence only and cannot substitute for app-health proof.

Expected vs observed:

- Expected: MT product transitions have synthetic coverage independent of live Utah page ids and page order.
- Observed: current coverage proves generic render graph behavior, seismic derived entities, Section ISO guards, and full-density scalar path, but not non-full-density MT product object assignment or settled visibility.

Severity/frequency:

- Severity: medium-high as a hardening gap.
- Frequency: affects all MT product-layer transition work until synthetic coverage exists.

Suspected owner:

- Transition render graph adapter tests and MT product transition source guards.
- If B-MT-002 resolves in runtime source, the same fixture should become a regression guard.

Test coverage:

- Open gap.

Closed/open relationship to current-cycle fixes:

- Open future-proofing gap.
- Current-cycle full-density and Section ISO fixes do not close this class.

## 4. Clean list

- MT full-density protected transition path did not reproduce a live transition defect for `156_page -> 157_page`. Runtime samples preserved the point cloud at opacity `0.48`; scalar tween count stayed `0`, snapshot count stayed `0`, and the transition settled cleanly.
- `tests/tools/mt-resistivity-legend-cloud-toggle-source.test.mjs` passed.
- Local Log10/All Valid slider reference path is source-healthy: `ResistivityLegend.tsx` uses a 1500 ms local transition (`src/ui/ResistivityLegend.tsx:39`), scoped RAF state (`:595-624`), scope-key cancellation (`:670-685`), unmount cancellation (`:691-696`), landed-write gating (`:655`), and final persistence limited to `scalarLegendVisible` plus `scalarInclusionMode` (`:997-1003`).
- Section ISO and render graph source checks passed: `section-iso-transition-source.test.mjs` and `transition-render-graph-adapter.test.mjs`.
- Boundary visibility resolver source implements DEC-145 despite stale test/doc text.
- Startup/runtime health in the primary Playwright probe had no page errors, request failures, bad HTTP responses, console warnings, or console errors. The supplemental direct-index probe emitted expected Chromium `ReadPixels` performance warnings only.
- MT volume page `42_resistivity_volume_overview` currently authors the full-density point cloud on and MT volume off. That page is not evidence of a volume-layer visibility failure by itself, despite its title. Non-full-density product failure evidence comes from authored-visible slice and threshold pages.

## 5. Already-landed verification

Protected MT scalar path:

- `transitionEffectiveLayersForPage.ts` explicitly supports `full-density-scalar` transition kind and full-density scalar-style tween routing at `src/scene/transitions/transitionEffectiveLayersForPage.ts:1219-1251`.
- `SceneManager.applySettledMtCellPointsTargetStyle` exists at `src/scene/SceneManager.ts:3068` and is called after page application at `:3037` and `:3055`.
- Live page `156_page -> 157_page` samples kept full-density policy as preserve, with opacity `0.48 -> 0.48`.

Isolines on page clock:

- `SCALAR_TRANSITION_STYLE_FIELDS` includes Section ISO and scalar range fields at `src/scene/transitions/transitionStyles.ts:224-244`.
- `layerTweenRuntime.ts` interpolates scalar style per frame and applies scalar fields through `interpolatedScalarStyle`.
- `SceneManager.updateMtVolumeCutIsoOverlays` is present at `src/scene/SceneManager.ts:3585-3592`.
- `node --test tests/tools/section-iso-transition-source.test.mjs tests/tools/transition-render-graph-adapter.test.mjs` passed.

Local slider contract:

- `ResistivityLegend.tsx` uses local app-level transition timing and cancellation, not page fixtures.
- Source guard `mt-resistivity-legend-cloud-toggle-source.test.mjs` passed.

Boundary visibility authority:

- DEC-145 source behavior is implemented in `src/projectModules/utahForge/mtSurfaceBoundaries.ts:229-276`.
- Explicit `visible` flags remain authoritative, including deliberate all-off maps.

## 6. Recommendation and test-net gaps

Recommendation:

- Harden in place. No transition-runtime rewrite is warranted by this evidence.
- Fix B-MT-002 first in reusable runtime/effective-state code. The fix should make authored-visible MT slice and threshold groups visible after settled page application, while preserving full-density scalar protections.
- After B-MT-002 is understood, add synthetic app-health fixtures that do not depend on live Utah page ids, titles, page order, or current deck state.
- Resolve B-MT-001 by deciding whether Global Settings is meant to match the intro page full-density baseline or whether the guard should be narrowed to page-authored baselines only.
- Update B-MT-003 tests/docs to DEC-145 and remove stale DEC-113 all-off expectations.

Test-net gaps:

- No synthetic fixture asserts settled visibility and material opacity for MT slice pages.
- No synthetic fixture asserts settled visibility and boundary-id selection for MT threshold surface pages.
- No synthetic fixture asserts MT volume product id, render mode, transfer mode, mask, density, and threshold changes across transitions.
- No render graph test models MT product-derived entities comparable to seismic graph derived entities.
- No test distinguishes live deck-state probes from app-health proof for MT product pages.
- Current Global Settings full-density guard mixes deck baseline expectations with reusable runtime health.

## 7. Method notes and exact commands

Read first:

- `Transition Architecture\Phase_1_Diagnosis\PROMPT-phase1-transition-defect-inventory.md`
- `CLAUDE.md`
- `docs/dev-context\Active-Build-Context.md`
- `docs/dev-context\Transition-Runtime-Operating-Spec.md`
- `docs/dev-context\Page-Transitions-And-Section-Frames.md`
- `docs/dev-context\Transition-Constitution.md`
- `docs/dev-context\Transition-Continuity-Contract.md`
- `docs/dev-context\Transition-Guardrails.md`
- `docs/dev-context\Runtime-Diagnostics.md`
- `docs/03-decisions.md` entries DEC-145, DEC-152, DEC-153, DEC-162, DEC-163, DEC-164, DEC-165.

Targeted source/test files inspected:

- `src/ui/ResistivityLegend.tsx`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/transitions/transitionStyles.ts`
- `src/scene/transitions/layerTweenRuntime.ts`
- `src/scene/SceneManager.ts`
- `src/projectModules/utahForge/mtSurfaceBoundaries.ts`
- `tests/tools/mt-full-density-page-authoring-source.test.mjs`
- `tests/tools/mt-resistivity-legend-cloud-toggle-source.test.mjs`
- `tests/tools/mt-threshold-boundary-visibility-source.test.mjs`
- `tests/tools/section-iso-transition-source.test.mjs`
- `tests/tools/transition-render-graph-adapter.test.mjs`
- Targeted page files for MT product pages under `projects/utah-forge/pages/`

Commands run:

```powershell
node --test tests/tools/mt-full-density-page-authoring-source.test.mjs tests/tools/mt-resistivity-legend-cloud-toggle-source.test.mjs tests/tools/mt-threshold-boundary-visibility-source.test.mjs
```

Result: failed, 11 passing tests and 1 failing test. Failure was `Global Settings keeps the MT full-density point cloud page baseline`, expected `0.48`, actual `0.05`.

```powershell
node --test tests/tools/section-iso-transition-source.test.mjs tests/tools/transition-render-graph-adapter.test.mjs
```

Result: passed, 13 passing tests.

```powershell
git status --short
```

Result: pre-existing dirty and untracked workspace state present outside this diagnosis report and evidence scope. No source, runtime, page, or project JSON changes were made.

```powershell
@'
<inline standalone Playwright runtime diagnostics script>
'@ | node -
```

Result: wrote `runtime-mt-diagnostics.json`. In-app Browser was attempted first and failed with a CDP `Runtime.evaluate` timeout followed by tab loss, so standalone Playwright was used as fallback.

```powershell
@'
<inline standalone Playwright direct-index MT product visibility script>
'@ | node -
```

Result: wrote `mt-product-visibility-resolution.json`. The first two drafts of this probe failed before valid evidence: one Node module syntax failure and one diagnostic serialization failure. The final run used captured deck indices directly and settled all sampled pages.

Render-stack fields captured from `runtime-mt-diagnostics.json`:

- `environment.scene`: background `#383838`, fog enabled, terrain material preset `image:naip-2024-aerial`.
- Sub Master `envSnapshot`: `null`.
- Environment render preset: `null`.
- Page render preset: `null`.
- Render preset `scenePatch`: `null`.
- Page `sceneOverrides`: `{ "lightMode": true }`.
- Active terrain texture URL/cache key: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`.
- Alternate active terrain texture key: `naip_2024_regional_4096.webp?v=71d894cdd3c0c64b`.
- Terrain bounds: `[229069.2, 4094688, 598806, 4414308]`.
- Public clip: enabled box, center `[21000, 21000, 2000]`, size `[1599600, 1399600, 50000]`, rotation `0`, preview `false`.
- Material edge fade: `edgeFadeDistanceM: 90000`.
- Edge outline: disabled.
- Full-density shader/material/geometry: `PointsMaterial`, opacity `0.48` on page `156_page`, tile `BufferGeometry` position count `100000`.
- MT volume shader/material/geometry: `ShaderMaterial`, `BoxGeometry`, position count `24`, index count `36`, raymarched scalar-volume uniforms including `uOpacity`, `uDisplayMin`, `uDisplayMax`, `uThresholdMin`, `uThresholdMax`, `uDensity`, `uMaskVisible`, and `uTransferMode`.
- Threshold surface material/geometry: `MeshStandardMaterial`, opacity `0.82` in sampled initial context, `BufferGeometry` examples with precomputed bank threshold metadata.
- Slice material/geometry: `MeshStandardMaterial`, sampled horizontal slice `BufferGeometry` position count `2671`, index count `10455`, material opacity `0` when hidden.

