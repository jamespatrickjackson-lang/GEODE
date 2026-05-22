# Utah FORGE Wrapper Coverage

## Purpose

This file is project-local artifact metadata coverage guidance for Utah FORGE.

It does not change runtime behavior, project manifests, page JSON, visibility, rendering, loader behavior, prep scripts, existing data artifacts, or generated outputs.

It does not mark any artifact accepted.

It helps decide which wrappers should be created next so structural cleanup can reduce confusion without reducing rendering quality, source traceability, seismic capability, MT fidelity, or computed-artifact richness.

## Current Wrapper Coverage

| artifact_or_layer | observed family | observed type | observed path / manifest / contract | consumed by layer ID | current wrapper? | wrapper path | render role | load class | client-demo relevance | missing metadata | wrapper priority | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MT stations | render_ready; QA/validation | station_marker | `electrical_resistivity/stations/mt_stations.geojson`; `mt_stations.provenance.json`; `volume/stations/mt_station_response_qc.json` | `utah-forge-mt-stations` | yes | `projects/utah-forge/artifact_metadata/utah-forge-mt-stations.metadata.json` | technical_credibility | qa_validation | QA only | review; visual receipt; accepted CRS/transform | already wrapped | Anchor for measured MT station credibility; wrapper remains `needs_review`, `accepted=false`. |
| MT resistivity slices | computed_analytical; render_ready | scalar_slice | `resistivity_model/slices/resistivity_slices_mesh_preview.json`; `manifest.json`; `legend.json`; `resistivity_slices.provenance.json` | `utah-forge-mt-resistivity-slices` | yes | `projects/utah-forge/artifact_metadata/utah-forge-mt-resistivity-slices.metadata.json` | high_fidelity_client_facing | page_required | high | scalar/range; stats/bounds; visual receipt; review | already wrapped | Candidate clean client-facing MT presentation layer; no acceptance implied. |
| Phase 3 seismic browser | computed_analytical; render_ready; provenance/status | seismic_product | `seismic_analysis/browser/seismic_manifest.json`; `products/*`; `seismic_demo_recipes.json`; `inventory/seismic_source_inventory.json`; `navigation/seismic_navigation.geojson`; `browser/provenance.json` | `utah-forge-phase3-seismic-browser` | yes | `projects/utah-forge/artifact_metadata/utah-forge-phase3-seismic-browser.metadata.json` | unclear_needs_review | needs_human_review | high | CRS/transform; units; scalar/range; parameters; stats/bounds; visual receipt; old-doc supersession review | already wrapped | Seismic is needed and underway. Default product/mode and old-doc supersession remain human-review items. |
| MT full-density tiled data | computed_analytical; render_ready | point_cloud_tile | `resistivity_model/full_density/manifest.json`; `tiles/*.positions.bin`; `tiles/*.scalars.bin`; `stats.json`; `provenance.json` | `utah-forge-mt-resistivity-full-density` | yes | `projects/utah-forge/artifact_metadata/utah-forge-mt-full-density.metadata.json` | high_fidelity_client_facing | needs_human_review | high | load/default policy; visual receipt; accepted scalar/range; review | already wrapped | High-fidelity/default-visible data-density proof. Not bloat; wrapper remains `needs_review`, `accepted=false`. |
| MT scalar volume | computed_analytical; render_ready | scalar_volume | `resistivity_model/volume/mt_volume_manifest.json`; `volume.u8`; `mask.u8`; stats/provenance | `utah-forge-mt-resistivity-volume` | yes | `projects/utah-forge/artifact_metadata/utah-forge-mt-scalar-volume.metadata.json` | optional_advanced | needs_human_review | high | transfer function; mask/bounds; scalar/range; visual receipt; review | already wrapped | Volume/raymarch transfer, masks, dimensions, and opacity are high render/accuracy risk; wrapper does not approve default loading. |
| MT threshold surfaces | computed_analytical; render_ready | threshold_surface | `resistivity_model/volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json`; `provenance.json` | `utah-forge-mt-resistivity-threshold-surfaces` | yes | `projects/utah-forge/artifact_metadata/utah-forge-mt-threshold-surfaces.metadata.json` | technical_credibility | page_required | high | threshold meaning; visual receipt; limitations; review | already wrapped | Threshold meanings and communication caveats require explicit review before client-facing use; wrapper remains `needs_review`, `accepted=false`. |
| MT preview-derived ground cap | computed_analytical; render_ready; presentation | top_surface | `resistivity_model/top_surface/mt_top_surface_mesh_preview.json`; `manifest.json`; `stats.json`; `provenance.json` | `utah-forge-mt-top-surface` | yes | `projects/utah-forge/artifact_metadata/utah-forge-mt-top-surface.metadata.json` | technical_credibility | page_required | medium | caveat acceptance; material/depth behavior; visual receipt; review | already wrapped | Existing 90,000-point preview-derived ground cap, not measured terrain or interpreted geology; wrapper remains `needs_review`, `accepted=false`. |
| MT full-density top-contact surface | computed_analytical; render_ready; presentation | top_surface | `resistivity_model/top_contact_surface/mt_top_contact_surface_mesh_preview.json`; `manifest.json`; `stats.json`; `provenance.json` | `utah-forge-mt-top-contact-surface` | yes | `projects/utah-forge/artifact_metadata/utah-forge-mt-top-contact-surface.metadata.json` | technical_credibility | page_required | medium | caveat acceptance; material/depth behavior; visual receipt; external datum/control review | already wrapped | Additional full-density MT top-contact support surface spanning the data-point extent; not public topo, lidar, DEM terrain, measured ground, geology, wells, faults, or seismic; wrapper remains `needs_review`, `accepted=false`. |
| MT point preview | QA/validation; render_ready | point_cloud_tile | `resistivity_model/resistivity_point_preview.json`; `model_stats.json`; `model_provenance.json` | `utah-forge-mt-resistivity-preview` | no | none | qa_validation; technical_credibility | qa_validation | QA only | parameters; stats/bounds; provenance; visual receipt; limitations; review | later | 90,000-point preview is useful QA, not a substitute for full-density data. |
| MT station response QC | QA/validation | stats_manifest | `resistivity_model/volume/stations/mt_station_response_qc.json` | support for `utah-forge-mt-stations`; support for MT volume review | partial via stations wrapper | `projects/utah-forge/artifact_metadata/utah-forge-mt-stations.metadata.json` references it | qa_validation | computed_artifact_support | QA only | source; units; parameters; stats/bounds; visual receipt if displayed; review | later | Could later get its own wrapper if station response plots become client-facing or technical-review artifacts. |
| Public terrain/context | render_ready | terrain | `public_context/terrain_public_context_1000m.tif`; `terrain_public_context_200m.tif`; `public_context/manifest.json` | `terrain` | no | none | default_visual | first_page_required | medium | CRS/transform; units; stats/bounds; provenance; visual receipt; review | later | Surface/context polish matters, but wrapper can follow high-risk MT/seismic products. |
| Roads / hydrography / infrastructure context | render_ready | vector_context | `public_context/roads.geojson`; `hydrography_streams.geojson`; `hydrography_lakes.geojson`; `public_context/manifest.json` | `transport-roads`; `hydrography-streams`; `hydrography-lakes` | no | none | default_visual | first_page_required | medium | CRS/transform; units; stats/bounds; provenance; visual receipt; review | later | Context layer styling/default role needs review; not a computed high-risk first target. |
| Phase 3 working area / site boundary guide | presentation | vector_context | project metadata procedural/report-backed working-area guide | `utah-forge-phase3-working-area` | no | none | default_visual; technical_credibility | first_page_required | medium | source; CRS/transform; limitations; visual receipt; review | needs human review | White-line render box is spatial guide, not geology, reservoir, target, or resource estimate. |
| Utah reference stage placeholder | future_placeholder | mesh_surface | procedural placeholder layer only | `utah-forge-reference-stage` | no | none | future_placeholder | future_placeholder | low | source; provenance; limitations; review | later | Placeholder only. Do not promote without human direction. |
| Seismic navigation / inventory / provenance | provenance_status_wrapper; QA/validation | seismic_product; stats_manifest | `seismic_analysis/navigation/seismic_navigation.geojson`; `inventory/seismic_source_inventory.json`; `browser/provenance.json` | support for `utah-forge-phase3-seismic-browser` | yes | `projects/utah-forge/artifact_metadata/utah-forge-seismic-navigation-provenance.metadata.json` | technical_credibility | computed_artifact_support | high | placement acceptance; visual receipt; old-doc supersession review | already wrapped | Separate wrapper created because seismic placement/source disclosure is high-risk and older docs contradict current active state. |
| Seismic recipes / presets / export layouts | presentation; provenance/status | seismic_product; other | `seismic_analysis/browser/seismic_demo_recipes.json`; manifest display recipes, audience presets, capability presets, export layouts | metadata/presets for `utah-forge-phase3-seismic-browser` | yes | `projects/utah-forge/artifact_metadata/utah-forge-seismic-recipes-presets.metadata.json` | unclear_needs_review | needs_human_review | high | selected recipe acceptance; visual receipt; limitations; review | already wrapped | Recipe/preset edits can silently change client-facing seismic meaning. Do not treat as accepted demo scope. |
| Wells / faults / microseismic / interpretation markers | future_placeholder; unknown | well_path; vector_context; other | no current Utah FORGE browser-ready project layer observed | none observed | no | none | future_placeholder | future_placeholder | unclear | source; CRS/transform; units; parameters; stats/bounds; provenance; visual receipt; limitations; review | needs human review | Mentioned in planning/future families but not observed as current Utah FORGE browser-ready layers in this coverage pass. |

## Batch 2A Wrappers Created

Observed: batch 2A created project-local wrappers for:

- `projects/utah-forge/artifact_metadata/utah-forge-mt-full-density.metadata.json`
- `projects/utah-forge/artifact_metadata/utah-forge-mt-scalar-volume.metadata.json`
- `projects/utah-forge/artifact_metadata/utah-forge-mt-threshold-surfaces.metadata.json`

These wrappers do not change runtime behavior, project manifests, page JSON, visibility, rendering, loader behavior, prep scripts, data artifacts, generated outputs, or acceptance state. All three remain `needs_review`, `reviewRequired=true`, and `accepted=false`.

## Batch 2B Wrappers Created

Observed: batch 2B created project-local wrappers for:

- `projects/utah-forge/artifact_metadata/utah-forge-seismic-navigation-provenance.metadata.json`
- `projects/utah-forge/artifact_metadata/utah-forge-seismic-recipes-presets.metadata.json`
- `projects/utah-forge/artifact_metadata/utah-forge-mt-top-surface.metadata.json`
- `projects/utah-forge/artifact_metadata/utah-forge-mt-top-contact-surface.metadata.json`

These wrappers do not change runtime behavior, project manifests, page JSON, visibility, rendering, loader behavior, prep scripts, data artifacts, generated outputs, or acceptance state. All three remain `needs_review`, `reviewRequired=true`, and `accepted=false`.

## Second Wrapper Batch Status

Observed: the recommended second wrapper batch has now been created across batch 2A and batch 2B. These records remain review inputs only and do not mark any artifact accepted.

| Rank | Wrapper | Status | Why it mattered | Remaining review risk |
| --- | --- | --- | --- | --- |
| 1 | MT full-density tiled data | Created in batch 2A | High client-demo value, current default-visible state, strong technical credibility, and direct bloat/load-policy sensitivity. | Very high: tile count, scalar transform, color/opacity, point size, and default-load choices can affect fidelity and beauty. |
| 2 | MT scalar volume | Created in batch 2A | High-fidelity 3D scalar capability and major future runtime-loading/disposal concern. | Very high: volume dimensions, masks, transfer function, opacity, and sampling can misrepresent the model. |
| 3 | MT threshold surfaces | Created in batch 2A | Computed analytical communication layer with direct interpretation risk. | Very high: threshold choices and material/depth behavior can imply false geological meaning if not caveated. |
| 4 | Seismic navigation / inventory / provenance | Created in batch 2B | Protects seismic placement and source disclosure, especially with older blocked-doc contradictions. | Very high: navigation/fallback placement and source disclosure affect technical credibility. |
| 5 | Seismic recipes / presets / export layouts | Created in batch 2B | High demo relevance because recipes/presets shape what a client sees. | High: product choice, amplitude window, colormap, camera shot, disclosure labels, and export layouts can silently lock a demo story. |
| 6 | MT preview-derived ground cap | Created in batch 2B | Existing spatial/context aid with strong caveats. | High: it can be mistaken for measured terrain/geology if not wrapped clearly. |
| 7 | MT full-density top-contact surface | Created additively after batch 2B | Additional full-density scan top-contact support aid with strong caveats. | High: it can be mistaken for public topo, lidar, DEM terrain, measured ground, or interpreted geology if not wrapped clearly. |

## Human Review Needed

- Confirm whether `projects/utah-forge/artifact_metadata/` is the desired project-local wrapper home.
- Approve or revise the recommended second wrapper batch.
- Review client-demo relevance per artifact before any page/runtime/config changes.
- Define visual receipt requirements for high-priority artifacts.
- Confirm whether seismic navigation/recipes should be separate wrappers or remain support records under the seismic browser wrapper.
- Confirm when MT full-density becomes a reviewed high-fidelity client-facing artifact versus technical credibility or optional advanced.
