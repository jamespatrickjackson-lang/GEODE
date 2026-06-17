# Scroll Animation Architecture Requirements

Status: requirements draft
Owner surface: Capture Director
Audience: GeoSee engineering, Capture Director operators, website production partners
Scope date: 2026-06-16

## Purpose

Capture Director needs a scroll animation export architecture that can produce
high-quality visual assets for a separate website build without making the
website part of the GeoSee app. The output must be usable by a web designer as
a production handoff package: scroll-timed media, timing metadata, poster
frames, diagnostics, and enough contract detail to bind website scroll progress
to the rendered GeoSee sequence.

The first production target is a cinematic, deterministic, 8K-class scroll
animation export. Browser-side website playback, page layout, content strategy,
and web implementation remain separate work.

## Existing Contracts To Preserve

- GeoSee active repo root remains `C:\GeoSee\GeoSee_Dev`.
- Capture Director is a marketing/directorial layer, not project truth.
- Capture Director choreography must not mutate `projects/*/pages/**`,
  `projects/*/project.json`, `projects/*/environment.json`, or overlay text as
  an implementation shortcut.
- Realtime capture remains preview-only. Final scroll animation output must use
  deterministic fixed-frame rendering.
- The local external renderer remains the preferred route for 4K-or-higher
  video output.
- Capture outputs, jobs, diagnostics, and generated media belong outside
  project/page data, using the existing `.tmp/capture-video-*` style lanes or a
  deliberate Capture Director output package folder.
- Generated visual assets must use changed filenames or explicit cache-busting
  query/version metadata.
- Authoring/debug overlays must be named, toggleable, and default off. They must
  not appear in final output unless explicitly selected as an export overlay.

## Goals

1. Produce a web-designer-ready scroll animation package from Capture Director.
2. Preserve deterministic visual output at exact render sizes up to 8K-class
   resolution.
3. Keep scroll timing, page timing, camera timing, and output media aligned by
   a single normalized progress contract.
4. Separate authoring preview from final output quality.
5. Make final output inspectable through diagnostics and contact-sheet review.
6. Avoid coupling website behavior to live GeoSee project files, disposable
   Utah FORGE page state, or internal editor state.

## Non-Goals

- No website repository, landing page, or scroll playback implementation in this
  requirements pass.
- No live WebGL embed requirement for the website.
- No automatic upload, CDN deployment, or web cache invalidation system.
- No project/page fixture edits to repair scroll animation behavior.
- No replacement of existing Capture Director realtime recording, Still
  Capture, Render Out, Camera Path, or Page Bar concepts.

## Core Definitions

- `Preview`: onscreen playback of the authored camera movement. Preview uses
  the active scene, Page Bar, Camera Path, render preset, and scroll timeline
  sample, but does not create final media, write an output package, or start the
  local external renderer.
- `Record`: full final Render Out for scroll animation. Record creates a clean
  output package after the operator accepts the centered export popout.
- `Clean Render Mode`: the final-output state that hides Capture Director-only
  and editor-only elements before rendering. This includes camera path rails,
  camera-location markers, handles, helper labels, timeline aids, Capture
  Director panels, editor buttons, popouts, and debug overlays unless an
  explicit export-overlay option is selected.
- `Render Out`: the only user-facing output role. Format and quality choices
  control what Render Out produces.
- `Format`: the selected output kind: MP4, WebM, Scroll-Friendly Video, or PNG
  Sequence.
- `Quality`: the selected output resolution preset, from 1080p through
  8K-class output when the active render route supports it.
- `Scroll-Friendly Video`: a video encoded with more seek points than a normal
  playback video so website scroll interactions can jump through the animation
  more smoothly.
- `PNG Sequence`: one rendered PNG per output frame, packaged with manifest and
  diagnostics for design tools, review, and downstream encoding.
- `Frame Range`: the portion of the 60 FPS timeline selected for Render Out.
  Frame inputs are zero-based and inclusive: frame `0` is the first frame, and a
  10 second 60 FPS full render spans frames `0..599`.
- `Partial Package`: a cancelled or failed output package that keeps safely
  written frames, diagnostics, and any valid playable media while marking the
  package incomplete.
- `Complete Package`: an output package with a valid manifest, selected media or
  frame sequence, diagnostics, handoff README, and any requested poster/contact
  sheet files.

## Recommended Output Type

The primary handoff should be a `ScrollHandoffPackageV1` folder containing:

- `scroll-manifest.json`: timing, media, dimensions, progress anchors, and
  diagnostics references.
- `scroll-master.mp4`: visually approved master video, encoded for broad review
  and fallback delivery.
- `scroll-master.webm`: supported high-efficiency web delivery encode when
  local encoder support is available and the operator selects WebM output.
- `scroll-friendly.mp4`: supported frequent-keyframe or all-keyframe encode
  for scroll-bound playback testing when the operator selects Scroll-Friendly
  Video output.
- `frames/`: supported deterministic PNG frame sequence for lossless design,
  contact-sheet, and post-production handoff when the operator selects PNG
  sequence output.
- `posters/`: selected PNG poster frames at major scroll anchors.
- `contact-sheet.png`: one image showing key frames across the scroll timeline.
- `capture-diagnostics.json`: render settings, renderer path, scene/sample
  metadata, elapsed time, warnings, and output hashes.
- `README.md`: plain handoff notes for the web designer, including intended
  scroll duration, anchor labels, and recommended playback usage.

The manifest plus media package is the product. Lottie is not the primary
format because GeoSee scroll animation is camera, material, shader, scene, and
page-transition driven rather than vector-animation driven.

## Resolution And Quality Requirements

- The architecture must support exact 8K UHD output at `7680 x 4320`.
- The architecture should support long-edge `8192` output presets when aspect
  ratio permits.
- The renderer must use deterministic fixed-frame sampling, not realtime
  `requestAnimationFrame` timing.
- Preview and Render Out should default to 60 FPS.
- Future FPS choices should stay mathematically clean against 60 FPS: 30 FPS,
  60 FPS, and 120 FPS are allowed candidates. The timeline must store seconds
  and normalized progress so frame ranges can be transformed cleanly if another
  supported FPS is added later.
- Render size, FPS, frame count, duration, capture mode, render preset, codec,
  and output filename must be recorded in diagnostics.
- Final 4K-or-higher output must prefer the local external render path.
- Browser FFmpeg can remain available for smaller or shorter preview-class
  deterministic exports, but it must not be the ceiling for final 8K output.
- Final output must fail clearly when the requested resolution exceeds the
  available render route. Silent downsampling is not allowed.
- A lower-resolution preview file may be generated, but it must be labeled as a
  preview and must not replace final Render Out media.

## Scroll Timeline Model

Capture Director should introduce a versioned scroll timeline contract:
`CaptureScrollTimelineV1`.

Required timeline fields:

- `schemaVersion`: fixed version string, initially `capture-scroll-timeline-v1`.
- `durationSeconds`: rendered animation duration.
- `fps`: deterministic frame rate.
- `progressRange`: normalized scroll progress, always `0..1`.
- `anchors`: named progress points for website/content alignment.
- `segments`: authored scroll sections, each with progress start/end, optional
  label, page clip reference, camera path reference, overlay state, and easing.
- `captureMode`: scene-only, scene plus annotations, presentation UI, or other
  supported deterministic mode. Full UI remains invalid for deterministic final
  output unless a later decision creates an explicit display-capture route.
- `renderPreset`: the effective Capture Director render preset.
- `outputProfile`: format, resolution, codec, bitrate target, and keyframe
  strategy.

The normalized progress contract is the website handoff boundary. Website code
can bind scroll position to `progress` without needing GeoSee internals.

## Timeline Ownership

- Page Bar remains the scene/page datum.
- Camera Path remains the camera spine.
- Scroll Timeline composes Page Bar plus Camera Path into a website-oriented
  progress map.
- Scroll Timeline does not own raw page state or rewrite project pages.
- Page timing and camera timing must sample from the same deterministic clock.
- Empty Page Bar state may fall back to current-page capture only when the
  manifest records that fallback explicitly.

## Page Bar Authoring Requirements

The Scroll Animation Page Bar is an authoring timeline, not a project-page
persistence surface.

- `Add Page` must open an explicit searchable list of visible pages. It must not
  silently insert the current first/default page. The picker floats centered
  above the bottom bar and scrolls internally when visible pages exceed viewport
  height.
- Double-clicking a Page clip label must open the same page picker and replace
  only that clip's page source while preserving the clip's timing.
- Clicking a Page clip selects it. Delete or Backspace removes the selected clip
  only when the Page lane has focus and no text entry is active.
- Page Bar timing labels are frame-primary at the Scroll Animation FPS. The
  default editing rate is 60 FPS, and duration labels include seconds in
  `x.xx s` form.
- Each Page clip should fill the Page lane and show start frame, end frame, and
  duration. Double-click on those values opens compact numeric frame entry.
- The ruler should expose readable frame ticks and snap points that adapt to the
  total duration. Short Scroll Animation timelines use 0.1-second subdivisions,
  and ruler lines extend behind the Page and Camera Path bars.
- Manual playhead placement is live preview authority. Clicking empty
  timeline/grid space, the time axis, or a Page clip must place the Scroll
  Animation playhead at the clicked frame and sample the Page Bar scene source
  before Camera Path pose. Double-click page-name and timing editors must keep
  editor behavior and must not scrub.
- `Play` starts from the current Scroll Animation playhead when it is inside the
  selected frame range; otherwise it starts at the selected range start. `Pause`
  freezes the sampled page state, and `Stop` clears the capture page-source
  preview and restores normal authoring state.
- Manual frame edits and drags must stay local: no global ripple edit is
  allowed. A boundary operation may affect only the two adjacent clips sharing
  that boundary.
- Visual mockups for alternate timeline treatments are deferred and are not part
  of this slice.

## Handoff Manifest Requirements

`scroll-manifest.json` must be valid JSON and include enough information for a
website designer to use the media without opening GeoSee.

Required manifest sections:

- `package`: package id, created timestamp, GeoSee project id, operator label,
  and cache-busting package version.
- `media`: relative paths, MIME types, dimensions, duration, FPS, codecs, file
  sizes, hashes, and intended usage.
- `progressAnchors`: named anchor labels with normalized progress, frame index,
  timecode, and optional poster frame path.
- `recommendedPlayback`: normal video, scroll-friendly video, PNG sequence, or
  hybrid.
- `visualContract`: aspect ratio, safe crop notes, text/overlay inclusion, and
  background/alpha expectations.
- `diagnostics`: diagnostics file path, warning count, render route, and render
  preset.
- `sourceContract`: Capture Director recipe id/path if exported, Page Bar state
  reference, Camera Path state reference, and render recipe version.

## Format Profile Definitions

Format choices should stay simple in the default Record popout. Advanced
encoding controls should be hidden behind an `Advanced` button.

- MP4: default broad-compatibility Render Out video. Quality choices should
  include 1080p, 1440p, 4K, 6K, and 8K when available. Advanced options include
  bitrate, codec profile, GOP/keyframe interval, silent-track policy, and
  filename suffix.
- WebM: web-delivery Render Out video. Quality choices should include the same
  resolution ladder when encoder support is available. Advanced options include
  codec choice, bitrate, keyframe interval, and filename suffix.
- Scroll-Friendly Video: Render Out video tuned for scroll-controlled seeking
  on a website. Quality choices should include at least 1080p, 1440p, and 4K,
  with 6K/8K allowed only when practical. Advanced options include dense
  keyframe interval, all-keyframe mode, seek-test metadata, bitrate, and
  filename suffix.
- PNG Sequence: Render Out as one PNG per frame. Quality choices should include
  1080p through 8K when available. Advanced options include frame filename
  template, frame number padding, contact-sheet generation, poster-frame
  generation, and manifest-only retry.

## Export Package Naming

Every package should use a stable but cache-safe name:

```text
geosee-scroll-<project>-<sequence-label>-<yyyymmdd>-<hhmmss>-<short-hash>/
```

Generated media inside the package should include either the package hash or a
version suffix:

```text
scroll-master-8k-<short-hash>.mp4
scroll-master-8k-<short-hash>.webm
scroll-friendly-4k-<short-hash>.mp4
scroll-manifest-<short-hash>.json
```

The manifest may also expose a query-string cache key for website systems that
prefer stable filenames:

```json
{
  "cacheKey": "20260616-shortHash"
}
```

## Codec And Media Requirements

- MP4 output should remain the broad-compatibility default for designer review.
- WebM output may be generated for high-efficiency web delivery when local
  encoder support is available.
- A Scroll-Friendly Video should use dense keyframes or an all-keyframe strategy
  when practical, because scroll-bound video seeking is keyframe-sensitive.
- PNG frame sequences should be available as a high-quality fallback for design
  tools, contact sheets, and downstream encoding.
- Alpha-channel delivery is not required for the first pass. If needed later,
  it should be a separate explicit output profile.
- HDR/EXR output is not required for the first pass. If added later, it must be
  opt-in and diagnostics must record color pipeline assumptions.

## Render Route Requirements

- `ScrollRenderJobV1` should extend the current external video render job
  pattern instead of creating a separate renderer family.
- The local dev server route should create a render job, poll status, support
  cancellation, and expose output download URLs.
- Cancellation must stop the renderer process, not only mark UI state as
  cancelled.
- The renderer must write diagnostics beside the output media.
- The renderer must support synthetic smoke jobs for fast validation.
- The renderer must verify that final output is a non-empty media file or frame
  sequence before marking a job complete.

## Capture Director UI Requirements

The first UI surface should be a dedicated Scroll Animation container in the
Capture Director bar, not a website builder. This container is a peer to the
existing Capture Director production controls and owns scroll preview, record,
format selection, save targeting, and package-output status.

Required primary controls:

- `Play`: preview the scroll timeline onscreen using the current scene, Page Bar,
  Camera Path, anchors, and render preset. The lower timeline footer Play uses
  this Scroll Animation preview, not Camera Path-only playback.
- `Pause`: pause onscreen Scroll Animation preview without changing authored
  timeline state.
- `Stop`: return preview to the selected start frame or normalized progress
  anchor.
- `Record`: open a centered popout for final output setup. The lower timeline
  footer red record button opens this Scroll Record popout; Camera Path preview
  recording stays in the Camera Path panel controls.
- `Open Output`: open the last completed output package when available.

The Play button is a preview action for camera movement. It should not create
final media files, write package outputs, or start the local external renderer.
The Record button is the output action. It opens the export popout before any
final render starts.

## Record Popout Requirements

The Record popout should appear centered over the active viewport and should
block accidental Capture Director edits until accepted, cancelled, or closed.
It should summarize the selected Scroll Animation source, current duration,
current FPS, current render preset, and estimated frame count.

Required first-step choices:

- format: MP4, WebM, Scroll-Friendly Video, or PNG Sequence
- quality: 1080p, 1440p, 4K, 6K, or 8K when available
- range mode: `Full video` or `Frame range`
- frame range start and end inputs when `Frame range` is selected
- save destination

Each simple choice should show a one-sentence explanation below the control:

- Format explanation: what type of file or frame package will be produced.
- Quality explanation: expected sharpness, file size, and render-time impact.
- Range explanation: full timeline or a selected portion of the 60 FPS timeline.
- Save explanation: where the completed output package will be written.

The popout should include an `Advanced` button. Advanced options are hidden by
default and become visible only after that button is selected.

The output format selection must progressively reveal only the options relevant
to that format.

Format-specific options:

- MP4: resolution, FPS, quality/bitrate preset, codec profile, audio
  none/silent-track policy, and optional poster/contact-sheet generation.
- WebM: resolution, FPS, quality/bitrate preset, codec choice when
  available, alpha disabled by default, and optional poster/contact-sheet
  generation.
- Scroll-Friendly Video: resolution, FPS, keyframe strategy, all-keyframe or
  dense-keyframe interval, and seek-test metadata.
- PNG Sequence: resolution, frame padding, frame filename template,
  transparency disabled by default, contact-sheet generation, and optional
  package manifest-only mode.

Required save and acceptance controls:

- output package name
- save destination picker
- filename preview
- estimated output contents
- estimated frame count and render size
- short explanation under each visible simple choice
- `Advanced` disclosure button for bitrate, keyframes, filename pattern, codec,
  encoder, and package-detail controls
- `Accept and Render`
- `Cancel`

The save destination must be explicit before final output starts. If the File
System Access picker is unavailable, the fallback must create the package in the
Capture Director output lane and expose an `Open Output` or download link after
completion.

Validation requirements:

- frame range start must be less than or equal to frame range end
- frame range must stay within total timeline frame count
- selected format must have a valid output route
- selected resolution must have a valid render route
- selected save destination must be writable or must fall back to the output
  lane with a visible warning
- 4K-or-higher final output must prefer the local external renderer
- 8K output must fail clearly if exact-size output cannot be produced

Required controls:

- output package name
- duration
- FPS
- resolution preset, including 4K, 8K UHD, and custom exact size
- media format selection: MP4, WebM, Scroll-Friendly Video, and PNG frame
  sequence
- keyframe strategy for Scroll-Friendly Video output
- Page Bar source selection
- Camera Path source selection
- anchor editor with progress, label, and poster-frame capture
- preview action
- final render action
- cancel render action
- open output package action
- centered Record popout action
- save destination picker
- format-specific option disclosure

Required status surfaces:

- current render route
- progress by frame and phase
- current output path
- diagnostics path
- warnings and hard failures
- final package summary
- range mode and selected frame range
- selected format and revealed format options
- save destination and package path

## Preview And Record Behavior

- Play preview should use the same `CaptureScrollTimelineV1` sampling contract
  as final output.
- Play preview should run at the global 60 FPS timeline rate.
- Play preview must display the current progress, frame, anchor label, and
  elapsed preview time.
- Play preview must not persist package outputs.
- Record must open the centered popout every time unless a later explicit
  repeat-last-settings shortcut is added.
- Record must not start rendering until `Accept and Render` succeeds.
- Record must automatically enable Clean Render Mode before final frames are
  sampled.
- Accepted Record output must create a `ScrollHandoffPackageV1` folder, not a
  loose media file.
- Cancel during render must stop the active renderer and mark the package as
  cancelled or incomplete in diagnostics.
- Cancel during frame rendering should keep already rendered frames in a Partial
  Package when they are safely written.
- Cancel during encoding should keep source frames when available and keep any
  valid playable partial media, but the package must remain incomplete.
- A completed package must expose the output folder, manifest, primary media,
  posters/contact sheet when selected, and diagnostics.

## Visual And Art-Direction Requirements

- Final scroll animation output must be driven by render presets, camera paths,
  page/scene transitions, and explicit Capture Director recipe state.
- Visual quality must favor stable composition, smooth motion, readable data,
  and cinematic framing.
- Contact sheets must make it easy to review the scroll journey without loading
  the full media.
- Poster frames must be captured at named anchors, not arbitrary frame guesses.
- Debug overlays, camera rails, spline controls, labels, timeline aids, and
  authoring handles must be excluded by default.
- Any explicit export-overlay option must be recorded in the manifest and
  diagnostics.

## Website Handoff Requirements

The web designer should receive a package that can be used without GeoSee app
runtime knowledge.

The handoff README must state:

- intended scroll behavior: scroll-controlled, autoplay-on-scroll, or hybrid
- recommended media asset for first integration
- fallback media asset
- poster frame paths
- progress anchor labels
- duration and frame rate
- safe crop or text-safe notes
- known warnings

The handoff contract should avoid prescribing the website framework. It should
work for a custom site, GSAP ScrollTrigger, native scroll timelines, React, or a
static web build.

## Diagnostics Requirements

Diagnostics must include:

- package id and output profile
- effective render resolution
- FPS, duration, and total frame count
- capture mode
- render preset
- source Page Bar and Camera Path identifiers
- renderer route: browser, local external, synthetic, or manual job
- codec and encoder settings
- output filenames and hashes
- warning list
- cancellation/failure reason when applicable
- elapsed render and encode times

Diagnostics should include enough render-stack evidence for visual bug follow-up
when map, terrain, raster, or material output is involved: effective texture
URL, bounds, material preset, public clip state, material edge fade state, edge
outline state, and active render preset.

## Verification Requirements

Required checks for the first implementation pass:

- source test for the `CaptureScrollTimelineV1` schema boundary
- runtime test for normalized progress to deterministic frame-time mapping
- runtime test that Page Bar plus Camera Path sample one timeline clock
- source guard that scroll animation state does not write project/page fixtures
- local renderer smoke that posts a job, polls status, downloads output, and
  confirms non-empty media
- diagnostics test that output profile, render route, dimensions, FPS, duration,
  and warnings are recorded
- package integrity test for manifest paths and referenced media files

Visual acceptance must remain separate from static checks. Without browser or
human visual inspection, the correct status is `ready for visual check`.

## Risks And Controls

- Risk: 8K output exceeds GPU or browser limits.
  Control: route 4K-or-higher final output through the local external renderer
  and fail clearly if exact-size output cannot be produced.

- Risk: Scroll-Friendly Video seeks poorly in the website.
  Control: generate a denser keyframe strategy or frame-sequence option.

- Risk: final media drifts from authored preview.
  Control: sample preview and final output from the same normalized scroll
  timeline contract.

- Risk: Capture Director state leaks into project/page fixtures.
  Control: keep scroll state in recipe/session/job/package files only.

- Risk: old generated files stay cached in browser or design tools.
  Control: changed filenames, package hashes, and cache keys are required.

- Risk: website partners need a simpler handoff.
  Control: package README, poster frames, contact sheet, and progress anchors
  are mandatory.

## Phase 1 Deliverable

Phase 1 should produce requirements-backed architecture and a minimal package
contract:

- `CaptureScrollTimelineV1` schema draft
- `ScrollHandoffPackageV1` manifest draft
- deterministic render job shape for scroll output
- output folder/package naming rules
- acceptance tests for schema, package integrity, and no fixture writes
- no website implementation

## Phase 2 Deliverable

Phase 2 should add operator-facing Capture Director controls and local render
output:

- Scroll Animation container in the Capture Director bar
- onscreen Play/Pause/Stop preview controls
- Record button and centered output popout
- anchor editor
- 8K Render Out
- WebM delivery encode
- Scroll-Friendly Video dense-keyframe encode
- PNG frame sequence package
- save destination picker and output package creation
- poster and contact-sheet generation
- package README generation
- local renderer smoke verification

## Phase 3 Deliverable

Phase 3 should harden production handoff quality:

- repeat-last-settings workflow if Phase 2 usage proves it useful
- Scroll-Friendly Video seek-test diagnostics
- package integrity and hash validation
- richer format-specific encoder options
- richer diagnostics
- visual QA checklist
- sample handoff package for website production review
