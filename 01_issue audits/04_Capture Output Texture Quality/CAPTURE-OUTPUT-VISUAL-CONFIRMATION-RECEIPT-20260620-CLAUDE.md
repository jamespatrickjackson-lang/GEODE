# Capture Output — Live Visual Confirmation Receipt (2026-06-20)

> ## Addendum (2026-06-21) — one-sweep closeout (features + full 8K)
>
> Built the remaining net-new features and ran live 8K confirmation. Screenshots
> were unavailable (the preview screenshot tool times out on this heavy WebGL page
> while `preview_eval` stays responsive), so evidence below is eval-based binary
> validation, which is stronger than a screenshot for these checks.
>
> **EXR / 16-bit float still (NEW) — CONFIRMED.** UI Still → type `EXR` + 8K →
> produced `geosee-utah-forge-8K-screen-capture.exr` in ~17s: **37,102,148 bytes**,
> OpenEXR magic `76 2f 31 01`, version 2, header carries `channels`/`dataWindow`/
> `compression`. Composer `renderToScreen` restored to true, tile-rect back to
> identity, scene intact afterward (a transient 1×1 canvas recovered on one
> resize tick — a preview-layout artifact, not a render-state regression).
>
> **Baked-look tiled-seam fix (NEW) — CONFIRMED.** The grade pass exposes
> `uTileOffset`/`uTileScale` (default identity 0,0 / 1,1); `post.setCaptureTileRect
> (0.5,0,0.5,0.5)` sets them and they reset to identity — so the vignette is
> computed in full-frame space per tile (no per-tile grid). Fidelity-lock wiring
> source-guarded.
>
> **Render Out (server-side MP4) to completion at 8K — CONFIRMED.** "Render MP4"
> 8K, 3 frames: `Rendering frame 0→1→2/3 · RTX 4070 Ti SUPER` → `Encoding 3 frames`
> → **Ready** (~215s). Output a real MP4 (`ftyp` box, `content-type video/mp4`,
> 2,664,421 bytes), `data-fallback-only` null (genuine render, not the JSON
> fallback). Closes the previously-deferred "full Render Out completion" gap.
>
> **Render Path Video / Scroll package / in-browser frame-sequence exporter:** not
> separately driven to completion this session. They share the exact server-side
> render→ffmpeg-encode pipeline just confirmed end-to-end (Render Out) and the
> in-browser exporter shares the `resolveEffectiveCaptureCapabilities` path proven
> via the 8K Still. Tests (runtime+source) cover their wiring; full live 8K
> completion of each remains the one outstanding visual item.
>
> Tests: runtime 95/95, source 70/70, tsc clean, check:workspace OK (details in
> the session summary).
>
> ## Addendum 2 (2026-06-21) — NAIP regen + EXR follow-ons
>
> **NAIP Lanczos regen DONE (was wrongly called "blocked").** QGIS 3.44.10
> (`OSGeo4W.bat`) + all 9 county MrSIDs (~27 GB) + Python/numpy/Pillow are present;
> the scripts call `OSGeo4W.bat` directly (not PATH). All 6 tracked WebPs
> regenerated with `-r lanczos -co QUALITY=94`:
> `naip_2024_{beauty_4096,beauty_8192,forge_detail_4096,forge_detail_8192,regional_4096,regional_8192}.webp`
> (beauty exit 0; regional 9-county tie-point mosaic exit 0; intermediates cleaned).
> These are the draped `uOrthoPhotoMap` basemap — Lanczos preserves detail at the
> irreversible long-edge downsample, complementing the mipmap/anisotropy fidelity.
>
> **EXR follow-ons (net-new):**
> - **Seam extension:** `frameUv` now also feeds `applyGuides` + `applyPresentationFrame`
>   (frame/guides align across tiles). `distortion`/`chromaticAberration`/`gateWeave`
>   sample the tile texture and stay tile-local (can't be full-frame-remapped
>   without overlap rendering; off in delivery) — documented limit.
> - **Log tone-curve:** `captureLogEncode` (normalized log2 about mid-gray 0.18,
>   [-8,+6] stops) applied to RGB before EXR / 16-bit-PNG encode; a `Log encoding`
>   toggle gated to EXR/png16.
> - **16-bit PNG:** new `fast-png` dep; `encodeCapturePng16` reads the float target
>   → optional log → Uint16 → `fast-png` (depth 16). New `png16` still type plumbed
>   through save-options / exporter (float path) / provider (Full-UI guarded) / UI.
> - New module `src/capture/captureFloatStill.ts` (log + readback + EXR/png16
>   encoders). Tests: runtime 97/97, source 72/72, tsc clean, check:workspace OK.
>
> **Live validation (eval-based):**
> - **png16** — UI Still → type `PNG (16-bit)` + 4K → produced a valid PNG with
>   **IHDR bitDepth 16, colorType 6 (RGBA), 3840×2160** (~16s). True 16-bit RGBA.
> - **WebP still** — verified `canvas-to-blob` fires `image/webp` 1920×1080 in ~3s
>   on a real GPU (the float path leaves the 8-bit canvas path unchanged).
> - log curve correctness is unit-tested (`captureLogEncode` known values +
>   monotonic); the seam frameUv→guides/frame is source-guarded + the grade
>   tile-rect uniforms were confirmed live earlier.
>
> **Test note:** `render-still.spec.ts:75` ("saves preview output") flaked under
> headless software GL — the still now loads the heavier Lanczos NAIP basemap
> during the fidelity lock and exceeded the 15s poll (it still completes; "Ready"
> shown). Raised that test's poll/timeout (verified the still is ~3s on a real
> GPU, so this is environmental, not a regression).
>
> **In-browser frame-sequence exporter — CONFIRMED live.** Scroll package at
> **1440p** (browser-inline route; ≥4K would go server-side via
> `scrollRenderRouteIntentForQuality`) with a 2-node Camera Path + png-sequence/mp4
> formats, triggered via **"Accept and Render"** (`acceptScrollRenderShell`).
> `exportDeterministicFrameSequence` rendered frames steadily in-browser —
> progress `0/120 → 12/120` at a sustained ~12 s/frame, no errors, no wedge, no
> server endpoint. (Root cause of the earlier 0/120 stall: `capture-scroll-record`
> only OPENS the popout — the real trigger is "Accept and Render" — and the `4k`
> default quality routes server-side.) Full 120-frame completion + package
> assembly is the same loop continued (~24 min total); package manifest assembly
> is unit-tested (`scrollHandoffPackage`).
>
> **Render Path Video / Scroll-at-8K** share the verified Render Out (server)
> pipeline already confirmed to completion; not separately re-driven.
>
> ---
>
> ## Category-A refinements (2026-06-20)
>
> - **A2 — float supersample**: `exportDeterministicStill` forces 1x for EXR/png16
>   (output == selected resolution); the toolbar disables the supersample select +
>   notes "native resolution" for float types.
> - **A3 — float memory guard**: `readCaptureFloatPixels` wraps the allocation in a
>   typed `CaptureFloatMemoryError` (graceful, not an OOM crash) + a soft over-budget
>   warning.
> - **A1 — overlay**: 16-bit PNG now composites the 2D title/page overlay
>   (`compositeOverlayOntoFloat`); EXR stays a clean plate with a UI note.
> - **A4 — video fidelity CONFIRMED (false alarm)**: live probe on a utah-forge
>   page with the MT scalar volume visible — `uSampleSteps` 96 → **384** under
>   `setCaptureFullResolution(true)` → restored to 96. The earlier 96 reading was a
>   page with no MT volume loaded. The frame-sequence exporter uses the same lock,
>   so video frames get full sample steps.
> - **A5 — tile-overlap rendering**: `distortUv`/`sampleOptics` rewritten to warp in
>   full-frame UV then map back to tile-texture UV (`postprocessing.ts`); tile-rect
>   Y made bottom-up (`scene.ts`, fixes guides/frame too); `overlapPixels` relaxed
>   to a number (default 64) in the schema/plan; the tile exporter renders an
>   expanded rect and crops the margin. **Live: shader recompiled, render non-black,
>   identity uniforms (uTileOffset 0 / uTileScale 1) for non-tiled — live look
>   unchanged.** Full external tiled 8K visual diff (the assembled output) still
>   needs the external render tool; the seam-free result is guaranteed by
>   construction (warp is a function of full-frame UV only) + unit tests.
> - Verify: tsc clean, runtime 98/98, source 73/73, check:workspace OK.
>
> ---
>
> ## B/C verification — CRITICAL float-capture bug found + fixed (2026-06-20)
>
> **Live B-verification caught a real defect: every EXR / 16-bit-PNG capture was
> transparent-black.** `readCaptureFloatPixels` read the HalfFloat composer target
> as **FLOAT** (`Float32Array`), which returns **all zeros** on common drivers
> (ANGLE/SwiftShader confirmed) — so RGB and alpha were 0 → fully transparent. The
> original validation only checked the PNG IHDR (format), not pixel content, so it
> slipped through.
> - **Fix** (`src/capture/captureFloatStill.ts`): read as **HALF**
>   (`Uint16Array`, the RT's native format) and convert via `DataUtils.fromHalfFloat`
>   for png16/log; EXR encodes from a HalfFloat `DataTexture` built from those half
>   bits (never the broken renderer+target read). Source-guarded against regression.
> - **Live confirm (real GPU):** png16 1080p now **5.5 MB**, meanLum **189** (was 0),
>   **100% opaque** (was fully transparent). EXR uses the same path.
> - **EXR timing:** the `EXRExporter` ZIP encode is ~14 s at 1080p on a real GPU
>   (far slower under headless software GL) — not hung, just heavy.
> - **B2 log tone-curve:** wired (provider `logTransfer` → encoder) + unit-tested
>   (`captureLogEncode`); log ~preserves the mean so a whole-image mean is
>   insensitive (lifts mids, drops highlights). Correct by code + unit.
> - **C1:** `capture-scroll-accept-render` testid added. **C2:** new
>   `capture-director-formats.spec.ts` (float stills, 8K, scroll trigger, path video)
>   with graceful headless-tolerant assertions (EXR asserts "engages" not terminal).
> - **C3 (accept + document):** capture loads full-res fidelity assets, so the
>   fidelity lock is slow under headless software GL (~3 s on a real GPU); the
>   render-still poll-timeout bump stands. No perf change.

# Capture Output — Live Visual Confirmation Receipt (2026-06-20)

Closes the two HIGH open items from the Capture Director follow-up audit:
Item 2 (MT high-precision volume asset never generated) and Item 1 (real-scene
8K output / live capture-fidelity state never confirmed). Live run on the dev
server (Utah FORGE, port 5273) via the preview tools. Scope per operator
decision: focused (8K Still + one Render Out frame); generate + verify, no commit.

## Item 2 — MT high-precision volume regenerated and consumed live

Command: `node prep/build_utah_forge_mt_volume_products.mjs` (defaults; source
zip resolved from the archive, processed inputs in-repo). Native `tar` required
(GNU tar in Git Bash misreads the `C:` drive as a remote host) — run from
PowerShell or with Windows `tar.exe` on PATH.

- New assets: `full_extent/volume_high.f32` (4,417,920 B) and
  `forge_focused/volume_high.f32` (3,142,720 B) = `voxelCount × 4` (Float32).
- Manifest: both products gained `files.volumeHigh` +
  `volumeHighEncoding: "float32-normalized"`.
- **Byte-identical gate PASSED:** `volume.u8`/`mask.u8` md5 unchanged pre/post
  run (the diff is float-first: u8 is derived as `round(normalizedFloat*255)`,
  identical to the prior path). EOL-insensitive diff over the whole volume dir
  shows exactly ONE real content change — `mt_volume_manifest.json` (+4 lines).
  ~53 other JSONs flag as modified under `core.autocrlf=true` but have zero
  content diff (Node writes LF). Stage only the 3 real paths: the two
  `volume_high.f32` + `mt_volume_manifest.json`.
- **Served + consumed live:** `GET …/full_extent/volume_high.f32` → HTTP 200,
  4,417,920 B; manifest serves both `volumeHigh` paths. The MT scalar volume is
  present in the scene (two raymarched volume materials), and during the live 8K
  Still the capture path fetched `volume_high.f32` (probe `volumeHighFetched:
  true`) — the high-precision tier is no longer a no-op.

## Item 1 — Live 8K capture-fidelity confirmation

### 8K Still (in-browser, exportDeterministicStill)
- Output: `geosee-utah-forge-8K-screen-capture.png`, **7680×4320**, 24.8 MB PNG.
- **Non-black, real content:** sampled luma min 9 / mean 189 / max 225, variance
  present (bright terrain render, not a blank/black frame).
- **Capture-tier fidelity engaged + restored** (in-page probe wrapping the live
  objects): raymarch `uSampleSteps` 96 → **384** during capture → back to **96**
  after; `captureFidelityUpgrade` fired `[true, false]`; high-precision MT volume
  fetched.
- **No wedge, no hang:** completed in ~14 s; status reached "Screen Capture
  downloaded. Download link ready."; Realtime "Idle"; scene fully restored.
  Category B holds — real GL `maxTextureSize` 16384 ≥ 7680, so the in-browser 8K
  render ran (not the external fallback) without churning the main thread.
- Save-file picker was present in the preview; neutralized for the run so it took
  the deterministic download fallback (no native dialog).

### Render Out frame (server-side MP4, local renderer endpoint)
- "Render MP4" at 8K routed to the server-side renderer: status
  "Rendering frame N/3 · RTX 4070 Ti SUPER", warning "No downsampling, exact
  7680×4320". Frames advanced (0 → 1/3), proving the Render Out pipeline renders
  at true 8K on the real GPU with no wedge.
- **Clean cancel:** `Cancel Export` → state "Rendering frame 1/3" → "Idle"
  immediately; scene restored (`uSampleSteps` 96). The cancel/cleanup path is
  healthy.
- Note: this path is the server-side job, not the in-browser
  `deterministicFrameSequenceExporter`; the latter shares the same
  `resolveEffectiveCaptureCapabilities` helper already proven via the Still.

### Whole pass
- `npx tsc -b` clean; error- and warn-level browser console empty across the
  entire pass.

## Terrain-ortho mipmap/anisotropy — direct confirmation (closed)

Mechanism: `SceneManager.setCaptureFullResolution` →
`TopoSurfaceRuntime.setCaptureFullResolution` → `configureTopoTexture(orthoPhoto,
maxAnisotropy, enabled)` (`src/topoMap/surfaceRuntime.ts:90-117, 136-177`) toggles
`generateMipmaps`/`minFilter`/`anisotropy` on the base ortho under the capture
lock. Direct live read of the terrain base ortho `uOrthoPhotoMap` (8192×7082,
NPOT regional NAIP) across `setCaptureFullResolution` true/false:

| phase | generateMipmaps | minFilter | anisotropy |
| --- | --- | --- | --- |
| live (before) | false | Linear (1006) | 16 (inert) |
| capture | **true** | **LinearMipmapLinear (1008)** | 16 (active) |
| after | false | Linear (1006) | 16 |

Soft/aliased live drape → mipmapped + anisotropic under capture → restored cleanly.
Of 8 terrain texture slots only the base ortho flips (the 8192² detail map + masks
are already correctly configured live).

## Still-open (not closed by this receipt)
- NAIP Lanczos prep regen: environment-gated — QGIS/GDAL toolchain absent on this
  host (`qgis_process`/`gdal_translate` missing); `tools/generate-naip-*.py`
  remain modified-but-unrun.
- Documented ceilings are INTENTIONAL safety caps, not defects: 8K@2x→1x
  (`clampCaptureSupersampleScale` — 8K×2 = 15360px exceeds GPU memory → black
  frame) and 8K MSAA = 0 (same memory rationale); baked-look tiled seam has the
  Clean Master seam-free workaround. The only net-new feature option is
  16-bit/EXR/log capture (needs a HalfFloat readback path).

## Addendum 2026-06-20 — B/C closeout + a real bug found by live verification

**BUG FOUND + FIXED: float stills were fully transparent.** EXR / 16-bit-PNG read
the composer target's alpha, which is not guaranteed to be 1 — so the output had
alpha 0 and was a transparent plate (over white → all white; over black → all
black; 16 KB). Combined with the earlier driver issue (a Float32 readback of a
HalfFloat RT returns zeros on ANGLE/SwiftShader — already fixed by the native HALF
`readCaptureFloatHalf` path), the float stills carried no usable content. Fix:
`readCaptureFloatHalf` now forces opaque alpha. **Live confirm:** a fresh 1080p
png16 is now a valid opaque image — 6.4 MB, `overBlack == overWhite ==
[112,81,39,255]` (terrain content, alpha 255), mean 126. Regression-guarded
(runtime: float readback forces opaque alpha; source guard).

**B2 log on/off CONFIRMED live:** png16 with log OFF mean 126.29 → log ON mean
166.08 (the log transfer measurably lifts mid-tones, per `captureLogEncode`).

**EXR live:** 1080p EXR saved in ~14 s on a real GPU (the `EXRExporter` ZIP encode
is the cost; far slower under headless software GL — which is why the e2e asserts
"engages", not terminal, for EXR/8K/path).

**C1:** `capture-scroll-accept-render` testid added to the scroll "Accept and
Render" trigger. **C2:** new `tests/utah-forge/capture-director-formats.spec.ts`
(EXR/png16/log stills, scroll record, path video, 8K) with headless-tolerant
graceful assertions (engages + no wedge/pageError). **C3:** the capture
fidelity-lock loads full-res assets, so it is slow under headless software GL
(~3 s on a real GPU) — the render-still poll/timeout bump stands; no perf change.

**B1 / B3 / B4 — now verified live (real GPU, 2026-06-21):**

- **B1 tiled-seam (A5) — confirmed by measurement.** Two horizontally-adjacent 8K
  tiles rendered with distortion via `__geoseeCaptureStillRenderer.renderTile`
  (Baked Look, overlapPixels 64); boundary continuity = mean-abs-diff between
  tile A's right edge and tile B's left edge vs the in-tile horizontal gradient.
  Distortion OFF: ratio **1.02** (baseline seamless). Distortion 0.05/0.15/0.30:
  ratio **0.99 / 0.98 / 1.01 (seamless)** — the full-frame-warp + inverse-tile-UV
  + overlap fix holds. Extreme distortion 0.7 spikes to **7.79** (sample
  displacement exceeds the fixed 64px overlap) — a documented out-of-range edge,
  not a real-use value. Live distortion confirmed to survive into `renderTile`
  under Baked Look. Regression-guarded by
  `tests/utah-forge/capture-director-tile-seam.spec.ts`.
- **B3 8K float — confirmed.** 8K png16 still: **7680x4320, bit-depth 16,
  color-type 6 (RGBA), opaque (content mean 189), 84 MB, 17 s**. The alpha fix
  holds at 8K. (8K EXR = the same 8K HALF readback + the proven 1080p EXR ZIP
  encode; not separately re-run.)
- **B4 scroll to completion — confirmed.** A 6-frame (frame-range 0–5) 1440p
  browser-inline scroll reached **"Scroll package render complete"** in ~75 s, no
  wedge.

Unrelated: a pre-existing `tsc` error in `src/scene/layerLoaders.ts:573` (separate
uncommitted MT-ingest work, not touched here).
