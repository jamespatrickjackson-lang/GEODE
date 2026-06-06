# Visual Review Current

Status: active lightweight loop for visual alpha work

## Purpose

Use this file only when a visual issue needs human judgment before expensive automated tests. Keep it short and current.

The operating loop is:

```text
narrow patch
-> capture one focused screenshot or viewport state
-> human visual judgment
-> iterate from that judgment
-> run build / targeted checks after the visual direction is right
```

## Current Visual Contract

- Goal: make Utah FORGE visual/topo/editor/cinematic changes converge by direct human review before slow smoke tests.
- Current focus: Utah FORGE visual/editor convergence, including seismic figure annotations, Site Details/topo alignment, Camera Studio, Post Processing, Topo Environment grouping, and cloud/sun/fog visual controls.
- Accepted decisions:
  - Top-level editor containers are peers when they represent real workflows or tools.
  - Container shape, fill, spacing, and contrast should come from shared editor tokens.
  - Page Manager keeps compact page-list spacing; full-panel end padding belongs to the scroll extent.
  - Page Manager row actions use the accepted Global Settings add-button
    geometry: 28px target, 14px centered icon, opaque tinted fill, and no
    row-specific surface switching. Reorder uses the rightmost horizontal grip
    with a floating preview and before/after insertion line.
  - Viewport legends should be lightweight overlays unless a specific tool requires a card/backplate.
  - Viewport legend edge anchoring, stack spacing, circular toggle rows, overlay text-color mapping, slider variables, and MT ramp handle sizes are captured in `docs/dev-context/UI-Visual-Standards.md`.
  - `MT Cell Points` uses the compact quick-legend rule from `UI-Visual-Standards.md`: title toggles only the full-density point cloud, `Full Cloud` and `Spectrum` are exclusive modes, Full Cloud hides the spectrum and scalar edge-line overlays, and Spectrum owns threshold/filter controls.
  - Spectrum-authored MT Cell Points pages must load their scalar window and edge-line detail immediately from Global Settings/page 00. That preview-environment load path is guarded in the Utah FORGE preview field map; visual review should not accept a page that needs a Full Cloud/Spectrum click to reveal authored Spectrum detail.
  - During page-to-page navigation, MT Cell Points mode buttons must reflect the target authored mode, not the transient ramp interpolation. Spectrum pages with line controls on must show scalar edge-line detail through the full-density scalar transition, not by a final-commit pop or a manual mode click.
  - Settled page loads may rebuild MT Cell Points Spectrum edge lines by refreshing only the full-density point-cloud style. A broad final page visibility/style replay is not acceptable because it can make overlays jump.
  - Topo graticules are depth-tested reference lines, not through-scene overlays.
  - Public topo surface colour defaults now use the named `Utah` material preset:
    khaki desert lows, muted sage/tree middle elevations, and warm snow/rock
    high peaks.
  - Topo Environment is a Topo-owned container with Scene atmosphere, Clouds,
    Sun, and Fog. Fog and map fog belong there with the cloud and sun controls.
  - The current Utah FORGE one-puff `Topo test cloud` is visible and was
    accepted by the human in this thread. Its runtime texture source is
    `generated-canvas`, not an external asset.
  - Sun visual authoring separates light-source effects from visible sky
    imagery. The visible orb/halo/source marker can be hidden while terrain
    light remains active.
  - Site Details and `GDR 1255 Station Locations` have independent `Align to
    topo` toggles. Utah FORGE defaults them on; the rendered position follows
    terrain exaggeration and surface lift while the original source Z remains
    the fallback when topo is hidden.
  - Seismic product labels are source-backed and grouped by line family /
    processing stage. Figure annotations are an authored presentation overlay
    for section products, not a replacement for source product names.
  - Section ISO overlay opacity is composed from authored opacity, transition opacity, and threshold-surface attenuation; Section ISO roots crossfade on page transitions when bands/lines enter, exit, or change geometry.
  - Compatible section-frame page changes slide/interpolate; incompatible helper states crossfade by outgoing snapshot plus incoming fade.
  - Camera Studio is split from Post Processing. Camera Studio owns render preset, lens types/FOV, and double-click focus timing.
  - Post Processing owns Depth of Field, Tilt-Shift, Post Production, Image finish, Glow, Film / Optics, Motion Trails, Composition Guides, Presentation Frame, and Contact Depth.
  - Depth of Field is split into `Focus Target`, `Blur Strength`, and `Focus Debug`; it supports page-target, camera-object, manual-distance, and picked-point focus modes.
  - Page-local cinematic post values blend through `main-camera/cinematic-post`; toggles, focus mode, and debug helpers remain discrete.
  - Composition guide and presentation-frame line thickness defaults to `lineThickness: 0.25`, half of the earlier guide/frame width.
  - Human visual judgment is the first acceptance filter for composition.
  - Utah FORGE deck composition notes must describe app-level behavior and
    visual review status, not disposable page ids, page order, or fixture names.
    Page JSON, project order, environment fixtures, and archive entries are
    authoring state and must stay outside runtime/UI implementation guidance.
- Still wrong / under review:
  - The expanded cinematic toolset is implemented and ready for ongoing human visual tuning. Do not mark a look final from static checks alone.
  - The committed Utah FORGE deck savepoint is ready for visual check; static
    page/build checks do not accept the page look.
  - If the running in-app browser still shows an old `Focus / DOF` heading or thick guide/frame lines, hard-refresh the current `5173` tab before diagnosing code. A stale Vite module graph can preserve old labels after source changes.
  - Base GUI local atmosphere volume remains a generic sample. Utah FORGE's
    visible test cloud was accepted in this thread, but any new Base GUI-specific
    composition still needs its own visual check.
  - Final sidebar polish and toolset grouping remain iterative.
  - Legend panel behavior has a first implementation pass: sequenced per-container left slide, row gap closure after exit, row opening before entry, and MT resistivity fixed at the bottom. It remains under human visual review.
  - Zoom-out camera far-plane clipping is being handled before the oblique longitude/latitude grid line artifact. The grid line issue remains held until clipping is verified visually.
  - `npm run check:utah-runtime` currently stops in `check:utah-derived` on
    `utah-forge-topo-clouds registration`. Treat this as the active derived
    asset registration blocker until resolved; narrower runtime asset and MT
    resistivity checks can still pass.
- Do not revisit unless asked:
  - Intake directives or intake drops for normal software-build work.
  - Full broad Utah FORGE smoke runs during visual iteration.
  - Killing or restarting the user's `5173` app session unless a stale dev-server/module state blocks visual validation and the active process is confirmed to be running from `C:\GeoSee\GeoSee_Dev`.

## Screenshot Path

Use this path for the latest focused screenshot when a visual judgment is needed:

`docs/dev-context/Visual-Review/current.png`

If multiple references are needed, use concise names in the same folder, for example:

- `docs/dev-context/Visual-Review/current-before.png`
- `docs/dev-context/Visual-Review/current-after.png`

## Agent Rules

- Prefer the user's running app on `5173` for human review.
- If an agent needs a separate dev server, use a free port such as `5174`.
- Do not run `Launch GeoSee.bat`.
- Do not kill port `5173` for convenience. If stale module state blocks visual verification, first hard-refresh the browser; only restart after confirming the process belongs to the active repo.
- Before running Playwright for a visual issue, capture or present a visual state for human review unless the issue is purely structural.
- Keep Playwright to quick scene-state probes or targeted tests after the visual direction is approved.

## Verification Defaults

After the visual direction is accepted, use:

- `npm run build`
- `node tools/validate-artifact-metadata.mjs --project projects/utah-forge`
- `node tools/report-project-artifact-coverage.mjs`
- one targeted Utah FORGE Playwright test or a cheaper scene-state probe only when needed
