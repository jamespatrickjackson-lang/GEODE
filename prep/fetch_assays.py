"""Build downhole assay intervals for the 2023 drill traces.

Reads the Woodjam drill sample CSV from the DHDB export and writes a compact
JSON file keyed by hole id for the web loader:

    data/drillhole_assays.json

The CSV's plot columns already carry the intended map units:
- Cu_plot_ %    -> percent copper
- Au_plot_ g/t  -> grams per tonne gold

Rows without a valid hole id or from/to interval are ignored. Null assay values
are preserved as JSON null so the renderer can show sampled geometry without
claiming grade where no assay exists.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE_CANDIDATES = [
    ROOT / "data" / "Diamond Drilling_Samples.csv",
    ROOT
    / "docs"
    / "woodjam"
    / "Appendix F - DHDB"
    / "Diamond Drilling_Samples.csv",
]
OUTPUT = ROOT / "data" / "drillhole_assays.json"

HOLE_COL = "Hole number"
FROM_COL = "From"
TO_COL = "To"
CU_COL = "Cu_plot_ %"
AU_COL = "Au_plot_ g/t"


def find_source() -> Path:
    for path in SOURCE_CANDIDATES:
        if path.exists():
            return path
    checked = "\n  ".join(str(path) for path in SOURCE_CANDIDATES)
    raise FileNotFoundError(f"Could not find drill assay CSV. Checked:\n  {checked}")


def clean_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        # Preserve the measured value while allowing common assay qualifiers.
        text = text.removeprefix("<").removeprefix(">").replace(",", "")
        value = text
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(parsed):
        return None
    return parsed


def json_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value)


def percentile(values: pd.Series, q: float) -> float | None:
    cleaned = values.dropna()
    if cleaned.empty:
        return None
    return float(cleaned.quantile(q))


def fmt_range(label: str, values: pd.Series) -> str:
    cleaned = values.dropna()
    if cleaned.empty:
        return f"{label}: no values"
    return (
        f"{label}: min={cleaned.min():.6g}, max={cleaned.max():.6g}, "
        f"p95={percentile(cleaned, 0.95):.6g}"
    )


def main() -> None:
    source = find_source()
    df = pd.read_csv(source, low_memory=False)
    missing = [
        col for col in (HOLE_COL, FROM_COL, TO_COL, CU_COL, AU_COL) if col not in df.columns
    ]
    if missing:
        raise KeyError(
            "Missing required column(s): "
            + ", ".join(missing)
            + f"\nAvailable columns: {', '.join(df.columns)}"
        )

    work = df[[HOLE_COL, FROM_COL, TO_COL, CU_COL, AU_COL]].copy()
    work[HOLE_COL] = work[HOLE_COL].astype(str).str.strip()
    work[FROM_COL] = work[FROM_COL].map(clean_float)
    work[TO_COL] = work[TO_COL].map(clean_float)
    work[CU_COL] = work[CU_COL].map(clean_float)
    work[AU_COL] = work[AU_COL].map(clean_float)
    work = work[
        (work[HOLE_COL] != "")
        & work[FROM_COL].notna()
        & work[TO_COL].notna()
        & (work[TO_COL] > work[FROM_COL])
    ].copy()
    work.sort_values([HOLE_COL, FROM_COL, TO_COL], inplace=True)

    assays: dict[str, list[dict[str, float | None]]] = {}
    for hole_id, group in work.groupby(HOLE_COL, sort=True):
        assays[hole_id] = [
            {
                "from": json_float(row[FROM_COL]),
                "to": json_float(row[TO_COL]),
                "cu": json_float(row[CU_COL]),
                "au": json_float(row[AU_COL]),
            }
            for row in group.to_dict("records")
        ]

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(assays, indent=2), encoding="utf-8")

    print(f"[fetch_assays] source: {source.relative_to(ROOT)}")
    print(f"[fetch_assays] output: {OUTPUT.relative_to(ROOT)}")
    print(f"[fetch_assays] holes: {len(assays)}")
    print(f"[fetch_assays] intervals: {sum(len(v) for v in assays.values())}")
    print(f"[fetch_assays] {fmt_range('Cu %', work[CU_COL])}")
    print(f"[fetch_assays] {fmt_range('Au g/t', work[AU_COL])}")


if __name__ == "__main__":
    main()
