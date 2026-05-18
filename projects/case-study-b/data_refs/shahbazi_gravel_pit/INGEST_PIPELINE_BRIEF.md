# GeoSee Ingest Pipeline Brief - Shahbazi Gravel Pit

This is the implementation brief for the next GeoSee pass after the Shahbazi source bundle lands locally.

Source landing folder:

`projects/case-study-b/data/raw/shahbazi_gravel_pit/`

Processed output folder:

`projects/case-study-b/data/processed/shahbazi_gravel_pit/`

Current status: blocked on source acquisition and triage. Do not enable real-data layers until the source package has been inspected and processed outputs exist.

## Working Assumption

The source bundle is expected to include TIFF UAV images, control/check points, tie/corresponding points, direct EOPs, timestamps, and a terrestrial laser scanner point cloud over a 30 x 40 m sub-zone. It may or may not include ready-made orthomosaic, DSM, dense cloud, or mesh products.

Known article-level facts: data source location is Sherbrooke, Quebec, Canada; the image coordinate file `DirectEOPs.txt` uses NAD83 / MTM Zone 7 with ellipsoidal heights. Still verify actual downloaded files before integration.

## Pipeline Stages

### Stage 0 - Source Inventory

Inputs:

- Downloaded source archive or folder
- Article citation and license notes

Actions:

1. Compute source inventory: filenames, sizes, extensions, counts.
2. Record archive and extracted sizes.
3. Identify major source groups:
- UAV images
- Ground control / check points
- Corresponding image points
- Direct EOPs and timestamps
- TLS point cloud
   - Camera calibration / intrinsics
   - Ready-made products, if any
4. Write findings into staging records before processing.

Do not modify `project.json` in this stage.

### Stage 1 - Coordinate And Scale Review

Inputs:

- GCP/check-point tables
- Point-cloud header or coordinate ranges
- Any CRS metadata

Actions:

1. Identify CRS, units, vertical datum, coordinate axis order, and local frame.
2. Expect NAD83 / MTM Zone 7 for direct EOPs; confirm whether the TLS point cloud and control points use the same frame.
3. If CRS is missing, preserve native coordinates and record the uncertainty.
4. Set a candidate scene origin as the centroid of the verified survey extent.
5. Do not force the dataset into Woodjam's CRS.

Output:

- `coordinate_review.md`
- Candidate scene origin and transform notes

### Stage 2 - First Visual Asset

Goal: produce the smallest credible real visual layer before attempting the full pipeline.

Preferred order:

1. TLS point-cloud sub-zone, if it is directly convertible.
2. Textured mesh / GLB, if one ships or can be generated quickly.
3. Orthomosaic preview draped on a simple plane or surface.

Outputs may include:

- `tls_subzone_potree/metadata.json`
- `shahbazi_gravel_pit_textured_mesh.glb`
- `orthomosaic_preview.tif`
- `ground_control_points.geojson`

Only after one output exists should GeoSee loading work begin.

### Stage 3 - Photogrammetry Products

Use Agisoft Metashape if available. If using 3DF Zephyr Free, account for the 50-image cap and split into overlapping batches.

Target outputs:

- Dense point cloud, LAS/LAZ or PLY
- Orthomosaic, GeoTIFF
- DSM, GeoTIFF
- Textured mesh, OBJ or GLB
- Camera poses / reconstruction report if available

Cross-check the photogrammetric dense cloud against the supplied TLS sub-zone. This is the data-integrity story for technical/provenance review.

### Stage 4 - Web Conversion

Point clouds:

- Convert LAS/LAZ/PLY/XYZ/E57 to a streamable web format.
- Preferred target: Potree 2.0 directory with `metadata.json`.
- Alternative target: EPT, if a compatible loader is chosen.

Meshes:

- Convert OBJ/PLY/FBX to GLB.
- Use Draco or meshopt compression only after baseline loading succeeds.
- Keep a non-compressed debug GLB if conversion quality is uncertain.

Rasters:

- Preserve source GeoTIFFs.
- Generate lightweight preview rasters for browser loading if full-resolution rasters are too large.

Control points:

- Normalize GCP/check points to GeoJSON.
- Include source ID, role (`gcp` or `check`), coordinate fields, and CRS metadata.

### Stage 5 - GeoSee Integration

Required code/layer additions, gated on real processed files:

- Point-cloud loader for Potree/EPT output.
- GLB loader for textured mesh output.
- Optional orthomosaic drape loader if the raster is the first credible visual layer.
- Project-native scene origin and transform metadata.

Existing declared layer IDs in `project.json`:

- `shahbazi-textured-mesh`
- `shahbazi-point-cloud`
- `shahbazi-orthomosaic`
- `shahbazi-ground-control`
- `shahbazi-tls-subzone`
- `shahbazi-derived-overlays`

Keep these disabled until the target files exist and review items are cleared.

### Stage 6 - Demo Packaging

After a real visual layer is in GeoSee:

1. Tune Case Study B camera pages around real geometry.
2. Retain the procedural shell as fallback, but reduce its emphasis.
3. Add illustrative overlays only with explicit provenance sidecars.
4. Prepare a 30-60 second flythrough either in Blender or the Three.js scene.

## Commands To Fill In Later

These are placeholders until real formats are known.

```text
# PDAL inspect example
pdal info <source-point-cloud>

# Potree conversion example
PotreeConverter <source-point-cloud> -o projects/case-study-b/data/processed/shahbazi_gravel_pit/<target> --generate-page false

# Mesh conversion example
blender --background --python <conversion-script.py>
```

## Stop Conditions

Stop and ask before integration if:

- CRS cannot be identified.
- The source archive does not match the cited dataset.
- Point-cloud and image coordinate frames do not appear registered.
- Products are too large for browser loading without simplification.
- License or attribution is unclear.
