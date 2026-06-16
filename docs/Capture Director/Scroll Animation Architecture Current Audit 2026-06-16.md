# Scroll Animation Architecture Current Capture Director Audit

Date: 2026-06-16

Status: audit-only findings before implementation planning

Repository checkout: `C:\GeoSee\GeoSee_Dev`

Observed branch: `CODEX_Tansition_002`

Dirty tree note: the worktree already contains unrelated deleted files under
`Transition Architecture/` and `Y Axis issue/`, plus untracked folders. This
audit does not classify or alter that unrelated work.

## Scope

This audit compares the current Capture Director architecture against
`docs/Capture Director/Scroll Animation Architecture Requirements.md`.

This pass inspected Capture Director source, local renderer tooling, runtime
tests, current capture decisions, and the transition operating contract. It
does not implement the scroll-animation feature, repair the lower Page Bar, or
produce a visual/browser verification result.

## Summary Verdict

Capture Director already has a useful production foundation:

- deterministic frame export from `CaptureRecipeV1`;
- browser-side MP4/WebM encoding for smaller deterministic videos;
- local external 4K-or-higher video rendering;
- exact 8K still-render concepts;
- Camera Path V3 timeline authoring;
- a Page Bar data model and lower timeline lane;
- job records, cancellation hooks, and diagnostics.

The current architecture does not yet satisfy the scroll-animation
requirements. The missing parts are not small UI polish items. The feature
needs a first-class scroll output contract, a package writer, a centered Record
popout, 60 FPS normalization, explicit output profiles, frame-range slicing,
and a Page Bar/page-transition integration path.

Most important: the current lower Page Bar is a recipe/session model and UI
lane, not an authoritative page override. The upcoming Page Bar fix must be a
dependency-aware part of this work because scroll preview and final Record need
to sample page state, transition state, and camera state from one clock.

## Existing Architecture Map

### Capture Director Panels

Current panel type:

- `closed`
- `realtime`
- `render-out`
- `still-capture`
- `camera-path`

Evidence: `src/capture/captureTypes.ts:12-17`.

Gap: no `scroll-animation` panel/container exists. The toolbar section stack
currently expands `realtime`, `render`, `still`, and `camera-path`, with no
scroll-owned controls or popout shell.

### Deterministic Recipe

`CaptureRecipeV1` carries project/page identity, mode, resolution, FPS,
duration, camera keyframes, Camera Path, layer visibility/styles,
environment state, render fidelity, page range fields, and optional
`captureTimeline`.

Evidence: `src/capture/captureRecipe.ts:54-83`,
`src/capture/captureRecipe.ts:501-514`.

Fit: strong base for deterministic capture.

Gap: no `CaptureScrollTimelineV1`, no output package settings, no progress
anchors, no scroll handoff manifest contract, and no frame-range slice contract.

### Page Bar Model

The current Page Bar model stores page clips:

- `pageId`
- label
- enabled/locked flags
- start seconds
- hold seconds
- transition seconds
- transition easing

The sampler returns a page sample with local time and transition progress, plus
a camera pose from Camera Path, page camera, or current camera.

Evidence: `src/capture/captureTimeline.ts:39-68`,
`src/capture/captureTimeline.ts:388-432`.

Fit: this is the right starting shape for composing pages and camera on one
clock.

Gap: source search found no integration where `sampleCaptureTimeline()` drives
`PageController` as the active page source, overrides the editor-selected page,
or invokes the live page-transition runtime during preview.

### Lower Timeline UI

The lower timeline renders a Pages lane and page clip buttons.

Evidence: `src/capture/CameraPathTimeline.tsx:700-733`,
`src/capture/CameraPathTimeline.tsx:740-790`,
`src/capture/CaptureDirectorToolbar.tsx:2380-2404`.

Fit: authoring affordance exists.

Gap: the known operator issue is confirmed at the architecture level: adding
pages to the lower bar is only represented as Capture Director timeline state.
It does not currently override the editor bar page or become the live scene
datum for preview.

### Render Out

Current Render Out is inline in the toolbar. It exposes:

- mode;
- resolution;
- FPS;
- MP4/WebM format;
- current page or page-range scope;
- page range start/end and timing;
- render/cancel/download links.

Evidence: `src/capture/CaptureDirectorToolbar.tsx:1059-1310`.

Fit: deterministic Render Out exists and already separates realtime preview
from final-quality export.

Gap: there is no centered Record popout, no `Accept and Render` gate, no simple
Format/Quality/Range/Save-first flow, no progressive per-format options, and no
Advanced disclosure with explanations.

### External Video Renderer

4K-or-higher deterministic video defaults to local external rendering.

Evidence: `src/capture/externalVideoRenderJob.ts:100-108`,
`src/capture/CaptureDirectorProvider.tsx:3846-3899`,
`tools/render-capture-video-job.mjs:513-652`.

Fit: this is the correct route for final 4K/8K-class scroll output.

Gaps:

- `CaptureVideoRenderJobV1` supports only `mp4` and `webm`.
- local job validation rejects every other video format.
- the routing function comments that page-range and timeline sequences still
  remain on the browser path until external sequence rendering exists, while
  resolution is the only routing input.
- renderer can keep a PNG frame directory, but that directory is diagnostics
  side output, not a selected first-class PNG sequence package.

Evidence: `src/capture/externalVideoRenderJob.ts:21-32`,
`src/capture/externalVideoRenderJob.ts:203-205`,
`plugins/vite-plugin-author-write.ts:330-364`,
`tools/render-capture-video-job.mjs:628-645`.

### Clean Render Mode

Capture visibility profiles can hide editor sidebar, authoring controls, debug
panels, nav controls, legends, logo, presenter overlay, and full chrome for
scene marketing modes.

Evidence: `src/capture/captureProfiles.ts:20-63`,
`src/capture/CaptureChromeGate.tsx:6-21`,
`src/editor/EditorChrome.tsx:534-583`.

Fit: clean-render foundations exist.

Gaps:

- the contract is `CaptureMode`-based, not scroll Record-specific;
- the Capture Director toolbar itself remains mounted outside the chrome gates;
- the guarantee to hide Camera Path overlays, camera location indicators, Page
  Bar authoring aids, and future scroll UI needs a scroll-specific clean render
  checklist;
- deterministic canvas rendering avoids DOM chrome, but display capture and
  future overlay options need stricter assertions.

### Cancellation

Browser deterministic export cancellation aborts the job and disposes the
runtime. The deterministic frame exporter revokes partially created object URLs
when export fails before completion. The local video endpoint marks an external
run cancelled and deletes output and diagnostics files.

Evidence: `src/capture/CaptureDirectorProvider.tsx:1918-1930`,
`src/capture/CaptureDirectorProvider.tsx:4187-4205`,
`src/capture/deterministicFrameSequenceExporter.ts:423-443`,
`plugins/vite-plugin-author-write.ts:732-748`.

Gap: requirements call for a Partial Package that keeps safely written frames,
diagnostics, and any valid playable media. Current cancellation behavior is
abort/delete/cleanup oriented, not partial-package oriented.

## Requirements Fit Matrix

| Requirement area | Current state | Fit | Finding |
| --- | --- | --- | --- |
| Dedicated Scroll Animation container | No scroll panel type or toolbar section | Missing | CD-SA-001 |
| Play preview of camera movement | Camera Path playback and scrub exist | Partial | CD-SA-002 |
| Record opens centered popout | Current Render Out is inline toolbar controls | Missing | CD-SA-003 |
| Accept and Render gate | Render starts from inline button | Missing | CD-SA-003 |
| 60 FPS default/global timeline | default state is 30 FPS; 1080p and 8K default to 30; 24 is accepted | Conflict | CD-SA-004 |
| Clean 30/60/120 FPS future set | current type is `24 | 30 | 60` | Conflict | CD-SA-004 |
| MP4 output | Supported | Good base | CD-SA-005 |
| WebM output | Supported | Good base | CD-SA-005 |
| Scroll-Friendly Video dense keyframes | No output profile, no GOP/keyframe controls | Missing | CD-SA-006 |
| PNG frame sequence | Internal PNG frames exist, but not selected package output | Partial | CD-SA-007 |
| 1080p to 8K ladder | 1080p, 1440p, 4K, 8K exist | Partial | CD-SA-008 |
| 6K and long-edge 8192 | No preset/profile support | Missing | CD-SA-008 |
| Frame range full video or slice | Current page range exists, but no zero-based inclusive frame range for scroll timeline | Partial | CD-SA-009 |
| Save destination before render | Browser picker is post-blob save; external route writes `.tmp` | Missing | CD-SA-010 |
| `ScrollHandoffPackageV1` folder | No package writer or manifest | Missing | CD-SA-011 |
| Contact sheet and poster frames | Not present for scroll package | Missing | CD-SA-012 |
| Partial package on cancel/fail | Current paths abort/delete/cleanup | Conflict | CD-SA-013 |
| Page Bar as scene datum | Model exists; lower Page Bar currently not authoritative | Partial, blocked | CD-SA-014 |
| Page transitions accounted for | Page transition runtime exists, but Capture Timeline bypasses it in export segments | Partial, blocked | CD-SA-015 |
| Diagnostics source contract | Capture job diagnostics exist; no scroll handoff source contract/render-stack summary | Partial | CD-SA-016 |

## Findings

### CD-SA-001 - No Scroll Animation Container

Severity: P1

Current Capture Director panels are limited to realtime, render-out,
still-capture, and camera-path.

Evidence:

- `src/capture/captureTypes.ts:12-17`
- `src/capture/CaptureDirectorToolbar.tsx:564-565`

Requirement impact: the requested dedicated container in the Capture Director
bar has no state enum, toolbar section, context surface, or test ID boundary.

Implementation implication: add the scroll section as a separate Capture
Director production area instead of overloading Render Out or Camera Path.

### CD-SA-002 - Preview Exists For Camera Path, Not Scroll Timeline

Severity: P1

Camera Path playback, scrub, and preview recording exist. The requirements ask
for Play/Pause/Stop preview of the scroll timeline using Page Bar, Camera Path,
render preset, and the same sampling contract as final output.

Evidence:

- `docs/Capture Director/Scroll Animation Architecture Requirements.md:287-297`
- `docs/Capture Director/Scroll Animation Architecture Requirements.md:404-409`
- `src/capture/CameraPathTimeline.tsx:919-926`
- `src/capture/CaptureDirectorToolbar.tsx:2387-2392`

Requirement impact: current preview can play camera movement but cannot yet
prove parity with final scroll output because there is no
`CaptureScrollTimelineV1` and no active Page Bar override.

### CD-SA-003 - Record Popout And Acceptance Gate Are Missing

Severity: P1

Current final export starts from the inline Render Out button. Format, quality,
range, and save destination are not presented through a centered Record popout.

Evidence:

- `src/capture/CaptureDirectorToolbar.tsx:1059-1310`
- `docs/Capture Director/Scroll Animation Architecture Requirements.md:300-356`

Requirement impact: the requested simple-first Record setup flow is missing:
Format, Quality, Full Video/Frame Range, Save Location, explanations, Advanced
button, and `Accept and Render`.

Implementation implication: create a scroll Record modal/popout contract before
renderer behavior is expanded. Renderer entry should receive a validated export
request, not infer options from scattered toolbar state.

### CD-SA-004 - FPS Contract Conflicts With Requirements

Severity: P1

Current FPS model:

- realtime options: 30 and 60;
- render options: 24, 30, and 60;
- provider state defaults to 30;
- 1080p default is 30;
- 8K default is 30;
- tests assert 24 is valid.

Evidence:

- `src/capture/captureResolution.ts:9-20`
- `src/capture/captureResolution.ts:26-57`
- `src/capture/captureResolution.ts:120-122`
- `src/capture/CaptureDirectorProvider.tsx:717`
- `tests/tools/capture-director-runtime.test.mjs:173-174`

Requirement impact: scroll architecture requires Preview and Render Out to
default to 60 FPS and future FPS choices to stay mathematically clean against
60 FPS: 30, 60, and 120 are the allowed candidates.

Implementation implication: scroll output should establish its own 60-first FPS
contract. Current 24 FPS support may need to remain outside scroll or become an
Advanced legacy/export-only option with explicit conversion rules.

### CD-SA-005 - MP4 And WebM Are Supported But Too Narrow

Severity: P2

Current deterministic format type is only `mp4 | webm`. Browser encoder plans
support H.264 MP4 and VP9 WebM. External job validation also accepts only MP4
and WebM.

Evidence:

- `src/capture/captureTypes.ts:91`
- `src/capture/frameSequenceVideoEncoder.ts:11-22`
- `src/capture/frameSequenceVideoEncoder.ts:123-139`
- `plugins/vite-plugin-author-write.ts:362-364`

Requirement impact: normal MP4/WebM coverage is a good base, but the new output
selector also requires Scroll-Friendly Video and PNG Sequence.

### CD-SA-006 - No Scrub-Optimized / Scroll-Friendly Video Profile

Severity: P1

The current FFmpeg plans do not expose GOP/keyframe interval, all-keyframe mode,
seek metadata, or a distinct scroll-friendly output profile.

Evidence:

- `src/capture/frameSequenceVideoEncoder.ts:425-483`
- `tools/render-capture-video-job.mjs:400-425`

Requirement impact: scroll-bound video seeking is keyframe-sensitive. Current
MP4/WebM encodes may play normally but are not guaranteed to scrub smoothly when
bound to website scroll progress.

Implementation implication: add a dedicated profile with dense keyframes or
all-keyframe strategy. The default can remain MP4 for review, but
scroll-friendly output needs explicit diagnostics.

### CD-SA-007 - PNG Frame Sequence Exists Internally, Not As Handoff Output

Severity: P1

The deterministic exporter creates PNG/WebP frame blobs. The browser encoder
writes virtual frame files, then deletes them when `cleanupInputFrames` is
true. The local external renderer writes PNG frames to a `.tmp` frame directory
and can keep that directory in diagnostics.

Evidence:

- `src/capture/deterministicFrameSequenceExporter.ts:19-41`
- `src/capture/deterministicFrameSequenceExporter.ts:294-464`
- `src/capture/frameSequenceVideoEncoder.ts:504-538`
- `src/capture/CaptureDirectorProvider.tsx:4145-4151`
- `tools/render-capture-video-job.mjs:528-530`
- `tools/render-capture-video-job.mjs:640-645`

Requirement impact: PNG sequence output is requested as a first-class format
with frame naming, padding, manifest, posters, and contact-sheet options.
Current frame sequences are encoder inputs or diagnostics, not deliverables.

### CD-SA-008 - Resolution Ladder Partially Matches

Severity: P2

Current presets include 1080p, 1440p, 4K, and 8K UHD. There is no 6K preset and
no long-edge 8192 option.

Evidence:

- `src/capture/captureResolution.ts:22-71`
- `docs/Capture Director/Scroll Animation Architecture Requirements.md:125-139`
- `docs/Capture Director/Scroll Animation Architecture Requirements.md:208-220`

Requirement impact: exact 8K UHD exists, but the requested quality ladder from
1080p through 8K is incomplete.

### CD-SA-009 - Frame Range Is Not The Requested Scroll Frame Range

Severity: P1

Current Render Out supports current-page duration and page-range start/end.
The new requirement asks for a zero-based inclusive frame range over the 60 FPS
scroll timeline, with full video as the default.

Evidence:

- `src/capture/capturePageRange.ts:1-37`
- `src/capture/CaptureDirectorToolbar.tsx:1160-1272`
- `docs/Capture Director/Scroll Animation Architecture Requirements.md:86-88`
- `docs/Capture Director/Scroll Animation Architecture Requirements.md:309-313`

Requirement impact: page range and frame range are different concepts. Scroll
output needs frame `startFrame` and `endFrame` validation after final timeline
duration is resolved.

Implementation implication: store timeline in seconds/normalized progress, then
derive frame ranges from selected FPS. This avoids dirty conversion if 30/60/120
support changes later.

### CD-SA-010 - Save Destination Is Post-Output Or `.tmp`, Not Preflight Package Target

Severity: P1

Current browser video save uses `showSaveFilePicker` after a video blob exists.
The local external route writes under `.tmp/capture-video-outputs/` and exposes
download URLs/status.

Evidence:

- `src/capture/captureVideoSaveOptions.ts:67-107`
- `plugins/vite-plugin-author-write.ts:455-477`
- `src/capture/CaptureDirectorProvider.tsx:3885-3899`

Requirement impact: Record must accept a save destination before final output
starts and create a package folder. Current save flow is not enough for 8K
multi-file output, PNG sequence, posters, contact sheet, and manifest.

### CD-SA-011 - No `ScrollHandoffPackageV1`

Severity: P1

No package manifest, folder schema, source contract, README generation, poster
list, contact sheet, output hash list, or website handoff metadata currently
exists in source.

Evidence:

- source search found no `ScrollHandoffPackageV1`,
  `CaptureScrollTimelineV1`, or scroll package writer symbols;
- existing job record output is blob/url/filename oriented:
  `src/capture/captureJobTypes.ts:21-38`.

Requirement impact: web designers need a folder and manifest, not just a
downloadable media file or diagnostics sidecar.

### CD-SA-012 - Poster Frames And Contact Sheet Are Missing

Severity: P2

Current frame diagnostics track frame index, time seconds, path, byte length,
and tiling for external renders. No contact-sheet or named poster-frame
generation exists for scroll anchors.

Evidence:

- `tools/render-capture-video-job.mjs:589-595`
- `docs/Capture Director/Scroll Animation Architecture Requirements.md:112-115`
- `docs/Capture Director/Scroll Animation Architecture Requirements.md:191-193`

Requirement impact: review and website handoff lose the visual index needed for
high-quality scrollytelling integration.

### CD-SA-013 - Cancellation Conflicts With Partial Package Requirement

Severity: P1

Current cancellation paths clean up or delete output artifacts. The local video
cancel endpoint deletes output and diagnostics files. Browser frame export
revokes partial frame URLs if not completed.

Evidence:

- `src/capture/deterministicFrameSequenceExporter.ts:423-443`
- `plugins/vite-plugin-author-write.ts:732-748`
- `src/capture/CaptureDirectorProvider.tsx:4187-4205`

Requirement impact: cancelled or failed scroll outputs must keep safely written
frames, diagnostics, and any valid playable media in a Partial Package marked
incomplete.

Implementation implication: package writing needs staged, resumable-safe file
semantics and a `status: partial | complete | failed | cancelled` manifest
field. Existing destructive cleanup should not run for accepted scroll Record
packages.

### CD-SA-014 - Lower Page Bar Is Not An Active Page Override

Severity: P0 for scroll correctness

The Page Bar data model exists, and the lower timeline can add page clips. But
the current architecture does not make those clips override the editor-selected
page in the live page controller. `sampleCaptureTimeline()` is present only as a
capture timeline sampler, and provider export logic handles clips by building
per-page segment recipes.

Evidence:

- `src/capture/captureTimeline.ts:388-432`
- `src/capture/CaptureDirectorProvider.tsx:949-1055`
- `src/capture/CaptureDirectorProvider.tsx:3966-4024`
- `tests/tools/capture-director-runtime.test.mjs:1168-1345`

Requirement impact: scroll preview and final output must treat Page Bar as the
scene/page datum. The operator note that lower-bar pages currently do not work
is consistent with the architecture: the lane is stateful UI, not yet a live
override.

Required accommodation: scroll work must leave a clear seam for a future
Capture Director Page Source override. While active, it should supersede the
editor bar page for preview/record without mutating page JSON or Camera Path
state. Empty Page Bar may still fall back to current-page capture, but that
fallback must be recorded in the handoff manifest.

### CD-SA-015 - Page Transitions Are Not Fully Accounted For In Capture Timeline Export

Severity: P0 for page-to-page scroll animations

The transition operating contract says a page transition is a deterministic
diff between source live render graph and target resolved render graph. It also
says any effective page or environment state change must go through
`transitionEffectiveLayersForPage` plus the commit gate. A bare pose tween is
only valid when effective page/environment state does not change.

Evidence:

- `docs/dev-context/Transition-Runtime-Operating-Spec.md:17-25`
- `docs/dev-context/Transition-Runtime-Operating-Spec.md:213-234`
- `src/pages/PageController.tsx:2523-2563`
- `src/pages/PageController.tsx:2802-2864`

Current Capture Director page clip export builds segment recipes per target
page and offsets the clock. That can approximate page sequencing, but it does
not prove live transition parity or source/target graph blending.

Evidence:

- `src/capture/CaptureDirectorProvider.tsx:3966-4024`
- `src/capture/CaptureDirectorProvider.tsx:4056-4084`

Requirement impact: page-transition-driven scroll sequences need frame-time
transition state, not only target-page segment capture.

Required accommodation: the scroll timeline must be able to represent
`sourcePageId`, `targetPageId`, `transitionProgress`, and effective transition
sampling per frame. The future Page Bar fix should feed the same transition
runtime used by editor/page navigation or an equivalent deterministic render
graph sampling API.

### CD-SA-016 - Diagnostics Are Useful But Not Handoff-Complete

Severity: P2

Capture jobs and external renderer diagnostics record output path, frame
counts, dimensions, renderer, superscale, master path, frame sequence dir, and
similar operational details.

Evidence:

- `src/capture/CaptureDirectorProvider.tsx:3885-3899`
- `tools/render-capture-video-job.mjs:628-645`

Gaps against requirements:

- no `sourceContract` section for Capture Director recipe path/id, Page Bar,
  Camera Path, selected page source, scroll range, and fallback behavior;
- no render-stack trace summary for map/terrain/raster/material-critical output;
- no output hashes;
- no poster/contact-sheet paths;
- no recommended website playback metadata;
- no package completion status.

## Page Bar And Transition Accommodation

The scroll architecture should treat lower Page Bar repair as a first-class
dependency, not an afterthought.

Required behavior for the future fix:

1. Lower Page Bar clips become the Capture Director page source during scroll
   preview and Record.
2. That page source temporarily overrides editor bar selection while capture
   playback is active.
3. Override must be session/runtime state only, not page JSON, project
   `pageOrder`, camera path, or fixture edits.
4. Page changes with effective scene/environment differences must use the
   transition runtime contract or an equivalent deterministic transition sampler.
5. Page clip transition seconds/easing must be reconciled with authored page
   transition duration/easing and recorded in diagnostics.
6. Empty Page Bar fallback to current page is allowed only as an explicit
   fallback and must be written to the handoff manifest.
7. Preview and Record must use the same page-source timeline so the web
   designer receives media matching the previewed choreography.

This means the initial scroll implementation can be staged safely only if it
supports a current-page fallback and preserves schema fields for Page Bar
source/transition state. It should not lock the renderer to camera-only output.

## Definitions Still Needed Before Implementation Planning

The requirements doc is strong, but implementation planning still needs these
definitions hardened:

- `CaptureScrollTimelineV1`: exact schema fields, versioning, duration source,
  frame range representation, page source reference, camera path reference,
  anchor list, and fallback flags.
- `ScrollHandoffPackageV1`: manifest schema, required/optional files, package
  status states, hash policy, and relative path rules.
- Output profile IDs: stable IDs for MP4, WebM, Scroll-Friendly Video, and PNG
  Sequence, including default/advanced settings.
- FPS policy: whether 24 FPS remains allowed outside scroll or is hidden from
  scroll output.
- Page Bar override owner: which provider owns active page override and how it
  interacts with `EditorContext.selectedPageId`, `PageController.currentIndex`,
  and authoring preview state.
- Transition sampling contract: how a fixed frame time asks for source page,
  target page, transition progress, and resolved render graph.
- Package save API: how local dev can choose a folder, write multiple files,
  preserve partial output, and expose `Open Output`.
- Partial package semantics: exact rules for cancelling during frame rendering,
  encoding, poster/contact-sheet generation, and manifest finalization.
- Clean Render Mode checklist: named groups that must be hidden for scroll
  Record, including Capture Director UI, Camera Path overlay, lower timeline,
  page clip handles, debug diagnostics, and camera location markers.

## Suggested Readiness Gates For The Later Plan

No implementation plan is included in this audit. The later plan should not
start renderer work before these gates are explicit:

- source tests for `CaptureScrollTimelineV1` and `ScrollHandoffPackageV1`;
- runtime tests for 60 FPS normalized progress and frame range math;
- source guard proving scroll output does not depend on page IDs, page titles,
  page indexes, or live deck page pairs;
- Page Bar override design that is compatible with page transitions;
- external renderer job shape that can produce package files and PNG sequences;
- cancellation behavior that writes Partial Package status instead of deleting
  evidence;
- clean-render assertions for authoring chrome and Capture Director overlays.

## Non-Fixes In This Audit

- No source code changed.
- No Page Bar repair attempted.
- No renderer, encoder, or package implementation attempted.
- No visual browser verification performed.
- No unrelated dirty worktree files touched.
