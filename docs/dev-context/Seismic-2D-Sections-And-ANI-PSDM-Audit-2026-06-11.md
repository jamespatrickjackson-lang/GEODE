# Seismic 2D Sections And ANI PSDM Audit - 2026-06-11

## Scope

Audit why 2D seismic sections matching 2D survey geometry were hard to expose,
then add editor controls for all 2D sections. Also audit the GDR 1141 enhanced
3D anisotropic PSDM product named `Forge3d_ANI_PSDM_Stack_Enh.segy`.

## Render-Stack Trace

Trace commands:

- `node tools/inspect-effective-state.mjs --page 54_seismic_product_catalog --render-stack --json --only-layer utah-forge-phase3-seismic-browser --layer terrain`
- `node tools/inspect-effective-state.mjs --page 55_line_301_seismic_products --render-stack --json --only-layer utah-forge-phase3-seismic-browser --layer terrain`
- `node tools/inspect-effective-state.mjs --page 50_integrated_seismic_resistivity_context --render-stack --json --only-layer utah-forge-phase3-seismic-browser --layer terrain`

Effective terrain/context state during trace:

- Texture URL: `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/public_context/naip_2024/naip_2024_regional_8192.webp?v=684f5a7e42719aa9`
- Bounds: `[229069.2,4094688,598806,4414308]`
- Material authority: `terrainMaterial/topo-image`
- Material preset: current Utah FORGE terrain/topo image material
- Public clip state: enabled
- Material edge fade state: rounded-square edge fade, about `90000m`
- Edge outline state: disabled
- Active render preset: `user-3`
- Page 54 seismic state: product `gdr-1015-forge2d-301-migr-depth`, slice/line mode, only that product visible.
- Page 55 seismic state: Line 301 product page, slice/line mode.
- Page 50 seismic state: product `gdr-1015-forge3d-velo5d-float-01312018`, raymarch mode, velocity colormap, navigation hidden by page override.

## Findings

The active seismic manifest already contained 34 renderable products: 4 3D
raymarch-capable products and 30 section products split across 2D and legacy
2D surveys. Each 2D/legacy product already had generated section textures.

The runtime renderer already supports showing every non-3D section product at
the same time through `seismicProductVisibility`; no renderer rewrite was
needed.

Follow-up geometry review found a separate co-registration problem: the
seismic browser builder was treating SEG-Y traces as file-order image columns.
3D sections were selected from `sqrt(trace_count)`-style layouts and visible
planes were placed from the broad navigation envelope; 2D sections were reduced
to endpoint segments even when trace-header CMP coordinates were present. That
could shear or offset vertical sections and made the depth-domain scene look
co-registered when the visible geometry was not trace-derived.

The editor hid the broad all-2D behavior behind the nested technical product
visibility table. The higher-level `2D / legacy section theatre` card exposed
only curated presets for Line 301, Line 302, and L5/L11, so it looked as if the
matching survey-geometry sections were missing or limited to selected lines.

The GDR 1141 landing page describes 2D and 3D reflection outputs including
PSDM enhanced and unenhanced deliverables. The Miller 2019 appendix lists
`Forge3d_ANI_PSDM_Stack_Enh.segy` at `153,678,840` bytes and records the 3D
PSDM header details for NAD83 UTM Zone 12N, 1800 m datum, 25 m bin size, and
inline/crossline/sample trace metadata.

The local archive source zip contains a central-directory entry for
`2018-19 Reflection Processing/3D Survey/Forge3d_ANI_PSDM_Stack_Enh.segy`, but
normal Python zip extraction fails with `BadZipFile`. Byte-range checks against
the official GDR object matched the local archive bytes, so a local stale copy
was not the root cause. Local-header scanning finds the named member, but the
deflate stream fails before complete recovery with `invalid code lengths set`;
therefore no source-backed enhanced ANI PSDM render artifact can be produced
from the current official zip bytes.

GDR 1015 was checked as an alternate source path. The local GDR 1015 archive
contains GDR 1015 processed 2D products and the 3D velocity volume, including
`Forge2D-301_Migr-Depth.sgy`, `Forge2D-301_Stack_01312018.sgy`,
`Forge2D-302_Stack.sgy`, and `Forge3D_velo5D_float_01312018.sgy`. It does not
contain `Forge3d_ANI_PSDM_Stack_Enh.segy` or another enhanced 3D ANI PSDM
reflection volume.

The recoverable EBCDIC headers for the GDR 1141 3D ANI PSDM enhanced and
unenhanced members share the same NAD83 UTM Zone 12N CRS, 1800 m datum, 5 m
sample interval, 5000 m trace length, 25 m x 25 m CMP bin size, and custom CMP
coordinate byte fields. The zip central directory lists both delivered members
at `153,678,840` bytes. The enhanced header adds post-stack processing language
including `BILATERAL FILTER OFFBINS` and `FXY Decon 3x4 filter width`; the
unenhanced source remains the complete renderable depth volume. Byte size is
therefore treated as grid/geometry support together with the header evidence,
not as proof of identical amplitudes.

## Changes

`prep/build_utah_forge_seismic_browser.py` now records required zip-contained
products as product source gates. A gate becomes `available` only after the
member extracts and CRC-validates; otherwise it records a non-renderable status
such as `source-member-corrupt`.

`prep/build_utah_forge_seismic_demo_recipes.mjs` carries product source gates
into the recipes artifact and project layer metadata.

`prep/build_utah_forge_seismic_demo_recipes.mjs`,
`seismic_demo_recipes.json`, project seismic metadata, and the Utah FORGE
global seismic style now add `psdm-depth-surrogate-showcase`. The preset renders
`gdr-1141-forge3d-ani-psdm-stack-unenh` in raymarch mode as
`Presentation-enhanced PSDM surrogate - GDR 1141, unenhanced source`, with
`source-derived` provenance and an explicit note that no enhanced SEG-Y is
held. Time-domain products remain hidden in that surrogate view.

`src/editor/layerControls/seismic/SeismicCapabilityLayerContainers.tsx` now
adds first-class commands in the Seismic panel:

- `All 2D sections`
- `Survey + sections`
- `Hide 2D`

These commands derive scope from `product.surveyKind !== "3d"`, not from page
IDs or fixture names.

The same panel now includes a `Source-gated products` heading for
`3D anisotropic PSDM depth stack (enhanced)` with filename, expected size,
source citation, GDR landing page action, zip member, and status.

`prep/build_utah_forge_seismic_browser.py` now decodes trace-header geometry
for renderable SEG-Y products. Miller/GDR 1141 custom headers use CMP_X byte
189 and CMP_Y byte 193 as 4-byte IBM real values, with inline bytes 9-10 and
crossline bytes 13-14 as 2-byte integers. Standard SEG-Y coordinate fields are
fallback only when those custom CMP values are invalid. Regenerated 3D ANI PSDM
sections now carry IL/XL-derived paths and sample-plane surface grids; Line 301
GDR 1141 depth sections carry full per-trace CMP paths. The GDR 1015 migrated
depth product keeps an explicit source-unit caveat because its textual header
does not prove metric depth units.

`src/loaders/loadSeismicBrowser.ts` now renders section paths as tessellated
vertical curtains and renders sample planes from trace-derived surface grids
when present. Raymarch volumes remain axis-aligned browser envelopes and are
marked as such in metadata instead of being treated as validated oriented
volumes.

## Outcome

All existing 2D and legacy 2D section products can now be toggled on/off as a
group from the editor. The enhanced ANI PSDM product is not silently absent:
it is visible as a source-gated product, but it remains non-renderable until a
valid `Forge3d_ANI_PSDM_Stack_Enh.segy` source member is available.

The regenerated seismic artifacts now put visible sections in trace-derived
scene coordinates. The ANI PSDM unenhanced 3D product reports IL `1-170`, XL
`1-213`, 1800 m datum, 5 m sample spacing, and CMP-derived UTM corners from the
source headers. The enhanced ANI PSDM file remains source-gated and is not
substituted from the unenhanced product.

DEC-148 approves one claim-safe demo exception to the no-substitution rule:
`gdr-1141-forge3d-ani-psdm-stack-unenh` may be rendered as a
source-derived, presentation-enhanced PSDM surrogate when the UI and metadata
state that the rendered source is unenhanced and that no complete enhanced
SEG-Y is held. The source gate for `gdr-1141-forge3d-ani-psdm-stack-enh`
remains visible and non-renderable.

L5/L11 legacy sections are no longer treated as endpoint-only fallback when
trace-header CMP coordinates can be transformed plausibly from legacy NAD27
State Plane feet into EPSG:26912. They remain unvalidated for precise
registration: manifests and sections must keep `canClaimPreciseRegistration:
false`, non-validated placement wording, and review-gated CRS/status metadata.

Review pages `59_all_seismic_sections_review` and
`60_all_2d_seismic_sections_review` are deck-state review pages. They must not
be used as reusable app-runtime proof, and guards must not depend on deleted or
renumbered Utah FORGE pages such as former page 5. Runtime correctness is
protected by manifest/loader/source-gate tests, not by page fixture identity.

The 2026-06-11 integration with the Claude transition/capture branch resolved
known conflicts by keeping the regenerated trace-header seismic manifest,
preserving Claude's transition/capture runtime work, retaining the
topo-cloud/source-fidelity guards, and appending the seismic decisions after
Claude's DEC-142 through DEC-145 sequence as DEC-146 and DEC-147.

Regression guard commands:

- `node tests/tools/seismic-trace-geometry-source.test.mjs`
- `node tests/tools/seismic-product-catalog-source.test.mjs`
- `node tests/tools/utah-forge-source-fidelity-source.test.mjs`
- `npm run check:seismic-source-gates`
- `npm run check:editor-controls`

## Follow-Up

If a corrected GDR zip or standalone SEG-Y is supplied, place it in the Phase 3
source path and rerun `python prep/build_utah_forge_seismic_browser.py`, then
rerun `node prep/build_utah_forge_seismic_demo_recipes.mjs`. The existing gate
logic should move the product into the normal renderable seismic product path
after complete extraction and CRC validation.
