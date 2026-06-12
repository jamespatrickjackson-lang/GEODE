from __future__ import annotations

import json
import struct
import tempfile
import zipfile
from pathlib import Path
from typing import Any


class Phase2CWellsAuditError(RuntimeError):
    pass


IDENTITY_FIELDS = [
    "WELL_NAME",
    "WELLNAME",
    "WELL_ID",
    "WELLID",
    "HOLE_ID",
    "HOLEID",
    "BOREHOLE",
    "BHID",
    "NAME",
    "LABEL",
]


def _read_exact(path: Path, size: int, label: str) -> bytes:
    data = path.read_bytes()
    if len(data) < size:
        raise Phase2CWellsAuditError(f"{label} is too small to be a valid shapefile component")
    return data


def _component_paths(input_path: Path) -> tuple[Path, dict[str, Path], tempfile.TemporaryDirectory[str] | None]:
    temp_dir: tempfile.TemporaryDirectory[str] | None = None
    source_dir = input_path
    if input_path.is_file() and input_path.suffix.lower() == ".zip":
        temp_dir = tempfile.TemporaryDirectory(prefix="phase2c-wells-")
        with zipfile.ZipFile(input_path) as archive:
            archive.extractall(temp_dir.name)
        source_dir = Path(temp_dir.name)
    elif input_path.is_dir():
        sidecar_shps = list(input_path.rglob("*.shp"))
        if not sidecar_shps:
            zips = list(input_path.glob("*.zip"))
            if len(zips) == 1:
                temp_dir = tempfile.TemporaryDirectory(prefix="phase2c-wells-")
                with zipfile.ZipFile(zips[0]) as archive:
                    archive.extractall(temp_dir.name)
                source_dir = Path(temp_dir.name)
            elif len(zips) > 1:
                raise Phase2CWellsAuditError("multiple zip packages found; provide one Phase2C wells package")
    else:
        raise Phase2CWellsAuditError(f"input path does not exist: {input_path}")

    shp_files = list(source_dir.rglob("*.shp"))
    if not shp_files:
        raise Phase2CWellsAuditError("missing .shp geometry component")
    preferred = [
        path
        for path in shp_files
        if path.stem.lower() == "utah_forge_phase2c_wells"
    ]
    if len(preferred) == 1:
        shp = preferred[0]
    elif len(shp_files) == 1:
        shp = shp_files[0]
    else:
        raise Phase2CWellsAuditError("multiple .shp files found; provide only Utah_FORGE_Phase2C_wells")

    stem = shp.with_suffix("")
    components = {".shp": shp}
    for suffix in [".shx", ".dbf", ".prj", ".cpg", ".sbn", ".sbx"]:
        candidate = stem.with_suffix(suffix)
        if candidate.exists():
            components[suffix] = candidate
    if ".dbf" not in components:
        raise Phase2CWellsAuditError("attribute table missing: .dbf component is required")
    if ".shx" not in components:
        raise Phase2CWellsAuditError("missing .shx index component")
    if ".prj" not in components:
        raise Phase2CWellsAuditError("missing .prj coordinate reference component")
    if ".cpg" not in components:
        raise Phase2CWellsAuditError("missing .cpg codepage component")
    return source_dir, components, temp_dir


def _file_component(path: Path, extension: str) -> dict[str, Any]:
    return {
        "extension": extension,
        "name": path.name,
        "bytes": path.stat().st_size,
    }


def _read_shp_header(path: Path, label: str) -> dict[str, Any]:
    data = _read_exact(path, 100, label)
    file_code = struct.unpack(">i", data[0:4])[0]
    if file_code != 9994:
        raise Phase2CWellsAuditError(f"invalid {label} file code: {file_code}")
    declared_words = struct.unpack(">i", data[24:28])[0]
    actual_words = path.stat().st_size // 2
    if declared_words != actual_words:
        raise Phase2CWellsAuditError(
            f"{label} length mismatch: header declares {declared_words * 2} bytes, file has {path.stat().st_size} bytes",
        )
    version = struct.unpack("<i", data[28:32])[0]
    shape_type = struct.unpack("<i", data[32:36])[0]
    if version != 1000:
        raise Phase2CWellsAuditError(f"invalid {label} version: {version}")
    if shape_type != 1:
        raise Phase2CWellsAuditError(f"{label} must contain Point geometry, found shape type {shape_type}")
    xmin, ymin, xmax, ymax = struct.unpack("<4d", data[36:68])
    return {
        "fileCode": file_code,
        "version": version,
        "shapeType": shape_type,
        "declaredBytes": declared_words * 2,
        "bounds": [xmin, ymin, xmax, ymax],
    }


def _read_shx(path: Path) -> tuple[dict[str, Any], list[tuple[int, int]]]:
    header = _read_shp_header(path, "SHX")
    data = path.read_bytes()[100:]
    if len(data) % 8 != 0:
        raise Phase2CWellsAuditError("SHX record table length is not divisible by 8")
    entries = [
        struct.unpack(">2i", data[index : index + 8])
        for index in range(0, len(data), 8)
    ]
    header["recordCount"] = len(entries)
    return header, entries


def _read_shp_points(path: Path) -> tuple[dict[str, Any], list[dict[str, float]]]:
    header = _read_shp_header(path, "SHP")
    data = path.read_bytes()
    offset = 100
    points: list[dict[str, float]] = []
    while offset < len(data):
        if offset + 8 > len(data):
            raise Phase2CWellsAuditError("SHP record header is truncated")
        _record_number, content_words = struct.unpack(">2i", data[offset : offset + 8])
        offset += 8
        content_bytes = content_words * 2
        content = data[offset : offset + content_bytes]
        if len(content) != content_bytes:
            raise Phase2CWellsAuditError("SHP record content is truncated")
        offset += content_bytes
        if content_bytes < 20:
            raise Phase2CWellsAuditError("SHP point record is too small")
        shape_type = struct.unpack("<i", content[0:4])[0]
        if shape_type != 1:
            raise Phase2CWellsAuditError(f"SHP record must be Point geometry, found shape type {shape_type}")
        x, y = struct.unpack("<2d", content[4:20])
        points.append({"easting_m": x, "northing_m": y})
    header["recordCount"] = len(points)
    return header, points


def _decode_dbf_value(raw: bytes) -> str:
    return raw.decode("utf-8", errors="replace").strip().strip("\x00")


def _read_dbf(path: Path) -> tuple[dict[str, Any], list[dict[str, str]]]:
    data = _read_exact(path, 33, "DBF")
    if data[0] not in {0x03, 0x30, 0x31, 0x83}:
        raise Phase2CWellsAuditError(f"unreadable DBF header: version byte {data[0]}")
    record_count = struct.unpack("<I", data[4:8])[0]
    header_length = struct.unpack("<H", data[8:10])[0]
    record_length = struct.unpack("<H", data[10:12])[0]
    full = path.read_bytes()
    if header_length > len(full):
        raise Phase2CWellsAuditError("unreadable DBF header: header length exceeds file size")
    if full[header_length - 1] != 0x0D:
        raise Phase2CWellsAuditError("unreadable DBF header: field descriptor terminator missing")
    fields = []
    offset = 32
    while offset < header_length - 1:
        descriptor = full[offset : offset + 32]
        if len(descriptor) != 32:
            raise Phase2CWellsAuditError("unreadable DBF header: truncated field descriptor")
        raw_name = descriptor[:11].split(b"\x00", 1)[0]
        name = raw_name.decode("ascii", errors="replace").strip()
        field_type = chr(descriptor[11])
        length = descriptor[16]
        fields.append({"name": name, "type": field_type, "length": length})
        offset += 32
    expected_min_size = header_length + record_count * record_length
    if len(full) < expected_min_size:
        raise Phase2CWellsAuditError("DBF record table is truncated")

    rows: list[dict[str, str]] = []
    record_offset = header_length
    for _index in range(record_count):
        record = full[record_offset : record_offset + record_length]
        record_offset += record_length
        if not record or record[0:1] == b"*":
            rows.append({})
            continue
        value_offset = 1
        row: dict[str, str] = {}
        for field in fields:
            length = int(field["length"])
            row[field["name"]] = _decode_dbf_value(record[value_offset : value_offset + length])
            value_offset += length
        rows.append(row)
    return {
        "recordCount": record_count,
        "headerBytes": header_length,
        "recordBytes": record_length,
        "fields": fields,
    }, rows


def _check_prj(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    normalized = text.upper().replace(" ", "_")
    has_zone_12n = "12N" in normalized or "ZONE_12" in normalized
    if "1983" not in normalized or "UTM" not in normalized or not has_zone_12n:
        raise Phase2CWellsAuditError("PRJ is not NAD83 UTM Zone 12N / EPSG:26912")
    return "EPSG:26912 / NAD83 UTM Zone 12N"


def _identity_for_row(row: dict[str, str], row_number: int) -> dict[str, Any]:
    values = [
        {"field": field, "value": row[field].strip()}
        for field in IDENTITY_FIELDS
        if row.get(field, "").strip()
    ]
    distinct = sorted({entry["value"] for entry in values})
    if len(distinct) > 1:
        fields = ", ".join(entry["field"] for entry in values)
        raise Phase2CWellsAuditError(
            f"ambiguous identity fields in DBF record {row_number}: {fields}",
        )
    if not values:
        return {"name": None, "field": None}
    return {"name": values[0]["value"], "field": values[0]["field"]}


def audit_phase2c_wells(input_path: Path | str) -> dict[str, Any]:
    source_dir, components, temp_dir = _component_paths(Path(input_path))
    try:
        source_crs = _check_prj(components[".prj"])
        shp_header, points = _read_shp_points(components[".shp"])
        shx_header, shx_entries = _read_shx(components[".shx"])
        dbf_header, dbf_rows = _read_dbf(components[".dbf"])
        if len(points) != len(shx_entries):
            raise Phase2CWellsAuditError(
                f"SHP/SHX record-count mismatch: {len(points)} points vs {len(shx_entries)} index records",
            )
        if len(points) != dbf_header["recordCount"]:
            raise Phase2CWellsAuditError(
                f"record-count mismatch: {len(points)} SHP points vs {dbf_header['recordCount']} DBF records",
            )
        records = []
        for index, (point, row) in enumerate(zip(points, dbf_rows, strict=True), 1):
            identity = _identity_for_row(row, index)
            records.append(
                {
                    "index": index,
                    "geometry": point,
                    "identity": identity,
                    "attributes": row,
                },
            )
        return {
            "schema": "geosee.utahForge.phase2cWells.audit.v1",
            "source": "Utah_FORGE_Phase2C_wells",
            "sourceDirectory": str(source_dir),
            "sourceCrs": source_crs,
            "recordCount": len(records),
            "components": [
                _file_component(path, extension)
                for extension, path in sorted(components.items())
                if extension in {".shp", ".shx", ".dbf", ".prj", ".cpg"}
            ],
            "shp": shp_header,
            "shx": shx_header,
            "dbf": dbf_header,
            "records": records,
        }
    finally:
        if temp_dir is not None:
            temp_dir.cleanup()


def write_audit_json(audit: dict[str, Any], output_path: Path | str) -> None:
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
