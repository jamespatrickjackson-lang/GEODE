# Utah FORGE Phase 3 - GeoSee Electrical Resistivity Outputs

This folder contains GeoSee-ready outputs derived from:

```text
../../../client_preprocessed/utah_forge_phase_3/electrical_resistivity/
```

That path is a historical source identifier. The actual source bytes are under
`C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\client_preprocessed\utah_forge_phase_3\electrical_resistivity\`.

## Current Status

Phase 3 MT electrical resistivity is active in GeoSee.

Current source files:

```text
mt_edis/FORGE_MT_190812_EDIs.zip
mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip
references/FORGE_MT_12_12_2021.prj
```

Current app-ready output groups:

```text
intake/
stations/
resistivity_model/
```

## Intake Outputs

```text
intake/source_inventory.json
intake/archive_entries.json
intake/crs_transform.json
intake/crs_origin_note.md
```

Purpose:

- file inventory
- archive contents
- CRS evidence
- scene origin
- transform contract

## Station Outputs

```text
stations/mt_stations.geojson
stations/mt_stations.provenance.json
```

Current facts:

- 122 physical station markers
- 244 EDI variants retained in marker properties
- classification: measured
- source coordinates converted to EPSG:26912 then scene-local meters

## Resistivity Outputs

```text
resistivity_model/model_stats.json
resistivity_model/model_provenance.json
resistivity_model/resistivity_point_preview.json
resistivity_model/full_density/manifest.json
resistivity_model/full_density/stats.json
resistivity_model/full_density/provenance.json
resistivity_model/full_density/tiles/*.positions.bin
resistivity_model/full_density/tiles/*.scalars.bin
resistivity_model/top_surface/manifest.json
resistivity_model/top_surface/stats.json
resistivity_model/top_surface/provenance.json
resistivity_model/top_surface/mt_top_surface_mesh_preview.json
resistivity_model/top_envelope_surface/manifest.json
resistivity_model/top_envelope_surface/stats.json
resistivity_model/top_envelope_surface/provenance.json
resistivity_model/top_envelope_surface/mt_top_envelope_surface_mesh_preview.json
resistivity_model/top_contact_surface/manifest.json
resistivity_model/top_contact_surface/stats.json
resistivity_model/top_contact_surface/provenance.json
resistivity_model/top_contact_surface/mt_top_contact_surface_mesh_preview.json
resistivity_model/slices/manifest.json
resistivity_model/slices/legend.json
resistivity_model/slices/resistivity_slices_mesh_preview.json
resistivity_model/slices/resistivity_slices.provenance.json
resistivity_model/volume/mt_volume_manifest.json
resistivity_model/volume/full_extent/volume.u8
resistivity_model/volume/full_extent/mask.u8
resistivity_model/volume/forge_focused/volume.u8
resistivity_model/volume/forge_focused/mask.u8
resistivity_model/volume/threshold_surfaces/mt_threshold_surfaces_mesh_preview.json
resistivity_model/volume/threshold_surfaces/provenance.json
```

Current facts:

- source rows: 1,094,940
- positive resistivity rows: 1,094,624
- masked zero/non-positive rows: 316
- point preview emitted points: 90,000
- full-density emitted points: 1,094,624
- full-density format: tiled Float32 XYZ plus Float32 scalar buffers
- preview-derived ground cap: 1,135 vertices and 1,844 retained adjacent-grid triangles from the existing MT preview only
- preview-derived ground cap minimum scene elevation: 816.49 m
- observed top-envelope surface: 23,811 vertices and 46,283 retained Delaunay triangles
- observed top-envelope source: top-most observed full-density MT cell-center point per unique XY column
- observed top-envelope input columns: 24,332 observed top points
- observed top-envelope bridge triangles dropped: 2,361 with max edge above 10,000 m
- observed top-envelope elevation range: 1358.266 m to 3449.131 m
- observed top-envelope edge-length distribution and control points: recorded in `resistivity_model/top_envelope_surface/stats.json`
- retained full-density top-contact support-grid surface: 10,509 vertices and 20,608 triangles under `resistivity_model/top_contact_surface/`
- display value: `log10(resistivity_ohm_m)`
- slice preview: six horizontal elevation slices and two vertical station-centroid sections
- scalar volumes: one full-extent context product and one explicitly focused presentation crop
- threshold surfaces: six fixed iso-resistivity communication meshes: three full-extent and three FORGE-focused mask-aware Marching Cubes surfaces with welded vertices, conservative smoothing metadata, and runtime-computed smooth normals
- crop applied: false
- vertical exaggeration: 1.0
- classification: source-derived inversion model
- fidelity check: `npm run check:mt-resistivity`

## Runtime Role

Default visible Stage 2 density layer:

```text
utah-forge-mt-resistivity-full-density
```

UI-facing full-density top-envelope aid:

```text
utah-forge-mt-top-surface
```

Explicit full-density top-contact technical endpoint:

```text
utah-forge-mt-top-contact-surface
```

QA/validation layer:

```text
utah-forge-mt-resistivity-preview
```

Measured station layer:

```text
utah-forge-mt-stations
```

Optional authored slice layer:

```text
utah-forge-mt-resistivity-slices
```

Optional scalar volume and isosurface layers:

```text
utah-forge-mt-resistivity-volume
utah-forge-mt-resistivity-threshold-surfaces
```

## Known Caveats

- The slice preview is an authored display product, not a live full-volume renderer.
- The full-density layer is a tiled scalar point-cloud renderer, not a voxel/volume renderer.
- The full-extent scalar volume and full-extent isosurfaces are source-derived context; the FORGE-focused scalar volume and focused isosurfaces are presentation crops and must be labeled as such.
- Current threshold surfaces are mask-aware Marching Cubes communication meshes, rendered as solid presentation surfaces by default; diagnostic wireframe is an editor/debug mode, not the normal presentation style.
- Threshold surfaces are not interpreted faults, contacts, targets, ore bodies, or resource estimates.
- The retained preview-derived ground cap is generated only from the existing 90,000-point MT preview and remains under `resistivity_model/top_surface/` as support/history data.
- The UI-facing `utah-forge-mt-top-surface` layer reads the observed top-envelope artifact, not the retained preview cap or support-grid top-contact surface.
- The observed top-envelope surface is triangulated directly from observed top-most full-density MT cell-center points.
- Surface fidelity follows source support: dense areas render finer; sparse outer areas render coarser or remain open.
- The retained top-contact support-grid surface remains available as history/support evidence, not current visible top-surface authority.
- The surfaces are standalone and are not controlled by the MT scalar trim/feather legend.
- No MT top surface is public topo, lidar, DEM terrain, measured ground, or interpreted geology.
- The point preview is downsampled for performance.
- Non-positive resistivity values are masked because `log10` is undefined.
- The model's very deep negative elevation extent needs careful narration in presentation copy.
- No crop or vertical exaggeration is applied in the baseline output.
