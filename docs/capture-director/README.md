# Capture Director Production Notes

Capture Director separates four workflows:

- Realtime Capture: fast MediaRecorder preview.
- Render Out: deterministic frame-sequence video export.
- Still Capture: exact-size deterministic still export, including 8K.
- Camera Path: recipe-owned path authoring with scene overlay and preview monitor.

## Page Bar And Camera Spine Timeline

The Page Bar is the scene datum for Capture Director. It choreographs the
presentation/page sequence without making Camera Path own page state. Camera Path is a separate spatial camera spine: it controls camera pose, focus, FOV,
and camera timing while the page track controls scene/page state.

Both tracks sample one shared capture timeline clock. The lower timeline keeps
that relationship visible through a Pages lane, a Camera Path lane, and a Time
Graph lane. The Pages lane shows page clips and local page timing. The Camera
Path lane shows camera holds and transitions. The Time Graph lane shows timing
curves without becoming a separate state owner. Position, G, Gd, Aim, and Focus
diagnostics are hidden by default and remain marketing-setup-only.

Page Bar editing is frame-primary for Scroll Animation authoring. `Add Page`
opens an explicit searchable page picker centered above the lower bar, and
double-clicking a clip page label opens the same picker to replace that clip's page without
changing its timing. Selected Page clips can be removed with Delete or Backspace
while the Page lane has focus and no text field is active. Page clips fill the
available Page lane, show start frame, end frame, and duration as frames plus
seconds, and double-clicking those frame values opens compact numeric entry. The
timeline grid spans behind the lanes with 0.1-second snap subdivisions at the
default 60 FPS editing rate. The grid counts from the 0s line, so each second
has ten 0.1-second intervals and its major tick lands exactly on the seconds
axis. The time axis and vertical grid lines remain visible; only the old
horizontal scrub slider is absent. The playhead is a single vertical line.
Clicking empty timeline rail space, the time axis, or a Page clip places the
Scroll Animation playhead at the clicked frame. That manual placement samples
the Page Bar scene state and Camera Path pose the same way `Play` does; it is
not just a marker move. Double-click page-name and timing editors keep editor
behavior and do not scrub.
The lower footer transport belongs to this Scroll Animation clock: its Play
and Pause actions preview the Page Bar plus Camera Path contract, and its red
record action opens the Scroll Record popout. Camera Path-only play and preview
recording remain in the Camera Path panel controls.
Timing edits clamp to the local clip boundary: start/end changes may adjust only
the immediately shared neighbor, while explicit boundary drags tune only that
two-clip boundary. There is no global ripple edit and no project/page fixture
write.

Render Out and rendered path video may sample the Page Bar and Camera Path
together at fixed frame time. Empty Page Bar state falls back to current-page
capture. The long-term external frame queue uses the same contract: queue
Page Bar plus Camera Path frame references, render exact-size frames, then
compile those frames into the chosen media format without mutating project
fixtures.

Scroll Animation treats Page Bar clips as page-authored scene-state sources.
They are not labels and they are not camera drivers. At every sampled frame the
Page Bar applies the selected page's effective visibility, styles, page scene,
and overlays; Camera Path then applies the camera pose. Page cameras from the
sampled pages are ignored in this workflow so the path remains the spatial
authority.

> Note (DEC-175, implementation in progress): the Page Bar drives the runtime
> page and its scene transition independent of Camera Path validity, but it is a
> scene-state track only — page-authored cameras are always ignored here. Camera
> authority is the Camera Path when authored; with no valid path the current/live
> camera is held (no automatic move on a page change). Preview drives on the
> Camera Path duration when a path exists, else the Page Bar duration; record and
> export stay bound to the Camera Path (a longer Page Bar is clipped, not an
> error). Current builds still gate Page Bar runtime drive behind a renderable
> Camera Path until that change lands; see
> `01_issue audits/02_Capture Director Page Bar/`.

For development tracing, inspect both runtime seams from the browser console:

```js
window.__captureDirectorScrollPreview?.getState()
window.__pageController?.getState().capturePageSourcePreview
```

The first trace reports the current scroll frame, Page Bar sample, Camera Path
sample time, and preview state. The same JSON is mirrored into the hidden
DEV-only DOM node `data-testid="capture-scroll-preview-trace"` for browser
automation when page globals are isolated. The second trace reports the resolved
source and target page ids, the selected authoring page id, the applied page id,
transition progress, and whether capture page-source preview is active. These
page-source fields are also mirrored into hidden DEV-only DOM node
`data-testid="capture-page-source-preview-trace"`. These handles are DEV-only
and read-only.

## Scroll Animation Output

The Scroll Animation panel is a peer Capture Director production area
(`CaptureDirectorPanel = "scroll-animation"`). The lower footer transport drives
its preview: `Play`/`Pause`/`Stop` sample the Page Bar plus Camera Path through
`CaptureScrollTimelineV1`, and the red record action opens the centered Scroll
Record popout. Preview never writes files; Record produces a package.

`CaptureScrollTimelineV1` is the deterministic scroll contract: `fps` (30 or 60,
default 60), `durationSeconds`, normalized progress, a zero-based inclusive
frame `range`, Page Bar `pageSource`, Camera Path `cameraSource`, and `anchors`.
120 FPS is not supported. Frame ranges store seconds/progress so a frame range
derives cleanly from the selected FPS.

The Record popout selects output through a **Formats checkbox list**: tick any
combination of `MP4`, `WebM`, `Scroll-Friendly Video`, and `PNG Sequence`. The
request carries every ticked format in `CaptureScrollRecordRequestV1.formats`
and derives a single primary `format` by render priority
(`mp4 > scroll-friendly-video > webm > png-sequence`). Quality is `1080p`,
`1440p`, `4K`, `6K`, or `8K`; Range is full video or an inclusive frame range;
the popout also takes a save destination and package name, with per-format
Advanced fields revealed only for ticked formats.

`Accept and Render` validates the request, then the local renderer **renders
frames once and encodes each ticked video format from that shared frame pass**
(`render-capture-video-job.mjs --reuse-frames`), so the scene renders a single
time regardless of how many formats are selected. Output is a
`ScrollHandoffPackageV1` folder with `media[]` (one entry per ticked video
format: `primary` MP4, `delivery` WebM, `scroll-friendly` MP4), a PNG `frames/`
sequence when PNG Sequence is ticked, posters, a contact sheet, diagnostics, a
handoff README, and per-file hashes. Cancelled or failed runs keep safely
written files and mark the manifest `partial`/`cancelled`/`failed`.

When the Page Bar spans multiple pages, the request carries a
`scrollPageRenderPlan` (one inclusive frame segment per page) so the package is
page-range-aware and a deterministic multi-page renderer can drive per-frame
page application. Per-frame page application during the headless render itself
remains a runtime extension that must be visually verified against a multi-page
project; the preview path already applies per-frame page source live.

Scroll packages and Render Out videos default under `media_output/`
(`media_output/capture-scroll-outputs`, `media_output/capture-video-outputs`),
resolved against the repo root (`C:\GeoSee\GeoSee_Dev\media_output`). The
operator can override the scroll save destination in the popout. `media_output/`
is gitignored.

The dev-only package endpoints are `/api/capture/scroll-package/start`,
`/status`, `/cancel`, `/availability`, and `/api/capture/scroll-package-output`.
The Node-side contract mirror in `plugins/scroll-package-contract.ts` is kept in
parity with the browser `src/capture/` contracts by a guard in
`tests/tools/capture-director-source.test.mjs`.

## Camera Path Workflow

Camera Path uses `CaptureCameraPathV3` as the editable authoring model. Loaded
V2 path files still upgrade in memory, and legacy `cameraKeyframes` remain
export compatibility data, not the UI source of truth.

An empty path is a valid draft. It lets Still Capture and Render Out use the
current scene camera without creating an invalid recipe path. Recipe save/load
includes `cameraPath: null` until the path has authored, enabled, renderable
nodes.

The Camera Path panel is organized as editor-style bars:

- Path Controls: show path, add current camera, add transition node, Camera
  Path-only play, pause, record preview, Orbit 360, and clear.
- Camera Views: numbered line items such as `01`, `02`, and `03`.
- Look And Focus: selected-row look mode and recipe-local focus binding.
- Options: overlay color, size, ray, label, frustum, and preview-monitor
  controls.
- Path Files: save/load path JSON without touching project files.

Each camera-view row owns its own active state, overlay-hidden state, node kind,
hold time, look mode, focus binding, jump action, current-camera update action,
and delete action. Keyframe rows may hold. Transition rows shape the path but
cannot hold, so their hold time is always zero.

Adding the current camera opens a pointer-anchored kind picker instead of
silently choosing a type. `Keyframe` creates a hold-capable camera view.
`Transition` creates a no-hold path-shaping node. The same kind picker is used
from the lower Camera Path lane.

`Orbit 360` attaches to the selected keyframe. It bakes a horizontal full orbit
as transition nodes after that keyframe, returns to the same camera pose at the
end of the orbit, and reconnects any existing next camera so later positions
continue from the returned pose. The default button path uses 12 authored
transition samples so V3 playback stays visually circular instead of cutting
across four broad quarter-turns. The orbit uses linear timing.

Transition containers live between line items. A `Transition 01 -> 02`
container owns that segment's active state, overlay-hidden state, transition
duration, easing, and selection. Disabled rows or transitions remain editable
but are excluded from playback, Render Out, Still Capture path sampling, and
legacy keyframe export. Hidden rows or transitions remain active in the path
but are omitted from the authoring overlay unless ghost display is enabled.

Playback and realtime path recording use the same V3 playback validation as
deterministic export. Empty, all-disabled, broken-route, and zero-duration paths
do not start playback or recording; the panel shows the missing requirement
instead. A valid path samples by deterministic timeline time, not request-
animation-frame deltas.

The lower timeline is a full-width authoring timeline. It shows the ruler, a
single vertical playhead, hold blocks, transition blocks, position lane, look
lane, and focus lane. The former horizontal scrub slider is intentionally absent;
the time axis, grid lines, and vertical playhead remain the timing reference.
Hold and transition block edge handles are draggable duration controls; edits
update the recipe-owned path state and reflow the timeline without touching
page camera fields.

Camera Path junction markers sit on the lower Camera Path lane. Keyframes are
white triangles; transition nodes are white circles. Double-clicking a junction
opens a compact picker to convert that node between keyframe and transition
without changing project/page fixtures.

## V1/V2 Finish Status

The V1/V2 finish pass stabilizes the current production scope without adding
future V3 surfacing controls. Verified coverage now uses focused browser specs
instead of one monolithic timeout-prone smoke:

- load: project readiness, launcher, docked workflow panels, open/close;
- realtime: scene canvas, composited marketing canvas, display/tutorial
  capture, empty-output failure handling, and cleanup;
- render/still: page-range controls, render/still resolution separation,
  still save options, and 8K external job fallback;
- camera path: empty-path guards, numbered rows, transition containers,
  focus lock, preview monitor, Play Path scrub advance, and close cleanup.

Record Path Preview starts realtime recording only after v2 playback validation
passes, then starts path playback after the recorder is armed. Invalid paths do
not start `MediaRecorder`. Selecting focus-lock on a row creates a deterministic
recipe-local focus point from the row target when no picked focus point exists;
scene picking can replace that point later.

## Camera Path Overlay

Camera-path authoring uses a scene overlay that exists only while Capture
Director is open. The overlay renders the sampled path, keyframe and transition
nodes, target/focus markers, look rays, optional frustum preview, and current
timeline sample.

The visible path and rays use Three.js `Line2`, `LineGeometry`, and
`LineMaterial` so line width is screen-space and resolution-aware. Track color,
selected color, target color, focus color, line size, handle scale, ray length,
labels, frustum, and preview monitor mode are Capture Director path/recipe JSON
state. They are not page or project fixture state.

The overlay and preview monitor are authoring aids. They are excluded from
scene-only, scene-annotations, presentation-ui, Render Out, and Still Capture
outputs unless a future explicit export-overlay option is added.

## Camera Path V3 Surfacing

Current Capture Director authoring state upgrades loaded v2 paths into
`CaptureCameraPathV3` in memory. V2 remains load-compatible, and saved recipes
can still emit legacy `cameraKeyframes`, but V3 is the runtime surfacing model
for playback, scrub preview, deterministic Render Out, and Still Capture camera
sampling.

V3 separates temporal timing from geometric fairing. Capture Director authoring
forces transition timing to linear for both segment easing and `timeCurve`.
Geometric
continuity controls rail shape through nodes using surfacing language such as
`G0`, `G1`, `G2`, `G3`, and `Gd` influence distance. Focus distance and aim
geometry are a third independent track.

The authored transition `timeCurve` remains the motion authority for imported
path data, but Capture Director normalizes edited and newly authored
transitions to `linear`. The runtime adds only a bounded motion guard: identity
on calm geometry, deceleration into sharp travel corners, and mid-segment
compression for large look-direction flips and near-focal orbits. Guard warps
are monotonic and endpoint-exact, and there is no boundary stage that rewrites
the linear authoring rule.

Transition containers expose `Timing`, `Path Shape`, `Aim`, and `Overlay`
controls. The lower timeline surfaces temporal ramp, continuity, `Gd`, and
focus/aim metadata while still using the same fixed-time V3 sampler as Render
Out and Still Capture.

The implementation and agent guardrails are documented in
`docs/capture-director/camera-path-surfacing-model.md` and
`docs/capture-director/agent-guide-camera-path-surfacing.md`.

Equation overlays that show labels such as `A`, `T`, `D`, `G`, `Gd`, tangent
handles, curvature combs, influence handles, focus vectors, and speed ramps are
authoring aids. They stay out of Render Out and Still Capture unless a future
explicit export-overlay option is added.

## Camera Path V3.1 Node-Owned Spline Controls

V3.1 repairs the original one-sided fairing model. Segment `pathFairing` fields
remain in JSON for compatibility, but runtime geometry reads node-owned
`splineControls`. Each node owns an incoming handle and an outgoing handle.
Each segment resolves its curve as:

```text
from.position -> from.outHandle -> to.inHandle -> to.position
```

This matches common DCC spline editing behavior. `Tangent` coupling keeps the
incoming and outgoing handles collinear through the selected node while still
allowing each side to have an independent length. Pulling either side changes
both adjacent curve sides. `Non-tangent` coupling breaks the handles so pulling
one side affects only that adjacent segment. `Vector` mode is the hard-corner
authoring mode and behaves as `G0` unless the node is converted back to auto or
manual handles.

Node rows expose the spline mode, coupling, continuity class, and in/out handle
lengths. Camera Path Options expose `Show Spline Controls`, `Show XYZ Handles`,
and the default handle coupling. Scene overlay spline handles are authoring
controls only. XYZ handles are the only spline-authoring control that moves a
camera node position; G-continuity, tension, and handle pulls must not move
authored node positions.

V3.1 samples runtime rails through an effective Bezier-handle resolver. `G1`
keeps tangent-coupled handles collinear at shared nodes. `G2` solves bounded
in/out handle-length ratios to reduce curvature discontinuity at the node.
`G3` applies an additional bounded fairness pass to reduce curvature-flow
spikes across neighboring segments. These passes change only effective handles
used for sampling and preview; they do not rewrite authored node positions,
hold durations, transition durations, or temporal easing.

Unsafe Gx edits are guarded. If a manual or automatic handle creates non-finite
samples, derivative reversal, non-monotonic progress, excessive chord-envelope
exit, or loopback risk, Capture Director damps the effective handles and reports
diagnostics on the transition row. If the requested class cannot be stabilized,
the solver downgrades in order from `G3` to `G2` to stable `G1` auto handles and
shows the effective continuity class. This warning path is authoring feedback
only; Render Out and Still Capture still use the same stabilized effective rail.

Realtime path video recording lives in the Camera Path panel. It uses the same
preview recorder as Realtime Capture, supports the preview presets up to 4K,
plays the authored path, stops recording when playback reaches the end, and
shows the path-video download beside the path controls. Deterministic Render
Out remains the final-quality video export path.

## Capture Job Runtime And Rendered Path Video

Capture Director now has an in-memory Capture Job Runtime for production
capture work. Jobs track kind, status, progress, output, cancellation, and
diagnostics for realtime preview, path preview, deterministic video, rendered
path video, still capture, and external still jobs. Job state is runtime-only:
it is never written to page files, project files, overlays, browser storage, or
recipe JSON.

Camera Path has two separate video actions:

- `Record Path Video` records a realtime WebM preview through MediaRecorder.
- `Convert Preview to MP4` transcodes that preview WebM through the browser
  FFmpeg runtime after recording. It is a separate job because browser
  `MediaRecorder` cannot be trusted to provide MP4 capture consistently.
- `Render Path Video` renders the authored path through deterministic fixed
  frames, max-detail capture fidelity, and the FFmpeg frame-sequence encoder.

Rendered path video uses the current page, current capture mode, current render
resolution, current FPS, current MP4/WebM format, and the resolved
`CaptureCameraPathV3` timeline duration. It rejects Full UI because Full UI is
display/tutorial capture, not app-owned deterministic scene rendering. Page
range path rendering remains a later extension.

No path video is written to disk while browser frames are rendering or FFmpeg
is encoding. Browser output exists only after encoding completes, then the
Camera Path panel exposes explicit save/download controls. `Save Rendered
Video` uses the browser File System Access picker when available; otherwise the
download link is the fallback. Browser FFmpeg now reports frame-writing,
encoding, and finalizing progress, and a stalled encode fails cleanly instead
of leaving the UI in an indefinite encoding state.

4K final video is not browser-first. When Render Out or Render Path Video is
configured at 4K or higher in the local dev app, Capture Director posts a
`CaptureVideoRenderJobV1` to the dev-only local renderer endpoint. The Vite
dev server spawns `tools/render-capture-video-job.mjs`, writes the MP4/WebM
under `.tmp/capture-video-outputs/`, and reports the output path, diagnostics
path, elapsed time, and download URL back to the Capture Director job runtime.

The JSON job is now fallback/export evidence, not the normal result of pressing
Render. It is produced only when the local renderer endpoint is unavailable or
when an operator explicitly needs to run the job by hand. Manual execution from
the repo root remains:

```powershell
node tools\render-capture-video-job.mjs --job path\to\job.json --out path\to\output.mp4
```

The video tool also supports a synthetic fixture path for quick verification:

```powershell
node tools\render-capture-video-job.mjs --job tests\fixtures\capture-video-render-job-v1.json --out .tmp\capture-video-self-test.mp4 --synthetic
```

The local external route renders deterministic frames outside the live browser
UI, encodes through local FFmpeg (`ffmpeg-static`, `FFMPEG_PATH`, or `ffmpeg`
on PATH), and writes `<output>.capture-diagnostics.json`. It is the intended
route for final 4K page-sequence and camera-path marketing videos.

This pass intentionally avoids long Playwright and browser visual QA runs.
Source/runtime checks and build output make the feature ready for visual check;
manual browser verification remains the visual acceptance step.

## 8K Still Capture

Still Capture first attempts exact-size browser rendering through the live app.
For 8K (`7680 x 4320`), browser or GPU limits may block a single render surface.
When that happens, Capture Director creates a `CaptureStillRenderJobV1` JSON
file instead of downsampling or creating a failed image.

The external job preserves:

- project slug and page id;
- capture recipe and camera path;
- requested output width and height;
- still type and quality;
- tile size and zero-overlap tiling;
- max-detail no-downsampling fidelity.

The job never writes `projects/*/pages/**`, overlays, environment files, visual
presets, or editor dirty state.

## External Still Command

Run the external tiled renderer from the repo root:

```powershell
node tools\render-capture-still-job.mjs --job path\to\job.json --out path\to\output.png
```

For WebP or JPEG output, use `.webp`, `.jpg`, or `.jpeg` and ensure the job
still type matches. The tool also supports:

```powershell
node tools\render-capture-still-job.mjs --job tests\fixtures\capture-still-render-job-v1.json --out .tmp\capture-still-self-test.png --synthetic
node tools\render-capture-still-job.mjs --self-test
```

The real app route launches headless Chromium, opens the app URL stored in the
job or supplied by `--app-url`, waits for `window.__geoseeCaptureStillRenderer`,
renders projection-offset tiles, stitches them with `sharp`, encodes the final
image, and writes `<output>.capture-diagnostics.json`.

## Verification Language

Static checks, source tests, build output, and Playwright smoke prove code and
browser automation health. They do not prove final visual correctness. Use
`ready for visual check` unless the running browser has been visually inspected
or a human confirms the rendered result.
