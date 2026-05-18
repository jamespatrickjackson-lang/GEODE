"""
One-off prep script. Pulls BC Digital Road Atlas road centerlines from
the DataBC WFS service, clipped to the Woodjam 40x40 km project bounds,
and writes one GeoJSON file local to data/.

Usage (from C:\\GeoSee_Dev):
    python prep/fetch_roads.py

Reads:  https://openmaps.gov.bc.ca/geo/pub/wfs (DataBC public WFS)
Writes: data/roads.geojson

BC Digital Road Atlas catalogue entry:
  - Road centerlines: WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP

The app scene uses EPSG:26910, so the WFS request asks DataBC to return
geometry in that CRS. Bbox values are in the same CRS.
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

from pyproj import Transformer

DST_ROADS = Path("data/roads.geojson")

TARGET_CRS = "EPSG:26910"
FETCH_CRS = "EPSG:3005"
# (min_easting, min_northing, max_easting, max_northing) -- matches the
# 40x40 km project tile centred on (612000, 5790000).
BBOX = (592000, 5770000, 632000, 5810000)

WFS_BASE = "https://openmaps.gov.bc.ca/geo/pub/wfs"
ROADS_LAYER = "WHSE_BASEMAPPING.DRA_DGTL_ROAD_ATLAS_MPAR_SP"
PAGE_SIZE = 2000
TILES_X = 4
TILES_Y = 4

TO_FETCH = Transformer.from_crs(TARGET_CRS, FETCH_CRS, always_xy=True)
TO_TARGET = Transformer.from_crs(FETCH_CRS, TARGET_CRS, always_xy=True)


def fetch_wfs_page(
    layer: str,
    bbox: tuple[float, float, float, float],
    start_index: int,
) -> dict:
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": layer,
        # Query native BC Albers and transform locally. Asking the WFS to
        # reproject this dense road layer over the whole AOI can time out.
        "srsName": FETCH_CRS,
        "bbox": f"{bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]},{FETCH_CRS}",
        "outputFormat": "application/json",
        "count": PAGE_SIZE,
        "startIndex": start_index,
    }
    url = WFS_BASE + "?" + urllib.parse.urlencode(params)
    print(f"  Fetching {layer} startIndex={start_index}")
    print(f"    {url[:120]}...")
    req = urllib.request.Request(url, headers={"User-Agent": "GeoSee/0.1"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read())


def project_bbox_to_fetch_crs(
    bbox: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    min_e, min_n, max_e, max_n = bbox
    points = [
        TO_FETCH.transform(min_e, min_n),
        TO_FETCH.transform(min_e, max_n),
        TO_FETCH.transform(max_e, min_n),
        TO_FETCH.transform(max_e, max_n),
    ]
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (min(xs), min(ys), max(xs), max(ys))


def tile_bboxes() -> list[tuple[float, float, float, float]]:
    min_e, min_n, max_e, max_n = BBOX
    dx = (max_e - min_e) / TILES_X
    dy = (max_n - min_n) / TILES_Y
    tiles = []
    for iy in range(TILES_Y):
        for ix in range(TILES_X):
            e0 = min_e + ix * dx
            e1 = min_e + (ix + 1) * dx
            n0 = min_n + iy * dy
            n1 = min_n + (iy + 1) * dy
            # Slight overlap catches roads crossing tile edges; dedupe below
            # removes repeated features.
            pad = 100
            tiles.append(project_bbox_to_fetch_crs((e0 - pad, n0 - pad, e1 + pad, n1 + pad)))
    return tiles


def transform_position(pos: list[float]) -> list[float]:
    x, y = TO_TARGET.transform(pos[0], pos[1])
    if len(pos) > 2:
        return [x, y, pos[2]]
    return [x, y]


def transform_geometry_to_target(geometry: dict | None) -> dict | None:
    if not geometry:
        return None
    coords = geometry.get("coordinates")
    if geometry.get("type") == "LineString" and isinstance(coords, list):
        geometry["coordinates"] = [transform_position(p) for p in coords]
    elif geometry.get("type") == "MultiLineString" and isinstance(coords, list):
        geometry["coordinates"] = [
            [transform_position(p) for p in line]
            for line in coords
            if isinstance(line, list)
        ]
    return geometry


def coord_segment_count(geometry: dict | None) -> int:
    if not geometry:
        return 0
    coords = geometry.get("coordinates")
    if geometry.get("type") == "LineString" and isinstance(coords, list):
        return max(0, len(coords) - 1)
    if geometry.get("type") == "MultiLineString" and isinstance(coords, list):
        return sum(max(0, len(line) - 1) for line in coords if isinstance(line, list))
    return 0


def main():
    DST_ROADS.parent.mkdir(parents=True, exist_ok=True)

    print("BC Digital Road Atlas -> EPSG:26910 GeoJSON")
    print(f"  Bounds: {BBOX}")

    by_key = {}
    for tile_index, tile in enumerate(tile_bboxes(), start=1):
        print(f"  Tile {tile_index}/{TILES_X * TILES_Y}: {tuple(round(v, 1) for v in tile)}")
        start_index = 0
        while True:
            page = fetch_wfs_page(ROADS_LAYER, tile, start_index)
            batch = page.get("features", [])
            print(f"    received {len(batch)} features")
            for feature in batch:
                feature["geometry"] = transform_geometry_to_target(feature.get("geometry"))
                key = feature.get("id")
                if not key:
                    key = json.dumps(
                        [feature.get("properties"), feature.get("geometry")],
                        sort_keys=True,
                    )
                by_key[key] = feature
            if len(batch) < PAGE_SIZE:
                break
            start_index += PAGE_SIZE

    features = list(by_key.values())

    roads = {
        "type": "FeatureCollection",
        "name": "woodjam_roads_digital_road_atlas",
        "crs": {"type": "name", "properties": {"name": TARGET_CRS}},
        "features": features,
    }
    DST_ROADS.write_text(json.dumps(roads))

    segment_count = sum(coord_segment_count(f.get("geometry")) for f in features)
    property_names = sorted(
        {k for f in features[:20] for k in (f.get("properties") or {}).keys()}
    )
    print(f"  Roads: {len(features)} features, {segment_count} segments")
    if property_names:
        print(f"  Example property fields: {', '.join(property_names[:18])}")
    print(f"  Wrote: {DST_ROADS.resolve()}")
    print("Done.")


if __name__ == "__main__":
    main()
