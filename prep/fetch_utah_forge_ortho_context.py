"""
Fetch full-extent Utah FORGE ortho-photo textures for the terrain material.

Outputs are single stitched JPEGs for the same public-context bounds used by
the Utah FORGE terrain surface. The ArcGIS image service limits individual
exports to 4000 px, so this script fetches smaller tiles and stitches them
into final non-tiled runtime textures.

Usage:
    python prep/fetch_utah_forge_ortho_context.py
"""

from __future__ import annotations

import io
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / (
    "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/"
    "public_context"
)
MANIFEST_PATH = OUT_DIR / "manifest.json"
TARGET_CRS = "EPSG:26912"
SERVICE = "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer"
EXPORT_IMAGE = f"{SERVICE}/exportImage"
TEXTURE_BUDGETS = (4096, 8192)
TILE_SIZE = 2048
JPEG_QUALITY = 88


def request_json(url: str, params: dict[str, Any], timeout: int = 300) -> dict[str, Any]:
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{url}?{query}",
        headers={"User-Agent": "GeoSee/0.1 ortho-context-fetch"},
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


def download_bytes(url: str, timeout: int = 300) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "GeoSee/0.1 ortho-context-fetch"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read()


def public_context_bounds(manifest: dict[str, Any]) -> tuple[float, float, float, float]:
    source_bounds = manifest["sourceBounds"]
    min_e, max_e = source_bounds["easting_m"]
    min_n, max_n = source_bounds["northing_m"]
    return (float(min_e), float(min_n), float(max_e), float(max_n))


def export_tile(
    bbox: tuple[float, float, float, float],
    width: int,
    height: int,
) -> Image.Image:
    min_e, min_n, max_e, max_n = bbox
    params = {
        "f": "json",
        "bbox": f"{min_e},{min_n},{max_e},{max_n}",
        "bboxSR": "26912",
        "imageSR": "26912",
        "size": f"{width},{height}",
        "format": "jpg",
        "renderingRule": json.dumps(
            {"rasterFunction": "NaturalColor"},
            separators=(",", ":"),
        ),
    }
    response = request_json(EXPORT_IMAGE, params, timeout=180)
    href = response.get("href")
    if not isinstance(href, str):
        raise RuntimeError(f"USGS NAIP Plus export did not return href: {response}")
    return Image.open(io.BytesIO(download_bytes(href, timeout=300))).convert("RGB")


def tile_bbox(
    full_bbox: tuple[float, float, float, float],
    width: int,
    height: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
) -> tuple[float, float, float, float]:
    min_e, min_n, max_e, max_n = full_bbox
    span_e = max_e - min_e
    span_n = max_n - min_n
    tile_min_e = min_e + span_e * (x0 / width)
    tile_max_e = min_e + span_e * (x1 / width)
    tile_max_n = max_n - span_n * (y0 / height)
    tile_min_n = max_n - span_n * (y1 / height)
    return (tile_min_e, tile_min_n, tile_max_e, tile_max_n)


def build_texture(
    budget: int,
    full_bbox: tuple[float, float, float, float],
) -> dict[str, Any]:
    min_e, min_n, max_e, max_n = full_bbox
    width = budget
    height = max(1, round(budget * (max_n - min_n) / (max_e - min_e)))
    cols = math.ceil(width / TILE_SIZE)
    rows = math.ceil(height / TILE_SIZE)
    output = Image.new("RGB", (width, height))

    print(f"ortho {budget}: {width} x {height}px from {cols} x {rows} service tiles")
    for row in range(rows):
        y0 = row * TILE_SIZE
        y1 = min(height, (row + 1) * TILE_SIZE)
        for col in range(cols):
            x0 = col * TILE_SIZE
            x1 = min(width, (col + 1) * TILE_SIZE)
            bbox = tile_bbox(full_bbox, width, height, x0, y0, x1, y1)
            print(f"  tile r{row + 1}c{col + 1}: {x1 - x0} x {y1 - y0}")
            tile = export_tile(bbox, x1 - x0, y1 - y0)
            output.paste(tile, (x0, y0))

    out_path = OUT_DIR / f"ortho_photo_context_{budget}.jpg"
    output.save(out_path, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    print(f"  wrote {out_path.relative_to(ROOT)}")
    return {
        "file": out_path.name,
        "width": width,
        "height": height,
        "longEdgePx": budget,
        "resolutionMApprox": round((max_e - min_e) / width, 2),
        "format": "jpeg",
        "quality": JPEG_QUALITY,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST_PATH.read_text())
    bbox = public_context_bounds(manifest)

    variants = {str(budget): build_texture(budget, bbox) for budget in TEXTURE_BUDGETS}
    min_e, min_n, max_e, max_n = bbox
    manifest["orthoPhoto"] = {
        "source": "USGS NAIP Plus / The National Map orthoimagery service",
        "service": SERVICE,
        "renderingRule": "NaturalColor",
        "targetCrs": TARGET_CRS,
        "sourceBounds": {
            "easting_m": [min_e, max_e],
            "northing_m": [min_n, max_n],
        },
        "copyright": "USGS, USDA, The National Map: Orthoimagery.",
        "variants": variants,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"updated {MANIFEST_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
