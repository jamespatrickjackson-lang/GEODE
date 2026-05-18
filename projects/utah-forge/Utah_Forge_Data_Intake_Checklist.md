# Utah FORGE Data Intake Checklist

Updated: 2026-05-12

Use this when placing or reviewing Utah FORGE data. The point is to keep source files easy to find, keep app-ready outputs separate, and avoid enabling a viewer layer before the data is understood.

## Locked Folder Rule

Delivered source/client files go here:

```text
projects/utah-forge/data/client_preprocessed/
```

GeoSee-ready converted outputs go here:

```text
projects/utah-forge/data/geosee_processed/
```

Do not place delivered source/client files in `geosee_processed/`.

## Current Status Summary

Complete for Phase 3 MT baseline:

- source files placed
- inventory written
- CRS/origin transform written
- station markers generated
- resistivity point preview generated
- full-density tiled resistivity renderer generated
- preview-derived ground cap generated
- authored resistivity slices generated
- station, full-density, preview ground cap, point preview, and slice layers wired into the app
- core editor controls exposed
- value legend wired

Not complete:

- polished Phase 3 MT page/story pass
- seismic processing
- Southwestern/regional MT processing
- wells/faults/infrastructure/terrain integration
- final client-facing narrative

User boundary:

- seismic must not be processed or wired until the user explicitly says to start

## Exact Incoming Data Locations

### Utah FORGE Phase 3 - Electrical Resistivity

Primary active source location:

```text
projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity/
```

Current source subfolders:

```text
mt_edis/
mt_model_cell_center_updated/
references/
```

Current files:

```text
mt_edis/FORGE_MT_190812_EDIs.zip
mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip
references/FORGE_MT_12_12_2021.prj
```

Expected metadata to preserve:

- README files
- CRS / projection files
- license or usage notes
- source delivery notes
- method papers or figure PDFs
- model headers

Do not discard duplicate EDI variants. The station-marker generator dedupes physical station markers while retaining variants in properties.

### Utah FORGE Phase 3 - Seismic Analysis

Use this location only for Phase 3 seismic files:

```text
projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/seismic_analysis/
```

Expected future files may include:

- SEG-Y / SGY
- navigation
- velocity model
- processing report
- interpretation lines
- metadata / README files

No Phase 3 seismic layer is active yet.

### Forge Southwestern / Regional - Electrical Resistivity

Use this location for regional MT / Southwestern Utah resistivity context:

```text
projects/utah-forge/data/client_preprocessed/forge_southwestern/electrical_resistivity/
```

This is not the current active target. Keep it staged until Phase 3 MT is stable.

### Forge Southwestern / Regional - Seismic Analysis

Use this location only for regional/Southwestern seismic data:

```text
projects/utah-forge/data/client_preprocessed/forge_southwestern/seismic_analysis/
```

No regional/Southwestern seismic layer is active yet.

### Unsorted / Legacy Data

There is still an `Unsorted data` area under `client_preprocessed/`.

Treat it as quarantine, not as an app source. Move or process files from there only after a fresh inventory and explicit decision. Previously inspected files from GDR submissions 1015 and 1141 appeared to be seismic reflection related, not MT resistivity.

## Current GeoSee Output Locations

### Intake

```text
projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/
```

Current outputs:

```text
source_inventory.json
archive_entries.json
crs_transform.json
crs_origin_note.md
```

### Phase 3 MT Station Markers

```text
projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/stations/
```

Current outputs:

```text
mt_stations.geojson
mt_stations.provenance.json
```

Current facts:

- generated from `FORGE_MT_190812_EDIs.zip`
- 122 physical MT station markers
- 244 EDI variants retained in marker properties
- CRS transform: EPSG:26912 to GeoSee scene-local meters
- classification: measured

### Phase 3 MT Resistivity Model

```text
projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/
```

Current outputs:

```text
model_stats.json
model_provenance.json
resistivity_point_preview.json
full_density/manifest.json
full_density/stats.json
full_density/provenance.json
full_density/tiles/*.positions.bin
full_density/tiles/*.scalars.bin
slices/manifest.json
slices/legend.json
slices/resistivity_slices_mesh_preview.json
slices/resistivity_slices.provenance.json
```

Current facts:

- source model rows: 1,094,940
- positive resistivity rows: 1,094,624
- masked zero/non-positive rows: 316
- point preview emitted points: 90,000
- full-density emitted points: 1,094,624
- full-density format: tiled Float32 XYZ plus Float32 scalar buffers
- preview ground cap: 1,135 vertices and 1,844 retained adjacent-grid triangles
- preview ground cap minimum scene elevation: 816.49 m
- display value: `log10(resistivity_ohm_m)`
- horizontal scale: 1.0
- vertical exaggeration: 1.0
- crop applied: false
- classification: source-derived inversion model
- point preview role: QA/validation
- slice role: default presentation preview

Current slice set:

- 6 horizontal elevation slices
- 2 vertical station-centroid sections

## Intake Checklist For Any New Data

Before processing:

- [ ] Original files are under `client_preprocessed/`.
- [ ] Original filenames and folder structure are preserved where practical.
- [ ] Source delivery route is recorded.
- [ ] Citation and permission/licensing terms are recorded.
- [ ] README / metadata / CRS notes are kept beside the source.
- [ ] File sizes and counts are recorded.
- [ ] Archive contents are listed.
- [ ] The dataset family is identified: electrical resistivity, seismic analysis, terrain, wells, faults, infrastructure, or other.
- [ ] The site area is identified: Phase 3, Southwestern/regional, or other.
- [ ] The data is not wired into the app yet.

## CRS And Origin Checklist

Before generating GeoSee-ready outputs:

- [ ] CRS name is known.
- [ ] EPSG code is known or explicitly unresolved.
- [ ] Datum is known.
- [ ] Horizontal units are known.
- [ ] Vertical units are known.
- [ ] Axis order is known.
- [ ] Source bounds are known.
- [ ] Scene origin is chosen.
- [ ] Coordinate transform is documented.
- [ ] Original source coordinates are preserved in provenance.
- [ ] Any guessed/inferred CRS choice is clearly marked as guessed.

Current Phase 3 MT baseline:

- [x] EPSG:26912 / NAD83 UTM Zone 12N
- [x] meters
- [x] local X east, Y north, Z up
- [x] scene origin documented
- [x] no crop
- [x] vertical exaggeration 1.0

## Resistivity Checklist

Before viewer wiring:

- [x] model header has been read
- [x] columns are confirmed
- [x] `x`, `y`, `z`, and resistivity fields are confirmed
- [x] resistivity unit is documented as Ohm-m from source header
- [x] `log10(rho)` is computed and documented
- [x] display range is chosen and documented
- [x] outlier/masked row handling is documented
- [x] row count is recorded
- [x] source bounds and scene bounds are recorded
- [x] vertical meaning of `z` is documented from the source header as elevation in meters
- [x] point preview is generated
- [x] authored slice preview is generated
- [x] provenance is written
- [x] app layer is wired
- [x] editor controls are exposed

## MT Station Checklist

Before viewer wiring:

- [x] EDI variants are identified
- [x] one marker is emitted per physical station
- [x] local/remote-reference variants are stored in properties
- [x] station count is recorded
- [x] stations fall inside model horizontal bounds
- [x] elevation is used from source where present
- [x] marker provenance says measured
- [x] app layer is wired
- [x] editor controls are exposed

## Provenance Checklist

Every GeoSee-ready output should include or point to:

- [ ] source dataset name
- [ ] source file path
- [ ] source URL, GDR submission, or client delivery reference
- [ ] source author / institution / client
- [ ] license or usage permission
- [ ] source CRS
- [ ] scene transform
- [ ] processing date
- [ ] processing script name
- [ ] measured/source-derived/preview/placeholder/future classification
- [ ] notes on downsampling, masking, interpolation, binning, clipping, or visual-only simplification

## Do Not Enable A New Layer Until

- [ ] source files are inventoried
- [ ] CRS and units are reviewed
- [ ] scene transform is documented
- [ ] output file parses cleanly
- [ ] provenance exists
- [ ] missing/future outputs are separated from active preview files
- [ ] layer loads locally without missing-file errors
- [ ] layer toggles in the editor
- [ ] visual scale is correct from data, not guessed
- [ ] placeholder/future/synthetic content is labeled accurately
- [ ] the layer has a clear owner/status in docs

## Current User-Side Review Targets

For the current Phase 3 MT state, the user should review:

- whether the authored slices are visually persuasive enough for a demo
- which slices should be visible by default on each page
- whether the scalar color ramp communicates geothermal/geophysical contrast well
- whether the legend position and range are readable
- whether the story should emphasize station footprint, deep resistivity structure, or integration with later seismic

The agent/dev remains responsible for coordinate correctness, source counts, CRS handling, and provenance. Do not ask the user to validate technical placement by eye when the data can be verified from source files.
