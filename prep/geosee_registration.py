from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pyproj import Transformer


@dataclass(frozen=True)
class GeoSeeProjectFrame:
    horizontal_crs: str
    units: str
    coordinate_basis: str
    origin_easting_m: float
    origin_northing_m: float
    origin_elevation_m: float
    rotation_deg: float = 0.0


UTAH_FORGE_PROJECT_FRAME = GeoSeeProjectFrame(
    horizontal_crs="EPSG:26912",
    units="m",
    coordinate_basis="utm",
    origin_easting_m=341_467.35,
    origin_northing_m=4_273_374.5,
    origin_elevation_m=0.0,
)


def require_source_crs(source_crs: str | None, source_label: str) -> str:
    if not source_crs or not source_crs.strip():
        raise ValueError(f"{source_label} requires a declared source CRS before scene conversion")
    return source_crs.strip()


def source_to_project_crs(
    easting_m: float,
    northing_m: float,
    source_crs: str,
    frame: GeoSeeProjectFrame = UTAH_FORGE_PROJECT_FRAME,
) -> tuple[float, float]:
    declared_source_crs = require_source_crs(source_crs, "source coordinate")
    transformer = Transformer.from_crs(
        declared_source_crs,
        frame.horizontal_crs,
        always_xy=True,
    )
    project_easting_m, project_northing_m = transformer.transform(easting_m, northing_m)
    return float(project_easting_m), float(project_northing_m)


def source_to_scene(
    easting_m: float,
    northing_m: float,
    elevation_m: float,
    source_crs: str,
    frame: GeoSeeProjectFrame = UTAH_FORGE_PROJECT_FRAME,
) -> list[float]:
    project_easting_m, project_northing_m = source_to_project_crs(
        easting_m,
        northing_m,
        source_crs,
        frame,
    )
    return [
        project_easting_m - frame.origin_easting_m,
        project_northing_m - frame.origin_northing_m,
        elevation_m - frame.origin_elevation_m,
    ]


def registration_metadata(
    *,
    horizontal_crs: str,
    vertical_datum: str,
    coordinate_basis: str,
    origin: dict[str, float],
    rotation_deg: float = 0.0,
    registration_status: str = "unverified",
    units: str = "m",
    notes: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "horizontalCrs": horizontal_crs,
        "verticalDatum": vertical_datum,
        "units": units,
        "coordinateBasis": coordinate_basis,
        "origin": origin,
        "rotationDeg": rotation_deg,
        "registrationStatus": registration_status,
    }
    if notes:
        payload["notes"] = notes
    return payload
