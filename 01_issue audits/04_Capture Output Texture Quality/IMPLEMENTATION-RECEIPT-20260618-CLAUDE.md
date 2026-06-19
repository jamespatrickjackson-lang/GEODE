# Capture Output Quality — Implementation Receipt (#1, #2, #3)

Date: 2026-06-18
Status: implemented; static + source tests pass; live visual acceptance pending.
Decision: DEC-176. Plan: `lets-plan-for-1-rippling-liskov.md`.

> Phase 2 (grade modes + tiled-seam removal + session hold) is recorded at the
> bottom of this file under "Phase 2 — DEC-177".

All render-time changes are capture-fidelity-lock scoped and restored on exit, so
the live view and its VRAM are unchanged. The lock
(`beginCaptureFidelityLock`/`waitForCaptureFidelityReady`/`endCaptureFidelityLock`)
is shared by every deterministic capture type, so the fixes apply to Still,
external/tiled Still, Render Out, Render Path Video, and Scroll Animation.

## #1 Topo ortho mipmaps + anisotropy
- `src/topoMap/surfaceRuntime.ts`: `configureTopoTexture` takes
  `captureFullResolution` and enables mipmaps + max anisotropy regardless of POT;
  `setCaptureFullResolution` reconfigures the already-loaded ortho + detail
  textures (defeats the path-unchanged early-return).

## #2 Scene-wide capture fidelity
- `src/scene/SceneManager.ts`: `setCaptureFullResolution` is now a coordinator
  (`captureFidelityActive` flag + `captureFidelityLoadPromises`); iterates
  per-layer `userData.captureFidelityUpgrade`, forces seismic `source` tier (incl.
  volume) and max raymarch `uSampleSteps`, and the per-frame seismic LOD driver
  holds `source` (no transient downgrade) while active.
  `waitForCaptureFullResolution` awaits topo + all upgrader promises.
- `src/loaders/drapedCaptureFidelity.ts` (new) + geology/claim/trees loaders:
  register a capture upgrade that toggles mipmaps + anisotropy on the draped
  texture.
- Data-tier (regen-gated): `src/loaders/loadScalarVolume.ts` consumes an optional
  Float32 `files.volumeHigh` as a capture-tier swap (no-op without the asset);
  `prep/build_utah_forge_mt_volume_products.mjs` emits `volume_high.f32` +
  manifest `files.volumeHigh`.

## #3 Capture AA: MSAA + optional supersample
- `src/scene/postprocessing.ts`: `PostHandle.setCaptureMultisample(samples)` sets
  WebGL2 MSAA on the composer RTs; `src/scene.ts` toggles it in the lock with the
  sample count budgeted by render-pixel count (8 up to ~1440p, 4 up to 4K, 0
  above ~4K), restored to 0 on exit.
- Supersample: `src/capture/captureResolution.ts` keeps the memory-safe
  7680x4320 render cap and adds `clampCaptureSupersampleScale`;
  `deterministicStillExporter` + `deterministicFrameSequenceExporter` drop the
  supersample ban, clamp the scale so the internal render stays within budget
  (4K -> 2x, 8K -> 1x), render at `output x scale`, and high-quality downscale
  (`imageSmoothingQuality = "high"`).

## Scroll / headless render coverage
Scroll Animation and 4K+ Render Out render headless via
`tools/render-capture-video-job.mjs` (scroll uses `--reuse-frames`), which renders
each frame in tiles through `window.__geoseeCaptureStillRenderer.renderTile` ->
`exportDeterministicStillTile` -> `beginCaptureFidelityLock`. So #1 (topo
mipmaps), #2 (seismic source / volume steps / draped re-bake) and #3a (MSAA, per
tile, budgeted by tile size) all apply to scroll output. The headless renderer
does its OWN supersampling via `--superscale` (default 2x; tiled render + Lanczos
downscale), independent of the in-app `recipe.supersampleScale`.

Second bug fixed: the in-app supersample state was threaded into the recipe, but
both headless tools (`render-capture-video-job.mjs`,
`render-capture-still-job.mjs`) previously threw on `recipe.supersampleScale !==
1`, so picking 2x would crash every headless job (4K+ video, scroll package, 8K
still). The tools now normalize `recipe.supersampleScale` to 1 (they do their own
`--superscale`) instead of throwing. Verified: a `supersampleScale: 2` still job
renders (640x360 synthetic) and video job renders 3 frames, both exit 0.

Per-tile screen-space post (audit T1: vignette grid + seams) applies to the
headless tiled render as before; unchanged by this work, still a known limitation.

## Bug fix (black screen at 4K 2x / no capture at 8K)
Cause: the first cut applied MSAA 8 unconditionally and removed the render cap,
so 4K@2x and 8K both rendered 7680x4320 with 8-sample HalfFloat x2 targets
(~4 GB) -> framebuffer allocation fails -> black / no capture. Fix: budget MSAA
by render pixels (0 above ~4K) and clamp supersample to the 7680x4320 render
budget. Verified live: budget yields 4K-2x=0 and 8K=0 samples; a render at
7680x4320 with MSAA 0 returns non-black pixels with `glError 0`, and the live
profile restores. tsc + `capture-director-source.test.mjs` (59/59) pass.
  `CaptureDirectorProvider` un-pins `setSupersampleScale` and threads the state;
  `CaptureDirectorToolbar` exposes Off/2x in Render Out + Still.
- Data-tier (regen-gated): NAIP ortho prep resamples with Lanczos.

## Verification done
- `npx tsc -b --force`: pass.
- `npm run check:workspace`: pass (editor control manifest guard pass — capture UI
  not manifest-gated).
- `node tests/tools/capture-director-source.test.mjs`: 59/59 (updated the
  supersample-UI assertion to the DEC-176 contract).

## Verification pending (operator / live)
- Live `window.__scene` checks during a still: ortho mipmaps/anisotropy on;
  composer RT `samples > 0`; seismic `seismicProductLodTier === "source"`; volume
  `uSampleSteps` at max; all restored after capture.
- Visual A/B still + one Render Out clip.
- Asset regeneration for the data-tier items (MT `volume_high.f32`, Lanczos NAIP)
  — runtime safely no-ops until those assets exist.

---

# Phase 2 — DEC-177 (grade modes, tiled-seam removal, session hold)

Status: implemented; tsc + source + runtime tests + still self-test pass; grade
mechanism verified live. Plan: `lets-plan-for-1-rippling-liskov.md`.

## Capture grade modes (this is the real T1 fix)
- `recipe.captureGradeMode: "clean" | "baked"` (default `"clean"`; validation
  tolerant of older recipes) — `captureTypes.ts`, `captureRecipe.ts`; threaded in
  `CaptureDirectorProvider.tsx` (state/ref + recipe builders + load + context);
  selector in `CaptureDirectorToolbar.tsx` (Render Out + Still).
- `PostHandle.applyCaptureCleanGrade(tiled)` / `clearCaptureGrade()`
  (`postprocessing.ts`): snapshot-once then zero the post-recoverable lensGrade FX
  (vignette, grain, chromatic aberration, distortion, frame, guides, halation,
  anamorphic streak, gate-weave, diffusion, sharpen) and disable bloom/DOF/
  afterimage (+ SMAA when tiled); keep color grade + SSAO + tone map; full restore.
- `scene.ts`: `beginCaptureFidelityLock({ gradeMode })` applies clean; the grade is
  re-asserted each frame in `renderCaptureFrame` (so per-frame applyEnvironment
  can't re-enable FX); `endCaptureFidelityLock` clears + restores. Exporters pass
  `recipe.captureGradeMode`.
- Result: Clean Master leaves NO per-tile screen-space FX -> tiled output (headless
  4K+/scroll/8K external) is seam-free. Baked Look = WYSIWYG (tiled may seam).

## Capture-session hold (per-tile thrash)
- `beginCaptureSession`/`endCaptureSession` on `window.__geoseeCaptureStillRenderer`
  (`CaptureDirectorProvider.tsx`) wrap `beginCaptureFullResolutionAssets` +
  `waitForCaptureFidelityReady` + `endCaptureFullResolutionAssets` (existing
  ref-count). Headless tools (`render-capture-video-job.mjs`,
  `render-capture-still-job.mjs`) hold one session around the tile/frame loop, so
  the heavy fidelity (seismic source, MT high-precision volume, draped re-bake)
  runs once, not per tile.

## Feasibility matrix (route x size x supersample)
| Route | 1080p/1440p | 4K | 4K @2x | 8K | 8K @2x |
|---|---|---|---|---|---|
| In-browser still (single surface) | OK, MSAA 8 | OK, MSAA 4 | OK (render 7680, MSAA 0) | OK (render 7680, MSAA 0) | clamps to 1x |
| Headless tiled (Render Out 4K+, scroll, 8K external still) | OK | OK | OK (own 2x superscale) | OK | clamps to 1x |
| Realtime preview | live renderer — excluded by design | | | | |
- MSAA budget: 8 (<=~1440p px), 4 (<=4K px), 0 (>~4K px). Supersample clamped so
  internal render <= 7680x4320 (memory-safe). Headless does its own `--superscale`
  (default 2x) and normalizes `recipe.supersampleScale` to 1.
- Capped (clamped, never attempted/black): 8K+2x (16K internal), 8K MSAA.
- Clean Master seam-free on every route; Baked Look tiled = faint seam (documented).

## Verification
- `npx tsc -b`; `npm run check:workspace`; `capture-director-source.test.mjs` (added
  grade-selector assertion) and `capture-director-runtime.test.mjs` pass.
- `render-capture-still-job.mjs --self-test`: real headless 7680x4320 PNG via the
  session hold + Clean Master path (exit 0).
- Live `window.__scene.post`: forced authored vignette 0.95/grain 0.2/bloom/
  afterimage -> `applyCaptureCleanGrade(true)` zeroes all FX, disables bloom/DOF/
  afterimage/SMAA, KEEPS color grade -> `clearCaptureGrade()` restores all. No
  console errors.

## Still out of scope / future
- 16-bit/EXR/log capture (canvas is 8-bit; needs a HalfFloat readback path).
- Baked-Look tiled seam removal (Clean Master is the seam-free path).
- Data-tier asset regeneration (MT `volume_high.f32`, Lanczos NAIP) — no-op until built.
