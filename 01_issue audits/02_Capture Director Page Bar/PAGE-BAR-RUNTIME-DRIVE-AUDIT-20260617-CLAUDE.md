# Capture Director Page Bar — Runtime Drive Audit

Date: 2026-06-17
Author: Claude (Opus 4.8)
Status: First review (no code changes yet)

## Goal Under Investigation

Page Bar clips in the Capture Director lower timeline should control which page
the live runtime shows. As the playhead enters a clip, the runtime should switch
to that clip's page and transition into it the same way a normal page navigation
transitions. Reported state: this is not happening in normal use.

## Intended Architecture (from docs)

`docs/capture-director/README.md` ("Page Bar And Camera Spine Timeline"):

- The Page Bar is the "scene datum" for Capture Director and choreographs the
  page sequence "without making Camera Path own page state."
- Camera Path is a "separate spatial camera spine."
- Both tracks sample one shared capture clock.
- "At every sampled frame the Page Bar applies the selected page's effective
  visibility, styles, page scene, and overlays; Camera Path then applies the
  camera pose."

So the documented intent is Page-track and Camera-track independence.

## Implemented Data Flow

1. UI: `src/capture/CameraPathTimeline.tsx` renders the Pages lane. Clip clicks,
   playhead placement, and add/replace/range all call provider callbacks.
2. Provider: `src/capture/CaptureDirectorProvider.tsx`
   - `buildScrollRecordPlan()` (~1779) builds a `CaptureScrollTimelineV1` from the
     enabled page clips plus the camera path, then validates it.
   - `applyScrollPageSourcePreviewFrame()` (~1967) samples the timeline at a frame
     via `sampleCaptureScrollTimeline` and calls `previewCapturePageSource(...)`.
   - `applyScrollPreviewFrame()` (~2003) additionally pushes the Camera Path pose.
   - Three drivers call those: the idle-scrub effect (~2046), `playScrollPreview`
     (~2101), and `setScrollPlayheadSeconds` (~2195).
3. Sampler: `src/capture/captureScrollTimeline.ts`
   - `sampleScrollPageSource` (~841) returns `{ sourcePageId, targetPageId,
     transitionProgress, ... }`. During a clip's `transitionSeconds` it reports a
     real source->target with progress 0..1; during the hold it reports settled
     (`targetPageId = null`, progress 1). The first clip never reports a target
     (nothing to transition from).
4. Page runtime: `src/pages/PageController.tsx`
   - `previewCapturePageSource` (~2443): when source/target differ and progress<1,
     it sets up a real page transition (layers, env-scene, cinematic-scene),
     advances it to `progress`, then calls
     `sceneHandle.manager.freezeCapturePageSourceTransitionPreview(now)` and tears
     the active transition down. When settled it calls
     `applyCapturePageSourceNow(page)` for a hard page apply.
   - `resolveCapturePageSourcePreview` in `src/pages/capturePageSourcePreview.ts`
     resolves which page is "applied" vs in-transition.
5. Freeze: `src/scene/SceneManager.ts` `freezeCapturePageSourceTransitionPreview`
   (4824) pins layer tweens / transition snapshots / section-ISO at their current
   interpolated value.

## Primary Finding — Page Track Is Hard-Coupled To A Valid Camera Path

Every runtime-driving path bails out unless a fully valid Camera Path plan exists:

- `buildScrollRecordPlan()` starts with
  `validateCaptureCameraPathV3Playback(captureCameraPathV3)` and returns
  `{ plan: null }` when invalid (CaptureDirectorProvider.tsx:1780-1783).
- `validateCaptureCameraPathV3Playback` (src/capture/captureCameraPathV3.ts:1429)
  requires **at least two active camera views and one enabled transition**, and a
  duration > 0.
- The idle-scrub effect calls `buildScrollRecordPlan()` and `if (!plan) return;`
  (CaptureDirectorProvider.tsx:2080-2081) — no page application.
- `setScrollPlayheadSeconds` early-returns when
  `!cameraPathPlaybackValidation.valid` or `!plan`, and on that path it
  **actively clears** any page-source preview
  (CaptureDirectorProvider.tsx:2201-2221).
- `playScrollPreview` early-returns the same way (CaptureDirectorProvider.tsx:
  2102-2114).

Consequence: with page clips added but no authored ≥2-node camera path (the
common state when an author is sequencing pages first), clicking/scrubbing/playing
the Page Bar does nothing to the runtime page — and playhead placement clears the
preview. This contradicts the README's "Page Bar is the scene datum ... without
making Camera Path own page state" and is the leading explanation for "the pages
in the page bar don't control the runtime."

Additional coupling: even with a valid path, `buildScrollRecordPlan` returns
`{ plan: null }` when page-clip timing exceeds the camera path duration
(CaptureDirectorProvider.tsx:1804-1814), so a longer Page Bar than the path also
silently disables runtime drive.

## Secondary Finding — Idle Scrub Gated On Selected Track

The non-Play page-preview effect early-returns unless
`selectedTimelineTrack === "pages"` (CaptureDirectorProvider.tsx:2046-2054). While
the Camera Path lane is the selected track, manual scrubbing on the rail/time-axis
will not apply the Page Bar's page to the runtime (only `Play` drives it
track-independently).

## Secondary Finding — Freeze Drops Env/Cinematic Scene Transitions

`freezeCapturePageSourceTransitionPreview` pins layer tweens and section-ISO, but
sets `this.environmentSceneTransition = null` and
`this.cinematicSceneTransition = null` (SceneManager.ts:4875-4876) rather than
pinning them at `progress`. Background, scene fog, topo fog, and cinematic-scene
channels are the documented environment-scene transition owners
(Active-Build-Context.md). Dropping them in the frozen preview means a Page Bar
page transition may not crossfade those channels the way a real page navigation
does — a candidate divergence from "transition as it should like any change page."
Needs live confirmation.

## Not Yet Confirmed (needs live verification)

- Whether, with a valid camera path, the per-tick freeze/teardown during `Play`
  produces a smooth transition or visible jank/snapping.
- Whether the env/cinematic-scene drop above is visually material on a multi-page
  Page Bar with background/fog differences.
- Whether `setScrollPlayheadSeconds` clearing the preview on the invalid path is
  the observed "nothing happens" symptom.

## Page-Agnostic Constraint

Per CLAUDE.md and Active-Build-Context.md, any fix targets reusable behavior
families (transition entity matching, effective-state resolution, visibility
resolution, camera policy, save/persistence). No page-id / page-order / fixture
special-casing. App-behavior tests must use synthetic fixtures.

## Operator Decisions (2026-06-17)

1. DECOUPLE — Page Bar must drive/transition the runtime page even with no or
   invalid camera path. Camera falls back to each page's authored camera (or the
   current camera). Aligns with the documented "scene datum" intent.
2. FULL PAGE-NAV PARITY — a Page Bar page transition animates every channel a
   normal page change animates (layers, background/fog, cinematic scene, section),
   including the env/cinematic-scene channels the freeze currently drops.
3. VERIFY LIVE FIRST — run a scoped dev-server verification pass (with and without
   a camera path) before authoring the fix plan.

## Live Verification Log

Env: scoped dev server `geosee-dev` (port 5273), Utah FORGE project, current page
`156_page`. Traced via `window.__pageController.getState().capturePageSourcePreview`
and `window.__captureDirectorScrollPreview.getState()`.

Case A — Page Bar with clips, NO camera path:
- Added two clips (158_page, 168_page) via the Pages lane page picker.
- Selected track became `pages`; playhead moved into the 168_page clip
  (`currentFrame` advanced to 630).
- Runtime did NOT change: `appliedPageId` stayed `156_page`,
  `capturePageSourcePreview.active = false`, scroll trace
  `appliedPageSource = false`, `sampledPage = null`.
- Confirms: `setScrollPlayheadSeconds` took the invalid-path branch — it set the
  frame and CLEARED the preview rather than applying a page.

Case B — Page Bar with clips, 2-node camera path (path shorter than clips):
- Authored two keyframe nodes on the Camera Path lane (orbited the canvas between
  captures so the second pose differed).
- Pressing the footer Play surfaced `data-testid="capture-error"`:
  "Page Bar clip timing extends beyond the authored Camera Path duration."
- Runtime still did NOT change: `appliedPageId` stayed `156_page`,
  `previewState` stayed `idle`.
- Confirms the second coupling gate: `buildScrollRecordPlan` returns
  `{ plan: null }` when page-clip timing exceeds camera-path duration
  (CaptureDirectorProvider.tsx:1804-1814), independent of path validity.

Conclusion: the reported symptom reproduces. Page Bar runtime drive is gated
behind BOTH (1) a valid >=2-node Camera Path and (2) Camera Path duration >=
Page Bar duration. Neither holds in the natural "sequence pages first" flow, so
the Page Bar appears inert. Matches the code-level diagnosis; the DECOUPLE fix is
correctly targeted.

Cleanup: test page clips cleared. Three camera-path keyframes added during the
test remain as capture-recipe runtime draft state (not written to project files;
reset on reload / Camera Path clear).

## Fix Direction (for the plan, not yet implemented)

Targets reusable behavior families per the page-agnostic ban:

1. Page-source sampling/application must not require a renderable Camera Path.
   Derive a Page-Bar-only scroll clock (own duration from page clips) so
   `sampleScrollPageSource` + `previewCapturePageSource` run with
   `cameraSource.mode = "current-camera"` (or page-authored cameras) when no
   valid path exists. Decouple `buildScrollRecordPlan` page-source resolution
   from `validateCaptureCameraPathV3Playback`.
2. Remove the "clip timing extends beyond Camera Path duration" hard-null for the
   PREVIEW/drive path; let the shared clock span the Page Bar. Camera sampling
   past the path end clamps/holds the last pose. (Record/export duration policy
   can remain a separate question.)
3. Idle scrub: drive page-source preview whenever the Pages lane interaction
   occurs, not only when `selectedTimelineTrack === "pages"` is already set, and
   not gated on camera validity.
4. Full page-nav parity: stop nulling `environmentSceneTransition` /
   `cinematicSceneTransition` in `freezeCapturePageSourceTransitionPreview`
   (SceneManager.ts:4875-4876); pin them at the sampled progress like layer
   tweens so background/fog/cinematic channels crossfade in the captured
   transition.
5. Verify with synthetic fixtures in `tests/tools/capture-director-runtime.test.mjs`
   (no live page ids / order), plus a focused live browser recheck.
