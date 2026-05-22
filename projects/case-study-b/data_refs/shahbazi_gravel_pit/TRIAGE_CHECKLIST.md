# Source Bundle Triage Checklist

Complete this immediately after locating or temporarily restoring downloaded
source files from the archive-map path for:

`projects/case-study-b/data/raw/shahbazi_gravel_pit/`

Target time: 30 minutes for first pass.

## File Inventory

Record:

- Archive name and size
- Extracted folder structure
- Total file count
- Total extracted size
- Image count and image extensions
- Point-cloud files and extensions
- GCP/check-point tables and extensions
- Camera calibration or intrinsics files
- Tie-point / corresponding-point files
- Any ready-made orthomosaic, DSM, DTM, mesh, or report files

Current observed local inventory:

- `RawImages/`: 158 `.tiff` files
- `Part3-RawImages.zip`: source archive for the raw images
- `DirectEOPs.txt`: 158 rows
- `RefinedEOPs.txt`: 158 rows
- `TimeStamps.txt`: 158 rows
- `TiePoints.txt`: 41,346 rows
- `ObjectPoints.txt`: 3,682 rows
- `GCPs.txt`: 109 rows
- `DenseMatching.txt`: 17 image pairs
- `LaserScan.xyz`: 8,308,685 XYZ points
- `1-s2.0-S2352340919303154-mmc2.zip`
- `1-s2.0-S2352340919303154-mmc3.zip`

## Expected Checks

1. Image format and count
   - Expected: 158 uncompressed TIFF images in `RawImages`.
   - Record actual count and EXIF availability.

2. Point cloud
   - Expected: terrestrial laser scanner point cloud for a 30 x 40 m sub-zone.
   - Record actual format, size, point count if available, colour fields, intensity fields, and whether it appears registered.

3. Ground control / check points
   - Expected: 109 3D coordinates.
   - Record row count, columns, units, coordinate order, and whether point IDs map to image observations.

4. Corresponding image points
   - Expected: about 40,000 2D points.
   - Record file format and whether IDs link cleanly to images and/or GCPs.

5. Coordinate reference system
   - Inspect point-cloud header in CloudCompare or PDAL.
   - Expected from `DirectEOPs.txt`: NAD83 / MTM Zone 7, ellipsoidal heights.
   - Record whether all files share that CRS or whether the TLS point cloud has separate metadata.
   - If CRS is missing or inconsistent, record coordinate ranges and ask the author before final GIS alignment.

6. Pre-baked products
   - Confirm whether orthomosaic, DSM, textured mesh, or dense cloud products are included.
   - If absent, plan photogrammetry processing before GeoSee integration.

## First GeoSee Success Target

Pick the smallest credible real visual layer:

- TLS point-cloud sub-zone, if format and scale are easy to convert.
- Textured mesh / GLB, if included or easy to generate.
- Orthomosaic preview draped onto a simple surface, if raster products exist.

Do not attempt the full pipeline first.

## Update After Triage

Update these records with real facts:

- Historical sample staging records were purged from the active repo. Use
  `docs/archive-map.md` and `docs/archive-manifest.json` for source recovery;
  do not recommit raw source or staging bytes.

Keep all real-data layers disabled until processed outputs exist and review is complete.
