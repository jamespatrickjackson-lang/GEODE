# Utah FORGE Phase 3 MT Source Inventory

Generated: 2026-05-12

Status: source inventory complete; no viewer layer has been wired into the app.

## Source Files

| File | Role | Size | Source |
|---|---|---:|---|
| `mt_edis/FORGE_MT_190812_EDIs.zip` | EDI station/source response package | 5.00 MB | GDR 1255 |
| `mt_model_cell_center_updated/FORGE_MT_mdl17_cellcenter.zip` | Updated MT inversion model cell-center package | 36.93 MB | GDR 1255 |
| `references/FORGE_Phase3_geophysics.pdf` | Method/reference PDF, not render data | 4.29 MB | GDR 1255 |

Full SHA256 hashes are recorded in `source_inventory.json`.

## EDI Archive Summary

- Archive: `FORGE_MT_190812_EDIs.zip`
- Files: 366
- Uncompressed size: 12.81 MB
- EDI files: 244
- Survey text files: 122
- Unique physical stations detected: 122
- Missing coordinate headers: 0
- Latitude range: 38.358283 to 39.138067
- Longitude range: -113.099383 to -112.276667
- Elevation range: 1487.0 m to 2485.0 m

Interpretation:

- The EDI archive contains 122 physical stations.
- Each station appears to have a standard EDI and a `_bvv` EDI variant.
- The viewer marker layer should render one marker per physical station, not one marker per EDI file.

## Updated Cell-Center Model Archive Summary

- Archive: `FORGE_MT_mdl17_cellcenter.zip`
- Files: 11
- Uncompressed size: 306.75 MB
- Main DAT payload: `FRG200614_mdl17_cellcenter.dat`
- TXT export: `FORGE_MT_12_12_2021.txt`
- Shapefile export: `FORGE_MT_12_12_2021.shp`
- Projection file: `FORGE_MT_12_12_2021.prj`

Projection file identifies:

```text
NAD_1983_UTM_Zone_12N, meters
```

DAT header:

```text
FRG200614 - model 17
Northing (m), Easting (m), Elevation (m), Resistivity (ohmm)
Nad 83, Inversion parameter center
```

Preferred first parser payload:

```text
FRG200614_mdl17_cellcenter.dat
```

Reason: the DAT file has explicit model/header lines, preserves non-rounded coordinates, is smaller than the TXT export, and has the same row count as the TXT export.

## Model DAT Stats

- Rows: 1,094,940
- Skipped rows: 0
- Zero-or-negative resistivity rows: 316
- Easting range: 201896.7 m to 481038.0 m
- Northing range: 4159430.0 m to 4387319.0 m
- Elevation range: -122114.0 m to 3449.1 m
- Resistivity range: 0.00 to 31622.78 Ohm-m
- Horizontal extent: 279.1 km east-west by 227.9 km north-south
- Vertical extent: 125.6 km

## Issues / Watch Items

- The updated cell-center model spans about 279 km east-west by 228 km north-south; this is broader than a tight pad-scale FORGE scene and should be cropped/sectioned for viewer use.
- The model vertical range reaches about -122 km elevation/depth basis through 3.45 km; confirm vertical meaning before rendering.
- The model includes 316 zero-or-negative resistivity rows, which cannot be log10-colored directly. These need filtering, masking, or sentinel handling.
- The DAT header says NAD83 but does not name UTM Zone 12N; the included PRJ confirms NAD_1983_UTM_Zone_12N for the shapefile/export package.
- EDI station coordinates are latitude/longitude/elevation, while model files are UTM meters. Step 3 must define one shared scene transform.

## Step 2 Acceptance Check

- [x] Actual source files are present.
- [x] File sizes and source roles are documented.
- [x] Archive contents are readable.
- [x] EDI physical station count is identified.
- [x] Main model payload candidate is identified.
- [x] Suspicious/missing items are listed.
- [x] No app layer has been wired yet.

## Next Step

Proceed to Step 3: CRS / origin / units lock.

Step 3 must define a shared GeoSee scene transform for EDI station coordinates and model UTM coordinates before any viewer output is generated.
