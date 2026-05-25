#!/usr/bin/env python3
"""Audit close-zoom quality for the Utah FORGE NAIP topo material.

The audit compares one UTM crop across the raw MrSID source and the active
GeoSee-derived NAIP assets. It intentionally writes only ignored artifacts under
test-results so the result can guide rendering or asset changes without adding
large files to source control.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont


SOURCE_BOUNDS = (231115.8, 4220376.0, 385650.0, 4279999.8)
FORGE_DETAIL_BOUNDS = (333323.4, 4260536.4, 338238.6, 4265451.6)
FORGE_DETAIL_CENTER = (335781.0, 4262994.0)
SOURCE_PIXEL_SIZE_M = 0.6
CROP_SIZE_PX = 1024
CROP_SIZE_M = CROP_SIZE_PX * SOURCE_PIXEL_SIZE_M
DEFAULT_OUTPUT_DIR = Path("docs/dev-context/Audits/naip-quality")
DEFAULT_ASSET_DIR = Path(
    "projects/utah-forge/data/geosee_processed/utah_forge_phase_3"
    "/public_context/naip_2024",
)
DEFAULT_SOURCE = Path(
    r"C:\GeoSee\GeoSee_Archive\projects\utah-forge\data\Satellite Maps"
    r"\NAIP2024_Beaver\NAIP2024_Beaver.sid",
)
DEFAULT_QGIS_BAT = Path(r"C:\Program Files\QGIS 3.44.10\OSGeo4W.bat")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Compare NAIP raw-source and active topo-material asset crops for "
            "close-zoom quality evidence."
        ),
    )
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--asset-dir", type=Path, default=DEFAULT_ASSET_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--qgis-bat", type=Path, default=DEFAULT_QGIS_BAT)
    parser.add_argument(
        "--center-x",
        type=float,
        default=FORGE_DETAIL_CENTER[0],
        help="UTM crop center easting.",
    )
    parser.add_argument(
        "--center-y",
        type=float,
        default=FORGE_DETAIL_CENTER[1],
        help="UTM crop center northing.",
    )
    return parser.parse_args()


def qgis_gdal_translate_png(
    qgis_bat: Path,
    source: Path,
    output: Path,
    bounds: tuple[float, float, float, float],
    size_px: int,
) -> None:
    min_x, min_y, max_x, max_y = bounds
    command = [
        "cmd",
        "/c",
        "call",
        str(qgis_bat),
        "gdal_translate",
        "-of",
        "PNG",
        "-b",
        "1",
        "-b",
        "2",
        "-b",
        "3",
        "-projwin",
        f"{min_x:.6f}",
        f"{max_y:.6f}",
        f"{max_x:.6f}",
        f"{min_y:.6f}",
        "-outsize",
        str(size_px),
        str(size_px),
        "-r",
        "nearest",
        str(source),
        str(output),
    ]
    subprocess.run(command, check=True)


def crop_bounds(center_x: float, center_y: float) -> tuple[float, float, float, float]:
    half_size = CROP_SIZE_M * 0.5
    return (
        center_x - half_size,
        center_y - half_size,
        center_x + half_size,
        center_y + half_size,
    )


def clamp(value: int, low: int, high: int) -> int:
    return min(high, max(low, value))


def pixel_window_for_bounds(
    image_size: tuple[int, int],
    image_bounds: tuple[float, float, float, float],
    crop: tuple[float, float, float, float],
) -> tuple[int, int, int, int]:
    width, height = image_size
    min_x, min_y, max_x, max_y = image_bounds
    crop_min_x, crop_min_y, crop_max_x, crop_max_y = crop
    world_width = max_x - min_x
    world_height = max_y - min_y
    x0 = math.floor((crop_min_x - min_x) / world_width * width)
    x1 = math.ceil((crop_max_x - min_x) / world_width * width)
    y0 = math.floor((max_y - crop_max_y) / world_height * height)
    y1 = math.ceil((max_y - crop_min_y) / world_height * height)
    return (
        clamp(x0, 0, width),
        clamp(y0, 0, height),
        clamp(x1, 0, width),
        clamp(y1, 0, height),
    )


def load_asset_crop(
    path: Path,
    image_bounds: tuple[float, float, float, float],
    crop: tuple[float, float, float, float],
) -> tuple[Image.Image, dict[str, Any]]:
    image = Image.open(path)
    window = pixel_window_for_bounds(image.size, image_bounds, crop)
    crop_image = image.crop(window).convert("RGB")
    native_width = max(1, window[2] - window[0])
    native_height = max(1, window[3] - window[1])
    world_width = image_bounds[2] - image_bounds[0]
    world_height = image_bounds[3] - image_bounds[1]
    return crop_image, {
        "path": str(path),
        "imageMode": image.mode,
        "hasAlpha": "A" in image.getbands(),
        "dimensions": {"width": image.width, "height": image.height},
        "fileSizeBytes": path.stat().st_size,
        "bytesPerPixel": round(path.stat().st_size / (image.width * image.height), 6),
        "pixelWindow": {
            "x": window[0],
            "y": window[1],
            "width": native_width,
            "height": native_height,
        },
        "effectiveResolutionM": {
            "x": round(world_width / image.width, 4),
            "y": round(world_height / image.height, 4),
        },
    }


def luma_array(image: Image.Image) -> np.ndarray:
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    return rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722


def sharpness_metrics(image: Image.Image) -> dict[str, float]:
    gray = luma_array(image)
    center = gray[1:-1, 1:-1]
    laplacian = (
        -4.0 * center
        + gray[:-2, 1:-1]
        + gray[2:, 1:-1]
        + gray[1:-1, :-2]
        + gray[1:-1, 2:]
    )
    grad_y = np.abs(np.diff(gray, axis=0))
    grad_x = np.abs(np.diff(gray, axis=1))
    return {
        "laplacianVariance": round(float(np.var(laplacian)), 4),
        "meanAbsGradient": round(
            float((np.mean(grad_x) + np.mean(grad_y)) * 0.5),
            4,
        ),
    }


def comparison_metrics(reference: Image.Image, candidate: Image.Image) -> dict[str, float]:
    ref = np.asarray(reference.convert("RGB"), dtype=np.float32)
    cand = np.asarray(candidate.convert("RGB").resize(reference.size, Image.Resampling.LANCZOS), dtype=np.float32)
    mse = float(np.mean((ref - cand) ** 2))
    psnr = 99.0 if mse <= 0.000001 else 20.0 * math.log10(255.0 / math.sqrt(mse))
    return {
        "mseVsRawNative": round(mse, 4),
        "psnrVsRawNativeDb": round(psnr, 4),
    }


def labeled_tile(image: Image.Image, label: str) -> Image.Image:
    tile_size = 512
    label_height = 38
    thumb = image.convert("RGB").resize((tile_size, tile_size), Image.Resampling.LANCZOS)
    output = Image.new("RGB", (tile_size, tile_size + label_height), "#101417")
    output.paste(thumb, (0, label_height))
    draw = ImageDraw.Draw(output)
    try:
        font = ImageFont.truetype("arial.ttf", 17)
    except OSError:
        font = ImageFont.load_default()
    draw.text((12, 10), label, fill="#f4f0e8", font=font)
    return output


def save_contact_sheet(items: list[tuple[str, Image.Image]], output_path: Path) -> None:
    tiles = [labeled_tile(image, label) for label, image in items]
    gap = 12
    width = sum(tile.width for tile in tiles) + gap * (len(tiles) - 1)
    height = max(tile.height for tile in tiles)
    sheet = Image.new("RGB", (width, height), "#050607")
    x = 0
    for tile in tiles:
        sheet.paste(tile, (x, 0))
        x += tile.width + gap
    sheet.save(output_path)


def interpretation(entries: dict[str, dict[str, Any]]) -> list[str]:
    notes: list[str] = []
    detail_4096 = entries.get("forgeDetail4096")
    detail_8192 = entries.get("forgeDetail8192")
    overview_8192 = entries.get("beautyOverview8192")
    if detail_4096 and detail_8192:
        res_4096 = detail_4096["asset"]["effectiveResolutionM"]["x"]
        res_8192 = detail_8192["asset"]["effectiveResolutionM"]["x"]
        notes.append(
            f"The 4096 detail tile is about {res_4096} m/px; the 8192 detail tile is about {res_8192} m/px."
        )
    if overview_8192:
        res = overview_8192["asset"]["effectiveResolutionM"]["x"]
        notes.append(
            f"The full-extent 8192 NAIP overview is about {res} m/px, so close zoom must use the detail overlay for native-looking imagery."
        )
    if detail_4096 and detail_8192:
        sharp_4096 = detail_4096["normalizedMetrics"]["laplacianVariance"]
        sharp_8192 = detail_8192["nativeMetrics"]["laplacianVariance"]
        if sharp_8192 > sharp_4096 * 1.25:
            notes.append(
                "The 8192 detail crop has materially more high-frequency detail than the default 4096 crop."
            )
    notes.append(
        "If browser screenshots look softer than the 8192 crop, the next owner is runtime state: selected budget, camera location inside the detail overlay, texture filtering, mipmaps, hillshade blend, or terrain mesh density."
    )
    return notes


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    source = args.source.resolve()
    qgis_bat = args.qgis_bat.resolve()
    asset_dir = args.asset_dir.resolve()
    if not source.exists():
        raise FileNotFoundError(source)
    if not qgis_bat.exists():
        raise FileNotFoundError(qgis_bat)
    if not asset_dir.exists():
        raise FileNotFoundError(asset_dir)

    crop = crop_bounds(args.center_x, args.center_y)
    raw_crop_path = output_dir / "raw-source-native-1024.png"
    qgis_gdal_translate_png(qgis_bat, source, raw_crop_path, crop, CROP_SIZE_PX)
    raw_native = Image.open(raw_crop_path).convert("RGB")

    asset_specs = {
        "forgeDetail8192": (
            "Detail 8192 native",
            asset_dir / "naip_2024_forge_detail_8192.webp",
            FORGE_DETAIL_BOUNDS,
        ),
        "forgeDetail4096": (
            "Detail 4096 upscaled",
            asset_dir / "naip_2024_forge_detail_4096.webp",
            FORGE_DETAIL_BOUNDS,
        ),
        "beautyOverview8192": (
            "Overview 8192 upscaled",
            asset_dir / "naip_2024_beauty_8192.webp",
            SOURCE_BOUNDS,
        ),
        "beautyOverview4096": (
            "Overview 4096 upscaled",
            asset_dir / "naip_2024_beauty_4096.webp",
            SOURCE_BOUNDS,
        ),
    }
    report_entries: dict[str, dict[str, Any]] = {}
    contact_items: list[tuple[str, Image.Image]] = [("Raw MrSID native", raw_native)]
    raw_metrics = sharpness_metrics(raw_native)

    for key, (label, path, bounds) in asset_specs.items():
        crop_image, metadata = load_asset_crop(path, bounds, crop)
        native_output = output_dir / f"{key}-native-crop.png"
        normalized_output = output_dir / f"{key}-normalized-1024.png"
        normalized = crop_image.resize(raw_native.size, Image.Resampling.LANCZOS)
        crop_image.save(native_output)
        normalized.save(normalized_output)
        report_entries[key] = {
            "asset": metadata,
            "nativeCropPath": str(native_output),
            "normalizedCropPath": str(normalized_output),
            "nativeMetrics": sharpness_metrics(crop_image),
            "normalizedMetrics": sharpness_metrics(normalized),
            "comparisonToRaw": comparison_metrics(raw_native, normalized),
        }
        contact_items.append((label, normalized))

    save_contact_sheet(contact_items, output_dir / "comparison.png")
    report = {
        "schema": "geosee.naip-quality-audit.v1",
        "crop": {
            "center": [args.center_x, args.center_y],
            "bounds": list(crop),
            "sizeM": CROP_SIZE_M,
            "nativeSizePx": CROP_SIZE_PX,
            "sourcePixelSizeM": SOURCE_PIXEL_SIZE_M,
        },
        "source": {
            "path": str(source),
            "bounds": list(SOURCE_BOUNDS),
            "rawCropPath": str(raw_crop_path),
            "rawNativeMetrics": raw_metrics,
        },
        "assets": report_entries,
        "interpretation": interpretation(report_entries),
        "artifacts": {
            "comparison": str(output_dir / "comparison.png"),
            "report": str(output_dir / "report.json"),
        },
    }
    (output_dir / "report.json").write_text(
        json.dumps(report, indent=2),
        encoding="utf8",
    )
    summary_lines = [
        "# NAIP Quality Audit",
        "",
        f"Crop center: `{args.center_x:.1f}, {args.center_y:.1f}`",
        f"Comparison sheet: `{output_dir / 'comparison.png'}`",
        "",
        "## Interpretation",
        "",
    ]
    summary_lines.extend(f"- {note}" for note in report["interpretation"])
    summary_lines.extend(["", "## Key Metrics", ""])
    for key, entry in report_entries.items():
        asset = entry["asset"]
        metrics = entry["normalizedMetrics"]
        comparison = entry["comparisonToRaw"]
        summary_lines.append(
            "- "
            f"`{key}`: {asset['dimensions']['width']}x{asset['dimensions']['height']}, "
            f"{asset['effectiveResolutionM']['x']} m/px, "
            f"lapVar {metrics['laplacianVariance']}, "
            f"PSNR {comparison['psnrVsRawNativeDb']} dB"
        )
    (output_dir / "report.md").write_text(
        "\n".join(summary_lines) + "\n",
        encoding="utf8",
    )
    print(f"Wrote {output_dir / 'report.json'}")
    print(f"Wrote {output_dir / 'comparison.png'}")


if __name__ == "__main__":
    main()
