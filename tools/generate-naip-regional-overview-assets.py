#!/usr/bin/env python3
"""Generate regional NAIP 2024 overview assets from county MrSID mosaics."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image


ARCHIVE_ROOT = Path(
    r"C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\Satellite Maps",
)
DEFAULT_OUTPUT_DIR = Path(
    "projects/utah-forge/data/geosee_processed/utah_forge_phase_3"
    "/public_context/naip_2024",
)
DEFAULT_QGIS_BAT = Path(r"C:\Program Files\QGIS 3.44.10\OSGeo4W.bat")
DEFAULT_REGIONAL_COG_PATH = (
    ARCHIVE_ROOT
    / "NAIP2024_Regional"
    / "naip_2024_regional_8192_epsg26912.cog.tif"
)
DEFAULT_REGIONAL_COG_LONG_EDGE = 8192
EXPECTED_SOURCE_EPSG = 26912
VRT_BOUNDS_TOLERANCE_M = 1.0
NAIP_MATERIAL_ID = "naip-2024-aerial"
NAIP_DIAGNOSTIC_LAYER_ID = "naip-2024-tile-diagnostics"
NAIP_DIAGNOSTIC_COLORS = {
    "beaver": "#ff2d2d",
    "garfield": "#ff8a2d",
    "iron": "#f4ff2d",
    "kane": "#8b5cf6",
    "millard": "#22ff66",
    "piute": "#00e5a8",
    "sanpete": "#26c6ff",
    "sevier": "#ff4df0",
    "wayne": "#ff6b9a",
}
NAIP_REFERENCE_FILES = (
    Path("projects/utah-forge/environment.json"),
    Path("projects/utah-forge/project.json"),
)
NAIP_REFERENCE_PAGE_DIR = Path("projects/utah-forge/pages")
CACHE_QUERY_RE = r"\?v=[A-Za-z0-9._~-]+"

# Intro alignment by tie points. Beaver is the fixed reference (no ties -> it
# never moves). Each other set carries two tie pairs that join its shared edge
# to Beaver's: pick a point on Beaver's edge and the matching point on the
# neighbour's edge (they get joined), then a second pair to set the edge
# direction (they get made parallel). The solver derives a rigid rotation +
# translation from those two pairs (trig only -- no scale, no shear, no quality
# loss) and bakes it into the source geotransform before the mosaic.
#
#   "ties": [
#       {"beaver": (bx1, by1), "source": (sx1, sy1)},   # joined point
#       {"beaver": (bx2, by2), "source": (sx2, sy2)},   # direction point
#   ]
#
# Coordinates are UTM metres (EPSG:26912), read off QGIS. Empty/absent ties =
# identity (the original .sid passes straight through, no resampling).
SOURCE_CATALOG = [
    {
        "id": "beaver",
        "label": "NAIP2024_Beaver",
        "path": ARCHIVE_ROOT / "NAIP2024_Beaver" / "NAIP2024_Beaver.sid",
        "bounds": (231115.8, 4220376.0, 385650.0, 4279999.8),
        "ties": [],
    },
    {
        "id": "garfield",
        "label": "NAIP2024_Garfield",
        "path": ARCHIVE_ROOT / "NAIP2024_Garfield" / "NAIP2024_Garfield.sid",
        "bounds": (345498.0, 4150140.0, 598806.0, 4227882.0),
        "ties": [],
    },
    {
        # Zero-rotation source. Keep identity ties; do not rotate during mosaic.
        "id": "iron",
        "label": "NAIP2024_Iron",
        "path": ARCHIVE_ROOT / "NAIP2024_Iron" / "NAIP2024_Iron.sid",
        "bounds": (229069.2, 4144854.0, 374310.0, 4231440.6),
        "ties": [],
    },
    {
        "id": "kane",
        "label": "NAIP2024_Kane",
        "path": ARCHIVE_ROOT / "NAIP2024_Kane" / "NAIP2024_Kane.sid",
        "bounds": (327396.0, 4094688.0, 533376.0, 4159242.0),
        "ties": [],
    },
    {
        "id": "millard",
        "label": "NAIP2024_Millard",
        "path": ARCHIVE_ROOT / "NAIP2024_Millard" / "NAIP2024_Millard.sid",
        "bounds": (232725.0, 4269006.0, 414066.0, 4384072.2),
        "ties": [],
    },
    {
        "id": "piute",
        "label": "NAIP2024_Piute",
        "path": ARCHIVE_ROOT / "NAIP2024_Piute" / "NAIP2024_Piute.sid",
        "bounds": (363432.0, 4219794.0, 434856.0, 4269588.0),
        "ties": [],
    },
    {
        "id": "sanpete",
        "label": "NAIP2024_Sanpete",
        "path": ARCHIVE_ROOT / "NAIP2024_Sanpete" / "NAIP2024_Sanpete.sid",
        "bounds": (407796.0, 4316604.0, 484164.0, 4414308.0),
        "ties": [],
    },
    {
        # Zero-rotation source. Keep identity ties; do not rotate during mosaic.
        "id": "sevier",
        "label": "NAIP2024_Sevier",
        "path": ARCHIVE_ROOT / "NAIP2024_Sevier" / "NAIP2024_Sevier.sid",
        "bounds": (363546.0, 4261122.0, 478572.0, 4324452.0),
        "ties": [],
    },
    {
        "id": "wayne",
        "label": "NAIP2024_Wayne",
        "path": ARCHIVE_ROOT / "NAIP2024_Wayne" / "NAIP2024_Wayne.sid",
        "bounds": (423108.0, 4219482.0, 598806.0, 4268742.0),
        "ties": [],
    },
]


def rigid_from_ties(ties: list[dict]) -> tuple[float, float, float] | None:
    """Solve a rigid (rotation + translation) source->Beaver transform.

    Returns (theta_rad, tx, ty) mapping a source world point p to
    R(theta) @ p + (tx, ty). Needs exactly two tie pairs: the first is the
    join point, the second sets the parallel direction. None = identity.
    """
    if not ties or len(ties) < 2:
        return None
    b1 = ties[0]["beaver"]
    s1 = ties[0]["source"]
    b2 = ties[1]["beaver"]
    s2 = ties[1]["source"]
    bv = (b2[0] - b1[0], b2[1] - b1[1])
    sv = (s2[0] - s1[0], s2[1] - s1[1])
    if (sv[0] == 0 and sv[1] == 0) or (bv[0] == 0 and bv[1] == 0):
        return None
    theta = math.atan2(bv[1], bv[0]) - math.atan2(sv[1], sv[0])
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)
    # t = b1 - R @ s1  (so the join point lands exactly on Beaver's edge).
    tx = b1[0] - (cos_t * s1[0] - sin_t * s1[1])
    ty = b1[1] - (sin_t * s1[0] + cos_t * s1[1])
    return (theta, tx, ty)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate regional NAIP 2024 overview WebP assets from the "
            "Utah county MrSID mosaics in SOURCE_CATALOG."
        ),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help="Active project output directory.",
    )
    parser.add_argument(
        "--qgis-bat",
        type=Path,
        default=DEFAULT_QGIS_BAT,
        help="QGIS OSGeo4W.bat used to run GDAL.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=94,
        help="WebP quality for active assets.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow replacing existing regional overview outputs.",
    )
    parser.add_argument(
        "--keep-raw",
        action="store_true",
        help="Keep temporary raw alpha WebP extracts beside final outputs.",
    )
    parser.add_argument(
        "--source-mode",
        choices=("auto", "county", "cog"),
        default="county",
        help=(
            "Input source for WebP generation. county composites the county "
            "sources directly; cog uses the pre-merged regional COG. auto uses "
            "county unless --overlap-mode=vrt is passed and the regional COG exists."
        ),
    )
    parser.add_argument(
        "--overlap-mode",
        choices=("best-interior", "vrt"),
        default="best-interior",
        help=(
            "How county source overlaps are resolved for WebP output. "
            "best-interior assigns each output pixel to the valid source farthest "
            "from its source edge; vrt preserves the historical GDAL VRT stack."
        ),
    )
    parser.add_argument(
        "--regional-cog",
        type=Path,
        default=DEFAULT_REGIONAL_COG_PATH,
        help="Canonical pre-merged regional COG path.",
    )
    parser.add_argument(
        "--build-regional-cog",
        action="store_true",
        help="Build the canonical regional COG before generating WebP outputs.",
    )
    parser.add_argument(
        "--cog-only",
        action="store_true",
        help="Build or validate the regional COG and skip WebP output generation.",
    )
    parser.add_argument(
        "--overwrite-cog",
        action="store_true",
        help="Allow replacing the canonical regional COG.",
    )
    parser.add_argument(
        "--cog-quality",
        type=int,
        default=92,
        help="WebP compression quality for the canonical regional COG.",
    )
    parser.add_argument(
        "--cog-long-edge",
        type=int,
        default=DEFAULT_REGIONAL_COG_LONG_EDGE,
        help="Long-edge pixel size for the canonical regional COG.",
    )
    return parser.parse_args()


def regional_bounds() -> tuple[float, float, float, float]:
    min_x = min(source["bounds"][0] for source in SOURCE_CATALOG)
    min_y = min(source["bounds"][1] for source in SOURCE_CATALOG)
    max_x = max(source["bounds"][2] for source in SOURCE_CATALOG)
    max_y = max(source["bounds"][3] for source in SOURCE_CATALOG)
    return (min_x, min_y, max_x, max_y)


def output_size(
    bounds: tuple[float, float, float, float],
    long_edge_px: int,
) -> tuple[int, int]:
    width_m = bounds[2] - bounds[0]
    height_m = bounds[3] - bounds[1]
    if width_m >= height_m:
        return (long_edge_px, max(1, round(long_edge_px * height_m / width_m)))
    return (max(1, round(long_edge_px * width_m / height_m)), long_edge_px)


def run_qgis(qgis_bat: Path, args: list[str]) -> None:
    command = ["cmd", "/c", "call", str(qgis_bat), *args]
    print(" ".join(command))
    subprocess.run(command, check=True)


def run_qgis_capture(qgis_bat: Path, args: list[str]) -> str:
    command = ["cmd", "/c", "call", str(qgis_bat), *args]
    print(" ".join(command))
    completed = subprocess.run(
        command,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if completed.stderr:
        print(completed.stderr, end="")
    return completed.stdout


def gdalinfo_json(qgis_bat: Path, source: Path) -> dict:
    output = run_qgis_capture(qgis_bat, ["gdalinfo", "-json", str(source)])
    json_start = output.find("{")
    json_end = output.rfind("}")
    if json_start < 0 or json_end <= json_start:
        raise ValueError(f"gdalinfo -json did not return JSON for {source}")
    return json.loads(output[json_start : json_end + 1])


def epsg_from_gdalinfo(info: dict) -> int | None:
    stac_epsg = info.get("stac", {}).get("proj:epsg")
    if isinstance(stac_epsg, int):
        return stac_epsg
    wkt = info.get("coordinateSystem", {}).get("wkt")
    if not isinstance(wkt, str):
        return None
    matches = re.findall(r'(?:ID|AUTHORITY)\["EPSG",\s*"?(\d+)"?\]', wkt)
    if not matches:
        return None
    return int(matches[-1])


def assert_sources_epsg_26912(qgis_bat: Path, catalog: list[dict]) -> None:
    for source in catalog:
        info = gdalinfo_json(qgis_bat, source["path"])
        epsg = epsg_from_gdalinfo(info)
        if epsg != EXPECTED_SOURCE_EPSG:
            raise ValueError(
                f"{source['label']} must be EPSG:{EXPECTED_SOURCE_EPSG}; "
                f"gdalinfo reported {epsg!r}.",
            )


def raster_bounds_from_gdalinfo(info: dict) -> tuple[float, float, float, float]:
    corners = info.get("cornerCoordinates")
    if not isinstance(corners, dict):
        raise ValueError("gdalinfo JSON is missing cornerCoordinates.")
    points = []
    for key in ("upperLeft", "upperRight", "lowerLeft", "lowerRight"):
        value = corners.get(key)
        if not isinstance(value, list) or len(value) < 2:
            raise ValueError(f"gdalinfo JSON is missing cornerCoordinates.{key}.")
        points.append((float(value[0]), float(value[1])))
    return (
        min(x for x, _ in points),
        min(y for _, y in points),
        max(x for x, _ in points),
        max(y for _, y in points),
    )


def assert_raster_bounds_match_region(
    qgis_bat: Path,
    raster_path: Path,
    expected_bounds: tuple[float, float, float, float],
) -> None:
    info = gdalinfo_json(qgis_bat, raster_path)
    epsg = epsg_from_gdalinfo(info)
    if epsg != EXPECTED_SOURCE_EPSG:
        raise ValueError(
            f"{raster_path} must be EPSG:{EXPECTED_SOURCE_EPSG}; "
            f"gdalinfo reported {epsg!r}.",
        )
    actual_bounds = raster_bounds_from_gdalinfo(info)
    deltas = [abs(actual - expected) for actual, expected in zip(actual_bounds, expected_bounds)]
    if any(delta > VRT_BOUNDS_TOLERANCE_M for delta in deltas):
        raise ValueError(
            f"{raster_path} bounds {actual_bounds} do not match regional bounds "
            f"{expected_bounds} within {VRT_BOUNDS_TOLERANCE_M} m.",
        )


def vrt_dataset_bounds(vrt_path: Path) -> tuple[float, float, float, float]:
    root = ET.parse(vrt_path).getroot()
    width_text = root.get("rasterXSize") or root.findtext("RasterXSize")
    height_text = root.get("rasterYSize") or root.findtext("RasterYSize")
    gt_text = root.findtext("GeoTransform")
    if width_text is None or height_text is None or gt_text is None:
        raise ValueError(f"{vrt_path} is missing RasterXSize/RasterYSize/GeoTransform")
    width = int(width_text)
    height = int(height_text)
    gt = [float(value) for value in gt_text.split(",")]
    if len(gt) != 6:
        raise ValueError(f"{vrt_path} GeoTransform must have 6 values")
    corners = []
    for column, row in ((0, 0), (width, 0), (0, height), (width, height)):
        x = gt[0] + column * gt[1] + row * gt[2]
        y = gt[3] + column * gt[4] + row * gt[5]
        corners.append((x, y))
    return (
        min(x for x, _ in corners),
        min(y for _, y in corners),
        max(x for x, _ in corners),
        max(y for _, y in corners),
    )


def assert_vrt_bounds_match_region(
    vrt_path: Path,
    expected_bounds: tuple[float, float, float, float],
) -> None:
    actual_bounds = vrt_dataset_bounds(vrt_path)
    deltas = [abs(actual - expected) for actual, expected in zip(actual_bounds, expected_bounds)]
    if any(delta > VRT_BOUNDS_TOLERANCE_M for delta in deltas):
        raise ValueError(
            f"{vrt_path} bounds {actual_bounds} do not match regional bounds "
            f"{expected_bounds} within {VRT_BOUNDS_TOLERANCE_M} m.",
        )


def qgis_gdal_buildvrt(qgis_bat: Path, sources: list[Path], output: Path) -> None:
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf8",
        suffix=".txt",
        delete=False,
    ) as source_list:
        source_list_path = Path(source_list.name)
        for source in sources:
            source_list.write(f"{source}\n")
    try:
        run_qgis(
            qgis_bat,
            [
                "gdalbuildvrt",
                "-overwrite",
                "-resolution",
                "highest",
                "-input_file_list",
                str(source_list_path),
                str(output),
            ],
        )
    finally:
        source_list_path.unlink(missing_ok=True)


def qgis_gdalwarp(
    qgis_bat: Path,
    source: Path,
    output: Path,
    resample: str = "bilinear",
) -> None:
    run_qgis(
        qgis_bat,
        [
            "gdalwarp",
            "-overwrite",
            "-r",
            resample,
            "-of",
            "GTiff",
            "-co",
            "TILED=YES",
            str(source),
            str(output),
        ],
    )


def qgis_gdal_translate_cog(
    qgis_bat: Path,
    source: Path,
    output: Path,
    bounds: tuple[float, float, float, float],
    size: tuple[int, int],
    quality: int,
) -> None:
    min_x, min_y, max_x, max_y = bounds
    width, height = size
    run_qgis(
        qgis_bat,
        [
            "gdal_translate",
            "-of",
            "COG",
            "-b",
            "1",
            "-b",
            "2",
            "-b",
            "3",
            "-b",
            "4",
            "-projwin",
            f"{min_x}",
            f"{max_y}",
            f"{max_x}",
            f"{min_y}",
            "-outsize",
            f"{width}",
            f"{height}",
            # Lanczos preserves high-frequency detail far better than bilinear
            # at the long-edge downsample, which is the irreversible source
            # ceiling for the draped ortho (see capture output quality audit).
            "-r",
            "lanczos",
            "-co",
            "COMPRESS=WEBP",
            "-co",
            f"QUALITY={quality}",
            "-co",
            "BLOCKSIZE=512",
            "-co",
            "OVERVIEWS=AUTO",
            "-co",
            "RESAMPLING=BILINEAR",
            "-co",
            "BIGTIFF=IF_SAFER",
            "-co",
            "NUM_THREADS=ALL_CPUS",
            str(source),
            str(output),
        ],
    )


def aligned_source(
    qgis_bat: Path,
    source: dict,
    temp_dir: Path,
) -> Path:
    """Apply `source`'s tie-point rigid transform; return a path for the mosaic.

    No ties -> the original .sid passes straight through (Beaver, identity).
    With ties, a single-source VRT is built, its geotransform is rewritten by
    the rigid (rotation + translation) solve so the neighbour's edge joins
    Beaver's parallel, and gdalwarp resamples it back to a north-up GeoTIFF
    that gdalbuildvrt can mosaic.
    """
    solved = rigid_from_ties(source.get("ties") or [])
    if solved is None:
        return source["path"]
    theta, tx, ty = solved
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)

    base_vrt = temp_dir / f"{source['id']}_base.vrt"
    qgis_gdal_buildvrt(qgis_bat, [source["path"]], base_vrt)

    tree = ET.parse(base_vrt)
    root = tree.getroot()
    gt_node = root.find("GeoTransform")
    if gt_node is None or gt_node.text is None:
        return source["path"]
    ox, px, rx, oy, ry, py = (float(v) for v in gt_node.text.split(","))

    # new_world = R @ world + t, folded into the pixel->world geotransform.
    new_ox = cos_t * ox - sin_t * oy + tx
    new_oy = sin_t * ox + cos_t * oy + ty
    new_px = cos_t * px - sin_t * ry
    new_rx = cos_t * rx - sin_t * py
    new_ry = sin_t * px + cos_t * ry
    new_py = sin_t * rx + cos_t * py
    gt_node.text = (
        f"{new_ox}, {new_px}, {new_rx}, {new_oy}, {new_ry}, {new_py}"
    )

    rot_vrt = temp_dir / f"{source['id']}_aligned.vrt"
    tree.write(rot_vrt, encoding="utf-8", xml_declaration=False)

    aligned_tif = temp_dir / f"{source['id']}_aligned.tif"
    qgis_gdalwarp(qgis_bat, rot_vrt, aligned_tif)
    return aligned_tif


def assert_catalog_sources_exist(catalog: list[dict]) -> None:
    for source in catalog:
        path = source["path"].resolve()
        if not path.exists():
            raise FileNotFoundError(path)


def aligned_catalog_sources(
    qgis_bat: Path,
    catalog: list[dict],
    temp_dir: Path,
) -> list[tuple[dict, Path]]:
    assert_catalog_sources_exist(catalog)
    assert_sources_epsg_26912(qgis_bat, catalog)
    return [
        (source, aligned_source(qgis_bat, source, temp_dir))
        for source in catalog
    ]


def build_county_vrt(
    qgis_bat: Path,
    catalog: list[dict],
    temp_dir: Path,
    bounds: tuple[float, float, float, float],
) -> Path:
    aligned_sources = [
        source_path
        for _, source_path in aligned_catalog_sources(qgis_bat, catalog, temp_dir)
    ]
    vrt_path = temp_dir / "naip_2024_regional.vrt"
    qgis_gdal_buildvrt(qgis_bat, aligned_sources, vrt_path)
    assert_vrt_bounds_match_region(vrt_path, bounds)
    return vrt_path


def build_regional_cog(
    qgis_bat: Path,
    catalog: list[dict],
    output_path: Path,
    temp_dir: Path,
    bounds: tuple[float, float, float, float],
    quality: int,
    long_edge_px: int,
    overwrite: bool,
) -> Path:
    if output_path.exists() and not overwrite:
        raise FileExistsError(
            f"{output_path} exists; pass --overwrite-cog to replace it.",
        )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    vrt_path = build_county_vrt(qgis_bat, catalog, temp_dir, bounds)
    qgis_gdal_translate_cog(
        qgis_bat,
        vrt_path,
        output_path,
        bounds,
        output_size(bounds, long_edge_px),
        quality,
    )
    assert_raster_bounds_match_region(qgis_bat, output_path, bounds)
    return output_path


def resolve_webp_source(
    args: argparse.Namespace,
    qgis_bat: Path,
    temp_dir: Path,
    bounds: tuple[float, float, float, float],
) -> Path:
    regional_cog = args.regional_cog.resolve()
    if args.build_regional_cog:
        build_regional_cog(
            qgis_bat,
            SOURCE_CATALOG,
            regional_cog,
            temp_dir,
            bounds,
            args.cog_quality,
            args.cog_long_edge,
            args.overwrite_cog,
        )
    if args.source_mode == "cog":
        if not regional_cog.exists():
            raise FileNotFoundError(
                f"{regional_cog} does not exist; pass --build-regional-cog first.",
            )
        assert_raster_bounds_match_region(qgis_bat, regional_cog, bounds)
        return regional_cog
    if (
        args.source_mode == "auto"
        and args.overlap_mode == "vrt"
        and regional_cog.exists()
    ):
        assert_raster_bounds_match_region(qgis_bat, regional_cog, bounds)
        return regional_cog
    return build_county_vrt(qgis_bat, SOURCE_CATALOG, temp_dir, bounds)


def qgis_gdal_translate(
    qgis_bat: Path,
    source: Path,
    output: Path,
    bounds: tuple[float, float, float, float],
    size: tuple[int, int],
    quality: int,
) -> None:
    min_x, min_y, max_x, max_y = bounds
    width, height = size
    run_qgis(
        qgis_bat,
        [
            "gdal_translate",
            "-of",
            "WEBP",
            "-b",
            "1",
            "-b",
            "2",
            "-b",
            "3",
            "-b",
            "4",
            "-projwin",
            f"{min_x}",
            f"{max_y}",
            f"{max_x}",
            f"{min_y}",
            "-outsize",
            f"{width}",
            f"{height}",
            # Lanczos preserves high-frequency detail far better than bilinear
            # at the long-edge downsample (irreversible source ceiling for the
            # draped ortho).
            "-r",
            "lanczos",
            "-co",
            f"QUALITY={quality}",
            str(source),
            str(output),
        ],
    )


def output_pixel_centers(
    bounds: tuple[float, float, float, float],
    size: tuple[int, int],
) -> tuple[np.ndarray, np.ndarray]:
    min_x, min_y, max_x, max_y = bounds
    width, height = size
    pixel_width = (max_x - min_x) / width
    pixel_height = (max_y - min_y) / height
    xs = min_x + (np.arange(width, dtype=np.float32) + 0.5) * pixel_width
    ys = max_y - (np.arange(height, dtype=np.float32) + 0.5) * pixel_height
    return xs, ys


def interior_score_grid(
    source_bounds: tuple[float, float, float, float],
    output_xs: np.ndarray,
    output_ys: np.ndarray,
) -> np.ndarray:
    min_x, min_y, max_x, max_y = source_bounds
    x_score = np.minimum(output_xs - min_x, max_x - output_xs)
    y_score = np.minimum(output_ys - min_y, max_y - output_ys)
    return np.minimum(y_score[:, None], x_score[None, :])


def build_best_interior_composite(
    qgis_bat: Path,
    aligned_sources: list[tuple[dict, Path]],
    output_path: Path,
    bounds: tuple[float, float, float, float],
    size: tuple[int, int],
    quality: int,
    temp_dir: Path,
    stem: str,
    keep_raw: bool,
) -> None:
    width, height = size
    output_xs, output_ys = output_pixel_centers(bounds, size)
    best_score = np.full((height, width), -np.inf, dtype=np.float32)
    best_pixels = np.zeros((height, width, 4), dtype=np.uint8)

    for source, source_path in aligned_sources:
        source_raw_path = temp_dir / f"{stem}_{source['id']}.raw.webp"
        qgis_gdal_translate(
            qgis_bat,
            source_path,
            source_raw_path,
            bounds,
            size,
            quality,
        )
        pixels = np.asarray(Image.open(source_raw_path).convert("RGBA"))
        valid = valid_pixel_mask(pixels)
        score = interior_score_grid(source["bounds"], output_xs, output_ys)
        update = valid & (score > best_score)
        if update.any():
            best_pixels[update] = pixels[update]
            best_score[update] = score[update]
        if not keep_raw:
            source_raw_path.unlink(missing_ok=True)
            source_raw_path.with_suffix(f"{source_raw_path.suffix}.aux.xml").unlink(
                missing_ok=True,
            )

    Image.fromarray(best_pixels, mode="RGBA").save(output_path, "PNG")


def shifted(array: np.ndarray, dy: int, dx: int) -> np.ndarray:
    output = np.zeros_like(array)
    height, width = array.shape[:2]
    src_y0 = max(0, -dy)
    src_y1 = min(height, height - dy)
    dst_y0 = max(0, dy)
    dst_y1 = min(height, height + dy)
    src_x0 = max(0, -dx)
    src_x1 = min(width, width - dx)
    dst_x0 = max(0, dx)
    dst_x1 = min(width, width + dx)
    if src_y1 <= src_y0 or src_x1 <= src_x0:
        return output
    output[dst_y0:dst_y1, dst_x0:dst_x1] = array[src_y0:src_y1, src_x0:src_x1]
    return output


def dilate_mask(mask: np.ndarray, radius_px: int) -> np.ndarray:
    expanded = mask.copy()
    directions = (
        (-1, -1),
        (-1, 0),
        (-1, 1),
        (0, -1),
        (0, 1),
        (1, -1),
        (1, 0),
        (1, 1),
    )
    step = 1
    while step <= radius_px:
        grown = expanded.copy()
        for y_dir, x_dir in directions:
            grown |= shifted(expanded, y_dir * step, x_dir * step)
        expanded = grown
        step *= 2
    return expanded


def valid_pixel_mask(pixels: np.ndarray) -> np.ndarray:
    alpha = pixels[:, :, 3]
    rgb = pixels[:, :, :3].astype(np.float32)
    luma = (
        (rgb[:, :, 0] * 0.2126)
        + (rgb[:, :, 1] * 0.7152)
        + (rgb[:, :, 2] * 0.0722)
    )
    opaque_near_black = (
        (alpha > 200)
        & (luma <= 48)
        & (np.max(rgb, axis=2) <= 80)
    )
    return (alpha > 8) & ~opaque_near_black


def coverage_alpha(
    source_alpha: np.ndarray,
    valid: np.ndarray,
    fill_radius_px: int,
    feather_radius_px: int,
) -> np.ndarray:
    expanded = dilate_mask(valid, fill_radius_px)
    expanded_alpha = Image.fromarray(
        (expanded.astype(np.uint8) * 255),
        mode="L",
    )
    if feather_radius_px > 0:
        from PIL import ImageFilter

        expanded_alpha = expanded_alpha.filter(
            ImageFilter.GaussianBlur(radius=feather_radius_px),
        )
    soft_alpha = np.asarray(expanded_alpha, dtype=np.uint8)
    return np.maximum(source_alpha, soft_alpha)


def fill_transparent_pixels(
    input_path: Path,
    output_path: Path,
    quality: int,
    fill_radius_px: int,
    feather_radius_px: int,
) -> None:
    image = Image.open(input_path).convert("RGBA")
    pixels = np.asarray(image, dtype=np.uint8).copy()
    rgb = pixels[:, :, :3].copy()
    alpha = pixels[:, :, 3]
    valid = valid_pixel_mask(pixels)
    filled = valid.copy()
    if not filled.any():
        raise ValueError(f"{input_path} has no valid alpha pixels")

    directions = (
        (-1, -1),
        (-1, 0),
        (-1, 1),
        (0, -1),
        (0, 1),
        (1, -1),
        (1, 0),
        (1, 1),
    )
    max_dim = max(filled.shape)
    step = 1
    while step < max_dim and not filled.all():
        source_rgb = rgb.copy()
        source_filled = filled.copy()
        for y_dir, x_dir in directions:
            neighbor_valid = shifted(source_filled, y_dir * step, x_dir * step)
            update = (~filled) & neighbor_valid
            if not update.any():
                continue
            neighbor_rgb = shifted(source_rgb, y_dir * step, x_dir * step)
            rgb[update] = neighbor_rgb[update]
            filled[update] = True
        step *= 2

    valid_alpha = np.where(valid, alpha, 0).astype(np.uint8)
    visual_alpha = coverage_alpha(
        valid_alpha,
        valid,
        fill_radius_px,
        feather_radius_px,
    )
    output_rgba = np.dstack([rgb, visual_alpha])
    output = Image.fromarray(output_rgba, mode="RGBA")
    output.save(output_path, "WEBP", quality=quality, method=6)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def versioned_project_path(path: Path) -> tuple[str, str]:
    repo_root = Path.cwd().resolve()
    try:
        relative = path.resolve().relative_to(repo_root)
    except ValueError:
        return ("", "")
    digest = file_sha256(path)
    return (relative.as_posix(), digest)


def county_names_from_catalog(catalog: list[dict]) -> list[str]:
    names: list[str] = []
    for source in catalog:
        label = str(source.get("label", ""))
        names.append(label.removeprefix("NAIP2024_") or str(source["id"]).title())
    return names


def joined_county_names(catalog: list[dict]) -> str:
    names = county_names_from_catalog(catalog)
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + f", and {names[-1]}"


def bounds_json(bounds: tuple[float, float, float, float]) -> list[float]:
    return [float(value) for value in bounds]


def same_bounds(
    left: object,
    right: tuple[float, float, float, float],
    tolerance: float = 1e-6,
) -> bool:
    if not isinstance(left, list) or len(left) != len(right):
        return False
    return all(
        abs(float(left[index]) - right[index]) <= tolerance
        for index in range(len(right))
    )


def source_display_name(source: dict) -> str:
    label = str(source.get("label", ""))
    return label.removeprefix("NAIP2024_") or str(source["id"]).title()


def diagnostic_tile_entries(catalog: list[dict]) -> list[dict]:
    entries: list[dict] = []
    for source in catalog:
        source_id = str(source["id"])
        entries.append(
            {
                "id": source_id,
                "label": f"NAIP {source_display_name(source)}",
                "color": NAIP_DIAGNOSTIC_COLORS.get(source_id, "#ff2d2d"),
                "bounds": bounds_json(source["bounds"]),
            },
        )
    return entries


def ensure_naip_diagnostic_crs_registration(metadata: dict) -> bool:
    if isinstance(metadata.get("crsRegistration"), dict):
        return False
    metadata["crsRegistration"] = {
        "horizontalCrs": "EPSG:26912",
        "verticalDatum": "public terrain/vector source elevation or draped terrain context in metres",
        "units": "m",
        "coordinateBasis": "utm",
        "origin": {
            "easting_m": 341467.35,
            "northing_m": 4273374.5,
            "elevation_m": 0,
        },
        "rotationDeg": 0,
        "registrationStatus": "unverified",
        "accuracyClaimStatus": "CRS/datum review required",
        "notes": (
            "NAIP county-source diagnostic bounds are derived from EPSG:26912 "
            "source rasters and remain review-gated for exact CRS/datum claims."
        ),
    }
    return True


def object_uses_regional_naip(value: dict) -> bool:
    if value.get("materialPreset") == f"image:{NAIP_MATERIAL_ID}":
        return True
    for key in (
        "orthoPhotoPath",
        "orthoPhotoTexture4096Path",
        "orthoPhotoTexture8192Path",
        "texture4096Path",
        "texture8192Path",
    ):
        path = value.get(key)
        if isinstance(path, str) and "naip_2024_regional_" in path:
            return True
    return False


def update_naip_metadata_value(
    value: object,
    catalog: list[dict],
    bounds: tuple[float, float, float, float],
) -> bool:
    changed = False
    if isinstance(value, dict):
        if value.get("id") == NAIP_MATERIAL_ID and not same_bounds(
            value.get("bounds"),
            bounds,
        ):
            value["bounds"] = bounds_json(bounds)
            changed = True

        if (
            "orthoPhotoBounds" in value
            and object_uses_regional_naip(value)
            and not same_bounds(
                value.get("orthoPhotoBounds"),
                bounds,
            )
        ):
            value["orthoPhotoBounds"] = bounds_json(bounds)
            changed = True

        if (
            value.get("id") == NAIP_DIAGNOSTIC_LAYER_ID
            and isinstance(value.get("metadata"), dict)
        ):
            metadata = value["metadata"]
            changed = ensure_naip_diagnostic_crs_registration(metadata) or changed
            tiles = diagnostic_tile_entries(catalog)
            if metadata.get("naipTiles") != tiles:
                metadata["naipTiles"] = tiles
                changed = True
            if metadata.get("derivedArtifactDate") != "2026-06-03":
                metadata["derivedArtifactDate"] = "2026-06-03"
                changed = True
            notes = (
                "Temporary diagnostic overlay for locating NAIP county-source "
                "seams and missing-tile artifacts. Rectangles show source "
                f"raster bounds for the current {len(catalog)}-county regional "
                "overview, not a crop request."
            )
            if metadata.get("notes") != notes:
                metadata["notes"] = notes
                changed = True

        for child in value.values():
            changed = update_naip_metadata_value(child, catalog, bounds) or changed
    elif isinstance(value, list):
        for child in value:
            changed = update_naip_metadata_value(child, catalog, bounds) or changed
    return changed


def update_naip_manifest_metadata_and_cache_versions(
    output_dir: Path,
    catalog: list[dict],
    bounds: tuple[float, float, float, float],
    versions_by_file: dict[str, str],
) -> None:
    manifest_path = output_dir / "manifest.json"
    if not manifest_path.exists():
        return
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    county_names = joined_county_names(catalog)
    source = data.setdefault("source", {})
    source["name"] = f"NAIP 2024 {county_names} County MrSID mosaics"
    source["archivePaths"] = [
        source_entry["path"].as_posix()
        for source_entry in catalog
    ]
    data["sourceBounds"] = list(bounds)
    aoi = data.setdefault("aoi", {})
    aoi["anchor"] = f"Combined available NAIP 2024 {county_names} County MrSID extents"
    aoi["bounds"] = list(bounds)
    aoi["widthM"] = bounds[2] - bounds[0]
    aoi["heightM"] = bounds[3] - bounds[1]

    variants = data.get("variants")
    if isinstance(variants, dict):
        for key, filename in (
            ("4096", "naip_2024_regional_4096.webp"),
            ("8192", "naip_2024_regional_8192.webp"),
        ):
            digest = versions_by_file.get(filename)
            variant = variants.get(key)
            if not digest or not isinstance(variant, dict):
                continue
            token = digest[:16]
            variant["sha256"] = digest
            variant["cacheVersion"] = token
            variant["versionedFile"] = f"{filename}?v={token}"
            variant["width"], variant["height"] = output_size(bounds, int(key))
            variant["resolutionMApprox"] = round(
                max(
                    (bounds[2] - bounds[0]) / variant["width"],
                    (bounds[3] - bounds[1]) / variant["height"],
                ),
                2,
            )
    processing = data.setdefault("processing", {})
    notes = processing.setdefault("notes", [])
    if isinstance(notes, list):
        replacement = (
            "Regional overview assets keep the combined "
            f"{len(catalog)}-county MrSID extent but use alpha-aware color "
            "dilation and feathering so tile-shaped gaps do not dominate "
            "the presentation."
        )
        for index, note in enumerate(notes):
            if isinstance(note, str) and "Regional overview assets keep" in note:
                notes[index] = replacement
                break
        else:
            notes.insert(0, replacement)
    manifest_path.write_text(
        f"{json.dumps(data, indent=2)}\n",
        encoding="utf-8",
    )


def update_text_naip_references(
    target_path: Path,
    replacements: dict[str, str],
) -> bool:
    if not target_path.exists():
        return False
    text = target_path.read_text(encoding="utf-8")
    next_text = text
    for unversioned_path, digest in replacements.items():
        token = digest[:16]
        pattern = re.compile(
            rf"{re.escape(unversioned_path)}(?:{CACHE_QUERY_RE})?"
        )
        next_text = pattern.sub(f"{unversioned_path}?v={token}", next_text)
    if next_text == text:
        return False
    target_path.write_text(next_text, encoding="utf-8")
    return True


def update_project_naip_cache_refs(
    output_dir: Path,
    versions_by_file: dict[str, str],
) -> None:
    repo_root = Path.cwd().resolve()
    replacements: dict[str, str] = {}
    for filename, digest in versions_by_file.items():
        relative_path, _ = versioned_project_path(output_dir / filename)
        if relative_path:
            replacements[relative_path] = digest
    if not replacements:
        return

    targets = [repo_root / path for path in NAIP_REFERENCE_FILES]
    pages_dir = repo_root / NAIP_REFERENCE_PAGE_DIR
    if pages_dir.exists():
        targets.extend(sorted(pages_dir.glob("*.json")))

    changed = [
        path.relative_to(repo_root).as_posix()
        for path in targets
        if update_text_naip_references(path, replacements)
    ]
    if changed:
        print(
            "Updated NAIP cache-busted references: "
            + ", ".join(changed),
        )


def update_project_naip_metadata_refs(
    catalog: list[dict],
    bounds: tuple[float, float, float, float],
) -> None:
    repo_root = Path.cwd().resolve()
    targets = [repo_root / path for path in NAIP_REFERENCE_FILES]
    pages_dir = repo_root / NAIP_REFERENCE_PAGE_DIR
    if pages_dir.exists():
        targets.extend(sorted(pages_dir.glob("*.json")))

    changed: list[str] = []
    for target_path in targets:
        if not target_path.exists():
            continue
        data = json.loads(target_path.read_text(encoding="utf-8"))
        if not update_naip_metadata_value(data, catalog, bounds):
            continue
        target_path.write_text(
            f"{json.dumps(data, indent=2)}\n",
            encoding="utf-8",
        )
        changed.append(target_path.relative_to(repo_root).as_posix())

    if changed:
        print(
            "Updated NAIP bounds and diagnostic metadata: "
            + ", ".join(changed),
        )


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    qgis_bat = args.qgis_bat.resolve()
    if not qgis_bat.exists():
        raise FileNotFoundError(qgis_bat)

    bounds = regional_bounds()
    if args.cog_only:
        with tempfile.TemporaryDirectory(prefix="geosee-naip-regional-") as temp:
            temp_dir = Path(temp)
            regional_cog = args.regional_cog.resolve()
            if args.build_regional_cog:
                build_regional_cog(
                    qgis_bat,
                    SOURCE_CATALOG,
                    regional_cog,
                    temp_dir,
                    bounds,
                    args.cog_quality,
                    args.cog_long_edge,
                    args.overwrite_cog,
                )
            else:
                if not regional_cog.exists():
                    raise FileNotFoundError(
                        f"{regional_cog} does not exist; pass --build-regional-cog.",
                    )
                assert_raster_bounds_match_region(qgis_bat, regional_cog, bounds)
        return

    jobs = [
        ("naip_2024_regional_4096", output_size(bounds, 4096), 128, 18),
        ("naip_2024_regional_8192", output_size(bounds, 8192), 256, 36),
    ]
    for stem, _, _, _ in jobs:
        final_path = output_dir / f"{stem}.webp"
        if final_path.exists() and not args.overwrite:
            raise FileExistsError(
                f"{final_path} exists; pass --overwrite to replace it.",
            )

    with tempfile.TemporaryDirectory(prefix="geosee-naip-regional-") as temp:
        temp_dir = Path(temp)
        use_best_interior = (
            args.overlap_mode == "best-interior" and args.source_mode != "cog"
        )
        aligned_sources = (
            aligned_catalog_sources(qgis_bat, SOURCE_CATALOG, temp_dir)
            if use_best_interior
            else None
        )
        source_path = (
            None
            if use_best_interior
            else resolve_webp_source(args, qgis_bat, temp_dir, bounds)
        )
        for stem, size, fill_radius_px, feather_radius_px in jobs:
            raw_path = output_dir / f"{stem}.raw.webp"
            final_path = output_dir / f"{stem}.webp"
            fill_source_path: Path
            if use_best_interior:
                composite_path = (
                    output_dir / f"{stem}.raw.png"
                    if args.keep_raw
                    else temp_dir / f"{stem}.raw.png"
                )
                if aligned_sources is None:
                    raise RuntimeError("Expected aligned NAIP sources.")
                build_best_interior_composite(
                    qgis_bat,
                    aligned_sources,
                    composite_path,
                    bounds,
                    size,
                    args.quality,
                    temp_dir,
                    stem,
                    args.keep_raw,
                )
                fill_source_path = composite_path
            else:
                if source_path is None:
                    raise RuntimeError("Expected a NAIP raster source.")
                qgis_gdal_translate(
                    qgis_bat,
                    source_path,
                    raw_path,
                    bounds,
                    size,
                    args.quality,
                )
                fill_source_path = raw_path
            first_pass_path = temp_dir / f"{stem}.filled.webp"
            fill_transparent_pixels(
                fill_source_path,
                first_pass_path,
                args.quality,
                fill_radius_px,
                feather_radius_px,
            )
            fill_transparent_pixels(
                first_pass_path,
                final_path,
                args.quality,
                fill_radius_px,
                feather_radius_px,
            )
            if not args.keep_raw and use_best_interior:
                fill_source_path.unlink(missing_ok=True)
            if not args.keep_raw and not use_best_interior:
                raw_path.unlink(missing_ok=True)
                raw_path.with_suffix(f"{raw_path.suffix}.aux.xml").unlink(
                    missing_ok=True,
                )

    versions_by_file: dict[str, str] = {}
    for stem, _, _, _ in jobs:
        final_path = output_dir / f"{stem}.webp"
        _, digest = versioned_project_path(final_path)
        if digest:
            versions_by_file[final_path.name] = digest
    update_naip_manifest_metadata_and_cache_versions(
        output_dir,
        SOURCE_CATALOG,
        bounds,
        versions_by_file,
    )
    update_project_naip_metadata_refs(SOURCE_CATALOG, bounds)
    update_project_naip_cache_refs(output_dir, versions_by_file)


if __name__ == "__main__":
    main()
