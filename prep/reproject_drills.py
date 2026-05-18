"""
One-off prep script. Reprojects drills.geojson from WGS84 (EPSG:4326)
to NAD83 / UTM Zone 10N (EPSG:26910), the project CRS for Woodjam.

Usage (from Dev_files_V1/):
    python prep/reproject_drills.py

Reads:  docs/woodjam/drills.geojson   (WGS84, ~61 KB)
Writes: data/drills.geojson            (EPSG:26910)

Note: Output technically violates RFC 7946, which mandates WGS84.
Project convention (per data-manifest.md and decision #012) is one
CRS per project, conformed at ingestion. The Three.js loader reads
raw coordinates relative to sceneOrigin and doesn't enforce GeoJSON
CRS conformance.

Dependency: pyproj. Install with:
    pip install pyproj
"""

import json
from pathlib import Path
from pyproj import Transformer

INPUT  = Path("docs/woodjam/drills.geojson")
OUTPUT = Path("data/drills.geojson")

# always_xy=True ensures (lon, lat) input order matches GeoJSON convention.
transformer = Transformer.from_crs("EPSG:4326", "EPSG:26910", always_xy=True)


def reproject_coords(coords):
    """Recursively reproject coordinate arrays. Handles 2D, 3D, nested."""
    if isinstance(coords[0], (int, float)):
        x, y = transformer.transform(coords[0], coords[1])
        if len(coords) == 3:
            return [x, y, coords[2]]  # preserve elevation as-is
        return [x, y]
    return [reproject_coords(c) for c in coords]


def reproject_geometry(geom):
    if geom["type"] == "GeometryCollection":
        return {
            "type": "GeometryCollection",
            "geometries": [reproject_geometry(g) for g in geom["geometries"]],
        }
    return {
        "type": geom["type"],
        "coordinates": reproject_coords(geom["coordinates"]),
    }


def main():
    if not INPUT.exists():
        raise SystemExit(f"Input not found: {INPUT.resolve()}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    with INPUT.open() as f:
        data = json.load(f)

    n_features = len(data.get("features", []))
    for feat in data["features"]:
        feat["geometry"] = reproject_geometry(feat["geometry"])

    # Strip any legacy crs member; project convention handles CRS externally.
    data.pop("crs", None)

    with OUTPUT.open("w") as f:
        json.dump(data, f)

    print(f"Reprojected {n_features} features → {OUTPUT.resolve()}")


if __name__ == "__main__":
    main()
