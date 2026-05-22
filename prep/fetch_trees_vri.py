"""
One-off prep script. Pulls BC Vegetation Resources Inventory (VRI)
Rank 1 forest polygons from DataBC, clips them to the Woodjam project
bounds, and writes a lightweight polygon layer for terrain-painted forest
cover boundaries in the app.

Usage (from C:\\GeoSee\\GeoSee_Dev):
    python prep/fetch_trees_vri.py

Reads:  data/source/trees_vri/veg_comp_lyr_r1_poly_2024.gdb.zip
        or data/source/trees_vri/veg_comp_lyr_r1_poly_2024.gdb
        or data/source/trees_vri/VEG_COMP_LYR_R1_POLY/VEG_R1_PLY_polygon.shp
        or https://openmaps.gov.bc.ca/geo/pub/wfs (DataBC public WFS)
Writes: data/trees_vri.geojson

The former repo-local data/source/trees_vri bucket is archived at
C:/GeoSee/GeoSee_Archive/data/source/trees_vri/ unless temporarily restored
for regeneration.

BC VRI catalogue entry:
  - WHSE_FOREST_VEGETATION.VEG_COMP_LYR_R1_POLY

The generated polygons preserve the useful VRI attributes the renderer needs:
crown closure, projected height, leading species, age, and source polygon id.
"""

import json
import math
import zipfile
import urllib.parse
import urllib.request
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import MultiPolygon, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

DST_TREES = Path("data/trees_vri.geojson")
LOCAL_VRI_ROOT = Path("data/source/trees_vri")
LOCAL_VRI_GDB_ZIP = LOCAL_VRI_ROOT / "veg_comp_lyr_r1_poly_2024.gdb.zip"
LOCAL_VRI_GDB = LOCAL_VRI_ROOT / "veg_comp_lyr_r1_poly_2024.gdb"
LOCAL_VRI_SHAPEFILE = Path(
    "data/source/trees_vri/VEG_COMP_LYR_R1_POLY/VEG_R1_PLY_polygon.shp"
)

TARGET_CRS = "EPSG:26910"
FETCH_CRS = "EPSG:3005"
BBOX = (592000, 5770000, 632000, 5810000)

ARCGIS_QUERY_URL = (
    "https://delivery.maps.gov.bc.ca/arcgis/rest/services/mpcm/"
    "bcgwpub/MapServer/342/query"
)
VRI_LAYER = "WHSE_FOREST_VEGETATION.VEG_COMP_LYR_R1_POLY"
PAGE_SIZE = 1000
TILES_X = 5
TILES_Y = 5
POLYGON_SIMPLIFY_M = 6
DISSOLVED_SIMPLIFY_M = 14
LOCAL_VRI_FIELDS = [
    "POLYGON_ID",
    "POLY_ID",
    "OBJECTID",
    "CROWN_CLOSURE",
    "CR_CLOSURE",
    "PROJ_HEIGHT_1",
    "PROJ_HT_1",
    "PROJ_AGE_1",
    "SPECIES_CD_1",
    "SPEC_CD_1",
    "SPECIES_PCT_1",
    "SPEC_PCT_1",
    "FEATURE_AREA_SQM",
]

TO_FETCH = Transformer.from_crs(TARGET_CRS, FETCH_CRS, always_xy=True)
TO_TARGET = Transformer.from_crs(FETCH_CRS, TARGET_CRS, always_xy=True)
PROJECT_BOX = box(*BBOX)


def num(value, fallback=0.0) -> float:
    try:
        if value is None:
            return fallback
        out = float(value)
        return out if math.isfinite(out) else fallback
    except (TypeError, ValueError):
        return fallback


def fetch_vri_page(
    bbox: tuple[float, float, float, float],
    start_index: int,
) -> dict:
    params = {
        "f": "geojson",
        "where": "CROWN_CLOSURE > 0 AND PROJ_HEIGHT_1 > 0",
        "geometry": json.dumps(
            {
                "xmin": bbox[0],
                "ymin": bbox[1],
                "xmax": bbox[2],
                "ymax": bbox[3],
                "spatialReference": {"wkid": 3005},
            }
        ),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "3005",
        "outSR": "3005",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": ",".join(
            [
                "POLYGON_ID",
                "CROWN_CLOSURE",
                "PROJ_HEIGHT_1",
                "PROJ_AGE_1",
                "SPECIES_CD_1",
                "SPECIES_PCT_1",
                "FEATURE_AREA_SQM",
            ]
        ),
        "returnGeometry": "true",
        "resultOffset": start_index,
        "resultRecordCount": PAGE_SIZE,
    }
    url = ARCGIS_QUERY_URL + "?" + urllib.parse.urlencode(params)
    print(f"  Fetching VRI startIndex={start_index}")
    print(f"    {url[:120]}...")
    req = urllib.request.Request(url, headers={"User-Agent": "GeoSee/0.1"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read())


def project_bbox_to_fetch_crs(
    bbox: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    min_e, min_n, max_e, max_n = bbox
    points = [
        TO_FETCH.transform(min_e, min_n),
        TO_FETCH.transform(min_e, max_n),
        TO_FETCH.transform(max_e, min_n),
        TO_FETCH.transform(max_e, max_n),
    ]
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (min(xs), min(ys), max(xs), max(ys))


def tile_bboxes() -> list[tuple[float, float, float, float]]:
    min_e, min_n, max_e, max_n = BBOX
    dx = (max_e - min_e) / TILES_X
    dy = (max_n - min_n) / TILES_Y
    tiles = []
    for iy in range(TILES_Y):
        for ix in range(TILES_X):
            e0 = min_e + ix * dx
            e1 = min_e + (ix + 1) * dx
            n0 = min_n + iy * dy
            n1 = min_n + (iy + 1) * dy
            pad = 100
            tiles.append(
                project_bbox_to_fetch_crs((e0 - pad, n0 - pad, e1 + pad, n1 + pad))
            )
    return tiles


def project_box_fetch_crs() -> tuple[float, float, float, float]:
    return project_bbox_to_fetch_crs(BBOX)


def feature_key(feature: dict) -> str:
    props = feature.get("properties") or {}
    polygon_id = props.get("POLYGON_ID") or props.get("POLY_ID") or props.get("OBJECTID")
    if polygon_id is not None:
        return str(polygon_id)
    if feature.get("id"):
        return str(feature["id"])
    return json.dumps([props, feature.get("geometry")], sort_keys=True)


def first_prop(props: dict, names: list[str], fallback=None):
    for name in names:
        value = props.get(name)
        if value is not None:
            return value
    return fallback


def prop_num(props: dict, names: list[str], fallback=0.0) -> float:
    return num(first_prop(props, names), fallback)


def select_geopandas_layer(gpd, source: Path) -> str | None:
    try:
        layers = gpd.list_layers(source)
    except Exception:
        return None
    names = [str(name) for name in layers["name"].tolist()]
    preferred = [
        name
        for name in names
        if "VEG_COMP_LYR_R1" in name.upper()
        or "VEG_R1" in name.upper()
        or "R1_POLY" in name.upper()
    ]
    if preferred:
        return preferred[0]
    return names[0] if names else None


def read_local_vector(source: Path, *, layer: str | None = None):
    import geopandas as gpd

    bbox = project_box_fetch_crs()
    kwargs = {"bbox": bbox}
    if layer:
        kwargs["layer"] = layer
    try:
        gdf = gpd.read_file(source, **kwargs)
    except TypeError:
        gdf = gpd.read_file(source, layer=layer) if layer else gpd.read_file(source)
    except Exception as exc:
        print(f"  Local bbox read failed ({exc}); retrying full read")
        gdf = gpd.read_file(source, layer=layer) if layer else gpd.read_file(source)
    if gdf.crs is None:
        raise RuntimeError(f"{source} has no CRS")
    if str(gdf.crs).upper() != FETCH_CRS:
        gdf = gdf.to_crs(FETCH_CRS)
    project_fetch_box = box(*bbox)
    gdf = gdf[gdf.geometry.intersects(project_fetch_box)]
    keep_columns = [
        column
        for column in [*LOCAL_VRI_FIELDS, gdf.geometry.name]
        if column in gdf.columns
    ]
    gdf = gdf[keep_columns].copy()
    data = json.loads(gdf.to_json())
    return {feature_key(feature): feature for feature in data.get("features", [])}


def unzip_local_gdb() -> Path | None:
    if LOCAL_VRI_GDB.exists():
        return LOCAL_VRI_GDB
    if not LOCAL_VRI_GDB_ZIP.exists():
        return None
    print(f"  Extracting local VRI geodatabase: {LOCAL_VRI_GDB_ZIP}")
    with zipfile.ZipFile(LOCAL_VRI_GDB_ZIP) as zf:
        zf.extractall(LOCAL_VRI_ROOT)
    if LOCAL_VRI_GDB.exists():
        return LOCAL_VRI_GDB
    matches = sorted(LOCAL_VRI_ROOT.glob("*.gdb"))
    return matches[0] if matches else None


def find_local_gdb() -> Path | None:
    explicit = unzip_local_gdb()
    if explicit:
        return explicit
    matches = sorted(LOCAL_VRI_ROOT.glob("*.gdb"))
    return matches[0] if matches else None


def load_local_vri_features() -> tuple[str, dict[str, dict]] | None:
    import geopandas as gpd

    gdb = find_local_gdb()
    if gdb:
        layer = select_geopandas_layer(gpd, gdb)
        print(f"  Reading local VRI geodatabase: {gdb}")
        if layer:
            print(f"    Layer: {layer}")
        return (f"local gdb ({gdb.name})", read_local_vector(gdb, layer=layer))

    if LOCAL_VRI_SHAPEFILE.exists():
        print(f"  Reading local VRI shapefile: {LOCAL_VRI_SHAPEFILE}")
        return ("local shapefile", read_local_vector(LOCAL_VRI_SHAPEFILE))

    return None


def transformed_clipped_geometry(feature: dict):
    geom = feature.get("geometry")
    if not geom:
        return None
    try:
        shp = shape(geom)
        shp = transform(TO_TARGET.transform, shp)
        shp = shp.intersection(PROJECT_BOX)
        if shp.is_empty:
            return None
        return shp
    except Exception:
        return None


def rounded_coords(value, decimals: int = 2):
    if isinstance(value, (list, tuple)):
        return [rounded_coords(v, decimals) for v in value]
    if isinstance(value, float):
        return round(value, decimals)
    return value


def rounded_geometry_mapping(geom):
    out = mapping(geom)
    out["coordinates"] = rounded_coords(out.get("coordinates"))
    return out


def polygonal_only(geom):
    if geom.is_empty:
        return None
    if isinstance(geom, (Polygon, MultiPolygon)):
        return geom
    parts = [
        part
        for part in getattr(geom, "geoms", [])
        if isinstance(part, (Polygon, MultiPolygon)) and not part.is_empty
    ]
    return unary_union(parts) if parts else None


def main():
    DST_TREES.parent.mkdir(parents=True, exist_ok=True)

    print("BC VRI Rank 1 -> forest-cover boundary polygons")
    print(f"  Bounds: {BBOX}")

    local = load_local_vri_features()
    if local:
        source_label, raw_features = local
    else:
        source_label = "DataBC"
        raw_features = {}
        for tile_index, tile in enumerate(tile_bboxes(), start=1):
            print(f"  Tile {tile_index}/{TILES_X * TILES_Y}: {tuple(round(v, 1) for v in tile)}")
            start_index = 0
            while True:
                page = fetch_vri_page(tile, start_index)
                batch = page.get("features", [])
                print(f"    received {len(batch)} features")
                for feature in batch:
                    raw_features[feature_key(feature)] = feature
                if len(batch) < PAGE_SIZE:
                    break
                start_index += PAGE_SIZE

    geometries = []
    crown_values = []
    height_values = []
    for key, feature in raw_features.items():
        props = feature.get("properties") or {}
        crown = prop_num(props, ["CROWN_CLOSURE", "CR_CLOSURE"])
        height = prop_num(props, ["PROJ_HEIGHT_1", "PROJ_HT_1"])
        if crown <= 0 or height <= 0:
            continue
        geom = transformed_clipped_geometry(feature)
        if geom is None:
            continue
        if POLYGON_SIMPLIFY_M > 0:
            geom = geom.simplify(POLYGON_SIMPLIFY_M, preserve_topology=True)
            if geom.is_empty:
                continue
        geometries.append(geom)
        crown_values.append(crown)
        height_values.append(height)

    if not geometries:
        raise RuntimeError(
            "No VRI forest-cover polygons were generated. The source data may be "
            "outside the Woodjam project bounds; leaving data/trees_vri.geojson "
            "unchanged."
        )

    print(f"  Dissolving {len(geometries)} treed polygons into one forest body")
    forest_body = polygonal_only(unary_union(geometries))
    if forest_body is None or forest_body.is_empty:
        raise RuntimeError("Dissolved VRI forest body is empty.")
    # buffer(0) cleans tiny invalid slivers after dissolve; the final
    # topology-preserving simplify gives the raster edge a smoother read
    # without materially shifting the map boundary.
    forest_body = polygonal_only(forest_body.buffer(0))
    if forest_body is None or forest_body.is_empty:
        raise RuntimeError("Cleaned VRI forest body is empty.")
    if DISSOLVED_SIMPLIFY_M > 0:
        forest_body = polygonal_only(
            forest_body.simplify(DISSOLVED_SIMPLIFY_M, preserve_topology=True)
        )
    if forest_body is None or forest_body.is_empty:
        raise RuntimeError("Simplified VRI forest body is empty.")

    features = [
        {
            "type": "Feature",
            "properties": {
                "id": "woodjam-vri-forest-cover",
                "sourcePolygonCount": len(geometries),
                "meanCrownClosure": round(sum(crown_values) / len(crown_values), 2),
                "meanProjectedHeightM": round(sum(height_values) / len(height_values), 2),
                "featureAreaSqm": round(forest_body.area, 1),
            },
            "geometry": rounded_geometry_mapping(forest_body),
        }
    ]

    trees = {
        "type": "FeatureCollection",
        "name": "woodjam_vri_forest_cover_body",
        "crs": {"type": "name", "properties": {"name": TARGET_CRS}},
        "features": features,
    }
    DST_TREES.write_text(json.dumps(trees))

    print(f"  VRI source: {source_label}")
    print(f"  VRI polygons read: {len(raw_features)}")
    print(f"  Treed source polygons used: {len(geometries)}")
    print(f"  Dissolved forest features written: {len(features)}")
    if crown_values:
        print(f"  Crown closure range: {min(crown_values):.1f}-{max(crown_values):.1f}")
    if height_values:
        print(f"  Projected height range: {min(height_values):.1f}-{max(height_values):.1f} m")
    print(f"  Wrote: {DST_TREES.resolve()}")
    print("Done.")


if __name__ == "__main__":
    main()
