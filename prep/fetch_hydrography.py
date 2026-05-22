"""
One-off prep script. Pulls BC Freshwater Atlas stream network + lake
polygons from the DataBC WFS service, clipped to the project bounds in
EPSG:26910, and writes two GeoJSON files local to the data/ folder.

Usage (from C:\\GeoSee\\GeoSee_Dev):
    python prep/fetch_hydrography.py

Reads:  https://openmaps.gov.bc.ca/geo/pub/wfs (DataBC public WFS)
Writes: data/hydrography_streams.geojson   (LineString features)
        data/hydrography_lakes.geojson     (Polygon features)

BC Freshwater Atlas catalogue entries:
  - Stream network: WHSE_BASEMAPPING.FWA_STREAM_NETWORKS_SP
  - Lakes:          WHSE_BASEMAPPING.FWA_LAKES_POLY

WFS native CRS is BC Albers (EPSG:3005); we request output reprojected to
EPSG:26910 (project CRS) by passing srsName= to the WFS endpoint. Bbox is
in the same CRS so the spatial filter aligns with our project bounds.

Stdlib only -- no geopandas dependency. WFS already restricts the result
to features intersecting the bbox; features that extend beyond keep their
full geometry, which is acceptable for visualization (fog dissolves the
extents anyway).
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

DST_STREAMS = Path("data/hydrography_streams.geojson")
DST_LAKES = Path("data/hydrography_lakes.geojson")

TARGET_CRS = "EPSG:26910"
# (min_easting, min_northing, max_easting, max_northing) -- matches the
# 40x40 km project tile centred on (612000, 5790000).
BBOX = (592000, 5770000, 632000, 5810000)

WFS_BASE = "https://openmaps.gov.bc.ca/geo/pub/wfs"
STREAMS_LAYER = "WHSE_BASEMAPPING.FWA_STREAM_NETWORKS_SP"
LAKES_LAYER = "WHSE_BASEMAPPING.FWA_LAKES_POLY"

# WFS default count is small (often 1000); bump explicitly so dense AOIs
# don't get silently truncated.
COUNT_LIMIT = 20000


def fetch_wfs(layer: str, bbox: tuple[float, float, float, float], crs: str) -> dict:
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": layer,
        "srsName": crs,
        "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]},{crs}",
        "outputFormat": "application/json",
        "count": COUNT_LIMIT,
    }
    url = WFS_BASE + "?" + urllib.parse.urlencode(params)
    print(f"  Fetching {layer}")
    print(f"    {url[:120]}...")
    req = urllib.request.Request(url, headers={"User-Agent": "GeoSee/0.1"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read())


def main():
    DST_STREAMS.parent.mkdir(parents=True, exist_ok=True)

    print("BC Freshwater Atlas -> EPSG:26910 GeoJSON")
    print(f"  Bounds: {BBOX}")

    streams = fetch_wfs(STREAMS_LAYER, BBOX, TARGET_CRS)
    n_streams = len(streams.get("features", []))
    DST_STREAMS.write_text(json.dumps(streams))
    print(f"  Streams: {n_streams} features -> {DST_STREAMS.resolve()}")

    lakes = fetch_wfs(LAKES_LAYER, BBOX, TARGET_CRS)
    n_lakes = len(lakes.get("features", []))
    DST_LAKES.write_text(json.dumps(lakes))
    print(f"  Lakes:   {n_lakes} features -> {DST_LAKES.resolve()}")

    print("Done.")


if __name__ == "__main__":
    main()
