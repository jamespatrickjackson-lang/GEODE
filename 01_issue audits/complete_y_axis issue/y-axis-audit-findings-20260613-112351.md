# Y Axis Audit Findings - 20260613-112351

## Context

This report captures read-only audit findings for the recurring Y section issue. No code, page fixture, project JSON, or overlay files were changed.

Saved repro pages:

- `projects/utah-forge/pages/180_page.json` - `Y issue 1`
- `projects/utah-forge/pages/181_page.json` - `Y issue 2`

The pages are adjacent in `projects/utah-forge/project.json` page order.

## Key Findings

- `Y issue 1` has active frame `axis:y` and active axis `y`.
- `Y issue 2` has active frame `axis:x` and active axis `x`, with X, Y, and Z planes enabled.
- Direct partition readout for `180_page -> 181_page` returns:
  - moving: `axis:y`
  - dissolve: `axis:x`, `axis:z`
- Direct partition readout for `181_page -> 180_page` returns:
  - moving: `axis:y`
  - dissolve: `axis:x`, `axis:z`
- Therefore the current transition classifier expects Y to move, not dissolve, in both directions.
- If Y still appears to bleed, rotate incorrectly, narrow incorrectly, or become co-planar with Z, the likely owner is not the high-level partition result alone.

## Most Likely Audit Targets

1. Settled frame basis and geometry

   Verify `resolveSceneSectionFrames`, `resolveSceneSectionPlanes`, frame center, normal, axis A/B vectors, signed distance, and outline geometry for X/Y/Z on each page before any transition starts.

2. `sceneSectionSourceFaceFrame()`

   This is a high-priority suspect because it can replace active frame basis with selected seismic graph basis. The audit must prove whether active Y on `180_page` is being drawn from seismic source-face geometry instead of the intended built-in Y plane.

3. Helper construction

   Inspect outline, cone, pick proxy, ground trace/ribbon, axis line, and text construction in `src/scene/section/sceneSectionController.ts`, especially the `makeBasis(tangentA, tangentB, normal)` path and local A/B bounds.

4. Shader and uniform packing

   Verify Y and Z do not collide in frame uniforms, normal arrays, target frame bounds, target opacity arrays, or object visibility maps.

5. Transition dual-mask and helper snapshots

   Since `axis:y` is classified as moving while X/Z dissolve, audit whether dissolve-frame source/target styles incorrectly drag Y helper or mask state into the dissolve path.

## Relevant Code Owners

- `src/scene/section/sceneSectionController.ts`
- `src/scene/transitions/sceneSectionFrameSignature.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/transitions/layerTweenRuntime.ts`
- `src/scene/shaders/sceneSectionObjectVisibilityShader.ts`
- `src/scene/SceneManager.ts`
- `src/pages/PageController.tsx`

## Constraints

- Do not fix by editing `projects/*/pages/**`, `projects/*/overlays/**`, `projects/*/project.json`, or `projects/*/environment.json`.
- Do not add runtime branches keyed to page id, page title, page index, page order, or source/target page pair.
- Do not tune transition easing or duration before geometry ownership is understood.
- Do not leave diagnostic overlays active.
- Static checks do not prove visual correctness; browser or human visual inspection is required before claiming fixed.

## Recommended Next Audit Steps

1. Capture render-stack trace for both settled pages:
   - `environment.scene`
   - Sub Master `envSnapshot`
   - render preset `scenePatch`
   - page scene overrides
   - effective `utah-forge-scene-section-planes` style
   - active render preset
   - topo texture URL/cache key
   - bounds
   - public clip state
   - material edge fade state
   - edge outline state
   - materials/shaders
   - mesh geometry

2. In the browser, inspect `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager` on each settled page and log:
   - `getSceneSectionPlaneNormal("x", "axis:x")`
   - `getSceneSectionPlaneNormal("y", "axis:y")`
   - `getSceneSectionPlaneNormal("z", "axis:z")`
   - plane scalar values
   - helper object counts
   - transition debug state

3. Add a temporary read-only diagnostic script or browser console snippet that traverses scene-section helper objects and reports:
   - object name
   - `sceneSectionAxis`
   - `sceneSectionFrameId`
   - world position
   - world quaternion/euler
   - geometry bounding box
   - material depth flags
   - render order

4. Compare settled `180_page` and `181_page` before testing transitions. If settled Y is wrong, fix basis/helper geometry first.

5. Only after settled geometry is proven correct, inspect mid-transition `180_page <-> 181_page`:
   - `sceneSectionStyleTweenActive`
   - `sceneSectionHelperTransitionSnapshotActive`
   - `sceneSectionHelperTransitionOpacity`
   - `movingFrameIds`
   - `dissolveFrameIds`
   - mask mode
   - helper rebuild time/count
   - late reapply events

## Current Recommendation

Do not purge section data yet. The current evidence shows the transition partition already treats Y as the surviving moving frame. The next decisive test is whether the Y frame is geometrically wrong while settled. If yes, focus on frame basis/source-face override/helper construction. If no, focus on dual-mask/helper snapshot ownership during transition.

---

# Second Audit Addendum - 20260613-113242

## Scope And Workspace Caveat

This second audit reviewed current workspace source, docs, saved repro pages, and focused source tests. The workspace already contains other uncommitted section-transition and Y-orientation changes from parallel agent work. Findings below describe the current working tree, not necessarily clean `main`.

No runtime code, page JSON, project JSON, environment JSON, or overlay file was edited by this audit. Only this report was updated.

## Deeper Findings

- The Y helper orientation failure now has a concrete root-cause candidate in current source and docs: the default resolved Y frame basis is left-handed when passed to `Matrix4.makeBasis(tangentA, tangentB, normal)`.
- Computed basis determinants:
  - X: `det(axisA, axisB, normal) = 1`
  - Y: `det(axisA, axisB, normal) = -1`
  - Z: `det(axisA, axisB, normal) = 1`
- For Y, `axisA = X/east`, `axisB = Z/up`, and `normal = Y/north`; therefore `axisA x axisB = -Y`, not `+Y`.
- `Quaternion.setFromRotationMatrix` cannot represent a reflection. Feeding the left-handed Y triple can mangle the helper group quaternion, which matches the observed symptom: Y helper visuals can lie in the X-Y plane, visually coincident with Z and 90 degrees away from the actual Y cut plane.
- The section clip/mask path is separate from helper orientation. Clip planes use the true normal and signed distance directly, so section data can be clipped correctly while outlines, cones, axis visuals, labels, or ground traces are drawn on the wrong plane.
- Current `src/scene/section/sceneSectionController.ts` has a working-tree change that derives `orientationNormal = tangentA x tangentB` before `makeBasis`. That makes the helper orientation basis right-handed for all axes while leaving `tangentA`, `tangentB`, and the true `basisNormal` untouched.
- The current working tree also contains `tests/tools/scene-section-frame-orientation-source.test.mjs`, which explicitly locks the Y handedness trap and the `orientationNormal` source-level fix.
- This points away from section data purge. Persisted page state can be valid while helper visuals are wrong because the bug is in frame helper orientation.

## Saved Page Evidence Rechecked

- Effective shallow merge for `180_page`:
  - `sceneSectionEnabled: true`
  - `sceneSectionTargetScope: selected-targets`
  - target layers include MT volume, MT slices, and seismic browser
  - target product is `gdr-1141-forge3d-ani-psdm-stack-unenh`
  - active axis/frame is `y` / `axis:y`
  - enabled planes: X false, Y true, Z false
- Effective shallow merge for `181_page`:
  - `sceneSectionEnabled: true`
  - `sceneSectionTargetScope: all-visible` inherited from environment
  - target product remains `gdr-1141-forge3d-ani-psdm-stack-unenh`
  - active axis/frame is `x` / `axis:x`
  - enabled planes: X true, Y true, Z true
- `sceneSectionFramePartition(180_page, 181_page)` still returns:
  - moving: `axis:y`
  - dissolve: `axis:x`, `axis:z`
- `sceneSectionFramePartition(181_page, 180_page)` still returns:
  - moving: `axis:y`
  - dissolve: `axis:x`, `axis:z`
- The Y frame missing `minAM` in direct frame object inspection is not by itself corruption. Resolver fallback pulls `sceneSectionWindowByAxis.y.minAlongM`, yielding `-118667.98253963646` for both repro pages.
- The Z frame missing `minBM` in direct frame object inspection falls back to bounds in `resolveSceneSectionFrames`; it is not the primary Y/Z co-planarity signal.

## Source-Path Assessment

- `sceneSectionBasisVectors()` is intentionally asymmetric by default: X and Z are right-handed with raw normal, Y is left-handed with raw normal.
- `sceneSectionOrthonormalSourceBasis()` derives `axisB = normal x axisA`, which is right-handed. That path is safer for source-face geometry, but it should not be used to reinterpret built-in frame extents without care.
- `normalizeEffectiveSceneSectionStyle()` resets a stale built-in active frame id when it conflicts with active axis. That supports the prior memory finding that built-in frame ids are axis-bound identities.
- `sceneSectionSourceFaceFrame()` remains important but is no longer the leading explanation for the exact Y/Z co-planar helper symptom. It can replace the active frame basis when seismic browser is targeted, but the handedness failure explains a built-in Y frame drawing on the Z plane even when the plane normal is correct.
- Shader/object-visibility paths pack frames by active frame order into uniform arrays. The deeper source read did not find an obvious fixed Y/Z slot collision; both source and target frame arrays carry independent axis vectors, bounds, and opacity arrays. A live runtime dump is still required before fully clearing this path.
- Helper construction is the highest-confidence owner for the settled-page visual bug. Transition code remains the owner to inspect for any remaining page-to-page bleed after helper orientation is corrected.

## Verification Evidence

Commands run during the second audit:

```powershell
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scene-section-helper-transition-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/scene-section-object-visibility-source.test.mjs
```

Results:

- Orientation source guard: 3 tests passed.
- Frame partition source guard: 10 tests passed.
- Helper transition source guard: 7 tests passed.
- Scene-section transition behavior source guard: 10 tests passed.
- Scene-section object visibility source guard: 3 tests passed.

These are source/static guards only. They do not prove visual correctness.

## Updated Recommendation

Primary recommendation: keep the current handedness/orientation fix direction and visually verify it before any section data purge. The durable fix should be helper-orientation-level, not page-data-level.

Minimum next verification:

1. Start a scoped dev server.
2. Run `npm run check:visual-qa-clean` before browser inspection.
3. Open settled `180_page` and verify the Y helper outline/cones/axis visuals lie on the actual Y cut plane.
4. Open settled `181_page` and verify X, Y, and Z helper visuals occupy three distinct planes.
5. Switch `180_page <-> 181_page` and verify `axis:y` moves while X/Z dissolve without source-page helper bleed.
6. Inspect `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle().manager.getTransitionDebugState()` mid-transition and confirm `sceneSectionStyleTweenActive`, helper snapshot state, helper opacity, and apply debug state.
7. Run `npm run check:visual-qa-clean` after browser inspection.

Status after this audit: source evidence strongly supports the Y helper handedness bug as the permanent root cause for the settled Y/Z co-planar visual. Visual browser confirmation is still required before claiming the issue fixed.

---

# Third Audit Addendum - 20260613-113938

## Scope

This third audit reviewed the current uncommitted patch stack, neighboring transition code, shader/object-visibility paths, peer reports, and disposable page-state churn. The audit made no runtime fix and did not edit page JSON, project JSON, environment JSON, overlay files, or source files. The only intended file change is this Markdown addendum.

Visual status remains `ready for visual check`. No browser visual inspection was performed in this third audit pass.

## Patch Inventory

- Current working tree inventory from `git status --short`, `git diff --stat`, and `git diff --name-status` shows 40 modified tracked files with 472 insertions and 553 deletions, plus untracked report/repro/source-test files.
- DEC-165 Y helper orientation patch family:
  - `src/scene/section/sceneSectionController.ts`
  - `tests/tools/scene-section-frame-orientation-source.test.mjs`
  - `docs/03-decisions.md`
  - Source change derives `orientationNormal = tangentA x tangentB` before `Matrix4.makeBasis(...)`.
- DEC-164 per-frame transition partition patch family:
  - `src/scene/transitions/sceneSectionFrameSignature.ts`
  - `src/scene/transitions/transitionStyles.ts`
  - `src/scene/transitions/transitionEffectiveLayersForPage.ts`
  - `src/scene/transitions/layerTweenRuntime.ts`
  - `src/scene/SceneManager.ts`
  - `src/scene/section/sceneSectionController.ts`
  - `tests/tools/scene-section-frame-partition-source.test.mjs`
  - `tests/tools/scene-section-transition-behavior-source.test.mjs`
  - Source change moves pure per-frame identity/partition logic out of `transitionStyles.ts`, stores `movingFrameIds` / `dissolveFrameIds` on the tween, and builds the dual-mask from dissolve frames only.
- Camera clamp patch family:
  - `src/pages/dynamicCameraPose.ts`
  - `tests/tools/dynamic-camera-orbit-radius-clamp-source.test.mjs`
  - This is unrelated to the Y helper plane issue and should remain a separate review/commit.
- Docs patch family:
  - `docs/03-decisions.md`
  - `docs/dev-context/Page-Transitions-And-Section-Frames.md`
  - `docs/dev-context/Transition-Runtime-Operating-Spec.md`
  - Docs add DEC-164 and DEC-165 language, but DEC-164 wording needs one consistency pass before merge.
- Repro/report artifacts:
  - `Y Axis issue/`
  - `projects/utah-forge/pages/177_page.json`
  - `projects/utah-forge/pages/178_page.json`
  - `projects/utah-forge/pages/179_page.json`
  - `projects/utah-forge/pages/180_page.json`
  - `projects/utah-forge/pages/181_page.json`
  - `projects/utah-forge/overlays/178_page/`
  - `projects/utah-forge/overlays/179_page/`
  - `projects/utah-forge/overlays/181_page/`
- Disposable page-state edits:
  - Many existing `projects/utah-forge/pages/*.json` files changed outside the Y repro pages.
  - `projects/utah-forge/project.json` changed page order and modified timestamp.

## Likely Bugs

- The highest-confidence settled-page bug remains the helper orientation handedness failure. The default Y basis is left-handed for `makeBasis(tangentA, tangentB, normal)`, while X and Z are right-handed. This explains Y helper visuals lying on the same plane as Z without requiring corrupt authored section data.
- `sceneSectionBasisVectors()` remains a latent consistency issue. Default Y basis is left-handed, while `sceneSectionOrthonormalSourceBasis()` produces a right-handed source-face basis. The current safe repair is the local helper-orientation fix, not a default-basis sign migration that would reinterpret Y B-extents.
- A transition semantic gap remains plausible after the settled Y helper fix. `withDissolveFrameStateFromStyle()` copies frame-local dissolve state only: planes, frame-by-axis, window-by-axis, object visibility by axis/frame, and explicit frame entries. It does not copy source-side non-frame section semantics such as `sceneSectionTargetScope`, target layer/product ids, active axis, active frame id, or window active axis. During a dual-mask transition, the source mask can therefore inherit interpolated or target-level semantics too early unless runtime evidence proves otherwise.
- `sceneSectionSourceFaceFrame()` is still a high-risk seam. Page 180 is active Y with selected seismic targets; page 181 is active X with all-visible target semantics. That can switch Y between source-face basis and built-in basis across the repro pair. The handedness fix explains the co-planar settled visual, but a live dump is still needed to prove source-face ownership during transition.
- The DEC-164 partition implementation intentionally excludes `invert` from moving-frame geometry identity and holds moving-frame invert to source until commit. Some docs still describe `flip` as part of a discrete identity that dissolves. That mismatch is a documentation/source inconsistency and a review risk.

## Inconsistencies

- `docs/03-decisions.md` DEC-164 says the discrete identity includes flip and that identity-changed frames cross-dissolve. `src/scene/transitions/sceneSectionFrameSignature.ts` then defines `frameGeometryIdentity()` without `invert` and comments that flips still slide. Either behavior may be valid, but the docs and source comments must describe the same contract before merge.
- `YAX-claude-opus48-20260613-handedness-rootcause.md` reports live browser verification and says the helper bbox changed from flat-in-Z to flat-in-Y. `YAXIS-AUDIT-20260613-8C7F.md` reports no browser visual inspection and marks the state `ready for visual check`. This report did not reproduce the live visual check; the live-verified claim remains peer-report evidence, not evidence from this audit pass.
- `codex-yaxis-findings-20260613-planmode-8c71f2.md` audited `C:\GeoSee\Side projects\GeoSee_Dev_VI`, not the canonical `C:\GeoSee\GeoSee_Dev` checkout. It is useful only as a broad owner list and should not be treated as evidence for the current Utah FORGE saved pages.
- The requested repro pages are untracked and the project page order is modified to include them. That is acceptable as coordination evidence, but it is not app-behavior proof under the page-to-page false-fix ban.

## Contamination

- Broad page JSON churn is the main contamination risk. The diff removes or changes page-local state for MT full-density opacity/legend fields, MT threshold surfaces, site boundary, topo graticule, hydrography/roads opacity, terrain opacity, demo borehole block/labels, and seismic navigation on many pages unrelated to the Y pair.
- `projects/utah-forge/pages/149_page.json` changed title text to `Loook here`. This is presentation/editor state noise and not relevant to the Y root cause.
- `projects/utah-forge/pages/173_page.json` and `174_page.json` contain substantial section/visibility changes, including active axis/frame, enabled planes, section ISO, threshold-surface visibility, and default visible layers. These should not be mixed with reusable runtime fixes unless separately approved as authored deck work.
- `projects/utah-forge/project.json` moved `47_seismic_footprint_velocity_support`, appended pages `177_page` through `181_page`, and changed the `modified` timestamp. That supports reproduction coordination only and must not be staged as part of a source fix without explicit approval.
- Git reported LF-to-CRLF warnings for many Utah page files, `projects/utah-forge/project.json`, and `src/scene/transitions/transitionStyles.ts`. A commit should avoid accidental line-ending churn, especially for disposable page fixtures.
- New repro pages and overlays are useful diagnostic fixtures but remain page-state artifacts. They must not become the durable fix or the evidence for page-agnostic app behavior.

## Cleared Paths

- Static source review did not find an obvious fixed Y/Z shader uniform slot collision. `sceneSectionObjectVisibilityShader.ts` packs source frames and target frames into separate axis, bounds, and opacity uniform arrays; target arrays are named independently (`targetFrameAxisA`, `targetFrameAxisB`, `targetFrameBounds`, `targetFrameOpacity`).
- Plane clipping remains separated from helper visual orientation. Clip and mask paths use resolved plane normals and signed distances; the handedness failure affects quaternion construction for helper visuals, not the plane equation itself.
- `transitionEffectiveLayersForPage.ts` now computes a per-frame partition, and the current repro-pair partition from earlier report evidence treats `axis:y` as moving while `axis:x` and `axis:z` dissolve. That clears the old section-wide snap as the only explanation, but it does not clear the non-frame semantic gap.
- Camera orbit clamping is unrelated to Y/Z co-planarity. It should not be used as part of the Y-axis diagnosis or merged with Y-axis runtime changes.

## Recommended Merge Hygiene

- Keep DEC-165 separate from DEC-164 during review. Both touch `sceneSectionController.ts`, but they solve different failures: settled helper orientation versus transition move/dissolve ownership.
- Mergeable DEC-165 scope should be only:
  - `src/scene/section/sceneSectionController.ts`
  - `tests/tools/scene-section-frame-orientation-source.test.mjs`
  - the DEC-165 docs entry after wording review
- Mergeable DEC-164 scope should be only:
  - `src/scene/transitions/sceneSectionFrameSignature.ts`
  - `src/scene/transitions/transitionStyles.ts`
  - `src/scene/transitions/transitionEffectiveLayersForPage.ts`
  - `src/scene/transitions/layerTweenRuntime.ts`
  - `src/scene/SceneManager.ts`
  - `src/scene/section/sceneSectionController.ts`
  - relevant source guards and docs after the invert/flip contract is reconciled
- Do not stage broad `projects/utah-forge/pages/**`, `projects/utah-forge/overlays/**`, or `projects/utah-forge/project.json` changes with the source fix unless the user separately approves a deck-state save.
- Before claiming a runtime fix, capture a live render-stack trace for settled `Y issue 1` and `Y issue 2`: `environment.scene`, Sub Master `envSnapshot`, render preset `scenePatch`, page `sceneOverrides`, effective section layer style, topo texture URL/cache key, bounds, public clip state, material edge fade, edge outline, active render preset, shader/material, and mesh geometry.
- Add a default-off runtime frame debug dump or browser console snippet to record frame id, axis, source-face use, normal, axis A/B, raw determinant, orientation normal, helper bbox, thin axis, material depth flags, and render order.
- After settled Y geometry is visually confirmed, add or run a synthetic transition test for the non-frame semantic gap: moving Y plus added X/Z plus target-scope/target-layer changes. Do not use live page ids, page titles, page order, or Utah page filenames for app-behavior proof.
- Final status should remain `ready for visual check` until a fresh browser or human visual inspection confirms the running scene.

---

# Fourth Deep-Dive Addendum - 20260613-114818

## Scope

This addendum traced additional code paths that could affect the Y section visuals, with special attention to uncommitted patches, outline thickness, cone handles, ground-trace ribbon construction, shader uniforms, source-face basis replacement, helper snapshots, and editor write paths.

No runtime source fix was made. No page JSON, project JSON, environment JSON, overlay file, or source file was changed by this audit. Only this Markdown report was updated.

Visual status remains `ready for visual check`.

## Patch Causality

- Current source diffs in the inspected Y-related runtime are limited to:
  - `src/scene/section/sceneSectionController.ts`
  - `src/scene/transitions/layerTweenRuntime.ts`
  - `src/scene/transitions/transitionEffectiveLayersForPage.ts`
  - `src/scene/transitions/transitionStyles.ts`
  - untracked `src/scene/transitions/sceneSectionFrameSignature.ts`
- `src/scene/shaders/sceneSectionObjectVisibilityShader.ts`, `src/ui/SceneSectionLegend.tsx`, `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx`, and `src/scene/isoOverlays/volumeCutIsoOverlays.ts` are not currently modified in the working tree.
- The DEC-165 helper-orientation patch does not appear to cause the settled Y/Z co-planarity issue. It addresses the high-confidence cause by preventing the left-handed Y basis from reaching `Quaternion.setFromRotationMatrix`.
- The DEC-164 transition patch can still affect transition bleed, because transition frames skip helper rebuilds and rely on dual-mask state plus helper snapshots. That patch is not the likely owner of a settled-page Y frame that is already on the wrong plane.
- Broad page JSON churn remains contamination. It should not be staged with any runtime fix or used as durable proof of behavior.

## Ribbon And Outline Construction

- There are two separate visual families that can be mistaken for "ribbon" behavior:
  - the frame outline, which is a thick local A/B rectangle mesh built by `buildSceneSectionOutlineGeometry(...)`;
  - the ground trace, which is a dashed world-space ribbon mesh built by `buildSceneSectionDashedTraceRibbonGeometry(...)`.
- Frame outline geometry is flat in local A/B with local Z = 0. It creates an outer rectangle and inner rectangle, then indexes four rectangular strips. The outline is then added to `controlGroup`, and `controlGroup.quaternion.copy(planeQuaternion)` orients the entire outline. Therefore outline plane correctness depends directly on the `planeQuaternion` handedness fix.
- Outline thickness is computed from `referenceOutlineWidthM`, which is derived from scene bounds `size.y` and `size.z`, then clamped by `outlineWidthScale`, `outlineMinWidthM`, and `outlineMaxWidthM`. Inside `buildSceneSectionOutlineGeometry`, `halfStroke` is capped at 24 percent of span A and span B. This can make outlines look too thick or narrow on unusual extents, but it does not rotate Y into the Z plane.
- Push/pull and frame handles are `THREE.ConeGeometry` meshes inside local double-arrow groups, and those groups are children of `controlGroup`. They inherit the same `planeQuaternion` as the outline. Invisible `THREE.BoxGeometry` pick proxies are also children, with opacity 0, depth test off, and pick metadata only. Pick proxies are not a visible co-planarity cause.
- The main section label copies `planeQuaternion`; scale text uses `makeSceneSectionPlanarTextCameraAware(...)` with `planeQuaternion` plus true `basisNormal`. Any bad helper quaternion can rotate labels even when text-facing uses the true normal.
- Scale axes are different: their line vertices are built directly in world space from `planeCenter + tangentA/tangentB`. A bad Y `planeQuaternion` can make outline/cones/labels disagree with world-space axes. On saved pages 180 and 181, `axesVisible` is false for all three frames, so this mixed-path disagreement is not visible unless live state differs from disk.

## Ground-Trace Ribbon Findings

- Saved repro pages `180_page` and `181_page` set `groundTraceVisible: false` and `axesVisible: false` for X, Y, and Z in both explicit `sceneSectionFrames` and `sceneSectionFrameByAxis`.
- `projects/utah-forge/environment.json` has section ground trace defaults enabled, but the saved repro pages override those defaults to false per frame. Therefore the dashed ground-trace ribbon is not expected to render on the saved issue pages.
- The ground trace is only built for non-Z planes: `if (frame && frame.groundTraceVisible && plane.axis !== "z")`.
- Ground trace points are world-space. For each sample, the code walks along `tangentA`, keeps the plane's X/Y crossing, samples terrain Z with `siteGuideSurfaceZ(...)`, and pushes a world `Vector3(x, y, z)`.
- The dashed ribbon width vector is computed as `direction x planeNormal`, then multiplied by half width. It does not use `planeQuaternion` and is not a child of `controlGroup`.
- For built-in Y, a flat along-A direction gives `+X x +Y = +Z`; with terrain slope, the ribbon width remains inside the Y section plane. This is geometrically consistent for a vertical X/Z section trace.
- Because the ground trace uses the true `basisNormal`, it can remain in the correct plane even when the outline/cones are wrong. If the user sees a "frame part" that is correct while the rectangle/cones are 90 degrees off, this mixed local-vs-world construction explains the disagreement.
- The asynchronous height sampler can add a delayed ground-trace mesh to a helper snapshot through `addSceneSectionHelperObjectToTransitionSnapshot(...)`. That can contribute to transition bleed if ground trace is live, but the saved pages do not request ground traces.

## Other Section Paths Checked

- Section ISO frame intersection traces use `n1 x n2` from resolved plane normals, then draw dashed `THREE.Line` segments. These are world-space lines, not ground-trace ribbons, and they only appear when Section ISO is enabled and frame intersections exist.
- Clip planes and frame clipping planes use true resolved normals and signed distances. They are handedness-agnostic and remain separate from helper orientation.
- `sceneSectionObjectVisibilityShader.ts` packs source and target plane/frame arrays separately. Static review still found no fixed Y/Z uniform slot collision. Browser runtime uniform dumps are still required before fully clearing this path.
- `sceneSectionSourceFaceFrame()` can replace the active frame with selected/fallback seismic graph basis when the seismic browser layer is targeted. Page 180 is active Y with selected seismic targets; page 181 is active X and inherits broader target semantics. This remains a legitimate transition-seam risk, but source-face bases are orthonormalized before helper geometry.
- Editor quick legend and seismic section panel paths write frame fields (`groundTraceVisible`, `groundTraceWidthM`, `axesVisible`, `controlsVisible`, active axis/frame id) but do not write normals or basis vectors. They are not direct owners of Y/Z co-planarity.
- MT volume cut ISO ground trimming also keys off `frame.groundTraceVisible`; it is not active on saved pages 180/181 unless live state differs.

## Remaining High-Risk Owners

1. Settled helper orientation remains the primary owner of Y/Z co-planarity.
   - Outline, cones, pick proxy, and main label inherit `planeQuaternion`.
   - The current DEC-165 patch gives `makeBasis(tangentA, tangentB, tangentA x tangentB)`, which is proper for X, Y, and Z.

2. Transition helper snapshots remain the primary owner of bleed after settled geometry is correct.
   - `beginSceneSectionHelperTransitionSnapshot(...)` clones the existing helper group.
   - `tickLayerTweensImpl(...)` applies transition frames with `transitionFrame: true`, which skips helper rebuilds until final/full apply.
   - Any bad settled helper present before transition can be faithfully cloned into the outgoing snapshot.

3. Non-frame section semantics remain an unresolved DEC-164 edge.
   - `withDissolveFrameStateFromStyle(...)` copies dissolve-frame-local plane/frame/window/object-visibility state, but not source `sceneSectionTargetScope`, target layer ids, target product ids, active axis, active frame id, or window active axis.
   - If source and target differ in target scope while X/Z dissolve and Y moves, the source side of the dual mask may still use interpolated/target semantics too early. That can explain bleed, but not settled Y/Z co-planarity.

4. Outline thickness can mislead visual diagnosis but is not a plane-rotation root cause.
   - Missing direct `minAM`/`minBM` in saved Y/Z frame objects falls through resolver fallbacks. It should still be logged in runtime because unusual spans can affect perceived outline width.

## Additional Peer Report Reconciliation

- A new shared-folder report, `codex-yaxis-deep-patch-audit-20260613-vi-4e2a91.md`, audits `C:\GeoSee\Side projects\GeoSee_Dev_VI`, not the canonical `C:\GeoSee\GeoSee_Dev` checkout.
- That VI report found the old `makeBasis(tangentA, tangentB, basisNormal)` pattern still present in the VI fork. This is consistent with the root-cause theory, but it is not current evidence for the canonical repo because the canonical repo now contains the DEC-165 `orientationNormal` patch.
- The VI report usefully emphasizes the mixed helper construction: outline/cones/labels inherit quaternion-local orientation, while scale axes and ground traces can be world-space. That is now reflected in this canonical report.

## Recommended Next Checks

- Browser-settled check for pages 180 and 181 should inspect helper child classes separately:
  - outline meshes;
  - cone visual groups;
  - pick proxies;
  - main labels;
  - scale axes;
  - ground traces;
  - Section ISO frame intersection traces.
- For every helper object, record object name, `sceneSectionAxis`, `sceneSectionFrameId`, parent path, world bbox size, thinnest world axis, world quaternion, geometry local bbox, material depth flags, render order, and whether it is in live runtime or transition snapshot.
- For ground-trace/ribbon specifically, record point count, first/last points, width vector sample, width in metres, `planeNormal`, and whether it came from live group or delayed snapshot.
- If settled outline/cones are correct but transition still bleeds, next source guard should target the non-frame semantic gap in dual-mask style construction with a synthetic in-memory fixture. Do not use live Utah page ids or page order.
- If a live saved page still shows a ground trace despite saved `groundTraceVisible: false`, inspect effective style merge and live editor state before changing runtime code.

---

# Fifth Inconsistency Audit Addendum - 20260613-115740

## Scope

This addendum records inconsistencies of any type that could cause, amplify, mask, or misdiagnose the recurring Y section issue. The review stayed report-only.

No runtime source fix, page fixture edit, project JSON edit, environment JSON edit, or overlay edit was made. Only this Markdown report was updated.

Visual status remains `ready for visual check`.

## High-Impact Inconsistencies

1. Built-in basis handedness is inconsistent across axes.

   - `sceneSectionBasisVectors("x")`: `axisA x axisB = +normal`.
   - `sceneSectionBasisVectors("y")`: `axisA x axisB = -normal`.
   - `sceneSectionBasisVectors("z")`: `axisA x axisB = +normal`.
   - Any consumer that treats `(axisA, axisB, normal)` as a proper rotation behaves differently for Y than X/Z.
   - Current dirty source mitigates the helper quaternion consumer by deriving `orientationNormal = tangentA x tangentB` before `Matrix4.makeBasis(...)`.
   - The latent inconsistency remains in the data model, because changing Y `axisB` directly would reinterpret authored B extents.

2. Source-face basis and built-in basis use different conventions.

   - Built-in Y is left-handed.
   - `sceneSectionOrthonormalSourceBasis()` reconstructs source-face bases with `axisB = normal x axisA`, producing a right-handed basis.
   - Page `180_page` targets the seismic browser and selected seismic product, so active Y can be source-face driven.
   - Page `181_page` inherits broader environment target state and active X, so Y can fall back to the built-in basis.
   - A transition can therefore move Y between two basis families unless runtime evidence proves the same source-face ownership on both settled pages and during the tween.

3. Helper visuals use mixed coordinate ownership.

   - Outline, cone handles, pick proxies, and the main label are local helper children under `controlGroup`, and depend on `planeQuaternion`.
   - Scale axes, frame intersection traces, Section ISO trace lines, and ground trace ribbons are built in world space from resolved vectors/normals.
   - This split can make some Y visual parts appear correct while other parts are 90 degrees off.
   - Therefore a single screenshot of "the frame" is not precise enough; outline, cones, labels, scale axes, ground traces, and Section ISO traces must be inspected separately.

4. DEC-165 wording overstates ground-trace involvement.

   - Current `docs/03-decisions.md` and the source comment say the "entire Y frame helper group" including ground trace dropped into the wrong plane.
   - Implementation shows dashed ground trace is world-space and uses `direction x planeNormal`, not `planeQuaternion`.
   - That wording is materially misleading. It is accurate for outline/cones/main label, but not for the dashed ground-trace ribbon.
   - Review should correct the wording before merge so future audits do not chase the wrong ribbon owner.

5. Raw saved page state and effective runtime state differ.

   - `181_page.json` does not directly author `sceneSectionTargetScope`, target layer ids, or target product ids.
   - `projects/utah-forge/environment.json` provides `sceneSectionTargetScope: "all-visible"` and section defaults.
   - The effective runtime page can therefore differ from direct page JSON inspection.
   - Any claim about page 181 target scope must specify whether it is raw page override state or effective merged style.

6. Page-level ground-trace defaults conflict with repro-page overrides.

   - Environment defaults set `sceneSectionGroundTraceVisible: true` and `sceneSectionAxesVisible: true`.
   - Saved pages 180 and 181 set per-frame `groundTraceVisible: false` and `axesVisible: false` for X/Y/Z.
   - If a live browser shows ground trace or scale axes on these pages, the visible state is not explained by the saved page files alone.
   - The next target would be effective-style merge, live editor cache, transition snapshot residue, or unsaved browser state.

7. Explicit frame entries and legacy per-axis fields duplicate the same state.

   - The resolver merges `sceneSectionFrames[]`, `sceneSectionPlanes`, and `sceneSectionFrameByAxis`.
   - Page 180/181 store both explicit built-in entries and per-axis maps.
   - Some direct frame values are missing (`axis:y` missing `minAM`; `axis:z` missing `minBM`) and are filled by resolver fallback.
   - This is not proof of corrupt saved data, but it can make manual JSON readouts disagree with resolved runtime geometry.

8. Source-face activation guard is broader than "only exact active frame".

   - `sceneSectionSourceFaceFrame()` returns null only when both `entryId !== activeFrameId` and `axis !== activeAxis`.
   - That means any frame sharing the active axis can pass the source-face gate, even when its id is not the active frame id.
   - Built-in-only pages are not the most dangerous case, but custom/stale same-axis entries could inherit a selected seismic source face unexpectedly.
   - A source guard should assert source-face ownership by exact frame id unless same-axis sharing is an intentional contract.

9. Live editor apply and effective page apply have different normalization paths.

   - `normalizeEffectiveSceneSectionStyle()` fixes mismatched built-in active frame id versus active axis and merges built-in explicit frame planes from per-axis planes.
   - `SceneManager.applyStyle()` stores and applies the raw style directly for `utah-forge-scene-section-planes`.
   - `SceneSectionPlanesContainer` and linked seismic preset paths can call `applyStyle(...)` directly with merged live style.
   - A live preview may therefore see raw state before effective normalization would clean it on page load.
   - `sceneSectionSourceFaceFrame()` locally normalizes stale built-in active ids, so this is partly mitigated, but not globally cleared.

10. Seismic preset patches can retarget section state outside the section editor.

   - `SeismicCapabilityLayerContainers` can apply linked style patches that set section enabled, active Y, active frame id, target scope, target layers, and product ids.
   - `SectionGraphOptionsControls` can also apply linked layer patches.
   - These paths do not directly write basis vectors, but they can change which basis family is used by source-face selection.
   - During a page transition or live edit, such a patch could alter active axis/targeting without updating every corresponding per-axis frame/window field.

## Transition Inconsistencies

1. Discrete-signature docs and partition behavior still require wording cleanup.

   - DEC-164 prose says per-frame discrete identity includes flip.
   - `sceneSectionFrameSignature.ts` records `invert` in the full signature but deliberately excludes it from `frameGeometryIdentity(...)`.
   - The implemented rule is "flips slide with source kept-side until commit", not "flips dissolve".
   - This may be correct behavior, but docs and source comments must use the same contract before merge.

2. Global section discretes and per-frame dual-mask reconstruction are not fully aligned.

   - `sceneSectionDiscreteSignature(...)` includes target scope, target layer ids, target product ids, active/window fields, and frame signature.
   - `withDissolveFrameStateFromStyle(...)` copies dissolve-frame-local planes, frames, windows, object visibility, and explicit frame entries.
   - It does not copy source-side `sceneSectionTargetScope`, target layer ids, target product ids, active axis, active frame id, or window active axis into the source-side dual-mask style.
   - If those non-frame fields affect source visibility during `180_page <-> 181_page`, the source mask can inherit interpolated or target semantics too early.
   - This remains a plausible transition bleed owner after settled helper geometry is fixed.

3. Helper opacity and helper snapshots remain section-wide while frame partition is per-frame.

   - `sceneSectionFramePartition(...)` is per-frame.
   - `sceneSectionHelperOpacityForTween(...)` still fades helpers based on global `tween.discreteChanged`.
   - `beginSceneSectionHelperTransitionSnapshot(...)` clones the entire existing helper runtime group.
   - When only X/Z dissolve and Y moves, Y helper opacity can still participate in a section-wide helper fade unless runtime behavior proves otherwise.
   - This can make the visual transition look like Y bleeds even when the clip partition says Y is moving.

4. Transition-frame updates skip helper rebuilds.

   - `tickLayerTweensImpl(...)` applies section transition frames with `transitionFrame: true`.
   - Existing helper objects and snapshots can persist until final/full apply.
   - If settled helper orientation is wrong at transition start, the snapshot will preserve the wrong helper.
   - If settled helper orientation is correct but transition still bleeds, the next owner is dual-mask/source-target semantics, not the DEC-165 quaternion fix.

5. Shader uniform packing is positional, not id-carrying.

   - Static review did not find a fixed Y/Z uniform slot collision.
   - Source and target planes/frames are packed into separate positional arrays.
   - The shader does not carry frame ids, so live diagnostics must log source and target frame order beside uniforms during `180_page <-> 181_page`.
   - This path is inspected but not fully cleared without a browser runtime uniform dump.

## Ribbon, Edge, And Cone Inconsistencies

1. The word "ribbon" can refer to two different implementations.

   - Frame outline: local flat ring from `buildSceneSectionOutlineGeometry(...)`, oriented by `planeQuaternion`.
   - Ground trace: dashed world-space ribbon from `buildSceneSectionDashedTraceRibbonGeometry(...)`, widened by `direction x planeNormal`.
   - A report or screenshot must state which one is being inspected.

2. Outline thickness can distort perceived width but cannot rotate a plane.

   - Outline stroke derives from scene visual settings and clamps to 24 percent of local A/B span.
   - Missing or fallback-resolved frame extents can make Y look unusually narrow or thick.
   - That can amplify the "cut frame" symptom, but it does not explain Y/Z co-planarity by itself.

3. Cone visuals and pick proxies are separate.

   - Visible push/pull handles use `THREE.ConeGeometry` under the quaternion-owned control group.
   - Pick proxies use invisible `THREE.BoxGeometry`.
   - A visible cone-plane mismatch points back to `planeQuaternion`.
   - Pick proxy geometry is a drag/interaction risk, not a direct visible co-planarity cause.

4. Main label and scale text have different dependencies.

   - Main label position/orientation uses `planeQuaternion` and camera-aware facing with `basisNormal`.
   - Scale axes and scale labels use world-space axis vectors plus camera-aware text helpers.
   - A bad helper quaternion can therefore affect one text family differently from another.

## Cross-Report Inconsistencies

- Reports with `GeoSee_Dev_VI` in the header audit `C:\GeoSee\Side projects\GeoSee_Dev_VI`, not the canonical `C:\GeoSee\GeoSee_Dev` checkout. They support theory but are not current canonical evidence.
- `YAX-claude-opus48-20260613-handedness-rootcause.md` records live verification, while this report remains static source and repository evidence only.
- `YAXIS-AUDIT-20260613-8C7F.md` and VI reports sometimes describe ground trace as part of the quaternion-dropped helper group. Current canonical source shows the dashed ground trace ribbon is world-space. Treat those statements as imprecise unless they refer to outline/cones/labels instead.
- The shared report folder now mixes canonical and VI-fork audits. Any merge decision must check the report header path before adopting a claim.

## Working-Tree Contamination Inconsistencies

- Broad `projects/utah-forge/pages/**` diffs and `project.json` changes remain unrelated deck-state contamination for this runtime root-cause task.
- New repro pages and overlays are useful as manual evidence, but not durable app-behavior proof.
- LF-to-CRLF warnings are present across many page JSONs and `transitionStyles.ts`. Avoid mixing formatting churn with runtime changes.
- `src/pages/dynamicCameraPose.ts` is a camera clamp patch family, not a Y section patch family.
- DEC-164 and DEC-165 both touch `sceneSectionController.ts`, but they solve different failures. Merging them as one undifferentiated patch will make regression ownership harder.

## Recommended Clearance Order

1. Fix wording first: ground-trace ribbon is not a quaternion-owned child, while outline/cones/main label are.
2. Runtime-dump settled pages before transition testing:
   - effective style after environment/page merge;
   - active axis and frame id;
   - target scope/layer/product ids;
   - source-face use per frame;
   - resolved frame basis determinant;
   - orientation basis determinant;
   - helper object parent path and world bbox.
3. Confirm saved-state versus live-state mismatch if ground traces or scale axes are visible.
4. Only after settled helpers are visually correct, inspect transition dual-mask state:
   - `movingFrameIds`;
   - `dissolveFrameIds`;
   - source and target frame order;
   - source and target target-scope fields;
   - helper snapshot child list;
   - helper opacity.
5. Keep synthetic tests page-agnostic. Do not use live Utah page ids, titles, filenames, or page order as app-behavior proof.

---

# Sixth Full-Coverage Reconciliation Addendum - 20260613-121630

## Scope

This addendum reconciles newer reports that appeared in `C:\GeoSee\GeoSee_Dev\Y Axis issue` after the fifth addendum. It records additional inconsistencies, bugs, adjacent issues, unrelated contamination, and verification gaps found by this report pass and peer reports.

No source, test, page, project-order, overlay, environment, or runtime file was changed by this addendum. Only this Markdown report was updated.

## Newly Reconciled Peer Reports

- `YAXIS-FULL-AUDIT-20260613-CODEX-RUNTIME-5F9A.md`
- `YAXIS-DEEP-AXIS-TRANSITION-REVIEW-20260613-FRESH-B7A4.md`
- `YAXIS-STATIC-AUDIT-20260613-FRESH-9D2B-FULL.md`
- `YAXIS-STATIC-AUDIT-20260613-FRESH-9D2B-RECOMMENDATIONS.md`

These reports strengthen the overall evidence set. They also introduce live-runtime findings that this report did not independently reproduce in-browser during earlier static passes.

## Additional High-Priority Issues

1. Settled helper orientation may now be patched in the current local runtime, but the semantic Y basis remains left-handed.

   - Peer runtime report says settled pages 180 and 181 showed Y helper control transforms with determinant `+1`.
   - That means the local dirty runtime likely had the DEC-165 helper-orientation patch active for settled helper controls.
   - It does not remove the base inconsistency: built-in Y still has `axisA x axisB = -normal`.
   - If a browser still shows settled Y on the wrong plane, the next suspect becomes loaded-code drift, stale dev-server bundle, browser cache, Drive/local mismatch, or a second Y-related visual path outside the classified helper group.

2. Transition 180 -> 181 is a mixed section-wide semantic transition, not just a moving Y frame.

   Peer runtime readback reports:

   - active axis changes `y -> x`;
   - active frame changes `axis:y -> axis:x`;
   - window active axis changes `y -> x`;
   - target scope changes `selected-targets -> all-visible`;
   - target layer ids change from MT + seismic to broader/inherited target semantics;
   - active planes change from Y-only to X/Y/Z;
   - partition still reports moving `axis:y`, dissolve `axis:x` and `axis:z`.

   Because X/Z are already dissolve frames, the current non-frame semantic fallback does not dissolve every active frame. This is now a stronger candidate for the reported "1 bleeds into 2" transition behavior.

3. Helper visuals and data clipping can diverge during transition.

   Peer runtime readback reports that during transition:

   - Y data plane/frame continued interpolating;
   - helper snapshot stayed active;
   - helper opacity ramped;
   - visible Y helper controls remained source-positioned until settled rebuild.

   This directly explains a transition where the cut/mask and frame helper appear to disagree even if the settled helper orientation is correct.

4. Initial dual-mask apply is inconsistent with per-tick tween style.

   - `transitionEffectiveLayersForPage.ts` initial dual-mask setup applies `interpolatedSceneSectionStyle(fromStyle, toStyle, 0)`.
   - Tick path applies `sceneSectionTweenStyle(tween, eased)`.
   - `sceneSectionTweenStyle(...)` also holds moving-frame invert on the source kept-side.
   - For pages 180/181, all involved `invert` values appear false, so this is probably not the immediate symptom owner.
   - For future moving-frame flip cases, initial apply and tick path can disagree.
   - Either align initial dual-mask setup to `sceneSectionTweenStyle(tween, 0)` or document why raw interpolation is safe.

5. Helper opacity is still section-wide/global-discrete, not per-frame.

   - `sceneSectionFramePartition(...)` is per-frame.
   - `sceneSectionHelperOpacityForTween(...)` keys off `fromActive`, `toActive`, and global `tween.discreteChanged`.
   - It does not use `movingFrameIds` or `dissolveFrameIds`.
   - If Y moves while X/Z dissolve, fading the whole helper group can make Y visually read as bleeding or snapping even when the mask partition says Y is moving.
   - A per-frame helper-opacity model may be needed if visual QA proves the source-positioned helper is unacceptable during mixed move/dissolve transitions.

## Additional State-Model And Editor Issues

1. Legacy window state is not symmetric across X/Y/Z.

   - `sceneSectionWindowActiveAxis` and legacy window fields are X/Y-oriented.
   - Frame state is now X/Y/Z.
   - Z can participate in modern frame state without equivalent legacy window active-axis semantics.
   - This is adjacent to the Y/Z issue because page 181 enables X/Y/Z and uses inherited/default section state.

2. Active axis, active frame id, window active axis, and frame-by-axis can diverge.

   - Normalization corrects some stale built-in active frame id cases.
   - It does not fully normalize target scope, target ids, window active axis, or all legacy frame/window state.
   - Editor writes and linked seismic presets can update only a subset of related fields.

3. Section state can be mutated outside the section editor.

   - Seismic capability presets and graph options can write linked style patches into the scene-section layer.
   - These patches can force active Y, selected targets, layer ids, product ids, and frame/window state without a direct section-editor operation.
   - This is a valid authoring mechanism, but it is also a contamination vector when debugging page-to-page section behavior.

4. Built-in frame editor writes are partial by design.

   - Section editor paths update planes, frame entries, active frame, frame-by-axis, and some legacy X/Y state.
   - They do not rewrite every related target/window/semantic field.
   - This can leave internally consistent-enough runtime state that still differs from what a manual JSON audit expects.

## Additional Runtime/Visual Candidates

1. A second Y-related visual path may exist outside the corrected helper group.

   - If runtime readback says the helper group is corrected but the screen still shows a wrong Y visual, inspect Section ISO traces, cut overlays, stale snapshot children, old helper objects, and other scene-section-adjacent meshes.

2. Section ISO overlays remain adjacent risk.

   - They are driven by active section planes/frames and transition state.
   - If their source/target mask semantics differ from the main scene-section masks, they can look like Y bleed.
   - They should be inspected after settled helper orientation and mixed transition mask semantics are confirmed.

3. Dynamic camera pose changes are unrelated to root math but can alter visual interpretation.

   - `src/pages/dynamicCameraPose.ts` is dirty in the working tree.
   - Camera clamp/orbit changes can make separate planes look narrow, aligned, or misleading in screenshots.
   - This patch family must stay separate from Y section runtime fixes.

4. Terrain/material state is low-confidence for root cause but must remain in render-stack trace.

   - Peer runtime trace reports NAIP terrain texture, public surface clip, edge fade, and mesh geometry.
   - That state does not explain Y handedness or transition partition.
   - It can affect perception, so it remains required context but not the leading owner.

## Additional Snapshot And Environment Drift

- Drive snapshot and local dirty runtime are not equivalent evidence sources.
- Peer report says the Drive root behaves like a repo snapshot containing `src`, `projects`, `docs`, `dist`, `.git`, and pages 180/181.
- Peer report also says the Drive `Y Axis issue` folder appeared empty through the connector, while the local folder contains many reports.
- Therefore reports must specify whether evidence came from local dirty runtime, local static source, local saved pages, or Drive snapshot.
- Browser cache and loaded bundle provenance remain open. If current screen still shows the old settled Y problem, verify the browser is running the dirty local source that contains DEC-165.

## Consolidated All-Issues Inventory

Confirmed or high-confidence:

- Built-in Y basis is left-handed while X/Z are right-handed.
- Helper quaternion consumers require a proper/right-handed basis.
- Current dirty source contains a likely settled-helper orientation fix.
- Transition 180 -> 181 mixes moving Y with dissolving X/Z and section-wide semantic changes.
- Helper rebuild is skipped during transition frames.
- Helper visuals and data clipping can diverge mid-transition.
- Dual-mask dissolve-frame state copy omits source-side global section semantics.
- Helper opacity is global-discrete while frame partition is per-frame.
- Initial dual-mask setup and tick path use different style functions.
- Raw page override and effective runtime style differ because page 181 inherits section target scope.
- Ground-trace ribbon is world-space and should not be grouped with quaternion-owned outline/cones.
- Environment default ground traces/axes are true while repro pages set per-frame flags false.
- Explicit frame entries and legacy per-axis maps duplicate section state.
- Source-face basis is right-handed while built-in Y is left-handed.
- Active axis/frame/window fields can diverge under partial writes.
- Linked seismic presets can mutate scene-section state indirectly.
- Dirty page JSON, overlays, project order, and line endings are contamination.
- Drive snapshot and local runtime can differ.
- Browser cache/dev-server bundle drift can explain disagreement between reports and current screen.

Plausible but not fully proven:

- A second visual path draws Y-related geometry outside the corrected helper group.
- Section ISO overlays carry different source/target semantics than scene-section masks.
- Ribbon/edge/cone child paths still encode local-axis assumptions not covered by the root helper orientation patch.
- Dynamic camera pose changes amplify perceived coplanarity/narrowness.
- Shader positional uniform packing could be wrong only if runtime frame order diverges from expected order; static review found no fixed Y/Z slot collision.

Low-confidence or cleared as primary cause:

- Terrain texture/material/edge fade/public surface clip does not explain Y basis handedness.
- Page data purge is not the first remedy.
- Editing pages 180/181 or project page order is not a durable fix.
- Camera clamp is not a Y-section root fix.

## Updated Recommendation

- Treat the shared folder as a complete multi-agent report set, but treat `y-axis-audit-findings-20260613-112351.md` as this agent's consolidated report.
- Before any fix claim, run a fresh local browser visual and runtime readback on:
  - settled `Y issue 1`;
  - settled `Y issue 2`;
  - transition `180_page -> 181_page`;
  - transition `181_page -> 180_page`.
- Required transition readback:
  - active axis/frame/window axis;
  - target scope/layer/product ids;
  - source-face source kind;
  - resolved basis determinant;
  - helper orientation determinant;
  - helper bbox flat axis;
  - live versus snapshot helper ownership;
  - source and target mask contexts;
  - Y data plane center versus Y helper control center.
- Do not stage page JSON/project/overlay churn with runtime fixes.
- Keep DEC-165 settled helper orientation separate from DEC-164 transition partition and from any future per-frame helper-opacity or dual-mask semantic fix.

---

# Seventh Late Issue-Register Reconciliation - 20260613-121816

## Scope

This addendum reconciles a later peer issue register that appeared after the sixth addendum:

- `YAXIS-DEEP-AXIS-TRANSITION-ISSUES-REGISTER-20260613-B7A4.md`

No source, test, page, project-order, overlay, environment, or runtime file was changed by this addendum. Only this Markdown report was updated.

## Additional Issues From The Late Register

1. DEC-165 makes the Y helper plane proper, but local +Z maps to semantic `-Y`.

   - Current helper orientation uses `orientationNormal = tangentA x tangentB`.
   - For built-in Y, this is the correct proper-basis repair for helper plane orientation.
   - It also means helper local +Z does not equal the semantic section normal for Y; it points to the opposite side.
   - Current consumers are mostly safe because they pass the true `basisNormal` separately or use symmetric handle geometry.
   - Future helper code must not assume helper local +Z is the semantic normal unless it explicitly handles Y.

2. Transition render graph diagnostics are too broad to catch per-axis plane faults.

   - Existing transition diagnostics report broad derived entities such as scene-section helpers and scene-section frames.
   - They can show active/inactive ownership, snapshot state, and transition routing.
   - They do not directly prove that `axis:y` helper geometry is physically in the Y plane.
   - Add per-axis helper readback if this class remains regression-prone.

3. Source-face selected/fallback selection depends on runtime object state.

   - Static page JSON can show target scope, target product ids, and active axis.
   - It cannot prove which seismic graph object is visible, selected for face, or chosen as fallback at runtime.
   - Page switch visibility/product changes can alter source-face resolution without changing the raw page section frame values.
   - Runtime readback should report source-face source kind per frame: selected, fallback, built-in, or none.

4. Existing helper orientation tests are source-pattern guards, not rendered geometry guards.

   - `tests/tools/scene-section-frame-orientation-source.test.mjs` confirms the source uses `tangentA x tangentB`.
   - It does not instantiate the helper geometry and assert world-space bbox flat axis.
   - Add a math-level or runtime-seam helper orientation test that proves X, Y, and Z helpers are flat in the correct world axis after transform.

5. Existing transition tests do not assert helper snapshot contents.

   - Current source tests cover partitioning and broad transition behavior.
   - They do not prove helper snapshots contain the intended per-axis helper objects or exclude stale helpers.
   - Page-switch bleed can regress if snapshot contents are wrong while source-pattern tests still pass.
   - A future guard should inspect snapshot child metadata or add a default-off runtime readback for snapshot/live helper ownership.

## Final Coverage Statement

After this reconciliation, this report explicitly includes:

- direct Y helper orientation issues;
- transition move/dissolve and helper snapshot issues;
- source-face and seismic basis risks;
- saved-page and authoring-state contamination;
- test and guard gaps;
- documentation and evidence-level inconsistencies;
- adjacent and unrelated observations such as line endings, Drive/local drift, VI-fork report scope, dynamic camera dirt, page JSON churn, project-order changes, and overlay artifacts.

Visual status remains `ready for visual check`.
