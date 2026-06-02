# NAIP 2024 Topo Material — Alignment Audit (2026-06-02)

**Scope:** determine the root cause of the visible tile misalignment in the
NAIP2024 topo material beside the FORGE site (reported on the MT Volume
Overview page). Audit only — no fixes applied. Covers the source data, the
import/generation code, the package manifest, and the runtime drape.

**Bottom line:** the data chain is clean end-to-end. The five county tiles are
provably co-registered at the source, the mosaic is geometrically faithful, and
every declared bound agrees. The residual misalignment is therefore a **runtime
drape rendering artifact**, not a data or registration error. One **latent
defect was introduced during the prior "fix" attempts** and must be reverted.

---

## 1. Source data — CLEAN (eliminated)

The five NAIP 2024 county MrSID deliveries each ship a `.sdw` world file (the
6-parameter affine georeference). All five, verbatim:

| County | x-res | y-res | rot D | rot B | origin X | origin Y |
| --- | --- | --- | --- | --- | --- | --- |
| Beaver  | 0.600000 | -0.600000 | 0 | 0 | 231116.10 | 4279999.50 |
| Iron    | 0.600000 | -0.600000 | 0 | 0 | 229069.50 | 4231440.30 |
| Millard | 0.600000 | -0.600000 | 0 | 0 | 232725.30 | 4384071.90 |
| Sanpete | 0.600000 | -0.6000000006 | 0 | 0 | 407796.30 | 4414307.70 |
| Sevier  | 0.600000 | -0.6000000006 | 0 | 0 | 363546.30 | 4324451.70 |

- **Identical pixel size** (0.6 m), **zero rotation** (both shear terms 0),
  **same datum/zone** (all origins in the 229–484 km easting band ⇒ UTM 12N /
  EPSG:26912; an 11N tile would read 600 km+).
- Sanpete/Sevier y-res carries a 6×10⁻¹⁰ rounding tail → 0.0000006 m drift over
  the full image height. Negligible; not visible.
- Origins agree with the generator's hard-coded `bounds` to < 1 m.

**Conclusion:** the tiles co-register exactly. A plain `gdalbuildvrt` mosaics
them seamlessly. There is no source-level misalignment, no zone mismatch, no
rotation. The user's premise ("single source, they should align") is correct
and confirmed.

Evidence: `C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\Satellite Maps\NAIP2024_*\*.sdw`.

## 2. Generator / import code — FAITHFUL (eliminated as geometry source)

[tools/generate-naip-regional-overview-assets.py](../../tools/generate-naip-regional-overview-assets.py)

- `regional_bounds()` = union of catalog bounds = `(229069.2, 4144854.0,
  484164.0, 4414308.0)`.
- `gdal_translate -projwin <regional_bounds> -outsize 7755 8192 -r bilinear`
  ⇒ pixel size 32.89 m in both axes (square), aspect 0.9467 = output aspect
  7755/8192. **No distortion, no stretch, no rotation introduced.**
- Mosaic order (beaver, iron, millard, sanpete, sevier) only affects overpaint
  in overlap zones; with co-registered inputs overpaint is pixel-identical, so
  it is harmless.

**Probe of the on-disk mosaic** (`naip_2024_regional_8192.webp`): at Beaver's
west edge (px 62) and east edge (px 4760) the imagery is **fully opaque on both
sides** (0 % transparent). There is no nodata gap and no content discontinuity
at the county boundaries flanking the site. The mosaic is clean.

One real gap exists in the engine, but it is **not** the cause here: the
pipeline never verifies source CRS before `gdalbuildvrt` (no `gdalwarp`/`-t_srs`
guard). It happens to be safe because all five sources are already EPSG:26912
(proven in §1). Worth hardening for future county sets, but it is not producing
the current artifact.

## 3. Manifest / package bounds — CONSISTENT (eliminated)

Every declared extent for the active material agrees exactly:

| Source of truth | bounds |
| --- | --- |
| `naip_2024/manifest.json` `aoi.bounds` | 229069.2, 4144854, 484164, 4414308 |
| WebP true pixel extent (projwin) | 229069.2, 4144854, 484164, 4414308 |
| `environment.json` source `naip-2024-aerial.bounds` | 229069.2, 4144854, 484164, 4414308 |
| `environment.json` `scene.terrain.orthoPhotoBounds` | 229069.2, 4144854, 484164, 4414308 |

The drape is told to place the image exactly where its pixels actually are.

## 4. Runtime drape — the remaining surface (where the artifact lives)

The data is correct, so the misalignment is introduced when the texture is
sampled onto the terrain. Two structural facts of the drape:

1. The image is applied **per terrain tile**: `surfaceRuntime.applyOrthoPhotoBounds`
   ([src/topoMap/surfaceRuntime.ts:406](../../src/topoMap/surfaceRuntime.ts))
   traverses every terrain mesh and maps the image UTM bounds into that tile's
   own scene frame via `sceneBoundsForImageUtmBounds` →
   `topoImageUtmBoundsToSceneBounds`.

2. `topoImageUtmBoundsToSceneBounds`
   ([src/topoMap/surfaceRuntime.ts:58-85](../../src/topoMap/surfaceRuntime.ts))
   derives the placement origin from **whichever terrain corner is closer**:

   ```ts
   originX = abs(terrainMinX - sceneMinX) <= abs(terrainMaxX - sceneMaxX)
       ? terrainMinX - sceneMinX
       : terrainMaxX - sceneMaxX;   // (same pattern for Y)
   ```

**Primary suspect (vertical full-height bands at fixed eastings):** if adjacent
terrain tiles resolve this origin from *different* reference corners — or carry
any per-tile rounding between `terrainUtmBounds` and the `uTerrainBoundsMin/Max`
uniforms — the image lands at a slightly different offset on neighbouring tiles.
The result is a thin gutter along the tile-column seam where the NAIP texture
under-/over-shoots; the bare terrain mesh shows through, and its triangle
diagonals read as the **herringbone/chevron smear** seen flanking the site. This
matches the symptom exactly: full-height, vertical, at regular tile-column
eastings, textured like the mesh rather than like the imagery.

**Secondary suspects (less likely, listed for completeness):**

- **Edge clamp.** `configureTopoTexture` sets `wrapS/wrapT = ClampToEdgeWrapping`
  ([surfaceRuntime.ts:107-108](../../src/topoMap/surfaceRuntime.ts)); where a
  tile's UV runs just past `[0,1]`, the edge texel is repeated → a smear column.
- **Coverage feather.** The generator's `coverage_alpha` dilates+gaussian-feathers
  the alpha at coverage edges; translucent fringes let the hillshade bleed
  through. Does not apply at Beaver's E/W edges (opaque there, §2) but can at the
  AOI perimeter.
- **Dual image sources.** The scene defines two image materials: the clean
  county mosaic `naip-2024-aerial` and a separate **USGS NAIP Plus *service*
  ortho** `ortho-photo` with bounds `[-356385.9, 3703652, 1039320.6, 4843097]`
  (a different source, ~1400 km, independently registered). The MT Volume
  Overview page inherits `materialPreset: "image:naip-2024-aerial"` and does
  **not** select the service ortho, so this is not active here — but if any page
  or render preset (e.g. `customRenderPresets[3]`) swaps to / composites the
  service ortho, that *is* a genuine cross-source registration mismatch.

## 5. Defect introduced during prior fix attempts — REVERT

[tools/generate-naip-regional-overview-assets.py](../../tools/generate-naip-regional-overview-assets.py)
currently carries non-empty `ties` on **iron** and **sevier** (added while
chasing this). The tie solver rotates those sets by ~ +0.97° / −0.58° and shifts
them, baked into the geotransform before mosaic. Against the **provably
zero-rotation** source (§1) this *introduces* real misalignment. It is not yet
in the rendered output — the on-disk WebP (00:18) predates the edits (01:41) —
but a re-bake would corrupt the clean mosaic. **Reset iron/sevier `ties` to `[]`
(identity) before any regeneration.**

## 6. Verification to confirm the primary suspect (one step, in-app)

Instrument `applyOrthoPhotoBounds` to log, per terrain tile, the resolved
`sceneBounds` returned by `sceneBoundsForImageUtmBounds`, plus the tile's
`terrainUtmBounds` and `uTerrainBoundsMin/Max`. Then:

- If adjacent tiles report **different** resolved image `sceneBounds` (or the
  corner-pick branch flips between neighbours) → **confirmed**: the per-tile
  placement heuristic is the cause; the bands sit exactly on those tile seams.
- If all tiles report identical mapping → fall to the edge-clamp / feather
  suspects and inspect UVs at the coverage perimeter.

No source regen, no GDAL, no data change needed to confirm.

## 7. Summary for the decision

| Layer | Verdict | Evidence |
| --- | --- | --- |
| Source SIDs | Clean, co-registered | 5 identical world files, zero rotation, one zone |
| Generator geometry | Faithful | projwin + square px + matching aspect; opaque both sides of boundaries |
| CRS-normalization guard | Missing but moot here | all sources already 26912; harden for future sets |
| Manifest / env bounds | Consistent | four sources agree exactly |
| Runtime per-tile drape | **Primary suspect** | corner-pick origin heuristic + per-tile mapping → tile-seam gutters → herringbone |
| Prior tie-point edits | **Latent defect** | rotates zero-rotation source; not yet rendered; revert |

The county tiles are not misaligned in the data. Treat this as a drape /
texture-placement bug in `surfaceRuntime`, confirm via §6, and revert the
iron/sevier ties.
