# AI Future Data Input Playbook

Updated: 2026-05-12

This guide tells future AI agents and developers how to bring a new Utah FORGE dataset into GeoSee without losing provenance, breaking the folder contract, or pretending a preview is a final product.

Use this for any future Utah FORGE input, including Southwestern/regional MT, seismic analysis, wells, faults, terrain, infrastructure, microseismic events, or revised Phase 3 products.

## Non-Negotiable Folder Contract

Delivered source/client files go under:

```text
projects/utah-forge/data/client_preprocessed/
```

GeoSee-ready outputs go under:

```text
projects/utah-forge/data/geosee_processed/
```

Do not put source/client files in `geosee_processed/`. Do not point active app layers directly at random unsorted source files.

## Current Area/Dataset Pattern

Use this project-area layout unless a later decision changes it:

```text
client_preprocessed/
  utah_forge_phase_3/
    electrical_resistivity/
    seismic_analysis/
  forge_southwestern/
    electrical_resistivity/
    seismic_analysis/

geosee_processed/
  utah_forge_phase_3/
    electrical_resistivity/
    seismic_analysis/
  forge_southwestern/
    electrical_resistivity/
    seismic_analysis/
```

If a new source family does not fit these buckets, add a new clearly named dataset folder and document the decision in `Utah_Forge_Decisions.md`.

## Stage 0 - Do Not Wire First

Never start by adding a `project.json` layer.

Start by answering:

- What files exist?
- Where did they come from?
- What CRS/coordinate frame do they use?
- What units do they use?
- What values do they contain?
- What is measured vs modeled vs interpreted?
- What is the smallest credible browser-ready preview?

If any answer is guessed, write that it is guessed.

## Stage 1 - Preserve Source Files

Place the delivered files exactly as received under the correct `client_preprocessed/` folder.

Rules:

- keep original filenames where practical
- keep archives intact
- keep README files, metadata, projection files, and reports beside the source data
- do not delete duplicates until they are understood
- do not convert in place
- do not use source folders as temporary output folders

Example:

```text
client_preprocessed/utah_forge_phase_3/electrical_resistivity/
  mt_edis/
  mt_model_cell_center_updated/
  references/
```

## Stage 2 - Inventory

Create or update an inventory under the matching `geosee_processed/.../intake/` folder.

Recommended outputs:

```text
source_inventory.json
archive_entries.json
unresolved_items.json
```

Inventory should record:

- file path
- file size
- extension/format
- archive contents
- row counts where cheap to compute
- detected headers
- CRS/projection files
- likely role of each file
- suspicious or mismatched files

Do not enable layers at this stage.

## Stage 3 - CRS, Units, Bounds, Origin

Create a transform note before generating viewer geometry.

Recommended outputs:

```text
crs_transform.json
crs_origin_note.md
```

Record:

- source CRS label
- EPSG code if known
- datum
- horizontal units
- vertical units
- axis order
- source bounds
- chosen GeoSee origin
- local coordinate formula
- vertical scale
- crop setting
- any unresolved assumptions

Current Phase 3 MT example:

```text
source CRS: EPSG:26912 / NAD83 UTM Zone 12N
local axes: X east, Y north, Z up
origin easting: 341467.35
origin northing: 4273374.5
origin elevation: 0
crop: false
vertical exaggeration: 1.0
```

## Stage 4 - Choose The First Proof Layer

Pick the smallest useful first viewer output.

Examples:

MT station files:

```text
GeoJSON point markers
```

MT cell-center model:

```text
downsampled point preview
authored slices
```

Seismic reflection:

```text
navigation line preview first
then one textured/colored section plane
```

Wells:

```text
well collar points first
then well path polylines
```

Faults:

```text
polyline/surface preview with provenance
```

Do not jump straight to a heavy final renderer before a coordinate proof exists.

## Stage 5 - Generate GeoSee-Ready Output

Write processing scripts under:

```text
prep/
```

Script expectations:

- read source from `client_preprocessed/`
- write outputs to `geosee_processed/`
- write provenance beside outputs
- record row counts, bounds, and value ranges
- record processing decisions
- avoid hardcoded dates where possible
- avoid editing `project.json` automatically
- preserve original source coordinates in provenance where useful
- use scene-local coordinates for runtime performance

Naming pattern:

```text
prep/build_utah_forge_<dataset>_<artifact>.mjs
```

Current examples:

```text
prep/build_utah_forge_mt_station_markers.mjs
prep/build_utah_forge_mt_resistivity_preview.mjs
prep/build_utah_forge_mt_resistivity_slices.mjs
```

## Stage 6 - Write Provenance

Every app-ready output needs provenance.

Minimum provenance fields:

- project
- area
- dataset
- artifact name
- generated date
- processing script
- source file path
- source file role
- source CRS
- scene transform
- classification
- row/feature count
- bounds
- value range
- downsampling/masking/interpolation/binning rules
- known caveats

Use these classifications:

```text
measured
source-derived
source-derived inversion model
preview
presentation preview
placeholder
future target
synthetic / illustrative
```

Be conservative. If it is a visualization derived from an inversion model, say so.

## Stage 7 - Add Project Layer Records

Only after a GeoSee-ready output exists:

1. Add a layer record to `projects/utah-forge/project.json`.
2. Put active browser-ready files under `previewFiles`.
3. Put missing/planned outputs under `futureTargets`.
4. Add provenance fields.
5. Add a matching default style in `environment.json`.
6. Add default visibility only after the layer has been visually checked.

Layer record should clearly state:

- id
- label
- category
- type
- source/provenance
- active preview files
- status/classification
- what the layer is not

Do not put missing files in `previewFiles`.

## Stage 8 - Loader And Editor Wiring

Use existing loaders when possible:

```text
src/scene/layerLoaders.ts
src/loaders/loadPointMarkers.ts
src/loaders/loadPointCloudPreview.ts
src/loaders/loadMeshPreview.ts
```

If a new data shape is needed:

- prefer adding a reusable loader path
- keep project-specific branches contained in `layerLoaders.ts`
- add typed style fields in `src/pages/types.ts`
- apply runtime styling in `src/scene/SceneManager.ts`
- expose editor controls in `src/editor/LayerPanel.tsx`

Controls should be useful and honest. Good controls include:

- visibility
- opacity
- point size
- marker radius
- marker lift
- label lift
- scalar min/max
- scalar midpoint
- color ramp
- slice visibility
- section visibility
- legend visibility

Do not expose controls that imply unsupported analysis precision.

## Stage 9 - Viewer Acceptance

Before calling a layer ready:

- source inventory exists
- CRS transform exists
- output parses
- provenance exists
- active file paths resolve
- layer loads without black screen
- layer toggles in editor
- scale follows source units
- measured/source-derived status is clear
- build passes after code changes

For scalar geophysical layers:

- display units are visible
- color range is documented
- log/linear transform is explicit
- masked/null values are documented

## Stage 10 - Presentation Pass

Only after data is technically stable:

- author pages
- tune camera paths
- write overlay text
- set page-level layer visibility
- set page-level slice presets
- tune legend defaults
- test the viewer without using the editor

The viewer should explain what the data means, not just prove that it loaded.

## Common Failure Modes

Avoid these:

- wiring layers before processed outputs exist
- mixing source files with GeoSee outputs
- calling model output measured data
- treating a point preview as the final product
- forgetting CRS/units/provenance
- adding magic coordinate offsets without writing them down
- asking the user to judge technical placement by eye when source coordinates can be verified
- enabling a future/placeholder layer without a visible label
- adding one-off loader hacks that should live in a reusable loader
- changing scale or vertical exaggeration without labeling it

## Future Dataset Defaults

### Phase 3 Seismic

First proof:

```text
navigation lines or shot/receiver geometry
```

Second proof:

```text
one section plane or interpreted horizon preview
```

Do not start with a full seismic volume unless delivered files already support it.

### Southwestern / Regional MT

First proof:

```text
station footprint and model bounds
```

Second proof:

```text
low-resolution regional context slices
```

Keep it visually distinct from Phase 3 MT and clearly label it as regional/context.

### Wells / Faults / Infrastructure

First proof:

```text
collars, paths, or polylines in the same CRS
```

Second proof:

```text
styled, editor-tunable interpretation layers
```

## Current Gold Standard In This Project

Use the current Phase 3 MT path as the reference pattern:

```text
source files -> inventory -> CRS transform -> markers/preview/slices -> provenance -> project layer -> editor controls -> legend -> docs
```

That is the repeatable GeoSee data-pipe shape.
