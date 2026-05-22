# Dataset Map

Last populated: 2026-05-15

## Project Areas

| Project | Path | Observed current role | Status / caveat |
| --- | --- | --- | --- |
| Woodjam | `projects/woodjam/` | Real/reference investor project with public data layers and page flow | Observed; still a regression guard |
| Shahbazi Gravel Pit / Case Study B | `projects/case-study-b/` | High-fidelity quarry demo with source-derived previews, runtime audience lens, and placeholder/future targets | Observed; production orthomosaic/mesh/full point stream still future |
| Utah FORGE | `projects/utah-forge/` | Geothermal/geophysics project with active Phase 3 MT records, public context, scalar/volume/threshold/top-surface records, and active seismic browser records | Observed; docs contradict whether seismic/public context/current defaults are accepted |
| Base GUI Template | `projects/base-gui/` | Blank/default authoring context for shared GUI/environment defaults | Observed; not real project data |

## Runtime Data Pattern

| Layer | Observed role | Evidence |
| --- | --- | --- |
| Top-level `data/` | Served as Vite public data during dev; copied to build except `source` and `desktop.ini` | `vite.config.ts`, Woodjam layer paths |
| `projects/*/project.json` | Project metadata, CRS/bounds, layer manifest, metadata/provenance, page order, `previewFiles`, `futureTargets` | Project manifests |
| `projects/*/environment.json` | Default visibility, layer styles, scene and GUI defaults | Project environments |
| `projects/*/pages/*.json` | Page/presentation state and camera/page deltas | Project page folders |
| `projects/*/overlays/*` | Page overlay markdown/assets | Project overlay folders |
| `projects/*/data/raw` or `client_preprocessed` | Source/client material preserved before app conversion | Shahbazi raw, Utah FORGE client_preprocessed |
| `projects/*/data/processed` or `geosee_processed` | Browser-ready derived artifacts and provenance | Shahbazi processed, Utah FORGE geosee_processed |

## Computed Artifact Pipeline Pointer

Observed: `docs/dev-context/Computed-Artifact-Pipeline.md` now includes an observed pipeline map from raw/source inputs to prep scripts, intermediate outputs, computed artifacts, render-ready outputs, and consuming layer IDs.

Use that map before any cleanup touches source inputs, generated artifacts, QA outputs, manifests, legends, color ramps, scalar ranges, prep scripts, or project layer references. The map is a planning/control note only and does not approve moving data, changing manifests, running scripts, or reducing computed output fidelity.

## Woodjam

| Dataset family | Status | Evidence |
| --- | --- | --- |
| Terrain, drilling, assays, soils, IP lines, hyperspectral coverage, LiDAR footprint, hydrography, geology, roads, power, neighbors, VRI | Observed | `projects/woodjam/project.json`, top-level `data/`, `docs/woodjam/` |
| Placeholder/draft interpretation layers | Observed | Three Firs target, Great Plains target, Megaton anomaly entries in `project.json` |
| Publish/export outputs | Observed unresolved | `docs/01-scope.md`, `docs/04-build-sequence.md` |

## Shahbazi / Case Study B

| Dataset family | Status | Evidence |
| --- | --- | --- |
| Raw UAV/TLS/photogrammetry source staging | Observed | `projects/case-study-b/data/raw/shahbazi_gravel_pit/` |
| Processed preview outputs | Observed | `projects/case-study-b/data/processed/shahbazi_gravel_pit/` |
| TLS sampled/tiled previews, TLS island mesh, sparse-object-point outer surface, split contours, GCPs, camera poses/frustums, dense matching, tie-point QA, projected image preview | Observed | `projects/case-study-b/project.json`, processed README |
| Synthetic/planned quarry overlays | Observed | Disabled placeholder layers in `projects/case-study-b/project.json` |
| Orthomosaic, textured mesh/GLB, Potree/EPT full point stream | Observed future targets | `futureTargets` in `projects/case-study-b/project.json` |
| Metric/GIS-grade orientation and production quality | Unverified / needs human review | Docs caution that previews are not production survey outputs |

## Utah FORGE

| Dataset family | Status | Evidence |
| --- | --- | --- |
| Phase 3 MT electrical resistivity source packages | Historical source | Source package paths remain in provenance, but source-only packages were purged from the active repo and remain recoverable from Git history. |
| MT stations | Observed measured layer | `mt_stations.geojson`, `projects/utah-forge/project.json`, Utah decisions docs |
| MT resistivity preview/full-density/slices/top surface/volume/threshold surfaces | Observed source-derived outputs | `projects/utah-forge/project.json`, `environment.json`, `geosee_processed/.../electrical_resistivity/` |
| Public terrain/roads/hydrography context | Observed | `public_context/manifest.json`, `project.json`, `environment.json` |
| Phase 3 seismic browser outputs | Observed in manifests/runtime/test | `project.json`, `environment.json`, `CHANGELOG.md`, `tests/utah-forge-smoke.spec.ts`, seismic browser files |
| Project-local data/layer status guide | Observed status guidance | `projects/utah-forge/DATA_LAYER_STATUS.md`; covers source/client/public, processed/browser-ready, render-ready, QA/validation, provenance/status wrappers, MT, seismic, demo candidates, and unclear/future artifacts; docs/status only, no runtime behavior change |
| Seismic active status | Observed contradiction | Project-local READMEs and Utah docs say not active/blocked; project config, environment defaults, page override, generated browser manifest, source loader/editor/scene code, prep scripts, and tests show implemented/default-visible paths. Historical contradiction evidence remains recoverable from Git history. |
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
| Which Utah FORGE docs are stale after seismic/public-context work? | Unverified / needs human review | Contradictions across project-local READMEs, project manifest, environment, CHANGELOG, tests |
| Is current Utah default-visible state accepted for demo/control-plane stability? | Unverified / needs human review | `environment.json` differs from several prose docs |
| Should Utah FORGE seismic remain active/default-visible, be parked, or be hidden by default later? | Unverified / needs human review | `VER-2026-05-15-002` records blocked-doc evidence and active/runtime/test evidence; no recommendation executed. |
| Which source/provenance records should be registered first in `Source-Register.md`? | Unverified / needs human review | Multiple candidates across Woodjam, Shahbazi, Utah |
| What focused verification evidence is required for dataset-map/current-state reconciliation? | Unverified / needs human review | Capture fresh focused evidence when this reconciliation is resumed. |
| Which pipeline rows need metadata wrappers first? | Unverified / needs human review | `Computed-Artifact-Pipeline.md` identifies missing wrappers/acceptance status across Utah, Shahbazi, Woodjam, and Base GUI. |
| Should `projects/utah-forge/DATA_LAYER_STATUS.md` become the first project-local status guide after human review? | Proposed / needs human review | Created as project-local status guidance, not acceptance or runtime authority. |
