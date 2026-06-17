# YAXIS-STATIC-AUDIT-20260613-FRESH-9D2B

Date: 2026-06-13

Scope: Fresh static audit of the GeoSee Y-section / section-frame visual issue. No app run, no browser visual inspection, and no source/runtime edits were performed.

Static status: ready for visual check.

## 1. Problem Restatement

GeoSee has a persistent section-axis visual problem exposed by two saved pages:

- `Y issue 1` shows the Y-axis section and its cut frames. The Y frame appears rotated or placed incorrectly, roughly 90 degrees away from the expected real Y section plane.
- `Y issue 2` shows X, Y, and Z axes together: Z in yellow, Y in blue, and X in red. In this view, Y and Z appear visually coplanar even though X, Y, and Z section frames should represent distinct orthogonal planes.
- Switching between the saved pages appears to carry visual state from one page into the next.

The audit goal was to identify why Y section/frame/axis visualization can be wrong at all, without assuming a prior diagnosis and without narrowing the investigation only to transition code.

## 2. Snapshot And Repository Context

Active repo:

- `C:\GeoSee\GeoSee_Dev`

Google Drive snapshot root:

- `https://drive.google.com/drive/folders/1fqqD7GJaWwgtNOKyFDhcI8reTJzN7BZJ`

Drive folder observations:

- Snapshot root listed expected repo folders such as `.git`, `docs`, `projects`, `src`, `tests`, `tools`, and `Y Axis issue`.
- Drive subfolder `Y Axis issue` listed empty through the connector.
- Repro page state was found under Drive snapshot `projects/utah-forge/pages`.
- Drive `projects/utah-forge/pages` contained `180_page.json` and `181_page.json`.
- Drive `projects/utah-forge/project.json` page order places `180_page` before `181_page`.

Local folder observations:

- `C:\GeoSee\GeoSee_Dev\Y Axis issue` already contains several previous audit reports.
- Previous reports were treated only as non-authoritative snapshot artifacts.
- No code, page JSON, or source guard changes were made during this audit.

Existing working-tree context:

- The working tree contains existing modified and untracked files unrelated to this report-writing step.
- Relevant untracked or modified section-axis files already present include:
  - `src/scene/transitions/sceneSectionFrameSignature.ts`
  - `tests/tools/scene-section-frame-orientation-source.test.mjs`
  - `tests/tools/scene-section-frame-partition-source.test.mjs`
  - `tests/tools/scene-section-transition-behavior-source.test.mjs`
  - `src/scene/section/sceneSectionController.ts`
  - `src/scene/transitions/layerTweenRuntime.ts`
  - `src/scene/transitions/transitionEffectiveLayersForPage.ts`
  - `src/scene/transitions/transitionStyles.ts`

## 3. Files And Docs Reviewed

Primary docs:

- `docs/dev-context/Active-Build-Context.md`
- `docs/dev-context/Transition-Runtime-Operating-Spec.md`
- `docs/dev-context/Page-Transitions-And-Section-Frames.md`
- `docs/03-decisions.md`

Saved page and environment state:

- `projects/utah-forge/pages/180_page.json`
- `projects/utah-forge/pages/181_page.json`
- `projects/utah-forge/project.json`
- `projects/utah-forge/environment.json`

Section frame, helper, clipping, and transition source:

- `src/scene/section/sceneSectionController.ts`
- `src/scene/transitions/sceneSectionFrameSignature.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/transitions/layerTweenRuntime.ts`
- `src/scene/transitions/transitionStyles.ts`
- `src/pages/effective.ts`
- `src/pages/types.ts`
- `src/scene/environment/applyEnvironment.ts`
- `src/scene/styles/applyLayerStyle.ts`

Editor/source-face/seismic related source:

- `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx`
- `src/geophysics/seismicSectionGraphBasis.ts`
- `src/scene/styles/seismicBrowserStyle.ts`
- `src/scene/styles/seismicFigureAnnotations.ts`

Relevant tests reviewed or executed:

- `tests/tools/scene-section-frame-orientation-source.test.mjs`
- `tests/tools/scene-section-frame-partition-source.test.mjs`
- `tests/tools/scene-section-transition-behavior-source.test.mjs`
- `tests/tools/seismic-section-graph-basis.test.mjs`

## 4. Relevant Saved Page Evidence

### `Y issue 1` - `projects/utah-forge/pages/180_page.json`

Title:

- `Y issue 1`

Scene section state:

- `sceneSectionEnabled: true`
- `sceneSectionMode: "cutaway"`
- `sceneSectionFrameEnabled: true`
- `sceneSectionActiveAxis: "y"`
- `sceneSectionActiveFrameId: "axis:y"`
- `sceneSectionWindowActiveAxis: "y"`

Enabled planes:

- X plane disabled.
- Y plane enabled.
- Z plane disabled.

Plane positions:

- X: `-53897.008556379355`
- Y: `10492.839725544189`
- Z: `45914.29125976474`

Frame state:

- `axis:x` has cardinal/latlon fields.
- `axis:y` is active and has controls visible.
- `axis:z` has controls visible.

Target state:

- `sceneSectionTargetScope: "selected-targets"`
- `sceneSectionTargetLayerIds` includes:
  - `utah-forge-mt-resistivity-volume`
  - `utah-forge-mt-resistivity-slices`
  - `utah-forge-phase3-seismic-browser`
- `sceneSectionTargetProductIds` includes:
  - `gdr-1141-forge3d-ani-psdm-stack-unenh`

Interpretation:

- This page can activate source-face basis resolution for the Y section because the active frame is Y and selected seismic targets are present.
- The page does not itself encode Y and Z as the same plane. It enables only Y.

### `Y issue 2` - `projects/utah-forge/pages/181_page.json`

Title:

- `Y issue 2`

Scene section state:

- `sceneSectionEnabled: true`
- `sceneSectionMode: "cutaway"`
- `sceneSectionFrameEnabled: true`
- `sceneSectionActiveAxis: "x"`
- `sceneSectionActiveFrameId: "axis:x"`
- `sceneSectionWindowActiveAxis: "x"`

Enabled planes:

- X plane enabled.
- Y plane enabled.
- Z plane enabled.

Plane positions:

- X: `-53897.008556379355`
- Y: `14232.088418787964`
- Z: `45914.29125976474`

Target state:

- No explicit page-local `sceneSectionTargetScope`.
- No explicit page-local `sceneSectionTargetLayerIds`.
- No explicit page-local `sceneSectionTargetProductIds`.
- Effective target state therefore inherits from environment/layer defaults.

Interpretation:

- This page intentionally displays all three built-in section frames.
- Static data does not encode Y/Z coplanarity. X/Y/Z remain distinct axes in page state.
- The visual coplanarity symptom is more likely produced during runtime helper transform construction or transition/snapshot display, not by the saved page JSON.

### Project Page Order

`projects/utah-forge/project.json` places:

- `180_page`
- `181_page`

in adjacent page order. This supports a page-switch repro, but app behavior must not be fixed by targeting those page IDs.

## 5. Static Render-Stack Trace Notes

The user request was static-only, so the following is based on page/source state rather than a running browser readback.

Environment and page state:

- Page scene state is resolved through environment scene, sub-master scene, render preset `scenePatch`, page `sceneOverrides`, and editor/preview patches.
- Section frame state is not primarily stored in `sceneOverrides`; it is held in the scene-section layer override/effective layer style.

Render preset and terrain/material state:

- Pages reference terrain material preset `image:naip-2024-aerial`.
- Referenced ortho imagery path:
  - `projects/utah-forge/data/terrain/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`
- Referenced image bounds:
  - `[229069.2, 4094688, 598806, 4414308]`
- Material edge fade is present in page scene state.
- Edge outline is disabled in page scene state.
- No page-local evidence showed terrain material state rotating or redefining X/Y/Z section bases.

Public clip state:

- No page-local `publicSurfaceClip` fields were identified in the reviewed page scene overrides.
- Effective public clip state would need runtime/effective-environment expansion for a full confirmation.
- Static source review did not connect public surface clipping to section helper orientation.

Shader/material/mesh geometry split:

- Shader clipping consumes resolved section plane normals, signed distances, and frame A/B vectors.
- Helper visuals consume a group transform quaternion plus local helper geometry.
- This split allows a real cut plane to be correct while visual helper ribbons, outlines, labels, cones, or handles appear in the wrong plane.

## 6. Axis And Frame Construction Analysis

### Built-In Axis Definitions

`src/scene/section/sceneSectionController.ts` defines the built-in axes:

- X:
  - normal: `[1, 0, 0]`
  - frame axis A: Y
  - frame axis B: Z
- Y:
  - normal: `[0, 1, 0]`
  - frame axis A: X
  - frame axis B: Z
- Z:
  - normal: `[0, 0, 1]`
  - frame axis A: X
  - frame axis B: Y

The default section basis determinant differs by axis:

- X basis determinant: `+1`
- Y basis determinant: `-1`
- Z basis determinant: `+1`

That makes the default Y basis left-handed while X and Z are right-handed.

### Why This Matters

The helper visual path builds a Three.js transform for frame-local geometry. A quaternion is derived from a basis matrix. A quaternion can represent rotation, but not reflection.

If a left-handed Y basis is passed into `Matrix4.makeBasis(tangentA, tangentB, normal)` and converted into a quaternion, the resulting transform cannot faithfully represent the requested basis. The likely result is a helper group that lands in the wrong world plane.

This explains the observed class of symptoms:

- Y helper/frame appears rotated around 90 degrees from the real Y section.
- Y visual helper can appear coplanar with Z.
- The actual clipping plane can still be correct because shader clipping uses normals/A/B vectors directly rather than the helper group quaternion.

### Current Working-Tree Behavior

Current local source appears to include a helper-orientation change:

- The helper transform derives an orientation normal from `tangentA x tangentB`.
- That produces a right-handed orientation basis for helper geometry.
- The semantic plane normal still remains available for clipping and other direct vector uses.

Static tests also exist to guard this behavior.

Important limitation:

- Current audit did not run the app.
- Current audit did not confirm that browser visuals for `Y issue 1` and `Y issue 2` are corrected.
- Current state is therefore `ready for visual check`, not visually verified.

## 7. Clipping Plane And Helper Visual Agreement

The section runtime has two related but separate paths:

1. Clipping path:
   - Resolves plane normal.
   - Resolves frame axis A/B vectors.
   - Computes signed distances and bounds.
   - Writes section uniforms/material state.

2. Helper visual path:
   - Builds ribbons, outlines, handles, cones, labels, and planar text.
   - Places those helper components under a transformed group.
   - Uses a quaternion derived from a basis matrix.

The highest-confidence bug class is disagreement between those paths:

- Clipping path can remain correct for Y.
- Helper transform can be wrong for Y because the helper quaternion was derived from a left-handed basis.

This would make static readbacks of normals look sane while the visible frame appears wrong.

## 8. Source-Face And Seismic Basis Analysis

`src/geophysics/seismicSectionGraphBasis.ts` builds source-derived section bases for seismic products:

- Sample-plane sections derive axis A/B and normal from graph geometry.
- Trace-path curtain sections derive tangent/up/normal from trace path geometry.

`sceneSectionController.ts` can replace a built-in section frame with a source-face frame when:

- the active frame/axis matches,
- seismic browser layer targets are included,
- a selected or visible seismic mesh has source-face metadata,
- product targeting permits the seismic product.

For the two repro pages:

- `Y issue 1` has active Y and selected seismic targets. Source-face basis can apply.
- `Y issue 2` has active X and no explicit page-local seismic target fields. Built-in fallback basis is more likely for Y unless inherited environment target state and visible seismic products cause otherwise.

This means page switching can also switch the basis source:

- source-derived Y basis on page 180,
- built-in/fallback Y basis on page 181.

Current source-face normalization constructs right-handed bases, so source-face logic is not the leading static explanation for Y/Z visual coplanarity. It remains a medium-confidence contributor for transition/page-switch differences and must be read back during visual QA.

## 9. Saved Page State, Overrides, And Render Presets

Effective style flow:

- Environment layer styles provide base layer style.
- Render preset/contour patches can contribute layer patches.
- Page `layerOverrides` win over environment and preset patch state.
- Page `sceneOverrides` affect scene/camera/environment properties, not the core built-in section axis basis.

Static conclusion:

- The saved pages contain legitimate repro state.
- They do not encode a direct Y/Z plane equivalence.
- They do not appear to misuse terrain/material/render-preset state to rotate Y.
- Fixing page JSON would be a false fix under the disposable page fixture rule.

## 10. Transition And Page-State Carryover Analysis

The repro pages are adjacent in page order, and user-visible bleed appears during switching.

Current transition partition logic classifies the exact page pair as follows:

- `180_page -> 181_page`
  - moving frame: `axis:y`
  - dissolving frames: `axis:x`, `axis:z`
- `181_page -> 180_page`
  - moving frame: `axis:y`
  - dissolving frames: `axis:x`, `axis:z`

This is the intended per-frame shape:

- Y exists on both sides and should move.
- X/Z are added or removed and should dissolve.

Transition risks still worth checking:

- Helper transition snapshots may preserve stale helper geometry during page switch.
- Dual-mask setup may use a different style path than per-tick tween code.
- A source-face Y frame on one page and built-in Y on the next can make the Y frame basis source change during transition.
- During transition frames, helper rebuild is intentionally skipped, so stale helper transform state can remain visible until completion if the snapshot or final rebuild path is wrong.

Transition code is therefore plausible for the bleed symptom, but less likely to explain the settled Y/Z coplanarity symptom by itself.

## 11. Possible Root Causes Ranked By Confidence

### 1. High confidence: left-handed Y helper basis corrupts quaternion helper orientation

Evidence:

- Built-in Y basis determinant is `-1`.
- Built-in X and Z basis determinants are `+1`.
- Helper transform uses quaternion-based orientation.
- Quaternions cannot encode reflection.
- Clipping uses normals/A/B vectors directly and can remain correct.
- The visible symptom is helper/frame specific and Y-specific.
- Current local source appears to contain a targeted helper-orientation fix using `tangentA x tangentB`.

Expected manifestation:

- Y section cut is logically correct.
- Y helper frame, outline, ribbon, label, handle, cone, or planar text appears rotated or coplanar with Z.

### 2. Medium confidence: transition helper snapshot/state bleed

Evidence:

- The repro pages are adjacent.
- User reports bleed during switching.
- Section transition code carries helper snapshots and mask transitions.
- Helper rebuild is skipped during transition frames.
- Exact page pair produces mixed move/dissolve behavior: Y moves while X/Z dissolve.

Expected manifestation:

- Wrong or stale helper visuals during page transition.
- Settled state may correct after transition completion unless the final helper rebuild uses bad orientation or stale basis state.

### 3. Medium confidence: source-face basis source changes between repro pages

Evidence:

- `Y issue 1` targets seismic browser/product state with active Y.
- `Y issue 2` lacks equivalent explicit page-local target fields.
- Source-face frame override can change basis, bounds, normal, and source context for an active frame.

Expected manifestation:

- Y frame basis differs between pages even when axis label remains Y.
- Source-derived basis and built-in basis may transition awkwardly.

### 4. Low-medium confidence: duplicated section state fields preserve stale compatibility state

Evidence:

- Section state exists across `sceneSectionFrames`, `sceneSectionPlanes`, `sceneSectionFrameByAxis`, and `sceneSectionWindowByAxis`.
- Editor code attempts to keep these synchronized.
- Effective-style normalization coerces obvious active-axis/active-frame mismatches.

Static result:

- No direct stale/mismatched Y/Z page encoding was found in the two repro pages.

### 5. Low confidence: render preset, terrain material, page scene override, or section visual styling

Evidence:

- Reviewed page scene state includes terrain imagery and material fields.
- Section basis definitions and helper orientation do not appear to be derived from terrain material state.

Static result:

- These states can affect presentation but do not explain Y/Z coplanarity.

## 12. Recent Fixes Or Patches That Could Be Involved

### Helper orientation patch

Current `sceneSectionController.ts` appears to include a fix that derives helper orientation from:

- `orientationNormal = tangentA x tangentB`

instead of trusting the semantic normal as the third column of the quaternion basis.

This directly addresses the high-confidence Y handedness issue.

### Per-frame section partition patch

Current `sceneSectionFrameSignature.ts` introduces partitioning:

- moving frame IDs,
- dissolving frame IDs,
- frame geometry identity,
- frame discrete signatures.

This addresses a transition class where a section-wide discrete change could snap or dissolve unrelated frames.

### Transition runtime patch area

Relevant runtime code includes:

- `transitionEffectiveLayersForPage.ts`
- `layerTweenRuntime.ts`
- `transitionStyles.ts`

The transition code now distinguishes moving frames from added/removed/changed frames. It remains relevant to page-switch bleed, especially where helper snapshots and dual-mask contexts are used.

### Documentation updates

Current docs include section-frame transition and helper-orientation decisions. Those docs should not be treated as proof of a visual fix. A browser visual check is still required before claiming the saved pages render correctly.

## 13. Verification Performed

Static commands executed:

```powershell
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/seismic-section-graph-basis.test.mjs
```

Result:

- `scene-section-frame-orientation-source`: 3 passing tests.
- `scene-section-frame-partition-source`: 10 passing tests.
- `scene-section-transition-behavior-source`: 10 passing tests.
- `seismic-section-graph-basis`: 9 passing tests.
- Total observed: 32 passing tests.

Additional static calculation:

- Evaluated `180_page` and `181_page` section frame partitioning.
- Confirmed Y is classified as the moving frame and X/Z as dissolving frames in both directions.
- Confirmed default basis determinants: X `+1`, Y `-1`, Z `+1`.

No browser or app verification was performed.

## 14. Recommended Source Guards And Tests

### Add a math-based helper orientation test

Current source tests guard against the intended source pattern. Add a direct Three.js math test that:

- constructs X/Y/Z resolved helper bases,
- applies the quaternion path,
- transforms the helper local normal into world space,
- asserts the resulting helper plane is parallel to the resolved section plane,
- asserts X/Y/Z helper planes are mutually orthogonal where expected.

This should detect a future regression even if source code is rearranged.

### Add synthetic repro fixtures

Create synthetic in-memory styles that mirror the shape of `Y issue 1` and `Y issue 2`:

- Y-only selected-targets page with seismic target product.
- X/Y/Z all-enabled page with inherited target defaults.

These should not depend on live Utah page IDs, page titles, or page order.

### Add a deck-state check for saved repro pages

If useful, add a separate deck-state tool that explicitly verifies:

- `180_page` title is `Y issue 1`.
- `181_page` title is `Y issue 2`.
- `180_page` has only Y plane enabled.
- `181_page` has X/Y/Z planes enabled.

This tool must be named as deck-state verification and kept out of app-health verification.

### Add a transition style-path guard

Guard that transition setup and transition tick logic use the same frame-aware style interpolation path where moving frames are involved.

Specific audit point:

- Initial dual-mask setup currently deserves attention because transition setup and per-tick transition application should not disagree about moving-frame treatment.

### Add runtime section-frame diagnostic readback

Add a default-off, non-overlay diagnostic readback for section frames:

- effective active frame ID,
- active axis,
- target scope,
- target layer IDs,
- target product IDs,
- source-face source kind,
- resolved normal,
- resolved axis A/B,
- determinant,
- helper orientation third vector,
- helper quaternion world normal,
- helper bounding flat axis,
- shader uniform normal/bounds values.

Diagnostics must be toggleable and default off.

## 15. Recommended Implementation Steps

1. Do not edit saved page JSON as the fix.

The pages are valid repro state. Page edits would hide the failure rather than correct the reusable behavior.

2. Treat Y helper basis handedness as the primary fix owner.

The highest-confidence static owner is helper transform construction, not clipping, render presets, terrain material, or page data.

3. Preserve the current `tangentA x tangentB` helper orientation approach if visual QA confirms it.

This keeps helper orientation right-handed while allowing clipping and semantic normal logic to stay unchanged.

4. Strengthen tests with direct geometry assertions.

Source-text guards are useful but not sufficient. Add math-level tests over transformed helper normals and plane orthogonality.

5. Add source-face readback before deeper seismic changes.

If visual QA still shows a Y error, inspect whether `Y issue 1` uses selected seismic source-face basis while `Y issue 2` uses built-in fallback basis.

6. Inspect transition helper snapshots only after settled helper orientation is verified.

If settled `Y issue 2` is correct but page switching still bleeds, focus on:

- helper transition snapshot contents,
- `sceneSectionMaskTransitionForTween`,
- source/target mask contexts,
- moving Y versus dissolving X/Z partitioning,
- helper rebuild timing at transition completion.

7. Keep verification language scoped.

Until a running browser shows both saved pages in the expected orientation, use:

- `static checks pass`
- `ready for visual check`

Do not use:

- `visually fixed`
- `verified fixed`
- `resolved`

## 16. Bottom Line

The strongest static diagnosis is a Y-specific helper orientation bug caused by feeding a left-handed Y basis into a quaternion-based helper transform. X and Z are right-handed by default; Y is not. That can make visual helpers appear rotated or coplanar with Z while the actual clipping plane remains correct.

Transition code remains a credible contributor to page-switch bleed, but static evidence points to helper orientation as the first behavior owner to verify. Source-face basis changes are the next most important factor because `Y issue 1` can use seismic source-face targeting while `Y issue 2` likely uses inherited/default basis state.

No source or page behavior was changed by this audit. The current source appears to contain relevant uncommitted fixes and passing static guards, but the saved pages still require browser visual verification.
