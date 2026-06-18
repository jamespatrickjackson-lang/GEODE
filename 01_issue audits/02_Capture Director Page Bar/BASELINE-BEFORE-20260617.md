# Page Bar Runtime Drive — Before-Fix Baseline

Date: 2026-06-17 (traces captured 2026-06-18 UTC against the running dev server)
Purpose: authoritative pre-fix runtime state, so the post-fix diff is unambiguous.
Instrument: DEV trace nodes `capture-scroll-preview-trace` and
`capture-page-source-preview-trace`, read via
`window.__captureDirectorScrollPreview.getState()` and
`window.__pageController.getState().capturePageSourcePreview`.

Env: scoped dev server `geosee-dev` (port 5273), Utah FORGE, runtime current page
`156_page`.

## Case A — Page Bar clips, NO Camera Path (reported symptom)

Steps:
1. Open Capture Director, Scroll Animation panel.
2. Add two Page Bar clips for different pages (used `158_page`, `168_page`).
3. Click into the second clip to place the playhead inside it.

Observed (BEFORE):
- `capturePageSourcePreview.appliedPageId` = `156_page` (UNCHANGED).
- `capturePageSourcePreview.active` = `false`.
- `scrollTrace.appliedPageSource` = `false`, `scrollTrace.sampledPage` = `null`.
- Playhead frame did advance (`currentFrame` = 630), but no page was applied;
  `setScrollPlayheadSeconds` took the invalid-path branch and cleared the preview.

## Case B — Page Bar clips, 2-node Camera Path shorter than the clips

Steps:
1. With the two clips present, author two keyframes on the Camera Path lane.
2. Press the footer Play.

Observed (BEFORE):
- `data-testid="capture-error"` = "Page Bar clip timing extends beyond the
  authored Camera Path duration."
- `capturePageSourcePreview.appliedPageId` = `156_page` (UNCHANGED).
- `scrollTrace.previewState` = `idle`.

## Idle reference

With an empty Page Bar (`pageBarClipCount: 0`), runtime sits on `156_page`,
`previewActive: false`, `scrollTrace.appliedPageSource: false` — confirmed
2026-06-18T02:41Z.

## Acceptance criteria for the fix (AFTER must show)

A1. Case A: after clicking/scrubbing into the second clip with NO Camera Path
    (on any lane), `appliedPageId` becomes the clip's page,
    `capturePageSourcePreview.active` = `true`, `scrollTrace.appliedPageSource` =
    `true`, the runtime visibly shows that page, and the camera does NOT move.
A2. Case A crossing the clip boundary at partial progress reports
    `transitionActive: true` with `0 < transitionProgress < 1` and a visible scene
    crossfade (layers + background/fog).
A3. Case B: a Camera Path shorter than the Page Bar produces NO "extends beyond"
    error. Export renders only the in-path portion (tail clips clipped);
    preview/export clock is the path duration.
A4. Play (no path) advances through the page sequence with scene transitions; the
    camera holds the current/live pose (page cameras ignored), not errored.
A5. Background/fog differing between two pages crossfades mid-transition (full
    page-nav scene parity), not a snap.

These mirror the audit's confirmed reproduction and the DEC-175 contract
(Page Bar is a scene-state track only; the camera never follows a page change).
