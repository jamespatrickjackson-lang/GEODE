# Phase 1 Transition Diagnosis

Report ID: codex-phase1-transition-diagnosis-20260613-7a94c1
Active repo audited: C:\GeoSee\GeoSee_Dev
Report folder: C:\GeoSee\GeoSee_Dev\Transition Architecture\Phase_1_Diagnosis
Phase 1 prompt: C:\Users\james\.codex\attachments\fcf0ff80-8aff-4570-aef4-5dfe29b2e318\pasted-text.txt
Created: 2026-06-13

## Summary Verdict

Recommendation: harden incrementally.

Current evidence does not justify a transition re-architecture. The targeted source tests pass, broad static checks pass, and live hook probes reproduced stable transition clocks, per-frame section partitioning, right-handed helper transforms, settled page state, and zero late reapply events during the sampled transitions.

Defect count by behavior family:

| Family | Count | Status | Notes |
| --- | ---: | --- | --- |
| User-reported section helper visual defect | 1 | needs visual evidence | `Y issue 1` / `Y issue 2` remain high priority, but hook evidence did not show invalid Y basis, invalid determinant, or stale active frame bleed. |
| Diagnostic / coverage inconsistency | 1 | reproduced in hook state | Transition commit diagnostics can still report large `unresolvedCoverage` lists for section style and derived helper keys even when visible deltas are zero. |
| Source-test regressions | 0 | not reproduced | All requested focused transition tests passed. |
| Broad static regressions | 0 | not reproduced | `tsc`, page validation, and workspace guard exited 0. |
| Matrix/deck-state coverage gap | 1 | not run | Matrix capture writes artifacts under `docs/dev-context/artifacts/transition-matrix`, so it was not run in a report-only pass. |

The smallest sufficient path is to harden the existing transition runtime with better numeric helper probes, one or two synthetic helper-geometry tests, and cleanup of diagnostic coverage reporting. A rewrite would be premature because the live and source evidence points to localized section-helper geometry or authoring-state questions, not broad shared-state failure.

## Scope And Contracts

Phase 1 prompt requirements:

- Write reports to `C:\GeoSee\GeoSee_Dev\Transition Architecture\Phase_1_Diagnosis` and decide harden-vs-rewrite with evidence (`pasted-text.txt:1`, `pasted-text.txt:4`, `pasted-text.txt:112`, `pasted-text.txt:137`, `pasted-text.txt:169`).
- Use `window.__pageController` and `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager` for live evidence (`pasted-text.txt:41`).
- Converge on defects, coverage, and recommendation rather than design changes.

Repository contracts read:

- `CLAUDE.md`: canonical active root is `C:\GeoSee\GeoSee_Dev`; dirty local work must be preserved; transition work must read the runtime operating spec; no page-fixture fixes for reusable behavior.
- `docs/dev-context/Transition-Runtime-Operating-Spec.md`: page transitions are deterministic diffs; MT full-density is protected; final commit must be visually idempotent; opacity has multiple owners; final reapply is not a visual fix (`Transition-Runtime-Operating-Spec.md:11`, `:13`, `:17`, `:27`, `:178`, `:187`, `:189`, `:226`, `:229`).
- `docs/dev-context/Page-Transitions-And-Section-Frames.md`: section masks are transition-scene channels; full-density scalar must use the scalar path; helper snapshots are tightly constrained; frame compatibility is decided by `sceneSectionFramePartition` (`Page-Transitions-And-Section-Frames.md:47`, `:60`, `:61`, `:80`, `:91`, `:110`, `:160`, `:191`, `:199`, `:221`, `:243`, `:261`, `:274`, `:339`).
- `docs/03-decisions.md`: DEC-162 through DEC-165 cover deferred editor flush, discrete color/material channels and `legendWritesLanded`, per-frame scene-section partition, and proper helper orientation (`docs/03-decisions.md:2826`, `:2839`, `:2864`, `:2900`).

## Command Verification

Focused tests:

| Command | Result |
| --- | --- |
| `node --test tests/tools/scene-section-frame-partition-source.test.mjs` | pass, 10 tests |
| `node --test tests/tools/scene-section-frame-orientation-source.test.mjs` | pass, 3 tests |
| `node --test tests/tools/scene-section-transition-behavior-source.test.mjs` | pass, 10 tests |
| `node --test tests/tools/section-iso-transition-source.test.mjs` | pass, 1 test |
| `node --test tests/tools/transition-entity-opacity-executor.test.mjs` | pass, 6 tests |
| `node --test tests/tools/transition-execution-plan.test.mjs` | pass, 17 tests |
| `node --test tests/tools/legend-authoring-gate.test.mjs` | pass, 6 tests |
| `node --test tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs` | pass, 5 tests |

Broad static checks:

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | pass, exit 0 |
| `node tools/validate-project-pages.mjs` | pass, `Project page wiring OK` |
| `npm run check:workspace` | pass, exit 0; reports dirty snapshot-sensitive local sketch state |

`check:workspace` reported 31 tracked changes and 11 untracked files before this report was written. Important dirty scope includes modified Utah FORGE pages, modified `projects/utah-forge/project.json`, modified `src/pages/dynamicCameraPose.ts`, untracked `Transition Architecture/`, untracked `Y Axis issue/`, untracked pages `177_page` through `181_page`, and untracked `tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs`.

## Live Runtime Method

Dev server:

- Started `npm run dev -- --host 127.0.0.1 --port 5187`.
- Opened project picker, selected `Utah FORGE`.
- Verified hooks: `window.__pageController.getState()` and `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager`.
- Stopped the temporary server after probes.

Live probes were hook based. No screenshot or human visual inspection was performed, so visual conclusions are `ready for visual check`, not visually confirmed.

Sampled transitions:

| Case | From | To | Runtime status |
| --- | ---: | ---: | --- |
| baseline-camera-overlay | 0 `156_page` | 1 `157_page` | not reproduced broken |
| section-y-plus-iso | 6 `140_page` | 7 `115_page` | not reproduced broken |
| section-iso-surfaces | 7 `115_page` | 8 `171_page` | not reproduced broken |
| seismic-integrated | 62 `49_seismic_fence_panels` | 63 `50_integrated_seismic_resistivity_context` | not reproduced broken |
| camera-orbit-sketch | 99 `149_page` | 100 `144_page` | not reproduced broken |
| seismic-to-yissue1 | 109 `47_seismic_footprint_velocity_support` | 110 `180_page` | not reproduced broken |
| yissue1-to-yissue2 | 110 `180_page` | 111 `181_page` | needs visual evidence |
| yissue2-to-yissue1 | 111 `181_page` | 110 `180_page` | needs visual evidence |
| interrupted yissue | 110 to 111, then back to 110 mid-transition | 110 | not reproduced broken in hook state |

Console messages in live probes were limited to expected Chromium/WebGL `GPU stall due to ReadPixels` warnings.

## Defect Inventory

| ID | Behavior family | Reproduction | Evidence | Expected vs observed | Severity / frequency | Suspected owner | Test coverage | Relation to DEC-164 / DEC-165 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TD-001 | Section helper visual, Y-axis apparent plane/cut-frame defect | Navigate `Y issue 1` (`180_page`, route index 110) and `Y issue 2` (`181_page`, route index 111). | User visual report says Y remains wrong. Source pages exist only in local sketch state. Live hook evidence shows `axis:y` basis determinant 1 and distinct X/Y/Z helper bases. | Expected: X, Y, and Z helpers visibly occupy correct distinct section planes with no misleading coplanarity. Observed by hooks: no invalid basis or stale id; observed visually by user: Y/Z appear coplanar and Y cut frames look rotated/wrong. | High priority, visual evidence still required. | `src/scene/section/sceneSectionController.ts`, helper frame geometry, window/extent resolution, helper snapshot opacity/draw order, possible active-frame coloring. | DEC-164 and DEC-165 source tests pass; no pixel/browser assertion covers helper outline vertices, cones, labels, or apparent coplanarity. | DEC-164 is active: Y moves, X/Z dissolve. DEC-165 is active: live helper basis determinant is 1. The remaining issue is probably outside the fixed determinant bug. |
| TD-002 | Transition diagnostics / graph coverage | Any section transition that reaches final commit; first detailed hook dump from `180_page` and `181_page` included large `unresolvedCoverage` lists while visible deltas were zero. | Live manager `lastTransitionCommitState` / `sceneTransition.transitionCommit` reported section style and derived helper keys in unresolved coverage after target commit. | Expected: diagnostics distinguish real unresolved visual deltas from observational coverage gaps. Observed: coverage noise remains even when `visibleDeltaCount` is 0 and final state is settled. | Medium for diagnosis, low for runtime visuals. | `src/scene/transitions/transitionCommitGate.ts`, `src/scene/transitions/transitionRenderGraphAdapter.ts`, target graph coverage reporting. | Current tests cover commit gating and source transition behavior, but not "coverage list is clean when visible deltas are zero." | Adjacent to DEC-164 because the noisy keys include scene-section style and derived helper channels. |
| TD-003 | Deck-state matrix evidence gap | Matrix tool was inspected but not run. | `tools/capture-transition-matrix.mjs` writes output roots and case artifacts by design. | Expected in Phase 1: deck-state evidence if available without violating report-only rule. Observed: running it would create extra artifacts under `docs/dev-context/artifacts/transition-matrix`. | Low, method gap only. | Matrix tooling; possible dry-run/stdout mode missing. | No direct test for no-write matrix capture mode. | Not DEC-164/165 behavior, but matrix artifacts can help catch section transition regressions if treated as deck-state only. |

## Clean List

DEC-164 per-frame section partition is active in source tests and live hooks.

- Source: `sceneSectionFramePartition` exists and returns `movingFrameIds` / `dissolveFrameIds` (`src/scene/transitions/sceneSectionFrameSignature.ts:203`, `:213`, `:214`, `:229`, `:231`, `:234`).
- Source: effective-layer classification wires the partition onto the tween (`src/scene/transitions/transitionEffectiveLayersForPage.ts:1056`, `:1060`, `:1061`, `:1075`, `:1076`).
- Live: `yissue1-to-yissue2` at 450 ms had `movingFrameIds: ["axis:y"]` and `dissolveFrameIds: ["axis:x", "axis:z"]`.
- Live: `yissue2-to-yissue1` had the same moving/dissolve partition in reverse.

DEC-165 proper helper orientation is active in source tests and live hooks.

- Source: helper code protects `makeBasis` against left-handed triples and builds the third column from the cross product (`src/scene/section/sceneSectionController.ts:3592`, `:3605`).
- Live `Y issue 2` settled helper bases:
  - `axis:x`: basis z `[0.9996, 0.0274, 0]`, determinant `1`.
  - `axis:y`: basis z `[0, -1, 0]`, determinant `1`.
  - `axis:z`: basis z `[0, 0, 1]`, determinant `1`.
- These runtime matrices are not numerically coplanar in the basis-normal sense.

Section transition-frame path is active and avoids per-tick helper rebuild during transition.

- Source: layer tween runtime has explicit `transition-frame` mode (`src/scene/transitions/layerTweenRuntime.ts:169`, `:201`, `:308`, `:324`).
- Live: section transitions sampled `sceneSectionApplyMode: "transition-frame"`.
- Live: Y issue transition midpoints had `helperRebuildMs: 0` while section uniforms/frame style advanced.

MT full-density scalar path remains protected in sampled transitions.

- Source: `full-density-scalar` appears in the page transition contract and effective layer code (`Page-Transitions-And-Section-Frames.md:61`, `:80`, `:91`; `src/scene/transitions/transitionEffectiveLayersForPage.ts:1019`, `:1251`).
- Live: `section-y-plus-iso`, `camera-orbit-sketch`, and `seismic-to-yissue1` carried `scalarTweenIds: ["utah-forge-mt-resistivity-full-density"]` when applicable.
- No hook evidence showed MT full-density falling back to generic layer opacity.

Section ISO root routing is covered by source tests and did not show hook-level failure.

- Source: `section-iso-root` executor mapping exists (`src/scene/transitions/transitionExecutionPlan.ts:117`, `:222`, `:269`).
- Source tests assert `sectionIsoStableLayerIds` and overlay visibility policy (`tests/tools/section-iso-transition-source.test.mjs:14`, `:23`, `:28`).
- Live section-ISO probe settled without late reapply or console errors.

Legend writes are gated.

- Source: `legendWritesLanded` is used by `SeismicVolumeLegend` (`src/ui/SeismicVolumeLegend.tsx:24`, `:389`).
- Source tests cover active transition, pending target, environment scope, no selection, matching landed page, and mismatched selected page (`tests/tools/legend-authoring-gate.test.mjs:42`, `:49`, `:62`, `:75`, `:88`, `:101`, `:114`).

Dynamic camera runaway radius is clamped.

- Source: clamp owner is `src/pages/dynamicCameraPose.ts` (`src/pages/dynamicCameraPose.ts:45`, `:49`, `:54`, `:210`, `:226`, `:227`).
- Source tests cover the previously observed `149_page` runaway value and budget (`tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs:10`, `:11`, `:14`, `:54`, `:57`, `:58`, `:93`, `:98`).
- Live `camera-orbit-sketch` transition did not reproduce a hook-level camera failure.

Interruption/replan did not reproduce stale transition state in hooks.

- Source: `PageController` records interrupted runs and sets interruption reason (`src/pages/PageController.tsx:78`, `:133`, `:2217`, `:2518`, `:2525`, `:2558`).
- Live: starting `180_page -> 181_page`, then navigating back to `180_page`, produced a new `reason: "interrupted"` context, settled at `180_page`, and kept `lateReapplyDuringTransitionCount: 0`.

## Y Issue Evidence Details

Current page data:

- `projects/utah-forge/pages/180_page.json` is titled `Y issue 1` (`projects/utah-forge/pages/180_page.json:3`).
- `180_page` has `sceneSectionActiveFrameId: "axis:y"` and `sceneSectionActiveAxis: "y"` (`projects/utah-forge/pages/180_page.json:273`, `:277`).
- `projects/utah-forge/pages/181_page.json` is titled `Y issue 2` (`projects/utah-forge/pages/181_page.json:3`).
- `181_page` has `sceneSectionActiveFrameId: "axis:x"` and `sceneSectionActiveAxis: "x"` (`projects/utah-forge/pages/181_page.json:273`, `:277`).
- Both pages are currently untracked local files.

Live `Y issue 1` settled state:

```text
currentPageId: 180_page
activeAxis: y
activeFrameId: axis:y
enabledFrameIds: axis:y
axis:y plane positionM: 10492.8397
axis:y helper position: [-54644.7169, 10492.8397, -1547.1247]
axis:y helper quaternion: [0.7071, 0, 0, 0.7071]
axis:y helper basis: x [1, 0, 0], y [0, 0, 1], z [0, -1, 0], determinant 1
```

Live `Y issue 2` settled state:

```text
currentPageId: 181_page
activeAxis: x
activeFrameId: axis:x
enabledFrameIds: axis:x, axis:y, axis:z
axis:x basis: x [-0.0274, 0.9996, 0], y [0, 0, 1], z [0.9996, 0.0274, 0], determinant 1
axis:y basis: x [1, 0, 0], y [0, 0, 1], z [0, -1, 0], determinant 1
axis:z basis: x [1, 0, 0], y [0, 1, 0], z [0, 0, 1], determinant 1
```

Live `Y issue 1 -> Y issue 2` transition:

```text
mid 450 ms:
  source: 180_page
  target: 181_page
  progress: 0.347
  sceneSectionStyleTweenActive: true
  helperSnapshotActive: true
  helperOpacity: 0
  activeAxis: x
  activeFrameId: axis:x
  movingFrameIds: axis:y
  dissolveFrameIds: axis:x, axis:z
  helperObjectCount: 70
  lateReapplyDuringTransitionCount: 0

mid 1850 ms:
  progress: 0.9994
  helperOpacity: 0.9558
  movingFrameIds: axis:y
  dissolveFrameIds: axis:x, axis:z
```

Live `Y issue 2 -> Y issue 1` transition:

```text
mid 450 ms:
  source: 181_page
  target: 180_page
  progress: 0.0893
  sceneSectionStyleTweenActive: true
  helperSnapshotActive: true
  helperOpacity: 0
  activeAxis: y
  activeFrameId: axis:y
  movingFrameIds: axis:y
  dissolveFrameIds: axis:x, axis:z
  helperObjectCount: 24
  lateReapplyDuringTransitionCount: 0

mid 1850 ms:
  progress: 0.9936
  helperOpacity: 0.9173
  movingFrameIds: axis:y
  dissolveFrameIds: axis:x, axis:z
```

Interpretation:

- The Y helper transform is right-handed and stable in both settled states.
- The transition partition is doing the expected DEC-164 split: Y is the moving frame, X/Z are discrete dissolve frames.
- The apparent visual coplanarity reported by the user was not proven by numeric helper bases.
- The remaining high-risk areas are helper mesh geometry, frame window/extent resolution, snapshot/live helper crossfade opacity and depth ordering, and target-active coloring/labels when active frame changes from Y to X while Y is the moving frame.

## Potential Root-Cause Candidates

Ranked by current risk:

1. Helper mesh geometry, outline vertices, cone orientation, or frame extent/window resolution.
   - Reason: live matrices are right-handed, but the visual complaint is about frame placement and apparent planes. The problem may be in mesh vertices, not group basis.
   - Evidence need: outline vertices, cone transforms, label transforms, ribbon/edge widths, depth settings, and frame min/max defaults for X/Y/Z.

2. Target-active active-frame state during a moving-frame transition.
   - Reason: `Y issue 1 -> Y issue 2` switches active frame to X while Y is the moving frame and X/Z dissolve. Coloring, labels, handles, or authoring affordances may read target active state earlier than users expect.
   - Evidence need: active-frame color assignment, label opacity, and control handle owner during midpoint.

3. Helper snapshot crossfade draw order or opacity.
   - Reason: Y issue transitions have `helperSnapshotActive: true`; live target helpers and snapshot helpers may visually overlap even if basis math is valid.
   - Evidence need: snapshot helper group contents, render order, depthTest/depthWrite, and opacity envelopes.

4. Frame dimension fallback from incomplete per-frame extents.
   - Reason: saved Y frames omit some min/max values and rely on window or bounds fallback. That can be valid, but it is a risk if stale window state is carried between axes.
   - Evidence need: resolved min/max A/B after fallback for each axis, plus source of fallback values.

5. Diagnostic coverage noise hiding a real state gap.
   - Reason: unresolved coverage entries after visible-delta zero make it harder to separate a real transition miss from a benign graph limitation.
   - Evidence need: reduced commit coverage rows that classify ignored observational differences separately from real unresolved deltas.

Lower-risk candidates after this pass:

- Source face-frame override. The `Y issue` pages use built-in `axis:x`, `axis:y`, and `axis:z` frames; no custom `normal`, `axisAVector`, or `axisBVector` were present in the inspected page JSON.
- Broad stale active frame ID bleeding into Y. Hook state tracked the intended target active frame and moving/dissolve frame ids with no stale `axis:x` or `axis:z` left after settle.
- Transition replan contamination. The interruption probe settled correctly with `reason: "interrupted"` and no late reapply during transition.

## Test-Net Gaps

Missing or weak coverage:

1. No browser or synthetic test asserts helper mesh vertices for X/Y/Z after `rebuildSceneSectionHelpers`.
2. No test asserts cone/handle transforms, labels, or frame outline ribbon geometry for the Y basis.
3. No test asserts visual non-coplanarity or screen-space separation of X/Y/Z helper frames.
4. No test asserts active-frame coloring/labels during a transition where active frame changes but another stable frame is moving.
5. No test asserts commit diagnostic `unresolvedCoverage` is empty or explicitly categorized when `visibleDeltaCount` is zero.
6. Matrix tool has no no-write stdout mode, so it conflicts with a report-only audit unless extra artifacts are allowed.
7. Runtime probes are hook evidence only. No actual browser screenshot or human visual check occurred in this pass.

## Recommended Hardening Plan

1. Add a dependency-free helper-basis and helper-geometry source test.
   - Fixture should include X/Y/Z, a Y-only page, and a Y-to-X-active multi-axis page.
   - Assert determinant, basis axes, min/max A/B fallback source, frame center, and outline vertex plane membership.

2. Add a Playwright probe that runs without authoring writes.
   - Navigate through fixture-like pages.
   - Dump helper group basis, outline vertices, cone transforms, label transforms, shader section uniforms, helper snapshot opacity, renderOrder, depthTest, and depthWrite.
   - Mark result `ready for visual check` unless screenshot/human visual inspection is done.

3. Add midpoint assertions for the Y issue transition pattern.
   - Source Y only, target X/Y/Z.
   - Assert `movingFrameIds = ["axis:y"]`, `dissolveFrameIds = ["axis:x", "axis:z"]`, no late reapply, and stable helper basis.
   - Add separate assertions for active frame color/label owner during the transition.

4. Clean transition commit diagnostics.
   - Keep real visible deltas loud.
   - Move expected observational gaps or unresolved style keys into a separate category when final target graph and committed graph are visually equivalent.

5. Add a no-write mode to transition matrix tooling or keep it out of report-only passes.
   - Current tool writes manifest, case JSON, trace JSON, and optionally video artifacts.
   - A `TRANSITION_MATRIX_OUT=stdout` or `TRANSITION_MATRIX_DRY_RUN=1` mode would support audit-only use.

6. Keep fixes page-agnostic.
   - No `180_page` / `181_page` special cases.
   - No page-title or route-index workarounds.
   - No section-data purge unless helper basis, geometry, and style-state evidence proves data corruption is the actual owner.

## Re-Architecture Assessment

Re-architecture is not recommended from this evidence.

Reasons:

- The requested targeted tests passed across section partition, helper orientation, section ISO, exact entity opacity, execution plan mapping, legend authoring gate, and camera clamp.
- Live probes showed current transition runs have stable source/target context, settle cleanly, and keep `lateReapplyDuringTransitionCount` at 0.
- DEC-164 and DEC-165 are both demonstrably active in live Y issue transitions.
- Observed residual risks are localized: helper mesh geometry, helper snapshot presentation, active-frame visual semantics, and diagnostics.

Re-architecture should only be reconsidered if a future visual/runtime probe shows repeated failures across unrelated entity families that cannot be isolated by existing executor boundaries.

## Method Notes

Read-only commands were used except for this report artifact. No source, page JSON, data, staging, cleanup, or purge changes were made intentionally.

The live app was inspected through hooks only. Browser visual confirmation did not happen in this pass. Y issue status is therefore:

```text
ready for visual check
```

The saved Y issue pages are local sketch-state files:

```text
?? projects/utah-forge/pages/180_page.json
?? projects/utah-forge/pages/181_page.json
```

The existing dirty worktree means all live evidence describes the current local sketch state, not the committed `main` baseline.

## Do Not Do Yet

- Do not purge section data.
- Do not rewrite the transition architecture.
- Do not patch `180_page` or `181_page` directly as a reusable fix.
- Do not use page title, page id, or route index as runtime logic.
- Do not rewrite transitions to solve a helper-mesh or visual-authoring problem before numeric helper geometry evidence exists.
- Do not claim the Y visual issue is fixed without actual browser/human visual confirmation.
