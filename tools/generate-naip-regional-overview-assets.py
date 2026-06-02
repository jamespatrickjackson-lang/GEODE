#!/usr/bin/env python3
"""Generate regional NAIP 2024 overview assets from county MrSID mosaics."""

from __future__ import annotations

import argparse
import math
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
        # West/south neighbour. Eyeball estimate: its Beaver-facing edge sits
        # ~1.2 km off and ~0.6 deg CCW. Ties pull it onto Beaver's west edge
        # (x=231115.8). Re-bake and nudge the source numbers if the seam moves
        # the wrong way.
        "id": "iron",
        "label": "NAIP2024_Iron",
        "path": ARCHIVE_ROOT / "NAIP2024_Iron" / "NAIP2024_Iron.sid",
        "bounds": (229069.2, 4144854.0, 374310.0, 4231440.6),
        "ties": [
            {"beaver": (231115.8, 4221500.0), "source": (229950.0, 4221250.0)},
            {"beaver": (231115.8, 4230500.0), "source": (230100.0, 4230150.0)},
        ],
    },
    {
        "id": "millard",
        "label": "NAIP2024_Millard",
        "path": ARCHIVE_ROOT / "NAIP2024_Millard" / "NAIP2024_Millard.sid",
        "bounds": (232725.0, 4269006.0, 414066.0, 4384072.2),
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
        # East neighbour. Eyeball estimate: its Beaver-facing (west) edge sits
        # ~1.2 km east and ~0.6 deg CCW. Ties pull it onto Beaver's east edge
        # (x=385650.0). Re-bake and nudge the source numbers to taste.
        "id": "sevier",
        "label": "NAIP2024_Sevier",
        "path": ARCHIVE_ROOT / "NAIP2024_Sevier" / "NAIP2024_Sevier.sid",
        "bounds": (363546.0, 4261122.0, 478572.0, 4324452.0),
        "ties": [
            {"beaver": (385650.0, 4263000.0), "source": (386850.0, 4262750.0)},
            {"beaver": (385650.0, 4278000.0), "source": (386700.0, 4277650.0)},
        ],
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
            "Generate regional NAIP 2024 overview WebP assets from Beaver, "
            "Iron, Millard, Sanpete, and Sevier MrSID mosaics."
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
            "-r",
            "bilinear",
            "-co",
            f"QUALITY={quality}",
            str(source),
            str(output),
        ],
    )


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


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    qgis_bat = args.qgis_bat.resolve()
    if not qgis_bat.exists():
        raise FileNotFoundError(qgis_bat)

    sources = [source["path"].resolve() for source in SOURCE_CATALOG]
    for source in sources:
        if not source.exists():
            raise FileNotFoundError(source)

    bounds = regional_bounds()
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
        # Join each neighbour's edge to Beaver via its tie points (Beaver fixed).
        aligned_sources = [
            aligned_source(qgis_bat, source, temp_dir)
            for source in SOURCE_CATALOG
        ]
        vrt_path = temp_dir / "naip_2024_regional.vrt"
        qgis_gdal_buildvrt(qgis_bat, aligned_sources, vrt_path)
        for stem, size, fill_radius_px, feather_radius_px in jobs:
            raw_path = output_dir / f"{stem}.raw.webp"
            final_path = output_dir / f"{stem}.webp"
            qgis_gdal_translate(
                qgis_bat,
                vrt_path,
                raw_path,
                bounds,
                size,
                args.quality,
            )
            first_pass_path = temp_dir / f"{stem}.filled.webp"
            fill_transparent_pixels(
                raw_path,
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
            if not args.keep_raw:
                raw_path.unlink(missing_ok=True)
                raw_path.with_suffix(f"{raw_path.suffix}.aux.xml").unlink(
                    missing_ok=True,
                )


if __name__ == "__main__":
    main()
