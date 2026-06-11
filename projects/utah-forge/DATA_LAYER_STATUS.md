# Utah FORGE Data and Layer Status

Status: docs only - no runtime behavior, no manifest change, no scope commitment.

Source of truth for runtime and data state: current project manifests, environment JSON, page JSON, and generated artifact files. This file summarizes their observed state for orientation and review routing.

---

## Source / Client Data (Archived)

These files are outside the active repo at `C:\GeoSee\GeoSee_Archive`. Do not recommit source bytes.

| Dataset | Archive path | Notes |
| --- | --- | --- |
| MT EDI files | `...client_preprocessed/utah_forge_phase_3/electrical_resistivity/mt_edis/FORGE_MT_190812_EDIs.zip` | 122 stations, 244 EDI variants. EPSG:26912. |
| MT cell-center model | `...client_preprocessed/utah_forge_phase_3/electrical_resistivity/mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip` | 1,094,940 source rows; upstream truth for all MT products. |
| MT projection reference | `...client_preprocessed/utah_forge_phase_3/electrical_resistivity/references/FORGE_MT_12_12_2021.prj` | PRJ/CRS basis for scene transform. |
| Phase 3 seismic source | `C:\GeoSee\GeoSee_Archive` (path via `docs/archive-map.md`) | GDR 1015 / GDR 1141 processed products. |

---

## Processed / Browser-Ready

Files under `geosee_processed/` in the active repo, generated from the archived source.

### MT Intake and Provenance

| File | Role |
| --- | --- |
| `intake/source_inventory.json` | Source file registry |
| `intake/archive_entries.json` | Archive record |
| `intake/crs_transform.json` | CRS and scene-origin contract |
| `intake/crs_origin_note.md` | Human-readable CRS note |
| `resistivity_model/model_stats.json` | Point counts, masking, log transform record |
| `resistivity_model/model_provenance.json` | Source-to-product trace |

### MT Station Markers

| Artifact | File | Observed state |
| --- | --- | --- |
| MT station GeoJSON | `stations/mt_stations.geojson` | 122 physical station markers, 244 EDI variants in properties. Measured classification. |
| Station provenance | `stations/mt_stations.provenance.json` | Source/transform documented. |

### MT Resistivity Model Products

| Artifact | File / path | Status | Notes |
| --- | --- | --- | --- |
| Point QA subset | `resistivity_model/resistivity_point_preview.json` | QA/validation; not default-visible. | 90,000 emitted points, log10(ohm-m). Not a substitute for full-density data. |
| Full-density tiled points | `resistivity_model/full_density/` | Default-visible; high-fidelity client layer. | 1,094,624 points; 11 tiles; Float32 XYZ + scalar buffers. |
| Scalar volume | `resistivity_model/volume/mt_volume_manifest.json` | Wired; not default-visible. | 2 products; dimensions, scalar, mask, and stats recorded in manifest. |
| Threshold surfaces | `resistivity_model/volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json` | Wired; page 08 makes it visible. | Marching Cubes isosurfaces from scalar volume, mask-aware. |
| Authored slices | `resistivity_model/slices/resistivity_slices_mesh_preview.json` | Wired; page 11 makes it visible. | 6 horizontal slices + 2 vertical sections; legend at `slices/legend.json`. |
| Observed top-envelope surface | `resistivity_model/top_envelope_surface/mt_top_envelope_surface_mesh_preview.json` | Wired; not default-visible. | 23,811 vertices; top-most observed full-density cell-center points per XY column; bridge triangles above 10,000 m dropped. UI-facing MT Top Surface control routes here. |
| Top-contact support surface | `resistivity_model/top_contact_surface/mt_top_contact_surface_mesh_preview.json` | Retained; not default-visible. | 10,509 vertices; full-extent support grid; retained as technical endpoint / provenance history. |
| QA-subset-derived ground cap | `resistivity_model/top_surface/mt_top_surface_mesh_preview.json` | Retained history/support; not UI-facing. | 1,135 vertices from 90,000-point QA subset. Not promoted to UI top-surface control. |

### Phase 3 Seismic Browser Products

| Artifact | File / path | Status | Notes |
| --- | --- | --- | --- |
| Seismic browser manifest | `seismic_analysis/browser/seismic_manifest.json` | Active; wired in project files. | 34 products; 4 with raymarch volume; 30 section-only; 66 total sections. Source SEG-Y vertical datum is parsed into product metadata; rendered Z uses `sceneZ_m = datumM - sample * verticalScaleMPerUnit`. |
| Demo recipes | `seismic_analysis/browser/seismic_demo_recipes.json` | Wired; not accepted demo scope. | Needs human review before locking presentation behavior. |
| Source inventory | `seismic_analysis/inventory/seismic_source_inventory.json` | Provenance/QA. | GDR 1015/GDR 1141 source records. |
| Navigation GeoJSON | `seismic_analysis/navigation/seismic_navigation.geojson` | Provenance/QA. | CRS/navigation review still required before survey-grade accuracy claims; seismic product vertical datum metadata is recorded separately in the browser manifest. |
| Raymarch volume products (x4) | `seismic_analysis/browser/products/*/volume.u8` | High-fidelity; load by page. | Amplitude encoding, bounds, sample units recorded in manifest. |
| Section-only products (x30) | `seismic_analysis/browser/products/*/section.u8` | Technical credibility; load by page. | 66 total sections including sections from 3D products. |

Legacy L5/L11 placement: current L5/L11 products use explicit approximate fallback endpoints because no delivered navigation line is present in the active source set. They are useful as visual/reference section curtains only. Their manifest `navigationPlacement` records `navigationSource: "fallback"`, `placementAccuracy: "approximate"`, and `canClaimPreciseRegistration: false`. Precise registration requires delivered navigation or georeferenced control-point validation with stored residual error.

### Public Context

| Artifact | File | Status |
| --- | --- | --- |
| Terrain | `public_context/terrain_public_context_1000m.tif` | Default-visible full-extent public source. 200 m crop retained as support/history data. |
| Roads | `public_context/roads.geojson` | Default-visible. Public source. |
| Streams | `public_context/hydrography_streams.geojson` | Default-visible. Public source. |
| Lakes | `public_context/hydrography_lakes.geojson` | Default-visible. Public source. |
| Context manifest | `public_context/manifest.json` | Provenance wrapper for public context package. |

---

## QA / Validation (Not Default-Visible)

| Artifact | Layer ID | Role |
| --- | --- | --- |
| MT QA subset points | `utah-forge-mt-resistivity-preview` | QA/support only. The 90,000-point subset is not computational input for slices, sections, or volumes. |
| MT stations | `utah-forge-mt-stations` | Measured location anchors. Show on technical review pages. |
| Seismic source inventory | n/a | Source-to-product trace. Not wired as a runtime layer. |
| Seismic navigation | n/a | Line/segment placement record. Needs CRS/navigation review; source-header vertical datum parsing is handled in the seismic browser manifest. |
| MT intake wrappers | n/a | CRS/transform contract files. |
| MT model stats / provenance | n/a | Counts, masking, log transform, vertical exaggeration record. |

---

## Unclear / Future / Parked

| Artifact | Status | Notes |
| --- | --- | --- |
| `utah-forge-reference-stage` | Placeholder. No files observed. | Procedural fallback shell. Do not promote as real project data. |
| `utah-forge-phase3-working-area` | Active presentation footprint. | Generated geometry; spatial context only. |
| Southwestern / regional MT | Not active. | `forge_southwestern/electrical_resistivity/` exists as a folder stub only. No products wired. |
| Seismic default demo behavior | Unresolved. | Final demo loading/visibility policy pending human review. |
| Seismic provenance/disclosure wording | Unresolved. | Older data READMEs contradict current generated browser state; human review needed. |

---

## Coordinate Frame Reference

```
CRS:                EPSG:26912 / NAD83 UTM Zone 12N
Units:              meters
GeoSee axes:        local X east, Y north, Z up
Project origin:     E 341467.35 m, N 4273374.5 m, Z 0 m
Registration gate:  unverified until horizontal CRS, vertical datum, origin, rotation, and control-point evidence pass
Crop:               none
Vertical exag.:     1.0
```

Imported source coordinates must declare their source CRS before scene conversion. The import path transforms source coordinates into the Utah FORGE project horizontal frame, then subtracts the GeoSee project origin. Direct source-coordinate minus origin conversion is not accepted unless the source CRS is explicitly recorded as the project CRS and the layer registration metadata records that fact.

Seismic vertical reference: browser-ready seismic panels and raymarch volumes render in absolute scene elevation metres. The source SEG-Y vertical datum is parsed per product when present, with 1800 m ASL as the fallback/reference datum. Phase 2B structure-contour depth references are treated as depth below 1800 m ASL unless a source product explicitly records another datum. Velocity products expose a 2000-5000 m/s display range in metadata. Visual calibration against well 58-32 remains pending because the active demo borehole layer does not include 58-32.

Bore Holes registry: Utah FORGE `FORGE Data` treats boreholes as their own `Bore Holes` container with a shared, composable visual-element kit (line, ground torus, ground ball, crosshair, depth trace, optional SVG icon on top) applied to every borehole. Element styling is shared and show/hide is per borehole; the app-level layer style is the source of truth and pages carry only small per-borehole diffs (deep-merged). See DEC-143. Trajectory geometry remains limited to `16A(78)-32` and `16B(78)-32`. `58-32`, `78B-32`, and the unnamed seismic candidates (`BOR1`, `BOR2`, `BOR3`) now render as source-location markers by default from their GDR 1358 surface coordinates — claim-safe as source-location-only, not trajectory or calibration geometry (`BOR2` ships hidden via its per-borehole flag). `Acord-1` and `FDST / FORGE test drill site` remain registry-only with no active source geometry and must not be used for geometry, registration, or calibration claims.

Bore Holes source lookup: GDR 1358 provides source location rows for `58-32`, `16A-32`, `78B-32`, and seismic candidate rows `BOR1`, `BOR2`, and `BOR3`. The 16B entry is backed by the existing GDR 1516 trajectory source. No `Acord-1` or `FDST / FORGE test drill site` row was found in the active GDR 1358 well/seismic locations CSV or active borehole trajectory sources.

Registration status: all active Utah FORGE runtime layers currently remain `unverified` for survey-grade accuracy claims. Metadata now records the required horizontal CRS, vertical datum, coordinate basis, origin, rotation, and registration status fields. `validated` must not be used until control-point checks are recorded for the relevant layer family.

Fallback placement rule: any seismic product or section with `navigationSource: "fallback"` is excluded from precise scale/registration assertions. UI, recipes, exports, and QA summaries must show approximate-placement status and must not label the fallback product as CRS verified, survey accurate, or true scale.

---

## Review Gate

Do not accept a Utah FORGE artifact as technically accurate without evidence covering: source input identity, CRS/transform, units, scalar name, parameters, point/vertex/tile counts, provenance/status wrapper, and any known limitations. Do not accept as client-ready without visual rendering and presentation context checked by a human.
