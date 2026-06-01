# Page Transition Fix Prep - 2026-05-30

Status: pre-fix preparation log plus instrumentation checkpoint. This file
records the concrete matrix, validation results, baseline captures, and
recommended product policies to use before modifying transition visuals.

Fixture boundary: historical page ids, page numbers, matrix case ids, and
source/target fixture paths in this file are evidence only. They are not
implementation instructions. Current and future remediation must target
global transition/editor/save rules that apply to any page state.

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
   screenshots plus full transition debug JSON for high-risk reproduction
   transitions.

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

The original matrix used disposable page fixtures. The fixture names and
historical positions are evidence only and are logged in the evidence register;
future fixes must target the reproduction family below.

| ID | Reproduction family | Primary surfaces covered | Captures |
| --- | --- | --- | --- |
| 01 | MT volume to seismic/threshold-surface handoff | Full-density point cloud, MT volume, threshold surfaces, seismic context, dynamic camera, opacity envelope | editor + presenter source/mid/end |
| 02 | Scalar volume to 2D resistivity slice handoff | Scalar volume to 2D resistivity slices, scalar legend, transparency, page overlay | editor + presenter source/mid/end |
| 03 | Slice to section/crop/window handoff | Slice-to-section transition, section/crop/window translation risk, ISO line/band state | editor + presenter source/mid/end |
| 04 | Section panels to isosurface handoff | Section panels to MT isosurfaces, opacity handoff, legend/source mismatch risk | editor + presenter source/mid/end |
| 05 | Section-frame overlay source/target behavior | Section-frame overlay fixtures, duplicate/unresolved fixture content, overlay source/target behavior | editor + presenter source/mid/end |
| 06 | Rapid interruption handoff | Rapid interruption, promoted source fixture risk, skipped old camera completion cleanup | editor + presenter source/mid/end |

## Additional Matrix Rows To Exercise During Fix Verification

These were not screenshot-captured in this prep pass but should be part of the
post-fix verification matrix.

| Reproduction family | Why it matters |
| --- | --- |
| Point-cloud / station-marker handoff | Point-cloud visibility and MT station marker/lift changes. |
| Threshold-surface focus handoff | Threshold surface product focus and boundary legend behavior. |
| Focused-to-full-extent isosurface handoff | Product switch and camera scale change. |
| Seismic render-mode handoff | Seismic render mode/product behavior and section/fence panel handoff. |
| Overlay-heavy duplicate-fixture handoff | Overlay-heavy duplicate fixture content and UI/source behavior. |
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
- That artifact does not include the reported fixture handoff.
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
  enabled. For that fixture handoff it is not, so there is no path-aware lead,
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
  - `source.png` shows the low section/ISO feature from the source fixture.
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
   camera distance is large relative to duration, with that fixture transition as
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
   authoring the target fixture from source fixture state, adding adaptive duration/waypoint
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

Why the reported fixture issue was missed:

- The matrix had a nearby section-frame fixture (`102_page -> 103_page`) but
  did not directly exercise the reported adjacent fixture transition
  (`103_page -> 105_page`) until case 07 was added.
- The analyzer classified visible opacity changes as policy-covered at the
  layer level. That hid the real visual issue: section ISO overlay material
  opacity was being represented as scalar-volume layer opacity.
- The report had no "all adjacent page transitions are represented" check, so
  untested adjacent fixture transitions could sit outside the evidence loop.
- Page 26 is an authored-state reset (`New page` with no overrides). The audit
  treated inherited defaults as legitimate target state but did not flag that
  the previous page had heavy authored state and the next page had none.

Additional blind spots found:

1. Matrix coverage is still incomplete.
   The latest analyzer now reports `adjacentTransitionCoverageGaps: 20`. The
   highest-risk adjacent fixture transitions still missing from normal matrix
   coverage are:
   - fixture transition: `50_integrated_seismic_resistivity_context` to
     `99_unresolved_missing_tools`, camera distance about `439,511`, target
     distance about `21,494`, dynamic camera turns on.
   - fixture transition: `52_mt_marching_cubes_full_extent` to
     `53_mt_product_stack_demo`, camera distance about `367,449`, target
     distance about `45,678`, dynamic camera turns off.
   - fixture transition: `41_mt_station_network_footprint` to
     `42_resistivity_volume_overview`, camera distance about `150,809`, target
     distance about `45,678`, dynamic camera turns on.
   - fixture transition: `51_mt_marching_cubes_focused` to
     `52_mt_marching_cubes_full_extent`, camera distance about `195,242`,
     target distance about `45,678`.
   - fixture transition: `08_mt_threshold_surfaces` to
     `40_geophysics_product_overview`, camera distance about `122,765`,
     dynamic camera turns off.
   - fixture transition: `99_unresolved_missing_tools` to `101_page`, camera
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
- Added coverage-gap recommendations so missing adjacent fixture transitions
  are visible before visual fixes.
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
   the listed adjacent fixture transitions.
2. Add MT volume section ISO overlays to the product registry as
   `section-iso-overlays`, not just as inferred scalar-volume opacity risk.
3. Add a UI-hidden or presentation-mode matrix capture for case 07 and the next
   high-risk cases so visual review is not obscured by the editor panel.
4. Scope late-reapply debug events by transition run before relying on per-case
   summaries for precise causality.
5. Then proceed to the first runtime fix: split section ISO overlay opacity from
   scalar-volume layer opacity.

## All-Adjacent Matrix Expansion - 2026-05-31

User correction accepted: pages are disposable examples. The transition audit
must therefore target base transition rules and systemic state orchestration,
not hard-code repairs between fixture numbers. The matrix generator now
derives normal cases from `projects/utah-forge/project.json:pageOrder`:

- `A01` through `A25`: every adjacent source/target fixture in `pageOrder`
  handoff.
- `S01`: supplemental non-adjacent section-frame stress path recorded by the
  matrix manifest.
- `06`: rapid interruption stress path, retained separately.

Tooling changes:

- `tools/capture-transition-matrix.mjs`
  - Replaced the hand-picked core matrix with generated all-adjacent coverage.
  - Added `matrixScope` metadata to the manifest with generated adjacent,
    supplemental, and interruption case counts.
  - Added failure recovery so a bad handoff writes `failure.json`, optional
    `failure.png`, and continues instead of aborting the entire audit.
  - Added trace failure recording so replay failures are visible in the matrix
    manifest.
- `tools/analyze-transition-matrix.mjs`
  - Added `matrixCaptureFailures` so capture/trace failures are reported
    separately from visual policy divergences and coverage gaps.
  - Kept `adjacentTransitionCoverageGaps` as a missing-case detector; it now
    drops to zero when all adjacent pairs are represented.
- `tests/tools/analyze-transition-matrix.test.mjs`
  - Added analyzer coverage for trace/capture failure reporting.

Capture history:

1. First all-adjacent attempt:
   - Artifact:
     `test-results/transition-matrix-debug-2026-05-31T02-34-59-419Z`
   - Result: aborted at `A19`
     (`50_integrated_seismic_resistivity_context -> 99_unresolved_missing_tools`)
     with `gotoAndSettle` timeout.
   - Finding: the tool needed per-case failure recording/recovery before the
     all-page audit could be trusted.
2. Recovery-enabled attempt:
   - Artifact:
     `test-results/transition-matrix-debug-2026-05-31T02-46-04-834Z`
   - Result: completed 27 cases but included Vite HMR/provider contamination:
     `unexpectedConsole: 4`, `matrixCaptureFailures: 1`.
   - Finding: because the dev server hot-reloaded while tooling changed, this
     run was not accepted as a visual baseline.
3. Clean restarted-server baseline:
   - Artifact:
     `test-results/transition-matrix-debug-2026-05-31T03-04-43-870Z`
   - Report:
     `test-results/transition-matrix-debug-2026-05-31T03-04-43-870Z/transition-analysis.md`
   - Manifest:
     `test-results/transition-matrix-debug-2026-05-31T03-04-43-870Z/manifest.json`
   - Video:
     `test-results/transition-matrix-debug-2026-05-31T03-04-43-870Z/videos/`
   - Result: accepted as the current all-adjacent audit baseline.

Clean baseline counts:

| Metric | Count |
| --- | ---: |
| cases | 27 |
| generated adjacent cases | 25 |
| supplemental cases | 1 |
| interruption cases | 1 |
| productEntries | 747 |
| stateSourceOnly | 156 |
| loadedAtStartFalse | 24 |
| unloadedDormantHelperState | 24 |
| unloadedUnresolvedState | 0 |
| opacityJumps | 82 |
| opacityJumpCovered | 82 |
| opacityJumpUnresolved | 0 |
| policyMismatches | 0 |
| hiddenProductState | 132 |
| hiddenDormantState | 132 |
| hiddenUnresolvedState | 0 |
| sectionIsoEntries | 0 |
| sectionIsoRenderOpacityMismatch | 20 |
| sceneSectionGroundTraceRisk | 3 |
| cameraPathRisk | 2 |
| adjacentTransitionCoverageGaps | 0 |
| matrixCaptureFailures | 0 |
| interruptionDivergences | 0 |
| lateReapplyDuringTransition | 1 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |

Important interpretation:

- All adjacent page transitions are now represented. The previous
  `adjacentTransitionCoverageGaps: 20` blind spot is closed.
- The user-reported page example is still useful evidence, but not a fix target
  by itself. The clean matrix says the remaining work belongs in base visual
  policy/rule families:
  - MT/section ISO opacity channels are still under-modeled:
    `sectionIsoRenderOpacityMismatch: 20`.
  - Scene-section helper/ground-trace handoff still has visible-risk rows:
    `sceneSectionGroundTraceRisk: 3`.
  - Camera path risk is concentrated in large authored/default handoffs:
    `A20` and `A25`.
- Hidden seismic/MT authored state is now classified as dormant and safe to
  preserve without interpolation unless it becomes visible.
- Loaded-at-start false scene-section helper state is still classified as
  debug-only dormant helper state, not an unresolved visual transition risk.
- No policy/transitionKind mismatches, interruption source/target divergences,
  unresolved opacity jumps, capture failures, or unexpected console errors were
  present in the clean all-adjacent baseline.

Current recommendations before runtime fixes:

1. First runtime fix should still be systemic, not fixture-specific: split
   section ISO overlay render opacity from parent scalar-volume layer opacity
   and expose the resulting overlay policy in the matrix/debug artifacts.
2. Then fix scene-section helper/ground-trace handoff so helper fade/translation
   does not snap the ground trace on/off when source/target visibility changes.
3. Defer camera-only smoothing until after visual-layer snaps are reduced.
   Current camera risk rows:
   - `A20`: `99_unresolved_missing_tools -> 101_page`, position distance about
     `518,379`, max frame position distance about `290,953` over about `983ms`.
   - `A25`: `103_page -> 105_page`, position distance about `1,778,907`,
     max frame position distance about `1,030,477` over about `833ms`.
4. Add a presentation-mode or UI-hidden capture option before relying on
   screenshots for final smoothness judgment; current app-side traces are
   stronger for timing but do not replace human visual review.
5. Keep the all-adjacent matrix as the default audit gate. Future page edits
   should not require new hard-coded matrix cases unless they introduce a
   non-adjacent, interruption, or special timing path.

Verification for this pass:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Matrix generator syntax clean. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Escalated because sandbox blocks Node test worker spawn. |
| `npm run audit:transition-report` | PASS | Clean all-adjacent report written with zero unexpected console messages. |
| `npx tsc --noEmit --pretty false` | PASS | Typecheck clean. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `npm run build` | PASS | Production build completed. |
| `git diff --check` | FAIL | Existing whitespace/line-ending findings remain, including `src/editor/LayerPanel.tsx:2626: new blank line at EOF`; not changed in this pass. |

## RAF Smoothness Evidence Pass - 2026-05-31T03:24Z heartbeat

Preflight:

- Current working path is the real repo path:
  `C:\GeoSee\GeoSee_Dev`.
- Latest accepted matrix before this pass:
  `test-results/transition-matrix-debug-2026-05-31T03-04-43-870Z`.
- The older heartbeat baseline
  `test-results/transition-matrix-debug-2026-05-31T00-29-31-503Z` is now
  superseded by the all-adjacent baseline.
- Git worktree is still dirty from transition instrumentation and unrelated
  local UI/editor changes. No unrelated files were reverted.

Why this pass happened:

- The all-adjacent baseline closed matrix coverage, but its app-side traces
  were still too sparse for visual smoothness decisions: roughly `4-7` active
  samples per transition with gaps around `0.8-1.4s`.
- The user-reported camera stalls/jumps cannot be fixed responsibly from
  source/mid/end screenshots or sparse timing traces. The next safe step was to
  strengthen smoothness evidence, not change runtime visual policy.

Tooling/runtime instrumentation changes:

- `src/pages/PageController.tsx`
  - Added a debug-only `requestAnimationFrame` sampler loop while
    `startSmoothnessTrace(...)` is active.
  - Trace `sampling` is now `app-raf` for new captures.
  - The RAF loop is cancelled on `stopSmoothnessTrace(...)` and provider
    cleanup.
  - This is instrumentation only; it does not change page transition visuals.
- `tools/analyze-transition-matrix.mjs`
  - Added `smoothnessTraceQualityRisk`.
  - Flags traces with fewer than `12` active samples or active sample gaps over
    `150ms`.
  - Adds a blocking recommendation when trace/video evidence is too sparse for
    visual smoothing decisions.
- `tests/tools/analyze-transition-matrix.test.mjs`
  - Added coverage for `smoothnessTraceQualityRisk`.

New matrix:

- Artifact:
  `test-results/transition-matrix-debug-2026-05-31T03-32-28-434Z`
- Manifest:
  `test-results/transition-matrix-debug-2026-05-31T03-32-28-434Z/manifest.json`
- Report:
  `test-results/transition-matrix-debug-2026-05-31T03-32-28-434Z/transition-analysis.md`
- Video:
  `test-results/transition-matrix-debug-2026-05-31T03-32-28-434Z/videos/`

Clean matrix status:

| Metric | Count |
| --- | ---: |
| cases | 27 |
| productEntries | 747 |
| adjacentTransitionCoverageGaps | 0 |
| matrixCaptureFailures | 0 |
| interruptionDivergences | 0 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |
| sectionIsoRenderOpacityMismatch | 20 |
| sceneSectionGroundTraceRisk | 3 |
| cameraPathRisk | 2 |
| smoothnessTraceQualityRisk | 27 |

Smoothness evidence result:

- All `27` traces are now marked `app-raf`.
- RAF sampling improved density but did not make it good enough for visual
  smoothing decisions:
  - minimum active samples: `5`
  - maximum active samples: `15`
  - maximum active sample gap: about `1416.7ms`
  - high-risk `A20`: `8` active samples, max gap about `1166.6ms`
  - high-risk `A25`: `10` active samples, max gap about `1283.2ms`
- Interpretation: the trace is no longer just "too coarse evidence"; it is also
  evidence that transition runs can have long app-frame gaps under matrix
  conditions. This matches the user's observed "stall and jump" symptom better
  than a simple easing bug.

Decision:

- Do not make section/ISO visual runtime fixes yet.
- The next safe investigation is to classify why RAF/app frames are sparse:
  heavy scene rebuilds, synchronous material/geometry work during transition,
  async section/ISO rebuilds landing mid-run, renderer invalidation cadence, or
  Playwright/video/headless throttling.
- Prefer adding per-sample/per-gap instrumentation before runtime policy fixes:
  record `dtMs`, long-gap buckets, transition frame phase, active product family
  counts, scene snapshot/rebuild counters, and whether section ISO/ground-trace
  async work completed during the gap.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Matrix generator syntax clean. |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Escalated because sandbox blocks Node test worker spawn. |
| `npx tsc --noEmit --pretty false` | PASS | Typecheck clean after RAF sampler change. |
| `npm run audit:transition-matrix` | PASS | Captured all 27 cases from the real repo path via Vite on `127.0.0.1:5174`. |
| `npm run audit:transition-report` | PASS | Report now includes `smoothnessTraceQualityRisk: 27`. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `npm run build` | PASS | Production build completed after RAF sampler change. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | Escalated because sandbox blocked Playwright test-results cleanup; all 4 transition-orchestration tests pass after updating smoothness trace expectations to `app-raf`. |
| `git diff --check` | FAIL | Existing whitespace/line-ending findings remain, including `src/editor/LayerPanel.tsx:2626: new blank line at EOF`; not changed in this pass. |

Blocker after verification:

- The Playwright orchestration rerun cleaned `test-results`, removing the fresh
  matrix artifact
  `test-results/transition-matrix-debug-2026-05-31T03-32-28-434Z`.
- This means the counts above are valid from the completed report output in the
  thread/log, but the artifact files are no longer available on disk for human
  review.
- Stop condition triggered: generated artifacts unexpectedly disappeared.

Next unattended run should:

1. Move transition matrix outputs outside Playwright's cleaned `test-results`
   path, or regenerate the matrix after all Playwright tests have finished.
2. Prefer a stable artifact root such as
   `docs/dev-context/artifacts/transition-matrix/` or another non-cleaned
   directory.
3. Regenerate the RAF-sampled matrix/report and confirm the artifact remains on
   disk before any visual runtime fixes.
4. Continue investigating long RAF sample gaps before changing section/ISO or
   camera smoothing behavior.

## Stable Matrix Artifact Root - 2026-05-31T04:01Z heartbeat

Preflight:

- Working from the real repo path: `C:\GeoSee\GeoSee_Dev`.
- `test-results` had already been cleaned by Playwright and contained only
  `.last-run.json`.
- The latest on-disk prep checkpoint was the RAF smoothness evidence blocker
  above.
- Git worktree remained dirty from transition instrumentation plus unrelated
  editor/UI changes. No unrelated changes were reverted.

Tooling change:

- `tools/capture-transition-matrix.mjs`
  - Default matrix output root moved from `test-results/...` to
    `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-...`.
  - `TRANSITION_MATRIX_OUT` still overrides the default.
- `tools/analyze-transition-matrix.mjs`
  - Default report search root moved from `test-results` to
    `docs/dev-context/artifacts/transition-matrix`.

New durable matrix:

- Artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T04-04-03-526Z`
- Manifest:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T04-04-03-526Z/manifest.json`
- Report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T04-04-03-526Z/transition-analysis.md`
- Video:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T04-04-03-526Z/videos/page@0536a7f6362c2a348580993ea5489c27.webm`
- Trace files on disk after Playwright cleanup: `27`.

Clean matrix status:

| Metric | Count |
| --- | ---: |
| cases | 27 |
| productEntries | 747 |
| stateSourceOnly | 156 |
| loadedAtStartFalse | 24 |
| unloadedDormantHelperState | 24 |
| unloadedUnresolvedState | 0 |
| opacityJumps | 82 |
| opacityJumpCovered | 82 |
| opacityJumpUnresolved | 0 |
| policyMismatches | 0 |
| hiddenProductState | 132 |
| hiddenDormantState | 132 |
| hiddenUnresolvedState | 0 |
| sectionIsoEntries | 0 |
| sectionIsoRenderOpacityMismatch | 20 |
| sceneSectionGroundTraceRisk | 3 |
| cameraPathRisk | 2 |
| smoothnessTraceQualityRisk | 27 |
| adjacentTransitionCoverageGaps | 0 |
| matrixCaptureFailures | 0 |
| interruptionDivergences | 0 |
| lateReapplyDuringTransition | 1 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |

Smoothness evidence:

- All traces are `app-raf`.
- Active sample density is still not good enough for visual policy changes:
  - minimum active samples: `7`
  - maximum active samples: `14`
  - maximum active sample gap: about `1416.6ms`
  - `A20` (`99_unresolved_missing_tools` -> `101_page`): `8` active samples,
    max active gap about `1216.6ms`, stopped at max duration.
  - `A25` (`103_page` -> `105_page`): `10` active samples, max active gap
    about `1250ms`, settled.
- Compared with the logged 03:32Z RAF baseline, the durable rerun preserved the
  same high-level result: no capture failures, no unexpected console errors, no
  interruption divergence, and all `27` transitions still have smoothness trace
  quality risk.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Stable output-root change is syntax clean. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Stable results-root change is syntax clean. |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Escalated because sandbox blocks Node test worker spawn. |
| `npx tsc --noEmit --pretty false` | PASS | Typecheck clean. |
| `npm run audit:transition-matrix` | PASS | Captured all 27 cases to the durable docs artifact root from Vite on `127.0.0.1:5174`. |
| `npm run audit:transition-report` | PASS | Report defaults to the durable artifact root and wrote `transition-analysis.md`. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | All 4 focused orchestration tests passed. Playwright cleaned `test-results`, but the durable matrix artifact remained on disk. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `npm run build` | PASS | Production build completed. |
| `git diff --check` | FAIL | Existing line-ending warnings and the existing `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF finding remain. Not introduced or fixed in this pass. |

Decision:

- Do not start section/ISO or camera runtime smoothing yet.
- The user-reported camera stall/jump and ISO opacity snap are now best treated
  as base orchestration/root-rule issues, not fixture-specific patches.
- Next safest pass is deeper root-cause instrumentation around long active RAF
  gaps:
  - record per-sample `dtMs` and long-gap buckets in smoothness traces;
  - record page-source, scene-source, transition source/target, and camera pose
    source/target on every sample;
  - record scene snapshot/rebuild counters and product-family rebuild counters;
  - record whether section ISO/ground-trace async work completed during each
    active transition gap;
  - expose camera interpolation inputs and page-source selection so pages that
    already share a layer cannot accidentally fade/translate it as if it were a
    new object.

## Root-Rule Timing Pass and Working-Area No-Op Fix - 2026-05-31T06:10Z heartbeat

Preflight:

- Worked from the real repo path: `C:\GeoSee\GeoSee_Dev`.
- Latest durable baseline before this pass:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-12-30-880Z`.
- The worktree was already dirty from transition instrumentation and unrelated
  editor/UI files. No unrelated changes were reverted.
- User clarification for this pass: pages are throwaway examples; fix/audit
  base transition rules, clocks, ownership, and state-source logic.

Instrumentation added:

- `src/pages/PageController.tsx`
  - Smoothness trace samples now include `dtMs`, long-gap classification,
    camera source/target pose diagnostics, and scene transition debug state.
  - Scene samples now carry the latest frame-stage timing and layer-tween
    substage timing from `SceneManager`.
- `src/scene/SceneManager.ts`
  - `getTransitionDebugState()` now exposes frame-update timing, layer-tween
    tick timing, scene-section helper opacity, working-area tween state,
    scene-section style tween state, helper snapshot state, product-family
    counts, and late-reapply counters.
- `src/scene/transitions/layerTweenRuntime.ts`
  - Layer-tween ticks now record substage timings for scene-section planes,
    working-area focus, scalar style, layer opacity, layer snapshots, helper
    snapshots, and transition-envelope enforcement.
- `tools/analyze-transition-matrix.mjs`
  - Long active trace gaps now report frame/tick timings, active layer tween
    ids, active snapshot ids, scene-section/helper flags, camera step distance,
    and late-reapply deltas.

First root-cause finding:

- Diagnostic matrix `transition-matrix-debug-2026-05-31T04-49-43-810Z`
  showed all `111` long active gaps had `workingAreaFocusTweenActive=true`
  and `activeDataTransitionCount=2`.
- Root cause: `transitionWorkingAreaFocusForPageImpl` started a working-area
  focus tween on every duration-based page transition even when resolved
  working-area focus state was unchanged.
- Regression added:
  `Unchanged working-area focus state does not start a transition tween`.
  - Red result: `workingAreaFocusTweenActive` was `true`.
  - Fix: compare resolved working-area focus states and apply final style
    immediately when they are equal.
  - Green result: focused regression passed.

Post-fix baseline:

- Artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-12-30-880Z`
- Report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-12-30-880Z/transition-analysis.md`
- Key result:
  - `workingAreaFocusTweenActive` in long gaps: `111 -> 0`.
  - active data transitions in long gaps: `2 -> 1`.
  - `sceneSectionGroundTraceRisk`: `3 -> 0`.
  - `longActiveTraceGaps`: still `111`.
- Decision: the working-area no-op bug was real and is fixed, but it was not
  the final stall source. Continue root-cause instrumentation before any visual
  policy changes.

Capture-tool hardening:

- A full video-enabled timing run wrote all case artifacts under
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-37-15-220Z`,
  including a WebM in `videos/`, but hung before writing `manifest.json`.
- Cause of evidence loss: the capture tool waited for video finalization before
  writing the manifest.
- Tooling fix:
  - `tools/capture-transition-matrix.mjs` now writes a preliminary
    `manifest.json` before browser/video finalization.
  - Added `TRANSITION_MATRIX_VIDEO=0` for diagnostic runs where manifest
    durability is more important than another video.
  - Manifest now includes `videoStatus`.

Latest diagnostic matrix:

- Artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-54-38-342Z`
- Manifest:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-54-38-342Z/manifest.json`
- Report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-54-38-342Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-12-30-880Z`
- Video:
  disabled for this rerun with `TRANSITION_MATRIX_VIDEO=0`; use the prior
  `05-37-15-220Z/videos/page@5d7ff8da342444084966ad14e43998c6.webm`
  for human review.

Latest matrix counts:

| Metric | Count | Delta vs 05:12Z |
| --- | ---: | ---: |
| cases | 27 | 0 |
| productEntries | 318 | 19 |
| stateSourceOnly | 68 | 4 |
| loadedAtStartFalse | 12 | 1 |
| opacityJumps | 33 | 3 |
| opacityJumpCovered | 33 | 3 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 56 | 3 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 12 | 1 |
| sceneSectionGroundTraceRisk | 1 | 1 |
| cameraPathRisk | 2 | 0 |
| smoothnessTraceQualityRisk | 26 | -1 |
| longActiveTraceGaps | 106 | -5 |
| matrixCaptureFailures | 1 | 1 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 1 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Timing aggregate from latest matrix:

- Long active gaps: `106`.
- Long gaps with scene-section style tween active: `25`.
- Long gaps without scene-section style tween: `81`.
- Long gaps with scene-section helper snapshot active: `4`.
- Average `frameLayerTweensMs` when scene-section tween is active: `11.892ms`.
- Average `frameLayerTweensMs` when scene-section tween is not active:
  `0.321ms`.
- Average `tickSceneSectionMs` for scene-section long gaps: `11.512ms`.
- Max `tickSceneSectionMs`: `22.8ms`.
- Max frame time recorded in a long-gap sample: `23.3ms`.
- Top stall rows are dominated by `sceneSectionStyleTweenActive=true` and
  `tickLayerIds=utah-forge-mt-resistivity-volume`; the expensive substage is
  scene-section plane application, not the MT volume opacity tween itself.
- A25 remains important because it combines:
  - large camera path risk (`103_page -> 105_page`, sampled position distance
    about `1,767,188.9`);
  - scene-section helper translation (`opacity 1 -> 0`);
  - helper snapshot active;
  - MT volume discrete crossfade;
  - section ISO render-opacity mismatch risk.

Blocking matrix finding:

- `A04` (`05_mt_threshold_focus -> 08_mt_threshold_surfaces`) failed in
  `source-settle`.
- Observed state at failure: `12_mt_volume_overview -> unknown`.
- Message: `page.waitForFunction: Timeout 20000ms exceeded.`
- Screenshot:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-54-38-342Z/A04-adjacent-05_mt_threshold_focus-to-08_mt_threshold_surfaces/failure.png`
- Decision: stop before visual smoothing. The next pass must classify whether
  this is a capture recovery/source-settle bug or an app navigation/setCurrent
  bug. Do not patch section/ISO opacity or camera motion until this is known.

Recommendations:

1. Fix or classify `A04` source-settle failure first. This is now the blocking
   audit item because the matrix cannot be treated as fully green.
2. After `A04` is classified, make the next base-rule pass on scene-section
   plane tween cost/ownership:
   - avoid reapplying unchanged scene-section planes every transition frame;
   - split helper translation/fade from ground-trace visibility so the ground
     trace cannot snap out before the target/source policy says it should;
   - keep this as a base rule, not a fixture-specific patch.
3. Keep section ISO opacity separate from MT volume layer opacity. Current
   evidence still shows section ISO render-opacity mismatch risk in A20/A25.
4. Treat A25 camera movement separately from visual layer handoff. It has a
   large camera path, but the measured frame-stage cost on the top A25 gap is
   low; the visible jump is likely path distance plus layer/helper policy, not
   one heavy frame alone.
5. Preserve the working-area no-op comparison permanently; it removed one
   false active transition source without changing visual policy.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Capture tool syntax clean after preliminary manifest/video toggle. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean after timing fields. |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Escalated because Node test worker spawn is sandbox-blocked. |
| `npx tsc --noEmit --pretty false` | PASS | Typecheck clean. |
| `npm run audit:transition-report` | PASS | Wrote latest `transition-analysis.md`; includes one matrix capture failure. |
| `npm run audit:transition-matrix` | PASS with captured failure | No-video rerun completed and wrote manifest; A04 source-settle failure is recorded as blocking evidence. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | First run hit sandbox artifact unlink; escalated rerun passed all 5 tests. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `npm run build` | PASS | Production build completed. |
| `git diff --check` | FAIL | Existing line-ending warnings plus the known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF finding remain. Not fixed in this pass. |

Operational cleanup:

- Vite and transition-matrix processes from this pass were stopped.
- Process inspection after cleanup showed no remaining `node_modules.*vite` or
  `capture-transition-matrix` process except the inspection command itself.
- Heartbeat automation `transition-smoothing-unattended-pass` was updated to
  use `05-54-38-342Z` as the diagnostic baseline and to prioritize the A04
  source-settle blocker before scene-section/ISO/camera visual fixes.

## A04 Source-Settle Classification and Tooling Fix - 2026-05-31T06:39Z heartbeat

Preflight:

- Worked from the real repo path: `C:\GeoSee\GeoSee_Dev`.
- Latest baseline before this pass:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-54-38-342Z`.
- Blocking item from prior pass: `A04` source-settle failed while observed
  page state had reset to `12_mt_volume_overview -> unknown`.
- No unrelated worktree changes were reverted.

Classification:

- `A03` ended correctly on `05_mt_threshold_focus` at index `3`.
- `A04` then called `gotoAndSettle(3)`, which should have been an immediate
  no-op settle because the page was already at index `3`.
- During the 20s settle wait, the app reset to index `0`
  (`12_mt_volume_overview`) with no active transition.
- This pattern matches Vite dev-server reload during matrix artifact writes,
  not a page transition source/target logic failure.
- Root cause: the durable matrix artifact root lives under
  `docs/dev-context/artifacts/transition-matrix`, inside the Vite project root.
  Vite was already configured to ignore `projects/**` so authoring writes do
  not reload the app, but generated matrix artifacts were not ignored.

Fix:

- `vite.config.ts`
  - Added watcher ignores for:
    - `**/docs/dev-context/artifacts/**`
    - `**/test-results/**`
    - `**/playwright-report/**`
  - Updated the watch comment to describe generated verification outputs.
- `tools/capture-transition-matrix.mjs`
  - Hardened `gotoAndSettle()` so it verifies `window.__pageController.goto`
    exists and throws `source-goto` immediately if the dev hook is missing,
    instead of silently no-oping and timing out as `source-settle`.

Verification matrix:

- Artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T06-23-28-187Z`
- Manifest:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T06-23-28-187Z/manifest.json`
- Report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T06-23-28-187Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T05-54-38-342Z`
- `TRANSITION_MATRIX_VIDEO=0` was used; `videoStatus` is `disabled`.
- Cases: `27`.
- Matrix capture / trace failures: `0`.
- Unexpected console messages: `0`.
- Expected Chromium/WebGL ReadPixels warning-class messages: `4`.
- A04 captured and replayed successfully:
  `A04-adjacent-05_mt_threshold_focus-to-08_mt_threshold_surfaces/trace.json`.

Updated counts:

| Metric | Count | Delta vs 05:54Z |
| --- | ---: | ---: |
| productEntries | 317 | -1 |
| stateSourceOnly | 68 | 0 |
| loadedAtStartFalse | 11 | -1 |
| unloadedUnresolvedState | 0 | 0 |
| opacityJumps | 28 | -5 |
| opacityJumpCovered | 28 | -5 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 57 | 1 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 11 | -1 |
| sceneSectionGroundTraceRisk | 0 | -1 |
| cameraPathRisk | 2 | 0 |
| smoothnessTraceQualityRisk | 27 | 1 |
| longActiveTraceGaps | 112 | 6 |
| matrixCaptureFailures | 0 | -1 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 1 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Remaining transition findings:

- A04 is no longer blocking. It is classified as a dev-server/tooling reload
  issue caused by generated artifacts being watched by Vite.
- Scene-section ground-trace handoff risk is now `0` in the analyzer.
- Section ISO render-opacity mismatch risk remains (`11`), with A20 called out
  in the report.
- Camera path risk remains (`2`): A20 and A25.
- Long active gaps remain (`112`), still dominated by the shared
  `utah-forge-mt-resistivity-volume` layer tween and, in the larger scene
  section cases, scene-section plane work.

Next recommendation:

1. Start the next visual/base-rule pass on section ISO opacity ownership and
   scene-section plane update cost.
2. Keep it narrow:
   - expose the policy/debug state first or in the same pass;
   - do not change camera-only smoothing yet;
   - do not patch page IDs directly.
3. Preserve the Vite watch ignore and `gotoAndSettle()` hook check as matrix
   stability safeguards.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Capture syntax clean after `gotoAndSettle` hardening. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax still clean. |
| `npx tsc --noEmit --pretty false` | PASS | Typecheck clean before matrix rerun. |
| `npm run audit:transition-matrix` | PASS | Full no-video matrix captured all 27 cases; A04 passed; failures `0`. |
| `npm run audit:transition-report` | PASS | Latest report written with `matrixCaptureFailures=0`. |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Escalated because Node test worker spawn is sandbox-blocked. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `npm run build` | PASS | Production build completed. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | All 5 transition orchestration tests passed. |
| `git diff --check` | FAIL | Existing line-ending warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Operational cleanup:

- The matrix Vite server was stopped after capture/report.
- Final process inspection showed no remaining `node_modules.*vite` or
  `capture-transition-matrix` process except the inspection command itself.

## 2026-05-31 00:56 local - Section ISO ownership and scene-section helper pass

Scope:

- Continued from accepted baseline:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T06-23-28-187Z`.
- Kept the pass to base transition rules, not fixture-specific fixes.
- Targeted the first narrow visual family: section ISO opacity ownership and
  scene-section helper/plane update cost.

Runtime fixes:

- `src/scene/SceneManager.ts`
  - Section ISO overlay materials are no longer used as parent scalar-volume
    render opacity evidence.
  - Parent layer opacity is now tracked separately as
    `sectionIsoLayerRenderOpacity`.
  - Overlay transition opacity is preserved independently as
    `sectionIsoTransitionOpacity`.
  - Debug state now exposes the policy:
    `split-section-iso-overlay-opacity-from-layer-opacity`.
  - This directly addresses the visible symptom where section ISO bands/lines
    dimmed with an MT volume fade and then snapped back at the end.
- `src/scene/transitions/layerTweenRuntime.ts`
  and `src/scene/transitions/transitionEffectiveLayersForPage.ts`
  - Discrete scene-section transitions now reuse the already-applied target
    planes after the initial reapply.
  - Active frames use a helper-opacity-only path when safe instead of
    reapplying full scene-section planes every frame.
  - Debug state now exposes `sceneSectionApplyMode`.

Regression coverage:

- Added a direct section ISO regression:
  `Section ISO overlay opacity is independent from scalar volume layer fades`.
- Added a scene-section helper regression:
  `Scene section discrete helper fades reuse target planes after first frame`.
- Hardened the MT volume opacity policy test so it no longer assumes fixed page
  indexes. It now derives a valid source/target pair from current
  `pageOrder` and effective MT volume visibility/opacity inputs.

Important audit finding from the MT test hardening:

- Authored MT volume layer visibility is not the same as actual raymarched
  volume render opacity when section ISO is enabled.
- Current Utah FORGE pages commonly have:
  - `utah-forge-mt-resistivity-volume` authored/effective layer visible.
  - `sectionIsoEnabled: true`.
  - `sectionIsoSourceOpacity: 0`.
  - Raymarched volume render opacity therefore resolves to `0`, while section
    ISO overlays remain visible.
- The previous MT test had been implicitly relying on ISO overlay material
  opacity to make the parent volume look source-visible in transition debug.
  That coupling is now removed.
- Recommendation: the next MT-family pass should explicitly expose and govern
  three separate concepts in debug/policy:
  authored layer visibility, raymarched volume render opacity, and section ISO
  overlay presence. Do not let a parent MT volume fade make a hidden raymarched
  volume appear when the page is intentionally using only ISO overlays.

Completed matrix/report artifact:

- Valid matrix:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T07-06-37-415Z`
- Manifest:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T07-06-37-415Z/manifest.json`
- Report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T07-06-37-415Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T06-23-28-187Z`
- `TRANSITION_MATRIX_VIDEO=0` was used; `videoStatus` is `disabled`.

Updated counts from the valid artifact:

| Metric | Count | Delta vs 06:23Z |
| --- | ---: | ---: |
| productEntries | 332 | 15 |
| stateSourceOnly | 73 | 5 |
| loadedAtStartFalse | 14 | 3 |
| unloadedDormantHelperState | 14 | 3 |
| unloadedUnresolvedState | 0 | 0 |
| opacityJumps | 34 | 6 |
| opacityJumpCovered | 34 | 6 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 59 | 2 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | -11 |
| sceneSectionGroundTraceRisk | 2 | 2 |
| cameraPathRisk | 2 | 0 |
| smoothnessTraceQualityRisk | 27 | 0 |
| longActiveTraceGaps | 116 | 4 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 1 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Interpretation:

- Section ISO render-opacity mismatch is cleared: `11 -> 0`.
- The discrete scene-section helper path is cheaper in the A25-style handoff:
  latest valid report shows helper snapshot work without repeating full
  `tickSceneSection` work on helper-only frames.
- Continuous scene-section transitions still show expensive plane work:
  A20, A21, and S01 remain the clearest timing rows.
- Scene-section ground-trace handoff risk is back in view:
  A25 reports `scene-section-ground-trace-disable-risk`.
- Camera-path risk remains unchanged and should still wait until visual layer
  ownership is cleaner.

Incomplete matrix rerun:

- A later no-video rerun created
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T07-44-36-976Z`
  but did not write `manifest.json`.
- It reached the final supplemental case directory and then stalled during
  finalization. The capture process was stopped.
- Treat this as an incomplete tooling artifact, not a valid matrix result.
  Future preflight should ignore it unless a manifest is added.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools\capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --check tools\analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --test tests\tools\analyze-transition-matrix.test.mjs` | PASS | Escalated because Node test worker spawn is sandbox-blocked. |
| `npx tsc --noEmit --pretty false` | PASS | Typecheck clean after runtime and test changes. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | All 7 transition orchestration tests passed. |
| `npm run audit:transition-matrix` | PASS | Valid no-video matrix is `07-06-37-415Z`; a later rerun stalled without manifest and was stopped. |
| `npm run audit:transition-report` | PASS | Report regenerated for valid `07-06-37-415Z` artifact. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing line-ending warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Next recommendation:

1. Do not begin camera-only smoothing yet.
2. Fix scene-section ground-trace/helper ownership next:
   - A25 ground-trace disable handoff should hold or snapshot through helper
     fade instead of disappearing mid-transition.
   - Continuous scene-section plane updates in A20/A21/S01 need caching or a
     lower-cost interpolation path before more visual families are changed.
3. Then handle MT volume handoffs as the next separate family:
   - expose authored layer visibility vs raymarched render opacity vs ISO
     overlay presence;
   - prevent hidden raymarched volume from appearing solely because parent
     layer opacity is tweened;
   - rerun matrix/report before moving to surfaces or seismic products.
4. Preserve the current section ISO split and the discrete helper-only path.

## 2026-05-31 ground-trace helper ownership pass

Purpose:

- Address the remaining scene-section helper/ground-trace ownership issue as a
  base transition rule, not as a fixture-specific matrix-case fix.
- Preserve the existing section ISO split and avoid starting camera-only
  smoothing until helper ownership is cleanly exposed in debug/matrix output.

Root cause:

- Scene-section ground-trace mesh creation is asynchronous because it waits on
  the height sampler.
- If the target page disables scene-section helpers while the source helper fade
  snapshot is active, the live helper group can be cleared before the delayed
  ground-trace mesh resolves.
- The helper fade snapshot previously captured only the objects that existed at
  snapshot start, so a delayed ground-trace mesh could disappear instead of
  fading with the rest of the helper geometry.

Runtime/debug changes:

- `SceneManager` now exposes `sceneSectionHelpers` in transition debug:
  `groundTracePolicy`, live/snapshot ground-trace counts, snapshot active state,
  and helper transition opacity.
- Delayed scene-section ground-trace meshes are mirrored into an active helper
  transition snapshot using the policy
  `mirror-delayed-ground-trace-into-helper-snapshot`.
- The app-side smoothness trace and matrix state summaries now include the
  `sceneSectionHelpers` debug object.
- The transition matrix analyzer now splits scene-section ground-trace handoffs
  into unresolved risk vs snapshot-covered rows:
  - unresolved: `scene-section-ground-trace-disable-risk`
  - covered: `scene-section-ground-trace-snapshot-covered`

Test changes:

- Added a regression covering the async ground-trace case:
  `Scene section helper snapshot receives delayed ground-trace geometry`.
- The test failed before the runtime fix because the helper snapshot never
  received a ground-trace object.
- The interruption debug test was also made deterministic: it now captures the
  interrupted run synchronously immediately after `goto(2)` instead of trying
  to observe a short active window in a second Playwright poll. This removes the
  full-suite timing race while still asserting the same source/target/run-id
  contract.

Matrix/tooling changes:

- The capture tool now writes a manifest checkpoint before trace replay and
  after each trace replay. A trace replay stall can no longer leave a complete
  screenshot/state capture without a manifest.
- Added `TRANSITION_MATRIX_TRACE=0` support. When trace replay is disabled, the
  manifest writes `traceStatus: "disabled"` and the analyzer warns that the
  artifact is valid for policy/source-target classification only, not camera or
  smoothness timing conclusions.
- Fixed final manifest writing so `traceStatus` remains `disabled` when trace
  replay was intentionally skipped.

Artifact notes:

- A default no-video matrix run wrote screenshot/state artifacts to
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T08-24-39-212Z`
  but stalled during trace replay after A19 and before manifest writing. The
  stuck capture process was stopped. Treat this as an incomplete tooling
  artifact.
- The raw A25 mid-state in that incomplete artifact still confirmed the runtime
  ownership fix:
  - `groundTracePolicy`: `mirror-delayed-ground-trace-into-helper-snapshot`
  - `liveGroundTraceCount`: `0`
  - `snapshotGroundTraceCount`: `1`
  - `snapshotActive`: `true`
- Valid policy-classification matrix:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T08-43-10-684Z`
- Manifest:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T08-43-10-684Z/manifest.json`
- Report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T08-43-10-684Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T07-06-37-415Z`
- `TRANSITION_MATRIX_VIDEO=0` and `TRANSITION_MATRIX_TRACE=0` were used for the
  valid artifact. It is not timing/smoothness evidence.

Updated policy-classification counts from the valid artifact:

| Metric | Count | Delta vs 07:06Z |
| --- | ---: | ---: |
| productEntries | 505 | 173 |
| traceReplayDisabled | 1 | 1 |
| stateSourceOnly | 101 | 28 |
| loadedAtStartFalse | 19 | 5 |
| unloadedDormantHelperState | 19 | 5 |
| unloadedUnresolvedState | 0 | 0 |
| opacityJumps | 54 | 20 |
| opacityJumpCovered | 54 | 20 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 82 | 23 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | -2 |
| sceneSectionGroundTraceCovered | 1 | 1 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 1 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Interpretation:

- A25 scene-section helper disable handoff is now classified as covered:
  `scene-section-ground-trace-snapshot-covered`, with
  `snapshotGroundTraceCount=1`.
- `sceneSectionGroundTraceRisk` is cleared in policy/state evidence: `2 -> 0`.
- The apparent `cameraPathRisk`, `smoothnessTraceQualityRisk`, and
  `longActiveTraceGaps` drops in this artifact are not meaningful because trace
  replay was disabled. Use the earlier traced artifact for timing evidence until
  trace replay checkpointing/stall handling is further hardened.
- The next visual/base-rule target should be continuous scene-section plane
  update cost in A20/A21/S01, then MT volume handoffs. Camera-only smoothing
  should still wait.

Verification so far in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean after checkpoint/traceStatus changes. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean after covered/risk split and traceStatus warning. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | Escalated because Node test worker spawn is sandbox-blocked. |
| `npx tsc --noEmit --pretty false` | PASS | Typecheck clean. |
| Focused ground-trace Playwright regression | PASS | Snapshot receives delayed ground-trace geometry. |
| Focused interruption Playwright regression | PASS | Deterministic immediate interrupted-run snapshot. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed after interruption test stabilization. |
| First `npm run audit:transition-matrix` attempt | FAIL | No Vite server listening; started Vite from `C:\GeoSee\GeoSee_Dev`. |
| Default no-video matrix with trace replay | STOPPED | Reached all screenshot cases, then stalled during trace replay after A19 before manifest. |
| Trace-disabled no-video matrix | PASS | Valid policy-classification artifact is `08-43-10-684Z`. |
| `npm run audit:transition-report` | PASS | Report regenerated with `traceStatus: disabled` warning. |

Final verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing line-ending warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped before reporting.

## 2026-05-31 targeted A20/A21/S01 trace diagnostics

Purpose:

- Restore trustworthy traced timing evidence before changing continuous
  scene-section plane/helper behavior.
- Classify the suspected A20 trace replay stall from the previous full traced
  matrix run.

Preflight:

- Latest valid full policy-classification artifact remained
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T08-43-10-684Z`
  with `traceStatus: "disabled"`.
- The previous default traced artifact
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T08-24-39-212Z`
  was incomplete because it had no manifest.

Root-cause update:

- The old "A20 trace replay stall" hypothesis was wrong.
- Inspecting the incomplete traced artifact showed regular-case traces exist for
  A20, A21, A22, A23, A24, A25, and S01.
- The only missing trace in that artifact is the interruption case
  `06-rapid-interruption-mt-volume-low-high`.
- Therefore the old full traced run should be classified as "regular traces
  completed; interruption trace/final manifest path was not checkpointed in the
  old tool revision", not as an A20 app transition hang.

Tooling changes:

- Added `TRANSITION_MATRIX_CASES` to `tools/capture-transition-matrix.mjs` so
  matrix runs can target specific case ids/names, for example
  `A20,A21,S01`.
- Selected-case manifests now set `matrixScope.mode: "selected-cases"` with
  `selectedCaseIds` and `activeCaseCount`.
- The analyzer now suppresses full adjacent-coverage-gap warnings for
  selected-case matrices.
- Added anti-throttling Chromium launch flags to the capture browser:
  `--disable-background-timer-throttling`,
  `--disable-backgrounding-occluded-windows`,
  `--disable-features=CalculateNativeWinOcclusion`, and
  `--disable-renderer-backgrounding`.
- Added render-loop timing debug to `scene.ts` and app-side smoothness traces:
  total frame time, ticker callbacks, controls update, manager frame update,
  render time, and ticker count.
- The analyzer now includes render-loop timing in long active trace gap rows.

TDD notes:

- Added a selected-case analyzer test first and verified it failed because the
  analyzer treated a selected matrix as missing the rest of adjacent coverage.
- Implemented selected-case coverage handling and verified the test passed.
- Added a smoothness trace assertion for render-loop timing first and verified
  it failed because traces did not expose render-loop timing.
- Implemented render-loop timing instrumentation and verified the focused
  smoothness trace test passed.

Artifacts:

- First selected traced artifact, before anti-throttling/render-loop detail:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T09-03-00-862Z`
- Selected traced artifact after anti-throttling flags:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T09-07-06-652Z`
- Latest selected traced artifact with render-loop timing:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T09-15-08-548Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T09-15-08-548Z/transition-analysis.md`

Latest selected traced counts:

| Metric | Count |
| --- | ---: |
| cases | 3 |
| productEntries | 80 |
| traceReplayDisabled | 0 |
| opacityJumps | 8 |
| opacityJumpCovered | 8 |
| opacityJumpUnresolved | 0 |
| policyMismatches | 0 |
| sectionIsoRenderOpacityMismatch | 0 |
| sceneSectionGroundTraceRisk | 0 |
| cameraPathRisk | 1 |
| smoothnessTraceQualityRisk | 3 |
| longActiveTraceGaps | 9 |
| matrixCaptureFailures | 0 |
| interruptionDivergences | 0 |
| unexpectedConsole | 0 |
| expectedReadPixelsWarnings | 4 |

Timing findings:

- Anti-throttling Chromium flags did not materially improve active sample
  density. A20/A21/S01 still record only 8 active samples each, with max active
  gaps around 900-983 ms.
- Latest traced rows show the long gaps are not explained solely by
  `tickSceneSection`:
  - A20 worst row: `gapMs=983.3`, `tickSceneSectionMs=25.3`,
    `renderLoopMs=93`, `renderLoopTickersMs=31.1`,
    `renderLoopManagerMs=25.8`, `renderLoopRenderMs=36.1`.
  - A21 worst row: `gapMs=949.9`, `tickSceneSectionMs=16.2`,
    `renderLoopMs=72.1`, `renderLoopTickersMs=33.3`,
    `renderLoopManagerMs=16.6`, `renderLoopRenderMs=22.2`.
  - S01 worst row: `gapMs=899.9`, `tickSceneSectionMs=4.4`,
    `renderLoopMs=53.8`, `renderLoopTickersMs=33`,
    `renderLoopManagerMs=4.8`, `renderLoopRenderMs=16`.
- Interpretation: there is real render-loop cadence loss in the trace
  environment. Continuous scene-section work contributes measurable frame cost,
  but the missing 800-980 ms is outside the currently measured per-frame
  sections. Do not start visual smoothing until that cadence loss is classified
  as either headless/test-environment throttling or an app/runtime main-thread
  stall.
- A20 still has camera-path risk: `positionDistance` about `571731.9`, maximum
  sampled camera step about `340834.4` over `933.3ms`. This supports the user's
  observed camera stall/jump concern, but camera-only smoothing should still
  wait until the frame cadence question is resolved.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer selected-case red test | FAIL then PASS | Confirmed selected matrices no longer report full adjacent coverage gaps. |
| Focused render-loop trace red test | FAIL then PASS | Confirmed traces now expose render-loop timing. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | Escalated because Node test worker spawn is sandbox-blocked. |
| `npx tsc --noEmit --pretty false` | PASS | Fresh rerun completed. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest artifact is `09-15-08-548Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped before reporting.

Next recommendation:

1. Do not begin visual smoothing yet.
2. Classify render-loop cadence loss:
   - add/directly expose RAF delta/cadence in `SceneRenderLoopDebugState`;
   - compare targeted trace cadence in headless Chromium vs a human-visible or
     video capture path if available;
   - identify whether the 800-980 ms gaps are browser throttling, GPU/render
     blocking, React/PageController callback cost, or unmeasured app work.
3. Once cadence is trustworthy, reduce continuous scene-section plane update
   cost separately from MT volume handoff policy.
4. Keep camera-only smoothing after scene-section and MT ownership are cleaner.

## 2026-05-31 02:40 - RAF Cadence Classification

Goal: classify the remaining trace-quality blocker before any new visual
smoothing. The previous targeted traces showed long active gaps, but the trace
did not yet prove whether RAF itself was delayed or whether only app-side
sampling/reporting was sparse.

Tooling changes:

- Extended `SceneRenderLoopDebugState` with direct render-loop cadence fields:
  `frameIndex`, `rafDeltaMs`, `wallDeltaMs`, and `idleGapMs`.
- Added those fields to app-side smoothness trace samples so matrix artifacts
  can distinguish long transition gaps from missing RAF cadence.
- Updated the analyzer to classify long active gaps as
  `long-gap-with-raf-cadence-loss` when the render loop's RAF or wall-clock
  delta itself exceeds the active-gap threshold.
- Added analyzer output columns for `renderLoopFrame`,
  `renderLoopRafDeltaMs`, `renderLoopWallDeltaMs`, and
  `renderLoopIdleGapMs`.

TDD notes:

- Added a focused smoothness trace assertion for direct RAF cadence fields and
  verified it failed before the scene debug state exposed those fields.
- Implemented the render-loop cadence instrumentation and verified the focused
  smoothness trace test passed.
- Added an analyzer unit test for `long-gap-with-raf-cadence-loss` and verified
  the analyzer reports the RAF/wall/idle timing in long-gap diagnostics.

Artifacts:

- Latest selected traced artifact with direct RAF cadence:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T09-35-09-932Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T09-35-09-932Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T09-15-08-548Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 80 | 0 |
| traceReplayDisabled | 0 | 0 |
| stateSourceOnly | 16 | 0 |
| loadedAtStartFalse | 8 | 0 |
| opacityJumps | 8 | 0 |
| opacityJumpCovered | 8 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Cadence findings:

- All 9 long active gaps in A20/A21/S01 are now classified as
  `long-gap-with-raf-cadence-loss`.
- Representative worst rows:
  - A20: `gapMs=983.3`, `renderLoopFrame=150`,
    `renderLoopRafDeltaMs=966.6`, `renderLoopWallDeltaMs=947.3`,
    `renderLoopIdleGapMs=889.4`, `renderLoopMs=77.1`,
    `renderLoopTickersMs=34`, `renderLoopManagerMs=12.7`,
    `renderLoopRenderMs=30.4`, `tickSceneSectionMs=12.3`.
  - A21: `gapMs=983.3`, `renderLoopFrame=161`,
    `renderLoopRafDeltaMs=899.9`, `renderLoopWallDeltaMs=913.8`,
    `renderLoopIdleGapMs=853.5`, `renderLoopMs=70`,
    `renderLoopTickersMs=34.8`, `renderLoopManagerMs=14`,
    `renderLoopRenderMs=21.2`, `tickSceneSectionMs=13.5`.
  - S01: `gapMs=966.7`, `renderLoopFrame=173`,
    `renderLoopRafDeltaMs=733.2`, `renderLoopWallDeltaMs=1149.1`,
    `renderLoopIdleGapMs=1114.3`, `renderLoopMs=50`,
    `renderLoopTickersMs=32.9`, `renderLoopManagerMs=4.6`,
    `renderLoopRenderMs=12.5`, `tickSceneSectionMs=4.3`.
- Interpretation: the sparse trace samples are not only a trace/reporting
  artifact. The browser render loop itself is losing RAF/wall-clock cadence in
  this capture environment. Measured per-frame app/render work is tens of
  milliseconds in these rows, not the full 800-980 ms gap, so the next root
  cause split is headless/test-environment throttling or GPU/browser scheduling
  versus still-unmeasured app main-thread work.
- A20 still carries the camera-path risk:
  `positionDistance=569577.1`, `maxFramePositionDistance=353821.8` over
  `966.6ms`. This remains aligned with the user's observed camera stall/jump,
  but camera-only smoothing should wait until RAF cadence is trustworthy.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Focused RAF-cadence trace red test | FAIL then PASS | Confirmed traces now expose direct render-loop cadence. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | Includes RAF-cadence-loss classification. |
| `npx tsc --noEmit --pretty false` | PASS | Fresh rerun completed. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest artifact is `09-35-09-932Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: no listeners found on ports 5173 or 5174 before
reporting.

Next recommendation:

1. Do not begin runtime visual smoothing yet.
2. Compare the targeted A20/A21/S01 trace cadence in headless Chromium against
   a human-visible or video-backed path, or add a non-RAF heartbeat sampler to
   split browser RAF throttling from app main-thread blockage.
3. If RAF cadence loss is test-environment specific, visual smoothing can
   resume with continuous scene-section plane cost and MT handoffs. If cadence
   loss also appears in the visible path, investigate the unmeasured main-thread
   work before changing visual policies.

## 2026-05-31 03:10 - Independent Timer Cadence Split

Goal: split the `long-gap-with-raf-cadence-loss` blocker into RAF-only
throttling versus broader browser/main-thread/timer starvation before making
visual smoothing changes.

Tooling changes:

- Added an independent `setInterval` sampler to the smoothness trace path in
  `PageController`. It records `intervalMs`, `tickIndex`, `deltaMs`,
  `maxDeltaMs`, `ageMs`, and `ticksSinceLastSample` on each trace sample.
- The sampler is trace-scoped and is stopped on settled, max-duration, manual
  stop, or trace restart.
- Updated the analyzer to include timer diagnostics in long active trace gaps:
  `timerIntervalMs`, actual/expected timer ticks during the gap,
  `timerDeltaMs`, `timerMaxDeltaMs`, and `timerAgeMs`.
- Added two analyzer classifications:
  - `long-gap-with-raf-only-cadence-loss` when RAF slips but the independent
    timer keeps ticking.
  - `long-gap-with-raf-and-timer-cadence-loss` when both RAF and the timer
    lose cadence.

TDD notes:

- Added the trace assertion for timer diagnostics first and verified the
  focused smoothness trace test failed because samples had no `timerDebug`.
- Added analyzer tests for both RAF-only and RAF+timer cadence loss and
  verified they failed against the generic RAF-cadence classification.
- Implemented the timer sampler and analyzer split, then verified the focused
  smoothness trace test and analyzer tests passed.

Artifacts:

- Latest selected traced artifact with independent timer cadence:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T10-05-35-382Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T10-05-35-382Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T09-35-09-932Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 80 | 0 |
| traceReplayDisabled | 0 | 0 |
| stateSourceOnly | 16 | 0 |
| loadedAtStartFalse | 8 | 0 |
| opacityJumps | 8 | 0 |
| opacityJumpCovered | 8 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Cadence findings:

- All 9 long active gaps in A20/A21/S01 are now classified as
  `long-gap-with-raf-and-timer-cadence-loss`.
- This rules out a RAF-only explanation for the current headless capture path.
  The independent 50 ms timer usually records only 0-1 ticks across gaps where
  roughly 17-19 ticks were expected.
- Representative rows:
  - A20: `gapMs=966.6`, `renderLoopRafDeltaMs=949.9`,
    `renderLoopWallDeltaMs=942.7`, `renderLoopIdleGapMs=888.6`,
    `renderLoopMs=69.3`, `tickSceneSectionMs=12.3`,
    `timerTicks=1/19.332`, `timerDeltaMs=1896.5`,
    `timerMaxDeltaMs=1896.5`, `timerAgeMs=0`.
  - A21: `gapMs=933.3`, `renderLoopRafDeltaMs=916.6`,
    `renderLoopWallDeltaMs=916.9`, `renderLoopIdleGapMs=866.1`,
    `renderLoopMs=68.6`, `tickSceneSectionMs=13.5`,
    `timerTicks=1/18.666`, `timerDeltaMs=1851.9`,
    `timerMaxDeltaMs=1851.9`, `timerAgeMs=0`.
  - S01: `gapMs=950`, `renderLoopRafDeltaMs=733.3`,
    `renderLoopWallDeltaMs=1130.3`, `renderLoopIdleGapMs=1088.2`,
    `renderLoopMs=52.3`, `tickSceneSectionMs=4.5`,
    `timerTicks=1/19`, `timerDeltaMs=1683.7`,
    `timerMaxDeltaMs=1683.7`, `timerAgeMs=0`.
- Interpretation: the trace environment loses both RAF and normal interval
  cadence. The measured work inside sampled frames remains tens of milliseconds,
  not the entire 850-966 ms gap. The next split must compare this headless path
  to a visible/video-backed path or instrument unmeasured scheduling boundaries
  such as browser/GPU stalls, long tasks, or blocking work outside the current
  render-loop timers.
- A20 still carries camera-path risk: `positionDistance=570772.2` and
  `maxFramePositionDistance=344761` over `949.9ms`.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Focused timer trace red test | FAIL then PASS | Confirmed trace samples expose independent timer diagnostics. |
| Analyzer RAF-only / RAF+timer red tests | FAIL then PASS | Confirmed long-gap classification uses timer cadence. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 5 analyzer tests passed. |
| Focused smoothness trace Playwright test | PASS | Browser trace includes `timerDebug`. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `npx tsc --noEmit --pretty false` | PASS | Typecheck completed. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest artifact is `10-05-35-382Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped 5173 and 5174 listeners before reporting;
only transient `TIME_WAIT` sockets remained.

Next recommendation:

1. Do not begin runtime visual smoothing yet.
2. Compare the same A20/A21/S01 cadence in a human-visible or video-backed
   path. If visible/video cadence is smooth, treat the headless matrix cadence
   loss as a test-environment limitation and resume visual-policy work with
   careful human review clips. If visible/video cadence also stalls, instrument
   browser long tasks and unmeasured main-thread/GPU scheduling before changing
   visual policies.
3. Once cadence is trustworthy, proceed to continuous scene-section plane cost,
   then MT volume handoffs, then the remaining visual families.

## 2026-05-31 03:42 - Video-Backed Headless Cadence Check

Goal: compare A20/A21/S01 cadence with video recording enabled before deciding
whether the headless trace cadence loss can be treated as a test artifact.

Method:

- Ran the selected matrix with `TRANSITION_MATRIX_CASES=A20,A21,S01` and video
  recording enabled.
- This is still headless Chromium, but the artifact now includes a reviewable
  WebM clip for visual inspection alongside trace diagnostics.
- `ffprobe` is not available in this workspace, so video metadata was limited
  to file existence and size from the filesystem.

Artifacts:

- Latest video-backed selected traced artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T10-30-43-637Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T10-30-43-637Z/transition-analysis.md`
- Video:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T10-30-43-637Z/videos/page@67edc28dfaf2cd7ddbe639a10db7e349.webm`
  (`11,228,828` bytes)
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T10-05-35-382Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 80 | 0 |
| traceReplayDisabled | 0 | 0 |
| stateSourceOnly | 16 | 0 |
| loadedAtStartFalse | 8 | 0 |
| opacityJumps | 8 | 0 |
| opacityJumpCovered | 8 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Cadence findings:

- Video recording did not remove the cadence issue in the headless capture
  path. All 9 long active gaps remain
  `long-gap-with-raf-and-timer-cadence-loss`.
- Representative rows:
  - A20: `gapMs=1033.3`, `renderLoopRafDeltaMs=966.6`,
    `renderLoopWallDeltaMs=965.9`, `renderLoopIdleGapMs=907.3`,
    `renderLoopMs=86.1`, `tickSceneSectionMs=14.5`,
    `timerTicks=0/20.666`, `timerDeltaMs=982.6`,
    `timerMaxDeltaMs=3189.1`, `timerAgeMs=1009.6`.
  - A21: `gapMs=966.6`, `renderLoopRafDeltaMs=933.4`,
    `renderLoopWallDeltaMs=526.5`, `renderLoopIdleGapMs=474.7`,
    `renderLoopMs=58.3`, `tickSceneSectionMs=5.2`,
    `timerTicks=0/19.332`, `timerDeltaMs=1867`,
    `timerMaxDeltaMs=1867`, `timerAgeMs=950.3`.
  - S01: `gapMs=933.3`, `renderLoopRafDeltaMs=799.9`,
    `renderLoopWallDeltaMs=1228.9`, `renderLoopIdleGapMs=1191.2`,
    `renderLoopMs=56.7`, `tickSceneSectionMs=4.3`,
    `timerTicks=1/18.666`, `timerDeltaMs=1745.9`,
    `timerMaxDeltaMs=1745.9`, `timerAgeMs=0`.
- Interpretation: this is useful human-review evidence, but it is not an
  independent visible-browser comparison. The trace still shows headless
  browser/timer starvation, so visual smoothing should stay blocked until we
  either run a true headed/human-visible comparison or add long-task /
  scheduling instrumentation around unmeasured main-thread and GPU/browser
  boundaries.
- A20 still carries camera-path risk: `positionDistance=567042.4` and
  `maxFramePositionDistance=351986.1` over `966.6ms`.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Targeted video-backed matrix `A20,A21,S01` | PASS | Latest artifact is `10-30-43-637Z`, video status ready. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest video-backed artifact. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 5 analyzer tests passed. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | Fresh direct TypeScript CLI run completed; a parallel `npx tsc` wrapper session appeared stale and was not used as evidence. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped 5173 listeners before reporting; no 517x
listening sockets remained.

Next recommendation:

1. Do not begin runtime visual smoothing yet.
2. Add or run a true headed/human-visible cadence comparison, or add
   `PerformanceObserver` long-task diagnostics and any available browser/GPU
   scheduling markers to explain why both RAF and timers starve while measured
   frame work remains tens of milliseconds.
3. Use the WebM clip above for human review of whether the recorded headless
   path visibly shows the reported camera/opacity snags, but do not treat it as
   proof that a real visible browser behaves the same.

## 2026-05-31 04:12 - Long-Task Attribution Pass

Goal: explain why both RAF and the independent timer starve while measured
frame work remains tens of milliseconds.

Tooling changes:

- Added trace-scoped `PerformanceObserver` long-task collection to
  `PageController` smoothness traces.
- Each trace sample now includes `longTaskDebug` with support status, total
  count/duration, max duration, latest task timing, and per-sample deltas:
  `countSinceLastSample`, `durationSinceLastSampleMs`, and
  `maxDurationSinceLastSampleMs`.
- The analyzer now includes long-task fields in long active trace gap rows.
- Added classifications:
  - `long-gap-with-main-thread-longtask` when timer starvation has browser
    long-task evidence.
  - `long-gap-with-unattributed-timer-starvation` when timers starve but the
    Long Tasks API reports no task in that sample gap.

TDD notes:

- Added trace assertions for `longTaskDebug` first and verified the focused
  smoothness trace test failed before instrumentation.
- Added analyzer tests for long-task-backed and unattributed timer starvation
  first and verified they failed against the generic RAF+timer classification.
- Implemented the observer and analyzer split, then verified the focused
  smoothness trace test and analyzer tests passed.

Artifacts:

- Latest selected traced artifact with long-task diagnostics:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T11-04-46-866Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T11-04-46-866Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T10-30-43-637Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 80 | 0 |
| traceReplayDisabled | 0 | 0 |
| stateSourceOnly | 16 | 0 |
| loadedAtStartFalse | 8 | 0 |
| opacityJumps | 8 | 0 |
| opacityJumpCovered | 8 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Cadence / long-task findings:

- Long Tasks API is supported in the matrix browser (`longTaskSupported=true`).
- Of 9 long active gaps:
  - 6 are `long-gap-with-main-thread-longtask`.
  - 3 are `long-gap-with-unattributed-timer-starvation`.
- Representative long-task-backed rows:
  - A21: `gapMs=966.7`, `timerTicks=1/19.334`,
    `timerDeltaMs=1854.4`, `longTaskCount=2`,
    `longTaskDurationMs=1840`, `longTaskMaxMs=952`,
    while `renderLoopMs=73.9` and `tickSceneSectionMs=13.2`.
  - S01: `gapMs=916.6`, `timerTicks=1/18.332`,
    `timerDeltaMs=3224.9`, `longTaskCount=4`,
    `longTaskDurationMs=2820`, `longTaskMaxMs=868`,
    while `renderLoopMs=52.6` and `tickSceneSectionMs=3.9`.
  - A20 camera-step row: `gapMs=933.3`, `cameraStep=338662.5`,
    `timerTicks=0/18.666`, `longTaskCount=1`,
    `longTaskDurationMs=917`, `longTaskMaxMs=917`.
- Representative unattributed rows:
  - A20: `gapMs=966.7`, `timerTicks=1/19.334`,
    `timerDeltaMs=1881.3`, `longTaskCount=0`,
    `longTaskDurationMs=0`.
  - A21: `gapMs=883.2`, `timerTicks=0/17.664`,
    `timerDeltaMs=1765.3`, `longTaskCount=0`,
    `longTaskDurationMs=0`.
  - S01: `gapMs=816.6`, `timerTicks=0/16.332`,
    `timerDeltaMs=3224.9`, `longTaskCount=0`,
    `longTaskDurationMs=0`.
- Interpretation: the blocker is no longer generic RAF/timer cadence loss.
  Most gaps are backed by browser long-task entries, which makes real
  main-thread blocking likely in the capture path. A minority still starve
  timers with no long-task entry, so there may also be browser/GPU/process
  scheduling or unreported work. Runtime visual smoothing should remain
  blocked until the long-task source is identified or a true headed comparison
  proves the issue is capture-only.
- A20 still carries camera-path risk: `positionDistance=570839` and
  `maxFramePositionDistance=338662.5` over `933.3ms`.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Focused long-task trace red test | FAIL then PASS | Confirmed trace samples expose `longTaskDebug`. |
| Analyzer long-task attribution red tests | FAIL then PASS | Confirmed main-thread-longtask vs unattributed classification. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 7 analyzer tests passed. |
| Focused smoothness trace Playwright test | PASS | Browser trace includes `longTaskDebug`. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | Typecheck completed. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest artifact is `11-04-46-866Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped 5173 listeners before reporting; no 517x
listening sockets remained.

Next recommendation:

1. Do not begin runtime visual smoothing yet.
2. Identify the long-task source. The next safest pass should add attribution
   around expensive initialization/evaluation boundaries, or collect browser
   performance traces for A20/A21/S01, so the `longTaskDurationMs` rows can be
   tied to concrete work.
3. In parallel or after that, run a true headed/human-visible comparison if
   available. If headed cadence is smooth, treat this as capture-path overhead;
   if not, fix the long-task source before visual-policy changes.

## 2026-05-31 04:48 - Long Animation Frame Attribution Pass

Goal: tie the transition-active long gaps to concrete browser script work where
the Long Animation Frame API can provide script attribution.

Tooling changes:

- Added trace-scoped `PerformanceObserver` collection for
  `long-animation-frame` entries in `PageController` smoothness traces.
- Each trace sample now includes `animationFrameDebug` with support status,
  total frame count/duration, total blocking duration, per-sample duration and
  blocking deltas, and top per-sample scripts.
- Script attribution captures source URL, function name, invoker, invoker type,
  window attribution, script duration, execution start, forced style/layout
  duration, and pause duration.
- The analyzer now surfaces animation-frame fields in long active gap rows and
  prefers `long-gap-with-animation-frame-script` when timer starvation has
  LoAF script attribution.

TDD notes:

- Added an analyzer red test proving timer-starved gaps with LoAF script data
  were still classified as `long-gap-with-main-thread-longtask`.
- Added a focused browser trace red test proving live smoothness samples did
  not yet expose `animationFrameDebug`.
- Implemented the minimal trace/analyzer support and verified both tests turned
  green.

Artifacts:

- Latest selected traced artifact with LoAF attribution:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T11-38-57-317Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T11-38-57-317Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T11-04-46-866Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 80 | 0 |
| traceReplayDisabled | 0 | 0 |
| stateSourceOnly | 16 | 0 |
| loadedAtStartFalse | 8 | 0 |
| opacityJumps | 8 | 0 |
| opacityJumpCovered | 8 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 10 | +1 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Cadence / attribution findings:

- LoAF is supported in the matrix browser (`animationFrameSupported=true`).
- Of 10 long active gaps:
  - 6 are now `long-gap-with-animation-frame-script`.
  - 2 remain `long-gap-with-main-thread-longtask`.
  - 2 remain `long-gap-with-unattributed-timer-starvation`.
- Representative script-attributed rows:
  - A20: `gapMs=1016.6`, `timerTicks=1/20.332`,
    `longTaskDurationMs=1010`, `animationFrameDurationMs=756.9`,
    `animationFrameBlockingMs=697.53`,
    `animationFrameTopScript=node_modules/.vite/deps/chunk-NUMECXU6.js`,
    `animationFrameTopFunction=performWorkUntilDeadline`,
    `animationFrameTopInvoker=MessagePort.onmessage`.
  - A20: `gapMs=983.4`, `timerDeltaMs=3204.4`,
    `longTaskDurationMs=2776`,
    `animationFrameTopScript=src/scene.ts`,
    `animationFrameTopFunction=tick`,
    `animationFrameTopInvoker=FrameRequestCallback`.
  - S01: `gapMs=799.9`, `timerTicks=0/15.998`,
    `longTaskDurationMs=780`, `animationFrameBlockingMs=733.72`,
    `animationFrameTopScript=node_modules/.vite/deps/chunk-NUMECXU6.js`,
    `animationFrameTopFunction=performWorkUntilDeadline`.
- Interpretation: the long-gap source is now partially attributed. Some gaps
  are React scheduler work, some are scene render-loop ticks, and some remain
  unattributed even though timers starve. This is enough to stop treating the
  issue as only a generic capture cadence problem, but not enough to start
  visual-policy smoothing safely.
- A20 still carries camera-path risk: `positionDistance=570700.7` and
  `maxFramePositionDistance=349235.6` over `949.9ms`.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer LoAF attribution red test | FAIL then PASS | Confirmed LoAF script rows override generic long-task classification. |
| Focused smoothness trace Playwright red test | FAIL then PASS | Confirmed browser trace samples expose `animationFrameDebug`. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 8 analyzer tests passed. |
| Focused smoothness trace Playwright test | PASS | Browser trace includes LoAF debug fields. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | Typecheck completed. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest artifact is `11-38-57-317Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped the 5173 listener before reporting; no 517x
listening sockets remained.

Next recommendation:

1. Do not begin runtime visual smoothing yet.
2. Next pass should split the newly attributed script work:
   React scheduler / page-controller state work versus scene render-loop work.
3. For React scheduler rows, add a lightweight User Timing or transition-trace
   boundary around page-controller transition state updates and consumer debug
   collection.
4. For `src/scene.ts` rows, break down render-loop `tick` cost by scene-section
   plane updates, MT volume tweening, and render submission during the same
   LoAF sample.
5. Keep headed/human-visible cadence comparison as a secondary check. If headed
   cadence is smooth, classify the remaining starvation as capture-path
   overhead; if not, fix the attributed scheduler/render-loop work before
   visual-policy changes.

## 2026-05-31 05:15 - Render-Loop Work-Source Split

Goal: split the LoAF-attributed work into page-controller, scene render-loop,
and named overlay/UI ticker buckets before changing any visual smoothing policy.

Tooling changes:

- Added named render-loop ticker durations to `SceneRenderLoopDebugState`.
- Named existing tick consumers:
  `PageController.transitionTick`, `ScaleBar.measure`,
  `SceneLabels.layout`, `AssayLegend.leaders`, and
  `LightModeToggle.northAngle`.
- Added `controllerDebug` to smoothness samples, including trace-sample cost
  and PageController transition tick substeps:
  `tweenerMs`, `pageTransitionProgressMs`, `transitionDynamicCameraMs`,
  `dynamicCameraMs`, `lockedCameraFocusMs`, `smoothnessSampleMs`, and whether
  transition progress state was updated.
- The analyzer now reports `workSource`, top render-loop ticker name/duration,
  and controller tick substep timings on every long active trace gap.

TDD / verification notes:

- Added analyzer expectations for render-loop top ticker and controller tick
  fields first; the test failed until the analyzer surfaced the new fields.
- Added focused browser trace expectations for `controllerDebug` and
  `renderLoop.tickerDurations`; the test failed until live traces exposed
  those fields.
- Added a focused ScaleBar ticker guard, but it passed immediately in the
  focused test path. It is retained only as a broad guard; the selected matrix
  remains the stronger evidence for the ScaleBar bottleneck.

Artifacts:

- Latest selected traced artifact with work-source split:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T12-11-42-870Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T12-11-42-870Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T12-07-15-738Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 80 | 0 |
| traceReplayDisabled | 0 | 0 |
| stateSourceOnly | 16 | 0 |
| loadedAtStartFalse | 8 | 0 |
| opacityJumps | 8 | 0 |
| opacityJumpCovered | 8 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Work-source findings:

- PageController transition tick is not the main measured ticker cost in these
  rows. Its `controllerTickMs` is about `0.3-1.8ms`, and trace sample cost is
  about `0.2-1.7ms`.
- `ScaleBar.measure` is the dominant named render-loop ticker in all latest
  long-gap rows, typically about `29.4-39.7ms`.
- Scene manager work is still visible but lower than the ScaleBar ticker in the
  latest rows. `tickSceneSectionMs` ranges about `4.4-15.1ms`; render submit is
  about `10.1-28.6ms`.
- React scheduler rows are now explicitly identified as
  `react-scheduler-transition-state-update`, and they coincide with transition
  progress state updates:
  - A20: `gapMs=900`, top script `performWorkUntilDeadline`, top ticker
    `ScaleBar.measure=30.3ms`, `controllerTickMs=0.3ms`.
  - S01: `gapMs=800`, top script `performWorkUntilDeadline`, top ticker
    `ScaleBar.measure=32.8ms`, `controllerTickMs=1.8ms`.
- Scene render-loop rows are identified separately:
  - A20: `gapMs=899.9`, top script `src/scene.ts`, top ticker
    `ScaleBar.measure=29.5ms`, `renderLoopRenderMs=24ms`.
  - S01: `gapMs=899.9`, top script `src/scene.ts`, top ticker
    `ScaleBar.measure=31.4ms`, `renderLoopRenderMs=19.8ms`.
- Interpretation: the next non-visual performance fix should target
  `ScaleBar.measure` before scene-section or MT visual policy changes. The
  code currently recomputes surface candidates and raycasts on every tick;
  caching/throttling/transition-aware deferral should be tested in isolation.
- Runtime visual smoothing remains blocked until the ScaleBar ticker cost is
  removed or classified as capture-only, then the matrix should be rerun to see
  whether scene-section or MT handoff costs become the next dominant source.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer work-source red test | FAIL then PASS | Confirmed long-gap rows expose top ticker and controller substep fields. |
| Focused smoothness trace red test | FAIL then PASS | Confirmed browser trace exposes `controllerDebug` and ticker durations. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 8 analyzer tests passed. |
| Focused smoothness trace Playwright test | PASS | Browser trace includes controller and named ticker fields. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | Typecheck completed. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest artifact is `12-11-42-870Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped the 5173 listener before reporting; no 517x
listening sockets remained.

Next recommendation:

1. Do not begin runtime visual smoothing yet.
2. Fix or classify `ScaleBar.measure` first. It is a base render-loop cost, not
   a visual-policy issue tied to a fixture.
3. Safest candidate fix: cache scale surface meshes for the measure pass,
   avoid repeated full-scene traversal per candidate point, and/or defer scale
   recomputation while transition progress is active.
4. Rerun targeted A20/A21/S01 with trace after the ScaleBar fix. If long gaps
   remain and top ticker shifts away from `ScaleBar.measure`, resume the queued
   order: scene-section plane cost, MT volume handoffs, then remaining visual
   families one at a time.

## 2026-05-31 05:45 - ScaleBar Render-Loop Deferral Pass

Goal: fix or classify the concrete non-visual render-loop bottleneck before
starting visual smoothing. The prior selected trace showed `ScaleBar.measure`
as the dominant named ticker in all long-gap rows, about `29.4-39.7ms`.

Changes:

- `ScaleBar` now caches scale surface meshes for each forced measure pass
  instead of traversing visible scene surfaces once per candidate raycast.
- `ScaleBar` now skips nonessential render-loop measurement while a page or
  camera transition is active, holding the previous scale label and recomputing
  on resize or when the transition ends.
- Added a synchronous `SceneHandle` transition flag. `PageController` sets it
  directly at page-transition, pose-tween, and reset-tween start/end so
  render-loop consumers do not depend on React context flush timing.
- Kept the React-context `ScaleBar` transition prop as a UI-level hint, but the
  render-loop guard now also reads `sceneHandle.isTransitionActive()`.
- Tightened the focused smoothness trace guard so active transition
  `ScaleBar.measure` ticker durations must remain below `2ms`.

TDD / diagnostic notes:

- Tightening the focused Playwright guard passed immediately, confirming that
  the focused case was not representative of the A20/A21/S01 selected matrix.
- First runtime attempt used only React transition state plus per-measure
  surface caching. It generated
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T12-35-27-759Z`
  and was rejected as incomplete: `ScaleBar.measure` still appeared at
  `29.8-32.4ms` in active long-gap rows.
- Final pass used the direct scene transition flag. The selected matrix report
  for `12-40-32-799Z` contains no `ScaleBar.measure` long-gap entries.

Artifacts:

- Incomplete React-prop attempt:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T12-35-27-759Z`
- Accepted selected traced artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T12-40-32-799Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T12-40-32-799Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T12-35-27-759Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 60 | -20 |
| stateSourceOnly | 12 | -4 |
| loadedAtStartFalse | 6 | -2 |
| opacityJumps | 6 | -2 |
| opacityJumpCovered | 6 | -2 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 10 | +1 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Work-source findings:

- `ScaleBar.measure` is no longer reported in long-gap diagnostics for the
  accepted selected matrix.
- Active render-loop ticker cost dropped to small tickers such as
  `PageController.transitionTick` and `LightModeToggle.northAngle`, generally
  about `0.2-2.8ms`.
- The next visible bottlenecks are now scene manager / render submit and React
  scheduler rows:
  - A20: `renderLoopRenderMs` about `22.7-29.2ms`,
    `tickSceneSectionMs` about `4.5-14.3ms`, plus the existing large camera
    path risk.
  - A21: `tickSceneSectionMs` about `4.3-12.1ms`,
    `renderLoopRenderMs` about `14.7-23.7ms`.
  - S01: scene-section work can still spike, with one row showing
    `tickSceneSectionMs=34.6ms` and `frameLayerTweensMs=35.1ms`.
- Interpretation: the ScaleBar base render-loop cost is fixed enough to stop
  blocking the next pass. Long active gaps remain, but their top named ticker
  shifted away from ScaleBar as intended.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Focused ScaleBar guard before runtime fix | PASS immediately | Confirmed focused test was too narrow; selected matrix remained required evidence. |
| First selected traced matrix after React-prop fix | INCOMPLETE | `ScaleBar.measure` still appeared at `29.8-32.4ms`; direct scene flag was required. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 8 analyzer tests passed after sandbox EPERM rerun with elevation. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | Typecheck completed. |
| Focused smoothness trace Playwright test | PASS | ScaleBar ticker guard remained under `2ms`. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest accepted artifact is `12-40-32-799Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped the 5173 listener before reporting; no 517x
listening sockets remained.

Next recommendation:

1. Treat `ScaleBar.measure` as fixed for the selected transition matrix.
2. Continue with the next base-rule pass: continuous scene-section plane cost
   and scene manager / render-submit work in A20/A21/S01.
3. Keep this non-visual until scene-section update cost is separated from MT
   volume handoff and large camera path risk.
4. After scene-section cost is reduced or classified, resume the queued visual
   order: MT volume handoffs, surfaces/seismic products, point clouds,
   overlays/legends/labels/assays, then camera-only/dynamic camera smoothing.

## 2026-05-31 06:25 - Scene-Section Cost Split / MT Cut-ISO Classification

Goal: split the remaining scene-section/render-submit cost after the accepted
ScaleBar deferral pass, without changing runtime visual policy yet.

Changes:

- Added analyzer coverage for scene-section sub-cost fields in long active gap
  diagnostics.
- Added app-side `sceneSectionApply` timing to layer tween debug samples:
  bounds, frame resolve, material apply, helper rebuild, helper opacity,
  MT cut-ISO overlay update, seismic cut-ISO overlay update, and object/count
  totals.
- Kept this pass diagnostic-only. No MT volume, section ISO, camera, or visual
  smoothing policy was changed.

Artifacts:

- Latest selected traced artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T13-05-43-486Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T13-05-43-486Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T12-40-32-799Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 60 | 0 |
| stateSourceOnly | 12 | 0 |
| loadedAtStartFalse | 6 | 0 |
| opacityJumps | 6 | 0 |
| opacityJumpCovered | 6 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 10 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Work-source findings:

- Scene-section cost is now split enough to identify the next concrete base
  bottleneck.
- The dominant scene-section spike is MT cut-ISO overlay rebuild, not helper
  rebuild or material traversal:
  - A20: `tickSceneSectionMs=18`, `materialApplyMs=2.2`,
    `helperRebuildMs=3`, `mtCutIsoMs=12.3`, `objects=613`,
    `materials=398`, `helpers=43`.
  - A21: `tickSceneSectionMs=14`, `materialApplyMs=2.1`,
    `helperRebuildMs=3.1`, `mtCutIsoMs=8.2`.
  - S01: `tickSceneSectionMs=26`, `materialApplyMs=1.5`,
    `helperRebuildMs=2.5`, `mtCutIsoMs=21.7`.
- Smaller rows still show helper rebuild around `2-3ms`, material apply around
  `1.4-2.9ms`, and bounds work around `0.3-0.6ms`.
- Source inspection confirms `updateMtVolumeCutIsoOverlaysImpl` clears and
  rebuilds cut meshes/section ISO overlays during scene-section plane updates.
  That makes it the next likely contributor to section ISO stutter and snap
  risk during continuous section transitions.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer red test for scene-section sub-costs | FAIL then PASS | Confirmed the new fields were absent before implementation, then covered. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 8 analyzer tests passed. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | Initial direct typecheck passed; a later direct CLI session appeared stale, so `npx tsc` was rerun. |
| `npx tsc --noEmit --pretty false` | PASS | Standalone typecheck completed in `4.7s`. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest accepted artifact is `13-05-43-486Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.3m`. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped 517x listeners before reporting; no 517x
listening sockets remained.

Next recommendation:

1. Do not begin visual smoothing yet.
2. Fix or classify MT volume cut-ISO overlay rebuild during active
   scene-section transitions.
3. Expose MT cut-ISO overlay update policy/debug state before or with any
   runtime change.
4. Safest candidates to evaluate next: reuse overlay group/geometry when the
   plane signature is unchanged, split mesh-build vs overlay-render timing,
   throttle or lower LOD only during active transitions, or decouple cut-ISO
   refresh from every helper/plane tick while preserving a final full recompute.
5. Treat any strategy that reduces continuous section ISO fidelity as requiring
   human-visible review before acceptance, because the user has reported
   isoband transparency/snap artifacts.

## 2026-05-31 06:45 - MT Cut-ISO Rebuild Timing Split

Goal: classify the MT volume cut-ISO overlay rebuild cost before changing
runtime visual policy.

Changes:

- Added analyzer coverage for MT cut-ISO update sub-costs in long active gap
  diagnostics.
- Added app-side `lastMtVolumeCutIsoUpdateDebug` state and attached it to
  `sceneSectionApply.mtCutIsoUpdate` in smoothness traces.
- Instrumented the MT cut-ISO rebuild path with policy, skip reason, grid size,
  plane/cut/root counts, and timing for clear, setup, mesh build, overlay
  update, attach, and dispose.
- Kept this pass diagnostic-only. No section ISO fidelity, refresh cadence,
  opacity, camera, or MT volume handoff policy was changed.

Artifacts:

- Latest selected traced artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T13-38-02-071Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T13-38-02-071Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T13-05-43-486Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 60 | 0 |
| stateSourceOnly | 12 | 0 |
| loadedAtStartFalse | 6 | 0 |
| opacityJumps | 6 | 0 |
| opacityJumpCovered | 6 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | -1 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Work-source findings:

- The active MT cut-ISO rows are still `policy=full-rebuild`, `grid=96`, with
  one selected plane and one cut/root per update.
- Full clear/dispose is not the active-row bottleneck:
  `clearMs=0`, `disposeMs=0` in the representative active rows.
- Mesh sampling is a secondary cost:
  - A20: `meshBuildMs=2.5`
  - A21: `meshBuildMs=2.0`
  - S01: `meshBuildMs=2.1`
- Section ISO overlay generation is the dominant MT cut-ISO sub-cost:
  - A20: `mtCutIsoMs=8.7`, `overlayUpdateMs=5.8`
  - A21: `mtCutIsoMs=9.7`, `overlayUpdateMs=7.4`
  - S01: `mtCutIsoMs=8.9`, `overlayUpdateMs=6.1`
- Rows where the volume is hidden now carry `skippedReason=volume-layer-hidden`
  and zero MT cut-ISO build/update cost, which keeps inactive rows from being
  misread as real section ISO work.
- Interpretation: the next optimization target is inside
  `updateScalarSectionIsoOverlay` / contour overlay generation for MT volume
  cuts, not full-group clear/dispose and not fixture-specific transition logic.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer red test for MT cut-ISO sub-costs | FAIL then PASS | Confirmed the new fields were absent before implementation, then covered. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 8 analyzer tests passed. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | Direct TypeScript CLI completed after stopping a stale, non-listening Vite/npm pair. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest artifact is `13-38-02-071Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.3m`. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped 517x listeners before reporting; no 517x
listening sockets remained.

Next recommendation:

1. Do not begin visual smoothing yet.
2. Split `updateScalarSectionIsoOverlay` internals for MT volume cuts into
   band mesh, line contour geometry, material/root attach, and contour stats.
3. If line geometry dominates, evaluate contour simplification or transition
   LOD with human-visible review. If band mesh dominates, evaluate attribute
   reuse. If attach/material dominates, evaluate reuse without changing visual
   fidelity.
4. Do not throttle or skip continuous cut-ISO refresh until the visible
   isoband snap/opacity complaint has a review clip proving the tradeoff is
   acceptable.

## 2026-05-31 07:15 - Section ISO Overlay Internal Timing Split

Goal: split `updateScalarSectionIsoOverlay` internals for MT volume cuts before
changing refresh cadence, LOD, opacity, or camera policy.

Changes:

- Added analyzer coverage for nested MT cut-ISO section overlay debug fields in
  long active gap diagnostics.
- Instrumented `updateScalarSectionIsoOverlay` with timing for dispose,
  root creation, band mesh construction, line contour geometry construction,
  line material setup, root attach, total overlay time, skip reason, and useful
  contour stats.
- Aggregated the per-cut overlay timing into
  `lastMtVolumeCutIsoUpdateDebug.overlayDebug` so scene-section traces can show
  whether cost comes from bands, contour lines, material/root work, or skipped
  hidden-volume rows.
- Kept this pass diagnostic-only. No visual refresh policy, LOD,
  transparency/opacity, camera movement, section ISO fidelity, or MT handoff
  policy was changed.

Artifacts:

- Latest selected traced artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T14-04-28-149Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T14-04-28-149Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T13-38-02-071Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 60 | 0 |
| stateSourceOnly | 12 | 0 |
| loadedAtStartFalse | 6 | 0 |
| opacityJumps | 6 | 0 |
| opacityJumpCovered | 6 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 6 | 0 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Work-source findings:

- The selected active MT cut-ISO rows still use `policy=full-rebuild` and one
  active selected plane/cut/root per update.
- Section ISO line contour geometry is the dominant overlay sub-cost. Band mesh
  generation, line material setup, and root attach are small by comparison.
- Representative active rows:
  - A20: `mtCutIsoMs=11.6`, `overlayUpdateMs=8.6`,
    `bandMeshMs=0.5`, `lineGeometryMs=8.0`, `lineMaterialMs=0`,
    `attachMs=0.1`.
  - A21: `mtCutIsoMs=8.9`, `overlayUpdateMs=6.6`,
    `bandMeshMs=0.5`, `lineGeometryMs=6.1`, `lineMaterialMs=0`,
    `attachMs=0.1`.
  - S01: `mtCutIsoMs=8.3`, `overlayUpdateMs=5.7`,
    `bandMeshMs=0.6`, `lineGeometryMs=5.1`, `lineMaterialMs=0`,
    `attachMs=0.1`.
- Contour stats are stable across the selected active rows:
  `lineSourceSegmentCount=3150`, `lineTinySegmentCount=8`,
  `linePolylineCount=37`, `lineSimplifiedPointCount=477`,
  `lineRibbonSegmentCount=953`, and `lineSnapToleranceM=1`.
- Hidden-volume rows continue to skip MT cut-ISO work with
  `skippedReason=volume-layer-hidden` and zero MT cut-ISO build/update cost.
- Interpretation: the next concrete cost target is
  `buildSectionIsoLineGeometry` / contour line geometry construction for MT
  volume cuts. The current evidence does not support changing continuous
  section ISO refresh cadence yet.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer red test for overlay internals | FAIL then PASS | Confirmed the new analyzer fields were absent before implementation, then covered. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 8 analyzer tests passed. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | TypeScript clean. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest artifact is `14-04-28-149Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.3m`. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped 517x listeners before reporting; no 517x
listening sockets remained.

Next recommendation:

1. Do not begin visual smoothing yet.
2. Split `buildSectionIsoLineGeometry` internals into triangle scan and
   intersections, segment stitching, polyline simplification, and ribbon
   extrusion.
3. If triangle scan/intersection dominates, evaluate transition LOD or active
   transition contour cadence only with human-visible review clips.
4. If stitching, simplification, or ribbon extrusion dominates, optimize
   geometry construction without changing visual fidelity first.
5. Do not throttle, lower LOD, or skip continuous cut-ISO refresh until the
   visible isoband snap/opacity complaint has a review clip proving the
   tradeoff is acceptable.

## 2026-05-31 07:55 - Section ISO Line Geometry Timing Split

Goal: split `buildSectionIsoLineGeometry` internals for MT volume cuts before
optimizing contour generation or changing visual refresh policy.

Changes:

- Added analyzer coverage and report fields for line-geometry sub-costs:
  setup, triangle scan, triangle intersections, segment recording, segment
  stitching, polyline simplification, ribbon extrusion, geometry creation, and
  a residual `other` bucket.
- Added contour workload stats to the same long active gap rows: triangle
  count, masked/invalid/degenerate triangle counts, level candidate count, and
  intersection attempt count.
- Instrumented `buildSectionIsoLineGeometry` through the nested MT cut-ISO
  overlay debug state.
- Reduced the diagnostic's own overhead after the first run showed a large
  unaccounted bucket: timing now accumulates raw local durations and rounds
  once at the end of the line-geometry build.
- Kept this pass diagnostic-only. No visual refresh cadence, LOD, opacity,
  transparency, camera movement, section ISO fidelity, or MT handoff policy was
  changed.

Artifacts:

- Latest selected traced artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T14-47-20-910Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T14-47-20-910Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T14-43-14-248Z`
- Intermediate diagnostic artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T14-37-38-572Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 80 | +10 |
| stateSourceOnly | 16 | +2 |
| loadedAtStartFalse | 8 | +1 |
| opacityJumps | 8 | 0 |
| opacityJumpCovered | 8 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 8 | +1 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Work-source findings:

- The first line split artifact (`14-37-38-572Z`) showed that
  `lineGeometryMs` was about `9.7-11.1ms`, but the named phases explained only
  about half the time. That was not good enough evidence for a fix.
- Added `segmentRecordMs` and `lineOtherMs`, then changed timing accumulation
  to avoid thousands of per-iteration rounded writes into debug state.
- Latest accepted active rows:
  - A20: `lineGeometryMs=12.1`, `setupMs=1.3`,
    `triangleScanMs=2.0`, `triangleIntersectionMs=1.1`,
    `segmentRecordMs=0.5`, `segmentStitchMs=4.0`,
    `simplifyMs=0`, `ribbonMs=0`, `geometryCreateMs=0.1`,
    `otherMs=3.1`.
  - A21: `lineGeometryMs=10.8`, `setupMs=1.2`,
    `triangleScanMs=2.4`, `triangleIntersectionMs=0.2`,
    `segmentRecordMs=0.6`, `segmentStitchMs=2.2`,
    `simplifyMs=0.1`, `ribbonMs=0.2`, `geometryCreateMs=0.1`,
    `otherMs=3.7`.
  - S01: `lineGeometryMs=9.4`, `setupMs=1.3`,
    `triangleScanMs=2.8`, `triangleIntersectionMs=0.4`,
    `segmentRecordMs=0.3`, `segmentStitchMs=1.7`,
    `simplifyMs=0.2`, `ribbonMs=0.1`, `geometryCreateMs=0.1`,
    `otherMs=2.5`.
- Workload stats are stable across accepted active rows:
  `triangleCount=18050`, `levelCandidateCount=3191`,
  `intersectionAttemptCount=3191`, `lineSourceSegmentCount=3150`,
  `lineTinySegmentCount=8`, `linePolylineCount=37`,
  `lineSimplifiedPointCount=477`, and `lineRibbonSegmentCount=953`.
- Interpretation: segment stitching is the largest named phase in A20 and is
  consistently material, triangle scan/setup are also material, and line
  simplification/ribbon extrusion/material/attach are not the bottleneck.
- The residual `lineOtherMs=2.5-3.7` remains too large to ignore. It is likely
  either residual instrumentation overhead from repeated `performance.now()`
  calls inside the loop or uninstrumented loop plumbing around the contour
  pass. Do not optimize or lower fidelity until that is separated.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer red test for line-geometry fields | FAIL then PASS | New fields were absent first, then covered. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 8 analyzer tests passed after the line split and after the segment-record/other bucket. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | TypeScript clean. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest accepted artifact is `14-47-20-910Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.3m`; an initial backslash-path invocation found no tests and was rerun with the forward-slash path. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Vite dev server status: stopped 517x listeners before reporting; no 517x
listening sockets remained.

Next recommendation:

1. Do not begin visual smoothing yet.
2. Classify the remaining `lineOtherMs` by adding a lower-overhead timing mode
   or a focused micro-benchmark around `buildSectionIsoLineGeometry` that does
   not call `performance.now()` inside every triangle/candidate loop.
3. If `lineOtherMs` collapses under lower-overhead timing, treat it as
   diagnostic overhead and use the named phases: prioritize segment stitching
   and triangle scan/setup before visual policy work.
4. If `lineOtherMs` remains real, split the uninstrumented loop plumbing before
   changing contour fidelity.
5. Do not throttle, lower LOD, simplify contours further, or skip continuous
   cut-ISO refresh until a human-visible review clip proves the isoband
   snap/opacity complaint does not get worse.

## 2026-05-31 08:10 - Section ISO Coarse Line Timing Classification

Goal: classify whether the previous section ISO `lineOtherMs=2.5-3.7ms`
was real contour work or diagnostic overhead before making any visual-fidelity
or refresh-cadence changes.

What changed:

- Replaced hot-loop line-geometry timing with a lower-overhead
  `timingMode=coarse-pass` measurement.
- The contour pass is now timed once around the triangle/level scan while still
  preserving workload counts: triangles, level candidates, intersection
  attempts, source segments, polylines, simplified points, and ribbon segments.
- Analyzer rows and markdown now expose
  `tickSceneSectionMtCutIsoLineTimingMode` and
  `tickSceneSectionMtCutIsoLineContourPassMs`.
- Kept this pass diagnostic-only. No opacity, isoband color, contour fidelity,
  cut-ISO refresh cadence, camera behavior, or transition policy changed.

Artifacts:

- Latest selected traced artifact:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T15-04-59-321Z`
- Latest report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T15-04-59-321Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T14-47-20-910Z`

Latest selected traced counts:

| Metric | Count | Delta |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 60 | -20 |
| stateSourceOnly | 12 | -4 |
| loadedAtStartFalse | 6 | -2 |
| opacityJumps | 6 | -2 |
| opacityJumpCovered | 6 | -2 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 6 | -2 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 10 | +1 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Classification findings:

- `lineOtherMs` collapsed under coarse timing. Active MT cut-ISO rows now show
  `otherMs=0-0.1ms`; the prior residual was diagnostic overhead from
  fine-grained timing inside the hot triangle/candidate loop.
- The remaining real line-geometry costs are the coarse contour pass and segment
  stitching:
  - A20: `lineGeometryMs=9.3`, `contourPassMs=4.1`,
    `segmentStitchMs=3.1`, `simplifyMs=0.2`, `ribbonMs=0`,
    `geometryCreateMs=0.1`, `otherMs=0.1`.
  - A21: `lineGeometryMs=5.2`, `contourPassMs=1.8`,
    `segmentStitchMs=1.9`, `simplifyMs=0.1`, `ribbonMs=0.1`,
    `geometryCreateMs=0.1`, `otherMs=0`.
  - S01 active rows: `lineGeometryMs=4.9-6.1`,
    `contourPassMs=1.6-2.7`, `segmentStitchMs=1.8-1.9`,
    `simplifyMs=0.1-0.2`, `ribbonMs=0.1`, `otherMs=0`.
- Workload stats are stable where MT cut-ISO line geometry runs:
  `triangleCount=18050`, `levelCandidateCount=3191`,
  `intersectionAttemptCount=3191`, `lineSourceSegmentCount=3150`,
  `lineTinySegmentCount=8`, `linePolylineCount=37`,
  `lineSimplifiedPointCount=477`, and `lineRibbonSegmentCount=953`.
- ScaleBar remains absent from selected long-gap top-ticker diagnostics.
- The long-gap blocker is not solved by this pass: selected matrix still has
  10 long active gaps, 3 smoothness trace density risks, and A20 still carries
  camera path risk. This pass only made the section ISO cost evidence cleaner.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer red test for coarse line timing | FAIL then PASS | New coarse fields were missing first, then covered. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs` | PASS | 8 analyzer tests passed. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | TypeScript clean. |
| Targeted traced matrix `A20,A21,S01` | PASS | Latest artifact is `15-04-59-321Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.3m`. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Next recommendation:

1. Keep visual smoothing paused until the remaining render-loop cost and cadence
   blockers are narrower.
2. Optimize segment stitching without changing contour fidelity first. The
   likely safe target is avoiding front-of-array `unshift`/clone churn while
   preserving the same stitched polyline order and counts.
3. After stitching, rerun selected traced matrix `A20,A21,S01` and confirm
   `segmentStitchMs`, `lineGeometryMs`, `tickSceneSectionMtCutIsoMs`, and
   `renderLoopRenderMs` move in the right direction.
4. If line geometry no longer dominates, continue to contour pass optimization
   or scene-section helper/plane cost. Do not throttle, lower LOD, skip
   continuous cut-ISO refresh, or simplify contours further without a
   human-visible review clip because the user specifically reported isoband
   transparency/snap artifacts.

## 2026-05-31 08:45 - Section ISO Stitch Churn Pass

Goal: reduce section ISO segment-stitching overhead without changing contour
fidelity, refresh cadence, opacity, or camera behavior.

What changed:

- Added a focused Node guard test:
  `tests/tools/section-iso-stitch-source.test.mjs`.
- The test fails if `stitchSectionIsoSegments` reintroduces front-of-array
  insertion.
- Reworked `stitchSectionIsoSegments` so the backward side of a contour is
  accumulated with `push` into a temporary array, then appended in reverse order
  when the final polyline is assembled.
- Preserved the same node averaging, visited-segment tracking, used-segment
  normal accumulation, polyline filtering, simplification, ribbon generation,
  and debug workload counts.

Artifacts:

- First post-change selected trace:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T15-31-52-552Z`
- Accepted selected trace after no-code rerun:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T15-35-13-863Z`
- Accepted report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T15-35-13-863Z/transition-analysis.md`
- Compared against pre-stitch baseline:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T15-04-59-321Z`

Latest selected traced counts:

| Metric | Count | Delta vs `15-04-59-321Z` |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 60 | 0 |
| stateSourceOnly | 12 | 0 |
| loadedAtStartFalse | 6 | 0 |
| opacityJumps | 6 | 0 |
| opacityJumpCovered | 6 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 6 | 0 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | -1 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Console classification:

- The first post-change matrix recorded one unexpected warning:
  `WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost`.
- No-code rerun cleared it and recorded only the four expected Chromium
  ReadPixels warnings.
- Treat the context-loss row as transient browser lifecycle noise for this pass,
  not accepted baseline evidence. The accepted artifact is `15-35-13-863Z`.

Timing comparison:

- Pre-stitch baseline active MT cut-ISO geometry rows (`15-04-59-321Z`):
  - Average `lineGeometryMs=6.375`.
  - Average `contourPassMs=2.55`.
  - Average `segmentStitchMs=2.175`.
  - Average `mtCutIsoMs=9.4`.
- Accepted post-stitch rows (`15-35-13-863Z`):
  - Average `lineGeometryMs=6.033`.
  - Average `contourPassMs=2.0`.
  - Average `segmentStitchMs=2.2`.
  - Average `mtCutIsoMs=9.167`.
- Representative accepted rows:
  - A20: `lineGeometryMs=5.1`, `contourPassMs=1.5`,
    `segmentStitchMs=2.1`, `mtCutIsoMs=8.0`, `otherMs=0.1`.
  - A21: `lineGeometryMs=5.2`, `contourPassMs=1.6`,
    `segmentStitchMs=2.0`, `mtCutIsoMs=8.3`, `otherMs=0`.
  - S01: `lineGeometryMs=7.8`, `contourPassMs=2.9`,
    `segmentStitchMs=2.5`, `mtCutIsoMs=11.2`, `otherMs=0`.
- Interpretation: removing `unshift` is algorithmically safer and preserves
  counts, but it did not materially reduce `segmentStitchMs` in the selected
  matrix. The improvement is mixed and within run-to-run variance. Do not claim
  the stitch bottleneck is fixed.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Stitch guard red test | FAIL then PASS | Failed on `.unshift(` before the implementation change, then passed. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs tests/tools/section-iso-stitch-source.test.mjs` | PASS | 9 Node tests passed. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | TypeScript clean. |
| Targeted traced matrix `A20,A21,S01` | PASS | Accepted artifact is `15-35-13-863Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest accepted targeted artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.3m`. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Next recommendation:

1. Keep visual smoothing paused.
2. Split `stitchSectionIsoSegments` timing before further optimization:
   node/key build, segment traversal, final point assembly, polyline length
   filtering, and normal accumulation.
3. Use that split to decide whether the real cost is Map/string-key node build,
   traversal over node segment lists, final point assembly, or length/normal
   work.
4. Only optimize the named dominant sub-cost. Do not change contour density,
   line simplification, cut-ISO refresh cadence, LOD, opacity, or camera
   behavior without human-visible review evidence.

## 2026-05-31 09:15 - Section ISO Stitch Internal Timing Split

Goal: classify the remaining section ISO segment-stitching cost before making
another optimization pass. This pass is diagnostic-only for visual behavior:
no contour density, simplification, refresh cadence, LOD, opacity, or camera
rules were changed.

What changed:

- Extended section ISO line-geometry debug state with stitch sub-cost fields:
  node/key build, segment traversal, final point assembly, polyline length
  filtering, and normal accumulation.
- Wired the same fields through MT cut-ISO overlay aggregation, SceneManager
  debug typing, the transition-matrix analyzer rows, and the markdown report.
- Added analyzer fixture coverage so the report fails if the stitch sub-costs
  disappear.
- Preserved the previous source guard that prevents front-of-array insertion in
  `stitchSectionIsoSegments`.

Artifacts:

- Selected trace:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T16-05-50-828Z`
- Report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T16-05-50-828Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T15-35-13-863Z`

Latest selected traced counts:

| Metric | Count | Delta vs `15-35-13-863Z` |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 80 | 20 |
| stateSourceOnly | 16 | 4 |
| loadedAtStartFalse | 8 | 2 |
| opacityJumps | 8 | 2 |
| opacityJumpCovered | 8 | 2 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 8 | 2 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Count interpretation:

- The product-entry deltas are from S01 now producing populated `mid` and `end`
  state summaries; the previous selected artifact only had S01 `source`
  product entries.
- No unresolved opacity, policy, source/target, late-reapply, capture, or
  console regressions were introduced.

Stitch sub-cost classification:

- Active MT cut-ISO line rows now show stitch cost is dominated by node/key
  build:
  - A20: `lineGeometryMs=6.5`, `segmentStitchMs=2.4`,
    `stitchNodeBuildMs=2.1`, `stitchTraversalMs=0.2`,
    `stitchPointAssemblyMs=0`, `stitchLengthFilterMs=0`,
    `stitchNormalMs=0`, `contourPassMs=1.9`, `mtCutIsoMs=10.1`.
  - A21: `lineGeometryMs=6.5`, `segmentStitchMs=2.4`,
    `stitchNodeBuildMs=2.0`, `stitchTraversalMs=0.2`,
    `stitchPointAssemblyMs=0.1`, `stitchLengthFilterMs=0`,
    `stitchNormalMs=0.1`, `contourPassMs=2.1`, `mtCutIsoMs=10.4`.
  - S01: `lineGeometryMs=7.2`, `segmentStitchMs=2.7`,
    `stitchNodeBuildMs=2.4`, `stitchTraversalMs=0.2`,
    `stitchPointAssemblyMs=0`, `stitchLengthFilterMs=0`,
    `stitchNormalMs=0`, `contourPassMs=2.3`, `mtCutIsoMs=11.0`.
- Traversal, point assembly, length filtering, and normal accumulation are not
  the current stitch bottleneck.
- The next safe non-visual target is node/key build in
  `stitchSectionIsoSegments`, especially string-key creation, node Map churn,
  and full segment-record cloning.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer red test | FAIL then PASS | Failed before analyzer row fields existed, then passed after wiring them. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs tests/tools/section-iso-stitch-source.test.mjs` | PASS | 9 Node tests passed. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | TypeScript clean. |
| Selected traced matrix `A20,A21,S01` | PASS | Artifact `16-05-50-828Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest selected artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.4m`. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| Dev-server cleanup | PASS | `NO_517X_LISTENERS`. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Next recommendation:

1. Keep visual smoothing paused until the MT cut-ISO node/key build cost is
   reduced or explicitly accepted.
2. Optimize `stitchSectionIsoSegments` node/key build without changing visual
   output. Safest candidates:
   - Avoid cloning full segment records with object spread; store only
     `aKey`, `bKey`, `normal`, and `level`.
   - Reduce string-key allocation if possible while preserving snap tolerance
     semantics.
   - Keep the existing source guard against `unshift`.
3. Rerun selected traced `A20,A21,S01` and compare the same sub-cost rows.
4. If node/key build drops and line geometry remains material, move next to
   contour-pass or scene-section helper/plane cost. Do not change contour
   density, line simplification, cut-ISO refresh cadence, LOD, opacity, or
   camera behavior without human-visible review evidence.

## 2026-05-31 09:50 - Section ISO Stitch Node/Key Build Pass

Goal: reduce the dominant section ISO segment-stitching sub-cost without
changing visual output, contour density, simplification, cut-ISO refresh
cadence, LOD, opacity, or camera behavior.

What changed:

- Added focused source-guard tests for the hot stitch path:
  - `stitchSectionIsoSegments` must not use front-of-array insertion.
  - `stitchSectionIsoSegments` must not clone full segment records with
    `...segment`.
  - `sectionIsoPointKey` must not allocate an array and call `.join()` for
    every point key.
- Reworked `stitchSectionIsoSegments` records to store only `aKey`, `bKey`,
  `normal`, and `level`.
- Replaced the point-key array/join path with direct rounded coordinates and a
  template string. This preserves the same snap tolerance string format.
- No visual policy, contour fidelity, opacity, camera, or refresh-cadence rule
  changed.

Artifacts:

- First attempted selected trace:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T16-33-11-804Z`
- Accepted selected trace:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T16-33-50-824Z`
- Report:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T16-33-50-824Z/transition-analysis.md`
- Compared against:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T16-05-50-828Z`

Tooling note:

- The first matrix attempt failed before capture with
  `page.goto: net::ERR_CONNECTION_REFUSED` because no Vite server was listening
  on `127.0.0.1:5173`.
- The capture script reads `GEOSEE_BASE_URL`; it does not launch Vite.
- Vite was then started from the real repo path `C:\GeoSee\GeoSee_Dev`, the
  selected matrix was rerun successfully, and all 517x listeners were stopped
  before reporting.
- `16-33-11-804Z` has no manifest and is not accepted evidence.

Latest selected traced counts:

| Metric | Count | Delta vs `16-05-50-828Z` |
| --- | ---: | ---: |
| cases | 3 | 0 |
| productEntries | 60 | -20 |
| stateSourceOnly | 12 | -4 |
| loadedAtStartFalse | 6 | -2 |
| opacityJumps | 6 | -2 |
| opacityJumpCovered | 6 | -2 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 6 | -2 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 10 | 1 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Count interpretation:

- Product-entry count returned to 60 because this run did not include the extra
  S01 `mid`/`end` state summaries seen in `16-05-50-828Z`.
- No unresolved opacity, policy, source/target, late-reapply, capture, or
  console regressions were introduced.

Timing comparison:

- Accepted pre-change rows (`16-05-50-828Z`, active MT cut-ISO line rows):
  - Average `lineGeometryMs=6.733`.
  - Average `segmentStitchMs=2.5`.
  - Average `stitchNodeBuildMs=2.167`.
  - Average `contourPassMs=2.1`.
  - Average `mtCutIsoMs=10.5`.
- Accepted post-change rows (`16-33-50-824Z`, active MT cut-ISO line rows):
  - Average `lineGeometryMs=5.125`.
  - Average `segmentStitchMs=1.675`.
  - Average `stitchNodeBuildMs=1.425`.
  - Average `contourPassMs=1.825`.
  - Average `mtCutIsoMs=11.125`.
- Representative post-change rows:
  - A20: `lineGeometryMs=4.8`, `segmentStitchMs=1.6`,
    `stitchNodeBuildMs=1.5`, `contourPassMs=1.5`, `meshBuildMs=2.0`,
    `mtCutIsoMs=7.5`.
  - A21: `lineGeometryMs=4.7`, `segmentStitchMs=1.6`,
    `stitchNodeBuildMs=1.2`, `contourPassMs=1.6`, `meshBuildMs=2.1`,
    `mtCutIsoMs=7.7`.
  - S01 normal row: `lineGeometryMs=4.8`, `segmentStitchMs=1.3`,
    `stitchNodeBuildMs=1.1`, `contourPassMs=1.7`, `meshBuildMs=2.1`,
    `mtCutIsoMs=7.7`.
  - S01 spike row: `lineGeometryMs=6.2`, `segmentStitchMs=2.2`,
    `stitchNodeBuildMs=1.9`, `contourPassMs=2.5`, `meshBuildMs=14.4`,
    `mtCutIsoMs=21.6`.
- Interpretation: the node/key build pass reduced the targeted stitch cost in
  captured browser evidence. The remaining high-risk row is no longer stitch
  dominated; it is an MT cut mesh-build spike.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Stitch source guard red test | FAIL then PASS | Failed on `...segment` and `.join()` before implementation, then passed. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs tests/tools/section-iso-stitch-source.test.mjs` | PASS | 11 Node tests passed. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean after rerun. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | TypeScript clean. |
| Selected traced matrix `A20,A21,S01` | PASS | Artifact `16-33-50-824Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated for latest selected artifact. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.3m`. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| Dev-server cleanup | PASS | `NO_517X_LISTENERS`. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Next recommendation:

1. Keep visual smoothing paused.
2. Treat section ISO node/key build as reduced enough for now.
3. Move to the new dominant MT cut-ISO risk: classify the S01 `meshBuildMs=14.4`
   spike in `updateMtVolumeCutIsoOverlaysImpl` / MT cut mesh generation.
4. Split MT cut mesh-build timing before changing behavior: grid sampling,
   plane/cut geometry creation, vertex/index buffer assembly, material/root
   setup, and any disposal or object attachment hidden in the build phase.
5. If the spike is transient run-to-run noise, confirm with another selected
   trace. If it persists, optimize mesh-build allocation/reuse before any
   visual-policy change.
6. Do not change contour density, line simplification, cut-ISO refresh cadence,
   LOD, opacity, or camera behavior without human-visible review evidence.

## 2026-05-31 10:10 - MT Cut Mesh Build Timing Split

Goal for this pass:

- Classify the MT cut mesh-build spike from `16-33-50-824Z` before any visual
  smoothing or visual-policy changes.
- Expose mesh-build sub-costs in debug/matrix artifacts: setup, frame-range
  resolution, buffer allocation, grid sampling, index assembly, geometry
  creation, material setup, mesh object setup, vertex count, and index count.

Implementation:

- Added MT cut mesh-build debug timing to
  `src/scene/isoOverlays/volumeCutIsoOverlays.ts`.
- Mirrored the debug shape in `src/scene/SceneManager.ts`.
- Extended `tools/analyze-transition-matrix.mjs` rows and report output with
  an `MT Cut Mesh Build Diagnostics` section.
- Added analyzer coverage in `tests/tools/analyze-transition-matrix.test.mjs`
  using a red/green pass for the new mesh-build sub-cost fields.

Latest selected traced artifact:

- `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T17-05-06-512Z`
- Cases: `A20,A21,S01`
- Trace replay: complete
- Video: disabled

Counts:

| Metric | Count | Delta vs `16-33-50-824Z` |
| --- | ---: | ---: |
| productEntries | 80 | 20 |
| stateSourceOnly | 16 | 4 |
| loadedAtStartFalse | 8 | 2 |
| opacityJumps | 8 | 2 |
| opacityJumpCovered | 8 | 2 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 8 | 2 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | -1 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Mesh-build classification:

- The prior S01 `meshBuildMs=14.4` spike did not reproduce in the selected
  traced rerun.
- Active mesh-build rows are stable:
  - A20: `meshBuildMs=2.1`, `gridSampleMs=0.8`, `geometryMs=1.2`,
    `vertices=9216`, `indices=54150`, `mtCutIsoMs=9.1`.
  - A21: `meshBuildMs=2.2`, `gridSampleMs=0.8`, `geometryMs=1.2`,
    `vertices=9216`, `indices=54150`, `mtCutIsoMs=8.7`.
  - S01: `meshBuildMs=2.1`, `gridSampleMs=0.9`, `geometryMs=1.1`,
    `vertices=9216`, `indices=54150`, `mtCutIsoMs=8.3`.
- Setup, frame-range resolution, buffer allocation, material setup, and mesh
  object setup round to `0-0.1ms` in the selected evidence.
- Interpretation: classify the prior S01 mesh-build spike as transient
  run-to-run noise for now. Do not optimize mesh-build allocation/reuse yet
  unless the spike returns in broader or repeated traced captures.

Current remaining bottleneck:

- MT cut-ISO cost is again dominated by overlay/line generation rather than cut
  mesh build. Representative active rows still spend about `5.1-6.1ms` in
  line geometry and `1.3-2.7ms` in segment stitching/node build.
- The selected matrix still has `smoothnessTraceQualityRisk=3` and
  `cameraPathRisk=1`, so visual smoothing remains blocked on timing/cadence
  confidence and camera path classification.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Analyzer red test for mesh-build sub-cost rows | FAIL then PASS | Failed on missing `tickSceneSectionMtCutIsoMeshBuildSetupMsAfter`, then passed after analyzer implementation. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs tests/tools/section-iso-stitch-source.test.mjs` | PASS | 11 Node tests passed. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | TypeScript clean. |
| Selected traced matrix `A20,A21,S01` | PASS | Artifact `17-05-06-512Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated and compared against `16-33-50-824Z`. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.3m`. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| Dev-server cleanup | PASS | `NO_517X_LISTENERS`. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Next recommendation:

1. Keep visual smoothing paused until the timing evidence is dense enough to
   judge smoothness and the camera path risk is classified.
2. Treat MT cut mesh build as classified, not a current optimization target.
3. Return to the persistent MT cut-ISO overlay line-generation cost:
   `lineGeometryMs` / `segmentStitchMs` / node-key build remain the repeatable
   section ISO work during active scene-section transitions.
4. The next safest base-rule pass is either:
   - optimize section ISO segment/node-key build further without changing
     contour fidelity, or
   - run a targeted human-visible/video review for A20/A21/S01 before deciding
     whether transition-only contour cadence or LOD changes are acceptable.
5. Do not change contour density, line simplification, cut-ISO refresh cadence,
   LOD, opacity, or camera behavior without human-visible review evidence.

## 2026-05-31 11:10 - Section ISO Numeric Node Stitch Pass

Goal for this pass:

- Reduce persistent MT cut-ISO overlay line-generation cost without changing
  contour density, line simplification, cut-ISO cadence, LOD, opacity, camera
  behavior, or visual policy.
- Keep the change in base geometry stitching logic rather than fixture-specific
  transition behavior.

Implementation:

- Replaced string `aKey`/`bKey` segment records and `Map<string, ...>` node
  lookup in `stitchSectionIsoSegments` with numeric node ids.
- Replaced hot-path string point keys with collision-checked numeric hash
  buckets. Snap semantics remain based on the same rounded `x/y/z` tolerance
  coordinates; hash collisions are checked against the stored quantized
  coordinates before nodes are reused.
- Preserved the existing guards against front-of-array insertion, full segment
  record cloning, and array/join point-key allocation.
- Added a new source guard proving the stitch hot path no longer uses string
  node records.

Latest selected traced artifact:

- `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T18-00-45-605Z`
- Cases: `A20,A21,S01`
- Trace replay: complete
- Video: disabled

Counts:

| Metric | Count | Delta vs `17-05-06-512Z` |
| --- | ---: | ---: |
| productEntries | 70 | -10 |
| stateSourceOnly | 14 | -2 |
| loadedAtStartFalse | 7 | -1 |
| opacityJumps | 8 | 0 |
| opacityJumpCovered | 8 | 0 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 7 | -1 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Timing comparison:

- Pre-change active MT cut-ISO line rows (`17-05-06-512Z`):
  - Average `lineGeometryMs=5.633`.
  - Average `contourPassMs=2.033`.
  - Average `segmentStitchMs=1.967`.
  - Average `stitchNodeBuildMs=1.633`.
  - Average `meshBuildMs=2.133`.
  - Average `mtCutIsoMs=8.7`.
- Post-change active MT cut-ISO line rows (`18-00-45-605Z`):
  - Average `lineGeometryMs=5.2`.
  - Average `contourPassMs=2.033`.
  - Average `segmentStitchMs=1.033`.
  - Average `stitchNodeBuildMs=0.733`.
  - Average `meshBuildMs=2.167`.
  - Average `mtCutIsoMs=8.3`.
- Workload counts stayed stable in all active rows:
  - `lineSourceSegmentCount=3150`.
  - `linePolylineCount=37`.
  - `lineSimplifiedPointCount=477`.
  - `lineRibbonSegmentCount=953`.

Interpretation:

- Numeric node ids and collision-checked hash buckets are a material
  fidelity-preserving win for the repeated stitch/node-key cost.
- The remaining line-generation cost is now mostly contour pass plus smaller
  residual stitch/ribbon work. The selected trace includes one A21 row where
  `ribbonMs=1.3`, but the average ribbon cost remains low enough to avoid a
  new runtime change before more evidence.
- The selected matrix still reports `smoothnessTraceQualityRisk=3` and
  `cameraPathRisk=1`; visual smoothing remains paused.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Source guard red test for string-key records | FAIL then PASS | Failed on `Map<string, SectionIsoContourNode>` and `aKey`/`bKey` records before implementation. |
| `node --test tests/tools/section-iso-stitch-source.test.mjs` | PASS | 4 stitch source guards passed. |
| `node --test tests/tools/analyze-transition-matrix.test.mjs tests/tools/section-iso-stitch-source.test.mjs` | PASS | 12 Node tests passed. |
| `node --check tools/analyze-transition-matrix.mjs` | PASS | Analyzer syntax clean. |
| `node --check tools/capture-transition-matrix.mjs` | PASS | Capture syntax clean. |
| `node node_modules/typescript/bin/tsc --noEmit --pretty false` | PASS | TypeScript clean after one approval-timeout retry. |
| Selected traced matrix `A20,A21,S01` | PASS | Artifact `18-00-45-605Z`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated and compared against `17-05-06-512Z`. |
| Full `transition-orchestration.spec.ts` | PASS | 8 tests passed in about `3.3m`. |
| `npm run build` | PASS | Production build completed. |
| `npm run check:pages` | PASS | Project page wiring OK. |
| Dev-server cleanup | PASS | `NO_517X_LISTENERS`. |
| `git diff --check` | FAIL | Existing CRLF warnings plus known `src/editor/LayerPanel.tsx:2626` blank-line-at-EOF remain. Not fixed in this pass. |

Next recommendation:

1. Keep visual smoothing paused.
2. Treat section ISO stitch/node-key build as reduced enough for now.
3. The remaining repeated section ISO cost is contour pass / triangle work plus
   small residual stitch/ribbon work. Do not change contour density, line
   simplification, cut-ISO cadence, LOD, opacity, or camera behavior without a
   human-visible review clip.
4. Next safest base-rule step: capture a targeted video/human-review packet for
   A20/A21/S01, then decide whether transition-only contour cadence or LOD is
   acceptable. If no visual-policy tradeoff is accepted, move to camera-path
   classification because `cameraPathRisk=1` remains stable on A20.

## 2026-05-31 11:25 - A20/A21/S01 Video Review Packet

Goal for this pass:

- Capture a targeted video-backed review artifact before any visual-policy
  change to contour cadence, LOD, opacity, or camera behavior.
- Preserve the current numeric-node section ISO stitch optimization and all
  debug/matrix classifications.

Latest video-backed selected artifact:

- `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T18-09-39-937Z`
- Cases: `A20,A21,S01`
- Trace replay: complete
- Video status: ready
- Video file:
  `C:\GeoSee\GeoSee_Dev\docs\dev-context\artifacts\transition-matrix\transition-matrix-debug-2026-05-31T18-09-39-937Z\videos\page@fa2b15c751c5bed20e02225ee0a18006.webm`
- Human-review packet:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T18-09-39-937Z/human-review-packet.md`

Counts:

| Metric | Count | Delta vs `18-00-45-605Z` |
| --- | ---: | ---: |
| productEntries | 60 | -10 |
| stateSourceOnly | 12 | -2 |
| loadedAtStartFalse | 6 | -1 |
| opacityJumps | 6 | -2 |
| opacityJumpCovered | 6 | -2 |
| opacityJumpUnresolved | 0 | 0 |
| policyMismatches | 0 | 0 |
| hiddenDormantState | 6 | -1 |
| hiddenUnresolvedState | 0 | 0 |
| sectionIsoRenderOpacityMismatch | 0 | 0 |
| sceneSectionGroundTraceRisk | 0 | 0 |
| cameraPathRisk | 1 | 0 |
| smoothnessTraceQualityRisk | 3 | 0 |
| longActiveTraceGaps | 9 | 0 |
| matrixCaptureFailures | 0 | 0 |
| interruptionDivergences | 0 | 0 |
| lateReapplyDuringTransition | 0 | 0 |
| unexpectedConsole | 0 | 0 |
| expectedReadPixelsWarnings | 4 | 0 |

Review focus:

- A20 remains the camera-risk case:
  - `99_unresolved_missing_tools -> 101_page`.
  - `positionDistance=571223.8`.
  - `maxFramePositionDistance=333566.3` over `899.9ms`.
  - Inspect for the reported camera stall/jump and any ground-line/section
    helper snap during that motion.
- A20 also carries a covered MT volume opacity handoff:
  - `utah-forge-mt-resistivity-volume`, `fade-opacity`, opacity `0 -> 0.48`.
  - Inspect whether the transition looks unaware of already-visible products.
- A21 and S01 are the section ISO continuity review cases:
  - No `sectionIsoRenderOpacityMismatch`.
  - No `sceneSectionGroundTraceRisk`.
  - Active MT cut-ISO rows still use `full-rebuild`.
  - Inspect whether isobands still fade too far mid-transition and snap back at
    the end.

Limitations:

- The WebM is still produced by headless Chromium. It is useful for visual
  review but does not prove true headed-browser cadence.
- `smoothnessTraceQualityRisk=3` remains because active sample density is low.
- Long active gaps remain and are split across main-thread long tasks,
  animation-frame script attribution, and unattributed timer starvation.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| Video-backed selected matrix `A20,A21,S01` | PASS | Artifact `18-09-39-937Z`, `videoStatus=ready`, trace replay complete. |
| `npm run audit:transition-report` | PASS | Report regenerated and compared against `18-00-45-605Z`. |
| Human-review packet | PASS | Packet added beside artifact with video path and review priorities. |

Next recommendation:

1. Keep visual smoothing paused until the video is reviewed.
2. If the video visibly confirms the isoband transparency/snap complaint, fix
   base transition ownership/policy for already-visible products rather than
   changing fixture paths.
3. If the video mainly confirms A20 camera stall/jump, move next to camera-path
   classification and path-aware duration/handoff.
4. If the video is inconclusive because headless cadence dominates, run a true
   headed/human-visible capture path before visual-policy changes.

## 2026-05-31 11:45 - Contact-Sheet Visual Review

Goal for this pass:

- Inspect the video-backed review artifact without changing runtime visual
  policy.
- Generate frame contact sheets so the video can be reviewed quickly in the
  thread and in future unattended runs.

Generated tool/artifacts:

- Contact-sheet helper:
  `tools/extract-transition-video-contact-sheet.mjs`
- Full contact sheet:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T18-09-39-937Z/video-review-contact-sheet.png`
- A20 dense contact sheet:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T18-09-39-937Z/video-review-a20-contact-sheet.png`
- S01 dense contact sheet:
  `docs/dev-context/artifacts/transition-matrix/transition-matrix-debug-2026-05-31T18-09-39-937Z/video-review-s01-contact-sheet.png`

Contact-sheet review:

- Full sheet: 16 sampled frames across the full `142.60s` WebM.
- A20 sheet: 16 sampled frames from `16.00s` to `45.00s`.
- S01 sheet: 16 sampled frames from `104.00s` to `142.60s`.
- A20 is the clearest visible risk:
  - The dense sheet shows a large camera/view change from the section/MT view
    into terrain overview around `17.93s -> 19.87s`.
  - It then returns into the section/MT composition around `29.53s -> 31.47s`.
  - This aligns with `cameraPathRisk=1` and the A20 matrix camera step
    (`positionDistance=571223.8`, `maxFramePositionDistance=333566.3`).
- The contact sheets are not temporally dense enough to prove whether A20 is a
  smooth long move, a stall, or a discrete jump. Treat them as camera-path
  classification evidence, not a runtime fix decision.
- The S01 dense sheet keeps the section/MT isoband cluster generally visible in
  sampled frames. It does not visibly prove an isoband opacity snap, but the
  samples are too sparse and headless to clear the user-reported opacity/snap
  complaint.

Verification in this pass:

| Check | Result | Notes |
| --- | --- | --- |
| `node --check tools/extract-transition-video-contact-sheet.mjs` | PASS | Helper syntax clean. |
| Full video contact sheet | PASS | Generated from `0s -> 142.60s`, 16 frames. |
| A20 dense contact sheet | PASS | Generated from `16s -> 45s`, 16 frames. |
| S01 dense contact sheet | PASS | Generated from `104s -> 142.60s`, 16 frames. |

Next recommendation:

1. Keep visual smoothing paused.
2. Move next to A20 camera-path classification and path-aware duration/handoff
   analysis.
3. Keep section ISO contour density, line simplification, cadence, LOD, and
   opacity unchanged unless a denser headed/human-visible clip confirms the
   isoband opacity/snap complaint.

## 2026-05-31 12:05 - Section ISO Transition-Envelope Fade Fix

Goal for this pass:

- Pause the unattended automation at the user's request.
- Fix the base logic that made some transition elements fade at different
  rates or snap in/out, without patching fixture paths.

Root cause:

- Section ISO overlays had correctly been split from authored scalar-volume
  layer opacity, so ordinary layer opacity changes did not dim the isobands and
  isolines.
- The page-transition runtime reused the same layer opacity path for transition
  fades. That path treated section ISO transition opacity as binary: `0` when
  parent render opacity was zero, then `1` as soon as the layer tween became
  nonzero.
- Result: section ISO overlays could snap fully in on the first tween frame and
  remain fully visible until snapping out at the end, while other layer
  materials faded continuously.

Runtime change:

- Added a separate transition-envelope opacity path:
  `SceneManager.applyLayerTransitionRenderOpacity(id, opacity,
  transitionOpacity)`.
- Page-transition layer tweens and transition snapshots now pass a normalized
  transition envelope for section ISO overlay materials.
- Ordinary `applyLayerRenderOpacity` still preserves section ISO independence
  from authored layer opacity.
- Section ISO debug policy can now report `transition-envelope-opacity` while a
  page transition is actively fading the overlay.
- Downstream occlusion recomposition preserves the transition-envelope policy
  instead of relabeling it as independent layer opacity.

Verification:

| Check | Result | Notes |
| --- | --- | --- |
| New regression: `Section ISO overlays follow the page transition envelope without using authored layer opacity as their base` | PASS | Failed first because the transition-envelope API did not exist, then passed after the fix. |
| Existing regression: `Section ISO overlay opacity is independent from scalar volume layer fades` | PASS | Confirms authored layer opacity remains split from section ISO overlay opacity. |
| `node node_modules\typescript\bin\tsc --noEmit --pretty false` | PASS | Typecheck clean. |
| `npx playwright test tests/utah-forge/transition-orchestration.spec.ts --workers=1` | PASS | 9/9 tests passed. |

Next recommendation:

1. Do not run a selected matrix/video pass unless the user explicitly requests
   it. User visual review is the acceptance path for fade quality, camera
   smoothness, ground-line continuity, and isoband appearance.
2. Treat any page IDs, screen numbers, matrix cases, or page paths as
   disposable reproduction fixtures only.
3. Continue camera-path classification only after the fade-uniformity fix is
   visually checked.

## 2026-05-31 12:35 - Page-Agnostic Transition Scope Reset

User correction accepted: this work is a global transition/editor/save logic
fix. Page-to-page navigation is only the way current fixtures expose failures.
The pages used in the audit may be deleted or replaced, so future work must not
depend on their IDs, indexes, titles, or adjacency.

Durable rule for all remaining transition refinements:

- Do not implement fixture-id, fixture-index, fixture-title, source/target fixture-path, or
  Utah-FORGE-only runtime conditionals.
- Historical page paths, screen numbers, and matrix IDs stay in this log only
  as evidence and reproduction handles.
- Every new fix must name the global transition family or ownership rule it
  changes, such as already-visible product ownership, Section ISO transition
  envelope, scene-section helper/reference-layer continuity, MT
  volume/threshold handoffs, editor live-apply gating, save normalization, or
  camera path/commit policy.
- Human visual feedback should identify the affected family and may include a
  reproduction path, but the implementation target remains the shared runtime
  rule.
- Validation should enforce canonical state contracts rather than current page
  content. Current examples include MT boundary visibility normalization and
  scene-section frame/plane consistency.

Docs/worktree updates from this reset:

- `docs/dev-context/Transition-Human-Review-Checklist-2026-05-31.md` now opens
  with the page-agnostic scope rule and classifies review by global transition
  family instead of review paths.
- `docs/dev-context/Page-Transitions-And-Section-Frames.md` now makes the
  page-agnostic contract explicit before the transition-kind registry.
- `docs/dev-context/Active-Build-Context.md` now routes future transition work
  through the same page-agnostic rule.
- `docs/dev-context/Visibility-Control-Conflict-Audit-2026-05-31.md` now
  frames show/hide, legend, editor, and save fixes as reusable ownership rules
  rather than fixture-path fixes.

## 2026-05-31 12:55 - Removed Page-Level Fixture Repairs

User correction accepted: page JSON edits are not allowed as transition fixes.
The Utah FORGE pages are disposable test fixtures and may be randomly changed
or deleted. Any page content mismatch must feed a global runtime/editor/save
rule, not a content patch.

Action taken:

- Logged the removed page/environment content edits in
  `docs/dev-context/Transition-Page-Fixture-Evidence-Register-2026-05-31.md`.
- Removed the page-level fixture repairs from the worktree by restoring the
  affected Utah FORGE environment/page JSON files to repository baseline.

Files restored as fixture cleanup:

- `projects/utah-forge/environment.json`
- `projects/utah-forge/pages/04_mt_high_resistivity_seismic.json`
- `projects/utah-forge/pages/05_mt_threshold_focus.json`
- `projects/utah-forge/pages/06_mt_low_resistivity_seismic.json`
- `projects/utah-forge/pages/08_mt_threshold_surfaces.json`
- `projects/utah-forge/pages/45_resistivity_isosurfaces.json`
- `projects/utah-forge/pages/51_mt_marching_cubes_focused.json`
- `projects/utah-forge/pages/52_mt_marching_cubes_full_extent.json`
- `projects/utah-forge/pages/99_unresolved_missing_tools.json`
- `projects/utah-forge/pages/100_page.json`
- `projects/utah-forge/pages/101_page.json`
- `projects/utah-forge/pages/102_page.json`
- `projects/utah-forge/pages/103_page.json`
- `projects/utah-forge/pages/104_page.json`

Important boundary:

- Keep the global code fixes and tests for transition-gated editor writes,
  canonical MT boundary visibility normalization, effective scene-section frame
  normalization, validation, section ISO transition envelope, and scene-section
  helper/reference-layer continuity.
- Do not reapply the removed page JSON values as a fix. Use the evidence
  register when planning stronger generic validation or normalization.
- Validation boundary updated: raw page/environment duplicate-state mismatches
  are evidence, while normalized effective state is the failing contract. This
  keeps `check:pages` from forcing content patches when global normalization can
  resolve throwaway fixture state.
