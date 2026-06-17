# GEOSEE-Y-AXIS-RUNTIME-AUDIT-20260613-123935-CODEX

## 1. Executive Summary

Highest-confidence finding: the reported Y-section failure is not saved-page corruption and not the clipping plane itself. The strongest failure surface is helper/frame orientation math for the Y axis: the default Y basis uses axisA=X and axisB=Z, so `X x Z = -Y`. Feeding axisA, axisB, and positive Y normal into `Matrix4.makeBasis(...)` creates a left-handed/reflected basis, and `Quaternion.setFromRotationMatrix(...)` can rotate the visible helper to the wrong plane. Current dirty-tree source already contains an uncommitted correction that derives helper orientation from `tangentA x tangentB`; current runtime did not reproduce a settled wrong Y plane.

Current runtime evidence:

- `Y issue 1`: Y helper frame spans X and Z with zero Y span; MT volume section normal is `[0,1,0]`, position `10492.84`, frame count `1`.
- `Y issue 2`: X, Y, Z frames are distinct; Y has zero Y span, Z has zero Z span, X has a small source-basis skew but remains X-normal.
- Browser screenshots showed current dirty-tree Y as a vertical X/Z plane, not a Z-horizontal plane.
- During page transitions, helper snapshots/live helpers overlap by design. This explains transient bleed better than saved-state corruption.

Conclusion: the issue is surgically fixable. The section system has duplicated axis/frame logic that needs hardening, but evidence does not justify a rebuild.

## 2. Problem Restatement

Three symptoms were separated:

1. `Y issue 1`: Y section/frame appears rotated, displaced, or drawn on the wrong plane.
2. `Y issue 2`: X/Y/Z are visible and Y/Z appear coplanar in the reported symptom.
3. Page switching appears to bleed visual state from one page into the next.

The audit prioritized the root reason that Y can become wrong, then treated transition bleed as a separate lifecycle question.

## 3. Method

Static work performed:

- Captured `git status --short`, `git branch --show-current`, `git log --oneline -8`.
- Confirmed `C:\GeoSee\GeoSee_Dev\Y Axis issue` existed before writing this report.
- Read active context, transition runtime spec, page transition/frame docs, transition constitution/continuity/guardrails, runtime diagnostics, transition decision log, and decisions.
- Located `Y issue 1` and `Y issue 2` with `rg`.
- Inspected page JSON, project page order, effective state composition, scene-section controller, transition runtime, page controller, scene manager, and relevant tests.

Runtime work performed:

- Reused the already-running Vite server on `127.0.0.1:5173`; no server was started or stopped.
- Opened `http://127.0.0.1:5173/?project=utah-forge` in the in-app Browser.
- Selected `Y issue 1` via `[data-page-id="180_page"]` and captured a visual screenshot.
- Selected `Y issue 2` via `[data-page-id="181_page"]` and captured a visual screenshot.
- Confirmed the save indicator remained `Saved` with no pending edits.
- Used headless Playwright as a read-only probe because the in-app Browser exposes a restricted read-only evaluation context that cannot see main-world dev globals. The headless probe read `window.__scene` and `window.__pageController`, sampled settled pages, and sampled transitions in both directions.

Read-only commands run:

~~~powershell
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tools/validate-project-pages.mjs
~~~

All passed. No temporary repo files were intentionally created. No source, saved project state, docs, config, tests, package files, or generated app assets were edited.

Initial branch: `main`.

Initial recent commits:

~~~text
035e3a8 Fade section helper disable handoffs through exit snapshots
d547321 Gate matrix capture readiness on canvas and controller
151d629 Gate legend writes, declare discrete channels, clock overlays
5b0abab Author Utah FORGE deck page edits and add pages 168-177
6b00709 Smooth topo public surface transitions
55a0244 Fix high-priority transition runtime handoffs
fa0b0b2 Add agent handoff prompt to transition review report
4a61980 Add quick legend and editor interplay transition findings
~~~

Initial status already contained broad pre-existing dirt: modified docs, modified Utah page JSON/project JSON, modified section/transition source, untracked pages `177_page.json` through `181_page.json`, untracked overlays, untracked `src/scene/transitions/sceneSectionFrameSignature.ts`, untracked section-frame tests, and an untracked `Y Axis issue/` folder. These were preserved.

`git log --all --grep=...` failed because of pre-existing bad ref `refs/codex/desktop.ini`; non-`--all` history remained usable.

## 4. Files and Artifacts Reviewed

- `docs/dev-context/Active-Build-Context.md`: active build/transition routing.
- `docs/dev-context/Transition-Runtime-Operating-Spec.md`: page-agnostic transition contract; DEC-164 per-frame compatibility.
- `docs/dev-context/Page-Transitions-And-Section-Frames.md`: helper/frame transition expectations and old helper rebuild hazard.
- `docs/dev-context/Transition-Constitution.md`, `Transition-Continuity-Contract.md`, `Transition-Guardrails.md`, `Runtime-Diagnostics.md`: transition contracts and runtime debug surface.
- `docs/dev-context/Transition-Decision-Log.md`: TRD-010 section helper/mask transition behavior, TRD-012 target-active/no-bleed rule.
- `docs/03-decisions.md`: DEC-151 source-derived scene section faces; uncommitted DEC-164 per-frame partition; uncommitted DEC-165 right-handed helper orientation.
- `projects/utah-forge/project.json`: page order places `180_page` at index 110 and `181_page` at index 111.
- `projects/utah-forge/pages/180_page.json`: `Y issue 1` saved page.
- `projects/utah-forge/pages/181_page.json`: `Y issue 2` saved page.
- `projects/utah-forge/environment.json`: inherited scene section and terrain defaults.
- `src/scene/section/sceneSectionController.ts`: axis specs, basis vectors, source basis, resolved planes/frames, clipping planes, shader uniforms, helper rebuild, apply/reapply lifecycle.
- `src/pages/effective.ts`: scene-section normalization and shallow page/preset/environment style merge.
- `src/pages/PageController.tsx`: initial apply, authoring preview, `goto`, transition start/complete, dev debug handle.
- `src/scene/SceneManager.ts`: transition debug state, active transition reapply, current page reapply, final commit behavior.
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`: source/target effective states, scene-section tween setup, target-active handling.
- `src/scene/transitions/layerTweenRuntime.ts`: transition tick, interpolated scene-section style, final target commit.
- `src/scene/transitions/transitionStyles.ts`: scene-section tween fields and discrete signature linkage.
- `src/scene/transitions/sceneSectionFrameSignature.ts`: untracked frame signature/partition logic.
- `tests/tools/scene-section-frame-orientation-source.test.mjs`: source guard for right-handed helper basis.
- `tests/tools/scene-section-frame-partition-source.test.mjs`: source guard for per-frame partition.
- `tests/tools/scene-section-transition-behavior-source.test.mjs`: source guard for transition behavior.
- In-app Browser screenshots for `Y issue 1` and `Y issue 2`: visual confirmation only, not saved in repo.
- Headless Playwright probe output: runtime helper extents, uniforms, terrain material trace, transition debug state.

## 5. Saved Page Evidence

### Y issue 1

Path: `projects/utah-forge/pages/180_page.json`

Identity: `id=180_page`, `title=Y issue 1`. Page order index: `110`.

Effective section state:

~~~json
{
  "sceneSectionEnabled": true,
  "sceneSectionMode": "cutaway",
  "sceneSectionTargetScope": "selected-targets",
  "sceneSectionTargetLayerIds": [
    "utah-forge-mt-resistivity-volume",
    "utah-forge-mt-resistivity-slices",
    "utah-forge-phase3-seismic-browser"
  ],
  "sceneSectionTargetProductIds": ["gdr-1141-forge3d-ani-psdm-stack-unenh"],
  "sceneSectionActiveAxis": "y",
  "sceneSectionActiveFrameId": "axis:y",
  "sceneSectionFrameEnabled": true,
  "sceneSectionAxesVisible": true,
  "sceneSectionWindowEnabled": true,
  "sceneSectionWindowActiveAxis": "y"
}
~~~

Planes: X disabled at `-53897.0086`, Y enabled at `10492.8397`, Z disabled at `45914.2913`.

Y frame/window: axis `y`, frame axes X/Z (`axisAIndex=0`, `axisBIndex=2`), min/max A `[-118667.9825, 9378.5488]`, min/max B `[-40286.5512, 37192.3018]`.

Assessment: saved JSON asks for a Y-normal X/Z section. It is coherent and not corrupted.

Render stack for `Y issue 1`:

- No page `envSnapshot`.
- Page `sceneOverrides` set background `#383838`, fog density `0.0000037267080745341615`, terrain material preset `image:naip-2024-aerial`.
- Effective active preset from saved/effective state: `default`; runtime `lastAppliedRenderPresetId` was `null`.
- Active terrain texture URL/cache key: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`.
- Runtime URL: `http://127.0.0.1:5173/projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`.
- Bounds: `[229069.2, 4094688, 598806, 4414308]`.
- Terrain geometry/material: `BufferGeometry`, `ShaderMaterial`.
- Public clip state: enabled; runtime terrain had six clip planes with x/y constants `229000` to `271000`, z constants `23000` to `27000`.
- Edge fade: rounded-square numeric shape `1`, distance `90000`, inset `40000`, corner radius `140000`.
- Edge outline: disabled, `uEdgeOutlineEnabled=0`, `uEdgeOutlineOpacity=0`.

### Y issue 2

Path: `projects/utah-forge/pages/181_page.json`

Identity: `id=181_page`, `title=Y issue 2`. Page order index: `111`.

Effective section state:

~~~json
{
  "sceneSectionEnabled": true,
  "sceneSectionMode": "cutaway",
  "sceneSectionTargetScope": "all-visible",
  "sceneSectionActiveAxis": "x",
  "sceneSectionActiveFrameId": "axis:x",
  "sceneSectionFrameEnabled": true,
  "sceneSectionAxesVisible": true,
  "sceneSectionWindowEnabled": true,
  "sceneSectionWindowActiveAxis": "x"
}
~~~

Planes: X enabled at `-53897.0086`, Y enabled at `14232.0884`, Z enabled at `45914.2913`.

Frames: X uses Y/Z (`axisAIndex=1`, `axisBIndex=2`), Y uses X/Z (`axisAIndex=0`, `axisBIndex=2`), Z uses X/Y (`axisAIndex=0`, `axisBIndex=1`).

Suspicious/inherited fields: `181_page.json` does not explicitly author `sceneSectionTargetScope`, target layer IDs, or product IDs. Effective state inherits `all-visible` and inherited targets. This affects target ownership, not axis geometry. It does not make Y and Z coplanar.

Assessment: saved JSON asks for three distinct orthogonal planes. It is coherent and not corrupted.

Render stack is materially the same as `Y issue 1`: same NAIP texture/cache key, same bounds, public clip enabled, edge fade enabled, edge outline disabled, terrain `ShaderMaterial` on `BufferGeometry`.

## 6. Runtime Observation

App/runtime path:

- Existing app server: `http://127.0.0.1:5173/?project=utah-forge`.
- Initial loaded presentation page: `156_page`; editor selection initially showed `00. Global Settings`.
- `Y issue 1` and `Y issue 2` were selected through the Pages panel.
- Save indicator remained `Saved`; no pending edits appeared.

Visual Browser observation:

- `Y issue 1`: cyan Y section appeared vertical and X/Z-oriented in the current dirty tree. The Y quick legend was selected.
- `Y issue 2`: red X, cyan Y, and yellow Z states appeared visually separate in the current dirty tree. Camera perspective compresses depth, but runtime extents prove Y and Z are not the same plane.

Settled runtime, `Y issue 1`:

~~~text
currentPageId: 180_page
Y frame plane coordinate: 1
Y frame plane: 10492.84
Y frame extents min: [-118967.982, 10492.84, -40586.55]
Y frame extents max: [9678.549, 10492.84, 37492.301]
Y frame span: [128646.531, 0, 78078.852]
Y helper parent basis: x=[1,0,0], y=[0,0,1], z=[0,-1,0], det=1
MT volume planeCount: 1
MT normal[0]: [0,1,0]
MT position[0]: 10492.84
MT frameBounds[0]: [-118667.983, 9378.549, -40286.551, 37192.302]
~~~

Settled runtime, `Y issue 2`:

~~~text
currentPageId: 181_page
X frame span: [1800.569, 65644.006, 32450.863]
Y frame span: [128646.531, 0, 48516.988]
Z frame span: [135269.922, 60830.254, 0]
MT volume planeCount: 3
MT normals: [1,0.027,0], [0,1,0], [0,0,1]
MT positions: [-51132.615, 14232.088, 45914.291]
~~~

The X normal's small Y component (`0.027`) is source-derived skew, not a Y/Z swap.

Transition samples:

`Y issue 1 -> Y issue 2`:

~~~text
sample 0: source=180_page, target=181_page, sectionTween=true, helperSnapshot=true, helperOpacity=0, frames include x/y/z plus source y, MT planeCount=1
mid: progress=0.997280, sectionTween=true, helperSnapshot=true, helperOpacity=0.945712, MT Y position interpolated to 14029.091
final: current=181_page, sectionTween=false, helperSnapshot=false, frames are x/y/z only, MT planeCount=3
~~~

`Y issue 2 -> Y issue 1`:

~~~text
sample 0: source=181_page, target=180_page, sectionTween=true, helperSnapshot=true, helperOpacity=0, frames include x/y/z plus y, MT planeCount=3
mid: progress=0.957331, sectionTween=true, helperSnapshot=true, helperOpacity=0.830793, MT Y position interpolated to 11125.548
final: current=180_page, sectionTween=false, helperSnapshot=false, frame is y only, MT planeCount=1
~~~

Console output:

- Only expected Chromium/WebGL `GPU stall due to ReadPixels` warnings appeared.
- No page errors.
- No non-GPU console warnings/errors.

Direct-load behavior: not fully tested. No page-specific route for `180_page` or `181_page` was discovered. The known route selects project only.

Reload behavior: not tested for diagnostic pages because no stable page-specific direct URL was found.

Transition off/on behavior: not tested. No clearly non-mutating transition-disable UI was found, and saved state was not changed.

Camera explanation: camera angle can make the all-axis page visually compressed, but it cannot explain the runtime extents. Y has zero Y span; Z has zero Z span.

Clipping/helper agreement: current dirty-tree settled runtime shows agreement. The actual clipping plane and visible helper both represent Y as an X/Z plane on `Y issue 1`.

## 7. Coordinate and Axis Convention

Actual convention:

- GeoSee scene/world is Z-up. `THREE.Object3D.DEFAULT_UP` is set to `(0,0,1)` in `src/scene.ts`.
- Section axis names are plane-normal names in `src/scene/section/sceneSectionController.ts`.
- Expected planes:
  - X section = normal along X, plane is Y/Z.
  - Y section = normal along Y, plane is X/Z.
  - Z section = normal along Z, plane is X/Y.

Source basis facts:

- X normal: `[1,0,0]`; frame A/B = Y/Z.
- Y normal: `[0,1,0]`; frame A/B = X/Z.
- Z normal: `[0,0,1]`; frame A/B = X/Y.

Y is not vertical in section semantics. Z is vertical in world/geospatial semantics. The hazard is not a semantic remap from Y-up to Z-up; the hazard is handedness when Y uses X/Z as the frame plane.

Current corrected Y helper runtime basis:

~~~text
local x -> world X
local y -> world Z
local z -> world -Y
determinant = 1
~~~

That keeps the helper on the X/Z plane while using a proper rotation matrix.

## 8. Axis and Frame Construction Analysis

Relevant source path in `src/scene/section/sceneSectionController.ts`:

- Axis spec table defines normal/color/frame axes for X/Y/Z.
- `sceneSectionBasisVectors(...)` returns default normal/axisA/axisB.
- `sceneSectionOrthonormalSourceBasis(...)` handles source-face derived bases.
- `resolveSceneSectionPlanes(...)` resolves enabled plane, position, normal, axisA, axisB.
- `resolveSceneSectionFrames(...)` resolves frames, window bounds, source-face overrides.
- `sceneSectionFrameClippingPlanes(...)` builds frame clip planes from frame axis vectors and bounds.
- Material uniform application writes section normals, positions, frame axes, and frame bounds.
- `rebuildSceneSectionHelpers(...)` builds helper group, outlines, labels, cones, handles.
- `applySceneSectionPlanes(...)` applies material state and rebuilds helpers when not on a transition frame.

Critical asymmetry:

~~~text
Y default basis before the current local fix:
normal = +Y
axisA = +X
axisB = +Z
axisA x axisB = -Y
~~~

That is left-handed relative to positive Y normal. X and Z default bases are naturally right-handed with their chosen A/B order. Y is the unique trap.

Current dirty-tree behavior uses `orientationNormal = tangentA x tangentB` for helper quaternion construction. Runtime confirmed determinant `1` for the Y helper basis.

## 9. Clipping vs Helper Visual Agreement

Clipping and helper visuals share resolved plane/frame state, but the historical helper orientation path could diverge at quaternion construction.

Clipping path:

- Uses resolved plane normal and signed position.
- Runtime `Y issue 1` MT uniform normal was `[0,1,0]`.
- Runtime `Y issue 1` MT position was `10492.84`.

Helper path:

- Uses frame tangents and a basis-derived quaternion.
- Historical bug surface: correct Y plane data plus wrong helper quaternion due left-handed basis.

Current dirty-tree agreement:

- Y helper extents: zero Y span.
- MT normal: `[0,1,0]`.
- Visual screenshot: Y helper appears vertical X/Z.

Best diagnosis: clipping was likely correct while visible Y helper/frame was wrong before the local orientation fix.

## 10. State Lifecycle and Bleed Analysis

Lifecycle traced:

1. App loads project and mounts scene.
2. Initial page state applies pose, visibility, effective layer styles, scene state, and overlays.
3. Editor selection can preview a page without saving.
4. Presentation navigation calls `goto(index, reason)`.
5. Source and target presentation states are resolved.
6. `transitionEffectiveLayersForPage(...)` classifies layer/section state, starts section tweens, and creates helper snapshots when needed.
7. `layerTweenRuntime` applies interpolated section state during transition frames.
8. Final commit applies target state and clears active transition/snapshot state.

Bleed checks:

- Source/target merge instead of replace: not observed after settle.
- Partial page application: not observed after settle.
- Old helper group surviving final commit: not observed after settle.
- Cached helper geometry not rebuilt on axis change: not observed after settle.
- Late async reapply during transition: runtime `lateReapply.duringTransitionCount` stayed `0`.
- Transition helper overlap: observed and expected. Runtime showed source/target helper snapshots during transitions.

Most likely bleed mechanism: transition-time helper snapshot/live helper overlap. It can look like page bleed during the transition window. Current dirty-tree final states were target-authoritative.

## 11. Transition Analysis

Transitions can explain transient bleed. Runtime samples in both directions showed:

~~~text
sectionTween=true
helperSnapshot=true
policy=translate-section-helpers
kind=continuous
~~~

Transitions do not explain the underlying wrong Y orientation. They can carry/display a wrong helper if helper construction is wrong, but the Y-specific failure originates in helper basis construction.

Section helpers appear to be transitioned by frame identity in current local work. `sceneSectionFrameSignature.ts` partitions moving/dissolving frames, and the per-frame partition source test passed.

Y/Z identity collision was not observed. Runtime showed distinct `axis: y` and `axis: z` outlines. During transitions, duplicate Y entries represented source/live or snapshot/live helper representations, not Y/Z collision.

Transition interruption was not stress-tested. However, normal completed transitions cleared helper snapshots and ended with the correct target frame set.

Hard-load difference was not tested because no page-specific direct route was found.

## 12. Recent Fixes / Guards / Shims

Recent commits:

- `035e3a8 Fade section helper disable handoffs through exit snapshots`
  - Files: `SceneManager.ts`, `sceneSectionController.ts`, `transitionEffectiveLayersForPage.ts`, helper transition test/analyzer.
  - Intent: helper disable handoffs through exit snapshots.
  - Possible involvement: transition-time helper bleed. Confidence Medium for bleed, Low for Y orientation.

- `151d629 Gate legend writes, declare discrete channels, clock overlays`
  - Files: page controller, scene manager, overlays, transition policy, legends, tests.
  - Intent: transition channel and UI stability.
  - Possible involvement: transition symptoms. Confidence Medium for transition, Low for Y orientation.

- `6b00709 Smooth topo public surface transitions`
  - Intent: terrain/public clip smoothing.
  - Possible involvement: not a section-axis root cause. Confidence Low.

Relevant uncommitted local changes:

- `docs/03-decisions.md`: DEC-164 per-frame partition and DEC-165 right-handed helper orientation. Confidence High.
- `src/scene/section/sceneSectionController.ts`: uncommitted helper orientation correction and transition-style handling. Confidence High.
- `src/scene/transitions/sceneSectionFrameSignature.ts`: untracked frame signature/partition logic. Confidence High for transition hardening.
- `tests/tools/scene-section-frame-orientation-source.test.mjs`: untracked guard for Y helper orientation. Confidence High.
- `tests/tools/scene-section-frame-partition-source.test.mjs`: untracked guard for per-frame transition partition. Confidence High.

Shim/duplication risk:

- `src/pages/effective.ts` normalizes modern per-axis scene-section state.
- `src/scene/transitions/sceneSectionFrameSignature.ts` composes frame signatures separately.
- The diagnostic pages did not expose a mismatch, but this duplication can preserve stale built-in frame entries in future work if merge order diverges.

## 13. Ranked Root Cause Hypotheses

### 1. Left-handed Y helper basis corrupts visible helper orientation

Confidence: High.

Evidence:

- Y default basis is X/Z with positive Y normal; `X x Z = -Y`.
- `Matrix4.makeBasis` plus quaternion conversion requires a proper rotation, not a reflected basis.
- Current local DEC-165 and source comments name this exact Y trap.
- Current dirty-tree runtime shows the corrected Y parent basis determinant is `1`.
- Orientation source guard passed.

Counter-evidence: current dirty-tree runtime no longer reproduces the settled wrong Y plane, so historical failing behavior was not captured live on an old revision.

Files/functions: `sceneSectionBasisVectors`, `rebuildSceneSectionHelpers`, DEC-165, `scene-section-frame-orientation-source.test.mjs`.

Explains `Y issue 1`: yes. Explains `Y issue 2`: yes, partially, because a wrong Y helper can appear near the Z plane. Explains bleed: no, except that transitions can display the wrong source helper.

Would falsify: an old failing runtime showing a right-handed Y helper basis but wrong helper plane, or showing the actual clipping normal was also swapped.

### 2. Transition helper snapshot/live overlap explains page-to-page bleed

Confidence: Medium-High.

Evidence: runtime showed `sectionTween=true`, `helperSnapshot=true`, `translate-section-helpers`, duplicate helper outlines during transition, and clean final state.

Counter-evidence: transition cancellation was not stress-tested; reported human symptom might have occurred on another dirty-tree timing path.

Files/functions: `transitionEffectiveLayersForPage.ts`, `layerTweenRuntime.ts`, `sceneSectionFrameSignature.ts`, `sceneSectionController.ts`.

Explains `Y issue 1`: no. Explains `Y issue 2`: only during transition. Explains bleed: yes.

Would falsify: post-transition settled state still containing source helpers or `helperSnapshot=true`.

### 3. Saved page JSON corrupts or swaps Y/Z

Confidence: Low.

Evidence: none found. Both pages encode expected axes and frames.

Counter-evidence: `Y issue 2` inherits target scope/targets, but inheritance is not axis corruption.

Files: `180_page.json`, `181_page.json`, `effective.ts`.

Explains `Y issue 1`: no. Explains `Y issue 2`: no. Explains bleed: no.

Would falsify: page JSON changing to encode swapped frame axes or stale built-in frames contradicting modern per-axis state.

### 4. Actual clipping plane logic is Y/Z swapped

Confidence: Low.

Evidence against: runtime MT uniforms were correct for Y and Z. `Y issue 1` normal `[0,1,0]`; `Y issue 2` normals included `[0,1,0]` and `[0,0,1]` distinctly.

Files/functions: clipping/uniform paths in `sceneSectionController.ts`.

Explains symptoms: no under current evidence.

Would falsify: failing runtime with wrong helper and wrong MT uniform normal/position.

### 5. Cached/reused scene helpers survive page switches

Confidence: Low-Medium.

Evidence for: helper systems and transitions reuse/snapshot objects; overlap was observed during transition.

Evidence against: final settled state cleared snapshots and matched target pages.

Files/functions: helper dispose/rebuild in `sceneSectionController.ts`, transition debug in `SceneManager.ts`.

Explains bleed: possibly during transition only. Explains settled wrong Y: no.

Would falsify: object traversal after final commit finding source helpers still present.

## 14. Things Checked and Ruled Out

- Saved-page Y/Z swap: ruled out for current diagnostic pages.
- Saved-page corruption as primary cause: unlikely.
- Actual Y clipping plane swapped to Z: ruled out in current runtime.
- Camera angle as full explanation: ruled out by runtime extents.
- Terrain/map material as axis cause: ruled out as primary.
- Console crash/error: no page errors and no non-GPU warnings captured.
- Late reapply during transition: not observed.
- Page-specific fixture fix: unsupported by evidence and prohibited by repo contract.

## 15. Recommended Tests and Source Guards

1. `tests/tools/scene-section-frame-orientation-source.test.mjs`
   - Type: static guard.
   - Purpose: Y helper orientation must be right-handed.
   - Assertion: helper quaternion basis uses `tangentA x tangentB`, not the raw positive Y basis normal.

2. `tests/tools/scene-section-frame-partition-source.test.mjs`
   - Type: static guard.
   - Purpose: no section-wide snap when only one frame changes.
   - Assertion: compatible frames move; added/removed/incompatible frames dissolve.

3. `tests/tools/scene-section-transition-behavior-source.test.mjs`
   - Type: static guard.
   - Purpose: transition frames update uniforms without helper rebuild churn.
   - Assertion: transition ticks use interpolated section style; final commit applies target state.

4. Suggested `tests/utah-forge/scene-section-y-axis-runtime.spec.ts`
   - Type: runtime integration.
   - Purpose: helper and clipping agreement.
   - Assertion: Y helper has zero Y span and nonzero X/Z span; MT normal is `[0,1,0]`; Z helper has zero Z span.

5. Suggested `tests/tools/scene-section-axis-basis-source.test.mjs`
   - Type: static/unit guard.
   - Purpose: axis basis uniqueness.
   - Assertion: X/Y/Z normals are unique and pairwise orthogonal; Y normal is not Z normal.

6. Suggested `tests/tools/scene-section-frame-basis-consistency.test.mjs`
   - Type: static/unit guard.
   - Purpose: tangent/binormal consistency.
   - Assertion: each helper orientation basis determinant is positive for quaternion use.

7. Suggested `tests/utah-forge/scene-section-transition-final-commit.spec.ts`
   - Type: runtime integration.
   - Purpose: page switch replaces state rather than merging source state.
   - Assertion: after Y1->Y2 final state has X/Y/Z frames only; after Y2->Y1 final state has Y frame only; `helperSnapshot=false` after settle.

8. Suggested `tests/tools/utah-forge-scene-section-page-schema.test.mjs`
   - Type: schema/static guard.
   - Purpose: saved diagnostic page sanity.
   - Assertion: `axis:y` frame uses X/Z; `axis:z` frame uses X/Y; stale built-in frame entries cannot contradict modern per-axis state.

9. Suggested `tests/tools/scene-section-axis-constants-source.test.mjs`
   - Type: static guard.
   - Purpose: prevent mutation of shared axis constants.
   - Assertion: lookup-table `Vector3`, `Quaternion`, `Matrix4`, or `Plane` values are cloned before mutation.

10. Suggested `tests/utah-forge/scene-section-transition-interrupt.spec.ts`
    - Type: runtime integration.
    - Purpose: transition cancellation cleanup.
    - Assertion: repeated interrupted Y1/Y2 switches leave final target-only frames and no source helper snapshot.

## 16. Recommended Implementation Plan

### Immediate Fix Candidate

Promote and verify the current dirty-tree helper orientation correction:

- Keep clipping/shader normals sourced from the true resolved plane normal.
- Use a proper right-handed helper orientation basis for quaternion construction.
- Preserve `orientationNormal = tangentA x tangentB` or equivalent.
- Do not mutate saved pages or page fixtures.
- Confirm source-face orientation still uses source-derived basis and does not reinterpret authored frame bounds.

### Hardening Step

Promote/add guards for:

- Y helper basis determinant positive.
- Y helper frame has zero Y span.
- Y clipping normal remains `[0,1,0]`.
- Z clipping normal remains `[0,0,1]`.
- Transition final commit clears helper snapshots and source helper state.

### Cleanup Step

After runtime confirmation:

- Consolidate duplicated axis/frame composition between effective-state normalization and transition frame signatures.
- Document the difference between true plane normal and helper orientation normal.
- Narrow compatibility shims that let stale `sceneSectionFrames` entries override modern per-axis state.
- Keep transition frame partition in reusable runtime code, not page-specific branches.

### Verification Step

Manual/runtime checks after implementation:

1. Start the app at `http://127.0.0.1:5173/?project=utah-forge`.
2. Open `Y issue 1` and confirm Y is vertical X/Z.
3. Confirm Y helper extents have zero Y span and MT normal `[0,1,0]`.
4. Open `Y issue 2` and confirm X/Y/Z are visually distinct.
5. Confirm runtime spans: X near-zero X span, Y zero Y span, Z zero Z span.
6. Switch Y1->Y2 and Y2->Y1 several times.
7. Confirm overlap only during transition; final target clears source snapshots.
8. Confirm console has no non-GPU warnings/errors.
9. Run:

~~~powershell
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tools/validate-project-pages.mjs
npm run check:workspace
~~~

## 17. Purge/Rebuild Threshold

The section system appears surgically fixable.

Evidence against purge/rebuild:

- Saved pages are coherent.
- Clipping uniforms are coherent.
- Current dirty-tree helper geometry is coherent.
- Transition final commit clears source helper state.
- The likely original bug is localized to helper orientation handedness.

The system is architecturally duplicated but recoverable. Cleanup is warranted around effective frame composition, transition frame signatures, source-face compatibility, and helper versus clipping documentation. This does not meet a rebuild threshold.

## 18. Final Repo State

Final `git status --short` is captured below after this report write. The broad dirty tree was pre-existing. The only persistent file created by this audit is:

~~~text
C:\GeoSee\GeoSee_Dev\Y Axis issue\GEOSEE-Y-AXIS-RUNTIME-AUDIT-20260613-123935-CODEX.md
~~~

Because `Y Axis issue/` was already an untracked folder before the audit, Git reports the folder as `?? "Y Axis issue/"` rather than distinguishing this new report from existing untracked report files.

Final `git status --short` output:

~~~text
 M projects/utah-forge/pages/100_page.json
 M projects/utah-forge/pages/101_page.json
 M projects/utah-forge/pages/104_page.json
 M projects/utah-forge/pages/109_page.json
 M projects/utah-forge/pages/110_page.json
 M projects/utah-forge/pages/115_page.json
 M projects/utah-forge/pages/118_page.json
 M projects/utah-forge/pages/119_page.json
 M projects/utah-forge/pages/121_page.json
 M projects/utah-forge/pages/122_page.json
 M projects/utah-forge/pages/123_page.json
 M projects/utah-forge/pages/138_page.json
 M projects/utah-forge/pages/149_page.json
 M projects/utah-forge/pages/156_page.json
 M projects/utah-forge/pages/166_page.json
 M projects/utah-forge/pages/171_page.json
 M projects/utah-forge/pages/172_page.json
 M projects/utah-forge/pages/173_page.json
 M projects/utah-forge/pages/174_page.json
 M projects/utah-forge/pages/21_geophysics_product_overview.json
 M projects/utah-forge/pages/40_geophysics_product_overview.json
 M projects/utah-forge/pages/41_mt_station_network_footprint.json
 M projects/utah-forge/pages/42_resistivity_volume_overview.json
 M projects/utah-forge/pages/43_resistivity_depth_elevation_slices.json
 M projects/utah-forge/pages/44_resistivity_cross_sections.json
 M projects/utah-forge/pages/45_resistivity_isosurfaces.json
 M projects/utah-forge/pages/47_seismic_footprint_velocity_support.json
 M projects/utah-forge/pages/49_seismic_fence_panels.json
 M projects/utah-forge/pages/99_unresolved_missing_tools.json
 M projects/utah-forge/project.json
 M src/pages/dynamicCameraPose.ts
?? "Y Axis issue/"
?? projects/utah-forge/overlays/178_page/
?? projects/utah-forge/overlays/179_page/
?? projects/utah-forge/overlays/181_page/
?? projects/utah-forge/pages/177_page.json
?? projects/utah-forge/pages/178_page.json
?? projects/utah-forge/pages/179_page.json
?? projects/utah-forge/pages/180_page.json
?? projects/utah-forge/pages/181_page.json
?? tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs
~~~

Final note: the final status no longer lists some modified docs/source files that were present in the initial captured status. No audit command intentionally edited, reverted, formatted, or staged those paths. The only file created by this audit is the Markdown report named above.

---

## Continuation Addendum - 20260613

This addendum was appended after a resumed continuation request to fill process evidence that was summarized too tightly in the original report body. It does not change the diagnosis or recommended plan.

### A. Exact Initial Status Captured At Audit Start

The initial `git status --short` captured before runtime inspection and before report writing was:

~~~text
 M docs/03-decisions.md
 M docs/dev-context/Page-Transitions-And-Section-Frames.md
 M docs/dev-context/Transition-Runtime-Operating-Spec.md
 M projects/utah-forge/pages/100_page.json
 M projects/utah-forge/pages/101_page.json
 M projects/utah-forge/pages/104_page.json
 M projects/utah-forge/pages/109_page.json
 M projects/utah-forge/pages/110_page.json
 M projects/utah-forge/pages/115_page.json
 M projects/utah-forge/pages/118_page.json
 M projects/utah-forge/pages/119_page.json
 M projects/utah-forge/pages/121_page.json
 M projects/utah-forge/pages/122_page.json
 M projects/utah-forge/pages/123_page.json
 M projects/utah-forge/pages/138_page.json
 M projects/utah-forge/pages/149_page.json
 M projects/utah-forge/pages/156_page.json
 M projects/utah-forge/pages/166_page.json
 M projects/utah-forge/pages/171_page.json
 M projects/utah-forge/pages/172_page.json
 M projects/utah-forge/pages/173_page.json
 M projects/utah-forge/pages/174_page.json
 M projects/utah-forge/pages/21_geophysics_product_overview.json
 M projects/utah-forge/pages/40_geophysics_product_overview.json
 M projects/utah-forge/pages/41_mt_station_network_footprint.json
 M projects/utah-forge/pages/42_resistivity_volume_overview.json
 M projects/utah-forge/pages/43_resistivity_depth_elevation_slices.json
 M projects/utah-forge/pages/44_resistivity_cross_sections.json
 M projects/utah-forge/pages/45_resistivity_isosurfaces.json
 M projects/utah-forge/pages/47_seismic_footprint_velocity_support.json
 M projects/utah-forge/pages/49_seismic_fence_panels.json
 M projects/utah-forge/pages/99_unresolved_missing_tools.json
 M projects/utah-forge/project.json
 M src/pages/dynamicCameraPose.ts
 M src/scene/SceneManager.ts
 M src/scene/section/sceneSectionController.ts
 M src/scene/transitions/layerTweenRuntime.ts
 M src/scene/transitions/transitionEffectiveLayersForPage.ts
 M src/scene/transitions/transitionStyles.ts
 M tests/tools/scene-section-transition-behavior-source.test.mjs
?? "Y Axis issue/"
?? projects/utah-forge/overlays/178_page/
?? projects/utah-forge/overlays/179_page/
?? projects/utah-forge/overlays/181_page/
?? projects/utah-forge/pages/177_page.json
?? projects/utah-forge/pages/178_page.json
?? projects/utah-forge/pages/179_page.json
?? projects/utah-forge/pages/180_page.json
?? projects/utah-forge/pages/181_page.json
?? src/scene/transitions/sceneSectionFrameSignature.ts
?? tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs
?? tests/tools/scene-section-frame-orientation-source.test.mjs
?? tests/tools/scene-section-frame-partition-source.test.mjs
~~~

Initial branch was `main`.

Initial recent commits were:

~~~text
035e3a8 Fade section helper disable handoffs through exit snapshots
d547321 Gate matrix capture readiness on canvas and controller
151d629 Gate legend writes, declare discrete channels, clock overlays
5b0abab Author Utah FORGE deck page edits and add pages 168-177
6b00709 Smooth topo public surface transitions
55a0244 Fix high-priority transition runtime handoffs
fa0b0b2 Add agent handoff prompt to transition review report
4a61980 Add quick legend and editor interplay transition findings
~~~

### B. Passed Checks Captured During Audit

~~~text
node tests/tools/scene-section-frame-orientation-source.test.mjs  -> 3/3 pass
node tests/tools/scene-section-frame-partition-source.test.mjs    -> 10/10 pass
node tests/tools/scene-section-transition-behavior-source.test.mjs -> 10/10 pass
node tools/validate-project-pages.mjs                            -> Project page wiring OK
~~~

### C. Runtime Evidence Noted During Continuation Review

The key runtime facts remain:

- `Y issue 1` settled Y frame span was `[128646.531, 0, 78078.852]`, so the helper lay in the X/Z plane with zero Y span.
- `Y issue 1` MT volume normal was `[0,1,0]`, position `10492.84`, frame count `1`.
- `Y issue 2` settled frame spans were X `[1800.569, 65644.006, 32450.863]`, Y `[128646.531, 0, 48516.988]`, Z `[135269.922, 60830.254, 0]`.
- Transition samples in both directions showed `sectionTween=true`, `helperSnapshot=true`, and final target states with `helperSnapshot=false`.

### D. Resumed Current Status

The resumed continuation check observed the current status below. The extra untracked `Transition Architecture/` entry appeared after the original final report status capture; it was not created by the audit report write path.

~~~text
 M projects/utah-forge/pages/100_page.json
 M projects/utah-forge/pages/101_page.json
 M projects/utah-forge/pages/104_page.json
 M projects/utah-forge/pages/109_page.json
 M projects/utah-forge/pages/110_page.json
 M projects/utah-forge/pages/115_page.json
 M projects/utah-forge/pages/118_page.json
 M projects/utah-forge/pages/119_page.json
 M projects/utah-forge/pages/121_page.json
 M projects/utah-forge/pages/122_page.json
 M projects/utah-forge/pages/123_page.json
 M projects/utah-forge/pages/138_page.json
 M projects/utah-forge/pages/149_page.json
 M projects/utah-forge/pages/156_page.json
 M projects/utah-forge/pages/166_page.json
 M projects/utah-forge/pages/171_page.json
 M projects/utah-forge/pages/172_page.json
 M projects/utah-forge/pages/173_page.json
 M projects/utah-forge/pages/174_page.json
 M projects/utah-forge/pages/21_geophysics_product_overview.json
 M projects/utah-forge/pages/40_geophysics_product_overview.json
 M projects/utah-forge/pages/41_mt_station_network_footprint.json
 M projects/utah-forge/pages/42_resistivity_volume_overview.json
 M projects/utah-forge/pages/43_resistivity_depth_elevation_slices.json
 M projects/utah-forge/pages/44_resistivity_cross_sections.json
 M projects/utah-forge/pages/45_resistivity_isosurfaces.json
 M projects/utah-forge/pages/47_seismic_footprint_velocity_support.json
 M projects/utah-forge/pages/49_seismic_fence_panels.json
 M projects/utah-forge/pages/99_unresolved_missing_tools.json
 M projects/utah-forge/project.json
 M src/pages/dynamicCameraPose.ts
?? "Transition Architecture/"
?? "Y Axis issue/"
?? projects/utah-forge/overlays/178_page/
?? projects/utah-forge/overlays/179_page/
?? projects/utah-forge/overlays/181_page/
?? projects/utah-forge/pages/177_page.json
?? projects/utah-forge/pages/178_page.json
?? projects/utah-forge/pages/179_page.json
?? projects/utah-forge/pages/180_page.json
?? projects/utah-forge/pages/181_page.json
?? tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs
~~~

Only the audit report file under `Y Axis issue/` was intentionally created or modified by the audit and this continuation addendum.
