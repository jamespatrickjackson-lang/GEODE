# Page Transition Fix Prep - 2026-05-30

Status: pre-fix preparation log plus instrumentation checkpoint. This file
records the concrete matrix, validation results, baseline captures, and
recommended product policies to use before modifying transition visuals.

Companion audit:
`docs/dev-context/Page-Transition-Orchestration-Audit-2026-05-30.md`.

## What Was Done

1. Built a representative Utah FORGE transition test matrix from live page order
   and page/layer content.
2. Ran lightweight project/runtime validation checks.
3. Captured pre-fix visual baselines in editor-visible mode.
4. Captured pre-fix visual baselines in presenter mode.
5. Recorded policy recommendations that should be decided or accepted before
   the first code fix.
6. Added the first instrumentation-only runtime change: PageController now
   exposes a `transitionRun` debug record for page, interruption, camera-focus,
   camera-pose, and camera-reset movement.
7. Added and ran a no-visual-change transition matrix probe that captures
   screenshots plus full transition debug JSON for the high-risk page pairs.

No smoothing, timing, or visual policy changes have been made yet.

## Validation Results

| Check | Result | Notes |
| --- | --- | --- |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `npm run check:runtime-assets` | PASS | Runtime asset wiring OK. |
| `npm run check:utah-derived` | PASS | Utah FORGE derived assets OK. |
| `npm run check:mt-resistivity` | PASS | MT resistivity full-source fidelity OK. |
| `npm run check:utah-snapshot` | FAIL | Current `projects/utah-forge/environment.json` default-visible layer state includes extra `utah-forge-mt-stations` and `terrain` compared with the snapshot expectation. This file was already dirty before this prep pass, so it was not changed here. |

Browser automation note:

- The Browser plugin is available in the session, but its required Node browser
  runtime tool was not exposed by tool discovery, so baseline capture used
  Playwright fallback.
- Sandbox blocked Playwright/Chromium launch and Vite/esbuild spawn, so those
  two operations were run with escalation.
- A stale junction-path Vite process was occupying `http://127.0.0.1:5173/`;
  it was stopped, and Vite was restarted from the real repo path at
  `http://127.0.0.1:5173/`.

## Baseline Artifacts

Editor-visible captures:

```text
test-results/transition-baselines-2026-05-30/
```

Presenter-mode captures:

```text
test-results/transition-baselines-2026-05-30-presenter/
```

Each folder contains:

- source, mid-transition, and end screenshots for five representative page
  pairs
- source, mid-transition, and end screenshots for one rapid interruption case
- `manifest.json` with URL, viewport, page indices, page ids, transition
  progress, and console warnings

Console/runtime notes from both baseline manifests:

- No app console errors were recorded.
- Chromium emitted repeated WebGL `ReadPixels` performance warnings during
  screenshot capture. These are expected screenshot/GPU readback warnings, not
  app transition errors.

Viewport:

```text
1280 x 900
```

## Transition Matrix Debug Probe

Command:

```text
npm run audit:transition-matrix
```

Final artifact set:

```text
test-results/transition-matrix-debug-2026-05-30T21-49-39-931Z/
```

Contents:

- `manifest.json`
- 6 matrix cases
- 19 PNG screenshots
- 20 JSON debug artifacts

Console/runtime notes:

- No app console errors were recorded.
- Chromium emitted 4 WebGL `ReadPixels` performance warnings while taking
  screenshots. These are screenshot/GPU readback warnings, not transition
  runtime errors.

Probe implementation:

- Added `tools/capture-transition-matrix.mjs`.
- Added `npm run audit:transition-matrix`.
- The probe reads `projects/utah-forge/project.json` for page ids, opens
  `/?project=utah-forge`, drives `window.__pageController.goto(...)`, and
  writes a screenshot plus full `window.__pageController.getState()` JSON for
  each captured phase.
- The interruption row issues first and final navigation in the same browser
  evaluation so it exercises the synchronous cancellation path before
  screenshot readback can settle the first transition.

Important findings from the probe:

- `transitionRun.rawProgress` / `transitionRun.easedProgress` must be treated
  as the canonical transition clock. `transitionProgress` can still read as
  `1` around the start of a new active run, which can make consumers or tests
  falsely believe a transition is complete.
- The same-frame interruption row now confirms the interruption path:
  `reason: "interrupted"`, `interruptedRunIds: ["page-9"]`, source page
  promoted to `06_mt_low_resistivity_seismic`, and target page
  `04_mt_high_resistivity_seismic`.
- In the interrupted capture, `currentPageId` can still be the pre-interruption
  page while `transitionRun.sourcePageId` is already the promoted source. This
  is valid under current code but is exactly why all visual consumers should
  read from the shared transition run rather than independently inferring page
  source/target state.
- Some mid screenshots land at or near `rawProgress: 1` for fast or
  screenshot-heavy rows (`01`, `02`, `05`). The JSON state is still useful, but
  screenshot review alone is not enough for fine-grained motion timing. If we
  need frame-level visual smoothness evidence, add a RAF-sampled trace or video
  probe before/after the visual fix.
- Late async reapply counters were stable in this run: `totalCount: 18`,
  `duringTransitionCount: 0` across the captured matrix.

Recommendations from this checkpoint:

- Use `transitionRun.rawProgress` / `transitionRun.easedProgress` as the
  authoritative clock for every transition consumer.
- Do not let presenter overlays, scene overlays, labels, assays, legends,
  layer fades, section helpers, or camera movement derive source/target state
  from separate page variables when a transition run is active.
- Preserve the same-frame interruption row as a regression test/probe; it is
  the clearest proof that cancellation, promoted source page, and consumer
  policy stay aligned.
- Add a frame-sampled probe only if the first visual fix still leaves motion
  defects that screenshots and debug JSON cannot explain.

## Captured Baseline Matrix

| ID | Page pair | Indices | Primary surfaces covered | Captures |
| --- | --- | ---: | --- | --- |
| 01 | `12_mt_volume_overview` -> `06_mt_low_resistivity_seismic` | 0 -> 1 | Full-density point cloud, MT volume, threshold surfaces, seismic context, dynamic camera, opacity envelope | editor + presenter source/mid/end |
| 02 | `42_resistivity_volume_overview` -> `43_resistivity_depth_elevation_slices` | 7 -> 8 | Scalar volume to 2D resistivity slices, scalar legend, transparency, page overlay | editor + presenter source/mid/end |
| 03 | `43_resistivity_depth_elevation_slices` -> `44_resistivity_cross_sections` | 8 -> 9 | Slice-to-section transition, section/crop/window translation risk, ISO line/band state | editor + presenter source/mid/end |
| 04 | `44_resistivity_cross_sections` -> `45_resistivity_isosurfaces` | 9 -> 10 | Section panels to MT isosurfaces, opacity handoff, legend/source mismatch risk | editor + presenter source/mid/end |
| 05 | `102_page` -> `103_page` | 22 -> 24 | Section-frame overlay pages, duplicate/unresolved pages, overlay source/target behavior | editor + presenter source/mid/end |
| 06 | `12_mt_volume_overview` -> `06_mt_low_resistivity_seismic` -> `04_mt_high_resistivity_seismic` | 0 -> 1 -> 2 | Rapid interruption, promoted source page risk, skipped old camera completion cleanup | editor + presenter source/mid/end |

## Additional Matrix Rows To Exercise During Fix Verification

These were not screenshot-captured in this prep pass but should be part of the
post-fix verification matrix.

| Page pair | Why it matters |
| --- | --- |
| `40_geophysics_product_overview` -> `41_mt_station_network_footprint` | Point-cloud visibility and MT station marker/lift changes. |
| `45_resistivity_isosurfaces` -> `51_mt_marching_cubes_focused` | Threshold surface product focus and boundary legend behavior. |
| `51_mt_marching_cubes_focused` -> `52_mt_marching_cubes_full_extent` | Focused-to-full-extent isosurface product switch and camera scale change. |
| `47_seismic_footprint_velocity_support` -> `49_seismic_fence_panels` | Seismic render mode/product behavior and section/fence panel handoff. |
| `99_unresolved_missing_tools` -> `101_page` -> `100_page` | Overlay-heavy duplicate pages and UI/page-source behavior. |
| Camera focus/reset without page change | Confirms camera-only tweens no longer look like page transitions. |
| Late-heavy-data navigation before all assets settle | Confirms async transition-aware reapply behavior. |

## Recommended Policy Defaults Before Fixing

These are the recommended defaults for the first fix pass unless product
direction overrides them.

### Interruption

Support interrupted transitions intentionally. The current code already allows
them, and users can trigger them through keyboard/runtime calls. The fix should
not pretend interruption is impossible.

Required behavior:

- every transition has a run id
- old runs receive explicit cancellation
- cleanup that must always happen is not tied only to camera completion
- all consumers share the same promoted source page after interruption

### Keyboard And Disabled Navigation

Keyboard and button navigation should follow the same interruption policy.

Recommended default:

- if interruption remains allowed, nav buttons should not imply navigation is
  unavailable
- if nav buttons remain disabled, keyboard should also block or clearly route
  through the same cancellation policy

### Scene Overlay Timing

Scene overlays should be registered consumers of the shared transition run.

Recommended default:

- use page duration/easing for normal page overlay state unless an overlay
  explicitly declares its own timing
- if an overlay keeps fixed 800 ms timing, expose that in transition debug

### Presenter Overlay Timing

Presenter overlay content should be tied to transition run id and page id.

Recommended default:

- source/target overlay content loads should be keyed by run id
- `gapMs` and `leadMs` should either affect runtime behavior or be hidden from
  authoring surfaces until implemented

### Labels And Assays

Scene-bound labels and assay markers should not use unexplained hard-coded page
source thresholds.

Recommended default:

- define a named policy: hold-source, crossfade, interpolate, or switch-at-phase
- replace the bare `transitionProgress >= 0.92` rule with that policy

### Page Scene Mood And Lighting

Scene-wide mood/light changes should not silently pop at transition start.

Recommended default:

- classify page-scene fields as interpolated, start-discrete, or end-discrete
- in the first instrumentation pass, expose the current behavior in debug before
  changing it visually

### Reduced Motion

Reduced motion is not currently applied consistently to presentation
transitions.

Recommended default:

- keep presentation transitions enabled for now
- make the policy explicit in docs/debug
- if reduced motion is later applied, resolve it once in the shared transition
  run and pass that timing to every consumer

### Product Transition Registry

Transition behavior should be declared per product family rather than inferred
from scattered style fields.

Recommended default registry families:

- simple mesh / line / polygon layers
- point clouds
- scalar volumes
- scalar slices
- MT threshold / isosurface products
- seismic raymarch volumes
- seismic sections / fence panels
- section ISO overlays
- scene section helper visuals
- scene overlays
- labels and assays

## First Fix Entry Point

The first code change should be instrumentation, not visual polish. This is now
started:

1. Add a `TransitionRun` debug model.
2. Keep existing visual behavior initially.
3. Record run id, source/target page ids, raw/eased progress, camera state,
   SceneManager transition counts, overlay state, label/legend page-source
   policy, interruption history, and late-load reapply events.
4. Re-run the captured matrix before changing transition visuals.

### Instrumentation Checkpoint

Implemented on 2026-05-30:

- `PageController` debug state now includes `transitionRun` and
  `lastTransitionRun`.
- Page transitions record `runId`, mode, status, source/target index,
  source/target page id, reason, start/completion/cancel timing, duration,
  easing, raw progress, eased progress, interruption ancestry, page-transition
  activity, dynamic-camera activity, and SceneManager transition debug state.
- Interrupted page navigation explicitly cancels the previous debug run and
  records its id in `interruptedRunIds`.
- Camera-only object focus, arbitrary pose tween, and reset tween paths now
  emit camera movement runs without changing their visual behavior.
- `transitionRun.consumerDebug` now records registered consumer behavior:
  presenter overlay crossfade/slide source and target, scene overlay fixed
  fade timing and handle counts, label/assay hold-source threshold policy,
  legend stack/resistivity/default policy, and late async reapply counters.
- `SceneManager.getTransitionDebugState()` now includes scene-overlay debug
  state and late reapply event history.

Verification:

| Check | Result | Notes |
| --- | --- | --- |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | Covers page run creation, shared source/target state, interruption ancestry, SceneManager debug linkage, consumer debug policies, and completed last run. |
| `npm run build` | PASS | TypeScript and production bundle succeeded. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `npm run audit:transition-matrix` | PASS | Captured 6 cases to `test-results/transition-matrix-debug-2026-05-30T21-49-39-931Z/`; no app console errors, 4 expected WebGL screenshot readback warnings. |

### First Implementation Checkpoint

Implemented on 2026-05-30 after the matrix probe:

- Added a shared `transitionFrame` selector to `PageController`.
- `transitionFrame` exposes active source/target indices, source/target page
  ids, eased progress, raw progress, reason, and run id.
- Active page runs now update `transitionRun.rawProgress` and
  `transitionRun.easedProgress` on each transition tick.
- Dev debug `transitionProgress` now comes from the active transition frame
  instead of a separate potentially stale progress source.
- `transitionRun.consumerDebug` now derives presenter overlay, labels, assays,
  and legend source/target/progress from the shared transition frame.
- Visible transition consumers now read from `transitionFrame` instead of
  independently combining `currentIndex`, `targetIndex`, and
  `transitionProgress`:
  - `OverlayDisplay`
  - `SceneLabels`
  - `AssayLegend`
  - `ResistivityLegend`
  - `MtSurfaceBoundaryLegend`
  - `SurfaceElevationLegend`
  - `SeismicVolumeLegend`
  - `SectionIsoLegend`
  - `SceneSectionLegend`

Regression added:

- The focused transition orchestration spec now fails if an interrupted run's
  presenter overlay, labels, or legends use the stale pre-interruption page as
  their source. The red failure showed `12_mt_volume_overview`; the green state
  now reports `06_mt_low_resistivity_seismic`.

Post-fix matrix artifact:

```text
test-results/transition-matrix-debug-2026-05-30T22-06-57-828Z/
```

Post-fix matrix result:

- 6 cases captured.
- No app console errors recorded.
- 4 expected Chromium WebGL `ReadPixels` screenshot warnings recorded.
- Same-frame interruption now reports aligned consumer state:
  `sourcePageId: 06_mt_low_resistivity_seismic`,
  `targetPageId: 04_mt_high_resistivity_seismic`,
  `reason: interrupted`, and a cancelled `interruptedRunIds` entry.

Verification after this checkpoint:

| Check | Result | Notes |
| --- | --- | --- |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript check after context/consumer changes. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | Confirms interrupted consumers use promoted transition source. |
| `npm run audit:transition-matrix` | PASS | Captured post-fix matrix to `test-results/transition-matrix-debug-2026-05-30T22-06-57-828Z/`. |
| `npm run build` | PASS | Production bundle succeeded after transition-frame routing. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | PASS | No whitespace errors; only expected CRLF normalization warnings. |

### Product-Family Registry Checkpoint

Implemented on 2026-05-30 after the shared transition-frame checkpoint:

- Added a debug-only product transition registry for the SceneManager run
  context.
- The registry classifies visible and authored product state into families:
  simple geometry, point markers, point clouds, scalar volumes, scalar slices,
  MT isosurfaces, seismic volumes, seismic sections, section ISO overlays, and
  scene section helpers.
- Each product-family decision records the semantic transition policy,
  transition kind, source/target visibility, source/target opacity, whether the
  layer was loaded at transition start, and whether the entry came from a loaded
  layer, authored page state, or scene-section helper state.
- The registry includes authored hidden state sources with
  `policy: "state-source-only"` so hidden seismic/product configuration changes
  are visible in the matrix before any visual smoothing changes.
- Rendering behavior is intentionally unchanged in this checkpoint; the
  product registry is exposed through debug state and transition-matrix JSON
  only.

Post-registry matrix artifact:

```text
test-results/transition-matrix-debug-2026-05-30T22-33-40-535Z/
```

Post-registry matrix result:

- 6 cases captured.
- No app console errors recorded.
- 4 expected Chromium WebGL `ReadPixels` screenshot warnings recorded.
- Product-family summaries now expose MT volume, threshold/isoline product
  state, seismic product state, point cloud state, and scene-section helper
  state across the captured matrix.

Verification after this checkpoint:

| Check | Result | Notes |
| --- | --- | --- |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript check after registry typing. |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Matrix tool syntax check. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | Focused spec now asserts product-family debug entries for scalar volume, MT isosurfaces, and seismic volume state. |
| `npm run audit:transition-matrix` | PASS | Captured post-registry matrix to `test-results/transition-matrix-debug-2026-05-30T22-33-40-535Z/`. |
| `npm run build` | PASS | Production bundle succeeded after registry changes. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | PASS | No whitespace errors; only expected CRLF normalization warnings. |

### Matrix Analyzer Checkpoint

Implemented on 2026-05-30 after the product-family registry checkpoint:

- Added `tools/analyze-transition-matrix.mjs`.
- Added `npm run audit:transition-report`.
- Added a focused Node regression test for analyzer divergence categories.
- Wrote report artifacts beside the latest matrix:

```text
test-results/transition-matrix-debug-2026-05-30T22-33-40-535Z/transition-analysis.md
test-results/transition-matrix-debug-2026-05-30T22-33-40-535Z/transition-analysis.json
```

Analyzer result for
`test-results/transition-matrix-debug-2026-05-30T22-33-40-535Z/`:

| Metric | Count |
| --- | ---: |
| productEntries | 167 |
| stateSourceOnly | 37 |
| loadedAtStartFalse | 4 |
| opacityJumps | 20 |
| policyMismatches | 0 |
| hiddenProductState | 33 |
| sectionIsoEntries | 0 |
| interruptionDivergences | 0 |
| lateReapplyDuringTransition | 0 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |

Key findings:

- No run/scene source-target divergence was found in the captured matrix.
- No policy/transitionKind mismatch was found.
- No unexpected app console errors were found; the only recorded warnings were
  the expected Chromium WebGL `ReadPixels` screenshot warnings.
- No previous matrix manifest is currently available on disk for automated
  diffing; earlier artifact paths are preserved in this log but not present
  under `test-results`.
- `state-source-only` entries are concentrated in hidden seismic and MT
  isosurface authored state.
- `loadedAtStart: false` currently points at authored scene-section helper
  state in the section-frame overlay case.
- The visible opacity-jump rows worth reviewing first are MT volume handoffs and
  scene-section helper on/off handoffs.

Analyzer recommendations:

1. Add transition-aware late-load reapply for authored product layers that are
   not loaded at run start.
2. Classify hidden seismic and MT isosurface authored state before changing
   visible handoff behavior.
3. Review visible opacity jumps by family and decide whether each should fade,
   crossfade, or remain discrete.

Verification after this checkpoint:

| Check | Result | Notes |
| --- | --- | --- |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Red/green analyzer regression; red state failed on missing analyzer module. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Syntax check passed. |
| `npm run audit:transition-report` | PASS | Report files were written; the tool session did not close cleanly, but no matching Node or PowerShell process remained afterward. |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript check after analyzer/script/log changes. |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Existing matrix capture tool syntax still clean. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | Focused transition orchestration regression still green. |
| `npm run build` | PASS | Production bundle succeeded after analyzer changes. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | PASS | No whitespace errors; only expected CRLF normalization warnings. |

Remaining before visual smoothing:

- Review the new product-family matrix JSON for `state-source-only` entries and
  loaded-at-start mismatches; those identify likely divergence points before
  visual smoothing.
- Consider adding RAF-sampled trace/video capture if screenshot timing remains
  too coarse for judging actual smoothness.

## Current Blocking/Residual Risks

- `npm run check:utah-snapshot` is failing against current working-tree data.
  Decide whether the changed default-visible layer set is intentional before
  using that snapshot check as a release gate.
- Baselines are headless Chromium screenshots. They are useful for comparison,
  but they are not a substitute for human review of motion smoothness.
- The captured mid-transition timing is approximate. It records actual
  `transitionProgress` in each manifest so later comparisons can account for
  slight timing variation.
- The app was served from `C:\GeoSee\GeoSee_Dev` rather than the junction path
  to avoid the Vite/junction module-load failure observed during this prep.

### Transition-Aware Late Reapply Checkpoint

Implemented on 2026-05-30 after the matrix analyzer checkpoint:

- Added transition-aware late async layer reapply while
  `SceneManager.activeSceneTransitionContext` is active.
- `reapplyCurrentPageState()` now records
  `transition-aware-current-page-state` when env/page state is available during
  an active run, including eased `transitionProgress`.
- The active-transition reapply path keeps the transition context intact, reapplies
  current target/interpolated styles to loaded layers, preserves scalar style
  tween progress, refreshes scene-section helper opacity, refreshes working-area
  focus, refreshes terrain-composite uniforms with transition-frame opacity
  overrides, then reapplies the transition visibility envelope.
- The fallback active-transition path remains `transition-envelope` only when
  no env/page state is available.

Red/green evidence:

- Added
  `tests/utah-forge/transition-orchestration.spec.ts` coverage for forcing
  `manager.reapplyCurrentPageState()` during the active
  `12_mt_volume_overview -> 06_mt_low_resistivity_seismic` page transition.
- RED result: the new test failed because the latest late reapply event still
  reported `transition-envelope` and had no `transitionProgress`.
- GREEN result: the focused test then passed with
  `transition-aware-current-page-state`, source/target page IDs preserved, and
  progress in `[0, 1]`.

Fresh matrix artifact after this pass:

```text
test-results/transition-matrix-debug-2026-05-30T23-07-46-901Z/
test-results/transition-matrix-debug-2026-05-30T23-07-46-901Z/transition-analysis.md
test-results/transition-matrix-debug-2026-05-30T23-07-46-901Z/transition-analysis.json
```

Analyzer result for
`test-results/transition-matrix-debug-2026-05-30T23-07-46-901Z/`:

| Metric | Count |
| --- | ---: |
| productEntries | 167 |
| stateSourceOnly | 37 |
| loadedAtStartFalse | 4 |
| opacityJumps | 20 |
| policyMismatches | 0 |
| hiddenProductState | 33 |
| sectionIsoEntries | 0 |
| interruptionDivergences | 0 |
| lateReapplyDuringTransition | 0 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |

Notes:

- The fresh matrix did not naturally trigger a late async reapply during an
  active transition, so `lateReapplyDuringTransition` remains `0`; the focused
  Playwright spec is the direct regression proof for this branch.
- No source/target divergence, policy mismatch, or unexpected app console error
  was introduced by this pass.
- The analyzer still prints the generic late-load recommendation because it keys
  off `loadedAtStart: false` entries and not yet off the focused synthetic
  reapply probe.

Verification after this checkpoint:

| Check | Result | Notes |
| --- | --- | --- |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1 --grep "Late async reapply"` | PASS | Focused red/green regression for active-transition reapply. |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript check after SceneManager/test change. |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Existing matrix capture tool syntax still clean. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | Shared-run/interruption and late-reapply specs both green. |
| `npm run audit:transition-matrix` | PASS | Captured fresh matrix to `test-results/transition-matrix-debug-2026-05-30T23-07-46-901Z/`. |
| `npm run audit:transition-report` | PASS | Wrote transition analysis beside the new matrix. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `npm run build` | PASS | Production bundle succeeded after the late-reapply change. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | PASS | No whitespace errors; only expected CRLF normalization warnings. |

Recommended next steps:

1. Add a synthetic transition-matrix probe or analyzer marker so the matrix
   artifact can explicitly record transition-aware late reapply coverage instead
   of relying only on the focused Playwright spec.
2. Classify hidden seismic and MT isosurface authored state (`state-source-only`)
   before changing visible behavior.
3. Review visible opacity jumps by family, starting with scene-section helper
   handoffs and MT volume opacity handoffs; decide per family whether each
   should fade, crossfade, interpolate, or remain discrete.

### Matrix Late-Reapply Probe Checkpoint

Implemented on 2026-05-30 after the transition-aware late reapply checkpoint:

- Added a synthetic late-reapply probe to the first transition-matrix case
  (`12_mt_volume_overview -> 06_mt_low_resistivity_seismic`).
- The probe now runs immediately after the page transition is active, before
  the mid-transition screenshot waits for its target progress, so it records
  the active-run branch reliably.
- Matrix state summaries now include late-reapply event details: action,
  source/target page IDs, reason, and transition progress.
- The analyzer now dedupes cumulative late-reapply events by event identity, so
  one event observed in later snapshots is reported once instead of being
  counted repeatedly.
- Analyzer recommendations now recognize that late-load reapply is covered by
  the matrix probe and keep the next guidance focused on the remaining
  `loadedAtStart: false` policy review.

Red/green evidence:

- RED 1: the analyzer test failed because `lateReapply.events` were not exposed
  in analysis rows or markdown.
- GREEN 1: event action/progress are now retained and rendered in the report.
- RED 2: the analyzer test failed because cumulative late-reapply counters were
  still counted as `2` instead of the single event in the test manifest.
- GREEN 2: late reapply is deduped to one event.
- RED 3: the analyzer test failed because the recommendation still said to add
  transition-aware late-load reapply after coverage was present.
- GREEN 3: the recommendation now says late-load reapply is covered by the
  matrix probe.

Fresh matrix artifact after this pass:

```text
test-results/transition-matrix-debug-2026-05-30T23-18-19-371Z/
test-results/transition-matrix-debug-2026-05-30T23-18-19-371Z/transition-analysis.md
test-results/transition-matrix-debug-2026-05-30T23-18-19-371Z/transition-analysis.json
```

Analyzer result for
`test-results/transition-matrix-debug-2026-05-30T23-18-19-371Z/`:

| Metric | Count |
| --- | ---: |
| productEntries | 167 |
| stateSourceOnly | 37 |
| loadedAtStartFalse | 4 |
| opacityJumps | 20 |
| policyMismatches | 0 |
| hiddenProductState | 33 |
| sectionIsoEntries | 0 |
| interruptionDivergences | 0 |
| lateReapplyDuringTransition | 1 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |

Late-reapply event captured:

```text
01/mid: transition-aware-current-page-state @ progress 0.994
source: 12_mt_volume_overview
target: 06_mt_low_resistivity_seismic
```

Notes:

- No source/target divergence, policy mismatch, or unexpected app console error
  was introduced by this pass.
- The synthetic probe fired late in the first transition on this machine
  (`0.994` eased progress). That is acceptable for branch coverage, but the next
  matrix refinement could lower the probe timing if we want a mid-run visual
  sample of the reapply branch.
- The latest matrix still has no previous manifest on disk for automated delta
  comparison; only the current artifact is present under `test-results`.

Verification after this checkpoint:

| Check | Result | Notes |
| --- | --- | --- |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Red/green for event detail, dedupe, and recommendation text. |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Passed outside sandbox after sandboxed `node --check` stalled. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Passed outside sandbox after sandboxed `node --check` stalled. |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript check still clean. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | Existing shared-run/interruption and late-reapply specs both green. |
| `npm run audit:transition-matrix` | PASS | Captured fresh matrix to `test-results/transition-matrix-debug-2026-05-30T23-18-19-371Z/`; first attempt failed because the probe ran after transition completion, then the probe was moved earlier and the rerun passed. |
| `npm run audit:transition-report` | PASS | Wrote deduped transition analysis beside the new matrix. |
| `npm run build` | PASS | Production bundle succeeded after tool/test changes. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | PASS | No whitespace errors; only expected CRLF normalization warnings. |

Recommended next steps:

1. Classify hidden seismic and MT isosurface authored state
   (`state-source-only`) before changing visible handoff behavior.
2. Review the remaining `loadedAtStart: false` scene-section helper entries and
   decide whether they need a family-specific late-load policy or only debug
   classification.
3. Review visible opacity jumps by family, starting with scene-section helper
   handoffs and MT volume handoffs.

### Hidden State And Unloaded Helper Classification Checkpoint

Implemented on 2026-05-30 after the matrix late-reapply probe checkpoint:

- Classified hidden seismic and MT isosurface `state-source-only` entries in
  the analyzer.
- Classified `loadedAtStart: false` scene-section helper entries in the
  analyzer.
- Added analyzer counts for hidden dormant/unresolved state and unloaded
  dormant/unresolved helper state.
- Added classification and visual-policy labels to the affected report rows.
- Rendering behavior is unchanged in this checkpoint; this is debug/report
  metadata only.

Classification decisions:

- Hidden seismic/MT authored state is
  `intentional-dormant-authored-state` with
  `visualPolicy=preserve-hidden-no-interpolation` when source and target are
  both hidden, opacities are zero, and transition kind is `none`.
- Unloaded scene-section helper authored state is
  `debug-only-unloaded-helper-state` with
  `visualPolicy=preserve-hidden-helper-state-no-load` when the helper is hidden
  at both ends and no helper needs to be loaded for the transition frame.
- Any future hidden/unloaded entry with visible opacity, visible endpoints, or
  active transition metadata will be classified as unresolved before visual
  smoothing proceeds.

Red/green evidence:

- RED 1: the analyzer test failed because hidden dormant/unresolved counts and
  hidden-state classification labels were absent.
- GREEN 1: hidden seismic/MT rows now carry classification, visual policy, risk,
  and reason.
- RED 2: the analyzer test failed because `loadedAtStart: false` scene-section
  helper rows did not carry a helper-specific classification.
- GREEN 2: unloaded helper rows now carry classification, visual policy, risk,
  and reason.

Fresh matrix artifact after this pass:

```text
test-results/transition-matrix-debug-2026-05-30T23-39-41-026Z/
test-results/transition-matrix-debug-2026-05-30T23-39-41-026Z/transition-analysis.md
test-results/transition-matrix-debug-2026-05-30T23-39-41-026Z/transition-analysis.json
```

Analyzer result for
`test-results/transition-matrix-debug-2026-05-30T23-39-41-026Z/`:

| Metric | Count |
| --- | ---: |
| productEntries | 167 |
| stateSourceOnly | 37 |
| loadedAtStartFalse | 4 |
| unloadedDormantHelperState | 4 |
| unloadedUnresolvedState | 0 |
| opacityJumps | 20 |
| policyMismatches | 0 |
| hiddenProductState | 33 |
| hiddenDormantState | 33 |
| hiddenUnresolvedState | 0 |
| sectionIsoEntries | 0 |
| interruptionDivergences | 0 |
| lateReapplyDuringTransition | 1 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |

Key report rows:

```text
Hidden seismic / MT:
01/mid utah-forge-phase3-seismic-browser -> intentional-dormant-authored-state
01/mid utah-forge-mt-resistivity-threshold-surfaces -> intentional-dormant-authored-state

Loaded-at-start false:
05/source utah-forge-scene-section-planes -> debug-only-unloaded-helper-state

Late reapply:
01/mid transition-aware-current-page-state @ progress 0.980
```

Notes:

- No unresolved hidden seismic/MT entries remain.
- No unresolved `loadedAtStart: false` entries remain.
- No source/target divergence, policy mismatch, or unexpected app console error
  was introduced by this pass.
- The latest matrix still reports 20 visible opacity jumps. Those are now the
  next decision point before visual smoothing.
- `npm run audit:transition-report` still reports no previous matrix manifest
  available on disk because the Playwright/test-results lifecycle removed older
  usable manifest files before the fresh capture.

Verification after this checkpoint:

| Check | Result | Notes |
| --- | --- | --- |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Red/green for hidden-state and unloaded-helper classifications. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript check still clean. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | Shared-run/interruption and late-reapply specs both green. |
| `npm run audit:transition-matrix` | PASS | Captured fresh matrix to `test-results/transition-matrix-debug-2026-05-30T23-39-41-026Z/`. |
| `npm run audit:transition-report` | PASS | Wrote classified transition analysis beside the new matrix. |
| `npm run build` | PASS | Production bundle succeeded after analyzer/test changes. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | PASS | No whitespace errors; only expected CRLF normalization warnings. |

Recommended next steps:

1. Classify visible opacity jumps by policy coverage before changing visuals.
   The key unresolved-looking row is the MT volume `preserve` policy with an
   opacity delta (`0.96 -> 0.48`) in case `05/mid`; this may need debug-policy
   correction before a visual change.
2. After policy coverage is explicit, make the first visual smoothing pass on
   scene-section helper handoffs if they are not already covered by the
   `translate-section-helpers` runtime path.
3. Then review MT volume fade/crossfade handoffs.

### Visible Opacity Policy And Trace Instrumentation Checkpoint

Implemented on 2026-05-30/2026-05-31 after the hidden-state classification
checkpoint:

- Added visible opacity-jump classification to the matrix analyzer.
- Corrected same-visible MT volume opacity deltas from debug policy
  `preserve` to `fade-opacity`.
- Added a Playwright regression proving the MT volume row for the
  `102_page -> 104_page` handoff exposes `policy: "fade-opacity"` while
  keeping `transitionKind: "none"`.
- Added post-screenshot replay trace files to the matrix capture tool. The
  trace replay runs after all source/mid/end screenshots are captured so it
  cannot mutate the next case's source-state matrix rows.

Red/green evidence:

- RED 1: visible opacity-jump analyzer test failed because covered/unresolved
  counts and policy classification labels did not exist.
- GREEN 1: analyzer now distinguishes policy-covered fades,
  discrete-crossfades, scene-section helper translations, and unresolved
  preserve-policy opacity deltas.
- RED 2: `MT volume opacity deltas are exposed as fade-opacity policy` failed
  because the matrix row reported `policy: "preserve"` for a visible opacity
  delta.
- GREEN 2: the MT volume opacity-delta row now reports
  `policy: "fade-opacity"`, and analyzer mismatch logic accepts fade policy for
  same-visible opacity deltas.
- RED 3: first trace implementation either throttled to a few headless-browser
  samples or mutated `lastTransitionRun` before the next case source capture.
- GREEN 3: trace replay now runs after the matrix capture, preserving stable
  matrix counts. Headless trace density is still coarse and should be treated
  as timing context, not final visual proof.

Latest accepted artifact:

```text
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/manifest.json
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/transition-analysis.md
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/transition-analysis.json
```

Analyzer result for
`test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/`:

| Metric | Count |
| --- | ---: |
| productEntries | 167 |
| stateSourceOnly | 37 |
| loadedAtStartFalse | 4 |
| unloadedDormantHelperState | 4 |
| unloadedUnresolvedState | 0 |
| opacityJumps | 20 |
| opacityJumpCovered | 20 |
| opacityJumpUnresolved | 0 |
| policyMismatches | 0 |
| hiddenProductState | 33 |
| hiddenDormantState | 33 |
| hiddenUnresolvedState | 0 |
| sectionIsoEntries | 0 |
| interruptionDivergences | 0 |
| lateReapplyDuringTransition | 1 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |

Comparison notes:

- Latest report compares against
  `test-results/transition-matrix-debug-2026-05-31T00-24-11-249Z/` with zero
  count deltas.
- The temporary
  `test-results/transition-matrix-debug-2026-05-31T00-18-14-099Z/` artifact is
  not an accepted baseline: per-case trace replay ran before the next case and
  changed a later source capture's `lastTransitionRun` product rows.
- The accepted trace replay avoids that mutation by running only after all
  matrix source/mid/end artifacts are already captured.

Trace review packet:

```text
Primary section handoff:
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/05-section-frame-overlay-pages/source.png
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/05-section-frame-overlay-pages/mid.png
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/05-section-frame-overlay-pages/end.png
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/05-section-frame-overlay-pages/trace.json

Interruption handoff:
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/06-rapid-interruption-mt-volume-low-high/interrupted-start.png
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/06-rapid-interruption-mt-volume-low-high/interrupted-mid.png
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/06-rapid-interruption-mt-volume-low-high/end.png
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/06-rapid-interruption-mt-volume-low-high/trace.json

MT volume opacity handoff:
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/01-mt-volume-to-low-resistivity-seismic/source.png
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/01-mt-volume-to-low-resistivity-seismic/mid.png
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/01-mt-volume-to-low-resistivity-seismic/end.png
test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/01-mt-volume-to-low-resistivity-seismic/trace.json
```

Trace density note:

- Final traces are `node-interval-replay` traces.
- Headless Chromium and Playwright serialization still limited the replay
  traces to roughly 3-6 samples per transition.
- Some replay traces have no product rows even though the matrix screenshots
  retain the correct product rows. Treat traces as timing/camera context only.
- Before a high-risk visual policy change, add video capture or a lower-level
  app-side debug sampler that records inside the transition loop without
  Playwright round trips.

Verification after this checkpoint:

| Check | Result | Notes |
| --- | --- | --- |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Analyzer classification regression green. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Matrix capture syntax clean after trace replay changes. |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript no-emit check clean. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | 3 tests passed: shared run/interruption, late reapply, MT volume fade-opacity policy. |
| `npm run audit:transition-matrix` | PASS | Captured `test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/`. |
| `npm run audit:transition-report` | PASS | Wrote classified transition analysis beside the latest matrix. |
| `npm run build` | PASS | Production bundle succeeded. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | PASS | No whitespace errors; only expected CRLF normalization warnings. |

Recommended next steps:

1. Add true video capture, or an app-side per-frame sampler, before making the
   first visual smoothing change. The current replay traces are useful for
   timing context but not dense enough to judge elegance.
2. Start the visual pass with scene-section helper handoffs and ISO overlays.
   The policy surface is now explicit: `translate-section-helpers` for visible
   helper handoffs, dormant hidden scene-section helper state preserved.
3. Keep the first visual change narrow. Do not combine section helper smoothing
   with MT volume, seismic, point cloud, overlay, legend, label, or camera-only
   changes in the same pass.
4. Re-run the full verification matrix after any visual runtime change and
   compare against
   `test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z/`.

### App-Tick Smoothness Evidence Checkpoint

Implemented on 2026-05-30/2026-05-31 after the trace instrumentation
checkpoint:

- Added a DEV-only `PageController` smoothness sampler exposed through
  `window.__pageController.startSmoothnessTrace()` and
  `window.__pageController.stopSmoothnessTrace()`.
- The sampler records inside the app render tick, after transition progress,
  dynamic camera motion, and locked-focus camera updates have been applied.
- The sampler records transition frame state, run source/target/progress,
  camera position/target/FOV, consumer timing state, and product-family policy
  rows without changing visual runtime behavior.
- Updated the matrix capture replay pass to use the app-tick sampler instead
  of Playwright polling.
- Added full-matrix WebM video recording. The video is now the primary visual
  review artifact; app-tick traces are timing/context support.
- Added a Playwright regression proving the app-tick sampler is available and
  captures active transition samples plus product-family policy rows.

Latest accepted artifact:

```text
test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/
test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/manifest.json
test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/transition-analysis.md
test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/transition-analysis.json
test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/videos/page@97f27e2bb24495b442ae91caca63bb4f.webm
```

Analyzer result for
`test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/`:

| Metric | Count |
| --- | ---: |
| productEntries | 167 |
| stateSourceOnly | 37 |
| loadedAtStartFalse | 4 |
| unloadedDormantHelperState | 4 |
| unloadedUnresolvedState | 0 |
| opacityJumps | 20 |
| opacityJumpCovered | 20 |
| opacityJumpUnresolved | 0 |
| policyMismatches | 0 |
| hiddenProductState | 33 |
| hiddenDormantState | 33 |
| hiddenUnresolvedState | 0 |
| sectionIsoEntries | 0 |
| interruptionDivergences | 0 |
| lateReapplyDuringTransition | 1 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |

Video review artifact:

```text
test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/videos/page@97f27e2bb24495b442ae91caca63bb4f.webm
size: 24.01 MB
```

App-tick trace density from the accepted artifact:

| Case | Samples | Active samples | Stop |
| --- | ---: | ---: | --- |
| 01-mt-volume-to-low-resistivity-seismic | 7 | 4 | settled |
| 02-resistivity-volume-to-depth-slices | 8 | 4 | max-duration |
| 03-depth-slices-to-cross-sections | 8 | 6 | max-duration |
| 04-cross-sections-to-isosurfaces | 7 | 5 | max-duration |
| 05-section-frame-overlay-pages | 6 | 3 | max-duration |
| 06-rapid-interruption-mt-volume-low-high | 8 | 4 | max-duration |

Interpretation:

- The app-tick sampler is materially better integrated than Playwright polling:
  it samples from the same tick that applies transition progress and camera
  motion, and it no longer mutates source/mid/end matrix state.
- Headless Chromium still ticks coarsely in this workload. Use traces for
  clock/source/target correlation, not as final visual proof.
- The WebM video is now the artifact to inspect before the first visual
  smoothing change.

Verification after this checkpoint:

| Check | Result | Notes |
| --- | --- | --- |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Analyzer regression still green. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Matrix capture syntax clean after app-tick sampler/video changes. |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript no-emit check clean. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | 4 tests passed, including app-tick smoothness sampler regression. |
| `npm run audit:transition-matrix` | PASS | Captured `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/` after Playwright so the artifact remains on disk. |
| `npm run audit:transition-report` | PASS | Wrote classified transition analysis beside the latest matrix. |
| `npm run build` | PASS | Production bundle succeeded. |
| `npm run check:pages` | PASS | Project page wiring OK. |

Recommended next steps:

1. Human-review the WebM before changing visuals, starting with the section
   handoff and interruption segments.
2. If the WebM review confirms the scene-section helper handoff is visually
   rough, make one narrow runtime pass on scene-section helper opacity/translation
   smoothing and section/ISO overlay timing only.
3. Keep MT volume, seismic, point cloud, overlay, legend, label, assay, and
   camera-only changes out of that first visual pass.
4. After the first visual pass, regenerate the matrix and video, then compare
   against `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/`.

## Focused Video Review Packet - 2026-05-31T01:38:32Z heartbeat

Preflight:

- Latest artifact remained
  `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/`.
- No listener was present on port 5173 before review.
- Worktree still contains the existing transition audit/instrumentation changes
  and unrelated local edits; no files were reverted.

Video/contact-sheet extraction:

- `ffmpeg` and `ffprobe` were not available locally.
- A first browser decode attempt against a direct `file:///` WebM source timed
  out waiting for metadata.
- A second local extractor served the WebM through an HTTP range server and
  successfully generated review sheets from Chromium:
  - `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/review/transition-matrix-video-contact-sheet.png`
  - `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/review/transition-case05-section-contact-sheet.png`
  - `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/review/transition-case06-interruption-contact-sheet.png`
  - `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/review/transition-review-packet.md`

Focused review:

- Case 05, section-frame replay, was sampled from about `t=247.4s` to
  `t=254.2s`. The left page card and right editor panel remain present through
  the transition window. The left card title is visibly clipped/duplicated.
- Case 05 contact sheets do not show enough scene-helper motion to judge
  helper translation or opacity elegance safely without watching the WebM.
- Case 06, interruption replay, was sampled from about `t=261.8s` to
  `t=268.7s`. It shows a bright-to-dark view jump near the start and a later
  MT-volume-to-terrain handoff. Keep this for the MT/camera/interruption pass,
  not the first section-only visual pass.

Decision:

- No runtime visual policy changes were made in this pass. The instrumentation
  baseline is green, but the remaining first visual change requires human
  motion review of the WebM rather than a contact-sheet-only decision.

Recommendation:

1. Human-review
   `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/videos/page@97f27e2bb24495b442ae91caca63bb4f.webm`.
2. Start with case 05 around `t=247.4s` to `t=254.2s` and confirm whether the
   section-frame/page-card handoff or scene-section helper movement actually
   looks rough in motion.
3. If confirmed, make one narrow first visual pass on section-frame/page-card
   behavior and scene-section helper timing only, then regenerate matrix, report,
   video, and review sheets.
4. Defer the case 06 bright-to-dark interruption jump to the later MT volume /
   camera / interruption family pass.

## Reported Page 25 Transition Logic Audit - 2026-05-31

Trigger:

- Human report: camera movement sometimes stalls and jumps; between page 25 and
  page 26 the ground line snaps in and out; isobands become more transparent
  during the transition and then snap back to stronger color/opacity at the end.
- Working hypothesis from review: source and target pages are not sharing a
  coherent transition understanding of visual state that is already present.

Preflight:

- Real repo path used for audit: `C:\GeoSee\GeoSee_Dev`.
- Existing latest artifact remains
  `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/`.
- That artifact does not include the reported page 25 -> page 26 handoff.
- Audit-only matrix coverage was added in `tools/capture-transition-matrix.mjs`:
  case `07-reported-page-25-to-new-page-snap`, `fromIndex: 24`,
  `toIndex: 25`.
- Verification for the audit-only matrix edit:
  `node --check tools\capture-transition-matrix.mjs` PASS.

Page-state findings:

- Page 25 is `projects/utah-forge/pages/103_page.json`, display index 25,
  id `103_page`, title `Unresolved / Missing Tools duplicate duplicate duplicate`.
- Page 26 is `projects/utah-forge/pages/105_page.json`, display index 26,
  id `105_page`, title `New page`.
- Page 26 has no `layerOverrides`, no `visibilityOverrides`, and no
  `dynamicCamera`. By effective-state rules in `src/pages/effective.ts`, that
  means it reverts to environment defaults for every unspecified visual.
- Page 25 explicitly enables scene section state and active X/Y section planes
  through `utah-forge-scene-section-planes`, forces threshold surfaces visible,
  and hides full-density point cloud state.
- Page 25 -> page 26 camera movement is the largest adjacent camera jump found:
  camera position distance about `1,786,254` scene units over `3000ms`; target
  distance about `12,672` scene units. Both pages are static-camera pages
  (`dynamicCamera.enabled=false` on page 25; absent on page 26), so the dynamic
  camera path-aware smoothing branch is not active for this handoff.

Transition-orchestration findings:

- `src/pages/PageController.tsx` starts a page transition by capturing the
  source page, resolving the target page, starting the page run, then calling
  `sceneHandle.manager.transitionEffectiveLayersForPage(...)`.
- Immediately after the scene layer transition is started, the controller calls
  `sceneHandle.manager.applyPageScene(targetResolved.page)`. Scene mood and
  overlay state therefore switch at the beginning of the camera tween, while
  text/page consumers and data-layer fades use their own timing.
- The render tick order is:
  `CameraTweener.update`, page progress update, transition dynamic camera,
  steady dynamic camera, locked camera focus, smoothness sample.
- `src/pages/cameraTween.ts` tweens camera position, target, and FOV from the
  current camera pose to the target pose. It does not call
  `controls.update()` during the tween, but it does call `controls.update()` at
  completion to reset OrbitControls basis. For a huge static-camera path, any
  frame cadence stall or final basis correction can read as a stall/jump.
- Dynamic camera only contributes when the source or target dynamic camera is
  enabled. For page 25 -> page 26 it is not, so there is no path-aware lead,
  exit, or orbit blend to soften the 1.79M-unit move.

Ground-line findings:

- Environment defaults for `utah-forge-scene-section-planes` have
  `sceneSectionGroundTraceVisible:true` and frame/axis metadata, but
  `sceneSectionEnabled:false`.
- Page 25 overrides `sceneSectionEnabled:true` with an active X section.
  Page 26 has no overrides, so it inherits `sceneSectionEnabled:false`.
- `src/scene/section/sceneSectionController.ts` sets the helper group visible
  only when `sceneSectionEnabled === true`, some helper/trace/frame content is
  requested, and active planes exist. When the target style disables the section,
  the live helper group can disappear immediately.
- Discrete scene-section style changes are handled in
  `src/scene/transitions/layerTweenRuntime.ts` by applying `toStyle` while a
  helper snapshot fades. This works only for geometry present in the snapshot.
- The ground trace mesh is built asynchronously after `getHeightSampler()`
  resolves. If the trace has not been added to the helper group when
  `beginSceneSectionHelperTransitionSnapshot()` captures the old group, the
  fading snapshot will not contain the ground trace. That creates a plausible
  snap-out/snap-in path for the reported ground line.

Isoband / isoline findings:

- The scalar volume renderer composes the actual MT volume mesh opacity as
  `scalarVolumeOpacity * sectionIsoSourceOpacity` in
  `src/scene/styles/scalarVolumeStyle.ts`.
- Environment style for `utah-forge-mt-resistivity-volume` has
  `scalarVolumeOpacity:0.48`, `sectionIsoEnabled:true`, and
  `sectionIsoSourceOpacity:0`. That means the volume body can be hidden while
  section ISO overlays remain visible.
- Section ISO line overlays use a material base opacity of `0.96` in
  `src/scene/isoOverlays/sectionIsoOverlay.ts`; MT volume cut bands default to
  `sectionIsoBandOpacity:0.32` in
  `src/scene/isoOverlays/volumeCutIsoOverlays.ts`.
- `src/scene/SceneManager.ts` captures source opacity from the rendered object
  tree via `currentRenderOpacityForTree(...)`, so a visible section ISO line can
  produce source opacity about `0.96`.
- The target opacity for the same layer is calculated by
  `targetOpacityForLayer(...)`, which returns the target layer style opacity
  (`0.48`) instead of the product-specific composed channel opacity for ISO
  overlays.
- Existing case 05 trace already shows this mismatch for
  `utah-forge-mt-resistivity-volume`: family `scalar-volume`, policy
  `fade-opacity`, source opacity `0.96`, target opacity `0.48`, reason
  `layer opacity changed`, even though the user-visible feature is the section
  ISO overlay rather than the volume body.
- This is the strongest current root-cause candidate for "isobands go more
  transparent then snap back": transition start uses rendered overlay opacity,
  transition end targets layer style opacity, and the final style reapply can
  restore authored overlay material opacity.

Audit gaps now closed:

- The transition matrix now includes the exact reported page handoff as case
  `07-reported-page-25-to-new-page-snap`.
- A fresh matrix and analyzer report were generated with the new case:
  - `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/`
  - `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/manifest.json`
  - `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/transition-analysis.md`
  - `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/transition-analysis.json`
  - `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/videos/page@bf4392700a33fb0ce465f55be2c22c34.webm`
- Case 07 direct artifacts:
  - `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/07-reported-page-25-to-new-page-snap/source.png`
  - `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/07-reported-page-25-to-new-page-snap/mid.png`
  - `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/07-reported-page-25-to-new-page-snap/end.png`
  - `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/07-reported-page-25-to-new-page-snap/trace.json`

Case 07 evidence:

- Source page: `103_page`; target page: `105_page`.
- Trace samples: `8`; stopped reason: `settled`.
- The camera trace confirms a very large static-camera move:
  - first active sample remains at page 25 pose.
  - mid-transition sample around `raw=0.408`, `eased=0.272` is already moving
    away from the section scene.
  - later sample around `raw=0.692`, `eased=0.883` has jumped most of the way
    to the far page 26 overview pose.
  - final sample reaches `[-1141138.453, -185443.583, 1437791.924]` looking at
    `[-5302.65, 7253.265, 2476.306]`.
- Scene-section helper row for the exact report:
  `sourceVisible:true`, `targetVisible:false`, `sourceOpacity:1`,
  `targetOpacity:0`, policy `translate-section-helpers`, transition kind
  `continuous`.
- MT volume row for the exact report:
  `sourceVisible:true`, `targetVisible:true`, `sourceOpacity:0.96`,
  `targetOpacity:0.48`, policy `crossfade-discrete`, transition kind
  `discrete-crossfade`, reason `discrete data/style changed, using snapshot
  crossfade`.
- Visual screenshot review:
  - `source.png` shows the low section/ISO feature from page 25.
  - `mid.png` and `end.png` are already on the far `New page` view with the
    section/ISO feature gone.
- Analyzer count delta against
  `test-results/transition-matrix-debug-2026-05-31T01-27-06-311Z/`:
  product entries `+28`, state-source-only `+5`, loadedAtStart=false `+2`,
  opacity jumps `+4`, hidden product state `+3`, unresolved opacity jumps `0`,
  policy mismatches `0`, interruption divergences `0`, unexpected console `0`.
- The analyzer currently classifies the visible opacity jumps as policy-covered.
  This is mechanically true but insufficient for elegance: the specific
  `0.96 -> 0.48` MT volume row is probably a section ISO overlay opacity
  channel being squeezed through a layer-level scalar-volume policy.

Remaining audit gaps before runtime fixes:

1. Extend the analyzer or matrix summary to flag family-specific render-opacity
   mismatches: actual rendered source opacity from section ISO overlays versus
   target layer-style opacity for scalar volume and section ISO products.
2. Add a camera-path risk row to the report for adjacent transitions whose
   camera distance is large relative to duration, with page 25 -> page 26 as
   the current top risk.
3. Add a scene-section ground-trace risk row when a source page has
   `sceneSectionEnabled:true` plus ground trace enabled and the target falls
   back to `sceneSectionEnabled:false`.
4. Watch the new case 07 WebM segment before touching runtime visuals.

Recommended fix order after case 07 evidence exists:

1. Do not start with a general camera-easing change. First make the matrix prove
   the exact p25 -> p26 symptom.
2. Fix section ISO opacity as a separate product/channel policy so overlay
   opacity resolves to the same value at transition end as final authored
   material opacity.
3. Fix scene-section helper/ground-trace handoff so async ground traces are
   either present in the fading snapshot or are held/faded by a stable helper
   channel.
4. Then handle camera smoothing for large static-camera jumps. Options include
   authoring page 26 from page 25 state, adding adaptive duration/waypoint
   behavior for extreme path distance, or enabling a path-aware dynamic-camera
   handoff. This should be evaluated after the visual layer discontinuities are
   isolated, because the current camera path is also crossing a large visual
   state reset.

## Analyzer Risk Classification Pass - 2026-05-31T02:11:32Z heartbeat

Preflight:

- Real repo path used: `C:\GeoSee\GeoSee_Dev`.
- Latest matrix artifact:
  `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/`.
- No listener was present on ports 5173 or 5174 at preflight.
- Worktree still contains the existing transition audit/instrumentation changes
  and unrelated local edits; no files were reverted.

Changes:

- `tools/analyze-transition-matrix.mjs` now emits three explicit risk buckets
  before visual runtime changes:
  - `sectionIsoRenderOpacityMismatch`
  - `sceneSectionGroundTraceRisk`
  - `cameraPathRisk`
- `tests/tools/analyze-transition-matrix.test.mjs` now covers the new analyzer
  categories using inline trace samples and representative product rows.
- The latest report was regenerated beside the latest matrix artifact:
  `test-results/transition-matrix-debug-2026-05-31T02-04-34-833Z/transition-analysis.md`.

Updated analyzer findings on the latest matrix:

| Metric | Count | Delta vs previous matrix |
| --- | ---: | ---: |
| sectionIsoRenderOpacityMismatch | 5 | +2 |
| sceneSectionGroundTraceRisk | 2 | +1 |
| cameraPathRisk | 1 | +1 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| unexpectedConsole | 0 | 0 |

Case 07 remains the highest-priority runtime target:

- Section ISO render-opacity mismatch:
  `utah-forge-mt-resistivity-volume`, `0.96 -> 0.48`,
  visual policy `split-section-iso-overlay-opacity-from-layer-opacity`.
- Scene-section ground-trace handoff risk:
  `utah-forge-scene-section-planes`, `1 -> 0`,
  visual policy `hold-or-snapshot-ground-trace-through-helper-fade`.
- Camera path risk:
  `103_page -> 105_page`, sampled position distance `1,779,746.1`, target
  distance `12,625.5`, max sampled frame position distance `1,049,399.4` over
  `850.1ms`.

Verification:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Matrix capture syntax still clean. |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Initial sandbox run hit `spawn EPERM`; escalated Node test runner passed. |
| `npm run audit:transition-report` | PASS | Rewrote analysis JSON/Markdown for latest matrix. |
| `npx tsc --noEmit --pretty false` | PASS | TypeScript no-emit check clean. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `npm run build` | PASS | Production bundle succeeded. |
| `git diff --check` | PASS | Only existing CRLF warnings reported. |

Recommendation:

1. Next code pass should be runtime but still narrow: fix section ISO overlay
   opacity as its own product/channel policy so transition end matches final
   authored overlay material opacity.
2. Then fix the scene-section helper/ground-trace disable handoff so async
   ground traces cannot disappear outside the fade/snapshot channel.
3. Only after those are verified should the large static camera path be changed
   through authoring, adaptive duration, waypointing, or path-aware camera
   handoff.

## Deeper Missed-Risk Audit - 2026-05-31

Why the page 25 issue was missed:

- The matrix had a nearby section-frame case (`102_page -> 103_page`) but did
  not directly exercise the reported adjacent handoff (`103_page -> 105_page`)
  until case 07 was added.
- The analyzer classified visible opacity changes as policy-covered at the
  layer level. That hid the real visual issue: section ISO overlay material
  opacity was being represented as scalar-volume layer opacity.
- The report had no "all adjacent page transitions are represented" check, so
  untested adjacent page pairs could sit outside the evidence loop.
- Page 26 is an authored-state reset (`New page` with no overrides). The audit
  treated inherited defaults as legitimate target state but did not flag that
  the previous page had heavy authored state and the next page had none.

Additional blind spots found:

1. Matrix coverage is still incomplete.
   The latest analyzer now reports `adjacentTransitionCoverageGaps: 20`. The
   highest-risk adjacent pairs still missing from normal matrix coverage are:
   - page 19 -> 20: `50_integrated_seismic_resistivity_context` ->
     `99_unresolved_missing_tools`, camera distance about `439,511`, target
     distance about `21,494`, dynamic camera turns on.
   - page 13 -> 14: `52_mt_marching_cubes_full_extent` ->
     `53_mt_product_stack_demo`, camera distance about `367,449`, target
     distance about `45,678`, dynamic camera turns off.
   - page 7 -> 8: `41_mt_station_network_footprint` ->
     `42_resistivity_volume_overview`, camera distance about `150,809`, target
     distance about `45,678`, dynamic camera turns on.
   - page 12 -> 13: `51_mt_marching_cubes_focused` ->
     `52_mt_marching_cubes_full_extent`, camera distance about `195,242`,
     target distance about `45,678`.
   - page 5 -> 6: `08_mt_threshold_surfaces` ->
     `40_geophysics_product_overview`, camera distance about `122,765`,
     dynamic camera turns off.
   - page 20 -> 21: `99_unresolved_missing_tools` -> `101_page`, camera
     distance about `643,819`.

2. MT volume ISO overlays are still under-modeled in the product registry.
   `src/scene/transitions/productFamilyRegistry.ts` emits
   `section-iso-overlays` rows for slices and seismic, but not for
   `utah-forge-mt-resistivity-volume`. That is why the report can say
   `sectionIsoEntries: 0` while MT volume section ISO overlays are visibly
   present and driving the `0.96 -> 0.48` mismatch. The new analyzer risk
   bucket catches the symptom, but the registry should eventually expose MT
   volume ISO overlays as a first-class product row.

3. Generic layer opacity remains too coarse for several renderer channels.
   `targetOpacityForLayer(...)` returns effective `style.opacity`, while the
   actual render tree can be governed by product-specific channels:
   - scalar volume: `scalarVolumeOpacity * sectionIsoSourceOpacity` plus
     independent section ISO overlay materials.
   - scalar preview / point cloud: scalar source opacity and overlay roots.
   - seismic browser: `opacity * sectionIsoSourceOpacity`, comparison modes,
     section ISO overlays, and raymarch/slice modes.
   - threshold surfaces: per-surface and boundary opacity can diverge from the
     parent layer opacity.
   - topo graticule: ribbon, edge, label, and minor-line opacities are not a
     single layer opacity.

4. Screenshot evidence can still be misleading.
   Case 07 source/mid/end screenshots show the right gross reset, but the
   editor panel covers much of the scene. Also, `waitForProgress(0.45)` can
   capture after `transitionProgress` has already reached `1` under heavy
   browser load, so "mid" screenshots are not guaranteed to be true mid-state.
   The app-tick trace is more reliable for timing, but visual review should add
   a UI-hidden or presentation-mode capture path for important handoffs.

5. Late-reapply debug state is global and can appear stale inside later case
   summaries.
   `SceneManager` stores late reapply events in one rolling list. The analyzer
   deduplicates rows, but individual case JSON summaries can still include an
   earlier case's during-transition event. This is not currently a visual bug,
   but it is a diagnostic precision gap. The debug state should be scoped by
   transition run or reset per matrix case.

6. Consumer timing remains split across independent policies.
   Page data layers, presenter overlay, labels, assays, legends, scene overlays,
   and camera all use different switch/fade rules:
   - scene overlays fade leaving overlays at transition start and show target
     overlays at transition end.
   - labels and assays hold source until progress `0.92`.
   - legends have phased layout behavior, but default policy is target-from-start.
   - page card/presenter overlay crossfades/slides separately.
   These may be intentional, but the analyzer does not yet flag consumer timing
   disagreements for a given source/target pair.

7. Async scene-section and ISO rebuilds can land outside snapshots.
   Ground trace geometry waits on `getHeightSampler()`. MT/seismic volume cut
   ISO overlays also defer work when terrain/height sampling is not ready. A
   snapshot taken at transition start can miss geometry that appears shortly
   after, so the fade path may not represent the complete source state.

8. Authored draft/reset pages need validation.
   `105_page` is in page order as `New page` with no overrides. That creates a
   full effective-state reset after a heavily authored page. A page validator
   should flag visible pages with default title/no overrides when adjacent to
   highly authored pages, or require draft pages to be hidden.

Analyzer changes from this deeper audit:

- Added `adjacentTransitionCoverageGaps` to the report. Latest count: `20`.
- Added coverage-gap recommendations so missing adjacent page pairs are visible
  before visual fixes.
- Existing new buckets remain:
  `sectionIsoRenderOpacityMismatch`, `sceneSectionGroundTraceRisk`, and
  `cameraPathRisk`.

Verification:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Escalated because sandbox blocks Node test worker spawn. |
| `npm run audit:transition-report` | PASS | Report now includes adjacent transition coverage gaps. |

Recommendations before runtime fixes:

1. Add normal matrix cases for the highest-risk uncovered adjacent transitions:
   pages 19 -> 20, 13 -> 14, 7 -> 8, 12 -> 13, 5 -> 6, and 20 -> 21.
2. Add MT volume section ISO overlays to the product registry as
   `section-iso-overlays`, not just as inferred scalar-volume opacity risk.
3. Add a UI-hidden or presentation-mode matrix capture for case 07 and the next
   high-risk cases so visual review is not obscured by the editor panel.
4. Scope late-reapply debug events by transition run before relying on per-case
   summaries for precise causality.
5. Then proceed to the first runtime fix: split section ISO overlay opacity from
   scalar-volume layer opacity.
