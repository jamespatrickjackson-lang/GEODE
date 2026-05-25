"""Generate browser-ready Utah FORGE Phase 3 demo borehole geometry.

The active app data stores a reviewed demo/orientation derivative, not raw GDR
delivery files. This script downloads the small public survey/location files
when needed, parses the 16A and 16B directional surveys, and writes a compact
manifest consumed by the GeoSee runtime layer.
"""

from __future__ import annotations

import csv
import json
import math
import re
import urllib.request
import zipfile
from pathlib import Path
from typing import Any

from openpyxl import load_workbook


REPO_ROOT = Path(__file__).resolve().parents[1]
STAGING_DIR = REPO_ROOT / ".tmp" / "utah-forge-boreholes"
OUTPUT_DIR = (
    REPO_ROOT
    / "projects"
    / "utah-forge"
    / "data"
    / "geosee_processed"
    / "utah_forge_phase_3"
    / "demo_boreholes"
)
OUTPUT_PATH = OUTPUT_DIR / "phase3_demo_boreholes.json"

US_SURVEY_FOOT_M = 1200 / 3937
SCENE_ORIGIN_UTM = {
    "easting_m": 341467.35,
    "northing_m": 4273374.5,
    "elevation_m": 0,
}

SOURCES = {
    "16a": {
        "submission": "GDR 1283",
        "url": "https://gdr.openei.org/files/1283/16A%2878%29-32%20Survey.xlsx",
        "local": STAGING_DIR / "16A_survey.xlsx",
        "label": "16A(78)-32 directional survey workbook",
    },
    "16b": {
        "submission": "GDR 1516",
        "url": "https://gdr.openei.org/files/1516/16B%2878%29-32%20Well%20Survey.zip",
        "local": STAGING_DIR / "16B_well_survey.zip",
        "label": "16B(78)-32 final well survey archive",
    },
    "locations": {
        "submission": "GDR 1358",
        "url": "https://gdr.openei.org/files/1358/Utah%20FORGE%20Well%20and%20Seismic%20Locations.csv",
        "local": STAGING_DIR / "well_locations.csv",
        "label": "Updated Utah FORGE well and seismic locations CSV",
    },
}


def download_if_missing(url: str, output: Path) -> None:
    if output.exists():
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "GeoSee data intake"})
    with urllib.request.urlopen(request, timeout=60) as response:
        output.write_bytes(response.read())


def ensure_sources() -> Path:
    for source in SOURCES.values():
        download_if_missing(source["url"], source["local"])
    extracted = STAGING_DIR / "16B"
    xlsx = extracted / "16B(78)-32 Final Survey Report.xlsx"
    if not xlsx.exists():
        extracted.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(SOURCES["16b"]["local"]) as archive:
            archive.extractall(extracted)
    return xlsx


def finite_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"[-+]?\d+(?:\.\d+)?", value.replace(",", ""))
        if match:
            return float(match.group(0))
    return None


def last_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    if isinstance(value, str):
        matches = re.findall(r"[-+]?\d+(?:\.\d+)?", value.replace(",", ""))
        if matches:
            return float(matches[-1])
    return None


def read_location_rows() -> dict[str, dict[str, Any]]:
    rows: dict[str, dict[str, Any]] = {}
    with SOURCES["locations"]["local"].open(newline="", encoding="utf-8-sig") as handle:
        raw_rows = list(csv.reader(handle))
        header_index = next(
            index
            for index, row in enumerate(raw_rows)
            if row and row[0].strip() == "Point ID"
        )
        header = raw_rows[header_index]
        for values in raw_rows[header_index + 1 :]:
            row = {header[i]: values[i] if i < len(values) else "" for i in range(len(header))}
            point_id = row.get("Point ID", "").strip()
            if not point_id:
                continue
            easting = finite_number(row.get("Easting (X)"))
            northing = finite_number(row.get("Northing (Y)"))
            elevation = finite_number(row.get("Elevation"))
            if easting is None or northing is None or elevation is None:
                continue
            rows[point_id] = {
                "id": point_id,
                "easting_m": easting,
                "northing_m": northing,
                "elevation_m": elevation,
                "featureCode": row.get("Feature Code", "").strip(),
                "notes": row.get("Notes", "").strip(),
            }
    return rows


def scene_point(easting_m: float, northing_m: float, elevation_m: float) -> list[float]:
    return [
        round(easting_m - SCENE_ORIGIN_UTM["easting_m"], 3),
        round(northing_m - SCENE_ORIGIN_UTM["northing_m"], 3),
        round(elevation_m - SCENE_ORIGIN_UTM["elevation_m"], 3),
    ]


def trajectory_point(
    md_ft: float,
    inc_deg: float | None,
    azi_deg: float | None,
    tvd_ft: float,
    easting_m: float,
    northing_m: float,
    collar_elevation_m: float,
) -> dict[str, Any]:
    elevation_m = collar_elevation_m - tvd_ft * US_SURVEY_FOOT_M
    return {
        "mdFt": round(md_ft, 3),
        "tvdFt": round(tvd_ft, 3),
        "inclinationDeg": None if inc_deg is None else round(inc_deg, 3),
        "azimuthDeg": None if azi_deg is None else round(azi_deg, 3),
        "utm": [
            round(easting_m, 3),
            round(northing_m, 3),
            round(elevation_m, 3),
        ],
        "scene": scene_point(easting_m, northing_m, elevation_m),
    }


def parse_16a(locations: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    collar = locations["16A-32-WELL"]
    collar_easting = collar["easting_m"]
    collar_northing = collar["northing_m"]
    collar_elevation = collar["elevation_m"]
    workbook = load_workbook(SOURCES["16a"]["local"], data_only=True)
    sheet = workbook.active
    points: list[dict[str, Any]] = []
    for row in sheet.iter_rows(min_row=77, values_only=True):
        seq = finite_number(row[1] if len(row) > 1 else None)
        md = finite_number(row[2] if len(row) > 2 else None)
        inc = finite_number(row[3] if len(row) > 3 else None)
        azi = finite_number(row[4] if len(row) > 4 else None)
        tvd = finite_number(row[6] if len(row) > 6 else None)
        ns = finite_number(row[8] if len(row) > 8 else None)
        ew = finite_number(row[9] if len(row) > 9 else None)
        if seq is None or md is None or tvd is None or ns is None or ew is None:
            continue
        easting = collar_easting + ew * US_SURVEY_FOOT_M
        northing = collar_northing + ns * US_SURVEY_FOOT_M
        points.append(
            trajectory_point(md, inc, azi, tvd, easting, northing, collar_elevation)
        )
    return points


def parse_16b(report_path: Path) -> list[dict[str, Any]]:
    workbook = load_workbook(report_path, data_only=True)
    sheet = workbook.active
    points: list[dict[str, Any]] = []
    collar_elevation_ft = 5415.65
    collar_elevation_m = collar_elevation_ft * US_SURVEY_FOOT_M
    for row in sheet.iter_rows(min_row=21, values_only=True):
        md = finite_number(row[0] if len(row) > 0 else None)
        inc = last_number(row[1] if len(row) > 1 else None)
        azi = finite_number(row[2] if len(row) > 2 else None)
        tvd = finite_number(row[3] if len(row) > 3 else None)
        northing_ft = finite_number(row[6] if len(row) > 6 else None)
        easting_ft = finite_number(row[8] if len(row) > 8 else None)
        if (
            md is None
            or inc is None
            or azi is None
            or tvd is None
            or northing_ft is None
            or easting_ft is None
        ):
            continue
        points.append(
            trajectory_point(
                md,
                inc,
                azi,
                tvd,
                easting_ft * US_SURVEY_FOOT_M,
                northing_ft * US_SURVEY_FOOT_M,
                collar_elevation_m,
            )
        )
    return points


def pad_block(locations: dict[str, dict[str, Any]]) -> dict[str, Any]:
    corners = [
        locations[key]
        for key in ["16A-32-NEC", "16A-32-NWC", "16A-32-SEC", "16A-32-SWC"]
    ]
    cx = sum(c["easting_m"] for c in corners) / len(corners)
    cy = sum(c["northing_m"] for c in corners) / len(corners)
    ground = max(c["elevation_m"] for c in corners)
    # Long pad direction is estimated from west/east corner centroids.
    west = [
        c
        for c in corners
        if c["id"].endswith("NWC") or c["id"].endswith("SWC")
    ]
    east = [
        c
        for c in corners
        if c["id"].endswith("NEC") or c["id"].endswith("SEC")
    ]
    wx = sum(c["easting_m"] for c in west) / len(west)
    wy = sum(c["northing_m"] for c in west) / len(west)
    ex = sum(c["easting_m"] for c in east) / len(east)
    ey = sum(c["northing_m"] for c in east) / len(east)
    rotation_deg = math.degrees(math.atan2(ey - wy, ex - wx))
    height = 34
    return {
        "id": "forge-surface-facility-orientation-block",
        "label": "FORGE surface facility / orientation block",
        "classification": "demo-orientation",
        "notForEngineeringUse": True,
        "sourceBasis": "Schematic white block centered on the GDR 1358 16A-32 pad corner coordinates. No building footprint is present in the active project files.",
        "centerUtm": [round(cx, 3), round(cy, 3), round(ground + height / 2, 3)],
        "centerScene": scene_point(cx, cy, ground + height / 2),
        "sizeM": [118, 68, height],
        "rotationDeg": round(rotation_deg, 3),
        "padCornerIds": [c["id"] for c in corners],
    }


def summarize(points: list[dict[str, Any]]) -> dict[str, Any]:
    md = [p["mdFt"] for p in points]
    tvd = [p["tvdFt"] for p in points]
    scene = [p["scene"] for p in points]
    return {
        "pointCount": len(points),
        "mdFt": {"min": min(md), "max": max(md)},
        "tvdFt": {"min": min(tvd), "max": max(tvd)},
        "sceneBounds": {
            "min": [round(min(p[i] for p in scene), 3) for i in range(3)],
            "max": [round(max(p[i] for p in scene), 3) for i in range(3)],
        },
    }


def build_manifest() -> dict[str, Any]:
    report_16b = ensure_sources()
    locations = read_location_rows()
    wells = [
        {
            "id": "16A(78)-32",
            "label": "16A(78)-32 injection",
            "shortLabel": "16A injection",
            "role": "injection",
            "color": "#35d7ff",
            "emissiveColor": "#177b96",
            "source": SOURCES["16a"]["submission"],
            "sourceUrl": "https://gdr.openei.org/submissions/1283",
            "sourceFile": SOURCES["16a"]["label"],
            "trajectory": parse_16a(locations),
        },
        {
            "id": "16B(78)-32",
            "label": "16B(78)-32 production",
            "shortLabel": "16B production",
            "role": "production",
            "color": "#ff7440",
            "emissiveColor": "#9f321b",
            "source": SOURCES["16b"]["submission"],
            "sourceUrl": "https://gdr.openei.org/submissions/1516",
            "sourceFile": SOURCES["16b"]["label"],
            "trajectory": parse_16b(report_16b),
        },
    ]
    for well in wells:
        well["summary"] = summarize(well["trajectory"])
        first = well["trajectory"][0]
        last = well["trajectory"][-1]
        well["collarScene"] = first["scene"]
        well["toeScene"] = last["scene"]
        well["collarUtm"] = first["utm"]
        well["toeUtm"] = last["utm"]

    return {
        "schema": "geosee.utahForge.demoBoreholes.v1",
        "label": "Utah FORGE Phase 3 demo boreholes",
        "classification": "demo-orientation",
        "notForEngineeringUse": True,
        "generatedDate": "2026-05-25",
        "sourceCrs": "EPSG:26912 / NAD83 UTM Zone 12N",
        "sourceUnits": {
            "surveyDepth": "US survey feet",
            "storedCoordinates": "meters",
            "scene": "scene-local meters",
        },
        "sceneOriginUtm": SCENE_ORIGIN_UTM,
        "sources": {
            key: {
                "submission": value["submission"],
                "label": value["label"],
                "url": value["url"],
                "sourcePage": f"https://gdr.openei.org/submissions/{1283 if key == '16a' else 1516 if key == '16b' else 1358}",
            }
            for key, value in SOURCES.items()
        },
        "notes": [
            "The borehole trajectories are parsed from public GDR directional survey files and converted to the GeoSee scene frame.",
            "The white surface facility block is schematic orientation geometry, not a measured building footprint.",
            "This layer is intended for presentation orientation only and must not be used for drilling, survey, or engineering decisions.",
        ],
        "styleDefaults": {
            "pipeRadiusM": 12,
            "opacity": 0.92,
            "labelsVisible": True,
            "orientationBlockVisible": True,
        },
        "orientationBlock": pad_block(locations),
        "wells": wells,
    }


def main() -> None:
    manifest = build_manifest()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.relative_to(REPO_ROOT)}")
    for well in manifest["wells"]:
        summary = well["summary"]
        print(
            f"{well['id']}: {summary['pointCount']} points, "
            f"MD {summary['mdFt']['max']:.0f} ft, TVD {summary['tvdFt']['max']:.0f} ft"
        )


if __name__ == "__main__":
    main()
