# Capture Output Texture Quality — Audit & Handoff

Date: 2026-06-18
Author: Claude (Opus 4.8)
Status: Audit complete (read-only). No code changed. Handoff for a different agent.

## Scope (operator constraint — strict)

Fix applies to CAPTURE OUTPUTS ONLY — still PNG export, deterministic still,
and rendered video output. The live/runtime (interactive) view must NOT be
changed (its texture filtering and VRAM profile stay as-is). The operator was
explicit: "this is not the runtime issue, it's the outputs."

Goal: capture outputs look full-detail in all ways; nothing in the output path
downsamples or softens the draped imagery.

## Operator-reported issues

- Still PNG captures (and rendered outputs generally) show the draped satellite
  image and the topo-map detail looking downsampled / soft.
- Suspicion that LOD (or some other output-path step) is degrading the imagery.
- Outputs should "look amazing and full detail in all ways."
- Explicitly outputs-only; do not touch the runtime view.

## Audit verdict

Confirmed: the captured satellite drape is effectively under-filtered (soft at
oblique angles), and the cause is identified. Two other suspected culprits
(geometry LOD, framebuffer downsample) are already handled correctly in capture.

### What is ALREADY correct in the capture output path

1. Render framebuffer — exact output size, no downsample.
   - `src/capture/deterministicStillExporter.ts`: `supersampleScale` must be 1
     (throws otherwise); `renderWidth/renderHeight` come from
     `validateRenderResolutionRequest`; output is `drawImage(canvas, 0,0,width,height)`
     1:1. If the requested size exceeds the GPU limit, validation pushes an error
     and the still THROWS / falls back to the external tiled job — it never
     silently clamps to a smaller framebuffer.
   - `src/capture/captureResolution.ts` `validateRenderResolutionRequest`:
     `renderWidth = width * scale` (scale 1), errors (does not clamp) when over
     `maxTextureSize`/`maxRenderbufferSize`.
   - `src/scene.ts` `beginCaptureFidelityLock` (~945): sets
     `downsamplingDisabled: true`, `dynamicResolutionDisabled: true`, pixelRatio 1.

2. Geometry / terrain LOD — already locked to full "source" detail in capture.
   - `src/loaders/loadTerrain.ts:634-686`: `forceSourceTerrainLod()` →
     `rebuildTerrain("source", 1)`; `terrainLodHandle.setCaptureDetailLock(true)`
     forces the source (highest) tier and ignores camera-distance LOD while locked.
   - `src/topoMap/surfaceRuntime.ts:128-151` `setCaptureFullResolution` calls
     `lodHandle.setCaptureDetailLock(enabled)` on the terrain group.
   - So geometry LOD is NOT the problem — it is already off/locked in capture.

3. Texture source resolution — capture loads the highest (8192) source and
   awaits it before rendering.
   - `src/topoMap/surfaceRuntime.ts:639-696` `applyOrthoPhotoTexture`: in capture
     uses `terrain.orthoPhotoTexture8192Path ?? orthoPhotoPath` (line ~650).
   - `:542-565` `texturePathForBudget`: in capture returns `source.texture8192Path`
     (line ~551) for the topo-image detail overlay.
   - `:153-162` `waitForCaptureFullResolution` awaits `captureFullResolutionTextureLoads`;
     `src/scene.ts:929-944` wires the capture fidelity asset depth →
     `manager.setCaptureFullResolution(true)` + `waitForCaptureFullResolution()`,
     and `deterministicStillExporter` awaits `waitForCaptureFidelityReady()` BEFORE
     `renderCaptureFrame`.

### ROOT CAUSE — the satellite ortho has no mipmaps, so its anisotropy is inert

`src/topoMap/surfaceRuntime.ts:90-109` `configureTopoTexture` gates mipmaps on
power-of-two:

```ts
const powerOfTwo =
  THREE.MathUtils.isPowerOfTwo(width) && THREE.MathUtils.isPowerOfTwo(height);
texture.anisotropy = maxAnisotropy;                 // 16
texture.minFilter = powerOfTwo
  ? THREE.LinearMipmapLinearFilter
  : THREE.LinearFilter;                             // <- NPOT path
texture.magFilter = THREE.LinearFilter;
texture.generateMipmaps = powerOfTwo;               // <- false for NPOT
```

The satellite ortho is 8192 x 7082 — NON-power-of-two (7082 ≠ 2^n), the true
NAIP extent aspect ratio. It therefore gets `LinearFilter` with
`generateMipmaps = false`. Consequences:

- Anisotropic filtering REQUIRES mipmaps. With `generateMipmaps = false` the
  `anisotropy = 16` is INERT (does nothing).
- At oblique camera angles (the normal way draped terrain is viewed) a single
  bilinear tap cannot represent the stretched texel footprint → the satellite
  reads soft/smeared and aliased = the reported "downsampled satellite". This
  applies in the OUTPUT too (same texture object/config).

The topo-image DETAIL texture is 8192 x 8192 (power-of-two) → it DOES get
`LinearMipmapLinearFilter` + `generateMipmaps = true` + working anisotropy, so it
is filtered correctly. Any softness on the detail is correct mip minification at
distance (sharp when the camera is close over the FORGE footprint).

The `powerOfTwo` gate is an obsolete WebGL1-era restriction. The renderer here is
WebGL2 (confirmed live), where NON-power-of-two textures fully support mipmaps
and anisotropic filtering. The gate needlessly degrades the satellite.

### Empirical confirmation (live Utah FORGE, `window.__scene` inspection)

GPU caps: `maxTextureSize 16384`, `maxAnisotropy 16`, WebGL2 = true, pixelRatio 1.25.

uOrthoPhotoMap (satellite base) — `naip_2024_regional_8192.webp`:
- image 8192 x 7082, `generateMipmaps: false`, `minFilter: LinearFilter (1006)`,
  `anisotropy: 16` (inert with no mipmaps).

uTopoImageDetailMap (topo detail) — `naip_2024_forge_detail_8192.webp`:
- image 8192 x 8192, `generateMipmaps: true`,
  `minFilter: LinearMipmapLinearFilter (1008)`, `anisotropy: 16` (active).

Config facts (`projects/utah-forge/environment.json`):
- `orthoPhotoPath` == `orthoPhotoTexture8192Path` == the same
  `naip_2024_regional_8192.webp` (lines ~955-957); `orthoPhotoTextureBudget: 8192`
  (line ~954). So the live view AND capture already use the same 8192 source —
  this is NOT a source-resolution or budget problem; it is the FILTERING.
- Default base preset is `materialPreset: "image:naip-2024-aerial"` (line ~858),
  which routes through the same `orthoPhoto*` fields (see
  `src/topoMap/settings.ts:460-486` `topoImageMaterialDefaultPatch`) and the
  `uOrthoPhotoMap` slot. The "satellite map" and the "topo map base image" are the
  SAME terrain slot, not two separate textures. Terrain has exactly two image
  uniforms: `uOrthoPhotoMap` and `uTopoImageDetailMap`
  (`src/scene/terrainMaterial.ts:403,461`; setters at :143,:144).

### Important nuance for whoever implements the fix

The softness is from MISSING mipmaps (hence no anisotropic filtering), NOT from
"LOD being on." The correct fix is to ADD anisotropic filtering (mipmaps + max
anisotropy) for the capture — that is the HIGHEST quality (sharp AND non-aliased
at all angles/distances). Forcing "mip-0 everywhere" / disabling mipmaps would
make distant terrain alias and shimmer — worse, not "amazing". Geometry LOD is
already locked to full source in capture and must stay so.

Source resolution is the separate, non-code ceiling: 8192px across the regional
extent is the max source. A genuinely sharper regional map needs a higher-res
source asset (e.g. a 16384px regional ortho), which is a data/prep task, not part
of this fix.

## Recommended fix direction (capture-scoped; runtime untouched)

When the capture full-resolution lock engages, reconfigure the loaded drape
textures for capture quality, and restore the live filtering on lock release so
the runtime view and its VRAM are unchanged.

- On `setCaptureFullResolution(true)`: for the existing `orthoPhotoTexture` and
  `topoImageDetailTexture`, set `generateMipmaps = true`,
  `minFilter = THREE.LinearMipmapLinearFilter`, `anisotropy = maxAnisotropy`,
  `needsUpdate = true` (when WebGL2).
- On `setCaptureFullResolution(false)`: restore the live config (re-run the
  existing POT-gated `configureTopoTexture` logic).
- Must RE-CONFIGURE the existing texture object on the capture toggle, not rely on
  a reload: for Utah `orthoPhotoPath === orthoPhotoTexture8192Path`, so
  `applyOrthoPhotoTexture` early-returns (path unchanged) and never re-applies
  filtering. The re-config must run independently of the reload path.

Files to modify:
- `src/topoMap/surfaceRuntime.ts` — make `configureTopoTexture` (90-109)
  capture/WebGL2-aware (`mipmappable = (captureFullResolution && isWebGL2) || POT`);
  in `setCaptureFullResolution` (128-151) re-configure the existing ortho + detail
  textures + `needsUpdate`; add `isWebGL2` to `TopoSurfaceRuntimeOptions`.
- `src/topoMap/runtime.ts` — `TopoMapRuntimeOptions` already carries `renderer`
  (line 14); pass `isWebGL2: options.renderer.capabilities.isWebGL2` into the
  `TopoSurfaceRuntime` options (constructor ~48-51).
- Check `src/loaders/loadSceneOverlays.ts:174-196` for the same POT gate — only if
  other draped scene overlays also look soft in outputs (not reported yet;
  out of scope unless confirmed).

All output paths share the same fidelity lock (`beginCaptureFidelityLock`), so the
fix covers still capture, the external/tiled 8K still, and rendered video.

## Guardrails

- OUTPUTS ONLY. Do not change the runtime/live filtering or VRAM. The enhanced
  filtering must apply only under the capture full-resolution lock and be restored
  on exit.
- Do not change texture SOURCE resolution or budgets (8192 is the source ceiling;
  sharper regional map = a higher-res source asset, separate data task).
- Do not change geometry LOD behavior (already locked to source in capture).
- No page-id / page-order / fixture special-casing (repo page-agnostic ban).

## Verification

- Static: `npx tsc -b`.
- Live (scoped dev server, Utah FORGE; do NOT run `Launch GeoSee.bat`):
  - During a still capture, inspect via `window.__scene` that `uOrthoPhotoMap` has
    `generateMipmaps: true`, `minFilter: LinearMipmapLinearFilter (1008)`,
    `anisotropy: 16`.
  - After the capture completes, confirm `uOrthoPhotoMap` is RESTORED to the live
    config (`generateMipmaps: false`, `minFilter: LinearFilter`) — runtime
    unchanged.
  - Capture a PNG at an oblique camera angle over the draped satellite; confirm the
    satellite reads sharp (anisotropic), not smeared, vs a before-fix capture.
- Inspection snippet used during the audit (read-only):
  traverse `window.__scene.scene`, find the material with
  `uniforms.uOrthoPhotoMap` / `uTopoImageDetailMap`, read `.value.image.width/height`,
  `.value.generateMipmaps`, `.value.minFilter`, `.value.anisotropy`; read GL caps via
  `window.__scene.renderer.capabilities.getMaxAnisotropy()` and
  `getContext().getParameter(MAX_TEXTURE_SIZE)`.

## Cross-references

- Capture fidelity / full-resolution wiring: `src/scene.ts:929-992`,
  `src/scene/SceneManager.ts:5819-5825`, `src/topoMap/runtime.ts:97-103`.
- Still export: `src/capture/deterministicStillExporter.ts`,
  `src/capture/externalStillRenderJob.ts`, `docs/capture-director/README.md`
  ("8K Still Capture", "External Still Command").
