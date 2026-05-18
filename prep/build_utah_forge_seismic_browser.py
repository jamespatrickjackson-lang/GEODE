from __future__ import annotations

import hashlib
import json
import math
import os
import re
import shutil
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import segyio
from pyproj import Transformer


REPO_ROOT = Path.cwd()
PROJECT_ROOT = REPO_ROOT / "projects" / "utah-forge"
CLIENT_ROOT = PROJECT_ROOT / "data" / "client_preprocessed"
PROCESSED_ROOT = PROJECT_ROOT / "data" / "geosee_processed"
PHASE3_SOURCE_ROOT = (
    CLIENT_ROOT / "utah_forge_phase_3" / "seismic_analysis"
)
PHASE3_PROCESSED_ROOT = (
    PROCESSED_ROOT / "utah_forge_phase_3" / "seismic_analysis"
)
STAGING_ROOT = CLIENT_ROOT / "forge_southwestern" / "Data_staging"
UNSORTED_ROOT = CLIENT_ROOT / "Unsorted data"

DERIVED_DATE = os.environ.get("GEOSEE_DERIVED_DATE", "2026-05-13")
SCENE_ORIGIN_E = 341_467.35
SCENE_ORIGIN_N = 4_273_374.5
SCENE_ORIGIN_Z = 0.0
TIME_SCALE_M_PER_MS = 2.0
SECTION_WIDTH = 128
SECTION_HEIGHT = 128
VOLUME_DIM = 64

RAW_DIR_MARKERS = (
    "Correlated_Shot_Gathers",
    "UnCorrelated_Shot_Gathers",
    "Uncorrelated_Shot_Gathers",
    "Pilot_Aux",
)


@dataclass
class Product:
    id: str
    label: str
    source_file: Path
    normalized_source_file: Path
    source_submission: str
    survey_kind: str
    product_kind: str
    domain_kind: str
    domain_unit: str
    datum_m: float
    trace_count: int
    sample_count: int
    sample_min: float
    sample_max: float
    sample_interval: float
    stats: dict[str, Any]
    sections: list[dict[str, Any]]
    raymarch_volume: dict[str, Any] | None
    text_header_excerpt: str


def rel(path: Path) -> str:
    return path.resolve().relative_to(REPO_ROOT).as_posix()


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


def source_roots() -> tuple[Path, Path]:
    base = STAGING_ROOT if STAGING_ROOT.exists() else UNSORTED_ROOT
    return find_submission(base, "1015"), find_submission(base, "1141")


def is_raw_path(path: Path) -> bool:
    return any(marker in path.parts for marker in RAW_DIR_MARKERS) or path.name.startswith("._")


def normalize_sources() -> dict[str, Any]:
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

    return {
        "sourceRoots": {
            "submission1015": rel(src1015),
            "submission1141": rel(src1141),
        },
        "normalizedFiles": normalized,
        "skippedRawGatherFileCount": skipped_raw,
        "notes": [
            "Active processed products, navigation, velocity, and documentation are normalized into the Phase 3 seismic source slot.",
            "Raw correlated/uncorrelated shot gathers remain quarantined in their original source staging folders and are not active browser products.",
            "Existing source copies are never deleted by this script.",
        ],
    }


def parse_sp1(path: Path) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []
    for line in path.read_text(errors="replace").splitlines()[15:]:
        m = re.search(r"(\d{6})\s+\d{8}N\d{9}W\s+(\d{7})(\d{8})(\d{5})", line)
        if not m:
            continue
        station = m.group(1)
        easting = int(m.group(2)) / 10.0
        northing = int(m.group(3)) / 10.0
        elevation = int(m.group(4)) / 10.0
        points.append(
            {
                "station": station,
                "line": station[:3],
                "easting_m": easting,
                "northing_m": northing,
                "elevation_m": elevation,
                "scene": [
                    easting - SCENE_ORIGIN_E,
                    northing - SCENE_ORIGIN_N,
                    elevation - SCENE_ORIGIN_Z,
                ],
            }
        )
    return points


def build_navigation_geojson() -> dict[str, Any]:
    nav_root = PHASE3_SOURCE_ROOT / "source" / "from_submission_1015"
    sources = [
        ("3d-receiver", "receiver", nav_root / "Navigation" / "Forge-3D-Receiver-Survey-NAD83-UTM12.sp1"),
        ("3d-source", "source", nav_root / "Navigation" / "Forge-3D-Source-Survey-NAD83-UTM12.sp1"),
        ("2d-receiver", "receiver", nav_root / "2D" / "Forge 2D Receiver Survey NAD83 UTM 12.sp1"),
        ("2d-source", "source", nav_root / "2D" / "Forge 2D Source Survey NAD83 UTM 12.sp1"),
    ]
    features: list[dict[str, Any]] = []
    all_points: list[dict[str, Any]] = []
    line_paths: dict[str, list[dict[str, Any]]] = {}

    for dataset_id, role, path in sources:
        if not path.exists():
            continue
        points = parse_sp1(path)
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
                        "sourceCrs": "EPSG:26912",
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
                    "sourceCrs": "EPSG:26912",
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
            "sourceCrs": "EPSG:26912",
            "axisConvention": "X east, Y north, Z up",
            "sceneOriginUtm": {
                "easting_m": SCENE_ORIGIN_E,
                "northing_m": SCENE_ORIGIN_N,
                "elevation_m": SCENE_ORIGIN_Z,
            },
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


def survey_kind(path: Path) -> str:
    parts = [p.lower() for p in path.parts]
    name = path.name.lower()
    if "legacy line 5" in " ".join(parts) or "legacy line 11" in " ".join(parts):
        return "legacy-2d"
    if "3d survey" in " ".join(parts) or "forge3d" in name:
        return "3d"
    return "2d"


def datum_for(path: Path) -> float:
    name = path.name.lower()
    if "302" in name:
        return 2100.0
    return 1800.0


def trace_line_id(path: Path) -> str:
    text = path.name.lower()
    if "301" in text:
        return "301"
    if "302" in text:
        return "302"
    if "l5" in text or "line 5" in " ".join(p.lower() for p in path.parts):
        return "legacy-l5"
    if "l11" in text or "line 11" in " ".join(p.lower() for p in path.parts):
        return "legacy-l11"
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
    name = path.name.lower()
    enhancement = enhancement_status(path)
    modifiers: list[str] = []
    if enhancement:
        modifiers.append(enhancement)
    if "meters" in name:
        modifiers.append("meters")
    modifier_text = f" ({', '.join(modifiers)})" if modifiers else ""

    if survey == "3d":
        if kind == "velocity":
            return "3D velocity model (time domain)"
        if "poststack" in name:
            return "3D post-stack time migration FXY decon stack"
        if "ani" in name and "psdm" in name:
            return f"3D anisotropic PSDM depth stack{modifier_text}"
        if "pstm" in name:
            return f"3D PSTM time stack{modifier_text}"
        return f"3D processed seismic volume{modifier_text}"

    prefix = "2D legacy" if survey == "legacy-2d" else "2D"
    line = source_line_label(path)
    if kind == "velocity":
        descriptor = "PSDM interval velocity" if "interval" in name else "velocity model"
    elif "unmigrated" in name:
        descriptor = "unmigrated time stack"
    elif kind == "poststack-time-migration":
        descriptor = "post-stack time migration section"
    elif kind == "psdm":
        if "migr" in name and "depth" in name and "psdm" not in name and "pdm" not in name:
            descriptor = "migrated depth section"
        else:
            descriptor = (
                "PDM depth section"
                if "pdm" in name and "psdm" not in name
                else "PSDM depth section"
            )
    elif kind == "pstm":
        descriptor = "PSTM time stack" if "stack" in name else "PSTM time section"
    elif kind == "stack":
        descriptor = "time stack"
    elif "migr" in name and "depth" in name:
        descriptor = "migrated depth section"
    else:
        descriptor = "processed seismic section"
    return f"{prefix} {line} {descriptor}{modifier_text}"


def read_text_header(f: segyio.SegyFile) -> str:
    raw = f.text[0]
    for encoding in ("ascii", "cp500", "latin-1"):
        text = raw.decode(encoding, errors="replace")
        if "CLIENT" in text or encoding == "latin-1":
            return " ".join(text.split())[:900]
    return ""


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


def trace_grid_shape(trace_count: int, max_width: int, max_height: int) -> tuple[int, int]:
    width = max(2, min(max_width, int(math.sqrt(max(1, trace_count)))))
    height = max(2, min(max_height, trace_count // width))
    while width * height > trace_count and height > 2:
        height -= 1
    while width * height > trace_count and width > 2:
        width -= 1
    return width, height


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


def line_endpoints_for(product_path: Path, nav_paths: dict[str, list[list[float]]], bounds: dict[str, list[float]]) -> list[list[float]]:
    line_id = trace_line_id(product_path)
    if line_id in nav_paths and len(nav_paths[line_id]) >= 2:
        coords = nav_paths[line_id]
        return [coords[0], coords[-1]]
    min_x, min_y, _ = bounds["min"]
    max_x, max_y, _ = bounds["max"]
    mid_z = 1800.0
    if line_id == "legacy-l5":
        return [[min_x - 6000, min_y + 2500, mid_z], [max_x + 4500, max_y - 2200, mid_z]]
    if line_id == "legacy-l11":
        return [[min_x - 5000, max_y + 2800, mid_z], [max_x + 5500, min_y - 3000, mid_z]]
    return [[min_x, (min_y + max_y) / 2, mid_z], [max_x, (min_y + max_y) / 2, mid_z]]


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
) -> tuple[dict[str, Any], dict[str, float]]:
    stats = amplitude_stats(matrix)
    encoded = encode_u8(matrix, stats)
    file_name = f"{section_id}.u8"
    (product_dir / file_name).write_bytes(encoded.tobytes(order="C"))
    domain_kind_value, domain_unit = domain
    spec: dict[str, Any] = {
        "id": section_id,
        "label": label,
        "axis": axis,
        "fraction": round(fraction, 4),
        "width": int(matrix.shape[1]),
        "height": int(matrix.shape[0]),
        "amplitudeFile": f"products/{product_id}/{file_name}",
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
    }
    if axis == "line":
        spec["path"] = line_endpoints_for(product_path, nav_paths, bounds)
    else:
        spec["sceneBounds"] = bounds
    return spec, stats


def build_volume(
    path: Path,
    product_dir: Path,
    product_id: str,
    domain: tuple[str, str],
    samples: np.ndarray,
    datum_m: float,
    bounds: dict[str, list[float]],
) -> tuple[dict[str, Any], dict[str, float]]:
    with segyio.open(str(path), "r", strict=False, ignore_geometry=True) as f:
        trace_count = f.tracecount
        sample_count = len(f.samples)
    nx, ny = trace_grid_shape(trace_count, VOLUME_DIM, VOLUME_DIM)
    nz = VOLUME_DIM
    trace_idx = selected_trace_indices(trace_count, nx * ny)
    sample_idx = selected_sample_indices(sample_count, nz)
    matrix = sample_matrix(path, trace_idx, sample_idx)
    volume = matrix.reshape((nz, ny, nx))
    stats = amplitude_stats(volume)
    encoded = encode_u8(volume, stats)
    file_name = "volume.u8"
    (product_dir / file_name).write_bytes(encoded.tobytes(order="C"))
    domain_kind_value, domain_unit = domain
    domain_min = float(samples[int(sample_idx[0])])
    domain_max = float(samples[int(sample_idx[-1])])
    z_scale = TIME_SCALE_M_PER_MS if domain_unit == "ms" else 1.0
    volume_bounds = {
        "min": [bounds["min"][0], bounds["min"][1], datum_m - domain_max * z_scale],
        "max": [bounds["max"][0], bounds["max"][1], datum_m - domain_min * z_scale],
    }
    return (
        {
            "file": f"products/{product_id}/{file_name}",
            "encoding": "uint8-normalized-p02-p98",
            "dimensions": [nx, ny, nz],
            "sceneBounds": volume_bounds,
            "sampleDomain": {
                "kind": domain_kind_value,
                "unit": domain_unit,
                "min": round(domain_min, 6),
                "max": round(domain_max, 6),
                "verticalScaleMPerUnit": z_scale,
            },
            "amplitudeStats": {k: round(v, 6) for k, v in stats.items()},
        },
        stats,
    )


def classify_products() -> list[Path]:
    source_root = PHASE3_SOURCE_ROOT / "source"
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
    datum = datum_for(path)
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
        samples = np.asarray(f.samples[:], dtype=np.float32)
        sample_count = len(samples)
        sample_interval = float(segyio.tools.dt(f) or 0)
        text_header = read_text_header(f)

    if survey == "3d":
        for axis in ("inline", "crossline"):
            for fraction in (0.25, 0.5, 0.75):
                trace_idx = selected_trace_indices(trace_count, SECTION_WIDTH, fraction)
                sample_idx = selected_sample_indices(sample_count, SECTION_HEIGHT)
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
                    nav_bounds,
                    nav_paths,
                )
                sections.append(spec)
                section_stats.append(stats)
        for fraction in (0.25, 0.5, 0.75):
            plane_width, plane_height = trace_grid_shape(trace_count, SECTION_WIDTH, SECTION_HEIGHT)
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
                nav_bounds,
                nav_paths,
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
            nav_bounds,
        )
        section_stats.append(volume_stats)
    else:
        trace_idx = selected_trace_indices(trace_count, min(SECTION_WIDTH, trace_count))
        sample_idx = selected_sample_indices(sample_count, SECTION_HEIGHT)
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
            nav_bounds,
            nav_paths,
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
    label = product_label(path, survey, kind, domain)
    return Product(
        id=product_id,
        label=label,
        source_file=path,
        normalized_source_file=path,
        source_submission=source_submission,
        survey_kind=survey,
        product_kind=kind,
        domain_kind=domain[0],
        domain_unit=domain[1],
        datum_m=datum,
        trace_count=trace_count,
        sample_count=sample_count,
        sample_min=float(samples[0]) if len(samples) else 0,
        sample_max=float(samples[-1]) if len(samples) else 0,
        sample_interval=sample_interval,
        stats=stats,
        sections=sections,
        raymarch_volume=raymarch_volume,
        text_header_excerpt=text_header,
    )


def product_to_manifest(product: Product) -> dict[str, Any]:
    return {
        "id": product.id,
        "label": product.label,
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
        "traceCount": product.trace_count,
        "sampleCount": product.sample_count,
        "sampleRange": [round(product.sample_min, 6), round(product.sample_max, 6)],
        "sampleInterval": product.sample_interval,
        "amplitudeStats": {k: round(v, 6) for k, v in product.stats.items()},
        "sections": product.sections,
        "raymarchVolume": product.raymarch_volume,
        "textHeaderExcerpt": product.text_header_excerpt,
    }


def write_json(path: Path, payload: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


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

    inventory = {
        "schema": "geosee.seismic-source-inventory.v1",
        "project": "Utah FORGE Phase 3 seismic analysis",
        "derivedDate": DERIVED_DATE,
        "normalization": normalization,
        "activeProductCount": len(products),
        "activeProducts": [
            {
                "id": p.id,
                "label": p.label,
                "sourceSubmission": p.source_submission,
                "sourceFile": rel(p.normalized_source_file),
                "surveyKind": p.survey_kind,
                "productKind": p.product_kind,
                "domainKind": p.domain_kind,
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
        },
        "crs": {
            "rendered": "scene-local meters",
            "primarySourceCrs": "EPSG:26912 NAD83 / UTM Zone 12N",
            "legacySourceCrs": "EPSG:32043 NAD27 / Utah Central, US survey foot",
            "axisConvention": "X east, Y north, Z up",
            "sceneOriginUtm": {
                "easting_m": SCENE_ORIGIN_E,
                "northing_m": SCENE_ORIGIN_N,
                "elevation_m": SCENE_ORIGIN_Z,
            },
        },
        "sampleDomain": {
            "timeScaleMPerMs": TIME_SCALE_M_PER_MS,
            "depthScaleMPerM": 1.0,
            "notes": [
                "Time-domain products use a display scale in meters per millisecond for vertical placement.",
                "Depth-domain products use depth below seismic datum where the source product is depth migrated.",
            ],
        },
        "products": [product_to_manifest(product) for product in products],
        "sourceFiles": [entry["normalizedPath"] for entry in normalization["normalizedFiles"]],
        "provenance": {
            "classification": "source-derived seismic browser preview",
            "sourceOrigin": "Utah FORGE GDR submissions 1015 and 1141",
            "script": "prep/build_utah_forge_seismic_browser.py",
            "notes": [
                "Browser artifacts are downsampled visual products derived from SEG-Y source files.",
                "Raymarch volumes are compact downsampled amplitude textures, not engineering-grade seismic interpretation volumes.",
                "Legacy L5/L11 sections are included as section curtains; where no delivered navigation line exists, placement is approximate and documented in the source inventory.",
            ],
        },
    }
    manifest_path = PHASE3_PROCESSED_ROOT / "browser" / "seismic_manifest.json"
    write_json(manifest_path, manifest)

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
