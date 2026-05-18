# Shahbazi Gravel Pit Processing TODO

Initial preview processing is implemented for the TLS sub-zone only. Use this checklist before enabling any full-resolution Shahbazi layers in `project.json`.

Implemented so far:
- `prep/build_shahbazi_tls_preview.mjs`
- `projects/case-study-b/data/processed/shahbazi_gravel_pit/tls_preview_points.json`
- `projects/case-study-b/data/processed/shahbazi_gravel_pit/tls_preview_points.provenance.json`

This preview samples `LaserScan.xyz` for fast browser display. It preserves metric scale but is centered/lifted into the existing procedural scene. Full GIS registration, Potree/EPT conversion, mesh generation, orthomosaic generation, and GCP normalization are still TODO.

Before this file:

1. Complete `ACQUISITION_BRIEF.md`.
2. Place source files under `projects/case-study-b/data/raw/shahbazi_gravel_pit/`.
3. Complete `TRIAGE_CHECKLIST.md`.
4. Replace assumptions in staging records with observed file facts.
5. Use `INGEST_PIPELINE_BRIEF.md` for the implementation pass.

Processing sequence:

1. Download source archive from the cited public dataset location.
2. Record citation, download URL, date accessed, archive filenames, sizes, and checksums.
3. Inspect archive structure and identify UAV image groups, GCP/check point tables, corresponding image points, MVS assets, and TLS point cloud.
4. Identify point cloud formats, image formats, coordinate fields, units, CRS, vertical datum, and local coordinate conventions.
5. Confirm whether the dataset is georeferenced directly or requires local-to-project transform.
6. Convert point cloud or mesh to a web-ready format such as Potree metadata or GLB, depending on chosen loader support.
7. Generate a lightweight preview layer for fast Case Study B loading. Done for TLS sample; repeat only if a better source product replaces it.
8. Generate or export an orthomosaic / image texture if source processing supports it.
9. Normalize ground control and check points into GeoJSON with explicit CRS metadata.
10. Verify scale, orientation, vertical exaggeration, and scene origin alignment against the procedural shell.
11. Keep observed source data, transformed outputs, and interpretive overlays separated in staging records.
12. Update `project.json` only after processed files exist and operator/technical review clears the layer.

Planned processed output targets:
- `projects/case-study-b/data/processed/shahbazi_gravel_pit/shahbazi_gravel_pit_textured_mesh.glb`
- `projects/case-study-b/data/processed/shahbazi_gravel_pit/point_cloud_potree/metadata.json`
- `projects/case-study-b/data/processed/shahbazi_gravel_pit/orthomosaic.tif`
- `projects/case-study-b/data/processed/shahbazi_gravel_pit/ground_control_points.geojson`
- `projects/case-study-b/data/processed/shahbazi_gravel_pit/tls_subzone_potree/metadata.json`
- `projects/case-study-b/data/processed/shahbazi_gravel_pit/derived_demo_overlays.geojson`

Current preview output:
- `projects/case-study-b/data/processed/shahbazi_gravel_pit/tls_preview_points.json`
