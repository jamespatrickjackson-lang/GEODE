from __future__ import annotations

import hashlib
import json
import math
import mmap
import os
import re
import shutil
import struct
import zipfile
import zlib
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

import numpy as np
import segyio
from pyproj import Transformer

from geosee_registration import (
    UTAH_FORGE_PROJECT_FRAME,
    registration_metadata,
    source_to_scene,
)


REPO_ROOT = Path.cwd()
ARCHIVE_ROOT = Path(os.environ.get("GEOSEE_ARCHIVE_ROOT", "C:/GeoSee/GeoSee_Archive"))
PROJECT_ROOT = REPO_ROOT / "projects" / "utah-forge"
CLIENT_ROOT = PROJECT_ROOT / "data" / "client_preprocessed"
PROCESSED_ROOT = PROJECT_ROOT / "data" / "geosee_processed"
PHASE3_SOURCE_ROOT = (
    CLIENT_ROOT / "utah_forge_phase_3" / "seismic_analysis"
)
ARCHIVED_PHASE3_SOURCE_ROOT = (
    ARCHIVE_ROOT
    / "projects"
    / "utah-forge"
    / "data"
    / "client_preprocessed"
    / "utah_forge_phase_3"
    / "seismic_analysis"
)
PHASE3_PROCESSED_ROOT = (
    PROCESSED_ROOT / "utah_forge_phase_3" / "seismic_analysis"
)
STAGING_ROOT = CLIENT_ROOT / "forge_southwestern" / "Data_staging"
UNSORTED_ROOT = CLIENT_ROOT / "Unsorted data"

DERIVED_DATE = os.environ.get("GEOSEE_DERIVED_DATE", "2026-05-13")
UTAH_FORGE_HORIZONTAL_CRS = UTAH_FORGE_PROJECT_FRAME.horizontal_crs
SEISMIC_REFERENCE_DATUM_M = 1800.0
FT_TO_M = 0.3048
UTAH_FORGE_EXPECTED_UTM_CENTER = (334000.0, 4262500.0)
LEGACY_STATE_PLANE_CRS_CANDIDATES = (
    {
        "epsg": 32043,
        "name": "NAD27 / Utah Central (ftUS)",
        "reason": "legacy header declares US State Plane NAD27; zone text is inconsistent across delivered lines",
    },
    {
        "epsg": 32044,
        "name": "NAD27 / Utah South (ftUS)",
        "reason": "legacy header declares US State Plane NAD27; zone text is inconsistent across delivered lines",
    },
)
TIME_SCALE_M_PER_MS = 2.0
SOURCE_FIDELITY_SECTION_MAX_PIXELS = int(
    os.environ.get("GEOSEE_SEISMIC_SECTION_MAX_PIXELS", "4194304")
)
SOURCE_FIDELITY_VOLUME_MAX_VOXELS = int(
    os.environ.get("GEOSEE_SEISMIC_VOLUME_MAX_VOXELS", "33554432")
)
BROWSER_3D_SECTION_MAX_LONG_EDGE = int(
    os.environ.get("GEOSEE_SEISMIC_3D_SECTION_MAX_LONG_EDGE", "2048")
)
BROWSER_3D_VOLUME_MAX_VOXELS = int(
    os.environ.get("GEOSEE_SEISMIC_3D_VOLUME_MAX_VOXELS", "8388608")
)
BROWSER_COARSE_SECTION_MAX_LONG_EDGE = int(
    os.environ.get("GEOSEE_SEISMIC_COARSE_SECTION_MAX_LONG_EDGE", "768")
)
BROWSER_COARSE_VOLUME_MAX_VOXELS = int(
    os.environ.get("GEOSEE_SEISMIC_COARSE_VOLUME_MAX_VOXELS", "2097152")
)
VELOCITY_DISPLAY_RANGE_M_PER_S = [2000, 5000]
TOP_OF_GRANITE_CALIBRATION = {
    "source": "FORGE report calibration point near well 58-32",
    "depthFt": 3200,
    "depthM": 975,
    "depthReference": "below surface / report calibration point",
    "expectedDepthConversionErrorM": 20,
}

RAW_DIR_MARKERS = (
    "Correlated_Shot_Gathers",
    "UnCorrelated_Shot_Gathers",
    "Uncorrelated_Shot_Gathers",
    "Pilot_Aux",
)

REQUIRED_ZIP_SOURCE_MEMBERS = (
    {
        "productId": "gdr-1141-forge3d-ani-psdm-stack-enh",
        "label": "3D anisotropic PSDM depth stack (enhanced)",
        "filename": "Forge3d_ANI_PSDM_Stack_Enh.segy",
        "expectedBytes": 153_678_840,
        "sourceSubmission": "GDR 1141",
        "sourceCitation": "GDR 1141, Miller (2019)",
        "downloadLandingPage": "https://gdr.openei.org/submissions/1141",
        "zipRelativePath": Path("from_submission_1141")
        / "2018-19 Reflection Processing.zip",
        "memberPath": "2018-19 Reflection Processing/3D Survey/Forge3d_ANI_PSDM_Stack_Enh.segy",
        "role": "extracted-required-reprocessed-product",
        "surveyKind": "3d",
        "productKind": "psdm",
        "domainKind": "depth",
        "domainUnit": "m",
    },
)


@dataclass
class Product:
    id: str
    label: str
    line_id: str
    line_label: str
    processing_stage: str
    canonical_label: str
    name_evidence: dict[str, Any]
    source_file: Path
    normalized_source_file: Path
    source_submission: str
    survey_kind: str
    product_kind: str
    domain_kind: str
    domain_unit: str
    datum_m: float
    datum_metadata: dict[str, Any]
    trace_count: int
    sample_count: int
    sample_min: float
    sample_max: float
    sample_interval: float
    sample_spacing: float
    sample_axis_metadata: dict[str, Any]
    source_geometry: dict[str, Any]
    source_unit_status: str
    stats: dict[str, Any]
    sections: list[dict[str, Any]]
    raymarch_volume: dict[str, Any] | None
    navigation_placement: dict[str, Any]
    text_header_excerpt: str


def rel(path: Path) -> str:
    resolved = path.resolve()
    for root in (REPO_ROOT.resolve(), ARCHIVE_ROOT.resolve()):
        try:
            return resolved.relative_to(root).as_posix()
        except ValueError:
            continue
    return resolved.as_posix()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def copy_or_link(source: Path, destination: Path) -> None:
    ensure_dir(destination.parent)
    if destination.exists() and destination.stat().st_size == source.stat().st_size:
        return
    if destination.exists():
        destination.unlink()
    try:
        os.link(source, destination)
    except OSError:
        shutil.copy2(source, destination)


def find_submission(root: Path, submission: str) -> Path:
    matches = sorted(root.glob(f"From Submission {submission}*"))
    if matches:
        return matches[0]
    raise FileNotFoundError(f"Could not find GDR submission {submission} below {root}")


def active_phase3_source_root() -> Path:
    if (PHASE3_SOURCE_ROOT / "source").exists():
        return PHASE3_SOURCE_ROOT
    if (ARCHIVED_PHASE3_SOURCE_ROOT / "source").exists():
        return ARCHIVED_PHASE3_SOURCE_ROOT
    return PHASE3_SOURCE_ROOT


def source_roots() -> tuple[Path, Path]:
    base = STAGING_ROOT if STAGING_ROOT.exists() else UNSORTED_ROOT
    return find_submission(base, "1015"), find_submission(base, "1141")


def is_raw_path(path: Path) -> bool:
    return any(marker in path.parts for marker in RAW_DIR_MARKERS) or path.name.startswith("._")


def safe_zip_member_destination(zip_path: Path, member_path: str) -> Path:
    member = PurePosixPath(member_path)
    if member.is_absolute() or any(part in {"", ".."} for part in member.parts):
        raise ValueError(f"Unsafe zip member path: {member_path}")
    destination_root = zip_path.parent.resolve()
    destination = (zip_path.parent / Path(*member.parts)).resolve()
    if not destination.is_relative_to(destination_root):
        raise ValueError(f"Zip member escapes destination root: {member_path}")
    return destination


def required_zip_source_gate(
    required: dict[str, Any],
    zip_path: Path,
    status: str,
    reason: str,
    destination: Path | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    return {
        "id": required["productId"],
        "label": required["label"],
        "filename": required["filename"],
        "expectedBytes": required["expectedBytes"],
        "sourceSubmission": required["sourceSubmission"],
        "sourceCitation": required["sourceCitation"],
        "downloadLandingPage": required["downloadLandingPage"],
        "sourceZip": rel(zip_path),
        "sourceZipMember": required["memberPath"],
        "normalizedPath": rel(destination) if destination else None,
        "status": status,
        "reason": reason,
        "error": error,
        "surveyKind": required["surveyKind"],
        "productKind": required["productKind"],
        "domainKind": required["domainKind"],
        "domainUnit": required["domainUnit"],
    }


def find_zip_member_local_header(zip_path: Path, member_path: str) -> dict[str, Any]:
    member_bytes = member_path.encode("utf-8")
    with zip_path.open("rb") as source:
        with mmap.mmap(source.fileno(), 0, access=mmap.ACCESS_READ) as mapped:
            search_at = 0
            while True:
                name_at = mapped.find(member_bytes, search_at)
                if name_at < 0:
                    raise KeyError(member_path)
                header_at = mapped.rfind(b"PK\x03\x04", 0, name_at)
                if header_at >= 0 and header_at + 30 <= len(mapped):
                    (
                        signature,
                        _version,
                        flag,
                        method,
                        _mtime,
                        _mdate,
                        crc,
                        compressed_size,
                        uncompressed_size,
                        name_length,
                        extra_length,
                    ) = struct.unpack_from("<IHHHHHIIIHH", mapped, header_at)
                    if signature == 0x04034B50:
                        filename_start = header_at + 30
                        filename_end = filename_start + name_length
                        filename = bytes(mapped[filename_start:filename_end])
                        if filename == member_bytes:
                            return {
                                "method": method,
                                "flag": flag,
                                "crc": crc,
                                "compressedSize": compressed_size,
                                "uncompressedSize": uncompressed_size,
                                "dataOffset": filename_end + extra_length,
                            }
                search_at = name_at + 1


def extract_zip_member_from_local_header_scan(
    zip_path: Path,
    member_path: str,
    destination: Path,
) -> None:
    import binascii

    header = find_zip_member_local_header(zip_path, member_path)
    method = header["method"]
    compressed_size = header["compressedSize"]
    expected_size = header["uncompressedSize"]
    expected_crc = header["crc"]
    data_offset = header["dataOffset"]
    temporary = destination.with_name(f".{destination.name}.partial")
    if temporary.exists():
        temporary.unlink()
    ensure_dir(destination.parent)
    crc = 0
    written = 0
    try:
        with zip_path.open("rb") as source, temporary.open("wb") as output:
            source.seek(data_offset)
            if method == 0:
                remaining = compressed_size
                while remaining > 0:
                    chunk = source.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    output.write(chunk)
                    crc = binascii.crc32(chunk, crc)
                    written += len(chunk)
                    remaining -= len(chunk)
            elif method == 8:
                decompressor = zlib.decompressobj(-15)
                remaining = compressed_size
                while remaining > 0 and not decompressor.eof:
                    chunk = source.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    decoded = decompressor.decompress(chunk)
                    if decoded:
                        output.write(decoded)
                        crc = binascii.crc32(decoded, crc)
                        written += len(decoded)
                if not decompressor.eof:
                    raise zipfile.BadZipFile(
                        f"deflate stream did not terminate for {member_path}"
                    )
            else:
                raise NotImplementedError(f"Unsupported zip compression method {method}")
        if written != expected_size:
            raise zipfile.BadZipFile(
                f"recovered size {written} did not match expected {expected_size}"
            )
        if (crc & 0xFFFFFFFF) != expected_crc:
            raise zipfile.BadZipFile(
                f"recovered CRC {crc & 0xFFFFFFFF} did not match expected {expected_crc}"
            )
        temporary.replace(destination)
    except Exception:
        if temporary.exists():
            temporary.unlink()
        raise


def extract_required_zip_source_members(source_root: Path) -> dict[str, list[dict[str, Any]]]:
    extracted: list[dict[str, Any]] = []
    source_gates: list[dict[str, Any]] = []
    for required in REQUIRED_ZIP_SOURCE_MEMBERS:
        zip_path = source_root / required["zipRelativePath"]
        if not zip_path.exists():
            source_gates.append(
                required_zip_source_gate(
                    required,
                    zip_path,
                    "missing-source-zip",
                    "The required GDR zip is not available in the active source root.",
                )
            )
            continue
        member_name = str(required["memberPath"])
        try:
            with zipfile.ZipFile(zip_path) as archive:
                member_lookup = {
                    name.lower(): name
                    for name in archive.namelist()
                    if not name.endswith("/")
                    and "__MACOSX" not in name.split("/")
                    and not PurePosixPath(name).name.startswith("._")
                }
                matched_member = member_lookup.get(member_name.lower())
                if matched_member is None:
                    source_gates.append(
                        required_zip_source_gate(
                            required,
                            zip_path,
                            "missing-source-member",
                            "The required SEG-Y member is not present in the GDR zip central directory.",
                        )
                    )
                    continue
                info = archive.getinfo(matched_member)
                destination = safe_zip_member_destination(zip_path, matched_member)
                ensure_dir(destination.parent)
                if not destination.exists() or destination.stat().st_size != info.file_size:
                    try:
                        temporary = destination.with_name(f".{destination.name}.partial")
                        if temporary.exists():
                            temporary.unlink()
                        with archive.open(info) as src, temporary.open("wb") as dst:
                            shutil.copyfileobj(src, dst)
                        temporary.replace(destination)
                    except Exception:
                        if temporary.exists():
                            temporary.unlink()
                        extract_zip_member_from_local_header_scan(
                            zip_path,
                            matched_member,
                            destination,
                        )
                extracted.append(
                    {
                        "source": f"{rel(zip_path)}::{matched_member}",
                        "normalizedPath": rel(destination),
                        "role": required["role"],
                        "bytes": destination.stat().st_size,
                        "sha256": sha256_file(destination),
                    }
                )
                source_gates.append(
                    required_zip_source_gate(
                        required,
                        zip_path,
                        "available",
                        "The required SEG-Y member was extracted and is available to the browser builder.",
                        destination,
                    )
                )
        except Exception as exc:
            source_gates.append(
                required_zip_source_gate(
                    required,
                    zip_path,
                    "source-member-corrupt",
                    "The required SEG-Y member is listed in the official GDR zip, but the zip member cannot be fully extracted or CRC-validated.",
                    None,
                    f"{type(exc).__name__}: {exc}",
                )
            )
    return {"normalizedFiles": extracted, "sourceGates": source_gates}


def normalize_sources() -> dict[str, Any]:
    existing_root = active_phase3_source_root()
    if existing_root != PHASE3_SOURCE_ROOT and (existing_root / "source").exists():
        required_zip_result = extract_required_zip_source_members(existing_root / "source")
        extracted_required = required_zip_result["normalizedFiles"]
        extracted_paths = {entry["normalizedPath"] for entry in extracted_required}
        normalized_files = [
            {
                "source": rel(path),
                "normalizedPath": rel(path),
                "role": "archived-normalized-source",
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
            for path in sorted((existing_root / "source").rglob("*"))
            if path.is_file()
            and not is_raw_path(path)
            and rel(path) not in extracted_paths
        ]
        return {
            "normalizedFiles": [*extracted_required, *normalized_files],
            "requiredProductSourceGates": required_zip_result["sourceGates"],
            "skippedRawFiles": 0,
            "sourceRoot": rel(existing_root),
            "sourceRootRole": "archive-normalized-source-fallback",
        }

    src1015, src1141 = source_roots()
    normalized: list[dict[str, Any]] = []
    skipped_raw = 0

    def record_copy(source: Path, destination: Path, role: str) -> None:
        copy_or_link(source, destination)
        normalized.append(
            {
                "source": rel(source),
                "normalizedPath": rel(destination),
                "role": role,
                "bytes": destination.stat().st_size,
                "sha256": sha256_file(destination),
            }
        )

    dest1141 = PHASE3_SOURCE_ROOT / "source" / "from_submission_1141"
    for source in src1141.rglob("*"):
        if not source.is_file() or is_raw_path(source) or "__MACOSX" in source.parts:
            continue
        if source.suffix.lower() not in {".segy", ".sgy", ".txt", ".pdf", ".zip", ".md"}:
            continue
        destination = dest1141 / source.relative_to(src1141)
        record_copy(source, destination, "active-reprocessed-product")

    dest1015 = PHASE3_SOURCE_ROOT / "source" / "from_submission_1015"
    for source in src1015.rglob("*"):
        if not source.is_file():
            continue
        if is_raw_path(source):
            skipped_raw += 1
            continue
        lower = source.name.lower()
        if lower == "2d_seismic_data.zip":
            with zipfile.ZipFile(source) as archive:
                for name in archive.namelist():
                    lower_name = name.lower()
                    if not (
                        lower_name.startswith("2d/processed_data/")
                        or lower_name.endswith("uofutah-forge2d-301-loading-sheet-01312018.pdf")
                    ):
                        continue
                    if lower_name.endswith("/"):
                        continue
                    destination = dest1015 / name
                    ensure_dir(destination.parent)
                    with archive.open(name) as src, destination.open("wb") as dst:
                        shutil.copyfileobj(src, dst)
                    normalized.append(
                        {
                            "source": f"{rel(source)}::{name}",
                            "normalizedPath": rel(destination),
                            "role": "extracted-original-processed-2d",
                            "bytes": destination.stat().st_size,
                            "sha256": sha256_file(destination),
                        }
                    )
            continue
        if source.suffix.lower() not in {".sp1", ".txt", ".xls", ".zip", ".sgy", ".segy", ".pdf", ".md"}:
            continue
        destination = dest1015 / source.relative_to(src1015)
        record_copy(source, destination, "active-navigation-or-velocity")

    required_zip_result = extract_required_zip_source_members(PHASE3_SOURCE_ROOT / "source")
    normalized.extend(required_zip_result["normalizedFiles"])

    return {
        "sourceRoots": {
            "submission1015": rel(src1015),
            "submission1141": rel(src1141),
        },
        "normalizedFiles": normalized,
        "requiredProductSourceGates": required_zip_result["sourceGates"],
        "skippedRawGatherFileCount": skipped_raw,
        "notes": [
            "Active processed products, navigation, velocity, and documentation are normalized into the Phase 3 seismic source slot.",
            "Raw correlated/uncorrelated shot gathers remain quarantined in their original source staging folders and are not active browser products.",
            "Existing source copies are never deleted by this script.",
        ],
    }


def project_origin_payload() -> dict[str, float]:
    return {
        "easting_m": UTAH_FORGE_PROJECT_FRAME.origin_easting_m,
        "northing_m": UTAH_FORGE_PROJECT_FRAME.origin_northing_m,
        "elevation_m": UTAH_FORGE_PROJECT_FRAME.origin_elevation_m,
    }


def seismic_navigation_registration(source_crs: str) -> dict[str, Any]:
    return registration_metadata(
        horizontal_crs=source_crs,
        vertical_datum="source SP1 survey elevation in metres",
        coordinate_basis="utm",
        origin=project_origin_payload(),
        rotation_deg=0.0,
        registration_status="unverified",
        notes=(
            "SP1 source coordinates are transformed into the Utah FORGE project "
            "horizontal frame before subtracting the GeoSee project origin. "
            "Survey-grade acceptance remains pending control-point review."
        ),
    )


def parse_sp1(path: Path, source_crs: str) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []
    for line in path.read_text(errors="replace").splitlines()[15:]:
        m = re.search(r"(\d{6})\s+\d{8}N\d{9}W\s+(\d{7})(\d{8})(\d{5})", line)
        if not m:
            continue
        station = m.group(1)
        easting = int(m.group(2)) / 10.0
        northing = int(m.group(3)) / 10.0
        elevation = int(m.group(4)) / 10.0
        scene = source_to_scene(easting, northing, elevation, source_crs)
        points.append(
            {
                "station": station,
                "line": station[:3],
                "sourceCrs": source_crs,
                "easting_m": easting,
                "northing_m": northing,
                "elevation_m": elevation,
                "scene": scene,
            }
        )
    return points


def build_navigation_geojson() -> dict[str, Any]:
    nav_root = active_phase3_source_root() / "source" / "from_submission_1015"
    sources = [
        ("3d-receiver", "receiver", nav_root / "Navigation" / "Forge-3D-Receiver-Survey-NAD83-UTM12.sp1", UTAH_FORGE_HORIZONTAL_CRS),
        ("3d-source", "source", nav_root / "Navigation" / "Forge-3D-Source-Survey-NAD83-UTM12.sp1", UTAH_FORGE_HORIZONTAL_CRS),
        ("2d-receiver", "receiver", nav_root / "2D" / "Forge 2D Receiver Survey NAD83 UTM 12.sp1", UTAH_FORGE_HORIZONTAL_CRS),
        ("2d-source", "source", nav_root / "2D" / "Forge 2D Source Survey NAD83 UTM 12.sp1", UTAH_FORGE_HORIZONTAL_CRS),
    ]
    features: list[dict[str, Any]] = []
    all_points: list[dict[str, Any]] = []
    line_paths: dict[str, list[dict[str, Any]]] = {}

    for dataset_id, role, path, source_crs in sources:
        if not path.exists():
            continue
        points = parse_sp1(path, source_crs)
        all_points.extend(points)
        for point in points:
            key = f"{dataset_id}-{point['line']}"
            line_paths.setdefault(key, []).append(point)
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "id": f"{dataset_id}-{point['station']}",
                        "displayName": f"{role.title()} {point['station']}",
                        "role": role,
                        "survey": dataset_id,
                        "line": point["line"],
                        "station": point["station"],
                        "sourceCrs": point["sourceCrs"],
                        "horizontalCrs": UTAH_FORGE_HORIZONTAL_CRS,
                        "verticalDatum": "source SP1 survey elevation in metres",
                        "coordinateBasis": "utm",
                        "registrationStatus": "unverified",
                    },
                    "geometry": {"type": "Point", "coordinates": point["scene"]},
                }
            )

    for key, points in line_paths.items():
        ordered = sorted(points, key=lambda p: p["station"])
        if len(ordered) < 2:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": key,
                    "displayName": key.replace("-", " ").title(),
                    "role": "survey-line",
                    "sourceCrs": ordered[0]["sourceCrs"],
                    "horizontalCrs": UTAH_FORGE_HORIZONTAL_CRS,
                    "verticalDatum": "source SP1 survey elevation in metres",
                    "coordinateBasis": "utm",
                    "registrationStatus": "unverified",
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [p["scene"] for p in ordered],
                },
            }
        )

    xs = [p["scene"][0] for p in all_points]
    ys = [p["scene"][1] for p in all_points]
    zs = [p["scene"][2] for p in all_points]
    bounds = {
        "min": [min(xs), min(ys), min(zs)] if all_points else [0, 0, 0],
        "max": [max(xs), max(ys), max(zs)] if all_points else [1, 1, 1],
    }
    return {
        "type": "FeatureCollection",
        "name": "Utah FORGE Phase 3 seismic navigation",
        "properties": {
            "schema": "geosee.seismic-navigation.geojson.v1",
            "sourceCrs": UTAH_FORGE_HORIZONTAL_CRS,
            "horizontalCrs": UTAH_FORGE_HORIZONTAL_CRS,
            "verticalDatum": "source SP1 survey elevation in metres",
            "units": "m",
            "coordinateBasis": "utm",
            "origin": project_origin_payload(),
            "rotationDeg": UTAH_FORGE_PROJECT_FRAME.rotation_deg,
            "registrationStatus": "unverified",
            "registration": seismic_navigation_registration(UTAH_FORGE_HORIZONTAL_CRS),
            "axisConvention": "X east, Y north, Z up",
            "sceneOriginUtm": project_origin_payload(),
            "transformPipeline": [
                "parse declared SP1 coordinates",
                "transform source CRS into EPSG:26912 project frame with pyproj.Transformer",
                "subtract GeoSee project origin",
            ],
            "pointCount": len(all_points),
            "sceneBounds": bounds,
        },
        "features": features,
    }


def slugify(text: str) -> str:
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text or "product"


def product_kind(path: Path) -> str:
    name = path.name.lower()
    if "velocity" in name or "velo" in name:
        return "velocity"
    if "poststack" in name:
        return "poststack-time-migration"
    if "psdm" in name or "pdm" in name or "depth" in name:
        return "psdm"
    if "pstm" in name or "migr" in name:
        return "pstm"
    if "unmigrated" in name:
        return "unmigrated-time-stack"
    if "stack" in name:
        return "stack"
    return "processed"


def domain_kind(path: Path, kind: str) -> tuple[str, str]:
    name = path.name.lower()
    if kind == "velocity":
        return "velocity-time", "ms"
    if "depth" in name or "psdm" in name or "pdm" in name or "meters" in name:
        return "depth", "m"
    return "time", "ms"


HEADER_MEASURE_PATTERN = r"([0-9]+(?:\.[0-9]+)?)\s*(milliseconds?|ms|meters?|metres?|feet|foot|ft|m)\b"


def normalized_header_unit(unit: str) -> str:
    normalized = unit.strip().lower()
    if normalized in {"meter", "meters", "metre", "metres", "m"}:
        return "m"
    if normalized in {"feet", "foot", "ft"}:
        return "ft"
    if normalized in {"millisecond", "milliseconds", "ms"}:
        return "ms"
    return normalized


def header_measure(text_header: str, label: str) -> tuple[float, str] | None:
    pattern = rf"\b{re.escape(label)}\s*:\s*{HEADER_MEASURE_PATTERN}"
    match = re.search(pattern, text_header, re.IGNORECASE)
    if not match:
        return None
    return float(match.group(1)), normalized_header_unit(match.group(2))


def header_shift_up_m(text_header: str) -> float:
    match = re.search(rf"\bshifted\s+up\s+{HEADER_MEASURE_PATTERN}", text_header, re.IGNORECASE)
    if not match:
        return 0.0
    value = float(match.group(1))
    unit = normalized_header_unit(match.group(2))
    if unit == "ft":
        return value * FT_TO_M
    if unit == "m":
        return value
    return 0.0


def header_value_to_m(value: float, unit: str) -> float | None:
    if unit == "ft":
        return value * FT_TO_M
    if unit == "m":
        return value
    return None


def measures_close(actual: float, expected: float, relative_tolerance: float = 0.05) -> bool:
    tolerance = max(0.01, abs(expected) * relative_tolerance)
    return abs(actual - expected) <= tolerance


def sample_axis_from_header(
    text_header: str,
    raw_samples: np.ndarray,
    domain: tuple[str, str],
) -> tuple[np.ndarray, tuple[str, str], str | None, dict[str, Any]]:
    raw_spacing = float(abs(float(raw_samples[1]) - float(raw_samples[0]))) if len(raw_samples) > 1 else 0.0
    raw_min = float(raw_samples[0]) if len(raw_samples) else 0.0
    raw_max = float(raw_samples[-1]) if len(raw_samples) else 0.0
    metadata: dict[str, Any] = {
        "source": "segy-sample-labels",
        "rawSampleRange": [round(raw_min, 6), round(raw_max, 6)],
        "rawSampleSpacing": round(raw_spacing, 6),
        "warnings": [],
    }
    if domain[0] != "depth":
        return raw_samples, domain, None, metadata

    sample_measure = header_measure(text_header, "SAMPLE INT")
    if not sample_measure:
        metadata["warnings"].append("SEG-Y textual header has no SAMPLE INT entry for depth axis.")
        return raw_samples, domain, None, metadata

    spacing_value, spacing_unit = sample_measure
    spacing_m = header_value_to_m(spacing_value, spacing_unit)
    if spacing_m is None:
        metadata["warnings"].append(f"Unsupported depth SAMPLE INT unit: {spacing_unit}.")
        return raw_samples, domain, None, metadata

    trace_length_measure = header_measure(text_header, "TRACE LENGTH")
    trace_length_m = (
        header_value_to_m(trace_length_measure[0], trace_length_measure[1])
        if trace_length_measure
        else None
    )
    raw_samples_m = raw_samples.astype(np.float32) * np.float32(FT_TO_M if spacing_unit == "ft" else 1.0)
    interval_samples_m = np.arange(len(raw_samples), dtype=np.float32) * np.float32(spacing_m)
    interval_max = float(interval_samples_m[-1]) if len(interval_samples_m) else 0.0
    raw_max_m = float(raw_samples_m[-1]) if len(raw_samples_m) else 0.0
    source_unit_status = (
        "header-indicated-depth-ft-converted-to-m"
        if spacing_unit == "ft"
        else "header-indicated-depth-m"
    )
    metadata.update(
        {
            "source": "header-sample-interval",
            "headerSampleInterval": {"value": spacing_value, "unit": spacing_unit},
            "headerTraceLength": (
                {"value": trace_length_measure[0], "unit": trace_length_measure[1]}
                if trace_length_measure
                else None
            ),
            "unitConversion": (
                "source depth feet converted to scene metres"
                if spacing_unit == "ft"
                else "source depth metres preserved"
            ),
        }
    )

    if trace_length_m and interval_max > trace_length_m * 1.05:
        metadata["warnings"].append(
            "Header SAMPLE INT over-runs TRACE LENGTH for the SEG-Y sample count; "
            "using TRACE LENGTH to keep the section in the declared depth range."
        )
        if raw_max_m and measures_close(raw_max_m, trace_length_m):
            metadata["source"] = "segy-sample-labels-validated-by-header-trace-length"
            return raw_samples_m, ("depth", "m"), source_unit_status, metadata
        metadata["source"] = "header-trace-length-derived"
        samples_m = np.linspace(0.0, trace_length_m, len(raw_samples), dtype=np.float32)
        return samples_m, ("depth", "m"), source_unit_status, metadata

    if trace_length_m and interval_max < trace_length_m * 0.5 and raw_max_m and measures_close(raw_max_m, trace_length_m):
        metadata["warnings"].append(
            "Header SAMPLE INT under-runs TRACE LENGTH while SEG-Y sample labels match TRACE LENGTH; "
            "using sample labels converted to scene metres."
        )
        metadata["source"] = "segy-sample-labels-validated-by-header-trace-length"
        return raw_samples_m, ("depth", "m"), source_unit_status, metadata

    if raw_max_m and measures_close(raw_max_m, interval_max):
        metadata["source"] = "segy-sample-labels-validated-by-header-sample-interval"
        return raw_samples_m, ("depth", "m"), source_unit_status, metadata

    return interval_samples_m, ("depth", "m"), source_unit_status, metadata


def survey_kind(path: Path) -> str:
    parts = [p.lower() for p in path.parts]
    name = path.name.lower()
    if "legacy line 5" in " ".join(parts) or "legacy line 11" in " ".join(parts):
        return "legacy-2d"
    if "3d survey" in " ".join(parts) or "forge3d" in name:
        return "3d"
    return "2d"


def source_header_datum_m(text_header: str) -> float | None:
    datum_measure = header_measure(text_header, "DATUM")
    if not datum_measure:
        return None
    value, unit = datum_measure
    if unit == "ft":
        return value * FT_TO_M
    if unit == "m":
        return value
    return None


def parsed_datum_m(text_header: str) -> float | None:
    raw_datum = source_header_datum_m(text_header)
    if raw_datum is None:
        return None
    return raw_datum - header_shift_up_m(text_header)


def legacy_reference_datum_metadata(source_header_datum_m: float) -> dict[str, Any]:
    return {
        "sourceHeaderDatumM": round(source_header_datum_m, 6),
        "datumNormalizationM": round(
            SEISMIC_REFERENCE_DATUM_M - source_header_datum_m,
            6,
        ),
        "datumNormalizationReason": (
            "Legacy L5/L11 SEG-Y headers declare a 7000 ft processing datum; "
            "GeoSee renders those legacy products against the 1800 m seismic "
            "reference datum while retaining the source header datum for audit."
        ),
    }


def datum_for_product(
    path: Path,
    text_header: str,
    survey: str,
) -> tuple[float, dict[str, Any]]:
    raw_header_datum = source_header_datum_m(text_header)
    parsed = parsed_datum_m(text_header)
    if parsed is None:
        return SEISMIC_REFERENCE_DATUM_M, {}
    if (
        survey == "legacy-2d"
        and raw_header_datum is not None
        and not measures_close(raw_header_datum, SEISMIC_REFERENCE_DATUM_M, 0.001)
    ):
        return SEISMIC_REFERENCE_DATUM_M, legacy_reference_datum_metadata(raw_header_datum)
    return parsed, {}


def vertical_reference_for(
    domain: tuple[str, str],
    datum_m: float,
    source_unit_status: str | None = None,
    datum_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    domain_kind_value, domain_unit = domain
    mode = (
        "depth-below-datum-to-absolute-elevation"
        if domain_unit == "m"
        else "display-depth-below-datum-to-absolute-elevation"
    )
    reference = {
        "verticalDatum": "absolute elevation metres above sea level in GeoSee scene coordinates",
        "sourceDatumM": datum_m,
        "referenceDatumM": SEISMIC_REFERENCE_DATUM_M,
        "depthElevationMode": mode,
        "sourceSampleUnit": domain_unit,
        "sceneZUnit": "m",
        "transform": "sceneZ_m = datumM - sample * verticalScaleMPerUnit",
        "domainKind": domain_kind_value,
        "calibration": TOP_OF_GRANITE_CALIBRATION,
    }
    if source_unit_status:
        reference["sourceUnitStatus"] = source_unit_status
        if source_unit_status.startswith("header-unresolved"):
            reference["sourceUnitCaveat"] = (
                "SEG-Y textual header does not prove the source sample unit; "
                "depth metres are inferred from filename and product classification."
            )
    if datum_metadata:
        reference.update(datum_metadata)
    return reference


def value_encoding_for(kind: str) -> dict[str, Any]:
    if kind == "velocity":
        return {
            "storedTextureEncoding": "uint8-normalized-p02-p98",
            "sourceValueMeaning": "interval velocity",
            "displayUnit": "m/s",
            "displayRangeMPerS": VELOCITY_DISPLAY_RANGE_M_PER_S,
        }
    return {
        "storedTextureEncoding": "uint8-normalized-p02-p98",
        "sourceValueMeaning": "processed seismic amplitude",
        "displayUnit": "normalized amplitude",
    }


def trace_line_id(path: Path) -> str:
    text = path.name.lower()
    if "301" in text:
        return "301"
    if "302" in text:
        return "302"
    if "l5" in text or "line 5" in " ".join(p.lower() for p in path.parts):
        return "L5"
    if "l11" in text or "line 11" in " ".join(p.lower() for p in path.parts):
        return "L11"
    if re.search(r"(?:^|[^0-9])95(?:[^0-9]|$)", text):
        return "95"
    return "3d"


def enhancement_status(path: Path) -> str | None:
    compact = re.sub(r"[^a-z0-9]+", "", path.stem.lower())
    if "unenh" in compact:
        return "unenhanced"
    if "enh" in compact:
        return "enhanced"
    return None


def source_line_label(path: Path) -> str:
    text = f"{path.name.lower()} {' '.join(p.lower() for p in path.parts)}"
    if "301" in text:
        return "Line 301"
    if "302" in text:
        return "Line 302"
    if "l11" in text or "line 11" in text:
        return "Line L11"
    if "l5" in text or "line 5" in text:
        return "Line L5"
    return "Line"


def product_label(path: Path, survey: str, kind: str, domain: tuple[str, str]) -> str:
    return canonical_product_metadata(path, survey, kind, domain, "")["canonicalLabel"]


def source_text_name(path: Path, text_header: str) -> str:
    return f"{text_header} {path.name} {' '.join(path.parts)}".lower()


def canonical_product_metadata(
    path: Path,
    survey: str,
    kind: str,
    domain: tuple[str, str],
    text_header: str,
) -> dict[str, Any]:
    name = path.name.lower()
    source_text = source_text_name(path, text_header)
    enhancement = enhancement_status(path)
    modifiers: list[str] = []
    if enhancement:
        modifiers.append(enhancement)
    if "meters" in name:
        modifiers.append("meters")
    modifier_text = f" ({', '.join(modifiers)})" if modifiers else ""
    label_basis = "segy-text-header" if text_header.strip() else "filename"

    if survey == "3d":
        if kind == "velocity":
            descriptor = "velocity model (time domain)"
            processing_stage = "velocity-model"
            label = "3D velocity model (time domain)"
        elif "poststack" in name:
            descriptor = "post-stack time migration FXY decon stack"
            processing_stage = "poststack-time-migration"
            label = "3D post-stack time migration FXY decon stack"
        elif "ani" in name and "psdm" in name:
            descriptor = "anisotropic PSDM depth stack"
            processing_stage = "psdm-depth-volume"
            label = f"3D anisotropic PSDM depth stack{modifier_text}"
        elif "pstm" in name:
            descriptor = "PSTM time stack"
            processing_stage = "pstm-time-volume"
            label = f"3D PSTM time stack{modifier_text}"
        else:
            descriptor = "processed seismic volume"
            processing_stage = "processed-volume"
            label = f"3D processed seismic volume{modifier_text}"
        return {
            "lineId": "3d",
            "lineLabel": "3D survey",
            "processingStage": processing_stage,
            "canonicalLabel": label,
            "sourceDescriptor": descriptor,
            "nameEvidence": {
                "labelBasis": label_basis,
                "sourceFileName": path.name,
                "sourceStem": path.stem,
                "sourceSubmission": None,
                "sourceFile": rel(path),
                "textHeaderExcerpt": text_header,
            },
        }

    prefix = "2D"
    line = source_line_label(path)
    if kind == "velocity":
        descriptor = "PSDM interval velocity" if "interval" in name else "velocity model"
        processing_stage = "psdm-interval-velocity" if "interval" in source_text else "velocity-model"
    elif "unmigrated" in name:
        descriptor = "unmigrated time stack"
        processing_stage = "unmigrated-time-stack"
    elif "migrated" in source_text and "depth" in source_text and "unmigrated" not in source_text:
        descriptor = "migrated depth section"
        processing_stage = "migrated-depth-section"
    elif kind == "poststack-time-migration":
        descriptor = "post-stack time migration section"
        processing_stage = "poststack-time-migration"
    elif kind == "psdm":
        if "migr" in name and "depth" in name and "psdm" not in source_text and "pdm" not in name:
            descriptor = "migrated depth section"
            processing_stage = "migrated-depth-section"
        else:
            descriptor = "PSDM depth section"
            processing_stage = "psdm-depth-section"
    elif kind == "pstm":
        descriptor = "PSTM time stack"
        processing_stage = "pstm-time-stack"
    elif kind == "stack":
        descriptor = "time stack"
        processing_stage = "time-stack"
    elif "migr" in name and "depth" in name:
        descriptor = "migrated depth section"
        processing_stage = "migrated-depth-section"
    else:
        descriptor = "processed seismic section"
        processing_stage = "processed-section"

    label = f"{prefix} {line} {descriptor}{modifier_text}"
    return {
        "lineId": trace_line_id(path),
        "lineLabel": line,
        "processingStage": processing_stage,
        "canonicalLabel": label,
        "sourceDescriptor": descriptor,
        "nameEvidence": {
            "labelBasis": label_basis,
            "sourceFileName": path.name,
            "sourceStem": path.stem,
            "sourceSubmission": None,
            "sourceFile": rel(path),
            "textHeaderExcerpt": text_header,
        },
    }


def read_text_header(f: segyio.SegyFile) -> str:
    raw = f.text[0]
    for encoding in ("ascii", "cp500", "latin-1"):
        text = raw.decode(encoding, errors="replace")
        if "CLIENT" in text or encoding == "latin-1":
            return " ".join(text.split())[:3200]
    return ""


def sample_byte_size(format_code: int) -> int:
    return {
        1: 4,
        2: 4,
        3: 2,
        5: 4,
        6: 8,
        8: 1,
    }.get(format_code, 4)


def segy_header_offset(byte_number: int) -> int:
    return byte_number - 1


def ibm_float32(raw: bytes) -> float | None:
    if len(raw) != 4 or raw == b"\x00\x00\x00\x00":
        return None
    word = int.from_bytes(raw, "big", signed=False)
    sign = -1.0 if word & 0x80000000 else 1.0
    exponent = ((word >> 24) & 0x7F) - 64
    fraction = word & 0x00FFFFFF
    if fraction == 0:
        return 0.0
    return sign * (fraction / float(0x01000000)) * (16.0**exponent)


def int16_be(raw: bytes) -> int | None:
    if len(raw) != 2:
        return None
    return struct.unpack(">h", raw)[0]


def plausible_utm(easting: float | None, northing: float | None) -> bool:
    if easting is None or northing is None:
        return False
    return (
        math.isfinite(easting)
        and math.isfinite(northing)
        and 250000.0 <= easting <= 450000.0
        and 4200000.0 <= northing <= 4350000.0
    )


def round_scene_point(point: list[float] | tuple[float, ...]) -> list[float]:
    return [round(float(point[0]), 4), round(float(point[1]), 4), round(float(point[2]), 4)]


def scene_from_utm(easting: float, northing: float, elevation: float = 0.0) -> list[float]:
    return round_scene_point(source_to_scene(easting, northing, elevation, UTAH_FORGE_HORIZONTAL_CRS))


def legacy_state_plane_header(text_header: str) -> bool:
    text = text_header.lower()
    return "state plane" in text and ("nad 27" in text or "nad27" in text)


def custom_trace_coordinate_fields() -> dict[str, Any]:
    return {
        "cmpX": {"byte": 189, "format": "ibm-real-4"},
        "cmpY": {"byte": 193, "format": "ibm-real-4"},
        "inline": {"bytes": [9, 10], "format": "int16"},
        "crossline": {"bytes": [13, 14], "format": "int16"},
    }


def custom_trace_geometry(
    *,
    trace_count: int,
    rows: list[dict[str, Any]],
    geometry_source: str,
    coordinate_fields: dict[str, Any] | None = None,
    source_coordinate_system: dict[str, Any] | None = None,
    coordinate_transform: dict[str, Any] | None = None,
) -> dict[str, Any]:
    geometry: dict[str, Any] = {
        "status": "trace-header-derived",
        "geometrySource": geometry_source,
        "traceCount": trace_count,
        "rows": rows,
        "coordinateFields": coordinate_fields or custom_trace_coordinate_fields(),
    }
    if source_coordinate_system:
        geometry["sourceCoordinateSystem"] = source_coordinate_system
    if coordinate_transform:
        geometry["coordinateTransform"] = coordinate_transform
    grid = trace_geometry_grid(rows)
    if grid:
        geometry["grid"] = grid
    return geometry


def state_plane_candidate_transform(
    raw_rows: list[dict[str, Any]],
    trace_count: int,
    text_header: str,
) -> dict[str, Any] | None:
    if not legacy_state_plane_header(text_header) or not raw_rows:
        return None

    best_candidate: tuple[int, float, dict[str, Any], list[dict[str, Any]]] | None = None
    for candidate in LEGACY_STATE_PLANE_CRS_CANDIDATES:
        transformer = Transformer.from_crs(f"EPSG:{candidate['epsg']}", UTAH_FORGE_HORIZONTAL_CRS, always_xy=True)
        transformed_rows: list[dict[str, Any]] = []
        eastings: list[float] = []
        northings: list[float] = []
        for row in raw_rows:
            source_x, source_y = row["sourceCmp"]
            try:
                easting, northing = transformer.transform(float(source_x), float(source_y))
            except Exception:
                continue
            if not plausible_utm(easting, northing):
                continue
            eastings.append(float(easting))
            northings.append(float(northing))
            transformed_rows.append(
                {
                    "traceIndex": row["traceIndex"],
                    "inline": row["inline"],
                    "crossline": row["crossline"],
                    "sourceCmp": row["sourceCmp"],
                    "cmpUtm": [float(easting), float(northing)],
                    "scene": scene_from_utm(float(easting), float(northing), 0.0),
                }
            )
        if len(transformed_rows) < max(4, int(trace_count * 0.8)):
            continue
        centroid_distance = math.hypot(
            (sum(eastings) / len(eastings)) - UTAH_FORGE_EXPECTED_UTM_CENTER[0],
            (sum(northings) / len(northings)) - UTAH_FORGE_EXPECTED_UTM_CENTER[1],
        )
        if best_candidate is None or len(transformed_rows) > best_candidate[0] or (
            len(transformed_rows) == best_candidate[0] and centroid_distance < best_candidate[1]
        ):
            best_candidate = (len(transformed_rows), centroid_distance, candidate, transformed_rows)

    if best_candidate is None:
        return None

    _, centroid_distance, candidate, rows = best_candidate
    return custom_trace_geometry(
        trace_count=trace_count,
        rows=rows,
        geometry_source="trace-header-cmp-ibm-real-state-plane-nad27-ftus-to-utm",
        coordinate_fields={
            **custom_trace_coordinate_fields(),
            "sourceCoordinateSystem": {
                "epsg": candidate["epsg"],
                "name": candidate["name"],
                "unit": "US survey foot",
            },
            "targetCoordinateSystem": {
                "epsg": 26912,
                "name": "NAD83 / UTM Zone 12N",
                "unit": "metre",
            },
        },
        source_coordinate_system={
            "epsg": candidate["epsg"],
            "name": candidate["name"],
            "unit": "US survey foot",
            "headerEvidence": "US STATE PLANE NAD 27",
            "selectionReason": candidate["reason"],
        },
        coordinate_transform={
            "method": "pyproj.Transformer.from_crs(..., EPSG:26912, always_xy=True)",
            "targetEpsg": 26912,
            "candidateEpsg": candidate["epsg"],
            "acceptedTraceCount": len(rows),
            "centroidDistanceToForgeM": round(centroid_distance, 3),
            "selectionRule": "choose transformed candidate with plausible UTM coordinates nearest expected FORGE survey center",
        },
    )


def scaled_header_coordinate(value: float, scalar: int) -> float:
    if scalar > 0:
        return value * scalar
    if scalar < 0:
        return value / abs(scalar)
    return value


def standard_header_coordinate_pair(header: segyio.Field) -> tuple[float, float, str] | None:
    scalar = int(header.get(segyio.TraceField.SourceGroupScalar, 0) or 0)
    candidate_fields = [
        ("CDP_X", "CDP_Y"),
        ("SourceX", "SourceY"),
        ("GroupX", "GroupY"),
    ]
    for x_name, y_name in candidate_fields:
        x_field = getattr(segyio.TraceField, x_name, None)
        y_field = getattr(segyio.TraceField, y_name, None)
        if x_field is None or y_field is None:
            continue
        raw_x = float(header.get(x_field, 0) or 0)
        raw_y = float(header.get(y_field, 0) or 0)
        for mode, x_value, y_value in (
            ("scaled", scaled_header_coordinate(raw_x, scalar), scaled_header_coordinate(raw_y, scalar)),
            ("raw", raw_x, raw_y),
        ):
            if plausible_utm(x_value, y_value):
                return x_value, y_value, f"{x_name}/{y_name}:{mode}"
    return None


def geometry_bounds_utm(rows: list[dict[str, Any]]) -> dict[str, list[float]]:
    eastings = [float(row["cmpUtm"][0]) for row in rows]
    northings = [float(row["cmpUtm"][1]) for row in rows]
    return {
        "min": [round(min(eastings), 4), round(min(northings), 4)],
        "max": [round(max(eastings), 4), round(max(northings), 4)],
    }


def geometry_bounds_scene(
    rows: list[dict[str, Any]],
    sample_min: float,
    sample_max: float,
    datum_m: float,
    vertical_scale: float,
) -> dict[str, list[float]]:
    xs = [float(row["scene"][0]) for row in rows]
    ys = [float(row["scene"][1]) for row in rows]
    z_min = datum_m - sample_max * vertical_scale
    z_max = datum_m - sample_min * vertical_scale
    return {
        "min": [round(min(xs), 4), round(min(ys), 4), round(min(z_min, z_max), 4)],
        "max": [round(max(xs), 4), round(max(ys), 4), round(max(z_min, z_max), 4)],
    }


def trace_geometry_grid(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    keyed_rows = [
        row
        for row in rows
        if isinstance(row.get("inline"), int) and isinstance(row.get("crossline"), int)
    ]
    if len(keyed_rows) < 4:
        return None
    inline_values = sorted({int(row["inline"]) for row in keyed_rows})
    crossline_values = sorted({int(row["crossline"]) for row in keyed_rows})
    trace_by_key = {
        (int(row["inline"]), int(row["crossline"])): row
        for row in keyed_rows
    }
    if len(trace_by_key) < max(4, int(len(inline_values) * len(crossline_values) * 0.8)):
        return None
    return {
        "inlineValues": inline_values,
        "crosslineValues": crossline_values,
        "traceByKey": trace_by_key,
    }


def grid_corner_rows(grid: dict[str, Any]) -> dict[str, dict[str, Any]] | None:
    inline_values = grid["inlineValues"]
    crossline_values = grid["crosslineValues"]
    trace_by_key = grid["traceByKey"]
    keys = {
        "sw": (inline_values[0], crossline_values[0]),
        "nw": (inline_values[-1], crossline_values[0]),
        "ne": (inline_values[-1], crossline_values[-1]),
        "se": (inline_values[0], crossline_values[-1]),
    }
    if not all(key in trace_by_key for key in keys.values()):
        return None
    return {label: trace_by_key[key] for label, key in keys.items()}


def trace_geometry_manifest_summary(
    geometry: dict[str, Any],
    samples: np.ndarray,
    domain: tuple[str, str],
    datum_m: float,
) -> dict[str, Any]:
    rows = geometry["rows"]
    vertical_scale = TIME_SCALE_M_PER_MS if domain[1] == "ms" else 1.0
    summary = {
        "status": geometry["status"],
        "geometrySource": geometry["geometrySource"],
        "horizontalCrs": {
            "epsg": 26912,
            "name": "NAD83 / UTM Zone 12N",
        },
        "coordinateBasis": "utm-trace-header-cmp",
        "traceCount": geometry["traceCount"],
        "validTraceCount": len(rows),
        "coordinateFields": geometry["coordinateFields"],
        "cmpBoundsUtm": geometry_bounds_utm(rows) if rows else None,
        "sceneBounds": (
            geometry_bounds_scene(rows, float(samples[0]), float(samples[-1]), datum_m, vertical_scale)
            if rows and len(samples)
            else None
        ),
        "registrationStatus": "unverified",
        "canClaimPreciseRegistration": False,
        "reason": (
            "Trace-header coordinates are used for placement; survey-grade "
            "registration claims remain review-gated until control-point validation."
        ),
    }
    if geometry.get("sourceCoordinateSystem"):
        summary["sourceCoordinateSystem"] = geometry["sourceCoordinateSystem"]
    if geometry.get("coordinateTransform"):
        summary["coordinateTransform"] = geometry["coordinateTransform"]
    grid = geometry.get("grid")
    if grid:
        corner_rows = grid_corner_rows(grid)
        summary["inlineRange"] = [grid["inlineValues"][0], grid["inlineValues"][-1]]
        summary["crosslineRange"] = [grid["crosslineValues"][0], grid["crosslineValues"][-1]]
        summary["grid"] = {
            "inlineCount": len(grid["inlineValues"]),
            "crosslineCount": len(grid["crosslineValues"]),
            "completeTraceCount": len(grid["traceByKey"]),
        }
        if corner_rows:
            summary["cmpCornersUtm"] = {
                key: [round(float(row["cmpUtm"][0]), 4), round(float(row["cmpUtm"][1]), 4)]
                for key, row in corner_rows.items()
            }
            summary["sceneCorners"] = {
                key: row["scene"]
                for key, row in corner_rows.items()
            }
    return summary


def read_custom_trace_header_geometry(
    path: Path,
    trace_count: int,
    sample_count: int,
    sample_format: int,
    ext_headers: int,
    text_header: str,
) -> dict[str, Any] | None:
    trace_stride = 240 + sample_count * sample_byte_size(sample_format)
    data_start = 3600 + ext_headers * 3200
    rows: list[dict[str, Any]] = []
    raw_rows: list[dict[str, Any]] = []
    with path.open("rb") as source:
        for trace_index in range(trace_count):
            source.seek(data_start + trace_index * trace_stride)
            header = source.read(240)
            if len(header) < 240:
                break
            inline = int16_be(header[segy_header_offset(9) : segy_header_offset(9) + 2])
            crossline = int16_be(header[segy_header_offset(13) : segy_header_offset(13) + 2])
            cmp_x = ibm_float32(header[segy_header_offset(189) : segy_header_offset(189) + 4])
            cmp_y = ibm_float32(header[segy_header_offset(193) : segy_header_offset(193) + 4])
            if cmp_x is None or cmp_y is None or not math.isfinite(cmp_x) or not math.isfinite(cmp_y):
                continue
            base_row = {
                "traceIndex": trace_index,
                "inline": inline if inline and inline > 0 else None,
                "crossline": crossline if crossline and crossline > 0 else None,
                "sourceCmp": [float(cmp_x), float(cmp_y)],
            }
            raw_rows.append(base_row)
            if not plausible_utm(cmp_x, cmp_y):
                continue
            rows.append(
                {
                    "traceIndex": trace_index,
                    "inline": base_row["inline"],
                    "crossline": base_row["crossline"],
                    "sourceCmp": base_row["sourceCmp"],
                    "cmpUtm": [float(cmp_x), float(cmp_y)],
                    "scene": scene_from_utm(float(cmp_x), float(cmp_y), 0.0),
                }
            )
    if len(rows) >= max(4, int(trace_count * 0.8)):
        return custom_trace_geometry(
            trace_count=trace_count,
            rows=rows,
            geometry_source="trace-header-cmp-ibm-real",
        )
    return state_plane_candidate_transform(raw_rows, trace_count, text_header)


def read_standard_trace_header_geometry(path: Path, trace_count: int) -> dict[str, Any] | None:
    rows: list[dict[str, Any]] = []
    coordinate_field_counts: dict[str, int] = {}
    with segyio.open(str(path), "r", strict=False, ignore_geometry=True) as f:
        for trace_index in range(trace_count):
            header = f.header[trace_index]
            pair = standard_header_coordinate_pair(header)
            if pair is None:
                continue
            cmp_x, cmp_y, field_name = pair
            coordinate_field_counts[field_name] = coordinate_field_counts.get(field_name, 0) + 1
            inline_value = int(header.get(segyio.TraceField.INLINE_3D, 0) or 0)
            crossline_value = int(header.get(segyio.TraceField.CROSSLINE_3D, 0) or 0)
            rows.append(
                {
                    "traceIndex": trace_index,
                    "inline": inline_value if 0 < inline_value < 100000 else None,
                    "crossline": crossline_value if 0 < crossline_value < 100000 else None,
                    "cmpUtm": [float(cmp_x), float(cmp_y)],
                    "scene": scene_from_utm(float(cmp_x), float(cmp_y), 0.0),
                }
            )
    if len(rows) < max(4, int(trace_count * 0.8)):
        return None
    dominant_field = max(coordinate_field_counts, key=coordinate_field_counts.get)
    return {
        "status": "trace-header-derived",
        "geometrySource": "trace-header-standard-coordinate",
        "traceCount": trace_count,
        "rows": rows,
        "coordinateFields": {
            "coordinatePair": dominant_field,
            "coordinateScalar": "SEG-Y SourceGroupScalar when plausible; raw coordinates fallback",
        },
    }


def read_trace_header_geometry(
    path: Path,
    trace_count: int,
    sample_count: int,
    sample_format: int,
    ext_headers: int,
    text_header: str,
) -> dict[str, Any]:
    custom = read_custom_trace_header_geometry(
        path,
        trace_count,
        sample_count,
        sample_format,
        ext_headers,
        text_header,
    )
    if custom:
        return custom
    standard = read_standard_trace_header_geometry(path, trace_count)
    if standard:
        return standard
    return {
        "status": "unresolved",
        "geometrySource": "navigation-or-envelope-fallback",
        "traceCount": trace_count,
        "rows": [],
        "coordinateFields": {},
    }


def source_unit_status_for(
    path: Path,
    text_header: str,
    domain: tuple[str, str],
    header_status: str | None = None,
) -> str:
    if domain[1] != "m":
        return "not-depth-m-domain"
    if header_status:
        return header_status
    sample_measure = header_measure(text_header, "SAMPLE INT")
    if sample_measure and sample_measure[1] == "ft":
        return "header-indicated-depth-ft-converted-to-m"
    if sample_measure and sample_measure[1] == "m":
        return "header-indicated-depth-m"
    text = text_header.lower()
    if re.search(r"\b(meters?|metres?)\b", text) or re.search(r"\b[0-9]+(?:\.[0-9]+)?\s*m\b", text):
        return "header-indicated-depth-m"
    if re.search(r"\b(feet|foot|ft)\b", text):
        return "header-indicated-depth-ft-converted-to-m"
    if "migr-depth" in path.name.lower() or "migrated" in text and "depth" in text:
        return "header-unresolved-filename-inferred-depth-m"
    return "header-unresolved-filename-inferred-depth-m"


def selected_trace_indices(trace_count: int, width: int, fraction: float | None = None) -> np.ndarray:
    width = max(2, min(width, trace_count))
    if fraction is None:
        return np.linspace(0, trace_count - 1, width).round().astype(np.int64)
    span = max(width, int(trace_count * 0.18))
    center = int(round(fraction * max(0, trace_count - 1)))
    start = max(0, min(trace_count - span, center - span // 2))
    end = min(trace_count - 1, start + span - 1)
    return np.linspace(start, end, width).round().astype(np.int64)


def selected_sample_indices(sample_count: int, height: int) -> np.ndarray:
    height = max(2, min(height, sample_count))
    return np.linspace(0, sample_count - 1, height).round().astype(np.int64)


def bounded_pair(width: int, height: int, max_pixels: int) -> tuple[int, int]:
    width = max(2, width)
    height = max(2, height)
    if width * height <= max_pixels:
        return width, height
    scale = math.sqrt(max_pixels / max(1, width * height))
    return max(2, int(width * scale)), max(2, int(height * scale))


def source_trace_grid_shape(trace_count: int) -> tuple[int, int]:
    width = max(2, int(math.sqrt(max(1, trace_count))))
    height = max(2, trace_count // width)
    while width * height > trace_count and height > 2:
        height -= 1
    while width * height > trace_count and width > 2:
        width -= 1
    return width, height


def trace_grid_shape(trace_count: int, max_width: int | None = None, max_height: int | None = None) -> tuple[int, int]:
    width, height = source_trace_grid_shape(trace_count)
    if max_width is not None:
        width = min(width, max_width)
    if max_height is not None:
        height = min(height, max_height)
    while width * height > trace_count and height > 2:
        height -= 1
    while width * height > trace_count and width > 2:
        width -= 1
    return max(2, width), max(2, height)


def source_aligned_section_shape(
    trace_count: int,
    sample_count: int,
    fraction: float | None = None,
) -> tuple[int, int]:
    natural_width = trace_count if fraction is None else max(2, int(trace_count * 0.18))
    return bounded_pair(natural_width, sample_count, SOURCE_FIDELITY_SECTION_MAX_PIXELS)


def cap_long_edge(width: int, height: int, max_long_edge: int) -> tuple[int, int]:
    long_edge = max(width, height)
    if long_edge <= max_long_edge:
        return width, height
    scale = max_long_edge / long_edge
    return max(2, int(round(width * scale))), max(2, int(round(height * scale)))


def section_shape_for_product(
    survey: str,
    trace_count: int,
    sample_count: int,
    fraction: float | None = None,
) -> tuple[int, int]:
    width, height = source_aligned_section_shape(trace_count, sample_count, fraction)
    if survey == "3d":
        return cap_long_edge(width, height, BROWSER_3D_SECTION_MAX_LONG_EDGE)
    return width, height


def source_aligned_sample_plane_shape(trace_count: int) -> tuple[int, int]:
    width, height = source_trace_grid_shape(trace_count)
    return bounded_pair(width, height, SOURCE_FIDELITY_SECTION_MAX_PIXELS)


def source_aligned_volume_shape(
    trace_count: int,
    sample_count: int,
    max_voxels: int = SOURCE_FIDELITY_VOLUME_MAX_VOXELS,
) -> tuple[int, int, int]:
    nx, ny = source_trace_grid_shape(trace_count)
    nz = max(2, sample_count)
    if nx * ny * nz <= max_voxels:
        return nx, ny, nz
    scale = (max_voxels / max(1, nx * ny * nz)) ** (1 / 3)
    nx = max(2, int(nx * scale))
    ny = max(2, int(ny * scale))
    nz = max(2, int(nz * scale))
    while nx * ny * nz > max_voxels and nz > 2:
        nz -= 1
    return nx, ny, nz


def source_aligned_volume_shape_for_grid(
    grid_width: int,
    grid_height: int,
    sample_count: int,
    max_voxels: int = SOURCE_FIDELITY_VOLUME_MAX_VOXELS,
) -> tuple[int, int, int]:
    nx = max(2, grid_width)
    ny = max(2, grid_height)
    nz = max(2, sample_count)
    if nx * ny * nz <= max_voxels:
        return nx, ny, nz
    scale = (max_voxels / max(1, nx * ny * nz)) ** (1 / 3)
    nx = max(2, int(nx * scale))
    ny = max(2, int(ny * scale))
    nz = max(2, int(nz * scale))
    while nx * ny * nz > max_voxels and nz > 2:
        nz -= 1
    return nx, ny, nz


def select_values(values: list[int], target_count: int) -> list[int]:
    indices = selected_trace_indices(len(values), target_count)
    return [values[int(index)] for index in indices]


def grid_trace_indices(
    grid: dict[str, Any],
    inline_values: list[int] | None = None,
    crossline_values: list[int] | None = None,
) -> np.ndarray:
    selected_inlines = inline_values or grid["inlineValues"]
    selected_crosslines = crossline_values or grid["crosslineValues"]
    trace_by_key = grid["traceByKey"]
    trace_indices: list[int] = []
    for inline_value in selected_inlines:
        for crossline_value in selected_crosslines:
            row = trace_by_key.get((inline_value, crossline_value))
            if row is None:
                raise ValueError(f"Missing SEG-Y trace for IL {inline_value} XL {crossline_value}")
            trace_indices.append(int(row["traceIndex"]))
    return np.asarray(trace_indices, dtype=np.int64)


def selected_grid_axis_section(
    grid: dict[str, Any],
    axis: str,
    fraction: float,
) -> tuple[int, np.ndarray, list[list[float]]]:
    inline_values = grid["inlineValues"]
    crossline_values = grid["crosslineValues"]
    trace_by_key = grid["traceByKey"]
    if axis == "inline":
        inline_value = inline_values[int(round(fraction * (len(inline_values) - 1)))]
        rows = [trace_by_key[(inline_value, crossline)] for crossline in crossline_values]
        return inline_value, np.asarray([int(row["traceIndex"]) for row in rows], dtype=np.int64), [
            row["scene"] for row in rows
        ]
    crossline_value = crossline_values[int(round(fraction * (len(crossline_values) - 1)))]
    rows = [trace_by_key[(inline_value, crossline_value)] for inline_value in inline_values]
    return crossline_value, np.asarray([int(row["traceIndex"]) for row in rows], dtype=np.int64), [
        row["scene"] for row in rows
    ]


def surface_grid_spec(trace_geometry: dict[str, Any]) -> dict[str, Any] | None:
    grid = trace_geometry.get("grid")
    if not grid:
        return None
    corner_rows = grid_corner_rows(grid)
    if not corner_rows:
        return None
    return {
        "geometrySource": trace_geometry["geometrySource"],
        "width": len(grid["crosslineValues"]),
        "height": len(grid["inlineValues"]),
        "inlineRange": [grid["inlineValues"][0], grid["inlineValues"][-1]],
        "crosslineRange": [grid["crosslineValues"][0], grid["crosslineValues"][-1]],
        "corners": {label: row["scene"] for label, row in corner_rows.items()},
        "cmpCornersUtm": {
            label: [round(float(row["cmpUtm"][0]), 4), round(float(row["cmpUtm"][1]), 4)]
            for label, row in corner_rows.items()
        },
        "traceCount": len(grid["traceByKey"]),
    }


def sample_matrix(path: Path, trace_idx: np.ndarray, sample_idx: np.ndarray) -> np.ndarray:
    out = np.zeros((len(sample_idx), len(trace_idx)), dtype=np.float32)
    with segyio.open(str(path), "r", strict=False, ignore_geometry=True) as f:
        for col, trace_no in enumerate(trace_idx):
            trace = np.asarray(f.trace[int(trace_no)], dtype=np.float32)
            out[:, col] = trace[sample_idx]
    return out


def amplitude_stats(matrix: np.ndarray) -> dict[str, float]:
    finite = matrix[np.isfinite(matrix)]
    if finite.size == 0:
        return {"min": 0, "max": 1, "p02": 0, "p98": 1, "mean": 0}
    return {
        "min": float(np.min(finite)),
        "max": float(np.max(finite)),
        "p02": float(np.percentile(finite, 2)),
        "p98": float(np.percentile(finite, 98)),
        "mean": float(np.mean(finite)),
    }


def encode_u8(matrix: np.ndarray, stats: dict[str, float]) -> np.ndarray:
    lo = stats["p02"]
    hi = stats["p98"]
    if not math.isfinite(lo) or not math.isfinite(hi) or hi <= lo:
        lo, hi = stats["min"], stats["max"]
    if not math.isfinite(lo) or not math.isfinite(hi) or hi <= lo:
        lo, hi = -1.0, 1.0
    normalized = np.clip((matrix - lo) / (hi - lo), 0, 1)
    return np.round(normalized * 255).astype(np.uint8)


def downsample_matrix_long_edge(matrix: np.ndarray, max_long_edge: int) -> np.ndarray:
    height, width = matrix.shape
    target_width, target_height = cap_long_edge(width, height, max_long_edge)
    if target_width == width and target_height == height:
        return matrix
    x_idx = selected_trace_indices(width, target_width)
    y_idx = selected_sample_indices(height, target_height)
    return matrix[np.ix_(y_idx, x_idx)]


def downsample_volume_budget(volume: np.ndarray, max_voxels: int) -> np.ndarray:
    nz, ny, nx = volume.shape
    if nx * ny * nz <= max_voxels:
        return volume
    scale = (max_voxels / max(1, nx * ny * nz)) ** (1 / 3)
    target_nx = max(2, int(nx * scale))
    target_ny = max(2, int(ny * scale))
    target_nz = max(2, int(nz * scale))
    while target_nx * target_ny * target_nz > max_voxels and target_nz > 2:
        target_nz -= 1
    x_idx = selected_trace_indices(nx, target_nx)
    y_idx = selected_trace_indices(ny, target_ny)
    z_idx = selected_sample_indices(nz, target_nz)
    return volume[np.ix_(z_idx, y_idx, x_idx)]


def versioned_product_asset(product_id: str, file_name: str, payload: bytes) -> str:
    version = zlib.crc32(payload) & 0xFFFFFFFF
    return f"products/{product_id}/{file_name}?v={version:08x}"


def navigation_paths(navigation: dict[str, Any]) -> dict[str, list[list[float]]]:
    paths: dict[str, list[list[float]]] = {}
    for feature in navigation["features"]:
        geom = feature.get("geometry") or {}
        props = feature.get("properties") or {}
        if geom.get("type") != "LineString":
            continue
        display = str(props.get("id", "")).lower()
        coords = geom.get("coordinates") or []
        if "301" in display:
            paths.setdefault("301", coords)
        elif "302" in display:
            paths.setdefault("302", coords)
        elif "3d" in display and "source" in display:
            paths.setdefault("3d", coords)
    return paths


def seismic_placement_metadata(
    *,
    navigation_source: str,
    placement_accuracy: str,
    can_claim_precise_registration: bool,
    line_id: str,
    reason: str,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "navigationSource": navigation_source,
        "placementAccuracy": placement_accuracy,
        "canClaimPreciseRegistration": can_claim_precise_registration,
        "lineId": line_id,
        "statusLabel": (
            "Approximate legacy line placement; precise registration not validated."
            if navigation_source == "fallback"
            else "Delivered navigation present; precise registration requires validation evidence."
        ),
        "reason": reason,
    }
    if navigation_source == "fallback":
        metadata["validationPath"] = [
            "ingest delivered navigation if available",
            "otherwise georeference against report maps or control points",
            "store residual error",
            "promote to validated only when residual is within accepted tolerance",
        ]
    return metadata


def aggregate_navigation_placement(sections: list[dict[str, Any]]) -> dict[str, Any]:
    placements = [
        section.get("navigationPlacement")
        for section in sections
        if isinstance(section.get("navigationPlacement"), dict)
    ]
    if not placements:
        return seismic_placement_metadata(
            navigation_source="delivered",
            placement_accuracy="unknown",
            can_claim_precise_registration=False,
            line_id="3d",
            reason="3D product uses source geometry and navigation envelope; validation evidence is still required.",
        )
    if any(placement.get("navigationSource") == "fallback" for placement in placements):
        return seismic_placement_metadata(
            navigation_source="fallback",
            placement_accuracy="approximate",
            can_claim_precise_registration=False,
            line_id="/".join(sorted({str(p.get("lineId", "line")) for p in placements})),
            reason="At least one section uses explicit approximate fallback endpoints.",
        )
    return seismic_placement_metadata(
        navigation_source="delivered",
        placement_accuracy="unknown",
        can_claim_precise_registration=False,
        line_id="/".join(sorted({str(p.get("lineId", "line")) for p in placements})),
        reason="Delivered navigation exists; precise registration remains review-gated until control-point validation.",
    )


def path_scene_bounds(
    path_points: list[list[float]],
    domain_values: list[float],
    domain: tuple[str, str],
    datum_m: float,
) -> dict[str, list[float]]:
    xs = [float(point[0]) for point in path_points]
    ys = [float(point[1]) for point in path_points]
    domain_min = min(domain_values)
    domain_max = max(domain_values)
    z_scale = TIME_SCALE_M_PER_MS if domain[1] == "ms" else 1.0
    z_min = datum_m - domain_max * z_scale
    z_max = datum_m - domain_min * z_scale
    return {
        "min": [round(min(xs), 4), round(min(ys), 4), round(min(z_min, z_max), 4)],
        "max": [round(max(xs), 4), round(max(ys), 4), round(max(z_min, z_max), 4)],
    }


def line_path_for(
    product_path: Path,
    trace_geometry: dict[str, Any],
    nav_paths: dict[str, list[list[float]]],
    bounds: dict[str, list[float]],
) -> tuple[list[list[float]], str, dict[str, Any]]:
    line_id = trace_line_id(product_path)
    rows = trace_geometry.get("rows") or []
    if rows:
        ordered_rows = sorted(rows, key=lambda row: int(row["traceIndex"]))
        return [row["scene"] for row in ordered_rows], trace_geometry["geometrySource"], seismic_placement_metadata(
            navigation_source="delivered",
            placement_accuracy="unknown",
            can_claim_precise_registration=False,
            line_id=line_id,
            reason=(
                "Line curtain path is derived from SEG-Y trace-header CMP coordinates; "
                "control-point validation is still required before precision claims."
            ),
        )
    if line_id in nav_paths and len(nav_paths[line_id]) >= 2:
        coords = nav_paths[line_id]
        return coords, "seg-p1-navigation-line", seismic_placement_metadata(
            navigation_source="delivered",
            placement_accuracy="unknown",
            can_claim_precise_registration=False,
            line_id=line_id,
            reason=(
                "Line curtain path is derived from delivered SEG-P1 navigation; "
                "control-point validation is still required before precision claims."
            ),
        )
    min_x, min_y, _ = bounds["min"]
    max_x, max_y, _ = bounds["max"]
    mid_z = 1800.0
    if line_id == "legacy-l5":
        return [
            [min_x - 6000, min_y + 2500, mid_z],
            [max_x + 4500, max_y - 2200, mid_z],
        ], "fallback-endpoints", seismic_placement_metadata(
            navigation_source="fallback",
            placement_accuracy="approximate",
            can_claim_precise_registration=False,
            line_id=line_id,
            reason="No delivered navigation line is present for legacy Line L5 in the active source set.",
        )
    if line_id == "legacy-l11":
        return [
            [min_x - 5000, max_y + 2800, mid_z],
            [max_x + 5500, min_y - 3000, mid_z],
        ], "fallback-endpoints", seismic_placement_metadata(
            navigation_source="fallback",
            placement_accuracy="approximate",
            can_claim_precise_registration=False,
            line_id=line_id,
            reason="No delivered navigation line is present for legacy Line L11 in the active source set.",
        )
    return [
        [min_x, (min_y + max_y) / 2, mid_z],
        [max_x, (min_y + max_y) / 2, mid_z],
    ], "fallback-endpoints", seismic_placement_metadata(
        navigation_source="fallback",
        placement_accuracy="unknown",
        can_claim_precise_registration=False,
        line_id=line_id,
        reason="No delivered navigation line is present for this line product.",
    )


def make_section_spec(
    product_dir: Path,
    product_id: str,
    section_id: str,
    label: str,
    axis: str,
    fraction: float,
    matrix: np.ndarray,
    domain_values: list[float],
    product_path: Path,
    domain: tuple[str, str],
    datum_m: float,
    bounds: dict[str, list[float]],
    nav_paths: dict[str, list[list[float]]],
    trace_geometry: dict[str, Any],
    *,
    path_points: list[list[float]] | None = None,
    geometry_source: str | None = None,
    source_axis: dict[str, Any] | None = None,
    surface_grid: dict[str, Any] | None = None,
    source_unit_status: str | None = None,
    datum_metadata: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, float]]:
    stats = amplitude_stats(matrix)
    encoded = encode_u8(matrix, stats)
    file_name = f"{section_id}.u8"
    encoded_bytes = encoded.tobytes(order="C")
    (product_dir / file_name).write_bytes(encoded_bytes)
    amplitude_file = versioned_product_asset(product_id, file_name, encoded_bytes)
    coarse_matrix = downsample_matrix_long_edge(
        matrix,
        BROWSER_COARSE_SECTION_MAX_LONG_EDGE,
    )
    coarse_file_name = file_name
    coarse_amplitude_file = amplitude_file
    if coarse_matrix.shape != matrix.shape:
        coarse_file_name = f"{section_id}__coarse.u8"
        coarse_encoded = encode_u8(coarse_matrix, stats)
        coarse_encoded_bytes = coarse_encoded.tobytes(order="C")
        (product_dir / coarse_file_name).write_bytes(coarse_encoded_bytes)
        coarse_amplitude_file = versioned_product_asset(
            product_id,
            coarse_file_name,
            coarse_encoded_bytes,
        )
    domain_kind_value, domain_unit = domain
    spec: dict[str, Any] = {
        "id": section_id,
        "label": label,
        "axis": axis,
        "fraction": round(fraction, 4),
        "width": int(matrix.shape[1]),
        "height": int(matrix.shape[0]),
        "amplitudeFile": amplitude_file,
        "lods": {
            "coarse": {
                "width": int(coarse_matrix.shape[1]),
                "height": int(coarse_matrix.shape[0]),
                "amplitudeFile": coarse_amplitude_file,
            },
            "standard": {
                "width": int(matrix.shape[1]),
                "height": int(matrix.shape[0]),
                "amplitudeFile": amplitude_file,
            },
            "source": {
                "width": int(matrix.shape[1]),
                "height": int(matrix.shape[0]),
                "amplitudeFile": amplitude_file,
            },
        },
        "amplitudeEncoding": "uint8-normalized-p02-p98",
        "amplitudeStats": {k: round(v, 6) for k, v in stats.items()},
        "sampleDomain": {
            "kind": domain_kind_value,
            "unit": domain_unit,
            "min": round(min(domain_values), 6),
            "max": round(max(domain_values), 6),
            "verticalScaleMPerUnit": TIME_SCALE_M_PER_MS if domain_unit == "ms" else 1.0,
        },
        "datumM": datum_m,
        "verticalReference": vertical_reference_for(
            domain,
            datum_m,
            source_unit_status,
            datum_metadata,
        ),
        "valueEncoding": value_encoding_for(product_kind(product_path)),
    }
    if source_unit_status:
        spec["sampleDomain"]["sourceUnitStatus"] = source_unit_status
    if axis == "line":
        path_points, line_geometry_source, placement = line_path_for(
            product_path,
            trace_geometry,
            nav_paths,
            bounds,
        )
        spec["geometrySource"] = line_geometry_source
        spec["sourceAxis"] = {"kind": "line", "value": trace_line_id(product_path)}
        spec["path"] = path_points
        spec["sceneBounds"] = path_scene_bounds(path_points, domain_values, domain, datum_m)
        spec["navigationPlacement"] = placement
    elif path_points:
        spec["geometrySource"] = geometry_source or trace_geometry.get("geometrySource")
        spec["sourceAxis"] = source_axis
        spec["path"] = path_points
        spec["sceneBounds"] = path_scene_bounds(path_points, domain_values, domain, datum_m)
        spec["navigationPlacement"] = seismic_placement_metadata(
            navigation_source="delivered",
            placement_accuracy="unknown",
            can_claim_precise_registration=False,
            line_id="3d",
            reason=(
                "3D section path is derived from SEG-Y trace-header CMP coordinates; "
                "control-point validation is still required."
            ),
        )
    else:
        spec["sceneBounds"] = bounds
        if geometry_source:
            spec["geometrySource"] = geometry_source
        if source_axis:
            spec["sourceAxis"] = source_axis
        if surface_grid:
            spec["surfaceGrid"] = surface_grid
        spec["navigationPlacement"] = seismic_placement_metadata(
            navigation_source="delivered",
            placement_accuracy="unknown",
            can_claim_precise_registration=False,
            line_id="3d" if axis != "line" else trace_line_id(product_path),
            reason=(
                "Section placement uses trace-header surface-grid geometry when available; "
                "control-point validation is still required."
                if surface_grid
                else "Section placement uses navigation envelope fallback; control-point validation is still required."
            ),
        )
    if surface_grid:
        spec["surfaceGrid"] = surface_grid
    if geometry_source and "geometrySource" not in spec:
        spec["geometrySource"] = geometry_source
    if source_axis and "sourceAxis" not in spec:
        spec["sourceAxis"] = source_axis
    return spec, stats


def build_volume(
    path: Path,
    product_dir: Path,
    product_id: str,
    domain: tuple[str, str],
    samples: np.ndarray,
    datum_m: float,
    bounds: dict[str, list[float]],
    trace_geometry: dict[str, Any],
    source_unit_status: str | None = None,
    datum_metadata: dict[str, Any] | None = None,
    max_voxels: int = SOURCE_FIDELITY_VOLUME_MAX_VOXELS,
) -> tuple[dict[str, Any], dict[str, float]]:
    with segyio.open(str(path), "r", strict=False, ignore_geometry=True) as f:
        trace_count = f.tracecount
        sample_count = len(f.samples)
    grid = trace_geometry.get("grid")
    if grid:
        nx, ny, nz = source_aligned_volume_shape_for_grid(
            len(grid["crosslineValues"]),
            len(grid["inlineValues"]),
            sample_count,
            max_voxels,
        )
        selected_crosslines = select_values(grid["crosslineValues"], nx)
        selected_inlines = select_values(grid["inlineValues"], ny)
        trace_idx = grid_trace_indices(grid, selected_inlines, selected_crosslines)
    else:
        nx, ny, nz = source_aligned_volume_shape(trace_count, sample_count, max_voxels)
        trace_idx = selected_trace_indices(trace_count, nx * ny)
    sample_idx = selected_sample_indices(sample_count, nz)
    matrix = sample_matrix(path, trace_idx, sample_idx)
    volume = matrix.reshape((nz, ny, nx))
    stats = amplitude_stats(volume)
    encoded = encode_u8(volume, stats)
    file_name = "volume.u8"
    encoded_bytes = encoded.tobytes(order="C")
    (product_dir / file_name).write_bytes(encoded_bytes)
    volume_file = versioned_product_asset(product_id, file_name, encoded_bytes)
    coarse_volume = downsample_volume_budget(volume, BROWSER_COARSE_VOLUME_MAX_VOXELS)
    coarse_file_name = file_name
    coarse_volume_file = volume_file
    if coarse_volume.shape != volume.shape:
        coarse_file_name = "volume__coarse.u8"
        coarse_encoded = encode_u8(coarse_volume, stats)
        coarse_encoded_bytes = coarse_encoded.tobytes(order="C")
        (product_dir / coarse_file_name).write_bytes(coarse_encoded_bytes)
        coarse_volume_file = versioned_product_asset(
            product_id,
            coarse_file_name,
            coarse_encoded_bytes,
        )
    domain_kind_value, domain_unit = domain
    domain_min = float(samples[int(sample_idx[0])])
    domain_max = float(samples[int(sample_idx[-1])])
    z_scale = TIME_SCALE_M_PER_MS if domain_unit == "ms" else 1.0
    if trace_geometry.get("rows"):
        volume_bounds = geometry_bounds_scene(
            trace_geometry["rows"],
            domain_min,
            domain_max,
            datum_m,
            z_scale,
        )
    else:
        volume_bounds = {
            "min": [bounds["min"][0], bounds["min"][1], datum_m - domain_max * z_scale],
            "max": [bounds["max"][0], bounds["max"][1], datum_m - domain_min * z_scale],
        }
    grid_geometry: dict[str, Any] | None = None
    if grid:
        grid_geometry = {
            "geometrySource": trace_geometry["geometrySource"],
            "placementAccuracy": "trace-header-aabb-envelope",
            "inlineRange": [grid["inlineValues"][0], grid["inlineValues"][-1]],
            "crosslineRange": [grid["crosslineValues"][0], grid["crosslineValues"][-1]],
            "sourceDimensions": [len(grid["crosslineValues"]), len(grid["inlineValues"]), sample_count],
            "sampledDimensions": [nx, ny, nz],
            "canClaimPreciseRegistration": False,
            "reason": (
                "Raymarch payload preserves trace-header grid sampling but renders in an AABB envelope; "
                "visible sections carry trace-derived placement geometry."
            ),
        }
    return (
        {
            "file": volume_file,
            "encoding": "uint8-normalized-p02-p98",
            "dimensions": [nx, ny, nz],
            "geometrySource": trace_geometry.get("geometrySource"),
            "placementAccuracy": "trace-header-aabb-envelope" if grid else "navigation-envelope-fallback",
            "gridGeometry": grid_geometry,
            "lods": {
                "coarse": {
                    "file": coarse_volume_file,
                    "dimensions": [
                        int(coarse_volume.shape[2]),
                        int(coarse_volume.shape[1]),
                        int(coarse_volume.shape[0]),
                    ],
                },
                "standard": {
                    "file": volume_file,
                    "dimensions": [nx, ny, nz],
                },
                "source": {
                    "file": volume_file,
                    "dimensions": [nx, ny, nz],
                },
            },
            "sceneBounds": volume_bounds,
            "sampleDomain": {
                "kind": domain_kind_value,
                "unit": domain_unit,
                "min": round(domain_min, 6),
                "max": round(domain_max, 6),
                "verticalScaleMPerUnit": z_scale,
                "sourceUnitStatus": source_unit_status,
            },
            "verticalReference": vertical_reference_for(
                domain,
                datum_m,
                source_unit_status,
                datum_metadata,
            ),
            "valueEncoding": value_encoding_for(product_kind(path)),
            "amplitudeStats": {k: round(v, 6) for k, v in stats.items()},
        },
        stats,
    )


def classify_products() -> list[Path]:
    source_root = active_phase3_source_root() / "source"
    candidates = sorted(
        list((source_root / "from_submission_1141").rglob("*.segy"))
        + list((source_root / "from_submission_1141").rglob("*.sgy"))
        + list((source_root / "from_submission_1015").rglob("*.sgy"))
        + list((source_root / "from_submission_1015").rglob("*.segy"))
    )
    products: list[Path] = []
    for path in candidates:
        if is_raw_path(path) or path.name.startswith("._") or "__MACOSX" in path.parts:
            continue
        if any(part.lower() == "processed_data" for part in path.parts) or "2018-19 Reflection Processing" in path.as_posix() or "Velocity" in path.parts:
            products.append(path)
    return products


def build_product(
    path: Path,
    navigation: dict[str, Any],
    product_index: int,
) -> Product:
    kind = product_kind(path)
    domain = domain_kind(path, kind)
    survey = survey_kind(path)
    source_submission = "GDR 1015" if "from_submission_1015" in path.parts else "GDR 1141"
    product_id = slugify(f"{source_submission}-{path.stem}")
    product_dir = PHASE3_PROCESSED_ROOT / "browser" / "products" / product_id
    ensure_dir(product_dir)

    nav_bounds = navigation["properties"]["sceneBounds"]
    nav_paths = navigation_paths(navigation)
    sections: list[dict[str, Any]] = []
    section_stats: list[dict[str, float]] = []

    with segyio.open(str(path), "r", strict=False, ignore_geometry=True) as f:
        trace_count = f.tracecount
        raw_samples = np.asarray(f.samples[:], dtype=np.float32)
        sample_count = len(raw_samples)
        sample_interval = float(segyio.tools.dt(f) or 0)
        sample_format = int(f.bin[segyio.BinField.Format])
        ext_headers = int(getattr(f, "ext_headers", 0) or 0)
        text_header = read_text_header(f)
        datum, datum_metadata = datum_for_product(path, text_header, survey)
    samples, domain, header_unit_status, sample_axis_metadata = sample_axis_from_header(text_header, raw_samples, domain)
    sample_count = len(samples)
    sample_spacing = (
        float(abs(float(samples[1]) - float(samples[0])))
        if sample_count > 1
        else 0.0
    )
    source_unit_status = source_unit_status_for(path, text_header, domain, header_unit_status)
    trace_geometry = read_trace_header_geometry(
        path,
        trace_count,
        sample_count,
        sample_format,
        ext_headers,
        text_header,
    )
    source_geometry = trace_geometry_manifest_summary(trace_geometry, samples, domain, datum)
    product_bounds = source_geometry.get("sceneBounds") or nav_bounds

    if survey == "3d" and trace_geometry.get("grid"):
        grid = trace_geometry["grid"]
        for axis in ("inline", "crossline"):
            for fraction in (0.25, 0.5, 0.75):
                axis_value, trace_idx, path_points = selected_grid_axis_section(
                    grid,
                    axis,
                    fraction,
                )
                sample_idx = selected_sample_indices(sample_count, sample_count)
                matrix = sample_matrix(path, trace_idx, sample_idx)
                spec, stats = make_section_spec(
                    product_dir,
                    product_id,
                    f"{axis}_{int(fraction * 100):02d}",
                    f"{axis.title()} {axis_value}",
                    axis,
                    fraction,
                    matrix,
                    [float(samples[int(sample_idx[0])]), float(samples[int(sample_idx[-1])])],
                    path,
                    domain,
                    datum,
                    product_bounds,
                    nav_paths,
                    trace_geometry,
                    path_points=path_points,
                    geometry_source=trace_geometry["geometrySource"],
                    source_axis={"kind": axis, "value": axis_value},
                    source_unit_status=source_unit_status,
                    datum_metadata=datum_metadata,
                )
                sections.append(spec)
                section_stats.append(stats)
        for fraction in (0.25, 0.5, 0.75):
            plane_width = len(grid["crosslineValues"])
            plane_height = len(grid["inlineValues"])
            trace_idx = grid_trace_indices(grid)
            sample_no = int(round(fraction * (sample_count - 1)))
            matrix = sample_matrix(path, trace_idx, np.array([sample_no], dtype=np.int64))
            plane = matrix.reshape((plane_height, plane_width))
            spec, stats = make_section_spec(
                product_dir,
                product_id,
                f"sample_{int(fraction * 100):02d}",
                f"Sample {int(fraction * 100)}%",
                "sample",
                fraction,
                plane,
                [float(samples[sample_no])],
                path,
                domain,
                datum,
                product_bounds,
                nav_paths,
                trace_geometry,
                geometry_source=trace_geometry["geometrySource"],
                source_axis={"kind": "sample", "value": float(samples[sample_no])},
                surface_grid=surface_grid_spec(trace_geometry),
                source_unit_status=source_unit_status,
                datum_metadata=datum_metadata,
            )
            sections.append(spec)
            section_stats.append(stats)
        raymarch_volume, volume_stats = build_volume(
            path,
            product_dir,
            product_id,
            domain,
            samples,
            datum,
            product_bounds,
            trace_geometry,
            source_unit_status,
            datum_metadata,
            BROWSER_3D_VOLUME_MAX_VOXELS,
        )
        section_stats.append(volume_stats)
    elif survey == "3d":
        for axis in ("inline", "crossline"):
            for fraction in (0.25, 0.5, 0.75):
                section_width, section_height = section_shape_for_product(
                    survey,
                    trace_count,
                    sample_count,
                    fraction,
                )
                trace_idx = selected_trace_indices(trace_count, section_width, fraction)
                sample_idx = selected_sample_indices(sample_count, section_height)
                matrix = sample_matrix(path, trace_idx, sample_idx)
                spec, stats = make_section_spec(
                    product_dir,
                    product_id,
                    f"{axis}_{int(fraction * 100):02d}",
                    f"{axis.title()} {int(fraction * 100)}%",
                    axis,
                    fraction,
                    matrix,
                    [float(samples[int(sample_idx[0])]), float(samples[int(sample_idx[-1])])],
                    path,
                    domain,
                    datum,
                    product_bounds,
                    nav_paths,
                    trace_geometry,
                    geometry_source=trace_geometry.get("geometrySource"),
                    source_axis={"kind": axis, "value": fraction},
                    source_unit_status=source_unit_status,
                    datum_metadata=datum_metadata,
                )
                sections.append(spec)
                section_stats.append(stats)
        for fraction in (0.25, 0.5, 0.75):
            plane_width, plane_height = source_aligned_sample_plane_shape(trace_count)
            trace_idx = selected_trace_indices(trace_count, plane_width * plane_height)
            sample_no = int(round(fraction * (sample_count - 1)))
            matrix = sample_matrix(path, trace_idx, np.array([sample_no], dtype=np.int64))
            plane = matrix.reshape((plane_height, plane_width))
            spec, stats = make_section_spec(
                product_dir,
                product_id,
                f"sample_{int(fraction * 100):02d}",
                f"Sample {int(fraction * 100)}%",
                "sample",
                fraction,
                plane,
                [float(samples[sample_no])],
                path,
                domain,
                datum,
                product_bounds,
                nav_paths,
                trace_geometry,
                geometry_source=trace_geometry.get("geometrySource"),
                source_axis={"kind": "sample", "value": float(samples[sample_no])},
                source_unit_status=source_unit_status,
                datum_metadata=datum_metadata,
            )
            sections.append(spec)
            section_stats.append(stats)
        raymarch_volume, volume_stats = build_volume(
            path,
            product_dir,
            product_id,
            domain,
            samples,
            datum,
            product_bounds,
            trace_geometry,
            source_unit_status,
            datum_metadata,
            BROWSER_3D_VOLUME_MAX_VOXELS,
        )
        section_stats.append(volume_stats)
    else:
        section_width, section_height = section_shape_for_product(survey, trace_count, sample_count)
        trace_idx = selected_trace_indices(trace_count, section_width)
        sample_idx = selected_sample_indices(sample_count, section_height)
        matrix = sample_matrix(path, trace_idx, sample_idx)
        spec, stats = make_section_spec(
            product_dir,
            product_id,
            "section",
            "Section curtain",
            "line",
            0.5,
            matrix,
            [float(samples[int(sample_idx[0])]), float(samples[int(sample_idx[-1])])],
            path,
            domain,
            datum,
            product_bounds,
            nav_paths,
            trace_geometry,
            source_unit_status=source_unit_status,
            datum_metadata=datum_metadata,
        )
        sections.append(spec)
        section_stats.append(stats)
        raymarch_volume = None

    finite_mins = [s["min"] for s in section_stats if math.isfinite(s["min"])]
    finite_maxs = [s["max"] for s in section_stats if math.isfinite(s["max"])]
    p02s = [s["p02"] for s in section_stats if math.isfinite(s["p02"])]
    p98s = [s["p98"] for s in section_stats if math.isfinite(s["p98"])]
    stats = {
        "min": min(finite_mins) if finite_mins else 0,
        "max": max(finite_maxs) if finite_maxs else 1,
        "p02": min(p02s) if p02s else 0,
        "p98": max(p98s) if p98s else 1,
    }
    naming = canonical_product_metadata(path, survey, kind, domain, text_header)
    naming["nameEvidence"]["sourceSubmission"] = source_submission
    label = naming["canonicalLabel"]
    return Product(
        id=product_id,
        label=label,
        line_id=naming["lineId"],
        line_label=naming["lineLabel"],
        processing_stage=naming["processingStage"],
        canonical_label=naming["canonicalLabel"],
        name_evidence=naming["nameEvidence"],
        source_file=path,
        normalized_source_file=path,
        source_submission=source_submission,
        survey_kind=survey,
        product_kind=kind,
        domain_kind=domain[0],
        domain_unit=domain[1],
        datum_m=datum,
        datum_metadata=datum_metadata,
        trace_count=trace_count,
        sample_count=sample_count,
        sample_min=float(samples[0]) if len(samples) else 0,
        sample_max=float(samples[-1]) if len(samples) else 0,
        sample_interval=sample_interval,
        sample_spacing=sample_spacing,
        sample_axis_metadata=sample_axis_metadata,
        source_geometry=source_geometry,
        source_unit_status=source_unit_status,
        stats=stats,
        sections=sections,
        raymarch_volume=raymarch_volume,
        navigation_placement=aggregate_navigation_placement(sections),
        text_header_excerpt=text_header,
    )


def product_to_manifest(product: Product) -> dict[str, Any]:
    item = {
        "id": product.id,
        "label": product.label,
        "lineId": product.line_id,
        "lineLabel": product.line_label,
        "processingStage": product.processing_stage,
        "canonicalLabel": product.canonical_label,
        "nameEvidence": product.name_evidence,
        "sourceSubmission": product.source_submission,
        "sourceFile": rel(product.normalized_source_file),
        "provenance": {
            "sourceSubmission": product.source_submission,
            "sourceFile": rel(product.normalized_source_file),
            "processingRole": "active processed seismic product",
            "generatedBy": "prep/build_utah_forge_seismic_browser.py",
        },
        "surveyKind": product.survey_kind,
        "productKind": product.product_kind,
        "domainKind": product.domain_kind,
        "domainUnit": product.domain_unit,
        "datumM": product.datum_m,
        "navigationPlacement": product.navigation_placement,
        "verticalReference": vertical_reference_for(
            (product.domain_kind, product.domain_unit),
            product.datum_m,
            product.source_unit_status,
            product.datum_metadata,
        ),
        "valueEncoding": value_encoding_for(product.product_kind),
        "sourceGeometry": product.source_geometry,
        "sourceUnitStatus": product.source_unit_status,
        "traceCount": product.trace_count,
        "sampleCount": product.sample_count,
        "sampleRange": [round(product.sample_min, 6), round(product.sample_max, 6)],
        "sampleInterval": product.sample_interval,
        "sampleDomain": {
            "kind": product.domain_kind,
            "unit": product.domain_unit,
            "min": round(product.sample_min, 6),
            "max": round(product.sample_max, 6),
            "spacing": {
                "value": round(product.sample_spacing, 6),
                "unit": product.domain_unit,
            },
            "segySampleIntervalRaw": product.sample_interval,
            "sourceUnitStatus": product.source_unit_status,
            "axisSource": product.sample_axis_metadata,
        },
        "amplitudeStats": {k: round(v, 6) for k, v in product.stats.items()},
        "sections": product.sections,
        "raymarchVolume": product.raymarch_volume,
        "textHeaderExcerpt": product.text_header_excerpt,
    }
    if product.datum_metadata:
        item["datumMetadata"] = product.datum_metadata
    return item


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


REQUIRED_LINE_SOURCE_GATES = (
    ("301", "Line 301"),
    ("302", "Line 302"),
    ("L11", "Line L11"),
    ("L5", "Line L5"),
    ("95", "Line 95"),
)


def source_line_match(path: Path, line_id: str) -> bool:
    text = f"{path.name} {' '.join(path.parts)}".lower()
    if line_id == "L11":
        return "l11" in text or "line 11" in text
    if line_id == "L5":
        return "l5" in text or "line 5" in text
    pattern = rf"(?:line|forge2d)?[_\-\s]*{re.escape(line_id.lower())}(?:[^0-9]|$)"
    return re.search(pattern, text) is not None


def source_gate_roots() -> list[Path]:
    return [
        PHASE3_SOURCE_ROOT / "source",
        ARCHIVED_PHASE3_SOURCE_ROOT / "source",
    ]


def discover_line_source_candidates(line_id: str) -> list[str]:
    candidates: list[str] = []
    seen: set[str] = set()
    for root in source_gate_roots():
        if not root.exists():
            continue
        for extension in ("*.sgy", "*.segy"):
            for path in root.rglob(extension):
                if path.name.startswith("._") or "__MACOSX" in path.parts:
                    continue
                if not source_line_match(path, line_id):
                    continue
                resolved = path.resolve().as_posix()
                if resolved not in seen:
                    candidates.append(resolved)
                    seen.add(resolved)
    return candidates


def required_line_source_gates(products: list[Product]) -> list[dict[str, Any]]:
    gates: list[dict[str, Any]] = []
    for line_id, line_label in REQUIRED_LINE_SOURCE_GATES:
        product_ids = sorted(product.id for product in products if product.line_id == line_id)
        source_candidates = discover_line_source_candidates(line_id)
        if product_ids:
            status = "available"
            reason = "Required seismic line has generated browser products."
        elif source_candidates:
            status = "source-present-not-generated"
            reason = "Required seismic line source exists but no browser product has been generated."
        else:
            status = "missing-source"
            reason = "No matching SEG-Y source product was found in the active source path or GeoSee archive."
        gates.append(
            {
                "lineId": line_id,
                "lineLabel": line_label,
                "required": True,
                "status": status,
                "productIds": product_ids,
                "sourceCandidates": source_candidates,
                "searchedRoots": [root.resolve().as_posix() for root in source_gate_roots()],
                "reason": reason,
            }
        )
    return gates


def project_seismic_product_metadata(products: list[Product]) -> list[dict[str, Any]]:
    return [
        {
            "id": p.id,
            "label": p.label,
            "lineId": p.line_id,
            "lineLabel": p.line_label,
            "processingStage": p.processing_stage,
            "canonicalLabel": p.canonical_label,
            "nameEvidence": p.name_evidence,
            "sourceSubmission": p.source_submission,
            "sourceFile": rel(p.normalized_source_file),
            "surveyKind": p.survey_kind,
            "productKind": p.product_kind,
            "domainKind": p.domain_kind,
            "domainUnit": p.domain_unit,
            "datumM": p.datum_m,
            "sourceUnitStatus": p.source_unit_status,
            "sourceGeometry": p.source_geometry,
            "traceCount": p.trace_count,
            "sampleCount": p.sample_count,
            "raymarchCapable": p.raymarch_volume is not None,
        }
        for p in products
    ]


def seismic_product_catalog_capability_presets(products: list[Product]) -> list[dict[str, Any]]:
    line_order = {"301": 0, "302": 1, "L11": 2, "L5": 3}
    catalog_products = sorted(
        [product for product in products if product.line_id in line_order],
        key=lambda product: (line_order[product.line_id], product.processing_stage, product.label),
    )
    presets: list[dict[str, Any]] = []
    for index, product in enumerate(catalog_products):
        presets.append(
            {
                "id": f"seismic-product-{product.id}",
                "label": product.label,
                "rank": 100 + index,
                "summary": f"{product.line_label} {product.processing_stage} source product.",
                "displayRecipeId": "2d-line-theatre",
                "productId": product.id,
                "visibleProductIds": [product.id],
                "renderMode": "slice",
                "sliceAxis": "line",
                "sliceFraction": 0.5,
                "opacity": 0.74,
                "amplitudeMin": 0.08,
                "amplitudeMax": 0.92,
                "amplitudeGamma": 1.0,
                "colormap": "blue-white-red",
                "backgroundCutoff": 0.16,
                "volumeSampleSteps": 96,
                "timeScale": TIME_SCALE_M_PER_MS,
                "navigationVisible": True,
                "sliceThroughVolume": False,
                "comparisonMode": "overlay",
                "mtCoRender": "seismic",
                "navigationRoleVisibility": {
                    "sources": True,
                    "receivers": True,
                    "lines": True,
                },
                "removeBackground": False,
                "capabilityGroup": "seismic-product-catalog",
                "mtStylePatch": {
                    "opacity": 0.05,
                    "scalarLegendVisible": False,
                },
                "cameraShot": f"line-{product.line_id.lower()}-product-catalog",
                "badges": [
                    "public geothermal demo data",
                    "processed seismic product",
                    "not a mineral resource estimate",
                ],
                "caveats": [
                    "public geothermal demo data",
                    "processed seismic product",
                    "not a mineral resource estimate",
                ],
            }
        )
    return presets


def sync_project_seismic_layer(
    products: list[Product],
    manifest: dict[str, Any],
    source_gates: list[dict[str, Any]],
    required_product_source_gates: list[dict[str, Any]],
) -> None:
    project_path = PROJECT_ROOT / "project.json"
    if not project_path.exists():
        return
    project = json.loads(project_path.read_text(encoding="utf-8"))
    layers = project.get("layers")
    if not isinstance(layers, list):
        return
    seismic_layer = next(
        (layer for layer in layers if layer.get("id") == "utah-forge-phase3-seismic-browser"),
        None,
    )
    if not seismic_layer:
        return
    metadata = seismic_layer.setdefault("metadata", {})
    metadata["derivedArtifactDate"] = DERIVED_DATE
    metadata["defaultSeismicProductId"] = manifest["defaultProductId"]
    metadata["seismicProducts"] = project_seismic_product_metadata(products)
    metadata["seismicVerticalReference"] = manifest["verticalReference"]
    metadata["seismicValueEncoding"] = manifest["valueEncoding"]
    metadata["seismicRequiredLineSourceGates"] = source_gates
    metadata["seismicRequiredProductSourceGates"] = required_product_source_gates
    existing_presets = metadata.get("seismicCapabilityPresets")
    if not isinstance(existing_presets, list):
        metadata["seismicCapabilityPresets"] = manifest["capabilityPresets"]
    project_path.write_text(json.dumps(project, indent=2), encoding="utf-8")


def main() -> None:
    ensure_dir(PHASE3_SOURCE_ROOT)
    ensure_dir(PHASE3_PROCESSED_ROOT)

    normalization = normalize_sources()
    navigation = build_navigation_geojson()
    navigation_path = PHASE3_PROCESSED_ROOT / "navigation" / "seismic_navigation.geojson"
    write_json(navigation_path, navigation)

    product_paths = classify_products()
    products = [build_product(path, navigation, index) for index, path in enumerate(product_paths)]
    products.sort(key=lambda p: (p.survey_kind != "3d", p.product_kind, p.label))
    source_gates = required_line_source_gates(products)
    required_product_source_gates = normalization.get("requiredProductSourceGates", [])
    capability_presets = seismic_product_catalog_capability_presets(products)

    inventory = {
        "schema": "geosee.seismic-source-inventory.v1",
        "project": "Utah FORGE Phase 3 seismic analysis",
        "derivedDate": DERIVED_DATE,
        "normalization": normalization,
        "requiredLineSourceGates": source_gates,
        "requiredProductSourceGates": required_product_source_gates,
        "activeProductCount": len(products),
        "activeProducts": [
            {
                "id": p.id,
                "label": p.label,
                "lineId": p.line_id,
                "lineLabel": p.line_label,
                "processingStage": p.processing_stage,
                "canonicalLabel": p.canonical_label,
                "nameEvidence": p.name_evidence,
                "sourceSubmission": p.source_submission,
                "sourceFile": rel(p.normalized_source_file),
                "surveyKind": p.survey_kind,
                "productKind": p.product_kind,
                "domainKind": p.domain_kind,
                "domainUnit": p.domain_unit,
                "datumM": p.datum_m,
                "sourceGeometry": p.source_geometry,
                "sourceUnitStatus": p.source_unit_status,
                "traceCount": p.trace_count,
                "sampleCount": p.sample_count,
                "raymarchCapable": p.raymarch_volume is not None,
            }
            for p in products
        ],
        "excludedRules": [
            "Raw correlated and uncorrelated shot gathers are excluded from active rendering.",
            "Mac resource-fork files and __MACOSX sidecars are excluded.",
        ],
    }
    inventory_path = PHASE3_PROCESSED_ROOT / "inventory" / "seismic_source_inventory.json"
    write_json(inventory_path, inventory)

    preferred_default = "gdr-1141-forge3d-ani-psdm-stack-unenh"
    default_product = (
        preferred_default
        if any(p.id == preferred_default for p in products)
        else next((p.id for p in products if p.survey_kind == "3d"), products[0].id if products else "")
    )
    manifest = {
        "schema": "geosee.seismic-browser.v1",
        "label": "Utah FORGE Phase 3 seismic browser",
        "derivedDate": DERIVED_DATE,
        "defaultProductId": default_product,
        "navigation": {
            "geojson": rel(navigation_path),
            "pointCount": navigation["properties"]["pointCount"],
            "sceneBounds": navigation["properties"]["sceneBounds"],
            "registration": navigation["properties"]["registration"],
        },
        "crs": {
            "rendered": "scene-local meters",
            "primarySourceCrs": "EPSG:26912 NAD83 / UTM Zone 12N",
            "legacySourceCrs": "EPSG:32043/EPSG:32044 NAD27 Utah State Plane, US survey foot",
            "axisConvention": "X east, Y north, Z up",
            "sceneOriginUtm": project_origin_payload(),
            "registrationStatus": "unverified",
            "registration": seismic_navigation_registration(UTAH_FORGE_HORIZONTAL_CRS),
            "transformPipeline": [
                "source coordinates require declared source CRS",
                "source coordinates are transformed into EPSG:26912 before scene-local conversion",
                "GeoSee project origin is subtracted after CRS transformation",
            ],
        },
        "sampleDomain": {
            "timeScaleMPerMs": TIME_SCALE_M_PER_MS,
            "depthScaleMPerM": 1.0,
            "referenceDatumM": SEISMIC_REFERENCE_DATUM_M,
            "notes": [
                "All seismic render coordinates use absolute elevation metres in the same scene Z frame as terrain and wells.",
                "Time-domain products use a display scale in meters per millisecond below their parsed source datum.",
                "Depth-domain products use depth below their parsed seismic datum where the source product is depth migrated.",
                "Depth sample axes are resolved from the textual SEG-Y header; inconsistent SAMPLE INT and TRACE LENGTH combinations are recorded in product sampleDomain.axisSource.",
            ],
        },
        "requiredLineSourceGates": source_gates,
        "verticalReference": {
            "coordinateSystem": "scene-local meters, X east, Y north, Z up",
            "verticalDatum": "absolute elevation metres above sea level in GeoSee scene coordinates",
            "referenceDatumM": SEISMIC_REFERENCE_DATUM_M,
            "sourceDatumStrategy": "parse SEG-Y text header DATUM field; convert feet to metres; apply documented datum shifts when present; fall back to 1800 m when absent",
            "transform": "sceneZ_m = datumM - sample * verticalScaleMPerUnit",
            "calibration": TOP_OF_GRANITE_CALIBRATION,
            "notes": [
                "Phase 2B structure contours are treated as depth below 1800 m ASL unless a source header explicitly states another datum.",
                "The 58-32 top-of-granite calibration point is retained as metadata because the active demo-borehole layer does not yet include 58-32.",
            ],
        },
        "valueEncoding": {
            "amplitude": "processed seismic amplitudes are stored as uint8 normalized p02-p98 textures",
            "velocity": {
                "meaning": "interval velocity",
                "unit": "m/s",
                "displayRangeMPerS": VELOCITY_DISPLAY_RANGE_M_PER_S,
            },
        },
        "capabilityPresets": capability_presets,
        "products": [product_to_manifest(product) for product in products],
        "sourceFiles": [entry["normalizedPath"] for entry in normalization["normalizedFiles"]],
        "requiredProductSourceGates": required_product_source_gates,
        "provenance": {
            "classification": "source-derived seismic browser visual representation",
            "sourceOrigin": "Utah FORGE GDR submissions 1015 and 1141",
            "script": "prep/build_utah_forge_seismic_browser.py",
            "notes": [
                "Browser artifacts are source-derived visual representations generated from SEG-Y trace and sample grids.",
                "Raymarch volumes are browser-ready source-fidelity amplitude textures for visual communication; they are not certified for engineering design or interpretation decisions.",
                "Legacy L5/L11 sections use trace-header CMP coordinates transformed from declared NAD27 State Plane feet when those coordinates resolve to plausible EPSG:26912 UTM placement.",
                "Fallback endpoints remain available only for products with no delivered trace or navigation geometry and cannot support precise registration claims.",
            ],
        },
    }
    manifest_path = PHASE3_PROCESSED_ROOT / "browser" / "seismic_manifest.json"
    write_json(manifest_path, manifest)
    sync_project_seismic_layer(
        products,
        manifest,
        source_gates,
        required_product_source_gates,
    )

    provenance = {
        "schema": "geosee.provenance.v1",
        "artifact": rel(manifest_path),
        "derivedDate": DERIVED_DATE,
        "sourceInventory": rel(inventory_path),
        "navigation": rel(navigation_path),
        "productCount": len(products),
        "script": "prep/build_utah_forge_seismic_browser.py",
        "normalization": normalization,
    }
    write_json(PHASE3_PROCESSED_ROOT / "browser" / "provenance.json", provenance)

    print(
        json.dumps(
            {
                "products": len(products),
                "manifest": rel(manifest_path),
                "inventory": rel(inventory_path),
                "navigation": rel(navigation_path),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
