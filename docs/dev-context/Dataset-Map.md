# Dataset Map

> **As-built evidence boundary:** [`main` at `29d9c4c7eee77ac1b104289b09b1382c574145d0`](https://github.com/jamespatrickjackson-lang/GEODE/commit/29d9c4c7eee77ac1b104289b09b1382c574145d0), 14 November 2026. Active scientific visualizations use **project-wired prepared artifacts**, not a general browser file-import pipeline. Runtime source is distinct from archived raw inputs, offline conversion, source-derived QA/preview, synthetic placeholder and future target. A staged intake file is **not** an automatically interpreted or displayed layer; the W3-approved future bounded 2D WGS84 GeoJSON importer is not implemented.

## Data Pathway / Scientific Status Key

| Category | What the current project can establish | Does not establish |
| --- | --- | --- |
| Active project-wired | Referenced, browser-ready artifact and project/loader code | Generic raw data import or verified scientific measurements |
| Offline source preparation | Named source format, transformation script, derived manifest/asset | Regeneration from public checkout if raw archive absent |
| Preview / QA / synthetic | Prepared points, interpolated meshes, survey context or procedural fallback | Survey-calibrated full source product, definitive measurement or accepted mesh |
| Future / disabled | Planned or named layer/product without active accepted route | Supported runtime import or scientific completion |

**Registration limits:** Declared CRS, source metadata, scene origin and visibly coincident layers do not independently validate horizontal or vertical datum ties, seismic time/depth conversion or inversion results. Coordinate/accuracy acceptance remains dataset-specific.

## Project Areas

| Project | Path | Observed current role | Status / caveat |
| --- | --- | --- | --- |
| Woodjam | `projects/woodjam/` | Real/reference investor project with public data layers and page flow | Observed; still a regression guard |
| Shahbazi Gravel Pit / Case Study B | `projects/case-study-b/` | High-fidelity quarry demo with source-derived previews, runtime audience lens, and placeholder/future targets | Observed; production orthomosaic/mesh/full point stream still future |
| Utah FORGE | `projects/utah-forge/` | Geothermal/geophysics project with active Phase 3 MT records, public context, scalar/volume/threshold/top-surface records, and active seismic browser records | Observed; demo/default acceptance remains human-review work |
| Base GUI Template | `projects/base-gui/` | Blank/default authoring context for shared GUI/environment defaults | Observed; not real project data |

## Runtime Data Pattern

| Layer | Observed role | Evidence |
| --- | --- | --- |
| Top-level `data/` | Served as Vite public data during dev; copied to build except `source` and `desktop.ini` | `vite.config.ts`, Woodjam layer paths |
| `projects/*/project.json` | Project metadata, CRS/bounds, layer manifest, metadata/provenance, page order, `previewFiles`, `futureTargets` | Project manifests |
| `projects/*/environment.json` | Default visibility, layer styles, scene and GUI defaults | Project environments |
| `projects/*/pages/*.json` | Page/presentation state and camera/page deltas | Project page folders |
| `projects/*/overlays/*` | Page overlay markdown/assets | Project overlay folders |
| `projects/*/data/raw` or `client_preprocessed` | Historical source/client identifiers preserved in provenance; source bytes are archived outside the active repo | Shahbazi raw, Utah FORGE client_preprocessed; resolve through `docs/archive-map.md` |
| `projects/*/data/processed` or `geosee_processed` | Browser-ready derived artifacts and provenance | Shahbazi processed, Utah FORGE geosee_processed |

## Computed Artifact Pipeline Pointer

Observed: `docs/dev-context/Computed-Artifact-Pipeline.md` now includes an observed pipeline map from raw/source inputs to prep scripts, intermediate outputs, computed artifacts, render-ready outputs, and consuming layer IDs.

Use that map before any cleanup touches source inputs, generated artifacts, QA outputs, manifests, legends, color ramps, scalar ranges, prep scripts, or project layer references. The map is a planning/control note only and does not approve moving data, changing manifests, running scripts, or reducing computed output fidelity.

## Woodjam

**Input/status qualifier:** Woodjam uses selected prepared drill/collar, lithology/assay intervals, soil geochemistry, geology and geographic GeoJSON/JSON, not a general raw well-log or assay importer. The hyperspectral coverage and LiDAR footprint overlays indicate **areas of coverage**, not loaded hyperspectral cubes or LiDAR survey point clouds.

| Dataset family | Status | Evidence |
| --- | --- | --- |
| Terrain, drilling, assays, soils, IP lines, hyperspectral coverage, LiDAR footprint, hydrography, geology, roads, power, neighbors, VRI | Observed | `projects/woodjam/project.json`, top-level `data/`, `docs/woodjam/` |
| Placeholder/draft interpretation layers | Observed | Three Firs target, Great Plains target, Megaton anomaly entries in `project.json` |
| Publish/export outputs | Observed unresolved | `docs/01-scope.md`, `docs/04-build-sequence.md` |

## Shahbazi / Case Study B

**Input/status qualifier:** TLS ASCII XYZ and UAV/photogrammetry source records are prepared **offline** as sampled/tiled point previews, separate surface/interpolated mesh previews, contours, GCP/camera QA and projected photo previews. These are **not** a final orthomosaic, finished GLB/glTF survey, full Potree/EPT cloud or accepted stockpile-volume computation. Original raw sources are separately archived; synthetic quarry objects remain placeholders.

| Dataset family | Status | Evidence |
| --- | --- | --- |
| Raw UAV/TLS/photogrammetry source staging | Archived source, historical identifier | `projects/case-study-b/data/raw/shahbazi_gravel_pit/`; actual source bytes under `C:\GeoSee\GeoSee_Archive` |
| Processed preview outputs | Observed | `projects/case-study-b/data/processed/shahbazi_gravel_pit/` |
| TLS sampled/tiled previews, TLS island mesh, sparse-object-point outer surface, split contours, GCPs, camera poses/frustums, dense matching, tie-point QA, projected image preview | Observed | `projects/case-study-b/project.json`, processed README |
| Synthetic/planned quarry overlays | Observed | Disabled placeholder layers in `projects/case-study-b/project.json` |
| Orthomosaic, textured mesh/GLB, Potree/EPT full point stream | Observed future targets | `futureTargets` in `projects/case-study-b/project.json` |
| Metric/GIS-grade orientation and production quality | Unverified / needs human review | Docs caution that previews are not production survey outputs |

## Utah FORGE

**Input/status qualifier:** SEG-Y seismic and EDI/inversion inputs are processed **offline** into project-specific browser sections, volumes, stations and QC artifacts; the browser does not generally import raw SEG-Y/EDI. The prepared MT inversion **one active full-extent scalar-volume product** is 383×313×33 voxels; separate threshold surfaces are **not** another scalar volume. MT station sources include 122 physical stations/244 EDI variants, and model-derived resistivity should not be called a direct subsurface measurement. The current Utah borehole logs render only 16A(78)-32 HCGR/HSGR gamma tracks; some other wells are trajectory-only or source-location-only markers. Seismic L5/L11 uses **approximate fallback navigation**. All survey-grade interlayer registration and seismic vertical datum/time-depth claims remain **unverified**.

**GDR-034 hold:** public terrain effective default visibility depends on environment/page/preset overrides and has not been verified end-to-end. Historical “default-visible” prose does not establish its effective startup state; no behavioral change is proposed here.

| Dataset family | Status | Evidence |
| --- | --- | --- |
| Phase 3 MT electrical resistivity source packages | Historical source | Source package paths remain in provenance, but source-only packages were purged from the active repo; resolve source bytes through `docs/archive-map.md`. |
| MT stations | Observed measured layer | `mt_stations.geojson`, `projects/utah-forge/project.json`, Utah decisions docs |
| MT resistivity preview/full-density/slices/top surface/volume/threshold surfaces | Observed source-derived outputs | `projects/utah-forge/project.json`, `environment.json`, `geosee_processed/.../electrical_resistivity/` |
| Public terrain/roads/hydrography context | Observed | `public_context/manifest.json`, `project.json`, `environment.json` |
| Phase 3 seismic browser outputs | Observed in manifests/runtime/test | `project.json`, `environment.json`, `CHANGELOG.md`, `tests/utah-forge/`, seismic browser files |
| Project-local data/layer status guide | Observed status guidance | `projects/utah-forge/DATA_LAYER_STATUS.md`; covers source/client/public, processed/browser-ready, render-ready, QA/validation, provenance/status wrappers, MT, seismic, demo candidates, and unclear/future artifacts; docs/status only, no runtime behavior change |
| Southwestern/regional MT | Observed reserved/inactive in docs | `projects/utah-forge/data/README.md`, Utah decisions docs |
| Wells, faults, infrastructure, microseismic events | Observed unresolved/future | Utah project docs |

## Prep Areas

| Prep family | Status | Evidence |
| --- | --- | --- |
| Woodjam fetch/convert scripts | Observed | `prep/fetch_*.py`, `prep/reproject_drills.py` |
| Shahbazi preview-generation scripts | Observed | `prep/build_shahbazi_*.mjs`, `prep/shahbazi_config.mjs` |
| Utah FORGE MT scripts | Observed | `prep/build_utah_forge_mt_*.mjs`, `prep/utah_forge_config.mjs` |
| Utah FORGE seismic scripts | Observed | `prep/build_utah_forge_seismic_browser.py`, `prep/build_utah_forge_seismic_demo_recipes.mjs` |
| Public context fetch script | Observed | `prep/fetch_utah_forge_public_context.py` |

## Data Open Questions

| Question | Status | Evidence / note |
| --- | --- | --- |
| Is current Utah default-visible state accepted for demo/control-plane stability? | Unverified / needs human review | `environment.json` differs from several prose docs |
| Which source/provenance records should be registered first in `Source-Register.md`? | Unverified / needs human review | Multiple candidates across Woodjam, Shahbazi, Utah |
| What focused verification evidence is required for dataset-map/current-state reconciliation? | Unverified / needs human review | Capture fresh focused evidence when this reconciliation is resumed. |
| Which pipeline rows need metadata wrappers first? | Unverified / needs human review | `Computed-Artifact-Pipeline.md` identifies missing wrappers/acceptance status across Utah, Shahbazi, Woodjam, and Base GUI. |
| Should `projects/utah-forge/DATA_LAYER_STATUS.md` become the first project-local status guide after human review? | Proposed / needs human review | Created as project-local status guidance, not acceptance or runtime authority. |
