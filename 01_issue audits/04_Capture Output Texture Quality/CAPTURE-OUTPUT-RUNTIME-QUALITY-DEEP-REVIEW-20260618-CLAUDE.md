# Capture Output Quality — Deeper Runtime Review

Date: 2026-06-18
Author: Claude (Opus 4.8)
Status: Audit complete (read-only). No code changed. Companion to
`CAPTURE-OUTPUT-TEXTURE-QUALITY-AUDIT-20260618-CLAUDE.md`.

## Purpose

The prior audit isolated one root cause (the NPOT satellite ortho has no
mipmaps, so its anisotropy is inert → soft drape). This pass widens the lens:
everything else in the runtime/output path that can degrade capture quality,
ranked by impact, with file:line evidence. Same scope guardrail applies —
findings are about the OUTPUT path; live/runtime view changes stay out unless a
finding is explicitly runtime-shared.

## Output path, end to end (map)

1. `post.composer.render()` renders the scene through the full post chain into
   the renderer canvas at the exact capture size (`src/scene.ts:826`,
   `renderCaptureFrame`).
2. The canvas is copied 1:1 into a 2D output canvas
   (`deterministicStillExporter.ts:190` `drawImage(...,0,0,width,height)`).
3. Still: `canvas.toBlob(mimeType, quality)`; PNG default (lossless), WebP/JPEG
   at 0.92 (`deterministicStillExporter.ts:61-79`, default `image/png` at
   `CaptureDirectorProvider.tsx:4459/4903`).
4. Video: deterministic frame sequence → FFmpeg
   (`tools/render-capture-video-job.mjs`, `frameSequenceVideoEncoder.ts`).

Confirmed already-correct (carry forward from prior audit, re-verified):
- Capture framebuffer is the exact output size; composer is resized to it at
  pixelRatio 1 (`scene.ts:743-790` `applyRenderSize`/`beginCaptureSize`;
  `post.setSize`/`post.setPixelRatio` at `:761-762`). No upscaling.
- Geometry/terrain LOD locked to source in capture (prior audit, §2).
- Highest source texture awaited before render (prior audit, §3).
- EffectComposer render targets are `HalfFloatType` (three 0.169,
  `node_modules/three/examples/jsm/postprocessing/EffectComposer.js:27`), so the
  grade/bloom chain does NOT band in 8-bit through the composer.

## Findings (ranked)

### F0 — (prior audit) NPOT satellite ortho → inert anisotropy → soft drape
Primary cause already documented. Fix direction unchanged. Listed here so the
combined picture is complete.

### F1 — HIGH — Composed output AA is SMAA-only at 1 sample/pixel
The single biggest NON-texture reason outputs read softer / more aliased than
what the operator sees live.

Evidence:
- Live view renders at device pixel ratio up to 2:
  `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`
  (`src/scene.ts:542`). On the operator's machine DPR was 1.25 (prior audit
  inspection). The live frame is therefore rendered ~1.25–2x and downscaled by
  the display = implicit supersample antialiasing. The screen looks crisp.
- Capture forces pixelRatio 1 and forbids supersampling:
  `beginCaptureSize({ ... pixelRatio: 1 })` (`scene.ts:984-988`);
  `deterministicStillExporter.ts:114-117` THROWS if `supersampleScale !== 1`.
- The composer's render targets are NOT multisampled. `buildPostprocessing`
  never sets `samples` on `composer.renderTarget1/2`
  (`src/scene/postprocessing.ts:407-461`). `antialias: true` on the
  `WebGLRenderer` (`scene.ts:535`) only multisamples the DEFAULT framebuffer —
  it has no effect once the scene is rendered into the composer's own RT via
  `RenderPass`. Edge AA in the composed image comes ONLY from `SMAAPass`
  (`postprocessing.ts:454-458`).

Net: every captured edge (terrain horizon, drill traces, section frames, MT
cell borders, graticule lines, fine geometry) is resolved at exactly one sample
per output pixel and smoothed only by SMAA (a screen-space morphological pass,
visibly softer/less stable than MSAA 4–8x or supersampling). The live view
hides this because of the DPR supersample; the capture, by policy, removes it.

Remediation (capture-scoped, restore on lock exit):
- Preferred: under the capture fidelity lock, give the composer a WebGL2
  multisampled RT (`new THREE.WebGLRenderTarget(w, h, { samples: 4|8 })` set as
  `composer.renderTarget1`/`renderTarget2`, or via `composer.renderTarget1.samples`)
  for `RenderPass` geometry edges; restore the non-MSAA RT after capture so the
  live VRAM profile is unchanged.
- Alternative: allow capture supersampling (render 2x, high-quality downscale in
  the 1:1 `drawImage` step). This conflicts with the current
  "no-downsampling = fidelity" policy — but note that policy, as written,
  actually FORFEITS the supersample AA the live view enjoys. Worth an explicit
  decision rather than an implicit default.

### F2 — HIGH (video) — every playable video deliverable is 8-bit 4:2:0
Chroma subsampling softens thin colored lines, isolines, graticule/figure
labels, and text edges in video output, independent of CRF.

Evidence (`tools/render-capture-video-job.mjs`):
- H.264 deliverable: `libx264 -preset slow -crf 12 -pix_fmt yuv420p` (:456-465).
  Luma quality is near-transparent (CRF 12) but chroma is half-resolution.
- VP9 deliverable: `libvpx-vp9 ... -crf 18 -pix_fmt yuv420p` (:445-450). Also 4:2:0.
- ProRes 4444 master: `prores_ks -profile:v 4444 -pix_fmt yuv444p10le`
  (:473-478) — the ONLY full-chroma, 10-bit path.
- Browser encoder: VP9 `crf 28` (`frameSequenceVideoEncoder.ts:137`),
  comparatively lossy vs the node path; H.264 `crf 18` yuv420p (:126-129,:457-458).

Remediation: for "full detail" colored-line/text work, deliver from the ProRes
4444 master (already produced), or add a `yuv444p` / High-4:4:4 H.264 deliverable
option; consider raising the browser VP9 quality (CRF 28 → ~20-24) for ≤1440p
in-browser exports.

### F3 — MED — Source drape textures are lossy WebP at the 8192 ceiling
Even with F0 fixed, output sharpness is bounded by the source asset.

Evidence: `naip_2024_regional_8192.webp` (8192x7082) and
`naip_2024_forge_detail_8192.webp` (8192x8192) are lossy WebP at the 8192 source
budget (`projects/utah-forge/environment.json`; prior audit inspection). WebP
block/ringing artifacts and the 8192 regional resolution are a data ceiling, not
a code defect.

Remediation (data/prep, not this code task): a higher-res regional ortho
(e.g. 16384) and/or a higher-quality / lossless source encode. Complements the
prior audit's resolution-ceiling note by naming the lossy-codec component.

### F4 — MED — Authored optical/grade passes render straight into capture
The post chain carries optional detail-reducing effects that are page / render-
preset controlled and are NOT neutralized for capture; whatever a page authored
is baked into the output.

Evidence (`src/scene/environment/applyEnvironment.ts`):
- Bloom is always enabled (default strength 0.85, `postprocessing.ts:433-439`).
- Bokeh depth-of-field: `bokehPass.enabled = dof.enabled && ...` (:407) — when on,
  intentionally blurs out-of-focus regions of a still.
- Tilt-shift band blur: `tiltShiftPass.enabled = tilt.enabled && ...` (:432).
- Afterimage motion trails: `afterimagePass.enabled = ...`, damp `0.82 + amt*0.17`
  (:441-443). On video this ghosts/softens moving content; for a deterministic
  single still it blends against a stale accumulation buffer (history-dependent,
  not clean per-frame).
- Lens grade diffusion / grain / vignette / chromatic aberration
  (`postprocessing.ts:88-383`) — `diffusion` and `chromaticAberration` soften;
  `grain` adds noise that survives into the encoded output.

Remediation: add a "clean capture" profile or per-page audit that clears DOF,
afterimage, diffusion, grain, and chromatic aberration when maximum detail is
the goal — or document that these are intentional and must be checked before a
detail-critical capture.

### F5 — VERIFY — External 8K tiled still: per-tile SMAA seams
The 8K external path renders projection-offset tiles, each through the composer
with tile-local SMAA, then stitches with `sharp`
(`deterministicStillTileExporter.ts`, `externalStillRenderJob.ts`,
`docs/capture-director/README.md` "External Still Command"). SMAA is screen-space
and computed per tile, so tile-boundary edges can differ slightly from a
single-surface render and show faint seams after stitching. Verify on a real 8K
tiled output before treating as fixed.

### F6 — LOW — Section/scale labels: CanvasTexture without aniso/mipmaps
`createSceneSectionLabel` / `createSceneSectionScaleLabel` set `colorSpace` but
not `anisotropy`/mipmaps (`sceneSectionController.ts:3331-3332,3383-3384`). These
are screen-facing overlays (`depthTest:false`), so impact is small; at oblique
angles they can shimmer. Not a primary cause.

## Corrections to the prior audit

- The prior audit's "Files to modify" note says
  `src/loaders/loadSceneOverlays.ts:174-196` has "the same POT gate." It does
  NOT — that loader forces `generateMipmaps = true` +
  `LinearMipmapLinearFilter` + anisotropy unconditionally
  (`loadSceneOverlays.ts:196-201`). Other draped overlays are already filtered
  correctly; the POT gate is unique to `surfaceRuntime.configureTopoTexture`.
  This strengthens the prior fix direction (make the topo ortho match what the
  overlays already do) and removes `loadSceneOverlays` from the change set.

## Priority for "outputs should look amazing, full detail"

1. F0 (satellite mipmaps/anisotropy) — prior audit.
2. F1 (capture AA: multisampled composer RT or supersample) — biggest remaining
   sharpness win for stills AND video; affects all geometry edges, not just the
   drape.
3. F2 (4:4:4 / ProRes master for video) — biggest remaining video win.
4. F4 (clean-capture profile) — removes accidental softening from authored grade.
5. F3 (higher-res / less-lossy source ortho) — data/prep ceiling.
6. F5/F6 — verify/minor.

## Verification hooks (read-only, used during this review)

- three version + composer RT type:
  `node -e "require('three/package.json').version"` → 0.169;
  EffectComposer default RT `HalfFloatType`.
- Capture AA: confirm in `postprocessing.ts` that no `samples` is set on any
  composer render target, and `SMAAPass` is the only AA pass.
- Live vs capture pixel ratio: `scene.ts:542` (live, up to 2) vs
  `scene.ts:984-988` (capture, 1).
- Video pixel format: `grep -n "pix_fmt" tools/render-capture-video-job.mjs`.
