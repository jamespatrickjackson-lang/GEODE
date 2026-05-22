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
- Phase 3 MT preview-derived ground cap remains wired as the existing Stage 2 top-surface aid
- Phase 3 MT full-density top-contact surface is generated and wired as an additional Stage 2 spatial context aid
- Phase 3 MT resistivity point preview is generated and wired as a QA/validation layer
- Phase 3 MT authored resistivity slices are generated and wired as an optional presentation layer
- Phase 3 MT scalar layers expose editor controls and a viewer legend
- the preview-derived ground cap and full-density top-contact surface are standalone and are not controlled by MT scalar trim/feather legend edits
- Southwestern/regional MT is not active yet
- Phase 3 seismic browser outputs are generated under `geosee_processed/` and wired in current project files

## Planning And Handoff Docs

Read these before moving or processing data:

```text
projects/utah-forge/Utah_Forge_Decisions.md
projects/utah-forge/Utah_Forge_DevPlan.md
projects/utah-forge/Utah_Forge_Data_Intake_Checklist.md
projects/utah-forge/AI_NEXT_AGENT_START_HERE.md
projects/utah-forge/AI_FUTURE_DATA_INPUT_PLAYBOOK.md
projects/utah-forge/Utah_Forge_Next_Stage_Gates.md
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
full-density top-contact surface: 10,509 vertices, 20,608 full-extent support-grid triangles
full-density top-contact source: direct highest source-derived MT cell centers plus inverse-distance support nodes across the full data-point XY extent
full-density top-contact observed support nodes: 2,164
full-density top-contact inferred support nodes: 8,345
full-density top-contact elevation range: 1362.757 m to 3449.131 m
full-density top-contact control points and support-distance stats: recorded in top_contact_surface/stats.json
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
