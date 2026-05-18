"""
Fetch public terrain and map context for the Utah FORGE Phase 3 render.

Outputs are fetched for a 500% XY public context tile around the 3D MT
resistivity full-density model manifest bounds and stored under the Utah
FORGE geosee_processed folder.

Usage:
    python prep/fetch_utah_forge_public_context.py
"""

from __future__ import annotations

import json
import math
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterable

import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_bounds
from shapely.geometry import GeometryCollection, box, mapping, shape
from shapely.geometry.base import BaseGeometry


ROOT = Path(__file__).resolve().parents[1]
FULL_DENSITY_MANIFEST = ROOT / (
    "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/"
    "electrical_resistivity/resistivity_model/full_density/manifest.json"
)
OUT_DIR = ROOT / (
    "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/"
    "public_context"
)

TARGET_CRS = "EPSG:26912"
OUTPUT_RESOLUTION_M = 1000
TERRAIN_FILENAME = f"terrain_public_context_{OUTPUT_RESOLUTION_M}m.tif"
PAGE_SIZE = 2000
TILES_X = 8
TILES_Y = 6
XY_PADDING_FRACTION = 2.0  # 200% each side = 500% total public surface tile.

TERRAIN_SERVICE = (
    "https://elevation.nationalmap.gov/arcgis/rest/services/"
    "3DEPElevation/ImageServer/exportImage"
)

FEATURE_SERVICES = {
    "roads": {
        "url": (
            "https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/"
            "services/UtahRoads/FeatureServer/0/query"
        ),
        "out": "roads.geojson",
        "where": "CARTOCODE IN ('1','3','5','7')",
        "out_fields": ["OBJECTID", "FULLNAME", "NAME", "POSTTYPE", "CARTOCODE"],
        "allowed": {"LineString", "MultiLineString"},
        "property_allow": {"CARTOCODE": {"1", "3", "5", "7"}},
        "simplify_m": 140,
        "min_length_m": 7000,
        "source": "UGRC Utah Roads / Utah SGID",
    },
    "streams": {
        "url": (
            "https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/"
            "services/UtahStreamsNHD/FeatureServer/0/query"
        ),
        "out": "hydrography_streams.geojson",
        "where": "FType_Text = 'Stream/River' AND (GNIS_Name IS NOT NULL OR LengthKM >= 8)",
        "out_fields": [
            "OBJECTID",
            "GNIS_Name",
            "FType_Text",
            "LengthKM",
            "ReachCode",
        ],
        "allowed": {"LineString", "MultiLineString"},
        "property_allow": {"FType_Text": {"Stream/River"}},
        "simplify_m": 450,
        "min_length_m": 3500,
        "source": "UGRC Utah Streams NHD / Utah SGID",
    },
    "waterbodies": {
        "url": (
            "https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/"
            "services/UtahLakesNHD/FeatureServer/0/query"
        ),
        "out": "hydrography_lakes.geojson",
        "where": "AreaSqKm >= 0.25",
        "out_fields": [
            "OBJECTID",
            "GNIS_Name",
            "FType_Text",
            "AreaSqKm",
            "Elevation",
            "ReachCode",
        ],
        "allowed": {"Polygon", "MultiPolygon"},
        "simplify_m": 80,
        "min_area_m2": 250_000,
        "source": "UGRC Utah Lakes NHD / Utah SGID",
    },
}


def request_json(url: str, params: dict[str, Any], timeout: int = 300) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{url}?{query}",
        headers={"User-Agent": "GeoSee/0.1 public-context-fetch"},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read())
        except Exception:
            if attempt == 3:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("unreachable")


def download_file(url: str, dst: Path, timeout: int = 300) -> None:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "GeoSee/0.1 public-context-fetch"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        dst.write_bytes(response.read())


def load_full_density_bounds() -> tuple[tuple[float, float, float, float], dict[str, Any]]:
    manifest = json.loads(FULL_DENSITY_MANIFEST.read_text())
    source_bounds = manifest["sourceBounds"]
    e_min, e_max = source_bounds["easting_m"]
    n_min, n_max = source_bounds["northing_m"]
    return (float(e_min), float(n_min), float(e_max), float(n_max)), manifest


def padded_bbox(
    bbox: tuple[float, float, float, float],
    fraction: float = XY_PADDING_FRACTION,
) -> tuple[float, float, float, float]:
    min_e, min_n, max_e, max_n = bbox
    pad_e = (max_e - min_e) * fraction
    pad_n = (max_n - min_n) * fraction
    return (min_e - pad_e, min_n - pad_n, max_e + pad_e, max_n + pad_n)


def rounded_bbox(
    bbox: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    return tuple(round(value, 2) for value in bbox)


def fetch_terrain(bbox: tuple[float, float, float, float]) -> dict[str, Any]:
    min_e, min_n, max_e, max_n = bbox
    width = max(2, math.ceil((max_e - min_e) / OUTPUT_RESOLUTION_M))
    height = max(2, math.ceil((max_n - min_n) / OUTPUT_RESOLUTION_M))
    params = {
        "f": "json",
        "bbox": f"{min_e},{min_n},{max_e},{max_n}",
        "bboxSR": "26912",
        "imageSR": "26912",
        "size": f"{width},{height}",
        "format": "tiff",
        "pixelType": "F32",
        "interpolation": "RSP_BilinearInterpolation",
    }
    print(f"USGS 3DEP terrain -> {width} x {height} pixels at ~{OUTPUT_RESOLUTION_M} m")
    response = request_json(TERRAIN_SERVICE, params, timeout=120)
    href = response.get("href")
    if not isinstance(href, str):
      raise RuntimeError(f"USGS terrain export did not return href: {response}")

    terrain_path = OUT_DIR / TERRAIN_FILENAME
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir) / "terrain_export.tif"
        download_file(href, tmp_path, timeout=300)
        with rasterio.open(tmp_path) as src:
            data = src.read(
                1,
                out_shape=(height, width),
                resampling=Resampling.bilinear,
            )
            profile = src.profile.copy()
            profile.update(
                driver="GTiff",
                height=height,
                width=width,
                count=1,
                crs=TARGET_CRS,
                transform=from_bounds(min_e, min_n, max_e, max_n, width, height),
                dtype=str(data.dtype),
                compress="deflate",
                predictor=3,
                tiled=True,
                blockxsize=256,
                blockysize=256,
            )
            with rasterio.open(terrain_path, "w", **profile) as dst:
                dst.write(data, 1)

    print(f"  wrote {terrain_path.relative_to(ROOT)}")
    return {
        "file": terrain_path.name,
        "width": width,
        "height": height,
        "resolutionM": OUTPUT_RESOLUTION_M,
        "source": "USGS 3DEP / The National Map elevation service",
    }


def tile_bboxes(
    bbox: tuple[float, float, float, float],
) -> Iterable[tuple[int, tuple[float, float, float, float]]]:
    min_e, min_n, max_e, max_n = bbox
    dx = (max_e - min_e) / TILES_X
    dy = (max_n - min_n) / TILES_Y
    index = 0
    for iy in range(TILES_Y):
        for ix in range(TILES_X):
            index += 1
            e0 = min_e + ix * dx
            e1 = min_e + (ix + 1) * dx
            n0 = min_n + iy * dy
            n1 = min_n + (iy + 1) * dy
            yield index, (e0, n0, e1, n1)


def envelope_param(tile: tuple[float, float, float, float]) -> str:
    min_e, min_n, max_e, max_n = tile
    return json.dumps(
        {
            "xmin": min_e,
            "ymin": min_n,
            "xmax": max_e,
            "ymax": max_n,
            "spatialReference": {"wkid": 26912},
        },
        separators=(",", ":"),
    )


def fetch_feature_pages(
    name: str,
    service: dict[str, Any],
    bbox: tuple[float, float, float, float],
) -> list[dict[str, Any]]:
    by_key: dict[str, dict[str, Any]] = {}
    for tile_index, tile in tile_bboxes(bbox):
        offset = 0
        while True:
            params = {
                "f": "geojson",
                "where": service.get("where", "1=1"),
                "outFields": ",".join(service["out_fields"]),
                "returnGeometry": "true",
                "geometry": envelope_param(tile),
                "geometryType": "esriGeometryEnvelope",
                "inSR": "26912",
                "outSR": "26912",
                "spatialRel": "esriSpatialRelIntersects",
                "resultRecordCount": PAGE_SIZE,
                "resultOffset": offset,
            }
            page = request_json(service["url"], params)
            batch = page.get("features", [])
            print(
                f"  {name} tile {tile_index:02d}/{TILES_X * TILES_Y} "
                f"offset {offset}: {len(batch)}"
            )
            for feature in batch:
                key = str(
                    feature.get("id")
                    or (feature.get("properties") or {}).get("OBJECTID")
                    or json.dumps(feature.get("geometry"), sort_keys=True)
                )
                by_key[key] = feature
            exceeded = bool((page.get("properties") or {}).get("exceededTransferLimit"))
            if len(batch) < PAGE_SIZE and not exceeded:
                break
            if len(batch) == 0:
                break
            offset += PAGE_SIZE
    return list(by_key.values())


def flatten_geometries(geom: BaseGeometry, allowed: set[str]) -> Iterable[BaseGeometry]:
    if geom.is_empty:
        return
    if geom.geom_type in allowed:
        yield geom
        return
    if isinstance(geom, GeometryCollection) or hasattr(geom, "geoms"):
        for child in geom.geoms:
            yield from flatten_geometries(child, allowed)


def clipped_features(
    raw_features: list[dict[str, Any]],
    bbox: tuple[float, float, float, float],
    service: dict[str, Any],
) -> list[dict[str, Any]]:
    clip = box(*bbox)
    output: list[dict[str, Any]] = []
    allowed = set(service["allowed"])
    simplify_m = float(service.get("simplify_m", 0))
    min_length_m = float(service.get("min_length_m", 0))
    min_area_m2 = float(service.get("min_area_m2", 0))
    property_allow = service.get("property_allow") or {}

    for feature in raw_features:
        geometry = feature.get("geometry")
        if not geometry:
            continue
        properties = feature.get("properties") or {}
        if any(
            str(properties.get(field)) not in {str(v) for v in allowed_values}
            for field, allowed_values in property_allow.items()
        ):
            continue
        try:
            geom = shape(geometry)
            if not geom.is_valid:
                geom = geom.buffer(0)
            geom = geom.intersection(clip)
            if simplify_m > 0:
                geom = geom.simplify(simplify_m, preserve_topology=True)
        except Exception:
            continue

        base_id = str(feature.get("id") or properties.get("OBJECTID") or len(output))
        for part_index, part in enumerate(flatten_geometries(geom, allowed)):
            if min_length_m > 0 and getattr(part, "length", 0) < min_length_m:
                continue
            if min_area_m2 > 0 and getattr(part, "area", 0) < min_area_m2:
                continue
            output.append(
                {
                    "type": "Feature",
                    "id": f"{base_id}:{part_index}",
                    "properties": properties,
                    "geometry": mapping(part),
                }
            )
    return output


def fetch_vector_layer(
    name: str,
    service: dict[str, Any],
    bbox: tuple[float, float, float, float],
) -> dict[str, Any]:
    print(f"{name}: fetching tiled feature pages")
    raw = fetch_feature_pages(name, service, bbox)
    features = clipped_features(raw, bbox, service)
    collection = {
        "type": "FeatureCollection",
        "name": f"utah_forge_public_{name}",
        "crs": {"type": "name", "properties": {"name": TARGET_CRS}},
        "features": features,
    }
    out_path = OUT_DIR / service["out"]
    out_path.write_text(json.dumps(collection, separators=(",", ":")))
    segment_or_polygon_count = len(features)
    print(f"  wrote {out_path.relative_to(ROOT)} ({segment_or_polygon_count} features)")
    return {
        "file": service["out"],
        "source": service["source"],
        "rawFeatureCount": len(raw),
        "renderFeatureCount": len(features),
        "simplifyM": service.get("simplify_m", 0),
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    full_density_bbox, manifest = load_full_density_bounds()
    bbox = padded_bbox(full_density_bbox)
    manifest_bbox = rounded_bbox(bbox)
    scene_origin = manifest["scenePlacement"]["sceneOriginUtm"]

    print("Utah FORGE public context")
    print(f"  MT full-density bounds EPSG:26912: {full_density_bbox}")
    print(f"  padded public context bounds EPSG:26912: {bbox}")
    print(f"  scene origin: {scene_origin}")

    stats: dict[str, Any] = {
        "schema": "geosee.utah-forge-public-context.v1",
        "targetCrs": TARGET_CRS,
        "sourceBoundsRole": "500% XY public context tile around MT full-density bounds",
        "mtFullDensityBounds": {
            "easting_m": [full_density_bbox[0], full_density_bbox[2]],
            "northing_m": [full_density_bbox[1], full_density_bbox[3]],
        },
        "xyPaddingFractionEachSide": XY_PADDING_FRACTION,
        "sourceBounds": {
            "easting_m": [manifest_bbox[0], manifest_bbox[2]],
            "northing_m": [manifest_bbox[1], manifest_bbox[3]],
        },
        "sceneOriginUtm": scene_origin,
        "terrain": fetch_terrain(bbox),
        "vectors": {},
    }
    for name, service in FEATURE_SERVICES.items():
        stats["vectors"][name] = fetch_vector_layer(name, service, bbox)

    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(stats, indent=2))
    print(f"wrote {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
