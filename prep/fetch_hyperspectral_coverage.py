from __future__ import annotations

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COLLARS = ROOT / "data" / "drillholes_2024_tf.geojson"
OUT = ROOT / "data" / "hyperspectral_coverage_2024.geojson"

SCAN_INTERVALS = {
    "TF24-123": {
        "start": 155.4,
        "end": 405.0,
        "length": 249.6,
        "date": "2024-08-26",
        "archive": "Threefirs_TF24-123_B068_spec_clean.zip",
        "csvCount": 62,
    },
    "TF24-124": {
        "start": 89.9,
        "end": 327.35,
        "length": 237.45,
        "date": "2024-10-13",
        "archive": "Threefirs_TF24-124_B051_spec_clean.7z",
        "csvCount": 59,
    },
    "TF24-126": {
        "start": 150.6,
        "end": 639.0,
        "length": 488.4,
        "date": "2024-10-13",
        "archive": "Threefirs_TF24-126_B152_spec_clean.7z",
        "csvCount": 161,
    },
}


def point_at_depth(
    collar: tuple[float, float, float],
    azimuth_degrees: float,
    dip_degrees: float,
    depth_m: float,
) -> list[float]:
    az = math.radians(azimuth_degrees)
    dip = math.radians(abs(dip_degrees))
    horizontal = depth_m * math.cos(dip)
    dz = -depth_m * math.sin(dip)
    return [
        collar[0] + math.sin(az) * horizontal,
        collar[1] + math.cos(az) * horizontal,
        collar[2] + dz,
    ]


def main() -> None:
    data = json.loads(COLLARS.read_text(encoding="utf-8"))
    by_hole = {
        feat["properties"]["id"]: feat
        for feat in data["features"]
        if feat.get("geometry", {}).get("type") == "Point"
    }

    features = []
    for hole_id, scan in SCAN_INTERVALS.items():
        feat = by_hole.get(hole_id)
        if not feat:
            continue
        props = feat["properties"]
        collar = tuple(float(v) for v in feat["geometry"]["coordinates"])
        azimuth = float(props["azimuth_planned"])
        dip = float(props["dip_planned"])
        start = float(scan["start"])
        end = float(scan["end"])
        start_xyz = point_at_depth(collar, azimuth, dip, start)
        end_xyz = point_at_depth(collar, azimuth, dip, end)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"{hole_id.lower()}-hyperspectral-coverage",
                    "displayName": f"{hole_id} hyperspectral scan {start:g}-{end:g} m",
                    "holeId": hole_id,
                    "zone": props.get("zone"),
                    "scannedStartDepthM": start,
                    "scannedEndDepthM": end,
                    "scannedLengthM": float(scan["length"]),
                    "scannedDate": scan["date"],
                    "archiveFile": scan["archive"],
                    "spectralCsvCount": scan["csvCount"],
                    "instrument": "geoLOGr-14",
                    "method": "SWIR reflectance spectroscopy, 900-2500 nm, ~512 channels",
                    "source": "ARIS 42648, 20241027_Vizsla-Copper_Three Firs_geoLOGr.pdf and hyperspectral spectral CSV archives",
                    "sourceDate": "2025-01-31",
                    "sourceOrigin": "Hyperspectral Intelligence Inc. / Vizsla Copper / ARIS public assessment",
                    "classification": "observation",
                    "notes": "Coverage interval only. Raw spectral reflectance CSVs are retained in source; mineral/lithotype classification should be added as a separate derived layer if/when classified values are extracted.",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [start_xyz, end_xyz],
                },
            }
        )

    collection = {
        "type": "FeatureCollection",
        "name": "2024 Three Firs Hyperspectral Coverage",
        "crs": {
            "type": "name",
            "properties": {"name": "EPSG:26910"},
        },
        "properties": {
            "source": "ARIS 42648 Hyperspectral geoLOGr report and spectral CSV archives",
            "sourceDate": "2025-01-31",
            "sourceOrigin": "Vizsla Copper / Hyperspectral Intelligence Inc. / ARIS public assessment",
            "count": len(features),
            "classification": "observation",
            "notes": "Three scanned drill cores totaling 975.45 m of core according to the geoLOGr scanning summary.",
        },
        "features": features,
    }
    OUT.write_text(json.dumps(collection, indent=2), encoding="utf-8")
    print(f"Wrote {len(features)} hyperspectral coverage intervals to {OUT}")


if __name__ == "__main__":
    main()
