"""
One-off prep script. Pulls the Woodjam AOI from NRCan's MRDEM-30 DTM
(Medium Resolution Digital Elevation Model, 30m, CanElevation Series),
reprojects to EPSG:26910 (project CRS), clips to the project bounds,
and writes a small local GeoTIFF.

Usage (from Dev_files_V1/):
    pip install rasterio
    python prep/fetch_terrain.py

Reads:  https://canelevation-dem.s3.ca-central-1.amazonaws.com/mrdem-30/mrdem-30-dtm.vrt
        (remote COG via VRT -- only the AOI window is downloaded)
Writes: data/terrain_woodjam.tif

Source: NRCan, Medium Resolution Digital Elevation Model (MRDEM),
CanElevation Series. Native CRS EPSG:3979 (Canada Atlas Lambert
NAD83 CSRS), vertical datum CGVD2013. 30m resolution.

Project conventions (data-manifest.md):
- Project CRS: EPSG:26910 (NAD83 / UTM Zone 10N)
- Project bounds: 608000-617000 E, 5785000-5795000 N
"""

from pathlib import Path

import rasterio
from rasterio.vrt import WarpedVRT
from rasterio.warp import Resampling
from rasterio.windows import from_bounds


SOURCE_VRT = (
    "https://canelevation-dem.s3.ca-central-1.amazonaws.com/"
    "mrdem-30/mrdem-30-dtm.vrt"
)
DST_PATH = Path("data/terrain_woodjam.tif")

TARGET_CRS = "EPSG:26910"
# (min_easting, min_northing, max_easting, max_northing)
TARGET_BOUNDS = (592000, 5770000, 632000, 5810000)


def main():
    DST_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("Opening remote MRDEM VRT (only the AOI window will transfer)...")
    with rasterio.open(SOURCE_VRT) as src:
        print(f"  Source CRS:    {src.crs}")
        print(f"  Source size:   {src.width} x {src.height} px (Canada-wide)")

        with WarpedVRT(
            src,
            crs=TARGET_CRS,
            resampling=Resampling.bilinear,
        ) as warped:
            window = from_bounds(*TARGET_BOUNDS, warped.transform)
            data = warped.read(1, window=window)
            transform = warped.window_transform(window)

            print(f"  Output size:   {data.shape[1]} x {data.shape[0]} px")
            print(f"  Output bounds: {TARGET_BOUNDS}")
            print(f"  Elev range:    {float(data.min()):.1f} - {float(data.max()):.1f} m")

            with rasterio.open(
                DST_PATH,
                "w",
                driver="GTiff",
                height=data.shape[0],
                width=data.shape[1],
                count=1,
                dtype=data.dtype,
                crs=TARGET_CRS,
                transform=transform,
                nodata=warped.nodata,
                compress="deflate",
            ) as dst:
                dst.write(data, 1)

    print(f"Wrote terrain -> {DST_PATH.resolve()}")


if __name__ == "__main__":
    main()
