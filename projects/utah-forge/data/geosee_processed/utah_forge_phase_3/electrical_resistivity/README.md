# Utah FORGE Phase 3 - GeoSee Electrical Resistivity Outputs

Updated: 2026-05-12

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
resistivity_model/slices/manifest.json
resistivity_model/slices/legend.json
resistivity_model/slices/resistivity_slices_mesh_preview.json
resistivity_model/slices/resistivity_slices.provenance.json
```

Current facts:

- source rows: 1,094,940
- positive resistivity rows: 1,094,624
- masked zero/non-positive rows: 316
- point preview emitted points: 90,000
- full-density emitted points: 1,094,624
- full-density format: tiled Float32 XYZ plus Float32 scalar buffers
- preview-derived ground cap: 1,135 vertices and 1,844 retained adjacent-grid triangles from the existing MT preview only
- preview ground cap minimum scene elevation: 816.49 m
- display value: `log10(resistivity_ohm_m)`
- slice preview: six horizontal elevation slices and two vertical station-centroid sections
- crop applied: false
- vertical exaggeration: 1.0
- classification: source-derived inversion model

## Runtime Role

Default visible Stage 2 density layer:

```text
utah-forge-mt-resistivity-full-density
```

Default visible topology aid:

```text
utah-forge-mt-top-surface
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

## Known Caveats

- The slice preview is an authored display product, not a live full-volume renderer.
- The full-density layer is a tiled scalar point-cloud renderer, not a voxel/volume renderer.
- The top surface is a preview-derived approximate ground cap, not measured terrain or interpreted geology.
- The top surface is standalone and is not controlled by the MT scalar trim/feather legend.
- The top surface is generated only from the existing 90,000-point MT preview using regular grid cells, p95 upper elevations, connected-component filtering, and adjacent-cell triangulation to avoid sparse-column icicle sheets.
- The point preview is downsampled for performance.
- Non-positive resistivity values are masked because `log10` is undefined.
- The model's very deep negative elevation extent needs careful narration in presentation copy.
- No crop or vertical exaggeration is applied in the baseline output.
- No seismic output is active; seismic is blocked until the user explicitly says to start.
