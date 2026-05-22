# Project Load-Class Table

## Purpose

This table classifies existing project layers by intended loading behavior. It does not change runtime behavior, project manifests, page JSON, visibility, rendering, data, prep scripts, or computed artifacts.

All load classes below are proposed planning inputs only. Human review is required before any runtime, manifest, page, loader, or visibility change.

## Evidence Used

| Evidence | Role |
| --- | --- |
| `projects/utah-forge/project.json`, `environment.json`, `pages/` | Observed layer IDs, labels, layer types, default visibility, and page references. |
| `projects/case-study-b/project.json`, `environment.json`, `pages/` | Observed layer IDs, labels, layer types, default visibility, and page references. |
| `projects/woodjam/project.json`, `environment.json`, `pages/` | Observed layer IDs, labels, layer types, default visibility, and page references. |
| `docs/dev-context/Layer-Artifact-Classification.md` | Proposed artifact/render role context. |
| `docs/dev-context/Computed-Artifact-Pipeline.md` | Computed-artifact guardrails and provenance risks. |
| `docs/dev-context/Runtime-Loading-Policy.md` | Proposed load-class vocabulary and migration path. |
| `docs/dev-context/Render-Quality-Checks.md` | Render and computed-artifact quality constraints. |
| `projects/utah-forge/DATA_LAYER_STATUS.md` | Utah FORGE project-local data/layer status context. |

## Load Classes

- startup critical
- first-page required
- page-required
- preload near page
- toggle-on-demand
- high-fidelity client-facing
- technical credibility
- QA/validation
- computed-artifact support
- future/placeholder
- generated junk/dev output
- blocked/unknown
- needs human review

## Utah FORGE

Observed layer count: 14.

| project | layer_id | label/name if available | layer type/family | current default visible? | referenced by pages? | current role | proposed load class | artifact family | render-quality risk if deferred | technical-accuracy risk if deferred | seismic / MT / surface / other | human review required? | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Utah FORGE | `utah-forge-reference-stage` | Utah FORGE reference stage (placeholder) | `mesh` | no | no | future | future/placeholder | future/placeholder | Low | Low | other | Yes | Placeholder/reference stage only in current evidence. |
| Utah FORGE | `utah-forge-phase3-working-area` | Phase 3 required working area | `line` | yes | no | visible default | first-page required | presentation | High | Medium | other | Yes | Area/boundary context appears important for page framing. |
| Utah FORGE | `terrain` | Public terrain surface | `geotiff` | yes | archived provenance ref deferred | visible default; page-specific | first-page required | render-ready | High | Medium | surface | Yes | Terrain is visual/spatial context and should not be deferred without page review. |
| Utah FORGE | `transport-roads` | Public roads | `line` | yes | archived provenance ref deferred | visible default; page-specific | first-page required | render-ready | Medium | Low | other | Yes | Public context layer. |
| Utah FORGE | `hydrography-streams` | Public streams and rivers | `line` | yes | archived provenance ref deferred | visible default; page-specific | first-page required | render-ready | Medium | Low | other | Yes | Public context layer. |
| Utah FORGE | `hydrography-lakes` | Public waterbodies | `polygon` | yes | archived provenance ref deferred | visible default; page-specific | first-page required | render-ready | Medium | Low | other | Yes | Public context layer. |
| Utah FORGE | `utah-forge-phase3-seismic-browser` | Utah FORGE Phase 3 seismic browser | `seismic` | yes | `05_mt_threshold_focus` | visible default; page-specific | needs human review | computed analytical; render-ready; provenance/status | High | High | seismic | Yes | Seismic is needed and underway. Default/page/product behavior needs review, not parking or hiding. |
| Utah FORGE | `utah-forge-mt-stations` | Utah FORGE Phase 3 MT station locations | `point` | no | archived provenance ref deferred | QA; page-specific | QA/validation | QA/validation; render-ready | Medium | High | MT | Yes | Station markers support source/measurement credibility. |
| Utah FORGE | `utah-forge-mt-resistivity-preview` | Utah FORGE Phase 3 MT resistivity model preview | `pointcloud` | no | archived provenance ref deferred | QA; page-specific | QA/validation | QA/validation; render-ready | Medium | Medium | MT | Yes | Preview should remain available for validation/context. |
| Utah FORGE | `utah-forge-mt-resistivity-full-density` | Utah FORGE Phase 3 MT resistivity full-density model | `pointcloud` | yes | `04_mt_high_resistivity_seismic`; `05_mt_threshold_focus`; `06_mt_low_resistivity_seismic`; `08_mt_threshold_surfaces`; `12_mt_volume_overview`; archived provenance refs deferred | visible default; page-specific | high-fidelity client-facing | computed analytical; render-ready | High | High | MT | Yes | Full-density complexity is potentially valuable, not bloat. It may need intentional loading rather than blind project-open loading. |
| Utah FORGE | `utah-forge-mt-resistivity-volume` | Utah FORGE Phase 3 MT resistivity volume | `volume` | no | no | optional | toggle-on-demand | computed analytical; render-ready | High | High | MT | Yes | Optional advanced/high-fidelity candidate; no page reference observed. |
| Utah FORGE | `utah-forge-mt-resistivity-threshold-surfaces` | Utah FORGE Phase 3 MT threshold surfaces | `mesh` | no | `08_mt_threshold_surfaces` | page-specific | page-required | computed analytical; render-ready | High | High | MT | Yes | Threshold surfaces should load intentionally for the page that uses them. |
| Utah FORGE | `utah-forge-mt-top-surface` | Utah FORGE Phase 3 MT full-density top-envelope surface | `mesh` | no | `04_mt_high_resistivity_seismic`; archived provenance refs deferred | page-specific | page-required | computed analytical; render-ready | High | Medium | MT; surface | Yes | UI-facing top-surface control now routes to the full-density top-contact support artifact; not terrain, geology, or measured ground. |
| Utah FORGE | `utah-forge-mt-top-contact-surface` | Utah FORGE Phase 3 MT full-density top-contact surface | `mesh` | no | no | optional | toggle-on-demand | computed analytical; render-ready | High | Medium | MT; surface | Yes | Added full-density top-contact support surface; spans data-point extent, with lower-confidence inferred support outside direct observed cells. Not terrain, geology, or measured ground. |
| Utah FORGE | `utah-forge-mt-resistivity-slices` | Utah FORGE Phase 3 MT resistivity slices | `mesh` | no | archived provenance ref deferred | page-specific | page-required | computed analytical; render-ready | High | High | MT | Yes | Slice fidelity, scalar ranges, color ramps, and provenance must be preserved. |

## Case Study B / Shahbazi

Observed layer count: 28.

| project | layer_id | label/name if available | layer type/family | current default visible? | referenced by pages? | current role | proposed load class | artifact family | render-quality risk if deferred | technical-accuracy risk if deferred | seismic / MT / surface / other | human review required? | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Case Study B / Shahbazi | `case-study-b-demo-shell` | Shahbazi Gravel Pit demo shell | `geojson` | no | `01_overview`; `02_bench_walkthrough`; `03_anomaly_story`; `04_planning_governance`; `05_public_communication` | page-specific | page-required | presentation | Medium | Low | other | Yes | Demo shell/page scaffold. |
| Case Study B / Shahbazi | `terrain` | Terrain / surface model | `geotiff` | no | `01_overview` | page-specific | page-required | render-ready | High | Medium | surface | Yes | Page 1 terrain context. |
| Case Study B / Shahbazi | `quarry-imagery-base` | High-resolution imagery / photogrammetry base | `geotiff` | no | `01_overview` | page-specific | page-required | render-ready | High | Medium | surface | Yes | Imagery/photogrammetry base is presentation-critical when used. |
| Case Study B / Shahbazi | `quarry-lidar-surface` | LiDAR / point-cloud derived surface | `pointcloud` | no | no | optional | toggle-on-demand | render-ready | Medium | Medium | surface | Yes | No page reference observed; likely optional or pending review. |
| Case Study B / Shahbazi | `quarry-drill-traces` | Synthetic drill collars / traces | `drillhole` | no | `03_anomaly_story` | page-specific | page-required | presentation | Medium | Medium | other | Yes | Synthetic status should remain clear. |
| Case Study B / Shahbazi | `quarry-ore-grade-heatmap` | Synthetic ore-grade heatmap | `geotiff` | no | `03_anomaly_story` | page-specific | page-required | computed analytical; presentation | High | High | other | Yes | Heat-map/ramp/legend meaning should not change casually. |
| Case Study B / Shahbazi | `stockpile-volume-zones` | Stockpile / volume measurement zones | `polygon` | no | `04_planning_governance` | page-specific | page-required | computed analytical; presentation | Medium | Medium | other | Yes | Volume/zone meaning needs status clarity if used client-facing. |
| Case Study B / Shahbazi | `haul-route-equipment-demo` | Haul route / equipment tracking demo | `line` | no | `02_bench_walkthrough` | page-specific | page-required | presentation | Medium | Low | other | Yes | Page-specific operational overlay. |
| Case Study B / Shahbazi | `slope-stability-anomaly` | Slope stability anomaly | `polygon` | no | `03_anomaly_story` | page-specific | page-required | computed analytical; presentation | High | High | other | Yes | Anomaly semantics need provenance/status clarity. |
| Case Study B / Shahbazi | `bench-conformance-overlay` | Bench geometry / conformance overlay | `polygon` | no | `02_bench_walkthrough`; `04_planning_governance` | page-specific | page-required | computed analytical; presentation | High | High | other | Yes | Conformance overlay should preserve spatial/meaning fidelity. |
| Case Study B / Shahbazi | `erosion-runoff-planning` | Erosion / runoff planning overlay | `line` | no | `04_planning_governance`; `05_public_communication` | page-specific | page-required | computed analytical; presentation | Medium | Medium | other | Yes | Planning overlay, not a source layer. |
| Case Study B / Shahbazi | `restoration-preview` | Restoration preview overlay | `polygon` | no | `05_public_communication` | page-specific | page-required | presentation | Medium | Medium | other | Yes | Public-communication page artifact. |
| Case Study B / Shahbazi | `public-viewshed-overlay` | Viewshed / public communication overlay | `polygon` | no | `05_public_communication` | page-specific | page-required | computed analytical; presentation | Medium | High | other | Yes | Viewshed outputs need method/status clarity. |
| Case Study B / Shahbazi | `shahbazi-textured-mesh` | Shahbazi textured mesh / glTF | `gltf` | no | no | optional | high-fidelity client-facing | render-ready | High | Medium | surface | Yes | High-fidelity mesh candidate; not observed as page-referenced. |
| Case Study B / Shahbazi | `shahbazi-point-cloud` | Shahbazi reconstructed point cloud | `pointcloud` | no | no | optional | high-fidelity client-facing | render-ready | High | Medium | surface | Yes | Rich reconstruction candidate; no page reference observed. |
| Case Study B / Shahbazi | `shahbazi-orthomosaic` | Shahbazi orthomosaic / image texture | `geotiff` | no | no | optional | toggle-on-demand | render-ready | High | Medium | surface | Yes | Photo/texture basis should remain available. |
| Case Study B / Shahbazi | `shahbazi-ground-control` | Shahbazi ground control / check points | `point` | no | no | QA | QA/validation | QA/validation; render-ready | Medium | High | other | Yes | Ground/check points are technical credibility evidence. |
| Case Study B / Shahbazi | `shahbazi-camera-poses` | Shahbazi UAV camera positions / flight path | `line` | yes | no | visible default | technical credibility | QA/validation; render-ready | Medium | High | other | Yes | Default-visible QA/credibility layer; review whether default loading remains intended. |
| Case Study B / Shahbazi | `shahbazi-camera-frustums` | Shahbazi sampled camera frustums | `line` | no | `02_bench_walkthrough` | page-specific; QA | page-required | QA/validation; presentation | Medium | High | other | Yes | Page-specific camera/frustum credibility layer. |
| Case Study B / Shahbazi | `shahbazi-dense-matching-links` | Shahbazi dense-matching image-pair links | `line` | no | no | QA | QA/validation | QA/validation | Low | High | other | Yes | QA-only unless accepted as client-facing technical evidence. |
| Case Study B / Shahbazi | `shahbazi-object-points` | Shahbazi raw sparse object points / tie-point QA | `pointcloud` | no | no | QA | QA/validation | QA/validation | Low | High | other | Yes | QA/source-support artifact. |
| Case Study B / Shahbazi | `shahbazi-tie-point-support-isolines` | Shahbazi tie-point support isolines | `line` | no | no | QA | QA/validation | computed analytical; QA/validation | Medium | High | other | Yes | Isoline output is core capability, not disposable. |
| Case Study B / Shahbazi | `shahbazi-tls-subzone` | Shahbazi TLS sampled preview | `pointcloud` | no | no | optional | toggle-on-demand | render-ready | Medium | Medium | surface | Yes | Sampled TLS preview candidate. |
| Case Study B / Shahbazi | `shahbazi-tls-tiled-preview` | Shahbazi TLS tiled preview | `pointcloud` | no | no | optional | high-fidelity client-facing | render-ready | High | Medium | surface | Yes | Tiled/high-density preview should not be treated as bloat. |
| Case Study B / Shahbazi | `shahbazi-tls-surface-preview` | Shahbazi ground surface preview | `mesh` | yes | no | visible default | high-fidelity client-facing | computed analytical; render-ready | High | High | surface | Yes | Default-visible rich surface preview. |
| Case Study B / Shahbazi | `shahbazi-tls-contours` | Shahbazi ground surface contours | `line` | yes | no | visible default | computed-artifact support | computed analytical; render-ready | High | High | surface | Yes | Contour fidelity and interval/provenance must be preserved. |
| Case Study B / Shahbazi | `shahbazi-photo-overlay-preview` | Shahbazi projected image preview | `mesh` | yes | `01_overview`; `02_bench_walkthrough` | visible default; page-specific | high-fidelity client-facing | presentation; render-ready | High | Medium | surface | Yes | Photo overlay/depth behavior is a render-quality risk area. |
| Case Study B / Shahbazi | `shahbazi-derived-overlays` | Shahbazi derived demo overlays | `polygon` | no | no | future | future/placeholder | future/placeholder | Low | Medium | other | Yes | Derived overlay role is unclear until reviewed. |

## Woodjam

Observed layer count: 21.

| project | layer_id | label/name if available | layer type/family | current default visible? | referenced by pages? | current role | proposed load class | artifact family | render-quality risk if deferred | technical-accuracy risk if deferred | seismic / MT / surface / other | human review required? | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Woodjam | `terrain` | Topography (MRDEM 30m) | `geotiff` | yes | no | visible default | first-page required | render-ready | High | Medium | surface | Yes | Base terrain context. |
| Woodjam | `drillholes-2023` | 2023 Drilling | `drillhole` | yes | `03_three_firs_collars`; `04_reading_the_core` | visible default; page-specific | high-fidelity client-facing | render-ready | High | High | other | Yes | Drilling is core technical context. |
| Woodjam | `drillholes-2024-tf` | 2024 Three Firs Collars | `drillhole` | yes | no | visible default | high-fidelity client-facing | render-ready | High | High | other | Yes | Default-visible drilling context. |
| Woodjam | `assay-samples` | Assay Samples | `drillhole` | yes | no | visible default | technical credibility | render-ready | High | High | other | Yes | Assay data should not be simplified without acceptance. |
| Woodjam | `geochem-soils-2024` | 2024 GP Soil Geochemistry | `geojson` | yes | no | visible default | technical credibility | render-ready | Medium | High | other | Yes | Geochemistry context; provenance/status review may be needed. |
| Woodjam | `ip-survey-lines-2024` | 2024 IP Survey Lines | `line` | yes | no | visible default | technical credibility | render-ready | Medium | High | other | Yes | Survey line context. |
| Woodjam | `hyperspectral-coverage-2024` | 2024 Hyperspectral Coverage | `drillhole` | yes | no | visible default | technical credibility | render-ready | Medium | High | other | Yes | Coverage layer needs clear role before deferral. |
| Woodjam | `imagery-lidar-aoi-2024` | 2024 LiDAR Acquisition Footprint | `polygon` | no | no | optional | toggle-on-demand | render-ready | Low | Medium | surface | Yes | Optional AOI footprint. |
| Woodjam | `area-outlines` | Area Outlines | `annotation` | yes | no | visible default | first-page required | presentation | Medium | Low | other | Yes | Presentation/navigation context. |
| Woodjam | `ez-gamma-2024` | 2024 EZ Gamma surveys | `geojson` | yes | no | visible default | technical credibility | computed analytical; render-ready | Medium | High | other | Yes | Computed/survey product candidate; keep fidelity/status clear. |
| Woodjam | `three-firs-target` | Three Firs target (draft placeholder) | `geojson` | no | no | future | future/placeholder | future/placeholder | Low | Medium | other | Yes | Draft placeholder target. |
| Woodjam | `great-plains-target` | Great Plains target (draft placeholder) | `geojson` | no | no | future | future/placeholder | future/placeholder | Low | Medium | other | Yes | Draft placeholder target. |
| Woodjam | `megaton-dcip-anomaly` | Megaton DCIP anomaly (figure-derived draft) | `polygon` | no | no | future | future/placeholder | future/placeholder | Low | Medium | other | Yes | Figure-derived draft anomaly, not accepted interpretation. |
| Woodjam | `hydrography-lakes` | Lakes | `polygon` | yes | no | visible default | first-page required | render-ready | Medium | Low | other | Yes | Public context layer. |
| Woodjam | `bedrock-geology` | Bedrock geology | `polygon` | no | `02_southeast_cluster`; `04_reading_the_core` | page-specific | page-required | render-ready | High | High | other | Yes | Page-referenced geology; should not be treated as optional without review. |
| Woodjam | `claim-boundary` | Property boundary | `line` | no | no | optional | toggle-on-demand | render-ready | Medium | Medium | other | Yes | Ownership/property context. |
| Woodjam | `transport-roads` | Road access | `line` | yes | no | visible default | first-page required | render-ready | Medium | Low | other | Yes | Access context. |
| Woodjam | `power-lines` | Power lines | `line` | yes | no | visible default | first-page required | render-ready | Medium | Low | other | Yes | Infrastructure context. |
| Woodjam | `property-neighbors` | Property neighbors | `geojson` | yes | no | visible default | first-page required | render-ready | Medium | Medium | other | Yes | Neighbor/property context. |
| Woodjam | `trees-vri` | VRI forest cover proxy | `geojson` | yes | no | visible default | toggle-on-demand | render-ready | Medium | Medium | other | Yes | Default visible in manifest state, but may be a review candidate for intentional loading. |
| Woodjam | `hydrography-streams` | Streams & rivers | `line` | yes | no | visible default | first-page required | render-ready | Medium | Low | other | Yes | Public context layer. |

## Cross-Project Observations

- Observed project layer counts: Utah FORGE 14, Case Study B / Shahbazi 28, Woodjam 21.
- Current default visibility is not proof that a layer must load on project open forever.
- Page references are not proof that a layer is accepted as client-facing; they identify likely load-policy review points.
- Seismic remains needed and underway. The Utah seismic browser should be classified by readiness, page need, product visibility, render quality, and provenance rather than hidden or parked by default.
- Full-density/high-complexity artifacts are not bloat by default. They should be classified as client-facing, technical credibility, QA/validation, optional advanced, or unclear.
- Computed artifacts should remain first-class GeoVox outputs. Their loading policy must preserve source, scripts, CRS/transform, units, scalar parameters, legends, output counts/stats, provenance, and review status.

## First Implementation Candidates, Proposed Only

Do not implement these from this table alone:

1. Add `loadPolicy` metadata to layer records after human review of field names and migration risk.
2. Use existing page visibility overrides more deliberately as the first policy input.
3. Add page-required, preload, and toggle-on-demand support only after render/computed-artifact quality checks are accepted.
4. Add a loader lifecycle/disposal contract that preserves page transitions, QA access, and high-fidelity optional paths.
5. Add an optional dev HUD for loaded layers/resources after runtime behavior is understood.
6. Split project-specific loader registration later, after load classes and focused verification evidence are stable.

## Human Review Needed

- Confirm or revise proposed load classes for every layer before runtime changes.
- Decide whether Utah seismic default/page/product behavior is client-facing, advanced, QA, or mixed.
- Decide whether Utah full-density MT remains startup-visible, page-required, preloaded, or toggle/high-fidelity.
- Decide whether Shahbazi default-visible QA/photogrammetry layers are client-facing defaults or technical toggles.
- Decide whether Woodjam numerous default-visible context layers should remain project-open/default loaded.
- Decide what evidence is required before any layer is marked safe to defer.
- Resolve archived Utah page-reference identifiers still retained in artifact metadata for prior pages 02, 07, and 11; this cleanup does not reinterpret or remove those provenance fields.
