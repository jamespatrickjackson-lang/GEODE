# Capture Output Quality — Full Pipeline Ledger

Date: 2026-06-18
Author: Claude (Opus 4.8)
Status: Audit complete (read-only). No code changed.
Companions:
- `CAPTURE-OUTPUT-TEXTURE-QUALITY-AUDIT-20260618-CLAUDE.md` (satellite drape root cause)
- `CAPTURE-OUTPUT-RUNTIME-QUALITY-DEEP-REVIEW-20260618-CLAUDE.md` (render/post path)
- THIS doc: every ingestion → processing → output stage that downsamples,
  quantizes, clips, compresses, or under-filters, traced source-to-pixel.

## Headline

The capture "max-detail, no-downsampling" promise is real for exactly two
things: the **topo ortho texture** (forced to 8192 source) and **terrain
geometry** (forced to the source LOD tier). Everything else renders into the
output at its normal runtime budget. `setCaptureFullResolution` upgrades only
the topo runtime (`src/scene/SceneManager.ts:5819-5820`); seismic sections/
volumes, the MT resistivity volume, and every draped vector raster are NOT
upgraded for capture and carry their browser-tier resolution, 8-bit
quantization, and missing mip/anisotropy straight into the still or video.

## Fidelity ledger (what reaches the output)

| Content | Source ceiling | Runtime/output state in capture | Upgraded by capture lock? |
|---|---|---|---|
| Topo ortho (satellite/base image) | NAIP, bilinear→8192 WebP q94 | 8192, but **no mipmaps→inert anisotropy** (F0) | YES (size only, not filtering) |
| Terrain geometry | MRDEM **30 m** DEM | source LOD tier (full DEM) | YES |
| Topo image detail overlay | 8192 POT WebP | 8192, mip+aniso correct | YES |
| Seismic 2D/3D sections | SEG-Y; source-fidelity ≤4.19 Mpx | **standard tier ≤2048 long edge**, uint8, p02–p98 clip | **NO** |
| Seismic raymarch volume | source-fidelity ≤33.5 Mvox | **browser ≤8.39 Mvox / coarse ≤2.10 Mvox**, uint8 | **NO** |
| MT resistivity volume (raymarch) | full-density float32 model | **uint8** Data3DTexture, voxel-budget coarse | **NO** |
| MT Resistivity Cells (points) | float32 | float32 (full precision) | n/a (already full) |
| Geology drape | vector polygons | **2048² canvas, no mipmaps** | **NO** |
| Claim drape | vector polygons | **2048² canvas, no mipmaps** | **NO** |
| Hydrography/lakes | vector polygons | **2048² canvas, Nearest, no mipmaps** | **NO** |
| Trees VRI | vector polygons | **4096² canvas, no mipmaps** | **NO** |
| Targets | vector polygons | **1024² canvas, no mipmaps** | **NO** |
| Scene overlays (draped imagery) | image | mip+aniso correct | n/a |
| Edge AA (all geometry) | — | **SMAA only, 1 sample/px** (F1) | NO (live uses DPR≤2) |
| Still encode | — | PNG lossless default (good) | n/a |
| Video encode | — | **8-bit 4:2:0**; ProRes4444 master only full-chroma (F2) | n/a |

## Stage 1 — Source asset generation (prep/tools): irreversible loss

### S1.1 — Satellite ortho double-lossy build (MED, source ceiling)
`tools/generate-naip-regional-overview-assets.py`: regional ortho is reprojected
/ resampled with `resample: str = "bilinear"` (:438) and capped to an 8192 long
edge (`DEFAULT_REGIONAL_COG_LONG_EDGE = 8192`, :33), then encoded `COMPRESS=WEBP
QUALITY=<arg>` (:492-494).
`tools/generate-naip-beauty-assets.py`: FORGE detail `FORGE_DETAIL_SIZE_PX = 8192`
(:17), encoded `WEBP ... QUALITY=94 method=6` (:105,:215).
Two irreversible softeners before the texture ever loads: **bilinear** (not
Lanczos/cubic) downsampling blurs high-frequency detail at the 8192 step, and
**WebP q94** is lossy (block/ringing on fine edges). `tools/audit-naip-quality.py`
exists to measure this. Net: even with F0 fixed, the drape's ceiling is a
bilinear-downsampled, lossy-WebP 8192 image.

### S1.2 — Terrain DEM is 30 m (LOW-MED, source ceiling)
`prep/fetch_terrain.py` header: NRCan MRDEM, **30 m** resolution. Terrain
silhouette/relief detail in a close capture is bounded by 30 m elevation posts;
no runtime setting recovers sub-30 m relief.

### S1.3 — MT resistivity volume is uint8 + budget-downsampled (MED)
`prep/build_utah_forge_mt_volume_products.mjs`: voxel values
`Math.min(255, Math.round(((logValue - min) / span) * 255))` (:455),
`volume: new Uint8Array(...)` (:394), documented `normalizedEncoding: "uint8"`
(:985). Browser coarse volume `downsample_volume_budget(volume,
BROWSER_COARSE_VOLUME_MAX_VOXELS)` — coarse cap **2,097,152 voxels** (prep
`build_utah_forge_seismic_browser.py` constants are the seismic ones; the MT
budget is in this MT script). The full-density point model is float32
(`build_utah_forge_mt_resistivity_full_density.mjs:238-260`), but the
volumetric raymarch view is **256-level** scalar → banding in the resistivity
color ramp, magnified after grade.

### S1.4 — Seismic amplitude: uint8 + percentile clip + tiered downsample (HIGH for seismic)
`prep/build_utah_forge_seismic_browser.py`:
- Amplitude stored `uint8-normalized-p02-p98` (:972,:978), `np.round(normalized
  * 255).astype(np.uint8)` (:1834). The **2nd/98th percentile clip** discards
  the brightest/darkest 2% of amplitude (irreversible contrast crush) and
  **8-bit** quantizes the rest (banding in smooth reflectors).
- Resolution tiers (env-overridable):
  - source-fidelity: section `SOURCE_FIDELITY_SECTION_MAX_PIXELS = 4,194,304`
    (:69), volume `SOURCE_FIDELITY_VOLUME_MAX_VOXELS = 33,554,432` (:72).
  - browser-3D: section `BROWSER_3D_SECTION_MAX_LONG_EDGE = 2048` (:75), volume
    `BROWSER_3D_VOLUME_MAX_VOXELS = 8,388,608` (:78).
  - coarse: section `BROWSER_COARSE_SECTION_MAX_LONG_EDGE = 768` (:81), volume
    `BROWSER_COARSE_VOLUME_MAX_VOXELS = 2,097,152` (:84).
  Downsamplers: `cap_long_edge` (:1675), `bounded_pair` (:1634),
  `downsample_matrix_long_edge` (:1837), volume budget shrinkers (:1703-1733).

## Stage 2 — Runtime load / texture config

### S2.1 — Topo ortho POT gate → inert anisotropy (F0, prior audit, HIGH)
`src/topoMap/surfaceRuntime.ts:98-107`: mipmaps + filter gated on power-of-two;
the 8192×7082 NPOT ortho gets `LinearFilter` + `generateMipmaps=false`, so
`anisotropy=16` does nothing → soft/aliased drape at oblique angles. WebGL2
supports NPOT mipmaps; the gate is obsolete. (Full detail in the prior audit.)

### S2.2 — Draped vector rasters: fixed canvas, no mipmaps (NEW, MED, systemic)
Vector layers are rasterized to a fixed-size `CanvasTexture` and draped over the
terrain with `generateMipmaps=false` and no anisotropy:
- Geology: `MASK_RES = 2048`, `LinearFilter`, no mip (`loadGeology.ts:34,157-161`).
- Claim: `MASK_RES = 2048`, `LinearFilter`, no mip (`loadClaim.ts:27,117-121`).
- Hydrography/lakes: `LAKE_MASK_RES = 2048`, `NearestFilter`, no mip
  (`loadHydrography.ts:48,242-246`).
- Trees VRI: `MASK_RES = 4096`, `LinearFilter`, no mip (`loadTreesVri.ts:12,202-206`).
- Targets: `MASK_RES = 1024`, `LinearFilter`, no mip (`loadTargets.ts:22,83-87`).
A 1024–2048 px raster stretched across the regional extent reads soft at 8K and
aliases/shimmers at oblique angles and distance (no minification mip, no
anisotropy). Nuance: hydrography uses `NearestFilter` deliberately (boolean
mask edge); enabling mipmaps there would blur the mask. Color fills (geology) and
fills/outlines (claim, trees) would benefit from a higher capture bake res +
mip + anisotropy.

### S2.3 — MT volume runtime texture is 8-bit (NEW, MED)
`src/loaders/loadScalarVolume.ts:342-344`: `Data3DTexture` with
`format = RedFormat`, `type = UnsignedByteType`. The raymarched MT volume is
256-level; capture renders the same 8-bit texture.

### S2.4 — Seismic runtime default tier is "standard" (NEW, HIGH for seismic)
`src/loaders/loadSeismicBrowser.ts`: `SEISMIC_DEFAULT_LOD_TIER = "standard"`
(:33); a `source` tier exists in the manifest LOD map (:102,:119,:179-186) but
is not requested for capture, and distance LOD can drop to `coarse` (768 long
edge). The 4.19 Mpx source-fidelity sections are never pulled for output.

## Stage 3 — Capture fidelity lock scope (the gap)

`src/scene/SceneManager.ts:5819-5824`:
```
setCaptureFullResolution(enabled) { this.topoRuntime.setCaptureFullResolution(enabled); }
waitForCaptureFullResolution() { return this.topoRuntime.waitForCaptureFullResolution(); }
```
The lock touches the topo runtime only. Seismic, MT volume, and draped vector
rasters get no capture upgrade. The terrain geometry source-LOD lock is separate
(`loadTerrain.ts` `forceSourceTerrainLod`, prior audit §2) and does fire. So the
"no-downsampling" guarantee is topo-ortho + terrain-geometry scoped, not scene-wide.

## Stage 4 — Render / post (from the deep review)

- **F1 (HIGH):** composed output AA is SMAA-only at 1 sample/px. Capture forces
  pixelRatio 1 (`scene.ts:984-988`), forbids supersampling
  (`deterministicStillExporter.ts:114-117`), and the EffectComposer RTs are not
  multisampled (`postprocessing.ts:407-461`). Live view renders at DPR≤2
  (`scene.ts:542`) → implicit supersample, so the screen looks crisper than the
  output. Biggest non-texture sharpness gap; affects all geometry edges.
- **F4 (MED):** authored optical/grade passes bake into capture with no
  neutralization — bloom always on (`postprocessing.ts:433-439`); DOF, tilt-shift,
  afterimage (motion trails), diffusion, grain, chromatic aberration are page/
  preset controlled (`applyEnvironment.ts:393-443`). Afterimage also makes a
  single deterministic still depend on a stale accumulation buffer.
- OK: composer RTs are HalfFloat (no 8-bit banding through grade); composer is
  resized to exact output size at pixelRatio 1 (no upscaling).

## Stage 5 — Output encoding

- Still: PNG lossless by default (`deterministicStillExporter.ts:76`,
  `CaptureDirectorProvider.tsx:4459/4903`); WebP/JPEG optional at quality 0.92.
- Video (**F2, HIGH for video**): all playable deliverables are 8-bit **4:2:0**
  (`render-capture-video-job.mjs` H.264 `-crf 12 -pix_fmt yuv420p` :456-465, VP9
  `-crf 18 -pix_fmt yuv420p` :445-450). ProRes 4444 `yuv444p10le` master (:473-478)
  is the only full-chroma path. Browser VP9 `crf 28`
  (`frameSequenceVideoEncoder.ts:137`) is comparatively lossy.

## Remediation map (priority for "full detail in all ways")

1. **F0** topo ortho mip/anisotropy (prior audit) — capture-scoped, restore on exit.
2. **S3 / scene-wide fidelity lock** — extend `setCaptureFullResolution` to
   request the **source** seismic tier and a higher MT volume tier during the
   lock, mirroring the topo upgrade + `waitFor...` await. Biggest correctness fix:
   it makes the "no-downsampling" promise actually scene-wide.
3. **F1** capture AA — multisampled composer RT under the lock (WebGL2 `samples`)
   or allow capture supersampling. Biggest geometry-edge sharpness win.
4. **F2** video chroma — deliver from ProRes 4444 master or add a 4:4:4 / high
   profile H.264 deliverable; raise browser VP9 quality.
5. **S2.2** draped vector rasters — higher capture bake res + mip + anisotropy
   for color/outline fills (leave Nearest masks as-is or special-case).
6. **S1.4 / S1.3 / F4** — seismic/MT 8-bit + percentile clip are prep-time data
   decisions (would need 16-bit/float storage to remove banding); a clean-capture
   grade profile removes accidental softening.
7. **S1.1 / S1.2** — sharper/less-lossy source ortho (Lanczos, higher quality,
   ≥16384) and a finer DEM are data/prep tasks, the outer ceiling.

## Notes / corrections

- Prior audit's claim that `loadSceneOverlays` shares the POT gate is wrong — it
  forces mip+aniso unconditionally (`loadSceneOverlays.ts:195-201`). The POT gate
  is unique to `surfaceRuntime.configureTopoTexture`.
- MT Resistivity Cells (point model) and the topo image detail overlay are
  already full-fidelity; not every layer is degraded.

## Verification hooks (read-only)

- Capture lock scope: `grep -n setCaptureFullResolution src/scene/SceneManager.ts`.
- Seismic tiers: `grep -nE "MAX_LONG_EDGE|MAX_VOXELS|MAX_PIXELS" prep/build_utah_forge_seismic_browser.py`.
- MT volume precision: `grep -nE "UnsignedByteType|RedFormat" src/loaders/loadScalarVolume.ts`.
- Draped raster bake res: `grep -nE "MASK_RES|LAKE_MASK_RES" src/loaders/load{Geology,Claim,Hydrography,TreesVri,Targets}.ts`.
- Video chroma: `grep -n pix_fmt tools/render-capture-video-job.mjs`.
- Live inspection during a still: `window.__scene` material uniforms for
  `generateMipmaps`/`minFilter`/`anisotropy`; seismic/MT layer LOD tier in
  `userData.seismicProductLodTier` / volume texture `.type`.
