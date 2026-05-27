# Utah FORGE Data

This folder holds Utah FORGE delivered source/client data and GeoSee-ready derived outputs.

## Current State

Current kept state:

- wrong early data folders were removed on 2026-05-12
- Utah FORGE source/client archives were moved out of the active repo and are
  mapped through `docs/archive-map.md` and `docs/archive-manifest.json`
- Phase 3 MT source inventory, archive entries, and CRS/origin docs are under `geosee_processed/`
- Phase 3 MT station markers are generated and wired as measured station-location data
- Phase 3 MT full-density tiled resistivity renderer is generated and wired as the Stage 2 density layer
- Phase 3 MT preview-derived ground cap remains retained under `resistivity_model/top_surface/` as history/support data
- the UI-facing `3D MT top surface` now uses the observed full-density top-envelope surface generated under `resistivity_model/top_envelope_surface/`
- Phase 3 MT full-density top-contact support-grid surface remains retained as an explicit technical endpoint for source/provenance review
- Phase 3 MT resistivity point preview is generated and wired as a QA/validation layer
- Phase 3 MT authored resistivity slices are generated and wired as an optional presentation layer
- Phase 3 MT scalar layers expose editor controls and a viewer legend
- the observed top-envelope, retained preview-derived ground cap, and retained full-density top-contact surface are standalone and are not controlled by MT scalar trim/feather legend edits
- Southwestern/regional MT is not active yet
- Phase 3 seismic browser outputs are generated under `geosee_processed/` and wired in current project files

## Data Status Doc

For a full summary of current data / layer state, artifact roles, and open review items:

```text
projects/utah-forge/DATA_LAYER_STATUS.md
```

## Locked Folder Rule

Delivered source/client files keep their historical repo-relative identifiers
under:

```text
client_preprocessed/
```

The actual source bytes now live under
`C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\client_preprocessed\`.
Do not recommit those archive buckets to the active repo.

GeoSee-ready outputs stay under:

```text
geosee_processed/
```

Do not put delivered source/client files in `geosee_processed/`.

## Main Project Areas

The current staging model has two main areas:

```text
forge_southwestern/
utah_forge_phase_3/
```

Each area has two dataset slots:

```text
electrical_resistivity/
seismic_analysis/
```

Current active target:

```text
utah_forge_phase_3/electrical_resistivity/
```

## Current Source Files

```text
C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\client_preprocessed\utah_forge_phase_3\electrical_resistivity\
  mt_edis/FORGE_MT_190812_EDIs.zip
  mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip
  references/FORGE_MT_12_12_2021.prj
```

Keep original filenames and folder structure where practical.

## Current GeoSee-Ready Outputs

```text
geosee_processed/utah_forge_phase_3/electrical_resistivity/
  intake/
    source_inventory.json
    archive_entries.json
    crs_transform.json
    crs_origin_note.md
  stations/
    mt_stations.geojson
    mt_stations.provenance.json
  resistivity_model/
    model_stats.json
    model_provenance.json
    resistivity_point_preview.json
    full_density/
      manifest.json
      stats.json
      provenance.json
      tiles/
    top_surface/
      manifest.json
      stats.json
      provenance.json
      mt_top_surface_mesh_preview.json
    top_envelope_surface/
      manifest.json
      stats.json
      provenance.json
      mt_top_envelope_surface_mesh_preview.json
    top_contact_surface/
      manifest.json
      stats.json
      provenance.json
      mt_top_contact_surface_mesh_preview.json
    slices/
      manifest.json
      legend.json
      resistivity_slices_mesh_preview.json
      resistivity_slices.provenance.json
```

## Current Data Facts

Coordinate frame:

```text
EPSG:26912 / NAD83 UTM Zone 12N
meters
GeoSee local X east, Y north, Z up
no crop
vertical exaggeration 1.0
```

Station output:

```text
122 physical MT station markers
244 EDI variants retained in marker properties
classification: measured
```

Resistivity output:

```text
source rows: 1,094,940
positive resistivity rows: 1,094,624
masked zero/non-positive rows: 316
point preview emitted points: 90,000
full-density emitted points: 1,094,624
full-density format: tiled Float32 XYZ plus Float32 scalar buffers
preview-derived ground cap: 1,135 vertices, 1,844 retained adjacent-grid triangles
preview-derived ground cap source: 90,000-point MT preview
preview-derived ground cap minimum scene elevation: 816.49 m
observed top-envelope surface: 23,811 vertices, 46,283 retained Delaunay triangles
observed top-envelope source: top-most observed full-density MT cell-center point per unique XY column
observed top-envelope input columns: 24,332 observed top points
observed top-envelope bridge triangles dropped: 2,361 with max edge above 10,000 m
observed top-envelope elevation range: 1358.266 m to 3449.131 m
observed top-envelope edge-length distribution and control points: recorded in top_envelope_surface/stats.json
retained full-density top-contact support-grid surface: 10,509 vertices, 20,608 triangles under top_contact_surface/
slice preview: 6 horizontal slices, 2 vertical sections
display value: log10(resistivity_ohm_m)
classification: source-derived inversion model
```

## Before Wiring Future Data

Confirm:

- actual files and formats
- CRS or local coordinate frame
- horizontal and vertical units
- source bounds
- scene origin
- dataset type
- client/source attribution
- license or usage permission
- whether the layer is measured, source-derived, preview, placeholder, or future
- whether the output is visually and technically ready for the editor/viewer

Do not commit large client data unless intentionally approved.
