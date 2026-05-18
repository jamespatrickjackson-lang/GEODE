# Utah FORGE Decisions Log

Updated: 2026-05-12

This is the short source of truth for Utah FORGE. If another note conflicts with this file, use this file first, then update the stale note.

## Locked Folder Contract

Delivered source/client files stay under:

```text
projects/utah-forge/data/client_preprocessed/
```

App-ready GeoSee outputs stay under:

```text
projects/utah-forge/data/geosee_processed/
```

Do not use `data/raw/` or `data/processed/` for Utah FORGE unless the project folder contract is intentionally changed later.

## Current Build Target

The first implementation target is:

```text
Utah FORGE Phase 3 MT resistivity
```

This target comes before Southwestern/regional MT and before full seismic integration.

Current first-pass MT work is no longer only planned. Phase 3 MT station markers, a low-resolution resistivity point preview, a Stage 2 full-density tiled resistivity renderer, a preview-derived MT ground cap, and authored resistivity slices are generated or wired into the Utah FORGE project.

## Current Active Viewer State

Active Utah FORGE data layers:

```text
utah-forge-mt-stations
utah-forge-mt-resistivity-full-density
utah-forge-mt-top-surface
```

Available but not default-presented layers:

```text
utah-forge-mt-resistivity-preview
utah-forge-mt-resistivity-slices
```

Placeholder scaffold layer:

```text
utah-forge-reference-stage
```

The station layer is measured station-location data. The resistivity preview, full-density renderer, and slices are source-derived inversion model visualizations.

## Provenance Classification

Use these classifications:

```text
MT station locations: measured
MT resistivity point preview: source-derived inversion model preview
MT resistivity full-density tiled renderer: source-derived inversion model full-density visualization
MT preview-derived ground cap: source-derived inversion model visual ground-layer aid
MT resistivity slices: source-derived inversion model presentation preview
Utah FORGE reference stage: placeholder / procedural scaffold
Future seismic: not active until separately inventoried and processed
Future Southwestern/regional MT: not active until separately inventoried and processed
```

Do not describe the resistivity model as a direct field measurement. It is an inversion/model product derived from MT data.

The MT ground cap is a standalone visual ground-layer aid generated only from the existing 90,000-point MT resistivity model preview. It uses regular XY bins and adjacent-cell triangulation rather than raw sparse-column top points. It is not part of scalar trim/feather legend editing and should not be described as resistivity subset decomposition.

## Source And Processing Facts

Current Phase 3 MT source files are staged under:

```text
projects/utah-forge/data/client_preprocessed/utah_forge_phase_3/electrical_resistivity/
```

Current source packages:

```text
mt_edis/FORGE_MT_190812_EDIs.zip
mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip
references/FORGE_MT_12_12_2021.prj
```

Current confirmed coordinate frame:

```text
EPSG:26912
NAD83 / UTM Zone 12N
meters
GeoSee local X east, Y north, Z up
```

Current scene origin:

```text
easting_m: 341467.35
northing_m: 4273374.5
elevation_m: 0
```

Current transform rule:

```text
x = source_easting_m - 341467.35
y = source_northing_m - 4273374.5
z = source_elevation_m
```

Current scale rule:

```text
cropApplied: false
horizontalScale: 1.0
verticalScale: 1.0
verticalExaggeration: 1.0
```

Do not crop the model frame or exaggerate vertical depth for the Phase 3 MT baseline view unless a separate presentation variant is explicitly requested and labeled.

## Current Counts And Ranges

Current station output:

```text
122 physical MT station markers
244 EDI variants retained in station properties
```

Current model output:

```text
source rows: 1,094,940
positive resistivity rows: 1,094,624
zero/non-positive rows masked from log display: 316
point preview emitted points: 90,000
full-density emitted points: 1,094,624
full-density format: tiled Float32 XYZ plus Float32 scalar buffers
```

Current authored slice output:

```text
horizontal slices: 6
vertical sections: 2
mesh vertices: 20,930
mesh triangles: 25,894
```

Current horizontal slices:

```text
+1500 m elevation
0 m elevation
-2500 m elevation
-5000 m elevation
-10000 m elevation
-25000 m elevation
```

Current vertical sections:

```text
east-west through station centroid
north-south through station centroid
```

Current display value:

```text
log10(resistivity_ohm_m)
```

Current default display range:

```text
displayMin: 0.139879
displayMax: 3.937122
median: 2.02983
```

## Visual Quality Target

The end goal is not simply "data visible."

The polished Utah FORGE output should be:

- visually strong in 3D
- tunable in the editor
- clear about values, units, and provenance
- suitable for a client-facing Geovox demo
- honest about measured vs modeled vs preview vs planned content

The point preview is a QA layer. The demo-quality path should use controlled slices, sections, clipping, opacity, camera pages, and clear legends.

## Rendering Defaults

Current default path:

1. Preserve source/client files untouched in `client_preprocessed/`.
2. Generate audited browser-ready outputs in `geosee_processed/`.
3. Keep the point preview available for QA.
4. Use the full-density tiled renderer as the Stage 2 density layer.
5. Keep authored slices available as the first presentation layer.
6. Expose useful controls in the editor.
7. Add authored pages after the data renderer is stable.

Current editor-exposed controls for Phase 3 MT include:

- station marker radius
- station marker lift
- station label lift
- scalar color ramp endpoints
- scalar display min/max
- scalar midpoint
- scalar contrast/nuance
- point preview point size
- horizontal slice visibility
- vertical section visibility
- individual slice visibility
- value legend visibility

## Southwestern / Regional MT

Southwestern/regional MT is a later context layer, not the current first build target.

The internal folder name remains:

```text
forge_southwestern
```

User-facing labels should be reviewed later and may become:

```text
Southwestern Utah MT
Regional MT context
```

Do not wire Southwestern/regional MT until the source files have their own inventory, CRS review, transform, provenance, preview output, and layer acceptance check.

## Seismic Analysis

Seismic analysis is a separate dataset family from resistivity.

Previously inspected unsorted files appear to be seismic reflection data from GDR submissions 1015 and 1141, not MT resistivity. Keep them out of electrical resistivity outputs unless a later reviewed brief says otherwise.

Do not add seismic to the first demo by default. The user has explicitly blocked seismic until they say to start.

## App Wiring Gate

No future Utah FORGE layer should be enabled in `project.json` until:

- source files are inventoried
- CRS / coordinate frame is known or explicitly marked unresolved
- units are known
- source bounds are known
- scene origin is chosen
- vertical meaning is understood or clearly flagged
- provenance / attribution is recorded
- measured/source-derived/preview/placeholder/future status is recorded
- a browser-ready output exists under `geosee_processed/`
- the layer loads locally without missing-file errors
- the layer toggles from the editor

## Resolved Items

These are no longer open questions for the current Phase 3 MT baseline:

- first demo target: MT-only baseline
- source folder contract: `client_preprocessed/`
- app-ready folder contract: `geosee_processed/`
- Phase 3 MT CRS: EPSG:26912 / NAD83 UTM Zone 12N
- scene origin: model frame center in UTM, elevation 0
- vertical scale: true 1:1 meters
- model crop: none
- station marker count: 122 physical stations
- EDI variants retained: 244
- model row count: 1,094,940
- model display value: log10 resistivity in Ohm-m
- Stage 2 density layer: full-density tiled MT resistivity renderer
- first presentation layer: authored MT resistivity slices

## Still Unresolved

These remain data- or design-dependent:

- whether the extreme negative model elevations should later be explained as depth below datum, model padding, or another inversion coordinate convention in presentation text
- whether/when the client wants seismic after the user explicitly says to start
- exact intended user-facing name for the Southwestern/regional dataset
- whether wells, faults, terrain, microseismic events, or infrastructure files will be delivered
- whether Phase 3 MT slices need a higher-fidelity runtime slicing renderer after the authored preview
- final color ramp choices for a client-facing visual style
- final authored story pages and camera choreography

## Practical Next Sequence

If no later brief changes direction:

1. Review the current Phase 3 MT layers in the viewer.
2. Verify and tune the Stage 2 full-density renderer for browser usability.
3. Tune scalar ramp, legend, opacity, and point size for readability.
4. Keep authored slices available but not default visible until story work begins.
5. Author Phase 3 MT presentation pages only after the renderer is stable.
6. Only then consider non-seismic future layers; do not intake seismic until the user explicitly says to start.
