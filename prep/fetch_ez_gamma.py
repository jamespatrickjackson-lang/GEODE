from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = (
    ROOT
    / "data"
    / "source"
    / "Geophysical_Data"
    / "ARIS 42648 (2024 work program)"
    / "42648Z"
    / "Digital Data"
    / "Digital Data"
    / "EZ Gamma"
)
COLLAR_CSV = SOURCE_ROOT / "Surveyed Drillholes" / "2024 Surveyed Drillholes.csv"
IMAGE_ROOT = SOURCE_ROOT / "JPEG's"
OUT_IMAGES = ROOT / "data" / "ez_gamma_images"
OUT_GEOJSON = ROOT / "data" / "ez_gamma_2024.geojson"


# Table 17 of ARIS 42648. The source collar CSV includes logged overburden
# depth, but the report table carries survey depth and interpreted contacts.
REPORT_CONTACTS = {
    "SE10-07": {"surveyDepthM": 200.46, "interp1M": 170.69, "interp2M": 165.5},
    "SE10-08": {"surveyDepthM": 165.07, "interp1M": 132.0, "interp2M": 123.0},
    "SE11-29": {"surveyDepthM": 174.21, "interp1M": 139.0, "interp2M": 130.5},
    "SE11-33": {"surveyDepthM": 155.20, "interp1M": 109.5, "interp2M": 107.5},
    "SE11-34": {"surveyDepthM": 175.11, "interp1M": 143.26, "interp2M": 127.0},
    "SE11-37": {"surveyDepthM": 125.15, "interp1M": 91.44, "interp2M": 88.0},
    "SE11-44": {"surveyDepthM": 140.15, "interp1M": 104.0, "interp2M": 98.0},
    "SE11-48": {"surveyDepthM": 70.18, "interp1M": 35.0, "interp2M": 25.75},
    "SE11-49": {"surveyDepthM": 180.11, "interp1M": 141.25, "interp2M": 139.5},
    "SE12-66": {"surveyDepthM": 87.11, "interp1M": 51.51, "interp2M": 47.0},
    "SE12-72": {"surveyDepthM": 125.35, "interp1M": 88.0, "interp2M": 82.0},
}

GAMMA_CPS_MAX = 140.0


def as_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def find_image(hole_id: str) -> Path | None:
    pattern = f"SURVEY-IQ_DRILLHOLE_{hole_id}_EZGAMMA_*.jpg"
    matches = sorted(IMAGE_ROOT.glob(pattern))
    return matches[0] if matches else None


def simplify_image_name(hole_id: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", hole_id).strip("_")
    return f"{safe}.png"


def write_black_transparent_png(source: Path, destination: Path) -> None:
    img = Image.open(source).convert("RGBA")
    arr = np.asarray(img).copy()
    rgb = arr[:, :, :3].astype(np.int16)
    channel_max = rgb.max(axis=2)
    channel_min = rgb.min(axis=2)

    # Remove neutral dark ink/grid pixels while preserving the red and blue
    # gamma traces. The channel spread guard prevents dark saturated trace
    # pixels from being mistaken for black.
    black_ink = (channel_max < 84) & ((channel_max - channel_min) < 34)
    arr[:, :, 3] = np.where(black_ink, 0, arr[:, :, 3])

    Image.fromarray(arr, mode="RGBA").save(destination)


def smooth_series(samples: list[dict[str, float | None]]) -> list[dict[str, float | None]]:
    if len(samples) < 3:
        return samples

    def smooth_value(index: int, key: str) -> float | None:
        vals = [
            samples[i][key]
            for i in range(max(0, index - 1), min(len(samples), index + 2))
            if samples[i][key] is not None
        ]
        if not vals:
            return None
        return round(float(median(vals)), 2)

    return [
        {
            "depthM": sample["depthM"],
            "runRedCps": smooth_value(i, "runRedCps"),
            "runBlueCps": smooth_value(i, "runBlueCps"),
        }
        for i, sample in enumerate(samples)
    ]


def digitize_gamma_jpeg(image_path: Path, survey_depth_m: float) -> list[dict[str, float | None]]:
    """Digitize the red/blue Survey-IQ trace lines from the JPEG strip log.

    The JPEG is the source artifact, not an engineering-grade LAS file. This
    produces a visual guide suitable for scene display and keeps the original
    image path in each feature for audit.
    """

    img = Image.open(image_path).convert("RGB")
    arr = np.asarray(img)
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)

    red_mask = (r > 135) & (g < 120) & (b < 130) & ((r - b) > 35)
    blue_mask = (b > 135) & (r < 130) & (g < 160) & ((b - r) > 35)
    color_mask = red_mask | blue_mask
    ys, xs = np.where(color_mask)
    if len(xs) == 0:
        return []

    # Infer the plotting frame from the continuous dark grid/border columns
    # inside the trace span. This avoids using fixed pixel positions, because
    # the supplied JPEGs have different depths and heights.
    y_min = int(max(0, ys.min() - 2))
    y_max = int(min(arr.shape[0] - 1, ys.max() + 2))
    span = arr[y_min : y_max + 1]
    dark = np.all(span < 80, axis=2)
    dark_column_counts = dark.sum(axis=0)
    column_threshold = max(8, int((y_max - y_min + 1) * 0.18))
    grid_columns = np.where(dark_column_counts >= column_threshold)[0]
    if len(grid_columns) >= 2:
        x_min = int(grid_columns.min())
        x_max = int(grid_columns.max())
    else:
        x_min = int(max(0, xs.min() - 45))
        x_max = int(min(arr.shape[1] - 1, xs.max() + 45))
    if x_max <= x_min:
        return []

    samples_by_meter: dict[int, dict[str, list[float]]] = {}
    for y in range(y_min, y_max + 1):
        depth_m = ((y - y_min) / max(1, y_max - y_min)) * survey_depth_m
        bucket = int(round(depth_m))
        row = samples_by_meter.setdefault(bucket, {"red": [], "blue": []})
        for key, mask in (("red", red_mask), ("blue", blue_mask)):
            x_vals = np.where(mask[y])[0]
            if len(x_vals) == 0:
                continue
            cps = ((float(median(x_vals)) - x_min) / (x_max - x_min)) * GAMMA_CPS_MAX
            row[key].append(max(0.0, min(GAMMA_CPS_MAX, cps)))

    samples: list[dict[str, float | None]] = []
    for bucket in sorted(samples_by_meter):
        row = samples_by_meter[bucket]
        if not row["red"] and not row["blue"]:
            continue
        samples.append(
            {
                "depthM": float(bucket),
                "runRedCps": round(float(median(row["red"])), 2)
                if row["red"]
                else None,
                "runBlueCps": round(float(median(row["blue"])), 2)
                if row["blue"]
                else None,
            }
        )
    return smooth_series(samples)


def main() -> None:
    OUT_IMAGES.mkdir(parents=True, exist_ok=True)
    for old_image in OUT_IMAGES.glob("*.jpg"):
        old_image.unlink()
    for old_image in OUT_IMAGES.glob("*.png"):
        old_image.unlink()
    features = []
    with COLLAR_CSV.open("r", encoding="utf-8-sig", newline="") as fh:
        for row in csv.DictReader(fh):
            hole_id = row["Hole ID"].strip()
            easting = as_float(row.get("UTM_E"))
            northing = as_float(row.get("UTM_N"))
            elev = as_float(row.get("Elev (m)"))
            eoh = as_float(row.get("EOH (m)"))
            logged_ob = as_float(row.get("OB Depth ("))
            if easting is None or northing is None or elev is None:
                continue
            contacts = REPORT_CONTACTS.get(hole_id, {})
            survey_depth = contacts.get("surveyDepthM") or logged_ob or eoh or 0.0
            source_image = find_image(hole_id)
            image_rel = None
            samples: list[dict[str, float | None]] = []
            if source_image:
                image_name = simplify_image_name(hole_id)
                image_dest = OUT_IMAGES / image_name
                write_black_transparent_png(source_image, image_dest)
                image_rel = f"data/ez_gamma_images/{image_name}"
                samples = digitize_gamma_jpeg(source_image, float(survey_depth))

            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(easting, 3), round(northing, 3), round(elev, 3)],
                },
                "properties": {
                    "id": hole_id,
                    "displayName": f"{hole_id} EZ Gamma",
                    "zone": "Southeast",
                    "campaign": "2024",
                    "instrument": "Reflex EZ-Gamma",
                    "gammaCpsMax": GAMMA_CPS_MAX,
                    "totalDepthM": eoh,
                    "surveyDepthM": survey_depth,
                    "loggedOverburdenM": logged_ob,
                    "interpretedOverburden1M": contacts.get("interp1M"),
                    "interpretedOverburden2M": contacts.get("interp2M"),
                    "image": image_rel,
                    "gammaSamples": samples,
                    "digitizedSampleCount": len(samples),
                    "digitizationNote": (
                        "Visual trace digitized from Survey-IQ JPEG strip log. "
                        "Use as scene guidance only; original JPEG is retained."
                    ),
                },
            }
            features.append(feature)

    out = {
        "type": "FeatureCollection",
        "name": "ez-gamma-2024",
        "crs_note": "Coordinates in EPSG:26910 (NAD83 / UTM Zone 10N).",
        "source_note": (
            "ARIS 42648, Section 5.5 and Table 17; digital source folder "
            "42648Z/Digital Data/Digital Data/EZ Gamma."
        ),
        "features": features,
    }
    OUT_GEOJSON.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print(f"Wrote {OUT_GEOJSON.relative_to(ROOT)} with {len(features)} features")
    print(f"Wrote {len(list(OUT_IMAGES.glob('*.png')))} transparent reference PNGs")


if __name__ == "__main__":
    main()
