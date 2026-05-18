from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE = (
    ROOT
    / "data"
    / "source"
    / "Geophysical_Data"
    / "ARIS 42648 (2024 work program)"
    / "42648Z"
    / "Digital Data"
    / "Digital Data"
    / "Geophysical Data"
    / "Scott Geophysics IP"
    / "Appendix C - IP Survey Data"
)
SOURCES = [
    (
        "Great Plains",
        BASE / "GreatPlains" / "DataFiles" / "GreatPlainsGPS.txt",
    ),
    (
        "Three Firs",
        BASE / "3Firs" / "DataFiles" / "3Firs_GPS.txt",
    ),
]
OUT = ROOT / "data" / "ip_survey_lines_2024.geojson"


WAYPOINT_RE = re.compile(
    r"^W\s+(?P<id>.+?)\s+10U\s+(?P<e>\d+(?:\.\d+)?)\s+"
    r"(?P<n>\d+(?:\.\d+)?)\s+Waypoint\s+\S+\s+\S+\s+"
    r"(?P<z>-?\d+(?:\.\d+)?)"
)
STATION_RE = re.compile(
    r"^(?P<line>\d{4,5}E)\s+(?P<station>\d+(?:\.\d+)?)N?$",
    re.IGNORECASE,
)


def parse_gps_file(target: str, path: Path) -> list[dict[str, object]]:
    if not path.exists():
        raise FileNotFoundError(path)
    stations: dict[str, list[dict[str, float | str]]] = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        match = WAYPOINT_RE.match(raw.rstrip())
        if not match:
            continue
        waypoint_id = " ".join(match.group("id").split())
        station_match = STATION_RE.match(waypoint_id)
        if not station_match:
            continue
        line = station_match.group("line").upper()
        station = float(station_match.group("station"))
        stations.setdefault(line, []).append(
            {
                "waypointId": waypoint_id,
                "station": station,
                "easting": float(match.group("e")),
                "northing": float(match.group("n")),
                "elevation": float(match.group("z")),
            }
        )

    features: list[dict[str, object]] = []
    for line, rows in sorted(stations.items()):
        rows.sort(key=lambda row: float(row["station"]))
        if len(rows) < 2:
            continue
        coords = [
            [
                row["easting"],
                row["northing"],
                row["elevation"],
            ]
            for row in rows
        ]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": f"{target.lower().replace(' ', '-')}-{line.lower()}",
                    "displayName": f"{target} IP line {line}",
                    "target": target,
                    "lineName": line,
                    "stationCount": len(rows),
                    "stationMin": rows[0]["station"],
                    "stationMax": rows[-1]["station"],
                    "source": str(path.relative_to(ROOT)).replace("\\", "/"),
                    "sourceOrigin": "Scott Geophysics / Vizsla Copper / ARIS 42648",
                    "sourceDate": "2025-01-31",
                    "classification": "observation",
                    "stations": rows,
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords,
                },
            }
        )
    return features


def main() -> None:
    features: list[dict[str, object]] = []
    for target, path in SOURCES:
      features.extend(parse_gps_file(target, path))

    collection = {
        "type": "FeatureCollection",
        "name": "2024 Scott Geophysics IP Survey Lines",
        "crs": {
            "type": "name",
            "properties": {"name": "EPSG:26910"},
        },
        "properties": {
            "source": "ARIS 42648, Scott Geophysics IP GPS waypoint files",
            "sourceDate": "2025-01-31",
            "sourceOrigin": "Vizsla Copper / Scott Geophysics / ARIS public assessment",
            "count": len(features),
            "classification": "observation",
            "notes": (
                "Surveyed IP station lines parsed from Great Plains and Three "
                "Firs GPS waypoint files. Intended as plan-view acquisition "
                "geometry; chargeability/resistivity pseudo-section curtains "
                "should be built from the matching .dat/.ipg files."
            ),
        },
        "features": features,
    }
    OUT.write_text(json.dumps(collection, indent=2), encoding="utf-8")
    print(f"Wrote {len(features)} IP survey lines to {OUT}")


if __name__ == "__main__":
    main()
