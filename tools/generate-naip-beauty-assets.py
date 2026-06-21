#!/usr/bin/env python3
"""Generate visual NAIP topo material assets from the Beaver MrSID mosaic."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image


SOURCE_BOUNDS = (231115.8, 4220376.0, 385650.0, 4279999.8)
FORGE_DETAIL_CENTER = (335781.0, 4262994.0)
FORGE_DETAIL_RESOLUTION_M = 0.6
FORGE_DETAIL_SIZE_PX = 8192
FORGE_DETAIL_SIZE_M = FORGE_DETAIL_RESOLUTION_M * FORGE_DETAIL_SIZE_PX
FORGE_DETAIL_BOUNDS = (
    FORGE_DETAIL_CENTER[0] - FORGE_DETAIL_SIZE_M * 0.5,
    FORGE_DETAIL_CENTER[1] - FORGE_DETAIL_SIZE_M * 0.5,
    FORGE_DETAIL_CENTER[0] + FORGE_DETAIL_SIZE_M * 0.5,
    FORGE_DETAIL_CENTER[1] + FORGE_DETAIL_SIZE_M * 0.5,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate filled NAIP overview and native-detail FORGE AOI WebP assets.",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(
            r"C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\Satellite Maps"
            r"\NAIP2024_Beaver\NAIP2024_Beaver.sid",
        ),
        help="Path to NAIP2024_Beaver.sid.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(
            "projects/utah-forge/data/geosee_processed/utah_forge_phase_3"
            "/public_context/naip_2024",
        ),
        help="Active project output directory.",
    )
    parser.add_argument(
        "--qgis-bat",
        type=Path,
        default=Path(r"C:\Program Files\QGIS 3.44.10\OSGeo4W.bat"),
        help="QGIS OSGeo4W.bat used to run gdal_translate.",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=94,
        help="WebP quality for active assets.",
    )
    parser.add_argument(
        "--keep-raw",
        action="store_true",
        help="Keep temporary raw alpha WebP extracts.",
    )
    return parser.parse_args()


def qgis_gdal_translate(
    qgis_bat: Path,
    source: Path,
    output: Path,
    bounds: tuple[float, float, float, float],
    size: tuple[int, int],
) -> None:
    min_x, min_y, max_x, max_y = bounds
    width, height = size
    command = [
        "cmd",
        "/c",
        "call",
        str(qgis_bat),
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
        # Lanczos keeps high-frequency detail at the downsample (vs bilinear).
        "-r",
        "lanczos",
        "-co",
        "QUALITY=94",
        str(source),
        str(output),
    ]
    print(" ".join(command))
    subprocess.run(command, check=True)


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


def coverage_alpha(
    source_alpha: np.ndarray,
    fill_radius_px: int,
    feather_radius_px: int,
) -> np.ndarray:
    valid = source_alpha > 8
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
    valid = alpha > 8
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
        for y_dir, x_dir in directions:
            neighbor_valid = shifted(filled, y_dir * step, x_dir * step)
            update = (~filled) & neighbor_valid
            if not update.any():
                continue
            neighbor_rgb = shifted(rgb, y_dir * step, x_dir * step)
            rgb[update] = neighbor_rgb[update]
            filled[update] = True
        step *= 2

    visual_alpha = coverage_alpha(alpha, fill_radius_px, feather_radius_px)
    output_rgba = np.dstack([rgb, visual_alpha])
    output = Image.fromarray(output_rgba, mode="RGBA")
    output.save(output_path, "WEBP", quality=quality, method=6)


def main() -> None:
    args = parse_args()
    source = args.source.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    if not source.exists():
        raise FileNotFoundError(source)
    if not args.qgis_bat.exists():
        raise FileNotFoundError(args.qgis_bat)

    jobs = [
        (
            "naip_2024_beauty_4096",
            SOURCE_BOUNDS,
            (4096, 1580),
            128,
            18,
        ),
        (
            "naip_2024_beauty_8192",
            SOURCE_BOUNDS,
            (8192, 3161),
            256,
            36,
        ),
        (
            "naip_2024_forge_detail_4096",
            FORGE_DETAIL_BOUNDS,
            (4096, 4096),
            192,
            24,
        ),
        (
            "naip_2024_forge_detail_8192",
            FORGE_DETAIL_BOUNDS,
            (8192, 8192),
            384,
            48,
        ),
    ]

    for stem, bounds, size, fill_radius_px, feather_radius_px in jobs:
        raw_path = output_dir / f"{stem}.raw.webp"
        final_path = output_dir / f"{stem}.webp"
        qgis_gdal_translate(args.qgis_bat, source, raw_path, bounds, size)
        fill_transparent_pixels(
            raw_path,
            final_path,
            args.quality,
            fill_radius_px,
            feather_radius_px,
        )
        if not args.keep_raw:
            raw_path.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
