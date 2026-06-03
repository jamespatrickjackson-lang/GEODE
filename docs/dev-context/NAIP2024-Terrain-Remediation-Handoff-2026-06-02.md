# NAIP2024 / Terrain Tile Misalignment — Codex Remediation Handoff (2026-06-02)

Execution contract for a downstream agent (Codex). Scope: resolve and remediate
**all** issues found in the alignment audit
([NAIP2024-Alignment-Audit-2026-06-02.md](NAIP2024-Alignment-Audit-2026-06-02.md)).
Read the audit first — it carries the evidence this plan relies on.

---

## Context

The NAIP2024 aerial topo material renders with full-height vertical
"herringbone" smear bands flanking the FORGE site (most visible on the MT
Volume Overview page). It looks like the aerial county tiles are disjointed.

2026-06-03 catalog update: the active NAIP regional material now includes nine
county MrSID sources after Garfield, Kane, Piute, and Wayne were added to the
archive. See
[NAIP2024-Regional-Source-Expansion-2026-06-03.md](NAIP2024-Regional-Source-Expansion-2026-06-03.md)
for current source bounds and generated asset hashes. The terrain/LOD
remediation conclusion below remains unchanged.

The audit plus three code explorations established the true cause:

- **The data chain is clean.** All five county MrSID `.sdw` world files are
  identical (0.6 m, zero rotation, one UTM-12N grid); the generated mosaic is
  geometrically faithful (square pixels, matching aspect, opaque on both sides
  of every county boundary); and every declared bound agrees exactly
  (manifest `aoi.bounds` = WebP extent = `environment.json`
  `naip-2024-aerial.bounds` = `orthoPhotoBounds` =
  `229069.2, 4144854, 484164, 4414308`). The aerial imagery is **not**
  misaligned.
- **The shader draping is correct.** `src/scene/terrainMaterial.ts` samples the
  ortho texture by **global world position** (`vWorldPos.xy`), skips
  out-of-coverage UVs (no ClampToEdge smear), and composites nodata-alpha over
  hillshade (not black). Per-tile bounds inputs are global-identical, so the
  per-tile `setOrthoPhotoBounds` overwrite is harmless today.
- **The real cause is the terrain mesh.** `src/loaders/loadTerrain.ts` builds an
  **8×8 tile grid with per-tile LOD** (each tile independently picks
  source/standard/coarse by camera distance) and **no skirts or edge-stitching**.
  Adjacent columns at different LOD tiers form **T-junction cracks** at regular
  eastings — full-height vertical seams where geometry is discontinuous and the
  draped imagery shears/offsets. That is the herringbone.

Outcome: eliminate the seams, undo a defective generator edit made while
chasing this, and harden two fragile spots so this class of issue cannot
silently recur.

---

## Remediation items (all four — scope = everything)

### 1. PRIMARY — terrain LOD seams (uniform LOD first)

**File:** `src/loaders/loadTerrain.ts` — `updateCameraLod` (≈ 514-559),
`terrainLodSteps` (≈ 230-244), `rebuildTile`.

**Chosen approach: UNIFORM LOD to start.** Replace per-tile tier assignment with
a **single tier applied to every tile**, so no two adjacent tiles ever differ in
edge vertex density (T-junctions become impossible).

- Compute one global tier per camera update instead of per-tile:
  - Pick the tier from the camera's distance to the **terrain centroid** (reuse
    the existing `< 65_000` / `< 150_000` thresholds as the starting mapping).
  - Apply the existing over-budget guard against `maxVertices` by stepping the
    **single global tier** coarser (source → standard → coarse) until the summed
    estimate fits — not per-tile downgrades.
  - Assign that one tier to all tiles (`rebuildTile(tile, tier)` only where
    `tile.tier !== tier`).
- Keep `terrainLodSteps`, `rebuildTile`, `terrainTileVertexEstimate`,
  `TERRAIN_LOD_CAMERA_EPSILON_M`, and the 8×8 tiling unchanged.

**Approved fallback — DO NOT implement yet; flag for approval:**
**Neighbor-matched LOD.** If uniform LOD costs too much when zoomed in, clamp
adjacent tiles so a shared edge always uses the finer neighbour's step (or cap
the max tier-difference between adjacent tiles at 0 on shared edges). Surface as
a follow-up with a perf comparison; implement only on the user's approval.

**Acceptance:** at every camera distance, all visible tiles report the same LOD
tier (`root.userData.terrainLodDebugState`); seams beside the FORGE site gone on
MT Volume Overview.

### 2. Revert the defective generator ties (latent corruption)

**File:** `tools/generate-naip-regional-overview-assets.py` — `SOURCE_CATALOG`.

`iron` and `sevier` currently carry non-empty `ties` (added while chasing the
bug) that rotate provably zero-rotation source data by ~0.97° / 0.58°. Set both
back to `"ties": []` (identity) so a re-bake cannot corrupt the clean mosaic.
The on-disk WebP predates these edits, so no regeneration is needed to undo the
render — only the source-of-truth must be cleaned.

### 3. Harden the generator with a CRS guard (future-proofing)

**File:** `tools/generate-naip-regional-overview-assets.py` — before
`qgis_gdal_buildvrt` in `main`.

The pipeline feeds county SIDs straight into `gdalbuildvrt` assuming a common
CRS with no check. Safe **today** (all five are EPSG:26912, proven), but a
future county in a different zone would be silently skipped/misplaced. Add a
pre-mosaic assertion: `gdalinfo -json` each source, confirm the SRS resolves to
EPSG:26912, and **raise loudly** on mismatch (do not auto-warp — surface it).
Also assert the built VRT's union extent equals `regional_bounds()` so a skipped
county fails the build instead of leaving a gap.

### 4. Clean up the fragile per-tile drape wiring (no behaviour change)

**File:** `src/topoMap/surfaceRuntime.ts` — `applyOrthoPhotoBounds` (≈ 406-441),
`sceneBoundsForImageUtmBounds` (≈ 350-373), `topoImageUtmBoundsToSceneBounds`
(≈ 58-85).

Because the terrain material is shared and the bounds inputs are
global-identical, the per-tile traversal that calls `setOrthoPhotoBounds` once
per mesh just rewrites the same shared uniform N times, and the corner-pick
origin heuristic is dead complexity. Collapse to a **single** computation + one
`setOrthoPhotoBounds` on the shared handle (drop the per-mesh loop), and replace
the min/max corner-pick with a straight `imageMin - (terrainMin - sceneMin)`
mapping. Clarity/robustness only; verify the rendered placement is
**pixel-identical** before and after (it must not move).

---

## Critical files

- `src/loaders/loadTerrain.ts` — uniform-LOD change (item 1). The load-bearing fix.
- `tools/generate-naip-regional-overview-assets.py` — revert ties (item 2),
  add CRS/extent guard (item 3).
- `src/topoMap/surfaceRuntime.ts` — drape-wiring cleanup (item 4).
- `src/scene/terrainMaterial.ts` — read-only reference (shader confirmed correct;
  do not change UV/alpha logic).

## Guardrails

- **Do not touch the source SIDs, the mosaic, or the bounds.** Proven correct;
  the bug is terrain geometry, not image registration.
- **Item 1 is the only behaviour change.** Items 2-4 are revert/guard/cleanup
  and must not alter rendered output (item 4 especially — verify pixel-identical).
- Implement **uniform LOD only**; leave neighbor-matched LOD as a flagged
  follow-up pending approval.
- CLAUDE.md output rail applies; `npm run check:workspace` before commit; stage
  exact paths.

## Verification

1. `npx tsc --noEmit` clean.
2. Launch the app on `utah-forge`, open **MT Volume Overview**: the vertical
   herringbone bands beside the FORGE site are gone at near / mid / far camera
   distances. Pan/zoom across former seam eastings — continuous terrain, no cracks.
3. Inspect `root.userData.terrainLodDebugState` (or log in `updateCameraLod`):
   all visible tiles share one tier at every distance; total vertex estimate
   stays ≤ `maxVertices`.
4. Item 4 regression: capture draped image placement before/after the cleanup
   (same camera) — must be pixel-identical.
5. Item 3: dry-run the new guard against the five EPSG:26912 sources (must pass);
   optionally a synthetic non-26912 input (must raise).
6. Item 2: confirm `iron`/`sevier` `ties == []` in the committed generator.
