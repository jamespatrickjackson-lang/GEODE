"""Build downhole lithology intervals for the 2023 drill traces.

Reads the Woodjam DHDB lithology log and writes a compact JSON file keyed by
hole id for the web loader:

    data/drillhole_lithology.json

Rows without a valid hole id or from/to interval are ignored. The renderer uses
the primary geological field code for colour bands, while preserving useful log
context for future hover/tooltips.
"""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE_CANDIDATES = [
    ROOT / "data" / "Diamond Drilling_Lithology Log.csv",
    ROOT
    / "docs"
    / "woodjam"
    / "Appendix F - DHDB"
    / "Diamond Drilling_Lithology Log.csv",
]
OUTPUT = ROOT / "data" / "drillhole_lithology.json"

HOLE_COL = "Hole number"
FROM_COL = "From"
TO_COL = "To"
LITH_COL = "MX Lithology.Lith1_GF_Code"
LOCAL_CODE_COL = "Lithological_Log.Lith1_Local_Code"
TEXTURE_COL = "Lithological_Log.Lith1_Texture1"
COMMENTS_COL = "Lithological_Log.Comments"


def find_source() -> Path:
    for path in SOURCE_CANDIDATES:
        if path.exists():
            return path
    checked = "\n  ".join(str(path) for path in SOURCE_CANDIDATES)
    raise FileNotFoundError(f"Could not find drill lithology CSV. Checked:\n  {checked}")


def clean_float(value: Any) -> float | None:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, str):
        text = value.strip().replace(",", "")
        if not text:
            return None
        value = text
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(parsed):
        return None
    return parsed


def clean_text(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def main() -> None:
    source = find_source()
    df = pd.read_csv(source, low_memory=False)
    required = [HOLE_COL, FROM_COL, TO_COL, LITH_COL]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise KeyError(
            "Missing required column(s): "
            + ", ".join(missing)
            + f"\nAvailable columns: {', '.join(df.columns)}"
        )

    wanted = [
        HOLE_COL,
        FROM_COL,
        TO_COL,
        LITH_COL,
        LOCAL_CODE_COL,
        TEXTURE_COL,
        COMMENTS_COL,
    ]
    work = df[[col for col in wanted if col in df.columns]].copy()
    work[HOLE_COL] = work[HOLE_COL].astype(str).str.strip()
    work[FROM_COL] = work[FROM_COL].map(clean_float)
    work[TO_COL] = work[TO_COL].map(clean_float)
    work[LITH_COL] = work[LITH_COL].map(clean_text)
    for col in (LOCAL_CODE_COL, TEXTURE_COL, COMMENTS_COL):
        if col in work.columns:
            work[col] = work[col].map(clean_text)

    work = work[
        (work[HOLE_COL] != "")
        & work[FROM_COL].notna()
        & work[TO_COL].notna()
        & (work[TO_COL] > work[FROM_COL])
        & work[LITH_COL].notna()
    ].copy()
    work.sort_values([HOLE_COL, FROM_COL, TO_COL], inplace=True)

    lithology: dict[str, list[dict[str, float | str | None]]] = {}
    for hole_id, group in work.groupby(HOLE_COL, sort=True):
        records: list[dict[str, float | str | None]] = []
        for row in group.to_dict("records"):
            records.append(
                {
                    "from": float(row[FROM_COL]),
                    "to": float(row[TO_COL]),
                    "lithology": row[LITH_COL],
                    "localCode": row.get(LOCAL_CODE_COL),
                    "texture": row.get(TEXTURE_COL),
                    "comments": row.get(COMMENTS_COL),
                }
            )
        lithology[hole_id] = records

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(lithology, indent=2), encoding="utf-8")

    counts = Counter(work[LITH_COL].dropna().astype(str))
    top_codes = ", ".join(f"{code}={count}" for code, count in counts.most_common(12))
    print(f"[fetch_lithology] source: {source.relative_to(ROOT)}")
    print(f"[fetch_lithology] output: {OUTPUT.relative_to(ROOT)}")
    print(f"[fetch_lithology] holes: {len(lithology)}")
    print(f"[fetch_lithology] intervals: {sum(len(v) for v in lithology.values())}")
    print(f"[fetch_lithology] top lithology codes: {top_codes}")


if __name__ == "__main__":
    main()
