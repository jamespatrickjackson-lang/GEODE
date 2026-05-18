# Utah FORGE Data / Layer Status

Last populated: 2026-05-15

## Purpose

This file is project-local status guidance. It is not official DHF and does not change runtime behavior. It records observed Utah FORGE data/layer state so future humans, AI, and Codex sessions can reduce structural confusion without reducing rendering quality or damaging the raw-data-to-computed-artifact pipeline.

## Current human context

- Observed: Seismic is needed and underway.
- Observed: Rendering quality must not be compromised.
- Observed: Computed artifact generation must not be compromised.
- Observed: Bloat reduction means structural clarity, not visual downgrade.
- Observed: Final demo/time-pressure goals are pending.
- Observed: Software/local files are deterministic state; AI interpretation is proposal; human review owns acceptance.

## Source/client/public data

| Data family | Observed path | Status | Notes |
| --- | --- | --- | --- |
| Phase 3 MT source packages | `projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity/` | Observed source/client data | Includes MT EDI archive, updated MT cell-center model archive, and PRJ/reference material. Do not move or rewrite without approval. |
| Phase 3 seismic source packages | `projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/seismic_analysis/source/` | Observed source/client data | GDR 1015/1141 processed seismic products are referenced by the current seismic browser manifest. Older docs still say seismic was blocked. Latest human context says seismic is needed and underway. |
| Forge Southwestern / regional staging | `projects/utah-forge/data/client_preprocessed/forge_southwestern/` and matching `geosee_processed/forge_southwestern/` slots | Observed reserved/inactive | Existing docs describe this as reserved/not active. Do not promote without human review. |
| Public context source services | Public terrain, roads, streams, and lakes fetched by `prep/fetch_utah_forge_public_context.py` | Observed public data path | Used to create terrain and vector context around the MT footprint. Public context default role still needs human review. |
| Data references | `projects/utah-forge/data_refs/README.md` | Observed reference/staging guide | Useful as intake guidance, not acceptance of any future dataset. |

## Intermediate processing state

| Family | Observed path | Status | Notes |
| --- | --- | --- | --- |
| MT intake inventory | `geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/source_inventory.json` and `.md` | Observed intermediate/status wrapper | Source inventory for Phase 3 MT. |
| MT archive entries | `geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/archive_entries.json` | Observed intermediate/status wrapper | Records source archive contents. |
| MT CRS/origin contract | `geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/crs_transform.json`, `crs_origin_note.md` | Observed intermediate/status wrapper | Records EPSG:26912 / NAD83 UTM Zone 12N, scene origin, local meters, and transform basis. |
| MT model stats/provenance | `resistivity_model/model_stats.json`, `model_provenance.json` | Observed provenance/status wrapper | Records source rows, positive rows, masked rows, scalar transform, bounds, no crop, and vertical exaggeration 1.0. |
| Public context manifest | `geosee_processed/utah_forge_phase_3/public_context/manifest.json` | Observed provenance/status wrapper | Records public-context clipping/fetch state. |
| Seismic inventory/navigation/provenance | `seismic_analysis/inventory/seismic_source_inventory.json`, `navigation/seismic_navigation.geojson`, `browser/provenance.json` | Observed seismic provenance/status wrappers | Needed for seismic placement, source disclosure, and review. |

## Processed/browser-ready data

| Family | Observed paths | Consumed by layer IDs | Status |
| --- | --- | --- | --- |
| Public context | `public_context/terrain_public_context_1000m.tif`, `terrain_public_context_200m.tif`, `roads.geojson`, `hydrography_streams.geojson`, `hydrography_lakes.geojson` | `terrain`, `transport-roads`, `hydrography-streams`, `hydrography-lakes` | Observed browser-ready public context; default role needs human review. |
| MT station markers | `electrical_resistivity/stations/mt_stations.geojson` | `utah-forge-mt-stations` | Observed measured station-marker output. |
| MT point preview | `resistivity_model/resistivity_point_preview.json` | `utah-forge-mt-resistivity-preview` | Observed 90,000-point QA/validation preview. |
| MT full-density tiles | `resistivity_model/full_density/manifest.json`, `tiles/*.positions.bin`, `tiles/*.scalars.bin` | `utah-forge-mt-resistivity-full-density` | Observed full-density tiled scalar point cloud: 11 tiles, 1,094,624 points. |
| MT scalar volumes | `resistivity_model/volume/mt_volume_manifest.json`, `volume.u8`, `mask.u8`, stats/provenance | `utah-forge-mt-resistivity-volume` | Observed 2 scalar-volume products. |
| MT threshold surfaces | `resistivity_model/volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json` | `utah-forge-mt-resistivity-threshold-surfaces` | Observed source-derived iso-resistivity communication surfaces. |
| MT top surface | `resistivity_model/top_surface/mt_top_surface_mesh_preview.json` | `utah-forge-mt-top-surface` | Observed preview-derived approximate ground cap, not measured terrain or interpreted geology. |
| MT slices | `resistivity_model/slices/resistivity_slices_mesh_preview.json`, `manifest.json`, `legend.json` | `utah-forge-mt-resistivity-slices` | Observed authored horizontal and vertical resistivity slice preview. |
| Seismic browser | `seismic_analysis/browser/seismic_manifest.json`, `seismic_demo_recipes.json`, `products/*/*.u8` | `utah-forge-phase3-seismic-browser` | Observed active browser-ready seismic artifact set. Older README status contradicts this. |

## Computed analytical artifacts

| Artifact family | Observed status | Notes |
| --- | --- | --- |
| Isolines / isobands / contours | Not observed as Utah FORGE render layers in this pass | Do not infer absence from future capability; just not observed in current Utah layer set. |
| Heat maps | Not observed as Utah FORGE render layers in this pass | No explicit heat-map output was identified for current Utah FORGE. |
| Slices | Observed | MT slices include 6 horizontal slices and 2 vertical sections, with manifest, legend, and provenance. |
| Scalar volumes | Observed | MT volume manifest contains full-extent and FORGE-focused products. |
| Threshold surfaces | Observed | Source-derived iso-resistivity communication surfaces generated from focused MT scalar volume. |
| Seismic products | Observed | Seismic browser manifest records 34 products, 4 raymarch-capable 3D products, 30 section-only products, and 66 total sections. |
| Station-response products | Observed | `volume/stations/mt_station_response_qc.json` exists as station response QC support. |
| Meshes / surfaces | Observed | MT top surface, threshold surfaces, and slice meshes are browser-ready mesh previews. |
| Point/scalar tiles | Observed | MT full-density layer uses tiled Float32 XYZ plus Float32 scalar buffers. |
| Stats / manifests / provenance | Observed | MT and seismic artifacts have multiple stats, manifest, legend, inventory, and provenance wrappers. Human acceptance status remains separate. |

## Render-ready artifacts

These artifacts appear consumable by the app/browser through `project.json` layer records, `previewFiles`, support files, or runtime loader contracts. Render-ready does not mean accepted for demo use.

| Artifact | Observed path / contract | Consumed by layer IDs | Status / caveat |
| --- | --- | --- | --- |
| Public terrain and vectors | `public_context/terrain_public_context_*.tif`, `roads.geojson`, `hydrography_*.geojson` | `terrain`, `transport-roads`, `hydrography-streams`, `hydrography-lakes` | Observed render-ready public context. Styling/default role still needs review. |
| MT station markers | `electrical_resistivity/stations/mt_stations.geojson` | `utah-forge-mt-stations` | Observed render-ready station network. |
| MT point preview | `resistivity_model/resistivity_point_preview.json` | `utah-forge-mt-resistivity-preview` | Observed render-ready preview; QA/validation role, not a replacement for full density. |
| MT full-density scalar point tiles | `resistivity_model/full_density/manifest.json`, `tiles/*.positions.bin`, `tiles/*.scalars.bin` | `utah-forge-mt-resistivity-full-density` | Observed render-ready high-fidelity point/scalar tile product. |
| MT scalar volumes | `resistivity_model/volume/mt_volume_manifest.json`, `volume.u8`, `mask.u8` | `utah-forge-mt-resistivity-volume` | Observed render-ready volume products; presentation role needs human review. |
| MT threshold/top/slice meshes | `threshold_surfaces/*mesh_preview.json`, `top_surface/*mesh_preview.json`, `slices/*mesh_preview.json` | `utah-forge-mt-resistivity-threshold-surfaces`, `utah-forge-mt-top-surface`, `utah-forge-mt-resistivity-slices` | Observed render-ready mesh/surface/slice previews. |
| Seismic browser products | `seismic_analysis/browser/seismic_manifest.json`, `seismic_demo_recipes.json`, `products/*/*.u8` | `utah-forge-phase3-seismic-browser` | Observed render-ready seismic product set; old blocked/not-active docs contradict this state. |

## QA / validation artifacts

| Artifact | Observed path | QA / validation role | Caveat |
| --- | --- | --- | --- |
| MT source inventory | `electrical_resistivity/intake/source_inventory.json` and `.md` | Source-package accounting and intake review. | Does not by itself accept derived outputs. |
| MT archive entries | `electrical_resistivity/intake/archive_entries.json` | Archive contents and source trace. | Needs preservation if source packages move later. |
| MT CRS/origin records | `electrical_resistivity/intake/crs_transform.json`, `crs_origin_note.md` | CRS, origin, local-meter transform basis. | Critical for spatial accuracy and scene placement. |
| MT model stats/provenance | `resistivity_model/model_stats.json`, `model_provenance.json` | Counts, masks, bounds, scalar transform, source rows, and caveats. | Human acceptance criteria still needed. |
| MT point preview | `resistivity_model/resistivity_point_preview.json` | Lightweight inspection/validation preview. | Do not treat preview as simplification target for full-density data. |
| MT station response QC | `resistivity_model/volume/stations/mt_station_response_qc.json` | Station response and model sanity support. | Client-facing role unclear. |
| Volume / surface / slice manifests and stats | `volume/`, `threshold_surfaces/`, `top_surface/`, `slices/` support files | Bounds, legends, scalar ranges, output identity, and presentation checks. | Per-artifact metadata completeness varies and needs review. |
| Seismic inventory/navigation/provenance | `seismic_analysis/inventory/`, `navigation/`, `browser/provenance.json` | Source disclosure, placement, navigation, and product traceability. | Older docs still need supersession review. |

## Provenance / status wrappers

| Wrapper | Observed path | Status | Known gap |
| --- | --- | --- | --- |
| Project-local status guide | `projects/utah-forge/DATA_LAYER_STATUS.md` | Observed status guidance. | Not official DHF and not acceptance. |
| MT intake wrappers | `electrical_resistivity/intake/source_inventory.*`, `archive_entries.json`, `crs_transform.json`, `crs_origin_note.md` | Observed. | Needs human review before source/status authority is accepted. |
| MT model wrappers | `resistivity_model/model_stats.json`, `model_provenance.json` | Observed. | Acceptance criteria for technical accuracy still open. |
| MT full-density wrapper | `resistivity_model/full_density/manifest.json` | Observed. | Default-load and presentation policy still open. |
| MT volume/surface/slice wrappers | `volume/mt_volume_manifest.json`, `volume/*stats*`, `volume/*provenance*`, `top_surface/*manifest*`, `top_surface/*stats*`, `top_surface/*provenance*`, `slices/manifest.json`, `slices/legend.json` | Observed. | Per-artifact parameter/provenance completeness should be reviewed before client-facing claims. |
| Public context wrapper | `public_context/manifest.json` | Observed. | Public source/style/default role needs human review. |
| Seismic wrappers | `seismic_source_inventory.json`, `seismic_navigation.geojson`, `seismic_manifest.json`, `seismic_demo_recipes.json`, `browser/provenance.json` | Observed. | Contradicts older blocked/not-active docs; acceptance and default demo behavior unresolved. |
| Dev-context classification wrappers | `docs/dev-context/Layer-Artifact-Classification.md`, `docs/dev-context/Computed-Artifact-Pipeline.md` | Observed lab-book/control guidance. | Proposed guidance only; not project runtime authority. |

## MT / resistivity status

| Item | Observed status | Current role | Uncertainty |
| --- | --- | --- | --- |
| Station markers | Observed generated/wired measured station-location data | Technical credibility and QA/validation | Whether stations should be default-visible for the next demo path needs human review. |
| Point preview | Observed generated/wired 90,000-point preview | QA/validation | Do not substitute for full-density data. |
| Full-density tiled data | Observed generated/wired/default-visible in current `environment.json` | High-fidelity client-facing, technical credibility, current default visual candidate | Human review needed for default/load behavior and page story. |
| Scalar volumes | Observed generated/wired, not default-visible | High-fidelity or optional advanced technical layer | Human review needed before client-facing default use. |
| Threshold surfaces | Observed generated/wired; one page makes it visible | Technical communication / optional advanced | Threshold meanings and presentation role need human acceptance. |
| Top surface | Observed generated/wired, not in current default-visible layer list | Presentation aid / technical context | It is an approximate preview-derived ground cap, not measured terrain, geology, wells, faults, or seismic. |
| Slices | Observed generated/wired; one page makes them visible | Candidate client-facing presentation layer | Current docs disagree about whether slices are the default presentation layer. |
| Stats/manifests/provenance | Observed | Accuracy and provenance support | Human acceptance criteria still needed before calling outputs accepted. |

## Seismic status

| Item | Observed status | Current role | Uncertainty |
| --- | --- | --- | --- |
| Source inventory | Observed at `seismic_analysis/inventory/seismic_source_inventory.json` | Provenance and source disclosure | Needs human review with older blocked/not-active docs. |
| Navigation | Observed at `seismic_analysis/navigation/seismic_navigation.geojson` | Placement and technical credibility | Navigation status and fallback placement caveats need review. |
| Browser manifest | Observed at `seismic_analysis/browser/seismic_manifest.json` | Runtime product contract for `utah-forge-phase3-seismic-browser` | Current manifest evidence contradicts older READMEs that say seismic is not active. |
| Section products | Observed: 66 total sections across products | Technical review and optional presentation | Section placement, unit/domain labels, and disclosure need human review. |
| 3D / raymarch-capable products | Observed: 4 products with raymarch volume data | High-fidelity seismic capability and technical credibility | Default product/mode and render-quality bar need human review. |
| Presets / display recipes / export layouts | Observed: 8 display recipes, 8 audience presets, 14 capability presets, 3 export layouts | Candidate presentation and export metadata | Proposed only unless accepted by human. |
| Loader support | Observed via `src/loaders/loadSeismicBrowser.ts` and `src/scene/layerLoaders.ts` read-only inspection | Runtime consumption path exists | No runtime behavior changed by this status file. |
| Control/test support | Recorded in docs/dev-context as previously observed | Evidence should be rechecked before using as acceptance | Do not treat support as approval of demo defaults. |

Seismic must not be marked parked here. Latest human context says seismic is needed and underway.

## Demo-facing candidates

These are proposed only and not accepted demo scope.

## Demo / verification pages

| Page | Status | Role | Review need |
| --- | --- | --- | --- |
| `20_mt_seismic_integration_check` / `MT + Seismic Integration Check` | Observed created 2026-05-15 | Demo/verification page showing MT resistivity slices, the Phase 3 seismic browser, MT full-density context, Phase 3 working area, terrain, roads, streams, and lakes. | Human review required before treating as client-demo scope or accepted interpretation. |
| `30_demo_site_context` / `Demo: Site Context` | Observed created 2026-05-15 | Demo walkthrough v0 page for site/project context using public terrain, roads, hydrography, and Phase 3 working area. | Human review required before treating as accepted demo sequence. |
| `31_demo_mt_acquisition` / `Demo: MT Acquisition Footprint` | Observed created 2026-05-15 | Demo walkthrough v0 page for MT station/survey footprint context. | Human review required for station styling, camera, and client-facing status. |
| `32_demo_mt_resistivity_slices` / `Demo: MT Resistivity Slices` | Observed created 2026-05-15 | Demo walkthrough v0 page for source-derived MT slice presentation with subdued full-density support. | Human review required for visual balance, legend clarity, and client-facing slice status. |
| `33_demo_phase3_seismic` / `Demo: Phase 3 Seismic Browser` | Observed created 2026-05-15 | Demo walkthrough v0 page for current Phase 3 seismic product review with page-local visibility. | Human review required for product/preset/default behavior and interpretation caveats. |
| `34_demo_mt_seismic_integration` / `Demo: MT + Seismic Integration` | Observed created 2026-05-15 | Demo walkthrough v0 page showing MT slices, MT full-density support, and Phase 3 seismic together. | Human review required for co-render quality and whether it becomes client-demo path. |
| `35_demo_provenance_review` / `Demo: Provenance + Review Caveats` | Observed created 2026-05-15 | Demo walkthrough v0 closeout page for source-derived/computed-artifact caveats and human-review boundary. | Human review required before accepting disclosure language. |

This page does not change data, prep scripts, generated artifacts, loaders, global environment defaults, or runtime behavior. It uses page-local visibility/style overrides so MT and seismic can be inspected together. The page-local seismic product visibility makes the current environment product visible for review; seismic default product/preset choice remains unresolved.

The demo walkthrough v0 pages do not change source data, prep scripts, computed artifacts, generated project data, loaders, global environment defaults, or runtime loading behavior. They are page/overlay review scaffolding only and remain unaccepted pending human review.

| Candidate | Why it may be demo-facing | Review need |
| --- | --- | --- |
| Public terrain/context | Gives surface and location context around the MT/seismic scene. | Confirm public context styling and default role. |
| MT full-density tiled scalar point cloud | Shows full source-derived model density and technical credibility. | Confirm load/default behavior, opacity, camera/page polish, and performance bar. |
| MT slices | Cleaner presentation of resistivity structure than raw full-density alone. | Confirm which slices/pages are client-facing and whether authored preview is enough. |
| MT scalar volumes | High-fidelity 3D scalar rendering capability. | Confirm when volume is client-facing versus optional advanced. |
| MT threshold surfaces | Communicates iso-resistivity structure. | Confirm threshold meanings, caveats, and visual style. |
| Seismic browser products | Shows seismic integration and multi-method capability. | Confirm default product/mode, opacity, labels, recipes, and disclosure language. |

## Technical credibility / QA candidates

| Candidate | Role |
| --- | --- |
| MT station markers | Measured station-location anchor and QC context. |
| MT point preview | QA/validation preview, not replacement for full-density. |
| MT model stats/provenance | Required for source counts, masking, scalar transform, bounds, and caveats. |
| MT station response QC | Support artifact for MT station/product review. |
| Seismic source inventory | Required for source provenance and product disclosure. |
| Seismic navigation | Required for placement and survey-footprint credibility. |
| Seismic products with amplitude stats | Technical review and visualization capability; needs disclosure and acceptance. |

## Future / placeholder / unclear

| Item | Status |
| --- | --- |
| `utah-forge-reference-stage` | Placeholder/procedural reference stage. Do not treat as real data. |
| Southwestern/regional MT | Reserved/inactive in existing docs. |
| Forge Southwestern seismic | Reserved/inactive in existing docs. |
| Wells, faults, infrastructure, microseismic events | Mentioned in planning/docs as possible future families; not observed as current Utah FORGE browser-ready project layers. |
| Older seismic-blocking docs | Candidate stale or superseded, but not resolved here. |
| Page story/title readiness | Multiple pages are still titled `Untitled page`; story readiness needs review. |

## Do not assume

- Do not assume older "seismic blocked/not active" docs are current, because current manifests/environment/pages/generated artifacts show seismic exists and latest human context says seismic is needed and underway.
- Do not assume current `defaultVisibleLayers` is accepted demo intent.
- Do not assume MT full-density should be simplified, downsampled, hidden, or removed because it is large.
- Do not assume slices, volumes, threshold surfaces, seismic products, meshes, tiles, legends, or provenance wrappers are disposable.
- Do not assume top surface is measured terrain, interpreted geology, wells, faults, or seismic.
- Do not assume public context defaults are accepted without human review.
- Do not assume any artifact is technically accepted until human review records acceptance.
- Do not move, rename, delete, regenerate, or compress source/client/public/generated data without explicit approval.

## Human review needed

- Seismic default demo behavior.
- Full-density default/load behavior.
- Page story/title readiness.
- High-fidelity layer policy.
- Old docs supersession.
- Computed artifact acceptance criteria.
- Render-quality verification requirements.
- Per-artifact metadata wrapper expectations.
- Which Utah FORGE docs should be active guidance, historical record, or candidate stale.
- Whether current public context, MT full-density, seismic, slices, volumes, and threshold surfaces should be default/page/toggle/QA roles.
