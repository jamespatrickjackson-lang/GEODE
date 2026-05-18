from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "imagery_lidar_aoi_2024.geojson"

# The ARIS digital package includes the Eagle Mapping report and a note that
# raw LiDAR was shipped separately on an external drive. The report states
# an AOI of about 400 sq. km but does not include the exact AOI boundary.
# Use a 20 km x 20 km footprint centred over the 2024 Woodjam customer-data
# cluster as a report/coverage guide, not as a legal or survey boundary.
CENTER_EASTING = 611_475.0
CENTER_NORTHING = 5_784_670.0
HALF_SIZE_M = 10_000.0


def main() -> None:
    west = CENTER_EASTING - HALF_SIZE_M
    east = CENTER_EASTING + HALF_SIZE_M
    south = CENTER_NORTHING - HALF_SIZE_M
    north = CENTER_NORTHING + HALF_SIZE_M
    ring = [
        [west, south, 0],
        [east, south, 0],
        [east, north, 0],
        [west, north, 0],
        [west, south, 0],
    ]
    collection = {
        "type": "FeatureCollection",
        "name": "2024 Eagle Mapping LiDAR Acquisition Footprint",
        "crs": {"type": "name", "properties": {"name": "EPSG:26910"}},
        "properties": {
            "source": "ARIS 42648 Imagery Data / Appendix H-I LiDAR materials",
            "sourceDate": "2025-01-31",
            "sourceOrigin": "Vizsla Copper / Eagle Mapping Ltd. / ARIS public assessment",
            "classification": "observation",
            "notes": (
                "The ARIS package contains the Eagle Mapping LiDAR report and a "
                "note that raw LiDAR was delivered externally on a hard drive. "
                "The exact AOI boundary is not included; this footprint is an "
                "approximate 400 sq. km guide based on the report area."
            ),
        },
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "id": "imagery-lidar-aoi-2024",
                    "displayName": "2024 Eagle Mapping LiDAR AOI, reported approx.",
                    "label": "2024 LiDAR acquisition footprint",
                    "client": "Vizsla Copper Corporation",
                    "contractor": "Eagle Mapping Ltd.",
                    "project": "Williams Lake South",
                    "flightDates": "2024-08-29 to 2024-08-30",
                    "aircraft": "Cessna T210N",
                    "lidarUnit": "Riegl VQ-780II-S",
                    "reportedAoiSqKm": 400,
                    "pointDensityPpm": 8,
                    "averagePulseDensityPpm": 14,
                    "horizontalAccuracyM": 0.30,
                    "verticalAccuracyM": 0.15,
                    "projection": "UTM 10N NAD83(CSRS)",
                    "epsg": 3157,
                    "imageryDelivered": "none",
                    "rawDataAvailability": "Raw LiDAR referenced as external hard-drive delivery, not included in this ARIS package.",
                    "sourceFile": "Imagery Data/Eagle Mapping LiDAR/Viszla Copper - Williams Lake South Report.pdf",
                    "classification": "observation",
                    "isApproximate": True,
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [ring],
                },
            }
        ],
    }
    OUT.write_text(json.dumps(collection, indent=2), encoding="utf-8")
    print(f"Wrote imagery LiDAR AOI guide to {OUT}")


if __name__ == "__main__":
    main()
