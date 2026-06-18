# Capture Director Page Bar — Runtime Drive Fix Plan

Date: 2026-06-17
Author: Claude (Opus 4.8)
Status: Plan (no code changes yet)
Precedes: implementation
References: PAGE-BAR-RUNTIME-DRIVE-AUDIT-20260617-CLAUDE.md (this folder)

## Objective

Make the Page Bar the scene datum: as the scroll playhead enters a page clip, the
runtime switches to that clip's page and transitions in with full page-navigation
parity, whether or not a Camera Path is authored. Camera authority: the Camera
Path when valid; otherwise each page's authored camera.

Operator decisions (2026-06-17): DECOUPLE page-track from camera-path validity;
FULL page-nav parity for the captured transition; verified live first (done).

## Constraints

- Page-to-page false-fix ban: fixes target reusable behavior families
  (scroll-clock resolution, page-source sampling, effective-state resolution,
  visibility/style composition, camera policy, transition opacity). No page-id,
  page-order, page-title, or fixture-path special-casing.
- Transition Runtime Operating Spec governs any transition-runtime edit; the
  transition opacity regression test must still pass.
- Authoring persistence unchanged. Page Bar / Camera Path remain capture-recipe
  runtime state, never written to `projects/**` by this work.

## Root Cause (confirmed live)

Every runtime-driving path bails unless a valid Camera Path plan exists:

- `buildScrollRecordPlan` (CaptureDirectorProvider.tsx:1779) opens with
  `validateCaptureCameraPathV3Playback` and returns `{plan:null}` when invalid.
- It also returns `{plan:null}` when page-clip timing exceeds the Camera Path
  duration (CaptureDirectorProvider.tsx:1804-1814). Duration is derived solely
  from the path (`pathTimeline.durationSeconds`, line 1787).
- Consumers bail on `!plan`: idle-scrub effect (2080), `setScrollPlayheadSeconds`
  (2211-2221, which also CLEARS the preview), `playScrollPreview` (2108-2114).
- Freeze nulls env/cinematic scene transitions (SceneManager.ts:4875-4876), so
  background/fog/cinematic do not crossfade during the captured transition.

## Design Overview

Operator clarifications (2026-06-17): the Page Bar is a SCENE-STATE track only and
NEVER drives the camera; page-authored cameras are always ignored in this
workflow. Preview/drive must work with no Camera Path. Record/export stays
bound to the Camera Path. Outside Play, runtime page drive responds to any lane.

### Scroll clock, camera authority, page source

- Preview/drive clock: the Camera Path duration when a valid path exists,
  otherwise the enabled Page Bar duration (max clip end). A path-free Page Bar
  drives the full sequence.
- Export/record clock: bound to the Camera Path duration. Export stays
  camera-spine-led (a valid path is still required to render). A Page Bar longer
  than the path is clipped to the path window — tail clips fall outside the frame
  range and are simply not rendered (no reject).
- Camera authority (page cameras never participate):

| Context              | Camera driver                                         |
|----------------------|-------------------------------------------------------|
| Valid Camera Path    | Camera Path pose. Page cameras ignored.               |
| No valid Camera Path | Current/live camera held; no automatic move on a page change. Page cameras ignored. |

- `pageSource` unchanged (`page-bar` when clips exist, else `current-page`). Page
  sampling is camera-source-independent (locked by the characterization test), so
  swapping `cameraSource` to `current-camera` cannot change which page renders.

## Phased Implementation

### Phase 1 — Decouple preview drive from Camera Path validity
File: `src/capture/CaptureDirectorProvider.tsx`

Split the plan build into a PREVIEW intent (no path required) and the existing
EXPORT intent (camera-spine-led). Extract the math into a pure
`src/capture/captureScrollPlan.ts` so the decision points get unit coverage.

1. Preview plan:
   - Do NOT bail on invalid path. `const hasValidPath = pathValidation.valid;`
   - `normalizedPath = hasValidPath ? normalizeCaptureCameraPathV3(...) : null;`
   - `durationSeconds = hasValidPath ? pathDurationSeconds : pageBarDuration` (min
     0.1).
   - `cameraSource = hasValidPath ? {mode:"camera-path", pathId} :
     {mode:"current-camera", pathId:null}`.
   - Do NOT reject when the Page Bar exceeds a short path (preview bounds to the
     clock above).
   - Empty (no enabled clips AND no valid path): return `{plan:null}` (nothing to
     drive) so empty state stays a no-op.
2. Export plan: keep requiring a valid path; `durationSeconds = pathDurationSeconds`.
   Replace the "extends beyond the authored Camera Path duration" null-return
   (1804-1814) with CLIP — leave overlong clips in the timeline; the path-bound
   frame range plus `resolveScrollPageRenderPlan` (which drops out-of-range
   segments) excludes the tail. No error.
3. Plan shape allows `normalizedPath: CaptureCameraPathV3 | null` (preview).

### Phase 2 — Preview drivers + scrub scope (camera never moves on a page change)
File: `src/capture/CaptureDirectorProvider.tsx`

4. `applyScrollPreviewFrame` (~2003): only `setCameraPose` when
   `cameraSource.mode === "camera-path"` and `path != null`. In no-path mode do
   NOT touch the camera — the current/live pose is held. Page source never drives
   the camera.
5. `playScrollPreview`, `setScrollPlayheadSeconds`: use the PREVIEW plan; remove
   the invalid-path early-returns that CLEAR the preview (a preview plan now
   exists without a path). Keep the empty-plan branch (nothing to drive) clearing
   the preview.
6. Idle-scrub effect (~2046): remove the `selectedTimelineTrack !== "pages"`
   early-return; keep the `directorPanel === "closed"` and `scrollPreviewState
   === "playing"` guards. Runtime page drive reflects the playhead on any lane
   while the dock is open and not playing.
7. Camera-hold check: `previewCapturePageSource` must not move the camera. It
   currently sets `activeSceneTransitionRef` source/target poses and calls
   `frameUpdate` before the freeze; verify that path leaves the camera fixed in
   no-path mode (the provider no longer re-asserts a pose). If `frameUpdate`
   nudges the camera via the scene transition, re-assert the pre-change pose or
   pass a no-camera flag into the scene transition so only scene state animates.

DEVIATION (2026-06-18): Phase 2 also had to ungate the footer transport Play
button in `CaptureDirectorToolbar.tsx` — it was `disabled={!cameraPathPlaybackValidation.valid}`,
so Play could not be clicked without a Camera Path even though the handler now
supports it. Added `canPreviewScroll = path-valid || enabled-clips` and gated the
footer Play on it (Record stays path-gated). Found during live A4.

### Phase 3 — REMOVED (page cameras are always ignored)

The earlier page-camera fallback is dropped per the operator clarification. No
`applyPageCamera` flag, no `blendPose` camera application.
`applyCapturePageSourceNow` already leaves the camera untouched (2417-2441),
which is now the intended behavior; keep it camera-free.

### Phase 4 — Full page-nav scene parity in the freeze
File: `src/scene/SceneManager.ts`

10. `freezeCapturePageSourceTransitionPreview` (4824): instead of nulling
    `environmentSceneTransition` and `cinematicSceneTransition` (4875-4876), pin
    them at the sampled progress the same way layer tweens and section-ISO are
    pinned — set their `startMs`/`durationMs`/`easing` so the current
    interpolated env/cinematic value is held. Mirror the existing
    section-ISO pin pattern (4862-4868). Leave the discrete (non-transition)
    channels untouched.
11. Verify against the env-scene transition owner list in Active-Build-Context
    (background, scene fog, topo fog, fog-driven post tint) so the held frame
    matches a real mid-nav frame. The transition opacity regression test and a
    focused two-page background/fog check must pass.

### Phase 5 — Record/export stays bound to the Camera Path
File: `src/capture/CaptureDirectorProvider.tsx`

12. `acceptScrollRenderShell` (~2246) uses the EXPORT plan. Export remains
    camera-spine-led: keep requiring a valid Camera Path (do NOT relax the record
    gate to page-bar-only). The only change is reject -> clip for an overlong
    Page Bar: the path-bound frame range + `resolveScrollPageRenderPlan` (drops
    out-of-range segments) excludes tail clips, so a longer Page Bar renders only
    its in-path portion instead of failing. A page-bar-only capture with no path
    is a preview-only state until a path is authored.

## Edge Cases

- Empty Page Bar + valid path: `current-page` fallback (no page change); camera
  from path. Unchanged.
- Empty Page Bar + no path: nothing to drive; plan null; preview cleared.
- Page Bar with a valid path shorter than it: preview/export clock = path
  duration; tail pages beyond the path are not reached (preview) / not rendered
  (export). Camera is the path; no clamp logic needed.
- Page Bar with NO path: preview clock = page-bar duration; full sequence drives;
  camera is the held current/live pose (no move on a page change). Export is
  unavailable until a path is authored.
- First clip (no previous): no transition; settles to clip page (existing
  sampler behavior). Camera unchanged.
- Same page on adjacent clips: no transition (existing). Camera unchanged.
- Per-tick cost during Play: `applyCapturePageSourceNow` is a full re-apply each
  tick (already the case). Acceptable; revisit only if profiling shows jank.

## Test Plan

Source (synthetic fixtures only — no live page ids/order):
- `tests/tools/capture-director-runtime.test.mjs`: characterization locks landed
  (camera-path clamp; camera-source-independent page sampling; page-bar +
  current-camera validity). Add, once the plan math is extracted to
  `captureScrollPlan.ts`: preview clock = path?dur:pageBarDur; export clock =
  path dur; overlong Page Bar clips (no reject) in export; `cameraSource` =
  `current-camera` without a path.
- `tests/tools/capture-director-source.test.mjs`: keep contract parity green.
- Page-agnostic guard: `node tests/tools/transition-page-agnostic-source.test.mjs`.
- Transition opacity regression: `node tests/tools/transition-entity-opacity-executor.test.mjs` (Phase 4).

Live recheck (Utah FORGE, scoped dev server) — acceptance criteria in
`BASELINE-BEFORE-20260617.md`:
- Add >=2 page clips, NO camera path -> scrub/click on any lane -> runtime page
  changes and transitions; `capturePageSourcePreview.active=true`,
  `appliedPageSource=true`; camera does not move.
- Play with no path -> sequence advances through pages with scene crossfade;
  camera static.
- Background/fog differ between two pages -> mid-transition frame shows the blend
  (Phase 4), not a snap.
- A valid path shorter than the Page Bar -> no "extends beyond" error; export
  renders only the in-path portion.

## Risks / Guardrails

- Transition runtime is high-risk. Phase 4 touches the freeze; keep it a minimal
  pin (not a behavior rewrite) and gate with the opacity regression + a focused
  visual check before/after.
- Camera must NOT move on a page change in no-path mode: verify
  `previewCapturePageSource` + `frameUpdate` leave the camera fixed (Phase 2
  step 7). The current/live pose is the only no-path camera owner.
- Do not alter `scalarInclusionFilterActive`, `SCALAR_TRANSITION_STYLE_FIELDS`,
  `full-density-scalar`, or page fixtures (CLAUDE.md MT rules) — out of scope.
- Verification language: "ready for visual check" until a human or live browser
  confirms the rendered result.

## Out Of Scope

- Headless multi-page render per-frame page application (separate runtime
  extension noted in capture README).
- Camera Path authoring/quality changes.
- Any persistence-architecture change.

## Suggested Commit Slicing

1. Phase 1+2 (preview decouple, scrub-any-lane, camera-hold) + extracted
   `captureScrollPlan.ts` and its unit tests — behavioral core. Delivers the
   headline "Page Bar drives the runtime, camera held" behavior.
2. Phase 4 (freeze scene parity) — transition fidelity (high-risk; gated by the
   opacity regression).
3. Phase 5 (export clip-not-reject) + remaining tests.

Phase 3 is removed (page cameras are always ignored). Slice 1 alone resolves the
reported symptom.
