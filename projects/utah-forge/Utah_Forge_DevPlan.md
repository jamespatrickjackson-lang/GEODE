# Utah FORGE Dev Plan

Updated: 2026-05-12

This is the implementation roadmap for the Utah FORGE project. The short source of truth for locked choices is `Utah_Forge_Decisions.md`. The practical file-placement checklist is `Utah_Forge_Data_Intake_Checklist.md`.

## Purpose

Utah FORGE is the geothermal/geophysics case study for GeoSee. It should demonstrate how client-delivered geophysical outputs can become a polished, navigable 3D communication environment rather than a pile of technical files.

The first active target is Utah FORGE Phase 3 MT resistivity.

The desired end state is:

- visually strong 3D rendering
- editor-tunable geophysical styling
- clear data provenance
- authored pages that explain the project without needing the editor open
- honest labeling of measured, source-derived, preview, placeholder, and future content

## Current Repo State

Utah FORGE currently has:

- landing-page project entry
- project folder under `projects/utah-forge/`
- overview page and overlay text
- project and environment manifests
- procedural reference-stage scaffold
- Phase 3 MT source packages staged under `client_preprocessed/`
- Phase 3 MT GeoSee-ready outputs under `geosee_processed/`
- Phase 3 MT measured station markers wired into the viewer
- Phase 3 MT full-density source-derived resistivity renderer wired as the Stage 2 target
- Phase 3 MT preview-derived ground cap wired as a Stage 2 visual ground-layer aid
- Phase 3 MT source-derived resistivity point preview wired as QA/validation
- Phase 3 MT source-derived authored resistivity slices wired as an optional presentation layer
- editor controls for station markers, scalar ramp, display range, slice visibility, and value legend visibility
- a page-aware resistivity legend in the viewer/editor shell

Current local test target:

```text
http://127.0.0.1:5173/?project=utah-forge
```

## Current Data Truth

Source/client files live under:

```text
projects/utah-forge/data/client_preprocessed/
```

App-ready outputs live under:

```text
projects/utah-forge/data/geosee_processed/
```

Current Phase 3 MT source package:

```text
client_preprocessed/utah_forge_phase_3/electrical_resistivity/
  mt_edis/FORGE_MT_190812_EDIs.zip
  mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip
  references/FORGE_MT_12_12_2021.prj
```

Current active output package:

```text
geosee_processed/utah_forge_phase_3/electrical_resistivity/
  intake/
  stations/
  resistivity_model/
```

Current CRS and transform:

```text
EPSG:26912 / NAD83 UTM Zone 12N
units: meters
local X: east
local Y: north
local Z: up
origin easting: 341467.35
origin northing: 4273374.5
origin elevation: 0
crop: none
vertical exaggeration: 1.0
```

Current measured station output:

```text
stations/mt_stations.geojson
stations/mt_stations.provenance.json
```

Current resistivity output:

```text
resistivity_model/model_stats.json
resistivity_model/model_provenance.json
resistivity_model/resistivity_point_preview.json
resistivity_model/full_density/manifest.json
resistivity_model/full_density/stats.json
resistivity_model/full_density/provenance.json
resistivity_model/slices/manifest.json
resistivity_model/slices/legend.json
resistivity_model/slices/resistivity_slices_mesh_preview.json
resistivity_model/slices/resistivity_slices.provenance.json
```

## Current Layer Records

Layer ids in `projects/utah-forge/project.json`:

```text
utah-forge-reference-stage
utah-forge-mt-stations
utah-forge-mt-resistivity-full-density
utah-forge-mt-resistivity-preview
utah-forge-mt-resistivity-slices
```

Default visible layers in `projects/utah-forge/environment.json`:

```text
utah-forge-mt-stations
utah-forge-mt-resistivity-full-density
```

The low-resolution point preview and authored slices are available, but they are not the default visible Stage 2 density layer.

## Target Viewer Outcomes

### Baseline Already Achieved

The baseline endpoint now proves:

- Utah FORGE opens from the landing page
- Phase 3 MT stations render in the same scene as the model
- resistivity model values parse and render
- source-derived slices render without requiring the full point cloud
- key editor variables are exposed
- the legend can be toggled and follows active scalar styling

### Stage 2 Renderer Endpoint

The current endpoint should be a renderer-complete Phase 3 MT view:

- measured MT stations visible
- full-density source-derived MT model visible
- scalar colors, opacity, point size, and legend tunable in the editor
- QA point preview and authored slices still available but not default visible
- no unlabeled placeholders
- no seismic, Southwestern/regional MT, wells, faults, terrain, or infrastructure active
- no vertical exaggeration unless explicitly added as a separate labeled option

### Later Endpoint

Later endpoints can add:

- authored Phase 3 MT story pages
- Southwestern/regional MT context
- seismic reflection
- wells
- faults
- infrastructure
- microseismic events
- higher-fidelity runtime volume/slice controls

Do not jump to those until the Stage 2 full-density MT renderer is stable unless a later brief changes priorities. The user has explicitly blocked seismic until they say to start.

## Stage 1 - Source Intake

Status: complete for Phase 3 MT baseline.

Actions completed:

- preserved delivered files under `client_preprocessed/`
- created Utah FORGE intake/output folder structure
- identified the Phase 3 MT EDI archive
- identified the updated model cell-center archive
- retained source projection reference material

Acceptance criteria:

- source files are present in the locked source folder
- source package identity is recorded
- no source file is silently renamed or rewritten
- nothing app-ready is stored in the source folder

Current delivered source location:

```text
projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity/
```

## Stage 2 - Inventory, CRS, And Scene Origin

Status: complete for Phase 3 MT baseline.

Actions completed:

- inspected archive entries
- recorded source inventory
- read CRS evidence from `.prj`, EDI headers, and model header
- locked EPSG:26912 / NAD83 UTM Zone 12N for Phase 3 MT
- documented model source bounds
- documented station source bounds
- chose scene origin
- documented source-to-scene transform
- preserved true scale and no-crop baseline

Key outputs:

```text
geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/source_inventory.json
geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/archive_entries.json
geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/crs_transform.json
geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/crs_origin_note.md
```

Acceptance criteria:

- CRS is documented from source evidence
- units are documented
- model and station bounds are documented
- transform is explicit
- unresolved vertical interpretation risk is called out honestly

## Stage 3 - MT Station Markers

Status: complete and wired.

Actions completed:

- parsed EDI station files
- converted geographic coordinates to EPSG:26912 using the documented CRS
- deduped local/remote-reference variants into one physical station marker
- retained EDI variants in marker properties
- emitted GeoJSON
- wrote provenance
- wired project/environment layer records
- exposed marker controls in the editor

Current facts:

```text
physical stations: 122
EDI variants retained: 244
classification: measured
```

Key outputs:

```text
stations/mt_stations.geojson
stations/mt_stations.provenance.json
```

Active layer:

```text
utah-forge-mt-stations
```

Acceptance criteria:

- one marker per physical station
- marker properties preserve variant details
- station markers sit inside the documented model horizontal bounds
- layer toggles in the editor
- provenance says measured

## Stage 4 - Resistivity Point Preview

Status: complete and wired as QA/validation.

Actions completed:

- parsed the updated MT cell-center model
- read northing, easting, elevation, and resistivity values
- filtered non-positive resistivity rows from log display
- computed `log10(resistivity_ohm_m)`
- wrote model stats/provenance
- generated a deterministic 90,000 point preview
- wired the preview as a source-derived inversion model layer
- exposed point size and scalar ramp controls in the editor

Current facts:

```text
source rows: 1,094,940
positive resistivity rows: 1,094,624
masked zero/non-positive rows: 316
emitted preview points: 90,000
display value: log10(resistivity_ohm_m)
crop: none
vertical exaggeration: 1.0
```

Key outputs:

```text
resistivity_model/model_stats.json
resistivity_model/model_provenance.json
resistivity_model/resistivity_point_preview.json
```

Active layer:

```text
utah-forge-mt-resistivity-preview
```

Acceptance criteria:

- layer loads without browser pain
- value range is documented
- provenance says source-derived inversion model
- values render in the same coordinate frame as stations
- preview is treated as QA, not final volume rendering

## Stage 5 - Authored Resistivity Slices

Status: complete for first presentation preview.

Actions completed:

- generated horizontal elevation slices
- generated vertical station-centroid sections
- used source cell-center bin averaging
- added limited neighbor fill for small display voids
- wrote slice manifest, legend, mesh preview, and provenance
- wired the layer into `project.json`
- made it default visible in `environment.json`
- exposed horizontal/vertical slice toggles
- exposed per-slice visibility controls
- added viewer legend support

Current slice set:

```text
Horizontal +1500 m elevation
Horizontal 0 m elevation
Horizontal -2500 m elevation
Horizontal -5000 m elevation
Horizontal -10000 m elevation
Horizontal -25000 m elevation
East-west section through station centroid
North-south section through station centroid
```

Key outputs:

```text
resistivity_model/slices/manifest.json
resistivity_model/slices/legend.json
resistivity_model/slices/resistivity_slices_mesh_preview.json
resistivity_model/slices/resistivity_slices.provenance.json
```

Active layer:

```text
utah-forge-mt-resistivity-slices
```

Acceptance criteria:

- layer loads as a mesh preview
- sections and slices can be toggled from the editor
- scalar legend matches the visible layer style
- values use log Ohm-m
- no crop or vertical exaggeration is applied
- provenance documents bin averaging and neighbor fill

## Stage 6 - Editor And Viewer Controls

Status: first pass complete.

Current editor controls:

- MT station marker radius
- MT station marker lift
- MT station label lift
- scalar color ramp low/high
- scalar display min/max
- scalar midpoint
- scalar contrast/nuance
- point preview point size
- horizontal slice group visibility
- vertical section group visibility
- individual slice visibility
- value legend visibility

Current code surfaces:

```text
src/pages/types.ts
src/editor/LayerPanel.tsx
src/scene/SceneManager.ts
src/loaders/loadPointMarkers.ts
src/loaders/loadPointCloudPreview.ts
src/loaders/loadMeshPreview.ts
src/ui/ResistivityLegend.tsx
src/editor/EditorChrome.tsx
```

Acceptance criteria:

- changes made in the editor affect visible scene objects
- page changes do not wipe the active scalar styling
- legend follows active effective style
- controls do not imply measurement precision beyond the source-derived preview

## Stage 7 - Stage 2 Full-Density Renderer Pass

Status: in progress.

This is the current Stage 2 build step. It upgrades Phase 3 MT resistivity from a low-resolution point preview to a full-density scalar-aware tiled renderer.

Actions:

1. Generate full-density tiled binary outputs from every positive-resistivity model row.
2. Add scalar-aware tiled point-cloud loading.
3. Add the full-density layer to `project.json`.
4. Make stations and full-density MT default visible in `environment.json`.
5. Keep the low-resolution point preview and authored slices available but not default visible.
6. Tune scalar colors, opacity, point size, display range, and legend visibility.

Acceptance criteria:

- full-density emitted point count is 1,094,624
- masked zero/non-positive row count is 316
- scene bounds match the existing Phase 3 MT model bounds
- station and full-density MT layers are visually legible
- scalar editor controls affect the full-density layer
- no placeholder/future layer is mistaken for real data
- no seismic layer is processed or wired until the user explicitly says to start
- build passes

## Stage 8 - Later Data Families

Status: deferred.

Future data families:

```text
forge_southwestern/electrical_resistivity
forge_southwestern/seismic_analysis
utah_forge_phase_3/seismic_analysis
```

Each future data family must follow the same gate:

1. preserve source files
2. inventory
3. CRS/units/origin
4. first proof output
5. provenance
6. project layer record
7. editor controls
8. viewer acceptance

Do not treat the old unsorted seismic submissions as resistivity. They must be re-reviewed if they become active.

## Processing Scripts

Current scripts:

```text
prep/utah_forge_config.mjs
prep/build_utah_forge_mt_station_markers.mjs
prep/build_utah_forge_mt_resistivity_preview.mjs
prep/build_utah_forge_mt_resistivity_full_density.mjs
prep/build_utah_forge_mt_resistivity_slices.mjs
```

Script expectations:

- read from `client_preprocessed/`
- write to `geosee_processed/`
- write provenance beside outputs
- record row counts, bounds, ranges, and processing choices
- avoid modifying `project.json` automatically
- keep processing assumptions visible in output metadata

## QA And Acceptance Before Handoff

Before handing Utah FORGE to another person or agent:

- `project.json` parses
- `environment.json` parses
- all active `previewFiles` exist
- source files remain in `client_preprocessed/`
- app-ready files remain in `geosee_processed/`
- layer classifications are accurate
- Utah FORGE opens from the landing page
- stations, full-density MT, and legend are visible
- editor toggles work
- `npm run build` passes after code changes

## Current Known Limitations

- The current full-density layer is a tiled scalar point-cloud renderer, not a voxel/volume renderer.
- The current slice layer is an authored mesh preview, not a live full-volume renderer.
- The point preview is downsampled for performance and QA.
- The model has very deep negative elevation values; present this carefully until the vertical convention is fully narrated.
- Southwestern/regional MT is not active.
- Seismic is not active.
- Wells, faults, terrain, microseismic events, infrastructure, and final client branding are not yet integrated.
- Default pages are not yet a polished Utah FORGE story.

## Next Recommended Work

Recommended next practical step:

```text
Verify and tune the Stage 2 full-density Phase 3 MT renderer.
```

Deliverables:

- full-density tiled outputs
- full-density project layer
- scalar-aware tiled loader
- tuned scalar style defaults
- user-readable legend defaults
- updated Stage 2 documentation

Hold story pages, seismic, regional MT, and other future data families until this works cleanly. Seismic remains blocked until the user explicitly says to start.
