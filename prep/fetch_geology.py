"""
One-off prep script. Reads the BC Geological Survey provincial bedrock
geology shapefile (already downloaded + extracted to
prep/raw/bc_digital_geology/), clips to project bounds in EPSG:26910,
and writes:

    data/bedrock_geology.geojson   -- one Polygon/MultiPolygon feature
                                      per clipped bedrock polygon
    data/bedrock_geology_colors.json -- { strat_unit_code: "#hex", ... }

Usage (from C:\\GeoSee_Dev):
    python prep/fetch_geology.py

Inputs (all local, no network):
    prep/raw/bc_digital_geology/BC_bedrock_ll83.shp  (WGS84 lat/long)
    prep/raw/bc_digital_geology/BC_lithology.csv    (rock_code -> rock_type)
    prep/raw/bc_digital_geology/bc_strat_unit_colour_hex.csv
                                                    (strat_unit -> color)

Output GeoJSON drops irrelevant attributes; keeps:
    strat_unit       -- canonical unit code (key into colour table)
    rock_code        -- lithology code (key into lithology table)
    displayName      -- human-readable label for tooltips / SceneLabels
    color            -- hex from BCGS canonical palette (or neutral grey
                        fallback if a unit isn't in the table)
    age, era         -- pulled from shapefile if present (else absent)

Dependencies: geopandas + pandas (already pulled in for fetch_claim.py).
"""

import json
from pathlib import Path

import geopandas as gpd
import pandas as pd

RAW_DIR = Path("prep/raw/bc_digital_geology")
SHP = RAW_DIR / "BC_bedrock_ll83.shp"
LITHOLOGY_CSV = RAW_DIR / "BC_lithology.csv"
COLOR_CSV = RAW_DIR / "bc_strat_unit_colour_hex.csv"

DST_GEOJSON = Path("data/bedrock_geology.geojson")
DST_COLORS = Path("data/bedrock_geology_colors.json")

TARGET_CRS = "EPSG:26910"
BBOX = (592000, 5770000, 632000, 5810000)
NEUTRAL_GREY = "#808080"


def find_column(columns, *needles) -> str | None:
    upper = [(c, c.upper()) for c in columns]
    for c, u in upper:
        if all(n in u for n in needles):
            return c
    return None


def main():
    print("BC Geological Survey bedrock geology -> EPSG:26910 GeoJSON")
    print(f"  Bounds: {BBOX}")

    if not SHP.exists():
        raise SystemExit(f"missing shapefile: {SHP.resolve()}")
    if not LITHOLOGY_CSV.exists():
        raise SystemExit(f"missing lithology CSV: {LITHOLOGY_CSV.resolve()}")
    if not COLOR_CSV.exists():
        raise SystemExit(f"missing colour CSV: {COLOR_CSV.resolve()}")

    print(f"  Reading {SHP.name}...")
    gdf = gpd.read_file(SHP)
    print(f"    {len(gdf)} features, columns: {sorted(gdf.columns)}")

    # Reproject WGS84 -> UTM Zone 10 then clip to bbox.
    print(f"  Reprojecting -> {TARGET_CRS}, clipping to bbox...")
    gdf = gdf.to_crs(TARGET_CRS)
    minE, minN, maxE, maxN = BBOX
    gdf = gdf.cx[minE:maxE, minN:maxN]
    # cx is a bbox-intersect filter; we still want geometries clipped to
    # the bbox so polygons that extend outside don't smear into fog.
    gdf = gpd.clip(gdf, [minE, minN, maxE, maxN])
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    print(f"    {len(gdf)} polygons after clip")
    if len(gdf) == 0:
        raise SystemExit("no bedrock polygons within project bounds")

    # Discover the unit-code column. BCGS shapefiles vary slightly by
    # release; common candidates: STRAT_UNIT, strat_unit, UNIT.
    unit_col = (
        find_column(gdf.columns, "STRAT", "UNIT")
        or find_column(gdf.columns, "STRAT_UNIT")
        or "STRAT_UNIT"
    )
    if unit_col not in gdf.columns:
        raise SystemExit(
            f"could not find strat-unit column; have {list(gdf.columns)}"
        )
    # The shapefile already carries rock_type / rock_class / strat_name
    # directly -- the BC_lithology.csv lookup turns out to be redundant
    # for display purposes. Use shapefile columns first; CSV is a
    # fallback for any rock_class -> rock_type gap.
    strat_name_col = find_column(gdf.columns, "STRAT", "NAME")
    rock_type_col = find_column(gdf.columns, "ROCK", "TYPE")
    rock_class_col = find_column(gdf.columns, "ROCK", "CLASS")
    rock_code_col = find_column(gdf.columns, "ROCK", "CODE")

    # Optional age / era columns (pass through if present).
    age_col = find_column(gdf.columns, "AGE")
    era_col = find_column(gdf.columns, "ERA")

    print(
        f"  Unit column: {unit_col!r}; strat_name={strat_name_col!r}; "
        f"rock_type={rock_type_col!r}; era={era_col!r}; age={age_col!r}"
    )

    # ---- colour table ------------------------------------------------------
    color_df = pd.read_csv(COLOR_CSV)
    color_unit_col = find_column(color_df.columns, "STRAT", "UNIT") or "strat_unit"
    color_hex_col = (
        find_column(color_df.columns, "COLOR", "HEX")
        or find_column(color_df.columns, "COLOUR", "HEX")
        or find_column(color_df.columns, "HEX")
        or "color_hex"
    )
    color_map: dict[str, str] = {}
    for _, row in color_df.iterrows():
        key = str(row[color_unit_col]).strip()
        val = str(row[color_hex_col]).strip()
        if key and val and val.lower() not in ("nan", "none"):
            if not val.startswith("#"):
                val = "#" + val
            color_map[key] = val
    print(f"  Colour map: {len(color_map)} unit -> hex entries")

    # ---- lithology lookup --------------------------------------------------
    lith_df = pd.read_csv(LITHOLOGY_CSV)
    lith_code_col = (
        find_column(lith_df.columns, "ROCK", "CODE") or "rock_code"
    )
    lith_type_col = (
        find_column(lith_df.columns, "ROCK", "TYPE") or "rock_type"
    )
    lith_class_col = find_column(lith_df.columns, "ROCK", "CLASS")
    lith_lookup: dict[str, str] = {}
    for _, row in lith_df.iterrows():
        key = str(row[lith_code_col]).strip().lower()
        if not key:
            continue
        rock_type = str(row[lith_type_col]).strip()
        rock_class = (
            str(row[lith_class_col]).strip() if lith_class_col else ""
        )
        if rock_type:
            lith_lookup[key] = rock_type
        elif rock_class:
            lith_lookup[key] = rock_class

    # ---- compose output ----------------------------------------------------
    # Build a clean GeoDataFrame with only the columns we want to export.
    out_records = []
    distinct_units: dict[str, dict[str, str]] = {}
    used_colors: dict[str, str] = {}

    def cell(row, col: str | None) -> str:
        if not col or col not in gdf.columns:
            return ""
        v = row[col]
        if pd.isna(v):
            return ""
        return str(v).strip()

    for _, row in gdf.iterrows():
        strat_unit = cell(row, unit_col)
        strat_name = cell(row, strat_name_col)
        rock_type = cell(row, rock_type_col)
        rock_class = cell(row, rock_class_col)
        rock_code = cell(row, rock_code_col)

        # Display name preference, descending:
        #   "<strat_name> — <rock_type>"  (e.g. "Nicola Group — basalt")
        #   "<strat_name>"
        #   CSV-resolved rock_type via rock_code
        #   "<rock_type>"
        #   "<rock_class>"
        #   strat_unit code
        if strat_name and rock_type:
            display = f"{strat_name} — {rock_type}"
        elif strat_name:
            display = strat_name
        elif rock_code and rock_code.lower() in lith_lookup:
            display = lith_lookup[rock_code.lower()]
            if strat_unit:
                display = f"{strat_unit} — {display}"
        elif rock_type:
            display = (
                f"{strat_unit} — {rock_type}" if strat_unit else rock_type
            )
        elif rock_class:
            display = (
                f"{strat_unit} — {rock_class}" if strat_unit else rock_class
            )
        else:
            display = strat_unit or "Unknown unit"

        color = color_map.get(strat_unit, NEUTRAL_GREY)
        used_colors[strat_unit] = color
        if strat_unit not in distinct_units:
            distinct_units[strat_unit] = {
                "display_name": display,
                "color": color,
                "rock_type": rock_type,
            }
        rec = {
            "geometry": row.geometry,
            "strat_unit": strat_unit,
            "displayName": display,
            "color": color,
        }
        if rock_type:
            rec["rock_type"] = rock_type
        if rock_class:
            rec["rock_class"] = rock_class
        if age_col and age_col in gdf.columns and pd.notna(row[age_col]):
            rec["age"] = str(row[age_col]).strip()
        if era_col and era_col in gdf.columns and pd.notna(row[era_col]):
            rec["era"] = str(row[era_col]).strip()
        out_records.append(rec)

    out_gdf = gpd.GeoDataFrame(out_records, crs=TARGET_CRS)
    DST_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    if DST_GEOJSON.exists():
        DST_GEOJSON.unlink()
    out_gdf.to_file(DST_GEOJSON, driver="GeoJSON")

    DST_COLORS.write_text(
        json.dumps(used_colors, indent=2, sort_keys=True), encoding="utf-8"
    )

    total_area_m2 = float(out_gdf.geometry.area.sum())
    print(f"  Wrote {DST_GEOJSON.resolve()}")
    print(f"  Wrote {DST_COLORS.resolve()}")
    print(f"  Polygons: {len(out_gdf)}")
    print(f"  Distinct units: {len(distinct_units)}")
    print(f"  Total area: {total_area_m2 / 1e6:.2f} km^2")
    print("  First 10 distinct units (strat_unit | display_name | color):")
    for i, (code, info) in enumerate(distinct_units.items()):
        if i >= 10:
            break
        print(f"    {code!r:20} {info['display_name']!r:60} {info['color']}")
    print("Done.")


if __name__ == "__main__":
    main()
