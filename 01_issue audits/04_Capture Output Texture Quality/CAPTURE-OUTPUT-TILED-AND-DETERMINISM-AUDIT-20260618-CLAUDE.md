# Capture Output Quality — Tiled Still + Determinism Audit

Date: 2026-06-18
Author: Claude (Opus 4.8)
Status: Audit complete (read-only). No code changed.
Fourth doc in the capture-output-quality set. Covers two areas the texture /
pipeline / render-post audits did not: the **tiled still route** and **capture
determinism** of time-based effects.

## Finding T1 — HIGH (tiled route only): per-tile screen-space post → vignette grid + seams

The external / tiled still route renders each tile through the FULL post chain
sized to the tile, using the tile's own 0–1 UV space. Every screen-space post
effect is therefore computed per tile, not per full frame, and tiles are
stitched with zero overlap. Result: a regular grid of artifacts across the
stitched image.

Evidence:
- Tiling uses `camera.setViewOffset(fullW, fullH, tile.x, tile.y, tile.w, tile.h)`
  then renders via `renderCaptureFrame` → `post.composer.render()`
  (`src/capture/deterministicStillTileExporter.ts:125-136`). The composer is
  sized to the TILE (`beginCaptureFidelityLock` → `beginCaptureSize`), so all
  post passes see `vUv` 0..1 across the tile.
- Tiles are zero-overlap by contract:
  `tools/render-capture-still-job.mjs:63` throws unless `tile.overlapPixels === 0`;
  `computeTilePlan` slices a grid of default 1920×1080 tiles (:13-14,:169-195).
- Stitch is a plain `sharp` composite of the PNG tiles (:5); NO post is
  re-applied to the full image after stitching.

What breaks per tile (`src/scene/postprocessing.ts`, lens grade shader):
- **Vignette** (`vec2 d = vUv - 0.5; ... c *= vignette`, :367-370, default
  `vignetteStrength 0.95`): every tile darkens toward its own center → a grid of
  vignettes. Visible even with default grade.
- **Lens distortion / chromatic aberration** (radial from `uv-0.5`, :182-196):
  radial centre per tile → discontinuities at every seam.
- **Film grain** (`rand(floor(vUv * resolution / grainSize) ...)`, :372-375):
  `resolution` is tile size → grain pattern resets each tile.
- **Presentation frame, corner fade, guides** (:231-304): computed in tile UV →
  wrong placement, repeated per tile.
- **Tilt-shift** band centred on tile centre (:60-84).
- **UnrealBloom**: highlight spill that should cross a tile boundary is clipped
  at the tile edge → bloom discontinuity at seams.
- **SMAA**: morphological AA has no neighbour context across the zero-overlap
  seam → a faint AA seam line on every tile boundary.

Scope / trigger:
- In-app 8K tries a single render surface first; tiling is the FALLBACK when the
  size exceeds GPU limits (creates a `CaptureStillRenderJobV1`). On a
  16384-maxTextureSize GPU, 7680×4320 fits in one surface, so the in-app path is
  unaffected and the single-frame vignette/post is correct.
- The EXTERNAL still command (`node tools/render-capture-still-job.mjs ...`,
  `docs/capture-director/README.md` "External Still Command") and any
  size-exceeds-limit fallback ALWAYS tile → always carry this artifact.

Remediation (tiled route):
- Correct architecture: render tiles WITHOUT screen-space post (RenderPass +
  tone map / sRGB only), stitch to a full-resolution buffer, then run the post
  chain ONCE on the full image. Heavy but the only seam-free answer.
- Cheaper interim: make the screen-space passes tile-aware by feeding a
  full-frame UV remap (`(tileOffset + vUv*tileSize)/fullSize`) into vignette,
  distortion, CA, grain, frame, and guides; bloom/SMAA still need halo/overlap
  tiles or a post-stitch pass, so disabling bloom + using overlap is the
  pragmatic seam reducer.
- Minimum stopgap: for the tiled route, disable vignette / frame / guides / grain
  / distortion / CA / tilt-shift and accept bloom/SMAA seam softness, OR require
  the single-surface path for any GPU that supports the full size.

## Finding T2 — POSITIVE: time-based effects are deterministic in capture

Time-driven post and atmosphere read the threaded frame clock, not a wall clock,
so video frames and stills are reproducible:
- `renderCaptureFrame` passes the deterministic time into the manager:
  `manager.frameUpdate(camera, timeMs)` with `timeMs = timeSeconds * 1000`
  (`src/scene.ts:816,825`).
- Grade `time` uniform (drives gate-weave, film-grain phase):
  `updateCinematicPostFrame(nowMs)` sets `gradePass.uniforms.time.value =
  nowMs / 1000` (`src/scene/SceneManager.ts:5128-5132`), `nowMs` threaded from
  `frameUpdate(camera, nowMs)` (:5694).
- Cloud/atmosphere drift uses `nowSeconds = nowMs / 1000` from the same threaded
  clock (`src/scene/atmosphere/localAtmosphereVolume.ts:606-634`).

No determinism defect here. (The afterimage accumulation buffer noted in the
deep review is a separate, history-dependent concern — it is stateful across
renders, not wall-clock driven.)

## Finding T3 — VERIFY: transition clocks vs deterministic frame time

`SceneManager` drives transition progress from `performance.now()` start-time
deltas in many places (`:1264,:2286,:3248,:3493,:4783`). For a still of a settled
page, or video that applies settled per-frame page state via the deterministic
exporters (`applyRecipeLayerState` / Page-Bar page-source sampling), this is not
exercised. The open question is a video frame rendered while a live page/scene
transition is mid-flight: progress would track wall time, not `timeSeconds`.
Verify whether the Render Out / scroll path can sample a frame during a live
transition; if so, transition-state-by-wall-clock is a determinism risk for
those frames. Likely already avoided by settled per-frame application — confirm,
do not assume.

## Confirmed NOT problems

- `preserveDrawingBuffer` is not set, but capture does `renderCaptureFrame()` then
  `drawImage(getCanvas(), ...)` synchronously in the same tick, so the WebGL back
  buffer is intact at copy time (`deterministicStillExporter.ts:185-190`).
- Camera-path preview frames render outside the composer at JPEG q0.76
  (`scene.ts:834-901`) — intentionally a low-cost monitor preview, NOT an output
  path; not a quality defect.
- Single-surface still post (vignette etc.) is correct — the per-tile artifact is
  unique to the tiled route.

## Priority placement (relative to the other three docs)

- T1 is HIGH but route-scoped: it only bites the external/tiled still path. If
  final 8K marketing stills go through the external command, it is a top fix; if
  they always use single-surface in-app 8K, it is latent.
- T2 is a clean pass (no action).
- T3 is a verify item before relying on mid-transition video frames.

## Verification hooks (read-only)

- Tiled post: render an external still at a size forcing ≥4 tiles and inspect for
  a vignette grid / seams; compare to the single-surface in-app still of the same
  pose.
- Zero overlap: `grep -n overlapPixels tools/render-capture-still-job.mjs`.
- Determinism: `grep -n "uniforms.time.value" src/scene/SceneManager.ts` and
  confirm `nowMs` provenance via `frameUpdate`.
