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
> **Render Path Video / Scroll package / in-browser frame-sequence exporter:**
> still not driven to full completion this session; they share the verified
> Render Out (server) pipeline and the float/fidelity path proven by the stills +
> png16. The lone architecturally-distinct piece (in-browser
> `exportDeterministicFrameSequence`, only at <4K) remains the outstanding live
> item.

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
