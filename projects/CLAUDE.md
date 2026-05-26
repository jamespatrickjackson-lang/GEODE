# projects — Agent Guardrails

Per-project content lives here. Each project subdir contains both small
authoring state (JSON) and large bulk data (GeoJSON, .bin, WebP, raster
manifests).

## Project Subdirs

- `base-gui/` — base GUI scene.
- `case-study-b/` — Case Study B scene.
- `utah-forge/` — Utah FORGE Phase 3. Heaviest data footprint (~116 MB
  under `utah-forge/data/`).
- `woodjam/` — Woodjam scene.

## Search Rules

Do not `Grep` or `Glob` into `projects/*/data/**` unless the task
explicitly requires inspecting raw data. These trees contain:

- Large GeoJSON (vector text grep will stream MB of coordinates).
- `.bin` scalar/position tiles (binary; grep wastes time).
- WebP/JPG/TIFF rasters.
- Manifests, provenance, stats JSON for the resistivity model and other
  processed artefacts.

When data inspection is required, scope the search to a specific subtree
(for example `projects/utah-forge/data/geosee_processed/utah_forge_phase_3/
electrical_resistivity/`), not the whole project.

## Authoring Persistence

Project authoring state is written through the dev-only Vite plugin
endpoint `/api/write-file` registered in `vite.config.ts`. State lives on
disk under `projects/<project>/`. Do not introduce IndexedDB, LocalStorage,
or a backend service without explicit user direction.

## Raw Data Origin

Raw upstream buckets live outside the repo at
`C:\GeoSee\GeoSee_Archive\`. Resolve any historical repo-relative path
through `docs/archive-map.md` and `docs/archive-manifest.json`.
