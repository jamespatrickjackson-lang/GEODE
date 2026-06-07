# Capture Director Production Notes

Capture Director separates four workflows:

- Realtime Capture: fast MediaRecorder preview.
- Render Out: deterministic frame-sequence video export.
- Still Capture: exact-size deterministic still export, including 8K.
- Camera Path: recipe-owned path authoring with scene overlay and preview monitor.

## Camera Path Workflow

Camera Path uses `CaptureCameraPathV3` as the editable authoring model. Loaded
V2 path files still upgrade in memory, and legacy `cameraKeyframes` remain
export compatibility data, not the UI source of truth.

An empty path is a valid draft. It lets Still Capture and Render Out use the
current scene camera without creating an invalid recipe path. Recipe save/load
includes `cameraPath: null` until the path has authored, enabled, renderable
nodes.

The Camera Path panel is organized as editor-style bars:

- Path Controls: show path, add current camera, add transition node, play,
  pause, record preview, and clear.
- Camera Views: numbered line items such as `01`, `02`, and `03`.
- Look And Focus: selected-row look mode and recipe-local focus binding.
- Options: overlay color, size, ray, label, frustum, and preview-monitor
  controls.
- Path Files: save/load path JSON without touching project files.

Each camera-view row owns its own active state, overlay-hidden state, node kind,
hold time, look mode, focus binding, jump action, current-camera update action,
and delete action. Keyframe rows may hold. Transition rows shape the path but
cannot hold, so their hold time is always zero.

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

The lower timeline is a full-width authoring timeline. It shows the ruler,
playhead, scrubber, hold blocks, transition blocks, position lane, look lane,
and focus lane. Scrubbing updates the scene overlay sample, look/focus rays,
and preview monitor using the same sampling path used by Render Out.
Hold and transition block edge handles are draggable duration controls; edits
update the recipe-owned path state and reflow the timeline without touching
page camera fields.

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

V3 separates temporal easing from geometric fairing. Temporal easing controls
speed, acceleration, deceleration, and ramp profile along the path. Geometric
continuity controls rail shape through nodes using surfacing language such as
`G0`, `G1`, `G2`, `G3`, and `Gd` influence distance. Focus distance and aim
geometry are a third independent track.

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

No path video is written to disk while frames are rendering or FFmpeg is
encoding. The output exists only after encoding completes, then the Camera Path
panel exposes explicit save/download controls. `Save Rendered Video` uses the
browser File System Access picker when available; otherwise the download link is
the fallback. Long 4K MP4 encodes report elapsed encoding time and a clear
"no file has been saved yet" status so a slow encode is not confused with a
completed save.

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
