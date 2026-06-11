# Transition Slice 2 — Browser-Measured Findings And Fixes (2026-06-10)

Status: working findings log for the Section ISO / threshold-surface / MT
Resistivity Cells transition repairs. Written so a cold session can continue.

Authority: `docs/dev-context/Transition-Runtime-Operating-Spec.md`, then
`Transition-Constitution.md`. Fixture pages are evidence only (TRD-001).

## How the evidence was gathered

Dev-only hook `window.__GEOVOX_DIAGNOSTICS__.getSceneHandle()` (added in
`src/scene/layerDiagnostics.ts`) gives runtime access to the SceneManager in a
browser session. Per-frame RAF recorders sampled composed material opacity of
Section ISO cut roots and threshold-surface meshes across adjacent-page
navigation on the Utah FORGE front block (156 → 167; pages are disposable
evidence). Critical: select a page in the editor first — while
`00. Global Settings` is selected, `pageWithoutLayerDeltas()` strips
`visibilityOverrides` and most layer overrides from every presented page
(see Open Items).

## Fixed in this slice (commits `7ce519f`, `e67dd36`, `6d2014b`, plus the
threshold-ghosting commit referencing this doc)

1. Matched Section ISO content crossfaded against itself on every hop between
   section pages (composed opacity dipped 0.614 → 0.336 → 0.614, four roots
   alive). Fix: `beginSectionIsoOverlayTransition` is now gated in
   `transitionEffectiveLayersForPage.ts` — roots crossfade only when the
   scene-section style or the ISO source-layer resolved state changes.
   Measured flat at 0.614 afterwards.
2. The ISO root crossfade froze mid-ramp when no other tween was alive, then
   commit slammed envelope to 1 (the visible snap). Fix: `tickLayerTweens`
   early-return and tween-completion gates now include
   `sectionIsoOverlayTransition`; `commitSectionIsoOverlayTransition` lands an
   early commit on a short residual ramp instead of forcing eased = 1; the
   section-tween done path no longer forces eased = 1 onto the ISO tick.
3. Full page reapply (`applyEffectiveStylesForPage`, fired by late
   async-layer-resolve) discarded the in-flight ISO ramp and rebuilt overlays
   at full opacity — the post-transition isoline pop. Fix: it captures the
   in-flight envelope and resumes the landing
   (`resumeSectionIsoOverlayLanding`) after the rebuild.
4. Layer transition snapshots cloned the Section ISO overlay groups,
   double-drawing contours against the ISO owner. Fix:
   `cloneTransitionObjectTree` skips `mtVolumeSectionIsoOverlayGroup`,
   `seismicVolumeSectionIsoOverlayGroup`,
   `seismicResistivitySectionIsoOverlayGroup`, and
   `sectionIsoOverlayTransitionRoot` subtrees.
5. Threshold-surface ghosting: a discrete scene-section change crossfaded
   every `SCENE_SECTION_AFFECTED_LAYER_IDS` layer against an identical clone
   of itself (composite alpha dips ~15-20% mid-fade for 0.67-opacity
   surfaces, plus z-fighting shimmer). Fix: `shouldCrossfadeSceneSection` now
   skips layers whose own resolved state is unchanged
   (`sectionAffectedLayerStateUnchanged`: equal opacity, no discrete data
   change, no scalar style change); the TRD-010 dual-mask path owns the
   clip-difference fade.
6. Capture Director camera-path motion (separate family, commit `7ce519f`):
   authored `timeCurve` is now the motion authority (DEC-144); the hidden
   power-2.6 re-ease and the 0.72-window boundary rewrite are gone.

## Open items, in priority order

0. **FIXED in this slice (per-material instrumentation closed item 1):** the
   terminal "iso pop" on enter was not an opacity lag. Material uuids showed
   the ISO root was fully REBUILT twice after the tween: once by the
   commit-time full `applySceneSectionPlanes` (the old
   `preserveExisting ?? true` wrapper prevented the clear but not a duplicate
   build), once ~300 ms later by the async-layer-resolve full reapply. Each
   rebuild swapped contour geometry at full opacity. Fix:
   `sectionIsoOverlayUpdateHeldByTransition` in `SceneManager.ts` holds
   MT/seismic cut ISO rebuilds while the transition owns a populated
   registered target root; only the height-sampler retries bypass
   (`bypassTransitionHold: true` + `preserveExisting: false` in
   `volumeCutIsoOverlays.ts`) because they must replace untrimmed contours,
   and they attach at the current envelope. The
   `section-iso-transition-smoothing-source` guard was updated from the
   superseded preserve-existing pattern to the hold contract.
   Not yet browser-re-measured — verify 158 → 159 enter shows a single
   stable material set (record material uuids per frame; see "How the
   evidence was gathered").
2. **MT Resistivity Cells Log10 load behavior** ("have to click All Valid
   Cells then Log10 for full display"). One confirmed mechanism: with
   `00. Global Settings` selected (the editor default on load),
   `pageWithoutLayerDeltas()` in `src/pages/PageController.tsx` deletes every
   presented page's `visibilityOverrides` and all non-preview-mapped layer
   overrides, so decks render environment-default visibility until a page is
   selected. Decide intent before changing: preview-environment-base is
   documented behavior for the selected page display, but applying it to
   presenter navigation of other pages is what users experience as "loads
   strange". Repro needs the user's dirty working pages; the committed
   savepoint pages author edge isolines only on e.g. 163/133 (thresholded +
   `scalarEdgeLineWidth` 1.3).
3. **Log10 edge-isoline flow in/out** ("nice iso outlines ... their nice flow
   in and out"): full-density `scalarEdgeLines` overlays during page
   transitions. The full-density-scalar tween path is protected
   (Operating Spec "Protected MT scalar/cloud path") — verify edge overlay
   enter/exit follows the scalar tween, do not alter its semantics.
4. Threshold-surface ghosting where the layer state DOES change between pages
   (opacity differs): still crossfades by design; if visible dips remain on
   such hops, consider opacity-tween-instead-of-crossfade when only opacity
   changed.

## Verification state

- 78/78 transition source guards, tsc, vite build, check:workspace clean at
  `6d2014b`; 23/23 focused guards after the threshold-ghosting gate.
- Browser measurements above are runtime evidence; human visual review
  remains the acceptance gate (TRD-003).
- User branch `fix/browser-video-encode` (canonical repo
  `C:\GeoSee\GeoSee_Dev`) is fast-forwarded to include these fixes; the
  worktree branch is `claude/stupefied-ramanujan-589a31`.
