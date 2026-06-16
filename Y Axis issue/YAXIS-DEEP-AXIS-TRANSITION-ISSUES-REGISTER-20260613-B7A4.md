# YAXIS-DEEP-AXIS-TRANSITION-ISSUES-REGISTER-20260613-B7A4

Date: 2026-06-13

Scope: Consolidated issues, inconsistencies, adjacent risks, and unrelated-but-observed concerns from the deep static review of GeoSee section-axis and transition logic.

Status: Static-only. No app run or browser visual inspection was performed. Current status remains `ready for visual check`.

## A. Direct Y-Axis / Section-Frame Issues

### A1. Built-in Y basis is left-handed while X/Z are right-handed

Severity: High

Files:

- `src/scene/section/sceneSectionController.ts`

Finding:

- X basis: `axisA x axisB = +normal`
- Y basis: `axisA x axisB = -normal`
- Z basis: `axisA x axisB = +normal`

Impact:

- A helper transform derived from `(axisA, axisB, normal)` is valid for X/Z but invalid for Y.
- The old helper quaternion path could place the Y helper visual on the Z/X-Y plane.

Status:

- Current working tree appears to contain the DEC-165 mitigation: helper orientation uses `tangentA x tangentB`.
- The underlying semantic inconsistency remains in the axis model.

### A2. Old helper quaternion path could not represent Y reflection

Severity: High

Files:

- `src/scene/section/sceneSectionController.ts`

Finding:

- Old `HEAD` used `Matrix4.makeBasis(tangentA, tangentB, basisNormal)` and `Quaternion.setFromRotationMatrix(...)`.
- For Y, that basis determinant is `-1`.
- A quaternion cannot encode reflection.

Impact:

- Helper outlines, handles, cones, and labels could render on the wrong plane.
- Clipping could still be correct, causing visible disagreement between cut and helper frame.

Status:

- Current working tree appears to fix this with `orientationNormal = tangentA x tangentB`.

### A3. Current DEC-165 fix flips Y helper local +Z to `-Y`, not `+Y`

Severity: Medium

Files:

- `src/scene/section/sceneSectionController.ts`

Finding:

- Current helper orientation makes the Y helper plane correct, but local +Z maps to semantic `-Y`.

Impact:

- Plane placement should be correct.
- Future helper code that assumes local +Z equals semantic normal would break for Y.

Status:

- Current visible consumers mostly avoid that assumption by passing true `basisNormal` separately or using symmetric double-arrow controls.

### A4. Helper components use mixed coordinate strategies

Severity: Medium

Files:

- `src/scene/section/sceneSectionController.ts`

Finding:

- Outline, cones, pick proxies, and labels depend on `planeQuaternion`.
- Scale-axis lines and ground traces are built from world-space `tangentA`/`tangentB` and true `basisNormal`.

Impact:

- Some helper parts can look correct while others are rotated.
- This can make visual diagnosis confusing.

Status:

- Expected side effect of the split helper architecture.

## B. Transition Issues And Risks

### B1. Helper snapshots preserve bad live helper state

Severity: High for bleed, medium for root cause

Files:

- `src/scene/SceneManager.ts`
- `src/scene/transitions/layerTweenRuntime.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`

Finding:

- `beginSceneSectionHelperTransitionSnapshot(...)` clones the current `sceneSectionRuntime.group`.

Impact:

- If settled helper geometry is wrong before transition, transition faithfully preserves the wrong helper in the outgoing snapshot.
- Transition can appear to be the cause even when it is only preserving a settled-state bug.

Status:

- Important diagnostic distinction: verify settled helper geometry before debugging transition bleed.

### B2. Helper opacity remains global-discrete instead of per-frame

Severity: Medium-high

Files:

- `src/scene/section/sceneSectionController.ts`

Finding:

- `sceneSectionHelperOpacityForTween(...)` reacts to global `tween.discreteChanged`.
- It does not use `movingFrameIds` or `dissolveFrameIds`.

Impact:

- Exact repro pages classify Y as moving and X/Z as dissolving.
- Helper opacity can still fade the whole helper group, making moving Y appear to bleed or snap.

Status:

- Current DEC-164 partition fixed mask ownership, but helper opacity has not been made per-frame.

### B3. Dual-mask source/target style copy omits global source semantics

Severity: Medium-high

Files:

- `src/scene/section/sceneSectionController.ts`

Finding:

`withDissolveFrameStateFromStyle(...)` copies dissolve-frame-local state:

- `sceneSectionPlanes`
- `sceneSectionFrameByAxis`
- `sceneSectionWindowByAxis`
- `sceneSectionObjectVisibilityByAxis`
- `sceneSectionObjectVisibilityByFrameId`
- explicit `sceneSectionFrames[]`

It does not copy source-side global semantics:

- `sceneSectionTargetScope`
- `sceneSectionTargetLayerIds`
- `sceneSectionTargetProductIds`
- `sceneSectionActiveAxis`
- `sceneSectionActiveFrameId`
- `sceneSectionWindowActiveAxis`

Impact:

- `Y issue 1` uses `selected-targets` with explicit seismic browser/product targeting.
- `Y issue 2` inherits `all-visible`.
- Source-side dual-mask state may carry source dissolve-frame geometry while using target/global targeting semantics too early.

Status:

- Plausible remaining page-switch bleed owner.

### B4. Initial dual-mask apply does not use `sceneSectionTweenStyle(...)`

Severity: Medium

Files:

- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/section/sceneSectionController.ts`

Finding:

- Tick path uses `sceneSectionTweenStyle(tween, eased)`.
- Initial dual-mask apply uses `interpolatedSceneSectionStyle(fromStyle, toStyle, 0)`.
- Source comment says tick and dual-mask share `sceneSectionTweenStyle(...)`.

Impact:

- For current pages, likely low effect because moving Y invert is false.
- For moving-frame invert cases, initial apply and tick path can disagree.

Status:

- Code/comment inconsistency and future edge risk.

### B5. Transition render graph diagnostics are broad, not per-axis

Severity: Medium

Files:

- `src/scene/transitions/transitionEffectiveLayersForPage.ts`
- `src/scene/transitions/productFamilyRegistry.ts`

Finding:

- Diagnostics represent `scene-section-helpers` and `scene-section-frames` as broad derived entities.
- Per-axis helper identity and physical world plane are not represented.

Impact:

- Diagnostics can prove active/inactive ownership but not catch "Y helper rendered on Z plane."

Status:

- Add per-axis helper readback if this class remains regression-prone.

## C. Source-Face / Seismic Basis Issues And Risks

### C1. Source-face basis and built-in basis use different conventions

Severity: Medium-high

Files:

- `src/scene/section/sceneSectionController.ts`
- `src/geophysics/seismicSectionGraphBasis.ts`

Finding:

- Built-in Y basis is left-handed.
- `sceneSectionOrthonormalSourceBasis(...)` reconstructs source-face bases into a proper basis family.

Impact:

- Page 180 can use source-face Y.
- Page 181 Y likely uses built-in Y because active frame is X.
- Page switching can move between basis families.

Status:

- Needs runtime readback before changing seismic/source-face logic.

### C2. Source-face eligibility differs between repro pages

Severity: Medium

Files:

- `projects/utah-forge/pages/180_page.json`
- `projects/utah-forge/pages/181_page.json`
- `src/scene/section/sceneSectionController.ts`

Finding:

- `Y issue 1`: active Y plus selected seismic target.
- `Y issue 2`: active X; Y enabled but not active.

Impact:

- The two pages can exercise different Y basis ownership even though both display or involve Y.

Status:

- Add diagnostic readback for source-face source kind per frame.

### C3. Source-face selected/fallback search depends on runtime object state

Severity: Medium

Files:

- `src/scene/section/sceneSectionController.ts`
- `src/scene/styles/seismicBrowserStyle.ts`

Finding:

- Source-face basis selection depends on visible/selected seismic objects and product targets.

Impact:

- Static page JSON alone cannot prove which seismic basis is active at runtime.
- Page-switch state or visibility changes can affect source-face frame resolution.

Status:

- Runtime readback required.

## D. Saved Page / Authoring State Issues

### D1. Repro pages are untracked page artifacts

Severity: Medium for workflow hygiene

Files:

- `projects/utah-forge/pages/180_page.json`
- `projects/utah-forge/pages/181_page.json`
- `projects/utah-forge/project.json`
- `projects/utah-forge/overlays/181_page/`

Finding:

- Repro pages and overlays exist as local untracked/generated artifacts.
- Project page order is modified to include them.

Impact:

- Useful diagnostic evidence.
- Must not be staged with source fixes unless explicitly approved as deck-state work.

Status:

- Keep separate from runtime fix commits.

### D2. Broad page JSON churn exists in working tree

Severity: Medium for commit safety

Files:

- many `projects/utah-forge/pages/*.json`
- `projects/utah-forge/project.json`

Finding:

- Working tree contains many page JSON modifications unrelated to the static source review.

Impact:

- High risk of mixing disposable authoring state into source/runtime commits.

Status:

- Stage exact source/test/report paths only when committing.

### D3. `Y issue 1` and `Y issue 2` do not directly encode Y/Z coplanarity

Severity: Low as bug source, high as diagnosis fact

Files:

- `projects/utah-forge/pages/180_page.json`
- `projects/utah-forge/pages/181_page.json`

Finding:

- Page 180 enables only Y.
- Page 181 enables X/Y/Z.
- Plane states remain axis-distinct.

Impact:

- Page JSON is not the fix owner.

Status:

- Treat pages as repro evidence only.

## E. Test / Guard Issues

### E1. Existing helper orientation guard is source-pattern based

Severity: Medium

Files:

- `tests/tools/scene-section-frame-orientation-source.test.mjs`

Finding:

- Test confirms source uses `tangentA x tangentB`.
- It does not instantiate helper geometry or verify world-space plane flatness.

Impact:

- Refactors could satisfy or evade regex-style checks without proving rendered behavior.

Status:

- Add math-level helper orientation test.

### E2. Transition tests do not cover mixed target-scope semantics

Severity: Medium

Files:

- `tests/tools/scene-section-frame-partition-source.test.mjs`
- `tests/tools/scene-section-transition-behavior-source.test.mjs`

Finding:

- Tests cover per-frame partition and general dual-mask wiring.
- They do not cover source `selected-targets` to target `all-visible` with moving Y and dissolving X/Z.

Impact:

- The exact repro transition seam is under-guarded.

Status:

- Add synthetic fixture; do not use live page IDs.

### E3. Tests do not assert helper snapshot contents

Severity: Medium

Files:

- `src/scene/SceneManager.ts`
- `tests/tools/*`

Finding:

- No current static guard proves helper snapshots preserve intended per-axis content or exclude stale helpers.

Impact:

- Page-switch bleed can regress without source tests catching it.

Status:

- Add runtime readback or focused unit seam where practical.

## F. Documentation / Evidence Inconsistencies

### F1. Prior reports differ on verification level

Severity: Medium

Files:

- `Y Axis issue/YAX-claude-opus48-20260613-handedness-rootcause.md`
- `Y Axis issue/YAXIS-AUDIT-20260613-8C7F.md`
- `Y Axis issue/YAXIS-STATIC-AUDIT-20260613-FRESH-9D2B-FULL.md`

Finding:

- One report claims live verification.
- Static reports, including the fresh and deep reviews, did not run the app.

Impact:

- Evidence level must stay explicit.

Status:

- Current status remains `ready for visual check`.

### F2. Code comment says tick and dual-mask share `sceneSectionTweenStyle(...)`, but initial apply does not

Severity: Medium

Files:

- `src/scene/section/sceneSectionController.ts`
- `src/scene/transitions/transitionEffectiveLayersForPage.ts`

Finding:

- Comment and implementation are not fully aligned.

Impact:

- Reviewers may believe moving-frame invert handling is consistently applied at all dual-mask setup points when it is not.

Status:

- Align code or comment.

### F3. DEC-164 and DEC-165 are easy to conflate

Severity: Low-medium

Files:

- `docs/03-decisions.md`
- `src/scene/section/sceneSectionController.ts`

Finding:

- Both patches touch section controller behavior.
- They fix different bug classes:
  - DEC-164: transition move/dissolve ownership.
  - DEC-165: settled helper orientation.

Impact:

- Regression ownership becomes unclear if merged or reviewed as one change.

Status:

- Keep tests, commits, and verification notes separate.

## G. Adjacent / Unrelated Observations

### G1. Line-ending warnings are present

Severity: Low-medium

Files:

- `src/scene/transitions/transitionStyles.ts`
- many Utah page JSON files

Finding:

- Git emitted LF-to-CRLF warnings for `transitionStyles.ts` and several page files.

Impact:

- Commit diffs can pick up formatting churn unrelated to runtime fixes.

Status:

- Avoid broad formatting/staging.

### G2. Drive `Y Axis issue` folder listed empty

Severity: Low

Location:

- Google Drive snapshot folder `Y Axis issue`

Finding:

- Connector listed the Drive subfolder as empty.
- Repro state was found in Drive `projects/utah-forge/pages` instead.

Impact:

- Snapshot folder organization may be misleading.

Status:

- Local `Y Axis issue` now contains report artifacts.

### G3. Prior VI fork report is not canonical repo evidence

Severity: Low-medium

Files:

- `Y Axis issue/codex-yaxis-deep-patch-audit-20260613-vi-4e2a91.md`

Finding:

- That report discusses the Offshore VI fork, not necessarily the canonical `C:\GeoSee\GeoSee_Dev` state.

Impact:

- Useful pattern evidence, but not proof of current canonical source behavior.

Status:

- Do not mix fork-specific conclusions into canonical implementation without rechecking active repo.

## H. Verification Snapshot

Commands run during the deep review:

```powershell
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/seismic-section-graph-basis.test.mjs
```

Observed result:

- 32 tests passed.

Limitations:

- No app run.
- No browser visual inspection.
- No runtime helper bbox readback.
- No transition snapshot readback.

## I. Recommended Follow-Up Order

1. Add math-level helper orientation test.
2. Add runtime/default-off section-frame readback.
3. Visually verify settled `Y issue 1` and `Y issue 2`.
4. Only after settled helper geometry is correct, test page-switch transitions.
5. Add synthetic mixed target-scope transition fixture.
6. Decide whether helper opacity should become per-frame.
7. Keep page/project JSON artifacts out of runtime source commits unless separately approved.

