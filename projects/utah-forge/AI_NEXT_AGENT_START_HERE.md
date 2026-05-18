# AI Next Agent Start Here - Utah FORGE

Updated: 2026-05-12

This is the handoff file for the next AI agent or developer. Read this before changing code or data.

## First Instruction

Do not start by guessing.

Read the current docs and inspect the files. When data placement, CRS, units, or provenance are unknown, say they are unknown. The user expects technical placement and data claims to be verified from files, not judged by eye.

## Current Working Goal

Utah FORGE is the geothermal/geophysics case study in GeoSee.

The current active build is:

```text
Utah FORGE Phase 3 MT resistivity
```

The current Stage 2 task is:

```text
finish the full-density scalar-aware Phase 3 MT resistivity renderer
```

Do not start with seismic or Southwestern/regional MT unless the user explicitly redirects. The user has explicitly said not to load seismic until they say to start.

## Current Local Viewer

If the Vite server is running, open:

```text
http://127.0.0.1:5173/?project=utah-forge
```

If needed:

```text
npm run dev -- --host 127.0.0.1
```

Build check after code changes:

```text
npm run build
```

## Docs To Read First

Read in this order:

```text
projects/utah-forge/Utah_Forge_Decisions.md
projects/utah-forge/Utah_Forge_DevPlan.md
projects/utah-forge/Utah_Forge_Data_Intake_Checklist.md
projects/utah-forge/AI_FUTURE_DATA_INPUT_PLAYBOOK.md
projects/utah-forge/Utah_Forge_Next_Stage_Gates.md
projects/utah-forge/data/README.md
CHANGELOG.md
docs/START-HERE.md
```

## Hard Boundaries

Keep these rules:

- source/client files stay in `client_preprocessed/`
- GeoSee-ready outputs stay in `geosee_processed/`
- no crop for the current Phase 3 MT baseline
- vertical exaggeration stays 1.0 unless the user explicitly asks for a separate labeled presentation variant
- station markers are measured
- resistivity model layers are source-derived inversion model previews
- point preview is QA/validation
- authored slices are the current presentation layer
- full-density tiled MT is the current Stage 2 renderer/data-density layer
- preview-derived MT ground cap is a separate Stage 2 visual ground-layer aid, not terrain or geology
- do not label future/seismic/Southwestern data as active
- do not process or wire seismic until the user explicitly says to start
- do not ask the user to validate technical placement by eye when source files can be checked

## Current Source Files

Current Phase 3 MT source files:

```text
projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity/
  mt_edis/FORGE_MT_190812_EDIs.zip
  mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip
  references/FORGE_MT_12_12_2021.prj
```

Do not rename or rewrite these.

## Current Processed Outputs

Current app-ready outputs:

```text
projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/intake/
projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/stations/
projects/utah-forge/data/geosee_processed/utah_forge_phase_3/electrical_resistivity/resistivity_model/
```

Important files:

```text
intake/source_inventory.json
intake/archive_entries.json
intake/crs_transform.json
intake/crs_origin_note.md
stations/mt_stations.geojson
stations/mt_stations.provenance.json
resistivity_model/model_stats.json
resistivity_model/model_provenance.json
resistivity_model/resistivity_point_preview.json
resistivity_model/full_density/manifest.json
resistivity_model/full_density/stats.json
resistivity_model/full_density/provenance.json
resistivity_model/full_density/tiles/*.positions.bin
resistivity_model/full_density/tiles/*.scalars.bin
resistivity_model/slices/manifest.json
resistivity_model/slices/legend.json
resistivity_model/slices/resistivity_slices_mesh_preview.json
resistivity_model/slices/resistivity_slices.provenance.json
```

## Current Technical Facts

Coordinate frame:

```text
EPSG:26912 / NAD83 UTM Zone 12N
meters
local X east
local Y north
local Z up
```

Scene origin:

```text
easting_m: 341467.35
northing_m: 4273374.5
elevation_m: 0
```

Scale:

```text
horizontal: 1.0
vertical: 1.0
vertical exaggeration: 1.0
crop: none
```

Station output:

```text
physical station markers: 122
EDI variants retained: 244
classification: measured
```

Resistivity output:

```text
source rows: 1,094,940
positive resistivity rows: 1,094,624
masked zero/non-positive rows: 316
point preview emitted points: 90,000
full-density emitted points: 1,094,624
full-density masked zero/non-positive rows: 316
ground-cap source preview points: 90,000
ground-cap grid size: 2,500 m
ground-cap vertices: 1,135
ground-cap retained triangles: 1,844
ground-cap minimum scene elevation: 816.49 m
display value: log10(resistivity_ohm_m)
classification: source-derived inversion model
```

Slice output:

```text
horizontal slices: 6
vertical sections: 2
mesh vertices: 20,930
mesh triangles: 25,894
```

## Current Active Layers

Layer records are in:

```text
projects/utah-forge/project.json
```

Default visibility and styles are in:

```text
projects/utah-forge/environment.json
```

Layer ids:

```text
utah-forge-reference-stage
utah-forge-mt-stations
utah-forge-mt-resistivity-full-density
utah-forge-mt-top-surface
utah-forge-mt-resistivity-preview
utah-forge-mt-resistivity-slices
```

Default visible:

```text
utah-forge-mt-stations
utah-forge-mt-resistivity-full-density
utah-forge-mt-top-surface
```

## Code Entry Points

Project selection:

```text
src/projects/projectCatalogRuntime.ts
src/App.tsx
```

Layer loading:

```text
src/scene/layerLoaders.ts
src/scene.ts
```

Runtime scene style/control:

```text
src/scene/SceneManager.ts
```

Loaders used by Utah FORGE:

```text
src/loaders/loadPointMarkers.ts
src/loaders/loadPointCloudPreview.ts
src/loaders/loadTiledPointCloudPreview.ts
src/loaders/loadMeshPreview.ts
```

Editor controls:

```text
src/editor/LayerPanel.tsx
src/pages/types.ts
```

Legend:

```text
src/ui/ResistivityLegend.tsx
src/editor/EditorChrome.tsx
```

Processing:

```text
prep/utah_forge_config.mjs
prep/build_utah_forge_mt_station_markers.mjs
prep/build_utah_forge_mt_resistivity_preview.mjs
prep/build_utah_forge_mt_resistivity_full_density.mjs
prep/build_utah_forge_mt_resistivity_slices.mjs
```

## What Has Been Done

Completed:

- Utah FORGE project scaffold
- landing page entry
- Phase 3 MT source placement
- Phase 3 MT inventory
- CRS/origin lock
- measured station marker generation
- source-derived resistivity point preview
- source-derived full-density tiled resistivity renderer
- authored resistivity slice preview
- project/environment layer wiring
- editor scalar controls
- editor station controls
- per-slice visibility controls
- value legend
- docs split into decisions, plan, checklist, playbook, and handoff

## What Is Not Done

Not done:

- polished Utah FORGE presentation pages
- final camera choreography
- final overlay story copy
- final scalar design choices
- seismic integration
- Southwestern/regional MT integration
- wells/faults/infrastructure/terrain layers
- runtime full-volume clipping/slicing renderer
- final client publish/export package

## Recommended Next Step

Verify and tune the Stage 2 full-density Phase 3 MT renderer.

Suggested chunk:

1. Open Utah FORGE in the viewer.
2. Confirm the station, full-density, and preview-derived ground-cap layers render.
3. Confirm the QA point preview and authored slices remain available but are not default visible.
4. Tune point size, opacity, scalar range, midpoint, contrast, and legend visibility.
5. Confirm the browser remains usable with the full-density layer visible.
6. Run `npm run build`.

Success criteria:

- the full positive-resistivity MT model is represented in the browser-ready artifact
- a technical reviewer can trace the data status
- no future layer is presented as active data
- the scene still opens from landing
- editor controls still work

## Presentation Page Suggestions

Use these as starting points, not mandatory labels:

```text
01. FORGE Arrival
02. MT Station Network
03. Resistivity Model Frame
04. Horizontal Slice View
05. Vertical Section View
06. Next Data Integration
```

Good overlay language:

- "Measured MT station locations"
- "Source-derived MT inversion model"
- "Log10 resistivity in Ohm-m"
- "True 1:1 meter scale; no vertical exaggeration"
- "Preview rendering generated for GeoSee presentation"

Avoid:

- "measured resistivity volume"
- "final engineering model"
- "seismic interpretation" before seismic is active
- "regional context" before Southwestern/regional MT is active

## Known Risks

Risk: model depth/elevation interpretation.

The model header says elevation in meters, but the model extends to very large negative values. Treat that as source vertical coordinate until presentation copy is reviewed. Do not reinterpret it casually.

Risk: overloading the browser.

The Stage 2 full-density layer uses tiled binary point buffers, not one huge JSON payload. If browser performance becomes poor, tune tile size, point size, opacity, and default visibility before adding more rendering complexity.

Risk: conflating dataset families.

Unsorted submission 1015/1141 material appears seismic, not resistivity. Keep seismic work separate.

Risk: stale docs after edits.

If code/project/data wiring changes, update this handoff and `CHANGELOG.md`.

## Verification Commands

JSON sanity:

```text
node -e "for (const f of ['projects/utah-forge/project.json','projects/utah-forge/environment.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('ok')"
```

Build:

```text
npm run build
```

Search for stale claims in prose docs:

```text
rg "stale Phase 3 MT planning claim|real Utah FORGE data is not present|briefing still pending" projects/utah-forge docs CHANGELOG.md
```

## Final Handoff Sentence

Utah FORGE is no longer just a foundation project: Phase 3 MT station markers, authored slices, and the Stage 2 full-density scalar-aware MT renderer are live or in progress; seismic remains blocked until the user explicitly says to start.
