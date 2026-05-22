# Computed Artifact Pipeline

## Principle

GeoVox must preserve the ability to convert raw/client/public data into beautiful, technically accurate computed artifacts. Cleanup must reduce structural confusion, not reduce analytical capability, data richness, sampling quality, scalar fidelity, spatial accuracy, CRS correctness, contour fidelity, color-ramp quality, or legend/provenance clarity.

This document is a lab-book guardrail, not an app implementation and not accepted scope.

## Render / Accuracy Verification Pointer

Observed: `docs/dev-context/Render-Quality-Checks.md` now defines proposed minimum render-quality and computed-artifact-quality checks for future cleanup work.

Computed-artifact verification must cover both technical accuracy and presentation quality. Source/script/CRS/units/parameters/stats/provenance evidence is not enough if the artifact renders poorly, loses scale, breaks camera/page composition, obscures depth/material behavior, weakens color ramps or legends, or hides important client-data richness. Likewise, beautiful rendering is not enough without source, transform, unit, parameter, output-count, limitation, and provenance/status evidence.

## Artifact Metadata Wrapper Pointer

Observed: `docs/dev-context/Artifact-Metadata-Wrapper-Spec.md` now defines a lightweight metadata wrapper schema/template for future artifact identity, provenance, accuracy, render-quality, review, and load-policy notes.

Future prep outputs should eventually get metadata wrappers when human review approves placement and ownership. This pass did not change data outputs, generated artifacts, prep scripts, project manifests, pages, runtime loading, rendering, or computed artifacts.

Observed: `projects/utah-forge/artifact_metadata/` now contains the first project-local wrappers for MT station markers, MT resistivity slices, and the Phase 3 seismic browser. The wrappers preserve raw-to-computed traceability and review questions without changing artifacts or accepting demo behavior.

Observed: `projects/utah-forge/artifact_metadata/WRAPPER_COVERAGE.md` now maps which Utah FORGE artifact families are wrapped, missing wrappers, or candidate second-batch targets. Coverage review should protect raw-to-computed traceability before runtime loading, page, or config changes.

Observed: Utah FORGE batch 2A wrappers now cover MT full-density tiled data, MT scalar volume, and MT threshold surfaces. These wrappers strengthen traceability for high-fidelity MT artifacts and their load/render review state without changing artifacts, prep scripts, project manifests, pages, runtime loading, or rendering.

Observed: Utah FORGE batch 2B wrappers now cover seismic navigation/inventory/provenance, seismic recipes/presets/export layouts, and MT top surface / ground cap. These wrappers protect additional seismic source/navigation/display traceability and top-surface caveats without changing artifacts, prep scripts, project manifests, pages, runtime loading, or rendering.

Observed: historical MT/seismic verification evidence existed before the purge and was removed from reachable Git history during cleanup. Acceptance remains open until fresh focused visual/runtime evidence is captured.

Observed: `tools/report-project-artifact-coverage.mjs` now generates ignored reports under `test-results/project-artifact-coverage/` by scanning current project layers, default visibility, page references, and artifact metadata wrappers. This supports raw-to-computed traceability review without moving data, regenerating artifacts, changing manifests, changing page JSON, or changing runtime loading.

## Artifact Families

| Family | Definition | Handling principle |
| --- | --- | --- |
| raw source data | Original client, public, delivered, or preserved upstream files. | Preserve paths, filenames, provenance, licenses, and review boundaries. |
| intermediate processing state | Inventories, extracts, normalized tables, CRS/origin transforms, staging outputs, and processing notes. | Keep enough to reproduce or audit source-to-output decisions. |
| computed analytical artifacts | Derived outputs that express analysis, geometry, scalar fields, thresholds, interpolation, gridding, or interpretation aids. | Preserve computation method, parameters, units, counts, bounds, and limitations. |
| render-ready artifacts | Browser-loadable forms such as GeoJSON, mesh previews, tiled binary point clouds, scalar volumes, or texture manifests. | Preserve visual quality, load contract, material/legend behavior, and source linkage. |
| QA/validation artifacts | Outputs used to check alignment, transformation, fidelity, source correspondence, confidence, or review boundaries. | Keep separate from polished presentation layers but available for review. |
| presentation artifacts | Curated page/demo-facing outputs, display recipes, overlays, legends, and camera-support artifacts. | Preserve beauty and disclosure; avoid implying final acceptance without review. |
| provenance/status wrappers | Manifests, stats, source inventories, recipes, README status notes, caveats, and receipts. | Keep adjacent to artifacts and update contradictions rather than silently resolving them. |

## Computed Artifact Types

| Type | Definition |
| --- | --- |
| isolines | Lines connecting equal values or equal support/count levels, such as Shahbazi tie-point support isolines. |
| isobands | Filled bands between value/support ranges, such as Shahbazi tie-point support isoband mesh infill. |
| contours | Elevation or scalar linework derived from a mesh or grid, such as Shahbazi TLS and outer surface contours. |
| heat maps | Gridded or rasterized value fields used to show intensity, grade, anomaly, or support. Placeholder heat maps must stay clearly marked. |
| scalar slices | Horizontal or vertical scalar surfaces cut from a source grid/model, such as Utah FORGE MT resistivity slices. |
| scalar volumes | 3D scalar grids with transfer functions, masks, units, and display windows, such as Utah FORGE MT volumes. |
| threshold surfaces | Iso-value communication surfaces derived from scalar volumes or grids, such as Utah FORGE MT iso-resistivity surfaces. |
| seismic sections/products | Render-transcoded seismic curtains, slices, sections, raymarch volumes, navigation, recipes, and disclosure labels. |
| point-cloud tiles | Tiled binary point/scalar buffers for high-density browser rendering, such as Utah FORGE MT full-density tiles and Shahbazi TLS tiled preview. |
| mesh/surface previews | Browser-ready mesh surfaces derived from point clouds, scalar grids, or preview models. |
| station/marker products | Normalized station, ground-control, camera, or sample markers with source properties. |
| photo/texture overlays | Projected image or texture manifests and associated preview imagery. |
| legends/color ramps | Color-stop, range, label, unit, threshold, or display-window records that make scalar outputs readable. |
| statistics/manifests | Counts, bounds, ranges, masks, tile indexes, schema names, recipes, caveats, and provenance records. |

## Accuracy Requirements

Every computed artifact should ideally preserve or record:

- input files
- script/tool used
- parameters
- CRS/source coordinate basis
- scene transform
- units
- scalar transform, such as `log10`, normalization, or thresholds
- interpolation/gridding method if applicable
- contour interval or band thresholds if applicable
- downsampling/tile strategy if applicable
- masking/null handling
- output counts/stats/bounds
- provenance/status
- limitations
- review requirement

Do not call an artifact technically accurate unless evidence exists for source, CRS/transform, units, parameters, and provenance/status.

## Beauty Requirements

Every client-facing computed artifact should preserve:

- high-quality color ramp
- clean legend
- readable labels/status
- spatial coherence
- camera/page composition
- opacity/material/depth behavior
- visual richness where useful
- no false precision
- no ugly default palettes unless intentional

## Bloat Distinction

Computed complexity is not bloat.

Bloat is:

- unmanaged outputs
- orphaned artifacts
- unclear provenance
- unclear load policy
- stale docs
- eager loading everything
- project-specific logic leaking into generic runtime
- missing disposal/lifecycle contracts
- unclear default/page/QA role

## Do-Not-Damage List

Observed pipelines, scripts, and artifact families that must not be broken during cleanup:

- `prep/build_utah_forge_mt_resistivity_preview.mjs`
- `prep/build_utah_forge_mt_resistivity_full_density.mjs`
- `prep/build_utah_forge_mt_resistivity_slices.mjs`
- `prep/build_utah_forge_mt_volume_products.mjs`
- `prep/build_utah_forge_mt_top_surface.mjs`
- `prep/build_utah_forge_mt_station_markers.mjs`
- `prep/build_utah_forge_mt_station_responses.mjs`
- `prep/build_utah_forge_seismic_browser.py`
- `prep/build_utah_forge_seismic_demo_recipes.mjs`
- `prep/fetch_utah_forge_public_context.py`
- `prep/build_shahbazi_tls_surface_mesh_preview.mjs`
- `prep/build_shahbazi_tls_contours_geojson.mjs`
- `prep/build_shahbazi_outer_surface_preview.mjs`
- `prep/build_shahbazi_tie_point_support_isolines_geojson.mjs`
- Utah FORGE MT source inventories, CRS transform, stats, provenance, full-density tiles, scalar volumes, threshold surfaces, top surface, slices, station markers, and legends
- Utah FORGE seismic source inventory, navigation, browser manifest, products, recipes, provenance, section products, and raymarch products
- Shahbazi raw source data, TLS previews, tiled point-cloud preview, mesh previews, contour products, projected photo overlay, camera/frustum QA, object-point QA, tie-point support isolines, and isoband mesh
- Woodjam top-level data references until project-local ownership and provenance are clarified

## Current Risks

- Observed: Utah seismic has active/generated evidence and remains human-review work for final default/demo behavior.
- Observed: Utah full-density MT is currently default-visible, but load/presentation policy is still a human decision.
- Observed: Some computed artifacts have strong provenance files, while others have path evidence only. Do not generalize accuracy status across projects.
- Proposed: The next safe structural move is provenance/status classification, not reducing sample density or simplifying computed outputs.

## Observed Pipeline Map

These rows map observed source-to-artifact paths only. They do not approve source moves, output renames, visibility changes, script edits, or regenerated data.

### Utah FORGE

| pipeline_id | project | source inputs | processing scripts | intermediate outputs | computed artifacts | render-ready outputs | consumed by layer IDs | artifact type | accuracy-critical metadata found | missing metadata | render-quality dependencies | risk if cleanup/refactor touches it | human review required? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PIPE-UT-MT-INTAKE | Utah FORGE | Historical MT EDI/model packages and PRJ references; source packages were purged from active repo and are mapped in `docs/archive-map.md` | `prep/utah_forge_config.mjs`; source inventory remains upstream of MT build scripts | `intake/source_inventory.json`, `archive_entries.json`, `crs_transform.json`, `crs_origin_note.md` | Source inventory and transform wrappers | Metadata wrappers, not direct render output | Downstream MT layers | other | CRS, transform/origin, source inventory, archive entries | Unified processing manifest; explicit acceptance status | Provenance/status clarity | Very high: breaking intake wrappers weakens every MT output. | Yes |
| PIPE-UT-MT-STATIONS | Utah FORGE | MT EDI station files | `prep/build_utah_forge_mt_station_markers.mjs`; `prep/build_utah_forge_mt_station_responses.mjs` | Temporary EDI extraction and station-response parsing | Station markers; station response QC | `stations/mt_stations.geojson`, `stations/mt_stations.provenance.json`, `volume/stations/mt_station_response_qc.json` | `utah-forge-mt-stations`; support for `utah-forge-mt-resistivity-volume` | station/marker | CRS, transform/origin, units, counts, provenance | Human-accepted QA status | Marker styling, labels, station visibility | High: station positions anchor MT credibility. | Yes |
| PIPE-UT-MT-PREVIEW-AND-FULL-DENSITY | Utah FORGE | Updated Phase 3 MT cell-center model | `prep/build_utah_forge_mt_resistivity_preview.mjs`; `prep/build_utah_forge_mt_resistivity_full_density.mjs` | `model_stats.json`, `model_provenance.json`, `resistivity_point_preview.json` | Downsampled point preview; full-density tiled scalar point cloud | `resistivity_point_preview.json`; `full_density/manifest.json`; `full_density/tiles/*.positions.bin`; `*.scalars.bin`; `full_density/stats.json`; `full_density/provenance.json` | `utah-forge-mt-resistivity-preview`; `utah-forge-mt-resistivity-full-density` | point cloud tile | CRS, transform/origin, scalar transform `log10`, stats/counts, provenance, tile count | Accepted load/default policy | Scalar color ramp, point size, opacity, tile ordering, legend/status | Very high: downsampling or tile edits can damage scalar fidelity and visual richness. | Yes |
| PIPE-UT-MT-VOLUME-AND-THRESHOLDS | Utah FORGE | Positive MT cell-center model rows; `model_stats.json`; station context | `prep/build_utah_forge_mt_volume_products.mjs` | Volume accumulators; mask arrays; focused and full-extent products | Scalar volume products; threshold surfaces | `volume/mt_volume_manifest.json`; `volume/*/volume.u8`; `mask.u8`; stats/provenance; `volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json`; provenance | `utah-forge-mt-resistivity-volume`; `utah-forge-mt-resistivity-threshold-surfaces` | scalar volume, threshold surface | Units, scalar transform, volume dimensions, masks, thresholds, stats, provenance | Human-accepted threshold meaning and presentation role | Raymarch transfer, mask opacity, threshold colors, depth/material behavior | Very high: thresholds/volumes are easy to misrepresent if simplified. | Yes |
| PIPE-UT-MT-SLICES-AND-TOP-SURFACE | Utah FORGE | MT point preview, full model stats, station markers | `prep/build_utah_forge_mt_resistivity_slices.mjs`; `prep/build_utah_forge_mt_top_surface.mjs` | Slice summaries; grid/bin state; top-surface stats | Authored horizontal/vertical resistivity slices; approximate preview-derived ground cap | `slices/resistivity_slices_mesh_preview.json`; `slices/manifest.json`; `slices/legend.json`; `slices/resistivity_slices.provenance.json`; `top_surface/mt_top_surface_mesh_preview.json`; manifest/stats/provenance | `utah-forge-mt-resistivity-slices`; `utah-forge-mt-top-surface` | scalar slice, mesh/surface | Units, scalar transform, slice windows, stats, legend, provenance; top-surface method | Accepted page/default role; explicit review of top-surface caveats | Slice color ramp, legend, opacity, top-surface material/depth behavior | Very high: slices and top cap are presentation-critical and technically nuanced. | Yes |
| PIPE-UT-PUBLIC-CONTEXT | Utah FORGE | Public terrain/road/hydro services; MT full-density bounds | `prep/fetch_utah_forge_public_context.py` | Full-density bbox; clipped public feature collections; public context manifest | Public terrain, roads, streams, lakes | `public_context/terrain_public_context_1000m.tif`; `terrain_public_context_200m.tif`; `roads.geojson`; `hydrography_streams.geojson`; `hydrography_lakes.geojson`; `manifest.json` | `terrain`; `transport-roads`; `hydrography-streams`; `hydrography-lakes` | mesh/surface, other | CRS/source service basis, transform/origin, clipping bounds, manifest | Acceptance of public context/default role | Terrain resolution, context extent, line/polygon styling | High: context edits can harm spatial orientation and visual polish. | Yes |
| PIPE-UT-SEISMIC-BROWSER | Utah FORGE | GDR 1015/1141 processed seismic products and SEG-P1/navigation inputs | `prep/build_utah_forge_seismic_browser.py` | Source inventory, navigation, amplitude stats, section specs, raymarch volume specs | Seismic sections, 3D raymarch volumes, product manifest, provenance | `seismic_analysis/browser/seismic_manifest.json`; `products/*/*.u8`; `inventory/seismic_source_inventory.json`; `navigation/seismic_navigation.geojson`; `browser/provenance.json` | `utah-forge-phase3-seismic-browser` | seismic product | Source files, units/domain, datum, navigation, amplitude stats, section/sample metadata, provenance | Human-accepted default behavior | Seismic colormap, opacity, navigation, raymarch transfer, section placement, disclosure labels | Very high: seismic is needed and underway, but provenance/default behavior remains sensitive. | Yes |
| PIPE-UT-SEISMIC-RECIPES | Utah FORGE | Seismic browser manifest | `prep/build_utah_forge_seismic_demo_recipes.mjs` | Display recipe and preset derivation from manifest products | Demo recipes, audience presets, capability presets, export layouts | `seismic_analysis/browser/seismic_demo_recipes.json`; updated manifest fields when script is run | `utah-forge-phase3-seismic-browser` metadata/presets | seismic product, other | Product ids, display recipes, disclosure labels, camera/output intent | Human acceptance of any demo recipe or export layout | Preset visuals, legend, camera shot, source disclosure | High: recipe edits can silently change what client-facing seismic means. | Yes |

### Case Study B / Shahbazi

| pipeline_id | project | source inputs | processing scripts | intermediate outputs | computed artifacts | render-ready outputs | consumed by layer IDs | artifact type | accuracy-critical metadata found | missing metadata | render-quality dependencies | risk if cleanup/refactor touches it | human review required? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PIPE-SHAHBAZI-TLS-POINTS | Case Study B / Shahbazi | `data/raw/shahbazi_gravel_pit/LaserScan.xyz` | `prep/build_shahbazi_tls_preview.mjs`; `prep/build_shahbazi_tls_tiled_preview.mjs` | TLS preview provenance; tile grid state | Sampled TLS point preview; higher-density tiled TLS preview | `tls_preview_points.json`; `tls_preview_points.provenance.json`; `tls_tiled_preview/manifest.json`; `tls_tiled_preview/*.bin`; provenance | `shahbazi-tls-subzone`; `shahbazi-tls-tiled-preview` | point cloud tile | Transform/origin, source bounds, sampling/tiling, counts, provenance | Final CRS/orientation review; production point-cloud target | Point size, density, color/height ramp, tile loading | Very high: point thinning or transform drift weakens high-fidelity terrain view. | Yes |
| PIPE-SHAHBAZI-SURFACES-AND-CONTOURS | Case Study B / Shahbazi | `LaserScan.xyz`; object-point preview; TLS surface mesh | `prep/build_shahbazi_tls_surface_mesh_preview.mjs`; `prep/build_shahbazi_tls_contours_geojson.mjs`; `prep/build_shahbazi_outer_surface_preview.mjs` | TLS mesh preview; outer object-point surface; contour extraction state | TLS island mesh, outer surface mesh, TLS contours, outer surface contours | `tls_surface_mesh_preview.json`; `outer_surface_mesh_preview.json`; `tls_surface_contours.geojson`; `outer_surface_contours.geojson`; provenance files | `shahbazi-tls-surface-preview`; `shahbazi-tls-contours` | mesh/surface, contour | Source dependency, grid/gap policy, contour interval, transform, provenance | Production survey acceptance; full-resolution surface target | Surface material, split-surface depth policy, contour styling | Very high: surfaces/contours are the main visual credibility layer. | Yes |
| PIPE-SHAHBAZI-PHOTOGRAMMETRY-QA | Case Study B / Shahbazi | `GCPs.txt`; `RefinedEOPs.txt`; `DirectEOPs.txt`; `TimeStamps.txt`; `RefinedIOPs.txt`; `DenseMatching.txt`; `ObjectPoints.txt`; `TiePoints.txt` | `prep/build_shahbazi_gcp_geojson.mjs`; `prep/build_shahbazi_camera_poses_geojson.mjs`; `prep/build_shahbazi_camera_frustums_geojson.mjs`; `prep/build_shahbazi_dense_matching_links_geojson.mjs`; `prep/build_shahbazi_object_points_preview.mjs` | TLS-aligned transform; camera/object/tie statistics | GCP markers, camera paths, frustums, dense matching links, sparse object-point QA | `ground_control_points.geojson`; `camera_poses.geojson`; `camera_frustums.geojson`; `dense_matching_links.geojson`; `object_points_preview.json`; provenance files | `shahbazi-ground-control`; `shahbazi-camera-poses`; `shahbazi-camera-frustums`; `shahbazi-dense-matching-links`; `shahbazi-object-points` | station/marker, point cloud, other | Source files, transform, orientation caveats, counts, provenance | Final camera/orientation acceptance | Marker labels, path/frustum readability, QA colors | High: QA layers protect trust and explain source alignment. | Yes |
| PIPE-SHAHBAZI-TIEPOINT-SUPPORT | Case Study B / Shahbazi | `object_points_preview.json` and tie observation counts | `prep/build_shahbazi_tie_point_support_isolines_geojson.mjs` | Interpolated support grid | Tie-point support isolines and isoband mesh | `tie_point_support_isolines.geojson`; `tie_point_support_isobands_mesh.json`; provenance files | `shahbazi-tie-point-support-isolines` | isolines, isobands | Input preview, interpolation method, observation levels, segment/triangle counts, provenance | Human-reviewed QA interpretation language | Line styling, color ramp, infill opacity | Very high: this is an analytical QA output, not decorative clutter. | Yes |
| PIPE-SHAHBAZI-PHOTO-OVERLAY | Case Study B / Shahbazi | Selected downsampled UAV images; camera model; processed preview surfaces | `prep/build_shahbazi_photo_overlay_preview.mjs` | Projected image selection and surface dependencies | Projected photo overlay preview | `photo_overlay_preview/photo_overlay_manifest.json`; provenance and image previews | `shahbazi-photo-overlay-preview` | photo/texture overlay | Selected image ids, camera model, projection method, source surfaces, provenance | Final orthomosaic/texture acceptance | Texture sharpness, projection alignment, opacity/material behavior | Very high: overlay carries beauty and can imply precision if unlabeled. | Yes |

### Woodjam

| pipeline_id | project | source inputs | processing scripts | intermediate outputs | computed artifacts | render-ready outputs | consumed by layer IDs | artifact type | accuracy-critical metadata found | missing metadata | render-quality dependencies | risk if cleanup/refactor touches it | human review required? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PIPE-WOODJAM-TOP-LEVEL-DATA | Woodjam | Top-level `data/` render-ready files plus archived `data/source/` source buckets mapped in `docs/archive-map.md` | `prep/fetch_*.py`; `prep/reproject_drills.py`; `prep/inspect_terrain.py`; source/raw prep assets | Top-level GeoJSON/TIF outputs; BC geology raw prep files | Render-ready project context, drilling/assay/geochem/geology/infrastructure layers | `data/*.geojson`; `data/terrain_woodjam.tif`; selected source-derived references where still intentionally present | `terrain`; `drillholes-2023`; `drillholes-2024-tf`; `assay-samples`; `geochem-soils-2024`; `ip-survey-lines-2024`; `hyperspectral-coverage-2024`; `imagery-lidar-aoi-2024`; `ez-gamma-2024`; `hydrography-lakes`; `bedrock-geology`; `claim-boundary`; `transport-roads`; `power-lines`; `property-neighbors`; `trees-vri`; `hydrography-streams` | heat map, station/marker, mesh/surface, other | File paths and source folders observed; archive map now owns source-bucket recovery. | Project-local ownership, per-artifact provenance/status wrappers, units, transform/origin, scalar/legend metadata for several families | Terrain/geology colors, drill/assay symbols, geochem/gamma palettes, context line styling | Very high: moving render-ready top-level data or flattening legends can break Woodjam and regression coverage; archived source buckets should not be recommitted. | Yes |
| PIPE-WOODJAM-PLACEHOLDER-INTERPRETATION | Woodjam | Manifest-only target/anomaly layer definitions | Not observed as source-backed pipeline in this pass | None observed | Placeholder/draft interpretation shapes | Manifest-defined or procedural layer state | `area-outlines`; `three-firs-target`; `great-plains-target`; `megaton-dcip-anomaly` | other | Layer IDs observed | Source files, parameters, provenance, acceptance status | Interpretation colors and labels | High if placeholder targets are treated as accepted project evidence. | Yes |

### Base GUI

| pipeline_id | project | source inputs | processing scripts | intermediate outputs | computed artifacts | render-ready outputs | consumed by layer IDs | artifact type | accuracy-critical metadata found | missing metadata | render-quality dependencies | risk if cleanup/refactor touches it | human review required? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PIPE-BASE-GUI-REFERENCE | Base GUI | None observed; blank/default authoring context | None observed | None observed | Placeholder reference stage | Manifest/default procedural layer | `base-gui-reference-stage` | other | Template status observed | Not applicable unless promoted to real data | Basic reference-frame clarity | Low if kept template-only; high if confused with project data. | Yes |

## Pipeline Protection Rules

- Do not move source inputs without updating `docs/archive-map.md` and pipeline references.
- Do not rename generated outputs without updating manifests/project layers.
- Do not delete QA outputs until human review.
- Do not compress/downsample further without recording parameters and visual/technical impact.
- Do not change color ramps/scalar ranges without preserving legend/provenance.
- Do not treat generated artifacts as junk merely because they are numerous.
- Do not run heavy scripts during audit/planning prompts.
- Do not change prep scripts without adding/refreshing provenance/status wrappers.

## Candidate Future Improvements

These are proposed only and are not implementation approval.

| Candidate | Proposed purpose | Status |
| --- | --- | --- |
| Unified processing manifest | Connect source inputs, scripts, parameters, outputs, layer IDs, and provenance in one machine-readable wrapper. | Proposed / needs human review |
| Per-artifact metadata wrapper | Give each render-ready artifact source, script, CRS/transform, units, parameters, stats, limitations, and acceptance status. | Proposed / needs human review |
| Reusable prep CLI | Standardize dry-run, inspect, build, and evidence-output modes across prep scripts without reducing output fidelity. | Proposed / needs human review |
| Artifact acceptance checklist | Human-reviewed checklist before calling any artifact accepted for client-facing use. | Proposed / needs human review |
| Render-quality evidence | Focused render evidence for color ramps, camera composition, depth/material behavior, labels, and legends. | Proposed / needs human review |
| Output manifest standard | Shared schema for tiles, volumes, meshes, contours, overlays, legends, and stats. | Proposed / needs human review |
| QA artifact retention policy | Decide what QA outputs are preserved, hidden, page-scoped, or archived without deleting source evidence. | Proposed / needs human review |
