# YAXIS-STATIC-AUDIT-20260613-FRESH-9D2B Recommendations

Date: 2026-06-13

Scope: Recommendations from the fresh static audit of the GeoSee Y-section / section-frame visual issue.

Status: Static-only. No browser visual inspection was performed. Current status remains `ready for visual check`.

## Priority 1 - Do Not Fix Saved Pages

Do not edit `projects/utah-forge/pages/180_page.json` or `projects/utah-forge/pages/181_page.json` as the behavioral fix.

Reason:

- `Y issue 1` and `Y issue 2` are valid repro pages.
- Static page data does not encode Y/Z coplanarity.
- The reusable behavior owner is section helper construction, source-face basis selection, or transition state handling.

## Priority 2 - Verify The Helper Orientation Fix Visually

The highest-confidence static finding is that built-in Y uses a left-handed basis:

- X determinant: `+1`
- Y determinant: `-1`
- Z determinant: `+1`

A quaternion-based helper transform cannot represent the Y reflection correctly if the semantic normal is used as the third basis column.

Recommended implementation stance:

- Keep helper orientation right-handed by deriving the helper orientation third vector from `tangentA x tangentB`.
- Keep semantic plane normals available for clipping and shader/material logic.
- Run a browser visual check against `Y issue 1` and `Y issue 2` before claiming a visual fix.

## Priority 3 - Add A Math-Level Helper Orientation Test

Add a direct Three.js math test, not only a source-text guard.

The test should:

- construct resolved helper bases for X/Y/Z,
- apply the quaternion path,
- transform helper-local normals into world space,
- verify each helper visual plane is parallel to its resolved section plane,
- verify X/Y/Z helper planes remain orthogonal,
- specifically fail if the Y helper collapses into the Z plane.

## Priority 4 - Add Synthetic Repro Fixtures

Create synthetic section styles that mirror the repro shape without depending on live Utah page IDs:

- Fixture A: Y-only enabled, active Y, selected seismic target product.
- Fixture B: X/Y/Z enabled, active X, inherited/default target state.

Use these fixtures for app-behavior tests.

Do not use live `pageOrder`, page titles, page indices, or page IDs as app-behavior proof.

## Priority 5 - Add A Separate Deck-State Check

If saved-page preservation matters, add a named deck-state checker outside app-health verification.

It can assert:

- `180_page` title is `Y issue 1`.
- `180_page` has only Y enabled.
- `181_page` title is `Y issue 2`.
- `181_page` has X/Y/Z enabled.
- `180_page` and `181_page` remain adjacent if that is required for manual repro.

This must stay explicitly labeled as deck-state verification.

## Priority 6 - Add Runtime Readback Diagnostics

Add default-off section-frame diagnostic readback, not a visible overlay.

Recommended fields:

- effective active axis,
- effective active frame ID,
- section target scope,
- target layer IDs,
- target product IDs,
- source-face source kind,
- resolved normal,
- resolved axis A and B,
- basis determinant,
- helper orientation third vector,
- helper quaternion world normal,
- helper bounding flat axis,
- shader uniform section normal and bounds.

This readback should make clipping/helper disagreement visible without changing the viewport.

## Priority 7 - Audit Source-Face Basis Only If Visuals Still Fail

`Y issue 1` can use seismic source-face basis because it targets the seismic browser and product while active Y is selected.

`Y issue 2` likely uses built-in/default basis for Y.

If helper orientation is visually correct but page behavior still differs:

- dump source-face basis source for both pages,
- identify selected versus fallback seismic basis,
- compare source-derived normal/A/B to built-in Y normal/A/B,
- confirm right-handed source basis determinant.

## Priority 8 - Audit Transition State Only After Settled Orientation Is Known

Transition code is most relevant to page-switch bleed.

For `180_page -> 181_page` and `181_page -> 180_page`, expected partitioning is:

- moving frame: `axis:y`
- dissolving frames: `axis:x`, `axis:z`

If settled page visuals are correct but switching bleeds, inspect:

- helper transition snapshot contents,
- `sceneSectionMaskTransitionForTween`,
- source and target mask contexts,
- initial dual-mask setup versus per-tick tween style,
- helper rebuild timing at transition completion.

## Priority 9 - Keep Documentation And Verification Language Honest

Until a running browser confirms both repro pages:

- use `static checks pass`,
- use `ready for visual check`,
- avoid `visually fixed`,
- avoid `verified fixed`,
- avoid `resolved`.

## Static Verification Commands

Commands already executed during the static audit:

```powershell
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/seismic-section-graph-basis.test.mjs
```

Observed result:

- 32 passing tests total.

## Recommended Next Command Sequence

After any implementation change:

```powershell
node tests/tools/scene-section-frame-orientation-source.test.mjs
node tests/tools/scene-section-frame-partition-source.test.mjs
node tests/tools/scene-section-transition-behavior-source.test.mjs
node tests/tools/seismic-section-graph-basis.test.mjs
npm run check:workspace
```

After static checks:

- run the app,
- open `Y issue 1`,
- inspect Y frame against the actual Y cut plane,
- open `Y issue 2`,
- verify X/Y/Z helper planes are distinct and orthogonal,
- switch both directions between the pages,
- inspect for stale helper/frame bleed.
