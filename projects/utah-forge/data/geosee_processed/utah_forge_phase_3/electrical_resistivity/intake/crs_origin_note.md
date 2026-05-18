# Utah FORGE Phase 3 MT CRS / Origin / Units Lock

Generated: 2026-05-12

Status: CRS/origin/units locked for processing; no viewer layer has been wired into the app.

## Locked Choices

- Source files stay under `client_preprocessed/`.
- GeoSee-ready outputs stay under `geosee_processed/`.
- No data crop at this stage.
- True source scale: 1 meter source = 1 GeoSee scene unit.
- Vertical exaggeration: `1.0`.
- Do not distort the data vertically for the first pipeline.

## Source CRS

Model CRS is treated as:

```text
EPSG:26912 - NAD83 / UTM zone 12N, meters
```

Evidence:

- `FORGE_MT_12_12_2021.prj` identifies `NAD_1983_UTM_Zone_12N` with meter units.
- `FRG200614_mdl17_cellcenter.dat` header states `Northing (m), Easting (m), Elevation (m), Resistivity (ohmm)` and `Nad 83`.
- EDI headers provide latitude/longitude/elevation and state NAD83 datum in the info block.

EDI station headers will be converted from geographic NAD83 to UTM Zone 12N using:

```text
EPSG:4269 -> EPSG:26912
```

## Scene Transform

GeoSee local axis convention:

```text
X = east
Y = north
Z = up
units = meters
```

Scene origin:

```json
{
  "easting_m": 341467.35,
  "northing_m": 4273374.5,
  "elevation_m": 0.0
}
```

Coordinate formula:

```text
local_x = source_easting_m - 341467.350
local_y = source_northing_m - 4273374.500
local_z = source_elevation_m - 0.000
```

The horizontal origin is the center of the full model extent. The vertical origin is elevation 0 so source vertical coordinates remain directly legible.

## Model Bounds

Source model bounds:

```json
{
  "easting_m": [
    201896.7,
    481038.0
  ],
  "northing_m": [
    4159430.0,
    4387319.0
  ],
  "elevation_m": [
    -122114.0,
    3449.131
  ],
  "resistivity_ohm_m": [
    0.0,
    31622.78
  ]
}
```

Scene-local model bounds:

```json
{
  "min": [
    -139570.64999999997,
    -113944.5,
    -122114.0
  ],
  "max": [
    139570.65000000002,
    113944.5,
    3449.131
  ]
}
```

Model rows: 1,094,940

Zero-or-negative resistivity rows: 316

## Station Bounds

Unique physical stations: 122

Source station bounds:

```json
{
  "easting_m": [
    316613.97729202395,
    389664.485050526
  ],
  "northing_m": [
    4246648.941299268,
    4332874.134515258
  ],
  "elevation_m": [
    1487.0,
    2485.0
  ],
  "lat": [
    38.35828333333333,
    39.13806666666667
  ],
  "lon": [
    -113.09938333333334,
    -112.27666666666667
  ]
}
```

Scene-local station bounds:

```json
{
  "min": [
    -24853.37270797603,
    -26725.558700731955,
    1487.0
  ],
  "max": [
    48197.135050526005,
    59499.63451525755,
    2485.0
  ]
}
```

Station/model horizontal overlap:

```json
{
  "easting_inside_count": 122,
  "northing_inside_count": 122,
  "both_inside_count": 122,
  "total": 122
}
```

## Watch Items

- The model is broad. It is intentionally not cropped yet.
- The model reaches very deep negative elevations. This is preserved at true scale for now.
- The meaning of the deepest vertical values should still be explained in the viewer copy before demo use.
- The 316 non-positive resistivity rows must be masked or filtered before log color rendering.

## Step 3 Acceptance Check

- [x] CRS identified from source evidence.
- [x] EDI station CRS conversion path identified.
- [x] Scene origin defined.
- [x] True-size scale locked.
- [x] No crop decision recorded.
- [x] Vertical exaggeration locked to 1.0.
- [x] Model and station bounds recorded.
- [x] No app layer has been wired yet.

## Next Step

Proceed to Step 4: parse MT station markers into GeoJSON using this transform.
