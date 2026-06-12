from __future__ import annotations

import argparse
import csv
import html
import io
import json
import math
import re
import statistics
import urllib.parse
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from openpyxl import load_workbook


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_ROOT = REPO_ROOT / ".tmp" / "source-intake" / "utah-forge-borehole-logs"
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "projects"
    / "utah-forge"
    / "data"
    / "geosee_processed"
    / "utah_forge_phase_3"
    / "borehole_logs"
    / "borehole_logs_manifest.json"
)
DEFAULT_INVENTORY = REPO_ROOT / ".tmp" / "utah-forge-borehole-logs-inventory.json"
DEMO_BOREHOLES_MANIFEST = (
    REPO_ROOT
    / "projects"
    / "utah-forge"
    / "data"
    / "geosee_processed"
    / "utah_forge_phase_3"
    / "demo_boreholes"
    / "phase3_demo_boreholes.json"
)

SCENE_ORIGIN_UTM = {
    "easting_m": 341467.35,
    "northing_m": 4273374.5,
    "elevation_m": 0,
}

GAMMA_MNEMONICS = {"GR", "GAMMA", "CGR", "SGR", "HCGR", "HSGR"}
RESISTIVITY_MNEMONICS = {
    "RES",
    "RESD",
    "RESM",
    "RESS",
    "RT",
    "RILD",
    "ILD",
    "AT10",
    "AT20",
    "AT30",
    "AT60",
    "AT90",
    "AHT90",
}

MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024
_SUBMISSION_RESOURCE_CACHE: dict[str, dict[str, dict[str, Any]]] = {}

WELL_ALIASES = {
    "16A": "16A(78)-32",
    "16A(78)-32": "16A(78)-32",
    "16A78-32": "16A(78)-32",
    "16A78": "16A(78)-32",
    "16B": "16B(78)-32",
    "16B(78)-32": "16B(78)-32",
    "16B78-32": "16B(78)-32",
    "16B78": "16B(78)-32",
    "58-32": "58-32",
    "68-32": "68-32",
    "78-32": "78-32",
    "78B-32": "78B-32",
}

TARGET_WELLS = {
    "16A(78)-32",
    "16B(78)-32",
    "58-32",
    "68-32",
    "78-32",
}

RESOURCE_CATALOG = [
    {
        "submission": "GDR 1358",
        "well": "locations",
        "filename": "Utah FORGE Well and Seismic Locations.csv",
        "description": "Updated well and seismic station GPS coordinates",
    },
    {
        "submission": "GDR 1283",
        "well": "16A(78)-32",
        "filename": "16A78-32 Survey Data Higher Depth Resolution.xlsx",
        "description": "16A directional survey workbook",
    },
    {
        "submission": "GDR 1283",
        "well": "16A(78)-32",
        "filename": "16A78-32 Final Mud Log.las",
        "description": "16A final mud log LAS",
    },
    {
        "submission": "GDR 1292",
        "well": "16A(78)-32",
        "filename": "16A78-32 Schlumberger Spectral Log.las",
        "description": "16A Schlumberger spectral LAS",
    },
    {
        "submission": "GDR 1516",
        "well": "16B(78)-32",
        "filename": "Well Survey.zip",
        "description": "16B final gyro survey archive",
    },
    {
        "submission": "GDR 1516",
        "well": "16B(78)-32",
        "filename": "Mud Logs.zip",
        "description": "16B mud logs archive",
    },
    {
        "submission": "GDR 1516",
        "well": "16B(78)-32",
        "filename": "Mud Temperature Logs.zip",
        "description": "16B mud temperature LAS archive",
    },
    {
        "submission": "GDR 1531",
        "well": "16B(78)-32",
        "filename": "Wireline Data.zip",
        "description": "16B wireline logs archive",
    },
    {
        "submission": "GDR 1006",
        "well": "58-32",
        "filename": "MU-ESW1 data to 7536' TD.csv",
        "description": "58-32 one-foot interval drilling dataset",
    },
    {
        "submission": "GDR 1006",
        "well": "58-32",
        "filename": "Well 58-32 Logs.zip",
        "description": "58-32 Schlumberger logs archive",
    },
    {
        "submission": "GDR 1006",
        "well": "58-32",
        "filename": "Well 58-32 PT Logs.zip",
        "description": "58-32 pressure/temperature LAS archive",
    },
    {
        "submission": "GDR 1006",
        "well": "58-32",
        "filename": "Well 58-32 Sonic Log.las",
        "description": "58-32 standalone sonic LAS",
    },
    {
        "submission": "GDR 1153",
        "well": "Phase2C",
        "filename": "Well Locations.zip",
        "description": "Phase2C ArcGIS well locations shapefile",
    },
    {
        "submission": "GDR 1153",
        "well": "68-32",
        "filename": "Well 68-32 data.zip",
        "description": "68-32 drilling, lithologic, and cuttings archive",
    },
    {
        "submission": "GDR 1153",
        "well": "78-32",
        "filename": "Well 78-32 data.zip",
        "description": "78-32 drilling, lithologic, and cuttings archive",
    },
    {
        "submission": "GDR 1440",
        "well": "trajectory-cross-check",
        "filename": "Utah FORGE borehole sensors and well trajectories",
        "description": "External trajectory spreadsheet collection landing page",
        "externalUrl": "https://constantine.seis.utah.edu/forge_borehole_sensors/",
    },
]


class BoreholeLogIngestError(RuntimeError):
    pass


@dataclass
class ParsedTrack:
    well_id: str
    kind: str
    mnemonic: str
    unit: str
    depth_unit: str
    source_submission: str
    source_file: str
    source_member: str | None
    samples: list[dict[str, float]]
    nominal_spacing_ft: float | None


@dataclass
class ParsedLithology:
    well_id: str
    from_ft: float
    to_ft: float
    lithology: str
    source_submission: str
    source_file: str
    source_member: str | None
    source_note: str | None = None


def canonical_well_id(value: str | None) -> str | None:
    if not value:
        return None
    text = value.upper().replace(" ", "")
    text = text.replace("_", "-")
    text = text.replace("WELL", "")
    if "16A" in text:
        return "16A(78)-32"
    if "16B" in text:
        return "16B(78)-32"
    for key in ["78B-32", "58-32", "68-32", "78-32"]:
        if key in text:
            return WELL_ALIASES[key]
    compact = re.sub(r"[^A-Z0-9-]", "", text)
    return WELL_ALIASES.get(compact)


def detect_well_id(*values: str | None) -> str | None:
    for value in values:
        well = canonical_well_id(value)
        if well:
            return well
    return None


def scene_point(easting_m: float, northing_m: float, elevation_m: float) -> list[float]:
    return [
        round(easting_m - SCENE_ORIGIN_UTM["easting_m"], 3),
        round(northing_m - SCENE_ORIGIN_UTM["northing_m"], 3),
        round(elevation_m - SCENE_ORIGIN_UTM["elevation_m"], 3),
    ]


def source_submission_for(path: str, detected_well: str | None = None) -> str:
    text = path.lower()
    if "gdr 1292" in text or "spectral" in text:
        return "GDR 1292"
    if "gdr 1531" in text or "wireline" in text:
        return "GDR 1531"
    if "gdr 1516" in text or (detected_well == "16B(78)-32" and "mud" in text):
        return "GDR 1516"
    if "gdr 1283" in text or detected_well == "16A(78)-32":
        return "GDR 1283"
    if "gdr 1006" in text or detected_well == "58-32":
        return "GDR 1006"
    if "gdr 1153" in text or detected_well in {"68-32", "78-32"}:
        return "GDR 1153"
    if "gdr 1358" in text:
        return "GDR 1358"
    return "local-source-intake"


def finite_number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    text = str(value).strip().replace(",", "")
    if not text:
        return None
    match = re.search(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", text)
    if not match:
        return None
    try:
        number = float(match.group(0))
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")


def first_number(*values: Any) -> float | None:
    for value in values:
        number = finite_number(value)
        if number is not None:
            return number
    return None


def median_spacing_ft(depths_ft: Iterable[float]) -> float | None:
    ordered = sorted({round(depth, 6) for depth in depths_ft if math.isfinite(depth)})
    diffs = [
        round(ordered[index] - ordered[index - 1], 6)
        for index in range(1, len(ordered))
        if ordered[index] > ordered[index - 1]
    ]
    if not diffs:
        return None
    return round(statistics.median(diffs), 6)


def is_null_value(value: float, null_value: float | None) -> bool:
    if null_value is None:
        return False
    return math.isclose(value, null_value, rel_tol=0, abs_tol=1e-9)


def depth_to_ft(depth: float, unit: str) -> float:
    if unit.upper() in {"M", "METER", "METERS"}:
        return depth * 3.280839895
    return depth


def parse_las_curve_line(line: str) -> tuple[str, str] | None:
    before_colon = line.split(":", 1)[0].strip()
    if not before_colon:
        return None
    token = before_colon.split()[0]
    if "." in token:
        mnemonic, unit = token.split(".", 1)
    else:
        mnemonic, unit = token, ""
    mnemonic = re.sub(r"[^A-Za-z0-9_]", "", mnemonic).upper()
    unit = re.sub(r"[^A-Za-z0-9_/-]", "", unit).upper()
    if not mnemonic:
        return None
    return mnemonic, unit


def parse_las_text(
    text: str,
    source_file: str,
    source_member: str | None = None,
) -> list[ParsedTrack]:
    well_id = detect_well_id(source_file, source_member, text[:2000])
    if not well_id:
        return []
    source_submission = source_submission_for(f"{source_file} {source_member or ''}", well_id)
    section = ""
    curves: list[tuple[str, str]] = []
    rows: list[list[float]] = []
    null_value: float | None = None
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("~"):
            upper = line.upper()
            if upper.startswith("~C"):
                section = "curve"
            elif upper.startswith("~A"):
                section = "ascii"
            elif upper.startswith("~W"):
                section = "well"
            else:
                section = ""
            continue
        if section == "well" and line.upper().startswith("NULL"):
            null_value = finite_number(line.split(":", 1)[0].split(".", 1)[-1])
            if null_value is None:
                null_value = finite_number(line)
        elif section == "curve":
            parsed = parse_las_curve_line(line)
            if parsed:
                curves.append(parsed)
        elif section == "ascii":
            values = [finite_number(part) for part in re.split(r"[\s,]+", line) if part]
            if values and all(value is not None for value in values):
                rows.append([float(value) for value in values if value is not None])

    if len(curves) < 2 or not rows:
        return []
    depth_mnemonic, depth_unit = curves[0]
    if depth_mnemonic not in {"DEPT", "DEPTH", "MD"}:
        depth_unit = curves[0][1] or "FT"
    all_depths_ft = [
        depth_to_ft(row[0], depth_unit or "FT")
        for row in rows
        if row and not is_null_value(row[0], null_value)
    ]
    nominal_spacing = median_spacing_ft(all_depths_ft)
    tracks: list[ParsedTrack] = []
    for column_index, (mnemonic, unit) in enumerate(curves[1:], start=1):
        kind = None
        if mnemonic in GAMMA_MNEMONICS:
            kind = "gamma"
            unit = unit or "API"
        elif mnemonic in RESISTIVITY_MNEMONICS:
            kind = "resistivity"
            unit = unit or "OHMM"
        if kind is None:
            continue
        samples = []
        for row in rows:
            if len(row) <= column_index:
                continue
            depth = row[0]
            value = row[column_index]
            if is_null_value(depth, null_value) or is_null_value(value, null_value):
                continue
            md_ft = depth_to_ft(depth, depth_unit or "FT")
            samples.append({"mdFt": round(md_ft, 6), "value": round(value, 6)})
        if not samples:
            continue
        tracks.append(
            ParsedTrack(
                well_id=well_id,
                kind=kind,
                mnemonic=mnemonic,
                unit=unit,
                depth_unit=(depth_unit or "FT").lower(),
                source_submission=source_submission,
                source_file=source_file,
                source_member=source_member,
                samples=downsample_samples(samples),
                nominal_spacing_ft=nominal_spacing,
            ),
        )
    return tracks


def downsample_samples(samples: list[dict[str, float]], limit: int = 5000) -> list[dict[str, float]]:
    if len(samples) <= limit:
        return samples
    stride = math.ceil(len(samples) / limit)
    reduced = samples[::stride]
    if reduced[-1] != samples[-1]:
        reduced.append(samples[-1])
    return reduced


def lithology_from_rows(
    rows: list[dict[str, Any]],
    source_file: str,
    source_member: str | None = None,
) -> list[ParsedLithology]:
    intervals: list[ParsedLithology] = []
    source_submission = source_submission_for(f"{source_file} {source_member or ''}")
    for row in rows:
        normalized = {normalize_key(str(key)): value for key, value in row.items() if key is not None}
        lithology = (
            normalized.get("lithology")
            or normalized.get("lithologic_description")
            or normalized.get("description")
            or normalized.get("formation")
        )
        if lithology is None or not str(lithology).strip():
            continue
        well_id = detect_well_id(
            str(normalized.get("well") or normalized.get("well_id") or ""),
            source_file,
            source_member,
        )
        if not well_id:
            continue
        from_ft = first_number(
            normalized.get("from_ft"),
            normalized.get("top_ft"),
            normalized.get("depth_from_ft"),
            normalized.get("start_ft"),
        )
        to_ft = first_number(
            normalized.get("to_ft"),
            normalized.get("bottom_ft"),
            normalized.get("depth_to_ft"),
            normalized.get("end_ft"),
        )
        if from_ft is None or to_ft is None or to_ft <= from_ft:
            continue
        intervals.append(
            ParsedLithology(
                well_id=well_id,
                from_ft=round(from_ft, 6),
                to_ft=round(to_ft, 6),
                lithology=str(lithology).strip(),
                source_submission=source_submission_for(f"{source_file} {source_member or ''}", well_id)
                if source_submission == "local-source-intake"
                else source_submission,
                source_file=source_file,
                source_member=source_member,
                source_note=str(normalized.get("source_note")).strip()
                if normalized.get("source_note")
                else None,
            ),
        )
    return intervals


def parse_csv_lithology(data: bytes, source_file: str, source_member: str | None = None) -> list[ParsedLithology]:
    text = data.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    return lithology_from_rows(list(reader), source_file, source_member)


def parse_xlsx_lithology(data: bytes, source_file: str, source_member: str | None = None) -> list[ParsedLithology]:
    workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    intervals: list[ParsedLithology] = []
    for sheet in workbook.worksheets:
        rows = list(sheet.iter_rows(values_only=True))
        if not rows:
            continue
        header_index = None
        for index, row in enumerate(rows[:10]):
            keys = {normalize_key(str(value)) for value in row if value is not None}
            if "lithology" in keys and ({"from_ft", "top_ft", "depth_from_ft"} & keys):
                header_index = index
                break
        if header_index is None:
            continue
        headers = [str(value) if value is not None else "" for value in rows[header_index]]
        dict_rows = []
        for row in rows[header_index + 1 :]:
            dict_rows.append(
                {headers[index]: value for index, value in enumerate(row) if index < len(headers)}
            )
        intervals.extend(lithology_from_rows(dict_rows, source_file, source_member))
    workbook.close()
    return intervals


def parse_supported_payload(
    data: bytes,
    extension: str,
    source_file: str,
    source_member: str | None,
) -> tuple[list[ParsedTrack], list[ParsedLithology]]:
    extension = extension.lower()
    try:
        if extension == ".las":
            text = data.decode("utf-8", errors="replace")
            return parse_las_text(text, source_file, source_member), []
        if extension == ".csv":
            return [], parse_csv_lithology(data, source_file, source_member)
        if extension == ".xlsx":
            return [], parse_xlsx_lithology(data, source_file, source_member)
    except Exception as exc:  # noqa: BLE001 - keep inventory tolerant.
        raise BoreholeLogIngestError(f"failed to parse {source_member or source_file}: {exc}") from exc
    return [], []


def inventory_source_root(source_root: Path) -> tuple[dict[str, Any], list[ParsedTrack], list[ParsedLithology], list[dict[str, Any]]]:
    entries: list[dict[str, Any]] = []
    tracks: list[ParsedTrack] = []
    lithologies: list[ParsedLithology] = []
    gaps: list[dict[str, Any]] = []
    if not source_root.exists():
        return {"sourceRoot": str(source_root), "entries": []}, tracks, lithologies, gaps
    for path in sorted(source_root.rglob("*")):
        if not path.is_file():
            continue
        extension = path.suffix.lower()
        rel = path.relative_to(source_root).as_posix()
        entry = {
            "kind": "file",
            "path": rel,
            "extension": extension,
            "bytes": path.stat().st_size,
        }
        entries.append(entry)
        if extension == ".zip":
            zip_entries, zip_tracks, zip_lithologies, zip_gaps = inventory_zip(
                path.read_bytes(),
                rel,
                path.name,
            )
            entries.extend(zip_entries)
            tracks.extend(zip_tracks)
            lithologies.extend(zip_lithologies)
            gaps.extend(zip_gaps)
        elif extension in {".las", ".csv", ".xlsx"}:
            try:
                parsed_tracks, parsed_lithologies = parse_supported_payload(
                    path.read_bytes(),
                    extension,
                    path.name,
                    None,
                )
                tracks.extend(parsed_tracks)
                lithologies.extend(parsed_lithologies)
            except BoreholeLogIngestError as exc:
                gaps.append({"status": "parse-failed", "source": rel, "reason": str(exc)})
        elif extension in {".dlis", ".pdf"}:
            gaps.append(
                {
                    "status": "source-present-not-parsed",
                    "source": rel,
                    "format": extension.lstrip(".").upper(),
                },
            )
    return {"sourceRoot": str(source_root), "entries": entries}, tracks, lithologies, gaps


def inventory_zip(
    data: bytes,
    virtual_root: str,
    source_file: str,
    depth: int = 0,
) -> tuple[list[dict[str, Any]], list[ParsedTrack], list[ParsedLithology], list[dict[str, Any]]]:
    entries: list[dict[str, Any]] = []
    tracks: list[ParsedTrack] = []
    lithologies: list[ParsedLithology] = []
    gaps: list[dict[str, Any]] = []
    if depth > 4:
        gaps.append({"status": "archive-depth-limit", "source": virtual_root})
        return entries, tracks, lithologies, gaps
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for info in archive.infolist():
            if info.is_dir():
                continue
            member_name = info.filename.replace("\\", "/")
            virtual_path = f"{virtual_root}::{member_name}"
            extension = Path(member_name).suffix.lower()
            entries.append(
                {
                    "kind": "zip-member",
                    "virtualPath": virtual_path,
                    "extension": extension,
                    "bytes": info.file_size,
                },
            )
            payload = archive.read(info)
            if extension == ".zip":
                child_entries, child_tracks, child_lithologies, child_gaps = inventory_zip(
                    payload,
                    virtual_path,
                    source_file,
                    depth + 1,
                )
                entries.extend(child_entries)
                tracks.extend(child_tracks)
                lithologies.extend(child_lithologies)
                gaps.extend(child_gaps)
            elif extension in {".las", ".csv", ".xlsx"}:
                try:
                    parsed_tracks, parsed_lithologies = parse_supported_payload(
                        payload,
                        extension,
                        source_file,
                        member_name,
                    )
                    tracks.extend(parsed_tracks)
                    lithologies.extend(parsed_lithologies)
                except BoreholeLogIngestError as exc:
                    gaps.append({"status": "parse-failed", "source": virtual_path, "reason": str(exc)})
            elif extension in {".dlis", ".pdf"}:
                gaps.append(
                    {
                        "status": "source-present-not-parsed",
                        "source": virtual_path,
                        "format": extension.lstrip(".").upper(),
                    },
                )
    return entries, tracks, lithologies, gaps


def resource_url(submission: str, filename: str) -> str:
    number = re.search(r"\d+", submission)
    if not number:
        raise ValueError(f"invalid GDR submission label: {submission}")
    return f"https://gdr.openei.org/files/{number.group(0)}/{urllib.parse.quote(filename)}"


def resource_name_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", html.unescape(value).lower()).strip()


def safe_download_url(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    path = urllib.parse.quote(parsed.path, safe="/%()")
    query = urllib.parse.quote(parsed.query, safe="=&%")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, query, parsed.fragment))


def parse_size_bytes(value: str | None) -> int | None:
    if not value:
        return None
    match = re.search(r"([\d.]+)\s*([kmgt]?b)", value.strip(), re.I)
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2).lower()
    multiplier = {
        "b": 1,
        "kb": 1024,
        "mb": 1024**2,
        "gb": 1024**3,
        "tb": 1024**4,
    }.get(unit)
    return int(number * multiplier) if multiplier else None


def scraped_submission_resources(submission: str) -> dict[str, dict[str, Any]]:
    if submission in _SUBMISSION_RESOURCE_CACHE:
        return _SUBMISSION_RESOURCE_CACHE[submission]
    number = re.search(r"\d+", submission)
    if not number:
        return {}
    page_url = f"https://gdr.openei.org/submissions/{number.group(0)}"
    request = urllib.request.Request(page_url, headers={"User-Agent": "GeoSee data intake"})
    try:
        page = urllib.request.urlopen(request, timeout=30).read().decode("utf-8", "ignore")
    except Exception:
        _SUBMISSION_RESOURCE_CACHE[submission] = {}
        return {}
    resources: dict[str, dict[str, Any]] = {}
    for block in re.split(r'<div class="sub-resource"', page)[1:]:
        title_match = re.search(r'resource-name"[^>]*title="([^"]+)"', block, re.S)
        href_match = re.search(
            r"<a[^>]+class=['\"][^'\"]*downloadlink[^'\"]*['\"][^>]+href=['\"]([^'\"]+)['\"]",
            block,
            re.S,
        )
        if not title_match or not href_match:
            continue
        title = html.unescape(title_match.group(1)).strip()
        href = html.unescape(href_match.group(1)).strip()
        size_match = re.search(r"<small[^>]*class=['\"][^'\"]*text-muted[^'\"]*['\"][^>]*>(.*?)</small>", block, re.S)
        size_text = re.sub(r"\s+", " ", html.unescape(size_match.group(1))).strip() if size_match else None
        resources[resource_name_key(title)] = {
            "title": title,
            "url": safe_download_url(urllib.parse.urljoin(page_url, href)),
            "sizeText": size_text,
            "sizeBytes": parse_size_bytes(size_text),
        }
    _SUBMISSION_RESOURCE_CACHE[submission] = resources
    return resources


def resolved_resource(resource: dict[str, Any]) -> dict[str, Any]:
    if resource.get("externalUrl"):
        return {
            "url": safe_download_url(resource["externalUrl"]),
            "title": resource["filename"],
            "external": True,
            "sizeBytes": None,
            "sizeText": None,
        }
    target_key = resource_name_key(resource["filename"])
    resources = scraped_submission_resources(resource["submission"])
    if target_key in resources:
        return resources[target_key]
    for key, candidate in resources.items():
        if target_key in key or key in target_key:
            return candidate
    return {
        "url": safe_download_url(resource_url(resource["submission"], resource["filename"])),
        "title": resource["filename"],
        "external": False,
        "sizeBytes": None,
        "sizeText": None,
    }


def download_resources(source_root: Path, wells: set[str] | None = None) -> list[dict[str, Any]]:
    source_root.mkdir(parents=True, exist_ok=True)
    results = []
    for resource in RESOURCE_CATALOG:
        canonical = canonical_well_id(resource["well"])
        if wells and canonical and canonical not in wells:
            continue
        resolved = resolved_resource(resource)
        submission_dir = source_root / resource["submission"].replace(" ", "_")
        output = submission_dir / resource["filename"]
        result = {
            "submission": resource["submission"],
            "well": resource["well"],
            "filename": resource["filename"],
            "resolvedTitle": resolved.get("title"),
            "url": resolved["url"],
            "sizeText": resolved.get("sizeText"),
            "sizeBytes": resolved.get("sizeBytes"),
            "status": "present" if output.exists() else "pending",
        }
        if resolved.get("external"):
            result["status"] = "external-resource"
            result["reason"] = "GDR submission points to an external trajectory spreadsheet collection"
            results.append(result)
            continue
        if output.exists():
            result["bytes"] = output.stat().st_size
            results.append(result)
            continue
        if resolved.get("sizeBytes") and resolved["sizeBytes"] > MAX_DOWNLOAD_BYTES:
            result["status"] = "download-skipped:large-resource"
            result["reason"] = f"resource exceeds {MAX_DOWNLOAD_BYTES} byte intake cap"
            results.append(result)
            continue
        try:
            submission_dir.mkdir(parents=True, exist_ok=True)
            request = urllib.request.Request(resolved["url"], headers={"User-Agent": "GeoSee data intake"})
            with urllib.request.urlopen(request, timeout=90) as response:
                output.write_bytes(response.read())
            result["status"] = "downloaded"
            result["bytes"] = output.stat().st_size
        except Exception as exc:  # noqa: BLE001 - record source gate instead of crashing full audit.
            result["status"] = "download-blocked"
            result["reason"] = str(exc)
        results.append(result)
    return results


def load_demo_boreholes(path: Path = DEMO_BOREHOLES_MANIFEST) -> dict[str, Any]:
    if not path.exists():
        return {"wells": [], "priorityRegistry": []}
    return json.loads(path.read_text(encoding="utf-8"))


def demo_trajectory_map(demo: dict[str, Any]) -> dict[str, dict[str, Any]]:
    output = {}
    for well in demo.get("wells", []):
        well_id = canonical_well_id(well.get("id")) or well.get("id")
        if not well_id:
            continue
        trajectory = well.get("trajectory")
        if not isinstance(trajectory, list) or len(trajectory) < 2:
            continue
        output[well_id] = {
            "status": "available",
            "sourceLayerId": "utah-forge-phase3-demo-boreholes",
            "sourceManifest": "projects/utah-forge/data/geosee_processed/utah_forge_phase_3/demo_boreholes/phase3_demo_boreholes.json",
            "sourceSubmission": well.get("source", ""),
            "sourceFile": well.get("sourceFile", ""),
            "pointCount": len(trajectory),
            "mdFt": {
                "min": min(point.get("mdFt", 0) for point in trajectory),
                "max": max(point.get("mdFt", 0) for point in trajectory),
            },
            "points": [
                {
                    "mdFt": point.get("mdFt"),
                    "utm": point.get("utm"),
                    "scene": point.get("scene"),
                }
                for point in trajectory
                if isinstance(point, dict)
                and isinstance(point.get("scene"), list)
                and isinstance(point.get("utm"), list)
                and isinstance(point.get("mdFt"), (int, float))
            ],
        }
    return output


def demo_location_map(demo: dict[str, Any]) -> dict[str, dict[str, Any]]:
    output = {}
    for entry in demo.get("priorityRegistry", []):
        source_location = entry.get("sourceLocation")
        well_id = canonical_well_id(entry.get("id") or entry.get("label"))
        if not well_id or not isinstance(source_location, dict):
            continue
        output[well_id] = source_location
    return output


def track_to_manifest(track: ParsedTrack, index: int, trajectory_available: bool) -> dict[str, Any]:
    return {
        "id": f"{track.well_id}-{track.kind}-{track.mnemonic}-{index}".lower()
        .replace("(", "")
        .replace(")", "")
        .replace("/", "-"),
        "kind": track.kind,
        "mnemonic": track.mnemonic,
        "label": f"{track.mnemonic} {track.kind}",
        "unit": track.unit,
        "depthUnit": track.depth_unit,
        "axisScale": "log10" if track.kind == "resistivity" else "linear",
        "provenanceClassification": "measured",
        "renderStatus": "renderable" if trajectory_available else "source-blocked:no-validated-trajectory",
        "claimStatus": "source-derived-machine-readable",
        "source": {
            "submission": track.source_submission,
            "file": track.source_file,
            "member": track.source_member,
        },
        "sampleSpacing": {
            "nominalFt": track.nominal_spacing_ft,
            "sourceNote": "Derived from source depth samples; no finer detail is implied.",
        },
        "samples": track.samples,
    }


def lithology_to_manifest(interval: ParsedLithology, trajectory_available: bool) -> dict[str, Any]:
    interval_ft = round(interval.to_ft - interval.from_ft, 6)
    return {
        "fromMdFt": interval.from_ft,
        "toMdFt": interval.to_ft,
        "lithology": interval.lithology,
        "provenanceClassification": "interpreted",
        "renderStatus": "renderable" if trajectory_available else "source-blocked:no-validated-trajectory",
        "claimStatus": "source-derived-cuttings-interval",
        "source": {
            "submission": interval.source_submission,
            "file": interval.source_file,
            "member": interval.source_member,
            "note": interval.source_note,
        },
        "sampleSpacing": {
            "sourceIntervalFt": interval_ft,
            "sourceNote": "Cuttings interval; column may interpolate between samples but must not imply finer detail.",
        },
    }


def build_manifest(
    inventory: dict[str, Any],
    tracks: list[ParsedTrack],
    lithologies: list[ParsedLithology],
    gaps: list[dict[str, Any]],
    requested_wells: set[str] | None = None,
    download_results: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    demo = load_demo_boreholes()
    trajectories = demo_trajectory_map(demo)
    locations = demo_location_map(demo)
    well_ids = set(TARGET_WELLS)
    well_ids.update(trajectories)
    well_ids.update(track.well_id for track in tracks)
    well_ids.update(interval.well_id for interval in lithologies)
    well_ids.update(locations)
    if requested_wells:
        well_ids = {well for well in well_ids if well in requested_wells}

    wells = []
    for well_id in sorted(well_ids):
        trajectory = trajectories.get(well_id)
        trajectory_available = bool(trajectory and trajectory.get("status") == "available")
        well_tracks = [track for track in tracks if track.well_id == well_id]
        well_lithologies = [interval for interval in lithologies if interval.well_id == well_id]
        rendered_tracks = [
            track_to_manifest(track, index + 1, trajectory_available)
            for index, track in enumerate(well_tracks)
        ]
        rendered_lithologies = [
            lithology_to_manifest(interval, trajectory_available)
            for interval in well_lithologies
        ]
        if (rendered_tracks or rendered_lithologies) and trajectory_available:
            render_status = "renderable"
        elif rendered_tracks or rendered_lithologies:
            render_status = "source-blocked:no-validated-trajectory"
        else:
            render_status = "source-blocked:no-machine-readable-log-track"
        source_location = locations.get(well_id)
        wells.append(
            {
                "id": well_id,
                "label": well_id,
                "wellhead": source_location,
                "trajectory": trajectory
                if trajectory_available
                else {
                    "status": "missing",
                    "requiredForRender": True,
                    "gap": "validated as-drilled trajectory is required; no vertical projection fallback is allowed",
                },
                "tracks": rendered_tracks,
                "lithologyIntervals": rendered_lithologies,
                "renderStatus": render_status,
                "gaps": [
                    {
                        "status": "source-present-no-render",
                        "reason": "machine-readable source exists but validated trajectory is missing",
                    }
                ]
                if render_status == "source-blocked:no-validated-trajectory"
                else [],
            },
        )

    return {
        "schema": "geosee.utah-forge.borehole-logs.v1",
        "label": "Utah FORGE Borehole Logs",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "crs": {
            "horizontalCrs": "EPSG:26912",
            "label": "NAD83 / UTM Zone 12N",
            "units": "m",
            "sceneOrigin": SCENE_ORIGIN_UTM,
        },
        "sourcePolicy": {
            "rawSourceRoot": ".tmp/source-intake/utah-forge-borehole-logs",
            "rawSourcesCommitted": False,
            "trajectoryPolicy": "render only on validated as-drilled trajectories",
            "dlisPolicy": "inventoried but not parsed unless a tested parser is added",
        },
        "inventorySummary": {
            "entryCount": len(inventory.get("entries", [])),
            "parsedTrackCount": len(tracks),
            "parsedLithologyIntervalCount": len(lithologies),
            "downloadResults": download_results or [],
        },
        "wells": wells,
        "gaps": gaps,
    }


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def parse_well_filters(values: list[str] | None) -> set[str] | None:
    if not values:
        return None
    wells = {canonical_well_id(value) for value in values}
    return {well for well in wells if well}


def ingest_borehole_logs(
    source_root: Path = DEFAULT_SOURCE_ROOT,
    inventory_out: Path = DEFAULT_INVENTORY,
    out: Path = DEFAULT_OUTPUT,
    wells: set[str] | None = None,
    download: bool = False,
    require_renderable: bool = False,
) -> dict[str, Any]:
    download_results = download_resources(source_root, wells) if download else []
    inventory, tracks, lithologies, gaps = inventory_source_root(source_root)
    inventory["downloadResults"] = download_results
    manifest = build_manifest(inventory, tracks, lithologies, gaps, wells, download_results)
    if require_renderable and not any(well["renderStatus"] == "renderable" for well in manifest["wells"]):
        raise BoreholeLogIngestError("no renderable borehole log tracks were produced")
    write_json(inventory_out, inventory)
    write_json(out, manifest)
    return manifest


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Ingest Utah FORGE borehole logs into a browser manifest")
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE_ROOT)
    parser.add_argument("--inventory-out", type=Path, default=DEFAULT_INVENTORY)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--well", action="append", default=None)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--require-renderable", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    wells = parse_well_filters(args.well)
    try:
        manifest = ingest_borehole_logs(
            source_root=args.source_root,
            inventory_out=args.inventory_out,
            out=args.out,
            wells=wells,
            download=args.download,
            require_renderable=args.require_renderable,
        )
    except BoreholeLogIngestError as exc:
        print(f"ERROR: {exc}")
        return 1
    print(
        json.dumps(
            {
                "out": str(args.out),
                "inventory": str(args.inventory_out),
                "wells": len(manifest["wells"]),
                "renderableWells": sum(
                    1 for well in manifest["wells"] if well["renderStatus"] == "renderable"
                ),
            },
            indent=2,
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
