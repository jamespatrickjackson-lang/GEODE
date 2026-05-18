"""
One-off prep script. Pulls active mineral tenures owned by Vizsla Copper
Corp (owner number 284856) from the DataBC public WFS, dissolves them
into a single boundary polygon, and writes the result as GeoJSON in
EPSG:26910.

Usage (from C:\\GeoSee_Dev):
    python prep/fetch_claim.py

Reads:  https://openmaps.gov.bc.ca/geo/pub/wfs (DataBC public WFS)
Writes: data/claim_boundary.geojson  (one MultiPolygon feature)

Layer:  WHSE_MINERAL_TENURE.MTA_ACQUIRED_TENURE_SVW
        (active acquired mineral / placer / coal tenures -- the view is
         already restricted to non-terminated tenures, so a separate
         status filter isn't strictly required)
Filter: CLIENT_NUMBER_ID = 284856  (Vizsla Copper Corp)
        TERMINATION_DATE is null   (defensive; in-good-standing only)
        bbox spatial intersection in EPSG:26910

Native CRS for the WFS layer is BC Albers (EPSG:3005); we ask the server
to reproject features to EPSG:26910 by passing srsName=. Bbox is in the
same CRS so the spatial filter aligns with project bounds.

Dependencies: geopandas + shapely (used for the dissolve / unary_union
step). The other prep scripts in this folder are stdlib-only; this one
is the exception because hand-rolling a polygon union for several dozen
overlapping tenures would be tedious and error-prone.
"""

import json
import urllib.parse
import urllib.request
from pathlib import Path

import geopandas as gpd
from shapely.ops import unary_union

DST = Path("data/claim_boundary.geojson")

TARGET_CRS = "EPSG:26910"
# (min_easting, min_northing, max_easting, max_northing) -- matches the
# 40x40 km project tile centred on (612000, 5790000).
BBOX = (592000, 5770000, 632000, 5810000)

OWNER_NUM = 284856  # Vizsla Copper Corp
LAYER = "WHSE_MINERAL_TENURE.MTA_ACQUIRED_TENURE_SVW"
WFS_BASE = "https://openmaps.gov.bc.ca/geo/pub/wfs"

# WFS default count is small; bump explicitly so dense AOIs don't get
# silently truncated.
COUNT_LIMIT = 50000


def fetch_wfs() -> dict:
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": LAYER,
        "srsName": TARGET_CRS,
        "bbox": f"{BBOX[0]},{BBOX[1]},{BBOX[2]},{BBOX[3]},{TARGET_CRS}",
        "outputFormat": "application/json",
        "count": COUNT_LIMIT,
    }
    url = WFS_BASE + "?" + urllib.parse.urlencode(params)
    print(f"  Fetching {LAYER}")
    print(f"    {url[:140]}...")
    req = urllib.request.Request(url, headers={"User-Agent": "GeoSee/0.1"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read())


def find_column(columns, *needles) -> str | None:
    """Return the first column whose upper-cased name contains every
    needle in `needles`. Defensive against schema drift between layer
    revisions (DataBC has renamed fields more than once)."""
    upper = [(c, c.upper()) for c in columns]
    for c, u in upper:
        if all(n in u for n in needles):
            return c
    return None


def main():
    print("DataBC mineral tenures -> Vizsla Copper consolidated boundary")
    print(f"  Bounds: {BBOX}")
    print(f"  Owner number: {OWNER_NUM}")

    raw = fetch_wfs()
    feats = raw.get("features", [])
    print(f"  {len(feats)} tenures within bbox before owner/status filter")
    if not feats:
        raise SystemExit("WFS returned no features within bbox")

    gdf = gpd.GeoDataFrame.from_features(feats, crs=TARGET_CRS)

    # Schema notes (verified against MTA_ACQUIRED_TENURE_SVW 2026-04-30):
    #   CLIENT_NUMBER_ID  -- numeric owner ID (matches what MTO calls
    #                        "owner number"; the brief's 284856 lives
    #                        here, not in any OWNER_NUM column)
    #   OWNER_NAME        -- human-readable owner string
    #   TERMINATION_DATE  -- null while the tenure is in good standing;
    #                        a date once it has been forfeited / lapsed
    owner_col = "CLIENT_NUMBER_ID"
    if owner_col not in gdf.columns:
        raise SystemExit(
            f"expected column {owner_col!r} not found; columns: "
            f"{sorted(gdf.columns)}"
        )

    # Coerce to int-as-string for a clean equality compare. The WFS
    # returns CLIENT_NUMBER_ID as numeric; cast both sides to str so a
    # stray float like 284856.0 still matches.
    owner_str = (
        gdf[owner_col]
        .astype("Int64", errors="ignore")
        .astype(str)
        .str.strip()
    )
    sub = gdf[owner_str == str(OWNER_NUM)]
    if "TERMINATION_DATE" in gdf.columns:
        sub = sub[sub["TERMINATION_DATE"].isna()]
    n_match = len(sub)
    if n_match == 0:
        raise SystemExit(
            "no matching tenures (check owner number / status filter)"
        )

    # Dissolve: unary_union returns Polygon or MultiPolygon depending on
    # adjacency. Either is valid GeoJSON; the loader handles both.
    dissolved = unary_union(sub.geometry.tolist())
    out = gpd.GeoDataFrame(
        {"name": ["Vizsla Copper Corp consolidated boundary"]},
        geometry=[dissolved],
        crs=TARGET_CRS,
    )

    area_ha = dissolved.area / 10000.0  # m^2 -> hectares
    print(f"  matched {n_match} tenures; dissolved area = {area_ha:,.1f} ha")

    DST.parent.mkdir(parents=True, exist_ok=True)
    if DST.exists():
        DST.unlink()  # geopandas append-mode safety
    out.to_file(DST, driver="GeoJSON")
    print(f"  -> {DST.resolve()}")
    print("Done.")


if __name__ == "__main__":
    main()
