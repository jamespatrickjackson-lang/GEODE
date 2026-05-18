from __future__ import annotations

import csv
import json
import math
from pathlib import Path
from statistics import median


ROOT = Path(__file__).resolve().parents[1]
SOURCE = (
    ROOT
    / "data"
    / "source"
    / "Geophysical_Data"
    / "ARIS 42648 (2024 work program)"
    / "42648Z"
    / "Digital Data"
    / "Digital Data"
    / "Geochemical Data"
    / "GP Soil Data"
    / "csv file"
    / "2024 Soil Samples.csv"
)
OUT = ROOT / "data" / "geochem_soils_2024.geojson"


ELEMENT_LABELS = {
    "ag": "Ag",
    "as": "As",
    "au": "Au",
    "cu": "Cu",
    "mo": "Mo",
    "pb": "Pb",
    "zn": "Zn",
    "ni": "Ni",
    "co": "Co",
    "mn": "Mn",
    "fe": "Fe",
}


def parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    text = value.strip().replace(",", "")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    if not math.isfinite(number):
        return None
    return number


def quantile(sorted_values: list[float], q: float) -> float | None:
    if not sorted_values:
        return None
    if len(sorted_values) == 1:
        return sorted_values[0]
    pos = (len(sorted_values) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return sorted_values[lo]
    t = pos - lo
    return sorted_values[lo] * (1 - t) + sorted_values[hi] * t


def element_name(field: str) -> tuple[str, str] | None:
    if field.endswith("_ppm"):
        return field.removesuffix("_ppm"), "ppm"
    if field.endswith("_pct"):
        return field.removesuffix("_pct"), "%"
    return None


def normalize_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)

    features = []
    element_values: dict[str, list[float]] = {}

    with SOURCE.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        value_fields = [
            field
            for field in (reader.fieldnames or [])
            if field and element_name(field) is not None
        ]

        for row in reader:
            easting = parse_float(row.get("x"))
            northing = parse_float(row.get("y"))
            if easting is None or northing is None:
                continue

            props: dict[str, object] = {
                "id": normalize_text(row.get("sample_id")),
                "sampleId": normalize_text(row.get("sample_id")),
                "displayName": normalize_text(row.get("sample_id")),
                "medium": normalize_text(row.get("medium")),
                "project": normalize_text(row.get("project")),
                "year": parse_float(row.get("year")),
                "sampledBy": normalize_text(row.get("sampled_by")),
                "sampledAt": normalize_text(row.get("sampled_tstamp")),
                "dataSource": normalize_text(row.get("data_source")),
                "purpose": normalize_text(row.get("purpose")),
                "status": normalize_text(row.get("status")),
                "locAccuracyM": parse_float(row.get("loc_acc")),
                "soilHorizon": normalize_text(row.get("soil_horizon")),
                "sampleDepthCm": parse_float(row.get("sample_depth__cm_")),
                "note": normalize_text(row.get("note")),
                "source": "ARIS 42648, 2024 GP Soil Data",
                "classification": "observation",
            }

            for field in value_fields:
                parsed = parse_float(row.get(field))
                if parsed is None:
                    continue
                props[field] = parsed
                element_values.setdefault(field, []).append(parsed)
                flag_field = field.rsplit("_", 1)[0] + "_flag"
                flag = normalize_text(row.get(flag_field))
                if flag:
                    props[flag_field] = flag

            props = {k: v for k, v in props.items() if v is not None}
            features.append(
                {
                    "type": "Feature",
                    "properties": props,
                    "geometry": {
                        "type": "Point",
                        "coordinates": [easting, northing, 0],
                    },
                }
            )

    element_stats: dict[str, dict[str, object]] = {}
    for field, values in sorted(element_values.items()):
        if not values:
            continue
        sorted_values = sorted(values)
        name_unit = element_name(field)
        if name_unit is None:
            continue
        short, unit = name_unit
        label = ELEMENT_LABELS.get(short, short.upper())
        element_stats[field] = {
            "label": f"{label} ({unit})",
            "symbol": label,
            "unit": unit,
            "count": len(sorted_values),
            "min": sorted_values[0],
            "q20": quantile(sorted_values, 0.2),
            "q40": quantile(sorted_values, 0.4),
            "median": median(sorted_values),
            "q60": quantile(sorted_values, 0.6),
            "q80": quantile(sorted_values, 0.8),
            "p90": quantile(sorted_values, 0.9),
            "max": sorted_values[-1],
        }

    collection = {
        "type": "FeatureCollection",
        "name": "2024 GP Soil Geochemistry",
        "crs": {
            "type": "name",
            "properties": {"name": "EPSG:26910"},
        },
        "properties": {
            "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
            "sourceDate": "2025-01-31",
            "sourceOrigin": "Vizsla Copper / ARIS public assessment",
            "count": len(features),
            "elements": element_stats,
            "classification": "observation",
            "notes": (
                "Point soil geochemistry from ARIS 42648 GP Soil Data. "
                "Prepared for graduated-symbol map display; values are the "
                "reported table values, including numeric substitutions for "
                "below-detection rows where the source provided an LDL flag."
            ),
        },
        "features": features,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(collection, indent=2), encoding="utf-8")
    print(f"Wrote {len(features)} soil samples to {OUT}")


if __name__ == "__main__":
    main()
