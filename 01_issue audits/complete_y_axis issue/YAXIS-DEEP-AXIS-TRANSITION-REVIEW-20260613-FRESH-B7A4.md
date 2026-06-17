# YAXIS-DEEP-AXIS-TRANSITION-REVIEW-20260613-FRESH-B7A4

Date: 2026-06-13

Scope: Deep static review of GeoSee section-axis base logic, helper/frame construction, transition consumption, and attempted fixes related to the Y-section / section-frame issue.

Status: Static-only. No app run or browser visual inspection was performed. Current status remains `ready for visual check`.

## 1. Executive Finding

The strongest current explanation remains split across two distinct behavior families:

1. Settled-page Y/Z coplanarity is best explained by the original helper-orientation bug: built-in Y creates a left-handed basis, and the old code fed that basis into `Matrix4.makeBasis(...) -> Quaternion.setFromRotationMatrix(...)`. A quaternion cannot represent reflection, so the Y helper group could be placed on the Z/X-Y plane while clipping stayed correct.
2. Page-switch bleed can still be caused by transition behavior, especially helper snapshots and dual-mask source/target style construction. Current per-frame partitioning fixes the old global section snap, but it does not fully clear all transition-semantics risks.

Current working-tree code contains attempted fixes for both:

- DEC-165 helper orientation patch: use `tangentA x tangentB` as the helper orientation third vector.
- DEC-164 per-frame partition patch: move surviving frames and dissolve only changed/added/removed frames.

Static guards pass, but current guards are mostly source-pattern and partition tests. They do not execute the rendered helper geometry math or prove world-space helper bboxes for X/Y/Z.

## 2. Reviewed Files

Core axis/helper/clipping:

- `src/scene/section/sceneSectionController.ts`
- `src/scene/terrainMaterial.ts`
- `src/scene/shaders/sceneSectionObjectVisibilityShader.ts`

Transition runtime:

- `src/scene/transitions/sceneSectionFrameSignature.ts`
- `src/scene/transitions/transitionStyles.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/transitions/layerTweenRuntime.ts`
- `src/scene/transitions/productFamilyRegistry.ts`
- `src/scene/SceneManager.ts`

Effective state and authoring:

- `src/pages/effective.ts`
- `src/pages/types.ts`
- `src/editor/layerControls/seismic/SceneSectionPlanesContainer.tsx`
- `src/scene/environment/applyEnvironment.ts`
- `src/scene/styles/applyLayerStyle.ts`

Seismic/source-face:

- `src/geophysics/seismicSectionGraphBasis.ts`
- `src/scene/styles/seismicBrowserStyle.ts`
- `src/scene/styles/seismicFigureAnnotations.ts`

Repro state:

- `projects/utah-forge/pages/180_page.json`
- `projects/utah-forge/pages/181_page.json`
- `projects/utah-forge/environment.json`
- `projects/utah-forge/project.json`

Prior reports reviewed as non-authoritative artifacts:

- `Y Axis issue/YAX-claude-opus48-20260613-handedness-rootcause.md`
- `Y Axis issue/YAX-claude-opus48-20260613-02-second-audit-inconsistencies.md`
- `Y Axis issue/YAXIS-AUDIT-20260613-8C7F.md`
- `Y Axis issue/y-axis-audit-findings-20260613-112351.md`
- `Y Axis issue/codex-yaxis-deep-patch-audit-20260613-vi-4e2a91.md`
- `Y Axis issue/codex-yaxis-section-logic-audit-20260613-vi-0f6b83.md`
- `Y Axis issue/codex-yaxis-findings-20260613-planmode-8c71f2.md`

## 3. Saved Page Evidence

Effective page summary from current local JSON plus environment layer defaults:

### `180_page` / `Y issue 1`

- Active axis: `y`
- Active frame: `axis:y`
- Enabled planes: Y only
- Target scope: `selected-targets`
- Target layers:
  - `utah-forge-mt-resistivity-volume`
  - `utah-forge-mt-resistivity-slices`
  - `utah-forge-phase3-seismic-browser`
- Target product:
  - `gdr-1141-forge3d-ani-psdm-stack-unenh`
- Per-frame controls visible: X/Y/Z true
- Scale axes visible: X/Y/Z false
- Ground traces visible: X/Y/Z false

Interpretation:

- Active Y plus seismic browser/product targeting makes source-face basis resolution eligible for the Y frame if selected/fallback seismic basis exists.

### `181_page` / `Y issue 2`

- Active axis: `x`
- Active frame: `axis:x`
- Enabled planes: X/Y/Z
- Effective target scope: `all-visible` inherited from environment
- Environment target layers still list MT volume/slices, but `all-visible` makes runtime target visible layers instead.
- Target product defaults include `gdr-1141-forge3d-ani-psdm-stack-unenh`.
- Per-frame controls visible: X/Y/Z true
- Scale axes visible: X/Y/Z false
- Ground traces visible: X/Y/Z false

Interpretation:

- Y is enabled but not active. `sceneSectionSourceFaceFrame(...)` only returns a source-face frame for the active built-in frame or active axis. Therefore Y on page 181 is expected to use the built-in Y basis, while Y on page 180 can use a source-face basis.

## 4. Base Axis Logic

The built-in axis specs define:

- X: normal X, frame A = Y, frame B = Z
- Y: normal Y, frame A = X, frame B = Z
- Z: normal Z, frame A = X, frame B = Y

For UTM/default basis vectors:

- X: `axisA x axisB = +normal`
- Y: `axisA x axisB = -normal`
- Z: `axisA x axisB = +normal`

This is the core inconsistency. Built-in Y is left-handed; X and Z are right-handed.

Important consequences:

- Clipping math can still be correct because it directly uses `plane.normal`, `signedDistanceM`, `axisAVector`, and `axisBVector`.
- Helper geometry can be wrong because it uses a quaternion derived from a basis matrix.
- `Quaternion.setFromRotationMatrix(...)` cannot encode a reflected basis.

Fresh Three.js math check:

- Old raw basis:
  - X local +Z maps to world X.
  - Y local +Z maps to world Z, not world Y.
  - Z local +Z maps to world Z.
- Current cross-product basis:
  - X local +Z maps to world X.
  - Y local +Z maps to world `-Y`.
  - Z local +Z maps to world Z.

For Y, the current fix puts the helper plane back perpendicular to Y. The sign flip to `-Y` is not a plane error. It is acceptable only because the code passes the true `basisNormal` separately to text-facing and ground-trace/ribbon paths, and the push/pull handle is a double-arrow.

## 5. Helper Geometry Consumers

The helper system builds several visual classes:

- outline mesh,
- push/pull cones,
- frame min/max handles,
- main section label,
- scale axes and tick labels,
- optional ground traces,
- optional Section ISO frame intersection traces.

Consumers of `planeQuaternion`:

- `controlGroup.quaternion.copy(planeQuaternion)` places the outline, cones, and pick proxies.
- main label copies `planeQuaternion`.
- scale text uses `planeQuaternion` as base orientation, plus true `basisNormal` for camera-facing correction.

Consumers of world-space vectors instead:

- scale-axis line points are built directly from `planeCenter + tangentA/tangentB`.
- ground traces are built from world-space points and true `basisNormal`.
- intersection traces use plane normals and frame vectors.

Implication:

- A bad helper quaternion can rotate outline/cones/labels while world-space axes or ground traces may remain correct. Mixed correct/incorrect helper parts are therefore possible.

Material side notes:

- outline and text materials are double-sided.
- cone material is front-sided, but cones are used as double-arrow handles. The Y sign flip from the DEC-165 fix should not make the plane coplanar with Z, but a visual check should still confirm cone readability and orientation.

## 6. Clipping And Shader Logic

Shader/material paths reviewed:

- `setSceneSectionUniforms(...)`
- `setSceneSectionObjectVisibilityUniforms(...)`
- terrain material section alpha helpers
- built-in material object-visibility shader patches

Static result:

- No fixed Y/Z uniform slot collision was found.
- Source and target uniforms are separate:
  - source plane normals/positions/invert/frame axes/bounds/opacities,
  - target plane normals/positions/invert/frame axes/bounds/opacities.
- Shader alpha functions use resolved vector data directly and do not consume helper quaternions.

Conclusion:

- Shader/clipping logic is not the best explanation for settled visual Y/Z coplanarity.
- Shader transition masks remain relevant for page-switch bleed if source and target mask contexts are semantically wrong.

## 7. Source-Face Basis Logic

`sceneSectionSourceFaceFrame(...)`:

- normalizes stale built-in active frame IDs to the active axis,
- only applies when `entryId === activeFrameId` or `axis === activeAxis`,
- requires the scene-section target layers to include the seismic browser,
- chooses a selected seismic basis first, then visible/product-target fallback,
- returns `sectionFaceFrameFromGraphBasis(...)`.

`sceneSectionOrthonormalSourceBasis(...)`:

- normalizes source normal,
- projects axis A off the normal,
- reconstructs axis B from `normal x axisA`,
- flips axis A/B if needed to match source axis B direction.

Interpretation:

- Source-face bases are deliberately normalized to a proper basis family.
- Built-in Y remains left-handed in semantic basis terms.
- Page 180 can use source-derived Y; page 181's Y is expected to be built-in because active axis/frame is X.

Risk:

- Transitions can move between a source-derived Y basis and a built-in Y basis. That is a real transition seam even after DEC-165.

## 8. Transition Logic Review

Current transition flow:

1. `transitionEffectiveLayersForPage(...)` computes effective source and target scene-section styles.
2. `sceneSectionTransitionStyleChanged(...)` and `sceneSectionDiscreteStyleChanged(...)` decide whether scene-section state changed.
3. Current DEC-164 code calls `sceneSectionFramePartition(...)`.
4. The tween stores:
   - `movingFrameIds`,
   - `dissolveFrameIds`,
   - `maskMode: "dual-mask"` only if at least one dissolve frame exists.
5. `layerTweenRuntime.tickLayerTweensImpl(...)` applies:
   - `sceneSectionTweenStyle(...)` for transition frames,
   - `sceneSectionMaskTransitionForTween(...)` for dual-mask frames,
   - `applySceneSectionPlanes(..., { transitionFrame: true })` while tweening.
6. `applySceneSectionPlanes(...)` skips helper rebuild during transition frames and rebuilds helpers only during full apply.

For the exact repro pair:

- `180_page -> 181_page`
  - moving: `axis:y`
  - dissolve: `axis:x`, `axis:z`
- `181_page -> 180_page`
  - moving: `axis:y`
  - dissolve: `axis:x`, `axis:z`

Conclusion:

- The old global-discrete snap bug is no longer present in current working-tree logic.
- Transition can still cause visible bleed through helper snapshots and source/target mask semantics.

## 9. Transition Risks Still Present

### 9.1 Helper snapshots preserve whatever the live helper tree contains

`beginSceneSectionHelperTransitionSnapshot(...)` clones `sceneSectionRuntime.group`.

If the live helper tree is wrong at transition start, the snapshot preserves the wrong geometry. That makes transition bleed a downstream symptom of settled helper corruption.

If live helper geometry is correct, remaining helper bleed must be investigated in:

- snapshot opacity timing,
- helper rebuild timing,
- helper opacity based on global discrete changed state.

### 9.2 Helper opacity is still global-discrete, not per-frame

`sceneSectionHelperOpacityForTween(...)` uses:

- `fromActive`,
- `toActive`,
- `tween.discreteChanged`.

It does not use `movingFrameIds` or `dissolveFrameIds`.

This means any discrete scene-section change can fade the entire helper group, even when only X/Z dissolve and Y is supposed to move. That can make a transition visually read as Y bleed/snap even though the mask partition says Y is moving.

### 9.3 Dual-mask source/target styles copy only dissolve-frame-local state

`withDissolveFrameStateFromStyle(...)` copies dissolve frame state:

- `sceneSectionPlanes[axis]`
- `sceneSectionFrameByAxis[axis]`
- `sceneSectionWindowByAxis[axis]`
- `sceneSectionObjectVisibilityByAxis[axis]`
- `sceneSectionObjectVisibilityByFrameId[frameId]`
- explicit `sceneSectionFrames[]` entries for dissolve frames

It does not copy source-side global semantics:

- `sceneSectionTargetScope`,
- `sceneSectionTargetLayerIds`,
- `sceneSectionTargetProductIds`,
- `sceneSectionActiveAxis`,
- `sceneSectionActiveFrameId`,
- `sceneSectionWindowActiveAxis`.

For the repro pages, source and target differ in target semantics:

- page 180: `selected-targets` with explicit seismic browser/product,
- page 181: inherited `all-visible`.

This is a plausible remaining transition-mask bleed owner. The source side of a dual mask may have source dissolve-frame geometry but target/global targeting semantics too early.

### 9.4 Initial dual-mask helper rebuild uses raw interpolation, not the shared tween style

`transitionEffectiveLayersForPage.ts` initial dual-mask call applies:

- `interpolatedSceneSectionStyle(fromStyle, toStyle, 0)`

while the tick path applies:

- `sceneSectionTweenStyle(tween, eased)`

The comment in `sceneSectionController.ts` says `sceneSectionTweenStyle` is shared by tick and dual-mask build. That is not fully true at the initial helper rebuild site.

Impact:

- For the current 180/181 pair, the visible effect is probably limited because invert is false on the moving Y frame.
- For future moving-frame invert cases, the initial helper/full apply can disagree with the tick path.
- This inconsistency should be fixed or explicitly justified before merge.

## 10. Attempted Fix Review

### DEC-165 helper orientation fix

Change:

- Old: `makeBasis(tangentA, tangentB, basisNormal)`
- New: `makeBasis(tangentA, tangentB, orientationNormal)` where `orientationNormal = tangentA x tangentB`

Assessment:

- This directly addresses the high-confidence settled Y helper root cause.
- It does not change clipping normals or frame A/B vectors.
- X and Z remain effectively unchanged.
- Y helper plane becomes correct in plane orientation, but local +Z maps to `-Y`, not `+Y`.

Risks:

- Any future helper consumer that assumes local +Z equals the semantic normal would be wrong for Y.
- Current consumers mostly avoid that assumption by passing `basisNormal` separately or using symmetric double-arrow controls.

Missing guard:

- Existing test is source-pattern based. Add a direct math/runtime helper-bbox test.

### DEC-164 per-frame transition partition fix

Change:

- Old `currentSceneSectionStyle(...)`: returned `toStyle` immediately when `tween.discreteChanged` was true.
- New behavior: interpolates surviving frames and uses dissolve sets only for changed/added/removed frames.
- New `sceneSectionFrameSignature.ts` carries dependency-free partition logic.

Assessment:

- This fixes the old "one frame toggled, whole section snaps" family.
- It correctly classifies the repro pair as Y moving and X/Z dissolving.
- It reduces, but does not eliminate, transition bleed risk.

Risks:

- `frameGeometryIdentity(...)` excludes `invert`. That matches the comments saying flips slide with source invert held, but docs/tests must stay aligned.
- Global target-scope/target-layer/product changes still trigger a global fallback only when no dissolve frames exist. When dissolve frames exist, those global semantics are not copied into source-side dissolve styles.
- Helper opacity remains global-discrete.

Missing guard:

- Add a synthetic fixture where moving Y coexists with X/Z dissolve and source/target target scopes differ. Assert source and target mask contexts preserve intended source/target targeting.

### Source-face stale built-in active-frame mitigation

Current source:

- normalizes stale built-in active frame IDs to the active axis inside `sceneSectionSourceFaceFrame(...)`,
- `normalizeEffectiveSceneSectionStyle(...)` also coerces mismatched built-in active frame IDs.

Assessment:

- This is a good guard against saved `activeFrameId: axis:x` leaking when active axis is Y.
- It is not the settled Y/Z helper coplanarity root if the helper basis remains left-handed.
- It does not guarantee consistent source-face ownership across page transitions.

### Page/repro JSON changes

Current working tree contains many page/project changes and untracked repro pages/overlays.

Assessment:

- These are diagnostic authoring artifacts, not durable runtime fixes.
- They must not be staged with runtime fixes unless explicitly approved as deck-state changes.

## 11. Inconsistencies Found

1. Built-in axis basis handedness is inconsistent.

- X and Z are right-handed.
- Y is left-handed.
- DEC-165 mitigates helper rotation but does not remove the underlying model inconsistency.

2. Built-in basis and source-face basis use different conventions.

- Built-in Y semantic basis is left-handed.
- Source-face basis is normalized into a right-handed basis.
- Page 180 can use source-face Y; page 181's Y is expected to be built-in.

3. Helper transition partition is per-frame, but helper opacity is global.

- Masks know Y is moving and X/Z dissolve.
- Helper group opacity still fades based on global `discreteChanged`.

4. Dual-mask frame-local copy omits global source semantics.

- Dissolve-frame geometry is copied from source/target.
- Target scope/layers/products and active axis/frame are not copied into source-side dual-mask styles.
- This matters for pages with `selected-targets` to `all-visible` transitions.

5. Initial dual-mask apply does not use `sceneSectionTweenStyle(...)`.

- Tick path uses `sceneSectionTweenStyle(...)`.
- Initial dual-mask apply uses `interpolatedSceneSectionStyle(...)`.
- The code comment says shared; source does not fully match that statement.

6. Tests guard source shape more than rendered geometry.

- Existing orientation test locks the intended source pattern.
- No current test constructs helper transforms and asserts world-space helper plane flatness for X/Y/Z.

7. Prior reports disagree on evidence level.

- One report claims live verification of the helper fix.
- Multiple static reports, including this one, did not run the app and must remain `ready for visual check`.
- The VI fork report is about a different checkout and should not be treated as canonical repo evidence.

8. Page artifacts and runtime fixes are mixed in the working tree.

- Repro pages are useful evidence.
- Broad page/project JSON churn should remain separate from source fixes.

## 12. Static Verification Performed

Commands run:

```powershell
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/seismic-section-graph-basis.test.mjs
```

Observed result:

- 32 tests passed.

Additional one-off static checks:

- effective page summary for `180_page` and `181_page`,
- exact repro pair frame partition,
- Three.js basis/quaternion mapping for X/Y/Z old and current helper orientation.

## 13. Findings Ranked By Confidence

### High confidence

The original settled Y/Z visual problem is caused by Y helper orientation using a left-handed basis in the old code.

Evidence:

- Y is the only built-in left-handed basis.
- Old `HEAD` used `makeBasis(tangentA, tangentB, basisNormal)`.
- Three.js math shows old Y local +Z maps to world Z.
- Current DEC-165 patch directly addresses this.

### Medium-high confidence

Transitions can cause or preserve page-switch bleed, but current transition code is not the primary settled-page Y/Z coplanarity owner.

Evidence:

- Transition frames skip helper rebuild.
- Helper snapshots clone current live helper geometry.
- Exact repro pair moves Y and dissolves X/Z.
- Helper opacity remains global-discrete.

### Medium confidence

Source-face versus built-in basis switching can cause page-to-page differences.

Evidence:

- Page 180 active Y with seismic targeting can resolve source-face Y.
- Page 181 enabled Y is not active and should fall back to built-in Y.
- Source-face basis and built-in Y basis use different basis conventions.

### Medium confidence

Dual-mask source/target style construction may still mishandle global target semantics during mixed move/dissolve transitions.

Evidence:

- `withDissolveFrameStateFromStyle(...)` copies frame-local state only.
- Repro pages differ in target scope/layer/product semantics.
- Existing tests do not cover this exact mixed semantic case.

### Low confidence

Shader uniform packing or terrain/render-preset state is the root cause.

Evidence:

- Source/target uniform arrays are separate.
- Clipping consumes true resolved vectors.
- Terrain/render preset state does not define section axis basis.

## 14. Recommendations

1. Keep DEC-165 and DEC-164 conceptually separate.

- DEC-165: settled helper orientation.
- DEC-164: transition move/dissolve ownership.

2. Add a math-level helper orientation test.

The test should instantiate the basis/quaternion path and assert:

- X helper world plane is perpendicular to X.
- Y helper world plane is perpendicular to Y.
- Z helper world plane is perpendicular to Z.
- Y is not flat in Z after helper transform.

3. Add a synthetic mixed transition fixture.

Fixture shape:

- source: active Y, selected seismic target, Y-only enabled,
- target: active X, X/Y/Z enabled, all-visible,
- expected: Y moving, X/Z dissolving, source target semantics preserved for source mask side.

4. Change initial dual-mask apply to use `sceneSectionTweenStyle(tween, 0)` or document why raw interpolation is safe.

This would align code with the current comment and prevent moving-frame invert edge drift.

5. Decide whether helper opacity should become per-frame.

If Y is moving and X/Z dissolve, fading the whole helper group can visually misrepresent Y as bleeding. A per-frame helper opacity model would better match DEC-164.

6. Add default-off runtime readback.

Required fields:

- active axis/frame,
- target scope/layers/products,
- source-face source kind,
- basis determinant,
- semantic normal,
- helper orientation third vector,
- helper local +Z world vector,
- helper bbox size/flat axis,
- live versus snapshot helper ownership,
- source/target mask contexts during transition.

7. Keep page JSON out of runtime fix staging.

Repro pages are evidence only unless a deck-state save is explicitly approved.

8. Run visual QA only after static checks.

Required visual checks:

- settled `Y issue 1`,
- settled `Y issue 2`,
- `Y issue 1 -> Y issue 2`,
- `Y issue 2 -> Y issue 1`,
- helper bbox/readback in settled and transition states.

## 15. Bottom Line

The current working tree likely contains the right first fix for the settled Y helper plane: DEC-165 prevents a left-handed Y basis from reaching Three.js quaternion construction. The transition fix, DEC-164, also addresses a real older failure where a single changed axis snapped the whole section. Neither fully clears all transition risks. The remaining high-value review target is mixed move/dissolve transitions where target scope changes between `selected-targets` and `all-visible`, because the current dual-mask code copies dissolve-frame-local state but not all source-side global targeting semantics.

No implementation source changes were made during this review.
